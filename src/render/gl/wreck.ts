import * as THREE from 'three';
import type { WreckState } from '../../sim';
import { CITADEL as D } from '../../data/stages/citadel';
import { WRECKS, type Wreckable, type WreckMat } from '../../stage/citadel';
import { canvas, hash, rect } from '../dither';
import { COLORS as C } from '../palette';
import { Puffs, Sparks } from './fx';
import { Details, plane } from './kit';
import { lightPool } from './lights';
import { litMaterial, pixelTexture } from './shaders';
import { buildStreetProp } from './street';

/**
 * 구조물 손상의 2.5D 모습 (렌더 전용, 2026-11-02 파괴 범위 확대). 단계는 sim(state.wreck)이 정하고, 여기서는 모습만 바꾼다.
 * - 구조물(굴뚝·크레인·컨테이너·고가 철도·문기둥·동상…): 정면 앞에 재질별 손상 판을 덧댄다.
 *   1단계 금(맞은 자리에서 계단처럼 갈라지는 금, 떨어진 모서리), 2단계 부분 파괴(구멍 속 어둠, 드러난 철근·찢긴 강판·깨진 유리,
 *   구멍 윗변은 빛 받은 깨진 단면), 3단계 무너짐(넓게 뚫리고 그을림, 구멍 속 불씨). 밑에는 잔해 더미가 쌓인다.
 *   발판·벽은 sim에서 그대로라, 윗면·옆면 뼈대는 남기고 정면이 부서진 모습으로 그린다.
 * - 거리 소품: 금·찌그러짐과 함께 맞은 쪽으로 기울고, 부서지면 부서진 모습(쓰러진 드럼통·흩어진 판자·넘어진 우체통…)으로 바꿔 낀다.
 * - 남는 효과: 무너진 뒤 한동안 연기, 강철은 불꽃이 떨어지고, 벽돌·나무는 구멍 속 불씨가 빛난다. 붙어 있던 등은 깜빡이다 꺼진다.
 * 무대 규칙: 외곽선 없음 (금은 어두운 틈, 깨진 단면은 빛 받는 윗변 1px), 디더는 그을음 가장자리 2px에만.
 */

/** 구조물 정면 깊이 (render/gl/outskirts.ts·edges.ts·plaza.ts의 정면 판 자리) */
const FACE_Z: Record<string, number> = {
  stack: -4, hopper: -4, crate2: -0.6, crate3: -0.6, dock: -2, booth: -6, sandbags: -6,
  ring: -2, catwalk: -4, crane: -14, craneLow: -20, dockAwning: -6, rail: -2, stairs: -10, watch: -16, watchRoof: -16,
  catwalkLeg: -16, craneLeg: -18, railLeg: -24, watchLeg: -16, watchCabin: -20,
  containers: -0.6, gatePier: -0.6, statue: -32, checkpoint: -20, parkGate: -0.6,
  crates: -34, mailbox: -26, barrel: -26, bench: -30, planter: -28, posterboard: -34,
};

interface Tone {
  /** 구멍 속 어둠(가장 속), 그 바깥 한 칸(inner), 구멍 가장자리 그늘, 깨진 단면(빛 받는 윗변), 금, 그을음 */
  dark: string;
  inner: string;
  shade: string;
  scorch: string;
  rim: string;
  crack: string;
  /** 잔해 덩어리 색 (어두운 것 → 밝은 것) */
  bits: readonly string[];
  /** 구멍 속에 드러나는 것 (철근·뼈대) */
  bone?: string;
  /** 구멍 속 불씨 */
  ember?: boolean;
}

