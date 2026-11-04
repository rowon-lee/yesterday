// YESTERDAY 애니 이펙트 — 궤적 띠 (부품 1~3을 합친 것: 꽉 찬 면 + 4색 띠 + 찢어진 꼬리, 동작연출지침서 14-1·14-2).
// 사용자 피드백 2026-11-04: 힘이 상대를 관통해 앞으로 터져 나간다.
//   길은 주먹(시작) → 상대 너머(끝). 주먹 쪽은 짧은 몸통, 덩어리는 대부분 상대 너머에 있고, 앞끝에서 번개 가닥으로 흩어진다.
//   흰 심이 든 가장 밝은 곳은 판정 상자 안 (14-5): 상자 밖 몸통·가닥은 진한 주색·보색만.
// 0틱에 가장 크고 밝게 바로 나타나 hold틱까지 그대로, tear틱까지 앞끝부터 가닥으로 갈라지며(면이 주먹 쪽으로 줄어든다)
// 얇아지고 바깥 색 단계부터 빠진다. 가장자리는 지그재그로 꺾인 번개 윤곽이고, 띠 안팎으로 굵은 전류 가지가 갈라진다.
// 캐릭터는 색표(ramp)와 모양값(두께 모양·꺾임·가닥·가지)만 넘긴다.
import { clamp01, rng, sawtooth, TIMING, zigzag, put, type AFrame, type Grade, type Layer, type Ramp4 } from './common';
import { colorOf, stepAlive, stepOf } from './bands';
import { boltColor, jag, stroke, type P } from './bolt';
import { DS, sweep, type Sweep, type SweepSpec } from './sweep';
import { inGap, solidFront, tear } from './tear';

export interface BandSpec extends SweepSpec {
  /** 4색 띠 색표 */
  ramp: Ramp4;
  /** 등급 (14-2 시간표) */
  grade: Grade;
  /** 시간표 바꾸기 (잽처럼 빠른 타: 유지·찢어짐을 짧게) */
  timing?: { hold: number; tear: number };
  /** 가장자리 번개 꺾임 크기 (px, 0 = 매끈한 띠)·꼭짓점 간격 (px)·몇 틱마다 다시 꺾나 (0 = 고정) */
  edge?: number;
  edgeStep?: number;
  crackle?: number;
  /** 앞끝에서 흩어지는 가닥 수 (3~7), 피크 때 가닥으로 갈라진 앞쪽 비율, 가장 바깥 가닥이 퍼지는 각 (도), 띠 끝을 넘어 뻗는 길이 (px) */
  strands?: number;
  scatter?: number;
  spread?: number;
  reach?: number;
  /** 가닥 뿌리 굵기 (px), 찢어지는 동안 가닥이 앞으로 날아가는 빠르기 (px/틱) */
  strandW?: number;
  fly?: number;
  /** 띠 안팎으로 갈라지는 굵은 전류 가지: 수, 길이 (px), 뿌리 굵기 (px) */
  branches?: number;
  branchLen?: number;
  branchW?: number;
  /** 흰 심·밝은 주색의 반두께 비율 (띠 두께 대비): 작게 하면 밝은 곳이 판정 상자 모양(네모)에 잘리지 않고 띠 모양을 따라 가늘어진다 */
  coreW?: number;
  mainW?: number;
  /** 흰 심이 판정 가장자리에서 들어오는 깊이 (px), 경계 꺾임 (px), 보색 테두리 두께 (px, 소량) */
  coreIn?: number;
  mainJag?: number;
  rimW?: number;
  /** 그릴 겹 (기본 'back': 캐릭터 뒤. 두 사람 실루엣과 1px 외곽선이 띠 위에 그대로 보인다) */
  layer?: Layer;
  seed?: number;
  /** 미리 깐 면 (같은 기술·방향이면 다시 쓴다: 그때 path·range·floor는 공격자 기준 좌표) */
  sweep?: Sweep;
  /** 면·길·바닥 좌표에 더할 자리 (월드 px, 정수): 공격자 발밑 */
  offset?: readonly [number, number];
}

