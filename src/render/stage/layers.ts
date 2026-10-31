import { DOWNTOWN as D } from '../../data/stages/downtown';
import { drawText, textWidth } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { doorOf, frontBuildings, type FrontBuildingPlace } from '../../stage/downtown';
import { canvas, disc, dither, ditherRect, hash, line, rect } from './dither';

/** 겹 하나: 미리 그려 둔 그림과 카메라 대비 움직이는 비율 */
export interface Layer {
  canvas: HTMLCanvasElement;
  speed: number;
}

/** 이 겹이 화면 끝까지 덮으려면 필요한 폭 */
export const spanOf = (speed: number): number => Math.ceil(SCREEN_W + (D.width - SCREEN_W) * speed);

// ---------------------------------------------------------------- 하늘
export function buildSky(): Layer {
  const [c, g] = canvas(SCREEN_W, SCREEN_H);
  // 위는 어둡고 지평선으로 갈수록 매연이 뿌옇게: 띠 사이를 디더링으로 잇는다
  const bands = [C.smog0, C.smog1, C.smog2, C.smog3, C.smogHaze];
  const top = 0;
  const bottom = 136;
  for (let y = 0; y < SCREEN_H; y++) {
    const f = Math.max(0, Math.min(bands.length - 1.001, ((y - top) / (bottom - top)) * (bands.length - 1)));
    const i = Math.floor(f);
    const level = Math.round((f - i) * 16);
    for (let x = 0; x < SCREEN_W; x++) {
      g.fillStyle = dither(x, y, level) ? bands[i + 1] : bands[i];
      g.fillRect(x, y, 1, 1);
    }
  }
  // 매연에 가린 흐린 해
  disc(g, D.sun.x, D.sun.y, D.sun.r + 3, C.sunDim, 4);
  disc(g, D.sun.x, D.sun.y, D.sun.r, C.sunDim, 10);
  disc(g, D.sun.x, D.sun.y, D.sun.r - 4, C.sunDim, 16);
  // 해를 가로지르는 매연 띠
  for (const [y, h, lv] of [[54, 3, 9], [62, 2, 11], [69, 4, 7], [40, 2, 5], [90, 3, 6]] as const) {
    ditherRect(g, 0, y, SCREEN_W, h, C.smog2, lv);
  }
  return { canvas: c, speed: 0 };
}

// ---------------------------------------------------------------- 먼 공장 지대
export function buildFactories(): Layer {
  const F = D.factories;
  const w = spanOf(F.speed);
  const [c, g] = canvas(w, SCREEN_H);
  let x = -6;
  let k = F.seed;
  while (x < w) {
    const bw = 30 + Math.floor(hash(k++) * 40);
    const bh = 14 + Math.floor(hash(k++) * 22);
    const top = F.base - bh;
    rect(g, x, top, bw, SCREEN_H - top, C.factory);
    // 톱니 지붕
    if (hash(k++) < 0.6) {
      for (let t = 0; t < bw - 6; t += 8) {
        for (let s = 0; s < 6; s++) rect(g, x + t + s, top - 6 + s, 1, 6 - s, C.factory);
      }
    }
    // 드문드문 켜진 공장 창
    for (let wx = x + 3; wx < x + bw - 3; wx += 4) if (hash(k++) < 0.08) rect(g, wx, top + 6, 2, 1, C.skylineLit);
    x += bw + Math.floor(hash(k++) * 6);
  }
  for (const ch of F.chimneys) {
    rect(g, ch.x, ch.top, ch.w, F.base - ch.top, C.factory);
    rect(g, ch.x - 1, ch.top, ch.w + 2, 2, C.factory);
    // 굴뚝 띠
    rect(g, ch.x, ch.top + 6, ch.w, 1, C.smog1);
  }
  return { canvas: c, speed: F.speed };
}

