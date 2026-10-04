// Balance regression: the intended setup for each stage of the game should be
// able to clear its route most of the time, and an under-prepared party should
// struggle. Uses the same forecast the player sees.
import { describe, expect, it } from 'vitest';
import { forecastExpedition } from '../src/game/sim/forecast';
import type { PlanDraft } from '../src/game/sim/state';
import { freshState, stageState, T0, type StageOpts } from './helpers';

interface Case {
  name: string;
  stage: StageOpts | null;
  plan: PlanDraft;
  min?: number;
  max?: number;
}

const r1Gear: StageOpts['gear'] = {
  brannoc: { weapon: 'rustrock_hatchet', armor: 'rustrock_mail' },
  wren: { weapon: 'reedstring_longbow', armor: 'padded_jerkin' },
  tamsin: { trinket: 'hooded_lantern', armor: 'padded_jerkin' },
};
const r1PlusGear: StageOpts['gear'] = {
  brannoc: { weapon: 'rustrock_maul', armor: 'rustrock_mail', trinket: 'heartthorn_charm' },
  wren: { weapon: 'reedstring_longbow', armor: 'padded_jerkin' },
  tamsin: { trinket: 'hooded_lantern', armor: 'rustrock_mail' },
};
const r2Gear: StageOpts['gear'] = {
  brannoc: { weapon: 'rustrock_maul', armor: 'brightiron_plate', trinket: 'heartthorn_charm' },
  wren: { weapon: 'spring_arbalest', armor: 'hound_coat', trinket: 'porters_frame' },
  tamsin: { weapon: 'lamplighter_rod', armor: 'rustrock_mail' },
  ketch: { weapon: 'brightiron_spear', armor: 'rustrock_mail' },
};
const r3Gear: StageOpts['gear'] = {
  brannoc: { weapon: 'tidesteel_saber', armor: 'sentinel_plating', trinket: 'heartthorn_charm' },
  wren: { weapon: 'spring_arbalest', armor: 'hound_coat', trinket: 'surveyors_glass' },
  tamsin: { weapon: 'lamplighter_rod', armor: 'brightiron_plate', trinket: 'porters_frame' },
  ketch: { weapon: 'brightiron_spear', armor: 'brightiron_plate', trinket: 'heartthorn_charm' },
};

const plan = (routeId: string, supplies: Record<string, number>, porters = 1): PlanDraft => ({ routeId, supplies, porters, risk: 'standard', repeat: 0 });

