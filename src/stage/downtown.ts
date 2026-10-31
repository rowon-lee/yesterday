import { DOWNTOWN as D } from '../data/stages/downtown';

/**
 * 도심 대로의 배치 계산. sim(부서지는 물건 판정)과 render(그리기)가 같은 결과를 쓴다.
 * 숫자만 다루고, 그림이나 DOM은 모른다.
 */

export interface FrontBuildingPlace {
  x: number;
  w: number;
  h: number;
  shop: string;
  escape: boolean;
  poster: string;
  seed: number;
}

/** 길가 건물을 맵 끝까지 이어 놓는다 */
export function frontBuildings(): FrontBuildingPlace[] {
  const out: FrontBuildingPlace[] = [];
  let x = 0;
  let k = D.front.seed;
  let i = 0;
  while (x < D.width) {
    const b = D.front.buildings[i % D.front.buildings.length];
    if (b.h > 0) out.push({ x, w: b.w, h: b.h, shop: b.shop, escape: b.escape, poster: b.poster, seed: k });
    x += b.w;
    k += 97;
    i++;
  }
  return out;
}

/** 1층 가게 높이 (바닥에서) */
export const SHOP_H = 30;

/** 가게 문 왼쪽 끝 */
export const doorOf = (b: FrontBuildingPlace): number => b.x + Math.floor(b.w * 0.7);

/** 쇼윈도 유리 (x0~x1, 바닥에서 위로 h) */
export function shopWindow(b: FrontBuildingPlace): { x: number; w: number } {
  return { x: b.x + 4, w: doorOf(b) - b.x - 8 };
}

export type BreakableKind = 'car' | 'lamp' | 'glass' | 'newsstand' | 'hydrant';

/** 부서지는 물건 하나. 판정 상자는 발밑(바닥) 기준: x ~ x+w, 바닥에서 h까지 */
export interface Breakable {
  kind: BreakableKind;
  x: number;
  w: number;
  h: number;
  hp: number;
}

const B = D.breakables;

/** 이 맵의 부서지는 물건 전부 (순서가 곧 번호. sim 상태의 props와 짝이 맞는다) */
export const BREAKABLES: readonly Breakable[] = (() => {
  const list: Breakable[] = [];
  for (const x of B.cars) list.push({ kind: 'car', x, w: B.car.w, h: B.car.h, hp: B.car.hp });
  for (const x of D.street.lamps) list.push({ kind: 'lamp', x: x - B.lamp.w / 2, w: B.lamp.w, h: B.lamp.h, hp: B.lamp.hp });
  for (const b of frontBuildings()) {
    if (!b.shop) continue;
    const g = shopWindow(b);
    list.push({ kind: 'glass', x: g.x, w: g.w, h: B.glass.h, hp: B.glass.hp });
  }
  for (const x of B.newsstands) list.push({ kind: 'newsstand', x, w: B.newsstand.w, h: B.newsstand.h, hp: B.newsstand.hp });
  for (const x of B.hydrants) list.push({ kind: 'hydrant', x, w: B.hydrant.w, h: B.hydrant.h, hp: B.hydrant.hp });
  // 기술 하나가 어떤 물건을 이미 쳤는지 비트로 기억하므로 31개를 넘으면 안 된다
  if (list.length > 31) throw new Error(`부서지는 물건이 너무 많음: ${list.length}`);
  return list;
})();

export const BREAK_RULES = { damagedAt: B.damagedAt, crashSpeed: B.crashSpeed, crashDamage: B.crashDamage };
