import { CITADEL as D } from '../../data/stages/citadel';
import { FLOOR_H, SHOP_H, DOOR_H, DOOR_W, doorOf, escapeOf, type FrontBuildingPlace } from '../../stage/citadel';
import { glyphRows } from '../font';
import { COLORS as C } from '../palette';
import { figure, FLUO, roomWall, TV, WARM } from './rooms';
import { canvas, disc, ditherRect, hash, line, paint, rect } from '../dither';
import { grow, paintWord, registerSign, staticLightAt, starShape, wordMask, wordWidth, type StaticLight } from './signs';

/** 건물 정면 깊이 (buildings.ts의 FRONT_Z와 같다: 순환 import를 피해 숫자로 둔다) */
const FRONT_Z_SIGN = -40;

/**
 * 2.5D 무대의 도트 텍스처 (렌더 전용, 오프스크린 Canvas 2D에 미리 그린다).
 * 아트 규칙: 같은 창문·벽돌을 되풀이하지 않는다 (건물·창마다 씨앗이 다르다), 얼룩·녹·빗물 자국·찢긴 포스터로 낡게,
 * 창은 일부만 켜고 몇 개는 커튼 그림자나 TV 깜빡임. 형태는 일부러 조금씩 비뚤게.
 * 건물 정면은 싸우는 면보다 뒤(깊이 FRONT_Z)에 있어 화면에서 조금 작게 보이므로, 텍스처 한 칸이 화면 1px이 되게
 * 그 배율(S)로 줄인 크기에 그린다 (도트가 고르게 보이게).
 */

/** 정면 그림 한 장: 바탕(빛을 받는 색), 발광(스스로 빛나는 창), 깜빡이는 TV 창 자리, 빛을 내는 창 자리 */
export interface Facade {
  map: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  /** 텍스처 칸 크기 (가로·세로) */
  tw: number;
  th: number;
  /** TV가 켜진 창 (텍스처 칸 좌표, 위에서 아래로) */
  tvs: Array<{ x: number; y: number; w: number; h: number }>;
  /** 불 켜진 창 (빛 후보, 텍스처 칸 좌표) */
  lit: Array<{ x: number; y: number; warm: boolean }>;
  /** 창에 끼운 냉방기 (텍스처 칸 좌표: 창 아래쪽 가운데 x, 창턱 y, 폭) */
  acs: Array<{ x: number; y: number; w: number }>;
}

const rnd = (seed: number, k: number): number => hash(seed * 7919 + k * 104729);

/** 벽돌 색 묶음: 바탕, 어두운 벽돌, 밝은 벽돌, 줄눈 */
const BRICKS = [
  [C.brick, C.brickDark, C.brickLight, '#2b2124'],
  [C.brickRed, C.brickRedDark, '#5a3d39', '#2e1f1e'],
  ['#3f3a40', '#332f35', '#4a454c', '#232026'],
] as const;

/** 벽돌 벽: 벽돌마다 색이 조금씩 다르고, 가끔 탄 벽돌·땜질 자국 */
export function brickWall(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, seed: number, set = 0): void {
  const [base, dark, light, mortar] = BRICKS[set % BRICKS.length];
  rect(g, x0, y0, w, h, mortar);
  for (let row = 0, y = y0; y < y0 + h; row++, y += 4) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1, x = x0 - off; x < x0 + w; col++, x += 8) {
      const r = rnd(seed + row * 31, col);
      const color = r < 0.62 ? base : r < 0.8 ? dark : r < 0.95 ? light : C.smog1;
      const bx = Math.max(x0, x);
      const bw = Math.min(x + 7, x0 + w) - bx;
      if (bw > 0) rect(g, bx, y, bw, Math.min(3, y0 + h - y), color);
    }
  }
  // 땜질 자국 (다른 벽돌로 메운 네모) 두세 곳
  for (let k = 0; k < 3; k++) {
    if (rnd(seed, 200 + k) < 0.35) continue;
    const pw = 10 + Math.floor(rnd(seed, 210 + k) * 18);
    const ph = 8 + Math.floor(rnd(seed, 220 + k) * 14);
    const px = x0 + Math.floor(rnd(seed, 230 + k) * Math.max(1, w - pw));
    const py = y0 + Math.floor(rnd(seed, 240 + k) * Math.max(1, h - ph));
    ditherRect(g, px, py, pw, ph, k % 2 ? dark : C.stoneDark, 7);
  }
}

/** 낡음: 꼭대기 그을음, 창턱 아래 빗물 자국, 땅 가까운 소금기, 금 */
export function weather(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, seed: number, plain = false): void {
  if (plain) {
    // 처마 없이 꼭대기가 다 보이는 벽 (창고·제철소): 맨 위 한 띠와 2~4칸 폭 그을음 줄
    // (띠 경계의 점선 줄이 넓은 벽 꼭대기에 그대로 드러나 넓은 면 디더로 잡혔다)
    ditherRect(g, x0, y0, w, 7, C.smog0, 8, 0, 0, false);
    for (let x = x0 + (seed % 3); x < x0 + w; x += 3 + Math.floor(rnd(seed, 900 + x) * 6)) {
      const len = 3 + Math.floor(rnd(seed, 950 + x) * 12);
      ditherRect(g, x, y0 + 7, 2 + Math.floor(rnd(seed, 990 + x) * 3), len, C.smog0, 4, 0, 0, false);
    }
  } else {
    // 꼭대기 그을음 (아래로 갈수록 옅게). 길가 건물은 처마가 맨 위를 가리고, 띠가 처마 밑 그늘 면과 이어진다
    for (let k = 0; k < 4; k++) ditherRect(g, x0, y0 + k * 6, w, 6, C.smog0, 9 - k * 2, seed & 3);
  }
  // 처마에서 흘러내린 빗물 자국 (가늘고 긴 어두운 줄)
  for (let k = 0; k < Math.floor(w / 9); k++) {
    if (rnd(seed, 300 + k) < 0.4) continue;
    const sx = x0 + Math.floor(rnd(seed, 310 + k) * w);
    const len = 20 + Math.floor(rnd(seed, 320 + k) * 70);
    for (let y = 0; y < len; y++) if (hash(seed + sx * 13 + y * 7) < 0.75 - (y / len) * 0.6) rect(g, sx, y0 + 8 + y, 1, 1, C.smog1);
  }
  // 땅 가까운 소금기 얼룩 (밝게 번진 자국, 가장자리 점선 없이)
  ditherRect(g, x0, y0 + h - 14, w, 10, C.stone, 2, 0, 0, false);
  // 금 (지그재그)
  for (let k = 0; k < 2; k++) {
    if (rnd(seed, 400 + k) < 0.45) continue;
    let cx = x0 + Math.floor(rnd(seed, 410 + k) * w);
    let cy = y0 + Math.floor(rnd(seed, 420 + k) * h * 0.7);
    const n = 12 + Math.floor(rnd(seed, 430 + k) * 20);
    for (let i = 0; i < n; i++) {
      rect(g, cx, cy, 1, 1, C.smog0);
      cy++;
      cx += rnd(seed, 440 + i + k * 50) < 0.5 ? -1 : 1;
    }
  }
}

export interface FacadeOpts {
  /** 화면 배율 (깊이 때문에 조금 작게 보이는 비율) */
  s: number;
}

// ---------------------------------------------------------------- 길가 건물 정면 (재질 목소리 · 빛 닿는 곳에만 디테일)
/**
 * 건물마다 재질 목소리 (지침서 '거리마다 분위기가 다르다', 같은 벽돌·창 반복 금지):
 * 빵집 붉은 벽돌과 벽돌 아치, 호텔 누런 벽돌과 돌 띠, 다이너 2층 칠한 벽, 세탁소 칠이 벗겨진 벽돌, 현관 아파트 갈색 사암,
 * 식료품점 자줏빛 벽돌, 라디오 가게 검보랏빛 벽돌. 창 크기·간격·묶음·윗장식도 건물마다 다르다.
 * 빛이 닿는 곳(가로등 아래·간판 둘레·켜진 창 옆)만 벽돌 결·얼룩·포스터 글자가 또렷하고, 어둠 속 벽은 줄눈을 줄여 조용하게 둔다.
 */
interface Voice {
  /** 벽 바탕·어두운·밝은·줄눈 */
  base: string;
  dark: string;
  light: string;
  joint: string;
  /** 벽 결: brick 벽돌(8×4, 맵 전체 같은 크기), ashlar 큰 돌, render 칠한 벽, brown 갈색 사암 */
  bond: 'brick' | 'ashlar' | 'render' | 'brown';
  /** 장식 돌 (상인방·창턱·띠): 빛 받는 면·가운데·그늘 */
  trimLit: string;
  trim: string;
  trimDark: string;
  /** 창: 폭·높이·묶음 사이 간격(가운데에서 가운데)·묶음 수·윗장식·창틀 색 */
  win: { w: number; h: number; gap: number; group: 1 | 2 | 3; head: 'flat' | 'arch' | 'soldier' | 'pediment'; sash: string };
  /** 칠이 벗겨지면 드러나는 벽돌 (칠한 벽만) */
  under?: string;
  /** 층마다 돌 띠 */
  belts?: boolean;
}

