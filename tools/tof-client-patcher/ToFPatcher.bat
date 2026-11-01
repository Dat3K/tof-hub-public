@echo off
setlocal
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ScriptFile='%~f0'; $lines=[System.IO.File]::ReadAllLines($ScriptFile,[System.Text.Encoding]::UTF8); Invoke-Expression ($lines[5..($lines.Length-1)] -join [char]10)"
goto :eof
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
try { $host.UI.RawUI.WindowTitle = "Tower of Fantasy Branch Patcher" } catch {}
Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

$ScriptDir = if ($ScriptFile -and (Test-Path $ScriptFile)) { Split-Path -Parent $ScriptFile } else { (Get-Location).Path }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

# Saved launcher path (persisted directly inside this file)
$SavedLauncherPath = ""

$global:BRANCH_PRESETS = [ordered]@{
    "1" = @{
        BaseName = "Global Live Release"; Category = "GLOBAL"; Tag = "Official"
        Branch = "OBPC_2_5"; LauncherBranch = "HTIntlOB"; LauncherType = "x64"
        AppVersion = "2.5.0"; MinVersion = "2.5.0"; ResVersion = "6.2.3"
        AppId = "1000129"; ChannelAppId = "1000129"; ChannelId = "4"; PackageName = "com.perfect.tof"
        GameResUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        GameGetServerListUrl = @("https://htkrydpatch1.wmupd.com", "https://htkrydpatch2.wmupd.com")
        GameUpdateAssetUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        VersionUrl = "https://htkrydpatch1.wmupd.com/hd/HTIntlOB/launcher/Version.ini"
        BackupVersionUrl = "https://htkrydpatch2.wmupd.com/hd/HTIntlOB/launcher/Version.ini"
        PatchDevices = $false
    }
    "2" = @{
        BaseName = "Global Pioneer"; Category = "TEST"; Tag = "Official Test"
        Branch = "OBPC_Xianqian"; LauncherBranch = "HTIntlPTR"; LauncherType = "x64"
        AppVersion = "0.0"; MinVersion = "0.0"; ResVersion = "6.3.1"
        AppId = "1000129"; ChannelAppId = "1000129"; ChannelId = "4"; PackageName = "com.perfect.tof"
        GameResUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        GameGetServerListUrl = @("https://htkrydpatch1.wmupd.com", "https://htkrydpatch2.wmupd.com")
        GameUpdateAssetUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        VersionUrl = "https://htkrydpatch1.wmupd.com/hd/HTIntlPTR/launcher/Version.ini"
        BackupVersionUrl = "https://htkrydpatch2.wmupd.com/hd/HTIntlPTR/launcher/Version.ini"
        PatchDevices = $true
    }
    "3" = @{
        BaseName = "Korea Live Release"; Category = "GLOBAL"; Tag = "Official"
        Branch = "OBPC_2_5"; LauncherBranch = "HTKrOB"; LauncherType = "x64"
        AppVersion = "2.5.0"; MinVersion = "2.5.0"; ResVersion = "6.2.3"
        AppId = "200124"; ChannelAppId = "1000129"; ChannelId = "4"; PackageName = "com.perfect.tof"
        GameResUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        GameGetServerListUrl = @("https://htkrydpatch1.wmupd.com", "https://htkrydpatch2.wmupd.com")
        GameUpdateAssetUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        VersionUrl = "https://htkrydpatch1.wmupd.com/hd/HTKrOB/launcher/Version.ini"
        BackupVersionUrl = "https://htkrydpatch2.wmupd.com/hd/HTKrOB/launcher/Version.ini"
        PatchDevices = $false
    }
    "4" = @{
        BaseName = "Korea Dev 1"; Category = "TEST"; Tag = "Dev Server"
        Branch = "TestPC_KR2New"; LauncherBranch = "TestPC_KR2New"; LauncherType = "x64"
        AppVersion = "3.0.0"; MinVersion = "3.0.0"; ResVersion = "6.3.11"
        AppId = "1000129"; ChannelAppId = "1000129"; ChannelId = "4"; PackageName = "com.perfect.tof"
        GameResUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        GameGetServerListUrl = @("https://htkrydpatch1.wmupd.com", "https://htkrydpatch2.wmupd.com")
        GameUpdateAssetUrl = @("https://htkrydpatch1.wmupd.com", "https://htkrydpatch2.wmupd.com")
        VersionUrl = "https://htkrydpatch1.wmupd.com/hd/TestPC_KR2New/launcher/Version.ini"
        BackupVersionUrl = "https://htkrydpatch2.wmupd.com/hd/TestPC_KR2New/launcher/Version.ini"
        PatchDevices = $true
    }
    "5" = @{
        BaseName = "Korea Dev 2"; Category = "TEST"; Tag = "Dev Server v2.5"
        Branch = "TestPC_KRNew"; LauncherBranch = "TestPC_KRNew"; LauncherType = "x64"
        AppVersion = "2.5.0"; MinVersion = "2.5.0"; ResVersion = "6.2.19"
        AppId = "1000129"; ChannelAppId = "1000129"; ChannelId = "4"; PackageName = "com.perfect.tof"
        GameResUrl = @("https://htkrydpatch1.wmupd.com/clientRes", "https://htkrydpatch2.wmupd.com/clientRes")
        GameGetServerListUrl = @("https://htkrydpatch1.wmupd.com", "https://htkrydpatch2.wmupd.com")
        GameUpdateAssetUrl = @("https://htkrydpatch1.wmupd.com", "https://htkrydpatch2.wmupd.com")
        VersionUrl = "https://htkrydpatch1.wmupd.com/hd/TestPC_KRNew/launcher/Version.ini"
        BackupVersionUrl = "https://htkrydpatch2.wmupd.com/hd/TestPC_KRNew/launcher/Version.ini"
        PatchDevices = $true
    }
    "6" = @{
        BaseName = "Taiwan Live Release"; Category = "GLOBAL"; Tag = "Iwplay Official"
        Branch = "OBPC_2_5"; LauncherBranch = "HTTwOB"; LauncherType = "x64"
        AppVersion = "2.5.0"; MinVersion = "2.5.0"; ResVersion = "6.2.2"
        AppId = "2000003"; ChannelAppId = "2000003"; ChannelId = "4"; PackageName = "tw.com.iwplay.ht"
        GameResUrl = @("https://patchht1.iwplay.com.tw/clientRes", "https://patchht2.iwplay.com.tw/clientRes")
        GameGetServerListUrl = @("https://patchht1.iwplay.com.tw", "https://patchht2.iwplay.com.tw")
        GameUpdateAssetUrl = @("https://patchht1.iwplay.com.tw/clientRes", "https://patchht2.iwplay.com.tw/clientRes")
        VersionUrl = "https://patchht1.iwplay.com.tw/hd/HTTwOB/launcher/Version.ini"
        BackupVersionUrl = "https://patchht2.iwplay.com.tw/hd/HTTwOB/launcher/Version.ini"
        PatchDevices = $false
    }
    "7" = @{
        BaseName = "Taiwan Test 1"; Category = "TEST"; Tag = "Iwplay PTR"
        Branch = "TestPC_IW_3_0_0"; LauncherBranch = "HTTwTest"; LauncherType = "x64"
        AppVersion = "3.0.0"; MinVersion = "3.0.0"; ResVersion = "6.3.2"
        AppId = "2000003"; ChannelAppId = "2000003"; ChannelId = "4"; PackageName = "tw.com.iwplay.ht"
        GameResUrl = @("https://patchht1.iwplay.com.tw/clientRes", "https://patchht2.iwplay.com.tw/clientRes")
        GameGetServerListUrl = @("https://patchht1.iwplay.com.tw", "https://patchht2.iwplay.com.tw")
        GameUpdateAssetUrl = @("https://patchht1.iwplay.com.tw/clientRes", "https://patchht2.iwplay.com.tw/clientRes")
        VersionUrl = "https://patchht1.iwplay.com.tw/hd/HTTwTest/launcher/Version.ini"
        BackupVersionUrl = "https://patchht2.iwplay.com.tw/hd/HTTwTest/launcher/Version.ini"
        PatchDevices = $true
    }
    "8" = @{
        BaseName = "Taiwan Test 2"; Category = "TEST"; Tag = "Iwplay Alpha"
        Branch = "TestPC_IW_2_5_0"; LauncherBranch = "HTTwAlphaTest"; LauncherType = "wmgp_legacy"
        AppVersion = "2.5.0"; MinVersion = "2.5.0"; ResVersion = "6.2.6"
        AppId = "200122"; ChannelAppId = "200122"; ChannelId = "4"; PackageName = "tw.com.iwplay.ht"
        GameResUrl = @("https://patchht1.iwplay.com.tw/clientRes", "https://patchht2.iwplay.com.tw/clientRes")
        GameGetServerListUrl = @("https://patchht1.iwplay.com.tw", "https://patchht2.iwplay.com.tw")
        GameUpdateAssetUrl = @("https://patchht1.iwplay.com.tw/clientRes", "https://patchht2.iwplay.com.tw/clientRes")
        VersionUrl = "https://patchht2.iwplay.com.tw/hd/HTTwAlphaTest/launcher/Version.ini"
        BackupVersionUrl = "https://patchht2.iwplay.com.tw/hd/HTTwAlphaTest/launcher/Version.ini"
        PatchDevices = $false
    }
    "9" = @{
        BaseName = "China Live Release"; Category = "CHINA"; Tag = "Hotta Official"
        Branch = "Windows55"; LauncherBranch = "htob"; LauncherType = "wmgp_legacy"
        AppVersion = "0.0"; MinVersion = "0.0"; ResVersion = "6.3.3"
        AppId = "1256"; ChannelAppId = "10392"; ChannelId = "9"; PackageName = "com.hottagames.qrsl"
        GameResUrl = @("https://htcdn2.wmupd.com/clientRes", "https://htcdn1.wmupd.com/clientRes")
        GameGetServerListUrl = @("https://htcdn1.wmupd.com", "https://htcdn2.wmupd.com")
        GameUpdateAssetUrl = @("https://htcdn1.wmupd.com/clientRes", "https://htcdn2.wmupd.com/clientRes")
        VersionUrl = "https://htcdn2.wmupd.com/hd/htob/launcher/Version.ini"
        BackupVersionUrl = "https://htcdn1.wmupd.com/hd/htob/launcher/Version.ini"
        PatchDevices = $false
    }
    "10" = @{
        BaseName = "China CBT"; Category = "CHINA"; Tag = "Wanmei CBT"
        Branch = "AdvLaunch64"; LauncherBranch = "AdvLaunch30"; LauncherType = "wmgp_legacy"
        AppVersion = "0.0"; MinVersion = "0.0"; ResVersion = "6.4.1"
        AppId = "1256"; ChannelAppId = "10392"; ChannelId = "9"; PackageName = "com.hottagames.qrsl"
        GameResUrl = @("https://htcdn2.wmupd.com/clientRes", "https://htcdn1.wmupd.com/clientRes")
        GameGetServerListUrl = @("https://htcdn1.wmupd.com", "https://htcdn2.wmupd.com")
        GameUpdateAssetUrl = @("https://htcdn1.wmupd.com/clientRes", "https://htcdn2.wmupd.com/clientRes")
        VersionUrl = "https://htcdn2.wmupd.com/hd/AdvLaunch30/launcher/Version.ini"
        BackupVersionUrl = "https://htcdn1.wmupd.com/hd/AdvLaunch30/launcher/Version.ini"
        PatchDevices = $false
    }
}

