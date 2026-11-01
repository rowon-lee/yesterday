import type { MotionData } from '../../../anim/motion';
import { E, E_STANCE, grip2 } from './stance';

/*
 * 에드워드 등장·승리 (캐릭터 기획서 '등장 연출': 화면 위 하늘에서 떨어져 해머와 함께 착지한다. 바닥이 패이고 먼지와 충격파가 퍼지며,
 * 착지 충격을 대신 받은 껍데기가 푸른 장막으로 한 번 비친다. 몸을 일으키며 해머를 어깨에 걸친다).
 * 처음 EDWARD_INTRO.hide틱은 보이지 않고, 떨어지는 높이는 렌더가 정한다 (render/chars/edward.ts: 그림은 발밑 기준 그대로, 판을 위에서 떨어뜨린다).
 * 경기 첫 라운드 시작 연출(70틱) 안에 끝난다.
 */

/** 등장 연출 틱: 보이지 않음 → 떨어짐 → 착지(쿵) → 껍데기가 비침 */
export const EDWARD_INTRO_T = { hide: 8, land: 12, veil: 15 } as const;

// ---- 등장 ----
/** 하늘에서 떨어지는 중: 무릎을 당기고 해머를 두 손으로 어깨 뒤에 치켜 감는다 */
const IN_FALL = grip2(E({ hx: 0, hy: -26, tl: -4, hd: -10, aFx: 3, aFy: -3, lFx: 7, lFy: -9, lBx: -5, lBy: -7, wa: -128 }));
/** 땅에 닿기 직전: 다리를 펴 내리고 해머를 머리 위로 넘겨 내리치기 시작한다 */
const IN_FALL2 = grip2(E({ hx: 0, hy: -24, tl: 8, hd: -4, aFx: 9, aFy: 2, lFx: 9, lFy: -3, lBx: -9, lBy: -3, wa: -62 }));
/** 쿵: 가장 깊이 내려앉으며 해머 머리를 발 앞 바닥에 박는다 (두 손으로 손잡이를 누른다) */
const IN_IMPACT = grip2(E({ hx: -1, hy: -12, tl: 30, hd: 8, aFx: 13, aFy: 9, lFx: 12, lBx: -13, wa: 62 }));
/** 받은 힘을 버틴다 (조금 솟는다) */
const IN_HOLD = grip2(E({ hx: -1, hy: -13, tl: 28, hd: 6, aFx: 13, aFy: 9.5, lFx: 12, lBx: -13, wa: 64 }));
/** 고개를 들어 상대를 본다 */
const IN_LOOK = grip2(E({ hx: -1, hy: -13.5, tl: 24, hd: -14, aFx: 13, aFy: 9.5, lFx: 12, lBx: -13, wa: 64 }));
/** 일어서며 해머를 바닥에서 뽑아 앞으로 든다 */
const IN_RISE = grip2(E({ hx: 0, hy: -19, tl: 6, hd: -4, aFx: 12, aFy: 1, lFx: 9, lBx: -10, wa: -10 }));
/** 해머를 머리 위로 크게 돌려 (손은 가슴 앞, 해머 머리가 머리 위를 지난다) */
const IN_SWING = E({ hx: 0, hy: -21.5, tl: -4, hd: -6, aFx: 6, aFy: 4, aBx: -5, aBy: 8, lFx: 8, lBx: -9, wa: -105 });
/** 어깨에 턱 걸친다 */
const IN_SHOULDER = E({ hx: 0, hy: -21.8, tl: -3, hd: -3, aFx: 5, aFy: 5, aBx: -4, aBy: 9, lFx: 7, lBx: -8, wa: -155 });
/** 뒷손으로 넥타이를 고쳐 맨다 (턱을 든다) */
const IN_TIE = E({ hx: 0, hy: -22.5, tl: -4, hd: -8, aFx: 5, aFy: 5.5, aBx: 6.5, aBy: 1.5, lFx: 6, lBx: -7, wa: -151 });

/**
 * 등장: 보이지 않음(1프레임 8틱) → 하늘에서 떨어짐(2~3프레임) → 쿵! 해머를 바닥에 박고 착지(4~6프레임, 껍데기가 비침) →
 * 고개를 듦(7) → 일어나 해머를 뽑아 머리 위로 돌려 어깨에 걸침(8~10) → 넥타이를 고쳐 매고(11~12) 기본자세(13~14). 14프레임 64틱
 */
export const EDWARD_INTRO: MotionData = {
  name: 'edward/intro',
  label: '에드워드 등장',
  dur: [8, 2, 2, 3, 6, 6, 6, 4, 3, 4, 6, 6, 4, 4],
  keys: [
    { at: 0, pose: IN_FALL },
    { at: 1, pose: IN_FALL, stop: true },
    { at: 2, pose: IN_FALL2, stop: true },
    { at: 3, pose: IN_IMPACT, stop: true },
    { at: 4, pose: IN_HOLD },
    { at: 5, pose: IN_HOLD, stop: true },
    { at: 6, pose: IN_LOOK, stop: true },
    { at: 7, pose: IN_RISE },
    { at: 8, pose: IN_SWING },
    { at: 9, pose: IN_SHOULDER, stop: true },
    { at: 10, pose: IN_TIE },
    { at: 11, pose: IN_TIE, stop: true },
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
