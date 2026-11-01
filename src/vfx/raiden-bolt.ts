// YESTERDAY: 라이덴 적뢰 — 공격 범위를 통째로 채우는 번개 (동작연출지침서 7-1장, Sprite Fusion 이펙트와 같은 구조로 새로 만듦, 렌더 전용).
// 동작이 먼저 끊어 친 뒤, 타격 프레임에 주먹·발 끝에서 번개가 터져 궤적 상자(= sim 판정 상자)를 한 번에 채운다.
//   섬광 (0~1틱): 범위 전체가 흰 덩어리로 번쩍 (가장 밝은 프레임)
//   방전 (2~7틱): 흰 심 + 붉은 줄기가 범위 모양(직선·반원·세로…)을 따라 가지를 치며 갈라진다 (2틱마다 다시 꺾여 지직거림)
//   잔광 (8~16틱): 줄기가 끝부터 끊기며 사라지고, 작은 불꽃이 바닥에 떨어져 튄다
// 맞으면 부르는 쪽이 rewind()로 섬광으로 되돌리고, 히트스톱 동안(held) 시계를 멈춰 가장 크게 펼쳐진 순간이 멈춰 보이게 한다.
// 헛쳐도 범위를 그린다. 세기(power 1~4)가 오를수록 굵고 가지가 많다.
// 좌표는 다른 이펙트처럼 2단위 = 1px (넘기는 값은 월드 px × 2). 색은 부르는 쪽이 우리 팔레트로 넘긴다 (흰 → 붉은 → 검붉은).
import type { Frame, Layer } from './impact';

export type BoltShape = 'line' | 'arc' | 'rise' | 'fall' | 'ground' | 'circle' | 'tail';

export interface Options {
  /** 궤적 상자 (2단위, 월드): 번개가 채우는 범위 = 판정 범위 */
  box: { x0: number; y0: number; x1: number; y1: number };
  shape: BoltShape;
  /** 번개가 터져 나오는 자리 (주먹·발 끝, 2단위) */
  origin: readonly [number, number];
  /** 바라보는 쪽 (1 오른쪽, -1 왼쪽) */
  facing: number;
  /** 세기 1~4 (1타 → 4타·차지): 굵기·가지 수 */
  power?: number;
  /** 색 (0xAABBGGRR, 밝은 → 어두운): 흰 심 → 밝은 붉은 → 붉은 → 검붉은 → 아주 어두운 */
  ramp?: readonly number[];
  seed?: number;
  /** 히트스톱으로 멈춰 있는가 (참이면 시계가 가지 않는다) */
  held?: () => boolean;
  /** 바닥 높이 (2단위): 잔광 불꽃이 떨어져 튀는 곳 */
  ground?: number;
  /**
   * 몸을 휘감아 도는 길 (2단위, 처음 → 주먹·발 끝): 몸 둘레를 감고 치는 팔다리를 타고 끝까지 (사용자 피드백 '전신을 휘감고 휘두르듯이').
   * 섬광에 하얗게 번쩍이고, 방전 동안 붉은 줄기 두 가닥이 꼬여 돌며, 잔광에 깜빡이며 사라진다. 판정이 아니라 꾸밈이다
   */
  coil?: ReadonlyArray<readonly [number, number]>;
  /** 섬광 순간 몸에서 사방으로 퍼져 나가는 갈래 (가운데·수·길이, 2단위). 판정이 아니라 꾸밈이다 */
  spread?: { center: readonly [number, number]; count: number; len: number };
}

const PX = 2;
/** 단계 경계 (초): 섬광 끝, 방전 끝, 잔광 끝 */
const FLASH = 2 / 60;
const DISCHARGE = 8 / 60;
const LIFE = 17 / 60;
const SPARK_LIFE = 0.4;

type P = [number, number];

