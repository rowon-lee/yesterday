import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 지상 평타 (캐릭터 기획서 '평타': MMA. 잽·스트레이트·훅·로킥·니킥처럼 짧고 빠른 타격으로 몰아친다).
 * 모두 기본자세(MMA 가드)에서 시작해 기본자세로 끝난다. 판정 프레임·수치는 data/characters/raiden.ts의 moves.
 * 치지 않는 손은 늘 턱 앞에 남긴다 (가드를 푼 채 치지 않는다).
 */

// ---- 1타: 잽 (앞손 곧게) ----
/** 앞발을 크게 미끄러뜨려 들어가며 몸을 낮추고 싣는다 (앞손이 나가기 시작) */
const JAB_IN = R({ hx: 2, hy: -17.5, tl: 24, hd: 10, aFx: 14, aFy: -5, aBx: 8, aBy: -1, lFx: 14, lBx: -11 });
/** 앞손을 얼굴 높이로 끝까지 곧게: 어깨를 앞으로 던지고 몸이 앞으로 크게 실린다. 뒷손은 턱, 뒷다리는 길게 뻗어 버팀 */
const JAB_HIT = R({ hx: 4, hy: -17, tl: 32, hd: 12, aFx: 18, aFy: -6.5, aBx: 7, aBy: -2, lFx: 15, lBx: -11 });
/** 뻗은 채 멈칫 (끝까지 뻗음) */
const JAB_HOLD = R({ hx: 4, hy: -17, tl: 32, hd: 12, aFx: 18.5, aFy: -6.5, aBx: 7, aBy: -2, lFx: 15, lBx: -11 });
/** 빠르게 거두며 발을 당긴다 */
const JAB_BACK = R({ hx: 1, hy: -18.5, tl: 18, hd: 9, aFx: 12, aFy: -5, lFx: 10, lBx: -9 });

/** 1타 잽: 앞발을 크게 미끄러뜨려 들어가며(2~3프레임) 몸을 실어 앞손을 끝까지 뻗고(4~5프레임 판정) 빠르게 거둔다. 12프레임 15틱 */
export const RAIDEN_JAB: MotionData = {
  name: 'raiden/jab',
  label: '라이덴 1타 잽',
  dur: [1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: JAB_IN },
    { at: 3, pose: JAB_HIT },
    { at: 5, pose: JAB_HOLD, stop: true },
    { at: 8, pose: JAB_BACK },
    { at: 11, pose: R_STANCE },
  ],
};

// ---- 2타: 스트레이트 (뒷손 곧게, 허리를 크게 돌려) ----
/** 뒷발 뒤꿈치를 들어 돌리며 허리를 튼다: 뒷주먹을 살짝 당겨 싣고, 앞손은 턱으로 거둔다 */
const CROSS_TURN = R({ hx: 1.5, hy: -18, tl: 18, hd: 9, aFx: 9, aFy: -4, aBx: 6, aBy: -2, lFx: 12, lBx: -11, lBy: -1 });
/** 뒷손을 끝까지 곧게: 앞발로 깊이 디디며 온몸이 앞으로 쏠리고 뒷어깨가 앞으로 나온다. 뒷다리는 뒤로 길게, 앞손은 턱 앞 */
const CROSS_HIT = R({ hx: 3.5, hy: -16.5, tl: 34, hd: 12, aFx: 6, aFy: -3, aBx: 18, aBy: -5.5, lFx: 16, lBx: -13, lBy: -1 });
const CROSS_HOLD = R({ hx: 3.5, hy: -16.5, tl: 34, hd: 12, aFx: 6, aFy: -3, aBx: 18.5, aBy: -5.5, lFx: 16, lBx: -13, lBy: -1 });
/** 거두며 허리를 되돌린다 */
const CROSS_BACK = R({ hx: 1, hy: -18.5, tl: 19, hd: 9, aFx: 11, aFy: -4, aBx: 10, aBy: -1, lFx: 10, lBx: -9 });

/** 2타 스트레이트: 허리를 틀어 싣고(2~3프레임) 앞발로 깊이 디디며 뒷손을 끝까지 뻗고(4~5프레임 판정) 거둔다. 12프레임 15틱 */
export const RAIDEN_CROSS: MotionData = {
  name: 'raiden/cross',
  label: '라이덴 2타 스트레이트',
  dur: [1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: CROSS_TURN },
    { at: 3, pose: CROSS_HIT },
    { at: 5, pose: CROSS_HOLD, stop: true },
    { at: 8, pose: CROSS_BACK },
    { at: 11, pose: R_STANCE },
  ],
};

