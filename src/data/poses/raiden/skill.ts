import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { STANCE } from '../stance';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 스킬·필살기 (캐릭터 기획서 '버튼', '필살기 연출'). 모두 128×96 칸 (동작연출지침서 1장).
 * 기본자세에서 시작해 기본자세로 끝난다. 수치는 data/characters/raiden.ts의 moves.
 */

// ---- 스킬 1: 잔흔 (붉은 잔상을 남기며 앞으로 순간이동해 들어가, 나타나자마자 머리 높이로 하이킥) ----
/** 몸을 낮게 숙여 웅크린다: 이 자세가 떠난 자리에 붉은 잔상으로 남는다 */
const ZH_PREP = R({ hx: 1, hy: -14.5, tl: 32, hd: 6, aFx: 11, aFy: -1, aBx: 6, aBy: 3, lFx: 12, lBx: -12 });
/** 나타남: 상대 앞에 낮게 웅크린 채 나타난다 (뒷다리에 힘을 싣는다) */
const ZH_ARRIVE = R({ hx: 2.5, hy: -14, tl: 26, hd: 2, aFx: 12, aFy: -3, aBx: 7, aBy: 2, lFx: 9, lBx: -13 });
/** 감기 (멈칫): 솟으며 뒷무릎을 가슴 앞으로 높이 끌어올린다 (앞발 하나로 버팀) */
const ZH_CHAMBER = R({ hx: 2, hy: -21, tl: -4, hd: 10, aFx: 10, aFy: -8, aBx: 0, aBy: 6, lFx: 3, lBx: 5.5, lBy: -17 });
/** 스미어: 정강이가 채찍처럼 머리 높이로 펴진다 (그림은 뒷다리 1.35배) */
const ZH_SMEAR = R({ hx: 3, hy: -22, tl: -14, hd: 16, aFx: 9, aFy: -10, aBx: -9, aBy: 5, lFx: 1, lBx: 16, lBy: -34 });
/** 타격: 뒷다리를 머리 높이로 끝까지 휘둘러 찬다: 몸을 뒤로 크게 젖히고 앞손은 얼굴, 뒷손은 뒤로 뻗어 균형 */
const ZH_KICK = R({ hx: 3.5, hy: -22.5, tl: -20, hd: 20, aFx: 9, aFy: -10, aBx: -12, aBy: 3, lFx: -1, lBx: 21, lBy: -39 });
const ZH_KICK2 = R({ hx: 4, hy: -22.5, tl: -21, hd: 21, aFx: 9, aFy: -10, aBx: -12.5, aBy: 2, lFx: -1, lBx: 22, lBy: -40 });
/** 지나치기: 찬 다리가 한 박 더 위로 휘어 지나간다 */
const ZH_OVER = R({ hx: 3.5, hy: -22.5, tl: -24, hd: 22, aFx: 9, aFy: -10, aBx: -12, aBy: 0, lFx: -1, lBx: 18, lBy: -43 });
const ZH_HOLD = R({ hx: 3.5, hy: -22, tl: -21, hd: 21, aFx: 9, aFy: -10, aBx: -11, aBy: 2, lFx: -1, lBx: 19.5, lBy: -40 });
/** 다리를 접어 거둔다 */
const ZH_RETRACT = R({ hx: 2.5, hy: -20.5, tl: -6, hd: 12, aFx: 10, aFy: -8, aBx: -3, aBy: 5, lFx: 0, lBx: 7, lBy: -14 });
/** 뒤로 내려 딛는다 */
const ZH_STEPDOWN = R({ hx: 1, hy: -19, tl: 8, hd: 9, aFx: 11, aFy: -6, aBx: 5, aBy: 1, lFx: 4, lBx: -9, lBy: -2 });

/**
 * 스킬 1 잔흔 (128×96): 낮게 웅크렸다(2프레임) 사라져 3프레임이 시작하는 틱에 앞으로 순간이동해 웅크린 채 나타나고(3)
 * 뒷무릎을 끌어올렸다가(4, 멈칫) 스미어(5) → 머리 높이로 크게 휘둘러 찬다(6~7프레임 판정) → 지나치기 → 여운 → 내려 딛기. 13프레임 26틱
 */
