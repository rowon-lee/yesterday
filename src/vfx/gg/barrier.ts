// YESTERDAY 길티기어식 이펙트 — 화과산 전류 방벽 (동작연출지침서 14-8 ⑥ 굵은 번개, 14-2 시간, 렌더 전용).
// 두 사람 사이에 선 굵은 번개 2줄 (어두운 테두리 1px). 설계한 모양 둘(data/vfx RAIDEN_GG_BARRIER)을 4틱마다 바꿔 끼우고,
// 그 사이에도 2틱마다 다시 꺾여 (해시, 난수 없이) 같은 그림으로 멈추지 않는다.
// 펼쳐짐: 3틱 동안 바닥에서 솟으며 가는 길잡이 → 굵어진다. 튕겨 낼 때 2틱 하얗게 굵어진다.
// 흩어짐: 마지막 12틱은 바닥 쪽(꼬리)부터 끊겨 위로 흘러가며 가늘어진다 (sim이 남은 틱을 준다. 한꺼번에 꺼지지 않게)
import type { GPt } from '../../data/vfx/types';
import { fillRings, type GFrame, type Layer } from './raster';
import { bolt, type Phase } from './shapes';

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
  seed?: number;
}

const TICK = 1 / 60;
const DESIGN_H = 66;
/** 흩어지는 마지막 틱 */
const TAIL = 12;

export default function ggBarrier(o: BarrierSpec) {
  let t = 0;
  let gone = false;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  const seed = o.seed ?? 7;
  return {
    /** 빛: 보이는가, 튕겨 낸 직후인가, 자리 */
    phase() {
      const k = tickNow();
      const left = o.left();
      const on = !gone && k >= o.delay && left > 0;
      return { on, flash: k - o.flashAt() < 3, x: o.x(), y: o.floor - o.h * 0.5, fade: Math.min(1, left / TAIL) };
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
      if (left <= 0) return;
      const ls = k - o.delay;
      const x0 = Math.round(o.x());
      const rise = Math.min(1, (ls + 1) / 3);
      const flash = k - o.flashAt() < 3;
      const sy = (o.h / DESIGN_H) * rise;
      const variant = o.variants[(k >> 2) % o.variants.length]!;
      // 마지막 12틱: 흩어짐 0 → 1 (바닥 쪽이 꼬리: 방벽은 바닥에서 위로 솟았다)
      const p = left < TAIL ? 1 - left / TAIL : 0;
      variant.forEach((pts, idx) => {
        // 바닥(첫 점)에서 위로: 꼬리 = 바닥 쪽. 번개 함수의 꼬리(시작)가 바닥이 되게 그대로 둔다
        const scaled = pts.map(([x, y]) => [x, y * sy] as const);
        // 두 줄의 굵기를 다르게 (같은 굵기 평행선이 되지 않게): 둘째 줄은 60%
        const wk = idx === 0 ? 1 : 0.6;
        const ph: Phase = { a: ls < 1 ? 1 / 3 : ls < 2 ? 0.75 : 1, ls, creep: 0, p, seed: seed * 31 + idx };
        const paints = bolt({ kind: 'bolt', pts: scaled, w0: (flash ? o.w0 + 2 : o.w0) * wk, w1: Math.max(1.5, o.w1 * wk) }, ph);
        for (const pt of paints) {
          const c = o.ramp[flash && pt.tone === 1 ? 0 : pt.tone]!;
          for (const r of pt.rings) fillRings(f, [r.map((v, i) => (i & 1 ? o.floor + v : x0 + v))], c);
        }
      });
    },
  };
}
