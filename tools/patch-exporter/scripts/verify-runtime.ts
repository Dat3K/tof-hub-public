import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadRuntimeConfig, computeFileSha256, smokeTestUnrealExporter } from './fetch-runtime';

export interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface RuntimeVerificationReport {
  timestamp: string;
  allPassed: boolean;
  checks: VerificationCheck[];
}

/**
 * Verifies all integrity invariants for the pinned portable Node.js runtime.
 */
export async function verifyRuntime(): Promise<RuntimeVerificationReport> {
  const config = loadRuntimeConfig();
  const nodeInfo = config.runtimes.node;
  const checks: VerificationCheck[] = [];

  const cacheDir = path.resolve(__dirname, '../.cache');
  const runtimeDir = path.resolve(__dirname, '../runtime');
  const zipPath = path.join(cacheDir, nodeInfo.fileName);
  const nodeExePath = path.join(runtimeDir, 'node.exe');
  const licensePath = path.join(runtimeDir, 'NODE_LICENSE');

  // Check 1: Config validity
  checks.push({
    name: 'Configuration Integrity',
    passed: Boolean(nodeInfo.version && nodeInfo.url && nodeInfo.sha256),
    details: `Version: ${nodeInfo.version}, Platform: ${nodeInfo.platform}-${nodeInfo.arch}, SHA-256: ${nodeInfo.sha256.slice(0, 16)}...`,
  });

  // Check 2: Cached archive integrity (if present)
  if (fs.existsSync(zipPath)) {
    const hash = await computeFileSha256(zipPath);
    const hashMatches = hash.toLowerCase() === nodeInfo.sha256.toLowerCase();
    checks.push({
      name: 'Cached Archive SHA-256 Verification',
      passed: hashMatches,
      details: hashMatches
        ? `SHA-256 verified (${hash})`
        : `Hash mismatch: expected ${nodeInfo.sha256}, got ${hash}`,
    });
  } else {
    checks.push({
      name: 'Cached Archive Presence',
      passed: false,
      details: `Cached zip not found at ${zipPath} (run "pnpm fetch:runtime" to download)`,
    });
  }

  // Check 3: Bundled node.exe presence & functionality
  if (fs.existsSync(nodeExePath)) {
    try {
      const output = execFileSync(nodeExePath, ['--version'], { encoding: 'utf8' }).trim();
      const versionMatches = output === `v${nodeInfo.version}`;
      checks.push({
        name: 'Bundled Binary Execution & Version Match',
        passed: versionMatches,
        details: versionMatches
          ? `Reported: ${output} (matches pinned v${nodeInfo.version})`
          : `Reported: ${output} (mismatches pinned v${nodeInfo.version})`,
      });
    } catch (err) {
      checks.push({
        name: 'Bundled Binary Execution',
        passed: false,
        details: `Execution failed: ${(err as Error).message}`,
      });
    }
  } else {
    checks.push({
      name: 'Bundled Binary Presence',
      passed: false,
      details: `node.exe not found at ${nodeExePath} (run "pnpm fetch:runtime" to stage)`,
    });
  }

  // Check 4: License presence
  if (fs.existsSync(licensePath)) {
    const licSize = fs.statSync(licensePath).size;
    checks.push({
      name: 'Bundled License Attribution',
      passed: licSize > 0,
      details: `Found NODE_LICENSE (${licSize} bytes)`,
    });
  } else {
    checks.push({
      name: 'Bundled License Attribution',
      passed: false,
      details: `NODE_LICENSE not found at ${licensePath}`,
    });
  }

  // Check 5: Selective extraction cleanliness (no extraneous npm/npx/node_modules)
  if (fs.existsSync(runtimeDir)) {
    const forbidden = ['npm', 'npm.cmd', 'npx', 'npx.cmd', 'corepack', 'corepack.cmd', 'node_modules'];
    const foundForbidden = forbidden.filter((f) => fs.existsSync(path.join(runtimeDir, f)));
    checks.push({
      name: 'Selective Extraction Cleanliness (Zero npm/npx bloat)',
      passed: foundForbidden.length === 0,
      details: foundForbidden.length === 0
        ? 'Clean: only node.exe and license present in runtime/'
        : `Bloat detected: found extraneous entries [${foundForbidden.join(', ')}]`,
    });
  }

  // Check 6: UnrealExporter Config & Cache Integrity
  const unrealInfo = config.runtimes.unrealExporter;
  const unrealZip = path.join(cacheDir, unrealInfo.fileName);
  if (fs.existsSync(unrealZip)) {
    const unrealHash = await computeFileSha256(unrealZip);
    const matches = unrealHash.toLowerCase() === unrealInfo.sha256.toLowerCase();
    checks.push({
      name: 'UnrealExporter Cache SHA-256 Verification',
      passed: matches,
      details: matches
        ? `Verified (${unrealHash})`
        : `Mismatch: expected ${unrealInfo.sha256}, got ${unrealHash}`,
    });
  } else {
    checks.push({
      name: 'UnrealExporter Cache Presence',
      passed: false,
      details: `Archive not found at ${unrealZip}`,
    });
  }

  // Check 7: UnrealExporter Binary Execution & Smoke Test
  const candidateBinDirs = [
    path.resolve(__dirname, '../dist/tof-exporter-portable/bin'),
    path.resolve(__dirname, '../../../dist/tof-exporter-portable/bin'),
    path.resolve(__dirname, '../.cache/bin'),
    path.resolve(__dirname, '../bin'),
  ];
  const binDir = candidateBinDirs.find((d) => fs.existsSync(path.join(d, 'UnrealExporter.exe'))) || path.resolve(__dirname, '../dist/tof-exporter-portable/bin');
  const unrealExe = path.join(binDir, 'UnrealExporter.exe');
  if (fs.existsSync(unrealExe)) {
    try {
      smokeTestUnrealExporter(unrealExe);
      checks.push({
        name: 'UnrealExporter Binary Execution & Help Smoke Test',
        passed: true,
        details: 'Smoke test passed (UnrealExporter CLI functional)',
      });
    } catch (err) {
      checks.push({
        name: 'UnrealExporter Binary Execution',
        passed: false,
        details: `Execution failed: ${(err as Error).message}`,
      });
    }
  } else {
    checks.push({
      name: 'UnrealExporter Binary Presence',
      passed: false,
      details: `UnrealExporter.exe not found at ${unrealExe}`,
    });
  }

  // Check 8: UnrealExporter Supporting Libraries & Attribution
  const requiredBinaries = ['libSkiaSharp.dll', 'blake3_dotnet.dll', 'LICENSE.txt'];
  const missingBinaries = requiredBinaries.filter((b) => !fs.existsSync(path.join(binDir, b)));
  checks.push({
    name: 'UnrealExporter Supporting Libraries & Attribution',
    passed: missingBinaries.length === 0,
    details: missingBinaries.length === 0
      ? 'All supporting libraries and LICENSE.txt present'
      : `Missing: ${missingBinaries.join(', ')}`,
  });

  // Check 9: Security Boundary - Secret Key Exclusion
  const forbiddenSecrets = unrealInfo.secretsToExclude || ['aes.txt', 'olderkeys.txt'];
  const foundSecrets = forbiddenSecrets.filter((s) => fs.existsSync(path.join(binDir, s)));
  checks.push({
    name: 'Security Boundary: Secret Key Exclusion',
    passed: foundSecrets.length === 0,
    details: foundSecrets.length === 0
      ? 'Clean: no proprietary keys (aes.txt/olderkeys.txt) present in bin/'
      : `Security violation: found secrets [${foundSecrets.join(', ')}] in bin/`,
  });

  // Check 10: Native WebP Converter Tooling (cwebp.exe)
  const cwebpPath = path.join(binDir, 'cwebp.exe');
  const hasCwebp = fs.existsSync(cwebpPath);
  checks.push({
    name: 'Native WebP Converter Presence (cwebp.exe)',
    passed: hasCwebp,
    details: hasCwebp ? 'Found cwebp.exe in bin/' : 'cwebp.exe not found in bin/',
  });

  const allPassed = checks.every((c) => c.passed);
  return {
    timestamp: new Date().toISOString(),
    allPassed,
    checks,
  };
}

// CLI entrypoint
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('verify-runtime.ts'))) {
  verifyRuntime()
    .then((report) => {
      console.log(`\n=== Runtime Verification Report [${report.timestamp}] ===`);
      for (const check of report.checks) {
        const icon = check.passed ? '[PASS]' : '[FAIL]';
        console.log(`  ${icon} ${check.name}: ${check.details}`);
      }
      console.log(`\nOverall Result: ${report.allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}\n`);
      if (!report.allPassed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(`[ERROR] Verification error: ${err.message}`);
      process.exit(1);
    });
}
