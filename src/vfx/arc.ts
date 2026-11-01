// YESTERDAY: 길을 따라 휩쓰는 번개 (Sprite Fusion 이펙트와 같은 구조로 새로 만듦, 렌더 전용).
// 라이덴 평타·차지·스킬마다 치는 팔다리 끝이 지나간 길을 따라 붉은 전격이 휩쓸고 지나가 번개 사거리 끝까지 뻗는다
// (캐릭터 기획서 '타격마다 붉은 전격이 튄다', 사용자 요청 2026-11-01 '공격마다 번개가 막 휩쓰는 식으로').
// 맞힌 자리에서 사방으로 튀는 짧은 전격(burst)도 같은 그림으로 그린다.
// - 처음 sweep초 동안 길 앞쪽부터 끝까지 차례로 뻗고(휩쓸기), 잠깐 머문 뒤 깜빡이며 꼬리부터 사라진다.
// - 번개 모양은 2틱마다 새로 꺾여 지직거린다 (시드로 정해 같은 번개는 같은 꼴).
// - 흰 심지 + 붉은 테두리 + 검붉은 바깥, 갈래가 비스듬히 갈라지고, 끝에서 불티가 튄다.
// 좌표는 다른 이펙트처럼 2단위 = 1px (path는 월드 px × 2). 색은 부르는 쪽이 우리 팔레트로 넘긴다 (밝은 → 어두운).
import type { Frame, Layer } from './impact';

export interface Options {
  /** 휩쓰는 길 (2단위, 처음 → 끝). 끝이 번개 사거리 끝 */
  path: ReadonlyArray<readonly [number, number]>;
  /** 색 (0xAABBGGRR, 밝은 → 어두운): 흰 심지 → 붉은 빛 → 검붉은 테두리 */
  ramp?: readonly number[];
  seed?: number;
  /** 길을 따라 뻗는 시간 (초) */
  sweep?: number;
  /** 다 뻗은 뒤 머무는 시간 (초). 그 뒤 FADE초 동안 깜빡이며 사라진다 */
  hold?: number;
  /** 굵기: 1 심지 + 테두리, 2 바깥 테두리까지 */
  width?: number;
  /** 꺾임 크기 (px) */
  jag?: number;
  /** 갈래 수 */
  forks?: number;
  /** 끝에서 튀는 불티 수 */
  sparks?: number;
}

const PX = 2;
const FADE = 0.16;
const SPARK_LIFE = 0.32;

