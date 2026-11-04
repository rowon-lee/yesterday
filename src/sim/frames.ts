import type { Box } from '../data/moves/types';
import { BASE_MOTION_SLOTS, CHARACTERS, type CharId, type MotionSlot, type Stats } from '../data/characters';
import { BASE_MOVES, type MoveData, type MoveId } from '../data/moves/base';
import { HURT } from '../data/moves/hurt';
import { MOVE_TIME } from '../data/moves/time';
import type { BoxArr, HitSpan, MoveTime } from '../data/moves/types';
import { px } from './rules';

/*
 * sim의 시간과 판정은 공격 데이터(data/moves/time.ts)와 피격 상자 시간표(data/moves/hurt.ts)에서만 온다 (3-0a(2)).
 * sim은 그림(anim/)을 읽지 않는다: 동작 그림의 프레임 수·표시 틱·관절을 바꿔도 판정·캔슬·몸 이동은 그대로다.
 */

/** 상태 시간표 (피격 상자 시간표 한 장): 구간별 틱과 그 구간의 피격 상자. 구간은 sim의 박자 단위다 (그림 프레임이 아니다) */
export interface Timeline {
  name: string;
  /** 구간별 틱 수 */
  dur: readonly number[];
  /** 누적 틱: cum[i] = 0..i 구간 틱 합 */
  cum: readonly number[];
  total: number;
  /** 구간별 피격 상자 (발밑 기준, 오른쪽 보는 기준) */
  hurt: readonly Box[];
}

/** 틱 구간 시간 (구간별 틱·누적·합). sim 시간표와 렌더의 그림 박자가 같은 고르기 규칙(sim/pose.ts)을 쓴다 */
export interface Timing {
  dur: readonly number[];
  cum: readonly number[];
  total: number;
}

const toBox = (b: BoxArr): Box => ({ x: b[0], y: b[1], w: b[2], h: b[3] });

const timelineTable = new Map<string, Timeline>();
for (const [name, spans] of Object.entries(HURT)) {
  const cum: number[] = [];
  let s = 0;
  for (const sp of spans) cum.push((s += sp[0]));
  timelineTable.set(name, { name, dur: spans.map((sp) => sp[0]), cum, total: s, hurt: spans.map((sp) => ({ x: sp[1], y: sp[2], w: sp[3], h: sp[4] })) });
}

/** 상태 시간표 (동작 이름으로) */
export function timelineOf(name: string): Timeline {
  const m = timelineTable.get(name);
  if (!m) throw new Error(`없는 피격 상자 시간표: ${name}`);
  return m;
}

/** 시작 후 t틱째의 구간 (끝나면 마지막 구간) */
export function frameAtTick(m: { cum: readonly number[] }, t: number): number {
  for (let i = 0; i < m.cum.length; i++) if (t < m.cum[i]) return i;
  return m.cum.length - 1;
}

/**
 * 맞는 동작 (공통 동작 사양서): 구간 수는 그대로 두고 틱만 바꿔 상태 길이(length틱)에 맞춘다.
 * - 기본 길이보다 길면 늘어나는 구간(stretch, 0부터 센 번호)에 남는 틱을 더한다.
 * - 짧으면 늘어나는 구간부터 1틱까지 줄이고, 그래도 길면 회복 쪽(뒤) 구간부터, 그다음 앞쪽 구간을 1틱씩 줄인다
 *   (모든 구간이 한 번은 보이고 마지막 기준 자세로 끝난다).
 * - 구간 수보다도 짧으면 (콤보 보정으로 경직이 줄었을 때) 고르게 건너뛴다.
 * sim(피격 상자 시간표)과 렌더(그림 프레임)가 같이 쓴다. 정수 계산만 쓴다.
 */
