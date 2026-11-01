import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { O_STANCE, OD, OR } from './stance';

/*
 * 오스카 기술 4개 (캐릭터 기획서): 스킬 1 월하참뢰검, 스킬 2 월하윤회, 차지 만검지화, 필살기 월령수류(연출 장면 포함).
 * 칸은 128×96. 칼은 끝까지 휘두르지 않는다: 손을 얹고, 살짝 뽑고, '탁' 납도한다. 베는 것은 앞 허공·상대 자리·검영이다 (렌더·sim).
 */

// ---- 스킬 1 월하참뢰검: 상대가 있는 자리를 곧바로 벤다. 손을 얹고 상대를 바라보는 동안 그 자리에 표식이 뜨고, 칼을 살짝 뽑는 순간 벤다 ----
const S1_READY = OD({ hy: -21, tl: 12, hd: 6, lFx: 7, lBx: -8 }, 1);
/** 상대를 바라본다 (고개를 들고 등을 조금 편다): 엄지로 날밑을 민 채 멈춘다 */
const S1_GAZE = OD({ hy: -21.5, tl: 9, hd: 2, lFx: 7, lBx: -8 }, 2);
const S1_STILL = OD({ hy: -21.5, tl: 9, hd: 3, lFx: 7, lBx: -8 }, 2);
/** 살짝 뽑는다 (섬광, 이 순간 표식 자리가 베인다) */
const S1_DRAW = OD({ hx: 1, hy: -21, tl: 13, hd: 5, lFx: 8, lBx: -8, tw: 2 }, 10);
const S1_CLICK = OD({ hy: -21, tl: 14, hd: 10, lFx: 7, lBx: -8 }, 0);

/** 스킬 1: 손을 얹음 → 상대를 바라보며 멈춤 (표식이 뜨는 동안 4프레임) → 살짝 뽑음(8번째 프레임, 원격 베기) → 여운 → 납도. 14프레임 39틱 */
export const OSCAR_SKILL1: MotionData = {
  name: 'oscar/skill1',
  label: '오스카 스킬 1 (월하참뢰검)',
  wide: true,
  dur: [1, 3, 4, 4, 4, 4, 4, 1, 3, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 1, pose: S1_READY },
    { at: 2, pose: S1_GAZE, stop: true },
    { at: 6, pose: S1_STILL, stop: true },
    { at: 7, pose: S1_DRAW },
    { at: 9, pose: S1_DRAW, stop: true },
    { at: 10, pose: S1_CLICK, stop: true },
    { at: 13, pose: O_STANCE },
  ],
};

// ---- 스킬 2 월하윤회: 그림자 속으로 가라앉듯 사라져, 남아 있는 검영 하나에서 나타난다 (공중이면 검영을 밟고 한 번 더 뛴다) ----
const S2_SINK = OR({ hy: -19.5, tl: 20, hd: 14, lFx: 6, lBx: -6 });
/** 사라지는 순간: 깊이 가라앉는다 (이 프레임이 끝나면 순간이동) */
const S2_GONE = OR({ hy: -18, tl: 26, hd: 16, lFx: 6, lBx: -6 });
/** 검영에서 나타난다: 앞발로 검영을 딛듯 내려서고, 엄지로 날밑을 민다 */
const S2_STEP = OR({ hx: 1, hy: -23, tl: 12, hd: 10, lFx: 8, lFy: -1, lBx: -4, lBy: -4 }, 2);
const S2_LAND = OR({ hy: -21, tl: 14, hd: 12, lFx: 7, lBx: -6 });

/** 스킬 2: 가라앉음 → 사라짐 (4틱째 순간이동) → 검영에서 내려섬 → 기본자세. 12프레임 22틱 */
export const OSCAR_SKILL2: MotionData = {
  name: 'oscar/skill2',
  label: '오스카 스킬 2 (월하윤회)',
  wide: true,
  dur: [1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 1, pose: S2_SINK },
    { at: 2, pose: S2_GONE, stop: true },
    { at: 3, pose: S2_STEP },
    { at: 5, pose: S2_LAND, stop: true },
    { at: 11, pose: O_STANCE },
  ],
};

