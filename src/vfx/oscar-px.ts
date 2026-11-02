// YESTERDAY: 오스카 이펙트가 같이 쓰는 점 찍기 도구 (렌더 전용). 좌표는 화면 px가 아니라 월드 px (부르는 쪽이 2단위를 나눠 넘긴다).
// Frame의 ox·oy(카메라 왼쪽 위 월드 좌표)를 빼서 화면 칸에 찍는다. 색은 0xAABBGGRR.
import type { Frame } from './impact';

/** 한 칸 칠하기 */
export function put(f: Frame, x: number, y: number, c: number): void {
  x = Math.round(x - f.ox);
  y = Math.round(y - f.oy);
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
  const b = f.box;
  if (b) {
    if (x < b[0]!) b[0] = x;
    if (y < b[1]!) b[1] = y;
    if (x > b[2]!) b[2] = x;
    if (y > b[3]!) b[3] = y;
  }
  f.color[y * f.w + x] = c >>> 0;
}

/** 빛 더하기 (k: 0~1) */
export function glow(f: Frame, x: number, y: number, c: number, k: number): void {
  x = Math.round(x - f.ox);
  y = Math.round(y - f.oy);
  if (x < 0 || y < 0 || x >= f.w || y >= f.h || k <= 0) return;
  const b = f.box;
  if (b) {
    if (x < b[0]!) b[0] = x;
    if (y < b[1]!) b[1] = y;
    if (x > b[2]!) b[2] = x;
    if (y > b[3]!) b[3] = y;
  }
  const i = y * f.w + x;
  const d = f.light[i]!;
  const r = Math.min(255, (d & 255) + (c & 255) * k);
  const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
  const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
  f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
}

/** 1px 계단 선 (a → b). t0~t1: 선의 이 구간만 (0~1) */
export function line(f: Frame, ax: number, ay: number, bx: number, by: number, c: number, t0 = 0, t1 = 1): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  const s0 = Math.round(n * t0);
  const s1 = Math.round(n * t1);
  for (let s = s0; s <= s1; s++) put(f, ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, c);
}

/** 선을 따라 양옆으로 빛 (반지름 r px) */
export function glowLine(f: Frame, ax: number, ay: number, bx: number, by: number, c: number, k: number, r = 3): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / 2));
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  for (let s = 0; s <= n; s++) {
    const x = ax + ((bx - ax) * s) / n;
    const y = ay + ((by - ay) * s) / n;
    for (let q = -r; q <= r; q++) glow(f, x + nx * q, y + ny * q, c, k * (1 - Math.abs(q) / (r + 1)));
  }
}

/** 시드 난수 (렌더 전용) */
export function rng(seed: number): () => number {
  let r = (seed * 7919 + 104729) & 0x7fffffff;
  return () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
}