// ---- 3타: 훅 (앞손을 구부린 채 크게 휘둘러) ----
/** 무게를 뒷발로 옮기며 몸을 뒤로 감는다: 앞팔꿈치를 높이 들어 주먹을 귀 뒤로 크게 당긴다 */
const HOOK_LOAD = R({ hx: -1.5, hy: -17, tl: 6, hd: 10, aFx: 3, aFy: -12, aBx: 8, aBy: -1, lFx: 11, lBx: -10 });
/** 허리를 돌리며 앞으로 실려 구부린 앞팔이 크게 원을 그리며 들어온다 */
const HOOK_SWING = R({ hx: 2, hy: -16.5, tl: 24, hd: 12, aFx: 14, aFy: -11, aBx: 8, aBy: -1, lFx: 13, lBx: -10 });
/** 상대 관자놀이를 친다: 온몸이 돌아 앞으로 쏠리고 주먹이 가장 멀리 */
const HOOK_HIT = R({ hx: 3.5, hy: -16, tl: 34, hd: 14, aFx: 17, aFy: -4, aBx: 7, aBy: -1, lFx: 14, lBx: -11 });
/** 끝까지 휘둘러 주먹이 몸 안쪽 아래로 감긴다 (멈칫) */
const HOOK_THRU = R({ hx: 3.5, hy: -16, tl: 36, hd: 14, aFx: 12, aFy: 3, aBx: 7, aBy: -1, lFx: 14, lBx: -11 });
/** 거두며 가드로 */
const HOOK_BACK = R({ hx: 1, hy: -18.5, tl: 19, hd: 9, aFx: 12, aFy: -5, lFx: 10, lBx: -9 });

/** 3타 훅: 몸을 뒤로 감아 주먹을 귀 뒤로 당겼다가(2~4프레임) 허리를 돌려 크게 휘둘러(6~7프레임 판정) 몸 안쪽까지 감고 거둔다. 13프레임 15틱 */
export const RAIDEN_HOOK: MotionData = {
  name: 'raiden/hook',
  label: '라이덴 3타 훅',
  dur: [1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: HOOK_LOAD },
    { at: 5, pose: HOOK_SWING },
    { at: 6, pose: HOOK_HIT },
    { at: 7, pose: HOOK_THRU, stop: true },
    { at: 9, pose: HOOK_BACK },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 4타: 플라잉 니킥 (뛰어오르며 두 손으로 상대 머리를 끌어내리고 앞무릎을 차올림) ----
/** 앞발로 크게 디디며 낮게 웅크린다: 두 손을 앞으로 뻗어 상대 목덜미를 잡으러 간다 */
const KNEE_STEP = R({ hx: 2, hy: -15.5, tl: 22, hd: 8, aFx: 16, aFy: -9, aBx: 14, aBy: -7, lFx: 13, lBx: -10 });
/** 붙잡고(클린치) 뒷발로 바닥을 차며 솟기 시작한다 */
const KNEE_GRAB = R({ hx: 3, hy: -21, tl: 14, hd: 8, aFx: 16, aFy: -7, aBx: 14, aBy: -5, lFx: 11, lFy: -3, lBx: -9 });
/** 뛰어올라 두 손으로 끌어내리며 앞무릎을 가슴 높이로 힘껏 차올린다: 몸은 곧게 세우고 뒷다리는 뒤로 접어 늘어뜨린다 */
const KNEE_HIT = R({ hx: 3, hy: -28, tl: 0, hd: 12, aFx: 13, aFy: 5, aBx: 11, aBy: 7, lFx: 14, lFy: -24, lBx: -6, lBy: -8 });
/** 무릎을 끝까지 올린 채 떠 있다 (멈칫) */
const KNEE_HOLD = R({ hx: 3, hy: -28.5, tl: -2, hd: 12, aFx: 12, aFy: 6, aBx: 10, aBy: 8, lFx: 14, lFy: -25, lBx: -6, lBy: -8 });
/** 내려서며 무릎으로 받고 손을 가드로 되돌린다 */
const KNEE_DOWN = R({ hx: 1, hy: -16.5, tl: 16, hd: 9, aFx: 12, aFy: -4, aBx: 8, aBy: 0, lFx: 10, lFy: -1, lBx: -9 });

/** 4타 플라잉 니킥: 크게 디디며 붙잡고(3~5프레임) 뛰어올라 끌어내리며 앞무릎을 차올리고(7~8프레임 판정) 내려선다. 14프레임 20틱 */
export const RAIDEN_KNEE: MotionData = {
  name: 'raiden/knee',
  label: '라이덴 4타 니킥',
  dur: [1, 1, 1, 1, 2, 2, 1, 2, 2, 1, 1, 1, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: KNEE_STEP },
    { at: 4, pose: KNEE_GRAB },
    { at: 6, pose: KNEE_HIT },
    { at: 8, pose: KNEE_HOLD, stop: true },
    { at: 11, pose: KNEE_DOWN },
    { at: 13, pose: R_STANCE },
  ],
};

