import type { TickInput } from '../core/input';
import { FOOT_X, FOOT_Y } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import { drawCutin } from '../render/cutin';
import { drawDust, Effects, type Dust } from '../render/effects';
import { FightVfx } from '../render/fightvfx';
import { VfxLayer } from '../render/vfx';
import { Hud } from '../render/hud';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import { drawStage, GROUND_Y, type Cam } from '../render/stage';
import { MAP_H } from '../stage/downtown';
import { drawText, textWidth } from '../render/font';
import {
  boxesOf, cpuInput, createCpu, createState, fighterPose, IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT,
  IN_SKILL_A, IN_SKILL_B, IN_SUPER, IN_UP, RULES, STATS, step, type CpuState, type Fighter, type Mode, type PlayerInput,
  type SimState,
} from '../sim';
import type { LookName } from '../anim/skeleton';
import type { Scene } from './scene';

/**
 * 1P 키보드 키 배치. 방향: 화살표 또는 WASD.
 * 공격 J, 점프 K, 대시 L, 기술 A U, 기술 B I, 필살 O
 */
export const KEYMAP: Record<string, PlayerInput> = {
  ArrowUp: IN_UP, KeyW: IN_UP,
  ArrowDown: IN_DOWN, KeyS: IN_DOWN,
  ArrowLeft: IN_LEFT, KeyA: IN_LEFT,
  ArrowRight: IN_RIGHT, KeyD: IN_RIGHT,
  KeyJ: IN_ATTACK,
  KeyK: IN_JUMP,
  KeyL: IN_DASH,
  KeyU: IN_SKILL_A,
  KeyI: IN_SKILL_B,
  KeyO: IN_SUPER,
};

/** 키보드 스냅샷 → 입력 비트. 한 틱 안에 눌렀다 뗀 버튼도 눌린 것으로 친다. */
export function keyboardToInput(input: TickInput): PlayerInput {
  let bits = 0;
  for (const code of input.held) bits |= KEYMAP[code] ?? 0;
  for (const code of input.pressed) bits |= KEYMAP[code] ?? 0;
  return bits;
}

const motionByName = new Map(MOTIONS.map((m) => [m.name, m]));
/** 캐릭터가 화면 끝에 붙지 않게 두는 여백 (px) */
const CAMERA_MARGIN = 20;
/** 위로 솟은 사람의 발에서 이만큼 위까지 (머리와 여유), 아래 사람의 발에서 이만큼 아래까지 보이게 */
const CAMERA_HEAD = 90;
const CAMERA_FEET = 24;

/**
 * 대련 (연습: 1P 키보드 대 CPU). 주소 옵션:
 *   ?p1=cpu  1P도 CPU (구경·캡처용)
 *   ?p2=idle 상대가 가만히 서 있음 (연습용)
 *   ?boxes=1 판정 상자 표시 (B 키로도 켜고 끔)
 *   ?seed=n  CPU 시드
 */
