import { BREAKABLES, createCity, motionOf, type CharId } from '../sim';
import { MOTIONS } from '../anim/motions';
import { cellOf } from '../anim/motion';
import { isSkin } from '../anim/skins';
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
import { audioSettings, setAudioSettings, silentSwitchSupported, stepVolume, VOLUME_MAX, type VolumeName } from '../audio/settings';

/**
 * 타이틀 (?scene=title, 처음 여는 화면). 비 오는 밤 거리를 카메라가 천천히 지나가고, 위에 제목과 메뉴.
 * 메뉴: 대련(내 캐릭터 → CPU 캐릭터 → CPU 강도) / 연습(내 캐릭터 → 상대 캐릭터 → 상대 고르기) /
 * 설정(품질·소리·조작법·모션 뷰어) / 온라인(준비 중, 흐리게).
 * 소리: 전체·음악·효과음 음량(0~10, ←→ 또는 항목 왼쪽·오른쪽 반 누르기), 아이폰 무음 스위치(그 기능이 있는 브라우저에서만), 소리 시험 화면.
 * 캐릭터를 고르는 동안 고른 줄의 캐릭터가 메뉴 왼쪽에 2배 크기로 대기 동작을 한다.
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

  /** 고를 수 있는 캐릭터 (도트 폰트는 영문 대문자뿐이라 영문 이름) */
  const ROSTER: ReadonlyArray<readonly [CharId, string]> = [['raiden', 'RAIDEN'], ['eunwoo', 'BAEK EUNWOO'], ['edward', 'EDWARD'], ['oscar', 'OSCAR']];
  let mode: 'vs' | 'practice' = 'vs';
  const picked: [CharId, CharId] = ['raiden', 'raiden'];
  const start = (opts: Record<string, string>) => app.goto('fight', { ...opts, p1char: picked[0], p2char: picked[1] });
  const level = (name: string): MenuItem => ({ label: name, act: () => start({ mode: 'vs', cpu: name.toLowerCase() }) });
  const dummy = (label: string, value: string): MenuItem => ({ label, act: () => start({ mode: 'practice', dummy: value }) });

  let menu: Menu;
  /** 캐릭터 고르기: who 0 = 내 캐릭터, 1 = 상대. 고르면 다음 메뉴로 */
  const pick = (who: 0 | 1, title: string): Menu =>
    new Menu([
      ...ROSTER.map(([id, name]): MenuItem => ({
        label: name,
        act: () => {
          picked[who] = id;
          menu = who === 0 ? (mode === 'vs' ? rivalVs : rivalPractice) : mode === 'vs' ? vs : practice;
        },
      })),
      { label: 'BACK', act: () => { menu = main; } },
    ], title);
  const fighter = pick(0, 'YOUR FIGHTER');
  const rivalVs = pick(1, 'CPU FIGHTER');
  const rivalPractice = pick(1, 'DUMMY FIGHTER');
  const picking = (m: Menu) => m === fighter || m === rivalVs || m === rivalPractice;
  const main: Menu = new Menu([
    { label: 'VERSUS CPU', act: () => { mode = 'vs'; menu = fighter; } },
    { label: 'PRACTICE', act: () => { mode = 'practice'; menu = fighter; } },
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
    { label: 'SOUND', act: () => { menu = sound; } },
    { label: 'CONTROLS', act: () => { showControls = true; } },
    { label: 'MOTION VIEWER', act: () => app.goto('viewer') },
    { label: 'BACK', act: () => { menu = main; } },
  ], 'OPTIONS');
  /** 음량 한 줄: 막대 10칸. J·누르기 대신 고르기를 하면 한 단계 올리고 끝에서 0으로 */
  const volume = (label: string, name: VolumeName): MenuItem => ({
    label,
    bar: () => [audioSettings()[name], VOLUME_MAX],
    adjust: (d) => stepVolume(name, d),
    act: () => stepVolume(name, 1, true),
  });
  const sound: Menu = new Menu([
    volume('MASTER', 'master'),
    volume('MUSIC ', 'music'),
    volume('SFX   ', 'sfx'),
    // 아이폰 무음 스위치: 따름(무음이면 소리 안 남, 기본) / 무시(무음이어도 남). 그 기능이 있는 브라우저(아이폰·아이패드 사파리)에서만 보인다
    ...(silentSwitchSupported()
      ? [{
          label: 'MUTE SWITCH',
          value: () => (audioSettings().silent === 'ignore' ? 'IGNORE' : 'FOLLOW'),
          act: () => setAudioSettings({ silent: audioSettings().silent === 'ignore' ? 'follow' : 'ignore' }),
        } satisfies MenuItem]
      : []),
    { label: 'SOUND TEST', act: () => app.goto('sound') },
    { label: 'BACK', act: () => { menu = options; } },
  ], 'SOUND');
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
      if (menu.handle(input, taps) === 'back' && menu !== main) menu = menu === sound ? options : main;
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
      // 캐릭터를 고르는 중: 고른 줄의 캐릭터가 왼쪽(내 캐릭터)·오른쪽(상대)에서 대기 동작
      if (picking(menu)) {
        const it = ROSTER[menu.sel];
        if (it) drawFighter(ctx, it[0], menu === fighter ? 0 : 1, tick);
      }
      if (menu === sound) hintBar(ctx, touch.available ? 'TAP LEFT / RIGHT HALF: - / +' : 'W S: MOVE   A D: - / +   K: BACK', SCREEN_H - 14);
      else hintBar(ctx, touch.available ? 'TAP TO SELECT' : 'W S: MOVE   J: SELECT   K: BACK   OR TAP', SCREEN_H - 14);
    },
  };
}

/** 캐릭터 미리보기를 그리는 캔버스 (가장 큰 칸) */
const previewCanvas = document.createElement('canvas');
previewCanvas.width = 128;
previewCanvas.height = 96;
/**
 * 고르는 중인 캐릭터의 대기 동작 (2배, 정수배 확대). who 0 = 내 캐릭터(메뉴 왼쪽, 오른쪽을 봄), 1 = 상대(메뉴 오른쪽, 왼쪽을 봄).
 * 발밑을 판 아래 같은 줄에 맞춘다
 */
function drawFighter(ctx: CanvasRenderingContext2D, c: CharId, who: 0 | 1, tick: number): void {
  const name = motionOf(c, 'idle');
  const m = MOTIONS.find((x) => x.name === name);
  if (!m) return;
  const total = m.dur.reduce((a, b) => a + b, 0);
  let t = tick % total;
  let frame = 0;
  while (t >= m.dur[frame]!) t -= m.dur[frame++]!;
  const cell = cellOf(m);
  const p = previewCanvas.getContext('2d')!;
  p.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  m.draw(p, frame, 0, 0, { skin: isSkin(c) ? c : 'base', look: who === 0 ? 'p1' : 'p2', flip: who === 1 });
  ctx.imageSmoothingEnabled = false;
  const S = 2;
  const footX = who === 0 ? SCREEN_W / 2 - 140 : SCREEN_W / 2 + 140;
  const footY = 214;
  ctx.drawImage(previewCanvas, 0, 0, cell.w, cell.h, footX - (who === 1 ? cell.w - cell.fx : cell.fx) * S, footY - cell.fy * S, cell.w * S, cell.h * S);
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
