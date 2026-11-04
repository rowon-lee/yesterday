import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { O_STANCE, OD, OR } from './stance';

/** 한 프레임 = [자세, 표시 틱, 멈춤(stop)] */
type Fr = readonly [pose: Pose, dur: number, stop?: boolean];
/** 프레임마다 키 하나 (사이 프레임으로 채우지 않는다, 길이는 dur로). 2차 리워크 */
function seq(name: string, label: string, frames: readonly Fr[]): MotionData {
  return {
    name,
    label,
    wide: true,
    dur: frames.map((f) => f[1]),
    keys: frames.map(([pose, , stop], at) => (stop ? { at, pose, stop } : { at, pose })),
  };
}

/*
 * 오스카 기술 4개 (캐릭터 기획서 13장): 스킬 1 월하참뢰검, 스킬 2 월하윤회궤, 차지 만검지화, 필살기 월령수류(연출 장면 포함).
 * 칸은 128×96. 칼은 휘두르지 않는다: 손을 얹고, 칼날이 비치고, '탁' 납도한다(1프레임 멈춤). 베이는 것은 허공·상대 자리·화면이다 (렌더·sim).
 */

// ---- 스킬 1 월하참뢰검 (13-3): 0~18틱 표식 (상대 자리에 앞으로 그어질 선이 점선으로) → 18틱 칼자루에 손, 칼날 반짝 → 점선이 실선으로 ----
/**
 * 스킬 1 (2차 리워크): 상대를 바라봄 → 굳음 → 눈을 가늘게 (고개가 숙는다) → 뒷손이 칼집 입구로 → 엄지가 날밑으로 (멈춤) →
 * 숨을 들이쉬고 멈춤 (표식이 뜨는 18틱) → 칼날 5px 1틱 (18틱, 원격 베기) → '탁' 멈춤 → 바라본 채 여운 → 고개를 숙임 → 깊이 숙여 멈춤 →
 * 뒷손이 등 뒤로 → 무게가 뒤로 → 기본자세. 16프레임 34틱 (같은 자세를 늘어놓던 14장 대신, 표식을 기다리는 동안 한 동작씩)
 */
export const OSCAR_SKILL1 = seq('oscar/skill1', '오스카 스킬 1 (월하참뢰검)', [
  [O_STANCE, 1],
  [OR({ hy: -22.4, tl: 9, hd: 1 }), 2],
  [OR({ hy: -22.5, tl: 8, hd: -1 }), 3, true],
  [OR({ hy: -22.2, tl: 10, hd: 8 }), 2],
  [OD({ hy: -22, tl: 10.5, hd: 8, lFx: 7, lBx: -6.5 }, 0), 2],
  [OD({ hy: -21.7, tl: 11, hd: 7, lFx: 7.5, lBx: -7 }, -2), 3, true],
  [OD({ hy: -22.6, tl: 8, hd: 4, lFx: 7.5, lBx: -7 }, -2), 2],
  [OD({ hy: -22.6, tl: 8, hd: 3, lFx: 7.5, lBx: -7 }, -2.5), 3, true],
  [OD({ hx: 0.5, hy: -22.2, tl: 10, hd: 2, lFx: 8, lBx: -7, tw: 1 }, 5), 1],
  [OD({ hy: -22.3, tl: 9, hd: 4, lFx: 8, lBx: -7 }, 0), 2, true],
  [OD({ hy: -22.3, tl: 9.5, hd: 6, lFx: 8, lBx: -7 }, 0), 3, true],
  [OD({ hy: -21.9, tl: 11.5, hd: 12, lFx: 7.5, lBx: -7 }, 0), 2],
  [OD({ hy: -21.6, tl: 13, hd: 17, lFx: 7, lBx: -6.5 }, 0), 3, true],
  [OR({ hy: -21.8, tl: 13, hd: 14, lFx: 6.5, lBx: -6 }), 2],
  [OR({ hx: 0, hy: -22.5, tl: 11.5, hd: 9, lFx: 6, lBx: -6 }), 2],
  [O_STANCE, 1],
]);

