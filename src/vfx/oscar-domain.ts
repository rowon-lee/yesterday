// YESTERDAY: 오스카 필살기 월령수류 — 영역 전개 (캐릭터 기획서 13-7 콘티). 렌더 전용. 시계 D는 연출 시작부터의 콘티 틱 (콘티 30틱 = D 0).
// D 0~14   먹구름이 위에서 내려와 도시를 덮는다 (뒤 겹)
// D 14~60  구름이 달 자리에서 좌우로 갈라지며 핏빛 하늘이 열리고, 핏빛 달(지름 72px)이 수평선에서 떠오른다 (D 20~70). 빗줄기는 공중에 멈춘다
// D 10~50  오스카 발밑에서 물이 좌우로 차올라 바닥 전체가 짙은 바다가 되고, 달이 수면에 비친다 (달빛 길. 바닥선 앞 물은 앞 겹)
// D 70~110 화면에 남은 검영들이 하나씩 떠올라 밝게 빛나며 오스카 둘레를 돈다 (앞 반은 앞 겹, 뒤 반은 뒤 겹). D 110~130 멈추고 정적
// D 130~150 화면 전체가 하얗고, 화면 끝에서 끝까지 먹빛 베기 선이 차례로 그어진다 (2D 겹: overlay. 무대 앞 물건까지 덮는다)
// D 150~220 색이 돌아온다: 영역(하늘·바다)은 걷히고 도시가 보인다. 선은 잠깐 은빛 머리카락 선으로 남았다가 스러진다 (조각 어긋남은 render/screenfx)
// D 216~    '탁' 직전에 선이 다시 빛나고, '탁'에 은빛 가루로 부서져 떨어진다 (무너짐·먼지·실제 파괴는 sim과 fightvfx)
// 화면 칸 좌표로 칠한다 (카메라 왼쪽 위 f.ox·f.oy를 빼서). 색: DomainColors.
import type { Frame, Layer } from './impact';
import { glow, put, rng } from './oscar-px';

export interface DomainColors {
  ink: number;
  night: number;
  cloud: number;
  cloudLit: number;
  bloodDark: number;
  blood: number;
  sea: number;
  seaLight: number;
  white: number;
  moonLight: number;
  moon: number;
  moonDark: number;
}

export interface Options {
  /** 콘티 시계 D (끝났으면 -1) */
  clock: () => number;
  /** 바닥선 (월드 y) */
  ground: number;
  /** 달이 떠오르는 자리 (월드 x) */
  moonX: number;
  /** 오스카 발밑 (월드): 물이 퍼지는 곳, 검영이 도는 가운데 */
  oscar: () => readonly [number, number];
  /** 연출이 시작될 때의 검영 (월드 px, 기울기 도) */
  shadows: ReadonlyArray<{ x: number; y: number; ang: number }>;
  /** 화면 끝에서 끝까지 베기 선 (월드 px) */
  lines: ReadonlyArray<readonly [number, number, number, number]>;
  colors: DomainColors;
  /** 2D 겹의 흰색·먹빛 ('#rrggbb') */
  whiteHex: string;
  inkHex: string;
  seed?: number;
}

/** 달 반지름 (px, 지름 72) */
const MOON_R = 36;
/** 수평선: 바닥선에서 위로 (px) */
const HORIZON = 46;

