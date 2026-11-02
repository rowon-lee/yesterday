import type { MotionData } from '../../../anim/motion';
import { O_STANCE, OD, OR } from './stance';

/*
 * 오스카 등장·승리 (캐릭터 기획서 '등장 연출').
 * 등장: 허공에 은빛 선이 그어지고 공간이 잘려 열린다. 그 틈에서 칼자루에 손을 얹은 채 유유히 걸어 나오고, 뒤에서 틈이 조용히 닫힌다.
 * sim 자리는 그대로이고, 그림 안에서 엉덩이가 틈(발밑 뒤 18px) 속에서 제자리까지 걸어 나온다. 틈과 은빛 선은 렌더 (render/chars/oscar.ts).
 * 처음 14틱은 틈이 열리는 동안 틈 속에 서 있다 (틈의 어둠이 몸을 덮는다).
 */

/** 틈 속: 기본자세 그대로 18px 뒤에 서 있다 */
const IN_RIFT = OR({ hx: -17.5, lFx: -12, lBx: -24 });
/** 첫 걸음: 뒷발을 낮게 들어 옮긴다 */
const STEP1_MID = OR({ hx: -14.5, hy: -22.6, lFx: -12, lBx: -15, lBy: -2 });
/** 첫 걸음을 딛는다 */
const STEP1 = OR({ hx: -11, hy: -21.6, lFx: -12, lBx: -5 });
/** 둘째 걸음: 앞발을 옮긴다 */
const STEP2_MID = OR({ hx: -6.5, hy: -22.6, lFx: -3, lFy: -2, lBx: -5 });
/** 둘째 걸음을 딛는다 */
const STEP2 = OR({ hx: -2, hy: -21.6, lFx: 6, lBx: -5 });
/** 엄지로 날밑을 밀어 칼날이 3px 비친다 (고개를 들어 상대를 본다) */
const NOTICE = OR({ hd: 6, tl: 11 }, 3);
/** 칼을 밀어 넣으며 고개를 까딱 숙인다 */
const NOD = OR({ hd: 16, tl: 14 });

/** 등장: 틈 속에 섬 → 두 걸음에 걸어 나옴 → 엄지로 날밑을 밀어 상대를 봄 → 칼을 넣으며 고개를 까딱 → 기본자세. 14프레임 68틱 */
export const OSCAR_INTRO: MotionData = {
  name: 'oscar/intro',
  label: '오스카 등장',
  dur: [14, 5, 5, 5, 5, 4, 8, 6, 5, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: IN_RIFT },
    { at: 1, pose: STEP1_MID },
    { at: 2, pose: STEP1 },
    { at: 3, pose: STEP2_MID },
    { at: 4, pose: STEP2 },
    { at: 5, pose: O_STANCE },
    { at: 6, pose: NOTICE, stop: true },
    { at: 7, pose: NOTICE },
    { at: 8, pose: NOD, stop: true },
    { at: 13, pose: O_STANCE },
  ],
};

/** 승리: 칼을 한 뼘 뽑아 칼날을 내려다보고 → 천천히 칼집에 밀어 넣어 '탁' → 고개를 숙였다 → 뒷짐을 진 채 꼿꼿이 선다. 14프레임 */
const WIN_DRAW = OD({ hd: 22, tl: 14, hy: -21.5 }, 12);
const WIN_HALF = OD({ hd: 20, tl: 14, hy: -21.5 }, 6);
const WIN_CLICK = OR({ hd: 22, tl: 17, hy: -21 });
const WIN_STAND = OR({ hd: 2, tl: 8, hy: -22.8 });

export const OSCAR_WIN: MotionData = {
  name: 'oscar/win',
  label: '오스카 승리',
  dur: [4, 4, 6, 8, 5, 5, 5, 5, 3, 8, 5, 5, 5, 6],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 2, pose: WIN_DRAW, stop: true },
    { at: 3, pose: WIN_DRAW },
    { at: 6, pose: WIN_HALF },
    { at: 8, pose: WIN_CLICK, stop: true },
    { at: 9, pose: WIN_CLICK },
    { at: 12, pose: WIN_STAND, stop: true },
    { at: 13, pose: WIN_STAND },
  ],
};

export const OSCAR_SHOW_MOTIONS: readonly MotionData[] = [OSCAR_INTRO, OSCAR_WIN];
