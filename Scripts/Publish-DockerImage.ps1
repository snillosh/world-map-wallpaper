param(
    [string]$DockerUsername = "snillosh",
    [string]$ImageName = "world-map-wallpaper",
    [string]$ImageTag = "latest",
    [string]$EnvironmentFile = "../.env"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$dockerfilePath = Join-Path $repositoryRoot "Dockerfile"
$resolvedEnvironmentFile = Resolve-Path -Path (
    Join-Path $PSScriptRoot $EnvironmentFile
)
$fullImageName = "${DockerUsername}/${ImageName}:${ImageTag}"

$mapTilerLine = Get-Content -LiteralPath $resolvedEnvironmentFile |
    Where-Object { $_ -match '^\s*VITE_MAPTILER_API_KEY\s*=' } |
    Select-Object -Last 1

if (-not $mapTilerLine) {
    throw "VITE_MAPTILER_API_KEY was not found in '$resolvedEnvironmentFile'."
}

$mapTilerApiKey = ($mapTilerLine -replace '^\s*VITE_MAPTILER_API_KEY\s*=\s*', '').Trim()
if (
    ($mapTilerApiKey.StartsWith('"') -and $mapTilerApiKey.EndsWith('"')) -or
    ($mapTilerApiKey.StartsWith("'") -and $mapTilerApiKey.EndsWith("'"))
) {
    $mapTilerApiKey = $mapTilerApiKey.Substring(1, $mapTilerApiKey.Length - 2)
}

if ([string]::IsNullOrWhiteSpace($mapTilerApiKey)) {
    throw "VITE_MAPTILER_API_KEY is empty in '$resolvedEnvironmentFile'."
}

$previousMapTilerApiKey = [Environment]::GetEnvironmentVariable(
    "VITE_MAPTILER_API_KEY",
    "Process"
)

try {
    [Environment]::SetEnvironmentVariable(
        "VITE_MAPTILER_API_KEY",
        $mapTilerApiKey,
        "Process"
    )

    Write-Host "Building $fullImageName..." -ForegroundColor Green
    docker build `
        --secret "id=maptiler_api_key,env=VITE_MAPTILER_API_KEY" `
        --tag $fullImageName `
        --file $dockerfilePath `
        $repositoryRoot
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed."
    }

    Write-Host "Pushing $fullImageName..." -ForegroundColor Green
    docker push $fullImageName
    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed."
    }
}
finally {
    [Environment]::SetEnvironmentVariable(
        "VITE_MAPTILER_API_KEY",
        $previousMapTilerApiKey,
        "Process"
    )
}

Write-Host "Image published: $fullImageName" -ForegroundColor Cyan
Write-Host "Run the ServerConfiguration deployment script when you want to deploy it."
