import { BASE_STATS } from './base';
import { RAIDEN } from './raiden';
import type { CharacterData, MotionSlot } from './types';

export type { CharacterData, MotionSlot, Stats } from './types';

/** 기본 스틱맨의 동작 그림 자리 (캐릭터가 자기 동작을 넣지 않은 자리는 이것을 쓴다) */
export const BASE_MOTION_SLOTS: Record<MotionSlot, string> = {
  idle: 'base/idle',
  intro: 'base/intro',
  win: 'base/win',
  run_f: 'base/run_f',
  run_b: 'base/run_b',
  jump: 'base/jump',
  jump2: 'base/jump2',
  fall: 'base/fall',
  land: 'base/land',
  dash: 'base/dash',
  air_dash: 'base/air_dash',
  guard: 'base/guard',
  guard_hit: 'base/guard_hit',
  wall_cling: 'base/wall_cling',
  wall_jump: 'base/wall_jump',
  wall_run: 'base/wall_run',
  wall_tech: 'base/wall_tech',
};

/** 기본 스틱맨: 시스템 확인용 (전용 동작 대신 기본형) */
const BASE: CharacterData = { id: 'base', label: '기본 스틱맨', stats: { ...BASE_STATS }, motions: { ...BASE_MOTION_SLOTS } };

export const CHARACTERS = {
  base: BASE,
  raiden: RAIDEN,
} as const satisfies Record<string, CharacterData>;
export type CharId = keyof typeof CHARACTERS;
