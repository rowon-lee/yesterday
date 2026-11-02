// YESTERDAY: 라이덴 필살기 파천 연출 그림 (렌더 전용, 사용자 피드백 2026-11-02 9-4). 색은 검붉은 계열 하나 (심만 흰빛).
//   crack:   진각으로 디딘 자리의 바닥 금 (연출이 끝날 때까지 남았다가 옅어진다)
//   contact: 정적 장면에서 주먹이 닿은 점 하나만 붉다
//   surge:   몸 안으로: 상대를 어둡고 반투명하게 비추고 (실루엣을 4×4 디더로), 상대 뼈대를 따라 검붉은 전류가
//            가슴(닿은 자리)에서 손끝·발끝까지 번진다. flash()로 섬광 (전류가 하얗게 2틱)
//   embers:  잿더미 줄 위로 오르는 검붉은 불씨
//   ashFall: 잔심 동안 위에서 떨어지는 잿가루
// 좌표는 월드 px. 색은 부르는 쪽이 넘긴다 ([흰, 밝은 붉은, 붉은, 검붉은, 아주 어두운]).
import type { Frame, Layer } from './impact';
import type { Body } from './raiden-charge';

type P = readonly [number, number];
const TICK = 1 / 60;

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
function line(f: Frame, a: P, b: P, c: number): void {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let s = 0; s <= n; s++) put(f, Math.round(a[0] + ((b[0] - a[0]) * s) / n), Math.round(a[1] + ((b[1] - a[1]) * s) / n), c);
}
const hash = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 바닥 금: (x, floor)에서 양옆으로 갈라진 어두운 금 몇 줄. life틱 뒤 끊기며 사라진다 */
export function pacheonCrack(o: { x: number; floor: number; dir: number; life: number; ramp: readonly number[]; seed?: number }) {
  const seed = o.seed ?? 1;
  let t = 0;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  // 금: 디딘 자리에서 앞뒤로 뻗는 꺾인 줄 4개 (앞쪽이 길다), 바닥 위 0~1px
  const cracks: P[][] = [];
  for (let k = 0; k < 4; k++) {
    const side = k % 2 === 0 ? o.dir : -o.dir;
    const len = (k < 2 ? 18 : 9) + hash(seed, k, 1) * 8;
    const pts: P[] = [[o.x, o.floor - 1]];
    let x = o.x;
    let y = o.floor - 1;
    for (let s = 0; s < 5; s++) {
      x += (side * len) / 5;
      y = o.floor - 1 - (hash(seed, k, s + 2) < 0.4 ? 1 : 0);
      pts.push([Math.round(x), y]);
    }
    cracks.push(pts);
  }
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return tickNow() >= o.life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'front') return;
      const k = tickNow();
      const fade = Math.max(0, (k - (o.life - 20)) / 20);
      cracks.forEach((pts, n) => {
        for (let i = 0; i + 1 < pts.length; i++) {
          if (fade > 0 && (i + n) % 3 < fade * 3) continue;
          // 처음 3틱은 금 속이 붉게 비친다
          line(f, pts[i]!, pts[i + 1]!, k < 3 && i < 2 ? o.ramp[2]! : o.ramp[4]!);
        }
      });
    },
  };
}

/** 정적: 주먹이 닿은 점 하나만 붉다 (life틱) */
export function pacheonContact(o: { at: () => P; life: number; ramp: readonly number[] }) {
  let t = 0;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return tickNow() >= o.life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const [x, y] = o.at();
      put(f, x, y, o.ramp[1]!);
      put(f, x + 1, y, o.ramp[2]!);
      put(f, x, y + 1, o.ramp[2]!);
      glow(f, x, y, 3, o.ramp[2]!, 0.5);
    },
  };
}

/**
 * 몸 안으로 (life틱): 상대를 어둡고 반투명하게 비추고 뼈대를 따라 검붉은 전류가 가슴에서 손끝·발끝까지 번진다.
 * 몸은 부르는 쪽이 감춘다 (이 이펙트가 대신 그린다). flash()를 부르면 2틱 동안 전류가 하얗다
 */
