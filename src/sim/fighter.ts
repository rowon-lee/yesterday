import { AIR_CHAIN, GROUND_CHAIN, type MoveId } from '../data/moves/base';
import { MOVES, STATS } from './frames';
import {
  IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT, IN_SKILL_A, IN_SKILL_B, IN_SUPER, IN_UP, type PlayerInput,
} from './input';
import { canDropThrough, findWall, findWallCross, floorBelow, landingY, wallHolds, wallTop } from './platforms';
import {
  BOUNCE_VY, BUFFER_TICKS, DROP_TICKS, GETUP_TICKS, GUARD_MAX, GUARD_REGEN_DELAY, GUARD_REGEN_EVERY,
  JUGGLE_GRAVITY_MAX, JUGGLE_GRAVITY_PER_HIT, KNOCKDOWN_TICKS, METER_BAR, SAME_WALL_MAX, SUPER_FREEZE, TECH_HITS, TECH_TICKS, TECH_VX, TECH_VY,
  WALL_GRAB_H, WALL_JUMP_LOCK, WALL_PUSH, WALL_REACH, WALL_TOP_VX, WALL_TOP_VY, px,
} from './rules';
import type { Fighter, Mode, SimState } from './types';

const BUTTON_BITS = [IN_ATTACK, IN_JUMP, IN_DASH, IN_SKILL_A, IN_SKILL_B, IN_SUPER];
const B_ATTACK = 0;
const B_JUMP = 1;
const B_DASH = 2;
const B_SKILL_A = 3;
const B_SKILL_B = 4;
const B_SUPER = 5;

export function setMode(f: Fighter, mode: Mode, len = 0): void {
  f.mode = mode;
  f.t = 0;
  f.len = len;
  if (mode !== 'attack') {
    f.move = null;
    f.queued = null;
  }
  // 점프 종류(그림용)는 그 점프로 바로 떠 있는 동안만: 공중 대시·공중 공격 등을 하고 다시 떠 있게 되면 보통 낙하로
  // (벽 점프·꼭대기 넘기 그림이 처음부터 다시 나오지 않게)
  if (mode !== 'air') f.jumpKind = 0;
}

/** 떠 있는가: 서 있는 바닥(땅이나 발판)보다 위에 있거나 떠오르는 중 */
export const isAirborne = (f: Fighter): boolean => f.y < f.floor || f.vy < 0;

/** 땅에서만 있을 수 있는 상태 (발밑 바닥이 없어지면 떨어지는 상태로 바꾼다) */
const GROUND_ONLY: ReadonlySet<Mode> = new Set(['idle', 'run', 'guard', 'land', 'dash', 'jumpsquat', 'getup', 'crush', 'blockstun', 'hitstun', 'knockdown']);

/** 밀려나는 등 위치가 바뀐 뒤: 서 있던 발판이 발밑에 그대로 있는지 다시 본다 */
export function settle(s: SimState, f: Fighter): void {
  if (f.floor < 0 && !isAirborne(f) && floorBelow(s, f.x, f.y, f.dropT > 0) !== f.y) fallOff(f);
}

/** 서 있던 발판이 발밑에서 없어졌다 (끝을 넘었거나 무너졌다): 떨어지기 시작한다 */
function fallOff(f: Fighter): void {
  f.floor = 0;
  switch (f.mode) {
    case 'hitstun':
    case 'knockdown':
      // 맞고 있거나 누운 채 떨어지면 떨어져 넘어진다
      setMode(f, 'airhit', 0);
      break;
    default:
      if (GROUND_ONLY.has(f.mode)) {
        setMode(f, 'air');
        f.airJumpUsed = false;
        f.airDashUsed = false;
        f.jumpKind = 0;
      }
      break;
  }
}

/** 조작을 받는 상태 (콤보가 끝난 것으로 본다) */
const NEUTRAL: ReadonlySet<Mode> = new Set(['idle', 'run', 'guard', 'air', 'land', 'dash', 'airdash', 'jumpsquat', 'attack', 'wallcling', 'wallrun']);

