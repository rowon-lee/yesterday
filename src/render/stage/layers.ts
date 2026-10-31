import { CITADEL as D } from '../../data/stages/citadel';
import {
  awningOf, DOOR_W, doorOf, escapeOf, FLOOR_H, FRONT_GAPS, frontBuildings, GROUND, hasShopWindow, MAP_H, MAP_W, marqueeOf, SHOP_H,
  type FrontBuildingPlace, type FrontGap,
} from '../../stage/citadel';
import { drawText, textWidth } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, dither, ditherRect, hash, haze, line, paint, rect } from './dither';

/**
 * 시타델 1구역의 겹(레이어)을 미리 그린다. 겹마다 카메라 대비 움직이는 비율(speed)이 있고,
 * 그 비율만큼 가로·세로로 작은 그림이 된다: 폭 = 화면 + (맵 - 화면) × speed.
 * 겹 안의 바닥은 겹 아래 끝에서 groundFromBottom 위. 먼 겹은 매연 색 디더링(haze)으로 덮는다.
 * 색과 조명은 다음 단계(7-E)에서 바꾸므로 지금 팔레트를 그대로 쓴다.
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

// ---------------------------------------------------------------- 1. 하늘과 바다
/** 수평선 (하늘 겹 좌표 y) */
export const horizonY = (): number => layerGround(D.sky.speed) - D.sky.seaTop;

export function buildSky(): Layer {
  const s = D.sky.speed;
  const w = layerW(s);
  const h = layerH(s);
  const [c, g] = canvas(w, h);
  const hy = horizonY();
  // 하늘: 위는 어둡고 수평선으로 갈수록 매연이 뿌옇게. 바다: 수평선 아래 어두운 물, 물결 줄
  const bands = [C.smog0, C.smog0, C.smog1, C.smog2, C.smog3, C.smogHaze];
  paint(g, 0, 0, w, h, (x, y) => {
    if (y >= hy) {
      // 바다: 수평선 가까이는 매연 색, 앞으로 올수록 짙은 청록, 물결 줄
      const d = y - hy;
      const wave = (y + Math.floor(Math.sin(x * 0.07 + y * 0.9) * 2)) % (4 + Math.floor(d / 12)) === 0;
      if (wave && dither(x, y, Math.max(4, 10 - Math.floor(d / 10)))) return C.paintTeal;
      return dither(x, y, Math.max(2, 9 - Math.floor(d / 8))) ? C.smog3 : C.smog1;
    }
    const f = Math.max(0, Math.min(bands.length - 1.001, (y / hy) * (bands.length - 1)));
    const i = Math.floor(f);
    return dither(x, y, Math.round((f - i) * 16)) ? bands[i + 1] : bands[i];
  });
  rect(g, 0, hy, w, 1, C.smogHaze);
  // 매연에 가린 흐린 달과 바다에 비친 달빛 줄
  const m = D.sky.moon;
  disc(g, m.x, m.fromTop, m.r + 4, C.sunDim, 4);
  disc(g, m.x, m.fromTop, m.r, C.sunDim, 10);
  disc(g, m.x, m.fromTop, m.r - 6, C.sunDim, 16);
  // 달빛 줄: 달 아래 수면에 끊긴 가로 물결 조각이 세로로 늘어선다
  for (let y = hy + 2; y < h; y += 3) {
    const half = 3 + Math.floor((y - hy) / 16);
    const x0 = m.x - half + Math.round((hash(y * 13) - 0.5) * 4);
    const len = 2 + Math.floor(hash(y * 7) * half);
    if (hash(y * 31) < 0.75) rect(g, x0 + Math.floor(hash(y * 3) * half), y, len, 1, C.sunDim);
  }
  for (const [y, hh, lv] of [[40, 4, 6], [54, 3, 9], [66, 2, 11], [76, 5, 7], [110, 4, 5], [138, 3, 6]] as const) ditherRect(g, 0, y, w, hh, C.smog2, lv);
  return { canvas: c, speed: s };
}

/** 멀리 바다 위 등대 불빛 자리 (하늘 겹 좌표) */
export function farLight(): { x: number; y: number } {
  return { x: D.sky.farLight.x, y: horizonY() - 3 };
}

// ---------------------------------------------------------------- 2. 1구역 마천루 실루엣
export function buildFar(): Layer {
  const F = D.far;
  const w = layerW(F.speed);
  const h = layerH(F.speed);
  const gl = layerGround(F.speed) - 30;
  const [c, g] = canvas(w, h);
  let x = F.from;
  let k = F.seed;
  while (x < w) {
    const bw = 22 + Math.floor(hash(k++) * 34);
    const bh = F.min + Math.floor(hash(k++) * (F.max - F.min));
    const top = gl - bh;
    rect(g, x, top, bw, h - top, C.factory);
    // 아르데코 마천루: 위로 갈수록 두세 번 들어가는 지붕, 꼭대기 첨탑
    let sx = x;
    let sw = bw;
    let sy = top;
    const steps = 1 + Math.floor(hash(k++) * 3);
    for (let i = 0; i < steps && sw > 10; i++) {
      sx += 3 + Math.floor(sw * 0.12);
      sw -= 6 + Math.floor(sw * 0.24);
      sy -= 10 + Math.floor(hash(k++) * 14);
      rect(g, sx, sy, sw, top - sy + 2, C.factory);
    }
    const mid = sx + Math.floor(sw / 2);
    if (hash(k++) < 0.6) {
      rect(g, mid - 1, sy - 30, 2, 30, C.factory);
      rect(g, mid - 2, sy - 12, 4, 2, C.factory);
    }
    for (let wy = top + 4; wy < gl - 4; wy += 6) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (hash(k++) < 0.05) rect(g, wx, wy, 1, 3, C.skylineLit);
    x += bw + 2 + Math.floor(hash(k++) * 8);
  }
  // 공장 지대: 톱니 지붕 공장과 굴뚝 (매연은 매 틱 따로 그린다)
  const fx0 = F.chimneys[0].x - 30;
  const fx1 = F.chimneys[F.chimneys.length - 1].x + 40;
  for (let x2 = fx0; x2 < fx1; x2 += 26) {
    const bh = 50 + Math.floor(hash(x2) * 30);
    rect(g, x2, gl - bh, 24, h - gl + bh, C.factory);
    for (let t = 0; t < 20; t += 8) for (let k = 0; k < 6; k++) rect(g, x2 + t + k, gl - bh - 6 + k, 1, 6 - k, C.factory);
  }
  for (const ch of farChimneys()) {
    rect(g, ch.x, ch.top, ch.w, gl - ch.top, C.factory);
    rect(g, ch.x - 1, ch.top, ch.w + 2, 3, C.factory);
    rect(g, ch.x + 1, ch.top + 12, ch.w - 2, 1, C.smog2);
    rect(g, ch.x + Math.floor(ch.w / 2), ch.top - 2, 1, 2, C.posterRed);
  }
  haze(c, C.smog3, F.haze);
  return { canvas: c, speed: F.speed };
}

/** 먼 겹 공장 굴뚝 (먼 겹 좌표). 매연을 매 틱 그린다 */
export function farChimneys(): Array<{ x: number; w: number; top: number }> {
  const gl = layerGround(D.far.speed) - 30;
  return D.far.chimneys.map((ch) => ({ x: ch.x, w: ch.w, top: gl - ch.h }));
}

// ---------------------------------------------------------------- 3. 시타델 탑 윗부분 (광장 뒤로 솟은 마천루)
const keepCenter = (): number => Math.round(toLayerX(D.keep.speed, D.keep.worldX));
const keepGround = (): number => layerGround(D.keep.speed) - 24;

/** 탑 몸통 단: [폭, 위 끝(꼭대기에서 아래로)] 아래에서 위로. 층층이 들어간다 */
function keepTiers(): Array<{ w: number; from: number; to: number }> {
  const K = D.keep;
  const gl = keepGround();
  const top = gl - K.h;
  return [
    { w: K.w + 44, from: gl + 40, to: top + 150 },
    { w: K.w, from: top + 150, to: top + 54 },
    { w: K.w - 52, from: top + 54, to: top + 20 },
  ];
}

