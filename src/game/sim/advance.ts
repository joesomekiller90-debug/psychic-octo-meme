// The simulation clock. Time is advanced in exact steps from one event to the
// next (leg ends, work-order cycles, party departures), so advancing 10 hours
// in one call gives exactly the same result as advancing it 250 ms at a time.
// The live game loop and offline catch-up both go through `settle`.
import { HEROES } from '../data/heroes';
import { makeContext, pushFeed, type SimContext, type SimEvent } from './core';
import { refreshContracts } from './contracts';
import {
  checkPlan,
  dispatchExpedition,
  finishExpedition,
  legEnd,
  resolveLeg,
  returnDuration,
  REST_THRESHOLD,
} from './expedition';
import { healRatePerMs, heroStats, heroTravelling, offlineCapMs } from './rules';
import type { ExpeditionState, GameState } from './state';
import { refreshTutorial } from './tutorial';
import { completeCycle, tryStartCycle } from './workorders';

/** Milliseconds until the expedition's party is rested enough to depart again. */
function restRemaining(state: GameState, exp: ExpeditionState): number {
  const rate = healRatePerMs(state);
  let t = 0;
  for (const m of exp.members) {
    const max = heroStats(state, m).vigor;
    const need = REST_THRESHOLD * max - state.heroes[m].hp;
    if (need > 1e-9) t = Math.max(t, Math.ceil(need / (max * rate)));
  }
  return t;
}

export function timeToNextEvent(state: GameState): number {
  let t = Infinity;
  const exp = state.expedition;
  if (exp) {
    if (exp.phase === 'travel' && exp.leg < exp.legs.length) t = Math.min(t, legEnd(exp, exp.leg) - exp.elapsed);
    else if (exp.phase === 'return') t = Math.min(t, exp.returnMs - exp.elapsed);
    else if (exp.phase === 'rest') t = Math.min(t, restRemaining(state, exp));
  }
  for (const o of state.orders) {
    if (o && o.status === 'running') t = Math.min(t, o.cycleMs - o.elapsed);
  }
  return Math.max(0, t);
}

function progress(state: GameState, ms: number): void {
  const exp = state.expedition;
  if (exp && (exp.phase === 'travel' || exp.phase === 'return')) exp.elapsed += ms;
  for (const o of state.orders) if (o && o.status === 'running') o.elapsed += ms;
  const rate = healRatePerMs(state);
  for (const id of Object.keys(state.heroes)) {
    const h = state.heroes[id];
    if (!h.recruited || heroTravelling(state, id)) continue;
    const max = heroStats(state, id).vigor;
    if (h.hp >= max) {
      h.hp = max;
      continue;
    }
    h.hp = Math.min(max, h.hp + max * rate * ms);
  }
}

function concludeExpedition(state: GameState, ctx: SimContext, exp: ExpeditionState): void {
  finishExpedition(state, ctx, exp);
  const continuing = exp.outcome === 'success' && !exp.recalled && exp.repeatLeft !== 0;
  if (continuing) {
    exp.phase = 'rest';
    exp.elapsed = 0;
    state.expedition = exp;
  } else {
    if (exp.repeatLeft !== 0 && exp.outcome !== 'success') {
      const reason = exp.recalled ? 'You recalled the party.' : 'The party did not complete the route.';
      ctx.events.push({ type: 'repeat-halted', reason });
      pushFeed(state, ctx, 'warn', `Standing orders ended. ${reason}`);
    }
    state.expedition = null;
  }
}

function departAgain(state: GameState, ctx: SimContext, exp: ExpeditionState): void {
  const plan = exp.plan;
  state.expedition = null;
  const check = checkPlan(state, plan);
  if (!check.ok) {
    const reason = check.errors[0];
    ctx.events.push({ type: 'repeat-halted', reason });
    pushFeed(state, ctx, 'warn', `Standing orders halted: ${reason}`);
    return;
  }
  const left = exp.repeatLeft > 0 ? exp.repeatLeft - 1 : -1;
  dispatchExpedition(state, ctx, plan, exp.run + 1, left);
}

function processDue(state: GameState, ctx: SimContext): void {
  for (let guard = 0; guard < 64; guard++) {
    let acted = false;
    const exp = state.expedition;
    if (exp) {
      if (exp.phase === 'travel') {
        while (exp.phase === 'travel' && exp.leg < exp.legs.length && exp.elapsed >= legEnd(exp, exp.leg)) {
          resolveLeg(state, exp);
          acted = true;
          if (exp.outcome === 'success') {
            concludeExpedition(state, ctx, exp);
            break;
          }
          if (exp.outcome) {
            exp.phase = 'return';
            exp.returnMs = returnDuration(exp);
            exp.elapsed = 0;
          }
        }
      } else if (exp.phase === 'return' && exp.elapsed >= exp.returnMs) {
        exp.log.push({ leg: exp.leg, kind: 'return', text: 'The party limps back into Lanternhold.' });
        concludeExpedition(state, ctx, exp);
        acted = true;
      } else if (exp.phase === 'rest' && restRemaining(state, exp) <= 0) {
        departAgain(state, ctx, exp);
        acted = true;
      }
    }
    for (let i = 0; i < state.orders.length; i++) {
      const o = state.orders[i];
      if (!o) continue;
      if (o.status === 'running' && o.elapsed >= o.cycleMs) {
        completeCycle(state, ctx, i);
        acted = true;
      }
    }
    // Blocked orders may be able to resume now that stores changed.
    for (const o of state.orders) {
      if (o && o.status === 'blocked') {
        if (tryStartCycle(state, ctx, o)) acted = true;
      }
    }
    if (!acted) break;
  }
}

/** Advance the simulation by `ms` milliseconds starting at ctx.time. */
export function advance(state: GameState, ms: number, ctx: SimContext): void {
  let remaining = Math.max(0, Math.floor(ms));
  processDue(state, ctx);
  let guard = 0;
  while (remaining > 0 && guard++ < 5_000_000) {
    const next = timeToNextEvent(state);
    const step = Math.min(remaining, Math.max(1, Math.ceil(next)));
    progress(state, step);
    remaining -= step;
    ctx.time += step;
    processDue(state, ctx);
  }
  refreshContracts(state, ctx);
  if (refreshTutorial(state)) ctx.events.push({ type: 'tutorial', step: state.tutorial.step });
}

export interface SettleResult {
  from: number;
  to: number;
  elapsed: number;
  cappedMs: number;
  clockBack: boolean;
  events: SimEvent[];
}

/**
 * Bring the game up to `now`. Used both by the live loop (small steps) and on
 * load (offline catch-up). Elapsed time is clamped: a clock that moved
 * backwards adds nothing (and loses nothing), and long absences are capped.
 */
export function settle(state: GameState, now: number): SettleResult {
  const from = state.lastTick;
  let delta = now - from;
  let clockBack = false;
  let cappedMs = 0;
  if (!Number.isFinite(delta)) delta = 0;
  if (delta < 0) {
    clockBack = true;
    delta = 0;
  }
  const cap = offlineCapMs(state);
  if (delta > cap) {
    cappedMs = delta - cap;
    delta = cap;
  }
  const ctx = makeContext(now - delta);
  advance(state, delta, ctx);
  state.lastTick = now;
  return { from, to: now, elapsed: delta, cappedMs, clockBack, events: ctx.events };
}

export function heroName(id: string): string {
  return HEROES[id]?.name ?? id;
}
