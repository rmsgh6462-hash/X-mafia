[CmdletBinding()]
param(
    [string]$SourceDirectory = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = Join-Path $projectRoot 'public\images\characters\M0'
if ([string]::IsNullOrWhiteSpace($SourceDirectory)) {
    $SourceDirectory = Join-Path $projectRoot 'tmp\m0-generated'
}
$sourceRoot = (Resolve-Path $SourceDirectory).Path
$stateFiles = @(
    'doctor.png',
    'police.png',
    'reporter.png',
    'mafia.png',
    'shaman.png',
    'dead.png',
    'arrested.png'
)

$normalPath = Join-Path $destination 'normal.png'
if (-not (Test-Path -LiteralPath $normalPath -PathType Leaf)) {
    throw "M0 normal image was not found: $normalPath"
}

$missingSources = @($stateFiles | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $sourceRoot $_) -PathType Leaf)
})
if ($missingSources.Count -gt 0) {
    throw "Missing generated M0 state image(s): $($missingSources -join ', ')"
}

New-Item -ItemType Directory -Path $destination -Force | Out-Null

$normalImage = [System.Drawing.Image]::FromFile($normalPath)
try {
    $targetWidth = $normalImage.Width
    $targetHeight = $normalImage.Height
}
finally {
    $normalImage.Dispose()
}

foreach ($fileName in $stateFiles) {
    $sourcePath = Join-Path $sourceRoot $fileName
    $targetPath = Join-Path $destination $fileName
    $temporaryPath = Join-Path $destination ('.m0-install-' + [guid]::NewGuid().ToString('N') + '.png')
    $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
    $canvas = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)

    try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.DrawImage($sourceImage, 0, 0, $targetWidth, $targetHeight)
        $canvas.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $canvas.Dispose()
        $sourceImage.Dispose()
    }

    Move-Item -LiteralPath $temporaryPath -Destination $targetPath -Force
}

$expectedFiles = @('normal.png') + $stateFiles
$missingTargets = @($expectedFiles | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $destination $_) -PathType Leaf)
})
if ($missingTargets.Count -gt 0) {
    throw "M0 installation is incomplete. Missing: $($missingTargets -join ', ')"
}

Write-Output "Installed M0 character states: $($expectedFiles.Count)/$($expectedFiles.Count)"
Write-Output "Destination: $destination"
