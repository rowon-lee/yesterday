import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 스킬 (캐릭터 기획서 '버튼'). 기본자세에서 시작해 기본자세로 끝난다. 수치는 data/characters/raiden.ts의 moves.
 */

// ---- 스킬 1: 잔흔 (붉은 잔상을 남기며 앞으로 순간이동해 들어가, 나타나자마자 하이킥) ----
/** 몸을 낮게 숙여 웅크린다: 이 자세가 떠난 자리에 붉은 잔상으로 남는다 */
const ZH_PREP = R({ hx: 1, hy: -14.5, tl: 32, hd: 6, aFx: 11, aFy: -1, aBx: 6, aBy: 3, lFx: 12, lBx: -12 });
/** 나타남: 상대 바로 앞에 낮게 웅크린 채 나타난다 (뒷다리에 힘을 싣는다) */
const ZH_ARRIVE = R({ hx: 2.5, hy: -14, tl: 26, hd: 2, aFx: 12, aFy: -3, aBx: 7, aBy: 2, lFx: 9, lBx: -13 });
/** 솟으며 뒷무릎을 가슴 앞으로 높이 끌어올린다 (앞발 하나로 버팀, 몸은 뒤로 젖히기 시작) */
const ZH_CHAMBER = R({ hx: 1, hy: -21, tl: -4, hd: 10, aFx: 10, aFy: -8, aBx: 6, aBy: -3, lFx: 3, lBx: 5, lBy: -15 });
/** 뒷다리를 머리 높이로 크게 휘둘러 찬다: 몸을 뒤로 크게 젖히고 두 손은 가드 */
const ZH_KICK = R({ hx: 1.5, hy: -22, tl: -16, hd: 14, aFx: 9, aFy: -9, aBx: 5, aBy: -5, lFx: 1, lBx: 20, lBy: -40 });
const ZH_KICK_HOLD = R({ hx: 1.5, hy: -22, tl: -17, hd: 14, aFx: 9, aFy: -9, aBx: 5, aBy: -5, lFx: 1, lBx: 20, lBy: -41 });
/** 찬 다리가 끝까지 지나가며 내려온다 */
const ZH_THRU = R({ hx: 1, hy: -21, tl: -8, hd: 12, aFx: 10, aFy: -8, aBx: 6, aBy: -4, lFx: 2, lBx: 14, lBy: -20 });
/** 다리를 거둬 뒤로 딛는다 */
const ZH_RETRACT = R({ hx: 0, hy: -19, tl: 8, hd: 9, aFx: 12, aFy: -5, aBx: 8, aBy: -1, lFx: 5, lBx: -4, lBy: -6 });

/**
 * 스킬 1 잔흔: 낮게 웅크렸다(2프레임) 사라져 3프레임이 시작하는 틱에 앞으로 순간이동(최대 150px, 상대가 있으면 바로 앞)해
 * 웅크린 채 나타나고(3프레임) 뒷무릎을 끌어올려(4프레임) 머리 높이로 크게 휘둘러 찬다(5~6프레임 판정). 13프레임 25틱
 */
export const RAIDEN_ZANHEN: MotionData = {
  name: 'raiden/zanhen',
  label: '라이덴 스킬 1 잔흔',
  dur: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: ZH_PREP, stop: true },
    { at: 2, pose: ZH_ARRIVE, stop: true },
    { at: 3, pose: ZH_CHAMBER },
    { at: 4, pose: ZH_KICK },
    { at: 5, pose: ZH_KICK_HOLD, stop: true },
    { at: 7, pose: ZH_THRU },
    { at: 9, pose: ZH_RETRACT },
    { at: 12, pose: R_STANCE },
  ],
};

export const RAIDEN_SKILL_MOTIONS: readonly MotionData[] = [RAIDEN_ZANHEN];
