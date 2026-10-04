// Expedition planning, leg-by-leg resolution and return.
//
// An expedition is self-contained: all modifiers and party stats are captured
// at departure, and each leg is resolved from (seed, leg index) only. That
// keeps the journey deterministic and lets the forecast run the exact same
// code on throwaway copies.
import { ENEMIES } from '../data/enemies';
import { HEROES } from '../data/heroes';
import { ITEMS } from '../data/items';
import { DISCOVERIES, DISCOVERY_LIST, DRIFTS, HAZARDS, REGIONS, ROUTES } from '../data/world';
import { LORE } from '../data/camp';
import type { SkillId } from '../types';
import { runCombat } from './combat';
import { addItem, grantHeroXp, grantSkillXp, nextId, pushFeed, type SimContext } from './core';
import { hash32, randAt, Rng } from './rng';
import {
  RISKS,
  checkReq,
  discoveryMult,
  driftFor,
  expeditionDurationMult,
  findSkillFor,
  freeHands,
  hasDoctrine,
  heroStats,
  levelOf,
  marksMult,
  partyCarry,
  routeLockReasons,
  routeUnlocked,
  type HeroCombatStats,
} from './rules';
import type { ExpeditionMods, ExpeditionReport, ExpeditionState, GameState, LogEntry, PlanDraft } from './state';

export type ExpeditionRuntime = ExpeditionState;

const LEG_NAMES: Record<string, string[]> = {
  hollowmere: ['Fen margins', 'Birch hollows', 'Duckweed pools', 'The old boardwalk', 'Bramble rides', 'Drowned orchard', 'Reedbeds', 'Heron flats'],
  cinderscar: ['Slag terraces', 'Cold kilns', 'Ash ridge', 'Cinder pass', 'Smelter ruins', 'Scree slope', 'Ore-cart road', 'Chimney rocks'],
  causeway: ['Salt pilings', 'Broken arches', 'Tidal stair', "Lock-keeper's walk", 'Drowned plaza', 'Barnacle road', 'Fog bank', 'Sluice gallery'],
};

// ---------------------------------------------------------------------------
// Plan validation

export interface PlanCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  carry: number;
  load: number;
  rationsNeeded: number;
  members: string[];
}

export function supplyLoad(supplies: Record<string, number>): number {
  return Object.values(supplies).reduce((s, n) => s + Math.max(0, n), 0);
}

export function checkPlan(state: GameState, plan: PlanDraft, opts: { forRepeat?: boolean } = {}): PlanCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const route = ROUTES[plan.routeId];
  const members = state.party.members.filter((m) => state.heroes[m]?.recruited);
  const carry = route ? partyCarry(state, members, plan.porters) : 0;
  const load = supplyLoad(plan.supplies);
  const rationsNeeded = route ? route.legs : 0;
  if (!route) {
    errors.push('Choose a route.');
    return { ok: false, errors, warnings, carry, load, rationsNeeded, members };
  }
  if (!routeUnlocked(state, route.id)) errors.push(`Route locked: ${routeLockReasons(state, route.id).join('; ')}`);
  if (!opts.forRepeat && state.expedition) errors.push('An expedition is already under way.');
  if (members.length === 0) errors.push('Choose at least one wayfarer for the party.');
  const hands = opts.forRepeat ? freeHands(state) + (state.expedition?.porters ?? 0) : freeHands(state);
  if (plan.porters > hands) errors.push(`Not enough free hands for ${plan.porters} porter${plan.porters === 1 ? '' : 's'} (${hands} free).`);
  if ((route.minPorters ?? 0) > plan.porters) errors.push(`This route needs at least ${route.minPorters} porter to carry waystone kindling.`);
  for (const [id, n] of Object.entries(plan.supplies)) {
    if (n > 0 && (state.inventory[id] ?? 0) < n) errors.push(`Not enough ${ITEMS[id].name} (have ${state.inventory[id] ?? 0}, packing ${n}).`);
  }
  if (load > carry) errors.push(`Supplies weigh ${load} but the party can carry ${carry}.`);
  const rations = plan.supplies.trail_ration ?? 0;
  if (rations < rationsNeeded) warnings.push(`Only ${rations} of ${rationsNeeded} rations packed: the party will go hungry and lose health.`);
  if (carry - load < route.legs * 2) warnings.push('Little room left for loot: finds beyond capacity are left behind.');
  for (const m of members) {
    const st = heroStats(state, m);
    const hp = state.heroes[m].hp;
    if (hp / st.vigor < 0.5) warnings.push(`${HEROES[m].name} is at ${Math.round((hp / st.vigor) * 100)}% health.`);
  }
  if (members.length < 3 && members.length > 0) warnings.push(`Only ${members.length} wayfarer${members.length === 1 ? '' : 's'} in the party.`);
  return { ok: errors.length === 0, errors, warnings, carry, load, rationsNeeded, members };
}

