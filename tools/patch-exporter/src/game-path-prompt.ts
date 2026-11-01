import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { findGamePaksDirectory } from './discovery';

export interface GamePathPromptOptions {
  /** File that remembers the last confirmed game folder. */
  readonly savedFile: string;
  /** Explicit `--game-path`; skips every question. */
  readonly explicitPath?: string;
  /** False in CI/tests: never ask, use the saved path or fail. */
  readonly interactive?: boolean;
}

function readSavedPath(file: string): string | null {
  try {
    const value = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim().replace(/^["']|["']$/g, '');
    return value || null;
  } catch {
    return null;
  }
}

function isGameFolder(folder: string): boolean {
  return fs.existsSync(folder) && findGamePaksDirectory(folder) !== null;
}

/** Native Windows folder picker; returns null when cancelled or unavailable. */
function pickFolder(): string | null {
  if (process.platform !== 'win32') return null;
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$d.Description = "Tower of Fantasy folder"',
    '$d.ShowNewFolderButton = $false',
    '$f = New-Object System.Windows.Forms.Form',
    '$f.TopMost = $true',
    'if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [Text.Encoding]::UTF8; Write-Output $d.SelectedPath }',
  ].join('; ');
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return output || null;
  } catch {
    return null;
  }
}

async function askForFolder(rl: readline.Interface): Promise<string> {
  for (;;) {
    console.log('\n  Select the game folder in the dialog...');
    const picked = pickFolder() ?? (await rl.question('  Game folder path: ')).trim().replace(/^["']|["']$/g, '');
    if (picked && isGameFolder(picked)) return path.resolve(picked);
    console.log(`  [!] No game .pak files in "${picked || '—'}". Select the Tower of Fantasy installation folder.`);
  }
}

/**
 * First run: asks for the game folder (folder dialog, then typed path).
 * Later runs: shows the remembered folder and lets the user keep or change it.
 * The confirmed folder is saved for the next run.
 */
export async function resolveGamePath(options: GamePathPromptOptions): Promise<string> {
  if (options.explicitPath) {
    if (!isGameFolder(options.explicitPath)) throw new Error(`No game .pak files found under ${options.explicitPath}.`);
    return path.resolve(options.explicitPath);
  }
  const saved = readSavedPath(options.savedFile);
  const savedValid = saved !== null && isGameFolder(saved);
  if (options.interactive === false || !process.stdin.isTTY) {
    if (savedValid) return path.resolve(saved!);
    throw new Error(`Game folder is unknown. Pass --game-path or write it to ${options.savedFile}.`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let chosen: string;
    if (savedValid) {
      console.log(`\n  Game folder: ${saved}`);
      const answer = (await rl.question('  Enter = keep this folder, 2 = choose another: ')).trim();
      chosen = answer === '2' ? await askForFolder(rl) : path.resolve(saved!);
    } else {
      if (saved) console.log(`\n  [!] The saved folder no longer contains the game: ${saved}`);
      chosen = await askForFolder(rl);
    }
    fs.writeFileSync(options.savedFile, `${chosen}\n`, 'utf8');
    return chosen;
  } finally {
    rl.close();
  }
}