/** 눌린 버튼을 버퍼에 담는다 (멈춰 있는 동안에도 눌림은 기억). */
export function readButtons(f: Fighter, input: PlayerInput): void {
  const pressed = input & ~f.prevInput;
  for (let i = 0; i < BUTTON_BITS.length; i++) {
    if (pressed & BUTTON_BITS[i]) f.buf[i] = BUFFER_TICKS;
  }
  if (pressed & IN_ATTACK) f.atkDir = input & (IN_UP | IN_DOWN);
  f.prevInput = input;
}

function ageButtons(f: Fighter): void {
  for (let i = 0; i < f.buf.length; i++) if (f.buf[i] > 0) f.buf[i]--;
}

const take = (f: Fighter, b: number): boolean => {
  if (f.buf[b] > 0) {
    f.buf[b] = 0;
    return true;
  }
  return false;
};
const has = (f: Fighter, b: number): boolean => f.buf[b] > 0;

function startMove(s: SimState, f: Fighter, id: MoveId): void {
  const mv = MOVES[id];
  const cost = (mv.data.meterCost ?? 0) * METER_BAR;
  f.meter -= cost;
  setMode(f, 'attack');
  f.move = id;
  f.moveHit = false;
  f.moveConnected = false;
  f.propHits = [];
  f.queued = null;
  if (!isAirborne(f)) f.vx = 0;
  if (mv.data.cutin) {
    s.freeze = SUPER_FREEZE;
    s.events.push({ type: 'cutin', who: s.fighters.indexOf(f), x: f.x, y: f.y, text: mv.data.cutin, move: id });
  }
}

const canAfford = (f: Fighter, id: MoveId): boolean => f.meter >= (MOVES[id].data.meterCost ?? 0) * METER_BAR;

/** 기술 A·B·필살을 쓸 수 있으면 쓴다 */
function trySkills(s: SimState, f: Fighter, air: boolean, fromGuard = false): boolean {
  const options: Array<[number, MoveId]> = [[B_SUPER, 'super'], [B_SKILL_A, 'skillA'], [B_SKILL_B, 'skillB']];
  for (const [b, id] of options) {
    if (!has(f, b)) continue;
    const d = MOVES[id].data;
    if (air && !('alsoAir' in d && d.alsoAir)) continue;
    if (fromGuard && !('fromGuard' in d && d.fromGuard)) continue;
    if (!canAfford(f, id)) continue;
    take(f, b);
    startMove(s, f, id);
    return true;
  }
  return false;
}

/** 공격의 위·아래: 누른 순간의 방향 */
const atkDir = (f: Fighter): number => f.atkDir;

function groundAttack(f: Fighter): MoveId {
  if (atkDir(f) & IN_UP) return 'launcher';
  if (atkDir(f) & IN_DOWN) return 'sweep';
  return GROUND_CHAIN[0];
}

function startJump(f: Fighter, input: PlayerInput, chase: boolean): void {
  const h = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
  setMode(f, 'air');
  f.vy = chase ? STATS.chaseJumpVy : STATS.jumpVy;
  f.vx = h * (chase ? STATS.chaseJumpVx : STATS.jumpVx);
  if (chase) f.vx = f.facing * STATS.chaseJumpVx;
  f.y = Math.min(f.y, -1);
  f.airJumpUsed = false;
  f.airDashUsed = false;
  f.jumpKind = chase ? 1 : 0;
}

function doubleJump(f: Fighter, input: PlayerInput): void {
  const h = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
  setMode(f, 'air');
  f.vy = STATS.doubleJumpVy;
  f.vx = h * STATS.jumpVx;
  f.airJumpUsed = true;
  f.jumpKind = 2;
}