function Remove-ReadOnly($p) {
    if (Test-Path $p) {
        try {
            $attrs = [System.IO.File]::GetAttributes($p)
            $clean = ($attrs -band (-bnot [System.IO.FileAttributes]::ReadOnly)) -bor [System.IO.FileAttributes]::Archive
            [System.IO.File]::SetAttributes($p, $clean)
        } catch {
            try { [System.IO.File]::SetAttributes($p, [System.IO.FileAttributes]::Archive) } catch {}
        }
    }
}

function Set-ReadOnly($p) {
    if (Test-Path $p) {
        try {
            $attrs = [System.IO.File]::GetAttributes($p)
            $withRo = $attrs -bor [System.IO.FileAttributes]::ReadOnly -bor [System.IO.FileAttributes]::Archive
            [System.IO.File]::SetAttributes($p, $withRo)
        } catch {
            try { [System.IO.File]::SetAttributes($p, [System.IO.FileAttributes]::ReadOnly -bor [System.IO.FileAttributes]::Archive) } catch {}
        }
    }
}

function Save-SelfPath($newPath) {
    if (-not $ScriptFile -or -not (Test-Path $ScriptFile)) { return }
    if ($newPath -eq $script:SavedLauncherPath) { return }
    try {
        $content = [System.IO.File]::ReadAllText($ScriptFile, [System.Text.Encoding]::UTF8)
        $oldLine = '$SavedLauncherPath = "' + $script:SavedLauncherPath + '"'
        $newLine = '$SavedLauncherPath = "' + $newPath + '"'
        if ($content.Contains($oldLine)) {
            $content = $content.Replace($oldLine, $newLine)
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($ScriptFile, $content, $utf8NoBom)
            $script:SavedLauncherPath = $newPath
        }
    } catch {}
}

function Get-InstallationAt($dir) {
    if (-not $dir -or -not (Test-Path -LiteralPath $dir -PathType Container)) {
        return @{ Detected = $false; GameRoot = $null; LauncherDir = $null }
    }

    # 1. Is $dir itself a launcher directory?
    $leaf = Split-Path -Leaf $dir
    if ($leaf -match '^(?i)(hottalaunch|wmgplaunch)$') {
        $parent = Split-Path -Parent $dir
        return @{ Detected = $true; GameRoot = $parent; LauncherDir = $dir }
    }

    # 2. Does $dir have HottaLaunch or WmGpLaunch subfolder?
    $h = Join-Path $dir "HottaLaunch"
    if (Test-Path -LiteralPath $h -PathType Container) {
        return @{ Detected = $true; GameRoot = $dir; LauncherDir = $h }
    }
    $w = Join-Path $dir "WmGpLaunch"
    if (Test-Path -LiteralPath $w -PathType Container) {
        return @{ Detected = $true; GameRoot = $dir; LauncherDir = $w }
    }

    # A root bootstrap executable is not a launcher subdirectory.
    if ((Test-Path -LiteralPath (Join-Path $dir "Client\WindowsNoEditor\Hotta") -PathType Container) -or
        (Test-Path -LiteralPath (Join-Path $dir "HottaLauncher.exe") -PathType Leaf) -or
        (Test-Path -LiteralPath (Join-Path $dir "gameLauncher.exe") -PathType Leaf)) {
        return @{ Detected = $true; GameRoot = $dir; LauncherDir = $h }
    }

    return @{ Detected = $false; GameRoot = $null; LauncherDir = $null }
}