// ---------------------------------------------------------------------------
// Departure

export function createExpedition(
  state: GameState,
  plan: PlanDraft,
  time: number,
  seed: number,
  run: number,
  repeatLeft: number,
): ExpeditionRuntime {
  const route = ROUTES[plan.routeId];
  const members = state.party.members.filter((m) => state.heroes[m]?.recruited);
  const drift = driftFor(route.region, time);
  const dur = expeditionDurationMult(state, members, plan.risk, drift);
  const legs: number[] = [];
  const legNames: string[] = [];
  const pool = [...(LEG_NAMES[route.region] ?? ['The road'])];
  const nameRng = new Rng(hash32(seed, 4242));
  for (let i = 0; i < route.legs; i++) {
    const jitter = 0.9 + 0.2 * randAt(seed, i, 1);
    legs.push(Math.max(1000, Math.round(route.legSeconds * 1000 * dur.mult * jitter)));
    if (i === route.legs - 1 && route.finale) legNames.push(route.finale.name);
    else if (i === route.legs - 1) legNames.push('Homeward');
    else {
      const idx = Math.floor(nameRng.next() * pool.length);
      legNames.push(pool.splice(idx, 1)[0] ?? 'The road');
      if (pool.length === 0) pool.push(...(LEG_NAMES[route.region] ?? ['The road']));
    }
  }
  const stats: Record<string, HeroCombatStats> = {};
  const hp: Record<string, number> = {};
  const rows: Record<string, 'front' | 'back'> = {};
  for (const m of members) {
    stats[m] = heroStats(state, m);
    hp[m] = Math.max(1, Math.min(stats[m].vigor, state.heroes[m].hp));
    rows[m] = state.party.rows[m] ?? HEROES[m].defaultRow;
  }
  const supplies: Record<string, number> = {};
  for (const [id, n] of Object.entries(plan.supplies)) if (n > 0) supplies[id] = n;
  const used: Record<string, number> = {};
  let ward = 0;
  if ((supplies.warding_salve ?? 0) > 0) {
    supplies.warding_salve -= 1;
    used.warding_salve = 1;
    ward = ITEMS.warding_salve.supply?.power ?? 25;
  }
  const findBase = (skill: SkillId) => 1 + 0.02 * (levelOf(state, skill) - 1);
  const wild = hasDoctrine(state, 'wildwise') ? 1.25 : 1;
  const mods: ExpeditionMods = {
    discovery: discoveryMult(state, members, plan.risk, drift),
    finds: {
      foraging: findBase('foraging') * wild,
      mining: findBase('mining') * wild,
      salvaging: findBase('salvaging') * wild,
      scouting: 1 * wild,
      smithing: 1,
      alchemy: 1,
      engineering: 1,
      none: 1 * wild,
    },
    trophy: 1 + 0.01 * (levelOf(state, 'salvaging') - 1),
    marks: marksMult(state) * RISKS[plan.risk].marks * (DRIFTS[drift]?.marks ?? 1),
  };
  const exp: ExpeditionRuntime = {
    id: nextIdPeek(state),
    routeId: route.id,
    seed,
    run,
    phase: 'travel',
    elapsed: 0,
    legs,
    legNames,
    leg: 0,
    returnMs: 0,
    members,
    rows,
    hp,
    supplies,
    plan: { ...plan, supplies: { ...plan.supplies } },
    porters: plan.porters,
    risk: plan.risk,
    tactics: { ...state.tactics },
    drift,
    carry: partyCarry(state, members, plan.porters),
    ward,
    pack: {},
    leftBehind: {},
    marks: 0,
    heroXp: 0,
    skillXp: {},
    kills: {},
    seen: [],
    discoveries: [],
    used,
    log: [],
    outcome: null,
    repeatLeft,
    startedAt: time,
    stats,
    mods,
  };
  const driftDef = DRIFTS[drift];
  exp.log.push({
    leg: 0,
    kind: 'travel',
    text: `Departed Lanternhold for ${route.name}. ${REGIONS[route.region].name} is ${driftDef.name.toLowerCase()}${driftDef.id === 'clear' ? '' : ` — ${driftDef.desc.split('.')[0].toLowerCase()}`}.${ward ? ' Warding salve applied (+25 Ward).' : ''}`,
  });
  return exp;
}

