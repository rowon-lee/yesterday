// YESTERDAY: 라이덴 스킬 2 화과산 그림 (렌더 전용, 사용자 피드백 2026-11-02 9-3). 마법진·고리 모양은 쓰지 않는다.
//   dome:    날숨. 바닥에 붙은 반구(반지름 = 판정 40px) 안에서 가운데(발밑)부터 바깥으로 튀는 꺾인 스파크 줄기들.
//            첫 틱 흰 섬광(반구 안을 흰 점으로), 2~4틱 붉은 방전, 끝에서 흩어져 6틱에 사라진다. 반구 테두리 선은 긋지 않는다.
//   barrier: 전류 방벽. 바닥에서 솟은 폭 6~8px·높이 약 80px의 세로 커튼: 갈라진 줄기 3~4개가 서로 얽혀 2틱마다 다시 꺾이며
//            깜빡인다. 서 있는 내내 보이고, 마지막 12틱은 빠르게 깜빡이며 사라진다. 튕겨 내는 틱에 번쩍인다.
//   drag:    밀려나는 상대의 두 발이 젖은 바닥을 긁은 자국 두 줄 (물 튐은 부르는 쪽이 낸다).
// 좌표는 월드 px. 색은 부르는 쪽이 넘긴다 (흰 → 밝은 붉은 → 붉은 → 검붉은 → 아주 어두운).
import type { Frame, Layer } from './impact';

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

/** 날숨 반구 스파크: (x, floor) 발밑 가운데, r 반지름 (= 판정) */
export function hwagwasanDome(o: { x: number; floor: number; r: number; ramp: readonly number[]; seed?: number }) {
  const C = o.ramp;
  const seed = o.seed ?? 1;
  const LIFE = 7;
  let t = 0;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  // 줄기: 바닥 위 반원 안에서 고르게 퍼지는 각도 (0 = 앞, π = 뒤), 몸 가까이(반지름 10)에서 시작해 반구 면까지
  const N = 11;
  return {
    phase() {
      const k = tickNow();
      return { k: k >= LIFE ? 0 : k < 1 ? 1 : 1 - k / LIFE, x: o.x, y: o.floor - o.r * 0.5 };
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
      // 첫 틱: 반구 안을 흰 점으로 (섬광 1틱). 테두리 선은 긋지 않는다 (고리처럼 보이지 않게)
      if (k === 0) {
        for (let dy = 0; dy <= o.r; dy++)
          for (let dx = -o.r; dx <= o.r; dx++) {
            if (dx * dx + dy * dy > o.r * o.r) continue;
            if (((dx + dy) & 1) !== 0 || hash(seed, dx, dy) < 0.35) continue;
            put(f, o.x + dx, o.floor - 1 - dy, C[0]!);
          }
        glow(f, o.x, o.floor - o.r * 0.4, 14, C[1]!, 0.9);
      }
      const reach = Math.min(1, (k + 1) / 2);
      const col = k < 1 ? C[0]! : k < 3 ? C[1]! : k < 5 ? C[2]! : C[3]!;
      for (let b = 0; b < N; b++) {
        const a = Math.PI * (0.04 + (0.92 * (b + hash(seed, b, 7) * 0.6)) / N);
        const len = o.r * (0.8 + 0.2 * hash(seed, b, k >> 1));
        const r0 = 10 + (k >= 4 ? (k - 3) * 6 : 0);
        const r1 = len * reach;
        if (r1 <= r0) continue;
        const steps = 4;
        let prev: P | null = null;
        for (let s = 0; s <= steps; s++) {
          const r = r0 + ((r1 - r0) * s) / steps;
          const j = s === 0 ? 0 : (hash(seed + k, b, s) - 0.5) * 4;
          const x = o.x + Math.cos(a) * r - Math.sin(a) * j;
          const y = o.floor - 1 - Math.sin(a) * r - Math.cos(a) * j;
          const p: P = [Math.round(x), Math.round(Math.min(o.floor - 1, y))];
          if (prev && !(k >= 5 && s % 2 === 0)) line(f, prev, p, col);
          prev = p;
        }
        // 끝에서 튀는 불티 하나 (반구 면 근처)
        if (k >= 1 && k < 5 && prev) put(f, prev[0] + Math.round(Math.cos(a) * 2), prev[1] - Math.round(Math.sin(a) * 2), k < 3 ? C[0]! : C[2]!);
        if (k < 3 && prev) glow(f, prev[0], prev[1], 2, C[2]!, 0.35);
      }
    },
  };
}

/**
 * 전류 방벽 커튼 (월드 px). 살아 있는 동안 sim 상태를 읽는다: x() 방벽 자리, left() 남은 틱 (0이면 사라짐).
 * delay틱 뒤에 3틱 동안 바닥에서 솟는다. flashed()가 참인 틱은 번쩍인다 (튕겨 냄)
 */