function Detect-GameInstallation($dir) {
    if (-not $dir -or -not (Test-Path -LiteralPath $dir -PathType Container)) {
        return @{ Detected = $false; GameRoot = $null; LauncherDir = $null }
    }
    $dir = (Get-Item -LiteralPath $dir).FullName
    $found = Get-InstallationAt $dir
    if ($found.Detected) { return $found }

    # Search below the selected folder, at most two levels. Never follow junctions.
    $level = @($dir)
    $candidates = @{}
    for ($depth = 1; $depth -le 2; $depth++) {
        $next = @()
        foreach ($current in $level) {
            foreach ($child in (Get-ChildItem -LiteralPath $current -Directory -ErrorAction SilentlyContinue)) {
                if ($child.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { continue }
                $found = Get-InstallationAt $child.FullName
                if ($found.Detected) { $candidates[$found.GameRoot] = $found }
                else { $next += $child.FullName }
            }
        }
        $level = $next
    }
    if ($candidates.Count -gt 1) {
        throw ("Multiple game installations found. Enter the exact game folder: " + (($candidates.Keys | Sort-Object) -join '; '))
    }
    if ($candidates.Count -eq 1) { return @($candidates.Values)[0] }

    # Also support a BAT inside Client or another folder up to two levels below root.
    $parent = $dir
    for ($depth = 1; $depth -le 2; $depth++) {
        $parent = Split-Path -Parent $parent
        if (-not $parent) { break }
        $found = Get-InstallationAt $parent
        if ($found.Detected) { return $found }
    }
    return @{ Detected = $false; GameRoot = $null; LauncherDir = $null }
}

function Get-CurrentClientState($launcherDir, $gameRoot) {
    $state = @{
        Name = "Unknown client"
        Branch = "Unknown"
        ResVersion = "Unknown"
    }
    if (-not $launcherDir -or -not (Test-Path $launcherDir)) { return $state }

    # Try reading Config.ini
    $cfgIni = Join-Path $launcherDir "Config\Config.ini"
    if (Test-Path $cfgIni) {
        try {
            $lines = Get-Content $cfgIni -Encoding UTF8
            foreach ($line in $lines) {
                if ($line -match '^\s*Branch\s*=\s*(.+)$') {
                    $state.Branch = $matches[1].Trim()
                    break
                }
            }
        } catch {}
    }

    # Try reading ResVersion from local PatcherSDK cache
    $sdkXml = Join-Path $launcherDir "UserData\Patcher\PatcherSDK\config.xml"
    if (Test-Path $sdkXml) {
        try {
            $xml = Get-Content $sdkXml -Raw -Encoding UTF8
            if ($xml -match '<ResVersion>(.*?)</ResVersion>') {
                $state.ResVersion = $matches[1].Trim()
            }
        } catch {}
    }

    # Fallback to PatcherConfig.json if branch or resVersion still unknown
    if ($state.Branch -eq "Unknown" -or $state.ResVersion -eq "Unknown") {
        $searchDirs = @($launcherDir, $gameRoot)
        foreach ($sDir in $searchDirs) {
            if ($sDir -and (Test-Path $sDir)) {
                $pjs = Get-ChildItem -Path $sDir -Filter "PatcherConfig.json" -Recurse -Depth 3 -ErrorAction SilentlyContinue
                if ($pjs -and $pjs.Count -gt 0) {
                    try {
                        $pContent = Get-Content $pjs[0].FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                        if ($state.Branch -eq "Unknown" -and $pContent.branchName) {
                            $state.Branch = [string]$pContent.branchName
                        }
                        if ($state.ResVersion -eq "Unknown" -and $pContent.appVersion) {
                            $state.ResVersion = [string]$pContent.appVersion
                        }
                    } catch {}
                    break
                }
            }
        }
    }

    if ($state.Branch -ne "Unknown") {
        foreach ($k in $global:BRANCH_PRESETS.Keys) {
            $p = $global:BRANCH_PRESETS[$k]
            if ($p.LauncherBranch -eq $state.Branch -or $p.Branch -eq $state.Branch) {
                $state.Name = $p.BaseName
                break
            }
        }
        if ($state.Name -eq "Unknown client") {
            $state.Name = "Custom / unlisted branch"
        }
    }

    return $state
}

function Resolve-TargetDirs($inputPath) {
    $clean = $inputPath.Trim().Trim('"').Trim("'")
    if ([string]::IsNullOrWhiteSpace($clean)) { return $null, $null }
    $clean = [System.IO.Path]::GetFullPath($clean)
    try { $found = Detect-GameInstallation $clean } catch {
        Write-Host "[-] $_" -ForegroundColor Red
        return $null, $null
    }
    if ($found.Detected) { return $found.GameRoot, $found.LauncherDir }
    if (-not (Test-Path -LiteralPath $clean -PathType Container)) {
        try {
            New-Item -ItemType Directory -Path $clean -Force | Out-Null
            Write-Host "[+] Created new directory: $clean" -ForegroundColor Green
        } catch {
            Write-Host "[-] Failed to create directory $clean : $_" -ForegroundColor Red
            return $null, $null
        }
    }

    $leaf = Split-Path -Leaf $clean
    if ($leaf -match '^(?i)(hottalaunch|wmgplaunch)$') {
        $launcherDir = $clean
        $gameRoot = Split-Path -Parent $clean
    } else {
        $gameRoot = $clean
        $hDir = Join-Path $gameRoot "HottaLaunch"
        $wDir = Join-Path $gameRoot "WmGpLaunch"
        if (Test-Path -LiteralPath $hDir -PathType Container) { $launcherDir = $hDir }
        elseif (Test-Path -LiteralPath $wDir -PathType Container) { $launcherDir = $wDir }
        else { $launcherDir = $hDir }
    }
    return $gameRoot, $launcherDir
}

function Read-OfficialLauncherBytes($url, $client, $token) {
    $response = $client.GetAsync([string]$url, $token).GetAwaiter().GetResult()
    try {
        $response.EnsureSuccessStatusCode() | Out-Null
        return ,($response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult())
    } finally { $response.Dispose() }
}

function Resolve-OfficialLauncherPreset($preset, $client) {
    $allowedHosts = @($preset.GameResUrl | ForEach-Object { ([Uri]$_).Host })
    foreach ($versionUrl in @($preset.VersionUrl, $preset.BackupVersionUrl) | Select-Object -Unique) {
        $deadline = New-Object System.Threading.CancellationTokenSource(10000)
        try {
            $ini = [Text.Encoding]::UTF8.GetString((Read-OfficialLauncherBytes $versionUrl $client $deadline.Token))
            if ($ini -notmatch '(?m)^Version\s*=\s*([\d.]+)\s*$') { throw 'Launcher version missing' }
            $launcherVersion = $matches[1]
            if ($ini -notmatch '(?m)^FileListURL\s*=\s*(\S+)\s*$') { throw 'Launcher file list missing' }
            $fileList = New-Object System.UriBuilder($matches[1])
            if ($fileList.Scheme -ne 'https' -or $allowedHosts -notcontains $fileList.Host -or $fileList.UserName -or $fileList.Password -or $fileList.Port -ne 443) { throw 'Unexpected launcher source' }
            $fileList.Host = ([Uri]$versionUrl).Host
            $zipUrl = New-Object System.Uri($fileList.Uri, "ResFilesM/$($preset.AppId)/PatcherConfig/PatcherConfig.json.zip")
            $bytes = Read-OfficialLauncherBytes $zipUrl.AbsoluteUri $client $deadline.Token
            $stream = New-Object System.IO.MemoryStream(,$bytes)
            $archive = New-Object System.IO.Compression.ZipArchive($stream)
            try {
                $entry = $archive.Entries | Where-Object { $_.Name -eq 'PatcherConfig.json' } | Select-Object -First 1
                if (-not $entry -or $entry.Length -gt 2097152) { throw 'Invalid launcher config archive' }
                $reader = New-Object System.IO.StreamReader($entry.Open(), [Text.Encoding]::UTF8)
                try { $config = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
            } finally { $archive.Dispose(); $stream.Dispose() }
            if ($config.branchName -notmatch '^[A-Za-z0-9_-]+$' -or [string]$config.appId -ne [string]$preset.AppId) { throw 'Invalid official branch' }
            $base = $preset.GameResUrl | Where-Object { ([Uri]$_).Host -eq $fileList.Host } | Select-Object -First 1
            if (-not $base) { throw 'Resource CDN missing' }
            $xml = [Text.Encoding]::UTF8.GetString((Read-OfficialLauncherBytes "$base/$($config.branchName)/Version/Windows/config.xml" $client $deadline.Token))
            if ($xml -notmatch '<ResVersion>\s*([\d.]+)\s*</ResVersion>') { throw 'Resource version missing' }
            $result = @{
                Branch = [string]$config.branchName; ResVersion = $matches[1]
                LauncherVersion = $launcherVersion; LauncherFileListUrl = $fileList.Uri.AbsoluteUri
                MetadataVerified = $true
            }
            foreach ($field in @('appVersion', 'minVersion')) {
                if ($config.$field -and $config.$field -match '^\d+(\.\d+)*$') { $result[$field] = [string]$config.$field }
            }
            return $result
        } catch {
            # Try the next official mirror; never substitute an old fixed resource branch.
        } finally { $deadline.Dispose() }
    }
    throw "Cannot resolve the current official launcher for $($preset.BaseName)"
}

function Update-LiveVersions {
    Write-Host '[*] Checking official launcher configurations and game versions...' -ForegroundColor Cyan
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    Add-Type -AssemblyName System.IO.Compression
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds(5)
    $client.MaxResponseContentBufferSize = 2097152
    $client.DefaultRequestHeaders.Add('User-Agent', 'ToF-Branch-Patcher')
    $tasks = @()
    $updatedKeys = @{}
    try {
        foreach ($key in $global:BRANCH_PRESETS.Keys) {
            $preset = $global:BRANCH_PRESETS[$key]
            if ($preset.Category -eq 'CHINA') { continue }
            foreach ($base in $preset.GameResUrl) {
                $url = "$base/$($preset.Branch)/Version/Windows/config.xml"
                $tasks += @{Key = $key; Type = 'Res'; Task = $client.GetStringAsync($url)}
            }
            foreach ($url in @($preset.VersionUrl, $preset.BackupVersionUrl) | Select-Object -Unique) {
                if ($url) { $tasks += @{Key = $key; Type = 'Ver'; Task = $client.GetStringAsync($url)} }
            }
        }
        # Discovery finishes before any Chinese version is committed. Static responses cannot overwrite it.
        foreach ($key in $global:BRANCH_PRESETS.Keys) {
            $preset = $global:BRANCH_PRESETS[$key]
            if ($preset.Category -ne 'CHINA') { continue }
            $preset.MetadataVerified = $false
            try {
                $resolved = Resolve-OfficialLauncherPreset $preset $client
                foreach ($field in $resolved.Keys) { $preset[$field] = $resolved[$field] }
                $updatedKeys[$key] = $true
                Write-Host ("[+] {0}: {1}, game {2}, launcher {3}" -f $preset.BaseName, $preset.Branch, $preset.ResVersion, $preset.LauncherVersion) -ForegroundColor Green
            } catch {
                $preset.ResVersion = $null
                Write-Host ("[-] {0}: current launcher configuration unavailable. Press R to retry." -f $preset.BaseName) -ForegroundColor Yellow
            }
        }
        foreach ($item in $tasks) {
            try {
                $data = $item.Task.GetAwaiter().GetResult()
                if ($item.Type -eq 'Res' -and -not $updatedKeys.ContainsKey($item.Key) -and $data -match '<ResVersion>\s*([\d.]+)\s*</ResVersion>') {
                    $global:BRANCH_PRESETS[$item.Key].ResVersion = $matches[1]
                    $updatedKeys[$item.Key] = $true
                } elseif ($item.Type -eq 'Ver' -and $data -match '(?m)^Version\s*=\s*([\d.]+)\s*$') {
                    $global:BRANCH_PRESETS[$item.Key].LauncherVersion = $matches[1]
                }
            } catch {}
        }
    } finally { $client.Dispose() }
    Write-Host ("[+] Retrieved live versions ({0}/{1})`n" -f $updatedKeys.Count, $global:BRANCH_PRESETS.Count) -ForegroundColor Green
}

function Patch-PatcherSDK($dllPath) {
    if (-not (Test-Path $dllPath)) { return }
    $bak = "$dllPath.orig"
    if (-not (Test-Path $bak)) {
        try { Copy-Item $dllPath $bak -Force } catch {}
    }

    # Always read from clean backup if available to prevent corrupted double-patching
    $sourceFile = if (Test-Path $bak) { $bak } else { $dllPath }
    $bytes = [System.IO.File]::ReadAllBytes($sourceFile)

    # 1. Whitelist bypass: pattern 0x40, 0x84, 0xFF, 0x74
    $patchedCount = 0
    for ($i = 0; $i -lt ($bytes.Length - 4); $i++) {
        if ($bytes[$i] -eq 0x40 -and $bytes[$i+1] -eq 0x84 -and $bytes[$i+2] -eq 0xFF -and $bytes[$i+3] -eq 0x74) {
            $start = [Math]::Max(0, $i - 128)
            $len = [Math]::Min($bytes.Length - $start, 256)
            $sub = [System.Text.Encoding]::ASCII.GetString($bytes, $start, $len)
            if ($sub.Contains("Device") -or $i -eq 0xF5C42 -or ($bytes[$i-3] -eq 0x49 -and $bytes[$i-2] -eq 0x8B -and $bytes[$i-1] -eq 0xCE)) {
                $bytes[$i + 3] = 0x90
                $bytes[$i + 4] = 0x90
                $patchedCount++
            }
        }
    }
    if ($patchedCount -gt 0) {
        Write-Host "[+] Hardware whitelist bypass successfully activated!" -ForegroundColor Green
    }

    # 2. Dual null pointer fix
    try {
        $e_lfanew = [BitConverter]::ToUInt32($bytes, 0x3C)
        $imageBase = [BitConverter]::ToUInt64($bytes, $e_lfanew + 24 + 24)
        $numSections = [BitConverter]::ToUInt16($bytes, $e_lfanew + 6)
        $optSize = [BitConverter]::ToUInt16($bytes, $e_lfanew + 20)
        $secTable = $e_lfanew + 24 + $optSize

        $textVa = $null; $textVsize = $null; $textRsize = $null; $textRoff = $null
        for ($s = 0; $s -lt $numSections; $s++) {
            $sec = $secTable + $s * 40
            $sName = [System.Text.Encoding]::ASCII.GetString($bytes, $sec, 8).Trim([char]0)
            if ($sName.Contains(".text")) {
                $textVsize = [BitConverter]::ToUInt32($bytes, $sec + 8)
                $textVa = [BitConverter]::ToUInt32($bytes, $sec + 12)
                $textRsize = [BitConverter]::ToUInt32($bytes, $sec + 16)
                $textRoff = [BitConverter]::ToUInt32($bytes, $sec + 20)
                break
            }
        }

        if ($textVa -and $textVsize) {
            $caveRva = $textVa + $textVsize
            if (($caveRva % 16) -ne 0) { $caveRva += (16 - ($caveRva % 16)) }

            $hookRva = 0x10B1FC
            $returnRva = 0x10B204
            $skipRva = 0x10B284
            $hookAddr = $imageBase + $hookRva
            $caveAddr = $imageBase + $caveRva
            $returnAddr = $imageBase + $returnRva
            $skipAddr = $imageBase + $skipRva

            $cave = New-Object System.Collections.Generic.List[byte]
            $cave.AddRange([byte[]](0x48, 0x85, 0xC0))
            $jzOffset = $skipAddr - ($caveAddr + $cave.Count + 6)
            $cave.AddRange([byte[]](0x0F, 0x84))
            $cave.AddRange([BitConverter]::GetBytes([int]$jzOffset))
            $cave.AddRange([byte[]](0x44, 0x0F, 0xB6, 0xB0, 0x80, 0x02, 0x00, 0x00))
            $jmpOffset = $returnAddr - ($caveAddr + $cave.Count + 5)
            $cave.Add(0xE9)
            $cave.AddRange([BitConverter]::GetBytes([int]$jmpOffset))

            $hookJmpOffset = $caveAddr - ($hookAddr + 5)
            $hook = New-Object System.Collections.Generic.List[byte]
            $hook.Add(0xE9)
            $hook.AddRange([BitConverter]::GetBytes([int]$hookJmpOffset))
            $hook.AddRange([byte[]](0x90, 0x90, 0x90))

            $hookOff = $textRoff + ($hookRva - $textVa)
            $caveOff = $textRoff + ($caveRva - $textVa)

            $fix2Rva = 0x10B562
            $fix2Off = $textRoff + ($fix2Rva - $textVa)
            $fix2Bytes = [byte[]](
                0x40, 0x31, 0xF6,
                0xE3, 0x0C,
                0x80, 0xB9, 0x81, 0x02, 0x00, 0x00, 0x00,
                0x40, 0x0F, 0x95, 0xC6,
                0x90
            )

            if ($bytes[$hookOff] -ne 0xE9) {
                for ($j = 0; $j -lt $cave.Count; $j++) { $bytes[$caveOff + $j] = $cave[$j] }
                for ($j = 0; $j -lt $hook.Count; $j++) { $bytes[$hookOff + $j] = $hook[$j] }
            }
            for ($j = 0; $j -lt $fix2Bytes.Length; $j++) { $bytes[$fix2Off + $j] = $fix2Bytes[$j] }

            Write-Host "[+] PatcherSDK crash guard successfully applied (prevents launcher null-pointer crashes)!" -ForegroundColor Green
        }
    } catch {}

    Remove-ReadOnly $dllPath
    [System.IO.File]::WriteAllBytes($dllPath, $bytes)
}

function Stop-RunningLauncherProcesses {
    $procNames = @('HottaLauncher', 'HottaGame', 'HottaUpdate', 'HottaBrowser', 'HottaWebBooster', 'WmgpLauncher', 'WmgpMobileGame', 'WmgpUpdate', 'gameLauncher')
    $running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $procNames -contains $_.ProcessName }
    if ($running) {
        Write-Host "[*] Closing active game launcher processes to allow file updates..." -ForegroundColor Yellow
        foreach ($p in $running) {
            try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Start-Sleep -Milliseconds 600
    }
}

function Apply-PresetX64($gameRoot, $launcherDir, $preset) {
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host (" Applying preset (64-bit): {0} (v{1})" -f $preset.BaseName, $preset.ResVersion) -ForegroundColor White
    Write-Host (" Target launcher: {0}" -f $launcherDir) -ForegroundColor Gray
    Write-Host "============================================================`n" -ForegroundColor Cyan

    Stop-RunningLauncherProcesses
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null

    $mainExe = Join-Path $launcherDir "HottaLauncher.exe"
    $updateExe = Join-Path $launcherDir "HottaUpdate.exe"
    $gameExe = Join-Path $launcherDir "HottaGame.exe"

    # Bootstrap check for clean folder
    if (-not (Test-Path $updateExe) -and -not (Test-Path $mainExe)) {
        $tpl = Join-Path $ScriptDir "components\hotta_launcher\HottaLaunch"
        if (Test-Path $tpl) {
            Write-Host "[*] Clean folder detected: deploying 64-bit HottaLaunch bootstrapper (from local components)..." -ForegroundColor Yellow
            Copy-Item "$tpl\*" $launcherDir -Recurse -Force
            Write-Host "[+] HottaLaunch bootstrapper deployed successfully!" -ForegroundColor Green
        } else {
            Write-Host "[*] Clean folder detected: downloading official HottaLaunch core from CDN (~3 MB)..." -ForegroundColor Yellow
            $cdnFiles = @(
                @{ Url = "https://htkrydpatch1.wmupd.com/hd/HTIntlPTR/launcher/1.1.5.0728_5/HottaLauncher.exe.zip"; Out = "HottaLauncher.exe" },
                @{ Url = "https://htkrydpatch1.wmupd.com/hd/HTIntlPTR/launcher/1.1.5.0728_5/HottaUpdate.exe.zip"; Out = "HottaUpdate.exe" },
                @{ Url = "https://htkrydpatch1.wmupd.com/hd/HTIntlPTR/launcher/1.1.5.0728_5/HttpDownloader.dll.zip"; Out = "HttpDownloader.dll" },
                @{ Url = "https://htkrydpatch1.wmupd.com/hd/HTIntlPTR/launcher/1.1.5.0728_5/PatcherSDK_x64.dll.zip"; Out = "PatcherSDK_x64.dll" }
            )
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "Mozilla/5.0")
            foreach ($cf in $cdnFiles) {
                $tmpZip = Join-Path $launcherDir "$($cf.Out).zip"
                try {
                    $wc.DownloadFile($cf.Url, $tmpZip)
                    Add-Type -AssemblyName System.IO.Compression.FileSystem
                    [System.IO.Compression.ZipFile]::ExtractToDirectory($tmpZip, $launcherDir)
                    Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
                } catch {
                    Write-Host "[-] Failed to download $($cf.Out): $_" -ForegroundColor Red
                }
            }
            Write-Host "[+] Official HottaLaunch core downloaded and deployed successfully!" -ForegroundColor Green
        }
    }

    # 1. Config.ini (MUST be UTF-8 WITHOUT BOM for Win32 GetPrivateProfileString compatibility)
    $cfgIni = Join-Path $launcherDir "Config\Config.ini"
    Remove-ReadOnly $cfgIni
    New-Item -ItemType Directory -Path (Split-Path -Parent $cfgIni) -Force | Out-Null

    $lVer = if ($preset.LauncherVersion) { $preset.LauncherVersion } else { "1.1.5.0728" }
    $cfgContent = @"
[General]
Launcher=HottaLauncher.exe
Patcher=HottaUpdate.exe
Client=HottaGame.exe
Browser=HottaBrowser.exe
BrowserBooster=HottaWebBooster.exe
ErrRep=HottaErrRep.exe
ProductID=2
GameID=$($preset.AppId)
GameType=10
OneAppId=$($preset.AppId)
PackageName=$($preset.PackageName)
channelAppId=$($preset.ChannelAppId)
channelId=$($preset.ChannelId)
Animation=1
saveAccount=1
NDID=2
Admin=1
Dev=1

[VERSION]
Version=$lVer
Build=e31cc55c
VersionInfoFileURL=$($preset.VersionUrl)
serialNumber=4

[Global]
reg=TowerOfFantasy_Global

[UPDATE_CONFIG]
ProductName=54006F0077006500720020006F0066002000460061006E007400610073007900
LaunchFilePath=HottaGame.exe
LaunchCmdLine=/launcher
MutexName=[WMGP_UPDATE_MUTEX_NAME]
DetectMutexCount=1
DetectMutexName1=[WMGP_CLIENT_MUTEX_NAME]
Language=en
SupportLanguages=en;zh-cn;de;fr;ru;es;pt;id;ja;ko;th;
Hex=1
BackupServer=https://htkrydpatch1.wmupd.com;https://htkrydpatch2.wmupd.com
BackupVersionURL=$($preset.BackupVersionUrl)
Branch=$($preset.LauncherBranch)

[Game]
AutoInstallPlugin=0
cmd6=-d3d11
Publisher=Fedeen
loginByWebCanSwitch=0
canSwitchVersion=1

[Gplauncher]
Name=HottaLauncher
"@
    [System.IO.File]::WriteAllText($cfgIni, $cfgContent, $utf8NoBom)
    Set-ReadOnly $cfgIni
    Write-Host ("[+] Protected against overwrite (+r) Config.ini ({0}, v{1})" -f $preset.LauncherBranch, $lVer) -ForegroundColor Green

    # 2. PatcherConfig.json across ResFilesM
    $resM = Join-Path $launcherDir "ResFilesM"
    if (Test-Path $resM) {
        Get-ChildItem $resM -Directory | ForEach-Object {
            $pJson = Join-Path $_.FullName "PatcherConfig\PatcherConfig.json"
            if (Test-Path $pJson) {
                Remove-ReadOnly $pJson
                $bak = "$pJson.bak"
                if (-not (Test-Path $bak)) { Copy-Item $pJson $bak -Force }
                try {
                    $jsonObj = Get-Content $pJson -Raw -Encoding UTF8 | ConvertFrom-Json
                } catch { $jsonObj = [ordered]@{} }

                $props = @{
                    branchName = $preset.Branch
                    appVersion = $preset.AppVersion
                    minVersion = $preset.MinVersion
                    gameResUrl = $preset.GameResUrl
                    gameGetServerListUrl = $preset.GameGetServerListUrl
                    appId = [string]$preset.AppId
                    gameUpdateAssetUrl = $preset.GameUpdateAssetUrl
                }
                foreach ($k in $props.Keys) {
                    if ($jsonObj.PSObject.Properties[$k]) {
                        $jsonObj.$k = $props[$k]
                    } else {
                        $jsonObj | Add-Member -NotePropertyName $k -NotePropertyValue $props[$k] -Force
                    }
                }

                $newJson = $jsonObj | ConvertTo-Json -Depth 5
                [System.IO.File]::WriteAllText($pJson, $newJson, $utf8NoBom)
                Set-ReadOnly $pJson
                Write-Host ("[+] Protected against overwrite (+r) PatcherConfig: {0}" -f $pJson) -ForegroundColor Green
            }
        }
    }

    # Ensure default ResFilesM directory structure and PatcherConfig.json exist for the preset
    $defaultPJson = Join-Path $launcherDir "ResFilesM\$($preset.AppId)\PatcherConfig\PatcherConfig.json"
    $defaultPDir = Split-Path -Parent $defaultPJson
    if (-not (Test-Path $defaultPJson)) {
        New-Item -ItemType Directory -Path $defaultPDir -Force | Out-Null
        $initProps = [ordered]@{
            branchName = $preset.Branch
            appVersion = $preset.AppVersion
            minVersion = $preset.MinVersion
            gameResUrl = $preset.GameResUrl
            gameGetServerListUrl = $preset.GameGetServerListUrl
            appId = [string]$preset.AppId
            gameUpdateAssetUrl = $preset.GameUpdateAssetUrl
        }
        $initJson = $initProps | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($defaultPJson, $initJson, $utf8NoBom)
        Set-ReadOnly $defaultPJson
        Write-Host ("[+] Created and protected PatcherConfig.json: {0}" -f $defaultPJson) -ForegroundColor Green
    }

    # 3. Clear cache, lupdatetemp and reset UserData branch cache
    $lupdate = Join-Path $launcherDir "lupdatetemp"
    $sdkCache = Join-Path $launcherDir "UserData\Patcher\PatcherSDK"
    if (Test-Path $lupdate) { try { Remove-Item $lupdate -Recurse -Force -ErrorAction SilentlyContinue } catch {} }
    if (Test-Path $sdkCache) { try { Remove-Item $sdkCache -Recurse -Force -ErrorAction SilentlyContinue } catch {} }

    $userCfg = Join-Path $launcherDir "UserData\Config\Config.ini"
    if (Test-Path $userCfg) {
        Remove-ReadOnly $userCfg
        try {
            $uContent = [System.IO.File]::ReadAllText($userCfg)
            $uContent = $uContent -replace '(?m)^Version_=\S*', 'Version_=0.0'
            $uContent = $uContent -replace '(?m)^NeedUpdate=\S*', 'NeedUpdate=1'
            [System.IO.File]::WriteAllText($userCfg, $uContent, $utf8NoBom)
            Write-Host "[+] Reset UserData branch cache (Version_=0.0, NeedUpdate=1)" -ForegroundColor Green
        } catch {}
    }

    # 4. Patch PatcherSDK_x64.dll
    $dll = Join-Path $launcherDir "PatcherSDK_x64.dll"
    if (Test-Path $dll) {
        Patch-PatcherSDK $dll
    }

    # Copy root HottaLauncher.exe if available for convenient manual startup
    $rootLauncher = Join-Path $gameRoot "HottaLauncher.exe"
    if ((Test-Path $mainExe) -and (-not (Test-Path $rootLauncher))) {
        try { Copy-Item $mainExe $rootLauncher -Force } catch {}
    }

    $target = Resolve-LaunchExecutable $gameRoot $launcherDir

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host " SUCCESS" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host (" Target client : {0}" -f $preset.BaseName) -ForegroundColor White
    Write-Host (" Target branch : {0}" -f $preset.Branch) -ForegroundColor White
    Write-Host (" ResVersion    : {0}" -f $preset.ResVersion) -ForegroundColor White
    Write-Host (" Launcher dir  : {0}" -f $launcherDir) -ForegroundColor Gray
    Prompt-AndLaunch $target.ExePath $target.Args $target.IsClient
}

function Apply-PresetLegacy($gameRoot, $preset) {
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host (" Deploying and configuring (32-bit WmGpLaunch): {0} (v{1})" -f $preset.BaseName, $preset.ResVersion) -ForegroundColor White
    Write-Host (" Target game directory: {0}" -f $gameRoot) -ForegroundColor Gray
    Write-Host "============================================================`n" -ForegroundColor Cyan

    Stop-RunningLauncherProcesses
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    $wmgpDir = Join-Path $gameRoot "WmGpLaunch"
    $launcherTarget = Join-Path $gameRoot "gameLauncher.exe"
    $wmgpUpdate = Join-Path $wmgpDir "WmgpUpdate.exe"
    $wmgpGame = Join-Path $wmgpDir "WmgpMobileGame.exe"

    New-Item -ItemType Directory -Path $wmgpDir -Force | Out-Null

    if (-not (Test-Path $wmgpUpdate)) {
        $tplRoot = Join-Path $ScriptDir "components\wmgp_launcher"
        $tplWmgp = Join-Path $tplRoot "WmGpLaunch"
        if (Test-Path $tplWmgp) {
            Write-Host "[*] Clean folder detected: deploying 32-bit WmGpLaunch bootstrapper (from local components)..." -ForegroundColor Yellow
            Copy-Item "$tplWmgp\*" $wmgpDir -Recurse -Force
            if (Test-Path (Join-Path $tplRoot "gameLauncher.exe")) {
                Copy-Item (Join-Path $tplRoot "gameLauncher.exe") $launcherTarget -Force
            }
            Write-Host "[+] WmGpLaunch bootstrapper deployed successfully!" -ForegroundColor Green
        } else {
            Write-Host "[*] Clean folder detected: downloading official WmGpLaunch core from CDN (~3 MB)..." -ForegroundColor Yellow
            New-Item -ItemType Directory -Path $wmgpDir -Force | Out-Null

            $coreBase = if ($preset.LauncherFileListUrl) {
                (New-Object System.Uri(([Uri]$preset.LauncherFileListUrl), '.')).AbsoluteUri.TrimEnd('/')
            } elseif ($preset.VersionUrl -like "*HTTwAlphaTest*") {
                "https://patchht2.iwplay.com.tw/hd/HTTwAlphaTest/launcher/1.0.3.0505"
            } elseif ($preset.VersionUrl -like "*htob*") {
                "https://htcdn1.wmupd.com/hd/htob/launcher/1.2.1.0505"
            } else {
                "https://htcdn1.wmupd.com/hd/AdvLaunch30/launcher/1.1.3.0425_11"
            }

            $cdnFiles = @(
                @{ Url = "$coreBase/WmgpUpdate.exe.zip"; Out = "WmgpUpdate.exe" },
                @{ Url = "$coreBase/7z.dll.zip"; Out = "7z.dll" },
                @{ Url = "$coreBase/HttpDownloader.dll.zip"; Out = "HttpDownloader.dll" }
            )
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "Mozilla/5.0")
            foreach ($cf in $cdnFiles) {
                $tmpZip = Join-Path $wmgpDir "$($cf.Out).zip"
                try {
                    $wc.DownloadFile($cf.Url, $tmpZip)
                    Add-Type -AssemblyName System.IO.Compression.FileSystem
                    [System.IO.Compression.ZipFile]::ExtractToDirectory($tmpZip, $wmgpDir)
                    Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
                } catch {
                    Write-Host "[-] Failed to download $($cf.Out): $_" -ForegroundColor Red
                }
            }

            Write-Host "[+] Official WmGpLaunch core downloaded and deployed successfully!" -ForegroundColor Green
        }
    }

    # 1. gameinstallconfig.xml (Required by PatcherSDK for path resolution)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $installXml = Join-Path $gameRoot "gameinstallconfig.xml"
    if (-not (Test-Path $installXml)) {
        $xmlContent = @"
<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<installconfig configversion="1.0" appname="幻塔" appid="$($preset.AppId)">
    <registry language="zh_cn">
        <coreitems>
            <item itemname="PATCHER_PATH" value="%INSTALLDIR%\" />
            <item itemname="LAUNCHER_PATH" value="%INSTALLDIR%\" />
            <item itemname="CLIENT_PATH" value="%INSTALLDIR%\Client\WindowsNoEditor\Hotta\Binaries\Win64\QRSL.exe" />
        </coreitems>
        <appitems />
    </registry>
    <dependency>
        <item image="%INSTALLDIR%\Client\WindowsNoEditor\Engine\Extras\Redist\en-us\UE4PrereqSetup_x64.exe" command="/q /s /silent" />
    </dependency>
</installconfig>
"@
        [System.IO.File]::WriteAllText($installXml, $xmlContent, $utf8NoBom)
        Write-Host ("[+] Configured gameinstallconfig.xml: {0}" -f $installXml) -ForegroundColor Green
    }

    # 2. Config.ini
    $cfgIni = Join-Path $wmgpDir "Config\Config.ini"
    Remove-ReadOnly $cfgIni
    New-Item -ItemType Directory -Path (Split-Path -Parent $cfgIni) -Force | Out-Null

    $lVer = if ($preset.LauncherVersion) { $preset.LauncherVersion } else { "1.0.3.0505" }
    $langLines = if ($preset.AppId -eq "200122") {
"Language=zh-tw
SupportLanguages=zh-tw;"
    } else { "" }

    $cfgText = @"
[General]
Launcher=WmgpLauncher.exe
Patcher=WmgpUpdate.exe
Client=WmgpMobileGame.exe
ProductID=2
GameID=$($preset.AppId)
GameType=10
OneAppId=$($preset.AppId)
PackageName=$($preset.PackageName)
channelAppId=$($preset.ChannelAppId)
channelId=$($preset.ChannelId)
branchDisplayName=$($preset.BaseName)
NDID=2
Admin=1
Dev=1

[VERSION]
Version=$lVer
Build=31625
VersionInfoFileURL=$($preset.VersionUrl)
BranchName=$($preset.LauncherBranch)

[Global]
reg=0

[UPDATE_CONFIG]
ProductName=7B5E5458
LaunchFilePath=WmgpMobileGame.exe
LaunchCmdLine=/launcher
MutexName=[WMGP_UPDATE_MUTEX_NAME]
DetectMutexCount=1
DetectMutexName1=[WMGP_CLIENT_MUTEX_NAME]
$langLines
Hex=1
Branch=$($preset.LauncherBranch)
BackupVersionURL=$($preset.BackupVersionUrl)

[Game]
cmd6=-d3d11

[Gplauncher]
Name=gameLauncher
"@
    [System.IO.File]::WriteAllText($cfgIni, $cfgText, $utf8NoBom)
    Set-ReadOnly $cfgIni
    Write-Host ("[+] Configured launcher Config.ini ({0}, ID={1})" -f $preset.LauncherBranch, $preset.AppId) -ForegroundColor Green

    # 3. PatcherConfig.json (Compact single-line without appId for strict PatcherSDK parser)
    $pJsonDir = Join-Path $wmgpDir "ResFilesM\$($preset.AppId)\PatcherConfig"
    New-Item -ItemType Directory -Path $pJsonDir -Force | Out-Null
    $pJson = Join-Path $pJsonDir "PatcherConfig.json"
    Remove-ReadOnly $pJson

    $pObj = [ordered]@{
        appVersion = $preset.AppVersion
        minVersion = $preset.MinVersion
        gameResUrl = $preset.GameResUrl
        gameGetServerListUrl = $preset.GameGetServerListUrl
        branchName = $preset.Branch
        gameUpdateAssetUrl = $preset.GameUpdateAssetUrl
    }
    $pJsonText = ($pObj | ConvertTo-Json -Depth 5 -Compress)
    [System.IO.File]::WriteAllText($pJson, $pJsonText, $utf8NoBom)
    [System.IO.File]::SetAttributes($pJson, [System.IO.FileAttributes]::Archive)
    Write-Host ("[+] Configured PatcherConfig.json: {0}" -f $pJson) -ForegroundColor Green

    # 4. Copy WmgpLauncher.exe to root gameLauncher.exe if available
    $wmgpLauncher = Join-Path $wmgpDir "WmgpLauncher.exe"
    if ((Test-Path $wmgpLauncher) -and (-not (Test-Path $launcherTarget))) {
        try { Copy-Item $wmgpLauncher $launcherTarget -Force } catch {}
    }

    $target = Resolve-LaunchExecutable $gameRoot $wmgpDir

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host " SUCCESS" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host (" Target client : {0}" -f $preset.BaseName) -ForegroundColor White
    Write-Host (" Target branch : {0}" -f $preset.Branch) -ForegroundColor White
    Write-Host (" ResVersion    : {0}" -f $preset.ResVersion) -ForegroundColor White
    Write-Host (" Game dir      : {0}" -f $gameRoot) -ForegroundColor Gray
    Write-Host "[*] On clean install, the updater downloads launcher UI files before opening the game window." -ForegroundColor Cyan
    Prompt-AndLaunch $target.ExePath $target.Args $target.IsClient
}

