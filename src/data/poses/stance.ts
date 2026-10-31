import type { Pose } from '../../anim/pose';

/**
 * 기본자세 (서기). 모든 동작이 여기서 시작해 여기로 끝난다.
 * 방어 자세처럼 주먹을 얼굴 앞에 올리지 않고, 무릎을 굽혀 몸을 앞으로 싣고 손은 가볍게 내린다.
 */
export const STANCE: Pose = {
  hx: 0, hy: -20, tl: 10, hd: 2,
  aFx: 10, aFy: 6, aBx: 5, aBy: 12,
  lFx: 9, lFy: 0, lBx: -9, lBy: 0,
};
