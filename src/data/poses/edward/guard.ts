import type { MotionData } from '../../../anim/motion';
import { E, E_STANCE, grip2 } from './stance';

/*
 * 에드워드 방어·방어 막힘: 해머 손잡이를 두 손으로 몸 앞에 똑바로 세워 가로막는다 (해머 머리는 얼굴 앞).
 * 다리를 넓게 벌려 버티고 몸을 조금 숙인다. 막히면 손잡이째 밀려 젖혀졌다가 다시 버틴다.
 */

/** 막기: 손잡이를 몸 앞에 똑바로 세운다. 앞손은 허리 앞에서 손잡이 아래를, 뒷손은 가슴 앞에서 손잡이 위쪽을 쥐고, 해머 머리가 얼굴 앞을 가린다 */
const BLOCK = grip2(E({ hx: -1, hy: -20, tl: 8, hd: 6, aFx: 8, aFy: 13, lFx: 9, lBx: -11, wa: -86 }), -9);
/** 막힌 순간: 손잡이째 얼굴 쪽으로 밀리며 몸이 뒤로 젖혀진다 */
const BLOCK_HIT = grip2(E({ hx: -4, hy: -20.5, tl: -4, hd: 12, aFx: 6, aFy: 12, lFx: 9, lBx: -12, wa: -96 }), -9);
/** 다시 버틴다 (몸을 숙여 민다) */
const BLOCK_BRACE = grip2(E({ hx: -1.5, hy: -19, tl: 12, hd: 4, aFx: 9, aFy: 13, lFx: 9, lBx: -11, wa: -82 }), -9);

/** 방어: 기본자세 → 4프레임 만에 손잡이를 세워 막음 → 그대로 버팀 (sim은 마지막 프레임에 머문다). 12프레임 × 1틱 */
export const EDWARD_GUARD: MotionData = {
  name: 'edward/guard',
  label: '에드워드 방어',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 3, pose: BLOCK, stop: true },
    { at: 11, pose: BLOCK },
  ],
};

/** 방어 막힘: 밀려 젖혀짐 → 버텨 다시 숙임 → 막기. 12프레임 (sim은 막힌 경직 길이에 맞춰 늘인다) */
export const EDWARD_GUARD_HIT: MotionData = {
  name: 'edward/guard_hit',
  label: '에드워드 방어 막힘',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: BLOCK_HIT },
    { at: 2, pose: BLOCK_HIT, stop: true },
    { at: 6, pose: BLOCK_BRACE, stop: true },
    { at: 11, pose: BLOCK },
  ],
};

export const EDWARD_GUARD_MOTIONS: readonly MotionData[] = [EDWARD_GUARD, EDWARD_GUARD_HIT];
