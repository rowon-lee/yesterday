import { DOWNTOWN as D } from '../../data/stages/downtown';
import {
  CORNICE, DOOR_W, doorOf, FLOOR_H, frontBuildings, GROUND, MAP_H, MAP_W, SHOP_H, type FrontBuildingPlace,
} from '../../stage/downtown';
import { drawText, textWidth } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, dither, ditherRect, hash, line, rect } from './dither';

/**
 * 무대의 겹(레이어)을 미리 그린다. 겹마다 카메라 대비 움직이는 비율(speed)이 있고,
 * 그 비율만큼 가로·세로로 작은 그림이 된다: 폭 = 화면 + (맵 - 화면) × speed.
 * 겹 안의 바닥은 겹 아래 끝에서 groundFromBottom 위.
 */
export interface Layer {
  canvas: HTMLCanvasElement;
  speed: number;
}

export const layerW = (speed: number): number => Math.ceil(SCREEN_W + (MAP_W - SCREEN_W) * speed);
export const layerH = (speed: number): number => Math.ceil(SCREEN_H + (MAP_H - SCREEN_H) * speed);
export const layerGround = (speed: number): number => layerH(speed) - D.groundFromBottom;

// ---------------------------------------------------------------- 하늘
export function buildSky(): Layer {
  const s = D.sky.speed;
  const w = layerW(s);
  const h = layerH(s);
  const [c, g] = canvas(w, h);
  // 위는 어둡고 지평선으로 갈수록 매연이 뿌옇게: 띠 사이를 디더링으로 잇는다
  const bands = [C.smog0, C.smog0, C.smog1, C.smog2, C.smog3, C.smogHaze];
  const bottom = layerGround(s) - 30;
  for (let y = 0; y < h; y++) {
    const f = Math.max(0, Math.min(bands.length - 1.001, (y / bottom) * (bands.length - 1)));
    const i = Math.floor(f);
    const level = Math.round((f - i) * 16);
    for (let x = 0; x < w; x++) {
      g.fillStyle = dither(x, y, level) ? bands[i + 1] : bands[i];
      g.fillRect(x, y, 1, 1);
    }
  }
  // 매연에 가린 흐린 해
  const sun = D.sky.sun;
  disc(g, sun.x, sun.fromTop, sun.r + 4, C.sunDim, 4);
  disc(g, sun.x, sun.fromTop, sun.r, C.sunDim, 10);
  disc(g, sun.x, sun.fromTop, sun.r - 6, C.sunDim, 16);
  // 해를 가로지르는 매연 띠
  for (const [y, hh, lv] of [[48, 4, 6], [62, 3, 9], [74, 2, 11], [84, 5, 7], [120, 4, 5], [150, 3, 6]] as const) {
    ditherRect(g, 0, y, w, hh, C.smog2, lv);
  }
  return { canvas: c, speed: s };
}

// ---------------------------------------------------------------- 먼 공장 지대
/** 굴뚝 위치 (공장 겹 좌표). 매연을 매 틱 그릴 때도 쓴다 */
export function factoryChimneys(): Array<{ x: number; w: number; top: number }> {
  const F = D.factories;
  const w = layerW(F.speed);
  const gl = layerGround(F.speed);
  const out: Array<{ x: number; w: number; top: number }> = [];
  let k = F.seed * 13;
  for (let x = 20; x < w; x += F.chimneyEvery * (0.6 + hash(k++) * 0.8)) {
    const cw = 6 + Math.floor(hash(k++) * 5);
    const ch = F.chimneyMin + Math.floor(hash(k++) * (F.chimneyMax - F.chimneyMin));
    out.push({ x: Math.round(x), w: cw, top: gl - ch });
  }
  return out;
}

