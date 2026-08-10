[CmdletBinding()]
param(
    [string]$CharactersRoot = '',
    [string]$ManifestPath = '',
    [string]$GeneratedRoot = '',
    [switch]$InstallGenerated
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($CharactersRoot)) {
    $CharactersRoot = Join-Path $projectRoot 'public\images\characters'
}
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $projectRoot 'tmp\character-state-generation\manifest.json'
}
if ($InstallGenerated -and [string]::IsNullOrWhiteSpace($GeneratedRoot)) {
    throw '-InstallGenerated requires -GeneratedRoot with {characterId}\{state}.png files.'
}

$characterIds = @(
    (1..15 | ForEach-Object { 'M{0}' -f $_ })
    (0..15 | ForEach-Object { 'F{0}' -f $_ })
)
$stateNames = @('normal', 'doctor', 'police', 'reporter', 'mafia', 'shaman', 'dead', 'arrested')
$stateInstructions = [ordered]@{
    normal = 'Keep the exact original student appearance with no role props.'
    doctor = 'Redraw the student as a friendly child doctor with a neat white coat, teal stethoscope, and small medical cross badge.'
    police = 'Redraw the student as a friendly child police officer with a navy cap, navy jacket, and shiny badge; no weapons.'
    reporter = 'Redraw the student as a young reporter holding a press microphone and notebook with a simple press-pass lanyard.'
    mafia = 'Redraw the student as a playful, non-violent mafia character with a charcoal fedora, dark suit jacket, and subtle red accent; no guns or blood.'
    shaman = 'Redraw the student as a gentle spiritual medium with a violet shawl, glowing crystal ball, and cute translucent spirit wisps.'
    dead = 'Show the student clearly fallen after a cartoon game attack, not sleeping: a safe non-graphic defeat pose with dizzy spiral eyes, small stars, and a pale-blue spirit wisp; no blood or wounds.'
    arrested = 'Show a humorous voting-arrest state with a surprised expression, toy-like handcuffs or a classroom-safe prisoner placard, and a red-white vote-result sash; no violence.'
}

function Get-ImageDimensions([string]$Path) {
    $image = [System.Drawing.Image]::FromFile($Path)
    try {
        return [pscustomobject]@{ Width = $image.Width; Height = $image.Height }
    }
    finally {
        $image.Dispose()
    }
}

function Install-NormalizedPng(
    [string]$SourcePath,
    [string]$TargetPath,
    [int]$Width,
    [int]$Height
) {
    $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
    $canvas = New-Object System.Drawing.Bitmap($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $temporaryPath = Join-Path (Split-Path -Parent $TargetPath) ('.character-state-' + [guid]::NewGuid().ToString('N') + '.png')

    try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.DrawImage($sourceImage, 0, 0, $Width, $Height)
        $canvas.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $canvas.Dispose()
        $sourceImage.Dispose()
    }

    Move-Item -LiteralPath $temporaryPath -Destination $TargetPath -Force
}

$records = @()
$createdDirectories = 0
$createdFallbacks = 0
$installedGenerated = 0
$existingStates = 0

foreach ($characterId in $characterIds) {
    $characterDirectory = Join-Path $CharactersRoot $characterId
    if (-not (Test-Path -LiteralPath $characterDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $characterDirectory -Force | Out-Null
        $createdDirectories++
    }

    $normalPath = Join-Path $characterDirectory 'normal.png'
    if (-not (Test-Path -LiteralPath $normalPath -PathType Leaf)) {
        throw "Missing normal reference for $characterId`: $normalPath"
    }

    $dimensions = Get-ImageDimensions $normalPath
    foreach ($stateName in $stateNames) {
        $targetPath = Join-Path $characterDirectory ($stateName + '.png')
        $generatedPath = if ($GeneratedRoot) {
            Join-Path (Join-Path $GeneratedRoot $characterId) ($stateName + '.png')
        }
        else {
            ''
        }
        $status = 'existing'

        if ($InstallGenerated -and (Test-Path -LiteralPath $generatedPath -PathType Leaf)) {
            Install-NormalizedPng -SourcePath $generatedPath -TargetPath $targetPath -Width $dimensions.Width -Height $dimensions.Height
            $installedGenerated++
            $status = 'installed-generated'
        }
        elseif (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
            Copy-Item -LiteralPath $normalPath -Destination $targetPath -Force
            $createdFallbacks++
            $status = 'fallback-normal'
        }
        else {
            $existingStates++
        }

        $prompt = @"
Use case: identity-preserve game character state asset.
Asset type: full-body 1:1 student character PNG for a classroom Mafia game.
Input image: the character's normal.png is the sole identity reference for $characterId. Preserve this exact character, not a generic replacement.
Primary request: Create the $stateName state for $characterId. $($stateInstructions[$stateName])
Subject: the same elementary-school student with the exact original face, eye shape, hairstyle, skin tone, body proportions, outfit silhouette, accessories, and recognizable personality from normal.png.
Style/medium: preserve the original normal.png illustration style exactly; clean high-quality anime/cartoon cel shading, crisp linework, warm friendly game art, no photorealism.
Composition/framing: full body centered, same camera distance, same pose scale and generous margins as normal.png, square composition, clean warm cream background, no other people.
Lighting/mood: clear soft studio lighting appropriate for a character selection card; state mood may change only as requested above.
Constraints: change only the state role or condition; keep the student's identity unmistakable. Produce one character only. Keep all limbs anatomically correct and the entire body inside the frame.
Avoid: text, watermark, logos, realistic adult proportions, generic face replacement, extra characters, extra limbs, duplicated props, graphic injury, blood, gore, weapons, horror, sleeping pose for dead state.
Output filename: $stateName.png
"@

        $records += [pscustomobject]@{
            characterId = $characterId
            state = $stateName
            gender = if ($characterId.StartsWith('M')) { 'boy' } else { 'girl' }
            referenceImage = $normalPath
            outputImage = $targetPath
            generatedInput = $generatedPath
            status = $status
            prompt = $prompt.Trim()
        }
    }
}

$manifestDirectory = Split-Path -Parent $ManifestPath
New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
$manifest = [ordered]@{
    version = 'character-state-generation-v1'
    generatedAt = (Get-Date).ToString('o')
    characterCount = $characterIds.Count
    stateCountPerCharacter = $stateNames.Count
    totalAssets = $records.Count
    charactersRoot = $CharactersRoot
    states = $stateNames
    records = @($records)
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

Write-Output "Prepared character folders: $($characterIds.Count)"
Write-Output "Prepared state records: $($records.Count)"
Write-Output "Created directories: $createdDirectories"
Write-Output "Created normal fallbacks: $createdFallbacks"
Write-Output "Installed generated images: $installedGenerated"
Write-Output "Existing state files kept: $existingStates"
Write-Output "Prompt manifest: $ManifestPath"
