// YESTERDAY: 에드워드 이펙트 (렌더 전용, Sprite Fusion 이펙트와 같은 구조로 새로 만듦: update/draw(frame, layer)/done).
// 좌표는 2단위 = 1px (FX_PX), 색은 부르는 쪽이 우리 팔레트로 넘긴다 (0xAABBGGRR, 흰 → 밝은 → 대표 → 어두운 …).
// - hammerArc: 해머 머리가 지난 길을 따라 굵고 짧은 원호 (동작연출지침서 7장 '굵고 짧은 원호'). 새 쪽이 가장 굵고 꼬리부터 사라진다.
//   청동빛 원호 + 푸른 해머 머리 잔상 (2026-11-02 피드백 12-1)
// - dome: 내려찍기 착지 지점의 반원 충격파 (반지름 48px)와 패인 자국
// - shockwave: 바닥을 타고 앞으로 달리는 충격파 (솟은 물결 + 갈라진 자국 + 튀는 파편)
// - veilRing: 바닥에 납작하게 퍼지는 푸른 고리 (2단 점프 디딤, 착지)
// - veilShell: 몸 윤곽을 따라 푸른 장막이 비친다 (껍데기가 피해를 대신 받을 때). 깨지면 조각이 흩어진다
// - ghost: 몸 실루엣이 푸른 잔상으로 남아 흐려진다 (재현:나)
// - darkness: 화면이 어두워진다 (필살기). 두 사람 둘레만 남기고 무대를 검게 덮는다 (경계만 디더)
// - memories: 기억 조각(작은 실루엣)이 푸른 장막을 타고 한 점으로 빨려 들어간다 (필살기)
import type { Frame, Layer } from './impact';

const PX = 2;
type P = [number, number];

/** 픽셀 찍기·빛 더하기 (화면 밖은 버린다, 칠한 사각형을 넓힌다) */
function pen(f: Frame) {
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
    put(x: number, y: number, c: number, a = 255) {
      const i = at(x, y);
      if (i >= 0) f.color[i] = ((((a & 255) << 24) | (c & 0xffffff)) >>> 0);
    },
    glow(x: number, y: number, c: number, k: number) {
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

function rng(seed: number) {
  let r = (seed * 7919 + 104729) & 0x7fffffff;
  return () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
}

/** 캣멀-롬으로 이어 1px 간격으로 다시 찍은 길 (px): 자리·법선·비율 */
function resample(ctrl: readonly P[]): Array<{ x: number; y: number; nx: number; ny: number; u: number }> {
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
      const h = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([h(p0[0], p1[0], p2[0], p3[0]), h(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]!);
  const len: number[] = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1]! + Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1]));
  const total = len[len.length - 1]!;
  const n = Math.max(2, Math.round(total));
  const out: Array<{ x: number; y: number; nx: number; ny: number; u: number }> = [];
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
    out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -ty, ny: tx, u: k / n });
  }
  return out;
}

export interface ArcOptions {
  /** 해머 머리 가운데가 지난 길 (2단위, 오래된 → 새) */
  path: ReadonlyArray<readonly [number, number]>;
  /** 가장 굵은 곳 (px) */
  width?: number;
  /** 사라지는 시간 (틱) */
  ticks?: number;
  /** 바깥쪽 (궤적이 휘는 바깥): 1 법선 쪽, -1 반대쪽. 없으면 길의 휘는 방향으로 정한다 */
  side?: number;
  /** 원호 색 (흰 심 → 밝은 → 대표 → 어두운 테두리): 에드워드는 청동빛 */
  ramp: readonly number[];
  /** 해머 머리 잔상 색 [밝은, 대표, 어두운] (없으면 잔상 없음): 에드워드는 푸른 장막 (껍데기 색) */
  ghost?: readonly number[];
  /** 잔상 개수 (길을 따라 고르게) */
  heads?: number;
  /** 해머 머리 크기 (px): 자루와 수직 반길이, 자루 방향 반두께 */
  head?: { half: number; thick: number };
  /** 히트스톱 동안 멈춘다 */
  held?: () => boolean;
}

/**
 * 굵고 짧은 원호: 해머 머리가 지난 길을 따라, 새 쪽이 가장 굵다 (흰 심 → 밝은 → 대표 → 어두운 테두리). 꼬리부터 사라진다.
 * ghost가 있으면 길을 따라 해머 머리 잔상(머리 모양 네모)이 원호 뒤에 남아 오래된 것부터 흐려진다
 */
