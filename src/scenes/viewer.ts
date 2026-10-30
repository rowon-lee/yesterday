import { hitBox, hurtBox, type Box } from '../anim/boxes';
import { DEFAULT_CELL, FOOT_X, FOOT_Y } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import type { LookName } from '../anim/skeleton';
import { drawText } from '../render/font';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import type { Scene } from './scene';

/** 재생 속도. 1틱에 4분의 몇 틱만큼 진행하는지 (정수로 세어 오차가 없게). */
const SPEEDS = [4, 2, 1] as const;
const SPEED_LABEL: Record<number, string> = { 4: '1배속', 2: '0.5배속', 1: '0.25배속' };

const ZOOM = 2;
const VIEW_X = 36;
const VIEW_Y = 26;
const PANEL_X = 210;

/**
 * 개발용 모션 뷰어 (?scene=viewer).
 * 키보드: ↑↓ 동작, ←→ 한 프레임, Space 재생/정지, S 속도, H 판정 상자, C 색, F 좌우
 */
export function viewerScene(): Scene {
  const v = {
    motion: 0,
    frame: 0,
    /** 이 프레임에서 지난 시간 (1/4틱 단위) */
    sub: 0,
    playing: true,
    speed: 4 as number,
    boxes: true,
    look: 'p1' as LookName,
    flip: false,
  };
  const cur = () => MOTIONS[v.motion];

  // ---- 조작 줄 (휴대폰에서도 누를 수 있게 DOM 버튼) ----
  const ui = document.createElement('div');
  ui.className = 'ui';
  ui.innerHTML = `
    <button data-a="prevM" aria-label="이전 동작">◀</button>
    <select data-a="select" aria-label="동작">${MOTIONS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('')}</select>
    <button data-a="nextM" aria-label="다음 동작">▶</button>
    <button data-a="back">◀ 1프레임</button>
    <button data-a="play"></button>
    <button data-a="fwd">1프레임 ▶</button>
    <button data-a="speed"></button>
    <button data-a="boxes">판정</button>
    <button data-a="look"></button>
    <button data-a="flip"></button>`;
  document.body.appendChild(ui);
  const el = (a: string) => ui.querySelector(`[data-a="${a}"]`) as HTMLElement;
  const select = el('select') as HTMLSelectElement;

  const setMotion = (i: number) => {
    v.motion = (i + MOTIONS.length) % MOTIONS.length;
    v.frame = 0;
    v.sub = 0;
  };
  const step = (d: number) => {
    const n = cur().dur.length;
    v.playing = false;
    v.frame = (v.frame + d + n) % n;
    v.sub = 0;
  };
  const actions: Record<string, () => void> = {
    prevM: () => setMotion(v.motion - 1),
    nextM: () => setMotion(v.motion + 1),
    back: () => step(-1),
    fwd: () => step(1),
    play: () => (v.playing = !v.playing),
    speed: () => (v.speed = SPEEDS[(SPEEDS.indexOf(v.speed as 4) + 1) % SPEEDS.length]),
    boxes: () => (v.boxes = !v.boxes),
    look: () => (v.look = v.look === 'p1' ? 'p2' : 'p1'),
    flip: () => (v.flip = !v.flip),
  };
  const refreshUi = () => {
    select.value = String(v.motion);
    el('play').textContent = v.playing ? '정지' : '재생';
    el('speed').textContent = SPEED_LABEL[v.speed];
    el('boxes').classList.toggle('on', v.boxes);
    el('look').textContent = v.look === 'p1' ? '색 1P' : '색 2P';
    el('flip').textContent = v.flip ? '← 왼쪽' : '오른쪽 →';
  };
  ui.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a && actions[a]) {
      actions[a]();
      refreshUi();
    }
  });
  select.addEventListener('change', () => {
    setMotion(Number(select.value));
    select.blur(); // 화살표 키가 선택 상자로 가지 않게
    refreshUi();
  });
  refreshUi();

  const KEYS: Record<string, string> = {
    ArrowUp: 'prevM', ArrowDown: 'nextM', ArrowLeft: 'back', ArrowRight: 'fwd',
    Space: 'play', KeyS: 'speed', KeyH: 'boxes', KeyC: 'look', KeyF: 'flip',
  };

  return {
    tick(input) {
      let changed = false;
      for (const code of input.pressed) {
        const a = KEYS[code];
        if (a) {
          actions[a]();
          changed = true;
        }
      }
      if (changed) refreshUi();
      if (!v.playing) return;
      const m = cur();
      v.sub += v.speed;
      while (v.sub >= m.dur[v.frame] * 4) {
        v.sub -= m.dur[v.frame] * 4;
        v.frame = (v.frame + 1) % m.dur.length;
      }
    },

    render(ctx) {
      const m = cur();
      const cell = m.cell ?? DEFAULT_CELL;
      ctx.fillStyle = COLORS.night;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

      // 큰 보기: 칸 바탕(격자), 바닥선, 캐릭터 2배
      const size = cell * ZOOM;
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(VIEW_X, VIEW_Y, size, size);
      ctx.fillStyle = COLORS.panelLight;
      for (let y = 0; y < size; y += 16) {
        for (let x = ((y / 16) % 2) * 16; x < size; x += 32) ctx.fillRect(VIEW_X + x, VIEW_Y + y, 16, 16);
      }
      ctx.fillStyle = COLORS.gridLight;
      ctx.fillRect(VIEW_X, VIEW_Y + (FOOT_Y + 1) * ZOOM, size, ZOOM);
      ctx.drawImage(sprite(m, v.frame, v.look, v.flip), VIEW_X, VIEW_Y, size, size);

      if (v.boxes && m.joints) {
        const j = m.joints[v.frame];
        strokeBox(ctx, hurtBox(j), COLORS.green, v.flip);
        const hb = hitBox(j, v.frame, m.hit);
        if (hb) strokeBox(ctx, hb, COLORS.red, v.flip);
      }

      // 오른쪽 정보
      const total = m.dur.reduce((a, b) => a + b, 0);
      const elapsed = m.dur.slice(0, v.frame).reduce((a, b) => a + b, 0) + Math.floor(v.sub / 4);
      const lines: Array<[string, string]> = [
        [m.name.toUpperCase(), COLORS.gold],
        ['', ''],
        [`FRAME ${v.frame + 1}/${m.dur.length}`, COLORS.white],
        [`DUR ${m.dur[v.frame]}T`, COLORS.white],
        [`TICK ${elapsed}/${total}`, COLORS.white],
        [`${(total / 60).toFixed(2)} SEC${m.loop ? ' LOOP' : ''}`, COLORS.white],
        ['', ''],
        [v.playing ? 'PLAY' : 'STOP', v.playing ? COLORS.green : COLORS.red],
        [`SPEED X${SPEED_LABEL[v.speed].replace('배속', '')}`, COLORS.white],
      ];
      lines.forEach(([t, c], i) => t && drawText(ctx, t, PANEL_X, VIEW_Y + i * 8, c));
      if (v.boxes) {
        ctx.fillStyle = COLORS.green;
        ctx.fillRect(PANEL_X, VIEW_Y + 82, 5, 5);
        drawText(ctx, 'HURT', PANEL_X + 8, VIEW_Y + 82, COLORS.white);
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(PANEL_X, VIEW_Y + 90, 5, 5);
        drawText(ctx, 'HIT', PANEL_X + 8, VIEW_Y + 90, COLORS.white);
      }

      // 아래 시간 줄: 프레임마다 표시 틱만큼 폭, 지금 프레임은 금색
      const barX = 8;
      const barW = SCREEN_W - 16;
      const barY = SCREEN_H - 12;
      let x = barX;
      m.dur.forEach((d, i) => {
        const w = i === m.dur.length - 1 ? barX + barW - x : Math.round((d / total) * barW);
        ctx.fillStyle = i === v.frame ? COLORS.gold : i % 2 ? COLORS.grid : COLORS.panelLight;
        ctx.fillRect(x, barY, w - 1, 6);
        x += w;
      });
      const px = barX + Math.round((elapsed / total) * barW);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(Math.min(px, barX + barW - 1), barY - 2, 1, 10);
    },
  };
}

/** 한 프레임을 칸 크기 캔버스로 (확대해서 붙이기 위해) */
const spriteCanvas = document.createElement('canvas');
function sprite(m: (typeof MOTIONS)[number], frame: number, look: LookName, flip: boolean) {
  const cell = m.cell ?? DEFAULT_CELL;
  spriteCanvas.width = cell;
  spriteCanvas.height = cell;
  const c = spriteCanvas.getContext('2d')!;
  c.clearRect(0, 0, cell, cell);
  m.draw(c, frame, 0, 0, { look, flip });
  return spriteCanvas;
}

function strokeBox(ctx: CanvasRenderingContext2D, b: Box, color: string, flip: boolean) {
  const x = flip ? -(b.x + b.w) : b.x;
  const left = VIEW_X + (FOOT_X + x) * ZOOM;
  const top = VIEW_Y + (FOOT_Y + b.y) * ZOOM;
  const w = b.w * ZOOM;
  const h = b.h * ZOOM;
  ctx.fillStyle = color;
  ctx.fillRect(left, top, w, 1);
  ctx.fillRect(left, top + h - 1, w, 1);
  ctx.fillRect(left, top, 1, h);
  ctx.fillRect(left + w - 1, top, 1, h);
}
