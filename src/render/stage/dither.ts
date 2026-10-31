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
  // 넓은 사각형은 픽셀 버퍼로 한 번에 (putImageData는 클립을 무시하므로 사각형이 그릴 자리 안에 있을 때만 쓴다)
  if (w * h > 4000 && x >= 0 && y >= 0 && x + w <= g.canvas.width && y + h <= g.canvas.height) {
    paint(g, x, y, w, h, (px, py) => (dither(px + ox, py + oy, level) ? color : null));
    return;
  }
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

/**
 * 겹 하나를 매연 색으로 디더링해 덮는다: 칠해진 칸 중 level/16만큼을 color로 바꾼다 (멀수록 흐리고 색이 빠지게).
 * 흐림(블러) 대신 쓰는 방법이라 팔레트 밖 색이 생기지 않는다.
 */
export function haze(c: HTMLCanvasElement, color: string, level: number): void {
  if (level <= 0) return;
  const g = c.getContext('2d')!;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const n = parseInt(color.slice(1), 16);
  const cr = n >> 16;
  const cg = (n >> 8) & 255;
  const cb = n & 255;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i + 3] === 0 || !dither(x, y, level)) continue;
      d[i] = cr;
      d[i + 1] = cg;
      d[i + 2] = cb;
    }
  }
  g.putImageData(img, 0, 0);
}

/**
 * 그늘: 사각형 안의 색을 팔레트에서 한 단계 어두운 색으로 바꾼다 (map: 원래 색 → 어두운 색, '#rrggbb').
 * level을 주면 그 농도(0~16)만큼만 디더링으로 바꾼다.
 */
export function shade(c: HTMLCanvasElement, x: number, y: number, w: number, h: number, map: Record<string, string>, level = 16): void {
  const g = c.getContext('2d')!;
  x = Math.max(0, Math.round(x));
  y = Math.max(0, Math.round(y));
  w = Math.min(c.width - x, Math.round(w));
  h = Math.min(c.height - y, Math.round(h));
  if (w <= 0 || h <= 0) return;
  const img = g.getImageData(x, y, w, h);
  const d = img.data;
  const table = new Map<number, number[]>();
  for (const [from, to] of Object.entries(map)) {
    const a = parseInt(from.slice(1), 16);
    const b = parseInt(to.slice(1), 16);
    table.set(a, [b >> 16, (b >> 8) & 255, b & 255]);
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = (j * w + i) * 4;
      if (d[p + 3] === 0 || (level < 16 && !dither(x + i, y + j, level))) continue;
      const to = table.get((d[p] << 16) | (d[p + 1] << 8) | d[p + 2]);
      if (!to) continue;
      d[p] = to[0];
      d[p + 1] = to[1];
      d[p + 2] = to[2];
    }
  }
  g.putImageData(img, x, y);
}

/**
 * 사각형 안을 한 칸씩 칠한다: fn이 돌려준 색('#rrggbb')으로, null이면 그대로 둔다.
 * fillRect를 칸마다 부르는 것보다 훨씬 빠르다 (처음 무대를 그릴 때 쓴다).
 */
export function paint(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fn: (x: number, y: number) => string | null): void {
  x = Math.round(x);
  y = Math.round(y);
  if (w <= 0 || h <= 0) return;
  const img = g.getImageData(x, y, w, h);
  const d = img.data;
  const cache = new Map<string, number>();
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const col = fn(x + i, y + j);
      if (col === null) continue;
      let n = cache.get(col);
      if (n === undefined) {
        n = parseInt(col.slice(1), 16);
        cache.set(col, n);
      }
      const p = (j * w + i) * 4;
      d[p] = n >> 16;
      d[p + 1] = (n >> 8) & 255;
      d[p + 2] = n & 255;
      d[p + 3] = 255;
    }
  }
  g.putImageData(img, x, y);
}
