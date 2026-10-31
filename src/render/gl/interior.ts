import { FLOOR_H, GROUND, hasShopWindow, SHOP_H, type FrontBuildingPlace } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, disc, dither, ditherRect, hash, line, paint, rect } from '../dither';

/**
 * 건물 실내 그림 (렌더 전용): 정면이 뚫리면 그 뒤 실내 판에 보인다. 건물 종류마다 다르다:
 * 상가·아파트는 층마다 벽지·가구·계단, 1층 가게는 진열장, 다이너 1층은 계산대와 의자·칸막이 자리,
 * 극장은 층 없이 높은 객석(층층이 좌석, 붉은 막 무대, 발코니, 샹들리에).
 * 월드 좌표로 그린 뒤(건물 자리로 옮긴 캔버스) 실내 판 깊이의 배율로 줄인다 (텍스처 한 칸 = 화면 1px).
 * 발광: 매달린 전구·샹들리에·주방 창만 남긴 그림.
 */
export interface InteriorPaint {
  map: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}

/** 층 경계: [위, 아래] (월드 y). 0이 1층 */
export function floorsOf(b: FrontBuildingPlace): Array<[number, number]> {
  const out: Array<[number, number]> = [[GROUND - SHOP_H, GROUND]];
  for (let f = 1; f < b.floors; f++) out.push([GROUND - SHOP_H - f * FLOOR_H, GROUND - SHOP_H - (f - 1) * FLOOR_H]);
  return out;
}

/** 발광으로 남길 색 (불빛) */
const GLOW: ReadonlySet<string> = new Set([C.lampWarm, C.lampGlow, C.windowLit].map((h) => h.toLowerCase()));

/** 그리는 중인 캔버스의 월드 기준점 (paint는 픽셀 버퍼로 바로 쓰므로 옮김을 모른다) */
let OX = 0;
let OY = 0;
const paintW = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fn: (x: number, y: number) => string | null) =>
  paint(g, x - OX, y - OY, w, h, (px, py) => fn(px + OX, py + OY));

export function paintInterior(b: FrontBuildingPlace, bi: number, s: number): InteriorPaint {
  const [full, g] = canvas(b.w, b.h);
  OX = b.x;
  OY = GROUND - b.h;
  g.translate(-OX, -OY);
  if (b.kind === 'theater') theaterInside(g, b);
  else {
    floorsOf(b).forEach(([y0, y1], fi) => {
      const seed = b.seed * 31 + fi * 7;
      if (fi === 0 && b.kind === 'diner') dinerFloor(g, b, y0, y1, seed);
      else if (fi === 0 && hasShopWindow(b)) shopFloor(g, b, y0, y1, seed);
      else room(g, b, y0, y1, seed);
    });
    stairs(g, b, bi);
  }
  // 실내 판 깊이의 배율로 줄인다 (가장 가까운 칸)
  const tw = Math.round(b.w * s);
  const th = Math.round(b.h * s);
  const [map, mg] = canvas(tw, th);
  mg.imageSmoothingEnabled = false;
  mg.drawImage(full, 0, 0, b.w, b.h, 0, 0, tw, th);
  const [glow, eg] = canvas(tw, th);
  const src = mg.getImageData(0, 0, tw, th);
  const out = eg.createImageData(tw, th);
  for (let i = 0; i < tw * th; i++) {
    const hex = `#${((1 << 24) | (src.data[i * 4] << 16) | (src.data[i * 4 + 1] << 8) | src.data[i * 4 + 2]).toString(16).slice(1)}`;
    const on = GLOW.has(hex);
    out.data[i * 4] = on ? src.data[i * 4] : 0;
    out.data[i * 4 + 1] = on ? src.data[i * 4 + 1] : 0;
    out.data[i * 4 + 2] = on ? src.data[i * 4 + 2] : 0;
    out.data[i * 4 + 3] = 255;
  }
  eg.putImageData(out, 0, 0);
  return { map, glow };
}

