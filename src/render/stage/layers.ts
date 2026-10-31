import { DOWNTOWN as D } from '../../data/stages/downtown';
import {
  CORNICE, DOOR_W, doorOf, FLOOR_H, FRONT_GAPS, frontBuildings, GROUND, MAP_H, MAP_W, SHOP_H, type FrontBuildingPlace, type FrontGap,
} from '../../stage/downtown';
import { drawText, textWidth } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, dither, ditherRect, hash, haze, line, paint, rect, shade } from './dither';

/**
 * 무대의 겹(레이어)을 미리 그린다. 겹마다 카메라 대비 움직이는 비율(speed)이 있고,
 * 그 비율만큼 가로·세로로 작은 그림이 된다: 폭 = 화면 + (맵 - 화면) × speed.
 * 겹 안의 바닥은 겹 아래 끝에서 groundFromBottom 위. 먼 겹은 매연 색 디더링(haze)으로 덮는다.
 */
export interface Layer {
  canvas: HTMLCanvasElement;
  speed: number;
}

export const layerW = (speed: number): number => Math.ceil(SCREEN_W + (MAP_W - SCREEN_W) * speed);
export const layerH = (speed: number): number => Math.ceil(SCREEN_H + (MAP_H - SCREEN_H) * speed);
export const layerGround = (speed: number): number => layerH(speed) - D.groundFromBottom;
/** 월드 x가 화면 가운데에 올 때 화면 가운데에 보이는 겹 x */
export const toLayerX = (speed: number, worldX: number): number => worldX * speed + (SCREEN_W / 2) * (1 - speed);

// ---------------------------------------------------------------- 1. 하늘
export function buildSky(): Layer {
  const s = D.sky.speed;
  const w = layerW(s);
  const h = layerH(s);
  const [c, g] = canvas(w, h);
  // 위는 어둡고 지평선으로 갈수록 매연이 뿌옇게: 띠 사이를 디더링으로 잇는다
  const bands = [C.smog0, C.smog0, C.smog1, C.smog2, C.smog3, C.smogHaze];
  const bottom = layerGround(s) - 20;
  paint(g, 0, 0, w, h, (x, y) => {
    const f = Math.max(0, Math.min(bands.length - 1.001, (y / bottom) * (bands.length - 1)));
    const i = Math.floor(f);
    return dither(x, y, Math.round((f - i) * 16)) ? bands[i + 1] : bands[i];
  });
  // 매연에 가린 흐린 달
  const m = D.sky.moon;
  disc(g, m.x, m.fromTop, m.r + 4, C.sunDim, 4);
  disc(g, m.x, m.fromTop, m.r, C.sunDim, 10);
  disc(g, m.x, m.fromTop, m.r - 6, C.sunDim, 16);
  // 달을 가로지르는 매연 띠
  for (const [y, hh, lv] of [[44, 4, 6], [58, 3, 9], [70, 2, 11], [80, 5, 7], [116, 4, 5], [146, 3, 6]] as const) {
    ditherRect(g, 0, y, w, hh, C.smog2, lv);
  }
  return { canvas: c, speed: s };
}

// ---------------------------------------------------------------- 2. 먼 실루엣: 거대 굴뚝, 먼 철교, 공장 지붕
/** 거대 굴뚝 (먼 겹 좌표). 매연은 매 틱 따로 그린다 */
export function farChimneys(): Array<{ x: number; w: number; top: number; speed: number }> {
  const F = D.far;
  const gl = layerGround(F.speed) - 30;
  return F.chimneys.map((ch) => ({ x: ch.x, w: ch.w, top: gl - ch.h, speed: F.speed }));
}

export function buildFar(): Layer {
  const F = D.far;
  const w = layerW(F.speed);
  const h = layerH(F.speed);
  const gl = layerGround(F.speed) - 30;
  const [c, g] = canvas(w, h);
  // 공장 지붕 띠 (톱니 지붕)
  let x = -6;
  let k = F.seed;
  while (x < w) {
    const bw = 40 + Math.floor(hash(k++) * 60);
    const bh = F.blockMin + Math.floor(hash(k++) * (F.blockMax - F.blockMin));
    const top = gl - bh;
    rect(g, x, top, bw, h - top, C.factory);
    if (hash(k++) < 0.6) for (let t = 0; t < bw - 7; t += 9) for (let s = 0; s < 7; s++) rect(g, x + t + s, top - 7 + s, 1, 7 - s, C.factory);
    x += bw + Math.floor(hash(k++) * 8);
  }
  // 먼 철교: 교각 위 트러스
  const B = F.bridge;
  const by = gl - B.h;
  for (let px = B.x0; px <= B.x1; px += B.pierEvery) {
    rect(g, px - 3, by, 6, gl - by, C.factory);
    rect(g, px - 5, by + 4, 10, 2, C.factory);
  }
  rect(g, B.x0 - 6, by - 2, B.x1 - B.x0 + 12, 4, C.factory);
  rect(g, B.x0 - 6, by - 14, B.x1 - B.x0 + 12, 1, C.factory);
  for (let tx = B.x0; tx < B.x1; tx += 12) {
    line(g, tx, by - 2, tx + 6, by - 14, C.factory);
    line(g, tx + 6, by - 14, tx + 12, by - 2, C.factory);
  }
  // 거대 굴뚝: 위로 갈수록 살짝 좁아지고, 띠 두 개
  for (const ch of farChimneys()) {
    for (let y = ch.top; y < gl; y++) {
      const t = (gl - y) / (gl - ch.top);
      const ww = Math.round(ch.w * (1 - 0.25 * t));
      rect(g, ch.x + Math.floor((ch.w - ww) / 2), y, ww, 1, C.factory);
    }
    rect(g, ch.x - 1, ch.top, ch.w + 2, 3, C.factory);
    rect(g, ch.x + 1, ch.top + 14, ch.w - 2, 1, C.smog2);
    rect(g, ch.x + 1, ch.top + 30, ch.w - 2, 1, C.smog2);
    // 꼭대기 경고등
    rect(g, ch.x + Math.floor(ch.w / 2), ch.top - 2, 1, 2, C.posterRed);
  }
  haze(c, C.smog3, F.haze);
  return { canvas: c, speed: F.speed };
}

// ---------------------------------------------------------------- 3. 먼 도시
export function buildSkyline(): Layer {
  const S = D.skyline;
  const w = layerW(S.speed);
  const h = layerH(S.speed);
  const gl = layerGround(S.speed) - 20;
  const [c, g] = canvas(w, h);
  let x = -4;
  let k = S.seed;
  while (x < w) {
    const bw = 24 + Math.floor(hash(k++) * 44);
    const bh = S.min + Math.floor(hash(k++) * (S.max - S.min));
    const top = gl - bh;
    rect(g, x, top, bw, h - top, C.skylineFar);
    // 지붕: 급수탑, 계단식 지붕, 첨탑
    const r = hash(k++);
    if (r < 0.3) waterTower(g, x + 4 + Math.floor(hash(k++) * (bw - 16)), top, C.skylineFar, 1);
    else if (r < 0.55) rect(g, x + 4, top - 12, bw - 8, 12, C.skylineFar);
    else if (r < 0.65) {
      rect(g, x + Math.floor(bw / 2) - 3, top - 20, 6, 20, C.skylineFar);
      rect(g, x + Math.floor(bw / 2) - 1, top - 38, 2, 18, C.skylineFar);
    }
    for (let wy = top + 6; wy < gl - 4; wy += 8) {
      for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (hash(k++) < 0.07) rect(g, wx, wy, 2, 3, C.skylineLit);
    }
    x += bw + Math.floor(hash(k++) * 5);
  }
  haze(c, C.smog3, S.haze);
  return { canvas: c, speed: S.speed };
}

