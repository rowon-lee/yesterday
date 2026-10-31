import { CITADEL as D } from '../../data/stages/citadel';
import { FLOOR_H, SHOP_H, DOOR_H, DOOR_W, doorOf, escapeOf, type FrontBuildingPlace } from '../../stage/citadel';
import { glyphRows } from '../font';
import { COLORS as C } from '../palette';
import { canvas, ditherRect, hash, line, rect } from '../dither';

/**
 * 2.5D 무대의 도트 텍스처 (렌더 전용, 오프스크린 Canvas 2D에 미리 그린다).
 * 아트 규칙: 같은 창문·벽돌을 되풀이하지 않는다 (건물·창마다 씨앗이 다르다), 얼룩·녹·빗물 자국·찢긴 포스터로 낡게,
 * 창은 일부만 켜고 몇 개는 커튼 그림자나 TV 깜빡임. 형태는 일부러 조금씩 비뚤게.
 * 건물 정면은 싸우는 면보다 뒤(깊이 FRONT_Z)에 있어 화면에서 조금 작게 보이므로, 텍스처 한 칸이 화면 1px이 되게
 * 그 배율(S)로 줄인 크기에 그린다 (도트가 고르게 보이게).
 */

/** 정면 그림 한 장: 바탕(빛을 받는 색), 발광(스스로 빛나는 창), 깜빡이는 TV 창 자리, 빛을 내는 창 자리 */
export interface Facade {
  map: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  /** 텍스처 칸 크기 (가로·세로) */
  tw: number;
  th: number;
  /** TV가 켜진 창 (텍스처 칸 좌표, 위에서 아래로) */
  tvs: Array<{ x: number; y: number; w: number; h: number }>;
  /** 불 켜진 창 (빛 후보, 텍스처 칸 좌표) */
  lit: Array<{ x: number; y: number; warm: boolean }>;
}

const rnd = (seed: number, k: number): number => hash(seed * 7919 + k * 104729);

/** 벽돌 색 묶음: 바탕, 어두운 벽돌, 밝은 벽돌, 줄눈 */
const BRICKS = [
  [C.brick, C.brickDark, C.brickLight, '#2b2124'],
  [C.brickRed, C.brickRedDark, '#5a3d39', '#2e1f1e'],
  ['#3f3a40', '#332f35', '#4a454c', '#232026'],
] as const;

/** 벽돌 벽: 벽돌마다 색이 조금씩 다르고, 가끔 탄 벽돌·땜질 자국 */
export function brickWall(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, seed: number, set = 0): void {
  const [base, dark, light, mortar] = BRICKS[set % BRICKS.length];
  rect(g, x0, y0, w, h, mortar);
  for (let row = 0, y = y0; y < y0 + h; row++, y += 4) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1, x = x0 - off; x < x0 + w; col++, x += 8) {
      const r = rnd(seed + row * 31, col);
      const color = r < 0.62 ? base : r < 0.8 ? dark : r < 0.95 ? light : C.smog1;
      const bx = Math.max(x0, x);
      const bw = Math.min(x + 7, x0 + w) - bx;
      if (bw > 0) rect(g, bx, y, bw, Math.min(3, y0 + h - y), color);
    }
  }
  // 땜질 자국 (다른 벽돌로 메운 네모) 두세 곳
  for (let k = 0; k < 3; k++) {
    if (rnd(seed, 200 + k) < 0.35) continue;
    const pw = 10 + Math.floor(rnd(seed, 210 + k) * 18);
    const ph = 8 + Math.floor(rnd(seed, 220 + k) * 14);
    const px = x0 + Math.floor(rnd(seed, 230 + k) * Math.max(1, w - pw));
    const py = y0 + Math.floor(rnd(seed, 240 + k) * Math.max(1, h - ph));
    ditherRect(g, px, py, pw, ph, k % 2 ? dark : C.stoneDark, 7);
  }
}

/** 낡음: 꼭대기 그을음, 창턱 아래 빗물 자국, 땅 가까운 소금기, 금 */
export function weather(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, seed: number): void {
  // 꼭대기 그을음 (아래로 갈수록 옅게)
  for (let k = 0; k < 4; k++) ditherRect(g, x0, y0 + k * 6, w, 6, C.smog0, 9 - k * 2, seed & 3);
  // 처마에서 흘러내린 빗물 자국 (가늘고 긴 어두운 줄)
  for (let k = 0; k < Math.floor(w / 9); k++) {
    if (rnd(seed, 300 + k) < 0.4) continue;
    const sx = x0 + Math.floor(rnd(seed, 310 + k) * w);
    const len = 20 + Math.floor(rnd(seed, 320 + k) * 70);
    for (let y = 0; y < len; y++) if (hash(seed + sx * 13 + y * 7) < 0.75 - (y / len) * 0.6) rect(g, sx, y0 + 8 + y, 1, 1, C.smog1);
  }
  // 땅 가까운 소금기 얼룩 (밝게 번진 자국)
  ditherRect(g, x0, y0 + h - 14, w, 10, C.stone, 2, seed & 3);
  // 금 (지그재그)
  for (let k = 0; k < 2; k++) {
    if (rnd(seed, 400 + k) < 0.45) continue;
    let cx = x0 + Math.floor(rnd(seed, 410 + k) * w);
    let cy = y0 + Math.floor(rnd(seed, 420 + k) * h * 0.7);
    const n = 12 + Math.floor(rnd(seed, 430 + k) * 20);
    for (let i = 0; i < n; i++) {
      rect(g, cx, cy, 1, 1, C.smog0);
      cy++;
      cx += rnd(seed, 440 + i + k * 50) < 0.5 ? -1 : 1;
    }
  }
}

