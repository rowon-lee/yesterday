import { EDWARD_CELL, type MotionData } from '../../../anim/motion';
import { EDWARD_AIR_MOTIONS } from './air';
import { EDWARD_ATTACK_MOTIONS } from './attack';
import { EDWARD_GUARD_MOTIONS } from './guard';
import { EDWARD_MOVE_MOTIONS } from './move';
import { EDWARD_SHOW_MOTIONS } from './show';
import { EDWARD_SKILL_MOTIONS } from './skill';
import { E_SCALE } from './stance';
import { EDWARD_WALL_MOTIONS } from './wall';

/** 필살기 연출 속 상대 반응 동작: 상대 몸으로 그리므로 키우지 않는다 */
const OPPONENT: ReadonlySet<string> = new Set(['edward/super_lifted', 'edward/super_drained', 'edward/super_dropped']);

/**
 * 에드워드 전용 동작. 모두 몸 크기 배율 E_SCALE로 키우고 (키 약 58px, 2026-11-02 피드백 12-0), 에드워드 칸 144×108에 그린다
 * (키운 몸과 회색 워 해머는 128×96도 넘는다: anim/motion.ts EDWARD_CELL. 칸끼리는 발밑을 맞춰 바꿔 그린다). 상대 반응 동작만 그대로
 */
export const EDWARD_MOTIONS: readonly MotionData[] = [
  ...EDWARD_MOVE_MOTIONS, ...EDWARD_AIR_MOTIONS, ...EDWARD_GUARD_MOTIONS, ...EDWARD_SHOW_MOTIONS, ...EDWARD_WALL_MOTIONS, ...EDWARD_ATTACK_MOTIONS, ...EDWARD_SKILL_MOTIONS,
].map((m) => (OPPONENT.has(m.name) ? m : { ...m, scale: E_SCALE, wide: true, cell: EDWARD_CELL }));
