#Requires -Version 5.1
# TokeerDRM — install official OpenSteamTool so Denuvo codes apply.
# Launched by the plugin when no Denuvo-capable engine is detected.
# Downloads the latest OST release from GitHub, backs up the current engine,
# points OST at the existing config\stplug-in library, and restarts Steam.
# -Force re-downloads + replaces the engine even if it's already present (updates).
param([switch]$Force)

$ErrorActionPreference = "Stop"

# Shared marker (same file the TokeerDRM app writes) recording the installed OST
# release tag, so detection can tell repair-needed from outdated.
$OstVersionFile = ".tokeer_ost_version"
function Get-LatestOstTag {
    try { return (Invoke-RestMethod "https://api.github.com/repos/OpenSteam001/OpenSteamTool/releases/latest" -Headers @{ "User-Agent" = "TokeerDRM" }).tag_name } catch { return $null }
}
function Set-OstVersionMarker($steam, $tag) {
    if ($steam -and $tag) { try { [IO.File]::WriteAllText((Join-Path $steam $OstVersionFile), [string]$tag) } catch {} }
}
# True only if the dwmapi/xinput1_4 proxies belong to OpenSteamTool/mktl (they
# reference its core). SteamTools' proxies don't — so this tells "OST active" from
# "SteamTools active despite OST files present" (code 00). When false we must do a
# full install so OST's proxies OVERWRITE SteamTools'.
function Test-ProxyIsEngine($steam) {
    $present = @('dwmapi.dll','xinput1_4.dll') | Where-Object { Test-Path (Join-Path $steam $_) }
    if (-not $present) { return $false }
    foreach ($d in $present) {
        try { $txt = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes((Join-Path $steam $d))) } catch { return $false }
        if ($txt -notmatch 'OpenSteamTool' -and $txt -notmatch 'mktl') { return $false }
    }
    return $true
}
# Neutralise every OTHER unlock engine so ONLY OpenSteamTool is active. Without this,
# a leftover core (e.g. cloud_redirect.dll) stays on disk and managers like LuaTools
# keep showing CloudRedirect as ACTIVE and ask the user to switch manually — this is
# what their "Switch to OpenSteamTool" button does. Cores go by name; foreign proxies
# only when their bytes tie them to a known unlocker (never a real Steam DLL).
function Disable-ForeignEngines($steam) {
    foreach ($core in 'mktl.dll','cloud_redirect.dll') {
        $p = Join-Path $steam $core
        if (Test-Path $p) { Move-Item $p "$p.bak" -Force -ErrorAction SilentlyContinue }
    }
    foreach ($proxy in 'hid.dll','version.dll','winhttp.dll') {
        $p = Join-Path $steam $proxy
        if (-not (Test-Path $p)) { continue }
        try { $txt = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($p)) } catch { continue }
        if ($txt -match 'OpenSteamTool' -or $txt -match 'mktl') { continue }
        if ($txt -match 'cloud_redirect|SteamTools|steamtools|stplug|LuaTools|luatools') {
            Move-Item $p "$p.bak" -Force -ErrorAction SilentlyContinue
        }
    }
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "TokeerDRM — OpenSteamTool setup"

