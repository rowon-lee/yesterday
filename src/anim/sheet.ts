import { drawText, GLYPH_H } from '../render/font';
import { DEFAULT_CELL, FOOT_Y, MAX_FRAMES, MIN_FRAMES, type Motion } from './motion';

/** 규격 위반을 문장으로 돌려준다. 없으면 빈 배열. */
export function checkMotion(m: Motion): string[] {
  const errors: string[] = [];
  const n = m.dur.length;
  if (n < MIN_FRAMES || n > MAX_FRAMES) errors.push(`프레임 ${n}개 (12~14여야 함)`);
  m.dur.forEach((d, i) => {
    if (!Number.isInteger(d) || d < 1) errors.push(`${i + 1}번 프레임 dur ${d} (1 이상 정수여야 함)`);
  });
  return errors;
}

const GAP = 1;
const LABEL_H = GLYPH_H + 2;

/**
 * 확인용 가로 띠 (1배 크기). 칸 위에 프레임 번호(1부터), 칸 안에 발밑 높이 표시.
 * 확대는 부르는 쪽에서 한다.
 */
export function drawStrip(m: Motion): HTMLCanvasElement {
  const cell = m.cell ?? DEFAULT_CELL;
  const n = m.dur.length;
  const footY = Math.round((FOOT_Y / DEFAULT_CELL) * cell);
  const c = document.createElement('canvas');
  c.width = n * cell + (n - 1) * GAP;
  c.height = LABEL_H + cell;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#07040e';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < n; i++) {
    const x = i * (cell + GAP);
    drawText(ctx, String(i + 1), x + 1, 1, '#ffd25e');
    ctx.fillStyle = '#120a24';
    ctx.fillRect(x, LABEL_H, cell, cell);
    ctx.fillStyle = '#2a1f44';
    ctx.fillRect(x, LABEL_H + footY + 1, cell, 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, LABEL_H, cell, cell);
    ctx.clip();
    m.draw(ctx, i, x, LABEL_H);
    ctx.restore();
  }
  return c;
}

export function scaleCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
