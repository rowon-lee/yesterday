import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { shared, withLights } from './lights';
import { keepAlpha, LIGHT_GLSL, NOISE_GLSL } from './shaders';

/**
 * 하수구 증기 (렌더 전용): 맨홀마다 김 한 줄기가 솟아올라 위로 갈수록 넓게 퍼지며 흩어진다.
 * 그림을 키워 쓰지 않고 칸마다 계산한다 (픽셀 크기 하나): 김 무늬가 위로 흘러가고, 줄기가 바람에 조금씩 흔들리며,
 * 몇 초마다 한 번씩 세게 뿜는다. 가장자리는 무늬가 갉아 먹어 부드럽게 사라진다 (둥근 공이 줄지어 뜨지 않게).
 * 둘레 빛을 받아 밝아진다 (가로등 아래에서는 그 빛 색으로, 어둠 속에서는 옅은 잿빛으로).
 * 판 자리는 처음 한 번만 정하고 매 프레임 올리는 것이 없다 (시간은 공용 uTime).
 */
const W = 96;
const H = 120;

export class Steam {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly vents: Array<{ x: number; z: number }>;

  constructor() {
    this.vents = D.street.props.filter((p) => p.kind === 'manhole').map((p) => ({ x: p.x + 9, z: -16 }));
    const mat = keepAlpha(withLights(new THREE.ShaderMaterial({
      uniforms: { ...shared, steamColor: { value: new THREE.Color('#a8adb8').convertSRGBToLinear() } },
      vertexShader: /* glsl */ `
        attribute float seed;
        varying vec2 vLocal;
        varying vec3 vWorld;
        varying float vSeed;
        void main() {
          vLocal = vec2(position.x * ${W.toFixed(1)}, (position.y + 0.5) * ${H.toFixed(1)});
          vSeed = seed;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 steamColor;
        uniform float uTime;
        ${LIGHT_GLSL}
        ${NOISE_GLSL}
        varying vec2 vLocal;
        varying vec3 vWorld;
        varying float vSeed;
        void main() {
          float y = vLocal.y;
          float h = y / ${H.toFixed(1)};
          // 줄기: 위로 갈수록 넓어지고 바람에 흔들린다
          float sway = sin(uTime * 0.021 + vSeed * 6.0 - y * 0.045) * (1.5 + y * 0.06) + y * 0.08;
          float half_ = 3.0 + y * 0.26;
          float x = (vLocal.x - sway) / half_;
          // 위로 흘러가는 김 무늬 (화면 9~11px 알갱이 두 겹)
          vec2 q = vec2(vLocal.x / 9.0, (y - uTime * 0.42) / 11.0) + vSeed * 13.0;
          float n = vnoise(q) * 0.6 + vnoise(q * vec2(2.1, 1.9) + vec2(5.3, -uTime * 0.01)) * 0.4;
          float body = 1.0 - smoothstep(0.25 + 0.55 * n, 1.1, abs(x));
          // 맨홀에서 솟아 위로 갈수록 흩어진다 (높이 올라갈수록 덩어리가 끊긴다)
          float life = smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(0.3, 1.0, h));
          float wisp = smoothstep(0.3, 0.7, n + 0.3 * (1.0 - h));
          // 몇 초마다 세게 뿜는다 (뿜은 김이 위로 올라간다)
          float gust = 0.55 + 0.45 * smoothstep(-0.2, 1.0, sin(uTime * 0.012 + vSeed * 3.0 - y * 0.03));
          float a = 0.55 * body * life * wisp * gust;
          if (a < 0.02) discard;
          // 빛 받은 김: 어둠 속에서는 도시 불빛을 받아 옅은 잿빛으로, 가로등·간판 빛 속에서는 그 빛 색으로 밝아진다
          vec3 lit = vec3(0.09) + uAmbient * 1.6 + directAt(vWorld, vec3(0.0, 0.0, 1.0)) * 1.2;
          gl_FragColor = vec4(steamColor * lit * (0.75 + 0.5 * (1.0 - n)), a);
        }
      `,
    })), false);
    mat.transparent = false;
    const n = Math.max(1, this.vents.length);
    const geo = new THREE.PlaneGeometry(1, 1);
    const seeds = new Float32Array(n);
    this.vents.forEach((_, i) => {
      seeds[i] = (i * 0.618) % 1;
    });
    geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    const m4 = new THREE.Matrix4();
    this.vents.forEach((v, i) => {
      m4.makeScale(W, H, 1);
      m4.setPosition(v.x, H / 2, v.z);
      this.mesh.setMatrixAt(i, m4);
    });
    this.mesh.count = this.vents.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
  }

  /** 매 프레임: 할 일이 없다 (김은 공용 시간 uTime으로 셰이더가 움직인다) */
  update(_tick: number): void {
    // 셰이더가 시간만 보고 그린다
  }
}
