// YESTERDAY: 백은우 흰 나비 떼 (스킬 2 '아직 여기 있어'·등장·필살기, Heal·Sparkle 응용, 렌더 전용, 2단위 = 1px).
// - orbit: 몸 둘레를 타원으로 돈다 (뒤쪽 반 바퀴는 캐릭터 뒤 겹, 앞쪽은 앞 겹). alive()가 거짓이 되면 흩어져 사라진다.
// - gather: 둘레 멀리서 날아와 한 점에 모였다가(hold틱) 흩어진다. 몇 마리는 어깨 둘레를 조금 더 돌다 사라진다 (등장).
// 나비 하나 = 몸 1px + 날개 두 장(펼침 2×2 / 접힘 1px)을 3틱마다 번갈아. 흰 날개, 끝에 연분홍 한 점, 둘레에 옅은 흰 빛.
import type { Frame, Layer } from './impact';

type P = readonly [number, number];
export interface Options {
  /** 가운데 (2단위, 틱마다 다시 읽는다) */
  center: () => P;
  count?: number;
  mode?: 'orbit' | 'gather';
  /** orbit: 살아 있는 동안 (거짓이 되면 흩어진다) */
  alive?: () => boolean;
  /** gather: 모여드는 틱, 모여 있는 틱, 흩어지는 틱 */
  gather?: number;
  hold?: number;
  scatter?: number;
  /** 도는 반지름 (px) */
  radius?: number;
  /** [흰 날개, 그늘, 연분홍, 금빛] */
  ramp?: readonly number[];
  seed?: number;
}

const PX = 2;

export default function eunwooButterflies(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xffe8dcd9, 0xffdec8ff, 0xff4ab8e8];
  const N = o.count ?? 8;
  const R = o.radius ?? 16;
  const mode = o.mode ?? 'orbit';
  const gT = (o.gather ?? 18) / 60;
  const hT = (o.hold ?? 4) / 60;
  const sT = (o.scatter ?? 24) / 60;
  let r = ((o.seed ?? 1) * 7919 + 101) & 0x7fffffff;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  const flies = Array.from({ length: N }, (_, i) => ({
    a: (i / N) * Math.PI * 2 + rand() * 0.6,
    w: (1.6 + rand() * 1.4) * (rand() < 0.5 ? 1 : -1),
    rad: R * (0.7 + rand() * 0.6),
    h: -6 - rand() * 34,
    bob: rand() * Math.PI * 2,
    // gather: 날아오는 출발점 (가운데에서 떨어진 자리), 흩어지는 방향
    sx: (rand() - 0.5) * 140,
    sy: -20 - rand() * 70,
    dx: (rand() - 0.5) * 2,
    dy: -0.6 - rand() * 0.8,
    flap: Math.floor(rand() * 6),
    late: rand() < 0.25,
  }));
  let t = 0;
  let tick = 0;
  let gone = -1;

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
  /** 나비 하나 (x, y px) */
  const fly = (f: Frame, x: number, y: number, open: boolean, k: number) => {
    put(f, x, y, C[1]!);
    if (open) {
      put(f, x - 1, y - 1, C[0]!);
      put(f, x - 2, y - 1, C[0]!);
      put(f, x - 1, y, C[0]!);
      put(f, x + 1, y - 1, C[0]!);
      put(f, x + 2, y - 1, C[0]!);
      put(f, x + 1, y, C[0]!);
      put(f, x - 2, y, C[2]!);
      put(f, x + 2, y, C[2]!);
    } else {
      put(f, x, y - 1, C[0]!);
      put(f, x, y - 2, C[0]!);
    }
    for (let d = -2; d <= 2; d++) glow(f, x + d, y, C[0]!, 0.3 * k * (1 - Math.abs(d) / 3));
  };

  /** 지금 나비 하나의 자리 (px)와 앞뒤(앞이면 true), 밝기 */
  const place = (i: number): [number, number, boolean, number] | null => {
    const b = flies[i]!;
    const c = o.center();
    const cx = c[0] / PX;
    const cy = c[1] / PX;
    if (mode === 'orbit') {
      const a = b.a + b.w * t;
      const fx = cx + Math.cos(a) * b.rad;
      const fy = cy + b.h + Math.sin(a) * b.rad * 0.3 + Math.sin(t * 6 + b.bob) * 2;
      if (gone < 0) return [fx, fy, Math.sin(a) >= 0, 1];
      // 흩어짐: 제자리에서 위·바깥으로 날아가며 사라진다
      const u = (t - gone) / sT;
      if (u >= 1) return null;
      return [fx + b.dx * u * 40, fy + b.dy * u * 50, true, 1 - u];
    }
    // gather: 출발점 → 가운데로 휘감아 모인다 → 흩어진다 (늦은 몇 마리는 어깨 둘레를 더 돈다)
    if (t < gT) {
      const u = t / gT;
      const e = u * u * (3 - 2 * u);
      const swirl = (1 - e) * 1.2;
      const ox = b.sx * (1 - e);
      const oy = b.sy * (1 - e) + (b.h * 0.5) * e;
      return [cx + ox * Math.cos(swirl) - oy * Math.sin(swirl) * 0.3, cy + oy + Math.sin(t * 8 + b.bob) * 2, true, 1];
    }
    if (t < gT + hT) return [cx + Math.cos(b.a + t * 9) * 5, cy + b.h * 0.5 + Math.sin(b.a + t * 9) * 4, true, 1];
    const u = (t - gT - hT) / sT;
    if (b.late) {
      // 어깨 둘레를 조금 더 돌다 사라진다
      const v = (t - gT - hT) / (sT * 2);
      if (v >= 1) return null;
      const a = b.a + t * 3;
      return [cx + Math.cos(a) * 9, cy - 38 + Math.sin(a) * 3, Math.sin(a) >= 0, 1 - v];
    }
    if (u >= 1) return null;
    return [cx + Math.cos(b.a) * u * 60 + b.dx * u * 20, cy + b.h * 0.5 + b.dy * u * 60 - u * 20, true, 1 - u];
  };

  return {
    /** 빛을 내는 쪽이 쓴다: 가운데(px)와 세기 */
    phase(): { k: number; c: [number, number] } {
      const c = o.center();
      const k = mode === 'orbit' ? (gone < 0 ? 1 : Math.max(0, 1 - (t - gone) / sT)) : t < gT + hT ? Math.min(1, t / gT + 0.2) : Math.max(0, 1 - (t - gT - hT) / sT);
      return { k, c: [c[0] / PX, c[1] / PX - 24] };
    },
    update(dt: number) {
      t += dt;
      tick++;
      if (mode === 'orbit' && gone < 0 && o.alive && !o.alive()) gone = t;
    },
    done() {
      if (mode === 'orbit') return gone >= 0 && t - gone >= sT;
      return t >= gT + hT + sT * 2;
    },
    draw(f: Frame, layer?: Layer) {
      for (let i = 0; i < N; i++) {
        const p = place(i);
        if (!p) continue;
        const [x, y, front, k] = p;
        if ((layer === 'back') === front) continue;
        // 사라질 때는 성기게 (깜빡이며)
        if (k < 0.5 && (tick + i) % 3 === 0) continue;
        fly(f, x, y, ((tick + flies[i]!.flap) >> 1) % 3 !== 0, k);
      }
    },
  };
}
