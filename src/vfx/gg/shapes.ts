// YESTERDAY 길티기어식 이펙트 (동작연출지침서 14-8 모양, 14-2 시간) — 큰 모양 만들기 (렌더 전용).
// 모양마다 숫자(data/vfx)로 다각형을 만든다. 좌표는 오른쪽 보기 기준 px (x 앞 +, y 아래 +), 그릴 때 뒤집고 옮긴다.
// 시간은 Phase 하나로 받는다 (14-2):
//   펼쳐짐 a: 0틱 1/3 → 1틱 0.75 → 2틱부터 1 (0틱은 전체 길이의 가는 섬광, 두께가 부풀며 덩어리가 된다)
//   살아 있는 정지: ls(살아 있는 틱)로 번개가 2틱마다 다시 꺾이고, 흰 심이 맥동하고, creep(정지한 틱)만큼 가시·끝이 조금씩 더 뻗는다
//   흩어짐 p: 꼬리부터 가닥으로 찢어져 공격 방향으로 흘러가고, 두께가 줄고, 바깥 단계 색부터 빠진다
// 너무 가늘어진 가닥(2.6px 아래)이나 두께에 비해 너무 긴 가닥은 그리지 않는다 (1px 선이 남지 않게).
import type { GBolt, GFlash, GInk, GPt, GQuake, GRays, GRibbon, GRing, GStitch, GSurge, GSwoosh, GTone, GWedge } from '../../data/vfx/types';

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
  /** 두께에 더하는 px (양쪽 합 2px배, 양 끝은 함께 뾰족하다): 14-10 ① 맨 바깥 어두운 띠 */
  px?: number;
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
  /**
   * 14-10 ② 한쪽 가장자리 금 테: [시작 u, 끝 u, 굵기 px, 쪽 (+1 위 · −1 아래)]. 맨 바깥 밝은 단의 가장자리 안쪽에 붙고,
   * 흩어지면 조각마다 그 조각의 가장자리를 따라 간다 (조각 밖에 따로 떠서 가는 선이 되지 않게). 굵기는 조각 두께의 40%를 넘지 않는다
   */
  edge?: readonly [number, number, number, number];
  /** 금 테 위를 미끄러지는 흰 빛 자리 (u, 본조각에만) */
  edgeGlint?: number;
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
  // 금 테가 붙는 단: 맨 바깥 밝은 단 (어두운 남색 테 단 다음)
  const brightIdx = b.levels.findIndex((lv) => !lv.px);
  const gold: number[][] = [];
  const goldHi: number[][] = [];
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
      // 두께 배수 단 번호: 어두운 남색 테 단은 맨 바깥 밝은 단과 같은 번호로 센다 (비틀린 자리에서 밝은 단이 더 좁아지지 않게)
      const lm = Math.max(0, li - (b.levels[0]?.px ? 1 : 0));
      const H0 = b.mul ? (u: number) => lt * profile((u - uA) / (uB - uA), b.peak, ba, bf) * b.mul!(u, lm) : (u: number) => lt * profile((u - uA) / (uB - uA), b.peak, ba, bf);
      const px = lv.px ?? 0;
      const H = px > 0 ? (u: number) => H0(u) + 2 * px * Math.min(1, 3 * profile((u - uA) / (uB - uA), b.peak, ba, bf)) * Math.pow(1 - p, 0.5) : H0;
      perLevel[li]!.push(slice((u) => b.C(u, d), (u) => b.N(u, d), H, b.skew, off - ratio, off + ratio, uA, uB, n));
      if (b.edge && li === brightIdx) edgeOf(b, H0, off + (b.edge[3] >= 0 ? ratio : -ratio), ratio, uA, uB, d, j === 0 ? b.edgeGlint : undefined, gold, goldHi);
    });
  }
  const out: Paint[] = [];
  b.levels.forEach((lv, li) => {
    if (perLevel[li]!.length) out.push({ tone: lv.tone, rings: perLevel[li]!, sep: true });
  });
  if (gold.length) out.push({ tone: 4, rings: gold, sep: true });
  if (goldHi.length) out.push({ tone: 0, rings: goldHi, sep: true });
  return out;
}

