import { nextRandom } from '../core/rng';
import { MOVES } from './frames';
import {
  IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT, IN_SKILL_A, IN_SKILL_B, IN_SUPER, IN_UP,
  type PlayerInput,
} from './input';
import { METER_BAR, METER_MAX, SUBPX, TECH_HITS } from './rules';
import type { Fighter, SimState } from './types';

/**
 * CPU 조작. 상태를 보고 입력을 만든다. 자체 시드 난수만 쓰므로 같은 시드·같은 상태면 같은 입력.
 * 반응 시간을 두고 계획(다가가기, 연타, 띄워서 공중 콤보, 방어 …)을 고른다.
 */
type Plan = 'approach' | 'retreat' | 'guard' | 'string' | 'launch' | 'sweep' | 'jumpIn' | 'dashIn' | 'skill' | 'super' | 'wait';

export interface CpuState {
  rng: number;
  plan: Plan;
  /** 이 계획을 유지할 남은 틱 */
  planT: number;
  /** 지난 틱에 낸 입력 (버튼은 떼었다 눌러야 다시 눌린다) */
  last: PlayerInput;
  /** 방어를 잘하는 정도 (0~100) */
  skill: number;
}

export function createCpu(seed: number, skill = 60): CpuState {
  return { rng: seed | 0, plan: 'wait', planT: 0, last: 0, skill };
}

function roll(cpu: CpuState, n: number): number {
  const r = nextRandom(cpu.rng);
  cpu.rng = r.seed;
  return r.value % n;
}

const NEUTRAL_GROUND = new Set(['idle', 'walk', 'guard', 'land', 'getup']);

export function cpuInput(cpu: CpuState, s: SimState, side: 0 | 1): PlayerInput {
  const me = s.fighters[side];
  const op = s.fighters[1 - side];
  let out = decide(cpu, s, me, op);
  // 버튼은 지난 틱에 눌렀으면 한 번 뗀다 (연타)
  const BTN = IN_ATTACK | IN_JUMP | IN_DASH | IN_SKILL_A | IN_SKILL_B | IN_SUPER;
  out = (out & ~BTN) | (out & BTN & ~cpu.last);
  cpu.last = out;
  return out;
}

function decide(cpu: CpuState, s: SimState, me: Fighter, op: Fighter): PlayerInput {
  if (s.phase !== 'fight') return 0;
  const dxRaw = op.x - me.x;
  const dist = Math.abs(dxRaw) / SUBPX;
  const fwd = dxRaw >= 0 ? IN_RIGHT : IN_LEFT;
  const back = dxRaw >= 0 ? IN_LEFT : IN_RIGHT;

  // 맞고 있을 때: 낙법이 되면 빠져나온다
  if (me.mode === 'airhit') return me.comboHits >= TECH_HITS && roll(cpu, 6) === 0 ? IN_JUMP : 0;

  // 기술 도중: 연타, 띄운 뒤 쫓아가기, 공중 콤보 마무리
  if (me.mode === 'attack' && me.move) {
    const id = me.move;
    if (id === 'launcher' && me.moveConnected) return IN_JUMP | fwd;
    if (MOVES[id].data.air) {
      if (id === 'air2' && me.moveConnected && roll(cpu, 3) === 0) return IN_ATTACK | IN_DOWN;
      if (op.mode === 'airhit' || dist < 40) return IN_ATTACK;
      return 0;
    }
    if (cpu.plan === 'string' || cpu.plan === 'launch') {
      if (id === 'atk2' && cpu.plan === 'launch') return IN_ATTACK | IN_UP;
      if (me.moveConnected && me.meter >= 2 * METER_BAR && me.meter < METER_MAX && id === 'atk4' && roll(cpu, 3) === 0) return IN_SKILL_A;
      return IN_ATTACK;
    }
    return 0;
  }
  // 띄운 상대를 공중에서 쫓는 중
  if (me.mode === 'air') {
    if (op.mode === 'airhit' && dist < 50) return IN_ATTACK | fwd;
    if (cpu.plan === 'jumpIn' && me.vy > 0 && dist < 40) return IN_ATTACK;
    return cpu.plan === 'jumpIn' ? fwd : 0;
  }
  if (me.mode === 'blockstun' && me.meter >= METER_BAR && me.meter < METER_MAX && dist < 36 && roll(cpu, 20) === 0) return IN_SKILL_B;

  // 상대가 가까이서 공격하면 방어 (실력에 따라)
  const threat = op.mode === 'attack' && dist < 80 && (me.x - op.x) * op.facing > 0;
  if (threat && NEUTRAL_GROUND.has(me.mode) && cpu.plan !== 'guard') {
    if (roll(cpu, 100) < cpu.skill) {
      cpu.plan = 'guard';
      cpu.planT = 18 + roll(cpu, 12);
    }
  }

  if (cpu.planT <= 0) choosePlan(cpu, me, op, dist);
  cpu.planT--;

  switch (cpu.plan) {
    case 'guard':
      return IN_DOWN;
    case 'approach':
      return dist > 34 ? fwd : 0;
    case 'retreat':
      return back;
    case 'dashIn':
      return cpu.planT % 20 === 19 ? IN_DASH | fwd : dist < 40 ? IN_ATTACK : fwd;
    case 'jumpIn':
      return cpu.planT % 30 === 29 ? IN_JUMP | fwd : fwd;
    case 'string':
    case 'launch':
      return dist < 44 ? IN_ATTACK : fwd;
    case 'sweep':
      return dist < 46 ? IN_ATTACK | IN_DOWN : fwd;
    case 'skill':
      return dist < 90 && me.meter >= METER_BAR ? IN_SKILL_A : fwd;
    case 'super':
      return dist < 45 && me.meter >= METER_MAX ? IN_SUPER : fwd;
    default:
      return 0;
  }
}

function choosePlan(cpu: CpuState, me: Fighter, op: Fighter, dist: number): void {
  const r = roll(cpu, 100);
  let plan: Plan;
  if (me.meter >= METER_MAX && dist < 120 && r < 70) plan = 'super';
  else if (dist > 110) plan = r < 55 ? 'approach' : r < 80 ? 'dashIn' : 'jumpIn';
  else if (dist > 50) plan = r < 35 ? 'approach' : r < 55 ? 'dashIn' : r < 70 ? 'jumpIn' : r < 80 && me.meter >= 2 * METER_BAR && me.meter < METER_MAX ? 'skill' : r < 90 ? 'wait' : 'retreat';
  else plan = r < 40 ? 'string' : r < 65 ? 'launch' : r < 80 ? 'sweep' : r < 90 ? 'guard' : 'retreat';
  if (op.mode === 'knockdown' || op.mode === 'getup') plan = r < 60 ? 'wait' : 'approach';
  cpu.plan = plan;
  cpu.planT = 20 + roll(cpu, 40);
}