// ---------------------------------------------------------------- 먼 시가지
export function buildSkyline(): Layer {
  const S = D.skyline;
  const w = spanOf(S.speed);
  const [c, g] = canvas(w, SCREEN_H);
  let x = -4;
  let k = S.seed;
  while (x < w) {
    const bw = 14 + Math.floor(hash(k++) * 22);
    const bh = 24 + Math.floor(hash(k++) * 52);
    const top = S.base - bh;
    rect(g, x, top, bw, SCREEN_H - top, C.skylineFar);
    // 지붕: 급수탑 또는 처마
    const r = hash(k++);
    if (r < 0.3) waterTower(g, x + 3 + Math.floor(hash(k++) * (bw - 10)), top, C.skylineFar, 0.7);
    else if (r < 0.55) rect(g, x - 1, top, bw + 2, 2, C.skylineFar);
    for (let wy = top + 4; wy < S.base - 2; wy += 5) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (hash(k++) < 0.07) rect(g, wx, wy, 1, 2, C.skylineLit);
    }
    x += bw + Math.floor(hash(k++) * 3);
  }
  return { canvas: c, speed: S.speed };
}

function waterTower(g: CanvasRenderingContext2D, x: number, top: number, color: string, scale = 1): void {
  const tw = Math.round(9 * scale);
  const th = Math.round(8 * scale);
  const legs = Math.round(6 * scale);
  // 다리
  line(g, x + 1, top, x + 1, top - legs, color);
  line(g, x + tw - 2, top, x + tw - 2, top - legs, color);
  line(g, x + 1, top - 1, x + tw - 2, top - legs + 1, color);
  // 통과 고깔 지붕
  rect(g, x, top - legs - th, tw, th, color);
  for (let i = 0; i < Math.ceil(tw / 2); i++) rect(g, x + i, top - legs - th - i, tw - i * 2, 1, color);
}

// ---------------------------------------------------------------- 가운데: 높은 벽돌 건물, 벽 간판, 감시탑
export function buildMid(): Layer {
  const M = D.mid;
  const w = spanOf(M.speed);
  const [c, g] = canvas(w, SCREEN_H);
  let x = -6;
  let k = M.seed;
  let index = 0;
  while (x < w) {
    const bw = 34 + Math.floor(hash(k++) * 30);
    const bh = 70 + Math.floor(hash(k++) * 60);
    const top = M.base - bh;
    const red = hash(k++) < 0.4;
    const base = red ? C.brickRedDark : C.brickDark;
    rect(g, x, top, bw, SCREEN_H - top, base);
    // 처마 돌띠
    rect(g, x - 1, top, bw + 2, 2, C.stoneDark);
    // 창: 층마다 한 줄
    for (let wy = top + 6; wy < M.base - 8; wy += 10) {
      for (let wx = x + 3; wx < x + bw - 4; wx += 6) {
        const r = hash(k++);
        rect(g, wx, wy, 3, 5, r < 0.12 ? C.windowLit : C.windowDark);
      }
    }
    // 옥상 급수탑
    if (hash(k++) < 0.45) waterTower(g, x + 4 + Math.floor(hash(k++) * (bw - 14)), top, C.iron);
    // 칠한 벽 간판 (색이 바래 벽돌과 섞인다)
    const sign = M.wallSigns.find((s) => s.building === index);
    if (sign) {
      const tw = textWidth(sign.text);
      const sx = x + Math.floor((bw - tw - 6) / 2);
      const sy = top + 10;
      ditherRect(g, sx, sy, tw + 6, 11, index % 2 ? C.paintTeal : C.paintOchre, 12);
      drawText(g, sign.text, sx + 3, sy + 3, C.paintCream);
    }
    x += bw + 2 + Math.floor(hash(k++) * 4);
    index++;
  }
  watchtower(g, M.tower.x, M.tower.top, M.base);
  return { canvas: c, speed: M.speed };
}

/** 감시탑: 철골 다리, 꼭대기 초소와 서치라이트 (빛줄기는 매 프레임 따로 그린다) */
function watchtower(g: CanvasRenderingContext2D, x: number, top: number, base: number): void {
  const legW = 14;
  const cab = top + 10;
  // 다리 두 개가 위로 갈수록 좁아진다
  line(g, x, base, x + 3, cab, C.iron);
  line(g, x + legW, base, x + legW - 3, cab, C.iron);
  line(g, x + 1, base, x + 4, cab, C.iron);
  line(g, x + legW - 1, base, x + legW - 4, cab, C.iron);
  // X자 버팀
  for (let y = cab + 4; y < base - 8; y += 14) {
    const t0 = (y - cab) / (base - cab);
    const t1 = (y + 14 - cab) / (base - cab);
    const l0 = x + 3 - 3 * t0;
    const r0 = x + legW - 3 + 3 * t0;
    const l1 = x + 3 - 3 * t1;
    const r1 = x + legW - 3 + 3 * t1;
    line(g, l0, y, r1, y + 14, C.iron);
    line(g, r0, y, l1, y + 14, C.iron);
    line(g, l0, y, r0, y, C.ironLight);
  }
  // 초소
  rect(g, x - 2, top + 2, legW + 4, 8, C.iron);
  rect(g, x - 1, top + 4, legW + 2, 3, C.windowDark);
  rect(g, x + 4, top + 4, 3, 3, C.windowLit);
  rect(g, x - 4, top, legW + 8, 2, C.ironLight);
  // 서치라이트 통
  rect(g, x + legW - 1, top - 4, 5, 4, C.ironLight);
  rect(g, x + legW + 3, top - 4, 1, 4, C.beam);
}

