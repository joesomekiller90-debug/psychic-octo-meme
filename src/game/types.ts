// Core type definitions shared by content data, simulation and UI.

export type SkillId =
  | 'scouting'
  | 'foraging'
  | 'mining'
  | 'salvaging'
  | 'smithing'
  | 'alchemy'
  | 'engineering';

export type StatKey = 'vigor' | 'might' | 'guard' | 'speed';
export type Stats = Record<StatKey, number>;

export type IconName = string;

// ---------------------------------------------------------------------------
// Requirements: reusable gating rules for routes, recipes, upgrades, contracts.

export type Requirement =
  | { type: 'skill'; skill: SkillId; level: number }
  | { type: 'route'; route: string }
  | { type: 'flag'; flag: string }
  | { type: 'upgrade'; upgrade: string; level: number }
  | { type: 'region'; region: string }
  | { type: 'rank'; rank: number }
  | { type: 'recipe'; recipe: string };

export interface ItemQty {
  item: string;
  qty: number;
}

// ---------------------------------------------------------------------------
// Items

export type ItemCategory =
  | 'herb'
  | 'food'
  | 'fiber'
  | 'wood'
  | 'ore'
  | 'scrap'
  | 'part'
  | 'trophy'
  | 'notes'
  | 'component'
  | 'supply'
  | 'weapon'
  | 'armor'
  | 'trinket';

export type EquipSlot = 'weapon' | 'armor' | 'trinket';

export interface EquipDef {
  slot: EquipSlot;
  stats?: Partial<Stats>;
  /** Strikes from the back row at full strength and ignores flying evasion. */
  ranged?: boolean;
  /** Ignores this much of the target's Guard. */
  pierce?: number;
  /** Prevents ambushes and darkness hazards. */
  light?: boolean;
  /** Extra party carry capacity. */
  carry?: number;
  /** Percent reduction of hazard damage taken by this hero. */
  ward?: number;
  /** Percent bonus to discovery chance (party-wide). */
  discovery?: number;
  /** Extra healing done by this hero's abilities. */
  mending?: number;
  /** Percent chance per strike to stagger the target (it loses its next action). */
  shock?: number;
}

export type SupplyKind = 'ration' | 'tonic' | 'antidote' | 'flask' | 'rope' | 'salve' | 'draught';

export interface SupplyDef {
  kind: SupplyKind;
  /** tonic: fraction of max HP restored; ration: fraction healed per leg */
  power?: number;
  /** flask: flat damage dealt to every enemy */
  damage?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  tier: 1 | 2 | 3;
  desc: string;
  /** Marks paid by the quartermaster when sold. */
  value: number;
  equip?: EquipDef;
  supply?: SupplyDef;
}

// ---------------------------------------------------------------------------
// Skills and actions (gathering activities + crafting recipes)

export interface SkillDef {
  id: SkillId;
  name: string;
  verb: string;
  role: string;
  /** Short description of the passive expedition/camp benefit of levels. */
  passive: string;
  color: string;
}

export interface ActionOutput {
  item: string;
  qty: number;
  /** Probability (0-1) that this output is produced each cycle. Defaults to 1. */
  chance?: number;
}

export interface ActionDef {
  id: string;
  skill: SkillId;
  name: string;
  kind: 'gather' | 'craft';
  level: number;
  seconds: number;
  xp: number;
  inputs?: ItemQty[];
  outputs: ActionOutput[];
  requires?: Requirement[];
  /** Recipes only: if false the recipe must be learned (discovery or contract). */
  known?: boolean;
  /** Where an unknown recipe can be learned (shown in UI). */
  learnHint?: string;
  desc?: string;
}

// ---------------------------------------------------------------------------
// Heroes

export type HeroRole = 'defender' | 'striker' | 'support' | 'sapper' | 'scout';

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  role: HeroRole;
  roleLabel: string;
  base: Stats;
  growth: Stats;
  ability: { name: string; desc: string };
  passive: { name: string; desc: string };
  startGear: Partial<Record<EquipSlot, string>>;
  defaultRow: Row;
  bio: string;
  /** Null when the hero starts in the guild; otherwise how they are recruited. */
  recruitHint: string | null;
}

export type Row = 'front' | 'back';

// ---------------------------------------------------------------------------
// Enemies

export type EnemyTrait =
  | 'ambush'
  | 'charge'
  | 'spore'
  | 'armored'
  | 'pack'
  | 'frenzy'
  | 'flying'
  | 'dive'
  | 'shield'
  | 'lull'
  | 'ranged'
  | 'enrage'
  | 'summon'
  | 'vent'
  | 'overcharge';