export const RAIDEN_ZANHEN: MotionData = {
  name: 'raiden/zanhen',
  label: '라이덴 스킬 1 잔흔',
  wide: true,
  smear: { frame: 4, limb: 'lB', stretch: 1.35 },
  dur: [1, 2, 2, 2, 1, 2, 1, 2, 4, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: ZH_PREP, stop: true },
    { at: 2, pose: ZH_ARRIVE, stop: true },
    { at: 3, pose: ZH_CHAMBER, stop: true },
    { at: 4, pose: ZH_SMEAR },
    { at: 5, pose: ZH_KICK },
    { at: 6, pose: ZH_KICK2 },
    { at: 7, pose: ZH_OVER },
    { at: 8, pose: ZH_HOLD, stop: true },
    { at: 9, pose: ZH_RETRACT },
    { at: 10, pose: ZH_STEPDOWN },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 스킬 2: 화과산 (숨을 내쉬며 몸 주변으로 스파크를 터뜨려 붙은 상대를 크게 밀어낸다) ----
// 2차 리워크: 판정 7~11틱(공격 데이터)과 0~6틱 들숨·7~10틱 날숨 박자(사용자 피드백 2026-11-02 9-3)는 그대로, 그림만 다시 깎았다.
/** 들숨 1: 숨을 들이켜며 어깨가 올라가고 두 팔이 가슴 앞으로 모인다 */
const HG_INHALE_A = R({ hx: -1, hy: -19.5, tl: 6, hd: 2, aFx: 6, aFy: 1, aBx: 8, aBy: 1, lFx: 9.5, lBx: -10 });
/** 들숨 2: 팔꿈치를 들고 웅크리기 시작한다 */
const HG_INHALE_B = R({ hx: -1.5, hy: -18, tl: 9, hd: 6, aFx: 4, aFy: 4, aBx: 7, aBy: 3, lFx: 10.5, lBx: -11.5 });
/** 모음 (멈칫): 엉덩이를 빼며 웅크려 고개를 숙이고 두 팔을 가슴에 단단히 붙인다 (전류를 몸 안에 가둔다) */
const HG_GATHER = R({ hx: -2.5, hy: -15, tl: 15, hd: 15, aFx: 2, aFy: 8, aBx: 6, aBy: 7, lFx: 11, lBx: -12 });
/** 터짐 (1틱): 가슴을 펴며 두 팔을 앞뒤로 활짝 내던진다 (날숨) */
const HG_BURST = R({ hx: -1, hy: -20, tl: -6, hd: -10, aFx: 16, aFy: -6, aBx: -14, aBy: -6, lFx: 12, lBx: -13 });
/** 판정: 고개를 젖히며 숨을 내뿜고 두 팔을 끝까지 벌린다. 다리는 넓게 버틴다 */
const HG_HIT = R({ hx: -1, hy: -21, tl: -10, hd: -16, aFx: 17, aFy: -3, aBx: -16.5, aBy: -3, lFx: 13, lBx: -14 });
/** 지나치기: 터진 힘에 몸이 발끝으로 들리고 두 팔이 더 벌어지며 아래로 휘어 나간다 */
const HG_OVER = R({ hx: -1, hy: -22.5, tl: -13, hd: -19, aFx: 17.5, aFy: 1.5, aBx: -17, aBy: 1.5, lFx: 13, lBx: -14 });
/** 되돌아옴 (멈칫): 발뒤꿈치가 내려앉으며 팔이 2~3px 돌아온다 */
const HG_REBOUND = R({ hx: -1, hy: -21, tl: -11, hd: -16, aFx: 16.5, aFy: -2, aBx: -16, aBy: -2, lFx: 13, lBx: -14 });
/** 여운 1: 숨이 끝나며 고개가 돌아오고 팔이 처지기 시작 */
const HG_EXHALE = R({ hx: -1, hy: -20.5, tl: -6, hd: -8, aFx: 15.5, aFy: 3, aBx: -15, aBy: 3, lFx: 13, lBx: -14 });
/** 여운 2: 두 팔이 늘어진다 (스파크가 흩어지는 동안) */
const HG_SAG = R({ hx: -1, hy: -20, tl: -2, hd: -2, aFx: 13, aFy: 7, aBx: -11, aBy: 7, lFx: 13, lBx: -14 });
/** 회복 첫 프레임: 무게가 뒤로 빠지며 두 손이 곧장 얼굴 앞 가드로 */
const HG_BACK = R({ hx: -2, hy: -18, tl: 8, hd: 6, aFx: 11, aFy: -3, aBx: 6, aBy: 1, lFx: 11, lBx: -11 });
const HG_GUARD = R({ hx: -1, hy: -18.5, tl: 13, hd: 8, aFx: 12.5, aFy: -4, aBx: 7.5, aBy: 0, lFx: 9, lBx: -10 });

/**
 * 스킬 2 화과산 (128×96): 들숨 두 장(2~3, 어깨가 올라가며 웅크림) → 모음(4, 멈칫) → 터짐(5, 1틱) → 두 팔을 벌려 내뿜기(6~8프레임 판정,
 * 7 지나치기, 8 되돌아옴) → 여운 두 장 → 가드 (처음 빠르고 끝으로 느리게). 13프레임 27틱.
 * 0~6틱 들숨, 7~10틱 날숨 판정 (사용자 피드백 2026-11-02 9-3)
 */
export const RAIDEN_HWAGWASAN: MotionData = {
  name: 'raiden/hwagwasan',
  label: '라이덴 스킬 2 화과산',
  wide: true,
  dur: [1, 2, 1, 2, 1, 2, 1, 3, 3, 3, 2, 3, 3],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: HG_INHALE_A },
    { at: 2, pose: HG_INHALE_B },
    { at: 3, pose: HG_GATHER, stop: true },
    { at: 4, pose: HG_BURST },
    { at: 5, pose: HG_HIT },
    { at: 6, pose: HG_OVER },
    { at: 7, pose: HG_REBOUND, stop: true },
    { at: 8, pose: HG_EXHALE },
    { at: 9, pose: HG_SAG },
    { at: 10, pose: HG_BACK },
    { at: 11, pose: HG_GUARD },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 필살기: 파천 (검붉은 전격을 두른 붕권. 맞으면 상대 몸통에 주먹을 댄 채 멈추고, 몸 안에서 터진 전격이 등 뒤로 뚫고 나간다) ----
// 2차 리워크: 판정 12~18틱·몸 이동(공격 데이터)과 진각 바닥 금(4번 프레임이 시작하는 7틱, 그 프레임 앞발 자리)은 그대로.
// 진각 뒤에 골반·뒷어깨가 먼저 돌고(5), 주먹은 허리에서 낮게 나와 가슴 높이로 솟는 호를 그리며(6 스미어), 한 번 더 밀고 들어갔다 돌아온다
/** 가라앉으며 뒷주먹을 허리로 당기고 (세운 주먹), 앞손을 펴 앞으로 겨눈다 */
const PC_SINK = R({ hx: -1, hy: -16, tl: 12, hd: 8, tw: 2, aFx: 13, aFy: -3, aBx: -3, aBy: 11, lFx: 11, lBx: -11 });
/** 감기 끝 (멈칫): 낮게 버텨 앉고 (마보) 엉덩이를 뒷발 쪽으로 4px 빼며 몸통을 틀어, 뒷어깨가 엉덩이보다 4~5px 뒤 (2장 ①②). 뒷주먹은 허리, 앞손은 상대를 겨눈다.
 * 앞발은 진각하려고 살짝 든다. 몸에 검붉은 전격이 감긴다 */
const PC_LOAD = R({ hx: -4.5, hy: -13, tl: 2, hd: 12, tw: 9, aFx: 14, aFy: -2, aBx: -4, aBy: 12, lFx: 12, lFy: -4, lBx: -13 });
/** 진각: 든 앞발을 내리찍으며 무게를 앞으로 옮긴다 (이 프레임이 시작하는 틱에 앞발 자리 바닥 금) */
const PC_STOMP = R({ hx: 1, hy: -12.5, tl: 16, hd: 8, tw: 1, aFx: 12, aFy: 0, aBx: -2, aBy: 11, lFx: 16, lFy: -2, lBx: -12 });
/** 골반이 먼저: 허리와 뒷어깨가 앞으로 돌고, 주먹은 아직 허리 높이에서 낮게 따라 나온다 (재수정 지침 2장 '어깨가 먼저') */
const PC_TURN = R({ hx: 3, hy: -12.5, tl: 20, hd: 8, tw: -3, aFx: 8, aFy: 1, aBx: 2, aBy: 9, lFx: 17, lBx: -12 });
/** 스미어: 주먹이 허리에서 가슴 높이로 솟으며 쏘아져 나간다 (그림은 뒷팔 1.45배), 앞손은 가슴으로 거둔다 */
const PC_SMEAR = R({ hx: 4, hy: -13, tl: 26, hd: 7, tw: -5, aFx: 4, aFy: 3, aBx: 13, aBy: -2, lFx: 18.5, lBx: -12.5 });
/** 타격: 짧고 곧은 세운 주먹 (붕권). 뒷어깨가 앞장서고, 앞발은 진각으로 디딘 채, 뒷발은 뒤로 버틴다 */
const PC_HIT = R({ hx: 5, hy: -13, tl: 32, hd: 6, tw: -6, aFx: 2, aFy: 4, aBx: 15.8, aBy: -8.2, lFx: 20, lBx: -14 });
/** 지나치기: 엉덩이·뒷어깨째 한 번 더 밀어 넣어 주먹이 솟던 길을 따라 4~5px 더 나간다 */
const PC_OVER = R({ hx: 7, hy: -12.5, tl: 37, hd: 6, tw: -7.5, aFx: 2, aFy: 4, aBx: 16, aBy: -10, lFx: 20, lBx: -15.5 });
/** 되돌아옴 (멈칫): 2~3px 돌아와 주먹을 댄 자리에 굳힌다 */
const PC_REBOUND = R({ hx: 5.5, hy: -13, tl: 33, hd: 6, tw: -6, aFx: 2, aFy: 4, aBx: 16, aBy: -7.8, lFx: 20, lBx: -14.5 });
/** 잔심: 뻗은 채 고개를 들어 상대를 본다 (빗나가면 여기가 큰 빈틈) */
const PC_ZANSHIN = R({ hx: 5, hy: -13.5, tl: 30, hd: 3, tw: -5.5, aFx: 3, aFy: 2, aBx: 15.5, aBy: -6.5, lFx: 20, lBx: -14 });
/** 회복 첫 프레임: 무게가 뒤로 빠지며 두 손이 곧장 얼굴 앞 가드로, 앞발을 들어 물러 디딘다 */
const PC_BACK = R({ hx: 2, hy: -16.5, tl: 18, hd: 8, tw: -1.5, aFx: 10, aFy: -3, aBx: 9.5, aBy: -1, lFx: 15, lFy: -2, lBx: -10 });
const PC_GUARD = R({ hx: 0.5, hy: -18, tl: 15, hd: 8, aFx: 12, aFy: -4, aBx: 8.5, aBy: 0, lFx: 10, lBx: -9.5 });

/**
 * 필살기 파천 (128×96): 가라앉기(2) → 마보로 버티며 감기(3, 멈칫, 앞발을 든다) → 진각(4, 7틱 바닥 금) → 골반·어깨 먼저(5) → 스미어(6, 1틱)
 * → 붕권(7~9프레임 판정, 8 지나치기, 9 되돌아옴) → 잔심(10) → 가드 (처음 빠르고 끝으로 느리게).
 * 맞으면 연출(파천 장면 다섯)로, 빗나가면 풍압이 앞으로 날아가고 큰 빈틈. 13프레임 35틱
 */
export const RAIDEN_PACHEON: MotionData = {
  name: 'raiden/pacheon',
  label: '라이덴 필살기 파천',
  wide: true,
  smear: { frame: 5, limb: 'aB', stretch: 1.45 },
  // 판정 프레임(7번)이 12틱째: 컷인 정지 20틱 뒤 20~32틱 동안 굳게 디디고 주먹을 상대 가슴에 댄다 (사용자 피드백 2026-11-02 9-4)
  // 앞 네 프레임의 표시 틱(2·2·3)은 진각 바닥 금(render/fightvfx: 4번 프레임 시작 틱 = 7틱)과 맞물려 있어 그대로 둔다
  dur: [2, 2, 3, 3, 1, 1, 2, 2, 3, 6, 3, 4, 3],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: PC_SINK },
    { at: 2, pose: PC_LOAD, stop: true },
    { at: 3, pose: PC_STOMP },
    { at: 4, pose: PC_TURN },
    { at: 5, pose: PC_SMEAR },
    { at: 6, pose: PC_HIT },
    { at: 7, pose: PC_OVER },
    { at: 8, pose: PC_REBOUND, stop: true },
    { at: 9, pose: PC_ZANSHIN },
    { at: 10, pose: PC_BACK },
    { at: 11, pose: PC_GUARD },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 파천 연출 (캐릭터 기획서 '필살기 연출'): 장면 하나 = 라이덴 동작 + 상대 반응 동작 (표시 틱 합이 같다) ----
// 상대 반응은 누가 맞든 같은 동작이다 (공통 기준 자세 STANCE에서 바뀐 만큼, 그리는 겉모습은 맞은 사람 것)
const S = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o });