// ---- 스킬 2 월하윤회궤 (13-4): 0~4 고른 검영이 맥동 → 4~8 앞 허공에 세로 틈이 열리고 들어간다 → 8~10 사라짐 (9틱째 옮김) → 10~16 검영 자리 틈에서 걸어 나온다 ----
/**
 * 스킬 2 (2차 리워크): 손이 칼자루로, 고른 검영을 바라보며 멈춤 (0~4 검영이 맥동) → 틈으로 두 걸음 (4~8, 디딜 때마다 내려앉음) →
 * 틈 속으로 (8틱) → 옮겨 간 틈 속 (9틱, 8~10은 렌더가 감춘다) → 검영 자리의 틈에서 걸어 나옴 (10~16) → 뒷손이 등 뒤로 → 기본자세. 17프레임 24틱
 */
export const OSCAR_SKILL2 = seq('oscar/skill2', '오스카 스킬 2 (월하윤회궤)', [
  [O_STANCE, 1],
  [OD({ hy: -21.8, tl: 12, hd: 6, lFx: 6, lBx: -6 }, -1), 1, true],
  [OD({ hx: -0.5, hy: -21.4, tl: 13, hd: 9, lFx: 6, lBx: -6.5 }, -2), 2, true],
  [OD({ hx: 1.5, hy: -22.4, tl: 13, hd: 10, lFx: 8, lFy: -2, lBx: -6 }, -1), 1],
  [OD({ hx: 3, hy: -21.4, tl: 14, hd: 12, lFx: 10, lBx: -3, lBy: -1 }, -1), 1],
  [OD({ hx: 4.5, hy: -22.4, tl: 14, hd: 12, lFx: 10, lBx: 3, lBy: -2.5 }, -1), 1],
  [OD({ hx: 6, hy: -21.6, tl: 15, hd: 13, lFx: 12, lBx: 2, lBy: -1 }, -1), 1],
  [OD({ hx: 7.5, hy: -21.4, tl: 17, hd: 15, lFx: 13, lBx: 5, lBy: -1.5 }, -1), 1],
  [OD({ hx: -6.5, hy: -21.3, tl: 17, hd: 15, lFx: -3, lBx: -10, lBy: -1 }, -1), 1, true],
  [OD({ hx: -5, hy: -21.8, tl: 14, hd: 12, lFx: -1, lBx: -11, lBy: -1 }, -1), 1],
  [OD({ hx: -3.5, hy: -22.4, tl: 13.5, hd: 12, lFx: 2, lFy: -2, lBx: -11 }, -1), 1],
  [OD({ hx: -2, hy: -21.5, tl: 13, hd: 12, lFx: 6, lBx: -9 }, -1), 2],
  [OD({ hx: -1, hy: -22.3, tl: 13, hd: 12, lFx: 6, lBx: -7, lBy: -2 }, -1), 1],
  [OD({ hx: 0, hy: -21.4, tl: 13.5, hd: 14, lFx: 6, lBx: -6 }, -1), 2, true],
  [OD({ hy: -22.2, tl: 12, hd: 6, lFx: 6, lBx: -6 }, 0), 2],
  [OR({ hy: -22.3, tl: 12.5, hd: 9 }), 2],
  [O_STANCE, 3],
]);

// ---- 차지 만검지화 (13-5): 칼자루에 손을 얹고 고개를 숙인 채 몸은 정지. 그동안 앞 허공에 검영 꽃이 하나씩 핀다 ----
/**
 * 차지 (2차 리워크): 앞손이 날밑으로 → 뒷손이 칼집 입구로 → 고개를 숙임 → 깊이 숙여 멈춤 → 자리 잡음 (10틱) →
 * 모으는 동안 되풀이 (10~26틱, 몸은 정지하고 숨만): 내쉼 → 들이쉼 → 엄지가 날밑을 민다 → 내쉼 →
 * 떼면 (26틱) 칼날이 반쯤(7px) 나왔다 (1틱, 스미어) → '탁' 닫힘 (27틱) → 깊이 숙인 여운 (28틱부터 꽃들이 선 다발로 펼쳐짐) →
 * 고개를 듦 → 뒷손이 등 뒤로, 무게가 뒤로 → 기본자세. 16프레임 39틱 (되풀이 구간 경계 10·26틱 그대로)
 */
