import { hitBox, hurtBox, type Box } from '../anim/boxes';
import { MOTIONS } from '../anim/motions';
import type { Joints } from '../anim/pose';
import { BASE_STATS } from '../data/characters/base';
import { BASE_MOVES, type MoveData, type MoveId } from '../data/moves/base';
import { px } from './rules';

/** 동작 그림의 프레임별 관절과 시간. 판정은 이 관절 위치로 계산한다. */
export interface MotionFrames {
  name: string;
  /** 프레임별 표시 틱 */
  dur: readonly number[];
  /** 누적 틱: cum[i] = 0..i 프레임 표시 틱 합 */
  cum: readonly number[];
  total: number;
  joints: readonly Joints[];
}

const motionTable = new Map<string, MotionFrames>();
for (const m of MOTIONS) {
  const cum: number[] = [];
  let s = 0;
  for (const d of m.dur) cum.push((s += d));
  motionTable.set(m.name, { name: m.name, dur: m.dur, cum, total: s, joints: m.joints! });
}

export function motionFrames(name: string): MotionFrames {
  const m = motionTable.get(name);
  if (!m) throw new Error(`없는 동작 그림: ${name}`);
  return m;
}

/** 동작 시작 후 t틱째의 프레임 (끝나면 마지막 프레임) */
export function frameAtTick(m: MotionFrames, t: number): number {
  for (let i = 0; i < m.cum.length; i++) if (t < m.cum[i]) return i;
  return m.cum.length - 1;
}

/** 길이가 정해지지 않은 상태(경직 등)는 그림을 상태 길이에 맞춰 늘인다 */
export function frameStretched(m: MotionFrames, t: number, length: number): number {
  const n = m.dur.length;
  return Math.max(0, Math.min(n - 1, Math.floor((t * n) / Math.max(1, length))));
}

/** 기술: 동작 그림의 시간으로 발동·지속·후딜레이를 계산해 둔다. 속도·거리는 1/256px 정수로. */
export interface Move {
  id: MoveId;
  data: MoveData;
  frames: MotionFrames;
  /** 첫 판정 틱, 마지막 판정이 끝나는 틱 */
  activeStart: number;
  activeEnd: number;
  total: number;
  push: number;
  launch?: { vx: number; vy: number };
  step?: { from: number; to: number; speed: number };
}

export const MOVES = {} as Record<MoveId, Move>;
for (const id of Object.keys(BASE_MOVES) as MoveId[]) {
  const data: MoveData = BASE_MOVES[id];
  const frames = motionFrames(data.motion);
  const first = data.active[0];
  const last = data.active[data.active.length - 1];
  MOVES[id] = {
    id,
    data,
    frames,
    activeStart: first === 0 ? 0 : frames.cum[first - 1],
    activeEnd: frames.cum[last],
    total: frames.total,
    push: px(data.push),
    launch: data.launch && { vx: px(data.launch.vx), vy: px(data.launch.vy) },
    step: data.step && { ...data.step, speed: px(data.step.speed) },
  };
}

/** 이 기술의 t틱째 공격 상자 (발밑 기준, 오른쪽 보는 기준). 판정 프레임이 아니면 null */
export function moveHitBox(mv: Move, t: number): Box | null {
  const f = frameAtTick(mv.frames, t);
  if (!mv.data.active.includes(f)) return null;
  const j = mv.frames.joints[f];
  if (!mv.data.limb) {
    // 몸 둘레 전체를 감싸는 판정 (밀쳐내기류)
    const b = hurtBox(j);
    return { x: b.x - 10, y: b.y - 4, w: b.w + 20, h: b.h + 8 };
  }
  return hitBox(j, f, { frames: mv.data.active, limb: mv.data.limb });
}

/** 능력치 (1/256px 정수) */
export const STATS = {
  hp: BASE_STATS.hp,
  runForward: px(BASE_STATS.runForward),
  runBack: px(BASE_STATS.runBack),
  runCycle: px(BASE_STATS.runCycle),
  runBackCycle: px(BASE_STATS.runBackCycle),
  jumpSquat: BASE_STATS.jumpSquat,
  jumpVy: -px(BASE_STATS.jumpVy),
  jumpVx: px(BASE_STATS.jumpVx),
  doubleJumpVy: -px(BASE_STATS.doubleJumpVy),
  chaseJumpVy: -px(BASE_STATS.chaseJumpVy),
  chaseJumpVx: px(BASE_STATS.chaseJumpVx),
  gravity: px(BASE_STATS.gravity),
  maxFall: px(BASE_STATS.maxFall),
  airAccel: px(BASE_STATS.airAccel),
  airMaxVx: px(BASE_STATS.airMaxVx),
  dashTicks: BASE_STATS.dashTicks,
  dashMoveFrom: BASE_STATS.dashMoveFrom,
  dashMoveTo: BASE_STATS.dashMoveTo,
  dashSpeed: px(BASE_STATS.dashSpeed),
  airDashTicks: BASE_STATS.airDashTicks,
  airDashMoveTo: BASE_STATS.airDashMoveTo,
  airDashSpeed: px(BASE_STATS.airDashSpeed),
  landTicks: BASE_STATS.landTicks,
  airAttackLandTicks: BASE_STATS.airAttackLandTicks,
};
