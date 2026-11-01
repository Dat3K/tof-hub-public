import fs from 'node:fs';
import path from 'node:path';

export interface FileSystemProber {
  existsSync(filePath: string): boolean;
  isDirectory(dirPath: string): boolean;
  readdirSync(dirPath: string): string[];
  readFileSync(filePath: string, encoding: BufferEncoding): string;
  findFile(startDir: string, fileName: string, maxDepth?: number): string | null;
}

/**
 * Standard filesystem prober backed by node:fs.
 */
export class NodeFileSystemProber implements FileSystemProber {
  public existsSync(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  public isDirectory(dirPath: string): boolean {
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  public readdirSync(dirPath: string): string[] {
    return fs.readdirSync(dirPath);
  }

  public readFileSync(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    return fs.readFileSync(filePath, encoding);
  }

  public findFile(startDir: string, fileName: string, maxDepth: number = 4): string | null {
    if (!this.existsSync(startDir) || !this.isDirectory(startDir)) return null;

    const queue: Array<{ currentDir: string; depth: number }> = [{ currentDir: startDir, depth: 0 }];

    while (queue.length > 0) {
      const { currentDir, depth } = queue.shift()!;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
            return path.join(currentDir, entry.name);
          }
          if (entry.isDirectory() && depth < maxDepth) {
            queue.push({ currentDir: path.join(currentDir, entry.name), depth: depth + 1 });
          }
        }
      } catch {
        // Skip restricted directories
      }
    }

    return null;
  }
}

export interface GameClientVersionInfo {
  version: string;
  appVersion: string;
  section: string;
  branch: string;
  clientName: string;
  clientNameRu: string;
  hash: string;
  sourceFile: string;
  lastUpdate: string;
  lastUpdateIso: string;
}

export interface GameDiscoveryResult {
  gamePath: string;
  paksDir: string;
  configDir: string | null;
  mappingFiles: string[];
  versionInfo: GameClientVersionInfo;
  sourceType: 'explicit_argument' | 'env_var' | 'saved_txt' | 'auto_probe';
}

export interface DiscoveryOptions {
  customGamePath?: string;
  savedGamePathFile?: string;
  prober?: FileSystemProber;
}

export const BRANCH_NAMES_MAP: Record<string, { en: string; ru: string }> = {
  OBPC_2_5: { en: 'Global Live', ru: 'Глобал Live' },
  TestPC_KR2New: { en: 'Korea Dev 1', ru: 'Корея Dev 1' },
  TestPC_KRNew: { en: 'Korea Dev 2', ru: 'Корея Dev 2' },
  TestPC_IW_3_0_0: { en: 'Taiwan Dev 1', ru: 'Тайвань Dev 1' },
  TestPC_IW_2_5_0: { en: 'Taiwan Dev 2', ru: 'Тайвань Dev 2' },
  OBPC_Xianqian: { en: 'Global Pioneer', ru: 'Глобал Pioneer' },
  AdvLaunch52: { en: 'CN Client', ru: 'CN Клиент' },
};

export const COMMON_INSTALL_CANDIDATES = [
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Tower of Fantasy',
  'D:\\SteamLibrary\\steamapps\\common\\Tower of Fantasy',
  'E:\\SteamLibrary\\steamapps\\common\\Tower of Fantasy',
  'C:\\Program Files\\Epic Games\\Tower of Fantasy',
  'D:\\Epic Games\\Tower of Fantasy',
  'C:\\Program Files\\Tower of Fantasy',
  'D:\\Tower of Fantasy',
  'E:\\Tower of Fantasy',
  'C:\\TowerOfFantasy_Global',
  'D:\\TowerOfFantasy_Global',
  'E:\\TowerOfFantasy_Global',
  'F:\\TowerOfFantasy_Global',
  'C:\\Games\\Tower of Fantasy',
  'D:\\Games\\Tower of Fantasy',
  'E:\\Games\\Tower of Fantasy',
  'C:\\Games\\TowerOfFantasy',
  'D:\\Games\\TowerOfFantasy',
  'E:\\Games\\TowerOfFantasy',
];

/**
 * Parses XML string to extract values by tag name (simple regex-based parser, zero extra dependencies).
 */
export function extractXmlTagValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Detects Tower of Fantasy client version and metadata from game installation folder.
 */
