# Kindled Roads

*An idle adventure about the Lantern Compact, a frontier guild that relights the waystones of a wilderness that will not stay put.*

Thirty winters ago the Hush, a fog that sang, swallowed the roads of the Marches. The settlements survived behind their walls, but the ways between them were lost and the wild learned to move. You run Lanternhold, a camp built around the last burning waystone. Your job is to chart routes, relight waystones and reconnect **Fenwick Stile**, **Kilnmouth** and **Tollspire**.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build on http://localhost:4173
npm test           # simulation, save, content, balance and full-playthrough tests
npm run check      # typecheck + tests
```

Requires Node 20.19+ or 22.12+. There is no server: the game runs in the browser and saves to `localStorage`.

## The loop

1. **Plan an expedition.** Choose a route, your three wayfarers and their formation, gear, supplies, porters, pace and tactics. The planner runs a forecast: it simulates 32 journeys with your exact setup and shows completion odds, duration, likely threats and their counters, hazard coverage, expected haul and discovery chances.
2. **The journey runs in real time**, leg by leg, including while the game is closed. Each leg can bring rations and hunger, hazards, automatic fights, finds and discoveries.
3. **The party returns** with materials, marks, experience and a readable journey report, including a full combat log for each fight.
4. **Spend the haul.** You can level seven skills, craft gear and supplies (29 recipes), build camp upgrades, claim contracts and pledge doctrines.
5. **Take on harder roads.** There are 3 regions, 10 routes and 10 enemy types (two of them bosses).

You can run **one expedition alongside up to two camp work orders**. They draw on the same pool of **hands**: each work order needs 1–2, and every porter you send takes one. Rations, herbs, ore and fittings are needed both by the camp and on the road, so it matters what you schedule when. A crafting order can be queued without its materials; it waits until the other slot or a returning party supplies them.

### Systems at a glance

| System | What it does |
| --- | --- |
| **Skills** | Scouting, Foraging, Mining, Salvaging, Smithing, Alchemy, Engineering. Each skill has a level, an XP bar, a next unlock, activities or recipes, and a passive effect on expeditions or the camp. |
| **Party** | Brannoc (Warden), Wren (Outrider) and Tamsin (Mender) start with you. Ketch (Sapper) and Sela (Pathfinder) can be recruited through contracts. Each has an ability and a passive, plus three gear slots and a front or back row position. |
| **Combat** | Runs on timers: faster combatants act more often. Enemies have distinct behaviours: ambush, charge, poison, armour, packs with frenzy, flying, dive, wards, lull, and bosses with phases. You shape fights through tactics: focus target, tonic threshold, fire flask use and retreat threshold. |
| **The Drift** | Each region's conditions (Mistbound, Bloomtide, Ashfall, Spring Tide, Quiet Moon…) shift every two hours, changing danger and rewards. |
| **Camp** | 9 upgrades with 2–3 levels each. They cover hands, storage, healing, the forge, still room and loft, intel, the offline limit and carry capacity. Upgrades are built as work orders. |
| **Progression** | 16 contracts from four settlements, a journal (bestiary, materials, recipes, atlas, lore, milestones), charter ranks and two tiers of permanent doctrines. There is no forced reset. |

## Idle progress and saves

- The simulation advances in exact steps from one event to the next. Live play and offline catch-up share one function (`settle`), so advancing ten hours at once gives the same result as advancing in 250 ms ticks. A test checks this.
- All randomness comes from seeds stored in the save. Replaying the same span always yields the same rewards, so a refresh can never re-roll or duplicate anything.
- Offline progress is settled exactly once on load, and the result is saved immediately. The return summary is kept until you dismiss it.
- **Offline limit:** 8 hours, raised by the Signal Beacon to 20. The limit is explained in the UI.
- **Clock changes:** if the clock moves backwards, nothing is gained or lost. Forward jumps are capped by the offline limit.
- **Interrupted saves:** saves alternate between two checksummed slots, and loading picks the newest one that verifies. A save cut off mid-write falls back to the previous slot.
- **Older formats:** saves are versioned and migrated (v1 → v2), then normalised against a fresh state, so fields that are missing or malformed get safe defaults.
- **Two tabs:** opening the game in a second tab puts the first one to sleep so the two can't overwrite each other.
- Saves can be exported and imported from Settings.

## Code layout

```
src/game/data/     Content as data: skills, items, actions/recipes, heroes, enemies,
                   regions/routes/hazards/discoveries, upgrades/contracts/ranks/lore
src/game/sim/      Pure simulation: rules, combat, expeditions, work orders, the
                   event-stepped clock (advance.ts), player actions, contracts,
                   forecast, return summaries, tutorial
src/game/save/     Versioned save slots, checksums, migrations, normalisation
src/ui/            Preact UI: store (live loop, saving, toasts), screens, modals,
                   components, hand-drawn SVG icon set
src/styles/        The visual system (CSS custom properties, responsive layout)
tests/             Vitest suites, including balance checks and a scripted full playthrough
```

To add content, extend the arrays in `src/game/data`: a new recipe is one entry in `actions.ts`, a new route one entry in `world.ts`. `tests/content.test.ts` checks that every reference resolves and every item, recipe, flag and recruit can be obtained through play.

## Known limitations

- Content covers a complete early game: three regions ending with the Drowned Engine. After the final boss, routes stay repeatable for materials but no new region opens.
- Progress lives in one browser's `localStorage`. To move a guild to another browser, use export/import.
- Balance is tuned with the forecast harness (`tests/balance.test.ts`) and a scripted player that finishes the game in about 9–10 hours of game time. Real players will vary.
