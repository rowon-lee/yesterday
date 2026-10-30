import type { TickInput } from './core/input';
import { drawText, GLYPH_H, textWidth } from './render/font';
import { SCREEN_H, SCREEN_W } from './render/screen';

/** 화면 하나. 주소 뒤 ?scene=이름 으로 고른다 (npm run shot도 이걸 쓴다). */
export interface Scene {
  tick(input: TickInput): void;
  render(ctx: CanvasRenderingContext2D): void;
}

/** 빈 화면에 틱 수만 표시 */
function blankScene(): Scene {
  let ticks = 0;
  return {
    tick() {
      ticks++;
    },
    render(ctx) {
      ctx.fillStyle = '#07040e';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      const label = `TICK ${ticks}`;
      const scale = 2;
      drawText(
        ctx,
        label,
        Math.floor((SCREEN_W - textWidth(label, scale)) / 2),
        Math.floor((SCREEN_H - GLYPH_H * scale) / 2),
        '#f4f0e6',
        scale,
      );
    },
  };
}

export const SCENES: Record<string, () => Scene> = {
  blank: blankScene,
};
export const DEFAULT_SCENE = 'blank';