/** 범위 모양을 따라가는 줄기 길 (1px 단위). 처음 → 끝 */
function trunk(shape: BoltShape, b: { x0: number; y0: number; x1: number; y1: number }, o: P, facing: number): P[] {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const near = facing > 0 ? b.x0 : b.x1;
  const far = facing > 0 ? b.x1 : b.x0;
  const cy = (b.y0 + b.y1) / 2;
  const cx = (b.x0 + b.x1) / 2;
  const ell = (c: P, rx: number, ry: number, a0: number, a1: number, n = 16): P[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [c[0] + facing * Math.cos(a) * rx, c[1] + Math.sin(a) * ry] as P;
    });
  switch (shape) {
    case 'line':
      // 주먹 끝에서 앞으로 곧게 (높이는 상자 안으로)
      return [[o[0], Math.max(b.y0 + 1, Math.min(b.y1 - 1, o[1]))], [far, Math.max(b.y0 + 2, Math.min(b.y1 - 2, o[1]))]];
    case 'tail':
      return [[far, cy], [near, cy]];
    case 'rise':
      return [[o[0], b.y1], [o[0] + facing * 2, b.y0]];
    case 'arc':
      // 앞쪽 반원: 아래 → 앞 → 위 (발차기)
      return ell([near, cy], w, h / 2, Math.PI / 2, -Math.PI / 2);
    case 'fall':
    case 'ground':
      // 위쪽 반원: 뒤 → 꼭대기 → 앞 바닥 (도끼차기, 다리 걸기는 낮은 상자)
      return ell([cx, b.y1], w / 2, h, Math.PI, 2 * Math.PI);
    case 'circle':
      return ell([cx, cy], w / 2, h / 2, 0, 2 * Math.PI, 24);
  }
}

/** 길을 일정한 간격(step px)으로 다시 찍는다: 자리, 처음부터의 비율, 진행 방향 */
function resample(path: readonly P[], step: number): Array<{ p: P; u: number; d: P }> {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    seg.push(l);
    total += l;
  }
  total = Math.max(total, 1);
  const n = Math.max(2, Math.round(total / step));
  const out: Array<{ p: P; u: number; d: P }> = [];
  for (let k = 0; k <= n; k++) {
    let dist = (total * k) / n;
    let i = 0;
    while (i < seg.length - 1 && dist > seg[i]) dist -= seg[i++];
    const a = path[i];
    const b = path[i + 1] ?? path[i];
    const l = seg[i] || 1;
    const t = Math.min(1, dist / l);
    out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], u: k / n, d: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] });
  }
  return out;
}