const VOICE: Record<string, Voice> = {
  BAKERY: {
    base: C.brickRed, dark: C.brickRedDark, light: '#5a3d39', joint: '#2e1f1e', bond: 'brick',
    trimLit: '#78523d', trim: '#614231', trimDark: '#3e2a1f',
    win: { w: 15, h: 40, gap: 52, group: 2, head: 'arch', sash: '#3e2a1f' },
  },
  DINER: {
    base: '#4b443a', dark: '#3e3830', light: '#5a5145', joint: '#322d27', bond: 'render',
    trimLit: C.chrome, trim: C.chromeDark, trimDark: '#3a3e49',
    win: { w: 18, h: 34, gap: 24, group: 3, head: 'flat', sash: C.chromeDark },
  },
  HOTEL: {
    base: '#5a5145', dark: '#4b443a', light: '#6b6152', joint: '#322d27', bond: 'brick',
    trimLit: C.paintCream, trim: C.stone, trimDark: C.stoneDark,
    win: { w: 13, h: 38, gap: 24, group: 1, head: 'soldier', sash: C.paintCream },
    belts: true,
  },
  LAUNDRY: {
    base: '#3f5352', dark: '#33433f', light: '#4a5f5c', joint: '#2a3533', bond: 'render', under: C.brickRed,
    trimLit: C.paintCream, trim: '#5a5145', trimDark: '#3e3830',
    win: { w: 17, h: 44, gap: 30, group: 1, head: 'flat', sash: '#2a3533' },
  },
  '': {
    base: '#4e3527', dark: '#3e2a1f', light: '#614231', joint: '#302018', bond: 'brown',
    trimLit: '#78523d', trim: '#614231', trimDark: '#302018',
    win: { w: 16, h: 48, gap: 28, group: 1, head: 'pediment', sash: '#231812' },
  },
  GROCER: {
    base: C.brick, dark: C.brickDark, light: C.brickLight, joint: '#2b2124', bond: 'brick',
    trimLit: C.stone, trim: C.stoneDark, trimDark: '#3a3434',
    win: { w: 15, h: 40, gap: 50, group: 2, head: 'flat', sash: '#5d4c42' },
  },
  RADIO: {
    base: '#3f3a40', dark: '#332f35', light: '#4a454c', joint: '#232026', bond: 'brick',
    trimLit: C.stone, trim: C.stoneDark, trimDark: '#2a2d36',
    win: { w: 13, h: 42, gap: 62, group: 3, head: 'soldier', sash: '#3a3e49' },
  },
  PALACE: {
    base: C.stone, dark: C.stoneDark, light: '#6b6152', joint: '#3a3434', bond: 'ashlar',
    trimLit: '#a8adb8', trim: '#6b6152', trimDark: C.stoneDark,
    win: { w: 26, h: 0, gap: 0, group: 1, head: 'arch', sash: C.iron },
  },
};
/** 귀돌 (구간 끝 모서리의 밝은 돌) */
const QUOIN = '#6b6152';
const voiceOf = (b: FrontBuildingPlace): Voice => VOICE[b.kind === 'theater' ? 'PALACE' : b.sign] ?? VOICE[''];

/** 정면 그림 위의 빛 지도 (텍스처 칸마다 0~1 남짓): 붙박이 빛 + 이 건물의 켜진 창. 2칸마다 재고 사이는 잇는다 */
function lightMap(b: FrontBuildingPlace, S: number, tw: number, th: number, extra: readonly StaticLight[]): Float32Array {
  const step = 2;
  const gw = Math.ceil(tw / step) + 1;
  const gh = Math.ceil(th / step) + 1;
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      grid[gy * gw + gx] = staticLightAt(b.x + (gx * step) / S, (th - gy * step) / S, FRONT_Z_SIGN, extra);
    }
  }
  const L = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) {
    const fy = y / step;
    const y0 = Math.min(gh - 2, Math.floor(fy));
    const ty = fy - y0;
    for (let x = 0; x < tw; x++) {
      const fx = x / step;
      const x0 = Math.min(gw - 2, Math.floor(fx));
      const tx = fx - x0;
      const a = grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x0 + 1] * tx;
      const c = grid[(y0 + 1) * gw + x0] * (1 - tx) + grid[(y0 + 1) * gw + x0 + 1] * tx;
      L[y * tw + x] = a * (1 - ty) + c * ty;
    }
  }
  return L;
}

/** 빛 지도 → 디테일이 보이는 정도 0~1 (어둠 속은 0) */
const seenOf = (v: number): number => Math.max(0, Math.min(1, (v - 0.05) / 0.3));

/** 창 하나의 계획 (텍스처 칸) */
interface Win {
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  fl: number;
  force?: 'lit' | 'dark';
}

/**
 * 켜진 창 몫: 씨앗으로 켜진 창이 20%보다 적으면 꺼진 보통 창(판자·깨짐·TV가 아닌 창) 중 씨앗 값이 큰 것부터 켜고,
 * 40%보다 많으면 켜진 창 중 씨앗 값이 작은 것부터 끈다.
 */
function litQuota(wins: Array<{ seed: number; force?: 'lit' | 'dark' }>): void {
  const n = wins.length;
  if (!n) return;
  const r = (w: { seed: number }) => rnd(w.seed, 20);
  const lit = wins.filter((w) => r(w) > 0.72);
  const lo = Math.max(1, Math.ceil(n * 0.2));
  const hi = Math.max(lo, Math.floor(n * 0.4));
  if (lit.length < lo) {
    const cands = wins.filter((w) => r(w) >= 0.14 && r(w) < 0.66).sort((a, b) => r(b) - r(a));
    for (const w of cands.slice(0, lo - lit.length)) w.force = 'lit';
  } else if (lit.length > hi) {
    for (const w of lit.sort((a, b) => r(a) - r(b)).slice(0, lit.length - hi)) w.force = 'dark';
  }
}

/** 창 상태 (씨앗과 몫으로): 꺼짐, 켜짐, TV, 판자, 깨짐 */
type WinState = 'dark' | 'lit' | 'tv' | 'boarded' | 'broken';
function winState(w: Win): WinState {
  const r = w.force === 'lit' ? 0.8 : w.force === 'dark' ? 0.4 : rnd(w.seed, 20);
  return r < 0.07 ? 'boarded' : r < 0.11 ? 'broken' : r >= 0.66 && r <= 0.72 ? 'tv' : r > 0.72 ? 'lit' : 'dark';
}

/** 정면을 그리는 동안 쓰는 것 모음 */
interface Ctx {
  f: Facade;
  g: CanvasRenderingContext2D;
  e: CanvasRenderingContext2D;
  b: FrontBuildingPlace;
  v: Voice;
  S: number;
  T: (v: number) => number;
  yOf: (h: number) => number;
  tw: number;
  th: number;
  /** 빛 지도 */
  L: Float32Array;
}
const seenAt = (c: Ctx, x: number, y: number): number => seenOf(c.L[Math.max(0, Math.min(c.th - 1, Math.round(y))) * c.tw + Math.max(0, Math.min(c.tw - 1, Math.round(x)))]);

/** 벽 바탕 한 칸 (재질 목소리, 디테일 정도 seen) */
function wallPixel(v: Voice, x: number, y: number, seen: number, seed: number): string {
  if (v.bond === 'brick') {
    const course = y >> 2;
    const off = course & 1 ? 4 : 0;
    const col = (x + off) >> 3;
    const bx = (x + off) & 7;
    const by = y & 3;
    const r = rnd(seed + course * 31, col);
    // 벽돌마다 디테일을 켤지: 빛이 셀수록 많이 (경계가 벽돌 단위로 흩어져 선이 생기지 않게)
    const on = rnd(seed + course * 17, col + 500) < seen * 1.15;
    if (!on) {
      // 어둠 속: 두 줄에 한 번 가로 줄눈만 아주 옅게
      return by === 3 && course % 2 === 0 && seen > 0.02 ? v.dark : v.base;
    }
    if (bx === 7 || by === 3) return v.joint;
    return r < 0.6 ? v.base : r < 0.8 ? v.dark : r < 0.95 ? v.light : C.smog2;
  }
  if (v.bond === 'ashlar') {
    // 큰 돌 (16×8, 줄마다 반 칸 어긋남), 돌마다 결이 조금 다르고 빛 닿은 곳만 줄눈
    const course = Math.floor(y / 8);
    const off = course & 1 ? 8 : 0;
    const col = Math.floor((x + off) / 16);
    const joint = (x + off) % 16 === 15 || y % 8 === 7;
    const r = rnd(seed + course * 13, col);
    if (joint && seen > 0.3) return seen > 0.75 ? v.joint : v.dark;
    return r < 0.7 ? v.base : r < 0.88 ? v.light : v.dark;
  }
  if (v.bond === 'brown') {
    // 갈색 사암: 6칸마다 가는 가로 줄눈, 24칸 어긋난 세로 줄눈, 돌마다 조금 다른 색
    const course = Math.floor(y / 6);
    const off = course & 1 ? 12 : 0;
    const col = Math.floor((x + off) / 24);
    const r = rnd(seed + course * 7, col);
    if (y % 6 === 5 && seen > 0.08) return v.joint;
    if ((x + off) % 24 === 23 && seen > 0.35) return v.dark;
    return r < 0.75 ? v.base : r < 0.9 ? v.light : v.dark;
  }
  // 칠한 벽: 넓은 면 단색, 12칸마다 옅은 가로 줄 (빛 닿은 곳만), 벗겨진 곳은 벽돌
  if (v.under && seen > 0.3) {
    // 칠이 벗겨진 곳: 벽돌 단위로 떨어져 나가 가장자리가 계단처럼 (빛 닿은 곳만 보인다)
    const course = y >> 2;
    const col = (x + (course & 1 ? 4 : 0)) >> 3;
    const n = wobbleAt(col * 0.45 + seed * 0.01, course * 0.32);
    if (n > 0.72) {
      const bx = (x + (course & 1 ? 4 : 0)) & 7;
      return bx === 7 || (y & 3) === 3 ? '#2e1f1e' : rnd(seed + course, col) < 0.5 ? v.under : C.brickRedDark;
    }
  }
  if (y % 12 === 11 && seen > 0.3) return v.dark;
  return v.base;
}

/** 부드러운 값 잡음 (0~1): 칠 벗겨짐·얼룩 모양 */
function wobbleAt(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const tx = x - ix;
  const ty = y - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const h = (a: number, b: number) => hash(a * 7919 + b * 104729 + 17);
  const a = h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx;
  const c = h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx;
  return a * (1 - sy) + c * sy;
}

/** 벽 위의 한 단계 어두운 면 (그늘·얼룩): 칸을 어두운 쪽으로 (사각형 안, mask가 참인 칸만) */
function darken(c: Ctx, x: number, y: number, w: number, h: number, color: string, mask: (px: number, py: number) => boolean = () => true): void {
  x = Math.round(x);
  y = Math.round(y);
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(c.tw, x + Math.round(w));
  const y1 = Math.min(c.th, y + Math.round(h));
  if (x1 <= x0 || y1 <= y0) return;
  paint(c.g, x0, y0, x1 - x0, y1 - y0, (px, py) => (mask(px, py) ? color : null));
}

/**
 * 창 하나: 들어간 창 자리(빛 반대쪽 옆 그늘), 윗장식(돌 상인방·벽돌 아치·세운 벽돌·삼각 머리), 튀어나온 창턱(빛 받는 윗면, 앞면,
 * 벽에 드리운 2칸 그늘), 유리 (꺼짐: 하늘빛이 위 칸에만 비침 / 켜짐: 갓 씌운 등 빛 웅덩이와 커튼·블라인드·사람 / TV / 판자 / 깨짐)
 */
