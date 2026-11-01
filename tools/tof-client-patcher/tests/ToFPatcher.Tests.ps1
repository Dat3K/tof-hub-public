$ErrorActionPreference = 'Stop'
$patcher = Join-Path $PSScriptRoot '..\ToFPatcher.bat'
$lines = [System.IO.File]::ReadAllLines($patcher, [System.Text.Encoding]::UTF8)
$source = $lines[5..($lines.Length - 1)] -join "`n"
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$null, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
# Load only path functions: never run the interactive installer or network code.
foreach ($name in @('Get-InstallationAt', 'Detect-GameInstallation', 'Resolve-TargetDirs')) {
    $definition = $ast.Find({ param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $false)
    . ([scriptblock]::Create($definition.Extent.Text))
}

$sandbox = Join-Path ([System.IO.Path]::GetTempPath()) ('ToFPatcher-tests-' + [guid]::NewGuid())
function New-Fixture($relative) {
    $path = Join-Path $sandbox $relative
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    return $path
}
function Assert-Root($inputDir, $expectedRoot, $expectedLauncher) {
    $found = Detect-GameInstallation $inputDir
    if (-not $found.Detected -or $found.GameRoot -ne $expectedRoot -or $found.LauncherDir -ne $expectedLauncher) {
        throw "Incorrect detection for $inputDir : $($found | Out-String)"
    }
    $root, $launcher = Resolve-TargetDirs ('"' + $inputDir + '"')
    if ($root -ne $expectedRoot -or $launcher -ne $expectedLauncher) { throw 'Manual path disagrees with auto detection' }
}
try {
    $root = New-Fixture 'direct [game]'
    $launcher = New-Fixture 'direct [game]\HottaLaunch'
    [System.IO.File]::WriteAllText((Join-Path $root 'HottaLauncher.exe'), '')
    Assert-Root $root $root $launcher
    Assert-Root $launcher $root $launcher
    $inside = New-Fixture 'direct [game]\Client\WindowsNoEditor'
    Assert-Root $inside $root $launcher

    foreach ($depth in @(1, 2)) {
        $outer = New-Fixture "depth$depth"
        $relative = if ($depth -eq 1) { "depth$depth\game" } else { "depth$depth\wrapper\game" }
        $root = New-Fixture $relative
        $launcher = New-Fixture "$relative\WmGpLaunch"
        Assert-Root $outer $root $launcher
        Assert-Root $launcher $root $launcher
    }

    $outer = New-Fixture 'client-only'
    $root = New-Fixture 'client-only\wrapper\game'
    New-Fixture 'client-only\wrapper\game\Client\WindowsNoEditor\Hotta' | Out-Null
    Assert-Root $outer $root (Join-Path $root 'HottaLaunch')

    $root = New-Fixture 'bootstrap-only'
    [System.IO.File]::WriteAllText((Join-Path $root 'HottaLauncher.exe'), '')
    Assert-Root $root $root (Join-Path $root 'HottaLaunch')

    $outer = New-Fixture 'multiple'
    New-Fixture 'multiple\one\HottaLaunch' | Out-Null
    New-Fixture 'multiple\two\WmGpLaunch' | Out-Null
    $rejected = $false
    try { Detect-GameInstallation $outer | Out-Null } catch {
        if ($_.Exception.Message -notlike 'Multiple game installations found.*') { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw 'Ambiguous installations must not be selected automatically' }
    $root, $launcher = Resolve-TargetDirs $outer
    if ($root -or $launcher) { throw 'Manual ambiguous path must not resolve to a new installation' }

    $empty = New-Fixture 'empty'
    if ((Detect-GameInstallation $empty).Detected) { throw 'Empty directory detected as a game' }
    $root, $launcher = Resolve-TargetDirs $empty
    if ($root -ne $empty -or $launcher -ne (Join-Path $empty 'HottaLaunch')) { throw 'Fresh installation path is broken' }
    Write-Host 'PASS: syntax, direct/manual paths, launcher directories, two parent/child levels, client-only, bootstrap-only, ambiguity, fresh installation.'
} finally {
    # Delete only the unique temporary fixture directory created by this test.
    $resolved = [System.IO.Path]::GetFullPath($sandbox)
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test cleanup path' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
