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

/** 들어가기: 어깨가 먼저 떨어지고 턱을 당긴다. 손은 이제 막 올라오기 시작 (재수정 지침 2장 '어깨가 먼저') */
const GUARD_IN = R({ hx: -1, hy: -18, tl: 18, hd: 11, aFx: 13, aFy: -5, aBx: 8, aBy: -1 });
/** 웅크려 눌림: 팔이 확 올라붙으며 커버보다 1~2px 더 깊이 숙인다 (지나쳤다가 커버로 자리 잡는다) */
const COVER_DEEP = R({ hx: -1.5, hy: -16, tl: 25, hd: 15, aFx: 9, aFy: -10, aBx: 8, aBy: -8, lFx: 9, lBx: -10 });

/**
 * 방어 (2차 리워크): 기본자세 → 어깨·턱 먼저 → 팔이 확 올라붙어 깊이 웅크림 → 커버로 자리 잡고 버팀.
 * 4프레임 12틱 (sim은 마지막 프레임에 머문다). 막는 자세로 빨리 들어가는 것 하나가 목적이라 버팀은 같은 자세를 늘어놓지 않고 dur로 잡는다
 */
export const RAIDEN_GUARD: MotionData = {
  name: 'raiden/guard',
  label: '라이덴 방어',
  dur: [1, 1, 2, 8],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: GUARD_IN },
    { at: 2, pose: COVER_DEEP },
    { at: 3, pose: COVER, stop: true },
  ],
};

/** 막힌 힘에 한 번 더 밀려 가장 젖혀진다 (발은 버틴 채) */
const COVER_PUSHED = R({ hx: -5, hy: -18.5, tl: 6, hd: 20, aFx: 6.5, aFy: -10.5, aBx: 5.5, aBy: -8.5, lFx: 9, lBx: -11.5 });
/** 버텨 몸을 다시 앞으로 실으며 숙인다 */
const COVER_REBOUND = R({ hx: -2.5, hy: -17, tl: 18, hd: 15, aFx: 8.5, aFy: -9, aBx: 7.5, aBy: -7, lFx: 9, lBx: -10.5 });
/** 자리 잡는 중 (버틴 자세에서 커버로 천천히) */
const COVER_EASE = R({ hx: -1.2, hy: -16.5, tl: 23.5, hd: 13.5, aFx: 9, aFy: -8.5, aBx: 8, aBy: -6.5, lFx: 9, lBx: -10 });

/**
 * 방어 막힘 (2차 리워크): 밀려 젖혀짐 → 한 번 더 밀림(가장 뒤) → 버텨 앞으로 실음 → 숙여 버팀(멈칫) → 커버로 자리 잡음.
 * 6프레임. sim은 막힌 경직 길이를 프레임 수로 고르게 나누므로(dur를 보지 않는다) 같은 자세를 늘어놓지 않고 프레임마다 다른 자세로
 */
export const RAIDEN_GUARD_HIT: MotionData = {
  name: 'raiden/guard_hit',
  label: '라이덴 방어 막힘',
  // 표시 틱은 뷰어·시트용
  dur: [2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: COVER_HIT },
    { at: 1, pose: COVER_PUSHED, stop: true },
    { at: 2, pose: COVER_REBOUND },
    { at: 3, pose: COVER_BRACE, stop: true },
    { at: 4, pose: COVER_EASE },
    { at: 5, pose: COVER },
  ],
};

export const RAIDEN_GUARD_MOTIONS: readonly MotionData[] = [RAIDEN_GUARD, RAIDEN_GUARD_HIT];
