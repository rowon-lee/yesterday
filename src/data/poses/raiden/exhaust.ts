import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 탈진 (캐릭터 기획서 '차지 투전승불: 최고 단계로 쓰면 짧게 탈진한다(패널티)', 사용자 피드백 2026-11-02 9-1).
 * 투전승불 4단계를 치고 나면 한쪽 무릎을 꿇고 앞무릎을 짚은 채 어깨로 숨을 몰아쉰다 (그동안 아무것도 못 하고, 맞으면 그대로 맞는다).
 * 김(어깨·등에서 오르는 것)은 렌더가 그린다 (render/fightvfx.ts raidenChargeTick).
 */

/** 주저앉는 중: 엉덩이가 내려가며 몸이 앞으로 숙는다 */
const EX_DROP = R({ hx: -1, hy: -15, tl: 28, hd: 12, aFx: 6, aFy: 8, aBx: 3, aBy: 10, lFx: 10, lBx: -11 });
/** 내쉼: 뒷무릎이 바닥에 닿고(정강이가 바닥에 눕는다) 앞손으로 앞무릎을 짚는다. 어깨가 내려앉고 고개를 떨군다 */
const EX_OUT = R({ hx: -1, hy: -12, tl: 38, hd: 20, aFx: 4, aFy: 12, aBx: 1, aBy: 15, lFx: 10, lBx: -12, lBy: -1 });
/** 들이쉼: 어깨가 들썩 올라가고 고개가 조금 든다 */
const EX_IN = R({ hx: -1, hy: -12.5, tl: 32, hd: 13, aFx: 4, aFy: 11, aBx: 1.5, aBy: 13.5, lFx: 10, lBx: -12, lBy: -1 });
/** 무릎을 짚고 일어서며 가드를 다시 올린다 */
const EX_RISE = R({ hx: -0.5, hy: -16, tl: 24, hd: 12, aFx: 10, aFy: 0, aBx: 6, aBy: 4, lFx: 9, lBx: -10 });

/** 탈진: 주저앉아(1~2프레임) 세 번 숨을 몰아쉬고(3~10프레임) 무릎을 짚고 일어나 가드(11~12프레임). 12프레임 40틱 (sim은 탈진 길이에 맞춰 늘인다) */
export const RAIDEN_EXHAUST: MotionData = {
  name: 'raiden/exhaust',
  label: '라이덴 탈진 (투전승불 4단계 뒤)',
  dur: [3, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3, 3],
  keys: [
    { at: 0, pose: EX_DROP },
    { at: 1, pose: EX_OUT, stop: true },
    { at: 3, pose: EX_IN },
    { at: 4, pose: EX_OUT, stop: true },
    { at: 6, pose: EX_IN },
    { at: 7, pose: EX_OUT, stop: true },
    { at: 9, pose: EX_IN },
    { at: 10, pose: EX_RISE },
    { at: 11, pose: R_STANCE },
  ],
};
