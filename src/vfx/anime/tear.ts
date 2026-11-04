// YESTERDAY 애니 이펙트 부품 3 — 찢어진 꼬리 (동작연출지침서 14-1 ③ '머리는 두껍고 꼬리는 찢어진다').
// 앞쪽 가장자리는 굵고 밝다. 뒤로 갈수록 K가닥(3~7)으로 갈라지고, 가닥 길이가 들쭉날쭉한 붓 자국이 된다.
// 가닥 사이 틈은 꼬리에서 몸통 안쪽까지 저마다 다른 길이로 들어와 면에 결(줄무늬)을 낸다 (판정 머리 앞에서 멈춘다).
// p(찢어지는 진행)가 0 → 1로 가며 틈이 머리까지 올라오고 넓어지며 (14-2 '꼬리부터 가닥으로 찢어지며 얇아진다'),
// 가닥은 꼬리 쪽부터 짧아진다. 가닥 끝(꼬리 쪽)은 붓처럼 가늘어진다.
import { clamp01 } from './common';

export interface Tear {
  /** 가닥 수 */
  K: number;
  /** 피크 때 모든 틈이 열린 꼬리 비율 (0~1) */
  tail: number;
  /** 가닥마다: 피크 때 꼬리 쪽 끝 자리 u, 짧아지는 빠르기 */
  start: Float32Array;
  speed: Float32Array;
  /** 틈마다 (가닥 k와 k+1 사이, K−1개): 피크 때 틈이 들어오는 앞끝 u */
  gap: Float32Array;
}

/**
 * 가닥 K개. tail: 다 갈라진 꼬리 비율, head: 판정 머리가 시작하는 u (틈은 피크 때 그 앞에서 멈춘다)
 */
export function tear(K: number, tail: number, head: number, rand: () => number): Tear {
  const start = new Float32Array(K);
  const speed = new Float32Array(K);
  const gap = new Float32Array(Math.max(0, K - 1));
  for (let k = 0; k < K; k++) {
    const mid = 1 - Math.abs((k + 0.5) / K - 0.5) * 2;
    // 가운데 가닥은 꼬리 끝(0) 가까이까지, 바깥 가닥은 갈라진 곳 가까이에서 시작 (붓 자국), 들쭉날쭉하게
    start[k] = tail * clamp01(0.78 - 0.7 * mid + (rand() - 0.5) * 0.8);
    speed[k] = 0.8 + rand() * 0.7;
  }
  const reach = Math.max(tail, head - 0.04);
  for (let g = 0; g < K - 1; g++) gap[g] = tail + (reach - tail) * Math.pow(rand(), 0.7);
  return { K, tail, start, speed, gap };
}

/**
 * 이 칸이 남는가. u: 길 위 자리 (0 꼬리 → 1 머리), vn: 가닥을 가르는 가로 자리 (−1~1), half: 이 자리 반두께 (px), p: 찢어지는 진행 (0~1)
 */
export function torn(T: Tear, u: number, vn: number, half: number, p: number): boolean {
  const x = (vn + 1) * 0.5 * T.K;
  const k = Math.min(T.K - 1, Math.max(0, Math.floor(x)));
  const w = x - k;
  // 가닥의 꼬리 쪽 끝: 진행하며 앞으로 (짧아진다)
  const st = T.start[k]! + (1.05 - T.start[k]!) * clamp01(p * T.speed[k]!);
  if (u < st) return false;
  // 가장 가까운 틈 (가닥 경계)과의 거리 (px)
  const slot = (2 * half) / T.K;
  const nearLow = w < 0.5;
  const g = nearLow ? k - 1 : k;
  if (g < 0 || g >= T.K - 1) return true;
  const front = T.gap[g]! + (1.12 - T.gap[g]!) * p;
  if (u >= front) return true;
  const d = (nearLow ? w : 1 - w) * slot;
  // 틈 너비: 피크 1px → 진행하며 가닥이 가늘어진다. 가닥 끝 10%는 붓처럼 더 가늘다. 틈 앞끝 가까이는 좁게 닫힌다
  const brush = clamp01((u - st) / 0.1);
  const close = clamp01((front - u) / 0.06);
  const gw = (0.5 + slot * 0.42 * p + slot * 0.3 * (1 - brush)) * (0.4 + 0.6 * close);
  return d >= gw;
}
