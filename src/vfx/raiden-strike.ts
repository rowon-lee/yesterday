// YESTERDAY: 라이덴 지상 1~4타 번개 — 한 방향으로 뻗는 번개 한 줄기 (렌더 전용).
// 사용자 피드백 2026-11-02 '공격 하나에 방향 하나 · 이펙트가 몸 밖으로 뻗는다 · 거리가 보인다':
//   잽·크로스는 주먹에서 앞으로 곧은 줄기, 미들킥은 허리 높이 몸 앞쪽 반원, 슈퍼맨 펀치는 바닥 가까이 앞으로 달리는 줄기.
// 줄기는 주먹·발에서 시작해 몸 밖으로 뻗는다 (두 사람 몸을 덮는 덩어리·실타래를 만들지 않는다).
// 순서: 앞끝이 시작점에서 끝까지 내달림(REVEAL) → 방전(흰 심 + 붉은 테두리, 2틱마다 다시 꺾임) → 잔광(시작점 쪽부터 걷히며 끊긴다).
// 가지는 줄기 중간에서 앞쪽으로 갈라지고, forks는 끝에서 부챗살로 갈라진다. 맞으면 히트스톱 동안 그 순간에 멈춘다 (held).
// 좌표는 2단위 = 1px, 색은 부르는 쪽이 넘긴다 (흰 → 밝은 붉은 → 붉은 → 검붉은 → 아주 어두운).
import type { Frame, Layer } from './impact';

export interface Options {
  /** 줄기가 지나는 길 (2단위, 시작 → 끝). 점 몇 개면 되고 3px마다 다시 찍는다 */
  path: ReadonlyArray<readonly [number, number]>;
  /** 심 굵기 (px): 1 → 3 (1타 → 4타로 굵어진다) */
  width?: number;
  /** 줄기 중간에서 앞쪽으로 갈라지는 가지 수 */
  branches?: number;
  /** 끝에서 부챗살로 갈라지는 갈래 수 */
  forks?: number;
  /** 꺾임 크기 (px) */
  jag?: number;
  /** 전체 길이 (틱, 기본 14) */
  ticks?: number;
  ramp?: readonly number[];
  seed?: number;
  /** 히트스톱으로 멈춰 있는가 */
  held?: () => boolean;
}

const PX = 2;
const REVEAL = 2 / 60;
const DISCHARGE = 8 / 60;

type P = [number, number];

