$ErrorActionPreference = 'Stop'

$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $taskRoot 'scripts/deployment/server-common.ps1')
. (Join-Path $taskRoot 'scripts/deployment/ensure-build-dependencies.ps1')

try {
    Initialize-BuildDependencies -Root $taskRoot

    $taskPackageExitCode = 0
    Push-Location $PSScriptRoot
    try {
        $taskPackageArguments = @('run', 'package') + @($args)
        & pnpm.cmd @taskPackageArguments
        $taskPackageExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($taskPackageExitCode -ne 0) {
        Write-Host "[ERROR] Exporter package command failed with code $taskPackageExitCode." -ForegroundColor Red
        exit $taskPackageExitCode
    }

    exit 0
}
catch {
    Write-Host "[ERROR] Exporter build failed: $_" -ForegroundColor Red
    exit 1
}
