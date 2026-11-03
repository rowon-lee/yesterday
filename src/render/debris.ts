import { COLORS } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';
import { GROUND as GROUND_Y } from '../stage/citadel';

/** 부서질 때 튀는 조각 (렌더 전용): 유리, 종이, 물방울, 철 조각. 바닥에 닿으면 사라진다 (남는 잔해는 물건 그림이 그린다) */
interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  /** 종이처럼 팔랑이며 천천히 떨어지는가 */
  flutter: boolean;
  /** 덩어리 크기 (px, 1이면 점). 2 이상이면 윗변 1px이 빛을 받는다 */
  w: number;
  h: number;
  /** 윗변 색 (덩어리만) */
  top: string;
  /** 바닥에 닿으면 몇 번 더 튀는가, 다 튀고 나면 바닥에 남아 있는 틱 (잔해) */
  bounce: number;
  rest: number;
  /** 바닥에 내려앉아 쉬는 중 */
  resting?: boolean;
}

export type DebrisKind = 'glass' | 'paper' | 'water' | 'metal' | 'brick' | 'concrete' | 'wood' | 'sand';

/** 렌더 전용 고정 난수 */
function rand(n: number): number {
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
  n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

/** 무너질 때 떨어지는 벽 조각 (판정 없음). 건물 정면 그림(src)에서 잘라 온 그대로 떨어진다 */
interface Block {
  /** 잘라 온 자리 (정면 그림 좌표 = 월드 좌표) */
  sx: number;
  sy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** 조각마다 조금씩 다른 무게: 같이 내려앉다가 점점 흩어진다 */
  g: number;
  /** 그림이 없을 때 칠하는 색 (재질 색) */
  color?: string;
  delay: number;
  /** 바닥에 묻히며 먼지를 낸 마지막 높이 */
  dustAt: number;
}

/** 큰 먼지 구름의 한 뭉치 */
interface Puff {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
}

/** 재질별 조각 색: 첫 색이 빛 받는 윗변, 나머지가 몸 (어두운 밤 무대에 맞게 차갑고 낮게) */
const DEBRIS_COLORS: Record<DebrisKind, string[]> = {
  glass: [COLORS.white, COLORS.skyLight, COLORS.skyDark],
  paper: [COLORS.white, COLORS.paintCream, COLORS.stone],
  water: [COLORS.skyLight, COLORS.skyLight, COLORS.sky],
  metal: [COLORS.ironLight, COLORS.stone, COLORS.iron, COLORS.iron],
  brick: [COLORS.stone, COLORS.brick, COLORS.brickRed, COLORS.brickDark],
  concrete: ['#8a867e', '#5e5a54', '#44423e', '#2e2e32'],
  wood: ['#a07a52', '#6a4a32', '#4e3626', '#2e2018'],
  sand: ['#9a8a66', '#7a6c52', '#5a5040'],
};

/** 한꺼번에 들고 있는 조각·먼지 뭉치·떨어지는 덩어리 상한 */
const MAX_BITS = 1200;
const MAX_PUFFS = 700;
const MAX_BLOCKS = 900;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** '#rrggbb' → ImageData에 바로 쓰는 32비트 값 (리틀 엔디안 ABGR) */
const rgba = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
};

export class Debris {
  private bits: Bit[] = [];
  private blocks: Block[] = [];
  private puffs: Puff[] = [];
  private seed = 1;

  private r(): number {
    return rand(this.seed++ * 7919);
  }

  /** 그릴 것이 있는가 (떨어지는 조각, 튀는 조각, 피어난 먼지) */
  get busy(): boolean {
    return this.blocks.length > 0 || this.bits.length > 0 || this.puffs.some((p) => p.t >= 0);
  }