function paintWin(c: Ctx, w: Win, st: WinState): void {
  const { g, e, v } = c;
  const { x, y } = w;
  const ww = w.w;
  const hh = w.h;
  const seen = seenAt(c, x + ww / 2, y + hh / 2);
  const lit = seen > 0.25;
  // 창턱 아래 벽에 드리운 그늘 (2칸 면)
  darken(c, x - 1, y + hh + 2, ww + 3, 2, v.dark);
  // 창턱: 윗면(빛 닿으면 밝게) + 앞면
  rect(g, x - 2, y + hh, ww + 4, 2, v.trim);
  rect(g, x - 2, y + hh, ww + 4, 1, lit ? v.trimLit : v.trim);
  // 윗장식
  if (v.win.head === 'flat') {
    rect(g, x - 2, y - 3, ww + 4, 3, v.trim);
    if (lit) rect(g, x - 2, y - 3, ww + 4, 1, v.trimLit);
  } else if (v.win.head === 'soldier') {
    // 세운 벽돌 한 줄 (벽돌 2칸마다 색이 다르다)
    for (let k = 0; k < ww + 2; k += 2) rect(g, x - 1 + k, y - 4, 2, 4, rnd(w.seed, 60 + k) < 0.5 ? v.trim : v.trimDark);
    if (lit) rect(g, x - 1, y - 4, ww + 2, 1, v.trimLit);
  } else if (v.win.head === 'pediment') {
    // 삼각 머리 돌: 위로 뾰족, 빛 닿으면 윗변이 밝다 (계단은 2-2-2)
    const half = Math.ceil((ww + 6) / 2);
    for (let k = 0; k < 4; k++) rect(g, x - 3 + k * 2, y - 5 - k, ww + 6 - k * 4, 1, k === 3 || !lit ? v.trim : v.trimLit);
    rect(g, x - 3, y - 4, ww + 6, 4, v.trim);
    if (lit) for (let k = 0; k < 4; k++) rect(g, x - 3 + k * 2, y - 5 - k, 2, 1, v.trimLit);
    void half;
  } else {
    // 벽돌 아치 (낮은 활 모양): 위가 둥근 세운 벽돌 띠
    const r = (ww + 4) / 2;
    for (let k = 0; k < ww + 4; k++) {
      const dx = k + 0.5 - r;
      const rise = Math.round(3 * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2)));
      const col = (k >> 1) & 1 ? v.trim : v.trimDark;
      rect(g, x - 2 + k, y - 4 - rise, 1, 4 + rise, col);
      if (lit) rect(g, x - 2 + k, y - 4 - rise, 1, 1, v.trimLit);
    }
  }
  // 창 자리 (들어간 면): 빛 반대쪽 옆 1칸은 그늘
  rect(g, x, y, ww, hh, C.windowDark);
  if (st === 'boarded') {
    // 판자로 막힘: 길이·색이 제각각인 널빤지와 못 자국
    for (let py = y + 1, k = 0; py < y + hh - 1; py += 5, k++) {
      const col = rnd(w.seed, 70 + k) < 0.5 ? C.awning : C.awningStripe;
      rect(g, x - 1, py, ww + 2, 4, col);
      if (lit) rect(g, x - 1, py, ww + 2, 1, '#6b6152');
    }
    rect(g, x + 1, y + 2, 1, hh - 4, C.awning);
    return;
  }
  if (st === 'broken') {
    for (let k = 0; k < ww; k += 2) rect(g, x + k, y, 1, 1 + Math.floor(rnd(w.seed, 30 + k) * 6), C.chromeDark);
    rect(g, x + Math.floor(ww / 2) - 1, y, 2, hh, v.win.sash);
    return;
  }
  const mid = y + Math.floor(hh * 0.48);
  if (st === 'tv') {
    // TV만 켜진 어두운 방 (푸르스름한 빛이 깜빡인다: 발광은 따로 그리는 판이 맡는다)
    c.f.tvs.push({ x, y, w: ww, h: hh });
    roomWall(g, e, x, y, ww, hh, [[x + ww * 0.35, y + hh - 6, ww * 0.9, hh * 0.7, 0.55]], 0.05, TV, 4);
  } else if (st === 'lit') {
    const warm = rnd(w.seed, 22) < 0.72;
    const ramp = warm ? WARM : FLUO;
    const kind = rnd(w.seed, 23);
    // 방 안 등: 갓 씌운 스탠드(아래로) 또는 천장 맨 전구(둥글게). 사람·가구는 벽에 그림자를 드리운다
    const lx = x + ww * (0.25 + rnd(w.seed, 24) * 0.5);
    const shade = kind >= 0.35;
    const person = rnd(w.seed, 26) < 0.45;
    const px = x + Math.floor(ww / 2) + (rnd(w.seed, 27) < 0.5 ? -2 : 2);
    const blocks: Array<readonly [number, number, number, number, number]> = person ? [[px - 3, y + hh - 24, px + 3, y + hh, 0.55]] : [];
    roomWall(g, e, x, y, ww, hh, [shade ? [lx, y + hh * 0.42, ww * 0.55, hh * 0.6, 1.0, 1] : [lx, y + 4, ww * 0.9, hh * 0.85, 0.95]], 0.22, ramp, 4, blocks);
    c.f.lit.push({ x: x + ww / 2, y: y + hh / 2, warm });
    if (shade) {
      // 스탠드 갓 (빛을 위아래로 자르는 어두운 사다리꼴)과 그 밑 하얀 전구
      rect(g, Math.round(lx) - 3, Math.round(y + hh * 0.42) - 4, 6, 3, warm ? '#5e3622' : '#24342f');
      rect(e, Math.round(lx) - 3, Math.round(y + hh * 0.42) - 4, 6, 3, '#000');
      rect(g, Math.round(lx) - 1, Math.round(y + hh * 0.42) - 1, 2, 1, warm ? '#ffe2a8' : '#e8fff8');
      rect(e, Math.round(lx) - 1, Math.round(y + hh * 0.42) - 1, 2, 1, warm ? '#fff4d8' : '#c8f6ff');
    }
    if (person) figure(g, e, px, y + hh, 26, rnd(w.seed, 28) < 0.5 ? 'bare' : 'hat', C.iron);
    if (kind < 0.2) {
      // 커튼: 양옆으로 젖힌 천 (빛을 받은 천은 한 단계 밝은 주름)
      for (const side of [0, 1]) {
        const cw = 3 + Math.floor(rnd(w.seed, 24 + side) * 2);
        const cx = side ? x + ww - cw : x;
        rect(g, cx, y, cw, hh, warm ? C.posterRedDark : '#24342f');
        rect(e, cx, y, cw, hh, '#120406');
        rect(g, side ? cx : cx + cw - 1, y + 2, 1, hh - 2, warm ? C.posterRed : '#2f4a40');
      }
    } else if (kind < 0.35) {
      // 반쯤 내린 블라인드 (살 사이로 빛)
      const down = 6 + Math.floor(rnd(w.seed, 28) * (hh * 0.5));
      for (let yy = y; yy < y + down; yy += 2) {
        rect(g, x, yy, ww, 1, warm ? C.paintOchre : C.chromeDark);
        rect(e, x, yy, ww, 1, warm ? '#3a2410' : '#1d2422');
      }
    }
  } else {
    // 꺼진 창: 어두운 유리, 위 칸에만 하늘빛이 비스듬히 비친 띠 (빛 닿는 창만 조금 더)
    const d = Math.floor(rnd(w.seed, 40) * 5);
    for (let k = 0; k < mid - y; k++) {
      const sx = x + d + k - 2;
      const len = lit ? 3 : 2;
      for (let j = 0; j < len; j++) if (sx + j >= x && sx + j < x + ww) rect(g, sx + j, y + k, 1, 1, C.glassEdge);
    }
    if (rnd(w.seed, 41) < 0.3) {
      // 창가 화분 (작은 잎 덩어리)
      rect(g, x + 2, y + hh - 3, 5, 3, C.awning);
      rect(g, x + 1, y + hh - 6, 7, 3, '#22362c');
      rect(g, x + 2, y + hh - 7, 4, 1, '#2f4a3a');
    }
  }
  // 창에 끼운 냉방기 (상자는 buildings.ts가 놓는다): 그 밑 창턱과 벽에 흘러내린 녹물 줄
  if ((st === 'dark' || st === 'lit') && w.fl >= 1 && rnd(w.seed, 95) < 0.16) {
    c.f.acs.push({ x: x + ww / 2, y: y + hh, w: ww + 2 });
    const sx = x + 2 + Math.floor(rnd(w.seed, 96) * (ww - 4));
    const len = 10 + Math.floor(rnd(w.seed, 97) * 18);
    rect(g, sx, y + hh + 2, 1, len, C.rust);
    rect(g, sx, y + hh + 2, 1, Math.floor(len / 2), '#78452a');
  }
  // 창틀: 가운데 만나는 살과 세로 살 (위·아래 창 두 짝), 빛 반대쪽 안 그늘 1칸
  rect(g, x, mid, ww, 2, v.win.sash);
  rect(e, x, mid, ww, 2, '#000000');
  if (ww >= 14) {
    rect(g, x + Math.floor(ww / 2), y, 1, hh, v.win.sash);
    rect(e, x + Math.floor(ww / 2), y, 1, hh, '#000000');
  }
  rect(g, x, y, ww, 1, v.win.sash);
  rect(e, x, y, ww, 1, '#000000');
}

/** 포스터 자리: 글씨가 화면 가장자리에서 잘리지 않게 구간 가운데 쪽 벽에 붙인다 */
function posterX(b: FrontBuildingPlace, tw: number, pw: number, T: (v: number) => number): number {
  const sec = D.sections.find((s) => s.id === b.section)!;
  if (b.posterLeft) return T(8);
  return b.x + b.w / 2 < (sec.x0 + sec.x1) / 2 ? tw - pw - T(8) : T(8);
}

/** 포스터 크기 (구호마다 다른 판) */
const POSTER_SIZE: Record<string, [number, number]> = { OBEY: [34, 48], WORK: [42, 40], UNITY: [46, 36], ORDER: [32, 50] };
const posterSize = (text: string): [number, number] => POSTER_SIZE[text] ?? [Math.max(34, wordWidth(text, 5) + 12), 44];

