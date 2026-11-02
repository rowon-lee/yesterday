import { COLORS as C } from '../palette';
import { paint, rect } from '../dither';

/**
 * 불 켜진 실내 (렌더 전용 도트 그리기 도구). 유리 너머 뒷벽에 등마다 떨어지는 빛 웅덩이를 밝기 여섯 단계로 칠하고,
 * 그 앞에 실루엣(사람·가구)을 세운다. 넓은 면은 단색, 단계 경계 양쪽 한 칸씩만 디더링한다
 * (반반 점무늬로 칠한 유리는 망사처럼 보여 쓰지 않는다).
 * 좌표는 모두 텍스처 칸 (위가 0). g: 바탕 그림, e: 발광 그림 (실루엣은 발광 검정).
 */

/** 밝기 단계 [바탕, 발광]: 어두운 쪽 → 등 바로 옆 */
export type RoomRamp = ReadonlyArray<readonly [string, string]>;

/** 백열등 (호박색): 등 바로 옆 마지막 단계는 하얗게 날아간 빛의 심 (흑백 200 이상: 광원) */
export const WARM: RoomRamp = [
  ['#3e2a1f', '#24120a'],
  ['#614231', '#5e2c12'],
  ['#78523d', '#844018'],
  ['#93664c', '#ad5a20'],
  [C.windowLight, '#d4792c'],
  ['#ffe2a8', '#fff4d8'],
];
/** 형광등 (창백한 청록) */
export const FLUO: RoomRamp = [
  ['#1c2826', '#061410'],
  ['#24342f', '#0c2a21'],
  ['#2f4a40', '#123d2f'],
  ['#3e6050', '#1a5440'],
  ['#5a806a', '#338c66'],
  ['#93a596', '#72cf9c'],
];
/** 네온 술집 (분홍) */
export const PINK: RoomRamp = [
  ['#2e1832', '#120610'],
  ['#3e2244', '#26091c'],
  ['#512e58', '#3f0f2f'],
  ['#673c6e', '#611648'],
  ['#804c88', '#8a2066'],
  ['#a066a8', '#b42d86'],
];

/** 용광로 불빛 (검붉은 어둠 → 주황 → 쇳물의 노란 심) */
export const FURNACE: RoomRamp = [
  ['#1c080a', '#0d0405'],
  ['#2e0c10', '#2e0c10'],
  ['#62181c', '#62181c'],
  ['#a82c2a', '#a82c2a'],
  ['#d4792c', '#ec6046'],
  ['#ffc16e', '#ffc16e'],
];

/** 텔레비전 불빛 (푸르스름하게 깜빡이는 방) */
export const TV: RoomRamp = [
  ['#131a2c', '#04050a'],
  ['#1a2439', '#0d121f'],
  ['#223047', '#1a2439'],
  ['#2b3d56', '#2b3d56'],
  ['#405a76', '#4c6a86'],
  ['#7690aa', '#98b0c6'],
];

/** 4×4 바이어 무늬 (0~1) */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

/**
 * 빛 웅덩이를 내는 등 (텍스처 칸): 자리, 가로·세로 반지름, 세기, 모양.
 * 모양 0 둥근 등(맨 전구·유리 구): 작은 하얀 심과 길게 옅어지는 둘레. 1 갓 씌운 등(아래로): 갓 밑으로 퍼지는 원뿔 빛,
 * 갓 위 천장은 어둡다 (rx는 ry만큼 내려간 곳의 원뿔 반폭). 2 위로 비추는 등(바닥 스탠드·투광등): 1을 뒤집은 것
 */
export type RoomLamp = readonly [x: number, y: number, rx: number, ry: number, k: number, shape?: number];
/** 빛을 가리는 것 (사람·가구·기둥): 사각형과 등에서 벽까지 중 어디쯤 섰는지 (0 등 바로 앞 ~ 1 벽에 붙음) */
export type RoomBlock = readonly [x0: number, y0: number, x1: number, y1: number, f: number];

/**
 * 밝기 단계 문턱 (여섯 단계). 맨 위 단계(하얀 심)는 좁게, 아래 단계들은 넓게 (과녁 무늬처럼 같은 폭의 고리가 겹겹이 서지 않게)
 */