// ---- 차지 만검지화: 발도 자세로 깊이 내려앉아 모으는 동안 앞 허공에 검영이 하나씩 만개하고, 떼면 칼을 다 뽑았다 '탁' 납도하는 순간 한꺼번에 베인다 ----
const C_READY = OD({ hy: -20.5, tl: 16, hd: 10, lFx: 8, lBx: -8 }, 2);
/** 발도 자세: 발을 넓게 벌리고 깊이 내려앉는다 (몸통 22°, 엉덩이 4px 낮게) */
const C_STANCE = OD({ hx: -1, hy: -18, tl: 22, hd: 6, lFx: 11, lBx: -11 }, 3);
const C_BREATH = OD({ hx: -1, hy: -18.6, tl: 21, hd: 5, lFx: 11, lBx: -11 }, 3);
/** 떼는 순간: 크게 파고들며 다 뽑는다 (섬광) */
const C_DRAW = OD({ hx: 3, hy: -17, tl: 30, hd: 2, lFx: 15, lBx: -12, tw: 3 }, 14);
/** '탁' 납도 — 만개한 검영들이 한꺼번에 베인다 (판정) */
const C_CLICK = OD({ hx: 3, hy: -18, tl: 26, hd: 12, lFx: 15, lBx: -12 }, 0);
const C_STILL = OD({ hx: 2.5, hy: -18.5, tl: 24, hd: 14, lFx: 15, lBx: -12 }, 0);

/**
 * 차지: 1~4프레임 내려앉음(한 번) → 5~8프레임 모으는 동안 되풀이(숨) → 떼면 9번째부터: 다 뽑음 → '탁'(판정 11·12번째 프레임) → 기본자세.
 * 14프레임. sim 차지 규칙: windup 4, loopTo 7, from 8
 */
export const OSCAR_CHARGE: MotionData = {
  name: 'oscar/charge',
  label: '오스카 차지 (만검지화)',
  wide: true,
  dur: [2, 2, 3, 3, 4, 4, 4, 4, 1, 3, 2, 1, 5, 3],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 1, pose: C_READY },
    { at: 2, pose: C_STANCE, stop: true },
    { at: 3, pose: C_STANCE },
    { at: 4, pose: C_BREATH },
    { at: 5, pose: C_STANCE },
    { at: 6, pose: C_BREATH },
    { at: 7, pose: C_STANCE },
    { at: 8, pose: C_DRAW },
    { at: 9, pose: C_DRAW, stop: true },
    { at: 10, pose: C_CLICK, stop: true },
    { at: 12, pose: C_STILL, stop: true },
    { at: 13, pose: O_STANCE },
  ],
};

// ---- 필살기 월령수류 ----
/** 발동: 칼자루에 손을 얹고 고개를 든다 (핏빛 달을 본다) → 살짝 뽑는 순간 앞쪽 먼 곳까지 판정. 14프레임 37틱 (판정 6~8번째 프레임) */
const SP_READY = OD({ hy: -21, tl: 11, hd: 4, lFx: 7, lBx: -8 }, 2);
const SP_GAZE = OD({ hy: -21.5, tl: 8, hd: -4, lFx: 7, lBx: -8 }, 3);
const SP_DRAW = OD({ hx: 2, hy: -20, tl: 18, hd: 4, lFx: 10, lBx: -9, tw: 3 }, 12);
const SP_HOLD = OD({ hx: 2, hy: -20, tl: 19, hd: 6, lFx: 10, lBx: -9, tw: 2 }, 12);
export const OSCAR_SUPER: MotionData = {
  name: 'oscar/super',
  label: '오스카 필살기 (월령수류) 발동',
  wide: true,
  dur: [1, 3, 4, 3, 3, 1, 2, 2, 1, 4, 4, 3, 3, 3],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 1, pose: SP_READY },
    { at: 2, pose: SP_GAZE, stop: true },
    { at: 4, pose: SP_GAZE, stop: true },
    { at: 5, pose: SP_DRAW },
    { at: 8, pose: SP_HOLD },
    { at: 10, pose: SP_HOLD, stop: true },
    { at: 11, pose: OD({ hx: 1, hy: -21, tl: 14, hd: 10, lFx: 9, lBx: -8 }, 0), stop: true },
    { at: 13, pose: O_STANCE },
  ],
};

