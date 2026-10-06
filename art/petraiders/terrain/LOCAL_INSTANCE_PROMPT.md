# Message for your local Claude (after the terrain import)

Paste everything in the box into the Claude that runs on your PC with Roblox Studio connected.

```text
I imported the new Pet Raiders hub terrain into Roblox Studio (Terrain Editor > Create > Import with
PetRaiders_Heightmap.png + PetRaiders_Colormap.png, Position 0, 96, 0, Size 1024, 256, 1024).
Everything for it is in my repo on branch claude/intelligent-noether-b17wfc, folder art/petraiders/terrain/.
Fetch that branch and read the files from it without switching my current branch
(git fetch origin claude/intelligent-noether-b17wfc, then
git show origin/claude/intelligent-noether-b17wfc:art/petraiders/terrain/<file>).
Start with README.md and layout.json.

Do these in order and stop after each numbered step to show me the result:

1. Run PetRaidersTerrainSetup.lua in Studio in edit mode (not play mode) with your Studio run-code tool
   and show me the full report it prints. If it says STOP, tell me why and do nothing else. If it says
   the import landed mirrored or rotated, use the marker positions it prints from now on, not the
   numbers on the layout picture.
2. Find what is left of the old map that is now in the way: the old baseplate/ground, old path parts,
   any old terrain bumps, and the big round bushes that used to ring the old map edge. List them with
   their positions. After I say OK, move them into ServerStorage > OldMap_Backup (don't delete anything).
3. Move the SpawnLocation to X 0, Z 30 on the plaza (just south of the big tree), sitting on the ground
   height from the report, facing north (-Z).
4. List the top-level models in Workspace and suggest which one belongs on which marker (stations 1-14
   and egg pads E1-E8 in Workspace.PetRaidersLayout). Ask me about anything you are not sure of.
   Don't move buildings yet.
5. Only when I say "snap buildings": put the mapping I approved into the MOVES table of
   PetRaidersSnapBuildings.lua, run it with DRY_RUN = true and show me the output, then run it with
   DRY_RUN = false. Use turn = "plaza" for things whose front should face the plaza (leaderboards,
   purple dome, red house, market stall, raid portal, rebirth obelisk, south gate arch) only after
   checking that the model's front is its -Z side; otherwise use turn = <degrees>.
6. Then make sure no tree, bush, rock, lamp or fence stands on a path: raycast down under each one and
   if the terrain there is Pavement, Cobblestone or Ground, move it to the nearest grass. Report what
   you moved.
7. When I say the layout is done, delete Workspace.PetRaidersLayout (keep Workspace.PetRaidersBoundary).

Rules: never call Terrain:Clear or reshape the terrain; set a ChangeHistoryService waypoint before each
change so I can undo it; if the report's ground height is not about 0, use that height instead of 0
everywhere; don't publish the place.
```

## If your local Claude can't run code in Studio

Open **View > Command Bar** in Studio, paste the whole of `PetRaidersTerrainSetup.lua`, press Enter, and
copy the Output window text back to it. Do the same with `PetRaidersSnapBuildings.lua` for step 5 after
it has filled in the `MOVES` table.
