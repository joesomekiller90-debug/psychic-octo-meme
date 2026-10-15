--!strict
-- Put this Script inside the Knife Tool, next to Handle, Blade and Guard.
-- It welds every part to Handle so the knife moves as one piece when equipped,
-- and gives each part its Roblox material and colour.

local tool = script.Parent :: Tool
local handle = tool:WaitForChild("Handle") :: BasePart

type Look = { Material: Enum.Material, Color: Color3, Reflectance: number? }

local LOOKS: { [string]: Look } = {
	Blade = { Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(215, 222, 230), Reflectance = 0.35 },
	Guard = { Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(235, 175, 55), Reflectance = 0.15 },
	Handle = { Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(18, 18, 20) },
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
