// YESTERDAY 길티기어식 이펙트 (동작연출지침서 14-8 모양, 14-2 시간) — 큰 모양 만들기 (렌더 전용).
// 모양마다 숫자(data/vfx)로 다각형을 만든다. 좌표는 오른쪽 보기 기준 px (x 앞 +, y 아래 +), 그릴 때 뒤집고 옮긴다.
// 시간은 Phase 하나로 받는다 (14-2):
//   펼쳐짐 a: 0틱 1/3 → 1틱 0.75 → 2틱부터 1 (0틱은 전체 길이의 가는 섬광, 두께가 부풀며 덩어리가 된다)
//   살아 있는 정지: ls(살아 있는 틱)로 번개가 2틱마다 다시 꺾이고, 흰 심이 맥동하고, creep(정지한 틱)만큼 가시·끝이 조금씩 더 뻗는다
//   흩어짐 p: 꼬리부터 가닥으로 찢어져 공격 방향으로 흘러가고, 두께가 줄고, 바깥 단계 색부터 빠진다
// 너무 가늘어진 가닥(2.6px 아래)이나 두께에 비해 너무 긴 가닥은 그리지 않는다 (1px 선이 남지 않게).
import type { GBolt, GFlash, GInk, GPt, GRays, GRing, GSwoosh, GTone, GWedge } from '../../data/vfx/types';

/** 칠할 것: 색 단계와 고리들. sep = 고리마다 따로 칠한다 (겹쳐도 구멍이 나지 않게), 아니면 짝홀 규칙으로 한 번에 */
export interface Paint {
  tone: GTone;
  rings: number[][];
  sep?: boolean;
}

/** 시간 상태 (14-2) */
export interface Phase {
  /** 펼쳐짐 두께 비: 0틱 1/3 → 1틱 0.75 → 2틱부터 1 */
  a: number;
  /** 살아 있는 틱 (나타난 뒤, 히트스톱 동안도 흐른다. 정수) */
  ls: number;
  /** 살아 있는 정지로 자란 틱 (펼쳐진 뒤 흩어지기 전까지. 정수) */
  creep: number;
  /** 흩어짐 0 → 1 */
  p: number;
  /** 모양마다 다른 씨앗 (다시 꺾임·가닥 자리) */
  seed: number;
}

/** 다 펼쳐진 피크 그대로 (미리보기용) */
export const PEAK: Phase = { a: 1, ls: 2, creep: 0, p: 0, seed: 1 };

const D2R = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 결정론 해시 [0, 1) (난수 대신: 같은 씨앗·같은 틱이면 같은 그림) */
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** 펼쳐짐 단계 값 (0틱, 1틱, 2틱부터) */
const unfold = (ls: number, t0: number, t1: number) => (ls < 1 ? t0 : ls < 2 ? t1 : 1);

/** 두께 곡선 (0~1): 양 끝이 뾰족하고 peak에서 가장 두껍다. ba·bf는 뒤·앞 끝으로 가는 모양 */
export function profile(u: number, peak: number, ba: number, bf: number): number {
  if (u <= 0 || u >= 1) return 0;
  return u < peak ? Math.pow(u / peak, ba) : Math.pow((1 - u) / (1 - peak), bf);
}

/**
 * 띠 한 가닥 (고리 하나). C(u) = 가운데 점, N(u) = 위쪽(바깥) 단위 법선, H(u) = 띠 전체 두께, skew = 위쪽으로 두께 몰기.
 * s0~s1 = 두께 안에서 이 가닥이 차지하는 자리 (−1 아래 끝 … +1 위 끝). tail > 0이면 시작 쪽 tail(u 길이)만큼 뾰족하게 (찢어진 꼬리)
 */
