import type {
  SquadState,
  SquadPlayer,
  SquadWeaponSlot,
  SquadMatrixSlot,
  SquadRelicSlot,
  SquadMode,
  CompServer,
} from './types';

function readWeaponChoice(value:unknown):string|undefined {
  return typeof value==='string'&&value.length>0&&value.length<=100?value:undefined;
}
/** Optional weapon settings (Scatter skills, mode, element form) travel as the 7th tuple item. */
function weaponSettings(w:SquadWeaponSlot) {
  const settings:Record<string,unknown>={};
  if(w.skills?.some(Boolean))settings.skills=w.skills;
  if(w.skills2?.some(Boolean))settings.skills2=w.skills2;
  for(const key of ['mode','mode2','element','element2'] as const)if(w[key])settings[key]=w[key];
  return Object.keys(settings).length?settings:null;
}
function applyWeaponSettings(target:SquadWeaponSlot,source:Record<string,unknown>) {
  target.skills=readWeaponSkills(source.skills);target.skills2=readWeaponSkills(source.skills2);
  for(const key of ['mode','mode2','element','element2'] as const){const value=readWeaponChoice(source[key]);if(value)target[key]=value;}
}
function readWeaponSkills(value:unknown):string[]|undefined {
  if(!Array.isArray(value)||value.length!==2||value.some(id=>typeof id!=='string'||id.length>100)||(value[0]&&value[0]===value[1]))return undefined;
  return value;
}
// RFC 1951 Raw Deflate & Inflate implementation in pure TypeScript
export const TinyZlib = (() => {
  function rev(code: number, bits: number): number {
    let r = 0;
    for (let i = 0; i < bits; i++) r = (r << 1) | ((code >> i) & 1);
    return r;
  }

  const fixLitCodes = new Uint16Array(288);
  const fixLitLens = new Uint8Array(288);
  for (let i = 0; i <= 143; i++) {
    fixLitCodes[i] = rev(0x30 + i, 8);
    fixLitLens[i] = 8;
  }
  for (let i = 144; i <= 255; i++) {
    fixLitCodes[i] = rev(0x190 + (i - 144), 9);
    fixLitLens[i] = 9;
  }
  for (let i = 256; i <= 279; i++) {
    fixLitCodes[i] = rev(i - 256, 7);
    fixLitLens[i] = 7;
  }
  for (let i = 280; i <= 287; i++) {
    fixLitCodes[i] = rev(0xc0 + (i - 280), 8);
    fixLitLens[i] = 8;
  }

  const lenCodes: [number, number, number][] = [
    [3, 0, 257], [4, 0, 258], [5, 0, 259], [6, 0, 260], [7, 0, 261], [8, 0, 262],
    [9, 0, 263], [10, 0, 264], [11, 1, 265], [13, 1, 266], [15, 1, 267], [17, 1, 268],
    [19, 2, 269], [23, 2, 270], [27, 2, 271], [31, 2, 272], [35, 3, 273], [43, 3, 274],
    [51, 3, 275], [59, 3, 276], [67, 4, 277], [83, 4, 278], [99, 4, 279], [115, 4, 280],
    [131, 5, 281], [163, 5, 282], [195, 5, 283], [227, 5, 284], [258, 0, 285],
  ];

  function getLenCode(len: number): [number, number, number] {
    for (let i = lenCodes.length - 1; i >= 0; i--) {
      if (len >= lenCodes[i][0]) return lenCodes[i];
    }
    return lenCodes[0];
  }

  const distCodes: [number, number, number][] = [
    [1, 0, 0], [2, 0, 1], [3, 0, 2], [4, 0, 3], [5, 1, 4], [7, 1, 5],
    [9, 2, 6], [13, 2, 7], [17, 3, 8], [25, 3, 9], [33, 4, 10], [49, 4, 11],
    [65, 5, 12], [97, 5, 13], [129, 6, 14], [193, 6, 15], [257, 7, 16], [385, 7, 17],
    [513, 8, 18], [769, 8, 19], [1025, 9, 20], [1537, 9, 21], [2049, 10, 22], [3073, 10, 23],
    [4097, 11, 24], [6145, 11, 25], [8193, 12, 26], [12289, 12, 27], [16385, 13, 28], [24577, 13, 29],
  ];

  function getDistCode(d: number): [number, number, number] {
    for (let i = distCodes.length - 1; i >= 0; i--) {
      if (d >= distCodes[i][0]) return distCodes[i];
    }
    return distCodes[0];
  }

  class BitWriter {
    buf: Uint8Array;
    byteLen: number;
    bitBuf: number;
    bitCount: number;

    constructor() {
      this.buf = new Uint8Array(1024);
      this.byteLen = 0;
      this.bitBuf = 0;
      this.bitCount = 0;
    }

    write(bits: number, count: number) {
      this.bitBuf |= (bits & ((1 << count) - 1)) << this.bitCount;
      this.bitCount += count;
      while (this.bitCount >= 8) {
        if (this.byteLen >= this.buf.length) {
          const n = new Uint8Array(this.buf.length * 2);
          n.set(this.buf);
          this.buf = n;
        }
        this.buf[this.byteLen++] = this.bitBuf & 0xff;
        this.bitBuf >>= 8;
        this.bitCount -= 8;
      }
    }

    finish(): Uint8Array {
      if (this.bitCount > 0) {
        if (this.byteLen >= this.buf.length) {
          const n = new Uint8Array(this.buf.length + 1);
          n.set(this.buf);
          this.buf = n;
        }
        this.buf[this.byteLen++] = this.bitBuf & 0xff;
        this.bitBuf = 0;
        this.bitCount = 0;
      }
      return this.buf.subarray(0, this.byteLen);
    }
  }

  function rawDeflate(data: string | Uint8Array): Uint8Array {
    let bytes: Uint8Array;
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else {
      bytes = data;
    }

    const bw = new BitWriter();
    bw.write(1 | (1 << 1), 3);
    const len = bytes.length;
    let pos = 0;
    const head = new Int32Array(65536).fill(-1);
    const prev = new Int32Array(len).fill(-1);

    while (pos < len) {
      let matchLen = 0;
      let matchDist = 0;
      if (pos + 2 < len) {
        const h = ((bytes[pos] << 8) ^ (bytes[pos + 1] << 4) ^ bytes[pos + 2]) & 0xffff;
        let m = head[h];
        prev[pos] = m;
        head[h] = pos;
        let chain = 0;
        while (m >= 0 && pos - m <= 32768 && chain++ < 64) {
          if (bytes[m + matchLen] === bytes[pos + matchLen]) {
            let k = 0;
            while (k < 258 && pos + k < len && bytes[m + k] === bytes[pos + k]) k++;
            if (k > matchLen) {
              matchLen = k;
              matchDist = pos - m;
              if (k === 258) break;
            }
          }
          m = prev[m];
        }
      }

      if (matchLen >= 3) {
        const lc = getLenCode(matchLen);
        bw.write(fixLitCodes[lc[2]], fixLitLens[lc[2]]);
        if (lc[1] > 0) bw.write(matchLen - lc[0], lc[1]);
        const dc = getDistCode(matchDist);
        bw.write(rev(dc[2], 5), 5);
        if (dc[1] > 0) bw.write(matchDist - dc[0], dc[1]);
        for (let j = 1; j < matchLen; j++) {
          if (pos + j + 2 < len) {
            const h = ((bytes[pos + j] << 8) ^ (bytes[pos + j + 1] << 4) ^ bytes[pos + j + 2]) & 0xffff;
            prev[pos + j] = head[h];
            head[h] = pos + j;
          }
        }
        pos += matchLen;
      } else {
        bw.write(fixLitCodes[bytes[pos++]], fixLitLens[bytes[pos - 1]]);
      }
    }
    bw.write(fixLitCodes[256], fixLitLens[256]);
    return bw.finish();
  }

  class BitReader {
    data: Uint8Array;
    pos: number;
    bitBuf: number;
    bitCount: number;

    constructor(data: Uint8Array) {
      this.data = data;
      this.pos = 0;
      this.bitBuf = 0;
      this.bitCount = 0;
    }

    read(bits: number): number {
      while (this.bitCount < bits) {
        if (this.pos >= this.data.length) throw new Error('Unexpected EOF in compressed stream');
        this.bitBuf |= this.data[this.pos++] << this.bitCount;
        this.bitCount += 8;
      }
      const r = this.bitBuf & ((1 << bits) - 1);
      this.bitBuf >>= bits;
      this.bitCount -= bits;
      return r;
    }

    align() {
      this.bitBuf >>= this.bitCount & 7;
      this.bitCount -= this.bitCount & 7;
    }
  }

  interface HuffTree {
    tree: Record<string, number>;
    maxLen: number;
  }

  function buildTree(lengths: Uint8Array): HuffTree {
    const maxLen = Math.max(...Array.from(lengths));
    const count = new Uint16Array(maxLen + 1);
    for (const l of lengths) if (l > 0) count[l]++;
    const nextCode = new Uint16Array(maxLen + 1);
    let code = 0;
    for (let i = 1; i <= maxLen; i++) {
      code = (code + count[i - 1]) << 1;
      nextCode[i] = code;
    }
    const tree: Record<string, number> = {};
    for (let i = 0; i < lengths.length; i++) {
      const l = lengths[i];
      if (l > 0) {
        const c = nextCode[l]++;
        let r = 0;
        for (let b = 0; b < l; b++) r = (r << 1) | ((c >> b) & 1);
        tree[`${l}:${r}`] = i;
      }
    }
    return { tree, maxLen };
  }

  function readSymbol(br: BitReader, huff: HuffTree): number {
    let code = 0;
    for (let l = 1; l <= huff.maxLen; l++) {
      code |= br.read(1) << (l - 1);
      const sym = huff.tree[`${l}:${code}`];
      if (sym !== undefined) return sym;
    }
    throw new Error('Invalid Huffman code');
  }

  const fixedLitHuff = (() => {
    const lens = new Uint8Array(288);
    lens.fill(8, 0, 144);
    lens.fill(9, 144, 256);
    lens.fill(7, 256, 280);
    lens.fill(8, 280, 288);
    return buildTree(lens);
  })();

  const fixedDistHuff = (() => {
    const lens = new Uint8Array(32).fill(5);
    return buildTree(lens);
  })();

  const lenBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const lenExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const distExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const clenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function rawInflate(data: Uint8Array,maxBytes=256*1024): Uint8Array {
    if(data.length>256*1024)throw new Error('Compressed composition exceeds limit');
    const br = new BitReader(data);
    let out = new Uint8Array(2048);
    let outLen = 0;
    function push(byte: number) {
      if(outLen>=maxBytes)throw new Error('Decompressed composition exceeds limit');
      if (outLen >= out.length) {
        const n = new Uint8Array(out.length * 2);
        n.set(out);
        out = n;
      }
      out[outLen++] = byte;
    }
    let bfinal = 0;
    while (!bfinal) {
      bfinal = br.read(1);
      const btype = br.read(2);
      if (btype === 0) {
        br.align();
        const bLen = br.read(16);
        const nLen = br.read(16);
        if ((bLen ^ 0xffff) !== nLen) throw new Error('Invalid stored block length');
        for (let i = 0; i < bLen; i++) push(br.read(8));
      } else if (btype === 1 || btype === 2) {
        let litHuff: HuffTree;
        let distHuff: HuffTree;
        if (btype === 1) {
          litHuff = fixedLitHuff;
          distHuff = fixedDistHuff;
        } else {
          const hlit = br.read(5) + 257;
          const hdist = br.read(5) + 1;
          const hclen = br.read(4) + 4;
          const clens = new Uint8Array(19);
          for (let i = 0; i < hclen; i++) clens[clenOrder[i]] = br.read(3);
          const clenHuff = buildTree(clens);
          const allLens = new Uint8Array(hlit + hdist);
          let i = 0;
          while (i < hlit + hdist) {
            const sym = readSymbol(br, clenHuff);
            if (sym < 16) {
              allLens[i++] = sym;
            } else if (sym === 16) {
              let copy = br.read(2) + 3;
              const val = allLens[i - 1];
              while (copy--) allLens[i++] = val;
            } else if (sym === 17) {
              let zeros = br.read(3) + 3;
              while (zeros--) allLens[i++] = 0;
            } else if (sym === 18) {
              let zeros = br.read(7) + 11;
              while (zeros--) allLens[i++] = 0;
            }
          }
          litHuff = buildTree(allLens.subarray(0, hlit));
          distHuff = buildTree(allLens.subarray(hlit));
        }

        while (true) {
          const sym = readSymbol(br, litHuff);
          if (sym < 256) {
            push(sym);
          } else if (sym === 256) {
            break;
          } else {
            const lIdx = sym - 257;
            const matchLen = lenBase[lIdx] + (lenExtra[lIdx] > 0 ? br.read(lenExtra[lIdx]) : 0);
            const dSym = readSymbol(br, distHuff);
            const matchDist = distBase[dSym] + (distExtra[dSym] > 0 ? br.read(distExtra[dSym]) : 0);
            if(!Number.isFinite(matchLen)||!Number.isFinite(matchDist)||matchDist>outLen)throw new Error('Invalid compressed match');
            for (let k = 0; k < matchLen; k++) push(out[outLen - matchDist]);
          }
        }
      } else {
        throw new Error('Invalid block type');
      }
    }
    return out.subarray(0, outLen);
  }

  return { rawDeflate, rawInflate };
})();

