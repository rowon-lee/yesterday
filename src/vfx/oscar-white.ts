// YESTERDAY: 오스카 필살기 월령수류 — 칼자루에 손을 얹는 순간 화면 전체가 하얗게 물들고, 흰 화면 위로 무수한 검격 선이 그어진다.
// 색이 돌아오면 상대와 그 뒤 배경까지 베여 있다 (캐릭터 기획서 '필살기 연출'). 렌더 전용.
// 앞 겹: white틱 동안 화면 전체 흰색, 그 위로 count줄의 먹빛 베기 선이 차례로 그어진다 (2틱마다 몇 줄씩).
// 흰색이 걷힐 때는 칸마다 정해진 문턱으로 성기게 빠진다 (디더). 그 뒤 뒤 겹: 같은 선들이 배경에 옅은 달빛 상처로 남았다가 끊기며 사라진다.
// 좌표는 2단위 = 1px. 가운데 (x, y) 둘레 화면 너비만큼 선을 긋는다. 색: [흰, 먹, 달빛 밝은, 달빛, 달빛 어두운].
import type { Frame, Layer } from './impact';
import { line, put, rng } from './oscar-px';

export interface Options {
  x: number;
  y: number;
  /** 하얀 화면 틱, 걷히는 틱, 배경에 상처가 남는 틱 */
  white?: number;
  clear?: number;
  scars?: number;
  /** 베기 선 수 (검영이 많을수록 많다) */
  count: number;
  seed?: number;
  ramp?: readonly number[];
}

const PX = 2;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export default function oscarWhite(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xff120a0a, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c];
  const WHITE = o.white ?? 26;
  const CLEAR = o.clear ?? 8;
  const SCARS = o.scars ?? 60;
  const cx = o.x / PX;
  const cy = o.y / PX;
  const rand = rng(o.seed ?? 3);
  // 베기 선: 화면을 가로지르는 긴 선 (길이 120~260px, 기울기 -50~50°), 가운데 둘레에 몰리게
  const lines = Array.from({ length: o.count }, (_, i) => {
    const a = (rand() - 0.5) * 1.75 + (i % 2 ? Math.PI : 0);
    const len = 120 + rand() * 140;
    const ox = (rand() - 0.5) * 140;
    const oy = (rand() - 0.5) * 70 - 20;
    const dx = Math.cos(a) * len * 0.5;
    const dy = Math.sin(a) * len * 0.5;
    return { x0: cx + ox - dx, y0: cy + oy - dy, x1: cx + ox + dx, y1: cy + oy + dy, at: 2 + Math.floor((i / o.count) * (WHITE - 6)) };
  });
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= WHITE + CLEAR + SCARS;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      if (layer === 'back') {
        // 색이 돌아온 뒤: 배경에 남은 상처 (옅은 달빛 선, 끝으로 갈수록 끊겨 사라짐)
        const k = (tick - WHITE) / (CLEAR + SCARS);
        if (k < 0 || k >= 1) return;
        lines.forEach((l, i) => {
          if ((i * 7) % 10 < k * 10) return;
          line(f, l.x0, l.y0, l.x1, l.y1, k < 0.4 ? C[3]! : C[4]!, Math.min(0.9, k), 1);
        });
        return;
      }
      if (tick >= WHITE + CLEAR) return;
      // 하얀 화면 (걷힐 때는 칸마다 문턱으로 성기게)
      const fade = tick < WHITE ? 0 : (tick - WHITE) / CLEAR;
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          if (fade > 0 && (BAYER[((y & 3) << 2) | (x & 3)]! + 0.5) / 16 < fade) continue;
          put(f, x + f.ox, y + f.oy, C[0]!);
        }
      }
      // 베기 선: 그어진 선은 흰 화면 위에 먹빛으로 남는다 (그어지는 2틱은 앞끝이 달린다)
      for (const l of lines) {
        const a = tick - l.at;
        if (a < 0) continue;
        line(f, l.x0, l.y0, l.x1, l.y1, C[1]!, 0, Math.min(1, (a + 1) / 2));
      }
    },
  };
}