export function fightScene(): Scene {
  const params = new URLSearchParams(location.search);
  const p1Cpu = params.get('p1') === 'cpu';
  const p2Idle = params.get('p2') === 'idle';
  let seed = Number(params.get('seed') ?? 1) | 0;
  let showBoxes = params.get('boxes') === '1';

  let s: SimState;
  let cpus: [CpuState, CpuState];
  let fx: Effects;
  /** Sprite Fusion 이펙트 층과, 전투 이벤트를 이펙트로 바꾸는 쪽 */
  let vfx: VfxLayer;
  let fightVfx: FightVfx;
  let hud: Hud;
  let cutin: { who: number; text: string; t: number } | null = null;
  /** 카메라: 화면 왼쪽 위의 월드 좌표 (px, 렌더 전용). x가 -1이면 아직 안 정함 */
  let cam: Cam = { x: -1, y: 0 };
  // 렌더 전용: 잔상용 지난 모습, 흙먼지, 직전 상태
  let trails: Snapshot[][] = [[], []];
  let dust: Dust[] = [];
  let prev: Array<{ mode: Mode; air: boolean; step: number }> = [];

  const reset = () => {
    s = createState(seed);
    cpus = [createCpu(seed * 2 + 1), createCpu(seed * 2 + 2)];
    fx = new Effects();
    vfx = new VfxLayer();
    fightVfx = new FightVfx(vfx, fx);
    fightVfx.reset(s);
    hud = new Hud();
    hud.names = p1Cpu ? ['CPU 1', 'CPU 2'] : ['1P', 'CPU'];
    cutin = null;
    cam = { x: -1, y: 0 };
    trails = [[], []];
    dust = [];
    prev = s.fighters.map((f) => ({ mode: f.mode, air: f.y < 0, step: 0 }));
  };
  reset();
  // 확인 도구가 읽는 값
  (window as unknown as { __fight: () => SimState }).__fight = () => s;

  /** 잔상을 남기고, 착지·박차고 뛰는 순간에 흙먼지를 일으킨다 (대시의 잔상·먼지는 Sprite Fusion Dash & Blink) */
  const watchMotion = () => {
    s.fighters.forEach((f, i) => {
      const p = fighterPose(f);
      trails[i].push({ motion: p.motion, frame: p.frame, x: f.x, y: f.y, facing: f.facing, fast: isFast(f) });
      if (trails[i].length > 8) trails[i].shift();
      const was = prev[i];
      const x = f.x / 256;
      const air = f.y < 0;
      if (was.air && !air) dust.push({ x, y: 0, dir: 0, t: 0, life: 14 });
      // 뛰는 중에는 발이 땅을 박찰 때마다 (반 바퀴마다) 뒤로 먼지
      const half = (f.dir > 0 ? STATS.runCycle : STATS.runBackCycle) / 2;
      const stepNo = Math.floor(f.runDist / half);
      if (f.mode === 'run' && stepNo !== was.step) dust.push({ x, y: 0, dir: -f.facing * f.dir, t: 0, life: 10 });
      prev[i] = { mode: f.mode, air, step: stepNo };
    });
    for (const d of dust) d.t++;
    dust = dust.filter((d) => d.t < d.life);
  };

  /**
   * 카메라 (렌더 전용): 두 사람의 가운데를 부드럽게 따라가되 둘 다 화면 안에 있게 한다.
   * 위아래로도 따라간다: 둘 다 땅에 있으면 바닥이 보이게 내려오고, 높이 솟으면 위 사람의 머리가 보이게 올라간다.
   */
  const followCamera = () => {
    const [a, b] = s.fighters;
    const first = cam.x < 0;
    const mid = (a.x + b.x) / 2 / 256;
    const tx = mid - SCREEN_W / 2;
    let x = first ? tx : cam.x + (tx - cam.x) * 0.18;
    const lo = Math.max(a.x, b.x) / 256 - SCREEN_W + CAMERA_MARGIN;
    const hi = Math.min(a.x, b.x) / 256 - CAMERA_MARGIN;
    x = Math.max(lo, Math.min(hi, x));
    x = Math.max(0, Math.min(RULES.STAGE_W - SCREEN_W, x));
    // 세로: 기본은 바닥이 화면 아래쪽에 오는 자리
    const bottom = MAP_H - SCREEN_H;
    const topHead = GROUND_Y + Math.min(a.y, b.y) / 256 - CAMERA_HEAD;
    const lowFeet = GROUND_Y + Math.max(a.y, b.y) / 256 + CAMERA_FEET;
    let ty = Math.min(bottom, topHead);
    // 아래 사람의 발까지 담지 못하면 둘의 가운데를 비춘다
    if (lowFeet - ty > SCREEN_H) ty = (topHead + lowFeet) / 2 - SCREEN_H / 2;
    ty = Math.max(0, Math.min(bottom, ty));
    const y = first ? ty : cam.y + (ty - cam.y) * 0.15;
    cam = { x, y };
  };

  return {
    tick(input) {
      if (input.pressed.has('KeyB')) showBoxes = !showBoxes;
      // 경기가 끝나고 잠시 뒤 아무 버튼이나 누르면 다시 시작
      if (s.phase === 'matchEnd' && s.phaseT > 120 && (p1Cpu || [...input.pressed].some((c) => KEYMAP[c] !== undefined))) {
        seed++;
        reset();
        return;
      }
      const p1 = p1Cpu ? cpuInput(cpus[0], s, 0) : keyboardToInput(input);
      const p2 = p2Idle ? 0 : cpuInput(cpus[1], s, 1);
      step(s, [p1, p2]);
      fx.push(s.events);
      fightVfx.tick(s);
      fx.tick();
      hud.tick(s);
      for (const e of s.events) if (e.type === 'cutin') cutin = { who: e.who, text: e.text ?? '', t: 0 };
      watchMotion();
      followCamera();
      if (cutin) {
        cutin.t++;
        if (s.freeze === 0) cutin = null;
      }
    },

    render(ctx) {
      if (cam.x < 0) followCamera();
      const view: Cam = { x: Math.round(cam.x), y: Math.round(cam.y) };
      const [ox, oy] = fx.offset();
      ctx.save();
      ctx.translate(ox, oy);
      drawStage(ctx, view, s.tick, s.props, s.city);
      const toScreen = (x: number, y: number): [number, number] => [Math.round(x - view.x), Math.round(GROUND_Y + y - view.y)];

      // 그림자 (높이 뜰수록 작아진다)
      for (const f of s.fighters) {
        const [sx, sy] = toScreen(f.x / 256, 0);
        const w = Math.max(4, 14 + Math.round(f.y / 256 / 10));
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(sx - (w >> 1), sy, w, 2);
      }
      drawDust(ctx, dust, toScreen);
      // 빠르게 움직이면 지난 모습 두 개를 잔상으로 (디더링)
      trails.forEach((tr, i) => {
        for (const back of [6, 3]) {
          const g = tr[tr.length - 1 - back];
          if (g && tr[tr.length - 1].fast && g.fast) drawGhost(ctx, g, i === 0 ? 'ghost1' : 'ghost2', toScreen, back === 6);
        }
      });
      vfx.draw(ctx, view, 'back');
      // 무너지는 건물 조각과 먼지 구름은 캐릭터 뒤에 (앞에는 옅은 먼지만)
      fightVfx.debris.drawDust(ctx, view, 'back');
      fightVfx.debris.draw(ctx, view);
      // 맞고 있는 쪽을 뒤에, 공격하는 쪽을 앞에
      const order = [...s.fighters].sort((a, b) => Number(a.mode === 'attack') - Number(b.mode === 'attack'));
      for (const f of order) {
        const i = s.fighters.indexOf(f);
        drawFighter(ctx, f, i, toScreen, s.tick, fightVfx.white(i));
      }
      vfx.draw(ctx, view, 'front');
      fightVfx.debris.drawDust(ctx, view, 'front');
      if (showBoxes) drawBoxes(ctx, s, view);
      ctx.restore();

      // 강한 타격: 화면 번쩍임 (디더링)
      if (fx.flash > 0) {
        ctx.fillStyle = COLORS.white;
        for (let y = 0; y < SCREEN_H; y += 2) for (let x = (y >> 1) & 1; x < SCREEN_W; x += 2) ctx.fillRect(x, y, 1, 1);
      }
      if (cutin) drawCutin(ctx, { ...cutin, length: RULES.SUPER_FREEZE });
      hud.draw(ctx, s);
      if (s.phase === 'matchEnd' && s.phaseT > 120 && !p1Cpu) {
        const t = 'PRESS J';
        if ((s.tick >> 5) % 2 === 0) drawText(ctx, t, Math.floor((SCREEN_W - textWidth(t, 2)) / 2), Math.floor(SCREEN_H * 0.55), COLORS.white, 2);
      }
    },
  };
}

