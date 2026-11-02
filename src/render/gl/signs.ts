import { CITADEL as D } from '../../data/stages/citadel';
import { BREAKABLES, GLASS_BOTTOM, type Breakable } from '../../stage/citadel';

/**
 * 간판·글자 자리 목록 (렌더 전용, 확인 도구용). 무대를 그리는 코드가 글자를 그릴 때마다 자리를 적어 둔다.
 * 맵 검사(tools/mapcheck.mjs)의 '글자 검사'가 이 목록으로 화면마다 본다:
 * 글자가 판보다 넓지 않은지, 화면 가장자리에서 반쯤 잘리지 않는지, 같은 깊이의 글자끼리 겹치지 않는지,
 * 같은 문구가 한 화면에 두 번 나오지 않는지.
 * 그리고 간판 위계(주인공·어둡게·깜빡임·꺼짐)와 가로등 생김새·상태 (렌더 전용): 간판·가로등을 그리는 props.ts와
 * 빛이 닿는 곳에만 디테일을 그리는 건물 정면 그림(tex.ts)이 같은 표를 본다.
 */
export interface SignEntry {
  /** 그린 글자 */
  text: string;
  /** 무엇인지 (간판·포스터·전광판·페인트 글씨…) */
  kind: string;
  /** 월드 자리: x 범위, 높이(바닥 위) 범위, 깊이. layer가 있으면 먼 겹 좌표(겹 속도 layer, x·y는 겹 그림 위에서부터) */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z: number;
  layer?: number;
  /** 글자 폭과 받침 판 폭 (월드 px). 글자가 판보다 넓으면 넘친다 */
  textW: number;
  plateW: number;
}

export const SIGNS: SignEntry[] = [];

/** 월드 자리의 글자 (높이 y0~y1은 바닥 위) */
export function registerSign(text: string, kind: string, x0: number, x1: number, y0: number, y1: number, z: number, textW: number, plateW: number): void {
  SIGNS.push({ text, kind, x0, x1, y0, y1, z, textW, plateW });
}

/** 먼 겹 그림 위의 글자 (겹 좌표: x는 겹 그림 왼쪽에서, y는 겹 그림 위에서부터) */
export function registerLayerSign(text: string, kind: string, layer: number, x0: number, x1: number, y0: number, y1: number, textW: number, plateW: number): void {
  SIGNS.push({ text, kind, x0, x1, y0, y1, z: 0, layer, textW, plateW });
}

// ---------------------------------------------------------------- 획 글꼴 (간판·포스터 글씨)
/**
 * 획 글꼴: 글자마다 꺾은선 획 목록 (칸 좌표 가로 0~4, 세로 0~6). 3×5 글꼴을 키워 찍으면 큰 네모 픽셀이 되므로
 * (픽셀 크기 하나: 그림을 키워 쓰지 않는다), 필요한 크기의 글자 상자에 획을 1px·2px 선으로 다시 긋는다.
 * 모서리는 45° 한 칸씩 깎아 휘어진 유리관처럼 (5×7이면 고전 도트 글꼴과 같다).
 */
type Pt = readonly [number, number];
const STROKES: Record<string, ReadonlyArray<readonly Pt[]>> = {
  A: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]], [[0, 3], [4, 3]]],
  B: [[[0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [0, 6], [0, 0]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [3, 0], [4, 1], [4, 5], [3, 6], [0, 6], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [3, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [1, 3], [0, 3]], [[1, 3], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 2], [4, 0], [4, 6]], [[2, 2], [2, 3]]],
  N: [[[0, 6], [0, 0]], [[0, 1], [4, 5]], [[4, 0], [4, 6]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 5], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [0, 3], [1, 4], [1, 5], [2, 6], [3, 5], [3, 4], [4, 3], [4, 0]]],
  W: [[[0, 0], [0, 6], [2, 4], [4, 6], [4, 0]], [[2, 4], [2, 3]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [0, 1], [2, 3], [4, 1], [4, 0]], [[2, 3], [2, 6]]],
  '1': [[[1, 1], [2, 0], [2, 6]], [[1, 6], [3, 6]]],
  '7': [[[0, 0], [4, 0], [4, 1], [2, 3], [2, 6]]],
  '-': [[[1, 3], [3, 3]]],
  '.': [[[2, 6], [2, 6]]],
  '&': [[[4, 6], [1, 2], [1, 1], [2, 0], [3, 1], [3, 2], [0, 4], [0, 5], [1, 6], [2, 6], [4, 4]]],
};

