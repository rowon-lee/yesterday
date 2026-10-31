import { drawText, textWidth } from './font';
import { COLORS } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

/**
 * 필살기 컷인. 지금은 화면을 어둡게 하고 기술 이름 띠를 띄운다.
 * 나중에 AI로 만든 캐릭터별 컷씬 애니메이션으로 바꿀 때는 setCutinRenderer로 이 함수를 갈아 끼운다.
 */
export interface CutinInfo {
  /** 쓴 사람 (0 = 1P, 1 = 2P) */
  who: number;
  /** 기술 이름 */
  text: string;
  /** 컷인 시작 후 지난 틱 */
  t: number;
  /** 전체 길이 (틱) */
  length: number;
}

export type CutinRenderer = (ctx: CanvasRenderingContext2D, info: CutinInfo) => void;

let renderer: CutinRenderer = defaultCutin;

export function setCutinRenderer(fn: CutinRenderer): void {
  renderer = fn;
}

export function drawCutin(ctx: CanvasRenderingContext2D, info: CutinInfo): void {
  renderer(ctx, info);
}

function defaultCutin(ctx: CanvasRenderingContext2D, info: CutinInfo): void {
  // 화면을 어둡게 (반투명 대신 바둑판 디더링)
  ctx.fillStyle = COLORS.ink;
  for (let y = 0; y < SCREEN_H; y++) {
    for (let x = y & 1; x < SCREEN_W; x += 2) ctx.fillRect(x, y, 1, 1);
  }
  // 띠가 쓴 사람 쪽에서 밀려 들어온다
  const bandY = 70;
  const bandH = 34;
  const slide = Math.min(1, info.t / 8);
  const from = info.who === 0 ? -SCREEN_W : SCREEN_W;
  const x = Math.round(from * (1 - slide));
  ctx.fillStyle = info.who === 0 ? COLORS.goldDark : COLORS.skyDark;
  ctx.fillRect(x, bandY, SCREEN_W, bandH);
  ctx.fillStyle = info.who === 0 ? COLORS.gold : COLORS.sky;
  ctx.fillRect(x, bandY, SCREEN_W, 2);
  ctx.fillRect(x, bandY + bandH - 2, SCREEN_W, 2);
  const scale = 4;
  const w = textWidth(info.text, scale);
  drawText(ctx, info.text, x + Math.floor((SCREEN_W - w) / 2), bandY + 7, COLORS.white, scale);
}
