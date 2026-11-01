import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  parseEnvContent,
  loadPipelineEnv,
  normalizePlatformPath,
  getRawGameSourceDir,
  tryGetRawGameSourceDir,
} from './env';
import {
  RawSourceViolationError,
  normalizePathStandard,
  canonicalizePath,
  isPathInside,
  assertSafeOutputRoot,
  assertSafeOutputPath,
  createPathGuard,
  PathGuard,
} from './path-guard';

describe('Environment & Config Helper (env.ts)', () => {
  it('parses .env content accurately without external dependencies', () => {
    const raw = `
# Comment line
KEY_ONE=value1
KEY_QUOTED="quoted-value"
KEY_SINGLE='single-quoted'
EMPTY_VAL=

# Another comment
SPACED_KEY = spaced value
`;
    const parsed = parseEnvContent(raw);
    expect(parsed.KEY_ONE).toBe('value1');
    expect(parsed.KEY_QUOTED).toBe('quoted-value');
    expect(parsed.KEY_SINGLE).toBe('single-quoted');
    expect(parsed.EMPTY_VAL).toBe('');
    expect(parsed.SPACED_KEY).toBe('spaced value');
  });

  it('translates WSL paths on Windows and Windows paths on Linux', () => {
    if (process.platform === 'win32') {
      const wsl = '/mnt/c/workspace/tof/raw_exports';
      const normalized = normalizePlatformPath(wsl);
      expect(normalized).toBe('C:/workspace/tof/raw_exports');

      const dDrive = '/mnt/d/projects/game';
      expect(normalizePlatformPath(dDrive)).toBe('D:/projects/game');
    } else {
      const win = 'C:/workspace/tof/raw_exports';
      const normalized = normalizePlatformPath(win);
      expect(normalized).toBe('/mnt/c/workspace/tof/raw_exports');

      const winBackslash = 'c:\\workspace\\tof\\raw_exports';
      expect(normalizePlatformPath(winBackslash)).toBe('/mnt/c/workspace/tof/raw_exports');
    }
  });

  it('reads TOF_RAW_GAME_DIR from .env.local without throwing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-env-fixture-'));
    const previous = process.env.TOF_RAW_GAME_DIR;
    try {
      const raw = path.join(root, 'raw').replace(/\\/g, '/');
      fs.mkdirSync(raw);
      fs.writeFileSync(path.join(root, '.env.local'), 'TOF_RAW_GAME_DIR="'+raw+'"');
      loadPipelineEnv(root, true);
      expect(getRawGameSourceDir({ projectRoot: root, required: false })).toBe(raw);
      expect(tryGetRawGameSourceDir()).not.toBeNull();
    } finally {
      if (previous === undefined) delete process.env.TOF_RAW_GAME_DIR;
      else process.env.TOF_RAW_GAME_DIR = previous;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('Path Normalization & Canonicalization (path-guard.ts)', () => {
  it('normalizes path standard representation (slashes, drive case, trailing slashes)', () => {
    const p1 = 'C:\\foo\\bar\\baz\\';
    const norm1 = normalizePathStandard(p1);
    expect(norm1).toBe('C:/foo/bar/baz');

    const p2 = 'c:/nested//dir/../file.json';
    const norm2 = normalizePathStandard(p2);
    expect(norm2).toBe('C:/nested/file.json');
  });

  it('canonicalizes existing directories and files', () => {
    const cwd = process.cwd();
    const canonicalCwd = canonicalizePath(cwd);
    expect(canonicalCwd).toBeTruthy();
    expect(path.isAbsolute(canonicalCwd)).toBe(true);
    expect(canonicalCwd.includes('\\')).toBe(false);
  });

  it('canonicalizes non-existent paths by resolving existing ancestor realpath', () => {
    const fakeDeepPath = path.join(process.cwd(), 'non-existent-folder-123', 'sub-dir', 'file.json');
    const canonical = canonicalizePath(fakeDeepPath);
    expect(canonical).toBeTruthy();
    expect(canonical.endsWith('/non-existent-folder-123/sub-dir/file.json')).toBe(true);
  });
});

describe('isPathInside containment checking', () => {
  const root = process.platform === 'win32' ? 'C:/test/raw-root' : '/test/raw-root';

  it('detects exact match as inside', () => {
    expect(isPathInside(root, root)).toBe(true);
  });

  it('detects child files and subdirectories as inside', () => {
    expect(isPathInside(root, `${root}/file.txt`)).toBe(true);
    expect(isPathInside(root, `${root}/sub/deep/file.json`)).toBe(true);
  });

  it('detects sibling and parent paths as NOT inside', () => {
    expect(isPathInside(root, `${root}_sibling`)).toBe(false);
    expect(isPathInside(root, `${root}_other/file.txt`)).toBe(false);

    const parent = path.dirname(root);
    expect(isPathInside(root, parent)).toBe(false);
  });

  if (process.platform === 'win32') {
    it('handles Windows case-insensitivity', () => {
      expect(isPathInside('C:/Test/Raw-Root', 'c:/test/raw-root/sub/file.txt')).toBe(true);
      expect(isPathInside('c:/test/raw-root', 'C:/TEST/RAW-ROOT/data.json')).toBe(true);
    });

    it('rejects cross-drive paths on Windows', () => {
      expect(isPathInside('C:/raw', 'D:/raw/file.txt')).toBe(false);
    });
  }
});

describe('assertSafeOutputRoot & assertSafeOutputPath', () => {
  const testBase = path.join(__dirname, '../../scratch/path-guard-test');
  const mockRawSource = path.join(testBase, 'mock-raw-source');
  const mockStaging = path.join(testBase, 'mock-staging');

  beforeAll(() => {
    fs.mkdirSync(mockRawSource, { recursive: true });
    fs.mkdirSync(mockStaging, { recursive: true });
    fs.writeFileSync(path.join(mockRawSource, 'protected.json'), '{"secret": true}');
  });

  afterAll(() => {
    try {
      fs.rmSync(testBase, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it('allows safe output roots strictly outside raw source', () => {
    const safeCanonical = assertSafeOutputRoot(mockStaging, mockRawSource);
    expect(safeCanonical).toBeTruthy();
    expect(safeCanonical).toContain('mock-staging');
  });

  it('rejects output root inside raw source tree', () => {
    const insideOutput = path.join(mockRawSource, 'nested-output');
    expect(() => {
      assertSafeOutputRoot(insideOutput, mockRawSource);
    }).toThrow(RawSourceViolationError);
  });

  it('rejects output root identical to raw source', () => {
    expect(() => {
      assertSafeOutputRoot(mockRawSource, mockRawSource);
    }).toThrow(RawSourceViolationError);
  });

  it('rejects output root that is an ancestor of raw source', () => {
    expect(() => {
      assertSafeOutputRoot(testBase, mockRawSource);
    }).toThrow(RawSourceViolationError);
  });

  it('rejects write path targeting inside raw source tree before write', () => {
    const targetInside = path.join(mockRawSource, 'sub', 'new-file.json');
    expect(() => {
      assertSafeOutputPath(targetInside, mockRawSource);
    }).toThrow(RawSourceViolationError);
  });

  it('allows safe write path targeting outside raw source', () => {
    const safeTarget = path.join(mockStaging, 'output.json');
    const canonical = assertSafeOutputPath(safeTarget, mockRawSource);
    expect(canonical).toContain('mock-staging/output.json');
  });
});

describe('PathGuard guarded write operations', () => {
  const testBase = path.join(__dirname, '../../scratch/guard-ops-test');
  const mockRawSource = path.join(testBase, 'raw-source');
  const mockOutput = path.join(testBase, 'pipeline-output');
  let guard: PathGuard;

  beforeAll(() => {
    fs.mkdirSync(mockRawSource, { recursive: true });
    fs.mkdirSync(mockOutput, { recursive: true });
    fs.writeFileSync(path.join(mockRawSource, 'original.json'), '{"immutable": 1}');
    guard = createPathGuard(mockRawSource, [mockOutput]);
  });

  afterAll(() => {
    try {
      fs.rmSync(testBase, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it('blocks safeWriteFileSync inside raw source BEFORE touching disk', () => {
    const writeTarget = path.join(mockRawSource, 'hacked.txt');
    expect(() => {
      guard.safeWriteFileSync(writeTarget, 'corrupt');
    }).toThrow(RawSourceViolationError);

    // Verify file was never written
    expect(fs.existsSync(writeTarget)).toBe(false);
  });

  it('blocks safeWriteJsonSync inside raw source', () => {
    const writeTarget = path.join(mockRawSource, 'hacked.json');
    expect(() => {
      guard.safeWriteJsonSync(writeTarget, { invalid: true });
    }).toThrow(RawSourceViolationError);

    expect(fs.existsSync(writeTarget)).toBe(false);
  });

  it('blocks safeMkdirSync inside raw source', () => {
    const dirTarget = path.join(mockRawSource, 'unwanted-dir');
    expect(() => {
      guard.safeMkdirSync(dirTarget);
    }).toThrow(RawSourceViolationError);

    expect(fs.existsSync(dirTarget)).toBe(false);
  });

  it('blocks safeCopyFileSync when destination is inside raw source', () => {
    const safeSrc = path.join(mockOutput, 'source.txt');
    fs.writeFileSync(safeSrc, 'hello');

    const destInside = path.join(mockRawSource, 'copied.txt');
    expect(() => {
      guard.safeCopyFileSync(safeSrc, destInside);
    }).toThrow(RawSourceViolationError);

    expect(fs.existsSync(destInside)).toBe(false);
  });

  it('allows guarded writes to safe output destination', () => {
    const safeDest = path.join(mockOutput, 'sub', 'valid-result.json');
    guard.safeWriteJsonSync(safeDest, { status: 'success' });

    expect(fs.existsSync(safeDest)).toBe(true);
    const content = JSON.parse(fs.readFileSync(safeDest, 'utf8'));
    expect(content.status).toBe('success');
  });

  it('resolves symlinks/junctions and blocks writes through symlinks to raw source', () => {
    const junctionPath = path.join(testBase, 'convenience-link');
    try {
      // Create junction or dir symlink pointing to mockRawSource
      fs.symlinkSync(mockRawSource, junctionPath, 'junction');
    } catch {
      // If junction creation requires admin or is not supported in current environment, skip junction creation
      return;
    }

    try {
      const targetThroughJunction = path.join(junctionPath, 'via-junction.txt');
      expect(() => {
        guard.safeWriteFileSync(targetThroughJunction, 'should fail');
      }).toThrow(RawSourceViolationError);

      expect(fs.existsSync(path.join(mockRawSource, 'via-junction.txt'))).toBe(false);
    } finally {
      try {
        fs.unlinkSync(junctionPath);
      } catch {
        // Cleanup
      }
    }
  });
});

describe('Real raw source environment protection', () => {
  it('protects the actual raw game exports directory configured in .env.local', () => {
    loadPipelineEnv(undefined, true);
    const rawDir = tryGetRawGameSourceDir();
    if (!rawDir || !fs.existsSync(rawDir)) {
      // Skip if raw_exports not on disk in this environment
      return;
    }

    const realGuard = createPathGuard(rawDir);

    // Attempted write inside the real raw_exports must throw before write
    const maliciousTarget = path.join(rawDir, 'test-write-protection.json');
    expect(() => {
      realGuard.safeWriteFileSync(maliciousTarget, 'bad data');
    }).toThrow(RawSourceViolationError);

    expect(fs.existsSync(maliciousTarget)).toBe(false);

    // Pipeline staging directory in project must be recognized as safe output root
    const stagingDir = path.resolve(__dirname, '../../pipeline/staging');
    const safeOutput = realGuard.assertSafeOutputRoot(stagingDir);
    expect(safeOutput).toBeTruthy();
  });
});
