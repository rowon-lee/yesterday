import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/** 내려앉은 자세: 무릎을 더 굽히고 팔이 따라 내려간다 */
const DIP: Pose = {
  ...STANCE,
  hy: -17.5, tl: 13, hd: 3,
  aFx: 10.5, aFy: 8.5, aBy: 14,
};

/** 대기. 제자리에서 가볍게 들썩인다. 12프레임 × 4틱 = 0.8초에 한 번. */
export const IDLE: MotionData = {
  name: 'base/idle',
  label: '대기',
  loop: true,
  dur: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  keys: [
    { at: 0, pose: STANCE },
    { at: 6, pose: DIP },
    { at: 12, pose: STANCE },
  ],
};