export function hammerArc(o: ArcOptions) {
  const C = o.ramp;
  const W = o.width ?? 10;
  const life = (o.ticks ?? 10) / 60;
  const pts = resample(o.path.map(([x, y]) => [x / PX, y / PX] as P));
  // 휘는 바깥쪽: 처음·가운데·끝 세 점으로 굽은 방향을 본다 (바깥으로 부푼다)
  let side = o.side ?? 0;
  if (!side) {
    const a = pts[0]!;
    const m = pts[Math.floor(pts.length / 2)]!;
    const b = pts[pts.length - 1]!;
    const cross = (m.x - a.x) * (b.y - a.y) - (m.y - a.y) * (b.x - a.x);
    side = cross > 0 ? 1 : -1;
  }
  // 잔상: 길을 따라 고르게 (새 쪽 끝은 실제 해머 머리라 빼고)
  const nh = o.ghost ? (o.heads ?? 4) : 0;
  const heads = Array.from({ length: nh }, (_, k) => {
    const q = pts[Math.min(pts.length - 1, Math.round(((k + 0.5) / (nh + 0.5)) * (pts.length - 1)))]!;
    return { q, u: (k + 0.5) / (nh + 0.5) };
  });
  const hh = o.head ?? { half: 6, thick: 4.5 };
  let t = 0;
  return {
    update(dt: number) {
      if (o.held?.() && t < life * 0.35) return;
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      const k = t / life;
      if (layer === 'back') {
        // 해머 머리 잔상: 길의 접선이 자루와 수직 (머리가 길을 따라 미끄러진다). 오래된 것부터 사라진다
        const G = o.ghost;
        if (!G) return;
        for (const h of heads) {
          const fade = k * 1.3 - (1 - h.u) * 0.3;
          if (fade >= 1) continue;
          const tx = h.q.ny;
          const ty = -h.q.nx;
          const half = hh.half * (0.75 + 0.25 * h.u);
          const thick = hh.thick * (0.75 + 0.25 * h.u);
          for (let a = -half; a <= half; a += 0.5) {
            for (let b = -thick; b <= thick; b += 0.5) {
              // 해머 머리: 길 방향(tx, ty)으로 반길이, 법선 방향으로 반두께
              const x = h.q.x + tx * a + h.q.nx * b;
              const y = h.q.y + ty * a + h.q.ny * b;
              const edge = Math.abs(a) > half - 1 || Math.abs(b) > thick - 1;
              if (fade > 0.45 && ((Math.round(x) + Math.round(y)) & 1)) continue;
              p.put(x, y, edge ? G[0]! : fade < 0.3 ? G[1]! : G[2]!, Math.round(220 * (1 - Math.max(0, fade))));
            }
          }
          p.glow(h.q.x, h.q.y, G[0]!, 0.4 * (1 - fade));
        }
        return;
      }
      const cut = Math.max(0, (k - 0.15) / 0.85);
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]!;
        if (q.u < cut) continue;
        // 초승달: 새 쪽이 굵고 끝은 둥글게 줄어든다
        const grow = Math.pow(q.u, 1.4);
        const tip = Math.min(1, (1 - q.u) * 10);
        const h = Math.max(1, W * (0.18 + 0.82 * grow) * (0.4 + 0.6 * tip) * (1 - 0.55 * k));
        for (let s = 0; s < h; s++) {
          const v = s / h;
          const c = v < 0.3 ? C[0]! : v < 0.55 ? C[1]! : v < 0.85 ? C[2]! : C[3]!;
          p.put(q.x + q.nx * s * side, q.y + q.ny * s * side, c);
        }
        if (i % 2 === 0) for (let s = -2; s < h + 3; s++) p.glow(q.x + q.nx * s * side, q.y + q.ny * s * side, C[1]!, 0.35 * (1 - k));
      }
    },
  };
}

export interface DomeOptions {
  /** 가운데 (2단위, 바닥) */
  x: number;
  y: number;
  /** 가장 넓어지는 반지름 (px) */
  radius: number;
  ticks?: number;
  /** 테두리 색 (흰 → 밝은 → 대표 → 어두운) */
  ramp: readonly number[];
  /** 바닥에 남는 패인 자국 색 */
  crack?: number;
  seed?: number;
}

/**
 * 반원 충격파 (내려찍기 착지): 바닥에서 반원 껍질이 반지름까지 퍼지며 엷어진다 (테두리 2px, 안쪽은 빛만).
 * 가운데 바닥에 패인 자국 (금이 양옆으로), 앞뒤로 흙·물이 튄다
 */
export function dome(o: DomeOptions) {
  const C = o.ramp;
  const life = (o.ticks ?? 16) / 60;
  const cx = o.x / PX;
  const cy = o.y / PX;
  const r = rng(o.seed ?? 11);
  const cracks: P[][] = [];
  for (const dir of [-1, 1]) {
    for (let n = 0; n < 2; n++) {
      const line: P[] = [[cx, cy]];
      let x = cx;
      let y = cy;
      const len = o.radius * (0.45 + r() * 0.35);
      while (Math.abs(x - cx) < len) {
        x += dir * (2 + Math.floor(r() * 3));
        y = cy - (r() < 0.3 ? 1 : 0);
        line.push([x, y]);
      }
      cracks.push(line);
    }
  }
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life + 0.8;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      if (layer === 'back') {
        // 패인 자국: 오래 남았다가 사라진다
        const fade = t < life ? 1 : Math.max(0, 1 - (t - life) / 0.8);
        for (const line of cracks) {
          for (let i = 0; i + 1 < line.length; i++) {
            if ((i * 5) % 7 > fade * 7) continue;
            const a = line[i]!;
            const b = line[i + 1]!;
            for (let s = 0; s <= 1; s += 0.34) p.put(a[0] + (b[0] - a[0]) * s, a[1], o.crack ?? C[C.length - 1]!);
          }
        }
        for (let dx = -5; dx <= 5; dx++) p.put(cx + dx, cy - (Math.abs(dx) < 3 ? 1 : 0), o.crack ?? C[C.length - 1]!);
        return;
      }
      if (t >= life) return;
      const k = t / life;
      const R = 4 + (o.radius - 4) * (1 - (1 - k) * (1 - k));
      const n = Math.max(24, Math.round(R * 3.2));
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        for (let w = 0; w < 2; w++) {
          const x = cx + Math.cos(a) * (R - w);
          const y = cy + Math.sin(a) * (R - w) * 0.9;
          if (k > 0.5 && (i * 3 + w) % 5 < (k - 0.5) * 8) continue;
          p.put(x, y, k < 0.25 ? C[0]! : w === 0 ? C[1]! : C[2]!);
        }
        if (i % 2 === 0) p.glow(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.9, C[1]!, 0.5 * (1 - k));
      }
    },
  };
}

export interface ShockOptions {
  /** 시작 자리 (2단위, 바닥) */
  x: number;
  y: number;
  /** 달리는 쪽 (1 오른쪽, -1 왼쪽) */
  dir: number;
  /** 달리는 거리 (px) */
  len: number;
  /** 속도 (px/초) */
  speed?: number;
  /** 물결 높이 (px) */
  height?: number;
  ramp: readonly number[];
  /** 갈라진 자국 색 */
  crack?: number;
  /** 파편 색 */
  rubble?: readonly number[];
  seed?: number;
}

