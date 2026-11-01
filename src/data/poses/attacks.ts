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

// ---- 차지 (공격 길게 눌렀다 떼기): 정권 지르기 ----
/** 주먹을 몸 옆 허리로 당겨 감는다 (팔꿈치는 뒤로). 반대 손은 앞으로 뻗어 겨누고, 앞굽이로 낮게 버틴다. 몸은 젖히지 않는다 */
const CH_COIL = P({ hx: -1, hy: -18, tl: 6, hd: 0, aFx: -4, aFy: 13, aBx: 13, aBy: 1, lFx: 12, lBx: -12 });
/** 모으는 동안 (되풀이): 조금 더 낮게 버티며 */
const CH_GATHER_A = P({ hx: -1, hy: -17, tl: 6, hd: 0, aFx: -4, aFy: 13, aBx: 13, aBy: 2, lFx: 12, lBx: -12 });
/** 힘을 눌러 담으며 몸이 떨린다 (1px 안쪽으로 오르내림) */
const CH_GATHER_B = P({ hx: -2, hy: -18, tl: 7, hd: 1, aFx: -5, aFy: 12, aBx: 12, aBy: 1, lFx: 12, lBx: -12 });
const CH_GATHER_C = P({ hx: -1, hy: -17, tl: 6, hd: 0, aFx: -4, aFy: 12, aBx: 13, aBy: 2, lFx: 12, lBx: -13 });
/** 뗀다: 허리를 앞으로 밀며 내디딘다. 주먹은 허리를 떠나 곧게 앞으로, 뻗었던 손은 거두기 시작 */
const CH_STEP = P({ hx: 2, hy: -18, tl: 10, hd: -1, aFx: 3, aFy: 10, aBx: 8, aBy: 6, lFx: 15, lBx: -11 });
/** 정권 지르기: 앞팔을 어깨 높이로 곧게 뻗어 가슴을 치고, 반대 주먹은 허리로 당긴다 (앞굽이) */
const CH_HIT = P({ hx: 4, hy: -18, tl: 12, hd: -2, aFx: 18, aFy: 0, aBx: -4, aBy: 13, lFx: 18, lBx: -12 });
/** 뻗은 채 멈칫 (끊어 치기) */
const CH_HOLD = P({ hx: 4, hy: -17, tl: 12, hd: -2, aFx: 18, aFy: 1, aBx: -4, aBy: 13, lFx: 18, lBx: -12 });
/** 주먹을 거두며 몸을 일으킨다 */
const CH_RECOIL = P({ hx: 2, hy: -19, tl: 10, hd: 0, aFx: 11, aFy: 5, aBx: 2, aBy: 11, lFx: 13, lBx: -10 });

/**
 * 차지: 공격을 길게 누르면(평타 뒤에) 모으기로 넘어가고, 떼면 정권으로 곧게 지른다. 기본 스틱맨의 기본형.
 * 1~4프레임은 주먹을 허리로 당겨 감음(한 번), 5~8프레임은 누르고 있는 동안 되풀이, 떼면 9~14프레임 (11~12프레임 판정).
 * 단계·날리기는 기술 데이터, 몸이 빛나는 것은 렌더. 앞으로 내딛는 것은 sim (기술 데이터의 step).
 */
export const CHARGE: MotionData = {
  name: 'base/charge',
  label: '차지',
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 1, 2, 2, 2, 5, 6],
  keys: [
    { at: 0, pose: STANCE },
    { at: 3, pose: CH_COIL, stop: true },
    { at: 4, pose: CH_GATHER_A, stop: true },
    { at: 6, pose: CH_GATHER_B, stop: true },
    { at: 7, pose: CH_GATHER_C, stop: true },
    { at: 8, pose: CH_STEP },
    { at: 10, pose: CH_HIT, stop: true },
    { at: 11, pose: CH_HOLD, stop: true },
    { at: 12, pose: CH_RECOIL },
    { at: 13, pose: STANCE },
  ],
};

export const ATTACK_MOTIONS: MotionData[] = [DASH_ATTACK, CHARGE];
