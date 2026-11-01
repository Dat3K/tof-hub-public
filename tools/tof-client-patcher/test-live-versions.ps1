# Offline checks load only resolver functions, never the interactive patch/install code.
param([switch]$Live)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression
$lines = [IO.File]::ReadAllLines((Join-Path $PSScriptRoot 'ToFPatcher.bat'))
$payload = $lines[5..($lines.Length - 1)] -join "`n"
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($payload, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors.Message -join '; ') }
$functions = $ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -in @('Read-OfficialLauncherBytes', 'Resolve-OfficialLauncherPreset')}, $true)
foreach ($function in $functions) { Invoke-Expression $function.Extent.Text }
Add-Type -ReferencedAssemblies System.Net.Http -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
public class PatcherFixtureHandler : HttpMessageHandler {
  public readonly Dictionary<string, byte[]> Bodies = new Dictionary<string, byte[]>();
  protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
    byte[] body;
    return Task.FromResult(Bodies.TryGetValue(request.RequestUri.AbsoluteUri, out body)
      ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(body) }
      : new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent("Missing fixture") });
  }
}
'@
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Config-Zip($branch) {
    $stream = [IO.MemoryStream]::new()
    $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $true)
    $writer = [IO.StreamWriter]::new($zip.CreateEntry('PatcherConfig.json').Open())
    $writer.Write((@{branchName=$branch;appId='1256';appVersion='0.0';minVersion='0.0'} | ConvertTo-Json -Compress))
    $writer.Dispose(); $zip.Dispose()
    $bytes = $stream.ToArray(); $stream.Dispose()
    return ,$bytes
}
$handler = New-Object PatcherFixtureHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$preset = @{BaseName='China fixture';AppId='1256';Branch='AdvLaunch52';GameResUrl=@('https://htcdn2.wmupd.com/clientRes','https://htcdn1.wmupd.com/clientRes');VersionUrl='https://htcdn2.wmupd.com/hd/AdvLaunch30/launcher/Version.ini';BackupVersionUrl='https://htcdn1.wmupd.com/hd/AdvLaunch30/launcher/Version.ini'}
try {
    # Missing primary mirror must not prevent discovery through the backup.
    $handler.Bodies[$preset.BackupVersionUrl] = [Text.Encoding]::UTF8.GetBytes("Version=1.2.3.4`nFileListURL=https://htcdn2.wmupd.com/hd/AdvLaunch30/launcher/current/AllFiles.xml")
    $zipUrl = 'https://htcdn1.wmupd.com/hd/AdvLaunch30/launcher/current/ResFilesM/1256/PatcherConfig/PatcherConfig.json.zip'
    $handler.Bodies[$zipUrl] = Config-Zip 'AdvLaunch99'
    $handler.Bodies['https://htcdn1.wmupd.com/clientRes/AdvLaunch99/Version/Windows/config.xml'] = [Text.Encoding]::UTF8.GetBytes('<ResVersion>9.9.1</ResVersion>')
    $result = Resolve-OfficialLauncherPreset $preset $client
    Assert ($result.Branch -eq 'AdvLaunch99') 'Did not follow the rotating branch'
    Assert ($result.ResVersion -eq '9.9.1') 'Version came from a different branch'
    Assert ($result.LauncherVersion -eq '1.2.3.4') 'Launcher version missing'
    Assert ($result.LauncherFileListUrl -match 'htcdn1.*current/AllFiles.xml') 'Bootstrap must follow the successful mirror and current package'
    Assert ($preset.Branch -eq 'AdvLaunch52') 'Resolution must not partially mutate the preset'
    $handler.Bodies[$zipUrl] = [Text.Encoding]::UTF8.GetBytes('bad ZIP')
    $rejected = $false
    try { Resolve-OfficialLauncherPreset $preset $client | Out-Null } catch { $rejected = $true }
    Assert $rejected 'Broken discovery must fail instead of patching the stale fixed branch'
    Write-Host 'PASS: rotating branch, coherent version, launcher package, backup mirror, atomic resolution and failed discovery'
} finally { $client.Dispose(); $handler.Dispose() }

if ($Live) {
    $assignment = $ast.Find({param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$global:BRANCH_PRESETS'}, $true)
    Invoke-Expression $assignment.Extent.Text
    $liveClient = New-Object System.Net.Http.HttpClient
    $liveClient.Timeout = [TimeSpan]::FromSeconds(5)
    $liveClient.MaxResponseContentBufferSize = 2097152
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        foreach ($key in @('9', '10')) {
            $result = Resolve-OfficialLauncherPreset $global:BRANCH_PRESETS[$key] $liveClient
            Write-Host ("LIVE: {0}: {1}, game {2}, launcher {3}" -f $global:BRANCH_PRESETS[$key].BaseName, $result.Branch, $result.ResVersion, $result.LauncherVersion)
        }
    } finally { $liveClient.Dispose() }
}
