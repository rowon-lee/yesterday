import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 점프·2단 점프·낙하·착지·지상 대시·공중 대시 (캐릭터 기획서 '움직임').
 * 점프는 힘있게 튀어오르고, 대시는 붉은 잔상을 남기며 낮게 파고든다. 공중에서도 가드는 얼굴 앞에 둔다.
 */

// ---- 점프 ----
/** 깊게 웅크린다 (점프 준비, sim의 점프 준비 2틱 동안 이 프레임): 엉덩이 5px 낮게, 몸을 숙이고 가드를 조인다 */
const J_CROUCH = R({ hx: -1, hy: -14, tl: 24, hd: 10, aFx: 11, aFy: -2, aBx: 7, aBy: 2, lFx: 9, lBx: -10 });
/** 폭발하듯 솟는다: 몸이 쭉 펴지고 앞무릎을 가슴으로 차올리며(니킥처럼) 뒷다리는 아래로 뻗고, 두 주먹은 높이 */
const J_BURST = R({ hx: 0, hy: -27, tl: 4, hd: 2, aFx: 10, aFy: -9, aBx: 8, aBy: -6, lFx: 9, lFy: -12, lBx: -4, lBy: 3 });
/** 솟는 동안: 뒷다리도 끌어올리기 시작한다 */
const J_RISE = R({ hx: 0, hy: -27, tl: 10, hd: 4, aFx: 11, aFy: -7, aBx: 8, aBy: -4, lFx: 8, lFy: -13, lBx: -2, lBy: -6 });
/** 꼭대기 근처: 두 무릎을 당겨 웅크리고 가드를 얼굴 앞에 */
const J_TUCK = R({ hx: 0, hy: -26, tl: 16, hd: 7, aFx: 11, aFy: -4, aBx: 8, aBy: -1, lFx: 7, lFy: -13, lBx: -1, lBy: -11 });

/** 점프: 1프레임 웅크림 → 2~3프레임 폭발하듯 솟음(앞무릎 차올림) → 무릎을 당겨 웅크림. 12프레임 × 2틱 */
export const RAIDEN_JUMP: MotionData = {
  name: 'raiden/jump',
  label: '라이덴 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_CROUCH },
    { at: 2, pose: J_BURST },
    { at: 5, pose: J_RISE },
    { at: 9, pose: J_TUCK, stop: true },
    { at: 11, pose: J_TUCK },
  ],
};

// ---- 2단 점프 ----
/** 공중에서 두 다리로 아래를 한 번 더 박찬다 (발을 쭉 내리 뻗고 몸이 솟는다), 주먹은 위로 */
const J2_STAMP = R({ hx: 0, hy: -26, tl: 2, hd: 0, aFx: 9, aFy: -10, aBx: 7, aBy: -8, lFx: 5, lFy: 3, lBx: -4, lBy: 4 });
/** 박찬 반동으로 두 무릎을 높이 당겨 공처럼 웅크린다 */
const J2_BALL = R({ hx: 0, hy: -26, tl: 22, hd: 10, aFx: 10, aFy: -3, aBx: 8, aBy: 0, lFx: 7, lFy: -16, lBx: 1, lBy: -14 });

/** 2단 점프: 웅크림 → 2~3프레임 아래를 박참 → 공처럼 웅크렸다 → 펴며 가드. 12프레임 × 2틱 */
export const RAIDEN_JUMP2: MotionData = {
  name: 'raiden/jump2',
  label: '라이덴 2단 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_TUCK },
    { at: 2, pose: J2_STAMP },
    { at: 6, pose: J2_BALL, stop: true },
    { at: 11, pose: J_TUCK },
  ],
};

// ---- 낙하 (프레임은 떨어지는 속도로 고른다: sim은 1/4px/틱마다 한 틱 = dur 합 36이 가장 빠른 낙하) ----
// 2차 리워크: 12프레임 × 3 → 5프레임. 막 떨어지기 시작할 땐 웅크린 채 조금, 빨라지면 다리가 한 번에 펴지고, 착지 준비에서 멈춘다
/** 웅크린 무릎이 조금 풀린다 */
const F_EASE = R({ hx: 0, hy: -25.5, tl: 15, hd: 7, aFx: 11, aFy: -4.5, aBx: 8, aBy: -1, lFx: 7.2, lFy: -12.3, lBx: -1.6, lBy: -10.3 });
/** 내려오며 다리를 편다 */
const F_OPEN = R({ hx: 0, hy: -25, tl: 14, hd: 7, aFx: 11, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -7, lBx: -6, lBy: -5 });
/** 발이 바닥을 찾아 내려간다 */
const F_REACH = R({ hx: 0, hy: -24.3, tl: 13.3, hd: 7, aFx: 11.7, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -2.8, lBx: -8.5, lBy: -1.8 });
/** 빨리 떨어질 때: 두 발을 앞뒤로 벌려 내리고 무릎을 살짝 굽혀 착지를 준비, 가드는 그대로 */
const F_READY = R({ hx: 0, hy: -24, tl: 13, hd: 7, aFx: 12, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -2, lBx: -9, lBy: -1 });

/** 낙하: 웅크림(꼭대기) → 무릎이 풀림 → 다리를 한 번에 폄 → 발이 바닥을 찾음 → 착지 준비(멈춤). 5프레임 (dur = 떨어지는 빠르기 구간) */
export const RAIDEN_FALL: MotionData = {
  name: 'raiden/fall',
  label: '라이덴 낙하',
  dur: [6, 6, 6, 6, 12],
  keys: [
    { at: 0, pose: J_TUCK },
    { at: 1, pose: F_EASE },
    { at: 2, pose: F_OPEN },
    { at: 3, pose: F_REACH },
    { at: 4, pose: F_READY, stop: true },
  ],
};

