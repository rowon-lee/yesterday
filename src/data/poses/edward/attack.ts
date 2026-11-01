import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { aim, E, E_STANCE, extend, grip2 } from './stance';

/*
 * 에드워드 평타 11개 (캐릭터 기획서 '평타': 워 해머를 휘두른다. 느리지만 묵직하고 사거리가 길다).
 * 동작연출지침서: 128×96 칸, 무거운 감기(마지막 멈칫) → 스미어 1틱(앞팔 1.35배, 해머가 함께 멀리) → 타격 → 지나치기 → 여운 → 복귀.
 * 7장 '에드워드: 무거운 감기와 큰 원호. 느리지만 한 방의 궤적이 크다 / 굵고 짧은 원호 + 충격파·바닥 파편'.
 * 모두 기본자세(해머를 어깨에 걸친 채)에서 시작해 기본자세로 끝난다. 타격 포즈는 해머 머리 가운데 자리로 적는다(aim):
 * 두 팔을 끝까지 뻗고(98~100%), 뒷손은 손잡이 아래쪽을 쥔다. 판정은 해머 머리를 감싼 궤적 상자 (data/characters/edward.ts).
 */

/** 두 손 해머 포즈: 해머 머리 가운데를 (x, y)에 */
const A = (o: Partial<Pose>, x: number, y: number): Pose => aim(E(o), x, y);
/** 타격 포즈: 앞팔을 끝까지 armDeg 방향으로 뻗고 두 손으로 쥔다 (해머 각도는 포즈의 wa) */
const X = (o: Partial<Pose>, armDeg: number): Pose => extend(E(o), armDeg);
/** 두 손으로 쥔 포즈 (앞손 목표는 포즈대로) */
const G = (o: Partial<Pose>): Pose => grip2(E(o));
/** 해머가 몸 둘레를 한 바퀴 돌고 어깨로 돌아온 기본자세 (각도만 한 바퀴 더한 값: 그림은 기본자세와 같다) */
const STANCE_TURNED: Pose = { ...E_STANCE, wa: (E_STANCE.wa ?? 0) - 360 };

// ---- 1타: 어깨에서 짧게 내려찍기 ----
/** 감기: 몸을 뒤로 젖히며 해머를 어깨 뒤로 더 눕힌다 (두 손) */
const C1_LOAD = G({ hx: -2, hy: -20, tl: -8, hd: -6, tw: -2, aFx: 3, aFy: -2, lFx: 8, lBx: -10, wa: -168 });
/** 감기 끝 (멈칫): 뒷발에 실어 웅크린다 */
const C1_COIL = G({ hx: -3, hy: -18.5, tl: -10, hd: -6, tw: -3, aFx: 2, aFy: -3, lFx: 9, lBx: -12, wa: -175 });
/** 스미어: 해머가 머리 위를 넘어오며 앞발을 크게 내딛는다 */
const C1_SMEAR = A({ hx: 1, hy: -17, tl: 12, hd: -6, tw: 3, lFx: 14, lBx: -15, wa: -70 }, 26, -66);
/** 타격: 두 팔을 끝까지 뻗어 해머 머리가 가슴 높이 앞을 내려친다. 몸을 실어 앞어깨가 앞으로 */
const C1_HIT = X({ hx: 4, hy: -15.5, tl: 27, hd: -4, tw: 4, lFx: 16, lBx: -16, wa: 10 }, 4);
const C1_HIT2 = X({ hx: 4.5, hy: -15.2, tl: 29, hd: -4, tw: 4.5, lFx: 16, lBx: -16.5, wa: 22 }, 14);
/** 지나치기: 해머가 한 박 더 내려간다 */
const C1_OVER = X({ hx: 5, hy: -15, tl: 31, hd: -2, tw: 4.5, lFx: 16, lBx: -17, wa: 36 }, 26);
/** 여운 */
const C1_HOLD = X({ hx: 4.5, hy: -15.5, tl: 29, hd: -3, tw: 4, lFx: 16, lBx: -16.5, wa: 33 }, 24);
/** 복귀: 해머를 들어 올려 어깨로 되돌린다 */
const C1_BACK1 = G({ hx: 2, hy: -18.5, tl: 14, hd: -3, tw: 2, aFx: 10, aFy: -6, lFx: 12, lBx: -12, wa: -40 });
const C1_BACK2 = E({ hx: 0.5, hy: -21.5, tl: 0, hd: -2, aFx: 6, aFy: 3, aBx: -3, aBy: 11, lFx: 8, lBx: -8, wa: -125 });