function waterTower(g: CanvasRenderingContext2D, x: number, top: number, color: string, scale = 1): void {
  const tw = Math.round(14 * scale);
  const th = Math.round(12 * scale);
  const legs = Math.round(10 * scale);
  line(g, x + 2, top, x + 2, top - legs, color);
  line(g, x + tw - 3, top, x + tw - 3, top - legs, color);
  line(g, x + 2, top - 2, x + tw - 3, top - legs + 2, color);
  line(g, x + tw - 3, top - 2, x + 2, top - legs + 2, color);
  rect(g, x, top - legs - th, tw, th, color);
  for (let i = 0; i < Math.ceil(tw / 2); i++) rect(g, x + i, top - legs - th - i, tw - i * 2, 1, color);
}

// ---------------------------------------------------------------- 4. 가운데: 고층 벽돌 건물, 감시탑, 공장 구간 뒤는 공장
/**
 * 가운데 겹의 바닥 (겹 좌표). 거리 바닥보다 조금 위에 보이게 해서(멀리 있는 땅은 위로 보인다),
 * 광장 난간이나 빈터 철망 너머로 먼 길과 행인이 보이게 한다.
 */
export const midGround = (): number => layerGround(D.mid.speed) - 30;
/** 가운데 겹의 공장 굴뚝 (매연을 매 틱 그린다) */
export function midChimneys(): Array<{ x: number; w: number; top: number; speed: number }> {
  const M = D.mid;
  const gl = midGround();
  const x0 = Math.round(toLayerX(M.speed, D.sections[3].x0)) + 40;
  const out: Array<{ x: number; w: number; top: number; speed: number }> = [];
  let k = M.seed * 7;
  for (let x = x0; x < layerW(M.speed) - 10; x += 90 + Math.floor(hash(k++) * 50)) {
    out.push({ x, w: 10 + Math.floor(hash(k++) * 6), top: gl - 170 - Math.floor(hash(k++) * 80), speed: M.speed });
  }
  return out;
}

export function buildMid(): Layer {
  const M = D.mid;
  const w = layerW(M.speed);
  const h = layerH(M.speed);
  const gl = midGround();
  const [c, g] = canvas(w, h);
  const factoryFrom = toLayerX(M.speed, D.sections[3].x0) - 60;
  let x = -6;
  let k = M.seed;
  let index = 0;
  while (x < w) {
    if (x > factoryFrom) {
      // 공장 구간 뒤: 낮고 넓은 공장 건물, 톱니 지붕
      const bw = 80 + Math.floor(hash(k++) * 70);
      const bh = 90 + Math.floor(hash(k++) * 70);
      const top = gl - bh;
      rect(g, x, top, bw, h - top, C.brickRedDark);
      for (let t = 0; t < bw - 10; t += 14) {
        for (let s = 0; s < 10; s++) rect(g, x + t + s, top - 10 + s, 1, 10 - s, C.brickRedDark);
        rect(g, x + t + 9, top - 10, 1, 10, C.windowDark);
      }
      for (let wx = x + 6; wx < x + bw - 10; wx += 16) {
        rect(g, wx, top + 14, 8, 22, hash(k++) < 0.2 ? C.windowLit : C.windowDark);
        rect(g, wx + 3, top + 14, 1, 22, C.iron);
      }
      x += bw + 4;
      continue;
    }
    const bw = 56 + Math.floor(hash(k++) * 64);
    const bh = M.min + Math.floor(hash(k++) * (M.max - M.min));
    const top = gl - bh;
    const red = hash(k++) < 0.4;
    const base = red ? C.brickRedDark : C.brickDark;
    rect(g, x, top, bw, h - top, base);
    // 계단식 지붕 (아르데코): 위로 갈수록 좁아지는 단 두 개
    const steps = hash(k++) < 0.55 ? 2 : 0;
    let sx = x;
    let sw = bw;
    let sy = top;
    for (let s = 0; s < steps; s++) {
      sx += 8;
      sw -= 16;
      sy -= 24;
      rect(g, sx, sy, sw, 24, base);
      rect(g, sx - 1, sy, sw + 2, 2, C.stoneDark);
    }
    if (steps) rect(g, sx + Math.floor(sw / 2) - 1, sy - 28, 2, 28, C.iron); // 첨탑
    rect(g, x - 1, top, bw + 2, 3, C.stoneDark);
    // 창: 층마다 한 줄
    for (let wy = top + 8; wy < gl - 12; wy += 15) {
      for (let wx = x + 4; wx < x + bw - 6; wx += 9) rect(g, wx, wy, 5, 8, hash(k++) < 0.1 ? C.windowLit : C.windowDark);
    }
    if (!steps && hash(k++) < 0.6) waterTower(g, x + 6 + Math.floor(hash(k++) * (bw - 24)), top, C.iron, 1.3);
    // 칠한 벽 간판
    if (index % 3 === 1) {
      const text = M.wallSigns[Math.floor(index / 3) % M.wallSigns.length];
      const tw = textWidth(text, 2);
      const px = x + Math.floor((bw - tw - 8) / 2);
      const py = top + 26;
      ditherRect(g, px, py, tw + 8, 18, index % 2 ? C.paintTeal : C.paintOchre, 12);
      drawText(g, text, px + 4, py + 4, C.paintCream, 2);
    }
    x += bw + 3 + Math.floor(hash(k++) * 6);
    index++;
  }
  for (const ch of midChimneys()) {
    rect(g, ch.x, ch.top, ch.w, h - ch.top, C.brickRedDark);
    rect(g, ch.x - 1, ch.top, ch.w + 2, 3, C.stoneDark);
    for (let y = ch.top + 12; y < gl; y += 24) rect(g, ch.x, y, ch.w, 1, C.iron);
  }
  for (const t of M.towers) watchtower(g, t.x, gl - t.h, gl);
  // 먼 길: 보도와 차도 (행인이 이 위를 걷는다)
  rect(g, 0, gl, w, h - gl, C.street);
  rect(g, 0, gl, w, 3, C.sidewalk);
  rect(g, 0, gl + 3, w, 1, C.curb);
  ditherRect(g, 0, gl + 4, w, h - gl - 4, C.streetLine, 3);
  haze(c, C.smog3, M.haze);
  return { canvas: c, speed: M.speed };
}

