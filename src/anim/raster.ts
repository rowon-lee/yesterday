/**
 * 픽셀 단위 그리기. 캔버스 선 그리기는 가장자리를 흐리게 섞으므로 쓰지 않고,
 * 부위마다 마스크(칠할 칸 표시)를 만든 뒤 색 번호를 직접 찍는다.
 */
/**
 * 그림이 보는 창: 예전에는 동작의 모든 프레임을 가로로 이은 긴 띠 한 장에 그렸다. 지금은 칸 하나만 들고 그리되,
 * 좌표는 그 띠 기준(ox = 이 칸이 띠에서 시작하는 x, stride = 띠 폭) 그대로 받아 반올림까지 예전과 똑같이 나오게 한다.
 * 창 밖에 찍는 점은 버린다 (예전에 옆 칸으로 번지던 그림: 그런 동작은 bake.ts가 예전 방식 그대로 띠에 다시 그린다).
 */
interface Window {
  readonly w: number;
  readonly h: number;
  /** 창 왼쪽 끝의 띠 좌표 */
  ox: number;
  /** 띠 폭 (소수 좌표의 칸 번호 계산에만 쓴다) */
  stride: number;
}

export class Mask implements Window {
  readonly a: Uint8Array;
  ox = 0;
  stride: number;
  /** 칠한 칸을 둘러싼 네모 (띠 좌표, 포함). 비어 있으면 x1 < x0. 칠하기·옮기기가 이 안만 훑는다 */
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  constructor(readonly w: number, readonly h: number) {
    this.a = new Uint8Array(w * h);
    this.stride = w;
  }
  set(x: number, y: number): void {
    if (Number.isInteger(x) && Number.isInteger(y)) {
      if (x >= this.ox && y >= 0 && x < this.ox + this.w && y < this.h) this.mark(x - this.ox, y);
      return;
    }
    // 소수 좌표 (반지름이 소수인 원의 줄): 예전 그대로 칸 번호(y × 띠 폭 + x)가 정수일 때만 그 번호의 칸에 찍힌다
    const W = this.stride;
    if (!(x >= 0 && y >= 0 && x < W && y < this.h)) return;
    const idx = y * W + x;
    if (!Number.isInteger(idx)) return;
    const tx = idx % W;
    // 다른 칸에 떨어지는 점: 예전에도 장식 자르기(clip)로 버려졌다 (소수 반지름 원은 장식만 쓴다)
    if (tx < this.ox || tx >= this.ox + this.w) return;
    this.mark(tx - this.ox, (idx - tx) / W);
  }
  private mark(lx: number, y: number): void {
    this.a[y * this.w + lx] = 1;
    const x = lx + this.ox;
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
  }
  get(x: number, y: number): boolean {
    const lx = x - this.ox;
    return lx >= 0 && y >= 0 && lx < this.w && y < this.h && this.a[y * this.w + lx] === 1;
  }
  get empty(): boolean {
    return this.x1 < this.x0;
  }
  /** 다시 쓰려고 비운다 (칠한 네모 안만) */
  clear(): void {
    if (!this.empty) {
      for (let y = this.y0; y <= this.y1; y++) this.a.fill(0, y * this.w + this.x0 - this.ox, y * this.w + this.x1 - this.ox + 1);
    }
    this.x0 = Infinity;
    this.y0 = Infinity;
    this.x1 = -Infinity;
    this.y1 = -Infinity;
  }
}

const maskPool = new Map<number, Mask[]>();
/** 이 그림과 같은 창의 빈 마스크 하나 (다 쓰면 giveMask로 돌려준다. 프레임마다 새로 만들지 않는다) */
export function takeMask(img: Window): Mask {
  const m = maskPool.get(img.w * 65536 + img.h)?.pop() ?? new Mask(img.w, img.h);
  m.ox = img.ox;
  m.stride = img.stride;
  return m;
}
export function giveMask(m: Mask): void {
  m.clear();
  const k = m.w * 65536 + m.h;
  let list = maskPool.get(k);
  if (!list) maskPool.set(k, (list = []));
  list.push(m);
}

/** 색 번호로 된 그림. 0은 투명. 좌표는 창(ox) 기준 띠 좌표 */
export class Indexed implements Window {
  readonly a: Uint8Array;
  ox = 0;
  stride: number;
  constructor(readonly w: number, readonly h: number) {
    this.a = new Uint8Array(w * h);
    this.stride = w;
  }
  set(x: number, y: number, c: number): void {
    const lx = x - this.ox;
    if (lx >= 0 && y >= 0 && lx < this.w && y < this.h) this.a[y * this.w + lx] = c;
  }
  get(x: number, y: number): number {
    const lx = x - this.ox;
    return lx >= 0 && y >= 0 && lx < this.w && y < this.h ? this.a[y * this.w + lx] : 0;
  }
}

