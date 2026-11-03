// YESTERDAY 애니 이펙트 부품 5 — 가시 파편 (동작연출지침서 14-1 ⑤).
// 맞는 지점에서 날카로운 삼각 가시 5~9개(일반 3~5)가 방사형으로 튄다. 길이 16~48px(이 화면 24~72px), 흰색 + 보색. 동그란 고리를 대신한다.
// 0틱에 다 뻗은 채로 나타나 1~2틱 그대로, 그 뒤 뿌리가 떨어져 바깥으로 날아가며 가늘어지고 짧아진다.
// 공격 방향 쪽 가시가 가장 길다. 앞 겹에 그린다 (맞는 쪽을 덮는다: 14-5).
import { put, rng, tri, type AFrame, type Layer } from './common';

export interface SpikeSpec {
  /** 맞은 자리 (월드 px), 공격 방향 (라디안) */
  x: number;
  y: number;
  dir: number;
  count: number;
  /** 길이 범위 (px) */
  len: readonly [number, number];
  /** 흰색과 보색 (가시의 한쪽 면·테두리) */
  white: number;
  rim: number;
  /** 유지 틱, 전체 틱 */
  hold?: number;
  ticks?: number;
  layer?: Layer;
  seed?: number;
}

export default function spikes(o: SpikeSpec) {
  const rand = rng(o.seed ?? 5);
  const hold = o.hold ?? 2;
  const ticks = o.ticks ?? 7;
  const list = Array.from({ length: o.count }, (_, i) => {
    // 고르게 돌리되 공격 방향에 하나를 둔다. 공격 방향 쪽은 길고 뒤쪽은 짧다
    const a = o.dir + (i / o.count) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / o.count);
    const front = Math.max(0, Math.cos(a - o.dir));
    const len = (o.len[0] + (o.len[1] - o.len[0]) * (0.35 + 0.65 * front) * (0.75 + rand() * 0.25)) * (i === 0 ? 1.1 : 1);
    return { a, len, base: 2 + rand() * 2.2, r0: 2 + rand() * 3, side: rand() < 0.5 ? -1 : 1 };
  });
  const layer = o.layer ?? 'front';
  let t = 0;
  return {
    count: o.count,
    /** 확인용: 가장 긴·짧은 가시 길이 */
    lengths(): [number, number] {
      const l = list.map((s) => s.len);
      return [Math.min(...l), Math.max(...l)];
    },
    update(dt: number) {
      t += dt * 60;
    },
    done() {
      return t >= ticks;
    },
    draw(f: AFrame, l?: Layer) {
      if ((l ?? 'front') !== layer || t >= ticks) return;
      const k = t <= hold ? 0 : (t - hold) / (ticks - hold);
      for (const s of list) {
        const ca = Math.cos(s.a);
        const sa = Math.sin(s.a);
        // 뿌리가 바깥으로 떨어져 나가고(날아감), 길이·굵기가 줄어든다
        const r0 = s.r0 + s.len * 0.55 * k;
        const r1 = r0 + s.len * (1 - 0.7 * k);
        const bw = s.base * (1 - 0.6 * k);
        const bx = o.x + ca * r0;
        const by = o.y + sa * r0;
        const tx = o.x + ca * r1;
        const ty = o.y + sa * r1;
        const nx = -sa * bw;
        const ny = ca * bw;
        // 흰 몸 + 한쪽 면 보색 (셀 두 단계)
        tri(f, bx + nx, by + ny, bx - nx, by - ny, tx, ty, o.white);
        if (k < 0.85) tri(f, bx + nx * s.side, by + ny * s.side, bx + nx * s.side * 0.2, by + ny * s.side * 0.2, tx, ty, o.rim);
        put(f, tx, ty, o.white);
      }
    },
  };
}
