// YESTERDAY: 오스카 스킬 1 월하참뢰검 (캐릭터 기획서 13-3). 렌더 전용, 앞 겹.
// 0~cut틱: 표식 — 앞으로 그어질 선(120px)이 아주 옅은 점선으로 미리 보이고 (점이 천천히 흐른다), 빗방울이 선 쪽으로 빨려 든다.
// (선을 따라 공기가 일렁이는 진공 왜곡은 render/screenfx의 어긋남으로 따로 건다)
// cut+4 ~ cut+18틱: 진공 자리로 둘레의 비와 먼지가 빨려 들었다가 (6틱) 터지며 흩어진다.
// 좌표는 월드 px. 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 빗방울(어두운 회색)].
import type { Frame, Layer } from './impact';
import { glow, put, rng } from './oscar-px';

export interface Options {
  /** 앞으로 그어질 선 [x0, y0, x1, y1] (월드 px) */
  line: readonly [number, number, number, number];
  /** 실선이 되는 틱 (점선은 그때까지) */
  cut: number;
  ramp?: readonly number[];
  seed?: number;
}

export default function oscarMark(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff6a6058];
  const [x0, y0, x1, y1] = o.line;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rand = rng(o.seed ?? 7);
  // 빨려 드는 빗방울: 선 옆 12~44px에서 출발해 선까지 (출발 틱이 다르다)
  const drops = Array.from({ length: 16 }, () => ({ u: rand() * len, side: rand() < 0.5 ? -1 : 1, d: 12 + rand() * 32, at: rand() * (o.cut - 6), speed: 2.2 + rand() * 1.6 }));
  // 진공: 빨려 들었다 터지는 비·먼지 알갱이 (둘레 원에서)
  const grit = Array.from({ length: 22 }, () => ({ a: rand() * Math.PI * 2, r: 20 + rand() * 26, out: 18 + rand() * 30, dust: rand() < 0.4 }));
  const END = o.cut + 18;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= END;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      if (layer === 'back') {
        if (tick < o.cut) for (let s = 0; s <= len; s += 4) glow(f, x0 + ux * s, y0 + uy * s, C[2]!, 0.1 + 0.25 * (tick / o.cut));
        return;
      }
      if (tick < o.cut) {
        // 점선: 4px마다 2px, 점이 선을 따라 천천히 흐른다 (끝으로 갈수록 성기고, 벨 때가 다가올수록 밝다)
        const shift = Math.floor(tick / 2) % 4;
        const c = tick > o.cut - 5 ? C[1]! : tick > o.cut / 2 ? C[2]! : C[3]!;
        for (let s = 0; s <= len; s++) {
          if ((s + shift) % 4 > 1) continue;
          const edge = Math.min(s, len - s);
          if (edge < 10 && (s + shift) % 8 > 1) continue;
          put(f, x0 + ux * s, y0 + uy * s, c);
        }
        // 빨려 드는 빗방울 (1×3px, 선 쪽으로 기운다)
        for (const d of drops) {
          const a = tick - d.at;
          if (a < 0) continue;
          const left = d.d - a * d.speed;
          if (left < 1) continue;
          const bx = x0 + ux * d.u + nx * d.side * left;
          const by = y0 + uy * d.u + ny * d.side * left;
          for (let k = 0; k < 3; k++) put(f, bx - nx * d.side * k, by - ny * d.side * k, k === 0 ? C[3]! : C[4]!);
        }
        return;
      }
      // 진공: cut+4 ~ +10 빨려 듦, +10 ~ +18 터짐
      const a = tick - o.cut - 4;
      if (a < 0) return;
      for (const g of grit) {
        const r = a < 6 ? g.r * (1 - a / 6) : g.out * ((a - 6) / 12) + 2;
        if (a >= 6 && (a - 6) > 9 && (Math.round(g.a * 10) + Math.floor(a)) % 2 === 0) continue;
        const x = cx + Math.cos(g.a) * r;
        const y = cy + Math.sin(g.a) * r * 0.8 + (a >= 6 ? (a - 6) * 0.25 : 0);
        put(f, x, y, g.dust ? C[3]! : a < 6 ? C[4]! : C[2]!);
        if (!g.dust && a < 6) put(f, x - Math.cos(g.a), y - Math.sin(g.a), C[4]!);
      }
      // 터지는 순간 가운데 작은 흰 점 (2틱)
      if (a >= 6 && a < 8) {
        put(f, cx, cy, C[0]!);
        put(f, cx + 1, cy, C[1]!);
        put(f, cx - 1, cy, C[1]!);
      }
    },
  };
}