/**
 * 선전 포스터: 구호마다 다른 도안 (빛살 별·톱니바퀴·사람 셋·흰 띠), 글자는 5×7 획 글꼴 (키우지 않는다).
 * 밑에 깔린 옛 포스터, 찢겨 벗겨진 귀퉁이, 위에서 번진 빗물 얼룩, 빛이 닿지 않으면 글자·도안이 어둠에 묻힌다.
 */
export function poster(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, seed: number, seen = 1): boolean {
  // 빛이 닿지 않는 포스터는 종이와 큰 도안만 (글자는 어둠에 묻힌다: 디테일은 빛 닿은 면에만)
  const dim = seen < 0.22;
  // 밑에 깔린 옛 포스터 (누렇게 바랜 종이)가 한쪽으로 삐져나와 있다
  const ox = rnd(seed, 2) < 0.5 ? 3 : -3;
  rect(g, x + ox, y + 4, w, h - 2, dim ? '#4b443a' : C.paintCream);
  if (!dim) ditherRect(g, x + ox, y + 4, w, h - 2, C.paintOchre, 6);
  let paper: string;
  let ink: string;
  let accent: string;
  if (text === 'WORK') {
    paper = dim ? '#5a5145' : C.paintCream;
    ink = C.posterRed;
    accent = C.posterRedDark;
  } else if (text === 'UNITY') {
    paper = '#364a60';
    ink = C.paintCream;
    accent = '#28384a';
  } else if (text === 'ORDER') {
    paper = '#1d1f26';
    ink = C.paintCream;
    accent = C.posterRed;
  } else {
    paper = C.posterRed;
    ink = C.paintCream;
    accent = C.posterRedDark;
  }
  rect(g, x, y, w, h, paper);
  const tx = (tw: number) => x + Math.floor((w - tw) / 2);
  const tw = wordWidth(text, 5);
  if (text === 'WORK') {
    // 붉은 사선 띠와 톱니바퀴, 아래 구호
    for (let k = 0; k < w; k++) rect(g, x + k, y + Math.round(h * 0.55 - k * 0.5), 1, 5, accent);
    const cx = x + Math.floor(w / 2);
    const cy = y + 13;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      rect(g, Math.round(cx + Math.cos(ang) * 7) - 1, Math.round(cy + Math.sin(ang) * 7) - 1, 2, 2, ink);
    }
    disc(g, cx, cy, 5, ink);
    disc(g, cx, cy, 2, paper);
    if (!dim) paintWord(g, text, tx(tw), y + h - 11, 5, 7, ink);
  } else if (text === 'UNITY') {
    // 어깨를 맞댄 사람 셋 (실루엣), 아래 흰 띠에 구호
    for (const [k, hh] of [[-10, 18], [0, 21], [10, 18]] as const) {
      const cx = x + Math.floor(w / 2) + k;
      rect(g, cx - 3, y + 26 - hh + 6, 7, hh - 6, accent);
      disc(g, cx, y + 26 - hh + 2, 3, accent);
    }
    rect(g, x, y + h - 11, w, 9, ink);
    if (!dim) paintWord(g, text, tx(tw), y + h - 10, 5, 7, paper);
  } else if (text === 'ORDER') {
    // 검은 판, 붉은 테, 가운데 흰 띠와 구호, 위에 눈 없는 방패
    rect(g, x, y, w, 2, accent);
    rect(g, x, y + h - 2, w, 2, accent);
    const cx = x + Math.floor(w / 2);
    for (let k = 0; k < 12; k++) rect(g, cx - 7 + Math.floor(k / 2), y + 8 + k, 14 - Math.floor(k / 2) * 2, 1, '#3a3e49');
    rect(g, x + 2, y + h - 18, w - 4, 10, ink);
    if (!dim) paintWord(g, text, tx(tw), y + h - 17, 5, 7, paper);
  } else {
    // 빛살 별: 가운데 별에서 퍼지는 빛살 (짙은 붉은 띠), 아래 구호
    const cx = x + Math.floor(w / 2);
    const cy = y + 16;
    for (let a = 0; a < 12; a += 2) {
      const ang = (a / 12) * Math.PI * 2 + 0.26;
      line(g, cx, cy, Math.round(cx + Math.cos(ang) * 20), Math.round(cy + Math.sin(ang) * 20), accent);
    }
    starShape(g, cx, cy, 5, C.paintOchre);
    rect(g, x, y + h - 14, w, 12, accent);
    if (!dim) paintWord(g, text, tx(tw), y + h - 12, 5, 7, ink);
  }
  // 찢긴 귀퉁이 (아래 한쪽이 벗겨져 옛 포스터와 벽이 보인다)
  const tear = 5 + Math.floor(rnd(seed, 1) * 7);
  const right = rnd(seed, 3) < 0.6;
  for (let k = 0; k < tear; k++) {
    const len = tear - k + Math.floor(rnd(seed, 10 + k) * 2);
    rect(g, right ? x + w - len : x, y + h - tear + k, len, 1, k % 3 ? C.paintCream : C.paintOchre);
  }
  // 위쪽 귀퉁이가 젖어 처졌다 (한 칸 접힘)
  if (rnd(seed, 4) < 0.5) rect(g, x, y, 3, 2, C.paintOchre);
  // 빗물에 젖어 번진 얼룩 (위에서 아래로 흐른 자국 몇 줄)
  for (let k = 0; k < 3; k++) {
    const sx = x + 2 + Math.floor(rnd(seed, 20 + k) * (w - 4));
    const len = 6 + Math.floor(rnd(seed, 23 + k) * (h * 0.5));
    rect(g, sx, y, 1, len, accent);
  }
  return !dim;
}

/** 바랜 페인트 광고 (벽돌에 직접 칠한 옛 광고, 반쯤 지워짐): 획 글꼴을 크게 (2칸 굵기), 벗겨진 곳은 덩어리째 */
function ghostSign(c: Ctx, x: number, y: number, text: string, seed: number): void {
  const m = wordMask(text, 13, 19, 2, 3);
  const box = grow(m, 2, true);
  // 바탕 띠 (옛 칠)와 글자, 둘 다 덩어리로 벗겨진다
  paint(c.g, x - 2, y - 2, box.w, box.h, (px, py) => {
    const n = wobbleAt((px + seed) * 0.12, py * 0.15);
    if (n < 0.34) return null;
    const i = (py - y + 2) * box.w + (px - x + 2);
    if (!box.m[i]) return null;
    const inLetter = py - y >= 0 && px - x >= 0 && py - y < m.h && px - x < m.w && m.m[(py - y) * m.w + (px - x)];
    return inLetter ? (n > 0.5 ? '#6b6152' : '#5a5145') : null;
  });
}

/**
 * 길가 건물 정면. 텍스처 칸 좌표: 위(지붕)가 0, 아래(땅)가 th.
 * 1층(가게·로비·현관), 위층 창, 포스터, 바랜 광고, 낡음. 빛 지도를 먼저 재서 빛 닿는 곳에만 디테일을 그린다.
 */
