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

/**
 * 필살기 컷씬 영상 훅 (캐릭터 기획서 '필살기 연출': 나중에 AI로 만든 영상을 끼울 자리).
 * 필살기를 발동하는 순간 한 번 불린다. 영상을 틀었으면 true를 돌려주고 (그러면 기본 컷인 띠를 그리지 않는다),
 * 아니면 false. sim이 멈추는 길이(발동 정지)는 영상과 관계없이 정해져 있으니, 영상은 그 길이(ticks/60초) 안에 끝나야 한다.
 * 예: setCutsceneHook(({ who, move, ticks }) => playOverlayVideo(`cutscenes/${move}-${who}.mp4`, ticks / 60))
 */
export interface CutsceneInfo {
  who: number;
  /** 기술 id (캐릭터를 얹으면 캐릭터·기술마다 다른 영상) */
  move: string;
  text: string;
  /** 발동 정지 길이 (틱) */
  ticks: number;
}
export type CutsceneHook = (info: CutsceneInfo) => boolean;
let cutsceneHook: CutsceneHook | null = null;

export function setCutsceneHook(fn: CutsceneHook | null): void {
  cutsceneHook = fn;
}

/** 발동 순간: 훅이 영상을 틀었으면 true */
export function playCutscene(info: CutsceneInfo): boolean {
  return cutsceneHook ? cutsceneHook(info) : false;
}

function defaultCutin(ctx: CanvasRenderingContext2D, info: CutinInfo): void {
  // 위아래 검은 띠 (넓은 면을 바둑판으로 어둡게 하지 않는다: 확대된 발동자가 그대로 보이게)
  const bar = Math.round(22 * Math.min(1, info.t / 5));
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, SCREEN_W, bar);
  ctx.fillRect(0, SCREEN_H - bar, SCREEN_W, bar);
  // 기술 이름 띠: 쓴 사람 쪽에서 밀려 들어와 화면 아래쪽에 선다 (발동자는 가운데에 확대되어 보인다)
  const bandH = 30;
  const bandY = SCREEN_H - bar - bandH - 10;
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
  drawText(ctx, info.text, x + Math.floor((SCREEN_W - w) / 2), bandY + 5, COLORS.white, scale);
}
