--[[
	Pet Raiders hub - snap buildings onto the layout markers (optional helper)
	Run AFTER PetRaidersTerrainSetup.lua: it reads the markers in Workspace.PetRaidersLayout,
	so it also works if the terrain import landed mirrored/rotated or at a different height.

	1. Fill in MOVES: which marker each model (or part) goes to.
	   Marker names: spawn, eggs, training, raid, rebirth, leaderboards, purple_dome, red_house, market,
	   pedestals, flex_a, flex_b, flex_c, south_gate, and the egg pads E1 .. E8.
	2. Run once with DRY_RUN = true (prints what would happen, moves nothing), then with DRY_RUN = false.

	Each entry: { marker = "...", target = <Model or BasePart>, turn = ..., offset = Vector3.new(x, 0, z) }
	  turn   (optional) "plaza"  = turn the model so its front (LookVector, the -Z side) faces the plaza
	                    "pad"    = set its rotation to the pad's Orientation Y (marker attribute YawDeg)
	                    <number> = add this many degrees of rotation about Y
	                    nil      = keep the current rotation
	  offset (optional) extra studs in world X/Z from the marker centre (e.g. the SpawnLocation beside the tree)
	The model's footprint centre goes over the marker and its lowest visible part sits on the terrain.
]]

local DRY_RUN = true

local MOVES = {
	-- { marker = "eggs", target = workspace.EggTent },
	-- { marker = "leaderboards", target = workspace.Leaderboards, turn = "plaza" },
	-- { marker = "spawn", target = workspace.SpawnLocation, offset = Vector3.new(0, 0, 30) },
	-- { marker = "E1", target = workspace.Eggs.MeadowEgg },
}

-- ------------------------------------------------------------------ implementation
local layout = workspace:FindFirstChild("PetRaidersLayout")
assert(layout, "Workspace.PetRaidersLayout not found - run PetRaidersTerrainSetup.lua first")

local markers = {}
for _, folder in ipairs(layout:GetChildren()) do
	for _, m in ipairs(folder:GetChildren()) do
		local id = m:GetAttribute("StationId")
		if id then
			markers[id] = m
		end
	end
end

local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Include
params.FilterDescendantsInstances = { workspace.Terrain }
params.IgnoreWater = true
local function groundAt(x, z, fallback)
	local r = workspace:Raycast(Vector3.new(x, 2000, z), Vector3.new(0, -4000, 0), params)
	return r and r.Position.Y or fallback
end