/** 위층 창 하나 (텍스처 칸 좌표). 상태는 씨앗으로: 꺼짐, 켜짐(커튼·블라인드·사람 그림자), 형광등, TV, 판자, 깨짐 */
function upperWindow(f: Facade, g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  // 일부러 조금씩 비뚤게: 폭·높이·높낮이 ±1
  const jx = rnd(seed, 1) < 0.3 ? 1 : 0;
  const jy = rnd(seed, 2) < 0.3 ? (rnd(seed, 3) < 0.5 ? -1 : 1) : 0;
  const ww = w + (rnd(seed, 4) < 0.25 ? -1 : 0);
  const hh = h + (rnd(seed, 5) < 0.25 ? 2 : 0);
  x += jx;
  y += jy;
  // 상인방 (돌)과 창턱
  rect(g, x - 2, y - 3, ww + 4, 3, C.stoneDark);
  rect(g, x - 2, y - 3, ww + 4, 1, C.stone);
  rect(g, x - 2, y + hh, ww + 5, 2, C.stone);
  rect(g, x - 1, y + hh + 2, ww + 3, 1, C.stoneDark);
  // 창턱 아래 빗물 자국
  for (let k = 0; k < 2; k++) {
    const sx = x + 2 + Math.floor(rnd(seed, 10 + k) * (ww - 3));
    const len = 6 + Math.floor(rnd(seed, 12 + k) * 18);
    for (let yy = 0; yy < len; yy++) if (hash(seed * 3 + sx + yy * 5) < 0.8 - (yy / len) * 0.7) rect(g, sx, y + hh + 3 + yy, 1, 1, C.smog1);
  }
  const r = rnd(seed, 20);
  const frame = rnd(seed, 21) < 0.5 ? C.iron : '#2f2a2a';
  rect(g, x, y, ww, hh, C.windowDark);
  if (r < 0.1) {
    // 판자로 막힘
    for (let py = y + 2; py < y + hh - 2; py += 6) {
      rect(g, x - 1, py, ww + 2, 4, C.awning);
      rect(g, x - 1, py + 3, ww + 2, 1, C.smog1);
    }
    return;
  }
  if (r < 0.14) {
    // 깨진 유리: 어두운 안, 틀에 남은 삐죽한 조각
    for (let k = 0; k < ww; k += 2) rect(g, x + k, y, 1, 1 + Math.floor(rnd(seed, 30 + k) * 5), C.chromeDark);
    rect(g, x + Math.floor(ww / 2) - 1, y, 2, hh, frame);
    return;
  }
  const lit = r > 0.72;
  const tv = r >= 0.66 && r <= 0.72;
  if (tv) {
    // TV만 켜진 어두운 방 (푸르스름한 빛이 깜빡인다: 발광은 따로 그리는 판이 맡는다)
    f.tvs.push({ x, y, w: ww, h: hh });
    ditherRect(g, x, y + hh - 10, ww, 10, C.glassEdge, 6);
  } else if (lit) {
    const warm = rnd(seed, 22) < 0.7;
    const col = warm ? C.windowLit : C.officeLit;
    // 형광등 창은 바탕색이 밝아서 발광은 한 단계 낮춘다 (불 켜진 창이 간판보다 밝지 않게)
    const glowCol = warm ? C.windowLit : '#55645a';
    const hot = warm ? C.windowLight : '#7a8478';
    rect(g, x, y, ww, hh, col);
    rect(e, x, y, ww, hh, glowCol);
    ditherRect(e, x, y, ww, 6, hot, 8);
    f.lit.push({ x: x + ww / 2, y: y + hh / 2, warm });
    const kind = rnd(seed, 23);
    if (kind < 0.35) {
      // 커튼: 양옆으로 젖힌 천과 가운데 사람 그림자 (가끔)
      for (const side of [0, 1]) {
        const cw = 3 + Math.floor(rnd(seed, 24 + side) * 3);
        const cx = side ? x + ww - cw : x;
        rect(g, cx, y, cw, hh, C.posterRedDark);
        rect(e, cx, y, cw, hh, '#120406');
      }
      if (rnd(seed, 26) < 0.5) {
        const px = x + Math.floor(ww / 2) - 2 + Math.floor(rnd(seed, 27) * 3) - 1;
        rect(g, px, y + hh - 22, 5, 22, C.smog1);
        rect(g, px + 1, y + hh - 27, 3, 4, C.smog1);
        rect(e, px, y + hh - 22, 5, 22, '#000000');
        rect(e, px + 1, y + hh - 27, 3, 4, '#000000');
      }
    } else if (kind < 0.6) {
      // 반쯤 내린 블라인드
      const down = 6 + Math.floor(rnd(seed, 28) * (hh - 12));
      for (let yy = y; yy < y + down; yy += 2) {
        rect(g, x, yy, ww, 1, warm ? C.paintOchre : C.chromeDark);
        rect(e, x, yy, ww, 1, warm ? '#3a2410' : '#1d2422');
      }
    } else {
      // 안쪽 가구 그림자 (전등갓·선반)
      rect(g, x + 2, y + hh - 9, ww - 4, 3, C.smog1);
      rect(e, x + 2, y + hh - 9, ww - 4, 3, '#000000');
      if (rnd(seed, 29) < 0.5) {
        rect(g, x + Math.floor(ww / 2) - 2, y + 6, 5, 3, C.paintOchre);
        rect(e, x + Math.floor(ww / 2) - 2, y + 6, 5, 3, C.lampGlow);
      }
    }
  } else {
    // 꺼진 창: 유리에 비친 하늘빛 사선 한 줄
    const d = Math.floor(rnd(seed, 40) * ww);
    for (let k = 0; k < hh; k++) {
      const sx = x + ((d + k) % (ww + 6)) - 3;
      if (sx >= x && sx < x + ww - 1) rect(g, sx, y + k, 2, 1, C.glassEdge);
    }
  }
  // 창살과 가로대
  rect(g, x + Math.floor(ww / 2) - 1, y, 2, hh, frame);
  rect(g, x, y + Math.floor(hh * 0.45), ww, 1, frame);
  rect(e, x + Math.floor(ww / 2) - 1, y, 2, hh, '#000000');
  rect(e, x, y + Math.floor(hh * 0.45), ww, 1, '#000000');
}

