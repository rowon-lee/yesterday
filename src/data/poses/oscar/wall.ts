import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { handB, OD, OR, spin } from './stance';

/*
 * 오스카 벽 기동 (캐릭터 기획서 '움직임': 동작은 작고 군더더기가 없다).
 * 기본 스틱맨 벽 기동과 같은 sim 규칙·프레임 구조를 쓴다 (벽 붙기 5번째 프레임부터 되풀이, 벽 달리기 11번째 프레임부터 꼭대기 넘기).
 * 벽에 붙으면 벽을 등지고 바깥을 본다: 벽 면은 발밑 기준점에서 뒤로 7px. 벽 달리기는 벽을 바라본다 (벽은 앞으로 7px).
 * 앞손은 늘 칼자루에 얹혀 있고, 뒷손만 벽을 짚는다. 발은 벽을 차지 않고 한 발 끝으로 가볍게 디딘다.
 */

// ---- 벽 붙기 (벽은 뒤 x = -7) ----
/** 등이 벽에 닿는다: 뒷발 끝을 벽에 디디고, 뒷손바닥으로 벽을 짚는다. 등이 조금 젖혀진다 */
const CL_HIT: Pose = handB(OR({ hx: -1, hy: -24, tl: -2, hd: 4, lFx: 4, lFy: -2, lBx: -7, lBy: -9 }), -7, -31);
/** 무릎을 접어 받는다 (멈칫), 고개를 숙인다 */
const CL_SQUASH: Pose = handB(OR({ hx: -1.5, hy: -22, tl: 9, hd: 13, lFx: 3, lFy: -1, lBx: -7, lBy: -7 }), -7, -29);
/** 붙은 자세: 벽을 등지고 뒷발 끝·뒷손으로 벽을 짚고, 앞발은 아래로 늘어뜨린다. 앞손은 칼자루 */
const CL_HOLD: Pose = handB(OR({ hx: -1.5, hy: -23, tl: 7, hd: 10, lFx: 4, lFy: -2, lBx: -7, lBy: -9 }), -7, -31);
/** 미끄러지며 뒷발 끝이 벽을 쓸고 내려간다 */
const CL_DRAG: Pose = handB(OR({ hx: -1.5, hy: -22.5, tl: 8, hd: 11, lFx: 4, lFy: -1, lBx: -7, lBy: -6 }), -7, -29);
/** 뒷발 끝을 조금 위에 다시 딛는다 */
const CL_STEP: Pose = handB(OR({ hx: -1.5, hy: -23.5, tl: 6, hd: 9, lFx: 4, lFy: -3, lBx: -7, lBy: -11 }), -7, -32);

/** 벽 붙기: 1~4프레임 붙는 순간(한 번), 5~13프레임 미끄러지며 뒷발 끝을 다시 딛기를 되풀이. 13프레임 */
export const OSCAR_WALL_CLING: MotionData = {
  name: 'oscar/wall_cling',
  label: '오스카 벽 붙기',
  dur: [1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: CL_HIT },
    { at: 2, pose: CL_SQUASH, stop: true },
    { at: 3, pose: CL_HOLD },
    { at: 6, pose: CL_DRAG },
    { at: 9, pose: CL_STEP, stop: true },
    { at: 12, pose: CL_HOLD },
  ],
};

// ---- 벽 점프 (벽은 뒤. 첫 프레임에는 이미 벽에서 4px쯤 떨어져 있다) ----
/** 뒷발 끝으로 벽을 밀어 몸을 앞으로 띄운다: 뒷다리는 벽 쪽으로 펴고, 앞무릎은 가볍게 든다 */
const WJ_PUSH: Pose = OR({ hx: 2, hy: -23, tl: 20, hd: 8, lFx: 6, lFy: -9, lBx: -11, lBy: -6 });
/** 비스듬히 떠 나간다: 두 다리를 모아 뒤로 끈다 (칼자루를 쥔 채, 몸은 곧게) */
const WJ_FLY: Pose = OR({ hx: 1, hy: -25, tl: 16, hd: 8, lFx: 2, lFy: -4, lBx: -5, lBy: -3 });
/** 꼭대기: 다리를 가볍게 접는다 (점프 꼭대기와 같은 꼴) */
const WJ_TOP: Pose = OR({ hy: -25, tl: 13, hd: 12, lFx: 5, lFy: -8, lBx: -1, lBy: -6 });
/** 떨어질 준비 */
const WJ_OPEN: Pose = OR({ hy: -25, tl: 12, hd: 13, lFx: 4, lFy: -3, lBx: -3, lBy: -2 });