const TONES: Record<WreckMat, Tone> = {
  brick: { dark: '#0c0a0e', inner: '#1a1416', shade: '#2a2022', scorch: '#1e181a', rim: '#7a625a', crack: '#141014', bits: ['#2e2426', '#4a3634', '#5e4440', '#7a625a'], bone: '#2a2224', ember: true },
  concrete: { dark: '#0a0a0e', inner: '#18181c', shade: '#2a2a2e', scorch: '#1c1c20', rim: '#8a867e', crack: '#121216', bits: ['#2a2a2e', '#44423e', '#5e5a54', '#8a867e'], bone: '#6a4030' },
  steel: { dark: '#08080c', inner: '#16161c', shade: '#26262e', scorch: '#1a1a20', rim: '#a8a8ae', crack: '#101014', bits: ['#1e1e24', '#34343a', '#55555c', '#a8a8ae'], bone: '#3a3a40' },
  sheet: { dark: '#0a0a0c', inner: '#18181a', shade: '#28282a', scorch: '#1c1c1e', rim: '#9a9488', crack: '#121214', bits: ['#26262a', '#3e3c38', '#5e5a50', '#9a9488'] },
  glass: { dark: '#06080c', inner: '#121a20', shade: '#1e2a32', scorch: '#18222a', rim: '#d8eef4', crack: '#7aa8b8', bits: ['#3a5864', '#7aa8b8', '#b8dce8', '#e8f6fa'], bone: '#2a2c32' },
  wood: { dark: '#0e0a08', inner: '#1c1410', shade: '#2c2018', scorch: '#1e1612', rim: '#a07a52', crack: '#160f0c', bits: ['#2e2018', '#4e3626', '#6a4a32', '#a07a52'], bone: '#4e3626', ember: true },
  sand: { dark: '#16130e', inner: '#221e16', shade: '#3a3226', scorch: '#2a2418', rim: '#9a8a66', crack: '#3a3226', bits: ['#3a3226', '#5a5040', '#7a6c52', '#9a8a66'] },
  stone: { dark: '#0c0c10', inner: '#1a1a1e', shade: '#2c2c30', scorch: '#1e1e22', rim: '#9a968e', crack: '#141418', bits: ['#2c2c30', '#4a4844', '#6a6660', '#9a968e'], bone: '#3a3836' },
};

const EMBER = ['#ff9a4a', '#ff6a2a', '#c8401e'];

/** 렌더 전용 고정 난수 (구조물 번호·단계마다 같은 그림) */
function rng(seed: number): () => number {
  let n = seed * 7919 + 13;
  return () => hash(n++ * 2654435761);
}

/** 8방향 (오른쪽부터 시계 방향, 화면 y는 아래가 +) */
const DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** 정면 판의 두께 (판·들보: 윗면에서 아래로 몇 px이 실제 앞면인가. 판정 상자보다 얇다) */
const THICK: Record<string, number> = { ring: 4, catwalk: 4, crane: 14, craneLow: 7, dockAwning: 6, rail: 14, stairs: 4, watch: 4, watchRoof: 4 };

/**
 * 손상 판을 칠할 띠 (월드: x0~x1, 바닥에서 y0~y1). 판정 상자 가운데 실제로 앞면이 있는 곳만 (동상 둘레 공기·등롱·판 아래 빈 곳에 칠하지 않게).
 * hang: 무너진 얇은 들보 아래로 매달린 조각을 그릴 여유
 */
export function paintBand(w: Wreckable, stage: number): { y0: number; y1: number; hang: number } {
  const t = THICK[w.kind];
  if (t !== undefined) {
    const top = w.y1 - 4;
    return { y0: top - t, y1: top, hang: stage >= 3 ? 22 : 0 };
  }
  if (w.kind === 'hopper') return { y0: 40, y1: w.y1, hang: 0 };
  if (w.kind === 'statue') return { y0: 0, y1: 44, hang: 0 };
  if (w.kind === 'gatePier') return { y0: 0, y1: 120, hang: 0 };
  return { y0: w.y0, y1: w.y1, hang: 0 };
}

/**
 * 손상 판 그림: 구조물 정면 띠(paintBand) 크기(화면 1px = 월드 1px), 단계, 맞은 자리(구조물 왼쪽 아래 기준 hx·hy).
 * map: 투명 바탕(구멍·금만 칠함), glow: 불씨 (스스로 빛남). 판 아래로 hang px만큼 매달린 조각 자리가 있다
 */