/** 글자 상자 안의 칸 좌표: 가운데를 기준으로 양쪽을 똑같이 내림 (크기가 홀수 배가 아니어도 글자가 좌우·위아래 대칭) */
const snap = (u: number, n: number, size: number): number => {
  const k = (size - 1) / n;
  return u <= n / 2 ? Math.floor(u * k) : size - 1 - Math.floor((n - u) * k);
};

/** 칸 그림 (글자 덩어리): 1이면 획 */
export interface Mask {
  w: number;
  h: number;
  m: Uint8Array;
}

/** 글자 하나의 실제 폭 (칸 좌표 0~4 중 쓰는 열): 좁은 글자(I, 1)는 좁게 */
function glyphSpan(ch: string): [number, number] {
  const s = STROKES[ch];
  if (!s) return [0, 4];
  let a = 4;
  let b = 0;
  for (const line of s) for (const [x] of line) {
    a = Math.min(a, x);
    b = Math.max(b, x);
  }
  return [a, b];
}

/** 글자 하나를 W×H 상자, 굵기 t로 긋는다 (상자 왼쪽 위 ox, oy) */
function strokeGlyph(m: Mask, ch: string, ox: number, oy: number, W: number, H: number, t: number): void {
  const s = STROKES[ch];
  if (!s) return;
  const put = (x: number, y: number) => {
    for (let dy = 0; dy < t; dy++) for (let dx = 0; dx < t; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && py >= 0 && px < m.w && py < m.h) m.m[py * m.w + px] = 1;
    }
  };
  const iw = W - (t - 1);
  const ih = H - (t - 1);
  for (const line of s) {
    for (let k = 0; k < line.length; k++) {
      const a = line[k];
      const b = line[Math.min(line.length - 1, k + 1)];
      let x0 = ox + snap(a[0], 4, iw);
      let y0 = oy + snap(a[1], 6, ih);
      const x1 = ox + snap(b[0], 4, iw);
      const y1 = oy + snap(b[1], 6, ih);
      const dx = Math.abs(x1 - x0);
      const sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0);
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        put(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }
  }
}

/** 글자 하나가 차지하는 폭 (px, 상자 W, 굵기 t) */
function glyphW(ch: string, W: number, t: number): number {
  if (ch === ' ') return Math.max(2, Math.round(W * 0.6));
  const [a, b] = glyphSpan(ch);
  const iw = W - (t - 1);
  return snap(b, 4, iw) - snap(a, 4, iw) + t;
}

/** 낱말 폭 (px): 글자 상자 W, 굵기 t, 글자 사이 gap */
export function wordWidth(text: string, W: number, t = 1, gap = Math.max(1, Math.round(W / 4))): number {
  let w = 0;
  [...text].forEach((ch, k) => {
    w += glyphW(ch, W, t) + (k ? gap : 0);
  });
  return w;
}

/** 낱말 하나를 칸 그림으로 (가로로 잇는다). 글자 상자 W×H, 굵기 t, 글자 사이 gap */
export function wordMask(text: string, W: number, H: number, t = 1, gap = Math.max(1, Math.round(W / 4))): Mask {
  const w = Math.max(1, wordWidth(text, W, t, gap));
  const m: Mask = { w, h: H, m: new Uint8Array(w * H) };
  let x = 0;
  for (const ch of text) {
    const [a] = glyphSpan(ch);
    const iw = W - (t - 1);
    if (ch !== ' ') strokeGlyph(m, ch, x - snap(a, 4, iw), 0, W, H, t);
    x += glyphW(ch, W, t) + gap;
  }
  return m;
}

/** 세로 낱말 (세로 간판): 글자를 위에서 아래로 쌓는다. 상자 폭 boxW 안에서 글자마다 가운데 맞춤, 글자 사이 step */
export function columnMask(text: string, boxW: number, W: number, H: number, t: number, step: number): Mask {
  const n = [...text].length;
  const h = Math.max(1, (n - 1) * step + H);
  const m: Mask = { w: boxW, h, m: new Uint8Array(boxW * h) };
  [...text].forEach((ch, k) => {
    const [a] = glyphSpan(ch);
    const iw = W - (t - 1);
    const gw = glyphW(ch, W, t);
    strokeGlyph(m, ch, Math.floor((boxW - gw) / 2) - snap(a, 4, iw), k * step, W, H, t);
  });
  return m;
}