export const OSCAR_CHARGE = seq('oscar/charge', '오스카 차지 (만검지화)', [
  [O_STANCE, 1],
  [OR({ hy: -21.8, tl: 13.5, hd: 14, lFx: 7, lBx: -6.5 }, -1), 1],
  [OD({ hy: -21.6, tl: 14, hd: 15, lFx: 7, lBx: -7 }, -1), 1],
  [OD({ hy: -21.4, tl: 15, hd: 20, lFx: 7, lBx: -7 }, -1.5), 2],
  [OD({ hy: -21.2, tl: 15.5, hd: 25, lFx: 7, lBx: -7 }, -2), 3, true],
  [OD({ hy: -21.5, tl: 15, hd: 23, lFx: 7, lBx: -7 }, -2), 2, true],
  [OD({ hy: -21.1, tl: 16, hd: 25, lFx: 7, lBx: -7 }, -2), 4, true],
  [OD({ hy: -22, tl: 14, hd: 21, lFx: 7, lBx: -7 }, -2.5), 4, true],
  [OD({ hy: -22, tl: 14, hd: 21, lFx: 7, lBx: -7 }, -0.5), 4, true],
  [OD({ hy: -21.4, tl: 15.5, hd: 23, lFx: 7, lBx: -7 }, -2), 4, true],
  [OD({ hx: 0.5, hy: -21, tl: 16, hd: 14, lFx: 7, lBx: -7, tw: 1 }, 7), 1],
  [OD({ hy: -21.3, tl: 15, hd: 18, lFx: 7, lBx: -7 }, 0), 1, true],
  [OD({ hy: -21.3, tl: 15, hd: 23, lFx: 7, lBx: -7 }, 0), 3, true],
  [OD({ hy: -21.9, tl: 13, hd: 12, lFx: 7, lBx: -7 }, 0), 3],
  [OR({ hx: 0, hy: -22.4, tl: 12, hd: 10, lFx: 6.5, lBx: -6.5 }), 2],
  [O_STANCE, 3],
]);

// ---- 필살기 월령수류 (13-7, 영역 전개형) ----
/** 눈을 감고 칼자루에 손 (고개를 숙임) */
const SP_CLOSE = OD({ hy: -21.8, tl: 13, hd: 20, lFx: 6, lBx: -6 }, 0);
const SP_BREATH = OD({ hy: -22.1, tl: 12, hd: 19, lFx: 6, lBx: -6 }, 0);
/** 고개를 든다 */
const SP_LIFT = OD({ hy: -22, tl: 11, hd: 6, lFx: 6, lBx: -6 }, 0);
/** 엄지로 날밑을 민다 (칼날 2px): 이 순간 화면 전체에 판정 */
const SP_PUSH = OD({ hy: -22, tl: 11, hd: 4, lFx: 6, lBx: -6, tw: 1 }, 2);

/**
 * 발동 (2차 리워크): 앞손이 날밑으로 → 눈을 감고 고개를 숙이며 뒷손이 칼집으로 → 들이쉼 · 멈춤 · 내쉼 (느린 발동) →
 * 고개가 한 번 더 숙었다가 (1틱) → 고개를 들고 눈을 뜸 → 앞발을 반 치 내디디며 등을 편다 (멈춤) → 엄지가 날밑에서 3px 물러남 (1틱, 감기) →
 * 엄지로 날밑을 미는 순간 (24틱, 칼날 2px) 화면 전체 판정 → 숨을 멈춘 채 어깨가 오름 → (빗나가면) '탁' → 고개를 숙임 → 무게가 뒤로 빠지며 뒷손이 등 뒤로 → 기본자세.
 * 16프레임 48틱
 */
