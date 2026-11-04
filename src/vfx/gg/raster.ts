// YESTERDAY 길티기어식 이펙트 (동작연출지침서 14-8) — 칸 칠하기 (렌더 전용).
// 흐림·디더 없이 딱딱한 경계. 칠한 칸은 애니 이펙트 칸(mark)으로 적어 후처리가 색 보정 없이 그린 색 그대로 보여 주고 이펙트 빛 번짐을 건다.
import type { Frame, Layer } from '../impact';

export type { Layer };

/** 이펙트가 그리는 화면 (render/vfx VfxLayer가 넘긴다). mark가 있으면 칠한 칸에 1 */
export type GFrame = Frame & { mark?: Uint8Array };

/** 화면 칸 번호 (월드 px → 칸). 화면 밖이면 −1. 칠한 사각형(box)을 넓힌다 */
export function cell(f: GFrame, x: number, y: number): number {
  const X = Math.round(x) - f.ox;
  const Y = Math.round(y) - f.oy;
  if (X < 0 || Y < 0 || X >= f.w || Y >= f.h) return -1;
  const b = f.box;
  if (b) {
    if (X < b[0]!) b[0] = X;
    if (Y < b[1]!) b[1] = Y;
    if (X > b[2]!) b[2] = X;
    if (Y > b[3]!) b[3] = Y;
  }
  return Y * f.w + X;
}

/** 한 칸 칠하기 (불투명, 이펙트 칸 표시) */
export function put(f: GFrame, x: number, y: number, c: number): void {
  const i = cell(f, x, y);
  if (i < 0) return;
  f.color[i] = c >>> 0;
  if (f.mark) f.mark[i] = 1;
}

/**
 * 다각형 고리들의 칠할 구간 [y, x0, x1]… (짝홀 규칙: 고리 안의 고리는 구멍, 칸 가운데가 안에 들면 칠한다).
 * 고리마다 평평한 x, y 목록 (월드 px). clip이 있으면 그 안만 (화면 밖은 계산하지 않는다)
 */
export function polySpans(rings: ReadonlyArray<ArrayLike<number>>, clip?: { x0: number; y0: number; x1: number; y1: number }): number[] {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const r of rings) {
    for (let i = 1; i < r.length; i += 2) {
      if (r[i]! < y0) y0 = r[i]!;
      if (r[i]! > y1) y1 = r[i]!;
    }
  }
  const out: number[] = [];
  if (!(y1 > y0)) return out;
  let ys = Math.ceil(y0 - 0.5);
  let ye = Math.floor(y1 - 0.5);
  if (clip) {
    ys = Math.max(ys, clip.y0);
    ye = Math.min(ye, clip.y1);
  }
  const xs: number[] = [];
  for (let y = ys; y <= ye; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (const r of rings) {
      const n = r.length >> 1;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = r[i * 2 + 1]!;
        const yj = r[j * 2 + 1]!;
        if (yi > cy !== yj > cy) {
          const xi = r[i * 2]!;
          const xj = r[j * 2]!;
          xs.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let xa = Math.ceil(xs[k]! - 0.5);
      let xb = Math.floor(xs[k + 1]! - 0.5);
      if (clip) {
        xa = Math.max(xa, clip.x0);
        xb = Math.min(xb, clip.x1);
      }
      if (xb >= xa) out.push(y, xa, xb);
    }
  }
  return out;
}

/** 다각형 고리들을 한 색으로 칠한다 (화면 밖은 건너뛴다) */
export function fillRings(f: GFrame, rings: ReadonlyArray<ArrayLike<number>>, c: number): void {
  const s = polySpans(rings, { x0: f.ox - 1, y0: f.oy - 1, x1: f.ox + f.w, y1: f.oy + f.h });
  for (let i = 0; i < s.length; i += 3) {
    const y = s[i]!;
    for (let x = s[i + 1]!; x <= s[i + 2]!; x++) put(f, x, y, c);
  }
}

/** 시드 난수 (불씨 자리·속도만: 같은 시드면 같은 그림) */
export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
