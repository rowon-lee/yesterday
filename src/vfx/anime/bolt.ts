// YESTERDAY 애니 이펙트 — 번개 줄기 도구 (라이덴 '꽉 찬 번개 띠 + 가지 치는 전류 가닥'의 모양값, 렌더 전용).
// 부드러운 붓 자국이 아니라 지그재그로 꺾인 번개: 마디마다 법선 방향으로 번갈아(+ −) 흔든 꺾인 선을 만들고,
// 굵기가 뿌리에서 끝으로 줄어드는 선으로 칠한다. 칸마다 판정 범위 안이면 흰 심·밝은 주색, 밖이면 보색·진한 주색 (14-5).
import { clamp01, put, rng, TIMING, type AFrame, type Grade, type Layer, type Ramp4 } from './common';

export type P = [number, number];

/**
 * a → b 번개: 마디 길이를 seg의 0.5~1.6배로 들쭉날쭉하게 나누고, 마디마다 법선 방향으로 흔든다.
 * 흔드는 쪽은 대체로 번갈아 바꾸되 가끔 같은 쪽으로 두 번 (스프링처럼 고르지 않게), 가끔 크게 꺾인다. 양 끝은 제자리
 */
export function jag(a: readonly [number, number], b: readonly [number, number], amp: number, seg: number, rand: () => number): P[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const out: P[] = [[a[0], a[1]]];
  let sign = rand() < 0.5 ? 1 : -1;
  let d = seg * (0.5 + rand() * 1.1);
  while (d < L - seg * 0.4) {
    const big = rand() < 0.18 ? 1.7 : 1;
    const off = sign * amp * big * (0.3 + 0.7 * rand());
    out.push([a[0] + (dx * d) / L + nx * off, a[1] + (dy * d) / L + ny * off]);
    if (rand() < 0.8) sign = -sign;
    d += seg * (0.5 + rand() * 1.1);
  }
  out.push([b[0], b[1]]);
  return out;
}

/** 굽은 길을 따라가는 번개: 길 위를 seg px 안팎(0.5~1.6배) 간격으로 걸으며 그 자리 법선 방향으로 흔든다 (jag와 같은 꺾임) */
export function jagAlong(path: ReadonlyArray<readonly [number, number]>, amp: number, seg: number, rand: () => number): P[] {
  const out: P[] = [[path[0]![0], path[0]![1]]];
  let sign = rand() < 0.5 ? 1 : -1;
  let next = seg * (0.5 + rand() * 1.1);
  let walked = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    const nx = -dy / L;
    const ny = dx / L;
    // 이 마디 안에서 다음 꼭짓점 자리에 닿을 때마다 찍는다
    while (walked + L >= next) {
      const d = next - walked;
      const big = rand() < 0.18 ? 1.7 : 1;
      const off = sign * amp * big * (0.3 + 0.7 * rand());
      out.push([a[0] + (dx * d) / L + nx * off, a[1] + (dy * d) / L + ny * off]);
      if (rand() < 0.8) sign = -sign;
      next += seg * (0.5 + rand() * 1.1);
    }
    walked += L;
  }
  const z = path[path.length - 1]!;
  out.push([z[0], z[1]]);
  return out;
}

/**
 * 굵기가 w0 → w1로 줄어드는 꺾인 선을 칠한다. 바깥(edge 색)을 먼저, 가운데 1px 심(core 색)을 나중에 (굵기 2px 이상일 때만 심).
 * colorAt(x, y, 심인가)으로 칸마다 색을 정한다 (판정 범위에 따라 다른 색). floor보다 아래 칸은 칠하지 않는다
 */
