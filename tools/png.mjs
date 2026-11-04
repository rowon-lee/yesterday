// 아주 작은 PNG 저장기 (RGB 8비트, 필터 없음). 확인용 연속 캡처 시트에 쓴다 (2026-11-03).
import { deflateSync, inflateSync } from 'node:zlib';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
/** rgb: Uint8Array(w*h*3) → PNG Buffer */
export function encodePng(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * PNG 읽기 (8비트, 비월 없음: 흑백·RGB·팔레트·흑백+알파·RGBA) → { w, h, d: Uint8Array(w*h*3) RGB }.
 * 투명한 칸은 검정 위에 섞는다. 레퍼런스·목업 그림을 읽는 데 쓴다
 */
export function decodePng(buf) {
  let p = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  let depth = 8;
  let interlace = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      ct = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`PNG: 8비트 비월 없음만 읽는다 (depth ${depth}, interlace ${interlace})`);
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(w * h * 3);
  const stride = w * bpp;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      let r;
      let g;
      let bl;
      let al = 255;
      if (ct === 0 || ct === 4) {
        r = g = bl = line[x * bpp];
        if (ct === 4) al = line[x * bpp + 1];
      } else if (ct === 3) {
        const k = line[x];
        r = plte[k * 3];
        g = plte[k * 3 + 1];
        bl = plte[k * 3 + 2];
        if (trns && k < trns.length) al = trns[k];
      } else {
        r = line[x * bpp];
        g = line[x * bpp + 1];
        bl = line[x * bpp + 2];
        if (ct === 6) al = line[x * bpp + 3];
      }
      const o = (y * w + x) * 3;
      out[o] = (r * al) / 255;
      out[o + 1] = (g * al) / 255;
      out[o + 2] = (bl * al) / 255;
    }
    prev = line;
  }
  return { w, h, d: out };
}