/** 감시탑 서치라이트가 빛을 내는 곳 (가운데 겹 좌표) */
export const SEARCHLIGHT = { x: D.mid.tower.x + 14 + 4, y: D.mid.tower.top - 2 };

// ---------------------------------------------------------------- 앞: 길가 건물
export function buildFront(): Layer {
  const w = spanOf(D.front.speed);
  const [c, g] = canvas(w, SCREEN_H);
  for (const b of frontBuildings()) building(g, b.x, D.ground, b, b.seed);
  return { canvas: c, speed: D.front.speed };
}

type FrontBuilding = FrontBuildingPlace;

function building(g: CanvasRenderingContext2D, x: number, ground: number, b: FrontBuilding, seed: number): void {
  const top = ground - b.h;
  const red = hash(seed) < 0.5;
  const base = red ? C.brickRed : C.brick;
  const mortar = red ? C.brickRedDark : C.brickDark;
  rect(g, x, top, b.w, b.h, base);
  // 벽돌 줄눈: 3줄마다 가로, 엇갈린 세로
  for (let y = top + 2; y < ground; y += 3) {
    rect(g, x, y, b.w, 1, mortar);
    const off = ((y - top) / 3) % 2 ? 3 : 0;
    for (let jx = x + off; jx < x + b.w; jx += 6) if (hash(seed + jx * 7 + y) < 0.5) rect(g, jx, y - 2, 1, 2, mortar);
  }
  // 그늘: 건물 왼쪽 가장자리를 한 단계 어둡게, 오른쪽 위를 밝게
  rect(g, x, top, 1, b.h, mortar);
  rect(g, x + b.w - 1, top, 1, b.h, C.brickLight);
  // 처마: 돌 띠와 받침
  rect(g, x - 1, top, b.w + 2, 3, C.stone);
  rect(g, x - 1, top + 3, b.w + 2, 1, C.stoneDark);
  for (let dx = x + 1; dx < x + b.w - 1; dx += 4) rect(g, dx, top + 4, 2, 1, C.stoneDark);

  // 위층 창 (1층 가게 위부터)
  const shopTop = ground - 30;
  const floors: number[] = [];
  for (let wy = top + 9; wy + 11 < shopTop - 4; wy += 14) floors.push(wy);
  let k = seed;
  for (const wy of floors) {
    for (let wx = x + 5; wx + 6 < x + b.w - 3; wx += 10) {
      const r = hash(k++);
      rect(g, wx - 1, wy - 1, 7, 1, C.stone); // 상인방
      rect(g, wx, wy, 5, 9, C.windowDark);
      if (r < 0.18) {
        // 불 켜진 창 (아랫부분만 밝게, 위는 커튼 그늘)
        rect(g, wx, wy + 3, 5, 6, C.windowLit);
        ditherRect(g, wx, wy + 3, 5, 2, C.windowLight, 4);
      } else if (r < 0.28) {
        // 판자로 막은 창
        line(g, wx, wy, wx + 4, wy + 8, C.awning);
        line(g, wx + 4, wy, wx, wy + 8, C.awning);
      }
      rect(g, wx + 2, wy, 1, 9, C.iron); // 창살
      rect(g, wx - 1, wy + 9, 7, 1, C.stoneDark); // 창턱
    }
  }

  // 철제 비상계단: 층마다 발판과 난간, 사이를 비스듬한 계단
  if (b.escape && floors.length > 1) {
    const ew = Math.min(22, b.w - 10);
    const ex = x + b.w - ew - 3;
    floors.forEach((wy, n) => {
      const py = wy + 10;
      rect(g, ex, py, ew, 1, C.iron);
      rect(g, ex, py - 4, ew, 1, C.ironLight);
      for (let rx = ex; rx < ex + ew; rx += 3) rect(g, rx, py - 4, 1, 4, C.iron);
      const next = floors[n + 1];
      if (next !== undefined) {
        const ny = next + 10;
        if (n % 2) line(g, ex + 2, py, ex + ew - 4, ny, C.iron);
        else line(g, ex + ew - 3, py, ex + 3, ny, C.iron);
      }
    });
    // 접힌 사다리
    const last = floors[floors.length - 1] + 10;
    rect(g, ex + 2, last, 1, 8, C.iron);
    rect(g, ex + 5, last, 1, 8, C.iron);
    for (let ly = last + 2; ly < last + 8; ly += 2) rect(g, ex + 2, ly, 4, 1, C.iron);
  }

  // 1층 가게: 쇼윈도, 문, 차양, 칠한 간판
  rect(g, x + 1, shopTop, b.w - 2, 30, C.brickDark);
  const doorX = doorOf(b);
  // 쇼윈도: 유리는 부서지는 물건이라 render/stage/props.ts가 그린다. 여기는 틀만
  rect(g, x + 3, shopTop + 9, doorX - x - 6, 20, C.stoneDark);
  rect(g, x + 3, shopTop + 29, doorX - x - 6, 1, C.stone);
  rect(g, doorX, shopTop + 8, 7, 22, C.iron);
  rect(g, doorX + 1, shopTop + 10, 5, 8, C.windowDark);
  // 차양: 줄무늬, 앞으로 기울어짐
  for (let ax = x + 2; ax < x + b.w - 2; ax++) {
    const stripe = Math.floor((ax - x) / 4) % 2 ? C.awningStripe : C.awning;
    rect(g, ax, shopTop + 4, 1, 5, stripe);
  }
  rect(g, x + 2, shopTop + 9, b.w - 4, 1, C.iron);
  // 간판 판
  if (b.shop) {
    const tw = textWidth(b.shop);
    const sx = x + Math.floor((b.w - tw - 6) / 2);
    rect(g, sx, shopTop - 6, tw + 6, 9, C.iron);
    rect(g, sx + 1, shopTop - 5, tw + 4, 7, seed % 3 ? C.paintTeal : C.paintOchre);
    drawText(g, b.shop, sx + 3, shopTop - 4, C.paintCream);
  }

  // 선전 포스터: 벽에 붙은 붉은 종이, 주먹 그림과 구호
  if (b.poster) {
    const pw = Math.max(16, textWidth(b.poster) + 6);
    const ph = 24;
    const px = x + 4;
    const py = shopTop - 12 - ph;
    if (py > top + 5) {
      rect(g, px, py, pw, ph, C.posterRed);
      rect(g, px, py, pw, 1, C.paintCream);
      rect(g, px, py + ph - 1, pw, 1, C.posterRedDark);
      star(g, px + Math.floor(pw / 2), py + 8);
      drawText(g, b.poster, px + Math.floor((pw - textWidth(b.poster)) / 2), py + ph - 7, C.paintCream);
      // 찢어진 귀퉁이
      rect(g, px + pw - 3, py + ph - 3, 3, 3, base);
      rect(g, px + pw - 2, py + ph - 4, 2, 1, base);
    }
  }
}

