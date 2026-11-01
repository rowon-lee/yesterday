import { COLORS, RAMPS } from './palette';

/**
 * 픽셀 그리기 도구. 흐림 없이 칠한다. 바이어 디더링은 두 색이 만나는 경계에만 쓴다 (넓은 면 바둑판 금지, 맵 아트 지침서).
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

/** 팔레트 (COLORS + RAMPS, 후처리 팔레트와 같은 목록) */
const PAL: ReadonlyArray<readonly [number, number, number]> = [...new Set([...Object.values(COLORS), ...RAMPS])].map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255] as const;
});
/** 가장 가까운 팔레트 색 (0xrrggbb). 후처리 팔레트와 같은 가중치 */
export function nearestPalette(r: number, g: number, b: number): number {
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < PAL.length; k++) {
    const p = PAL[k];
    const d = 3 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 2 * (p[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  const p = PAL[best];
  return (p[0] << 16) | (p[1] << 8) | p[2];
}

/**
 * 사각형을 농도 level(0~16)만큼 color로 물들인다. 넓은 면을 바둑판 점무늬로 칠하지 않는다:
 * 칸마다 원래 색과 color를 level/16만큼 섞어 가장 가까운 팔레트 색으로 칠하고 (넓은 면은 단색),
 * 사각형 안쪽 가장자리 한 줄만 바이어 무늬로 반씩 섞어 두 색이 만나는 경계만 부드럽게 한다.
 * 투명한 칸은 그대로 둔다. ox, oy는 가장자리 무늬 기준 (겹 좌표를 넘겨 무늬가 겹과 같이 움직이게). 캔버스는 평행 이동만 따른다.
 */
export function ditherRect(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, level: number, ox = 0, oy = 0,
): void {
  if (level <= 0 || w <= 0 || h <= 0) return;
  if (level >= 16) {
    rect(g, x, y, w, h, color);
    return;
  }
  const t = g.getTransform();
  const X0 = Math.round(x + t.e);
  const Y0 = Math.round(y + t.f);
  const X1 = X0 + Math.round(w);
  const Y1 = Y0 + Math.round(h);
  const W = g.canvas.width;
  const H = g.canvas.height;
  const ax = Math.max(0, X0);
  const ay = Math.max(0, Y0);
  const bx = Math.min(W, X1);
  const by = Math.min(H, Y1);
  if (bx <= ax || by <= ay) return;
  const img = g.getImageData(ax, ay, bx - ax, by - ay);
  const d = img.data;
  const n = parseInt(color.slice(1), 16);
  const cr = n >> 16;
  const cg = (n >> 8) & 255;
  const cb = n & 255;
  const k = level / 16;
  const cache = new Map<number, number>();
  const iw = bx - ax;
  for (let j = 0; j < by - ay; j++) {
    const py = ay + j;
    const edgeY = (py === Y0 && Y0 > 0) || (py === Y1 - 1 && Y1 < H);
    for (let i = 0; i < iw; i++) {
      const p = (j * iw + i) * 4;
      if (d[p + 3] === 0) continue;
      const px = ax + i;
      const edge = edgeY || (px === X0 && X0 > 0) || (px === X1 - 1 && X1 < W);
      if (edge && !dither(px + ox, py + oy, 8)) continue;
      const src = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2];
      let out = cache.get(src);
      if (out === undefined) {
        out = nearestPalette(d[p] + (cr - d[p]) * k, d[p + 1] + (cg - d[p + 1]) * k, d[p + 2] + (cb - d[p + 2]) * k);
        // 섞어도 같은 팔레트 색이면 원래 색 그대로 (팔레트 밖 색으로 그린 바탕이 사각형 모양으로 바뀌지 않게)
        if (out === nearestPalette(d[p], d[p + 1], d[p + 2])) out = src;
        cache.set(src, out);
      }
      d[p] = out >> 16;
      d[p + 1] = (out >> 8) & 255;
      d[p + 2] = out & 255;
    }
  }
  g.putImageData(img, ax, ay);
}

/** 원. level을 주면 디더링 (꽉 찬 원은 줄마다 한 번에 칠한다) */
export function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, level = 16, ox = 0): void {
  g.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  const rr = Math.max(0, Math.round(r));
  for (let y = -rr; y <= rr; y++) {
    const w = Math.floor(Math.sqrt(rr * rr - y * y) + 0.5);
    if (level >= 16) {
      g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
      continue;
    }
    for (let x = -w; x <= w; x++) if (dither(cx + x + ox, cy + y, level)) g.fillRect(cx + x, cy + y, 1, 1);
  }
}

