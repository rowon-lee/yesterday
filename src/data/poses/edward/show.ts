import type { MotionData } from '../../../anim/motion';
import { E, E_STANCE, grip2 } from './stance';

/*
 * 에드워드 등장 (2026-11-02 피드백 12-5: 히어로 랜딩 대신 당당하게 선 채로 떨어진다, 80틱).
 * 0~20틱 화면 위에서 꼿꼿이 선 자세로 수직 낙하 (해머는 어깨, 넥타이·코트 자락이 위로 펄럭) → 20~24틱 두 발로 착지 (무릎은 거의 안 굽힘,
 * 바닥에 방사형 균열·먼지·충격파 고리, 화면 흔들림: 렌더) → 24~40틱 껍데기가 푸른 장막으로 한 번 비친다 (렌더) →
 * 40~80틱 먼지가 가라앉는 동안 선 채로 빈 손으로 넥타이를 한 번 고쳐 맨다 → 대기.
 * 떨어지는 높이는 렌더가 정한다 (render/chars/edward.ts introLift: 그림은 발밑 기준 그대로, 판을 위에서 떨어뜨린다).
 */

/** 등장 연출 틱: 보이지 않음 (없음) → 떨어짐 → 착지(쿵) → 껍데기가 비침 */
export const EDWARD_INTRO_T = { hide: 0, land: 20, veil: 24 } as const;

// ---- 등장 ----
/** 떨어지는 중: 꼿꼿이 선 채 (턱을 들고 해머는 어깨, 뒷손은 주머니), 넥타이·코트 자락이 위로 펄럭인다 */
const IN_FALL = E({ hx: 0, hy: -23.5, tl: -3, hd: -7, lFx: 5, lFy: 0, lBx: -6, lBy: 0, wind: 1 });
/** 두 발로 닿는다: 무릎은 거의 굽히지 않는다 */
const IN_TOUCH = E({ hx: 0, hy: -21.6, tl: 1, hd: -4, lFx: 6, lBx: -7, wind: 0.4 });
/** 받은 힘을 버틴다 (1.5px 내려앉는다), 자락이 내려앉는다 */
const IN_DIP = E({ hx: 0, hy: -21.2, tl: 2, hd: -3, lFx: 6.5, lBx: -7, wind: 0 });
/** 선다: 턱을 든다 (해머 머리는 착지에 눌렸다가 늦게 떠오른다) */
const IN_STAND = E({ hd: -7, wa: -153 });
/** 껍데기가 비치는 동안 가슴을 더 펴고 턱을 든다 (해머가 어깨에 늦게 자리 잡는다) */
const IN_PROUD = E({ hy: -23, tl: -6, hd: -10, aFy: 6, wa: -143 });
const IN_PROUD2 = E({ hy: -23.1, tl: -6.3, hd: -10.5, aFy: 6.1, wa: -147 });
/** 빈 뒷손을 주머니에서 빼 넥타이 매듭으로 */
const IN_TIE_REACH = E({ hd: -8, tl: -4, aBx: 6.5, aBy: 0.5 });
/** 매듭을 쥐고 당겨 고쳐 맨다 (턱을 더 든다) */
const IN_TIE_TUG = E({ hd: -11, tl: -5, aBx: 6, aBy: 2.5 });
const IN_TIE_TUG2 = E({ hd: -9, tl: -4.5, aBx: 6.5, aBy: 0.8 });
/** 손을 내려 다시 주머니로 */
const IN_TIE_DONE = E({ hd: -6, tl: -4, aBx: 1, aBy: 9 });

/**
 * 등장: 선 채로 수직 낙하(1프레임 20틱) → 두 발로 쿵(2~3) → 선다(4~6, 껍데기가 비치는 동안 가슴을 펴고 턱을 들며 해머가 늦게 자리 잡음) →
 * 넥타이를 고쳐 맨다(7~12) → 기본자세(13~14). 14프레임 80틱 (2차 리워크: 같은 자세가 이어지던 5번을 바꿈)
 */
export const EDWARD_INTRO: MotionData = {
  name: 'edward/intro',
  label: '에드워드 등장',
  dur: [20, 2, 2, 4, 8, 8, 6, 6, 6, 6, 4, 4, 2, 2],
  keys: [
    { at: 0, pose: IN_FALL },
    { at: 1, pose: IN_TOUCH },
    { at: 2, pose: IN_DIP, stop: true },
    { at: 3, pose: IN_STAND },
    { at: 4, pose: IN_PROUD },
    { at: 5, pose: IN_PROUD2, stop: true },
    { at: 7, pose: IN_TIE_REACH, stop: true },
    { at: 8, pose: IN_TIE_TUG },
    { at: 9, pose: IN_TIE_TUG2 },
    { at: 10, pose: IN_TIE_TUG, stop: true },
    { at: 11, pose: IN_TIE_DONE },
    { at: 13, pose: E_STANCE },
  ],
};

// ---- 승리: 해머를 바닥에 세우고 손잡이 끝에 두 손을 포갠다 ----
/** 해머를 어깨에서 들어 머리 위로 넘긴다 (손은 배 앞으로 내려 해머 머리가 낮게 지난다) */
const W_LIFT = E({ hx: 0.5, hy: -22, tl: -1, hd: -2, aFx: 7, aFy: 13, aBx: -3, aBy: 10, lFx: 7, lBx: -7, wa: -100 });
/** 앞으로 내려 돌린다 */
const W_SWING = E({ hx: 0.5, hy: -22, tl: 2, hd: -2, aFx: 11, aFy: 8, aBx: -3, aBy: 10, lFx: 7, lBx: -7, wa: -20 });
/** 해머 머리를 바닥에 쿵 세운다 (손잡이가 똑바로 선다) */
const W_PLANT = grip2(E({ hx: 1, hy: -21, tl: 8, hd: 2, aFx: 13, aFy: 10.5, lFx: 7, lBx: -8, wa: 90 }), 2.5);
/** 손잡이 끝에 두 손을 포개고 가슴을 펴 턱을 든다 */
const W_REST = grip2(E({ hx: 0, hy: -22.5, tl: -3, hd: -10, aFx: 12.5, aFy: 12, lFx: 5, lBx: -5, wa: 90 }), 2.5);
const W_REST2 = grip2(E({ hx: 0, hy: -22.8, tl: -4, hd: -12, aFx: 12.5, aFy: 12.2, lFx: 5, lBx: -5, wa: 90 }), 2.5);

/** 승리: 해머를 어깨에서 내려 → 바닥에 세우고 → 손잡이 끝에 두 손을 포개고 턱을 든다. 14프레임 × 3~4틱 (끝 자세에 머문다) */
export const EDWARD_WIN: MotionData = {
  name: 'edward/win',
  label: '에드워드 승리',
  dur: [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 2, pose: W_LIFT },
    { at: 4, pose: W_SWING },
    { at: 5, pose: W_PLANT, stop: true },
    { at: 8, pose: W_REST },
    { at: 11, pose: W_REST2, stop: true },
    { at: 13, pose: W_REST2 },
  ],
};

export const EDWARD_SHOW_MOTIONS: readonly MotionData[] = [EDWARD_INTRO, EDWARD_WIN];
