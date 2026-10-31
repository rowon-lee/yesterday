import type { SimEvent } from '../sim';
import { COLORS } from './palette';

/** 렌더 전용 이펙트: 타격 불꽃, 화면 흔들림·번쩍임. sim 이벤트를 받아 틱마다 진행한다. */
interface Spark {
  x: number;
  y: number;
  t: number;
  life: number;
  size: number;
  color: string;
}

export class Effects {
  sparks: Spark[] = [];
  shake = 0;
  flash = 0;

  push(events: readonly SimEvent[]): void {
    for (const e of events) {
      const x = e.x / 256;
      const y = e.y / 256;
      if (e.type === 'hit') {
        this.sparks.push({ x, y, t: 0, life: e.heavy ? 12 : 8, size: e.heavy ? 9 : 6, color: COLORS.goldLight });
        if (e.heavy) {
          this.shake = Math.max(this.shake, 8);
          this.flash = Math.max(this.flash, 2);
        }
      } else if (e.type === 'block') {
        this.sparks.push({ x, y, t: 0, life: 7, size: 5, color: COLORS.skyLight });
      } else if (e.type === 'crush') {
        this.sparks.push({ x, y, t: 0, life: 14, size: 12, color: COLORS.red });
        this.shake = Math.max(this.shake, 10);
        this.flash = Math.max(this.flash, 3);
      } else if (e.type === 'ko') {
        this.shake = Math.max(this.shake, 14);
        this.flash = Math.max(this.flash, 4);
      }
    }
  }

  tick(): void {
    for (const s of this.sparks) s.t++;
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    if (this.shake > 0) this.shake--;
    if (this.flash > 0) this.flash--;
  }

  /** 흔들림 오프셋 (정수 px) */
  offset(): [number, number] {
    if (this.shake <= 0) return [0, 0];
    const a = this.shake > 4 ? 2 : 1;
    return [this.shake % 2 ? a : -a, this.shake % 3 === 0 ? a : 0];
  }

  /** 타격 불꽃: 십자와 대각선이 퍼졌다 줄어든다 (화면 좌표로 옮겨 그림) */
  draw(ctx: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number]): void {
    for (const s of this.sparks) {
      const [sx, sy] = toScreen(s.x, s.y);
      const k = s.t / s.life;
      const r = Math.max(1, Math.round(s.size * (k < 0.4 ? k / 0.4 : 1)));
      const thick = k < 0.5 ? 2 : 1;
      ctx.fillStyle = s.t < 2 ? COLORS.white : s.color;
      ctx.fillRect(sx - r, sy - (thick >> 1), r * 2 + 1, thick);
      ctx.fillRect(sx - (thick >> 1), sy - r, thick, r * 2 + 1);
      const d = Math.round(r * 0.6);
      for (let i = 1; i <= d; i++) {
        if (k > 0.7 && i < d / 2) continue;
        ctx.fillRect(sx + i, sy + i, 1, 1);
        ctx.fillRect(sx - i, sy + i, 1, 1);
        ctx.fillRect(sx + i, sy - i, 1, 1);
        ctx.fillRect(sx - i, sy - i, 1, 1);
      }
    }
  }
}
