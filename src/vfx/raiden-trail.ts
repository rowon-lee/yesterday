// YESTERDAY: 라이덴 궤적 번개 — 치는 손발 끝이 지난 궤적을 따라 크게 휘는 초승달 모양을 붉은 번개가 채운다 (렌더 전용).
// 사용자 레퍼런스(2026-11-01): 모양은 '궤적을 따라 크게 휘는 초승달'만 가져오고, 그 안은 번개다
// ("궤적을 따라 가는 형태만 레퍼런스, 번개로"). 꺾인 번개 줄기 여러 가닥이 궤적을 따라 초승달(양 끝 뾰족, 앞쪽이 굵음)을 이루고,
// 바깥으로 갈래를 치며, 2틱마다 다시 꺾여 지직거린다.
// 동작연출지침서 7-1장 순서: 섬광(0~1틱, 초승달 전체가 흰 덩어리) → 방전(2~7틱, 흰 심 + 붉은 줄기와 갈래)
// → 잔광(8~16틱, 꼬리부터 걷히고 줄기가 끊겨 흩어지며 불티가 떨어진다). 초승달의 앞부분이 sim 궤적 상자(판정)를 덮는다.
// 앞끝은 처음 2틱 동안 궤적을 따라 꼬리에서 끝까지 내달린다. 맞으면 rewind()로 섬광으로 되돌리고, 히트스톱 동안(held) 멈춘다.
// 좌표는 2단위 = 1px, 색은 부르는 쪽이 넘긴다 (흰 → 밝은 붉은 → 붉은 → 검붉은 → 아주 어두운).
import type { Frame, Layer } from './impact';

export interface Options {
  /** 궤적 (2단위, 꼬리 → 앞끝). 몇 개의 점이면 되고, 매끈한 곡선(캣멀-롬)으로 잇는다 */
  path: ReadonlyArray<readonly [number, number]>;
  /** 세기 1~4: 초승달 폭·줄기 수·갈래 수 */
  power?: number;
  ramp?: readonly number[];
  seed?: number;
  /** 히트스톱으로 멈춰 있는가 */
  held?: () => boolean;
  /** 바닥 높이 (2단위): 불티가 떨어지는 곳 */
  ground?: number;
}

const PX = 2;
/** 섬광 끝, 방전 끝, 잔광 끝 (초) */
const FLASH = 2 / 60;
const DISCHARGE = 8 / 60;
const LIFE = 17 / 60;
/** 앞끝이 꼬리에서 끝까지 내달리는 시간 (초) */
const REVEAL = 2 / 60;
const SPARK_LIFE = 0.4;
/** 이 비율보다 꼬리쪽은 캐릭터 뒤 겹에 그린다 */
const BACK_U = 0.42;

type P = [number, number];
interface Pt {
  x: number;
  y: number;
  nx: number;
  ny: number;
  tx: number;
  ty: number;
  u: number;
}

/** 캣멀-롬 곡선으로 이어 1px 간격으로 다시 찍는다: 자리, 접선·법선, 처음부터의 비율 */
function spline(ctrl: readonly P[]): Pt[] {
  const pts = ctrl.length >= 2 ? ctrl : [ctrl[0]!, [ctrl[0]![0] + 1, ctrl[0]![1]] as P];
  const dense: P[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const n = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 2));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]!);
  const len: number[] = [0];
  let total = 0;
  for (let i = 1; i < dense.length; i++) len.push((total += Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1])));
  const n = Math.max(2, Math.round(total));
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (total * k) / n;
    while (j < len.length - 2 && len[j + 1]! < s) j++;
    const a = dense[j]!;
    const b = dense[j + 1] ?? a;
    const l = Math.max(1e-6, len[j + 1]! - len[j]!);
    const t = Math.max(0, Math.min(1, (s - len[j]!) / l));
    const tx = (b[0] - a[0]) / l;
    const ty = (b[1] - a[1]) / l;
    out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -ty, ny: tx, tx, ty, u: k / n });
  }
  return out;
}

