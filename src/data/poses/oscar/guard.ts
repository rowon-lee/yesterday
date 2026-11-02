import type { MotionData } from '../../../anim/motion';
import { O_STANCE, OD } from './stance';

/*
 * 오스카 방어·방어 막힘: 반쯤 뽑아 막기. 뒷손으로 칼집 입구를 잡고 앞손으로 칼을 4px 뽑아,
 * 드러난 칼날 밑동과 날밑으로 받는다. 무릎을 굽혀 몸을 낮추고 등을 조금 편다 (팔을 휘젓지 않는다).
 */

/** 반쯤 뽑아 막기: 칼날 4px, 무릎을 굽혀 2.5px 낮추고 발을 벌린다 */
const PARRY = OD({ hx: -0.5, hy: -19.5, tl: 8, hd: 9, lFx: 8, lBx: -8 }, 4);
/** 막힌 순간: 충격에 몸이 뒤로 밀려 등이 펴지고 고개가 들린다, 칼이 2px 더 밀려 나온다 */
const PARRY_HIT = OD({ hx: -3, hy: -20.5, tl: 1, hd: 2, lFx: 8, lBx: -9 }, 6);
/** 버텨 다시 숙인다 */
const PARRY_BRACE = OD({ hx: -1, hy: -18.5, tl: 11, hd: 11, lFx: 8, lBx: -8.5 }, 4);

/** 방어: 기본자세 → 3프레임 만에 반쯤 뽑아 막기 → 그대로 버팀 (sim은 마지막 프레임에 머문다). 12프레임 × 1틱 */
export const OSCAR_GUARD: MotionData = {
  name: 'oscar/guard',
  label: '오스카 방어',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 3, pose: PARRY, stop: true },
    { at: 11, pose: PARRY },
  ],
};

/** 방어 막힘: 밀려 등이 펴짐 → 버텨 숙임 → 막기 자세. 12프레임 (sim은 막힌 경직 길이에 맞춰 늘인다) */
export const OSCAR_GUARD_HIT: MotionData = {
  name: 'oscar/guard_hit',
  label: '오스카 방어 막힘',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: PARRY_HIT },
    { at: 2, pose: PARRY_HIT, stop: true },
    { at: 6, pose: PARRY_BRACE, stop: true },
    { at: 11, pose: PARRY },
  ],
};

export const OSCAR_GUARD_MOTIONS: readonly MotionData[] = [OSCAR_GUARD, OSCAR_GUARD_HIT];