export function buildKeep(): Layer {
  const K = D.keep;
  const w = layerW(K.speed);
  const h = layerH(K.speed);
  const [c, g] = canvas(w, h);
  const cx = keepCenter();
  const gl = keepGround();
  const dark = C.factory;
  const rib = C.smog2;
  const lit = C.skylineLit;
  // 둘레의 낮은 사무동: 평평한 지붕, 촘촘한 세로 기둥, 드문드문 켜진 창, 지붕 위 물탱크·안테나
  K.slabs.forEach((sl, i) => {
    const x0 = cx + sl.dx;
    const top = gl - sl.h;
    rect(g, x0, top, sl.w, h - top, i % 2 ? C.smog1 : dark);
    for (let x = x0 + 3; x < x0 + sl.w - 2; x += 6) rect(g, x, top + 4, 1, h - top - 4, rib);
    for (let y = top + 6; y < gl - 4; y += 6) {
      rect(g, x0, y, sl.w, 1, i % 2 ? dark : C.smog1);
      for (let x = x0 + 4; x < x0 + sl.w - 4; x += 6) if (hash(x * 7 + y * 13 + i) < 0.14) rect(g, x, y + 2, 2, 2, hash(x + y) < 0.3 ? C.windowLight : lit);
    }
    rect(g, x0 - 2, top - 3, sl.w + 4, 3, rib);
    if (i % 2) {
      rect(g, x0 + 12, top - 16, 14, 13, dark);
      rect(g, x0 + 10, top - 18, 18, 2, rib);
    } else rect(g, x0 + sl.w - 14, top - 26, 1, 23, rib);
  });
  // 탑 몸통: 단마다 세로 기둥과 창 줄, 켜진 사무실 (아래 단일수록 넓다). 멀어도 보이게 켜진 창은 밝게, 모서리에 빛줄
  KEEP_GLOWS.length = 0;
  for (const [ti, t] of keepTiers().entries()) {
    const x0 = cx - t.w / 2;
    rect(g, x0, t.to, t.w, t.from - t.to, dark);
    for (let x = x0 + 4; x < x0 + t.w - 2; x += 8) rect(g, x, t.to + 2, 2, t.from - t.to - 2, rib);
    for (let y = t.to + 6, f = 0; y < t.from - 4; y += 7, f++) {
      const allLit = hash(f * 59 + t.w) < 0.1;
      // 빛은 위 단만 (아래 단은 대개 가운데 겹 건물에 가려진다)
      if (allLit && ti > 0) for (let k = 0; k < 3; k++) KEEP_GLOWS.push({ x: x0 + (t.w * (k + 0.5)) / 3, y: y + 1, r: 26, a: 0.3, color: C.officeLit });
      for (let x = x0 + 6; x < x0 + t.w - 6; x += 8) {
        const r = hash(x * 13 + y * 7);
        if (allLit || r < 0.16) rect(g, x, y, 3, 3, allLit || r < 0.06 ? C.officeLit : C.windowLight);
      }
    }
    // 단 꼭대기 처마와 빛 받는 모서리
    rect(g, x0 - 2, t.to, t.w + 4, 3, rib);
    rect(g, x0, t.to + 3, 2, t.from - t.to - 3, C.smog3);
    ditherRect(g, x0, t.to + 3, 1, t.from - t.to - 3, C.beam, 6);
  }
  // 빛나는 유리 왕관: 가로 빛띠 세 줄, 가운데 별 휘장
  const top = gl - K.h;
  const cw = K.w - 92;
  rect(g, cx - cw / 2, top, cw, 22, dark);
  for (const y of [top + 4, top + 10, top + 16]) ditherRect(g, cx - cw / 2 + 2, y, cw - 4, 2, C.lampGlow, 12);
  KEEP_GLOWS.push({ x: cx, y: top + 10, r: 46, a: 0.55, color: C.lampGlow });
  rect(g, cx - cw / 2 - 2, top - 2, cw + 4, 2, rib);
  disc(g, cx, top + 38, 9, C.smog3);
  disc(g, cx, top + 38, 7, dark);
  star(g, cx, top + 38, 2, C.posterRed);
  // 안테나: 가는 철탑, 가로대, 경고등 자리
  rect(g, cx - 1, top - K.mast, 2, K.mast, dark);
  for (let y = top - K.mast + 8; y < top; y += 9) rect(g, cx - 3, y, 6, 1, dark);
  for (const b of keepBeacons()) rect(g, b.x - 1, b.y - 1, 3, 2, C.neonRedDark);
  for (const lx of keepLights()) rect(g, lx.x - 5, lx.y, 10, 5, C.ironLight);
  haze(c, C.smog3, K.haze);
  return { canvas: c, speed: K.speed };
}

/** 탑의 켜진 층과 왕관이 내는 빛 (겹 좌표). buildKeep이 채운다 */
export const KEEP_GLOWS: Array<{ x: number; y: number; r: number; a: number; color: string }> = [];

/** 탑 왕관 모서리 서치라이트 (겹 좌표) */
export function keepLights(): Array<{ x: number; y: number }> {
  const cx = keepCenter();
  const t = keepTiers()[2];
  return [{ x: cx - t.w / 2 + 6, y: t.to - 5 }, { x: cx + t.w / 2 - 6, y: t.to - 5 }];
}

/** 탑 안테나와 단 모서리의 항공 경고등 (겹 좌표). 빛은 매 틱 깜빡인다 */
export function keepBeacons(): Array<{ x: number; y: number }> {
  const cx = keepCenter();
  const top = keepGround() - D.keep.h;
  const t = keepTiers()[1];
  return [
    { x: cx, y: top - D.keep.mast },
    { x: cx, y: top - Math.round(D.keep.mast / 2) },
    { x: cx - t.w / 2, y: t.to - 2 },
    { x: cx + t.w / 2, y: t.to - 2 },
  ];
}

// ---------------------------------------------------------------- 4. 가운데 겹: 중간 건물, 공원 뒤 나무
/**
 * 가운데 겹의 바닥 (겹 좌표). 거리 바닥보다 조금 위에 보이게 해서(멀리 있는 땅은 위로 보인다),
 * 광장 난간 너머로 먼 길과 행인이 보이게 한다.
 */
export const midGround = (): number => layerGround(D.mid.speed) - 30;
/** 바다가 보이는 부두 뒤는 이 x(겹 좌표)까지 비운다 */
export const midSeaX = (): number => Math.round(toLayerX(D.mid.speed, D.mid.seaUntil));

