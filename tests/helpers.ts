import { createInitialState, type GameState } from '../src/game/sim/state';
import { skillXpFor, heroStats } from '../src/game/sim/rules';
import type { SkillId } from '../src/game/types';

export const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

export function freshState(seed = 1234): GameState {
  return createInitialState(T0, seed);
}

export interface StageOpts {
  level: number;
  gear: Record<string, { weapon?: string | null; armor?: string | null; trinket?: string | null }>;
  flags?: string[];
  skills?: Partial<Record<SkillId, number>>;
  recruits?: string[];
  party?: string[];
  rows?: Record<string, 'front' | 'back'>;
  inventory?: Record<string, number>;
  upgrades?: Record<string, number>;
}

/** Build a mid-progression state for balance checks. */
export function stageState(o: StageOpts, seed = 99): GameState {
  const s = freshState(seed);
  for (const f of o.flags ?? []) s.flags[f] = true;
  for (const r of o.recruits ?? []) s.heroes[r].recruited = true;
  for (const [k, v] of Object.entries(o.skills ?? {})) s.skills[k as SkillId] = skillXpFor(v!);
  for (const h of Object.values(s.heroes)) {
    h.level = o.level;
    const g = o.gear[h.id];
    if (g) h.gear = { weapon: g.weapon ?? h.gear.weapon, armor: g.armor ?? h.gear.armor, trinket: g.trinket ?? h.gear.trinket };
  }
  if (o.party) s.party.members = o.party;
  if (o.rows) s.party.rows = { ...s.party.rows, ...o.rows };
  if (o.upgrades) s.upgrades = { ...o.upgrades };
  s.inventory = { ...s.inventory, ...(o.inventory ?? {}) };
  for (const h of Object.values(s.heroes)) h.hp = heroStats(s, h.id).vigor;
  return s;
}
