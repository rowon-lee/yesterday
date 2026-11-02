// YESTERDAY: 오스카 베기 선 (캐릭터 기획서 13-0 '베기의 문법'). 렌더 전용, 앞 겹(선)·뒤 겹(차가운 빛).
// 그려지는 과정 없이 한 번에 전체 길이로 생긴다: 0틱 흰 심 1px + 양쪽 은빛 테두리 → 1~6틱 흰 심 + 한쪽 테두리 →
// 6~10틱 은빛 심 → 10~20틱 가운데부터 끊어지며 은빛 가루로 흩어진다 (그 자리에 검영이 남는다: oscar-shadows).
// 선 끝에는 아주 작은 반짝임(3px 십자)만 0~3틱. 히트스톱 동안(held)은 3틱(늦게 맞는 순간)부터 멈춰 선이 그대로 머문다.
// 좌표는 월드 px. 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은].
import type { Frame, Layer } from './impact';
import { glow, put, rng } from './oscar-px';

export interface Options {
  /** 선들 [x0, y0, x1, y1] (월드 px) */
  lines: ReadonlyArray<readonly [number, number, number, number]>;
  ramp?: readonly number[];
  seed?: number;
  /** 히트스톱으로 멈춰 있는가 */
  held?: () => boolean;
  /** 선마다 생기는 늦음 (틱) */
  delays?: readonly number[];
}

const HOLD = 10;
const LIFE = 20;

export default function oscarCut(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff806629];
  const rand = rng(o.seed ?? 1);
  const L = o.lines.map(([x0, y0, x1, y1], i) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    // 가루: 선을 따라 고르게 (끊어지는 자리에서 떠올라 옆으로 흩어지며 가라앉는다)
    const motes = Array.from({ length: Math.ceil(len / 6) }, (_, k) => ({
      u: (k + rand()) / Math.ceil(len / 6),
      side: rand() < 0.5 ? -1 : 1,
      drift: 0.15 + rand() * 0.35,
      fall: 0.1 + rand() * 0.25,
      lit: rand() < 0.35,
    }));
    return { x0, y0, len, ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, d: o.delays?.[i] ?? 0, motes };
  });
  const last = Math.max(0, ...L.map((l) => l.d));
  let t = 0;
  return {
    update(dt: number) {
      const tick = t * 60;
      // 히트스톱: 늦게 맞은 순간(3틱)부터 선이 그대로 머문다
      if (o.held?.() && tick >= 3 && tick < last + HOLD) return;
      t += dt;
    },
    done() {
      return t * 60 >= last + LIFE + 1;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      for (const l of L) {
        const a = tick - l.d;
        if (a < 0 || a >= LIFE) continue;
        if (layer === 'back') {
          // 선을 따라 차가운 빛 (처음 8틱)
          if (a >= 8) continue;
          const k = 0.55 * (1 - a / 8);
          for (let s = 0; s <= l.len; s += 2) {
            const x = l.x0 + l.ux * s;
            const y = l.y0 + l.uy * s;
            glow(f, x + l.nx * 2, y + l.ny * 2, C[4]!, k * 0.6);
            glow(f, x - l.nx * 2, y - l.ny * 2, C[4]!, k * 0.6);
            glow(f, x, y, C[1]!, k);
          }
          continue;
        }
        // 가운데부터 끊어진다: 끊어진 반 길이
        const gap = a < HOLD ? 0 : ((a - HOLD) / (LIFE - HOLD)) * (l.len / 2 + 2);
        const core = a < 6 ? C[0]! : a < HOLD ? C[1]! : C[2]!;
        const rim = a < 6 ? C[2]! : C[3]!;
        const mid = l.len / 2;
        for (let s = 0; s <= l.len; s++) {
          if (Math.abs(s - mid) < gap) continue;
          const x = l.x0 + l.ux * s;
          const y = l.y0 + l.uy * s;
          put(f, x, y, core);
          if (a < 1) {
            put(f, x + l.nx, y + l.ny, rim);
            put(f, x - l.nx, y - l.ny, rim);
          } else if (a < HOLD) put(f, x + l.nx, y + l.ny, rim);
        }
        // 선 끝의 아주 작은 반짝임 (0~3틱): 가운데 흰 점 + 팔 1px
        if (a < 3) {
          for (const e of [0, l.len]) {
            const x = l.x0 + l.ux * e;
            const y = l.y0 + l.uy * e;
            put(f, x, y, C[0]!);
            if (a < 2) {
              put(f, x + 1, y, C[1]!);
              put(f, x - 1, y, C[1]!);
              put(f, x, y + 1, C[1]!);
              put(f, x, y - 1, C[1]!);
            }
          }
        }
        // 가루: 끊어진 자리에서 은빛 점이 옆으로 흩어지며 가라앉고, 끝으로 갈수록 성기게
        if (a >= HOLD) {
          const b = a - HOLD;
          for (const m of l.motes) {
            const s = m.u * l.len;
            if (Math.abs(s - mid) >= gap) continue;
            const since = Math.max(0, b - (Math.abs(s - mid) / (l.len / 2 + 2)) * (LIFE - HOLD));
            if (since > 9 || (since > 5 && (Math.floor(since) + Math.round(s)) % 2 === 0)) continue;
            const x = l.x0 + l.ux * s + l.nx * m.side * m.drift * since;
            const y = l.y0 + l.uy * s + l.ny * m.side * m.drift * since + m.fall * since;
            put(f, x, y, m.lit && since < 4 ? C[1]! : since < 5 ? C[2]! : C[3]!);
          }
        }
      }
    },
  };
}