export function paintFacade(b: FrontBuildingPlace, o: FacadeOpts): Facade {
  const S = o.s;
  const T = (v: number) => Math.round(v * S);
  const tw = T(b.w);
  const th = T(b.h);
  const [map, g] = canvas(tw, th);
  const [glow, e] = canvas(tw, th);
  e.fillStyle = '#000';
  e.fillRect(0, 0, tw, th);
  const f: Facade = { map, glow, tw, th, tvs: [], lit: [], acs: [] };
  const yOf = (hAbove: number) => th - T(hAbove);
  const v = voiceOf(b);
  // 1) 창 계획 (켜진 창이 둘레 벽을 비추므로 빛 지도보다 먼저)
  const wins: Win[] = [];
  let posterRect: [number, number, number, number] | null = null;
  if (b.kind !== 'theater') {
    const [pw, ph] = b.poster && b.floors >= 3 ? posterSize(b.poster) : [0, 0];
    if (pw) {
      const px = posterX(b, tw, pw, T);
      posterRect = [px, yOf(SHOP_H + FLOOR_H) + T(20), pw + 4, ph + 4];
    }
    const W = v.win;
    const unit = W.group * W.w + (W.group - 1) * 3;
    const cols = Math.max(1, Math.floor((tw - 14 + (W.gap - unit)) / W.gap));
    const left = Math.floor((tw - (cols - 1) * W.gap - unit) / 2);
    for (let fl = 1; fl < b.floors; fl++) {
      // 맨 위층은 창이 조금 낮다 (처마 밑)
      const top = fl === b.floors - 1 ? 26 : 20;
      const hh = T(W.h - (fl === b.floors - 1 ? 6 : 0));
      const y = yOf(SHOP_H + fl * FLOOR_H) + T(top);
      for (let k = 0; k < cols; k++) {
        for (let j = 0; j < W.group; j++) {
          const x = left + k * W.gap + j * (W.w + 3);
          const ww = T(W.w);
          if (posterRect && x + ww + 3 > posterRect[0] && x - 3 < posterRect[0] + posterRect[2] && y + hh + 3 > posterRect[1] && y - 3 < posterRect[1] + posterRect[3]) continue;
          wins.push({ x, y, w: ww, h: hh, fl, seed: b.seed * 13 + fl * 101 + (k * 3 + j) * 7 });
        }
      }
    }
    litQuota(wins);
  }
  const states = wins.map(winState);
  const extra: StaticLight[] = [];
  wins.forEach((w, i) => {
    if (states[i] === 'lit') extra.push({ x: b.x + (w.x + w.w / 2) / S, y: (th - w.y - w.h / 2) / S, z: FRONT_Z_SIGN + 8, range: 44, power: 0.35, down: false });
  });
  const L = lightMap(b, S, tw, th, extra);
  const c: Ctx = { f, g, e, b, v, S, T, yOf, tw, th, L };
  // 2) 벽 바탕 (빛 닿는 곳만 결)
  paint(g, 0, 0, tw, th, (x, y) => wallPixel(v, x, y, seenOf(L[y * tw + x]), b.seed));
  // 3) 처마 밑 그을음 띠 (아래 끝이 흘러내린 자국으로 들쭉날쭉)
  for (let x = 0; x < tw; x++) {
    const drip = 3 + Math.floor(wobbleAt(x * 0.3 + b.seed, 1) * 7) + (rnd(b.seed, 2000 + x) < 0.08 ? 6 : 0);
    rect(g, x, 0, 1, drip, v.dark);
  }
  // 4) 층 띠 (호텔: 층마다 돌 띠 — 빛 받는 윗면, 앞면, 벽에 드리운 2칸 그늘)
  if (v.belts) for (let fl = 1; fl < b.floors; fl++) {
    const y = yOf(SHOP_H + (fl - 1) * FLOOR_H) - 4;
    darken(c, 0, y + 4, tw, 2, v.dark);
    rect(g, 0, y, tw, 4, v.trim);
    for (let x = 0; x < tw; x++) if (seenAt(c, x, y) > 0.3) rect(g, x, y, 1, 1, v.trimLit);
  }
  // 5) 모서리: 바깥에 드러난 끝(구간 끝)은 돌 귀돌 (길고 짧은 돌이 번갈아), 빛이 오는 쪽만 1칸 밝은 테두리
  const exposed = blockEnds(b);
  for (const side of [0, 1] as const) {
    if (!exposed[side]) continue;
    for (let y = 8, k = 0; y < (b.kind === 'theater' ? th : yOf(SHOP_H)); y += 9, k++) {
      const long = k % 2 === 0;
      const qw = long ? 11 : 7;
      const qx = side === 0 ? 0 : tw - qw;
      // 귀돌은 벽과 다른 밝은 돌 (형태는 명도 차로): 빛 닿으면 윗면 한 줄 더 밝게
      rect(g, qx, y, qw, 8, QUOIN);
      rect(g, qx, y + 7, qw, 1, v.dark);
      if (seenAt(c, qx + qw / 2, y + 4) > 0.2) rect(g, qx, y, qw, 1, v.trimLit);
      // 빛이 바깥쪽에서 오면 바깥 모서리에 림 라이트
      const outX = side === 0 ? b.x - 40 : b.x + b.w + 40;
      if (staticLightAt(outX, (th - y) / S, FRONT_Z_SIGN) > 0.12) rect(g, side === 0 ? 0 : tw - 1, y, 1, 8, v.trimLit);
    }
  }
  // 6) 위층 창
  wins.forEach((w, i) => paintWin(c, w, states[i]));
  // 7) 1층: 극장, 다이너, 아파트 현관, 가게
  const shop = yOf(SHOP_H);
  if (b.kind === 'theater') paintTheater(c);
  else {
    if (b.kind === 'diner') paintDiner(c);
    else if (b.kind === 'apartment' && !b.sign) paintEntrance(c);
    else paintShop(c);
    // 1층과 위층 사이 돌 띠 (빛 받는 윗면, 앞면, 아래 벽에 드리운 그늘)
    darken(c, 0, shop + 1, tw, 2, v.dark);
    rect(g, 0, shop - 2, tw, 3, v.trim);
    for (let x = 0; x < tw; x++) if (seenAt(c, x, shop - 2) > 0.3) rect(g, x, shop - 2, 1, 1, v.trimLit);
  }
  // 8) 선전 포스터 (2층 높이, 찢김)
  if (b.poster && b.floors >= 3 && b.kind !== 'theater' && posterRect) {
    const [pw, ph] = posterSize(b.poster);
    const px = posterRect[0];
    const py = yOf(SHOP_H + FLOOR_H) + T(22);
    const lettered = poster(g, px, py, pw, ph, b.poster, b.seed, seenAt(c, px + pw / 2, py + ph - 10));
    // 글자 자리 (월드): 정면 그림은 배율 S로 그렸다. 구호는 포스터 아래쪽 5×7 글씨 (빛이 닿아 글자를 그렸을 때만)
    const tw2 = wordWidth(b.poster, 5);
    const ty = py + ph - 12;
    if (lettered) registerSign(b.poster, '선전 포스터', b.x + (px + (pw - tw2) / 2) / S, b.x + (px + (pw + tw2) / 2) / S, (th - ty - 9) / S, (th - ty) / S, FRONT_Z_SIGN, tw2 / S, pw / S);
  }
  // 9) 바랜 옛 광고 (빵집 꼭대기 층)
  if (b.sign === 'BAKERY') ghostSign(c, T(16), T(16), 'BREAD', b.seed);
  // 10) 낡음: 창턱 아래 빗물 줄, 그을린 창 위 그을음, 땅 가까운 소금기 (빛 닿는 곳만)
  weatherFacade(c, wins, states);
  return f;
}

/** 이 건물의 양 끝이 바깥(구간 끝)에 드러났는가 [왼쪽, 오른쪽]. 골목 쪽은 골목 안쪽 벽이 받쳐 준다 */
export function blockEnds(b: FrontBuildingPlace): [boolean, boolean] {
  const sec = D.front[b.section as 'theater' | 'apartments'];
  const first = Math.abs(b.x - sec.x0) < 1;
  let end = sec.x0;
  for (const it of sec.list) end += it.w;
  return [first, Math.abs(b.x + b.w - end) < 1];
}

/** 낡음 (빛 닿는 곳만): 창턱 아래 빗물 줄 (끊기지 않는 1~2칸 줄, 끝이 가늘게), 창 위 그을음 불꽃 자국, 땅 가까운 소금기 */
function weatherFacade(c: Ctx, wins: readonly Win[], states: readonly WinState[]): void {
  const { g, v, b, tw, th } = c;
  wins.forEach((w, i) => {
    const s = seenAt(c, w.x + w.w / 2, w.y + w.h + 6);
    if (s > 0.15) {
      for (let k = 0; k < 2; k++) {
        if (rnd(w.seed, 80 + k) < 0.35) continue;
        const sx = w.x + 1 + Math.floor(rnd(w.seed, 82 + k) * (w.w - 2));
        const len = 8 + Math.floor(rnd(w.seed, 84 + k) * 26 * s);
        const wide = rnd(w.seed, 86 + k) < 0.4 ? Math.floor(len * 0.4) : 0;
        rect(g, sx, w.y + w.h + 4, 1, len, v.dark);
        if (wide) rect(g, sx + 1, w.y + w.h + 4, 1, wide, v.dark);
      }
    }
    // 판자 친 창이나 깨진 창 위는 옛 불길에 그을렸다 (위로 좁아지는 어두운 혀)
    if ((states[i] === 'boarded' || states[i] === 'broken') && rnd(w.seed, 90) < 0.8) {
      for (let k = 0; k < 14; k++) {
        const half = Math.max(0, Math.round((w.w / 2 + 2) * (1 - k / 14) + (wobbleAt(k * 0.5 + w.seed, 3) - 0.5) * 3));
        if (half <= 0) continue;
        rect(g, w.x + Math.floor(w.w / 2) - half, w.y - 5 - k, half * 2, 1, k < 6 ? C.smog1 : v.dark);
      }
    }
  });
  // 땅 가까운 소금기: 밝게 번진 얼룩 (빛 닿는 곳만, 덩어리 모양)
  const y0 = th - 16;
  paint(g, 0, y0, tw, 14, (x, y) => {
    const n = wobbleAt((x + b.seed) * 0.15, y * 0.25);
    if (n < 0.62 || seenAt(c, x, y) < 0.35) return null;
    return v.light;
  });
}

/** 가게 1층: 나무 간판 띠(빛 받는 윗 쇠시리, 판, 아래 그늘), 진열창 틀(유리는 따로 그리는 판), 문(68), 문 위 채광창, 차양 그늘 */
function paintShop(c: Ctx): void {
  const { g, e, b, T, yOf, tw } = c;
  const shopTop = yOf(SHOP_H);
  const band = yOf(78);
  // 간판 띠 (나무판): 위 쇠시리는 빛을 받고, 판에는 나뭇결 몇 줄
  rect(g, 2, shopTop + 2, tw - 4, band - shopTop - 2, C.awning);
  rect(g, 2, shopTop + 2, tw - 4, 2, C.awningStripe);
  for (let k = 0; k < 3; k++) {
    const y = shopTop + 6 + Math.floor(rnd(b.seed, 1100 + k) * Math.max(1, band - shopTop - 10));
    rect(g, 4 + Math.floor(rnd(b.seed, 1110 + k) * 20), y, Math.floor(tw * 0.5), 1, '#3e3830');
  }
  // 진열창 자리 (유리 판이 덮는다): 안쪽 어둠
  const doorX = T(doorOf(b) - b.x);
  rect(g, T(6), yOf(70), doorX - T(10), T(66), C.iron);
  rect(g, T(8), yOf(68), doorX - T(14), T(62), C.windowDark);
  // 진열창 아래 판벽 (빛 받는 윗턱)
  rect(g, T(6), yOf(8), doorX - T(10), T(8), C.awning);
  rect(g, T(6), yOf(8), doorX - T(10), 1, C.awningStripe);
  // 문: 쇠틀, 위 유리, 발차기 판, 손잡이, 문 위 채광창
  const dw = T(DOOR_W);
  const dh = T(DOOR_H);
  const dy = yOf(DOOR_H);
  rect(g, doorX - 1, dy - 6, dw + 2, dh + 6, C.iron);
  rect(g, doorX + 2, dy - 4, dw - 4, 3, C.windowLit);
  rect(e, doorX + 2, dy - 4, dw - 4, 3, C.windowLit);
  rect(g, doorX + 2, dy + 3, dw - 4, Math.floor(dh * 0.45), C.windowDark);
  roomWall(g, e, doorX + 2, dy + 3, dw - 4, Math.floor(dh * 0.45), [[doorX + dw / 2, dy + 5, dw * 0.5, dh * 0.4, 0.75, 1]], 0.18, WARM, 3);
  rect(g, doorX + 2, dy + dh - 14, dw - 4, 10, C.chromeDark);
  rect(g, doorX + dw - 6, dy + Math.floor(dh * 0.55), 2, 4, C.chrome);
  // 문턱
  rect(g, doorX - 3, yOf(2), dw + 6, T(2), C.stone);
  // 차양이 벽에 드리운 그늘 (차양 바로 밑 벽, 유리 판 둘레)
  awningShade(c, 0, tw);
}