/**
 * 금 테 한 조각 (14-10 ②): 조각 [uA, uB] 안에서 금 테 구간 (조각 길이에 비례)만큼, 그 조각 밝은 단의 sE 쪽 가장자리에서 안쪽으로.
 * 굵기는 가운데가 굵고 양 끝으로 가늘어지며, 조각 두께(ratio × H)의 40%를 넘지 않는다. 1.2px 아래 자리는 빼고 잇는다
 */
function edgeOf(b: BandSpec, H: (u: number) => number, sE: number, ratio: number, uA: number, uB: number, d: number, glintU: number | undefined, out: number[][], hi: number[][]): void {
  const [e0, e1, tw, side] = b.edge!;
  const a = uA + (uB - uA) * e0;
  const z = uA + (uB - uA) * e1;
  if (z - a <= 0) return;
  const off = (s: number, h: number) => (s >= 0 ? (s * h * (1 + b.skew)) / 2 : (s * h * (1 - b.skew)) / 2);
  const sgn = side >= 0 ? 1 : -1;
  const n = Math.max(8, Math.ceil(((z - a) * b.len) / 3));
  let up: number[] = [];
  let dn: number[] = [];
  let gUp: number[] = [];
  let gDn: number[] = [];
  const flush = () => {
    if (up.length >= 4) {
      const ring = up.slice();
      for (let i = dn.length - 2; i >= 0; i -= 2) ring.push(dn[i]!, dn[i + 1]!);
      out.push(ring);
    }
    if (gUp.length >= 4) {
      const g = gUp.slice();
      for (let i = gDn.length - 2; i >= 0; i -= 2) g.push(gDn[i]!, gDn[i + 1]!);
      hi.push(g);
    }
    up = [];
    dn = [];
    gUp = [];
    gDn = [];
  };
  for (let i = 0; i <= n; i++) {
    const u = a + ((z - a) * i) / n;
    const h = Math.max(0, H(u));
    const t = Math.min(h * ratio * 0.4, tw * Math.pow(Math.sin((Math.PI * i) / n), 0.6));
    if (t < 1.2) {
      flush();
      continue;
    }
    const [x, y] = b.C(u, d);
    const [nx, ny] = b.N(u, d);
    const eo = off(sE, h);
    const io = eo - sgn * t;
    up.push(x + nx * eo, y + ny * eo);
    dn.push(x + nx * io, y + ny * io);
    if (glintU !== undefined && Math.abs((u - uA) / Math.max(1e-6, uB - uA) - glintU) < 0.05 && t >= 1.2) {
      gUp.push(x + nx * eo, y + ny * eo);
      gDn.push(x + nx * io, y + ny * io);
    } else if (gUp.length) {
      // 흰 빛 구간이 끝났다: 그 구간만 닫는다 (금 테는 이어서 그린다)
      if (gUp.length >= 4) {
        const g = gUp.slice();
        for (let k = gDn.length - 2; k >= 0; k -= 2) g.push(gDn[k]!, gDn[k + 1]!);
        hi.push(g);
      }
      gUp = [];
      gDn = [];
    }
  }
  flush();
}

/** 셀 3단 (진한 주색 → 주색 → 심, tones로 통째로 바꿀 수 있다: 에드워드 푸른 장막 띠). 살아 있는 동안 흰 심이 맥동한다 (4틱 주기, ±22%) */
function celLevels(o: { main?: number; core?: number; coreLen?: number; edge?: GTone; tones?: readonly [GTone, GTone, GTone]; rim?: number }, ph: Phase): Level[] {
  const [te, tm, tc] = o.tones ?? [o.edge ?? 2, 1, 0];
  const core = (o.core ?? 0.3) * (1 + 0.22 * Math.sin((ph.ls * Math.PI) / 2));
  // 14-10 ①: 맨 바깥 어두운 잉크 띠 (바깥 단과 같이 흩어진다)
  const out: Level[] = o.rim ? [{ tone: 3, t: 1, l: 1, drop: 0.35, px: o.rim }, { tone: te, t: 1, l: 1, drop: 0.35 }] : [{ tone: te, t: 1, l: 1, drop: 0.35 }];
  if ((o.main ?? 0.66) > 0) out.push({ tone: tm, t: o.main ?? 0.66, l: 0.95, drop: 0.7 });
  if ((o.core ?? 0.3) > 0) out.push({ tone: tc, t: core, l: o.coreLen ?? 0.78, drop: 0.85 });
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
    edge: s.thread,
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
  const ruf = s.ruffle ?? 0;
  const mul = ruf ? (u: number) => 1 + ruf * Math.sin((2 * Math.PI * u * len) / 18 - 0.9 * ph.ls) : undefined;
  return bandPaints({ C, N, w: s.w, len, peak: s.peak ?? 0.62, ba, bf, skew: s.skew ?? 0.2, levels: celLevels(s, ph), drift: clamp(0.2 * len, 8, 36), mul }, ph);
}