-- world-space bounding box of the visible parts (falls back to all parts)
local function extents(inst)
	local all, visible = {}, {}
	local function add(p)
		table.insert(all, p)
		if p.Transparency < 1 then
			table.insert(visible, p)
		end
	end
	if inst:IsA("BasePart") then
		add(inst)
	end
	for _, d in ipairs(inst:GetDescendants()) do
		if d:IsA("BasePart") then
			add(d)
		end
	end
	local list = #visible > 0 and visible or all
	assert(#list > 0, inst:GetFullName() .. " has no parts")
	local x0, y0, z0, x1, y1, z1 = math.huge, math.huge, math.huge, -math.huge, -math.huge, -math.huge
	for _, p in ipairs(list) do
		local cf, h = p.CFrame, p.Size / 2
		local r, u, l = cf.RightVector, cf.UpVector, cf.LookVector
		local ex = math.abs(r.X) * h.X + math.abs(u.X) * h.Y + math.abs(l.X) * h.Z
		local ey = math.abs(r.Y) * h.X + math.abs(u.Y) * h.Y + math.abs(l.Y) * h.Z
		local ez = math.abs(r.Z) * h.X + math.abs(u.Z) * h.Y + math.abs(l.Z) * h.Z
		local c = cf.Position
		x0, y0, z0 = math.min(x0, c.X - ex), math.min(y0, c.Y - ey), math.min(z0, c.Z - ez)
		x1, y1, z1 = math.max(x1, c.X + ex), math.max(y1, c.Y + ey), math.max(z1, c.Z + ez)
	end
	return Vector3.new(x0, y0, z0), Vector3.new(x1, y1, z1)
end

local CHS = game:GetService("ChangeHistoryService")
local recording
if not DRY_RUN then
	pcall(function()
		recording = CHS:TryBeginRecording("PetRaiders snap buildings")
	end)
	if not recording then
		pcall(function()
			CHS:SetWaypoint("Before PetRaiders snap buildings")
		end)
	end
end

local lines = {}
local function out(fmt, ...)
	local s = string.format(fmt, ...)
	table.insert(lines, s)
	print(s)
end
out("=== Pet Raiders snap buildings (%s) ===", DRY_RUN and "DRY RUN - nothing is moved" or "moving")
if #MOVES == 0 then
	out("MOVES is empty - fill it in first.")
end

for _, e in ipairs(MOVES) do
	local m, inst = markers[e.marker], e.target
	if not m then
		out("SKIP: no marker called %q", tostring(e.marker))
	elseif typeof(inst) ~= "Instance" or not inst:IsA("PVInstance") then
		out("SKIP %s: target is missing or not a Model/BasePart", e.marker)
	else
		local original = inst:GetPivot()
		local tx, tz = m:GetAttribute("WorldX"), m:GetAttribute("WorldZ")
		if e.offset then
			tx, tz = tx + e.offset.X, tz + e.offset.Z
		end
		local pivot = original
		if e.turn == "plaza" then
			local fx, fz = m:GetAttribute("FacingX"), m:GetAttribute("FacingZ")
			if not fx then
				local len = math.sqrt(tx * tx + tz * tz)
				fx, fz = len > 1e-6 and -tx / len or 0, len > 1e-6 and -tz / len or -1
			end
			pivot = CFrame.lookAt(original.Position, original.Position + Vector3.new(fx, 0, fz))
		elseif e.turn == "pad" then
			pivot = CFrame.new(original.Position) * CFrame.Angles(0, math.rad(m:GetAttribute("YawDeg") or 0), 0)
		elseif type(e.turn) == "number" then
			pivot = CFrame.new(original.Position) * CFrame.Angles(0, math.rad(e.turn), 0) * original.Rotation
		end
		inst:PivotTo(pivot)
		local lo, hi = extents(inst)
		local gy = groundAt(tx, tz, m:GetAttribute("GroundY") or 0)
		inst:PivotTo(inst:GetPivot() + Vector3.new(tx - (lo.X + hi.X) / 2, gy - lo.Y, tz - (lo.Z + hi.Z) / 2))
		local lo2, hi2 = extents(inst)
		local w, d = hi2.X - lo2.X, hi2.Z - lo2.Z
		local fit = ""
		local r, sx, sz = m:GetAttribute("Radius"), m:GetAttribute("SizeX"), m:GetAttribute("SizeZ")
		if r and math.max(w, d) > 2 * r + 2 then
			fit = string.format("  (wider than its pad: %.0f x %.0f vs pad diameter %d)", w, d, 2 * r)
		elseif sx and math.max(w, d) > math.max(sx, sz) * 1.42 + 2 then
			fit = string.format("  (bigger than its pad: %.0f x %.0f vs pad %d x %d)", w, d, sx, sz)
		end
		local p0, p1 = original.Position, inst:GetPivot().Position
		out("%-12s %s: (%.0f, %.0f, %.0f) -> (%.0f, %.0f, %.0f)%s", e.marker, inst:GetFullName(), p0.X, p0.Y, p0.Z, p1.X,
			p1.Y, p1.Z, fit)
		if DRY_RUN then
			inst:PivotTo(original)
		end
	end
end

if not DRY_RUN then
	if recording then
		pcall(function()
			CHS:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
		end)
	else
		pcall(function()
			CHS:SetWaypoint("PetRaiders snap buildings")
		end)
	end
	out("Done. Ctrl+Z undoes the moves.")
end
return table.concat(lines, "\n")
