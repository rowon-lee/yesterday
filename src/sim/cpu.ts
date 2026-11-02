import { nextRandom } from '../core/rng';
import { MOVES, moveHitBox, movesOf } from './frames';
import { CHARACTERS, type CharId } from '../data/characters';
import type { MoveId } from '../data/moves/base';
import {
  IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT, IN_SKILL1, IN_SKILL2, IN_SUPER, IN_UP,
  type PlayerInput,
} from './input';
import { KEEP_ZONE, MAP_ENDS, type Surface } from '../stage/citadel';
import { isAirborne } from './fighter';
import { findWall, surfaceSolid, surfacesOf } from './platforms';
import { METER_BAR, METER_MAX, px, SUBPX, TECH_HITS, WALL_GRAB_H } from './rules';
import type { Fighter, SimState } from './types';

/**
 * CPU 조작. 상태를 보고 입력을 만든다. 자체 시드 난수만 쓰므로 같은 시드·같은 상태면 같은 입력.
 * 반응 시간을 두고 계획(다가가기, 연타, 띄워서 공중 콤보, 방어 …)을 고른다.
 */
type Plan = 'approach' | 'retreat' | 'guard' | 'string' | 'launch' | 'sweep' | 'jumpIn' | 'dashIn' | 'skill' | 'skill2' | 'super' | 'wait' | 'perch' | 'charge';

/**
 * 이 캐릭터 기술이 닿는 거리 (px, 두 사람 가운데 사이): 판정 프레임 동안 공격 상자 앞끝 + 그때까지 몸이 나아간 거리.
 * 캐릭터마다 사거리가 달라(라이덴 번개, 오스카 검격, 에드워드 해머) 거리 판단을 기술 데이터로 한다. 처음 쓸 때 계산해 둔다 (정적 데이터라 결정론)
 */
const reachCache = new Map<string, number>();
export function reachOf(c: CharId, id: MoveId): number {
  const key = `${c}/${id}`;
  const hit = reachCache.get(key);
  if (hit !== undefined) return hit;
  const mv = movesOf(c)[id];
  let far = 0;
  let adv = 0;
  for (let t = 0; t <= mv.total; t++) {
    adv += mv.advance?.[t] ?? 0;
    const b = moveHitBox(mv, t);
    if (b) far = Math.max(far, b.x + b.w + adv / SUBPX);
  }
  const r = Math.max(24, Math.round(far));
  reachCache.set(key, r);
  return r;
}
/** CPU가 이 기술을 쓰는 거리 [가장 가까이, 가장 멀리] (캐릭터 데이터 cpu, 없으면 판정이 닿는 거리 안) */
function useRange(c: CharId, id: 'skill1' | 'skill2' | 'super'): readonly [number, number] {
  return (CHARACTERS[c] as { cpu?: Partial<Record<string, readonly [number, number]>> }).cpu?.[id] ?? [0, Math.max(id === 'super' ? 45 : 60, reachOf(c, id))];
}

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
  /** 차지: 공격 버튼을 떼지 않고 누르고 있을 남은 틱 (0이면 안 누름)과 노리는 단계 */
  hold: number;
  holdLv: number;
}

export function createCpu(seed: number, skill = 60): CpuState {
  return { rng: seed | 0, plan: 'wait', planT: 0, last: 0, skill, tx: 0, ty: 0, wallDir: 0, wallT: 0, hold: 0, holdLv: 0 };
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
  const BTN = IN_ATTACK | IN_JUMP | IN_DASH | IN_SKILL1 | IN_SKILL2 | IN_SUPER;
  out = (out & ~BTN) | (out & BTN & ~cpu.last);
  // 차지: 누르고 있는 동안은 공격 버튼을 떼지 않는다 (떼는 순간 차지가 나간다)
  if (cpu.hold > 0) {
    cpu.hold--;
    out |= IN_ATTACK;
  }
  cpu.last = out;
  return out;
}