function Resolve-LaunchExecutable($gameRoot, $launcherDir) {
    # Determine whether target is a 32-bit legacy client (WmGpLaunch) or 64-bit client (HottaLaunch)
    $isWmGp = ($launcherDir -like "*WmGpLaunch*") -or 
              (Test-Path (Join-Path $launcherDir "WmgpUpdate.exe")) -or 
              (Test-Path (Join-Path $gameRoot "WmGpLaunch\WmgpUpdate.exe")) -or
              (Test-Path (Join-Path $gameRoot "WmGpLaunch"))

    if ($isWmGp) {
        $wDir = if (Test-Path (Join-Path $launcherDir "WmgpUpdate.exe")) { 
            $launcherDir 
        } elseif (Test-Path (Join-Path $gameRoot "WmGpLaunch\WmgpUpdate.exe")) { 
            Join-Path $gameRoot "WmGpLaunch" 
        } else { 
            Join-Path $gameRoot "WmGpLaunch" 
        }
        $wmgpUpdate   = Join-Path $wDir "WmgpUpdate.exe"
        $wmgpGame     = Join-Path $wDir "WmgpMobileGame.exe"
        $wmgpLauncher = Join-Path $wDir "WmgpLauncher.exe"
        $rootLauncher = Join-Path $gameRoot "gameLauncher.exe"

        # 1. Clean bootstrap (first-run): WmgpMobileGame.exe does not exist yet.
        # WmgpUpdate.exe MUST be launched inside WmGpLaunch to download UI files.
        if (-not (Test-Path $wmgpGame) -and (Test-Path $wmgpUpdate)) {
            return @{
                ExePath  = $wmgpUpdate
                Args     = ""
                IsClient = $false
            }
        }

        # 2. Repeat run: gameLauncher.exe in game root or WmgpMobileGame.exe in WmGpLaunch
        if (Test-Path $rootLauncher) {
            return @{
                ExePath  = $rootLauncher
                Args     = ""
                IsClient = $true
            }
        } elseif (Test-Path $wmgpGame) {
            return @{
                ExePath  = $wmgpGame
                Args     = "/launcher"
                IsClient = $true
            }
        } elseif (Test-Path $wmgpUpdate) {
            return @{
                ExePath  = $wmgpUpdate
                Args     = ""
                IsClient = $false
            }
        }
    } else {
        # 64-bit HottaLaunch
        $hDir = if (Test-Path (Join-Path $launcherDir "HottaUpdate.exe")) { 
            $launcherDir 
        } elseif (Test-Path (Join-Path $gameRoot "HottaLaunch\HottaUpdate.exe")) { 
            Join-Path $gameRoot "HottaLaunch" 
        } else { 
            Join-Path $gameRoot "HottaLaunch" 
        }
        $hottaUpdate  = Join-Path $hDir "HottaUpdate.exe"
        $hottaGame    = Join-Path $hDir "HottaGame.exe"
        $hottaLaunch  = Join-Path $hDir "HottaLauncher.exe"
        $rootLaunch   = Join-Path $gameRoot "HottaLauncher.exe"

        # On clean bootstrap (first-run), HottaGame.exe does not exist yet.
        # HottaUpdate.exe MUST be launched to download UI files.
        if (-not (Test-Path $hottaGame) -and (Test-Path $hottaUpdate)) {
            return @{
                ExePath  = $hottaUpdate
                Args     = ""
                IsClient = $false
            }
        }

        # On repeat run: HottaGame exists
        if (Test-Path $rootLaunch) {
            return @{
                ExePath  = $rootLaunch
                Args     = ""
                IsClient = $true
            }
        } elseif (Test-Path $hottaLaunch) {
            return @{
                ExePath  = $hottaLaunch
                Args     = ""
                IsClient = $true
            }
        } elseif (Test-Path $hottaUpdate) {
            return @{
                ExePath  = $hottaUpdate
                Args     = ""
                IsClient = $false
            }
        }
    }

    return @{
        ExePath  = $null
        Args     = ""
        IsClient = $false
    }
}

