// YESTERDAY 길티기어식 이펙트 (동작연출지침서 14-8) — 큰 모양 만들기 (렌더 전용).
// 모양마다 숫자(data/vfx)로 다각형을 만든다. 좌표는 오른쪽 보기 기준 px (x 앞 +, y 아래 +), 그릴 때 뒤집고 옮긴다.
// k = 지금 두께 비 (피크 1 → 사라질 때 0): 14-8 시간 '두께부터 빠르게 얇아진다'.
import type { GBolt, GFlash, GInk, GPt, GRays, GRing, GSwoosh, GTone, GWedge } from '../../data/vfx/types';

/** 칠할 것: 색 단계와 고리들. sep = 고리마다 따로 칠한다 (겹쳐도 구멍이 나지 않게), 아니면 짝홀 규칙으로 한 번에 */
export interface Paint {
  tone: GTone;
  rings: number[][];
  sep?: boolean;
}

const D2R = Math.PI / 180;

/** 두께 곡선 (0~1): 양 끝이 뾰족하고 peak에서 가장 두껍다. ba·bf는 뒤·앞 끝으로 가는 모양 */
export function profile(u: number, peak: number, ba: number, bf: number): number {
  if (u <= 0 || u >= 1) return 0;
  return u < peak ? Math.pow(u / peak, ba) : Math.pow((1 - u) / (1 - peak), bf);
}

/**
 * 가운데 선을 따라가는 띠 하나 (고리 하나). C(u) = 가운데 점, N(u) = 위쪽(바깥) 단위 법선, H(u) = 두께, skew = 위쪽으로 두께 몰기.
 * u0 → u1을 n칸으로
 */
function band(C: (u: number) => GPt, N: (u: number) => GPt, H: (u: number) => number, skew: number, u0: number, u1: number, n: number): number[] {
  const up: number[] = [];
  const dn: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const [x, y] = C(u);
    const [nx, ny] = N(u);
    const h = Math.max(0, H(u));
    const a = (h * (1 + skew)) / 2;
    const b = (h * (1 - skew)) / 2;
    up.push(x + nx * a, y + ny * a);
    dn.push(x - nx * b, y - ny * b);
  }
  const ring = up.slice();
  for (let i = dn.length - 2; i >= 0; i -= 2) ring.push(dn[i]!, dn[i + 1]!);
  return ring;
}

/** 셀 3단 띠 (바깥 → 주색 → 심): 단마다 두께 비와 길이 비 (peak 둘레로 줄인다) */
function cel3(
  C: (u: number) => GPt,
  N: (u: number) => GPt,
  w: number,
  peak: number,
  ba: number,
  bf: number,
  skew: number,
  len: number,
  o: { main?: number; core?: number; coreLen?: number; edge?: GTone },
): Paint[] {
  const n = Math.max(10, Math.ceil(len / 3));
  const level = (ratioT: number, ratioL: number): number[] => {
    const uA = peak - peak * ratioL;
    const uB = peak + (1 - peak) * ratioL;
    return band(C, N, (u) => w * ratioT * profile((u - uA) / (uB - uA), peak, ba, bf), skew, uA, uB, n);
  };
  const out: Paint[] = [{ tone: o.edge ?? 2, rings: [level(1, 1)] }];
  const main = o.main ?? 0.66;
  const core = o.core ?? 0.3;
  if (w * main >= 1.2) out.push({ tone: 1, rings: [level(main, 0.95)] });
  if (w * core >= 0.9) out.push({ tone: 0, rings: [level(core, o.coreLen ?? 0.78)] });
  return out;
}

/**
 * 사라지는 띠가 선처럼 보이는가: 가장 두꺼운 곳이 4px 아래 (처음부터 가는 속도선 쐐기는 처음 두께의 60% 아래)이거나,
 * 길이가 두께의 24배 (처음부터 가늘고 긴 것은 처음 비율의 1.5배)를 넘으면 그리지 않는다
 */