export function paintWreck(w: Wreckable, stage: number, hx: number, hy: number, seed: number): { map: HTMLCanvasElement; glow: HTMLCanvasElement; ember: boolean } {
  const band = paintBand(w, stage);
  const W = w.x1 - w.x0;
  const FH = band.y1 - band.y0;
  const H = FH + band.hang;
  const [c, g] = canvas(W, H);
  const [e, eg] = canvas(W, H);
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, W, H);
  const T = TONES[w.mat];
  const r = rng(seed);
  // 맞은 자리 (그림 좌표: 위가 0, 띠 안으로)
  const ix = Math.max(1, Math.min(W - 2, hx));
  const iy = Math.max(1, Math.min(FH - 2, band.y1 - (w.y0 + hy)));
  const hole = new Uint8Array(W * H);
  const inFace = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < FH;
  const dot = (x: number, y: number, col: string) => {
    if (inFace(x, y) && !hole[y * W + x]) rect(g, x, y, 1, 1, col);
  };
  const minSide = Math.min(W, FH);
  const area = W * FH;
  const thin = FH < 18;
  // 그리지 않는 아래 띠 (용광로 굴뚝 밑동 화구: 구간 주인공 빛을 덮지 않는다)
  const keepBottom = w.kind === 'stack' ? 60 : 0;
  // 금: 같은 길이 계단으로 꺾이며 뻗는다 (2~4칸씩 같은 방향), 가끔 갈라진다
  const crack = (x: number, y: number, len: number, d: number, depth: number): void => {
    let cx = x;
    let cy = y;
    let dir = d;
    let left = len;
    while (left > 0) {
      const seg = 2 + Math.floor(r() * 3);
      const [dx, dy] = DIRS[dir];
      for (let k = 0; k < seg && left > 0; k++, left--) {
        cx += dx;
        cy += dy;
        if (!inFace(cx, cy)) return;
        dot(cx, cy, T.crack);
      }
      const nd = (dir + (r() < 0.5 ? 1 : 7)) % 8;
      dir = nd === (d + 1) % 8 || nd === (d + 7) % 8 || nd === d ? nd : d;
      if (depth < 2 && r() < 0.22) crack(cx, cy, Math.floor(left * 0.6), (dir + (r() < 0.5 ? 1 : 7)) % 8, depth + 1);
    }
  };
  // 구멍: 들쭉날쭉하고 길쭉한 덩어리 (벽돌·돌은 줄눈 칸에 맞춰 계단처럼 떨어진다)
  const blob = (cx: number, cy: number, rad: number): void => {
    const snapX = w.mat === 'brick' ? 4 : w.mat === 'stone' ? 6 : 2;
    const snapY = w.mat === 'brick' ? 3 : w.mat === 'stone' ? 4 : 2;
    const sx = 0.6 + r() * 1.1;
    const sy = 0.6 + r() * 0.8;
    const tilt = (r() - 0.5) * 1.2;
    const R = Math.ceil(rad * 1.8 + 2);
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (!inFace(x, y)) continue;
      const qx = Math.floor(x / snapX) * snapX;
      const qy = Math.floor(y / snapY) * snapY;
      const n = hash((qx * 73856093) ^ (qy * 19349663) ^ (seed * 83492791));
      const u = (qx + snapX / 2 - cx) / sx;
      const v = (qy + snapY / 2 - cy) / sy;
      const d = Math.hypot(u + v * tilt, v);
      if (d < rad * (0.55 + n * 0.75)) hole[y * W + x] = 1;
    }
  };
  // 1단계: 맞은 자리에서 사방으로 금. 큰 면일수록 길게
  const crackN = 3 + Math.min(4, Math.floor(area / 1600)) + (stage - 1) * 2;
  const crackLen = Math.max(6, Math.min(48, Math.round(Math.sqrt(area) * 0.45)));
  if (w.mat !== 'sand') for (let k = 0; k < crackN; k++) crack(ix, iy, Math.round(crackLen * (0.5 + r() * 0.7)), Math.floor(r() * 8), 0);
  // 1단계에도 모서리 하나가 깨져 나간다 (벽돌·돌·콘크리트)
  if ((w.mat === 'brick' || w.mat === 'stone' || w.mat === 'concrete') && minSide >= 10) blob(r() < 0.5 ? 0 : W - 1, Math.floor(r() * FH), Math.max(2, minSide * 0.1));
  // 얇은 판·들보: 2단계부터 맞은 자리가 끊긴다 (위아래로 지나는 들쭉날쭉한 틈)
  const snaps: number[] = [];
  if (thin && stage >= 2) {
    snaps.push(ix);
    if (stage >= 3 && W > 60) snaps.push(Math.floor(W * (0.15 + r() * 0.7)));
    for (const sxp of snaps) for (let y = 0; y < FH; y++) {
      const off = Math.round((hash(y * 31 + sxp + seed) - 0.5) * 3);
      const gw = stage >= 3 ? 3 : 2;
      for (let k = 0; k < gw; k++) if (inFace(sxp + off + k, y)) hole[y * W + sxp + off + k] = 1;
    }
  } else if (stage >= 2) {
    // 부분 파괴: 맞은 자리에 큰 구멍 하나와 둘레에 제각각인 작은 구멍들
    const soft = w.mat === 'steel' || w.mat === 'sheet' ? 0.65 : 1;
    const big = Math.max(2, Math.min(13, minSide * (stage >= 3 ? 0.28 : 0.2) * soft));
    blob(ix, iy, big);
    const n = Math.min(3, Math.floor(area / 3000)) + (stage >= 3 ? 2 : 0);
    for (let k = 0; k < n; k++) blob(Math.floor(r() * W), Math.floor(r() * FH), Math.max(1.5, big * (0.25 + r() * 0.4)));
    // 무너짐: 높은 것은 위쪽이 뜯긴다 (위로 갈수록 큰 구멍이 이어진다)
    if (stage >= 3 && FH > W) for (let y = Math.floor(FH * 0.06); y < FH * 0.5; y += 14 + Math.floor(r() * 12)) blob(Math.floor(W * (0.2 + 0.6 * r())), y, Math.max(2, Math.min(10, W * 0.2)));
  }
  if (keepBottom) for (let y = FH - keepBottom; y < FH; y++) for (let x = 0; x < W; x++) hole[y * W + x] = 0;
  // 그을음 (3단계): 구멍 위쪽으로 3px 그을린 면 (연기는 위로 오른다). 넓은 바둑판 없이 한 색
  if (stage >= 3 && w.mat !== 'glass' && w.mat !== 'sand') {
    for (let y = 0; y < FH - keepBottom; y++) for (let x = 0; x < W; x++) {
      if (hole[y * W + x]) continue;
      let soot = false;
      for (let k = 1; k <= 3 && !soot; k++) if (y + k < FH && hole[(y + k) * W + x]) soot = k <= 1 || hash(x * 7 + y * 13 + seed) < 0.55;
      if (soot) rect(g, x, y, 1, 1, T.scorch);
    }
  }
  // 구멍 칠하기: 가장자리 한 칸은 깨진 면(그늘), 속은 어둠. 윗변 위 1px은 빛 받은 깨진 단면, 아래 턱 1px은 조금 밝다
  let ember = false;
  for (let y = 0; y < FH; y++) for (let x = 0; x < W; x++) {
    if (!hole[y * W + x]) continue;
    let edge = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!inFace(x + dx, y + dy) || !hole[(y + dy) * W + x + dx]) edge = true;
    rect(g, x, y, 1, 1, edge ? T.shade : T.dark);
    if (y > 0 && !hole[(y - 1) * W + x]) rect(g, x, y - 1, 1, 1, T.rim);
    if (y < FH - 1 && !hole[(y + 1) * W + x]) rect(g, x, y, 1, 1, T.bits[1]);
  }
  // 구멍 속에 드러난 것: 콘크리트는 철근, 강철은 속 뼈대, 유리는 남은 창틀, 나무는 부러진 살 (속 칸에만)
  if (stage >= 2 && T.bone && !thin) {
    const step = w.mat === 'concrete' ? 5 : w.mat === 'glass' ? 8 : 7;
    for (let y = 1; y < FH - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!hole[y * W + x] || !hole[(y - 1) * W + x] || !hole[(y + 1) * W + x]) continue;
      if ((x % step === 2 && hash(x * 31 + seed) < 0.7) || (y % step === 3 && hash(y * 17 + seed) < 0.5)) rect(g, x, y, 1, 1, T.bone);
    }
  }
  // 무너진 얇은 들보: 끊긴 자리에서 아래로 꺾여 매달린 조각 (빛 받는 윗변, 끝은 들쭉날쭉)
  if (band.hang && snaps.length) {
    snaps.forEach((sxp, k) => {
      const dir = k % 2 === 0 ? 1 : -1;
      const len = Math.min(band.hang + FH - 2, 10 + Math.floor(r() * 14));
      const thick = Math.max(2, Math.min(4, FH - 1));
      for (let t = 0; t < len; t++) {
        // 1-1-1 계단 대각선 (같은 길이 계단)
        const x0 = sxp + dir * (3 + Math.floor(t / 2));
        const y0 = Math.floor(FH / 2) + t;
        for (let q = 0; q < thick; q++) {
          const xx = x0 + dir * q;
          if (xx < 0 || xx >= W || y0 >= H) continue;
          rect(g, xx, y0, 1, 1, q === 0 ? T.bits[3] : T.bits[1 + (q % 2)]);
        }
      }
    });
  }
  // 유리: 맞은 자리에서 뻗는 깨진 결 (밝은 줄)
  if (w.mat === 'glass') {
    const n = 6 + stage * 4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r();
      const len = 3 + r() * minSide * 0.4;
      for (let t = 2; t < len; t++) dot(Math.round(ix + Math.cos(a) * t), Math.round(iy + Math.sin(a) * t), t % 3 === 0 ? T.rim : T.crack);
    }
  }
  // 모래주머니: 터진 자루에서 모래가 흘러내린 자국 (아래로 길게)
  if (w.mat === 'sand') {
    for (let k = 0; k < 2 + stage * 2; k++) {
      const x = Math.floor(r() * W);
      const y0 = Math.floor(r() * FH * 0.6);
      for (let y = y0; y < FH; y++) rect(g, x, y, 1 + (k % 2), 1, k % 3 ? T.rim : T.bits[2]);
    }
  }
  // 강철: 찌그러진 자국 (위쪽 테 그늘, 아래쪽 테 빛. 속은 칠하지 않는다)
  if ((w.mat === 'steel' || w.mat === 'sheet') && !thin) {
    for (let k = 0; k < 1 + stage; k++) {
      const cx = k === 0 ? ix : Math.floor(r() * W);
      const cy = k === 0 ? iy : Math.floor(r() * FH);
      const rx = Math.max(2, Math.min(7, minSide * 0.18));
      const ry = Math.max(1, rx * 0.55);
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const u = (x - cx) / rx;
        const dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - u * u)));
        dot(x, Math.round(cy - dy), T.shade);
        dot(x, Math.round(cy + dy), T.rim);
      }
    }
  }
  // 불씨 (3단계, 벽돌·나무): 구멍 아랫변 몇 칸이 스스로 빛난다
  if (stage >= 3 && T.ember) {
    for (let y = 1; y < FH; y++) for (let x = 0; x < W; x++) {
      if (!hole[(y - 1) * W + x] || hole[y * W + x]) continue;
      if (hash(x * 131 + y * 71 + seed) < 0.28) {
        const col = EMBER[Math.floor(hash(x + y * 3 + seed) * 3)];
        rect(g, x, y - 1, 1, 1, col);
        rect(eg, x, y - 1, 1, 1, col);
        ember = true;
      }
    }
  }
  return { map: c, glow: e, ember };
}

