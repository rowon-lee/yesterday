import type { CityState } from '../../sim';
import { CHUNKS, chunkIndex, chunkStage, FRONT, GRIDS, GROUND, MAP_H, MAP_W, type FrontBuildingPlace } from '../../stage/downtown';
import { COLORS as C } from '../palette';
import { canvas, disc, dither, ditherRect, hash, line, paint, rect } from './dither';
import { floorsOf } from './layers';

/**
 * 건물 파괴 그리기 (렌더 전용). sim의 덩어리 내구도를 보고, 미리 그려 둔 건물 정면 그림에서
 * 모습이 바뀐 덩어리만 다시 칠한다: 금(갈라진 선) → 구멍(벽돌이 떨어져 실내가 조금 보임) →
 * 뚫림(실내가 보임) → 사라짐(뒤쪽 겹이 보임). 실내(벽지·계단·가구·배관)는 처음에 한 번 그려 둔다.
 */
export class CityLayer {
  /** 지금 화면에 쓰는 정면 그림 (덩어리별로 고쳐 그린다) */
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private interior: HTMLCanvasElement;
  /** 덩어리마다 마지막으로 그린 모습 (단계 + 이웃이 뚫렸는지). -1이면 아직 안 그림 */
  private drawn: Int16Array;

  constructor(private pristine: HTMLCanvasElement) {
    [this.canvas, this.g] = canvas(MAP_W, MAP_H);
    this.g.drawImage(pristine, 0, 0);
    this.interior = buildInterior();
    this.drawn = new Int16Array(CHUNKS.length).fill(0);
  }

  /** 상태가 바뀐 덩어리만 다시 그린다 */
  update(city: CityState | null): void {
    const hp = city?.hp;
    for (let i = 0; i < CHUNKS.length; i++) {
      const key = hp ? this.keyOf(hp, i) : 0;
      if (key !== this.drawn[i]) {
        this.drawChunk(i, key);
        this.drawn[i] = key;
      }
    }
  }

  /**
   * 모습 열쇠: 단계 ×256 + 뚫린 이웃(4비트) ×16 + 사라진 이웃(4비트).
   * 이웃 비트: 1 왼쪽, 2 오른쪽, 4 위, 8 아래. 가장자리를 부서진 모양으로 그리려고 이웃까지 본다.
   */
  private keyOf(hp: readonly number[], i: number): number {
    const st = chunkStage(hp[i]);
    if (st === 4) return 4 * 256;
    const k = CHUNKS[i];
    const g = GRIDS[k.b];
    const stageAt = (c: number, r: number) => (c >= 0 && c < g.cols && r >= 0 && r < g.rows ? chunkStage(hp[chunkIndex(g, c, r)]) : 0);
    const nb = [stageAt(k.c - 1, k.r), stageAt(k.c + 1, k.r), stageAt(k.c, k.r + 1), stageAt(k.c, k.r - 1)];
    let open = 0;
    let gone = 0;
    nb.forEach((v, j) => {
      if (v === 3) open |= 1 << j;
      if (v === 4) gone |= 1 << j;
    });
    return st * 256 + open * 16 + gone;
  }

