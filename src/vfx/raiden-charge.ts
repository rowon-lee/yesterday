// YESTERDAY: 라이덴 차지 투전승불 그림 (렌더 전용, 사용자 피드백 2026-11-02 9-1).
//   armor: 모으는 동안 전류가 몸 윤곽(실루엣 바로 바깥 한 줄)을 따라 흐른다. 단계마다 번지는 곳이 늘어난다:
//          1 두 팔 → 2 + 두 다리 → 3 + 몸통·머리 (흰 머리가 붉게 물듦) → 4 전신, 흰 심 + 붉은 테두리로 두꺼워지고 왼눈(역안)이 빛난다.
//          전류는 뼈대(어깨→손, 엉덩이→발, 엉덩이→목→머리)를 따라 끝쪽으로 흐르는 짧은 줄 (덩어리·오라로 몸을 덮지 않는다).
//          단계가 오르는 순간만 맥동(흰빛 2틱, 4단계는 크게 4틱)과 몸 밖으로 튀는 짧은 줄기 2~3개, 단계 사이는 조용하다.
//          2단계는 발밑에 작은 스파크 고리.
//   cone:  떼는 붕권의 원뿔 방전. 꼭짓점(주먹)에서 앞으로 퍼지는 꺾인 줄기 여러 개 (광선·레이저처럼 곧은 띠를 쓰지 않는다).
//          2틱 동안 꼭짓점에서 끝까지 뻗고, 방전, 꼭짓점 쪽부터 걷혀 8틱에 사라진다. 가지·바닥 긁는 스파크·첫 틱 섬광은 단계마다.
//   steam: 탈진하는 동안 어깨·등에서 오르는 김.
// 좌표는 모두 월드 px (다른 이펙트의 2단위가 아니다). 색은 부르는 쪽이 넘긴다 (흰 → 밝은 붉은 → 붉은 → 검붉은 → 아주 어두운).
import type { Frame, Layer } from './impact';

type P = readonly [number, number];

export interface Body {
  /** 지금 모습의 실루엣 (월드 px 자리, 칸 크기, RGBA 픽셀). 같은 그림이면 같은 배열 (경계 계산을 캐시한다) */
  sil: { x: number; y: number; w: number; h: number; data: Uint32Array };
  /** 관절 (월드 px) */
  j: { hip: P; neck: P; head: P; shF: P; eF: P; hF: P; shB: P; eB: P; hB: P; kF: P; fF: P; kB: P; fB: P };
  /** 머리 앞·위 단위 벡터 (월드): 눈 자리와 머리카락을 고른다 */
  front: P;
  up: P;
  /** 발밑 (월드 px) */
  feet: P;
}

export interface ArmorOptions {
  body: () => Body | null;
  /** 지금 단계 0~4 */
  stage: () => number;
  /** 살아 있는가 (거짓이면 FADE틱 동안 사그라든다) */
  alive: () => boolean;
  /** [흰, 밝은 붉은, 붉은, 검붉은, 아주 어두운] */
  ramp: readonly number[];
  /** 붉게 물든 머리 [밝은, 가운데, 어두운] */
  hair: readonly number[];
  /** 머리가 붉게 물드는 단계 (기본 3, 물들지 않으면 9) */
  hairStage?: number;
  /** 조용히: 단계가 올라도 맥동·몸 밖 줄기·발밑 고리 없이 윤곽 전류만 (화과산 들숨) */
  quiet?: boolean;
  seed?: number;
}

/** 경계 한 점: 실루엣 기준 자리, 몸 부위(1 팔 · 2 다리 · 3 몸통·머리), 뼈대 뿌리에서 잰 거리, 바깥 방향 */
interface Edge {
  r1: Int16Array;
  g1: Uint8Array;
  u1: Float32Array;
  n1: Float32Array;
  r2: Int16Array;
  g2: Uint8Array;
  r3: Int16Array;
  g3: Uint8Array;
  /** 머리카락: 자리, 밝기(0 밝음 ~ 2 어두움), 머리 위쪽으로 잰 높이 */
  hair: Int16Array;
  hairShade: Uint8Array;
  hairUp: Float32Array;
}

