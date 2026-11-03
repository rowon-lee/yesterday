// YESTERDAY 애니 이펙트 — 궤적 띠 (부품 1~3을 합친 것: 꽉 찬 면 + 4색 띠 + 찢어진 꼬리, 동작연출지침서 14-1·14-2).
// 0틱에 가장 크고 밝게 바로 나타나(커지는 과정 없음) hold틱까지 그대로, 그 뒤 tear틱까지 꼬리부터 가닥으로 찢어지며
// 얇아지고 바깥 색 단계부터 빠진다. 캐릭터는 색표(ramp)와 모양값(가장자리 꺾임·가닥 수·전류 가닥 등)만 넘긴다.
// 모양값 예: 라이덴 '꽉 찬 번개 띠 + 가지 치는 전류 가닥' = edge · crackle 2 · wiggle · filaments.
// 흰 심은 판정 머리 안에서 머리 앞쪽으로 갈수록 굵어지는 쐐기 (혜성 머리): 앞 가장자리가 가장 굵고 밝다.
import { clamp01, line, put, rng, TIMING, zigzag, type AFrame, type Grade, type Layer, type Ramp4 } from './common';
import { colorOf, stepAlive, stepOf } from './bands';
import { DS, sweep, type Sweep, type SweepSpec } from './sweep';
import { tear, torn } from './tear';

export interface BandSpec extends SweepSpec {
  /** 4색 띠 색표 */
  ramp: Ramp4;
  /** 등급 (14-2 시간표) */
  grade: Grade;
  /** 가장자리 꺾임 크기 (px, 0 = 매끈한 띠). 번개 띠는 3~5 */
  edge?: number;
  /** 꺾임 간격 (px) */
  edgeStep?: number;
  /** 몇 틱마다 꺾임을 새로 뽑나 (0 = 고정: 매끈한 띠, 2 = 번개가 지직거린다) */
  crackle?: number;
  /** 꼬리 가닥 수 (3~7, 없으면 꼬리 두께로: 가닥 하나 4px쯤) */
  strands?: number;
  /** 피크 때 다 갈라진 꼬리 비율 (0~1) */
  tail?: number;
  /** 가닥 묶음이 꺾이는 크기 (가로 비율 단위, 번개 가닥 0.15쯤) */
  wiggle?: number;
  /** 흰 심이 판정 가장자리에서 들어오는 깊이 (px) */
  coreIn?: number;
  /** 밝은 주색·흰 심 경계 꺾임 (px) */
  mainJag?: number;
  /** 보색 테두리 두께 (px, 소량) */
  rimW?: number;
  /** 가지 치는 전류 가닥 수 (띠 가장자리에서 앞쪽으로 갈라지는 가는 번개) */
  filaments?: number;
  /** 전류 가닥 길이 (px) */
  filamentLen?: number;
  /** 그릴 겹 (기본 'back': 캐릭터 뒤. 두 사람 실루엣과 1px 외곽선이 띠 위에 그대로 보인다) */
  layer?: Layer;
  seed?: number;
  /** 미리 깐 면 (같은 기술·방향이면 다시 쓴다: 그때 path·range·floor는 공격자 기준 좌표) */
  sweep?: Sweep;
  /** 면·길·바닥 좌표에 더할 자리 (월드 px, 정수): 공격자 발밑 */
  offset?: readonly [number, number];
}

/** 한 벌 모양 (crackle틱마다 새로): 위·아래 가장자리 꺾임, 흰 심·밝은 주색 경계 꺾임, 테두리 두께 꺾임, 가닥 묶음 꺾임, 전류 가닥 */
interface Shape {
  up: Float32Array;
  dn: Float32Array;
  core: Float32Array;
  main: Float32Array;
  rim: Float32Array;
  wig: Float32Array;
  fil: Array<{ pts: Array<[number, number]>; w: number }>;
}

