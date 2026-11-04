// YESTERDAY 길티기어식 이펙트 — 전조 (동작연출지침서 14-2 '전조 −4~−1', 14-9 M, 렌더 전용).
// 감기 끝에 기운이 모인다: 치는 팔(다리)을 타고 짧은 굵은 번개가 어깨(엉덩이) → 주먹(발)으로 흘러가고, 마지막 틱에 주먹에서 작은 섬광.
// 맞을 자리 쪽으로 공기가 빨려 드는 짧은 빛 쐐기 2~3개가 바깥에서 그 자리로 모여든다 (뿌리가 굵어 1px 선이 되지 않는다).
// 관절·맞을 자리는 틱마다 다시 읽는다 (공중에서 움직이는 공격도 따라간다). 차지는 모으는 동안 되풀이한다.
import type { GPt } from '../../data/vfx/types';
import { fillRings, type GFrame, type Layer } from './raster';
import { bolt, flash, hash, wedge, type Paint, type Phase } from './shapes';

export interface PreludeSpec {
  /** 지금 관절 사슬들 (월드 px): 어깨 → 팔꿈치 → 주먹, 엉덩이 → 무릎 → 발 … */
  chains: () => GPt[][];
  /** 맞을 자리 (월드 px) */
  target: () => GPt;
  /** 공격 방향 (+1 오른쪽) */
  facing: () => number;
  /** 색 단계 0 심 · 1 주색 · 2 진한 주색 · 3 잉크 · 4 고리 */
  ramp: readonly number[];
  seed: number;
  /** 전조 틱 (보통 4, 판정까지 남은 틱이 적으면 그만큼) */
  ticks: number;
  /** 참인 동안 ticks마다 처음부터 되풀이 (차지 모으기). 거짓이 되면 마지막 틱(섬광)을 그리고 끝 */
  loop?: () => boolean;
  /** 빨려 드는 선 수 (2~3) */
  lines?: number;
}

const TICK = 1 / 60;

export default function ggPrelude(o: PreludeSpec) {
  let t = 0;
  let finale = -1;
  const lines = o.lines ?? 3;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  /** 지금 전조 안의 몇째 틱인가 (0 … ticks−1). 되풀이 중이면 돌아간다 */
  const stepOf = (k: number): number => {
    if (o.loop) {
      if (finale >= 0) return o.ticks - 1;
      return k % o.ticks;
    }
    return k;
  };
  const paintW = (f: GFrame, list: Paint[], map: (x: number, y: number) => GPt) => {
    for (const p of list) {
      const c = o.ramp[p.tone]!;
      for (const r of p.rings) {
        const w: number[] = [];
        for (let i = 0; i < r.length; i += 2) {
          const [x, y] = map(r[i]!, r[i + 1]!);
          w.push(x, y);
        }
        fillRings(f, [w], c);
      }
    }
  };
  return {
    update(dt: number) {
      t += dt;
      if (o.loop && finale < 0 && !o.loop()) finale = tickNow();
    },
    done() {
      const k = tickNow();
      if (o.loop) return finale >= 0 && k > finale;
      return k >= o.ticks;
    },
    draw(f: GFrame, layer?: Layer) {
      const k = tickNow();
      if (!o.loop && k >= o.ticks) return;
      const step = stepOf(k);
      const last = step >= o.ticks - 1;
      const fc = o.facing() >= 0 ? 1 : -1;
      // 1) 팔을 타는 전류 (앞 겹: 팔 위에 보이게): 사슬 길이의 45%짜리 굵은 번개 조각이 틱마다 끝 쪽으로 흘러간다
      if (layer === 'front') for (const [ci, chain] of o.chains().entries()) {
        if (chain.length < 2) continue;
        const cum = [0];
        for (let i = 1; i < chain.length; i++) cum.push(cum[i - 1]! + Math.hypot(chain[i]![0] - chain[i - 1]![0], chain[i]![1] - chain[i - 1]![1]));
        const L = cum[cum.length - 1]!;
        if (L < 4) continue;
        const ub = Math.min(1, (step + 1) / o.ticks);
        const ua = Math.max(0, ub - 0.45);
        const at = (u: number): GPt => {
          const d = u * L;
          let i = 0;
          while (i + 2 < chain.length && cum[i + 1]! < d) i++;
          const tt = (d - cum[i]!) / Math.max(1e-6, cum[i + 1]! - cum[i]!);
          return [chain[i]![0] + (chain[i + 1]![0] - chain[i]![0]) * tt, chain[i]![1] + (chain[i + 1]![1] - chain[i]![1]) * tt];
        };
        // 조각 위 점 4개 (가운데 둘은 틱마다 비틀린다: 살아 있는 전류)
        const pts: GPt[] = [0, 0.33, 0.66, 1].map((q) => at(ua + (ub - ua) * q));
        const ph: Phase = { a: 1, ls: k * 2, creep: 0, p: 0, seed: o.seed * 13 + ci };
        paintW(f, bolt({ kind: 'bolt', pts, w0: 2.5, w1: 4 }, ph), (x, y) => [x, y]);
        // 마지막 틱: 주먹(발)에서 작은 섬광
        if (last) {
          const tip = chain[chain.length - 1]!;
          const sp = flash({ kind: 'flash', spikes: [[0, 9, 2], [70, 6, 1.5], [150, 7, 1.5], [-110, 6, 1.5], [-40, 8, 1.5]] }, { a: 1, ls: k, creep: 0, p: 0, seed: o.seed }, [0, 0]);
          paintW(f, sp, (x, y) => [tip[0] + fc * x, tip[1] + y]);
        }
      }
      // 2) 빨려 드는 선 (뒤 겹: 상대 몸을 가리지 않게): −3틱부터, 맞을 자리 앞쪽 바깥에서 그 자리로 모인다 (틱마다 더 안쪽으로)
      const pull = step - (o.ticks - 3);
      if (layer !== 'front' && pull >= 0) {
        const [tx, ty] = o.target();
        const base = [-48, 12, 64];
        for (let j = 0; j < lines; j++) {
          const ang = base[j % base.length]! + (hash(o.seed, j, 3) - 0.5) * 14;
          const ro = 46 - 9 * pull + hash(o.seed, j, 4) * 6;
          const ri = 24 - 7 * pull;
          const a = (ang * Math.PI) / 180;
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          // 바깥 끝 → 안쪽으로 향하는 짧은 빛 쐐기 (뿌리 쪽이 굵다)
          const w = wedge(
            { kind: 'wedge', at: [dx * ro, dy * ro], angle: ang + 180, back: 0, fwd: ro - ri, w: 7 - j * 0.75, peak: 0.3, bulge: [0.6, 1.2], main: 0.55, core: 0.25 },
            { a: 1, ls: k, creep: 0, p: 0, seed: o.seed + j },
          );
          paintW(f, w, (x, y) => [tx + fc * x, ty + y]);
        }
      }
    },
  };
}
