import type { MotionData } from '../../../anim/motion';
import { E, E_STANCE } from './stance';

/*
 * 백은우 방어·방어 막힘: 연검을 쥔 앞팔을 얼굴 앞으로 비스듬히 들어 칼날을 몸 앞에 늘어뜨려 막는다 (리본처럼 늘어진 칼날이 방패).
 * 뒷손은 앞팔을 받친다. 라이덴처럼 웅크리지 않고, 몸을 살짝 뒤로 젖혀 흘려 낸다.
 */

/** 막기: 앞팔을 얼굴 앞으로 들고 뒷손은 앞팔 밑을 받친다, 몸을 살짝 뒤로 젖히고 무릎을 굽힌다 */
const COVER = E({ hx: -1, hy: -19.5, tl: -4, hd: 6, aFx: 8, aFy: -9, aBx: 7, aBy: -2, lFx: 9, lBx: -10 });
/** 막힌 순간: 충격을 흘리며 몸이 뒤로 크게 젖혀진다 (유연하게) */
const COVER_HIT = E({ hx: -4, hy: -20, tl: -14, hd: 12, aFx: 6, aFy: -11, aBx: 6, aBy: -4, lFx: 9, lBx: -11 });
/** 젖혀진 몸을 되돌려 다시 막는다 */
const COVER_BRACE = E({ hx: -1.5, hy: -18.5, tl: 0, hd: 6, aFx: 8, aFy: -8, aBx: 7, aBy: -1, lFx: 9, lBx: -10 });

/** 방어: 기본자세 → 4프레임 만에 막기 자세 → 그대로 (sim은 마지막 프레임에 머문다). 12프레임 × 1틱 */
export const EUNWOO_GUARD: MotionData = {
  name: 'eunwoo/guard',
  label: '백은우 방어',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 3, pose: COVER, stop: true },
    { at: 11, pose: COVER },
  ],
};

/** 방어 막힘: 몸이 뒤로 크게 젖혀짐 → 되돌려 막기. 12프레임 (sim은 막힌 경직 길이에 맞춰 늘인다) */
export const EUNWOO_GUARD_HIT: MotionData = {
  name: 'eunwoo/guard_hit',
  label: '백은우 방어 막힘',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: COVER_HIT },
    { at: 2, pose: COVER_HIT, stop: true },
    { at: 7, pose: COVER_BRACE, stop: true },
    { at: 11, pose: COVER },
  ],
};

export const EUNWOO_GUARD_MOTIONS: readonly MotionData[] = [EUNWOO_GUARD, EUNWOO_GUARD_HIT];
