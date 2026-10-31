import type { CityState } from '../../sim';
import { CHUNKS, chunkIndex, chunkStage, FLOOR_H, FRONT, GRIDS, GROUND, MAP_H, MAP_W, SHOP_H } from '../../stage/downtown';
import { COLORS as C } from '../palette';
import { canvas, dither, hash, line, rect } from './dither';

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

/** 실내 그림 (맵 전체 크기, 건물 정면 자리마다). 층마다 벽지, 바닥판, 가구, 계단, 배관 */
function buildInterior(): HTMLCanvasElement {
  const [c, g] = canvas(MAP_W, MAP_H);
  const papers = [C.awning, C.paintTeal, C.posterRedDark, C.stoneDark, C.brickDark, C.paintOchre];
  FRONT.forEach((b, bi) => {
    const top = GROUND - b.h;
    // 층 경계 (바닥에서 위로): 1층 가게, 그 위로 FLOOR_H씩
    const floors: Array<[number, number]> = [[GROUND - SHOP_H, GROUND]];
    for (let f = 0; f < b.floors; f++) floors.push([GROUND - SHOP_H - (f + 1) * FLOOR_H, GROUND - SHOP_H - f * FLOOR_H]);
    floors.push([top, GROUND - SHOP_H - b.floors * FLOOR_H]);
    floors.forEach(([y0, y1], fi) => {
      if (y1 <= y0) return;
      const seed = b.seed * 31 + fi * 7;
      const paper = papers[Math.floor(hash(seed) * papers.length)];
      // 벽지: 바탕 + 세로 줄무늬나 점무늬 (어둡게 디더링)
      rect(g, b.x, y0, b.w, y1 - y0, C.windowDark);
      for (let y = y0; y < y1; y++) {
        for (let x = b.x; x < b.x + b.w; x++) {
          const stripe = hash(seed + 1) < 0.5 ? (x - b.x) % 6 < 3 : (x + y) % 5 === 0;
          if (dither(x, y, stripe ? 9 : 5)) {
            g.fillStyle = paper;
            g.fillRect(x, y, 1, 1);
          }
        }
      }
      // 천장 밑 배관과 바닥판
      rect(g, b.x, y0, b.w, 2, C.iron);
      rect(g, b.x, y0 + 3, b.w, 1, C.ironLight);
      rect(g, b.x, y1 - 3, b.w, 3, C.iron);
      const pipeX = b.x + 4 + Math.floor(hash(seed + 2) * (b.w - 8));
      rect(g, pipeX, y0, 2, y1 - y0 - 3, C.ironLight);
      rect(g, pipeX - 1, y0 + 8, 4, 2, C.iron);
      // 매달린 전구 (몇 개만 켜짐)
      if (hash(seed + 3) < 0.5) {
        const lx = b.x + 10 + Math.floor(hash(seed + 4) * (b.w - 20));
        rect(g, lx, y0 + 2, 1, 6, C.iron);
        rect(g, lx - 1, y0 + 8, 3, 2, hash(seed + 5) < 0.5 ? C.lampWarm : C.stone);
      }
      // 가구: 바닥 위에 놓인 탁자·책장·침대·옷장
      let x = b.x + 3;
      let k = seed + 10;
      while (x < b.x + b.w - 10) {
        const kind = Math.floor(hash(k++) * 5);
        const floor = y1 - 3;
        if (kind === 0) {
          rect(g, x, floor - 8, 14, 2, C.awningStripe);
          rect(g, x + 1, floor - 6, 1, 6, C.awning);
          rect(g, x + 12, floor - 6, 1, 6, C.awning);
          x += 18;
        } else if (kind === 1) {
          rect(g, x, floor - 22, 10, 22, C.awning);
          for (let sy = floor - 20; sy < floor - 2; sy += 6) {
            rect(g, x + 1, sy, 8, 1, C.iron);
            for (let bx = x + 1; bx < x + 9; bx += 2) rect(g, bx, sy - 4, 1, 4, hash(k + bx) < 0.5 ? C.paintCream : C.posterRed);
          }
          x += 14;
        } else if (kind === 2) {
          rect(g, x, floor - 6, 20, 6, C.paintCream);
          rect(g, x, floor - 10, 4, 10, C.awning);
          rect(g, x + 2, floor - 8, 6, 2, C.white);
          x += 24;
        } else if (kind === 3) {
          rect(g, x, floor - 18, 9, 18, C.awningStripe);
          rect(g, x + 4, floor - 18, 1, 18, C.awning);
          x += 13;
        } else {
          x += 8;
        }
      }
    });
    // 계단: 건물 한쪽에 층을 잇는 비스듬한 계단
    if (b.floors >= 2) {
      const sx = b.x + (bi % 2 ? 8 : b.w - 28);
      for (let f = 0; f < b.floors; f++) {
        const yBottom = GROUND - SHOP_H - f * FLOOR_H - 3;
        for (let st = 0; st < 10; st++) {
          const stx = bi % 2 ? sx + st * 2 : sx + 20 - st * 2;
          rect(g, stx, yBottom - st * 3 - 3, 3, 3, C.stone);
          rect(g, stx, yBottom - st * 3, 3, 1, C.stoneDark);
        }
        line(g, bi % 2 ? sx : sx + 22, yBottom - 4, bi % 2 ? sx + 20 : sx + 2, yBottom - 34, C.iron);
      }
    }
  });
  return c;
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
    const peak = Math.min(46, 10 + gr.h / 6) * grow;
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
