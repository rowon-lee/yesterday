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

/** 해머를 어깨에서 든다: 앞손이 먼저 가슴 앞으로 나오고 해머 머리는 아직 어깨 뒤에 처진다 (뒷손은 아직 주머니) */
const G_LIFT = E({ hx: -0.5, hy: -21.8, tl: 0, hd: -2, aFx: 7, aFy: 4, lFx: 7.5, lBx: -8, wa: -138 });
/** 손잡이를 몸 앞으로 끌어내린다: 뒷손이 주머니에서 빠져 한 번에 손잡이를 잡고, 무릎이 굽기 시작한다. 머리는 머리 위를 지나 손을 뒤따른다 */
const G_SWING = grip2(E({ hx: -1, hy: -20.8, tl: 5, hd: 3, aFx: 8, aFy: 10, lFx: 8.5, lBx: -10, wa: -112 }), -9);
/** 머리 무게에 손잡이가 앞으로 넘어간다 (지나치기): 몸이 그 무게에 끌려 숙고 엉덩이가 내려앉는다 */
const G_TIP = grip2(E({ hx: -0.5, hy: -19.6, tl: 11, hd: 7, aFx: 8.5, aFy: 13, lFx: 9, lBx: -11, wa: -74 }), -9);
/** 버텨 되세운다: 가장 낮게 내려앉는다 (2px) */
const G_SINK = grip2(E({ hx: -1, hy: -18.8, tl: 10, hd: 6, aFx: 8, aFy: 13.5, lFx: 9, lBx: -11, wa: -90 }), -9);
/** 한 번 숨을 고르며 자리 잡는다 */
const G_SET = grip2(E({ hx: -1, hy: -19.6, tl: 8.5, hd: 6, aFx: 8, aFy: 13, lFx: 9, lBx: -11, wa: -87 }), -9);

/**
 * 방어 (2차 리워크): 기본자세 → 손이 먼저 해머를 어깨에서 들고 (머리는 처진다) → 몸 앞으로 끌어내려 →
 * 머리 무게에 손잡이가 앞으로 넘어갔다가 (지나치기, 몸이 끌려 숙인다) → 버텨 세우며 2px 내려앉고 → 숨을 고르며 막기 자세.
 * sim은 마지막 프레임에 머문다. 7프레임 12틱 (같은 자세를 늘어놓던 12장 × 1틱 대신, 무게가 실리는 박자만큼)
 */
export const EDWARD_GUARD: MotionData = {
  name: 'edward/guard',
  label: '에드워드 방어',
  dur: [1, 1, 1, 1, 2, 2, 4],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: G_LIFT },
    { at: 2, pose: G_SWING },
    { at: 3, pose: G_TIP },
    { at: 4, pose: G_SINK, stop: true },
    { at: 5, pose: G_SET },
    { at: 6, pose: BLOCK },
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