/** 잔해 더미 그림 (폭 w, 높이 h): 가운데가 높은 언덕에 크고 작은 덩어리. 덩어리 윗변이 빛을 받는다 */
export function paintRubble(mat: WreckMat, w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const T = TONES[mat];
  const r = rng(seed + 991);
  const top = (x: number) => {
    const u = (x + 0.5) / w;
    const hill = Math.sin(u * Math.PI) ** 0.7;
    return Math.round(h - hill * h * (0.75 + 0.25 * hash(Math.floor(x / 3) * 977 + seed)));
  };
  for (let x = 0; x < w; x++) {
    const t = top(x);
    if (t >= h) continue;
    rect(g, x, t, 1, h - t, T.bits[0]);
  }
  // 덩어리 (큰 것부터: 큰 콘크리트 판, 작은 부스러기)
  const n = Math.round((w * h) / 26);
  for (let k = 0; k < n; k++) {
    const x = Math.floor(r() * w);
    const t = top(Math.min(w - 1, x));
    if (t >= h - 1) continue;
    const bw = mat === 'sand' ? 3 : 2 + Math.floor(r() * (k < n / 4 ? 6 : 3));
    const bh = mat === 'glass' ? 1 : 1 + Math.floor(r() * (k < n / 4 ? 4 : 2));
    const y = t + Math.floor(r() * Math.max(1, h - t - bh));
    const col = T.bits[1 + Math.floor(r() * 2)];
    for (let yy = y; yy < Math.min(h, y + bh); yy++) for (let xx = x; xx < Math.min(w, x + bw); xx++) if (yy >= top(xx)) rect(g, xx, yy, 1, 1, col);
    // 윗변이 빛을 받는다
    for (let xx = x; xx < Math.min(w, x + bw); xx++) if (y >= top(xx)) rect(g, xx, y, 1, 1, T.bits[3]);
  }
  // 뼈대·철근이 삐져나온다 (강철·콘크리트는 비스듬한 막대)
  if (mat === 'steel' || mat === 'concrete' || mat === 'sheet') {
    for (let k = 0; k < Math.max(1, Math.floor(w / 24)); k++) {
      let x = Math.floor(r() * w);
      const dir = r() < 0.5 ? -1 : 1;
      for (let y = Math.max(0, top(Math.max(0, Math.min(w - 1, x))) - 3), s = 0; y < h && x >= 0 && x < w; y++, s++) {
        rect(g, x, y, 1, 1, mat === 'concrete' ? (TONES.concrete.bone as string) : T.bits[2]);
        if (s % 2 === 1) x += dir;
      }
    }
  }
  return c;
}