/** 찢긴 선전 포스터: 붉은 종이, 별, 구호, 찢겨 벗겨진 귀퉁이와 그 밑의 옛 포스터 */
export function poster(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, seed: number): void {
  // 밑에 깔린 옛 포스터 (누렇게 바랜 종이)
  rect(g, x + 3, y + 4, w, h, C.paintCream);
  ditherRect(g, x + 3, y + 4, w, h, C.paintOchre, 6);
  rect(g, x, y, w, h, C.posterRed);
  rect(g, x, y, w, 1, C.paintCream);
  ditherRect(g, x, y + h - 8, w, 8, C.posterRedDark, 6);
  // 별 문장
  const rows = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'];
  const sx = x + Math.floor(w / 2) - 7;
  rows.forEach((row, ry) => {
    for (let k = 0; k < row.length; k++) if (row[k] === '#') rect(g, sx + k * 2, y + 6 + ry * 2, 2, 2, C.posterRedDark);
  });
  // 구호 (3×5 글꼴 2배)
  const tw = text.length * 8 - 2;
  let cx = x + Math.floor((w - tw) / 2);
  for (const ch of text) {
    const gr = glyphRows(ch);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (gr[r] & (4 >> c)) rect(g, cx + c * 2, y + h - 14 + r * 2, 2, 2, C.paintCream);
    cx += 8;
  }
  // 찢긴 귀퉁이 (아래 오른쪽이 벗겨져 옛 포스터와 벽이 보인다)
  const tear = 6 + Math.floor(rnd(seed, 1) * 8);
  for (let k = 0; k < tear; k++) {
    const len = tear - k + Math.floor(rnd(seed, 10 + k) * 3);
    rect(g, x + w - len, y + h - tear + k, len, 1, k % 3 ? C.paintCream : C.paintOchre);
  }
  // 빗물에 젖은 얼룩
  ditherRect(g, x + 2, y + 2, Math.floor(w * 0.4), Math.floor(h * 0.5), C.posterRedDark, 3, seed & 3);
}

/** 바랜 페인트 광고 (벽돌에 직접 칠한 옛 광고, 반쯤 지워짐) */
function ghostSign(g: CanvasRenderingContext2D, x: number, y: number, text: string, seed: number): void {
  let cx = x;
  for (const ch of text) {
    const gr = glyphRows(ch);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (!(gr[r] & (4 >> c))) continue;
        for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
          if (hash(seed + (cx + c * 4 + xx) * 31 + (y + r * 4 + yy) * 17) < 0.45) rect(g, cx + c * 4 + xx, y + r * 4 + yy, 1, 1, C.paintCream);
        }
      }
    }
    cx += 16;
  }
}

/** 포스터 자리: 글씨가 화면 가장자리에서 잘리지 않게 구간 가운데 쪽 벽에 붙인다 */
function posterX(b: FrontBuildingPlace, tw: number, pw: number, T: (v: number) => number): number {
  const sec = D.sections.find((s) => s.id === b.section)!;
  if (b.posterLeft) return T(8);
  return b.x + b.w / 2 < (sec.x0 + sec.x1) / 2 ? tw - pw - T(8) : T(8);
}

export interface FacadeOpts {
  /** 화면 배율 (깊이 때문에 조금 작게 보이는 비율) */
  s: number;
}

/**
 * 길가 건물 정면. 텍스처 칸 좌표: 위(지붕)가 0, 아래(땅)가 th.
 * 1층(가게·로비·현관), 위층 창, 포스터, 바랜 광고, 낡음.
 */
