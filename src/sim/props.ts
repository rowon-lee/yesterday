import { BREAK_RULES, BREAKABLES, CITY_RULES } from '../stage/citadel';
import { damageCity } from './city';
import { activeHitOf, knockOut, type WBox } from './combat';
import { MOVES } from './frames';
import { px } from './rules';
import type { Fighter, PropState, SimState } from './types';

/**
 * 부서지는 물건. 부서진 물건은 판정에 영향을 주지 않는 장식이다 (막지 않는다).
 * - 공격 판정이 물건에 닿으면 그 기술의 피해만큼 내구도가 깎인다 (기술 하나에 물건마다 한 번)
 * - 내구도가 절반 아래면 '망가짐', 0이면 '파괴'
 * - 세게 날아온 캐릭터가 부딪히면 한 번에 부서지고, 부딪힌 쪽은 추가 피해를 입는다
 */
export function createProps(): PropState[] {
  return BREAKABLES.map((b) => ({ hp: b.hp, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1 }));
}

const CRASH_SPEED = px(BREAK_RULES.crashSpeed);
/** 날아가는 몸의 높이 (발밑에서) */
const BODY_H = px(40);
const FLYING = new Set(['airhit', 'ko', 'hitstun', 'crush']);

/** 물건의 판정 상자 (월드, 1/256px) */
function boxOf(i: number): WBox {
  const b = BREAKABLES[i];
  return { x0: px(b.x), x1: px(b.x + b.w), y0: -px(b.bottom + b.h), y1: -px(b.bottom) };
}

const overlap = (a: WBox, b: WBox): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function damage(s: SimState, i: number, amount: number, dir: number, crash: boolean): void {
  const p = s.props[i];
  if (p.stage === 2) return;
  const b = BREAKABLES[i];
  p.hp = Math.max(0, p.hp - amount);
  p.dir = dir;
  const x = px(b.x + b.w / 2);
  const y = -px(b.bottom + b.h / 2);
  if (p.hp === 0) {
    p.stage = 2;
    p.brokenAt = s.tick;
    p.crashed = crash;
    if (p.damagedAt < 0) p.damagedAt = s.tick;
    s.events.push({ type: 'prop', who: i, x, y, text: 'broken', heavy: crash });
    // 자동차는 폭발하며 둘레 건물 정면을 크게 깎는다
    if (b.kind === 'car') damageCity(s, b.x + b.w / 2, b.h / 2, CITY_RULES.explosion.radius, CITY_RULES.explosion.amount, 'explosion');
  } else if (p.stage === 0 && p.hp * 100 < b.hp * BREAK_RULES.damagedAt) {
    p.stage = 1;
    p.damagedAt = s.tick;
    s.events.push({ type: 'prop', who: i, x, y, text: 'damaged' });
  }
}

/** 공격 판정이 닿은 물건의 내구도를 깎는다 */
export function hitProps(s: SimState): void {
  for (const f of s.fighters) {
    const hb = activeHitOf(f);
    if (!hb) continue;
    const dmg = MOVES[f.move!].data.damage;
    for (let i = 0; i < s.props.length; i++) {
      if (s.props[i].stage === 2 || f.propHits.includes(i)) continue;
      if (!overlap(hb, boxOf(i))) continue;
      f.propHits.push(i);
      damage(s, i, dmg, f.facing, false);
    }
  }
}

/** 세게 날아온 캐릭터가 부딪히면 한 번에 부서지고, 부딪힌 쪽은 추가 피해 */
export function crashProps(s: SimState): void {
  s.fighters.forEach((f: Fighter, who) => {
    if (!FLYING.has(f.mode) || Math.abs(f.vx) < CRASH_SPEED) return;
    const body: WBox = { x0: f.x - px(4), x1: f.x + px(4), y0: f.y - BODY_H, y1: f.y };
    for (let i = 0; i < s.props.length; i++) {
      if (s.props[i].stage === 2 || !overlap(body, boxOf(i))) continue;
      const dir = Math.sign(f.vx);
      damage(s, i, BREAKABLES[i].hp, dir, true);
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
