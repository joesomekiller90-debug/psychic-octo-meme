import type { ContractDef, DoctrineDef, LoreDef, RankDef, UpgradeDef } from '../types';

export const UPGRADE_LIST: UpgradeDef[] = [
  {
    id: 'bunkhouse', name: 'Bunkhouse', icon: 'bunk',
    desc: 'Bunks for more camp hands. Hands crew work orders and carry packs as porters.',
    levels: [
      { marks: 60, items: [{ item: 'braced_beam', qty: 2 }, { item: 'reedfiber', qty: 4 }], seconds: 40, effect: '4 camp hands' },
      { marks: 220, items: [{ item: 'braced_beam', qty: 4 }, { item: 'iron_brackets', qty: 4 }], seconds: 120, effect: '5 camp hands',
        requires: [{ type: 'flag', flag: 'fenwick' }] },
      { marks: 650, items: [{ item: 'braced_beam', qty: 6 }, { item: 'iron_brackets', qty: 6 }, { item: 'hound_pelt', qty: 4 }], seconds: 240, effect: '6 camp hands',
        requires: [{ type: 'flag', flag: 'kilnmouth' }] },
    ],
  },
  {
    id: 'storehouse', name: 'Storehouse', icon: 'crate',
    desc: 'More room for stockpiles. Gathering pauses when a stack is full; expedition overflow is sold at half value.',
    levels: [
      { marks: 40, items: [{ item: 'timber', qty: 8 }, { item: 'braced_beam', qty: 1 }], seconds: 30, effect: 'Stacks hold 200' },
      { marks: 200, items: [{ item: 'braced_beam', qty: 3 }, { item: 'iron_brackets', qty: 3 }], seconds: 90, effect: 'Stacks hold 400' },
      { marks: 600, items: [{ item: 'braced_beam', qty: 5 }, { item: 'iron_brackets', qty: 4 }, { item: 'slag_plate', qty: 4 }], seconds: 180, effect: 'Stacks hold 800',
        requires: [{ type: 'region', region: 'cinderscar' }] },
    ],
  },
  {
    id: 'infirmary', name: 'Infirmary', icon: 'heart',
    desc: 'Cots and clean water. Wayfarers resting in camp recover faster.',
    levels: [
      { marks: 50, items: [{ item: 'wildroot', qty: 8 }, { item: 'braced_beam', qty: 1 }], seconds: 35, effect: 'Healing 50% faster' },
      { marks: 220, items: [{ item: 'mending_tonic', qty: 4 }, { item: 'braced_beam', qty: 2 }], seconds: 90, effect: 'Healing 100% faster' },
      { marks: 550, items: [{ item: 'greater_tonic', qty: 2 }, { item: 'iron_brackets', qty: 4 }], seconds: 180, effect: 'Healing 150% faster',
        requires: [{ type: 'region', region: 'cinderscar' }] },
    ],
  },
  {
    id: 'forge', name: 'Forge', icon: 'anvil',
    desc: 'A proper forge with a bellows. Needed for brightiron and tidesteel work.',
    levels: [
      { marks: 120, items: [{ item: 'iron_brackets', qty: 5 }, { item: 'braced_beam', qty: 2 }, { item: 'coal', qty: 6 }], seconds: 60,
        effect: 'Smithing 10% faster; brightiron recipes',
        requires: [{ type: 'skill', skill: 'smithing', level: 5 }] },
      { marks: 450, items: [{ item: 'brightiron', qty: 10 }, { item: 'iron_brackets', qty: 4 }, { item: 'spring_coil', qty: 2 }], seconds: 180,
        effect: 'Smithing 20% faster; tidesteel recipes',
        requires: [{ type: 'flag', flag: 'kilnmouth' }] },
    ],
  },
  {
    id: 'still_room', name: 'Still Room', icon: 'flask',
    desc: 'Copper stills and drying racks. Faster brewing and a chance of an extra batch.',
    levels: [
      { marks: 100, items: [{ item: 'wildroot', qty: 10 }, { item: 'fenberry', qty: 8 }, { item: 'braced_beam', qty: 2 }], seconds: 60,
        effect: 'Alchemy 10% faster, 10% chance of extra output; greater tonics',
        requires: [{ type: 'skill', skill: 'alchemy', level: 5 }] },
      { marks: 400, items: [{ item: 'emberbloom', qty: 8 }, { item: 'spring_coil', qty: 2 }, { item: 'iron_brackets', qty: 3 }], seconds: 180,
        effect: 'Alchemy 20% faster, 20% chance of extra output',
        requires: [{ type: 'region', region: 'cinderscar' }] },
    ],
  },
  {
    id: 'engineers_loft', name: "Engineer's Loft", icon: 'cog',
    desc: 'A workshop loft with a lathe. Needed for advanced engineering.',
    levels: [
      { marks: 140, items: [{ item: 'braced_beam', qty: 3 }, { item: 'fittings', qty: 6 }, { item: 'iron_brackets', qty: 2 }], seconds: 70,
        effect: 'Engineering 10% faster; coats, rods and arbalests',
        requires: [{ type: 'skill', skill: 'engineering', level: 6 }] },
      { marks: 480, items: [{ item: 'spring_coil', qty: 4 }, { item: 'concord_gear', qty: 1 }, { item: 'braced_beam', qty: 4 }], seconds: 180,
        effect: 'Engineering 20% faster; sentinel plating',
        requires: [{ type: 'region', region: 'causeway' }] },
    ],
  },
  {
    id: 'cartographer', name: "Cartographer's Table", icon: 'map',
    desc: 'Maps pinned under glass. Better intelligence before dispatch and more discoveries on the road.',
    levels: [
      { marks: 70, items: [{ item: 'survey_notes', qty: 6 }, { item: 'braced_beam', qty: 1 }], seconds: 45,
        effect: 'Intel +1, discoveries +10%' },
      { marks: 260, items: [{ item: 'survey_notes', qty: 16 }, { item: 'spring_coil', qty: 1 }], seconds: 120,
        effect: 'Intel +2, discoveries +20%', requires: [{ type: 'flag', flag: 'fenwick' }] },
      { marks: 700, items: [{ item: 'survey_notes', qty: 30 }, { item: 'concord_gear', qty: 1 }], seconds: 240,
        effect: 'Intel +3, discoveries +30%', requires: [{ type: 'region', region: 'causeway' }] },
    ],
  },
  {
    id: 'signal_beacon', name: 'Signal Beacon', icon: 'beacon',
    desc: 'A beacon tower that guides parties home and keeps the camp working through the night.',
    levels: [
      { marks: 140, items: [{ item: 'braced_beam', qty: 3 }, { item: 'iron_brackets', qty: 3 }, { item: 'coal', qty: 6 }], seconds: 60,
        effect: 'Offline limit 12h, expeditions 5% faster', requires: [{ type: 'flag', flag: 'fenwick' }] },
      { marks: 450, items: [{ item: 'braced_beam', qty: 4 }, { item: 'brightiron', qty: 8 }, { item: 'coal', qty: 10 }], seconds: 150,
        effect: 'Offline limit 16h, expeditions 10% faster', requires: [{ type: 'flag', flag: 'kilnmouth' }] },
      { marks: 900, items: [{ item: 'concord_gear', qty: 2 }, { item: 'saltsilver', qty: 8 }, { item: 'braced_beam', qty: 4 }], seconds: 240,
        effect: 'Offline limit 20h, expeditions 15% faster', requires: [{ type: 'flag', flag: 'tollspire_road' }] },
    ],
  },
  {
    id: 'depot', name: "Quartermaster's Depot", icon: 'pack',
    desc: 'Pack racks, mules and better harness. Every expedition carries more.',
    levels: [
      { marks: 70, items: [{ item: 'braced_beam', qty: 2 }, { item: 'reedfiber', qty: 6 }], seconds: 40, effect: 'Carry +6 per expedition' },
      { marks: 280, items: [{ item: 'hound_pelt', qty: 3 }, { item: 'iron_brackets', qty: 4 }, { item: 'braced_beam', qty: 2 }], seconds: 120,
        effect: 'Carry +12 per expedition', requires: [{ type: 'region', region: 'cinderscar' }] },
    ],
  },
];

