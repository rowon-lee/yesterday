import { DOWNTOWN as D } from '../data/stages/downtown';

/**
 * 도심의 배치 계산 (구간 4개). sim(부서지는 물건 판정)과 render(그리기)가 같은 결과를 쓴다.
 * 숫자만 다루고, 그림이나 DOM은 모른다.
 * 월드 좌표: x 0 ~ MAP_W, y 0(맵 위) ~ MAP_H(맵 아래). 바닥은 y = GROUND. sim의 높이 0이 바닥이다.
 */
export const MAP_W = D.width;
export const MAP_H = D.height;
export const GROUND = D.height - D.groundFromBottom;

export type SectionId = (typeof D.sections)[number]['id'];
export type BuildingKind = 'shop' | 'flat' | 'warehouse' | 'hall' | 'wing' | 'factory';
export type GapKind = 'alley' | 'lot' | 'open' | 'yard';

export interface FrontBuildingPlace {
  kind: BuildingKind;
  section: SectionId;
  x: number;
  w: number;
  /** 바닥에서 지붕까지 높이 */
  h: number;
  /** 1층을 포함한 층수 */
  floors: number;
  sign: string;
  escape: boolean;
  poster: string;
  seed: number;
}

/** 건물 사이 빈자리 (부서지지 않는다. 뒤 겹이 보인다) */
export interface FrontGap {
  kind: GapKind;
  section: SectionId;
  x: number;
  w: number;
}

/** 지붕 처마(돌 띠) 두께. 맨 위층 안쪽에 그린다 */
export const CORNICE = 8;
export const SHOP_H = D.front.shopH;
export const FLOOR_H = D.front.floorH;

/** 층수 → 바닥에서 지붕까지 높이 */
export const heightOf = (floors: number): number => SHOP_H + (floors - 1) * FLOOR_H;

/** 길가 건물과 빈자리를 구간마다 왼쪽부터 이어 놓는다 */
function layout(): { buildings: FrontBuildingPlace[]; gaps: FrontGap[] } {
  const buildings: FrontBuildingPlace[] = [];
  const gaps: FrontGap[] = [];
  let k = D.front.seed;
  for (const sec of D.sections) {
    let x: number = sec.x0;
    for (const b of D.front[sec.id]) {
      if (b.kind === 'alley' || b.kind === 'lot' || b.kind === 'open' || b.kind === 'yard') {
        gaps.push({ kind: b.kind, section: sec.id, x, w: b.w });
      } else {
        buildings.push({
          kind: b.kind, section: sec.id, x, w: b.w, h: heightOf(b.floors), floors: b.floors,
          sign: b.sign, escape: b.escape, poster: b.poster, seed: k,
        });
      }
      x += b.w;
      k += 97;
    }
  }
  return { buildings, gaps };
}

const LAYOUT = layout();
export function frontBuildings(): FrontBuildingPlace[] {
  return LAYOUT.buildings;
}
export const FRONT_GAPS: readonly FrontGap[] = LAYOUT.gaps;

/** 월드 x가 속한 구간 */
export function sectionAt(x: number): SectionId {
  for (const s of D.sections) if (x < s.x1) return s.id;
  return D.sections[D.sections.length - 1].id;
}

/** 가게 문 왼쪽 끝 */
export const doorOf = (b: FrontBuildingPlace): number => b.x + Math.floor(b.w * 0.7);
export const DOOR_W = 18;

/** 쇼윈도 유리 (x ~ x+w, 바닥에서 GLASS_BOTTOM 위부터 glass.h 높이) */
export function shopWindow(b: FrontBuildingPlace): { x: number; w: number } {
  return { x: b.x + 10, w: doorOf(b) - b.x - 18 };
}
export const GLASS_BOTTOM = 8;

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

export const LAMPS: readonly number[] = B.lamps;

/** 이 맵의 부서지는 물건 전부 (순서가 곧 번호. sim 상태의 props와 짝이 맞는다) */
export const BREAKABLES: readonly Breakable[] = (() => {
  const list: Breakable[] = [];
  for (const x of B.cars) list.push({ kind: 'car', x, w: B.car.w, h: B.car.h, bottom: 0, hp: B.car.hp });
  for (const x of LAMPS) list.push({ kind: 'lamp', x: x - B.lamp.w / 2, w: B.lamp.w, h: B.lamp.h, bottom: 0, hp: B.lamp.hp });
  for (const b of frontBuildings()) {
    if (b.kind !== 'shop') continue;
    const g = shopWindow(b);
    list.push({ kind: 'glass', x: g.x, w: g.w, h: B.glass.h, bottom: GLASS_BOTTOM, hp: B.glass.hp });
  }
  for (const x of B.newsstands) list.push({ kind: 'newsstand', x, w: B.newsstand.w, h: B.newsstand.h, bottom: 0, hp: B.newsstand.hp });
  for (const x of B.hydrants) list.push({ kind: 'hydrant', x, w: B.hydrant.w, h: B.hydrant.h, bottom: 0, hp: B.hydrant.hp });
  return list;
})();

export const BREAK_RULES = { damagedAt: B.damagedAt, crashSpeed: B.crashSpeed, crashDamage: B.crashDamage };

// ---------------------------------------------------------------- 건물 파괴 격자
const CITY = D.city;
export const CITY_RULES = CITY;
export const CHUNK = CITY.chunk;

/** 덩어리 하나: 건물 번호, 칸·줄(줄 0이 바닥), 월드 x, 폭, 바닥에서 아래 끝 높이, 높이 */
export interface Chunk {
  b: number;
  c: number;
  r: number;
  x: number;
  w: number;
  y0: number;
  h: number;
}

/** 건물 하나의 격자: 덩어리 번호는 first + r × cols + c */
export interface BuildingGrid {
  x: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  first: number;
}

export const FRONT: readonly FrontBuildingPlace[] = frontBuildings();

export const GRIDS: readonly BuildingGrid[] = (() => {
  let first = 0;
  return FRONT.map((b) => {
    const cols = Math.ceil(b.w / CHUNK);
    const rows = Math.ceil(b.h / CHUNK);
    const g = { x: b.x, w: b.w, h: b.h, cols, rows, first };
    first += cols * rows;
    return g;
  });
})();

export const CHUNKS: readonly Chunk[] = GRIDS.flatMap((g, b) => {
  const out: Chunk[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      out.push({ b, c, r, x: g.x + c * CHUNK, w: Math.min(CHUNK, g.w - c * CHUNK), y0: r * CHUNK, h: Math.min(CHUNK, g.h - r * CHUNK) });
    }
  }
  return out;
});

export const chunkIndex = (g: BuildingGrid, c: number, r: number): number => g.first + r * g.cols + c;

/** 덩어리 단계: 0 멀쩡, 1 금, 2 구멍, 3 뚫림, 4 무너져 사라짐 */
export function chunkStage(hp: number): 0 | 1 | 2 | 3 | 4 {
  if (hp < 0) return 4;
  if (hp === 0) return 3;
  if (hp <= CITY.holeAt) return 2;
  if (hp <= CITY.crackAt) return 1;
  return 0;
}
