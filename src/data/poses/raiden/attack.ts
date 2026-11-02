import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 평타 11개 (캐릭터 기획서 '평타': MMA, 동작연출지침서 7장 라이덴 표).
 * 모두 128×96 칸 (발밑 64, 93). 기본자세(MMA 가드)에서 시작해 기본자세로 끝난다 (공중 평타는 공중 웅크림에서 시작·끝).
 * 박자 (지침서 3장): 감기(마지막 키 stop) → 스미어 1틱(치는 팔다리 1.3~1.45배) → 타격 → 지나치기 → 여운(뻗은 자세로 멈춤) → 복귀.
 * 판정 프레임·몸 이동·궤적 상자는 data/characters/raiden.ts의 moves. 치지 않는 손은 늘 턱 앞에 남긴다.
 */

// ---- 1타: 잽 (동작연출지침서 7장: 앞발을 크게 내디디며 앞손 스트레이트, 짧은 직선 번개) ----
// 128×96 칸. 감기(2~3프레임, 마지막 멈칫) → 스미어 1틱(4프레임, 앞팔 1.4배) → 타격(5~6프레임 판정) → 지나치기 → 여운(뻗은 자세로 멈춤) → 복귀.
// 타격 프레임 기준값(2장): 발 간격 34px, 엉덩이 5px 낮게, 몸통 36°, 앞팔 끝까지(18px), 앞어깨 5px 앞, 뒷발→엉덩이→어깨→주먹 한 줄(어긋남 12°)
/** 감기 1: 무게를 뒷발로 옮기며 어깨를 뒤로 돌린다 */
const JAB_LOAD = R({ hx: -1.5, hy: -17.5, tl: 10, hd: 10, tw: -1, aFx: 10, aFy: -6, aBx: 7, aBy: -1, lFx: 9, lBx: -10 });
/** 감기 끝 (멈칫): 뒷발에 실어 웅크리고, 앞주먹을 얼굴 앞으로 당겨 어깨를 뒤로 감는다 */
const JAB_COIL = R({ hx: -3, hy: -16, tl: 6, hd: 12, tw: -2.5, aFx: 7, aFy: -7, aBx: 6, aBy: -2, lFx: 10, lBx: -12 });
/** 스미어: 앞발을 크게 내디디며 앞팔이 쏘아져 나간다 (그림은 앞팔 1.4배) */
const JAB_SMEAR = R({ hx: 1.5, hy: -14.5, tl: 28, hd: 9, tw: 3, aFx: 15, aFy: -7, aBx: 6, aBy: -2, lFx: 17, lBx: -14 });
/** 타격: 몸을 실어 앞손을 끝까지, 뒷손은 턱, 뒷다리는 길게 뻗어 한 줄 */
const JAB_HIT = R({ hx: 4, hy: -14, tl: 36, hd: 8, tw: 5, aFx: 15.5, aFy: -8.7, aBx: 6, aBy: -2, lFx: 20, lBx: -14 });
const JAB_HIT2 = R({ hx: 4.5, hy: -13.8, tl: 37, hd: 8, tw: 5.5, aFx: 16.2, aFy: -9, aBx: 6, aBy: -2, lFx: 20, lBx: -14.5 });
/** 지나치기: 몸이 한 박 더 앞으로 쏠린다 */
const JAB_OVER = R({ hx: 5, hy: -13.5, tl: 39, hd: 8, tw: 6, aFx: 16.5, aFy: -8.5, aBx: 6, aBy: -2, lFx: 20, lBx: -15 });
/** 여운: 뻗은 자세로 멈췄다가 조금 가라앉는다 */
const JAB_HOLD = R({ hx: 4.5, hy: -14, tl: 37, hd: 8, tw: 5, aFx: 16, aFy: -8, aBx: 6, aBy: -1.5, lFx: 20, lBx: -14 });
/** 복귀: 팔을 거두며 발을 당긴다 */
const JAB_BACK1 = R({ hx: 2, hy: -16, tl: 26, hd: 9, tw: 2, aFx: 13, aFy: -6, aBx: 7, aBy: -1, lFx: 15, lBx: -12 });
const JAB_BACK2 = R({ hx: 0.5, hy: -18, tl: 18, hd: 8, tw: 0.5, aFx: 12.5, aFy: -5, aBx: 8, aBy: -0.5, lFx: 10, lBx: -10 });

/**
 * 1타 잽 (128×96): 감기(2~3프레임) → 스미어(4프레임 1틱) → 앞손을 끝까지(5~6프레임 판정) → 지나치기(7) → 여운(8~9) → 복귀(10~12).
 * 12프레임 23틱
 */
export const RAIDEN_JAB: MotionData = {
  name: 'raiden/jab',
  label: '라이덴 1타 잽',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.4 },
  // 박자 (사용자 피드백 2026-11-02 '1·2타는 붙여서 빠르게'): 감기 3틱 + 스미어 1틱 → 판정 5~6프레임
  dur: [1, 1, 1, 1, 2, 1, 1, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: JAB_LOAD },
    { at: 2, pose: JAB_COIL, stop: true },
    { at: 3, pose: JAB_SMEAR },
    { at: 4, pose: JAB_HIT },
    { at: 5, pose: JAB_HIT2 },
    { at: 6, pose: JAB_OVER },
    { at: 7, pose: JAB_OVER, stop: true },
    { at: 8, pose: JAB_HOLD },
    { at: 9, pose: JAB_BACK1 },
    { at: 10, pose: JAB_BACK2 },
    { at: 11, pose: R_STANCE },
  ],
};