export function pacheonSurge(o: { body: () => Body | null; life: number; ramp: readonly number[]; seed?: number }) {
  const C = o.ramp;
  const seed = o.seed ?? 1;
  let t = 0;
  let flashAt = -99;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  return {
    flash() {
      flashAt = tickNow();
    },
    update(dt: number) {
      t += dt;
    },
    done() {
      return tickNow() >= o.life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const b = o.body();
      if (!b) return;
      const k = tickNow();
      // 어두운 반투명 몸: 실루엣을 가장 어두운 검붉은 색 60%로 (층이 4×4 디더로 섞는다), 윤곽 한 줄은 검붉은 색
      const { w, h, data } = b.sil;
      const dim = ((0x99 << 24) | (C[4]! & 0xffffff)) >>> 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (data[y * w + x]! >>> 24 === 0) continue;
          const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || data[y * w + x - 1]! >>> 24 === 0 || data[y * w + x + 1]! >>> 24 === 0 || data[(y - 1) * w + x]! >>> 24 === 0 || data[(y + 1) * w + x]! >>> 24 === 0;
          put(f, b.sil.x + x, b.sil.y + y, edge ? C[3]! : dim);
        }
      // 뼈대를 따라 번지는 전류: 가슴(목과 엉덩이 사이 위쪽)에서 시작해 14틱 동안 손끝·발끝까지
      const j = b.j;
      const chest: P = [j.neck[0] * 0.7 + j.hip[0] * 0.3, j.neck[1] * 0.7 + j.hip[1] * 0.3];
      const chains: P[][] = [
        [chest, j.neck, j.head],
        [chest, j.hip],
        [chest, j.shF, j.eF, j.hF],
        [chest, j.shB, j.eB, j.hB],
        [chest, j.hip, j.kF, j.fF],
        [chest, j.hip, j.kB, j.fB],
      ];
      const reach = Math.min(1, (k + 1) / 14);
      const white = k - flashAt < 2;
      chains.forEach((pts, n) => {
        // 사슬 길이
        const seg: number[] = [];
        let total = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const l = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
          seg.push(l);
          total += l;
        }
        let left = total * reach;
        let prev: P = pts[0]!;
        for (let i = 0; i + 1 < pts.length && left > 0; i++) {
          const a = pts[i]!;
          const c = pts[i + 1]!;
          const l = seg[i]!;
          const u = Math.min(1, left / Math.max(1, l));
          const steps = Math.max(2, Math.round((l * u) / 3));
          for (let s = 1; s <= steps; s++) {
            const v = (u * s) / steps;
            const jx = (hash(seed + n, i * 31 + s, k >> 1) - 0.5) * 2.4;
            const jy = (hash(seed + n + 7, i * 17 + s, k >> 1) - 0.5) * 2.4;
            const q: P = [Math.round(a[0] + (c[0] - a[0]) * v + jx), Math.round(a[1] + (c[1] - a[1]) * v + jy)];
            line(f, prev, q, white ? C[0]! : s === steps && u < 1 ? C[1]! : (s + k) % 4 === 0 ? C[2]! : C[3]!);
            prev = q;
          }
          left -= l;
        }
        // 끝(손끝·발끝·머리)에 닿으면 작은 불티
        if (reach >= 1 && k % 3 === n % 3) put(f, prev[0] + (hash(n, k, seed) < 0.5 ? 1 : -1), prev[1] - 1, white ? C[0]! : C[1]!);
        if (white) glow(f, prev[0], prev[1], 2, C[1]!, 0.5);
      });
      if (white) glow(f, chest[0], chest[1], 8, C[1]!, 0.8);
    },
  };
}

/** 잿더미 줄 위로 오르는 검붉은 불씨 (x0~x1, 바닥 floor, life틱) */
export function pacheonEmbers(o: { x0: number; x1: number; floor: number; life: number; ramp: readonly number[]; seed?: number }) {
  const seed = o.seed ?? 1;
  let t = 0;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  const N = Math.max(8, Math.round(Math.abs(o.x1 - o.x0) / 10));
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return tickNow() >= o.life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const k = tickNow();
      for (let n = 0; n < N; n++) {
        const born = Math.floor(hash(seed, n, 0) * o.life * 0.6);
        const age = k - born;
        if (age < 0 || age > 30) continue;
        const x = o.x0 + (o.x1 - o.x0) * hash(seed, n, 1) + Math.sin((age + n) * 0.3) * 2;
        const y = o.floor - 2 - age * (0.6 + 0.6 * hash(seed, n, 2)) - hash(seed, n, 3) * 20;
        if (age > 20 && (age + n) % 2) continue;
        put(f, x, y, age < 8 ? o.ramp[1]! : age < 18 ? o.ramp[2]! : o.ramp[3]!);
      }
    },
  };
}

/** 잔심 동안 위에서 떨어지는 잿가루 (가로 x0~x1, top에서 floor까지, life틱) */
export function pacheonAshFall(o: { x0: number; x1: number; top: number; floor: number; life: number; ramp: readonly number[]; seed?: number }) {
  const seed = o.seed ?? 1;
  let t = 0;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  const N = Math.max(10, Math.round(Math.abs(o.x1 - o.x0) / 8));
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return tickNow() >= o.life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const k = tickNow();
      const span = o.floor - o.top;
      for (let n = 0; n < N; n++) {
        const off = hash(seed, n, 0) * span;
        const y = o.top + ((off + k * (0.5 + 0.4 * hash(seed, n, 1))) % span);
        const x = o.x0 + (o.x1 - o.x0) * hash(seed, n, 2) + Math.sin((k + n * 9) * 0.12) * 3;
        if (k > o.life - 12 && (n + k) % 3 === 0) continue;
        put(f, x, y, n % 3 === 0 ? o.ramp[0]! : n % 3 === 1 ? o.ramp[1]! : o.ramp[2]!);
      }
    },
  };
}