function nextIdPeek(state: GameState): number {
  return state.nextId;
}

/** Remove supplies from stores and put a new expedition on the road. */
export function dispatchExpedition(state: GameState, ctx: SimContext, plan: PlanDraft, run = 1, repeatLeft?: number): ExpeditionRuntime {
  for (const [id, n] of Object.entries(plan.supplies)) {
    if (n <= 0) continue;
    const left = (state.inventory[id] ?? 0) - n;
    if (left > 0) state.inventory[id] = left;
    else delete state.inventory[id];
  }
  const seed = hash32(state.worldSeed, state.nextId, 0x5eed);
  const exp = createExpedition(state, plan, ctx.time, seed, run, repeatLeft ?? plan.repeat);
  exp.id = nextId(state);
  state.expedition = exp;
  state.stats.routeRuns[plan.routeId] = (state.stats.routeRuns[plan.routeId] ?? 0) + 1;
  ctx.events.push({ type: 'expedition-depart', routeId: plan.routeId, run });
  return exp;
}

// ---------------------------------------------------------------------------
// Leg resolution

function packLoad(exp: ExpeditionState): number {
  return supplyLoad(exp.supplies) + supplyLoad(exp.pack);
}

function addToPack(exp: ExpeditionState, item: string, qty: number): number {
  const space = Math.max(0, exp.carry - packLoad(exp));
  const stored = Math.min(space, qty);
  if (stored > 0) exp.pack[item] = (exp.pack[item] ?? 0) + stored;
  if (qty > stored) exp.leftBehind[item] = (exp.leftBehind[item] ?? 0) + (qty - stored);
  return stored;
}

function partyFrac(exp: ExpeditionRuntime): number {
  let hp = 0;
  let max = 0;
  for (const m of exp.members) {
    hp += exp.hp[m];
    max += exp.stats[m].vigor;
  }
  return max > 0 ? hp / max : 0;
}

/** "Kiln Hound ×3, Slagback Crawler" */
export function groupNames(ids: string[]): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => `${ENEMIES[id].name}${n > 1 ? ` \u00d7${n}` : ''}`).join(', ');
}

function xpPerUnit(item: string): number {
  const t = ITEMS[item]?.tier ?? 1;
  return t === 1 ? 2 : t === 2 ? 4 : 7;
}

