import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/*
 * 벽 기동 동작 (기획서 '벽 기동과 구조물'). 기본 스틱맨의 기본형이다. 하나씩 만들어 시트로 승인받는다.
 * 오른쪽을 보는 기준. 벽에 붙으면 벽을 등지고 바깥(벽 반대쪽)을 본다: 벽 면은 발밑 기준점에서 뒤로 7px
 * (sim의 벽에 붙는 거리 WALL_REACH). 벽 점프·벽 박차기 공격은 바라보는 쪽으로 나간다.
 */

const P = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o });

// ---- 벽 붙기 (벽은 뒤쪽 x = -7) ----
/** 등이 벽에 부딪힌다: 몸이 벽 쪽으로 젖혀지고, 뒷손이 벽을 치고, 앞팔은 앞으로 휘둘린다 */
const CL_HIT = P({ hx: -1, hy: -24, tl: -2, hd: -10, aFx: 9, aFy: -5, aBx: -7, aBy: 2, lFx: 6, lFy: -3, lBx: -6, lBy: -6 });
/** 부딪힌 힘을 받아 웅크린다 (멈칫): 뒷발이 벽을 딛고 무릎이 접힌다 */
const CL_SQUASH = P({ hx: -2, hy: -20, tl: 16, hd: 14, aFx: 7, aFy: 5, aBx: -8, aBy: -1, lFx: 6, lFy: -1, lBx: -6, lBy: -8 });
/** 붙은 자세: 벽을 등지고 웅크려 뒷손·뒷발로 벽을 짚고, 앞손은 앞으로 내밀고, 앞다리는 아래로 */
const CL_HOLD = P({ hx: -2, hy: -22, tl: 14, hd: 12, aFx: 6, aFy: 7, aBx: -9, aBy: -4, lFx: 5, lFy: -1, lBx: -6, lBy: -10 });
/** 미끄러지며 뒷손이 벽에 끌려 내려가고 뒷발이 미끄러진다 */
const CL_DRAG = P({ hx: -2, hy: -21, tl: 16, hd: 16, aFx: 7, aFy: 5, aBx: -9, aBy: 2, lFx: 6, lFy: 0, lBx: -6, lBy: -6 });
/** 뒷손을 다시 높이 짚고 뒷발을 다시 딛는다 (살짝 치켜 오름) */
const CL_REGRIP = P({ hx: -2, hy: -23, tl: 12, hd: 10, aFx: 7, aFy: 4, aBx: -9, aBy: -7, lFx: 5, lFy: -2, lBx: -6, lBy: -12 });

/**
 * 벽 붙기: 공중에서 벽 쪽을 누른 채 벽에 닿으면 벽을 등지고 붙어 천천히 미끄러진다.
 * 1~3프레임은 붙는 순간(등이 벽에 부딪혀 웅크림, 한 번), 4프레임은 붙은 자세, 5~13프레임은 미끄러지는 동안 되풀이한다 (sim/pose.ts).
 */
export const WALL_CLING: MotionData = {
  name: 'base/wall_cling',
  label: '벽 붙기',
  dur: [1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: CL_HIT },
    { at: 2, pose: CL_SQUASH, stop: true },
    { at: 3, pose: CL_HOLD },
    { at: 6, pose: CL_DRAG },
    { at: 9, pose: CL_REGRIP },
    { at: 12, pose: CL_HOLD },
  ],
};

/** 벽 붙기에서 되풀이하는 프레임 (0부터): 붙는 순간 뒤 */
export const WALL_CLING_LOOP_FROM = 4;

// ---- 벽 점프 (벽은 뒤쪽. 첫 프레임에는 이미 벽에서 4px쯤 떨어져 있다) ----
/** 두 발로 벽을 차며 몸을 앞으로 던진다: 다리는 뒤로 쭉, 몸은 앞으로 기울고 두 팔은 앞위로 */
const WJ_KICK = P({ hx: 3, hy: -21, tl: 38, hd: -12, aFx: 11, aFy: -8, aBx: 8, aBy: -4, lFx: -9, lFy: -9, lBx: -12, lBy: -3 });
/** 튕겨 나간다: 몸이 비스듬히 솟고 다리는 뒤에 끌리고 팔은 위로 뻗는다 */
const WJ_LAUNCH = P({ hx: 2, hy: -24, tl: 26, hd: -16, aFx: 8, aFy: -16, aBx: 3, aBy: -15, lFx: -6, lFy: -7, lBx: -10, lBy: -3 });
/** 솟으며 무릎을 끌어당겨 웅크린다 */
const WJ_TUCK = P({ hy: -26, tl: 18, hd: -2, aFx: 7, aFy: 2, aBx: 3, aBy: 5, lFx: 8, lFy: -16, lBx: 2, lBy: -14 });
/** 꼭대기 근처에서 몸을 펴며 앞을 본다 */
const WJ_OPEN = P({ hy: -24, tl: 6, hd: 2, aFx: 9, aFy: -6, aBx: -6, aBy: -4, lFx: 6, lFy: -5, lBx: -5, lBy: -2 });
/** 떨어지는 자세로 이어진다 (임시 '낙하'의 첫 자세와 같다) */
const WJ_FALL = P({ hy: -24, tl: 4, hd: 2, aFx: 9, aFy: -9, aBx: -7, aBy: -6, lFx: 6, lFy: -2, lBx: -6, lBy: -1 });

