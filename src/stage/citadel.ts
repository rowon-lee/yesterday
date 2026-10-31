import { CITADEL as D } from '../data/stages/citadel';

/**
 * 시타델 1구역의 배치 계산. sim(부서지는 물건·건물·발판 판정)과 render(그리기)가 같은 결과를 쓴다.
 * 숫자만 다루고, 그림이나 DOM은 모른다.
 * 월드 좌표: x 0 ~ MAP_W, y 0(맵 위) ~ MAP_H(맵 아래). 바닥은 y = GROUND. sim의 높이 0이 바닥이다.
 */
export const MAP_W = D.width;
export const MAP_H = D.height;
export const GROUND = D.height - D.groundFromBottom;
/** 캐릭터가 넘지 못하는 서쪽·동쪽 끝 (px). 서쪽은 컨테이너 더미 높이 위에서는 더미 위까지 갈 수 있다 (CONTAINER_TOP) */
export const MAP_ENDS = D.walls;
/** 서쪽 끝 컨테이너 더미: 윗면 높이와, 그 위에서 갈 수 있는 서쪽 끝 */
export const CONTAINER_TOP = { h: D.pier.containers.rows * D.pier.containers.rowH, standFrom: D.pier.containers.standFrom };

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
  /** 포스터를 건물 왼쪽에 붙인다 (그림 전용: 고정 카메라 지점의 화면 가장자리에서 글씨가 잘리지 않게) */
  posterLeft: boolean;
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
      else buildings.push({
        kind: b.kind, section: id, x, w: b.w, h: heightOf(b.floors), floors: b.floors, sign: b.sign, poster: b.poster,
        posterLeft: 'posterLeft' in b && b.posterLeft, seed: k,
      });
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
/** 가게 문 폭과 높이 (아트 규칙: 문 약 70px, 캐릭터 52px보다 크게. 차양 아래에 들어간다) */
export const DOOR_W = 24;
export const DOOR_H = 68;

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

export type BreakableKind = 'car' | 'lamp' | 'glass' | 'newsstand' | 'hydrant' | 'neon' | BigKind;
/** 큰 물건: 평타·기술로는 망가짐까지만, 필살기가 닿거나 벽 쪽으로 날린 상대가 부딪히면 크게 무너진다 */
export type BigKind = 'tram' | 'watertower' | 'lighthouse' | 'bigsign';
/** 네온 간판 모양: 가게 이름, 세로 간판, 전구 차양, 전구 테두리 판, 옥상 전광판 */
export type NeonStyle = 'shop' | 'blade' | 'marquee' | 'board' | 'billboard';
export type NeonColor = 'pink' | 'cyan' | 'amber' | 'green' | 'red';

/** 부서지는 물건 하나. 판정 상자는 바닥 기준: x ~ x+w, 바닥(+bottom)에서 h까지 위 */
export interface Breakable {
  kind: BreakableKind;
  x: number;
  w: number;
  h: number;
  /** 바닥에서 떠 있는 높이 (쇼윈도·네온 간판) */
  bottom: number;
  hp: number;
  /** 붙어 있는 부서지는 건물 번호와 받치는 덩어리 칸·줄 (그 덩어리가 무너지면 같이 부서진다). 없으면 -1 */
  b: number;
  col: number;
  row: number;
  /** 네온 간판만: 모양, 글씨, 빛 색 */
  style?: NeonStyle;
  text?: string;
  color?: NeonColor;
  /** 큰 물건 (노면전차는 x가 0이고, 판정할 때 tramAt(틱)으로 자리를 정한다) */
  big?: boolean;
}

const B = D.breakables;

export const LAMPS: readonly number[] = B.lamps;

const FREE = { b: -1, col: 0, row: 0 };
/** 3×5 도트 글꼴로 쓴 글씨 폭 (render/font.ts와 같은 계산) */
const textW = (text: string, scale: number): number => (text.length * 4 - 1) * scale;
const NEON_COLORS: readonly NeonColor[] = ['pink', 'cyan', 'amber', 'green'];

/** 건물 bi에 붙은 물건이 받치는 덩어리 (가운데 x, 높이 h에서) */
function support(bi: number, x: number, h: number): { b: number; col: number; row: number } {
  const b = LAYOUT.buildings[bi];
  const ch = D.city.chunk;
  const col = Math.max(0, Math.min(Math.ceil(b.w / ch) - 1, Math.floor((x - b.x) / ch)));
  const row = Math.max(0, Math.min(Math.ceil(b.h / ch) - 1, Math.floor(h / ch)));
  return { b: bi, col, row };
}