function Get-SteamPath {
    foreach ($r in @(
        @{P="HKCU:\Software\Valve\Steam";K="SteamPath"},
        @{P="HKLM:\SOFTWARE\WOW6432Node\Valve\Steam";K="InstallPath"},
        @{P="HKLM:\SOFTWARE\Valve\Steam";K="InstallPath"})) {
        $v = (Get-ItemProperty $r.P -Name $r.K -ErrorAction SilentlyContinue).$($r.K)
        if ($v -and (Test-Path (Join-Path ($v -replace '/','\') "steam.exe"))) { return ($v -replace '/','\') }
    }
    throw "Steam not found"
}

Write-Host "`n=== TokeerDRM: setting up OpenSteamTool ===`n" -ForegroundColor Cyan
$steam = Get-SteamPath
Write-Host "[+] Steam: $steam" -ForegroundColor Green

# 0. Config-only: OST already installed (e.g. set up manually) → just allow it in
#    Defender and make sure the toml reads config\stplug-in. OST hot-reloads the
#    toml, so no download and no Steam restart.
$haveCore   = (Test-Path (Join-Path $steam "OpenSteamTool.dll")) -or (Test-Path (Join-Path $steam "mktl.dll"))
$haveHijack = (Test-Path (Join-Path $steam "dwmapi.dll")) -and (Test-Path (Join-Path $steam "xinput1_4.dll"))
$isMktl     = Test-Path (Join-Path $steam "mktl.dll")
# Config-only only when OST's proxies are genuinely active. If SteamTools owns them,
# fall through to a full install so OST's proxies overwrite SteamTools' ("switch to OST").
if ($haveCore -and $haveHijack -and -not $Force -and (Test-ProxyIsEngine $steam)) {
    Write-Host "[*] OpenSteamTool already installed — finishing setup (config only)..." -ForegroundColor Cyan
    try { Add-MpPreference -ExclusionPath $steam -ErrorAction SilentlyContinue } catch {}
    # Clear any leftover foreign core so other managers stop showing it as active.
    Disable-ForeignEngines $steam
    if (-not $isMktl) {
        $tomlPath = Join-Path $steam "opensteamtool.toml"
        $needsLua = $true
        if (Test-Path $tomlPath) {
            $existing = Get-Content $tomlPath -Raw
            if ($existing -match "stplug-in") { $needsLua = $false }
        }
        if ($needsLua) {
            if (Test-Path $tomlPath) {
                Copy-Item $tomlPath "$tomlPath.tokeer.bak" -Force -ErrorAction SilentlyContinue
                $existing = Get-Content $tomlPath -Raw
                if ($existing -match "(?im)^\s*\[lua\]") {
                    if ($existing -match "(?im)^\s*paths\s*=\s*\[") {
                        $existing = [regex]::Replace($existing, "(?im)^(\s*paths\s*=\s*\[)", '$1"config/stplug-in", ', 1)
                    } else {
                        $existing = [regex]::Replace($existing, "(?im)^(\s*\[lua\][^\r\n]*\r?\n)", "`$1paths = [`"config/stplug-in`"]`r`n", 1)
                    }
                    Set-Content $tomlPath $existing -Encoding UTF8
                } else {
                    Add-Content $tomlPath "`r`n[lua]`r`npaths = [`"config/stplug-in`"]`r`n" -Encoding UTF8
                }
            } else {
                @"
[manifest]
url = "opensteamtool"

[stats]
enable_api = true

[lua]
paths = ["config/stplug-in"]
"@ | Set-Content $tomlPath -Encoding UTF8
            }
            Write-Host "[+] Pointed OpenSteamTool at config\stplug-in." -ForegroundColor Green
        }
    }
    Set-OstVersionMarker $steam (Get-LatestOstTag)
    Write-Host "`n[OK] OpenSteamTool configured. Redeem your code.`n" -ForegroundColor Green
    Start-Sleep 2
    exit 0
}

# 1. latest OST release zip
Write-Host "[*] Finding latest OpenSteamTool release..."
$rel = Invoke-RestMethod "https://api.github.com/repos/OpenSteam001/OpenSteamTool/releases/latest" -Headers @{ "User-Agent"="TokeerDRM" }
$asset = $rel.assets | Where-Object { $_.name -match "(?i)release" -and $_.name -match "\.zip$" } | Select-Object -First 1
if (-not $asset) { throw "No OST Release zip found" }
$zip = Join-Path $env:TEMP "OpenSteamTool-Release.zip"
Write-Host "[*] Downloading $($asset.name)..."
Invoke-WebRequest $asset.browser_download_url -OutFile $zip -Headers @{ "User-Agent"="TokeerDRM" }

# 2. Defender exclusion (so the engine DLLs aren't quarantined as PUA)
Write-Host "[*] Allowing OpenSteamTool in Windows Security..."
try { Add-MpPreference -ExclusionPath $steam -ErrorAction SilentlyContinue } catch {}

# 3. close Steam (+ any SteamTools manager)
Write-Host "[*] Closing Steam..."
& (Join-Path $steam "steam.exe") -shutdown 2>$null
for ($i=0;$i -lt 30;$i++){ Start-Sleep 1; if(-not (Get-Process steam -ErrorAction SilentlyContinue)){break} }
Get-Process -Name "steam","SteamTools" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# 4. back up the current engine
$backup = Join-Path $steam "tokeer-engine-backup"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
foreach ($f in "dwmapi.dll","xinput1_4.dll","mktl.dll","cloud_redirect.dll","hid.dll","OpenSteamTool.dll","opensteamtool.toml") {
    $src = Join-Path $steam $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $backup $f) -Force -ErrorAction SilentlyContinue }
}

# 5. extract the 3 runtime DLLs into the Steam root
Write-Host "[*] Installing OpenSteamTool..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
$tmp = Join-Path $env:TEMP ("ost_" + [guid]::NewGuid().ToString("N"))
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
foreach ($f in "dwmapi.dll","xinput1_4.dll","OpenSteamTool.dll") {
    $hit = Get-ChildItem $tmp -Recurse -Filter $f | Select-Object -First 1
    if (-not $hit) { throw "OST zip missing $f" }
    Copy-Item $hit.FullName (Join-Path $steam $f) -Force
}
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

# 6. disable every competing engine (mktl, CloudRedirect, a SteamTools proxy…) so the
#    hijack DLLs only load OpenSteamTool.dll AND other managers stop showing their
#    backend as active — the actual "switch to OST".
Disable-ForeignEngines $steam

# 7. point OST at the existing stplug-in library
@"
[manifest]
url = "opensteamtool"

[stats]
enable_api = true

[lua]
paths = ["config/stplug-in"]
"@ | Set-Content (Join-Path $steam "opensteamtool.toml") -Encoding UTF8

Set-OstVersionMarker $steam $rel.tag_name

# 8. restart Steam
Write-Host "[*] Restarting Steam..."
Start-Process (Join-Path $steam "steam.exe")
Start-Sleep 6
Write-Host "`n[OK] OpenSteamTool installed. Sign in to Steam, then redeem your code.`n" -ForegroundColor Green
Start-Sleep 3
