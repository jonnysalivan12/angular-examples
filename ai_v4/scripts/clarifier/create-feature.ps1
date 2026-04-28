# Usage: .\create-feature.ps1 "dark mode"
# Output: JSON matching create-feature.sh (feature_number, feature_name, feature_dir, success)

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$FeatureDesc
)

$ErrorActionPreference = 'Stop'

$SpecsDir = 'specs'

# Create specs directory if it doesn't exist
if (-not (Test-Path -LiteralPath $SpecsDir)) {
    New-Item -ItemType Directory -Path $SpecsDir | Out-Null
}

# Find next available number — scan NNN-* directories, take max, +1
function Get-NextNumber {
    $nums = Get-ChildItem -LiteralPath $SpecsDir -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^(\d{3})-' } |
            ForEach-Object { [int]($Matches[1]) }

    if (-not $nums) { return '001' }

    $next = ([int]($nums | Measure-Object -Maximum).Maximum) + 1
    return '{0:D3}' -f $next
}

# Generate feature name from description (mirrors the sed pipeline in .sh)
function Get-FeatureName {
    param([string]$Desc)

    $name = $Desc.ToLowerInvariant()

    # Keep action verbs as prefixes: "add dark mode" -> "add- dark mode"
    $name = $name -replace '\b(add|create|implement|fix|update)\b', '$1-'

    # Drop articles
    $name = $name -replace '\b(the|a|an)\b', ''

    # Non-alphanumeric (and non-hyphen) -> hyphen
    $name = $name -replace '[^a-z0-9-]', '-'

    # Collapse runs of hyphens
    $name = $name -replace '-+', '-'

    # Trim leading/trailing hyphens
    $name = $name.Trim('-')

    # Keep only the first 4 hyphen-separated tokens
    $parts = ($name -split '-') | Where-Object { $_ -ne '' } | Select-Object -First 4
    return ($parts -join '-')
}

$NextNum      = Get-NextNumber
$FeatureName  = Get-FeatureName -Desc $FeatureDesc
$FeatureDir   = "$SpecsDir/$NextNum-$FeatureName"

New-Item -ItemType Directory -Path $FeatureDir -Force | Out-Null

# Output JSON — key order preserved; ConvertTo-Json gives valid JSON either way
[ordered]@{
    feature_number = $NextNum
    feature_name   = $FeatureName
    feature_dir    = $FeatureDir
    success        = $true
} | ConvertTo-Json
