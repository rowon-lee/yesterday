import type { CutinData } from '../data/moves/base';
import { HANGUL, HANJA } from './glyphs-ko';
import { COLORS, type ColorName } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

/**
 * 필살기 컷인. 기술 데이터의 컷인(cutin: CutinData)으로 그린다 (사용자 피드백 2026-11-02 '10. 공통 — 필살기 컷인'):
 * 캐릭터 대표 색의 사선 띠가 쓴 사람 쪽에서 밀려 들어오고, 한국어 기술 이름(한자가 있으면 한자를 크게, 한국어는 작게)을
 * 손으로 찍은 도트 글자(glyphs-ko.ts)로 쓴다. 영어·노란 띠를 쓰지 않는다. 덧무늬는 캐릭터마다 (번개·금실·베일·핏빛 달).
 * 나중에 AI로 만든 캐릭터별 컷씬 애니메이션으로 바꿀 때는 setCutinRenderer로 이 함수를 갈아 끼운다.
 */
export interface CutinInfo {
  /** 쓴 사람 (0 = 1P, 1 = 2P) */
  who: number;
  /** 기술 이름 (사건 이름. 화면에는 style의 한국어 이름을 쓴다) */
  text: string;
  /** 컷인 시작 후 지난 틱 */
  t: number;
  /** 전체 길이 (틱) */
  length: number;
  /** 기술 데이터의 컷인 (없으면 이름 없는 띠만) */
  style?: CutinData;
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

const col = (name: string | undefined, fallback: ColorName): string => COLORS[(name ?? fallback) as ColorName] ?? COLORS[fallback];

/** 도트 글자 하나 (scale배, 둘레 1px 테두리를 먼저) */
function glyph(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, scale: number, ink: string, edge: string): void {
  for (const [dx, dy, c] of [[-1, 0, edge], [1, 0, edge], [0, -1, edge], [0, 1, edge], [1, 1, edge], [0, 0, ink]] as const) {
    ctx.fillStyle = c;
    rows.forEach((row, r) => {
      for (let k = 0; k < row.length; k++) if (row[k] === '#') ctx.fillRect(x + k * scale + dx, y + r * scale + dy, scale, scale);
    });
  }
}

/** 글자 줄의 폭 (빈칸은 반 글자) */
function lineWidth(text: string, scale: number, hanja: boolean): number {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? 5 * scale : (hanja ? 16 : 10) * scale + scale * 2;
  return w - scale * 2;
}

function drawLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale: number, hanja: boolean, ink: string, edge: string): void {
  for (const ch of text) {
    if (ch === ' ') {
      x += 5 * scale;
      continue;
    }
    const rows = hanja ? HANJA[ch] : HANGUL[ch];
    if (rows) glyph(ctx, rows, x, y, scale, ink, edge);
    x += (hanja ? 16 : 10) * scale + scale * 2;
  }
}