// ---- 2타: 크로스 (지침서 7장: 뒷발을 비틀며 몸통을 돌려 뒷손 스트레이트, 더 긴 직선 + 전류 가지) ----
// 타격 프레임 기준값: 발 간격 34px, 엉덩이 5px 낮게, 몸통 34°, 뒷팔 끝까지, 뒷어깨 5~6px 앞(tw −5.5), 뒷발→엉덩이→뒷어깨→주먹 한 줄
/** 감기 1: 앞어깨를 앞으로 내밀어 뒷어깨를 뒤로 감고, 뒷주먹을 뺨으로 당긴다 (앞손은 길잡이로 조금 내민다) */
const CR_LOAD = R({ hx: -1, hy: -17.5, tl: 12, hd: 9, tw: 1.5, aFx: 12, aFy: -6, aBx: 6, aBy: -2, lFx: 9, lBx: -10 });
/** 감기 끝 (멈칫): 뒷발에 실어 낮게, 뒷어깨를 끝까지 뒤로 (뒷주먹은 귀 옆) */
const CR_COIL = R({ hx: -2.5, hy: -16, tl: 8, hd: 12, tw: 3, aFx: 12.5, aFy: -7.5, aBx: 4, aBy: -4, lFx: 10, lBx: -12 });
/** 스미어: 뒷발 뒤꿈치를 들어 비틀며 허리가 돌고 뒷팔이 쏘아져 나간다 (그림은 뒷팔 1.4배), 앞손은 턱으로 */
const CR_SMEAR = R({ hx: 2, hy: -15, tl: 26, hd: 9, tw: -3.5, aFx: 7, aFy: -3, aBx: 15, aBy: -7.5, lFx: 16, lBx: -14, lBy: -1 });
/** 타격: 뒷어깨가 앞장서 뒷손을 끝까지 곧게, 앞손은 턱, 뒷다리는 뒤로 길게 */
const CR_HIT = R({ hx: 4.5, hy: -14, tl: 34, hd: 9, tw: -5.5, aFx: 6.5, aFy: -2, aBx: 15.8, aBy: -8.2, lFx: 19, lBx: -15, lBy: -1 });
const CR_HIT2 = R({ hx: 5, hy: -13.8, tl: 35, hd: 9, tw: -6, aFx: 6.5, aFy: -2, aBx: 16.4, aBy: -8.4, lFx: 19, lBx: -15.5, lBy: -1 });
/** 지나치기: 허리가 한 박 더 돌아 몸이 앞으로 쏠린다 */
const CR_OVER = R({ hx: 5.5, hy: -13.5, tl: 38, hd: 9, tw: -6.5, aFx: 6.5, aFy: -1.5, aBx: 16.6, aBy: -7.8, lFx: 19, lBx: -16, lBy: -1.5 });
/** 여운 */
const CR_HOLD = R({ hx: 5, hy: -14, tl: 36, hd: 9, tw: -5.5, aFx: 6.5, aFy: -2, aBx: 16, aBy: -7.5, lFx: 19, lBx: -15, lBy: -1 });
/** 복귀: 허리를 되돌리며 뒷손을 거두고 뒷발을 당긴다 */
const CR_BACK1 = R({ hx: 3, hy: -16, tl: 26, hd: 9, tw: -2, aFx: 10, aFy: -4, aBx: 10, aBy: -3, lFx: 15, lBx: -11 });
const CR_BACK2 = R({ hx: 1, hy: -18, tl: 18, hd: 8, tw: -0.5, aFx: 12, aFy: -4.5, aBx: 8.5, aBy: -0.5, lFx: 11, lBx: -9 });

/** 2타 크로스 (128×96): 감기(2~3프레임) → 스미어(4) → 뒷손을 끝까지(5~6프레임 판정) → 지나치기 → 여운 → 복귀. 12프레임 23틱 */
export const RAIDEN_CROSS: MotionData = {
  name: 'raiden/cross',
  label: '라이덴 2타 크로스',
  wide: true,
  smear: { frame: 3, limb: 'aB', stretch: 1.4 },
  // 박자: 잽에 붙여 빠르게 (감기 3틱 + 스미어 1틱)
  dur: [1, 1, 1, 1, 2, 1, 1, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: CR_LOAD },
    { at: 2, pose: CR_COIL, stop: true },
    { at: 3, pose: CR_SMEAR },
    { at: 4, pose: CR_HIT },
    { at: 5, pose: CR_HIT2 },
    { at: 6, pose: CR_OVER },
    { at: 7, pose: CR_OVER, stop: true },
    { at: 8, pose: CR_HOLD },
    { at: 9, pose: CR_BACK1 },
    { at: 10, pose: CR_BACK2 },
    { at: 11, pose: R_STANCE },
  ],
};

// ---- 3타: 미들킥 (지침서 7장: 뒷다리가 크게 반원을 그림, 지름 약 56px 반원 번개) ----
// 뒷다리로 몸통을 찬다. 앞발 하나로 버티고 몸은 뒤로 젖혀 균형 (지침서 2장 '발차기는 뒤로 젖혀'). 뒷손은 뒤로 휘둘러 반동
/** 앞발을 비스듬히 앞으로 내디디며 무게를 싣는다 */
const MK_STEP = R({ hx: 2, hy: -18.5, tl: 10, hd: 10, aFx: 11, aFy: -7, aBx: 6, aBy: -2, lFx: 12, lBx: -10, lBy: -1 });
/** 감기 끝 (멈칫): 앞발 하나로 서서 뒷무릎을 앞으로 높이 끌어올린다 (정강이는 접어 뒤로), 뒷손은 아래로 내린다 */
const MK_CHAMBER = R({ hx: 3, hy: -21, tl: -4, hd: 14, aFx: 9, aFy: -10, aBx: -2, aBy: 8, lFx: 3, lBx: 6, lBy: -17 });
/** 스미어: 정강이가 채찍처럼 펴지며 앞으로 (그림은 뒷다리 1.35배), 뒷손이 뒤로 휘돈다 */
const MK_SMEAR = R({ hx: 4, hy: -21.5, tl: -10, hd: 16, aFx: 9, aFy: -11, aBx: -10, aBy: 5, lFx: 1, lBx: 20, lBy: -24 });
/** 타격: 뒷다리를 몸통 높이로 끝까지 뻗고 몸은 뒤로 젖혀 받친다 (앞손은 얼굴 앞, 뒷손은 뒤로 뻗어 균형) */
const MK_HIT = R({ hx: 5, hy: -21.5, tl: -16, hd: 20, aFx: 9, aFy: -11, aBx: -12, aBy: 4, lFx: -1, lBx: 29, lBy: -28 });
const MK_HIT2 = R({ hx: 5.5, hy: -21.5, tl: -17, hd: 20, aFx: 9, aFy: -11, aBx: -12.5, aBy: 3, lFx: -1, lBx: 29.5, lBy: -30 });
/** 지나치기: 찬 다리가 한 박 더 위로 휘어 지나간다 */
const MK_OVER = R({ hx: 5, hy: -21.5, tl: -20, hd: 22, aFx: 9, aFy: -11, aBx: -12, aBy: 1, lFx: -1, lBx: 27, lBy: -34 });
/** 여운: 다리를 뻗은 채 멈췄다가 조금 내려온다 */
const MK_HOLD = R({ hx: 5, hy: -21.5, tl: -18, hd: 21, aFx: 9, aFy: -11, aBx: -11, aBy: 3, lFx: -1, lBx: 27.5, lBy: -31 });
/** 다리를 접어 거둔다 */
const MK_RETRACT = R({ hx: 4, hy: -20.5, tl: -6, hd: 14, aFx: 10, aFy: -9, aBx: -4, aBy: 6, lFx: 0, lBx: 7, lBy: -14 });
/** 뒤로 내려 딛는다 */
const MK_STEPDOWN = R({ hx: 2, hy: -19, tl: 6, hd: 10, aFx: 11, aFy: -7, aBx: 4, aBy: 2, lFx: 4, lBx: -10, lBy: -2 });
const MK_BACK = R({ hx: 0.5, hy: -18.5, tl: 12, hd: 9, aFx: 12, aFy: -5, aBx: 7, aBy: 0, lFx: 7, lBx: -9 });

