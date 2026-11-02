import type { MotionData } from '../../../anim/motion';
import { EDWARD_AIR_MOTIONS } from './air';
import { EDWARD_ATTACK_MOTIONS } from './attack';
import { EDWARD_GUARD_MOTIONS } from './guard';
import { EDWARD_MOVE_MOTIONS } from './move';
import { EDWARD_SHOW_MOTIONS } from './show';
import { EDWARD_SKILL_MOTIONS } from './skill';
import { EDWARD_WALL_MOTIONS } from './wall';

/** 에드워드 전용 동작 */
export const EDWARD_MOTIONS: readonly MotionData[] = [
  ...EDWARD_MOVE_MOTIONS, ...EDWARD_AIR_MOTIONS, ...EDWARD_GUARD_MOTIONS, ...EDWARD_SHOW_MOTIONS, ...EDWARD_WALL_MOTIONS, ...EDWARD_ATTACK_MOTIONS, ...EDWARD_SKILL_MOTIONS,
];