/** 포스터의 별 문장 (가운데 cx, cy) */
function star(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  const rows = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rect(g, cx - 3 + x, cy - 3 + y, 1, 1, C.posterRedDark);
  });
}

// ---------------------------------------------------------------- 거리
export function buildStreet(): Layer {
  const w = D.width;
  const [c, g] = canvas(w, SCREEN_H);
  const y0 = D.ground;
  // 보도: 판석 이음매
  rect(g, 0, y0, w, 6, C.sidewalk);
  for (let x = 0; x < w; x += 16) rect(g, x, y0 + 1, 1, 5, C.sidewalkJoint);
  rect(g, 0, y0, w, 1, C.curb);
  // 연석과 차도 (자갈 무늬)
  rect(g, 0, y0 + 6, w, 1, C.curb);
  rect(g, 0, y0 + 7, w, SCREEN_H - y0 - 7, C.street);
  ditherRect(g, 0, y0 + 8, w, SCREEN_H - y0 - 8, C.streetLine, 3);
  // 노면전차 선로 두 줄
  for (const ry of [y0 + 12, y0 + 17]) {
    rect(g, 0, ry, w, 1, C.rail);
    rect(g, 0, ry + 1, w, 1, C.railDark);
  }
  for (const p of D.street.props) prop(g, p.kind, p.x, y0, 'text' in p ? p.text : '');
  return { canvas: c, speed: 1 };
}

