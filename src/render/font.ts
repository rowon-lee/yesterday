/**
 * 3×5 도트 글꼴. 외부 폰트를 쓰지 않고, fillText는 흐리게 번지므로 직접 찍는다.
 * 각 글자는 5줄, 줄마다 3비트(왼쪽이 높은 비트).
 */
const GLYPHS: Record<string, readonly number[]> = {
  '0': [7, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7],
  '2': [7, 1, 7, 4, 7],
  '3': [7, 1, 7, 1, 7],
  '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7],
  '6': [7, 4, 7, 5, 7],
  '7': [7, 1, 1, 1, 1],
  '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 7],
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [7, 4, 4, 4, 7],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 6, 3],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  '/': [1, 1, 2, 4, 4],
  '.': [0, 0, 0, 0, 2],
  ':': [0, 2, 0, 2, 0],
  '-': [0, 0, 7, 0, 0],
  ' ': [0, 0, 0, 0, 0],
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

/** (x, y)는 왼쪽 위. scale은 도트 하나의 크기(정수). */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const rows = GLYPHS[ch];
    if (rows) {
      for (let r = 0; r < GLYPH_H; r++) {
        for (let c = 0; c < GLYPH_W; c++) {
          if (rows[r] & (4 >> c)) ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
        }
      }
    }
    cx += (GLYPH_W + 1) * scale;
  }
}

export function textWidth(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * (GLYPH_W + 1) - 1) * scale;
}

/** 글자 하나의 도트 (5줄, 줄마다 3비트). 없는 글자는 빈칸 */
export function glyphRows(ch: string): readonly number[] {
  return GLYPHS[ch] ?? GLYPHS[' '];
}