const brushes = new Map<number, Array<[number, number]>>();
/** 지름 size인 둥근 붓 (모서리를 깎은 정사각형). 짝수면 중심에서 왼쪽·위로 한 칸 더 칠한다. */
function brush(size: number): Array<[number, number]> {
  let b = brushes.get(size);
  if (!b) {
    b = [];
    const c = size / 2;
    const off = Math.floor(size / 2);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 <= c * c || size <= 2) b.push([x - off, y - off]);
      }
    }
    brushes.set(size, b);
  }
  return b;
}

/** 굵기 size인 선 (브레젠험 + 둥근 붓) */
export function stampLine(m: Mask, ax: number, ay: number, bx: number, by: number, size: number): void {
  let x0 = Math.round(ax);
  let y0 = Math.round(ay);
  const x1 = Math.round(bx);
  const y1 = Math.round(by);
  const b = brush(size);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    for (const [ox, oy] of b) m.set(x0 + ox, y0 + oy);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** 반지름 r인 원 (지름 2r+1) */
export function stampDisc(m: Mask, cx: number, cy: number, r: number): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
    for (let x = -w; x <= w; x++) m.set(cx + x, cy + y);
  }
}

/** 칠할 색 번호: 바탕, 빛 받는 가장자리, 앞 부위가 뒤 부위를 가리는 경계선(0이면 긋지 않음) */
export interface Shade {
  base: number;
  light: number;
  inner: number;
}

/**
 * 마스크 한 덩어리를 그림에 찍는다. 빛이 오는 쪽(위·앞)이 비어 있는 칸은 밝게.
 * 이미 칠해진 부위 위에 겹치면 그 경계 1px에 inner 색을 긋는다 (바깥 윤곽선은 outlineSilhouette가 따로 두른다).
 */
export function paint(img: Indexed, m: Mask, s: Shade, lightDx: 1 | -1 = 1): void {
  if (m.empty) return;
  // 칠한 네모와 그 둘레 1칸 밖은 바뀌지 않는다 (마스크도, 맞닿은 마스크 칸도 없다). 창 밖은 버린다
  const y0 = Math.max(0, m.y0 - 1);
  const y1 = Math.min(m.h - 1, m.y1 + 1);
  const x0 = Math.max(img.ox, m.x0 - 1);
  const x1 = Math.min(img.ox + img.w - 1, m.x1 + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (m.get(x, y)) {
        const lit = !m.get(x, y - 1) || !m.get(x + lightDx, y);
        img.set(x, y, lit ? s.light : s.base);
      } else if (s.inner && img.get(x, y) && (m.get(x - 1, y) || m.get(x + 1, y) || m.get(x, y - 1) || m.get(x, y + 1))) {
        img.set(x, y, s.inner);
      }
    }
  }
}

/** 외곽선 처리에 돌려 쓰는 창 그림·칸 표시·스택 (그림마다 새로 만들지 않는다) */
let winBuf = new Uint8Array(0);
let outsideBuf = new Uint8Array(0);
let seenBuf = new Uint8Array(0);
let stackBuf = new Int32Array(0);
let ringBuf = new Int32Array(0);

/**
 * 칠해진 모양 전체의 바깥 둘레 1px(상하좌우로 맞닿은 빈 칸)에 외곽선.
 * 부위 사이에 갇힌 빈 칸(바깥과 이어지지 않은 구멍)은 외곽선 대신 옆 색으로 메운다. 바뀐 칸이 있으면 true.
 * 칠해진 칸을 둘러싼 네모(+1칸)만 따로 떼어 훑는다: 그 밖은 모두 빈 바깥이라 결과가 그림 전체를 훑을 때와 같다.
 */