function prop(g: CanvasRenderingContext2D, kind: string, x: number, ground: number, text: string): void {
  switch (kind) {
    case 'hydrant':
      rect(g, x, ground - 9, 5, 9, C.posterRedDark);
      rect(g, x - 1, ground - 7, 7, 2, C.posterRedDark);
      rect(g, x + 1, ground - 11, 3, 2, C.posterRedDark);
      rect(g, x + 1, ground - 9, 1, 8, C.posterRed);
      break;
    case 'mailbox':
      rect(g, x, ground - 14, 8, 11, C.paintTeal);
      rect(g, x, ground - 15, 8, 1, C.ironLight);
      rect(g, x + 2, ground - 12, 4, 1, C.iron);
      rect(g, x + 1, ground - 3, 1, 3, C.iron);
      rect(g, x + 6, ground - 3, 1, 3, C.iron);
      break;
    case 'barrel':
      rect(g, x, ground - 12, 9, 12, C.awning);
      rect(g, x, ground - 10, 9, 1, C.iron);
      rect(g, x, ground - 4, 9, 1, C.iron);
      rect(g, x + 7, ground - 12, 1, 12, C.awningStripe);
      break;
    case 'newsstand':
      rect(g, x, ground - 22, 22, 22, C.awning);
      rect(g, x - 1, ground - 24, 24, 2, C.iron);
      rect(g, x + 2, ground - 19, 18, 9, C.windowDark);
      // 신문 더미와 붙은 포스터
      for (let i = 0; i < 4; i++) rect(g, x + 3 + i * 4, ground - 18, 3, 7, i % 2 ? C.paintCream : C.stone);
      rect(g, x + 2, ground - 8, 18, 1, C.iron);
      drawText(g, 'NEWS', x + 4, ground - 7, C.paintCream);
      break;
    case 'posterboard': {
      // 선전 포스터 게시판: 두 기둥 위 판에 붉은 포스터
      const pw = Math.max(18, textWidth(text) + 8);
      const top = ground - 46;
      rect(g, x + 2, top + 26, 2, 20, C.iron);
      rect(g, x + pw - 4, top + 26, 2, 20, C.iron);
      rect(g, x, top, pw, 28, C.iron);
      rect(g, x + 1, top + 1, pw - 2, 26, C.posterRed);
      rect(g, x + 1, top + 1, pw - 2, 1, C.paintCream);
      star(g, x + Math.floor(pw / 2), top + 8);
      drawText(g, text, x + Math.floor((pw - textWidth(text)) / 2), top + 18, C.paintCream);
      // 찢어져 펄럭이는 귀퉁이
      rect(g, x + pw - 5, top + 22, 4, 5, C.iron);
      rect(g, x + pw - 5, top + 21, 2, 1, C.posterRedDark);
      break;
    }
    case 'barricade': {
      // 검문소 바리케이드: 모래주머니와 철조망, 나무 받침대
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 4 - row; i++) {
          const bx = x + 2 + i * 9 + row * 4;
          const by = ground - 5 - row * 5;
          rect(g, bx, by, 9, 5, C.sandbag);
          rect(g, bx, by + 4, 9, 1, C.awning);
          rect(g, bx, by, 1, 5, C.awning);
        }
      }
      rect(g, x + 6, ground - 28, 26, 2, C.awningStripe);
      line(g, x + 6, ground - 26, x + 2, ground - 15, C.awning);
      line(g, x + 31, ground - 26, x + 35, ground - 15, C.awning);
      // 철조망 고리
      for (let i = 0; i < 6; i++) {
        const cx = x + 5 + i * 6;
        const cy = ground - 32;
        line(g, cx - 3, cy, cx, cy - 3, C.wire);
        line(g, cx, cy - 3, cx + 3, cy, C.wire);
        line(g, cx - 3, cy, cx + 3, cy + 2, C.wire);
      }
      break;
    }
  }
}