function Prompt-AndLaunch {
    param(
        [string]$exePath,
        [string]$launchArgs = "",
        [bool]$isClient = $false
    )

    if (-not $exePath -or -not (Test-Path $exePath)) {
        Write-Host "[*] Done. Launch manually: $exePath" -ForegroundColor Gray
        return
    }

    $leafName = Split-Path -Leaf $exePath
    $targetDesc = if ($isClient) { "game launcher ($leafName)" } else { "patcher / updater ($leafName)" }

    Write-Host ""
    try {
        $ans = Read-Host "[?] Launch $targetDesc right now? [Y/n]"
    } catch { return }
    if ($ans -eq $null) { return }
    $ans = if ($ans) { $ans.Trim().ToLower() } else { "y" }
    if ($ans -eq "" -or $ans -eq "y" -or $ans -eq "yes") {
        Write-Host ("[+] Launching {0}..." -f $leafName) -ForegroundColor Green
        $cwd = Split-Path -Parent $exePath
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $exePath
        if ($launchArgs) { $psi.Arguments = $launchArgs }
        $psi.WorkingDirectory = $cwd
        $psi.UseShellExecute = $true
        $psi.Verb = "RunAs"
        try {
            [System.Diagnostics.Process]::Start($psi) | Out-Null
        } catch {
            try {
                Start-Process -FilePath $exePath -ArgumentList $launchArgs -WorkingDirectory $cwd -Verb RunAs
            } catch {
                Start-Process -FilePath $exePath -ArgumentList $launchArgs -WorkingDirectory $cwd
            }
        }
        Start-Sleep -Milliseconds 800
    }
}

