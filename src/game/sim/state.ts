import { HERO_LIST } from '../data/heroes';
import { SKILL_ORDER } from '../data/skills';
import { ACTION_LIST } from '../data/actions';
import type { Row, SkillId } from '../types';
import type { HeroCombatStats } from './rules';

export const SAVE_VERSION = 2;

export type Risk = 'careful' | 'standard' | 'bold';

export interface Tactics {
  focus: 'weakest' | 'strongest' | 'threats';
  /** Drink a tonic when below this fraction of max health. */
  tonicAt: number;
  flasks: 'always' | 'finale' | 'never';
  /** Break off when total party health falls below this fraction. */
  retreatAt: number;
}

export interface HeroState {
  id: string;
  recruited: boolean;
  level: number;
  xp: number;
  hp: number;
  gear: { weapon: string | null; armor: string | null; trinket: string | null };
}

export interface PlanDraft {
  routeId: string;
  supplies: Record<string, number>;
  porters: number;
  risk: Risk;
  /** Extra runs after the first: 0 = once, -1 = repeat until stopped. */
  repeat: number;
}

export type LogKind =
  | 'travel'
  | 'ration'
  | 'hunger'
  | 'hazard'
  | 'safe'
  | 'fight'
  | 'find'
  | 'full'
  | 'discovery'
  | 'retreat'
  | 'defeat'
  | 'objective'
  | 'return';

export interface CombatLine {
  k: 'hit' | 'heal' | 'status' | 'info' | 'down' | 'enemy' | 'result';
  t: string;
}

export interface FightRecord {
  title: string;
  enemies: string[];
  result: 'victory' | 'fled' | 'defeat';
  summary: string;
  lines: CombatLine[];
}

export interface LogEntry {
  leg: number;
  kind: LogKind;
  text: string;
  fight?: FightRecord;
}

export interface ExpeditionState {
  id: number;
  routeId: string;
  seed: number;
  run: number;
  phase: 'travel' | 'return' | 'rest';
  elapsed: number;
  legs: number[];
  legNames: string[];
  leg: number;
  returnMs: number;
  members: string[];
  rows: Record<string, Row>;
  hp: Record<string, number>;
  supplies: Record<string, number>;
  plan: PlanDraft;
  porters: number;
  risk: Risk;
  tactics: Tactics;
  drift: string;
  carry: number;
  ward: number;
  pack: Record<string, number>;
  leftBehind: Record<string, number>;
  marks: number;
  heroXp: number;
  skillXp: Partial<Record<SkillId, number>>;
  kills: Record<string, number>;
  seen: string[];
  discoveries: string[];
  used: Record<string, number>;
  log: LogEntry[];
  outcome: 'success' | 'retreat' | 'defeat' | null;
  recalled?: boolean;
  repeatLeft: number;
  startedAt: number;
  /** Party stats captured at departure. */
  stats: Record<string, HeroCombatStats>;
  /** Modifiers captured at departure. */
  mods: ExpeditionMods;
}

export interface ExpeditionMods {
  discovery: number;
  finds: Record<SkillId | 'none', number>;
  trophy: number;
  marks: number;
}

export interface WorkOrder {
  id: number;
  kind: 'action' | 'build';
  actionId?: string;
  upgradeId?: string;
  /** Build orders: the upgrade level being built. */
  level?: number;
  hands: number;
  elapsed: number;
  cycleMs: number;
  done: number;
  /** null = repeat until stopped */
  target: number | null;
  status: 'running' | 'blocked';
  blocked?: string;
  seed: number;
  produced: Record<string, number>;
}

export interface ExpeditionReport {
  id: number;
  routeId: string;
  run: number;
  outcome: 'success' | 'retreat' | 'defeat';
  recalled?: boolean;
  startedAt: number;
  endedAt: number;
  duration: number;
  drift: string;
  risk: Risk;
  members: string[];
  log: LogEntry[];
  loot: Record<string, number>;
  lost: Record<string, number>;
  leftBehind: Record<string, number>;
  sold: number;
  marks: number;
  heroXp: number;
  skillXp: Partial<Record<SkillId, number>>;
  levelUps: string[];
  kills: Record<string, number>;
  discoveries: string[];
  used: Record<string, number>;
  firstClear?: string;
  hpAfter: Record<string, number>;
  unread: boolean;
}

export interface FeedEntry {
  t: number;
  kind: 'expedition' | 'order' | 'level' | 'discovery' | 'build' | 'contract' | 'warn' | 'info';
  text: string;
}

