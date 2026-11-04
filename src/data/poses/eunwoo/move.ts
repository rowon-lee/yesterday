import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { E, E_STANCE } from './stance';

/*
 * 백은우 대기·걷기 (캐릭터 기획서 '움직임' + 1차본 피드백 11-1 2026-11-02).
 * 모든 동작에서 꽁지머리·가운 자락·연검이 몸보다 2~4프레임 늦게 따라오고, 멈출 때 한 번 지나쳤다 돌아온다
 * (follow: anim/follow.ts가 동작 그림을 미리 그릴 때 계산한다).
 */

const TAU = Math.PI * 2;

// ---- 대기: 콘트라포스토로 서서 약 1.5초(90틱)에 한 번 숨을 쉰다 ----
/**
 * 숨의 깊이 (0 = 다 내쉼, 1 = 다 들이쉼), i = 0..14: 2차 리워크 — 사인 곡선(고른 간격) 대신 천천히 들이쉬고(0~11) 한숨처럼 한 번에 내쉰 뒤(11~12)
 * 잠깐 머문다(12~14). 숨 쉬는 주기 90틱(피드백 11-1)은 그대로
 */
const ease3 = (u: number) => u * u * (3 - 2 * u);
const breathAt = (i: number): number => (i <= 11 ? ease3(i / 11) : 0);

/**
 * i번째 프레임 (14프레임 한 바퀴): 들이쉬면 가슴이 열리며 몸이 조금 솟고(엉덩이 0.7px) 연검 쥔 손이 앞으로 살짝 떠오르고,
 * 내쉬면 가라앉는다. 무게는 뒷발에 둔 채 엉덩이가 아주 조금 좌우로 흔들린다 (흔들림은 숨과 다른 박자)
 */
function idleFrame(i: number): Pose {
  const ph = (i / 14) * TAU;
  const breath = breathAt(i);
  const sway = Math.sin(ph);
  return E({
    hx: E_STANCE.hx - 0.3 * sway,
    hy: E_STANCE.hy - 0.7 * breath,
    tl: E_STANCE.tl - 1.5 * breath,
    hd: E_STANCE.hd - 2 * breath + 1.2 * Math.sin(2 * ph),
    aFx: E_STANCE.aFx + 2.2 * breath,
    aFy: E_STANCE.aFy - 2 * breath,
    aBx: E_STANCE.aBx - 0.6 * breath,
    aBy: E_STANCE.aBy - 0.6 * breath,
    lFx: E_STANCE.lFx + 0.4 * sway,
  });
}

/**
 * 대기: 14프레임 90틱 (숨 한 번: 들이쉼 11프레임 → 한 번에 내쉼 → 머묾 2프레임). 연검은 손에서 S자로 바닥까지 늘어지고 끝이 숨에 맞춰
 * 말렸다 풀린다 (굽힘 박자), 가운 자락(세 번)과 꽁지머리(두 번)는 서로 다른 박자로 흔들린다
 */
export const EUNWOO_IDLE: MotionData = {
  name: 'eunwoo/idle',
  label: '백은우 대기',
  loop: true,
  dur: [7, 6, 6, 7, 6, 6, 7, 6, 6, 7, 6, 6, 7, 7],
  keys: Array.from({ length: 15 }, (_, i) => ({ at: i, pose: idleFrame(i % 14) })),
  follow: {
    ribbon: { stiff: 0.55, keys: [{ at: 0, curl: 0.8 }, { at: 11, curl: 1.6 }, { at: 14, curl: 0.8 }] },
    breeze: 1,
  },
};

// ---- 앞 걷기·뒤 걷기: 발끝으로 짧고 빠르게 종종걸음. 프레임은 움직인 거리로 넘긴다 (sim: runCycle) ----
/** 앞 걷기 한 바퀴(두 걸음) 거리 (px) = 은우 runCycle. 한 걸음 26px (짧고 빠르게) */
export const E_RUN_CYCLE = 52;
/** 뒤 걷기 한 바퀴(두 걸음) 거리 (px) = runBackCycle. 한 걸음 20px */
export const E_RUN_BACK_CYCLE = 40;
const N = 14;
const ease = (s: number) => s * s * (3 - 2 * s);

/**
 * 한 다리의 발 자리 (몸 기준): 바닥에 닿아 있는 동안(q < c)은 몸이 움직인 만큼 발이 반대로 가서 미끄러지지 않는다.
 * 떠 있는 동안은 뒤꿈치를 차올렸다가(뒤쪽에서 높이) 다음 디딜 자리로 뻗는다.
 * dir 1: 앞으로 (닿은 발이 뒤로 감), -1: 뒤로 물러남 (닿은 발이 앞으로 감)
 */