/** 감시탑: 철골 다리, 꼭대기 초소와 서치라이트 (빛줄기는 매 틱 따로 그린다) */
function watchtower(g: CanvasRenderingContext2D, x: number, top: number, base: number): void {
  const legW = 22;
  const cab = top + 14;
  line(g, x, base, x + 5, cab, C.iron);
  line(g, x + legW, base, x + legW - 5, cab, C.iron);
  line(g, x + 1, base, x + 6, cab, C.iron);
  line(g, x + legW - 1, base, x + legW - 6, cab, C.iron);
  for (let y = cab + 6; y < base - 10; y += 20) {
    const t0 = (y - cab) / (base - cab);
    const t1 = (y + 20 - cab) / (base - cab);
    const l0 = x + 5 - 5 * t0;
    const r0 = x + legW - 5 + 5 * t0;
    const l1 = x + 5 - 5 * t1;
    const r1 = x + legW - 5 + 5 * t1;
    line(g, l0, y, r1, y + 20, C.iron);
    line(g, r0, y, l1, y + 20, C.iron);
    line(g, l0, y, r0, y, C.ironLight);
  }
  rect(g, x - 3, top + 3, legW + 6, 11, C.iron);
  rect(g, x - 1, top + 5, legW + 2, 4, C.windowDark);
  rect(g, x + 6, top + 5, 4, 4, C.windowLit);
  rect(g, x - 6, top, legW + 12, 3, C.ironLight);
  rect(g, x + legW - 1, top - 6, 7, 6, C.ironLight);
  rect(g, x + legW + 5, top - 6, 1, 6, C.beam);
}

/** 감시탑 서치라이트가 빛을 내는 곳 (가운데 겹 좌표) */
export function searchlights(): Array<{ x: number; y: number }> {
  const gl = midGround();
  return D.mid.towers.map((t) => ({ x: t.x + 22 + 6, y: gl - t.h - 3 }));
}

// ---------------------------------------------------------------- 5. 싸우는 거리: 길가 건물 (월드 좌표, 부서지는 정면)
export function buildFront(): Layer {
  const [c, g] = canvas(MAP_W, MAP_H);
  for (const b of frontBuildings()) {
    g.save();
    g.beginPath();
    g.rect(b.x, GROUND - b.h, b.w, b.h);
    g.clip();
    building(g, b);
    g.restore();
  }
  for (const gap of FRONT_GAPS) drawGap(g, gap);
  // 철교 그늘: 상판 아래 정면을 한 단계 어둡게, 상판 바로 밑은 한 번 더 (디더링)
  const B = D.bridge;
  shade(c, B.x0, GROUND - B.deck, B.x1 - B.x0, B.deck, DARKER);
  shade(c, B.x0, GROUND - B.deck, B.x1 - B.x0, 40, DARKER, 8);
  return { canvas: c, speed: 1 };
}

/** 그늘 색: 팔레트에서 한 단계 어두운 색 */
export const DARKER: Record<string, string> = {
  [C.brickLight]: C.brick,
  [C.brick]: C.brickDark,
  [C.brickDark]: C.iron,
  [C.brickRed]: C.brickRedDark,
  [C.brickRedDark]: C.brickDark,
  [C.stone]: C.stoneDark,
  [C.stoneDark]: C.ironLight,
  [C.paintCream]: C.stone,
  [C.paintTeal]: C.ironLight,
  [C.paintOchre]: C.awning,
  [C.awning]: C.brickDark,
  [C.awningStripe]: C.awning,
  [C.windowLit]: C.paintOchre,
  [C.windowLight]: C.windowLit,
  [C.windowDark]: C.smog0,
  [C.iron]: C.smog0,
  [C.ironLight]: C.iron,
  [C.posterRed]: C.posterRedDark,
  [C.posterRedDark]: C.brickRedDark,
};

/** 층 경계: [위, 아래] (월드 y). 0이 1층 */
export function floorsOf(b: FrontBuildingPlace): Array<[number, number]> {
  const out: Array<[number, number]> = [[GROUND - SHOP_H, GROUND]];
  for (let f = 1; f < b.floors; f++) out.push([GROUND - SHOP_H - f * FLOOR_H, GROUND - SHOP_H - (f - 1) * FLOOR_H]);
  return out;
}

function brickWall(g: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, base: string, mortar: string, seed: number): void {
  rect(g, x, top, w, h, base);
  for (let y = top + 3; y < top + h; y += 4) {
    rect(g, x, y, w, 1, mortar);
    const off = ((y - top) >> 2) % 2 ? 4 : 0;
    for (let jx = x + off; jx < x + w; jx += 8) if (hash(seed + jx * 7 + y) < 0.55) rect(g, jx, y - 3, 1, 3, mortar);
  }
}

function stoneWall(g: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, seed: number): void {
  rect(g, x, top, w, h, C.stone);
  for (let y = top + 7; y < top + h; y += 8) {
    rect(g, x, y, w, 1, C.stoneDark);
    const off = ((y - top) >> 3) % 2 ? 10 : 0;
    for (let jx = x + off; jx < x + w; jx += 20) rect(g, jx, y - 7, 1, 7, C.stoneDark);
  }
  ditherRect(g, x, top, w, h, C.stoneDark, 2, seed & 3);
}

/** 위층 창 하나: 상인방, 유리, 창살, 창턱. 가끔 불이 켜지거나 판자로 막혀 있다 */
function window1(g: CanvasRenderingContext2D, wx: number, wy: number, ww: number, wh: number, r: number, frame: string = C.stone): void {
  rect(g, wx - 2, wy - 3, ww + 4, 3, frame);
  rect(g, wx, wy, ww, wh, C.windowDark);
  if (r < 0.16) {
    rect(g, wx, wy + 8, ww, wh - 8, C.windowLit);
    ditherRect(g, wx, wy + 8, ww, 5, C.windowLight, 4);
    rect(g, wx, wy, ww, 8, C.awning);
  } else if (r < 0.26) {
    line(g, wx, wy, wx + ww - 1, wy + wh - 1, C.awning);
    line(g, wx + ww - 1, wy, wx, wy + wh - 1, C.awning);
  }
  rect(g, wx + Math.floor(ww / 2) - 1, wy, 2, wh, C.iron);
  rect(g, wx, wy + Math.floor(wh * 0.45), ww, 1, C.iron);
  rect(g, wx - 2, wy + wh, ww + 4, 2, C.stoneDark);
}

function cornice(g: CanvasRenderingContext2D, x: number, top: number, w: number): void {
  rect(g, x, top, w, 6, C.stone);
  rect(g, x, top + 6, w, 2, C.stoneDark);
  for (let dx = x + 2; dx < x + w - 2; dx += 6) rect(g, dx, top + 8, 3, 2, C.stoneDark);
}

function building(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  switch (b.kind) {
    case 'shop':
    case 'flat':
      tenement(g, b);
      break;
    case 'warehouse':
      warehouse(g, b);
      break;
    case 'hall':
    case 'wing':
      hall(g, b);
      break;
    case 'factory':
      factory(g, b);
      break;
  }
}