/** 벽 점프: 뒷발로 벽을 밀고 → 다리를 모아 비스듬히 떠 나감 → 꼭대기에서 다리를 접었다 → 낙하로. 14프레임 */
export const OSCAR_WALL_JUMP: MotionData = {
  name: 'oscar/wall_jump',
  label: '오스카 벽 점프',
  dur: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: WJ_PUSH },
    { at: 2, pose: WJ_FLY },
    { at: 7, pose: WJ_TOP, stop: true },
    { at: 11, pose: WJ_OPEN },
    { at: 13, pose: WJ_OPEN },
  ],
};

// ---- 벽 달리기 (벽은 앞 x = +7. 벽을 바라보며 걸어 오른다) ----
/** 대시에서 이어져 앞발 끝을 벽에 디딘다 (몸을 조금 젖혀 위를 본다) */
const WR_PLANT: Pose = OR({ hx: 0, hy: -21, tl: 2, hd: -10, lFx: 7, lFy: -13, lBx: -5, lBy: -1 });
/** 앞발로 벽을 딛고 올라서며 뒷발을 끌어올린다 (보폭 작게) */
const WR_A: Pose = OR({ hx: 0, hy: -25, tl: 0, hd: -12, lFx: 7, lFy: -18, lBx: 3, lBy: -6 });
/** 발을 바꿔 뒷발 끝을 벽에 딛는다 */
const WR_B: Pose = OR({ hx: 0, hy: -25, tl: 0, hd: -12, lFx: 3, lFy: -6, lBx: 7, lBy: -18 });
/** 꼭대기 모서리를 뒷손 하나로 잡는다 (앞손은 칼자루 그대로) */
const WR_GRAB: Pose = handB(OR({ hx: 0, hy: -24, tl: 2, hd: -18, lFx: 5, lFy: -9, lBx: 1, lBy: -2 }), 6, -50);
/** 한 팔로 몸을 끌어올리며 무릎을 당긴다 */
const WR_PULL: Pose = handB(OR({ hx: 2, hy: -28, tl: 22, hd: -2, lFx: 6, lFy: -19, lBx: 3, lBy: -15 }), 8, -26);
/** 윗면에 올라서며 몸을 세운다 */
const WR_OVER: Pose = OR({ hx: 3, hy: -22, tl: 16, hd: 8, lFx: 9, lFy: -10, lBx: -4, lBy: -4 });

/** 벽 달리기: 1~10프레임 발끝을 번갈아 벽에 딛으며 걸어 오름, 11~14프레임 한 손으로 모서리를 잡고 끌어올려 넘어감. 14프레임 */
export const OSCAR_WALL_RUN: MotionData = {
  name: 'oscar/wall_run',
  label: '오스카 벽 달리기',
  dur: [2, 2, 3, 2, 3, 2, 3, 2, 3, 3, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: WR_PLANT },
    { at: 1, pose: WR_A },
    { at: 3, pose: WR_B },
    { at: 5, pose: WR_A },
    { at: 7, pose: WR_B },
    { at: 9, pose: WR_A },
    { at: 10, pose: WR_GRAB },
    { at: 11, pose: WR_PULL, stop: true },
    { at: 13, pose: WR_OVER },
  ],
};

// ---- 벽 낙법 (벽꽝: 뒤쪽 건물 정면에 박히는 순간. 정면을 밀고 뒤로 작게 한 바퀴 돌아 빠져나간다) ----
/** 부딪힌 순간: 몸이 젖혀지고 뒷손이 들린다 */
const WT_HIT: Pose = handB(OR({ hx: -5, hy: -22, tl: -14, hd: -10, lFx: 8, lFy: 0, lBx: -7, lBy: 0 }), -10, -40);
/** 뒷무릎을 끌어당겨 밀 준비 */
const WT_COIL: Pose = OR({ hx: -3, hy: -24, tl: -2, hd: 8, lFx: 6, lFy: -12, lBx: 0, lBy: -14 });
/** 뒷발로 정면을 뒤로 민다 */
const WT_PUSH: Pose = OR({ hx: -1, hy: -26, tl: 20, hd: 0, lFx: 6, lFy: -13, lBx: -15, lBy: -13 });
/** 공중제비: 무릎을 모은 작은 웅크림을 통째로 돌린다 (칼자루를 쥔 손은 칼과 함께 돈다) */
const WT_BALL: Pose = OR({ hx: -1, hy: -27, tl: 18, hd: 10, lFx: 6, lFy: -34, lBx: 2, lBy: -32 });
/** 한 바퀴를 다 돌며 몸을 편다 (떨어지는 자세로) */
const WT_OPEN: Pose = OR({ hy: -25, tl: 12 - 360, hd: 13, lFx: 4, lFy: -3, lBx: -3, lBy: -2 });

