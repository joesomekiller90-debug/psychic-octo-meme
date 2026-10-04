import type { DiscoveryDef, DriftDef, HazardDef, RegionDef, RouteDef } from '../types';

export const REGION_LIST: RegionDef[] = [
  {
    id: 'hollowmere',
    name: 'Hollowmere Fringe',
    blurb: 'Drowned birchwood and reed-fen ringing Lanternhold. The nearest lost settlement, Fenwick Stile, lies past the old ferry.',
    settlement: {
      name: 'Fenwick Stile',
      flag: 'fenwick',
      blurb: 'A reed-thatched village on stilts. Its people kept the ferry bell ringing for thirty winters, hoping someone would answer.',
    },
    requires: [],
    drift: ['clear', 'mist', 'bloom', 'quiet'],
    color: '#7fae7a',
  },
  {
    id: 'cinderscar',
    name: 'Cinderscar Highlands',
    blurb: 'A burnt plateau of slag terraces and cold kilns. Kilnmouth’s miners hold out behind their walls while furnace-hounds roam the passes.',
    settlement: {
      name: 'Kilnmouth',
      flag: 'kilnmouth',
      blurb: 'A mining town dug into the cliff. It still smelts brightiron, but has had no one to sell it to.',
    },
    requires: [{ type: 'flag', flag: 'matriarch_slain' }],
    drift: ['clear', 'ashfall', 'quiet', 'mist'],
    color: '#d08a5b',
  },
  {
    id: 'causeway',
    name: 'Drowned Causeway',
    blurb: 'The Old Concord’s great causeway, half-sunk in a brackish inland sea. Its sentinels still patrol, and something vast turns beneath the locks.',
    settlement: {
      name: 'Tollspire',
      flag: 'tollspire',
      blurb: 'A lighthouse-archive on the last dry pier, where the Concord’s records went to wait out the water.',
    },
    requires: [{ type: 'flag', flag: 'kilnmouth' }],
    drift: ['clear', 'mist', 'springtide', 'quiet'],
    color: '#5fa3b3',
  },
];

export const REGIONS: Record<string, RegionDef> = Object.fromEntries(REGION_LIST.map((r) => [r.id, r]));

export const DRIFTS: Record<string, DriftDef> = {
  clear: { id: 'clear', name: 'Clear Skies', desc: 'Settled weather. No modifiers.' },
  mist: {
    id: 'mist', name: 'Mistbound', desc: 'The Hush thickens. Journeys 15% slower, discoveries 30% likelier, and every fight is an ambush unless the party carries Light.',
    duration: 1.15, discovery: 1.3, ambush: true,
  },
  bloom: {
    id: 'bloom', name: 'Bloomtide', desc: 'Everything is flowering. Herb and food finds +50%, but beasts are out in force (+10% encounter chance).',
    herbs: 1.5, encounter: 0.1,
  },
  quiet: {
    id: 'quiet', name: 'Quiet Moon', desc: 'The wild sleeps. 40% fewer encounters, but 15% fewer finds.',
    encounter: -0.4, finds: 0.85,
  },
  ashfall: {
    id: 'ashfall', name: 'Ashfall', desc: 'Grey ash drifts from the old kilns. Hazards 50% likelier; Kilnmouth pays 25% more marks.',
    hazard: 1.5, marks: 1.25,
  },
  springtide: {
    id: 'springtide', name: 'Spring Tide', desc: 'The sea runs high over the causeway. Hazards 30% likelier, finds +25%.',
    hazard: 1.3, finds: 1.25,
  },
};

/** Real-time length of one Drift period. */
export const DRIFT_PERIOD_MS = 2 * 60 * 60 * 1000;