/** 상가·공동주택: 벽돌, 층마다 창, 철제 비상계단, 선전 포스터. 1층은 가게(쇼윈도·차양·간판) 또는 현관 */
function tenement(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const x = b.x;
  const top = GROUND - b.h;
  const red = hash(b.seed) < 0.5;
  const base = red ? C.brickRed : C.brick;
  const mortar = red ? C.brickRedDark : C.brickDark;
  brickWall(g, x, top, b.w, b.h, base, mortar, b.seed);
  rect(g, x, top, 2, b.h, mortar);
  rect(g, x + b.w - 1, top, 1, b.h, C.brickLight);
  const floors = floorsOf(b);
  // 층 사이 돌 띠
  for (let f = 1; f < floors.length; f++) rect(g, x, floors[f][1] - 2, b.w, 2, C.stoneDark);
  cornice(g, x, top, b.w);
  // 위층 창 (2층부터)
  let k = b.seed;
  const winTops: number[] = [];
  for (let f = 1; f < floors.length; f++) {
    const wy = floors[f][0] + 14;
    winTops.push(wy);
    for (let wx = x + 10; wx + 14 <= x + b.w - 10; wx += 24) window1(g, wx, wy, 14, 30, hash(k++));
  }
  // 철제 비상계단: 층마다 발판과 난간, 사이를 잇는 사다리
  if (b.escape && winTops.length > 1) {
    const ew = Math.min(48, b.w - 24);
    const ex = x + b.w - ew - 8;
    winTops.forEach((wy, n) => {
      const py = wy + 34;
      rect(g, ex, py, ew, 2, C.iron);
      rect(g, ex, py - 10, ew, 1, C.ironLight);
      for (let rx = ex; rx < ex + ew; rx += 4) rect(g, rx, py - 10, 1, 10, C.iron);
      const below = winTops[n - 1];
      if (below !== undefined) {
        const ny = below + 34;
        if (n % 2) line(g, ex + 3, py, ex + ew - 6, ny, C.iron);
        else line(g, ex + ew - 4, py, ex + 4, ny, C.iron);
      }
    });
    const last = winTops[0] + 34;
    for (const lx of [ex + 3, ex + 10]) rect(g, lx, last, 1, 20, C.iron);
    for (let ly = last + 3; ly < last + 20; ly += 4) rect(g, ex + 3, ly, 8, 1, C.iron);
  }
  // 선전 포스터: 3층 벽에 붙은 붉은 종이, 별 문장과 구호
  if (b.poster && floors.length >= 4) {
    const pw = Math.max(34, textWidth(b.poster, 2) + 10);
    const ph = 48;
    const px = x + 6;
    const py = floors[2][0] + 4;
    poster(g, px, py, pw, ph, b.poster, base);
  }
  const shopTop = GROUND - SHOP_H;
  if (b.kind === 'shop') {
    // 1층 가게: 쇼윈도 틀(유리는 부서지는 물건이라 props.ts가 그린다), 문, 차양, 칠한 간판
    rect(g, x + 2, shopTop + 4, b.w - 4, SHOP_H - 4, C.brickDark);
    const doorX = doorOf(b);
    rect(g, x + 8, GROUND - 60, doorX - x - 12, 60, C.stoneDark);
    rect(g, x + 8, GROUND - 4, doorX - x - 12, 4, C.stone);
    rect(g, doorX - 1, GROUND - 58, DOOR_W + 2, 58, C.iron);
    rect(g, doorX + 2, GROUND - 54, DOOR_W - 4, 20, C.windowDark);
    rect(g, doorX + DOOR_W - 5, GROUND - 28, 2, 2, C.stone);
    // 차양: 줄무늬, 앞으로 기울어짐
    for (let ax = x + 3; ax < x + b.w - 3; ax++) rect(g, ax, GROUND - 70, 1, 9, Math.floor((ax - x) / 6) % 2 ? C.awningStripe : C.awning);
    for (let ax = x + 3; ax < x + b.w - 3; ax += 6) rect(g, ax, GROUND - 61, 3, 2, C.awning);
    rect(g, x + 3, GROUND - 70, b.w - 6, 1, C.iron);
    if (b.sign) {
      const tw = textWidth(b.sign, 2);
      const sx = x + Math.floor((b.w - tw - 10) / 2);
      rect(g, sx, shopTop - 6, tw + 10, 16, C.iron);
      rect(g, sx + 1, shopTop - 5, tw + 8, 14, b.seed % 3 ? C.paintTeal : C.paintOchre);
      drawText(g, b.sign, sx + 5, shopTop - 2, C.paintCream, 2);
    }
  } else {
    // 공동주택 1층: 가운데 현관(계단 세 단, 두 짝 문, 채광창), 양옆 반지하 창과 난간
    const dx = x + Math.floor(b.w / 2) - 14;
    rect(g, dx - 4, GROUND - 66, 36, 4, C.stone);
    rect(g, dx, GROUND - 62, 28, 50, C.iron);
    rect(g, dx + 2, GROUND - 60, 11, 46, C.awning);
    rect(g, dx + 15, GROUND - 60, 11, 46, C.awning);
    rect(g, dx + 4, GROUND - 56, 7, 14, C.windowDark);
    rect(g, dx + 17, GROUND - 56, 7, 14, C.windowDark);
    for (let st = 0; st < 3; st++) rect(g, dx - 6 - st * 3, GROUND - 12 + st * 4, 40 + st * 6, 4, st % 2 ? C.stoneDark : C.stone);
    for (const wx of [x + 12, x + b.w - 34]) {
      window1(g, wx, GROUND - 52, 22, 20, hash(k++));
      for (let rx = wx - 4; rx < wx + 26; rx += 3) rect(g, rx, GROUND - 26, 1, 14, C.iron);
      rect(g, wx - 4, GROUND - 26, 30, 1, C.ironLight);
    }
  }
}

