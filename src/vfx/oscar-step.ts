// YESTERDAY: 오스카 2단 점프 — 허공에 생긴 작은 검영(은빛 칼 그림자)을 한 발로 밟고 뛴다 (캐릭터 기획서 '움직임').
// 발밑에 가로로 누운 검영이 번쩍 생겼다가, 밟히면 두 동강 나 떨어지며 사라진다. 렌더 전용, 앞 겹.
// 좌표는 2단위 = 1px. 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다].
import type { Frame, Layer } from './impact';
import { glowLine, line, put } from './oscar-px';

export interface Options {
  x: number;
  y: number;
  /** 바라보는 쪽 (검영 칼끝이 앞) */
  facing: number;
  ramp?: readonly number[];
}

const PX = 2;
const LIFE = 22;

export default function oscarStep(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff4a3814];
  const cx = o.x / PX;
  const cy = o.y / PX + 2;
  const half = 8;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      if (layer === 'back') {
        if (tick < 8) glowLine(f, cx - half, cy, cx + half, cy, C[2]!, 0.5 * (1 - tick / 8), 4);
        return;
      }
      if (tick < 2) {
        // 번쩍 생긴다: 흰 칼 그림자 한 줄 + 칼끝
        line(f, cx - half, cy, cx + half, cy, C[0]!);
        put(f, cx + o.facing * (half + 1), cy, C[1]!);
        return;
      }
      if (tick < 6) {
        line(f, cx - half, cy, cx + half, cy, C[1]!);
        line(f, cx - half + 2, cy + 1, cx + half - 2, cy + 1, C[4]!);
        return;
      }
      // 밟혀 두 동강: 가운데가 갈라져 양쪽 조각이 기울며 떨어진다
      const u = (tick - 6) / (LIFE - 6);
      const drop = u * u * 10;
      const spread = u * 4;
      const c = u < 0.5 ? C[2]! : C[3]!;
      if (Math.floor(tick) % 3 === 2 && u > 0.6) return;
      line(f, cx - half - spread, cy + drop * 0.6, cx - 1 - spread, cy + drop, c);
      line(f, cx + 1 + spread, cy + drop, cx + half + spread, cy + drop * 0.6, c);
    },
  };
}