/** 지상에서 조작을 받는 상태 */
function groundControl(s: SimState, f: Fighter, input: PlayerInput): void {
  const fwd = f.facing > 0 ? IN_RIGHT : IN_LEFT;
  const back = f.facing > 0 ? IN_LEFT : IN_RIGHT;
  if (trySkills(s, f, false)) return;
  if (take(f, B_ATTACK)) return startMove(s, f, groundAttack(f));
  // 발판 위에서 ↓+점프: 발판을 뚫고 내려온다 (땅과 아래가 꽉 찬 윗면에서는 그냥 점프)
  if (f.floor < 0 && input & IN_DOWN && has(f, B_JUMP) && canDropThrough(s, f.x, f.y)) {
    take(f, B_JUMP);
    f.dropT = DROP_TICKS;
    fallOff(f);
    setMode(f, 'air');
    f.vy = Math.max(f.vy, px(1));
    return;
  }
  if (take(f, B_JUMP)) return setMode(f, 'jumpsquat', STATS.jumpSquat);
  if (take(f, B_DASH)) {
    setMode(f, 'dash', STATS.dashTicks);
    f.dir = input & back ? -1 : 1;
    f.dashUp = (input & IN_UP) !== 0;
    return;
  }
  if (input & IN_DOWN) {
    if (f.mode !== 'guard') setMode(f, 'guard');
    f.vx = 0;
    return;
  }
  if (input & (fwd | back)) {
    const forward = (input & fwd) !== 0;
    if (f.mode !== 'run' || f.dir !== (forward ? 1 : -1)) {
      setMode(f, 'run');
      f.dir = forward ? 1 : -1;
    }
    f.vx = f.facing * (forward ? STATS.runForward : -STATS.runBack);
    f.runDist += forward ? STATS.runForward : STATS.runBack;
    return;
  }
  if (f.mode !== 'idle') setMode(f, 'idle');
  f.vx = 0;
}

function airDrift(f: Fighter, input: PlayerInput): void {
  // 벽 점프 직후에는 튕겨 나간 쪽으로 날아간다
  if (f.driftLock > 0) return;
  const h = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
  if (h) f.vx = Math.max(-STATS.airMaxVx, Math.min(STATS.airMaxVx, f.vx + h * STATS.airAccel));
}

/** 손이 닿는 높이 (발밑에서 WALL_GRAB_H 위, px) */
const grabH = (f: Fighter): number => Math.round(-f.y / 256) + WALL_GRAB_H;

/**
 * 벽 붙기 (기획서 '벽 기동과 구조물'): 공중에서 벽 쪽 대각선 위(↗·↖)를 누른 채 벽에 닿으면 붙는다.
 * 맵 끝 벽은 벽 쪽만 눌러도 된다. ↑ 없이 벽 쪽을 누르면 구조물 앞을 그냥 지나간다 (벽은 길을 막지 않는다).
 * 솟는 중에 닿아도 붙는다 (솟는 힘이 다할 때까지 벽을 타고 오르다 미끄러진다).
 * 같은 벽은 연속 SAME_WALL_MAX번까지 (땅·발판에 내려서면 처음부터). 벽을 디디면 2단 점프와 공중 대시가 한 번씩 다시 생긴다.
 */
function tryCling(s: SimState, f: Fighter, input: PlayerInput): boolean {
  const dir = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
  if (!dir) return false;
  const w = findWall(s, f.x, grabH(f), dir, 0, (input & IN_UP) !== 0);
  if (!w || (w.id === f.wallId && f.wallCount >= SAME_WALL_MAX)) return false;
  // 붙는 자리 바로 아래에 발판이 있으면 (발판 끝에서 걸어 나온 직후 등) 붙지 않는다: 붙자마자 그 발판에 서 버린다
  const cx = px(w.x) + w.side * WALL_REACH;
  if (floorBelow(s, cx, f.y) - f.y < px(4)) return false;
  setMode(f, 'wallcling');
  f.wallCount = w.id === f.wallId ? f.wallCount + 1 : 1;
  f.wallId = w.id;
  f.wallX = w.x;
  f.wallSide = w.side;
  f.x = cx;
  f.vx = 0;
  // 떨어지던 중이면 멈추고, 솟던 중이면 그 힘이 다할 때까지 벽을 타고 오른다
  if (f.vy > 0) f.vy = 0;
  // 벽을 등지고 바깥을 본다
  f.facing = w.side as 1 | -1;
  f.airJumpUsed = false;
  f.airDashUsed = false;
  s.events.push({ type: 'wallcling', who: s.fighters.indexOf(f), x: px(w.x), y: f.y - px(WALL_GRAB_H), combo: f.wallCount });
  return true;
}

