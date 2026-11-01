import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 지상 평타 (캐릭터 기획서 '평타': MMA. 잽·스트레이트·훅·로킥·니킥처럼 짧고 빠른 타격으로 몰아친다).
 * 모두 기본자세(MMA 가드)에서 시작해 기본자세로 끝난다. 판정 프레임·수치는 data/characters/raiden.ts의 moves.
 * 치지 않는 손은 늘 턱 앞에 남긴다 (가드를 푼 채 치지 않는다).
 */

// ---- 1타: 잽 (앞손 곧게) ----
/** 앞발로 반 걸음 들어가며 몸을 싣는다 (앞손은 그대로) */
const JAB_IN = R({ hx: 0.5, hy: -18.5, tl: 18, hd: 9, aFx: 12, aFy: -4, lFx: 10 });
/** 앞손을 얼굴 높이로 곧게 뻗는다: 어깨를 앞으로 밀고 턱은 어깨 뒤로, 뒷손은 턱 */
const JAB_HIT = R({ hx: 1.5, hy: -18.5, tl: 22, hd: 10, aFx: 18, aFy: -6, aBx: 8, aBy: -1, lFx: 11, lBx: -8 });
/** 뻗은 채 멈칫 (끝까지 뻗음) */
const JAB_HOLD = R({ hx: 1.5, hy: -18.5, tl: 22, hd: 10, aFx: 18.5, aFy: -6, aBx: 8, aBy: -1, lFx: 11, lBx: -8 });
/** 빠르게 거둔다 */
const JAB_BACK = R({ hx: 0.5, hy: -18.5, tl: 17, hd: 9, aFx: 12, aFy: -5, lFx: 9 });

/** 1타 잽: 반 걸음 들어가며(2~3프레임) 앞손을 곧게 뻗고(4~5프레임 판정) 빠르게 거둔다. 12프레임 15틱 */
export const RAIDEN_JAB: MotionData = {
  name: 'raiden/jab',
  label: '라이덴 1타 잽',
  dur: [1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: JAB_IN },
    { at: 3, pose: JAB_HIT },
    { at: 5, pose: JAB_HOLD, stop: true },
    { at: 8, pose: JAB_BACK },
    { at: 11, pose: R_STANCE },
  ],
};

// ---- 2타: 스트레이트 (뒷손 곧게, 허리를 돌려) ----
/** 뒷발 뒤꿈치를 돌리며 허리를 튼다: 뒷손이 턱에서 떠나기 시작, 앞손은 턱으로 거둔다 */
const CROSS_TURN = R({ hx: 1, hy: -18.5, tl: 20, hd: 9, aFx: 8, aFy: -4, aBx: 10, aBy: -2, lFx: 10, lBx: -8 });
/** 뒷손을 곧게 뻗는다: 몸통이 앞으로 실리고 뒷어깨가 앞으로 나온다. 앞손은 턱 앞 */
const CROSS_HIT = R({ hx: 2.5, hy: -18, tl: 27, hd: 10, aFx: 7, aFy: -4, aBx: 20, aBy: -6, lFx: 11, lBx: -7 });
const CROSS_HOLD = R({ hx: 2.5, hy: -18, tl: 27, hd: 10, aFx: 7, aFy: -4, aBx: 20.5, aBy: -6, lFx: 11, lBx: -7 });
/** 거두며 허리를 되돌린다 */
const CROSS_BACK = R({ hx: 1, hy: -18.5, tl: 19, hd: 9, aFx: 11, aFy: -4, aBx: 10, aBy: -1, lFx: 9, lBx: -8 });

/** 2타 스트레이트: 허리를 틀며(2~3프레임) 뒷손을 곧게 뻗고(4~5프레임 판정) 거둔다. 12프레임 15틱 */
export const RAIDEN_CROSS: MotionData = {
  name: 'raiden/cross',
  label: '라이덴 2타 스트레이트',
  dur: [1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: CROSS_TURN },
    { at: 3, pose: CROSS_HIT },
    { at: 5, pose: CROSS_HOLD, stop: true },
    { at: 8, pose: CROSS_BACK },
    { at: 11, pose: R_STANCE },
  ],
};