function Get-VersionSortKey($verStr) {
    if (-not $verStr -or $verStr -eq "-" -or $verStr -eq "Unknown" -or $verStr -eq "Unavailable") {
        return [long]0
    }
    $parts = ($verStr -replace '[^\d.]', '').Split('.')
    [long]$k = 0
    $weights = @([long]100000000000, [long]10000000, [long]1000, [long]1)
    for ($i = 0; $i -lt [Math]::Min($parts.Length, 4); $i++) {
        [long]$val = 0
        if ([long]::TryParse($parts[$i], [ref]$val)) {
            $k += $val * $weights[$i]
        }
    }
    return $k
}

function Get-MenuItems {
    $menu = [ordered]@{}
    $idx = 1

    # 1. GLOBAL CLIENTS (Global, Korea, Taiwan live)
    foreach ($k in @("1", "3", "6")) {
        if ($global:BRANCH_PRESETS.Contains($k)) {
            $menu[[string]$idx] = $global:BRANCH_PRESETS[$k]
            $idx++
        }
    }

    # 2. TEST CLIENTS (Sorted by ResVersion descending)
    $testKeys = @("2", "4", "5", "7", "8") | Where-Object { $global:BRANCH_PRESETS.Contains($_) }
    $sortedTests = $testKeys | Sort-Object -Descending { Get-VersionSortKey $global:BRANCH_PRESETS[$_].ResVersion }
    foreach ($tk in $sortedTests) {
        $menu[[string]$idx] = $global:BRANCH_PRESETS[$tk]
        $idx++
    }

    # 3. CHINA CLIENTS (China live, China CBT)
    foreach ($k in @("9", "10")) {
        if ($global:BRANCH_PRESETS.Contains($k)) {
            $menu[[string]$idx] = $global:BRANCH_PRESETS[$k]
            $idx++
        }
    }

    return $menu
}

