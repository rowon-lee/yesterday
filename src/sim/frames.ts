import { hitBox, hurtBox, type Box } from '../anim/boxes';
import { MOTIONS } from '../anim/motions';
import type { Joints } from '../anim/pose';
import { BASE_MOTION_SLOTS, CHARACTERS, type CharId, type MotionSlot, type Stats } from '../data/characters';
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

/**
 * 맞는 동작 (공통 동작 사양서): 프레임 수는 그대로 두고 표시 틱만 바꿔 상태 길이(length틱)에 맞춘다.
 * - 기본 길이보다 길면 늘어나는 프레임(stretch, 0부터 센 번호)에 남는 틱을 더한다.
 * - 짧으면 늘어나는 프레임부터 1틱까지 줄이고, 그래도 길면 회복 쪽(뒤) 프레임부터, 그다음 앞쪽 프레임을 1틱씩 줄인다
 *   (모든 프레임이 한 번은 보이고 마지막 기준 자세로 끝난다).
 * - 프레임 수보다도 짧으면 (콤보 보정으로 경직이 줄었을 때) 고르게 건너뛴다.
 * 판정(관절 위치)도 이 프레임으로 계산하므로 정수 계산만 쓴다.
 */
export function frameFitted(m: MotionFrames, t: number, length: number, stretch: number): number {
  const n = m.dur.length;
  const len = Math.max(1, length);
  if (len < n) return Math.min(n - 1, Math.floor((t * n) / len));
  const dur = m.dur.slice();
  if (len >= m.total) dur[stretch] += len - m.total;
  else {
    let cut = m.total - len;
    const order = [stretch];
    for (let i = n - 2; i > stretch; i--) order.push(i);
    for (let i = stretch - 1; i >= 1; i--) order.push(i);
    order.push(n - 1, 0);
    for (const i of order) {
      if (cut <= 0) break;
      const c = Math.min(cut, dur[i] - 1);
      dur[i] -= c;
      cut -= c;
    }
  }
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += dur[i];
    if (t < acc) return i;
  }
  return n - 1;
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
  dive?: { from: number; to: number; vx: number; vy: number };
  rebound?: { vx: number; vy: number };
}

/** 기술 하나를 만든다: 기술 수치(data)와 그 기술을 그리는 동작 그림(motion) */
function buildMove(id: MoveId, data: MoveData, motion: string): Move {
  const frames = motionFrames(motion);
  const first = data.active[0];
  const last = data.active[data.active.length - 1];
  return {
    id,
    data,
    frames,
    activeStart: first === 0 ? 0 : frames.cum[first - 1],
    activeEnd: frames.cum[last],
    total: frames.total,
    push: px(data.push),
    launch: data.launch && { vx: px(data.launch.vx), vy: px(data.launch.vy) },
    step: data.step && { ...data.step, speed: px(data.step.speed) },
    dive: data.dive && { ...data.dive, vx: px(data.dive.vx), vy: px(data.dive.vy) },
    rebound: data.rebound && { vx: px(data.rebound.vx), vy: px(data.rebound.vy) },
  };
}

/** 캐릭터별 기술 표: 기본 스틱맨 기술에 캐릭터가 바꾼 것(그림·판정·수치)을 덮어쓴다 */
const MOVE_SETS = Object.fromEntries(
  (Object.keys(CHARACTERS) as CharId[]).map((c) => {
    const own = (CHARACTERS[c] as { moves?: Partial<Record<MoveId, Partial<MoveData>>> }).moves ?? {};
    const set = {} as Record<MoveId, Move>;
    for (const id of Object.keys(BASE_MOVES) as MoveId[]) {
      const data = { ...BASE_MOVES[id], ...own[id] } as MoveData;
      set[id] = buildMove(id, data, data.motion);
    }
    return [c, set];
  }),
) as Record<CharId, Record<MoveId, Move>>;

/** 이 캐릭터의 기술 표 (판정·시간은 그 캐릭터 그림의 프레임으로) */
export function movesOf(c: CharId): Record<MoveId, Move> {
  return MOVE_SETS[c];
}
/** 기본 스틱맨 기술 표 (기술 수치만 볼 때: 기력·연출·히트스톱처럼 캐릭터와 상관없는 값) */
export const MOVES = MOVE_SETS.base;

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

/** 능력치를 sim 단위로: 거리·속도·가속은 1/256px 정수, 시간은 틱 */
function simStats(b: Stats) {
  return {
    hp: b.hp,
    runForward: px(b.runForward),
    runBack: px(b.runBack),
    runCycle: px(b.runCycle),
    runBackCycle: px(b.runBackCycle),
    jumpSquat: b.jumpSquat,
    jumpVy: -px(b.jumpVy),
    jumpVx: px(b.jumpVx),
    doubleJumpVy: -px(b.doubleJumpVy),
    chaseJumpVy: -px(b.chaseJumpVy),
    chaseJumpVx: px(b.chaseJumpVx),
    gravity: px(b.gravity),
    maxFall: px(b.maxFall),
    airAccel: px(b.airAccel),
    airMaxVx: px(b.airMaxVx),
    dashTicks: b.dashTicks,
    dashMoveFrom: b.dashMoveFrom,
    dashMoveTo: b.dashMoveTo,
    dashSpeed: px(b.dashSpeed),
    airDashTicks: b.airDashTicks,
    airDashMoveTo: b.airDashMoveTo,
    airDashSpeed: px(b.airDashSpeed),
    landTicks: b.landTicks,
    airAttackLandTicks: b.airAttackLandTicks,
    wallSlide: px(b.wallSlide),
    wallSlideAccel: px(b.wallSlideAccel),
    wallJumpVx: px(b.wallJumpVx),
    wallJumpVy: -px(b.wallJumpVy),
    wallRunSpeed: px(b.wallRunSpeed),
    /** 벽 달리기 틱 수 (달려 오르는 높이 ÷ 속도) */
    wallRunTicks: Math.ceil(b.wallRunHeight / b.wallRunSpeed),
  };
}
export type SimStats = ReturnType<typeof simStats>;

const CHAR_STATS = Object.fromEntries(
  (Object.keys(CHARACTERS) as CharId[]).map((c) => [c, simStats(CHARACTERS[c].stats)]),
) as Record<CharId, SimStats>;

/** 캐릭터 목록 (data/characters 순서) */
export const CHAR_IDS = Object.keys(CHARACTERS) as CharId[];
export const isChar = (s: string | null | undefined): s is CharId => !!s && s in CHARACTERS;

/** 이 캐릭터의 능력치 (1/256px 정수) */
export function statsOf(c: CharId): SimStats {
  return CHAR_STATS[c];
}

/** 기본 스틱맨 능력치 (캐릭터와 상관없는 확인 도구용) */
export const STATS = CHAR_STATS.base;

/** 이 캐릭터가 이 자리(상태)에 쓰는 동작 이름. 아직 전용 동작이 없으면 기본 스틱맨 동작 */
export function motionOf(c: CharId, slot: MotionSlot): string {
  return (CHARACTERS[c].motions as Partial<Record<MotionSlot, string>>)[slot] ?? BASE_MOTION_SLOTS[slot];
}