/**
 * 짓누르는 충격파 (에드워드 14-4): 바닥 점 위 납작한 반원 껍데기 띠. 꼭대기가 가장 굵고 (안쪽으로 두껍다) 바닥에 닿는 양 끝이 뾰족하다.
 * 살아 있는 시계로 반지름은 넓어지고 높이는 낮아진다 (처음이 빠르다: 퍼지며 눌려 납작해진다). 꼭대기가 수평으로 길게 눕지 않게 조금 기울이고,
 * 두께가 18px마다 조금씩 굽이친다. 흩어지면 바깥으로 밀려가며 찢어진다
 */
export function quake(s: GQuake, ph: Phase): Paint[] {
  const at = s.at ?? [0, 0];
  const k0 = clamp(ph.ls / Math.max(1, s.spread), 0, 1);
  const k = 1 - (1 - k0) * (1 - k0);
  const R = s.r[0] + (s.r[1] - s.r[0]) * k;
  // 너무 납작해지지 않는다 (높이는 반지름의 30% 이상: 바닥에 가는 수평선으로 눕지 않게)
  const H = Math.max(s.h[0] + (s.h[1] - s.h[0]) * k, 0.3 * R);
  const rot = (s.rot ?? -5) * D2R;
  const rc = Math.cos(rot);
  const rs = Math.sin(rot);
  const side = s.sides ?? 0;
  // 위쪽 반원 (화면 각 180° 뒤 → 270° 꼭대기 → 360° 앞). 한쪽만이면 그 쪽 4분원
  const t0 = side > 0 ? 1.5 * Math.PI : Math.PI;
  const t1 = side < 0 ? 1.5 * Math.PI : 2 * Math.PI;
  const th = (u: number) => t0 + (t1 - t0) * u;
  // 껍데기 테두리가 1px로 느리게 굽이친다 (파장 약 30px: 납작한 꼭대기가 한 줄로 곧게 이어지지 않게)
  const C = (u: number, d: number): GPt => {
    const t = th(u);
    const x = Math.cos(t) * (R + d);
    const y = Math.sin(t) * H + Math.sin((2 * Math.PI * x) / 30 - 0.8 * ph.ls);
    return [at[0] + x * rc - y * rs, at[1] + x * rs + y * rc];
  };
  const N = (u: number): GPt => {
    const t = th(u);
    const nx = Math.cos(t) * H;
    const ny = Math.sin(t) * R;
    const l = Math.hypot(nx, ny) || 1;
    return [(nx * rc - ny * rs) / l, (nx * rs + ny * rc) / l];
  };
  let len = 0;
  let q0 = C(0, 0);
  for (let i = 1; i <= 24; i++) {
    const q = C(i / 24, 0);
    len += Math.hypot(q[0] - q0[0], q[1] - q0[1]);
    q0 = q;
  }
  // 꼭대기 (u: 양쪽 0.5, 앞쪽만 0, 뒤쪽만 1)가 가장 굵다
  const peak = s.peak ?? (side > 0 ? 0.1 : side < 0 ? 0.9 : 0.5);
  const [ba, bf] = s.bulge ?? (side > 0 ? [0.4, 0.8] : side < 0 ? [0.8, 0.4] : [0.75, 0.75]);
  const mul = (u: number) => 1 + 0.12 * Math.sin((2 * Math.PI * u * len) / 18 - 0.9 * ph.ls);
  // 띠는 높이의 85%를 넘게 두껍지 않다 (눌려 낮아질수록 얇아진다: 바닥 아래로 삐져나가지 않게)
  const w = Math.min(s.w, 0.85 * H);
  return bandPaints({ C, N, w, len, peak, ba, bf, skew: s.skew ?? -0.5, levels: celLevels(s, ph), drift: clamp(0.3 * R, 8, 40), mul, minShard: 3.2 }, ph);
}

