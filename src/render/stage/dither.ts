/**
 * 픽셀 그리기 도구. 반투명 대신 4×4 바이어 디더링으로 농도를 낸다 (흐림 금지).
 */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** 0~16 농도에서 이 칸을 칠하는가 */
export const dither = (x: number, y: number, level: number): boolean => BAYER[y & 3][x & 3] < level;

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 사각형을 농도 level(0~16)로 디더링해서 칠한다. ox, oy는 무늬 기준 (겹 좌표를 넘겨 무늬가 겹과 같이 움직이게) */
export function ditherRect(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, level: number, ox = 0, oy = 0,
): void {
  g.fillStyle = color;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) if (dither(x + i + ox, y + j + oy, level)) g.fillRect(x + i, y + j, 1, 1);
  }
}

/** 원. level을 주면 디더링 */
export function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, level = 16, ox = 0): void {
  g.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  const rr = Math.max(0, Math.round(r));
  for (let y = -rr; y <= rr; y++) {
    const w = Math.floor(Math.sqrt(rr * rr - y * y) + 0.5);
    for (let x = -w; x <= w; x++) if (level >= 16 || dither(cx + x + ox, cy + y, level)) g.fillRect(cx + x, cy + y, 1, 1);
  }
}

/** 1px 선 (브레젠험) */
export function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string): void {
  g.fillStyle = color;
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
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

/** 렌더 전용 고정 난수 (모양만 정한다. sim과 무관) */
export function hash(n: number): number {
  n = (n ^ 61) ^ (n >>> 16);
  n = Math.imul(n, 9);
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}