interface Snapshot {
  motion: string;
  frame: number;
  x: number;
  y: number;
  facing: 1 | -1;
  fast: boolean;
}

/** 잔상을 남길 만큼 빠른가: 3px/틱 이상으로 움직일 때 (대시는 Sprite Fusion 잔상이 따로 있어 뺀다) */
function isFast(f: Fighter): boolean {
  return f.mode !== 'dash' && f.mode !== 'airdash' && Math.abs(f.vx) >= 3 * 256;
}

const ghostCanvas = document.createElement('canvas');
ghostCanvas.width = 64;
ghostCanvas.height = 64;
/** 바둑판 무늬 (반투명 대신 디더링) */
const checker = (() => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 64; y++) for (let x = y & 1; x < 64; x += 2) g.fillRect(x, y, 1, 1);
  return c;
})();

function drawGhost(
  ctx: CanvasRenderingContext2D,
  g: Snapshot,
  look: LookName,
  toScreen: (x: number, y: number) => [number, number],
  faint: boolean,
) {
  const m = motionByName.get(g.motion)!;
  const gc = ghostCanvas.getContext('2d')!;
  gc.globalCompositeOperation = 'source-over';
  gc.clearRect(0, 0, 64, 64);
  m.draw(gc, g.frame, 0, 0, { look, flip: g.facing < 0 });
  gc.globalCompositeOperation = 'destination-in';
  gc.drawImage(checker, 0, 0);
  gc.globalCompositeOperation = 'source-over';
  // 더 오래된 잔상은 한 줄 걸러 지워 더 옅게
  if (faint) for (let y = 0; y < 64; y += 2) gc.clearRect(0, y, 64, 1);
  const [sx, sy] = toScreen(g.x / 256, g.y / 256);
  ctx.drawImage(ghostCanvas, sx - FOOT_X, sy - FOOT_Y);
}