export default function raidenStrike(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xff667aff, 0xff3c3ad9, 0xff2b1f8e, 0xff1a0f4c];
  const W = Math.max(1, Math.min(3, Math.round(o.width ?? 1)));
  const LIFE = (o.ticks ?? 14) / 60;
  const jag = o.jag ?? 1.6;
  // 3px 간격으로 다시 찍은 길: 자리, 접선, 법선, 처음부터의 비율
  const pts: Array<{ x: number; y: number; tx: number; ty: number; u: number }> = [];
  {
    const P = o.path.map(([x, y]) => [x / PX, y / PX] as P);
    const seg: number[] = [];
    let total = 0;
    for (let i = 1; i < P.length; i++) {
      const l = Math.hypot(P[i]![0] - P[i - 1]![0], P[i]![1] - P[i - 1]![1]);
      seg.push(l);
      total += l;
    }
    const n = Math.max(2, Math.round(total / 3));
    for (let k = 0; k <= n; k++) {
      let d = (total * k) / n;
      let i = 0;
      while (i < seg.length - 1 && d > seg[i]!) d -= seg[i++]!;
      const a = P[i]!;
      const b = P[i + 1] ?? a;
      const l = seg[i] || 1;
      const t = Math.min(1, d / l);
      pts.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / l, ty: (b[1] - a[1]) / l, u: k / n });
    }
  }
  const L = pts.length;
  const seed = (o.seed ?? 1) * 7919 + 13;
  const rng = (k: number) => {
    let r = (seed + k * 104729) & 0x7fffffff;
    return () => {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      return r / 0x7fffffff;
    };
  };
  /** 한 벌 (2틱마다 새 모양): 줄기 꺾인 점들, 가지, 끝 갈래 */
  const shapes = new Map<number, { main: Array<[number, number, number]>; side: Array<Array<[number, number]>> }>();
  const shapeAt = (k: number) => {
    let sh = shapes.get(k);
    if (sh) return sh;
    const rand = rng(k);
    const main: Array<[number, number, number]> = pts.map((q, i) => {
      // 양 끝은 제자리 (주먹·발에서 시작하고 끝점에서 끝난다), 가운데만 꺾인다
      const e = i === 0 || i === L - 1 ? 0 : (rand() - 0.5) * 2 * jag;
      return [Math.round(q.x - q.ty * e), Math.round(q.y + q.tx * e), q.u];
    });
    const side: Array<Array<[number, number]>> = [];
    const twig = (q: { x: number; y: number; tx: number; ty: number }, ang: number, len: number) => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const dx = q.tx * c - q.ty * s;
      const dy = q.tx * s + q.ty * c;
      let x = q.x;
      let y = q.y;
      const f: Array<[number, number]> = [[Math.round(x), Math.round(y)]];
      for (let m = 0; m < 3; m++) {
        x += (dx * len) / 3 + (rand() - 0.5) * 2;
        y += (dy * len) / 3 + (rand() - 0.5) * 2;
        f.push([Math.round(x), Math.round(y)]);
      }
      side.push(f);
    };
    // 가지: 줄기 30~80% 자리에서 앞쪽으로 25~55° 갈라진다 (위아래 번갈아)
    for (let b = 0; b < (o.branches ?? 0); b++) {
      const q = pts[Math.floor((0.3 + (0.5 * (b + rand() * 0.6)) / Math.max(1, o.branches ?? 1)) * (L - 1))]!;
      const sign = b % 2 === 0 ? -1 : 1;
      twig(q, sign * (0.45 + rand() * 0.5), 6 + rand() * 6);
    }
    // 끝 갈래: 끝점에서 부챗살 (−30°~+30°)
    const n = o.forks ?? 0;
    for (let b = 0; b < n; b++) {
      const q = pts[L - 1]!;
      const ang = n === 1 ? 0 : -0.55 + (1.1 * b) / (n - 1) + (rand() - 0.5) * 0.2;
      twig(q, ang, 8 + rand() * 6);
    }
    sh = { main, side };
    shapes.set(k, sh);
    return sh;
  };
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
    const r = Math.min(255, (d & 255) + (c & 255) * k);
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
    const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
    f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
  };
  /** 꺾인 마디 하나: 심(core) width px, 양옆 테두리, 둘레 빛 */
  const seg = (f: Frame, a: readonly number[], b: readonly number[], core: number, width: number, rim: boolean, k: number) => {
    const n = Math.max(Math.abs(b[0]! - a[0]!), Math.abs(b[1]! - a[1]!), 1);
    const flat = Math.abs(b[0]! - a[0]!) >= Math.abs(b[1]! - a[1]!);
    const ox = flat ? 0 : 1;
    const oy = flat ? 1 : 0;
    const lo = -Math.floor((width - 1) / 2);
    const hi = lo + width - 1;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a[0]! + ((b[0]! - a[0]!) * s) / n);
      const y = Math.round(a[1]! + ((b[1]! - a[1]!) * s) / n);
      if (rim) {
        put(f, x + (lo - 1) * ox, y + (lo - 1) * oy, C[1]!);
        put(f, x + (hi + 1) * ox, y + (hi + 1) * oy, C[2]!);
      }
      for (let w = lo; w <= hi; w++) put(f, x + w * ox, y + w * oy, core);
      if (k > 0 && s % 2 === 0) for (let q = -3; q <= 3; q++) glow(f, x + q * ox, y + q * oy, C[1]!, k * (1 - Math.abs(q) / 4));
    }
  };

  return {
    /** 빛을 내는 쪽이 쓴다: 단계(0 내달림 · 1 방전 · 2 잔광), 밝기, 시작·가운데·끝 자리(px) */
    phase(): { stage: 0 | 1 | 2; k: number; pts: Array<[number, number]> } {
      const sel = [pts[0]!, pts[Math.floor((L - 1) / 2)]!, pts[L - 1]!].map((q) => [q.x, q.y] as [number, number]);
      if (t < REVEAL) return { stage: 0, k: 1, pts: sel };
      if (t < DISCHARGE) return { stage: 1, k: 1 - ((t - REVEAL) / (DISCHARGE - REVEAL)) * 0.4, pts: sel };
      return { stage: 2, k: Math.max(0, 1 - (t - DISCHARGE) / (LIFE - DISCHARGE)) * 0.5, pts: sel };
    },
    update(dt: number) {
      if (o.held?.() && t < DISCHARGE) return;
      t += dt;
    },
    done() {
      return t >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      // 캐릭터 뒤 겹에만 그린다: 줄기가 상대 몸을 지나가는 자리에서는 몸이 위에 와서 두 실루엣이 그대로 보인다
      // (맞은 자리 불꽃은 부르는 쪽이 앞 겹에 따로 낸다)
      if (layer === 'front') return;
      const lead = Math.min(1, (t + 1 / 60) / REVEAL);
      const disc = t < DISCHARGE;
      const fade = disc ? 0 : (t - DISCHARGE) / (LIFE - DISCHARGE);
      // 잔광: 시작점 쪽부터 걷히고 군데군데 끊기며 깜빡인다
      const tail = disc ? 0 : Math.pow(fade, 0.8);
      if (!disc && Math.floor(t * 40) % 3 === 1) return;
      const sh = shapeAt(Math.floor(t * 30));
      const core = disc ? C[0]! : fade < 0.5 ? C[1]! : C[2]!;
      const width = disc ? W : Math.max(1, W - 1);
      for (let i = 0; i + 1 < sh.main.length; i++) {
        const a = sh.main[i]!;
        const b = sh.main[i + 1]!;
        if (a[2] > lead || b[2] < tail) continue;
        if (fade > 0 && (i * 5) % 7 < fade * 4) continue;
        seg(f, a, b, core, width, disc && W >= 2, disc ? 0.45 : 0.2 * (1 - fade));
      }
      // 가지·끝 갈래: 앞끝이 다 닿은 뒤, 방전 동안과 잔광 앞쪽에만
      if (lead >= 1 && fade < 0.4) {
        for (const fk of sh.side) for (let i = 0; i + 1 < fk.length; i++) seg(f, fk[i]!, fk[i + 1]!, i === 0 ? C[1]! : C[2]!, 1, false, 0);
      }
    },
  };
}
