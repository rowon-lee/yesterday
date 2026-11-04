import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { E, E_STANCE } from './stance';

/*
 * 백은우 점프·2단 점프·낙하·착지·지상 대시·공중 대시 (캐릭터 기획서 '움직임').
 * 몸이 매우 유연해 동작이 크고 부드럽다: 점프는 다리를 앞뒤로 활짝 찢는 도약, 2단 점프는 앞으로 한 바퀴 공중제비,
 * 착지는 발끝으로 사뿐. 대시는 금색 실을 따라 미끄러지듯 (실·금색 잔상은 렌더). 가운 자락은 몸이 숙거나 뒷다리를 뻗을수록 휘날린다.
 */

/** 몸 전체를 엉덩이를 중심으로 돌린다 (공중제비). 손 목표는 어깨 기준이라 같이 돌리고, 발은 엉덩이 둘레로 돌린다 */
export function spin(p: Pose, deg: number): Pose {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const rot = (x: number, y: number): [number, number] => [x * c - y * s, x * s + y * c];
  const [aFx, aFy] = rot(p.aFx, p.aFy);
  const [aBx, aBy] = rot(p.aBx, p.aBy);
  const [fx, fy] = rot(p.lFx - p.hx, p.lFy - p.hy);
  const [bx, by] = rot(p.lBx - p.hx, p.lBy - p.hy);
  return { ...p, tl: p.tl + deg, aFx, aFy, aBx, aBy, lFx: p.hx + fx, lFy: p.hy + fy, lBx: p.hx + bx, lBy: p.hy + by };
}

const TAU = Math.PI * 2;

// ---- 점프 (11-1): 등을 활처럼 젖히며 솟고, 연검 쥔 손이 원을 두 번 그려 칼날이 나선으로 감긴다 ----
/** 가볍게 웅크린다 (점프 준비 2틱): 팔은 뒤로, 무릎을 굽힌다 */
const J_SQUAT = E({ hx: -0.5, hy: -17, tl: 14, hd: -2, aFx: 2, aFy: 13, aBx: -7, aBy: 10, lFx: 7, lBx: -7 });
/** 박차며 솟는다: 몸이 쭉 펴지고 두 팔이 앞위로 휘둘러 올라간다 */
const J_PUSH = E({ hx: 0.5, hy: -25, tl: 2, hd: -8, aFx: 8, aFy: -8, aBx: 2, aBy: -10, lFx: 5, lFy: -6, lBx: -3, lBy: 1 });
/** 등을 활처럼 젖힌다: 가슴을 열고 고개를 뒤로, 두 다리는 뒤로 모아 접고 뒷팔은 뒤로 펼친다 (앞손은 원을 그린다) */
const archAt = (k: number): Pose => {
  const a = (k / 8) * TAU * 2 - Math.PI / 2;
  return E({
    hx: 0, hy: -25.5, tl: -12 - 3 * Math.sin((k / 8) * Math.PI), hd: -14,
    aFx: 9 + 5 * Math.cos(a), aFy: -6 + 5 * Math.sin(a), aBx: -11, aBy: -6,
    lFx: -1, lFy: -10, lBx: -9, lBy: -8,
  });
};
/** 꼭대기 근처: 몸을 펴며 떨어질 준비 (낙하 첫 자세 쪽으로) */
const J_TOP = E({ hx: 0, hy: -25, tl: 4, hd: -4, aFx: 12, aFy: -4, aBx: -10, aBy: -5, lFx: 6, lFy: -8, lBx: -6, lBy: -5 });

/** 점프: 웅크림 → 솟음 → 등을 젖히고 연검으로 나선(2~10프레임) → 펴며 꼭대기. 12프레임 × 2틱 (솟는 동안 2틱째부터) */
export const EUNWOO_JUMP: MotionData = {
  name: 'eunwoo/jump',
  label: '백은우 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_SQUAT },
    { at: 1, pose: J_PUSH },
    ...Array.from({ length: 8 }, (_, k) => ({ at: 2 + k, pose: archAt(k) })),
    { at: 11, pose: J_TOP },
  ],
  follow: { ribbon: { air: true, stiff: 0.45, gravity: 0.35, damp: 0.9 }, wind: 0.2 },
};

// ---- 2단 점프: 앞으로 한 바퀴 공중제비 ----
/** 팔을 머리 위로 뻗어 몸을 길게 편다 */
const J2_REACH = E({ hx: 0, hy: -25, tl: 2, hd: -6, aFx: 4, aFy: -15, aBx: -2, aBy: -15, lFx: 3, lFy: 1, lBx: -4, lBy: 2 });
/** 접은 몸 (무릎을 가슴에, 손은 정강이 앞) — 이것을 통째로 돌린다 */
const J2_BALL = E({ hx: 0, hy: -25, tl: 26, hd: 6, aFx: 9, aFy: 3, aBx: 7, aBy: 5, lFx: 7, lFy: -16, lBx: 3, lBy: -15 });
/** 다 돌고 몸을 펴 떨어질 준비 */
const J2_OPEN = E({ hx: 0, hy: -24, tl: 8 + 360, hd: -2, aFx: 12, aFy: -6, aBx: -9, aBy: -4, lFx: 8, lFy: -6, lBx: -7, lBy: -4 });