function thin(w: number, len: number, k: number, lk: number): boolean {
  const wk = w * k;
  if (wk < Math.min(4, w * 0.6)) return true;
  return len * lk > wk * Math.max(24, (len / w) * 1.5);
}

/** 빛 쐐기·빛기둥 (문법 1·4) */
export function wedge(s: GWedge, k: number): Paint[] {
  // 얇아지면서 길이도 줄인다. 너무 얇아지면 (thin) 그리지 않는다: 사라지는 동안 긴 1~2px 선이 남지 않게
  const lk = 0.4 + 0.6 * k;
  if (thin(s.w, s.fwd + s.back, k, lk)) return [];
  const a = s.angle * D2R;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const back = s.back * lk;
  const L = s.fwd * lk + back;
  const C = (u: number): GPt => [s.at[0] + dx * (-back + L * u), s.at[1] + dy * (-back + L * u)];
  const N = (): GPt => [dy, -dx];
  const [ba, bf] = s.bulge ?? [0.8, 0.9];
  // 사라질 때 길이도 조금 줄인다 (두께가 먼저)
  return cel3(C, N, s.w * k, s.peak ?? 0.4, ba, bf, s.skew ?? 0, L, s);
}

/** 스우시 띠 (문법 1): 원호를 따라 휘는 띠, 두께는 꼬리(u 0) → 머리(u 1) */
export function swoosh(s: GSwoosh, k: number): Paint[] {
  if (thin(s.w, Math.abs(s.a1 - s.a0) * D2R * s.r * Math.max(s.sx ?? 1, s.sy ?? 1), k, 0.5 + 0.5 * k)) return [];
  const sx = s.sx ?? 1;
  const sy = s.sy ?? 1;
  // 납작한 원을 기울인다 (꼭대기가 수평으로 길게 눕지 않게: 자로 그은 테두리 방지)
  const rc = Math.cos((s.rot ?? 0) * D2R);
  const rs = Math.sin((s.rot ?? 0) * D2R);
  // 얇아지면서 꼬리 쪽부터 짧아진다
  const a1 = s.a1 * D2R;
  const a0 = a1 + (s.a0 * D2R - a1) * (0.5 + 0.5 * k);
  const C = (u: number): GPt => {
    const a = a0 + (a1 - a0) * u;
    const x = Math.cos(a) * s.r * sx;
    const y = Math.sin(a) * s.r * sy;
    return [s.c[0] + x * rc - y * rs, s.c[1] + x * rs + y * rc];
  };
  // 바깥 법선 (납작한 원은 반지름 비로 바로잡는다)
  const N = (u: number): GPt => {
    const a = a0 + (a1 - a0) * u;
    const nx = Math.cos(a) * sy;
    const ny = Math.sin(a) * sx;
    const l = Math.hypot(nx, ny) || 1;
    return [(nx * rc - ny * rs) / l, (nx * rs + ny * rc) / l];
  };
  const [ba, bf] = s.bulge ?? [0.9, 0.7];
  const len = Math.abs(a1 - a0) * s.r * Math.max(sx, sy);
  return cel3(C, N, s.w * k, s.peak ?? 0.62, ba, bf, s.skew ?? 0.2, len, s);
}

/** 굵은 번개의 점 (점을 직접 주거나 원호 + 꺾임) */
export function boltPoints(s: GBolt): GPt[] {
  if (s.pts) return s.pts.slice();
  const a = s.arc!;
  const sx = a.sx ?? 1;
  const sy = a.sy ?? 1;
  const at = (u: number, off: number): GPt => {
    const t = (a.a0 + (a.a1 - a.a0) * u) * D2R;
    const r = a.r + off;
    return [a.c[0] + Math.cos(t) * r * sx, a.c[1] + Math.sin(t) * r * sy];
  };
  const pts: GPt[] = [at(0, 0)];
  for (const [u, off] of a.kinks) pts.push(at(u, off));
  pts.push(at(1, 0));
  return pts;
}