/** 한 벌 모양 (crackle틱마다 새로): 위·아래 번개 윤곽, 흰 심·밝은 주색 경계 꺾임, 테두리 두께, 앞끝 들쭉날쭉, 전류 가지 */
interface Shape {
  up: Float32Array;
  dn: Float32Array;
  core: Float32Array;
  main: Float32Array;
  rim: Float32Array;
  rag: Float32Array;
  branches: Array<{ pts: P[]; w: number }>;
  seed: number;
}

export default function animeBand(o: BandSpec) {
  const edge = o.edge ?? 0;
  const S = o.sweep ?? sweep({ ...o, slack: edge * 1.6 + 1 });
  const [OX, OY] = o.offset ?? [0, 0];
  const T0 = TIMING[o.grade];
  const T = { hold: o.timing?.hold ?? T0.hold, tear: o.timing?.tear ?? T0.tear };
  const rand = rng(o.seed ?? 1);
  const K = Math.max(3, Math.min(7, o.strands ?? 5));
  const tr = tear(K, o.scatter ?? 0.3, ((o.spread ?? 14) * Math.PI) / 180, rand);
  const coreIn = o.coreIn ?? 2;
  const mainJag = o.mainJag ?? 1.5;
  const rimW = o.rimW ?? 2;
  const crackle = o.crackle ?? 0;
  const layer = o.layer ?? 'back';
  const C = o.ramp;
  const seed0 = (o.seed ?? 1) * 977 + 31;
  const range = o.range ?? (() => false);
  /** 월드 칸 → 판정 범위 안인가 (범위 함수는 공격자 기준 좌표) */
  const inRange = (X: number, Y: number) => range(X - OX, Y - OY);
  const colorBolt = boltColor(C, inRange);
  const floorW = o.floor !== undefined ? o.floor + OY : Infinity;
  const at = (u: number): number => Math.max(0, Math.min(S.N - 1, Math.round(u * (S.N - 1))));

  const shapes = new Map<number, Shape>();
  const shapeAt = (key: number): Shape => {
    let sh = shapes.get(key);
    if (sh) return sh;
    const r = rng(seed0 + key * 7919);
    const N = S.N;
    const step = o.edgeStep ?? 7;
    const saw = (amp: number, st: number) => {
      const a = sawtooth(N, st, r, DS);
      for (let i = 0; i < N; i++) a[i] = a[i]! * amp;
      return a;
    };
    const z = (amp: number, st: number) => {
      const a = zigzag(N, st, r, DS);
      for (let i = 0; i < N; i++) a[i] = a[i]! * amp;
      return a;
    };
    const up = saw(edge, step);
    const dn = saw(edge, step);
    const core = saw(1, step * 0.8);
    const main = z(1, step * 0.9);
    const rim = z(1, step * 0.7);
    // 앞끝 들쭉날쭉: 가로 자리 16칸마다 −1~1
    const rag = new Float32Array(16);
    for (let i = 0; i < 16; i++) rag[i] = (i % 2 ? 1 : -1) * (0.3 + 0.7 * r());
    // 전류 가지: 면 안 (판정 머리부터 면 앞끝 사이) 한 점에서 바깥 앞쪽으로 35~70° 갈라져 꺾이며 뻗고, 60% 자리에서 한 번 더 갈라진다
    const branches: Shape['branches'] = [];
    const nb = o.branches ?? 0;
    for (let b = 0; b < nb; b++) {
      const u = 0.12 + (0.6 * (b + r())) / Math.max(1, nb);
      const k = at(u);
      const side = b % 2 === 0 ? -1 : 1;
      const nx = -S.ty[k]!;
      const ny = S.tx[k]!;
      const e = S.hw[k]! * (0.2 + 0.5 * r()) * side;
      const x = S.px[k]! + nx * e;
      const y = S.py[k]! + ny * e;
      const ang = side * (0.6 + r() * 0.6);
      const dx = S.tx[k]! * Math.cos(ang) - S.ty[k]! * Math.sin(ang);
      const dy = S.tx[k]! * Math.sin(ang) + S.ty[k]! * Math.cos(ang);
      const L = (o.branchLen ?? 20) * (0.7 + r() * 0.6);
      const tip: P = [x + dx * L, y + dy * L];
      const pts = jag([x, y], tip, 3, 6, r);
      branches.push({ pts, w: o.branchW ?? 3 });
      const m = pts[Math.max(1, Math.floor(pts.length * 0.6))]!;
      const fa = ang + side * (0.5 + r() * 0.4);
      const fx = S.tx[k]! * Math.cos(fa) - S.ty[k]! * Math.sin(fa);
      const fy = S.tx[k]! * Math.sin(fa) + S.ty[k]! * Math.cos(fa);
      branches.push({ pts: jag(m, [m[0] + fx * L * 0.45, m[1] + fy * L * 0.45], 2, 5, r), w: Math.max(1, (o.branchW ?? 3) - 1) });
    }
    sh = { up, dn, core, main, rim, rag, branches, seed: seed0 + key * 31 };
    shapes.set(key, sh);
    if (shapes.size > 6) shapes.delete(shapes.keys().next().value!);
    return sh;
  };

  let t = 0;
  /** 찢어지는 진행 (0 피크 → 1 끝) */
  const progress = () => (t <= T.hold ? 0 : clamp01((t - T.hold) / (T.tear - T.hold)));
  const P0 = (k: number): P => [S.px[k]! + OX, S.py[k]! + OY];

  /** 앞끝 가닥 (k번째): 면이 끝나는 자리에서 앞으로 퍼지며 띠 끝 너머까지 꺾이며 뻗는 번개 */
  const strand = (k: number, p: number, r: () => number): { pts: P[]; w: number } => {
    const uf = clamp01(solidFront(tr, p) + tr.root[k]!);
    const i = at(uf);
    const nx = -S.ty[i]!;
    const ny = S.tx[i]!;
    const half = S.hw[i]! + edge * 0.5;
    const x = S.px[i]! + nx * tr.lane[k]! * half;
    const y = S.py[i]! + ny * tr.lane[k]! * half;
    const a = tr.ang[k]!;
    const dx = S.tx[i]! * Math.cos(a) - S.ty[i]! * Math.sin(a);
    const dy = S.tx[i]! * Math.sin(a) + S.ty[i]! * Math.cos(a);
    const flown = (o.fly ?? 0) * Math.max(0, t - T.hold);
    const L = (1 - uf) * S.len + (o.reach ?? 24) * tr.reach[k]! + flown;
    const root: P = [x + dx * flown * 0.6, y + dy * flown * 0.6];
    let tip: P = [x + dx * L, y + dy * L];
    if (o.floor !== undefined) tip = [tip[0], Math.min(tip[1], o.floor - 1)];
    const pts = jag(root, tip, 2 + Math.min(4, half * 0.06), 8, r).map(([px, py]) => [px + OX, py + OY] as P);
    return { pts, w: Math.max(1, (o.strandW ?? 3) * tr.width[k]! * (1 - 0.65 * p)) };
  };

  return {
    /** 확인용: 피크 모양의 길이 (주먹 → 가장 멀리 뻗은 가닥 끝, px)·두께 (px, 바닥에 잘린 쪽은 바닥까지), 판정 범위 칸 수, 가닥·가지 수, 색 단계 수 */
    metrics() {
      let thick = 0;
      for (let i = 0; i < S.N; i++) {
        const e = S.hw[i]! + edge;
        const ny = S.tx[i]!;
        let plus = e;
        let minus = e;
        if (o.floor !== undefined) {
          if (ny > 1e-3) plus = Math.min(plus, Math.max(0, (o.floor - S.py[i]!) / ny));
          if (ny < -1e-3) minus = Math.min(minus, Math.max(0, (o.floor - S.py[i]!) / -ny));
        }
        thick = Math.max(thick, plus + minus);
      }
      let reach = 0;
      for (let k = 0; k < K; k++) reach = Math.max(reach, (o.reach ?? 24) * tr.reach[k]!);
      return { len: S.len + reach, thick, inRange: S.inRange, strands: K, branches: o.branches ?? 0, steps: S.inRange ? 4 : 2 };
    },
    /** 빛을 내는 쪽이 쓴다: 밝기 (피크 1 → 끝 0), 판정 머리 끝 · 덩어리 가운데 · 앞끝 자리 */
    phase(): { k: number; pts: Array<[number, number]> } {
      const p = progress();
      const k = t >= T.tear ? 0 : 1 - p * 0.85;
      return { k, pts: [P0(at(S.uRangeEnd)), P0(at(0.62)), P0(S.N - 1)] };
    },
    update(dt: number) {
      t += dt * 60;
    },
    done() {
      return t >= T.tear;
    },
    draw(f: AFrame, l?: Layer) {
      if ((l ?? 'back') !== layer || t >= T.tear) return;
      const p = progress();
      const key = crackle > 0 ? Math.floor(t / crackle) : 0;
      const sh = shapeAt(key);
      const thin = 1 - 0.45 * p;
      const front = solidFront(tr, p);
      const { s, v, rd, n, w, x0, y0 } = S;
      // 면: 주먹 → 면 앞끝. 가장자리는 지그재그 번개 윤곽, 앞끝은 가로 자리마다 들쭉날쭉
      for (let c = 0; c < n; c++) {
        const k = s[c]!;
        const u = S.u[k]!;
        if (u > front + 0.06) continue;
        const vv = v[c]!;
        const av = Math.abs(vv);
        const E = Math.max(0.5, (S.hw[k]! + (vv < 0 ? sh.up[k]! : sh.dn[k]!)) * thin);
        if (av > E) continue;
        const vn = Math.max(-1, Math.min(0.999, vv / E));
        if (u > front + 0.06 * sh.rag[Math.min(15, Math.floor((vn + 1) * 8))]!) continue;
        if (inGap(tr, u, vn, E, front, p)) continue;
        const r = rd[c]!;
        const rz = sh.rim[k]!;
        // 보색 테두리는 소량: 가장자리를 따라 군데군데 끊기며 1~2px
        const rw = rz < -0.25 ? 0 : rz > 0.45 ? rimW : Math.max(1, rimW - 1);
        const step = stepOf(r, av, E, rw, coreIn + Math.max(0, sh.core[k]!) * mainJag, Math.max(0, sh.main[k]!) * mainJag, o.coreW, o.mainW);
        if (!stepAlive(step, p, 1 - u)) continue;
        const j = S.at[c]!;
        put(f, x0 + (j % w) + OX, y0 + Math.floor(j / w) + OY, colorOf(C, step));
      }
      // 앞끝 가닥: 번개 줄기로 앞으로 퍼지며 흩어진다 (판정 밖이라 보색 심 + 진한 주색)
      const r = rng(sh.seed);
      for (let k = 0; k < K; k++) {
        const st = strand(k, p, r);
        stroke(f, st.pts, st.w, Math.max(1, st.w * 0.45), colorBolt, floorW);
      }
      // 전류 가지: 띠 안에서 바깥 앞쪽으로 굵게 갈라진다 (피크와 찢어지는 앞쪽 동안)
      if (p < 0.55) {
        for (const b of sh.branches) {
          const pts = b.pts.map(([px, py]) => [px + OX, py + OY] as P);
          const w0 = Math.max(1, b.w * (1 - p));
          stroke(f, pts, w0, Math.max(1, w0 * 0.55), colorBolt, floorW);
        }
      }
    },
  };
}
