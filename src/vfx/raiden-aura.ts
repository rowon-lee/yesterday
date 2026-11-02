// YESTERDAY: 라이덴 손발 전격 — 공격하는 동안 치는 손발 끝에서 작은 전격 갈래가 튀고, 끝이 움직인 길에 짧게 꺾인 전격 꼬리가 남는다
// (렌더 전용, 사용자 피드백 2026-11-01 '번개로'). 캐릭터를 따라다니며 틱마다 관절 자리를 읽는다.
// 세기(level 0~1): 감기 때 약하게 → 타격 순간 가장 세게 → 여운·복귀에서 줄어든다. 큰 초승달 궤적은 raiden-trail.ts가 그린다.
// 좌표는 2단위 = 1px, 색은 부르는 쪽이 넘긴다 (흰 → 밝은 붉은 → 붉은 → 검붉은).
import type { Frame, Layer } from './impact';

type P = readonly [number, number];
/** 월드 관절 (2단위) */
export interface AuraJoints {
  hip: P;
  neck: P;
  head: P;
  shF: P;
  eF: P;
  hF: P;
  shB: P;
  eB: P;
  hB: P;
  kF: P;
  fF: P;
  kB: P;
  fB: P;
}

export interface Options {
  /** 지금 관절 자리 (없으면 그리지 않는다) */
  joints: () => AuraJoints | null;
  /** 지금 세기 0~1 */
  level: () => number;
  /** 계속 살아 있는가 (거짓이 되면 FADE초 동안 사그라든다) */
  alive: () => boolean;
  /** 치는 손발 끝 (전격이 튀는 곳) */
  tip?: 'hF' | 'hB' | 'fF' | 'fB' | 'kF' | 'kB';
  ramp?: readonly number[];
  seed?: number;
}

const PX = 2;
const FADE = 0.12;
/** 잔광 꼬리에 남기는 끝 자리 수 (틱) */
const HISTORY = 6;

export default function raidenAura(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xff667aff, 0xff3c3ad9, 0xff2b1f8e];
  const tipName = o.tip ?? 'hF';
  let t = 0;
  let dead = -1;
  let tick = 0;
  const hist: Array<[number, number]> = [];

  const put = (f: Frame, x: number, y: number, c: number) => {
    x = Math.round(x - f.ox);
    y = Math.round(y - f.oy);
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
    const b = f.box;
    if (b) {
      if (x < b[0]!) b[0] = x;
      if (y < b[1]!) b[1] = y;
      if (x > b[2]!) b[2] = x;
      if (y > b[3]!) b[3] = y;
    }
    f.color[y * f.w + x] = c >>> 0;
  };
  const glow = (f: Frame, x: number, y: number, c: number, k: number) => {
    x = Math.round(x - f.ox);
    y = Math.round(y - f.oy);
    if (x < 0 || y < 0 || x >= f.w || y >= f.h || k <= 0) return;
    const i = y * f.w + x;
    const d = f.light[i]!;
    const r = Math.min(255, (d & 255) + (c & 255) * k);
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
    const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
    f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
  };

  return {
    update(dt: number) {
      t += dt;
      tick++;
      if (dead < 0 && !o.alive()) dead = t;
      const J = o.joints();
      if (J) {
        const p = J[tipName];
        hist.unshift([p[0] / PX, p[1] / PX]);
        if (hist.length > HISTORY) hist.pop();
      }
    },
    done() {
      return dead >= 0 && t - dead >= FADE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back' || !hist.length) return;
      const fade = dead >= 0 ? Math.max(0, 1 - (t - dead) / FADE) : 1;
      const level = Math.max(0, Math.min(1, o.level())) * fade;
      if (level <= 0.02) return;
      const [tx, ty] = hist[0]!;
      // 2틱마다 새로 꺾인다 (지직거림)
      let r = ((o.seed ?? 1) * 7919 + Math.floor(tick / 2) * 104729) & 0x7fffffff;
      const rand = () => {
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        return r / 0x7fffffff;
      };
      const line = (a: readonly number[], b: readonly number[], c: number) => {
        const n = Math.max(1, Math.round(Math.max(Math.abs(b[0]! - a[0]!), Math.abs(b[1]! - a[1]!))));
        for (let s = 0; s <= n; s++) put(f, a[0]! + ((b[0]! - a[0]!) * s) / n, a[1]! + ((b[1]! - a[1]!) * s) / n, c);
      };
      // 전격 꼬리: 끝이 지난 몇 틱의 자리를 꺾인 번개로 잇는다 (빨리 움직일 때만 길게 보인다)
      for (let i = 0; i + 1 < hist.length; i++) {
        const a = hist[i]!;
        const b = hist[i + 1]!;
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d < 1) continue;
        const nx = -(b[1] - a[1]) / d;
        const ny = (b[0] - a[0]) / d;
        const j1 = (rand() - 0.5) * 3;
        const m = [(a[0] + b[0]) / 2 + nx * j1, (a[1] + b[1]) / 2 + ny * j1];
        const c = i < 2 ? C[0]! : i < 4 ? C[1]! : C[2]!;
        line(a, m, c);
        line(m, b, c);
      }
      // 손발 둘레로 튀는 작은 전격 갈래 (세기만큼)
      const n = Math.round(1 + 3 * level);
      for (let k = 0; k < n; k++) {
        const ang = rand() * Math.PI * 2;
        const len = 3 + rand() * (3 + 4 * level);
        let x = tx;
        let y = ty;
        for (let q = 0; q < 3; q++) {
          const nx2 = x + Math.cos(ang) * (len / 3) + (rand() - 0.5) * 2;
          const ny2 = y + Math.sin(ang) * (len / 3) + (rand() - 0.5) * 2;
          line([x, y], [nx2, ny2], q === 0 ? C[0]! : q === 1 ? C[1]! : C[2]!);
          x = nx2;
          y = ny2;
        }
      }
      for (let d = -3; d <= 3; d++) glow(f, tx + d, ty, C[1]!, 0.35 * level * (1 - Math.abs(d) / 4));
    },
  };
}