/** 방 공통: 천장 밑 배관, 바닥판, 세로 배관, 매달린 전구 */
function shell(g: CanvasRenderingContext2D, b: FrontBuildingPlace, y0: number, y1: number, seed: number): void {
  rect(g, b.x, y0, b.w, 2, C.iron);
  rect(g, b.x, y0 + 3, b.w, 1, C.ironLight);
  rect(g, b.x, y1 - 4, b.w, 4, C.iron);
  const pipeX = b.x + 4 + Math.floor(hash(seed + 2) * (b.w - 8));
  rect(g, pipeX, y0, 3, y1 - y0 - 4, C.ironLight);
  rect(g, pipeX - 1, y0 + 10, 5, 2, C.iron);
  if (hash(seed + 3) < 0.6) {
    const lx = b.x + 12 + Math.floor(hash(seed + 4) * (b.w - 24));
    rect(g, lx, y0 + 2, 1, 9, C.iron);
    rect(g, lx - 2, y0 + 11, 5, 3, hash(seed + 5) < 0.5 ? C.lampWarm : C.stone);
  }
}

/** 집: 벽지(줄무늬나 점무늬)와 가구(탁자·책장·침대·옷장·액자) */
function room(g: CanvasRenderingContext2D, b: FrontBuildingPlace, y0: number, y1: number, seed: number): void {
  const papers = [C.awning, C.paintTeal, C.posterRedDark, C.stoneDark, C.brickDark, C.paintOchre];
  const paper = papers[Math.floor(hash(seed) * papers.length)];
  const striped = hash(seed + 1) < 0.5;
  paintW(g, b.x, y0, b.w, y1 - y0, (x, y) => {
    const on = striped ? (x - b.x) % 8 < 4 : (x + y) % 6 === 0;
    return dither(x, y, on ? 9 : 5) ? paper : C.windowDark;
  });
  rect(g, b.x, y1 - 12, b.w, 1, C.awning);
  shell(g, b, y0, y1, seed);
  const floor = y1 - 4;
  let x = b.x + 4;
  let k = seed + 10;
  while (x < b.x + b.w - 14) {
    const kind = Math.floor(hash(k++) * 6);
    if (kind === 0) {
      rect(g, x, floor - 12, 22, 3, C.awningStripe);
      rect(g, x + 2, floor - 9, 2, 9, C.awning);
      rect(g, x + 18, floor - 9, 2, 9, C.awning);
      rect(g, x + 8, floor - 15, 5, 3, C.paintCream);
      x += 28;
    } else if (kind === 1) {
      rect(g, x, floor - 32, 15, 32, C.awning);
      for (let sy = floor - 29; sy < floor - 2; sy += 8) {
        rect(g, x + 1, sy, 13, 1, C.iron);
        for (let bx = x + 1; bx < x + 14; bx += 2) rect(g, bx, sy - 6, 1, 6, hash(k + bx) < 0.5 ? C.paintCream : C.posterRed);
      }
      x += 20;
    } else if (kind === 2) {
      rect(g, x, floor - 9, 30, 9, C.paintCream);
      rect(g, x, floor - 15, 5, 15, C.awning);
      rect(g, x + 3, floor - 12, 9, 3, C.white);
      x += 36;
    } else if (kind === 3) {
      rect(g, x, floor - 28, 14, 28, C.awningStripe);
      rect(g, x + 6, floor - 28, 1, 28, C.awning);
      x += 19;
    } else if (kind === 4) {
      rect(g, x + 2, y0 + 16, 12, 10, C.paintOchre);
      rect(g, x + 4, y0 + 18, 8, 6, C.stoneDark);
      x += 18;
    } else {
      x += 10;
    }
  }
}

/** 1층 가게: 진열장 선반과 계산대 */
function shopFloor(g: CanvasRenderingContext2D, b: FrontBuildingPlace, y0: number, y1: number, seed: number): void {
  rect(g, b.x, y0, b.w, y1 - y0, C.windowDark);
  ditherRect(g, b.x, y0, b.w, y1 - y0, C.awning, 6);
  shell(g, b, y0, y1, seed);
  for (let sy = y0 + 16; sy < y1 - 20; sy += 14) {
    rect(g, b.x + 4, sy, b.w - 8, 2, C.awningStripe);
    for (let gx = b.x + 6; gx < b.x + b.w - 8; gx += 4) {
      const r = hash(seed + gx * 3 + sy);
      if (r < 0.7) rect(g, gx, sy - 6 + Math.floor(r * 3), 3, 6 - Math.floor(r * 3), r < 0.25 ? C.posterRed : r < 0.5 ? C.paintCream : C.paintTeal);
    }
  }
  const cx = b.x + Math.floor(b.w * 0.2);
  rect(g, cx, y1 - 22, Math.floor(b.w * 0.45), 18, C.awning);
  rect(g, cx, y1 - 22, Math.floor(b.w * 0.45), 2, C.awningStripe);
  rect(g, cx + 6, y1 - 30, 10, 8, C.ironLight);
}

