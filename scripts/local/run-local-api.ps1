$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workspaceBytes = [Text.Encoding]::UTF8.GetBytes($workspacePath.ToLowerInvariant())
$workspaceHasher = [Security.Cryptography.SHA256]::Create()
try { $workspaceHash = [BitConverter]::ToString($workspaceHasher.ComputeHash($workspaceBytes)).Replace('-', '') }
finally { $workspaceHasher.Dispose() }
$apiMutex = [Threading.Mutex]::new($false, "Local\TofHubApi-$($workspaceHash.Substring(0, 16))")
$ownsApiMutex = $false
$apiExitCode = 0
try {
    try { $ownsApiMutex = $apiMutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $ownsApiMutex = $true }
    if (-not $ownsApiMutex) {
        Write-Host 'The local API is already running or starting. Keeping the existing process.'
    } elseif (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host 'Port 3001 already has an API listener. Keeping the existing process.'
    } else {
        Set-Location -LiteralPath $workspacePath
        if ($env:TOF_HUB_API_WATCH -eq '1') {
            & pnpm --filter api dev
        } else {
            Write-Host 'Building a stable local API. Set TOF_HUB_API_WATCH=1 for automatic API restarts while editing.'
            & pnpm --filter api build
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & pnpm --filter api start
        }
        $apiExitCode = $LASTEXITCODE
    }
} finally {
    if ($ownsApiMutex) { $apiMutex.ReleaseMutex() }
    $apiMutex.Dispose()
}
exit $apiExitCode