export function hwagwasanBarrier(o: {
  x: () => number;
  floor: number;
  h: number;
  left: () => number;
  delay: number;
  flashAt: () => number;
  ramp: readonly number[];
  seed?: number;
}) {
  const C = o.ramp;
  const seed = o.seed ?? 1;
  let t = 0;
  let gone = false;
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  return {
    /** 빛: 보이는가, 밝기, 자리 */
    phase() {
      const k = tickNow();
      const left = o.left();
      const on = !gone && k >= o.delay && left > 0 && !(left <= 12 && k % 2 === 1);
      return { on, flash: k - o.flashAt() < 3, x: o.x(), y: o.floor - o.h * 0.5 };
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
      const k = tickNow();
      if (k < o.delay) return;
      const left = o.left();
      // 마지막 12틱: 빠르게 깜빡이며 사라진다
      if (left <= 12 && k % 2 === 1) return;
      const x0 = o.x();
      const rise = Math.min(1, (k - o.delay + 1) / 3);
      const top = o.floor - o.h * rise;
      const flash = k - o.flashAt() < 3;
      const shape = k >> 1;
      // 줄기 3~4개: 좌우 ±3px 안에서 서로 다른 박자로 흔들리며 얽힌다 (마주치는 자리에 밝은 점)
      const strands = left <= 12 ? 3 : 4;
      const pts: P[][] = [];
      for (let s = 0; s < strands; s++) {
        const ph = hash(seed, s, shape) * Math.PI * 2;
        const fq = 0.09 + 0.05 * s;
        const row: P[] = [];
        for (let y = o.floor - 1; y >= top; y -= 4) {
          const u = (o.floor - y) / o.h;
          const dx = Math.sin(ph + y * fq) * 3 + (hash(seed + s, Math.round(y), shape) - 0.5) * 1.6;
          row.push([Math.round(x0 + dx), Math.round(y - (u > 0.97 ? 0 : 0))]);
        }
        pts.push(row);
      }
      pts.forEach((row, s) => {
        // 줄기마다 가끔 한 박자 꺼진다 (깜빡임)
        if (!flash && hash(seed + 9, s, shape) < 0.18) return;
        const col = flash ? C[0]! : s === 0 ? C[1]! : s === strands - 1 ? C[3]! : C[2]!;
        for (let i = 0; i + 1 < row.length; i++) {
          line(f, row[i]!, row[i + 1]!, col);
          if (i % 3 === 0) glow(f, row[i]![0], row[i]![1], 2, C[2]!, flash ? 0.6 : 0.25);
        }
        // 갈라진 가지: 줄기 중간에서 옆으로 짧게
        if (hash(seed + 5, s, shape) < 0.6 && row.length > 4) {
          const at = row[2 + Math.floor(hash(seed + 6, s, shape) * (row.length - 4))]!;
          const side = hash(seed + 7, s, shape) < 0.5 ? -1 : 1;
          line(f, at, [at[0] + side * 3, at[1] - 2], C[2]!);
          line(f, [at[0] + side * 3, at[1] - 2], [at[0] + side * 4, at[1] - 5], C[3]!);
        }
      });
      // 줄기가 마주치는 자리 (같은 높이에서 x가 같은 곳)에 흰 점
      for (let i = 0; i < (pts[0]?.length ?? 0); i++) {
        const xs = pts.map((r) => r[i]?.[0]);
        if (xs.some((x, a) => xs.some((y, b) => a < b && x !== undefined && x === y))) put(f, pts[0]![i]![0], pts[0]![i]![1], C[0]!);
      }
      // 바닥에 닿은 발치: 젖은 바닥에 작은 불티
      if (k % 3 === 0) put(f, x0 + Math.round((hash(seed, k, 1) - 0.5) * 8), o.floor - 1, C[1]!);
    },
  };
}

/** 밀려나는 두 발이 젖은 바닥을 긁은 자국 두 줄: from에서 지금 발 자리(feet())까지, 30틱 동안 옅어진다 */
export function hwagwasanDrag(o: { from: number; floor: number; feet: () => [number, number]; ramp: readonly number[]; seed?: number }) {
  const C = o.ramp;
  const LIFE = 34;
  let t = 0;
  let last: [number, number] = o.feet();
  const tickNow = () => Math.floor(t / TICK + 1e-6);
  return {
    update(dt: number) {
      t += dt;
      if (tickNow() < 22) last = o.feet();
    },
    done() {
      return tickNow() >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'front') return;
      const k = tickNow();
      const u = k / LIFE;
      const col = u < 0.4 ? C[0]! : u < 0.75 ? C[1]! : C[2]!;
      // 두 줄: 앞발·뒷발 (바닥 위 1px, 2px), 시작점 쪽부터 끊기며 사라진다
      [[last[0], o.floor - 1], [last[1], o.floor - 2]].forEach(([x1, y], n) => {
        const a = Math.min(o.from, x1);
        const b = Math.max(o.from, x1);
        for (let x = Math.round(a); x <= b; x++) {
          const v = (x - a) / Math.max(1, b - a);
          const fromSide = o.from < x1 ? v : 1 - v;
          if (fromSide < u * 1.2) continue;
          if (((x + n * 2) % 5 === 0 && u > 0.3) || ((x + k) % 7 === 0 && u > 0.6)) continue;
          put(f, x, y, col);
        }
      });
    },
  };
}