export const OSCAR_SUPER = seq('oscar/super', '오스카 필살기 (월령수류) 발동', [
  [O_STANCE, 2],
  [OR({ hy: -21.9, tl: 13, hd: 15 }, -1), 2],
  [SP_CLOSE, 2, true],
  [SP_BREATH, 4, true],
  [OD({ hy: -22.2, tl: 12, hd: 19, lFx: 6, lBx: -6 }, -1), 4, true],
  [OD({ hy: -21.6, tl: 13.5, hd: 21, lFx: 6, lBx: -6 }, -1), 4, true],
  [OD({ hy: -21.3, tl: 15, hd: 31, lFx: 6, lBx: -6 }, -1), 1],
  [SP_LIFT, 2],
  [OD({ hx: 0.5, hy: -21.6, tl: 8, hd: 2, lFx: 8.5, lBx: -6.5 }, -1.5), 2, true],
  [OD({ hx: 0.5, hy: -21.4, tl: 9, hd: 4, lFx: 8.5, lBx: -6.5 }, -3), 1],
  [OD({ hx: 0.5, hy: -22, tl: 5, hd: -2, lFx: 8.5, lBx: -6.5, tw: 1 }, 2), 2],
  [OD({ hx: 0.5, hy: -22.5, tl: 4, hd: -3, lFx: 8.5, lBx: -6.5, tw: 1 }, 2), 2, true],
  [OD({ hx: 0.5, hy: -21.8, tl: 8, hd: 6, lFx: 8.5, lBx: -6.5 }, 0), 2, true],
  [OD({ hx: 0.5, hy: -21.6, tl: 12, hd: 15, lFx: 8, lBx: -6.5 }, 0), 4],
  [OR({ hx: 0, hy: -22.4, tl: 11, hd: 8, lFx: 7, lBx: -6 }), 4],
  [O_STANCE, 10],
]);

/** 장면 1 전개 (70틱): 눈을 감은 채 꼼짝하지 않는다. 숨 두 번. 그동안 구름이 갈라지고 핏빛 달이 떠오르고 물이 차오른다 */
export const OSCAR_SUPER_OPEN: MotionData = {
  name: 'oscar/super_open',
  label: '오스카 필살기 장면 1 (전개)',
  wide: true,
  dur: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  keys: [
    { at: 0, pose: SP_PUSH },
    { at: 2, pose: SP_CLOSE, stop: true },
    { at: 5, pose: SP_BREATH, stop: true },
    { at: 8, pose: SP_CLOSE, stop: true },
    { at: 11, pose: SP_BREATH, stop: true },
    { at: 13, pose: SP_CLOSE, stop: true },
  ],
};

/**
 * 장면 2 검영 (40틱, 2차 리워크): 검영들이 떠올라 둘레를 도는 동안 눈을 감고 멈춰 있다 (숨 한 번: 1px 오른다) →
 * 고개가 한 번 더 깊이 숙었다가 (1틱, 감기) → 한 번에 고개를 든다 (순간) → 든 채 멈춤. 5프레임 (키 3개를 14장으로 늘이던 것 대신)
 */
export const OSCAR_SUPER_ORBIT = seq('oscar/super_orbit', '오스카 필살기 장면 2 (검영)', [
  [SP_CLOSE, 12, true],
  [OD({ hy: -22.4, tl: 12, hd: 18, lFx: 6, lBx: -6 }, 0), 12, true],
  [OD({ hy: -21.6, tl: 13.5, hd: 24, lFx: 6, lBx: -6 }, 0), 1],
  [OD({ hy: -22.2, tl: 10, hd: 2, lFx: 6, lBx: -6 }, 0), 2],
  [SP_LIFT, 13, true],
]);

/** 짧은 판 장면 1 (40틱, 같은 경기 두 번째부터): 전개와 검영을 한 장면에 — 눈을 감았다가 고개를 든다 */
export const OSCAR_SUPER_OPEN_S: MotionData = {
  name: 'oscar/super_open_s',
  label: '오스카 필살기 짧은 판 장면 1 (전개·검영)',
  wide: true,
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2],
  keys: [
    { at: 0, pose: SP_PUSH },
    { at: 2, pose: SP_CLOSE, stop: true },
    { at: 7, pose: SP_BREATH, stop: true },
    { at: 13, pose: SP_LIFT, stop: true },
  ],
};

/** 장면 3 정적 (20틱): 모든 소리가 멈춘 듯. 칼을 반 치쯤(7px) 뽑는다 */
export const OSCAR_SUPER_STILL: MotionData = {
  name: 'oscar/super_still',
  label: '오스카 필살기 장면 3 (정적)',
  wide: true,
  dur: [2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2],
  keys: [
    { at: 0, pose: SP_LIFT },
    { at: 3, pose: OD({ hy: -21.6, tl: 13, hd: 6, lFx: 7, lBx: -7 }, 1), stop: true },
    { at: 9, pose: OD({ hx: 0.5, hy: -21, tl: 15, hd: 5, lFx: 8, lBx: -8, tw: 1 }, 7), stop: true },
    { at: 11, pose: OD({ hx: 0.5, hy: -21, tl: 15, hd: 5, lFx: 8, lBx: -8, tw: 1 }, 7), stop: true },
  ],
};

