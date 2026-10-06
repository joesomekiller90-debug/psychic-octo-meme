# PetRaiders model update (v2)

Rebuilt in Blender from `A3_PetsEggsItems.fbx` and `A4_EnemiesProjectiles.fbx`.

## What changed

- **Pets (17)**: rebuilt as Pet Simulator-style cube pets that keep each pet's identity (squirrel tail + acorn, bat wings, turtle shell, etc.), with glossy eyes (two highlights), blush and little mouths. Small pets are 652-794 triangles (target 300-800), large pets 824-1334 (target 400-2000).
- **Eggs, chests, coin, treats, pedestal, feast, feather**: same designs, cleaner round shapes (smooth egg shells, round rings and plates) plus extra detail: speckles, stars, cracks, spikes, an orbit ring, grass, rivets, side handles, sprinkles, crumbs, studs, runes and sparkles.
- **Enemies + projectiles**: same designs and cleaned geometry plus detail: bat finger bones and wing claws, brute leaves/berries/thorns, Mossjaw back spikes and moss, golem cracks/moss/runes, archer quiver, hat feather and belt, acorn leaf, arrow wraps, sparkle trails, slime drips.
- Every object keeps its original name, sits at the origin, and is exported with the same FBX settings as before (Y up, metres, no materials). Hard edges are exported as split normals.

## New parts to colour in Studio

Pets gained `Blush_<Pet>`, `Mouth_<Pet>` and (bat, croc, dragon, mole, squirrel) `Teeth_<Pet>`; a few pets also gained a `Glow_` or `Detail_` part they did not have before. Every original part name is still present. Eggs, items, enemies and projectiles have no new parts.

## Pet part guide (suggested colours)

| Pet | Size | Tris | Parts (contents, suggested colour) |
|---|---|---|---|
| AcornSquirrel | small | 784 | `Main` body, ears, tail, paws, feet #E8894A; `Accent` inner ears, muzzle, tail tip, acorn nut #FFE6C4; `Detail` acorn cap + stem #7A4A26; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Blush` cheeks #FF8FA3; `Mouth` mouth #4A2626; `Teeth` buck teeth #FFFFFF |
| BatPup | large | 824 | `Main` body, ears, head tuft, wing arms #8F7BD6; `Accent` inner ears, belly, dangling feet #FFB3D1; `Detail` wing membranes #5B4A9E; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Blush` cheeks #FF8FB8; `Mouth` mouth #3A2040; `Teeth` fangs #FFFFFF |
| BumblePup | small | 652 | `Main` body #FFD447; `Accent` black stripes, stinger, antennae #2B2B33; `Detail` wings #BDEBFF; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Blush` cheeks + antenna tips #FF8FB8; `Mouth` mouth #4A2626 |
| GolemCub | small | 744 | `Main` stone body, brows, fists, feet #B9A9A0; `Accent` moss #7CC46A; `Detail` cracks #6E625C; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` forehead rune #7FF5FF; `Blush` cheeks #FF9FA8; `Mouth` mouth #3A2E2A |
| KnightCorgi | small | 794 | `Main` body, ears, feet #F2A65A; `Accent` muzzle/chest, inner ears, plume #FFFFFF; `Detail` helmet, crest, shield #9AA6B8; `Eyes` eyes + nose #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` paw emblem on shield #FFD24D; `Blush` cheeks #FF8FA3; `Mouth` mouth #4A2626 |
| LanternMoth | small | 790 | `Main` body, feet #B9A3F0; `Accent` chest fluff #FFF1C9; `Detail` antennae, wings #8C6FD8; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` antenna tips, wing spots #FFE36B; `Blush` cheeks #FF9FC8; `Mouth` mouth #3A2040 |
| LilMossjaw | large | 1094 | `Main` body, snout, eye bumps, tail, feet #74C46A; `Accent` belly, back scutes #F4E6A0; `Detail` crown #F2C230; `Eyes` eyes + nostrils #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` crown gems #FF6FB0; `Blush` cheeks #FF9FA8; `Teeth` teeth #FFFFFF |
| MeadowStag | small | 766 | `Main` body, ears #C98F5A; `Accent` spots, muzzle, tail #FFF3E0; `Detail` antlers, hooves #7A4E32; `Eyes` eyes + nose #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` antler flowers #FF9EC9; `Blush` cheeks #FF8FA3; `Mouth` mouth #4A2626 |
| MossbackTurtle | large | 1334 | `Main` body, legs, tail #8FD18A; `Accent` shell #A9744A; `Detail` shell plates #7A5232; `Eyes` eyes #1B1B22; `EyeShine` eye highlights + mushroom stems/spots #FFFFFF; `Glow` mushroom caps #FF7A5C; `Blush` cheeks #FF9FA8; `Mouth` mouth #2E3A2A |
| RubbleMole | small | 662 | `Main` body, feet #9C6B4E; `Accent` nose, paws #FF9EB5; `Detail` miner helmet #FFC93C; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` helmet lamp #FFF7AE; `Blush` cheeks #FF8FA3; `Teeth` buck teeth + claws #FFFFFF |
| RuinGryphon | large | 1132 | `Main` body/head, crest, wings, tail tuft #7FB8F0; `Accent` lion-coloured lower body, tail, lowest wing feathers #E9C08A; `Detail` beak, talons #FFC63D; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` wing runes #7FFFD4; `Blush` cheeks #FF9FC0 |
| RuinheartDragon | large | 944 | `Main` body, tail, wing arms, feet #7BCB6A; `Accent` horns, belly #F6EBC0; `Detail` wings, back spikes, tail spade #3E8E4E; `Eyes` eyes + nostrils #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` heart #FF5C8A; `Blush` cheeks #FF9FA8; `Mouth` mouth #2E3A2A; `Teeth` fangs #FFFFFF |
| RuneOwl | small | 698 | `Main` body, ear tufts, wings #A3B36A; `Accent` face disc, belly scallops, wing tips #F5EBC8; `Detail` beak, feet #F2994A; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Glow` belly rune #66E0FF; `Blush` cheeks #FF9FA8 |
| SkellyKitten | small | 779 | `Main` body, ears, feet #6E5AA8; `Accent` inner ears, muzzle, ribcage, bone tail, bowstring #F4F1E8; `Detail` bow #8A5A3A; `Eyes` eyes + nose #14121C; `EyeShine` eye highlights #FFFFFF; `Glow` eye glints #8CFF7A; `Blush` cheeks #FF9FC8; `Mouth` stitched mouth #2A2038 |
| SleepyOrb | small | 716 | `Main` body #E7F0A0; `Accent` nightcap, Zzz, feet #6F8FE8; `Detail` cap band + pompom #FFFFFF; `Eyes` closed eyes #2A2A33; `Glow` sparkles, drool bubble #FFF07A; `Blush` cheeks #FF9FB0; `Mouth` mouth #4A2A2A |
| SlimeBuddy | large | 1203 | `Main` slime body, puddle, drips, top blob #7EE07A; `Accent` spots #B57BE8; `Detail` bubbles #E8FFE0; `Eyes` eyes #1B1B22; `EyeShine` eye highlights + body shine #FFFFFF; `Blush` cheeks #FF9FB0; `Mouth` mouth #2E4A2A |
| SproutBunny | small | 700 | `Main` body, ears, feet #C9A8F0; `Accent` inner ears, nose, tail #FFB3CF; `Detail` sprout #6CCB5F; `Eyes` eyes #1B1B22; `EyeShine` eye highlights #FFFFFF; `Blush` cheeks #FF8FB8; `Mouth` mouth #3A2040 |