// 사용자 피드백 2026-11-02 (9-4) 파천 150틱: 0~20 컷인 정지 · 20~32 디딤과 붕권 · 장면 1 32~56 정적 · 장면 2 56~80 몸 안으로 ·
// 장면 3 80~96 등 뒤로 · 장면 4 96~130 잿더미 · 장면 5 130~150 잔심 (장면 길이 24·24·16·34·20틱)
// 2차 리워크: 장면 길이(공격 데이터 scenes 24·24·16·34·20틱)와 렌더 이펙트 틱(장면 2 번쩍임 6·16틱, 장면 3 터짐 2틱)은 그대로.
// 같은 자세를 복사해 늘어놓던 프레임을 없애고, 움직이지 않는 장면은 한 장을 dur로 길게, 움직이는 장면은 이펙트 틱에 맞춰 고르지 않은 박자로.
// 장면 1 (정적 24틱): 주먹을 가슴에 댄 채 굳는다 (떨림 없이. 상대 몸 가운데는 40px 앞: 팔 길이, 실루엣이 겹치지 않는다)
const PP_A = R({ hx: 5, hy: -13, tl: 32, hd: 6, tw: -6, aFx: 2, aFy: 4, aBx: 15.8, aBy: -8.2, lFx: 20, lBx: -14 });
/** 파천 장면 1: 라이덴 — 주먹을 댄 채 멈춤 (1프레임 24틱: 움직이지 않는 장면이라 한 장) */
export const RAIDEN_PACHEON_PRESS: MotionData = {
  name: 'raiden/pacheon_press',
  label: '라이덴 파천 연출 1 (붕권을 대고 정적)',
  wide: true,
  dur: [24],
  keys: [
    { at: 0, pose: PP_A, stop: true },
    { at: 1, pose: PP_A },
  ],
};
/** 상대 반응 1: 주먹이 닿은 가슴을 중심으로 몸이 굳는다 */
const RX1_A = S({ hx: -1, hy: -19, tl: 24, hd: 10, aFx: 5, aFy: 7, aBx: 3, aBy: 9, lFx: 8, lBx: -10 });
const RX1_B = S({ hx: -1.5, hy: -18.5, tl: 18, hd: -14, aFx: 10, aFy: -4, aBx: -5, aBy: 2, lFx: 8, lBx: -10 });
const RX1_C = S({ hx: -1, hy: -19, tl: 22, hd: 4, aFx: 4, aFy: 10, aBx: 6, aBy: 6, lFx: 9, lBx: -9 });
/** 파천 장면 1: 상대 반응 — 굳음 (1프레임 24틱) */
export const RAIDEN_PACHEON_REACT1: MotionData = {
  name: 'raiden/pacheon_react1',
  label: '파천 상대 반응 1 (굳음)',
  wide: true,
  dur: [24],
  keys: [
    { at: 0, pose: RX1_A, stop: true },
    { at: 1, pose: RX1_A },
  ],
};

