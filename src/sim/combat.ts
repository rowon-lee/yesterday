import { hurtBox, type Box } from '../anim/boxes';
import type { MoveId } from '../data/moves/base';
import { MOVES, movesOf, moveHitBox } from './frames';
import { damageCity, wallBehind, wallSplat } from './city';
import { CITY_RULES as CITY, KEEP_RULES } from '../stage/citadel';
import { damageCitadel, superCitadel, towerBehind } from './citadel';
import { startCine } from './cine';
import { smashProps } from './props';
import { isAirborne, setMode } from './fighter';
import { wallLeft } from './platforms';
import { fighterPose } from './pose';
import {
  AIR_HIT_DEFAULT, BLOCK_HITSTOP_CUT, CRUSH_TICKS, FLASH_TICKS, METER_BLOCK, METER_BLOCKED, METER_HIT, METER_HURT,
  METER_MAX, px, SCALE_MIN, SCALE_STEP, SPIKE_VY, STUN_DECAY_FROM, STUN_DECAY_MIN, STUN_DECAY_STEP, WALL_R, WALL_TECH_TICKS,
} from './rules';
import type { Fighter, SimState } from './types';

/** 월드 상자 (1/256px). 관절은 발밑 기준 px이므로 방향을 반영해 옮긴다. */
export interface WBox {
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
  // 다운은 내내 무적. 기상은 무적 틱(앞 20틱)이 지나면 다시 맞는다 (공통 동작 사양서)
  if (f.invuln > 0 || f.mode === 'knockdown' || f.mode === 'ko' || f.mode === 'wallsplat' || f.mode === 'cine') return null;
  return toWorld(f, hurtBox(fighterPose(f).joints));
}

/** 공격 상자: 기술의 판정 프레임에서 팔꿈치→주먹 / 무릎→발 구간. 이미 냈으면 null */
/** 지금 기술의 판정 상자 (이미 맞혔어도). 부서지는 물건 판정용 */
export function activeHitOf(f: Fighter): WBox | null {
  if (f.mode !== 'attack' || !f.move) return null;
  const b = moveHitBox(movesOf(f.char)[f.move], f.t);
  return b && toWorld(f, b);
}