/**
 * 굵은 번개 (문법 6): 마디마다 사각형 (마디 끝을 반두께만큼 늘려 꺾인 곳이 날카롭게), 끝은 뾰족한 삼각형.
 * 어두운 테두리 1px (tone 3) → 몸 (tone 1) → 심 (tone 0). 가지 번개는 같은 방법으로 가늘게
 */
export function bolt(s: GBolt, k: number): Paint[] {
  // 가장 굵은 곳이 2.5px 아래로 얇아지면 그리지 않는다 (사라지는 동안 1px 번개 선이 남지 않게: 14-8 ⑥ 굵기 3~5px)
  if (Math.max(s.w0, s.wPeak ?? 0, s.w1) * k < 2.5) return [];
  const pts = boltPoints(s);
  /** 굵기 곡선: w0 → (peak에서 wPeak) → w1 */
  const widthAt = (u: number, w0: number, w1: number, wp?: number): number => {
    if (wp === undefined) return w0 + (w1 - w0) * u;
    const p = s.peak ?? 0.5;
    return u < p ? w0 + (wp - w0) * (u / p) : wp + (w1 - wp) * ((u - p) / (1 - p));
  };
  const quads = (P: GPt[], w0: number, w1: number, extra: number, wp?: number, minHalf = 0.8): number[][] => {
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1]! + Math.hypot(P[i]![0] - P[i - 1]![0], P[i]![1] - P[i - 1]![1]));
    const L = cum[cum.length - 1]! || 1;
    const out: number[][] = [];
    for (let i = 0; i + 1 < P.length; i++) {
      const [x0, y0] = P[i]!;
      const [x1, y1] = P[i + 1]!;
      const l = Math.hypot(x1 - x0, y1 - y0) || 1;
      const dx = (x1 - x0) / l;
      const dy = (y1 - y0) / l;
      const b0 = (widthAt(cum[i]! / L, w0, w1, wp) * k) / 2;
      const b1 = (widthAt(cum[i + 1]! / L, w0, w1, wp) * k) / 2;
      // 몸 굵기가 1.6px 아래인 마디는 그리지 않는다 (테두리도 같이): 사라지는 동안 가는 끝부터 짧아져 1px 꼬리가 남지 않게
      if (b0 < minHalf && b1 < minHalf) continue;
      const h0 = b0 + extra;
      const h1 = b1 + extra;
      const e0 = i > 0 ? h0 * 0.9 : 0;
      const e1 = i + 2 < P.length ? h1 * 0.9 : 0;
      const ax = x0 - dx * e0;
      const ay = y0 - dy * e0;
      const bx = x1 + dx * e1;
      const by = y1 + dy * e1;
      out.push([ax - dy * h0, ay + dx * h0, bx - dy * h1, by + dx * h1, bx + dy * h1, by - dx * h1, ax + dy * h0, ay - dx * h0]);
      // 끝: 뾰족하게
      if (i + 2 === P.length) {
        const tl = h1 * 2.4 + extra;
        out.push([bx - dy * h1, by + dx * h1, bx + dx * tl, by + dy * tl, bx + dy * h1, by - dx * h1]);
      }
    }
    return out;
  };
  const forks: GPt[][] = (s.forks ?? []).map(([u, ang, len]) => {
    // 마디 자리 u (전체 길이 비)
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    const L = cum[cum.length - 1]!;
    let i = 0;
    while (i + 2 < pts.length && cum[i + 1]! < u * L) i++;
    const t = (u * L - cum[i]!) / Math.max(1e-6, cum[i + 1]! - cum[i]!);
    const x = pts[i]![0] + (pts[i + 1]![0] - pts[i]![0]) * t;
    const y = pts[i]![1] + (pts[i + 1]![1] - pts[i]![1]) * t;
    const base = Math.atan2(pts[i + 1]![1] - pts[i]![1], pts[i + 1]![0] - pts[i]![0]) + ang * D2R;
    // 가지도 한 번 꺾인다 (마디 둘)
    const mx = x + Math.cos(base) * len * 0.55 + Math.cos(base + Math.PI / 2) * len * 0.12;
    const my = y + Math.sin(base) * len * 0.55 + Math.sin(base + Math.PI / 2) * len * 0.12;
    return [[x, y], [mx, my], [x + Math.cos(base) * len, y + Math.sin(base) * len]];
  });
  const fw0 = Math.max(1.5, Math.max(s.w0, s.wPeak ?? 0) * 0.5);
  const out: Paint[] = [];
  // 테두리: 몸과 가지를 1px 넓게
  out.push({ tone: 3, rings: [...quads(pts, s.w0, s.w1, 1, s.wPeak), ...forks.flatMap((f) => quads(f, fw0, 1, 1))], sep: true });
  out.push({ tone: 1, rings: [...quads(pts, s.w0, s.w1, 0, s.wPeak), ...forks.flatMap((f) => quads(f, fw0, 1, 0))], sep: true });
  // 심: 굵기의 38% (가장 굵은 곳 기준 1px 이상일 때)
  const cw = Math.max(s.w0, s.wPeak ?? 0, s.w1) * 0.38;
  if (cw * k >= 0.8) out.push({ tone: 0, rings: quads(pts, s.w0 * 0.38, s.w1 * 0.3, 0, s.wPeak !== undefined ? s.wPeak * 0.38 : undefined, 0.35), sep: true });
  return out;
}