// ---- 띄우기: 뛰어오르는 뒷손 어퍼컷 ----
/** 무릎을 깊이 굽혀 바닥까지 웅크리고 뒷주먹을 무릎 높이로 떨어뜨린다 (앞손은 턱) */
const UP_DIP = R({ hx: 1, hy: -12, tl: 30, hd: 6, aFx: 9, aFy: -3, aBx: 5, aBy: 11, lFx: 12, lBx: -11 });
/** 다리를 펴며 솟구쳐 뒷주먹이 턱 밑에서 위로 */
const UP_RISE = R({ hx: 2.5, hy: -21, tl: 10, hd: 0, aFx: 8, aFy: -4, aBx: 11, aBy: -9, lFx: 11, lBx: -9 });
/** 바닥을 차고 뛰어올라 뒷주먹이 머리 위 끝까지 (몸이 곧게 펴지고 두 발이 뜬다) */
const UP_HIT = R({ hx: 3, hy: -27, tl: -2, hd: -10, aFx: 8, aFy: -4, aBx: 7, aBy: -18, lFx: 10, lFy: -6, lBx: -6, lBy: -5 });
const UP_HOLD = R({ hx: 3, hy: -27.5, tl: -2, hd: -10, aFx: 8, aFy: -4, aBx: 7, aBy: -18.5, lFx: 10, lFy: -6, lBx: -6, lBy: -5 });
/** 내려서며 무릎으로 받는다 */
const UP_LAND = R({ hx: 1, hy: -16, tl: 16, hd: 8, aFx: 11, aFy: -3, aBx: 9, aBy: 0, lFx: 10, lBx: -9 });

/** 띄우기 어퍼컷: 바닥까지 웅크렸다(4프레임) 솟구치며 뛰어올라 뒷주먹을 머리 위까지 쳐올리고(5~7프레임 판정) 내려선다. 13프레임 20틱 */
export const RAIDEN_UPPERCUT: MotionData = {
  name: 'raiden/uppercut',
  label: '라이덴 띄우기 어퍼컷',
  dur: [1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: UP_DIP },
    { at: 4, pose: UP_RISE },
    { at: 6, pose: UP_HIT },
    { at: 8, pose: UP_HOLD, stop: true },
    { at: 10, pose: UP_LAND },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 쓸기: 뒷발 로킥 (상대 종아리를 정강이로 크게 후려 넘어뜨린다) ----
/** 앞발로 비켜 디디며 몸을 숙여 틀고, 뒷다리를 뒤로 높이 감아 올린다 */
const LK_WIND = R({ hx: 1, hy: -19, tl: 24, hd: 8, aFx: 11, aFy: -5, aBx: 6, aBy: -1, lFx: 10, lBx: -14, lBy: -9 });
/** 뒷다리 정강이로 낮게 크게 후려친다: 다리가 앞쪽 무릎 아래 높이로 쭉, 몸은 뒤로 젖히고 가드는 그대로 */
const LK_HIT = R({ hx: 1.5, hy: -21, tl: -10, hd: 14, aFx: 11, aFy: -8, aBx: 8, aBy: -4, lFx: 6, lBx: 21, lBy: -7 });
/** 휘두른 다리가 끝까지 지나간다 (멈칫) */
const LK_THRU = R({ hx: 1, hy: -21, tl: -12, hd: 14, aFx: 11, aFy: -8, aBx: 8, aBy: -4, lFx: 6, lBx: 18, lBy: -4 });
/** 다리를 거둬 뒤로 딛는다 */
const LK_BACK = R({ hx: 0, hy: -19, tl: 10, hd: 8, aFx: 12, aFy: -5, lFx: 8, lBx: -7, lBy: -4 });

/** 쓸기 로킥: 뒷다리를 뒤로 높이 감고(4프레임) 정강이로 낮게 크게 후려쳐(5~7프레임 판정) 넘어뜨리고 거둔다. 14프레임 21틱 */
export const RAIDEN_LOW_KICK: MotionData = {
  name: 'raiden/low_kick',
  label: '라이덴 쓸기 로킥',
  dur: [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: LK_WIND },
    { at: 4, pose: LK_HIT },
    { at: 7, pose: LK_THRU, stop: true },
    { at: 10, pose: LK_BACK },
    { at: 13, pose: R_STANCE },
  ],
};