export function buildFactories(): Layer {
  const F = D.factories;
  const w = layerW(F.speed);
  const h = layerH(F.speed);
  const gl = layerGround(F.speed) - 40;
  const [c, g] = canvas(w, h);
  let x = -6;
  let k = F.seed;
  while (x < w) {
    const bw = 50 + Math.floor(hash(k++) * 70);
    const bh = F.blockMin + Math.floor(hash(k++) * (F.blockMax - F.blockMin));
    const top = gl - bh;
    rect(g, x, top, bw, h - top, C.factory);
    // 톱니 지붕
    if (hash(k++) < 0.6) {
      for (let t = 0; t < bw - 8; t += 11) {
        for (let s = 0; s < 8; s++) rect(g, x + t + s, top - 8 + s, 1, 8 - s, C.factory);
      }
    }
    // 드문드문 켜진 공장 창
    for (let wy = top + 8; wy < gl - 6; wy += 9) {
      for (let wx = x + 4; wx < x + bw - 4; wx += 6) if (hash(k++) < 0.05) rect(g, wx, wy, 3, 2, C.skylineLit);
    }
    x += bw + Math.floor(hash(k++) * 10);
  }
  for (const ch of factoryChimneys()) {
    rect(g, ch.x, ch.top, ch.w, h - ch.top, C.factory);
    rect(g, ch.x - 1, ch.top, ch.w + 2, 3, C.factory);
    rect(g, ch.x, ch.top + 10, ch.w, 1, C.smog1);
    rect(g, ch.x, ch.top + 22, ch.w, 1, C.smog1);
  }
  return { canvas: c, speed: F.speed };
}

// ---------------------------------------------------------------- 먼 시가지
export function buildSkyline(): Layer {
  const S = D.skyline;
  const w = layerW(S.speed);
  const h = layerH(S.speed);
  const gl = layerGround(S.speed) - 20;
  const [c, g] = canvas(w, h);
  let x = -4;
  let k = S.seed;
  while (x < w) {
    const bw = 24 + Math.floor(hash(k++) * 40);
    const bh = S.min + Math.floor(hash(k++) * (S.max - S.min));
    const top = gl - bh;
    rect(g, x, top, bw, h - top, C.skylineFar);
    // 지붕: 급수탑, 계단식 지붕, 첨탑
    const r = hash(k++);
    if (r < 0.3) waterTower(g, x + 4 + Math.floor(hash(k++) * (bw - 16)), top, C.skylineFar, 1);
    else if (r < 0.55) rect(g, x + 4, top - 10, bw - 8, 10, C.skylineFar);
    else if (r < 0.65) {
      rect(g, x + Math.floor(bw / 2) - 3, top - 18, 6, 18, C.skylineFar);
      rect(g, x + Math.floor(bw / 2) - 1, top - 34, 2, 16, C.skylineFar);
    }
    for (let wy = top + 6; wy < gl - 4; wy += 7) {
      for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (hash(k++) < 0.06) rect(g, wx, wy, 2, 3, C.skylineLit);
    }
    x += bw + Math.floor(hash(k++) * 5);
  }
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

// ---------------------------------------------------------------- 가운데: 고층 벽돌 건물, 칠한 벽 간판, 감시탑
export function buildMid(): Layer {
  const M = D.mid;
  const w = layerW(M.speed);
  const h = layerH(M.speed);
  const gl = layerGround(M.speed) - 6;
  const [c, g] = canvas(w, h);
  let x = -6;
  let k = M.seed;
  let index = 0;
  while (x < w) {
    const bw = 56 + Math.floor(hash(k++) * 60);
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
      sy -= 22;
      rect(g, sx, sy, sw, 22, base);
      rect(g, sx - 1, sy, sw + 2, 2, C.stoneDark);
    }
    if (steps) rect(g, sx + Math.floor(sw / 2) - 1, sy - 26, 2, 26, C.iron); // 첨탑
    rect(g, x - 1, top, bw + 2, 3, C.stoneDark);
    // 창: 층마다 한 줄
    for (let wy = top + 8; wy < gl - 10; wy += 13) {
      for (let wx = x + 4; wx < x + bw - 6; wx += 8) {
        const r = hash(k++);
        rect(g, wx, wy, 4, 7, r < 0.1 ? C.windowLit : C.windowDark);
      }
    }
    // 옥상 급수탑
    if (!steps && hash(k++) < 0.6) waterTower(g, x + 6 + Math.floor(hash(k++) * (bw - 22)), top, C.iron, 1.2);
    // 칠한 벽 간판 (색이 바래 벽돌과 섞인다), 세로로 붙은 간판
    if (index % 3 === 1) {
      const text = M.wallSigns[Math.floor(index / 3) % M.wallSigns.length];
      const tw = textWidth(text, 2);
      const px = x + Math.floor((bw - tw - 8) / 2);
      const py = top + 24;
      ditherRect(g, px, py, tw + 8, 18, index % 2 ? C.paintTeal : C.paintOchre, 12);
      drawText(g, text, px + 4, py + 4, C.paintCream, 2);
    }
    x += bw + 3 + Math.floor(hash(k++) * 6);
    index++;
  }
  for (const t of M.towers) watchtower(g, t.x, gl - t.h, gl);
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
  const gl = layerGround(D.mid.speed) - 6;
  return D.mid.towers.map((t) => ({ x: t.x + 22 + 6, y: gl - t.h - 3 }));
}

