import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 등장·승리 (캐릭터 기획서 '등장 연출').
 * 등장 (사용자 요청 2026-11-01): 붉은 번개가 쾅! 내리꽂히고, 그 번개 속에서 순간이동해 온 것처럼 떨어져 히어로 랜딩.
 * 한쪽 무릎과 앞주먹을 바닥에 박고 고개를 숙였다가, 고개를 들어 상대를 보고 일어나 가드를 올린다.
 * 경기 첫 라운드 시작 연출(70틱) 안에 끝난다. 처음 6틱은 보이지 않고, 번개와 함께 위에서 떨어지는 높이는 렌더가 정한다
 * (render/fightvfx.ts RAIDEN_INTRO: 그림은 발밑 기준 그대로, 판은 54px 위에서 4틱 동안 떨어진다).
 */

// ---- 등장 ----
/** 떨어지는 중: 몸을 웅크리고 앞주먹을 아래로 겨누고, 뒷팔은 뒤로 높이 젖힌다 */
const IN_FALL = R({ hx: 0, hy: -24, tl: 24, hd: 14, aFx: 7, aFy: 10, aBx: -12, aBy: -10, lFx: 7, lFy: -7, lBx: -8, lBy: -9 });
/** 땅에 닿기 직전: 다리를 펴 내리고 앞주먹을 땅으로 내지른다 */
const IN_FALL2 = R({ hx: 0, hy: -22, tl: 34, hd: 16, aFx: 6, aFy: 13, aBx: -13, aBy: -9, lFx: 8, lFy: -4, lBx: -10, lBy: -5 });
/** 쾅: 가장 깊이 내려앉는다. 앞발은 앞에 딛고 뒷무릎은 바닥, 앞주먹은 바닥에 박고 뒷팔은 뒤로 뻗는다 */
const IN_IMPACT = R({ hx: -2, hy: -10, tl: 64, hd: 22, aFx: 8, aFy: 17.5, aBx: -15, aBy: -7, lFx: 7, lFy: 0, lBx: -15, lBy: 0 });
/** 히어로 랜딩: 받은 힘을 버티며 조금 솟는다 (고개는 숙인 채) */
const IN_HERO = R({ hx: -2, hy: -11, tl: 62, hd: 24, aFx: 7.8, aFy: 17, aBx: -15, aBy: -8, lFx: 7, lFy: 0, lBx: -15, lBy: 0 });
/** 숨을 한 번 고른다 (어깨가 조금 들린다) */
const IN_HERO2 = R({ hx: -2, hy: -11.5, tl: 60, hd: 24, aFx: 7.5, aFy: 17, aBx: -15, aBy: -9, lFx: 7, lFy: 0, lBx: -15, lBy: 0 });
/** 고개를 들어 상대를 본다 */
const IN_LOOKUP = R({ hx: -2, hy: -11.5, tl: 56, hd: -20, aFx: 7, aFy: 17, aBx: -14, aBy: -8, lFx: 7, lFy: 0, lBx: -15, lBy: 0 });
/** 주먹으로 바닥을 밀며 뒷무릎을 세워 일어난다 */
const IN_RISE = R({ hx: -1, hy: -15, tl: 34, hd: -4, aFx: 8, aFy: 10, aBx: -6, aBy: 2, lFx: 8, lFy: 0, lBx: -12, lBy: -2 });
/** 일어서며 가드를 올린다 (기본자세보다 조금 높게) */
const IN_GUARD = R({ hx: -0.5, hy: -20, tl: 14, hd: 4, aFx: 12, aFy: -6, aBx: 8, aBy: -2, lFx: 8, lFy: 0, lBx: -9, lBy: 0 });
/** 스텝을 밟기 시작한다: 웅크렸다 (대기의 웅크림과 같은 꼴) */
const IN_SQUASH = R({ hx: 0, hy: -17, tl: 18, hd: 11, aFx: 12.5, aFy: -2.5, aBx: 8, aBy: 1.5 });

/**
 * 등장: 보이지 않음(1프레임 6틱) → 번개와 함께 떨어짐(2~3프레임) → 쾅! 히어로 랜딩(4~6프레임) → 고개를 들어 상대를 봄(7프레임) →
 * 바닥을 밀고 일어나 가드를 올림(8~11프레임) → 한 번 웅크렸다 기본자세(12~14프레임). 14프레임 55틱 (라운드 시작 연출 70틱 안).
 * 번개·충격·먼지·떨어지는 높이는 렌더
 */
export const RAIDEN_INTRO: MotionData = {
  name: 'raiden/intro',
  label: '라이덴 등장',
  dur: [6, 2, 2, 2, 6, 8, 6, 4, 4, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: IN_FALL },
    { at: 1, pose: IN_FALL, stop: true },
    { at: 2, pose: IN_FALL2, stop: true },
    { at: 3, pose: IN_IMPACT, stop: true },
    { at: 4, pose: IN_HERO },
    { at: 6, pose: IN_HERO2, stop: true },
    { at: 7, pose: IN_LOOKUP, stop: true },
    { at: 8, pose: IN_RISE },
    { at: 10, pose: IN_GUARD, stop: true },
    { at: 11, pose: IN_SQUASH },
    { at: 13, pose: R_STANCE },
  ],
};

// ---- 승리 ----
/** 가드를 내리고 몸을 편다: 주먹을 허리 높이로 내리고 고개를 든다 */
const W_LOOSE = R({ hx: 0, hy: -22, tl: 4, hd: -4, aFx: 6, aFy: 9, aBx: 2, aBy: 11, lFx: 9, lFy: 0, lBx: -9, lBy: 0 });
/** 목을 한 번 꺾어 푼다: 고개가 뒤로 젖혀지고 어깨가 들린다 */
const W_NECK = R({ hx: 0, hy: -22, tl: 0, hd: -16, aFx: 6, aFy: 7, aBx: 1, aBy: 9, lFx: 9, lFy: 0, lBx: -9, lBy: 0 });
/** 앞주먹을 머리 위로 곧게 치켜든다: 가슴을 펴고, 뒷주먹은 허리에, 다리는 넓게 버틴다 */
const W_FIST = R({ hx: 0, hy: -21, tl: -4, hd: -10, aFx: 4, aFy: -18, aBx: -3, aBy: 9, lFx: 10, lFy: 0, lBx: -11, lBy: 0 });
/** 치켜든 주먹을 한 번 더 밀어 올리며 멈춘다 */
const W_FIST2 = R({ hx: 0, hy: -21.5, tl: -5, hd: -12, aFx: 3, aFy: -19, aBx: -3, aBy: 8, lFx: 10, lFy: 0, lBx: -11, lBy: 0 });

/** 승리: 가드를 내리고 몸을 폄 → 목을 꺾어 풂 → 앞주먹을 머리 위로 치켜들고 멈춤. 14프레임 × 3틱 (끝 자세에 머문다) */
export const RAIDEN_WIN: MotionData = {
  name: 'raiden/win',
  label: '라이덴 승리',
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: W_LOOSE },
    { at: 6, pose: W_NECK, stop: true },
    { at: 9, pose: W_FIST },
    { at: 11, pose: W_FIST2, stop: true },
    { at: 13, pose: W_FIST2 },
  ],
};

export const RAIDEN_SHOW_MOTIONS: readonly MotionData[] = [RAIDEN_INTRO, RAIDEN_WIN];
