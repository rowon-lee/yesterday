import type { FollowFrame, Joints, Point } from './pose';

/*
 * 따라 움직이는 것 (2차 동작, 사용자 피드백 2026-11-02 11-0·11-1): 연검 리본, 꽁지머리·옷자락의 흔들림.
 * 실시간 물리가 아니라 동작 그림을 미리 그릴 때 그 동작 자신의 손·몸 움직임으로 한 번 계산해 프레임마다 관절(fx)에 넣어 둔다
 * (같은 데이터면 언제나 같은 모양. 연검 판정 선은 처음에 이 점들을 뽑아 공격 데이터에 적었다(3-0a(2)부터는 그림과 따로 관리, 차이 보고: tools/ribbon-lines.mjs).
 * - 리본: 손잡이는 손에 붙어 손잡이 방향(아래팔 방향 또는 포즈의 무기 각도)으로 곧고, 날은 마디 8개짜리 사슬이다.
 *   손이 먼저 움직이고 휘어짐이 날을 따라 2~4프레임 늦게 끝까지 전해지며, 끝이 가장 늦게 가장 빠르게 꺾인다(채찍).
 *   쉴 때도 곧게 펴지지 않게 마디마다 S자로 굽는 버릇(쉬는 각도)이 있고, 중력에 늘어지며 바닥에 닿으면 바닥 위에서 미끄러진다.
 *   멈출 때는 한 번 지나쳤다 돌아온다 (관성).
 * - 흔들림: 몸이 움직이는 만큼(숙임·뒤로 뻗은 다리·바람) 자락과 머리가 늦게 따라오고, 멈출 때 한 번 더 지나쳤다 돌아온다
 *   (덜 감쇠된 용수철). 머리와 자락은 다른 박자.
 * 프레임 i의 값 = 프레임 i가 보이기 시작하는 순간의 상태. 그 뒤 표시 틱 동안 손을 다음 프레임 자리까지 고르게 옮기며 한 틱씩 계산한다.
 * 반복 동작은 두 바퀴 돌려 이음매가 맞는 세 번째 바퀴를 쓰고, 한 번 하는 동작은 첫 프레임 자세로 잠깐 세워 두었다가 시작한다.
 * 연타처럼 앞 동작에서 이어지는 동작은 앞 동작의 그 프레임 상태에서 시작한다 (from: 리본이 끊기지 않게).
 */

/** 연검 치수 (px): 손잡이 6 + 날 32 (마디 8 × 4) = 38 */
export const RIBBON = { handle: 6, seg: 4, segs: 8 } as const;
/** 리본 점 개수: 손, 손잡이 끝, 날 마디 끝 8개 */
export const RIB_POINTS = 2 + RIBBON.segs;

export interface RibbonSpec {
  /** 손잡이 방향: 아래팔(팔꿈치 → 손) 방향(기본) 또는 포즈의 무기 각도 wa (크게 돌리는 동작) */
  drive?: 'forearm' | 'wa';
  /** 리본을 뒤로 미는 바람 (px/틱², 앞으로 달리면 깃발처럼 뒤로 끌린다. 뒤로 물러나면 음수) */
  wind?: number;
  /** 쉬는 S자 굽힘의 세기 배수 (기본 1) */
  curl?: number;
  /** 중력 배수 (기본 1. 떨어지는 동안은 리본이 떠오르듯 작게) */
  gravity?: number;
  /** 쉬는 모양으로 돌아가려는 세기 배수 (기본 1. 작으면 낭창하게 늘어진다) */
  stiff?: number;
  /** 감쇠 (기본 0.86: 틱마다 속도에 곱한다. 크면 휘두른 힘이 오래 남아 끝까지 뻗는다) */
  damp?: number;
  /**
   * 프레임별 리본 박자 (공격): at 프레임(소수 가능)에서 세기·굽힘·감쇠 배수. 사이는 곧게 잇는다.
   * 휘두르는 동안은 낭창하게(휘어짐이 늦게 전해짐), 타격 순간 세게·곧게(끝이 꺾이며 뻗음 = 채찍), 그 뒤 다시 풀려 S자로 출렁인다
   */
  keys?: ReadonlyArray<{ at: number; stiff?: number; curl?: number; damp?: number; gravity?: number; wind?: number }>;
  /** 은빛 원 (빠르게 돌려 만든 원형 막): 반지름과 그 원을 그리는 프레임 (가운데는 손) */
  disc?: { r: number; frames: readonly number[] };
  /** 리본을 그리지 않는 프레임 (접어 넣었을 때·나비 속에서 아직 생겨나지 않았을 때) */
  hidden?: readonly number[];
  /** 공중 동작: 발밑 줄을 바닥으로 보지 않는다 (리본이 발 아래로 늘어진다) */
  air?: boolean;
  /** 리본이 몸 뒤로 돌아가 몸보다 먼저 그리는 프레임 (피루엣처럼 몸 둘레를 돌 때) */
  back?: readonly number[];
}

