import { hurtBox, type Box } from '../anim/boxes';
import type { MoveId } from '../data/moves/base';
import { MOVES, moveHitBox } from './frames';
import { isAirborne, setMode } from './fighter';
import { fighterPose } from './pose';
import {
  AIR_HIT_DEFAULT, BLOCK_HITSTOP_CUT, CRUSH_TICKS, FLASH_TICKS, METER_BLOCK, METER_BLOCKED, METER_HIT, METER_HURT,
  METER_MAX, px, SCALE_MIN, SCALE_STEP, SPIKE_VY, STUN_DECAY_FROM, STUN_DECAY_MIN, STUN_DECAY_STEP, WALL_L, WALL_R,
} from './rules';
import type { Fighter, SimState } from './types';

/** 월드 상자 (1/256px). 관절은 발밑 기준 px이므로 방향을 반영해 옮긴다. */
interface WBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function toWorld(f: Fighter, b: Box): WBox {
  const xa = f.facing > 0 ? b.x : -(b.x + b.w);
  return { x0: f.x + px(xa), x1: f.x + px(xa + b.w), y0: f.y + px(b.y), y1: f.y + px(b.y + b.h) };
}

const overlap = (a: WBox, b: WBox): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** 피격 상자: 지금 프레임의 몸 관절을 감싼 상자. 무적이면 null */
export function hurtOf(f: Fighter): WBox | null {
  if (f.invuln > 0 || f.mode === 'knockdown' || f.mode === 'getup' || f.mode === 'ko') return null;
  return toWorld(f, hurtBox(fighterPose(f).joints));
}

/** 공격 상자: 기술의 판정 프레임에서 팔꿈치→주먹 / 무릎→발 구간. 이미 냈으면 null */
export function hitOf(f: Fighter): WBox | null {
  if (f.mode !== 'attack' || f.moveHit || !f.move) return null;
  const b = moveHitBox(MOVES[f.move], f.t);
  return b && toWorld(f, b);
}

/** 상자 두 개 다 (렌더의 판정 표시용) */
export function boxesOf(f: Fighter): { hurt: WBox | null; hit: WBox | null } {
  return { hurt: hurtOf(f), hit: hitOf(f) };
}

/** 둘의 공격을 동시에 판정한다 (서로 맞으면 둘 다 맞음). */
export function resolveHits(s: SimState): void {
  const [a, b] = s.fighters;
  // 판정을 먼저 다 모은 뒤 적용한다. 서로 맞으면 먼저 적용한 쪽이 상대의 기술을 지워 버리므로 기술을 미리 적어 둔다.
  const hits: Array<[Fighter, Fighter, WBox, MoveId]> = [];
  for (const [att, def] of [[a, b], [b, a]] as const) {
    const hb = hitOf(att);
    const hu = hurtOf(def);
    if (hb && hu && overlap(hb, hu)) hits.push([att, def, hb, att.move!]);
  }
  for (const [att, def, hb, id] of hits) applyHit(s, att, def, hb, id);
}

function blocks(def: Fighter, att: Fighter): boolean {
  if (isAirborne(def)) return false;
  if (def.mode !== 'guard' && def.mode !== 'blockstun') return false;
  // 앞에서 오는 공격만 막는다
  return (att.x - def.x) * def.facing >= 0;
}

