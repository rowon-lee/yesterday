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

export const RAIDEN_ATTACK_MOTIONS: readonly MotionData[] = [RAIDEN_JAB, RAIDEN_CROSS, RAIDEN_HOOK, RAIDEN_KNEE];