const discCache = new Map<string, HTMLCanvasElement>();

/**
 * 매 프레임 움직이는 연기·증기 뭉치용 디더링 원: 반지름·농도·색마다 한 번 그려 두고 이미지로 얹는다.
 * 무늬가 원과 함께 움직인다 (겹 좌표에 고정되지 않음). 매 프레임 점을 하나씩 찍는 것보다 훨씬 빠르다.
 */
export function discFast(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, level = 16): void {
  const rr = Math.max(1, Math.round(r));
  const lv = Math.max(0, Math.min(16, Math.round(level)));
  if (lv <= 0) return;
  const key = `${rr}|${lv}|${color}`;
  let c = discCache.get(key);
  if (!c) {
    [c] = canvas(rr * 2 + 1, rr * 2 + 1);
    disc(c.getContext('2d')!, rr, rr, rr, color, lv);
    discCache.set(key, c);
  }
  g.drawImage(c, Math.round(cx) - rr, Math.round(cy) - rr);
}

const spriteCache = new Map<string, { c: HTMLCanvasElement; x: number; y: number }>();

/**
 * 모습이 같으면 다시 그리지 않는 그림 조각: (x, y, w, h) 자리(월드나 겹 좌표)에 draw가 그리는 그림을 key마다 한 번만 그려 두고 얹는다.
 * draw는 같은 좌표계로 그대로 그리면 된다 (조각 캔버스가 그 자리로 옮겨져 있다).
 */
export function sprite(g: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, draw: (sg: CanvasRenderingContext2D) => void): void {
  let s = spriteCache.get(key);
  if (!s) {
    const [c, sg] = canvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    sg.translate(-Math.floor(x), -Math.floor(y));
    draw(sg);
    s = { c, x: Math.floor(x), y: Math.floor(y) };
    spriteCache.set(key, s);
    if (spriteCache.size > 600) spriteCache.delete(spriteCache.keys().next().value!);
  }
  g.drawImage(s.c, s.x, s.y);
}

const stampCache = new Map<string, HTMLCanvasElement>();

/**
 * 움직이는 그림 조각 (행인·물기둥처럼 자리만 바뀌는 것): key마다 w×h 캔버스에 한 번 그려 두고 (x, y)에 얹는다.
 * draw는 기준점 (ax, ay)를 원점으로 그린다. 놓을 때는 기준점이 (x, y)에 온다.
 */
export function stamp(
  g: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, ax: number, ay: number,
  draw: (sg: CanvasRenderingContext2D) => void,
): void {
  let c = stampCache.get(key);
  if (!c) {
    let sg: CanvasRenderingContext2D;
    [c, sg] = canvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    sg.translate(ax, ay);
    draw(sg);
    stampCache.set(key, c);
    if (stampCache.size > 400) stampCache.delete(stampCache.keys().next().value!);
  }
  g.drawImage(c, Math.round(x) - ax, Math.round(y) - ay);
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

/** 한 가지 색으로 칠한 4×4 그림 (발광 유리·렌즈처럼 무늬 없는 면) */
export function solidTex(color: string): HTMLCanvasElement {
  const [c, g] = canvas(4, 4);
  rect(g, 0, 0, 4, 4, color);
  return c;
}