// ---- 대시 공격: 슈퍼맨 펀치 (대시에서 높이 뛰어들며 뒷손을 곧게) ----
/** 대시 자세 (라이덴 지상 대시의 낮게 파고든 자세에서 시작) */
const SP_ENTRY = R({ hx: 3, hy: -13, tl: 36, hd: -10, aFx: 12, aFy: 0, aBx: 8, aBy: 3, lFx: 16, lBx: -16, lBy: 0 });
/** 높이 뛰어오르며 뒷무릎을 뒤로 접어 차올리고 뒷손을 귀 옆으로 크게 당긴다 */
const SP_HOP = R({ hx: 2, hy: -28, tl: 14, hd: -2, aFx: 10, aFy: -5, aBx: 1, aBy: -7, lFx: 10, lFy: -10, lBx: -12, lBy: -14 });
/** 공중에서 뒷손을 끝까지 내지른다: 뒷다리는 뒤로 길게 차 뻗고 앞다리는 접어, 몸 전체가 한 줄로 */
const SP_HIT = R({ hx: 2, hy: -26, tl: 40, hd: -6, aFx: 7, aFy: -4, aBx: 18, aBy: -6, lFx: 8, lFy: -8, lBx: -17, lBy: -12 });
/** 내려서며 가드 */
const SP_LAND = R({ hx: 1, hy: -15, tl: 22, hd: 6, aFx: 11, aFy: -3, aBx: 9, aBy: 1, lFx: 11, lBx: -10 });

/** 대시 공격 슈퍼맨 펀치: 대시 자세 → 높이 뛰어오르며 뒷손을 당겨 → 공중에서 뒷손을 끝까지(6~7프레임 판정) → 내려서며 가드. 13프레임 23틱 */
export const RAIDEN_SUPERMAN: MotionData = {
  name: 'raiden/superman',
  label: '라이덴 대시 공격 슈퍼맨 펀치',
  dur: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: SP_ENTRY },
    { at: 3, pose: SP_HOP },
    { at: 5, pose: SP_HIT },
    { at: 7, pose: SP_HIT, stop: true },
    { at: 10, pose: SP_LAND },
    { at: 12, pose: R_STANCE },
  ],
};