const edgeCache = new WeakMap<Uint32Array, Edge>();

/** 점 p에서 선분 a-b까지 거리와 a에서 잰 비율 */
function segDist(px: number, py: number, a: P, b: P): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return [Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t)), t];
}

function edgesOf(b: Body): Edge {
  const cached = edgeCache.get(b.sil.data);
  if (cached) return cached;
  const { w, h, data } = b.sil;
  const ox = b.sil.x;
  const oy = b.sil.y;
  const full = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x]! >>> 24 > 0;
  const ring1 = new Uint8Array(w * h);
  const r1: number[] = [];
  const r2: number[] = [];
  const r3: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (full(x, y)) continue;
      if (full(x - 1, y) || full(x + 1, y) || full(x, y - 1) || full(x, y + 1)) {
        ring1[y * w + x] = 1;
        r1.push(x, y);
      }
    }
  const in1 = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && ring1[y * w + x] === 1;
  const ring2 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (full(x, y) || ring1[y * w + x]) continue;
      if (in1(x - 1, y) || in1(x + 1, y) || in1(x, y - 1) || in1(x, y + 1)) {
        ring2[y * w + x] = 1;
        r2.push(x, y);
      }
    }
  const in2 = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && ring2[y * w + x] === 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (full(x, y) || ring1[y * w + x] || ring2[y * w + x]) continue;
      if (in2(x - 1, y) || in2(x + 1, y) || in2(x, y - 1) || in2(x, y + 1)) r3.push(x, y);
    }
  // 뼈대: [뿌리, 끝, 부위, 뿌리에서 잰 시작 거리, 길이]
  const j = b.j;
  const L = (a: P, c: P) => Math.hypot(c[0] - a[0], c[1] - a[1]);
  const bones: Array<[P, P, number, number, number]> = [];
  const chain = (pts: P[], g: number) => {
    let acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = L(pts[i]!, pts[i + 1]!);
      bones.push([pts[i]!, pts[i + 1]!, g, acc, l]);
      acc += l;
    }
  };
  chain([j.shF, j.eF, j.hF], 1);
  chain([j.shB, j.eB, j.hB], 1);
  chain([j.hip, j.kF, j.fF], 2);
  chain([j.hip, j.kB, j.fB], 2);
  chain([j.hip, j.neck, j.head], 3);
  const classify = (arr: number[], withU: boolean) => {
    const n = arr.length / 2;
    const g = new Uint8Array(n);
    const u = new Float32Array(withU ? n : 0);
    const nv = new Float32Array(withU ? n * 2 : 0);
    for (let i = 0; i < n; i++) {
      const px = arr[i * 2]! + ox;
      const py = arr[i * 2 + 1]! + oy;
      let best = 1e9;
      let bg = 3;
      let bu = 0;
      let qx = px;
      let qy = py;
      for (const [a, c, gg, acc, l] of bones) {
        const [d, t] = segDist(px, py, a, c);
        if (d < best) {
          best = d;
          bg = gg;
          bu = acc + t * l;
          qx = a[0] + (c[0] - a[0]) * t;
          qy = a[1] + (c[1] - a[1]) * t;
        }
      }
      // 머리 둘레 (머리 가운데에서 9px 안)는 몸통·머리
      if (Math.hypot(px - j.head[0], py - j.head[1]) <= 9 && bg !== 3) {
        bg = 3;
        bu = L(j.hip, j.neck) + L(j.neck, j.head) + Math.atan2(py - j.head[1], px - j.head[0]) * 3;
        qx = j.head[0];
        qy = j.head[1];
      }
      g[i] = bg;
      if (withU) {
        u[i] = bu;
        const d = Math.hypot(px - qx, py - qy) || 1;
        nv[i * 2] = (px - qx) / d;
        nv[i * 2 + 1] = (py - qy) / d;
      }
    }
    return { g, u, nv };
  };
  const c1 = classify(r1, true);
  const c2 = classify(r2, false);
  const c3 = classify(r3, false);
  // 머리카락: 머리 둘레의 흰·회색 픽셀 (셔츠 깃은 머리보다 아래라 빠진다)
  const hair: number[] = [];
  const shade: number[] = [];
  const ups: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x]!;
      if (c >>> 24 === 0) continue;
      const r = c & 255;
      const g = (c >>> 8) & 255;
      const bl = (c >>> 16) & 255;
      if (r < 150 || g < 150 || bl < 150 || Math.max(r, g, bl) - Math.min(r, g, bl) > 60) continue;
      const dx = x + ox - j.head[0];
      const dy = y + oy - j.head[1];
      if (Math.hypot(dx, dy) > 10.5) continue;
      const up = dx * b.up[0] + dy * b.up[1];
      if (up < -4) continue;
      const lum = (r + g + bl) / 3;
      hair.push(x, y);
      shade.push(lum >= 248 ? 0 : lum >= 215 ? 1 : 2);
      ups.push(up);
    }
  const e: Edge = {
    r1: Int16Array.from(r1), g1: c1.g, u1: c1.u, n1: c1.nv,
    r2: Int16Array.from(r2), g2: c2.g,
    r3: Int16Array.from(r3), g3: c3.g,
    hair: Int16Array.from(hair), hairShade: Uint8Array.from(shade), hairUp: Float32Array.from(ups),
  };
  edgeCache.set(b.sil.data, e);
  return e;
}

