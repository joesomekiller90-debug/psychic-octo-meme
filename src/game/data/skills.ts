import type { SkillDef, SkillId } from '../types';

export const SKILL_ORDER: SkillId[] = [
  'scouting',
  'foraging',
  'mining',
  'salvaging',
  'smithing',
  'alchemy',
  'engineering',
];

export const SKILLS: Record<SkillId, SkillDef> = {
  scouting: {
    id: 'scouting',
    name: 'Scouting',
    verb: 'Survey',
    role: 'Reads the land. Shortens journeys, finds hidden sites, opens new routes.',
    passive: 'Each level: expeditions 1% faster (max 30%) and +2% discovery chance.',
    color: '#8fb8de',
  },
  foraging: {
    id: 'foraging',
    name: 'Foraging',
    verb: 'Forage',
    role: 'Gathers herbs, berries, reed and timber for alchemy, rations and engineering.',
    passive: 'Each level: +2% herbs, food, fiber and timber found on expeditions.',
    color: '#9bc47a',
  },
  mining: {
    id: 'mining',
    name: 'Mining',
    verb: 'Mine',
    role: 'Digs ore and coal for the forge and camp construction.',
    passive: 'Each level: +2% ore found on expeditions.',
    color: '#c9a27a',
  },
  salvaging: {
    id: 'salvaging',
    name: 'Salvaging',
    verb: 'Salvage',
    role: 'Turns road scrap, slag and relics into fittings, coils and gears.',
    passive: 'Each level: +2% scrap and relics found, +1% extra enemy trophies.',
    color: '#b7a6d6',
  },
  smithing: {
    id: 'smithing',
    name: 'Smithing',
    verb: 'Forge',
    role: 'Forges weapons, armor and iron brackets for camp buildings.',
    passive: 'Each level: smithing work 1% faster (max 30%).',
    color: '#e0875a',
  },
  alchemy: {
    id: 'alchemy',
    name: 'Alchemy',
    verb: 'Brew',
    role: 'Brews rations, tonics, antidotes and flasks that keep the party alive.',
    passive: 'Each level: alchemy work 1% faster (max 30%).',
    color: '#6cc4b0',
  },
  engineering: {
    id: 'engineering',
    name: 'Engineering',
    verb: 'Build',
    role: 'Builds lanterns, packs, climbing kits, ranged weapons and camp beams.',
    passive: 'Each level: engineering work 1% faster (max 30%).',
    color: '#e6c25a',
  },
};

export const MAX_SKILL_LEVEL = 40;