/** 벽에서 손을 놓는다: 벽 반대쪽으로 살짝 밀려나며 떨어진다 */
function letGo(f: Fighter): void {
  setMode(f, 'air');
  f.vx = f.wallSide * WALL_PUSH;
  f.jumpKind = 0;
}

/**
 * 벽 점프 (기획서 '벽 기동과 구조물'): 붙은 채 점프하면 벽 반대쪽(바라보는 쪽)으로 비스듬히 튕겨 오른다.
 * 벽을 디뎌 다시 생긴 2단 점프·공중 대시는 그대로 남는다. 잠깐 공중 좌우 조작이 듣지 않는다 (WALL_JUMP_LOCK).
 */
function wallJump(s: SimState, f: Fighter): void {
  setMode(f, 'air');
  f.vx = f.facing * STATS.wallJumpVx;
  f.vy = STATS.wallJumpVy;
  f.jumpKind = 3;
  f.driftLock = WALL_JUMP_LOCK;
  s.events.push({ type: 'walljump', who: s.fighters.indexOf(f), x: px(f.wallX), y: f.y - px(10) });
}

/**
 * 벽에 붙은 동안: 솟던 힘이 다하면 멈췄다가 천천히 빨라지며 미끄러진다 (발판·땅에 닿으면 착지).
 * 점프는 벽 점프 (어느 방향을 누르든). 공격·대시는 벽 반대쪽(바라보는 쪽)으로: 지금은 공중 공격·공중 대시를 쓴다
 * (벽 박차기 공격 동작이 생기면 바뀐다). 벽 쪽 방향을 놓거나 ↓를 누르면, 또는 벽이 끝나거나 무너지면 떨어진다.
 */
function clingControl(s: SimState, f: Fighter, input: PlayerInput): void {
  const toward = f.wallSide < 0 ? IN_RIGHT : IN_LEFT;
  f.x = px(f.wallX) + f.wallSide * WALL_REACH;
  f.vx = 0;
  f.vy = f.vy < 0 ? Math.min(0, f.vy + STATS.gravity) : Math.min(STATS.wallSlide, f.vy + STATS.wallSlideAccel);
  if (!wallHolds(s, f.wallId, f.wallSide, f.wallX, grabH(f))) {
    letGo(f);
    return;
  }
  if (take(f, B_JUMP)) {
    wallJump(s, f);
    return;
  }
  if (trySkills(s, f, true)) return;
  if (take(f, B_ATTACK)) {
    letGo(f);
    startMove(s, f, atkDir(f) & IN_DOWN ? 'slam' : AIR_CHAIN[0]);
    return;
  }
  if (has(f, B_DASH) && !f.airDashUsed) {
    take(f, B_DASH);
    setMode(f, 'airdash', STATS.airDashTicks);
    f.dir = 1;
    f.dashUp = (input & IN_UP) !== 0;
    f.airDashUsed = true;
    return;
  }
  if (!(input & toward) || input & IN_DOWN) letGo(f);
}

/**
 * 벽 달리기 (기획서 '벽 기동과 구조물'): ↑를 누른 채 지상·공중 대시로 벽 쪽으로 가다 벽에 닿으면 벽을 바라보며 달려 오른다
 * (prevX: 이번 틱 움직이기 전 x). 맵 끝 벽은 ↑ 없이 대시만 해도 된다. ↑ 없이 대시하면 구조물 앞을 그냥 지나간다.
 * 벽을 디딘 것으로 친다 (같은 벽 연속 두 번까지, 2단 점프·공중 대시가 다시 생긴다).
 */
