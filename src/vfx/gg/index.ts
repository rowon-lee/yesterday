// YESTERDAY 길티기어식 이펙트 (동작연출지침서 14-8 모양, 14-2 시간, 렌더 전용).
// 공격 하나의 모양 숫자(data/vfx)를 받아 큰 모양 몇 개로 그린다:
//   빛 쐐기·빛기둥·스우시 (셀 3단) · 잉크 쐐기 · 굵은 번개 (어두운 테두리) · 큰 원 고리 · 방사 가시 · 섬광 · 불씨 · 연기.
// 시간 (14-2, 2026-11-04 고침): 시계가 둘이다.
//   진행 t: 히트스톱(held) 동안 멈춘다. 머묾(hold)·흩어짐(fade)을 센다.
//   살아 있는 L: 언제나 흐른다. 펼쳐짐(0~2틱)·살아 있는 정지(다시 꺾임·맥동·자람)·불씨·연기를 움직인다 (세상은 멈춰도 이펙트는 산다).
// 난수는 불씨·연기·나비·꽃잎 자리·속도에만 쓴다 (같은 시드면 같은 그림).
// 14-9 기법 중 모양 시간에 거는 것: B 지연 폭발 (wait: 살아 있는 시계로 늦게 나타남), I 시간 엇갈림 (grow), L 색 뒤집기 (flip), N 맥동 (pulse).
import type { GChunks, GEmbers, GFlutter, GPt, GShape, GSmoke, GTone } from '../../data/vfx/types';
import { fillRings, put, rng, type GFrame, type Layer } from './raster';
import { bolt, butterfly, clipHalf, flash, hash, ink, petal, quake, rays, ribbon, ring, stitch, surge, swoosh, wedge, type Paint, type Phase } from './shapes';

export type { GFrame, Layer };

export interface GGSpec {
  shapes: readonly GShape[];
  /** 색표: 색 단계 0 심 · 1 주색 · 2 진한 주색 · 3 잉크 · 4 고리 → 색 (0xAABBGGRR, render/vfx fxColor) */
  ramp: readonly number[];
  /** 모양 좌표 (0, 0)의 월드 px (공격자 발밑이나 맞은 점)와 보는 쪽 */
  origin: GPt;
  facing: number;
  /** 참이면 진행 시계를 멈춘다 (히트스톱 동안 살아 있는 정지) */
  held?: () => boolean;
  seed: number;
  /** 바닥 월드 y (불씨가 튀는 곳). 없으면 원점 높이 */
  floor?: number;
  /** 14-9 L 색 뒤집기: 살아 있는 틱 at부터 ticks틱 동안 이 색표로 그린다 */
  flip?: { at: number; ticks: number; ramp: readonly number[] };
  /** 모양 좌표 (0, 0)를 틱마다 다시 읽는다 (밀려가는 장막 벽처럼 움직이는 것을 따라간다). 바닥 높이는 그대로 */
  follow?: () => GPt;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  tone: GTone;
}

/** 나비·꽃잎 한 장 */
interface Leaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
  fly: boolean;
  spin: number;
  phase: number;
}

/** 바닥 덩어리 파편 하나 (에드워드): 꼭짓점 다섯 (반지름 비·각), 처음 자리·속도, 돌기 */
interface Chunk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
  rot: number;
  spin: number;
  shape: number[];
  /** 바닥에서 들려 올라오는 덩어리 (처음 3틱 동안 바닥에서 자란다) */
  lift?: boolean;
}

interface Puff {
  x: number;
  y: number;
  /** 굴러가는 흙먼지: 처음 옆 빠르기 (px/틱) */
  vx?: number;
  rise: number;
  sway: number;
  r: number;
  life: number;
  born: number;
}

const EMBER_TONES: readonly GTone[] = [0, 1, 4, 1, 0, 2];
/** 불씨 중력 (px/틱²): 떨어져 바닥에서 튄다 */
const GRAVITY = 0.07;

