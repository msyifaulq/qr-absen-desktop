param(
    [string]$Version = "1.0.5"
)

$ErrorActionPreference = "Stop"

Write-Host "==> 1. Compiling NSIS installer with system NSIS 3.13..."
$nsisExe = "C:\Program Files (x86)\NSIS\makensis.exe"
if (-not (Test-Path $nsisExe)) {
    throw "NSIS 3.13 not found at $nsisExe"
}

$scriptNsi = "src-tauri\target\release\nsis\x64\installer.nsi"
if (-not (Test-Path $scriptNsi)) {
    throw "installer.nsi not found at $scriptNsi. Please run tauri build first."
}

& $nsisExe -INPUTCHARSET UTF8 -OUTPUTCHARSET UTF8 -V3 $scriptNsi

$outputExe = "src-tauri\target\release\nsis\x64\nsis-output.exe"
if (-not (Test-Path $outputExe)) {
    throw "nsis-output.exe was not created."
}

$bundleDir = "src-tauri\target\release\bundle\nsis"
if (-not (Test-Path $bundleDir)) {
    New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null
}

$targetInstaller = "$bundleDir\JeofficeQRAbsen_${Version}_x64-setup.exe"
Move-Item -Path $outputExe -Destination $targetInstaller -Force
Write-Host "==> Installer created: $targetInstaller"

Write-Host "==> 2. Signing installer..."
$envFile = Get-Content '.env' -Raw
$key = ($envFile -split '\r?\n' | Where-Object { $_ -match '^TAURI_SIGNING_PRIVATE_KEY=' } | Select-Object -First 1) -replace '^TAURI_SIGNING_PRIVATE_KEY=', ''
$pwd = ($envFile -split '\r?\n' | Where-Object { $_ -match '^TAURI_SIGNING_PRIVATE_KEY_PASSWORD=' } | Select-Object -First 1) -replace '^TAURI_SIGNING_PRIVATE_KEY_PASSWORD=', ''
Remove-Item env:TAURI_SIGNING_PRIVATE_KEY_PATH -ErrorAction SilentlyContinue

npx tauri signer sign -k "$key" -p "$pwd" "$targetInstaller"

Write-Host "==> Done! Both setup.exe and .sig are ready in $bundleDir"