const STEPS = [0.13, 0.3, 0.52, 0.8, 1.08];
const stepOf = (v: number): number => (v < STEPS[0] ? 0 : v < STEPS[1] ? 1 : v < STEPS[2] ? 2 : v < STEPS[3] ? 3 : v < STEPS[4] ? 4 : 5);

/**
 * 밝기 지도(칸마다 0~1 남짓) → 단계 번호. 넓은 면은 단색으로 두고, 단계가 바뀌는 경계 양쪽 한 칸씩만 바이어 무늬로 섞는다
 * (밝기가 천천히 바뀌는 곳도 띠가 넓어지지 않게: 그 칸의 기울기만큼만 흔든다).
 */
export function stepLevels(I: Float32Array, w: number, h: number, x: number, y: number): Uint8Array {
  const level = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      let v = I[k];
      const gx = (I[j * w + Math.min(w - 1, i + 1)] - I[j * w + Math.max(0, i - 1)]) * 0.5;
      const gy = (I[Math.min(h - 1, j + 1) * w + i] - I[Math.max(0, j - 1) * w + i]) * 0.5;
      const g = Math.max(Math.abs(gx), Math.abs(gy));
      if (g > 1e-4) {
        let near = Infinity;
        for (const t of STEPS) near = Math.min(near, Math.abs(v - t));
        if (near < g) v += (BAYER4[(y + j) & 3][(x + i) & 3] - 0.5) * 2 * g;
      }
      level[k] = stepOf(v);
    }
  }
  return level;
}

/** 칸 좌표의 부드러운 잡음 (0~1, 7칸 남짓 크기): 빛 웅덩이 가장자리를 조금 일렁이게 (완전한 타원 고리가 되지 않게) */
function wobble(px: number, py: number): number {
  const cell = 7;
  const fx = px / cell;
  const fy = py / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const v = (a: number, b: number) => {
    let n = (a * 374761393 + b * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const a = v(ix, iy) * (1 - sx) + v(ix + 1, iy) * sx;
  const b = v(ix, iy + 1) * (1 - sx) + v(ix + 1, iy + 1) * sx;
  return a * (1 - sy) + b * sy;
}

/** 등 하나가 칸 (px, py)에 주는 밝기 (가리는 것 없이) */
function lampAt(l: RoomLamp, px: number, py: number): number {
  const [lx, ly, rx, ry, k] = l;
  const shape = l[5] ?? 0;
  if (shape === 0) {
    const d = Math.hypot((px - lx) / rx, (py - ly) / ry);
    if (d >= 1) return 0;
    // 넓고 옅은 둘레 + 등 바로 옆 작은 심
    const s = 1 - d;
    return k * (s ** 1.3 * 0.9 + Math.max(0, 1 - d / 0.22) ** 2 * 0.5);
  }
  // 갓 씌운 등: 갓 밑(1) 또는 위(2)로 퍼지는 원뿔
  const dy = shape === 1 ? py - ly : ly - py;
  const near = Math.hypot((px - lx) / (rx * 0.45), (py - ly) / (ry * 0.18));
  // 갓 둘레: 갓 바로 옆 작은 빛 (반대쪽 천장·바닥은 어둡다)
  let v = near < 1 ? k * 0.35 * (1 - near) ** 2 : 0;
  if (dy > 0) {
    const t = dy / ry;
    const half = rx * (0.18 + 0.82 * Math.min(1.4, t));
    const a = Math.abs(px - lx) / Math.max(1, half);
    if (a < 1.15 && t < 1.25) {
      // 원뿔 가장자리는 갓이 자르는 선이라 또렷하게, 길이 방향으로는 길게 옅어진다
      const side = a < 0.88 ? 1 : Math.max(0, 1 - (a - 0.88) / 0.27);
      const fall = Math.max(0, 1 - t / 1.25);
      v += k * side * (fall * fall * 0.9 + Math.max(0, 1 - t / 0.32) * 0.55);
    }
  }
  return v;
}

/**
 * 실내 뒷벽: 사각형 (x, y, w, h) 안을 base 밝기 + 등마다 빛 웅덩이로 칠한다. 구석(좌우 edge칸)은 조금 어둡게.
 * blocks: 등과 벽 사이에 선 것 (사람·가구)은 등 반대쪽으로 늘어난 그림자를 벽에 드리운다 (빛이 '물건'에 막혀 공간이 생긴다).
 */
export function roomWall(
  g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  lamps: readonly RoomLamp[], base: number, ramp: RoomRamp = WARM, edge = 30, blocks: readonly RoomBlock[] = [],
): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  const I = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i + 0.5;
      const py = y + j + 0.5;
      let v = base;
      for (const l of lamps) {
        let c = lampAt(l, px, py);
        if (c <= 0) continue;
        // 그림자: 등에서 이 칸으로 가는 빛이 가리는 것의 깊이에서 그 사각형 안을 지나면 막힌다 (벽에 크게 드리운다)
        for (const [bx0, by0, bx1, by1, f] of blocks) {
          const qx = l[0] + (px - l[0]) * f;
          const qy = l[1] + (py - l[1]) * f;
          if (qx >= bx0 && qx < bx1 && qy >= by0 && qy < by1) {
            c *= 0.3;
            break;
          }
        }
        v += c;
      }
      // 빛 웅덩이 가장자리를 조금 일렁이게 (밝을수록 덜)
      v *= 0.94 + 0.12 * wobble(px, py);
      I[j * w + i] = v * (0.72 + 0.28 * Math.min(1, Math.min(i, w - 1 - i) / edge));
    }
  }
  const level = stepLevels(I, w, h, x, y);
  paint(g, x, y, w, h, (px, py) => ramp[level[(py - y) * w + (px - x)]][0]);
  paint(e, x, y, w, h, (px, py) => ramp[level[(py - y) * w + (px - x)]][1]);
}

