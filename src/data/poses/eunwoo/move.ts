import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { E, E_STANCE } from './stance';

/*
 * 백은우 이동 (캐릭터 기획서 '움직임': 사고 현장을 뛰어다니던 의사의 빠르고 가벼운 걸음, 매우 유연해 동작이 크고 부드럽다,
 * 가운 자락이 크게 휘날린다). 라이덴의 바운스 스텝(두 발을 같이 띄움)과 달리 다리를 번갈아 가볍게 뛴다.
 */

// ---- 대기: 숨을 쉬듯 무게를 앞뒤로 천천히 옮기고, 연검을 쥔 손이 느슨하게 8자를 그린다 (라이덴의 통통 튀는 바운스와 다르게 흐른다) ----
/** 무게를 앞발로: 몸이 조금 숙고 칼끝이 앞으로 떠오른다 */
const ID_FWD = E({ hx: 1.5, hy: -21, tl: 10, hd: 0, aFx: 13, aFy: 3, aBx: -5, aBy: 13 });
/** 숨을 들이쉬며 솟는다: 칼끝이 아래로 늘어지며 휘감긴다 */
const ID_RISE = E({ hx: 0.5, hy: -22.5, tl: 5, hd: 3, aFx: 10.5, aFy: 7.5, aBx: -3, aBy: 15 });
/** 무게를 뒷발로: 몸을 세우고 고개를 살짝 기울인다 */
const ID_BACK = E({ hx: -1.5, hy: -21, tl: 2, hd: 5, aFx: 10, aFy: 4, aBx: -5.5, aBy: 13.5 });

/** 대기: 앞으로 실림 → 솟음 → 뒤로 실림 → 기본자세. 14프레임 × 4틱 = 56틱 (약 1초에 한 번 숨 쉬듯) */
export const EUNWOO_IDLE: MotionData = {
  name: 'eunwoo/idle',
  label: '백은우 대기',
  loop: true,
  dur: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 3.5, pose: ID_FWD },
    { at: 7, pose: ID_RISE },
    { at: 10.5, pose: ID_BACK },
    { at: 14, pose: E_STANCE },
  ],
};

// ---- 앞 걷기·뒤 걷기: 다리를 번갈아 가볍게 뛴다. 프레임은 움직인 거리로 넘긴다 (sim: runCycle) ----
/** 앞 걷기 한 바퀴(두 걸음) 거리 (px) = 은우 runCycle. 한 걸음 34px */
export const E_RUN_CYCLE = 68;
/** 뒤 걷기 한 바퀴(두 걸음) 거리 (px) = runBackCycle. 한 걸음 22px */
export const E_RUN_BACK_CYCLE = 44;
const N = 14;
const TAU = Math.PI * 2;
const ease = (s: number) => s * s * (3 - 2 * s);

/**
 * 한 다리의 발 자리 (몸 기준): 바닥에 닿아 있는 동안(q < c)은 몸이 움직인 만큼 발이 반대로 가서 미끄러지지 않는다.
 * 떠 있는 동안은 뒤꿈치를 차올렸다가(뒤쪽에서 높이) 다음 디딜 자리로 뻗는다.
 * dir 1: 앞으로 달림 (닿은 발이 뒤로 감), -1: 뒤로 물러남 (닿은 발이 앞으로 감)
 */
function foot(q: number, c: number, cycle: number, from: number, lift: number, dir: 1 | -1): [number, number] {
  const run = c * cycle;
  const to = from - dir * run;
  if (q < c) return [from - dir * q * cycle, 0];
  const s = (q - c) / (1 - c);
  // 앞으로 달릴 때는 뒤꿈치를 먼저 높이 차올린다 (발이 뒤에 남은 채 들림)
  const lag = dir > 0 ? ease(Math.max(0, (s - 0.15) / 0.85)) : ease(s);
  return [to + (from - to) * lag, -lift * Math.pow(Math.sin(Math.PI * s), 0.8)];
}

/** 앞 걷기 i번째 프레임: 몸을 앞으로 숙이고 가볍게 뛴다. 연검을 쥔 앞팔은 작게, 뒷팔은 크게 흔든다 */
function runFrame(i: number): Pose {
  const p = i / N;
  const c = 0.32;
  const [fx, fy] = foot(p % 1, c, E_RUN_CYCLE, 12, 10, 1);
  const [bx, by] = foot((p + 0.5) % 1, c, E_RUN_CYCLE, 12, 10, 1);
  const bob = Math.cos(2 * TAU * (p - c / 2));
  const sw = Math.cos(TAU * p);
  return {
    hx: 1, hy: -21.3 + 0.9 * bob, tl: 17 + 2 * bob, hd: -6,
    aFx: 7 - 6 * sw, aFy: 6 + 2 * sw, aBx: -2 + 10 * sw, aBy: 7 - 4 * sw,
    lFx: fx, lFy: fy, lBx: bx, lBy: by,
  };
}

/** 뒤 걷기 i번째 프레임: 몸을 세우고 연검 끝을 상대 쪽으로 겨눈 채 잰걸음으로 물러난다. 뒷팔은 뒤로 벌려 균형 */
function backFrame(i: number): Pose {
  const p = i / N;
  const c = 0.36;
  const [fx, fy] = foot(p % 1, c, E_RUN_BACK_CYCLE, -6, 6, -1);
  const [bx, by] = foot((p + 0.5) % 1, c, E_RUN_BACK_CYCLE, -6, 6, -1);
  const bob = Math.cos(2 * TAU * (p - c / 2));
  const sw = Math.cos(TAU * p);
  return {
    hx: -0.5, hy: -21.5 + 0.7 * bob, tl: -1 + bob, hd: 4,
    aFx: 13 + sw, aFy: 0.5 + sw, aBx: -7 - 2 * sw, aBy: 13 + sw,
    lFx: fx + 4, lFy: fy, lBx: bx - 2, lBy: by,
  };
}

/** 앞 걷기 (sim 자리 run_f): 14프레임, 한 바퀴 68px (4.8px/틱이면 약 1틱에 한 프레임) */
export const EUNWOO_WALK_F: MotionData = {
  name: 'eunwoo/walk_f',
  label: '백은우 앞 걷기',
  loop: true,
  dur: Array(N).fill(1),
  keys: Array.from({ length: N + 1 }, (_, i) => ({ at: i, pose: runFrame(i % N) })),
};

/** 뒤 걷기 (sim 자리 run_b): 14프레임, 한 바퀴 44px (3.6px/틱이면 약 1틱에 한 프레임) */
export const EUNWOO_WALK_B: MotionData = {
  name: 'eunwoo/walk_b',
  label: '백은우 뒤 걷기',
  loop: true,
  dur: Array(N).fill(1),
  keys: Array.from({ length: N + 1 }, (_, i) => ({ at: i, pose: backFrame(i % N) })),
};

export const EUNWOO_MOVE_MOTIONS: readonly MotionData[] = [EUNWOO_IDLE, EUNWOO_WALK_F, EUNWOO_WALK_B];
