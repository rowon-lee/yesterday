// YESTERDAY: 에드워드 이펙트 (렌더 전용, Sprite Fusion 이펙트와 같은 구조로 새로 만듦: update/draw(frame, layer)/done).
// 좌표는 2단위 = 1px (FX_PX), 색은 부르는 쪽이 우리 팔레트로 넘긴다 (0xAABBGGRR, 흰 → 밝은 → 대표 → 어두운 …).
// - hammerArc: 해머 머리가 지난 길을 따라 굵고 짧은 원호 (동작연출지침서 7장 '굵고 짧은 원호'). 새 쪽이 가장 굵고 꼬리부터 사라진다
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
  ramp: readonly number[];
  /** 히트스톱 동안 멈춘다 */
  held?: () => boolean;
}

/** 굵고 짧은 원호: 해머 머리가 지난 길을 따라, 새 쪽이 가장 굵다. 흰 심 → 밝은 푸른 → 푸른 → 어두운 테두리. 꼬리부터 사라진다 */
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
      if (layer === 'back') return;
      const p = pen(f);
      const k = t / life;
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