/** 3타 미들킥 (128×96): 내디딤(2) → 뒷무릎 끌어올림(3, 멈칫) → 스미어(4) → 몸통 높이로 끝까지(5~6프레임 판정) → 지나치기 → 여운 → 내려 딛기. 13프레임 25틱 */
export const RAIDEN_MIDDLE_KICK: MotionData = {
  name: 'raiden/middle_kick',
  label: '라이덴 3타 미들킥',
  wide: true,
  smear: { frame: 3, limb: 'lB', stretch: 1.35 },
  // 박자: 3타 앞에 짧은 틈 (내디딤 3틱·무릎 끌어올림 2틱에 멈칫 + 스미어 1틱 = 7틱)
  dur: [1, 3, 2, 1, 2, 1, 1, 4, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: MK_STEP },
    { at: 2, pose: MK_CHAMBER, stop: true },
    { at: 3, pose: MK_SMEAR },
    { at: 4, pose: MK_HIT },
    { at: 5, pose: MK_HIT2 },
    { at: 6, pose: MK_OVER },
    { at: 7, pose: MK_OVER, stop: true },
    { at: 8, pose: MK_HOLD },
    { at: 9, pose: MK_RETRACT },
    { at: 10, pose: MK_STEPDOWN },
    { at: 11, pose: MK_BACK },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 4타: 슈퍼맨 펀치 (지침서 7장: 한 발로 튀어 올라 전신을 한 줄로 뻗으며 날아듦, 상대가 멀리 날아감, 64px 넘는 적뢰 줄기) ----
// 뒷무릎을 차는 척 끌어올렸다가 앞발로 바닥을 박차 튀어 오르며, 뒷다리를 뒤로 차 뻗는 반동으로 뒷손을 내지른다.
// 타격 프레임: 뒷발 → 엉덩이 → 뒷어깨 → 주먹이 한 줄 (몸통 52°, 몸 전체가 비스듬한 창 하나)
/** 앞발로 크게 내디디며 뒷무릎을 들기 시작한다 */
const SM_STEP = R({ hx: 2, hy: -17.5, tl: 18, hd: 8, aFx: 11, aFy: -6, aBx: 6, aBy: -3, lFx: 14, lBx: -9, lBy: -2 });
/** 감기 끝 (멈칫): 차는 척 뒷무릎을 앞으로 높이, 뒷주먹은 귀 뒤로 크게 당기고 앞손을 길잡이로 내민다 */
const SM_CHAMBER = R({ hx: 2.5, hy: -20, tl: 4, hd: 12, tw: 3, aFx: 13, aFy: -6, aBx: -2, aBy: -8, lFx: 12, lBx: 5.5, lBy: -16 });
/** 박참: 앞발로 바닥을 차고 솟으며 뒷다리를 뒤로 휘두른다 */
const SM_HOP = R({ hx: 6, hy: -25, tl: 30, hd: 4, tw: -1, aFx: 12, aFy: -3, aBx: 0, aBy: -7, lFx: 13, lFy: -2, lBx: -10, lBy: -12 });
/** 스미어: 날아들며 뒷팔이 쏘아져 나간다 (그림은 뒷팔 1.45배) */
const SM_SMEAR = R({ hx: 8, hy: -26, tl: 46, hd: 2, tw: -4.5, aFx: 5, aFy: 2, aBx: 15, aBy: -9, lFx: 14, lFy: -9, lBx: -14, lBy: -12 });
/** 타격: 공중에서 뒷손을 끝까지, 뒷다리는 뒤로 길게, 앞다리는 접어 몸 밑에. 앞주먹은 가슴 */
const SM_HIT = R({ hx: 9, hy: -26, tl: 52, hd: 0, tw: -6, aFx: 4, aFy: 3, aBx: 15, aBy: -10.5, lFx: 15, lFy: -11, lBx: -12.5, lBy: -10 });
const SM_HIT2 = R({ hx: 10, hy: -26, tl: 53, hd: 0, tw: -6, aFx: 4, aFy: 3, aBx: 15.5, aBy: -10.2, lFx: 16, lFy: -11, lBx: -12, lBy: -10 });
/** 지나치기: 몸이 앞으로 쏠리며 내려오기 시작한다 */
const SM_OVER = R({ hx: 11, hy: -24.5, tl: 56, hd: 2, tw: -6.5, aFx: 4, aFy: 3, aBx: 15.5, aBy: -9, lFx: 18, lFy: -7, lBx: -11, lBy: -7 });
/** 여운: 뻗은 채 앞발로 내려선다 */
const SM_HOLD = R({ hx: 11, hy: -19, tl: 48, hd: 4, tw: -5.5, aFx: 5, aFy: 2, aBx: 15.5, aBy: -8, lFx: 20, lFy: 0, lBx: -7, lBy: -5 });
/** 착지: 앞무릎으로 받으며 뒷발을 끌어 딛는다 */
const SM_LAND = R({ hx: 9, hy: -15.5, tl: 32, hd: 8, tw: -3, aFx: 7, aFy: -2, aBx: 13, aBy: -6, lFx: 19, lBx: -4, lBy: -2 });
const SM_REC = R({ hx: 6, hy: -16.5, tl: 24, hd: 9, tw: -1, aFx: 11, aFy: -4, aBx: 9, aBy: -2, lFx: 16, lBx: -5 });
const SM_BACK = R({ hx: 3, hy: -18, tl: 18, hd: 8, aFx: 12, aFy: -4, aBx: 8, aBy: -0.5, lFx: 12, lBx: -7 });

/**
 * 4타 슈퍼맨 펀치 (128×96): 내디딤(2) → 차는 척 뒷무릎(3, 멈칫) → 박차고 솟음(4) → 스미어(5) → 공중에서 뒷손 끝까지(6~7프레임 판정)
 * → 지나치기 → 내려서며 여운 → 착지·복귀. 14프레임 28틱
 */
export const RAIDEN_SUPERMAN_PUNCH: MotionData = {
  name: 'raiden/superman_punch',
  label: '라이덴 4타 슈퍼맨 펀치',
  wide: true,
  smear: { frame: 4, limb: 'aB', stretch: 1.45 },
  // 박자: 4타 앞 감기가 가장 길다 (내디딤 2·차는 척 3·멈칫 3·박참 2 + 스미어 1 = 11틱)
  dur: [2, 3, 3, 2, 1, 2, 1, 2, 4, 3, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: SM_STEP },
    { at: 2, pose: SM_CHAMBER, stop: true },
    { at: 3, pose: SM_HOP },
    { at: 4, pose: SM_SMEAR },
    { at: 5, pose: SM_HIT },
    { at: 6, pose: SM_HIT2 },
    { at: 7, pose: SM_OVER },
    { at: 8, pose: SM_HOLD, stop: true },
    { at: 9, pose: SM_LAND },
    { at: 10, pose: SM_REC },
    { at: 12, pose: SM_BACK },
    { at: 13, pose: R_STANCE },
  ],
};

