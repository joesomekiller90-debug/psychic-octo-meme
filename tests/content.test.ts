// Content integrity: every reference resolves, and every item, recipe, route
// and recruit can actually be reached through play.
import { describe, expect, it } from 'vitest';
import { ACTION_LIST, RECIPE_LIST } from '../src/game/data/actions';
import { CONTRACT_LIST, UPGRADE_LIST } from '../src/game/data/camp';
import { ENEMIES, ENEMY_LIST } from '../src/game/data/enemies';
import { HERO_LIST } from '../src/game/data/heroes';
import { ITEMS, ITEM_LIST } from '../src/game/data/items';
import { SKILL_ORDER } from '../src/game/data/skills';
import { DISCOVERY_LIST, HAZARDS, REGION_LIST, REGIONS, ROUTE_LIST, ROUTES } from '../src/game/data/world';
import type { Requirement } from '../src/game/types';

describe('content', () => {
  it('meets the scope targets', () => {
    expect(SKILL_ORDER.length).toBeGreaterThanOrEqual(6);
    expect(RECIPE_LIST.length).toBeGreaterThanOrEqual(12);
    expect(REGION_LIST.length).toBeGreaterThanOrEqual(3);
    expect(ENEMY_LIST.filter((e) => !e.boss).length).toBeGreaterThanOrEqual(6);
    expect(ENEMY_LIST.some((e) => e.boss)).toBe(true);
    expect(CONTRACT_LIST.length).toBeGreaterThanOrEqual(8);
    for (const r of REGION_LIST) expect(ROUTE_LIST.filter((x) => x.region === r.id).length).toBeGreaterThanOrEqual(2);
  });

  it('every reference resolves', () => {
    const item = (id: string) => expect(ITEMS[id], id).toBeDefined();
    for (const a of ACTION_LIST) {
      a.inputs?.forEach((q) => item(q.item));
      a.outputs.forEach((q) => item(q.item));
    }
    for (const r of ROUTE_LIST) {
      expect(REGIONS[r.region]).toBeDefined();
      r.finds.forEach((f) => item(f.item));
      r.encounters.forEach((e) => e.enemies.forEach((x) => expect(ENEMIES[x], x).toBeDefined()));
      r.finale?.enemies.forEach((x) => expect(ENEMIES[x], x).toBeDefined());
      r.hazards.forEach((h) => expect(HAZARDS[h], h).toBeDefined());
    }
    for (const e of ENEMY_LIST) e.loot.forEach((l) => item(l.item));
    for (const u of UPGRADE_LIST) u.levels.forEach((l) => l.items.forEach((q) => item(q.item)));
    for (const d of DISCOVERY_LIST) {
      expect(ROUTES[d.route]).toBeDefined();
      d.grants.items?.forEach((q) => item(q.item));
      d.grants.recipes?.forEach((r) => expect(ACTION_LIST.find((a) => a.id === r), r).toBeDefined());
    }
    for (const c of CONTRACT_LIST) c.reward.items?.forEach((q) => item(q.item));
    for (const h of HERO_LIST) Object.values(h.startGear).forEach((g) => g && item(g));
  });

  it('every item has a source', () => {
    const sources = new Set<string>();
    ACTION_LIST.forEach((a) => a.outputs.forEach((o) => sources.add(o.item)));
    ROUTE_LIST.forEach((r) => r.finds.forEach((f) => sources.add(f.item)));
    ENEMY_LIST.forEach((e) => e.loot.forEach((l) => sources.add(l.item)));
    HERO_LIST.forEach((h) => Object.values(h.startGear).forEach((g) => g && sources.add(g)));
    for (const i of ITEM_LIST) expect(sources.has(i.id), i.id).toBe(true);
  });

  it('every flag, recipe and recruit is obtainable', () => {
    const flagSources = new Set<string>();
    ROUTE_LIST.forEach((r) => r.firstClear?.flags?.forEach((f) => flagSources.add(f)));
    DISCOVERY_LIST.forEach((d) => d.grants.flags?.forEach((f) => flagSources.add(f)));
    CONTRACT_LIST.forEach((c) => c.reward.flags?.forEach((f) => flagSources.add(f)));
    const reqs: Requirement[] = [
      ...ROUTE_LIST.flatMap((r) => r.requires),
      ...REGION_LIST.flatMap((r) => r.requires),
      ...ACTION_LIST.flatMap((a) => a.requires ?? []),
      ...UPGRADE_LIST.flatMap((u) => u.levels.flatMap((l) => l.requires ?? [])),
      ...CONTRACT_LIST.flatMap((c) => c.requires),
    ];
    for (const q of reqs) if (q.type === 'flag') expect(flagSources.has(q.flag), q.flag).toBe(true);
    const learnable = new Set<string>();
    DISCOVERY_LIST.forEach((d) => d.grants.recipes?.forEach((r) => learnable.add(r)));
    CONTRACT_LIST.forEach((c) => c.reward.recipes?.forEach((r) => learnable.add(r)));
    for (const r of RECIPE_LIST) if (r.known === false) expect(learnable.has(r.id), r.id).toBe(true);
    const recruits = new Set(CONTRACT_LIST.map((c) => c.reward.recruit).filter(Boolean));
    for (const h of HERO_LIST) if (h.recruitHint) expect(recruits.has(h.id), h.id).toBe(true);
  });
});
