// YESTERDAY: 백은우 등장 나비 (사용자 피드백 2026-11-02 11-3, 160틱). 렌더 전용, 좌표는 월드 px, 시간은 sim의 등장 틱(t())을 그대로 따른다.
//  0~20  아무것도 없음
// 20~30  빛나는 흰 나비(5×4px, 날갯짓 2장, 흰 날개 + 옅은 금빛 테두리, 하나하나가 작은 빛)가 화면 밖·위에서 곡선을 그리며 날아든다
// 30~70  사람 키만 한 나선 기둥으로 모여 돌며 점점 밝아진다 (바닥을 비춘다: 렌더가 광원을 둔다)
// 70~80  맥박: 기둥이 오므라들었다 부풀며 가장 밝게
// 80~130 나비들이 위로 흩어진다 (그 속에서 은우가 걸어 나온다)
// 130~160 두세 마리가 어깨 둘레를 돌다 빛 먼지로 흩어진다
import { EUNWOO_INTRO_T } from '../data/poses/eunwoo/show';
import type { Frame, Layer } from './impact';

type P = readonly [number, number];
export interface Options {
  /** 등장 틱 (등장이 끝났으면 -1: 그 뒤로는 스스로 센다) */
  t: () => number;
  /** 기둥 밑동 (바닥, 월드 px) */
  base: () => P;
  /** 은우 어깨 (월드 px) */
  shoulder: () => P;
  /** [흰 날개, 옅은 금빛 테두리, 몸, 빛 먼지] (ABGR) */
  ramp: readonly number[];
  seed?: number;
  count?: number;
}

/** 등장 단계 (틱): 동작 데이터와 같은 값 (data/poses/eunwoo/show.ts) */
const INTRO_T = EUNWOO_INTRO_T;
/** 기둥 높이·반지름 (px) */
const H = 56;
const R = 9;

/** 날개 편 모양·접은 모양 (5×4): 0 빈칸, 1 흰 날개, 2 금빛 테두리, 3 몸 */
const OPEN = ['21012', '11311', '01310', '02020'];
const SHUT = ['02020', '01310', '00300', '00000'];

