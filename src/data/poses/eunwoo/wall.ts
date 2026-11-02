import type { MotionData } from '../../../anim/motion';
import { spin } from './air';
import { E } from './stance';

/*
 * 백은우 벽 기동 (캐릭터 기획서 '움직임': 벽 달리기는 가장 가볍다).
 * 기본 스틱맨 벽 기동과 같은 sim 규칙·프레임 구조를 쓴다 (벽 붙기 5번째 프레임부터 되풀이, 벽 달리기 11번째 프레임부터 꼭대기 넘기).
 * 벽에 붙으면 벽을 등지고 바깥을 본다: 벽 면은 발밑 기준점에서 뒤로 7px. 벽 달리기는 벽을 바라본다 (벽은 앞으로 7px).
 * 라이덴이 벽을 걷어차듯 딛는 것과 달리, 은우는 발끝과 손끝만 가볍게 대고 몸이 거의 떠 있다.
 */

// ---- 벽 붙기 (벽은 뒤 x = -7) ----
/** 벽에 닿는다: 뒷발끝과 뒷손끝이 벽에 가볍게 닿고 몸이 둥실 뜬다 */
const CL_TOUCH = E({ hx: -1.5, hy: -24, tl: -4, hd: -2, aFx: 10, aFy: 0, aBx: -8, aBy: -4, lFx: 6, lFy: -3, lBx: -7, lBy: -11 });
/** 무릎으로 부드럽게 받는다 (멈칫) */
const CL_SOFT = E({ hx: -2, hy: -22, tl: 8, hd: 6, aFx: 10, aFy: 3, aBx: -8, aBy: -2, lFx: 5, lFy: -1, lBx: -7, lBy: -10 });
/** 붙은 자세: 뒷발끝·뒷손끝으로 벽을 짚고, 앞다리는 아래로 늘어뜨리고, 연검 끝은 앞으로 */
const CL_HOLD = E({ hx: -2, hy: -23, tl: 6, hd: 4, aFx: 11, aFy: 2, aBx: -8.5, aBy: -6, lFx: 4, lFy: -1, lBx: -7, lBy: -12 });
/** 미끄러지며 몸이 흔들린다 (가운 자락이 늘어진다) */
const CL_SWAY = E({ hx: -2, hy: -22.5, tl: 10, hd: 7, aFx: 11, aFy: 5, aBx: -8.5, aBy: -3, lFx: 6, lFy: 0, lBx: -7, lBy: -10 });

