// YESTERDAY: 백은우 연검 궤적 — 은빛 리본 (동작연출지침서 5장·7장 '은빛 띠, 끝이 휘어지며 가늘어짐', 렌더 전용).
// Sprite Fusion 이펙트와 같은 구조(update·draw·done, 2단위 = 1px)로 새로 만들었다.
// - 칼끝이 지난 궤적(꼬리 → 앞끝)을 따라 리본이 펼쳐진다: 처음 2틱 동안 꼬리에서 앞끝까지 채찍처럼 쏘아 나가고(연검이 늘어남),
//   잠깐 머문 뒤 꼬리부터 걷힌다. 앞끝은 궤적이 휘던 쪽으로 더 감기며 가늘어진다 (리본 끝이 말린다).
// - 굵기: 꼬리 1px → 앞쪽 85% 자리에서 가장 굵고(대표 6~10px) → 말린 끝 1px. 바깥 가장자리에 흰 심 1px, 몸은 은빛, 안쪽은 회청.
// - 리본처럼 물결치며(가는 사인 물결이 앞으로 흐른다) 금색 실 반짝임이 몇 점 따라 흐른다 (은우의 금색 실).
// - 맞으면 rewind()로 가장 크게 펼친 순간으로 되돌리고, 히트스톱 동안(held) 멈춘다.
// 색은 부르는 쪽이 넘긴다: [흰 심, 밝은 은빛, 은빛, 회청, 어두운 회청, 금색 반짝임]
import type { Frame, Layer } from './impact';

export interface Options {
  /** 궤적 (2단위, 꼬리 → 앞끝). 몇 개 점이면 되고 매끈한 곡선(캣멀-롬)으로 잇는다 */
  path: ReadonlyArray<readonly [number, number]>;
  /** 가장 굵은 곳 (px) */
  width?: number;
  /** 앞끝이 말리는 길이 (px)와 각도 (도) */
  curl?: number;
  curlDeg?: number;
  /** 사라지기까지 (틱) */
  ticks?: number;
  ramp?: readonly number[];
  seed?: number;
  /** 히트스톱으로 멈춰 있는가 */
  held?: () => boolean;
}

const PX = 2;
/** 앞끝이 꼬리에서 끝까지 쏘아 나가는 시간, 다 펼친 채 머무는 시간 (초) */
const REVEAL = 2 / 60;
const HOLD = 5 / 60;

type P = [number, number];
interface Pt {
  x: number;
  y: number;
  nx: number;
  ny: number;
  u: number;
}

/** 캣멀-롬 곡선을 1px 간격 점으로 */
function dense(ctrl: readonly P[]): P[] {
  const pts = ctrl.length >= 2 ? ctrl : [ctrl[0]!, [ctrl[0]![0] + 1, ctrl[0]![1]] as P];
  const out: P[] = [];
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
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** 점들을 길이 1px마다 다시 찍고 법선·비율을 붙인다 */
function resample(src: readonly P[]): Pt[] {
  const len: number[] = [0];
  let total = 0;
  for (let i = 1; i < src.length; i++) len.push((total += Math.hypot(src[i]![0] - src[i - 1]![0], src[i]![1] - src[i - 1]![1])));
  const n = Math.max(2, Math.round(total));
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (total * k) / n;
    while (j < len.length - 2 && len[j + 1]! < s) j++;
    const a = src[j]!;
    const b = src[j + 1] ?? a;
    const l = Math.max(1e-6, len[j + 1]! - len[j]!);
    const t = Math.max(0, Math.min(1, (s - len[j]!) / l));
    const tx = (b[0] - a[0]) / l;
    const ty = (b[1] - a[1]) / l;
    out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -ty, ny: tx, u: k / n });
  }
  return out;
}