/** 칸 하나 칠하기 (월드 px) */
function put(f: Frame, x: number, y: number, c: number): void {
  x = Math.round(x - f.ox);
  y = Math.round(y - f.oy);
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
  const b = f.box;
  if (b) {
    if (x < b[0]!) b[0] = x;
    if (y < b[1]!) b[1] = y;
    if (x > b[2]!) b[2] = x;
    if (y > b[3]!) b[3] = y;
  }
  f.color[y * f.w + x] = c >>> 0;
}
/** 빛 더하기 (반지름 r px, 세기 k) */
function glow(f: Frame, x: number, y: number, r: number, c: number, k: number): void {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy) / (r + 0.5);
      if (d >= 1) continue;
      const xx = Math.round(x + dx - f.ox);
      const yy = Math.round(y + dy - f.oy);
      if (xx < 0 || yy < 0 || xx >= f.w || yy >= f.h) continue;
      const i = yy * f.w + xx;
      const q = k * (1 - d);
      const o = f.light[i]!;
      const rr = Math.min(255, (o & 255) + (c & 255) * q);
      const gg = Math.min(255, ((o >>> 8) & 255) + ((c >>> 8) & 255) * q);
      const bb = Math.min(255, ((o >>> 16) & 255) + ((c >>> 16) & 255) * q);
      f.light[i] = ((255 << 24) | (bb << 16) | (gg << 8) | rr) >>> 0;
    }
}
/** 꺾인 선 (1px) */
function line(f: Frame, a: P, b: P, c: number): void {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let s = 0; s <= n; s++) put(f, a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n, c);
}
const hash = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const TICK = 1 / 60;
const FADE = 6;

