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

/** 원이 만들어지는 순간: 손을 한 번 더 앞으로 밀어 원을 세운다 (지나치기) */
const COVER_PUSH = E({ hx: -1.5, hy: -20.5, tl: -1.5, hd: 5, aFx: 12.5, aFy: -4, aBx: -9, aBy: 7, lFx: 9, lBx: -10 });
/** 되돌아와 자리 잡는다 */
const COVER_SET = E({ hx: -2.3, hy: -19.8, tl: -5, hd: 6.5, aFx: 10.5, aFy: -2.5, aBx: -9.3, aBy: 7.3, lFx: 9, lBx: -10 });
/** 원을 돌리며 버티는 동안 숨: 어깨가 조금 오르내린다 */
const COVER_BREATH = E({ hx: -2, hy: -20.6, tl: -3.5, hd: 5.5, aFx: 11, aFy: -3.6, aBx: -8.8, aBy: 6.6, lFx: 9, lBx: -10 });

/**
 * 방어 (2차 리워크): 기본자세 → 손을 들며 휘감음 → 4프레임부터 은빛 원 → 손을 한 번 더 밀어 원을 세웠다(지나치기) 되돌아와 자리 잡고,
 * 원을 돌리는 동안 숨을 쉰다 (몸이 멈추지 않는다, 3장 백은우). 10프레임 12틱 (sim은 마지막 프레임에 머문다).
 * 은빛 원은 프레임마다 38°씩 돌고, 막는 동안 렌더가 빛을 돌린다
 */
export const EUNWOO_GUARD: MotionData = {
  name: 'eunwoo/guard',
  label: '백은우 방어',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: RAISE },
    { at: 2, pose: WHIRL },
    { at: 3, pose: COVER_PUSH },
    { at: 4, pose: COVER_SET, stop: true },
    { at: 5, pose: COVER },
    { at: 6, pose: COVER_BREATH },
    { at: 7, pose: COVER },
    { at: 8, pose: COVER_BREATH },
    { at: 9, pose: COVER },
  ],
  follow: { ribbon: { disc: { r: 18, frames: [3, 4, 5, 6, 7, 8, 9] }, stiff: 0.5 } },
};

/** 막힌 힘에 한 번 더 밀려 가장 젖혀진다 */
const COVER_PUSHED = E({ hx: -5.5, hy: -20.8, tl: -16, hd: 14, aFx: 9.5, aFy: -5.5, aBx: -10.5, aBy: 3.5, lFx: 9, lBx: -11.5 });
/** 젖혀졌던 몸이 앞으로 돌아온다 */
const COVER_RECOIL = E({ hx: -3, hy: -20, tl: -6, hd: 8, aFx: 10.5, aFy: -3.5, aBx: -9.5, aBy: 6, lFx: 9, lBx: -10.5 });
/** 자리 잡는 중 */
const COVER_EASE = E({ hx: -2.2, hy: -19.8, tl: -3, hd: 6, aFx: 11, aFy: -2.5, aBx: -9, aBy: 7, lFx: 9, lBx: -10 });

/**
 * 방어 막힘 (2차 리워크): 몸이 뒤로 젖혀짐 → 한 번 더 밀림(멈칫) → 앞으로 돌아옴 → 버팀(멈칫) → 자리 잡음 → 막기, 원은 내내 앞에서 돈다.
 * 12프레임 × 1틱 → 8프레임 (sim은 막힌 경직 길이를 프레임 수로 고르게 나눈다: 표시 틱은 뷰어·시트용)
 */
export const EUNWOO_GUARD_HIT: MotionData = {
  name: 'eunwoo/guard_hit',
  label: '백은우 방어 막힘',
  dur: [2, 1, 2, 1, 2, 1, 2, 1],
  keys: [
    { at: 0, pose: COVER_HIT },
    { at: 1, pose: COVER_PUSHED, stop: true },
    { at: 2, pose: COVER_RECOIL },
    { at: 3, pose: COVER_BRACE, stop: true },
    { at: 4, pose: COVER_EASE },
    { at: 5, pose: COVER_BREATH },
    { at: 6, pose: COVER_SET },
    { at: 7, pose: COVER },
  ],
  follow: { ribbon: { disc: { r: 18, frames: [0, 1, 2, 3, 4, 5, 6, 7] } } },
};

export const EUNWOO_GUARD_MOTIONS: readonly MotionData[] = [EUNWOO_GUARD, EUNWOO_GUARD_HIT];
