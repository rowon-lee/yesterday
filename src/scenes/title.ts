import { BREAKABLES, createCity } from '../sim';
import { MAP_H } from '../stage/citadel';
import { drawText, GLYPH_H, textWidth } from '../render/font';
import { hintBar, Menu, panel, type MenuItem } from '../render/menu';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import { gl } from '../render/gl';
import { lights as lights2d, qualitySetting, setQuality } from '../render/light';
import type { PropState } from '../sim';
import type { App, Scene } from './scene';
import { touch } from '../core/touch';

/**
 * 타이틀 (?scene=title, 처음 여는 화면). 비 오는 밤 거리를 카메라가 천천히 지나가고, 위에 제목과 메뉴.
 * 메뉴: 대련(CPU 강도) / 연습(상대 고르기) / 설정(품질·조작법·모션 뷰어) / 온라인(준비 중, 흐리게).
 * 키보드(W·S 또는 ↑↓, J·Enter, K·Esc)와 화면 누르기로 고른다. 글자는 도트 폰트 하나(영문 대문자).
 */
export function titleScene(app: App): Scene {
  // 배경: 극장 거리 ↔ 시타델 광장을 천천히 오간다
  const FROM = 1900;
  const TO = 3300;
  let cam = 2150;
  let dir = 1;
  let tick = 0;
  const props: PropState[] = BREAKABLES.map((b) => ({ hp: b.hp, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1, at: 0 }));
  const city = createCity();
  let showControls = false;
  // 타이틀에는 터치 패드·버튼을 띄우지 않는다 (메뉴는 화면을 바로 누른다)
  touch.enable(false);

  const start = (opts: Record<string, string>) => app.goto('fight', opts);
  const level = (name: string): MenuItem => ({ label: name, act: () => start({ mode: 'vs', cpu: name.toLowerCase() }) });
  const dummy = (label: string, value: string): MenuItem => ({ label, act: () => start({ mode: 'practice', dummy: value }) });

  let menu: Menu;
  const main: Menu = new Menu([
    { label: 'VERSUS CPU', act: () => { menu = vs; } },
    { label: 'PRACTICE', act: () => { menu = practice; } },
    { label: 'OPTIONS', act: () => { menu = options; } },
    { label: 'ONLINE', disabled: true, note: 'SOON' },
  ]);
  const vs: Menu = new Menu([level('EASY'), level('NORMAL'), level('HARD'), { label: 'BACK', act: () => { menu = main; } }], 'CPU LEVEL');
  const practice: Menu = new Menu([
    dummy('STAND', 'stand'),
    dummy('GUARD', 'guard'),
    dummy('CPU', 'cpu'),
    { label: 'BACK', act: () => { menu = main; } },
  ], 'DUMMY');
  const QUALITY = ['auto', 'high', 'low'] as const;
  const options: Menu = new Menu([
    {
      label: 'QUALITY',
      value: () => qualitySetting().toUpperCase(),
      act: () => {
        setQuality(QUALITY[(QUALITY.indexOf(qualitySetting()) + 1) % QUALITY.length]);
      },
    },
    { label: 'CONTROLS', act: () => { showControls = true; } },
    { label: 'MOTION VIEWER', act: () => app.goto('viewer') },
    { label: 'BACK', act: () => { menu = main; } },
  ], 'OPTIONS');
  menu = main;

  return {
    tick(input) {
      tick++;
      cam += dir * 0.5;
      if (cam >= TO || cam <= FROM) dir = -dir;
      const taps = input.taps ?? [];
      if (showControls) {
        if (input.pressed.size || taps.length) showControls = false;
        return;
      }
      if (menu.handle(input, taps) === 'back' && menu !== main) menu = main;
    },
    render(ctx) {
      const g = gl();
      lights2d.clear();
      g.world.foreground.visible = true;
      g.actors.hide();
      g.view.begin({ x: cam, y: MAP_H - SCREEN_H }, tick);
      g.world.update(g.view, tick, props, city, null, tick, null);
      g.view.commitLights();
      g.view.render();
      ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
      drawTitle(ctx, tick);
      if (showControls) {
        drawControls(ctx);
        hintBar(ctx, touch.available ? 'TAP TO CLOSE' : 'ANY KEY: CLOSE', SCREEN_H - 14);
        return;
      }
      const h = menu.items.length * 16 + (menu.title ? GLYPH_H + 7 : 0);
      panel(ctx, SCREEN_W / 2 - 86, 118, 172, h + 16);
      menu.draw(ctx, SCREEN_W / 2, 126, tick);
      hintBar(ctx, touch.available ? 'TAP TO SELECT' : 'W S: MOVE   J: SELECT   K: BACK   OR TAP', SCREEN_H - 14);
    },
  };
}

/** 제목: YESTERDAY (크게, 빛 받는 윗줄), 아래에 STICK ACTION */
function drawTitle(ctx: CanvasRenderingContext2D, tick: number): void {
  const t = 'YESTERDAY';
  const s = 5;
  const w = textWidth(t, s);
  const x = Math.round((SCREEN_W - w) / 2);
  const y = 34;
  drawText(ctx, t, x + 2, y + 2, COLORS.ink, s);
  drawText(ctx, t, x, y, COLORS.white, s);
  // 네온처럼 윗줄만 밝게 (글자 윗줄 1칸)
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, s);
  ctx.clip();
  drawText(ctx, t, x, y, COLORS.goldLight, s);
  ctx.restore();
  const sub = 'STICK ACTION';
  const sw = textWidth(sub, 2);
  drawText(ctx, sub, Math.round((SCREEN_W - sw) / 2) + 1, y + GLYPH_H * s + 9, COLORS.ink, 2);
  drawText(ctx, sub, Math.round((SCREEN_W - sw) / 2), y + GLYPH_H * s + 8, (tick >> 5) % 8 === 0 ? COLORS.goldLight : COLORS.gold, 2);
}

/** 조작법 (키보드, 터치 기기면 터치). 아무 키나 누르거나 화면을 누르면 닫힌다 */
export function drawControls(ctx: CanvasRenderingContext2D): void {
  const rows: Array<[string, string]> = touch.available
    ? [
        ['MOVE', 'LEFT PAD'],
        ['GUARD', 'HOLD PAD DOWN'],
        ['ATTACK', 'TAP   HOLD: CHARGE'],
        ['JUMP / DASH', 'RIGHT BUTTONS'],
        ['SKILL 1 / 2', 'TOP ROW'],
        ['SUPER', 'TOP ROW RIGHT'],
        ['PAUSE', 'II AT TOP'],
      ]
    : [
        ['MOVE', 'W A S D / ARROWS'],
        ['GUARD', 'HOLD S / DOWN'],
        ['ATTACK', 'J   HOLD J: CHARGE'],
        ['JUMP', 'K'],
        ['DASH', 'L'],
        ['SKILL 1 / 2', 'U / I'],
        ['SUPER', 'O'],
        ['PAUSE', 'P / ESC'],
      ];
  const x = SCREEN_W / 2 - 120;
  const y = 104;
  panel(ctx, x, y, 240, rows.length * 13 + 30);
  drawText(ctx, 'CONTROLS', Math.round(SCREEN_W / 2 - textWidth('CONTROLS') / 2), y + 6, COLORS.goldDark);
  rows.forEach(([k, v], i) => {
    drawText(ctx, k, x + 12, y + 20 + i * 13, COLORS.gold);
    drawText(ctx, v, x + 96, y + 20 + i * 13, COLORS.white);
  });
}
