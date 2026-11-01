import fs from 'node:fs';
import path from 'node:path';

export interface GuardedPaths {
  canonicalInput: string;
  canonicalOutput: string;
}

export interface ResolvedExportTree {
  workingRoot: string;
  unpackedRoot: string;
  hasManifest: boolean;
  hasHottaContent: boolean;
  isDoubleNested: boolean;
}

/**
 * Validates canonical input and output directory paths to ensure data safety.
 * Invariants:
 *  1. Canonical input path must exist and be a directory. Missing prepared input throws a clear, descriptive error.
 *  2. Output directory must be OUTSIDE source input directory ("outputs outside source").
 *  3. Input directory must NOT be inside output directory.
 *  4. Input and output directories must not be identical.
 *  5. Output directory must not be a filesystem root (e.g. C:\ or /).
 */
export function assertSafeInputOutputPaths(inputDir: string, outputDir: string): GuardedPaths {
  if (!inputDir || typeof inputDir !== 'string' || inputDir.trim() === '') {
    throw new Error('Prepared input directory parameter is required and cannot be empty.');
  }

  if (!outputDir || typeof outputDir !== 'string' || outputDir.trim() === '') {
    throw new Error('Output directory parameter is required and cannot be empty.');
  }

  const canonicalInput = path.resolve(inputDir.trim());
  const canonicalOutput = path.resolve(outputDir.trim());

  if (!fs.existsSync(canonicalInput)) {
    throw new Error(
      `Prepared input directory does not exist: "${canonicalInput}". Please provide a valid, pre-extracted game data directory.`
    );
  }

  const inputStat = fs.statSync(canonicalInput);
  if (!inputStat.isDirectory()) {
    throw new Error(
      `Prepared input path is not a directory: "${canonicalInput}". Expected a directory containing raw export assets.`
    );
  }

  // Check if identical
  if (canonicalInput.toLowerCase() === canonicalOutput.toLowerCase()) {
    throw new Error(
      `Unsafe path configuration: Output directory cannot be identical to input directory ("${canonicalOutput}"). Outputs must reside outside source.`
    );
  }

  // Check if output is inside input ("outputs outside source")
  const relativeOutputFromInput = path.relative(canonicalInput, canonicalOutput);
  const isOutputInsideInput =
    !relativeOutputFromInput.startsWith('..') && !path.isAbsolute(relativeOutputFromInput);

  if (isOutputInsideInput) {
    throw new Error(
      `Unsafe path configuration: Output directory ("${canonicalOutput}") cannot reside inside input directory ("${canonicalInput}"). Outputs must reside strictly outside source.`
    );
  }

  // Check if input is inside output
  const relativeInputFromOutput = path.relative(canonicalOutput, canonicalInput);
  const isInputInsideOutput =
    !relativeInputFromOutput.startsWith('..') && !path.isAbsolute(relativeInputFromOutput);

  if (isInputInsideOutput) {
    throw new Error(
      `Unsafe path configuration: Input directory ("${canonicalInput}") cannot reside inside output directory ("${canonicalOutput}").`
    );
  }

  // Reject writing directly to disk root
  const root = path.parse(canonicalOutput).root;
  if (canonicalOutput.toLowerCase() === root.toLowerCase()) {
    throw new Error(
      `Unsafe path configuration: Output directory cannot be filesystem root ("${canonicalOutput}").`
    );
  }

  return { canonicalInput, canonicalOutput };
}

/**
 * Probes and resolves raw export directory tree handling both single-level and double-nested layouts.
 * (for example raw_exports/ containing another raw_exports/).
 */
export function resolveRawExportTree(candidateDir: string): ResolvedExportTree {
  const resolved = path.resolve(candidateDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input raw export directory does not exist: "${resolved}".`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Input raw export path is not a directory: "${resolved}".`);
  }

  const doubleNested = path.join(resolved, 'raw_exports');
  const hasDoubleNested =
    fs.existsSync(doubleNested) && fs.statSync(doubleNested).isDirectory();

  const innerCandidate = hasDoubleNested ? doubleNested : resolved;

  const hottaCandidate = fs.existsSync(path.join(innerCandidate, 'Hotta'))
    ? path.join(innerCandidate, 'Hotta')
    : fs.existsSync(path.join(resolved, 'Hotta'))
      ? path.join(resolved, 'Hotta')
      : null;

  const manifestCandidate =
    fs.existsSync(path.join(innerCandidate, 'full-manifest.json')) ||
    fs.existsSync(path.join(resolved, 'full-manifest.json'));

  return {
    workingRoot: resolved,
    unpackedRoot: hottaCandidate ? path.dirname(hottaCandidate) : innerCandidate,
    hasManifest: manifestCandidate,
    hasHottaContent: Boolean(hottaCandidate),
    isDoubleNested: hasDoubleNested,
  };
}
