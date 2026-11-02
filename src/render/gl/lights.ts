import * as THREE from 'three';
import { FRONT } from '../../stage/citadel';

/**
 * 광원 풀 (렌더 전용). 무대·물건·이펙트가 프레임마다 후보 빛을 내면, 화면에 실제로 닿는 빛부터 LIGHT_N개만
 * 셰이더의 광원 배열에 싣는다 (광원 수 상한: 휴대폰 60프레임). 나머지 빛은 스스로 빛나는 면(발광 텍스처)으로만 남는다.
 * 모든 재질이 같은 유니폼 객체를 가리키므로 한 번 바꾸면 모두에 들어간다.
 *
 * 고르는 법 (빛이 툭툭 켜지고 꺼지지 않게):
 * - 화면에 닿는 만큼으로 잰다: 화면 사각형까지 거리로 줄어드는 세기(셰이더와 같은 제곱 감쇠) × 닿는 거리.
 *   아래로만 비추는 등이 화면보다 낮으면 화면을 비추지 못하므로 뺀다. 광원이 화면 안에 있으면 더 쳐준다(빛 무리·벽의 빛이 보인다).
 * - 이펙트 빛(타격·기술)은 자리를 따로 몇 칸 떼어 둔다: 이펙트가 나고 사라질 때 무대 빛이 밀려나 깜빡이지 않게.
 * - 지난 프레임에 실렸던 빛은 점수를 더 쳐준다 (경계에서 둘이 번갈아 들고 나지 않게).
 * - 새로 실린 빛은 몇 틱에 걸쳐 밝아지고, 밀려난 빛은 빈 칸이 있으면 몇 틱에 걸쳐 어두워진다.
 *   틱이 크게 건너뛰면(장면 시작·빨리 감기) 바로 다 켠다.
 */
export const LIGHT_N = 12;
/** 부서지는 길가 건물 수 (건물마다 무너진 칸 묶음 하나: uGone) */
export const GONE_N = FRONT.length;
/** 이펙트 빛에 떼어 두는 자리 (품질 높음 / 낮음) */
const FX_SLOTS_HIGH = 4;
const FX_SLOTS_LOW = 2;
/** 지난 프레임에 실렸던 빛의 점수 배율 */
const KEEP_BONUS = 1.35;
/** 틱마다 밝아지는·어두워지는 양 */
const FADE_IN = 1 / 8;
const FADE_OUT = 1 / 6;
/** 이만큼 넘게 틱이 건너뛰면 바로 다 켠다 */
const SNAP_TICKS = 30;

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
  /** 아래로만 비추는 등 (코브라 헤드 가로등): 광원보다 높은 곳은 비추지 않는다 */
  down: boolean;
  /** 이펙트 빛 (전투 연출): 자리를 따로 받고, 바로 켜지고 바로 꺼진다 */
  fx: boolean;
  /** 색 이름 ('#rrggbb'): 지난 프레임의 빛과 같은 빛인지 알아볼 때 */
  hex: string;
  /** 이번 프레임 점수 (화면에 닿는 정도) */
  score: number;
  /** 지난 프레임에 실렸던 칸 (없으면 -1) */
  prev: number;
}

/** 환경광 (선형 값): 하늘 쪽은 어둡고 차가운 남색, 바닥 쪽은 더 어둡다 */
const AMBIENT = new THREE.Color().setRGB(0.1, 0.13, 0.26);
const AMBIENT_GROUND = new THREE.Color().setRGB(0.03, 0.036, 0.06);
/**
 * 바탕색 배율: 도트 텍스처는 2D 팔레트 색(이미 어둡게 칠한 마지막 색)이라 빛을 곱하면 너무 어둡다.
 * 빛 계산에서는 바탕색을 이만큼 밝혀 쓴다.
 */
const ALBEDO = 2.2;

/**
 * 광원 배열은 셰이더 모두가 함께 쓰는 유니폼 버퍼(WebGL2) 하나에 담는다: 프레임마다 한 번만 올린다
 * (재질마다 배열 유니폼을 올리면 그리기 호출마다 다시 올라간다). 셰이더에서는 LIGHTS_DECL로 선언한다.
 */