export function paintFacade(b: FrontBuildingPlace, o: FacadeOpts): Facade {
  const S = o.s;
  const T = (v: number) => Math.round(v * S);
  const tw = T(b.w);
  const th = T(b.h);
  const [map, g] = canvas(tw, th);
  const [glow, e] = canvas(tw, th);
  e.fillStyle = '#000';
  e.fillRect(0, 0, tw, th);
  const f: Facade = { map, glow, tw, th, tvs: [], lit: [] };
  const yOf = (hAbove: number) => th - T(hAbove);
  const set = b.kind === 'theater' ? 1 : Math.floor(rnd(b.seed, 0) * 3);
  brickWall(g, 0, 0, tw, th, b.seed, set);
  weather(g, 0, 0, tw, th, b.seed);
  const shop = yOf(SHOP_H);
  if (b.kind === 'theater') paintTheater(f, g, e, b, T, yOf);
  else {
    // 위층: 층마다 창 (간격은 건물마다 조금 다르게)
    const gap = 26 + Math.floor(rnd(b.seed, 1) * 6);
    const ww = T(18);
    const wh = T(46);
    const cols = Math.max(1, Math.floor((tw - 12) / gap));
    const left = Math.floor((tw - (cols - 1) * gap - ww) / 2);
    // 선전 포스터 자리 (2층, 구간 가운데 쪽): 그 자리의 창은 비운다
    const pw = b.poster && b.floors >= 3 ? Math.max(34, b.poster.length * 8 + 10) : 0;
    const px = posterX(b, tw, pw, T);
    const posterRect = pw ? [px, yOf(SHOP_H + FLOOR_H) + T(22), pw + 4, 50] : null;
    for (let fl = 1; fl < b.floors; fl++) {
      const top = yOf(SHOP_H + fl * FLOOR_H) + T(20);
      rect(g, 0, yOf(SHOP_H + (fl - 1) * FLOOR_H) - 2, tw, 2, C.stoneDark);
      for (let k = 0; k < cols; k++) {
        const wx = left + k * gap;
        if (posterRect && wx + ww + 3 > posterRect[0] && wx - 3 < posterRect[0] + posterRect[2] && top + wh + 3 > posterRect[1] && top - 3 < posterRect[1] + posterRect[3]) continue;
        upperWindow(f, g, e, wx, top, ww, wh, b.seed * 13 + fl * 101 + k * 7);
      }
    }
    // 1층 가게, 다이너, 아파트 현관
    if (b.kind === 'diner') paintDiner(g, e, b, T, yOf);
    else if (b.kind === 'apartment' && !b.sign) paintEntrance(f, g, e, b, T, yOf);
    else paintShop(g, e, b, T, yOf);
    // 처마 바로 아래 돌 띠
    rect(g, 0, shop - 2, tw, 3, C.stoneDark);
  }
  // 선전 포스터 (2층 높이, 찢김)
  if (b.poster && b.floors >= 3 && b.kind !== 'theater') {
    const pw = Math.max(34, b.poster.length * 8 + 10);
    poster(g, posterX(b, tw, pw, T), yOf(SHOP_H + FLOOR_H) + T(22), pw, 46, b.poster, b.seed);
  }
  // 바랜 옛 광고 (빵집 꼭대기 층)
  if (b.sign === 'BAKERY') ghostSign(g, T(10), T(14), 'BREAD', b.seed);
  return f;
}

/** 가게 1층: 진열창 틀(유리는 따로 그리는 판), 문(68), 문 위 채광창, 간판 띠 */
function paintShop(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, b: FrontBuildingPlace, T: (v: number) => number, yOf: (h: number) => number): void {
  const tw = T(b.w);
  const shopTop = yOf(SHOP_H);
  // 간판 띠 (나무판, 차양 위)
  rect(g, 2, shopTop + 2, tw - 4, yOf(78) - shopTop - 2, C.awning);
  rect(g, 2, shopTop + 2, tw - 4, 1, C.awningStripe);
  ditherRect(g, 2, shopTop + 3, tw - 4, yOf(78) - shopTop - 3, C.smog1, 5);
  // 진열창 자리 (유리 판이 덮는다): 안쪽 어둠
  const doorX = T(doorOf(b) - b.x);
  rect(g, T(6), yOf(70), doorX - T(10), T(66), C.iron);
  rect(g, T(8), yOf(68), doorX - T(14), T(62), C.windowDark);
  // 문: 쇠틀, 위 유리, 발차기 판, 손잡이, 문 위 채광창
  const dw = T(DOOR_W);
  const dh = T(DOOR_H);
  const dy = yOf(DOOR_H);
  rect(g, doorX - 1, dy - 6, dw + 2, dh + 6, C.iron);
  rect(g, doorX + 2, dy - 4, dw - 4, 3, C.windowLit);
  rect(e, doorX + 2, dy - 4, dw - 4, 3, C.windowLit);
  rect(g, doorX + 2, dy + 3, dw - 4, Math.floor(dh * 0.45), C.windowDark);
  ditherRect(g, doorX + 2, dy + 3, dw - 4, Math.floor(dh * 0.45), C.windowLit, 4);
  ditherRect(e, doorX + 2, dy + 3, dw - 4, Math.floor(dh * 0.45), C.windowLit, 4);
  rect(g, doorX + 2, dy + dh - 14, dw - 4, 10, C.chromeDark);
  rect(g, doorX + dw - 6, dy + Math.floor(dh * 0.55), 2, 4, C.chrome);
  // 문턱
  rect(g, doorX - 3, yOf(2), dw + 6, T(2), C.stone);
}

/** 현관 문 자리 (건물 왼쪽 끝에서, 월드 px): 비상계단 앞까지의 가운데 */
export function entranceX(b: FrontBuildingPlace): number {
  const esc = escapeOf(b);
  const end = esc ? esc.x0 - 8 - b.x : b.w;
  return Math.floor(end / 2) - 14;
}

