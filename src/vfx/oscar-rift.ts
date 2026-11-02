// YESTERDAY: 오스카 등장 — 허공에 은빛 선이 그어지고 공간이 잘려 열린다. 그 틈에서 오스카가 걸어 나오고, 뒤에서 틈이 조용히 닫힌다
// (캐릭터 기획서 '등장 연출', 설정: 월하윤회괤의 아공간 개폐). 렌더 전용, 앞 겹: 틈의 어둠이 아직 안에 있는 몸을 덮는다.
// 좌표는 2단위 = 1px. 색은 부르는 쪽이 넘긴다: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다, 틈 속 어둠].
import type { Frame, Layer } from './impact';
import { glow, glowLine, line, put, rng } from './oscar-px';

export interface Options {
  /** 틈 아래 끝 (발밑 높이, 2단위) */
  x: number;
  y: number;
  /** 틈 높이·가장 벌어진 폭 (px) */
  height?: number;
  width?: number;
  ramp?: readonly number[];
  seed?: number;
  /** 틱 (60분의 1초): 선을 긋는 동안, 벌어지는 끝, 닫히기 시작, 닫힘 끝, 사라짐 끝 */
  times?: { cut: number; open: number; close: number; shut: number; end: number };
}

const PX = 2;

export default function oscarRift(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff4a3814, 0xff0e0407];
  const H = o.height ?? 62;
  const W = o.width ?? 26;
  const T = o.times ?? { cut: 1, open: 4, close: 44, shut: 54, end: 62 };
  const x0 = o.x / PX;
  const yb = o.y / PX + 1;
  const yt = yb - H;
  const rand = rng(o.seed ?? 1);
  // 테두리에서 떨어지는 은빛 부스러기 (자리만 미리)
  const motes = Array.from({ length: 10 }, () => ({ v: 0.1 + rand() * 0.8, side: rand() < 0.5 ? -1 : 1, drift: 2 + rand() * 6, at: T.open + rand() * (T.close - T.open) }));
  let t = 0;
  /** 지금 틈이 벌어진 정도 (0~1) */
  const openness = (tick: number): number => {
    if (tick < T.cut) return 0;
    if (tick < T.open) return (tick - T.cut) / (T.open - T.cut);
    if (tick < T.close) return 1;
    if (tick < T.shut) return 1 - (tick - T.close) / (T.shut - T.close);
    return 0;
  };
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= T.end;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      if (layer === 'back') {
        // 틈 둘레의 차가운 빛 (뒤 겹: 벽과 몸을 비추는 빛)
        const k = Math.min(1, tick / T.cut) * (tick < T.shut ? 1 : Math.max(0, 1 - (tick - T.shut) / (T.end - T.shut)));
        glowLine(f, x0, yt, x0, yb, C[2]!, 0.35 * k, 6);
        return;
      }
      const open = openness(tick);
      if (tick < T.cut) {
        // 은빛 선이 위에서 아래로 그어진다
        const u = tick / T.cut;
        line(f, x0, yt, x0, yb, C[0]!, 0, u);
        glowLine(f, x0, yt, x0, yt + H * u, C[1]!, 0.6, 3);
        return;
      }
      if (open <= 0) {
        // 닫힌 뒤: 선만 남아 어두워지며 사라진다 (깜빡이며)
        const k = 1 - (tick - T.shut) / (T.end - T.shut);
        if (k > 0 && Math.floor(tick) % 3 !== 2) line(f, x0, yt + H * 0.1, x0, yb - H * 0.05, k > 0.5 ? C[2]! : C[3]!);
        return;
      }
      // 벌어진 틈: 위아래 끝이 뾰족한 긴 렌즈 꼴. 안은 어둠, 둘레는 1px 달빛 테두리, 그 안쪽 1px 짙은 바다
      const shimmer = Math.floor(tick / 3) % 2;
      for (let yy = Math.ceil(yt); yy <= Math.floor(yb); yy++) {
        const v = (yy - yt) / H;
        const half = (W / 2) * open * Math.pow(Math.sin(Math.PI * Math.min(0.97, v)), 0.45);
        if (half < 0.5) {
          put(f, x0, yy, C[1]!);
          continue;
        }
        const l = Math.round(x0 - half);
        const r = Math.round(x0 + half);
        for (let xx = l; xx <= r; xx++) {
          const edge = xx === l || xx === r;
          const inner = xx === l + 1 || xx === r - 1;
          put(f, xx, yy, edge ? (shimmer ? C[1]! : C[2]!) : inner ? C[4]! : C[5]!);
        }
        glow(f, l - 1, yy, C[2]!, 0.4 * open);
        glow(f, r + 1, yy, C[2]!, 0.4 * open);
      }
      // 테두리에서 떨어지는 은빛 부스러기
      for (const m of motes) {
        const age = tick - m.at;
        if (age < 0 || age > 14) continue;
        const v = m.v;
        const half = (W / 2) * open * Math.pow(Math.sin(Math.PI * Math.min(0.97, v)), 0.45);
        put(f, x0 + m.side * (half + 1 + age * 0.3), yt + H * v + age * (m.drift / 14) * 2, age < 7 ? C[1]! : C[3]!);
      }
    },
  };
}
