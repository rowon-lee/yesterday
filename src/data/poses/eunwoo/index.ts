import type { MotionData } from '../../../anim/motion';
import { EUNWOO_AIR_MOTIONS } from './air';
import { EUNWOO_ATTACK_MOTIONS } from './attack';
import { EUNWOO_GUARD_MOTIONS } from './guard';
import { EUNWOO_MOVE_MOTIONS } from './move';
import { EUNWOO_SHOW_MOTIONS } from './show';
import { EUNWOO_SKILL_MOTIONS } from './skill';
import { EUNWOO_WALL_MOTIONS } from './wall';

/** 백은우 전용 동작 */
export const EUNWOO_MOTIONS: readonly MotionData[] = [
  ...EUNWOO_MOVE_MOTIONS, ...EUNWOO_AIR_MOTIONS, ...EUNWOO_GUARD_MOTIONS, ...EUNWOO_SHOW_MOTIONS, ...EUNWOO_WALL_MOTIONS,
  ...EUNWOO_ATTACK_MOTIONS, ...EUNWOO_SKILL_MOTIONS,
];
