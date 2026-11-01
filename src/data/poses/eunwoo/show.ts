import type { MotionData } from '../../../anim/motion';
import { E, E_STANCE } from './stance';

/*
 * 백은우 등장·승리 (캐릭터 기획서 '등장 연출').
 * 등장: 흰 나비 떼가 날아와 한 자리에 모인다. 나비들이 흩어지면 그 자리에 은우가 서 있고, 가운 자락이 천천히 내려앉는다.
 * 나비 몇 마리는 어깨 주위를 돌다 사라진다 (나비·감춤은 렌더: render/chars/eunwoo.ts). 경기 첫 라운드 시작 연출(70틱) 안에 끝난다.
 * 승리: 은우는 사람을 죽이지 않는다 — 연검을 접어 넣고, 두 손을 모아 가볍게 고개를 숙인다.
 */

// ---- 등장 ----
/** 나비 속에서 막 생겨난 모습: 발끝으로 서서 고개를 숙이고 팔을 살짝 벌린다 (가운이 떠 있다) */
const IN_FORM = E({ hx: 0, hy: -23, tl: 2, hd: 16, aFx: 8, aFy: 10, aBx: -8, aBy: 10, lFx: 4, lFy: -1, lBx: -4, lBy: -1 });
/** 나비가 흩어지며 팔이 떠오르고 고개를 든다 */
const IN_REVEAL = E({ hx: 0, hy: -23, tl: -2, hd: 2, aFx: 12, aFy: -2, aBx: -12, aBy: -2, lFx: 4, lFy: -1, lBx: -4, lBy: -1 });
/** 뒤꿈치를 내리고 무릎을 풀며 팔이 내려온다 (가운 자락이 내려앉는다) */
const IN_SETTLE = E({ hx: 0, hy: -21.5, tl: 2, hd: 4, aFx: 10, aFy: 8, aBx: -7, aBy: 12, lFx: 6, lFy: 0, lBx: -6, lBy: 0 });
/** 어깨 위를 도는 나비를 뒷손으로 배웅하듯 어깨에 손을 올리고 고개를 기울인다 */
const IN_BUTTERFLY = E({ hx: 0, hy: -21.5, tl: 0, hd: 12, aFx: 10, aFy: 8, aBx: 8, aBy: -7, lFx: 6, lFy: 0, lBx: -6, lBy: 0 });

/**
 * 등장: 나비 속에서 생겨남(1프레임 18틱, 렌더가 나비 떼로 덮는다) → 나비가 흩어지며 팔이 떠오름(2~3) → 내려앉음(4~6) →
 * 어깨의 나비를 배웅(7~9) → 기본자세(10~14). 14프레임 62틱
 */
export const EUNWOO_INTRO: MotionData = {
  name: 'eunwoo/intro',
  label: '백은우 등장',
  dur: [18, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: IN_FORM },
    { at: 1, pose: IN_FORM, stop: true },
    { at: 3, pose: IN_REVEAL, stop: true },
    { at: 6, pose: IN_SETTLE },
    { at: 8, pose: IN_BUTTERFLY, stop: true },
    { at: 10, pose: IN_SETTLE },
    { at: 13, pose: E_STANCE },
  ],
};

// ---- 승리 ----
/** 몸을 곧게 세우며 연검을 내린다, 발을 모은다 */
const W_STRAIGHT = E({ hx: 0, hy: -23, tl: 0, hd: -2, aFx: 6, aFy: 12, aBx: -4, aBy: 13, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });
/** 연검을 접어 뒤허리의 칼집에 넣는다 */
const W_SHEATH = E({ hx: 0, hy: -23, tl: 4, hd: 6, aFx: -5, aFy: 12, aBx: -2, aBy: 12, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });
/** 두 손을 앞에 모아 가볍게 고개를 숙인다 */
const W_BOW = E({ hx: -0.5, hy: -22.5, tl: 22, hd: 16, aFx: 7, aFy: 10, aBx: 6, aBy: 11, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });
/** 몸을 세우고 두 손을 모은 채 고개를 조금 기울인다 */
const W_REST = E({ hx: 0, hy: -23, tl: 2, hd: 9, aFx: 6, aFy: 9, aBx: 5, aBy: 10, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });

/** 승리: 곧게 섬 → 연검을 접어 넣음 → 두 손을 모아 고개를 숙임 → 세우고 고개를 기울임. 14프레임 × 3틱 (끝 자세에 머문다) */
export const EUNWOO_WIN: MotionData = {
  name: 'eunwoo/win',
  label: '백은우 승리',
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 3, pose: W_STRAIGHT },
    { at: 5, pose: W_SHEATH, stop: true },
    { at: 9, pose: W_BOW, stop: true },
    { at: 12, pose: W_REST },
    { at: 13, pose: W_REST },
  ],
};

export const EUNWOO_SHOW_MOTIONS: readonly MotionData[] = [EUNWOO_INTRO, EUNWOO_WIN];