interface Struct {
  w: Wreckable;
  i: number;
  z: number;
  shown: number;
  plate: THREE.Mesh | null;
  plateMat: THREE.ShaderMaterial | null;
  rubble: THREE.Mesh | null;
  ember: boolean;
}

interface StreetView {
  w: Wreckable;
  i: number;
  pivot: THREE.Group;
  shown: number;
  wreck: THREE.Object3D | null;
  plate: THREE.Mesh | null;
}

export class Wreck {
  readonly group = new THREE.Group();
  private readonly structs: Struct[] = [];
  private readonly street: StreetView[] = [];
  private readonly smoke = new Puffs(60, C.smoke, C.smokeDark, 6, 0.55);
  private readonly sparks = new Sparks(80);
  private state: WreckState | null = null;

  constructor() {
    WRECKS.forEach((w, i) => {
      if (w.street >= 0) this.street.push(this.buildStreet(w, i));
      else this.structs.push({ w, i, z: FACE_Z[w.kind] ?? -2, shown: 0, plate: null, plateMat: null, rubble: null, ember: false });
    });
    this.group.add(this.smoke.mesh, this.sparks.mesh);
  }

  /** 거리 소품 하나: 밑동을 축으로 기울일 수 있게 따로 짓는다 */
  private buildStreet(w: Wreckable, i: number): StreetView {
    const p = D.street.props[w.street];
    const det = new Details();
    const inner = new THREE.Group();
    buildStreetProp(p, det, inner);
    inner.add(det.build());
    const pivot = new THREE.Group();
    const cx = (w.x0 + w.x1) / 2;
    pivot.position.set(cx, 0, 0);
    inner.position.set(-cx, 0, 0);
    pivot.add(inner);
    this.group.add(pivot);
    return { w, i, pivot, shown: 0, wreck: null, plate: null };
  }

