[CmdletBinding()]
param(
    [ValidateSet("Release", "Debug")]
    [string]$BuildType = "Release",

    [switch]$Deploy,

    [string]$Domain = "nexa-social-app.surge.sh"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $repoRoot "android"
$gradleFile = Join-Path $androidRoot "app\build.gradle.kts"
$gradleWrapper = Join-Path $androidRoot "gradlew.bat"
$clientPublicApk = Join-Path $repoRoot "client\public\nexa-social-app.apk"
$clientDistApk = Join-Path $repoRoot "client\dist\nexa-social-app.apk"

if (-not (Test-Path $gradleWrapper)) {
    throw "Gradle wrapper not found: $gradleWrapper"
}

$gradleConfig = [IO.File]::ReadAllText($gradleFile)
$versionNameMatch = [regex]::Match($gradleConfig, 'versionName\s*=\s*"([^"]+)"')
$versionCodeMatch = [regex]::Match($gradleConfig, 'versionCode\s*=\s*(\d+)')
if (-not $versionNameMatch.Success -or -not $versionCodeMatch.Success) {
    throw "Unable to read Android versionName/versionCode from $gradleFile"
}

$versionName = $versionNameMatch.Groups[1].Value
$versionCode = [int]$versionCodeMatch.Groups[1].Value
$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$apksigner = Get-ChildItem (Join-Path $sdkRoot "build-tools") `
    -Filter "apksigner.bat" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1

if (-not $apksigner) {
    throw "apksigner.bat was not found under $sdkRoot\build-tools. Install Android SDK Build-Tools first."
}

$tasks = @("clean", "testDebugUnitTest", "lintDebug")
if ($BuildType -eq "Release") {
    $tasks += @("lintRelease", "assembleRelease")
} else {
    Write-Warning "Publishing a debug-signed APK. Use this only for controlled testing, not a store/public production release."
    $tasks += "assembleDebug"
}

Push-Location $androidRoot
try {
    & $gradleWrapper @tasks "--no-daemon"
    if ($LASTEXITCODE -ne 0) {
        throw "Android build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

if ($BuildType -eq "Release") {
    $apkPath = Join-Path $androidRoot "app\build\outputs\apk\release\app-release.apk"
    $unsignedPath = Join-Path $androidRoot "app\build\outputs\apk\release\app-release-unsigned.apk"
    if (-not (Test-Path $apkPath)) {
        if (Test-Path $unsignedPath) {
            throw "Release APK is unsigned. Configure KEYSTORE_FILE, KEYSTORE_PASSWORD, KEY_ALIAS and KEY_PASSWORD, then rerun."
        }
        throw "Signed release APK was not generated at $apkPath"
    }
} else {
    $apkPath = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"
    if (-not (Test-Path $apkPath)) {
        throw "Debug APK was not generated at $apkPath"
    }
}

& $apksigner.FullName verify --verbose --print-certs $apkPath
if ($LASTEXITCODE -ne 0) {
    throw "APK signature verification failed. The website was not changed."
}

$apkInfo = Get-Item $apkPath
$apkHash = (Get-FileHash $apkPath -Algorithm SHA256).Hash
Copy-Item $apkPath $clientPublicApk -Force

$previousVersion = $env:VITE_ANDROID_VERSION
try {
    $env:VITE_ANDROID_VERSION = $versionName
    Push-Location $repoRoot
    try {
        npm run build --workspace=client
        if ($LASTEXITCODE -ne 0) {
            throw "Website build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
} finally {
    if ($null -eq $previousVersion) {
        Remove-Item Env:VITE_ANDROID_VERSION -ErrorAction SilentlyContinue
    } else {
        $env:VITE_ANDROID_VERSION = $previousVersion
    }
}

if (-not (Test-Path $clientDistApk)) {
    throw "The website build did not contain nexa-social-app.apk"
}

$distHash = (Get-FileHash $clientDistApk -Algorithm SHA256).Hash
if ($distHash -ne $apkHash) {
    throw "Website APK hash differs from the verified Android build. Deployment stopped."
}

$metadata = [ordered]@{
    app = "Nexa Social"
    applicationId = "com.nexa.social"
    versionName = $versionName
    versionCode = $versionCode
    buildType = $BuildType.ToLowerInvariant()
    fileName = "nexa-social-app.apk"
    sizeBytes = $apkInfo.Length
    sha256 = $apkHash
    publishedAt = [DateTimeOffset]::UtcNow.ToString("o")
    downloadUrl = "https://$Domain/nexa-social-app.apk?v=$versionName"
}
$metadataPath = Join-Path $repoRoot "client\dist\android-release.json"
$utf8NoBom = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($metadataPath, (($metadata | ConvertTo-Json -Depth 3) + [Environment]::NewLine), $utf8NoBom)

if ($Deploy) {
    $surge = Get-Command surge -ErrorAction SilentlyContinue
    if (-not $surge) {
        throw "Surge CLI is not installed or not in PATH. Run: npm install --global surge"
    }
    & $surge.Source (Join-Path $repoRoot "client\dist") $Domain
    if ($LASTEXITCODE -ne 0) {
        throw "Surge deployment failed with exit code $LASTEXITCODE"
    }
}

Write-Host ""
Write-Host "NEXA ANDROID WEBSITE RELEASE: READY" -ForegroundColor Green
Write-Host "Version: $versionName (code $versionCode)"
Write-Host "Build type: $BuildType"
Write-Host "APK: $clientDistApk"
Write-Host "Size bytes: $($apkInfo.Length)"
Write-Host "SHA256: $apkHash"
Write-Host "Direct link: https://$Domain/nexa-social-app.apk?v=$versionName"
if (-not $Deploy) {
    Write-Host "Website was built but not deployed. Rerun with -Deploy after reviewing the result." -ForegroundColor Yellow
}
