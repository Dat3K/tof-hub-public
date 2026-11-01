import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  extractXmlTagValue,
  detectGameClientVersion,
  findGamePaksDirectory,
  findMappingConfigDirectory,
  findGameInstallation,
  type FileSystemProber,
} from '../discovery';

class MockFileSystemProber implements FileSystemProber {
  public files: Map<string, string> = new Map();
  public dirs: Set<string> = new Set();

  public addFile(filePath: string, content: string = ''): void {
    const normalized = path.normalize(filePath);
    this.files.set(normalized, content);
    let current = path.dirname(normalized);
    while (current && current !== path.dirname(current)) {
      this.dirs.add(current);
      current = path.dirname(current);
    }
  }

  public addDir(dirPath: string): void {
    this.dirs.add(path.normalize(dirPath));
  }

  public existsSync(filePath: string): boolean {
    const norm = path.normalize(filePath);
    return this.files.has(norm) || this.dirs.has(norm);
  }

  public isDirectory(dirPath: string): boolean {
    return this.dirs.has(path.normalize(dirPath));
  }

  public readdirSync(dirPath: string): string[] {
    const norm = path.normalize(dirPath);
    const results = new Set<string>();
    for (const f of this.files.keys()) {
      if (path.dirname(f) === norm) {
        results.add(path.basename(f));
      }
    }
    for (const d of this.dirs) {
      if (path.dirname(d) === norm && d !== norm) {
        results.add(path.basename(d));
      }
    }
    return Array.from(results);
  }

  public readFileSync(filePath: string, _encoding: BufferEncoding = 'utf8'): string {
    const norm = path.normalize(filePath);
    if (!this.files.has(norm)) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    return this.files.get(norm)!;
  }

  public findFile(startDir: string, fileName: string, _maxDepth: number = 4): string | null {
    const normStart = path.normalize(startDir);
    for (const f of this.files.keys()) {
      if (f.startsWith(normStart) && path.basename(f).toLowerCase() === fileName.toLowerCase()) {
        return f;
      }
    }
    return null;
  }
}

test('Discovery: live branch uses launcher app id and never keeps Korea Dev default', () => {
  for (const [appId, expected] of [['1000129', 'Global Live'], ['200124', 'Korea Live'], ['2000003', 'Taiwan Live'], ['', 'Global Live']]) {
    const prober = new MockFileSystemProber();
    const root = 'D:\\TestGame';
    prober.addFile(path.join(root, 'config.xml'), '<config><LocalBranch>OBPC_2_5</LocalBranch><ResVersion>6.3.1</ResVersion></config>');
    prober.addFile(path.join(root, 'HottaLaunch/ResFilesM/test/PatcherConfig.json'), JSON.stringify({ branchName: 'OBPC_2_5', appId }));
    const result = detectGameClientVersion(root, prober);
    assert.equal(result.clientName, expected);
    assert.equal(result.branch, 'OBPC_2_5');
  }
});

test('Discovery: missing or unrecognized metadata does not invent a Korea client', () => {
  const prober = new MockFileSystemProber();
  assert.equal(detectGameClientVersion('D:\\TestGame', prober).clientName, 'Unknown client');
  prober.addFile(path.join('D:\\TestGame', 'config.xml'), '<config><LocalBranch>NewBranch</LocalBranch></config>');
  assert.equal(detectGameClientVersion('D:\\TestGame', prober).clientName, 'NewBranch');
});

test('Discovery: extractXmlTagValue parses XML tags correctly', () => {
  const xml = `
    <config>
      <ResVersion>3.8.10.12345</ResVersion>
      <AppVersion>3.8.0</AppVersion>
      <Section>3.8</Section>
      <LocalBranch>TestPC_KR2New</LocalBranch>
      <Hash>abc123def456</Hash>
    </config>
  `;

  assert.equal(extractXmlTagValue(xml, 'ResVersion'), '3.8.10.12345');
  assert.equal(extractXmlTagValue(xml, 'AppVersion'), '3.8.0');
  assert.equal(extractXmlTagValue(xml, 'Section'), '3.8');
  assert.equal(extractXmlTagValue(xml, 'LocalBranch'), 'TestPC_KR2New');
  assert.equal(extractXmlTagValue(xml, 'Hash'), 'abc123def456');
  assert.equal(extractXmlTagValue(xml, 'NonExistent'), null);
});

test('Discovery: detectGameClientVersion reads version and localized client names', () => {
  const prober = new MockFileSystemProber();
  const mockGameRoot = 'D:\\Games\\TowerOfFantasy';

  const xmlContent = `
    <config>
      <ResVersion>3.8.5.6789</ResVersion>
      <AppVersion>3.8.0</AppVersion>
      <Section>3.8</Section>
      <LocalBranch>OBPC_Xianqian</LocalBranch>
      <Hash>hash999</Hash>
    </config>
  `;

  const configXmlPath = path.join(mockGameRoot, 'WmGpLaunch/UserData/Patcher/PatcherSDK/config.xml');
  prober.addFile(configXmlPath, xmlContent);

  const version = detectGameClientVersion(mockGameRoot, prober);

  assert.equal(version.version, '3.8.5.6789');
  assert.equal(version.appVersion, '3.8.0');
  assert.equal(version.section, '3.8');
  assert.equal(version.branch, 'OBPC_Xianqian');
  assert.equal(version.clientName, 'Global Pioneer');
  assert.equal(version.clientNameRu, 'Глобал Pioneer');
  assert.equal(version.hash, 'hash999');
});