/** 맞아서 멈춘 동안(히트스톱) 맞은 쪽이 좌우로 1px씩 떨린다 */
const SHAKEN: ReadonlySet<string> = new Set(['hitstun', 'airhit', 'blockstun', 'crush', 'ko']);

function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  index: number,
  toScreen: (x: number, y: number) => [number, number],
  tick: number,
  white: boolean,
) {
  // 대시 중 순간이동 구간은 깜빡인다
  if ((f.mode === 'dash' || f.mode === 'airdash') && f.invuln > 0 && tick % 2) return;
  const pose = fighterPose(f);
  const m = motionByName.get(pose.motion)!;
  const [sx, sy] = toScreen(f.x / 256, f.y / 256);
  const jitter = f.hitstop > 0 && SHAKEN.has(f.mode) ? (tick % 2 ? 1 : -1) : 0;
  const look = white ? 'flash' : index === 0 ? 'p1' : 'p2';
  m.draw(ctx, pose.frame, sx - FOOT_X + jitter, sy - FOOT_Y, { look, flip: f.facing < 0 });
}

function drawBoxes(ctx: CanvasRenderingContext2D, s: SimState, cam: Cam) {
  const rect = (b: { x0: number; y0: number; x1: number; y1: number }, color: string) => {
    const x = Math.round(b.x0 / 256 - cam.x);
    const y = Math.round(GROUND_Y + b.y0 / 256 - cam.y);
    const w = Math.max(1, Math.round((b.x1 - b.x0) / 256));
    const h = Math.max(1, Math.round((b.y1 - b.y0) / 256));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  };
  for (const f of s.fighters) {
    const b = boxesOf(f);
    if (b.hurt) rect(b.hurt, COLORS.green);
    if (b.hit) rect(b.hit, COLORS.red);
  }
}
