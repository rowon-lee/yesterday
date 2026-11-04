// YESTERDAY 이펙트 실루엣 (렌더 전용).
// data/vfx에 디자인해 둔 키 실루엣(피크·찢어짐·흩어짐)을 틱에 맞춰 보간하고, 다각형과 1px 선을 색표 색으로 칠한다.
// 난수는 쓰지 않는다: 같은 틱이면 언제나 같은 그림이다. 칠한 칸은 애니 이펙트 칸(mark)으로 적어
// 후처리가 색 보정 없이 그린 색 그대로 보여 주고 이펙트 빛 번짐을 건다 (동작연출지침서 14-5).
import type { VDesign, VPart, VRing } from '../data/vfx/types';
import { put, type AFrame, type Layer } from './anime/common';

/**
 * 1px 꺾은선의 칸 (데이터 좌표 칸 번호 그대로: 뒤집기 전에 칸을 정해야 좌우가 똑같이 대칭이다).
 * 고리마다 [x, y, x, y, …] 칸 목록
 */
export function polylinePixels(r: ArrayLike<number>): number[] {
  const out: number[] = [];
  if (r.length === 2) return [r[0]!, r[1]!];
  for (let i = 2; i + 1 < r.length; i += 2) {
    const x0 = r[i - 2]!;
    const y0 = r[i - 1]!;
    const dx = r[i]! - x0;
    const dy = r[i + 1]! - y0;
    const n = Math.max(1, Math.abs(dx), Math.abs(dy));
    for (let s = i === 2 ? 0 : 1; s <= n; s++) out.push(Math.round(x0 + (dx * s) / n), Math.round(y0 + (dy * s) / n));
  }
  return out;
}

/**
 * 다각형 고리들 칠하기 (짝홀 규칙: 고리 안의 고리는 구멍, 칸 가운데가 안에 들면 칠한다). 점은 월드 px, 고리마다 평평한 x, y 목록.
 * 흐림·디더 없이 딱딱한 경계 (도트 그림의 계단 모양 가장자리). 칠할 칸 구간을 [y, x0, x1] 목록으로 돌려준다
 */
export function polySpans(rings: ReadonlyArray<ArrayLike<number>>, clip?: { x0: number; y0: number; x1: number; y1: number }): number[] {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const r of rings) {
    for (let i = 1; i < r.length; i += 2) {
      if (r[i]! < y0) y0 = r[i]!;
      if (r[i]! > y1) y1 = r[i]!;
    }
  }
  const out: number[] = [];
  if (!(y1 > y0)) return out;
  let ys = Math.ceil(y0 - 0.5);
  let ye = Math.floor(y1 - 0.5);
  if (clip) {
    ys = Math.max(ys, clip.y0);
    ye = Math.min(ye, clip.y1);
  }
  const xs: number[] = [];
  for (let y = ys; y <= ye; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (const r of rings) {
      const n = r.length >> 1;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = r[i * 2 + 1]!;
        const yj = r[j * 2 + 1]!;
        if (yi > cy !== yj > cy) {
          const xi = r[i * 2]!;
          const xj = r[j * 2]!;
          xs.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let xa = Math.ceil(xs[k]! - 0.5);
      let xb = Math.floor(xs[k + 1]! - 0.5);
      if (clip) {
        xa = Math.max(xa, clip.x0);
        xb = Math.min(xb, clip.x1);
      }
      if (xb >= xa) out.push(y, xa, xb);
    }
  }
  return out;
}

/** 보간 빠르기: 처음에 빨리 변하고 끝에서 느려진다 (터지고 가라앉는다) */
const easeOut = (u: number): number => 1 - (1 - u) * (1 - u);

/**
 * 틱 t (판정 시작 = 0)의 모양: 그릴 부품마다 고리 (공격자 발밑 기준 px). 끝났으면 빈 목록.
 * 키 i의 at ~ at+hold는 키 모양 그대로, 그 뒤 다음 키 at까지 같은 번호의 점끼리 보간한다.
 * 다음 키에 없는 부품은 키 i가 머무는 동안만 그린다. 마지막 키는 end까지 머문다.
 * key = 이 모양을 다시 써도 되는지 가리는 값 (키 모양 그대로면 키 번호, 보간 중이면 null)
 */
