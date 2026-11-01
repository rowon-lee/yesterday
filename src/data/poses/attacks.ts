import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/*
 * 공격 버튼의 새 동작 (기획서 '조작과 전투 시스템', 2026-11-01). 기본 스틱맨의 기본형이다. 하나씩 만들어 GIF로 승인받는다.
 * 오른쪽을 보는 기준.
 */

const P = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o });

// ---- 대시 공격 ----
/** 대시하던 자세 그대로 (임시 '지상 대시'의 앞으로 쏠린 자세와 같다): 대시 도중에 이어지므로 여기서 시작한다 */
const DA_ENTRY = P({ hx: 3, hy: -17, tl: 32, hd: -12, aFx: -2, aFy: 8, aBx: -8, aBy: 6, lFx: 16, lBx: -15, lBy: -3 });
/** 미끄러지며 몸을 더 낮춘다: 앞발을 멀리 내딛고 뒷발은 끌리고, 앞주먹은 가슴께로 당겨 감고 뒷손은 앞으로 */
const DA_COIL = P({ hx: 1, hy: -15, tl: 34, hd: -14, aFx: -3, aFy: 5, aBx: 8, aBy: 3, lFx: 19, lBx: -15 });
/** 낮게 내지른다: 앞팔을 쭉 뻗어 상대 몸통 높이를 치고, 뒷손은 허리로 당긴다. 앞무릎은 깊이 굽고 뒷다리는 길게 (주먹이 칸 안에 들게) */
const DA_HIT = P({ hx: 2, hy: -14, tl: 34, hd: -12, aFx: 18, aFy: 1, aBx: -8, aBy: 9, lFx: 20, lBx: -16 });
/** 뻗은 채 조금 더 미끄러진다 (멈칫) */
const DA_HOLD = P({ hx: 3, hy: -14, tl: 33, hd: -11, aFx: 17, aFy: 2, aBx: -8, aBy: 9, lFx: 20, lBx: -15 });
/** 팔을 거두며 몸을 일으킨다: 뒷발을 앞으로 끌어온다 */
const DA_RECOIL = P({ hx: 3, hy: -17, tl: 24, hd: -6, aFx: 12, aFy: 4, aBx: -4, aBy: 8, lFx: 15, lBx: -11 });

/**
 * 대시 공격: 앞으로 대시하는 중에 공격하면 나간다 (뒤로 대시하는 중이면 대시가 끝난 뒤 평타).
 * 대시 도중에 이어지므로 대시하던 자세에서 시작해 기본자세로 끝난다. 미끄러지는 힘을 실어 몸을 낮추고(1~5프레임),
 * 앞팔을 낮게 쭉 내지른다(6~7프레임 판정), 팔을 거두며 일어선다(8~13프레임). 앞으로 미끄러지는 것은 sim (기술 데이터의 step).
 */
export const DASH_ATTACK: MotionData = {
  name: 'base/dash_attack',
  label: '대시 공격',
  dur: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: DA_ENTRY },
    { at: 3, pose: DA_COIL },
    { at: 5, pose: DA_HIT, stop: true },
    { at: 7, pose: DA_HOLD, stop: true },
    { at: 9, pose: DA_RECOIL },
    { at: 12, pose: STANCE },
  ],
};

export const ATTACK_MOTIONS: MotionData[] = [DASH_ATTACK];
