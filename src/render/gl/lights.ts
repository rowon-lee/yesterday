import * as THREE from 'three';
import { FRONT } from '../../stage/citadel';

/**
 * 광원 풀 (렌더 전용). 무대·물건·이펙트가 프레임마다 후보 빛을 내면, 화면에 가장 크게 닿는 것부터 LIGHT_N개만
 * 셰이더의 광원 배열에 싣는다 (광원 수 상한: 휴대폰 60프레임). 나머지 빛은 스스로 빛나는 면(발광 텍스처)으로만 남는다.
 * 모든 재질이 같은 유니폼 객체를 가리키므로 한 번 바꾸면 모두에 들어간다.
 */
export const LIGHT_N = 12;
/** 부서지는 길가 건물 수 (건물마다 무너진 칸 묶음 하나: uGone) */
export const GONE_N = FRONT.length;

export interface LightCand {
  x: number;
  y: number;
  z: number;
  /** 닿는 거리 (px) */
  range: number;
  /** 선형 색 × 세기 */
  r: number;
  g: number;
  b: number;
}

/** 환경광 (선형 값): 하늘 쪽은 어둡고 차가운 남색, 바닥 쪽은 더 어둡다 */
const AMBIENT = new THREE.Color().setRGB(0.13, 0.17, 0.32);
const AMBIENT_GROUND = new THREE.Color().setRGB(0.03, 0.036, 0.06);
/**
 * 바탕색 배율: 도트 텍스처는 2D 팔레트 색(이미 어둡게 칠한 마지막 색)이라 빛을 곱하면 너무 어둡다.
 * 빛 계산에서는 바탕색을 이만큼 밝혀 쓴다.
 */
const ALBEDO = 2.2;

export const shared = {
  uLightPos: { value: Array.from({ length: LIGHT_N }, () => new THREE.Vector4(0, -1e5, 0, 1)) },
  uLightCol: { value: Array.from({ length: LIGHT_N }, () => new THREE.Vector4(0, 0, 0, 0)) },
  /** 실린 광원 수 (셰이더는 이만큼만 돈다: 품질 낮음이면 반) */
  uLightCount: { value: 0 },
  uAmbient: { value: AMBIENT.clone() },
  uAmbientGround: { value: AMBIENT_GROUND.clone() },
  uAlbedo: { value: ALBEDO },
  /** 안개: 색, 깊이(카메라에서 거리)로 짙어지는 구간, 바닥 안개 세기 */
  uFogColor: { value: new THREE.Color().setRGB(0.03, 0.04, 0.075) },
  uFogNear: { value: 3200 },
  uFogFar: { value: 30000 },
  uGroundFog: { value: 0.18 },
  uTime: { value: 0 },
  /** 건물마다 무너져 사라진 칸 (비트: 칸 번호). 붙은 기하는 그 칸 부분을 그리지 않는다 */
  uGone: { value: new Array<number>(GONE_N).fill(0) },
};

const cands: LightCand[] = [];
let limit = LIGHT_N;

export const lightPool = {
  clear(): void {
    cands.length = 0;
  },
  /** 후보 빛 하나. color는 '#rrggbb', power는 세기(1 안팎) */
  add(x: number, y: number, z: number, range: number, color: string, power: number): void {
    if (power <= 0.01 || range <= 0) return;
    const c = tmp.set(color).convertSRGBToLinear();
    cands.push({ x, y, z, range, r: c.r * power, g: c.g * power, b: c.b * power });
  },
  /** 품질 낮음이면 광원 수를 줄인다 */
  setLimit(n: number): void {
    limit = Math.max(1, Math.min(LIGHT_N, n));
  },
  /** 화면(월드 사각형 x0~x1, y0~y1, 바닥 기준 위로 +)에 닿는 빛 중 센 것부터 골라 유니폼에 싣는다 */
  commit(x0: number, x1: number, y0: number, y1: number): number {
    const scored: Array<[number, LightCand]> = [];
    for (const c of cands) {
      const dx = Math.max(x0 - c.x, 0, c.x - x1);
      const dy = Math.max(y0 - c.y, 0, c.y - y1);
      const d = Math.hypot(dx, dy);
      if (d > c.range) continue;
      const power = c.r + c.g + c.b;
      scored.push([power * c.range * (1 - d / c.range), c]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const pos = shared.uLightPos.value;
    const col = shared.uLightCol.value;
    for (let i = 0; i < LIGHT_N; i++) {
      const c = i < limit ? scored[i]?.[1] : undefined;
      if (c) {
        pos[i].set(c.x, c.y, c.z, c.range);
        col[i].set(c.r, c.g, c.b, 1);
      } else {
        pos[i].set(0, -1e5, 0, 1);
        col[i].set(0, 0, 0, 0);
      }
    }
    shared.uLightCount.value = Math.min(limit, scored.length);
    return shared.uLightCount.value;
  },
  /** (x, y, z)에서 가장 센 빛: 색(선형)과 그쪽 방향 (캐릭터 테두리 빛, 빗줄기). 실린 광원만 본다 */
  strongest(x: number, y: number, z: number): { r: number; g: number; b: number; dx: number; dy: number; k: number } | null {
    let best: { r: number; g: number; b: number; dx: number; dy: number; k: number } | null = null;
    const pos = shared.uLightPos.value;
    const col = shared.uLightCol.value;
    for (let i = 0; i < LIGHT_N; i++) {
      if (col[i].w === 0) continue;
      const lx = pos[i].x - x;
      const ly = pos[i].y - y;
      const lz = pos[i].z - z;
      const d = Math.hypot(lx, ly, lz);
      const t = 1 - d / pos[i].w;
      if (t <= 0) continue;
      const power = (col[i].x + col[i].y + col[i].z) / 3;
      const k = t * t * power;
      if (!best || k > best.k) {
        const n = Math.hypot(lx, ly) || 1;
        best = { r: col[i].x, g: col[i].y, b: col[i].z, dx: lx / n, dy: ly / n, k };
      }
    }
    return best;
  },
};

const tmp = new THREE.Color();
