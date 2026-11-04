// YESTERDAY: 애니 격투 게임 이펙트 공용 부품 (동작연출지침서 14장, 렌더 전용).
// 일곱 부품 — 꽉 찬 면(sweep) · 4색 띠(bands) · 찢어진 꼬리(tear) · 속도선(speedlines) · 가시 파편(spikes) · 배경 누르기(press) · 잔불(embers).
// 캐릭터는 색표(Ramp4)와 모양값만 넘긴다. 크기·시간·개수는 등급(14-3)이 정한다.
// 좌표는 월드 px (x는 맵, y는 화면 아래로 +). 이 화면은 480×270이라 지침서의 320×180 기준 크기에 1.5를 곱한다.
import type { Frame, Layer } from '../impact';

export type { Layer };

/**
 * 애니 이펙트가 그리는 화면. mark가 있으면 칠한 칸에 1을 적는다:
 * 후처리가 그 칸은 색 보정 없이 그린 색 그대로 보여 주고(고채도 4색 띠를 지킨다) 이펙트 빛 번짐을 강하게 건다 (14-5)
 */
export type AFrame = Frame & { mark?: Uint8Array };

/** 4색 띠 (안 → 밖, 경계는 딱딱하게): 흰 심 → 밝은 주색 → 진한 주색 → 보색 테두리(소량). 색은 0xAABBGGRR (render/vfx fxColor) */
export interface Ramp4 {
  core: number;
  main: number;
  deep: number;
  rim: number;
}

/** 이펙트 등급 (14-3): 일반(기본 1~3타·공중 1~2타) · 강(4타·띄우기·내려찍기·대시 공격·공중 3타·차지) · 기술 · 필살기 */
export type Grade = 'normal' | 'strong' | 'skill' | 'super';

/** 이 화면 px / 지침서 기준(320×180) px */
export const SCALE = 1.5;

/**
 * 14-2 시간표 (틱, 타격 = 0): 0틱에 가장 크고 밝게 바로 나타나 hold틱까지 그대로,
 * tear틱까지 꼬리부터 가닥으로 찢어지며 얇아지고 바깥 색 단계부터 빠진다, debris틱까지 조각·불꽃만 흩어진다.
 */
export const TIMING: Record<Grade, { hold: number; tear: number; debris: number }> = {
  normal: { hold: 2, tear: 9, debris: 12 },
  strong: { hold: 4, tear: 11, debris: 20 },
  skill: { hold: 4, tear: 13, debris: 22 },
  super: { hold: 6, tear: 16, debris: 30 },
};

/** 14-3 등급별 최소 기준 (피크 프레임, 이 화면 px). 확인 표가 이것과 견준다 */
export const GRADE_SPEC: Record<Grade, {
  len: readonly [number, number];
  thick: readonly [number, number];
  steps: number;
  spikes: readonly [number, number];
  spikeLen: readonly [number, number];
  speed: readonly [number, number] | null;
  press: readonly [number, number] | null;
  embers: readonly [number, number];
}> = {
  normal: { len: [48 * SCALE, 96 * SCALE], thick: [10 * SCALE, 20 * SCALE], steps: 3, spikes: [3, 5], spikeLen: [16 * SCALE, 32 * SCALE], speed: null, press: null, embers: [10, 18] },
  strong: { len: [130 * SCALE, 190 * SCALE], thick: [24 * SCALE, 48 * SCALE], steps: 4, spikes: [5, 9], spikeLen: [24 * SCALE, 48 * SCALE], speed: [8, 20], press: [1, 2], embers: [18, 30] },
  skill: { len: [130 * SCALE, 190 * SCALE], thick: [24 * SCALE, 48 * SCALE], steps: 4, spikes: [5, 9], spikeLen: [24 * SCALE, 48 * SCALE], speed: [8, 20], press: [1, 2], embers: [18, 30] },
  super: { len: [320 * SCALE, 400 * SCALE], thick: [48 * SCALE, 120 * SCALE], steps: 4, spikes: [7, 9], spikeLen: [32 * SCALE, 64 * SCALE], speed: [14, 20], press: [1, 3], embers: [24, 30] },
};

/** 시드 난수 (렌더 전용이지만 같은 시드면 같은 모양: 캡처가 매번 같게) */
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

/** 화면 칸 번호 (월드 px → 칸). 화면 밖이면 −1. 칠한 사각형(box)을 넓힌다 */
export function cell(f: AFrame, x: number, y: number): number {
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

/** 한 칸 칠하기 (불투명, 표시 mark) */
export function put(f: AFrame, x: number, y: number, c: number): void {
  const i = cell(f, x, y);
  if (i < 0) return;
  f.color[i] = c >>> 0;
  if (f.mark) f.mark[i] = 1;
}

/** 선분 (1px, 끝 포함) */
export function line(f: AFrame, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let s = 0; s <= n; s++) put(f, x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, c);
}

/** 꽉 찬 삼각형 (가시 파편): 세 꼭짓점 안의 칸을 칠한다 */
export function tri(f: AFrame, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: number): void {
  const x0 = Math.floor(Math.min(ax, bx, cx));
  const x1 = Math.ceil(Math.max(ax, bx, cx));
  const y0 = Math.floor(Math.min(ay, by, cy));
  const y1 = Math.ceil(Math.max(ay, by, cy));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-3) {
    line(f, ax, ay, bx, by, c);
    return;
  }
  const s = Math.sign(area);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const w0 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) * s;
      const w1 = ((cx - bx) * (y - by) - (cy - by) * (x - bx)) * s;
      const w2 = ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) * s;
      if (w0 >= -0.5 && w1 >= -0.5 && w2 >= -0.5) put(f, x, y, c);
    }
  }
}

/**
 * 꺾인 선 (번개 가장자리·가닥): 간격 step px마다 −1~1 사이 값을 하나 뽑아 직선으로 잇는다 (매끈하지 않고 꺾인다).
 * 길이 n짜리 배열을 돌려준다 (표본마다 값)
 */
export function zigzag(n: number, step: number, rand: () => number, ds = 1): Float32Array {
  const out = new Float32Array(n);
  const stepN = Math.max(1, Math.round(step / ds));
  let a = rand() * 2 - 1;
  let b = rand() * 2 - 1;
  let next = Math.max(1, Math.round(stepN * (0.6 + rand() * 0.8)));
  let since = 0;
  for (let i = 0; i < n; i++) {
    out[i] = a + ((b - a) * since) / next;
    since++;
    if (since >= next) {
      since = 0;
      a = b;
      b = rand() * 2 - 1;
      next = Math.max(1, Math.round(stepN * (0.6 + rand() * 0.8)));
    }
  }
  return out;
}

/** 0~1로 자른 값 */
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
