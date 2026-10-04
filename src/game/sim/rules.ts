// Derived values and game rules. Pure functions of state + content data.
import { ACTIONS } from '../data/actions';
import { RANKS, UPGRADES } from '../data/camp';
import { ENEMIES } from '../data/enemies';
import { HEROES, MAX_HERO_LEVEL } from '../data/heroes';
import { ITEMS } from '../data/items';
import { MAX_SKILL_LEVEL, SKILLS } from '../data/skills';
import { DRIFTS, DRIFT_PERIOD_MS, REGIONS, ROUTES, REGION_LIST } from '../data/world';
import type { ActionDef, HeroRole, Requirement, Row, SkillId, Stats } from '../types';
import { hash32, hashStr } from './rng';
import type { GameState, HeroState, Risk } from './state';

// ---------------------------------------------------------------------------
// Experience curves

/** Total XP needed to reach a skill level. */
export function skillXpFor(level: number): number {
  if (level <= 1) return 0;
  return Math.round((40 * (Math.pow(1.18, level - 1) - 1)) / 0.18);
}

export function skillLevel(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_SKILL_LEVEL && xp >= skillXpFor(lvl + 1)) lvl++;
  return lvl;
}

export function levelOf(state: GameState, skill: SkillId): number {
  return skillLevel(state.skills[skill] ?? 0);
}

export function skillProgress(xp: number): { level: number; into: number; need: number; frac: number } {
  const level = skillLevel(xp);
  if (level >= MAX_SKILL_LEVEL) return { level, into: 0, need: 0, frac: 1 };
  const base = skillXpFor(level);
  const next = skillXpFor(level + 1);
  return { level, into: xp - base, need: next - base, frac: (xp - base) / (next - base) };
}

export function heroXpToNext(level: number): number {
  return Math.round(40 * Math.pow(1.3, level - 1));
}

// ---------------------------------------------------------------------------
// Charter rank and doctrines

export function rankOf(standing: number): number {
  let r = 0;
  for (const rk of RANKS) if (standing >= rk.standing) r = rk.rank;
  return r;
}

export function hasDoctrine(state: GameState, id: string): boolean {
  return state.doctrines.includes(id);
}

export function skillXpMult(state: GameState): number {
  return rankOf(state.standing) >= 5 ? 1.1 : 1;
}

export function heroXpMult(state: GameState): number {
  return rankOf(state.standing) >= 3 ? 1.15 : 1;
}

export function marksMult(state: GameState): number {
  return rankOf(state.standing) >= 1 ? 1.1 : 1;
}

// ---------------------------------------------------------------------------
// Camp capacity

export function upgradeLevel(state: GameState, id: string): number {
  return state.upgrades[id] ?? 0;
}

export function totalHands(state: GameState): number {
  return 3 + upgradeLevel(state, 'bunkhouse');
}

export function handsInUse(state: GameState): { orders: number; porters: number; total: number } {
  const orders = state.orders.reduce((s, o) => s + (o ? o.hands : 0), 0);
  const porters = state.expedition ? state.expedition.porters : 0;
  return { orders, porters, total: orders + porters };
}

export function freeHands(state: GameState): number {
  return totalHands(state) - handsInUse(state).total;
}

export function stackCap(state: GameState): number {
  return 100 * Math.pow(2, upgradeLevel(state, 'storehouse'));
}

export const BASE_OFFLINE_HOURS = 8;

export function offlineCapMs(state: GameState): number {
  return (BASE_OFFLINE_HOURS + 4 * upgradeLevel(state, 'signal_beacon')) * 3600_000;
}

export function intelLevel(state: GameState): number {
  return 1 + upgradeLevel(state, 'cartographer') + Math.floor(levelOf(state, 'scouting') / 10);
}

/** Healing in camp: fraction of max HP per millisecond. */
export function healRatePerMs(state: GameState): number {
  const base = 1 / 240_000; // full heal in 4 minutes
  return base * (1 + 0.5 * upgradeLevel(state, 'infirmary'));
}

// ---------------------------------------------------------------------------
// Heroes

export interface HeroCombatStats extends Stats {
  ranged: boolean;
  pierce: number;
  light: boolean;
  carry: number;
  ward: number;
  discovery: number;
  mending: number;
  shock: number;
  role: HeroRole;
}

