import type { Box } from '../anim/boxes';
import { cellOf, type Cell } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import type { LookName } from '../anim/skeleton';
import { isSkin, skinForMotion, SKINS, type SkinId } from '../anim/skins';
import { drawText } from '../render/font';
import { dataBoxesAt } from '../render/hitview';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import type { Scene } from './scene';

/** 재생 속도. 1틱에 4분의 몇 틱만큼 진행하는지 (정수로 세어 오차가 없게). */
const SPEEDS = [4, 2, 1] as const;
const SPEED_LABEL: Record<number, string> = { 4: '1배속', 2: '0.5배속', 1: '0.25배속' };

const ZOOM = 3;
const VIEW_X = 40;
const VIEW_Y = 20;
const PANEL_X = 260;

/**
 * 개발용 모션 뷰어 (?scene=viewer).
 * 주소 ?motion=raiden/jab 으로 처음 동작을 고른다. 키보드: ↑↓ 동작, ←→ 한 프레임, Space 재생/정지, S 속도, H 판정 상자, C 색, F 좌우, K 캐릭터 겉모습 (?skin=raiden)
 * 판정 상자(H)는 공격 데이터 그대로다 (3-0a(2)): 피격 상자는 피격 상자 시간표, 공격 상자·연검 판정 선은 그 동작을 쓰는 기술의 시간표에서
 * 지금 틱(그림이 보인 틱)의 값을 그림 위에 겹친다. 아래 시간 줄의 붉은 띠는 판정 구간. 그림을 다시 깎으면 그림과 판정이 어긋나는지 여기서 본다
 * 캐릭터 전용 동작('raiden/…')은 늘 그 캐릭터 겉모습으로 보인다. K는 기본·공통 동작에 입혀 볼 겉모습을 바꾼다.
 */