export default function eunwooIntro(o: Options) {
  const N = o.count ?? 24;
  let r = ((o.seed ?? 1) * 48271 + 17) & 0x7fffffff;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  const flies = Array.from({ length: N }, (_, i) => ({
    // 날아오는 출발점 (기둥 밑동 기준): 화면 밖 좌우 멀리, 또는 위
    sx: (rand() < 0.5 ? -1 : 1) * (110 + rand() * 120),
    sy: -60 - rand() * 120,
    // 곡선 조절점 (옆으로 크게 휘어 들어온다)
    cx: (rand() - 0.5) * 160,
    cy: -110 - rand() * 60,
    /** 출발 틱 (20~30에 차례로), 날아오는 틱 */
    t0: INTRO_T.fly + (i % 11),
    dur: 16 + rand() * 14,
    /** 기둥 자리: 높이, 각도 (황금각으로 고르게) */
    h: 3 + (i / (N - 1)) * (H - 6),
    a: i * 2.39996,
    flap: Math.floor(rand() * 8),
    /** 흩어지는 속도 */
    vx: (rand() - 0.5) * 2.2,
    vy: -1.3 - rand() * 1.3,
    /** 어깨에 남는 나비 */
    stay: i % 9 === 4,
  }));
  /** 빛 먼지 (어깨의 나비가 흩어질 때) */
  const dust: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  let last = -1;
  let own = -1;
  /** 지금 등장 틱 (등장이 끝난 뒤에는 스스로 센 틱) */
  const now = (): number => {
    const raw = o.t();
    return raw >= 0 ? raw : Math.max(own, INTRO_T.end);
  };

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
  /** 나비 하나 (가운데 x, y), 밝기 k */
  const fly = (f: Frame, x: number, y: number, open: boolean, k: number) => {
    const shape = open ? OPEN : SHUT;
    const x0 = Math.round(x) - 2;
    const y0 = Math.round(y) - 2;
    for (let yy = 0; yy < 4; yy++) {
      for (let xx = 0; xx < 5; xx++) {
        const v = shape[yy]![xx]!;
        if (v === '0') continue;
        put(f, x0 + xx, y0 + yy, o.ramp[v === '1' ? 0 : v === '2' ? 1 : 2]!);
      }
    }
    // 하나하나가 작은 빛: 둘레 반지름 3 옅은 빛
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 3) glow(f, x + dx, y + dy, o.ramp[1]!, k * 0.35 * (1 - d / 3.5));
      }
    }
  };

  /** 나비 i의 자리와 앞뒤 (앞 = 캐릭터 앞 겹), 보이는지 */
  const place = (i: number, t: number, base: P, sh: P): { x: number; y: number; front: boolean; k: number } | null => {
    const b = flies[i]!;
    const T = INTRO_T;
    // 기둥 자리: 시간이 갈수록 돈다. 맥박 동안 오므라들었다 부푼다
    const pulse = t >= T.pulse && t < T.reveal ? Math.sin(((t - T.pulse) / (T.reveal - T.pulse)) * Math.PI * 2) : 0;
    const rad = R * (0.75 + 0.25 * Math.min(1, b.h / 20)) * (1 - 0.35 * pulse);
    const ang = b.a + t * 0.13;
    const slot = (tt: number): [number, number, boolean] => {
      const a2 = b.a + tt * 0.13;
      return [base[0] + Math.cos(a2) * rad, base[1] - b.h + Math.sin(tt * 0.2 + b.a) * 1.2, Math.sin(a2) > 0];
    };
    if (t < b.t0) return null;
    if (t < b.t0 + b.dur && t < T.reveal) {
      // 날아든다: 출발점 → 조절점 → 기둥 자리 (부드러운 곡선)
      const u = (t - b.t0) / b.dur;
      const e = u * u * (3 - 2 * u);
      const [tx, ty] = slot(t);
      const sx = base[0] + b.sx;
      const sy = base[1] + b.sy;
      const cx = base[0] + b.cx;
      const cy = base[1] + b.cy;
      const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * tx;
      const y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * ty;
      return { x, y, front: true, k: 0.6 };
    }
    if (t < T.reveal) {
      const [x, y, front] = slot(t);
      const bright = Math.min(1, 0.6 + (t - T.pillar) / 60) + Math.max(0, pulse) * 0.4;
      return { x, y, front, k: bright };
    }
    // 흩어진다: 위로 (어깨에 남는 나비는 어깨 둘레를 돈다)
    const dt = t - T.reveal;
    if (b.stay && t < T.end - 4) {
      const [px0, py0] = slot(T.reveal);
      const u = Math.min(1, dt / 30);
      const a2 = ang * 1.6 + i;
      const ox = sh[0] + Math.cos(a2) * 7;
      const oy = sh[1] - 2 + Math.sin(a2) * 3;
      return { x: px0 + (ox - px0) * u, y: py0 + (oy - py0) * u, front: Math.sin(a2) > 0, k: 0.7 };
    }
    if (b.stay) return null;
    const [px0, py0] = slot(T.reveal);
    const x = px0 + b.vx * dt + Math.sin(dt * 0.3 + b.a) * 2;
    const y = py0 + b.vy * dt - 0.01 * dt * dt;
    if (dt > 50) return null;
    return { x, y, front: true, k: Math.max(0, 1 - dt / 50) };
  };

  /** 기둥 밝기 0~1 (렌더가 광원 세기로 쓴다) */
  const level = (): number => {
    const t = now();
    const T = INTRO_T;
    if (t < T.fly || t > T.end) return 0;
    if (t < T.pillar) return 0.25;
    if (t < T.pulse) return 0.3 + (0.6 * (t - T.pillar)) / (T.pulse - T.pillar);
    if (t < T.reveal) return 0.9 + 0.1 * Math.sin(((t - T.pulse) / 10) * Math.PI * 2);
    return Math.max(0, 1 - (t - T.reveal) / 40);
  };

  return {
    level,
    update() {
      if (o.t() < 0) own = Math.max(own, INTRO_T.end) + 1;
      const t = now();
      if (t === last) return;
      last = t;
      // 어깨의 나비가 빛 먼지로 흩어진다
      if (t >= INTRO_T.end - 6 && t <= INTRO_T.end - 2) {
        const sh = o.shoulder();
        for (let k = 0; k < 4; k++) dust.push({ x: sh[0] + (((t * 7 + k * 5) % 13) - 6), y: sh[1] - 2 + ((k * 3) % 5) - 2, vx: (((k * 13 + t) % 7) - 3) * 0.12, vy: -0.25 - (k % 3) * 0.1, life: 18 + k * 3 });
      }
      for (const d of dust) {
        d.x += d.vx;
        d.y += d.vy;
        d.life--;
      }
      for (let k = dust.length - 1; k >= 0; k--) if (dust[k]!.life <= 0) dust.splice(k, 1);
    },
    done() {
      return now() > INTRO_T.end + 30 && dust.length === 0;
    },
    draw(f: Frame, layer?: Layer) {
      const t = now();
      if (t > INTRO_T.end + 30) return;
      const base = o.base();
      const sh = o.shoulder();
      for (let i = 0; i < N; i++) {
        const p = place(i, t, base, sh);
        if (!p) continue;
        if ((layer === 'back') === p.front) continue;
        const open = ((t + flies[i]!.flap) >> 2) % 2 === 0;
        fly(f, p.x, p.y, open, p.k);
      }
      if (layer === 'front') {
        // 기둥 가운데 줄기: 맥박 때 가장 밝은 흰 빛 (가장자리는 부드럽게)
        const lv = level();
        if (t >= INTRO_T.pillar && t < INTRO_T.reveal + 6) {
          for (let y = 0; y < H; y++) {
            for (let dx = -3; dx <= 3; dx++) glow(f, base[0] + dx, base[1] - y, o.ramp[0]!, lv * 0.25 * (1 - Math.abs(dx) / 3.5) * (1 - y / (H * 1.3)));
          }
        }
        for (const d of dust) {
          put(f, d.x, d.y, o.ramp[d.life % 4 < 2 ? 3 : 1]!);
          glow(f, d.x, d.y, o.ramp[3]!, 0.4);
        }
      }
    },
  };
}
