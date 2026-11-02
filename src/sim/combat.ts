import { hurtBox, type Box } from '../anim/boxes';
import type { MoveId } from '../data/moves/base';
import { movesOf, moveHitBox, moveHitLine } from './frames';
import { damageCity, wallBehind, wallSplat } from './city';
import { CITY_RULES as CITY, KEEP_RULES } from '../stage/citadel';
import { damageCitadel, superCitadel, towerBehind } from './citadel';
import { startCine } from './cine';
import { smashProps } from './props';
import { isAirborne, setMode } from './fighter';
import { wallLeft } from './platforms';
import { fighterPose } from './pose';
import {
  AIR_HIT_DEFAULT, BLOCK_HITSTOP_CUT, CRUSH_TICKS, FLASH_TICKS, KONGO_MAX, KONGO_PUSH, KONGO_TICKS, METER_BLOCK, METER_BLOCKED, METER_HIT, METER_HURT,
  METER_MAX, px, SCALE_MIN, SCALE_STEP, SPIKE_VY, STUN_DECAY_FROM, STUN_DECAY_MIN, STUN_DECAY_STEP, WALL_R, WALL_TECH_TICKS,
  ZAN_H, ZAN_PAD, ZAN_SLOW,
} from './rules';
import type { Fighter, SimState } from './types';
import { hooksOf } from './chars';

/** 월드 상자 (1/256px). 관절은 발밑 기준 px이므로 방향을 반영해 옮긴다. */
export interface WBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function toWorld(f: Fighter, b: Box): WBox {
  const xa = f.facing > 0 ? b.x : -(b.x + b.w);
  return { x0: f.x + px(xa), x1: f.x + px(xa + b.w), y0: f.y + px(b.y), y1: f.y + px(b.y + b.h) };
}

export const overlap = (a: WBox, b: WBox): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * 판정 선(휘는 무기)이 상자를 지나는가: 이은 선분 하나라도 상자 안에 들어오거나 상자 변과 만나면 참.
 * 점은 월드 1/256px 정수라 정수 비교·곱만 쓴다 (결정론)
 */
function lineHits(pts: ReadonlyArray<readonly [number, number]>, b: WBox): boolean {
  const inside = (x: number, y: number) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  const meets = (p: readonly [number, number], q: readonly [number, number], c: readonly [number, number], d: readonly [number, number]) =>
    cross(p[0], p[1], q[0], q[1], c[0], c[1]) * cross(p[0], p[1], q[0], q[1], d[0], d[1]) <= 0 &&
    cross(c[0], c[1], d[0], d[1], p[0], p[1]) * cross(c[0], c[1], d[0], d[1], q[0], q[1]) <= 0;
  const corners: Array<readonly [number, number]> = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (inside(p[0], p[1])) return true;
    const q = pts[i + 1];
    if (!q) break;
    // 선분이 상자 둘레 상자 밖으로 완전히 벗어나면 건너뛴다
    if (Math.max(p[0], q[0]) < b.x0 || Math.min(p[0], q[0]) > b.x1 || Math.max(p[1], q[1]) < b.y0 || Math.min(p[1], q[1]) > b.y1) continue;
    for (let k = 0; k < 4; k++) if (meets(p, q, corners[k]!, corners[(k + 1) % 4]!)) return true;
  }
  return false;
}

/** 판정 선의 굵기 (px): 그린 칼날 굵기(2px)와 외곽선만큼, 선에서 이만큼 안이면 닿는다 */
const LINE_PAD = 3;

/** 지금 판정 선이 있는 기술이면 그 선이 상자 hu를 지나는가 (선이 없으면 늘 참: 상자끼리 겹침으로 정한다) */
function lineReaches(f: Fighter, hu: WBox): boolean {
  const line = f.move ? moveHitLine(movesOf(f.char)[f.move], f.t) : null;
  if (!line) return true;
  const p = px(LINE_PAD);
  return lineHits(line.map(([x, y]) => [f.x + px(f.facing * x), f.y + px(y)] as const), { x0: hu.x0 - p, y0: hu.y0 - p, x1: hu.x1 + p, y1: hu.y1 + p });
}

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
  const mv = movesOf(f.char)[f.move];
  // 판정을 캐릭터 고유 규칙이 직접 내는 기술 (오스카 베기 선): 공통 판정·물건 깎기를 하지 않는다
  if (mv.data.selfHit) return null;
  const b = moveHitBox(mv, f.t, f.chargeLv);
  return b && toWorld(f, b);
}

export function hitOf(f: Fighter): WBox | null {
  if (f.mode !== 'attack' || f.moveHit || !f.move) return null;
  const mv = movesOf(f.char)[f.move];
  if (mv.data.selfHit) return null;
  const b = moveHitBox(mv, f.t, f.chargeLv);
  return b && toWorld(f, b);
}

