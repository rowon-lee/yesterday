import type { MotionData } from '../../../anim/motion';
import { RAIDEN_AIR_MOTIONS } from './air';
import { RAIDEN_GUARD_MOTIONS } from './guard';
import { RAIDEN_MOVE_MOTIONS } from './move';
import { RAIDEN_SHOW_MOTIONS } from './show';

/** 라이덴 전용 동작 */
export const RAIDEN_MOTIONS: readonly MotionData[] = [...RAIDEN_MOVE_MOTIONS, ...RAIDEN_AIR_MOTIONS, ...RAIDEN_GUARD_MOTIONS, ...RAIDEN_SHOW_MOTIONS];