function decide(cpu: CpuState, s: SimState, me: Fighter, op: Fighter): PlayerInput {
  if (s.phase !== 'fight') return 0;
  const dxRaw = op.x - me.x;
  const dist = Math.abs(dxRaw) / SUBPX;
  const fwd = dxRaw >= 0 ? IN_RIGHT : IN_LEFT;
  const back = dxRaw >= 0 ? IN_LEFT : IN_RIGHT;

  // 차지를 누르고 있는 중: 맞거나 다른 상태가 되면 그만두고, 모으는 중이면 노린 단계가 됐고 상대가 닿을 만하면 뗀다
  if (cpu.hold > 0) {
    if (me.mode !== 'attack' && me.mode !== 'idle' && me.mode !== 'land' && me.mode !== 'charge') cpu.hold = 0;
    else if (me.mode === 'charge' && me.chargeLv >= cpu.holdLv && (dist < 80 || me.chargeLv >= 3)) cpu.hold = 0;
    if (cpu.hold > 0) return 0;
  }
  // 모으는 중에는 다른 입력이 듣지 않는다 (뗀 틱에 다시 누르지 않게)
  if (me.mode === 'charge') return 0;
  // 맞고 있을 때: 낙법이 되면 빠져나온다
  if (me.mode === 'airhit') return me.comboHits >= TECH_HITS && roll(cpu, 6) === 0 ? IN_JUMP : 0;
  // 벽꽝으로 박히면: 열에 넷쯤은 벽 낙법 (박힌 뒤 둘째 틱에 한 번만 정한다)
  if (me.mode === 'wallsplat') return me.t === 2 && roll(cpu, 5) < 2 ? IN_JUMP : 0;

  // 기술 도중: 연타, 띄운 뒤 쫓아가기, 공중 콤보 마무리
  if (me.mode === 'attack' && me.move) {
    const id = me.move;
    if (id === 'launcher' && me.moveConnected) return IN_JUMP | fwd;
    // 차지 1·2단계를 맞히면 띄운 상대를 점프로 쫓아간다 (3단계는 벽 쪽으로 날아가 쫓지 않는다)
    if (id === 'charge') return me.moveConnected && me.chargeLv < 3 ? IN_JUMP | fwd : 0;
    // 벽 박차기 공격을 맞히면 2단 점프로 쫓아간다
    if (id === 'wallKick') return me.moveConnected && roll(cpu, 2) === 0 ? IN_JUMP | fwd : 0;
    if (MOVES[id].data.air) {
      if (id === 'air2' && me.moveConnected && roll(cpu, 3) === 0) return IN_ATTACK | IN_DOWN;
      if (op.mode === 'airhit' || dist < Math.max(40, reachOf(me.char, 'air1'))) return IN_ATTACK;
      return 0;
    }
    if (cpu.plan === 'string' || cpu.plan === 'launch') {
      if (id === 'atk2' && cpu.plan === 'launch') return IN_ATTACK | IN_UP;
      if (me.moveConnected && me.meter >= 2 * METER_BAR && me.meter < METER_MAX && id === 'atk4' && roll(cpu, 3) === 0) return IN_SKILL1;
      return IN_ATTACK;
    }
    return 0;
  }
  // 앞으로 대시하는 중 상대가 가까우면 대시 공격 (대시 중 공격)
  if (me.mode === 'dash' && me.dir > 0 && me.t >= 2 && dist < 80 && !isAirborne(op) && roll(cpu, 3) !== 0) {
    // 둘에 하나는 누른 채로 대시 공격 → 차지 1단계로 잇는다
    if (roll(cpu, 2) === 0) startHold(cpu, 1, 30);
    return IN_ATTACK;
  }
  // 발판으로 오르는 점프: 노린 자리로 몸을 틀고, 아직 발판보다 낮은데 떨어지기 시작하면 2단 점프
  if (me.mode === 'jumpsquat' && cpu.tx) return toward(me, cpu.tx);
  // 벽에 붙어 있는 동안: 잠깐 버티다가 놓거나 벽 반대쪽으로 뛴다
  if (me.mode === 'wallcling') {
    const toward = me.wallSide < 0 ? IN_RIGHT : IN_LEFT;
    // 상대가 벽 반대쪽 아래 대각선 길목에 있으면 벽 박차기 공격
    // (내려가는 1px마다 1.4px 앞으로 난다. 앞발 끝이 몸보다 17px 앞에 있고, 상대 몸 높이 40px쯤에 닿게)
    const ahead = ((op.x - me.x) * me.facing) / SUBPX;
    const below = (op.y - me.y) / SUBPX;
    if (below > 30 && Math.abs(ahead - (17 + (below - 36) * 1.4)) < 22 && roll(cpu, 3) === 0) {
      cpu.wallT = 0;
      cpu.wallDir = 0;
      return IN_ATTACK | toward;
    }
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
    // 구조물 벽은 ↑를 함께 눌러야 붙는다
    if (cpu.wallDir) return cpu.wallDir | IN_UP;
    if (cpu.tx) {
      const dir = toward(me, cpu.tx);
      if (me.vy >= -px(1) && !me.airJumpUsed && me.y > cpu.ty - px(4)) return IN_JUMP | dir;
      return dir;
    }
    if (cpu.plan === 'jumpIn' && me.vy > 0 && dist < 40) return IN_ATTACK;
    return cpu.plan === 'jumpIn' ? fwd : 0;
  }
  if (me.mode === 'blockstun' && me.meter >= METER_BAR && me.meter < METER_MAX && dist < 36 && roll(cpu, 20) === 0) return IN_SKILL2;

  // 가끔 가까운 벽으로 대시해 벽을 달려 오른다 (상대가 위에 있으면 더 자주)
  if (NEUTRAL_GROUND.has(me.mode) && me.mode !== 'land' && roll(cpu, (me.y - op.y) / SUBPX > 40 ? 40 : 400) === 0) {
    for (const dir of [1, -1]) {
      if (findWall(s, me.x, Math.round(-me.y / SUBPX) + WALL_GRAB_H, dir, 50)) return IN_DASH | IN_UP | (dir > 0 ? IN_RIGHT : IN_LEFT);
    }
  }
  // 시타델이 3단계(금 가고 불붙음)이고 본관 앞이면 필살기로 무너뜨린다 (상대가 멀어도)
  if (s.citadel.stage === 3 && me.meter >= METER_MAX && NEUTRAL_GROUND.has(me.mode) && me.mode !== 'land') {
    const x = me.x / SUBPX;
    if (x > KEEP_ZONE.x0 + 30 && x < KEEP_ZONE.x1 - 30 && roll(cpu, 4) === 0) return IN_SUPER;
  }
  // 높이가 다르면 발판을 오르내린다
  const pm = platformMove(cpu, s, me, op);
  if (pm !== null) return pm;

  // 상대가 모으고 있으면 (무방비) 때리러 간다: 멀면 대시해서 대시 공격, 가까우면 평타 (실력에 따라)
  if (op.mode === 'charge' && NEUTRAL_GROUND.has(me.mode) && me.mode !== 'land' && dist < 140 && roll(cpu, 100) < cpu.skill) {
    return dist > 60 ? IN_DASH | fwd : IN_ATTACK;
  }
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
      return dist > Math.max(34, reachOf(me.char, 'atk1') - 10) ? fwd : 0;
    case 'retreat':
      return back;
    case 'charge':
      // 차지: 닿을 만한 거리에서 누르기 시작해 노린 단계까지 모은다 (가까이 오면 그 단계에서 뗀다)
      if (dist < 70) {
        startHold(cpu, 1 + roll(cpu, 3), 140);
        // 한 번 모으고 나면 잠깐 기다린다 (모으기를 되풀이하지 않게)
        cpu.plan = 'wait';
        cpu.planT = 30;
        return IN_ATTACK;
      }
      return fwd;
    case 'dashIn':
      return cpu.planT % 20 === 19 ? IN_DASH | fwd : dist < Math.max(40, reachOf(me.char, 'dashAttack') * 0.6) ? IN_ATTACK : fwd;
    case 'jumpIn':
      return cpu.planT % 30 === 29 ? IN_JUMP | fwd : fwd;
    case 'string':
    case 'launch':
      return dist < Math.max(44, reachOf(me.char, 'atk1')) ? IN_ATTACK : fwd;
    case 'sweep':
      return dist < Math.max(46, reachOf(me.char, 'sweep')) ? IN_ATTACK | IN_DOWN : fwd;
    case 'skill':
    case 'skill2': {
      // 스킬: 그 스킬을 쓰는 거리 안이면 쓰고, 멀면 다가가고 가까우면 물러난다
      const id = cpu.plan === 'skill' ? 'skill1' : 'skill2';
      const [lo, hi] = useRange(me.char, id);
      if (me.meter < METER_BAR) return 0;
      if (dist > hi) return fwd;
      if (dist < lo) return back;
      return id === 'skill1' ? IN_SKILL1 : IN_SKILL2 | (roll(cpu, 2) === 0 ? fwd : 0);
    }
    case 'super': {
      const [lo, hi] = useRange(me.char, 'super');
      if (dist > hi) return fwd;
      if (dist < lo) return back;
      return me.meter >= METER_MAX ? IN_SUPER : fwd;
    }
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
  // 거리 판단은 그 캐릭터 1타가 닿는 거리 기준 (사거리가 긴 캐릭터는 멀리서 친다)
  const near = Math.max(50, reachOf(me.char, 'atk1') + 6);
  const far = Math.max(110, near + 60);
  /** 스킬 하나를 쓸 만한 거리면 그 스킬 (둘 다면 반반) */
  const skillPlan = (): Plan | null => {
    const ok = (id: 'skill1' | 'skill2') => {
      const [lo, hi] = useRange(me.char, id);
      return dist >= lo - 20 && dist <= hi + 40;
    };
    const a = ok('skill1');
    const b = ok('skill2');
    return a && b ? (roll(cpu, 2) === 0 ? 'skill' : 'skill2') : a ? 'skill' : b ? 'skill2' : null;
  };
  const skillReady = me.meter >= 2 * METER_BAR && me.meter < METER_MAX;
  if (me.meter >= METER_MAX && dist < Math.max(120, useRange(me.char, 'super')[1] + 30) && r < 70) plan = 'super';
  else if (dist > far) plan = r < 15 && skillReady && skillPlan() ? skillPlan()! : r < 55 ? 'approach' : r < 80 ? 'dashIn' : 'jumpIn';
  else if (dist > near) plan = r < 35 ? 'approach' : r < 55 ? 'dashIn' : r < 70 ? 'jumpIn' : r < 80 && skillReady && skillPlan() ? skillPlan()! : r < 90 ? 'wait' : 'retreat';
  else plan = r < 40 ? 'string' : r < 65 ? 'launch' : r < 80 ? 'sweep' : r < 85 && skillReady && skillPlan() ? skillPlan()! : r < 92 ? 'guard' : 'retreat';
  // 상대가 쓰러져 있으면 모아 두었다가 일어날 때 친다 (또는 기다리거나 다가간다). 가끔은 그냥 거리에서도 모은다
  if (op.mode === 'knockdown' || op.mode === 'getup') plan = r < 35 ? 'charge' : r < 70 ? 'wait' : 'approach';
  else if (dist > near && dist < far && roll(cpu, 100) < 6) plan = 'charge';
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

/** 차지: 공격 버튼을 n틱 동안 떼지 않고, 노린 단계(lv)가 되면 뗀다 */
function startHold(cpu: CpuState, lv: number, n: number): void {
  cpu.hold = n;
  cpu.holdLv = lv;
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
