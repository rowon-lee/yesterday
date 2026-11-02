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

/** 낙인 문양 7×7 (11-4): 1 = 분홍 꽃잎, 2 = 흰 심, 3 = 밝은 꽃잎 끝 */
const MARK = ['...3...', '.3.1.3.', '..121..', '3122213', '..121..', '.3.1.3.', '...3...'];

/** 낙인 (11-4): 가슴에 7×7 백합 문양 (분홍 꽃잎, 흰 심)이 은은히 빛난다 (살아 있는 동안 at()을 따라간다). ramp = [흰, 연분홍, 분홍, 짙은 분홍, 금빛] */
export function lilyMark(o: { at: () => P | null; alive: () => boolean; ramp: readonly number[] }) {
  let t = 0;
  let dead = -1;
  return {
    update(dt: number) {
      t += dt;
      if (dead < 0 && !o.alive()) dead = t;
    },
    done() {
      return dead >= 0;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back' || dead >= 0) return;
      const a = o.at();
      if (!a) return;
      const p = pen(f);
      const x0 = Math.round(a[0] / PX) - 3;
      const y0 = Math.round(a[1] / PX) - 3;
      // 숨 쉬듯 밝아졌다 어두워진다
      const pulse = 0.3 + 0.15 * Math.sin(t * 4);
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const v = MARK[y]![x]!;
          if (v === '.') continue;
          p.put(x0 + x, y0 + y, o.ramp[v === '1' ? 2 : v === '2' ? 0 : 1]!);
        }
      }
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const d = Math.hypot(dx, dy);
          if (d <= 5) p.glow(x0 + 3 + dx, y0 + 3 + dy, o.ramp[1]!, pulse * (1 - d / 5.5));
        }
      }
    },
  };
}

/**
 * 백합 방어막 (11-4): 몸을 둘러싼 36×60 타원. 1px 분홍 테두리에 백합 꽃잎 마디 5개가 천천히 돌고, 안은 아주 옅게 비치며
 * 테두리 위에서 반짝임 두세 개가 깜빡인다. 테두리는 몸 뒤 겹, 마디는 앞쪽 반 바퀴만 앞 겹 (흑백으로 봐도 테두리가 보이는 밝기)
 */
export function lilyAura(o: { center: () => P | null; alive: () => boolean; ramp: readonly number[] }) {
  let t = 0;
  let tick = 0;
  let dead = false;
  const RX = 18;
  const RY = 30;
  return {
    phase(): { k: number; c: [number, number] } {
      const c = o.center();
      return { k: dead ? 0 : 1, c: c ? [c[0] / PX, c[1] / PX] : [0, 0] };
    },
    update(dt: number) {
      t += dt;
      tick++;
      if (!o.alive()) dead = true;
    },
    done() {
      return dead;
    },
    draw(f: Frame, layer?: Layer) {
      if (dead) return;
      const c = o.center();
      if (!c) return;
      const p = pen(f);
      const cx = c[0] / PX;
      const cy = c[1] / PX;
      const C = o.ramp;
      if (layer === 'back') {
        // 테두리 1px (위·앞쪽이 조금 더 밝다)
        const n = 160;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = cx + Math.cos(a) * RX;
          const y = cy + Math.sin(a) * RY;
          p.put(x, y, C[Math.sin(a) < -0.3 ? 1 : 2]!);
          if (k % 3 === 0) p.glow(x, y, C[1]!, 0.18);
        }
        // 안은 아주 옅게 (빛만)
        for (let y = -RY + 1; y < RY; y += 1) {
          const w = RX * Math.sqrt(Math.max(0, 1 - (y / RY) ** 2));
          for (let x = -Math.floor(w) + 1; x < w; x += 2) p.glow(cx + x + (y & 1), cy + y, C[1]!, 0.035);
        }
      }
      // 꽃잎 마디 5개: 천천히 돌고, 앞쪽 반 바퀴(아래로 지나는 쪽)는 앞 겹
      for (let k = 0; k < 5; k++) {
        const a = t * 0.9 + (k / 5) * Math.PI * 2;
        const front = Math.cos(a * 0.5 + k) > 0;
        if ((layer === 'back') === front) continue;
        const x = Math.round(cx + Math.cos(a) * RX);
        const y = Math.round(cy + Math.sin(a) * RY);
        p.put(x, y - 1, C[0]!);
        p.put(x - 1, y, C[1]!);
        p.put(x + 1, y, C[1]!);
        p.put(x, y, C[2]!);
        p.put(x, y + 1, C[3]!);
        p.glow(x, y, C[1]!, 0.45);
      }
      // 반짝임 두세 개 (10틱마다 자리를 바꿔 깜빡인다)
      if (layer !== 'back') {
        for (let k = 0; k < 3; k++) {
          const seed = Math.floor(tick / 10) * 7 + k * 13;
          if ((tick + k * 4) % 10 > 6) continue;
          const a = ((seed * 37) % 360) * (Math.PI / 180);
          const x = cx + Math.cos(a) * RX;
          const y = cy + Math.sin(a) * RY;
          p.put(x, y, C[0]!);
          p.put(x + 1, y, C[0]!);
          p.put(x, y - 1, C[0]!);
          p.glow(x, y, C[0]!, 0.6);
        }
      }
    },
  };
}