// ---- 띄우기: 어퍼컷 (지침서 7장: 몸이 함께 솟구침, 아래에서 위로 세로 번개) ----
/** 가라앉기 시작: 몸을 숙이며 뒷주먹을 아래로 */
const UP_SINK = R({ hx: 1, hy: -15, tl: 26, hd: 8, tw: 2, aFx: 11, aFy: -4, aBx: 5, aBy: 6, lFx: 13, lBx: -11 });
/** 감기 끝 (멈칫): 무릎을 깊이 굽혀 낮게 웅크리고 뒷주먹을 무릎 높이로 떨어뜨린다 (앞손은 턱) */
const UP_DIP = R({ hx: 2, hy: -11, tl: 34, hd: 4, tw: 3, aFx: 10, aFy: -2, aBx: 3, aBy: 12, lFx: 15, lBx: -12 });
/** 스미어: 다리를 펴며 솟구쳐 뒷주먹이 턱 밑으로 쏘아 오른다 (그림은 뒷팔 1.4배) */
const UP_SMEAR = R({ hx: 5, hy: -19, tl: 16, hd: -2, tw: -3, aFx: 8, aFy: -3, aBx: 10, aBy: -12, lFx: 15, lBx: -9, lBy: -2 });
/** 타격: 바닥을 차고 뛰어올라 몸이 곧게 펴지고 뒷주먹이 머리 위 끝까지 (두 발이 뜬다) */
const UP_HIT = R({ hx: 6, hy: -25, tl: 2, hd: -14, tw: -5, aFx: 7, aFy: -3, aBx: 5.5, aBy: -17.2, lFx: 14, lFy: -3, lBx: -4, lBy: -6 });
const UP_HIT2 = R({ hx: 6.5, hy: -26.5, tl: 0, hd: -15, tw: -5, aFx: 7, aFy: -3, aBx: 5, aBy: -17.5, lFx: 14, lFy: -5, lBx: -4, lBy: -8 });
/** 지나치기: 주먹이 머리 위를 조금 넘어 뒤로 젖혀진다 */
const UP_OVER = R({ hx: 6.5, hy: -27.5, tl: -4, hd: -16, tw: -5.5, aFx: 7, aFy: -3, aBx: 3, aBy: -17.6, lFx: 13, lFy: -7, lBx: -3, lBy: -9 });
/** 여운: 솟은 채 멈췄다가 내려오기 시작 */
const UP_HOLD = R({ hx: 6, hy: -26, tl: -2, hd: -14, tw: -5, aFx: 7, aFy: -3, aBx: 4, aBy: -17, lFx: 13, lFy: -5, lBx: -3, lBy: -6 });
/** 착지: 무릎으로 받는다 */
const UP_LAND = R({ hx: 4, hy: -15, tl: 18, hd: 8, tw: -1, aFx: 10, aFy: -3, aBx: 8, aBy: 0, lFx: 13, lBx: -7 });
const UP_REC = R({ hx: 2, hy: -17.5, tl: 16, hd: 8, aFx: 12, aFy: -4, aBx: 8, aBy: 0, lFx: 11, lBx: -8 });