export function raidenChargeArmor(o: ArmorOptions) {
  const C = o.ramp;
  const H = o.hair;
  const seed = o.seed ?? 1;
  let t = 0;
  let dead = -1;
  let stage = 0;
  /** 단계가 오른 틱 (단계별) */
  const rose = [-99, -99, -99, -99, -99];
  /** 단계가 오를 때 몸 밖으로 튀는 짧은 줄기: [시작 틱, x, y, 방향x, 방향y, 길이] */
  const sparks: Array<[number, number, number, number, number, number]> = [];
  let ring: { at: number; x: number; y: number } | null = null;

  const tickNow = () => Math.floor(t / TICK + 1e-6);

  return {
    /** 지금 단계와 맥동 세기 (빛을 내는 쪽이 쓴다) */
    state() {
      const k = tickNow() - rose[stage]!;
      return { stage, pulse: stage > 0 && k < (stage === 4 ? 4 : 2), fade: dead < 0 ? 1 : Math.max(0, 1 - (tickNow() - dead) / FADE) };
    },
    update(dt: number) {
      t += dt;
      if (dead < 0 && !o.alive()) dead = tickNow();
      if (dead >= 0) return;
      const s = Math.max(0, Math.min(4, o.stage()));
      if (s > stage) {
        const now = tickNow();
        for (let k = stage + 1; k <= s; k++) rose[k] = now - (o.quiet ? 99 : 0);
        stage = s;
        if (o.quiet) return;
        // 몸 밖으로 짧은 줄기 2~3개 (새로 번진 부위의 경계에서 바깥쪽으로)
        const b = o.body();
        if (b) {
          const e = edgesOf(b);
          const n = e.r1.length / 2;
          const want = s === 4 ? 3 : 2;
          const cand: number[] = [];
          for (let i = 0; i < n; i++) if ((s === 4 || e.g1[i] === s) && e.r1[i * 2 + 1]! + b.sil.y < b.feet[1] - 6) cand.push(i);
          for (let k = 0; k < want && cand.length; k++) {
            const i = cand[Math.floor(hash(seed, now, k) * cand.length)]!;
            sparks.push([now, e.r1[i * 2]! + b.sil.x, e.r1[i * 2 + 1]! + b.sil.y, e.n1[i * 2]!, e.n1[i * 2 + 1]!, 6 + Math.floor(hash(seed, k, now) * 5)]);
          }
          if (s >= 2 && rose[2] === now) ring = { at: now, x: b.feet[0], y: b.feet[1] };
        }
      }
    },
    done() {
      return dead >= 0 && tickNow() - dead >= FADE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const now = tickNow();
      const fade = dead < 0 ? 1 : Math.max(0, 1 - (now - dead) / FADE);
      const b = o.body();
      if (b && stage > 0 && fade > 0) {
        const e = edgesOf(b);
        const ox = b.sil.x;
        const oy = b.sil.y;
        const since = now - rose[stage]!;
        const big = stage === 4;
        const pulse = since < (big ? 4 : 2);
        const phase = Math.floor(now / 2) * 2;
        // 경계 한 줄: 뼈대를 따라 끝쪽으로 흐르는 짧은 줄 (4단계는 촘촘하게, 흰 심)
        const per = big ? 5 : 7;
        const on = big ? 4 : 4;
        const n1 = e.r1.length / 2;
        for (let i = 0; i < n1; i++) {
          const g = e.g1[i]!;
          if (!big && g > stage) continue;
          const x = e.r1[i * 2]! + ox;
          const y = e.r1[i * 2 + 1]! + oy;
          // 새로 번진 부위만 맥동 (4단계는 전신)
          const fresh = pulse && (big || g === stage);
          if (fresh) {
            put(f, x, y, C[0]!);
            if ((i & 3) === 0) glow(f, x, y, 2, C[1]!, 0.35);
            continue;
          }
          const m = (((Math.floor(e.u1[i]!) - phase) % per) + per) % per;
          if (m >= on) continue;
          if (hash(i, Math.floor(now / 2), seed) < 0.12 + (1 - fade) * 0.8) continue;
          put(f, x, y, big ? C[0]! : m === on - 1 ? C[1]! : C[2]!);
          if (m === on - 1 && (i & 1) === 0) glow(f, x, y, 1, C[2]!, 0.25);
        }
        // 4단계: 붉은 테두리로 두꺼워진다 (맥동 동안은 한 겹 더 하얗게)
        if (big) {
          const n2 = e.r2.length / 2;
          for (let i = 0; i < n2; i++) {
            if (hash(i, Math.floor(now / 2), seed + 7) < 0.18 + (1 - fade) * 0.8) continue;
            put(f, e.r2[i * 2]! + ox, e.r2[i * 2 + 1]! + oy, pulse ? C[0]! : C[2]!);
          }
          if (pulse) {
            const n3 = e.r3.length / 2;
            for (let i = 0; i < n3; i++) if ((i + now) % 2 === 0) put(f, e.r3[i * 2]! + ox, e.r3[i * 2 + 1]! + oy, since < 2 ? C[1]! : C[2]!);
          }
        } else if (stage >= 1) {
          // 꺾인 느낌: 가끔 한 칸 바깥이 튄다
          const n2 = e.r2.length / 2;
          for (let i = 0; i < n2; i++) {
            const g = e.g2[i]!;
            if (g > stage) continue;
            if (hash(i, Math.floor(now / 2), seed + 3) > 0.06 * fade) continue;
            put(f, e.r2[i * 2]! + ox, e.r2[i * 2 + 1]! + oy, C[3]!);
          }
        }
        // 3단계부터 흰 머리가 붉게 물든다 (뿌리에서 끝으로 6틱)
        if (stage >= (o.hairStage ?? 3)) {
          const k = Math.min(1, (now - rose[3]! + 1) / 6);
          const top = -4 + k * 18;
          const nh = e.hair.length / 2;
          for (let i = 0; i < nh; i++) {
            if (e.hairUp[i]! > top) continue;
            put(f, e.hair[i * 2]! + ox, e.hair[i * 2 + 1]! + oy, H[e.hairShade[i]!]!);
          }
        }
        // 4단계: 왼눈(역안)이 빛난다 (눈은 그리지 않고 그 자리에 작은 빛만)
        if (big && fade > 0.5) {
          const ex = b.j.head[0] + b.front[0] * 2.5 - b.up[0] * 0.5;
          const ey = b.j.head[1] + b.front[1] * 2.5 - b.up[1] * 0.5;
          put(f, ex, ey, now % 6 === 0 ? C[1]! : C[0]!);
          glow(f, ex, ey, 3, C[1]!, 0.6);
        }
      }
      // 몸 밖으로 튀는 짧은 줄기 (3틱)
      for (const [at, x, y, nx, ny, len] of sparks) {
        const k = now - at;
        if (k < 0 || k > 3) continue;
        let px = x;
        let py = y;
        const col = k < 1 ? C[0]! : k < 2 ? C[1]! : C[2]!;
        for (let s = 1; s <= 3; s++) {
          const j = (hash(at, s, Math.floor(x)) - 0.5) * 3;
          const qx = x + (nx * len * s) / 3 - ny * j;
          const qy = y + (ny * len * s) / 3 + nx * j;
          line(f, [Math.round(px), Math.round(py)], [Math.round(qx), Math.round(qy)], col);
          px = qx;
          py = qy;
        }
      }
      // 2단계: 발밑 작은 스파크 고리 (6틱 동안 조금 넓어지며 사그라든다)
      if (ring) {
        const k = now - ring.at;
        if (k >= 0 && k < 6) {
          const rx = 9 + k;
          const ry = 2 + k * 0.3;
          const col = k < 2 ? C[0]! : k < 4 ? C[1]! : C[2]!;
          for (let a = 0; a < 24; a++) {
            if ((a + k) % 3 === 0) continue;
            const an = (a / 24) * Math.PI * 2;
            put(f, ring.x + Math.cos(an) * rx, ring.y - 1 + Math.sin(an) * ry, col);
          }
        }
      }
    },
  };
}