/** 백색 동안 빠져 지나가 상대 등 뒤에 선 자세: 칼을 다 뽑아 낮게 든 채 (등을 돌리고 있다) */
const SP_PASSED = OD({ hx: 3.5, hy: -17, tl: 30, hd: 6, lFx: 16, lBx: -13, tw: 2 }, 14);

/** 장면 4 백색 (20틱): 다 뽑으며 상대를 지나쳐 등 뒤에 선다 (흰 화면 뒤라 끝에만 보인다) */
export const OSCAR_SUPER_WHITE: MotionData = {
  name: 'oscar/super_white',
  label: '오스카 필살기 장면 4 (백색)',
  wide: true,
  dur: [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3],
  keys: [
    { at: 0, pose: OD({ hx: 0.5, hy: -21, tl: 15, hd: 5, lFx: 8, lBx: -8, tw: 1 }, 7) },
    { at: 1, pose: OD({ hx: 4, hy: -16, tl: 34, hd: 0, lFx: 16, lBx: -13, tw: 4 }, 14) },
    { at: 6, pose: OD({ hx: 4, hy: -16.5, tl: 33, hd: 2, lFx: 16, lBx: -13, tw: 3 }, 14), stop: true },
    { at: 12, pose: SP_PASSED, stop: true },
  ],
};

/** 납도를 시작하는 자세 (장면 5 끝 = 장면 6 처음): 칼날 13px, 등을 돌린 채 */
const SP_TURN = OD({ hx: 3, hy: -17.6, tl: 27, hd: 10, lFx: 16, lBx: -13 }, 13);

/**
 * 장면 5 어긋남 (40틱, 2차 리워크): 색이 돌아온 화면이 선을 따라 조각조각 어긋나 있는 동안, 등을 돌린 채 칼을 든 그대로 멈춰 있다 →
 * 숨을 내쉬며 어깨가 내려앉고 고개가 숙는다 → 고개가 한 번 더 숙었다가 (1틱, 감기) → 한 번에 몸을 세우며 고개를 든다 (순간) →
 * 칼을 13px로 거두어 납도를 시작하는 자세로 멈춤. 5프레임 (키 3개를 13장으로 늘이던 것 대신)
 */
export const OSCAR_SUPER_CUT = seq('oscar/super_cut', '오스카 필살기 장면 5 (어긋남)', [
  [SP_PASSED, 12, true],
  [OD({ hx: 3.4, hy: -16.4, tl: 31, hd: 10, lFx: 16, lBx: -13, tw: 1 }, 14), 12, true],
  [OD({ hx: 3.4, hy: -16.2, tl: 33, hd: 16, lFx: 16, lBx: -13, tw: 1 }, 14), 1],
  [OD({ hx: 3.1, hy: -17.9, tl: 25, hd: 3, lFx: 16, lBx: -13 }, 13), 2],
  [SP_TURN, 13, true],
]);

/** 장면 6 납도 (30틱): 등을 돌린 채 천천히 칼집에 밀어 넣고 '탁' (마지막 두 프레임 멈춤). 이 순간 조각들이 한꺼번에 무너진다 (연출 끝) */
export const OSCAR_SUPER_SHEATHE: MotionData = {
  name: 'oscar/super_sheathe',
  label: '오스카 필살기 장면 6 (납도)',
  wide: true,
  dur: [3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 1, 2],
  keys: [
    { at: 0, pose: SP_TURN },
    { at: 3, pose: OD({ hx: 2, hy: -19, tl: 21, hd: 12, lFx: 13, lBx: -11 }, 9), stop: true },
    { at: 8, pose: OD({ hx: 1, hy: -20.5, tl: 16, hd: 15, lFx: 10, lBx: -9 }, 2) },
    { at: 10, pose: OD({ hx: 1, hy: -21, tl: 16, hd: 18, lFx: 9, lBx: -8 }, 0), stop: true },
    { at: 12, pose: OD({ hx: 1, hy: -21, tl: 16, hd: 18, lFx: 9, lBx: -8 }, 0), stop: true },
  ],
};