/** 바닥을 타고 앞으로 달리는 충격파: 솟은 물결(흰 → 푸른)이 달리고, 지나간 자리에 갈라진 자국이 남으며, 물결 앞에서 파편이 튄다 */
export function shockwave(o: ShockOptions) {
  const C = o.ramp;
  const speed = o.speed ?? 420;
  const H = o.height ?? 10;
  const x0 = o.x / PX;
  const y0 = o.y / PX;
  const run = o.len / speed;
  const life = run + 0.35;
  const r = rng(o.seed ?? 3);
  // 갈라진 자국 (지그재그, 미리 정한다)
  const crack: P[] = [];
  for (let d = 0; d <= o.len; d += 3) crack.push([x0 + o.dir * d, y0 - (r() < 0.5 ? 0 : 1)]);
  const bits: Array<{ x: number; y: number; vx: number; vy: number; at: number; c: number }> = [];
  for (let n = 0; n < Math.round(o.len / 6); n++) {
    const d = r() * o.len;
    bits.push({ x: x0 + o.dir * d, y: y0 - 1, vx: o.dir * (10 + r() * 40), vy: -(60 + r() * 110), at: d / speed, c: (o.rubble ?? C)[Math.floor(r() * (o.rubble ?? C).length)]! });
  }
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      const front = Math.min(o.len, speed * t);
      const fade = t < run ? 1 : Math.max(0, 1 - (t - run) / 0.35);
      if (layer === 'back') {
        // 갈라진 자국: 지나간 자리
        for (let i = 0; i + 1 < crack.length; i++) {
          const a = crack[i]!;
          if (Math.abs(a[0] - x0) > front) break;
          if (fade < 1 && (i * 7) % 10 > fade * 10) continue;
          p.put(a[0], a[1], o.crack ?? C[C.length - 1]!);
          p.put(a[0] + o.dir, a[1], o.crack ?? C[C.length - 1]!);
        }
        return;
      }
      if (t < run) {
        // 물결: 앞끝에서 솟아 뒤로 낮아지는 혹 (높이 H, 폭 14px)
        const cx = x0 + o.dir * front;
        for (let d = 0; d < 14; d++) {
          const hh = Math.round(H * Math.sin((Math.PI * (14 - d)) / 28) * (1 - (0.4 * front) / Math.max(1, o.len)));
          const x = cx - o.dir * d;
          for (let y = 0; y <= hh; y++) {
            const v = y / Math.max(1, hh);
            p.put(x, y0 - y, v > 0.8 ? C[0]! : v > 0.45 ? C[1]! : C[2]!);
          }
          for (let y = -2; y <= hh + 3; y++) p.glow(x, y0 - y, C[1]!, 0.4);
        }
      }
      for (const b of bits) {
        const s = t - b.at;
        if (s < 0 || s > 0.5) continue;
        const x = b.x + b.vx * s;
        const y = Math.min(y0, b.y + b.vy * s + 260 * s * s);
        p.put(x, y, b.c);
        if (s < 0.25) p.put(x, y - 1, b.c);
      }
    },
  };
}

export interface RingOptions {
  x: number;
  y: number;
  /** 가장 넓어지는 반지름 (px) */
  radius?: number;
  /** 납작한 정도 (세로/가로) */
  flat?: number;
  ticks?: number;
  ramp: readonly number[];
}

/** 바닥에 납작하게 퍼지는 푸른 고리 */
export function veilRing(o: RingOptions) {
  const C = o.ramp;
  const R = o.radius ?? 20;
  const flat = o.flat ?? 0.3;
  const life = (o.ticks ?? 14) / 60;
  const cx = o.x / PX;
  const cy = o.y / PX;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      const k = t / life;
      const r = 3 + (R - 3) * (1 - (1 - k) * (1 - k));
      const n = Math.max(12, Math.round(r * 4));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const back = Math.sin(a) < 0;
        if ((layer === 'back') !== back) continue;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * flat;
        if (k > 0.6 && (i * 5) % 7 < (k - 0.6) * 17) continue;
        p.put(x, y, k < 0.3 ? C[0]! : k < 0.6 ? C[1]! : C[2]!);
        p.glow(x, y, C[1]!, 0.5 * (1 - k));
      }
    },
  };
}

/** 실루엣 (월드 px 자리, 칸 크기, 픽셀) */
export interface Sil {
  x: number;
  y: number;
  w: number;
  h: number;
  data: Uint32Array;
}

export interface ShellOptions {
  /** 지금 몸 실루엣 (몸을 따라간다) */
  silhouette: () => Sil | null;
  ticks?: number;
  /** 껍데기가 깨졌다 (더 세게, 조각이 흩어진다) */
  broken?: boolean;
  ramp: readonly number[];
  seed?: number;
}

/**
 * 푸른 장막: 몸 둘레 2px 바깥에 장막 테두리가 번쩍이고, 몸 위로 육각 무늬 빛이 지나간다 (껍데기가 피해를 대신 받는 순간).
 * 깨지면 테두리가 조각나 사방으로 흩어진다
 */
export function veilShell(o: ShellOptions) {
  const C = o.ramp;
  const life = (o.ticks ?? 12) / 60;
  const r = rng(o.seed ?? 5);
  const shards: Array<{ x: number; y: number; vx: number; vy: number; c: number }> = [];
  let t = 0;
  let made = false;
  return {
    update(dt: number) {
      t += dt;
      for (const s of shards) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 200 * dt;
      }
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      const sil = o.silhouette();
      if (!sil) return;
      const p = pen(f);
      const k = t / life;
      const on = (x: number, y: number) => x >= 0 && y >= 0 && x < sil.w && y < sil.h && sil.data[y * sil.w + x]! >>> 24 !== 0;
      if (o.broken && !made) {
        made = true;
        for (let n = 0; n < 18; n++) {
          const x = sil.x + r() * sil.w;
          const y = sil.y + sil.h * 0.3 + r() * sil.h * 0.6;
          shards.push({ x, y, vx: (r() - 0.5) * 160, vy: -40 - r() * 120, c: C[Math.floor(r() * 3)]! });
        }
      }
      if (layer === 'back') {
        // 테두리: 몸에서 1~2px 떨어진 칸 (몸 뒤 겹)
        for (let y = 0; y < sil.h; y++) {
          for (let x = 0; x < sil.w; x++) {
            if (on(x, y)) continue;
            let near = false;
            for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && on(x + dx, y + dy)) near = true;
            if (!near) continue;
            // 깨진 장막은 테두리가 군데군데 끊긴다
            if ((o.broken || k > 0.5) && ((x * 3 + y * 5) % 9) < (o.broken ? 3 : 0) + (k > 0.5 ? (k - 0.5) * 14 : 0)) continue;
            p.put(sil.x + x, sil.y + y, k < 0.25 ? C[0]! : C[1]!);
            p.glow(sil.x + x, sil.y + y, C[1]!, 0.5 * (1 - k));
          }
        }
        return;
      }
      // 몸 위로 지나가는 육각 무늬 빛 (빛만 더한다: 그림을 가리지 않는다)
      const band = sil.h * (1 - k * 1.4);
      for (let y = 0; y < sil.h; y++) {
        if (Math.abs(y - band) > 6) continue;
        for (let x = 0; x < sil.w; x++) {
          if (!on(x, y)) continue;
          const hex = (x + Math.floor(y / 3) * 2) % 6 === 0 || y % 3 === 0;
          if (hex) p.glow(sil.x + x, sil.y + y, C[0]!, 0.6 * (1 - k));
        }
      }
      for (const s of shards) {
        p.put(s.x, s.y, s.c);
        p.put(s.x + 1, s.y, s.c);
      }
    },
  };
}