export interface ConeOptions {
  /** 꼭짓점 (월드 px) */
  x: number;
  y: number;
  dir: number;
  /** 원뿔 길이, 끝 높이 (px) */
  length: number;
  height: number;
  /** 줄기 수, 가지 수 */
  bolts: number;
  branches?: number;
  /** 바닥 긁는 스파크 (바닥 높이, 월드 px) */
  floor?: number;
  /** 첫 틱 섬광 (원뿔 안을 흰 점으로 채운다) */
  flash?: boolean;
  /** 가운데 줄기를 2px로 */
  thick?: boolean;
  /** 축을 따라 흰 심 (라이덴 파천 등 뒤 원뿔) */
  core?: boolean;
  /** 전체 길이 (틱, 기본 8) */
  ticks?: number;
  ramp: readonly number[];
  seed?: number;
}

export function raidenChargeCone(o: ConeOptions) {
  const C = o.ramp;
  const LIFE = o.ticks ?? 8;
  const seed = o.seed ?? 1;
  const half = Math.atan2(o.height / 2, o.length);
  let t = 0;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  /** 틱마다 새로 꺾는다: 줄기 = 점들 (꼭짓점 → 끝) */
  const shape = (k: number) => {
    const bolts: Array<Array<[number, number, number]>> = [];
    for (let b = 0; b < o.bolts; b++) {
      const a = -half + (2 * half * (b + 0.5)) / o.bolts + (hash(seed, k, b) - 0.5) * ((2 * half) / o.bolts) * 0.7;
      const len = o.length * (0.78 + 0.22 * hash(seed + 1, k, b)) / Math.cos(a);
      const steps = Math.max(3, Math.round(len / 4));
      const pts: Array<[number, number, number]> = [];
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const j = s === 0 ? 0 : (hash(seed + 2, k * 31 + b, s) - 0.5) * 3.2;
        const lx = Math.cos(a) * len * u - Math.sin(a) * j;
        const ly = Math.sin(a) * len * u + Math.cos(a) * j;
        pts.push([o.x + o.dir * lx, o.y + ly, u]);
      }
      bolts.push(pts);
    }
    const twigs: Array<[P, P, P]> = [];
    for (let i = 0; i < (o.branches ?? 0); i++) {
      const bolt = bolts[Math.floor(hash(seed + 3, k, i) * bolts.length)]!;
      const at = bolt[Math.floor((0.4 + 0.4 * hash(seed + 4, k, i)) * (bolt.length - 1))]!;
      const side = i % 2 === 0 ? -1 : 1;
      const a = side * (0.5 + 0.4 * hash(seed + 5, k, i));
      const l = 4 + 4 * hash(seed + 6, k, i);
      const m: P = [at[0] + o.dir * Math.cos(a) * l * 0.5, at[1] + Math.sin(a) * l * 0.5 + (hash(seed, i, k) - 0.5) * 2];
      const e: P = [at[0] + o.dir * Math.cos(a) * l, at[1] + Math.sin(a) * l];
      twigs.push([[at[0], at[1]], m, e]);
    }
    return { bolts, twigs };
  };
  return {
    /** 빛을 내는 쪽: 밝기 0~1과 원뿔 가운데 */
    phase() {
      const k = tickNow();
      return { k: k >= LIFE ? 0 : k < 2 ? 1 : 1 - (k - 1) / (LIFE - 1), x: o.x + o.dir * o.length * 0.5, y: o.y };
    },
    update(dt: number) {
      t += dt;
    },
    done() {
      return tickNow() >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'front') return;
      const k = tickNow();
      if (k >= LIFE) return;
      // 첫 틱 섬광: 원뿔 안을 흰 점으로 (4단계)
      if (o.flash && k === 0) {
        for (let lx = 0; lx <= o.length; lx++) {
          const hh = Math.tan(half) * lx;
          for (let ly = -Math.floor(hh); ly <= hh; ly++) if (((lx + ly) & 1) === 0) put(f, o.x + o.dir * lx, o.y + ly, C[0]!);
        }
        glow(f, o.x + o.dir * o.length * 0.5, o.y, Math.min(12, Math.round(o.height / 2)), C[1]!, 0.8);
      }
      const sh = shape(k);
      // 뻗기(0~1틱) → 방전(2~4틱) → 꼭짓점 쪽부터 걷힘(5틱~)
      const lead = Math.min(1, (k + 1) / 2);
      const tail = k < 5 ? 0 : (k - 4) / (LIFE - 4);
      const col = k < 2 ? C[0]! : k < 5 ? C[1]! : k < 6 ? C[2]! : C[3]!;
      sh.bolts.forEach((pts, bi) => {
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i]!;
          const b = pts[i + 1]!;
          if (a[2] > lead || b[2] < tail) continue;
          // 방전 동안 앞끝 두 마디는 흰 심
          const c = k >= 2 && k < 5 && b[2] > 0.8 ? C[0]! : col;
          line(f, [Math.round(a[0]), Math.round(a[1])], [Math.round(b[0]), Math.round(b[1])], c);
          if (o.thick && bi === Math.floor(sh.bolts.length / 2)) line(f, [Math.round(a[0]), Math.round(a[1]) + 1], [Math.round(b[0]), Math.round(b[1]) + 1], k < 5 ? C[1]! : C[3]!);
          if (k < 5 && i % 2 === 0) glow(f, b[0], b[1], 2, C[2]!, 0.3);
        }
      });
      // 흰 심: 축을 따라 꺾인 흰 줄 (밝은 붉은 테두리), 끝 4틱에는 걷힌다
      if (o.core && k < LIFE - 4) {
        let prev: P = [Math.round(o.x), Math.round(o.y)];
        const n = Math.max(3, Math.round((o.length * lead) / 5));
        for (let s = 1; s <= n; s++) {
          const u = s / n;
          if (u * lead < tail) {
            prev = [Math.round(o.x + o.dir * o.length * lead * u), Math.round(o.y)];
            continue;
          }
          const q: P = [Math.round(o.x + o.dir * o.length * lead * u), Math.round(o.y + (hash(seed + 12, k, s) - 0.5) * 3)];
          line(f, [prev[0], prev[1] - 1], [q[0], q[1] - 1], C[1]!);
          line(f, [prev[0], prev[1] + 1], [q[0], q[1] + 1], C[1]!);
          line(f, prev, q, C[0]!);
          prev = q;
        }
      }
      if (k >= 1 && k < 6) for (const [a, m, e] of sh.twigs) {
        const c = k < 3 ? C[1]! : C[2]!;
        line(f, [Math.round(a[0]), Math.round(a[1])], [Math.round(m[0]), Math.round(m[1])], c);
        line(f, [Math.round(m[0]), Math.round(m[1])], [Math.round(e[0]), Math.round(e[1])], c);
      }
      // 바닥을 긁는 스파크 (3단계부터): 원뿔 아래 바닥을 따라 꺾인 줄과 튀는 점
      if (o.floor !== undefined && k >= 1 && k < 6) {
        const y0 = o.floor - 1;
        const x0 = o.x + o.dir * o.length * 0.15;
        const n = Math.round(o.length * 0.8 * Math.min(1, k / 2));
        let py = y0;
        for (let s = 0; s <= n; s += 2) {
          const ny = y0 - Math.floor(hash(seed + 9, k, s) * 2);
          line(f, [Math.round(x0 + o.dir * s), py], [Math.round(x0 + o.dir * (s + 2)), ny], k < 3 ? C[1]! : C[2]!);
          py = ny;
        }
        for (let s = 0; s < 4; s++) {
          const sx = x0 + o.dir * (hash(seed + 10, s, 0) * n);
          put(f, sx + o.dir * k, y0 - 1 - Math.floor(hash(seed + 11, s, k) * 3) - Math.min(3, k), k < 3 ? C[0]! : C[2]!);
        }
      }
    },
  };
}