export const HAZARDS: Record<string, HazardDef> = {
  thornbrake: {
    id: 'thornbrake', name: 'Thornbrake', kind: 'thorns', damage: 0.05, counter: null,
    text: 'The path closes into thornbrake; the party hacks through and comes out bleeding.',
    counteredText: '',
  },
  sinking_mire: {
    id: 'sinking_mire', name: 'Sinking Mire', kind: 'mire', damage: 0.07, counter: 'rope',
    text: 'The boardwalk gives way into sucking mire. Hauling everyone out costs blood and breath.',
    counteredText: 'The boardwalk gives way, but a climbing line hauls everyone out of the mire.',
  },
  spore_cloud: {
    id: 'spore_cloud', name: 'Spore Cloud', kind: 'blight', damage: 0.09, counter: 'antidote',
    text: 'A wisp-hollow bursts, filling the air with choking spores.',
    counteredText: 'Spores burst from a wisp-hollow; an antidote keeps lungs clear.',
  },
  black_hollow: {
    id: 'black_hollow', name: 'Black Hollow', kind: 'dark', damage: 0.08, counter: 'light',
    text: 'The trail drops into a lightless hollow; the party stumbles blind over roots and stone.',
    counteredText: 'The trail drops into a lightless hollow, but a lantern shows the way through.',
  },
  rockslide: {
    id: 'rockslide', name: 'Rockslide', kind: 'fall', damage: 0.1, counter: 'rope',
    text: 'Slag terraces give way underfoot and the party tumbles down the scree.',
    counteredText: 'The terrace crumbles, but the party is roped together and nobody falls.',
  },
  ash_gust: {
    id: 'ash_gust', name: 'Ash Gust', kind: 'weather', damage: 0.07, counter: null,
    text: 'A scalding gust of kiln-ash rolls over the ridge.',
    counteredText: '',
  },
  sheer_cliff: {
    id: 'sheer_cliff', name: 'Sheer Cliff', kind: 'fall', damage: 0.13, counter: 'rope',
    text: 'The only way on is down a sheer cliff. Not everyone finds a good handhold.',
    counteredText: 'The only way on is down a sheer cliff; the party rigs a line and descends safely.',
  },
  brine_fever: {
    id: 'brine_fever', name: 'Brine Fever', kind: 'blight', damage: 0.1, counter: 'antidote',
    text: 'Brackish water gets into cuts and blisters. Fever follows.',
    counteredText: 'Brackish water gets into cuts, but an antidote stops the fever before it starts.',
  },
  rising_tide: {
    id: 'rising_tide', name: 'Rising Tide', kind: 'weather', damage: 0.09, counter: null,
    text: 'The tide surges over the causeway and the party wades chest-deep against the pull.',
    counteredText: '',
  },
  drowned_dark: {
    id: 'drowned_dark', name: 'Drowned Dark', kind: 'dark', damage: 0.1, counter: 'light',
    text: 'Inside the flooded halls it is utterly black, and the floor has holes.',
    counteredText: 'Inside the flooded halls it is utterly black, but the lantern finds every hole in the floor.',
  },
};