export interface GhostOptions {
  /** 남길 실루엣 (만든 순간 그대로) */
  sil: Sil;
  ticks?: number;
  /** 잔상 색: [밝은, 어두운] */
  ramp: readonly number[];
}

/** 푸른 잔상: 그 순간의 몸 실루엣이 푸르게 남아 점점 성기게 흐려진다 (몸 뒤 겹) */
export function ghost(o: GhostOptions) {
  const life = (o.ticks ?? 14) / 60;
  const s = o.sil;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'back') return;
      const p = pen(f);
      const a = Math.round(200 * (1 - t / life));
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          if (s.data[y * s.w + x]! >>> 24 === 0) continue;
          const edge = !(s.data[y * s.w + x - 1]! >>> 24) || !(s.data[y * s.w + x + 1]! >>> 24) || !(s.data[(y - 1) * s.w + x]! >>> 24);
          p.put(s.x + x, s.y + y, edge ? o.ramp[0]! : o.ramp[1]!, a);
        }
      }
    },
  };
}

export interface DarkOptions {
  /** 밝게 남길 자리 (2단위)와 반지름 (px) */
  center: () => [number, number];
  radius: number;
  /** 어둠 색 */
  color: number;
  /** 어두워지는 시간·유지·밝아지는 시간 (틱) */
  fadeIn?: number;
  hold: number;
  fadeOut?: number;
}

/** 화면이 어두워진다: 두 사람 둘레(타원)만 남기고 무대를 검게 덮는다. 넓은 면은 꽉 채우고, 경계 3px만 디더 (몸 뒤 겹) */
export function darkness(o: DarkOptions) {
  const fi = (o.fadeIn ?? 10) / 60;
  const ho = o.hold / 60;
  const fo = (o.fadeOut ?? 12) / 60;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= fi + ho + fo;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'back') return;
      const p = pen(f);
      const k = t < fi ? t / fi : t < fi + ho ? 1 : Math.max(0, 1 - (t - fi - ho) / fo);
      if (k <= 0) return;
      const [cx, cy] = o.center();
      const px = cx / PX;
      const py = cy / PX;
      // 반지름은 어두워질수록 좁아진다 (화면 가장자리부터 조여 온다)
      const R = o.radius + (1 - k) * 260;
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const wx = x + f.ox;
          const wy = y + f.oy;
          const d = Math.hypot((wx - px) / 1.6, wy - py) - R;
          if (d < 0) continue;
          const a = d >= 3 ? 255 : Math.round(255 * (d / 3));
          p.put(wx, wy, o.color, a);
        }
      }
    },
  };
}

export interface MemoryOptions {
  /** 기억이 빠져나오는 자리, 빨려 드는 자리 (2단위, 틱마다 읽는다) */
  from: () => [number, number];
  to: () => [number, number];
  /** 흐르는 시간 (틱) */
  ticks: number;
  ramp: readonly number[];
  seed?: number;
}

/** 기억 조각: 작은 실루엣(사람·집·나무·창)이 푸른 장막 띠를 타고 휘돌며 한 점으로 빨려 든다 */
const GLYPHS: readonly (readonly number[])[] = [
  // 사람
  [0b010, 0b111, 0b010, 0b010, 0b101],
  // 집
  [0b010, 0b111, 0b111, 0b101, 0b111],
  // 나무
  [0b111, 0b111, 0b111, 0b010, 0b010],
  // 창문
  [0b111, 0b101, 0b111, 0b101, 0b111],
  // 아이
  [0b000, 0b010, 0b111, 0b010, 0b101],
];
export function memories(o: MemoryOptions) {
  const C = o.ramp;
  const life = o.ticks / 60;
  const r = rng(o.seed ?? 9);
  const bits = Array.from({ length: 26 }, () => ({ at: r() * 0.85, g: Math.floor(r() * GLYPHS.length), spin: (r() - 0.5) * 2, off: (r() - 0.5) * 30 }));
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const p = pen(f);
      const [ax, ay] = o.from();
      const [bx, by] = o.to();
      const A: P = [ax / PX, ay / PX];
      const B: P = [bx / PX, by / PX];
      // 장막 띠: 두 점 사이를 위로 휘는 곡선, 밝은 푸른 점선이 흐른다
      const ctrl: P = [(A[0] + B[0]) / 2, Math.min(A[1], B[1]) - 18];
      const at = (u: number, wob: number): P => {
        const x = (1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * ctrl[0] + u * u * B[0];
        const y = (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * ctrl[1] + u * u * B[1];
        return [x, y + Math.sin(u * 9 + t * 14) * wob];
      };
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const [x, y] = at(u, 2);
        if ((i + Math.floor(t * 40)) % 3 !== 0) p.put(x, y, C[2]!);
        p.glow(x, y, C[1]!, 0.35);
      }
      for (const b of bits) {
        const u = (t / life - b.at) / 0.35;
        if (u < 0 || u > 1) continue;
        const e = u * u;
        const [x, y] = at(e, 4 + b.off * (1 - e) * 0.2);
        const g = GLYPHS[b.g]!;
        const c = u < 0.6 ? C[0]! : C[1]!;
        for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if ((g[row]! >> (2 - col)) & 1) p.put(x + col - 1, y + row - 2, c);
        p.glow(x, y, C[1]!, 0.5);
      }
    },
  };
}

export interface TetherOptions {
  /** 손 (2단위, 틱마다 읽는다) */
  from: () => [number, number];
  /** 상대 (2단위, 틱마다 읽는다) */
  to: () => [number, number];
  ticks: number;
  /** 흐르는 쪽: 1 손 쪽으로 (끌어당김), -1 상대 쪽으로 (밀어냄) */
  flow: number;
  ramp: readonly number[];
}

