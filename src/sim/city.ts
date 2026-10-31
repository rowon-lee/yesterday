import { BREAKABLES, CHUNK, CHUNKS, CITY_RULES as R, chunkIndex, GRIDS, type BuildingGrid } from '../stage/downtown';
import { px } from './rules';
import type { CityState, Fighter, SimState } from './types';

/**
 * 건물 파괴 (게임 기획서 '건물 파괴'). 길가 건물 정면의 덩어리마다 내구도를 둔다.
 * 내구도: 1~100 멀쩡~금~구멍, 0 뚫림, -1 무너져 사라짐. 라운드가 넘어가도 유지된다 (새 경기에만 새로).
 * 무너진 칸과 떨어지는 잔해는 판정에 영향을 주지 않는다.
 * 좌표는 px 정수: x는 월드 x, h는 바닥에서 위로 높이.
 */
export function createCity(): CityState {
  return { hp: CHUNKS.map(() => R.hp), collapses: [] };
}

/** x가 걸친 건물 번호들 (반지름 r만큼 넓혀서) */
function gridsNear(x0: number, x1: number): number[] {
  const out: number[] = [];
  GRIDS.forEach((g, i) => {
    if (g.x < x1 && x0 < g.x + g.w) out.push(i);
  });
  return out;
}

/**
 * (cx, ch) 둘레 radius 안 덩어리의 내구도를 amount만큼 깎는다. 가장자리(반지름 절반 밖)는 절반만.
 * 깎인 덩어리가 있으면 붕괴를 확인한다.
 */
export function damageCity(s: SimState, cx: number, ch: number, radius: number, amount: number, cause: string): number {
  let hit = 0;
  const hp = s.city.hp;
  const touched: number[] = [];
  for (const gi of gridsNear(cx - radius, cx + radius)) {
    const g = GRIDS[gi];
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const i = chunkIndex(g, c, r);
        if (hp[i] <= 0) continue;
        const k = CHUNKS[i];
        // 덩어리 사각형까지의 거리
        const dx = Math.max(k.x - cx, 0, cx - (k.x + k.w));
        const dy = Math.max(k.y0 - ch, 0, ch - (k.y0 + k.h));
        const d2 = dx * dx + dy * dy;
        if (d2 > radius * radius) continue;
        const amt = d2 * 4 <= radius * radius ? amount : amount >> 1;
        hp[i] = Math.max(0, hp[i] - amt);
        hit++;
      }
    }
    touched.push(gi);
  }
  if (hit) {
    s.events.push({ type: 'city', who: -1, x: px(cx), y: -px(ch), text: cause, combo: hit });
    for (const gi of touched) checkCollapse(s, gi);
  }
  return hit;
}

/** 1층이 많이 뚫린 기둥들이 이어져 있으면 그 기둥들(양옆 한 칸씩 더)이 통째로 무너진다 */
function checkCollapse(s: SimState, gi: number): void {
  const g = GRIDS[gi];
  const hp = s.city.hp;
  const weak = (c: number) => {
    let broken = 0;
    for (let r = 0; r < Math.min(R.collapse.groundRows, g.rows); r++) if (hp[chunkIndex(g, c, r)] <= 0) broken++;
    return broken >= R.collapse.brokenPerColumn;
  };
  const standing = (c: number) => hp[chunkIndex(g, c, g.rows - 1)] >= 0;
  let c = 0;
  while (c < g.cols) {
    if (!weak(c)) {
      c++;
      continue;
    }
    let end = c;
    while (end + 1 < g.cols && weak(end + 1)) end++;
    if (end - c + 1 >= R.collapse.minColumns) {
      const c0 = Math.max(0, c - 1);
      const c1 = Math.min(g.cols - 1, end + 1);
      let any = false;
      for (let cc = c0; cc <= c1; cc++) if (standing(cc)) any = true;
      if (any) collapse(s, gi, g, c0, c1);
    }
    c = end + 1;
  }
}

/** from~to 기둥을 무너뜨린다. 이미 무너진 기둥은 건너뛰고, 아직 서 있던 기둥 묶음마다 잔해·이벤트를 낸다 */
function collapse(s: SimState, gi: number, g: BuildingGrid, from: number, to: number): void {
  const hp = s.city.hp;
  const standing = (c: number) => {
    for (let r = 0; r < g.rows; r++) if (hp[chunkIndex(g, c, r)] >= 0) return true;
    return false;
  };
  let c = from;
  while (c <= to) {
    if (!standing(c)) {
      c++;
      continue;
    }
    let end = c;
    while (end + 1 <= to && standing(end + 1)) end++;
    fall(s, gi, g, c, end);
    c = end + 1;
  }
}

