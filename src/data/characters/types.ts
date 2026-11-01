import type { BASE_STATS } from './base';

/**
 * 상태(모드)에 맞는 동작 그림 자리. 캐릭터마다 자기 동작 이름을 넣고, 아직 없는 자리는 기본 스틱맨 동작을 쓴다.
 * 맞는 동작 7개(common/)는 모든 캐릭터가 같이 쓰므로 자리가 없다.
 */
export type MotionSlot =
  | 'idle' | 'intro' | 'win'
  | 'run_f' | 'run_b' | 'jump' | 'jump2' | 'fall' | 'land' | 'dash' | 'air_dash'
  | 'guard' | 'guard_hit'
  | 'wall_cling' | 'wall_jump' | 'wall_run' | 'wall_tech';

/** 능력치 (px, px/틱, 틱). 이름과 뜻은 기본 스틱맨(base.ts)과 같다 */
export type Stats = { -readonly [K in keyof typeof BASE_STATS]: number };

/** 캐릭터 하나: 능력치와 동작 그림 자리 (숫자 데이터만) */
export interface CharacterData {
  id: string;
  label: string;
  stats: Stats;
  motions: Partial<Record<MotionSlot, string>>;
}