export function detectGameClientVersion(
  gameFolder: string,
  prober: FileSystemProber = new NodeFileSystemProber()
): GameClientVersionInfo {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateFormatted = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

  const versionInfo: GameClientVersionInfo = {
    version: '',
    appVersion: '3.0.0',
    section: '',
    branch: '',
    clientName: 'Unknown client',
    clientNameRu: 'Неизвестный клиент',
    hash: '',
    sourceFile: '',
    lastUpdate: dateFormatted,
    lastUpdateIso: now.toISOString(),
  };

  // Search for config.xml
  const xmlCandidates = [
    path.join(gameFolder, 'HottaLaunch/UserData/Patcher/PatcherSDK/config.xml'),
    path.join(gameFolder, 'HottaLaunch/UserData/internal/config.xml'),
    path.join(gameFolder, 'HottaLaunch/UserData/Patcher/PatcherSDK/internal/config.xml'),
    path.join(gameFolder, 'HottaLaunch/UserData/Patcher/PatcherSDK/tmp/config.xml'),
    path.join(gameFolder, 'HottaLaunch/config.xml'),
    path.join(gameFolder, 'WmGpLaunch/UserData/Patcher/PatcherSDK/config.xml'),
    path.join(gameFolder, 'WmGpLaunch/UserData/internal/config.xml'),
    path.join(gameFolder, 'WmGpLaunch/UserData/Patcher/PatcherSDK/internal/config.xml'),
    path.join(gameFolder, 'WmGpLaunch/UserData/Patcher/PatcherSDK/tmp/config.xml'),
    path.join(gameFolder, 'WmGpLaunch/config.xml'),
    path.join(gameFolder, 'config.xml'),
  ];

  let foundXml: string | null = null;
  for (const candidate of xmlCandidates) {
    if (prober.existsSync(candidate)) {
      foundXml = candidate;
      break;
    }
  }

  if (!foundXml) {
    foundXml = prober.findFile(gameFolder, 'config.xml', 4);
  }

  // Search for PatcherConfig.json
  const jsonCandidates = [
    path.join(gameFolder, 'HottaLaunch/ResFilesM/200123/PatcherConfig/PatcherConfig.json'),
    path.join(gameFolder, 'WmGpLaunch/ResFilesM/200123/PatcherConfig/PatcherConfig.json'),
  ];

  let foundJson: string | null = null;
  let appId = '';
  for (const candidate of jsonCandidates) {
    if (prober.existsSync(candidate)) {
      foundJson = candidate;
      break;
    }
  }

  if (!foundJson) {
    foundJson = prober.findFile(gameFolder, 'PatcherConfig.json', 4);
  }

  // Parse JSON if available
  if (foundJson && prober.existsSync(foundJson)) {
    try {
      const rawJson = JSON.parse(prober.readFileSync(foundJson, 'utf8'));
      if (rawJson.appId) appId = String(rawJson.appId).trim();
      if (rawJson.branchName) {
        versionInfo.branch = String(rawJson.branchName).trim();
      }
      if (rawJson.appVersion) {
        versionInfo.appVersion = String(rawJson.appVersion).trim();
      }
    } catch {
      // Non-fatal
    }
  }

  // Parse XML if available
  if (foundXml && prober.existsSync(foundXml)) {
    try {
      versionInfo.sourceFile = foundXml;
      const xmlContent = prober.readFileSync(foundXml, 'utf8');

      const resVer = extractXmlTagValue(xmlContent, 'ResVersion');
      const ver = extractXmlTagValue(xmlContent, 'Version');
      const appVer = extractXmlTagValue(xmlContent, 'AppVersion');
      const sec = extractXmlTagValue(xmlContent, 'Section');
      const hash = extractXmlTagValue(xmlContent, 'Hash');
      const localBranch = extractXmlTagValue(xmlContent, 'LocalBranch');

      if (resVer) {
        versionInfo.version = resVer;
      } else if (ver) {
        versionInfo.version = ver;
      }

      if (appVer) versionInfo.appVersion = appVer;
      if (sec) versionInfo.section = sec;
      if (hash) versionInfo.hash = hash;
      if (localBranch && !versionInfo.branch) {
        versionInfo.branch = localBranch;
      }
    } catch {
      // Non-fatal
    }
  }

  // Fallback branch inference from folder name
  if (!versionInfo.branch) {
    if (/KR2|kr1|kr_1/i.test(gameFolder)) {
      versionInfo.branch = 'TestPC_KR2New';
    } else if (/KR|kr2|kr_2/i.test(gameFolder)) {
      versionInfo.branch = 'TestPC_KRNew';
    }
  }

  if (BRANCH_NAMES_MAP[versionInfo.branch]) {
    versionInfo.clientName = BRANCH_NAMES_MAP[versionInfo.branch].en;
    versionInfo.clientNameRu = BRANCH_NAMES_MAP[versionInfo.branch].ru;
  } else if (versionInfo.branch) {
    versionInfo.clientName = versionInfo.branch;
    versionInfo.clientNameRu = versionInfo.branch;
  }

  // ToFPatcher shares this resource branch across three launcher presets.
  // Regional app ids are launcher metadata, not the resource version.
  if (versionInfo.branch === 'OBPC_2_5') {
    if (appId === '200124') {
      versionInfo.clientName = 'Korea Live';
      versionInfo.clientNameRu = 'Корея Live';
    } else if (appId === '2000003') {
      versionInfo.clientName = 'Taiwan Live';
      versionInfo.clientNameRu = 'Тайвань Live';
    }
  }

  if (!versionInfo.section && versionInfo.version) {
    const parts = versionInfo.version.split('.');
    if (parts.length >= 2) {
      versionInfo.section = `${parts[0]}.${parts[1]}`;
    }
  }

  return versionInfo;
}

