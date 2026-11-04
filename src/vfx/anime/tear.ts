// YESTERDAY 애니 이펙트 부품 3 — 찢어진 꼬리 (동작연출지침서 14-1 ③).
// 꼬리는 공격 방향 앞끝이다 (사용자 피드백 2026-11-04 '힘이 상대를 관통해 앞으로 터져 나가게, 찢어진 꼬리도 앞쪽 끝에서 흩어지게').
// 면은 앞쪽 scatter 비율에서 끝나고, 거기서 K가닥(3~7)이 앞으로 퍼지며 뻗는다. 가닥마다 길이·각·굵기가 들쭉날쭉하다.
// 면 안에는 앞끝에서 뒤로 들어오는 1px 틈(결)이 저마다 다른 길이로 나 있다.
// p(찢어지는 진행)가 0 → 1로 가며 면이 끝나는 자리가 주먹 쪽으로 내려오고 (14-2 '꼬리부터 가닥으로 찢어지며 얇아진다'),
// 틈은 넓어지고, 가닥은 가늘어지며 앞으로 날아간다.

export interface Tear {
  /** 가닥 수 */
  K: number;
  /** 피크 때 가닥으로 갈라진 앞쪽 비율 (0~1) */
  scatter: number;
  /** 가닥마다: 가로 자리 (−1~1), 퍼지는 각 (라디안, 바깥 가닥일수록 크다), 띠 끝을 넘어 뻗는 비율, 갈라지는 자리 흔들림 (u), 굵기 비율 */
  lane: Float32Array;
  ang: Float32Array;
  reach: Float32Array;
  root: Float32Array;
  width: Float32Array;
  /** 면 안 결: 가로 자리 (−1~1)와 앞끝에서 뒤로 들어오는 길이 (u) */
  gaps: Array<{ v: number; len: number }>;
}

/** 가닥 K개 · 결 G개. spread: 가장 바깥 가닥이 퍼지는 각 (라디안) */
export function tear(K: number, scatter: number, spread: number, rand: () => number, G = 3): Tear {
  const lane = new Float32Array(K);
  const ang = new Float32Array(K);
  const reach = new Float32Array(K);
  const root = new Float32Array(K);
  const width = new Float32Array(K);
  for (let k = 0; k < K; k++) {
    const v = -0.8 + (1.6 * (k + 0.5)) / K + (rand() - 0.5) * (0.6 / K);
    lane[k] = v;
    ang[k] = spread * v * (0.6 + rand() * 0.6);
    // 가운데 가닥이 대체로 멀리, 바깥은 짧게 (들쭉날쭉)
    reach[k] = (0.55 + 0.45 * (1 - Math.abs(v))) * (0.7 + rand() * 0.6);
    root[k] = (rand() - 0.5) * 0.08;
    width[k] = 0.7 + rand() * 0.5;
  }
  const gaps: Tear['gaps'] = [];
  for (let g = 0; g < G; g++) gaps.push({ v: -0.6 + (1.2 * (g + 0.5)) / G + (rand() - 0.5) * 0.2, len: 0.08 + rand() * 0.3 });
  return { K, scatter, lane, ang, reach, root, width, gaps };
}

/** 면이 끝나는 자리 u (진행 p에서): 피크 1 − scatter → 끝에 0.08 */
export const solidFront = (T: Tear, p: number): number => 1 - T.scatter - (0.92 - T.scatter) * p;

/**
 * 면 안 결 (틈)에 걸리는가: u 길 위 자리, vn 가로 자리 (−1~1), half 이 자리 반두께 (px), front 면이 끝나는 자리, p 진행
 */
export function inGap(T: Tear, u: number, vn: number, half: number, front: number, p: number): boolean {
  for (const g of T.gaps) {
    if (u < front - g.len * (1 + p)) continue;
    const d = Math.abs(vn - g.v) * half;
    if (d < 0.5 + 1.5 * p) return true;
  }
  return false;
}