/** 잉크 쐐기 (문법 3): 뿌리에서 끝으로 뾰족, 위쪽 날에 톱니 */
export function ink(s: GInk, k: number): Paint[] {
  const a = s.angle * D2R;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = dy;
  const ny = -dx;
  const w = s.w * k;
  const lk = 0.4 + 0.6 * k;
  if (thin(s.w, s.len, k, lk)) return [];
  const len = s.len * lk;
  const make = (grow: number): number[] => {
    const P = (u: number, side: number, inset = 0): [number, number] => {
      const h = (w / 2) * (1 - u) + grow - inset;
      return [s.at[0] + dx * (len * u - grow * 0.5) + nx * h * side, s.at[1] + dy * (len * u - grow * 0.5) + ny * h * side];
    };
    const ring: number[] = [];
    ring.push(...P(0, 1));
    for (const [u, d] of s.notch ?? []) {
      ring.push(...P(u - 0.035, 1));
      ring.push(...P(u, 1, d * k));
      ring.push(...P(u + 0.01, 1));
    }
    ring.push(s.at[0] + dx * (len + grow * 1.6), s.at[1] + dy * (len + grow * 1.6));
    ring.push(...P(0, -1));
    return ring;
  };
  // 테두리는 따로 줄 때만 (기본 없음): 밤 배경으로 삐져나온 곳에서 1px 붉은 선이 되므로, 잉크는 밝은 모양을 가로질러 그 위에서만 보이게 둔다
  const rim = s.rim ?? -1;
  return [...(rim >= 0 ? [{ tone: rim as GTone, rings: [make(1)] }] : []), { tone: 3 as GTone, rings: [make(0)] }];
}

/**
 * 큰 원 고리 (문법 5): 두께가 한쪽에서 가장 두껍고 (w) 반대쪽은 2px, 끊긴 곳은 비운다. 사라질 때 조금 커진다.
 * 사라지는 동안 두께부터 줄고, 2px 아래로 얇아진 곳은 그리지 않는다: 얇은 쪽부터 끊겨 두꺼운 쪽 호만 남다가 사라진다
 * (1~2px 고리가 길게 남아 가는 선처럼 보이지 않게)
 */