export const UPGRADES = Object.fromEntries(UPGRADE_LIST.map((u) => [u.id, u]));

export const SETTLEMENT_GIVERS: Record<string, { name: string; role: string }> = {
  lanternhold: { name: 'Odile Pell', role: 'Quartermaster of Lanternhold' },
  fenwick: { name: 'Reeve Maudie Fallow', role: 'Reeve of Fenwick Stile' },
  kilnmouth: { name: 'Forewoman Ysolt Barrow', role: 'Kilnmouth Forewoman' },
  tollspire: { name: 'Archivist Corvin Ash', role: 'Keeper of Tollspire' },
};

export const CONTRACT_LIST: ContractDef[] = [
  {
    id: 'first_light', giver: 'lanternhold', settlement: 'Lanternhold', title: 'First Light on the Trail',
    text: 'Walk the Wildroot Trail and come back in one piece. Everything starts with knowing the way out of camp.',
    requires: [], goal: { type: 'route', route: 'wildroot_trail', count: 1 },
    reward: { marks: 40, standing: 10, items: [{ item: 'mending_tonic', qty: 2 }] },
  },
  {
    id: 'stock_larder', giver: 'lanternhold', settlement: 'Lanternhold', title: 'Stock the Larder',
    text: 'The camp stores are thin. Hand in fenberries so the cooks can put up rations for the road.',
    requires: [{ type: 'route', route: 'wildroot_trail' }], goal: { type: 'deliver', item: 'fenberry', qty: 12 },
    reward: { marks: 30, standing: 10, items: [{ item: 'trail_ration', qty: 6 }] },
  },
  {
    id: 'warden_steel', giver: 'lanternhold', settlement: 'Lanternhold', title: 'Steel for the Warden',
    text: 'Brannoc has been fighting with a wood-hatchet. Forge him something better.',
    requires: [{ type: 'route', route: 'wildroot_trail' }], goal: { type: 'craft', item: 'rustrock_hatchet', count: 1 },
    reward: { marks: 45, standing: 10, items: [{ item: 'iron_brackets', qty: 2 }] },
  },
  {
    id: 'raise_rafters', giver: 'lanternhold', settlement: 'Lanternhold', title: 'Raise the Rafters',
    text: 'The hands are sleeping in tents. Build the Bunkhouse and we can take on more help.',
    requires: [{ type: 'route', route: 'wildroot_trail' }], goal: { type: 'upgrade', upgrade: 'bunkhouse', level: 1 },
    reward: { marks: 50, standing: 15, items: [{ item: 'braced_beam', qty: 1 }] },
  },
  {
    id: 'ferry_stone', giver: 'lanternhold', settlement: 'Lanternhold', title: 'Rekindle the Ferry Stone',
    text: 'Fenwick Stile has been ringing its bell for thirty years. Take the Old Ferry Road and relight the waystone.',
    requires: [{ type: 'flag', flag: 'waymark_ferry' }], goal: { type: 'route', route: 'old_ferry_road', count: 1 },
    reward: { marks: 100, standing: 20 },
  },
  {
    id: 'fenwick_fever', giver: 'fenwick', settlement: 'Fenwick Stile', title: 'Fever in Fenwick',
    text: 'Half the village is down with marsh-fever. Bring mending tonics, and our herbwife will teach you to brew antidotes.',
    requires: [{ type: 'flag', flag: 'fenwick' }], goal: { type: 'deliver', item: 'mending_tonic', qty: 4 },
    reward: { marks: 120, standing: 25, recipes: ['brew_antidote'], items: [{ item: 'antidote', qty: 3 }] },
  },
  {
    id: 'sapper_for_hire', giver: 'fenwick', settlement: 'Fenwick Stile', title: 'A Sapper for Hire',
    text: 'Our old quarry-blaster, Ketch, wants work. Send fittings for their kit and they will walk to Lanternhold.',
    requires: [{ type: 'flag', flag: 'fenwick' }], goal: { type: 'deliver', item: 'fittings', qty: 6 },
    reward: { standing: 20, recruit: 'ketch' },
  },
  {
    id: 'cull_thornbacks', giver: 'fenwick', settlement: 'Fenwick Stile', title: 'Cull the Thornbacks',
    text: 'Thornback boars are rooting up our dikes. Thin them out.',
    requires: [{ type: 'flag', flag: 'fenwick' }], goal: { type: 'defeat', enemy: 'thornback_boar', count: 5 },
    reward: { marks: 90, standing: 20, items: [{ item: 'boar_hide', qty: 2 }] },
  },
  {
    id: 'the_matriarch', giver: 'fenwick', settlement: 'Fenwick Stile', title: 'The Matriarch of Hollowmere',
    text: 'The great sow in the thicket breeds the boars and the wisps both. End her and the north road opens.',
    requires: [{ type: 'flag', flag: 'fenwick' }], goal: { type: 'defeat', enemy: 'hollow_matriarch', count: 1 },
    reward: { marks: 220, standing: 40, recipes: ['brew_charm'] },
  },
  {
    id: 'stillroom_ledger', giver: 'lanternhold', settlement: 'Lanternhold', title: "The Still Room's Ledger",
    text: 'A guild that cannot brew cannot travel. Train an alchemist worth the name.',
    requires: [{ type: 'flag', flag: 'fenwick' }], goal: { type: 'skill', skill: 'alchemy', level: 10 },
    reward: { marks: 120, standing: 25, items: [{ item: 'fire_flask', qty: 2 }] },
  },
  {
    id: 'ore_for_kilns', giver: 'kilnmouth', settlement: 'Kilnmouth', title: 'Ore for the Kilns',
    text: 'Our furnaces are cold for want of brightiron. Bring us ore, and our smiths will teach yours to forge plate.',
    requires: [{ type: 'flag', flag: 'kilnmouth' }], goal: { type: 'deliver', item: 'brightiron', qty: 15 },
    reward: { marks: 260, standing: 40, recipes: ['forge_plate'] },
  },
  {
    id: 'clear_ridge', giver: 'kilnmouth', settlement: 'Kilnmouth', title: 'Clear the Ridge',
    text: 'The ashwings take our goats and our children’s courage. Drive them off Harrier Ridge.',
    requires: [{ type: 'region', region: 'cinderscar' }], goal: { type: 'defeat', enemy: 'ashwing_harrier', count: 6 },
    reward: { marks: 220, standing: 35, items: [{ item: 'spring_coil', qty: 2 }] },
  },
  {
    id: 'ridge_runner', giver: 'kilnmouth', settlement: 'Kilnmouth', title: 'The Ridge-Runner',
    text: 'Sela Dunmore ran our passes for ten years. She will join a guild that knows the land. Prove yours does.',
    requires: [{ type: 'flag', flag: 'kilnmouth' }], goal: { type: 'skill', skill: 'scouting', level: 12 },
    reward: { standing: 30, recruit: 'sela' },
  },
  {
    id: 'archive_gears', giver: 'tollspire', settlement: 'Tollspire', title: 'Gears for the Archive',
    text: 'The archive’s orrery has stopped. Bring Concord gears and I will share the old tidesteel formulae.',
    requires: [{ type: 'region', region: 'causeway' }], goal: { type: 'deliver', item: 'concord_gear', qty: 3 },
    reward: { marks: 400, standing: 50, recipes: ['forge_saber'] },
  },
  {
    id: 'still_the_engine', giver: 'tollspire', settlement: 'Tollspire', title: 'Still the Drowned Engine',
    text: 'The engine beneath the locks is what drowned the causeway. Stop it, and the Marches are whole again.',
    requires: [{ type: 'region', region: 'causeway' }], goal: { type: 'defeat', enemy: 'drowned_engine', count: 1 },
    reward: { marks: 800, standing: 120 },
  },
  {
    id: 'master_smith', giver: 'kilnmouth', settlement: 'Kilnmouth', title: 'A Smith Worth the Name',
    text: 'Kilnmouth will sell to any guild, but it only trusts one whose smith can work brightiron.',
    requires: [{ type: 'region', region: 'cinderscar' }], goal: { type: 'craft', item: 'brightiron_spear', count: 1 },
    reward: { marks: 200, standing: 30, items: [{ item: 'coal', qty: 10 }] },
  },
];