## Triangle counts

| Asset | Before | After |
|---|---|---|
| AcornSquirrel | 1372 | 784 |
| AncientEgg | 560 | 1154 |
| BatPup | 836 | 824 |
| BigTreat | 652 | 984 |
| BossEgg | 664 | 1004 |
| BumblePup | 1152 | 652 |
| CelestialEgg | 746 | 1434 |
| Coin | 532 | 972 |
| DailyChest | 512 | 1050 |
| EggPedestal | 1138 | 1608 |
| Feast | 392 | 540 |
| FloorChest | 560 | 1068 |
| GolemCub | 1152 | 744 |
| KnightCorgi | 1480 | 794 |
| LanternMoth | 1004 | 790 |
| LilMossjaw | 1424 | 1094 |
| MeadowEgg | 772 | 1424 |
| MeadowStag | 1452 | 766 |
| MossbackTurtle | 1212 | 1334 |
| Mystery10KEgg | 784 | 1330 |
| Mystery1KEgg | 724 | 1080 |
| PhoenixFeather | 288 | 590 |
| RebornEgg | 748 | 1053 |
| RubbleMole | 1028 | 662 |
| RuinGryphon | 1340 | 1132 |
| RuinheartDragon | 2192 | 944 |
| RuinsEgg | 768 | 1116 |
| RuneOwl | 1036 | 698 |
| SkellyKitten | 1094 | 779 |
| SleepyOrb | 768 | 716 |
| SlimeBuddy | 976 | 1203 |
| SmallTreat | 404 | 798 |
| SproutBunny | 1360 | 700 |
| VipChest | 608 | 1178 |
| Acorn | 380 | 574 |
| Arrow | 108 | 160 |
| Bat | 1244 | 1660 |
| BrambleBrute | 2358 | 3782 |
| Mossjaw | 4940 | 6370 |
| RuneBolt | 192 | 286 |
| ShieldGolem | 1792 | 2388 |
| SkeletonArcher | 2500 | 2954 |
| SlimeGlob | 356 | 482 |
| StarBolt | 188 | 254 |

All parts are far below Roblox's 20,000-triangle MeshPart limit.

## Files

- `A3_PetsEggsItems_v2.fbx` / `.blend`: pets, eggs, items
- `A4_EnemiesProjectiles_v2.fbx` / `.blend`: enemies, projectiles
- `previews/`: before/after renders (the colours there are stand-ins; the FBX has no materials)
- `tools/`: the Blender scripts that produced these files (Blender 4.0+, `blender -b --python <script> -- <args>`)
- `terrain/`: the new hub terrain (heightmap + colormap for Terrain Editor > Import), the layout reference map, and the Studio setup scripts. See `terrain/README.md`.