// ---- 3타: 훅 (앞손을 구부린 채 옆에서 휘둘러) ----
/** 몸을 뒤로 틀어 앞주먹을 귀 옆으로 당긴다 (팔꿈치는 구부림), 무게를 앞발에 */
const HOOK_LOAD = R({ hx: 0, hy: -18, tl: 12, hd: 9, aFx: 5, aFy: -9, aBx: 8, aBy: -1, lFx: 10, lBx: -8 });
/** 허리를 돌리며 구부린 앞팔로 옆에서 휘둘러 상대 관자놀이를 친다 (주먹이 얼굴 앞으로 둥글게 들어옴) */
const HOOK_SWING = R({ hx: 1.5, hy: -17.5, tl: 22, hd: 11, aFx: 12, aFy: -10, aBx: 8, aBy: -1, lFx: 11, lBx: -8 });
/** 끝까지 휘둘러 주먹이 몸 안쪽으로 감긴다 (멈칫) */
const HOOK_HIT = R({ hx: 2, hy: -17.5, tl: 26, hd: 12, aFx: 14, aFy: -7, aBx: 8, aBy: -1, lFx: 11, lBx: -8 });
/** 거두며 가드로 */
const HOOK_BACK = R({ hx: 1, hy: -18.5, tl: 19, hd: 9, aFx: 12, aFy: -5, lFx: 9, lBx: -9 });

/** 3타 훅: 앞주먹을 귀 옆으로 당겼다가(2~4프레임) 허리를 돌려 옆에서 휘둘러(6~7프레임 판정) 거둔다. 13프레임 15틱 */
export const RAIDEN_HOOK: MotionData = {
  name: 'raiden/hook',
  label: '라이덴 3타 훅',
  dur: [1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: HOOK_LOAD },
    { at: 5, pose: HOOK_SWING },
    { at: 6, pose: HOOK_HIT },
    { at: 7, pose: HOOK_HIT, stop: true },
    { at: 9, pose: HOOK_BACK },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 4타: 니킥 (두 손으로 상대 머리를 끌어내리며 앞무릎을 차올림) ----
/** 두 손을 앞으로 뻗어 상대 목덜미를 잡듯(클린치) 몸을 앞으로 싣고, 뒷발로 바닥을 민다 */
const KNEE_GRAB = R({ hx: 2, hy: -18, tl: 20, hd: 8, aFx: 17, aFy: -6, aBx: 15, aBy: -4, lFx: 9, lBx: -10 });
/** 두 손으로 끌어내리며 앞무릎을 가슴 높이로 힘껏 차올린다: 몸은 뒤로 젖히고 발끝으로 선 뒷다리가 쭉 펴진다 */
const KNEE_HIT = R({ hx: 2, hy: -23, tl: 2, hd: 12, aFx: 13, aFy: 3, aBx: 11, aBy: 5, lFx: 13, lFy: -16, lBx: -6, lBy: 0 });
/** 무릎을 끝까지 올린 채 버틴다 (멈칫) */
const KNEE_HOLD = R({ hx: 2, hy: -23.5, tl: 0, hd: 12, aFx: 12, aFy: 4, aBx: 10, aBy: 6, lFx: 13, lFy: -17, lBx: -6, lBy: 0 });
/** 무릎을 내리며 손을 가드로 되돌린다 */
const KNEE_DOWN = R({ hx: 1, hy: -20, tl: 12, hd: 9, aFx: 12, aFy: -4, aBx: 8, aBy: 0, lFx: 10, lFy: -4, lBx: -8 });

/** 4타 니킥: 두 손으로 붙잡듯 들어가(4~5프레임) 끌어내리며 앞무릎을 차올리고(7~8프레임 판정) 내려선다. 14프레임 20틱 */
export const RAIDEN_KNEE: MotionData = {
  name: 'raiden/knee',
  label: '라이덴 4타 니킥',
  dur: [1, 1, 1, 1, 2, 2, 1, 2, 2, 1, 1, 1, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 4, pose: KNEE_GRAB },
    { at: 6, pose: KNEE_HIT },
    { at: 8, pose: KNEE_HOLD, stop: true },
    { at: 11, pose: KNEE_DOWN },
    { at: 13, pose: R_STANCE },
  ],
};

