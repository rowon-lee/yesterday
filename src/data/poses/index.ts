import type { MotionData } from '../../anim/motion';
import { IDLE } from './idle';
import { INTRO } from './intro';
import { TEMP_COMMON, TEMP_MOVES } from './temp';
import { WALL_MOTIONS } from './wall';

/** 모든 동작 데이터. 뷰어와 시트 출력은 이 순서로 보여 준다. */
export const MOTION_DATA: readonly MotionData[] = [IDLE, ...TEMP_COMMON, ...WALL_MOTIONS, INTRO, ...TEMP_MOVES];