/**
 * Finds game PAK files directory inside game installation.
 */
export function findGamePaksDirectory(
  gameFolder: string,
  prober: FileSystemProber = new NodeFileSystemProber()
): string | null {
  const candidateDirs = [
    path.join(gameFolder, 'Client/WindowsNoEditor/Hotta/Content/Paks'),
    path.join(gameFolder, 'Hotta/Content/Paks'),
    path.join(gameFolder, 'TowerOfFantasy/Hotta/Content/Paks'),
    path.join(gameFolder, 'Tower of Fantasy/Hotta/Content/Paks'),
    path.join(gameFolder, 'TowerOfFantasy/Content/Paks'),
    path.join(gameFolder, 'Content/Paks'),
    path.join(gameFolder, 'Paks'),
  ];

  for (const dir of candidateDirs) {
    if (prober.existsSync(dir) && prober.isDirectory(dir)) {
      try {
        const files = prober.readdirSync(dir);
        if (files.some((f) => f.toLowerCase().endsWith('.pak'))) {
          return dir;
        }
      } catch {
        // Skip
      }
    }
  }

  // Deep scan: the first directory that directly contains a .pak archive.
  const queue: Array<{ dir: string; depth: number }> = [{ dir: gameFolder, depth: 0 }];
  while (queue.length > 0) {
    const { dir, depth } = queue.shift()!;
    let names: string[];
    try {
      names = prober.readdirSync(dir);
    } catch {
      continue;
    }
    if (names.some((name) => name.toLowerCase().endsWith('.pak'))) return dir;
    if (depth >= 5) continue;
    for (const name of names) {
      const child = path.join(dir, name);
      if (prober.isDirectory(child)) queue.push({ dir: child, depth: depth + 1 });
    }
  }
  return null;
}

/** Game client region; China uses its own pak encryption key. */
export type GameRegion = 'global' | 'cn';

export function detectGameRegion(versionInfo: Pick<GameClientVersionInfo, 'branch' | 'clientName'>, gamePath = ''): GameRegion {
  if (/^AdvLaunch/i.test(versionInfo.branch) || /\bCN\b/.test(versionInfo.clientName)) return 'cn';
  if (/幻塔/.test(gamePath)) return 'cn';
  return 'global';
}

/**
 * Finds config directory containing MappingItemId*.json files.
 */