// 장면 2 (몸 안으로 24틱): 주먹을 댄 채 전격을 밀어 넣는다 (번쩍임 6·16틱마다 어깨가 한 단씩 앞으로). 상대는 몸 안을 도는 전격에 경련한다
/** 밀어 넣기 1단·2단: 뒷어깨와 엉덩이가 1.5px씩 더 들어가고 고개를 숙인다 */
const PS_PUSH1 = R({ hx: 5.8, hy: -12.8, tl: 33.5, hd: 8, tw: -6.8, aFx: 2, aFy: 4, aBx: 16, aBy: -8, lFx: 20, lBx: -14.5 });
const PS_PUSH2 = R({ hx: 6.5, hy: -12.5, tl: 35, hd: 10, tw: -7.5, aFx: 2, aFy: 4.5, aBx: 16.2, aBy: -7.8, lFx: 20.5, lBx: -15 });
/** 파천 장면 2: 라이덴 — 밀어 넣기 (3프레임 24틱: 번쩍임 6·16틱에 한 단씩) */
export const RAIDEN_PACHEON_SURGE: MotionData = {
  name: 'raiden/pacheon_surge',
  label: '라이덴 파천 연출 2 (몸 안으로)',
  wide: true,
  dur: [6, 10, 8],
  keys: [
    { at: 0, pose: PP_A },
    { at: 1, pose: PS_PUSH1 },
    { at: 2, pose: PS_PUSH2 },
  ],
};
/** 경련 사이: 움츠러든 몸이 한 번 더 떤다 */
const RX1_D = S({ hx: -1.5, hy: -18.5, tl: 26, hd: 12, aFx: 4, aFy: 8.5, aBx: 2, aBy: 10.5, lFx: 8, lBx: -10.5 });
/** 파천 장면 2: 상대 반응 — 경련 (10프레임 24틱, 번쩍임 6·16틱에 크게 젖혀진다. 렌더는 이 동안 상대를 어둡게 비친다) */
export const RAIDEN_PACHEON_REACT2: MotionData = {
  name: 'raiden/pacheon_react2',
  label: '파천 상대 반응 2 (몸 안의 전격에 경련)',
  wide: true,
  dur: [3, 2, 1, 3, 2, 2, 3, 2, 2, 4],
  keys: [
    { at: 0, pose: RX1_A },
    { at: 1, pose: RX1_C },
    { at: 2, pose: RX1_D },
    { at: 3, pose: RX1_B, stop: true },
    { at: 4, pose: RX1_C },
    { at: 5, pose: RX1_A },
    { at: 6, pose: RX1_D },
    { at: 7, pose: RX1_B, stop: true },
    { at: 8, pose: RX1_C },
    { at: 9, pose: RX1_A },
  ],
};

