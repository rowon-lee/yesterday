import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { SURFACES } from '../../stage/citadel';
import { SCREEN_H, SCREEN_W } from '../screen';
import { hash } from '../dither';
import { scaleAt } from './core';
import { LIGHT_N, LIGHTS_DECL, loadedLights, shared, withLights } from './lights';
import { atmos, keepAlpha } from './shaders';
import { rainHold } from '../screenfx';

/**
 * 비 (렌더 전용): 얇고 무채색인 빗줄기 세 겹 (먼 겹·싸우는 면 바로 뒤·카메라 앞).
 * 빗줄기 자리는 화면 좌표로 정하고(틱만 보고 정하므로 같은 틱이면 같은 그림) 그 겹의 깊이로 되돌려 놓는다.
 * 빛 밖에서는 거의 보이지 않고, 빛 속을 지나는 빗방울만 그 빛 색으로 반짝인다 (꼭짓점마다 실린 광원 전부로 밝기를 잰다).
 * 빗방울마다 반짝임 세기가 조금씩 다르다. 먼 번개가 치면 모든 빗줄기가 잠깐 하얗게 드러난다.
 * 차양·고가 선로·하역장 차양 밑(싸우는 면 바로 뒤 겹)에는 비가 내리지 않는다.
 * 물방울은 빛이 닿은 젖은 바닥과 발판 위에만 튄다 (어두운 곳의 물방울은 보이지 않으므로 빛 웅덩이 둘레에 모아 둔다).
 */
const SLANT = 0.22;
/** 비를 가리는 지붕 수 (셰이더 배열 크기): 화면 둘레의 것만 싣는다 */
const SHELTER_N = 8;

interface RainLayer {
  z: number;
  n: number;
  /** 떨어지는 속도(px/틱), 길이(px), 카메라 따라 옆으로 흐르는 비율 */
  v: number;
  len: number;
  cam: number;
  order: number;
  /** 빛을 받는 세기, 번개에 드러나는 세기 */
  gain: number;
  flash: number;
  /** 빛을 재는 자리: 0이면 그 겹의 깊이 그대로, 1이면 싸우는 면(z = 0)에 비친 자리 (카메라 앞 겹: 뒤의 빛 앞을 지나며 반짝인다) */
  proj: number;
  /** 지붕 밑이면 숨기는지 (싸우는 면 바로 뒤 겹만) */
  shelter: number;
}

const LAYERS: readonly RainLayer[] = [
  { z: -420, n: 170, v: 5, len: 5, cam: 0.3, order: 3, gain: 1.1, flash: 0.6, proj: 0.6, shelter: 0 },
  { z: -20, n: 120, v: 8, len: 8, cam: 0.8, order: 3, gain: 1.5, flash: 0.8, proj: 0, shelter: 1 },
  { z: 900, n: 34, v: 13, len: 15, cam: 1.4, order: 20, gain: 0.75, flash: 1, proj: 1, shelter: 0 },
];