function slice(C: (u: number) => GPt, N: (u: number) => GPt, H: (u: number) => number, skew: number, s0: number, s1: number, u0: number, u1: number, n: number, tail = 0): number[] {
  const up: number[] = [];
  const dn: number[] = [];
  const off = (s: number, h: number) => (s >= 0 ? (s * h * (1 + skew)) / 2 : (s * h * (1 - skew)) / 2);
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const [x, y] = C(u);
    const [nx, ny] = N(u);
    const h = Math.max(0, H(u));
    let lo = off(s0, h);
    let hi = off(s1, h);
    if (tail > 0) {
      const m = clamp((u - u0) / tail, 0, 1);
      const mid = (lo + hi) / 2;
      const hw = ((hi - lo) / 2) * m * m * (3 - 2 * m);
      lo = mid - hw;
      hi = mid + hw;
    }
    up.push(x + nx * hi, y + ny * hi);
    dn.push(x + nx * lo, y + ny * lo);
  }
  const ring = up.slice();
  for (let i = dn.length - 2; i >= 0; i -= 2) ring.push(dn[i]!, dn[i + 1]!);
  return ring;
}

/** 셀 단 하나: 색, 두께 비, 길이 비 (peak 둘레로), 흩어짐 몇에서 빠지는가 */
interface Level {
  tone: GTone;
  t: number;
  l: number;
  drop: number;
}

/** 빛 쐐기·스우시·잉크의 공통 띠 */
interface BandSpec {
  /** 가운데 선과 위쪽 법선: d = 흘러간 거리 (px, 공격 방향) */
  C: (u: number, d: number) => GPt;
  N: (u: number, d: number) => GPt;
  /** 설계 피크 두께·길이 (px) */
  w: number;
  len: number;
  peak: number;
  ba: number;
  bf: number;
  skew: number;
  /** 바깥 단 → 안쪽 단 */
  levels: Level[];
  /** 흩어질 때 가장 멀리 흘러가는 거리 (px) */
  drift: number;
  /** 흩어질 때 조각 수 상한 (잉크는 1: 어두운 쐐기는 곁조각 없이 줄어든다) */
  shards?: number;
  /** 흩어지는 조각의 가장 얇은 두께 (기본 4px) */
  minShard?: number;
}

/** 흩어질 때 띠가 찢어지는 조각: 가운데 본조각 + 곁조각 둘 (두께·길이·자리가 서로 달라 같은 굵기 평행선이 되지 않는다) */
const SHARDS = [
  { side: 0, ratio: 0.48, at: 0, len: 0.75 },
  { side: 0.82, ratio: 0.3, at: -0.2, len: 0.5 },
  { side: -0.8, ratio: 0.24, at: 0.14, len: 0.42 },
] as const;

/**
 * 띠 그리기 (14-2). 머무는 동안은 한 덩어리 (셀 단마다 peak 둘레로 줄인 띠).
 * 흩어지면 (p > 0) 조각으로 찢어진다: 처음 30% 동안 덩어리에서 본조각이 가늘어지며 곁조각이 떨어져 나오고 (끊김 없이 이어진다),
 * 조각마다 길이가 줄고 (꼬리부터), 띠를 따라 앞으로 흘러가고 (공격 방향), 벌어진다. 두께는 (1−p)^0.8, 바깥 단 색부터 빠진다.
 * 조각 윤곽이 2.6px 아래면 그리지 않고, 조각 길이는 두께의 aspect배를 넘지 않게 줄인다 (1px 선·긴 가는 선 금지)
 */
