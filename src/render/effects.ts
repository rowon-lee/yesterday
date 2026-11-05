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
  /** 방향 밀기 (14-9 E 화면 밖으로·K 공격 방향으로만 흔들기): 밀 px (x, y), 남은 틱, 전체 틱, 한 축 흔들기인가 */
  private kickV: [number, number] = [0, 0];
  private kickLeft = 0;
  private kickLen = 0;
  private kickShake = false;
  /** 짓눌림 (에드워드 '무게'): 이 틱 (this.t)까지 화면을 sinkPx만큼 아래로 */
  private sinkPx = 0;
  private sinkUntil = -1;

  /** 충격 더하기 (0~1) */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** 화면을 (dx, dy) px 쪽으로 밀었다가 ticks틱에 걸쳐 돌아온다. shake면 그 축을 따라서만 흔들리며 잦아든다 */
  kick(dx: number, dy: number, ticks: number, shake = false): void {
    this.kickV = [dx, dy];
    this.kickLeft = ticks;
    this.kickLen = Math.max(1, ticks);
    this.kickShake = shake;
  }

  /** 화면을 px만큼 아래로 ticks틱 동안 눌렀다가 한 번에 돌아온다 (밀기·흔들기와 따로 더한다). 이 틱의 tick()이 뒤따르므로 다음 틱부터 센다 */
  sink(px: number, ticks: number): void {
    this.sinkPx = px;
    this.sinkUntil = this.t + ticks;
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
    if (this.kickLeft > 0) this.kickLeft--;
  }

  /** 방향 밀기 오프셋 (정수 px): 처음에 다 밀리고 남은 틱 동안 돌아온다. 흔들기면 같은 축에서 + − 를 오간다 */
  private kickOffset(): [number, number] {
    if (this.kickLeft <= 0) return [0, 0];
    const u = this.kickLeft / this.kickLen;
    const k = this.kickShake ? u * (this.kickLeft % 2 ? 1 : -0.6) : u * u;
    return [Math.round(this.kickV[0] * k), Math.round(this.kickV[1] * k)];
  }

  /** 흔들림 오프셋 (정수 px). 틱마다 정해진 무늬로 흔들어 같은 장면은 늘 같게 찍힌다 */
  offset(): [number, number] {
    const [kx, k0] = this.kickOffset();
    const ky = k0 + (this.t <= this.sinkUntil ? this.sinkPx : 0);
    const k = this.trauma * this.trauma * SHAKE_MAX_PX;
    if (k < 0.5) return [kx, ky];
    const nx = Math.sin(this.t * 2.9) + 0.5 * Math.sin(this.t * 7.3);
    const ny = Math.sin(this.t * 3.7 + 1) + 0.5 * Math.sin(this.t * 5.1 + 2);
    return [kx + Math.round((k * nx) / 1.5), ky + Math.round((k * ny) / 1.5)];
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
