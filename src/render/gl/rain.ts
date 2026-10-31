import * as THREE from 'three';
import { SURFACES } from '../../stage/citadel';
import { SCREEN_H, SCREEN_W } from '../screen';
import { hash } from '../stage/dither';
import { scaleAt } from './core';
import { shared, LIGHT_N } from './lights';
import { keepAlpha } from './shaders';

/**
 * 비 (렌더 전용): 얇고 무채색인 빗줄기 세 겹 (먼 겹·싸우는 면 바로 뒤·카메라 앞).
 * 빗줄기 자리는 화면 좌표로 정하고(틱만 보고 정하므로 같은 틱이면 같은 그림) 그 겹의 깊이로 되돌려 놓는다.
 * 빛 밖에서는 거의 보이지 않고, 광원 가까이에서만 그 빛 색으로 반짝인다 (꼭짓점마다 광원 배열로 밝기를 잰다).
 * 바닥과 발판 위에는 물방울이 튄다.
 */
const SLANT = 0.22;

interface RainLayer {
  z: number;
  n: number;
  /** 떨어지는 속도(px/틱), 길이(px), 카메라 따라 옆으로 흐르는 비율 */
  v: number;
  len: number;
  cam: number;
  order: number;
  base: number;
}

const LAYERS: readonly RainLayer[] = [
  { z: -420, n: 150, v: 5, len: 5, cam: 0.3, order: 3, base: 0.05 },
  { z: -20, n: 90, v: 8, len: 8, cam: 0.8, order: 3, base: 0.07 },
  { z: 900, n: 26, v: 13, len: 14, cam: 1.4, order: 20, base: 0.09 },
];

const RAIN_VERT = /* glsl */ `
#define LIGHT_N ${LIGHT_N}
uniform vec4 uLightPos[LIGHT_N];
uniform vec4 uLightCol[LIGHT_N];
uniform int uLightCount;
uniform float uTime;
uniform vec2 camCenter;
uniform vec2 camTopLeft;
uniform float depth;
uniform float scale;
uniform float speed;
uniform float len;
uniform float camFollow;
uniform float base;
attribute vec2 seed;
varying vec3 vColor;
void main() {
  float span = ${SCREEN_H.toFixed(1)} + len + 20.0;
  float wspan = ${SCREEN_W.toFixed(1)} + 60.0;
  float sy = mod(seed.y * span + uTime * speed, span) - len - 10.0;
  float sx = mod(seed.x * wspan - camTopLeft.x * camFollow + sy * ${SLANT.toFixed(2)}, wspan) - 30.0;
  // position.y: 0(위 끝) ~ 1(아래 끝), position.x: -0.5 ~ 0.5 (폭 1px)
  float py = sy + position.y * len;
  float px = sx + position.y * len * ${SLANT.toFixed(2)} + position.x;
  vec3 world = vec3(camCenter.x + (px - ${(SCREEN_W / 2).toFixed(1)}) / scale, camCenter.y - (py - ${(SCREEN_H / 2).toFixed(1)}) / scale, depth);
  vec3 lit = vec3(0.0);
  for (int i = 0; i < LIGHT_N; i++) {
    if (i >= uLightCount) break;
    float d = length(uLightPos[i].xyz - world);
    float k = clamp(1.0 - d / (uLightPos[i].w * 1.15), 0.0, 1.0);
    lit += uLightCol[i].rgb * k * k;
  }
  vColor = vec3(0.62, 0.66, 0.72) * base + lit * 0.9;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const RAIN_FRAG = /* glsl */ `
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.0); }
`;

export class Rain {
  readonly group = new THREE.Group();
  private readonly mats: THREE.ShaderMaterial[] = [];
  private readonly splash: THREE.InstancedMesh;
  private readonly splashMat: THREE.ShaderMaterial;
  private half = false;

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
      const mat = keepAlpha(new THREE.ShaderMaterial({
        uniforms: {
          ...shared,
          camCenter: { value: new THREE.Vector2() },
          camTopLeft: { value: new THREE.Vector2() },
          depth: { value: L.z },
          scale: { value: scaleAt(L.z) },
          speed: { value: L.v },
          len: { value: L.len },
          camFollow: { value: L.cam },
          base: { value: L.base },
        },
        vertexShader: RAIN_VERT,
        fragmentShader: RAIN_FRAG,
        side: THREE.DoubleSide,
      }), true);
      mat.transparent = false;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = L.order;
      this.mats.push(mat);
      this.group.add(mesh);
    }
    // 물방울: 3×2 '^' 모양 작은 판 (바닥과 보이는 발판 위)
    const sg = new THREE.PlaneGeometry(3, 2);
    this.splashMat = keepAlpha(new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: /* glsl */ `
        #define LIGHT_N ${LIGHT_N}
        uniform vec4 uLightPos[LIGHT_N];
        uniform vec4 uLightCol[LIGHT_N];
uniform int uLightCount;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 lit = vec3(0.0);
          for (int i = 0; i < LIGHT_N; i++) {
    if (i >= uLightCount) break;
            float d = length(uLightPos[i].xyz - wp.xyz);
            float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
            lit += uLightCol[i].rgb * k * k;
          }
          vColor = vec3(0.5, 0.55, 0.62) * 0.18 + lit * 0.8;
          gl_Position = projectionMatrix * viewMatrix * wp;
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
    }), true);
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

  update(tick: number, camCenterX: number, camCenterY: number, ix: number, iy: number): void {
    for (const m of this.mats) {
      m.uniforms.camCenter.value.set(camCenterX, camCenterY);
      m.uniforms.camTopLeft.value.set(ix, iy);
    }
    // 물방울: 3틱마다 자리를 바꾼다. 셋 중 하나는 화면에 보이는 발판 위
    const frame = Math.floor(tick / 3);
    const tops = SURFACES.filter((sf) => sf.x1 > ix && sf.x0 < ix + SCREEN_W);
    const m4 = new THREE.Matrix4();
    const n = this.half ? 10 : 24;
    for (let i = 0; i < 24; i++) {
      if (i >= n) {
        m4.makeTranslation(0, -1e5, 0);
        this.splash.setMatrixAt(i, m4);
        continue;
      }
      let x = ix + hash(frame * 131 + i * 17) * SCREEN_W;
      let y = 1;
      let z = -10 + hash(frame * 71 + i * 13) * 320;
      if (tops.length && i % 3 === 0) {
        const t = tops[(frame + i) % tops.length];
        x = t.x0 + hash(i * 7 + frame) * (t.x1 - t.x0);
        y = t.h + 1;
        z = 0;
      }
      m4.makeTranslation(Math.round(x), y, z);
      this.splash.setMatrixAt(i, m4);
    }
    this.splash.instanceMatrix.needsUpdate = true;
  }
}