export const CONTRACTS = Object.fromEntries(CONTRACT_LIST.map((c) => [c.id, c]));

export const RANKS: RankDef[] = [
  { rank: 0, name: 'Lamplighters', standing: 0, perk: 'A new guild with one lit waystone.' },
  { rank: 1, name: 'Waymakers', standing: 60, perk: '+10% marks from expeditions.' },
  { rank: 2, name: 'Roadwardens', standing: 160, perk: 'Pledge your first Doctrine.', doctrineTier: 1 },
  { rank: 3, name: 'Pathkeepers', standing: 320, perk: '+15% wayfarer experience.' },
  { rank: 4, name: 'Marchwardens', standing: 520, perk: 'Pledge your second Doctrine.', doctrineTier: 2 },
  { rank: 5, name: 'Keepers of the Compact', standing: 800, perk: '+10% experience in all skills.' },
];

export const DOCTRINES: DoctrineDef[] = [
  { id: 'pathwrights', tier: 1, name: 'Pathwrights', desc: 'Expeditions 10% faster and discoveries 15% likelier.' },
  { id: 'hearthkeepers', tier: 1, name: 'Hearthkeepers', desc: 'Camp work orders 15% faster.' },
  { id: 'shieldbound', tier: 2, name: 'Shieldbound', desc: 'Wayfarers gain +15% Vigor and +15% Guard.' },
  { id: 'wildwise', tier: 2, name: 'Wildwise', desc: 'Expeditions find 25% more materials.' },
  { id: 'emberhands', tier: 2, name: 'Emberhands', desc: 'Crafting recipes have a 15% chance to produce an extra batch.' },
];

