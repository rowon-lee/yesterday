// YESTERDAY 길티기어식 이펙트 — 에드워드 염동력 장막 띠 (동작연출지침서 12-3 '손바닥에서 꼬인 푸른 띠가 상대에게 뻗는다', 14-8 ①·②, 14-2 시간, 렌더 전용).
// 3px 가닥 세 줄 대신 (14-8 ① '가는 선 여러 개로 채우지 않는다') 굵은 장막 띠 하나가 손 → 상대 가슴으로 뻗고, 비틀린 자리 둘이
// 상대 쪽에서 손 쪽으로 흘러온다 (끌어당기는 힘). 셀 3단 (짙은 장막 → 장막 → 밝은 장막), 가운데가 조금 처진다.
// 손과 상대는 틱마다 다시 읽는다 (끌려오는 상대를 따라간다). alive가 거짓이 되면 8틱 동안 꼬리부터 찢어지며 흩어진다.
import type { GPt } from '../../data/vfx/types';
import { fillRings, type GFrame, type Layer } from './raster';
import { ribbon, type Phase } from './shapes';

export interface TetherSpec {
  from: () => GPt;
  to: () => GPt;
  alive: () => boolean;
  /** 색 단계 (캐릭터 색표: 4 장막 · 5 밝은 장막 · 6 짙은 장막) */
  ramp: readonly number[];
  seed: number;
  /** 가장 굵은 곳 (px, 기본 13) */
  w?: number;
  /** 손에서 상대까지 뻗는 틱 (기본 3) */
  shoot?: number;
}

const FADE = 8;

export default function ggTether(o: TetherSpec) {
  let L = 0;
  let end = -1;
  return {
    update(dt: number) {
      L += dt * 60;
      if (end < 0 && !o.alive()) end = L;
    },
    done() {
      return end >= 0 && L - end >= FADE;
    },
    draw(f: GFrame, layer?: Layer) {
      if (layer === 'front' || this.done()) return;
      const a = o.from();
      const b = o.to();
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      if (Math.hypot(dx, dy) < 10) return;
      const reach = Math.min(1, (L + 1) / ((o.shoot ?? 3) + 1));
      const pts: GPt[] = [];
      for (let i = 0; i <= 5; i++) {
        const u = (i / 5) * reach;
        pts.push([a[0] + dx * u, a[1] + dy * u + 6 * Math.sin(Math.PI * u)]);
      }
      const ls = Math.floor(L + 1e-6);
      const p = end < 0 ? 0 : Math.min(1, (L - end) / FADE);
      const ph: Phase = { a: ls < 1 ? 1 / 3 : ls < 2 ? 0.75 : 1, ls, creep: 0, p, seed: o.seed };
      // 비틀린 자리 둘: 상대 쪽 (u 0.82) → 손 쪽 (u 0.2)으로 18틱마다 흘러온다 (끌어당김)
      const flow = (k: number) => 0.82 - 0.62 * (((L / 18) + k * 0.5) % 1);
      const paints = ribbon({
        kind: 'ribbon', pts, w: o.w ?? 13, peak: 0.5, bulge: [0.3, 0.3], skew: 0, tones: [6, 4, 5], main: 0.62, core: 0.26, coreLen: 0.8,
        twist: [[flow(0), 0.34], [flow(1), 0.4]], wave: [2, 34], ruffle: 0.04,
      }, ph);
      for (const pt of paints) {
        const c = o.ramp[pt.tone] ?? o.ramp[0]!;
        for (const r of pt.rings) fillRings(f, [r], c);
      }
    },
  };
}
