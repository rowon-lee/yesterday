import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, dither } from './dither';

/** '#rrggbb' → ImageData에 바로 쓰는 32비트 값 (리틀 엔디안 ABGR) */
export const rgba = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
};

/**
 * 화면 크기 픽셀 버퍼. 한 점씩 fillRect하면 무거운 그림(서치라이트 빛줄기 등)을 여기에 찍고 한 번에 얹는다.
 * clear() → plot()… → flush(ctx). 아무것도 안 찍었으면 flush는 그냥 넘어간다.
 */
export class ScreenBuffer {
  private c: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private img: ImageData;
  private px: Uint32Array;
  private dirty = false;

  constructor() {
    [this.c, this.g] = canvas(SCREEN_W, SCREEN_H);
    this.img = this.g.createImageData(SCREEN_W, SCREEN_H);
    this.px = new Uint32Array(this.img.data.buffer);
  }

  clear(): void {
    if (this.dirty) this.px.fill(0);
    this.dirty = false;
  }

  plot(x: number, y: number, color: number): void {
    if (x < 0 || y < 0 || x >= SCREEN_W || y >= SCREEN_H) return;
    this.px[y * SCREEN_W + x] = color;
    this.dirty = true;
  }

  flush(ctx: CanvasRenderingContext2D): void {
    if (!this.dirty) return;
    this.g.putImageData(this.img, 0, 0);
    ctx.drawImage(this.c, 0, 0);
  }

  /**
   * 서치라이트 빛줄기: (ox, oy)에서 angle 방향으로 length만큼 퍼지는 원뿔 (화면 좌표).
   * 가운데가 짙고 멀수록 옅게 디더링한다. 화면 밖은 건너뛴다.
   */
  beam(ox: number, oy: number, angle: number, length: number, color: number, strength = 1): void {
    const spread = 0.16;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const ex = ox + dx * length;
    const ey = oy + dy * length;
    const pad = length * Math.tan(spread) + 2;
    const x0 = Math.max(0, Math.floor(Math.min(ox, ex) - pad));
    const x1 = Math.min(SCREEN_W - 1, Math.ceil(Math.max(ox, ex) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(oy, ey) - pad));
    const y1 = Math.min(SCREEN_H - 1, Math.ceil(Math.max(oy, ey) + pad));
    if (x0 > x1 || y0 > y1) return;
    const t = Math.tan(spread);
    for (let y = y0; y <= y1; y++) {
      const vy = y - oy;
      for (let x = x0; x <= x1; x++) {
        const vx = x - ox;
        const along = vx * dx + vy * dy;
        if (along <= 2 || along > length) continue;
        const across = Math.abs(-vx * dy + vy * dx);
        const half = along * t + 1;
        if (across > half) continue;
        const core = 1 - across / half;
        const level = Math.round((4 + 3 * core) * (1 - 0.6 * (along / length)) * strength);
        if (level > 0 && dither(x, y, level)) this.plot(x, y, color);
      }
    }
  }
}
