import { COLORS as C } from '../palette';
import { paint, rect } from '../dither';

/**
 * 불 켜진 실내 (렌더 전용 도트 그리기 도구). 유리 너머 뒷벽에 등마다 떨어지는 빛 웅덩이를 밝기 여섯 단계로 칠하고,
 * 그 앞에 실루엣(사람·가구)을 세운다. 넓은 면은 단색, 단계 경계만 1~2칸 디더링한다
 * (반반 점무늬로 칠한 유리는 망사처럼 보여 쓰지 않는다).
 * 좌표는 모두 텍스처 칸 (위가 0). g: 바탕 그림, e: 발광 그림 (실루엣은 발광 검정).
 */

/** 밝기 단계 [바탕, 발광]: 어두운 쪽 → 등 바로 옆 */
export type RoomRamp = ReadonlyArray<readonly [string, string]>;

/** 백열등 (호박색) */
export const WARM: RoomRamp = [
  ['#3e2a1f', '#1e0c04'],
  ['#4e3527', '#3a1a08'],
  ['#614231', '#5e2c12'],
  ['#78523d', '#844018'],
  ['#93664c', '#ad5a20'],
  [C.windowLight, '#d4792c'],
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

/** 빛 웅덩이를 내는 등 (텍스처 칸): 자리, 가로·세로 반지름, 세기 */
export type RoomLamp = readonly [x: number, y: number, rx: number, ry: number, k: number];

/**
 * 실내 뒷벽: 사각형 (x, y, w, h) 안을 base 밝기 + 등마다 타원 빛 웅덩이로 칠한다. 구석(좌우 edge칸)은 조금 어둡게.
 */
export function roomWall(
  g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  lamps: readonly RoomLamp[], base: number, ramp: RoomRamp = WARM, edge = 30,
): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  const level = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i + 0.5;
      const py = y + j + 0.5;
      let I = base;
      for (const [lx, ly, rx, ry, k] of lamps) {
        const d = Math.hypot((px - lx) / rx, (py - ly) / ry);
        if (d < 1) I += k * (1 - d) * (1 - d * 0.35);
      }
      I *= 0.72 + 0.28 * Math.min(1, Math.min(i, w - 1 - i) / edge);
      I += (BAYER4[(y + j) & 3][(x + i) & 3] - 0.5) * 0.08;
      level[j * w + i] = I < 0.12 ? 0 : I < 0.28 ? 1 : I < 0.46 ? 2 : I < 0.66 ? 3 : I < 0.9 ? 4 : 5;
    }
  }
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
