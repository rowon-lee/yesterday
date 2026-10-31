import type { SimEvent } from '../sim';
import { COLORS } from './palette';

/**
 * 화면 흔들림과 번쩍임 (렌더 전용). 흔들림은 '충격량(trauma)' 방식:
 * 맞을 때마다 쌓이고 매 틱 줄어든다. 흔들리는 폭은 충격량의 제곱에 비례한다 (약한 건 거의 안 흔들림).
 * 타격 불꽃 등 그림 이펙트는 Sprite Fusion 이펙트(src/vfx, render/vfx.ts)가 맡는다.
 */
export const SHAKE_MAX_PX = 5;
const TRAUMA_DECAY = 0.04;

export class Effects {
  trauma = 0;
  /** 화면 번쩍임 남은 틱 */
  flash = 0;
  private t = 0;

  /** 충격 더하기 (0~1) */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  flashFor(ticks: number): void {
    this.flash = Math.max(this.flash, ticks);
  }

  push(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'hit' && e.heavy) {
        this.shake(e.move === 'super' ? 0.55 : 0.3);
        this.flashFor(e.move === 'super' ? 3 : 1);
      } else if (e.type === 'crush') {
        this.shake(0.45);
        this.flashFor(2);
      } else if (e.type === 'ko') {
        this.shake(0.6);
        this.flashFor(3);
      }
    }
  }

  tick(): void {
    this.t++;
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY);
    if (this.flash > 0) this.flash--;
  }

  /** 흔들림 오프셋 (정수 px). 틱마다 정해진 무늬로 흔들어 같은 장면은 늘 같게 찍힌다 */
  offset(): [number, number] {
    const k = this.trauma * this.trauma * SHAKE_MAX_PX;
    if (k < 0.5) return [0, 0];
    const nx = Math.sin(this.t * 2.9) + 0.5 * Math.sin(this.t * 7.3);
    const ny = Math.sin(this.t * 3.7 + 1) + 0.5 * Math.sin(this.t * 5.1 + 2);
    return [Math.round((k * nx) / 1.5), Math.round((k * ny) / 1.5)];
  }
}

/** 흙먼지: 착지·대시·박차고 뛸 때 발밑에서 퍼지는 작은 점들 (렌더 전용) */
export interface Dust {
  x: number;
  y: number;
  /** 퍼지는 방향 (-1 왼쪽, 1 오른쪽, 0 양쪽) */
  dir: number;
  t: number;
  life: number;
}

export function drawDust(ctx: CanvasRenderingContext2D, list: readonly Dust[], toScreen: (x: number, y: number) => [number, number]): void {
  ctx.fillStyle = COLORS.smog3;
  for (const d of list) {
    const [sx, sy] = toScreen(d.x, d.y);
    const k = d.t / d.life;
    const spread = Math.round(3 + k * 10);
    const rise = Math.round(k * 4);
    const size = k < 0.6 ? 2 : 1;
    const dirs = d.dir === 0 ? [-1, 1] : [d.dir];
    for (const s of dirs) {
      ctx.fillRect(sx + s * spread, sy - 1 - rise, size, size);
      ctx.fillRect(sx + s * Math.round(spread * 0.6), sy - 2 - Math.round(rise * 1.5), size, size);
      ctx.fillRect(sx + s * Math.round(spread * 0.3), sy - 1 - Math.round(rise * 0.5), 1, 1);
    }
  }
}
