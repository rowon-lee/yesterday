import type { MotionData } from '../../../anim/motion';
import { O_STANCE, OD } from './stance';

/*
 * 오스카 방어·방어 막힘: 반쯤 뽑아 막기. 뒷손으로 칼집 입구를 잡고 앞손으로 칼을 4px 뽑아,
 * 드러난 칼날 밑동과 날밑으로 받는다. 무릎을 굽혀 몸을 낮추고 등을 조금 편다 (팔을 휘젓지 않는다).
 * 몸의 언어 (재수정 지침 3장): 정적과 순간. 칼은 한 프레임에 튀어나오고, 나머지는 멈춰 있다.
 */

/** 반쯤 뽑아 막기: 칼날 4px, 무릎을 굽혀 2.5px 낮추고 발을 벌린다 */
const PARRY = OD({ hx: -0.5, hy: -19.5, tl: 8, hd: 9, lFx: 8, lBx: -8 }, 4);
/** 막힌 순간: 충격에 몸이 뒤로 밀려 등이 펴지고 고개가 들린다, 칼이 2px 더 밀려 나온다 */
const PARRY_HIT = OD({ hx: -3, hy: -20.5, tl: 1, hd: 2, lFx: 8, lBx: -9 }, 6);
/** 버텨 다시 숙인다 */
const PARRY_BRACE = OD({ hx: -1, hy: -18.5, tl: 11, hd: 11, lFx: 8, lBx: -8.5 }, 4);

/** 방어 1: 뒷손이 칼집 입구를 잡고 앞손은 날밑으로 (몸은 아직 그대로, 고개만 든다) */
const G_GRIP = OD({ hx: 0.5, hy: -21.5, tl: 12, hd: 7, lFx: 6.5, lBx: -6.5 }, -1.5);
/** 방어 2 (스미어 1틱): 칼이 한 번에 7px 튀어나오고, 그 힘에 등이 펴지며 무릎이 꺾여 가장 낮게 내려앉는다 */
const G_SNAP = OD({ hx: -1, hy: -18.8, tl: 5, hd: 6, lFx: 8.5, lBx: -8.5, tw: 1 }, 7);
/** 방어 3: 칼이 3px 되들어가고 몸은 낮은 채 숨을 고른다 (다음 프레임에 1px 떠올라 막기 자세) */
const G_SET = OD({ hx: -0.5, hy: -18.7, tl: 9.5, hd: 10, lFx: 8, lBx: -8 }, 4.5);

/**
 * 방어 (2차 리워크): 기본자세 → 손이 칼집과 날밑을 잡는다 (몸은 멈춰 있다) → 한 프레임에 칼이 튀어나오며 가장 낮게 →
 * 되들어가며 자리 잡음 → 막기 자세. sim은 마지막 프레임에 머문다. 5프레임 12틱 (키 3개를 12장 × 1틱으로 늘이던 것 대신)
 */
export const OSCAR_GUARD: MotionData = {
  name: 'oscar/guard',
  label: '오스카 방어',
  dur: [1, 1, 1, 2, 7],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 1, pose: G_GRIP, stop: true },
    { at: 2, pose: G_SNAP },
    { at: 3, pose: G_SET, stop: true },
    { at: 4, pose: PARRY },
  ],
};

/**
 * 방어 막힘 (2차 리워크): 막힌 순간 (칼이 6px 밀려 나옴) → 한 번 더 크게 밀려 등이 젖혀지고 고개가 들림 (8px) → 무릎으로 받아 내려앉음 →
 * 버텨 숙임 → 막기 자세. 젖혀진 정점과 내려앉은 자세에 조금 머문다. 5프레임
 * (sim이 막힌 경직 길이를 프레임 수로 고르게 나누므로 박자는 자세 차이로 낸다: 표시 틱은 뷰어·시트용)
 */
export const OSCAR_GUARD_HIT: MotionData = {
  name: 'oscar/guard_hit',
  label: '오스카 방어 막힘',
  dur: [1, 2, 3, 2, 4],
  keys: [
    { at: 0, pose: PARRY_HIT },
    { at: 1, pose: OD({ hx: -4, hy: -19.3, tl: -7, hd: -9, lFx: 8, lBx: -9.5 }, 8) },
    { at: 2, pose: OD({ hx: -3, hy: -18.6, tl: 2, hd: 2, lFx: 8, lBx: -9.5 }, 6), stop: true },
    { at: 3, pose: PARRY_BRACE },
    { at: 4, pose: PARRY },
  ],
};

export const OSCAR_GUARD_MOTIONS: readonly MotionData[] = [OSCAR_GUARD, OSCAR_GUARD_HIT];