/** 창고: 어두운 벽돌, 쇠창살 작은 창, 큰 하역문, 바랜 벽 글씨, 꼭대기 도르래 들보 */
function warehouse(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const x = b.x;
  const top = GROUND - b.h;
  brickWall(g, x, top, b.w, b.h, C.brickRedDark, C.brickDark, b.seed);
  rect(g, x, top, 2, b.h, C.brickDark);
  const floors = floorsOf(b);
  for (let f = 1; f < floors.length; f++) rect(g, x, floors[f][1] - 2, b.w, 2, C.iron);
  cornice(g, x, top, b.w);
  let k = b.seed;
  for (let f = 1; f < floors.length; f++) {
    const wy = floors[f][0] + 18;
    for (let wx = x + 12; wx + 12 <= x + b.w - 10; wx += 22) {
      rect(g, wx - 1, wy - 2, 14, 2, C.stoneDark);
      rect(g, wx, wy, 12, 18, hash(k++) < 0.08 ? C.windowLit : C.windowDark);
      for (let bx = wx + 2; bx < wx + 12; bx += 3) rect(g, bx, wy, 1, 18, C.iron);
    }
  }
  // 바랜 벽 글씨 (2~3층 사이)
  if (b.sign && floors.length >= 3) {
    const tw = textWidth(b.sign, 3);
    const sx = x + Math.floor((b.w - tw) / 2);
    const sy = floors[1][0] + 2;
    ditherRect(g, sx - 6, sy, tw + 12, 16, C.paintOchre, 6);
    drawText(g, b.sign, sx, sy + 1, C.paintCream, 3);
    ditherRect(g, sx - 6, sy, tw + 12, 16, C.brickRedDark, 4);
  }
  if (b.poster && floors.length >= 3) poster(g, x + b.w - 44, floors[floors.length - 1][0] + 12, 36, 44, b.poster, C.brickRedDark);
  // 1층: 큰 하역문 (반쯤 열린 셔터), 작은 문
  const lx = x + 14;
  const lw = Math.min(56, b.w - 50);
  rect(g, lx - 3, GROUND - 70, lw + 6, 70, C.iron);
  rect(g, lx, GROUND - 66, lw, 66, C.ironLight);
  for (let y = GROUND - 64; y < GROUND - 14; y += 3) rect(g, lx, y, lw, 1, C.iron);
  rect(g, lx, GROUND - 14, lw, 14, C.windowDark);
  rect(g, lx - 6, GROUND - 4, lw + 12, 4, C.stone);
  const dx = x + b.w - 30;
  rect(g, dx, GROUND - 52, 18, 52, C.iron);
  rect(g, dx + 2, GROUND - 50, 14, 48, C.awning);
  // 도르래 들보와 늘어진 밧줄
  const hx = x + Math.floor(b.w / 2);
  rect(g, hx - 2, top + 10, 4, 14, C.iron);
  rect(g, hx - 5, top + 22, 10, 3, C.ironLight);
  line(g, hx, top + 25, hx, top + 70, C.awningStripe);
  rect(g, hx - 2, top + 70, 5, 4, C.iron);
}

/** 히어로 국 청사와 날개: 돌 벽, 기둥, 높은 창, 붉은 현수막, 계단과 큰 문, 처마의 글씨 */
function hall(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const x = b.x;
  const top = GROUND - b.h;
  stoneWall(g, x, top, b.w, b.h, b.seed);
  rect(g, x, top, 2, b.h, C.stoneDark);
  rect(g, x + b.w - 2, top, 2, b.h, C.stoneDark);
  const floors = floorsOf(b);
  const main = b.kind === 'hall';
  // 처마: 두꺼운 돌 띠 (본관은 글씨가 새겨진 띠)
  rect(g, x, top, b.w, 10, C.stone);
  rect(g, x, top + 10, b.w, 3, C.stoneDark);
  for (let dx = x + 3; dx < x + b.w - 3; dx += 8) rect(g, dx, top + 13, 4, 3, C.stoneDark);
  let k = b.seed;
  if (main) {
    const bandY = top + 18;
    rect(g, x + 6, bandY, b.w - 12, 22, C.stoneDark);
    rect(g, x + 8, bandY + 2, b.w - 16, 18, C.stone);
    if (b.sign) drawText(g, b.sign, x + Math.floor((b.w - textWidth(b.sign, 2)) / 2), bandY + 6, C.iron, 2);
    // 기둥: 2층부터 처마 띠 아래까지
    const colTop = bandY + 24;
    const colBottom = GROUND - SHOP_H;
    const n = Math.floor((b.w - 20) / 48);
    const gap = (b.w - 20) / n;
    for (let i = 0; i <= n; i++) {
      const cx = Math.round(x + 10 + i * gap) - 6;
      rect(g, cx - 2, colTop, 16, 6, C.stoneDark);
      rect(g, cx, colTop + 6, 12, colBottom - colTop - 12, C.paintCream);
      rect(g, cx + 9, colTop + 6, 3, colBottom - colTop - 12, C.stone);
      for (let fx = cx + 3; fx < cx + 9; fx += 3) rect(g, fx, colTop + 8, 1, colBottom - colTop - 16, C.stone);
      rect(g, cx - 2, colBottom - 6, 16, 6, C.stoneDark);
      // 기둥 사이: 층마다 높은 창, 가운데 칸에는 붉은 현수막
      if (i < n) {
        const mx = Math.round(x + 10 + i * gap) + 8;
        const mw = Math.round(gap) - 16;
        if (n >= 4 && (i === 1 || i === n - 2)) {
          banner(g, mx + 4, colTop + 10, mw - 8, Math.min(150, colBottom - colTop - 30));
        } else {
          for (let f = 1; f < floors.length; f++) {
            const wy = Math.max(colTop + 8, floors[f][0] + 10);
            if (wy + 36 > floors[f][1]) continue;
            window1(g, mx + Math.floor((mw - 16) / 2), wy, 16, 36, hash(k++), C.stoneDark);
          }
        }
      }
    }
    // 1층: 넓은 돌계단, 큰 청동 문, 양옆 등
    for (let st = 0; st < 4; st++) rect(g, x + 20 + st * 6, GROUND - 16 + st * 4, b.w - 40 - st * 12, 4, st % 2 ? C.stoneDark : C.stone);
    const dw = 44;
    const dx = x + Math.floor((b.w - dw) / 2);
    rect(g, dx - 4, GROUND - 76, dw + 8, 60, C.stoneDark);
    rect(g, dx, GROUND - 72, dw, 56, C.awning);
    rect(g, dx + dw / 2 - 1, GROUND - 72, 2, 56, C.iron);
    for (let ry = GROUND - 66; ry < GROUND - 20; ry += 10) for (let rx = dx + 4; rx < dx + dw - 4; rx += 8) rect(g, rx, ry, 2, 2, C.paintOchre);
    for (const lx of [dx - 16, dx + dw + 10]) {
      rect(g, lx, GROUND - 70, 6, 10, C.lampWarm);
      rect(g, lx + 1, GROUND - 68, 4, 6, C.lampGlow);
      rect(g, lx + 2, GROUND - 60, 2, 10, C.iron);
    }
    for (let wx = x + 16; wx < dx - 30; wx += 28) window1(g, wx, GROUND - 64, 14, 36, hash(k++), C.stoneDark);
    for (let wx = dx + dw + 26; wx + 14 < x + b.w - 12; wx += 28) window1(g, wx, GROUND - 64, 14, 36, hash(k++), C.stoneDark);
  } else {
    for (let f = 0; f < floors.length; f++) {
      const wy = floors[f][0] + (f === 0 ? 20 : 12);
      if (f > 0) rect(g, x, floors[f][1] - 3, b.w, 3, C.stoneDark);
      for (let wx = x + 12; wx + 14 <= x + b.w - 10; wx += 26) window1(g, wx, wy, 14, f === 0 ? 40 : 32, hash(k++), C.stoneDark);
    }
  }
}