// 장면 3 (등 뒤로 16틱): 라이덴이 허리를 틀어 한 번 더 밀어 넣고, 상대 몸 안의 전격이 등 뒤로 뚫고 나가며 상대는 활처럼 젖혀진다
/** 감기: 허리를 1틱 살짝 빼며 뒷어깨를 뒤로 (주먹은 댄 채) */
const PB_COIL = R({ hx: 5.5, hy: -12.5, tl: 34, hd: 9, tw: -4.5, aFx: 2, aFy: 4, aBx: 16.4, aBy: -8.2, lFx: 20.5, lBx: -14.5 });
const PB_DRIVE = R({ hx: 6.5, hy: -12.5, tl: 36, hd: 6, tw: -7, aFx: 2, aFy: 4, aBx: 16.6, aBy: -7.6, lFx: 21, lBx: -15 });
/** 틀어 넣은 뒤 굳힘 (지나쳤던 어깨가 조금 돌아온다): 장면 4·5가 이 자세에서 이어진다 */
const PB_HOLD = R({ hx: 6.5, hy: -12.8, tl: 34, hd: 7, tw: -6, aFx: 2, aFy: 4, aBx: 16.4, aBy: -7.6, lFx: 21, lBx: -15 });
/** 파천 장면 3: 라이덴 — 허리를 틀어 밀어 넣고 굳힘 (4프레임 16틱: 감기 1틱 → 터짐 2틱에 틀어 넣음 → 굳힘) */
export const RAIDEN_PACHEON_BURST: MotionData = {
  name: 'raiden/pacheon_burst',
  label: '라이덴 파천 연출 3 (밀어 넣기)',
  wide: true,
  dur: [1, 1, 3, 11],
  keys: [
    { at: 0, pose: PP_A },
    { at: 1, pose: PB_COIL },
    { at: 2, pose: PB_DRIVE, stop: true },
    { at: 3, pose: PB_HOLD },
  ],
};
/** 상대 반응 3: 등 뒤로 전격이 터져 나가며 가슴이 앞으로 튀어나오고 몸이 활처럼 뒤로 젖혀진다 */
const RX2_JOLT = S({ hx: -2, hy: -19, tl: 20, hd: 16, aFx: 6, aFy: 8, aBx: 4, aBy: 10, lFx: 8, lBx: -10 });
const RX2_ARCH = S({ hx: -5, hy: -18, tl: -36, hd: -24, aFx: 15, aFy: -10, aBx: 12, aBy: -13, lFx: 9, lBx: -13 });
const RX2_ARCH2 = S({ hx: -5.5, hy: -17.5, tl: -40, hd: -28, aFx: 16, aFy: -8, aBx: 13, aBy: -11, lFx: 9, lBx: -14 });
/** 젖혀진 채 버팀 (가장 젖혀졌다가 조금 돌아옴) */
const RX2_HANG = S({ hx: -5, hy: -18, tl: -37, hd: -25, aFx: 15.5, aFy: -9, aBx: 12.5, aBy: -12, lFx: 9, lBx: -13.5 });
/** 파천 장면 3: 상대 반응 — 활처럼 젖혀짐 (5프레임 16틱: 굳은 채 → 터짐 2틱에 가슴이 튀어나옴 → 3틱에 젖혀짐 → 가장 젖혀짐 → 버팀) */
export const RAIDEN_PACHEON_REACT3: MotionData = {
  name: 'raiden/pacheon_react3',
  label: '파천 상대 반응 3 (등 뒤로 터짐)',
  wide: true,
  dur: [2, 1, 2, 3, 8],
  keys: [
    { at: 0, pose: RX1_A },
    { at: 1, pose: RX2_JOLT },
    { at: 2, pose: RX2_ARCH },
    { at: 3, pose: RX2_ARCH2, stop: true },
    { at: 4, pose: RX2_HANG },
  ],
};

