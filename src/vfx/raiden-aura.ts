// YESTERDAY: 라이덴 전신 전격 — 공격하는 동안 붉은 전격이 팔다리·몸통을 휘감고 기어 다닌다 (렌더 전용, 사용자 피드백 2026-11-01
// '번개는 전신을 휘감고 휘두르듯이 주위로도 퍼져나가게'). 캐릭터를 따라다니며(관절 자리를 틱마다 읽는다), 2틱마다 새로 꺾여 지직거린다.
// 세기(level 0~1)가 클수록 줄기가 많다: 감기 때 적게, 타격 순간 가장 많이, 여운·복귀에서 줄어든다.
// 몸 앞·뒤 두 겹으로 나눠 그려 몸을 감싸 도는 것처럼 보인다. 좌표는 2단위 = 1px, 색은 부르는 쪽이 넘긴다 (흰 → 밝은 붉은 → 붉은 → 검붉은).
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
  /** 치는 팔다리 (휘감는 줄기가 여기에 더 많이 몰린다) */
  limb?: 'aF' | 'aB' | 'lF' | 'lB';
  ramp?: readonly number[];
  seed?: number;
}

const PX = 2;
const FADE = 0.12;

export default function raidenAura(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xff667aff, 0xff3c3ad9, 0xff2b1f8e];
  const seed = (o.seed ?? 1) * 7919 + 29;
  let t = 0;
  let dead = -1;
  let tick = 0;

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
  /** 꺾인 줄기 (1px 계단): a → b, 마디마다 옆으로 jag px 흔들림 */
  const bolt = (f: Frame, pts: ReadonlyArray<readonly [number, number]>, core: number, rim: number | null, k: number) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
      const flat = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
      for (let s = 0; s <= n; s++) {
        const x = Math.round(a[0] + ((b[0] - a[0]) * s) / n);
        const y = Math.round(a[1] + ((b[1] - a[1]) * s) / n);
        put(f, x, y, core);
        if (rim !== null) put(f, x + (flat ? 0 : 1), y + (flat ? 1 : 0), rim);
        if (k > 0 && s % 2 === 0) glow(f, x, y, C[1]!, k);
      }
    }
  };

  return {
    update(dt: number) {
      t += dt;
      tick++;
      if (dead < 0 && !o.alive()) dead = t;
    },
    done() {
      return dead >= 0 && t - dead >= FADE;
    },
    draw(f: Frame, layer?: Layer) {
      const J0 = o.joints();
      if (!J0) return;
      const fade = dead >= 0 ? Math.max(0, 1 - (t - dead) / FADE) : 1;
      const level = Math.max(0, Math.min(1, o.level())) * fade;
      if (level <= 0.02) return;
      const J = Object.fromEntries(Object.entries(J0).map(([k, v]) => [k, [v[0] / PX, v[1] / PX] as const])) as unknown as AuraJoints;
      // 2틱마다 새 모양 (시드 + 틱 번호로 정해 같은 장면은 같게)
      let r = (seed + Math.floor(tick / 2) * 104729) & 0x7fffffff;
      const rand = () => {
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        return r / 0x7fffffff;
      };
      const chains: Record<string, ReadonlyArray<P>> = {
        aF: [J.shF, J.eF, J.hF],
        aB: [J.shB, J.eB, J.hB],
        lF: [J.hip, J.kF, J.fF],
        lB: [J.hip, J.kB, J.fB],
        sp: [J.hip, J.neck, J.head],
      };
      const order = ['aF', 'aB', 'lF', 'lB', 'sp'];
      // 전격 다리: 손과 손, 무릎과 무릎, 주먹과 머리처럼 떨어진 관절 사이 빈 곳을 잇는 갈래 (몸 둘레가 지직거리는 게 보이게)
      if (layer !== 'back') {
        const pairs: ReadonlyArray<readonly [P, P]> = [[J.hF, J.hB], [J.kF, J.kB], [J.fF, J.fB], [J.hF, J.head], [J.eB, J.hip], [J.kF, J.hF]];
        const nb = Math.round(1 + 3 * level);
        for (let b = 0; b < nb; b++) {
          const [a, c] = pairs[Math.floor(rand() * pairs.length)]!;
          const d = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (d < 6 || d > 40) continue;
          const pts: Array<[number, number]> = [];
          const segs = Math.max(2, Math.round(d / 4));
          for (let q = 0; q <= segs; q++) {
            const u = q / segs;
            const bow = Math.sin(u * Math.PI) * (rand() - 0.5) * 8;
            pts.push([a[0] + (c[0] - a[0]) * u - ((c[1] - a[1]) / d) * bow, a[1] + (c[1] - a[1]) * u + ((c[0] - a[0]) / d) * bow]);
          }
          bolt(f, pts, level > 0.5 ? C[0]! : C[1]!, C[2]!, 0.3 * level);
        }
      }
      const n = Math.round(3 + 8 * level);
      for (let i = 0; i < n; i++) {
        // 치는 팔다리에 더 많이. 넷 중 셋은 몸 앞 겹(보이게), 하나는 몸 뒤 겹(감싸 도는 느낌)
        const front = i % 4 !== 3;
        if ((layer === 'back' && front) || (layer === 'front' && !front)) {
          rand();
          rand();
          continue;
        }
        const key = o.limb && rand() < 0.4 ? o.limb : order[Math.floor(rand() * order.length)]!;
        const ch = chains[key]!;
        // 마디를 따라가며 옆으로 흔들린 점들 (몸을 감싸도록 마디 바깥쪽으로 2~4px)
        const pts: Array<[number, number]> = [];
        const side = rand() < 0.5 ? -1 : 1;
        for (let s = 0; s + 1 < ch.length; s++) {
          const a = ch[s]!;
          const b = ch[s + 1]!;
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const l = Math.hypot(dx, dy) || 1;
          const nx = -dy / l;
          const ny = dx / l;
          const steps = Math.max(2, Math.round(l / 4));
          for (let q = 0; q < steps; q++) {
            const u = q / steps;
            // 감아 도는 줄기: 마디를 따라가며 바깥쪽 ↔ 안쪽을 오간다
            const off = side * (5 + rand() * 4) * Math.sin((u + s) * Math.PI * 1.5 + i);
            pts.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
          }
        }
        const last = ch[ch.length - 1]!;
        pts.push([last[0] + (rand() - 0.5) * 3, last[1] + (rand() - 0.5) * 3]);
        // 흰 심 + 짙은 붉은 테두리로 밝게 빛나는 몸 위에서도 갈라져 보이게
        const hot = level > 0.4 && rand() < 0.6;
        bolt(f, pts, hot ? C[0]! : C[1]!, C[3] ?? C[2]!, 0.35 * level);
        // 끝에서 바깥으로 짧게 튀는 갈래 (세질수록 자주)
        if (rand() < 0.5 + 0.4 * level) {
          const a = pts[Math.floor(rand() * pts.length)]!;
          const ang = rand() * Math.PI * 2;
          const len = 3 + rand() * 4 * (1 + level);
          bolt(f, [a, [a[0] + Math.cos(ang) * len * 0.5 + (rand() - 0.5) * 2, a[1] + Math.sin(ang) * len * 0.5], [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len]], C[2]!, null, 0);
        }
      }
    },
  };
}