/**
 * 아파트 현관 (가게 없는 1층): 돌 상인방, 두 짝 나무 문(위 유리로 복도 불빛), 문 위 채광창, 번지 판,
 * 1층 창 둘과 반지하 창. 현관 계단(돌계단 세 단)은 정면 앞에 상자로 놓는다.
 */
function paintEntrance(f: Facade, g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, b: FrontBuildingPlace, T: (v: number) => number, yOf: (h: number) => number): void {
  const dx = T(entranceX(b));
  // 상인방과 채광창 (복도 불빛)
  rect(g, dx - T(4), yOf(92), T(36), T(6), C.stone);
  rect(g, dx - T(4), yOf(92), T(36), 1, C.paintCream);
  rect(g, dx, yOf(86), T(28), T(4), C.windowLit);
  rect(e, dx, yOf(86), T(28), T(4), C.windowLit);
  for (let k = 1; k < 4; k++) rect(g, dx + T(k * 7), yOf(86), 1, T(4), C.iron);
  // 문틀과 두 짝 문 (위 유리, 아래 판)
  rect(g, dx, yOf(82), T(28), T(70), C.iron);
  for (const lx of [2, 15]) {
    rect(g, dx + T(lx), yOf(80), T(11), T(66), C.awning);
    rect(g, dx + T(lx), yOf(80), 1, T(66), C.awningStripe);
    rect(g, dx + T(lx + 2), yOf(76), T(7), T(22), C.windowDark);
    ditherRect(g, dx + T(lx + 2), yOf(76), T(7), T(22), C.windowLit, 5);
    ditherRect(e, dx + T(lx + 2), yOf(76), T(7), T(22), C.windowLit, 5);
    rect(g, dx + T(lx + 2), yOf(44), T(7), T(16), C.awningStripe);
  }
  rect(g, dx + T(12), yOf(46), 1, T(4), C.chrome);
  rect(g, dx + T(16), yOf(46), 1, T(4), C.chrome);
  // 번지 판
  rect(g, dx + T(30), yOf(70), T(8), T(6), C.chromeDark);
  rect(g, dx + T(31), yOf(69), T(6), T(4), C.paintCream);
  // 1층 창 (문 양옆, 하나는 켜짐)과 반지하 창
  const right = T(entranceX(b) + 44);
  for (const [wx, seed] of [[T(10), 3], [right, 11]] as const) {
    if (wx + T(18) > dx - T(6) && wx < dx + T(34)) continue;
    upperWindow(f, g, e, wx, yOf(78), T(18), T(40), b.seed * 17 + seed);
  }
  rect(g, T(10), yOf(22), T(20), T(14), C.iron);
  rect(g, T(12), yOf(20), T(16), T(10), C.windowDark);
  for (let x = T(13); x < T(28); x += 3) rect(g, x, yOf(20), 1, T(10), C.iron);
}

/** 극장: 돌 기둥, 높은 아치 창 둘(가운데는 세로 간판 자리), 로비 문 넷(차양 아래), 포스터 틀, 매표소 */
function paintTheater(f: Facade, g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, b: FrontBuildingPlace, T: (v: number) => number, yOf: (h: number) => number): void {
  const tw = T(b.w);
  const th = T(b.h);
  // 양옆 돌 기둥 (홈과 줄눈)
  for (const px of [0, tw - 12]) {
    rect(g, px, 0, 12, th, C.stone);
    for (let y = 6; y < th; y += 10) rect(g, px, y, 12, 1, C.stoneDark);
    rect(g, px + 2, 0, 1, th, C.paintCream);
    rect(g, px + 9, 0, 2, th, C.stoneDark);
  }
  // 꼭대기 장식 띠 (전구 받침, 전구는 대부분 죽었다)
  rect(g, 12, 12, tw - 24, 10, C.stoneDark);
  for (let dx = 16; dx < tw - 16; dx += 8) {
    const alive = hash(b.seed + dx) < 0.3;
    rect(g, dx - 1, 16, 3, 3, alive ? C.lampWarm : C.iron);
    if (alive) rect(e, dx - 1, 16, 3, 3, C.lampWarm);
  }
  // 높은 아치 창 둘
  const winTop = 34;
  const winBottom = yOf(98) - 18;
  for (const cx of [38, tw - 38]) {
    const ww = 26;
    for (let y = winTop; y < winBottom; y++) {
      const d = y - winTop;
      const inset = d < 13 ? Math.round(13 - Math.sqrt(169 - (13 - d) ** 2)) : 0;
      rect(g, cx - ww / 2 + inset, y, ww - inset * 2, 1, C.windowDark);
    }
    for (let y = winTop + 14; y < winBottom; y += 12) rect(g, cx - ww / 2, y, ww, 1, C.iron);
    rect(g, cx - 1, winTop + 4, 2, winBottom - winTop - 4, C.iron);
    // 한쪽 창만 아래쪽에 객석 불빛이 새어 나온다
    if (cx < tw / 2) {
      ditherRect(g, cx - ww / 2, winBottom - 46, ww, 46, C.windowLit, 6);
      ditherRect(e, cx - ww / 2, winBottom - 46, ww, 46, C.windowLit, 6);
      f.lit.push({ x: cx, y: winBottom - 20, warm: true });
    }
    rect(g, cx - ww / 2 - 3, winBottom, ww + 6, 3, C.stoneDark);
  }
  // 세로 간판 받침 쇠붙이
  for (let y = 44; y < yOf(98); y += 40) rect(g, Math.floor(tw / 2) - 14, y, 28, 2, C.iron);
  // 1층 로비: 어두운 벽, 문 넷 (차양 아래 66), 포스터 틀 둘, 가운데 매표소
  const lobbyTop = yOf(70);
  rect(g, 12, lobbyTop, tw - 24, T(70), '#2a1c1e');
  for (let i = 0; i < 4; i++) {
    const dx = 36 + i * 26 + (i >= 2 ? 6 : 0);
    rect(g, dx, yOf(66), 20, T(66), C.iron);
    rect(g, dx + 2, yOf(64), 16, T(40), C.windowLit);
    rect(e, dx + 2, yOf(64), 16, T(40), C.windowLit);
    rect(g, dx + 9, yOf(64), 2, T(64), C.iron);
    rect(g, dx + 4, yOf(30), 12, 1, C.chrome);
  }
  for (const px of [14, tw - 34]) {
    rect(g, px, yOf(62), 20, T(44), C.paintOchre);
    rect(g, px + 2, yOf(60), 16, T(40), C.posterRed);
    rect(g, px + 4, yOf(54), 12, 12, C.smog1);
    rect(g, px + 4, yOf(36), 12, 2, C.paintCream);
  }
}