/** 벽 붙기: 1~4프레임 닿는 순간(한 번), 5~13프레임 천천히 미끄러지며 흔들림을 되풀이. 13프레임 */
export const EUNWOO_WALL_CLING: MotionData = {
  name: 'eunwoo/wall_cling',
  label: '백은우 벽 붙기',
  dur: [1, 2, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  follow: { ribbon: { air: true, stiff: 0.6 }, breeze: 0.4 },
  keys: [
    { at: 0, pose: CL_TOUCH },
    { at: 2, pose: CL_SOFT, stop: true },
    { at: 4, pose: CL_HOLD },
    { at: 8, pose: CL_SWAY, stop: true },
    { at: 12, pose: CL_HOLD },
  ],
};

// ---- 벽 점프 (벽은 뒤. 첫 프레임에는 이미 벽에서 4px쯤 떨어져 있다) ----
/** 뒷발끝으로 벽을 밀어 몸을 앞으로 던진다: 팔은 위로, 앞무릎을 접는다 */
const WJ_PUSH = E({ hx: 2, hy: -23, tl: 20, hd: -10, aFx: 14, aFy: -6, aBx: -2, aBy: -12, lFx: 8, lFy: -8, lBx: -12, lBy: -6 });
/** 백조처럼 등을 젖혀 활짝 편다: 두 팔을 위·뒤로 벌리고 다리는 뒤로 모은다 */
const WJ_SWAN = E({ hx: 1, hy: -25, tl: 2, hd: -16, aFx: 10, aFy: -14, aBx: -12, aBy: -10, lFx: 3, lFy: -4, lBx: -11, lBy: -9 });
/** 무릎을 모아 몸을 접는다 */
const WJ_GATHER = E({ hx: 0, hy: -25, tl: 16, hd: 4, aFx: 11, aFy: -2, aBx: -6, aBy: -4, lFx: 9, lFy: -12, lBx: -3, lBy: -12 });
/** 꼭대기에서 몸을 펴 떨어질 준비 (낙하 첫 자세와 같은 꼴) */
const WJ_OPEN = E({ hx: 0, hy: -25, tl: 6, hd: 0, aFx: 12, aFy: -6, aBx: -10, aBy: -6, lFx: 7, lFy: -7, lBx: -6, lBy: -5 });

/** 벽 점프: 뒷발끝으로 벽을 밀고 → 등을 젖혀 활짝 펴며 솟고 → 몸을 접었다 → 펴서 낙하로. 14프레임 */
export const EUNWOO_WALL_JUMP: MotionData = {
  name: 'eunwoo/wall_jump',
  label: '백은우 벽 점프',
  dur: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  follow: { ribbon: { air: true, stiff: 0.5, gravity: 0.4, damp: 0.9 }, wind: 0.4 },
  keys: [
    { at: 0, pose: WJ_PUSH },
    { at: 3, pose: WJ_SWAN, stop: true },
    { at: 8, pose: WJ_GATHER },
    { at: 11, pose: WJ_OPEN },
    { at: 13, pose: WJ_OPEN },
  ],
};

// ---- 벽 달리기 (벽은 앞 x = +7. 벽을 바라보며 발끝으로 가볍게 달려 오른다) ----
/** 대시에서 이어져 앞발끝을 벽에 댄다 (몸을 벽 쪽으로 기울인다) */
const WR_PLANT = E({ hx: 0, hy: -22, tl: 20, hd: -8, aFx: -2, aFy: 10, aBx: -6, aBy: 6, lFx: 7, lFy: -12, lBx: -5, lBy: -1 });
/** 앞발끝으로 벽을 가볍게 밀어 오르며 뒷무릎을 차올린다 (뒷팔이 앞으로, 연검 쥔 앞팔은 뒤아래로) */
const WR_A = E({ hx: 0.5, hy: -25, tl: 18, hd: -14, aFx: -3, aFy: 11, aBx: 8, aBy: -7, lFx: 7, lFy: -22, lBx: 2, lBy: -9 });
/** 발을 바꿔 뒷발끝을 높이 벽에 댄다 (팔도 바뀐다) */
const WR_B = E({ hx: 0.5, hy: -25, tl: 18, hd: -14, aFx: 5, aFy: 4, aBx: -5, aBy: 9, lFx: 2, lFy: -9, lBx: 7, lBy: -22 });
/** 꼭대기 모서리에 두 손을 짚는다 */
const WR_GRAB = E({ hx: 0, hy: -24, tl: 4, hd: -20, aFx: 5, aFy: -16, aBx: 3, aBy: -16, lFx: 5, lFy: -9, lBx: 1, lBy: -2 });
/** 짚은 손으로 몸을 띄워 다리를 높이 넘긴다 (물구나무 넘기) */
const WR_VAULT = E({ hx: 2, hy: -28, tl: 62, hd: 12, aFx: 2, aFy: 10, aBx: 0, aBy: 11, lFx: -8, lFy: -34, lBx: -12, lBy: -30 });
/** 윗면에 발끝으로 내려서며 연검을 앞으로 */
const WR_OVER = E({ hx: 3, hy: -22, tl: 14, hd: 0, aFx: 12, aFy: -4, aBx: -8, aBy: -2, lFx: 9, lFy: -10, lBx: -5, lBy: -6 });

/** 벽 달리기 (11-1: 가장 가볍게, 벽 쪽으로 기울어 발끝으로 세 걸음): 1~10프레임 발끝으로 번갈아 가볍게 벽을 밀며 달려 오름, 11~14프레임 모서리를 짚고 다리를 넘겨 올라섬. 14프레임 */
export const EUNWOO_WALL_RUN: MotionData = {
  name: 'eunwoo/wall_run',
  label: '백은우 벽 달리기',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],
  // 오르는 동안 가운 자락·연검이 아래로 끌린다
  follow: { ribbon: { air: true, stiff: 0.5, keys: [{ at: 0, gravity: 1.8 }, { at: 9, gravity: 1.8 }, { at: 11, gravity: 0.8 }] }, wind: 0.8 },
  keys: [
    { at: 0, pose: WR_PLANT },
    { at: 2, pose: WR_A },
    { at: 5, pose: WR_B },
    { at: 8, pose: WR_A },
    { at: 10, pose: WR_GRAB },
    { at: 11, pose: WR_VAULT, stop: true },
    { at: 13, pose: WR_OVER },
  ],
};