/** 띄우기 어퍼컷 (128×96): 가라앉기(2) → 웅크림(3, 멈칫) → 스미어(4) → 솟구치며 머리 위까지(5~7프레임 판정) → 여운 → 착지. 13프레임 26틱 */
export const RAIDEN_UPPERCUT: MotionData = {
  name: 'raiden/uppercut',
  label: '라이덴 띄우기 어퍼컷',
  wide: true,
  smear: { frame: 3, limb: 'aB', stretch: 1.4 },
  dur: [1, 2, 2, 1, 2, 1, 2, 4, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: UP_SINK },
    { at: 2, pose: UP_DIP, stop: true },
    { at: 3, pose: UP_SMEAR },
    { at: 4, pose: UP_HIT },
    { at: 5, pose: UP_HIT2 },
    { at: 6, pose: UP_OVER },
    { at: 7, pose: UP_OVER, stop: true },
    { at: 8, pose: UP_HOLD },
    { at: 9, pose: UP_LAND },
    { at: 10, pose: UP_REC },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 쓸기: 다리 걸기 (지침서 7장: 낮게 엎드려 다리 걸기, 바닥을 쓰는 반원 + 물 튐) ----
// 낮게 엎드려 두 손을 바닥 가까이 감았다가, 몸을 뒤로 젖히며 뒷손으로 뒤 바닥을 짚고 뒷다리를 바닥 높이로 크게 쓸어 앞으로 뻗는다
// (상대 발목을 걷어 넘어뜨린다). 쓴 다리가 몸 앞에 홀로 길게 뻗어 실루엣이 읽히게 앞에는 아무것도 두지 않는다
/** 내려앉기 시작 */
const SW_DROP = R({ hx: 0, hy: -13, tl: 26, hd: 2, aFx: 10, aFy: 2, aBx: 6, aBy: 6, lFx: 11, lBx: -11 });
/** 감기 끝 (멈칫): 낮게 엎드려 두 손을 바닥 가까이 두고, 뒷다리를 뒤로 길게 뻗어 감는다 */
const SW_COIL = R({ hx: 0, hy: -8, tl: 40, hd: -12, aFx: 5, aFy: 14, aBx: 2, aBy: 15, lFx: 7, lBx: -20, lBy: -1 });
/** 스미어: 몸을 뒤로 일으키며 뒷다리가 바닥을 쓸어 앞으로 휘돈다 (그림은 뒷다리 1.35배) */
const SW_SMEAR = R({ hx: 1, hy: -7, tl: 0, hd: 8, aFx: 8, aFy: -4, aBx: -6, aBy: 12, lFx: 3, lBx: 10, lBy: -3 });
/** 타격: 몸을 뒤로 젖히고 뒷손으로 뒤 바닥을 짚은 채 뒷다리를 바닥 높이로 끝까지 앞으로 뻗는다. 앞손은 얼굴 앞 */
const SW_HIT = R({ hx: 1, hy: -8, tl: -28, hd: 22, aFx: 8, aFy: -6, aBx: -5, aBy: 17, lFx: 4, lBx: 27, lBy: -2 });
const SW_HIT2 = R({ hx: 1.5, hy: -8, tl: -30, hd: 23, aFx: 8, aFy: -6, aBx: -5, aBy: 17, lFx: 4, lBx: 28, lBy: -2.5 });
/** 지나치기: 쓴 다리가 앞에서 조금 들린다 */
const SW_OVER = R({ hx: 1.5, hy: -8.5, tl: -32, hd: 24, aFx: 8, aFy: -6, aBx: -5, aBy: 17, lFx: 4, lBx: 25, lBy: -6 });
const SW_HOLD = R({ hx: 1.5, hy: -8.5, tl: -30, hd: 23, aFx: 8, aFy: -6, aBx: -5, aBy: 17, lFx: 4, lBx: 25.5, lBy: -4 });
/** 다리를 거둬 몸 밑으로, 상체를 세운다 */
const SW_RETRACT = R({ hx: 0, hy: -10, tl: -10, hd: 14, aFx: 9, aFy: -5, aBx: -3, aBy: 10, lFx: 4, lBx: 6, lBy: -3 });
/** 일어선다 */
const SW_RISE = R({ hx: 0, hy: -14, tl: 10, hd: 6, aFx: 10, aFy: -2, aBx: 4, aBy: 4, lFx: 9, lBx: -8 });
const SW_BACK = R({ hx: -0.5, hy: -17.5, tl: 18, hd: 6, aFx: 12, aFy: -3, aBx: 8, aBy: 0, lFx: 9, lBx: -9 });

/** 쓸기 다리 걸기 (128×96): 내려앉기(2) → 엎드려 짚고 감기(3, 멈칫) → 스미어(4) → 바닥을 끝까지 쓸기(5~7프레임 판정) → 여운 → 일어서기. 13프레임 25틱 */
export const RAIDEN_LEG_SWEEP: MotionData = {
  name: 'raiden/leg_sweep',
  label: '라이덴 쓸기 다리 걸기',
  wide: true,
  smear: { frame: 3, limb: 'lB', stretch: 1.35 },
  dur: [1, 2, 2, 1, 2, 1, 1, 4, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: SW_DROP },
    { at: 2, pose: SW_COIL, stop: true },
    { at: 3, pose: SW_SMEAR },
    { at: 4, pose: SW_HIT },
    { at: 5, pose: SW_HIT2 },
    { at: 6, pose: SW_OVER },
    { at: 7, pose: SW_OVER, stop: true },
    { at: 8, pose: SW_HOLD },
    { at: 9, pose: SW_RETRACT },
    { at: 10, pose: SW_RISE },
    { at: 11, pose: SW_BACK },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 대시 공격: 플라잉 니 (지침서 7장: 달려와 무릎으로 뛰어듦, 몸 뒤로 끌리는 번개 꼬리) ----
/** 대시에서 이어지는 낮게 파고든 자세 */
const FK_RUN = R({ hx: 3, hy: -15, tl: 32, hd: -6, aFx: 11, aFy: 0, aBx: 6, aBy: 3, lFx: 14, lBx: -14 });
/** 구름발: 앞발을 디뎌 뛸 자리를 잡는다 */
const FK_STEP = R({ hx: 4, hy: -17, tl: 24, hd: -2, aFx: 9, aFy: -4, aBx: 4, aBy: 0, lFx: 10, lBx: -12, lBy: -2 });
/** 감기 끝 (멈칫): 박차기 직전, 두 팔을 위로 휘둘러 올리고 앞무릎이 떠오르기 시작한다 */
const FK_TAKEOFF = R({ hx: 5, hy: -20, tl: 14, hd: 4, aFx: 6, aFy: -10, aBx: 2, aBy: -9, lFx: 9, lFy: -3, lBx: -10, lBy: -2 });
/** 스미어: 뛰어오르며 앞무릎을 앞으로 내지른다 (그림은 무릎 1.3배), 두 팔은 위에서 아래로 끌어내린다 */
const FK_SMEAR = R({ hx: 7, hy: -27, tl: 6, hd: 8, aFx: 12, aFy: -2, aBx: 10, aBy: 0, lFx: 16, lFy: -22, lBx: -12, lBy: -10 });
/** 타격: 공중에서 앞무릎을 가슴 높이로 끝까지, 두 손은 상대 머리를 끌어내리듯 아래로, 뒷다리는 뒤로 길게 */
const FK_HIT = R({ hx: 8, hy: -29, tl: 4, hd: 10, aFx: 13, aFy: 6, aBx: 11, aBy: 8, lFx: 18, lFy: -21, lBx: -10, lBy: -13 });
const FK_HIT2 = R({ hx: 9, hy: -29.5, tl: 3, hd: 10, aFx: 13, aFy: 7, aBx: 11, aBy: 9, lFx: 19, lFy: -22, lBx: -10, lBy: -14 });
/** 지나치기: 무릎이 한 박 더 솟는다 */
const FK_OVER = R({ hx: 10, hy: -28.5, tl: 0, hd: 12, aFx: 12, aFy: 8, aBx: 10, aBy: 10, lFx: 20, lFy: -25, lBx: -9, lBy: -12 });
const FK_HOLD = R({ hx: 10, hy: -27, tl: 2, hd: 11, aFx: 12, aFy: 7, aBx: 10, aBy: 9, lFx: 19, lFy: -22, lBx: -9, lBy: -10 });
/** 착지: 앞발로 내려서며 무릎으로 받는다 */
const FK_LAND = R({ hx: 8, hy: -16, tl: 22, hd: 8, aFx: 11, aFy: -2, aBx: 8, aBy: 1, lFx: 16, lBx: -6, lBy: -2 });
const FK_REC = R({ hx: 5, hy: -17, tl: 20, hd: 8, aFx: 12, aFy: -4, aBx: 8, aBy: 0, lFx: 13, lBx: -7 });
const FK_BACK = R({ hx: 2, hy: -18.5, tl: 16, hd: 8, aFx: 12.5, aFy: -4, aBx: 8, aBy: 0, lFx: 10, lBx: -8 });

/** 대시 공격 플라잉 니 (128×96): 파고든 자세(1) → 구름발(2) → 박차기 직전(3, 멈칫) → 스미어(4) → 공중 무릎(5~7프레임 판정) → 여운 → 착지. 13프레임 25틱 */
export const RAIDEN_FLYING_KNEE: MotionData = {
  name: 'raiden/flying_knee',
  label: '라이덴 대시 공격 플라잉 니',
  wide: true,
  smear: { frame: 3, limb: 'kF', stretch: 1.3 },
  dur: [1, 1, 2, 1, 2, 1, 2, 4, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: FK_RUN },
    { at: 1, pose: FK_STEP },
    { at: 2, pose: FK_TAKEOFF, stop: true },
    { at: 3, pose: FK_SMEAR },
    { at: 4, pose: FK_HIT },
    { at: 5, pose: FK_HIT2 },
    { at: 6, pose: FK_OVER },
    { at: 7, pose: FK_OVER, stop: true },
    { at: 8, pose: FK_HOLD },
    { at: 9, pose: FK_LAND },
    { at: 10, pose: FK_REC },
    { at: 11, pose: FK_BACK },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 공중 평타: 공중 잽 → 공중 크로스 → 공중 돌려차기, 내려찍기 도끼차기 ----
/** 공중 기본 (라이덴 점프의 웅크림과 같은 꼴) */
const A_TUCK = R({ hx: 0, hy: -26, tl: 16, hd: 7, aFx: 11, aFy: -4, aBx: 8, aBy: -1, lFx: 7, lFy: -13, lBx: -1, lBy: -11 });
/** 떨어지는 자세로 (라이덴 낙하 첫 자세) */
const A_OPEN = R({ hx: 0, hy: -25, tl: 14, hd: 7, aFx: 11, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -7, lBx: -6, lBy: -5 });

// 공중 잽: 몸을 젖혀 앞손을 당겼다가 크게 숙이며 앞 아래로 (약 20°) 끝까지. 다리는 앞무릎을 들고 뒷다리를 뒤로 뻗어 버팀
const AJ_LOAD = R({ hx: -1, hy: -26, tl: 8, hd: 8, tw: -2, aFx: 8, aFy: -7, aBx: 8, aBy: -1, lFx: 6, lFy: -14, lBx: -2, lBy: -12 });
const AJ_COIL = R({ hx: -2, hy: -26, tl: 4, hd: 10, tw: -3, aFx: 6, aFy: -8, aBx: 7, aBy: -2, lFx: 6, lFy: -15, lBx: -3, lBy: -12 });
const AJ_SMEAR = R({ hx: 1, hy: -26, tl: 26, hd: 10, tw: 3, aFx: 16, aFy: 3, aBx: 6, aBy: -2, lFx: 8, lFy: -14, lBx: -7, lBy: -10 });
const AJ_HIT = R({ hx: 2, hy: -26, tl: 32, hd: 10, tw: 5, aFx: 16.8, aFy: 6, aBx: 6, aBy: -2, lFx: 9, lFy: -14, lBx: -10, lBy: -10 });
const AJ_HIT2 = R({ hx: 2.5, hy: -26, tl: 33, hd: 10, tw: 5.5, aFx: 17.2, aFy: 6.2, aBx: 6, aBy: -2, lFx: 9, lFy: -14, lBx: -10.5, lBy: -10 });
const AJ_OVER = R({ hx: 3, hy: -26, tl: 36, hd: 10, tw: 6, aFx: 17.4, aFy: 5, aBx: 6, aBy: -2, lFx: 9, lFy: -13, lBx: -11, lBy: -9 });
const AJ_HOLD = R({ hx: 2.5, hy: -26, tl: 33, hd: 10, tw: 5, aFx: 17, aFy: 5.5, aBx: 6, aBy: -2, lFx: 9, lFy: -13, lBx: -10, lBy: -9 });
const AJ_BACK = R({ hx: 1, hy: -26, tl: 22, hd: 8, tw: 2, aFx: 13, aFy: -1, aBx: 7, aBy: -1, lFx: 8, lFy: -13, lBx: -5, lBy: -11 });

/** 공중 1타 잽 (128×96): 당김(2~3, 멈칫) → 스미어(4) → 앞 아래로 끝까지(5~6프레임 판정) → 지나치기 → 여운 → 웅크림. 12프레임 18틱 */
export const RAIDEN_AIR_JAB: MotionData = {
  name: 'raiden/air_jab',
  label: '라이덴 공중 1타 잽',
  wide: true,
  smear: { frame: 3, limb: 'aF', stretch: 1.4 },
  dur: [1, 1, 2, 1, 2, 1, 1, 3, 2, 2, 1, 1],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 1, pose: AJ_LOAD },
    { at: 2, pose: AJ_COIL, stop: true },
    { at: 3, pose: AJ_SMEAR },
    { at: 4, pose: AJ_HIT },
    { at: 5, pose: AJ_HIT2 },
    { at: 6, pose: AJ_OVER },
    { at: 7, pose: AJ_OVER, stop: true },
    { at: 8, pose: AJ_HOLD },
    { at: 9, pose: AJ_BACK },
    { at: 11, pose: A_TUCK },
  ],
};

// 공중 크로스: 앞어깨를 내밀어 뒷어깨를 감았다가 허리를 틀어 뒷손을 앞 아래로 끝까지, 앞손은 턱으로
const AS_LOAD = R({ hx: -1, hy: -26, tl: 10, hd: 8, tw: 1.5, aFx: 11, aFy: -5, aBx: 5, aBy: -3, lFx: 7, lFy: -14, lBx: -2, lBy: -12 });
const AS_COIL = R({ hx: -2, hy: -26, tl: 6, hd: 10, tw: 3, aFx: 12, aFy: -6, aBx: 3, aBy: -5, lFx: 6, lFy: -15, lBx: -3, lBy: -12 });
const AS_SMEAR = R({ hx: 1.5, hy: -26, tl: 28, hd: 10, tw: -3.5, aFx: 7, aFy: -2, aBx: 16, aBy: 3, lFx: 8, lFy: -14, lBx: -7, lBy: -10 });
const AS_HIT = R({ hx: 2.5, hy: -26, tl: 34, hd: 10, tw: -5.5, aFx: 6, aFy: -2, aBx: 16.8, aBy: 6.2, lFx: 9, lFy: -14, lBx: -10, lBy: -10 });
const AS_HIT2 = R({ hx: 3, hy: -26, tl: 35, hd: 10, tw: -6, aFx: 6, aFy: -2, aBx: 17.2, aBy: 6.4, lFx: 9, lFy: -14, lBx: -10.5, lBy: -10 });
const AS_OVER = R({ hx: 3.5, hy: -26, tl: 38, hd: 10, tw: -6.5, aFx: 6, aFy: -1.5, aBx: 17.4, aBy: 5, lFx: 9, lFy: -13, lBx: -11, lBy: -9 });
const AS_HOLD = R({ hx: 3, hy: -26, tl: 35, hd: 10, tw: -5.5, aFx: 6, aFy: -2, aBx: 17, aBy: 5.5, lFx: 9, lFy: -13, lBx: -10, lBy: -9 });
const AS_BACK = R({ hx: 1, hy: -26, tl: 22, hd: 8, tw: -2, aFx: 10, aFy: -3, aBx: 10, aBy: -1, lFx: 8, lFy: -13, lBx: -5, lBy: -11 });

/** 공중 2타 크로스 (128×96): 감기(2~3, 멈칫) → 스미어(4) → 뒷손을 앞 아래로 끝까지(5~6프레임 판정) → 지나치기 → 여운 → 웅크림. 12프레임 18틱 */
export const RAIDEN_AIR_CROSS: MotionData = {
  name: 'raiden/air_cross',
  label: '라이덴 공중 2타 크로스',
  wide: true,
  smear: { frame: 3, limb: 'aB', stretch: 1.4 },
  dur: [1, 1, 2, 1, 2, 1, 1, 3, 2, 2, 1, 1],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 1, pose: AS_LOAD },
    { at: 2, pose: AS_COIL, stop: true },
    { at: 3, pose: AS_SMEAR },
    { at: 4, pose: AS_HIT },
    { at: 5, pose: AS_HIT2 },
    { at: 6, pose: AS_OVER },
    { at: 7, pose: AS_OVER, stop: true },
    { at: 8, pose: AS_HOLD },
    { at: 9, pose: AS_BACK },
    { at: 11, pose: A_TUCK },
  ],
};