/** 1타 어깨 내려찍기 (128×96): 감기(2~3, 멈칫) → 스미어(4, 1틱) → 내려찍기(5~6 판정) → 지나치기 → 여운 → 복귀. 12프레임 25틱 */
export const EDWARD_CHOP: MotionData = {
  name: 'edward/chop',
  label: '에드워드 1타 어깨 내려찍기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 2, 2, 1, 2, 2, 1, 4, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: C1_LOAD },
    { at: 2, pose: C1_COIL, stop: true },
    { at: 3, pose: C1_SMEAR },
    { at: 4, pose: C1_HIT },
    { at: 5, pose: C1_HIT2 },
    { at: 6, pose: C1_OVER },
    { at: 7, pose: C1_OVER, stop: true },
    { at: 8, pose: C1_HOLD },
    { at: 9, pose: C1_BACK1 },
    { at: 10, pose: C1_BACK2 },
    { at: 11, pose: E_STANCE },
  ],
};

// ---- 2타: 옆으로 크게 휘두르기 (해머를 뒤로 끌어 감았다가 가슴 높이로 앞을 가로지른다) ----
/** 감기: 해머를 어깨에서 내려 등 뒤로 늘어뜨린다 (해머 머리가 엉덩이 뒤) */
const C2_LOAD = G({ hx: -2, hy: -19, tl: 4, hd: -4, tw: -3, aFx: -4, aFy: 10, lFx: 9, lBx: -11, wa: -192 });
/** 감기 끝 (멈칫): 몸을 비틀어 해머를 더 뒤로, 뒷발에 싣는다 */
const C2_COIL = G({ hx: -3.5, hy: -17.5, tl: 6, hd: -4, tw: -4, aFx: -7, aFy: 9, lFx: 11, lBx: -13, wa: -184 });
/** 허리가 먼저 돈다: 앞발을 내딛고 해머는 아직 뒤에 끌린다 */
const C2_TURN = G({ hx: 1, hy: -16.5, tl: 14, hd: -4, tw: 1, aFx: 4, aFy: 9, lFx: 15, lBx: -15, wa: -210 });
/** 스미어: 팔이 앞으로 쏘아지며 해머가 몸 앞을 가로지른다 */
const C2_SMEAR = A({ hx: 3, hy: -15.5, tl: 22, hd: -4, tw: 4, lFx: 16, lBx: -16, wa: -300 }, 34, -6);
/** 타격: 가슴 높이에서 해머를 끝까지 뻗어 앞을 가로지른다 */
const C2_HIT = X({ hx: 4.5, hy: -15, tl: 26, hd: -4, tw: 5, lFx: 17, lBx: -16, wa: -364 }, -8);
/** 지나치기: 해머가 앞위로 더 휘돌아 올라간다 */
const C2_OVER = X({ hx: 5, hy: -15, tl: 24, hd: -6, tw: 5, lFx: 17, lBx: -16.5, wa: -392 }, -26);
/** 여운 */
const C2_HOLD = X({ hx: 4.5, hy: -15.5, tl: 22, hd: -6, tw: 4.5, lFx: 17, lBx: -16, wa: -398 }, -30);
/** 복귀: 머리 위로 넘겨 어깨로 */
const C2_BACK1 = G({ hx: 2, hy: -18.5, tl: 10, hd: -4, tw: 2, aFx: 7, aFy: -5, lFx: 12, lBx: -12, wa: -455 });
const C2_BACK2 = E({ hx: 0.5, hy: -21.5, tl: 0, hd: -2, aFx: 6, aFy: 3, aBx: -3, aBy: 11, lFx: 8, lBx: -8, wa: -495 });

/** 2타 옆 휘두르기 (128×96): 해머를 등 뒤로 늘어뜨려 감고(2~3) → 허리가 먼저 돌고(4) → 스미어(5) → 가로지르기(6~7 판정) → 앞위로 휘돌아 여운 → 복귀. 13프레임 */
export const EDWARD_SWING: MotionData = {
  name: 'edward/swing',
  label: '에드워드 2타 옆 휘두르기',
  wide: true,
  smear: { frame: 4, limb: 'aF', stretch: 1.35 },
  dur: [2, 2, 2, 2, 1, 2, 1, 2, 4, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: C2_LOAD },
    { at: 2, pose: C2_COIL, stop: true },
    { at: 3, pose: C2_TURN },
    { at: 4, pose: C2_SMEAR },
    { at: 5, pose: C2_HIT },
    { at: 6, pose: C2_HIT },
    { at: 7, pose: C2_OVER },
    { at: 8, pose: C2_HOLD, stop: true },
    { at: 9, pose: C2_BACK1 },
    { at: 11, pose: C2_BACK2 },
    { at: 12, pose: STANCE_TURNED },
  ],
};

