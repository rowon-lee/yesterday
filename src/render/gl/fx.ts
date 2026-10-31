import * as THREE from 'three';
import { COLORS as C } from '../palette';
import { canvas, disc } from '../dither';
import { LIGHT_GLSL } from './shaders';
import { LIGHTS_DECL, shared, withLights } from './lights';
import { keepAlpha, pixelTexture, shaftMaterial } from './shaders';

/**
 * 부서지는 물건의 움직이는 연출 (렌더 전용): 불길, 연기, 불꽃 튐, 소화전 물기둥.
 * 모양은 틱만 보고 정해서 같은 틱이면 같은 그림이다. 텍스처를 매 프레임 다시 올리지 않게 셰이더가 도트를 그린다.
 */

const lin = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();

/** 4×4 바이어 무늬 (0~15)와 정수 해시 */
const PIXEL_GLSL = /* glsl */ `
float m2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  return 4.0 * m2(mod(q, 2.0)) + m2(floor(q * 0.5));
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
`;

/**
 * 깜빡이는 불길 (판 하나): 기둥마다 높이가 4틱마다 바뀌고 가운데가 높다. 아래는 붉고 위로 갈수록 노랗게, 끝은 디더링.
 * 판은 폭 w, 높이 maxH. height 유니폼이 지금 불 높이.
 */