/** 염동력 푸른 궤적: 손과 상대를 잇는 두 가닥 물결 줄. 빛 알갱이가 끌어당기면 손 쪽으로, 밀어내면 상대 쪽으로 흐른다 */
export function tether(o: TetherOptions) {
  const C = o.ramp;
  const life = o.ticks / 60;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const p = pen(f);
      const [ax, ay] = o.from();
      const [bx, by] = o.to();
      const A: P = [ax / PX, ay / PX];
      const B: P = [bx / PX, by / PX];
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const n = Math.max(8, Math.round(len));
      const k = t / life;
      const reach = Math.min(1, t / (3 / 60));
      const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const nx = -(B[1] - A[1]) / Math.max(1, len);
      const ny = (B[0] - A[0]) / Math.max(1, len);
      for (const strand of [0, 1]) {
        for (let i = 0; i <= n * reach; i++) {
          const u = i / n;
          const wob = Math.sin(u * 10 + t * 30 + strand * 2.4) * (1.5 + strand) * Math.sin(Math.PI * u);
          const x = A[0] + (B[0] - A[0]) * u + nx * wob;
          const y = A[1] + (B[1] - A[1]) * u + ny * wob - 6 * Math.sin(Math.PI * u);
          // 흐르는 빛 알갱이
          const phase = (((u * 12 - o.flow * t * 18) % 1) + 1) % 1;
          if (fade < 1 && (i * 7 + strand) % 5 > fade * 5) continue;
          p.put(x, y, phase < 0.25 ? C[0]! : strand === 0 ? C[1]! : C[2]!);
          if (i % 2 === 0) p.glow(x, y, C[1]!, 0.35 * fade);
        }
      }
      // 손끝 고리
      const r = 3 + Math.sin(t * 40);
      for (let a = 0; a < 12; a++) p.put(A[0] + Math.cos((a / 12) * Math.PI * 2) * r, A[1] + Math.sin((a / 12) * Math.PI * 2) * r, C[1]!);
    },
  };
}

export interface ScrapeOptions {
  /** 해머 머리 자리 (2단위, 틱마다 읽는다). null이면 끌기가 끝났다 */
  head: () => [number, number] | null;
  /** 바닥 높이 (2단위) */
  ground: number;
  /** 홈 색, 불꽃 색 [밝은, 대표, 어두운] */
  groove: number;
  sparks: readonly number[];
  seed?: number;
}

/**
 * 해머 머리가 바닥을 긁는다 (차지 모으기): 머리가 지난 바닥에 어두운 홈이 남고, 머리 자리에서 청동빛 불꽃이 튄다.
 * 끌기가 끝나면 불꽃은 멎고 홈은 천천히 사라진다
 */
export function scrape(o: ScrapeOptions) {
  const y0 = o.ground / PX;
  let lo = Infinity;
  let hi = -Infinity;
  const r = rng(o.seed ?? 13);
  const bits: Array<{ x: number; y: number; vx: number; vy: number; t: number; c: number }> = [];
  let t = 0;
  let endT = -1;
  return {
    update(dt: number) {
      t += dt;
      const h = endT < 0 ? o.head() : null;
      if (endT < 0 && !h) endT = t;
      if (h && Math.abs(h[1] / PX - y0) < 12) {
        const x = h[0] / PX;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
        for (let n = 0; n < 2; n++) bits.push({ x, y: y0 - 1, vx: (r() - 0.5) * 70, vy: -(30 + r() * 70), t: 0, c: o.sparks[Math.floor(r() * o.sparks.length)]! });
      }
      for (const b of bits) {
        b.t += dt;
        b.x += b.vx * dt;
        b.y = Math.min(y0, b.y + b.vy * dt);
        b.vy += 260 * dt;
      }
      for (let i = bits.length - 1; i >= 0; i--) if (bits[i]!.t > 0.3) bits.splice(i, 1);
    },
    done() {
      return endT >= 0 && t - endT > 1.2;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      if (layer === 'back') {
        if (lo > hi) return;
        const fade = endT < 0 ? 1 : Math.max(0, 1 - (t - endT) / 1.2);
        for (let x = Math.floor(lo); x <= hi; x++) {
          if (fade < 1 && (x * 7) % 10 > fade * 10) continue;
          p.put(x, y0, o.groove);
          if ((x & 3) === 0) p.put(x, y0 - 1, o.groove);
        }
        return;
      }
      for (const b of bits) {
        p.put(b.x, b.y, b.c);
        p.glow(b.x, b.y, o.sparks[0]!, 0.6);
      }
    },
  };
}

export interface AuraOptions {
  /** 지금 몸 실루엣 */
  silhouette: () => Sil | null;
  /** 지금 단계 (0이면 끝) */
  level: () => number;
  /** 발밑 x (2단위)와 바라보는 쪽: 등 쪽을 안다 */
  feet: () => [number, number];
  facing: () => number;
  /** [흰, 밝은, 대표, 어두운] */
  ramp: readonly number[];
}

/**
 * 차지를 모으는 동안 팔·등에 푸른 장막 윤곽이 짙어진다 (2026-11-02 피드백 12-2): 몸 둘레 1px 바깥에, 등 쪽과 팔(위쪽)부터.
 * 1단계 어두운 푸른 점선(등), 2단계 푸른 선(등·팔), 3단계 밝은 푸른 선 두 겹(등·팔) + 빛
 */
export function veilAura(o: AuraOptions) {
  const C = o.ramp;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return o.level() <= 0;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'back') return;
      const lv = o.level();
      const sil = o.silhouette();
      if (!sil || lv <= 0) return;
      const p = pen(f);
      const fx = o.feet()[0] / PX;
      const face = o.facing();
      const on = (x: number, y: number) => x >= 0 && y >= 0 && x < sil.w && y < sil.h && sil.data[y * sil.w + x]! >>> 24 !== 0;
      // 몸 윗부분 (팔·어깨): 실루엣 높이의 위 60%
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < sil.h; y++) {
        for (let x = 0; x < sil.w; x++) {
          if (!on(x, y)) continue;
          if (top < 0) top = y;
          bottom = y;
          break;
        }
      }
      if (top < 0) return;
      const upper = top + (bottom - top) * 0.6;
      const flick = Math.floor(t * 20) & 1;
      for (let y = 0; y < sil.h; y++) {
        for (let x = 0; x < sil.w; x++) {
          if (on(x, y)) continue;
          let d = 0;
          if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) d = 1;
          else if (lv >= 3 && (on(x - 2, y) || on(x + 2, y) || on(x, y - 2) || on(x, y + 2))) d = 2;
          if (!d) continue;
          const wx = sil.x + x;
          const back = (wx - fx) * face < 2;
          const arm = y < upper;
          if (lv === 1 && (!back || ((x + y + flick) & 1))) continue;
          if (lv >= 2 && !back && !arm) continue;
          const c = lv >= 3 ? (d === 1 ? C[1]! : C[2]!) : lv === 2 ? C[2]! : C[3]!;
          p.put(wx, sil.y + y, c);
          if (lv >= 2) p.glow(wx, sil.y + y, C[1]!, 0.25 * lv);
        }
      }
    },
  };
}

