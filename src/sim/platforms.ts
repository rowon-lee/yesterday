import { CHUNK, chunkIndex, GRIDS, SURFACES, type Surface } from '../stage/citadel';
import { px } from './rules';
import type { SimState } from './types';

/**
 * 한 방향 발판 (기획서 '대련 무대: 시타델 1구역'). 위에서 내려올 때만 서고, 아래에서는 뚫고 올라간다.
 * 좌표는 sim 정수: x는 1/256px, y는 바닥 0에서 위가 음수인 1/256px. 같은 상태면 늘 같은 답.
 * 부서지는 건물에 붙은 발판(차양·비상계단·지붕)은 그 자리 덩어리가 무너져 사라지면 없다.
 */

/** 이 발판이 x(1/256px)에서 받쳐 주는가 */
export function surfaceSolid(s: SimState, sf: Surface, x: number): boolean {
  if (x < px(sf.x0) || x >= px(sf.x1)) return false;
  if (sf.b < 0) return true;
  const g = GRIDS[sf.b];
  const c = Math.max(0, Math.min(g.cols - 1, Math.floor((Math.floor(x / 256) - g.x) / CHUNK)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.floor((sf.h - 1) / CHUNK)));
  return s.city.hp[chunkIndex(g, c, r)] >= 0;
}

/**
 * 떨어지는 동안 이번 틱에 위에서 아래로 지나친 바닥 중 가장 높은 것의 y. 없으면 null.
 * passThrough면 발판은 지나치고 땅에만 선다 (↓+점프로 내려오는 중).
 */
export function landingY(s: SimState, x: number, prevY: number, newY: number, passThrough: boolean): number | null {
  let best: number | null = newY >= 0 ? 0 : null;
  if (passThrough) return best;
  for (const sf of SURFACES) {
    const sy = -px(sf.h);
    if (prevY <= sy && newY >= sy && (best === null || sy < best) && surfaceSolid(s, sf, x)) best = sy;
  }
  return best;
}

/** x에서 발밑(y와 같거나 아래)에 있는 가장 높은 바닥의 y. 땅은 0 */
export function floorBelow(s: SimState, x: number, y: number, passThrough = false): number {
  let best = 0;
  if (passThrough) return best;
  for (const sf of SURFACES) {
    const sy = -px(sf.h);
    if (sy >= y && sy < best && surfaceSolid(s, sf, x)) best = sy;
  }
  return best;
}

/** 서 있는 발판이 있는가 (발판 위가 아니면 false) */
export function onPlatform(s: SimState, x: number, y: number): boolean {
  return y < 0 && floorBelow(s, x, y) === y;
}