/**
 * 방어막이 깨짐 (11-4): 맞은 쪽 테두리에서 꽃잎 조각이 바깥으로 흩어지며 떨어지고 (14틱), 흰 고리 섬광 한 번 (6틱).
 * cx·cy: 타원 가운데 (2단위), side: 때린 쪽 (+1 오른쪽)
 */
export function lilyShield(o: { x: number; y: number; facing: number; ramp: readonly number[]; seed?: number }) {
  const C = o.ramp;
  const LIFE = 14 / 60;
  const RING = 6 / 60;
  const RX = 18;
  const RY = 30;
  let t = 0;
  let r = ((o.seed ?? 1) * 7919 + 7) & 0x7fffffff;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  const cx = o.x / PX;
  const cy = o.y / PX;
  // 맞은 쪽 테두리 ±60° 위의 조각들: 바깥(테두리 법선) 쪽으로 튀어 나간다
  const petals = Array.from({ length: 16 }, () => {
    const a = (o.facing > 0 ? 0 : Math.PI) + (rand() - 0.5) * (Math.PI * 2 / 3);
    const x = Math.cos(a) * RX;
    const y = Math.sin(a) * RY;
    const n = Math.hypot(Math.cos(a) / RX, Math.sin(a) / RY);
    const nx = Math.cos(a) / RX / n;
    const ny = Math.sin(a) / RY / n;
    const sp = 40 + rand() * 70;
    return { x, y, vx: nx * sp, vy: ny * sp - 20, spin: rand() * 6, big: rand() < 0.4 };
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
      // 흰 고리 섬광: 테두리에서 바깥으로 6px 퍼지며 옅어진다
      if (t < RING) {
        const u = t / RING;
        const g = 1 + u * 0.25;
        for (let k = 0; k < 160; k++) {
          const a = (k / 160) * Math.PI * 2;
          const x = cx + Math.cos(a) * RX * g;
          const y = cy + Math.sin(a) * RY * g;
          if (u < 0.6 || k % 2 === 0) p.put(x, y, C[0]!);
          p.glow(x, y, C[0]!, 0.8 * (1 - u));
        }
      }
      // 꽃잎 조각이 흩어지며 떨어진다 (처음엔 흰빛, 갈수록 분홍)
      const u = t / LIFE;
      for (const pt of petals) {
        const x = cx + pt.x + pt.vx * t;
        const y = cy + pt.y + pt.vy * t + 120 * t * t;
        const c = u < 0.35 ? C[0]! : u < 0.7 ? C[1]! : C[2]!;
        p.put(x, y, c);
        if (pt.big || Math.sin(pt.spin + t * 30) > 0) p.put(x + 1, y, C[2]!);
        if (pt.big) p.put(x, y + 1, C[3]!);
        if (u < 0.5) p.glow(x, y, C[1]!, 0.4);
      }
    },
  };
}
