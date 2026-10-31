import {
  BIG, BREAK_RULES, CHUNK, chunkIndex, CITY_RULES, CONTAINER_TOP, DYNAMIC_WALL_ID, GRIDS, rubbleOf, SURFACES, tramLying, tramRestX, WALLS,
  type Holder, type Surface, type Wall,
} from '../stage/citadel';
import { px, WALL_L, WALL_REACH } from './rules';
import type { SimState } from './types';

/**
 * 구조물 (기획서 '벽 기동과 구조물'). 윗면은 한 방향 발판: 위에서 내려올 때만 서고, 아래에서는 뚫고 올라간다.
 * 옆면은 벽 기동에 쓰는 벽이다 (길을 막지는 않는다).
 * 좌표는 sim 정수: x는 1/256px, y는 바닥 0에서 위가 음수인 1/256px. 같은 상태면 늘 같은 답.
 * - 부서지는 건물에 붙은 것(차양·비상계단·지붕)은 그 자리 덩어리가 무너져 사라지면 없다.
 * - 큰 물건에 딸린 것은 그 물건의 상태를 따른다 (급수탑 꼭대기는 서 있는 동안, 등대 밑동은 꺾인 뒤 …).
 * - 상태에 따라 생기는 것: 굴러 뒤집힌 노면전차, 건물이 무너진 자리의 잔해 더미 (쌓인 뒤부터).
 */

/** 이 구조물이 지금 있는가 (건물 덩어리는 따로 본다) */
function present(s: SimState, h: Holder): boolean {
  if (h.prop < 0 || h.when === 'always') return true;
  const p = s.props[h.prop];
  if (h.when === 'standing') return p.stage < 2;
  if (h.when === 'broken') return p.stage === 2;
  return p.stage === 2 && s.tick - p.brokenAt >= BREAK_RULES.settle;
}

/** 건물 b의 x(px), 높이 hgt(px) 자리 덩어리가 서 있는가 */
function chunkStanding(s: SimState, b: number, x: number, hgt: number): boolean {
  const g = GRIDS[b];
  const c = Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.x) / CHUNK)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.floor(hgt / CHUNK)));
  return s.city.hp[chunkIndex(g, c, r)] >= 0;
}

/** 이 발판이 x(1/256px)에서 받쳐 주는가 */
export function surfaceSolid(s: SimState, sf: Surface, x: number): boolean {
  if (x < px(sf.x0) || x >= px(sf.x1)) return false;
  if (!present(s, sf)) return false;
  return sf.b < 0 || chunkStanding(s, sf.b, Math.floor(x / 256), sf.h - 1);
}

/** 다 쌓인 잔해 더미마다 (무너진 기록 순서 k) */
function forEachRubble(s: SimState, fn: (r: ReturnType<typeof rubbleOf>, k: number) => void): void {
  s.city.collapses.forEach((c, k) => {
    if (s.tick - c.tick >= CITY_RULES.rubble.settle) fn(rubbleOf(c.b, c.c0, c.c1), k);
  });
}

/** 뒤집혀 자리를 잡은 노면전차 (없으면 null) */
function lyingTram(s: SimState): ReturnType<typeof tramLying> | null {
  const p = s.props[BIG.tram];
  return p.stage === 2 && s.tick - p.brokenAt >= BREAK_RULES.settle ? tramLying(tramRestX(p.at)) : null;
}

const NOTHING: Holder = { b: -1, prop: -1, when: 'always' };

/** 지금 상태의 발판 전부 (늘 있는 것 + 뒤집힌 전차·다 쌓인 잔해 더미). 있는지는 surfaceSolid로 본다 */
export function surfacesOf(s: SimState): readonly Surface[] {
  const t = lyingTram(s);
  if (!t && !s.city.collapses.length) return SURFACES;
  const out = [...SURFACES];
  if (t) out.push({ x0: t.x0 + 4, x1: t.x1 - 4, h: t.h, tier: 'mid', kind: 'tram', ...NOTHING });
  forEachRubble(s, (r) => out.push({ x0: r.tx0, x1: r.tx1, h: r.h, tier: 'mid', kind: 'rubble', ...NOTHING }));
  return out;
}