export function heroBaseStats(hero: HeroState): Stats {
  const def = HEROES[hero.id];
  const l = hero.level - 1;
  return {
    vigor: def.base.vigor + def.growth.vigor * l,
    might: def.base.might + def.growth.might * l,
    guard: def.base.guard + def.growth.guard * l,
    speed: def.base.speed + def.growth.speed * l,
  };
}

export function heroStats(state: GameState, heroId: string, gearOverride?: HeroState['gear']): HeroCombatStats {
  const hero = state.heroes[heroId];
  const def = HEROES[heroId];
  const s = heroBaseStats(hero);
  const out: HeroCombatStats = {
    ...s,
    ranged: false,
    pierce: 0,
    light: false,
    carry: 0,
    ward: 0,
    discovery: 0,
    mending: 0,
    shock: 0,
    role: def.role,
  };
  const gear = gearOverride ?? hero.gear;
  for (const slot of ['weapon', 'armor', 'trinket'] as const) {
    const id = gear[slot];
    if (!id) continue;
    const eq = ITEMS[id]?.equip;
    if (!eq) continue;
    if (eq.stats) for (const k of Object.keys(eq.stats) as (keyof Stats)[]) out[k] += eq.stats[k] ?? 0;
    if (eq.ranged) out.ranged = true;
    if (eq.light) out.light = true;
    out.pierce += eq.pierce ?? 0;
    out.carry += eq.carry ?? 0;
    out.ward += eq.ward ?? 0;
    out.discovery += eq.discovery ?? 0;
    out.mending += eq.mending ?? 0;
    out.shock += eq.shock ?? 0;
  }
  if (hasDoctrine(state, 'shieldbound')) {
    out.vigor *= 1.15;
    out.guard *= 1.15;
  }
  out.vigor = Math.round(out.vigor);
  out.might = Math.max(1, Math.round(out.might));
  out.guard = Math.max(0, Math.round(out.guard));
  out.speed = Math.max(3, Math.round(out.speed));
  return out;
}

export function heroMaxHp(state: GameState, heroId: string): number {
  return heroStats(state, heroId).vigor;
}

/** Simple power score used for readiness hints. */
export function heroPower(st: HeroCombatStats): number {
  return st.vigor * 0.35 + st.might * 4 * (st.speed / 10) + st.guard * 5;
}

export function heroOnExpedition(state: GameState, heroId: string): boolean {
  return !!state.expedition && state.expedition.members.includes(heroId);
}

/** Heroes are away (not healing in camp) only while travelling or returning. */
export function heroTravelling(state: GameState, heroId: string): boolean {
  const e = state.expedition;
  return !!e && e.phase !== 'rest' && e.members.includes(heroId);
}

// ---------------------------------------------------------------------------
// Requirements

export function regionUnlocked(state: GameState, regionId: string): boolean {
  const r = REGIONS[regionId];
  return !!r && r.requires.every((q) => checkReq(state, q));
}

export function checkReq(state: GameState, req: Requirement): boolean {
  switch (req.type) {
    case 'skill':
      return levelOf(state, req.skill) >= req.level;
    case 'route':
      return (state.stats.routeClears[req.route] ?? 0) > 0;
    case 'flag':
      return !!state.flags[req.flag];
    case 'upgrade':
      return upgradeLevel(state, req.upgrade) >= req.level;
    case 'region':
      return regionUnlocked(state, req.region);
    case 'rank':
      return rankOf(state.standing) >= req.rank;
    case 'recipe':
      return state.recipes.includes(req.recipe);
  }
}

const FLAG_LABELS: Record<string, string> = {
  waymark_ferry: "Discover the Ferryman's Waymark (Wildroot Trail)",
  fenwick: 'Reconnect Fenwick Stile (Old Ferry Road)',
  matriarch_slain: 'Defeat the Hollowmere Matriarch',
  kiln_signal: 'Find the Kilnmouth Signal Fire (Harrier Ridge)',
  kilnmouth: 'Reconnect Kilnmouth (Kilnmouth Gate)',
  tollspire_road: 'Chart the Saltmarsh Approach',
  sluice_key: "Find the Tollkeeper's Sluice Key (Sunken Archive)",
  tollspire: 'Still the Drowned Engine',
};