export interface FollowSpec {
  ribbon?: RibbonSpec;
  /** 자락·머리를 뒤로 미는 바람 0~1 (걷기 0.4, 대시 1) */
  wind?: number;
  /** 제자리에서 숨 쉬듯 흔들림 (머리·자락이 다른 박자로) */
  breeze?: number;
  /** 앞 동작의 이 프레임이 보이기 시작하는 순간 상태에서 시작한다 (연타). 앞 동작이 먼저 만들어져 있어야 한다 */
  from?: { motion: string; frame: number };
  /** 옷자락이 둥글게 펼쳐지는 정도 (프레임 at에서 v, 사이는 곧게. 용수철로 늦게 따라간다): 돌 때 */
  flare?: ReadonlyArray<{ at: number; v: number }>;
}

/** 쉬는 굽힘 각도 (도): 손잡이 끝부터 날 끝까지 S자, 끝은 안으로 말린다 */
const REST = [4, 12, 15, 9, -4, -14, -20, -26];
const G = 0.24;
const DAMP = 0.86;
/** 마디마다 쉬는 모양으로 돌아가려는 세기 (손잡이 쪽이 단단하고 끝으로 갈수록 낭창하다: 채찍) */
const STIFF = [0.34, 0.28, 0.23, 0.18, 0.14, 0.11, 0.08, 0.06];
const FLOOR = -1;
/** 이웃 마디 사이 가장 크게 꺾이는 각도 (도): 리본이 제자리에서 똘똘 말려 덩어리가 되지 않게 */
const MAX_BEND = 50;

type V = [number, number];
const sub = (a: readonly number[], b: readonly number[]): V => [a[0]! - b[0]!, a[1]! - b[1]!];
const unit = (v: V): V => {
  const d = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / d, v[1] / d];
};
const rot = (v: V, deg: number): V => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};

/** 몸이 뒤로 휘날리게 하는 힘 (0~1): 몸을 앞으로 숙일수록, 뒷다리가 엉덩이 뒤로 멀리 갈수록 */
function pull(j: Joints): number {
  const up = unit([j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]]);
  const lean = Math.max(0, Math.min(1, (up[0] - 0.1) / 0.6));
  const back: V = [up[1], -up[0]];
  const behind = (j.fB[0] - j.hip[0]) * back[0] + (j.fB[1] - j.hip[1]) * back[1];
  const stride = Math.max(0, Math.min(1, (behind - 6) / 12));
  return Math.max(lean, stride * 0.8);
}

/** 손잡이 방향 (아래팔 방향) */
const forearm = (j: Joints): V => unit(sub(j.hF, j.eF));

/**
 * 쉬는 모양의 리본 (따라 움직이는 값이 없는 동작: 공통 맞는 동작 등): 손잡이는 아래팔 방향, 날은 S자로 굽으며 아래로 늘어진다.
 * 바닥 아래로는 내려가지 않는다
 */
export function restRibbon(j: Joints): Point[] {
  return placeChain(j.hF, forearm(j), 1, 0.55).map((p) => [Math.round(p[0]), Math.round(p[1])] as Point);
}

function placeChain(hand: readonly number[], dir: V, curl: number, droop: number, floor = FLOOR): V[] {
  const P: V[] = [[hand[0]!, hand[1]!], [hand[0]! + dir[0] * RIBBON.handle, hand[1]! + dir[1] * RIBBON.handle]];
  let d = dir;
  for (let k = 0; k < RIBBON.segs; k++) {
    d = unit(rot(d, REST[k]! * curl));
    d = unit([d[0], d[1] + droop]);
    const p = P[P.length - 1]!;
    P.push([p[0] + d[0] * RIBBON.seg, Math.min(floor, p[1] + d[1] * RIBBON.seg)]);
  }
  return P;
}

interface State {
  P: V[];
  Q: V[];
  gown: { x: number; v: number };
  hair: { x: number; v: number };
  flare: { x: number; v: number };
}
const copy = (s: State): State => ({
  P: s.P.map((p) => [p[0], p[1]] as V),
  Q: s.Q.map((p) => [p[0], p[1]] as V),
  gown: { ...s.gown },
  hair: { ...s.hair },
  flare: { ...s.flare },
});
/** 프레임 위치 fi에서 곧게 이은 값 */
function lerpKeys(ks: ReadonlyArray<{ at: number; v: number }>, fi: number): number {
  if (fi <= ks[0]!.at) return ks[0]!.v;
  for (let i = 1; i < ks.length; i++) {
    const b = ks[i]!;
    if (fi <= b.at) {
      const a = ks[i - 1]!;
      return a.v + ((b.v - a.v) * (fi - a.at)) / Math.max(1e-6, b.at - a.at);
    }
  }
  return ks[ks.length - 1]!.v;
}
/** 만든 동작마다 프레임별 시작 상태 (연타가 앞 동작에서 이어 받는다) */
const STATES = new Map<string, State[]>();