// ---- 필살기 상대 반응 (누가 맞든 같다. 이름이 'react/'라 맞는 사람의 겉모습으로 그린다) ----
/** 일반 서 있는 자세 (상대 반응의 바탕): 가드를 반쯤 올린 채 */
const G: Pose = { hx: 0, hy: -22, tl: 4, hd: 2, aFx: 7, aFy: -6, aBx: 5, aBy: -2, lFx: 7, lFy: 0, lBx: -7, lBy: 0 };
const g = (o: Partial<Pose>): Pose => ({ ...G, ...o });
/** 굳은 채 하늘(달)을 올려다본다 */
const LOOK_UP = g({ hd: -16, tl: -2, aFx: 6, aFy: -8 });
const BRACE = g({ hy: -21, hd: -4, tl: 2, aFx: 8, aFy: -10, aBx: 6, aBy: -7 });

/** 반응 1 전개 (70틱): 얼어붙은 듯 굳고, 바뀌는 하늘을 올려다본다 */
export const REACT_OSCAR_OPEN: MotionData = {
  name: 'react/oscar_open',
  label: '월령수류 반응 1 (굳음)',
  wide: true,
  dur: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  keys: [
    { at: 0, pose: g({}) },
    { at: 3, pose: g({ hd: -6, tl: 0 }), stop: true },
    { at: 7, pose: LOOK_UP, stop: true },
    { at: 13, pose: LOOK_UP, stop: true },
  ],
};

/**
 * 반응 2 검영 (40틱, 2차 리워크): 달을 올려다본 채 굳어 있다 → 검영이 눈앞을 지나며 고개가 움찔 (1틱) →
 * 어깨를 움츠리며 팔이 올라감 (2틱) → 그대로 굳음 → 등 뒤로 도는 검영에 고개가 숙여졌다가 (1틱) →
 * 한 번 더 움츠리며 고개를 듦 → 버팀. 7프레임 (키 3개를 14장으로 늘이던 것 대신)
 */
export const REACT_OSCAR_ORBIT = seq('react/oscar_orbit', '월령수류 반응 2 (움츠림)', [
  [LOOK_UP, 10, true],
  [g({ hd: -10, tl: -1, aFx: 6, aFy: -8 }), 1],
  [g({ hy: -20.8, hd: -2, tl: 4, aFx: 8, aFy: -11, aBx: 6, aBy: -8 }), 2],
  [g({ hy: -21.2, hd: -3, tl: 3, aFx: 7, aFy: -10, aBx: 6, aBy: -7.5 }), 10, true],
  [g({ hy: -21.4, hd: 16, tl: 6, aFx: 7, aFy: -9, aBx: 6, aBy: -6.5 }), 1],
  [g({ hy: -20.7, hd: -5, tl: 3, aFx: 8.5, aFy: -11, aBx: 6.5, aBy: -8 }), 2],
  [BRACE, 14, true],
]);

/**
 * 짧은 판 반응 1 (40틱, 2차 리워크): 서 있다 → 고개가 움찔 숙었다가 (1틱) → 바뀌는 하늘을 홱 올려다봄 (2틱, 지나쳤다 돌아옴) →
 * 굳음 → 고개가 내려오기 시작하다 (1틱) → 둘레의 검영에 움츠림 (2틱) → 버팀. 7프레임 (키 3개를 14장으로 늘이던 것 대신)
 */
export const REACT_OSCAR_OPEN_S = seq('react/oscar_open_s', '월령수류 짧은 판 반응 1', [
  [g({}), 8, true],
  [g({ hd: 6, tl: 5 }), 1],
  [g({ hd: -20, tl: -4, aFx: 6, aFy: -8 }), 2],
  [LOOK_UP, 12, true],
  [g({ hd: -10, tl: -1, aFx: 6, aFy: -8 }), 1],
  [g({ hy: -20.5, hd: 1, tl: 5, aFx: 8, aFy: -11, aBx: 6.5, aBy: -8 }), 2],
  [BRACE, 14, true],
]);

/** 반응 3 정적 (20틱): 숨을 멈춘 듯 굳는다 */
export const REACT_OSCAR_STILL: MotionData = {
  name: 'react/oscar_still',
  label: '월령수류 반응 3 (정적)',
  wide: true,
  dur: [2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2],
  keys: [
    { at: 0, pose: BRACE },
    { at: 11, pose: g({ hy: -21.2, hd: -2, tl: 3, aFx: 8, aFy: -10, aBx: 6, aBy: -7 }), stop: true },
  ],
};