/** 2단 점프: 몸을 길게 폄 → 웅크린 채 앞으로 한 바퀴(2~9프레임) → 펴며 떨어질 준비. 12프레임 × 2틱 */
export const EUNWOO_JUMP2: MotionData = {
  name: 'eunwoo/jump2',
  label: '백은우 2단 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  follow: { ribbon: { air: true, stiff: 0.5, gravity: 0.3, damp: 0.9 }, wind: 0.3 },
  keys: [
    { at: 0, pose: J2_REACH },
    { at: 2, pose: spin(J2_BALL, 40) },
    { at: 4, pose: spin(J2_BALL, 130) },
    { at: 6, pose: spin(J2_BALL, 220) },
    { at: 8, pose: spin(J2_BALL, 300) },
    { at: 10, pose: J2_OPEN },
    { at: 11, pose: J2_OPEN },
  ],
};

// ---- 낙하 (프레임은 떨어지는 속도로 고른다: sim은 1/4px/틱마다 한 프레임) ----
/** 꼭대기: 찢었던 다리를 모으며 몸이 둥실 뜬다. 두 팔은 깃털처럼 옆으로 */
const F_FLOAT = E({ hx: 0, hy: -25, tl: 6, hd: 0, aFx: 12, aFy: -6, aBx: -10, aBy: -6, lFx: 7, lFy: -7, lBx: -6, lBy: -5 });
/** 내려온다: 발끝을 아래로 모으고, 팔이 위로 떠오른다 */
const F_DROP = E({ hx: 0, hy: -25, tl: 4, hd: 2, aFx: 11, aFy: -9, aBx: -9, aBy: -10, lFx: 4, lFy: -2, lBx: -3, lBy: -1 });
/** 빨리 떨어질 때: 앞발을 조금 앞으로 내밀어 발끝으로 닿을 준비, 팔은 균형을 잡으러 내려온다 */
const F_READY = E({ hx: 0, hy: -24, tl: 6, hd: 2, aFx: 12, aFy: -2, aBx: -9, aBy: -2, lFx: 8, lFy: -2, lBx: -5, lBy: -1 });

/** 내려오기 시작: 발끝이 모이기 시작한다 (팔은 아직 옆으로) */
const F_EASE = E({ hx: 0, hy: -25, tl: 5.5, hd: 0.5, aFx: 12, aFy: -6.5, aBx: -10, aBy: -7, lFx: 6.5, lFy: -6, lBx: -5.5, lBy: -4.2 });
/** 발이 바닥을 찾아 내려간다 */
const F_REACH = E({ hx: 0, hy: -24.2, tl: 5.5, hd: 2, aFx: 11.8, aFy: -3, aBx: -9.2, aBy: -3, lFx: 7.6, lFy: -2.2, lBx: -4.8, lBy: -1.2 });

/**
 * 낙하 (2차 리워크): 둥실 뜬 꼭대기 → 발끝이 모이기 시작 → 한 번에 발끝을 모아 내려옴(팔이 떠오름) → 발이 바닥을 찾음 → 착지 준비(멈춤).
 * 12프레임 × 3 → 5프레임 (dur 합 36 = 가장 빠른 낙하 그대로)
 */
export const EUNWOO_FALL: MotionData = {
  name: 'eunwoo/fall',
  label: '백은우 낙하',
  dur: [6, 6, 6, 6, 12],
  // 빨리 떨어질수록 칼날·자락이 위로 떠오른다 (맞바람)
  follow: { ribbon: { air: true, stiff: 0.6, curl: 0.7, keys: [{ at: 0, gravity: 0.5 }, { at: 2.5, gravity: 0 }, { at: 4, gravity: -0.3 }] }, wind: 0.15 },
  keys: [
    { at: 0, pose: F_FLOAT },
    { at: 1, pose: F_EASE },
    { at: 2, pose: F_DROP },
    { at: 3, pose: F_REACH },
    { at: 4, pose: F_READY, stop: true },
  ],
};

// ---- 착지 (11-1): 발끝으로 닿아 무릎을 깊이 굽혀 받고, 가운이 부풀었다가 가라앉는다 (sim은 착지 길이 3틱에 맞춰 0·4·8프레임을 보인다) ----
/** 발끝이 닿는다 (아직 뒤꿈치는 들림, 몸은 곧게) */
const L_TOE = E({ hx: 0, hy: -23.5, tl: 4, hd: 0, aFx: 11, aFy: -2, aBx: -9, aBy: -2, lFx: 6, lFy: -1.5, lBx: -5, lBy: -1 });
/** 무릎을 깊이 굽혀 받는다: 몸이 앞으로 실리고 두 팔은 옆으로 펼쳐 균형 */
const L_DEEP = E({ hx: 0.5, hy: -14.5, tl: 20, hd: 4, aFx: 10, aFy: 7, aBx: -10, aBy: 3, lFx: 8, lBx: -8 });
/** 일어선다 */
const L_RISE = E({ hx: -0.5, hy: -20.5, tl: 8, hd: 4, aFx: 6, aFy: 12, aBx: -5, aBy: 12, lFx: 7, lBx: -6 });

