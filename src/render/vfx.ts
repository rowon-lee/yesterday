import { COLORS, type ColorName } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';
import type { Frame, Layer } from '../vfx/impact';

/**
 * Sprite Fusion 이펙트를 우리 화면에 얹는 층 (렌더 전용).
 * - 이펙트는 좌표 2단위 = 1px로 그린다 (파일 안의 PX = 2). 그래서 월드 px에 2를 곱해 넘긴다.
 * - 이펙트는 반투명으로 섞고 빛을 더해 그리는데, 우리 규칙은 흐림 금지·디더링이다.
 *   그래서 합칠 때 알파를 4×4 바이어 디더링으로 바꾸고, 빛(더해지는 밝기)은 밝기만큼 성기게 찍는다.
 * - 모든 색은 우리 제한 팔레트에서 가장 가까운 색으로 맞춘다.
 * 캐릭터 뒤(back)와 앞(front) 두 겹으로 그린다.
 */
export interface VfxInstance {
  update(dt: number): void;
  draw(f: Frame, layer?: Layer): void;
  done(): boolean;
}

/** 이펙트 좌표 1단위 = 1/2px */
export const FX_PX = 2;
const DT = 1 / 60;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const threshold = (x: number, y: number): number => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/** '#rrggbb' → 이펙트 파일이 쓰는 색 정수 (0xAABBGGRR) */
export function fxColor(name: ColorName): number {
  const v = parseInt(COLORS[name].slice(1), 16);
  return (255 << 24) | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);
}
export const fxRamp = (names: readonly ColorName[]): number[] => names.map(fxColor);
export const fxHex = (names: readonly ColorName[]): string[] => names.map((n) => COLORS[n]);

/** 팔레트 스냅: 아무 색 → 팔레트에서 가장 가까운 색 (RGB 거리) */
const paletteRgb = Object.values(COLORS).map((h) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const;
});
const snapCache = new Map<number, number>();
function snap(r: number, g: number, b: number): number {
  const key = (r << 16) | (g << 8) | b;
  let out = snapCache.get(key);
  if (out === undefined) {
    let best = 0;
    let bestD = Infinity;
    paletteRgb.forEach(([pr, pg, pb], i) => {
      // 사람 눈에 맞춘 가중치
      const d = 3 * (pr - r) ** 2 + 4 * (pg - g) ** 2 + 2 * (pb - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [pr, pg, pb] = paletteRgb[best];
    out = (255 << 24) | (pb << 16) | (pg << 8) | pr;
    snapCache.set(key, out);
  }
  return out;
}

export class VfxLayer {
  private list: VfxInstance[] = [];
  private color = new Uint32Array(SCREEN_W * SCREEN_H);
  private light = new Uint32Array(SCREEN_W * SCREEN_H);
  private out: ImageData | null = null;
  private canvas: HTMLCanvasElement | null = null;

  /** 지난 그리기에서 이펙트가 칠한 사각형 (x0, y0, x1, y1). 다음 그리기 전에 그 안만 지운다 */
  private used = [0, 0, SCREEN_W - 1, SCREEN_H - 1];

  add(fx: VfxInstance): void {
    this.list.push(fx);
  }

  private wipe(): void {
    const [x0, y0, x1, y1] = this.used;
    if (x1 < 0) return;
    for (let y = y0; y <= y1; y++) {
      this.color.fill(0, y * SCREEN_W + x0, y * SCREEN_W + x1 + 1);
      this.light.fill(0, y * SCREEN_W + x0, y * SCREEN_W + x1 + 1);
    }
  }

  clear(): void {
    this.list = [];
  }

  get count(): number {
    return this.list.length;
  }

  /** 1틱 진행 (히트스톱 중에도 이펙트는 움직인다) */
  /** dt: 한 틱의 몇 배만큼 진행할지 (슬로모션이면 0.5) */
  tick(dt = 1): void {
    for (const fx of this.list) fx.update(DT * dt);
    this.list = this.list.filter((fx) => !fx.done());
  }

  /**
   * cam: 화면 왼쪽 위의 월드 좌표 (px). 화면 흔들림은 ctx의 이동으로 이미 들어가 있다.
   * 칠해진 칸만 디더링·팔레트 스냅을 하고, 칠해진 칸을 감싼 사각형만 화면에 올린다 (휴대폰에서 화면 전체를 올리면 무겁다).
   */
  draw(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, layer: Layer): boolean {
    if (!this.list.length) return false;
    // 지난번에 칠한 사각형만 지우고, 이번에 칠한 사각형(box)만 훑는다
    this.wipe();
    const box = [SCREEN_W, SCREEN_H, -1, -1];
    const frame: Frame = { w: SCREEN_W, h: SCREEN_H, ox: cam.x, oy: cam.y, color: this.color, light: this.light, box };
    for (const fx of this.list) fx.draw(frame, layer);
    this.used = box;
    if (box[2] < 0) return false;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = SCREEN_W;
      this.canvas.height = SCREEN_H;
      this.out = new ImageData(SCREEN_W, SCREEN_H);
    }
    const px = new Uint32Array(this.out!.data.buffer);
    const color = this.color;
    const light = this.light;
    let x0 = SCREEN_W;
    let y0 = SCREEN_H;
    let x1 = -1;
    let y1 = -1;
    for (let y = box[1]; y <= box[3]; y++) {
      const row = y * SCREEN_W;
      px.fill(0, row + box[0], row + box[2] + 1);
      for (let x = box[0]; x <= box[2]; x++) {
        const i = row + x;
        const c = color[i];
        const l = light[i];
        if (c === 0 && l === 0) continue;
        // 무늬는 월드 좌표에 고정해 카메라가 움직여도 지글거리지 않게
        const th = threshold(x + cam.x, y + cam.y);
        const a = c >>> 24;
        let v = 0;
        if (a && a / 255 > th) v = snap(c & 255, (c >>> 8) & 255, (c >>> 16) & 255);
        else if (l) {
          const r = l & 255;
          const g = (l >>> 8) & 255;
          const b = (l >>> 16) & 255;
          const k = Math.max(r, g, b) / 255;
          // 빛은 밝기만큼만 성기게 (가장 밝아도 절반 정도만 찍는다)
          if (k * 0.55 > th) {
            const m = 255 / Math.max(1, Math.max(r, g, b));
            v = snap(Math.min(255, r * m), Math.min(255, g * m), Math.min(255, b * m));
          }
        }
        if (!v) continue;
        px[i] = v;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
    if (x1 < 0) return false;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    this.canvas!.getContext('2d')!.putImageData(this.out!, 0, 0, x0, y0, w, h);
    ctx.drawImage(this.canvas!, x0, y0, w, h, x0, y0, w, h);
    return true;
  }
}