function bandPaints(b: BandSpec, ph: Phase): Paint[] {
  const p = ph.p;
  const thick = b.w * ph.a * Math.pow(1 - p, 0.8);
  const n = Math.max(10, Math.ceil(b.len / 3));
  const outer = b.levels.find((lv) => p < lv.drop);
  if (!outer) return [];
  const perLevel: number[][][] = b.levels.map(() => []);
  const e = p > 0 ? Math.min(1, p / 0.3) : 0;
  const S = p > 0 ? Math.min(b.shards ?? 3, b.w >= 11 ? 3 : 2) : 1;
  const flip = hash(ph.seed, 1, 21) < 0.5 ? 1 : -1;
  // 머무는 동안 (한 덩어리)은 설계 비율의 1.5배까지, 흩어지는 조각은 두께의 16배까지 (짧고 뭉툭한 조각)
  const aspectMax = p > 0 ? 16 : Math.max(24, (b.len / Math.max(1, b.w)) * 1.5);
  // 조각 윤곽 최소 두께: 머무는 동안 2.6px, 흩어지는 조각 4px (가운데가 3px 넘게 남아 1~2px 선이 되지 않게)
  const minT = p > 0 ? b.minShard ?? 4 : 2.6;
  for (let j = 0; j < S; j++) {
    const sh = SHARDS[j]!;
    const ratio = j === 0 ? 1 - (1 - sh.ratio) * e : sh.ratio * e;
    const off = sh.side * flip * e * (1 + 0.35 * p);
    const st = thick * ratio;
    const outerT = st * outer.t;
    if (outerT < minT) continue;
    // 조각 길이 (띠 길이 비): 떨어져 나오며 정해진 길이로, 흩어질수록 짧아진다. 두께에 비해 너무 길면 줄인다
    let lf = (j === 0 ? 1 - (1 - sh.len) * e : sh.len * e) * (1 - 0.55 * p);
    if (p > 0) lf = Math.min(lf, (outerT * aspectMax) / b.len);
    if (lf * b.len < 4) continue;
    // 조각 자리: 띠를 따라 앞으로 흘러간다 (u로 0.3, 그리고 drift px)
    const uc = b.peak + sh.at * e + 0.3 * p;
    const u0 = uc - lf * b.peak;
    const u1 = uc + lf * (1 - b.peak);
    const d = p > 0 ? b.drift * Math.pow(p, 1.2) * (0.8 + 0.4 * hash(ph.seed, j, 12)) : 0;
    b.levels.forEach((lv, li) => {
      if (p >= lv.drop) return;
      const lt = thick * lv.t;
      if (lt * ratio < (lv === outer ? minT : 0.9)) return;
      const uA = u0 + (u1 - u0) * (b.peak - b.peak * lv.l);
      const uB = u0 + (u1 - u0) * (b.peak + (1 - b.peak) * lv.l);
      const H = (u: number) => lt * profile((u - uA) / (uB - uA), b.peak, b.ba, b.bf);
      perLevel[li]!.push(slice((u) => b.C(u, d), (u) => b.N(u, d), H, b.skew, off - ratio, off + ratio, uA, uB, n));
    });
  }
  const out: Paint[] = [];
  b.levels.forEach((lv, li) => {
    if (perLevel[li]!.length) out.push({ tone: lv.tone, rings: perLevel[li]!, sep: true });
  });
  return out;
}

/** 셀 3단 (진한 주색 → 주색 → 심). 살아 있는 동안 흰 심이 맥동한다 (4틱 주기, ±22%) */
function celLevels(o: { main?: number; core?: number; coreLen?: number; edge?: GTone }, ph: Phase): Level[] {
  const core = (o.core ?? 0.3) * (1 + 0.22 * Math.sin((ph.ls * Math.PI) / 2));
  const out: Level[] = [{ tone: o.edge ?? 2, t: 1, l: 1, drop: 0.35 }];
  if ((o.main ?? 0.66) > 0) out.push({ tone: 1, t: o.main ?? 0.66, l: 0.95, drop: 0.7 });
  if ((o.core ?? 0.3) > 0) out.push({ tone: 0, t: core, l: o.coreLen ?? 0.78, drop: 0.85 });
  return out;
}

/** 빛 쐐기·빛기둥 (문법 1·4). 살아 있는 정지 동안 앞끝이 조금씩 더 뻗는다 (최대 +14%, 14-9 I) */
export function wedge(s: GWedge, ph: Phase): Paint[] {
  const a = s.angle * D2R;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const back = s.back;
  const L = s.fwd * (1 + 0.012 * Math.min(ph.creep, 12)) + back;
  const [ba, bf] = s.bulge ?? [0.8, 0.9];
  return bandPaints({
    C: (u, d) => [s.at[0] + dx * (-back + L * u + d), s.at[1] + dy * (-back + L * u + d)],
    N: () => [dy, -dx],
    w: s.w,
    len: L,
    peak: s.peak ?? 0.4,
    ba,
    bf,
    skew: s.skew ?? 0,
    levels: celLevels(s, ph),
    drift: clamp(0.18 * L, 8, 40),
  }, ph);
}