/** 연출 장면 1 (핏빛 달·물결): 칼자루에 손을 얹은 채 가만히 서서 달을 본다. 숨 한 번. 14프레임 48틱 */
export const OSCAR_SUPER_MOON: MotionData = {
  name: 'oscar/super_moon',
  label: '오스카 필살기 장면 1 (핏빛 달)',
  wide: true,
  dur: [4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4],
  keys: [
    { at: 0, pose: SP_GAZE },
    { at: 4, pose: OD({ hy: -22, tl: 7, hd: -8, lFx: 7, lBx: -8 }, 2), stop: true },
    { at: 9, pose: OD({ hy: -21, tl: 12, hd: 4, lFx: 7, lBx: -8 }, 3) },
    { at: 13, pose: OD({ hx: -1, hy: -19, tl: 20, hd: 6, lFx: 11, lBx: -10 }, 3), stop: true },
  ],
};

/** 연출 장면 2 (화면 백색 — 무수한 검격): 다 뽑아 지나쳐 상대 뒤에 선다 (흰 화면 뒤라 끝에만 보인다). 14프레임 36틱 */
export const OSCAR_SUPER_WHITE: MotionData = {
  name: 'oscar/super_white',
  label: '오스카 필살기 장면 2 (백색)',
  wide: true,
  dur: [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4],
  keys: [
    { at: 0, pose: OD({ hx: -1, hy: -19, tl: 20, hd: 6, lFx: 11, lBx: -10 }, 3) },
    { at: 1, pose: OD({ hx: 4, hy: -16, tl: 34, hd: 0, lFx: 16, lBx: -13, tw: 4 }, 14) },
    { at: 6, pose: OD({ hx: 4, hy: -16.5, tl: 33, hd: 2, lFx: 16, lBx: -13, tw: 3 }, 14), stop: true },
    { at: 13, pose: OD({ hx: 3.5, hy: -17, tl: 30, hd: 6, lFx: 16, lBx: -13, tw: 2 }, 14) },
  ],
};

/** 연출 장면 3 (색이 돌아옴 — 납도): 상대에게 등을 진 채 천천히 칼을 칼집에 밀어 넣고 '탁', 고개를 숙인다. 14프레임 62틱 */
export const OSCAR_SUPER_SHEATHE: MotionData = {
  name: 'oscar/super_sheathe',
  label: '오스카 필살기 장면 3 (납도)',
  wide: true,
  dur: [4, 5, 5, 5, 5, 5, 5, 4, 3, 2, 6, 5, 4, 4],
  keys: [
    { at: 0, pose: OD({ hx: 3.5, hy: -17, tl: 30, hd: 6, lFx: 16, lBx: -13, tw: 2 }, 14) },
    { at: 2, pose: OD({ hx: 2, hy: -19, tl: 22, hd: 12, lFx: 12, lBx: -10, tw: 1 }, 12), stop: true },
    { at: 8, pose: OD({ hx: 1, hy: -20.5, tl: 16, hd: 16, lFx: 9, lBx: -8 }, 3) },
    { at: 9, pose: OD({ hx: 1, hy: -21, tl: 16, hd: 18, lFx: 9, lBx: -8 }, 0), stop: true },
    { at: 11, pose: OR({ hy: -21.5, tl: 14, hd: 20, lFx: 8, lBx: -7 }), stop: true },
    { at: 13, pose: OR({ hy: -22, tl: 11, hd: 8, lFx: 7, lBx: -6 }) },
  ],
};

// ---- 필살기 상대 반응 (누가 맞든 같다. 이름이 'react/'라 맞는 사람의 겉모습으로 그린다) ----
/** 일반 서 있는 자세 (상대 반응의 바탕): 가드를 반쯤 올린 채 */
const G: Pose = { hx: 0, hy: -22, tl: 4, hd: 2, aFx: 7, aFy: -6, aBx: 5, aBy: -2, lFx: 7, lFy: 0, lBx: -7, lBy: 0 };
const g = (o: Partial<Pose>): Pose => ({ ...G, ...o });

