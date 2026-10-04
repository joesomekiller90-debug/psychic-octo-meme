import { describe, expect, it } from 'vitest';
import { advance, settle } from '../src/game/sim/advance';
import { cancelOrder, dispatch, recall, startBuild, startOrder, updatePlan } from '../src/game/sim/actions';
import { makeContext } from '../src/game/sim/core';
import { runCombat } from '../src/game/sim/combat';
import { heroStats, offlineCapMs, stackCap } from '../src/game/sim/rules';
import type { GameState } from '../src/game/sim/state';
import { claimContract } from '../src/game/sim/contracts';
import { freshState, stageState, T0 } from './helpers';

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Compare everything except continuous healing, which accumulates floats. */
function comparable(s: GameState) {
  const c = clone(s) as GameState;
  for (const h of Object.values(c.heroes)) h.hp = Math.round(h.hp * 1000) / 1000;
  c.lastTick = 0;
  return c;
}

function busyState(): GameState {
  const s = freshState(77);
  const ctx = makeContext(T0);
  expect(dispatch(s, ctx).ok).toBe(true);
  expect(startOrder(s, ctx, 'gather_fenberries', 1, null).ok).toBe(true);
  expect(startOrder(s, ctx, 'brew_rations', 1, 20).ok).toBe(true);
  return s;
}

describe('time and determinism', () => {
  it('advancing in one step equals advancing in many small steps', () => {
    const a = busyState();
    const b = clone(a);
    settle(a, T0 + 30 * 60_000);
    let t = T0;
    while (t < T0 + 30 * 60_000) {
      t = Math.min(T0 + 30 * 60_000, t + 250 + ((t / 7) % 900));
      settle(b, Math.floor(t));
    }
    expect(comparable(b)).toEqual(comparable(a));
    expect(a.reports.length).toBeGreaterThan(0);
    expect(a.inventory.trail_ration).toBeGreaterThan(5);
  });

  it('re-simulating from the same save gives identical rewards (no duplication on refresh)', () => {
    const base = busyState();
    const saved = JSON.stringify(base);
    const first = JSON.parse(saved) as GameState;
    const second = JSON.parse(saved) as GameState;
    settle(first, T0 + 5 * 60_000);
    settle(second, T0 + 5 * 60_000);
    expect(comparable(first)).toEqual(comparable(second));
    // Settling again at the same moment adds nothing.
    const again = clone(first);
    settle(again, T0 + 5 * 60_000);
    expect(again.inventory).toEqual(first.inventory);
    expect(again.marks).toBe(first.marks);
  });

  it('a clock that moves backwards gains and loses nothing', () => {
    const s = busyState();
    settle(s, T0 + 10_000);
    const snap = clone(s);
    const res = settle(s, T0 - 3600_000);
    expect(res.clockBack).toBe(true);
    expect(res.elapsed).toBe(0);
    expect(s.inventory).toEqual(snap.inventory);
    expect(s.orders).toEqual(snap.orders);
    // Time continues normally from the new clock.
    settle(s, T0 - 3600_000 + 20_000);
    expect((s.orders[0]?.done ?? 0) > (snap.orders[0]?.done ?? 0)).toBe(true);
  });

  it('caps offline time at the offline limit', () => {
    const s = busyState();
    const cap = offlineCapMs(s);
    const res = settle(s, T0 + cap + 5 * 3600_000);
    expect(res.elapsed).toBe(cap);
    expect(res.cappedMs).toBe(5 * 3600_000);
  });
});

describe('work orders', () => {
  it('pauses at the stack cap and resumes when space frees up', () => {
    const s = freshState(5);
    const ctx = makeContext(T0);
    s.inventory.fenberry = stackCap(s) - 2;
    startOrder(s, ctx, 'gather_fenberries', 1, null);
    settle(s, T0 + 60_000);
    expect(s.inventory.fenberry).toBe(stackCap(s));
    expect(s.orders[0]?.status).toBe('blocked');
    s.inventory.fenberry = 10;
    settle(s, T0 + 61_000);
    expect(s.orders[0]?.status).toBe('running');
  });

  it('a crafting order waits for materials produced by the other slot', () => {
    const s = freshState(6);
    const ctx = makeContext(T0);
    s.inventory = {};
    startOrder(s, ctx, 'forge_brackets', 1, 3);
    expect(s.orders[0]?.status).toBe('blocked');
    startOrder(s, ctx, 'mine_rustrock', 1, null);
    settle(s, T0 + 120_000);
    expect(s.inventory.iron_brackets).toBe(3);
    expect(s.orders[0]).toBeNull();
  });

  it('cancelling refunds the materials of the unfinished cycle', () => {
    const s = freshState(7);
    const ctx = makeContext(T0);
    const before = s.inventory.fenberry;
    startOrder(s, ctx, 'brew_rations', 1, 5);
    expect(s.inventory.fenberry).toBe(before - 3);
    cancelOrder(s, ctx, 0);
    expect(s.inventory.fenberry).toBe(before);
  });

  it('hands are shared between porters and work orders', () => {
    const s = freshState(8);
    const ctx = makeContext(T0);
    updatePlan(s, { porters: 3 });
    expect(dispatch(s, ctx).ok).toBe(true);
    const r = startOrder(s, ctx, 'gather_wildroot', 1, null);
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/hands/i);
  });

  it('construction completes and raises capacity', () => {
    const s = freshState(9);
    const ctx = makeContext(T0);
    s.marks = 500;
    s.inventory.braced_beam = 5;
    s.inventory.reedfiber = 10;
    expect(startBuild(s, ctx, 'bunkhouse', 1).ok).toBe(true);
    settle(s, T0 + 60_000);
    expect(s.upgrades.bunkhouse).toBe(1);
  });
});