/** 건물마다 붙은 네온 간판 */
function neonSigns(): Breakable[] {
  const out: Breakable[] = [];
  const N = B.neon;
  const add = (bi: number, style: NeonStyle, text: string, color: NeonColor, x: number, w: number, bottom: number, h: number, big: boolean) => {
    out.push({ kind: 'neon', x, w, h, bottom, hp: big ? N.big : N.hp, ...support(bi, x + w / 2, Math.min(bottom + h / 2, LAYOUT.buildings[bi].h - 1)), style, text, color });
  };
  // 간판 글씨가 화면 가장자리에서 반쯤 잘리지 않게 (아트 규칙): 세로 간판은 바닥에 선 카메라 화면(높이 240 아래) 안에 두고,
  // 가게 간판은 구간 가운데 쪽으로 붙인다 (구간 끝에 선 카메라에서도 다 보이게)
  const SIGN_TOP = 232;
  LAYOUT.buildings.forEach((b, bi) => {
    const color = NEON_COLORS[Math.floor(b.seed / 97) % NEON_COLORS.length];
    const a = awningOf(b);
    if (b.kind === 'theater') {
      const m = marqueeOf(b)!;
      add(bi, 'blade', b.sign, 'pink', b.x + Math.floor(b.w / 2) - 11, 22, m.h + 6, Math.min(b.h - 30, SIGN_TOP) - (m.h + 6), true);
      add(bi, 'marquee', 'TONIGHT', 'amber', m.x0, m.x1 - m.x0, m.h - L.marqueeH, L.marqueeH, true);
    } else if (b.kind === 'diner' && a) {
      const w = textW(b.sign, 3) + 20;
      add(bi, 'board', b.sign, 'red', b.x + Math.floor((b.w - w) / 2), w, a.h + 10, 30, true);
    } else if (a && b.sign) {
      const w = textW(b.sign, 2) + 10;
      const sec = D.sections.find((s) => s.id === b.section)!;
      const towardRight = b.x + b.w / 2 < (sec.x0 + sec.x1) / 2;
      add(bi, 'shop', b.sign, color, towardRight ? a.x1 - w - 6 : a.x0 + 6, w, a.h + 1, 14, false);
    }
    // 호텔은 위층에 세로 네온을 하나 더 단다
    if (b.sign === 'HOTEL') add(bi, 'blade', 'HOTEL', 'cyan', b.x + b.w - 26, 16, 100, SIGN_TOP - 100, false);
  });
  // 옥상 전광판 (지붕 위 쇠다리에 얹힘): 받치는 덩어리는 지붕 맨 윗줄
  const BB = D.billboard;
  const apts = LAYOUT.buildings.filter((b) => b.section === 'apartments');
  const host = apts[BB.building];
  if (host) {
    const bi = LAYOUT.buildings.indexOf(host);
    const x = host.x + Math.floor((host.w - BB.w) / 2);
    out.push({ kind: 'neon', x, w: BB.w, h: BB.h, bottom: host.h + 12, hp: N.big, ...support(bi, x + BB.w / 2, host.h - 1), style: 'billboard', text: BB.text, color: 'amber' });
  }
  return out;
}

// ---------------------------------------------------------------- 노면전차 (틱만으로 자리가 정해진다)
const TR = D.tram;

/**
 * 노면전차가 이 틱에 지나는 자리 (x는 차체 왼쪽 끝 월드 px 정수, dir 1이면 동쪽으로). 다니지 않는 때면 null.
 * 첫 출발 뒤 every틱마다 한 번, 방향을 번갈아 선로를 지나간다. 무너진 뒤에는 더 다니지 않는다 (그건 상태를 보는 쪽이 정한다).
 */
export function tramAt(tick: number): { x: number; dir: number } | null {
  if (tick < TR.first) return null;
  const n = Math.floor((tick - TR.first) / TR.every);
  const t = tick - TR.first - n * TR.every;
  const travelled = Math.round(t * TR.speed);
  if (travelled > TR.x1 - TR.x0 + TR.length) return null;
  const dir = n % 2 ? -1 : 1;
  return { x: dir > 0 ? TR.x0 - TR.length + travelled : TR.x1 - travelled, dir };
}

/** 뒤집힌 전차가 놓이는 자리 (차체 왼쪽 끝): 탈선한 자리에서 맵 안쪽으로 미끄러진다 (컨테이너와 광장 문기둥에 가리지 않게) */
export function tramRestX(x: number): number {
  return Math.max(D.walls.left + 8, Math.min(TR.x1 - TR.length - 24, x));
}

