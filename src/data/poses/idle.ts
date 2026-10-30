import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/** 숨을 내쉰 자세: 엉덩이가 내려가고 몸통이 숙여지고 팔이 처진다. */
const EXHALE: Pose = {
  ...STANCE,
  hy: -20.1, tl: 7.2, hd: 3,
  aFx: 7.6, aFy: -3.2, aBy: -1,
};

/** 대기. 12프레임 × 5틱 = 1초에 한 번 숨쉬기. */
export const IDLE: MotionData = {
  name: 'base/idle',
  label: '대기',
  loop: true,
  dur: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  keys: [
    { at: 0, pose: STANCE },
    { at: 6, pose: EXHALE },
    { at: 12, pose: STANCE },
  ],
};
