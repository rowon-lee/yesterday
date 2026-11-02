// YESTERDAY: 백은우 필살기 '선의' 심상세계 (사용자 피드백 2026-11-02 11-5, 영역 전개형 약 330틱). 렌더 전용, 좌표는 월드 px.
// 시간 T는 필살기 전체 기준 틱 (0~30 발동은 기술 동작, 30부터 연출): 렌더가 sim 연출 장면·틱에서 계산해 넘긴다 (짧은 판은 30~90을 30틱에).
//  30~90  은우 발밑에서 물결 고리가 퍼지며 도시를 겹마다 지운다: 앞겹·바닥 → 아래 건물 → 위 건물 → 하늘 (고리 앞쪽 가장자리는 흰·금빛 줄).
//         지워진 자리는 잔잔한 물과 새벽 하늘. 비가 멎고 빗방울이 빛 먼지가 되어 떠오른다
//  90~130 끝없는 물·옅은 안개·수평선 빛, 백합 봉오리(6×8)가 물 위로 떠오르고 두 사람이 물에 비친다
// 130~200 은우 걸음마다 발밑에 물결
// 200~240 어깨에 손: 20틱 멈춘 뒤 손끝에서 금실이 상대 가슴으로
// 240~290 백합이 상대를 가운데로 안에서 밖으로 동심원을 그리며 피고, 금빛 치유의 빛이 은우를 채운다
// 290~330 세계가 조각마다 흰 나비가 되어 날아가며 도시가 돌아온다
// 색: 새벽 파랑(위 짙게 → 수평선 옅게), 백합 분홍, 흰빛, 금빛. 넓은 면은 단색 띠, 디더는 띠 경계 2px에만.
import type { Frame, Layer } from './impact';
import { drawLily } from './eunwoo-lily';

type P = readonly [number, number];
interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  data: Uint32Array;
}
export interface Options {
  /** 필살기 전체 기준 틱 (연출이 끝났으면 -1) */
  T: () => number;
  /** 은우 발밑·상대 발밑·은우 뒷손 끝 (월드 px) */
  feet: () => P;
  target: () => P;
  hand: () => P;
  /** 두 사람 실루엣 (물에 비친 모습) */
  bodies: () => Body[];
  /** 하늘 [맨 위, 위, 가운데, 아래, 수평선 분홍 짙음, 수평선 분홍, 금빛 줄] */
  sky: readonly number[];
  /** 물 [깊음, 가운데, 수평선 아래, 물결 밝음, 물결 흰] */
  water: readonly number[];
  /** 백합 [흰 꽃잎, 연분홍, 분홍, 짙은 분홍, 금빛 꽃술] */
  lily: readonly number[];
  /** 금빛 [밝음, 바탕], 나비 [흰 날개, 금빛 테두리, 몸] */
  gold: readonly number[];
  fly: readonly number[];
  seed?: number;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 수평선: 발밑 줄에서 이만큼 위 (px) */
const HORIZON = 46;
/** 물결 고리가 퍼지는 빠르기 (px/틱) */
const SPEED = 9;
/** 부서지는 조각 크기 (px) */
const TILE = 12;
const OPEN = ['21012', '11311', '01310', '02020'];
const SHUT = ['02020', '01310', '00300', '00000'];

export default function eunwooMind(o: Options) {
  let r = ((o.seed ?? 1) * 7919 + 3) & 0x7fffffff;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  let lastT = 30;
  let gone = 0;
  /** 백합 봉오리 (상대·은우 사이 가운데 기준 x, 수평선 아래 깊이 0~1) */
  const buds = Array.from({ length: 18 }, (_, i) => ({ dx: (rand() - 0.5) * 300, depth: 0.15 + rand() * 0.8, t0: 92 + i * 2 }));
  /** 빗방울이 바뀐 빛 먼지 (화면 기준 0~1) */
  const dust = Array.from({ length: 70 }, () => ({ x: rand(), y: rand(), p: rand() * 6, v: 0.2 + rand() * 0.4 }));
  /** 치유의 금빛 알갱이 */
  const motes = Array.from({ length: 14 }, () => ({ dx: (rand() - 0.5) * 22, p: rand(), v: 0.4 + rand() * 0.5 }));
  /** 걸음마다 물결 (T) */
  const steps = [137, 154, 171, 188];

  const T = (): number => {
    const t = o.T();
    if (t >= 0) {
      lastT = t;
      gone = 0;
      return t;
    }
    return Math.max(330, lastT) + gone;
  };
  const at = (f: Frame, x: number, y: number): number => {
    x = Math.round(x - f.ox);
    y = Math.round(y - f.oy);
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return -1;
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
    const rr = Math.min(255, (d & 255) + (c & 255) * k);
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
    const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
    f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | rr) >>> 0;
  };
  /** 띠 하나를 고른다: 경계 ±1px만 디더 (bands = [경계 높이…], 색 = bands.length + 1개) */
  const band = (h: number, x: number, y: number, edges: readonly number[], cols: readonly number[]): number => {
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k]!;
      if (h < e - 1) return cols[k]!;
      if (h <= e + 1) {
        const th = (BAYER[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;
        return (h - (e - 1)) / 2 > th ? cols[k + 1]! : cols[k]!;
      }
    }
    return cols[edges.length]!;
  };
  /** 이 자리가 심상세계로 바뀌었는가 (발밑에서 퍼지는 고리, 겹마다 늦게): 고리 앞 가장자리까지의 거리도 */
  const front = (t: number, wx: number, wy: number, fx: number, fy: number): number => {
    const d = Math.hypot(wx - fx, (wy - fy) * 1.6);
    const h = fy - wy;
    const delay = h < -2 ? -4 : h < 8 ? 0 : h < 90 ? 6 + h * 0.08 : 14 + h * 0.06;
    return (t - 30 - delay) * SPEED - d;
  };
  const fly = (f: Frame, x: number, y: number, open: boolean) => {
    const shape = open ? OPEN : SHUT;
    for (let yy = 0; yy < 4; yy++) {
      for (let xx = 0; xx < 5; xx++) {
        const v = shape[yy]![xx]!;
        if (v !== '0') put(f, x - 2 + xx, y - 2 + yy, o.fly[v === '1' ? 0 : v === '2' ? 1 : 2]!);
      }
    }
    glow(f, x, y, o.fly[1]!, 0.35);
  };
  /** 조각 (tx, ty)가 부서지는 T (290~322) */
  const breakAt = (tx: number, ty: number): number => 290 + (((tx * 73856093) ^ (ty * 19349663)) >>> 0) % 32;

