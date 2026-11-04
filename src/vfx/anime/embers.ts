// YESTERDAY 애니 이펙트 부품 7 — 주변 잔불 (동작연출지침서 14-1 ⑦).
// 공격자 주변과 궤적을 따라 작은 베기 조각·불꽃 10~30개가 흩어진다. 띠가 찢어지는 동안 생겨 14-2 '10~20틱 조각·불꽃만 남아 흩어진다'까지 남는다.
// 조각 모양은 캐릭터 모양값: 'shard'(베기 조각: 짧은 사선 2~4px) · 'bolt'(라이덴: 3마디로 꺾인 작은 번개) · 'dot'(불꽃 점).
import { line, put, rng, type AFrame, type Layer } from './common';

export interface EmberSpec {
  /** 생기는 자리들 (월드 px): 궤적 위 점들과 공격자 둘레 */
  from: ReadonlyArray<readonly [number, number]>;
  count: number;
  /** 공격 방향 (라디안): 조각은 대체로 그쪽으로 흩어진다 */
  dir: number;
  /** 색 (밝은 → 어두운): 시간이 지나며 어두운 쪽으로 */
  colors: readonly number[];
  kind?: 'shard' | 'bolt' | 'dot';
  /** 생기는 틱 범위 (띠가 찢어지는 동안), 사는 틱 범위 */
  born?: readonly [number, number];
  life?: readonly [number, number];
  /** 빠르기 (px/틱) */
  speed?: number;
  layer?: Layer;
  seed?: number;
}

export default function embers(o: EmberSpec) {
  const rand = rng(o.seed ?? 7);
  const born = o.born ?? [2, 9];
  const life = o.life ?? [7, 14];
  const sp = o.speed ?? 3.4;
  const list = Array.from({ length: o.count }, () => {
    const p = o.from[Math.floor(rand() * o.from.length)]!;
    const a = o.dir + (rand() - 0.5) * 2.4 - (rand() < 0.5 ? 0.35 : 0);
    const v = sp * (0.4 + rand());
    return {
      x: p[0] + (rand() - 0.5) * 8,
      y: p[1] + (rand() - 0.5) * 8,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.6,
      t0: born[0] + rand() * (born[1] - born[0]),
      life: life[0] + rand() * (life[1] - life[0]),
      len: 3 + rand() * 4,
      tw: rand() * 6.28,
      kind: o.kind === 'bolt' && rand() < 0.35 ? 'shard' : o.kind ?? 'shard',
    };
  });
  const layer = o.layer ?? 'back';
  const end = Math.max(...list.map((e) => e.t0 + e.life));
  let t = 0;
  return {
    count: o.count,
    update(dt: number) {
      t += dt * 60;
    },
    done() {
      return t >= end;
    },
    draw(f: AFrame, l?: Layer) {
      if ((l ?? 'back') !== layer) return;
      for (const e of list) {
        const age = t - e.t0;
        if (age < 0 || age >= e.life) continue;
        const k = age / e.life;
        // 끌림 (점점 느려진다)과 가벼운 떠오름
        const d = (1 - Math.pow(0.86, age)) / (1 - 0.86);
        const x = e.x + e.vx * d;
        const y = e.y + e.vy * d - 0.02 * age * age;
        // 깜빡임: 끝으로 갈수록 자주 꺼진다
        if (k > 0.5 && Math.sin(e.tw + age * 2.1) < (k - 0.5) * 1.6) continue;
        const c = o.colors[Math.min(o.colors.length - 1, Math.floor(k * o.colors.length))]!;
        const sp2 = Math.hypot(e.vx, e.vy) || 1;
        const ux = e.vx / sp2;
        const uy = e.vy / sp2;
        const L = e.len * (1 - 0.5 * k);
        if (e.kind === 'dot') {
          put(f, x, y, c);
          if (k < 0.4) put(f, x + 1, y, c);
        } else if (e.kind === 'bolt') {
          // 3마디로 꺾인 작은 번개 (Z자)
          const mx = x - ux * L * 0.4 + uy * 2;
          const my = y - uy * L * 0.4 - ux * 2;
          const nx2 = x - ux * L * 0.6 - uy * 2;
          const ny2 = y - uy * L * 0.6 + ux * 2;
          line(f, x, y, mx, my, c);
          line(f, mx, my, nx2, ny2, c);
          line(f, nx2, ny2, x - ux * L, y - uy * L, c);
        } else line(f, x, y, x - ux * L, y - uy * L, c);
      }
    },
  };
}