/** 착지: 발끝 → 깊이 굽혀 받음(3~5) → 일어섬 → 기본자세. 12프레임 × 1틱 (리본·자락은 낙하 끝 모습에서 이어 받는다) */
export const EUNWOO_LAND: MotionData = {
  name: 'eunwoo/land',
  label: '백은우 착지',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: L_TOE },
    { at: 3, pose: L_DEEP },
    { at: 5, pose: L_DEEP, stop: true },
    { at: 8, pose: L_RISE },
    { at: 11, pose: E_STANCE },
  ],
  follow: { ribbon: { stiff: 0.6 }, from: { motion: 'eunwoo/fall', frame: 4 } },
};

// ---- 지상 대시: 손가락으로 금색 실을 앞으로 쏘고, 그 실을 따라 낮게 미끄러진다 (sim: 12틱) ----
/** 뒷손을 앞으로 튕겨 실을 쏜다 */
const D_FLICK = E({ hx: 1, hy: -20, tl: 14, hd: -4, aFx: 8, aFy: 8, aBx: 14, aBy: -4, lFx: 9, lBx: -9 });
/** 미끄러진다: 앞무릎을 굽혀 낮게 실리고 뒷다리는 뒤로 길게 끌린다, 뒷손은 실을 잡고 앞으로 뻗고 연검은 뒤로 흐른다 */
const D_GLIDE = E({ hx: 3, hy: -14, tl: 30, hd: -14, aFx: -8, aFy: 8, aBx: 16, aBy: -3, lFx: 14, lBx: -19, lBy: 0 });
/** 미끄러지는 끝: 뒷발을 당겨 모으며 몸을 일으킨다 */
const D_DRAW = E({ hx: 2, hy: -18, tl: 20, hd: -6, aFx: 6, aFy: 8, aBx: 10, aBy: 2, lFx: 11, lBx: -11 });

/** 지상 대시: 실을 쏨 → 2~7프레임 낮게 미끄러짐 → 일어나 기본자세. 12프레임 × 1틱 */
export const EUNWOO_DASH: MotionData = {
  name: 'eunwoo/dash',
  label: '백은우 지상 대시',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  // 가운·머리·연검이 곧게 뒤로 날린다
  follow: { ribbon: { stiff: 0.5, gravity: 0.4, keys: [{ at: 0, wind: 0.5 }, { at: 2, wind: 1.1 }, { at: 8, wind: 1.1 }, { at: 11, wind: 0.2 }] }, wind: 1 },
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: D_FLICK },
    { at: 3, pose: D_GLIDE },
    { at: 7, pose: D_GLIDE, stop: true },
    { at: 9, pose: D_DRAW },
    { at: 11, pose: E_STANCE },
  ],
};

// ---- 공중 대시: 실을 따라 몸을 길게 눕혀 날아간다 (sim: 11틱) ----
/** 몸을 앞으로 길게 눕힌다: 뒷손은 실을 잡고 앞으로, 두 다리는 모아 발끝을 뒤로, 연검은 뒤로 흐른다 */
const AD_LINE = E({ hx: 2, hy: -24, tl: 66, hd: -26, aFx: -6, aFy: 8, aBx: 16, aBy: -1, lFx: -9, lFy: -15, lBx: -12, lBy: -12 });

/** 공중 대시: 웅크림 → 2~8프레임 몸을 눕혀 실을 따라 날아감 → 몸을 세우며 낙하로. 12프레임 × 1틱 */
export const EUNWOO_AIR_DASH: MotionData = {
  name: 'eunwoo/air_dash',
  label: '백은우 공중 대시',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  follow: { ribbon: { air: true, stiff: 0.5, gravity: 0.3, keys: [{ at: 0, wind: 0.6 }, { at: 2, wind: 1.1 }, { at: 8, wind: 1.1 }, { at: 11, wind: 0.2 }] }, wind: 1 },
  keys: [
    { at: 0, pose: F_FLOAT },
    { at: 2, pose: AD_LINE },
    { at: 8, pose: AD_LINE, stop: true },
    { at: 11, pose: F_FLOAT },
  ],
};

export const EUNWOO_AIR_MOTIONS: readonly MotionData[] = [EUNWOO_JUMP, EUNWOO_JUMP2, EUNWOO_FALL, EUNWOO_LAND, EUNWOO_DASH, EUNWOO_AIR_DASH];