/** 반응 1 (핏빛 달): 얼어붙은 듯 굳고, 둘러보듯 고개가 한 번 움직인다. 장면 1과 같은 48틱 */
export const REACT_OSCAR_MOON: MotionData = {
  name: 'react/oscar_moon',
  label: '월령수류 반응 1 (굳음)',
  wide: true,
  dur: [4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4],
  keys: [
    { at: 0, pose: g({}) },
    { at: 3, pose: g({ hd: -10, tl: 0, aFx: 6, aFy: -8 }), stop: true },
    { at: 7, pose: g({ hd: 6, tl: 6 }), stop: true },
    { at: 13, pose: g({ hy: -21, hd: 0, tl: 2, aFx: 8, aFy: -9, aBx: 6, aBy: -6 }), stop: true },
  ],
};

/** 반응 2 (백색): 무수한 베기에 몸이 이리저리 떨린다. 장면 2와 같은 36틱 */
export const REACT_OSCAR_WHITE: MotionData = {
  name: 'react/oscar_white',
  label: '월령수류 반응 2 (베임)',
  wide: true,
  dur: [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4],
  keys: [
    { at: 0, pose: g({ hy: -21, aFx: 8, aFy: -9, aBx: 6, aBy: -6 }) },
    { at: 2, pose: g({ hx: -2, tl: -8, hd: -10, aFx: 2, aFy: -12, aBx: -4, aBy: -10 }) },
    { at: 4, pose: g({ hx: 1, tl: 12, hd: 14, aFx: 6, aFy: 2, aBx: 2, aBy: 4 }) },
    { at: 6, pose: g({ hx: -2, tl: -10, hd: -12, aFx: 0, aFy: -12, aBx: -6, aBy: -9 }) },
    { at: 8, pose: g({ hx: 0, tl: 8, hd: 10, aFx: 5, aFy: 3, aBx: 1, aBy: 5 }) },
    { at: 10, pose: g({ hx: -1, tl: -6, hd: -8, aFx: 3, aFy: -10, aBx: -3, aBy: -8 }) },
    { at: 13, pose: g({ hx: 0, tl: 2, hd: 0, aFx: 4, aFy: 6, aBx: 2, aBy: 7 }), stop: true },
  ],
};

/** 반응 3 (베여 있음): 잠깐 그대로 섰다가, 베인 것이 드러나며 무릎이 꺾여 앞으로 주저앉는다. 장면 3과 같은 62틱 */
export const REACT_OSCAR_FALL: MotionData = {
  name: 'react/oscar_fall',
  label: '월령수류 반응 3 (주저앉음)',
  wide: true,
  dur: [4, 5, 5, 5, 5, 5, 5, 4, 3, 2, 6, 5, 4, 4],
  keys: [
    { at: 0, pose: g({ hx: 0, tl: 2, hd: 0, aFx: 4, aFy: 6, aBx: 2, aBy: 7 }) },
    { at: 7, pose: g({ hx: 0, tl: 2, hd: 2, aFx: 4, aFy: 6, aBx: 2, aBy: 7 }), stop: true },
    { at: 8, pose: g({ hx: -1, hy: -20, tl: -6, hd: -12, aFx: 1, aFy: 4, aBx: -1, aBy: 6 }) },
    { at: 10, pose: g({ hx: 1, hy: -15, tl: 24, hd: 18, aFx: 6, aFy: 10, aBx: 3, aBy: 12, lFx: 10, lFy: 0, lBx: -6, lBy: 0 }) },
    { at: 13, pose: g({ hx: 2, hy: -10, tl: 38, hd: 24, aFx: 9, aFy: 12, aBx: 6, aBy: 13, lFx: 12, lFy: 0, lBx: -8, lBy: 0 }), stop: true },
  ],
};

export const OSCAR_SKILL_MOTIONS: readonly MotionData[] = [
  OSCAR_SKILL1, OSCAR_SKILL2, OSCAR_CHARGE, OSCAR_SUPER, OSCAR_SUPER_MOON, OSCAR_SUPER_WHITE, OSCAR_SUPER_SHEATHE,
  REACT_OSCAR_MOON, REACT_OSCAR_WHITE, REACT_OSCAR_FALL,
];