function Show-MainMenu($gameRoot, $launcherDir, $installMode, $menuItems) {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " Tower of Fantasy Branch Patcher & Installer" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""

    if ($installMode -eq "INSTALL_HERE") {
        Write-Host "Mode       : Install launcher (creates a new folder per client)" -ForegroundColor White
        Write-Host ("Directory  : {0}\<ClientName>" -f $ScriptDir) -ForegroundColor Gray
    } else {
        Write-Host ("Game root  : {0}" -f $gameRoot) -ForegroundColor White
        Write-Host ("Launcher   : {0}" -f $launcherDir) -ForegroundColor Gray

        $curState = Get-CurrentClientState $launcherDir $gameRoot
        if ($curState.Branch -ne "Unknown" -or $curState.Name -ne "Unknown client") {
            Write-Host ""
            Write-Host "Current client:" -ForegroundColor White
            Write-Host ("  Name       : {0}" -f $curState.Name) -ForegroundColor Yellow
            Write-Host ("  Branch     : {0}" -f $curState.Branch) -ForegroundColor Gray
            Write-Host ("  ResVersion : {0}" -f $curState.ResVersion) -ForegroundColor Gray
        }
    }
    Write-Host ""

    $sections = @(
        @{ Category = "GLOBAL"; Title = "GLOBAL CLIENTS" },
        @{ Category = "TEST";   Title = "TEST CLIENTS" },
        @{ Category = "CHINA";  Title = "CHINA CLIENTS" }
    )

    foreach ($sec in $sections) {
        Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host $sec.Title -ForegroundColor Cyan
        Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

        foreach ($num in $menuItems.Keys) {
            $p = $menuItems[$num]
            if ($p.Category -eq $sec.Category) {
                  $bLbl = if ($p.Category -eq 'CHINA') { if ($p.MetadataVerified) { $p.Branch } else { 'Unresolved' } } elseif ($p.LauncherBranch) { $p.LauncherBranch } else { $p.Branch }
                $vStr = if ($p.ResVersion) { $p.ResVersion } else { "Unavailable" }
                $vColor = if ($p.ResVersion) { "Green" } else { "DarkGray" }
                $tStr = if ($p.Tag) { $p.Tag } else { "" }

                Write-Host (" [{0,2}] " -f $num) -NoNewline -ForegroundColor Yellow
                Write-Host ("{0,-24} " -f $p.BaseName) -NoNewline -ForegroundColor White
                Write-Host ("{0,-12} " -f $vStr) -NoNewline -ForegroundColor $vColor
                Write-Host ("{0,-15} " -f $bLbl) -NoNewline -ForegroundColor Gray
                Write-Host ("{0}" -f $tStr) -ForegroundColor DarkYellow
            }
        }
        Write-Host ""
    }

    Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "CONTROLS" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " [ R] Rescan server versions" -ForegroundColor White
    Write-Host " [ Q] Exit" -ForegroundColor White
    Write-Host ""
}