function tryWallRun(s: SimState, f: Fighter, prevX: number): boolean {
  const dir = Math.sign(f.x - prevX);
  if (!dir) return false;
  // ↑와 함께 대시를 시작했거나, 지금 ↑를 누르고 있으면 구조물 벽도 달린다 (prevInput: readButtons가 적어 둔 이번 틱 입력)
  const w = findWallCross(s, prevX, f.x, grabH(f), dir, f.dashUp || (f.prevInput & IN_UP) !== 0);
  if (!w || (w.id === f.wallId && f.wallCount >= SAME_WALL_MAX)) return false;
  setMode(f, 'wallrun', STATS.wallRunTicks);
  f.wallCount = w.id === f.wallId ? f.wallCount + 1 : 1;
  f.wallId = w.id;
  f.wallX = w.x;
  f.wallSide = w.side;
  f.x = px(w.x) + w.side * WALL_REACH;
  f.vx = 0;
  f.vy = -STATS.wallRunSpeed;
  f.floor = 0;
  f.invuln = 0;
  // 벽을 바라본다
  f.facing = dir as 1 | -1;
  f.airJumpUsed = false;
  f.airDashUsed = false;
  s.events.push({ type: 'wallrun', who: s.fighters.indexOf(f), x: px(w.x), y: f.y, text: 'start', combo: f.wallCount });
  return true;
}

/**
 * 벽을 달려 오르는 동안: 점프하면 벽 점프 (벽 반대쪽으로). 꼭대기가 닿으면 모서리를 넘어 윗면 쪽으로 튀어 오른다 (윗면이 있으면 그 위에 내려선다).
 * 다 달렸는데 꼭대기에 못 닿으면 그 자리에서 벽 붙기로 이어진다 (벽 쪽을 누르고 있어야 붙어 있는다). 벽이 무너지면 떨어진다.
 */
function wallRunControl(s: SimState, f: Fighter): void {
  f.x = px(f.wallX) + f.wallSide * WALL_REACH;
  f.vx = 0;
  f.vy = -STATS.wallRunSpeed;
  if (take(f, B_JUMP)) {
    f.facing = f.wallSide as 1 | -1;
    wallJump(s, f);
    return;
  }
  const grab = grabH(f);
  if (grab >= wallTop(s, f.wallId, f.wallSide, f.wallX)) {
    // 꼭대기: 모서리를 잡고 넘어간다
    setMode(f, 'air');
    f.vx = f.facing * WALL_TOP_VX;
    f.vy = WALL_TOP_VY;
    f.jumpKind = 4;
    f.driftLock = 6;
    s.events.push({ type: 'wallrun', who: s.fighters.indexOf(f), x: px(f.wallX), y: f.y - px(WALL_GRAB_H), text: 'top' });
    return;
  }
  if (!wallHolds(s, f.wallId, f.wallSide, f.wallX, grab)) {
    setMode(f, 'air');
    f.vx = f.wallSide * WALL_PUSH;
    f.jumpKind = 0;
    return;
  }
  if (f.t >= f.len) {
    // 다 달렸다: 벽을 등지고 붙는다 (같은 디딤이라 횟수는 늘지 않는다)
    setMode(f, 'wallcling');
    f.facing = f.wallSide as 1 | -1;
    f.vy = 0;
  }
}

function airControl(s: SimState, f: Fighter, input: PlayerInput): void {
  if (tryCling(s, f, input)) return;
  airDrift(f, input);
  if (trySkills(s, f, true)) return;
  if (take(f, B_ATTACK)) return startMove(s, f, atkDir(f) & IN_DOWN ? 'slam' : AIR_CHAIN[0]);
  if (has(f, B_JUMP) && !f.airJumpUsed) {
    take(f, B_JUMP);
    return doubleJump(f, input);
  }
  if (has(f, B_DASH) && !f.airDashUsed) {
    take(f, B_DASH);
    const back = f.facing > 0 ? IN_LEFT : IN_RIGHT;
    setMode(f, 'airdash', STATS.airDashTicks);
    f.dir = input & back ? -1 : 1;
    f.dashUp = (input & IN_UP) !== 0;
    f.airDashUsed = true;
  }
}

