import type { MotionData } from '../../anim/motion';
import { IDLE } from './idle';
import { INTRO } from './intro';
import { ATTACK_MOTIONS } from './attacks';
import { COMMON_MOTIONS } from './common';
import { SUPER_MOTIONS } from './super';
import { TEMP_COMMON, TEMP_MOVES } from './temp';
import { WALL_MOTIONS } from './wall';

/** 모든 동작 데이터. 뷰어와 시트 출력은 이 순서로 보여 준다. */
export const MOTION_DATA: readonly MotionData[] = [IDLE, ...COMMON_MOTIONS, ...TEMP_COMMON, ...WALL_MOTIONS, INTRO, ...TEMP_MOVES, ...ATTACK_MOTIONS, ...SUPER_MOTIONS];