export default function raidenTrail(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xff667aff, 0xff3c3ad9, 0xff2b1f8e, 0xff1a0f4c];
  const power = Math.max(1, Math.min(4, o.power ?? 1));
  const W = [10, 12, 15, 18][power - 1]!;
  const STRANDS = [3, 4, 5, 6][power - 1]!;
  const FORKS = [3, 5, 7, 10][power - 1]!;
  const pts = spline(o.path.map(([x, y]) => [x / PX, y / PX] as P));
  const L = pts.length;
  const ground = (o.ground ?? 1e9) / PX;
  const seed = (o.seed ?? 1) * 7919 + 41;
  /** 초승달 반폭: 꼬리 0 → 앞쪽 65% 자리에서 가장 굵고 → 앞끝 0 */
  const half = (u: number) => {
    const p = u < 0.65 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.65)), 1.2) : Math.pow(Math.cos((Math.PI / 2) * ((u - 0.65) / 0.35)), 0.8);
    return Math.max(0.5, (W / 2) * p);
  };
  const rng = (k: number) => {
    let r = (seed + k * 104729) & 0x7fffffff;
    return () => {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      return r / 0x7fffffff;
    };
  };
  /** 번개 한 벌 (2틱마다 새 모양): 초승달 안을 따라가는 꺾인 줄기들과 바깥으로 치는 갈래들 */
  const shapes = new Map<number, { strands: Array<Array<[number, number, number]>>; forks: P[][] }>();
  const shapeAt = (k: number) => {
    let sh = shapes.get(k);
    if (sh) return sh;
    const rand = rng(k);
    const strands: Array<Array<[number, number, number]>> = [];
    for (let s = 0; s < STRANDS; s++) {
      // 줄기마다 초승달 안 자리 (−0.8 ~ 0.8), 가운데 줄기가 가장 밝고 곧다
      const lane = STRANDS === 1 ? 0 : ((s / (STRANDS - 1)) * 2 - 1) * 0.8;
      const line: Array<[number, number, number]> = [];
      for (let i = 0; i < L; ) {
        const q = pts[i]!;
        const jag = (rand() - 0.5) * (2.5 + power * 0.7);
        const off = lane * half(q.u) + jag * Math.min(1, q.u * 8, (1 - q.u) * 8);
        line.push([Math.round(q.x + q.nx * off), Math.round(q.y + q.ny * off), q.u]);
        i += 4 + Math.floor(rand() * 4);
      }
      const e = pts[L - 1]!;
      line.push([Math.round(e.x), Math.round(e.y), 1]);
      strands.push(line);
    }
    const forks: P[][] = [];
    for (let n = 0; n < FORKS; n++) {
      const q = pts[Math.floor((0.2 + rand() * 0.75) * (L - 1))]!;
      const side = rand() < 0.5 ? -1 : 1;
      // 초승달 바깥 가장자리에서 바깥쪽으로, 진행 방향으로 조금 기울여
      let x = q.x + q.nx * side * half(q.u);
      let y = q.y + q.ny * side * half(q.u);
      const f: P[] = [[Math.round(x), Math.round(y)]];
      const len = 4 + rand() * (4 + power * 3);
      for (let m = 0; m < 3; m++) {
        const a = len / 3;
        x += (q.nx * side + q.tx * 0.5) * a + (rand() - 0.5) * 2.5;
        y += (q.ny * side + q.ty * 0.5) * a + (rand() - 0.5) * 2.5;
        f.push([Math.round(x), Math.round(y)]);
      }
      forks.push(f);
    }
    sh = { strands, forks };
    shapes.set(k, sh);
    return sh;
  };
  // 불티: 초승달 가장자리에서 떨어져 바닥에서 한 번 튄다
  const sparks = (() => {
    const rand = rng(777);
    return Array.from({ length: 5 + power * 3 }, () => {
      const q = pts[Math.floor((0.25 + rand() * 0.75) * (L - 1))]!;
      const side = rand() < 0.5 ? -1 : 1;
      return { x: q.x + q.nx * side * half(q.u), y: q.y + q.ny * side * half(q.u), vx: q.nx * side * (20 + rand() * 40) + q.tx * 30, vy: q.ny * side * (20 + rand() * 30) - 25 };
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
  const put = (f: Frame, x: number, y: number, c: number) => {
    const i = at(f, x, y);
    if (i >= 0) f.color[i] = c >>> 0;
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
  /** 꺾인 마디 하나 (1px 계단 선). rim이면 선에 수직으로 붉은 테두리 */
  const seg = (f: Frame, a: readonly number[], b: readonly number[], core: number, rim: boolean, k: number) => {
    const n = Math.max(Math.abs(b[0]! - a[0]!), Math.abs(b[1]! - a[1]!), 1);
    const flat = Math.abs(b[0]! - a[0]!) >= Math.abs(b[1]! - a[1]!);
    const ox = flat ? 0 : 1;
    const oy = flat ? 1 : 0;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a[0]! + ((b[0]! - a[0]!) * s) / n);
      const y = Math.round(a[1]! + ((b[1]! - a[1]!) * s) / n);
      if (rim) {
        put(f, x - ox, y - oy, C[1]!);
        put(f, x + ox, y + oy, C[2]!);
      }
      put(f, x, y, core);
      if (k > 0 && s % 2 === 0) for (let q = -3; q <= 3; q++) glow(f, x + q * ox, y + q * oy, C[1]!, k * (1 - Math.abs(q) / 4));
    }
  };

  return {
    /** 맞힌 순간: 섬광으로 되돌린다 (다 뻗은 채로, 히트스톱 동안 이 순간에 멈춘다) */
    rewind() {
      t = REVEAL - 1 / 60;
    },
    /** 빛을 내는 쪽이 쓴다: 단계(0 섬광 · 1 방전 · 2 잔광), 밝기, 초승달의 꼬리쪽·가운데·앞끝 자리(px) */
    phase(): { stage: 0 | 1 | 2; k: number; pts: Array<[number, number]> } {
      const sel = [pts[Math.floor(L * 0.3)]!, pts[Math.floor(L * 0.65)]!, pts[L - 1]!].map((q) => [q.x, q.y] as [number, number]);
      if (t < FLASH) return { stage: 0, k: 1, pts: sel };
      if (t < DISCHARGE) return { stage: 1, k: 1 - ((t - FLASH) / (DISCHARGE - FLASH)) * 0.4, pts: sel };
      return { stage: 2, k: Math.max(0, 1 - (t - DISCHARGE) / (LIFE - DISCHARGE)) * 0.5, pts: sel };
    },
    update(dt: number) {
      if (o.held?.() && t < DISCHARGE) return;
      t += dt;
      if (t < DISCHARGE) return;
      const s = Math.min(dt, 1 / 30);
      for (const p of sparks) {
        p.vy += 280 * s;
        p.x += p.vx * s;
        p.y += p.vy * s;
        if (p.y > ground) {
          p.y = ground;
          p.vy *= -0.3;
          p.vx *= 0.5;
        }
      }
    },
    done() {
      return t >= Math.max(LIFE, DISCHARGE + SPARK_LIFE);
    },
    draw(f: Frame, layer?: Layer) {
      // 꼬리쪽(치는 사람 몸에 겹치는 곳)은 캐릭터 뒤 겹, 앞쪽(상대를 덮는 곳)은 앞 겹: 섬광이 치는 사람의 자세를 가리지 않는다
      const mine = (u: number) => (layer === 'back' ? u < BACK_U : u >= BACK_U);
      const lead = Math.min(1, (t + 1 / 60) / REVEAL);
      if (t < FLASH) {
        // 섬광: 내달린 데까지 초승달 전체가 흰 덩어리, 둘레 1px 밝은 붉은색
        for (let i = 0; i < L; i++) {
          const q = pts[i]!;
          if (q.u > lead) break;
          if (!mine(q.u)) continue;
          const h = half(q.u) * 1.1;
          for (let d = -Math.ceil(h); d <= Math.ceil(h); d++) {
            const edge = Math.abs(d) >= h - 0.5;
            put(f, q.x + q.nx * d, q.y + q.ny * d, edge ? C[1]! : C[0]!);
          }
          if (i % 2 === 0) for (let d = -Math.ceil(h) - 3; d <= Math.ceil(h) + 3; d++) glow(f, q.x + q.nx * d, q.y + q.ny * d, C[1]!, 0.5);
        }
        return;
      }
      if (t < LIFE) {
        const disc = t < DISCHARGE;
        const fade = disc ? 0 : (t - DISCHARGE) / (LIFE - DISCHARGE);
        // 잔광: 꼬리부터 걷힌다 (보이는 구간이 앞끝 쪽으로 줄어든다), 깜빡임
        const tail = Math.pow(fade, 0.8);
        const flicker = disc || Math.floor(t * 40) % 3 !== 1;
        if (flicker) {
          const sh = shapeAt(Math.floor(t * 30));
          const mid = Math.floor(sh.strands.length / 2);
          sh.strands.forEach((line, si) => {
            const main = si === mid;
            // 잔광에서는 바깥 줄기부터 끊긴다
            if (fade > 0 && Math.abs(si - mid) > (1 - fade) * mid + 0.01) return;
            const core = disc ? (main || power >= 3 ? C[0]! : C[1]!) : main ? C[1]! : C[2]!;
            for (let i = 0; i + 1 < line.length; i++) {
              const a = line[i]!;
              const b = line[i + 1]!;
              if (a[2] > lead || b[2] < tail || !mine(a[2])) continue;
              // 잔광: 마디가 군데군데 끊긴다
              if (fade > 0 && (i * 5 + si * 3) % 7 < fade * 5) continue;
              seg(f, a, b, core, disc && (main || power >= 2), disc ? 0.5 : 0.25 * (1 - fade));
            }
          });
          if ((disc || fade < 0.4) && layer !== 'back') {
            for (const fk of sh.forks) for (let i = 0; i + 1 < fk.length; i++) seg(f, fk[i]!, fk[i + 1]!, i === 0 ? C[0]! : C[1]!, false, 0);
          }
        }
      }
      // 불티: 잔광부터 떨어져 바닥에서 한 번 튄다
      if (t >= DISCHARGE && t < DISCHARGE + SPARK_LIFE && layer !== 'back') {
        const u = (t - DISCHARGE) / SPARK_LIFE;
        for (const p of sparks) put(f, p.x, p.y, C[Math.min(C.length - 1, 1 + Math.floor(u * 3))]!);
      }
    },
  };
}