export function describeReq(req: Requirement): string {
  switch (req.type) {
    case 'skill':
      return `${SKILLS[req.skill].name} level ${req.level}`;
    case 'route':
      return `Complete ${ROUTES[req.route]?.name ?? req.route}`;
    case 'flag':
      return FLAG_LABELS[req.flag] ?? req.flag;
    case 'upgrade':
      return `${UPGRADES[req.upgrade]?.name ?? req.upgrade} level ${req.level}`;
    case 'region':
      return `Unlock ${REGIONS[req.region]?.name ?? req.region}`;
    case 'rank':
      return `Charter rank ${req.rank}`;
    case 'recipe':
      return `Learn ${ACTIONS[req.recipe]?.name ?? req.recipe}`;
  }
}

export function unmetReqs(state: GameState, reqs: Requirement[] | undefined): Requirement[] {
  return (reqs ?? []).filter((r) => !checkReq(state, r));
}

// ---------------------------------------------------------------------------
// Actions / recipes

export interface ActionAvailability {
  ok: boolean;
  known: boolean;
  reasons: string[];
}

export function actionAvailability(state: GameState, action: ActionDef): ActionAvailability {
  const reasons: string[] = [];
  const known = action.kind === 'gather' || state.recipes.includes(action.id);
  if (!known) reasons.push(action.learnHint ?? 'Recipe not yet learned');
  if (levelOf(state, action.skill) < action.level) reasons.push(`${SKILLS[action.skill].name} level ${action.level}`);
  for (const r of unmetReqs(state, action.requires)) reasons.push(describeReq(r));
  return { ok: reasons.length === 0, known, reasons };
}

export function workSpeedMult(state: GameState, skill: SkillId, hands: number): number {
  const lvl = levelOf(state, skill);
  let m = 1 + Math.min(0.3, 0.01 * (lvl - 1));
  if (hands >= 2) m *= 1.6;
  if (skill === 'smithing') m *= 1 + 0.1 * upgradeLevel(state, 'forge');
  if (skill === 'alchemy') m *= 1 + 0.1 * upgradeLevel(state, 'still_room');
  if (skill === 'engineering') m *= 1 + 0.1 * upgradeLevel(state, 'engineers_loft');
  if (hasDoctrine(state, 'hearthkeepers')) m *= 1.15;
  return m;
}

export function actionCycleMs(state: GameState, action: ActionDef, hands: number): number {
  return Math.max(500, Math.round((action.seconds * 1000) / workSpeedMult(state, action.skill, hands)));
}

export function buildCycleMs(state: GameState, seconds: number, hands: number): number {
  let m = hands >= 2 ? 1.6 : 1;
  if (hasDoctrine(state, 'hearthkeepers')) m *= 1.15;
  return Math.max(1000, Math.round((seconds * 1000) / m));
}

/** Chance of a bonus output batch for crafting recipes. */
export function extraOutputChance(state: GameState, action: ActionDef): number {
  if (action.kind !== 'craft') return 0;
  let c = 0;
  if (action.skill === 'alchemy') c += 0.1 * upgradeLevel(state, 'still_room');
  if (action.skill !== 'salvaging' && hasDoctrine(state, 'emberhands')) c += 0.15;
  return c;
}

// ---------------------------------------------------------------------------
// Routes and expeditions

export function routeUnlocked(state: GameState, routeId: string): boolean {
  const r = ROUTES[routeId];
  if (!r) return false;
  return regionUnlocked(state, r.region) && r.requires.every((q) => checkReq(state, q));
}

export function routeLockReasons(state: GameState, routeId: string): string[] {
  const r = ROUTES[routeId];
  const out: string[] = [];
  if (!regionUnlocked(state, r.region)) {
    for (const q of unmetReqs(state, REGIONS[r.region].requires)) out.push(describeReq(q));
  }
  for (const q of unmetReqs(state, r.requires)) if (q.type !== 'region') out.push(describeReq(q));
  return out;
}

export function driftIndex(time: number): number {
  return Math.floor(time / DRIFT_PERIOD_MS);
}

export function driftFor(regionId: string, time: number): string {
  const region = REGIONS[regionId];
  const idx = driftIndex(time);
  const h = hash32(hashStr(regionId), idx);
  return region.drift[h % region.drift.length];
}

