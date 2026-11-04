// YESTERDAY 애니 이펙트 부품 4 — 속도선 (동작연출지침서 14-1 ④).
// 강공격 이상: 공격 방향으로 화면을 가로지르는 가는 선 8~20줄을 4~8틱 동안. 길이는 40~200px(이 화면 60~300px)을 섞는다.
// 흐림 대신 속도감을 낸다 (14-5 '흐림 금지는 그대로'). 선은 공격 방향으로 빠르게 밀려가며 짧아지고 가늘어진다.
// 캐릭터 뒤 겹에 그린다 (두 사람 실루엣이 선 위에 그대로 보인다).
import { put, rng, type AFrame, type Layer } from './common';

export interface SpeedSpec {
  /** 선 다발 가운데 (월드 px)와 공격 방향 (라디안) */
  x: number;
  y: number;
  dir: number;
  /** 줄 수 (8~20), 지속 틱 (4~8) */
  count: number;
  ticks: number;
  /** 길이 범위 (px) */
  len: readonly [number, number];
  /** 다발이 퍼지는 폭 (공격 방향에 수직, px)과 공격 방향으로 흩어지는 범위 (px) */
  spread: number;
  reach: number;
  /** 색: 앞(밝은) → 뒤 */
  colors: readonly number[];
  /** 한 틱에 밀려가는 거리 (px) */
  speed?: number;
  layer?: Layer;
  seed?: number;
}

export default function speedLines(o: SpeedSpec) {
  const rand = rng(o.seed ?? 3);
  const cx = Math.cos(o.dir);
  const cy = Math.sin(o.dir);
  const lines = Array.from({ length: o.count }, (_, i) => {
    // 가운데 줄에 몰리게 (가운데는 많고 바깥은 듬성): 두 난수의 평균
    const off = ((rand() + rand()) / 2 - 0.5) * 2 * o.spread;
    const along = (rand() - 0.5) * o.reach;
    const len = o.len[0] + (o.len[1] - o.len[0]) * Math.pow(rand(), 0.8);
    // 꼬리 쪽 끊김 자리 (선마다 다르게: 점선처럼 고르지 않게)
    const cuts = Array.from({ length: 3 }, () => 0.05 + rand() * 0.35);
    return { off, along, len, cuts, col: o.colors[i % 3 === 0 ? 0 : Math.min(o.colors.length - 1, 1 + (i % (o.colors.length - 1 || 1)))]!, wide: rand() < 0.25, born: Math.floor(rand() * 2) };
  });
  const speed = o.speed ?? 26;
  const layer = o.layer ?? 'back';
  let t = 0;
  return {
    count: o.count,
    update(dt: number) {
      t += dt * 60;
    },
    done() {
      return t >= o.ticks + 2;
    },
    draw(f: AFrame, l?: Layer) {
      if ((l ?? 'back') !== layer) return;
      for (const ln of lines) {
        const age = t - ln.born;
        if (age < 0 || age >= o.ticks) continue;
        const k = age / o.ticks;
        // 앞으로 밀려가며 짧아진다
        const len = ln.len * (1 - 0.6 * k);
        const a = ln.along + speed * age;
        const sx = o.x + cx * a - cy * ln.off;
        const sy = o.y + cy * a + cx * ln.off;
        const n = Math.ceil(len);
        for (let s = 0; s <= n; s++) {
          // 뒤쪽 끝은 군데군데 끊긴다 (꼬리): 끊김 자리 셋 둘레 2~4px, 진행할수록 넓게
          const u = 1 - s / n;
          let gap = false;
          for (const c of ln.cuts) if (Math.abs(u - c) * ln.len < 1 + 3 * k) gap = true;
          if (gap) continue;
          const x = sx - cx * s;
          const y = sy - cy * s;
          put(f, x, y, ln.col);
          if (ln.wide && k < 0.5 && s > n * 0.4) put(f, x - cy, y + cx, ln.col);
        }
      }
    },
  };
}