/** 칸 그림을 r칸 넓힌 것 (관 둘레 번짐·글자 그늘) */
export function grow(src: Mask, r = 1, diagonal = false): Mask {
  const w = src.w + r * 2;
  const h = src.h + r * 2;
  const m: Mask = { w, h, m: new Uint8Array(w * h) };
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (!src.m[y * src.w + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!diagonal && Math.abs(dx) + Math.abs(dy) > r) continue;
      m.m[(y + r + dy) * w + x + r + dx] = 1;
    }
  }
  return m;
}

/** 칸 그림을 (x, y)에 한 색으로 칠한다 */
export function paintMask(g: CanvasRenderingContext2D, m: Mask, x: number, y: number, color: string): void {
  g.fillStyle = color;
  x = Math.round(x);
  y = Math.round(y);
  for (let j = 0; j < m.h; j++) {
    let run = -1;
    for (let i = 0; i <= m.w; i++) {
      const on = i < m.w && m.m[j * m.w + i] === 1;
      if (on && run < 0) run = i;
      else if (!on && run >= 0) {
        g.fillRect(x + run, y + j, i - run, 1);
        run = -1;
      }
    }
  }
}

/** 칠한 글씨 (페인트·인쇄): 글자 상자 W×H, 굵기 t */
export function paintWord(g: CanvasRenderingContext2D, text: string, x: number, y: number, W: number, H: number, color: string, t = 1, gap?: number): Mask {
  const m = wordMask(text, W, H, t, gap);
  paintMask(g, m, x, y, color);
  return m;
}

/** 네온관 색: 관 심(켜졌을 때), 관 둘레 번짐(켜졌을 때), 꺼진 유리관, 관을 받친 그늘 */
export interface Tube {
  core: string;
  halo: string;
  glass: string;
  mount: string;
}

/**
 * 네온관 글씨: 바탕(g)에는 관을 받친 그늘(둘레 1칸)과 꺼진 유리관, 발광(e)에는 관 심과 둘레 번짐 (네온 네 겹 중 앞의 둘).
 * e가 null이면 꺼진 관 (바탕만). 칸 그림 m의 왼쪽 위가 (x, y)
 */
export function neonMask(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D | null, m: Mask, x: number, y: number, tube: Tube): void {
  const halo = grow(m, 1);
  paintMask(g, halo, x - 1, y - 1, tube.mount);
  paintMask(g, m, x, y, tube.glass);
  if (!e) return;
  paintMask(e, halo, x - 1, y - 1, tube.halo);
  paintMask(e, m, x, y, tube.core);
}

/**
 * 다섯 꼭지 별 (반지름 r px): 7×6 별을 키워 찍지 않고 그 크기로 다시 칠한다 (칸 가운데가 별 안에 드는 칸만).
 * inner: 안쪽 꼭지 반지름 비율
 */