  private drawChunk(i: number, key: number): void {
    const k = CHUNKS[i];
    const g = this.g;
    const x = k.x;
    const y = GROUND - k.y0 - k.h;
    const st = key >> 8;
    const open = (key >> 4) & 15;
    const gone = key & 15;
    // 원래 모습으로 되돌린 뒤 단계를 얹는다
    g.clearRect(x, y, k.w, k.h);
    if (st === 4) return; // 무너져 사라짐: 뒤쪽 겹이 보인다
    g.drawImage(this.pristine, x, y, k.w, k.h, x, y, k.w, k.h);
    const seed = i * 2654435761;
    const r = (j: number) => hash(seed + j * 7919);
    if (st === 3) {
      // 뚫림: 실내가 보이고, 아직 서 있는 이웃 쪽 가장자리는 부서진 벽돌이 삐죽 남는다
      g.drawImage(this.interior, x, y, k.w, k.h, x, y, k.w, k.h);
      const solid = ~(open | gone) & 15;
      this.ragged(x, y, k.w, k.h, solid, (px, py, edge) => {
        if (r(py * 17 + px) < (3 - edge) * 0.3) {
          g.drawImage(this.pristine, x + px, y + py, 1, 1, x + px, y + py, 1, 1);
          if (edge === 2) rect(g, x + px, y + py, 1, 1, C.brickDark);
        }
      });
    } else {
      // 이웃이 뚫렸으면 그쪽 가장자리가 실내로 깨져 들어가고, 사라졌으면 깨져 나간다
      if (open) {
        this.ragged(x, y, k.w, k.h, open, (px, py, edge) => {
          if (r(py * 23 + px + 5) < (3 - edge) * 0.28) g.drawImage(this.interior, x + px, y + py, 1, 1, x + px, y + py, 1, 1);
        });
      }
      if (gone) {
        this.ragged(x, y, k.w, k.h, gone, (px, py, edge) => {
          const v = r(py * 29 + px + 9);
          if (v < (4 - edge) * 0.24) g.clearRect(x + px, y + py, 1, 1);
          else if (edge < 4 && v < (4 - edge) * 0.32) rect(g, x + px, y + py, 1, 1, C.brickDark);
        });
      }
    }
    if (st === 0 || st === 3) return;
    // 금: 벽돌 사이로 갈라진 선 두세 줄
    const cx = x + Math.floor(k.w * (0.3 + r(1) * 0.4));
    const cy = y + Math.floor(k.h * (0.3 + r(2) * 0.4));
    for (let j = 0; j < 3; j++) {
      const a = r(j + 3) * Math.PI * 2;
      const len = 5 + r(j + 6) * 8;
      const mx = Math.round(cx + Math.cos(a) * len * 0.5 + (r(j + 9) - 0.5) * 3);
      const my = Math.round(cy + Math.sin(a) * len * 0.5 + (r(j + 12) - 0.5) * 3);
      line(g, cx, cy, mx, my, C.fxSoot);
      line(g, mx, my, Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len), C.fxSoot);
    }
    if (st === 2) {
      // 구멍: 벽돌이 떨어져 나간 자리로 실내가 조금 보인다. 가장자리는 벽돌 단면
      const rad = 4 + r(20) * 2.5;
      for (let py = -7; py <= 7; py++) {
        for (let px = -7; px <= 7; px++) {
          const d = Math.hypot(px, py * 1.2) + (r(py * 31 + px + 40) - 0.5) * 2.4;
          const X = cx + px;
          const Y = cy + py;
          if (X < x || X >= x + k.w || Y < y || Y >= y + k.h) continue;
          if (d < rad) g.drawImage(this.interior, X, Y, 1, 1, X, Y, 1, 1);
          else if (d < rad + 1.5) rect(g, X, Y, 1, 1, d < rad + 0.8 ? C.brickDark : C.brickLight);
        }
      }
    }
  }

  /**
   * 덩어리 가장자리 픽셀을 훑는다: sides(1 왼쪽, 2 오른쪽, 4 위, 8 아래) 쪽으로 4px 안쪽까지,
   * 그 변에서의 거리(edge)와 함께 fn을 부른다.
   */
  private ragged(_x: number, _y: number, w: number, h: number, sides: number, fn: (px: number, py: number, edge: number) => void): void {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const edge = Math.min(sides & 1 ? px : 9, sides & 2 ? w - 1 - px : 9, sides & 4 ? py : 9, sides & 8 ? h - 1 - py : 9);
        if (edge < 4) fn(px, py, edge);
      }
    }
  }
}

/**
 * 실내 그림 (맵 전체 크기, 건물 정면 자리마다). 건물 종류마다 다르다:
 * 상가·공동주택은 층마다 벽지·가구·계단, 1층 가게는 진열장, 창고는 나무 기둥과 상자,
 * 청사는 돌 벽·책상·서류장·붉은 깃발, 공장은 층 없이 높은 공간에 보일러·톱니바퀴·통로·기중기.
 */
