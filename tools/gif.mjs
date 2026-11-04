// 아주 작은 GIF89a 인코더 (색 번호 그림 → 움직이는 GIF). 의존성 없이 확인 도구에서만 쓴다.

/**
 * frames: [{ data: Uint8Array(색 번호), colors: number[] }], 모든 프레임이 같은 팔레트를 쓰도록 미리 맞춰 둔다.
 * delayCs: 프레임 사이 시간(1/100초). 숫자 하나면 모든 프레임이 같고, 배열이면 프레임마다
 */
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
  frames.forEach((f, idx) => {
    const delay = Array.isArray(delayCs) ? delayCs[idx] : delayCs;
    byte(0x21); byte(0xf9); byte(4); byte(0); word(delay); byte(0); byte(0);
    byte(0x2c); word(0); word(0); word(w); word(h); byte(0);
    byte(bits);
    const lzw = lzwEncode(f, bits);
    for (let i = 0; i < lzw.length; i += 255) {
      const n = Math.min(255, lzw.length - i);
      byte(n);
      for (let k = 0; k < n; k++) out.push(lzw[i + k]);
    }
    byte(0);
  });
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

/**
 * 바뀐 칸만 담는 GIF (용량 줄이기): 첫 프레임은 통째로, 그 뒤 프레임은 앞 프레임과 다른 칸을 감싼 사각형만 담고
 * 사각형 안에서 앞과 같은 칸은 투명(255번)으로 둔다 (지우지 않고 겹쳐 그린다). palette는 255색 이하.
 * frames: 화면 크기 색 번호 배열들, delayCs: 숫자 하나 또는 프레임마다
 */
export function encodeGifDelta(w, h, palette, frames, delayCs) {
  if (palette.length > 255) throw new Error('encodeGifDelta: 255색 이하만');
  const out = [];
  const byte = (b) => out.push(b & 255);
  const word = (v) => { byte(v); byte(v >> 8); };
  const str = (s) => { for (const ch of s) byte(ch.charCodeAt(0)); };
  const bits = 8;
  const TRANSPARENT = 255;
  str('GIF89a');
  word(w);
  word(h);
  byte(0xf0 | (bits - 1));
  byte(0);
  byte(0);
  for (let i = 0; i < 256; i++) {
    const c = palette[i] ?? 0;
    byte(c >> 16);
    byte(c >> 8);
    byte(c);
  }
  byte(0x21); byte(0xff); byte(11); str('NETSCAPE2.0'); byte(3); byte(1); word(0); byte(0);
  let prev = null;
  frames.forEach((f, idx) => {
    const delay = Array.isArray(delayCs) ? delayCs[idx] : delayCs;
    let x0 = 0;
    let y0 = 0;
    let x1 = w - 1;
    let y1 = h - 1;
    if (prev) {
      x0 = w; y0 = h; x1 = -1; y1 = -1;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          if (f[row + x] !== prev[row + x]) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            y1 = y;
          }
        }
      }
      // 바뀐 칸이 없으면 투명한 1칸만 (시간만 흐르게)
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const sub = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = (y0 + y) * w + x0 + x;
        sub[y * bw + x] = prev && f[i] === prev[i] ? TRANSPARENT : f[i];
      }
    }
    // 그래픽 제어: 지우지 않음(1) + 투명색 쓰기 (첫 프레임은 투명 없음)
    byte(0x21); byte(0xf9); byte(4); byte((1 << 2) | (prev ? 1 : 0)); word(delay); byte(TRANSPARENT); byte(0);
    byte(0x2c); word(x0); word(y0); word(bw); word(bh); byte(0);
    byte(bits);
    const lzw = lzwEncode(sub, bits);
    for (let i = 0; i < lzw.length; i += 255) {
      const n = Math.min(255, lzw.length - i);
      byte(n);
      for (let k = 0; k < n; k++) out.push(lzw[i + k]);
    }
    byte(0);
    prev = f;
  });
  byte(0x3b);
  return Uint8Array.from(out);
}