/** 실루엣 사각형 (바탕 색, 발광 검정) */
export function sil(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string = C.iron): void {
  rect(g, x, y, w, h, color);
  rect(e, x, y, w, h, '#000');
}

/** 빛나는 사각형 (바탕과 발광 둘 다) */
export function glowRect(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, glow: string): void {
  rect(g, x, y, w, h, color);
  rect(e, x, y, w, h, glow);
}

export type Figure = 'hat' | 'guard' | 'walk' | 'bare' | 'sit' | 'lean';

/**
 * 사람 실루엣 (텍스처 칸): 발 높이 foot(아래 끝 y), 가운데 cx, 키 hh. 코트 차림, 중절모·경비 모자·걷는 사람·앉은 사람·기댄 사람.
 */
export function figure(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, cx: number, foot: number, hh: number, kind: Figure, color: string = C.iron): void {
  const s = (x0: number, x1: number, h0: number, h1: number) => {
    const ya = Math.round(foot - h1);
    const yb = Math.round(foot - h0);
    sil(g, e, Math.round(cx + x0), ya, Math.max(1, Math.round(x1 - x0)), Math.max(1, yb - ya), color);
  };
  const r = hh / 50;
  const legH = hh * 0.44;
  if (kind === 'sit') {
    // 의자에 앉은 사람 (무릎이 앞으로)
    s(-5 * r, 5 * r, legH * 0.55, hh * 0.72);
    s(-5 * r, 8 * r, legH * 0.45, legH * 0.62);
    s(6 * r, 9 * r, 0, legH * 0.6);
    s(-2.5 * r, 2.5 * r, hh * 0.72, hh * 0.86);
    return;
  }
  if (kind === 'walk') {
    s(-6 * r, -3 * r, 0, legH * 0.9);
    s(2 * r, 5 * r, 0, legH * 0.9);
    s(-4 * r, 3 * r, legH * 0.6, legH + 2);
  } else {
    s(-4 * r, -1 * r, 0, legH);
    s(1 * r, 4 * r, 0, legH);
  }
  const lean = kind === 'lean' ? 2 * r : 0;
  s(-5 * r + lean, 5 * r + lean, legH - 2, hh * 0.8);
  s(-6 * r + lean, 6 * r + lean, legH - 2, legH + 4 * r);
  s(-2.5 * r + lean, 2.5 * r + lean, hh * 0.8, hh * 0.96);
  if (kind === 'hat') {
    s(-5 * r, 5 * r, hh * 0.92, hh * 0.94);
    s(-3 * r, 3 * r, hh * 0.94, hh * 1.02);
  } else if (kind === 'guard') {
    s(-4 * r, 5 * r, hh * 0.94, hh);
    s(5 * r, 7 * r, hh * 0.35, hh * 0.98);
  }
}