/** 탈진 김: 어깨·등에서 오르며 흩어진다 (24틱) */
export function raidenSteam(o: { x: number; y: number; drift: number; ramp: readonly number[]; seed?: number }) {
  const seed = o.seed ?? 1;
  const LIFE = 24;
  let t = 0;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return tickNow() >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const k = tickNow();
      if (k >= LIFE) return;
      const u = k / LIFE;
      const col = u < 0.35 ? o.ramp[0]! : u < 0.7 ? o.ramp[1]! : o.ramp[2]!;
      // 가는 김 한 줄기: 아래에서 위로 이어진 점 6개가 흔들리며 오르고, 위쪽부터 흩어진다
      for (let p = 0; p < 6; p++) {
        if (u > 0.55 && (p + k) % 3 === 0) continue;
        if (p >= 6 - Math.floor(u * 4)) continue;
        const x = o.x + o.drift * k * 0.25 + (hash(seed, p, 0) - 0.5) * 3 + Math.sin((k + p * 4) * 0.35) * 1.5;
        const y = o.y - k * (0.5 + 0.12 * hash(seed, p, 1)) - p * 1.5;
        put(f, x, y, col);
        if (u < 0.45 && p < 3) put(f, x + 1, y, col);
      }
    },
  };
}

/**
 * 화과산 전격 저주 (사용자 피드백 2026-11-02 9-3): 저주받은 동안 머리 위 작은 표식(검붉은 번개 모양)이 떠 있고,
 * 2.5초마다(처음은 밀려난 뒤) 몸 윤곽을 따라 검붉은 금 간 전류가 8틱 동안 찌릿 지나간다. 저주가 끝나면 함께 사라진다
 */
