import { AIR_CHAIN, GROUND_CHAIN, type MoveId } from '../data/moves/base';
import { MOVES, STATS } from './frames';
import {
  IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT, IN_SKILL_A, IN_SKILL_B, IN_SUPER, IN_UP, type PlayerInput,
} from './input';
import {
  BOUNCE_VY, BUFFER_TICKS, GETUP_TICKS, GUARD_MAX, GUARD_REGEN_DELAY, GUARD_REGEN_EVERY,
  JUGGLE_GRAVITY_MAX, JUGGLE_GRAVITY_PER_HIT, KNOCKDOWN_TICKS, METER_BAR, SUPER_FREEZE, TECH_HITS, TECH_TICKS, TECH_VX, TECH_VY,
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
}

export const isAirborne = (f: Fighter): boolean => f.y < 0 || f.vy < 0;

/** 조작을 받는 상태 (콤보가 끝난 것으로 본다) */
const NEUTRAL: ReadonlySet<Mode> = new Set(['idle', 'run', 'guard', 'air', 'land', 'dash', 'airdash', 'jumpsquat', 'attack']);

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
  if (take(f, B_JUMP)) return setMode(f, 'jumpsquat', STATS.jumpSquat);
  if (take(f, B_DASH)) {
    setMode(f, 'dash', STATS.dashTicks);
    f.dir = input & back ? -1 : 1;
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
  const h = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
  if (h) f.vx = Math.max(-STATS.airMaxVx, Math.min(STATS.airMaxVx, f.vx + h * STATS.airAccel));
}

function airControl(s: SimState, f: Fighter, input: PlayerInput): void {
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

/** 이동, 중력, 착지 */
export function physics(s: SimState, f: Fighter): void {
  const airborne = isAirborne(f);
  if (airborne && f.mode !== 'airdash') {
    let g = STATS.gravity;
    if (f.mode === 'airhit') g += Math.min(JUGGLE_GRAVITY_MAX, f.comboHits * JUGGLE_GRAVITY_PER_HIT);
    f.vy = Math.min(STATS.maxFall + (f.mode === 'airhit' ? 4 * 256 : 0), f.vy + g);
  }
  f.x += f.vx;
  f.y += f.vy;
  if (f.y >= 0 && airborne) {
    f.y = 0;
    f.vy = 0;
    land(s, f);
  }
  if (!isAirborne(f)) f.y = 0;
}

function land(s: SimState, f: Fighter): void {
  switch (f.mode) {
    case 'air':
    case 'airdash':
    case 'tech':
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
        f.y = -1;
        f.vx = Math.trunc(f.vx / 2);
      } else {
        setMode(f, 'knockdown', KNOCKDOWN_TICKS);
        f.invuln = KNOCKDOWN_TICKS;
        s.events.push({ type: 'knockdown', who: s.fighters.indexOf(f), x: f.x, y: 0 });
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