  /** 등·빛이 이 구조물에 붙어 있으면 꺼진 정도 (1 그대로, 2단계 깜빡임, 3단계 0). 구조물 밖이면 1 */
  lightK(x: number, y: number, tick: number): number {
    const s = this.state;
    if (!s) return 1;
    let k = 1;
    for (const st of this.structs) {
      const stage = s.stage[st.i];
      if (stage < 2) continue;
      const w = st.w;
      if (x < w.x0 - 6 || x > w.x1 + 6 || y < w.y0 - 6 || y > w.y1 + 24) continue;
      // 용광로 밑동 화구 빛은 굴뚝이 무너져도 탄다 (구간 주인공 빛)
      if (w.kind === 'stack' && y < 70) continue;
      if (stage >= 3) return 0;
      k = Math.min(k, hash((tick >> 2) * 31 + st.i) < 0.3 ? 0.15 : 0.85);
    }
    return k;
  }

  update(state: WreckState | null, tick: number, view0: number, view1: number): void {
    this.state = state;
    this.smoke.begin();
    this.sparks.begin();
    for (const st of this.structs) {
      const stage = state?.stage[st.i] ?? 0;
      if (stage !== st.shown) this.show(st, state, stage);
      if (stage > 0 && state && st.w.x1 > view0 - 80 && st.w.x0 < view1 + 80) this.linger(st, state, tick);
    }
    for (const sv of this.street) {
      const stage = state?.stage[sv.i] ?? 0;
      if (stage !== sv.shown) this.showStreet(sv, state, stage);
    }
    this.smoke.end();
    this.sparks.end();
  }

  /** 단계에 맞는 손상 판과 잔해 더미 */
  private show(st: Struct, s: WreckState | null, stage: number): void {
    st.shown = stage;
    const w = st.w;
    if (st.plate) {
      this.group.remove(st.plate);
      st.plate.geometry.dispose();
      st.plate = null;
    }
    if (st.rubble) {
      this.group.remove(st.rubble);
      st.rubble.geometry.dispose();
      st.rubble = null;
    }
    if (stage === 0 || !s) return;
    const painted = paintWreck(w, stage, s.hx[st.i], s.hy[st.i], st.i * 17 + stage);
    st.ember = painted.ember;
    st.plateMat = litMaterial(pixelTexture(painted.map), { emissive: pixelTexture(painted.glow), emissiveStrength: 1.4, bump: 0.3, wet: 0.25 });
    const band = paintBand(w, stage);
    st.plate = plane(w.x0, w.x1, band.y0 - band.hang, band.y1, st.z + 0.35, st.plateMat);
    this.group.add(st.plate);
    if (stage >= 2) {
      // 잔해 더미: 밑(높이 있는 판·들보는 그 아래 땅)에 쌓인다. 무너지면 더 넓고 높게
      const ww = Math.min(220, w.x1 - w.x0 + (stage >= 3 ? 24 : 10));
      const hh = Math.round(Math.min(26, (stage >= 3 ? 8 : 4) + (w.y1 - w.y0) / (stage >= 3 ? 10 : 24)));
      const cx = (w.x0 + w.x1) / 2 + (s.dir[st.i] ?? 1) * (stage >= 3 ? 6 : 2);
      const z = w.y0 > 20 ? -6 : st.z + 2.5;
      st.rubble = plane(cx - ww / 2, cx + ww / 2, 0, hh, z, litMaterial(pixelTexture(paintRubble(w.mat, Math.round(ww), hh, st.i * 31 + stage)), { bump: 0.4, wet: 0.5 }));
      this.group.add(st.rubble);
    }
  }