export function ring(s: GRing, k: number, at: GPt): Paint[] {
  const r = s.r * (1 + 0.1 * (1 - k));
  const sy = s.sy ?? 1;
  const thick = (s.thick ?? -150) * D2R;
  const t0 = 2;
  const t = (a: number) => (t0 + (s.w - t0) * Math.pow(Math.max(0, Math.cos(a - thick)), 2)) * k;
  if (s.w * k < t0) return [];
  // 끊긴 곳을 뺀 각 구간
  const gaps = (s.gaps ?? []).map(([g0, g1]) => [g0 * D2R, g1 * D2R] as const);
  const inGap = (a: number) => gaps.some(([g0, g1]) => {
    let x = a - g0;
    x -= Math.floor(x / (2 * Math.PI)) * 2 * Math.PI;
    return x < g1 - g0;
  });
  // 마디는 3px 안팎 (마디가 길면 고리 꼭대기·밑이 자로 그은 듯 평평해진다)
  const steps = Math.max(64, Math.ceil(r * 2));
  const rings: number[][] = [];
  let cur: number[][] | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const h = t(a);
    if (inGap(a) || h < t0 - 1e-6 || i === steps) {
      if (cur && cur.length > 1) rings.push(closeArc(cur, at, r, sy));
      cur = null;
      continue;
    }
    if (!cur) cur = [];
    cur.push([a, h / 2]);
  }
  return [{ tone: s.tone ?? 4, rings, sep: true }];
}
/** 고리 한 구간 (바깥 호 → 안쪽 호). 납작한 고리도 두께는 화면 px 그대로 (세로로 눌러 두께까지 얇아지지 않게) */
function closeArc(seg: number[][], at: GPt, r: number, sy: number): number[] {
  const out: number[] = [];
  for (const [a, h] of seg) out.push(at[0] + Math.cos(a!) * (r + h!), at[1] + Math.sin(a!) * (r * sy + h!));
  for (let i = seg.length - 1; i >= 0; i--) {
    const [a, h] = seg[i]!;
    out.push(at[0] + Math.cos(a!) * (r - h!), at[1] + Math.sin(a!) * (r * sy - h!));
  }
  return out;
}

/** 방사 속도선 (문법 5): 바깥 뿌리가 굵고 안쪽 끝이 뾰족한 가시. 사라질 때 안쪽 끝이 바깥으로 물러난다 */
export function rays(s: GRays, k: number, at: GPt): Paint[] {
  const byTone = new Map<GTone, number[][]>();
  for (const [ang, r0, r1, b, tone] of s.lines) {
    const a = ang * D2R;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const ri = r1 + (r0 - r1) * (1 - k);
    // 뿌리 폭은 그대로 두고 안쪽 끝만 물러나 짧은 가시가 되어 사라진다 (얇아지며 긴 가는 선이 남지 않게)
    if (r0 - ri < 5) continue;
    const bw = b;
    const ring = [
      at[0] + dx * r0 - dy * bw, at[1] + dy * r0 + dx * bw,
      at[0] + dx * ri, at[1] + dy * ri,
      at[0] + dx * r0 + dy * bw, at[1] + dy * r0 - dx * bw,
    ];
    if (!byTone.has(tone)) byTone.set(tone, []);
    byTone.get(tone)!.push(ring);
  }
  return [...byTone].map(([tone, rings]) => ({ tone, rings, sep: true }));
}

/** 섬광 (문법 5): 맞은 점의 날카로운 별. 바깥 테 (tone 4) → 흰 심 (tone 0) */
export function flash(s: GFlash, k: number, at: GPt): Paint[] {
  if (k <= 0.1) return [];
  const kites = (grow: number, add: number): number[][] =>
    s.spikes.map(([ang, len, hw]) => {
      const a = ang * D2R;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const L = len * grow * Math.pow(k, 0.7) + add;
      const W = hw * grow + add * 0.5;
      return [
        at[0] + dx * L, at[1] + dy * L,
        at[0] - dy * W, at[1] + dx * W,
        at[0] - dx * W * 1.2, at[1] - dy * W * 1.2,
        at[0] + dy * W, at[1] - dx * W,
      ];
    });
  return [
    { tone: 4, rings: kites(1.18, 1.5), sep: true },
    { tone: 0, rings: kites(1, 0), sep: true },
  ];
}