export function viewerScene(): Scene {
  // ?motion=raiden/jab 처럼 처음 볼 동작을 주소로 고를 수 있다
  const first = MOTIONS.findIndex((m) => m.name === new URLSearchParams(location.search).get('motion'));
  const v = {
    motion: Math.max(0, first),
    frame: 0,
    /** 이 프레임에서 지난 시간 (1/4틱 단위) */
    sub: 0,
    playing: true,
    speed: 4 as number,
    boxes: true,
    look: 'p1' as LookName,
    flip: false,
    skin: (isSkin(new URLSearchParams(location.search).get('skin')) ? new URLSearchParams(location.search).get('skin') : 'base') as SkinId,
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
    <button data-a="flip"></button>
    <button data-a="skin"></button>`;
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
    skin: () => {
      const ids = Object.keys(SKINS) as SkinId[];
      v.skin = ids[(ids.indexOf(v.skin) + 1) % ids.length];
    },
  };
  const refreshUi = () => {
    select.value = String(v.motion);
    el('play').textContent = v.playing ? '정지' : '재생';
    el('speed').textContent = SPEED_LABEL[v.speed];
    el('boxes').classList.toggle('on', v.boxes);
    el('look').textContent = v.look === 'p1' ? '색 1P' : '색 2P';
    el('flip').textContent = v.flip ? '← 왼쪽' : '오른쪽 →';
    el('skin').textContent = SKINS[v.skin].label;
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
    Space: 'play', KeyS: 'speed', KeyH: 'boxes', KeyC: 'look', KeyF: 'flip', KeyK: 'skin',
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
      const cell = cellOf(m);
      ctx.fillStyle = COLORS.night;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

      // 큰 보기: 칸 바탕(격자), 바닥선, 캐릭터 확대 (보통 칸 3배, 큰 칸 128×96은 2배로 왼쪽에 붙여)
      const view = viewOf(cell);
      const sw = cell.w * view.zoom;
      const sh = cell.h * view.zoom;
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(view.x, VIEW_Y, sw, sh);
      ctx.fillStyle = COLORS.panelLight;
      for (let y = 0; y < sh; y += 16) {
        for (let x = ((y / 16) % 2) * 16; x < sw; x += 32) ctx.fillRect(view.x + x, VIEW_Y + y, Math.min(16, sw - x), Math.min(16, sh - y));
      }
      ctx.fillStyle = COLORS.gridLight;
      ctx.fillRect(view.x, VIEW_Y + (cell.fy + 1) * view.zoom, sw, view.zoom);
      ctx.drawImage(sprite(m, v.frame, v.look, v.flip, skinForMotion(m.name, v.skin)), view.x, VIEW_Y, sw, sh);

      // 오른쪽 정보
      const total = m.dur.reduce((a, b) => a + b, 0);
      const elapsed = m.dur.slice(0, v.frame).reduce((a, b) => a + b, 0) + Math.floor(v.sub / 4);
      // 판정 상자: 공격 데이터 (sim이 쓰는 값)를 지금 틱으로
      const data = dataBoxesAt(m.name, elapsed);
      if (v.boxes) {
        // 칸 밖으로 뻗는 상자(번개 범위 등)는 보기 칸 끝에서 자른다 (오른쪽 글씨를 가리지 않게)
        ctx.save();
        ctx.beginPath();
        ctx.rect(view.x, VIEW_Y, sw, sh);
        ctx.clip();
        if (data.hurt) strokeBox(ctx, data.hurt, COLORS.green, v.flip, cell);
        if (data.hit) strokeBox(ctx, data.hit, COLORS.red, v.flip, cell);
        if (data.line) strokeLine(ctx, data.line, COLORS.gold, v.flip, cell);
        ctx.restore();
      }
      const lines: Array<[string, string]> = [
        [m.name.toUpperCase(), COLORS.gold],
        ['', ''],
        [`FRAME ${v.frame + 1}/${m.dur.length}`, COLORS.white],
        [`DUR ${m.dur[v.frame]}T`, COLORS.white],
        [`TICK ${elapsed}/${total}`, COLORS.white],
        [`${(total / 60).toFixed(2)} SEC${m.loop ? ' LOOP' : ''}`, COLORS.white],
        [data.move ? `MOVE ${data.move.toUpperCase()}` : '', COLORS.white],
        [data.spans.length ? `HIT ${data.spans.map((s) => `${s[0]}-${s[1]}`).join(' ')}T` : '', COLORS.red],
        ['', ''],
        [v.playing ? 'PLAY' : 'STOP', v.playing ? COLORS.green : COLORS.red],
        [`SPEED X${SPEED_LABEL[v.speed].replace('배속', '')}`, COLORS.white],
      ];
      lines.forEach(([t, c], i) => t && drawText(ctx, t, PANEL_X, VIEW_Y + i * 8, c));
      if (v.boxes) {
        ctx.fillStyle = COLORS.green;
        ctx.fillRect(PANEL_X, VIEW_Y + 98, 5, 5);
        drawText(ctx, 'HURT DATA', PANEL_X + 8, VIEW_Y + 98, COLORS.white);
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(PANEL_X, VIEW_Y + 106, 5, 5);
        drawText(ctx, 'HIT DATA', PANEL_X + 8, VIEW_Y + 106, COLORS.white);
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
      // 판정 구간 (공격 데이터 틱): 시간 줄 아래 붉은 띠
      ctx.fillStyle = COLORS.red;
      for (const [a, b] of data.spans) {
        const x0 = barX + Math.round((a / total) * barW);
        const x1 = barX + Math.round((Math.min(b, total) / total) * barW);
        ctx.fillRect(x0, barY + 7, Math.max(1, x1 - x0), 2);
      }
      const px = barX + Math.round((elapsed / total) * barW);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(Math.min(px, barX + barW - 1), barY - 2, 1, 10);
    },
  };
}

/** 한 프레임을 칸 크기 캔버스로 (확대해서 붙이기 위해) */
const spriteCanvas = document.createElement('canvas');
function sprite(m: (typeof MOTIONS)[number], frame: number, look: LookName, flip: boolean, skin: SkinId = 'base') {
  const cell = cellOf(m);
  spriteCanvas.width = cell.w;
  spriteCanvas.height = cell.h;
  const c = spriteCanvas.getContext('2d')!;
  c.clearRect(0, 0, cell.w, cell.h);
  m.draw(c, frame, 0, 0, { look, flip, skin });
  return spriteCanvas;
}

/** 큰 보기 자리와 배율: 보통 칸은 3배, 큰 칸은 2배 (오른쪽 정보 칸과 겹치지 않게 왼쪽에 붙인다) */
function viewOf(cell: Cell): { x: number; zoom: number } {
  return cell.w > 64 ? { x: 2, zoom: 2 } : { x: VIEW_X, zoom: ZOOM };
}

/** 판정 선 (점을 잇는 1px 선, 확대 배율로) */
function strokeLine(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>, color: string, flip: boolean, cell: Cell) {
  const view = viewOf(cell);
  ctx.fillStyle = color;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1]!;
    const [bx, by] = pts[k]!;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1) * view.zoom;
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const y = ay + ((by - ay) * i) / n;
      ctx.fillRect(view.x + (cell.fx + (flip ? -x : x)) * view.zoom, VIEW_Y + (cell.fy + y) * view.zoom, 1, 1);
    }
  }
}

function strokeBox(ctx: CanvasRenderingContext2D, b: Box, color: string, flip: boolean, cell: Cell) {
  const view = viewOf(cell);
  const x = flip ? -(b.x + b.w) : b.x;
  const left = view.x + (cell.fx + x) * view.zoom;
  const top = VIEW_Y + (cell.fy + b.y) * view.zoom;
  const w = b.w * view.zoom;
  const h = b.h * view.zoom;
  ctx.fillStyle = color;
  ctx.fillRect(left, top, w, 1);
  ctx.fillRect(left, top + h - 1, w, 1);
  ctx.fillRect(left, top, 1, h);
  ctx.fillRect(left + w - 1, top, 1, h);
}