/** 다이너 1층: 법랑 판(크림·청록), 크롬 띠, 둥근 모서리, 긴 진열창 자리, 문 */
function paintDiner(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, b: FrontBuildingPlace, T: (v: number) => number, yOf: (h: number) => number): void {
  const tw = T(b.w);
  const shopTop = yOf(SHOP_H);
  rect(g, 0, shopTop, tw, yOf(0) - shopTop, C.carCream);
  ditherRect(g, 0, shopTop, tw, yOf(0) - shopTop, C.paintCream, 6);
  rect(g, 0, yOf(14), tw, T(14), C.paintTeal);
  for (const y of [shopTop + 4, yOf(78) + 2, yOf(16)]) {
    rect(g, 0, y, tw, 2, C.chrome);
    rect(g, 0, y + 2, tw, 1, C.chromeDark);
  }
  // 긴 진열창 자리 (유리 판이 덮는다)
  const doorX = T(doorOf(b) - b.x);
  rect(g, T(6), yOf(70), doorX - T(10), T(54), C.chromeDark);
  rect(g, T(8), yOf(68), doorX - T(14), T(50), C.windowDark);
  const dw = T(DOOR_W);
  const dy = yOf(DOOR_H);
  rect(g, doorX - 1, dy - 2, dw + 2, T(DOOR_H) + 2, C.chromeDark);
  rect(g, doorX + 2, dy + 2, dw - 4, T(DOOR_H) - 18, C.windowDark);
  ditherRect(g, doorX + 2, dy + 2, dw - 4, T(DOOR_H) - 18, C.windowLit, 6);
  ditherRect(e, doorX + 2, dy + 2, dw - 4, T(DOOR_H) - 18, C.windowLit, 6);
  rect(g, doorX + dw - 6, dy + 30, 2, 6, C.chrome);
  // 법랑 판 녹 (크롬 띠 아래로 흘러내린 녹물)
  for (let k = 0; k < 6; k++) {
    const sx = 4 + Math.floor(rnd(b.seed, 500 + k) * (tw - 8));
    const len = 4 + Math.floor(rnd(b.seed, 510 + k) * 10);
    for (let yy = 0; yy < len; yy++) if (hash(b.seed + sx + yy * 3) < 0.8 - yy / len / 1.5) rect(g, sx, yOf(16) + 3 + yy, 1, 1, C.rust);
  }
}

/** 건물 옆면·뒤: 어두운 벽돌과 그을음 (창 없이) */
export function paintSide(w: number, h: number, seed: number, set: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  brickWall(g, 0, 0, w, h, seed + 5, set);
  ditherRect(g, 0, 0, w, h, C.smog0, 6, seed & 3);
  return c;
}

/** 지붕: 타르 바닥, 자갈, 환기구 */
export function paintRoof(w: number, d: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, d));
  rect(g, 0, 0, w, d, C.smog1);
  ditherRect(g, 0, 0, w, d, C.smog3, 3, seed & 3);
  for (let k = 0; k < 3; k++) rect(g, Math.floor(rnd(seed, 600 + k) * (w - 6)), Math.floor(rnd(seed, 610 + k) * (d - 6)), 6, 6, C.iron);
  return c;
}

/** 돌 처마 앞면: 돌 띠, 이빨 장식, 아래 그늘 */
export function paintCornice(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  rect(g, 0, 0, w, h, C.stone);
  rect(g, 0, 0, w, 1, C.paintCream);
  rect(g, 0, h - 2, w, 2, C.stoneDark);
  for (let x = 2; x < w - 2; x += 6) rect(g, x, h - 4, 3, 2, C.stoneDark);
  ditherRect(g, 0, 1, w, h - 1, C.smog1, 4, seed & 3);
  return c;
}

/** 줄무늬 차양: 앞 드리움(물결 끝)과 윗면 */
export function paintAwning(w: number, h: number, stripe: string, base: string): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  for (let x = 0; x < w; x++) rect(g, x, 0, 1, h - 2, Math.floor(x / 6) % 2 ? stripe : base);
  for (let x = 0; x < w; x += 6) rect(g, x, h - 2, 3, 2, base);
  rect(g, 0, 0, w, 1, C.smog1);
  ditherRect(g, 0, 0, w, h, C.smog1, 4);
  return c;
}