/** 나타난 뒤 진행 시계로 재는 끝 (불씨·연기·나비·바늘땀은 살아 있는 시계로 따로) */
function spanOf(s: GShape): number {
  return (s.hold ?? 0) + (s.pulse ? 3 : 0) + (s.fade ?? 6);
}
/** 살아 있는 시계로 사는 모양 */
const liveKind = (s: GShape) => s.kind === 'embers' || s.kind === 'smoke' || s.kind === 'flutter' || s.kind === 'stitch' || s.kind === 'chunks';
/** 살아 있는 시계로 사는 모양의 끝 (나타난 뒤 틱) */
function liveEnd(s: GShape): number {
  if (s.kind === 'flutter') return (s.n - 1) * (s.every ?? 1) + s.life + 2;
  if (s.kind === 'stitch') return s.sew + s.life + 14;
  if (s.kind === 'embers' || s.kind === 'smoke') return s.life + 2;
  if (s.kind === 'chunks') return (s.lift ? Math.ceil(s.spread / s.lift) + 1 : (s.n - 1) * (s.every ?? 0)) + s.life + 2;
  return 0;
}

export default function ggEffect(o: GGSpec) {
  const fc = o.facing >= 0 ? 1 : -1;
  let OX = Math.round(o.origin[0]);
  let OY = Math.round(o.origin[1]);
  const floorW = o.floor ?? o.origin[1];
  let floorY = floorW - OY;
  let t = 0;
  let L = 0;
  const born = new Map<GShape, number>();
  const spread = new Map<GShape, number>();
  const embers = new Map<GEmbers, Ember[]>();
  const puffs = new Map<GSmoke, Puff[]>();
  const leafs = new Map<GFlutter, Leaf[]>();
  const rocks = new Map<GChunks, Chunk[]>();
  /** wait 모양이 나타난 순간의 진행 시계 */
  const tAt = new Map<GShape, number>();
  /** 나타난 뒤 진행 시계로 잰 틱 (아직이면 −1) */
  const sinceT = (s: GShape): number => {
    if (s.wait !== undefined) {
      if (L < s.wait) return -1;
      if (!tAt.has(s)) tAt.set(s, t);
      return t - tAt.get(s)!;
    }
    return t - (s.delay ?? 0);
  };
  const seedOf = (s: GShape) => (o.seed * 7919 + o.shapes.indexOf(s) * 104729 + 17) | 0;
  const sparks = (s: GEmbers): Ember[] => {
    let list = embers.get(s);
    if (!list) {
      const r = rng(seedOf(s));
      list = [];
      const at = s.at ?? [0, 0];
      for (let i = 0; i < s.n; i++) {
        const a = ((s.dir + (r() - 0.5) * s.fan) * Math.PI) / 180;
        const d = s.spread * Math.sqrt(r());
        const da = r() * Math.PI * 2;
        const v = s.speed * (0.35 + 0.65 * r());
        list.push({
          x: at[0] + Math.cos(da) * d,
          y: at[1] + Math.sin(da) * d * 0.7,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: Math.round(s.life * (0.55 + 0.45 * r())),
          size: r() < 0.3 ? 2 : 1,
          tone: s.tones?.length ? s.tones[i % s.tones.length]! : EMBER_TONES[i % EMBER_TONES.length]!,
        });
      }
      embers.set(s, list);
    }
    return list;
  };
  const smoke = (s: GSmoke): Puff[] => {
    let list = puffs.get(s);
    if (!list) {
      const r = rng(seedOf(s) + 5);
      list = [];
      const at = s.at ?? [0, 0];
      for (let i = 0; i < s.n; i++) {
        const q: Puff = {
          x: at[0] + (r() - 0.5) * 2 * s.spread,
          y: at[1] + (r() - 0.5) * s.spread,
          rise: s.rise * (0.7 + 0.6 * r()),
          sway: (r() - 0.5) * 0.5,
          r: s.size * (0.65 + 0.35 * r()),
          life: Math.round(s.life * (0.7 + 0.3 * r())),
          born: Math.round(r() * Math.min(8, s.life * 0.3)),
        };
        // 굴러가는 흙먼지: 양쪽으로 번갈아 바닥을 따라 바깥으로 구른다 (가까운 것은 느리게)
        if (s.roll !== undefined) {
          q.vx = (i % 2 ? -1 : 1) * s.roll * (0.35 + 0.65 * r());
          q.y = at[1] - r() * 3;
        }
        list.push(q);
      }
      puffs.set(s, list);
    }
    return list;
  };
  /** 모양의 지금 시간: 시작 전이면 null */
  const phaseOf = (s: GShape): Phase | null => {
    const ts = sinceT(s);
    if (ts < 0) return null;
    if (!born.has(s)) born.set(s, L);
    const ls = L - born.get(s)!;
    const hold = s.hold ?? 0;
    let ex = ts - hold;
    let a = ls < 1 ? 1 / 3 : ls < 2 ? 0.75 : 1;
    // 14-9 N 맥동: 흩어지기 직전 3틱 동안 한 번 더 부풀었다가 흩어진다
    if (s.pulse && ex > 0) {
      if (ex < 3) {
        a *= 1 + 0.16 * Math.sin((Math.PI * ex) / 3);
        ex = 0;
      } else ex -= 3;
    }
    // 오래 머무는 모양 (탄 자국): 두께가 천천히 숨쉰다 (같은 그림으로 멈추지 않게)
    if (s.breathe) a *= 1 + s.breathe * Math.sin(ls * 0.7);
    const p = ex <= 0 ? 0 : Math.min(1, ex / Math.max(1, s.fade ?? 6));
    if (p > 0 && !spread.has(s)) spread.set(s, ls);
    const g = s.grow ?? 1;
    const creep = Math.max(0, (spread.get(s) ?? ls) - 2) * g;
    return { a, ls: Math.floor(ls + 1e-6), creep: Math.floor(creep + 1e-6), p, seed: seedOf(s), g };
  };
  const toWorld = (r: number[]): number[] => r.map((v, i) => (i & 1 ? OY + v : OX + fc * v));
  /** 지금 색표 (14-9 L: 뒤집는 틱 동안은 다른 색표) */
  const rampNow = () => (o.flip && L >= o.flip.at && L < o.flip.at + o.flip.ticks ? o.flip.ramp : o.ramp);
  const paint = (f: GFrame, list: Paint[]) => {
    const ramp = rampNow();
    for (const p of list) {
      const c = ramp[p.tone] ?? ramp[0]!;
      if (p.sep) for (const r of p.rings) fillRings(f, [toWorld(r)], c);
      else fillRings(f, p.rings.map(toWorld), c);
    }
  };
  /** 불씨 (14-2 잔향): 히트스톱 동안도 날고, 중력으로 떨어져 바닥에서 두 번 튄 뒤 깜빡이며 꺼진다. 식으며 색이 어두워진다 */
  const drawEmbers = (f: GFrame, s: GEmbers, ls: number) => {
    sparks(s).forEach((e, i) => {
      if (ls >= e.life) return;
      let x = e.x;
      let y = e.y;
      let vx = e.vx;
      let vy = e.vy;
      let tt = ls;
      let bounces = 0;
      let rest = -1;
      // 바닥에 닿을 때마다 위로 튄다 (해석적으로: 포물선 → 닿는 시각 → 반사)
      for (let guard = 0; guard < 4 && tt > 0; guard++) {
        const disc = vy * vy + 2 * GRAVITY * (floorY - y);
        const hit = y <= floorY && disc >= 0 ? (-vy + Math.sqrt(disc)) / GRAVITY : Infinity;
        if (hit > tt) {
          x += vx * tt;
          y += vy * tt + 0.5 * GRAVITY * tt * tt;
          tt = 0;
          break;
        }
        x += vx * hit;
        y = floorY;
        tt -= hit;
        bounces++;
        if (bounces >= 3) {
          rest = ls - tt;
          tt = 0;
          break;
        }
        vy = -(vy + GRAVITY * hit) * 0.38;
        vx *= 0.6;
      }
      // 바닥에 누운 불씨는 2틱마다 깜빡인다 (같은 그림으로 멈추지 않게)
      if (rest >= 0 && (Math.floor(ls) + i) % 2) return;
      const age = ls / Math.max(1, e.life);
      const tone: GTone = age < 0.35 ? e.tone : age < 0.7 ? (e.tone === 0 ? 1 : 2) : age < 0.88 ? 2 : 3;
      const c = o.ramp[tone]!;
      const X = OX + fc * x;
      const Y = OY + y;
      put(f, X, Y, c);
      if (e.size > 1 && age < 0.6) {
        put(f, X + fc, Y, c);
        put(f, X, Y - 1, c);
        put(f, X + fc, Y - 1, c);
      }
    });
  };
  /** 연기·열기 (14-2 잔향): 단단한 경계의 작은 덩어리가 오르며 커졌다 작아진다. 처음 1/4은 진한 주색(열기), 그 뒤 잉크색 */
  const drawSmoke = (f: GFrame, s: GSmoke, ls: number) => {
    smoke(s).forEach((q, i) => {
      const age = ls - q.born;
      if (age < 0 || age >= q.life) return;
      const u = age / q.life;
      // 굴러가는 흙먼지는 빨리 부풀어 오래 머물다 끝에 줄어든다 (바닥에 낮게 깔려 납작하다)
      const rolling = q.vx !== undefined;
      const rad = rolling ? q.r * Math.min(1, u / 0.16, (1 - u) / 0.3) + 0.6 : q.r * Math.sin(Math.PI * Math.min(1, u * 1.15)) + 0.6;
      if (rad < 1.2) return;
      const cx = rolling ? q.x + (q.vx! * (1 - Math.exp(-0.05 * age))) / 0.05 + Math.sin(age * 0.21 + i) * 1.2 : q.x + q.sway * age + Math.sin(age * 0.35 + i) * 1.2;
      const cy = rolling ? q.y - q.rise * age - rad * 0.55 : q.y - q.rise * age;
      const ringPts: number[] = [];
      const nv = 7;
      for (let v = 0; v < nv; v++) {
        const a = (v / nv) * Math.PI * 2 + i;
        // 틱마다 꼭짓점이 조금씩 흔들린다 (살아 있는 연기)
        const rr = rad * (0.82 + 0.3 * hash(i * 31 + v, Math.floor(ls), 77));
        ringPts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * (rolling ? 0.62 : 0.85));
      }
      const [t0, t1] = s.tones ?? [2, 3];
      const tone: GTone = u < 0.25 ? t0 : t1;
      fillRings(f, [toWorld(ringPts)], o.ramp[tone] ?? o.ramp[0]!);
    });
  };
  const leavesOf = (s: GFlutter): Leaf[] => {
    let list = leafs.get(s);
    if (!list) {
      const r = rng(seedOf(s) + 9);
      list = [];
      const F = s.from.length ? s.from : [[0, 0] as GPt];
      for (let i = 0; i < s.n; i++) {
        // 자리: 점들을 따라 차례로 (꼬리부터 떨어져 나온다)
        const k = s.n > 1 ? (i / (s.n - 1)) * (F.length - 1) : 0;
        const j = Math.min(F.length - 2, Math.floor(k));
        const tt = F.length > 1 ? k - j : 0;
        const A = F[Math.max(0, j)]!;
        const B = F[Math.min(F.length - 1, j + 1)]!;
        const a = ((s.dir + (r() - 0.5) * s.fan) * Math.PI) / 180;
        const v = s.speed * (0.5 + 0.5 * r());
        list.push({
          x: A[0] + (B[0] - A[0]) * tt + (r() - 0.5) * 4,
          y: A[1] + (B[1] - A[1]) * tt + (r() - 0.5) * 4,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          born: i * (s.every ?? 1),
          life: Math.round(s.life * (0.7 + 0.3 * r())),
          size: s.size * (0.75 + 0.5 * r()),
          fly: r() < (s.fly ?? 0),
          spin: (r() - 0.5) * 0.35,
          phase: r() * Math.PI * 2,
        });
      }
      leafs.set(s, list);
    }
    return list;
  };
  /**
   * 나비·꽃잎 (14-4): 떨어져 나와 흘러가다 느려지고 (끌림), 떠오르며 하늘거린다. 나비는 2틱마다 날갯짓, 꽃잎은 돈다.
   * 식으며 심 → 주색 → 진한 주색, 마지막 30%에 작아진다. 2.6px보다 작아지면 그리지 않는다 (1px 점·선이 남지 않게)
   */
  const drawFlutter = (f: GFrame, s: GFlutter, ls: number) => {
    const lift = s.lift ?? 0.12;
    const zoom = s.zoom ?? 0;
    const ramp = rampNow();
    leavesOf(s).forEach((q, i) => {
      const age = ls - q.born;
      if (age < 0 || age >= q.life) return;
      const u = age / q.life;
      const drag = (1 - Math.exp(-age * 0.07)) / 0.07;
      const x = q.x + q.vx * drag + Math.sin(age * 0.33 + q.phase) * 1.6;
      const y = q.y + q.vy * drag - lift * age + Math.cos(age * 0.27 + q.phase) * 1.1;
      const shrink = u < 0.7 ? 1 : 1 - ((u - 0.7) / 0.3) * 0.65;
      const size = q.size * (1 + zoom * age) * shrink;
      if (size < 2.6) return;
      const base = s.tone ?? 0;
      const tone: GTone = u < 0.35 ? base : u < 0.7 ? (base === 0 ? 1 : base) : 2;
      if (q.fly) {
        const flap = (Math.floor(age / 2) + i) % 2 ? 1 : 0.4;
        const ang = Math.atan2(q.vy * Math.exp(-age * 0.07) - lift, q.vx * Math.exp(-age * 0.07) + 0.001) + Math.sin(age * 0.2 + q.phase) * 0.35;
        const wings = butterfly(x, y, ang, size, flap);
        fillRings(f, wings.map(toWorld), ramp[tone] ?? ramp[0]!);
        // 몸 (진한 단계 2px)
        const bx = OX + fc * x;
        const by = OY + y;
        put(f, bx, by, ramp[2]!);
        put(f, bx + fc * Math.round(Math.cos(ang)), by + Math.round(Math.sin(ang)), ramp[2]!);
      } else {
        const ring = petal(x, y, q.phase + q.spin * age, size, size * 0.5);
        fillRings(f, [toWorld(ring)], ramp[tone] ?? ramp[0]!);
      }
    });
  };
  const chunksOf = (s: GChunks): Chunk[] => {
    let list = rocks.get(s);
    if (!list) {
      const r = rng(seedOf(s) + 13);
      list = [];
      const at = s.at ?? [0, 0];
      const side = s.sides ?? 0;
      const perSide = side === 0 ? Math.ceil(s.n / 2) : s.n;
      for (let i = 0; i < s.n; i++) {
        const shape: number[] = [];
        if (s.lift) {
          // 바닥 줄 위에 고르게: 가운데에서 가까운 차례로 솟는다 (물마루가 지나가는 틱), 바깥으로 조금 기울어 오른다
          const sg = side === 0 ? (i % 2 ? -1 : 1) : side;
          const dist = (s.spread * (Math.floor(side === 0 ? i / 2 : i) + 0.3 + 0.5 * r())) / perSide;
          const a = ((s.dir + sg * (0.2 + 0.3 * r()) * s.fan) * Math.PI) / 180;
          const v = s.speed * (0.65 + 0.35 * r());
          const a0 = r() * Math.PI * 2;
          for (let k = 0; k < 5; k++) shape.push(0.62 + 0.38 * r(), a0 + ((k + (r() - 0.5) * 0.5) / 5) * Math.PI * 2);
          const size = s.size[0] + (s.size[1] - s.size[0]) * r();
          list.push({
            x: at[0] + sg * dist,
            // 바닥에 누운 높이에서 솟는다 (그 아래에서 시작하면 바닥에 닿지 못하고 빠져 버린다)
            y: at[1] - size * 0.3 - 0.5,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            born: Math.round(dist / s.lift),
            life: Math.round(s.life * (0.75 + 0.25 * r())),
            size,
            rot: r() * Math.PI * 2,
            spin: (r() - 0.5) * 2 * (s.spin ?? 0.12),
            shape,
            lift: true,
          });
          continue;
        }
        const a = ((s.dir + (r() - 0.5) * s.fan) * Math.PI) / 180;
        const v = s.speed * (0.55 + 0.45 * r());
        const a0 = r() * Math.PI * 2;
        for (let k = 0; k < 5; k++) shape.push(0.62 + 0.38 * r(), a0 + ((k + (r() - 0.5) * 0.5) / 5) * Math.PI * 2);
        list.push({
          x: at[0] + (r() - 0.5) * 2 * s.spread,
          y: at[1] - r() * 3,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          born: i * (s.every ?? 0),
          life: Math.round(s.life * (0.7 + 0.3 * r())),
          size: s.size[0] + (s.size[1] - s.size[0]) * r(),
          rot: r() * Math.PI * 2,
          spin: (r() - 0.5) * 2 * (s.spin ?? 0.25),
          shape,
        });
      }
      rocks.set(s, list);
    }
    return list;
  };
  /**
   * 바닥 덩어리 파편 (에드워드 14-4): 포물선으로 날며 돌고, 바닥에 닿으면 두 번 튄 뒤 누워 부서지며 작아진다 (같은 그림으로 멈추지 않게).
   * 셀 3단: 몸 → 위쪽 빛 받는 면 (처음 3틱은 흰 심: 달궈진 단면) → 아래쪽 그늘. 4px보다 작아지면 그리지 않는다
   */
  const drawChunks = (f: GFrame, s: GChunks, ls: number) => {
    const g = s.gravity ?? 0.2;
    const zoom = s.zoom ?? 0;
    const ramp = rampNow();
    const [tS, tB, tL] = s.tones ?? [3, 2, 1];
    chunksOf(s).forEach((c) => {
      const age = ls - c.born;
      if (age < 0 || age >= c.life) return;
      const ground = floorY - c.size * 0.3;
      let x = c.x;
      let y = c.y;
      let vx = c.vx;
      let vy = c.vy;
      let tt = age;
      let bounces = 0;
      let rest = -1;
      let spun = 0;
      let spin = c.spin;
      for (let guard = 0; guard < 4 && tt > 0; guard++) {
        const disc = vy * vy + 2 * g * (ground - y);
        const hit = y <= ground && disc >= 0 ? (-vy + Math.sqrt(disc)) / g : Infinity;
        if (hit > tt) {
          x += vx * tt;
          y += vy * tt + 0.5 * g * tt * tt;
          spun += spin * tt;
          tt = 0;
          break;
        }
        x += vx * hit;
        y = ground;
        spun += spin * hit;
        tt -= hit;
        bounces++;
        if (bounces >= 3) {
          rest = age - tt;
          tt = 0;
          break;
        }
        vy = -(vy + g * hit) * 0.3;
        vx *= 0.5;
        spin *= 0.5;
      }
      let sz = c.size * (1 + zoom * age);
      // 들려 올라오는 덩어리: 처음 3틱 동안 바닥에서 자라 오른다
      if (c.lift && age < 3) sz *= 0.45 + (0.55 * age) / 3;
      if (rest >= 0) sz *= Math.max(0, 1 - (age - rest) / 16);
      const u = age / c.life;
      if (u > 0.8) sz *= 1 - (u - 0.8) / 0.2;
      if (sz < 4) return;
      const rot = c.rot + spun;
      const pts: number[] = [];
      for (let k = 0; k < 5; k++) {
        const rr = (c.shape[2 * k]! * sz) / 2;
        const a = c.shape[2 * k + 1]! + rot;
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      // 빛 받는 면: 위쪽 (공격 방향 위), 그늘: 아래쪽
      const lit = clipHalf(pts, -0.34, -0.94, -0.34 * x - 0.94 * y + 0.08 * sz);
      const shade = clipHalf(pts, 0.26, 0.97, 0.26 * x + 0.97 * y + 0.22 * sz);
      fillRings(f, [toWorld(pts)], ramp[tB] ?? ramp[0]!);
      if (lit.length >= 6) fillRings(f, [toWorld(lit)], ramp[age < 3 ? 0 : tL] ?? ramp[0]!);
      if (shade.length >= 6) fillRings(f, [toWorld(shade)], ramp[tS] ?? ramp[0]!);
    });
  };
  return {
    update(dt: number) {
      // 나타난 틱·흩어지기 시작한 틱을 그리기와 상관없이 적는다 (그리지 않고 건너뛴 틱이 있어도 시간이 맞게)
      for (const s of o.shapes) {
        const ts = sinceT(s);
        if (ts < 0) continue;
        if (!born.has(s)) born.set(s, L);
        if (ts > (s.hold ?? 0) + (s.pulse ? 3 : 0) && !spread.has(s)) spread.set(s, L - born.get(s)!);
      }
      const d = dt * 60;
      L += d;
      if (!o.held?.()) t += d;
    },
    done() {
      return o.shapes.every((s) => {
        if (liveKind(s)) {
          const b = born.get(s);
          return b !== undefined && L - b >= liveEnd(s);
        }
        const ts = sinceT(s);
        return ts >= 0 && ts >= spanOf(s);
      });
    },
    /** 지금 진행 틱 (멈춘 틱은 빼고) */
    tick() {
      return t;
    },
    draw(f: GFrame, l?: Layer) {
      const layer = l ?? 'back';
      if (o.follow) {
        const [fx, fy] = o.follow();
        OX = Math.round(fx);
        OY = Math.round(fy);
        floorY = floorW - OY;
      }
      for (const s of o.shapes) {
        if ((s.layer ?? 'back') !== layer) continue;
        const ph = phaseOf(s);
        if (!ph) continue;
        const at: GPt = 'at' in s && s.at ? s.at : [0, 0];
        switch (s.kind) {
          case 'wedge':
            if (ph.p < 1) paint(f, wedge(s, ph));
            break;
          case 'swoosh':
            if (ph.p < 1) paint(f, swoosh(s, ph));
            break;
          case 'bolt':
            if (ph.p < 1) paint(f, bolt(s, ph));
            break;
          case 'ink':
            if (ph.p < 1) paint(f, ink(s, ph));
            break;
          case 'ring':
            if (ph.p < 1) paint(f, ring(s, ph, at));
            break;
          case 'rays':
            if (ph.p < 1) paint(f, rays(s, ph, at));
            break;
          case 'flash':
            paint(f, flash(s, ph, at));
            break;
          case 'embers':
            drawEmbers(f, s, L - born.get(s)!);
            break;
          case 'smoke':
            drawSmoke(f, s, L - born.get(s)!);
            break;
          case 'ribbon':
            if (ph.p < 1) paint(f, ribbon(s, ph));
            break;
          case 'flutter':
            drawFlutter(f, s, L - born.get(s)!);
            break;
          case 'stitch':
            paint(f, stitch(s, Math.floor(L - born.get(s)! + 1e-6), seedOf(s)));
            break;
          case 'quake':
            if (ph.p < 1) paint(f, quake(s, ph));
            break;
          case 'surge':
            if (ph.p < 1) paint(f, surge(s, ph));
            break;
          case 'chunks':
            drawChunks(f, s, L - born.get(s)!);
            break;
        }
      }
    },
  };
}
