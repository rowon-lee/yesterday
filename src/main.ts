import { Keyboard, type TickInput } from './core/input';
import { startLoop } from './core/loop';
import { drawText, textWidth, GLYPH_H } from './render/font';
import { setupScreen, SCREEN_W, SCREEN_H } from './render/screen';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas);
const keyboard = new Keyboard();

let tickCount = 0;
// 아직 게임 내용이 없으므로 입력은 모으기만 한다. 다음 단계에서 sim에 넘긴다.
let lastInput: TickInput | null = null;

function tick(): void {
  lastInput = keyboard.poll();
  tickCount++;
}

function render(): void {
  ctx.fillStyle = '#07040e';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const label = `TICK ${tickCount}`;
  const scale = 2;
  drawText(
    ctx,
    label,
    Math.floor((SCREEN_W - textWidth(label, scale)) / 2),
    Math.floor((SCREEN_H - GLYPH_H * scale) / 2),
    '#f4f0e6',
    scale,
  );
}

// 확인 도구(tools/screenshot)가 읽는 값
(window as unknown as { __debug: object }).__debug = {
  get tick() { return tickCount; },
  get held() { return lastInput ? [...lastInput.held] : []; },
};

startLoop(tick, render);
