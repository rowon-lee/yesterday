// YESTERDAY 길티기어식 이펙트 (동작연출지침서 14-8 모양, 14-2 시간) — 큰 모양 만들기 (렌더 전용).
// 모양마다 숫자(data/vfx)로 다각형을 만든다. 좌표는 오른쪽 보기 기준 px (x 앞 +, y 아래 +), 그릴 때 뒤집고 옮긴다.
// 시간은 Phase 하나로 받는다 (14-2):
//   펼쳐짐 a: 0틱 1/3 → 1틱 0.75 → 2틱부터 1 (0틱은 전체 길이의 가는 섬광, 두께가 부풀며 덩어리가 된다)
//   살아 있는 정지: ls(살아 있는 틱)로 번개가 2틱마다 다시 꺾이고, 흰 심이 맥동하고, creep(정지한 틱)만큼 가시·끝이 조금씩 더 뻗는다
//   흩어짐 p: 꼬리부터 가닥으로 찢어져 공격 방향으로 흘러가고, 두께가 줄고, 바깥 단계 색부터 빠진다
// 너무 가늘어진 가닥(2.6px 아래)이나 두께에 비해 너무 긴 가닥은 그리지 않는다 (1px 선이 남지 않게).
import type { GBolt, GFlash, GInk, GPt, GRays, GRibbon, GRing, GStitch, GSwoosh, GTone, GWedge } from '../../data/vfx/types';

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
  /** 14-9 I: 자라는 상한 배수 (기본 1, creep도 이 배수로 빨리 센다) */
  g?: number;
}

/** 다 펼쳐진 피크 그대로 (미리보기용) */
export const PEAK: Phase = { a: 1, ls: 2, creep: 0, p: 0, seed: 1 };