export default function arc(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xff667aff, 0xff3c3ad9, 0xff2b1f8e, 0xff1a0f4c];
  const sweep = o.sweep ?? 0.05;
  const hold = o.hold ?? 0.07;
  const width = o.width ?? 1;
  const jag = o.jag ?? 2.5;
  const life = sweep + hold + FADE;
  const seed = (o.seed ?? 1) * 7919 + 13;
  // 렌더 전용 시드 난수 (sim과 상관없음)
  const rng = (k: number) => {
    let r = (seed + k * 104729) & 0x7fffffff;
    return () => {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      return r / 0x7fffffff;
    };
  };
  // 길 (1px 단위) 과 누적 길이
  const P = o.path.map(([x, y]) => [x / PX, y / PX] as [number, number]);
  if (P.length === 1) P.push([P[0][0] + 1, P[0][1]]);
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = Math.max(1, cum[cum.length - 1]);
  /** 길 위 거리 d의 자리와 방향 */
  const along = (d: number): [number, number, number, number] => {
    let i = 1;
    while (i < P.length - 1 && cum[i] < d) i++;
    const seg = Math.max(1e-6, cum[i] - cum[i - 1]);
    const u = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
    const dx = (P[i][0] - P[i - 1][0]) / seg;
    const dy = (P[i][1] - P[i - 1][1]) / seg;
    return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u, dx, dy];
  };
  /** 번개 한 벌 (모양 번호 k): 길을 따라 4~7px마다 꺾인 마디. 양 끝은 덜 꺾인다 */
  const shapes = new Map<number, { pts: Array<[number, number, number]>; forks: Array<Array<[number, number]>> }>();
  const shape = (k: number) => {
    let sh = shapes.get(k);
    if (sh) return sh;
    const rand = rng(k);
    const pts: Array<[number, number, number]> = [];
    for (let d = 0; ; ) {
      const [x, y, dx, dy] = along(d);
      const edge = Math.min(1, d / 6, (total - d) / 6);
      const off = (rand() - 0.5) * 2 * jag * edge;
      pts.push([Math.round(x - dy * off), Math.round(y + dx * off), d]);
      if (d >= total) break;
      d = Math.min(total, d + 4 + Math.floor(rand() * 4));
    }
    const forks: Array<Array<[number, number]>> = [];
    for (let n = 0; n < (o.forks ?? 2) && pts.length > 2; n++) {
      const i = 1 + Math.floor(rand() * (pts.length - 2));
      const [sx, sy, d] = pts[i];
      const [, , dx, dy] = along(d);
      const side = rand() < 0.5 ? -1 : 1;
      const f: Array<[number, number]> = [[sx, sy]];
      let x = sx;
      let y = sy;
      for (let m = 0; m < 3; m++) {
        // 길 방향으로 조금, 옆으로 비스듬히
        const a = 2 + rand() * 3;
        const b = side * (2 + rand() * 3);
        x += dx * a - dy * b;
        y += dy * a + dx * b;
        f.push([Math.round(x), Math.round(y)]);
      }
      forks.push(f);
    }
    sh = { pts, forks };
    shapes.set(k, sh);
    return sh;
  };
  // 불티: 끝에서 길 방향으로 튀었다 떨어진다
  const tip = along(total);
  const sparks = (() => {
    const rand = rng(999);
    return Array.from({ length: o.sparks ?? 6 }, () => {
      const a = Math.atan2(tip[3], tip[2]) + (rand() - 0.5) * 2.2;
      const v = 40 + rand() * 80;
      return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20 };
    });
  })();
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
  /** 한 마디 (a → b): 1px 계단 선. w: 0 심지만, 1 심지 + 테두리, 2 바깥 테두리까지. 테두리는 선에 수직으로 */
  const seg = (f: Frame, a: readonly number[], b: readonly number[], w: number, alpha: number, k: number) => {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    // 선이 가로에 가까우면 위아래로, 세로에 가까우면 좌우로 테두리
    const flat = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const ox = flat ? 0 : 1;
    const oy = flat ? 1 : 0;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * s) / n);
      const y = Math.round(a[1] + ((b[1] - a[1]) * s) / n);
      put(f, x, y, C[0]!, alpha);
      if (w >= 1) {
        put(f, x - ox, y - oy, C[1]!, alpha);
        put(f, x + ox, y + oy, C[2]!, alpha);
      }
      if (w >= 2) {
        put(f, x - 2 * ox, y - 2 * oy, C[3]!, alpha * 0.9);
        put(f, x + 2 * ox, y + 2 * oy, C[3]!, alpha * 0.9);
      }
      if (k > 0 && s % 2 === 0) for (let q = -3; q <= 3; q++) glow(f, x + q * ox, y + q * oy, C[1]!, k * (1 - Math.abs(q) / 4));
    }
  };

  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t >= Math.max(life, SPARK_LIFE + sweep);
    },
    draw(f: Frame, layer?: Layer) {
      if (layer === 'back') return;
      if (t < life) {
        // 앞쪽 끝(head)은 sweep 동안 길 끝까지 뻗고, 사라질 때는 꼬리(tail)부터 끝 쪽으로 걷힌다
        const head = total * Math.min(1, (t + 1 / 60) / Math.max(1e-3, sweep));
        const fade = t > sweep + hold ? (t - sweep - hold) / FADE : 0;
        const tail = total * Math.max(0, fade * 1.1 - 0.1);
        const flicker = fade === 0 || Math.floor(t * 50) % 3 !== 1;
        if (flicker) {
          const sh = shape(Math.floor(t * 30));
          const w = fade < 0.35 ? width : Math.max(0, width - 1);
          const alpha = 1 - fade * fade * 0.6;
          const k = (1 - fade) * 0.6;
          for (let i = 0; i + 1 < sh.pts.length; i++) {
            const a = sh.pts[i];
            const b = sh.pts[i + 1];
            if (b[2] < tail || a[2] > head) continue;
            // 꼬리 쪽 마디는 가늘게 (심지만)
            const thin = a[2] < total * 0.25 ? Math.min(w, 1) : w;
            seg(f, a, b, thin, alpha, k);
          }
          if (fade < 0.5 && head >= total * 0.5) for (const fk of sh.forks) for (let i = 0; i + 1 < fk.length; i++) seg(f, fk[i]!, fk[i + 1]!, 0, alpha * (1 - fade), 0);
        }
        // 끝: 둥글게 번지는 빛
        if (head >= total) {
          const q = 1 - fade;
          for (let y = -4; y <= 4; y++) {
            for (let x = -4; x <= 4; x++) {
              const r = Math.hypot(x, y) / 4;
              if (r < 1) glow(f, tip[0] + x, tip[1] + y, C[1]!, (1 - r) * 0.7 * q);
            }
          }
        }
      }
      // 불티: 다 뻗은 순간부터 끝에서 튄다 (붉은 점 → 검붉게)
      const ts = t - sweep;
      if (ts > 0 && ts < SPARK_LIFE) {
        const u = ts / SPARK_LIFE;
        for (const s of sparks) {
          const x = tip[0] + (s.vx * ts) / PX;
          const y = tip[1] + (s.vy * ts + 200 * ts * ts) / PX;
          put(f, x, y, C[Math.min(C.length - 1, 1 + Math.floor(u * (C.length - 1)))]!, 1 - u * 0.5);
        }
      }
    },
  };
}