// 공중 돌려차기 (지침서 7장 '3은 원'): 곧게 편 뒷다리가 엉덩이를 중심으로 뒤 아래 → 뒤 위 → 머리 위 → 앞 → 앞 아래로 한 바퀴 원을 그린다.
// 다리 끝 목표는 엉덩이에서 23.8px (다리 길이 24) 원 위의 점 (각도: 0 앞, 90 아래, 180 뒤, 270 위)이라 무릎이 펴진 채 돈다
/** 몸을 틀어 곧게 편 뒷다리를 뒤 아래로 (150°) */
const AR_TURN = R({ hx: -1, hy: -27, tl: 26, hd: 6, aFx: 10, aFy: 2, aBx: 4, aBy: 6, lFx: 6, lFy: -15, lBx: -21.6, lBy: -14.1 });
/** 감기 끝 (멈칫): 뒷다리를 뒤 위로 높이 감아 올린다 (225°, 몸은 앞으로 숙여 반동) */
const AR_WIND = R({ hx: -2, hy: -27, tl: 34, hd: 2, aFx: 10, aFy: 3, aBx: 3, aBy: 7, lFx: 6, lFy: -15, lBx: -18.8, lBy: -42.8 });
/** 스미어: 다리가 머리 위를 지나 앞으로 휘돈다 (290°, 그림은 뒷다리 1.35배), 몸은 뒤로 젖혀지기 시작 */
const AR_SMEAR = R({ hx: 1, hy: -27, tl: -12, hd: 14, aFx: 9, aFy: -10, aBx: -8, aBy: 4, lFx: 5, lFy: -15, lBx: 12.9, lBy: -46.6 });
/** 타격: 몸을 뒤로 젖히며 뒷다리를 앞으로 끝까지 (335°, 가슴 높이), 두 손은 반동으로 벌린다 */
const AR_HIT = R({ hx: 2, hy: -27, tl: -14, hd: 18, aFx: 9, aFy: -11, aBx: -12, aBy: 2, lFx: 3, lFy: -14, lBx: 23.6, lBy: -36.1 });
const AR_HIT2 = R({ hx: 2.5, hy: -27, tl: -16, hd: 19, aFx: 9, aFy: -11, aBx: -12, aBy: 3, lFx: 3, lFy: -14, lBx: 25.5, lBy: -32.2 });
/** 지나치기: 다리가 원을 이어 앞 아래로 내려간다 (20°) */
const AR_OVER = R({ hx: 2.5, hy: -27, tl: -12, hd: 18, aFx: 9, aFy: -11, aBx: -11, aBy: 5, lFx: 3, lFy: -14, lBx: 24.9, lBy: -17.9 });
const AR_HOLD = R({ hx: 2, hy: -27, tl: -8, hd: 16, aFx: 9, aFy: -10, aBx: -9, aBy: 6, lFx: 4, lFy: -14, lBx: 25, lBy: -19.8 });
/** 다리를 거둬 웅크림으로 */
const AR_BACK = R({ hx: 1, hy: -26, tl: 8, hd: 10, aFx: 10, aFy: -6, aBx: 4, aBy: 2, lFx: 6, lFy: -13, lBx: 4, lBy: -10 });