/** 기술 도중: 연타 다음 타, 점프 끊기, 기술 끊기 */
function attackControl(s: SimState, f: Fighter, input: PlayerInput): boolean {
  const mv = MOVES[f.move!];
  const air = mv.data.air === true;
  // 맞히거나 막히면 기술 A·B·필살로 끊을 수 있다
  if (f.moveHit && trySkills(s, f, isAirborne(f))) return true;
  // 맞히면 (히트스톱이 끝난 바로 다음부터) 점프로 끊고 쫓아간다
  if (mv.data.jumpCancel && f.moveConnected && has(f, B_JUMP)) {
    if (!air) {
      take(f, B_JUMP);
      startJump(f, input, true);
      return true;
    }
    if (!f.airJumpUsed) {
      take(f, B_JUMP);
      doubleJump(f, input);
      return true;
    }
  }
  // 연타: 판정이 나오기 시작한 뒤 누르면 다음 타를 예약하고, 판정이 끝나면 넘어간다
  if (!f.queued && f.t >= mv.activeStart && has(f, B_ATTACK)) {
    const chain = air ? AIR_CHAIN : GROUND_CHAIN;
    const idx = chain.indexOf(mv.id);
    if (idx >= 0) {
      let next: MoveId | null = null;
      if (air) next = atkDir(f) & IN_DOWN ? 'slam' : (chain[idx + 1] ?? null);
      else if (atkDir(f) & IN_UP) next = 'launcher';
      else if (atkDir(f) & IN_DOWN) next = 'sweep';
      else next = chain[idx + 1] ?? null;
      if (next) {
        take(f, B_ATTACK);
        f.queued = next;
      }
    }
  }
  if (f.queued && f.t >= mv.activeEnd) {
    startMove(s, f, f.queued);
    return true;
  }
  return false;
}

const friction = (v: number): number => Math.trunc((v * 13) / 16);

/**
 * 한 사람의 한 틱. 입력 → 상태 → 속도. 위치 이동과 착지는 physics()에서.
 * controllable이 false면 (라운드 시작 전·끝난 뒤) 입력을 무시한다.
 */