export function outlineSilhouette(img: Indexed, outline: number, keepHoles = 0): boolean {
  const { w: W, h: H, a } = img;
  // 칠해진 칸의 네모
  let bx0 = W;
  let by0 = H;
  let bx1 = -1;
  let by1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let l = -1;
    let r = -1;
    for (let x = 0; x < W; x++) {
      if (a[row + x]) {
        if (l < 0) l = x;
        r = x;
      }
    }
    if (l < 0) continue;
    if (l < bx0) bx0 = l;
    if (r > bx1) bx1 = r;
    if (y < by0) by0 = y;
    by1 = y;
  }
  if (bx1 < 0) return false;
  // 창: 네모 둘레 1칸 (그림 밖으로는 나가지 않는다). 창 테두리는 빈 바깥이거나 그림 테두리라 바깥 퍼짐의 출발점이 같다
  const x0 = Math.max(0, bx0 - 1);
  const y0 = Math.max(0, by0 - 1);
  const x1 = Math.min(W - 1, bx1 + 1);
  const y1 = Math.min(H - 1, by1 + 1);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const n = w * h;
  if (winBuf.length < n) {
    winBuf = new Uint8Array(n);
    outsideBuf = new Uint8Array(n);
    seenBuf = new Uint8Array(n);
    ringBuf = new Int32Array(n);
  }
  if (stackBuf.length < n * 4 + w * 2 + h * 2) stackBuf = new Int32Array(n * 4 + w * 2 + h * 2);
  const b = winBuf;
  for (let y = 0; y < h; y++) b.set(a.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + w), y * w);
  const outside = outsideBuf;
  outside.fill(0, 0, n);
  const stack = stackBuf;
  let sp = 0;
  // 창 테두리에서 빈 칸을 따라 퍼져 나가 바깥 공간을 표시한다.
  for (let x = 0; x < w; x++) {
    stack[sp++] = x;
    stack[sp++] = (h - 1) * w + x;
  }
  for (let y = 0; y < h; y++) {
    stack[sp++] = y * w;
    stack[sp++] = y * w + w - 1;
  }
  const last = (h - 1) * w;
  while (sp > 0) {
    const i = stack[--sp]!;
    if (outside[i] || b[i] !== 0) continue;
    outside[i] = 1;
    const x = i % w;
    if (x > 0) stack[sp++] = i - 1;
    if (x < w - 1) stack[sp++] = i + 1;
    if (i >= w) stack[sp++] = i - w;
    if (i < last) stack[sp++] = i + w;
  }
  // keepHoles > 0: 이보다 큰 구멍(휘는 리본이 몸·다리와 만든 고리 등)은 메우지 않고 바깥처럼 둔다 (안쪽 둘레에 외곽선이 생긴다)
  if (keepHoles > 0) {
    const seen = seenBuf;
    seen.fill(0, 0, n);
    const comp = ringBuf;
    for (let i = 0; i < n; i++) {
      if (b[i] !== 0 || outside[i] || seen[i]) continue;
      let cn = 0;
      sp = 0;
      stack[sp++] = i;
      seen[i] = 1;
      while (sp > 0) {
        const k = stack[--sp]!;
        comp[cn++] = k;
        const x = k % w;
        if (x > 0) {
          const q = k - 1;
          if (!seen[q] && !outside[q] && b[q] === 0) (seen[q] = 1), (stack[sp++] = q);
        }
        if (x < w - 1) {
          const q = k + 1;
          if (!seen[q] && !outside[q] && b[q] === 0) (seen[q] = 1), (stack[sp++] = q);
        }
        if (k >= w) {
          const q = k - w;
          if (!seen[q] && !outside[q] && b[q] === 0) (seen[q] = 1), (stack[sp++] = q);
        }
        if (k < last) {
          const q = k + w;
          if (!seen[q] && !outside[q] && b[q] === 0) (seen[q] = 1), (stack[sp++] = q);
        }
      }
      if (cn > keepHoles) for (let j = 0; j < cn; j++) outside[comp[j]!] = 1;
    }
  }
  // 갇힌 빈 칸: 옆 색으로 메운다 (한 번 훑기, 앞에서 메운 칸을 옆 칸이 이어받는다). 갇힌 칸은 창 테두리에 없어 이웃이 모두 창 안이다
  let changed = false;
  for (let i = 0; i < n; i++) {
    if (outside[i] || b[i] !== 0) continue;
    const v = b[i - 1]! || b[i + 1]! || b[i - w]! || b[i + w]!;
    b[i] = v;
    if (v) changed = true;
  }
  // 바깥 둘레: 칠해진 칸(외곽선 색 말고)에 맞닿은 빈 칸 (창 밖은 비어 있다)
  const filled = (v: number) => v !== 0 && v !== outline;
  let rn = 0;
  const ring = ringBuf;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (b[i] !== 0) continue;
      if ((x > 0 && filled(b[i - 1]!)) || (x < w - 1 && filled(b[i + 1]!)) || (y > 0 && filled(b[i - w]!)) || (y < h - 1 && filled(b[i + w]!))) ring[rn++] = i;
    }
  }
  for (let j = 0; j < rn; j++) b[ring[j]!] = outline;
  if (changed || rn > 0) for (let y = 0; y < h; y++) a.set(b.subarray(y * w, (y + 1) * w), (y0 + y) * W + x0);
  return changed || rn > 0;
}
