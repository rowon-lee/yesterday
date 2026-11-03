import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { PARK_GATE_W, WRECK_FALL, type Wreckable } from '../../stage/citadel';
import { canvas, hash, rect } from '../dither';
import { paintContainer } from './edges';
import { Details, facedBox } from './kit';
import { litMaterial, pixelTexture } from './shaders';

/**
 * 구조물이 실제로 부서진 모양 (렌더 전용, 2026-11-03 2차 비주얼 폴리시).
 * 시타델 붕괴(잔해 언덕)처럼 부서지기 전후 실루엣이 달라지게 한다. 금 그림을 덧대는 대신:
 * - 떨어져 나간 자리는 무대 재질이 정말 그리지 않는다 (Cut → lights.ts uCut: 잘린 가장자리는 깨진 단면).
 * - 남은 자리에는 속 재질(움푹한 속, 드러난 철골·철근 뼈대, 부러진 밑동의 깨진 윗면)을 새로 놓는다.
 * - 떨어진 몸(꺾여 처진 판, 기대 쓰러진 컨테이너, 넘어진 굴뚝 토막, 동상 윗몸)은 경첩·낙하 움직임(Anim)으로 무너져 자리를 잡는다.
 * - 밑에는 잔해 더미 (덩어리마다 빛 받는 윗면). sim이 새 발판을 둔 자리(WRECK_FALL)는 윗면이 평평한 판으로 읽히게 한다.
 * 구조물마다 모양이 다르다: 탑(굴뚝·저탄 탑·문기둥), 쌓인 컨테이너, 하역장 콘크리트 턱, 초소, 모래주머니, 판(통로·들보·선로·차양),
 * 기둥(속 뼈대가 드러나 휜다), 동상.
 * 무대 규칙: 외곽선 없음 (형태는 빛 받는 윗면·그늘로), 디더 없음. 무늬는 칸 단위 정수 좌표.
 */

/** 떨어져 나간 자리 하나 (월드 px): x0~x1, 아랫변 yb(x0에서, 기울기 slope), 윗변 yt, 깊이 z0~z1, 들쭉날쭉 jag */
export interface Cut {
  x0: number;
  x1: number;
  yb: number;
  yt: number;
  z0: number;
  z1: number;
  slope: number;
  jag: number;
}

/** 무너지는 움직임: obj의 자리·기울기를 from에서 to로 (틱 dur, delay 뒤 시작). grow면 y 크기 0 → 1 (잔해가 쌓인다) */
export interface Anim {
  obj: THREE.Object3D;
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  dur: number;
  delay: number;
  grow?: boolean;
}

export interface Collapse {
  cuts: Cut[];
  group: THREE.Group;
  anims: Anim[];
  /** 무너질 때 먼지가 바닥을 따라 퍼지는 자리 (x, 바닥 높이, 폭) */
  dust: Array<readonly [number, number, number]>;
  /** 부러진 자리 속에서 타는 불씨 빛 (x, y, z) */
  glow: Array<readonly [number, number, number]>;
}

