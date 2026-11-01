// YESTERDAY: 차지 단계가 오를 때 '캉!' 하고 한 번 반짝이는 빛 (Sprite Fusion 이펙트와 같은 구조로 새로 만듦, 렌더 전용).
// 첫 틱에 가장 크게 십자로 번쩍였다가 빠르게 줄어들고, 둘레에 얇은 고리가 한 번 퍼지며 사라진다.
// 좌표는 다른 이펙트처럼 2단위 = 1px (x, y는 월드 px × 2). 색은 부르는 쪽이 우리 팔레트로 넘긴다 (밝은 → 어두운).
import type { Frame, Layer } from './impact';

export interface Options {
  x: number;
  y: number;
  /** 크기 배율 (십자 팔 길이·고리 반지름) */
  size?: number;
  /** 색 (0xAABBGGRR, 밝은 → 어두운). 가운데 흰빛 → 팔 끝 주황 */
  ramp?: readonly number[];
}

const PX = 2;
/** 전체 길이(초). 첫 HOLD초는 가장 큰 채로 (캉!), 그 뒤 STAR초 안에 줄어든다. 고리는 RING0~RING1초 */
const LIFE = 0.26;
const HOLD = 0.034;
const STAR = 0.13;
const RING0 = 0.02;
const RING1 = 0.22;

export default function glint(o: Options) {
  const cx = Math.round(o.x / PX);
  const cy = Math.round(o.y / PX);
  const S = o.size ?? 1;
  const C = o.ramp ?? [0xffffffff, 0xffa6f3ff, 0xff6be2ff, 0xff2a8aff];
  /** 십자 둘레 테두리 (밝은 배경에서도 십자가 갈라져 보이게) */
  const EDGE = C[C.length - 1]!;
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
  /** a: 0~1 (그리는 층이 디더링으로 바꾼다). 이미 더 진한 칸은 덮지 않는다 */
  const put = (f: Frame, x: number, y: number, c: number, a: number) => {
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
    const b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
    f.light[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  };
  /** 가운데에서 d만큼 떨어진 칸의 색: 가운데 흰빛, 팔 끝으로 갈수록 주황 */
  const tint = (d: number, len: number) => C[Math.min(C.length - 2, Math.floor((d / Math.max(1, len)) * (C.length - 1)))]!;
  /** 팔 하나 (dx, dy 방향). 안쪽은 굵게(가운데 줄 + 양옆 테두리), 끝으로 갈수록 가늘고 옅게 */
  const arm = (f: Frame, dx: number, dy: number, len: number) => {
    const bold = Math.round(len * 0.45);
    for (let d = 1; d <= len; d++) {
      const x = cx + dx * d;
      const y = cy + dy * d;
      put(f, x, y, tint(d, len), d <= bold ? 1 : 1 - ((d - bold) / (len - bold + 1)) * 0.55);
      if (d <= bold) {
        put(f, x + dy, y + dx, d < bold * 0.5 ? C[1]! : EDGE, 1);
        put(f, x - dy, y - dx, d < bold * 0.5 ? C[1]! : EDGE, 1);
      }
    }
  };

  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      // 십자: 첫 두 틱은 가장 크게 (캉!), 그 뒤 빠르게 줄어든다
      if (t < HOLD + STAR) {
        const k = t < HOLD ? 1 : 1 - (t - HOLD) / STAR;
        const len = Math.round((8 + 12 * S) * k * k + 2);
        arm(f, 1, 0, len);
        arm(f, -1, 0, len);
        arm(f, 0, 1, Math.round(len * 0.8));
        arm(f, 0, -1, Math.round(len * 0.8));
        // 가운데 덩어리 (3×3 흰빛, 둘레 테두리)
        for (let y = -2; y <= 2; y++) {
          for (let x = -2; x <= 2; x++) {
            const edge = Math.abs(x) === 2 || Math.abs(y) === 2;
            if (edge && Math.abs(x) + Math.abs(y) > 3) continue;
            put(f, cx + x, cy + y, edge ? C[1]! : C[0]!, 1);
          }
        }
        // 대각선 짧은 빛살
        const diag = Math.round(len * 0.35);
        for (let d = 3; d <= diag; d++) {
          for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) put(f, cx + sx * d, cy + sy * d, tint(d * 2, len), 0.8);
        }
        // 둘레에 퍼지는 빛 (빛 층: 밝기만큼 성기게 찍힌다)
        const r = Math.round(len * 0.8);
        for (let y = -r; y <= r; y++) {
          for (let x = -r; x <= r; x++) {
            const q = Math.hypot(x, y) / Math.max(1, r);
            if (q < 1) glow(f, cx + x, cy + y, C[1]!, (1 - q) * (1 - q) * 0.8 * k);
          }
        }
      }
      // 고리: 한 번 퍼지며 옅어진다 (1px 테)
      if (t > RING0 && t < RING1) {
        const u = (t - RING0) / (RING1 - RING0);
        const rr = 4 + (12 + 8 * S) * (1 - (1 - u) * (1 - u));
        const a = 0.95 * (1 - u * u);
        const c = C[Math.min(C.length - 1, 1 + Math.floor(u * (C.length - 1)))]!;
        const n = Math.max(12, Math.round(rr * 6.3));
        let px = NaN;
        let py = NaN;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(ang) * rr);
          const y = Math.round(cy + Math.sin(ang) * rr);
          if (x === px && y === py) continue;
          put(f, x, y, c, a);
          px = x;
          py = y;
        }
      }
    },
  };
}