// ---- 공중 평타: 공중 잽 · 공중 스트레이트 · 공중 니킥 · 내려찍기(해머 피스트) ----
/** 공중 기본 (라이덴 점프의 웅크림과 같은 꼴) */
const A_TUCK = R({ hx: 0, hy: -26, tl: 16, hd: 7, aFx: 11, aFy: -4, aBx: 8, aBy: -1, lFx: 7, lFy: -13, lBx: -1, lBy: -11 });
/** 공중 잽 준비: 몸을 젖혀 앞손을 당긴다 */
const AJ_LOAD = R({ hx: -1, hy: -26, tl: 6, hd: 6, aFx: 7, aFy: -7, aBx: 8, aBy: -1, lFx: 8, lFy: -14, lBx: -2, lBy: -12 });
/** 공중 잽: 몸을 크게 숙여 앞손을 아래 대각선(띄운 상대 쪽, 약 45°)으로 끝까지, 뒷다리는 뒤로 뻗어 버팀 */
const AJ_HIT = R({ hx: 2, hy: -26, tl: 38, hd: 14, aFx: 13, aFy: 13, aBx: 8, aBy: 0, lFx: 7, lFy: -11, lBx: -9, lBy: -9 });
/** 공중 스트레이트: 허리를 틀어 뒷손을 크게 당겼다가 아래 대각선으로 끝까지, 앞손은 턱으로 */
const AS_TURN = R({ hx: 0, hy: -26, tl: 14, hd: 8, aFx: 8, aFy: -4, aBx: 5, aBy: -5, lFx: 7, lFy: -12, lBx: -3, lBy: -10 });
const AS_HIT = R({ hx: 2.5, hy: -26, tl: 40, hd: 14, aFx: 6, aFy: -3, aBx: 14, aBy: 12, lFx: 9, lFy: -11, lBx: -10, lBy: -8 });
/** 공중 니킥: 두 손을 뻗어 붙잡으며 무릎을 접어 모았다가 */
const AN_LOAD = R({ hx: -1, hy: -27, tl: 20, hd: 8, aFx: 16, aFy: -6, aBx: 14, aBy: -4, lFx: 4, lFy: -9, lBx: -6, lBy: -10 });
/** 두 손으로 끌어내리며 앞무릎을 아래 앞쪽으로 내지른다: 뒷다리는 뒤로 길게 가위처럼 벌린다 */
const AN_HIT = R({ hx: 2, hy: -26, tl: -4, hd: 14, aFx: 12, aFy: 7, aBx: 10, aBy: 9, lFx: 15, lFy: -10, lBx: -11, lBy: -6 });
/** 해머 피스트: 허리를 뒤로 크게 젖혀 두 주먹을 머리 위 뒤로 들었다가 */
const HM_UP = R({ hx: -1.5, hy: -26, tl: -14, hd: -10, aFx: 1, aFy: -16.5, aBx: -2, aBy: -15.5, lFx: 6, lFy: -9, lBx: -6, lBy: -7 });
/** 몸을 반으로 접으며 아래 앞쪽으로 내리찍는다 (두 다리는 뒤로 뻗는다) */
const HM_HIT = R({ hx: 2, hy: -25, tl: 44, hd: 16, aFx: 13, aFy: 11, aBx: 12, aBy: 12, lFx: 5, lFy: -6, lBx: -7, lBy: -4 });
/** 떨어지는 자세로 (라이덴 낙하 첫 자세) */
const A_OPEN = R({ hx: 0, hy: -25, tl: 14, hd: 7, aFx: 11, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -7, lBx: -6, lBy: -5 });

/** 공중 1타 잽: 몸을 젖혀 앞손을 당겼다가(3프레임) 크게 숙여 아래 대각선으로 끝까지(4~5프레임 판정). 12프레임 14틱 */
export const RAIDEN_AIR_JAB: MotionData = {
  name: 'raiden/air_jab',
  label: '라이덴 공중 1타 잽',
  dur: [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 2, pose: AJ_LOAD },
    { at: 3, pose: AJ_HIT },
    { at: 5, pose: AJ_HIT, stop: true },
    { at: 11, pose: A_TUCK },
  ],
};
/** 공중 2타 스트레이트: 허리를 틀어 뒷손을 당겼다가(3프레임) 아래 대각선으로 끝까지(4~5프레임 판정). 12프레임 14틱 */
export const RAIDEN_AIR_CROSS: MotionData = {
  name: 'raiden/air_cross',
  label: '라이덴 공중 2타 스트레이트',
  dur: [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 2, pose: AS_TURN },
    { at: 3, pose: AS_HIT },
    { at: 5, pose: AS_HIT, stop: true },
    { at: 11, pose: A_TUCK },
  ],
};
/** 공중 3타 니킥: 붙잡으며 무릎을 모았다가(4프레임) 끌어내리며 앞무릎을 내질러(5~6프레임 판정) 비스듬히 날린다. 13프레임 19틱 */
export const RAIDEN_AIR_KNEE: MotionData = {
  name: 'raiden/air_knee',
  label: '라이덴 공중 3타 니킥',
  dur: [1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 3, pose: AN_LOAD },
    { at: 4, pose: AN_HIT },
    { at: 6, pose: AN_HIT, stop: true },
    { at: 12, pose: A_TUCK },
  ],
};
/** 내려찍기 해머 피스트: 허리를 젖혀 두 주먹을 머리 위 뒤로 들었다가(4프레임) 몸을 접으며 내리찍어(6~8프레임 판정) 낙하 자세로. 14프레임 20틱 */
export const RAIDEN_HAMMER: MotionData = {
  name: 'raiden/hammer',
  label: '라이덴 내려찍기 해머 피스트',
  dur: [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2],
  keys: [
    { at: 0, pose: A_TUCK },
    { at: 3, pose: HM_UP },
    { at: 5, pose: HM_HIT },
    { at: 8, pose: HM_HIT, stop: true },
    { at: 13, pose: A_OPEN },
  ],
};