// 장면 4 (잿더미 34틱): 라이덴은 주먹을 뻗은 채 머물고 (카메라도), 상대는 화면 밖으로 날아간다
/** 숨을 내쉰다 (어깨가 내려앉고 고개가 숙는다) · 숨을 들이켠다 */
const PF_OUT = R({ hx: 6.5, hy: -12, tl: 33, hd: 10, tw: -6, aFx: 2, aFy: 4.5, aBx: 16.2, aBy: -7, lFx: 21, lBx: -15 });
const PF_IN = R({ hx: 6.5, hy: -13.3, tl: 35.5, hd: 5, tw: -6.5, aFx: 2, aFy: 3.5, aBx: 16.4, aBy: -8, lFx: 21, lBx: -15 });
/** 파천 장면 4: 라이덴 — 주먹을 뻗은 채 숨만 고른다 (3프레임 34틱: 굳힘 → 내쉼 → 들이켬) */
export const RAIDEN_PACHEON_FLY: MotionData = {
  name: 'raiden/pacheon_fly',
  label: '라이덴 파천 연출 4 (주먹을 뻗은 채)',
  wide: true,
  dur: [10, 12, 12],
  keys: [
    { at: 0, pose: PB_HOLD },
    { at: 1, pose: PF_OUT },
    { at: 2, pose: PF_IN },
  ],
};
/** 상대 반응 4: 뒤로 크게 날아간다 — 몸이 눕듯 젖혀지고 팔다리는 앞으로 끌린다 */
const RX3_LAUNCH = S({ hx: -4, hy: -21, tl: -58, hd: -16, aFx: 14, aFy: -4, aBx: 11, aBy: -8, lFx: 14, lFy: -8, lBx: 6, lBy: -6 });
const RX3_FLY = S({ hx: -2, hy: -22, tl: -80, hd: -10, aFx: 13, aFy: 4, aBx: 10, aBy: 2, lFx: 17, lFy: -14, lBx: 12, lBy: -10 });
const RX3_FLY2 = S({ hx: -2, hy: -22, tl: -84, hd: -8, aFx: 14, aFy: 6, aBx: 11, aBy: 5, lFx: 18, lFy: -12, lBx: 13, lBy: -9 });
/** 파천 장면 4: 상대 반응 — 날아감 (13프레임 34틱) */
export const RAIDEN_PACHEON_REACT4: MotionData = {
  name: 'raiden/pacheon_react4',
  label: '파천 상대 반응 4 (날아감)',
  wide: true,
  dur: [3, 3, 3, 3, 3, 2, 2, 2, 3, 3, 3, 2, 2],
  keys: [
    { at: 0, pose: RX2_ARCH2 },
    { at: 2, pose: RX3_LAUNCH },
    { at: 5, pose: RX3_FLY },
    { at: 8, pose: RX3_FLY2 },
    { at: 12, pose: RX3_FLY },
  ],
};

