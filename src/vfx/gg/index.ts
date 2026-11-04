// YESTERDAY 길티기어식 이펙트 (동작연출지침서 14-8, 렌더 전용).
// 공격 하나의 모양 숫자(data/vfx)를 받아 큰 모양 몇 개로 그린다:
//   빛 쐐기·빛기둥·스우시 (셀 3단) · 잉크 쐐기 · 굵은 번개 (어두운 테두리) · 큰 원 고리 · 방사 속도선 · 섬광 · 불씨.
// 시간 (14-8): 0틱에 최대 크기로 나타나 히트스톱 동안 그대로 → 두께부터 빠르게 얇아지며 사라짐 → 불씨만 남는다.
// 난수는 불씨 자리·속도에만 쓴다 (같은 시드면 같은 그림).
import type { GEmbers, GPt, GShape, GTone } from '../../data/vfx/types';
import { fillRings, put, rng, type GFrame, type Layer } from './raster';
import { bolt, flash, ink, rays, ring, swoosh, wedge, type Paint } from './shapes';

export type { GFrame, Layer };

export interface GGSpec {
  shapes: readonly GShape[];
  /** 색표: 색 단계 0 심 · 1 주색 · 2 진한 주색 · 3 잉크 · 4 고리 → 색 (0xAABBGGRR, render/vfx fxColor) */
  ramp: readonly number[];
  /** 모양 좌표 (0, 0)의 월드 px (공격자 발밑이나 맞은 점)와 보는 쪽 */
  origin: GPt;
  facing: number;
  /** 참이면 시간을 멈춘다 (히트스톱 동안 피크 그대로) */
  held?: () => boolean;
  seed: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  tone: GTone;
}

const EMBER_TONES: readonly GTone[] = [0, 1, 4, 1, 0, 2];

/** 모양 하나가 끝나는 틱 */
function endOf(s: GShape): number {
  if (s.kind === 'embers') return (s.delay ?? 0) + s.life + 1;
  return (s.delay ?? 0) + (s.hold ?? 0) + (s.fade ?? 6);
}

export default function ggEffect(o: GGSpec) {
  const fc = o.facing >= 0 ? 1 : -1;
  const OX = Math.round(o.origin[0]);
  const OY = Math.round(o.origin[1]);
  const end = Math.max(0, ...o.shapes.map(endOf));
  let t = 0;
  const embers = new Map<GEmbers, Ember[]>();
  const sparks = (s: GEmbers): Ember[] => {
    let list = embers.get(s);
    if (!list) {
      const r = rng(o.seed * 7919 + o.shapes.indexOf(s) * 104729 + 17);
      list = [];
      const at = s.at ?? [0, 0];
      for (let i = 0; i < s.n; i++) {
        const a = ((s.dir + (r() - 0.5) * s.fan) * Math.PI) / 180;
        const d = s.spread * Math.sqrt(r());
        const da = r() * Math.PI * 2;
        const v = s.speed * (0.35 + 0.65 * r());
        list.push({
          x: at[0] + Math.cos(da) * d,
          y: at[1] + Math.sin(da) * d * 0.7,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: Math.round(s.life * (0.55 + 0.45 * r())),
          size: r() < 0.3 ? 2 : 1,
          tone: EMBER_TONES[i % EMBER_TONES.length]!,
        });
      }
      embers.set(s, list);
    }
    return list;
  };
  /** 지금 두께 비 (피크 1 → 0, 아직이면 −1): 머문 뒤 처음에 빨리 얇아진다 */
  const kOf = (s: GShape): number => {
    const ts = t - (s.delay ?? 0);
    if (ts < 0) return -1;
    const hold = s.hold ?? 0;
    if (ts <= hold) return 1;
    const u = (ts - hold) / Math.max(1, s.fade ?? 6);
    return u >= 1 ? 0 : Math.pow(1 - u, 1.6);
  };
  const toWorld = (r: number[]): number[] => r.map((v, i) => (i & 1 ? OY + v : OX + fc * v));
  const paint = (f: GFrame, list: Paint[]) => {
    for (const p of list) {
      const c = o.ramp[p.tone] ?? o.ramp[0]!;
      if (p.sep) for (const r of p.rings) fillRings(f, [toWorld(r)], c);
      else fillRings(f, p.rings.map(toWorld), c);
    }
  };
  return {
    update(dt: number) {
      if (!o.held?.()) t += dt * 60;
    },
    done() {
      return t >= end;
    },
    /** 지금 틱 (멈춘 틱은 빼고) */
    tick() {
      return t;
    },
    draw(f: GFrame, l?: Layer) {
      const layer = l ?? 'back';
      for (const s of o.shapes) {
        if ((s.layer ?? 'back') !== layer) continue;
        const k = kOf(s);
        if (k < 0) continue;
        const at: GPt = 'at' in s && s.at ? s.at : [0, 0];
        switch (s.kind) {
          case 'wedge':
            if (k > 0) paint(f, wedge(s, k));
            break;
          case 'swoosh':
            if (k > 0) paint(f, swoosh(s, k));
            break;
          case 'bolt':
            if (k > 0.15) paint(f, bolt(s, k));
            break;
          case 'ink':
            if (k > 0) paint(f, ink(s, k));
            break;
          case 'ring':
            paint(f, ring(s, k, at));
            break;
          case 'rays':
            if (k > 0) paint(f, rays(s, k, at));
            break;
          case 'flash':
            paint(f, flash(s, k, at));
            break;
          case 'embers': {
            const ts = t - (s.delay ?? 0);
            for (const e of sparks(s)) {
              if (ts >= e.life) continue;
              // 날아간 거리 (가볍게 떨어진다)
              const x = e.x + e.vx * ts;
              const y = e.y + e.vy * ts + 0.03 * ts * ts;
              const c = o.ramp[e.tone]!;
              const X = OX + fc * x;
              const Y = OY + y;
              put(f, X, Y, c);
              if (e.size > 1 && ts < e.life * 0.6) {
                put(f, X + fc, Y, c);
                put(f, X, Y + 1, c);
                put(f, X + fc, Y + 1, c);
              }
            }
            break;
          }
        }
      }
    },
  };
}