export interface LootDef {
  item: string;
  chance: number;
  min: number;
  max: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  region: string;
  boss?: boolean;
  hp: number;
  might: number;
  guard: number;
  speed: number;
  xp: number;
  marks: number;
  traits: EnemyTrait[];
  summon?: string;
  loot: LootDef[];
  desc: string;
  /** Player-facing explanations of what makes it dangerous. */
  behavior: string[];
  counter: string;
}

// ---------------------------------------------------------------------------
// Regions, routes, hazards, discoveries

export type HazardKind = 'fall' | 'blight' | 'dark' | 'mire' | 'weather' | 'thorns';
export type HazardCounter = 'rope' | 'antidote' | 'light' | null;

export interface HazardDef {
  id: string;
  name: string;
  kind: HazardKind;
  /** Fraction of each hero's max HP lost before Ward. */
  damage: number;
  counter: HazardCounter;
  text: string;
  counteredText: string;
}

export interface FindDef {
  item: string;
  min: number;
  max: number;
  /** relative weight when rolling finds */
  weight: number;
}

export interface EncounterDef {
  enemies: string[];
  weight: number;
}

export interface DiscoveryGrant {
  flags?: string[];
  recipes?: string[];
  items?: ItemQty[];
  marks?: number;
  standing?: number;
  lore?: string;
}

export interface DiscoveryDef {
  id: string;
  name: string;
  route: string;
  /** Chance per leg (after minLeg). 1 on the final leg = guaranteed on a full run. */
  chance: number;
  once: boolean;
  rare?: boolean;
  /** Only rolls on the final leg (objective discoveries). */
  finalLeg?: boolean;
  minLeg?: number;
  text: string;
  grants: DiscoveryGrant;
  requires?: Requirement[];
}

export type RouteKind = 'survey' | 'gather' | 'relight' | 'hunt';

export interface RouteDef {
  id: string;
  region: string;
  name: string;
  kind: RouteKind;
  blurb: string;
  legs: number;
  legSeconds: number;
  danger: 1 | 2 | 3 | 4 | 5;
  encounterChance: number;
  encounters: EncounterDef[];
  finale?: { name: string; enemies: string[]; text: string };
  findsPerLeg: number;
  findChance: number;
  finds: FindDef[];
  hazardChance: number;
  hazards: string[];
  marks: [number, number];
  heroXp: number;
  scoutXp: number;
  minPorters?: number;
  requires: Requirement[];
  /** Applied the first time the route is completed successfully. */
  firstClear?: { flags?: string[]; text: string; standing?: number };
  /** Coordinates on the map (0-100). */
  map: { x: number; y: number };
}

export interface DriftDef {
  id: string;
  name: string;
  desc: string;
  duration?: number;
  encounter?: number;
  hazard?: number;
  finds?: number;
  discovery?: number;
  marks?: number;
  ambush?: boolean;
  herbs?: number;
}

export interface RegionDef {
  id: string;
  name: string;
  blurb: string;
  settlement: { name: string; flag: string; blurb: string };
  requires: Requirement[];
  drift: string[];
  color: string;
}

// ---------------------------------------------------------------------------
// Camp upgrades, contracts, charter ranks

export interface UpgradeLevel {
  marks: number;
  items: ItemQty[];
  seconds: number;
  effect: string;
  requires?: Requirement[];
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  levels: UpgradeLevel[];
}

export type ContractGoal =
  | { type: 'deliver'; item: string; qty: number }
  | { type: 'route'; route: string; count: number }
  | { type: 'defeat'; enemy: string; count: number }
  | { type: 'craft'; item: string; count: number }
  | { type: 'skill'; skill: SkillId; level: number }
  | { type: 'upgrade'; upgrade: string; level: number };

export interface ContractReward {
  marks?: number;
  standing?: number;
  items?: ItemQty[];
  recipes?: string[];
  recruit?: string;
  flags?: string[];
}

export interface ContractDef {
  id: string;
  giver: string;
  settlement: string;
  title: string;
  text: string;
  requires: Requirement[];
  goal: ContractGoal;
  reward: ContractReward;
}

export interface RankDef {
  rank: number;
  name: string;
  standing: number;
  perk: string;
  doctrineTier?: 1 | 2;
}

export interface DoctrineDef {
  id: string;
  tier: 1 | 2;
  name: string;
  desc: string;
}

export interface LoreDef {
  id: string;
  title: string;
  text: string;
}