function buildInterior(): HTMLCanvasElement {
  const [c, g] = canvas(MAP_W, MAP_H);
  FRONT.forEach((b, bi) => {
    g.save();
    g.beginPath();
    g.rect(b.x, GROUND - b.h, b.w, b.h);
    g.clip();
    if (b.kind === 'factory') factoryInside(g, b);
    else {
      floorsOf(b).forEach(([y0, y1], fi) => {
        const seed = b.seed * 31 + fi * 7;
        if (b.kind === 'warehouse') storeroom(g, b, y0, y1, seed);
        else if (b.kind === 'hall' || b.kind === 'wing') office(g, b, y0, y1, seed);
        else if (fi === 0 && b.kind === 'shop') shopFloor(g, b, y0, y1, seed);
        else room(g, b, y0, y1, seed);
      });
      if (b.kind !== 'warehouse') stairs(g, b, bi);
    }
    g.restore();
  });
  return c;
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
  paint(g, b.x, y0, b.w, y1 - y0, (x, y) => {
    const on = striped ? (x - b.x) % 8 < 4 : (x + y) % 6 === 0;
    return dither(x, y, on ? 9 : 5) ? paper : C.windowDark;
  });
  rect(g, b.x, y1 - 12, b.w, 1, C.awning); // 걸레받이
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

/** 창고: 나무 기둥과 들보, 쌓인 상자와 자루 */
function storeroom(g: CanvasRenderingContext2D, b: FrontBuildingPlace, y0: number, y1: number, seed: number): void {
  rect(g, b.x, y0, b.w, y1 - y0, C.windowDark);
  ditherRect(g, b.x, y0, b.w, y1 - y0, C.brickDark, 7);
  rect(g, b.x, y0, b.w, 4, C.awning);
  rect(g, b.x, y1 - 4, b.w, 4, C.awning);
  for (let px = b.x + 20; px < b.x + b.w; px += 44) rect(g, px, y0, 5, y1 - y0, C.awning);
  let x = b.x + 4;
  let k = seed;
  while (x < b.x + b.w - 16) {
    const stack = 1 + Math.floor(hash(k++) * 3);
    const s = 14 + Math.floor(hash(k++) * 6);
    for (let i = 0; i < stack; i++) {
      const by = y1 - 4 - (i + 1) * s;
      if (by < y0 + 6) break;
      rect(g, x, by, s, s, C.awningStripe);
      rect(g, x, by, s, 1, C.paintOchre);
      rect(g, x, by, 1, s, C.awning);
      line(g, x + 1, by + 1, x + s - 2, by + s - 2, C.awning);
    }
    x += s + 4 + Math.floor(hash(k++) * 10);
  }
  // 매달린 쇠사슬과 갈고리
  const hx = b.x + Math.floor(hash(seed + 9) * (b.w - 20)) + 10;
  for (let y = y0 + 4; y < y0 + 26; y += 2) rect(g, hx, y, 1, 1, C.ironLight);
  rect(g, hx - 1, y0 + 26, 3, 3, C.ironLight);
}

/** 청사 사무실: 돌 벽 판, 책상과 갓등, 서류장, 붉은 깃발 */
function office(g: CanvasRenderingContext2D, b: FrontBuildingPlace, y0: number, y1: number, seed: number): void {
  rect(g, b.x, y0, b.w, y1 - y0, C.stoneDark);
  ditherRect(g, b.x, y0, b.w, y1 - y0, C.windowDark, 8);
  for (let px = b.x + 6; px < b.x + b.w; px += 30) rect(g, px, y0 + 6, 1, y1 - y0 - 12, C.stone);
  shell(g, b, y0, y1, seed);
  const floor = y1 - 4;
  let x = b.x + 6;
  let k = seed;
  while (x < b.x + b.w - 20) {
    const kind = Math.floor(hash(k++) * 4);
    if (kind === 0) {
      rect(g, x, floor - 14, 26, 3, C.awning);
      rect(g, x + 2, floor - 11, 2, 11, C.awning);
      rect(g, x + 22, floor - 11, 2, 11, C.awning);
      rect(g, x + 16, floor - 20, 1, 6, C.iron);
      rect(g, x + 13, floor - 22, 7, 3, C.paintTeal);
      rect(g, x + 4, floor - 16, 8, 2, C.paintCream);
      x += 32;
    } else if (kind === 1) {
      rect(g, x, floor - 30, 14, 30, C.ironLight);
      for (let dy = floor - 27; dy < floor; dy += 8) rect(g, x + 2, dy, 10, 1, C.iron);
      x += 20;
    } else if (kind === 2 && y1 - y0 > 50) {
      rect(g, x + 4, y0 + 12, 12, 26, C.posterRed);
      rect(g, x + 4, y0 + 10, 12, 2, C.iron);
      x += 22;
    } else {
      x += 12;
    }
  }
}

/** 공장 안: 층 없이 높은 공간. 보일러(불구멍), 톱니바퀴, 가운데 높이의 철제 통로, 천장 기중기 */
function factoryInside(g: CanvasRenderingContext2D, b: FrontBuildingPlace): void {
  const top = GROUND - b.h;
  rect(g, b.x, top, b.w, b.h, C.windowDark);
  ditherRect(g, b.x, top, b.w, b.h, C.brickRedDark, 7);
  // 천장 기중기 들보와 갈고리
  rect(g, b.x, top + 18, b.w, 5, C.iron);
  const hx = b.x + Math.floor(hash(b.seed) * (b.w - 30)) + 15;
  rect(g, hx - 6, top + 23, 12, 5, C.ironLight);
  for (let y = top + 28; y < top + 70; y += 2) rect(g, hx, y, 1, 1, C.ironLight);
  rect(g, hx - 2, top + 70, 5, 4, C.ironLight);
  // 가운데 높이 철제 통로
  const cy = GROUND - Math.floor(b.h * 0.55);
  rect(g, b.x, cy, b.w, 3, C.iron);
  for (let rx = b.x; rx < b.x + b.w; rx += 6) rect(g, rx, cy - 10, 1, 10, C.iron);
  rect(g, b.x, cy - 10, b.w, 1, C.ironLight);
  // 바닥: 보일러, 톱니바퀴, 벨트
  let x = b.x + 8;
  let k = b.seed;
  while (x < b.x + b.w - 30) {
    if (hash(k++) < 0.5) {
      rect(g, x, GROUND - 52, 30, 52, C.ironLight);
      rect(g, x, GROUND - 52, 30, 3, C.iron);
      for (let ry = GROUND - 46; ry < GROUND; ry += 8) rect(g, x + 2, ry, 26, 1, C.iron);
      rect(g, x + 9, GROUND - 22, 12, 10, C.fxFlame);
      rect(g, x + 11, GROUND - 20, 8, 6, C.fxOrange);
      rect(g, x + 12, GROUND - 80, 6, 28, C.iron);
      x += 40;
    } else {
      disc(g, x + 16, GROUND - 30, 15, C.iron);
      disc(g, x + 16, GROUND - 30, 11, C.ironLight);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        rect(g, Math.round(x + 16 + Math.cos(ang) * 14) - 1, Math.round(GROUND - 30 + Math.sin(ang) * 14) - 1, 3, 3, C.iron);
      }
      disc(g, x + 16, GROUND - 30, 3, C.iron);
      line(g, x + 16, GROUND - 45, x + 40, cy + 3, C.awning);
      x += 38;
    }
  }
}