export function frameFitted(m: Timing, t: number, length: number, stretch: number): number {
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

/** 길이가 정해지지 않은 상태(경직 등)는 구간을 상태 길이에 맞춰 늘인다 */
export function frameStretched(m: Timing, t: number, length: number): number {
  const n = m.dur.length;
  return Math.max(0, Math.min(n - 1, Math.floor((t * n) / Math.max(1, length))));
}

/** 기술: 공격 데이터(시간표)의 틱으로 발동·지속·회복과 캔슬을 정해 둔다. 속도·거리는 1/256px 정수로. */
export interface Move {
  id: MoveId;
  data: MoveData;
  /** 시간·판정·몸 이동 (data/moves/time.ts) */
  time: MoveTime;
  /** 첫 판정 틱, 마지막 판정이 끝나는 틱 (판정 없는 기술은 NaN: 어떤 비교도 거짓) */
  activeStart: number;
  activeEnd: number;
  /** 캔슬 구간: 연타 예약을 받기 시작하는 틱, 다음 타·차지로 넘어가는 틱 (판정 없는 기술은 NaN) */
  chainFrom: number;
  chainAt: number;
  total: number;
  push: number;
  launch?: { vx: number; vy: number };
  /** 내디딤 [from, to) 틱 */
  step?: { from: number; to: number; speed: number };
  /** 벽 박차기 [from, to) 틱 */
  dive?: { from: number; to: number; vx: number; vy: number };
  rebound?: { vx: number; vy: number };
  /** 몸 이동: 틱 t(기술 시작 뒤 1부터)에 앞으로 움직이는 거리 (1/256px, 길이 total + 1, [0]은 0) */
  advance?: readonly number[];
  /** 차지 단계별 몸 이동 (단계 데이터에 advance가 있을 때만, 없는 단계는 undefined → advance) */
  levelAdvance?: ReadonlyArray<readonly number[] | undefined>;
  /** 순간이동: 그 틱, 최대 거리·멈추는 간격 (1/256px) */
  blink?: { tick: number; dist: number; gap: number };
}

/** 기술 하나를 만든다: 기술 수치(data)와 시간표(time) */
function buildMove(id: MoveId, data: MoveData, time: MoveTime): Move {
  const h = time.hits;
  const start = h.length ? h[0]!.t[0] : NaN;
  const end = h.length ? h[h.length - 1]!.t[1] : NaN;
  return {
    id,
    data,
    time,
    activeStart: start,
    activeEnd: end,
    chainFrom: time.chain ? time.chain[0] : NaN,
    chainAt: time.chain ? time.chain[1] : NaN,
    total: time.total,
    push: px(data.push),
    launch: data.launch && { vx: px(data.launch.vx), vy: px(data.launch.vy) },
    step: time.step && { ...time.step, speed: px(time.step.speed) },
    dive: time.dive && { ...time.dive, vx: px(time.dive.vx), vy: px(time.dive.vy) },
    rebound: data.rebound && { vx: px(data.rebound.vx), vy: px(data.rebound.vy) },
    blink: time.blink && { tick: time.blink.at, dist: px(time.blink.dist), gap: px(time.blink.gap) },
    advance: time.advance && advanceTicks(time.advance),
    levelAdvance: time.levelAdvance?.map((a) => (a ? advanceTicks(a) : undefined)),
  };
}

/** 지금 쓰는 몸 이동 (차지는 모은 단계의 것, 1단계 미만이면 1단계) */
export function advanceOf(mv: Move, chargeLv: number): readonly number[] | undefined {
  return mv.levelAdvance?.[Math.max(0, Math.min(mv.levelAdvance.length, chargeLv) - 1)] ?? mv.advance;
}

/**
 * 몸 이동 구간 [틱 수, px] → 틱별 이동(1/256px 정수). 구간마다 그 틱 동안 고르게 나눠 움직인다.
 * 누적 거리를 정수로 자르고 그 차이를 쓰므로 합은 언제나 구간 이동의 합과 같다 (결정론)
 */
function advanceTicks(runs: ReadonlyArray<readonly [number, number]>): number[] {
  const out = [0];
  let before = 0;
  let prev = 0;
  for (const [d, a] of runs) {
    const p = px(a);
    for (let i = 1; i <= d; i++) {
      const total = before + Math.trunc((p * i) / d);
      out.push(total - prev);
      prev = total;
    }
    before += p;
  }
  return out;
}

/** 캐릭터별 기술 표: 기본 스틱맨 기술 수치에 캐릭터가 바꾼 것(피해·경직·밀림…)을 덮어쓰고, 시간·판정은 그 캐릭터의 시간표 */
const MOVE_SETS = Object.fromEntries(
  (Object.keys(CHARACTERS) as CharId[]).map((c) => {
    const own = (CHARACTERS[c] as { moves?: Partial<Record<MoveId, Partial<MoveData>>> }).moves ?? {};
    const set = {} as Record<MoveId, Move>;
    for (const id of Object.keys(BASE_MOVES) as MoveId[]) {
      const data = { ...BASE_MOVES[id], ...own[id] } as MoveData;
      const time = MOVE_TIME[c]?.[id];
      if (!time) throw new Error(`시간표 없음: ${c}.${id}`);
      set[id] = buildMove(id, data, time);
    }
    return [c, set];
  }),
) as Record<CharId, Record<MoveId, Move>>;

/** 이 캐릭터의 기술 표 (판정·시간은 그 캐릭터의 시간표로) */
export function movesOf(c: CharId): Record<MoveId, Move> {
  return MOVE_SETS[c];
}
/** 기본 스틱맨 기술 표 (기술 수치만 볼 때: 기력·연출·히트스톱처럼 캐릭터와 상관없는 값) */
export const MOVES = MOVE_SETS.base;

/** t틱째 판정 구간 (없으면 null) */
function spanAt(hits: readonly HitSpan[], t: number): HitSpan | null {
  for (const h of hits) if (t >= h.t[0] && t < h.t[1]) return h;
  return null;
}

/**
 * 이 기술의 t틱째 공격 상자 (발밑 기준, 오른쪽 보는 기준). 판정 구간이 아니면 null.
 * 차지는 모은 단계의 상자 (시간표의 levels, 없으면 box)
 */
export function moveHitBox(mv: Move, t: number, chargeLv = 0): Box | null {
  const h = spanAt(mv.time.hits, t);
  if (!h) return null;
  const b = chargeLv > 0 && h.levels ? h.levels[Math.min(h.levels.length, chargeLv) - 1] : h.box;
  return b ? toBox(b) : null;
}

/** 이 기술의 t틱째 판정 선 (발밑 기준 px, 오른쪽 보는 기준). 판정 선이 없는 구간이면 null */
export function moveHitLine(mv: Move, t: number): ReadonlyArray<readonly [number, number]> | null {
  return spanAt(mv.time.hits, t)?.line ?? null;
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
