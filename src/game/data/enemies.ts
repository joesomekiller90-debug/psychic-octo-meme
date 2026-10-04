import type { EnemyDef } from '../types';

const list: EnemyDef[] = [
  // --- Hollowmere Fringe ----------------------------------------------------
  {
    id: 'bramble_wisp', name: 'Bramble Wisp', region: 'hollowmere',
    hp: 24, might: 7, guard: 0, speed: 9, xp: 5, marks: 1,
    traits: ['spore', 'ranged'],
    loot: [{ item: 'wisp_dust', chance: 0.6, min: 1, max: 1 }],
    desc: 'A drifting knot of thorns and glowing spores.',
    behavior: [
      'Spore Puff: every second action it poisons a wayfarer (2 damage per action for 3 actions).',
      'Ranged: prefers to strike the back row.',
    ],
    counter: 'Antidotes cure poison instantly. Fragile: focus it down.',
  },
  {
    id: 'thornback_boar', name: 'Thornback Boar', region: 'hollowmere',
    hp: 70, might: 13, guard: 2, speed: 7, xp: 9, marks: 2,
    traits: ['charge'],
    loot: [{ item: 'boar_hide', chance: 0.5, min: 1, max: 1 }],
    desc: 'A bristling fen boar with a back like a hedge.',
    behavior: ['Charge: every third action it charges the front row for double damage. It lowers its head the action before.'],
    counter: 'High Guard on the front row blunts the charge. Slow, so fast attackers get many shots in.',
  },
  {
    id: 'mire_lurker', name: 'Mire Lurker', region: 'hollowmere',
    hp: 42, might: 11, guard: 1, speed: 11, xp: 8, marks: 2,
    traits: ['ambush'],
    loot: [{ item: 'road_scrap', chance: 0.5, min: 1, max: 2 }],
    desc: 'Something long and pale that waits under the duckweed.',
    behavior: ['Ambush: its first strike hits the back row for double damage, unless the party carries Light.'],
    counter: 'A lantern (Light) spoils the ambush. Keep fragile allies healthy.',
  },
  {
    id: 'hollow_matriarch', name: 'Hollowmere Matriarch', region: 'hollowmere', boss: true,
    hp: 420, might: 20, guard: 4, speed: 8, xp: 70, marks: 40,
    traits: ['charge', 'enrage', 'summon'], summon: 'bramble_wisp',
    loot: [
      { item: 'matriarch_thorn', chance: 1, min: 1, max: 1 },
      { item: 'boar_hide', chance: 1, min: 2, max: 3 },
    ],
    desc: 'A vast thornback sow grown through with living bramble. The fen bends around her.',
    behavior: [
      'Charge: every third action, double damage to the front row.',
      'Brood Call: at half health she summons two Bramble Wisps.',
      'Enrage: at half health her Might rises by 50%.',
    ],
    counter: 'Bring tonics and antidotes. A sturdy front line and steady healing outlast her.',
  },

  // --- Cinderscar Highlands -----------------------------------------------------
  {
    id: 'slagback_crawler', name: 'Slagback Crawler', region: 'cinderscar',
    hp: 170, might: 28, guard: 10, speed: 7, xp: 16, marks: 4,
    traits: ['armored'],
    loot: [{ item: 'slag_plate', chance: 0.75, min: 1, max: 2 }],
    desc: 'A kiln-heated beetle the size of a cart, shelled in fused slag.',
    behavior: ['Armored: Guard 8 shrugs off weak blows (every hit still deals at least 30%).'],
    counter: 'Pierce (mauls, spears) and Ketch’s Blast Charge cut through its shell.',
  },
  {
    id: 'kiln_hound', name: 'Kiln Hound', region: 'cinderscar',
    hp: 60, might: 20, guard: 2, speed: 14, xp: 7, marks: 2,
    traits: ['pack', 'frenzy'],
    loot: [{ item: 'hound_pelt', chance: 0.35, min: 1, max: 1 }],
    desc: 'Lean, ash-grey hounds that run hot enough to scorch grass.',
    behavior: [
      'Pack: travels in threes and acts very quickly.',
      'Frenzy: each time a packmate falls, the others gain +2 Might.',
    ],
    counter: 'Area damage (Blast Charge, Fire Flasks) thins the pack before it frenzies.',
  },
  {
    id: 'ashwing_harrier', name: 'Ashwing Harrier', region: 'cinderscar',
    hp: 75, might: 25, guard: 3, speed: 13, xp: 12, marks: 3,
    traits: ['flying', 'dive'],
    loot: [{ item: 'harrier_plume', chance: 0.5, min: 1, max: 1 }],
    desc: 'A grey raptor that rides the kiln-heat high above the ridges.',
    behavior: [
      'Flying: dodges 40% of attacks from non-ranged weapons.',
      'Dive: always strikes the back row while anyone stands there.',
    ],
    counter: 'Bows and arbalests (Ranged) never miss it. Armor your back row.',
  },

  // --- Drowned Causeway -------------------------------------------------------------
  {
    id: 'tidebound_sentinel', name: 'Tidebound Sentinel', region: 'causeway',
    hp: 280, might: 42, guard: 10, speed: 8, xp: 26, marks: 6,
    traits: ['shield'],
    loot: [
      { item: 'sentinel_core', chance: 0.25, min: 1, max: 1 },
      { item: 'concord_relic', chance: 0.4, min: 1, max: 1 },
    ],
    desc: 'A barnacled Concord construct still walking its patrol beneath the tide.',
    behavior: ['Tide Ward: every third action it raises a barrier that absorbs damage equal to its Might.'],
    counter: 'Many quick hits break barriers; Pierce helps against its Guard.',
  },
  {
    id: 'brackish_siren', name: 'Brackish Siren', region: 'causeway',
    hp: 120, might: 30, guard: 3, speed: 13, xp: 20, marks: 5,
    traits: ['lull', 'ranged'],
    loot: [{ item: 'siren_scale', chance: 0.5, min: 1, max: 1 }],
    desc: 'A pale shape that sings from the drowned arches.',
    behavior: [
      'Lull: every third action it sings a wayfarer to sleep (they lose their next action).',
      'Ranged: prefers to strike the back row.',
    ],
    counter: 'Focus "Threats first" to silence it. Steadying Draughts resist the Lull.',
  },
  {
    id: 'drowned_engine', name: 'The Drowned Engine', region: 'causeway', boss: true,
    hp: 1650, might: 60, guard: 12, speed: 9, xp: 320, marks: 220,
    traits: ['shield', 'vent', 'overcharge', 'armored'],
    loot: [
      { item: 'concord_gear', chance: 1, min: 3, max: 5 },
      { item: 'sentinel_core', chance: 1, min: 1, max: 2 },
    ],
    desc: 'The great tide-engine that once worked the causeway locks. When the Hush came, it opened them all.',
    behavior: [
      'Tide Ward: every third action it raises a barrier that absorbs damage equal to its Might.',
      'Steam Vent: every fourth action it scalds the whole party for 70% damage.',
      'Overcharge: below one third health it acts 50% more often.',
    ],
    counter: 'Pierce and Blast Charges for its armor; Greater Tonics and Ward for the steam.',
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((e) => [e.id, e]));
export const ENEMY_LIST = list;