// ---- 차지: 투전승불 (공격을 길게 눌렀다 떼기. "울려라." 생체 전류를 증폭해 적빛 전격 갑옷이 드러난다) ----
/** 두 주먹을 허리로 끌어당기며 다리를 넓게 벌리고 낮게 버틴다 (고개를 숙여 힘을 모은다) */
const CH_PULL = R({ hx: -1, hy: -15, tl: 8, hd: 16, aFx: -2, aFy: 13, aBx: -4, aBy: 13, lFx: 11, lBx: -12 });
/** 모으는 동안 1: 가슴을 펴고 주먹을 쥔 채 고개를 들어 상대를 본다 (온몸에 힘이 들어가 떨림) */
const CH_HOLD_A = R({ hx: -1, hy: -15, tl: 2, hd: 4, aFx: -1, aFy: 12, aBx: -3, aBy: 12, lFx: 11, lBx: -12 });
/** 모으는 동안 2: 어깨가 한 번 들썩인다 */
const CH_HOLD_B = R({ hx: -1, hy: -15.5, tl: 4, hd: 6, aFx: -1.5, aFy: 11, aBx: -3.5, aBy: 11, lFx: 11, lBx: -12 });
/** 떼는 순간: 앞발로 크게 디디며 허리를 틀어 뒷주먹을 끌어낸다 */
const CH_STEP = R({ hx: 2.5, hy: -15.5, tl: 20, hd: 8, aFx: 4, aFy: 4, aBx: 5, aBy: 2, lFx: 16, lBx: -12 });
/** 뒷주먹을 곧게 내지른다: 온몸을 실어 앞으로 쏠리고 앞주먹은 가슴으로 당긴다, 뒷다리는 뒤로 길게 (가장 멀리) */
const CH_HIT = R({ hx: 3.5, hy: -15.5, tl: 34, hd: 11, aFx: 3, aFy: 4, aBx: 18.5, aBy: -6, lFx: 17, lBx: -14 });
const CH_HOLD_HIT = R({ hx: 3.5, hy: -15.5, tl: 34, hd: 11, aFx: 3, aFy: 4, aBx: 19, aBy: -6, lFx: 17, lBx: -14 });
/** 거두며 가드로 */
const CH_BACK = R({ hx: 1, hy: -18, tl: 18, hd: 8, aFx: 11, aFy: -3, aBx: 10, aBy: 0, lFx: 11, lBx: -10 });

/**
 * 차지 투전승불: 1~4프레임 두 주먹을 허리로 끌어당겨 버팀(한 번) → 5~8프레임 모으는 동안 되풀이(떨림) →
 * 떼면 9프레임부터 앞발로 크게 디디며 뒷주먹을 끝까지(11~12프레임 판정) → 가드. 14프레임 (기본 차지와 같은 구조)
 */
export const RAIDEN_CHARGE: MotionData = {
  name: 'raiden/charge',
  label: '라이덴 차지 투전승불',
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 2, pose: CH_PULL },
    { at: 4, pose: CH_HOLD_A },
    { at: 6, pose: CH_HOLD_B },
    { at: 8, pose: CH_HOLD_A },
    { at: 9, pose: CH_STEP },
    { at: 10, pose: CH_HIT },
    { at: 11, pose: CH_HOLD_HIT, stop: true },
    { at: 12, pose: CH_BACK },
    { at: 13, pose: R_STANCE },
  ],
};

export const RAIDEN_ATTACK_MOTIONS: readonly MotionData[] = [
  RAIDEN_CHARGE,

  RAIDEN_JAB, RAIDEN_CROSS, RAIDEN_HOOK, RAIDEN_KNEE, RAIDEN_UPPERCUT, RAIDEN_LOW_KICK, RAIDEN_SUPERMAN,
  RAIDEN_AIR_JAB, RAIDEN_AIR_CROSS, RAIDEN_AIR_KNEE, RAIDEN_HAMMER,
];