/** 차양 밑 벽에 드리운 그늘 면 (차양 높이 바로 아래 6칸, 아래 끝은 디더 없이 들쭉날쭉) */
function awningShade(c: Ctx, x0: number, x1: number): void {
  const y = c.yOf(D.ledges.awning) + 1;
  for (let x = x0; x < x1; x++) {
    const d = 5 + (rnd(c.b.seed, 1200 + x) < 0.3 ? 1 : 0);
    darken(c, x, y, 1, d, C.iron);
  }
}

/** 현관 문 자리 (건물 왼쪽 끝에서, 월드 px): 비상계단 앞까지의 가운데 */
export function entranceX(b: FrontBuildingPlace): number {
  const esc = escapeOf(b);
  const end = esc ? esc.x0 - 8 - b.x : b.w;
  return Math.floor(end / 2) - 14;
}

/**
 * 아파트 현관 (가게 없는 1층): 돌 상인방, 두 짝 나무 문(위 유리로 복도 불빛), 문 위 채광창, 번지 판,
 * 1층 창 둘과 반지하 창. 현관 계단(돌계단 세 단)은 정면 앞에 상자로 놓는다.
 */
function paintEntrance(c: Ctx): void {
  const { f, g, e, b, T, yOf, v } = c;
  const dx = T(entranceX(b));
  // 상인방과 채광창 (복도 불빛: 부채꼴 살)
  rect(g, dx - T(5), yOf(94), T(38), T(8), v.trim);
  rect(g, dx - T(5), yOf(94), T(38), 1, v.trimLit);
  darken(c, dx - T(4), yOf(86) + 1, T(36), 2, v.dark);
  rect(g, dx, yOf(86), T(28), T(4), C.windowLit);
  rect(e, dx, yOf(86), T(28), T(4), C.windowLit);
  for (let k = 1; k < 4; k++) {
    rect(g, dx + T(k * 7), yOf(86), 1, T(4), C.iron);
    rect(e, dx + T(k * 7), yOf(86), 1, T(4), '#000');
  }
  // 문틀과 두 짝 문 (위 유리, 아래 판): 문짝마다 빛 받는 왼쪽 테
  rect(g, dx, yOf(82), T(28), T(70), C.iron);
  for (const lx of [2, 15]) {
    rect(g, dx + T(lx), yOf(80), T(11), T(66), '#3e2a1f');
    rect(g, dx + T(lx), yOf(80), 1, T(66), '#5e3622');
    rect(g, dx + T(lx + 2), yOf(76), T(7), T(22), C.windowDark);
    roomWall(g, e, dx + T(lx + 2), yOf(76), T(7), T(22), [[dx + T(lx + 5.5), yOf(76) + 2, T(6), T(20), 0.7, 1]], 0.16, WARM, 2);
    rect(g, dx + T(lx + 2), yOf(44), T(7), T(16), '#4e3527');
    rect(g, dx + T(lx + 2), yOf(44), T(7), 1, '#614231');
  }
  rect(g, dx + T(12), yOf(46), 1, T(4), C.chrome);
  rect(g, dx + T(16), yOf(46), 1, T(4), C.chrome);
  // 번지 판 (작은 놋쇠 판)
  rect(g, dx + T(30), yOf(70), T(8), T(6), C.chromeDark);
  rect(g, dx + T(31), yOf(69), T(6), T(4), C.paintOchre);
  // 1층 창 (문 양옆)과 반지하 창 (쇠창살)
  const right = T(entranceX(b) + 44);
  const ground: Win[] = [];
  for (const [wx, seed] of [[T(10), 3], [right, 11]] as const) {
    if (wx + T(18) > dx - T(6) && wx < dx + T(34)) continue;
    ground.push({ x: wx, y: yOf(78), w: T(16), h: T(40), fl: 0, seed: b.seed * 17 + seed });
  }
  for (const w of ground) paintWin(c, w, winState(w));
  rect(g, T(10), yOf(22), T(20), T(14), C.iron);
  rect(g, T(12), yOf(20), T(16), T(10), C.windowDark);
  for (let x = T(13); x < T(28); x += 3) rect(g, x, yOf(20), 1, T(10), C.ironLight);
  // 반지하 창 앞 쓰레기통 그늘 (현관 계단은 상자)
  void f;
}

/**
 * 극장: 큰 돌 정면, 양옆 돌 기둥(빛이 오는 안쪽 면만 1칸 테두리, 바깥 끝에 어두운 띠 없음), 높은 아치 창 둘(쐐기돌·창살,
 * 한쪽만 객석 불빛), 꼭대기 전구 띠, 로비 문 넷(밝기가 제각각, 한 문에 사람), 상영작 포스터 틀(작은 등이 비춘다), 매표소
 */
function paintTheater(c: Ctx): void {
  const { f, g, e, b, yOf, tw, th, v } = c;
  // 양옆 돌 기둥: 앞면 돌, 세로 홈 (빛 닿는 곳만), 빛이 오는 안쪽 모서리 1칸 밝게
  for (const [px, inner] of [[0, 11], [tw - 12, 0]] as const) {
    rect(g, px, 0, 12, th, v.trim);
    for (let y = 0; y < th; y++) {
      const s = seenAt(c, px + 6, y);
      if (s > 0.3) {
        rect(g, px + 4, y, 1, 1, v.dark);
        rect(g, px + 8, y, 1, 1, v.dark);
      }
      if (s > 0.15) rect(g, px + inner, y, 1, 1, v.trimLit);
      // 바깥 끝 한 칸 (골목·옆 건물 쪽): 골목 전구 빛을 받는 모서리 (어두운 1px 세로줄이 외곽선처럼 서지 않게)
      if (s > 0.1) rect(g, inner ? px : px + 11, y, 1, 1, v.light);
    }
    // 기둥머리와 받침 (빛 받는 윗면)
    for (const y of [24, yOf(98) - 4]) {
      rect(g, px - 1, y, 14, 4, v.trim);
      rect(g, px - 1, y, 14, 1, v.trimLit);
    }
  }
  // 꼭대기 장식 띠 (전구 받침, 전구는 대부분 죽었다)
  rect(g, 12, 12, tw - 24, 10, C.stoneDark);
  rect(g, 12, 12, tw - 24, 1, v.trim);
  for (let dx = 16; dx < tw - 16; dx += 8) {
    const alive = hash(b.seed + dx) < 0.3;
    rect(g, dx - 1, 16, 3, 3, alive ? C.lampWarm : C.iron);
    if (alive) rect(e, dx - 1, 16, 3, 3, C.lampWarm);
  }
  // 높은 아치 창 둘: 쐐기돌, 둥근 머리 돌 띠, 창살. 왼쪽 창만 객석 불빛 (갓 씌운 벽등 둘이 벽을 위로 비춘다)
  const winTop = 34;
  const winBottom = yOf(98) - 18;
  for (const cx of [38, tw - 38]) {
    const ww = 26;
    const inset = (d: number) => (d < 13 ? Math.round(13 - Math.sqrt(169 - (13 - d) ** 2)) : 0);
    // 둥근 머리 돌 띠 (창 둘레 2칸)
    for (let y = winTop - 3; y < winTop + 13; y++) {
      const d = y - (winTop - 3);
      const ins = d < 16 ? Math.round(16 - Math.sqrt(256 - (16 - d) ** 2)) : 0;
      rect(g, cx - 16 + ins, y, 32 - ins * 2, 1, v.trim);
    }
    rect(g, cx - 2, winTop - 5, 4, 6, v.trimLit);
    const lit = cx < tw / 2;
    for (let y = winTop; y < winBottom; y++) rect(g, cx - ww / 2 + inset(y - winTop), y, ww - inset(y - winTop) * 2, 1, C.windowDark);
    if (lit) {
      // 객석 불빛: 샹들리에 (둥근 등, 위쪽)와 무대 쪽에서 올라오는 낮은 빛, 창살 기둥이 드리운 그늘
      roomWall(g, e, cx - ww / 2, winBottom - 56, ww, 56, [[cx + 3, winBottom - 40, 16, 22, 1.15], [cx, winBottom + 4, ww * 0.9, 26, 0.5, 2]], 0.08, WARM, 4,
        [[cx - 2, winBottom - 26, cx + 1, winBottom, 0.5]]);
      for (let y = winTop; y < winBottom - 56; y++) {
        const ins = inset(y - winTop);
        rect(g, cx - ww / 2 + ins, y, ww - ins * 2, 1, C.windowDark);
      }
      f.lit.push({ x: cx, y: winBottom - 20, warm: true });
    } else {
      // 꺼진 창: 위쪽에 하늘빛 비침 한 줄기
      for (let k = 0; k < 18; k++) rect(g, cx - 8 + Math.floor(k / 2), winTop + 6 + k, 2, 1, C.glassEdge);
    }
    for (let y = winTop + 14; y < winBottom; y += 12) rect(g, cx - ww / 2, y, ww, 1, C.iron);
    rect(g, cx - 1, winTop + 4, 2, winBottom - winTop - 4, C.iron);
    // 창턱 (빛 받는 윗면, 벽에 드리운 그늘)
    darken(c, cx - ww / 2 - 2, winBottom + 3, ww + 4, 2, v.dark);
    rect(g, cx - ww / 2 - 3, winBottom, ww + 6, 3, v.trim);
    rect(g, cx - ww / 2 - 3, winBottom, ww + 6, 1, v.trimLit);
  }
  // 세로 간판 받침 쇠붙이와 간판이 벽에 드리운 그늘 (간판 오른쪽으로 조금 비낀 어두운 면)
  for (let y = 44; y < yOf(98); y += 40) rect(g, Math.floor(tw / 2) - 14, y, 28, 2, C.iron);
  // 1층 로비: 어두운 벽, 문 넷 (차양 아래 66), 포스터 틀 둘, 가운데 매표소
  const lobbyTop = yOf(70);
  rect(g, 12, lobbyTop, tw - 24, th - lobbyTop, '#2a1c1e');
  const glows = ['#ad5a20', '#844018', '#ad5a20', '#5e2c12'];
  for (let i = 0; i < 4; i++) {
    const dx = 36 + i * 26 + (i >= 2 ? 6 : 0);
    rect(g, dx, yOf(66), 20, th - yOf(66), C.iron);
    // 로비 유리문: 샹들리에 빛이 쏟아지는 문 윗부분이 가장 밝다 (문마다 밝기가 조금씩 다르다)
    // (극장 입구는 거리에서 가장 밝은 곳: 샹들리에 바로 밑 문 윗부분은 하얗게 날아간 빛)
    roomWall(g, e, dx + 2, yOf(64), 16, th - yOf(64), [[dx + 10, yOf(64) - 2, 15, 44, i === 3 ? 0.7 : 1.6]], 0.3, WARM, 3,
      i === 1 ? [[dx + 6, yOf(52), dx + 13, yOf(6), 0.5]] : []);
    if (i !== 3) {
      rect(g, dx + 2, yOf(64), 16, 3, '#ffe2a8');
      rect(e, dx + 2, yOf(64), 16, 3, '#fff4d8');
    }
    if (i === 1) figure(g, e, dx + 10, yOf(4), 46, 'hat', C.iron);
    rect(g, dx + 9, yOf(64), 2, th - yOf(64), C.iron);
    rect(e, dx + 9, yOf(64), 2, th - yOf(64), '#000');
    rect(g, dx + 4, yOf(30), 12, 1, C.chrome);
    void glows;
  }
  // 매표소: 둥근 창 안 따뜻한 불빛 (2번과 3번 문 사이)
  const bx = 36 + 2 * 26 - 4;
  rect(g, bx - 2, yOf(48), 8, 2, v.trim);
  // 상영작 포스터 틀 둘: 틀 위 작은 등이 비추는 포스터 (등 쪽이 밝다)
  for (const px of [14, tw - 34]) {
    rect(g, px, yOf(62), 20, yOf(18) - yOf(62), C.paintOchre);
    rect(g, px + 2, yOf(60), 16, yOf(20) - yOf(60), C.posterRed);
    // 도안: 큰 얼굴 실루엣과 제목 띠
    disc(g, px + 10, yOf(46), 4, C.posterRedDark);
    rect(g, px + 5, yOf(41), 10, 8, C.posterRedDark);
    rect(g, px + 3, yOf(28), 14, 3, C.paintCream);
    rect(g, px + 4, yOf(64), 12, 2, C.iron);
    rect(g, px + 7, yOf(63), 6, 1, C.lampCore);
    rect(e, px + 7, yOf(63), 6, 1, C.lampGlow);
  }
}