/** 공장: 붉은 벽돌, 두 층 높이의 아치 창(창살 격자), 처마의 공장 이름, 큰 철문, 증기 배관 */
function factory(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const x = b.x;
  const top = GROUND - b.h;
  brickWall(g, x, top, b.w, b.h, C.brickRed, C.brickRedDark, b.seed);
  rect(g, x, top, 2, b.h, C.brickRedDark);
  // 꼭대기: 톱니 지붕 단면과 공장 이름 띠
  for (let t = x; t < x + b.w - 12; t += 16) for (let s = 0; s < 12; s++) rect(g, t + s, top + 12 - s, 1, s + 1, C.ironLight);
  rect(g, x, top + 12, b.w, 3, C.iron);
  if (b.sign) {
    const tw = textWidth(b.sign, 2);
    const sx = x + Math.floor((b.w - tw - 12) / 2);
    rect(g, sx, top + 20, tw + 12, 18, C.iron);
    drawText(g, b.sign, sx + 6, top + 24, C.paintCream, 2);
  }
  // 아치 창: 1층 위부터 처마 띠 아래까지 큰 창
  let k = b.seed;
  const winTop = top + 46;
  const winBottom = GROUND - SHOP_H - 6;
  for (let wx = x + 14; wx + 28 <= x + b.w - 12; wx += 40) {
    const ww = 28;
    rect(g, wx - 3, winTop - 3, ww + 6, winBottom - winTop + 6, C.brickRedDark);
    for (let y = winTop; y < winBottom; y++) {
      const arch = y - winTop < 8 ? Math.round(8 - Math.sqrt(64 - (8 - (y - winTop)) ** 2) * 1.6) : 0;
      rect(g, wx + Math.max(0, arch), y, ww - Math.max(0, arch) * 2, 1, C.windowDark);
    }
    // 안쪽 용광로 불빛이 비치는 칸
    if (hash(k++) < 0.5) ditherRect(g, wx, winBottom - 40, ww, 40, C.windowLit, 5 + Math.floor(hash(k++) * 5));
    for (let gx = wx + 6; gx < wx + ww; gx += 7) rect(g, gx, winTop + 4, 1, winBottom - winTop - 4, C.iron);
    for (let gy = winTop + 10; gy < winBottom; gy += 9) rect(g, wx, gy, ww, 1, C.iron);
    rect(g, wx - 3, winBottom, ww + 6, 3, C.stoneDark);
  }
  if (b.poster) poster(g, x + 8, GROUND - SHOP_H - 60, 36, 46, b.poster, C.brickRed);
  // 1층: 리벳 박은 큰 철문 두 짝, 작은 문
  const dw = 64;
  const dx = x + Math.floor((b.w - dw) / 2);
  rect(g, dx - 3, GROUND - 74, dw + 6, 74, C.iron);
  rect(g, dx, GROUND - 70, dw / 2 - 1, 70, C.ironLight);
  rect(g, dx + dw / 2 + 1, GROUND - 70, dw / 2 - 1, 70, C.ironLight);
  for (let ry = GROUND - 66; ry < GROUND - 2; ry += 8) for (let rx = dx + 3; rx < dx + dw - 2; rx += 6) rect(g, rx, ry, 1, 1, C.iron);
  rect(g, dx + 6, GROUND - 40, dw - 12, 2, C.iron);
  // 증기 배관: 1층 위를 가로지르는 굵은 관, 이음매, 내려오는 관과 밸브
  const py = GROUND - SHOP_H - 2;
  rect(g, x, py, b.w, 6, C.rust);
  rect(g, x, py, b.w, 1, C.awningStripe);
  for (let fx = x + 10; fx < x + b.w; fx += 30) rect(g, fx, py - 1, 3, 8, C.iron);
  for (const vx of factoryVents(b)) {
    rect(g, vx - 2, py - 18, 4, 18, C.rust);
    rect(g, vx - 3, py - 20, 6, 3, C.iron);
  }
  const dropX = x + b.w - 20;
  rect(g, dropX, py, 5, GROUND - py, C.rust);
  rect(g, dropX - 3, GROUND - 40, 11, 3, C.iron);
  disc(g, dropX + 2, GROUND - 45, 3, C.posterRed);
}

/** 공장 배관의 증기 구멍 (월드 x). 증기는 매 틱 따로 그린다 */
export function factoryVents(b: FrontBuildingPlace): number[] {
  return [b.x + Math.floor(b.w * 0.22), b.x + Math.floor(b.w * 0.8)];
}

/** 선전 포스터: 붉은 종이, 별 문장과 구호, 찢어진 귀퉁이 */
function poster(g: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, text: string, wall: string): void {
  rect(g, px, py, pw, ph, C.posterRed);
  rect(g, px, py, pw, 1, C.paintCream);
  rect(g, px, py + ph - 1, pw, 1, C.posterRedDark);
  star(g, px + Math.floor(pw / 2), py + 14, 2);
  drawText(g, text, px + Math.floor((pw - textWidth(text, 2)) / 2), py + ph - 14, C.paintCream, 2);
  rect(g, px + pw - 5, py + ph - 5, 5, 5, wall);
  rect(g, px + pw - 3, py + ph - 7, 3, 2, wall);
}

/** 세로로 늘어진 붉은 현수막 (별 문장) */
function banner(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(g, x - 2, y - 3, w + 4, 3, C.iron);
  rect(g, x, y, w, h, C.posterRed);
  rect(g, x + 2, y, 1, h, C.posterRedDark);
  rect(g, x + w - 3, y, 1, h, C.posterRedDark);
  star(g, x + Math.floor(w / 2), y + 24, 3);
  for (let i = 0; i < Math.floor(w / 2); i++) rect(g, x + i, y + h + i, w - i * 2, 1, C.posterRed);
}

/** 포스터의 별 문장 (가운데 cx, cy), 크기 배수 */
function star(g: CanvasRenderingContext2D, cx: number, cy: number, s = 1): void {
  const rows = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rect(g, cx + (x - 3) * s, cy + (y - 3) * s, s, s, C.posterRedDark);
  });
}