/** 단색 칸 (작은 장식 상자들의 색 팔레트): 16×16칸, 칸마다 한 색 */
export function paintSwatches(colors: readonly string[]): HTMLCanvasElement {
  const [c, g] = canvas(64, 64);
  colors.forEach((col, i) => rect(g, (i % 16) * 4, Math.floor(i / 16) * 4, 4, 4, col));
  return c;
}

/**
 * 네온 관 글씨 (3×5 글꼴, 글자 한 칸 = s px). 관은 칸 가운데를 잇는 이어진 선이다 (가로·세로로 붙은 칸끼리 이어진다).
 * 바탕 텍스처: 어두운 관 둘레(dark)와 꺼진 유리관(희뿌연 속). 발광 텍스처(e): 둘레는 어두운 관 색으로 은은하게, 관은 밝게.
 * e가 없으면 바탕에 밝은 관을 그대로 칠한다 (빛나지 않는 글씨).
 */
export function neonText(
  g: CanvasRenderingContext2D, e: CanvasRenderingContext2D | null, text: string, x: number, y: number, s: number,
  bright: string, dark: string, vertical = false,
): void {
  const t = s >= 4 ? 2 : 1;
  const c0 = Math.floor((s - t) / 2);
  [...text].forEach((ch, k) => {
    const rows = glyphRows(ch);
    const on = (r: number, c: number) => r >= 0 && r < 5 && c >= 0 && c < 3 && (rows[r] & (4 >> c)) !== 0;
    const ox = vertical ? x : x + k * 4 * s;
    const oy = vertical ? y + k * 6 * s : y;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (!on(r, c)) continue;
        rect(g, ox + c * s, oy + r * s, s, s, dark);
        if (e) rect(e, ox + c * s, oy + r * s, s, s, dark);
      }
    }
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (!on(r, c)) continue;
        const cx = ox + c * s + c0;
        const cy = oy + r * s + c0;
        const core = e ? C.smog3 : bright;
        const segs: Array<[number, number, number, number]> = [[cx, cy, t, t]];
        if (on(r, c + 1)) segs.push([cx, cy, s + t, t]);
        if (on(r + 1, c)) segs.push([cx, cy, t, s + t]);
        for (const [sx, sy, sw, sh] of segs) {
          rect(g, sx, sy, sw, sh, core);
          if (e) rect(e, sx, sy, sw, sh, bright);
        }
      }
    }
  });
}

/**
 * 1960년대 세단 옆모습 (길이 w, 높이 h): 두 가지 색, 크롬 띠, 꼬리 날개, 화이트월 바퀴. 발광: 꼬리등.
 * dent: 망가짐 (지붕이 내려앉고 앞유리에 금, 전조등이 깨지고 보닛이 찌그러짐, 꼬리등 꺼짐)
 */
export function paintCar(w: number, h: number, paint: string, seed: number, dent = false): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const [map, g] = canvas(w, h);
  const [glow, e] = canvas(w, h);
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  const base = h - 4;
  // 차체 아래쪽 (낮고 길게)
  rect(g, 2, base - 14, w - 4, 11, paint);
  rect(g, 2, base - 14, w - 4, 1, C.carCream);
  ditherRect(g, 2, base - 8, w - 4, 5, C.smog1, 5);
  // 꼬리 날개 (뒤 = 왼쪽)
  for (let k = 0; k < 12; k++) rect(g, 2 + k, base - 14 - Math.max(0, 5 - Math.floor(k / 2)), 1, Math.max(0, 5 - Math.floor(k / 2)), paint);
  // 크롬 띠, 범퍼
  rect(g, 6, base - 9, w - 12, 1, C.chrome);
  rect(g, 0, base - 6, 5, 3, C.chrome);
  rect(g, w - 5, base - 6, 5, 3, C.chrome);
  // 꼬리등과 전조등
  rect(g, 2, base - 13, 3, 4, C.neonRedDark);
  if (!dent) rect(e, 2, base - 13, 3, 4, C.neonRed);
  rect(g, w - 4, base - 12, 2, 2, dent ? C.iron : C.chromeDark);
  // 객실: 크림 지붕, 앞뒤 유리 (뒤 31%~앞 67%)
  const c0 = Math.round(w * 0.31);
  const c1 = Math.round(w * 0.67);
  const roof = base - (dent ? 22 : 26);
  rect(g, c0, roof, c1 - c0, 2, C.carCream);
  for (let y = roof + 2; y < base - 14; y++) {
    const t = (y - roof) / (base - 14 - roof);
    const l = Math.round(c0 - 10 * t);
    const r = Math.round(c1 + 9 * t);
    rect(g, l, y, 1, 1, C.carCream);
    rect(g, r, y, 1, 1, C.carCream);
    rect(g, l + 1, y, r - l - 1, 1, C.windowDark);
  }
  rect(g, Math.round((c0 + c1) / 2), roof + 2, 2, base - 16 - roof, C.carCream);
  ditherRect(g, c0, roof + 3, c1 - c0, 4, C.glassEdge, 6);
  if (dent) {
    // 앞유리 금, 찌그러진 보닛
    line(g, c1 - 12, roof + 2, c1 - 2, base - 15, C.skyDark);
    line(g, c1 - 6, roof + 2, c1 - 10, base - 15, C.skyDark);
    for (let k = 0; k < 7; k++) rect(g, w - 26 + k * 3, base - 14 + (k % 2), 3, 2, C.iron);
    ditherRect(g, w - 30, base - 13, 26, 6, C.iron, 4);
  }
  // 바퀴 (화이트월)
  for (const wx of [Math.round(w * 0.2), w - Math.round(w * 0.21)]) {
    for (let y = -5; y <= 5; y++) {
      const half = Math.floor(Math.sqrt(30 - y * y));
      rect(g, wx - half, base - 1 + y, half * 2 + 1, 1, C.iron);
    }
    rect(g, wx - 3, base - 4, 7, 7, C.carCream);
    rect(g, wx - 1, base - 2, 3, 3, C.chromeDark);
  }
  // 빗물 얼룩과 녹
  for (let k = 0; k < 5; k++) rect(g, 6 + Math.floor(rnd(seed, 700 + k) * (w - 12)), base - 6 + Math.floor(rnd(seed, 710 + k) * 3), 2, 1, C.rust);
  line(g, 4, base - 3, w - 4, base - 3, C.smog0);
  return { map, glow };
}