/**
 * 바닥을 따라 낮고 넓게 퍼지는 충격파 (에드워드 '무게', 2026-11-05): 양옆으로 밀려가는 낮은 물마루 띠. 앞(바깥)이 가파르고 가운데 쪽이 길게 눕는다.
 * 윗선 = 바닥 위 높이 h, 아랫선 = 바닥 아래 dip (같은 두께 곡선). 두 선 모두 6px마다 부서진 흙처럼 들쭉날쭉하다 (월드에 붙은 무늬: 바닥 위 곧은 수평선이 생기지 않게).
 * 셀 단은 위로 몰려 흰 심이 물마루 윗부분을 지난다. 살아 있는 시계로 밀려가며 (처음이 빠르다) 낮아지고 길어지고, 두께가 14px마다 굽이친다.
 * 흩어지면 조각이 계속 바깥으로 밀려간다
 */
export function surge(s: GSurge, ph: Phase): Paint[] {
  const at = s.at ?? [0, 0];
  const k0 = clamp(ph.ls / Math.max(1, s.spread), 0, 1);
  const k = 1 - (1 - k0) * (1 - k0);
  const F = s.r[0] + (s.r[1] - s.r[0]) * k;
  const Lc = s.len[0] + (s.len[1] - s.len[0]) * k;
  const Hc = s.h[0] + (s.h[1] - s.h[0]) * k;
  const dip = s.dip ?? 4;
  const J = s.jag ?? 2;
  const peak = s.peak ?? 0.7;
  const [ba, bf] = s.bulge ?? [0.9, 0.45];
  const skew = -0.35;
  const w = Hc + dip;
  // 윗선이 −Hc·P, 아랫선이 +dip·P가 되는 가운데 선 높이 (skew로 위·아래 두께가 다르다). 펼쳐짐·흩어짐으로 얇아져도 바닥에 붙어 있게 같은 비로 줄인다
  const mid = (-Hc + ((1 + skew) * w) / 2) * ph.a * Math.pow(1 - ph.p, 0.8);
  // 7px마다 위·아래를 번갈아 (크기는 칸마다 다르게): 낮고 길게 눕는 물마루 윗선·아랫선이 30px 넘게 한 줄로 곧게 이어지지 않게
  const zig = (i: number) => (i & 1 ? 1 : -1) * (0.5 + 0.5 * hash(i, 3, 61));
  const jag = (x: number) => {
    const c = x / 7;
    const i = Math.floor(c);
    const f = c - i;
    return J * (zig(i) + (zig(i + 1) - zig(i)) * f);
  };
  const mul = (u: number) => 1 + 0.1 * Math.sin((2 * Math.PI * u * Lc) / 14 - 0.9 * ph.ls);
  const side = s.sides ?? 0;
  const out: Paint[] = [];
  for (const sg of side === 0 ? [1, -1] : [side]) {
    const C = (u: number, d: number): GPt => {
      const x = sg * (F - Lc + Lc * u + d);
      return [at[0] + x, at[1] + mid * profile(u, peak, ba, bf) + jag(x)];
    };
    const N = (): GPt => [0, -1];
    out.push(...bandPaints({ C, N, w, len: Lc, peak, ba, bf, skew, levels: celLevels(s, ph), drift: clamp(0.4 * Lc, 10, 50), mul, minShard: 3.2 }, { ...ph, seed: ph.seed + (sg > 0 ? 0 : 977) }));
  }
  return out;
}

