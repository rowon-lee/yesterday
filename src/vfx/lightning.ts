// YESTERDAY: 하늘에서 내리꽂히는 번개 한 줄기 (Sprite Fusion 이펙트와 같은 구조로 새로 만듦, 렌더 전용).
// 라이덴 등장('붉은 번개가 연달아 내리꽂힌다')에 쓰고, 나중에 기술(화과산·투전승불·파천)의 Lightning 자리에도 쓴다.
// 첫 두 틱은 가장 굵고 밝게 번쩍이고(흰 심지 + 붉은 테두리 + 갈래), 그 뒤 몇 번 깜빡이며 가늘어져 사라진다.
// 바닥에 닿은 자리에서 불티가 튄다. 좌표는 다른 이펙트처럼 2단위 = 1px (x, y는 월드 px × 2).
// 색은 부르는 쪽이 우리 팔레트로 넘긴다 (밝은 → 어두운). 모양은 시드로 정해 같은 번개는 같은 꼴로 그린다.
import type { Frame, Layer } from './impact';

export interface Options {
  /** 번개가 닿는 바닥 자리 */
  x: number;
  y: number;
  /** 번개 길이 (2단위). 위쪽 끝은 화면 밖이어도 된다 */
  length?: number;
  /** 색 (0xAABBGGRR, 밝은 → 어두운): 흰 심지 → 붉은 빛 → 검붉은 테두리 */
  ramp?: readonly number[];
  seed?: number;
}

const PX = 2;
/** 전체 길이(초). 첫 FLASH초는 가장 굵게, 그 뒤 깜빡이며 FADE초 안에 사라진다 */
const LIFE = 0.42;
const FLASH = 0.05;
const FADE = 0.3;
/** 불티 */
const SPARKS = 9;
const SPARK_LIFE = 0.36;

export default function lightning(o: Options) {
  const bx = Math.round(o.x / PX);
  const by = Math.round(o.y / PX);
  const len = Math.round((o.length ?? 520) / PX);
  const C = o.ramp ?? [0xffffffff, 0xff667aff, 0xff3c3ad9, 0xff2b1f8e, 0xff1a0f4c];
  // 렌더 전용 시드 난수 (sim과 상관없음)
  let r = (o.seed ?? 1) * 7919 + 13;
  const rand = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  /** 줄기: 위에서 아래로 꺾이며 내려온다 (마디마다 좌우로 2~7px) */
  const trunk: Array<[number, number]> = [];
  {
    let x = bx + Math.round((rand() - 0.5) * 16);
    for (let y = by - len; y < by; ) {
      trunk.push([x, y]);
      y += 6 + Math.floor(rand() * 8);
      // 바닥에 가까울수록 닿는 자리로 모인다
      const pull = (bx - x) * 0.35;
      x += Math.round((rand() - 0.5) * 12 + pull);
    }
    trunk.push([bx, by]);
  }
  /** 갈래: 줄기 중간 마디에서 비스듬히 짧게 갈라진다 */
  const branches: Array<Array<[number, number]>> = [];
  for (let k = 0; k < 3; k++) {
    const i = 2 + Math.floor(rand() * Math.max(1, trunk.length - 4));
    const [sx, sy] = trunk[i]!;
    const dir = rand() < 0.5 ? -1 : 1;
    const pts: Array<[number, number]> = [[sx, sy]];
    let x = sx;
    let y = sy;
    for (let m = 0; m < 3; m++) {
      x += dir * (3 + Math.floor(rand() * 6));
      y += 4 + Math.floor(rand() * 6);
      pts.push([x, y]);
    }
    branches.push(pts);
  }
  const sparks = Array.from({ length: SPARKS }, () => {
    const a = -Math.PI * (0.1 + 0.8 * rand());
    const v = 50 + rand() * 90;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v };
  });
  let t = 0;

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
  const put = (f: Frame, x: number, y: number, c: number, a: number) => {
    const i = at(f, x, y);
    if (i < 0 || a <= 0) return;
    const old = f.color[i]! >>> 24;
    const na = Math.min(255, Math.round(a * 255));
    if (old >= na) return;
    f.color[i] = ((na << 24) | (c & 0xffffff)) >>> 0;
  };
  const glow = (f: Frame, x: number, y: number, c: number, k: number) => {
    const i = at(f, x, y);
    if (i < 0 || k <= 0) return;
    const d = f.light[i]!;
    const rr = Math.min(255, (d & 255) + (c & 255) * k);
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
    const b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
    f.light[i] = ((255 << 24) | (b << 16) | (g << 8) | rr) >>> 0;
  };
  /** 한 마디 (a → b): 1px 계단 선. w: 0 심지만, 1 심지 + 좌우 테두리 */
  const seg = (f: Frame, a: [number, number], b: [number, number], w: number, alpha: number, k: number) => {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * s) / n);
      const y = Math.round(a[1] + ((b[1] - a[1]) * s) / n);
      put(f, x, y, C[0]!, alpha);
      if (w >= 1) {
        put(f, x - 1, y, C[1]!, alpha);
        put(f, x + 1, y, C[2]!, alpha);
      }
      if (w >= 2) {
        put(f, x - 2, y, C[3]!, alpha * 0.9);
        put(f, x + 2, y, C[3]!, alpha * 0.9);
      }
      if (k > 0 && s % 2 === 0) for (let q = -3; q <= 3; q++) glow(f, x + q, y, C[1]!, k * (1 - Math.abs(q) / 4));
    }
  };

  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= LIFE;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      // 줄기: 처음엔 굵게, 그 뒤 몇 번 깜빡이며 가늘어진다
      if (t < FLASH + FADE) {
        const u = t < FLASH ? 0 : (t - FLASH) / FADE;
        const flicker = t < FLASH || Math.floor(t * 40) % 3 !== 1;
        if (flicker) {
          const w = u < 0.25 ? 2 : u < 0.6 ? 1 : 0;
          const alpha = 1 - u * u * 0.6;
          const k = (1 - u) * (t < FLASH ? 0.9 : 0.5);
          for (let i = 0; i + 1 < trunk.length; i++) seg(f, trunk[i]!, trunk[i + 1]!, w, alpha, k);
          if (u < 0.5) for (const br of branches) for (let i = 0; i + 1 < br.length; i++) seg(f, br[i]!, br[i + 1]!, 0, alpha * (1 - u), 0);
        }
        // 바닥에 닿은 자리: 둥글게 번지는 빛
        if (t < FLASH * 2) {
          for (let y = -6; y <= 2; y++) {
            for (let x = -12; x <= 12; x++) {
              const q = Math.hypot(x / 12, y / 6);
              if (q < 1) glow(f, bx + x, by + y, C[1]!, (1 - q) * 0.9);
            }
          }
        }
      }
      // 불티: 닿은 자리에서 위로 튀었다 떨어진다 (붉은 점 → 검붉게)
      if (t < SPARK_LIFE) {
        const u = t / SPARK_LIFE;
        for (const s of sparks) {
          const x = bx + s.vx * t / PX;
          const y = by + (s.vy * t + 260 * t * t) / PX;
          if (y > by + 1) continue;
          put(f, x, y, C[Math.min(C.length - 1, 1 + Math.floor(u * (C.length - 1)))]!, 1 - u * 0.5);
        }
      }
    },
  };
}