/** 살아 있는 정지로 자란 틱 (상한 12틱 × 자라는 배수) */
const creepOf = (ph: Phase) => Math.min(ph.creep, 12 * (ph.g ?? 1));

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
  /** 자리 u·셀 단 번호(0 바깥 단 …)마다 두께 배수 (리본 비틀림: 안쪽 단일수록 더 좁아져 뒷면만 보인다) */
  mul?: (u: number, level: number) => number;
  /** 흩어지는 조각의 양 끝을 뭉툭하게 (긴 리본 조각의 가는 끝이 1px 선으로 길게 남지 않게) */
  blunt?: boolean;
  /** 흩어지는 조각 길이 상한 (조각 두께의 몇 배, 기본 16) */
  aspect?: number;
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
  const aspectMax = p > 0 ? b.aspect ?? 16 : Math.max(24, (b.len / Math.max(1, b.w)) * 1.5);
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
      const ba = p > 0 && b.blunt ? Math.min(b.ba, 0.6) : b.ba;
      const bf = p > 0 && b.blunt ? Math.min(b.bf, 0.6) : b.bf;
      const H = b.mul ? (u: number) => lt * profile((u - uA) / (uB - uA), b.peak, ba, bf) * b.mul!(u, li) : (u: number) => lt * profile((u - uA) / (uB - uA), b.peak, ba, bf);
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
  const L = s.fwd * (1 + 0.012 * creepOf(ph)) + back;
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
  const a1 = (s.a1 + dir * 0.6 * creepOf(ph)) * D2R;
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
  const len0 = s.len * (1 + 0.01 * Math.min(ph.creep, 10 * (ph.g ?? 1)));
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
  const r = s.r * unfold(ph.ls, 0.8, 0.93) + 0.75 * creepOf(ph) + s.r * 0.14 * p;
  const sy = s.sy ?? 1;
  // 기울기 (데이터가 정한다: 백은우 바닥 물결 고리는 −7°, 위·아래 테두리가 같은 줄에서 길게 이어지지 않게)
  const rot = (s.rot ?? 0) * D2R;
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
  // 물결 고리: 파장 약 32px의 느린 굽이 (짧고 뾰족하면 번개처럼 보인다), 살아 있는 시계로 흐른다
  const rip = (s.ripple ?? 0) * kT;
  const nRip = Math.max(4, Math.round(r / 5.1));
  const rings: number[][] = [];
  let cur: number[][] | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const h = t(a);
    if (inGap(a) || h < 2.6 || i === steps) {
      if (cur && cur.length > 1) rings.push(closeArc(cur, at, r, sy, rot));
      cur = null;
      continue;
    }
    if (!cur) cur = [];
    cur.push(rip ? [a, h / 2, rip * Math.sin(nRip * a - 0.8 * ph.ls)] : [a, h / 2]);
  }
  return [{ tone: s.tone ?? 4, rings, sep: true }];
}
/** 고리 한 구간 (바깥 호 → 안쪽 호). 납작한 고리도 두께는 화면 px 그대로 (세로로 눌러 두께까지 얇아지지 않게) */
function closeArc(seg: number[][], at: GPt, r: number, sy: number, rot = 0): number[] {
  const out: number[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const P = (x: number, y: number) => out.push(at[0] + x * c - y * s, at[1] + x * s + y * c);
  // 물결 (w): 바깥·안쪽 테두리를 화면 px로 함께 민다 (납작한 고리도 위아래로 굽이친다)
  for (const [a, h, w = 0] of seg) P(Math.cos(a!) * (r + h! + w), Math.sin(a!) * (r * sy + h! + w));
  for (let i = seg.length - 1; i >= 0; i--) {
    const [a, h, w = 0] = seg[i]!;
    P(Math.cos(a!) * (r - h! + w), Math.sin(a!) * (r * sy - h! + w));
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
  const reach = Math.min(ph.creep, 8 * (ph.g ?? 1));
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
  const lk = (1 + 0.025 * Math.min(ph.creep, 10 * (ph.g ?? 1))) * Math.pow(1 - p, 0.6);
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
    { tone: s.rim ?? 4, rings: kites(rimGrow, 1.5), sep: true },
    { tone: 0, rings: kites(1, 0), sep: true },
  ];
}

// ───────────────────────── 백은우 (14-4 '리본처럼 휘는 넓은 띠', 꼬리에서 흰 나비·꽃잎 조각, 금색 실 한 가닥) ─────────────────────────

/** 곡선 표: 촘촘한 점, 점마다 누적 길이, 전체 길이 */
export interface Spline {
  P: GPt[];
  S: number[];
  len: number;
}
const splines = new WeakMap<readonly GPt[], Spline>();

/** 점들을 지나는 매끄러운 곡선 (캐트멀-롬, 양 끝은 같은 점을 한 번 더). 1.5px마다 뽑아 길이 표를 만든다 */
export function splineOf(pts: readonly GPt[]): Spline {
  let sp = splines.get(pts);
  if (sp) return sp;
  const P: GPt[] = [];
  const n = pts.length;
  const at = (i: number) => pts[Math.max(0, Math.min(n - 1, i))]!;
  for (let i = 0; i + 1 < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      P.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  P.push(pts[n - 1]!);
  const S = [0];
  for (let i = 1; i < P.length; i++) S.push(S[i - 1]! + Math.hypot(P[i]![0] - P[i - 1]![0], P[i]![1] - P[i - 1]![1]));
  sp = { P, S, len: S[S.length - 1]! || 1 };
  splines.set(pts, sp);
  return sp;
}

/** 곡선 위 길이 q 자리의 점과 진행 방향 (양 끝 밖은 끝 방향으로 곧게 늘인다) */
export function splineAt(sp: Spline, q: number): { x: number; y: number; tx: number; ty: number } {
  const { P, S, len } = sp;
  const last = P.length - 1;
  if (q <= 0 || q >= len) {
    const [i0, i1] = q <= 0 ? [0, Math.min(last, 2)] : [Math.max(0, last - 2), last];
    const dx = P[i1]![0] - P[i0]![0];
    const dy = P[i1]![1] - P[i0]![1];
    const l = Math.hypot(dx, dy) || 1;
    const base = q <= 0 ? P[0]! : P[last]!;
    const over = q <= 0 ? q : q - len;
    return { x: base[0] + (dx / l) * over, y: base[1] + (dy / l) * over, tx: dx / l, ty: dy / l };
  }
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (S[m]! <= q) lo = m;
    else hi = m;
  }
  const t = (q - S[lo]!) / Math.max(1e-6, S[hi]! - S[lo]!);
  const a = P[lo]!;
  const b = P[hi]!;
  // 방향은 이웃 몇 점에 걸쳐 (꺾인 곳에서 법선이 튀지 않게)
  const j0 = Math.max(0, lo - 2);
  const j1 = Math.min(last, hi + 2);
  const dx = P[j1]![0] - P[j0]![0];
  const dy = P[j1]![1] - P[j0]![1];
  const l = Math.hypot(dx, dy) || 1;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx: dx / l, ty: dy / l };
}

/**
 * 리본 띠. 머무는 동안 천처럼 물결친다 (꼬리 쪽일수록 크게, 7틱 주기로 흐른다) — 같은 그림으로 멈추지 않는다.
 * 비틀린 자리는 바깥 단만 좁게 남아 뒷면이 보이고, 금색 실은 앞날 안쪽을 따라 지나며 흰 빛이 한 점 미끄러진다.
 * 흩어지면 띠 공통 규칙 (꼬리부터 조각으로 찢어져 띠를 따라 흘러간다)
 */