export function buildMid(): Layer {
  const M = D.mid;
  const w = layerW(M.speed);
  const h = layerH(M.speed);
  const gl = midGround();
  const [c, g] = canvas(w, h);
  const parkFrom = toLayerX(M.speed, M.parkFrom);
  let x = midSeaX();
  let k = M.seed;
  let index = 0;
  while (x < w) {
    if (x > parkFrom) {
      // 공원 뒤: 키 큰 나무 무리
      const r = 14 + Math.floor(hash(k++) * 14);
      rect(g, x + r - 2, gl - 30, 4, 30, C.iron);
      disc(g, x + r, gl - 30 - r, r, C.factory);
      disc(g, x + r - 6, gl - 26 - r, r - 4, C.iron, 8);
      x += r + 6 + Math.floor(hash(k++) * 10);
      continue;
    }
    const bw = 56 + Math.floor(hash(k++) * 64);
    const bh = M.min + Math.floor(hash(k++) * (M.max - M.min));
    const top = gl - bh;
    const red = hash(k++) < 0.4;
    const base = red ? C.brickRedDark : C.brickDark;
    rect(g, x, top, bw, h - top, base);
    const steps = hash(k++) < 0.5 ? 2 : 0;
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
    rect(g, x - 1, top, bw + 2, 3, C.stoneDark);
    for (let wy = top + 8; wy < gl - 12; wy += 15) {
      for (let wx = x + 4; wx < x + bw - 6; wx += 9) rect(g, wx, wy, 5, 8, hash(k++) < 0.1 ? C.windowLit : C.windowDark);
    }
    if (!steps && hash(k++) < 0.6) waterTower(g, x + 6 + Math.floor(hash(k++) * (bw - 24)), top, C.iron, 1.3);
    if (index % 3 === 1) {
      const text = ['HOTEL', 'TONIC', 'RADIO', 'CIGARS', 'COAL'][Math.floor(index / 3) % 5];
      const tw = textWidth(text, 2);
      const px = x + Math.floor((bw - tw - 8) / 2);
      ditherRect(g, px, top + 24, tw + 8, 18, index % 2 ? C.paintTeal : C.paintOchre, 12);
      drawText(g, text, px + 4, top + 28, C.paintCream, 2);
    }
    x += bw + 3 + Math.floor(hash(k++) * 6);
    index++;
  }
  // 먼 길: 보도와 차도 (행인이 이 위를 걷는다)
  const sea = midSeaX();
  rect(g, sea, gl, w - sea, h - gl, C.street);
  rect(g, sea, gl, w - sea, 3, C.sidewalk);
  rect(g, sea, gl + 3, w - sea, 1, C.curb);
  ditherRect(g, sea, gl + 4, w - sea, h - gl - 4, C.streetLine, 3);
  haze(c, C.smog3, M.haze);
  return { canvas: c, speed: M.speed };
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

// ---------------------------------------------------------------- 5. 싸우는 거리: 부서지는 건물 (월드 좌표)
/** 불 켜진 창 (월드 좌표, 붙은 건물 번호). 빛 레이어가 창마다 은은한 빛을 더한다 */
export const LIT_WINDOWS: Array<{ x: number; y: number; bi: number }> = [];
let drawingBuilding = -1;

export function buildFront(): Layer {
  const [c, g] = canvas(MAP_W, MAP_H);
  LIT_WINDOWS.length = 0;
  for (const [bi, b] of frontBuildings().entries()) {
    drawingBuilding = bi;
    g.save();
    g.beginPath();
    g.rect(b.x, GROUND - b.h, b.w, b.h);
    g.clip();
    switch (b.kind) {
      case 'shop':
      case 'apartment':
        tenement(g, b);
        break;
      case 'theater':
        theater(g, b);
        break;
      case 'diner':
        diner(g, b);
        break;
    }
    g.restore();
  }
  drawingBuilding = -1;
  for (const gap of FRONT_GAPS) drawGap(g, gap);
  return { canvas: c, speed: 1 };
}

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

function stoneWall(g: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, seed: number, block = 20): void {
  rect(g, x, top, w, h, C.stone);
  for (let y = top + 7; y < top + h; y += 8) {
    rect(g, x, y, w, 1, C.stoneDark);
    const off = ((y - top) >> 3) % 2 ? block / 2 : 0;
    for (let jx = x + off; jx < x + w; jx += block) rect(g, jx, y - 7, 1, 7, C.stoneDark);
  }
  ditherRect(g, x, top, w, h, C.stoneDark, 2, seed & 3);
}

/** 위층 창 하나: 상인방, 유리, 창살, 창턱. 가끔 불이 켜지거나 판자로 막혀 있다 */
function window1(g: CanvasRenderingContext2D, wx: number, wy: number, ww: number, wh: number, r: number, frame: string = C.stone): void {
  rect(g, wx - 2, wy - 3, ww + 4, 3, frame);
  rect(g, wx, wy, ww, wh, C.windowDark);
  if (r < 0.16) {
    if (drawingBuilding >= 0) LIT_WINDOWS.push({ x: wx + ww / 2, y: wy + wh / 2 + 4, bi: drawingBuilding });
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

/** 가게 차양: 윗면(발판 높이 h)에서 아래로 12px, 줄무늬와 물결 끝. 가게 이름은 네온 간판(부서지는 물건)이 그 위에 단다 */
function awning(g: CanvasRenderingContext2D, x0: number, x1: number, h: number): void {
  const top = GROUND - h;
  for (let ax = x0; ax < x1; ax++) rect(g, ax, top + 1, 1, 9, Math.floor((ax - x0) / 6) % 2 ? C.awningStripe : C.awning);
  for (let ax = x0; ax < x1; ax += 6) rect(g, ax, top + 10, 3, 2, C.awning);
  rect(g, x0, top, x1 - x0, 1, C.iron);
}

/** 1층 가게 앞면: 쇼윈도 틀(유리는 부서지는 물건이라 props.ts가 그린다)과 문 */
function shopfront(g: CanvasRenderingContext2D, b: FrontBuildingPlace, x1: number): void {
  rect(g, b.x + 2, GROUND - SHOP_H + 6, x1 - b.x - 4, SHOP_H - 6, C.brickDark);
  const doorX = doorOf(b);
  rect(g, b.x + 8, GROUND - 62, doorX - b.x - 12, 62, C.stoneDark);
  rect(g, b.x + 8, GROUND - 4, doorX - b.x - 12, 4, C.stone);
  rect(g, doorX - 1, GROUND - 60, DOOR_W + 2, 60, C.iron);
  rect(g, doorX + 2, GROUND - 56, DOOR_W - 4, 22, C.windowDark);
  rect(g, doorX + DOOR_W - 5, GROUND - 30, 2, 2, C.stone);
}

/** 상가와 아파트: 벽돌, 층마다 창, 선전 포스터, 1층 가게(차양·쇼윈도) 또는 현관, 아파트는 층마다 비상계단 */
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
  for (let f = 1; f < floors.length; f++) rect(g, x, floors[f][1] - 2, b.w, 2, C.stoneDark);
  cornice(g, x, top, b.w);
  let k = b.seed;
  for (let f = 1; f < floors.length; f++) {
    const wy = floors[f][0] + 14;
    for (let wx = x + 10; wx + 14 <= x + b.w - 10; wx += 24) window1(g, wx, wy, 14, 30, hash(k++));
  }
  if (b.poster && floors.length >= 4) poster(g, x + 6, floors[2][0] + 4, Math.max(34, textWidth(b.poster, 2) + 10), 48, b.poster, base);
  const esc = escapeOf(b);
  const shopEnd = esc ? esc.x0 - 8 : x + b.w;
  if (hasShopWindow(b)) {
    shopfront(g, b, shopEnd);
    const a = awningOf(b);
    if (a) awning(g, a.x0, a.x1, a.h);
  } else {
    // 현관: 계단 세 단, 두 짝 문, 채광창, 반지하 창
    const dx = x + Math.floor((shopEnd - x) / 2) - 14;
    rect(g, dx - 4, GROUND - 68, 36, 4, C.stone);
    rect(g, dx, GROUND - 64, 28, 52, C.iron);
    rect(g, dx + 2, GROUND - 62, 11, 48, C.awning);
    rect(g, dx + 15, GROUND - 62, 11, 48, C.awning);
    rect(g, dx + 4, GROUND - 58, 7, 14, C.windowDark);
    rect(g, dx + 17, GROUND - 58, 7, 14, C.windowDark);
    for (let st = 0; st < 3; st++) rect(g, dx - 6 - st * 3, GROUND - 12 + st * 4, 40 + st * 6, 4, st % 2 ? C.stoneDark : C.stone);
    window1(g, x + 10, GROUND - 52, 20, 20, hash(k++));
  }
  if (esc) fireEscape(g, esc.x0, esc.x1, esc.landings);
}

/**
 * 철제 비상계단: 층마다 발판(윗면이 발판 높이), 난간, 발판 사이를 잇는 비스듬한 계단, 맨 아래 접힌 사다리.
 * 발판 높이는 stage/citadel.ts의 escapeOf와 같다 (판정과 그림이 같은 숫자).
 */
function fireEscape(g: CanvasRenderingContext2D, x0: number, x1: number, landings: readonly number[]): void {
  const w = x1 - x0;
  landings.forEach((h, n) => {
    const y = GROUND - h;
    rect(g, x0, y, w, 3, C.iron);
    rect(g, x0, y, w, 1, C.ironLight);
    rect(g, x0, y - 12, w, 1, C.ironLight);
    for (let rx = x0; rx < x1; rx += 4) rect(g, rx, y - 12, 1, 12, C.iron);
    rect(g, x0 + 4, y + 3, 2, 4, C.iron);
    rect(g, x1 - 6, y + 3, 2, 4, C.iron);
    const below = landings[n - 1];
    if (below !== undefined) {
      const by = GROUND - below;
      const [a, b] = n % 2 ? [x0 + 6, x1 - 10] : [x1 - 6, x0 + 10];
      line(g, a, y, b, by - 1, C.iron);
      line(g, a + 1, y, b + 1, by - 1, C.iron);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        rect(g, Math.round(a + (b - a) * t) - 2, Math.round(y + (by - 1 - y) * t), 4, 1, C.ironLight);
      }
    }
  });
  // 맨 아래 접힌 사다리
  const ly = GROUND - landings[0] + 3;
  for (const lx of [x0 + 10, x0 + 18]) rect(g, lx, ly, 1, 30, C.iron);
  for (let y = ly + 4; y < ly + 30; y += 5) rect(g, x0 + 10, y, 9, 1, C.iron);
}

/** 극장: 붉은 벽돌, 높은 아치 창, 세로 전구 간판, 전구 차양(윗면이 발판), 1층 로비 문과 포스터 틀 */
function theater(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const x = b.x;
  const top = GROUND - b.h;
  brickWall(g, x, top, b.w, b.h, C.brickRed, C.brickRedDark, b.seed);
  for (const px of [x, x + b.w - 12]) {
    rect(g, px, top, 12, b.h, C.stone);
    for (let y = top + 6; y < GROUND; y += 10) rect(g, px, y, 12, 1, C.stoneDark);
  }
  cornice(g, x, top, b.w);
  rect(g, x + 12, top + 12, b.w - 24, 10, C.stoneDark);
  for (let dx = x + 16; dx < x + b.w - 16; dx += 8) disc(g, dx, top + 17, 2, C.paintOchre);
  // 높은 아치 창 둘 (객석 위층), 가운데는 세로 간판
  const mq = marqueeOf(b)!;
  const winTop = top + 34;
  const winBottom = GROUND - mq.h - 30;
  for (const cx of [x + 38, x + b.w - 38]) {
    const ww = 26;
    for (let y = winTop; y < winBottom; y++) {
      const d = y - winTop;
      const inset = d < 13 ? Math.round(13 - Math.sqrt(169 - (13 - d) ** 2)) : 0;
      rect(g, cx - ww / 2 + inset, y, ww - inset * 2, 1, C.windowDark);
    }
    for (let y = winTop + 14; y < winBottom; y += 12) rect(g, cx - ww / 2, y, ww, 1, C.iron);
    rect(g, cx - 1, winTop + 4, 2, winBottom - winTop - 4, C.iron);
    if (hash(b.seed + cx) < 0.6) ditherRect(g, cx - ww / 2, winBottom - 40, ww, 40, C.windowLit, 5);
    rect(g, cx - ww / 2 - 3, winBottom, ww + 6, 3, C.stoneDark);
  }
  // 세로 간판 자리 (네온 간판은 부서지는 물건이라 props.ts가 그린다): 받침 쇠붙이만
  for (let y = top + 40; y < GROUND - mq.h - 10; y += 40) rect(g, x + Math.floor(b.w / 2) - 14, y, 28, 2, C.iron);
  // 1층 로비: 문 넷, 포스터 틀
  rect(g, x + 12, GROUND - SHOP_H + 10, b.w - 24, SHOP_H - 10, C.brickDark);
  for (let i = 0; i < 4; i++) {
    const dx = x + 38 + i * 24;
    rect(g, dx, GROUND - 52, 18, 52, C.iron);
    rect(g, dx + 2, GROUND - 50, 14, 30, C.windowLit);
    rect(g, dx + 8, GROUND - 50, 2, 50, C.iron);
  }
  for (const px of [x + 14, x + b.w - 34]) {
    rect(g, px, GROUND - 52, 20, 32, C.paintOchre);
    rect(g, px + 2, GROUND - 50, 16, 28, C.posterRed);
    star(g, px + 10, GROUND - 42, 1);
  }
  // 차양 몸체: 윗면(발판)에서 아래로 22px, 크림색 글씨판 (전구와 글씨는 네온 간판이 얹는다)
  const my = GROUND - mq.h;
  rect(g, mq.x0, my, mq.x1 - mq.x0, 22, C.iron);
  rect(g, mq.x0 + 2, my + 4, mq.x1 - mq.x0 - 4, 14, C.paintCream);
  rect(g, mq.x0, my, mq.x1 - mq.x0, 1, C.ironLight);
}

/** 다이너: 긴 쇼윈도, 줄무늬 차양(윗면이 발판), 2층에 전구 테두리 간판 */
function diner(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const x = b.x;
  const top = GROUND - b.h;
  brickWall(g, x, top, b.w, b.h, C.brick, C.brickDark, b.seed);
  rect(g, x, top, 2, b.h, C.brickDark);
  cornice(g, x, top, b.w);
  const floors = floorsOf(b);
  let k = b.seed;
  for (let f = 2; f < floors.length; f++) {
    const wy = floors[f][0] + 14;
    for (let wx = x + 10; wx + 14 <= x + b.w - 10; wx += 24) window1(g, wx, wy, 14, 30, hash(k++));
  }
  shopfront(g, b, x + b.w);
  const a = awningOf(b)!;
  awning(g, a.x0, a.x1, a.h);
  // 1960년대 다이너: 1층 둘레 스테인리스 띠, 둥근 모서리, 창 아래 크롬 판
  for (const y of [GROUND - SHOP_H + 6, GROUND - SHOP_H + 10, GROUND - 8]) {
    rect(g, x + 2, y, b.w - 4, 2, C.chrome);
    rect(g, x + 2, y + 2, b.w - 4, 1, C.chromeDark);
  }
  for (let k = 0; k < 4; k++) {
    rect(g, x + 2 + k, GROUND - SHOP_H + 6 + k, 1, SHOP_H - 14 - k * 2, C.chromeDark);
    rect(g, x + b.w - 3 - k, GROUND - SHOP_H + 6 + k, 1, SHOP_H - 14 - k * 2, C.chromeDark);
  }
  for (let px = x + 6; px < x + b.w - 6; px += 8) rect(g, px, GROUND - 6, 1, 6, C.chromeDark);
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

/** 별 문장 (가운데 cx, cy), 크기 배수 */
export function star(g: CanvasRenderingContext2D, cx: number, cy: number, s = 1, color: string = C.posterRedDark): void {
  const rows = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rect(g, cx + (x - 3) * s, cy + (y - 3) * s, s, s, color);
  });
}

