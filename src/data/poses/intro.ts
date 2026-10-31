import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/*
 * 등장 (기획서 '캐릭터 구성'의 등장·승리). 기본 스틱맨의 기본형이다. 오른쪽을 보는 기준.
 * 경기 첫 라운드 시작 연출(INTRO_TICKS) 동안 한 번 재생하고 기본자세로 끝난다 (sim/state.ts).
 */

const P = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o });

/** 위에서 내려선 자세: 뒷무릎을 땅에 꿇고, 앞발을 앞에 딛고, 앞주먹으로 땅을 짚고, 뒷팔은 뒤로 뻗는다. 고개는 숙였다 */
const IN_LAND = P({ hx: -1, hy: -11, tl: 38, hd: 22, aFx: 4, aFy: 21, aBx: -14, aBy: -6, lFx: 10, lFy: 0, lBx: -12, lBy: 0 });
/** 그대로 버틴다 (내려선 충격을 받는다: 조금 더 낮게) */
const IN_HOLD = P({ hx: -1, hy: -10, tl: 40, hd: 24, aFx: 4, aFy: 22, aBx: -13, aBy: -4, lFx: 10, lFy: 0, lBx: -12, lBy: 0 });
/** 고개를 들며 몸을 일으킨다: 주먹이 땅에서 떨어진다 */
const IN_RISE = P({ hx: -1, hy: -14, tl: 26, hd: 2, aFx: 6, aFy: 14, aBx: -10, aBy: 4, lFx: 10, lFy: 0, lBx: -11, lBy: 0 });
/** 일어선다: 앞을 똑바로 본다 */
const IN_UP = P({ hx: 0, hy: -19, tl: 10, hd: -4, aFx: 7, aFy: 9, aBx: 2, aBy: 11, lFx: 9, lFy: 0, lBx: -9, lBy: 0 });
/** 앞주먹을 가슴 앞으로 끌어올려 쥐어 보인다: 뒷팔은 뒤로 당기고 몸을 살짝 젖힌다 */
const IN_FIST = P({ hx: 0, hy: -20, tl: 2, hd: -8, aFx: 8, aFy: -5, aBx: -6, aBy: 9, lFx: 9, lFy: 0, lBx: -9, lBy: 0 });
/** 쥔 주먹을 버틴다 (멈칫) */
const IN_FIST2 = P({ hx: 0, hy: -20, tl: 4, hd: -6, aFx: 9, aFy: -6, aBx: -6, aBy: 8, lFx: 9, lFy: 0, lBx: -9, lBy: 0 });

/**
 * 등장: 내려선 자세(1~3프레임) → 고개를 들고 일어선다(4~7프레임) → 주먹을 쥐어 보인다(8~11프레임) → 기본자세(12~13프레임).
 * 모두 65틱 (라운드 시작 연출 70틱 안에 끝난다).
 */
export const INTRO: MotionData = {
  name: 'base/intro',
  label: '등장',
  dur: [5, 8, 6, 5, 5, 4, 4, 5, 5, 5, 5, 4, 4],
  keys: [
    { at: 0, pose: IN_LAND },
    { at: 2, pose: IN_HOLD, stop: true },
    { at: 4, pose: IN_RISE },
    { at: 6, pose: IN_UP },
    { at: 8, pose: IN_FIST },
    { at: 10, pose: IN_FIST2, stop: true },
    { at: 12, pose: STANCE },
  ],
};