// ---- 띄우기: 뒷손 어퍼컷 ----
/** 무릎을 깊이 굽혀 몸을 낮추고 뒷주먹을 허리 아래로 떨어뜨린다 (앞손은 턱) */
const UP_DIP = R({ hx: 0, hy: -14, tl: 22, hd: 8, aFx: 8, aFy: -3, aBx: 6, aBy: 10, lFx: 10, lBx: -9 });
/** 다리를 펴며 뒷주먹을 턱 밑에서 위로 쳐올린다 */
const UP_RISE = R({ hx: 1.5, hy: -20, tl: 10, hd: 0, aFx: 8, aFy: -4, aBx: 10, aBy: -10, lFx: 10, lBx: -8 });
/** 끝까지 솟구쳐 뒷주먹이 머리 위로 (몸이 펴지고 뒷발 끝으로 선다) */
const UP_HIT = R({ hx: 2, hy: -23, tl: 2, hd: -8, aFx: 8, aFy: -5, aBx: 8, aBy: -18, lFx: 10, lBx: -7, lBy: 0 });

/** 띄우기 어퍼컷: 깊이 웅크렸다(4프레임) 다리를 펴며 뒷주먹을 쳐올려(5~7프레임 판정) 머리 위까지, 내려와 가드. 13프레임 20틱 */
export const RAIDEN_UPPERCUT: MotionData = {
  name: 'raiden/uppercut',
  label: '라이덴 띄우기 어퍼컷',
  dur: [1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: UP_DIP },
    { at: 4, pose: UP_RISE },
    { at: 6, pose: UP_HIT },
    { at: 8, pose: UP_HIT, stop: true },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 쓸기: 뒷발 로킥 (상대 종아리를 정강이로 후려 넘어뜨린다) ----
/** 앞발로 살짝 비켜 디디며 몸을 틀어 뒷다리를 감는다 */
const LK_WIND = R({ hx: 1, hy: -19, tl: 12, hd: 6, aFx: 11, aFy: -5, aBx: 6, aBy: -1, lFx: 9, lBx: -12, lBy: -3 });
/** 뒷다리 정강이로 낮게 후려친다: 다리가 앞쪽 무릎 아래 높이로 쭉, 몸은 뒤로 기울이고 가드는 그대로 */
const LK_HIT = R({ hx: 1, hy: -21, tl: -6, hd: 12, aFx: 11, aFy: -7, aBx: 8, aBy: -3, lFx: 7, lBx: 18, lBy: -7 });
/** 휘두른 다리가 지나간다 (멈칫) */
const LK_THRU = R({ hx: 1, hy: -21, tl: -8, hd: 12, aFx: 11, aFy: -7, aBx: 8, aBy: -3, lFx: 7, lBx: 16, lBy: -5 });
/** 다리를 거둬 뒤로 딛는다 */
const LK_BACK = R({ hx: 0, hy: -19, tl: 10, hd: 8, aFx: 12, aFy: -5, lFx: 8, lBx: -7, lBy: -4 });

/** 쓸기 로킥: 몸을 틀어 뒷다리를 감고(4프레임) 정강이로 낮게 후려쳐(5~7프레임 판정) 넘어뜨리고 거둔다. 14프레임 21틱 */
export const RAIDEN_LOW_KICK: MotionData = {
  name: 'raiden/low_kick',
  label: '라이덴 쓸기 로킥',
  dur: [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: LK_WIND },
    { at: 4, pose: LK_HIT },
    { at: 7, pose: LK_THRU, stop: true },
    { at: 10, pose: LK_BACK },
    { at: 13, pose: R_STANCE },
  ],
};