function foot(q: number, c: number, cycle: number, from: number, lift: number, dir: 1 | -1, swing: readonly [number, number] = dir > 0 ? [0.15, 0.85] : [0, 1]): [number, number] {
  const run = c * cycle;
  const to = from - dir * run;
  if (q < c) return [from - dir * q * cycle, 0];
  const s = (q - c) / (1 - c);
  // 공중에서 발이 다음 디딜 자리로 옮겨 가는 구간 [시작, 길이] (떠 있는 동안 0~1)
  const lag = ease(Math.max(0, Math.min(1, (s - swing[0]) / swing[1])));
  return [to + (from - to) * lag, -lift * Math.pow(Math.sin(Math.PI * s), 0.8)];
}

/** 2차 리워크 종종걸음: 발이 뜬 뒤 뒤에서 잠깐 머물렀다가(뒤꿈치를 차올림) 한 번에 앞으로 채여 나가고, 디딜 자리 위에서 내려앉는다 */
const SNAP_F: readonly [number, number] = [0.35, 0.3];

/**
 * 앞 걷기 i번째 프레임: 엉덩이를 높이 두고(발끝으로) 몸을 조금 숙여 종종걸음. 연검 쥔 앞손은 엉덩이 뒤로 낮게 빼서
 * 칼날이 깃발처럼 뒤로 끌리고, 뒷팔만 작게 흔든다
 */
function runFrame(i: number): Pose {
  const p = i / N;
  const c = 0.3;
  const [fx, fy] = foot(p % 1, c, E_RUN_CYCLE, 9, 7, 1, SNAP_F);
  const [bx, by] = foot((p + 0.5) % 1, c, E_RUN_CYCLE, 9, 7, 1, SNAP_F);
  const bob = Math.cos(2 * TAU * (p - c / 2));
  const sw = Math.cos(TAU * p);
  return {
    hx: 1, hy: -22.6 + 0.6 * bob, tl: 13 + 1.5 * bob, hd: -5,
    aFx: -5 - 2 * sw, aFy: 12 + 1.5 * sw, aBx: 3 + 6 * sw, aBy: 9 - 3 * sw,
    lFx: fx, lFy: fy, lBx: bx, lBy: by,
  };
}

/** 뒤 걷기 i번째 프레임: 몸을 세우고 연검 쥔 손을 앞으로 내밀어 칼날을 상대 쪽에 늘어뜨린 채 발끝으로 잰걸음. 뒷팔은 뒤로 벌려 균형 */
function backFrame(i: number): Pose {
  const p = i / N;
  const c = 0.36;
  const [fx, fy] = foot(p % 1, c, E_RUN_BACK_CYCLE, -5, 5, -1);
  const [bx, by] = foot((p + 0.5) % 1, c, E_RUN_BACK_CYCLE, -5, 5, -1);
  const bob = Math.cos(2 * TAU * (p - c / 2));
  const sw = Math.cos(TAU * p);
  return {
    hx: -0.5, hy: -22.4 + 0.6 * bob, tl: -2 + bob, hd: 5,
    aFx: 9 + sw, aFy: 9 + sw, aBx: -7 - 2 * sw, aBy: 12 + sw,
    lFx: fx + 4, lFy: fy, lBx: bx - 2, lBy: by,
  };
}

/** 앞 걷기 (sim 자리 run_f): 14프레임, 한 바퀴 52px. 가운·머리는 뒤로 휘날리고 연검은 깃발처럼 뒤로 끌린다 */
export const EUNWOO_WALK_F: MotionData = {
  name: 'eunwoo/walk_f',
  label: '백은우 앞 걷기',
  loop: true,
  dur: Array(N).fill(1),
  keys: Array.from({ length: N + 1 }, (_, i) => ({ at: i, pose: runFrame(i % N) })),
  follow: { ribbon: { wind: 0.5, stiff: 0.7, gravity: 0.6 }, wind: 0.55 },
};

/** 뒤 걷기 (sim 자리 run_b): 14프레임, 한 바퀴 40px. 칼날은 앞으로 조금 끌린다 */
export const EUNWOO_WALK_B: MotionData = {
  name: 'eunwoo/walk_b',
  label: '백은우 뒤 걷기',
  loop: true,
  dur: Array(N).fill(1),
  keys: Array.from({ length: N + 1 }, (_, i) => ({ at: i, pose: backFrame(i % N) })),
  follow: { ribbon: { wind: -0.25, stiff: 0.7 }, wind: 0.1 },
};

export const EUNWOO_MOVE_MOTIONS: readonly MotionData[] = [EUNWOO_IDLE, EUNWOO_WALK_F, EUNWOO_WALK_B];