/** 반응 4 백색 (20틱): 무수한 베기에 몸이 이리저리 떨린다 */
export const REACT_OSCAR_WHITE: MotionData = {
  name: 'react/oscar_white',
  label: '월령수류 반응 4 (베임)',
  wide: true,
  dur: [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3],
  keys: [
    { at: 0, pose: g({ hy: -21, aFx: 8, aFy: -9, aBx: 6, aBy: -6 }) },
    { at: 2, pose: g({ hx: -2, tl: -8, hd: -10, aFx: 2, aFy: -12, aBx: -4, aBy: -10 }) },
    { at: 4, pose: g({ hx: 1, tl: 12, hd: 14, aFx: 6, aFy: 2, aBx: 2, aBy: 4 }) },
    { at: 6, pose: g({ hx: -2, tl: -10, hd: -12, aFx: 0, aFy: -12, aBx: -6, aBy: -9 }) },
    { at: 8, pose: g({ hx: 0, tl: 8, hd: 10, aFx: 5, aFy: 3, aBx: 1, aBy: 5 }) },
    { at: 12, pose: g({ hx: 0, tl: 2, hd: 0, aFx: 4, aFy: 6, aBx: 2, aBy: 7 }), stop: true },
  ],
};

/** 반응 5 어긋남 (40틱): 팔을 늘어뜨린 채 그대로 서 있다 (몸도 선 위에 있다) */
export const REACT_OSCAR_CUT: MotionData = {
  name: 'react/oscar_cut',
  label: '월령수류 반응 5 (베여 있음)',
  wide: true,
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3],
  keys: [
    { at: 0, pose: g({ hx: 0, tl: 2, hd: 0, aFx: 4, aFy: 6, aBx: 2, aBy: 7 }) },
    { at: 12, pose: g({ hx: 0, tl: 3, hd: 2, aFx: 4, aFy: 7, aBx: 2, aBy: 8 }), stop: true },
  ],
};

/**
 * 반응 6 납도 (30틱, 2차 리워크): 팔을 늘어뜨린 채 그대로 섰다 → 몸이 한 번 흔들림 → '탁' 직전 굳고 (1틱) →
 * '탁' (26틱) 하는 순간 고개가 뒤로 꺾이며 팔이 튐 → 무릎이 꺾임 → 무너짐 (끝에 쓰러진다). 6프레임 (키 3개를 13장으로 늘이던 것 대신)
 */
export const REACT_OSCAR_FALL = seq('react/oscar_fall', '월령수류 반응 6 (무너짐)', [
  [g({ hx: 0, tl: 3, hd: 2, aFx: 4, aFy: 7, aBx: 2, aBy: 8 }), 14, true],
  [g({ hx: 0.5, tl: 5, hd: 5, aFx: 4, aFy: 8, aBx: 2, aBy: 9 }), 11, true],
  [g({ hx: 0, hy: -22.4, tl: 1, hd: -1, aFx: 4, aFy: 7, aBx: 2, aBy: 8 }), 1],
  [g({ hx: -0.5, hy: -22.6, tl: -4, hd: -10, aFx: 5, aFy: 4, aBx: 3, aBy: 5 }), 1],
  [g({ hx: 0.5, hy: -20, tl: 9, hd: 8, aFx: 5, aFy: 9, aBx: 2.5, aBy: 10, lFx: 8, lBx: -6.5 }), 1],
  [g({ hx: 1, hy: -18, tl: 18, hd: 16, aFx: 6, aFy: 10, aBx: 3, aBy: 11, lFx: 9, lBx: -6 }), 2],
]);

export const OSCAR_SKILL_MOTIONS: readonly MotionData[] = [
  OSCAR_SKILL1, OSCAR_SKILL2, OSCAR_CHARGE, OSCAR_SUPER, OSCAR_SUPER_OPEN, OSCAR_SUPER_ORBIT, OSCAR_SUPER_OPEN_S, OSCAR_SUPER_STILL,
  OSCAR_SUPER_WHITE, OSCAR_SUPER_CUT, OSCAR_SUPER_SHEATHE,
  REACT_OSCAR_OPEN, REACT_OSCAR_ORBIT, REACT_OSCAR_OPEN_S, REACT_OSCAR_STILL, REACT_OSCAR_WHITE, REACT_OSCAR_CUT, REACT_OSCAR_FALL,
];