// ---- 3타: 올려치기 (낮게 뒤에서 앞위로 크게 퍼 올린다) ----
/** 감기: 해머를 뒤 아래로 늘어뜨리며 웅크린다 */
const C3_LOAD = G({ hx: -2, hy: -17, tl: 14, hd: -6, tw: -2, aFx: -6, aFy: 12, lFx: 10, lBx: -12, wa: -210 });
/** 감기 끝 (멈칫): 해머 머리가 뒤 바닥 가까이 */
const C3_COIL = G({ hx: -3, hy: -15, tl: 20, hd: -8, tw: -3, aFx: -8, aFy: 12, lFx: 12, lBx: -13, wa: -225 });
/** 스미어: 몸을 일으키며 해머가 발 앞 아래를 지나 올라온다 */
const C3_SMEAR = A({ hx: 2, hy: -15.5, tl: 16, hd: -8, tw: 3, lFx: 16, lBx: -15, wa: -290 }, 33, -6);
/** 타격: 두 팔을 앞위로 뻗어 해머 머리가 얼굴 높이 앞으로 솟는다 */
const C3_HIT = X({ hx: 4, hy: -16, tl: 22, hd: -10, tw: 4.5, lFx: 17, lBx: -15, wa: -380 }, -14);
const C3_HIT2 = X({ hx: 4.5, hy: -16.5, tl: 18, hd: -12, tw: 4.5, lFx: 17, lBx: -15, wa: -400 }, -32);
/** 지나치기: 해머가 머리 위까지 올라간다 */
const C3_OVER = X({ hx: 4.5, hy: -17.5, tl: 8, hd: -14, tw: 4, lFx: 17, lBx: -15, wa: -428 }, -55);
/** 여운 */
const C3_HOLD = X({ hx: 4, hy: -18, tl: 6, hd: -14, tw: 3.5, lFx: 17, lBx: -15, wa: -432 }, -58);
/** 복귀: 그대로 뒤로 넘겨 어깨에 */
const C3_BACK1 = G({ hx: 2, hy: -20, tl: 2, hd: -6, tw: 1, aFx: 5, aFy: -9, lFx: 12, lBx: -11, wa: -470 });
const C3_BACK2 = E({ hx: 0.5, hy: -21.5, tl: -2, hd: -3, aFx: 6, aFy: 3, aBx: -3, aBy: 11, lFx: 8, lBx: -8, wa: -500 });

/** 3타 올려치기 (128×96): 뒤 아래로 감고(2~3) → 스미어(4) → 앞위로 퍼 올림(5~6 판정) → 머리 위까지 지나침 → 여운 → 복귀. 13프레임 */
export const EDWARD_RISE: MotionData = {
  name: 'edward/rise',
  label: '에드워드 3타 올려치기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 3, 4, 1, 2, 2, 2, 1, 4, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: C3_LOAD },
    { at: 2, pose: C3_COIL, stop: true },
    { at: 3, pose: C3_SMEAR },
    { at: 4, pose: C3_HIT },
    { at: 5, pose: C3_HIT2 },
    { at: 6, pose: C3_OVER },
    { at: 7, pose: C3_OVER, stop: true },
    { at: 8, pose: C3_HOLD },
    { at: 9, pose: C3_BACK1 },
    { at: 11, pose: C3_BACK2 },
    { at: 12, pose: STANCE_TURNED },
  ],
};

