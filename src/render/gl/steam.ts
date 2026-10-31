import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { canvas, disc } from '../stage/dither';
import { COLORS as C } from '../palette';
import { LIGHT_N, shared } from './lights';
import { keepAlpha, pixelTexture } from './shaders';

/**
 * 하수구 증기 (렌더 전용): 맨홀마다 뭉치 여섯 개가 차례로 솟아 퍼지며 옅어진다.
 * 뭉치는 디더링한 원 그림이고, 둘레 빛을 받아 밝아진다 (빛 받은 증기).
 */
const PUFFS = 6;

export class Steam {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly vents: Array<{ x: number; z: number }>;

  constructor() {
    this.vents = D.street.props.filter((p) => p.kind === 'manhole').map((p) => ({ x: p.x + 9, z: -16 }));
    const [c, g] = canvas(32, 32);
    // 디더링한 원 (가운데가 짙다): 알파는 바둑판 무늬로 성기게
    for (let r = 15; r >= 3; r -= 4) disc(g, 16, 16, r, r > 11 ? C.smoke : r > 7 ? C.stone : C.paintCream, r > 11 ? 5 : r > 7 ? 9 : 13);
    const tex = pixelTexture(c);
    const mat = keepAlpha(new THREE.ShaderMaterial({
      uniforms: { ...shared, map: { value: tex } },
      vertexShader: /* glsl */ `
        #define LIGHT_N ${LIGHT_N}
        uniform vec4 uLightPos[LIGHT_N];
        uniform vec4 uLightCol[LIGHT_N];
uniform int uLightCount;
        uniform vec3 uAmbient;
        attribute float fade;
        varying vec2 vUv;
        varying vec3 vLight;
        varying float vFade;
        void main() {
          vUv = uv;
          vFade = fade;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 lit = uAmbient * 4.0;
          for (int i = 0; i < LIGHT_N; i++) {
    if (i >= uLightCount) break;
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
        varying vec2 vUv;
        varying vec3 vLight;
        varying float vFade;
        void main() {
          vec4 t = texture2D(map, vUv);
          if (t.a < 0.5) discard;
          gl_FragColor = vec4(t.rgb * (0.35 + vLight), 0.55 * vFade);
        }
      `,
    }), false);
    mat.transparent = false;
    const n = Math.max(1, this.vents.length * PUFFS);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute('fade', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.group.add(this.mesh);
  }

  update(tick: number): void {
    const m4 = new THREE.Matrix4();
    const fade = this.mesh.geometry.getAttribute('fade') as THREE.InstancedBufferAttribute;
    this.vents.forEach((v, vi) => {
      for (let p = 0; p < PUFFS; p++) {
        const life = 90;
        const age = (tick * 0.8 + p * (life / PUFFS) + vi * 29) % life;
        const k = age / life;
        const x = v.x + Math.sin((age + vi * 13) * 0.08) * 3 + age * 0.15;
        const y = 2 + age * 0.7;
        const size = 8 + k * 22;
        m4.makeScale(size, size, 1);
        m4.setPosition(Math.round(x), Math.round(y), v.z + p * 0.1);
        this.mesh.setMatrixAt(vi * PUFFS + p, m4);
        fade.setX(vi * PUFFS + p, Math.max(0, 1 - k) * (k < 0.1 ? k * 10 : 1));
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    fade.needsUpdate = true;
  }
}