function listItems(items: Record<string, number>): string {
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${n} ${ITEMS[id]?.name ?? id}`)
    .join(', ');
}

/**
 * Resolve the next leg of a travelling expedition. Reads `state` only for
 * once-only discovery bookkeeping and skill-free data; all results land on
 * the expedition object.
 */
export function resolveLeg(state: GameState, exp: ExpeditionRuntime): void {
  const route = ROUTES[exp.routeId];
  const i = exp.leg;
  const isFinal = i === route.legs - 1;
  const rng = new Rng(hash32(exp.seed, i, 77));
  const risk = RISKS[exp.risk];
  const drift = DRIFTS[exp.drift];
  const legNo = i + 1;
  const light = exp.members.some((m) => exp.stats[m].light);
  const entries: LogEntry[] = [];
  const add = (kind: LogEntry['kind'], text: string, extra: Partial<LogEntry> = {}) =>
    entries.push({ leg: legNo, kind, text, ...extra });

  add('travel', `Leg ${legNo} of ${route.legs} · ${exp.legNames[i]}`);

  // 1. Rations
  if ((exp.supplies.trail_ration ?? 0) > 0) {
    exp.supplies.trail_ration -= 1;
    exp.used.trail_ration = (exp.used.trail_ration ?? 0) + 1;
    for (const m of exp.members) {
      const max = exp.stats[m].vigor;
      exp.hp[m] = Math.min(max, exp.hp[m] + Math.round(max * 0.05));
    }
  } else {
    const lost: string[] = [];
    for (const m of exp.members) {
      const max = exp.stats[m].vigor;
      const d = Math.round(max * 0.06);
      exp.hp[m] = Math.max(1, exp.hp[m] - d);
      lost.push(`${HEROES[m].name.split(' ')[0]} ${d}`);
    }
    add('hunger', `No rations left. The party marches hungry (${lost.join(', ')} health lost).`);
  }

  // 2. Hazard
  const hazardP = route.hazardChance * risk.hazard * (drift.hazard ?? 1);
  if (route.hazards.length && rng.chance(hazardP)) {
    const hz = HAZARDS[rng.pick(route.hazards)];
    let countered = false;
    if (hz.counter === 'light' && light) countered = true;
    else if (hz.counter === 'rope' && (exp.supplies.climbing_kit ?? 0) > 0) {
      exp.supplies.climbing_kit -= 1;
      exp.used.climbing_kit = (exp.used.climbing_kit ?? 0) + 1;
      countered = true;
    } else if (hz.counter === 'antidote' && (exp.supplies.antidote ?? 0) > 0) {
      exp.supplies.antidote -= 1;
      exp.used.antidote = (exp.used.antidote ?? 0) + 1;
      countered = true;
    }
    if (countered) {
      add('safe', `${hz.name}: ${hz.counteredText}`);
    } else {
      const parts: string[] = [];
      for (const m of exp.members) {
        const st = exp.stats[m];
        const ward = Math.min(75, st.ward + exp.ward);
        const d = Math.max(1, Math.round(st.vigor * hz.damage * (1 - ward / 100)));
        exp.hp[m] = Math.max(1, exp.hp[m] - d);
        parts.push(`${HEROES[m].name.split(' ')[0]} ${d}`);
      }
      const hint = hz.counter === 'rope' ? ' (a Climbing Kit would have prevented this)' : hz.counter === 'antidote' ? ' (an Antidote would have prevented this)' : hz.counter === 'light' ? ' (Light would have prevented this)' : '';
      add('hazard', `${hz.name}: ${hz.text} Damage: ${parts.join(', ')}.${hint}`);
    }
  }

  // 3. Encounter
  let enemies: string[] | null = null;
  let title = '';
  let finale = false;
  if (isFinal && route.finale) {
    enemies = route.finale.enemies;
    title = route.finale.name;
    finale = true;
    add('travel', route.finale.text);
  } else {
    const p = Math.min(0.95, route.encounterChance * risk.encounter * (1 + (drift.encounter ?? 0)));
    if (route.encounters.length && rng.chance(p)) {
      enemies = rng.weighted(route.encounters).enemies;
      title = groupNames(enemies);
    }
  }
  if (enemies) {
    for (const e of enemies) if (!exp.seen.includes(e)) exp.seen.push(e);
    const out = runCombat({
      heroes: exp.members.map((m) => ({ id: m, hp: exp.hp[m], stats: exp.stats[m], row: exp.rows[m] })),
      enemies,
      tactics: exp.tactics,
      supplies: exp.supplies,
      used: exp.used,
      light,
      forcedAmbush: !!drift.ambush,
      finale,
      seed: hash32(exp.seed, i, 99),
      title,
    });
    for (const m of exp.members) exp.hp[m] = Math.min(exp.stats[m].vigor, out.hp[m] ?? exp.hp[m]);
    const lootGot: Record<string, number> = {};
    for (const [eid, n] of Object.entries(out.kills)) {
      exp.kills[eid] = (exp.kills[eid] ?? 0) + n;
      if (!exp.seen.includes(eid)) exp.seen.push(eid);
      const def = ENEMIES[eid];
      exp.marks += def.marks * n;
      exp.heroXp += def.xp * n;
      for (let k = 0; k < n; k++) {
        for (const l of def.loot) {
          if (rng.chance(Math.min(1, l.chance * exp.mods.trophy))) {
            const q = rng.int(l.min, l.max);
            const s = addToPack(exp, l.item, q);
            if (s > 0) lootGot[l.item] = (lootGot[l.item] ?? 0) + s;
          }
        }
      }
    }
    const lootText = Object.keys(lootGot).length ? ` Spoils: ${listItems(lootGot)}.` : '';
    add('fight', `${finale ? 'Objective fight' : 'Encounter'}: ${title}. ${out.record.summary}.${lootText}`, { fight: out.record });
    if (out.result === 'defeat') {
      exp.outcome = 'defeat';
      add('defeat', 'The party is overwhelmed. They drag each other clear and limp for home, dropping half of what they carried.');
    } else if (out.result === 'fled') {
      exp.outcome = 'retreat';
      add('retreat', 'The party breaks off and heads for home with what they carry.');
    }
  }

  if (!exp.outcome) {
    // 4. Finds
    const found: Record<string, number> = {};
    const left: Record<string, number> = {};
    for (let r = 0; r < route.findsPerLeg; r++) {
      if (!rng.chance(route.findChance)) continue;
      const f = rng.weighted(route.finds);
      const skill = findSkillFor(f.item);
      let mult = exp.mods.finds[skill ?? 'none'] * risk.finds * (drift.finds ?? 1);
      const cat = ITEMS[f.item]?.category;
      if ((cat === 'herb' || cat === 'food') && drift.herbs) mult *= drift.herbs;
      const qty = Math.max(1, rng.roundStochastic(rng.int(f.min, f.max) * mult));
      const s = addToPack(exp, f.item, qty);
      if (s > 0) found[f.item] = (found[f.item] ?? 0) + s;
      if (qty > s) left[f.item] = (left[f.item] ?? 0) + (qty - s);
      if (skill) exp.skillXp[skill] = (exp.skillXp[skill] ?? 0) + qty * xpPerUnit(f.item);
    }
    if (Object.keys(found).length) add('find', `Found ${listItems(found)}.`);
    if (Object.keys(left).length) add('full', `Packs are full: left behind ${listItems(left)}. (More porters or a Porter's Frame would help.)`);

    // 5. Discoveries
    for (const d of DISCOVERY_LIST) {
      if (d.route !== route.id) continue;
      if (d.once && (state.codex.discoveries[d.id] || exp.discoveries.includes(d.id))) continue;
      if (d.requires && !d.requires.every((q) => checkReq(state, q))) continue;
      if (d.finalLeg && !isFinal) continue;
      if (!d.finalLeg && legNo < (d.minLeg ?? 1)) continue;
      const p = d.finalLeg ? d.chance : Math.min(0.95, d.chance * exp.mods.discovery);
      if (!rng.chance(p)) continue;
      exp.discoveries.push(d.id);
      add('discovery', `Discovery — ${d.name}: ${d.text}`);
    }

    // 6. Experience for the leg
    exp.heroXp += route.heroXp;
    exp.skillXp.scouting = (exp.skillXp.scouting ?? 0) + route.scoutXp;

    // 7. Retreat check / objective
    if (isFinal) {
      exp.outcome = 'success';
      add('objective', route.kind === 'relight' ? 'The waystone is reached and the party turns for home.' : 'The route is complete and the party turns for home.');
    } else if (partyFrac(exp) < exp.tactics.retreatAt) {
      exp.outcome = 'retreat';
      add('retreat', `Party health is below ${Math.round(exp.tactics.retreatAt * 100)}%. Following your orders, they turn back.`);
    }
  }

  exp.log.push(...entries);
  exp.leg += 1;
}