/** 부러진 자리 속 불씨 (스스로 빛나는 작은 덩어리): x0~x1, 높이 y 둘레 */
function embers(g: THREE.Group, x0: number, x1: number, y: number, z: number, seed: number): void {
  const r = rng(seed);
  const [c, gg] = canvas(4, 1);
  ['#ffd27a', '#ff9a4a', '#ff6a2a', '#c8401e'].forEach((col, i) => rect(gg, i, 0, 1, 1, col));
  const t = pixelTexture(c);
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  for (let k = 0; k < Math.max(3, (x1 - x0) / 4); k++) {
    const x = x0 + r() * (x1 - x0);
    const yy = y - 1 + r() * 3;
    const w = 1 + Math.floor(r() * 2);
    const u = (Math.floor(r() * 4) + 0.5) / 4;
    for (const [px, py] of [[x, yy], [x + w, yy], [x + w, yy + 1], [x, yy], [x + w, yy + 1], [x, yy + 1]]) {
      pos.push(px, py, z);
      uv.push(u, 0.5);
      nrm.push(0, 0, 1);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.add(new THREE.Mesh(geo, litMaterial(t, { nocut: true, emissive: t, emissiveStrength: 1.6 })));
}

interface Pal {
  base: string;
  mid: string;
  lit: string;
  dark: string;
  inner: string;
  frame: string;
  frameLit: string;
}

const PAL: Record<string, Pal> = {
  brick: { base: '#3a2c2c', mid: '#4e3a36', lit: '#8a6a5c', dark: '#16101a', inner: '#1c1416', frame: '#2e2a30', frameLit: '#6c6670' },
  rust: { base: '#4a3a30', mid: '#5c4a3e', lit: '#8a7058', dark: '#16110f', inner: '#141012', frame: '#2e2a30', frameLit: '#6c6058' },
  steel: { base: '#2e2a30', mid: '#3c3840', lit: '#6c6670', dark: '#121014', inner: '#141216', frame: '#2e2a30', frameLit: '#6c6670' },
  crane: { base: '#5a4830', mid: '#6a5634', lit: '#a08a5c', dark: '#1e1a14', inner: '#16130e', frame: '#4e4030', frameLit: '#a08a5c' },
  concrete: { base: '#3e3c3a', mid: '#55524c', lit: '#8a867e', dark: '#141418', inner: '#1a1a1e', frame: '#6a4030', frameLit: '#9a6040' },
  stone: { base: '#3a3836', mid: '#4a4844', lit: '#9a968e', dark: '#141416', inner: '#18181c', frame: '#5a3a2c', frameLit: '#8a5a40' },
  green: { base: '#2c3834', mid: '#3a4844', lit: '#5a6c64', dark: '#101614', inner: '#0e1412', frame: '#26302c', frameLit: '#5a6c64' },
  watch: { base: '#2a2c32', mid: '#3a3c44', lit: '#6a707c', dark: '#101116', inner: '#121318', frame: '#2a2c32', frameLit: '#6a707c' },
  sheet: { base: '#4a4844', mid: '#5a5850', lit: '#8a8478', dark: '#1c1b1e', inner: '#141416', frame: '#3a3836', frameLit: '#8a8478' },
  cabin: { base: '#3a2e28', mid: '#4a3a33', lit: '#7a6a5a', dark: '#16110f', inner: '#120e0c', frame: '#2a2c32', frameLit: '#6a707c' },
  sand: { base: '#5a5040', mid: '#6a5e48', lit: '#9a8a66', dark: '#2a2418', inner: '#221e16', frame: '#4a4030', frameLit: '#7a6c52' },
  bronze: { base: '#2a2622', mid: '#3e362c', lit: '#8a7a52', dark: '#100e0c', inner: '#0e0c0a', frame: '#3e362c', frameLit: '#8a7a52' },
};

/** 무늬 종류: 벽돌, 콘크리트(돌), 리벳 강판, 모래주머니 */
type Grain = 'brick' | 'concrete' | 'plate' | 'bags';

/** 구조물마다: 모양 종류, 깊이(z 뒤 ~ 앞), 색, 무늬 */
interface Spec {
  type: 'tower' | 'crates' | 'dock' | 'cabin' | 'bags' | 'deck' | 'leg' | 'statue';
  z: readonly [number, number];
  pal: string;
  grain: Grain;
  /** 판: 윗면 아래로 그린 깊이(들보·등), 윗면 위로 그린 높이(난간·침목), 판 두께 */
  dep?: number;
  abv?: number;
  thick?: number;
  rails?: boolean;
}

const SPEC: Record<string, Spec> = {
  stack: { type: 'tower', z: [-44, 0], pal: 'brick', grain: 'brick' },
  hopper: { type: 'tower', z: [-52, 0], pal: 'rust', grain: 'plate' },
  gatePier: { type: 'tower', z: [-38, 0], pal: 'stone', grain: 'concrete' },
  parkGate: { type: 'tower', z: [-31, 0], pal: 'stone', grain: 'concrete' },
  crate2: { type: 'crates', z: [-91, 0], pal: 'steel', grain: 'plate' },
  crate3: { type: 'crates', z: [-91, 0], pal: 'steel', grain: 'plate' },
  containers: { type: 'crates', z: [-111, 0], pal: 'steel', grain: 'plate' },
  dock: { type: 'dock', z: [-71, 0], pal: 'concrete', grain: 'concrete' },
  booth: { type: 'cabin', z: [-54, 0], pal: 'cabin', grain: 'concrete' },
  checkpoint: { type: 'cabin', z: [-48, -9], pal: 'cabin', grain: 'concrete' },
  sandbags: { type: 'bags', z: [-41, 0], pal: 'sand', grain: 'bags' },
  ring: { type: 'deck', z: [-49, -1], pal: 'steel', grain: 'plate', dep: 6, abv: 16, thick: 4, rails: true },
  catwalk: { type: 'deck', z: [-37, -3], pal: 'steel', grain: 'plate', dep: 12, abv: 16, thick: 4, rails: true },
  crane: { type: 'deck', z: [-38, -12], pal: 'crane', grain: 'plate', dep: 22, abv: 200, thick: 14 },
  craneLow: { type: 'deck', z: [-31, -19], pal: 'crane', grain: 'plate', dep: 8, abv: 2, thick: 7 },
  dockAwning: { type: 'deck', z: [-73, -5], pal: 'sheet', grain: 'plate', dep: 20, abv: 2, thick: 6 },
  rail: { type: 'deck', z: [-65, -1], pal: 'green', grain: 'plate', dep: 18, abv: 20, thick: 14, rails: true },
  stairs: { type: 'deck', z: [-45, -9], pal: 'green', grain: 'plate', dep: 6, abv: 16, thick: 4, rails: true },
  watch: { type: 'deck', z: [-45, -15], pal: 'watch', grain: 'plate', dep: 6, abv: 2, thick: 4 },
  watchRoof: { type: 'deck', z: [-45, -15], pal: 'watch', grain: 'plate', dep: 6, abv: 14, thick: 4 },
  catwalkLeg: { type: 'leg', z: [-25, -14], pal: 'steel', grain: 'plate' },
  craneLeg: { type: 'leg', z: [-39, -10], pal: 'crane', grain: 'plate' },
  railLeg: { type: 'leg', z: [-45, -19], pal: 'concrete', grain: 'concrete' },
  watchLeg: { type: 'leg', z: [-35, -25], pal: 'watch', grain: 'plate' },
  watchCabin: { type: 'leg', z: [-41, -19], pal: 'cabin', grain: 'concrete' },
  statue: { type: 'statue', z: [-52, -48], pal: 'bronze', grain: 'concrete' },
};

/** 이 구조물이 실제로 부서지는 모양을 가졌는가 (없으면 손상 판만) */
export function hasCollapse(kind: string): boolean {
  return kind in SPEC;
}

/** 렌더 전용 고정 난수 */
function rng(seed: number): () => number {
  let n = seed * 7919 + 13;
  return () => hash(n++ * 2654435761);
}

/** 겉면 그림 (면 하나, 폭 w × 높이 h): 무늬, 위 1px 빛 받는 테, 아래 2px 그늘. 속(inner)이면 어둡고 무늬가 흐리다 */
function paintFace(pal: Pal, grain: Grain, w: number, h: number, seed: number, inner = false): HTMLCanvasElement {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  const base = inner ? pal.inner : pal.base;
  const alt = inner ? pal.dark : pal.mid;
  rect(g, 0, 0, W, H, base);
  if (grain === 'brick') {
    for (let y = 0; y < H; y += 3) {
      const off = (y / 3) % 2 ? 3 : 0;
      for (let x = -off; x < W; x += 7) {
        if (r() < 0.45) rect(g, x + 1, y, 5, 2, alt);
        rect(g, x, y + 2, 7, 1, pal.dark);
      }
    }
  } else if (grain === 'concrete') {
    for (let k = 0; k < (W * H) / 14; k++) rect(g, Math.floor(r() * W), Math.floor(r() * H), 1 + Math.floor(r() * 2), 1, r() < 0.6 ? alt : pal.dark);
    for (let y = 9 + Math.floor(r() * 4); y < H; y += 11) rect(g, 0, y, W, 1, pal.dark);
  } else if (grain === 'plate') {
    for (let x = 5 + Math.floor(r() * 6); x < W; x += 12 + Math.floor(r() * 4)) {
      rect(g, x, 0, 1, H, pal.dark);
      if (!inner) for (let y = 2; y < H - 1; y += 4) rect(g, x + 1, y, 1, 1, pal.lit);
    }
    // 녹 줄 (위에서 흘러내린 길이 제각각)
    for (let k = 0; k < W / 9; k++) {
      const x = Math.floor(r() * W);
      rect(g, x, 0, 1, Math.floor(r() * H * 0.8), '#4a3024');
    }
  } else {
    for (let y = 0; y < H; y += 5) for (let x = ((y / 5) % 2) * 5 - 5; x < W; x += 10) {
      rect(g, x + 1, y, 8, 4, alt);
      rect(g, x + 1, y, 8, 1, pal.lit);
    }
  }
  if (!inner) rect(g, 0, 0, W, 1, pal.lit);
  rect(g, 0, H - Math.min(2, H), W, Math.min(2, H), pal.dark);
  return c;
}

/** 단색 면 (윗면·옆면): 빛 받는 윗면은 lit에 잔 얼룩 */
function paintFlat(color: string, spot: string, w: number, h: number, seed: number): HTMLCanvasElement {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const [c, g] = canvas(W, H);
  rect(g, 0, 0, W, H, color);
  const r = rng(seed);
  for (let k = 0; k < (W * H) / 18; k++) rect(g, Math.floor(r() * W), Math.floor(r() * H), 1, 1, spot);
  return c;
}

const mat = (c: HTMLCanvasElement, bump = 0.5, wet = 0.45): THREE.ShaderMaterial => litMaterial(pixelTexture(c), { nocut: true, bump, wet });

/**
 * 무늬 있는 덩어리 상자 (부러진 밑동의 깨진 윗면, 떨어진 토막, 판 조각): 앞면 무늬, 윗면 빛, 옆면 그늘.
 * 원점 기준 좌표 (x0~x1, y0~y1, z0~z1). 무너지는 움직임을 주려면 그룹에 넣어 그룹을 움직인다
 */
function chunk(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, pal: Pal, grain: Grain, seed: number, inner = false): THREE.Mesh {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const front = mat(paintFace(pal, grain, w, h, seed, inner));
  const top = mat(paintFlat(inner ? pal.base : pal.lit, pal.mid, w, Math.max(1, d / 4), seed + 1), 0.3, 0.7);
  const side = mat(paintFace(pal, grain, Math.max(1, d / 3), h, seed + 2, true), 0.3, 0.3);
  return facedBox(x0, x1, y0, y1, z0, z1, { pz: front, py: top, px: side, nx: side });
}

/** 잔해 더미 (바닥 base에서, 가운데 x cx, 폭 w, 높이 h, 깊이 z0~z1): 언덕 꼴로 덩어리를 쌓고 덩어리마다 윗면이 빛을 받는다.
 * flat이 있으면 그 높이·폭에 떨어진 판 (평평한 윗면: sim의 새 발판). 철근·철골이 비스듬히 삐져나온다 */
function rubble(det: Details, cx: number, w: number, base: number, h: number, z0: number, z1: number, pal: Pal, seed: number, steel: boolean): void {
  const r = rng(seed);
  const x0 = cx - w / 2;
  const top = (x: number): number => {
    const u = Math.max(0, Math.min(1, (x - x0) / w));
    return base + h * Math.sin(u * Math.PI) ** 0.6 * (0.8 + 0.2 * hash(Math.floor(x / 4) * 977 + seed));
  };
  // 속: 기둥처럼 세운 덩어리 (폭 제각각), 앞쪽으로 갈수록 낮다
  for (let x = x0; x < x0 + w; ) {
    const bw = 3 + Math.floor(r() * 7);
    const t = top(x + bw / 2);
    if (t > base + 0.5) {
      det.add(x, x + bw, base, t, z0, z1 - 4, r() < 0.5 ? pal.base : pal.inner);
      det.add(x, x + bw, base, Math.max(base + 0.5, t * 0.7 + base * 0.3), z1 - 4, z1, pal.base);
    }
    x += bw;
  }
  // 겉: 크고 작은 덩어리 (큰 것부터), 윗변 1px이 빛을 받는다
  const n = Math.round(w / 3.5);
  for (let k = 0; k < n; k++) {
    const x = x0 + r() * w;
    const big = k < n / 4;
    const bw = 2 + Math.floor(r() * (big ? 9 : 4));
    const bh = 1 + Math.floor(r() * (big ? 5 : 2));
    const t = top(x + bw / 2);
    if (t - base < 1.5) continue;
    const y = t - bh * (0.3 + r() * 0.5);
    const zz = z1 - 2 - r() * (z1 - z0 - 4);
    const col = r() < 0.5 ? pal.mid : pal.base;
    det.add(x, x + bw, y, y + bh, zz - 3 - r() * 4, zz, col);
    det.add(x, x + bw, y + bh - 0.6, y + bh, zz - 3, zz, pal.lit);
  }
  // 삐져나온 철근·철골 (비스듬한 막대)
  const bars = Math.max(1, Math.floor(w / 26));
  for (let k = 0; k < bars; k++) {
    const x = x0 + w * (0.15 + 0.7 * r());
    const t = top(x);
    const a = (r() - 0.5) * 2.2;
    const len = 6 + r() * (steel ? 16 : 10);
    det.bar(x, t - 2, x + Math.sin(a) * len, t - 2 + Math.cos(a) * len, steel ? 2 : 1, z1 - 8, z1 - 6, steel ? pal.frameLit : PAL.concrete.frameLit);
  }
}

/** 떨어진 판 (새 발판): 잔해 위 x0~x1에 윗면 높이 y, 두께 t. 윗면 빛이 또렷하다 */
function slab(g: THREE.Group, x0: number, x1: number, y: number, t: number, z0: number, z1: number, pal: Pal, grain: Grain, seed: number): void {
  g.add(chunk(x0, x1, y - t, y, z0, z1, pal, grain, seed));
}

/** 드러난 뼈대 (철골·철근): x0~x1, y0~y1 사이 세로 부재 간격 step, 가새, 가로 띠. buckle이면 가운데가 dir 쪽으로 휜다 */
function skeleton(det: Details, x0: number, x1: number, y0: number, y1: number, z: number, pal: Pal, seed: number, opts: { step?: number; t?: number; buckle?: number; rebar?: boolean } = {}): void {
  const r = rng(seed);
  const step = opts.step ?? 8;
  const t = opts.t ?? 2;
  const col = opts.rebar ? PAL.concrete.frame : pal.frame;
  const lit = opts.rebar ? PAL.concrete.frameLit : pal.frameLit;
  const xs: number[] = [];
  for (let x = x0 + 1; x <= x1 - t; x += step) xs.push(x);
  if (xs[xs.length - 1] < x1 - t - 2) xs.push(x1 - t);
  const mid = (y0 + y1) / 2 + (r() - 0.5) * (y1 - y0) * 0.3;
  for (const [k, x] of xs.entries()) {
    const kink = opts.buckle ? opts.buckle * (0.6 + r() * 0.8) : 0;
    if (kink) {
      det.bar(x + t / 2, y0, x + t / 2 + kink, mid, t, z - 2, z, col);
      det.bar(x + t / 2 + kink, mid, x + t / 2, y1, t, z - 2, z, col);
      det.add(x + kink, x + kink + t, mid - 0.5, mid + 0.5, z - 2, z + 0.2, lit);
    } else {
      // 한두 개는 부러져 짧다 (끝이 휘었다)
      const broken = k > 0 && k < xs.length - 1 && r() < 0.3;
      const ym = broken ? y0 + (y1 - y0) * (0.3 + r() * 0.3) : y1;
      det.add(x, x + t, y0, ym, z - 2, z, col);
      det.add(x, x + 0.6, y0, ym, z - 0.4, z + 0.1, lit);
      if (broken) det.bar(x + t / 2, ym, x + t / 2 + (r() < 0.5 ? -5 : 5), ym + 4, 1, z - 2, z, lit);
    }
  }
  // 가로 띠 (철근은 촘촘히, 철골은 성기게), 가새 (철골만)
  const tie = opts.rebar ? 5 : 14;
  for (let y = y0 + tie / 2; y < y1 - 1; y += tie) if (r() < 0.75) det.add(x0, x1, y, y + (opts.rebar ? 0.6 : 1.2), z - 1.5, z - 0.5, col);
  if (!opts.rebar && !opts.buckle) {
    for (let k = 0; k + 1 < xs.length; k++) {
      if (r() < 0.35) continue;
      const a = xs[k] + t;
      const b = xs[k + 1];
      det.bar(a, y0 + 2, b, Math.min(y1, y0 + (b - a) * 1.2), 1.2, z - 2.5, z - 1.5, col);
    }
  }
}

/** 부러진 밑동 위로 삐죽 솟은 철골·철근 (꺾인 끝) */
function stubs(det: Details, x0: number, x1: number, y: number, z: number, pal: Pal, seed: number, rebar: boolean): void {
  const r = rng(seed);
  const n = Math.max(2, Math.round((x1 - x0) / (rebar ? 7 : 12)));
  for (let k = 0; k < n; k++) {
    const x = x0 + 2 + ((x1 - x0 - 4) * (k + r() * 0.6)) / n;
    const len = 4 + r() * (rebar ? 10 : 22);
    const a = (r() - 0.5) * 0.7;
    const t = rebar ? 1 : 2;
    const col = rebar ? PAL.concrete.frameLit : pal.frameLit;
    const mx = x + Math.sin(a) * len * 0.6;
    const my = y + Math.cos(a) * len * 0.6;
    det.bar(x, y - 3, mx, my, t, z - 2, z, rebar ? PAL.concrete.frame : pal.frame);
    // 끝은 더 꺾인다
    const b = a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.8);
    det.bar(mx, my, mx + Math.sin(b) * len * 0.4, my + Math.cos(b) * len * 0.4, t, z - 2, z, col);
  }
}

/** 깨진 이빨 (부러진 자리 위 들쭉날쭉한 남은 조각): x0~x1, 높이 y 위로 */
function teeth(det: Details, x0: number, x1: number, y: number, z0: number, z1: number, pal: Pal, seed: number): void {
  const r = rng(seed);
  for (let x = x0; x < x1; ) {
    const bw = 2 + Math.floor(r() * 6);
    if (r() < 0.55) {
      const bh = 1 + Math.floor(r() * 6);
      det.add(x, Math.min(x1, x + bw), y - 1, y + bh, z0, z1, pal.base);
      det.add(x, Math.min(x1, x + bw), y + bh - 0.6, y + bh, z0, z1, pal.lit);
    }
    x += bw;
  }
}

/** 경첩 조각: 월드 (hx, hy)를 축으로, len 길이(side 쪽으로 뻗는다) · 두께 t의 판. 그룹 원점이 경첩이다 */
function hingePiece(len: number, side: number, t: number, z0: number, z1: number, pal: Pal, grain: Grain, seed: number, rails: boolean): THREE.Group {
  const g = new THREE.Group();
  const a = side > 0 ? 0 : -len;
  const b = side > 0 ? len : 0;
  g.add(chunk(a, b, -t, 0, z0, z1, pal, grain, seed));
  if (rails) {
    const det = new Details();
    det.add(a, b, 13, 14, z1 - 1, z1, pal.frameLit);
    det.add(a, b, 6, 7, z1 - 1, z1, pal.frame);
    for (let x = a + 3; x < b; x += 14) det.add(x, x + 1, 0, 14, z1 - 1, z1, pal.frame);
    g.add(det.build(true));
  }
  return g;
}

/** 쌓인 컨테이너 색 (구조물마다, 위에서부터) */
const CRATE_COLORS: Record<string, readonly string[]> = {
  crate2: ['#6a3a26', '#2e4a52'],
  crate3: ['#17616a', '#844018', '#5a4a2a'],
  containers: ['#372860', '#844018', '#17616a', '#78452a'],
};

/** 컨테이너 한 칸 (원점 가운데, 길이 L, 높이 28, 깊이 z0~z1): 옆면 무늬·끝면 */
function container(L: number, z0: number, z1: number, color: string, seed: number, dent: boolean): THREE.Mesh {
  const side = paintContainer(Math.round(L), 28, color, seed);
  if (dent) {
    const g = side.getContext('2d') as CanvasRenderingContext2D;
    // 찌그러진 자국: 비스듬한 그늘 골과 빛 받는 테
    for (let k = 0; k < 14; k++) {
      rect(g, Math.round(L * 0.3) + k, 6 + Math.floor(k * 0.9), 2, 1, '#0e0c10');
      rect(g, Math.round(L * 0.3) + k + 1, 7 + Math.floor(k * 0.9), 1, 1, '#8a8a90');
    }
  }
  const end = paintContainer(30, 28, color, seed + 7);
  const front = litMaterial(pixelTexture(side), { nocut: true, emissive: pixelTexture(side), emissiveStrength: 0.08, wet: 0.5 });
  const endM = litMaterial(pixelTexture(end), { nocut: true, emissive: pixelTexture(end), emissiveStrength: 0.05 });
  return facedBox(-L / 2, L / 2, -14, 14, z0, z1, { pz: front, py: endM, px: endM, nx: endM, ny: endM });
}

/**
 * 구조물 조각 w가 stage(2 부분 파괴, 3 무너짐)일 때의 모양. hx·hy: 맞은 자리 (조각 왼쪽 아래 기준), dir: 맞은 방향.
 * sim의 새 발판(WRECK_FALL)과 같은 높이에 평평한 윗면을 둔다
 */
export function buildCollapse(w: Wreckable, stage: number, hx: number, hy: number, dir: number, seed: number): Collapse | null {
  const sp = SPEC[w.kind];
  if (!sp || stage < 2) return null;
  const out: Collapse = { cuts: [], group: new THREE.Group(), anims: [], dust: [], glow: [] };
  const det = new Details();
  const pal = PAL[sp.pal];
  const r = rng(seed);
  const [zb, zf] = sp.z;
  const W = w.x1 - w.x0;
  const ax = w.x0 + Math.max(0, Math.min(W, hx));
  const ay = w.y0 + hy;
  const cut = (x0: number, x1: number, yb: number, yt: number, jag = 3, slope = 0, z0 = zb, z1 = zf): void => {
    out.cuts.push({ x0, x1, yb, yt, z0, z1, slope, jag });
  };
  const g = out.group;
  const fall = (obj: THREE.Object3D, from: readonly [number, number, number], to: readonly [number, number, number], dur: number, delay = 0): void => {
    obj.position.set(to[0], to[1], 0);
    obj.rotation.z = to[2];
    g.add(obj);
    out.anims.push({ obj, from, to, dur, delay });
  };
  const grow = (obj: THREE.Object3D, base: number, dur: number, delay = 0): void => {
    obj.position.y = base;
    g.add(obj);
    out.anims.push({ obj, from: [0, base, 0], to: [0, base, 0], dur, delay, grow: true });
  };
  /** 잔해 더미를 따로 묶어 (바닥 base에서 자라 오른다) */
  const pile = (cx: number, pw: number, base: number, ph: number, z0: number, z1: number, steel: boolean, delay = 6): void => {
    const pd = new Details();
    rubble(pd, cx, pw, 0, ph, z0, z1, pal, seed + Math.round(cx), steel);
    const m = pd.build(true);
    grow(m, base, 26, delay);
    out.dust.push([cx, base, pw]);
  };
  const steelPal = sp.pal === 'brick' || sp.pal === 'rust' || sp.pal === 'steel' || sp.pal === 'crane' || sp.pal === 'green' || sp.pal === 'watch';

  switch (sp.type) {
    case 'tower': {
      const body0 = w.kind === 'hopper' ? 40 : 0;
      const H = w.kind === 'gatePier' ? 126 : w.kind === 'parkGate' ? D.park.fence.h + 10 : w.y1;
      const x0 = w.x0;
      const x1 = w.kind === 'parkGate' ? w.x0 + PARK_GATE_W : w.x1;
      const TW = x1 - x0;
      const rebar = sp.grain === 'concrete';
      if (stage === 2) {
        // 부분 파괴: 맞은 쪽 모서리가 크게 떨어져 나가 속이 움푹 드러난다 (속 벽, 뼈대), 밑에 잔해
        const side = hx < TW / 2 ? -1 : 1;
        const bw = Math.max(8, Math.round(TW * 0.46));
        const by = Math.max(body0 + 22, Math.min(H - 30, ay));
        const bx0 = side < 0 ? x0 - 4 : x1 - bw;
        const bx1 = side < 0 ? x0 + bw : x1 + 4;
        cut(bx0, bx1, by - 16, by + 22, 4);
        g.add(chunk(Math.max(x0 + 1, bx0 + 3), Math.min(x1 - 1, bx1 - 3), by - 20, by + 26, zb + 6, zf - 7, pal, sp.grain, seed, true));
        skeleton(det, Math.max(x0, bx0 + 2), Math.min(x1, bx1 - 2), by - 18, by + 24, zf - 4, pal, seed + 3, { step: rebar ? 4 : 9, t: rebar ? 1 : 2, rebar });
        pile(side < 0 ? x0 + 4 : x1 - 4, Math.max(24, bw + 16), 0, 9, zf - 18, zf - 2, !rebar);
        break;
      }
      // 무너짐: 위가 부러져 나가고 (밑동의 깨진 윗면이 새 발판), 떨어진 토막이 쓰러져 기댄다
      const top = WRECK_FALL.top[w.kind] ?? Math.round(H * 0.5);
      cut(x0 - 5, x1 + 5, top + 1, 2000, w.kind === 'parkGate' ? 2 : 6);
      g.add(chunk(x0 + 1, x1 - 1, top - 6, top, zb + 3, zf - 3, pal, sp.grain, seed, true));
      teeth(det, x0, x1, top, zf - 5, zf - 1, pal, seed + 5);
      stubs(det, x0 + 2, x1 - 2, top, zf - 6, pal, seed + 7, rebar);
      // 용광로 굴뚝·저탄 탑: 부러진 속에서 불씨가 탄다 (깨진 윗면 테두리가 붉게 빛난다)
      if (w.kind === 'stack' || w.kind === 'hopper') {
        embers(g, x0 + 3, x1 - 3, top + 0.5, zf - 2.5, seed + 31);
        out.glow.push([(x0 + x1) / 2, top + 4, zf + 6]);
      }
      // 떨어진 토막: 굴뚝은 왼쪽(화구·쇳물 도랑 반대쪽)으로 넘어져 밑동에 기댄다. 나머지는 맞은 쪽으로 쓰러져 눕는다
      const fd = w.kind === 'stack' ? -1 : dir < 0 ? -1 : 1;
      // 넘어간 반대쪽은 벽 한 조각이 계단처럼 들쭉날쭉 남는다 (부러진 실루엣: 평평하게 잘린 토막으로 읽히지 않게)
      if (TW >= 20) {
        const se = fd < 0 ? x1 : x0;
        const sd = fd < 0 ? -1 : 1;
        const w1 = Math.round(TW * 0.3);
        const w2 = Math.round(TW * 0.2);
        const h1 = Math.round(Math.min(46, (H - top) * 0.5) * (0.75 + r() * 0.25));
        const h2 = Math.round(h1 * (0.4 + r() * 0.2));
        const a0 = sd > 0 ? se : se - w1;
        g.add(chunk(a0, a0 + w1, top - 2, top + h1, zb + 2, zf - 1, pal, sp.grain, seed + 21));
        teeth(det, a0, a0 + w1, top + h1, zb + 4, zf - 2, pal, seed + 22);
        const b0 = sd > 0 ? se + w1 : se - w1 - w2;
        g.add(chunk(b0, b0 + w2, top - 2, top + h2, zb + 2, zf - 1, pal, sp.grain, seed + 23));
        teeth(det, b0, b0 + w2, top + h2, zb + 4, zf - 2, pal, seed + 24);
        // 끊겨 늘어진 쇠띠 (남은 벽 조각 끝에서 바깥으로 휘어 처진다)
        if (!rebar) det.bar(se, top + h1 - 6, se - sd * 16, top + h1 - 26, 3, zf - 3, zf, pal.frameLit);
        stubs(det, b0 + (sd > 0 ? w2 : 0) - 4, b0 + (sd > 0 ? w2 : 0) + 4, top + h2, zf - 2, pal, seed + 25, rebar);
      }
      const len = Math.min(H - top, w.kind === 'stack' ? 96 : 90);
      const thick = Math.round(TW * (w.kind === 'stack' ? 0.62 : 0.9));
      const piece = new THREE.Group();
      piece.add(chunk(-thick / 2, thick / 2, -len / 2, len / 2, w.kind === 'stack' ? -70 : zb, w.kind === 'stack' ? -30 : zf - 2, pal, sp.grain, seed + 11));
      const pd = new Details();
      teeth(pd, -thick / 2, thick / 2, -len / 2 - 3, (w.kind === 'stack' ? -34 : zf - 6), (w.kind === 'stack' ? -30 : zf - 2), pal, seed + 13);
      stubs(pd, -thick / 2 + 2, thick / 2 - 2, -len / 2 - 1, w.kind === 'stack' ? -30 : zf - 2, pal, seed + 17, rebar);
      piece.add(pd.build(true));
      const holder = new THREE.Group();
      holder.add(piece);
      const edge = fd < 0 ? x0 : x1;
      const lean = w.kind === 'stack' || w.kind === 'hopper';
      // 기대기: 아래 끝은 땅, 위 끝은 밑동 옆면 (각도 a, 세로에서). 눕기: 거의 수평
      const a = lean ? 0.62 : 1.42;
      const cx = lean ? edge + fd * (Math.sin(a) * len * 0.5 + thick * 0.5 * Math.cos(a) + 2) : edge + fd * (len * 0.5 + 6);
      const cy = lean ? Math.cos(a) * len * 0.5 + thick * 0.35 : thick * 0.5;
      fall(holder, [(x0 + x1) / 2, top + len / 2, 0], [cx, cy, fd * a], lean ? 34 : 28);
      pile(edge + fd * 10, Math.max(48, TW + 30), 0, Math.min(22, 8 + TW / 5), lean ? -52 : zb + 2, zf - 2, !rebar, 10);
      out.dust.push([edge + fd * len * 0.6, 0, len]);
      break;
    }
    case 'crates': {
      const cols = CRATE_COLORS[w.kind];
      const L = W - (w.kind === 'containers' ? 3 : 0);
      const H = w.y1;
      if (stage === 2) {
        // 맨 위 컨테이너가 맞은 쪽으로 밀려 비뚤게 걸리고 옆면이 찌그러진다
        cut(w.x0 - 4, w.x1 + 4, H - 28 + 0.5, H + 30, 0.5, 0, zb, zf);
        const c = container(L, zb + 2, zf - 0.6, cols[0], seed, true);
        const hold = new THREE.Group();
        hold.add(c);
        const dx = (dir < 0 ? -1 : 1) * 9;
        fall(hold, [(w.x0 + w.x1) / 2, H - 14, 0], [(w.x0 + w.x1) / 2 + dx, H - 14 + 1.5, -(dir < 0 ? -1 : 1) * 0.07], 14);
        break;
      }
      // 무너짐: 위 컨테이너(들)가 굴러떨어져 하나는 더미 옆에 비스듬히 기대고, 하나는 땅에 엎어진다
      const top = WRECK_FALL.top[w.kind] ?? H - 28;
      cut(w.x0 - 4, w.x1 + 4, top + 0.5, H + 30, 0.5, 0, zb, zf);
      const fd = w.kind === 'crate2' ? -1 : 1;
      const edge = fd < 0 ? w.x0 : w.x1;
      const n = Math.round((H - top) / 28);
      for (let k = 0; k < n; k++) {
        const c = container(L, zb + 4 + k * 6, zf - 2 - k * 4, cols[k % cols.length], seed + k * 3, true);
        const hold = new THREE.Group();
        hold.add(c);
        const from: [number, number, number] = [(w.x0 + w.x1) / 2, H - 14 - k * 28, 0];
        if (k === 0) {
          // 기대기: 아래 모서리가 땅, 윗끝이 남은 더미 옆면에 닿는다 (가로에서 a)
          const a = Math.min(1.05, Math.asin(Math.min(0.95, (top + 6) / L)));
          const foot = edge + fd * (Math.cos(a) * L + 1);
          const cx = (foot + edge) / 2 + fd * Math.sin(a) * 14;
          const cy = (Math.sin(a) * L) / 2 + Math.cos(a) * 14;
          fall(hold, from, [cx, cy, -fd * a], 30);
        } else {
          // 엎어진 것: 반대쪽 땅에 비스듬히 누웠다
          fall(hold, from, [w.x0 - fd * (L * 0.5 + 10) + (fd > 0 ? 0 : W), 14, fd * 0.05], 34, 6);
        }
      }
      // 남은 맨 위 컨테이너 지붕이 찌그러졌다 (빛 받는 구겨진 테)
      for (let x = w.x0 + 4; x < w.x1 - 4; x += 6 + Math.floor(r() * 5)) det.add(x, x + 3, top - 1.5, top + 0.4, zb + 4, zf - 1, r() < 0.5 ? '#8a8a90' : '#3a3a40');
      pile(edge + fd * 18, 40, 0, 6, zf - 30, zf - 4, true, 14);
      break;
    }
    case 'dock': {
      if (stage === 2) {
        // 턱 앞 모서리가 크게 깨져 나가 속 콘크리트가 움푹 드러나고, 깨진 덩어리가 앞에 떨어졌다
        const bx = Math.max(w.x0 + 18, Math.min(w.x1 - 18, ax));
        cut(bx - 18, bx + 18, 20, 60, 4, 0, -14, 0);
        g.add(chunk(bx - 16, bx + 16, 0, 26, -60, -12, pal, 'concrete', seed, true));
        skeleton(det, bx - 15, bx + 15, 6, 34, -9, pal, seed + 3, { step: 5, t: 1, rebar: true });
        const p = new THREE.Group();
        p.add(chunk(-9, 9, -5, 5, -10, -3, pal, 'concrete', seed + 4));
        fall(p, [bx, 32, 0], [bx + (dir < 0 ? -1 : 1) * 22, 4.5, (dir < 0 ? 1 : -1) * 0.18], 18);
        break;
      }
      // 무너짐: 위 판이 통째로 내려앉아 금 간 판들이 낮은 턱 위에 깔렸다 (새 발판), 앞으로 철근이 삐져나오고 계선주가 넘어졌다
      const top = WRECK_FALL.top.dock;
      cut(w.x0 - 3, w.x1 + 3, top + 1, 90, 3, 0, zb, zf);
      g.add(chunk(w.x0, w.x1, 0, top, zb + 1, zf - 3, pal, 'concrete', seed, true));
      for (let x = w.x0, k = 0; x < w.x1 - 6; k++) {
        const sw = 22 + Math.floor(r() * 26);
        const x1 = Math.min(w.x1, x + sw);
        slab(g, x + 1, x1 - 1, top + 2, 3, zb + 4, zf - 4, pal, 'concrete', seed + k * 5);
        x = x1;
      }
      stubs(det, w.x0 + 2, w.x1 - 2, top, zf - 3, pal, seed + 9, true);
      for (const [k, x] of [w.x0 + 22, w.x0 + 104, w.x1 - 30].entries()) {
        const p = new THREE.Group();
        p.add(chunk(-4, 4, -4, 4, -10, -4, PAL.steel, 'plate', seed + k));
        fall(p, [x + 4, 46, 0], [x + 4 + (k - 1) * 9, top + 6, 1.2 + k * 0.3], 22, k * 3);
      }
      pile((w.x0 + w.x1) / 2, W * 0.7, 0, 5, -12, -3, false, 4);
      break;
    }
    case 'cabin': {
      const H = w.y1;
      if (stage === 2) {
        // 지붕 한쪽이 꺾여 처지고 그 아래 벽이 떨어져 나갔다. 유리 조각
        const side = hx < W / 2 ? -1 : 1;
        const bw = Math.round(W * 0.4);
        const bx0 = side < 0 ? w.x0 - 4 : w.x1 - bw;
        const bx1 = side < 0 ? w.x0 + bw : w.x1 + 4;
        cut(bx0, bx1, H - 18, H + 16, 3);
        g.add(chunk(Math.max(w.x0 + 1, bx0 + 2), Math.min(w.x1 - 1, bx1 - 2), H - 22, H - 2, zb + 4, zf - 6, pal, 'concrete', seed, true));
        const hp = hingePiece(bw + 4, side, 3, zb - 2, zf, PAL.watch, 'plate', seed + 2, false);
        const hxp = side < 0 ? bx1 : bx0;
        fall(hp, [hxp, H, 0], [hxp, H, -side * 0.42], 16);
        for (let k = 0; k < 7; k++) {
          const x = (side < 0 ? w.x0 : w.x1) + side * (r() * 18);
          det.add(x, x + 1 + Math.floor(r() * 2), 0, 0.6, zf - 8 + r() * 6, zf - 6 + r() * 6, '#b8dce8');
        }
        break;
      }
      // 무너짐: 지붕과 벽 위쪽이 무너져 내려 기둥 둘만 삐죽 남고, 지붕 판이 속 잔해 위에 비스듬히 얹혔다
      const top = WRECK_FALL.top[w.kind] ?? Math.round(H * 0.45);
      cut(w.x0 - 4, w.x1 + 6, top + 1, H + 40, 4);
      g.add(chunk(w.x0 + 1, w.x1 - 1, 0, top, zb + 3, zf - 5, pal, 'concrete', seed, true));
      for (const [k, x] of [w.x0, w.x1 - 4].entries()) {
        const ph = 8 + Math.floor(r() * 12);
        g.add(chunk(x, x + 4, top - 2, top + ph, zf - 6, zf - 1, PAL.watch, 'plate', seed + k + 3));
      }
      const roof = new THREE.Group();
      roof.add(chunk(-W / 2 - 2, W / 2 + 2, -2, 2, zb + 2, zf - 2, PAL.watch, 'plate', seed + 6));
      fall(roof, [(w.x0 + w.x1) / 2, H, 0], [(w.x0 + w.x1) / 2 + dir * 4, top + 2, -dir * 0.12], 20);
      teeth(det, w.x0, w.x1, top, zf - 5, zf - 1, pal, seed + 8);
      for (let k = 0; k < 10; k++) {
        const x = w.x0 - 10 + r() * (W + 20);
        det.add(x, x + 1 + Math.floor(r() * 2), 0, 0.6, zf - 10 + r() * 8, zf - 8 + r() * 8, '#b8dce8');
      }
      pile((w.x0 + w.x1) / 2 + dir * 10, W + 20, 0, 7, zf - 14, zf - 2, false, 8);
      break;
    }
    case 'bags': {
      const H = w.y1;
      const bag = (x: number, y: number, a: number, z: number): void => {
        const p = new THREE.Group();
        p.add(chunk(-5, 5, -2.5, 2.5, z - 8, z, pal, 'bags', seed + Math.round(x)));
        fall(p, [x, H - 3, 0], [x, y + 2.5, a], 14 + Math.floor(r() * 10), Math.floor(r() * 6));
      };
      if (stage === 2) {
        const side = hx < W / 2 ? -1 : 1;
        const bw = Math.round(W * 0.42);
        cut(side < 0 ? w.x0 - 4 : w.x1 - bw, side < 0 ? w.x0 + bw : w.x1 + 4, H - 12, H + 10, 3);
        for (let k = 0; k < 4; k++) bag((side < 0 ? w.x0 - 6 : w.x1 + 6) + side * k * 8 + r() * 3, 0, (r() - 0.5) * 0.5, zf - 4);
        break;
      }
      const top = WRECK_FALL.top.sandbags;
      cut(w.x0 - 4, w.x1 + 4, top + 1, H + 12, 3);
      for (let k = 0; k < 9; k++) {
        const left = k % 2 === 0;
        bag(left ? w.x0 - 6 - r() * 26 : w.x1 + 6 + r() * 26, 0, (r() - 0.5) * 0.7, zf - 2 - r() * 10);
      }
      // 터진 자루에서 쏟아진 모래 (낮고 밝은 더미)
      pile((w.x0 + w.x1) / 2, W + 30, 0, 5, zf - 12, zf - 2, false, 4);
      break;
    }
    case 'deck': {
      const h = w.y1 - 4;
      const dep = sp.dep ?? 6;
      const abv = sp.abv ?? 14;
      const t = sp.thick ?? 4;
      const base = w.kind === 'dockAwning' ? 40 : 0;
      if (stage === 2) {
        // 부분 파괴: 맞은 자리 아래가 뜯겨 나가고 찢긴 판과 끊긴 줄이 늘어진다. 밑에 떨어진 부스러기
        const nx = Math.max(w.x0 + 14, Math.min(w.x1 - 14, ax));
        cut(nx - 12, nx + 12, h - dep - 2, h - Math.max(1, t * 0.45), 3);
        const hp = hingePiece(14 + Math.floor(r() * 6), 1, 2, zb + 2, zf - 1, pal, sp.grain, seed, false);
        fall(hp, [nx - 11, h - t, 0], [nx - 11, h - t, -1.15], 14);
        det.add(nx + 6, nx + 7, h - t - 18 - r() * 10, h - t, zf - 3, zf - 2, pal.frame);
        pile(nx, 26, base, 5, zb + 6, zb + 30, steelPal, 8);
        break;
      }
      // 무너짐: 조각 가운데가 꺾여 양쪽이 끝에 매달린 채 아래로 처진다. 끝은 밑에 쌓인 잔해에 닿고, 떨어진 판이 잔해 위 새 발판이 된다
      const fallSpec = WRECK_FALL.deck[w.kind];
      const stub = fallSpec?.stub ?? 0;
      const rest = fallSpec?.rest ?? -1;
      const gx0 = w.x0 + stub;
      const gx1 = w.x1 - stub;
      if (w.kind === 'ring') {
        // 굴뚝 둘레 작업대: 앞 테만 잘리고, 굴뚝 양옆 날개가 굴뚝 쪽을 축으로 처진다
        const s0 = 160;
        const s1 = 224;
        cut(w.x0 - 4, w.x1 + 4, h - dep - 2, h + abv, 3, 0, -3.6, -1.4);
        cut(w.x0 - 4, s0, h - dep - 2, h + abv, 3, 0, zb, zf);
        cut(s1, w.x1 + 4, h - dep - 2, h + abv, 3, 0, zb, zf);
        const L = hingePiece(s0 - w.x0, -1, t, zb + 2, zf - 1, pal, sp.grain, seed, true);
        fall(L, [s0, h, 0], [s0, h, 0.95], 22);
        const R = hingePiece(w.x1 - s1, 1, t, zb + 2, zf - 1, pal, sp.grain, seed + 1, true);
        fall(R, [s1, h, 0], [s1, h, -0.8], 24, 3);
        pile(w.x0 + 4, 30, 0, 8, -40, -6, true, 12);
        pile(w.x1 - 4, 30, 0, 8, -40, -6, true, 14);
        break;
      }
      cut(gx0, gx1, h - dep - 2, h + abv, 3);
      const mid = Math.max(gx0 + 24, Math.min(gx1 - 24, ax));
      const Ll = mid - gx0 - 2;
      const Lr = gx1 - mid - 2;
      const restTop = rest > 0 ? rest + 2 : -1;
      const angle = (L: number, k: number): number => {
        if (restTop > 0) return Math.min(1.25, Math.asin(Math.max(0.05, Math.min(0.97, (h - restTop - t * 0.5) / L))));
        return 0.95 + k * 0.25;
      };
      const al = angle(Ll, 0);
      const ar = angle(Lr, 1);
      const left = hingePiece(Ll, 1, t, zb + 1, zf - 1, pal, sp.grain, seed, !!sp.rails);
      fall(left, [gx0, h, 0], [gx0, h, -al], 22);
      const right = hingePiece(Lr, -1, t, zb + 1, zf - 1, pal, sp.grain, seed + 1, !!sp.rails);
      fall(right, [gx1, h, 0], [gx1, h, ar], 24, 4);
      // 끊긴 자리: 경첩 위로 휘어진 철골이 삐죽
      stubs(det, gx0 - 3, gx0 + 3, h, zf - 1, pal, seed + 3, false);
      stubs(det, gx1 - 3, gx1 + 3, h, zf - 1, pal, seed + 4, false);
      if (rest > 0) {
        // 밑 잔해와 그 위 떨어진 판 (sim 새 발판: 조각 가운데 restW 폭, 높이 rest)
        const half = Math.round((W * WRECK_FALL.restW) / 2);
        const cx = Math.round((w.x0 + w.x1) / 2);
        const pz0 = Math.max(zb, -60);
        const pz1 = Math.min(zf, -4);
        pile(cx, Math.min(W * 0.9, half * 2 + 50), base, rest - base - 3, pz0, pz1, steelPal, 10);
        const sl = new THREE.Group();
        slab(sl, -half, half, 0, 4, pz0 + 2, pz1 - 1, pal, sp.grain, seed + 9);
        fall(sl, [cx, h, 0], [cx, rest, (r() - 0.5) * 0.02], 26, 2);
      } else {
        pile((gx0 + gx1) / 2, (gx1 - gx0) * 0.7, base, 12, Math.max(zb, -60), Math.min(zf, -4), steelPal, 12);
      }
      if (w.kind === 'rail') {
        // 레일 둘은 끊기지 않고 휘어 처진다 (경첩 끝에서 끝까지)
        const lx = gx0 + Math.cos(al) * Ll;
        const ly = h - Math.sin(al) * Ll + 3;
        const rx = gx1 - Math.cos(ar) * Lr;
        const ry = h - Math.sin(ar) * Lr + 3;
        const sag = Math.min(ly, ry) - 10;
        for (const z of [-48, -18]) {
          det.bar(lx, ly, (lx + rx) / 2, sag, 2, z - 2, z, '#5a5a62');
          det.bar((lx + rx) / 2, sag, rx, ry, 2, z - 2, z, '#5a5a62');
        }
      }
      out.dust.push([(gx0 + gx1) / 2, base, gx1 - gx0]);
      break;
    }
    case 'leg': {
      // 기둥: 겉(강판·콘크리트)이 떨어져 나가 속 뼈대가 드러난다. 무너지면 드러난 자리가 길어지고 뼈대가 휜다 (그래도 서 있다)
      const half = stage >= 3 ? 26 : 12;
      const lo = w.y0 + 8;
      const hi = w.y1 - 8;
      const cy = Math.max(lo + half, Math.min(hi - half, ay));
      const y0 = cy - half;
      const y1 = cy + half;
      const rebar = sp.grain === 'concrete' && w.kind !== 'watchCabin';
      cut(w.x0 - 2, w.x1 + 2, y0, y1, 3);
      if (w.kind === 'watchCabin') {
        // 초소 벽이 날아가 속(어두운 방)과 모서리 기둥이 드러난다
        g.add(chunk(w.x0 + 3, w.x1 - 3, y0 - 2, y1 + 2, zb + 4, zf - 8, pal, 'concrete', seed, true));
        skeleton(det, w.x0, w.x1, y0 - 2, y1 + 2, zf - 2, PAL.watch, seed + 1, { step: Math.round((w.x1 - w.x0) / 3), t: 3, buckle: stage >= 3 ? dir * 3 : 0 });
      } else {
        skeleton(det, w.x0, w.x1, y0 - 3, y1 + 3, zf - 1, pal, seed + 1, {
          step: rebar ? 3 : Math.max(3, w.x1 - w.x0 - 3), t: rebar ? 1 : 2, rebar, buckle: stage >= 3 ? dir * (rebar ? 2 : 4) : 0,
        });
      }
      pile((w.x0 + w.x1) / 2, Math.max(22, (w.x1 - w.x0) * 3), 0, stage >= 3 ? 8 : 5, zb, zf - 1, !rebar, 4);
      break;
    }
    case 'statue': {
      // 동상: 부분 파괴면 든 팔과 머리가 부러져 나가고, 무너지면 허리부터 위가 꺾여 받침대 옆으로 떨어진다
      const x = w.x0;
      if (stage === 2) {
        cut(x + 18, x + 40, 96, 130, 2);
        const p = new THREE.Group();
        p.add(chunk(-6, 6, -3, 3, -46, -40, pal, 'concrete', seed));
        fall(p, [x + 28, 108, 0], [x + 56, 3, 1.3], 24);
        break;
      }
      cut(x - 2, x + 50, 72, 130, 3);
      const p = new THREE.Group();
      p.add(chunk(-7, 7, -18, 18, -46, -36, pal, 'concrete', seed));
      p.add(chunk(-4, 4, 18, 26, -45, -37, pal, 'concrete', seed + 1));
      fall(p, [x + 22, 92, 0], [x + 70, 8, -1.45], 30);
      pile(x + 62, 34, 0, 6, -40, -30, false, 8);
      break;
    }
  }
  if (!det.empty) g.add(det.build(true));
  return out;
}

/** 움직임 하나를 since 틱(무너진 뒤 지난 틱)에 맞춰 놓는다. 떨어지는 것은 중력처럼 빨라지고 끝에서 살짝 튄다 */
export function applyAnim(a: Anim, since: number): void {
  const u = Math.max(0, Math.min(1, (since - a.delay) / a.dur));
  if (a.grow) {
    const k = u * u * (3 - 2 * u);
    a.obj.scale.y = Math.max(0.001, k);
    a.obj.visible = u > 0;
    return;
  }
  // 낙하: u²로 빨라지다가 닿는 순간 아주 작게 되튄다
  const p = u * u;
  const bounce = u >= 1 ? Math.max(0, Math.sin(Math.min(1, (since - a.delay - a.dur) / 10) * Math.PI)) * 0.06 * (1 - Math.min(1, (since - a.delay - a.dur) / 10)) : 0;
  const k = p - bounce;
  a.obj.position.x = a.from[0] + (a.to[0] - a.from[0]) * k;
  a.obj.position.y = a.from[1] + (a.to[1] - a.from[1]) * k;
  a.obj.rotation.z = a.from[2] + (a.to[2] - a.from[2]) * Math.min(1, u * (2 - u) * 0.3 + p * 0.7);
}