// ---- 4타: 머리 위에서 땅을 내려찍기 (충격파가 앞으로 달린다) ----
/** 감기: 해머를 두 손으로 머리 위 뒤로 크게 치켜든다, 가슴을 젖힌다 */
const C4_LIFT = G({ hx: -1, hy: -21, tl: -10, hd: -10, tw: -1, aFx: 0, aFy: -12, lFx: 9, lBx: -10, wa: -120 });
/** 감기 끝 (멈칫): 더 젖혀 해머가 등 뒤로 넘어간다, 뒷발에 실린다 */
const C4_COIL = G({ hx: -3, hy: -20, tl: -16, hd: -10, tw: -2, aFx: -2, aFy: -13, lFx: 11, lBx: -12, wa: -150 });
/** 스미어: 몸을 앞으로 접으며 해머가 머리 위를 넘어온다 (앞발 크게 내딛음) */
const C4_SMEAR = A({ hx: 3, hy: -16, tl: 18, hd: -8, tw: 3, lFx: 18, lBx: -16, wa: -50 }, 44, -60);
/** 타격: 해머 머리를 발 앞 바닥에 내리꽂는다. 깊게 숙이고 두 팔을 끝까지 */
const C4_HIT = A({ hx: 6, hy: -14, tl: 36, hd: 2, tw: 4.5, lFx: 18, lBx: -17, wa: 60 }, 47, -3.5);
const C4_HIT2 = A({ hx: 6.5, hy: -13.5, tl: 38, hd: 4, tw: 5, lFx: 18, lBx: -17.5, wa: 62 }, 47.5, -3.5);
/** 여운: 바닥에 박힌 채 버틴다 */
const C4_HOLD = A({ hx: 6, hy: -14, tl: 36, hd: 4, tw: 4.5, lFx: 18, lBx: -17, wa: 63 }, 47, -3.5);
/** 복귀: 해머를 뽑아 들어 올려 어깨로 */
const C4_BACK1 = G({ hx: 3, hy: -18, tl: 16, hd: -2, tw: 2, aFx: 12, aFy: 4, lFx: 14, lBx: -13, wa: -10 });
const C4_BACK2 = G({ hx: 1, hy: -20.5, tl: 2, hd: -2, tw: 1, aFx: 6, aFy: -5, lFx: 10, lBx: -10, wa: -100 });

/** 4타 내려찍기 (128×96): 머리 위로 치켜듦(2~3) → 젖혀 멈칫(4~5) → 스미어(6) → 바닥에 내리꽂음(7~8 판정) → 박힌 채 여운 → 복귀. 14프레임 */
export const EDWARD_SMASH: MotionData = {
  name: 'edward/smash',
  label: '에드워드 4타 내려찍기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.35 },
  dur: [2, 2, 3, 3, 3, 1, 2, 2, 2, 5, 4, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 2, pose: C4_LIFT },
    { at: 4, pose: C4_COIL, stop: true },
    { at: 5, pose: C4_SMEAR },
    { at: 6, pose: C4_HIT },
    { at: 7, pose: C4_HIT2 },
    { at: 9, pose: C4_HOLD, stop: true },
    { at: 11, pose: C4_BACK1 },
    { at: 12, pose: C4_BACK2 },
    { at: 13, pose: E_STANCE },
  ],
};

// ---- 띄우기: 퍼 올리기 (바닥을 긁고 수직으로 솟구친다, 몸도 함께 솟는다) ----
/** 감기: 깊게 웅크려 해머 머리를 발 앞 바닥에 댄다 */
const L_LOAD = A({ hx: -1, hy: -14, tl: 30, hd: -8, tw: 1, lFx: 13, lBx: -14, wa: 80 }, 28, -5);
/** 감기 끝 (멈칫): 더 웅크린다 */
const L_COIL = A({ hx: -1.5, hy: -12.5, tl: 34, hd: -10, tw: 1.5, lFx: 14, lBx: -14, wa: 86 }, 27, -4.5);
/** 스미어: 몸을 펴며 해머를 수직으로 퍼 올린다 */
const L_SMEAR = A({ hx: 3, hy: -18, tl: 10, hd: -14, tw: 3, lFx: 15, lBx: -13, wa: -40 }, 34, -40);
/** 타격: 발끝으로 솟구치며 두 팔을 위로 뻗어 해머 머리가 머리 위 앞으로 */
const L_HIT = X({ hx: 4, hy: -23, tl: -2, hd: -18, tw: 4.5, lFx: 12, lFy: -2, lBx: -10, lBy: -1, wa: -76 }, -74);
const L_HIT2 = X({ hx: 4, hy: -24, tl: -6, hd: -20, tw: 4.5, lFx: 11, lFy: -3, lBx: -9, lBy: -2, wa: -86 }, -82);
/** 여운: 해머를 머리 위에 세운 채 */
const L_HOLD = X({ hx: 3.5, hy: -23, tl: -6, hd: -18, tw: 4, lFx: 11, lFy: -1, lBx: -9, wa: -92 }, -86);
/** 복귀 */
const L_BACK1 = G({ hx: 2, hy: -20, tl: -2, hd: -8, tw: 2, aFx: 5, aFy: -10, lFx: 10, lBx: -9, wa: -115 });
const L_BACK2 = E({ hx: 0.5, hy: -21.5, tl: -2, hd: -3, aFx: 6, aFy: 3, aBx: -3, aBy: 11, lFx: 8, lBx: -8, wa: -142 });