# MAIN UI
Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Tower of Fantasy Branch Patcher & Universal Installer" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if script is currently located inside an existing game folder
try { $detected = Detect-GameInstallation $ScriptDir } catch {
    Write-Host "[-] $_" -ForegroundColor Yellow
    $detected = @{ Detected = $false }
}

Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "STARTUP OPTIONS" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " - Put this BAT in the game folder to patch it directly." -ForegroundColor White
Write-Host "   The game can also be one or two folders below this BAT." -ForegroundColor Gray
Write-Host " - OR enter / paste the game folder path below." -ForegroundColor White
Write-Host " - OR press [Enter] to install launcher here" -ForegroundColor White
Write-Host "   (creates a folder with the client name and installs there)." -ForegroundColor Gray
Write-Host ""

$installMode = "INSTALL_HERE"
$gameRoot = $null
$launcherDir = $null

if ($detected.Detected) {
    Write-Host "[+] Game installation detected in current directory:" -ForegroundColor Green
    Write-Host ("    Game root    : {0}" -f $detected.GameRoot) -ForegroundColor White
    Write-Host ("    Launcher dir : {0}" -f $detected.LauncherDir) -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press [Enter] to patch this game," -ForegroundColor Yellow
    Write-Host "or paste another game folder path," -ForegroundColor Gray
    Write-Host "or type 'NEW' / '.' to install a fresh copy here:" -ForegroundColor Gray
    try {
        $userInRaw = Read-Host "Target [Enter = patch detected / Path / NEW]"
    } catch { exit 0 }
    if ($userInRaw -eq $null) { exit 0 }
    $userIn = if ($userInRaw) { $userInRaw.Trim() } else { "" }

    if ($userIn -match '^(?i)(new|here|\.)$') {
        $installMode = "INSTALL_HERE"
    } elseif ($userIn -ne "") {
        $resRoot, $resLaunch = Resolve-TargetDirs $userIn
        if (-not $resRoot -or -not (Test-Path $resRoot)) {
            Write-Host "[-] Error: unable to access directory: $userIn" -ForegroundColor Red
            pause
            exit 1
        }
        $gameRoot = $resRoot
        $launcherDir = $resLaunch
        $installMode = "PATCH"
        Save-SelfPath $launcherDir
    } else {
        # Enter -> patch detected installation
        $gameRoot = $detected.GameRoot
        $launcherDir = $detected.LauncherDir
        $installMode = "PATCH"
        Save-SelfPath $launcherDir
    }
} else {
    Write-Host ("Current directory: {0}" -f $ScriptDir) -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press [Enter] to install launcher here (into client folder)," -ForegroundColor Yellow
    Write-Host "or enter/paste path to an existing game folder:" -ForegroundColor Gray
    try {
        $userInRaw = Read-Host "Game folder [Enter = install here / Path]"
    } catch { exit 0 }
    if ($userInRaw -eq $null) { exit 0 }
    $userIn = if ($userInRaw) { $userInRaw.Trim() } else { "" }

    if ($userIn -ne "" -and $userIn -notmatch '^(?i)(here|\.)$') {
        $resRoot, $resLaunch = Resolve-TargetDirs $userIn
        if (-not $resRoot -or -not (Test-Path $resRoot)) {
            Write-Host "[-] Error: unable to access directory: $userIn" -ForegroundColor Red
            pause
            exit 1
        }
        $gameRoot = $resRoot
        $launcherDir = $resLaunch
        $installMode = "PATCH"
        Save-SelfPath $launcherDir
    } else {
        # Enter -> install launcher here into client named folder
        $installMode = "INSTALL_HERE"
    }
}

Update-LiveVersions

# Main interactive menu loop
while ($true) {
    $menuItems = Get-MenuItems
    Show-MainMenu $gameRoot $launcherDir $installMode $menuItems

    try {
        $choiceRaw = Read-Host "Select target [1-10 / R / Q]"
    } catch { exit 0 }
    if ($choiceRaw -eq $null) { exit 0 }
    $choice = if ($choiceRaw) { $choiceRaw.Trim().ToUpper() } else { "" }

    if ($choice -eq "Q") {
        Write-Host "Exiting." -ForegroundColor Gray
        exit 0
    } elseif ($choice -eq "R") {
        Write-Host ""
        Update-LiveVersions
        Start-Sleep -Milliseconds 800
        continue
    } elseif ($menuItems.Contains($choice)) {
        $preset = $menuItems[$choice]
        if ($preset.Category -eq 'CHINA' -and $preset.MetadataVerified -ne $true) {
            Write-Host '[-] Current official launcher metadata is unavailable. Press R to refresh before selecting this client.' -ForegroundColor Red
            continue
        }

        if ($installMode -eq "INSTALL_HERE") {
            $clientFolderName = ($preset.BaseName -replace '[\\/:*?"<>|]', '_').Trim()
            $targetGameRoot = Join-Path $ScriptDir $clientFolderName
            New-Item -ItemType Directory -Path $targetGameRoot -Force | Out-Null

            if ($preset.LauncherType -eq "wmgp_legacy") {
                Apply-PresetLegacy $targetGameRoot $preset
            } else {
                $targetLauncherDir = Join-Path $targetGameRoot "HottaLaunch"
                Apply-PresetX64 $targetGameRoot $targetLauncherDir $preset
            }
        } else {
            if ($preset.LauncherType -eq "wmgp_legacy") {
                Apply-PresetLegacy $gameRoot $preset
            } else {
                Apply-PresetX64 $gameRoot (Join-Path $gameRoot "HottaLaunch") $preset
            }
        }
        break
    } else {
        Write-Host "[-] Invalid selection: '$choiceRaw'. Press Enter to retry..." -ForegroundColor Red
        try {
            $rl = [System.Console]::ReadLine()
            if ($rl -eq $null) { exit 0 }
        } catch { exit 0 }
    }
}
