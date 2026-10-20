$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$projectJdk = Get-ChildItem -LiteralPath '.tools' -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($projectJdk) { $env:JAVA_HOME = $projectJdk.FullName }
$projectSdk = Join-Path (Get-Location) '.tools\android-sdk'
if (Test-Path -LiteralPath $projectSdk) { $env:ANDROID_HOME = $projectSdk }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'Web-Build fehlgeschlagen.' }
pnpm exec cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Android-Synchronisierung fehlgeschlagen.' }
& '.\android\gradlew.bat' -p android assembleDebug --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Android-Build fehlgeschlagen.' }
New-Item -ItemType Directory -Force artifacts | Out-Null
$appVersion = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
$apkPath = "artifacts\Vogelstimmen-$appVersion.apk"
Copy-Item -LiteralPath 'android\app\build\outputs\apk\debug\app-debug.apk' -Destination $apkPath -Force
Write-Output "APK: $apkPath"