const lightPos = Array.from({ length: LIGHT_N }, () => new THREE.Vector4(0, -1e5, 0, 1));
const lightCol = Array.from({ length: LIGHT_N }, () => new THREE.Vector4(0, 0, 0, 0));
/** 칸마다 이펙트 빛인지 (후처리 빛 무리가 이펙트 빛은 작게 그린다) */
const lightFx: boolean[] = new Array(LIGHT_N).fill(false);
/** 실린 광원 수 (셰이더는 이만큼만 돈다: 품질 낮음이면 반) */
const lightCount = new THREE.Uniform(0);
/** 이번 프레임에 실린 광원 (후처리의 빛 무리가 화면 자리를 한 번만 계산해 쓴다) */
export const loadedLights = { pos: lightPos, col: lightCol, fx: lightFx, count: (): number => lightCount.value as number };
export const lightBlock = new THREE.UniformsGroup();
lightBlock.setName('Lights');
lightBlock.add(new THREE.Uniform(lightPos));
lightBlock.add(new THREE.Uniform(lightCol));
lightBlock.add(lightCount);

/** 셰이더의 광원 선언 (유니폼 버퍼). 루프는 for (int i = 0; i < LIGHT_N; i++) { if (float(i) >= uLightCount) break; … } */
export const LIGHTS_DECL = /* glsl */ `
#define LIGHT_N ${LIGHT_N}
layout(std140) uniform Lights {
  vec4 uLightPos[LIGHT_N];
  vec4 uLightCol[LIGHT_N];
  float uLightCount;
};
`;

/** 광원을 읽는 재질에 유니폼 버퍼를 단다 */
export function withLights<T extends THREE.ShaderMaterial>(m: T): T {
  m.uniformsGroups = [lightBlock];
  return m;
}

export const shared = {
  uAmbient: { value: AMBIENT.clone() },
  uAmbientGround: { value: AMBIENT_GROUND.clone() },
  uAlbedo: { value: ALBEDO },
  /** 안개: 색, 깊이(카메라에서 거리)로 짙어지는 구간, 바닥 안개 세기 */
  uFogColor: { value: new THREE.Color().setRGB(0.03, 0.04, 0.075) },
  uFogNear: { value: 3200 },
  uFogFar: { value: 30000 },
  uGroundFog: { value: 0.18 },
  /** 먼 겹 안개: 바닥 쪽 안개 세기, 지평선 도시 불빛에 물든 안개 색 (구간 분위기) */
  uMist: { value: 0.4 },
  uFogGlow: { value: new THREE.Color().setRGB(0.02, 0.02, 0.03) },
  uTime: { value: 0 },
  /** 건물마다 무너져 사라진 칸 (비트: 칸 번호). 붙은 기하는 그 칸 부분을 그리지 않는다 */
  uGone: { value: new Array<number>(GONE_N).fill(0) },
};

/** 후보 (프레임마다 다시 쓰는 객체 풀: 프레임마다 새 객체를 만들지 않게) */
const pool: LightCand[] = [];
let candN = 0;
let limit = LIGHT_N;
let fxSlots = FX_SLOTS_HIGH;
/** 화면 둘레 (월드 x0~x1, 바닥 위 y0~y1): 여기에 닿지 않는 후보는 받자마자 버린다 */
const area = { x0: -1e9, x1: 1e9, y0: -1e9, y1: 1e9 };
/** '#rrggbb' → 선형 색 (프레임마다 같은 색 글자를 다시 읽지 않게) */
const linCache = new Map<string, THREE.Color>();
function linear(hex: string): THREE.Color {
  let c = linCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex).convertSRGBToLinear();
    linCache.set(hex, c);
  }
  return c;
}