export function hitOf(f: Fighter): WBox | null {
  if (f.mode !== 'attack' || f.moveHit || !f.move) return null;
  const b = moveHitBox(movesOf(f.char)[f.move], f.t);
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

/**
 * 한 대 맞힘 (또는 막힘). final: 필살기 연출의 끝 타격 (연출을 다시 시작하지 않고, 연출 데이터의 끝 날리기를 쓴다)
 */
function applyHit(s: SimState, att: Fighter, def: Fighter, hb: WBox, id: MoveId, final = false): void {
  // 연출 중에는 판정이 없다 (같은 틱에 둘 다 맞혔으면 먼저 연출을 시작한 쪽만)
  if (s.cine) return;
  const mv = movesOf(att.char)[id];
  const d = mv.data;
  // 차지는 모은 단계마다 피해·방어 깎기·날리기·벽 쪽으로 날림이 다르다
  const lvl = d.charge ? d.charge.levels[Math.max(0, Math.min(d.charge.levels.length, att.chargeLv) - 1)] : undefined;
  const baseDamage = lvl?.damage ?? d.damage;
  const guardDamage = lvl?.guardDamage ?? d.guardDamage;
  const end = final ? d.cinematic?.end : undefined;
  const launch = end ? { vx: px(end.launch.vx), vy: px(end.launch.vy) } : lvl ? { vx: px(lvl.launch.vx), vy: px(lvl.launch.vy) } : mv.launch;
  const wall = end ? end.wall === true : lvl ? lvl.wall === true : d.wall === true;
  const dir = att.facing;
  const who = s.fighters.indexOf(att);
  const ex = Math.trunc((Math.max(hb.x0, Math.min(hb.x1, def.x)) + (dir > 0 ? hb.x1 : hb.x0)) / 2);
  const ey = Math.trunc((hb.y0 + hb.y1) / 2);
  att.moveHit = true;
  const gainer = !d.meterCost;
  const blocked = !final && blocks(def, att);
  // 필살기 연출: 막히지 않고 맞으면 연출로 넘어간다 (피해·파괴는 연출 끝 타격에서 한 번에)
  if (d.cinematic && !final && !blocked) {
    att.moveConnected = true;
    startCine(s, att, def, id);
    return;
  }
  // 센 타격은 맞은 자리 뒤 건물 정면을 깎는다 (막혀도). 시타델 구역이면 본관도 (필살기는 hitCitadel이 따로)
  if (d.heavy) {
    damageCity(s, Math.round(ex / 256), Math.round(-ey / 256), CITY.hit.radius, CITY.hit.amount, 'hit');
    if (!d.cutin) damageCitadel(s, Math.round(ex / 256), blocked ? KEEP_RULES.damage.blocked : KEEP_RULES.damage.heavy, who);
  }

  if (blocked) {
    def.guard -= guardDamage;
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
  const damage = Math.max(1, Math.trunc((baseDamage * scale) / 100));
  def.hp = Math.max(s.practice ? 1 : 0, def.hp - damage);
  def.comboHits++;
  def.flash = FLASH_TICKS;
  att.hitstop = d.hitstop;
  def.hitstop = d.hitstop;
  if (gainer) att.meter = Math.min(METER_MAX, att.meter + METER_HIT);
  def.meter = Math.min(METER_MAX, def.meter + METER_HURT);
  def.facing = -dir as 1 | -1;
  def.bounce = false;
  // '벽 쪽으로 날림' 기술에 맞아 날아가면 큰 물건에 부딪혀 무너뜨린다 (props.ts)
  def.wallFly = wall;
  s.events.push({ type: 'hit', who, x: ex, y: ey, heavy: d.heavy ?? false, combo: def.comboHits, move: mv.id });

  const airborne = isAirborne(def) || def.mode === 'airhit';
  if (def.hp <= 0) {
    knockOut(s, def, dir, who);
    return;
  }
  // 벽꽝: '벽 쪽으로 날림' 기술이고 뒤에 건물 정면이나 시타델 기둥탑이 서 있으면 박힌다 (기둥탑이면 본관 내구도도 깎인다)
  // (추가 피해는 벽 낙법 구간이 지나 정말 박힌 뒤에: splatLands)
  const sx = Math.round(def.x / 256);
  const sh = Math.round(-def.y / 256) + 22;
  const tower = wall && towerBehind(s, sx, sh);
  if (wall && (tower || wallBehind(s, sx, sh))) {
    if (tower) damageCitadel(s, sx, KEEP_RULES.damage.splat, who);
    setMode(def, 'wallsplat', CITY.wallsplat.ticks);
    def.vx = 0;
    def.vy = 0;
    def.wallFly = false;
    wallSplat(s, def, who);
    return;
  }
  if (d.spike && airborne) {
    setMode(def, 'airhit', d.hitstun);
    def.vx = dir * px(0.8);
    def.vy = SPIKE_VY;
    def.bounce = true;
    return;
  }
  if (airborne || launch || d.knockdown || d.spike) {
    const v = launch ?? (d.knockdown || d.spike
      ? { vx: px(1.8), vy: px(-3.6) }
      : { vx: px(AIR_HIT_DEFAULT.vx), vy: px(AIR_HIT_DEFAULT.vy) });
    setMode(def, 'airhit', d.hitstun);
    def.vx = dir * v.vx;
    def.vy = v.vy;
    def.y = Math.min(def.y, -1);
    // 떠오르면 서 있던 바닥(발판)을 떠난다
    if (def.vy < 0) def.floor = 0;
    // 공중에서 맞히면 때린 쪽도 함께 떠올라 다음 타가 이어지게 한다
    if (d.airFollow !== undefined && isAirborne(att)) att.vy = def.vy + px(d.airFollow);
    if (!airborne && mv.launch && mv.id === 'launcher') s.events.push({ type: 'launch', who, x: def.x, y: def.y });
    return;
  }
  const decay = Math.max(0, def.comboHits - STUN_DECAY_FROM) * STUN_DECAY_STEP;
  setMode(def, 'hitstun', Math.max(Math.ceil((d.hitstun * STUN_DECAY_MIN) / 100), d.hitstun - decay));
  def.heavyHit = d.hitstun >= 24;
  def.vx = dir * mv.push;
  pushOffWall(att, def, mv.push);
}

/**
 * 벽꽝으로 박힌 쪽이 벽 낙법 구간(히트스톱 뒤 WALL_TECH_TICKS틱) 안에 낙법을 못 했으면 정말 박힌다: 벽꽝 추가 피해.
 * 틱마다 두 사람이 움직인 뒤에 부른다.
 */
export function splatLands(s: SimState): void {
  s.fighters.forEach((f, i) => {
    if (f.mode !== 'wallsplat' || f.hitstop > 0 || f.t !== WALL_TECH_TICKS + 1) return;
    f.hp = Math.max(s.practice ? 1 : 0, f.hp - CITY.wallsplat.damage);
    if (f.hp <= 0) knockOut(s, f, -f.facing, 1 - i);
  });
}

/**
 * 필살기 연출 끝 타격: 상대에게 피해·날리기를 한 번에 주고, 그 자리 둘레의 건물·물건·시타델을 부순다
 * (연출 동안 미뤄 둔 파괴). 끝 자리를 감싼 상자로 판정한다
 */
export function cinematicFinish(s: SimState, att: Fighter, def: Fighter, id: MoveId): void {
  const blow: WBox = { x0: def.x - px(20), x1: def.x + px(20), y0: def.y - px(50), y1: def.y + px(4) };
  applyHit(s, att, def, blow, id, true);
  const wide: WBox = { x0: def.x - px(44), x1: def.x + px(44), y0: def.y - px(80), y1: def.y + px(6) };
  smashProps(s, att, wide, MOVES[id].data.damage, true);
  superCitadel(s, s.fighters.indexOf(att), wide);
}

/** 체력이 0이 된 쪽을 날려 쓰러뜨린다 */
export function knockOut(s: SimState, def: Fighter, dir: number, who: number): void {
  setMode(def, 'ko');
  def.vx = dir * px(6);
  def.vy = px(-7);
  def.y = Math.min(def.y, -1);
  def.floor = 0;
  def.invuln = 1;
  s.events.push({ type: 'ko', who, x: def.x, y: def.y });
}

/** 맞은 쪽이 벽에 붙어 더 밀릴 수 없으면 때린 쪽이 대신 밀린다 */
function pushOffWall(att: Fighter, def: Fighter, push: number): void {
  if (isAirborne(att)) return;
  if (def.x <= wallLeft(def.y) + px(4) || def.x >= WALL_R - px(4)) att.vx = -att.facing * Math.trunc((push * 4) / 5);
}
