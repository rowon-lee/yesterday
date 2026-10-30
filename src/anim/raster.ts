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

/** 칠할 색 번호: 외곽선, 바탕, 빛 받는 가장자리 */
export interface Shade {
  outline: number;
  base: number;
  light: number;
}

/**
 * 마스크 한 덩어리를 그림에 찍는다.
 * 둘레 1px(상하좌우로 맞닿은 칸)은 외곽선, 빛이 오는 쪽(위·앞)이 비어 있는 칸은 밝게.
 * 앞쪽 덩어리의 외곽선이 뒤쪽 덩어리를 덮으므로 겹친 부위가 구분된다.
 */
export function paint(img: Indexed, m: Mask, s: Shade, lightDx: 1 | -1 = 1): void {
  const { w, h } = m;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m.get(x, y)) {
        const lit = !m.get(x, y - 1) || !m.get(x + lightDx, y);
        img.set(x, y, lit ? s.light : s.base);
      } else if (m.get(x - 1, y) || m.get(x + 1, y) || m.get(x, y - 1) || m.get(x, y + 1)) {
        img.set(x, y, s.outline);
      }
    }
  }
}