/** 이 맵의 부서지는 물건 전부 (순서가 곧 번호. sim 상태의 props와 짝이 맞는다) */
export const BREAKABLES: readonly Breakable[] = (() => {
  const list: Breakable[] = [];
  for (const x of B.cars) list.push({ kind: 'car', x, w: B.car.w, h: B.car.h, bottom: 0, hp: B.car.hp, ...FREE });
  for (const x of LAMPS) list.push({ kind: 'lamp', x: x - B.lamp.w / 2, w: B.lamp.w, h: B.lamp.h, bottom: 0, hp: B.lamp.hp, ...FREE });
  LAYOUT.buildings.forEach((b, bi) => {
    if (!hasShopWindow(b)) return;
    const g = shopWindow(b);
    list.push({ kind: 'glass', x: g.x, w: g.w, h: B.glass.h, bottom: GLASS_BOTTOM, hp: B.glass.hp, ...support(bi, g.x + g.w / 2, 0) });
  });
  for (const x of B.newsstands) list.push({ kind: 'newsstand', x, w: B.newsstand.w, h: B.newsstand.h, bottom: 0, hp: B.newsstand.hp, ...FREE });
  for (const x of B.hydrants) list.push({ kind: 'hydrant', x, w: B.hydrant.w, h: B.hydrant.h, bottom: 0, hp: B.hydrant.hp, ...FREE });
  list.push(...neonSigns());
  // 큰 물건 (맨 뒤에 붙여 앞 물건들의 번호를 그대로 둔다)
  list.push({ kind: 'tram', x: 0, w: TR.length, h: TR.h, bottom: 0, hp: TR.hp, ...FREE, big: true });
  const WT = B.watertower;
  const host = LAYOUT.buildings.filter((b) => b.section === 'apartments')[WT.building];
  const hi = LAYOUT.buildings.indexOf(host);
  list.push({ kind: 'watertower', x: host.x + WT.dx, w: WT.w, h: WT.h, bottom: host.h, hp: WT.hp, ...support(hi, host.x + WT.dx + WT.w / 2, host.h - 1), big: true });
  const LH = D.pier.lighthouse;
  list.push({ kind: 'lighthouse', x: LH.x, w: LH.w, h: LH.h, bottom: 0, hp: LH.hp, ...FREE, big: true });
  const SG = D.plaza.sign;
  list.push({ kind: 'bigsign', x: SG.x, w: SG.w, h: SG.h, bottom: SG.bottom, hp: SG.hp, ...FREE, big: true });
  return list;
})();

/** 큰 물건의 번호 */
export const BIG = {
  tram: BREAKABLES.findIndex((b) => b.kind === 'tram'),
  watertower: BREAKABLES.findIndex((b) => b.kind === 'watertower'),
  lighthouse: BREAKABLES.findIndex((b) => b.kind === 'lighthouse'),
  bigsign: BREAKABLES.findIndex((b) => b.kind === 'bigsign'),
};

export const BREAK_RULES = { damagedAt: B.damagedAt, crashSpeed: B.crashSpeed, crashDamage: B.crashDamage, settle: B.settle };

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

// ---------------------------------------------------------------- 구조물: 발판과 벽
export type SurfaceTier = 'mid' | 'roof';
export type SurfaceKind =
  | 'awning' | 'marquee' | 'escape' | 'landing' | 'roof' | 'terrace' | 'tower' | 'gallery'
  | 'containers' | 'stump' | 'watertower' | 'sign' | 'tram' | 'rubble';

/**
 * 구조물이 있는 때: 늘 / 큰 물건이 서 있는 동안 / 큰 물건이 무너진 바로 뒤부터 /
 * 무너진 큰 물건이 자리를 잡은 뒤부터 (BREAK_RULES.settle틱 뒤. 뒤집힌 전차·쓰러진 간판처럼 자리를 잡는 것)
 */
export type Presence = 'always' | 'standing' | 'broken' | 'settled';

/** 구조물이 무엇에 딸려 있는가: 부서지는 건물 b (-1 없음), 큰 물건 prop (-1 없음)과 있는 때 */
export interface Holder {
  b: number;
  prop: number;
  when: Presence;
}