export interface ReturnSummary {
  from: number;
  to: number;
  elapsed: number;
  cappedMs: number;
  clockBack: boolean;
  items: Record<string, number>;
  marks: number;
  standing: number;
  skillXp: Partial<Record<SkillId, number>>;
  skillLevels: Partial<Record<SkillId, [number, number]>>;
  heroLevels: Record<string, [number, number]>;
  reports: number[];
  orders: { name: string; cycles: number }[];
  builds: string[];
  discoveries: string[];
  attention: string[];
}

export interface Stats {
  kills: Record<string, number>;
  crafted: Record<string, number>;
  gathered: Record<string, number>;
  routeRuns: Record<string, number>;
  routeClears: Record<string, number>;
  expeditions: number;
  ordersStarted: number;
  totalCrafted: number;
  marksEarned: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  lastTick: number;
  worldSeed: number;
  nextId: number;
  saveSeq: number;
  marks: number;
  standing: number;
  inventory: Record<string, number>;
  skills: Record<SkillId, number>;
  heroes: Record<string, HeroState>;
  party: { members: string[]; rows: Record<string, Row> };
  tactics: Tactics;
  plan: PlanDraft;
  expedition: ExpeditionState | null;
  orders: (WorkOrder | null)[];
  upgrades: Record<string, number>;
  recipes: string[];
  flags: Record<string, boolean>;
  codex: {
    enemies: Record<string, { seen: number; defeated: number }>;
    items: Record<string, boolean>;
    discoveries: Record<string, number>;
    lore: string[];
  };
  contracts: Record<string, { status: 'active' | 'done'; base: number; notified?: boolean }>;
  doctrines: string[];
  stats: Stats;
  reports: ExpeditionReport[];
  feed: FeedEntry[];
  tutorial: { step: number; hidden: boolean; welcomed: boolean };
  settings: { reducedMotion: 'system' | 'on' | 'off'; confirmDeliver: boolean };
  pendingSummary: ReturnSummary | null;
}

export const DEFAULT_TACTICS: Tactics = { focus: 'threats', tonicAt: 0.5, flasks: 'finale', retreatAt: 0.3 };

export function createInitialState(now: number, seed?: number): GameState {
  const heroes: Record<string, HeroState> = {};
  for (const h of HERO_LIST) {
    heroes[h.id] = {
      id: h.id,
      recruited: h.recruitHint === null,
      level: 1,
      xp: 0,
      hp: h.base.vigor,
      gear: {
        weapon: h.startGear.weapon ?? null,
        armor: h.startGear.armor ?? null,
        trinket: h.startGear.trinket ?? null,
      },
    };
  }
  const skills = Object.fromEntries(SKILL_ORDER.map((s) => [s, 0])) as Record<SkillId, number>;
  const recipes = ACTION_LIST.filter((a) => a.kind === 'craft' && a.known !== false).map((a) => a.id);
  const worldSeed = seed ?? ((now ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  const inventory: Record<string, number> = {
    trail_ration: 8,
    mending_tonic: 2,
    wildroot: 4,
    fenberry: 4,
    timber: 4,
    rustrock: 6,
    fittings: 2,
  };
  const state: GameState = {
    version: SAVE_VERSION,
    createdAt: now,
    lastTick: now,
    worldSeed,
    nextId: 1,
    saveSeq: 0,
    marks: 30,
    standing: 0,
    inventory,
    skills,
    heroes,
    party: {
      members: ['brannoc', 'wren', 'tamsin'],
      rows: Object.fromEntries(HERO_LIST.map((h) => [h.id, h.defaultRow])),
    },
    tactics: { ...DEFAULT_TACTICS },
    plan: { routeId: 'wildroot_trail', supplies: { trail_ration: 3, mending_tonic: 2 }, porters: 1, risk: 'standard', repeat: 0 },
    expedition: null,
    orders: [null, null],
    upgrades: {},
    recipes,
    flags: {},
    codex: { enemies: {}, items: {}, discoveries: {}, lore: ['lore_compact'] },
    contracts: {},
    doctrines: [],
    stats: {
      kills: {},
      crafted: {},
      gathered: {},
      routeRuns: {},
      routeClears: {},
      expeditions: 0,
      ordersStarted: 0,
      totalCrafted: 0,
      marksEarned: 0,
    },
    reports: [],
    feed: [],
    tutorial: { step: 0, hidden: false, welcomed: false },
    settings: { reducedMotion: 'system', confirmDeliver: true },
    pendingSummary: null,
  };
  for (const id of Object.keys(inventory)) state.codex.items[id] = true;
  for (const h of HERO_LIST) for (const g of Object.values(h.startGear)) if (g) state.codex.items[g] = true;
  return state;
}
