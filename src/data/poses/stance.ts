import type { Pose } from '../../anim/pose';

/** 기본자세 (서기). 모든 동작이 여기서 시작해 여기로 끝난다. */
export const STANCE: Pose = {
  hx: 0, hy: -21, tl: 6, hd: 4,
  aFx: 8, aFy: -4, aBx: 5, aBy: -2,
  lFx: 7, lFy: 0, lBx: -7, lBy: 0,
};