export function stroke(
  f: AFrame,
  pts: ReadonlyArray<readonly [number, number]>,
  w0: number,
  w1: number,
  colorAt: (x: number, y: number, core: boolean) => number,
  floor = Infinity,
): void {
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) total += Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
  total = Math.max(total, 1);
  for (const pass of [0, 1]) {
    let acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(L * 2));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        const w = w0 + (w1 - w0) * ((acc + L * t) / total);
        if (pass === 0) {
          const r = Math.max(0, (w - 1) / 2);
          const ri = Math.ceil(r);
          for (let oy = -ri; oy <= ri; oy++) {
            for (let ox = -ri; ox <= ri; ox++) {
              if (ox * ox + oy * oy > r * r + 0.5) continue;
              const X = Math.round(x + ox);
              const Y = Math.round(y + oy);
              if (Y > floor) continue;
              put(f, X, Y, colorAt(X, Y, false));
            }
          }
        } else if (w >= 1.5) {
          const X = Math.round(x);
          const Y = Math.round(y);
          if (Y <= floor) put(f, X, Y, colorAt(X, Y, true));
        }
      }
      acc += L;
    }
  }
}

/**
 * 색 고르기: 판정 범위 안 칸은 심 = 흰 심, 바깥 = 밝은 주색. 범위 밖 칸은 심 = 보색, 바깥 = 진한 주색 (흰 심 없이 바깥 두 색, 14-5)
 */
export const boltColor = (ramp: Ramp4, inRange: (x: number, y: number) => boolean) =>
  (x: number, y: number, core: boolean): number => (inRange(x, y) ? (core ? ramp.core : ramp.main) : core ? ramp.rim : ramp.deep);

/**
 * 번개 한 줄기 이펙트: a → b로 꽂히는 굵은 번개 (예: 슈퍼맨 펀치 주먹 → 바닥). 끝에서 2~3갈래로 갈라진다.
 * 0틱에 다 나타나 hold틱 그대로, 찢어지는 동안 시작 쪽부터 끊기며 가늘어진다. 2틱마다 다시 꺾인다
 */
export function boltFx(o: {
  a: readonly [number, number];
  b: readonly [number, number];
  width: number;
  forks?: number;
  ramp: Ramp4;
  grade: Grade;
  timing?: { hold: number; tear: number };
  /** 월드 칸 → 판정 범위 안인가 */
  inRange?: (x: number, y: number) => boolean;
  floor?: number;
  layer?: Layer;
  seed?: number;
}) {
  const T0 = TIMING[o.grade];
  const T = { hold: o.timing?.hold ?? T0.hold, tear: o.timing?.tear ?? T0.tear };
  const colorAt = boltColor(o.ramp, o.inRange ?? (() => false));
  const layer = o.layer ?? 'back';
  let t = 0;
  return {
    update(dt: number) {
      t += dt * 60;
    },
    done() {
      return t >= T.tear;
    },
    draw(f: AFrame, l?: Layer) {
      if ((l ?? 'back') !== layer || t >= T.tear) return;
      const p = t <= T.hold ? 0 : clamp01((t - T.hold) / (T.tear - T.hold));
      const r = rng((o.seed ?? 1) * 211 + Math.floor(t / 2) * 7919);
      const a: P = [o.a[0] + (o.b[0] - o.a[0]) * p, o.a[1] + (o.b[1] - o.a[1]) * p];
      const pts = jag(a, o.b, 3.5, 6, r);
      const w = Math.max(1, o.width * (1 - 0.6 * p));
      stroke(f, pts, w, Math.max(1, w - 1), colorAt, o.floor);
      // 끝 갈래: 꽂힌 자리에서 부채꼴로
      const nf = o.forks ?? 0;
      const dir = Math.atan2(o.b[1] - o.a[1], o.b[0] - o.a[0]);
      for (let k = 0; k < nf && p < 0.6; k++) {
        const ang = dir + (nf === 1 ? 0 : -0.9 + (1.8 * k) / (nf - 1)) + (r() - 0.5) * 0.3;
        const L = 8 + r() * 8;
        stroke(f, jag(o.b, [o.b[0] + Math.cos(ang) * L, Math.min(o.floor ?? Infinity, o.b[1] + Math.sin(ang) * L)], 2, 4, r), Math.max(1, w - 1), 1, colorAt, o.floor);
      }
    },
  };
}