export function shapeAt(d: VDesign, t: number): { key: number | null; parts: Array<{ part: VPart; rings: readonly VRing[] }> } {
  const parts: Array<{ part: VPart; rings: readonly VRing[] }> = [];
  if (t < 0 || t >= d.end || !d.keys.length) return { key: null, parts };
  let i = 0;
  while (i + 1 < d.keys.length && t >= d.keys[i + 1]!.at) i++;
  const k = d.keys[i]!;
  const next = d.keys[i + 1];
  const holdEnd = k.at + (k.hold ?? 0);
  const u = !next || t <= holdEnd ? 0 : easeOut(Math.min(1, (t - holdEnd) / Math.max(1e-6, next.at - holdEnd)));
  for (const part of d.parts) {
    const a = part.keys[k.name];
    if (!a) continue;
    const b = next ? part.keys[next.name] : undefined;
    if (u === 0) parts.push({ part, rings: a });
    else if (b && b.length === a.length && b.every((r, j) => r.length === a[j]!.length)) {
      parts.push({ part, rings: a.map((r, j) => r.map((v, q) => v + (b[j]![q]! - v) * u)) });
    }
  }
  return { key: u === 0 ? i : null, parts };
}

export interface SilhouetteSpec {
  design: VDesign;
  /** 색표: 실루엣 색 단계 번호 → 색 (0xAABBGGRR, render/vfx fxColor) */
  ramp: readonly number[];
  /** 공격자 발밑 (월드 px, 판정이 시작하는 틱 자리. 그 뒤로 공격자가 움직여도 이펙트는 그 자리에 남는다)과 보는 쪽 */
  offset: readonly [number, number];
  facing: number;
}

/** 실루엣 이펙트 하나 (render/vfx 이펙트 층에 얹는다) */
export default function silhouette(o: SilhouetteSpec) {
  const fc = o.facing >= 0 ? 1 : -1;
  const OX = Math.round(o.offset[0]);
  const OY = Math.round(o.offset[1]);
  /** 칠할 것 (겹마다): 칠하기 = [y, x0, x1]… 구간, 선 = 월드 칸 [x, y]… */
  type Paint = { layer: Layer; color: number; spans?: number[]; pixels?: number[] };
  let cache: { key: number; paints: Paint[] } | null = null;
  const build = (parts: ReturnType<typeof shapeAt>['parts']): Paint[] =>
    parts.map(({ part, rings }) => {
      const color = o.ramp[part.step] ?? o.ramp[0]!;
      const layer = part.layer ?? 'back';
      if (part.kind === 'fill') {
        // 모서리 점: 오른쪽 보기 x → OX + x, 왼쪽 보기 → OX − x (칸 가운데로 칠하므로 뒤집어도 칸이 맞는다)
        const world = rings.map((r) => r.map((v, q) => (q & 1 ? OY + v : OX + fc * v)));
        return { layer, color, spans: polySpans(world) };
      }
      // 칸 번호 점: 데이터 좌표에서 칸을 정한 뒤 옮긴다 (오른쪽 보기 칸 i → OX + i, 왼쪽 보기 → OX − i − 1)
      const pixels: number[] = [];
      for (const r of rings) {
        const p = polylinePixels(r);
        for (let i = 0; i < p.length; i += 2) pixels.push(fc > 0 ? OX + p[i]! : OX - p[i]! - 1, OY + p[i + 1]!);
      }
      return { layer, color, pixels };
    });
  let t = 0;
  return {
    update(dt: number) {
      t += dt * 60;
    },
    done() {
      return t >= o.design.end;
    },
    /** 지금 틱 (판정 시작 = 0) */
    tick() {
      return t;
    },
    /** 실제 광원 자리 (월드 px)와 세기 0~1: 중심이 가장 밝고 덩어리가 그다음 */
    phase(): { k: number; pts: Array<[number, number]> } {
      const k = t < o.design.end ? 1 : 0;
      const c = o.design.center;
      const m = o.design.mass ?? c;
      return { k, pts: [[OX + fc * c[0], OY + c[1]], [OX + fc * m[0], OY + m[1]]] };
    },
    draw(f: AFrame, l?: Layer) {
      const layer = l ?? 'back';
      const sh = shapeAt(o.design, t);
      let paints: Paint[];
      if (sh.key !== null && cache && cache.key === sh.key) paints = cache.paints;
      else {
        paints = build(sh.parts);
        if (sh.key !== null) cache = { key: sh.key, paints };
      }
      for (const p of paints) {
        if (p.layer !== layer) continue;
        if (p.spans) {
          const s = p.spans;
          for (let i = 0; i < s.length; i += 3) for (let x = s[i + 1]!; x <= s[i + 2]!; x++) put(f, x, s[i]!, p.color);
        }
        if (p.pixels) {
          const q = p.pixels;
          for (let i = 0; i < q.length; i += 2) put(f, q[i]!, q[i + 1]!, p.color);
        }
      }
    },
  };
}