/** 지금 서 있는 벽 전부 (벽 기동용). 건물에 붙은 벽은 높이마다 wallSolid로 다시 본다 */
export function wallsOf(s: SimState): Wall[] {
  const out = WALLS.filter((w) => present(s, w));
  const t = lyingTram(s);
  if (t) {
    out.push(
      { x: t.x0, side: -1, h0: 0, h1: t.h, id: DYNAMIC_WALL_ID, ...NOTHING },
      { x: t.x1, side: 1, h0: 0, h1: t.h, id: DYNAMIC_WALL_ID + 1, ...NOTHING },
    );
  }
  forEachRubble(s, (r, k) => {
    const id = DYNAMIC_WALL_ID + 2 + k * 2;
    out.push({ x: r.x0, side: -1, h0: 0, h1: r.h, id, ...NOTHING }, { x: r.x1, side: 1, h0: 0, h1: r.h, id: id + 1, ...NOTHING });
  });
  return out;
}

/** 이 벽이 높이 hgt(px)에서 서 있는가 */
export function wallSolid(s: SimState, w: Wall, hgt: number): boolean {
  if (hgt < w.h0 || hgt >= w.h1 || !present(s, w)) return false;
  return w.b < 0 || chunkStanding(s, w.b, w.side < 0 ? w.x : w.x - 1, hgt);
}

/**
 * 공중에서 dir 쪽(1 오른쪽, -1 왼쪽)을 누를 때 붙을 수 있는 벽 (x: 1/256px, grab: 손이 닿는 높이 px). 없으면 null.
 * 벽을 누르는 쪽에서 몸 가운데가 벽 면에서 WALL_REACH(+slack) 안에 들어와 있고(벽 안으로 깊이 들어가 있지는 않고),
 * 손 높이에 벽이 서 있어야 한다. 가까운 벽부터. slack은 미리 보기용 (CPU가 벽 가까이 왔는지 본다)
 */
export function findWall(s: SimState, x: number, grab: number, dir: number, slack = 0): Wall | null {
  let best: Wall | null = null;
  let bestD = Infinity;
  for (const w of wallsOf(s)) {
    if (w.side !== -dir || !wallSolid(s, w, grab)) continue;
    const wx = px(w.x);
    // 벽 앞 붙는 자리까지 남은 거리 (벽 쪽으로 + 방향)
    const d = (wx - x) * dir - WALL_REACH;
    if (d > px(2 + slack) || d < -WALL_REACH - px(2)) continue;
    if (Math.abs(d) < bestD) {
      bestD = Math.abs(d);
      best = w;
    }
  }
  return best;
}

/** 붙어 있는 벽(번호·붙은 쪽·x px)이 높이 grab(px)에서 아직 서 있는가 (무너지거나 끝나면 false) */
export function wallHolds(s: SimState, id: number, side: number, x: number, grab: number): boolean {
  return wallsOf(s).some((w) => w.id === id && w.side === side && w.x === x && wallSolid(s, w, grab));
}

/** 서쪽 끝 (1/256px): 컨테이너 더미 높이 위에서는 더미 위까지 갈 수 있다 */
export function wallLeft(y: number): number {
  return y <= -px(CONTAINER_TOP.h) ? px(CONTAINER_TOP.standFrom) : WALL_L;
}

/**
 * 떨어지는 동안 이번 틱에 위에서 아래로 지나친 바닥 중 가장 높은 것의 y. 없으면 null.
 * passThrough면 발판은 지나치고 땅과 꽉 찬 윗면(컨테이너 더미)에만 선다 (↓+점프로 내려오는 중).
 */
export function landingY(s: SimState, x: number, prevY: number, newY: number, passThrough: boolean): number | null {
  let best: number | null = newY >= 0 ? 0 : null;
  for (const sf of surfacesOf(s)) {
    if (passThrough && !sf.solid) continue;
    const sy = -px(sf.h);
    if (prevY <= sy && newY >= sy && (best === null || sy < best) && surfaceSolid(s, sf, x)) best = sy;
  }
  return best;
}

/** x에서 발밑(y와 같거나 아래)에 있는 가장 높은 바닥의 y. 땅은 0 */
export function floorBelow(s: SimState, x: number, y: number, passThrough = false): number {
  let best = 0;
  for (const sf of surfacesOf(s)) {
    if (passThrough && !sf.solid) continue;
    const sy = -px(sf.h);
    if (sy >= y && sy < best && surfaceSolid(s, sf, x)) best = sy;
  }
  return best;
}

/** 서 있는 발판이 있는가 (발판 위가 아니면 false) */
export function onPlatform(s: SimState, x: number, y: number): boolean {
  return y < 0 && floorBelow(s, x, y) === y;
}

/** 발밑 발판을 ↓+점프로 뚫고 내려갈 수 있는가 (꽉 찬 윗면이면 못 내려간다) */
export function canDropThrough(s: SimState, x: number, y: number): boolean {
  for (const sf of surfacesOf(s)) if (sf.solid && -px(sf.h) === y && surfaceSolid(s, sf, x)) return false;
  return true;
}