export function updateFighter(s: SimState, f: Fighter, rawInput: PlayerInput, controllable: boolean): void {
  const input = controllable ? rawInput : 0;
  if (!controllable) f.buf.fill(0);
  f.t++;
  if (f.driftLock > 0) f.driftLock--;
  // 발밑이 없는데 땅 상태면 (발판이 무너진 직후 등) 떨어지는 상태로
  if (isAirborne(f) && GROUND_ONLY.has(f.mode)) fallOff(f);
  if (f.invuln > 0) f.invuln--;
  if (f.flash > 0) f.flash--;

  if (NEUTRAL.has(f.mode)) f.comboHits = 0;
  // 방어 내구도는 막지 않는 동안 다시 찬다
  if (f.mode === 'guard' || f.mode === 'blockstun' || f.mode === 'crush') f.guardWait = GUARD_REGEN_DELAY;
  else if (f.guardWait > 0) f.guardWait--;
  else if (f.guard < GUARD_MAX && s.tick % GUARD_REGEN_EVERY === 0) f.guard++;

  switch (f.mode) {
    case 'idle':
    case 'run':
    case 'guard':
      groundControl(s, f, input);
      break;
    case 'land':
      f.vx = 0;
      if (f.t >= 2 && controllable && (f.buf.some((b) => b > 0) || input & (IN_LEFT | IN_RIGHT | IN_DOWN))) groundControl(s, f, input);
      else if (f.t >= f.len) setMode(f, 'idle');
      break;
    case 'jumpsquat':
      f.vx = 0;
      if (f.t >= f.len) startJump(f, input, false);
      break;
    case 'dash': {
      if (f.t >= STATS.dashMoveFrom && f.t < STATS.dashMoveTo) {
        f.vx = f.facing * f.dir * STATS.dashSpeed;
        f.invuln = Math.max(f.invuln, 1);
      } else f.vx = friction(f.vx);
      if (f.t >= STATS.dashMoveTo && (has(f, B_ATTACK) || has(f, B_JUMP) || f.buf[B_SKILL_A] || f.buf[B_SKILL_B] || f.buf[B_SUPER])) {
        groundControl(s, f, input);
      } else if (f.t >= f.len) setMode(f, 'idle');
      break;
    }
    case 'air':
      airControl(s, f, input);
      break;
    case 'wallcling':
      clingControl(s, f, input);
      break;
    case 'wallrun':
      wallRunControl(s, f);
      break;
    case 'airdash':
      if (f.t < STATS.airDashMoveTo) {
        f.vx = f.facing * f.dir * STATS.airDashSpeed;
        f.vy = 0;
      }
      if (f.t >= f.len) setMode(f, 'air');
      break;
    case 'attack': {
      const mv = MOVES[f.move!];
      if (attackControl(s, f, input)) break;
      if (mv.step) {
        const fr = frameOf(mv, f.t);
        if (fr >= mv.step.from && fr <= mv.step.to) f.vx = f.facing * mv.step.speed;
        else if (!isAirborne(f)) f.vx = friction(f.vx);
      } else if (!isAirborne(f)) f.vx = friction(f.vx);
      if (f.t >= mv.total) {
        if (isAirborne(f)) setMode(f, 'air');
        else setMode(f, 'idle');
      }
      break;
    }
    case 'blockstun':
      f.vx = friction(f.vx);
      if (controllable && trySkills(s, f, false, true)) break;
      if (f.t >= f.len) setMode(f, 'guard');
      break;
    case 'crush':
      f.vx = friction(f.vx);
      if (f.t >= f.len) {
        f.guard = GUARD_MAX;
        setMode(f, 'idle');
      }
      break;
    case 'hitstun':
      f.vx = friction(f.vx);
      if (f.t >= f.len) setMode(f, 'idle');
      break;
    case 'airhit':
      // 많이 맞으면 점프로 낙법
      if (controllable && f.comboHits >= TECH_HITS && f.hitstop === 0 && take(f, B_JUMP)) {
        setMode(f, 'tech', TECH_TICKS);
        f.invuln = TECH_TICKS;
        f.vx = -f.facing * TECH_VX;
        f.vy = TECH_VY;
        f.comboHits = 0;
        f.bounce = false;
        f.airJumpUsed = true;
        f.airDashUsed = true;
        s.events.push({ type: 'tech', who: s.fighters.indexOf(f), x: f.x, y: f.y });
      }
      break;
    case 'tech':
      if (f.t >= f.len) setMode(f, 'air');
      break;
    case 'wallsplat':
      // 정면에 박혀 있다가 튕겨 나와 떨어진다
      f.vx = 0;
      f.vy = 0;
      if (f.t >= f.len) {
        setMode(f, 'airhit', 30);
        f.vx = f.facing * px(1.6);
        f.vy = px(-3.5);
        f.y = Math.min(f.y, -1);
      }
      break;
    case 'knockdown':
      f.vx = friction(f.vx);
      f.invuln = Math.max(f.invuln, 1);
      if (f.t >= f.len) {
        setMode(f, 'getup', GETUP_TICKS);
        f.invuln = GETUP_TICKS;
      }
      break;
    case 'getup':
      if (f.t >= f.len) setMode(f, 'idle');
      break;
    case 'ko':
      f.vx = isAirborne(f) ? f.vx : friction(f.vx);
      f.invuln = Math.max(f.invuln, 1);
      break;
    case 'win':
      f.vx = 0;
      break;
  }
  ageButtons(f);
}

