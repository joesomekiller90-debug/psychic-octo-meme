-- Plain-Lua harness that runs PetRaidersTerrainSetup.lua against a simulated imported terrain.
-- usage: lua5.4 harness.lua SCRIPT DATA_DIR SCENARIO
local SCRIPT, DIR, SCENARIO = arg[1], arg[2], arg[3] or "identity"

-- ---------------------------------------------------------------- simulated terrain (256 x 256 voxels of 4 studs)
local codes, heights = {}, {}
do
	local s = io.open(DIR .. "/sim_codes.txt"):read("a")
	for k = 1, #s do codes[k] = s:sub(k, k) end
	local b = io.open(DIR .. "/sim_heights.bin", "rb"):read("a")
	for k = 1, #b do heights[k] = b:byte(k) end
end
local IMPORT_Y = 96
local SIM = {
	identity = { function(x, z) return x, z end, function(x, z) return x, z end },
	mirrorX = { function(x, z) return -x, z end, function(x, z) return -x, z end },
	mirrorZ = { function(x, z) return x, -z end, function(x, z) return x, -z end },
	rot90 = { function(x, z) return -z, x end, function(x, z) return z, -x end },
	transpose = { function(x, z) return z, x end, function(x, z) return z, x end },
}
local scen = SCENARIO
if scen == "gaps" or scen == "nocolormap" or scen == "empty" or scen == "raised" then scen = "identity" end
local fwd, inv = SIM[scen][1], SIM[scen][2]
if SCENARIO == "raised" then IMPORT_Y = 96 + 37 end
if SCENARIO == "nocolormap" then
	for k = 1, #codes do codes[k] = "g" end
end
local function voxel(wx, wz)
	local dx, dz = inv(wx, wz)
	local i, j = math.floor((dx + 512) / 4), math.floor((dz + 512) / 4)
	if i < 0 or i > 255 or j < 0 or j > 255 then return nil end
	return j * 256 + i + 1
end
local gapCount = 0
if SCENARIO == "gaps" then
	-- knock out a few path voxels (design coordinates on the east spoke and the egg loop)
	for _, p in ipairs({ { 100, 0 }, { 104, 0 }, { 90, -190 }, { 0, -280 } }) do
		local v = voxel(p[1], p[2])
		codes[v] = "g"
		gapCount = gapCount + 1
	end
end

local MAT_OF = { g = "Grass", l = "LeafyGrass", p = "Pavement", c = "Cobblestone", d = "Ground", r = "Rock", s = "Snow" }
local CODE_OF = {}
for c, n in pairs(MAT_OF) do CODE_OF[n] = c end

-- ---------------------------------------------------------------- Roblox API mocks
local function enumItem(kind, name)
	return setmetatable({ Name = name, EnumType = kind }, { __tostring = function() return "Enum." .. kind .. "." .. name end })
end
local function enumKind(kind)
	return setmetatable({}, { __index = function(t, k)
		local v = enumItem(kind, k)
		rawset(t, k, v)
		return v
	end })
end
Enum = setmetatable({}, { __index = function(t, k)
	local v = enumKind(k)
	rawset(t, k, v)
	return v
end })

