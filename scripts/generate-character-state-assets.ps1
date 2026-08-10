[CmdletBinding()]
param(
    [string]$ManifestPath = '',
    [string]$GeneratedRoot = '',
    [ValidateSet('low', 'medium', 'high', 'auto')]
    [string]$Quality = 'high',
    [string]$Model = 'gpt-image-2'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $projectRoot 'tmp\character-state-generation\manifest.json'
}
if ([string]::IsNullOrWhiteSpace($GeneratedRoot)) {
    $GeneratedRoot = Join-Path $projectRoot 'tmp\character-state-generation\generated'
}

if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    throw 'OPENAI_API_KEY is not set. Set it in this PowerShell session before running the generator.'
}

$pythonCommand = Get-Command python -ErrorAction Stop
$imageGenScript = 'C:\Users\경남교육청\.codex\skills\.system\imagegen\scripts\image_gen.py'
if (-not (Test-Path -LiteralPath $imageGenScript -PathType Leaf)) {
    throw "Bundled image generation script was not found: $imageGenScript"
}
& $pythonCommand.Source -c "import openai" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'Python package openai is not installed. Run: python -m pip install openai'
}
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "Prompt manifest was not found: $ManifestPath"
}

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
$records = @($manifest.records | Where-Object { $_.state -ne 'normal' })
$generatedCount = 0
$skippedCount = 0

foreach ($record in $records) {
    $characterDirectory = Join-Path $GeneratedRoot $record.characterId
    $outputPath = Join-Path $characterDirectory ($record.state + '.png')
    New-Item -ItemType Directory -Path $characterDirectory -Force | Out-Null

    if (Test-Path -LiteralPath $outputPath -PathType Leaf) {
        $skippedCount++
        continue
    }

    Write-Output "Generating $($record.characterId)/$($record.state)..."
    & $pythonCommand.Source $imageGenScript edit `
        --model $Model `
        --image $record.referenceImage `
        --prompt $record.prompt `
        --size 1024x1024 `
        --quality $Quality `
        --output-format png `
        --no-augment `
        --out $outputPath `
        --force

    if ($LASTEXITCODE -ne 0) {
        throw "Image generation failed for $($record.characterId)/$($record.state) with exit code $LASTEXITCODE"
    }
    $generatedCount++
}

$installer = Join-Path $PSScriptRoot 'prepare-character-state-assets.ps1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer `
    -ManifestPath $ManifestPath `
    -GeneratedRoot $GeneratedRoot `
    -InstallGenerated

Write-Output "Generated new assets: $generatedCount"
Write-Output "Skipped existing generated assets: $skippedCount"
Write-Output "Installed generated assets into public/images/characters"