export const ROUTE_LIST: RouteDef[] = [
  // --- Hollowmere Fringe ------------------------------------------------------------
  {
    id: 'wildroot_trail', region: 'hollowmere', name: 'Wildroot Trail', kind: 'survey',
    blurb: 'A short loop along the fen margins east of camp. Good forage, little trouble. Somewhere along it lies a waymark to the old ferry.',
    legs: 3, legSeconds: 15, danger: 1,
    encounterChance: 0.35,
    encounters: [
      { enemies: ['bramble_wisp'], weight: 3 },
      { enemies: ['thornback_boar'], weight: 2 },
    ],
    findsPerLeg: 2, findChance: 0.75,
    finds: [
      { item: 'wildroot', min: 1, max: 3, weight: 4 },
      { item: 'fenberry', min: 2, max: 3, weight: 4 },
      { item: 'timber', min: 1, max: 2, weight: 2 },
      { item: 'road_scrap', min: 1, max: 2, weight: 2 },
    ],
    hazardChance: 0.15, hazards: ['thornbrake'],
    marks: [10, 16], heroXp: 6, scoutXp: 9,
    requires: [],
    map: { x: 34, y: 66 },
  },
  {
    id: 'reedcutters_loop', region: 'hollowmere', name: "Reedcutter's Loop", kind: 'gather',
    blurb: 'The old reed-cutters’ paths through deep fen. Rich pickings, if you have the hands to carry them.',
    legs: 4, legSeconds: 25, danger: 1,
    encounterChance: 0.3,
    encounters: [
      { enemies: ['bramble_wisp'], weight: 2 },
      { enemies: ['mire_lurker'], weight: 2 },
      { enemies: ['bramble_wisp', 'bramble_wisp'], weight: 1 },
    ],
    findsPerLeg: 3, findChance: 0.85,
    finds: [
      { item: 'reedfiber', min: 2, max: 4, weight: 4 },
      { item: 'timber', min: 1, max: 3, weight: 3 },
      { item: 'fenberry', min: 2, max: 3, weight: 3 },
      { item: 'wildroot', min: 1, max: 3, weight: 3 },
      { item: 'survey_notes', min: 1, max: 1, weight: 1 },
    ],
    hazardChance: 0.2, hazards: ['sinking_mire', 'thornbrake'],
    marks: [14, 22], heroXp: 7, scoutXp: 10,
    requires: [{ type: 'flag', flag: 'waymark_ferry' }],
    map: { x: 18, y: 78 },
  },
  {
    id: 'old_ferry_road', region: 'hollowmere', name: 'Old Ferry Road', kind: 'relight',
    blurb: 'The drowned road to Fenwick Stile. Rekindle the ferry waystone and the village is back on the map. Lurkers nest at the landing.',
    legs: 5, legSeconds: 24, danger: 2,
    encounterChance: 0.45,
    encounters: [
      { enemies: ['thornback_boar'], weight: 3 },
      { enemies: ['mire_lurker'], weight: 3 },
      { enemies: ['bramble_wisp', 'bramble_wisp'], weight: 2 },
      { enemies: ['mire_lurker', 'bramble_wisp'], weight: 2 },
    ],
    finale: {
      name: 'The Ferry Landing',
      enemies: ['mire_lurker', 'mire_lurker', 'bramble_wisp'],
      text: 'The ferry waystone stands on a sunken landing, and the water around it is full of eyes.',
    },
    findsPerLeg: 2, findChance: 0.7,
    finds: [
      { item: 'rustrock', min: 1, max: 3, weight: 3 },
      { item: 'road_scrap', min: 1, max: 3, weight: 4 },
      { item: 'timber', min: 1, max: 2, weight: 2 },
      { item: 'wildroot', min: 1, max: 2, weight: 2 },
    ],
    hazardChance: 0.25, hazards: ['sinking_mire', 'black_hollow'],
    marks: [24, 36], heroXp: 10, scoutXp: 14,
    minPorters: 1,
    requires: [{ type: 'flag', flag: 'waymark_ferry' }],
    firstClear: {
      flags: ['fenwick'],
      standing: 40,
      text: 'The ferry waystone catches and burns gold. Across the water, Fenwick Stile rings its bell in answer. The village is reconnected.',
    },
    map: { x: 50, y: 74 },
  },
  {
    id: 'matriarch_thicket', region: 'hollowmere', name: "Matriarch's Thicket", kind: 'hunt',
    blurb: 'The bramble-choked heart of the fen, and the beast that keeps it. Nothing passes north to the Cinderscar while she lives.',
    legs: 6, legSeconds: 32, danger: 3,
    encounterChance: 0.5,
    encounters: [
      { enemies: ['thornback_boar', 'thornback_boar'], weight: 2 },
      { enemies: ['bramble_wisp', 'bramble_wisp'], weight: 2 },
      { enemies: ['thornback_boar', 'bramble_wisp'], weight: 3 },
      { enemies: ['mire_lurker', 'mire_lurker'], weight: 2 },
    ],
    finale: {
      name: 'The Thorn Hollow',
      enemies: ['hollow_matriarch', 'thornback_boar'],
      text: 'The bramble parts into a hollow of bones and roots. Something enormous rises from the middle of it.',
    },
    findsPerLeg: 2, findChance: 0.65,
    finds: [
      { item: 'wildroot', min: 2, max: 3, weight: 3 },
      { item: 'fenberry', min: 2, max: 3, weight: 2 },
      { item: 'timber', min: 1, max: 3, weight: 2 },
      { item: 'boar_hide', min: 1, max: 1, weight: 1 },
    ],
    hazardChance: 0.3, hazards: ['thornbrake', 'spore_cloud'],
    marks: [40, 60], heroXp: 14, scoutXp: 18,
    requires: [{ type: 'flag', flag: 'fenwick' }, { type: 'skill', skill: 'scouting', level: 4 }],
    firstClear: {
      flags: ['matriarch_slain'],
      standing: 60,
      text: 'The Matriarch falls and the thicket seems to exhale. To the north, the ridge-road into the Cinderscar Highlands lies open.',
    },
    map: { x: 26, y: 50 },
  },

  // --- Cinderscar Highlands ---------------------------------------------------------
  {
    id: 'slagstep_terraces', region: 'cinderscar', name: 'Slagstep Terraces', kind: 'gather',
    blurb: 'Stepped slag-heaps from the old smelters, threaded with brightiron. The crawlers like it here too.',
    legs: 5, legSeconds: 48, danger: 3,
    encounterChance: 0.45,
    encounters: [
      { enemies: ['slagback_crawler'], weight: 3 },
      { enemies: ['kiln_hound', 'kiln_hound', 'kiln_hound'], weight: 2 },
      { enemies: ['slagback_crawler', 'kiln_hound'], weight: 2 },
    ],
    findsPerLeg: 3, findChance: 0.8,
    finds: [
      { item: 'brightiron', min: 1, max: 3, weight: 4 },
      { item: 'coal', min: 2, max: 3, weight: 3 },
      { item: 'emberbloom', min: 1, max: 2, weight: 2 },
      { item: 'rustrock', min: 2, max: 4, weight: 2 },
    ],
    hazardChance: 0.3, hazards: ['rockslide', 'ash_gust'],
    marks: [50, 75], heroXp: 18, scoutXp: 24,
    requires: [{ type: 'region', region: 'cinderscar' }],
    map: { x: 44, y: 30 },
  },
  {
    id: 'harrier_ridge', region: 'cinderscar', name: 'Harrier Ridge', kind: 'survey',
    blurb: 'A knife-edge ridge above the kilns where the ashwings nest. Somewhere up there Kilnmouth lit a signal fire for help.',
    legs: 6, legSeconds: 50, danger: 3,
    encounterChance: 0.5,
    encounters: [
      { enemies: ['ashwing_harrier', 'ashwing_harrier'], weight: 3 },
      { enemies: ['ashwing_harrier', 'kiln_hound', 'kiln_hound'], weight: 2 },
      { enemies: ['slagback_crawler'], weight: 1 },
    ],
    findsPerLeg: 2, findChance: 0.65,
    finds: [
      { item: 'survey_notes', min: 1, max: 2, weight: 3 },
      { item: 'emberbloom', min: 1, max: 2, weight: 2 },
      { item: 'coal', min: 1, max: 3, weight: 2 },
      { item: 'harrier_plume', min: 1, max: 1, weight: 1 },
    ],
    hazardChance: 0.35, hazards: ['sheer_cliff', 'ash_gust'],
    marks: [55, 80], heroXp: 20, scoutXp: 32,
    requires: [{ type: 'region', region: 'cinderscar' }, { type: 'skill', skill: 'scouting', level: 8 }],
    map: { x: 64, y: 20 },
  },
  {
    id: 'kilnmouth_gate', region: 'cinderscar', name: 'Kilnmouth Gate', kind: 'relight',
    blurb: 'Follow the signal fire to the cliff-town of Kilnmouth. A crawler broodmother and her hounds have made a den of the gatehouse.',
    legs: 7, legSeconds: 55, danger: 4,
    encounterChance: 0.5,
    encounters: [
      { enemies: ['kiln_hound', 'kiln_hound', 'kiln_hound'], weight: 3 },
      { enemies: ['slagback_crawler', 'ashwing_harrier'], weight: 2 },
      { enemies: ['ashwing_harrier', 'ashwing_harrier'], weight: 2 },
    ],
    finale: {
      name: 'The Gatehouse',
      enemies: ['slagback_crawler', 'slagback_crawler', 'kiln_hound', 'kiln_hound'],
      text: 'The gatehouse of Kilnmouth is a den of fused slag. Two crawlers and their hounds guard the dead waystone.',
    },
    findsPerLeg: 2, findChance: 0.7,
    finds: [
      { item: 'brightiron', min: 1, max: 3, weight: 3 },
      { item: 'road_scrap', min: 2, max: 4, weight: 2 },
      { item: 'coal', min: 1, max: 3, weight: 2 },
      { item: 'hound_pelt', min: 1, max: 1, weight: 1 },
    ],
    hazardChance: 0.3, hazards: ['rockslide', 'ash_gust', 'sheer_cliff'],
    marks: [90, 130], heroXp: 26, scoutXp: 36,
    minPorters: 1,
    requires: [{ type: 'flag', flag: 'kiln_signal' }, { type: 'skill', skill: 'scouting', level: 10 }],
    firstClear: {
      flags: ['kilnmouth'],
      standing: 80,
      text: 'The Kilnmouth waystone roars alight and the cliff-town’s forges answer it one by one. Kilnmouth is reconnected, and its traders point you east toward the drowned causeway.',
    },
    map: { x: 80, y: 34 },
  },

  // --- Drowned Causeway -------------------------------------------------------------
  {
    id: 'saltmarsh_approach', region: 'causeway', name: 'Saltmarsh Approach', kind: 'gather',
    blurb: 'The landward end of the causeway, where saltsilver silts up between the pilings and relics wash ashore.',
    legs: 6, legSeconds: 62, danger: 4,
    encounterChance: 0.45,
    encounters: [
      { enemies: ['tidebound_sentinel'], weight: 3 },
      { enemies: ['brackish_siren', 'brackish_siren'], weight: 2 },
      { enemies: ['brackish_siren', 'tidebound_sentinel'], weight: 2 },
    ],
    findsPerLeg: 3, findChance: 0.8,
    finds: [
      { item: 'saltsilver', min: 1, max: 3, weight: 4 },
      { item: 'brinecap', min: 1, max: 2, weight: 3 },
      { item: 'concord_relic', min: 1, max: 1, weight: 2 },
      { item: 'road_scrap', min: 2, max: 4, weight: 2 },
    ],
    hazardChance: 0.3, hazards: ['brine_fever', 'rising_tide'],
    marks: [110, 160], heroXp: 30, scoutXp: 40,
    requires: [{ type: 'region', region: 'causeway' }],
    firstClear: {
      flags: ['tollspire_road'],
      standing: 40,
      text: 'You mark a safe channel through the saltmarsh. Tollspire’s barges can reach Lanternhold now, carrying saltsilver silt and brinecap logs for your camp.',
    },
    map: { x: 72, y: 62 },
  },
  {
    id: 'sunken_archive', region: 'causeway', name: 'Sunken Archive', kind: 'survey',
    blurb: 'A flooded Concord records-hall halfway along the causeway. Whatever opened the locks, its plans are in here.',
    legs: 7, legSeconds: 70, danger: 4,
    encounterChance: 0.5,
    encounters: [
      { enemies: ['brackish_siren', 'brackish_siren'], weight: 3 },
      { enemies: ['tidebound_sentinel', 'brackish_siren'], weight: 2 },
      { enemies: ['tidebound_sentinel', 'tidebound_sentinel'], weight: 1 },
    ],
    findsPerLeg: 2, findChance: 0.7,
    finds: [
      { item: 'concord_relic', min: 1, max: 2, weight: 3 },
      { item: 'survey_notes', min: 1, max: 3, weight: 3 },
      { item: 'saltsilver', min: 1, max: 2, weight: 2 },
      { item: 'siren_scale', min: 1, max: 1, weight: 1 },
    ],
    hazardChance: 0.35, hazards: ['drowned_dark', 'rising_tide', 'brine_fever'],
    marks: [130, 180], heroXp: 34, scoutXp: 50,
    requires: [{ type: 'region', region: 'causeway' }, { type: 'skill', skill: 'scouting', level: 14 }],
    map: { x: 86, y: 54 },
  },
  {
    id: 'drowned_engine', region: 'causeway', name: 'The Drowned Engine', kind: 'hunt',
    blurb: 'Open the sluice and descend into the lock-chamber beneath Tollspire, where the great engine still turns.',
    legs: 8, legSeconds: 80, danger: 5,
    encounterChance: 0.5,
    encounters: [
      { enemies: ['tidebound_sentinel', 'tidebound_sentinel'], weight: 2 },
      { enemies: ['brackish_siren', 'tidebound_sentinel'], weight: 3 },
      { enemies: ['brackish_siren', 'brackish_siren', 'brackish_siren'], weight: 1 },
    ],
    finale: {
      name: 'The Lock-Chamber',
      enemies: ['drowned_engine', 'tidebound_sentinel'],
      text: 'In the lock-chamber the water is warm and roaring. The Drowned Engine lifts itself on pistons as tall as trees.',
    },
    findsPerLeg: 2, findChance: 0.7,
    finds: [
      { item: 'concord_relic', min: 1, max: 2, weight: 3 },
      { item: 'saltsilver', min: 2, max: 3, weight: 3 },
      { item: 'brinecap', min: 1, max: 2, weight: 2 },
    ],
    hazardChance: 0.35, hazards: ['drowned_dark', 'rising_tide'],
    marks: [220, 300], heroXp: 45, scoutXp: 60,
    minPorters: 1,
    requires: [{ type: 'flag', flag: 'sluice_key' }, { type: 'skill', skill: 'scouting', level: 16 }],
    firstClear: {
      flags: ['tollspire', 'engine_stilled'],
      standing: 150,
      text: 'The Drowned Engine shudders, slows, and stops. Far above, the causeway locks grind shut for the first time in thirty winters, and Tollspire’s great lamp is lit. The Marches are joined again.',
    },
    map: { x: 92, y: 74 },
  },
];