/** 다이너 1층: 법랑 판(크림·청록), 크롬 띠, 둥근 모서리, 긴 진열창 자리, 문, 차양 그늘 */
function paintDiner(c: Ctx): void {
  const { g, e, b, T, yOf, tw } = c;
  const shopTop = yOf(SHOP_H);
  rect(g, 0, shopTop, tw, yOf(0) - shopTop, C.carCream);
  ditherRect(g, 0, shopTop, tw, yOf(0) - shopTop, C.paintCream, 6);
  rect(g, 0, yOf(14), tw, T(14), C.paintTeal);
  for (const y of [shopTop + 4, yOf(78) + 2, yOf(16)]) {
    rect(g, 0, y, tw, 2, C.chrome);
    rect(g, 0, y + 2, tw, 1, C.chromeDark);
  }
  // 긴 진열창 자리 (유리 판이 덮는다)
  const doorX = T(doorOf(b) - b.x);
  rect(g, T(6), yOf(70), doorX - T(10), T(54), C.chromeDark);
  rect(g, T(8), yOf(68), doorX - T(14), T(50), C.windowDark);
  const dw = T(DOOR_W);
  const dy = yOf(DOOR_H);
  rect(g, doorX - 1, dy - 2, dw + 2, T(DOOR_H) + 2, C.chromeDark);
  rect(g, doorX + 2, dy + 2, dw - 4, T(DOOR_H) - 18, C.windowDark);
  roomWall(g, e, doorX + 2, dy + 2, dw - 4, T(DOOR_H) - 18, [[doorX + dw / 2, dy + 4, dw * 0.55, T(DOOR_H) * 0.55, 0.8, 1]], 0.22, WARM, 3);
  rect(g, doorX + dw - 6, dy + 30, 2, 6, C.chrome);
  // 법랑 판 녹 (크롬 띠 아래로 흘러내린 녹물: 끊기지 않는 줄)
  for (let k = 0; k < 6; k++) {
    const sx = 4 + Math.floor(rnd(b.seed, 500 + k) * (tw - 8));
    const len = 4 + Math.floor(rnd(b.seed, 510 + k) * 10);
    rect(g, sx, yOf(16) + 3, 1, len, C.rust);
  }
  awningShade(c, 0, tw);
}
/** 건물 옆면·뒤: 어두운 벽돌과 그을음 (창 없이) */
export function paintSide(w: number, h: number, seed: number, set: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  brickWall(g, 0, 0, w, h, seed + 5, set);
  ditherRect(g, 0, 0, w, h, C.smog0, 6, seed & 3);
  return c;
}

/** 지붕: 타르 바닥, 자갈, 환기구 */
export function paintRoof(w: number, d: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, d));
  rect(g, 0, 0, w, d, C.smog1);
  ditherRect(g, 0, 0, w, d, C.smog3, 3, seed & 3);
  for (let k = 0; k < 3; k++) rect(g, Math.floor(rnd(seed, 600 + k) * (w - 6)), Math.floor(rnd(seed, 610 + k) * (d - 6)), 6, 6, C.iron);
  return c;
}

/** 돌 처마 앞면: 돌 띠, 이빨 장식, 아래 그늘 */
export function paintCornice(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  rect(g, 0, 0, w, h, C.stone);
  rect(g, 0, 0, w, 1, C.paintCream);
  rect(g, 0, h - 2, w, 2, C.stoneDark);
  for (let x = 2; x < w - 2; x += 6) rect(g, x, h - 4, 3, 2, C.stoneDark);
  // 그을음은 띠 무늬(가장자리 점선이 1px 어두운 선처럼 보인다) 대신 길이가 제각각인 세로 얼룩으로
  for (let x = 1 + (seed % 5); x < w - 1; x += 7 + ((x * 13 + seed) % 9)) rect(g, x, 1, 2, 2 + ((x + seed) % 3), C.stoneDark);
  return c;
}

/**
 * 처마 앞면 (건물 목소리마다): 돌 처마는 이빨 장식, 벽돌 건물은 층층이 내민 벽돌, 칠한 건물은 받침쇠 달린 쇠 처마.
 * 맨 위 줄은 하늘빛을 조금만 받는다 (모든 처마 위에 똑같은 밝은 1px 선을 긋지 않는다). 아래 두 줄은 처마 밑 그늘 면
 */
export function paintCorniceFor(b: FrontBuildingPlace, w: number, h: number): HTMLCanvasElement {
  const v = voiceOf(b);
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  if (v.bond === 'brick') {
    rect(g, 0, 0, w, h, v.base);
    rect(g, 0, 0, w, 1, v.light);
    rect(g, 0, 2, w, 1, v.joint);
    // 내민 벽돌 (머리 벽돌이 번갈아 튀어나온 줄)
    for (let x = 0; x < w; x += 4) rect(g, x, 3, 2, 2, rnd(b.seed, 3000 + x) < 0.5 ? v.light : v.base);
    rect(g, 0, 5, w, 1, v.joint);
    // 아래 줄은 벽 쪽 그늘과 같은 밝기 (처마 밑 끝이 벽보다 어두운 1px 선으로 서지 않게: 그늘은 처마 밑 벽에 면으로)
    rect(g, 0, h - 3, w, 3, v.base);
  } else if (v.bond === 'render') {
    rect(g, 0, 0, w, h, v.trim);
    rect(g, 0, 0, w, 1, v.trimLit);
    for (let x = 4; x < w - 2; x += 11) rect(g, x, 2, 2, h - 4, v.trimDark);
  } else {
    rect(g, 0, 0, w, h, v.trim);
    rect(g, 0, 0, w, 1, v.light);
    for (let x = 2; x < w - 2; x += 6) rect(g, x, h - 5, 3, 2, v.trimDark);
  }
  // 그을음: 길이가 제각각인 세로 얼룩 (띠 무늬의 점선이 1px 어두운 선처럼 보이지 않게)
  for (let x = 1 + (b.seed % 5); x < w - 1; x += 7 + ((x * 13 + b.seed) % 9)) rect(g, x, 1, 2, 2 + ((x + b.seed) % 3), v.bond === 'brick' ? v.dark : v.trimDark);
  return c;
}

/**
 * 구간 끝에 드러난 건물 옆벽 (깊이 w × 높이 h): 거의 정면만 보는 카메라에서 옆벽은 가로로 크게 눌려 보이므로
 * 가로 줄(벽돌 줄눈·띠)만 둔다 (세로 무늬는 눌려 잡티가 된다). 옆에서 오는 빛을 받는 벽이라 정면보다 한 단계 밝은 바탕
 * (어두운 1칸 세로줄이 외곽선처럼 서지 않게)
 */
export function paintEndWall(b: FrontBuildingPlace, w: number, h: number): HTMLCanvasElement {
  const v = voiceOf(b);
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  rect(g, 0, 0, w, h, v.light);
  for (let y = 3; y < h; y += 4) rect(g, 0, y, w, 1, v.base);
  // 층 높이마다 굴뚝 자국·땜질 띠 (가로)
  for (let k = 0; k < 4; k++) {
    const y = Math.floor(rnd(b.seed, 3100 + k) * h);
    rect(g, 0, y, w, 3 + Math.floor(rnd(b.seed, 3110 + k) * 6), v.base);
  }
  // 위쪽은 그을음 (처마 밑)
  rect(g, 0, 0, w, 6, v.dark);
  return c;
}

/** 줄무늬 차양: 앞 드리움(물결 끝)과 윗면 */
export function paintAwning(w: number, h: number, stripe: string, base: string): HTMLCanvasElement {
  const [c, g] = canvas(Math.max(2, w), Math.max(2, h));
  for (let x = 0; x < w; x++) rect(g, x, 0, 1, h - 2, Math.floor(x / 6) % 2 ? stripe : base);
  // 물결 단: 위 줄무늬 색을 그대로 이어서 (어두운 이빨 줄이 외곽선처럼 서지 않게)
  for (let x = 0; x < w; x += 6) rect(g, x, h - 2, 3, 2, Math.floor(x / 6) % 2 ? stripe : base);
  ditherRect(g, 0, 0, w, h, C.smog1, 4);
  return c;
}

/** 단색 칸 (작은 장식 상자들의 색 팔레트): 16×16칸, 칸마다 한 색 */
export function paintSwatches(colors: readonly string[]): HTMLCanvasElement {
  const [c, g] = canvas(64, 64);
  colors.forEach((col, i) => rect(g, (i % 16) * 4, Math.floor(i / 16) * 4, 4, 4, col));
  return c;
}