/**
 * 발판 하나 (한 방향: 위에서 내려올 때만 선다): x0 ~ x1 (px), 바닥에서 높이 h.
 * b가 있으면 그 건물의 그 자리 덩어리가 무너져 사라지면 발판도 없다. prop·when은 큰 물건에 딸린 발판
 * (급수탑 꼭대기·등대 꼭대기 둘레는 서 있는 동안, 등대 밑동은 꺾인 뒤, 뒤집힌 전차·쓰러진 간판은 자리를 잡은 뒤).
 * solid: 아래가 꽉 찬 윗면 (컨테이너 더미). ↓+점프로 뚫고 내려가지 않는다.
 * 높이 세 층: 지상(0), 중층(차양·비상계단·계단참·컨테이너), 옥상(지붕·테라스·기둥탑 꼭대기·등대 둘레·급수탑).
 */
export interface Surface extends Holder {
  x0: number;
  x1: number;
  h: number;
  tier: SurfaceTier;
  kind: SurfaceKind;
  solid?: boolean;
}

/**
 * 벽 하나 (벽 기동에 쓴다. 구조물은 싸우는 줄보다 뒤에 있어 길을 막지는 않는다): 벽면 x (px),
 * 붙는 쪽 side (-1이면 벽 왼쪽에서 오른쪽을 누르며 붙고, 1이면 벽 오른쪽에서 왼쪽을 누르며 붙는다), 바닥에서 h0 ~ h1 높이.
 * id가 같으면 같은 벽이다 (같은 벽은 연속 두 번까지만 딛는다). end는 맵 끝 벽 (부서지지 않는다).
 * 뒤쪽 건물 정면은 벽이 아니다.
 */
export interface Wall extends Holder {
  x: number;
  side: -1 | 1;
  h0: number;
  h1: number;
  id: number;
  end?: boolean;
}

const ALWAYS: Holder = { b: -1, prop: -1, when: 'always' };
const LH = D.pier.lighthouse;
const SG = D.plaza.sign;

export const SURFACES: readonly Surface[] = (() => {
  const out: Surface[] = [];
  FRONT.forEach((b, bi) => {
    const on: Holder = { b: bi, prop: -1, when: 'always' };
    const a = awningOf(b);
    if (a) out.push({ ...a, tier: 'mid', kind: 'awning', ...on });
    const m = marqueeOf(b);
    if (m) out.push({ ...m, tier: 'mid', kind: 'marquee', ...on });
    const e = escapeOf(b);
    if (e) for (const h of e.landings) out.push({ x0: e.x0, x1: e.x1, h, tier: 'mid', kind: 'escape', ...on });
    out.push({ x0: b.x, x1: b.x + b.w, h: b.h, tier: 'roof', kind: 'roof', ...on });
  });
  // 서쪽 끝 컨테이너 더미 윗면 (아래가 꽉 차 있다)
  const CT = D.pier.containers;
  out.push({ x0: CT.x0, x1: CT.x1, h: CONTAINER_TOP.h, tier: 'mid', kind: 'containers', ...ALWAYS, solid: true });
  const P = D.plaza;
  out.push({ x0: P.landing.x0, x1: P.landing.x1, h: P.landing.h, tier: 'mid', kind: 'landing', ...ALWAYS });
  for (const t of P.towers) {
    const T = P.tower;
    out.push({ x0: t.x - T.terraceOver, x1: t.x + T.w + T.terraceOver, h: T.terrace, tier: 'roof', kind: 'terrace', ...ALWAYS });
    out.push({ x0: t.x, x1: t.x + T.w, h: T.h, tier: 'roof', kind: 'tower', ...ALWAYS });
  }
  // 등대: 중간 발코니는 늘, 꼭대기 둘레는 서 있는 동안, 꺾인 밑동 윗면은 무너진 뒤
  const cx = LH.x + LH.w / 2;
  out.push({ x0: cx - LH.balconyW / 2, x1: cx + LH.balconyW / 2, h: LH.balcony, tier: 'mid', kind: 'gallery', ...ALWAYS });
  out.push({ x0: cx - LH.galleryW / 2, x1: cx + LH.galleryW / 2, h: LH.gallery, tier: 'roof', kind: 'gallery', b: -1, prop: BIG.lighthouse, when: 'standing' });
  out.push({ x0: LH.x, x1: LH.x + LH.w, h: LH.snap, tier: 'mid', kind: 'stump', b: -1, prop: BIG.lighthouse, when: 'broken' });
  // 급수탑 꼭대기 (서 있는 동안)
  const wt = BREAKABLES[BIG.watertower];
  out.push({ x0: wt.x, x1: wt.x + wt.w, h: wt.bottom + wt.h, tier: 'roof', kind: 'watertower', b: -1, prop: BIG.watertower, when: 'standing' });
  // 떨어져 분수에 기대 쓰러진 시타델 간판 (윗변)
  out.push({ x0: SG.x + 4, x1: SG.x + SG.w - 4, h: SG.lyingH, tier: 'mid', kind: 'sign', b: -1, prop: BIG.bigsign, when: 'settled' });
  return out;
})();