export default function raidenBolt(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xff667aff, 0xff3c3ad9, 0xff2b1f8e, 0xff1a0f4c];
  const power = Math.max(1, Math.min(4, o.power ?? 1));
  const box = { x0: o.box.x0 / PX, y0: o.box.y0 / PX, x1: o.box.x1 / PX, y1: o.box.y1 / PX };
  const origin: P = [o.origin[0] / PX, o.origin[1] / PX];
  const ground = (o.ground ?? o.box.y1 + 40) / PX;
  const base = resample(trunk(o.shape, box, origin, o.facing), 3);
  const total = base.length - 1;
  /** 몸을 휘감는 길 (1px 단위, 3px 간격) */
  const coil = o.coil && o.coil.length > 1 ? resample(o.coil.map(([x, y]) => [x / PX, y / PX] as P), 3) : null;
  /** 사방으로 퍼지는 갈래: 방향과 길이 (앞쪽 줄기 자리 ±25°는 비켜 간다) */
  const rays = (() => {
    if (!o.spread) return [];
    const rand = (() => {
      let r = ((o.seed ?? 1) * 4099 + 7) & 0x7fffffff;
      return () => {
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        return r / 0x7fffffff;
      };
    })();
    const fwd = o.facing > 0 ? 0 : Math.PI;
    const c: P = [o.spread.center[0] / PX, o.spread.center[1] / PX];
    const L = o.spread.len / PX;
    return Array.from({ length: o.spread.count }, (_, k) => {
      let a = ((k + 0.5) / o.spread!.count) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      const d = Math.atan2(Math.sin(a - fwd), Math.cos(a - fwd));
      if (Math.abs(d) < 0.45) a += Math.sign(d || 1) * 0.6;
      return { c, a, len: L * (0.6 + rand() * 0.5) };
    });
  })();
  /** 섬광 띠의 두께 (px): 세기마다, 직선은 상자 높이를 넘지 않게 */
  const width = Math.min(o.shape === 'line' || o.shape === 'tail' ? box.y1 - box.y0 : 99, [6, 8, 10, 12][power - 1]);
  /** 방전 줄기 수와 가지 수 */
  const strands = 1 + power;
  const forks = 1 + power * 2;
  const seed = (o.seed ?? 1) * 7919 + 17;
  const rng = (k: number) => {
    let r = (seed + k * 104729) & 0x7fffffff;
    return () => {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      return r / 0x7fffffff;
    };
  };
  /** 섬광 띠 두께: 직선은 주먹 쪽이 굵고 끝으로 가늘게 (창), 곡선은 가운데가 굵은 초승달 */
  const thick = (u: number): number => {
    if (o.shape === 'line' || o.shape === 'rise' || o.shape === 'tail') return width * (u < 0.3 ? 0.75 + (0.25 * u) / 0.3 : 1 - ((u - 0.3) / 0.7) * 0.85);
    return width * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.5);
  };
  /** 방전 한 벌 (2틱마다 새 모양): 줄기들 (각 줄기는 점 목록)과 가지들 */
  const shapes = new Map<number, { strands: P[][]; forks: P[][] }>();
  const shapeAt = (k: number) => {
    let sh = shapes.get(k);
    if (sh) return sh;
    const rand = rng(k);
    const list: P[][] = [];
    for (let s = 0; s < strands; s++) {
      // 줄기마다 띠 안에서 옆으로 조금씩 비켜 (가운데 줄기가 가장 곧다)
      const lane = strands === 1 ? 0 : (s / (strands - 1) - 0.5) * 0.8;
      const pts: P[] = [];
      for (const q of base) {
        const n: P = [-q.d[1], q.d[0]];
        const edge = Math.min(1, q.u * 6, (1 - q.u) * 4);
        const off = (lane * thick(q.u) + (rand() - 0.5) * (2.5 + power * 0.6)) * edge;
        pts.push([Math.round(q.p[0] + n[0] * off), Math.round(q.p[1] + n[1] * off)]);
      }
      list.push(pts);
    }
    const fk: P[][] = [];
    for (let i = 0; i < forks; i++) {
      const q = base[1 + Math.floor(rand() * Math.max(1, total - 1))];
      const side = rand() < 0.5 ? -1 : 1;
      const n: P = [-q.d[1] * side, q.d[0] * side];
      const len = 3 + power + Math.floor(rand() * (3 + power * 2));
      const f: P[] = [[Math.round(q.p[0]), Math.round(q.p[1])]];
      let x = q.p[0];
      let y = q.p[1];
      for (let m = 0; m < 3; m++) {
        const a = len / 3;
        x += (q.d[0] * 0.6 + n[0]) * a + (rand() - 0.5) * 2;
        y += (q.d[1] * 0.6 + n[1]) * a + (rand() - 0.5) * 2;
        f.push([Math.round(x), Math.round(y)]);
      }
      fk.push(f);
    }
    sh = { strands: list, forks: fk };
    shapes.set(k, sh);
    return sh;
  };
  // 잔광 불꽃: 줄기 위 여러 자리에서 떨어진다
  const sparks = (() => {
    const rand = rng(777);
    return Array.from({ length: 4 + power * 3 }, () => {
      const q = base[Math.floor(rand() * base.length)];
      return { x: q.p[0], y: q.p[1], vx: (rand() - 0.5) * 50, vy: -20 - rand() * 50, bounce: false };
    });
  })();
  let t = 0;

  const at = (f: Frame, x: number, y: number): number => {
    x = Math.round(x - f.ox);
    y = Math.round(y - f.oy);
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return -1;
    const b = f.box;
    if (b) {
      if (x < b[0]!) b[0] = x;
      if (y < b[1]!) b[1] = y;
      if (x > b[2]!) b[2] = x;
      if (y > b[3]!) b[3] = y;
    }
    return y * f.w + x;
  };
  const put = (f: Frame, x: number, y: number, c: number, a = 1) => {
    const i = at(f, x, y);
    if (i < 0 || a <= 0) return;
    const old = f.color[i]! >>> 24;
    const na = Math.min(255, Math.round(a * 255));
    if (old >= na) return;
    f.color[i] = ((na << 24) | (c & 0xffffff)) >>> 0;
  };
  const glow = (f: Frame, x: number, y: number, c: number, k: number) => {
    const i = at(f, x, y);
    if (i < 0 || k <= 0) return;
    const d = f.light[i]!;
    const r = Math.min(255, (d & 255) + (c & 255) * k);
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
    const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
    f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
  };
  /** 1px 계단 선. w 0: 심만, 1: 심 + 양옆 붉은 테두리, 2: 바깥 검붉은 테두리까지 */
  const line = (f: Frame, a: P, b: P, w: number, core: number, k: number) => {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    const flat = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const ox = flat ? 0 : 1;
    const oy = flat ? 1 : 0;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * s) / n);
      const y = Math.round(a[1] + ((b[1] - a[1]) * s) / n);
      put(f, x, y, core);
      if (w >= 1) {
        put(f, x - ox, y - oy, C[1]!);
        put(f, x + ox, y + oy, C[2]!);
      }
      if (w >= 2) {
        put(f, x - 2 * ox, y - 2 * oy, C[3]!);
        put(f, x + 2 * ox, y + 2 * oy, C[3]!);
      }
      if (k > 0 && s % 2 === 0) for (let q = -3; q <= 3; q++) glow(f, x + q * ox, y + q * oy, C[1]!, k * (1 - Math.abs(q) / 4));
    }
  };
  /** 섬광: 범위 전체를 흰 덩어리로 (띠 안은 흰색, 둘레 1px 밝은 붉은색) */
  const flash = (f: Frame, k: number) => {
    const core = new Set<number>();
    for (const q of base) {
      const r = Math.max(0.6, thick(q.u) / 2);
      const ri = Math.ceil(r);
      for (let y = -ri; y <= ri; y++) for (let x = -ri; x <= ri; x++) if (x * x + y * y <= r * r) core.add(((Math.round(q.p[1]) + y) << 16) ^ (Math.round(q.p[0]) + x + 32768));
    }
    const has = (x: number, y: number) => core.has((y << 16) ^ (x + 32768));
    for (const key of core) {
      const x = (key & 0xffff) - 32768;
      const y = (key ^ (x + 32768)) >> 16;
      put(f, x, y, C[0]!);
      if (k > 0 && (x + y) % 2 === 0) glow(f, x, y, C[1]!, k);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!has(x + dx, y + dy)) put(f, x + dx, y + dy, C[1]!);
    }
  };

  /** 몸을 휘감는 줄기: 섬광은 흰 두 줄, 방전은 붉은 두 가닥이 길 둘레를 꼬여 돌고(2틱마다 돈다), 잔광은 깜빡이며 옅어진다 */
  const drawCoil = (f: Frame, tt: number, k: number) => {
    if (!coil || k <= 0 || tt >= LIFE) return;
    if (tt >= DISCHARGE && Math.floor(tt * 40) % 3 === 1) return;
    const spin = Math.floor(tt * 30);
    for (let strand = 0; strand < 2; strand++) {
      const pts: P[] = coil.map((q, i) => {
        const n: P = [-q.d[1], q.d[0]];
        const off = tt < FLASH ? (strand ? 1 : -1) : Math.sin(i * 0.9 + spin * 1.3 + strand * Math.PI) * (2 + power * 0.5);
        return [Math.round(q.p[0] + n[0] * off), Math.round(q.p[1] + n[1] * off)];
      });
      const core = tt < FLASH || (strand === 0 && tt < DISCHARGE) ? C[0]! : C[1]!;
      const w = tt < DISCHARGE && strand === 0 ? 1 : 0;
      for (let i = 0; i + 1 < pts.length; i++) line(f, pts[i]!, pts[i + 1]!, w, core, tt < DISCHARGE ? 0.4 * k : 0);
    }
  };
  /** 사방으로 퍼지는 갈래: 섬광에 반쯤, 방전 동안 끝까지 자라며 갈라지고, 잔광에 안쪽부터 끊겨 바깥으로 흩어진다 */
  const drawRays = (f: Frame, tt: number) => {
    if (!rays.length || tt >= LIFE) return;
    const grow = tt < FLASH ? 0.5 : tt < DISCHARGE ? 0.5 + ((tt - FLASH) / (DISCHARGE - FLASH)) * 0.5 : 1;
    const cut = tt < DISCHARGE ? 0.15 : 0.15 + ((tt - DISCHARGE) / (LIFE - DISCHARGE)) * 0.85;
    if (tt >= DISCHARGE && Math.floor(tt * 40) % 3 === 1) return;
    let r = (seed + Math.floor(tt * 30) * 7717) & 0x7fffffff;
    const rand = () => {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      return r / 0x7fffffff;
    };
    for (const ray of rays) {
      const dx = Math.cos(ray.a);
      const dy = Math.sin(ray.a);
      const len = ray.len * grow;
      const seg = 4;
      const pts: P[] = [];
      for (let q = 0; q <= seg; q++) {
        const u = q / seg;
        if (u < cut) continue;
        const j = q === 0 ? 0 : (rand() - 0.5) * 4;
        pts.push([Math.round(ray.c[0] + dx * len * u - dy * j), Math.round(ray.c[1] + dy * len * u + dx * j)]);
      }
      if (pts.length < 2) continue;
      const core = tt < DISCHARGE ? C[0]! : C[2]!;
      for (let i = 0; i + 1 < pts.length; i++) line(f, pts[i]!, pts[i + 1]!, tt < FLASH ? 0 : i === 0 ? 1 : 0, core, tt < DISCHARGE ? 0.3 : 0);
      // 끝에서 한 번 갈라진다
      if (tt >= FLASH && tt < DISCHARGE) {
        const e = pts[pts.length - 1]!;
        const fa = ray.a + (rand() < 0.5 ? -0.7 : 0.7);
        line(f, e, [Math.round(e[0] + Math.cos(fa) * 4), Math.round(e[1] + Math.sin(fa) * 4)], 0, C[1]!, 0);
      }
    }
  };

  return {
    /** 맞힌 순간: 섬광으로 되돌린다 (히트스톱 동안 이 순간이 멈춰 보인다) */
    rewind() {
      t = 0;
    },
    /** 지금 단계와 세기 (빛을 내는 쪽이 쓴다): 0 섬광 · 1 방전 · 2 잔광, k는 그 단계의 밝기 (1 → 0) */
    phase(): { stage: 0 | 1 | 2; k: number; pts: P[] } {
      const pts = [base[0].p, base[Math.floor(total / 2)].p, base[total].p];
      if (t < FLASH) return { stage: 0, k: 1, pts };
      if (t < DISCHARGE) return { stage: 1, k: 1 - ((t - FLASH) / (DISCHARGE - FLASH)) * 0.4, pts };
      return { stage: 2, k: Math.max(0, 1 - (t - DISCHARGE) / (LIFE - DISCHARGE)) * 0.5, pts };
    },
    update(dt: number) {
      if (o.held?.() && t < DISCHARGE) return;
      t += dt;
      if (t < DISCHARGE) return;
      const s = Math.min(dt, 1 / 30);
      for (const p of sparks) {
        p.vy += 300 * s;
        p.x += p.vx * s;
        p.y += p.vy * s;
        if (p.y > ground && p.vy > 0) {
          p.y = ground;
          p.vy *= p.bounce ? 0 : -0.35;
          p.vx *= 0.5;
          p.bounce = true;
        }
      }
    },
    done() {
      return t >= Math.max(LIFE, DISCHARGE + SPARK_LIFE);
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      if (t < FLASH) {
        flash(f, 0.9);
        // 섬광 안에서도 가운데 줄기는 보인다
        const sh = shapeAt(0);
        const mid = sh.strands[Math.floor(sh.strands.length / 2)];
        for (let i = 0; i + 1 < mid.length; i++) line(f, mid[i]!, mid[i + 1]!, 0, C[0]!, 0);
        drawCoil(f, 0, 1);
        drawRays(f, 0);
        return;
      }
      drawCoil(f, t, t < DISCHARGE ? 1 : Math.max(0, 1 - (t - DISCHARGE) / (LIFE - DISCHARGE)));
      drawRays(f, t);
      if (t < LIFE) {
        const disc = t < DISCHARGE;
        const k = disc ? 1 - ((t - FLASH) / (DISCHARGE - FLASH)) * 0.5 : 1 - (t - DISCHARGE) / (LIFE - DISCHARGE);
        // 잔광: 줄기가 끝부터 끊기며 사라진다 (보이는 구간이 가운데로 줄어든다), 깜빡임
        const cut = disc ? 0 : ((t - DISCHARGE) / (LIFE - DISCHARGE)) * 0.55;
        const flicker = disc || Math.floor(t * 40) % 3 !== 1;
        if (flicker) {
          const sh = shapeAt(Math.floor(t * 30));
          sh.strands.forEach((pts, si) => {
            const main = si === Math.floor(sh.strands.length / 2);
            const w = disc ? (main ? (power >= 3 ? 2 : 1) : power >= 2 ? 1 : 0) : main ? 1 : 0;
            const core = disc || main ? C[0]! : C[1]!;
            for (let i = 0; i + 1 < pts.length; i++) {
              const u = i / (pts.length - 1);
              if (u < cut * 0.4 || u > 1 - cut) continue;
              line(f, pts[i]!, pts[i + 1]!, w, core, disc ? k * 0.6 : k * 0.3);
            }
          });
          if (disc || cut < 0.3) for (const fk of sh.forks) for (let i = 0; i + 1 < fk.length; i++) line(f, fk[i]!, fk[i + 1]!, 0, i === 0 ? C[0]! : C[1]!, 0);
        }
      }
      // 불꽃: 떨어져 바닥에서 한 번 튄다 (밝은 붉은 → 검붉게)
      if (t >= DISCHARGE && t < DISCHARGE + SPARK_LIFE) {
        const u = (t - DISCHARGE) / SPARK_LIFE;
        for (const p of sparks) put(f, p.x, p.y, C[Math.min(C.length - 1, 1 + Math.floor(u * (C.length - 1)))]!, 1 - u * 0.4);
      }
    },
  };
}
