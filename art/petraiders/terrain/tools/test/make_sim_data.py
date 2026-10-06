"""Voxel-level (4 stud) stand-in for Roblox's heightmap import, used by harness.lua.

Writes sim_codes.txt (material letter per voxel) and sim_heights.bin (grey value per voxel), sampling the
pixel at each voxel centre of PetRaiders_Colormap.png / PetRaiders_Heightmap.png.
"""
import json, os
import numpy as np
from PIL import Image

D = os.environ.get("PETRAIDERS_TERRAIN_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))
L = json.load(open(os.path.join(D, "layout.json")))
col = np.array(Image.open(os.path.join(D, "PetRaiders_Colormap.png")).convert("RGB"))
hm = np.array(Image.open(os.path.join(D, "PetRaiders_Heightmap.png")).convert("L"))
CODE = {"Grass": "g", "LeafyGrass": "l", "Pavement": "p", "Cobblestone": "c", "Ground": "d", "Rock": "r", "Snow": "s",
        "Sand": "a", "Slate": "t"}
code = np.full(col.shape[:2], "?", dtype="<U1")
for k, rgb in L["materials"].items():
    code[np.all(col == np.array(rgb), axis=-1)] = CODE[k]
c, h = code[2::4, 2::4], hm[2::4, 2::4]
open(os.path.join(OUT, "sim_codes.txt"), "w").write("".join(c.ravel()))
open(os.path.join(OUT, "sim_heights.bin"), "wb").write(h.astype(np.uint8).tobytes())
print("sim data", c.shape)
