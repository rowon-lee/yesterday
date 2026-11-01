import type { MotionData } from '../../../anim/motion';
import { OSCAR_AIR_MOTIONS } from './air';
import { OSCAR_ATTACK_MOTIONS } from './attack';
import { OSCAR_GUARD_MOTIONS } from './guard';
import { OSCAR_MOVE_MOTIONS } from './move';
import { OSCAR_SHOW_MOTIONS } from './show';
import { OSCAR_SKILL_MOTIONS } from './skill';
import { OSCAR_WALL_MOTIONS } from './wall';

/** 오스카 전용 동작 (필살기 상대 반응 'react/oscar_*' 포함) */
export const OSCAR_MOTIONS: readonly MotionData[] = [
  ...OSCAR_MOVE_MOTIONS, ...OSCAR_AIR_MOTIONS, ...OSCAR_GUARD_MOTIONS, ...OSCAR_SHOW_MOTIONS, ...OSCAR_WALL_MOTIONS,
  ...OSCAR_ATTACK_MOTIONS, ...OSCAR_SKILL_MOTIONS,
];