export function returnDuration(exp: ExpeditionState): number {
  const spent = exp.legs.slice(0, exp.leg).reduce((s, n) => s + n, 0);
  const avg = exp.legs.reduce((s, n) => s + n, 0) / exp.legs.length;
  return Math.max(3000, Math.round(Math.min(spent * 0.5, avg * 2)));
}

/** Time from departure to the end of leg `n` (exclusive count). */
export function legEnd(exp: ExpeditionState, n: number): number {
  let t = 0;
  for (let i = 0; i <= n && i < exp.legs.length; i++) t += exp.legs[i];
  return t;
}

export function totalDuration(exp: ExpeditionState): number {
  return exp.legs.reduce((s, n) => s + n, 0);
}

// ---------------------------------------------------------------------------
// Return and rewards

export function finishExpedition(state: GameState, ctx: SimContext, exp: ExpeditionRuntime): ExpeditionReport {
  const route = ROUTES[exp.routeId];
  const outcome = exp.outcome ?? 'retreat';
  // Health
  for (const m of exp.members) {
    const max = exp.stats[m].vigor;
    state.heroes[m].hp = Math.max(1, Math.min(max, exp.hp[m]));
  }
  // Defeat costs half the pack.
  const lost: Record<string, number> = {};
  if (outcome === 'defeat') {
    for (const [id, n] of Object.entries(exp.pack)) {
      const l = Math.ceil(n / 2);
      if (l > 0) {
        lost[id] = l;
        exp.pack[id] = n - l;
      }
    }
  }
  // Deposit loot and unused supplies.
  const marksBefore = state.marks;
  const loot: Record<string, number> = {};
  for (const [id, n] of Object.entries(exp.pack)) {
    if (n <= 0) continue;
    addItem(state, ctx, id, n);
    loot[id] = n;
  }
  for (const [id, n] of Object.entries(exp.supplies)) if (n > 0) addItem(state, ctx, id, n);
  const sold = state.marks - marksBefore;
  // Marks
  let marks = exp.marks;
  if (outcome === 'success') {
    const r = new Rng(hash32(exp.seed, 31337));
    marks += r.int(route.marks[0], route.marks[1]);
  }
  marks = Math.round(marks * exp.mods.marks * (outcome === 'success' ? 1 : 0.5));
  state.marks += marks;
  state.stats.marksEarned += marks;
  if (Object.keys(loot).length || marks) ctx.events.push({ type: 'items', items: loot, source: route.name });
  // Experience
  const levelUps: string[] = [];
  const heroXp = outcome === 'success' ? exp.heroXp : Math.round(exp.heroXp * 0.75);
  for (const m of exp.members) {
    const lv = grantHeroXp(state, ctx, m, heroXp);
    if (lv.length) levelUps.push(`${HEROES[m].name} reached level ${lv[lv.length - 1]}`);
  }
  const skillXp: Partial<Record<SkillId, number>> = {};
  for (const [s, xp] of Object.entries(exp.skillXp) as [SkillId, number][]) {
    if (!xp) continue;
    const before = levelOf(state, s);
    skillXp[s] = grantSkillXp(state, ctx, s, xp);
    const after = levelOf(state, s);
    if (after > before) levelUps.push(`${s[0].toUpperCase()}${s.slice(1)} reached level ${after}`);
  }
  // Bestiary and kill counts
  for (const e of exp.seen) {
    const c = (state.codex.enemies[e] ??= { seen: 0, defeated: 0 });
    c.seen += 1;
  }
  for (const [e, n] of Object.entries(exp.kills)) {
    const c = (state.codex.enemies[e] ??= { seen: 0, defeated: 0 });
    c.defeated += n;
    state.stats.kills[e] = (state.stats.kills[e] ?? 0) + n;
  }
  // Discoveries
  for (const id of exp.discoveries) applyDiscovery(state, ctx, id);
  // Route records and first-clear unlocks
  let firstClear: string | undefined;
  state.stats.expeditions += 1;
  if (outcome === 'success') {
    const prior = state.stats.routeClears[route.id] ?? 0;
    state.stats.routeClears[route.id] = prior + 1;
    if (prior === 0 && route.firstClear) {
      for (const f of route.firstClear.flags ?? []) state.flags[f] = true;
      if (route.firstClear.standing) state.standing += route.firstClear.standing;
      firstClear = route.firstClear.text;
      ctx.events.push({ type: 'first-clear', routeId: route.id, text: route.firstClear.text });
      pushFeed(state, ctx, 'discovery', firstClear);
    }
  }
  const report: ExpeditionReport = {
    id: exp.id,
    routeId: route.id,
    run: exp.run,
    outcome,
    recalled: exp.recalled,
    startedAt: exp.startedAt,
    endedAt: ctx.time,
    duration: Math.max(0, ctx.time - exp.startedAt),
    drift: exp.drift,
    risk: exp.risk,
    members: [...exp.members],
    log: exp.log,
    loot,
    lost,
    leftBehind: exp.leftBehind,
    sold,
    marks,
    heroXp,
    skillXp,
    levelUps,
    kills: exp.kills,
    discoveries: exp.discoveries,
    used: exp.used,
    firstClear,
    hpAfter: Object.fromEntries(exp.members.map((m) => [m, state.heroes[m].hp])),
    unread: true,
  };
  state.reports.unshift(report);
  if (state.reports.length > MAX_REPORTS) state.reports.length = MAX_REPORTS;
  // Keep full blow-by-blow combat logs only for the most recent reports so
  // saves stay small; older reports keep their fight summaries.
  for (let i = FULL_LOG_REPORTS; i < state.reports.length; i++) {
    for (const e of state.reports[i].log) if (e.fight && e.fight.lines.length) e.fight.lines = [];
  }
  const word = outcome === 'success' ? 'returned' : outcome === 'retreat' ? (exp.recalled ? 'was recalled' : 'retreated') : 'was defeated';
  pushFeed(state, ctx, outcome === 'success' ? 'expedition' : 'warn', `${route.name}: the party ${word}. +${marks} marks${Object.keys(loot).length ? `, ${supplyLoad(loot)} items` : ''}.`);
  ctx.events.push({ type: 'expedition-return', reportId: report.id, outcome, routeId: route.id });
  return report;
}

export function applyDiscovery(state: GameState, ctx: SimContext | null, id: string): void {
  const d = DISCOVERIES[id];
  if (!d) return;
  state.codex.discoveries[id] = (state.codex.discoveries[id] ?? 0) + 1;
  const g = d.grants;
  for (const f of g.flags ?? []) state.flags[f] = true;
  for (const r of g.recipes ?? []) if (!state.recipes.includes(r)) state.recipes.push(r);
  for (const it of g.items ?? []) addItem(state, ctx, it.item, it.qty);
  if (g.marks) state.marks += g.marks;
  if (g.standing) state.standing += g.standing;
  if (g.lore && LORE[g.lore] && !state.codex.lore.includes(g.lore)) state.codex.lore.push(g.lore);
  if (ctx) {
    ctx.events.push({ type: 'discovery', id, name: d.name });
    pushFeed(state, ctx, 'discovery', `Discovered: ${d.name}.`);
  }
}

const MAX_REPORTS = 15;
const FULL_LOG_REPORTS = 4;

/** After a successful run with standing orders, the party rests in camp first. */
export const REST_THRESHOLD = 0.9;