  return {
    /** 세계의 밝기 0~1 (렌더 광원) */
    level(): number {
      const t = T();
      if (t < 30) return 0;
      if (t < 90) return (t - 30) / 60;
      if (t < 290) return 1;
      return Math.max(0, 1 - (t - 290) / 40);
    },
    update() {
      if (o.T() < 0) gone++;
    },
    done() {
      return o.T() < 0 && gone > 10;
    },
    draw(f: Frame, layer?: Layer) {
      const t = T();
      if (t < 30 || t > 340) return;
      const [fx, fy] = o.feet();
      const [tx, ty] = o.target();
      const hy = fy - HORIZON;
      const S = o.sky;
      const Wt = o.water;
      // 화면 전체를 덮어 그린다: 합성할 범위를 프레임 전체로
      if (f.box) {
        f.box[0] = 0;
        f.box[1] = 0;
        f.box[2] = f.w - 1;
        f.box[3] = f.h - 1;
      }
      if (layer === 'back') {
        // 화면 전체: 바뀐 자리는 새벽 하늘·물, 고리 앞 가장자리는 흰·금빛 줄
        for (let y = 0; y < f.h; y++) {
          const wy = f.oy + y;
          for (let x = 0; x < f.w; x++) {
            const wx = f.ox + x;
            const fr = front(t, wx, wy, fx, fy);
            if (fr < -1.5) continue;
            const i = y * f.w + x;
            if (fr < 0.5) {
              // 고리 앞 가장자리 (물결 줄)
              f.color[i] = (wy > hy ? Wt[4]! : S[6]!) >>> 0;
              continue;
            }
            // 부서져 나비가 된 조각은 비운다 (도시가 돌아온다)
            if (t >= 290 && t >= breakAt(Math.floor(wx / TILE), Math.floor(wy / TILE))) continue;
            let c: number;
            if (wy < hy) {
              // 새벽 하늘: 수평선 금빛 줄 → 분홍 → 옅은 파랑 → 짙은 파랑
              c = band(hy - wy, wx, wy, [2, 7, 14, 30, 64, 120], [S[6]!, S[5]!, S[4]!, S[3]!, S[2]!, S[1]!, S[0]!]);
            } else {
              // 물: 수평선 아래 옅은 분홍 반사 → 파랑 → 깊은 파랑, 가로 물결 줄
              const dd = wy - hy;
              c = band(dd, wx, wy, [2, 12, 40], [S[5]!, Wt[2]!, Wt[1]!, Wt[0]!]);
              const wave = Math.sin(wx * 0.11 + dd * 0.9 - t * 0.12) + Math.sin(wx * 0.037 - t * 0.05 + dd * 0.4);
              if (dd > 2 && wave > 1.55 - Math.min(0.5, 6 / (dd + 2))) c = dd < 14 ? Wt[4]! : Wt[3]!;
            }
            f.color[i] = c >>> 0;
            // 뒤따르는 물결 고리 (물 위, 앞 가장자리 뒤로 두 겹)
            if (wy > hy + 1 && t < 110) {
              const ring = fr % 28;
              if (fr > 4 && ring < 1) f.color[i] = Wt[3]! >>> 0;
            }
          }
        }
        if (t < 90) return;
        // 두 사람이 물에 비친다 (발밑 줄 아래로 뒤집어, 물빛으로 어둡게, 물결에 흔들림)
        for (const b of o.bodies()) {
          const base = b.y + b.h;
          for (let yy = b.h - 1; yy >= 0; yy--) {
            const ry = base + (b.h - 1 - yy) - 3;
            const depth = ry - (base - 3);
            if (depth > 26 || (depth > 10 && depth % 2 === 1)) continue;
            const shift = Math.round(Math.sin(depth * 0.7 + t * 0.15) * Math.min(2, depth / 6));
            for (let xx = 0; xx < b.w; xx++) {
              const v = b.data[yy * b.w + xx]!;
              if (v >>> 24 < 128) continue;
              const lum = (v & 255) * 0.3 + ((v >>> 8) & 255) * 0.59 + ((v >>> 16) & 255) * 0.11;
              put(f, b.x + xx + shift, ry, lum > 150 ? Wt[3]! : lum > 70 ? Wt[2]! : Wt[1]!);
            }
          }
        }
        // 걸음마다 물결
        for (const st of steps) {
          const a = t - st;
          if (a < 0 || a > 30 || t > 200) continue;
          const sx = fx;
          const rx = 4 + a * 1.1;
          for (let k = 0; k < 40; k++) {
            const an = (k / 40) * Math.PI * 2;
            if (Math.sin(an) < -0.2) continue;
            put(f, sx + Math.cos(an) * rx, fy + 1 + Math.sin(an) * rx * 0.28, a < 15 ? Wt[4]! : Wt[3]!);
          }
        }
        return;
      }
      // ---- 앞 겹: 빛 먼지, 백합, 금실, 치유의 빛, 나비 ----
      if (t < 120) {
        // 비가 멎고 빗방울이 빛 먼지가 되어 천천히 떠오른다
        for (const d of dust) {
          const x = f.ox + d.x * f.w;
          const y = f.oy + ((d.y * f.h - (t - 30) * d.v) % f.h + f.h) % f.h;
          if (front(t, x, y, fx, fy) < 0) continue;
          const tw = Math.sin(d.p + t * 0.3) > 0.2;
          put(f, x, y, tw ? o.fly[0]! : o.gold[0]!);
          glow(f, x, y, o.gold[0]!, tw ? 0.4 : 0.15);
        }
      }
      const mid = (fx + tx) / 2;
      // 백합 봉오리가 떠오르고, 240틱부터 상대를 가운데로 안에서 밖으로 핀다
      for (const b of buds) {
        if (t < b.t0 || t >= 300) continue;
        const bx = mid + b.dx;
        const by = fy + 2 + b.depth * 18;
        const rise = Math.min(1, (t - b.t0) / 10);
        const dist = Math.hypot(bx - tx, (by - ty) * 2);
        const bloom = t < 240 ? 0 : Math.max(0, Math.min(1, (t - 240 - dist * 0.25) / 12));
        if (bloom > 0.15) drawLily({ put: (x, y, c) => put(f, x, y, c), glow: (x, y, c, k) => glow(f, x, y, c, k) }, bx, by, bloom, o.lily, 0.35);
        else {
          // 봉오리 6×8: 흰 끝, 분홍 몸, 짧은 줄기
          const y0 = Math.round(by - 7 + (1 - rise) * 6);
          const x0 = Math.round(bx) - 3;
          const BUD = ['..00..', '.0110.', '.1121.', '.1221.', '..22..', '...3..', '...3..', '...3..'];
          BUD.forEach((row, yy) => {
            for (let xx = 0; xx < 6; xx++) {
              const v = row[xx]!;
              if (v === '.' || y0 + yy > by + 1) continue;
              put(f, x0 + xx, y0 + yy, v === '0' ? o.lily[0]! : v === '1' ? o.lily[1]! : v === '2' ? o.lily[2]! : Wt[2]!);
            }
          });
          glow(f, bx, by - 5, o.lily[1]!, 0.25 * rise);
        }
      }
      // 백합 동심원: 상대 둘레에 고리마다 차례로 (안에서 밖으로)
      if (t >= 244 && t < 300) {
        for (let k = 0; k < 4; k++) {
          const t0 = 244 + k * 10;
          if (t < t0) break;
          const n = 4 + k * 4;
          const rad = 10 + k * 14;
          for (let m = 0; m < n; m++) {
            const an = (m / n) * Math.PI * 2 + k * 0.4;
            const x = tx + Math.cos(an) * rad;
            const y = ty + 2 + Math.sin(an) * rad * 0.25;
            drawLily({ put: (xx, yy, c) => put(f, xx, yy, c), glow: (xx, yy, c, kk) => glow(f, xx, yy, c, kk) }, x, y, Math.min(1, (t - t0) / 10), o.lily, 0.3);
          }
        }
      }
      // 어깨에 손: 20틱 멈춘 뒤 손끝에서 금실이 상대 가슴으로 이어진다
      if (t >= 220 && t < 296) {
        const [hx, hy2] = o.hand();
        const cx = tx;
        const cy = ty - 30;
        const u = Math.min(1, (t - 220) / 10);
        const n = 24;
        for (let k = 0; k <= n * u; k++) {
          const s = k / n;
          const x = hx + (cx - hx) * s;
          const y = hy2 + (cy - hy2) * s - Math.sin(s * Math.PI) * 6;
          put(f, x, y, k % 6 === Math.floor(t / 2) % 6 ? o.gold[0]! : o.gold[1]!);
          glow(f, x, y, o.gold[0]!, 0.5);
        }
      }
      // 금빛 치유의 빛이 은우를 채운다 (240~290): 몸 둘레 빛과 떠오르는 금빛 알갱이
      if (t >= 240 && t < 300) {
        const k = Math.min(1, (t - 240) / 30) * (t > 290 ? Math.max(0, 1 - (t - 290) / 10) : 1);
        for (let yy = 0; yy < 56; yy += 2) {
          for (let xx = -10; xx <= 10; xx += 2) glow(f, fx + xx, fy - yy, o.gold[0]!, 0.16 * k * (1 - Math.abs(xx) / 11));
        }
        for (const m of motes) {
          const y = fy - ((m.p * 60 + (t - 240) * m.v * 1.5) % 60);
          put(f, fx + m.dx, y, o.gold[0]!);
          glow(f, fx + m.dx, y, o.gold[0]!, 0.5 * k);
        }
      }
      // 세계가 조각마다 흰 나비가 되어 위로 날아간다 (6조각에 한 마리)
      if (t >= 290) {
        const x0 = Math.floor(f.ox / TILE);
        const y0 = Math.floor(f.oy / TILE);
        for (let ty2 = y0; ty2 <= y0 + Math.ceil(f.h / TILE); ty2++) {
          for (let tx2 = x0; tx2 <= x0 + Math.ceil(f.w / TILE); tx2++) {
            if (((tx2 * 7 + ty2 * 13) >>> 0) % 6 !== 0) continue;
            const a = t - breakAt(tx2, ty2);
            if (a < 0 || a > 24) continue;
            const x = tx2 * TILE + 6 + Math.sin(a * 0.4 + tx2) * 3;
            const y = ty2 * TILE + 6 - a * 1.6;
            fly(f, x, y, ((t + tx2) >> 2) % 2 === 0);
          }
        }
      }
    },
  };
}