export const REPLEDGE_COST = 250;

export const LORE: Record<string, LoreDef> = {
  lore_compact: {
    id: 'lore_compact',
    title: 'The Lantern Compact',
    text: 'Thirty winters ago the Hush rolled over the Marches: a creeping fog that sang. Where it passed, roads forgot where they went, and the wild learned to move. Settlements survived behind their walls, but the ways between them were lost. Lanternhold was built around the last waystone that would still burn. The Compact is what remains of the people who kept it lit.',
  },
  lore_waystones: {
    id: 'lore_waystones',
    title: 'On Waystones',
    text: 'The Old Concord set a waystone at every crossing. Lit, they hold a road in place against the Drift; dark, the land wanders. Relighting a waystone takes a party, a porter with kindling, and whatever is living around it to be dealt with.',
  },
  lore_hush: {
    id: 'lore_hush',
    title: 'The Bramble Shrine Account',
    text: '"It came up out of the Causeway sea in the year the locks opened. First the singing, then the fog, then the roads were gone." The carving ends with a list of names, and the words: we kept the lamps, we kept the lamps.',
  },
  lore_sirens: {
    id: 'lore_sirens',
    title: 'The Choir Stone',
    text: 'The sirens’ song repeats the same phrase in a dozen keys. Tamsin thinks it is a Concord lock-signal: the call that opened the causeway gates, still being sung by things that remember nothing else.',
  },
  lore_engine: {
    id: 'lore_engine',
    title: 'The Tollkeeper’s Log',
    text: 'The last page: "The engine will not answer the key. It is running the old flood-pattern, over and over, and the sea follows it. If anyone reads this, the sluice opens from above. Bring light. Bring everyone."',
  },
};