const cases: Case[] = [
  { name: 'Wildroot Trail, fresh start', stage: null, plan: plan('wildroot_trail', { trail_ration: 3, mending_tonic: 2 }), min: 0.9 },
  {
    name: 'Old Ferry Road, starting gear lvl 2', stage: { level: 2, gear: {}, flags: ['waymark_ferry'] },
    plan: plan('old_ferry_road', { trail_ration: 5, mending_tonic: 2 }), min: 0.5, max: 0.95,
  },
  {
    name: 'Old Ferry Road, crafted gear lvl 3', stage: { level: 3, gear: r1Gear, flags: ['waymark_ferry'], inventory: { mending_tonic: 4, antidote: 2 } },
    plan: plan('old_ferry_road', { trail_ration: 5, mending_tonic: 3, antidote: 1 }), min: 0.85,
  },
  {
    name: "Matriarch's Thicket, crafted gear lvl 5", stage: { level: 5, gear: r1Gear, flags: ['waymark_ferry', 'fenwick'], skills: { scouting: 4 }, inventory: { mending_tonic: 6, antidote: 3, fire_flask: 1 } },
    plan: plan('matriarch_thicket', { trail_ration: 6, mending_tonic: 5, antidote: 2, fire_flask: 1 }), min: 0.7,
  },
  {
    name: "Matriarch's Thicket, starting gear lvl 3", stage: { level: 3, gear: {}, flags: ['waymark_ferry', 'fenwick'], skills: { scouting: 4 } },
    plan: plan('matriarch_thicket', { trail_ration: 6, mending_tonic: 2 }), max: 0.3,
  },
  {
    name: 'Slagstep Terraces, R1 gear + maul lvl 6', stage: { level: 6, gear: r1PlusGear, flags: ['waymark_ferry', 'fenwick', 'matriarch_slain'], skills: { scouting: 6 }, inventory: { mending_tonic: 6, climbing_kit: 2 } },
    plan: plan('slagstep_terraces', { trail_ration: 5, mending_tonic: 4, climbing_kit: 2 }, 2), min: 0.6,
  },
  {
    name: 'Harrier Ridge, R1 gear + maul lvl 7', stage: { level: 7, gear: r1PlusGear, flags: ['waymark_ferry', 'fenwick', 'matriarch_slain'], skills: { scouting: 8 }, inventory: { mending_tonic: 6, climbing_kit: 2 } },
    plan: plan('harrier_ridge', { trail_ration: 6, mending_tonic: 5, climbing_kit: 2 }, 1), min: 0.5,
  },
  {
    name: 'Kilnmouth Gate, R2 gear lvl 9', stage: { level: 9, gear: r2Gear, recruits: ['ketch'], party: ['brannoc', 'ketch', 'tamsin'], rows: { ketch: 'front' }, flags: ['waymark_ferry', 'fenwick', 'matriarch_slain', 'kiln_signal'], skills: { scouting: 10 }, inventory: { mending_tonic: 6, greater_tonic: 2, climbing_kit: 2, fire_flask: 2 } },
    plan: plan('kilnmouth_gate', { trail_ration: 7, mending_tonic: 4, greater_tonic: 2, climbing_kit: 2, fire_flask: 1 }, 1), min: 0.7,
  },
  {
    name: 'Saltmarsh Approach, R2 gear lvl 11', stage: { level: 11, gear: r2Gear, recruits: ['ketch', 'sela'], party: ['brannoc', 'ketch', 'tamsin'], rows: { ketch: 'front' }, flags: ['waymark_ferry', 'fenwick', 'matriarch_slain', 'kiln_signal', 'kilnmouth'], skills: { scouting: 12 }, inventory: { greater_tonic: 4, mending_tonic: 4, antidote: 3, steadying_draught: 2 } },
    plan: plan('saltmarsh_approach', { trail_ration: 6, greater_tonic: 3, mending_tonic: 3, antidote: 2, steadying_draught: 2 }, 2), min: 0.6,
  },
  {
    name: 'Drowned Engine, R3 gear lvl 14', stage: { level: 14, gear: r3Gear, recruits: ['ketch', 'sela'], party: ['brannoc', 'ketch', 'tamsin'], rows: { ketch: 'front' }, flags: ['waymark_ferry', 'fenwick', 'matriarch_slain', 'kiln_signal', 'kilnmouth', 'sluice_key'], skills: { scouting: 16 }, inventory: { greater_tonic: 6, mending_tonic: 4, antidote: 3, steadying_draught: 3, fire_flask: 2, warding_salve: 1 } },
    plan: plan('drowned_engine', { trail_ration: 8, greater_tonic: 5, mending_tonic: 3, antidote: 2, steadying_draught: 3, fire_flask: 2, warding_salve: 1 }, 2), min: 0.55,
  },
  {
    name: 'Drowned Engine, R2 gear lvl 11 (under-prepared)', stage: { level: 11, gear: r2Gear, recruits: ['ketch', 'sela'], party: ['brannoc', 'ketch', 'tamsin'], rows: { ketch: 'front' }, flags: ['waymark_ferry', 'fenwick', 'matriarch_slain', 'kiln_signal', 'kilnmouth', 'sluice_key'], skills: { scouting: 16 }, inventory: { greater_tonic: 2, mending_tonic: 4 } },
    plan: plan('drowned_engine', { trail_ration: 8, greater_tonic: 2, mending_tonic: 4 }, 2), max: 0.3,
  },
];

describe('balance', () => {
  const rows: Record<string, unknown>[] = [];
  for (const c of cases) {
    it(c.name, () => {
      const s = c.stage ? stageState(c.stage) : freshState();
      s.plan = c.plan;
      const f = forecastExpedition(s, c.plan, T0, 60)!;
      rows.push({ case: c.name, success: f.success.toFixed(2), retreat: f.retreat.toFixed(2), defeat: f.defeat.toFixed(2), hpEnd: f.hpEnd.toFixed(2), marks: f.marks.avg });
      if (c.min !== undefined) expect(f.success).toBeGreaterThanOrEqual(c.min);
      if (c.max !== undefined) expect(f.success).toBeLessThanOrEqual(c.max);
    });
  }
  it('prints table', () => {
    if (process.env.BALANCE) process.stdout.write(rows.map((r) => Object.values(r).join(' | ')).join('\n') + '\n');
  });
});
