// YESTERDAY: 오스카 검격 (동작연출지침서 7장 오스카: 가는 직선 섬광 여러 줄, 생겼다가 베이고 사라짐). 렌더 전용.
// 칼을 휘두르는 궤적이 아니라, 앞 허공에 은빛 베기 선이 '생겨난다': 선마다 늦게(delay) →
// 그어짐 (2틱, 흰 심이 한쪽 끝에서 다른 끝으로 달린다) → 베임 (1틱, 3px 흰 섬광) → 머무름 (2틱, 달빛 1px + 그늘 1px) →
// 걷힘 (6틱, 처음 그은 끝부터 사라지며 어두워지고 끝에서 은빛 부스러기). 히트스톱 동안(held)은 머무름에서 멈춘다.
// 뒤 겹에는 선을 따라 차가운 빛. 좌표는 2단위 = 1px, 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다].
import type { Frame, Layer } from './impact';
import { glow, line, put, rng } from './oscar-px';

export interface Options {
  /** 선들: [x0, y0, x1, y1, 늦게(틱)] (2단위) */
  lines: ReadonlyArray<readonly [number, number, number, number, number]>;
  ramp?: readonly number[];
  seed?: number;
  /** 히트스톱으로 멈춰 있는가 (멈추면 베인 선이 그대로 머문다) */
  held?: () => boolean;
  /** 굵기 배율 (필살기·차지는 2) */
  weight?: number;
}

const PX = 2;
const DRAW = 2;
const CUT = 1;
const HOLD = 2;
const FADE = 6;
const LIFE = DRAW + CUT + HOLD + FADE;

export default function oscarSlash(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff4a3814];
  const W = o.weight ?? 1;
  const L = o.lines.map(([x0, y0, x1, y1, d]) => ({ x0: x0 / PX, y0: y0 / PX, x1: x1 / PX, y1: y1 / PX, d }));
  const last = Math.max(0, ...L.map((l) => l.d));
  const rand = rng(o.seed ?? 1);
  const motes = L.map(() => Array.from({ length: 3 }, () => ({ vx: (rand() - 0.5) * 1.2, vy: rand() * 0.8 + 0.2, side: rand() < 0.5 ? 0 : 1 })));
  let t = 0;
  return {
    update(dt: number) {
      const tick = t * 60;
      // 히트스톱 동안: 마지막 선까지 베인 뒤 머무름에서 멈춘다
      if (o.held?.() && tick >= DRAW && tick < last + DRAW + CUT + HOLD) {
        const holdAt = last + DRAW + CUT;
        if (tick >= holdAt) return;
      }
      t += dt;
    },
    done() {
      return t * 60 >= last + LIFE + 4;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      L.forEach((l, i) => {
        const a = tick - l.d;
        if (a < 0 || a >= LIFE + 4) return;
        const dx = l.x1 - l.x0;
        const dy = l.y1 - l.y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        if (layer === 'back') {
          // 차가운 빛: 베일 때 가장 세고 걷히며 줄어든다
          const k = a < DRAW ? 0.5 : a < DRAW + CUT + HOLD ? 0.9 : Math.max(0, 0.9 * (1 - (a - DRAW - CUT - HOLD) / FADE));
          if (k <= 0) return;
          const n = Math.max(1, Math.round(len / 2));
          for (let s = 0; s <= n; s += 1) {
            const x = l.x0 + (dx * s) / n;
            const y = l.y0 + (dy * s) / n;
            for (let q = -4; q <= 4; q++) glow(f, x + nx * q, y + ny * q, C[2]!, k * 0.5 * (1 - Math.abs(q) / 5));
          }
          return;
        }
        if (a < DRAW) {
          // 그어짐: 흰 심이 달린다 (앞쪽 끝 2px은 달빛 밝은 색)
          const u = (a + 1) / DRAW;
          line(f, l.x0, l.y0, l.x1, l.y1, C[0]!, 0, u);
          return;
        }
        if (a < DRAW + CUT) {
          // 베임: 3px 흰 섬광 (가운데 흰, 양옆 달빛 밝은)
          for (let q = -W; q <= W; q++) line(f, l.x0 + nx * q, l.y0 + ny * q, l.x1 + nx * q, l.y1 + ny * q, q === 0 ? C[0]! : C[1]!);
          return;
        }
        if (a < DRAW + CUT + HOLD) {
          line(f, l.x0, l.y0, l.x1, l.y1, C[1]!);
          line(f, l.x0 + nx, l.y0 + ny, l.x1 + nx, l.y1 + ny, C[3]!);
          return;
        }
        // 걷힘: 처음 그은 끝부터 사라진다
        const u = (a - DRAW - CUT - HOLD) / FADE;
        if (u < 1) line(f, l.x0, l.y0, l.x1, l.y1, u < 0.5 ? C[2]! : C[3]!, Math.min(1, u * 1.1), 1);
        // 끝에서 떨어지는 은빛 부스러기
        for (const m of motes[i]!) {
          const ex = m.side ? l.x1 : l.x0;
          const ey = m.side ? l.y1 : l.y0;
          const k = a - DRAW - CUT;
          if (k > 0 && k < 9) put(f, ex + m.vx * k, ey + m.vy * k, k < 5 ? C[1]! : C[3]!);
        }
      });
    },
  };
}