export function driftEndsAt(time: number): number {
  return (driftIndex(time) + 1) * DRIFT_PERIOD_MS;
}

export const RISKS: Record<Risk, { name: string; desc: string; duration: number; encounter: number; hazard: number; finds: number; discovery: number; marks: number }> = {
  careful: {
    name: 'Careful', desc: 'Slow and watchful: 20% longer, 30% fewer fights, 20% fewer hazards, but 10% fewer finds and marks.',
    duration: 1.2, encounter: 0.7, hazard: 0.8, finds: 0.9, discovery: 0.9, marks: 0.9,
  },
  standard: {
    name: 'Steady', desc: 'The usual pace. No modifiers.',
    duration: 1, encounter: 1, hazard: 1, finds: 1, discovery: 1, marks: 1,
  },
  bold: {
    name: 'Bold', desc: 'Push hard: 15% faster, 15% more finds, 25% likelier discoveries, 20% more marks, but 30% more fights and 20% more hazards.',
    duration: 0.85, encounter: 1.3, hazard: 1.2, finds: 1.15, discovery: 1.25, marks: 1.2,
  },
};

export interface DurationBreakdown {
  mult: number;
  parts: { label: string; mult: number }[];
}

export function expeditionDurationMult(state: GameState, members: string[], risk: Risk, driftId: string): DurationBreakdown {
  const parts: { label: string; mult: number }[] = [];
  const scout = levelOf(state, 'scouting');
  const scoutBonus = Math.min(0.3, 0.01 * (scout - 1));
  if (scoutBonus > 0) parts.push({ label: `Scouting ${scout}`, mult: 1 - scoutBonus });
  if (RISKS[risk].duration !== 1) parts.push({ label: `${RISKS[risk].name} pace`, mult: RISKS[risk].duration });
  const drift = DRIFTS[driftId];
  if (drift?.duration) parts.push({ label: drift.name, mult: drift.duration });
  if (members.includes('sela')) parts.push({ label: 'Sela (Trailwise)', mult: 0.9 });
  if (hasDoctrine(state, 'pathwrights')) parts.push({ label: 'Pathwrights', mult: 0.9 });
  const beacon = upgradeLevel(state, 'signal_beacon');
  if (beacon > 0) parts.push({ label: `Signal Beacon ${beacon}`, mult: 1 - 0.05 * beacon });
  const mult = parts.reduce((m, p) => m * p.mult, 1);
  return { mult, parts };
}

export function partyCarry(state: GameState, members: string[], porters: number): number {
  let c = 5 * members.length + 8 * porters + 6 * upgradeLevel(state, 'depot');
  for (const m of members) c += heroStats(state, m).carry;
  return c;
}

export function discoveryMult(state: GameState, members: string[], risk: Risk, driftId: string): number {
  let m = 1 + 0.02 * (levelOf(state, 'scouting') - 1);
  m += 0.1 * upgradeLevel(state, 'cartographer');
  for (const id of members) m += heroStats(state, id).discovery / 100;
  if (members.includes('sela')) m += 0.1;
  if (hasDoctrine(state, 'pathwrights')) m += 0.15;
  m *= RISKS[risk].discovery;
  m *= DRIFTS[driftId]?.discovery ?? 1;
  return m;
}

export function findSkillFor(itemId: string): SkillId | null {
  const cat = ITEMS[itemId]?.category;
  switch (cat) {
    case 'herb':
    case 'food':
    case 'fiber':
    case 'wood':
      return 'foraging';
    case 'ore':
      return 'mining';
    case 'scrap':
      return 'salvaging';
    case 'notes':
      return 'scouting';
    default:
      return null;
  }
}

export function itemValue(id: string): number {
  return ITEMS[id]?.value ?? 0;
}

export function rowLabel(row: Row): string {
  return row === 'front' ? 'Front row' : 'Back row';
}

export function enemyThreatScore(enemyId: string): number {
  const e = ENEMIES[enemyId];
  return e.hp * 0.3 + e.might * 3 * (e.speed / 10) + e.guard * 4 + (e.boss ? 40 : 0);
}

export function regionsInOrder() {
  return REGION_LIST;
}

export function heroLevelCap(): number {
  return MAX_HERO_LEVEL;
}