/**
 * 동작 하나의 2차 동작을 계산한다. joints: 프레임별 관절 (판정용), dur: 프레임별 표시 틱, loop: 반복 동작
 */
export function bakeFollow(name: string, spec: FollowSpec, joints: readonly Joints[], dur: readonly number[], loop: boolean): FollowFrame[] {
  const n = joints.length;
  const total = dur.reduce((a, b) => a + b, 0);
  const rs = spec.ribbon;
  const curl0 = rs?.curl ?? 1;
  const damp0 = rs?.damp ?? DAMP;
  const stiff0 = rs?.stiff ?? 1;
  /** 프레임 위치 fi에서의 박자 값 (keys 사이를 곧게) */
  const grav0 = rs?.gravity ?? 1;
  const wind0 = rs?.wind ?? 0;
  const floor = rs?.air ? Infinity : FLOOR;
  const beat = (fi: number): { stiff: number; curl: number; damp: number; grav: number; wind: number } => {
    const ks = rs?.keys;
    if (!ks?.length) return { stiff: stiff0, curl: curl0, damp: damp0, grav: G * grav0, wind: wind0 };
    let a = ks[0]!;
    let b = ks[0]!;
    for (const k of ks) {
      if (k.at <= fi) a = k;
      if (k.at >= fi) {
        b = k;
        break;
      }
      b = k;
    }
    const t = b.at > a.at ? Math.max(0, Math.min(1, (fi - a.at) / (b.at - a.at))) : 0;
    const mix = (x: number | undefined, y: number | undefined, d: number) => (x ?? d) + ((y ?? d) - (x ?? d)) * t;
    return {
      stiff: mix(a.stiff, b.stiff, stiff0), curl: mix(a.curl, b.curl, curl0), damp: mix(a.damp, b.damp, damp0),
      grav: G * mix(a.gravity, b.gravity, grav0), wind: mix(a.wind, b.wind, wind0),
    };
  };
  const curl = curl0;

  const next = (i: number) => (loop ? (i + 1) % n : Math.min(n - 1, i + 1));
  const handAt = (i: number, u: number): V => {
    const a = joints[i]!.hF;
    const b = joints[next(i)]!.hF;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };
  const dirAt = (i: number, u: number): V => {
    if (rs?.drive === 'wa') {
      const a = joints[i]!.wa;
      let b = joints[next(i)]!.wa;
      // 가까운 쪽으로 돈다
      while (b - a > Math.PI) b -= 2 * Math.PI;
      while (a - b > Math.PI) b += 2 * Math.PI;
      const w = a + (b - a) * u;
      return [Math.cos(w), Math.sin(w)];
    }
    const fa = forearm(joints[i]!);
    const fb = forearm(joints[next(i)]!);
    return unit([fa[0] + (fb[0] - fa[0]) * u, fa[1] + (fb[1] - fa[1]) * u]);
  };

  let st: State;
  const from = spec.from && STATES.get(spec.from.motion)?.[spec.from.frame];
  if (spec.from && !from) throw new Error(`따라 움직임: ${name}의 앞 동작 ${spec.from.motion}#${spec.from.frame}이 먼저 만들어져 있어야 한다`);
  if (from) st = copy(from);
  else {
    const P = placeChain(handAt(0, 0), dirAt(0, 0), curl, 0.35, floor);
    const g0 = pull(joints[0]!) + (spec.wind ?? 0);
    st = { P, Q: P.map((p) => [p[0], p[1]] as V), gown: { x: g0, v: 0 }, hair: { x: g0, v: 0 }, flare: { x: 0, v: 0 } };
  }
  const { P, Q } = st;

  const stepRibbon = (hand: V, dir: V, fi: number) => {
    const bt = beat(fi);
    P[0] = hand;
    P[1] = [hand[0] + dir[0] * RIBBON.handle, hand[1] + dir[1] * RIBBON.handle];
    Q[0] = [P[0][0], P[0][1]];
    Q[1] = [P[1][0], P[1][1]];
    for (let k = 2; k < P.length; k++) {
      const p = P[k]!;
      const q = Q[k]!;
      const vx = (p[0] - q[0]) * bt.damp;
      const vy = (p[1] - q[1]) * bt.damp;
      Q[k] = [p[0], p[1]];
      P[k] = [p[0] + vx - bt.wind, p[1] + vy + bt.grav];
    }
    for (let k = 2; k < P.length; k++) {
      // 쉬는 S자 굽힘 쪽으로 조금씩 (앞 마디 방향을 쉬는 각도만큼 돌린 자리)
      const prev = unit(sub(P[k - 1]!, P[k - 2]!));
      const want = unit(rot(prev, REST[k - 2]! * bt.curl));
      const tx = P[k - 1]![0] + want[0] * RIBBON.seg;
      const ty = P[k - 1]![1] + want[1] * RIBBON.seg;
      const w = Math.min(0.9, STIFF[k - 2]! * bt.stiff);
      let p: V = [P[k]![0] + (tx - P[k]![0]) * w, P[k]![1] + (ty - P[k]![1]) * w];
      // 마디 길이는 늘 같게 (앞 마디를 따라간다), 너무 꺾이지 않게
      let d = unit(sub(p, P[k - 1]!));
      const turn = Math.atan2(prev[0] * d[1] - prev[1] * d[0], prev[0] * d[0] + prev[1] * d[1]);
      const lim = (MAX_BEND * Math.PI) / 180;
      if (Math.abs(turn) > lim) d = rot(prev, (Math.sign(turn) * MAX_BEND));
      p = [P[k - 1]![0] + d[0] * RIBBON.seg, P[k - 1]![1] + d[1] * RIBBON.seg];
      // 바닥 위에서 미끄러진다 (바닥을 뚫지 않는다, 닿으면 가로 속도가 줄어든다)
      if (p[1] > floor) {
        p = [p[0], floor];
        Q[k] = [Q[k]![0] + (p[0] - Q[k]![0]) * 0.5, floor];
      }
      P[k] = p;
    }
  };

  const windC = spec.wind ?? 0;
  const breeze = spec.breeze ?? 0;
  const stepSpring = (s: { x: number; v: number }, target: number, w: number, z: number) => {
    s.v += w * w * (target - s.x) - 2 * z * w * s.v;
    s.x += s.v;
  };

  const out: FollowFrame[] = Array.from({ length: n }, () => ({ gown: 0, hair: 0 }));
  const states: State[] = [];
  let tick = 0;
  const run = (record: boolean) => {
    for (let i = 0; i < n; i++) {
      if (record) {
        states.push(copy(st));
        const f = out[i]!;
        f.gown = Math.max(0, Math.min(1.4, st.gown.x));
        f.hair = Math.max(-0.6, Math.min(1.4, st.hair.x));
        if (rs && !rs.hidden?.includes(i)) f.rib = P.map((p) => [Math.round(p[0]), Math.round(p[1])] as Point);
        if (rs?.back?.includes(i)) f.back = true;
        if (spec.flare) f.flare = Math.max(0, Math.min(1.2, st.flare.x));
        if (rs?.disc?.frames.includes(i)) f.disc = { r: rs.disc.r, phase: rs.disc.frames.indexOf(i) };
      }
      const d = Math.max(1, dur[i]!);
      // 엉덩이가 빨리 내려앉으면 (착지) 자락이 부풀어 오른다
      const sink = Math.max(0, (joints[next(i)]!.hip[1] - joints[i]!.hip[1]) / d) * 0.35;
      const p0 = pull(joints[i]!) + sink;
      const p1 = pull(joints[next(i)]!) + sink;
      for (let k = 1; k <= d; k++) {
        const u = k / d;
        if (rs) stepRibbon(handAt(i, u), dirAt(i, u), i + u);
        const drive = p0 + (p1 - p0) * u + windC;
        // 숨 쉬듯 흔들림: 반복 동작 한 바퀴에 머리는 두 번, 자락은 세 번 (이음매가 맞게)
        const ph = (2 * Math.PI * (tick % total)) / total;
        stepSpring(st.gown, Math.min(1.4, drive + breeze * (0.22 + 0.2 * Math.sin(3 * ph))), 0.16, 0.22);
        stepSpring(st.hair, Math.min(1.4, drive * 0.9 + breeze * (0.15 + 0.35 * Math.sin(2 * ph + 1))), 0.24, 0.2);
        if (spec.flare) stepSpring(st.flare, lerpKeys(spec.flare, i + u), 0.3, 0.35);
        tick++;
      }
    }
  };
  // 시작 자세에서 잠깐 세워 두어 리본이 쉬는 모양으로 늘어지게 한다 (이어 받은 동작은 그대로)
  if (rs && !from) for (let k = 0; k < 90; k++) stepRibbon(handAt(0, 0), dirAt(0, 0), 0);
  if (loop) {
    run(false);
    run(false);
  }
  run(true);
  STATES.set(name, states);
  return out;
}