/** 골목: 바닥 근처만 어둡게 (뒤 겹이 보인다) */
function drawGap(g: CanvasRenderingContext2D, gap: FrontGap): void {
  ditherRect(g, gap.x, GROUND - 20, gap.w, 20, C.smog0, 6);
}

// ---------------------------------------------------------------- 부서지지 않는 장치 (월드 좌표): 부두, 시타델 본관, 공원
export function buildStructures(): HTMLCanvasElement {
  const [c, g] = canvas(MAP_W, MAP_H);
  pier(g);
  citadel(g);
  park(g);
  return c;
}

/** 해안 부두: 방파제 철제 난간(뒤로 바다가 보인다), 등대(둘레 발판·꼭대기 등실) */
function pier(g: CanvasRenderingContext2D): void {
  const R = D.pier.railing;
  rect(g, R.x0, GROUND - 4, R.x1 - R.x0, 4, C.stoneDark);
  for (let x = R.x0; x < R.x1; x += 16) rect(g, x, GROUND - R.h, 2, R.h, C.iron);
  rect(g, R.x0, GROUND - R.h, R.x1 - R.x0, 2, C.ironLight);
  rect(g, R.x0, GROUND - 14, R.x1 - R.x0, 1, C.iron);
  // 등대: 붉은 띠와 흰 띠가 번갈아 가며 위로 좁아지는 탑
  const H = D.pier.lighthouse;
  const cx = H.x + H.w / 2;
  const gal = GROUND - H.gallery;
  for (let y = gal; y < GROUND; y++) {
    const t = (GROUND - y) / H.gallery;
    const ww = Math.round(H.w * (1 - 0.25 * t));
    const band = Math.floor((GROUND - y) / 28) % 2 ? C.paintCream : C.posterRed;
    rect(g, cx - ww / 2, y, ww, 1, band);
    rect(g, cx + ww / 2 - 3, y, 3, 1, band === C.posterRed ? C.posterRedDark : C.stone);
  }
  for (let y = GROUND - 60; y > gal + 20; y -= 50) rect(g, cx - 3, y, 6, 9, C.windowDark);
  rect(g, cx - 8, GROUND - 26, 16, 26, C.iron);
  // 중간 발코니 (윗면이 발판)와 받침 까치발
  const by = GROUND - H.balcony;
  rect(g, cx - H.balconyW / 2, by, H.balconyW, 3, C.iron);
  rect(g, cx - H.balconyW / 2, by, H.balconyW, 1, C.ironLight);
  for (let x = cx - H.balconyW / 2; x <= cx + H.balconyW / 2; x += 5) rect(g, x, by - 8, 1, 8, C.iron);
  rect(g, cx - H.balconyW / 2, by - 8, H.balconyW, 1, C.ironLight);
  line(g, cx - H.balconyW / 2 + 2, by + 3, cx - 14, by + 14, C.iron);
  line(g, cx + H.balconyW / 2 - 2, by + 3, cx + 14, by + 14, C.iron);
  // 둘레 발판(윗면이 발판 높이)과 난간, 등실, 지붕
  rect(g, cx - H.galleryW / 2, gal, H.galleryW, 4, C.iron);
  rect(g, cx - H.galleryW / 2, gal, H.galleryW, 1, C.ironLight);
  for (let x = cx - H.galleryW / 2; x <= cx + H.galleryW / 2; x += 5) rect(g, x, gal - 10, 1, 10, C.iron);
  rect(g, cx - H.galleryW / 2, gal - 10, H.galleryW, 1, C.ironLight);
  rect(g, cx - 12, GROUND - H.h, 24, H.h - H.gallery, C.iron);
  rect(g, cx - 10, GROUND - H.h + 2, 20, H.h - H.gallery - 4, C.lampWarm);
  rect(g, cx - 4, GROUND - H.h + 6, 8, 10, C.lampCore);
  for (let i = 0; i < 9; i++) rect(g, cx - 13 + i, GROUND - H.h - i, 26 - i * 2, 1, C.iron);
  rect(g, cx, GROUND - H.h - 16, 1, 7, C.ironLight);
}