/** 공중 3타 돌려차기 (128×96): 몸 틀기(2) → 뒷다리 감아 올림(3, 멈칫) → 스미어(4) → 원을 그려 앞으로 끝까지(5~7프레임 판정) → 여운 → 웅크림. 13프레임 25틱 */
export const RAIDEN_AIR_ROUNDHOUSE: MotionData = {
  name: 'raiden/air_roundhouse',
  label: '라이덴 공중 3타 돌려차기',
  wide: true,
  smear: { frame: 3, limb: 'lB', stretch: 1.35 },
  dur: [1, 1, 2, 1, 2, 1, 2, 4, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 1, pose: AR_TURN },
    { at: 2, pose: AR_WIND, stop: true },
    { at: 3, pose: AR_SMEAR },
    { at: 4, pose: AR_HIT },
    { at: 5, pose: AR_HIT2 },
    { at: 6, pose: AR_OVER },
    { at: 7, pose: AR_OVER, stop: true },
    { at: 8, pose: AR_HOLD },
    { at: 9, pose: AR_BACK },
    { at: 12, pose: A_TUCK },
  ],
};

// 내려찍기 도끼차기 (지침서 7장: 위에서 아래 반원 + 바닥 방전): 앞다리를 곧게 머리 위로 들어 올렸다가 앞으로 내리꽂는다
/** 앞다리를 곧게 들어 올리기 시작 (두 팔은 벌려 균형) */
const AX_LIFT = R({ hx: -1, hy: -27, tl: -4, hd: 10, aFx: 10, aFy: 2, aBx: -9, aBy: 4, lFx: 9, lFy: -42, lBx: -4, lBy: -13 });
/** 감기 끝 (멈칫): 앞다리가 머리 위로 곧게 서고 몸은 뒤로 젖힌다 (두 팔은 아래로 벌려 다리가 머리와 겹쳐 보이지 않게) */
const AX_TOP = R({ hx: -2, hy: -27, tl: -20, hd: 18, aFx: 11, aFy: 1, aBx: -10, aBy: 3, lFx: 10, lFy: -46.8, lBx: -6, lBy: -14 });
/** 스미어: 다리가 앞으로 내리꽂힌다 (그림은 앞다리 1.35배), 몸은 앞으로 접히기 시작 */
const AX_SMEAR = R({ hx: 0, hy: -27, tl: 8, hd: 10, aFx: 9, aFy: -8, aBx: -6, aBy: 4, lFx: 20, lFy: -40, lBx: -8, lBy: -14 });
/** 타격: 몸을 앞으로 접으며 앞다리를 앞 아래로 끝까지 내리찍는다, 뒷다리는 뒤로 */
const AX_HIT = R({ hx: 2, hy: -27, tl: 26, hd: 8, aFx: 10, aFy: -4, aBx: -6, aBy: 6, lFx: 23, lFy: -14, lBx: -10, lBy: -14 });
const AX_HIT2 = R({ hx: 2.5, hy: -27, tl: 28, hd: 8, aFx: 10, aFy: -3, aBx: -6, aBy: 7, lFx: 22, lFy: -10, lBx: -10, lBy: -14 });
/** 지나치기: 다리가 몸 밑으로 더 내려간다 */
const AX_OVER = R({ hx: 3, hy: -26, tl: 32, hd: 8, aFx: 10, aFy: -2, aBx: -5, aBy: 8, lFx: 19, lFy: -6, lBx: -10, lBy: -12 });
const AX_HOLD = R({ hx: 3, hy: -26, tl: 30, hd: 8, aFx: 10, aFy: -3, aBx: -5, aBy: 7, lFx: 19, lFy: -7, lBx: -10, lBy: -12 });