  private src: CanvasImageSource | null = null;
  private dust: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData } | null = null;
  private dustPx: Uint32Array | null = null;
  private dustColors: number[] = [];

  /**
   * 건물이 무너짐: x0~x1 사이, 바닥에서 높이 h까지의 정면이 조각나 통째로 내려앉는다.
   * 맨 아래 두 줄은 바로 부서져 먼지가 되고, 위는 거의 함께 떨어지다가 조금씩 흩어지며 바닥 먼지 속으로 묻힌다.
   * src: 무너지기 전 정면 그림 (월드 좌표). 없으면 벽돌색 덩어리로 그린다.
   */
  collapse(x0: number, x1: number, h: number, src: CanvasImageSource | null = null): void {
    this.src = src ?? this.src;
    const cell = 16;
    const mid = (x0 + x1) / 2;
    for (let y = 0; y < h; y += cell) {
      const row = y / cell;
      for (let x = x0; x < x1; x += cell) {
        const w = Math.min(cell, x1 - x);
        const ch = Math.min(cell, h - y);
        if (row < 2) {
          // 아래층: 그 자리에서 부서진다
          this.burst('brick', x + w / 2, GROUND_Y - y - ch / 2, x + w / 2 < mid ? -1 : 1, 3);
          continue;
        }
        // 한 칸을 두세 조각으로 쪼갠다 (가로로 한 번, 그중 하나는 세로로 한 번 더)
        const cut = 5 + Math.floor(this.r() * 7);
        const parts: Array<[number, number, number, number]> = [];
        const top: [number, number, number, number] = [x, GROUND_Y - y - ch, w, Math.min(cut, ch)];
        parts.push(top);
        if (ch > cut) {
          const by = GROUND_Y - y - ch + cut;
          const bh = ch - cut;
          if (this.r() < 0.5 && w > 8) {
            const v = 4 + Math.floor(this.r() * (w - 8));
            parts.push([x, by, v, bh], [x + v, by, w - v, bh]);
          } else parts.push([x, by, w, bh]);
        }
        for (const [px, py, pw, ph] of parts) {
          this.blocks.push({
            sx: px,
            sy: py,
            x: px,
            y: py,
            w: pw,
            h: ph,
            vx: (px + pw / 2 - mid) * 0.006 + (this.r() - 0.5) * 0.5,
            vy: 0,
            g: 0.22 + this.r() * 0.1,
            delay: Math.floor(this.r() * 3) + (row > 2 ? 1 : 0),
            dustAt: GROUND_Y,
          });
        }
      }
    }
    this.dustCloud(x0 - 16, x1 + 16, 3);
  }

  /** 바닥(ground: 화면 y, 지붕 위면 그 높이)에서 피어오르는 먼지 구름 (size 1 = 보통). 클수록 뭉치가 많고 크며 높이 솟는다 */
  dustCloud(x0: number, x1: number, size: number, ground = GROUND_Y): void {
    const n = Math.round(((x1 - x0) / 6 + 10) * size);
    for (let i = 0; i < n; i++) {
      const x = x0 + this.r() * (x1 - x0);
      this.puffs.push({
        x,
        y: ground - this.r() * 10 * size,
        r: 4 + this.r() * 6 * size,
        vx: (x - (x0 + x1) / 2) * 0.012 + (this.r() - 0.5) * 0.8,
        vy: -0.2 - this.r() * 0.45 * size,
        t: -Math.floor(this.r() * 12 * size),
        life: 90 + Math.floor(this.r() * 90),
      });
    }
  }

  /**
   * 튀는 조각 count개. 단단한 것(벽돌·콘크리트·철·나무)은 넷에 하나꼴로 2~3px 덩어리가 섞이고, 바닥에 닿으면 한 번 튀었다가
   * 잠깐 바닥에 남는다 (유리는 반짝이며 튀고, 물·종이·모래는 그대로 사라진다)
   */
  burst(kind: DebrisKind, x: number, y: number, dir: number, count: number): void {
    const hard = kind === 'brick' || kind === 'concrete' || kind === 'metal' || kind === 'wood';
    for (let i = 0; i < count; i++) {
      const r = () => rand(this.seed++ * 7919);
      const spread = kind === 'water' || kind === 'sand' ? 0.6 : 1.6;
      const big = hard && r() < 0.25;
      const cols = DEBRIS_COLORS[kind];
      this.bits.push({
        x,
        y,
        vx: dir * (0.3 + r() * 2.2) + (r() - 0.5) * spread,
        vy: -(0.6 + r() * (kind === 'paper' ? 1.6 : 2.6)),
        color: cols[Math.floor(r() * cols.length)],
        life: 40 + Math.floor(r() * 60),
        flutter: kind === 'paper',
        w: big ? (kind === 'wood' ? 4 : 2 + Math.floor(r() * 2)) : 1,
        h: big ? 2 : 1,
        top: cols[0],
        bounce: hard || kind === 'glass' ? 1 : 0,
        rest: hard ? 30 + Math.floor(r() * 50) : kind === 'glass' ? 16 : 0,
      });
    }
  }

  /**
   * 큰 덩어리 (구조물이 부서질 때): 3~7px 덩어리 count개가 맞은 쪽으로 무겁게 날아 떨어지고, 바닥에서 한 번 튄 뒤
   * 2~4초 남아 있다가 사라진다. 먼지(dustCloud)와 따로 보인다
   */
  chunks(kind: DebrisKind, x: number, y: number, dir: number, count: number, size = 1): void {
    const cols = DEBRIS_COLORS[kind];
    for (let i = 0; i < count; i++) {
      const r = () => rand(this.seed++ * 7919);
      const w = Math.max(2, Math.round((3 + r() * 4) * size));
      const h = Math.max(2, Math.round(w * (kind === 'wood' || kind === 'metal' ? 0.4 : 0.6 + r() * 0.3)));
      this.bits.push({
        x: x + (r() - 0.5) * 10 * size,
        y: y + (r() - 0.5) * 8 * size,
        vx: dir * (0.2 + r() * 1.6) + (r() - 0.5) * 1.2,
        vy: -(0.3 + r() * 1.8),
        color: cols[1 + Math.floor(r() * (cols.length - 1))],
        life: 400,
        flutter: false,
        w,
        h,
        top: cols[0],
        bounce: 1,
        rest: 120 + Math.floor(r() * 120),
      });
    }
  }

  /**
   * 구조물이 무너질 때 위에서 떨어지는 덩어리 (그림 없이 재질 색): x0~x1, 바닥에서 y0~y1 높이의 정면이 조각나 떨어진다.
   * 건물 붕괴(collapse)와 같은 무게로 내려앉다가 바닥 먼지 속에 묻힌다
   */
  fallBlocks(x0: number, x1: number, y0: number, y1: number, colors: readonly string[], dir: number): void {
    const cell = 8;
    for (let y = y0; y < y1; y += cell) {
      for (let x = x0; x < x1; x += cell) {
        if (rand(this.seed++ * 31) < 0.45) continue;
        const w = Math.min(cell, x1 - x) - Math.floor(this.r() * 3);
        const h = Math.min(cell, y1 - y) - Math.floor(this.r() * 3);
        if (w < 2 || h < 2) continue;
        this.blocks.push({
          sx: 0, sy: 0, x, y: GROUND_Y - y - h, w, h,
          vx: dir * this.r() * 0.6 + (x - (x0 + x1) / 2) * 0.004,
          vy: -this.r() * 0.6,
          g: 0.2 + this.r() * 0.12,
          delay: Math.floor(this.r() * 4),
          dustAt: GROUND_Y,
          color: colors[1 + Math.floor(this.r() * (colors.length - 1))],
        });
      }
    }
  }

  /** 먼지가 한쪽(dir)으로 바닥을 따라 깔리며 퍼진다 (센 충격·붕괴 방향). ground: 화면 y */
  dustSweep(x: number, dir: number, size: number, ground = GROUND_Y): void {
    const n = Math.round(14 * size);
    for (let i = 0; i < n; i++) {
      this.puffs.push({
        x: x + dir * this.r() * 10,
        y: ground - this.r() * 4,
        r: 3 + this.r() * 4 * size,
        vx: dir * (0.6 + this.r() * 1.6 * size),
        vy: -0.05 - this.r() * 0.15,
        t: -Math.floor(this.r() * 6),
        life: 60 + Math.floor(this.r() * 60),
      });
    }
  }

  /** dt: 한 틱의 몇 배만큼 진행할지 (슬로모션이면 0.5) */
  tick(dt = 1): void {
    for (const b of this.blocks) {
      if (b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      b.vy += b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // 바닥에 묻히는 만큼 먼지가 뿜어 나온다
      const buried = b.y + b.h - GROUND_Y;
      if (buried > 0 && GROUND_Y - buried < b.dustAt - 4) {
        b.dustAt = GROUND_Y - buried;
        this.puffs.push({ x: b.x + b.w / 2, y: GROUND_Y - 4, r: 3 + b.w / 4, vx: (this.r() - 0.5) * 1.2, vy: -0.3 - this.r() * 0.5, t: 0, life: 50 + Math.floor(this.r() * 30) });
        if (this.r() < 0.3) this.burst('brick', b.x + b.w / 2, GROUND_Y - 2, this.r() < 0.5 ? -1 : 1, 1);
      }
    }
    this.blocks = this.blocks.filter((b) => b.y < GROUND_Y);
    for (const p of this.puffs) {
      p.t += dt;
      if (p.t < 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 0.015 * dt;
      p.vy *= 1 - 0.006 * dt;
      p.r += 0.12 * dt;
    }
    this.puffs = this.puffs.filter((p) => p.t < p.life);
    for (const b of this.bits) {
      b.life -= dt;
      if (b.flutter) {
        b.vy = Math.min(0.5, b.vy + 0.05 * dt);
        b.vx *= 1 - 0.03 * dt;
        b.x += Math.sin(b.life * 0.3) * 0.4 * dt;
      } else {
        b.vy += 0.16 * dt;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // 바닥: 단단한 조각은 한 번 튀고, 다 튀면 바닥에 남아 있다가 사라진다
      if (!b.flutter && b.y + b.h >= GROUND_Y && b.vy > 0 && (b.bounce > 0 || b.rest > 0)) {
        b.y = GROUND_Y - b.h;
        if (b.bounce > 0) {
          b.bounce--;
          b.vy = -b.vy * 0.3;
          b.vx *= 0.45;
          b.life = Math.max(b.life, 20);
        } else {
          b.vx = 0;
          b.vy = 0;
          b.life = b.rest;
          b.rest = 0;
          b.flutter = false;
          b.resting = true;
        }
      }
      if (b.resting) {
        b.vy = 0;
        b.y = GROUND_Y - b.h;
      }
    }
    this.bits = this.bits.filter((b) => b.life > 0 && b.y < GROUND_Y + 4);
    // 누적 상한 (여러 건물이 연달아 무너져도 쌓이지 않게): 오래된 것부터 버린다
    if (this.bits.length > MAX_BITS) this.bits.splice(0, this.bits.length - MAX_BITS);
    if (this.puffs.length > MAX_PUFFS) this.puffs.splice(0, this.puffs.length - MAX_PUFFS);
    if (this.blocks.length > MAX_BLOCKS) this.blocks.splice(0, this.blocks.length - MAX_BLOCKS);
  }

  clear(): void {
    this.blocks = [];
    this.puffs = [];
    this.bits = [];
  }

  /**
   * 먼지 구름: 바둑판 디더링, 오래될수록 성기게.
   * 캐릭터 뒤(back)에는 짙게, 앞(front)에는 갓 피어난 뭉치만 옅게 덮는다 (캐릭터가 묻혀 보이지 않게)
   */
  drawDust(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, layer: 'back' | 'front' = 'back'): void {
    const live = this.puffs.filter((p) => p.t >= 0 && (layer === 'back' || p.t / p.life <= 0.45));
    if (!live.length) return;
    // 뭉치가 많아 한 점씩 fillRect하면 무거우므로 화면 크기 픽셀 버퍼에 찍고 한 번에 얹는다
    if (!this.dust) {
      const c = document.createElement('canvas');
      c.width = SCREEN_W;
      c.height = SCREEN_H;
      const g = c.getContext('2d')!;
      this.dust = { canvas: c, g, img: g.createImageData(SCREEN_W, SCREEN_H) };
      this.dustPx = new Uint32Array(this.dust.img.data.buffer);
      // 빛을 받지 않는 평면 층에 얹히므로 밤 무대에 맞게 한 단계 어둡고 차갑게
      this.dustColors = ['#3a3530', '#302c30', '#29262c'].map(rgba);
    }
    const px = this.dustPx!;
    px.fill(0);
    const [sand, haze, smoke] = this.dustColors;
    for (const p of live) {
      const k = p.t / p.life;
      const level = Math.round((layer === 'front' ? 5 : 11) * (1 - k));
      if (level <= 0) continue;
      const color = k < 0.3 ? sand : k < 0.6 ? haze : smoke;
      const cx = Math.round(p.x - cam.x);
      const cy = Math.round(p.y - cam.y);
      const r = Math.round(p.r);
      for (let y = Math.max(-r, -cy); y <= r && cy + y < SCREEN_H; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y));
        const sy = cy + y;
        const row = sy * SCREEN_W;
        const by = ((sy + cam.y) & 3) << 2;
        for (let x = Math.max(-half, -cx); x <= half && cx + x < SCREEN_W; x++) {
          const sx = cx + x;
          if (BAYER[by | ((sx + cam.x) & 3)] < level) px[row + sx] = color;
        }
      }
    }
    this.dust.g.putImageData(this.dust.img, 0, 0);
    ctx.drawImage(this.dust.canvas, 0, 0);
  }

  /** 떨어지는 조각과 튀는 조각. 조각은 바닥 아래로 묻힌 부분을 그리지 않는다 */
  draw(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }): void {
    for (const b of this.blocks) {
      const x = Math.round(b.x - cam.x);
      const y = Math.round(b.y - cam.y);
      const h = Math.min(b.h, Math.round(GROUND_Y - b.y));
      if (h <= 0) continue;
      if (b.color) {
        ctx.fillStyle = b.color;
        ctx.fillRect(x, y, b.w, h);
      } else if (this.src) ctx.drawImage(this.src, b.sx, b.sy, b.w, h, x, y, b.w, h);
      else {
        ctx.fillStyle = COLORS.brick;
        ctx.fillRect(x, y, b.w, h);
      }
      // 깨진 단면: 아래 가장자리를 어둡게
      ctx.fillStyle = COLORS.brickDark;
      if (h === b.h) ctx.fillRect(x, y + h - 1, b.w, 1);
    }
    for (const b of this.bits) {
      const x = Math.round(b.x - cam.x);
      const y = Math.round(b.y - cam.y);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.flutter ? 2 : b.w, b.h);
      // 덩어리: 윗변이 빛을 받는다 (명도로 형태를 나눈다, 외곽선 없음)
      if (b.w >= 2 && b.h >= 2) {
        ctx.fillStyle = b.top;
        ctx.fillRect(x, y, b.w, 1);
      }
    }
  }
}
