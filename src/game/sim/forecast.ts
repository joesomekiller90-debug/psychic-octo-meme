// Expedition forecast: runs the real expedition resolver on throwaway copies
// with fixed seeds, so the preview reflects the actual rules, gear and tactics.
import { ENEMIES } from '../data/enemies';
import { DISCOVERY_LIST, DRIFTS, ROUTES } from '../data/world';
import { createExpedition, resolveLeg, returnDuration, totalDuration } from './expedition';
import { hash32 } from './rng';
import { intelLevel, RISKS } from './rules';
import type { GameState, PlanDraft } from './state';

export interface Forecast {
  samples: number;
  success: number;
  retreat: number;
  defeat: number;
  band: number;
  duration: { min: number; max: number; full: number };
  marks: { avg: number; min: number; max: number };
  loot: { item: string; avg: number; chance: number }[];
  leftBehind: number;
  hpEnd: number;
  fights: number;
  used: { item: string; avg: number }[];
  threats: { enemy: string; chance: number; finale: boolean; known: boolean }[];
  hazards: { id: string; chance: number }[];
  discoveries: { id: string; name: string; chance: number; once: boolean; found: boolean; rare: boolean; finalLeg: boolean }[];
  readiness: 'ready' | 'risky' | 'dangerous' | 'reckless';
  drift: string;
}

export function forecastExpedition(state: GameState, plan: PlanDraft, time: number, samples = 32): Forecast | null {
  const route = ROUTES[plan.routeId];
  if (!route) return null;
  const members = state.party.members.filter((m) => state.heroes[m]?.recruited);
  if (members.length === 0) return null;

  let success = 0;
  let retreat = 0;
  let defeat = 0;
  let marksSum = 0;
  let marksMin = Infinity;
  let marksMax = 0;
  let hpSum = 0;
  let fights = 0;
  let left = 0;
  let durMin = Infinity;
  let durMax = 0;
  let full = 0;
  const loot: Record<string, { sum: number; hits: number }> = {};
  const used: Record<string, number> = {};
  let drift = 'clear';

  for (let s = 0; s < samples; s++) {
    const seed = hash32(0xf0e, s, state.worldSeed & 0xffff);
    const exp = createExpedition(state, plan, time, seed, 1, 0);
    drift = exp.drift;
    full = totalDuration(exp);
    while (exp.leg < exp.legs.length && !exp.outcome) resolveLeg(state, exp);
    const outcome = exp.outcome ?? 'success';
    if (outcome === 'success') success++;
    else if (outcome === 'retreat') retreat++;
    else defeat++;
    const dur = outcome === 'success' ? totalDuration(exp) : exp.legs.slice(0, exp.leg).reduce((a, b) => a + b, 0) + returnDuration(exp);
    durMin = Math.min(durMin, dur);
    durMax = Math.max(durMax, dur);
    const mid = (route.marks[0] + route.marks[1]) / 2;
    const m = Math.round((exp.marks + (outcome === 'success' ? mid : 0)) * exp.mods.marks * (outcome === 'success' ? 1 : 0.5));
    marksSum += m;
    marksMin = Math.min(marksMin, m);
    marksMax = Math.max(marksMax, m);
    for (const [id, n] of Object.entries(exp.pack)) {
      const kept = outcome === 'defeat' ? n - Math.ceil(n / 2) : n;
      loot[id] ??= { sum: 0, hits: 0 };
      loot[id].sum += kept;
      if (kept > 0) loot[id].hits++;
    }
    for (const n of Object.values(exp.leftBehind)) left += n;
    for (const [id, n] of Object.entries(exp.used)) used[id] = (used[id] ?? 0) + n;
    let hp = 0;
    let max = 0;
    for (const mem of exp.members) {
      hp += exp.hp[mem];
      max += exp.stats[mem].vigor;
    }
    hpSum += max ? hp / max : 0;
    fights += exp.log.filter((l) => l.kind === 'fight').length;
  }

  // Analytic threat and discovery odds for a full run.
  const risk = RISKS[plan.risk];
  const dr = DRIFTS[drift];
  const regularLegs = route.finale ? route.legs - 1 : route.legs;
  const pEnc = Math.min(0.95, route.encounterChance * risk.encounter * (1 + (dr.encounter ?? 0)));
  const totalW = route.encounters.reduce((s, e) => s + e.weight, 0);
  const enemyIds = new Set<string>();
  route.encounters.forEach((e) => e.enemies.forEach((x) => enemyIds.add(x)));
  route.finale?.enemies.forEach((x) => enemyIds.add(x));
  const threats = [...enemyIds].map((enemy) => {
    const finale = !!route.finale?.enemies.includes(enemy);
    const w = route.encounters.filter((g) => g.enemies.includes(enemy)).reduce((s, g) => s + g.weight, 0);
    const q = totalW ? (pEnc * w) / totalW : 0;
    const chance = finale ? 1 : 1 - Math.pow(1 - q, regularLegs);
    return { enemy, chance, finale, known: (state.codex.enemies[enemy]?.seen ?? 0) > 0 };
  });
  threats.sort((a, b) => Number(b.finale) - Number(a.finale) || b.chance - a.chance || (ENEMIES[b.enemy].boss ? 1 : 0) - (ENEMIES[a.enemy].boss ? 1 : 0));

  const pHaz = route.hazardChance * risk.hazard * (dr.hazard ?? 1);
  const hazards = route.hazards.map((id) => ({ id, chance: 1 - Math.pow(1 - pHaz / route.hazards.length, route.legs) }));

  const sample0 = createExpedition(state, plan, time, 1, 1, 0);
  const discoveries = DISCOVERY_LIST.filter((d) => d.route === route.id).map((d) => {
    const found = !!state.codex.discoveries[d.id];
    let chance: number;
    if (d.finalLeg) chance = success / samples;
    else {
      const p = Math.min(0.95, d.chance * sample0.mods.discovery);
      const n = route.legs - ((d.minLeg ?? 1) - 1);
      chance = 1 - Math.pow(1 - p, n);
    }
    return { id: d.id, name: d.name, chance: d.once && found ? 0 : chance, once: d.once, found, rare: !!d.rare, finalLeg: !!d.finalLeg };
  });

  const intel = intelLevel(state);
  const band = Math.max(0, 0.15 - 0.05 * (intel - 1));
  const sRate = success / samples;
  const readiness = sRate >= 0.85 ? 'ready' : sRate >= 0.6 ? 'risky' : sRate >= 0.3 ? 'dangerous' : 'reckless';

  return {
    samples,
    success: sRate,
    retreat: retreat / samples,
    defeat: defeat / samples,
    band,
    duration: { min: durMin, max: durMax, full },
    marks: { avg: Math.round(marksSum / samples), min: marksMin, max: marksMax },
    loot: Object.entries(loot)
      .map(([item, v]) => ({ item, avg: v.sum / samples, chance: v.hits / samples }))
      .filter((l) => l.avg > 0)
      .sort((a, b) => b.avg - a.avg),
    leftBehind: left / samples,
    hpEnd: hpSum / samples,
    fights: fights / samples,
    used: Object.entries(used).map(([item, n]) => ({ item, avg: n / samples })),
    threats,
    hazards,
    discoveries,
    readiness,
    drift,
  };
}
