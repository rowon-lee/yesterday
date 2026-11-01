import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 등장·승리 (캐릭터 기획서 '등장 연출').
 * 등장: 붉은 번개가 연달아 내리꽂히고, 번개 기둥 사이에서 라이덴이 걸어 나온다. 끝에 가드를 올리며 스텝을 밟기 시작한다.
 * 경기 첫 라운드 시작 연출(70틱) 안에 끝난다. 자리는 그대로이므로, 몸이 14px 뒤에서 두 걸음 걸어 나와 제자리에 선다.
 */

// ---- 등장 ----
/** 번개 사이에 서 있다: 몸을 곧게 펴고 손은 늘어뜨리고 고개를 숙였다. 제자리보다 14px 뒤 */
const IN_STAND = R({ hx: -14, hy: -22, tl: 3, hd: 14, aFx: 3, aFy: 16, aBx: -1, aBy: 16, lFx: -10, lFy: 0, lBx: -18, lBy: 0 });
/** 고개를 든다 */
const IN_LOOK = R({ hx: -14, hy: -22, tl: 2, hd: 2, aFx: 3, aFy: 16, aBx: -1, aBy: 16, lFx: -10, lFy: 0, lBx: -18, lBy: 0 });
/** 1번째 걸음: 뒷발이 앞으로 지나가고(들림), 팔은 걸음에 맞춰 반대로 흔들린다 */
const IN_STEP1 = R({ hx: -9, hy: -23, tl: 6, hd: 4, aFx: -5, aFy: 13, aBx: 6, aBy: 13, lFx: -10, lFy: 0, lBx: -6, lBy: -4 });
/** 뒷발을 앞에 딛는다 */
const IN_PLANT1 = R({ hx: -6, hy: -21, tl: 7, hd: 4, aFx: -1, aFy: 15, aBx: 3, aBy: 15, lFx: -10, lFy: 0, lBx: -2, lBy: 0 });
/** 2번째 걸음: 앞발이 앞으로 지나간다 */
const IN_STEP2 = R({ hx: -3, hy: -23, tl: 6, hd: 4, aFx: 6, aFy: 13, aBx: -5, aBy: 13, lFx: -1, lFy: -4, lBx: -2, lBy: 0 });
/** 앞발을 딛는다 (제자리) */
const IN_PLANT2 = R({ hx: 1, hy: -21, tl: 8, hd: 4, aFx: 3, aFy: 15, aBx: -1, aBy: 15, lFx: 8, lFy: 0, lBx: -2, lBy: 0 });
/** 뒷발을 뒤로 빼며 가드를 올린다: 두 주먹이 얼굴 앞으로 솟는다 (기본자세보다 조금 높게) */
const IN_GUARD = R({ hx: -0.5, hy: -20, tl: 12, hd: 6, aFx: 12, aFy: -7, aBx: 8, aBy: -3, lFx: 8, lFy: 0, lBx: -9, lBy: 0 });
/** 스텝을 밟기 시작한다: 웅크렸다 (대기의 웅크림과 같은 꼴) */
const IN_SQUASH = R({ hx: 0, hy: -17, tl: 18, hd: 11, aFx: 12.5, aFy: -2.5, aBx: 8, aBy: 1.5 });
/** 통 튀어 오른다 */
const IN_HOP = R({ hx: 0.5, hy: -24, tl: 12, hd: 6, aFx: 13, aFy: -5, aBx: 8, aBy: -1, lFx: 7.5, lFy: -3, lBx: -8.5, lBy: -3 });

/**
 * 등장: 번개 사이에 섬(1~2프레임) → 두 걸음 걸어 나옴(3~7프레임) → 뒷발을 빼며 가드를 올림(8~9프레임) → 한 번 통 튀어 기본자세(10~14프레임).
 * 14프레임 62틱 (라운드 시작 연출 70틱 안). 붉은 번개·발밑 스파크·그을음은 렌더.
 */
export const RAIDEN_INTRO: MotionData = {
  name: 'raiden/intro',
  label: '라이덴 등장',
  dur: [8, 6, 5, 5, 5, 5, 4, 4, 3, 3, 4, 3, 3, 4],
  keys: [
    { at: 0, pose: IN_STAND },
    { at: 1, pose: IN_LOOK, stop: true },
    { at: 2, pose: IN_STEP1 },
    { at: 3, pose: IN_PLANT1 },
    { at: 4, pose: IN_STEP2 },
    { at: 6, pose: IN_PLANT2, stop: true },
    { at: 8, pose: IN_GUARD, stop: true },
    { at: 9, pose: IN_SQUASH },
    { at: 11, pose: IN_HOP, stop: true },
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