/** 내려찍기 도끼차기 (128×96): 다리 들기(2) → 머리 위로 곧게(3, 멈칫) → 스미어(4) → 앞 아래로 내리찍기(5~7프레임 판정) → 여운 → 낙하 자세. 13프레임 25틱 */
export const RAIDEN_AXE_KICK: MotionData = {
  name: 'raiden/axe_kick',
  label: '라이덴 내려찍기 도끼차기',
  wide: true,
  smear: { frame: 3, limb: 'lF', stretch: 1.35 },
  dur: [1, 2, 2, 1, 2, 1, 2, 4, 3, 2, 2, 2, 1],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 1, pose: AX_LIFT },
    { at: 2, pose: AX_TOP, stop: true },
    { at: 3, pose: AX_SMEAR },
    { at: 4, pose: AX_HIT },
    { at: 5, pose: AX_HIT2 },
    { at: 6, pose: AX_OVER },
    { at: 7, pose: AX_OVER, stop: true },
    { at: 8, pose: AX_HOLD },
    { at: 12, pose: A_OPEN },
  ],
};

// ---- 차지: 투전승불 (공격을 길게 눌렀다 떼기. "울려라." 생체 전류를 증폭해 적빛 전격 갑옷이 드러난다) ----
// 128×96. 떼면 앞발로 깊이 디디며 뒷주먹을 끝까지 (지침서 2장 기준값: 발 간격 36, 엉덩이 6 낮게, 몸통 36°, 뒷어깨 6px 앞, 한 줄)
/** 두 주먹을 허리로 끌어당기며 다리를 넓게 벌리고 낮게 버틴다 (고개를 숙여 힘을 모은다) */
const CH_PULL = R({ hx: -1, hy: -15, tl: 8, hd: 16, aFx: -2, aFy: 13, aBx: -4, aBy: 13, lFx: 11, lBx: -12 });
/** 모으는 동안 1: 가슴을 펴고 주먹을 쥔 채 고개를 들어 상대를 본다 (온몸에 힘이 들어가 떨림) */
const CH_HOLD_A = R({ hx: -1, hy: -15, tl: 2, hd: 4, aFx: -1, aFy: 12, aBx: -3, aBy: 12, lFx: 11, lBx: -12 });
/** 모으는 동안 2: 어깨가 한 번 들썩인다 */
const CH_HOLD_B = R({ hx: -1, hy: -15.5, tl: 4, hd: 6, aFx: -1.5, aFy: 11, aBx: -3.5, aBy: 11, lFx: 11, lBx: -12 });
/** 떼는 순간 (스미어): 앞발로 크게 디디며 허리를 틀어 뒷주먹이 쏘아져 나간다 (그림은 뒷팔 1.45배) */
const CH_STEP = R({ hx: 3, hy: -14.5, tl: 26, hd: 8, tw: -3.5, aFx: 3, aFy: 4, aBx: 14, aBy: -6, lFx: 19, lBx: -13 });
/** 타격: 온몸을 실어 뒷주먹을 끝까지, 앞주먹은 가슴으로 당기고 뒷다리는 뒤로 길게 (가장 멀리) */
const CH_HIT = R({ hx: 5.5, hy: -13, tl: 36, hd: 10, tw: -6, aFx: 3, aFy: 4, aBx: 16, aBy: -8.2, lFx: 22, lBx: -15, lBy: -1 });
const CH_HOLD_HIT = R({ hx: 6, hy: -13, tl: 37, hd: 10, tw: -6.5, aFx: 3, aFy: 4, aBx: 16.4, aBy: -8.2, lFx: 22, lBx: -15.5, lBy: -1 });
/** 거두며 가드로 */
const CH_BACK = R({ hx: 2, hy: -17, tl: 20, hd: 8, tw: -1.5, aFx: 11, aFy: -3, aBx: 9.5, aBy: -1, lFx: 13, lBx: -10 });

/**
 * 차지 투전승불 (128×96): 1~4프레임 두 주먹을 허리로 끌어당겨 버팀(한 번) → 5~8프레임 모으는 동안 되풀이(떨림) →
 * 떼면 9프레임(스미어)부터 앞발로 깊이 디디며 뒷주먹을 끝까지(10~11프레임 판정) → 여운 → 가드. 14프레임 (기본 차지와 같은 구조)
 */
export const RAIDEN_CHARGE: MotionData = {
  name: 'raiden/charge',
  label: '라이덴 차지 투전승불',
  wide: true,
  smear: { frame: 8, limb: 'aB', stretch: 1.45 },
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 1, 2, 2, 5, 3, 3],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: CH_PULL },
    { at: 4, pose: CH_HOLD_A },
    { at: 6, pose: CH_HOLD_B },
    { at: 7, pose: CH_HOLD_A },
    { at: 8, pose: CH_STEP },
    { at: 9, pose: CH_HIT },
    { at: 10, pose: CH_HOLD_HIT },
    { at: 11, pose: CH_HOLD_HIT, stop: true },
    { at: 12, pose: CH_BACK },
    { at: 13, pose: R_STANCE },
  ],
};

export const RAIDEN_ATTACK_MOTIONS: readonly MotionData[] = [
  RAIDEN_CHARGE,

  RAIDEN_JAB, RAIDEN_CROSS, RAIDEN_MIDDLE_KICK, RAIDEN_SUPERMAN_PUNCH, RAIDEN_UPPERCUT, RAIDEN_LEG_SWEEP, RAIDEN_FLYING_KNEE,
  RAIDEN_AIR_JAB, RAIDEN_AIR_CROSS, RAIDEN_AIR_ROUNDHOUSE, RAIDEN_AXE_KICK,
];