function applyHit(s: SimState, att: Fighter, def: Fighter, hb: WBox, id: MoveId): void {
  const mv = MOVES[id];
  const d = mv.data;
  const dir = att.facing;
  const who = s.fighters.indexOf(att);
  const ex = Math.trunc((Math.max(hb.x0, Math.min(hb.x1, def.x)) + (dir > 0 ? hb.x1 : hb.x0)) / 2);
  const ey = Math.trunc((hb.y0 + hb.y1) / 2);
  att.moveHit = true;
  const gainer = !d.meterCost;

  if (blocks(def, att)) {
    def.guard -= d.guardDamage;
    const stop = Math.max(4, d.hitstop - BLOCK_HITSTOP_CUT);
    att.hitstop = stop;
    def.hitstop = stop;
    if (gainer) att.meter = Math.min(METER_MAX, att.meter + METER_BLOCK);
    def.meter = Math.min(METER_MAX, def.meter + METER_BLOCKED);
    if (def.guard <= 0) {
      def.guard = 0;
      setMode(def, 'crush', CRUSH_TICKS);
      def.vx = dir * mv.push;
      s.events.push({ type: 'crush', who, x: ex, y: ey, heavy: true, move: mv.id });
    } else {
      setMode(def, 'blockstun', d.blockstun);
      def.vx = dir * mv.push;
      s.events.push({ type: 'block', who, x: ex, y: ey, move: mv.id });
    }
    pushOffWall(att, def, mv.push);
    return;
  }

  att.moveConnected = true;
  const scale = Math.max(SCALE_MIN, 100 - SCALE_STEP * def.comboHits);
  const damage = Math.max(1, Math.trunc((d.damage * scale) / 100));
  def.hp = Math.max(0, def.hp - damage);
  def.comboHits++;
  def.flash = FLASH_TICKS;
  att.hitstop = d.hitstop;
  def.hitstop = d.hitstop;
  if (gainer) att.meter = Math.min(METER_MAX, att.meter + METER_HIT);
  def.meter = Math.min(METER_MAX, def.meter + METER_HURT);
  def.facing = -dir as 1 | -1;
  def.bounce = false;
  if (d.airFollow !== undefined && isAirborne(att)) att.vy = Math.min(att.vy, px(d.airFollow));
  s.events.push({ type: 'hit', who, x: ex, y: ey, heavy: d.heavy ?? false, combo: def.comboHits, move: mv.id });

  const airborne = isAirborne(def) || def.mode === 'airhit';
  if (def.hp <= 0) {
    setMode(def, 'ko');
    def.vx = dir * px(2.2);
    def.vy = px(-3.6);
    def.y = Math.min(def.y, -1);
    def.invuln = 1;
    s.events.push({ type: 'ko', who, x: def.x, y: def.y });
    return;
  }
  if (d.spike && airborne) {
    setMode(def, 'airhit', d.hitstun);
    def.vx = dir * px(0.5);
    def.vy = SPIKE_VY;
    def.bounce = true;
    return;
  }
  if (airborne || mv.launch || d.knockdown || d.spike) {
    const v = mv.launch ?? (d.knockdown || d.spike
      ? { vx: px(1.0), vy: px(-2.2) }
      : { vx: px(AIR_HIT_DEFAULT.vx), vy: px(AIR_HIT_DEFAULT.vy) });
    setMode(def, 'airhit', d.hitstun);
    def.vx = dir * v.vx;
    def.vy = v.vy;
    def.y = Math.min(def.y, -1);
    if (!airborne && mv.launch && mv.id === 'launcher') s.events.push({ type: 'launch', who, x: def.x, y: def.y });
    return;
  }
  const decay = Math.max(0, def.comboHits - STUN_DECAY_FROM) * STUN_DECAY_STEP;
  setMode(def, 'hitstun', Math.max(Math.ceil((d.hitstun * STUN_DECAY_MIN) / 100), d.hitstun - decay));
  def.heavyHit = d.hitstun >= 24;
  def.vx = dir * mv.push;
  pushOffWall(att, def, mv.push);
}

/** 맞은 쪽이 벽에 붙어 더 밀릴 수 없으면 때린 쪽이 대신 밀린다 */
function pushOffWall(att: Fighter, def: Fighter, push: number): void {
  if (isAirborne(att)) return;
  if (def.x <= WALL_L + px(4) || def.x >= WALL_R - px(4)) att.vx = -att.facing * Math.trunc((push * 4) / 5);
}