/** 지난 프레임에 실린 빛 (칸 순서): 같은 빛을 알아보고, 밝기(fade)를 이어 간다 */
interface Loaded {
  x: number;
  y: number;
  z: number;
  range: number;
  r: number;
  g: number;
  b: number;
  down: boolean;
  fx: boolean;
  hex: string;
  fade: number;
  score: number;
  /** 이번 프레임에 이어받은 후보가 있는가 */
  taken: boolean;
}
const newLoaded = (): Loaded => ({ x: 0, y: 0, z: 0, range: 1, r: 0, g: 0, b: 0, down: false, fx: false, hex: '', fade: 0, score: 0, taken: false });
let loaded: Loaded[] = Array.from({ length: LIGHT_N }, newLoaded);
let loadedN = 0;
let spare: Loaded[] = Array.from({ length: LIGHT_N }, newLoaded);
let lastTick = -1e9;
const order: LightCand[] = [];
const sorted: Loaded[] = [];

export const lightPool = {
  /** 새 프레임: 후보를 비우고 화면 둘레를 정한다 */
  clear(x0 = -1e9, x1 = 1e9, y0 = -1e9, y1 = 1e9): void {
    candN = 0;
    area.x0 = x0;
    area.x1 = x1;
    area.y0 = y0;
    area.y1 = y1;
  },
  /**
   * 후보 빛 하나. color는 '#rrggbb', power는 세기(1 안팎), down이면 아래로만 비추는 등,
   * fx면 이펙트 빛 (전투 연출: 따로 뗀 자리에 바로 켜진다)
   */
  add(x: number, y: number, z: number, range: number, color: string, power: number, down = false, fx = false): void {
    if (power <= 0.01 || range <= 0) return;
    const dx = Math.max(area.x0 - x, 0, x - area.x1);
    const dy = Math.max(area.y0 - y, 0, y - area.y1);
    if (dx * dx + dy * dy > range * range) return;
    // 아래로만 비추는 등이 화면 둘레보다 낮으면 화면 안을 비추지 못한다
    if (down && y < area.y0) return;
    const c = linear(color);
    let k = pool[candN];
    if (!k) {
      k = { x: 0, y: 0, z: 0, range: 0, r: 0, g: 0, b: 0, down: false, fx: false, hex: '', score: 0, prev: -1 };
      pool[candN] = k;
    }
    candN++;
    k.x = x;
    k.y = y;
    k.z = z;
    k.range = range;
    k.r = c.r * power;
    k.g = c.g * power;
    k.b = c.b * power;
    k.down = down;
    k.fx = fx;
    k.hex = color;
    k.score = 0;
    k.prev = -1;
  },
  /** 품질 낮음이면 광원 수를 줄인다 (이펙트 빛 자리도 같이 줄인다) */
  setLimit(n: number): void {
    limit = Math.max(1, Math.min(LIGHT_N, n));
    fxSlots = limit >= LIGHT_N ? FX_SLOTS_HIGH : FX_SLOTS_LOW;
  },
  /**
   * 화면(월드 사각형 x0~x1, y0~y1, 바닥 기준 위로 +)에 닿는 빛 중 센 것부터 골라 유니폼에 싣는다.
   * tick: 지금 틱 (켜지고 꺼지는 빠르기를 틱으로 잰다)
   */
  commit(x0: number, x1: number, y0: number, y1: number, tick = 0): number {
    const dt = tick - lastTick;
    const snap = dt < 0 || dt > SNAP_TICKS;
    const step = snap ? 1 : dt;
    lastTick = tick;
    order.length = 0;
    // 1. 화면에 닿는 정도로 점수를 매기고, 지난 프레임에 실렸던 빛을 알아본다
    for (let i = 0; i < candN; i++) {
      const c = pool[i];
      const dx = Math.max(x0 - c.x, 0, c.x - x1);
      const dy = Math.max(y0 - c.y, 0, c.y - y1);
      // 아래로만 비추는 등: 화면이 등보다 위에 있으면 비추지 못한다
      if (c.down && c.y < y0 - 8) continue;
      // 싸우는 면에서 앞뒤로 멀리 떨어진 빛은 그만큼 덜 닿는다
      const dz = Math.max(0, Math.abs(c.z) - 40) * 0.5;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= c.range) continue;
      const k = 1 - d / c.range;
      let s = (c.r + c.g + c.b) * c.range * k * k;
      if (dx === 0 && dy === 0) s *= 1.5;
      c.prev = -1;
      for (let j = 0; j < loadedN; j++) {
        const p = loaded[j];
        if (p.taken || p.hex !== c.hex || p.down !== c.down || p.fx !== c.fx) continue;
        if (Math.abs(p.x - c.x) > 24 || Math.abs(p.y - c.y) > 24 || Math.abs(p.z - c.z) > 40) continue;
        p.taken = true;
        c.prev = j;
        s *= KEEP_BONUS;
        break;
      }
      c.score = s;
      order.push(c);
    }
    order.sort((a, b) => b.score - a.score);
    // 2. 고르기: 이펙트 빛은 따로 뗀 자리까지 먼저, 그다음 남은 자리를 점수 순으로
    let n = 0;
    const next = spare;
    let fxN = 0;
    const take = (c: LightCand): void => {
      const o = next[n++];
      const p = c.prev >= 0 ? loaded[c.prev] : null;
      o.x = c.x;
      o.y = c.y;
      o.z = c.z;
      o.range = c.range;
      o.r = c.r;
      o.g = c.g;
      o.b = c.b;
      o.down = c.down;
      o.fx = c.fx;
      o.hex = c.hex;
      o.score = c.score;
      o.fade = c.fx || snap ? 1 : Math.min(1, (p ? p.fade : 0) + step * FADE_IN);
      o.taken = true;
      c.score = -1;
    };
    for (const c of order) {
      if (n >= limit || fxN >= fxSlots) break;
      if (c.fx) {
        take(c);
        fxN++;
      }
    }
    for (const c of order) {
      if (n >= limit) break;
      if (c.score < 0) continue;
      // 이펙트 빛은 뗀 자리만 쓴다 (무대 빛을 밀어내지 않게)
      if (c.fx) continue;
      take(c);
    }
    // 3. 밀려난 무대 빛: 빈 칸이 있으면 천천히 어두워지며 남는다
    if (!snap) {
      for (let j = 0; j < loadedN && n < limit; j++) {
        const p = loaded[j];
        if (p.fx) continue;
        // 이어받은 후보가 실렸으면 이미 남아 있다
        let carried = false;
        for (const c of order) {
          if (c.prev === j && c.score < 0) {
            carried = true;
            break;
          }
        }
        if (carried) continue;
        const fade = p.fade - step * FADE_OUT;
        if (fade <= 0.02) continue;
        const o = next[n++];
        Object.assign(o, p);
        o.fade = fade;
      }
    }
    // 4. 칸에 싣는다 (센 순서: 반짝임·빗줄기는 앞 칸 몇 개만 본다). next 앞쪽 n개를 그 순서로 다시 놓는다
    sorted.length = 0;
    for (let i = 0; i < n; i++) sorted.push(next[i]);
    sorted.sort((a, b) => b.score * b.fade - a.score * a.fade);
    for (let i = 0; i < n; i++) next[i] = sorted[i];
    for (let i = 0; i < LIGHT_N; i++) {
      const o = i < n ? next[i] : null;
      if (o) {
        lightPos[i].set(o.x, o.y, o.z, o.range);
        // w: 1 사방으로 비추는 빛, 2 아래로만 비추는 등
        lightCol[i].set(o.r * o.fade, o.g * o.fade, o.b * o.fade, o.down ? 2 : 1);
        lightFx[i] = o.fx;
        o.taken = false;
      } else {
        lightPos[i].set(0, -1e5, 0, 1);
        lightCol[i].set(0, 0, 0, 0);
        lightFx[i] = false;
      }
    }
    // 다음 프레임: 이번에 실린 빛이 '지난 프레임 빛'이 된다
    spare = loaded;
    loaded = next;
    loadedN = n;
    lightCount.value = n;
    return n;
  },
  /** (x, y, z)에서 가장 센 빛: 색(선형)과 그쪽 방향 (캐릭터 테두리 빛, 빗줄기). 실린 광원만 본다 */
  strongest(x: number, y: number, z: number): { r: number; g: number; b: number; dx: number; dy: number; k: number } | null {
    let best: { r: number; g: number; b: number; dx: number; dy: number; k: number } | null = null;
    const pos = lightPos;
    const col = lightCol;
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