  /** 부서진 뒤 남는 효과: 연기(무너진 뒤 15초), 강철 불꽃(30틱), 불씨의 빛 */
  private linger(st: Struct, s: WreckState, tick: number): void {
    const w = st.w;
    const at2 = s.at[st.i][1];
    const at3 = s.at[st.i][2];
    const hx = w.x0 + s.hx[st.i];
    const hy = w.y0 + s.hy[st.i];
    if (at3 >= 0 && w.mat !== 'glass') {
      const since = tick - at3;
      const k = since < 900 ? 1 : since < 2400 ? 0.4 : 0;
      if (k > 0) {
        const n = w.mat === 'sand' ? 1 : 3;
        for (let j = 0; j < n; j++) {
          const life = 130;
          const age = (tick + j * (life / n) + st.i * 29) % life;
          const u = age / life;
          this.smoke.add(hx + Math.sin((age + st.i * 9) * 0.06) * 4 + u * 12, hy + age * 0.45, st.z + 2 + j * 0.05, 6 + u * 16, k * (1 - u) * (u < 0.1 ? u * 10 : 1));
        }
      }
    }
    const recent = Math.max(at2, at3);
    if ((w.mat === 'steel' || w.mat === 'sheet') && recent >= 0 && tick - recent < 40 && hash((tick >> 1) * 5 + st.i) < 0.5) {
      for (let j = 0; j < 4; j++) {
        const fall = ((tick - recent) * 0.9 + j * 5) % 30;
        this.sparks.add(hx + (hash(tick * 3 + j) - 0.5) * 8, hy - fall, st.z + 1, j % 2 ? C.fxYellow : C.fxOrange, 2);
      }
      lightPool.add(hx, hy, st.z + 10, 40, C.fxOrange, 0.6);
    }
    if (st.ember && at3 >= 0 && tick - at3 < 3600) {
      lightPool.add(hx, Math.max(w.y0 + 6, hy - 6), st.z + 8, 46, C.fxOrange, 0.35 + 0.2 * hash((tick >> 3) * 7 + st.i));
    }
  }

  /** 거리 소품: 1·2단계는 맞은 쪽으로 기울고 금·찌그러짐, 3단계는 부서진 모습 */
  private showStreet(sv: StreetView, s: WreckState | null, stage: number): void {
    sv.shown = stage;
    const w = sv.w;
    const dir = s?.dir[sv.i] ?? 1;
    const inner = sv.pivot.children[0];
    inner.visible = stage < 3;
    sv.pivot.rotation.z = stage === 0 ? 0 : -dir * (stage === 1 ? 0.035 : 0.09);
    if (sv.plate) {
      sv.pivot.remove(sv.plate);
      sv.plate = null;
    }
    if (stage > 0 && stage < 3 && s) {
      const painted = paintWreck(w, stage, s.hx[sv.i], s.hy[sv.i], sv.i * 13 + stage);
      const cx = (w.x0 + w.x1) / 2;
      sv.plate = plane(w.x0 - cx, w.x1 - cx, w.y0, w.y1, (FACE_Z[w.kind] ?? -26) + 0.4, litMaterial(pixelTexture(painted.map)));
      sv.pivot.add(sv.plate);
    }
    if (stage >= 3 && !sv.wreck) {
      sv.wreck = streetWreck(w, D.street.props[w.street], dir, sv.i);
      this.group.add(sv.wreck);
    }
    if (sv.wreck) sv.wreck.visible = stage >= 3;
  }
}

