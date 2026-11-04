// YESTERDAY 애니 이펙트 부품 1 — 꽉 찬 면 (동작연출지침서 14-1 ① '면이다, 선이 아니다').
// 궤적은 속이 꽉 찬 쐐기·띠·빔이다. 길(꼬리 → 머리)을 따라 두께가 있는 면을 한 번 래스터로 깔아 두고
// (칸마다 길 위 자리 u·중심선에서 떨어진 거리 v·판정 범위 가장자리까지 거리 rd), 프레임마다 그 값으로 색만 정한다.
// 두께는 머리에서 가장 두껍고 꼬리로 갈수록 taper만큼 줄어든다 (쐐기). 머리 앞은 cap px만큼 둥글게 마감한다.
import { clamp01 } from './common';

export interface SweepSpec {
  /** 지나는 길 (월드 px, 꼬리 → 머리). 점 몇 개면 되고 촘촘히 다시 찍는다. 굽은 길은 점을 2px쯤 간격으로 */
  path: ReadonlyArray<readonly [number, number]>;
  /** 머리 두께 (px) */
  width: number;
  /** 꼬리 끝 두께 비율 (기본 0.55: 쐐기) */
  taper?: number;
  /** 머리 앞 둥근 마감 길이 (px, 기본 두께의 1/3) */
  cap?: number;
  /** 모양이 흔들릴 여유 (px): 가장자리 꺾임 크기만큼 래스터를 넓게 깐다 */
  slack?: number;
  /** 바닥 y (월드): 이보다 아래(+)는 깔지 않는다 */
  floor?: number;
  /** 판정 범위 (월드 px 자리 → 안이면 true). 없으면 범위 없음 (흰 심 없음) */
  range?: (x: number, y: number) => boolean;
}

export interface Sweep {
  /** 래스터 왼쪽 위 (월드 px)와 크기 */
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** 칸 수와 칸마다: 래스터 자리(y·w + x), 길 표본 번호, 중심선에서 떨어진 거리 (px, 부호 있음), 판정 범위 가장자리까지 거리 (px, 0 = 범위 밖) */
  n: number;
  at: Int32Array;
  s: Int32Array;
  v: Float32Array;
  rd: Uint8Array;
  /** 길 표본 (DS px 간격): 자리, 접선, 0~1 (꼬리 → 머리), 기본 반두께 (px) */
  N: number;
  px: Float32Array;
  py: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  u: Float32Array;
  hw: Float32Array;
  /** 길 전체 길이 (px) */
  len: number;
  /** 판정 범위 안 칸 수 (흰 심이 들어갈 자리가 있는가) */
  inRange: number;
  /** 중심선이 판정 범위에 처음 들어가는 자리 u (머리가 시작하는 곳, 범위가 없으면 1) */
  uRange: number;
}

/** 길 표본 간격 (px): 굽은 길 바깥쪽에서도 칸이 비지 않게 촘촘히 */
export const DS = 0.4;

