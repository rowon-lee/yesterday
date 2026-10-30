import type { PlayerInput } from './input';

/** 위치 단위: 1px = 256 */
export const SUBPX = 256;

export interface FighterState {
  x: number;
  y: number;
}

/** 직렬화 가능한 평범한 객체만 둔다. 통째로 저장·복원하면 롤백이 된다. */
export interface SimState {
  tick: number;
  /** 시드 난수 상태 (core/rng) */
  rng: number;
  fighters: [FighterState, FighterState];
  over: boolean;
}

export function createState(seed: number): SimState {
  return {
    tick: 0,
    rng: seed | 0,
    fighters: [
      { x: 100 * SUBPX, y: 0 },
      { x: 220 * SUBPX, y: 0 },
    ],
    over: false,
  };
}

/** 한 틱 진행. 아직 전투 규칙이 없으므로 틱만 센다. */
export function step(state: SimState, inputs: readonly [PlayerInput, PlayerInput]): void {
  void inputs;
  state.tick++;
}