local V3 = {}
V3.__index = V3
V3.__add = function(a, b) return Vector3.new(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
Vector3 = { new = function(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3) end }
local CF = {}
CF.__index = CF
CF.__mul = function(a, b)
	return setmetatable({ Position = a.Position, yaw = (a.yaw or 0) + (b.yaw or 0), roll = (a.roll or 0) + (b.roll or 0) }, CF)
end
CFrame = {
	new = function(x, y, z) return setmetatable({ Position = Vector3.new(x, y, z), yaw = 0, roll = 0 }, CF) end,
	Angles = function(rx, ry, rz)
		assert(rx == rx and ry == ry and rz == rz, "NaN angle")
		return setmetatable({ Position = Vector3.new(), yaw = ry, roll = rz }, CF)
	end,
}
Color3 = {
	fromRGB = function(r, g, b) return { R = r / 255, G = g / 255, B = b / 255 } end,
	new = function(r, g, b) return { R = r, G = g, B = b } end,
}
UDim2 = { fromOffset = function(x, y) return { x, y } end, fromScale = function(x, y) return { x, y } end }
UDim = { new = function(s, o) return { s, o } end }
RaycastParams = { new = function() return {} end }
Region3 = {
	new = function(a, b)
		local r = { min = a, max = b }
		function r:ExpandToGrid(res)
			local function lo(v) return math.floor(v / res) * res end
			local function hi(v) return math.ceil(v / res) * res end
			return Region3.new(Vector3.new(lo(self.min.X), lo(self.min.Y), lo(self.min.Z)),
				Vector3.new(hi(self.max.X), hi(self.max.Y), hi(self.max.Z)))
		end
		return r
	end,
}

local DATA = setmetatable({}, { __mode = "k" })
local created = {}
local function newInstance(class)
	local d = { ClassName = class, Name = class, _children = {}, _attrs = {} }
	local obj = {}
	DATA[obj] = d
	local methods = {
		SetAttribute = function(_, n, v)
			assert(type(n) == "string")
			assert(v == nil or type(v) == "number" or type(v) == "string" or type(v) == "boolean", "bad attribute type " .. n)
			if type(v) == "number" then assert(v == v, "NaN attribute " .. n) end
			d._attrs[n] = v
		end,
		GetAttribute = function(_, n) return d._attrs[n] end,
		GetChildren = function() return { table.unpack(d._children) } end,
		FindFirstChild = function(_, n)
			for _, c in ipairs(d._children) do if c.Name == n then return c end end
		end,
		Destroy = function(self) self.Parent = nil; d.destroyed = true end,
	}
	setmetatable(obj, {
		__index = function(_, k)
			if methods[k] then return methods[k] end
			return d[k]
		end,
		__newindex = function(_, k, v)
			if k == "Parent" then
				if d.Parent then
					local sib = DATA[d.Parent]._children
					for i = #sib, 1, -1 do if sib[i] == obj then table.remove(sib, i) end end
				end
				d.Parent = v
				if v then table.insert(DATA[v]._children, obj) end
			else
				if k == "Size" and type(v) == "table" and v.X then
					assert(v.X > 0 and v.Y > 0 and v.Z > 0 and v.X <= 2048 and v.Y <= 2048 and v.Z <= 2048, "bad part size")
				end
				d[k] = v
			end
		end,
	})
	table.insert(created, obj)
	return obj
end
Instance = { new = newInstance }

local terrain = newInstance("Terrain")
terrain.Name = "Terrain"
local matColors = {}
local replaced = 0
DATA[terrain].GetMaterialColor = function(_, m) return matColors[m.Name] or { R = 0.4, G = 0.5, B = 0.25 } end
DATA[terrain].SetMaterialColor = function(_, m, c) matColors[m.Name] = c end
DATA[terrain].ReplaceMaterial = function(_, region, res, src, dst)
	assert(res == 4)
	for x = region.min.X + 2, region.max.X - 2, 4 do
		for z = region.min.Z + 2, region.max.Z - 2, 4 do
			local v = voxel(x, z)
			if v and codes[v] == CODE_OF[src.Name] then
				codes[v] = CODE_OF[dst.Name]
				replaced = replaced + 1
			end
		end
	end
end
workspace = newInstance("Workspace")
workspace.Name = "Workspace"
terrain.Parent = workspace
DATA[workspace].Terrain = terrain
local rays = 0
DATA[workspace].Raycast = function(_, origin, dir, params)
	rays = rays + 1
	assert(params.FilterType and params.FilterDescendantsInstances)
	if SCENARIO == "empty" then return nil end
	local v = voxel(origin.X, origin.Z)
	if not v then return nil end
	local y = (IMPORT_Y - 128) + heights[v] / 255 * 256
	return { Position = Vector3.new(origin.X, y, origin.Z), Material = Enum.Material[MAT_OF[codes[v]] or "Rock"] }
end
game = { GetService = function(_, name)
	assert(name == "ChangeHistoryService")
	return {
		TryBeginRecording = function() error("TryBeginRecording can only be called from a plugin") end,
		SetWaypoint = function() end,
		FinishRecording = function() end,
	}
end }

-- ---------------------------------------------------------------- run
local src = io.open(SCRIPT):read("a")
src = src:gsub("([%w_]+)%s*%+=%s*([^\n]+)", "%1 = %1 + (%2)")          -- Luau compound assignment -> Lua
local chunk = assert(load(src, "=PetRaidersTerrainSetup"))
local realprint = print
print = function() end
local ok, report = pcall(chunk)
print = realprint
if not ok then
	print("SCRIPT ERROR: " .. tostring(report))
	os.exit(1)
end
print(("---- scenario %s: %d raycasts, %d voxels repainted"):format(SCENARIO, rays, replaced))
print(report)

-- ---------------------------------------------------------------- verify markers against the simulated import
local layout = workspace:FindFirstChild("PetRaidersLayout")
if layout then
	local bad = 0
	local stations = layout:FindFirstChild("Stations"):GetChildren()
	local eggs = layout:FindFirstChild("EggPads"):GetChildren()
	-- every marker centre must sit on walkable terrain in the simulated import
	for _, m in ipairs(stations) do
		local wx, wz = m:GetAttribute("WorldX"), m:GetAttribute("WorldZ")
		local c = codes[voxel(wx, wz)]
		local id = m:GetAttribute("StationId")
		if not (c == "p" or c == "c" or c == "d" or (id == "spawn" and c == "g")) then
			bad = bad + 1
			print("MARKER OFF PAD", id, wx, wz, c)
		end
		local front = m:FindFirstChild("Front")
		if front then
			local f = front.CFrame.Position
			local fc = codes[voxel(f.X, f.Z)]
			if not (fc == "p" or fc == "c") then
				bad = bad + 1
				print("FRONT DOT OFF PAD", id, f.X, f.Z, fc)
			end
		end
	end
	for _, m in ipairs(eggs) do
		local c = codes[voxel(m:GetAttribute("WorldX"), m:GetAttribute("WorldZ"))]
		if c ~= "p" then bad = bad + 1; print("EGG OFF PAD", m.Name, c) end
	end
	local walls = workspace:FindFirstChild("PetRaidersBoundary")
	print(("verify: %d station markers, %d egg markers, %d walls, %d problems, instances created %d"):format(
		#stations, #eggs, walls and #walls:GetChildren() or 0, bad, #created))
	if bad > 0 then os.exit(2) end
end
