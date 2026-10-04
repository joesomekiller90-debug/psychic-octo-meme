import type { HeroDef } from '../types';

const list: HeroDef[] = [
  {
    id: 'brannoc',
    name: 'Brannoc Vell',
    title: 'the Toll-Sergeant',
    role: 'defender',
    roleLabel: 'Warden',
    base: { vigor: 62, might: 5, guard: 3, speed: 8 },
    growth: { vigor: 7, might: 0.8, guard: 0.45, speed: 0.1 },
    ability: {
      name: 'Bulwark',
      desc: 'Every third action, Brannoc braces: his Guard doubles and enemies are forced to attack him for their next two strikes.',
    },
    passive: {
      name: 'Shield-Wall',
      desc: 'While Brannoc stands in the front row, melee enemies attack him twice as often as other front-row allies.',
    },
    startGear: { weapon: 'worn_hatchet' },
    defaultRow: 'front',
    bio: 'Once a toll-sergeant on the Old Concord roads, Brannoc kept his post for nine winters after the Hush with no one left to tax. He came to Lanternhold carrying the last tollhouse lantern and has not set it down since.',
    recruitHint: null,
  },
  {
    id: 'wren',
    name: 'Wren Marrow',
    title: 'the Outrider',
    role: 'striker',
    roleLabel: 'Outrider',
    base: { vigor: 38, might: 6, guard: 1, speed: 12 },
    growth: { vigor: 4, might: 1.15, guard: 0.15, speed: 0.22 },
    ability: {
      name: 'Pinning Shot',
      desc: 'Every third action, Wren lands a shot for 175% damage that pins the target, delaying its next action.',
    },
    passive: {
      name: 'Light Feet',
      desc: 'Wren acts quickly and has the highest base damage in the guild.',
    },
    startGear: { weapon: 'hunting_bow' },
    defaultRow: 'back',
    bio: 'Wren grew up running messages between walled farmsteads that no longer exist. Fast, sharp-eyed, and impatient with anyone who walks slower than she does.',
    recruitHint: null,
  },
  {
    id: 'tamsin',
    name: 'Tamsin Okoro',
    title: 'the Mender',
    role: 'support',
    roleLabel: 'Mender',
    base: { vigor: 42, might: 4, guard: 1, speed: 10 },
    growth: { vigor: 4.5, might: 0.7, guard: 0.2, speed: 0.15 },
    ability: {
      name: 'Mending Hands',
      desc: 'When an ally is below 65% health, Tamsin heals the most injured ally for 8 + her Might + Mending, and cures poison.',
    },
    passive: {
      name: 'Field Dressing',
      desc: 'After each won fight, every ally recovers 8% of their health and downed allies are patched up.',
    },
    startGear: { weapon: 'ash_staff' },
    defaultRow: 'back',
    bio: 'Tamsin kept a fever-ward running in a drowned chapel for three years. She keeps a list of every wayfarer she has stitched up, and she would like it to stay short.',
    recruitHint: null,
  },
  {
    id: 'ketch',
    name: 'Ketch Arlow',
    title: 'the Sapper',
    role: 'sapper',
    roleLabel: 'Sapper',
    base: { vigor: 46, might: 6, guard: 2, speed: 9 },
    growth: { vigor: 5, might: 1.0, guard: 0.3, speed: 0.12 },
    ability: {
      name: 'Blast Charge',
      desc: 'Every third action, Ketch throws a charge that hits every enemy for 85% damage and ignores half of their Guard.',
    },
    passive: {
      name: 'Demolitions',
      desc: 'Ketch deals 25% more damage to armored enemies.',
    },
    startGear: { weapon: 'worn_hatchet' },
    defaultRow: 'front',
    bio: 'Fenwick Stile’s quarry-blaster, out of work since the Hush filled the quarry with water. Ketch speaks fondly of every wall they have ever knocked down.',
    recruitHint: 'Contract "A Sapper for Hire" from Fenwick Stile.',
  },
  {
    id: 'sela',
    name: 'Sela Dunmore',
    title: 'the Pathfinder',
    role: 'scout',
    roleLabel: 'Pathfinder',
    base: { vigor: 40, might: 6, guard: 1, speed: 13 },
    growth: { vigor: 4.2, might: 1.0, guard: 0.2, speed: 0.22 },
    ability: {
      name: 'Expose',
      desc: 'Every third action, Sela marks the strongest enemy: it takes 25% more damage from everyone for the rest of the fight.',
    },
    passive: {
      name: 'Trailwise',
      desc: 'Sela dodges 20% of attacks. With her in the party, expeditions are 10% faster and discoveries 10% likelier.',
    },
    startGear: { weapon: 'hunting_bow' },
    defaultRow: 'back',
    bio: 'Sela ran the Cinderscar passes for Kilnmouth for a decade, alone, by night. She has opinions about every map you own.',
    recruitHint: 'Contract "The Ridge-Runner" from Kilnmouth.',
  },
];

export const HEROES: Record<string, HeroDef> = Object.fromEntries(list.map((h) => [h.id, h]));
export const HERO_LIST = list;
export const MAX_PARTY = 3;
export const MAX_HERO_LEVEL = 25;