describe('expeditions', () => {
  it('the first expedition completes, reports, and unlocks the ferry road', () => {
    const s = freshState(10);
    const ctx = makeContext(T0);
    expect(dispatch(s, ctx).ok).toBe(true);
    settle(s, T0 + 5 * 60_000);
    expect(s.expedition).toBeNull();
    expect(s.reports[0].outcome).toBe('success');
    expect(s.flags.waymark_ferry).toBe(true);
    expect(s.reports[0].log.some((l) => l.kind === 'discovery')).toBe(true);
  });

  it('standing orders repeat runs and stop when supplies run out', () => {
    const s = freshState(11);
    const ctx = makeContext(T0);
    s.inventory.trail_ration = 9;
    updatePlan(s, { repeat: -1, supplies: { trail_ration: 3 } });
    expect(dispatch(s, ctx).ok).toBe(true);
    settle(s, T0 + 60 * 60_000);
    expect(s.expedition).toBeNull();
    expect(s.stats.routeRuns.wildroot_trail).toBe(3);
    expect(s.feed.some((f) => /Standing orders halted/.test(f.text))).toBe(true);
  });

  it('recall turns the party around and keeps what they carry', () => {
    const s = freshState(12);
    const ctx = makeContext(T0);
    dispatch(s, ctx);
    settle(s, T0 + 20_000);
    const r = recall(s, makeContext(T0 + 20_000));
    expect(r.ok).toBe(true);
    settle(s, T0 + 5 * 60_000);
    expect(s.reports[0].outcome).toBe('retreat');
    expect(s.reports[0].recalled).toBe(true);
    expect(s.flags.waymark_ferry).toBeUndefined();
  });

  it('heroes heal in camp after returning', () => {
    const s = freshState(13);
    s.heroes.wren.hp = 5;
    settle(s, T0 + 10 * 60_000);
    expect(s.heroes.wren.hp).toBeCloseTo(heroStats(s, 'wren').vigor);
  });
});

describe('combat', () => {
  const party = (s: GameState) =>
    ['brannoc', 'wren', 'tamsin'].map((id) => ({ id, hp: heroStats(s, id).vigor, stats: heroStats(s, id), row: s.party.rows[id] }));

  it('light prevents ambushes', () => {
    const s = stageState({ level: 3, gear: {} });
    const dark = runCombat({ heroes: party(s), enemies: ['mire_lurker'], tactics: s.tactics, supplies: {}, used: {}, light: false, forcedAmbush: false, finale: false, seed: 3, title: '' });
    const lit = runCombat({ heroes: party(s), enemies: ['mire_lurker'], tactics: s.tactics, supplies: {}, used: {}, light: true, forcedAmbush: false, finale: false, seed: 3, title: '' });
    expect(dark.record.lines.some((l) => l.t.includes('from ambush'))).toBe(true);
    expect(lit.record.lines.some((l) => l.t.includes('from ambush'))).toBe(false);
  });

  it('antidotes stop poison', () => {
    const s = stageState({ level: 3, gear: {} });
    const used: Record<string, number> = {};
    const out = runCombat({ heroes: party(s), enemies: ['bramble_wisp', 'bramble_wisp'], tactics: s.tactics, supplies: { antidote: 5 }, used, light: true, forcedAmbush: false, finale: false, seed: 4, title: '' });
    expect(used.antidote ?? 0).toBeGreaterThan(0);
    expect(out.record.lines.some((l) => l.t.includes('poisons'))).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const s = stageState({ level: 4, gear: {} });
    const o = () => runCombat({ heroes: party(s), enemies: ['hollow_matriarch'], tactics: s.tactics, supplies: { mending_tonic: 3 }, used: {}, light: false, forcedAmbush: false, finale: true, seed: 42, title: '' });
    expect(o()).toEqual(o());
  });
});

describe('contracts', () => {
  it('route contracts complete and pay out once', () => {
    const s = freshState(14);
    const ctx = makeContext(T0);
    dispatch(s, ctx);
    settle(s, T0 + 5 * 60_000);
    const marks = s.marks;
    const r = claimContract(s, makeContext(T0), 'first_light');
    expect(r.ok).toBe(true);
    expect(s.marks).toBe(marks + 40);
    expect(claimContract(s, makeContext(T0), 'first_light').ok).toBe(false);
  });

  it('deliver contracts consume the items', () => {
    const s = freshState(15);
    s.stats.routeClears.wildroot_trail = 1;
    s.inventory.fenberry = 20;
    advance(s, 0, makeContext(T0));
    expect(claimContract(s, makeContext(T0), 'stock_larder').ok).toBe(true);
    expect(s.inventory.fenberry).toBe(8);
  });
});