export class Flame {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor(w: number, maxH: number, seed: number) {
    this.mat = keepAlpha(new THREE.ShaderMaterial({
      uniforms: {
        uTime: shared.uTime,
        w: { value: w },
        height: { value: maxH },
        seed: { value: seed },
        cRed: { value: lin(C.fxRed) },
        cFlame: { value: lin(C.fxFlame) },
        cOrange: { value: lin(C.fxOrange) },
        cYellow: { value: lin(C.fxYellow) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vLocal;
        void main() {
          vLocal = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float w;
        uniform float height;
        uniform float seed;
        uniform vec3 cRed;
        uniform vec3 cFlame;
        uniform vec3 cOrange;
        uniform vec3 cYellow;
        varying vec2 vLocal;
        ${PIXEL_GLSL}
        void main() {
          float fx = floor(vLocal.x);
          float y = floor(vLocal.y);
          float n = hash11(floor(uTime / 4.0) * 131.0 + fx * 17.0 + seed * 7.0);
          float fh = floor(height * (0.4 + 0.6 * n) * sin(3.14159 * (fx + 0.5) / w) + 0.5);
          if (y >= fh || fh <= 0.0) discard;
          float k = y / max(1.0, fh);
          if (k > 0.8 && bayer(vec2(fx, -y + floor(uTime / 2.0))) >= 9.0) discard;
          vec3 c = k < 0.35 ? cRed : k < 0.65 ? cFlame : k < 0.85 ? cOrange : cYellow;
          gl_FragColor = vec4(c * 1.6, 1.0);
        }
      `,
    }), false);
    this.mat.transparent = false;
    this.mat.depthWrite = false;
    const geo = new THREE.PlaneGeometry(w, maxH);
    geo.translate(w / 2, maxH / 2, 0);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  /** 불길 왼쪽 아래 (월드), 지금 높이. h가 0이면 끈다 */
  set(x: number, y: number, z: number, h: number): void {
    this.mesh.visible = h > 0;
    if (h <= 0) return;
    this.mesh.position.set(Math.round(x), Math.round(y), z);
    this.mat.uniforms.height.value = h;
  }
}

/**
 * 뭉게뭉게 피어오르는 연기 뭉치 (디더링 원 그림을 여러 개): 둘레 빛을 받아 밝아진다 (불길 빛을 받은 연기).
 * 프레임마다 begin → add … → end.
 */
export class Puffs {
  readonly mesh: THREE.InstancedMesh;
  private readonly fade: THREE.InstancedBufferAttribute;
  private n = 0;
  private readonly m4 = new THREE.Matrix4();

  constructor(private readonly max: number, light: string, dark: string, order: number, alpha = 0.6) {
    const [c, g] = canvas(32, 32);
    for (let r = 15; r >= 3; r -= 4) disc(g, 16, 16, r, r > 11 ? dark : r > 7 ? light : light, r > 11 ? 6 : r > 7 ? 10 : 14);
    const mat = keepAlpha(withLights(new THREE.ShaderMaterial({
      uniforms: { ...shared, map: { value: pixelTexture(c) }, alpha: { value: alpha } },
      vertexShader: /* glsl */ `
        ${LIGHTS_DECL}
        uniform vec3 uAmbient;
        attribute float fade;
        varying vec2 vUv;
        varying vec3 vLight;
        varying float vFade;
        void main() {
          vUv = uv;
          vFade = fade;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 lit = uAmbient * 3.0;
          for (int i = 0; i < LIGHT_N; i++) {
            if (float(i) >= uLightCount) break;
            float d = length(uLightPos[i].xyz - wp.xyz);
            float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
            lit += uLightCol[i].rgb * k * k;
          }
          vLight = lit;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float alpha;
        varying vec2 vUv;
        varying vec3 vLight;
        varying float vFade;
        void main() {
          vec4 t = texture2D(map, vUv);
          if (t.a < 0.5) discard;
          gl_FragColor = vec4(t.rgb * (0.3 + vLight), alpha * vFade);
        }
      `,
    })), false);
    mat.transparent = false;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('fade', this.fade);
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  add(x: number, y: number, z: number, size: number, fade: number): void {
    if (this.n >= this.max || fade <= 0.02) return;
    this.m4.makeScale(size, size, 1);
    this.m4.setPosition(Math.round(x), Math.round(y), z);
    this.mesh.setMatrixAt(this.n, this.m4);
    this.fade.setX(this.n, fade);
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fade.needsUpdate = true;
  }
}

/** 튀는 불꽃·물방울 (1px 점 여러 개, 스스로 빛남). 프레임마다 begin → add … → end */
export class Sparks {
  readonly mesh: THREE.InstancedMesh;
  private readonly color: THREE.InstancedBufferAttribute;
  private n = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly tmp = new THREE.Color();

  constructor(private readonly max: number) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 tint;
        varying vec3 vTint;
        void main() {
          vTint = tint;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vTint;
        void main() { gl_FragColor = vec4(vTint, 0.0); }
      `,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0.5, 0.5, 0);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    geo.setAttribute('tint', this.color);
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  /** 점 하나 (월드, 왼쪽 아래 모서리), 색, 세기 (1이면 팔레트 색 그대로, 크면 빛 번짐) */
  add(x: number, y: number, z: number, color: string, k = 1.4, w = 1, h = 1): void {
    if (this.n >= this.max) return;
    this.m4.makeScale(w, h, 1);
    this.m4.setPosition(Math.round(x), Math.round(y), z);
    this.mesh.setMatrixAt(this.n, this.m4);
    this.tmp.set(color).convertSRGBToLinear();
    this.color.setXYZ(this.n, this.tmp.r * k, this.tmp.g * k, this.tmp.b * k);
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.color.needsUpdate = true;
  }
}

/**
 * 소화전 물기둥 (판 하나): 위로 갈수록 퍼지고 12틱 주기로 출렁인다. 가운데 줄기는 밝고 끝은 디더링으로 옅게.
 * 둘레 빛을 받아 그 빛 색으로 반짝인다.
 */
export class WaterColumn {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  static readonly MAX = 84;

  constructor() {
    this.mat = withLights(new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        height: { value: 40 },
        cLight: { value: lin(C.skyLight) },
        cWater: { value: lin(C.sky) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vLocal;
        varying vec3 vWorld;
        void main() {
          vLocal = position.xy;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float height;
        uniform vec3 cLight;
        uniform vec3 cWater;
        uniform float uTime;
        ${LIGHT_GLSL}
        varying vec2 vLocal;
        varying vec3 vWorld;
        ${PIXEL_GLSL}
        void main() {
          float dx = floor(vLocal.x);
          float y = floor(vLocal.y);
          if (y >= height) discard;
          float ph = mod(uTime, 12.0);
          float spread = floor(2.0 + (y / height) * 3.0 + sin((ph + y) * 3.14159 / 6.0) + 0.5);
          if (dx < -spread || dx > spread + 1.0) discard;
          float k = y / height;
          float level = k > 0.8 ? 6.0 : 12.0;
          if (bayer(vec2(dx, -y + ph)) >= level) discard;
          vec3 c = (abs(dx) <= 1.0 && k < 0.7) ? cLight : cWater;
          vec3 lit = lightAt(vWorld, vec3(0.0, 0.0, 1.0));
          gl_FragColor = vec4(c * (0.4 + lit * 0.7), 0.0);
        }
      `,
    }));
    const geo = new THREE.PlaneGeometry(20, WaterColumn.MAX);
    geo.translate(0, WaterColumn.MAX / 2, 0);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  /** 물기둥 가운데 아래 (월드), 높이. h가 0이면 끈다 */
  set(x: number, y: number, z: number, h: number): void {
    this.mesh.visible = h > 0;
    if (h <= 0) return;
    this.mesh.position.set(Math.round(x), Math.round(y), z);
    this.mat.uniforms.height.value = h;
  }
}

/**
 * 쓸고 지나가는 빛줄기 (서치라이트·등대): 원뿔 끝이 광원에 있고 위로 벌어진다. aim(각)으로 기울인다
 * (0이면 곧장 위, +면 왼쪽으로). 빛줄기는 가산이라 화면 알파(젖음)를 건드리지 않는다.
 */
export class Beam {
  readonly pivot = new THREE.Group();
  readonly mesh: THREE.Mesh;

  constructor(length: number, radius: number, color: string, strength: number, order = 2) {
    const geo = new THREE.ConeGeometry(radius, length, 18, 1, true);
    geo.rotateZ(Math.PI);
    geo.translate(0, length / 2, 0);
    const mat = shaftMaterial(color, strength);
    mat.transparent = false;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = order;
    this.pivot.add(this.mesh);
  }

  aim(angle: number): void {
    this.pivot.rotation.z = angle;
  }
}
