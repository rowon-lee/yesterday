import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 방어·방어 막힘: MMA의 커버. 두 팔뚝을 세워 얼굴과 관자놀이를 감싸고, 팔꿈치를 모아 몸통을 막고,
 * 턱을 깊이 당겨 몸을 웅크린다 (기본자세의 앞손을 얼굴 앞으로 끌어당긴 꼴).
 */

/** 커버: 두 주먹을 이마 앞에 붙이고 팔꿈치를 모은다. 무릎을 더 굽히고 몸을 숙여 턱을 깊이 당긴다 */
const COVER = R({ hx: -1, hy: -17, tl: 22, hd: 14, aFx: 9, aFy: -9, aBx: 8, aBy: -7, lFx: 9, lBx: -10 });
/** 막힌 순간: 충격에 몸이 뒤로 밀려 젖혀지고 팔이 얼굴로 눌린다 */
const COVER_HIT = R({ hx: -4, hy: -18, tl: 10, hd: 18, aFx: 7, aFy: -10, aBx: 6, aBy: -8, lFx: 9, lBx: -11 });
/** 버텨 다시 숙인다 (몸을 한 번 흔든다) */
const COVER_BRACE = R({ hx: -1.5, hy: -16, tl: 25, hd: 13, aFx: 9, aFy: -8, aBx: 8, aBy: -6, lFx: 9, lBx: -10 });

/** 방어: 기본자세 → 4프레임 만에 커버 → 그대로 버팀 (sim은 마지막 프레임에 머문다). 12프레임 × 1틱 */
export const RAIDEN_GUARD: MotionData = {
  name: 'raiden/guard',
  label: '라이덴 방어',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: COVER, stop: true },
    { at: 11, pose: COVER },
  ],
};

/** 방어 막힘: 밀려 젖혀짐 → 버텨 다시 숙임 → 커버. 12프레임 (sim은 막힌 경직 길이에 맞춰 늘인다) */
export const RAIDEN_GUARD_HIT: MotionData = {
  name: 'raiden/guard_hit',
  label: '라이덴 방어 막힘',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: COVER_HIT },
    { at: 2, pose: COVER_HIT, stop: true },
    { at: 6, pose: COVER_BRACE, stop: true },
    { at: 11, pose: COVER },
  ],
};

export const RAIDEN_GUARD_MOTIONS: readonly MotionData[] = [RAIDEN_GUARD, RAIDEN_GUARD_HIT];
