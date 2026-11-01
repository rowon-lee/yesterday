// YESTERDAY: 공격 궤적 띠 (동작연출지침서 5장, Sprite Fusion 이펙트와 같은 구조로 새로 만듦, 렌더 전용).
// 주먹·발·무기 끝이 지난 길을 따라 초승달 띠를 그린다: 지금 끝(가장 새 자리)이 가장 굵고(6~10px) 지난 자리로 갈수록 1px로 가늘어진다.
// 대표 색 + 흰 심(가장 밝은 1~2px), 끝(오래된 쪽)에서부터 6~10틱 동안 사라진다.
// 라이덴은 이 띠 대신 적뢰(raiden-bolt.ts)가 범위를 그린다. 좌표는 2단위 = 1px, 색은 부르는 쪽이 우리 팔레트로 (흰 → 대표 색 → 어두운).
import type { Frame, Layer } from './impact';

export interface Options {
  /** 끝이 지난 길 (2단위, 오래된 → 새) */
  path: ReadonlyArray<readonly [number, number]>;
  /** 가장 굵은 곳 두께 (px, 6~10) */
  width?: number;
  /** 사라지는 시간 (틱, 6~10) */
  ticks?: number;
  /** 색 (0xAABBGGRR): 흰 심 → 밝은 대표 색 → 대표 색 → 어두운 */
  ramp?: readonly number[];
}

const PX = 2;

export default function trail(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xffffe0a0, 0xffe0a040, 0xff804010];
  const W = o.width ?? 8;
  const life = (o.ticks ?? 8) / 60;
  // 1px 간격으로 다시 찍은 길: 자리와 진행 방향
  const pts: Array<{ x: number; y: number; nx: number; ny: number; u: number }> = [];
  {
    const P = o.path.map(([x, y]) => [x / PX, y / PX] as const);
    let total = 0;
    const seg: number[] = [];
    for (let i = 1; i < P.length; i++) {
      const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      seg.push(l);
      total += l;
    }
    const n = Math.max(2, Math.round(total));
    for (let k = 0; k <= n; k++) {
      let d = (total * k) / n;
      let i = 0;
      while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
      const a = P[i];
      const b = P[i + 1] ?? P[i];
      const l = seg[i] || 1;
      const t = Math.min(1, d / l);
      pts.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -(b[1] - a[1]) / l, ny: (b[0] - a[0]) / l, u: k / n });
    }
  }
  let t = 0;
  const put = (f: Frame, x: number, y: number, c: number) => {
    x = Math.round(x - f.ox);
    y = Math.round(y - f.oy);
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
    const b = f.box;
    if (b) {
      if (x < b[0]!) b[0] = x;
      if (y < b[1]!) b[1] = y;
      if (x > b[2]!) b[2] = x;
      if (y > b[3]!) b[3] = y;
    }
    f.color[y * f.w + x] = c >>> 0;
  };
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      // 끝(오래된 쪽)부터 사라진다: 보이는 구간 u ∈ [cut, 1]
      const cut = t / life;
      for (const p of pts) {
        if (p.u < cut) continue;
        // 초승달: 새 쪽이 굵고, 바깥쪽(진행 방향의 바깥)으로 부푼다
        const w = Math.max(1, 1 + (W - 1) * Math.pow(p.u, 1.5) * (1 - cut * 0.5));
        for (let s = 0; s < w; s++) {
          const c = s < 1.5 ? C[0]! : s < w * 0.5 ? C[1]! : s < w - 1 ? C[2]! : C[3]!;
          put(f, p.x + p.nx * s, p.y + p.ny * s, c);
        }
      }
    },
  };
}