export function findMappingConfigDirectory(
  gameFolder: string,
  prober: FileSystemProber = new NodeFileSystemProber()
): { configDir: string | null; mappingFiles: string[] } {
  const candidateDirs = [
    path.join(gameFolder, 'Client/WindowsNoEditor/Hotta/Config'),
    path.join(gameFolder, 'Hotta/Config'),
    path.join(gameFolder, 'TowerOfFantasy/Hotta/Config'),
    path.join(gameFolder, 'Tower of Fantasy/Hotta/Config'),
    path.join(gameFolder, 'TowerOfFantasy/Config'),
    path.join(gameFolder, 'Config'),
    gameFolder,
  ];

  const expectedMappings = ['MappingItemId.json', 'MappingItemIdAndName.json', 'MappingItemIdAndColor.json'];

  for (const dir of candidateDirs) {
    if (prober.existsSync(dir) && prober.isDirectory(dir)) {
      if (prober.existsSync(path.join(dir, 'MappingItemId.json'))) {
        const found = expectedMappings.filter((f) => prober.existsSync(path.join(dir, f)));
        return { configDir: dir, mappingFiles: found };
      }
    }
  }

  const deepFound = prober.findFile(gameFolder, 'MappingItemId.json', 4);
  if (deepFound) {
    const parent = path.dirname(deepFound);
    const found = expectedMappings.filter((f) => prober.existsSync(path.join(parent, f)));
    return { configDir: parent, mappingFiles: found };
  }

  return { configDir: null, mappingFiles: [] };
}

/**
 * Discovers Tower of Fantasy game installation.
 */
export function findGameInstallation(options: DiscoveryOptions = {}): GameDiscoveryResult {
  const prober = options.prober ?? new NodeFileSystemProber();
  let resolvedGamePath: string | null = null;
  let sourceType: GameDiscoveryResult['sourceType'] = 'auto_probe';

  // 1. Explicit argument
  if (options.customGamePath && prober.existsSync(options.customGamePath)) {
    resolvedGamePath = path.resolve(options.customGamePath);
    sourceType = 'explicit_argument';
  }

  // 2. Environment variables (TOF_GAME_PATH, TOF_PATH, TOWER_OF_FANTASY_PATH, TOF_INSTALL_PATH)
  if (!resolvedGamePath) {
    const envCandidate =
      process.env.TOF_GAME_PATH ||
      process.env.TOF_PATH ||
      process.env.TOWER_OF_FANTASY_PATH ||
      process.env.TOF_INSTALL_PATH;
    if (envCandidate && prober.existsSync(envCandidate)) {
      resolvedGamePath = path.resolve(envCandidate);
      sourceType = 'env_var';
    }
  }

  // 3. Saved GAME_PATH.txt
  if (!resolvedGamePath) {
    const savedCandidates = [
      options.savedGamePathFile,
      path.resolve(process.cwd(), 'GAME_PATH.txt'),
      path.resolve(__dirname, '../GAME_PATH.txt'),
      path.resolve(__dirname, '../../GAME_PATH.txt'),
    ].filter(Boolean) as string[];

    for (const savedCandidate of savedCandidates) {
      if (prober.existsSync(savedCandidate)) {
        try {
          const raw = prober.readFileSync(savedCandidate, 'utf8').trim();
          const cleanPath = raw.replace(/^["']|["']$/g, '').trim();
          if (cleanPath && prober.existsSync(cleanPath)) {
            resolvedGamePath = path.resolve(cleanPath);
            sourceType = 'saved_txt';
            break;
          }
        } catch {
          // Skip
        }
      }
    }
  }

  // 4. Auto-probe common paths
  if (!resolvedGamePath) {
    for (const candidate of COMMON_INSTALL_CANDIDATES) {
      if (prober.existsSync(candidate) && prober.isDirectory(candidate)) {
        resolvedGamePath = path.resolve(candidate);
        sourceType = 'auto_probe';
        break;
      }
    }
  }

  if (!resolvedGamePath) {
    throw new Error(
      'Unable to automatically locate Tower of Fantasy game installation. Please specify game folder via --game-path.'
    );
  }

  const paksDir = findGamePaksDirectory(resolvedGamePath, prober);
  if (!paksDir) {
    throw new Error(
      `Game folder found at "${resolvedGamePath}", but no .pak archive files directory could be located.`
    );
  }

  const { configDir, mappingFiles } = findMappingConfigDirectory(resolvedGamePath, prober);
  const versionInfo = detectGameClientVersion(resolvedGamePath, prober);

  return {
    gamePath: resolvedGamePath,
    paksDir,
    configDir,
    mappingFiles,
    versionInfo,
    sourceType,
  };
}
