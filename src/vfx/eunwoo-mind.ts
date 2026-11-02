// YESTERDAY: 백은우 필살기 '선의' — 백합이 핀 잔잔한 물가의 심상세계 (화면 전환, Holy Light·Sparkle, 렌더 전용).
// 캐릭터 뒤 겹에 화면 전체를 덮어 그린다: 위는 옅은 회청 하늘(아래로 밝아짐)과 반짝임, 수평선 아래는 잔잔한 물(가로 물결 줄이 흐른다),
// 물 위에 백합이 봉오리에서 피어난다(bloom 0~1), 은우 자리에 위에서 내리는 흰 빛기둥(빛 버퍼).
// 들어올 때는 은우 발밑에서 물결 고리가 퍼지며(디더) 바뀌고, 끝에는 점점 옅어지며 원래 거리로 돌아온다.
// 색: [하늘 위, 하늘 가운데, 수평선, 물, 물결 밝음, 물결 흰, 반짝임] + 백합 색은 eunwoo-lily drawLily와 같다.
import type { Frame, Layer } from './impact';
import { drawLily } from './eunwoo-lily';

type P = readonly [number, number];
export interface Options {
  /** 은우 발밑 (2단위, 틱마다) */
  origin: () => P;
  /** 상대 발밑 (2단위, 틱마다): 백합이 그 둘레에 핀다 */
  target: () => P;
  /** 백합이 피어난 정도 0~1 (틱마다) */
  bloom: () => number;
  /** 연출이 이어지는 동안 참 (거짓이 되면 옅어지며 끝난다) */
  alive: () => boolean;
  sky: readonly number[];
  lily: readonly number[];
  seed?: number;
}

const PX = 2;
const IN = 14 / 60;
const OUT = 16 / 60;

export default function eunwooMind(o: Options) {
  let t = 0;
  let end = -1;
  let r = ((o.seed ?? 1) * 7919 + 3) & 0x7fffffff;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  // 백합 자리 (상대 발밑 기준 px, 앞뒤 깊이는 수평선 아래 거리로)
  // 바닥(3D 땅)이 캐릭터 판 아래를 가리므로 백합은 발밑 줄 바로 위에 띄운다
  const lilies = Array.from({ length: 14 }, (_, i) => ({ dx: (rand() - 0.5) * 150, dy: -1 - rand() * 3, delay: (i % 7) * 0.08 + rand() * 0.08 }));
  const stars = Array.from({ length: 22 }, () => ({ x: rand(), y: rand() * 0.8, p: rand() * 6 }));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  return {
    /** 빛을 내는 쪽이 쓴다: 세기 0~1 */
    level(): number {
      if (end >= 0) return Math.max(0, 1 - (t - end) / OUT);
      return Math.min(1, t / IN);
    },
    update(dt: number) {
      t += dt;
      if (end < 0 && !o.alive()) end = t;
    },
    done() {
      return end >= 0 && t - end >= OUT;
    },
    draw(f: Frame, layer?: Layer) {
      const a = o.origin();
      const ax = a[0] / PX;
      const ay = a[1] / PX;
      const tg = o.target();
      const tx = tg[0] / PX;
      const horizon = Math.round(ay - f.oy);
      const k = end >= 0 ? Math.max(0, 1 - (t - end) / OUT) : Math.min(1, t / IN);
      if (k <= 0) return;
      const S = o.sky;
      if (layer === 'back') {
        // 들어올 때: 은우 발밑에서 퍼지는 고리 안쪽만 바뀐다. 나갈 때: 디더로 옅어진다
        const ring = end < 0 ? (t / IN) * 520 : 1e9;
        for (let y = 0; y < f.h; y++) {
          const wy = y + f.oy;
          for (let x = 0; x < f.w; x++) {
            const wx = x + f.ox;
            const dist = Math.hypot(wx - ax, (wy - ay) * 1.6);
            if (dist > ring) continue;
            const th = (BAYER[((wy & 3) << 2) | (wx & 3)]! + 0.5) / 16;
            if (k < 1 && k <= th) continue;
            let c: number;
            if (y < horizon) {
              // 하늘: 위는 어둡고 수평선 가까이 밝다 (경계에서만 디더)
              const v = (horizon - y) / Math.max(1, horizon);
              const g = v * 3 + (th - 0.5) * 0.35;
              c = g > 2 ? S[0]! : g > 1 ? S[1]! : S[2]!;
            } else {
              // 물: 가로 물결 줄이 천천히 흐른다
              const d = y - horizon;
              const wave = Math.sin(wx * 0.18 + t * 2 + d * 0.9) + Math.sin(wx * 0.05 - t * 1.3);
              c = d % 4 === 1 && wave > 1.1 ? S[5]! : d % 3 === 0 && wave > 0.5 ? S[4]! : S[3]!;
            }
            f.color[y * f.w + x] = c >>> 0;
          }
        }
        const b = f.box;
        if (b) {
          b[0] = 0;
          b[1] = 0;
          b[2] = f.w - 1;
          b[3] = f.h - 1;
        }
        // 반짝임 (하늘)
        for (const s of stars) {
          if (Math.sin(t * 4 + s.p) < 0.2) continue;
          const x = Math.round(s.x * (f.w - 1));
          const y = Math.round(s.y * Math.max(1, horizon - 2));
          if (y >= 0 && y < f.h) f.color[y * f.w + x] = S[6]! >>> 0;
        }
        return;
      }
      // 앞 겹: 물 위의 백합 (봉오리 → 핌)과 은우 위로 내리는 빛기둥
      const bloom = o.bloom();
      const pen = {
        put: (x: number, y: number, c: number) => {
          const px = Math.round(x - f.ox);
          const py = Math.round(y - f.oy);
          if (px < 0 || py < 0 || px >= f.w || py >= f.h) return;
          f.color[py * f.w + px] = c >>> 0;
          const b = f.box;
          if (b) {
            if (px < b[0]!) b[0] = px;
            if (py < b[1]!) b[1] = py;
            if (px > b[2]!) b[2] = px;
            if (py > b[3]!) b[3] = py;
          }
        },
        glow: (x: number, y: number, c: number, kk: number) => {
          const px = Math.round(x - f.ox);
          const py = Math.round(y - f.oy);
          if (px < 0 || py < 0 || px >= f.w || py >= f.h || kk <= 0) return;
          const i = py * f.w + px;
          const d = f.light[i]!;
          const rr = Math.min(255, (d & 255) + (c & 255) * kk);
          const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * kk);
          const bl = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * kk);
          f.light[i] = ((255 << 24) | (bl << 16) | (g << 8) | rr) >>> 0;
        },
      };
      if (k > 0.5) {
        for (const l of lilies) {
          const s = Math.max(0, Math.min(1, (bloom - l.delay) / 0.4));
          drawLily(pen, tx + l.dx, ay + l.dy, s, o.lily, 0.6 * k);
        }
      }
      // 빛기둥: 은우 머리 위에서 내리는 부드러운 흰 빛 (가장자리로 갈수록 옅어진다)
      for (let y = Math.round(ay - 90); y < ay; y += 2) {
        for (let dx = -10; dx <= 10; dx += 2) {
          const kk = 0.18 * k * (1 - Math.abs(dx) / 11) * Math.min(1, (y - (ay - 90)) / 30);
          pen.glow(ax + dx, y, S[6]!, kk);
        }
      }
    },
  };
}
