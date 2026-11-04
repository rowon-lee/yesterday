// YESTERDAY 애니 이펙트 부품 5 — 가시 파편 (동작연출지침서 14-1 ⑤).
// 맞는 지점에서 날카로운 삼각 가시가 튄다. 흰색 + 보색. 동그란 고리를 대신한다.
// 사용자 피드백 2026-11-04: 가시는 공격 방향(앞쪽)으로만 방사한다 (뒤·위아래 십자 별 없이). 부채꼴·수·길이·굵기는 타마다 다르게 넘긴다.
// 0틱에 다 뻗은 채로 나타나 hold틱 그대로, 그 뒤 뿌리가 떨어져 바깥으로 날아가며 가늘어지고 짧아진다. 앞 겹에 그린다 (맞는 쪽을 덮는다: 14-5).
import { put, rng, tri, type AFrame, type Layer } from './common';

export interface SpikeSpec {
  /** 맞은 자리 (월드 px), 공격 방향 (라디안) */
  x: number;
  y: number;
  dir: number;
  count: number;
  /** 길이 범위 (px): 부채꼴 가운데가 가장 길다 */
  len: readonly [number, number];
  /** 부채꼴 (라디안, 공격 방향 기준 [시작, 끝]: 화면 y가 아래로 +라서 −가 위쪽). 보는 쪽은 부르는 쪽이 이미 반영해 넘긴다 */
  fan?: readonly [number, number];
  /** 뿌리 굵기 (px) */
  base?: number;
  /** 흰색과 보색 (가시의 한쪽 면) */
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
  const [f0, f1] = o.fan ?? [-0.6, 0.6];
  const mid = (f0 + f1) / 2;
  const half = Math.max(1e-3, (f1 - f0) / 2);
  const list = Array.from({ length: o.count }, (_, i) => {
    // 부채꼴 안에 고르게, 조금씩 흔들어서. 가운데가 길고 가장자리가 짧다
    const u = o.count === 1 ? 0.5 : i / (o.count - 1);
    const off = f0 + (f1 - f0) * u + (rand() - 0.5) * ((f1 - f0) / Math.max(2, o.count)) * 0.6;
    const center = 1 - Math.min(1, Math.abs(off - mid) / half);
    const len = (o.len[0] + (o.len[1] - o.len[0]) * (0.3 + 0.7 * center)) * (0.85 + rand() * 0.3);
    return { a: o.dir + off, len, base: (o.base ?? 3) * (0.7 + rand() * 0.5), r0: 2 + rand() * 3, side: rand() < 0.5 ? -1 : 1 };
  });
  const layer = o.layer ?? 'front';
  let t = 0;
  return {
    count: o.count,
    /** 확인용: 가장 짧은·긴 가시 길이 */
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