export function sweep(o: SweepSpec): Sweep {
  const P = o.path;
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < P.length; i++) {
    const l = Math.hypot(P[i]![0] - P[i - 1]![0], P[i]![1] - P[i - 1]![1]);
    seg.push(l);
    total += l;
  }
  total = Math.max(total, 1);
  const N = Math.max(2, Math.ceil(total / DS) + 1);
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  for (let k = 0, i = 0, acc = 0; k < N; k++) {
    const d = (total * k) / (N - 1);
    while (i < seg.length - 1 && d > acc + seg[i]!) acc += seg[i++]!;
    const a = P[i]!;
    const b = P[i + 1] ?? a;
    const t = clamp01((d - acc) / (seg[i] || 1));
    px[k] = a[0] + (b[0] - a[0]) * t;
    py[k] = a[1] + (b[1] - a[1]) * t;
  }
  // 접선: 앞뒤 3표본(약 1.2px) 차이로 (꼭짓점에서 법선이 한 번에 꺾여 바깥에 틈이 나지 않게)
  const tx = new Float32Array(N);
  const ty = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const a = Math.max(0, k - 3);
    const b = Math.min(N - 1, k + 3);
    const dx = px[b]! - px[a]!;
    const dy = py[b]! - py[a]!;
    const l = Math.hypot(dx, dy) || 1;
    tx[k] = dx / l;
    ty[k] = dy / l;
  }
  const taper = o.taper ?? 0.55;
  const cap = o.cap ?? o.width / 3;
  const u = new Float32Array(N);
  const hw = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const uk = k / (N - 1);
    u[k] = uk;
    // 쐐기: 꼬리 taper → 머리 1 (앞쪽 절반에서 거의 다 두꺼워진다)
    let prof = taper + (1 - taper) * Math.pow(uk, 0.6);
    const fromHead = (1 - uk) * total;
    if (fromHead < cap) prof *= Math.sqrt(Math.max(0, 1 - (1 - fromHead / cap) ** 2));
    hw[k] = (o.width / 2) * prof;
  }
  const slack = o.slack ?? 0;
  const floor = o.floor ?? Infinity;
  // 래스터 둘레
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < N; k++) {
    const r = hw[k]! + slack + 1;
    minX = Math.min(minX, px[k]! - r);
    maxX = Math.max(maxX, px[k]! + r);
    minY = Math.min(minY, py[k]! - r);
    maxY = Math.max(maxY, py[k]! + r);
  }
  maxY = Math.min(maxY, floor);
  const x0 = Math.floor(minX);
  const y0 = Math.floor(minY);
  const w = Math.max(1, Math.ceil(maxX) - x0 + 1);
  const h = Math.max(1, Math.ceil(maxY) - y0 + 1);
  const best = new Float32Array(w * h).fill(Infinity);
  const bs = new Int32Array(w * h);
  const bv = new Float32Array(w * h);
  // 표본마다 법선 방향으로 −r~+r를 0.45px 간격으로 찍는다. 한 칸에 여러 번 닿으면 중심선에 가장 가까운 것
  for (let k = 0; k < N; k++) {
    const r = hw[k]! + slack;
    const nx = -ty[k]!;
    const ny = tx[k]!;
    for (let s = -r; s <= r; s += 0.45) {
      const X = Math.round(px[k]! + nx * s);
      const Y = Math.round(py[k]! + ny * s);
      if (Y > floor) continue;
      const j = (Y - y0) * w + (X - x0);
      if (j < 0 || j >= w * h) continue;
      const a = Math.abs(s);
      if (a < best[j]!) {
        best[j] = a;
        bs[j] = k;
        bv[j] = s;
      }
    }
  }
  // 판정 범위 안 칸과 범위 가장자리까지 거리 (모따기 거리: 가로·세로 1, 대각 1.4)
  const dist = new Float32Array(w * h);
  let inRange = 0;
  if (o.range) {
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) dist[Y * w + X] = o.range(x0 + X, y0 + Y) ? 99 : 0;
    const at = (X: number, Y: number) => (X < 0 || Y < 0 || X >= w || Y >= h ? 0 : dist[Y * w + X]!);
    for (let Y = 0; Y < h; Y++) {
      for (let X = 0; X < w; X++) {
        const j = Y * w + X;
        if (!dist[j]) continue;
        dist[j] = Math.min(dist[j]!, at(X - 1, Y) + 1, at(X, Y - 1) + 1, at(X - 1, Y - 1) + 1.4, at(X + 1, Y - 1) + 1.4);
      }
    }
    for (let Y = h - 1; Y >= 0; Y--) {
      for (let X = w - 1; X >= 0; X--) {
        const j = Y * w + X;
        if (!dist[j]) continue;
        dist[j] = Math.min(dist[j]!, at(X + 1, Y) + 1, at(X, Y + 1) + 1, at(X + 1, Y + 1) + 1.4, at(X - 1, Y + 1) + 1.4);
      }
    }
  }
  const list: number[] = [];
  for (let j = 0; j < w * h; j++) if (best[j]! < Infinity) list.push(j);
  const n = list.length;
  const at = new Int32Array(n);
  const s = new Int32Array(n);
  const v = new Float32Array(n);
  const rd = new Uint8Array(n);
  list.forEach((j, c) => {
    at[c] = j;
    s[c] = bs[j]!;
    v[c] = bv[j]!;
    rd[c] = Math.min(255, Math.round(dist[j]!));
    if (rd[c]) inRange++;
  });
  let uRange = 1;
  if (o.range) {
    for (let k = 0; k < N; k++) {
      if (o.range(px[k]!, py[k]!)) {
        uRange = u[k]!;
        break;
      }
    }
  }
  return { x0, y0, w, h, n, at, s, v, rd, N, px, py, tx, ty, u, hw, len: total, inRange, uRange };
}