// ---- 벽 낙법 (벽꽝: 뒤쪽 건물 정면에 박히는 순간. 정면을 걷어차고 몸을 쭉 편 채 뒤로 공중제비) ----
/** 부딪힌 순간: 몸이 젖혀지고 팔이 들린다 */
const WT_HIT = E({ hx: -6, hy: -22, tl: -18, hd: -14, aFx: 3, aFy: -17, aBx: -8, aBy: -15, lFx: 10, lFy: 0, lBx: -7, lBy: 0 });
/** 무릎을 끌어당겨 걷어찰 준비 */
const WT_COIL = E({ hx: -3, hy: -25, tl: -4, hd: 6, aFx: 10, aFy: -6, aBx: 2, aBy: 2, lFx: 6, lFy: -14, lBx: 0, lBy: -16 });
/** 두 발로 정면을 뒤로 걷어찬다 */
const WT_KICK = E({ hx: -1, hy: -26, tl: 16, hd: -6, aFx: 12, aFy: -6, aBx: 6, aBy: -2, lFx: -10, lFy: -16, lBx: -16, lBy: -14 });
/** 몸을 쭉 편 채(팔은 머리 위로) 돌린다 — 이것을 통째로 돌린다 */
const WT_LAYOUT = E({ hx: 0, hy: -26, tl: 0, hd: -10, aFx: 6, aFy: -15, aBx: -2, aBy: -15, lFx: 3, lFy: 1, lBx: -3, lBy: 2 });
/** 한 바퀴를 다 돌며 몸을 펴 떨어질 준비 */
const WT_OPEN = E({ hx: 0, hy: -25, tl: 6 - 360, hd: 0, aFx: 12, aFy: -6, aBx: -10, aBy: -6, lFx: 7, lFy: -7, lBx: -6, lBy: -5 });

/** 벽 낙법: 부딪힌 순간 → 무릎을 당겨 → 정면을 걷어참 → 몸을 쭉 편 채 뒤로 한 바퀴 → 펴서 낙하로. 13프레임 */
export const EUNWOO_WALL_TECH: MotionData = {
  name: 'eunwoo/wall_tech',
  label: '백은우 벽 낙법',
  dur: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],
  follow: { ribbon: { air: true, stiff: 0.5, gravity: 0.4, damp: 0.9 }, wind: 0.5 },
  keys: [
    { at: 0, pose: WT_HIT },
    { at: 1, pose: WT_COIL },
    { at: 2, pose: WT_KICK },
    { at: 3, pose: spin(WT_LAYOUT, -70) },
    { at: 5, pose: spin(WT_LAYOUT, -160) },
    { at: 7, pose: spin(WT_LAYOUT, -250) },
    { at: 9, pose: spin(WT_LAYOUT, -320) },
    { at: 10, pose: WT_OPEN },
    { at: 12, pose: WT_OPEN },
  ],
};

// ---- 벽 박차기 공격 (벽은 뒤. 벽을 박차고 아래 대각선으로 내리꽂히며 연검을 위에서 앞아래로 크게 휘두른다) ----
/*
 * 기술 수치(판정 4~9프레임, 3~9프레임 동안 날아감)는 기본 스틱맨 벽 박차기 공격 그대로라 프레임 수(13)와 표시 틱도 같다.
 * 은우는 발이 아니라 연검으로 친다: 판정은 앞팔(팔꿈치→손) + 칼날이 닿는 궤적 상자 (data/characters/eunwoo.ts).
 */