export function ribbon(s: GRibbon, ph: Phase): Paint[] {
  const sp = splineOf(s.pts);
  // 살아 있는 정지 동안 머리가 조금씩 더 뻗는다 (최대 +12% × 자라는 배수)
  const L = sp.len * (1 + 0.01 * creepOf(ph));
  const [amp, lam] = s.wave ?? [2.5, 46];
  const om = 0.9;
  const wav = (u: number, q: number) => amp * Math.pow(Math.max(0, 1 - u), 1.3) * Math.sin((2 * Math.PI * q) / lam - om * ph.ls) * ph.a;
  const C = (u: number, d: number): GPt => {
    const q = u * L + d;
    const k = splineAt(sp, q);
    const w = wav(u, q);
    return [k.x + k.ty * w, k.y - k.tx * w];
  };
  const N = (u: number, d: number): GPt => {
    const k = splineAt(sp, u * L + d);
    return [k.ty, -k.tx];
  };
  // 비틀림은 한 덩어리로 머무는 동안만 (흩어지는 조각에 가는 허리가 생겨 1px 선이 되지 않게)
  const twists = ph.p > 0 ? [] : s.twist ?? [];
  // 천의 잔물결: 두께가 ±6%로 약 15px마다 굽이치며 흐른다 (테두리가 한 줄에서 곧게 이어지지 않게, 살아 있는 천)
  const ruf = s.ruffle ?? 0.06;
  const mul = (u: number, li: number) => {
    let m = 1 + ruf * Math.sin((2 * Math.PI * u * L) / 15 - 0.9 * ph.ls);
    for (const [ut, keep] of twists) {
      const k = clamp(1 - Math.abs(u - ut) / 0.07, 0, 1);
      const sm = k * k * (3 - 2 * k);
      // 안쪽 단일수록 더 좁아진다: 비틀린 자리에는 바깥 단(뒷면 색)만 남는다
      m *= 1 - (1 - Math.pow(keep, 1 + 1.3 * li)) * sm;
    }
    return m;
  };
  const [ba, bf] = s.bulge ?? [1.1, 0.6];
  const peak = s.peak ?? 0.66;
  // 리본 조각은 6px 넘게 굵고 두께의 10배까지만 길다 (긴 리본이 흩어지며 가늘고 긴 가닥이 남지 않게)
  const out = bandPaints({ C, N, w: s.w, len: L, peak, ba, bf, skew: s.skew ?? 0, levels: celLevels(s, ph), drift: clamp(0.25 * L, 10, 44), mul, blunt: true, minShard: 6, aspect: 10 }, ph);
  // 금색 실 한 가닥 (앞날 안쪽): 흩어지기 시작하면 (바깥 단보다 먼저) 빠진다
  const th = s.thread;
  if (th && ph.p < 0.22) {
    const [u0, u1, tw, side] = th;
    const thick = s.w * ph.a * Math.pow(1 - ph.p, 0.8);
    const skew = s.skew ?? 0;
    const up: number[] = [];
    const dn: number[] = [];
    const glintU = u0 + (u1 - u0) * (((ph.ls * 0.13) % 1.3) - 0.15);
    const hiUp: number[] = [];
    const hiDn: number[] = [];
    const n = Math.max(8, Math.ceil(((u1 - u0) * L) / 3));
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n;
      const [x, y] = C(u, 0);
      const [nx, ny] = N(u, 0);
      const h = thick * profile(u, peak, ba, bf) * mul(u, 0);
      const edge = side >= 0 ? (h * (1 + skew)) / 2 : (-h * (1 - skew)) / 2;
      // 실 굵기: 가운데가 굵고 양 끝으로 가늘어진다, 띠 두께의 40%를 넘지 않는다
      const t = Math.min(h * 0.4, tw * Math.pow(Math.sin((Math.PI * i) / n), 0.6));
      const inner = edge - (side >= 0 ? 1 : -1) * t;
      up.push(x + nx * edge, y + ny * edge);
      dn.push(x + nx * inner, y + ny * inner);
      if (Math.abs(u - glintU) < 0.05 && t >= 1.2) {
        hiUp.push(x + nx * edge, y + ny * edge);
        hiDn.push(x + nx * inner, y + ny * inner);
      }
    }
    const ring = up.slice();
    for (let i = dn.length - 2; i >= 0; i -= 2) ring.push(dn[i]!, dn[i + 1]!);
    out.push({ tone: 4, rings: [ring] });
    if (hiUp.length >= 4) {
      const g = hiUp.slice();
      for (let i = hiDn.length - 2; i >= 0; i -= 2) g.push(hiDn[i]!, hiDn[i + 1]!);
      out.push({ tone: 0, rings: [g] });
    }
  }
  return out;
}

