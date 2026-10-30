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
  T: [7, 2, 2, 2, 2],
  I: [7, 2, 2, 2, 7],
  C: [7, 4, 4, 4, 7],
  K: [5, 5, 6, 5, 5],
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
