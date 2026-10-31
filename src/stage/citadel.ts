import { CITADEL as D } from '../data/stages/citadel';

/**
 * 시타델 1구역의 배치 계산. sim(부서지는 물건·건물·발판 판정)과 render(그리기)가 같은 결과를 쓴다.
 * 숫자만 다루고, 그림이나 DOM은 모른다.
 * 월드 좌표: x 0 ~ MAP_W, y 0(맵 위) ~ MAP_H(맵 아래). 바닥은 y = GROUND. sim의 높이 0이 바닥이다.
 */
export const MAP_W = D.width;
export const MAP_H = D.height;
export const GROUND = D.height - D.groundFromBottom;
/** 캐릭터가 넘지 못하는 서쪽·동쪽 끝 (px) */
export const WALLS = D.walls;

export type SectionId = (typeof D.sections)[number]['id'];
export type BuildingKind = 'shop' | 'theater' | 'diner' | 'apartment';

/** 부서지는 길가 건물 하나 */
export interface FrontBuildingPlace {
  kind: BuildingKind;
  section: SectionId;
  x: number;
  w: number;
  /** 바닥에서 지붕까지 높이 */
  h: number;
  /** 1층을 포함한 층수 */
  floors: number;
  /** 가게 이름 (없으면 1층이 현관) */
  sign: string;
  poster: string;
  seed: number;
}

/** 건물 사이 골목 (부서지지 않는다. 뒤 겹이 보인다) */
export interface FrontGap {
  kind: 'alley';
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

/** 길가 건물과 골목을 구간마다 x0부터 이어 놓는다 */
function layout(): { buildings: FrontBuildingPlace[]; gaps: FrontGap[] } {
  const buildings: FrontBuildingPlace[] = [];
  const gaps: FrontGap[] = [];
  let k = D.front.seed;
  for (const id of ['theater', 'apartments'] as const) {
    const sec = D.front[id];
    let x: number = sec.x0;
    for (const b of sec.list) {
      if (b.kind === 'alley') gaps.push({ kind: 'alley', section: id, x, w: b.w });
      else buildings.push({ kind: b.kind, section: id, x, w: b.w, h: heightOf(b.floors), floors: b.floors, sign: b.sign, poster: b.poster, seed: k });
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

// ---------------------------------------------------------------- 1층과 발판 자리 (그림과 판정이 같은 숫자를 쓴다)
const L = D.ledges;

/** 1층에 쇼윈도가 있는 건물 (상가, 다이너, 가게가 있는 아파트) */
export const hasShopWindow = (b: FrontBuildingPlace): boolean => b.kind === 'shop' || b.kind === 'diner' || (b.kind === 'apartment' && b.sign !== '');

/** 가게 문 왼쪽 끝 */
export const doorOf = (b: FrontBuildingPlace): number => (b.kind === 'apartment' ? b.x + Math.floor((b.w - 64) * 0.62) : b.x + Math.floor(b.w * 0.7));
export const DOOR_W = 18;

/** 쇼윈도 유리 (x ~ x+w, 바닥에서 GLASS_BOTTOM 위부터 glass.h 높이) */
export function shopWindow(b: FrontBuildingPlace): { x: number; w: number } {
  return { x: b.x + 10, w: doorOf(b) - b.x - 18 };
}
export const GLASS_BOTTOM = 8;

/** 가게 차양 (윗면이 중층 발판). 아파트는 비상계단과 겹치지 않게 왼쪽만 */
export function awningOf(b: FrontBuildingPlace): { x0: number; x1: number; h: number } | null {
  if (b.kind === 'shop' || b.kind === 'diner') return { x0: b.x + 4, x1: b.x + b.w - 4, h: L.awning };
  if (b.kind === 'apartment' && b.sign) return { x0: b.x + 4, x1: b.x + b.w - L.escapeW - 16, h: L.awning };
  return null;
}

/** 극장 전구 차양 (윗면이 중층 발판) */
export function marqueeOf(b: FrontBuildingPlace): { x0: number; x1: number; h: number } | null {
  return b.kind === 'theater' ? { x0: b.x + 10, x1: b.x + b.w - 10, h: L.marquee } : null;
}

/** 아파트 비상계단: 오른쪽 기둥 하나, 2층부터 층마다 발판 높이 */
export function escapeOf(b: FrontBuildingPlace): { x0: number; x1: number; landings: number[] } | null {
  if (b.kind !== 'apartment') return null;
  const x0 = b.x + b.w - L.escapeW - 8;
  const landings: number[] = [];
  for (let f = 2; f <= b.floors; f++) landings.push(SHOP_H + (f - 2) * FLOOR_H + L.escapeAbove);
  return { x0, x1: x0 + L.escapeW, landings };
}

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
    if (!hasShopWindow(b)) continue;
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

// ---------------------------------------------------------------- 발판 (한 방향: 위에서 내려올 때만 선다)
export type SurfaceTier = 'mid' | 'roof';
export type SurfaceKind = 'awning' | 'marquee' | 'escape' | 'landing' | 'roof' | 'terrace' | 'tower' | 'gallery';

/**
 * 발판 하나: x0 ~ x1 (px), 바닥에서 높이 h. b는 붙어 있는 부서지는 건물 번호 (그 자리 덩어리가 무너지면 발판도 없다).
 * b가 -1이면 부서지지 않는 것 (시타델 본관 계단참, 기둥탑, 등대).
 * 높이 세 층: 지상(0), 중층(차양·비상계단·계단참), 옥상(지붕·테라스·기둥탑 꼭대기·등대 둘레).
 */
export interface Surface {
  x0: number;
  x1: number;
  h: number;
  tier: SurfaceTier;
  kind: SurfaceKind;
  b: number;
}

export const SURFACES: readonly Surface[] = (() => {
  const out: Surface[] = [];
  FRONT.forEach((b, bi) => {
    const a = awningOf(b);
    if (a) out.push({ ...a, tier: 'mid', kind: 'awning', b: bi });
    const m = marqueeOf(b);
    if (m) out.push({ ...m, tier: 'mid', kind: 'marquee', b: bi });
    const e = escapeOf(b);
    if (e) for (const h of e.landings) out.push({ x0: e.x0, x1: e.x1, h, tier: 'mid', kind: 'escape', b: bi });
    out.push({ x0: b.x, x1: b.x + b.w, h: b.h, tier: 'roof', kind: 'roof', b: bi });
  });
  const P = D.plaza;
  out.push({ x0: P.landing.x0, x1: P.landing.x1, h: P.landing.h, tier: 'mid', kind: 'landing', b: -1 });
  for (const t of P.towers) {
    const T = P.tower;
    out.push({ x0: t.x - T.terraceOver, x1: t.x + T.w + T.terraceOver, h: T.terrace, tier: 'roof', kind: 'terrace', b: -1 });
    out.push({ x0: t.x, x1: t.x + T.w, h: T.h, tier: 'roof', kind: 'tower', b: -1 });
  }
  const H = D.pier.lighthouse;
  const cx = H.x + H.w / 2;
  out.push({ x0: cx - H.balconyW / 2, x1: cx + H.balconyW / 2, h: H.balcony, tier: 'mid', kind: 'gallery', b: -1 });
  out.push({ x0: cx - H.galleryW / 2, x1: cx + H.galleryW / 2, h: H.gallery, tier: 'roof', kind: 'gallery', b: -1 });
  return out;
})();