/** 띄우기 퍼 올리기 (128×96): 웅크려 해머를 바닥에 대고(2~3) → 스미어(4) → 수직으로 퍼 올리며 솟구침(5~7 판정) → 여운 → 복귀. 13프레임 */
export const EDWARD_SCOOP: MotionData = {
  name: 'edward/scoop',
  label: '에드워드 띄우기 퍼 올리기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 3, 4, 1, 2, 2, 2, 1, 4, 3, 3, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: L_LOAD },
    { at: 2, pose: L_COIL, stop: true },
    { at: 3, pose: L_SMEAR },
    { at: 4, pose: L_HIT },
    { at: 5, pose: L_HIT2 },
    { at: 7, pose: L_HOLD, stop: true },
    { at: 9, pose: L_BACK1 },
    { at: 11, pose: L_BACK2 },
    { at: 12, pose: E_STANCE },
  ],
};

// ---- 쓸기: 바닥 쓸기 (낮게 엎드려 해머 머리로 발목 높이를 가로지른다) ----
/** 감기: 낮게 웅크리며 해머를 뒤로 끌어 바닥에 댄다 */
const W_LOAD = G({ hx: -2, hy: -13, tl: 26, hd: -10, tw: -2, aFx: -6, aFy: 13, lFx: 12, lBx: -14, wa: -188 });
/** 감기 끝 (멈칫) */
const W_COIL = G({ hx: -3, hy: -12, tl: 28, hd: -12, tw: -3, aFx: -8, aFy: 13, lFx: 13, lBx: -15, wa: -182 });
/** 스미어: 몸을 앞으로 던지며 해머가 바닥을 스친다 */
const W_SMEAR = A({ hx: 2, hy: -11, tl: 34, hd: -14, tw: 3, lFx: 18, lBx: -16, wa: -272 }, 25, -5);
/** 타격: 엎드리듯 낮게, 두 팔을 앞아래로 뻗어 해머 머리가 발목 높이 앞을 쓴다 */
const W_HIT = X({ hx: 5, hy: -10.5, tl: 40, hd: -14, tw: 4.5, lFx: 19, lBx: -17, wa: -348 }, 42);
/** 지나치기: 해머가 앞으로 더 쓸려 나간다 */
const W_OVER = X({ hx: 5.5, hy: -10.5, tl: 40, hd: -12, tw: 5, lFx: 19, lBx: -17.5, wa: -366 }, 36);
/** 여운 */
const W_HOLD = X({ hx: 5, hy: -11, tl: 38, hd: -12, tw: 4.5, lFx: 19, lBx: -17, wa: -370 }, 32);
/** 복귀: 일어서며 해머를 들어 어깨로 */
const W_BACK1 = G({ hx: 2, hy: -16, tl: 16, hd: -4, tw: 2, aFx: 11, aFy: -2, lFx: 14, lBx: -13, wa: -415 });
const W_BACK2 = E({ hx: 0.5, hy: -20.5, tl: 2, hd: -2, aFx: 6, aFy: 3, aBx: -3, aBy: 11, lFx: 9, lBx: -9, wa: -490 });

/** 쓸기 바닥 쓸기 (128×96): 낮게 감고(2~3) → 스미어(4) → 발목 높이를 가로지름(5~6 판정) → 지나치기 → 여운 → 복귀. 13프레임 */
export const EDWARD_SWEEP: MotionData = {
  name: 'edward/sweep',
  label: '에드워드 쓸기 바닥 쓸기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 3, 3, 1, 2, 2, 2, 1, 4, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: W_LOAD },
    { at: 2, pose: W_COIL, stop: true },
    { at: 3, pose: W_SMEAR },
    { at: 4, pose: W_HIT },
    { at: 5, pose: W_HIT },
    { at: 6, pose: W_OVER },
    { at: 7, pose: W_OVER, stop: true },
    { at: 8, pose: W_HOLD },
    { at: 9, pose: W_BACK1 },
    { at: 11, pose: W_BACK2 },
    { at: 12, pose: STANCE_TURNED },
  ],
};