// ---- 착지 (sim은 착지 길이에 맞춰 프레임 수로 고르게 나눈다: dur를 보지 않는다. 보통 3틱이면 1·3·5번이 보인다) ----
// 2차 리워크: 12프레임 × 1틱 → 6프레임. 같은 길이로 나뉘므로 빠르기 차이는 자세 간격으로: 닿자마자 크게 꺾이고, 바닥에서 조금 더 눌렸다가,
// 한 번에 튀어 오르고, 꼭대기에서 천천히 기본자세로
/** 무릎이 꺾이기 시작한다 (발이 닿은 바로 다음) */
const L_HIT = R({ hx: 0, hy: -17, tl: 19, hd: 10, aFx: 11.5, aFy: -3, aBx: 7.5, aBy: 1, lFx: 9, lBx: -9 });
/** 무릎으로 받는다: 깊게 웅크리고 손이 처진다 */
const L_SQUASH = R({ hx: 0, hy: -14, tl: 24, hd: 12, aFx: 11, aFy: -1, aBx: 7, aBy: 3, lFx: 9, lBx: -9 });
/** 받은 힘으로 통 튀어 오른다 (발끝으로, 바운스로 이어짐) */
const L_BOUNCE = R({ hx: 0, hy: -21.5, tl: 13, hd: 7, aFx: 13, aFy: -5, aBx: 8, aBy: -1, lFx: 8, lFy: -1, lBx: -9, lBy: -1 });
/** 튀어 오른 끝에서 내려앉기 시작 */
const L_SETTLE = R({ hx: -0.3, hy: -20, tl: 14, hd: 7.5, aFx: 13, aFy: -4.5, aBx: 8, aBy: -0.5, lFx: 8, lFy: -0.5, lBx: -9, lBy: -0.5 });

/** 착지: 발이 닿음 → 무릎이 꺾임 → 깊게 받음(멈칫) → 통 튀어 오름 → 내려앉음 → 기본자세 (대기 바운스로 이어진다). 6프레임 */
export const RAIDEN_LAND: MotionData = {
  name: 'raiden/land',
  label: '라이덴 착지',
  // 표시 틱은 뷰어·시트용 (게임은 착지 길이를 프레임 수로 고르게 나눈다)
  dur: [2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: F_READY },
    { at: 1, pose: L_HIT },
    { at: 2, pose: L_SQUASH, stop: true },
    { at: 3, pose: L_BOUNCE },
    { at: 4, pose: L_SETTLE },
    { at: 5, pose: R_STANCE },
  ],
};

// ---- 지상 대시 (sim: 12틱, 2~7틱째 앞으로 빠르게) ----
/** 낮게 파고든다: 엉덩이를 6px 낮추고 몸을 깊이 숙이되 고개는 들어 상대를 보고, 가드는 얼굴 앞. 앞발은 멀리, 뒷다리는 뒤로 쭉 */
const D_DIVE = R({ hx: 3, hy: -13, tl: 36, hd: -10, aFx: 12, aFy: 0, aBx: 8, aBy: 3, lFx: 16, lBx: -16, lBy: 0 });
/** 미끄러지듯 나아가는 끝: 뒷발을 끌어당기며 몸을 일으킨다 */
const D_GLIDE = R({ hx: 2, hy: -15, tl: 30, hd: -6, aFx: 12, aFy: -1, aBx: 8, aBy: 2, lFx: 14, lBx: -10, lBy: -2 });
/** 다시 가드 자세로 서며 한 번 내려앉는다 */
const D_SETTLE = R({ hx: 0, hy: -17, tl: 20, hd: 6, aFx: 12, aFy: -3, aBx: 8, aBy: 1, lFx: 9, lBx: -9 });

/** 지상 대시: 기본자세 → 2~3프레임 낮게 파고듦 → 미끄러지듯 나아감 → 내려앉으며 가드. 12프레임 × 1틱 (검붉은 잔상은 렌더) */
export const RAIDEN_DASH: MotionData = {
  name: 'raiden/dash',
  label: '라이덴 지상 대시',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: D_DIVE },
    { at: 6, pose: D_DIVE, stop: true },
    { at: 8, pose: D_GLIDE },
    { at: 10, pose: D_SETTLE },
    { at: 11, pose: R_STANCE },
  ],
};

// ---- 공중 대시 (sim: 11틱, 1~8틱째 앞으로) ----
/** 공중에서 몸을 앞으로 눕혀 창처럼 날아간다: 가드는 머리 앞, 두 다리는 뒤로 모아 끈다 */
const AD_SPEAR = R({ hx: 2, hy: -24, tl: 58, hd: -24, aFx: 13, aFy: -3, aBx: 9, aBy: 1, lFx: -6, lFy: -14, lBx: -12, lBy: -10 });

/** 공중 대시: 웅크림 → 2~3프레임 몸을 눕혀 창처럼 날아감 → 몸을 세우며 낙하 준비. 12프레임 × 1틱 */
export const RAIDEN_AIR_DASH: MotionData = {
  name: 'raiden/air_dash',
  label: '라이덴 공중 대시',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: J_TUCK },
    { at: 2, pose: AD_SPEAR },
    { at: 8, pose: AD_SPEAR, stop: true },
    { at: 11, pose: F_OPEN },
  ],
};

export const RAIDEN_AIR_MOTIONS: readonly MotionData[] = [RAIDEN_JUMP, RAIDEN_JUMP2, RAIDEN_FALL, RAIDEN_LAND, RAIDEN_DASH, RAIDEN_AIR_DASH];