/** 스우시 띠 (문법 1): 원호를 따라 휘는 띠, 두께는 꼬리(u 0) → 머리(u 1). 흩어지면 휘는 방향으로 흘러간다 */
export function swoosh(s: GSwoosh, ph: Phase): Paint[] {
  const sx = s.sx ?? 1;
  const sy = s.sy ?? 1;
  // 납작한 원을 기울인다 (꼭대기가 수평으로 길게 눕지 않게: 자로 그은 테두리 방지)
  const rc = Math.cos((s.rot ?? 0) * D2R);
  const rs = Math.sin((s.rot ?? 0) * D2R);
  const dir = s.a1 >= s.a0 ? 1 : -1;
  const a0 = s.a0 * D2R;
  // 살아 있는 정지 동안 머리가 조금씩 더 돈다 (최대 7도)
  const a1 = (s.a1 + dir * 0.6 * Math.min(ph.creep, 12)) * D2R;
  const rr = s.r * Math.max(sx, sy);
  const ang = (u: number, d: number) => a0 + (a1 - a0) * u + (dir * d) / rr;
  const C = (u: number, d: number): GPt => {
    const t = ang(u, d);
    const x = Math.cos(t) * s.r * sx;
    const y = Math.sin(t) * s.r * sy;
    return [s.c[0] + x * rc - y * rs, s.c[1] + x * rs + y * rc];
  };
  // 바깥 법선 (납작한 원은 반지름 비로 바로잡는다)
  const N = (u: number, d: number): GPt => {
    const t = ang(u, d);
    const nx = Math.cos(t) * sy;
    const ny = Math.sin(t) * sx;
    const l = Math.hypot(nx, ny) || 1;
    return [(nx * rc - ny * rs) / l, (nx * rs + ny * rc) / l];
  };
  const [ba, bf] = s.bulge ?? [0.9, 0.7];
  const len = Math.abs(a1 - a0) * rr;
  return bandPaints({ C, N, w: s.w, len, peak: s.peak ?? 0.62, ba, bf, skew: s.skew ?? 0.2, levels: celLevels(s, ph), drift: clamp(0.2 * len, 8, 36) }, ph);
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

/** 살아 있는 번개: 가운데 꺾인 점을 step마다 다시 비튼다 (양 끝은 그대로, 마디 길이의 18%·최대 3.5px) */
export function rekink(pts: readonly GPt[], seed: number, step: number, scale = 1): GPt[] {
  return pts.map((q, i) => {
    if (i === 0 || i === pts.length - 1) return q;
    const a = pts[i - 1]!;
    const b = pts[i + 1]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    const seg = Math.min(Math.hypot(q[0] - a[0], q[1] - a[1]), Math.hypot(b[0] - q[0], b[1] - q[1]));
    const amp = Math.min(3.5, seg * 0.18) * scale;
    const o = amp * (2 * hash(seed, i, step) - 1);
    return [q[0] - (ty / tl) * o, q[1] + (tx / tl) * o] as const;
  });
}

/**
 * 굵은 번개 (문법 6): 마디마다 사각형 (마디 끝을 반두께만큼 늘려 꺾인 곳이 날카롭게), 끝은 뾰족한 삼각형.
 * 어두운 테두리 1px (tone 3) → 몸 (tone 1) → 심 (tone 0). 가지 번개는 같은 방법으로 가늘게.
 * 펼쳐짐: 0틱 55% 굵기의 길잡이 → 굵어진다. 살아 있는 정지: 2틱마다 다시 꺾이고 심이 맥동한다.
 * 흩어짐: 시작(꼬리)부터 잘려 나가고, 마디가 군데군데 떨어져 나가고, 진행 방향으로 흘러가며 가늘어진다 (테두리가 먼저 빠진다)
 */
export function bolt(s: GBolt, ph: Phase): Paint[] {
  const p = ph.p;
  const k = unfold(ph.ls, 0.55, 0.8) * Math.pow(1 - p, 0.8);
  // 가장 굵은 곳이 3px 아래로 얇아지면 그리지 않는다 (14-8 ⑥ 굵기 3~5px, 1px 번개 선 금지)
  if (Math.max(s.w0, s.wPeak ?? 0, s.w1) * k < 3) return [];
  const step = Math.floor(ph.ls / 2);
  const pts = rekink(boltPoints(s), ph.seed, step);
  const cumOf = (P: readonly GPt[]) => {
    const c = [0];
    for (let i = 1; i < P.length; i++) c.push(c[i - 1]! + Math.hypot(P[i]![0] - P[i - 1]![0], P[i]![1] - P[i - 1]![1]));
    return c;
  };
  const cum = cumOf(pts);
  const L = cum[cum.length - 1]! || 1;
  /** 굵기 곡선: w0 → (peak에서 wPeak) → w1 */
  const widthAt = (u: number, w0: number, w1: number, wp?: number): number => {
    if (wp === undefined) return w0 + (w1 - w0) * u;
    const q = s.peak ?? 0.5;
    return u < q ? w0 + (wp - w0) * (u / q) : wp + (w1 - wp) * ((u - q) / (1 - q));
  };
  // 흩어짐: 꼬리 자르기 + 흘러가기
  const trim = p > 0 ? Math.min(0.9, Math.pow(p, 0.9)) : 0;
  const flow = (() => {
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const D = clamp(0.12 * L, 6, 30) * Math.pow(p, 1.2);
    return [((b[0] - a[0]) / l) * D, ((b[1] - a[1]) / l) * D] as const;
  })();
  /** 남은 길: [x, y, u, 처음 마디 번호] (u = 처음 길 기준 비) */
  const path: Array<[number, number, number, number]> = [];
  {
    const cut = trim * L;
    for (let i = 0; i < pts.length; i++) {
      if (cum[i]! < cut) {
        const nxt = cum[i + 1];
        if (nxt !== undefined && nxt > cut) {
          const t = (cut - cum[i]!) / (nxt - cum[i]!);
          path.push([pts[i]![0] + (pts[i + 1]![0] - pts[i]![0]) * t + flow[0], pts[i]![1] + (pts[i + 1]![1] - pts[i]![1]) * t + flow[1], trim, i]);
        }
        continue;
      }
      path.push([pts[i]![0] + flow[0], pts[i]![1] + flow[1], cum[i]! / L, i]);
    }
  }
  if (path.length < 2) return [];
  // 흩어지는 동안 마디가 군데군데 떨어져 나간다 (찢어진 가닥, 처음 마디 번호로 정해 프레임마다 바뀌지 않게)
  const dropped = (i: number) => p > 0.25 && hash(ph.seed, i, 7) < (p - 0.25) * 1.1;
  /** 몸이 그려지는 마디인가 (몸 반굵기 1px 이상): 심·테두리도 이 마디에서만 (몸 없이 흰 심만 1px 선으로 남지 않게) */
  const bodyOn = (ua: number, ub: number) => (widthAt(ua, s.w0, s.w1, s.wPeak) * k) / 2 >= 1 || (widthAt(ub, s.w0, s.w1, s.wPeak) * k) / 2 >= 1;
  const quads = (P: ReadonlyArray<readonly [number, number, number, number]>, w0: number, w1: number, extra: number, wp?: number, minHalf = 1, skip = false): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i + 1 < P.length; i++) {
      if (skip && dropped(P[i]![3])) continue;
      const [x0, y0, ua] = P[i]!;
      const [x1, y1, ub] = P[i + 1]!;
      if (!bodyOn(ua, ub)) continue;
      const l = Math.hypot(x1 - x0, y1 - y0) || 1;
      const dx = (x1 - x0) / l;
      const dy = (y1 - y0) / l;
      // 잘린 꼬리는 뾰족하게 (시작 마디의 시작 굵기 0)
      const t0 = i === 0 && trim > 0 ? 0 : 1;
      const b0 = (widthAt(ua, w0, w1, wp) * k * t0) / 2;
      const b1 = (widthAt(ub, w0, w1, wp) * k) / 2;
      // 몸 굵기가 2px 아래인 마디는 그리지 않는다 (테두리도 같이): 가는 끝부터 짧아져 1px 꼬리가 남지 않게
      if (b0 < minHalf && b1 < minHalf) continue;
      const h0 = b0 + (t0 ? extra : extra * 0.5);
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
  // 가지: 흩어짐 0.45 전까지, 잘린 꼬리보다 앞에 있는 것만. 살아 있는 동안 2틱마다 각도가 조금씩 바뀐다
  const forks: Array<Array<[number, number, number]>> = p >= 0.45 ? [] : (s.forks ?? []).flatMap(([u, ang, len], fi) => {
    if (u <= trim) return [];
    let i = 0;
    while (i + 2 < pts.length && cum[i + 1]! < u * L) i++;
    const t = (u * L - cum[i]!) / Math.max(1e-6, cum[i + 1]! - cum[i]!);
    const x = pts[i]![0] + (pts[i + 1]![0] - pts[i]![0]) * t + flow[0];
    const y = pts[i]![1] + (pts[i + 1]![1] - pts[i]![1]) * t + flow[1];
    const base = Math.atan2(pts[i + 1]![1] - pts[i]![1], pts[i + 1]![0] - pts[i]![0]) + (ang + (hash(ph.seed, fi, step + 50) - 0.5) * 16) * D2R;
    const fl = len * (1 - 0.5 * p);
    // 가지도 한 번 꺾인다 (마디 둘)
    const mx = x + Math.cos(base) * fl * 0.55 + Math.cos(base + Math.PI / 2) * fl * 0.12;
    const my = y + Math.sin(base) * fl * 0.55 + Math.sin(base + Math.PI / 2) * fl * 0.12;
    return [[[x, y, 0], [mx, my, 0.55], [x + Math.cos(base) * fl, y + Math.sin(base) * fl, 1]]];
  });
  const fw0 = Math.max(1.5, Math.max(s.w0, s.wPeak ?? 0) * 0.5);
  const forkQuads = (extra: number) => forks.flatMap((f) => {
    // 가지 굵기는 처음 길(u)과 따로: fw0 → 1
    const P = f.map(([x, y, u]) => [x, y, u] as [number, number, number]);
    const out: number[][] = [];
    for (let i = 0; i + 1 < P.length; i++) {
      const [x0, y0, ua] = P[i]!;
      const [x1, y1, ub] = P[i + 1]!;
      const l = Math.hypot(x1 - x0, y1 - y0) || 1;
      const dx = (x1 - x0) / l;
      const dy = (y1 - y0) / l;
      const b0 = ((fw0 + (1 - fw0) * ua) * k) / 2;
      const b1 = ((fw0 + (1 - fw0) * ub) * k) / 2;
      if (b0 < 1 && b1 < 1) continue;
      const h0 = b0 + extra;
      const h1 = b1 + extra;
      const e1 = i + 2 < P.length ? h1 * 0.9 : 0;
      const e0 = i > 0 ? h0 * 0.9 : 0;
      const ax = x0 - dx * e0;
      const ay = y0 - dy * e0;
      const bx = x1 + dx * e1;
      const by = y1 + dy * e1;
      out.push([ax - dy * h0, ay + dx * h0, bx - dy * h1, by + dx * h1, bx + dy * h1, by - dx * h1, ax + dy * h0, ay - dx * h0]);
      if (i + 2 === P.length) {
        const tl = h1 * 2.4 + extra;
        out.push([bx - dy * h1, by + dx * h1, bx + dx * tl, by + dy * tl, bx + dy * h1, by - dx * h1]);
      }
    }
    return out;
  });
  const out: Paint[] = [];
  // 테두리: 몸과 가지를 1px 넓게 (흩어짐 0.4부터 바깥 단인 테두리가 먼저 빠진다)
  if (p < 0.4) out.push({ tone: 3, rings: [...quads(path, s.w0, s.w1, 1, s.wPeak, 1, true), ...forkQuads(1)], sep: true });
  out.push({ tone: 1, rings: [...quads(path, s.w0, s.w1, 0, s.wPeak, 1, true), ...forkQuads(0)], sep: true });
  // 심: 굵기의 38%, 살아 있는 동안 맥동 (홀짝 틱 0.3 ↔ 0.44)
  const cr = ph.ls % 2 ? 0.3 : 0.44;
  const cw = Math.max(s.w0, s.wPeak ?? 0, s.w1) * cr;
  if (cw * k >= 0.8) out.push({ tone: 0, rings: quads(path, s.w0 * cr, s.w1 * cr * 0.8, 0, s.wPeak !== undefined ? s.wPeak * cr : undefined, 0.35, true), sep: true });
  return out;
}

/**
 * 잉크 쐐기 (문법 3): 뿌리에서 끝으로 뾰족, 위쪽 날에 톱니. 펼쳐짐: 칼자국처럼 뿌리에서 끝으로 그어진다 (길이 45% → 85% → 100%).
 * 살아 있는 동안 톱니 깊이가 틱마다 바뀐다. 흩어짐: 뿌리(꼬리)부터 잘리고 가닥으로 갈라져 끝 쪽으로 흘러간다
 */
export function ink(s: GInk, ph: Phase): Paint[] {
  const a = s.angle * D2R;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = dy;
  const ny = -dx;
  const len0 = s.len * (1 + 0.01 * Math.min(ph.creep, 10));
  if (ph.p > 0) {
    return bandPaints({
      C: (u, d) => [s.at[0] + dx * (len0 * u + d), s.at[1] + dy * (len0 * u + d)],
      N: () => [nx, ny],
      w: s.w,
      len: len0,
      peak: 0.02,
      ba: 1,
      bf: 1,
      skew: 0,
      levels: [{ tone: 3, t: 1, l: 1, drop: 1.01 }],
      drift: clamp(0.2 * len0, 8, 36),
      shards: 1,
      // 잉크는 밝은 모양 위에서만 보이는 칼자국: 6px 아래로 얇아진 조각은 그리지 않는다 (가는 어두운 실선이 남지 않게)
      minShard: 6,
    }, { ...ph, a: 1 });
  }
  const w = s.w * unfold(ph.ls, 0.6, 0.9);
  if (w < 2.6) return [];
  const len = len0 * unfold(ph.ls, 0.45, 0.85);
  const notchK = ph.ls % 2 ? 0.7 : 1.15;
  const make = (grow: number): number[] => {
    const P = (u: number, side: number, inset = 0): [number, number] => {
      const h = (w / 2) * (1 - u) + grow - inset;
      return [s.at[0] + dx * (len * u - grow * 0.5) + nx * h * side, s.at[1] + dy * (len * u - grow * 0.5) + ny * h * side];
    };
    const ring: number[] = [];
    ring.push(...P(0, 1));
    for (const [u, d] of s.notch ?? []) {
      ring.push(...P(u - 0.035, 1));
      ring.push(...P(u, 1, d * notchK));
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
 * 큰 원 고리 (문법 5): 두께가 한쪽에서 가장 두껍고 (w, 4px 이상) 반대쪽은 3px, 끊긴 곳은 비운다.
 * 펼쳐짐: 반지름 80% → 93% → 100%로 퍼진다. 살아 있는 정지: 틱마다 0.75px씩 더 퍼지고 두꺼운 쪽이 맥동한다.
 * 흩어짐: 14% 더 퍼지며 여섯 군데가 끊어져 호로 갈라지고, 두께가 줄어 2px 아래로 얇아진 곳(얇은 쪽)부터 사라진다
 */
export function ring(s: GRing, ph: Phase, at: GPt): Paint[] {
  const p = ph.p;
  const r = s.r * unfold(ph.ls, 0.8, 0.93) + 0.75 * Math.min(ph.creep, 12) + s.r * 0.14 * p;
  const sy = s.sy ?? 1;
  const thick = (s.thick ?? -150) * D2R;
  // 가장 얇은 곳 3px, 두꺼운 쪽은 4px 이상 (2px 고리가 길게 이어지면 가는 선으로 보인다). 2.6px 아래로 얇아진 곳은 그리지 않는다
  const t0 = 3;
  const kT = Math.pow(1 - p, 0.7);
  const wv = Math.max(4, s.w) * (1 + 0.15 * Math.sin((ph.ls * Math.PI) / 2));
  const t = (a: number) => (t0 + (wv - t0) * Math.pow(Math.max(0, Math.cos(a - thick)), 2)) * kT;
  if (wv * kT < 2.6) return [];
  // 끊긴 곳을 뺀 각 구간 (흩어질 때 여섯 군데가 더 끊어진다)
  const gaps = (s.gaps ?? []).map(([g0, g1]) => [g0 * D2R, g1 * D2R] as const);
  if (p > 0) {
    const off = hash(ph.seed, 3, 9) * 60;
    for (let j = 0; j < 6; j++) {
      const c = (off + j * 60 + (hash(ph.seed, j, 10) - 0.5) * 24) * D2R;
      const hw = 17 * p * D2R;
      gaps.push([c - hw, c + hw]);
    }
  }
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
    if (inGap(a) || h < 2.6 || i === steps) {
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

/**
 * 방사 가시 (문법 5): 바깥 뿌리가 굵고 안쪽 끝이 뾰족하다. 펼쳐짐: 안쪽으로 쏘아 들어간다 (35% → 75% → 100%).
 * 살아 있는 정지: 틱마다 1px씩 더 뻗는다 (최대 8px). 흩어짐: 안쪽 끝이 물러나고 바깥으로 밀려나며 가늘어진다
 */
export function rays(s: GRays, ph: Phase, at: GPt): Paint[] {
  const p = ph.p;
  const f = unfold(ph.ls, 0.35, 0.75);
  const reach = Math.min(ph.creep, 8);
  const byTone = new Map<GTone, number[][]>();
  for (const [ang, r0, r1, b, tone] of s.lines) {
    const a = ang * D2R;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const ro = r0 + 8 * p;
    let ri = r0 - (r0 - r1) * f - reach;
    ri += (ro - ri) * Math.pow(p, 0.7);
    // 뿌리 폭은 거의 그대로 두고 안쪽 끝만 물러나 짧은 가시가 되어 사라진다 (얇아지며 긴 가는 선이 남지 않게)
    if (ro - ri < 5) continue;
    const bw = b * (1 - 0.35 * p);
    const ring = [
      at[0] + dx * ro - dy * bw, at[1] + dy * ro + dx * bw,
      at[0] + dx * ri, at[1] + dy * ri,
      at[0] + dx * ro + dy * bw, at[1] + dy * ro - dx * bw,
    ];
    if (!byTone.has(tone)) byTone.set(tone, []);
    byTone.get(tone)!.push(ring);
  }
  return [...byTone].map(([tone, rings]) => ({ tone, rings, sep: true }));
}

/**
 * 섬광 (문법 5): 맞은 점의 날카로운 별. 바깥 테 (tone 4) → 흰 심 (tone 0).
 * 펼쳐짐: 0틱은 길이 그대로 가늘게 (60%). 살아 있는 정지: 가시가 조금씩 더 뻗고 (최대 +25%) 바깥 테가 맥동한다. 흩어짐: 줄어든다
 */
export function flash(s: GFlash, ph: Phase, at: GPt): Paint[] {
  const p = ph.p;
  if (p >= 0.9) return [];
  const lk = (1 + 0.025 * Math.min(ph.creep, 10)) * Math.pow(1 - p, 0.6);
  const wk = unfold(ph.ls, 0.6, 0.85) * Math.pow(1 - p, 0.4);
  const rimGrow = ph.ls % 2 ? 1.1 : 1.2;
  const kites = (grow: number, add: number): number[][] =>
    s.spikes.map(([ang, len, hw]) => {
      const a = ang * D2R;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const L = len * grow * lk + add;
      const W = hw * grow * wk + add * 0.5;
      return [
        at[0] + dx * L, at[1] + dy * L,
        at[0] - dy * W, at[1] + dx * W,
        at[0] - dx * W * 1.2, at[1] - dy * W * 1.2,
        at[0] + dy * W, at[1] - dx * W,
      ];
    });
  return [
    { tone: 4, rings: kites(rimGrow, 1.5), sep: true },
    { tone: 0, rings: kites(1, 0), sep: true },
  ];
}
