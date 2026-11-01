import type { Pose } from '../../../anim/pose';

/**
 * 백은우 기본자세 (캐릭터 기획서 '움직임': 사고 현장을 뛰어다니던 의사의 가볍고 유연한 몸).
 * 라이덴처럼 웅크린 가드가 아니라, 발끝에 무게를 싣고 가볍게 선다. 앞손은 연검을 낮게 앞으로 쥐어 칼끝이 늘어지고,
 * 뒷손은 허리 뒤로 가볍게 늘어뜨린다 (손가락을 튀겨 순간이동할 손). 발 간격 약 16px. 은우의 모든 동작이 여기서 시작해 여기로 끝난다.
 */
export const E_STANCE: Pose = {
  hx: 0, hy: -21.5, tl: 6, hd: 2,
  aFx: 11, aFy: 5, aBx: -4, aBy: 14,
  lFx: 8, lFy: 0, lBx: -8, lBy: 0,
};

/** 기본자세에서 바뀐 만큼만 적는다 */
export const E = (o: Partial<Pose>): Pose => ({ ...E_STANCE, ...o });
