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

// ---- 점프: 다리를 앞뒤로 활짝 찢으며 솟는다 (그랑 주테) ----
/** 가볍게 웅크린다 (점프 준비 2틱): 팔은 뒤로, 무릎을 굽힌다 */
const J_SQUAT = E({ hx: -0.5, hy: -16.5, tl: 16, hd: -2, aFx: 4, aFy: 10, aBx: -8, aBy: 10, lFx: 8, lBx: -8 });
/** 박차며 솟는다: 몸이 쭉 펴지고 두 팔이 앞위로 휘둘러 올라간다, 앞무릎을 차올린다 */
const J_PUSH = E({ hx: 0.5, hy: -24, tl: 4, hd: -6, aFx: 9, aFy: -9, aBx: 3, aBy: -11, lFx: 9, lFy: -9, lBx: -3, lBy: 2 });
/** 다리를 찢기 시작한다: 앞다리는 앞으로 뻗고 뒷다리는 뒤로 들린다 */
const J_OPEN = E({ hx: 0.5, hy: -24.5, tl: 8, hd: -6, aFx: 12, aFy: -9, aBx: -6, aBy: -10, lFx: 15, lFy: -9, lBx: -13, lBy: -7 });
/** 꼭대기 근처: 다리를 앞뒤로 활짝 찢고 연검 쥔 팔은 앞위로, 뒷팔은 뒤로 펼친다 */
const J_SPLIT = E({ hx: 0, hy: -25, tl: 10, hd: -4, aFx: 14, aFy: -7, aBx: -11, aBy: -5, lFx: 17, lFy: -13, lBx: -17, lBy: -11 });
/** 찢은 다리를 조금 모은다 (내려오기 앞) */
const J_SPLIT2 = E({ hx: 0, hy: -25, tl: 9, hd: -2, aFx: 13, aFy: -5, aBx: -10, aBy: -3, lFx: 14, lFy: -12, lBx: -14, lBy: -9 });

/** 점프: 1프레임 웅크림 → 2~3프레임 솟음 → 다리를 활짝 찢음(5~9) → 조금 모음. 12프레임 × 2틱 (솟는 동안 2틱째부터) */
export const EUNWOO_JUMP: MotionData = {
  name: 'eunwoo/jump',
  label: '백은우 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_SQUAT },
    { at: 2, pose: J_PUSH },
    { at: 4, pose: J_OPEN },
    { at: 7, pose: J_SPLIT, stop: true },
    { at: 11, pose: J_SPLIT2 },
  ],
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

/** 낙하: 둥실 뜬 꼭대기 → 발끝을 모아 내려옴 → 착지 준비. 12프레임 */
export const EUNWOO_FALL: MotionData = {
  name: 'eunwoo/fall',
  label: '백은우 낙하',
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: F_FLOAT },
    { at: 5, pose: F_DROP },
    { at: 10, pose: F_READY, stop: true },
    { at: 11, pose: F_READY },
  ],
};

// ---- 착지: 발끝으로 사뿐히 (sim은 착지 길이에 맞춰 늘이거나 줄인다) ----
/** 발끝이 닿는다 (아직 발뒤꿈치는 들림) */
const L_TOE = E({ hx: 0, hy: -22.5, tl: 6, hd: 0, aFx: 12, aFy: -1, aBx: -9, aBy: 0, lFx: 8, lFy: -1, lBx: -6, lBy: -1 });
/** 무릎으로 부드럽게 받는다 (깊지 않게) */
const L_SOFT = E({ hx: 0, hy: -19, tl: 12, hd: 2, aFx: 11, aFy: 3, aBx: -7, aBy: 6, lFx: 8, lBx: -8 });

/** 착지: 발끝 → 무릎으로 살짝 받음 → 기본자세. 12프레임 × 1틱 */
export const EUNWOO_LAND: MotionData = {
  name: 'eunwoo/land',
  label: '백은우 착지',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: L_TOE },
    { at: 4, pose: L_SOFT, stop: true },
    { at: 11, pose: E_STANCE },
  ],
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
  keys: [
    { at: 0, pose: F_FLOAT },
    { at: 2, pose: AD_LINE },
    { at: 8, pose: AD_LINE, stop: true },
    { at: 11, pose: F_FLOAT },
  ],
};

export const EUNWOO_AIR_MOTIONS: readonly MotionData[] = [EUNWOO_JUMP, EUNWOO_JUMP2, EUNWOO_FALL, EUNWOO_LAND, EUNWOO_DASH, EUNWOO_AIR_DASH];