/** 등대 등실 (월드 좌표): 빛줄기가 나오는 곳 */
export function lighthouseLamp(): { x: number; y: number } {
  const H = D.pier.lighthouse;
  return { x: H.x + H.w / 2, y: GROUND - H.h + 11 };
}

/**
 * 불 켜진 사무실 유리 칸 하나: 천장 등 줄, 아래쪽 가구 그늘, 그리고 r에 따라 블라인드·책상과 사람 그림자·서류장 중 하나.
 * warm: 백열등(주황), 아니면 형광등(창백한 녹색).
 */
function officePane(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, warm: boolean, r: number): void {
  rect(g, x, y, w, h, warm ? C.windowLit : C.officeLit);
  rect(g, x, y, w, 1, warm ? C.windowLight : C.beam);
  ditherRect(g, x, y + h - 6, w, 6, C.glass, 6);
  if (r < 0.3) {
    // 반쯤 내린 블라인드
    const down = 3 + Math.floor(r * 30);
    for (let yy = y + 1; yy < y + down; yy += 2) rect(g, x, yy, w, 1, warm ? C.paintOchre : C.chromeDark);
  } else if (r < 0.55) {
    // 책상과 앉은 사람 그림자
    rect(g, x + 1, y + h - 7, w - 2, 2, C.glass);
    rect(g, x + 2 + Math.floor(r * 10) % 5, y + h - 12, 3, 5, C.glass);
    rect(g, x + 3 + Math.floor(r * 10) % 5, y + h - 14, 2, 2, C.glass);
  } else if (r < 0.7) {
    // 서류장
    rect(g, x + w - 5, y + h - 11, 4, 11, C.glass);
  }
}

/** 본관 옥상 서치라이트 (월드 좌표) */
export function keepRoofLights(): Array<{ x: number; y: number }> {
  const top = GROUND - D.plaza.keep.h;
  return D.plaza.keep.lights.map((x) => ({ x, y: top - 10 }));
}

/** 본관 커튼월과 로비가 내는 붙박이 빛 (월드 좌표): 불 켜진 사무실, 로비, 가운데 유리 홀, 캐노피 등, 기둥의 빛 홈 */
export const TOWER_LIGHTS: Array<{ x: number; y: number; r: number; a: number; color: string }> = [];

/** 본관 콘크리트 기둥 꼭대기 항공 경고등 (월드 좌표). 빛은 매 틱 깜빡인다 */
export function towerBeacons(): Array<{ x: number; y: number }> {
  const P = D.plaza;
  return P.towers.map((t) => ({ x: t.x + P.tower.w - 9, y: GROUND - P.tower.h - 12 }));
}

/**
 * 시타델 본관 (무너지지 않음): 1960년대 마천루의 아랫부분.
 * - 유리 커튼월: 굵은 콘크리트 기둥(pier)이 위아래로 꿰뚫고, 그 사이를 가는 쇠 멀리언이 유리 칸으로 나눈다.
 *   층마다 어두운 스팬드럴 띠, 꺼진 유리에는 도시가 비스듬히 비치고, 켜진 사무실은 형광등(창백한 녹색)이나 백열등(주황).
 * - 기단부: 굵은 기둥이 늘어선 2층 높이 유리 로비(안쪽 승강기 문과 늘어진 깃발), 검은 화강암 받침.
 *   정문 양옆 기둥 사이는 계단참에서 높이 솟은 유리 홀.
 * - 옥상 서치라이트 받침, 정면 대형 간판(어두운 띠에 빛나는 글자).
 * 그 앞에 정문 계단과 계단참(윗면이 발판), 유리 정문과 캐노피, 정문 양옆 콘크리트 기둥(중간 캔틸레버 테라스·꼭대기가 발판, 항공 경고등),
 * 분수 수반, 히어로 동상.
 */
