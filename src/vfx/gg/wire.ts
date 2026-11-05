// YESTERDAY 길티기어식 이펙트 — 백은우 와이어 (동작연출지침서 11-0 '와이어는 연검과 다른 곧은 금속 선', 14-8 ①·②, 14-2 시간, 렌더 전용).
// 1px 실 대신 가운데가 굵고 (4~5px) 양 끝이 뾰족한 곧은 은빛 띠 (14-7 '모든 선은 한쪽이 굵고 한쪽이 가늘다').
// 쏘아 나감 (shoot틱 동안 손에서 과녁으로 끝이 뻗는다) → 팽팽함 (머묾: 흰 빛이 손 → 과녁으로 미끄러지고, 2틱마다 1px 떨린다.
// held 동안은 끝나지 않는다) → 거둠 (back틱 동안 과녁 쪽 끝부터 손으로 감겨 들어오며 가늘어진다. retract가 아니면 가운데부터 끊겨 흩어진다).
// 손과 과녁은 틱마다 다시 읽는다 (맞은 상대에 감긴 채 따라간다).
import type { GPt } from '../../data/vfx/types';
import { fillRings, type GFrame, type Layer } from './raster';

export interface WireSpec {
  from: () => GPt;
  to: () => GPt;
  shoot: number;
  hold: number;
  back: number;
  retract: boolean;
  /** 가장 굵은 곳 (px) */
  w?: number;
  /** 색 단계 0 심 · 1 주색 · 2 진한 주색 … */
  ramp: readonly number[];
  held?: () => boolean;
  seed: number;
}

const TICK = 1 / 60;

export default function ggWire(o: WireSpec) {
  let L = 0;
  let t = 0;
  const W = o.w ?? 5.5;
  const tickNow = () => Math.floor(t + 1e-6);
  /** 지금 모습: 손 쪽 끝 u0 · 과녁 쪽 끝 u1 (0 손 → 1 과녁), 굵기 비, 가운데 끊김 */
  const shape = () => {
    const k = tickNow();
    if (k < o.shoot) return { u0: 0, u1: (k + 1) / (o.shoot + 1), w: 0.8, cut: 0 };
    const back = k - o.shoot - o.hold;
    if (back < 0) return { u0: 0, u1: 1, w: 1, cut: 0 };
    const q = Math.min(1, (back + 1) / Math.max(1, o.back));
    if (o.retract) return { u0: 0, u1: 1 - q, w: 1 - 0.5 * q, cut: 0 };
    return { u0: 0, u1: 1, w: 1 - 0.55 * q, cut: q };
  };
  return {
    update(dt: number) {
      L += dt / TICK;
      if (!o.held?.()) t += dt / TICK;
    },
    done() {
      return tickNow() >= o.shoot + o.hold + o.back;
    },
    /** 무대 빛 자리 (과녁 쪽 끝)와 세기 */
    phase(): { b: GPt; k: number } {
      const s = shape();
      const a = o.from();
      const b = o.to();
      return { b: [a[0] + (b[0] - a[0]) * s.u1, a[1] + (b[1] - a[1]) * s.u1], k: s.w };
    },
    draw(f: GFrame, layer?: Layer) {
      if (layer === 'front' || this.done()) return;
      const s = shape();
      // 가장 굵은 곳이 3.2px 아래로 얇아지면 그리지 않는다 (가는 줄이 1px 선으로 남지 않게)
      if (W * s.w < 3.2) return;
      const a = o.from();
      const b = o.to();
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 6) return;
      const tx = dx / len;
      const ty = dy / len;
      const nx = -ty;
      const ny = tx;
      // 2틱마다 1px 떨림 (팽팽한 줄)
      const quiver = (Math.floor(L / 2) % 2 ? 0.6 : -0.6) * (s.u1 >= 1 ? 1 : 0);
      const seg = (u0: number, u1: number, scale: number) => {
        const n = Math.max(6, Math.ceil(((u1 - u0) * len) / 4));
        const up: number[] = [];
        const dn: number[] = [];
        for (let i = 0; i <= n; i++) {
          const u = u0 + ((u1 - u0) * i) / n;
          const v = (u - s.u0) / Math.max(1e-6, s.u1 - s.u0);
          // 양 끝 3px 아래 구간이 짧게 (가는 끝이 1px 선으로 길게 남지 않게): 지수 0.25
          const h = (W * s.w * scale * Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.25)) / 2;
          const x = a[0] + dx * u + nx * quiver * Math.sin(Math.PI * v);
          const y = a[1] + dy * u + ny * quiver * Math.sin(Math.PI * v);
          up.push(x + nx * h, y + ny * h);
          dn.push(x - nx * h, y - ny * h);
        }
        const ring = up.slice();
        for (let i = dn.length - 2; i >= 0; i -= 2) ring.push(dn[i]!, dn[i + 1]!);
        return ring;
      };
      // 끊겨 흩어질 때: 가운데에서 벌어진다
      const parts: Array<[number, number]> = s.cut > 0 ? [[s.u0, 0.5 - 0.5 * s.cut], [0.5 + 0.5 * s.cut, s.u1]] : [[s.u0, s.u1]];
      for (const [u0, u1] of parts) {
        if ((u1 - u0) * len < 4) continue;
        fillRings(f, [seg(u0, u1, 1)], o.ramp[2]!);
        if (W * s.w >= 4) fillRings(f, [seg(u0, u1, 0.62)], o.ramp[1]!);
      }
      // 흰 빛이 손 → 과녁으로 미끄러진다 (팽팽한 동안)
      if (s.cut === 0 && s.u1 >= 1 && W * s.w >= 4) {
        const g = ((L * 0.09 + (o.seed % 7) * 0.1) % 1.2) - 0.1;
        const g0 = Math.max(0.08, g - 0.06);
        const g1 = Math.min(0.92, g + 0.06);
        if (g1 > g0 + 0.02) fillRings(f, [seg(g0, g1, 0.62)], o.ramp[0]!);
      }
      void tx;
      void ty;
    },
  };
}
