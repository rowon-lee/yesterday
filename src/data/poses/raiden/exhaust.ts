import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 탈진 (캐릭터 기획서 '차지 투전승불: 최고 단계로 쓰면 짧게 탈진한다(패널티)').
 * 투전승불 4단계를 치고 나면 무릎에 손을 짚고 숨을 몰아쉰다 (그동안 아무것도 못 하고, 맞으면 그대로 맞는다).
 */

/** 무릎에 두 손을 짚고 허리를 숙인다: 고개는 떨구고 어깨가 들썩인다 (들이쉼) */
const EX_IN = R({ hx: -1, hy: -17, tl: 38, hd: 14, aFx: 9, aFy: 14, aBx: 5, aBy: 15, lFx: 10, lBx: -9 });
/** 내쉼: 어깨가 내려앉고 몸이 더 숙는다 */
const EX_OUT = R({ hx: -1, hy: -16, tl: 42, hd: 18, aFx: 9, aFy: 16, aBx: 5, aBy: 17, lFx: 10, lBx: -9 });
/** 고개를 들며 몸을 일으켜 가드를 다시 올린다 */
const EX_UP = R({ hx: -0.5, hy: -18.5, tl: 22, hd: 10, aFx: 11, aFy: 0, aBx: 7, aBy: 3, lFx: 9, lBx: -9 });

/** 탈진: 무릎을 짚고 두 번 숨을 몰아쉬다(1~9프레임) 몸을 일으켜 가드(10~12프레임). 12프레임 × 3틱 = 36틱 (sim은 탈진 길이에 맞춰 늘인다) */
export const RAIDEN_EXHAUST: MotionData = {
  name: 'raiden/exhaust',
  label: '라이덴 탈진 (투전승불 4단계 뒤)',
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: EX_IN },
    { at: 2, pose: EX_OUT, stop: true },
    { at: 4, pose: EX_IN },
    { at: 6, pose: EX_OUT, stop: true },
    { at: 8, pose: EX_IN },
    { at: 10, pose: EX_UP },
    { at: 11, pose: R_STANCE },
  ],
};