/** 꽃잎 하나 (양 끝이 뾰족한 잎 모양 6각형): 가운데 (x, y), 방향 (라디안), 길이, 폭 */
export function petal(x: number, y: number, ang: number, len: number, wid: number): number[] {
  const c = Math.cos(ang);
  const s2 = Math.sin(ang);
  const pts: Array<[number, number]> = [[-0.5, 0], [-0.18, 0.5], [0.22, 0.42], [0.5, 0], [0.22, -0.42], [-0.18, -0.5]];
  const r: number[] = [];
  for (const [u, v] of pts) r.push(x + c * u * len - s2 * v * wid, y + s2 * u * len + c * v * wid);
  return r;
}

/**
 * 나비 한 마리: 몸 (x, y), 몸 방향 (라디안: 머리 쪽), 날개폭, 날갯짓 (1 다 편 날개 → 0.35 접은 날개).
 * 위 날개 둘(크다)과 아래 날개 둘(작다)을 몸 양쪽에. 고리 넷을 돌려준다
 */
export function butterfly(x: number, y: number, ang: number, span: number, flap: number): number[][] {
  const c = Math.cos(ang);
  const s2 = Math.sin(ang);
  const P = (u: number, v: number) => [x + c * u - s2 * v, y + s2 * u + c * v];
  const half = (span / 2) * flap;
  const out: number[][] = [];
  for (const side of [-1, 1]) {
    // 위 날개: 몸 앞쪽에서 바깥 앞으로 크게
    out.push([...P(0.6, 0), ...P(span * 0.32, side * half * 0.75), ...P(span * 0.08, side * half), ...P(-0.6, side * 0.8)]);
    // 아래 날개: 몸 뒤쪽에서 바깥 뒤로 작게
    out.push([...P(-0.4, 0), ...P(-span * 0.06, side * half * 0.7), ...P(-span * 0.3, side * half * 0.45), ...P(-span * 0.18, side * 0.6)]);
  }
  return out;
}

/**
 * 금실 바늘땀 (14-9 J). ls = 나타난 뒤 살아 있는 틱. 꿰매기 (sew틱 동안 시작 → 끝) → 남기 (life틱, 흰 빛이 한 땀씩 지나간다)
 * → 풀리기 (12틱, 시작 쪽부터 한 땀씩). 땀마다 길이·굵기·기울기가 해시로 조금씩 다르다
 */
export function stitch(s: GStitch, ls: number, seed: number): Paint[] {
  const sp = splineOf(s.pts);
  const count = Math.max(1, Math.floor(sp.len / s.gap));
  const tone = s.tone ?? 4;
  const main: number[][] = [];
  const hi: number[][] = [];
  const sewn = Math.min(count, Math.ceil(((ls + 1) / Math.max(1, s.sew)) * count));
  const undo = ls - s.sew - s.life;
  const gone = undo > 0 ? Math.floor((undo / 12) * (count + 1)) : 0;
  const glint = Math.floor(((ls - s.sew) * 0.5) % (count + 6));
  for (let i = gone; i < sewn; i++) {
    const q = (i + 0.5) * (sp.len / count) + (hash(seed, i, 61) - 0.5) * s.gap * 0.3;
    const k = splineAt(sp, q);
    const len = s.len * (0.55 + 0.85 * hash(seed, i, 62)) * (i === gone && undo > 0 ? 0.6 : 1);
    const w = s.w * (0.7 + 0.45 * hash(seed, i, 63));
    // 땀마다 기울기를 번갈아 (바늘이 들어갔다 나온 자리), 같은 방향 평행선이 늘어서지 않게
    const a = Math.atan2(k.ty, k.tx) + (((i % 2 ? s.slant : -s.slant * 0.7) + (hash(seed, i, 64) - 0.5) * 30) * Math.PI) / 180;
    // 갓 꿰맨 땀은 1틱 동안 짧다 (꿰매지는 맛)
    const fresh = i === sewn - 1 && sewn < count ? 0.6 : 1;
    const r = petal(k.x, k.y, a, len * fresh, w);
    (i === glint && undo <= 0 ? hi : main).push(r);
  }
  const out: Paint[] = [];
  if (main.length) out.push({ tone, rings: main, sep: true });
  if (hi.length) out.push({ tone: 0, rings: hi, sep: true });
  return out;
}