export interface SlabOptions {
  /** 파도가 시작하는 자리 (2단위, 바닥) */
  x: number;
  y: number;
  /** 나아가는 쪽 */
  dir: number;
  /** 길이 (px) */
  len: number;
  /** 끝까지 가는 틱 */
  ticks: number;
  /** 바닥 판 색 [밝은 윗면, 판, 어두운 옆면, 그늘] */
  ramp: readonly number[];
  /** 잔해가 남아 있는가 (sim 파괴 상태가 이 잔해를 가리키는 동안 true) */
  keep: () => boolean;
  /** 솟는 판 밑에서 새어 나오는 빛 (푸른 장막) */
  glow?: number;
  seed?: number;
}

/**
 * 차지 올려치기의 바닥 파도: 앞쪽 바닥 판(8px)이 차례로 솟구쳤다가 기울어진 채 내려앉아 잔해로 남는다 (2026-11-02 피드백 12-2).
 * 판마다 솟는 높이·기울기가 조금씩 다르다. keep()이 거짓이 되면 (다음 차지가 덮어쓰거나 라운드가 바뀌면) 흐려져 사라진다
 */
export function slabs(o: SlabOptions) {
  const C = o.ramp;
  const W = 8;
  const n = Math.max(1, Math.round(o.len / W));
  const r = rng(o.seed ?? 21);
  const x0 = o.x / PX;
  const y0 = o.y / PX;
  const run = o.ticks / 60;
  const plates = Array.from({ length: n }, (_, k) => ({
    k,
    at: (run * (k + 0.5)) / n,
    peak: 12 + r() * 8 + (k / n) * 6,
    tilt: (0.25 + r() * 0.35) * (r() < 0.75 ? 1 : -1),
    rest: 2 + r() * 3,
    w: W - 1 - Math.floor(r() * 2),
  }));
  let t = 0;
  let gone = -1;
  return {
    update(dt: number) {
      t += dt;
      if (gone < 0 && t > run + 0.4 && !o.keep()) gone = t;
    },
    done() {
      return gone >= 0 && t - gone > 0.5;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      const fade = gone < 0 ? 1 : Math.max(0, 1 - (t - gone) / 0.5);
      for (const pl of plates) {
        const s = t - pl.at;
        if (s < 0) continue;
        // 솟는 동안은 사람 앞 겹 (무대 앞 물건에 가리지 않게), 내려앉은 잔해는 뒤 겹
        if ((s < 0.3) !== (layer === 'front')) continue;
        // 솟았다가 (0.12초) 내려앉아 기울어진 채 남는다
        const up = s < 0.12 ? Math.sin((s / 0.12) * (Math.PI / 2)) : Math.max(0, 1 - (s - 0.12) / 0.18);
        const lift = pl.rest + (pl.peak - pl.rest) * up;
        const tilt = pl.tilt * (0.4 + 0.6 * Math.min(1, s / 0.12));
        const cx = x0 + o.dir * (pl.k * W + W / 2);
        for (let a = -pl.w / 2; a <= pl.w / 2; a += 0.5) {
          const top = y0 - lift - a * tilt * o.dir;
          for (let b = 0; b < 5; b++) {
            const x = cx + a;
            const y = top + b;
            if (y > y0) continue;
            if (fade < 1 && ((Math.round(x) * 3 + Math.round(y)) % 4) >= fade * 4) continue;
            p.put(x, y, b === 0 ? C[0]! : b < 3 ? C[1]! : C[2]!);
          }
          // 판 밑 그늘 (들린 틈), 솟는 동안은 밑에서 푸른 빛이 새어 나온다
          if (fade >= 1) for (let y = top + 5; y <= y0; y += 2) p.put(cx + a, y, C[3]!);
          if (o.glow !== undefined && s < 0.3) p.glow(cx + a, y0 - 1, o.glow, 0.8 * (1 - s / 0.3));
        }
      }
    },
  };
}

/** 장막 조각: 깨진 장막 테두리가 흩어진다 (2px, 밝은 푸른 → 푸른, 중력) */
interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: number;
}
function shatter(pts: ReadonlyArray<readonly [number, number]>, cx: number, cy: number, C: readonly number[], r: () => number, n: number): Shard[] {
  const out: Shard[] = [];
  for (let k = 0; k < n && pts.length; k++) {
    const q = pts[Math.floor(r() * pts.length)]!;
    const dx = q[0] - cx;
    const dy = q[1] - cy;
    const d = Math.hypot(dx, dy) || 1;
    out.push({ x: q[0], y: q[1], vx: (dx / d) * (40 + r() * 70), vy: (dy / d) * (40 + r() * 50) - 40, c: C[Math.floor(r() * 2)]! });
  }
  return out;
}
function drawShards(p: ReturnType<typeof pen>, shards: Shard[], k: number, glow: number): void {
  for (const s of shards) {
    if ((Math.round(s.x) + Math.round(s.y)) % 4 < k * 4) continue;
    p.put(s.x, s.y, s.c);
    p.put(s.x + 1, s.y, s.c);
    p.glow(s.x, s.y, glow, 0.5 * (1 - k));
  }
}
function moveShards(shards: Shard[], dt: number): void {
  for (const s of shards) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 220 * dt;
  }
}

export interface BandOptions {
  /** 손 (2단위), 상대 가슴 (2단위): 틱마다 읽는다 */
  from: () => [number, number];
  to: () => [number, number];
  /** 붙잡고 있는가 (거짓이 되면 띠가 끊겨 사라진다) */
  alive: () => boolean;
  /** [흰, 밝은, 대표, 어두운] */
  ramp: readonly number[];
}