/** 계단: 건물 한쪽에 층을 잇는 비스듬한 계단 */
function stairs(g: CanvasRenderingContext2D, b: FrontBuildingPlace, bi: number): void {
  const floors = floorsOf(b);
  if (floors.length < 2) return;
  const left = bi % 2 === 1;
  const sx = b.x + (left ? 10 : b.w - 40);
  for (let f = 0; f < floors.length - 1; f++) {
    const yBottom = floors[f][0] - 4;
    const rise = floors[f + 1][1] - floors[f + 1][0];
    const steps = 14;
    const stepH = Math.floor((floors[f][1] - floors[f][0] - 4) / steps);
    for (let st = 0; st < steps; st++) {
      const stx = left ? sx + st * 2 : sx + 28 - st * 2;
      rect(g, stx, floors[f][1] - 4 - (st + 1) * stepH, 4, stepH, C.stone);
      rect(g, stx, floors[f][1] - 4 - st * stepH, 4, 1, C.stoneDark);
    }
    line(g, left ? sx : sx + 32, floors[f][1] - 10, left ? sx + 28 : sx + 4, yBottom - 6, C.iron);
    void rise;
  }
}

/** 무너진 자리의 잔해 더미 (월드 좌표, 바닥 위). grow는 0~1: 무너진 직후부터 차오른다 */
export function drawRubble(g: CanvasRenderingContext2D, city: CityState | null, tick: number): void {
  if (!city) return;
  for (const col of city.collapses) {
    const gr = GRIDS[col.b];
    const x0 = gr.x + col.c0 * 16 - 6;
    const x1 = Math.min(gr.x + gr.w, gr.x + (col.c1 + 1) * 16) + 6;
    const grow = Math.min(1, Math.max(0, (tick - col.tick) / 40));
    if (grow <= 0) continue;
    const peak = Math.min(60, 10 + gr.h / 6) * grow;
    const w = x1 - x0;
    const seed = col.b * 977 + col.c0 * 31;
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / w;
      const hgt = Math.round(peak * Math.sin(Math.PI * u) * (0.75 + 0.25 * hash(seed + x)));
      for (let y = 0; y < hgt; y++) {
        const n = hash(seed + x * 131 + y * 17);
        const col2 = n < 0.45 ? C.brickRedDark : n < 0.75 ? C.brickDark : n < 0.9 ? C.stoneDark : C.brickLight;
        g.fillStyle = col2;
        g.fillRect(x, GROUND - 1 - y, 1, 1);
      }
    }
    // 삐져나온 철골과 판자
    for (let j = 0; j < 4; j++) {
      const bx = x0 + Math.floor(hash(seed + j * 3) * w);
      const len = 8 + Math.floor(hash(seed + j * 5) * 14);
      const dir = hash(seed + j * 7) < 0.5 ? -1 : 1;
      line(g, bx, GROUND - Math.round(peak * 0.6), bx + dir * len, GROUND - Math.round(peak * 0.6) - len, j % 2 ? C.iron : C.awning);
    }
  }
}
