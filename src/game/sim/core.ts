// Shared mutation helpers used by every part of the simulation.
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { HEROES, MAX_HERO_LEVEL } from '../data/heroes';
import type { ItemQty, SkillId } from '../types';
import type { FeedEntry, GameState } from './state';
import { heroMaxHp, heroXpMult, heroXpToNext, skillLevel, skillXpMult, stackCap } from './rules';

export type SimEvent =
  | { type: 'items'; items: Record<string, number>; source: string }
  | { type: 'sold'; item: string; qty: number; marks: number }
  | { type: 'skill-level'; skill: SkillId; level: number }
  | { type: 'hero-level'; hero: string; level: number }
  | { type: 'order-cycle'; actionId: string; name: string }
  | { type: 'order-done'; name: string; count: number }
  | { type: 'order-blocked'; name: string; reason: string }
  | { type: 'build-done'; upgrade: string; name: string; level: number }
  | { type: 'expedition-depart'; routeId: string; run: number }
  | { type: 'expedition-return'; reportId: number; outcome: string; routeId: string }
  | { type: 'repeat-halted'; reason: string }
  | { type: 'discovery'; id: string; name: string }
  | { type: 'first-clear'; routeId: string; text: string }
  | { type: 'contract-ready'; id: string; title: string }
  | { type: 'tutorial'; step: number };

export interface SimContext {
  /** Absolute (wall-clock) time of the moment being simulated. */
  time: number;
  events: SimEvent[];
}

export function makeContext(time: number): SimContext {
  return { time, events: [] };
}

export function count(state: GameState, id: string): number {
  return state.inventory[id] ?? 0;
}

export function hasItems(state: GameState, list: ItemQty[] | undefined, times = 1): boolean {
  return (list ?? []).every((q) => count(state, q.item) >= q.qty * times);
}

export function missingItems(state: GameState, list: ItemQty[] | undefined, times = 1): ItemQty[] {
  return (list ?? [])
    .filter((q) => count(state, q.item) < q.qty * times)
    .map((q) => ({ item: q.item, qty: q.qty * times - count(state, q.item) }));
}

export function removeItems(state: GameState, list: ItemQty[] | undefined, times = 1): void {
  for (const q of list ?? []) {
    const left = count(state, q.item) - q.qty * times;
    if (left > 0) state.inventory[q.item] = left;
    else delete state.inventory[q.item];
  }
}

/**
 * Add items up to the stack cap. Anything over the cap is sold to the
 * quartermaster at half value. Returns the amount actually stored.
 */
export function addItem(state: GameState, ctx: SimContext | null, id: string, qty: number): number {
  if (qty <= 0) return 0;
  const cap = stackCap(state);
  const have = count(state, id);
  const stored = Math.max(0, Math.min(qty, cap - have));
  if (stored > 0) state.inventory[id] = have + stored;
  state.codex.items[id] = true;
  const over = qty - stored;
  if (over > 0) {
    const marks = Math.floor((ITEMS[id]?.value ?? 0) * over * 0.5);
    state.marks += marks;
    ctx?.events.push({ type: 'sold', item: id, qty: over, marks });
  }
  return stored;
}

export function grantSkillXp(state: GameState, ctx: SimContext | null, skill: SkillId, xp: number): number {
  const amount = Math.round(xp * skillXpMult(state));
  const before = skillLevel(state.skills[skill]);
  state.skills[skill] = (state.skills[skill] ?? 0) + amount;
  const after = skillLevel(state.skills[skill]);
  if (after > before && ctx) {
    ctx.events.push({ type: 'skill-level', skill, level: after });
    pushFeed(state, ctx, 'level', `${SKILLS[skill].name} reached level ${after}.`);
  }
  return amount;
}

export function grantHeroXp(state: GameState, ctx: SimContext | null, heroId: string, xp: number): number[] {
  const hero = state.heroes[heroId];
  const levels: number[] = [];
  hero.xp += Math.round(xp * heroXpMult(state));
  while (hero.level < MAX_HERO_LEVEL && hero.xp >= heroXpToNext(hero.level)) {
    const beforeMax = heroMaxHp(state, heroId);
    hero.xp -= heroXpToNext(hero.level);
    hero.level += 1;
    hero.hp += heroMaxHp(state, heroId) - beforeMax;
    levels.push(hero.level);
    if (ctx) {
      ctx.events.push({ type: 'hero-level', hero: heroId, level: hero.level });
      pushFeed(state, ctx, 'level', `${HEROES[heroId].name} reached level ${hero.level}.`);
    }
  }
  if (hero.level >= MAX_HERO_LEVEL) hero.xp = 0;
  return levels;
}

export function pushFeed(state: GameState, ctx: SimContext | null, kind: FeedEntry['kind'], text: string): void {
  state.feed.unshift({ t: ctx?.time ?? state.lastTick, kind, text });
  if (state.feed.length > 40) state.feed.length = 40;
}

export function nextId(state: GameState): number {
  return state.nextId++;
}
