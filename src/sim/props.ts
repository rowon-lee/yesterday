import { BIG, BREAK_RULES, BREAKABLES, CITY_RULES, tramAt, tramRestX } from '../stage/citadel';
import { damageCity } from './city';
import { activeHitOf, knockOut, type WBox } from './combat';
import { MOVES } from './frames';
import { px } from './rules';
import type { Fighter, PropState, SimState } from './types';

/**
 * 부서지는 물건. 부서진 물건은 판정에 영향을 주지 않는 장식이다 (막지 않는다). 큰 물건은 예외로 무너진 뒤 발판·벽이 된다
 * (sim/platforms.ts).
 * - 공격 판정이 물건에 닿으면 그 기술의 피해만큼 내구도가 깎인다 (기술 하나에 물건마다 한 번)
 * - 내구도가 절반 아래면 '망가짐', 0이면 '파괴'
 * - 세게 날아온 캐릭터가 부딪히면 한 번에 부서지고, 부딪힌 쪽은 추가 피해를 입는다
 * - 큰 물건(노면전차·급수탑·등대·시타델 간판)은 평타·기술·부딪힘으로는 망가짐까지만 간다.
 *   필살기가 닿거나, '벽 쪽으로 날림' 기술에 맞아 날아온 상대가 부딪히면 한 번에 크게 무너진다.
 */
export function createProps(): PropState[] {
  return BREAKABLES.map((b) => ({ hp: b.hp, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1, at: 0 }));
}

const CRASH_SPEED = px(BREAK_RULES.crashSpeed);
/** 날아가는 몸의 높이 (발밑에서) */
const BODY_H = px(40);
const FLYING = new Set(['airhit', 'ko', 'hitstun', 'crush']);

/** 크게 무너뜨린 까닭 (이벤트 combo): 필살기, 벽 쪽으로 날린 상대가 부딪힘, 받치던 건물이 무너짐 */
export const SMASH_SUPER = 1;
export const SMASH_WALL = 2;
export const SMASH_COLLAPSE = 3;

/** 물건의 판정 상자 (월드, 1/256px). 지금 없는 물건(다니지 않는 노면전차)이면 null */
function boxOf(s: SimState, i: number): WBox | null {
  const b = BREAKABLES[i];
  let x = b.x;
  if (b.kind === 'tram') {
    const t = tramAt(s.clock);
    if (!t) return null;
    x = t.x;
  }
  return { x0: px(x), x1: px(x + b.w), y0: -px(b.bottom + b.h), y1: -px(b.bottom) };
}

const overlap = (a: WBox, b: WBox): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * 내구도를 깎는다. smash가 0이 아니면 큰 물건도 한 번에 무너진다 (까닭 번호). 큰 물건은 smash 없이는 1 아래로 내려가지 않는다.
 */
function damage(s: SimState, i: number, box: WBox, amount: number, dir: number, crash: boolean, smash: number): void {
  const p = s.props[i];
  if (p.stage === 2) return;
  const b = BREAKABLES[i];
  const big = b.big === true;
  p.hp = big && smash ? 0 : Math.max(big ? 1 : 0, p.hp - amount);
  p.dir = dir;
  const x = Math.trunc((box.x0 + box.x1) / 2);
  const y = Math.trunc((box.y0 + box.y1) / 2);
  if (p.hp === 0) {
    breakProp(s, i, x, y, crash, big ? smash : 0);
    // 자동차는 폭발하며 둘레 건물 정면을 크게 깎는다
    if (b.kind === 'car') damageCity(s, b.x + b.w / 2, b.h / 2, CITY_RULES.explosion.radius, CITY_RULES.explosion.amount, 'explosion');
  } else if (p.stage === 0 && p.hp * 100 < b.hp * BREAK_RULES.damagedAt) {
    p.stage = 1;
    p.damagedAt = s.tick;
    s.events.push({ type: 'prop', who: i, x, y, text: 'damaged' });
  }
}

/** 물건 i를 부순다 (x, y: 이벤트 자리). 노면전차는 그 자리에서 탈선해 넘어진다 */
export function breakProp(s: SimState, i: number, x: number, y: number, crash: boolean, smash: number): void {
  const p = s.props[i];
  p.hp = 0;
  p.stage = 2;
  p.brokenAt = s.tick;
  p.crashed = crash;
  if (p.damagedAt < 0) p.damagedAt = s.tick;
  if (i === BIG.tram) p.at = tramRestX(tramAt(s.clock)?.x ?? Math.round(x / 256));
  s.events.push({ type: 'prop', who: i, x, y, text: 'broken', heavy: crash, ...(smash ? { combo: smash } : {}) });
}

/** 공격 판정이 닿은 물건의 내구도를 깎는다 (필살기는 큰 물건도 한 번에 무너뜨린다) */
export function hitProps(s: SimState): void {
  for (const f of s.fighters) {
    const hb = activeHitOf(f);
    if (!hb) continue;
    const d = MOVES[f.move!].data;
    const smash = 'cutin' in d && d.cutin ? SMASH_SUPER : 0;
    for (let i = 0; i < s.props.length; i++) {
      if (s.props[i].stage === 2 || f.propHits.includes(i)) continue;
      const box = boxOf(s, i);
      if (!box || !overlap(hb, box)) continue;
      f.propHits.push(i);
      damage(s, i, box, d.damage, f.facing, false, smash);
    }
  }
}

/**
 * 세게 날아온 캐릭터가 부딪히면 한 번에 부서지고, 부딪힌 쪽은 추가 피해.
 * 큰 물건은 '벽 쪽으로 날림' 기술에 맞아 날아온 상대가 부딪힐 때만 무너진다 (한 번 날아가는 동안 하나만).
 */
export function crashProps(s: SimState): void {
  s.fighters.forEach((f: Fighter, who) => {
    if (!FLYING.has(f.mode)) {
      f.wallFly = false;
      return;
    }
    if (Math.abs(f.vx) < CRASH_SPEED) return;
    const body: WBox = { x0: f.x - px(4), x1: f.x + px(4), y0: f.y - BODY_H, y1: f.y };
    for (let i = 0; i < s.props.length; i++) {
      if (s.props[i].stage === 2) continue;
      const box = boxOf(s, i);
      if (!box || !overlap(body, box)) continue;
      const dir = Math.sign(f.vx);
      const big = BREAKABLES[i].big === true;
      // 큰 물건에 그냥 부딪힌 것은 한 번만 친다 (지나가는 동안 매 틱 깎지 않게)
      if (big && !f.wallFly) {
        if (f.propHits.includes(i)) continue;
        f.propHits.push(i);
      }
      damage(s, i, box, BREAKABLES[i].hp, dir, true, big && f.wallFly ? SMASH_WALL : 0);
      if (big && f.wallFly) f.wallFly = false;
      if (f.mode !== 'ko') {
        f.hp = Math.max(0, f.hp - BREAK_RULES.crashDamage);
        f.flash = 6;
        if (f.hp === 0) knockOut(s, f, dir, 1 - who);
      }
      // 부딪혀서 느려지고 잠깐 멈춘다
      f.vx = Math.trunc(f.vx / 2);
      f.hitstop = Math.max(f.hitstop, 6);
    }
  });
}