/** 벽 낙법: 부딪힘 → 뒷무릎을 당겨 → 정면을 뒤로 밂 → 웅크린 채 뒤로 한 바퀴 → 몸을 편다. 13프레임 */
export const OSCAR_WALL_TECH: MotionData = {
  name: 'oscar/wall_tech',
  label: '오스카 벽 낙법',
  dur: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],
  keys: [
    { at: 0, pose: WT_HIT },
    { at: 1, pose: WT_COIL },
    { at: 2, pose: WT_PUSH },
    { at: 3, pose: spin(WT_BALL, -80) },
    { at: 5, pose: spin(WT_BALL, -170) },
    { at: 6, pose: spin(WT_BALL, -250) },
    { at: 8, pose: spin(WT_BALL, -320) },
    { at: 10, pose: WT_OPEN },
    { at: 12, pose: WT_OPEN },
  ],
};

// ---- 벽 박차기 공격 (벽은 뒤. 벽을 밀고 바라보는 쪽 아래 대각선으로 날아가며 칼을 살짝 뽑아, 앞 아래 허공에 검격을 낸다) ----
/*
 * 기술 수치(판정 4~9프레임, 3~9프레임 동안 날아감)는 기본 스틱맨 벽 박차기 공격 그대로라 프레임 수(13)와 표시 틱도 같다.
 * 오스카는 발로 차지 않는다: 몸을 낮게 눕혀 미끄러지듯 날며, 판정은 생겨난 검격 자리 (data/characters/oscar.ts의 box).
 */
/** 붙은 채 뒷손으로 칼집 입구를 잡고, 아래 앞쪽 상대를 본다 */
const WK_COIL: Pose = OD({ hx: -2, hy: -22, tl: 14, hd: 20, lFx: 4, lFy: -6, lBx: -7, lBy: -10 });
/** 더 웅크린다 (멈칫) */
const WK_SQUASH: Pose = OD({ hx: -2.5, hy: -20, tl: 20, hd: 22, lFx: 3, lFy: -7, lBx: -7, lBy: -9 }, 1);
/** 뒷발 끝으로 벽을 밀어 나간다: 몸을 앞 아래로 눕힌다 */
const WK_PUSH: Pose = OD({ hx: 2, hy: -21, tl: 34, hd: 12, lFx: 4, lFy: -5, lBx: -12, lBy: -10 }, 2);
/** 칼을 살짝 뽑는다 (8px): 몸은 날아가는 자세 그대로, 다리를 모아 뒤로 끈다 */
const WK_DRAW: Pose = OD({ hx: 2, hy: -21, tl: 40, hd: 8, lFx: -1, lFy: -6, lBx: -8, lBy: -10 }, 8);
/** 뽑은 채 날아간다 */
const WK_FLY: Pose = OD({ hx: 2, hy: -21, tl: 42, hd: 8, lFx: -2, lFy: -6, lBx: -9, lBy: -10 }, 8);
/** 날아가는 끝: 칼을 반쯤 밀어 넣는다 */
const WK_END: Pose = OD({ hx: 1, hy: -22, tl: 30, hd: 10, lFx: 2, lFy: -6, lBx: -6, lBy: -8 }, 4);
/** 칼을 다 넣고 몸을 세운다 */
const WK_SHEATHE: Pose = OR({ hx: 0, hy: -24, tl: 16, hd: 12, lFx: 4, lFy: -6, lBx: -3, lBy: -5 });

/** 벽 박차기 공격: 웅크림 → 벽을 밀고 나감 → 4~9프레임 칼을 살짝 뽑은 채 날아감(검격 판정) → 납도하며 낙하로. 13프레임 */
export const OSCAR_WALL_KICK: MotionData = {
  name: 'oscar/wall_kick',
  label: '오스카 벽 박차기 공격',
  wide: true,
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: WK_COIL },
    { at: 1, pose: WK_SQUASH, stop: true },
    { at: 2, pose: WK_PUSH },
    { at: 3, pose: WK_DRAW },
    { at: 6, pose: WK_FLY },
    { at: 8, pose: WK_END, stop: true },
    { at: 10, pose: WK_SHEATHE },
    { at: 12, pose: WJ_OPEN },
  ],
};

export const OSCAR_WALL_MOTIONS: readonly MotionData[] = [OSCAR_WALL_CLING, OSCAR_WALL_JUMP, OSCAR_WALL_RUN, OSCAR_WALL_KICK, OSCAR_WALL_TECH];