// ---- 대시 공격: 돌진하며 크게 휘두르기 (어깨로 밀고 들어가던 힘을 실어 해머가 크게 가로지른다) ----
/** 돌진 자세에서 이어진다: 몸을 숙이고 해머는 어깨 뒤 */
const D_RUSH = G({ hx: 2, hy: -16, tl: 30, hd: -14, tw: 2, aFx: 2, aFy: 1, lFx: 15, lBx: -15, wa: -150 });
/** 감기 (멈칫): 해머를 등 뒤로 크게 돌려 끈다 */
const D_COIL = G({ hx: 1, hy: -16, tl: 18, hd: -10, tw: -4, aFx: -6, aFy: 4, lFx: 16, lBx: -15, wa: -188 });
/** 스미어 */
const D_SMEAR = A({ hx: 3, hy: -14.5, tl: 26, hd: -8, tw: 3, lFx: 18, lBx: -16, wa: -300 }, 34, -2);
/** 타격: 가슴 높이를 크게 가로지른다, 앞발로 미끄러지며 버틴다 */
const D_HIT = X({ hx: 5, hy: -14, tl: 30, hd: -6, tw: 5, lFx: 19, lBx: -17, wa: -362 }, -6);
/** 지나치기 */
const D_OVER = X({ hx: 5.5, hy: -14, tl: 28, hd: -8, tw: 5, lFx: 19, lBx: -17.5, wa: -388 }, -22);
/** 여운 */
const D_HOLD = X({ hx: 5, hy: -14.5, tl: 26, hd: -8, tw: 4.5, lFx: 19, lBx: -17, wa: -394 }, -26);
const D_BACK1 = G({ hx: 2.5, hy: -18, tl: 12, hd: -4, tw: 2, aFx: 7, aFy: -6, lFx: 13, lBx: -12, wa: -455 });
const D_BACK2 = E({ hx: 0.5, hy: -21, tl: 0, hd: -2, aFx: 6, aFy: 3, aBx: -3, aBy: 11, lFx: 9, lBx: -9, wa: -495 });

/** 대시 공격 돌진 휘두르기 (128×96): 돌진 자세 → 등 뒤로 감고(2~4) → 스미어(5) → 크게 가로지름(6~7 판정) → 여운 → 복귀. 13프레임 */
export const EDWARD_RUSH: MotionData = {
  name: 'edward/rush',
  label: '에드워드 대시 공격 돌진 휘두르기',
  wide: true,
  smear: { frame: 4, limb: 'aF', stretch: 1.4 },
  dur: [1, 2, 2, 2, 1, 2, 2, 1, 4, 3, 3, 2, 2],
  keys: [
    { at: 0, pose: D_RUSH },
    { at: 1, pose: D_RUSH },
    { at: 3, pose: D_COIL, stop: true },
    { at: 4, pose: D_SMEAR },
    { at: 5, pose: D_HIT },
    { at: 6, pose: D_HIT },
    { at: 7, pose: D_OVER },
    { at: 8, pose: D_HOLD, stop: true },
    { at: 10, pose: D_BACK1 },
    { at: 11, pose: D_BACK2 },
    { at: 12, pose: STANCE_TURNED },
  ],
};

// ---- 공중 1타: 공중 내려치기 ----
const AIR_BASE: Partial<Pose> = { hy: -24, lFx: 7, lFy: -11, lBx: -3, lBy: -9 };
/** 공중 꼭대기 자세 (해머는 어깨) */
const AIR_REST = E({ ...AIR_BASE, tl: 6, hd: -2, aFx: 5, aFy: 5.5, aBx: -6, aBy: 4, wa: -148 });
/** 해머가 한 바퀴 돌고 돌아온 공중 자세 (그림은 같다) */
const AIR_REST_LOOP: Pose = { ...AIR_REST, wa: -148 - 360 };
/** 감기: 몸을 젖히며 해머를 머리 뒤로 */
const A1_COIL = G({ ...AIR_BASE, tl: -10, hd: -8, tw: -2, aFx: 2, aFy: -4, wa: -170 });
const A1_SMEAR = A({ ...AIR_BASE, tl: 8, hd: -6, tw: 3, wa: -60 }, 24, -66);
/** 타격: 앞으로 접으며 해머를 앞아래로 내려친다 (다리는 뒤로 펴 균형) */
const A1_HIT = X({ hy: -24, tl: 26, hd: -4, tw: 4, lFx: 3, lFy: -8, lBx: -9, lBy: -5, wa: 22 }, 16);
const A1_HIT2 = X({ hy: -24, tl: 28, hd: -4, tw: 4.5, lFx: 3, lFy: -8, lBx: -9, lBy: -5, wa: 32 }, 24);
const A1_HOLD = X({ hy: -24, tl: 26, hd: -4, tw: 4, lFx: 4, lFy: -9, lBx: -8, lBy: -6, wa: 36 }, 28);
const A1_BACK = G({ ...AIR_BASE, tl: 10, hd: -4, tw: 2, aFx: 8, aFy: -6, wa: -60 });