export function frameOf(mv: (typeof MOVES)[MoveId], t: number): number {
  const cum = mv.frames.cum;
  for (let i = 0; i < cum.length; i++) if (t < cum[i]) return i;
  return cum.length - 1;
}

/**
 * 이동, 중력, 착지. 바닥은 땅과 한 방향 발판: 떨어지면서 위에서 지나친 가장 높은 바닥에 선다.
 * 서 있는 동안 발밑 발판이 없어지면 (끝을 넘거나 무너지면) 떨어진다.
 */
export function physics(s: SimState, f: Fighter): void {
  if (f.mode === 'wallsplat') return;
  // 떠오르면 서 있던 바닥을 떠난다
  if (f.vy < 0) f.floor = 0;
  const airborne = isAirborne(f);
  if (!airborne && f.vy > 0) f.vy = 0;
  // 공중 대시는 높이를 지키고, 벽에 붙거나 달리는 동안은 세로 속도를 그 조작이 정한다
  if (airborne && f.mode !== 'airdash' && f.mode !== 'wallcling' && f.mode !== 'wallrun') {
    let g = STATS.gravity;
    if (f.mode === 'airhit') g += Math.min(JUGGLE_GRAVITY_MAX, f.comboHits * JUGGLE_GRAVITY_PER_HIT);
    f.vy = Math.min(STATS.maxFall + (f.mode === 'airhit' ? 4 * 256 : 0), f.vy + g);
  }
  const prevY = f.y;
  const prevX = f.x;
  f.x += f.vx;
  f.y += f.vy;
  if (f.dropT > 0) f.dropT--;
  // 대시로 벽 쪽으로 가다 벽에 닿으면 벽 달리기
  if ((f.mode === 'dash' || f.mode === 'airdash') && tryWallRun(s, f, prevX)) return;
  if (airborne) {
    if (f.vy >= 0) {
      const top = landingY(s, f.x, prevY, f.y, f.dropT > 0);
      if (top !== null) {
        f.y = top;
        f.floor = top;
        f.vy = 0;
        land(s, f);
      }
    }
    return;
  }
  const under = floorBelow(s, f.x, f.y, f.dropT > 0);
  if (under !== f.y) fallOff(f);
  else f.floor = under;
}

function land(s: SimState, f: Fighter): void {
  // 땅·발판에 내려서면 같은 벽을 다시 처음부터 디딜 수 있다
  f.wallId = -1;
  f.wallCount = 0;
  f.wallSide = 0;
  switch (f.mode) {
    case 'air':
    case 'airdash':
    case 'tech':
    case 'wallcling':
      setMode(f, 'land', STATS.landTicks);
      f.vx = 0;
      break;
    case 'attack':
      setMode(f, 'land', STATS.airAttackLandTicks);
      f.vx = 0;
      break;
    case 'airhit':
      if (f.bounce) {
        f.bounce = false;
        f.vy = BOUNCE_VY;
        f.y -= 1;
        f.vx = Math.trunc(f.vx / 2);
      } else {
        setMode(f, 'knockdown', KNOCKDOWN_TICKS);
        f.invuln = KNOCKDOWN_TICKS;
        s.events.push({ type: 'knockdown', who: s.fighters.indexOf(f), x: f.x, y: f.y });
      }
      break;
    case 'ko':
      f.vx = Math.trunc(f.vx / 2);
      break;
    default:
      break;
  }
}

/** 지상 대기 상태면 상대 쪽을 본다 */
export function faceOpponent(f: Fighter, o: Fighter): void {
  if (isAirborne(f)) return;
  if (!['idle', 'run', 'guard', 'land', 'jumpsquat', 'getup', 'blockstun', 'hitstun', 'crush'].includes(f.mode)) return;
  if (Math.abs(o.x - f.x) < 256) return;
  const want: 1 | -1 = o.x > f.x ? 1 : -1;
  if (want !== f.facing) {
    f.facing = want;
  }
}

