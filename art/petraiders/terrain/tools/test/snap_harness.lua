-- Plain-Lua harness for PetRaidersSnapBuildings.lua with a small but real CFrame implementation.
local SCRIPT = arg[1]
local GROUND = 0.13

-- ---------------------------------------------------------------- math types
local V3 = {}
V3.__index = V3
local function v3(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3) end
V3.__add = function(a, b) return v3(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
V3.__sub = function(a, b) return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
V3.__div = function(a, s) return v3(a.X / s, a.Y / s, a.Z / s) end
V3.__mul = function(a, s) return v3(a.X * s, a.Y * s, a.Z * s) end
Vector3 = { new = v3 }

local CF = {}
local function cf(p, m) return setmetatable({ p = p, m = m }, CF) end
local function mmul(a, b)
	local r = {}
	for i = 0, 2 do
		for j = 1, 3 do
			r[i * 3 + j] = a[i * 3 + 1] * b[j] + a[i * 3 + 2] * b[3 + j] + a[i * 3 + 3] * b[6 + j]
		end
	end
	return r
end
local function mvec(m, v)
	return v3(m[1] * v.X + m[2] * v.Y + m[3] * v.Z, m[4] * v.X + m[5] * v.Y + m[6] * v.Z, m[7] * v.X + m[8] * v.Y + m[9] * v.Z)
end
local I = { 1, 0, 0, 0, 1, 0, 0, 0, 1 }
CF.__index = function(t, k)
	if k == "Position" then return t.p end
	if k == "RightVector" then return v3(t.m[1], t.m[4], t.m[7]) end
	if k == "UpVector" then return v3(t.m[2], t.m[5], t.m[8]) end
	if k == "LookVector" then return v3(-t.m[3], -t.m[6], -t.m[9]) end
	if k == "Rotation" then return cf(v3(), t.m) end
	if k == "Inverse" then
		return function(self)
			local m = self.m
			local tr = { m[1], m[4], m[7], m[2], m[5], m[8], m[3], m[6], m[9] }
			local p = mvec(tr, self.p)
			return cf(v3(-p.X, -p.Y, -p.Z), tr)
		end
	end
end
CF.__mul = function(a, b)
	if getmetatable(b) == V3 then return a.p + mvec(a.m, b) end
	return cf(a.p + mvec(a.m, b.p), mmul(a.m, b.m))
end
CF.__add = function(a, v) return cf(a.p + v, a.m) end
local function rx(a) local c, s = math.cos(a), math.sin(a) return { 1, 0, 0, 0, c, -s, 0, s, c } end
local function ry(a) local c, s = math.cos(a), math.sin(a) return { c, 0, s, 0, 1, 0, -s, 0, c } end
local function rz(a) local c, s = math.cos(a), math.sin(a) return { c, -s, 0, s, c, 0, 0, 0, 1 } end
CFrame = {
	new = function(x, y, z)
		if getmetatable(x) == V3 then return cf(x, I) end
		return cf(v3(x, y, z), I)
	end,
	Angles = function(a, b, c) return cf(v3(), mmul(mmul(rx(a), ry(b)), rz(c))) end,
	lookAt = function(pos, target)
		local d = target - pos
		local len = math.sqrt(d.X * d.X + d.Y * d.Y + d.Z * d.Z)
		local l = d / len
		local r = v3(l.Y * 0 - l.Z * 1, l.Z * 0 - l.X * 0, l.X * 1 - l.Y * 0) -- look x up(0,1,0)
		local rl = math.sqrt(r.X * r.X + r.Y * r.Y + r.Z * r.Z)
		r = r / rl
		local u = v3(r.Y * l.Z - r.Z * l.Y, r.Z * l.X - r.X * l.Z, r.X * l.Y - r.Y * l.X)
		return cf(pos, { r.X, u.X, -l.X, r.Y, u.Y, -l.Y, r.Z, u.Z, -l.Z })
	end,
}

-- ---------------------------------------------------------------- instances
local Enum_ = setmetatable({}, { __index = function(t, k)
	local kind = setmetatable({}, { __index = function(t2, n) local v = { Name = n } rawset(t2, n, v) return v end })
	rawset(t, k, kind)
	return kind
end })
Enum = Enum_
RaycastParams = { new = function() return {} end }
function typeof(v)
	if type(v) == "table" and v.__instance then return "Instance" end
	return type(v)
end
local function inst(class, name, parent)
	local o = { __instance = true, ClassName = class, Name = name, children = {}, attrs = {}, Parent = parent }
	if parent then table.insert(parent.children, o) end
	function o:IsA(c)
		if c == "PVInstance" then return class == "Model" or class == "Part" end
		if c == "BasePart" then return class == "Part" end
		return c == class
	end
	function o:GetChildren() return self.children end
	function o:GetDescendants()
		local r = {}
		local function walk(x) for _, c in ipairs(x.children) do table.insert(r, c) walk(c) end end
		walk(self)
		return r
	end
	function o:FindFirstChild(n) for _, c in ipairs(self.children) do if c.Name == n then return c end end end
	function o:GetAttribute(n) return self.attrs[n] end
	function o:GetFullName() return (self.Parent and self.Parent.Name .. "." or "") .. self.Name end
	if class == "Part" then
		function o:GetPivot() return self.CFrame end
		function o:PivotTo(c) self.CFrame = c end
	elseif class == "Model" then
		function o:GetPivot() return self.WorldPivot end
		function o:PivotTo(c)
			local delta = c * self.WorldPivot:Inverse()
			for _, d in ipairs(self:GetDescendants()) do
				if d.ClassName == "Part" then d.CFrame = delta * d.CFrame end
			end
			self.WorldPivot = c
		end
	end
	return o
end
workspace = inst("Workspace", "Workspace")
workspace.Terrain = inst("Terrain", "Terrain", workspace)
function workspace:Raycast(o, d, p) return { Position = v3(o.X, GROUND, o.Z) } end
game = { GetService = function() return { TryBeginRecording = function() error("plugin only") end, SetWaypoint = function() end } end }

-- markers like the setup script makes them
local layout = inst("Folder", "PetRaidersLayout", workspace)
local st = inst("Folder", "Stations", layout)
local function marker(id, x, z, extra)
	local m = inst("Part", id, st)
	m.attrs = { StationId = id, WorldX = x, WorldZ = z, GroundY = GROUND }
	for k, v in pairs(extra or {}) do m.attrs[k] = v end
end
marker("leaderboards", 198.2, -198.2, { SizeX = 74, SizeZ = 30, YawDeg = -45, FacingX = -0.7071, FacingZ = 0.7071 })
marker("spawn", 0, 0, { Radius = 52 })
marker("eggs", 0, -190, { Radius = 48 })

-- a building: 2 parts, one rotated, plus an invisible hitbox that must be ignored
local b = inst("Model", "Leaderboards", workspace)
b.WorldPivot = CFrame.new(10, 5, 10)
local p1 = inst("Part", "Wall", b); p1.Size = v3(40, 20, 4); p1.CFrame = CFrame.new(10, 10, 10); p1.Transparency = 0
local p2 = inst("Part", "Post", b); p2.Size = v3(2, 30, 2); p2.CFrame = CFrame.new(30, 15, 10) * CFrame.Angles(0, math.rad(30), 0); p2.Transparency = 0
local p3 = inst("Part", "Hitbox", b); p3.Size = v3(200, 200, 200); p3.CFrame = CFrame.new(10, -50, 10); p3.Transparency = 1
local spawn = inst("Part", "SpawnLocation", workspace); spawn.Size = v3(12, 1, 12); spawn.CFrame = CFrame.new(-50, 3, 40); spawn.Transparency = 0
local tent = inst("Model", "EggTent", workspace); tent.WorldPivot = CFrame.new(0, 0, 0)
local t1 = inst("Part", "Tent", tent); t1.Size = v3(80, 40, 80); t1.CFrame = CFrame.new(5, 20, -30); t1.Transparency = 0

-- ---------------------------------------------------------------- run (patch MOVES + DRY_RUN)
local function run(dry)
	local src = io.open(SCRIPT):read("a")
	src = src:gsub("local DRY_RUN = true", "local DRY_RUN = " .. tostring(dry))
	src = src:gsub("local MOVES = {.-\n}\n", [[local MOVES = {
	{ marker = "leaderboards", target = workspace:FindFirstChild("Leaderboards"), turn = "plaza" },
	{ marker = "spawn", target = workspace:FindFirstChild("SpawnLocation"), offset = Vector3.new(0, 0, 30) },
	{ marker = "eggs", target = workspace:FindFirstChild("EggTent") },
	{ marker = "nope", target = workspace:FindFirstChild("EggTent") },
	{ marker = "E1", target = nil },
}
]], 1)
	src = src:gsub("([%w_]+)%s*%+=%s*([^\n]+)", "%1 = %1 + (%2)")
	local realprint = print
	print = function() end
	local ok, res = pcall(assert(load(src, "=Snap")))
	print = realprint
	if not ok then print("SCRIPT ERROR", res) os.exit(1) end
	print(res)
end
local before = p1.CFrame.p
run(true)
assert(math.abs(p1.CFrame.p.X - before.X) < 1e-9 and math.abs(p1.CFrame.p.Z - before.Z) < 1e-9, "dry run moved something")
run(false)
-- checks: leaderboards visible footprint centred on the marker, bottom on the ground, front facing the plaza
local function ext(parts)
	local x0, y0, z0, x1, y1, z1 = 1e9, 1e9, 1e9, -1e9, -1e9, -1e9
	for _, p in ipairs(parts) do
		local c, h = p.CFrame, p.Size / 2
		local r, u, l = c.RightVector, c.UpVector, c.LookVector
		local ex = math.abs(r.X) * h.X + math.abs(u.X) * h.Y + math.abs(l.X) * h.Z
		local ey = math.abs(r.Y) * h.X + math.abs(u.Y) * h.Y + math.abs(l.Y) * h.Z
		local ez = math.abs(r.Z) * h.X + math.abs(u.Z) * h.Y + math.abs(l.Z) * h.Z
		x0, y0, z0 = math.min(x0, c.p.X - ex), math.min(y0, c.p.Y - ey), math.min(z0, c.p.Z - ez)
		x1, y1, z1 = math.max(x1, c.p.X + ex), math.max(y1, c.p.Y + ey), math.max(z1, c.p.Z + ez)
	end
	return (x0 + x1) / 2, y0, (z0 + z1) / 2
end
local cx, by, cz = ext({ p1, p2 })
print(("leaderboards centre %.2f %.2f bottom %.2f; pivot look %.3f %.3f"):format(cx, cz, by, b.WorldPivot.LookVector.X, b.WorldPivot.LookVector.Z))
assert(math.abs(cx - 198.2) < 1e-6 and math.abs(cz + 198.2) < 1e-6 and math.abs(by - GROUND) < 1e-6)
assert(math.abs(b.WorldPivot.LookVector.X + 0.7071) < 1e-3 and math.abs(b.WorldPivot.LookVector.Z - 0.7071) < 1e-3)
local s = spawn.CFrame.p
print(("spawn at %.2f %.2f %.2f"):format(s.X, s.Y, s.Z))
assert(math.abs(s.X) < 1e-6 and math.abs(s.Z - 30) < 1e-6 and math.abs(s.Y - (GROUND + 0.5)) < 1e-6)
local tx, ty, tz = ext({ t1 })
assert(math.abs(tx) < 1e-6 and math.abs(tz + 190) < 1e-6 and math.abs(ty - GROUND) < 1e-6)
print("snap harness OK")
