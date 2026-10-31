/**
 * 픽셀 단위 그리기. 캔버스 선 그리기는 가장자리를 흐리게 섞으므로 쓰지 않고,
 * 부위마다 마스크(칠할 칸 표시)를 만든 뒤 색 번호를 직접 찍는다.
 */
export class Mask {
  readonly a: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.a = new Uint8Array(w * h);
  }
  set(x: number, y: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = 1;
  }
  get(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.a[y * this.w + x] === 1;
  }
}

/** 색 번호로 된 그림. 0은 투명. */
export class Indexed {
  readonly a: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.a = new Uint8Array(w * h);
  }
  set(x: number, y: number, c: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.a[y * this.w + x] : 0;
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
  const { w, h } = m;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m.get(x, y)) {
        const lit = !m.get(x, y - 1) || !m.get(x + lightDx, y);
        img.set(x, y, lit ? s.light : s.base);
      } else if (s.inner && img.get(x, y) && (m.get(x - 1, y) || m.get(x + 1, y) || m.get(x, y - 1) || m.get(x, y + 1))) {
        img.set(x, y, s.inner);
      }
    }
  }
}

/**
 * 칠해진 모양 전체의 바깥 둘레 1px(상하좌우로 맞닿은 빈 칸)에 외곽선.
 * 부위 사이에 갇힌 빈 칸(바깥과 이어지지 않은 구멍)은 외곽선 대신 옆 색으로 메운다.
 */
export function outlineSilhouette(img: Indexed, outline: number): void {
  const { w, h } = img;
  // 그림 테두리에서 빈 칸을 따라 퍼져 나가 바깥 공간을 표시한다.
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (outside[i] || img.a[i] !== 0) continue;
    outside[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < (h - 1) * w) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (img.a[i] !== 0 || outside[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    img.a[i] = img.get(x - 1, y) || img.get(x + 1, y) || img.get(x, y - 1) || img.get(x, y + 1);
  }

  const filled = (x: number, y: number) => img.get(x, y) !== 0 && img.get(x, y) !== outline;
  const ring: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (img.get(x, y) === 0 && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) {
        ring.push(y * w + x);
      }
    }
  }
  for (const i of ring) img.a[i] = outline;
}