function defaultCutin(ctx: CanvasRenderingContext2D, info: CutinInfo): void {
  const st = info.style;
  const L = Math.max(8, info.length);
  // 위아래 검은 띠 (넓은 면을 바둑판으로 어둡게 하지 않는다: 확대된 발동자가 그대로 보이게)
  const bar = Math.round(22 * Math.min(1, info.t / 4));
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, SCREEN_W, bar);
  ctx.fillRect(0, SCREEN_H - bar, SCREEN_W, bar);
  // 사선 띠: 쓴 사람 쪽에서 4틱 만에 밀려 들어오고, 끝 3틱에 반대쪽으로 빠진다. 기울기 1:8 (8px마다 한 줄씩 같은 계단)
  const side = info.who === 0 ? 1 : -1;
  const into = Math.min(1, (info.t + 1) / 4);
  const out = Math.max(0, (info.t - (L - 3)) / 3);
  const shift = Math.round((side > 0 ? -1 : 1) * SCREEN_W * (1 - into) + (side > 0 ? 1 : -1) * SCREEN_W * out);
  const H = 56;
  const base = SCREEN_H - 38;
  const cy = (x: number) => base - Math.floor((side > 0 ? x : SCREEN_W - 1 - x) / 8);
  const dark = col(st?.band[0], 'suitDark');
  const mid = col(st?.band[1], 'suit');
  const light = col(st?.band[2], 'suitLight');
  for (let x = 0; x < SCREEN_W; x++) {
    const sx = x + shift;
    if (sx < 0 || sx >= SCREEN_W) continue;
    const top = cy(x) - H / 2;
    ctx.fillStyle = mid;
    ctx.fillRect(sx, top, 1, H);
    ctx.fillStyle = dark;
    ctx.fillRect(sx, top + Math.round(H * 0.68), 1, H - Math.round(H * 0.68));
    ctx.fillStyle = light;
    ctx.fillRect(sx, top, 1, 2);
    ctx.fillRect(sx, top + H - 1, 1, 1);
  }
  if (!st) return;
  // 덧무늬
  const acc = st.accent;
  if (acc) {
    const a = col(acc.color, 'suit');
    const b = col(acc.light, 'suitLight');
    if (acc.motif === 'bolt') {
      // 띠 아랫단을 따라 꺾인 번개 한 줄 (3틱마다 다시 꺾인다)
      const seed = Math.floor(info.t / 3);
      let y = 0;
      for (let x = 0; x < SCREEN_W; x += 4) {
        const ny = ((x * 7 + seed * 13) % 9) - 4;
        const sx = x + shift;
        const by = cy(x) + 14;
        for (let k = 0; k < 4; k++) {
          const yy = by + Math.round(y + ((ny - y) * k) / 4);
          if (sx + k >= 0 && sx + k < SCREEN_W) {
            ctx.fillStyle = b;
            ctx.fillRect(sx + k, yy, 1, 1);
            ctx.fillStyle = a;
            ctx.fillRect(sx + k, yy + 1, 1, 1);
          }
        }
        y = ny;
      }
    } else if (acc.motif === 'thread') {
      // 금실 세 가닥이 띠를 가로질러 물결친다
      for (let n = 0; n < 3; n++) {
        for (let x = 0; x < SCREEN_W; x++) {
          const sx = x + shift;
          if (sx < 0 || sx >= SCREEN_W) continue;
          const yy = cy(x) - 18 + n * 14 + Math.round(Math.sin((x + info.t * 3 + n * 40) / 22) * 3);
          ctx.fillStyle = n === 1 ? b : a;
          ctx.fillRect(sx, yy, 1, 1);
        }
      }
    } else if (acc.motif === 'veil') {
      // 푸른 베일 자락 셋: 띠를 비스듬히 가르는 얇은 천 (가장자리만 밝게)
      for (let n = 0; n < 3; n++) {
        const x0 = 70 + n * 150 + Math.round(Math.sin(info.t / 6 + n) * 4);
        for (let k = 0; k < H; k++) {
          const sx = x0 + shift - k / 2;
          const yy = cy(x0) - H / 2 + k;
          ctx.fillStyle = a;
          ctx.fillRect(Math.round(sx), yy, 6, 1);
          ctx.fillStyle = b;
          ctx.fillRect(Math.round(sx) + 6, yy, 1, 1);
        }
      }
    } else if (acc.motif === 'moon') {
      // 핏빛 달: 띠 끝에 걸린 둥근 달 (아래쪽 그림자 초승달)
      const mx = (side > 0 ? 70 : SCREEN_W - 70) + shift;
      const my = cy(side > 0 ? 70 : SCREEN_W - 70) - 6;
      const R = 18;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue;
          const shadow = (dx - 6) * (dx - 6) + (dy - 5) * (dy - 5) > (R - 2) * (R - 2);
          ctx.fillStyle = shadow ? b : a;
          ctx.fillRect(mx + dx, my + dy, 1, 1);
        }
    }
  }
  // 글자: 띠가 다 들어온 뒤 (3틱째부터). 첫 틱은 하얗게 번쩍 찍힌다
  if (info.t < 3 || out > 0.5) return;
  const flash = info.t === 3;
  const ink = flash ? COLORS.fxWhite : col(st.ink[0], 'white');
  const edge = col(st.ink[1], 'ink');
  const center = side > 0 ? 300 : SCREEN_W - 300;
  if (st.hanja) {
    const S = 3;
    const w = lineWidth(st.hanja, S, true);
    const x = Math.round(center - w / 2) + shift;
    const y = cy(center) - 24;
    drawLine(ctx, st.hanja, x, y, S, true, ink, edge);
    // 한국어 이름은 작게, 한자 오른쪽 아래
    const ks = 2;
    drawLine(ctx, st.name, x + w + 8, y + 48 - 20 - 2, ks, false, flash ? COLORS.fxWhite : col(st.band[2], 'white'), edge);
  } else {
    const S = st.name.length > 5 ? 2 : 3;
    const w = lineWidth(st.name, S, false);
    const x = Math.round(Math.max(8, Math.min(SCREEN_W - 8 - w, center - w / 2))) + shift;
    const y = cy(center) - Math.round((10 * S) / 2) - 2;
    drawLine(ctx, st.name, x, y, S, false, ink, edge);
  }
}