// 장면 5 (잔심 20틱): 라이덴은 뻗은 주먹을 거두며 숨을 고른다 (김·잔 스파크는 렌더), 상대는 멀리서 떨어진다
const PA_EXHALE = R({ hx: 4, hy: -14, tl: 22, hd: 10, tw: -4, aFx: 4, aFy: 3, aBx: 14, aBy: -5, lFx: 20, lBx: -10 });
const PA_LOWER = R({ hx: 2, hy: -17, tl: 16, hd: 9, tw: -1, aFx: 10, aFy: -2, aBx: 9, aBy: 0, lFx: 14, lBx: -10 });
/** 파천 장면 5: 라이덴 — 주먹을 거두고 잔심 (12프레임 20틱) */
export const RAIDEN_PACHEON_AFTER: MotionData = {
  name: 'raiden/pacheon_after',
  label: '라이덴 파천 연출 5 (잔심)',
  wide: true,
  dur: [2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: PB_HOLD },
    { at: 3, pose: PB_HOLD, stop: true },
    { at: 6, pose: PA_EXHALE },
    { at: 9, pose: PA_LOWER },
    { at: 11, pose: R_STANCE },
  ],
};
/** 파천 장면 5: 상대 반응 — 멀리서 떨어진다 (12프레임 20틱) */
export const RAIDEN_PACHEON_REACT5: MotionData = {
  name: 'raiden/pacheon_react5',
  label: '파천 상대 반응 5 (멀리 떨어짐)',
  wide: true,
  dur: [2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: RX3_FLY },
    { at: 6, pose: RX3_FLY2 },
    { at: 11, pose: RX3_FLY },
  ],
};

export const RAIDEN_SKILL_MOTIONS: readonly MotionData[] = [
  RAIDEN_ZANHEN, RAIDEN_HWAGWASAN, RAIDEN_PACHEON,
  RAIDEN_PACHEON_PRESS, RAIDEN_PACHEON_REACT1, RAIDEN_PACHEON_SURGE, RAIDEN_PACHEON_REACT2, RAIDEN_PACHEON_BURST, RAIDEN_PACHEON_REACT3,
  RAIDEN_PACHEON_FLY, RAIDEN_PACHEON_REACT4, RAIDEN_PACHEON_AFTER, RAIDEN_PACHEON_REACT5,
];