export const WALLS: readonly Wall[] = (() => {
  const out: Wall[] = [];
  let id = 0;
  /** 상자 모양 구조물의 왼쪽·오른쪽 면 */
  const faces = (x0: number, x1: number, h0: number, h1: number, on: Holder): void => {
    out.push({ x: x0, side: -1, h0, h1, id: id++, ...on }, { x: x1, side: 1, h0, h1, id: id++, ...on });
  };
  // 맵 끝 벽: 서쪽 컨테이너 더미 앞면, 동쪽 공원 철책
  out.push({ x: D.walls.left, side: 1, h0: 0, h1: CONTAINER_TOP.h, id: id++, ...ALWAYS, end: true });
  out.push({ x: D.walls.right, side: -1, h0: 0, h1: D.park.fence.h, id: id++, ...ALWAYS, end: true });
  // 등대 몸통: 꺾이는 높이 아래는 늘, 위는 서 있는 동안 (같은 벽)
  const lid = id;
  faces(LH.x, LH.x + LH.w, 0, LH.snap, ALWAYS);
  out.push(
    { x: LH.x, side: -1, h0: LH.snap, h1: LH.h, id: lid, b: -1, prop: BIG.lighthouse, when: 'standing' },
    { x: LH.x + LH.w, side: 1, h0: LH.snap, h1: LH.h, id: lid + 1, b: -1, prop: BIG.lighthouse, when: 'standing' },
  );
  // 극장 전구 차양 옆면, 비상계단 바깥 기둥 (접힌 사다리 끝부터 맨 위 난간까지). 건물 덩어리가 무너진 높이는 벽이 없다
  FRONT.forEach((b, bi) => {
    const on: Holder = { b: bi, prop: -1, when: 'always' };
    const m = marqueeOf(b);
    if (m) faces(m.x0, m.x1, m.h - L.marqueeH, m.h, on);
    const e = escapeOf(b);
    if (e) faces(e.x0, e.x1, e.landings[0] - L.ladder, e.landings[e.landings.length - 1] + L.rail, on);
  });
  // 시타델 정문 기둥탑 둘
  for (const t of D.plaza.towers) faces(t.x, t.x + D.plaza.tower.w, 0, D.plaza.tower.h, ALWAYS);
  // 급수탑 (지붕 위, 서 있는 동안)
  const wt = BREAKABLES[BIG.watertower];
  faces(wt.x, wt.x + wt.w, wt.bottom, wt.bottom + wt.h, { b: -1, prop: BIG.watertower, when: 'standing' });
  // 쓰러진 시타델 간판 양 끝
  faces(SG.x, SG.x + SG.w, 0, SG.lyingH, { b: -1, prop: BIG.bigsign, when: 'settled' });
  return out;
})();

/** 상태에 따라 생기는 벽 번호의 시작 (뒤집힌 전차, 잔해 더미). 정적인 벽 번호와 겹치지 않는다 */
export const DYNAMIC_WALL_ID = 1000;

/** 굴러 뒤집힌 전차 (차체 왼쪽 끝 at): 윗면 발판과 양 끝 벽의 자리 */
export function tramLying(at: number): { x0: number; x1: number; h: number } {
  return { x0: at, x1: at + TR.length, h: TR.lyingH };
}

/**
 * 무너진 자리의 잔해 더미 (건물 b의 c0~c1 칸): 더미 양 끝 x0 ~ x1, 높이 h, 윗면 발판 tx0 ~ tx1.
 * 더미는 그 건물 정면 앞(싸우는 줄 뒤)에 쌓이고, 다 쌓이면 윗면이 발판, 양옆이 벽이 된다.
 */
export function rubbleOf(b: number, c0: number, c1: number): { x0: number; x1: number; h: number; tx0: number; tx1: number } {
  const g = GRIDS[b];
  const R = CITY.rubble;
  const x0 = g.x + c0 * CHUNK - 6;
  const x1 = Math.min(g.x + g.w, g.x + (c1 + 1) * CHUNK) + 6;
  const h = Math.min(R.max, R.base + Math.floor(g.h / R.per));
  const inset = Math.round(((x1 - x0) * (1 - R.top)) / 2);
  return { x0, x1, h, tx0: x0 + inset, tx1: x1 - inset };
}
