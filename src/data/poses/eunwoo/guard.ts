import type { MotionData } from '../../../anim/motion';
import { E, E_STANCE } from './stance';

/*
 * 백은우 방어·방어 막힘 (1차본 피드백 11-1 2026-11-02): 연검을 몸 앞에서 빠르게 돌려 지름 약 36px 은빛 원형 방패를 만든다.
 * 연검 쥔 앞손을 가슴 앞으로 내밀어 원의 가운데에 두고, 뒷손은 뒤로 벌려 균형, 무릎을 굽혀 몸을 조금 뒤로 젖힌다
 * (대기와 실루엣이 확실히 다르다: 앞으로 내민 팔 + 둥근 원). 원은 동작 그림이 호 세 개로 그리고, 막는 동안 렌더가 빛을 돌린다.
 */

/** 손을 들어 올리며 연검을 한 바퀴 휘감는다 */
const RAISE = E({ hx: -1.5, hy: -21.5, tl: 0, hd: 4, aFx: 9, aFy: 4, aBx: -6, aBy: 10, lFx: 8, lBx: -8 });
const WHIRL = E({ hx: -2, hy: -20.5, tl: -3, hd: 6, aFx: 13, aFy: -6, aBx: -8, aBy: 6, lFx: 9, lBx: -9 });
/** 막기: 앞손을 가슴 앞으로 내밀어 원의 가운데, 뒷손은 뒤로, 무릎을 굽히고 몸을 조금 뒤로 */
const COVER = E({ hx: -2, hy: -20, tl: -4, hd: 6, aFx: 11, aFy: -3, aBx: -9, aBy: 7, lFx: 9, lBx: -10 });
/** 막힌 순간: 충격을 흘리며 몸이 뒤로 젖혀진다 (원은 그대로 앞에) */
const COVER_HIT = E({ hx: -4.5, hy: -20.5, tl: -13, hd: 12, aFx: 10, aFy: -5, aBx: -10, aBy: 4, lFx: 9, lBx: -11 });
/** 젖혀진 몸을 되돌려 다시 막는다 */
const COVER_BRACE = E({ hx: -2.5, hy: -19.5, tl: -2, hd: 6, aFx: 11, aFy: -2, aBx: -9, aBy: 7, lFx: 9, lBx: -10 });

/** 원형 방패 프레임 (가운데 = 손, 지름 37) */
const DISC = { r: 18, frames: [3, 4, 5, 6, 7, 8, 9, 10, 11] };

/** 방어: 기본자세 → 손을 들며 휘감음 → 4프레임부터 은빛 원 → 그대로 (sim은 마지막 프레임에 머문다). 12프레임 × 1틱 */
export const EUNWOO_GUARD: MotionData = {
  name: 'eunwoo/guard',
  label: '백은우 방어',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: RAISE },
    { at: 2, pose: WHIRL },
    { at: 3, pose: COVER, stop: true },
    { at: 11, pose: COVER },
  ],
  follow: { ribbon: { disc: DISC, stiff: 0.5 } },
};

/** 방어 막힘: 몸이 뒤로 젖혀짐 → 되돌려 막기, 원은 내내 앞에. 12프레임 (sim은 막힌 경직 길이에 맞춰 늘인다) */
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
  follow: { ribbon: { disc: { r: 18, frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] } } },
};

export const EUNWOO_GUARD_MOTIONS: readonly MotionData[] = [EUNWOO_GUARD, EUNWOO_GUARD_HIT];