/** 건물 사이 빈자리: 골목(비움), 빈터(철망), 광장(돌 난간), 공장 마당(문기둥과 철문) */
function drawGap(g: CanvasRenderingContext2D, gap: FrontGap): void {
  const x = gap.x;
  const w = gap.w;
  switch (gap.kind) {
    case 'alley':
      // 골목 안쪽 그늘: 바닥 근처만 어둡게
      ditherRect(g, x, GROUND - 20, w, 20, C.smog0, 6);
      break;
    case 'lot': {
      for (let px = x + 2; px < x + w; px += 20) rect(g, px, GROUND - 46, 2, 46, C.iron);
      rect(g, x, GROUND - 44, w, 1, C.ironLight);
      for (let y = GROUND - 43; y < GROUND; y++) for (let px = x; px < x + w; px++) if ((px + y) % 4 === 0 || (px - y + 400) % 4 === 0) {
        if (dither(px, y, 7)) rect(g, px, y, 1, 1, C.wire);
      }
      for (let i = 0; i < w / 6; i++) {
        const cx = x + i * 6 + 3;
        line(g, cx - 3, GROUND - 48, cx, GROUND - 51, C.wire);
        line(g, cx, GROUND - 51, cx + 3, GROUND - 48, C.wire);
      }
      for (let i = 0; i < w; i += 3) rect(g, x + i, GROUND - 2 - Math.floor(hash(i + x) * 6), 1, 6, C.paintTeal);
      break;
    }
    case 'open': {
      // 광장 뒤 돌 난간: 받침, 난간동자, 손잡이
      rect(g, x, GROUND - 6, w, 6, C.stoneDark);
      for (let bx = x + 2; bx < x + w - 2; bx += 6) {
        rect(g, bx, GROUND - 20, 4, 14, C.stone);
        rect(g, bx + 1, GROUND - 16, 2, 6, C.stoneDark);
      }
      rect(g, x, GROUND - 24, w, 4, C.stone);
      rect(g, x, GROUND - 24, w, 1, C.paintCream);
      for (let px = x; px < x + w; px += 50) rect(g, px, GROUND - 28, 8, 28, C.stone);
      break;
    }
    case 'yard': {
      // 공장 마당 입구: 벽돌 문기둥 두 개, 위를 잇는 철제 아치와 반쯤 열린 철문
      for (const px of [x, x + w - 12]) {
        brickWall(g, px, GROUND - 96, 12, 96, C.brickRed, C.brickRedDark, px);
        rect(g, px - 1, GROUND - 100, 14, 4, C.stone);
      }
      for (let i = 0; i <= w - 24; i++) {
        const t = i / (w - 24);
        const ay = GROUND - 96 - Math.round(Math.sin(Math.PI * t) * 12);
        rect(g, x + 12 + i, ay, 1, 2, C.iron);
      }
      for (let bx = x + 14; bx < x + 14 + (w - 28) * 0.45; bx += 5) rect(g, bx, GROUND - 70, 1, 70, C.iron);
      rect(g, x + 12, GROUND - 70, Math.round((w - 28) * 0.45) + 2, 2, C.iron);
      rect(g, x + 12, GROUND - 36, Math.round((w - 28) * 0.45) + 2, 1, C.iron);
      break;
    }
  }
}

// ---------------------------------------------------------------- 고가 철교 (월드 좌표, 부서지지 않음)
/** 철교 그림과 그림이 놓이는 왼쪽 끝 */
export function buildBridge(): { canvas: HTMLCanvasElement; x: number } {
  const B = D.bridge;
  const x0 = B.x0 - B.pierW;
  const [c, g] = canvas(B.x1 - B.x0 + B.pierW * 2, MAP_H);
  const X = (wx: number) => wx - x0;
  const deckBottom = GROUND - B.deck;
  const deckTop = deckBottom - B.deckH;
  const trussTop = deckTop - B.truss;
  // 뒤쪽 기둥과 무릎 받침
  for (let px = B.x0 + B.pillarEvery / 2; px < B.x1; px += B.pillarEvery) {
    const cx = X(px) - B.pillarW / 2;
    rect(g, cx, deckBottom, B.pillarW, GROUND - deckBottom, C.iron);
    rect(g, cx + B.pillarW - 3, deckBottom, 2, GROUND - deckBottom, C.ironLight);
    for (let ry = deckBottom + 6; ry < GROUND - 4; ry += 8) rect(g, cx + 2, ry, 1, 1, C.ironLight);
    rect(g, cx - 4, GROUND - 6, B.pillarW + 8, 6, C.ironLight);
    line(g, cx, deckBottom + 26, cx - 22, deckBottom, C.iron);
    line(g, cx + B.pillarW, deckBottom + 26, cx + B.pillarW + 22, deckBottom, C.iron);
    line(g, cx, deckBottom + 27, cx - 22, deckBottom + 1, C.iron);
    line(g, cx + B.pillarW, deckBottom + 27, cx + B.pillarW + 22, deckBottom + 1, C.iron);
  }
  // 상판: 리벳 박은 판 거더, 보강재
  rect(g, X(B.x0), deckTop, B.x1 - B.x0, B.deckH, C.iron);
  rect(g, X(B.x0), deckTop, B.x1 - B.x0, 2, C.ironLight);
  rect(g, X(B.x0), deckBottom - 3, B.x1 - B.x0, 3, C.smog0);
  for (let sx = X(B.x0) + 6; sx < X(B.x1); sx += 12) {
    rect(g, sx, deckTop + 3, 2, B.deckH - 6, C.ironLight);
    rect(g, sx + 6, deckTop + 5, 1, 1, C.wire);
    rect(g, sx + 6, deckBottom - 6, 1, 1, C.wire);
  }
  // 난간 트러스와 선로
  rect(g, X(B.x0), trussTop, B.x1 - B.x0, 3, C.iron);
  for (let tx = X(B.x0); tx < X(B.x1); tx += 18) {
    line(g, tx, deckTop, tx + 9, trussTop + 2, C.iron);
    line(g, tx + 9, trussTop + 2, tx + 18, deckTop, C.iron);
    rect(g, tx, trussTop, 2, B.truss, C.iron);
  }
  // 양 끝 돌 교각
  for (const px of [B.x0 - B.pierW, B.x1]) {
    stoneWall(g, X(px), trussTop - 6, B.pierW, GROUND - trussTop + 6, px);
    rect(g, X(px) - 2, trussTop - 10, B.pierW + 4, 4, C.stone);
    rect(g, X(px) - 2, deckBottom, B.pierW + 4, 3, C.stoneDark);
  }
  return { canvas: c, x: x0 };
}

// ---------------------------------------------------------------- 거리 (월드 좌표)
export function buildStreet(): Layer {
  const [c, g] = canvas(MAP_W, MAP_H);
  const y0 = GROUND;
  const sw = D.street.sidewalk;
  // 보도: 판석 이음매
  rect(g, 0, y0, MAP_W, sw, C.sidewalk);
  for (let x = 0; x < MAP_W; x += 20) rect(g, x, y0 + 1, 1, sw - 1, C.sidewalkJoint);
  rect(g, 0, y0, MAP_W, 1, C.curb);
  // 연석과 차도 (자갈 무늬)
  rect(g, 0, y0 + sw, MAP_W, 2, C.curb);
  rect(g, 0, y0 + sw + 2, MAP_W, MAP_H - y0 - sw - 2, C.street);
  ditherRect(g, 0, y0 + sw + 3, MAP_W, MAP_H - y0 - sw - 3, C.streetLine, 3);
  // 노면전차 선로 두 줄 (전차가 다니는 구간), 광장은 돌 포장
  const T = D.tram;
  for (const ry of [y0 + sw + 7, y0 + sw + 14]) {
    rect(g, T.x0, ry, T.x1 - T.x0, 1, C.rail);
    rect(g, T.x0, ry + 1, T.x1 - T.x0, 1, C.railDark);
  }
  const P = D.sections[2];
  for (let x = P.x0; x < P.x1; x += 12) for (let y = y0 + sw + 3; y < MAP_H; y += 6) rect(g, x + ((y >> 1) % 2) * 6, y, 1, 1, C.sidewalkJoint);
  // 전차 가공선: 건물 앞을 따라 늘어진 전선, 짧은 걸이
  const wy = y0 - T.wire;
  for (let x = T.x0; x < T.x1; x++) {
    const sag = Math.round(Math.sin(((x - T.x0) % 120) / 120 * Math.PI) * 3);
    rect(g, x, wy + sag, 1, 1, C.wire);
  }
  for (let x = T.x0; x < T.x1; x += 120) rect(g, x, wy - 10, 1, 10, C.iron);
  for (const p of D.street.props) prop(g, p.kind, p.x, y0, 'text' in p ? p.text : '');
  return { canvas: c, speed: 1 };
}