// ---------------------------------------------------------------- 앞: 길가 건물 (캐릭터와 같은 속도, 월드 좌표)
export function buildFront(): Layer {
  const [c, g] = canvas(MAP_W, MAP_H);
  for (const b of frontBuildings()) building(g, b);
  return { canvas: c, speed: 1 };
}

function building(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const ground = GROUND;
  const x = b.x;
  const top = ground - b.h;
  const red = hash(b.seed) < 0.5;
  const base = red ? C.brickRed : C.brick;
  const mortar = red ? C.brickRedDark : C.brickDark;
  rect(g, x, top, b.w, b.h, base);
  // 벽돌 줄눈: 4줄마다 가로, 엇갈린 세로
  for (let y = top + 3; y < ground; y += 4) {
    rect(g, x, y, b.w, 1, mortar);
    const off = ((y - top) >> 2) % 2 ? 4 : 0;
    for (let jx = x + off; jx < x + b.w; jx += 8) if (hash(b.seed + jx * 7 + y) < 0.55) rect(g, jx, y - 3, 1, 3, mortar);
  }
  // 그늘: 왼쪽 가장자리 어둡게, 오른쪽 밝게
  rect(g, x, top, 2, b.h, mortar);
  rect(g, x + b.w - 1, top, 1, b.h, C.brickLight);
  // 처마: 돌 띠와 받침
  rect(g, x - 2, top, b.w + 4, 5, C.stone);
  rect(g, x - 2, top + 5, b.w + 4, 2, C.stoneDark);
  for (let dx = x + 2; dx < x + b.w - 2; dx += 6) rect(g, dx, top + 7, 3, 2, C.stoneDark);
  // 층 사이 돌 띠
  const shopTop = ground - SHOP_H;
  for (let f = 1; f <= b.floors; f++) rect(g, x, shopTop - f * FLOOR_H + FLOOR_H - 1, b.w, 1, C.stoneDark);

  // 위층 창
  const floorTops: number[] = [];
  for (let f = 0; f < b.floors; f++) floorTops.push(shopTop - (f + 1) * FLOOR_H + 8);
  let k = b.seed;
  for (const wy of floorTops) {
    for (let wx = x + 9; wx + 12 < x + b.w - 6; wx += 20) {
      const r = hash(k++);
      rect(g, wx - 2, wy - 2, 14, 2, C.stone); // 상인방
      rect(g, wx, wy, 10, 20, C.windowDark);
      if (r < 0.16) {
        // 불 켜진 창: 커튼 아래로 불빛
        rect(g, wx, wy + 6, 10, 14, C.windowLit);
        ditherRect(g, wx, wy + 6, 10, 4, C.windowLight, 4);
        rect(g, wx, wy, 10, 6, C.awning);
      } else if (r < 0.26) {
        line(g, wx, wy, wx + 9, wy + 19, C.awning);
        line(g, wx + 9, wy, wx, wy + 19, C.awning);
      }
      rect(g, wx + 4, wy, 2, 20, C.iron); // 창살
      rect(g, wx, wy + 9, 10, 1, C.iron);
      rect(g, wx - 2, wy + 20, 14, 2, C.stoneDark); // 창턱
    }
  }

  // 철제 비상계단
  if (b.escape && floorTops.length > 1) {
    const ew = Math.min(40, b.w - 20);
    const ex = x + b.w - ew - 6;
    floorTops.forEach((wy, n) => {
      const py = wy + 22;
      rect(g, ex, py, ew, 2, C.iron);
      rect(g, ex, py - 8, ew, 1, C.ironLight);
      for (let rx = ex; rx < ex + ew; rx += 4) rect(g, rx, py - 8, 1, 8, C.iron);
      const next = floorTops[n - 1];
      if (next !== undefined) {
        const ny = next + 22;
        if (n % 2) line(g, ex + 3, py, ex + ew - 6, ny, C.iron);
        else line(g, ex + ew - 4, py, ex + 4, ny, C.iron);
      }
    });
    const last = floorTops[0] + 22;
    for (const lx of [ex + 3, ex + 9]) rect(g, lx, last, 1, 16, C.iron);
    for (let ly = last + 3; ly < last + 16; ly += 3) rect(g, ex + 3, ly, 7, 1, C.iron);
  }

  // 1층 가게: 쇼윈도 틀(유리는 부서지는 물건이라 props.ts가 그린다), 문, 차양, 칠한 간판
  rect(g, x + 2, shopTop, b.w - 4, SHOP_H, C.brickDark);
  const doorX = doorOf(b);
  rect(g, x + 6, ground - 50, doorX - x - 10, 50, C.stoneDark);
  rect(g, x + 6, ground - 3, doorX - x - 10, 3, C.stone);
  rect(g, doorX - 1, ground - 46, DOOR_W + 2, 46, C.iron);
  rect(g, doorX + 2, ground - 42, DOOR_W - 4, 16, C.windowDark);
  rect(g, doorX + DOOR_W - 5, ground - 22, 2, 2, C.stone);
  // 차양: 줄무늬, 앞으로 기울어짐
  for (let ax = x + 3; ax < x + b.w - 3; ax++) {
    const stripe = Math.floor((ax - x) / 6) % 2 ? C.awningStripe : C.awning;
    rect(g, ax, shopTop + 4, 1, 9, stripe);
  }
  for (let ax = x + 3; ax < x + b.w - 3; ax += 6) rect(g, ax, shopTop + 13, 3, 2, C.awning);
  rect(g, x + 3, shopTop + 4, b.w - 6, 1, C.iron);
  // 간판 판
  if (b.shop) {
    const tw = textWidth(b.shop, 2);
    const sx = x + Math.floor((b.w - tw - 10) / 2);
    rect(g, sx, shopTop - 12, tw + 10, 16, C.iron);
    rect(g, sx + 1, shopTop - 11, tw + 8, 14, b.seed % 3 ? C.paintTeal : C.paintOchre);
    drawText(g, b.shop, sx + 5, shopTop - 8, C.paintCream, 2);
  }

  // 선전 포스터: 위층 벽에 붙은 붉은 종이, 별 문장과 구호
  if (b.poster && b.floors >= 3) {
    const pw = Math.max(30, textWidth(b.poster, 2) + 10);
    const ph = 44;
    const px = x + 6;
    const py = shopTop - FLOOR_H * 2 + 6;
    rect(g, px, py, pw, ph, C.posterRed);
    rect(g, px, py, pw, 1, C.paintCream);
    rect(g, px, py + ph - 1, pw, 1, C.posterRedDark);
    star(g, px + Math.floor(pw / 2), py + 14, 2);
    drawText(g, b.poster, px + Math.floor((pw - textWidth(b.poster, 2)) / 2), py + ph - 14, C.paintCream, 2);
    rect(g, px + pw - 5, py + ph - 5, 5, 5, base);
    rect(g, px + pw - 3, py + ph - 7, 3, 2, base);
  }
  void CORNICE;
}

/** 포스터의 별 문장 (가운데 cx, cy), 크기 배수 */
function star(g: CanvasRenderingContext2D, cx: number, cy: number, s = 1): void {
  const rows = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rect(g, cx + (x - 3) * s, cy + (y - 3) * s, s, s, C.posterRedDark);
  });
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
  // 노면전차 선로 두 줄
  for (const ry of [y0 + sw + 7, y0 + sw + 14]) {
    rect(g, 0, ry, MAP_W, 1, C.rail);
    rect(g, 0, ry + 1, MAP_W, 1, C.railDark);
  }
  for (const p of D.street.props) prop(g, p.kind, p.x, y0, 'text' in p ? p.text : '');
  return { canvas: c, speed: 1 };
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