/** 부서진 거리 소품 (맞은 쪽 dir으로 쓰러지고 흩어진다) */
function streetWreck(w: Wreckable, p: (typeof D.street.props)[number], dir: number, seed: number): THREE.Object3D {
  const g = new THREE.Group();
  const det = new Details();
  const x = w.x0;
  const r = rng(seed * 5 + 3);
  const plank = (x0: number, len: number, a: number, z: number, col: string) => det.bar(x0, 0.8, x0 + Math.cos(a) * len, 0.8 + Math.sin(a) * len, 2, z - 3, z, col);
  switch (p.kind) {
    case 'barrel': {
      // 옆으로 쓰러져 굴러간 드럼통 (테 둘), 흘러나온 기름 자국
      const bx = x + dir * 16;
      det.add(bx, bx + 20, 0, 13, -38, -26, C.rust);
      det.add(bx + 4, bx + 5, -0.2, 13.2, -38.4, -25.6, C.iron);
      det.add(bx + 15, bx + 16, -0.2, 13.2, -38.4, -25.6, C.iron);
      det.add(bx, bx + 20, 12.4, 13, -38, -26, '#8a5a3a');
      det.add(x - 6, x + 30, 0, 0.4, -40, -20, '#0e0c10');
      break;
    }
    case 'crates': {
      // 위 상자는 떨어져 깨지고 판자가 흩어진다. 맨 아래 하나만 기울어 남는다
      det.add(x, x + 18, 0, 14, -40, -22, C.awning);
      det.add(x, x + 18, 13, 14, -40, -22, C.awningStripe);
      for (let k = 0; k < 7; k++) plank(x + dir * (10 + r() * 34), 8 + r() * 10, dir > 0 ? r() * 0.5 : Math.PI - r() * 0.5, -24 - r() * 14, k % 2 ? C.awning : C.awningStripe);
      break;
    }
    case 'mailbox': {
      // 넘어진 우체통과 흩어진 편지
      const bx = dir > 0 ? x + 4 : x - 16;
      det.add(bx, bx + 24, 0, 12, -36, -26, C.paintTeal);
      det.add(dir > 0 ? bx + 22 : bx, dir > 0 ? bx + 24 : bx + 2, 0, 12, -36, -26, C.ironLight);
      for (let k = 0; k < 6; k++) {
        const lx = x + dir * (6 + r() * 30);
        det.add(lx, lx + 3, 0, 0.6, -30 + r() * 8, -28 + r() * 8, C.paintCream);
      }
      det.add(x + 2, x + 4, 0, 3, -33, -29, C.iron);
      det.add(x + 10, x + 12, 0, 2, -33, -29, C.iron);
      break;
    }
    case 'bench': {
      // 가운데가 부러져 V자로 꺾인 벤치
      det.bar(x, 10, x + 18, 2, 3, -38, -30, C.awningStripe);
      det.bar(x + 36, 10, x + 18, 2, 3, -38, -30, C.awningStripe);
      det.bar(x + 2, 19, x + 16, 6, 3, -39, -37, C.awningStripe);
      det.add(x + 2, x + 4, 0, 10, -38, -36, C.iron);
      det.add(x + 32, x + 34, 0, 10, -38, -36, C.iron);
      plank(x + 20 + dir * 10, 10, dir > 0 ? 0.2 : Math.PI - 0.2, -32, C.awningStripe);
      break;
    }
    case 'planter': {
      // 깨진 화분 두 쪽과 쏟아진 흙, 쓰러진 관목
      det.add(x - dir * 2, x + 13 - dir * 2, 0, 11, -44, -28, C.stone);
      det.add(x + 17 + dir * 4, x + 30 + dir * 4, 0, 8, -44, -28, C.stone);
      det.add(x - 4, x + 38, 0, 2, -42, -26, '#1e1a16');
      det.add(x + dir * 12 + 4, x + dir * 12 + 26, 0, 9, -36, -30, C.smog3);
      break;
    }
    case 'posterboard': {
      // 기둥이 꺾여 판이 앞으로 쓰러졌다 (뒷면 판자만 보인다)
      det.bar(x + 4, 0, x + 4 + dir * 10, 22, 3, -38, -35, C.iron);
      det.bar(x + 30, 0, x + 30 + dir * 10, 22, 3, -38, -35, C.iron);
      det.bar(x + dir * 6, 2, x + 40 + dir * 6, 14, 4, -34, -18, '#3a2e26');
      for (let k = 0; k < 4; k++) det.add(x + r() * 40, x + r() * 40 + 3, 0, 0.6, -30 + r() * 6, -27 + r() * 6, C.posterRed);
      break;
    }
  }
  g.add(det.build());
  return g;
}
