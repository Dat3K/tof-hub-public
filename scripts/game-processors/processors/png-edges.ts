import fs from 'node:fs';
import zlib from 'node:zlib';

/**
 * Share of each canvas edge covered by visible pixels (alpha > 24) in an 8-bit non-interlaced
 * RGBA PNG. Content touching an edge means the texture itself is cut off there. Returns null for
 * other PNG layouts, where no alpha edge can be measured.
 */
export function pngEdgeCoverage(file: string) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('latin1', 1, 4) !== 'PNG') return null;
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const data: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      bitDepth = chunk[8]; colorType = chunk[9]; interlace = chunk[12];
    } else if (type === 'IDAT') data.push(chunk);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0 || !width || !height) return null;
  const raw = zlib.inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      const predictor = filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1
        : filter === 4 ? paeth(left, up, upLeft) : 0;
      pixels[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  const visible = (x: number, y: number) => pixels[y * stride + x * 4 + 3] > 24;
  const share = (count: number, test: (index: number) => boolean) => {
    let hits = 0;
    for (let index = 0; index < count; index++) if (test(index)) hits++;
    return hits / count;
  };
  return {width, height, edges: {
    top: share(width, x => visible(x, 0)), bottom: share(width, x => visible(x, height - 1)),
    left: share(height, y => visible(0, y)), right: share(height, y => visible(width - 1, y)),
  }};
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const [a, b, c] = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upLeft)];
  return a <= b && a <= c ? left : b <= c ? up : upLeft;
}
