// 아주 작은 GIF89a 인코더 (색 번호 그림 → 움직이는 GIF). 의존성 없이 확인 도구에서만 쓴다.

/** frames: [{ data: Uint8Array(색 번호), colors: number[] }], 모든 프레임이 같은 팔레트를 쓰도록 미리 맞춰 둔다 */
export function encodeGif(w, h, palette, frames, delayCs) {
  const out = [];
  const byte = (b) => out.push(b & 255);
  const word = (v) => { byte(v); byte(v >> 8); };
  const str = (s) => { for (const ch of s) byte(ch.charCodeAt(0)); };
  let bits = 1;
  while (1 << bits < palette.length) bits++;
  bits = Math.max(2, bits);
  const size = 1 << bits;
  str('GIF89a');
  word(w);
  word(h);
  byte(0xf0 | (bits - 1));
  byte(0);
  byte(0);
  for (let i = 0; i < size; i++) {
    const c = palette[i] ?? 0;
    byte(c >> 16);
    byte(c >> 8);
    byte(c);
  }
  // 무한 반복
  byte(0x21); byte(0xff); byte(11); str('NETSCAPE2.0'); byte(3); byte(1); word(0); byte(0);
  for (const f of frames) {
    byte(0x21); byte(0xf9); byte(4); byte(0); word(delayCs); byte(0); byte(0);
    byte(0x2c); word(0); word(0); word(w); word(h); byte(0);
    byte(bits);
    const lzw = lzwEncode(f, bits);
    for (let i = 0; i < lzw.length; i += 255) {
      const n = Math.min(255, lzw.length - i);
      byte(n);
      for (let k = 0; k < n; k++) out.push(lzw[i + k]);
    }
    byte(0);
  }
  byte(0x3b);
  return Uint8Array.from(out);
}

function lzwEncode(data, minBits) {
  const clear = 1 << minBits;
  const eoi = clear + 1;
  const out = [];
  let cur = 0;
  let curBits = 0;
  let codeSize = minBits + 1;
  const emit = (code) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      out.push(cur & 255);
      cur >>>= 8;
      curBits -= 8;
    }
  };
  let dict = new Map();
  let next = eoi + 1;
  const reset = () => {
    dict = new Map();
    next = eoi + 1;
    codeSize = minBits + 1;
  };
  emit(clear);
  let prefix = data[0];
  for (let i = 1; i < data.length; i++) {
    const k = data[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      reset();
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (curBits > 0) out.push(cur & 255);
  return out;
}
