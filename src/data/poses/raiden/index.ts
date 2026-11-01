import type { MotionData } from '../../../anim/motion';
import { RAIDEN_AIR_MOTIONS } from './air';
import { RAIDEN_EXHAUST } from './exhaust';
import { RAIDEN_ATTACK_MOTIONS } from './attack';
import { RAIDEN_GUARD_MOTIONS } from './guard';
import { RAIDEN_MOVE_MOTIONS } from './move';
import { RAIDEN_SHOW_MOTIONS } from './show';
import { RAIDEN_WALL_MOTIONS } from './wall';

/** 라이덴 전용 동작 */
export const RAIDEN_MOTIONS: readonly MotionData[] = [...RAIDEN_MOVE_MOTIONS, ...RAIDEN_AIR_MOTIONS, ...RAIDEN_GUARD_MOTIONS, ...RAIDEN_SHOW_MOTIONS, ...RAIDEN_WALL_MOTIONS, ...RAIDEN_ATTACK_MOTIONS, RAIDEN_EXHAUST];