/** 붙은 채 연검을 머리 뒤로 높이 들어 감는다 */
const WK_COIL = E({ hx: -2.5, hy: -21, tl: 12, hd: 12, aFx: -2, aFy: -12, aBx: -8, aBy: -2, lFx: 4, lFy: -9, lBx: -7, lBy: -12 });
/** 더 깊이 감는다 (멈칫) */
const WK_SQUASH = E({ hx: -3, hy: -19.5, tl: 16, hd: 14, aFx: -4, aFy: -13, aBx: -8, aBy: 0, lFx: 3, lFy: -10, lBx: -7, lBy: -11 });
/** 벽을 박차고 튀어 나간다: 연검은 머리 위 */
const WK_PUSH = E({ hx: 3, hy: -21, tl: 22, hd: 8, aFx: 4, aFy: -14, aBx: -10, aBy: -2, lFx: 8, lFy: -10, lBx: -13, lBy: -9 });
/** 내리꽂으며 연검을 앞아래로 크게 휘두른다: 몸은 비스듬히 앞으로, 다리는 뒤로 모은다 */
const WK_SLASH = E({ hx: 1, hy: -21, tl: 42, hd: -14, tw: 4, aFx: 16.7, aFy: 6.4, aBx: -10, aBy: 2, lFx: -4, lFy: -10, lBx: -12, lBy: -12 });
/** 휘두른 자세로 날아간다 */
const WK_DIVE = E({ hx: 1, hy: -21, tl: 44, hd: -14, tw: 4, aFx: 14, aFy: 10, aBx: -10, aBy: 3, lFx: -4, lFy: -9, lBx: -12, lBy: -11 });
/** 날아가는 끝: 칼끝이 몸 아래로 감긴다 */
const WK_END = E({ hx: 1, hy: -21, tl: 34, hd: -10, tw: 2, aFx: 8, aFy: 13, aBx: -10, aBy: 2, lFx: 0, lFy: -9, lBx: -10, lBy: -10 });
/** 몸을 세우며 다리를 내린다 */
const WK_RETRACT = E({ hx: 0, hy: -23, tl: 12, hd: 2, aFx: 11, aFy: 0, aBx: -9, aBy: -2, lFx: 7, lFy: -9, lBx: -5, lBy: -7 });

/** 벽 박차기 공격: 1~2프레임 감기 → 3프레임 박차고 나감 → 4~9프레임 내리꽂으며 연검을 휘두름(판정) → 10~13프레임 거두고 낙하로. 13프레임 (128×96) */
export const EUNWOO_WALL_KICK: MotionData = {
  name: 'eunwoo/wall_kick',
  label: '백은우 벽 박차기 공격',
  wide: true,
  follow: { ribbon: { air: true, stiff: 0.8, damp: 0.92, keys: [{ at: 2, stiff: 0.5, curl: 1 }, { at: 3.5, stiff: 2.4, curl: 0.35 }, { at: 6, stiff: 1.2, curl: 0.7 }, { at: 10, stiff: 0.6, curl: 1 }] }, wind: 0.6 },
  smear: { frame: 3, limb: 'aF', stretch: 1.4 },
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: WK_COIL },
    { at: 1, pose: WK_SQUASH, stop: true },
    { at: 2, pose: WK_PUSH },
    { at: 3, pose: WK_SLASH },
    { at: 5, pose: WK_DIVE },
    { at: 8, pose: WK_END, stop: true },
    { at: 9, pose: WK_RETRACT },
    { at: 12, pose: WJ_OPEN },
  ],
};

export const EUNWOO_WALL_MOTIONS: readonly MotionData[] = [EUNWOO_WALL_CLING, EUNWOO_WALL_JUMP, EUNWOO_WALL_RUN, EUNWOO_WALL_KICK, EUNWOO_WALL_TECH];
