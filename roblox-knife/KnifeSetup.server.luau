--!strict
-- Put this Script inside the Knife Tool, next to Handle, Blade, Guard and Pommel.
-- It welds every part to Handle so the knife moves as one piece when equipped,
-- and gives each part its Roblox material and colour.

local tool = script.Parent :: Tool
local handle = tool:WaitForChild("Handle") :: BasePart

type Look = { Material: Enum.Material, Color: Color3, Reflectance: number? }

local GOLD = Color3.fromRGB(212, 158, 56)
local LOOKS: { [string]: Look } = {
	Blade = { Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(205, 210, 218), Reflectance = 0.3 },
	Guard = { Material = Enum.Material.Metal, Color = GOLD },
	Pommel = { Material = Enum.Material.Metal, Color = GOLD },
	Handle = { Material = Enum.Material.Fabric, Color = Color3.fromRGB(20, 20, 22) },
}

for _, part in tool:GetDescendants() do
	if not part:IsA("BasePart") then
		continue
	end

	local look = LOOKS[part.Name]
	if look then
		part.Material = look.Material
		part.Color = look.Color
		part.Reflectance = look.Reflectance or 0
	end

	part.Anchored = false
	part.CanCollide = false
	part.Massless = true

	if part ~= handle then
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = handle
		weld.Part1 = part
		weld.Parent = part
	end
end