// ---- 대시 공격: 슈퍼맨 펀치 (대시에서 뛰어들며 뒷손을 곧게) ----
/** 대시 자세 (라이덴 지상 대시의 낮게 파고든 자세에서 시작) */
const SP_ENTRY = R({ hx: 3, hy: -13, tl: 36, hd: -10, aFx: 12, aFy: 0, aBx: 8, aBy: 3, lFx: 16, lBx: -16, lBy: 0 });
/** 뒷무릎을 차올리듯 굽혀 뛰어오르며 뒷손을 귀 옆으로 당긴다 */
const SP_HOP = R({ hx: 2, hy: -22, tl: 18, hd: -2, aFx: 10, aFy: -4, aBx: 3, aBy: -6, lFx: 9, lFy: -4, lBx: -10, lBy: -9 });
/** 공중에서 뒷손을 곧게 내지른다: 뒷다리는 뒤로 차 뻗고 앞손은 턱, 몸 전체가 한 줄로 */
const SP_HIT = R({ hx: 3, hy: -21, tl: 32, hd: -6, aFx: 7, aFy: -3, aBx: 21, aBy: -5, lFx: 10, lFy: -2, lBx: -16, lBy: -8 });
/** 내려서며 가드 */
const SP_LAND = R({ hx: 1, hy: -16, tl: 22, hd: 6, aFx: 11, aFy: -3, aBx: 9, aBy: 1, lFx: 10, lBx: -9 });

/** 대시 공격 슈퍼맨 펀치: 대시 자세 → 뛰어오르며 뒷손을 당겨 → 공중에서 뒷손을 곧게(6~7프레임 판정) → 내려서며 가드. 13프레임 23틱 */
export const RAIDEN_SUPERMAN: MotionData = {
  name: 'raiden/superman',
  label: '라이덴 대시 공격 슈퍼맨 펀치',
  dur: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: SP_ENTRY },
    { at: 3, pose: SP_HOP },
    { at: 5, pose: SP_HIT },
    { at: 7, pose: SP_HIT, stop: true },
    { at: 10, pose: SP_LAND },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 공중 평타: 공중 잽 · 공중 스트레이트 · 공중 니킥 · 내려찍기(해머 피스트) ----
/** 공중 기본 (라이덴 점프의 웅크림과 같은 꼴) */
const A_TUCK = R({ hx: 0, hy: -26, tl: 16, hd: 7, aFx: 11, aFy: -4, aBx: 8, aBy: -1, lFx: 7, lFy: -13, lBx: -1, lBy: -11 });
/** 공중 잽: 앞손을 곧게, 다리는 웅크린 채 */
const AJ_HIT = R({ hx: 1, hy: -26, tl: 20, hd: 9, aFx: 18, aFy: -5, aBx: 8, aBy: -1, lFx: 8, lFy: -12, lBx: -2, lBy: -10 });
/** 공중 스트레이트: 허리를 틀어 뒷손을 곧게, 앞손은 턱으로 */
const AS_TURN = R({ hx: 1, hy: -26, tl: 20, hd: 8, aFx: 8, aFy: -4, aBx: 10, aBy: -3, lFx: 7, lFy: -12, lBx: -3, lBy: -10 });
const AS_HIT = R({ hx: 2, hy: -26, tl: 26, hd: 10, aFx: 7, aFy: -4, aBx: 20, aBy: -6, lFx: 8, lFy: -11, lBx: -4, lBy: -9 });
/** 공중 니킥: 두 손으로 끌어당기며 앞무릎을 앞으로 내지른다 */
const AN_LOAD = R({ hx: 0, hy: -26, tl: 22, hd: 8, aFx: 16, aFy: -5, aBx: 14, aBy: -3, lFx: 5, lFy: -10, lBx: -3, lBy: -9 });
const AN_HIT = R({ hx: 1, hy: -26, tl: 4, hd: 10, aFx: 12, aFy: 3, aBx: 10, aBy: 5, lFx: 15, lFy: -16, lBx: -4, lBy: -6 });
/** 해머 피스트: 두 주먹을 깍지 껴 머리 위로 들었다가 */
const HM_UP = R({ hx: -1, hy: -26, tl: 0, hd: -6, aFx: 4, aFy: -17, aBx: 2, aBy: -16, lFx: 7, lFy: -10, lBx: -3, lBy: -8 });
/** 몸을 접으며 아래 앞쪽으로 내리찍는다 */
const HM_HIT = R({ hx: 1, hy: -25, tl: 34, hd: 14, aFx: 13, aFy: 9, aBx: 12, aBy: 10, lFx: 6, lFy: -8, lBx: -4, lBy: -6 });
/** 떨어지는 자세로 (라이덴 낙하 첫 자세) */
const A_OPEN = R({ hx: 0, hy: -25, tl: 14, hd: 7, aFx: 11, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -7, lBx: -6, lBy: -5 });