/**
 * 벽 점프: 벽에 붙은 채 점프하면 벽 반대쪽(바라보는 쪽)으로 비스듬히 튕겨 오른다.
 * 두 발로 벽을 차고(1~2프레임) → 비스듬히 솟고 → 무릎을 끌어당겼다가 → 꼭대기에서 몸을 펴 떨어지는 자세로 이어진다.
 */
export const WALL_JUMP: MotionData = {
  name: 'base/wall_jump',
  label: '벽 점프',
  dur: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: WJ_KICK },
    { at: 2, pose: WJ_LAUNCH },
    { at: 6, pose: WJ_TUCK, stop: true },
    { at: 10, pose: WJ_OPEN },
    { at: 13, pose: WJ_FALL },
  ],
};

// ---- 벽 달리기 (벽은 앞쪽 x = +7. 벽을 바라보며 달려 오른다) ----
/** 대시에서 이어져 앞발을 벽에 딛는다 */
const WR_PLANT = P({ hx: 0, hy: -20, tl: 16, hd: -6, aFx: -4, aFy: 8, aBx: 9, aBy: -6, lFx: 6, lFy: -14, lBx: -6, lBy: -1 });
/** 앞발을 높이 벽에 딛고 뒷다리로 밀어 올린다 (뒷팔은 앞위로, 앞팔은 뒤로) */
const WR_A = P({ hx: 0, hy: -24, tl: 10, hd: -14, aFx: -3, aFy: 6, aBx: 8, aBy: -12, lFx: 6, lFy: -22, lBx: 0, lBy: -4 });
/** 발을 바꿔 뒷발을 높이 벽에 딛는다 */
const WR_B = P({ hx: 0, hy: -24, tl: 10, hd: -14, aFx: 8, aFy: -12, aBx: -3, aBy: 6, lFx: 0, lFy: -4, lBx: 6, lBy: -22 });
/** 꼭대기 모서리를 두 손으로 잡는다 */
const WR_GRAB = P({ hx: 0, hy: -24, tl: 4, hd: -20, aFx: 5, aFy: -16, aBx: 3, aBy: -16, lFx: 4, lFy: -8, lBx: 1, lBy: -2 });
/** 팔로 밀어 몸을 끌어올리며 무릎을 당긴다 */
const WR_PULL = P({ hx: 2, hy: -28, tl: 24, hd: -4, aFx: 6, aFy: 4, aBx: 4, aBy: 6, lFx: 6, lFy: -20, lBx: 3, lBy: -16 });
/** 한 발을 윗면에 올리며 앞으로 넘어간다 */
const WR_OVER = P({ hx: 3, hy: -22, tl: 20, hd: -2, aFx: 9, aFy: 2, aBx: -2, aBy: 6, lFx: 9, lFy: -12, lBx: -4, lBy: -4 });

/**
 * 벽 달리기: 벽 쪽으로 대시해 벽에 닿으면 벽을 바라보며 발을 번갈아 딛고 달려 오른다 (1~10프레임, sim은 달리는 동안 이 구간).
 * 꼭대기가 닿으면 모서리를 잡고 끌어올려 윗면으로 넘어간다 (11~14프레임). 꼭대기에 못 닿으면 끝에서 벽 붙기로 이어진다.
 */
export const WALL_RUN: MotionData = {
  name: 'base/wall_run',
  label: '벽 달리기',
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
/** 벽 달리기에서 꼭대기를 넘어가는 프레임 (0부터): 이 앞까지가 달려 오르는 구간 */
export const WALL_RUN_TOP_FROM = 10;

/** 벽 기동 동작 (승인받은 순서대로 늘어난다) */
export const WALL_MOTIONS: MotionData[] = [WALL_CLING, WALL_JUMP, WALL_RUN];
