import type { MotionData } from '../../../anim/motion';
import { E, E_STANCE, grip2 } from './stance';

/*
 * 에드워드 점프·2단 점프·낙하·착지·지상 대시·공중 대시 (캐릭터 기획서 '움직임').
 * 점프는 낮고 무겁게 솟고, 착지할 때마다 바닥이 울린다(렌더: 흔들림·먼지). 대시는 짧고 묵직한 돌진(어깨로 밀고 들어간다).
 * 해머는 공중에서도 어깨에 걸친다 (2단 점프만 해머로 허공을 내리쳐 한 번 더 솟는다).
 */

// ---- 점프 (점프 준비 3틱 동안 1프레임, 솟는 동안 2프레임부터) ----
/** 웅크림 (점프 준비 8틱 동안 이 프레임, 피드백 12-4): 무릎을 깊이 굽히고 몸을 숙이며 턱은 든다. 뒷손이 주머니에서 빠져 뒤로 젖혀진다 */
const J_CROUCH = E({ hx: -1, hy: -13.5, tl: 20, hd: -12, aFx: 5, aFy: 5, aBx: -9, aBy: 5, lFx: 8.5, lBx: -9.5, wa: -154 });
/** 박차고 솟는다: 다리를 아래로 쭉 펴고 몸을 세운다, 뒷팔은 앞위로 휘둘린다 */
const J_PUSH = E({ hx: 0, hy: -25, tl: -2, hd: -6, aFx: 5, aFy: 4.5, aBx: 5, aBy: -6, lFx: 3, lFy: 2, lBx: -4, lBy: 3, wa: -150 });
/** 솟는 동안: 무릎을 들기 시작한다 */
const J_RISE = E({ hx: 0, hy: -25, tl: 2, hd: -4, aFx: 5, aFy: 5, aBx: 2, aBy: -2, lFx: 6, lFy: -7, lBx: -4, lBy: -4, wa: -148 });
/** 꼭대기: 두 무릎을 당기고 뒷손은 옆으로 (균형) */
export const J_TOP = E({ hx: 0, hy: -24, tl: 6, hd: -2, aFx: 5, aFy: 5.5, aBx: -6, aBy: 4, lFx: 7, lFy: -11, lBx: -2, lBy: -9, wa: -148 });

/** 점프: 1프레임 웅크림 → 2~3프레임 박차고 솟음 → 무릎을 당김. 12프레임 × 2틱 */
export const EDWARD_JUMP: MotionData = {
  name: 'edward/jump',
  label: '에드워드 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_CROUCH },
    { at: 2, pose: J_PUSH },
    { at: 5, pose: J_RISE },
    { at: 9, pose: J_TOP, stop: true },
    { at: 11, pose: J_TOP },
  ],
};

// ---- 2단 점프: 두 발로 허공을 쿵 짓밟아 한 번 더 솟는다 (발밑에 푸른 장막이 디딤판처럼 번쩍, 렌더) ----
/** 두 발로 아래를 짓밟는다: 다리를 쭉 내리 뻗고 몸을 세운다, 해머가 어깨에서 들썩, 뒷손은 위로 */
const J2_STAMP = E({ hx: 0, hy: -26, tl: -4, hd: -6, aFx: 5, aFy: 3.5, aBx: 3, aBy: -9, lFx: 4, lFy: 3, lBx: -4, lBy: 4, wa: -142 });
/** 반동으로 두 무릎을 높이 당겨 웅크린다 */
const J2_BALL = E({ hx: 0, hy: -26, tl: 14, hd: 2, aFx: 5, aFy: 5, aBx: -6, aBy: 4, lFx: 7, lFy: -15, lBx: 1, lBy: -13, wa: -155 });

/** 2단 점프: 웅크림 → 2~3프레임 허공을 짓밟음 → 무릎을 당겨 웅크림 → 펴며 꼭대기 자세. 12프레임 × 2틱 */
export const EDWARD_JUMP2: MotionData = {
  name: 'edward/jump2',
  label: '에드워드 2단 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_TOP },
    { at: 2, pose: J2_STAMP, stop: true },
    { at: 6, pose: J2_BALL, stop: true },
    { at: 11, pose: J_TOP },
  ],
};

// ---- 낙하 (프레임은 떨어지는 속도로 고른다: sim은 1/4px/틱마다 한 프레임) ----
/** 내려오며 다리를 펴기 시작한다 */
const F_OPEN = E({ hx: 0, hy: -24, tl: 3, hd: -2, aFx: 5, aFy: 5.5, aBx: -7, aBy: 2, lFx: 7, lFy: -5, lBx: -5, lBy: -4, wa: -150 });
/** 빨리 떨어질 때: 두 발을 넓게 벌려 무겁게 내리고 무릎을 굽혀 착지를 준비, 뒷손은 옆으로 벌려 균형 */
const F_READY = E({ hx: 0, hy: -23, tl: 6, hd: 0, aFx: 5, aFy: 5, aBx: -9, aBy: -1, lFx: 10, lFy: -1, lBx: -10, lBy: -1, wa: -152 });

/** 낙하: 웅크림(꼭대기) → 다리를 펴며 → 발을 넓게 벌려 착지 준비. 12프레임 */
export const EDWARD_FALL: MotionData = {
  name: 'edward/fall',
  label: '에드워드 낙하',
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: J_TOP },
    { at: 5, pose: F_OPEN },
    { at: 10, pose: F_READY, stop: true },
    { at: 11, pose: F_READY },
  ],
};