/** 상자 두 개 다 (렌더의 판정 표시용) */
export function boxesOf(f: Fighter): { hurt: WBox | null; hit: WBox | null } {
  // 판정 표시(디버그): 이미 맞혔어도 판정 프레임 동안의 상자를 보인다 (번개 범위와 겹쳐 확인하려고)
  return { hurt: hurtOf(f), hit: activeHitOf(f) };
}

/** 둘의 공격을 동시에 판정한다 (서로 맞으면 둘 다 맞음). */
export function resolveHits(s: SimState): void {
  const [a, b] = s.fighters;
  // 판정을 먼저 다 모은 뒤 적용한다. 서로 맞으면 먼저 적용한 쪽이 상대의 기술을 지워 버리므로 기술을 미리 적어 둔다.
  const hits: Array<[Fighter, Fighter, WBox, MoveId]> = [];
  for (const [att, def] of [[a, b], [b, a]] as const) {
    const hb = hitOf(att);
    const hu = hurtOf(def);
    if (hb && hu && overlap(hb, hu) && lineReaches(att, hu)) hits.push([att, def, hb, att.move!]);
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
/**
 * 몸 관절이 아닌 자리에서 나는 판정 (오스카 검격·원격 베기 등, 캐릭터 고유 규칙이 부른다): 월드 상자 box가 상대 피격 상자에 닿으면
 * 그 기술로 맞힌다 (막기·특성·이벤트 모두 보통 타격과 같다). 이번 기술이 이미 판정을 냈으면 아무것도 하지 않는다. 맞혔거나 막혔으면 true
 */
export function strikeBox(s: SimState, att: Fighter, box: WBox, id: MoveId): boolean {
  if (att.moveHit || s.cine) return false;
  const def = s.fighters[1 - s.fighters.indexOf(att)];
  const hurt = hurtOf(def);
  if (!hurt || !overlap(box, hurt)) return false;
  applyHit(s, att, def, box, id);
  return true;
}

function applyHit(s: SimState, att: Fighter, def: Fighter, hb: WBox, id: MoveId, final = false): void {
  const r = applyHitInner(s, att, def, hb, id, final);
  if (r) hooksOf(att.char).hit?.(s, att, def, id, r === 'block', r === 'shield');
}

function applyHitInner(s: SimState, att: Fighter, def: Fighter, hb: WBox, id: MoveId, final: boolean): 'hit' | 'block' | 'shield' | null {
  // 연출 중에는 판정이 없다 (같은 틱에 둘 다 맞혔으면 먼저 연출을 시작한 쪽만)
  if (s.cine) return null;
  const mv = movesOf(att.char)[id];
  const d = mv.data;
  // 차지는 모은 단계마다 피해·방어 깎기·날리기·벽 쪽으로 날림이 다르다
  const lvl = d.charge ? d.charge.levels[Math.max(0, Math.min(d.charge.levels.length, att.chargeLv) - 1)] : undefined;
  const baseDamage = lvl?.damage ?? d.damage;
  const guardDamage = lvl?.guardDamage ?? d.guardDamage;
  const end = final ? d.cinematic?.end : undefined;
  // 차지 단계에 날리기가 없으면 띄우지 않고 그 단계의 밀림(push)으로 땅에서 밀려난다
  const launch = end
    ? { vx: px(end.launch.vx), vy: px(end.launch.vy) }
    : lvl ? (lvl.launch && { vx: px(lvl.launch.vx), vy: px(lvl.launch.vy) }) : mv.launch;
  const push = lvl?.push !== undefined ? px(lvl.push) : mv.push;
  const wall = end ? end.wall === true : lvl ? lvl.wall === true : d.wall === true;
  const dir = att.facing;
  const who = s.fighters.indexOf(att);
  const ex = Math.trunc((Math.max(hb.x0, Math.min(hb.x1, def.x)) + (dir > 0 ? hb.x1 : hb.x0)) / 2);
  const ey = Math.trunc((hb.y0 + hb.y1) / 2);
  att.moveHit = true;
  const gainer = !d.meterCost;
  const blocked = !final && blocks(def, att);
  // 금강불괴는 이 합 전에 켜져 있었을 때만 막는다 (이 합으로 4스택이 되면 다음 합부터)
  const armored = def.kongoT > 0 && !final && !d.cinematic;
  gainKongo(s, att);
  gainKongo(s, def);
  // 필살기 연출: 막히지 않고 맞으면 연출로 넘어간다 (피해·파괴는 연출 끝 타격에서 한 번에)
  if (d.cinematic && !final && !blocked) {
    att.moveConnected = true;
    startCine(s, att, def, id);
    return 'hit';
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
    // 막혀도 방어를 깨는 타격 (캐릭터 고유 규칙: 에드워드 재현:나 등)
    if (hooksOf(att.char).breaks?.(s, att, def, id)) def.guard = 0;
    if (def.guard <= 0) {
      def.guard = 0;
      setMode(def, 'crush', CRUSH_TICKS);
      def.vx = dir * push;
      s.events.push({ type: 'crush', who, x: ex, y: ey, heavy: true, move: mv.id });
    } else {
      setMode(def, 'blockstun', d.blockstun);
      def.vx = dir * push;
      s.events.push({ type: 'block', who, x: ex, y: ey, move: mv.id });
    }
    pushOffWall(att, def, push);
    return 'block';
  }

  const scale = Math.max(SCALE_MIN, 100 - SCALE_STEP * def.comboHits);
  let damage = Math.max(1, Math.trunc((baseDamage * scale) / 100));
  // 캐릭터 고유 규칙: 때리는 쪽이 피해를 바꾸고 (강화·검영 수), 맞는 쪽이 받는다 (껍데기가 대신 받음, 방어막이 통째로 막음)
  damage = hooksOf(att.char).damage?.(s, att, def, id, damage) ?? damage;
  const took = hooksOf(def.char).defend?.(s, def, att, id, damage) ?? damage;
  if (took < 0) {
    att.hitstop = d.hitstop;
    def.hitstop = d.hitstop;
    s.events.push({ type: 'char', who: s.fighters.indexOf(def), x: ex, y: ey, text: 'shield', move: mv.id });
    return 'shield';
  }
  att.moveConnected = true;
  damage = took;
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
    return 'hit';
  }
  // 금강불괴: 하던 동작을 그대로 이어 간다 (경직은 히트스톱뿐, 띄우기·다운·벽꽝 없음), 땅에서는 밀리는 힘 80% 감소
  if (armored) {
    def.comboHits = 0;
    if (!airborne) {
      // 하던 동작이 속도를 정하므로 밀림은 자리로 준다: 보통 경직 동안 밀리는 거리(약 4틱 × 밀림 속도)의 20%
      const shove = Math.trunc((push * KONGO_PUSH * 4) / 100);
      def.x += dir * shove;
      pushOffWall(att, def, shove);
    }
    return 'hit';
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
    return 'hit';
  }
  if (d.spike && airborne) {
    setMode(def, 'airhit', d.hitstun);
    def.vx = dir * px(0.8);
    def.vy = SPIKE_VY;
    def.bounce = true;
    return 'hit';
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
    return 'hit';
  }
  const decay = Math.max(0, def.comboHits - STUN_DECAY_FROM) * STUN_DECAY_STEP;
  setMode(def, 'hitstun', Math.max(Math.ceil((d.hitstun * STUN_DECAY_MIN) / 100), d.hitstun - decay));
  def.heavyHit = d.hitstun >= 24;
  def.vx = dir * push;
  pushOffWall(att, def, push);
  return 'hit';
}

/**
 * 라이덴 고유 특성 금강: 합을 주고받을 때마다 1스택, 4스택이면 금강불괴 (rules.ts KONGO_*).
 * 금강불괴 동안에는 쌓이지 않는다
 */
function gainKongo(s: SimState, f: Fighter): void {
  if (f.char !== 'raiden' || f.kongoT > 0) return;
  f.kongo++;
  if (f.kongo >= KONGO_MAX) {
    f.kongo = 0;
    f.kongoT = KONGO_TICKS;
    s.events.push({ type: 'kongo', who: s.fighters.indexOf(f), x: f.x, y: f.y });
  }
}

/**
 * 라이덴 스킬 1 잔흔: 남긴 잔상(떠난 자리~나타난 자리 띠)이 남아 있는 동안 상대 몸이 닿으면 상대가 느려진다 (잔상 하나에 한 번).
 * 무적(다운·대시 무적 등)이면 닿지 않는다. 틱마다 판정 뒤에 부른다
 */
export function zanTouch(s: SimState): void {
  s.fighters.forEach((f, i) => {
    if (f.zanT <= 0) return;
    f.zanT--;
    if (f.zanHit) return;
    const o = s.fighters[1 - i];
    const hu = hurtOf(o);
    if (!hu) return;
    const zone: WBox = {
      x0: Math.min(f.zanX0, f.zanX1) - px(ZAN_PAD),
      x1: Math.max(f.zanX0, f.zanX1) + px(ZAN_PAD),
      y0: f.zanY - px(ZAN_H),
      y1: f.zanY,
    };
    if (!overlap(zone, hu)) return;
    f.zanHit = true;
    o.slowT = ZAN_SLOW;
    s.events.push({ type: 'slowed', who: i, x: o.x, y: o.y });
  });
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
  smashProps(s, att, wide, movesOf(att.char)[id].data.damage, true);
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
