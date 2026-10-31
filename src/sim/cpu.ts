import { nextRandom } from '../core/rng';
import { MOVES } from './frames';
import {
  IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT, IN_SKILL_A, IN_SKILL_B, IN_SUPER, IN_UP,
  type PlayerInput,
} from './input';
import { MAP_ENDS, type Surface } from '../stage/citadel';
import { isAirborne } from './fighter';
import { findWall, surfaceSolid, surfacesOf } from './platforms';
import { METER_BAR, METER_MAX, px, SUBPX, TECH_HITS, WALL_GRAB_H } from './rules';
import type { Fighter, SimState } from './types';

/**
 * CPU 조작. 상태를 보고 입력을 만든다. 자체 시드 난수만 쓰므로 같은 시드·같은 상태면 같은 입력.
 * 반응 시간을 두고 계획(다가가기, 연타, 띄워서 공중 콤보, 방어 …)을 고른다.
 */
type Plan = 'approach' | 'retreat' | 'guard' | 'string' | 'launch' | 'sweep' | 'jumpIn' | 'dashIn' | 'skill' | 'super' | 'wait' | 'perch';

export interface CpuState {
  rng: number;
  plan: Plan;
  /** 이 계획을 유지할 남은 틱 */
  planT: number;
  /** 지난 틱에 낸 입력 (버튼은 떼었다 눌러야 다시 눌린다) */
  last: PlayerInput;
  /** 방어를 잘하는 정도 (0~100) */
  skill: number;
  /** 발판에 오를 때 노리는 자리 (1/256px, x가 0이면 없음) */
  tx: number;
  ty: number;
  /** 벽 붙기: 누르고 있을 방향 (IN_LEFT·IN_RIGHT, 0이면 안 붙음)과 붙어 있을 틱 */
  wallDir: number;
  wallT: number;
}

export function createCpu(seed: number, skill = 60): CpuState {
  return { rng: seed | 0, plan: 'wait', planT: 0, last: 0, skill, tx: 0, ty: 0, wallDir: 0, wallT: 0 };
}

/** 점프와 2단 점프로 오를 수 있다고 보는 높이 (px, 여유를 둠) */
const REACH = 150;

function roll(cpu: CpuState, n: number): number {
  const r = nextRandom(cpu.rng);
  cpu.rng = r.seed;
  return r.value % n;
}

const NEUTRAL_GROUND = new Set(['idle', 'run', 'guard', 'land', 'getup']);

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
  // 발판으로 오르는 점프: 노린 자리로 몸을 틀고, 아직 발판보다 낮은데 떨어지기 시작하면 2단 점프
  if (me.mode === 'jumpsquat' && cpu.tx) return toward(me, cpu.tx);
  // 벽에 붙어 있는 동안: 잠깐 버티다가 놓거나 벽 반대쪽으로 뛴다
  if (me.mode === 'wallcling') {
    const toward = me.wallSide < 0 ? IN_RIGHT : IN_LEFT;
    if (cpu.wallT > 0) {
      cpu.wallT--;
      return toward;
    }
    cpu.wallDir = 0;
    return roll(cpu, 2) === 0 ? IN_JUMP | toward : 0;
  }
  if (me.mode !== 'air') cpu.wallDir = 0;
  // 띄운 상대를 공중에서 쫓는 중
  if (me.mode === 'air') {
    if (op.mode === 'airhit' && dist < 50) return IN_ATTACK | fwd;
    // 떨어지는 중 벽 가까이면 가끔 벽 쪽을 눌러 붙는다
    if (!cpu.tx && !cpu.wallDir && me.vy >= 0) {
      for (const dir of [1, -1]) {
        if (findWall(s, me.x, Math.round(-me.y / SUBPX) + WALL_GRAB_H, dir, 24) && roll(cpu, 3) === 0) {
          cpu.wallDir = dir > 0 ? IN_RIGHT : IN_LEFT;
          cpu.wallT = 15 + roll(cpu, 45);
          break;
        }
      }
    }
    if (cpu.wallDir) return cpu.wallDir;
    if (cpu.tx) {
      const dir = toward(me, cpu.tx);
      if (me.vy >= -px(1) && !me.airJumpUsed && me.y > cpu.ty - px(4)) return IN_JUMP | dir;
      return dir;
    }
    if (cpu.plan === 'jumpIn' && me.vy > 0 && dist < 40) return IN_ATTACK;
    return cpu.plan === 'jumpIn' ? fwd : 0;
  }
  if (me.mode === 'blockstun' && me.meter >= METER_BAR && me.meter < METER_MAX && dist < 36 && roll(cpu, 20) === 0) return IN_SKILL_B;

  // 높이가 다르면 발판을 오르내린다
  const pm = platformMove(cpu, s, me, op);
  if (pm !== null) return pm;

  // 상대가 가까이서 공격하면 방어 (실력에 따라)
  const threat = op.mode === 'attack' && dist < 80 && (me.x - op.x) * op.facing > 0;
  if (threat && NEUTRAL_GROUND.has(me.mode) && cpu.plan !== 'guard') {
    if (roll(cpu, 100) < cpu.skill) {
      cpu.plan = 'guard';
      cpu.planT = 18 + roll(cpu, 12);
    }
  }

  if (cpu.planT <= 0) choosePlan(cpu, s, me, op, dist);
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
    case 'perch': {
      // 가까운 발판으로 뛰어오른다 (이미 올라섰으면 기다린다)
      if (!cpu.tx || me.y <= cpu.ty) return 0;
      const under = Math.abs(cpu.tx - me.x) < px(10);
      return under ? IN_JUMP | toward(me, cpu.tx) : toward(me, cpu.tx);
    }
    default:
      return 0;
  }
}