export default function eunwooRibbon(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xffe8dcd9, 0xffbab5b3, 0xff82746e, 0xff4a3c38, 0xff4ab8e8];
  const W = o.width ?? 8;
  const life = (o.ticks ?? 12) / 60;
  // 궤적 + 앞끝 말림: 마지막 방향을 궤적이 휘던 쪽으로 계속 돌리며 curl px 더 간다
  const base = dense(o.path.map(([x, y]) => [x / PX, y / PX] as P));
  const pts: Pt[] = (() => {
    const m = base.length;
    const a0 = base[Math.max(0, m - 6)]!;
    const a1 = base[m - 1]!;
    let dir = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
    // 휘던 쪽: 처음 방향과 끝 방향의 외적 부호 (곧으면 아래로 처지는 쪽)
    const b0 = base[0]!;
    const b1 = base[Math.min(m - 1, 6)]!;
    const cross = (b1[0] - b0[0]) * (a1[1] - a0[1]) - (b1[1] - b0[1]) * (a1[0] - a0[0]);
    const side = Math.abs(cross) < 1 ? (Math.cos(dir) >= 0 ? 1 : -1) : Math.sign(cross);
    const curl = o.curl ?? 10;
    const turn = ((o.curlDeg ?? 110) * Math.PI) / 180;
    const ext: P[] = [...base];
    let [x, y] = a1;
    const steps = Math.max(2, Math.round(curl));
    for (let k = 1; k <= steps; k++) {
      dir += (side * turn) / steps;
      x += Math.cos(dir);
      y += Math.sin(dir);
      ext.push([x, y]);
    }
    return resample(ext);
  })();
  const L = pts.length;
  // 말림이 시작하는 자리 (비율)
  const curlU = Math.max(0.5, 1 - (o.curl ?? 10) / Math.max(1, L));
  /** 반폭: 꼬리 0.5 → 말림 앞에서 가장 굵고 → 말린 끝 0.5 */
  const half = (u: number) => {
    const p = u < curlU ? Math.pow(u / curlU, 1.4) : Math.pow(Math.max(0, 1 - (u - curlU) / (1 - curlU)), 0.9);
    return Math.max(0.5, (W / 2) * p);
  };
  // 금색 실 반짝임: 리본 위를 앞으로 흐르는 점 몇 개 (자리는 시드로)
  let r = ((o.seed ?? 1) * 7919 + 13) & 0x7fffffff;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  const glints = Array.from({ length: 4 }, () => ({ u: 0.2 + rand() * 0.6, side: rand() * 2 - 1, speed: 0.6 + rand() * 0.8 }));
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
    const rr = Math.min(255, (d & 255) + (c & 255) * k);
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
    const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
    f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | rr) >>> 0;
  };

  return {
    /** 맞힌 순간: 다 펼친 순간으로 되돌린다 (히트스톱 동안 이 모습으로 멈춘다) */
    rewind() {
      t = REVEAL;
    },
    /** 빛을 내는 쪽이 쓴다: 리본 가운데·앞끝 자리(px)와 밝기 0~1 */
    phase(): { k: number; pts: Array<[number, number]> } {
      const k = t < HOLD ? 1 : Math.max(0, 1 - (t - HOLD) / (life - HOLD));
      const sel = [pts[Math.floor(L * 0.45)]!, pts[Math.floor(L * 0.85)]!].map((q) => [q.x, q.y] as [number, number]);
      return { k, pts: sel };
    },
    update(dt: number) {
      if (o.held?.() && t >= REVEAL && t < HOLD) return;
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const lead = Math.min(1, (t + 1 / 60) / REVEAL);
      const fade = t < HOLD ? 0 : (t - HOLD) / (life - HOLD);
      // 걷힘: 꼬리부터 (보이는 구간이 앞끝 쪽으로 줄어든다), 굵기도 조금 줄어든다
      const tail = Math.pow(fade, 0.85);
      const thin = 1 - 0.45 * fade;
      for (let i = 0; i < L; i++) {
        const q = pts[i]!;
        if (q.u > lead) break;
        if (q.u < tail) continue;
        // 리본 물결: 가는 사인 물결이 앞으로 흐른다
        const wave = Math.sin(q.u * 14 - t * 40) * 0.6 * Math.min(1, q.u * 4);
        const h = half(q.u) * thin;
        const cx = q.x + q.nx * wave;
        const cy = q.y + q.ny * wave;
        const n = Math.ceil(h);
        for (let d = -n; d <= n; d++) {
          if (Math.abs(d) > h + 0.25) continue;
          // 바깥(+) 가장자리 1px 흰 심 → 은빛 몸 → 안쪽(−) 회청 가장자리
          const k = (d + h) / Math.max(1, 2 * h);
          const c = d >= Math.floor(h) ? C[0]! : k > 0.55 ? C[1]! : k > 0.2 ? C[2]! : C[3]!;
          put(f, cx + q.nx * d, cy + q.ny * d, fade > 0.75 && d < 0 ? C[4]! : c);
        }
        if (i % 2 === 0) for (let d = -n - 2; d <= n + 2; d++) glow(f, cx + q.nx * d, cy + q.ny * d, C[1]!, 0.32 * (1 - fade));
      }
      // 금색 실 반짝임 (펼쳐진 동안)
      if (fade < 0.6) {
        for (const g of glints) {
          const u = Math.min(0.97, g.u + t * g.speed);
          if (u > lead || u < tail) continue;
          const q = pts[Math.min(L - 1, Math.floor(u * (L - 1)))]!;
          const d = g.side * half(u) * 0.6;
          put(f, q.x + q.nx * d, q.y + q.ny * d, C[5]!);
          glow(f, q.x + q.nx * d, q.y + q.ny * d, C[5]!, 0.5);
        }
      }
    },
  };
}