export default function animeBand(o: BandSpec) {
  const edge = o.edge ?? 0;
  const S = o.sweep ?? sweep({ ...o, slack: edge + 1 });
  const [OX, OY] = o.offset ?? [0, 0];
  const T = TIMING[o.grade];
  const rand = rng(o.seed ?? 1);
  const tailHalf = S.hw[Math.floor((S.N - 1) * 0.2)]!;
  const K = Math.max(3, Math.min(7, o.strands ?? Math.round((2 * tailHalf) / 4)));
  const tr = tear(K, o.tail ?? 0.35, S.uRange, rand);
  const coreIn = o.coreIn ?? 2;
  const mainJag = o.mainJag ?? 1.5;
  const rimW = o.rimW ?? 2;
  const wiggle = o.wiggle ?? 0;
  const crackle = o.crackle ?? 0;
  const layer = o.layer ?? 'back';
  const C = o.ramp;
  const seed0 = (o.seed ?? 1) * 977 + 31;
  // 흰 심이 다 굵어지는 자리: 판정 머리 시작에서 머리 길이의 40% 앞
  const ub = S.uRange;
  const ufull = ub + (1 - ub) * 0.4;
  const shapes = new Map<number, Shape>();
  const shapeAt = (key: number): Shape => {
    let sh = shapes.get(key);
    if (sh) return sh;
    const r = rng(seed0 + key * 7919);
    const N = S.N;
    const step = o.edgeStep ?? 7;
    const z = (amp: number, st: number) => {
      const a = zigzag(N, st, r, DS);
      for (let i = 0; i < N; i++) a[i] = a[i]! * amp;
      return a;
    };
    const up = z(edge, step);
    const dn = z(edge, step);
    const core = z(1, step * 0.8);
    const main = z(1, step * 0.9);
    const rim = z(1, step * 0.7);
    const wig = z(wiggle, step * 1.4);
    // 전류 가닥: 띠 30~95% 자리 가장자리에서 바깥 앞쪽으로 25~60° 갈라져 3번 꺾이고, 끝에서 한 번 더 갈라진다
    const fil: Shape['fil'] = [];
    const nf = o.filaments ?? 0;
    for (let b = 0; b < nf; b++) {
      const k = Math.floor((0.3 + 0.65 * ((b + r()) / Math.max(1, nf))) * (N - 1));
      const side = b % 2 === 0 ? -1 : 1;
      const nx = -S.ty[k]!;
      const ny = S.tx[k]!;
      const e = S.hw[k]! * 0.85;
      let x = S.px[k]! + nx * e * side;
      let y = S.py[k]! + ny * e * side;
      // 바닥 아래로는 내려가지 않는다
      const ang = (0.4 + r() * 0.6) * side;
      const dx = S.tx[k]! * Math.cos(ang) - S.ty[k]! * Math.sin(ang);
      const dy = S.tx[k]! * Math.sin(ang) + S.ty[k]! * Math.cos(ang);
      const L = (o.filamentLen ?? 18) * (0.65 + r() * 0.6);
      const pts: Array<[number, number]> = [[x, y]];
      for (let m = 0; m < 3; m++) {
        x += (dx * L) / 3 + (r() - 0.5) * 6;
        y += (dy * L) / 3 + (r() - 0.5) * 6;
        if (o.floor !== undefined) y = Math.min(y, o.floor - 1);
        pts.push([x, y]);
      }
      fil.push({ pts, w: 2 });
      const [ex, ey] = pts[2]!;
      fil.push({ pts: [[ex, ey], [ex + dx * L * 0.4 + (r() - 0.5) * 8, Math.min(o.floor ?? Infinity, ey + dy * L * 0.4 + (r() - 0.5) * 8)]], w: 1 });
    }
    sh = { up, dn, core, main, rim, wig, fil };
    shapes.set(key, sh);
    if (shapes.size > 6) shapes.delete(shapes.keys().next().value!);
    return sh;
  };

  let t = 0;
  /** 찢어지는 진행 (0 피크 → 1 끝) */
  const progress = () => (t <= T.hold ? 0 : clamp01((t - T.hold) / (T.tear - T.hold)));
  const head = (): [number, number] => [S.px[S.N - 1]! + OX, S.py[S.N - 1]! + OY];

  return {
    /** 확인용: 피크 모양의 길이 (가장 긴 가닥 끝 → 머리 앞, px)·두께 (px), 판정 범위 칸 수, 가닥 수, 전류 가닥 수, 색 단계 수 */
    metrics() {
      // 보이는 두께: 바닥 아래로 잘린 쪽은 바닥까지만
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
      let tailStart = 1;
      for (let k = 0; k < tr.K; k++) tailStart = Math.min(tailStart, tr.start[k]!);
      return { len: S.len * (1 - tailStart), thick, inRange: S.inRange, strands: tr.K, filaments: o.filaments ?? 0, steps: S.inRange ? 4 : 2 };
    },
    /** 빛을 내는 쪽이 쓴다: 밝기 (피크 1 → 끝 0), 머리·가운데·꼬리 자리 */
    phase(): { k: number; pts: Array<[number, number]> } {
      const p = progress();
      const k = t >= T.tear ? 0 : 1 - p * 0.85;
      const m = Math.floor((S.N - 1) * 0.55);
      return { k, pts: [head(), [S.px[m]! + OX, S.py[m]! + OY], [S.px[0]! + OX, S.py[0]! + OY]] };
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
      const sh = shapeAt(crackle > 0 ? Math.floor(t / crackle) : 0);
      const thin = 1 - 0.5 * p;
      const { at, s, v, rd, n, w, x0, y0 } = S;
      for (let c = 0; c < n; c++) {
        const k = s[c]!;
        const u = S.u[k]!;
        const vv = v[c]!;
        const av = Math.abs(vv);
        const E = Math.max(0.5, (S.hw[k]! + (vv < 0 ? sh.up[k]! : sh.dn[k]!)) * thin);
        if (av > E) continue;
        const vn = Math.max(-1, Math.min(0.999, vv / E + sh.wig[k]!));
        if (!torn(tr, u, vn, E, p)) continue;
        const r = rd[c]!;
        let step: 0 | 1 | 2 | 3;
        const fromHead = (1 - u) * S.len;
        if (r > 0 && fromHead < 2.5) step = 0;
        else {
          // 보색 테두리는 소량: 가장자리를 따라 군데군데 끊기며 1~2px
          const rz = sh.rim[k]!;
          const rw = rz < -0.25 ? 0 : rz > 0.45 ? rimW : Math.max(1, rimW - 1);
          step = stepOf(r, av, E, rw, coreIn + Math.max(0, sh.core[k]!) * mainJag, Math.max(0, sh.main[k]!) * mainJag);
          // 흰 심은 머리 앞쪽으로 굵어지는 쐐기: 머리 시작에서는 가늘게
          if (step === 0 && av > E * (0.15 + 0.85 * clamp01((u - ub) / Math.max(1e-3, ufull - ub)))) step = 1;
        }
        if (!stepAlive(step, p, u)) continue;
        const j = at[c]!;
        put(f, x0 + (j % w) + OX, y0 + Math.floor(j / w) + OY, colorOf(C, step));
      }
      // 전류 가닥: 피크와 찢어지는 앞쪽 동안 (판정 밖으로 나가므로 흰 심 없이 바깥 두 색: 보색 → 진한 주색으로 식는다)
      if (p < 0.5) {
        for (const fk of sh.fil) {
          for (let i = 0; i + 1 < fk.pts.length; i++) {
            const a = fk.pts[i]!;
            const b = fk.pts[i + 1]!;
            const col = p < 0.2 ? C.rim : C.deep;
            line(f, a[0] + OX, a[1] + OY, b[0] + OX, b[1] + OY, col);
            if (fk.w > 1 && i === 0) line(f, a[0] + OX, a[1] + OY + 1, b[0] + OX, b[1] + OY + 1, col);
          }
        }
      }
    },
  };
}