/** 공중 1타 잽: 앞손을 곧게(4~5프레임 판정). 12프레임 13틱 */
export const RAIDEN_AIR_JAB: MotionData = {
  name: 'raiden/air_jab',
  label: '라이덴 공중 1타 잽',
  dur: [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 2, pose: A_TUCK },
    { at: 3, pose: AJ_HIT },
    { at: 5, pose: AJ_HIT, stop: true },
    { at: 11, pose: A_TUCK },
  ],
};
/** 공중 2타 스트레이트: 허리를 틀어 뒷손을 곧게(4~5프레임 판정). 12프레임 13틱 */
export const RAIDEN_AIR_CROSS: MotionData = {
  name: 'raiden/air_cross',
  label: '라이덴 공중 2타 스트레이트',
  dur: [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 2, pose: AS_TURN },
    { at: 3, pose: AS_HIT },
    { at: 5, pose: AS_HIT, stop: true },
    { at: 11, pose: A_TUCK },
  ],
};
/** 공중 3타 니킥: 두 손으로 끌어당기며 앞무릎을 내질러(5~6프레임 판정) 비스듬히 날린다. 13프레임 17틱 */
export const RAIDEN_AIR_KNEE: MotionData = {
  name: 'raiden/air_knee',
  label: '라이덴 공중 3타 니킥',
  dur: [1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 3, pose: AN_LOAD },
    { at: 4, pose: AN_HIT },
    { at: 6, pose: AN_HIT, stop: true },
    { at: 12, pose: A_TUCK },
  ],
};
/** 내려찍기 해머 피스트: 두 주먹을 머리 위로 들었다가(4프레임) 몸을 접으며 내리찍어(6~8프레임 판정) 낙하 자세로. 14프레임 20틱 */
export const RAIDEN_HAMMER: MotionData = {
  name: 'raiden/hammer',
  label: '라이덴 내려찍기 해머 피스트',
  dur: [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 3, pose: HM_UP },
    { at: 5, pose: HM_HIT },
    { at: 8, pose: HM_HIT, stop: true },
    { at: 13, pose: A_OPEN },
  ],
};

export const RAIDEN_ATTACK_MOTIONS: readonly MotionData[] = [
  RAIDEN_JAB, RAIDEN_CROSS, RAIDEN_HOOK, RAIDEN_KNEE, RAIDEN_UPPERCUT, RAIDEN_LOW_KICK, RAIDEN_SUPERMAN,
  RAIDEN_AIR_JAB, RAIDEN_AIR_CROSS, RAIDEN_AIR_KNEE, RAIDEN_HAMMER,
];