export const ROUTES: Record<string, RouteDef> = Object.fromEntries(ROUTE_LIST.map((r) => [r.id, r]));

export const DISCOVERY_LIST: DiscoveryDef[] = [
  {
    id: 'ferry_waymark', name: "Ferryman's Waymark", route: 'wildroot_trail', chance: 1, once: true, finalLeg: true,
    text: 'Half-buried under bramble: a waymark carved with a ferry-boat. The old road to Fenwick Stile runs on from here, and the reed-cutters’ paths branch off to the west.',
    grants: { flags: ['waymark_ferry'], lore: 'lore_waystones' },
  },
  {
    id: 'herb_hollow', name: 'Wildroot Hollow', route: 'reedcutters_loop', chance: 0.08, once: false, rare: true,
    text: 'A sheltered hollow thick with wildroot, untouched since the Hush.',
    grants: { items: [{ item: 'wildroot', qty: 6 }, { item: 'fenberry', qty: 4 }] },
  },
  {
    id: 'surveyor_satchel', name: "Drowned Surveyor's Satchel", route: 'old_ferry_road', chance: 0.25, once: true, minLeg: 2,
    text: 'Snagged on a ferry-post: an oilskin satchel. Inside, a cracked spyglass and a Concord surveyor’s notes on grinding lenses.',
    grants: { recipes: ['build_glass'], items: [{ item: 'survey_notes', qty: 3 }] },
  },
  {
    id: 'toll_chest', name: 'Sunken Toll Chest', route: 'old_ferry_road', chance: 0.06, once: false, rare: true,
    text: 'An iron-bound toll chest lies in the shallows, its lock rusted through.',
    grants: { marks: 45, items: [{ item: 'fittings', qty: 3 }] },
  },
  {
    id: 'bramble_shrine', name: 'Bramble Shrine', route: 'matriarch_thicket', chance: 0.2, once: true,
    text: 'A ring of standing stones swallowed by thorn, carved with the oldest account of the Hush you have ever seen.',
    grants: { standing: 20, lore: 'lore_hush' },
  },
  {
    id: 'ember_grotto', name: 'Ember Grotto', route: 'slagstep_terraces', chance: 0.2, once: true,
    text: 'A cave where emberbloom grows over a warm spring. A miner’s journal by the entrance describes a salve that keeps ash off the skin.',
    grants: { recipes: ['brew_salve'], items: [{ item: 'emberbloom', qty: 4 }] },
  },
  {
    id: 'ore_cart', name: 'Abandoned Ore Cart', route: 'slagstep_terraces', chance: 0.08, once: false, rare: true,
    text: 'A tipped ore cart, still loaded, half-buried in slag.',
    grants: { items: [{ item: 'brightiron', qty: 5 }, { item: 'coal', qty: 3 }] },
  },
  {
    id: 'survey_tower', name: 'Collapsed Survey Tower', route: 'harrier_ridge', chance: 0.15, once: true,
    text: 'A Concord survey tower lies on its side. In the wreck: a spring-driven arbalest, its drawings, and a crate of survey notes.',
    grants: { recipes: ['build_arbalest'], items: [{ item: 'survey_notes', qty: 6 }, { item: 'spring_coil', qty: 1 }] },
  },
  {
    id: 'kiln_signal', name: 'Kilnmouth Signal Fire', route: 'harrier_ridge', chance: 1, once: true, finalLeg: true,
    text: 'At the ridge’s end, a cold signal brazier and a slate scratched with directions to the Kilnmouth gate. Someone has been waiting a long time.',
    grants: { flags: ['kiln_signal'] },
  },
  {
    id: 'drowned_wagon', name: 'Drowned Wagon', route: 'saltmarsh_approach', chance: 0.08, once: false, rare: true,
    text: 'A Concord supply wagon lies on its side in the silt, still packed with crated mechanisms.',
    grants: { items: [{ item: 'concord_relic', qty: 2 }], marks: 60 },
  },
  {
    id: 'choir_stone', name: 'The Choir Stone', route: 'saltmarsh_approach', chance: 0.15, once: true,
    text: 'A pillar on which the sirens have scratched their song, over and over. Tamsin copies it down.',
    grants: { standing: 25, lore: 'lore_sirens' },
  },
  {
    id: 'concord_schematics', name: 'Concord Schematics', route: 'sunken_archive', chance: 0.2, once: true, minLeg: 3,
    text: 'A sealed map-case of engineering plates: how the sentinels were shelled, and how to cut that shell into armor.',
    grants: { recipes: ['build_plating'], items: [{ item: 'survey_notes', qty: 6 }] },
  },
  {
    id: 'sluice_key', name: "Tollkeeper's Sluice Key", route: 'sunken_archive', chance: 1, once: true, finalLeg: true,
    text: 'In the archive’s last room, chained to the drowned tollkeeper’s desk: the key to the engine sluice.',
    grants: { flags: ['sluice_key'], lore: 'lore_engine' },
  },
];

export const DISCOVERIES: Record<string, DiscoveryDef> = Object.fromEntries(DISCOVERY_LIST.map((d) => [d.id, d]));
