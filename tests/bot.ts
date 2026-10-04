// A simple scripted player that uses only the public player actions, following
// ordinary priorities. Used to check that the whole game can be completed.
import { ACTION_LIST, ACTIONS } from '../src/game/data/actions';
import { DOCTRINES, RANKS, UPGRADE_LIST } from '../src/game/data/camp';
import { HEROES } from '../src/game/data/heroes';
import { ITEMS } from '../src/game/data/items';
import { ROUTE_LIST } from '../src/game/data/world';
import { settle } from '../src/game/sim/advance';
import { autoPack, dispatch, equip, pledgeDoctrine, startBuild, startOrder, toggleMember, setRow, updatePlan, setTactics } from '../src/game/sim/actions';
import { claimContract, readyContracts } from '../src/game/sim/contracts';
import { count, hasItems, makeContext } from '../src/game/sim/core';
import { forecastExpedition } from '../src/game/sim/forecast';
import { actionAvailability, freeHands, heroPower, heroStats, levelOf, rankOf, routeUnlocked, unmetReqs, upgradeLevel } from '../src/game/sim/rules';
import type { GameState } from '../src/game/sim/state';
import type { EquipSlot } from '../src/game/types';
import { T0 } from './helpers';

const HOUR = 3600_000;

function equipBest(s: GameState) {
  for (const id of Object.keys(s.heroes)) {
    const h = s.heroes[id];
    if (!h.recruited || s.expedition?.members.includes(id)) continue;
    for (const slot of ['weapon', 'armor', 'trinket'] as EquipSlot[]) {
      let best = heroPower(heroStats(s, id)) + (slot === 'trinket' && h.gear.trinket && ITEMS[h.gear.trinket].equip?.light ? 6 : 0);
      let pick: string | null = null;
      for (const item of Object.keys(s.inventory)) {
        if (ITEMS[item]?.equip?.slot !== slot || !s.inventory[item]) continue;
        const st = heroStats(s, id, { ...h.gear, [slot]: item });
        const bonus = (st.light && !s.party.members.some((m) => m !== id && heroStats(s, m).light) ? 6 : 0) + (st.ranged && HEROES[id].role === 'striker' ? 4 : 0) + st.carry * 0.3;
        const score = heroPower(st) + bonus;
        if (score > best + 0.5) {
          best = score;
          pick = item;
        }
      }
      if (pick) equip(s, id, slot, pick);
    }
  }
}

function want(s: GameState): [string, number][] {
  const w: [string, number][] = [
    ['trail_ration', 16],
    ['mending_tonic', 6],
  ];
  if (s.recipes.includes('brew_antidote')) w.push(['antidote', 4]);
  if (s.flags.fenwick) w.push(['fire_flask', 2]);
  if (s.flags.matriarch_slain) w.push(['climbing_kit', 2], ['greater_tonic', 4]);
  if (s.flags.kilnmouth) w.push(['steadying_draught', 3], ['warding_salve', 1]);
  // gear: one of each best craftable item per party member
  for (const a of ACTION_LIST) {
    if (a.kind !== 'craft' || !actionAvailability(s, a).ok) continue;
    const out = ITEMS[a.outputs[0].item];
    if (!out.equip) continue;
    const owned = count(s, out.id) + Object.values(s.heroes).filter((h) => Object.values(h.gear).includes(out.id)).length;
    if (owned < 1) w.push([out.id, 1]);
  }
  // camp upgrades
  for (const u of UPGRADE_LIST) {
    const next = u.levels[upgradeLevel(s, u.id)];
    if (!next || unmetReqs(s, next.requires).length) continue;
    for (const q of next.items) w.push([q.item, q.qty]);
    break;
  }
  return w;
}

function producerFor(s: GameState, item: string) {
  return ACTION_LIST.find((a) => a.outputs.some((o) => o.item === item && (o.chance ?? 1) >= 0.5) && actionAvailability(s, a).ok);
}

/** Choose a work order: craft what is wanted, gathering missing inputs first. */
function pickWork(s: GameState, depth = 0, item?: string, qty?: number): { action: string; target: number | null } | null {
  if (depth > 3) return null;
  const list: [string, number][] = item ? [[item, qty ?? 1]] : want(s);
  for (const [it, n] of list) {
    if (count(s, it) >= n) continue;
    const a = producerFor(s, it);
    if (!a) continue;
    if (s.orders.some((o) => o?.actionId === a.id)) continue;
    if (!a.inputs || hasItems(s, a.inputs)) return { action: a.id, target: a.kind === 'craft' ? 1 : 10 };
    for (const q of a.inputs) {
      if (count(s, q.item) < q.qty) {
        const sub = pickWork(s, depth + 1, q.item, q.qty * 2);
        if (sub) return sub;
      }
    }
  }
  return null;
}

