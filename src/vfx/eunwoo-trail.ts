// YESTERDAY: 백은우 연검 궤적 (사용자 피드백 2026-11-02 11-2: "궤적 이펙트는 리본 자체를 따라간다. 은빛 띠 + 금실 한 줄, 따로 그린 반원 없음").
// 렌더가 틱마다 그 순간 리본 점 10개(월드 px)를 넣어 주면, 지난 몇 틱의 리본 사이를 은빛 띠로 메운다 (최근일수록 밝게: 흰 심 → 은빛 → 회청)
// 그리고 칼끝이 지난 길을 금실 한 줄로 긋는다. 리본이 들어오지 않으면 오래된 쪽부터 사라진다. 렌더 전용.
import type { Frame, Layer } from './impact';

type P = readonly [number, number];

export interface Options {
  /** 띠 색 [가장 밝은 심, 밝은 은빛, 은빛, 어두운 은빛], 금실 [밝음, 바탕] (ABGR) */
  ramp: readonly number[];
  gold: readonly number[];
  /** 남기는 틱 수 (기본 5) */
  keep?: number;
  /** 히트스톱으로 멈춰 있는가 (멈춘 동안은 사라지지 않는다) */
  held?: () => boolean;
}

export default function eunwooTrail(o: Options) {
  const keep = o.keep ?? 4;
  /** 최근 것이 앞 (월드 px 점 10개) */
  const hist: P[][] = [];
  let fed = false;
  let idle = 0;

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
  /** 사각형(볼록·오목) 채우기: 칸 가운데로 판단 */
  const quad = (f: Frame, q: readonly P[], c: number) => {
    const ys = q.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < q.length; i++) {
        const [ax, ay] = q[i]!;
        const [bx, by] = q[(i + 1) % q.length]!;
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]! - 0.5); x <= Math.floor(xs[k + 1]! - 0.5); x++) put(f, x, y, c);
      }
    }
  };
  const line = (f: Frame, a: P, b: P, c: number, light = 0) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let s = 0; s <= n; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / n;
      const y = a[1] + ((b[1] - a[1]) * s) / n;
      put(f, x, y, c);
      if (light && s % 2 === 0) glow(f, x, y, c, light);
    }
  };

  return {
    /** 이번 틱 리본 (월드 px 점 10개) */
    feed(pts: readonly P[]) {
      hist.unshift(pts.map((p) => [p[0], p[1]] as P));
      if (hist.length > keep) hist.length = keep;
      fed = true;
    },
    /** 칼끝 (가장 최근 리본의 끝, 월드 px) */
    tip(): P | null {
      const h = hist[0];
      return h ? h[h.length - 1]! : null;
    },
    /** 지금 남은 띠의 점들 (빛을 내는 곳) */
    points(): P[] {
      return hist.length ? [hist[0]![5]!, hist[0]![9]!] : [];
    },
    update() {
      if (o.held?.()) return;
      // 리본이 들어오지 않은 틱에는 오래된 것부터 하나씩 지운다
      if (!fed) {
        hist.pop();
        idle++;
      } else idle = 0;
      fed = false;
    },
    done() {
      return hist.length === 0 && idle > 2;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'back' || hist.length < 2) return;
      const R = o.ramp;
      // 띠: 오래된 쪽부터 그 다음 리본까지 사이를 메운다 (리본 바깥쪽 절반 남짓: 가장 크게 휩쓰는 곳)
      for (let a = hist.length - 2; a >= 0; a--) {
        const c = R[Math.min(R.length - 1, a + (a > 0 ? 1 : 0))]!;
        const A = hist[a]!;
        const B = hist[a + 1]!;
        for (let k = 5; k < A.length - 1; k++) quad(f, [A[k]!, A[k + 1]!, B[k + 1]!, B[k]!], c);
      }
      // 가장 최근 띠 앞 가장자리: 흰 심 (리본 그림 바로 뒤)
      const N = hist[0]!;
      for (let k = 4; k < N.length - 1; k++) line(f, N[k]!, N[k + 1]!, R[0]!, 0.4);
      // 금실 한 줄: 칼끝이 지난 길
      for (let a = 0; a + 1 < hist.length; a++) {
        const A = hist[a]!;
        const B = hist[a + 1]!;
        line(f, A[A.length - 1]!, B[B.length - 1]!, o.gold[a === 0 ? 0 : 1]!, 0.5);
      }
    },
  };
}