/**
 * 염동력 끌어당김의 장막 띠 (2026-11-02 피드백 12-3): 손에서 상대까지 꼬인 푸른 띠 세 가닥 (폭 3px, 반투명 + 밝은 심).
 * 4틱 동안 손에서 뻗어 나가고, 붙잡는 동안 서로 감기며 흐른다. 놓으면 끊겨 흐려진다
 */
export function veilBands(o: BandOptions) {
  const C = o.ramp;
  let t = 0;
  let end = -1;
  return {
    update(dt: number) {
      t += dt;
      if (end < 0 && !o.alive()) end = t;
    },
    done() {
      return end >= 0 && t - end > 0.12;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const p = pen(f);
      const [ax, ay] = o.from();
      const [bx, by] = o.to();
      const A: P = [ax / PX, ay / PX];
      const B: P = [bx / PX, by / PX];
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const n = Math.max(8, Math.round(len * 1.5));
      const reach = Math.min(1, t / (4 / 60));
      const fade = end < 0 ? 1 : Math.max(0, 1 - (t - end) / 0.12);
      const nx = -(B[1] - A[1]) / Math.max(1, len);
      const ny = (B[0] - A[0]) / Math.max(1, len);
      for (let strand = 0; strand < 3; strand++) {
        for (let i = 0; i <= n * reach; i++) {
          const u = i / n;
          if (fade < 1 && (i * 3 + strand) % 4 >= fade * 4) continue;
          // 세 가닥이 서로 감긴다 (위상 120°씩), 가운데가 조금 처진다
          const tw = Math.sin(u * Math.PI * 4 + strand * 2.1 + t * 10) * 3 * Math.sin(Math.PI * u);
          const x = A[0] + (B[0] - A[0]) * u + nx * tw;
          const y = A[1] + (B[1] - A[1]) * u + ny * tw + 4 * Math.sin(Math.PI * u);
          for (let w = -1; w <= 1; w++) {
            p.put(x + nx * w, y + ny * w, w === 0 ? C[1]! : C[2]!);
          }
          if (i % 3 === 0) p.glow(x, y, C[1]!, 0.35 * fade);
        }
      }
    },
  };
}

export interface GripOptions {
  /** 상대 몸 가운데 (2단위): 틱마다 읽는다 */
  at: () => [number, number];
  /** 손이 오는 쪽 (에드워드 쪽: 1 오른쪽, -1 왼쪽) */
  from: number;
  /** 상대 키의 반 (px): 손은 한 둘레 크다 */
  size: number;
  alive: () => boolean;
  ramp: readonly number[];
  seed?: number;
}

/**
 * 장막 손: 상대보다 한 둘레 큰 손 모양 반투명 장막 (손바닥은 에드워드 쪽, 손가락 넷이 머리 위를 넘어 반대편으로 감싼다).
 * 나타날 때 크게 펼쳤다가 움켜쥐며 조인다. 놓으면 (alive 거짓) 조각나 흩어진다. 반투명 푸른 면 + 1px 밝은 테두리 (흑백에서도 보이게)
 */
export function veilHand(o: GripOptions) {
  const C = o.ramp;
  const r = rng(o.seed ?? 17);
  let t = 0;
  let end = -1;
  let shards: Shard[] = [];
  let last: Array<[number, number]> = [];
  let center: [number, number] = [0, 0];
  return {
    update(dt: number) {
      t += dt;
      if (end < 0 && !o.alive()) {
        end = t;
        shards = shatter(last, center[0], center[1], C, r, 34);
      }
      moveShards(shards, dt);
    },
    done() {
      return end >= 0 && t - end > 0.45;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      if (end >= 0) {
        if (layer !== 'back') drawShards(p, shards, (t - end) / 0.45, C[1]!);
        return;
      }
      const [cx0, cy0] = o.at();
      const cx = cx0 / PX;
      const cy = cy0 / PX;
      center = [cx, cy];
      // 펼쳤다가 (1.3배) 움켜쥐며 조인다 (0.9배)
      const k = t < 0.07 ? 1.3 - (t / 0.07) * 0.3 : Math.max(0.9, 1 - (t - 0.07) * 0.5);
      const H = o.size * 1.25 * k;
      const W = o.size * 0.62 * k;
      const back = layer === 'back';
      const edge: Array<[number, number]> = [];
      const inPalm = (x: number, y: number) => ((x - (cx + o.from * W * 0.55)) / (W * 0.5)) ** 2 + ((y - cy) / H) ** 2 <= 1;
      // 손가락: 손바닥 위쪽에서 머리 위를 넘어 반대편으로 휘는 굵은 활 네 개
      const inFinger = (x: number, y: number) => {
        for (let fi = 0; fi < 4; fi++) {
          const rr = H * (0.78 + fi * 0.09);
          const d = Math.hypot(x - cx, (y - cy) * 1.1);
          if (Math.abs(d - rr) > 2.2) continue;
          const a = Math.atan2(y - cy, (x - cx) * o.from);
          // 손바닥 쪽 위(-100°)에서 반대편 옆(+20° 앞)까지
          const lo = -2.6 + fi * 0.12;
          const hi = 0.1 + fi * 0.1;
          if (a >= lo && a <= hi && !(a > -1.2 && a < 0.4 && (x - cx) * o.from > 0)) return true;
        }
        return false;
      };
      const inside = (x: number, y: number) => inPalm(x, y) || inFinger(x, y);
      const x0 = Math.floor(cx - H * 1.3);
      const x1 = Math.ceil(cx + H * 1.3);
      const y0 = Math.floor(cy - H * 1.3);
      const y1 = Math.ceil(cy + H * 1.2);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!inside(x, y)) continue;
          const isEdge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          if (isEdge) edge.push([x, y]);
          // 뒤 겹: 반투명 면 (빛만 더해 뒤가 비친다: 점무늬로 칠하지 않는다), 앞 겹: 밝은 테두리 (손가락은 상대 앞을 지난다)
          if (back && !isEdge) p.glow(x, y, C[2]!, 0.45);
          if (!back && isEdge) {
            p.put(x, y, C[1]!);
            p.glow(x, y, C[1]!, 0.25);
          }
        }
      }
      last = edge;
      // 붙잡는 순간 흰 번쩍 (1틱)
      if (!back && t < 1 / 60) for (const [x, y] of edge) p.put(x, y, C[0]!);
    },
  };
}