export function runBot(s: GameState, hours: number, log: string[], stopAt?: string) {
  let t = T0;
  const end = T0 + hours * HOUR;
  setTactics(s, { tonicAt: 0.5, retreatAt: 0.3, flasks: 'finale', focus: 'threats' });
  const milestones: Record<string, number> = {};
  while (t < end) {
    t += 30_000;
    settle(s, t);
    const ctx = makeContext(t);
    for (const c of readyContracts(s)) claimContract(s, ctx, c.id);
    for (const r of RANKS) {
      if (r.doctrineTier && rankOf(s.standing) >= r.rank && !s.doctrines.some((d) => DOCTRINES.find((x) => x.id === d)?.tier === r.doctrineTier)) {
        pledgeDoctrine(s, DOCTRINES.find((x) => x.tier === r.doctrineTier)!.id);
      }
    }
    for (const f of ['fenwick', 'matriarch_slain', 'kilnmouth', 'tollspire']) if (s.flags[f] && !milestones[f]) milestones[f] = t - T0;
    if (s.flags.tollspire || (stopAt && s.flags[stopAt])) break;
    if (!s.expedition) {
      // Party: Brannoc, Tamsin and the best damage dealer.
      const dps = s.heroes.ketch.recruited ? 'ketch' : 'wren';
      const party = ['brannoc', dps, 'tamsin'];
      for (const m of [...s.party.members]) if (!party.includes(m)) toggleMember(s, m);
      for (const m of party) if (!s.party.members.includes(m)) toggleMember(s, m);
      setRow(s, 'ketch', 'front');
      equipBest(s);
      const rested = s.party.members.every((m) => s.heroes[m].hp / heroStats(s, m).vigor > 0.8);
      if (rested) {
        const open = ROUTE_LIST.filter((r) => routeUnlocked(s, r.id));
        const fresh = open.filter((r) => !(s.stats.routeClears[r.id] ?? 0));
        const candidates = [...fresh.reverse(), ...open.slice().reverse()];
        for (const r of candidates) {
          updatePlan(s, { routeId: r.id, porters: Math.max(r.minPorters ?? 0, 1), risk: 'standard', repeat: 0 });
          autoPack(s);
          const f = forecastExpedition(s, s.plan, t, 12)!;
          if (f.success >= 0.75 || r.id === 'wildroot_trail') {
            const res = dispatch(s, ctx);
            if (res.ok) break;
          }
        }
      }
    }
    // Camp work
    for (let i = 0; i < 2; i++) {
      if (s.orders[i] || freeHands(s) < 1) continue;
      const up = UPGRADE_LIST.find((u) => {
        const next = u.levels[upgradeLevel(s, u.id)];
        return next && !unmetReqs(s, next.requires).length && s.marks >= next.marks && hasItems(s, next.items);
      });
      if (up && startBuild(s, ctx, up.id, 1, i).ok) continue;
      // Train scouting if it gates the next route.
      const gate = ROUTE_LIST.find((r) => !routeUnlocked(s, r.id) && r.requires.some((q) => q.type === 'skill' && q.skill === 'scouting' && levelOf(s, 'scouting') < q.level) && r.requires.every((q) => q.type === 'skill' || unmetReqs(s, [q]).length === 0));
      if (gate && !s.orders.some((o) => o && ACTIONS[o.actionId ?? '']?.skill === 'scouting')) {
        const sc = ['chart_ridgelines', 'walk_perimeter', 'study_waymarks'].find((id) => actionAvailability(s, ACTIONS[id]).ok);
        if (sc && startOrder(s, ctx, sc, 1, 20, i).ok) continue;
      }
      const w = pickWork(s);
      if (w) startOrder(s, ctx, w.action, 1, w.target, i);
      else {
        const filler = ['sift_scrapheap', 'mine_rustrock', 'gather_wildroot', 'gather_timber'].find((id) => actionAvailability(s, ACTIONS[id]).ok && !s.orders.some((o) => o?.actionId === id));
        if (filler) startOrder(s, ctx, filler, 1, 10, i);
      }
    }
  }
  for (const [k, v] of Object.entries(milestones)) log.push(`${k}: ${(v / HOUR).toFixed(1)}h`);
  log.push(`levels: ${Object.values(s.heroes).map((h) => `${h.id} ${h.level}`).join(', ')}`);
  log.push(`skills: ${Object.keys(s.skills).map((k) => `${k} ${levelOf(s, k as never)}`).join(', ')}`);
  log.push(`upgrades: ${JSON.stringify(s.upgrades)}; marks ${s.marks}; standing ${s.standing}`);
  log.push(`runs: ${JSON.stringify(s.stats.routeRuns)}`);
  return milestones;
}

