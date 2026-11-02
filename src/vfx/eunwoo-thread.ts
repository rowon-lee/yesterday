// YESTERDAY: 백은우 금색 실·은빛 와이어 — 두 점 사이에 쏘아 나가는 가는 실 (렌더 전용, 2단위 = 1px).
// 대시·순간이동(응답)은 금색 실을 따라 미끄러지고, 내려찍기·차지(스텔라리스 발도)는 은빛 와이어를 던져 감아 챈다.
// 순서: 쏘아 나감(shoot틱 동안 시작점에서 끝점까지 뻗음) → 팽팽히 머묾(hold틱, 빛 알갱이가 실을 따라 달린다) → 거둠(끝에서 시작점으로 감겨 들어감)
// 또는 끊김(retract 없으면 가운데부터 흩어짐). 시작·끝은 틱마다 다시 읽는다 (손과 상대를 따라간다).
import type { Frame, Layer } from './impact';

type P = readonly [number, number];
export interface Options {
  /** 시작점·끝점 (2단위, 틱마다 다시 읽는다) */
  from: () => P;
  to: () => P;
  /** 쏘아 나가는 틱, 머무는 틱, 거두는 틱 */
  shoot?: number;
  hold?: number;
  back?: number;
  /** 거둘 때 끝에서 시작점으로 감겨 들어간다 (없으면 흩어진다) */
  retract?: boolean;
  /** 처짐 (px): 실 가운데가 이만큼 아래로 */
  sag?: number;
  /** 굵기 1·2 */
  width?: number;
  /** [밝은 심, 바탕, 어두운] */
  ramp?: readonly number[];
  seed?: number;
  /** 히트스톱으로 멈춰 있는가 */
  held?: () => boolean;
}

const PX = 2;

export default function eunwooThread(o: Options) {
  const C = o.ramp ?? [0xffa0f0ff, 0xff4ab8e8, 0xff26729b];
  const shoot = (o.shoot ?? 2) / 60;
  const hold = (o.hold ?? 6) / 60;
  const back = (o.back ?? 5) / 60;
  const life = shoot + hold + back;
  const sag = o.sag ?? 3;
  let t = 0;
  let tick = 0;

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

  return {
    /** 실의 끝점과 밝기 (빛을 내는 쪽) */
    phase(): { k: number; a: [number, number]; b: [number, number] } {
      const a = o.from();
      const b = o.to();
      return { k: t < shoot + hold ? 1 : Math.max(0, 1 - (t - shoot - hold) / back), a: [a[0] / PX, a[1] / PX], b: [b[0] / PX, b[1] / PX] };
    },
    update(dt: number) {
      if (o.held?.()) return;
      t += dt;
      tick++;
    },
    done() {
      return t >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      const a = o.from();
      const b = o.to();
      const ax = a[0] / PX;
      const ay = a[1] / PX;
      const bx = b[0] / PX;
      const by = b[1] / PX;
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(2, Math.ceil(len));
      // 보이는 구간 [u0, u1]
      let u0 = 0;
      let u1 = 1;
      if (t < shoot) u1 = Math.min(1, (t + 1 / 60) / shoot);
      else if (t >= shoot + hold) {
        const k = (t - shoot - hold) / back;
        if (o.retract) u1 = Math.max(0, 1 - k);
        else u0 = k * 0.5;
      }
      const tight = t >= shoot && t < shoot + hold;
      const runner = ((tick * 3) % n) / n;
      for (let s = 0; s <= n; s++) {
        const u = s / n;
        if (u > u1) break;
        // 흩어질 때는 가운데부터 성기게 끊긴다
        if (u < u0 || (u0 > 0 && Math.abs(u - 0.5) < u0 && (s * 7) % 3 !== 0)) continue;
        const droop = (tight ? 0.4 : 1) * sag * 4 * u * (1 - u);
        const x = ax + (bx - ax) * u;
        const y = ay + (by - ay) * u + droop;
        const hot = Math.abs(u - runner) < 0.04;
        put(f, x, y, hot ? C[0]! : C[1]!);
        if ((o.width ?? 1) > 1) put(f, x, y + 1, C[2]!);
        if (s % 2 === 0) glow(f, x, y, C[1]!, hot ? 0.6 : 0.22);
      }
      // 쏘아 나가는 끝의 반짝임
      if (t < shoot + hold) {
        const x = ax + (bx - ax) * u1;
        const y = ay + (by - ay) * u1;
        put(f, x, y, C[0]!);
        put(f, x + 1, y, C[0]!);
        put(f, x, y - 1, C[0]!);
        for (let d = -2; d <= 2; d++) glow(f, x + d, y, C[0]!, 0.5 * (1 - Math.abs(d) / 3));
      }
    },
  };
}