function choosePlan(cpu: CpuState, s: SimState, me: Fighter, op: Fighter, dist: number): void {
  const r = roll(cpu, 100);
  let plan: Plan;
  // 거리가 있으면 가끔 가까운 발판에 올라선다 (차양·계단참·비상계단)
  if (dist > 60 && roll(cpu, 100) < 14) {
    const sf = perchNear(s, me);
    if (sf) {
      cpu.plan = 'perch';
      cpu.planT = 50 + roll(cpu, 50);
      cpu.tx = px(aimX(sf, Math.round(me.x / SUBPX)));
      cpu.ty = -px(sf.h);
      return;
    }
  }
  if (me.meter >= METER_MAX && dist < 120 && r < 70) plan = 'super';
  else if (dist > 110) plan = r < 55 ? 'approach' : r < 80 ? 'dashIn' : 'jumpIn';
  else if (dist > 50) plan = r < 35 ? 'approach' : r < 55 ? 'dashIn' : r < 70 ? 'jumpIn' : r < 80 && me.meter >= 2 * METER_BAR && me.meter < METER_MAX ? 'skill' : r < 90 ? 'wait' : 'retreat';
  else plan = r < 40 ? 'string' : r < 65 ? 'launch' : r < 80 ? 'sweep' : r < 90 ? 'guard' : 'retreat';
  if (op.mode === 'knockdown' || op.mode === 'getup') plan = r < 60 ? 'wait' : 'approach';
  cpu.plan = plan;
  cpu.planT = 20 + roll(cpu, 40);
}

/**
 * 발판에서 노릴 x (px): 지금 x에서 가장 가까운 발판 위 자리. 땅에서 걸어갈 수 없는 곳(서쪽 끝 벽 너머의 컨테이너 더미 위)이면
 * 걸어갈 수 있는 가장 가까운 끝 (거기서 뛰어 넘어간다)
 */
function aimX(sf: Surface, mx: number): number {
  const lo = Math.max(sf.x0 + 12, MAP_ENDS.left + 2);
  const hi = sf.x1 - 12;
  return lo > hi ? sf.x1 - 4 : Math.max(lo, Math.min(hi, mx));
}

/** 노린 x 쪽 방향 입력 (가까우면 0) */
function toward(me: Fighter, x: number): PlayerInput {
  const dx = x - me.x;
  return Math.abs(dx) < px(4) ? 0 : dx > 0 ? IN_RIGHT : IN_LEFT;
}

/**
 * 높이가 다를 때: 내가 발판 위인데 상대가 아래에 있으면 내려가고 (↓+점프, 멀면 걸어서 끝을 넘음),
 * 상대가 위쪽 발판에 서 있으면 올라간다. 한 번에 닿지 않으면 중간 발판을 디딘다. 해당 없으면 null.
 */
function platformMove(cpu: CpuState, s: SimState, me: Fighter, op: Fighter): PlayerInput | null {
  if (!NEUTRAL_GROUND.has(me.mode)) return null;
  const rise = (me.y - op.y) / SUBPX;
  if (me.floor < 0 && rise < -40) {
    // 일부러 올라선 동안은 버틴다
    if (cpu.plan === 'perch' && cpu.planT > 0) return null;
    cpu.tx = 0;
    if (Math.abs(op.x - me.x) / SUBPX < 160 && roll(cpu, 12) === 0) return IN_DOWN | IN_JUMP;
    return op.x > me.x ? IN_RIGHT : IN_LEFT;
  }
  if (!isAirborne(op) && rise > 40) {
    const near = rise <= REACH && Math.abs(op.x - me.x) / SUBPX < 140;
    const step = near ? null : stepToward(s, me, op);
    if (!near && !step) {
      cpu.tx = 0;
      return null;
    }
    cpu.tx = step ? px(aimX(step, (step.x0 + step.x1) / 2)) : op.x;
    cpu.ty = step ? -px(step.h) : op.y;
    const dx = cpu.tx - me.x;
    const under = step ? Math.abs(dx) < px(Math.max(6, (step.x1 - step.x0) / 2 - 8)) : Math.abs(dx) < px(90);
    if (under && roll(cpu, 3) === 0) return IN_JUMP | toward(me, cpu.tx);
    return toward(me, cpu.tx);
  }
  cpu.tx = 0;
  return null;
}

/** 지금 높이에서 닿는 발판 중 상대 쪽으로 가는 디딤돌 */
function stepToward(s: SimState, me: Fighter, op: Fighter): Surface | null {
  const myH = -me.y / SUBPX;
  let best: Surface | null = null;
  let bestScore = Infinity;
  for (const sf of surfacesOf(s)) {
    if (sf.h < myH + 30 || sf.h > myH + REACH) continue;
    const cx = aimX(sf, (sf.x0 + sf.x1) / 2);
    if (!surfaceSolid(s, sf, px(cx))) continue;
    const score = Math.abs(cx - op.x / SUBPX) + Math.abs(cx - me.x / SUBPX) * 0.5 - sf.h * 0.3;
    if (score < bestScore) {
      bestScore = score;
      best = sf;
    }
  }
  return best;
}

/** 지금 자리에서 뛰어오를 만한 가까운 발판 (발판의 가장 가까운 곳까지 가로 90px 안, 지금보다 50~REACH px 위) */
function perchNear(s: SimState, me: Fighter): Surface | null {
  const myH = -me.y / SUBPX;
  const mx = Math.round(me.x / SUBPX);
  for (const sf of surfacesOf(s)) {
    const nx = aimX(sf, mx);
    if (Math.abs(nx - mx) > 90 || sf.h < myH + 50 || sf.h > myH + REACH) continue;
    if (surfaceSolid(s, sf, px(nx))) return sf;
  }
  return null;
}