/** 공중 1타 내려치기 (128×96): 감기(2~3) → 스미어(4) → 앞아래로 내려침(5~6 판정) → 여운 → 해머를 어깨로. 12프레임 */
export const EDWARD_AIR_CHOP: MotionData = {
  name: 'edward/air_chop',
  label: '에드워드 공중 1타 내려치기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 2, 2, 1, 2, 2, 1, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 2, pose: A1_COIL, stop: true },
    { at: 3, pose: A1_SMEAR },
    { at: 4, pose: A1_HIT },
    { at: 5, pose: A1_HIT2 },
    { at: 7, pose: A1_HOLD, stop: true },
    { at: 9, pose: A1_BACK },
    { at: 11, pose: AIR_REST },
  ],
};

// ---- 공중 2타: 공중 옆 휘두르기 (아래 뒤에서 앞위로 가로지른다) ----
const A2_COIL = G({ ...AIR_BASE, tl: 10, hd: -4, tw: -3, aFx: -6, aFy: 9, wa: -195 });
const A2_SMEAR = A({ ...AIR_BASE, tl: 18, hd: -4, tw: 3, wa: -300 }, 30, -6);
/** 타격: 가슴 높이에서 해머를 끝까지 뻗어 앞을 가로지른다 */
const A2_HIT = X({ hy: -24, tl: 22, hd: -4, tw: 5, lFx: 6, lFy: -10, lBx: -6, lBy: -6, wa: -366 }, -10);
const A2_OVER = X({ hy: -24, tl: 18, hd: -6, tw: 5, lFx: 6, lFy: -10, lBx: -6, lBy: -6, wa: -394 }, -26);
const A2_HOLD = X({ hy: -24, tl: 16, hd: -6, tw: 4.5, lFx: 6, lFy: -10, lBx: -5, lBy: -7, wa: -400 }, -30);
const A2_BACK = G({ ...AIR_BASE, tl: 8, hd: -4, tw: 2, aFx: 6, aFy: -8, wa: -460 });

/** 공중 2타 옆 휘두르기 (128×96): 아래 뒤로 감고(2~3) → 스미어(4) → 가로지름(5~6 판정) → 앞위로 휘돌아 여운 → 어깨로. 12프레임 */
export const EDWARD_AIR_SWING: MotionData = {
  name: 'edward/air_swing',
  label: '에드워드 공중 2타 옆 휘두르기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 2, 2, 1, 2, 2, 1, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 2, pose: A2_COIL, stop: true },
    { at: 3, pose: A2_SMEAR },
    { at: 4, pose: A2_HIT },
    { at: 5, pose: A2_OVER },
    { at: 7, pose: A2_HOLD, stop: true },
    { at: 9, pose: A2_BACK },
    { at: 11, pose: AIR_REST_LOOP },
  ],
};

// ---- 공중 3타: 공중 한 바퀴 돌려치기 (몸을 웅크려 해머가 몸 둘레를 한 바퀴 돈다) ----
/** 감기: 해머를 머리 위 뒤로 */
const A3_COIL = G({ ...AIR_BASE, tl: -6, hd: -6, tw: -2, aFx: 1, aFy: -6, wa: -160 });
/** 한 바퀴: 해머 머리가 위 → 앞 → 아래 → 뒤 → 위 (각도를 이어서 돈다), 몸은 공처럼 웅크린다 */
const A3_TOP = A({ ...AIR_BASE, tl: 6, hd: -6, tw: 3, lFx: 7, lFy: -14, lBx: 0, lBy: -12, wa: -80 }, 24, -70);
const A3_FRONT = X({ ...AIR_BASE, tl: 20, hd: -4, tw: 5, lFx: 7, lFy: -14, lBx: 0, lBy: -12, wa: 0 }, -6);
const A3_LOW = A({ ...AIR_BASE, tl: 24, hd: -2, tw: 4, lFx: 7, lFy: -14, lBx: 0, lBy: -12, wa: 80 }, 32, -6);
const A3_BACKSIDE = G({ ...AIR_BASE, tl: 14, hd: -4, tw: -2, aFx: -6, aFy: 8, lFx: 7, lFy: -13, lBx: 0, lBy: -11, wa: 165 });
const A3_END = G({ ...AIR_BASE, tl: 6, hd: -4, tw: 0, aFx: 2, aFy: -4, wa: 210 });
const AIR_REST_TURNED: Pose = { ...AIR_REST, wa: 212 };