export const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function bytesToBase62(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }
  if (leadingZeros === bytes.length) return '0'.repeat(leadingZeros);
  let hex = '';
  for (let i = leadingZeros; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    hex += h.length === 1 ? '0' + h : h;
  }
  let num = BigInt('0x' + hex);
  let res = '';
  const base = 62n;
  while (num > 0n) {
    const rem = Number(num % base);
    num = num / base;
    res = BASE62_CHARS[rem] + res;
  }
  return '0'.repeat(leadingZeros) + res;
}

export function base62ToBytes(str: string): Uint8Array | null {
  if (!str || typeof str !== 'string') return new Uint8Array(0);
  let leadingZeros = 0;
  while (leadingZeros < str.length && str[leadingZeros] === '0') {
    leadingZeros++;
  }
  if (leadingZeros === str.length) return new Uint8Array(leadingZeros);
  let num = 0n;
  const base = 62n;
  for (let i = leadingZeros; i < str.length; i++) {
    const idx = BASE62_CHARS.indexOf(str[i]);
    if (idx === -1) return null;
    num = num * base + BigInt(idx);
  }
  let hex = num.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const byteLen = hex.length / 2;
  const bytes = new Uint8Array(leadingZeros + byteLen);
  for (let i = 0; i < byteLen; i++) {
    bytes[leadingZeros + i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  let base64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

export function fromBase64Url(b64url: string): string {
  let base64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function normalizeStarOrRankValue(val: unknown, fallback: number): number | string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return val;
  const trimmed = String(val).trim();
  if (!trimmed) return fallback;
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return trimmed;
}

/**
 * Serializes squad state to compact, URL-safe Base62 string matching legacy comp-core.js.
 */
export function serializeSquadState(
  state: SquadState,
  options: { asQuery?: boolean; asHash?: boolean } = {}
): string {
  const activeCount = state.mode === 8 ? 8 : 4;
  const prunedPlayers = state.players.slice(0, activeCount).map((p, idx) => {
    const item: Record<string, any> = {};
    if (p.id && p.id !== `player-${idx + 1}`) item.i = p.id;
    if (p.name && p.name !== `Player ${idx + 1}` && p.name !== '') item.n = p.name;
    if (p.customRole) item.r = p.customRole;
    if (p.trait) item.tr = p.trait;
    if (p.traitCustomText) item.tct = p.traitCustomText;
    if (p.weaponMode) item.wm = p.weaponMode;

    // Weapons
    const wList: any[] = [];
    (p.weapons || []).forEach((w) => {
      if (!w || (!w.id && !w.matrix && !w.customText)) {
        wList.push(null);
      } else {
        let mTuple: any = null;
        if (w.matrix && (w.matrix.id || w.matrix.customText)) {
          const mStars = normalizeStarOrRankValue(w.matrix.stars, 3);
          if (w.matrix.id2) {
            const mStars2 = normalizeStarOrRankValue(w.matrix.stars2, 3);
            mTuple = [w.matrix.id, 2, mStars, w.matrix.id2, mStars2];
          } else if (w.matrix.id) {
            const mCount = w.matrix.count === 2 ? 2 : 4;
            const mCt = w.matrix.customText || null;
            if (mCt) {
              mTuple = [w.matrix.id, mCount, mStars, null, 0, mCt];
            } else {
              mTuple = [w.matrix.id, mCount, mStars];
            }
          } else if (w.matrix.customText) {
            mTuple = [null, 0, 0, null, 0, w.matrix.customText];
          }
        }

        const wStars = normalizeStarOrRankValue(w.stars, 6);
        const wCt = w.customText || null;
        const settings=weaponSettings(w);
        if(settings) {
          wList.push([w.id||null,wStars,mTuple,wCt,w.id2||null,normalizeStarOrRankValue(w.stars2,6),settings]);
        } else if (w.id2) {
          const wStars2 = normalizeStarOrRankValue(w.stars2, 6);
          wList.push([w.id || null, wStars, mTuple, wCt, w.id2, wStars2]);
        } else if (wCt) {
          wList.push([w.id || null, wStars, mTuple, wCt]);
        } else if (mTuple) {
          wList.push([w.id || null, wStars, mTuple]);
        } else if (wStars !== 6) {
          wList.push([w.id || null, wStars]);
        } else if (w.id) {
          wList.push([w.id]);
        } else {
          wList.push(null);
        }
      }
    });

    while (wList.length > 0 && wList[wList.length - 1] === null) {
      wList.pop();
    }
    if (wList.length > 0) item.w = wList;

    // Relics
    const rList: any[] = [];
    (p.relics || []).forEach((r) => {
      if (!r || (!r.id && !r.customText)) {
        rList.push(null);
      } else {
        const rRank = normalizeStarOrRankValue(r.rank, 5);
        const rCt = r.customText || null;
        if (rCt) {
          rList.push([r.id || null, rRank, rCt]);
        } else if (rRank !== 5) {
          rList.push([r.id, rRank]);
        } else {
          rList.push([r.id]);
        }
      }
    });

    while (rList.length > 0 && rList[rList.length - 1] === null) {
      rList.pop();
    }
    if (rList.length > 0) item.rl = rList;

    return item;
  });

  const compact: Record<string, unknown> = {
    v: 2,
    m: state.mode === 8 ? 8 : 4,
    t: state.title || '',
    p: prunedPlayers,
  };
  // MMO scope is encoded; standard is the default and stays out of the link.
  if (state.server === 'mmo') compact.s = 'mmo';

  const json = JSON.stringify(compact);
  const compressed = TinyZlib.rawDeflate(json);
  const encoded = bytesToBase62(compressed);

  if (options.asHash) return `#c=${encoded}`;
  if (options.asQuery) return `?c=${encoded}`;
  return encoded;
}

/**
 * Deserializes URL query param, hash, or encoded string back into a SquadState.
 */
export function deserializeSquadState(
  payload: string,
  roleDetector?: (weapons: SquadWeaponSlot[]) => SquadPlayer['role']
): SquadState | null {
  if (!payload || typeof payload !== 'string'||payload.length>64*1024) return null;

  let clean = payload.trim();
  if (!clean) return null;

  try {
    if (clean.includes('?') || clean.includes('#') || clean.includes('=')) {
      const qIndex = clean.indexOf('?');
      const hIndex = clean.indexOf('#');
      const searchPart =
        qIndex !== -1
          ? hIndex !== -1 && hIndex > qIndex
            ? clean.slice(qIndex + 1, hIndex)
            : clean.slice(qIndex + 1)
          : '';
      const hashPart = hIndex !== -1 ? clean.slice(hIndex + 1) : '';

      let extracted = '';
      if (searchPart) {
        const match = searchPart.match(/(?:^|&)(?:c|comp)=([^&]+)/);
        if (match) extracted = decodeURIComponent(match[1]);
      }
      if (!extracted && hashPart) {
        const match = hashPart.match(/(?:^|&)(?:c|comp)=([^&]+)/);
        if (match) {
          extracted = decodeURIComponent(match[1]);
        } else if (!hashPart.includes('=')) {
          extracted = hashPart;
        }
      }
      if (extracted) clean = extracted;
    }

    if (clean.startsWith('#')) clean = clean.substring(1);
    if (clean.startsWith('?')) clean = clean.substring(1);
    if (clean.startsWith('c=')) clean = clean.substring(2);
    else if (clean.startsWith('comp=')) clean = clean.substring(5);

    clean = clean.trim();
    if (!clean) return null;

    let parsed: any = null;

    // 1. Base62 decoding
    try {
      const b62Bytes = base62ToBytes(clean);
      if (b62Bytes && b62Bytes.length > 0) {
        const decomp = TinyZlib.rawInflate(b62Bytes);
        const json = new TextDecoder().decode(decomp);
        const obj = JSON.parse(json);
        if (obj && (obj.p || obj.m || obj.v)) parsed = obj;
      }
    } catch (_) {}

    // 2. Base64URL fallback
    if (!parsed) {
      try {
        const bytes = base64UrlToBytes(clean);
        if (bytes && bytes.length > 0) {
          let json = '';
          if (bytes[0] === 0x7b || bytes[0] === 0x5b) {
            json = fromBase64Url(clean);
          } else {
            try {
              const decomp = TinyZlib.rawInflate(bytes);
              json = new TextDecoder().decode(decomp);
            } catch (_) {
              json = fromBase64Url(clean);
            }
          }
          if (json) {
            const obj = JSON.parse(json);
            if (obj && (obj.p || obj.m || obj.v)) parsed = obj;
          }
        }
      } catch (_) {}
    }

    // 3. Raw JSON fallback
    if (!parsed && (clean.startsWith('{') || clean.startsWith('['))) {
      try {
        parsed = JSON.parse(clean);
      } catch (_) {}
    }

    if (!parsed || typeof parsed !== 'object') return null;

    const mode: SquadMode = parsed.m === 8 ? 8 : 4;
    const server: CompServer = parsed.s === 'mmo' ? 'mmo' : 'standard';
    const title = parsed.t || 'Squad Composition';
    const players: SquadPlayer[] = [];
    const rawPlayers = Array.isArray(parsed.p) ? parsed.p : [];

    for (let i = 0; i < 8; i++) {
      const rawP = rawPlayers[i];
      if (!rawP) {
        players.push({
          id: `player-${i + 1}`,
          name: `Player ${i + 1}`,
          role: 'dps',
          customRole: null,
          trait: null,
          traitCustomText: '',
          weapons: [
            { id: null, stars: 6, matrix: null, customText: '' },
            { id: null, stars: 6, matrix: null, customText: '' },
            { id: null, stars: 6, matrix: null, customText: '' },
          ],
          relics: [
            { id: null, rank: 5, customText: '' },
            { id: null, rank: 5, customText: '' },
          ],
        });
        continue;
      }

      const weapons: SquadWeaponSlot[] = [];
      for (let wi = 0; wi < 3; wi++) {
        const rawW = rawP.w && rawP.w[wi] ? rawP.w[wi] : null;
        if (Array.isArray(rawW)) {
          let matrixObj: SquadMatrixSlot | null = null;
          if (Array.isArray(rawW[2])) {
            if (rawW[2].length >= 6 && rawW[2][5]) {
              matrixObj = {
                id: rawW[2][0] || null,
                count: rawW[2][1] || 4,
                stars: normalizeStarOrRankValue(rawW[2][2], 3),
                customText: rawW[2][5],
              };
            } else if (rawW[2].length >= 4 && rawW[2][3]) {
              matrixObj = {
                id: rawW[2][0] || null,
                count: 2,
                stars: normalizeStarOrRankValue(rawW[2][2], 3),
                id2: rawW[2][3] || null,
                count2: 2,
                stars2: normalizeStarOrRankValue(rawW[2][4], 3),
              };
            } else {
              matrixObj = {
                id: rawW[2][0] || null,
                count: rawW[2][1] || 4,
                stars: normalizeStarOrRankValue(rawW[2][2], 3),
              };
            }
          } else if (rawW[2] && typeof rawW[2] === 'object') {
            matrixObj = {
              id: rawW[2].id || null,
              count: rawW[2].id2 ? 2 : rawW[2].count || 4,
              stars: normalizeStarOrRankValue(rawW[2].stars, 3),
              customText: rawW[2].customText || '',
            };
            if (rawW[2].id2) {
              matrixObj.id2 = rawW[2].id2;
              matrixObj.count2 = 2;
              matrixObj.stars2 = normalizeStarOrRankValue(rawW[2].stars2, 3);
            }
          }

          const weaponObj: SquadWeaponSlot = {
            id: rawW[0] || null,
            stars: normalizeStarOrRankValue(rawW[1], 6),
            matrix: matrixObj,
            customText: typeof rawW[3] === 'string' ? rawW[3] : '',
          };
          if (rawW.length >= 5 && rawW[4]) {
            weaponObj.id2 = rawW[4];
            weaponObj.stars2 = normalizeStarOrRankValue(rawW[5], 6);
          }
          if(rawW[6]&&typeof rawW[6]==='object')applyWeaponSettings(weaponObj,rawW[6]);
          weapons.push(weaponObj);
        } else if (rawW && typeof rawW === 'object') {
          let matrixObj: SquadMatrixSlot | null = null;
          if (rawW.matrix) {
            matrixObj = {
              id: rawW.matrix.id || null,
              count: rawW.matrix.id2 ? 2 : rawW.matrix.count || 4,
              stars: normalizeStarOrRankValue(rawW.matrix.stars, 3),
              customText: rawW.matrix.customText || '',
            };
            if (rawW.matrix.id2) {
              matrixObj.id2 = rawW.matrix.id2;
              matrixObj.count2 = 2;
              matrixObj.stars2 = normalizeStarOrRankValue(rawW.matrix.stars2, 3);
            }
          }

          const weaponObj: SquadWeaponSlot = {
            id: rawW.id || null,
            stars: normalizeStarOrRankValue(rawW.stars, 6),
            matrix: matrixObj,
            customText: typeof rawW.customText === 'string' ? rawW.customText : '',
          };
          applyWeaponSettings(weaponObj,rawW);
          if (rawW.id2) {
            weaponObj.id2 = rawW.id2;
            weaponObj.stars2 = normalizeStarOrRankValue(rawW.stars2, 6);
          }
          weapons.push(weaponObj);
        } else {
          weapons.push({ id: null, stars: 6, matrix: null, customText: '' });
        }
      }

      const relics: SquadRelicSlot[] = [];
      for (let ri = 0; ri < 2; ri++) {
        const rawR = rawP.rl && rawP.rl[ri] ? rawP.rl[ri] : null;
        if (Array.isArray(rawR)) {
          relics.push({
            id: rawR[0] || null,
            rank: normalizeStarOrRankValue(rawR[1], 5),
            customText: typeof rawR[2] === 'string' ? rawR[2] : '',
          });
        } else if (rawR && typeof rawR === 'object') {
          relics.push({
            id: rawR.id || null,
            rank: normalizeStarOrRankValue(rawR.rank, 5),
            customText: typeof rawR.customText === 'string' ? rawR.customText : '',
          });
        } else {
          relics.push({ id: null, rank: 5, customText: '' });
        }
      }

      const detectedRole = roleDetector ? roleDetector(weapons) : 'dps';
      const finalRole = rawP.r || detectedRole;

      players.push({
        id: rawP.i || `player-${i + 1}`,
        name: rawP.n || `Player ${i + 1}`,
        role: finalRole,
        customRole: rawP.r || null,
        trait: rawP.tr || null,
        traitCustomText: typeof rawP.tct === 'string' ? rawP.tct : '',
        weaponMode: rawP.wm === 'passive' ? 'passive' : rawP.wm === 'active' ? 'active' : undefined,
        weapons,
        relics,
      });
    }

    return { mode, server, title, players };
  } catch (_) {
    return null;
  }
}