function citadel(g: CanvasRenderingContext2D): void {
  const P = D.plaza;
  const K = P.keep;
  const T = P.tower;
  const L = P.landing;
  const top = GROUND - K.h;
  const w = K.x1 - K.x0;
  const lobbyTop = GROUND - K.lobby;
  const wallBottom = lobbyTop - 12;
  const atriumTop = GROUND - K.atrium;
  const ax0 = P.towers[0].x + T.w;
  const ax1 = P.towers[1].x;
  const ly = GROUND - L.h;
  TOWER_LIGHTS.length = 0;

  // 1) 유리 커튼월: 층마다 유리 칸을 칠하고 (꺼진 칸은 비치는 하늘, 켜진 칸은 사무실), 스팬드럴 띠를 두른다
  rect(g, K.x0, top, w, wallBottom - top, C.glass);
  const floors: number[] = [];
  for (let fy = wallBottom - K.floor; fy > top + 14; fy -= K.floor) floors.push(fy);
  floors.forEach((fy, f) => {
    const allLit = hash(f * 97 + 13) < 0.14;
    const warmFloor = hash(f * 41 + 5) < 0.35;
    for (let bay = 0; bay * K.pier < w; bay++) {
      let n = 0;
      for (let k = 0; k < K.pier / K.pane; k++) {
        const x = K.x0 + bay * K.pier + k * K.pane;
        if (x >= K.x1) break;
        if (fy + K.floor > atriumTop && x + K.pane > ax0 && x < ax1) continue;
        const on = allLit || hash(f * 31 + (bay * 6 + k) * 7) < 0.15;
        const gy = fy + 5;
        const gh = K.floor - 5;
        if (on) {
          n++;
          const warm = allLit ? warmFloor : hash(f * 5 + k * 3 + bay) < 0.4;
          officePane(g, x + 2, gy, K.pane - 2, gh, warm, hash(f * 11 + k * 17 + bay * 5));
        } else {
          // 비스듬히 비치는 도시 불빛 (굵은 띠 몇 줄)과 칸 위쪽의 옅은 하늘빛
          const band = (x + (fy - top) * 0.8) % 210 < 46;
          if (band) ditherRect(g, x + 2, gy, K.pane - 2, gh, C.glassEdge, 5);
          else ditherRect(g, x + 2, gy, K.pane - 2, 3, C.glassEdge, 4);
        }
      }
      if (n >= 2) {
        const bx = K.x0 + bay * K.pier + K.pier / 2;
        const color = allLit ? (warmFloor ? C.windowLight : C.officeLit) : C.officeLit;
        TOWER_LIGHTS.push({ x: bx, y: fy + K.floor / 2, r: 18 + n * 4, a: 0.1 + n * 0.04, color });
      }
    }
    // 스팬드럴 (층 바닥 띠)
    rect(g, K.x0, fy, w, 5, C.iron);
    rect(g, K.x0, fy, w, 1, C.ironLight);
  });
  // 가는 쇠 멀리언
  for (let x = K.x0; x < K.x1; x += K.pane) {
    rect(g, x, top, 1, wallBottom - top, C.chromeDark);
    rect(g, x + 1, top, 1, wallBottom - top, C.iron);
  }
  // 굵은 콘크리트 기둥 (빛 받는 왼쪽 모서리가 밝다): 꼭대기에서 땅까지 꿰뚫는다 (가운데 유리 홀 안은 홀 꼭대기에서 멈춘다)
  for (let x: number = K.x0; x <= K.x1; x += K.pier) {
    const inAtrium = x > ax0 && x < ax1;
    const bottom = inAtrium ? atriumTop : GROUND;
    const pw = x === K.x0 || x === K.x1 ? 10 : 7;
    const px = x === K.x1 ? x - pw : x === K.x0 ? x : x - 3;
    rect(g, px, top, pw, bottom - top, C.stone);
    rect(g, px, top, 1, bottom - top, C.paintCream);
    rect(g, px + pw - 2, top, 2, bottom - top, C.stoneDark);
  }

  // 2) 옥상: 처마 띠와 서치라이트 받침 (빛줄기는 매 틱)
  rect(g, K.x0 - 4, top - 8, w + 8, 8, C.stone);
  rect(g, K.x0 - 4, top - 8, w + 8, 1, C.paintCream);
  rect(g, K.x0 - 4, top - 1, w + 8, 2, C.stoneDark);
  for (const lx of K.lights) {
    rect(g, lx - 10, top - 14, 20, 6, C.iron);
    rect(g, lx - 6, top - 22, 12, 8, C.ironLight);
    rect(g, lx - 4, top - 20, 8, 4, C.beam);
  }

  // 3) 기단부: 로비 위 띠, 들어간 유리 로비(안쪽 불빛·승강기 문·늘어진 깃발), 검은 화강암 받침
  rect(g, K.x0, wallBottom, w, 12, C.stone);
  rect(g, K.x0, wallBottom, w, 1, C.paintCream);
  rect(g, K.x0, wallBottom + 10, w, 2, C.stoneDark);
  for (const [x0, x1] of [[K.x0, ax0], [ax1, K.x1]] as const) {
    rect(g, x0, lobbyTop, x1 - x0, GROUND - 22 - lobbyTop, C.glass);
    ditherRect(g, x0, lobbyTop + 6, x1 - x0, 50, C.windowLit, 3);
    ditherRect(g, x0, lobbyTop + 56, x1 - x0, GROUND - 22 - lobbyTop - 56, C.windowLit, 8);
    // 천장 띠와 매입등
    rect(g, x0, lobbyTop, x1 - x0, 6, C.iron);
    for (let x = x0 + 6; x < x1 - 4; x += 12) rect(g, x, lobbyTop + 6, 3, 1, C.lampCore);
    // 안쪽 승강기 문 (청동)과 늘어진 깃발 (붉은 바탕에 별)
    for (let x = x0 + 20; x + 24 < x1; x += 45) {
      if (hash(x) < 0.5) {
        rect(g, x, GROUND - 22 - 30, 9, 30, C.paintOchre);
        rect(g, x + 10, GROUND - 22 - 30, 9, 30, C.paintOchre);
        rect(g, x + 9, GROUND - 22 - 30, 1, 30, C.iron);
        rect(g, x - 1, GROUND - 22 - 33, 21, 3, C.iron);
      } else {
        rect(g, x + 4, lobbyTop + 6, 12, 58, C.posterRed);
        rect(g, x + 4, lobbyTop + 62, 12, 2, C.posterRedDark);
        star(g, x + 10, lobbyTop + 26, 1, C.paintOchre);
      }
    }
    // 큰 유리 칸 멀리언과 가로대
    for (let x = x0; x < x1; x += 30) rect(g, x, lobbyTop + 6, 1, GROUND - 22 - lobbyTop - 6, C.chromeDark);
    rect(g, x0, lobbyTop + 70, x1 - x0, 1, C.chromeDark);
    for (let x = x0 + 45; x < x1; x += 90) TOWER_LIGHTS.push({ x, y: GROUND - 60, r: 54, a: 0.32, color: C.windowLit });
  }
  rect(g, K.x0, GROUND - 22, w, 22, C.iron);
  rect(g, K.x0, GROUND - 22, w, 1, C.ironLight);
  ditherRect(g, K.x0, GROUND - 20, w, 6, C.ironLight, 3);
  // 로비 앞 굵은 기둥 (커튼월 기둥이 땅까지 내려온 것) 다시 얹기
  for (let x: number = K.x0; x <= K.x1; x += K.pier) {
    if (x > ax0 && x < ax1) continue;
    const pw = x === K.x0 || x === K.x1 ? 10 : 7;
    const px = x === K.x1 ? x - pw : x === K.x0 ? x : x - 3;
    rect(g, px, wallBottom, pw, GROUND - wallBottom, C.stone);
    rect(g, px, wallBottom, 1, GROUND - wallBottom, C.paintCream);
    rect(g, px + pw - 2, wallBottom, 2, GROUND - wallBottom, C.stoneDark);
  }

  // 4) 가운데 유리 홀: 계단참에서 높이 솟은 유리, 큰 깃발, 홀 꼭대기 띠
  rect(g, ax0, atriumTop, ax1 - ax0, ly - atriumTop, C.glass);
  ditherRect(g, ax0, atriumTop + 30, ax1 - ax0, ly - atriumTop - 30, C.windowLit, 7);
  for (let x = ax0 + 26; x < ax1; x += 26) rect(g, x, atriumTop, 1, ly - atriumTop, C.chromeDark);
  for (let y = atriumTop + 34; y < ly; y += 34) rect(g, ax0, y, ax1 - ax0, 1, C.chromeDark);
  const bcx = Math.round((ax0 + ax1) / 2);
  rect(g, bcx - 16, atriumTop + 6, 32, 82, C.posterRed);
  rect(g, bcx - 16, atriumTop + 86, 32, 3, C.posterRedDark);
  star(g, bcx, atriumTop + 36, 3, C.paintOchre);
  rect(g, ax0, atriumTop - 6, ax1 - ax0, 6, C.stone);
  rect(g, ax0, atriumTop - 6, ax1 - ax0, 1, C.paintCream);
  TOWER_LIGHTS.push({ x: bcx, y: atriumTop + 70, r: 96, a: 0.4, color: C.windowLit });

  // 5) 정면 대형 간판: 어두운 띠에 빛나는 글자, 양옆 붉은 별
  const S = P.sign;
  const tw = textWidth(S.text, 4);
  const sw = tw + 28;
  const scx = (P.towers[0].x + P.towers[1].x + T.w) / 2;
  const sy = GROUND - S.h - 26;
  rect(g, scx - sw / 2 - 4, sy - 4, sw + 8, 56, C.iron);
  rect(g, scx - sw / 2 - 4, sy - 4, sw + 8, 1, C.ironLight);
  drawText(g, S.text, Math.round(scx - tw / 2) + 1, sy + 7, C.chromeDark, 4);
  drawText(g, S.text, Math.round(scx - tw / 2), sy + 6, C.lampCore, 4);
  drawText(g, S.sub, Math.round(scx - textWidth(S.sub, 2) / 2), sy + 32, C.beam, 2);
  star(g, Math.round(scx - sw / 2 - 18), sy + 22, 3, C.posterRed);
  star(g, Math.round(scx + sw / 2 + 18), sy + 22, 3, C.posterRed);
  TOWER_LIGHTS.push({ x: scx, y: sy + 22, r: 70, a: 0.45, color: C.beam });

  // 6) 정문 계단: 계단참 아래로 앞으로 내려오는 넓은 화강암 계단 (그림. 발판은 계단참)
  const steps = Math.ceil(L.h / 8);
  for (let i = 0; i < steps; i++) {
    const y = GROUND - (i + 1) * 8;
    const inset = 10 + i * 2;
    rect(g, L.x0 + inset, y, L.x1 - L.x0 - inset * 2, 8, C.stone);
    rect(g, L.x0 + inset, y + 5, L.x1 - L.x0 - inset * 2, 3, C.stoneDark);
    rect(g, L.x0 + inset, y, L.x1 - L.x0 - inset * 2, 1, C.paintCream);
  }
  // 계단참: 윗면(발판)과 앞 턱
  rect(g, L.x0, ly, L.x1 - L.x0, 6, C.stone);
  rect(g, L.x0, ly, L.x1 - L.x0, 1, C.paintCream);
  rect(g, L.x0, ly + 6, L.x1 - L.x0, 2, C.stoneDark);

  // 7) 유리 정문: 쇠틀, 불 켜진 유리문 넷과 가운데 회전문, 위로 얇게 튀어나온 캐노피(아래 매입등), 양옆 원통 벽등
  const gx = Math.round((L.x0 + L.x1 - P.gate.w) / 2);
  const gTop = ly - P.gate.h;
  rect(g, gx - 4, gTop, P.gate.w + 8, P.gate.h, C.iron);
  rect(g, gx, gTop + 4, P.gate.w, P.gate.h - 4, C.glass);
  ditherRect(g, gx, gTop + 40, P.gate.w, P.gate.h - 40, C.windowLit, 9);
  for (let x = gx + 20; x < gx + P.gate.w; x += 20) rect(g, x, gTop + 4, 1, P.gate.h - 4, C.iron);
  rect(g, gx, gTop + 36, P.gate.w, 2, C.iron);
  const rx = gx + P.gate.w / 2 - 12;
  rect(g, rx, ly - 46, 24, 46, C.paintOchre);
  rect(g, rx + 2, ly - 44, 20, 44, C.glass);
  ditherRect(g, rx + 2, ly - 44, 20, 44, C.windowLight, 5);
  rect(g, rx + 11, ly - 44, 2, 44, C.paintOchre);
  rect(g, rx, ly - 48, 24, 2, C.paintOchre);
  const cy = gTop - 10;
  rect(g, gx - 36, cy, P.gate.w + 72, 6, C.stone);
  rect(g, gx - 36, cy, P.gate.w + 72, 1, C.paintCream);
  rect(g, gx - 36, cy + 6, P.gate.w + 72, 1, C.stoneDark);
  for (let x = gx - 30; x < gx + P.gate.w + 32; x += 14) rect(g, x, cy + 6, 3, 1, C.lampCore);
  for (let x = gx - 18; x < gx + P.gate.w + 32; x += 42) TOWER_LIGHTS.push({ x, y: cy + 10, r: 24, a: 0.5, color: C.lampGlow });
  for (const lx of [gx - 22, gx + P.gate.w + 14]) {
    rect(g, lx + 1, ly - 74, 6, 20, C.chromeDark);
    rect(g, lx + 1, ly - 74, 1, 20, C.chrome);
    rect(g, lx + 3, ly - 70, 2, 12, C.lampGlow);
  }

  // 8) 정문 양옆 콘크리트 기둥: 거푸집 줄눈, 가운데 빛 홈, 얇게 튀어나온 테라스(윗면이 발판)와 쇠 난간,
  //    꼭대기 덮개(윗면이 발판)와 항공 경고등 (빛은 매 틱 깜빡인다)
  for (const t of P.towers) {
    const tx = t.x;
    const tTop = GROUND - T.h;
    ditherRect(g, tx + T.w, tTop + 10, 10, T.h - 10, C.smog0, 10);
    rect(g, tx, tTop, T.w, T.h, C.stone);
    for (let y = tTop + 14; y < GROUND; y += 16) rect(g, tx, y, T.w, 1, C.stoneDark);
    rect(g, tx, tTop, 3, T.h, C.paintCream);
    rect(g, tx + T.w - 4, tTop, 4, T.h, C.stoneDark);
    const sx = tx + Math.round(T.w / 2) - 3;
    rect(g, sx, tTop + 16, 6, T.h - 40, C.iron);
    rect(g, sx + 1, tTop + 18, 4, T.h - 44, C.officeLit);
    ditherRect(g, sx + 1, tTop + 18, 4, T.h - 44, C.beam, 6);
    for (const k of [0.2, 0.5, 0.8]) TOWER_LIGHTS.push({ x: sx + 3, y: tTop + 18 + (T.h - 44) * k, r: 20, a: 0.35, color: C.officeLit });
    // 캔틸레버 테라스: 얇은 판과 쇠 난간
    const ty = GROUND - T.terrace;
    const tw2 = T.w + T.terraceOver * 2;
    rect(g, tx - T.terraceOver, ty, tw2, 5, C.stone);
    rect(g, tx - T.terraceOver, ty, tw2, 1, C.paintCream);
    rect(g, tx - T.terraceOver, ty + 5, tw2, 1, C.stoneDark);
    for (let x = tx - T.terraceOver; x <= tx + T.w + T.terraceOver; x += 8) rect(g, x, ty - 10, 1, 10, C.chromeDark);
    rect(g, tx - T.terraceOver, ty - 11, tw2, 1, C.chrome);
    rect(g, tx - T.terraceOver, ty - 6, tw2, 1, C.chromeDark);
    // 꼭대기 덮개와 경고등 기둥
    rect(g, tx - 2, tTop, T.w + 4, 6, C.stone);
    rect(g, tx - 2, tTop, T.w + 4, 1, C.paintCream);
    rect(g, tx - 2, tTop + 6, T.w + 4, 1, C.stoneDark);
    rect(g, tx + T.w - 10, tTop - 10, 2, 10, C.chromeDark);
    rect(g, tx + T.w - 11, tTop - 13, 4, 3, C.neonRedDark);
  }

  // 9) 분수 수반 (물줄기는 매 틱): 돌 테두리, 가운데 받침과 그릇
  const F = P.fountain;
  rect(g, F.x - F.w / 2, GROUND - 18, F.w, 18, C.stone);
  rect(g, F.x - F.w / 2, GROUND - 18, F.w, 2, C.paintCream);
  ditherRect(g, F.x - F.w / 2 + 4, GROUND - 16, F.w - 8, 4, C.skyDark, 8);
  rect(g, F.x - 5, GROUND - 46, 10, 28, C.stone);
  rect(g, F.x - 20, GROUND - 50, 40, 5, C.stone);
  rect(g, F.x - 20, GROUND - 50, 40, 1, C.paintCream);
  // 10) 광장 양옆 낮은 콘크리트 담과 쇠 난간
  for (const [x0, x1] of [[P.gatePiers[0] + 32, K.x0], [K.x1, P.gatePiers[1]]] as const) {
    rect(g, x0, GROUND - 12, x1 - x0, 12, C.stone);
    rect(g, x0, GROUND - 12, x1 - x0, 1, C.paintCream);
    rect(g, x0, GROUND - 2, x1 - x0, 2, C.stoneDark);
    for (let bx = x0 + 2; bx < x1 - 2; bx += 10) rect(g, bx, GROUND - 24, 1, 12, C.chromeDark);
    rect(g, x0, GROUND - 25, x1 - x0, 1, C.chrome);
  }
  statue(g, P.statue.x, GROUND);
}

