// YESTERDAY 길티기어식 이펙트 — 화과산 전류 방벽 (동작연출지침서 14-8 ⑥ 굵은 번개, 렌더 전용).
// 두 사람 사이에 선 굵은 번개 2줄 (어두운 테두리 1px). 설계한 모양 둘(data/vfx RAIDEN_GG_BARRIER)을 4틱마다 바꿔 끼워 지직거린다 (난수 없이).
// 3틱 동안 바닥에서 솟고, 튕겨 낼 때 2틱 하얗게 굵어지며, 마지막 12틱은 빠르게 깜빡이며 사라진다 (sim이 남은 틱을 준다).
import type { GPt } from '../../data/vfx/types';
import { fillRings, type GFrame, type Layer } from './raster';
import { bolt } from './shapes';

export interface BarrierSpec {
  /** 방벽 가운데 x (월드 px, sim 자리)와 바닥 y, 높이 */
  x: () => number;
  floor: number;
  h: number;
  /** 남은 틱 (0이면 끝) */
  left: () => number;
  /** 나타나는 틱 (이 이펙트가 생긴 뒤) */
  delay: number;
  /** 튕겨 낸 틱 (이 이펙트가 생긴 뒤, 없으면 아주 작은 값) */
  flashAt: () => number;
  /** 색 단계 0 심 · 1 주색 · 2 진한 주색 · 3 잉크 · 4 고리 */
  ramp: readonly number[];
  /** 모양 (바닥 가운데 기준, 위가 −, 설계 높이 66px) */
  variants: readonly (readonly GPt[])[][];
  w0: number;
  w1: number;
}

const TICK = 1 / 60;
const DESIGN_H = 66;

export default function ggBarrier(o: BarrierSpec) {
  let t = 0;
  let gone = false;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  return {
    /** 빛: 보이는가, 튕겨 낸 직후인가, 자리 */
    phase() {
      const k = tickNow();
      const left = o.left();
      const on = !gone && k >= o.delay && left > 0 && !(left <= 12 && k % 2 === 1);
      return { on, flash: k - o.flashAt() < 3, x: o.x(), y: o.floor - o.h * 0.5 };
    },
    update(dt: number) {
      t += dt;
      if (o.left() <= 0) gone = true;
    },
    done() {
      return gone;
    },
    draw(f: GFrame, layer?: Layer) {
      if (layer === 'back' || gone) return;
      const k = tickNow();
      if (k < o.delay) return;
      const left = o.left();
      if (left <= 12 && k % 2 === 1) return;
      const x0 = Math.round(o.x());
      const rise = Math.min(1, (k - o.delay + 1) / 3);
      const flash = k - o.flashAt() < 3;
      const sy = (o.h / DESIGN_H) * rise;
      const variant = o.variants[(k >> 2) % o.variants.length]!;
      variant.forEach((pts, idx) => {
        const scaled = pts.map(([x, y]) => [x, y * sy] as const);
        // 두 줄의 굵기를 다르게 (같은 굵기 평행선이 되지 않게): 둘째 줄은 60%
        const wk = idx === 0 ? 1 : 0.6;
        const paints = bolt({ kind: 'bolt', pts: scaled, w0: (flash ? o.w0 + 2 : o.w0) * wk, w1: Math.max(1.5, o.w1 * wk) }, 1);
        for (const p of paints) {
          const c = o.ramp[flash && p.tone === 1 ? 0 : p.tone]!;
          for (const r of p.rings) fillRings(f, [r.map((v, i) => (i & 1 ? o.floor + v : x0 + v))], c);
        }
      });
    },
  };
}
