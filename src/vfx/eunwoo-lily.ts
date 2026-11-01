// YESTERDAY: 백은우 백합 — 낙인(가슴의 작은 백합이 은은히 빛남), 방어막(타격을 막아 내는 연분홍 막이 깨지며 꽃잎이 흩날림),
// 백합 핌(필살기 심상세계 물 위에 피는 꽃). 렌더 전용, 2단위 = 1px. 색: [흰 꽃잎, 연분홍, 분홍, 짙은 분홍, 금빛 꽃술, 잎 초록]
import type { Frame, Layer } from './impact';

type P = readonly [number, number];
const PX = 2;

interface Px {
  put(x: number, y: number, c: number): void;
  glow(x: number, y: number, c: number, k: number): void;
}
function pen(f: Frame): Px {
  const at = (x: number, y: number): number => {
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
  return {
    put(x, y, c) {
      const i = at(x, y);
      if (i >= 0) f.color[i] = c >>> 0;
    },
    glow(x, y, c, k) {
      const i = at(x, y);
      if (i < 0 || k <= 0) return;
      const d = f.light[i]!;
      const r = Math.min(255, (d & 255) + (c & 255) * k);
      const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
      const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
      f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
    },
  };
}

/** 백합 한 송이 (위에서 본 꽃이 아니라 옆에서 본 나팔 모양): size 0~1로 피어난다 */
export function drawLily(p: Px, x: number, y: number, size: number, C: readonly number[], glow = 0.4): void {
  x = Math.round(x);
  y = Math.round(y);
  if (size <= 0.15) {
    // 꽃봉오리
    p.put(x, y, C[2]!);
    p.put(x, y - 1, C[1]!);
    return;
  }
  const big = size > 0.6;
  // 가운데 꽃잎 (위로), 양옆 꽃잎 (바깥으로 젖혀짐), 꽃술
  p.put(x, y, C[1]!);
  p.put(x, y - 1, C[0]!);
  if (big) p.put(x, y - 2, C[0]!);
  p.put(x - 1, y, C[0]!);
  p.put(x + 1, y, C[0]!);
  p.put(x - 2, y - 1, C[0]!);
  p.put(x + 2, y - 1, C[0]!);
  if (big) {
    p.put(x - 3, y - 2, C[1]!);
    p.put(x + 3, y - 2, C[1]!);
    p.put(x - 1, y + 1, C[2]!);
    p.put(x + 1, y + 1, C[2]!);
  }
  p.put(x, y + 1, C[3]!);
  p.put(x, y - (big ? 3 : 2), C[4]!);
  for (let d = -3; d <= 3; d++) p.glow(x + d, y - 1, C[1]!, glow * (1 - Math.abs(d) / 4));
}

/** 낙인: 가슴에 작은 백합이 은은히 빛난다 (살아 있는 동안 at()을 따라간다) */
export function lilyMark(o: { at: () => P | null; alive: () => boolean; ramp: readonly number[] }) {
  let t = 0;
  let dead = -1;
  return {
    update(dt: number) {
      t += dt;
      if (dead < 0 && !o.alive()) dead = t;
    },
    done() {
      return dead >= 0 && t - dead > 0.1;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back' || dead >= 0) return;
      const a = o.at();
      if (!a) return;
      const p = pen(f);
      // 숨 쉬듯 밝아졌다 어두워진다
      const pulse = 0.25 + 0.2 * Math.sin(t * 5);
      drawLily(p, a[0] / PX, a[1] / PX, 0.5, o.ramp, pulse);
    },
  };
}

/** 방어막: 맞은 자리 앞에 연분홍 막(꽃잎 모양 반원)이 번쩍 생겼다가 깨지며 꽃잎이 흩날린다 */
export function lilyShield(o: { x: number; y: number; facing: number; ramp: readonly number[]; seed?: number }) {
  const C = o.ramp;
  const LIFE = 0.5;
  let t = 0;
  let r = ((o.seed ?? 1) * 7919 + 7) & 0x7fffffff;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  const cx = o.x / PX;
  const cy = o.y / PX;
  const petals = Array.from({ length: 14 }, () => {
    const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.2;
    return { a, sp: 30 + rand() * 50, spin: rand() * 6, x: 0, y: 0 };
  });
  return {
    phase(): { k: number; c: [number, number] } {
      return { k: Math.max(0, 1 - t / LIFE), c: [cx, cy] };
    },
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const p = pen(f);
      // 막 (처음 0.12초): 몸 앞에 세로로 선 반원 껍질, 바깥 1px 흰 테, 안은 성긴 연분홍
      if (t < 0.12) {
        const k = 1 - t / 0.12;
        for (let a = -80; a <= 80; a += 4) {
          const rr = (a * Math.PI) / 180;
          const x = cx + o.facing * Math.cos(rr) * 10;
          const y = cy + Math.sin(rr) * 22;
          p.put(x, y, C[0]!);
          if ((a / 4) % 2 === 0) p.put(x - o.facing, y, C[1]!);
          p.glow(x, y, C[1]!, 0.7 * k);
          p.glow(x - o.facing * 2, y, C[1]!, 0.4 * k);
        }
        // 백합 문양
        drawLily(p, cx + o.facing * 6, cy, 1, C, 0.8 * k);
      }
      // 깨진 꽃잎이 흩날리며 떨어진다
      const u = t / LIFE;
      for (const pt of petals) {
        const d = pt.sp * t;
        const x = cx + o.facing * Math.cos(pt.a) * d * 0.6 + o.facing * 8;
        const y = cy + Math.sin(pt.a) * d * 0.4 + 60 * t * t;
        const c = u < 0.5 ? C[0]! : C[1]!;
        p.put(x, y, c);
        if (Math.sin(pt.spin + t * 20) > 0) p.put(x + 1, y, C[2]!);
      }
    },
  };
}
