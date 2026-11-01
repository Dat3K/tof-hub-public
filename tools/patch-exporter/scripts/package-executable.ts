import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { computeFileSha256, downloadFile } from './fetch-runtime';

// Public-domain reduced standalone console, pinned to the upstream release.
const SEVEN_ZIP = {
  version: '26.04',
  url: 'https://github.com/ip7z/7zip/releases/download/26.04/7zr.exe',
  sha256: '256feca8e274e5da655e2a284fabafd9f554365eb164862089dacd4e8276d282',
};

export async function fetchSevenZip(): Promise<string> {
  const exe = path.resolve(__dirname, `../.cache/7zr-${SEVEN_ZIP.version}.exe`);
  if (!fs.existsSync(exe)) await downloadFile(SEVEN_ZIP.url, exe);
  if (await computeFileSha256(exe) !== SEVEN_ZIP.sha256) {
    throw new Error(`7zr checksum mismatch: ${exe}. Remove the cached file and retry.`);
  }
  return exe;
}

function vcEnvironment(): string {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft Visual Studio/Installer/vswhere.exe');
  if (!fs.existsSync(vswhere)) throw new Error('Building the EXE needs Visual Studio Build Tools with Desktop development with C++ and a Windows SDK.');
  const installation = execFileSync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath',
  ], { encoding: 'utf8' }).trim();
  const vcvars = path.join(installation, 'VC/Auxiliary/Build/vcvars64.bat');
  if (!installation || !fs.existsSync(vcvars)) throw new Error('No Visual C++ x64 build tools found. Install Desktop development with C++ and a Windows SDK.');
  return vcvars;
}

/** Native launcher + solid LZMA2 payload; no Node, .NET, 7-Zip or VC runtime installation on the player's PC. */
export async function buildExecutablePackage(portableDir: string, exePath: string): Promise<string> {
  if (process.platform !== 'win32') throw new Error('The Windows EXE must be built on Windows with Visual C++ build tools.');
  const vcvars = vcEnvironment();
  const sevenZip = await fetchSevenZip();
  const buildDir = fs.mkdtempSync(path.resolve(__dirname, '../.cache/exe-build-'));
  const payload = path.join(buildDir, 'payload.7z');
  try {
    console.log('[EXE] Compressing runtime and pipeline with solid LZMA2 (64 MiB dictionary)...');
    execFileSync(sevenZip, ['a', '-t7z', '-mx=9', '-md=64m', '-ms=on', '-mmt=2', '-bsp1', payload, '.'], {
      cwd: portableDir, stdio: 'inherit',
    });
    execFileSync(sevenZip, ['t', '-bso0', payload], { stdio: 'inherit' });
    const resourcePath = (file: string) => file.replace(/\\/g, '/').replace(/"/g, '\\"');
    fs.writeFileSync(path.join(buildDir, 'launcher.rc'), [
      `101 RCDATA "${resourcePath(sevenZip)}"`,
      `102 RCDATA "${resourcePath(payload)}"`,
      '',
    ].join('\n'));
    const nativeDir = path.resolve(__dirname, '../native');
    // The response file carries paths as data, outside cmd.exe's parsing.
    fs.writeFileSync(path.join(buildDir, 'compile.rsp'), [
      '/nologo /std:c++17 /O1 /MT /EHsc /W4 /DUNICODE /D_UNICODE',
      `"${path.join(nativeDir, 'launcher.cpp')}" launcher.res`,
      '/Fe:launcher.exe',
      `/link /SUBSYSTEM:CONSOLE /INCREMENTAL:NO /OPT:REF /OPT:ICF ole32.lib /MANIFEST:EMBED /MANIFESTINPUT:"${path.join(nativeDir, 'launcher.manifest')}"`,
      '',
    ].join('\n'));
    // vcvars is the only interpolated shell path; reject cmd expansion characters.
    if (/["%\r\n]/.test(vcvars)) throw new Error('Unsupported characters in the Visual Studio installation path.');
    const script = path.join(buildDir, 'compile.cmd');
    fs.writeFileSync(script, `@echo off\r\ncall "${vcvars}" >nul\r\nif errorlevel 1 exit /b 1\r\nrc /nologo launcher.rc\r\nif errorlevel 1 exit /b 1\r\ncl @compile.rsp\r\nexit /b %errorlevel%\r\n`);
    // Absolute path: cmd.exe ignores the current directory when NoDefaultCurrentDirectoryInExePath is set.
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', script], { cwd: buildDir, stdio: 'inherit' });
    fs.mkdirSync(path.dirname(exePath), { recursive: true });
    fs.copyFileSync(path.join(buildDir, 'launcher.exe'), exePath);
    const bytes = fs.statSync(exePath).size;
    fs.writeFileSync(`${exePath}.sha256`, `${await computeFileSha256(exePath)}  ${path.basename(exePath)}\n`);
    console.log(`[EXE] ${exePath} (${(bytes / 1024 / 1024).toFixed(1)} MiB)`);
    return exePath;
  } finally {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
}