/**
 * 네온 관 글씨 (3×5 글꼴, 글자 한 칸 = s px). 관은 칸 가운데를 잇는 이어진 선이다 (가로·세로로 붙은 칸끼리 이어진다).
 * 바탕 텍스처: 어두운 관 둘레(dark)와 꺼진 유리관(희뿌연 속). 발광 텍스처(e): 둘레는 어두운 관 색으로 은은하게, 관은 밝게.
 * e가 없으면 바탕에 밝은 관을 그대로 칠한다 (빛나지 않는 글씨).
 */
export function neonText(
  g: CanvasRenderingContext2D, e: CanvasRenderingContext2D | null, text: string, x: number, y: number, s: number,
  bright: string, dark: string, vertical = false,
): void {
  const t = s >= 4 ? 2 : 1;
  const c0 = Math.floor((s - t) / 2);
  [...text].forEach((ch, k) => {
    const rows = glyphRows(ch);
    const on = (r: number, c: number) => r >= 0 && r < 5 && c >= 0 && c < 3 && (rows[r] & (4 >> c)) !== 0;
    const ox = vertical ? x : x + k * 4 * s;
    const oy = vertical ? y + k * 6 * s : y;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (!on(r, c)) continue;
        rect(g, ox + c * s, oy + r * s, s, s, dark);
        if (e) rect(e, ox + c * s, oy + r * s, s, s, dark);
      }
    }
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (!on(r, c)) continue;
        const cx = ox + c * s + c0;
        const cy = oy + r * s + c0;
        const core = e ? C.smog3 : bright;
        const segs: Array<[number, number, number, number]> = [[cx, cy, t, t]];
        if (on(r, c + 1)) segs.push([cx, cy, s + t, t]);
        if (on(r + 1, c)) segs.push([cx, cy, t, s + t]);
        for (const [sx, sy, sw, sh] of segs) {
          rect(g, sx, sy, sw, sh, core);
          if (e) rect(e, sx, sy, sw, sh, bright);
        }
      }
    }
  });
}

/**
 * 1960년대 세단 옆모습 (길이 w, 높이 h): 두 가지 색, 크롬 띠, 꼬리 날개, 화이트월 바퀴. 발광: 꼬리등.
 * dent: 망가짐 (지붕이 내려앉고 앞유리에 금, 전조등이 깨지고 보닛이 찌그러짐, 꼬리등 꺼짐)
 */
export function paintCar(w: number, h: number, paint: string, seed: number, dent = false): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const [map, g] = canvas(w, h);
  const [glow, e] = canvas(w, h);
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  const base = h - 4;
  // 차체 아래쪽 (낮고 길게)
  rect(g, 2, base - 14, w - 4, 11, paint);
  rect(g, 2, base - 14, w - 4, 1, C.carCream);
  ditherRect(g, 2, base - 8, w - 4, 5, C.smog1, 5);
  // 꼬리 날개 (뒤 = 왼쪽)
  for (let k = 0; k < 12; k++) rect(g, 2 + k, base - 14 - Math.max(0, 5 - Math.floor(k / 2)), 1, Math.max(0, 5 - Math.floor(k / 2)), paint);
  // 크롬 띠, 범퍼
  rect(g, 6, base - 9, w - 12, 1, C.chrome);
  rect(g, 0, base - 6, 5, 3, C.chrome);
  rect(g, w - 5, base - 6, 5, 3, C.chrome);
  // 꼬리등과 전조등
  rect(g, 2, base - 13, 3, 4, C.neonRedDark);
  if (!dent) rect(e, 2, base - 13, 3, 4, C.neonRed);
  rect(g, w - 4, base - 12, 2, 2, dent ? C.iron : C.chromeDark);
  // 객실: 크림 지붕, 앞뒤 유리 (뒤 31%~앞 67%)
  const c0 = Math.round(w * 0.31);
  const c1 = Math.round(w * 0.67);
  const roof = base - (dent ? 22 : 26);
  rect(g, c0, roof, c1 - c0, 2, C.carCream);
  for (let y = roof + 2; y < base - 14; y++) {
    const t = (y - roof) / (base - 14 - roof);
    const l = Math.round(c0 - 10 * t);
    const r = Math.round(c1 + 9 * t);
    rect(g, l, y, 1, 1, C.carCream);
    rect(g, r, y, 1, 1, C.carCream);
    rect(g, l + 1, y, r - l - 1, 1, C.windowDark);
  }
  rect(g, Math.round((c0 + c1) / 2), roof + 2, 2, base - 16 - roof, C.carCream);
  ditherRect(g, c0, roof + 3, c1 - c0, 4, C.glassEdge, 6);
  if (dent) {
    // 앞유리 금, 찌그러진 보닛
    line(g, c1 - 12, roof + 2, c1 - 2, base - 15, C.skyDark);
    line(g, c1 - 6, roof + 2, c1 - 10, base - 15, C.skyDark);
    for (let k = 0; k < 7; k++) rect(g, w - 26 + k * 3, base - 14 + (k % 2), 3, 2, C.iron);
    ditherRect(g, w - 30, base - 13, 26, 6, C.iron, 4);
  }
  // 바퀴 (화이트월)
  for (const wx of [Math.round(w * 0.2), w - Math.round(w * 0.21)]) {
    for (let y = -5; y <= 5; y++) {
      const half = Math.floor(Math.sqrt(30 - y * y));
      rect(g, wx - half, base - 1 + y, half * 2 + 1, 1, C.iron);
    }
    rect(g, wx - 3, base - 4, 7, 7, C.carCream);
    rect(g, wx - 1, base - 2, 3, 3, C.chromeDark);
  }
  // 빗물 얼룩과 녹
  for (let k = 0; k < 5; k++) rect(g, 6 + Math.floor(rnd(seed, 700 + k) * (w - 12)), base - 6 + Math.floor(rnd(seed, 710 + k) * 3), 2, 1, C.rust);
  // 차 밑 그늘 (선이 아니라 두 줄 면)
  rect(g, 4, base - 3, w - 8, 2, C.smog0);
  return { map, glow };
}

/** 타 버린 차 (길이 w, 높이 h): 납작하게 주저앉고, 지붕이 짓눌리고, 바퀴 하나가 빠졌다. 그을음과 녹 */
export function paintCarWreck(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w + 20, h);
  const base = h - 1;
  const x = 4;
  rect(g, x + 2, base - 12, w - 4, 9, C.iron);
  rect(g, x + 24, base - 18, 30, 6, C.iron);
  line(g, x + 2, base - 12, x + 8, base - 16, C.iron);
  rect(g, x + 4, base - 12, w - 8, 1, C.ironLight);
  ditherRect(g, x + 6, base - 10, w - 14, 6, C.rust, 6);
  ditherRect(g, x + 2, base - 18, w - 4, 6, C.fxSoot, 5);
  // 남은 바퀴 (타서 휠만)
  for (let y = -5; y <= 5; y++) {
    const half = Math.floor(Math.sqrt(30 - y * y));
    rect(g, x + 16 - half, base - 4 + y, half * 2 + 1, 1, C.iron);
  }
  rect(g, x + w - 22, base - 2, 12, 3, C.iron);
  // 굴러간 바퀴
  rect(g, x + w + 6, base - 4, 8, 5, C.iron);
  return c;
}

/** 젖은 아스팔트 (가로 x, 세로 z): 금, 빗물 웅덩이(알파 = 젖은 정도), 전차 선로 두 줄 */
export function paintStreet(w: number, d: number, seed: number, rails: readonly number[]): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  rect(g, 0, 0, w, d, C.street);
  ditherRect(g, 0, 0, w, d, C.streetLine, 3);
  for (let k = 0; k < Math.floor(w / 40); k++) {
    let x = Math.floor(rnd(seed, 800 + k) * w);
    let y = Math.floor(rnd(seed, 810 + k) * d);
    for (let i = 0; i < 18; i++) {
      rect(g, x, y, 1, 1, C.smog0);
      x += rnd(seed, 820 + i + k * 30) < 0.5 ? 1 : 2;
      y += rnd(seed, 830 + i + k * 30) < 0.5 ? -1 : 1;
    }
  }
  for (const rz of rails) {
    rect(g, 0, rz, w, 2, C.rail);
    rect(g, 0, rz + 2, w, 1, C.railDark);
  }
  return c;
}

/** 이어 붙여도 이음매가 없는 값 잡음 (빨강 채널 = 0~255). 안개 카드·웅덩이 무늬에 쓴다 */
export function paintNoise(size: number, seed: number, cells: number, octaves = 3): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const val = (ix: number, iy: number, n: number) => hash(seed * 977 + (((ix % n) + n) % n) * 131 + (((iy % n) + n) % n) * 7919 + n * 31);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 1;
      let tot = 0;
      for (let o = 0; o < octaves; o++) {
        const n = cells << o;
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smooth(fx - ix);
        const ty = smooth(fy - iy);
        const a = val(ix, iy, n) * (1 - tx) + val(ix + 1, iy, n) * tx;
        const b = val(ix, iy + 1, n) * (1 - tx) + val(ix + 1, iy + 1, n) * tx;
        v += (a * (1 - ty) + b * ty) * amp;
        tot += amp;
        amp *= 0.5;
      }
      const k = (y * size + x) * 4;
      const byte = Math.round((v / tot) * 255);
      img.data[k] = byte;
      img.data[k + 1] = byte;
      img.data[k + 2] = byte;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** 웅덩이 무늬: 잡음의 높은 곳만 (젖은 정도 0~255, 경계는 디더링으로 끊어지게) */
export function paintPuddles(size: number, seed: number): HTMLCanvasElement {
  const n = paintNoise(size, seed, 4, 2);
  const g = n.getContext('2d')!;
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const v = img.data[i * 4] / 255;
    const bay = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((Math.floor(i / size) & 3) << 2) | (i % size & 3)] / 16;
    const w = v > 0.62 ? 1 : v > 0.52 && (v - 0.52) / 0.1 > bay ? 0.6 : 0.15;
    const b = Math.round(w * 255);
    img.data[i * 4] = b;
    img.data[i * 4 + 1] = b;
    img.data[i * 4 + 2] = b;
  }
  g.putImageData(img, 0, 0);
  return n;
}