/** 공중 3타 한 바퀴 돌려치기 (128×96): 감기(2) → 위에서 앞으로(3~4) → 앞을 가로질러(5~7 판정) → 아래·뒤로 한 바퀴 → 어깨로. 13프레임 */
export const EDWARD_AIR_SPIN: MotionData = {
  name: 'edward/air_spin',
  label: '에드워드 공중 3타 한 바퀴 돌려치기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 2, 2, 1, 2, 2, 2, 1, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 1, pose: A3_COIL, stop: true },
    { at: 3, pose: A3_TOP },
    { at: 5, pose: A3_FRONT },
    { at: 7, pose: A3_LOW },
    { at: 9, pose: A3_BACKSIDE },
    { at: 11, pose: A3_END },
    { at: 12, pose: AIR_REST_TURNED },
  ],
};

// ---- 내려찍기 (공중): 해머를 머리 위에서 발밑까지 수직으로 내리꽂는다 ----
const S_LIFT = G({ ...AIR_BASE, tl: -10, hd: -10, tw: -1, aFx: 0, aFy: -10, wa: -115 });
const S_COIL = G({ ...AIR_BASE, tl: -16, hd: -10, tw: -2, aFx: -2, aFy: -11, wa: -145 });
const S_SMEAR = A({ ...AIR_BASE, tl: 14, hd: -6, tw: 3, wa: -40 }, 40, -58);
/** 타격: 몸을 앞으로 접으며 해머 머리를 발 앞 아래로 내리꽂는다 */
const S_HIT = A({ hy: -26, tl: 34, hd: 4, tw: 4.5, lFx: 6, lFy: -8, lBx: -8, lBy: -4, wa: 76 }, 33, -6);
const S_HIT2 = A({ hy: -26, tl: 36, hd: 6, tw: 5, lFx: 6, lFy: -8, lBx: -8, lBy: -4, wa: 84 }, 31, -5);
const S_HOLD = A({ hy: -26, tl: 34, hd: 6, tw: 4.5, lFx: 6, lFy: -8, lBx: -8, lBy: -5, wa: 86 }, 30, -5);
const S_BACK = G({ ...AIR_BASE, tl: 14, hd: -2, tw: 2, aFx: 10, aFy: 2, wa: 20 });
const S_BACK2 = G({ ...AIR_BASE, tl: 8, hd: -2, tw: 1, aFx: 7, aFy: -6, wa: -90 });

/** 내려찍기 (128×96): 머리 위로 치켜듦(2~3, 멈칫) → 스미어(4) → 발 앞 아래로 내리꽂음(5~7 판정) → 여운 → 어깨로. 13프레임 */
export const EDWARD_AIR_SLAM: MotionData = {
  name: 'edward/air_slam',
  label: '에드워드 내려찍기',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.35 },
  dur: [2, 2, 3, 1, 2, 2, 2, 3, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 1, pose: S_LIFT },
    { at: 2, pose: S_COIL, stop: true },
    { at: 3, pose: S_SMEAR },
    { at: 4, pose: S_HIT },
    { at: 5, pose: S_HIT2 },
    { at: 7, pose: S_HOLD, stop: true },
    { at: 9, pose: S_BACK },
    { at: 10, pose: S_BACK2 },
    { at: 12, pose: AIR_REST },
  ],
};

export const EDWARD_ATTACK_MOTIONS: readonly MotionData[] = [
  EDWARD_CHOP, EDWARD_SWING, EDWARD_RISE, EDWARD_SMASH, EDWARD_SCOOP, EDWARD_SWEEP, EDWARD_RUSH,
  EDWARD_AIR_CHOP, EDWARD_AIR_SWING, EDWARD_AIR_SPIN, EDWARD_AIR_SLAM,
];