const ease = (k: number): number => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export default function oscarDomain(o: Options) {
  const C = o.colors;
  const rand = rng(o.seed ?? 11);
  // 구름 띠: 하늘을 가로로 나눈 띠마다 갈라지는 늦음과 들쭉날쭉한 끝
  const bands = Array.from({ length: 14 }, () => ({ delay: rand() * 12, jag: Array.from({ length: 16 }, () => Math.floor(rand() * 10)) }));
  // 바다 물결 줄: [x 위치 비율, 높이 비율, 길이, 반짝임 박자]
  const ripples = Array.from({ length: 80 }, () => ({ u: rand(), v: rand(), len: 3 + Math.floor(rand() * 9), ph: Math.floor(rand() * 16) }));
  // 멈춘 빗줄기 (하늘에 매달린 짧은 선)
  const drops = Array.from({ length: 70 }, () => ({ u: rand(), v: rand(), len: 2 + Math.floor(rand() * 3) }));
  // 선마다 흰 화면에 그어지는 순간 (D 131~147에 고르게)
  const lineAt = o.lines.map((_, i) => 131 + Math.floor((i * 16) / Math.max(1, o.lines.length)));
  const dust = o.lines.map(() => Array.from({ length: 14 }, () => ({ u: rand(), drift: (rand() - 0.5) * 0.6, fall: 0.3 + rand() * 0.5 })));
  let t = 0;

  /** 한 줄 칠하기 (화면 칸 좌표, x0~x1 포함) */
  const row = (f: Frame, y: number, x0: number, x1: number, c: number): void => {
    if (y < 0 || y >= f.h) return;
    const a = Math.max(0, Math.floor(x0));
    const b = Math.min(f.w - 1, Math.floor(x1));
    if (b < a) return;
    f.color.fill(c >>> 0, y * f.w + a, y * f.w + b + 1);
    const box = f.box;
    if (box) {
      if (a < box[0]!) box[0] = a;
      if (y < box[1]!) box[1] = y;
      if (b > box[2]!) box[2] = b;
      if (y > box[3]!) box[3] = y;
    }
  };
  /** 화면 칸 한 점 */
  const dot = (f: Frame, x: number, y: number, c: number): void => put(f, x + f.ox, y + f.oy, c);

  /** 하늘 (수평선 위): 수평선 바로 위 3px 핏빛, 위로 핏빛 어둠 → 밤 → 어둠. 띠 경계 2px만 디더 */
  const skyColor = (y: number, hz: number, x: number): number => {
    const up = hz - y;
    const odd = ((x + y) & 1) === 0;
    if (up < 3) return C.blood;
    if (up < 5) return odd ? C.blood : C.bloodDark;
    if (up < 30) return C.bloodDark;
    if (up < 32) return odd ? C.bloodDark : C.night;
    if (up < 80) return C.night;
    if (up < 82) return odd ? C.night : C.ink;
    return C.ink;
  };

  /** 물 한 겹 (y0~y1 줄, 오스카 발밑에서 퍼진 x0~x1): 짙은 바다 + 물결 줄 + 달빛 길 */
  const water = (f: Frame, y0: number, y1: number, x0: number, x1: number, hz: number, mx: number, D: number, near: boolean): void => {
    for (let y = y0; y < y1; y++) row(f, y, x0, x1, near || y - hz > 8 ? C.ink : C.sea);
    if (!near) row(f, hz, x0, x1, C.bloodDark);
    for (const r of ripples) {
      const y = Math.round(y0 + 1 + r.v * (y1 - y0 - 1));
      if (y >= y1) continue;
      const deep = (y - hz) / Math.max(1, f.h - hz);
      const len = Math.round(r.len * (0.5 + deep * 1.6));
      const x = Math.round(r.u * f.w);
      if (x < x0 || x + len > x1) continue;
      const glade = Math.abs(x - mx) < 6 + deep * 30;
      if (!glade && ((Math.floor((t * 60) / 8) + r.ph) & 3) === 0) continue;
      row(f, y, x, x + len, glade && D >= 26 ? (((r.ph + Math.floor((t * 60) / 6)) & 1) ? C.blood : C.bloodDark) : C.seaLight);
    }
  };

  const api = {
    update(dt: number) {
      t += dt;
    },
    done() {
      return o.clock() < 0;
    },
    draw(f: Frame, layer?: Layer) {
      const D = o.clock();
      if (D < 0) return;
      const gy = Math.round(o.ground - f.oy);
      const hz = gy - HORIZON;
      const mx = Math.round(o.moonX - f.ox);
      const [ox, oy] = o.oscar();
      const sx = Math.round(ox - f.ox);
      const spread = ease((D - 10) / 40) * (f.w + 40);
      if (layer === 'back' && D < 150) {
        // ---- 하늘과 구름 (수평선 위) ----
        const bankDown = ease(D / 14) * (hz + 4);
        const rise = ease((D - 20) / 50);
        const my = Math.round(hz + MOON_R + 6 - rise * (MOON_R + 6 + 74));
        const bandH = Math.max(1, Math.ceil(hz / bands.length));
        const partOf = (y: number): number => {
          const b = bands[Math.min(bands.length - 1, Math.floor(y / bandH))]!;
          return D < 14 ? 0 : ease((D - 14 - b.delay) / 34) * (f.w / 2 + 60);
        };
        for (let y = 0; y < hz && y <= bankDown; y++) {
          const b = bands[Math.min(bands.length - 1, Math.floor(y / bandH))]!;
          const part = partOf(y);
          const jag = b.jag[Math.floor(y / 2) % b.jag.length]!;
          const g0 = mx - part - jag;
          const g1 = mx + part + jag;
          if (part > 0) {
            row(f, y, Math.max(0, g0), Math.min(f.w - 1, g1), C.ink);
            for (let x = Math.max(0, Math.floor(g0)); x <= Math.min(f.w - 1, g1); x++) f.color[y * f.w + x] = skyColor(y, hz, x) >>> 0;
          }
          // 구름 (틈 바깥): 어두운 띠, 띠 아랫면과 틈 쪽 끝은 핏빛 달빛을 받는다
          const lit = y % bandH === bandH - 1 && D > 14;
          row(f, y, 0, g0 - 1, lit ? C.cloudLit : C.cloud);
          row(f, y, g1 + 1, f.w - 1, lit ? C.cloudLit : C.cloud);
          if (part > 0) {
            dot(f, g0 - 1, y, C.cloudLit);
            dot(f, g1 + 1, y, C.cloudLit);
          }
          if (D < 14 && y > bankDown - 2) row(f, y, 0, f.w - 1, C.cloudLit);
        }
        // ---- 핏빛 달 (구름 틈 사이로, 수평선 아래는 바다가 덮는다) ----
        if (D >= 20) {
          for (let dy = -MOON_R; dy <= MOON_R; dy++) {
            const y = my + dy;
            if (y >= hz || y < 0) continue;
            const half = Math.sqrt(MOON_R * MOON_R - dy * dy);
            const part = partOf(y);
            const x0 = Math.max(mx - half, mx - part);
            const x1 = Math.min(mx + half, mx + part);
            if (x1 < x0) continue;
            row(f, y, x0, x1, C.blood);
            if ((y & 1) === 0) {
              if (mx - half >= mx - part) dot(f, Math.round(mx - half), y, C.bloodDark);
              if (mx + half <= mx + part) dot(f, Math.round(mx + half), y, C.bloodDark);
            }
          }
          for (const [bx, by, br] of [[-11, -8, 9], [10, 6, 7], [-4, 16, 5]] as const) {
            for (let dy = -br; dy <= br; dy++) {
              const y = my + by + dy;
              if (y >= hz || y < 0 || partOf(y) < MOON_R) continue;
              const half = Math.sqrt(br * br - dy * dy);
              row(f, y, mx + bx - half, mx + bx + half, C.bloodDark);
            }
          }
          for (let a = 0; a < 32; a++) {
            const r = (a / 32) * Math.PI * 2;
            glow(f, o.moonX + Math.cos(r) * (MOON_R + 5), f.oy + my + Math.sin(r) * (MOON_R + 5), C.blood, 0.35 * rise);
          }
        }
        // ---- 멈춘 빗줄기 (D 30부터 공중에 멈춘 채 핏빛 하늘에 떠 있다) ----
        if (D >= 30) {
          for (const d of drops) {
            const x = Math.round(d.u * f.w);
            const y = Math.round(d.v * (hz - 10));
            if (y < 0 || partOf(y) < Math.abs(x - mx)) continue;
            for (let k = 0; k < d.len; k++) dot(f, x + Math.round(k * 0.22), y + k, C.moonDark);
          }
        }
        // ---- 먼 바다: 수평선 ~ 바닥선 (오스카 발밑에서 좌우로 퍼진다) ----
        if (spread > 0) water(f, hz, gy + 1, sx - spread, sx + spread, hz, mx, D, false);
      }
      // ---- 바닥선 앞 물 (앞 겹, 바닥선 2px 아래부터: 두 사람 발은 덮지 않는다) ----
      if (layer === 'front' && D < 150 && spread > 0) {
        water(f, gy + 2, f.h, sx - spread, sx + spread, hz, mx, D, true);
        for (const e of [sx - spread, sx + spread]) for (let y = gy + 2; y < f.h; y += 2) dot(f, Math.round(e), y, C.moonDark);
      }
      // ---- 검영: 하나씩 떠올라 오스카 둘레를 돈다 (D 70~130) ----
      if (D >= 70 && D < 130 && o.shadows.length) {
        const n = o.shadows.length;
        const spin = D < 110 ? (D - 70) * 0.085 : 40 * 0.085 + (1 - (1 - Math.min(1, (D - 110) / 14)) ** 2) * 0.4;
        const cx = ox;
        const cy = oy - 30;
        o.shadows.forEach((s, i) => {
          const lift = ease((D - 70 - i * 6) / 16);
          if (lift <= 0) return;
          const th = (i / n) * Math.PI * 2 + spin;
          const ex = cx + Math.cos(th) * 48;
          const ey = cy + Math.sin(th) * 16 - 4;
          const x = s.x + (ex - s.x) * lift;
          const y = s.y + (ey - s.y) * lift;
          const front = Math.sin(th) > 0;
          if ((layer === 'front') !== front) return;
          const a0 = (s.ang * Math.PI) / 180;
          const ang = a0 + (th + Math.PI / 2 - a0) * lift;
          const ux = Math.cos(ang);
          const uy = Math.sin(ang) * 0.45;
          for (let q = -12; q <= 12; q++) {
            put(f, x + ux * q, y + uy * q, Math.abs(q) < 8 ? C.white : C.moonLight);
            // 가운데 2px 굵게 (작은 화면에서도 몇 개인지 읽히게)
            if (Math.abs(q) < 7) put(f, x + ux * q, y + uy * q + 1, C.moonLight);
            if (q % 2 === 0) glow(f, x + ux * q, y + uy * q, C.moonLight, 0.45 * lift);
          }
        });
      }
      // ---- 색이 돌아온 뒤: 선이 잠깐 은빛 머리카락 선으로 남았다가 스러지고, '탁' 직전에 다시 빛나 가루로 부서진다 ----
      if (layer === 'front' && D >= 150) {
        const after = D - 220;
        o.lines.forEach((l, i) => {
          if (after < 0) {
            if (D < 156) drawLine(f, l, D < 152 ? C.white : C.moonLight, 0);
            else if (D < 196) {
              // 점점 성기게 (6틱마다 한 단계)
              const gap = 2 + Math.floor((D - 156) / 8);
              drawLine(f, l, C.moonDark, gap, i);
            } else if (D >= 214) drawLine(f, l, D >= 218 ? C.white : C.moonLight, 0);
            return;
          }
          if (after > 26) return;
          for (const m of dust[i]!) {
            const x = l[0] + (l[2] - l[0]) * m.u + m.drift * after;
            const y = l[1] + (l[3] - l[1]) * m.u + m.fall * after * (1 + after * 0.05);
            if (after > 14 && (Math.round(m.u * 100) + Math.floor(after)) % 2 === 0) continue;
            put(f, x, y, after < 6 ? C.moonLight : after < 14 ? C.moon : C.moonDark);
          }
        });
      }
    },
    /** 2D 겹 (scenes/fight overlay): 백색 (D 130~150) — 화면 전체 흰색 위로 먹빛 선이 차례로, 끝 3틱은 디더로 걷힌다 */
    overlay(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }) {
      const D = o.clock();
      if (D < 130 || D >= 152) return;
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      ctx.fillStyle = o.whiteHex;
      if (D < 149) ctx.fillRect(0, 0, W, H);
      else {
        // 디더로 걷힘: 4×4 무늬 한 장으로 화면을 한 번에 칠한다 (한 점씩 13만 번 칠하던 것과 같은 그림)
        ctx.fillStyle = ditherPattern(ctx, o.whiteHex, (D - 149) / 3);
        ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = o.inkHex;
      o.lines.forEach((l, i) => {
        if (D < lineAt[i]!) return;
        const [x0, y0, x1, y1] = [l[0] - cam.x, l[1] - cam.y, l[2] - cam.x, l[3] - cam.y];
        const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        for (let s = 0; s <= n; s++) {
          const x = Math.round(x0 + ((x1 - x0) * s) / n);
          const y = Math.round(y0 + ((y1 - y0) * s) / n);
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    },
  };
  return api;
}

/** 디더 무늬 (색, 문턱 k): (BAYER + 0.5) / 16 ≥ k인 칸만 칠한 4×4 반복 무늬. 색·문턱마다 한 번 만든다 */
const patterns = new Map<string, CanvasPattern>();
function ditherPattern(ctx: CanvasRenderingContext2D, color: string, k: number): CanvasPattern | string {
  const key = `${color}|${k}`;
  let p = patterns.get(key);
  if (!p) {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((BAYER[(y << 2) | x]! + 0.5) / 16 >= k) g.fillRect(x, y, 1, 1);
    p = ctx.createPattern(c, 'repeat') ?? undefined;
    if (!p) return color;
    patterns.set(key, p);
  }
  return p;
}

/** 월드 선 하나 (화면 안만, 1px 계단). gap이면 그 간격마다 한 칸만 찍는다 (phase로 선마다 어긋나게) */
function drawLine(f: Frame, l: readonly [number, number, number, number], c: number, gap = 0, phase = 0): void {
  let [x0, y0, x1, y1] = l;
  // 화면 사각형으로 자르기 (월드 좌표)
  const L = f.ox - 2;
  const R = f.ox + f.w + 2;
  const T = f.oy - 2;
  const B = f.oy + f.h + 2;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  for (const [p, d, lo, hi] of [[x0, dx, L, R], [y0, dy, T, B]] as const) {
    if (d === 0) {
      if (p < lo || p > hi) return;
      continue;
    }
    let a = (lo - p) / d;
    let b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return;
  }
  [x0, y0, x1, y1] = [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let s = 0; s <= n; s++) {
    if (gap && (s + phase) % gap !== 0) continue;
    put(f, x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, c);
  }
}