export function starShape(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, inner = 0.45): void {
  const pts: Array<[number, number]> = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * inner : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  g.fillStyle = color;
  const r0 = Math.ceil(r) + 1;
  for (let y = Math.floor(cy - r0); y <= cy + r0; y++) {
    for (let x = Math.floor(cx - r0); x <= cx + r0; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- 간판 위계와 가로등 (렌더 전용 표)
/** 간판 위계: 구간마다 주인공 간판 하나만 가장 밝게. 나머지는 어둡거나, 깜빡이거나, 꺼짐 */
export type SignRole = 'hero' | 'dim' | 'flicker' | 'off' | 'marquee' | 'board';
const SIGN_ROLE: Record<string, SignRole> = {
  'blade:PALACE': 'hero',
  'marquee:TONIGHT': 'marquee',
  'board:DINER': 'dim',
  'blade:HOTEL': 'flicker',
  'shop:ROOMS': 'off',
  'shop:BAKERY': 'off',
  'shop:RADIO': 'hero',
  'shop:LAUNDRY': 'flicker',
  'shop:GROCER': 'dim',
};
export const roleOf = (b: Breakable): SignRole => (b.style === 'billboard' ? 'board' : SIGN_ROLE[`${b.style}:${b.text}`] ?? 'off');

/**
 * 가로등 생김새와 상태 (지침서 5장 '가로등: 간격은 불규칙하게, 일부는 꺼져 있다', 7장 '크기·간격·상태를 바꾼다').
 * 자리는 데이터 그대로 (부서지는 물건). 생김새: cobra 코브라 머리 나트륨등(1960년대 새 등), goose 굽은 목에 쇠갓을 씌운 옛 백열등,
 * twin 광장의 두 구 주철 등, lantern 공원 등롱. 상태: on 켜짐, dim 낡아 어두움, dead 꺼짐(깨진 유리), flicker 끊김.
 * 색은 따뜻한 빛 안에서만 (나트륨 주황 · 짙은 주황 · 백열 호박 · 옅은 백열). 화면마다 주인공(간판·동상·문)이 이기게
 * 주인공 바로 옆 등은 어둡거나 꺼 둔다.
 */
export type LampKind = 'cobra' | 'goose' | 'twin' | 'lantern';
export type LampState = 'on' | 'dim' | 'dead' | 'flicker';
export interface LampLook {
  kind: LampKind;
  state: LampState;
  /** 빛 색 (따뜻한 빛) */
  color: string;
  /** 빛 세기·닿는 거리 */
  power: number;
  range: number;
  /** 공기 속 빛줄기 세기 (0이면 없음)와 바닥 쪽 반폭 */
  shaft: number;
  spread: number;
  /** 낡음 0~1 (녹·기울기) */
  age: number;
}

const SODIUM = '#ffb15e';
const DEEP = '#f29c40';
const BULB = '#ffcf7a';
const PALE = '#ffe2a8';

/** 등마다 (데이터 lamps의 x): 생김새·상태·색. 표에 없는 등은 코브라 나트륨등 */
const LAMP_TABLE: Record<number, Partial<LampLook>> = {
  84: { kind: 'cobra' },
  318: { kind: 'goose', color: DEEP, age: 0.7 },
  760: { kind: 'cobra', state: 'dim', color: DEEP },
  860: { kind: 'goose', color: BULB, age: 0.5 },
  1140: { kind: 'cobra' },
  1330: { kind: 'goose', state: 'dim', color: DEEP, age: 0.8 },
  1520: { kind: 'cobra' },
  1934: { kind: 'cobra', color: SODIUM },
  // 극장 앞: PALACE가 거리를 비추게 옛 등은 어둡게
  2074: { kind: 'goose', state: 'dim', color: BULB, age: 0.6 },
  2262: { kind: 'goose', color: DEEP, age: 0.9 },
  2484: { kind: 'cobra', state: 'dim', color: DEEP },
  // 광장 서쪽 입구: 동상이 주인공 (아래에서 올려 비추는 투광등). 깨진 등
  2662: { kind: 'cobra', state: 'dead', age: 1 },
  2826: { kind: 'twin', color: PALE },
  3510: { kind: 'twin', color: PALE, state: 'dim' },
  3728: { kind: 'cobra' },
  3884: { kind: 'goose', state: 'dead', age: 1 },
  4074: { kind: 'goose', color: BULB, age: 0.4 },
  // 라디오 가게 앞: RADIO가 주인공
  4342: { kind: 'cobra', state: 'dim', color: DEEP, age: 0.5 },
  4480: { kind: 'lantern', color: BULB },
  4680: { kind: 'lantern', color: DEEP, state: 'dim', age: 0.6 },
  4960: { kind: 'cobra' },
  5104: { kind: 'goose', state: 'dim', color: BULB, age: 0.7 },
  5330: { kind: 'cobra', color: DEEP },
  5680: { kind: 'cobra', state: 'dead', age: 0.9 },
  // 성벽 검문소: 옅은 보안등 (따뜻한 빛 중 가장 옅게, 주황이 남색 구간을 덮지 않게)
  5860: { kind: 'cobra', color: PALE, state: 'dim' },
  6020: { kind: 'cobra', color: PALE },
  6240: { kind: 'goose', color: PALE, state: 'dim', age: 0.8 },
};

const lookCache = new Map<number, LampLook>();

/** 가로등 x(기둥 가운데, 데이터 lamps의 값)의 생김새와 상태 */
export function lampLook(x: number): LampLook {
  const key = Math.round(x);
  let l = lookCache.get(key);
  if (l) return l;
  const t = LAMP_TABLE[key] ?? {};
  const dataDark = (D.breakables.lampsDark as readonly number[]).includes(key);
  const dataFlicker = (D.breakables.lampsFlicker as readonly number[]).includes(key);
  const kind = t.kind ?? 'cobra';
  const state: LampState = dataDark ? 'dead' : dataFlicker ? 'flicker' : (t.state ?? 'on');
  const color = t.color ?? SODIUM;
  const base = kind === 'cobra' ? { power: 1.8, range: 150, shaft: 0.13, spread: 46 }
    : kind === 'goose' ? { power: 1.35, range: 125, shaft: 0.1, spread: 34 }
      : kind === 'twin' ? { power: 1.0, range: 110, shaft: 0.035, spread: 40 }
        : { power: 0.95, range: 105, shaft: 0.03, spread: 36 };
  const dim = state === 'dim' ? 0.5 : 1;
  l = {
    kind, state, color,
    power: base.power * dim,
    range: base.range * (state === 'dim' ? 0.85 : 1),
    shaft: state === 'dead' ? 0 : base.shaft * (state === 'dim' ? 0.45 : 1),
    spread: base.spread,
    age: t.age ?? (state === 'dead' ? 1 : 0.2),
  };
  lookCache.set(key, l);
  return l;
}

/** 등 머리 높이 (바닥 위, 빛이 나오는 곳) */
export const lampHeadY = (kind: LampKind): number => (kind === 'cobra' ? 102 : kind === 'goose' ? 96 : kind === 'twin' ? 92 : 88);

/**
 * 붙박이 빛의 대강 (렌더 전용, 그림을 미리 그릴 때만 쓴다): 가로등·네온 간판·쇼윈도.
 * 건물 정면 그림이 '빛이 닿는 곳에만 디테일'을 그리려고 본다 (실제 빛은 매 틱 lightPool이 정한다).
 * down: 아래로만 비추는 등 (가로등)
 */
export interface StaticLight {
  x: number;
  y: number;
  z: number;
  range: number;
  power: number;
  down: boolean;
}
let statics: StaticLight[] | null = null;

export function staticLights(): readonly StaticLight[] {
  if (statics) return statics;
  const out: StaticLight[] = [];
  for (const x of D.breakables.lamps) {
    const l = lampLook(x);
    if (l.state === 'dead') continue;
    out.push({
      x: x + (l.kind === 'cobra' ? 18 : l.kind === 'goose' ? 12 : 0), y: lampHeadY(l.kind), z: -28, range: l.range,
      power: l.power * (l.state === 'flicker' ? 0.7 : 1), down: l.kind === 'cobra' || l.kind === 'goose',
    });
  }
  for (const b of BREAKABLES) {
    if (b.kind === 'glass') out.push({ x: b.x + b.w / 2, y: GLASS_BOTTOM + b.h / 2, z: -24, range: 84, power: 0.8, down: false });
    if (b.kind !== 'neon') continue;
    const role = roleOf(b);
    if (role === 'off') continue;
    const power = role === 'hero' ? 2.4 : role === 'dim' ? 0.7 : role === 'marquee' ? 0.8 : role === 'board' ? 1.2 : 1.0;
    const range = role === 'hero' ? 190 : role === 'marquee' ? 100 : 110;
    out.push({ x: b.x + b.w / 2, y: role === 'marquee' ? b.bottom - 8 : b.bottom + b.h / 2, z: -20, range, power, down: false });
  }
  statics = out;
  return out;
}

/** 붙박이 빛이 월드 자리 (x, 높이 y, 깊이 z)의 정면(카메라 쪽을 보는 면)에 주는 밝기 (0~1 남짓) */
export function staticLightAt(x: number, y: number, z: number, extra: readonly StaticLight[] = []): number {
  let v = 0;
  const one = (l: StaticLight) => {
    const dx = l.x - x;
    const dy = l.y - y;
    const dz = l.z - z;
    if (Math.abs(dx) > l.range || Math.abs(dy) > l.range) return;
    const d = Math.hypot(dx, dy, dz);
    const k = 1 - d / l.range;
    if (k <= 0) return;
    // 아래로만 비추는 등: 머리보다 아래만 (lights.ts의 down 등과 같은 모양)
    const spot = l.down ? Math.min(1, Math.max(0, (dy / Math.max(d, 1) - 0.25) / 0.5)) : 1;
    const ndl = Math.min(1, Math.max(0.25, (dz / Math.max(d, 1)) * 0.75 + 0.25));
    v += l.power * k * k * spot * ndl;
  };
  for (const l of staticLights()) one(l);
  for (const l of extra) one(l);
  return v;
}