test('Discovery: findGamePaksDirectory finds pak directory', () => {
  const prober = new MockFileSystemProber();
  const mockGameRoot = 'D:\\Games\\TowerOfFantasy';

  const paksDir = path.join(mockGameRoot, 'Hotta/Content/Paks');
  prober.addFile(path.join(paksDir, 'Hotta-WindowsNoEditor.pak'), 'pakdata');

  const found = findGamePaksDirectory(mockGameRoot, prober);
  assert.ok(found);
  assert.equal(path.normalize(found), path.normalize(paksDir));
});

test('Discovery: findMappingConfigDirectory finds MappingItemId files', () => {
  const prober = new MockFileSystemProber();
  const mockGameRoot = 'D:\\Games\\TowerOfFantasy';

  const configDir = path.join(mockGameRoot, 'Hotta/Config');
  prober.addFile(path.join(configDir, 'MappingItemId.json'), '{}');
  prober.addFile(path.join(configDir, 'MappingItemIdAndName.json'), '{}');

  const result = findMappingConfigDirectory(mockGameRoot, prober);
  assert.ok(result.configDir);
  assert.equal(path.normalize(result.configDir), path.normalize(configDir));
  assert.equal(result.mappingFiles.length, 2);
});

test('Discovery: findGameInstallation resolves explicit game path and throws if missing', () => {
  const prober = new MockFileSystemProber();
  const mockGameRoot = 'D:\\Custom\\ToF';

  // Throws if explicit game path does not exist
  assert.throws(
    () => findGameInstallation({ customGamePath: mockGameRoot, prober }),
    /Unable to automatically locate Tower of Fantasy/
  );

  // Setup mock game files
  prober.addFile(path.join(mockGameRoot, 'Hotta/Content/Paks/game.pak'), 'pak');
  prober.addFile(path.join(mockGameRoot, 'config.xml'), '<config><Version>3.8.0</Version></config>');

  const discovery = findGameInstallation({ customGamePath: mockGameRoot, prober });
  assert.equal(discovery.gamePath, path.resolve(mockGameRoot));
  assert.equal(discovery.sourceType, 'explicit_argument');
  assert.ok(discovery.paksDir);
  assert.equal(discovery.versionInfo.version, '3.8.0');
});

test('Discovery: detectGameClientVersion reads real HottaLaunch config.xml layout', () => {
  const prober = new MockFileSystemProber();
  const mockGameRoot = 'E:\\TowerOfFantasy_Global';

  const realXmlContent = `<?xml version="1.0" encoding="utf-8" ?>
<config>
    <LocalBranch>TestPC_KR2New</LocalBranch>
    <ResVersion>6.3.14</ResVersion>
    <AppVersion>3.0.0</AppVersion>
    <UpdateResVersion>3.0.0</UpdateResVersion>
    <ResSize>127471770537</ResSize>
    <ResCount>781</ResCount>
    <Hash>100a25</Hash>
</config>`;

  const xmlPath = path.join(mockGameRoot, 'HottaLaunch/UserData/Patcher/PatcherSDK/config.xml');
  prober.addFile(xmlPath, realXmlContent);

  const version = detectGameClientVersion(mockGameRoot, prober);
  assert.equal(version.version, '6.3.14');
  assert.equal(version.section, '6.3');
  assert.equal(version.branch, 'TestPC_KR2New');
  assert.equal(version.clientName, 'Korea Dev 1');
  assert.equal(version.clientNameRu, 'Корея Dev 1');
  assert.equal(version.hash, '100a25');
});

test('Discovery: findGameInstallation discovers via saved GAME_PATH.txt file', () => {
  const prober = new MockFileSystemProber();
  const mockGameRoot = 'D:\\Installed\\TowerOfFantasy';
  const savedTxtPath = 'C:\\tools\\GAME_PATH.txt';

  prober.addFile(savedTxtPath, `"${mockGameRoot}"\n`);
  prober.addFile(path.join(mockGameRoot, 'Hotta/Content/Paks/data.pak'), 'pak');
  prober.addFile(path.join(mockGameRoot, 'config.xml'), '<config><Version>3.8.0</Version></config>');

  const discovery = findGameInstallation({ savedGamePathFile: savedTxtPath, prober });
  assert.equal(discovery.gamePath, path.resolve(mockGameRoot));
  assert.equal(discovery.sourceType, 'saved_txt');
});