// ---- 착지 (sim은 착지 길이에 맞춰 늘이거나 줄인다: 4틱이면 1·4·7·10번이 보인다) ----
/** 쿵 (피드백 12-4 '두 발로 쿵, 무릎 크게 굽고'): 두 발을 벌려 무릎을 깊게 굽혀 받는다, 몸이 앞으로 숙고 해머가 어깨에서 튄다 */
const L_SQUASH = E({ hx: 0, hy: -12, tl: 26, hd: 6, aFx: 6, aFy: 7, aBx: -6, aBy: 8, lFx: 10.5, lBx: -11.5, wa: -158 });
/** 버티며 일어난다 */
const L_RISE = E({ hx: 0, hy: -19.5, tl: 8, hd: 0, aFx: 5, aFy: 6.5, aBx: -4, aBy: 11, lFx: 8, lBx: -9, wa: -152 });

/** 착지: 발이 닿음 → 쿵 깊게 받음 → 버티며 일어나 기본자세. 12프레임 × 1틱 (바닥 울림은 렌더) */
export const EDWARD_LAND: MotionData = {
  name: 'edward/land',
  label: '에드워드 착지',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: F_READY },
    { at: 3, pose: L_SQUASH, stop: true },
    { at: 7, pose: L_RISE },
    { at: 11, pose: E_STANCE },
  ],
};

// ---- 지상 대시 (피드백 12-4 '세 걸음 쿵쿵쿵 돌진', sim: 24틱, 2~20틱째 약 40px): 어깨를 내밀고 묵직하게 세 번 디딘다 ----
/** 실는다: 뒤로 무게를 싣고 웅크린다 */
const D_LOAD = E({ hx: -2, hy: -19, tl: 10, hd: 0, aFx: 5, aFy: 6, aBx: -7, aBy: 6, lFx: 8, lBx: -10, wa: -154 });
/** 내딛는 발을 든다 (몸을 숙여 앞어깨를 내민다) */
const D_LIFT_F = E({ hx: 1, hy: -21, tl: 22, hd: -10, tw: 3, aFx: 4, aFy: 3, aBx: -8, aBy: 3, lFx: 12, lFy: -6, lBx: -9, wa: -128 });
/** 쿵: 앞발이 바닥을 찍는다 (무릎으로 받아 몸이 내려앉는다) */
const D_STOMP_F = E({ hx: 3, hy: -18, tl: 24, hd: -10, tw: 3.5, aFx: 4, aFy: 3, aBx: -8, aBy: 2, lFx: 13, lBx: -12, wa: -126 });
/** 뒷발을 앞으로 끌어 든다 */
const D_LIFT_B = E({ hx: 2, hy: -21, tl: 22, hd: -10, tw: 2.5, aFx: 4, aFy: 3, aBx: -8, aBy: 3, lFx: 2, lBx: 12, lBy: -6, wa: -130 });
/** 쿵: 뒷발이 앞에서 바닥을 찍는다 */
const D_STOMP_B = E({ hx: 3, hy: -18, tl: 24, hd: -10, tw: 3, aFx: 4, aFy: 3, aBx: -8, aBy: 2, lFx: -11, lBx: 13, wa: -127 });
/** 멈춘다: 몸을 세우며 무릎으로 받는다 */
const D_STOP = E({ hx: 1.5, hy: -19.5, tl: 8, hd: -2, aFx: 5, aFy: 6, aBx: -6, aBy: 7, lFx: 10, lBx: -9, wa: -150 });

/**
 * 지상 대시: 기본자세 → 웅크려 싣고 → 쿵(3프레임) → 쿵(6프레임) → 쿵(9프레임) → 멈춰 기본자세. 12프레임 (sim이 24틱에 맞춰 늘인다: 프레임마다 2틱).
 * 디딜 때마다 물이 튀고 화면이 조금 흔들린다 (렌더). 잔상은 남기지 않는다
 */
export const EDWARD_DASH: MotionData = {
  name: 'edward/dash',
  label: '에드워드 지상 대시',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: D_LOAD },
    { at: 2, pose: D_LIFT_F },
    { at: 3, pose: D_STOMP_F, stop: true },
    { at: 4, pose: D_LIFT_B },
    { at: 6, pose: D_STOMP_B, stop: true },
    { at: 7, pose: { ...D_LIFT_F, lBx: -12, lFx: 2 } },
    { at: 9, pose: D_STOMP_F, stop: true },
    { at: 10, pose: D_STOP },
    { at: 11, pose: E_STANCE },
  ],
};

// ---- 공중 대시 (sim: 12틱, 1~7틱째 앞으로) ----
/** 공중에서 해머를 두 손으로 어깨 뒤에 치켜 감고 몸을 앞으로 던진다: 다리는 뒤로 끌린다 */
const AD_LUNGE = grip2(E({ hx: 2, hy: -24, tl: 34, hd: -18, aFx: 2, aFy: -1, lFx: -2, lFy: -10, lBx: -11, lBy: -6, wa: -118 }));

/** 공중 대시: 웅크림 → 2~3프레임 해머를 뒤로 끌고 몸을 던짐 → 몸을 세우며 낙하 준비. 12프레임 × 1틱 */
export const EDWARD_AIR_DASH: MotionData = {
  name: 'edward/air_dash',
  label: '에드워드 공중 대시',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: J_TOP },
    { at: 2, pose: AD_LUNGE },
    { at: 8, pose: AD_LUNGE, stop: true },
    { at: 11, pose: F_OPEN },
  ],
};

export const EDWARD_AIR_MOTIONS: readonly MotionData[] = [EDWARD_JUMP, EDWARD_JUMP2, EDWARD_FALL, EDWARD_LAND, EDWARD_DASH, EDWARD_AIR_DASH];
