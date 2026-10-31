import { DOWNTOWN as D } from '../data/stages/downtown';

/**
 * 도심 대로의 배치 계산. sim(부서지는 물건 판정)과 render(그리기)가 같은 결과를 쓴다.
 * 숫자만 다루고, 그림이나 DOM은 모른다.
 * 월드 좌표: x 0 ~ MAP_W, y 0(맵 위) ~ MAP_H(맵 아래). 바닥은 y = GROUND. sim의 높이 0이 바닥이다.
 */
export const MAP_W = D.width;
export const MAP_H = D.height;
export const GROUND = D.height - D.groundFromBottom;

export interface FrontBuildingPlace {
  x: number;
  w: number;
  /** 바닥에서 처마까지 높이 (골목이면 0) */
  h: number;
  floors: number;
  shop: string;
  escape: boolean;
  poster: string;
  seed: number;
}

/** 처마(돌 띠) 두께 */
export const CORNICE = 8;
export const SHOP_H = D.front.shopH;
export const FLOOR_H = D.front.floorH;

/** 길가 건물을 맵 끝까지 이어 놓는다 */
export function frontBuildings(): FrontBuildingPlace[] {
  const out: FrontBuildingPlace[] = [];
  let x = 0;
  let k = D.front.seed;
  let i = 0;
  while (x < MAP_W) {
    const b = D.front.buildings[i % D.front.buildings.length];
    if (b.floors > 0) {
      const h = SHOP_H + b.floors * FLOOR_H + CORNICE;
      out.push({ x, w: b.w, h, floors: b.floors, shop: b.shop, escape: b.escape, poster: b.poster, seed: k });
    }
    x += b.w;
    k += 97;
    i++;
  }
  return out;
}

/** 가게 문 왼쪽 끝 (문 폭 16) */
export const doorOf = (b: FrontBuildingPlace): number => b.x + Math.floor(b.w * 0.68);
export const DOOR_W = 16;

/** 쇼윈도 유리 (x ~ x+w, 바닥에서 6px 위부터 glass.h 높이) */
export function shopWindow(b: FrontBuildingPlace): { x: number; w: number } {
  return { x: b.x + 8, w: doorOf(b) - b.x - 14 };
}
export const GLASS_BOTTOM = 6;

export type BreakableKind = 'car' | 'lamp' | 'glass' | 'newsstand' | 'hydrant';

/** 부서지는 물건 하나. 판정 상자는 바닥 기준: x ~ x+w, 바닥(+bottom)에서 h까지 위 */
export interface Breakable {
  kind: BreakableKind;
  x: number;
  w: number;
  h: number;
  /** 바닥에서 떠 있는 높이 (쇼윈도) */
  bottom: number;
  hp: number;
}

const B = D.breakables;

export const LAMPS: readonly number[] = (() => {
  const out: number[] = [];
  for (let x = B.lampFirst; x < MAP_W; x += B.lampEvery) out.push(x);
  return out;
})();

/** 이 맵의 부서지는 물건 전부 (순서가 곧 번호. sim 상태의 props와 짝이 맞는다) */
export const BREAKABLES: readonly Breakable[] = (() => {
  const list: Breakable[] = [];
  for (const x of B.cars) list.push({ kind: 'car', x, w: B.car.w, h: B.car.h, bottom: 0, hp: B.car.hp });
  for (const x of LAMPS) list.push({ kind: 'lamp', x: x - B.lamp.w / 2, w: B.lamp.w, h: B.lamp.h, bottom: 0, hp: B.lamp.hp });
  for (const b of frontBuildings()) {
    if (!b.shop) continue;
    const g = shopWindow(b);
    list.push({ kind: 'glass', x: g.x, w: g.w, h: B.glass.h, bottom: GLASS_BOTTOM, hp: B.glass.hp });
  }
  for (const x of B.newsstands) list.push({ kind: 'newsstand', x, w: B.newsstand.w, h: B.newsstand.h, bottom: 0, hp: B.newsstand.hp });
  for (const x of B.hydrants) list.push({ kind: 'hydrant', x, w: B.hydrant.w, h: B.hydrant.h, bottom: 0, hp: B.hydrant.hp });
  return list;
})();

export const BREAK_RULES = { damagedAt: B.damagedAt, crashSpeed: B.crashSpeed, crashDamage: B.crashDamage };