/** 다이너 1층: 긴 계산대와 둥근 의자, 창가 칸막이 자리, 주방 창 */
function dinerFloor(g: CanvasRenderingContext2D, b: FrontBuildingPlace, y0: number, y1: number, seed: number): void {
  rect(g, b.x, y0, b.w, y1 - y0, C.windowDark);
  ditherRect(g, b.x, y0, b.w, y1 - y0, C.paintTeal, 5);
  shell(g, b, y0, y1, seed);
  rect(g, b.x + 6, y0 + 14, b.w - 12, 10, C.iron);
  rect(g, b.x + 8, y0 + 16, b.w - 16, 6, C.windowLit);
  const floor = y1 - 4;
  rect(g, b.x + 10, floor - 18, b.w - 20, 4, C.paintCream);
  rect(g, b.x + 10, floor - 14, b.w - 20, 14, C.awning);
  for (let x = b.x + 14; x < b.x + b.w - 14; x += 14) {
    rect(g, x, floor - 10, 2, 10, C.ironLight);
    rect(g, x - 3, floor - 12, 8, 3, C.posterRed);
  }
  for (let x = b.x + 8; x < b.x + b.w - 30; x += 40) {
    rect(g, x, floor - 30, 6, 30, C.posterRedDark);
    rect(g, x + 22, floor - 30, 6, 30, C.posterRedDark);
    rect(g, x + 6, floor - 14, 16, 3, C.paintCream);
  }
}

/** 극장 안: 층 없이 높은 객석. 층층이 좌석 줄, 붉은 막 무대, 가운데 높이 발코니, 샹들리에 */
function theaterInside(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const top = GROUND - b.h;
  rect(g, b.x, top, b.w, b.h, C.windowDark);
  ditherRect(g, b.x, top, b.w, b.h, C.posterRedDark, 6);
  const sx = b.x + 8;
  rect(g, sx, GROUND - 120, 50, 120, C.iron);
  rect(g, sx + 2, GROUND - 116, 46, 90, C.posterRed);
  for (let x = sx + 4; x < sx + 48; x += 5) rect(g, x, GROUND - 116, 1, 90, C.posterRedDark);
  rect(g, sx, GROUND - 26, 50, 4, C.awningStripe);
  for (let r = 0; r < 6; r++) {
    const y = GROUND - 8 - r * 8;
    for (let x = sx + 60 + r * 10; x < b.x + b.w - 6; x += 6) {
      rect(g, x, y - 6, 4, 6, C.posterRedDark);
      rect(g, x, y - 6, 4, 1, C.posterRed);
    }
  }
  const by = GROUND - Math.floor(b.h * 0.55);
  rect(g, b.x + b.w / 2, by, b.w / 2, 6, C.paintOchre);
  for (let x = b.x + b.w / 2; x < b.x + b.w; x += 6) rect(g, x, by - 6, 4, 6, C.posterRedDark);
  const cx = b.x + Math.floor(b.w * 0.45);
  rect(g, cx, top + 10, 1, 30, C.iron);
  disc(g, cx, top + 44, 8, C.lampWarm, 10);
  disc(g, cx, top + 44, 4, C.lampGlow);
}

/** 계단: 건물 한쪽에 층을 잇는 비스듬한 계단 */
function stairs(g: CanvasRenderingContext2D, b: FrontBuildingPlace, bi: number): void {
  const floors = floorsOf(b);
  if (floors.length < 2) return;
  const left = bi % 2 === 1;
  const sx = b.x + (left ? 10 : b.w - 40);
  for (let f = 0; f < floors.length - 1; f++) {
    const yBottom = floors[f][0] - 4;
    const steps = 14;
    const stepH = Math.floor((floors[f][1] - floors[f][0] - 4) / steps);
    for (let st = 0; st < steps; st++) {
      const stx = left ? sx + st * 2 : sx + 28 - st * 2;
      rect(g, stx, floors[f][1] - 4 - (st + 1) * stepH, 4, stepH, C.stone);
      rect(g, stx, floors[f][1] - 4 - st * stepH, 4, 1, C.stoneDark);
    }
    line(g, left ? sx : sx + 32, floors[f][1] - 10, left ? sx + 28 : sx + 4, yBottom - 6, C.iron);
  }
}
