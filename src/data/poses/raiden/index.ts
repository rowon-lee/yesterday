import type { MotionData } from '../../../anim/motion';
import { RAIDEN_MOVE_MOTIONS } from './move';

/** 라이덴 전용 동작 (하나씩 승인받아 더한다) */
export const RAIDEN_MOTIONS: readonly MotionData[] = [...RAIDEN_MOVE_MOTIONS];