/** 다각형 (평평한 x, y 목록)을 반평면 x·nx + y·ny ≥ c 안으로 자른다 */
export function clipHalf(pts: readonly number[], nx: number, ny: number, c: number): number[] {
  const out: number[] = [];
  const n = pts.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = pts[2 * i]!;
    const ay = pts[2 * i + 1]!;
    const bx = pts[2 * j]!;
    const by = pts[2 * j + 1]!;
    const da = ax * nx + ay * ny - c;
    const db = bx * nx + by * ny - c;
    if (da >= 0) out.push(ax, ay);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out;
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
  // 맨 위·맨 아래 끊기 (cap): 기울인 납작한 원에서 화면 높이가 가장 높고 낮은 자리 (tan a = sy / tan rot)의 양쪽 16px + 2°
  if (s.cap) {
    const top = Math.atan2(sy * Math.cos(rot), Math.sin(rot));
    for (const a of [top, top + Math.PI]) {
      const ds = r * Math.hypot(Math.sin(a), sy * Math.cos(a));
      const hw = 16 / Math.max(1, ds) + 2 * D2R;
      gaps.push([a - hw, a + hw]);
    }
  }
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
  let segs: number[][][] = [];
  let cur: number[][] | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const h = t(a);
    if (inGap(a) || h < 2.6 || i === steps) {
      if (cur && cur.length > 1) segs.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = [];
    cur.push(rip ? [a, h / 2, rip * Math.sin(nRip * a - 0.8 * ph.ls)] : [a, h / 2]);
  }
  // 14-10 ③ 마디마다 가운데가 굵고 양 끝이 뾰족한 리본 호 (2.6px 아래로 얇아진 끝은 뺀다)
  if (s.taper) {
    segs = segs.map((sg) => {
      const a0 = sg[0]![0]!;
      const a1 = sg[sg.length - 1]![0]!;
      return sg.map((e) => {
        const k = Math.pow(Math.sin((Math.PI * (e[0]! - a0)) / Math.max(1e-6, a1 - a0)), 0.75);
        return [e[0]!, e[1]! * k, ...(e.length > 2 ? [e[2]!] : [])];
      }).filter((e) => e[1]! * 2 >= 2.6);
    }).filter((sg) => sg.length > 1);
  }
  const out: Paint[] = [];
  // 14-10 ① 둘레 잉크 띠
  if (s.rim) out.push({ tone: 3, rings: segs.map((sg) => closeArc(sg.map((e) => [e[0]!, e[1]! + s.rim! * kT, ...(e.length > 2 ? [e[2]!] : [])]), at, r, sy, rot)), sep: true });
  out.push({ tone: s.tone ?? 4, rings: segs.map((sg) => closeArc(sg, at, r, sy, rot)), sep: true });
  // 굵은 자리 안쪽 심 (7px 넘게 굵은 곳만, 두께 35%)
  if (s.core !== undefined) {
    const cores: number[][] = [];
    for (const sg of segs) {
      let run: number[][] = [];
      for (const e of sg) {
        if (e[1]! * 2 >= 7) run.push([e[0]!, e[1]! * 0.35, ...(e.length > 2 ? [e[2]!] : [])]);
        else {
          if (run.length > 1) cores.push(closeArc(run, at, r, sy, rot));
          run = [];
        }
      }
      if (run.length > 1) cores.push(closeArc(run, at, r, sy, rot));
    }
    if (cores.length) out.push({ tone: s.core, rings: cores, sep: true });
  }
  return out;
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
  // 14-10 ②: 세 겹 (테두리 → 몸 색 별 → 작은 흰 심)
  if (s.inner !== undefined) {
    return [
      { tone: s.rim ?? 4, rings: kites(rimGrow, 1.5), sep: true },
      { tone: s.inner, rings: kites(1, 0), sep: true },
      { tone: 0, rings: kites(0.5, 0), sep: true },
    ];
  }
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
  // 리본 조각은 6px 넘게 굵고 두께의 10배까지만 길다 (긴 리본이 흩어지며 가늘고 긴 가닥이 남지 않게).
  // 금 테 (14-10 ②)는 맨 바깥 밝은 단의 한쪽 가장자리를 따라 조각마다 붙어 간다. 흰 빛이 한 점 미끄러진다
  const th = s.thread;
  const glint = th ? (((ph.ls * 0.13) % 1.3) - 0.15) : undefined;
  const edgeGlint = th && glint !== undefined ? th[0] + (th[1] - th[0]) * glint : undefined;
  return bandPaints({ C, N, w: s.w, len: L, peak, ba, bf, skew: s.skew ?? 0, levels: celLevels(s, ph), drift: clamp(0.25 * L, 10, 44), mul, blunt: true, minShard: 6, aspect: 10, edge: th, edgeGlint }, ph);
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
