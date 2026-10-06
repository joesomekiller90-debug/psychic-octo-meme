#!/bin/sh
# Runs the Studio scripts in plain Lua 5.4 against simulated imports (as designed, mirrored, rotated,
# with path gaps, raised, without colormap, no terrain) and checks the building-snap helper.
set -e
T="$(cd "$(dirname "$0")" && pwd)"
D="${PETRAIDERS_TERRAIN_DIR:-$T/../..}"
PETRAIDERS_TERRAIN_DIR="$D" python3 "$T/make_sim_data.py"
for sc in identity mirrorX mirrorZ rot90 transpose gaps raised nocolormap empty; do
  lua5.4 "$T/harness.lua" "$D/PetRaidersTerrainSetup.lua" "$T" "$sc" > "$T/out_$sc.txt"
  echo "$sc: $(grep -E '^verify|STOP' "$T/out_$sc.txt" | head -n 1)"
done
lua5.4 "$T/snap_harness.lua" "$D/PetRaidersSnapBuildings.lua" | tail -n 1
