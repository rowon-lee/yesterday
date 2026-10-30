import { nextRandom } from '../core/rng';
import { INPUT_BITS, type PlayerInput } from './input';
import type { SimState } from './state';

/**
 * CPU 조작. 아직 전투가 없으므로 아무 입력이나 일정 틱 동안 누르고 있는다.
 * 자체 시드 난수를 쓰므로 같은 시드면 같은 입력이 나온다.
 */
export interface CpuState {
  rng: number;
  input: PlayerInput;
  holdTicks: number;
}

export function createCpu(seed: number): CpuState {
  return { rng: seed | 0, input: 0, holdTicks: 0 };
}

export function cpuInput(cpu: CpuState, state: SimState, side: 0 | 1): PlayerInput {
  void state;
  void side;
  if (cpu.holdTicks <= 0) {
    let r = nextRandom(cpu.rng);
    cpu.input = r.value & ((1 << INPUT_BITS) - 1);
    r = nextRandom(r.seed);
    cpu.holdTicks = 1 + (r.value % 20);
    cpu.rng = r.seed;
  }
  cpu.holdTicks--;
  return cpu.input;
}