function fall(s: SimState, gi: number, g: BuildingGrid, c0: number, c1: number): void {
  const hp = s.city.hp;
  for (let c = c0; c <= c1; c++) for (let r = 0; r < g.rows; r++) hp[chunkIndex(g, c, r)] = -1;
  s.city.collapses.push({ b: gi, c0, c1, tick: s.tick });
  // 무너진 자리의 1층 쇼윈도도 함께 깨진다
  const x0 = g.x + c0 * CHUNK;
  const x1 = g.x + (c1 + 1) * CHUNK;
  BREAKABLES.forEach((b, i) => {
    const p = s.props?.[i];
    if (b.kind !== 'glass' || !p || p.stage === 2 || b.x >= x1 || b.x + b.w <= x0) return;
    p.hp = 0;
    p.stage = 2;
    p.brokenAt = s.tick;
    if (p.damagedAt < 0) p.damagedAt = s.tick;
  });
  // 크게 무너질 때만 슬로모션 (옆 기둥 한두 줄이 따라 무너지는 것은 흔들림만)
  if (c1 - c0 + 1 >= R.collapse.slowColumns) s.slow = Math.max(s.slow, R.slowTicks);
  const x = g.x + ((c0 + c1 + 1) * CHUNK) / 2;
  s.events.push({ type: 'collapse', who: gi, x: px(x), y: -px(g.h / 2), combo: (c1 - c0 + 1) * CHUNK, text: `${c0},${c1}` });
}

const FLYING = new Set(['airhit', 'ko']);
const BODY_H = 40;

/** 세게 날아가는 캐릭터가 지나간 덩어리를 깎는다 (한 번 날아가는 동안 덩어리마다 한 번) */
export function flyThroughCity(s: SimState): void {
  for (const f of s.fighters) {
    if (!FLYING.has(f.mode)) {
      if (f.cityHits.length) f.cityHits = [];
      continue;
    }
    const speed = Math.max(Math.abs(f.vx), Math.abs(f.vy)) / 256;
    if (speed < R.fly.minSpeed) continue;
    const amount = Math.min(R.fly.max, Math.floor((speed - R.fly.minSpeed + 1) * R.fly.per));
    const x = Math.round(f.x / 256);
    const feet = Math.round(-f.y / 256);
    for (const gi of gridsNear(x - 6, x + 6)) {
      const g = GRIDS[gi];
      const c = Math.floor((x - g.x) / CHUNK);
      if (c < 0 || c >= g.cols) continue;
      for (let r = Math.floor(feet / CHUNK); r <= Math.floor((feet + BODY_H) / CHUNK) && r < g.rows; r++) {
        if (r < 0) continue;
        const i = chunkIndex(g, c, r);
        if (s.city.hp[i] <= 0 || f.cityHits.includes(i)) continue;
        f.cityHits.push(i);
        s.city.hp[i] = Math.max(0, s.city.hp[i] - amount);
        s.events.push({ type: 'city', who: -1, x: px(CHUNKS[i].x + CHUNKS[i].w / 2), y: -px(CHUNKS[i].y0 + CHUNKS[i].h / 2), text: 'fly', combo: 1 });
        checkCollapse(s, gi);
      }
    }
  }
}

/** 이 자리(월드 x, 바닥에서 높이)에 아직 서 있는 건물 정면이 있는가 (벽꽝 가능한가) */
export function wallBehind(s: SimState, x: number, h: number): boolean {
  for (const gi of gridsNear(x - 1, x + 1)) {
    const g = GRIDS[gi];
    const c = Math.floor((x - g.x) / CHUNK);
    const r = Math.floor(h / CHUNK);
    if (c < 0 || c >= g.cols || r < 0 || r >= g.rows) continue;
    // 무너져 사라진 칸이 아니면 박힌다 (뚫린 칸이어도 안쪽 벽에 박힌다)
    return s.city.hp[chunkIndex(g, c, r)] >= 0;
  }
  return false;
}

/** 벽꽝: 박힌 자리 둘레를 크게 패고, 박힌 사람은 잠깐 갇혔다가 튕겨 나온다 */
export function wallSplat(s: SimState, def: Fighter, who: number): void {
  const x = Math.round(def.x / 256);
  const h = Math.round(-def.y / 256) + 22;
  damageCity(s, x, h, R.wallsplat.radius, R.wallsplat.amount, 'wallsplat');
  s.events.push({ type: 'wallsplat', who, x: def.x, y: def.y - px(22) });
}
