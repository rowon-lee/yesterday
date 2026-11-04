import { MOTIONS } from '../anim/motions';
import type { Joints } from '../anim/pose';
import { HIT_AIR_LOOP_FROM, HIT_STRETCH } from '../data/poses/common';
import { WALL_CLING_LOOP_FROM, WALL_RUN_TOP_FROM } from '../data/poses/wall';
import { pickPose, type Fighter, type Move, type PoseTiming } from '../sim';

/**
 * 렌더 쪽 동작 고르기 (3-0a(2)): sim은 판정을 공격 데이터·피격 상자 시간표로만 계산하고, 그림은 여기서 고른다.
 * 상태 → 동작·프레임 규칙은 sim과 같은 것(sim/pose.ts pickPose)을 쓰고, 박자는 그림 자신의 프레임별 표시 틱(dur)과
 * 그림 쪽 프레임 번호 규칙(data/poses)을 쓴다. 그래서 그림의 프레임 수·표시 틱을 바꿔도 sim은 그대로이고 그림만 따라 바뀐다.
 */

/** 그림 박자와 관절 (렌더 전용) */
export interface AnimFrames {
  name: string;
  dur: readonly number[];
  cum: readonly number[];
  total: number;
  joints: readonly Joints[];
}

const table = new Map<string, AnimFrames>();
for (const m of MOTIONS) {
  const cum: number[] = [];
  let s = 0;
  for (const d of m.dur) cum.push((s += d));
  table.set(m.name, { name: m.name, dur: m.dur, cum, total: s, joints: m.joints! });
}

/** 동작 그림의 박자와 관절 */
export function animOf(name: string): AnimFrames {
  const m = table.get(name);
  if (!m) throw new Error(`없는 동작 그림: ${name}`);
  return m;
}

/** 기술을 그리는 동작 그림 */
export const moveAnim = (mv: Move): AnimFrames => animOf(mv.time.motion);

/** 그림 박자로 고르기: 그림의 표시 틱과 그림 쪽 프레임 번호 규칙 */
const ANIM_TIMING: PoseTiming = {
  timing: animOf,
  rules: { hitAirLoopFrom: HIT_AIR_LOOP_FROM, wallClingLoopFrom: WALL_CLING_LOOP_FROM, wallRunTopFrom: WALL_RUN_TOP_FROM, stretch: HIT_STRETCH },
};

/** 지금 상태에 맞는 그림·프레임과 그 프레임의 관절 (이펙트가 손·발 자리를 따를 때) */
export function fighterPose(f: Fighter): { motion: string; frame: number; joints: Joints } {
  const [motion, frame] = pickPose(f, ANIM_TIMING);
  return { motion, frame, joints: animOf(motion).joints[frame]! };
}

/** 기술 시작부터 t틱 전까지 몸 이동으로 나아간 거리 (px, 공격 데이터 advance 구간을 고르게 나눈 값. 이펙트 자리 맞춤용) */
export function advanceBefore(mv: Move, t: number): number {
  let start = 0;
  let sum = 0;
  for (const [d, a] of mv.time.advance ?? []) {
    sum += (a * Math.max(0, Math.min(d, t - start))) / d;
    start += d;
  }
  return sum;
}

/** 판정 틱(공격 데이터)에 해당하는 그림 프레임들 (첫 판정 틱의 프레임 ~ 마지막 판정 틱의 프레임, 판정이 없으면 빈 배열) */
export function activeFrames(mv: Move): number[] {
  if (!mv.time.hits.length) return [];
  const A = moveAnim(mv);
  const a0 = animFrameAt(A, mv.activeStart);
  const a1 = animFrameAt(A, mv.activeEnd - 1);
  return Array.from({ length: a1 - a0 + 1 }, (_, k) => a0 + k);
}

/** 시작 후 t틱째 그림 프레임 (끝나면 마지막 프레임) */
export function animFrameAt(m: AnimFrames, t: number): number {
  for (let i = 0; i < m.cum.length; i++) if (t < m.cum[i]!) return i;
  return m.cum.length - 1;
}