/** 타 버린 차 (길이 w, 높이 h): 납작하게 주저앉고, 지붕이 짓눌리고, 바퀴 하나가 빠졌다. 그을음과 녹 */
export function paintCarWreck(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w + 20, h);
  const base = h - 1;
  const x = 4;
  rect(g, x + 2, base - 12, w - 4, 9, C.iron);
  rect(g, x + 24, base - 18, 30, 6, C.iron);
  line(g, x + 2, base - 12, x + 8, base - 16, C.iron);
  rect(g, x + 4, base - 12, w - 8, 1, C.ironLight);
  ditherRect(g, x + 6, base - 10, w - 14, 6, C.rust, 6);
  ditherRect(g, x + 2, base - 18, w - 4, 6, C.fxSoot, 5);
  // 남은 바퀴 (타서 휠만)
  for (let y = -5; y <= 5; y++) {
    const half = Math.floor(Math.sqrt(30 - y * y));
    rect(g, x + 16 - half, base - 4 + y, half * 2 + 1, 1, C.iron);
  }
  rect(g, x + w - 22, base - 2, 12, 3, C.iron);
  // 굴러간 바퀴
  rect(g, x + w + 6, base - 4, 8, 5, C.iron);
  return c;
}

/** 젖은 아스팔트 (가로 x, 세로 z): 금, 빗물 웅덩이(알파 = 젖은 정도), 전차 선로 두 줄 */
export function paintStreet(w: number, d: number, seed: number, rails: readonly number[]): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  rect(g, 0, 0, w, d, C.street);
  ditherRect(g, 0, 0, w, d, C.streetLine, 3);
  for (let k = 0; k < Math.floor(w / 40); k++) {
    let x = Math.floor(rnd(seed, 800 + k) * w);
    let y = Math.floor(rnd(seed, 810 + k) * d);
    for (let i = 0; i < 18; i++) {
      rect(g, x, y, 1, 1, C.smog0);
      x += rnd(seed, 820 + i + k * 30) < 0.5 ? 1 : 2;
      y += rnd(seed, 830 + i + k * 30) < 0.5 ? -1 : 1;
    }
  }
  for (const rz of rails) {
    rect(g, 0, rz, w, 2, C.rail);
    rect(g, 0, rz + 2, w, 1, C.railDark);
  }
  return c;
}

/** 이어 붙여도 이음매가 없는 값 잡음 (빨강 채널 = 0~255). 안개 카드·웅덩이 무늬에 쓴다 */
export function paintNoise(size: number, seed: number, cells: number, octaves = 3): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const val = (ix: number, iy: number, n: number) => hash(seed * 977 + (((ix % n) + n) % n) * 131 + (((iy % n) + n) % n) * 7919 + n * 31);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 1;
      let tot = 0;
      for (let o = 0; o < octaves; o++) {
        const n = cells << o;
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smooth(fx - ix);
        const ty = smooth(fy - iy);
        const a = val(ix, iy, n) * (1 - tx) + val(ix + 1, iy, n) * tx;
        const b = val(ix, iy + 1, n) * (1 - tx) + val(ix + 1, iy + 1, n) * tx;
        v += (a * (1 - ty) + b * ty) * amp;
        tot += amp;
        amp *= 0.5;
      }
      const k = (y * size + x) * 4;
      const byte = Math.round((v / tot) * 255);
      img.data[k] = byte;
      img.data[k + 1] = byte;
      img.data[k + 2] = byte;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** 웅덩이 무늬: 잡음의 높은 곳만 (젖은 정도 0~255, 경계는 디더링으로 끊어지게) */
export function paintPuddles(size: number, seed: number): HTMLCanvasElement {
  const n = paintNoise(size, seed, 4, 2);
  const g = n.getContext('2d')!;
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const v = img.data[i * 4] / 255;
    const bay = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((Math.floor(i / size) & 3) << 2) | (i % size & 3)] / 16;
    const w = v > 0.62 ? 1 : v > 0.52 && (v - 0.52) / 0.1 > bay ? 0.6 : 0.15;
    const b = Math.round(w * 255);
    img.data[i * 4] = b;
    img.data[i * 4 + 1] = b;
    img.data[i * 4 + 2] = b;
  }
  g.putImageData(img, 0, 0);
  return n;
}