/** 거리 소품 중 증기가 오르는 곳 (맨홀, 월드 x와 y) */
export function manholes(): Array<{ x: number; y: number }> {
  return D.street.props.filter((p) => p.kind === 'manhole').map((p) => ({ x: p.x + 9, y: GROUND + 18 }));
}

function prop(g: CanvasRenderingContext2D, kind: string, x: number, ground: number, text: string): void {
  switch (kind) {
    case 'mailbox':
      rect(g, x, ground - 24, 14, 19, C.paintTeal);
      rect(g, x, ground - 26, 14, 2, C.ironLight);
      rect(g, x + 3, ground - 20, 8, 1, C.iron);
      rect(g, x + 2, ground - 5, 2, 5, C.iron);
      rect(g, x + 10, ground - 5, 2, 5, C.iron);
      break;
    case 'barrel':
      rect(g, x, ground - 20, 14, 20, C.awning);
      rect(g, x, ground - 17, 14, 1, C.iron);
      rect(g, x, ground - 6, 14, 1, C.iron);
      rect(g, x + 11, ground - 20, 2, 20, C.awningStripe);
      break;
    case 'crates':
      for (const [cx, cy, s] of [[0, 0, 18], [18, 0, 18], [8, 18, 16]] as const) {
        const bx = x + cx;
        const by = ground - cy - s;
        rect(g, bx, by, s, s, C.awning);
        rect(g, bx, by, s, 1, C.awningStripe);
        rect(g, bx, by + s - 1, s, 1, C.iron);
        line(g, bx + 1, by + 1, bx + s - 2, by + s - 2, C.awningStripe);
        rect(g, bx, by, 1, s, C.iron);
      }
      break;
    case 'manhole':
      rect(g, x, ground + 16, 18, 4, C.iron);
      rect(g, x + 2, ground + 15, 14, 1, C.iron);
      rect(g, x + 3, ground + 17, 12, 1, C.railDark);
      break;
    case 'posterboard': {
      const pw = Math.max(32, textWidth(text, 2) + 12);
      const top = ground - 78;
      rect(g, x + 3, top + 46, 3, 32, C.iron);
      rect(g, x + pw - 6, top + 46, 3, 32, C.iron);
      rect(g, x, top, pw, 48, C.iron);
      rect(g, x + 2, top + 2, pw - 4, 44, C.posterRed);
      rect(g, x + 2, top + 2, pw - 4, 1, C.paintCream);
      star(g, x + Math.floor(pw / 2), top + 14, 2);
      drawText(g, text, x + Math.floor((pw - textWidth(text, 2)) / 2), top + 30, C.paintCream, 2);
      rect(g, x + pw - 8, top + 38, 6, 8, C.iron);
      break;
    }
    case 'flagpole': {
      // 높은 깃대와 붉은 깃발
      rect(g, x, ground - 170, 2, 170, C.ironLight);
      rect(g, x - 1, ground - 174, 4, 4, C.paintOchre);
      rect(g, x - 3, ground - 6, 8, 6, C.stoneDark);
      rect(g, x + 2, ground - 166, 40, 26, C.posterRed);
      rect(g, x + 2, ground - 141, 40, 1, C.posterRedDark);
      star(g, x + 16, ground - 153, 2);
      for (let i = 0; i < 6; i++) rect(g, x + 36 + i, ground - 166 + (i % 2), 1, 26, C.posterRedDark);
      break;
    }
    case 'statue': {
      // 동상: 돌 받침 위에 주먹을 든 영웅 (어두운 청동 실루엣, 눈 없음)
      rect(g, x, ground - 34, 44, 34, C.stone);
      rect(g, x - 3, ground - 38, 50, 5, C.stoneDark);
      rect(g, x - 3, ground - 6, 50, 6, C.stoneDark);
      ditherRect(g, x, ground - 33, 44, 26, C.stoneDark, 3);
      const bx = x + 22;
      const by = ground - 38;
      const bronze = C.ironLight;
      rect(g, bx - 6, by - 4, 5, 4, bronze);
      rect(g, bx + 2, by - 4, 5, 4, bronze);
      line(g, bx - 4, by - 4, bx - 2, by - 22, bronze);
      line(g, bx - 3, by - 4, bx - 1, by - 22, bronze);
      line(g, bx + 4, by - 4, bx + 2, by - 22, bronze);
      line(g, bx + 5, by - 4, bx + 3, by - 22, bronze);
      rect(g, bx - 4, by - 40, 9, 19, bronze);
      disc(g, bx, by - 46, 5, bronze);
      line(g, bx + 4, by - 38, bx + 12, by - 50, bronze);
      line(g, bx + 5, by - 37, bx + 13, by - 49, bronze);
      rect(g, bx + 11, by - 55, 5, 6, bronze);
      line(g, bx - 4, by - 38, bx - 10, by - 26, bronze);
      line(g, bx - 5, by - 37, bx - 11, by - 25, bronze);
      // 망토
      for (let i = 0; i < 16; i++) rect(g, bx - 6 - Math.floor(i / 3), by - 38 + i, 3, 1, C.iron);
      break;
    }
    case 'barricade': {
      // 검문소 바리케이드: 모래주머니와 철조망, 나무 받침대
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 5 - row; i++) {
          const bx = x + 2 + i * 13 + row * 6;
          const by = ground - 8 - row * 8;
          rect(g, bx, by, 13, 8, C.sandbag);
          rect(g, bx, by + 7, 13, 1, C.awning);
          rect(g, bx, by, 1, 8, C.awning);
        }
      }
      rect(g, x + 8, ground - 46, 50, 3, C.awningStripe);
      line(g, x + 8, ground - 43, x + 2, ground - 26, C.awning);
      line(g, x + 57, ground - 43, x + 63, ground - 26, C.awning);
      for (let i = 0; i < 8; i++) {
        const cx = x + 6 + i * 8;
        const cy = ground - 52;
        line(g, cx - 4, cy, cx, cy - 4, C.wire);
        line(g, cx, cy - 4, cx + 4, cy, C.wire);
        line(g, cx - 4, cy, cx + 4, cy + 3, C.wire);
      }
      break;
    }
  }
}

void CORNICE;