/** 히어로 동상: 돌 받침 위에 주먹을 든 영웅 (어두운 청동 실루엣, 눈 없음) */
function statue(g: CanvasRenderingContext2D, x: number, ground: number): void {
  rect(g, x, ground - 40, 48, 40, C.stone);
  rect(g, x - 3, ground - 44, 54, 5, C.stoneDark);
  rect(g, x - 3, ground - 6, 54, 6, C.stoneDark);
  ditherRect(g, x, ground - 39, 48, 32, C.stoneDark, 3);
  const bx = x + 24;
  const by = ground - 44;
  const bronze = C.ironLight;
  rect(g, bx - 7, by - 5, 6, 5, bronze);
  rect(g, bx + 2, by - 5, 6, 5, bronze);
  for (const [a, b] of [[-5, -2], [-4, -1], [5, 2], [6, 3]] as const) line(g, bx + a, by - 5, bx + b, by - 26, bronze);
  rect(g, bx - 5, by - 48, 11, 23, bronze);
  disc(g, bx, by - 55, 6, bronze);
  line(g, bx + 5, by - 46, bx + 14, by - 60, bronze);
  line(g, bx + 6, by - 45, bx + 15, by - 59, bronze);
  rect(g, bx + 13, by - 66, 6, 7, bronze);
  line(g, bx - 5, by - 46, bx - 12, by - 32, bronze);
  line(g, bx - 6, by - 45, bx - 13, by - 31, bronze);
  for (let i = 0; i < 20; i++) rect(g, bx - 7 - Math.floor(i / 3), by - 46 + i, 3, 1, C.iron);
}

/** 시타델 공원: 뒤쪽 산울타리, 키 큰 나무 (어둡고 조용하게) */
function park(g: CanvasRenderingContext2D): void {
  const P = D.park;
  const x0 = D.sections[4].x0;
  const x1 = P.fence.x0;
  rect(g, x0, GROUND - 20, x1 - x0, 20, C.iron);
  for (let x = x0; x < x1; x += 6) disc(g, x + 3, GROUND - 20, 5, C.iron);
  ditherRect(g, x0, GROUND - 24, x1 - x0, 24, C.paintTeal, 3);
  for (const t of P.trees) {
    rect(g, t.x - 3, GROUND - t.h, 7, t.h, C.awning);
    rect(g, t.x + 2, GROUND - t.h, 2, t.h, C.awningStripe);
    line(g, t.x, GROUND - t.h + 20, t.x - 16, GROUND - t.h - 4, C.awning);
    line(g, t.x + 1, GROUND - t.h + 30, t.x + 18, GROUND - t.h + 6, C.awning);
    const cy = GROUND - t.h - t.r * 0.6;
    for (const [dx, dy, rr] of [[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.25, 0.7], [-0.3, -0.45, 0.6], [0.35, -0.4, 0.6]] as const) {
      disc(g, t.x + dx * t.r, cy + dy * t.r, t.r * rr, C.iron);
    }
    disc(g, t.x - t.r * 0.2, cy - t.r * 0.25, t.r * 0.7, C.paintTeal, 6);
    disc(g, t.x + t.r * 0.25, cy - t.r * 0.45, t.r * 0.4, C.paintTeal, 9);
  }
}

