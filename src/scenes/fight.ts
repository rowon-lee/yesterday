import type { TickInput } from '../core/input';
import { FOOT_X, FOOT_Y } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import { drawCutin } from '../render/cutin';
import { drawDust, Effects, type Dust } from '../render/effects';
import { Hud } from '../render/hud';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import { drawStage, GROUND_Y } from '../render/stage';
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
  let hud: Hud;
  let cutin: { who: number; text: string; t: number } | null = null;
  // 렌더 전용: 잔상용 지난 모습, 흙먼지, 직전 상태
  let trails: Snapshot[][] = [[], []];
  let dust: Dust[] = [];
  let prev: Array<{ mode: Mode; air: boolean; step: number }> = [];

  const reset = () => {
    s = createState(seed);
    cpus = [createCpu(seed * 2 + 1), createCpu(seed * 2 + 2)];
    fx = new Effects();
    hud = new Hud();
    hud.names = p1Cpu ? ['CPU 1', 'CPU 2'] : ['1P', 'CPU'];
    cutin = null;
    trails = [[], []];
    dust = [];
    prev = s.fighters.map((f) => ({ mode: f.mode, air: f.y < 0, step: 0 }));
  };
  reset();
  // 확인 도구가 읽는 값
  (window as unknown as { __fight: () => SimState }).__fight = () => s;

  /** 잔상을 남기고, 착지·대시·박차고 뛰는 순간에 흙먼지를 일으킨다 */
  const watchMotion = () => {
    s.fighters.forEach((f, i) => {
      const p = fighterPose(f);
      trails[i].push({ motion: p.motion, frame: p.frame, x: f.x, y: f.y, facing: f.facing, fast: isFast(f) });
      if (trails[i].length > 8) trails[i].shift();
      const was = prev[i];
      const x = f.x / 256;
      const air = f.y < 0;
      if (was.air && !air) dust.push({ x, y: 0, dir: 0, t: 0, life: 14 });
      if (f.mode === 'dash' && was.mode !== 'dash') dust.push({ x, y: 0, dir: -f.facing * f.dir, t: 0, life: 12 });
      // 뛰는 중에는 발이 땅을 박찰 때마다 (반 바퀴마다) 뒤로 먼지
      const half = (f.dir > 0 ? STATS.runCycle : STATS.runBackCycle) / 2;
      const stepNo = Math.floor(f.runDist / half);
      if (f.mode === 'run' && stepNo !== was.step) dust.push({ x, y: 0, dir: -f.facing * f.dir, t: 0, life: 10 });
      prev[i] = { mode: f.mode, air, step: stepNo };
    });
    for (const d of dust) d.t++;
    dust = dust.filter((d) => d.t < d.life);
  };

  const camera = () => {
    const mid = (s.fighters[0].x + s.fighters[1].x) / 2 / 256;
    return Math.max(0, Math.min(RULES.STAGE_W - SCREEN_W, Math.round(mid - SCREEN_W / 2)));
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
      fx.tick();
      hud.tick(s);
      for (const e of s.events) if (e.type === 'cutin') cutin = { who: e.who, text: e.text ?? '', t: 0 };
      watchMotion();
      if (cutin) {
        cutin.t++;
        if (s.freeze === 0) cutin = null;
      }
    },

    render(ctx) {
      const camX = camera();
      const [ox, oy] = fx.offset();
      ctx.save();
      ctx.translate(ox, oy);
      drawStage(ctx, camX);
      const toScreen = (x: number, y: number): [number, number] => [Math.round(x - camX), Math.round(GROUND_Y + y)];

      // 그림자
      for (const f of s.fighters) {
        const [sx] = toScreen(f.x / 256, 0);
        const w = Math.max(6, 14 + Math.round(f.y / 256 / 6));
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(sx - (w >> 1), GROUND_Y, w, 2);
      }
      drawDust(ctx, dust, toScreen);
      // 빠르게 움직이면 지난 모습 두 개를 잔상으로 (디더링)
      trails.forEach((tr, i) => {
        for (const back of [6, 3]) {
          const g = tr[tr.length - 1 - back];
          if (g && tr[tr.length - 1].fast && g.fast) drawGhost(ctx, g, i === 0 ? 'ghost1' : 'ghost2', toScreen, back === 6);
        }
      });
      // 맞고 있는 쪽을 뒤에, 공격하는 쪽을 앞에
      const order = [...s.fighters].sort((a, b) => Number(a.mode === 'attack') - Number(b.mode === 'attack'));
      for (const f of order) drawFighter(ctx, f, s.fighters.indexOf(f), toScreen, s.tick);
      fx.draw(ctx, toScreen);
      if (showBoxes) drawBoxes(ctx, s, camX);
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
        if ((s.tick >> 5) % 2 === 0) drawText(ctx, t, Math.floor((SCREEN_W - textWidth(t, 2)) / 2), 100, COLORS.white, 2);
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

/** 잔상을 남길 만큼 빠른가: 대시, 공중 대시, 3px/틱 이상으로 움직일 때 */
function isFast(f: Fighter): boolean {
  return f.mode === 'dash' || f.mode === 'airdash' || Math.abs(f.vx) >= 3 * 256;
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

function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  index: number,
  toScreen: (x: number, y: number) => [number, number],
  tick: number,
) {
  // 대시 중 순간이동 구간은 깜빡인다
  if ((f.mode === 'dash' || f.mode === 'airdash') && f.invuln > 0 && tick % 2) return;
  const pose = fighterPose(f);
  const m = motionByName.get(pose.motion)!;
  const [sx, sy] = toScreen(f.x / 256, f.y / 256);
  const look = f.flash > 0 && f.flash % 2 === 0 ? 'flash' : index === 0 ? 'p1' : 'p2';
  m.draw(ctx, pose.frame, sx - FOOT_X, sy - FOOT_Y, { look, flip: f.facing < 0 });
}

function drawBoxes(ctx: CanvasRenderingContext2D, s: SimState, camX: number) {
  const rect = (b: { x0: number; y0: number; x1: number; y1: number }, color: string) => {
    const x = Math.round(b.x0 / 256 - camX);
    const y = Math.round(GROUND_Y + b.y0 / 256);
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