const RAIN_VERT = /* glsl */ `
${LIGHTS_DECL}
uniform float rainTime;
uniform vec3 redAt;
uniform vec2 camCenter;
uniform vec2 camTopLeft;
uniform float depth;
uniform float scale;
uniform float speed;
uniform float len;
uniform float camFollow;
uniform float gain;
uniform float flashGain;
uniform float proj;
uniform float shelterOn;
uniform float uFlash;
uniform vec4 shelters[${SHELTER_N}];
attribute vec2 seed;
varying vec3 vColor;
bool sheltered(vec2 w) {
  for (int i = 0; i < ${SHELTER_N}; i++) {
    vec4 s = shelters[i];
    if (w.x > s.x && w.x < s.y && w.y < s.z && w.y > s.w) return true;
  }
  return false;
}
void main() {
  float span = ${SCREEN_H.toFixed(1)} + len + 20.0;
  float wspan = ${SCREEN_W.toFixed(1)} + 60.0;
  float sy = mod(seed.y * span + rainTime * speed, span) - len - 10.0;
  float sx = mod(seed.x * wspan - camTopLeft.x * camFollow + sy * ${SLANT.toFixed(2)}, wspan) - 30.0;
  // position.y: 0(위 끝) ~ 1(아래 끝), position.x: -0.5 ~ 0.5 (폭 1px)
  float py = sy + position.y * len;
  float px = sx + position.y * len * ${SLANT.toFixed(2)} + position.x;
  vec3 world = vec3(camCenter.x + (px - ${(SCREEN_W / 2).toFixed(1)}) / scale, camCenter.y - (py - ${(SCREEN_H / 2).toFixed(1)}) / scale, depth);
  // 빗줄기 아래 끝이 싸우는 면에 비친 자리 (지붕 밑인지 보는 자리)
  float bx = sx + len * ${SLANT.toFixed(2)};
  vec2 foot = vec2(camCenter.x + bx - ${(SCREEN_W / 2).toFixed(1)}, camCenter.y - (sy + len - ${(SCREEN_H / 2).toFixed(1)}));
  bool under = sheltered(foot);
  if (shelterOn > 0.5 && under) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec3(0.0);
    return;
  }
  // 빛을 재는 자리: 카메라 앞 겹은 화면에서 겹쳐 보이는 싸우는 면 자리 (그 빛 앞을 지나며 반짝인다)
  vec3 P = mix(world, vec3(camCenter.x + px - ${(SCREEN_W / 2).toFixed(1)}, camCenter.y - (py - ${(SCREEN_H / 2).toFixed(1)}), 0.0), proj);
  vec3 lit = vec3(0.0);
  for (int i = 0; i < LIGHT_N; i++) {
    if (float(i) >= uLightCount) break;
    vec3 L = uLightPos[i].xyz - P;
    float d = length(L);
    float k = clamp(1.0 - d / (uLightPos[i].w * 0.95), 0.0, 1.0);
    if (k <= 0.0) continue;
    // 아래로 비추는 등은 그 아래 원뿔 속에서만
    float spot = uLightCol[i].w > 1.5 ? smoothstep(0.15, 0.7, L.y / max(d, 0.001)) : 1.0;
    lit += uLightCol[i].rgb * k * k * spot;
  }
  // 지붕 밑 빛 앞을 지나는 카메라 앞 빗줄기는 반짝이지 않는다 (지붕 밑 등불은 비를 비추지 않는다)
  if (under) lit *= 0.15;
  // 빗방울마다 반짝임이 다르다 (몇은 밝게 빛을 튕긴다)
  float sparkle = 0.55 + 0.9 * fract(seed.x * 53.7 + seed.y * 17.3);
  // 어둠 속: 거의 보이지 않는 무채색, 빛 속: 그 빛 색, 번개: 잠깐 하얗게
  vColor = vec3(0.62, 0.66, 0.72) * 0.0014 + lit * gain * sparkle + vec3(0.04, 0.043, 0.055) * uFlash * flashGain * sparkle;
  // 시간이 멈춘 연출 (라이덴 파천 정적): 한 점(주먹이 닿은 자리) 둘레의 멈춘 빗방울만 붉게
  if (redAt.z > 0.0 && distance(vec2(px, py), redAt.xy) < redAt.z) vColor = vec3(0.85, 0.16, 0.18);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const RAIN_FRAG = /* glsl */ `
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.0); }
`;

/** 비를 가리는 지붕: 가게 차양·극장 전구 차양 (발판) + 고가 선로 바닥·하역장 차양·감시탑 지붕 (판) */
const SHELTERS: ReadonlyArray<{ x0: number; x1: number; top: number; bottom: number }> = [
  ...SURFACES.filter((s) => s.kind === 'awning' || s.kind === 'marquee').map((s) => ({ x0: s.x0, x1: s.x1, top: s.h, bottom: 0 })),
  ...D.outskirts.decks
    .filter((d) => d.kind === 'rail' || d.kind === 'dockAwning' || d.kind === 'watch' || d.kind === 'watchRoof')
    .map((d) => ({ x0: d.x0 - (d.kind === 'rail' ? 60 : 0), x1: d.x1 + (d.kind === 'rail' ? 60 : 0), top: d.h, bottom: d.kind === 'watchRoof' ? d.h - 60 : 0 })),
];

export class Rain {
  readonly group = new THREE.Group();
  private readonly mats: THREE.ShaderMaterial[] = [];
  private readonly splash: THREE.InstancedMesh;
  private readonly splashMat: THREE.ShaderMaterial;
  private half = false;
  /**
   * 비가 내린 시간 (틱). 시간이 멈춘 연출 동안은 늘지 않는다 (빗방울이 공중에 선다):
   * 라이덴 파천 정적(setFrozen), 오스카 월령수류 전개(render/screenfx rainHold)
   */
  private readonly time = { value: 0 };
  private readonly red = { value: new THREE.Vector3() };
  /** 화면 둘레 지붕 (모든 겹이 함께 쓴다) */
  private readonly shelters = { value: Array.from({ length: SHELTER_N }, () => new THREE.Vector4(0, 0, -1e5, 0)) };
  private lastTick = -1;
  private frozen = false;
  private readonly m4 = new THREE.Matrix4();
  private readonly tops: Array<{ x0: number; x1: number; h: number }> = [];
  private readonly pools: Array<{ x: number; r: number; w: number }> = [];

  constructor() {
    for (const L of LAYERS) {
      const geo = new THREE.InstancedBufferGeometry();
      // 폭 1px, 길이 1 (셰이더에서 늘인다)
      geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
      geo.setIndex([0, 2, 1, 0, 3, 2]);
      const seeds = new Float32Array(L.n * 2);
      for (let i = 0; i < L.n; i++) {
        seeds[i * 2] = hash(L.z * 13 + i * 17 + 3);
        seeds[i * 2 + 1] = hash(L.z * 7 + i * 31 + 7);
      }
      geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 2));
      geo.instanceCount = L.n;
      const mat = keepAlpha(withLights(new THREE.ShaderMaterial({
        uniforms: {
          ...shared,
          rainTime: this.time,
          redAt: this.red,
          camCenter: { value: new THREE.Vector2() },
          camTopLeft: { value: new THREE.Vector2() },
          depth: { value: L.z },
          scale: { value: scaleAt(L.z) },
          speed: { value: L.v },
          len: { value: L.len },
          camFollow: { value: L.cam },
          gain: { value: L.gain },
          flashGain: { value: L.flash },
          proj: { value: L.proj },
          shelterOn: { value: L.shelter },
          shelters: this.shelters,
          uFlash: atmos.uFlash,
        },
        vertexShader: RAIN_VERT,
        fragmentShader: RAIN_FRAG,
        side: THREE.DoubleSide,
      })), true);
      mat.transparent = false;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = L.order;
      this.mats.push(mat);
      this.group.add(mesh);
    }
    // 물방울: 3×2 '^' 모양 작은 판 (빛 웅덩이 둘레 바닥과 보이는 발판 위). 빛이 닿지 않은 물방울은 그리지 않는다
    const sg = new THREE.PlaneGeometry(3, 2);
    this.splashMat = keepAlpha(withLights(new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: /* glsl */ `
        ${LIGHTS_DECL}
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 lit = vec3(0.0);
          for (int i = 0; i < LIGHT_N; i++) {
            if (float(i) >= uLightCount) break;
            vec3 L = uLightPos[i].xyz - wp.xyz;
            // 바닥 빛 웅덩이처럼 깊이 차이는 줄여 잰다 (shaders.ts floorLight)
            L.z *= 0.15;
            float d = length(L);
            float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
            lit += uLightCol[i].rgb * k * k;
          }
          vColor = lit * 0.9;
          // 빛이 닿지 않은 곳의 물방울은 그리지 않는다
          if (dot(lit, vec3(0.3, 0.59, 0.11)) < 0.035) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          else gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          // '^': 가운데 위 한 점, 양옆 아래 두 점
          vec2 p = floor(vUv * vec2(3.0, 2.0));
          bool on = (p.y > 0.5 && p.x > 0.5 && p.x < 1.5) || (p.y < 0.5 && (p.x < 0.5 || p.x > 1.5));
          if (!on) discard;
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
    })), true);
    this.splashMat.transparent = false;
    this.splash = new THREE.InstancedMesh(sg, this.splashMat, 24);
    this.splash.frustumCulled = false;
    this.splash.renderOrder = 4;
    this.group.add(this.splash);
  }

  /** 낮은 품질이면 빗줄기를 절반만 */
  setHalf(half: boolean): void {
    if (half === this.half) return;
    this.half = half;
    this.group.children.forEach((m, i) => {
      if (i < LAYERS.length) ((m as THREE.Mesh).geometry as THREE.InstancedBufferGeometry).instanceCount = half ? Math.ceil(LAYERS[i].n / 2) : LAYERS[i].n;
    });
  }

  /** 시간이 멈춘 연출: 빗방울과 물방울이 그 자리에 선다. red = [화면 x, 화면 y, 반지름] 둘레의 빗방울만 붉게 */
  setFrozen(on: boolean, red: readonly [number, number, number] | null = null): void {
    this.frozen = on;
    this.red.value.set(red?.[0] ?? 0, red?.[1] ?? 0, red?.[2] ?? 0);
  }

  update(tick: number, camCenterX: number, camCenterY: number, ix: number, iy: number): void {
    // 비 멈춤: 라이덴 파천 정적(setFrozen)이나 캐릭터 연출(render/screenfx rainHold, 오스카 월령수류) 동안 빗줄기 시계를 세운다
    const held = this.frozen || rainHold.on || tick < rainHold.until;
    if (this.lastTick >= 0 && !held) this.time.value += Math.max(0, Math.min(4, tick - this.lastTick));
    this.lastTick = tick;
    for (const m of this.mats) {
      m.uniforms.camCenter.value.set(camCenterX, camCenterY);
      m.uniforms.camTopLeft.value.set(ix, iy);
    }
    // 화면 둘레 지붕 (x0, x1, 윗면 높이, 아랫면 높이)
    let k = 0;
    for (const s of SHELTERS) {
      if (k >= SHELTER_N) break;
      if (s.x1 < ix - 40 || s.x0 > ix + SCREEN_W + 40) continue;
      this.shelters.value[k++].set(s.x0, s.x1, s.top, s.bottom);
    }
    for (; k < SHELTER_N; k++) this.shelters.value[k].set(0, 0, -1e5, 0);
    // 월령수류 동안은 바닥에 물이 차 있어 물방울을 숨긴다
    this.splash.visible = !rainHold.on;
    // 물방울: 3틱마다 자리를 바꾼다. 셋 중 하나는 화면에 보이는 발판 위, 나머지는 빛 웅덩이 둘레 바닥 (멈춘 동안은 그대로)
    if (held) return;
    const frame = Math.floor(tick / 3);
    this.tops.length = 0;
    for (const sf of SURFACES) if (sf.x1 > ix && sf.x0 < ix + SCREEN_W) this.tops.push(sf);
    // 바닥을 비추는 빛 (지난 프레임에 실린 광원): 세기만큼 물방울을 나눠 받는다
    this.pools.length = 0;
    let wsum = 0;
    const n0 = loadedLights.count();
    for (let i = 0; i < Math.min(n0, LIGHT_N); i++) {
      const p = loadedLights.pos[i];
      const c = loadedLights.col[i];
      if (p.y > 220 || p.x < ix - 60 || p.x > ix + SCREEN_W + 60) continue;
      const w = (c.x + c.y + c.z) * Math.max(0, 1 - p.y / 240);
      if (w <= 0.05) continue;
      this.pools.push({ x: p.x, r: p.w * 0.55, w });
      wsum += w;
    }
    const m4 = this.m4;
    const n = this.half ? 10 : 24;
    for (let i = 0; i < 24; i++) {
      if (i >= n) {
        m4.makeTranslation(0, -1e5, 0);
        this.splash.setMatrixAt(i, m4);
        continue;
      }
      let x = ix + hash(frame * 131 + i * 17) * SCREEN_W;
      let y = 1;
      let z = -10 + hash(frame * 71 + i * 13) * 240;
      if (this.tops.length && i % 3 === 0) {
        const t = this.tops[(frame + i) % this.tops.length];
        x = t.x0 + hash(i * 7 + frame) * (t.x1 - t.x0);
        y = t.h + 1;
        z = 0;
      } else if (wsum > 0 && i % 4 !== 1) {
        // 빛 웅덩이 고르기 (세기 비례)
        let r = hash(frame * 37 + i * 11) * wsum;
        let pick = this.pools[0];
        for (const p of this.pools) {
          r -= p.w;
          if (r <= 0) {
            pick = p;
            break;
          }
        }
        x = pick.x + (hash(frame * 53 + i * 29) - 0.5) * 2 * pick.r;
        z = -10 + hash(frame * 19 + i * 7) * 140;
      }
      // 화면에서 늘 3×2px (깊이에 따른 배율을 되돌린다)
      const s = 1 / scaleAt(z);
      m4.makeScale(s, s, 1);
      m4.setPosition(Math.round(x), y, z);
      this.splash.setMatrixAt(i, m4);
    }
    this.splash.instanceMatrix.needsUpdate = true;
  }
}