export interface WallOptions {
  /** 장막 벽 자리 (2단위, 바닥): 틱마다 읽는다 */
  at: () => [number, number];
  /** 밀어내는 쪽 */
  dir: number;
  /** 높이 (px) */
  height: number;
  alive: () => boolean;
  ramp: readonly number[];
  seed?: number;
}

/**
 * 장막 벽 (염동력 밀어냄): 높이 70px 반투명 푸른 벽이 앞으로 밀려 나간다 (밀어내는 쪽 면은 1px 밝은 테두리, 가운데가 조금 부푼다).
 * 놓으면 (alive 거짓) 터져 조각이 앞으로 흩어진다
 */
export function veilWall(o: WallOptions) {
  const C = o.ramp;
  const r = rng(o.seed ?? 19);
  let t = 0;
  let end = -1;
  let shards: Shard[] = [];
  let last: Array<[number, number]> = [];
  let center: [number, number] = [0, 0];
  return {
    update(dt: number) {
      t += dt;
      if (end < 0 && !o.alive()) {
        end = t;
        shards = shatter(last, center[0] - o.dir * 6, center[1], C, r, 40);
      }
      moveShards(shards, dt);
    },
    done() {
      return end >= 0 && t - end > 0.5;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      if (end >= 0) {
        if (layer !== 'back') drawShards(p, shards, (t - end) / 0.5, C[1]!);
        return;
      }
      if (layer === 'back') return;
      const [gx, gy] = o.at();
      const x0 = gx / PX;
      const y0 = gy / PX;
      const grow = Math.min(1, t / (4 / 60));
      const H = o.height * grow;
      center = [x0, y0 - H / 2];
      const edge: Array<[number, number]> = [];
      for (let h = 0; h <= H; h++) {
        const y = y0 - h;
        // 가운데가 밀어내는 쪽으로 부푼다
        const bulge = Math.round(3 * Math.sin((Math.PI * h) / Math.max(1, H)));
        for (let w = 0; w < 10; w++) {
          const x = x0 + o.dir * (bulge - w);
          const front = w === 0;
          const top = h >= H - 1;
          if (front || top) {
            p.put(x, y, C[1]!);
            edge.push([x, y]);
          } else p.glow(x, y, w < 4 ? C[1]! : C[2]!, w < 4 ? 0.7 : 0.45);
        }
        if (h % 3 === 0) p.glow(x0 + o.dir * bulge, y, C[1]!, 0.35);
      }
      last = edge;
    },
  };
}

export interface BoxOptions {
  /** 물건 상자 (2단위) */
  x: number;
  y: number;
  w: number;
  h: number;
  ticks: number;
  ramp: readonly number[];
  seed?: number;
}

/** 염동력이 물건을 감싼다: 물건 둘레에 같은 장막 (반투명 + 밝은 테두리)이 덮였다가 조이며 으스러뜨리고 조각난다 */
export function veilBox(o: BoxOptions) {
  const C = o.ramp;
  const r = rng(o.seed ?? 23);
  const life = o.ticks / 60;
  let t = 0;
  let shards: Shard[] = [];
  let made = false;
  const x0 = o.x / PX;
  const y0 = o.y / PX;
  const w = o.w / PX;
  const h = o.h / PX;
  return {
    update(dt: number) {
      t += dt;
      if (!made && t >= life) {
        made = true;
        const pts: Array<[number, number]> = [];
        for (let k = 0; k < 40; k++) pts.push([x0 + r() * w, y0 + r() * h]);
        shards = shatter(pts, x0 + w / 2, y0 + h / 2, C, r, 30);
      }
      moveShards(shards, dt);
    },
    done() {
      return made && t - life > 0.45;
    },
    draw(f: Frame, layer?: Layer) {
      const p = pen(f);
      if (made) {
        if (layer !== 'back') drawShards(p, shards, (t - life) / 0.45, C[1]!);
        return;
      }
      if (layer === 'back') return;
      // 조인다: 끝으로 갈수록 상자가 8%까지 좁아진다
      const k = 1 + 0.25 * (1 - t / life);
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      const hw = (w / 2) * k + 3;
      const hh = (h / 2) * k + 3;
      for (let y = Math.floor(cy - hh); y <= cy + hh; y++) {
        for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
          const edge = x - (cx - hw) < 1 || cx + hw - x < 1 || y - (cy - hh) < 1 || cy + hh - y < 1;
          if (edge) {
            p.put(x, y, C[1]!);
            p.glow(x, y, C[1]!, 0.3);
          } else p.glow(x, y, C[2]!, 0.45);
        }
      }
    },
  };
}

export interface CrackOptions {
  /** 가운데 (2단위) */
  x: number;
  y: number;
  /** 금 개수, 길이 (px) */
  count: number;
  len: number;
  color: number;
  /** 남아 있는 시간 (틱) */
  ticks?: number;
  seed?: number;
}

/** 벽·바닥에 간 금: 한 점에서 지그재그로 뻗는 짧은 금들 (발바닥으로 찍은 자리). 한동안 남았다가 흐려진다 */
export function cracks(o: CrackOptions) {
  const r = rng(o.seed ?? 29);
  const cx = o.x / PX;
  const cy = o.y / PX;
  const lines: P[][] = [];
  for (let k = 0; k < o.count; k++) {
    const a = (k / o.count) * Math.PI * 2 + r() * 0.6;
    const line: P[] = [[cx, cy]];
    let x = cx;
    let y = cy;
    const len = o.len * (0.6 + r() * 0.4);
    for (let d = 0; d < len; d += 2) {
      const j = (r() - 0.5) * 1.2;
      x += Math.cos(a + j) * 2;
      y += Math.sin(a + j) * 2;
      line.push([x, y]);
    }
    lines.push(line);
  }
  const life = (o.ticks ?? 90) / 60;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'back') return;
      const p = pen(f);
      const fade = t < life * 0.6 ? 1 : 1 - (t - life * 0.6) / (life * 0.4);
      for (const line of lines) {
        for (let i = 0; i + 1 < line.length; i++) {
          if ((i * 5) % 7 >= fade * 7) continue;
          const a = line[i]!;
          const b = line[i + 1]!;
          p.put(a[0], a[1], o.color);
          p.put((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, o.color);
        }
      }
    },
  };
}
