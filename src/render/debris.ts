import { COLORS } from './palette';
import { GROUND_Y } from './stage';

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
}

export type DebrisKind = 'glass' | 'paper' | 'water' | 'metal';

/** 렌더 전용 고정 난수 */
function rand(n: number): number {
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
  n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

export class Debris {
  private bits: Bit[] = [];
  private seed = 1;

  burst(kind: DebrisKind, x: number, y: number, dir: number, count: number): void {
    const colors: Record<DebrisKind, string[]> = {
      glass: [COLORS.skyLight, COLORS.white, COLORS.skyDark],
      paper: [COLORS.paintCream, COLORS.stone, COLORS.white],
      water: [COLORS.skyLight, COLORS.sky],
      metal: [COLORS.ironLight, COLORS.stone, COLORS.iron],
    };
    for (let i = 0; i < count; i++) {
      const r = () => rand(this.seed++ * 7919);
      const spread = kind === 'water' ? 0.6 : 1.6;
      this.bits.push({
        x,
        y,
        vx: dir * (0.3 + r() * 2.2) + (r() - 0.5) * spread,
        vy: -(0.6 + r() * (kind === 'paper' ? 1.6 : 2.6)),
        color: colors[kind][Math.floor(r() * colors[kind].length)],
        life: 40 + Math.floor(r() * 60),
        flutter: kind === 'paper',
      });
    }
  }

  tick(): void {
    for (const b of this.bits) {
      b.life--;
      if (b.flutter) {
        b.vy = Math.min(0.5, b.vy + 0.05);
        b.vx *= 0.97;
        b.x += Math.sin(b.life * 0.3) * 0.4;
      } else {
        b.vy += 0.16;
      }
      b.x += b.vx;
      b.y += b.vy;
    }
    this.bits = this.bits.filter((b) => b.life > 0 && b.y < GROUND_Y + 4);
  }

  clear(): void {
    this.bits = [];
  }

  draw(ctx: CanvasRenderingContext2D, camX: number): void {
    for (const b of this.bits) {
      ctx.fillStyle = b.color;
      ctx.fillRect(Math.round(b.x - camX), Math.round(b.y), b.flutter ? 2 : 1, 1);
    }
  }
}