// ---------------------------------------------------------------- 거리 (월드 좌표, 전차보다 앞)
export function buildStreet(): Layer {
  const [c, g] = canvas(MAP_W, MAP_H);
  const y0 = GROUND;
  const sw = D.street.sidewalk;
  const sec = D.sections;
  // 부두: 돌 부두 끝
  stoneWall(g, 0, y0, sec[0].x1, MAP_H - y0, 3, 24);
  rect(g, 0, y0, sec[0].x1, 1, C.paintCream);
  // 극장 거리·아파트: 보도와 차도
  for (const s of [sec[1], sec[3]]) {
    rect(g, s.x0, y0, s.x1 - s.x0, sw, C.sidewalk);
    for (let x = s.x0; x < s.x1; x += 20) rect(g, x, y0 + 1, 1, sw - 1, C.sidewalkJoint);
    rect(g, s.x0, y0, s.x1 - s.x0, 1, C.curb);
    rect(g, s.x0, y0 + sw, s.x1 - s.x0, 2, C.curb);
    rect(g, s.x0, y0 + sw + 2, s.x1 - s.x0, MAP_H - y0 - sw - 2, C.street);
    ditherRect(g, s.x0, y0 + sw + 3, s.x1 - s.x0, MAP_H - y0 - sw - 3, C.streetLine, 3);
  }
  // 광장: 돌 포장
  const P = sec[2];
  rect(g, P.x0, y0, P.x1 - P.x0, MAP_H - y0, C.sidewalk);
  rect(g, P.x0, y0, P.x1 - P.x0, 1, C.stone);
  for (let x = P.x0; x < P.x1; x += 12) for (let y = y0 + 2; y < MAP_H; y += 6) rect(g, x + ((y >> 1) % 2) * 6, y, 1, 1, C.sidewalkJoint);
  // 공원: 자갈 길과 앞쪽 풀
  const K = sec[4];
  rect(g, K.x0, y0, K.x1 - K.x0, MAP_H - y0, C.sandbag);
  ditherRect(g, K.x0, y0, K.x1 - K.x0, MAP_H - y0, C.awning, 6);
  ditherRect(g, K.x0, y0 + 16, K.x1 - K.x0, MAP_H - y0 - 16, C.paintTeal, 7);
  // 노면전차 선로 두 줄과 가공선
  const T = D.tram;
  for (const ry of [y0 + sw + 7, y0 + sw + 14]) {
    rect(g, T.x0, ry, T.x1 - T.x0, 1, C.rail);
    rect(g, T.x0, ry + 1, T.x1 - T.x0, 1, C.railDark);
  }
  const wy = y0 - T.wire;
  for (let x = T.x0; x < T.x1; x++) rect(g, x, wy + Math.round(Math.sin(((x - T.x0) % 120) / 120 * Math.PI) * 3), 1, 1, C.wire);
  for (let x = T.x0; x < T.x1; x += 120) rect(g, x, wy - 10, 1, 10, C.iron);
  // 서쪽 끝 컨테이너 더미 (벽, 전차 시작을 가린다)
  const CT = D.pier.containers;
  const colors = [C.rust, C.paintTeal, C.paintOchre, C.brickRed];
  for (let r = 0; r < CT.rows; r++) {
    const y = y0 - (r + 1) * 28;
    const col = colors[r % colors.length];
    const x0 = CT.x0 - (r % 2 ? 6 : 0);
    rect(g, x0, y, CT.x1 - x0, 28, col);
    rect(g, x0, y, CT.x1 - x0, 2, C.iron);
    for (let x = x0 + 3; x < CT.x1 - 2; x += 4) rect(g, x, y + 3, 1, 23, C.iron);
    rect(g, CT.x1 - 10, y + 6, 2, 16, C.iron);
    rect(g, CT.x1 - 5, y + 6, 2, 16, C.iron);
    rect(g, CT.x1 - 1, y, 1, 28, C.smog0);
  }
  // 광장 입구 문기둥 둘 (서쪽 것이 전차 끝을 가린다)
  for (const px of D.plaza.gatePiers) {
    stoneWall(g, px, y0 - 120, 32, 120, px, 16);
    rect(g, px - 3, y0 - 124, 38, 6, C.stone);
    rect(g, px + 10, y0 - 136, 12, 12, C.lampWarm);
    rect(g, px + 12, y0 - 134, 8, 8, C.lampGlow);
  }
  // 광장 동쪽 입구 검문소: 모래주머니, 초소(불 켜진 창, 줄무늬 띠, 글씨), 들어 올린 차단봉
  const CP = D.plaza.checkpoint;
  for (let row = 0; row < 2; row++) for (let k = 0; k < 3 - row; k++) {
    const bx = CP.x - 34 + k * 11 + row * 5;
    rect(g, bx, y0 - 8 - row * 7, 11, 7, C.sandbag);
    rect(g, bx, y0 - 2 - row * 7, 11, 1, C.awning);
  }
  rect(g, CP.x, y0 - CP.h, CP.w, CP.h, C.ironLight);
  rect(g, CP.x - 2, y0 - CP.h - 4, CP.w + 4, 4, C.iron);
  rect(g, CP.x + 4, y0 - CP.h + 8, CP.w - 8, 12, C.windowLit);
  rect(g, CP.x + 4, y0 - CP.h + 8, CP.w - 8, 3, C.windowLight);
  rect(g, CP.x + CP.w / 2, y0 - CP.h + 8, 1, 12, C.iron);
  for (let k = 0; k < CP.w; k += 6) rect(g, CP.x + k, y0 - CP.h + 24, 3, 3, C.posterRed);
  drawText(g, 'HALT', CP.x + Math.floor((CP.w - textWidth('HALT', 1)) / 2), y0 - CP.h + 30, C.paintCream, 1);
  rect(g, CP.x + CP.w / 2 - 2, y0 - CP.h - 8, 4, 4, C.neonRed);
  for (let k = 0; k < 40; k++) {
    const ax = CP.x + CP.w + Math.round(k * Math.cos(-1.1));
    const ay = y0 - 30 + Math.round(k * Math.sin(-1.1));
    rect(g, ax, ay, 2, 2, Math.floor(k / 5) % 2 ? C.posterRed : C.paintCream);
  }
  rect(g, CP.x + CP.w - 2, y0 - 34, 6, 34, C.iron);
  // 동쪽 끝 철책 (벽)
  const FN = D.park.fence;
  rect(g, FN.x0, y0 - 14, MAP_W - FN.x0, 14, C.stoneDark);
  rect(g, FN.x0, y0 - 14, MAP_W - FN.x0, 1, C.stone);
  for (let x = FN.x0 + 2; x < MAP_W; x += 5) {
    rect(g, x, y0 - FN.h, 2, FN.h - 14, C.iron);
    rect(g, x - 1, y0 - FN.h - 3, 4, 3, C.ironLight);
  }
  rect(g, FN.x0, y0 - FN.h + 16, MAP_W - FN.x0, 2, C.iron);
  rect(g, FN.x0, y0 - 40, MAP_W - FN.x0, 2, C.iron);
  stoneWall(g, FN.x0 - 4, y0 - FN.h - 10, 14, FN.h + 10, 5, 14);
  for (const x of D.pier.bollards) prop(g, 'bollard', x, y0, '');
  for (const p of D.street.props) prop(g, p.kind, p.x, y0, 'text' in p ? p.text : '');
  for (const x of D.park.benches) prop(g, 'bench', x, y0, '');
  return { canvas: c, speed: 1 };
}

/** 맨홀 (증기가 오르는 곳, 월드 x와 y) */
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
    case 'bollard':
      rect(g, x, ground - 12, 8, 12, C.iron);
      rect(g, x - 1, ground - 14, 10, 3, C.ironLight);
      line(g, x + 8, ground - 8, x + 22, ground - 2, C.awningStripe);
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
    case 'bench':
      rect(g, x, ground - 12, 36, 3, C.awningStripe);
      rect(g, x, ground - 22, 36, 3, C.awningStripe);
      rect(g, x + 2, ground - 22, 2, 22, C.iron);
      rect(g, x + 32, ground - 22, 2, 22, C.iron);
      break;
    case 'planter':
      rect(g, x, ground - 16, 30, 16, C.stone);
      rect(g, x, ground - 16, 30, 2, C.paintCream);
      disc(g, x + 15, ground - 26, 12, C.iron);
      disc(g, x + 12, ground - 29, 8, C.paintTeal, 7);
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
      break;
    }
  }
}