export function raidenCurse(o: { body: () => Body | null; left: () => number; ramp: readonly number[]; seed?: number }) {
  const C = o.ramp;
  const seed = o.seed ?? 1;
  let t = 0;
  let gone = false;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  // 표식: 5×7 번개 (X 바탕, o 밝은 점)
  const MARK = ['..XX.', '.XX..', 'XXoX.', '..XX.', '.XX..', '.X...', 'X....'];
  return {
    /** 지금 찌릿하는 중인가 (빛) */
    zapping() {
      const k = tickNow();
      return !gone && k >= 24 && (k - 24) % 150 < 8;
    },
    update(dt: number) {
      t += dt;
      if (o.left() <= 0) gone = true;
    },
    done() {
      return gone;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back' || gone) return;
      const b = o.body();
      if (!b) return;
      const k = tickNow();
      // 머리 위 표식 (20틱마다 1px 오르내림, 남은 1초부터 깜빡임)
      const bob = Math.floor(k / 20) % 2;
      const mx = Math.round(b.j.head[0] - 2);
      const my = Math.round(b.j.head[1] - 17 - bob);
      if (!(o.left() < 60 && k % 4 >= 2)) {
        MARK.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === '.') continue;
            put(f, mx + x, my + y, ch === 'o' ? C[2]! : y < 3 ? C[3]! : C[4]!);
          }
        });
      }
      // 찌릿: 몸 윤곽 바로 바깥을 따라 짧게 금 간 검붉은 전류 (가끔 바깥으로 1~3px 갈라진다)
      if (k >= 24 && (k - 24) % 150 < 8) {
        const z = (k - 24) % 150;
        const e = edgesOf(b);
        const n = e.r1.length / 2;
        for (let i = 0; i < n; i++) {
          const m = (Math.floor(e.u1[i]!) * 7 + i + z * 5) % 11;
          if (m > 2) continue;
          if (hash(i, z >> 1, seed) < 0.3) continue;
          const x = e.r1[i * 2]! + b.sil.x;
          const y = e.r1[i * 2 + 1]! + b.sil.y;
          put(f, x, y, z < 1 ? C[1]! : m === 0 ? C[2]! : C[3]!);
          if (m === 0 && hash(i, z, seed + 1) < 0.25) {
            const nx = e.n1[i * 2]!;
            const ny = e.n1[i * 2 + 1]!;
            const l = 1 + Math.floor(hash(i, z, seed + 2) * 3);
            for (let q = 1; q <= l; q++) put(f, x + Math.round(nx * q + (q === 2 ? ny : 0)), y + Math.round(ny * q - (q === 2 ? nx : 0)), C[4]!);
          }
        }
      }
    },
  };
}
