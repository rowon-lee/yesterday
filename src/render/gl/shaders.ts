import * as THREE from 'three';
import { LIGHT_N, shared } from './lights';

/**
 * 셰이더 조각과 재질 (렌더 전용). 색은 선형으로 계산하고(텍스처는 sRGB로 읽어 선형으로 바꾼다),
 * 마지막 후처리에서 화면 색으로 바꿔 팔레트로 줄인다.
 */
export const LIGHT_GLSL = /* glsl */ `
#define LIGHT_N ${LIGHT_N}
uniform vec4 uLightPos[LIGHT_N];
uniform vec4 uLightCol[LIGHT_N];
uniform int uLightCount;
uniform vec3 uAmbient;
uniform vec3 uAmbientGround;
uniform float uAlbedo;
/**
 * 환경광은 반구: 위(하늘)에서 오는 차가운 남색과 아래(젖은 길)에서 올라오는 더 어두운 빛.
 * 점 광원: 거리에 따라 부드럽게 줄고 (닿는 거리에서 0), 면이 빛을 등지면 어둡다 (조금 감싸 돌게).
 */
vec3 lightAt(vec3 p, vec3 n) {
  vec3 sum = mix(uAmbientGround, uAmbient, n.y * 0.5 + 0.5);
  for (int i = 0; i < LIGHT_N; i++) {
    if (i >= uLightCount) break;
    vec3 L = uLightPos[i].xyz - p;
    float d = length(L);
    float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
    float ndl = clamp(dot(n, L / max(d, 0.001)) * 0.75 + 0.25, 0.0, 1.0);
    sum += uLightCol[i].rgb * (k * k) * ndl;
  }
  return sum;
}
`;

export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uGroundFog;
/** 깊이 안개(먼 것일수록) + 바닥 쪽 거리 안개 */
vec3 applyFog(vec3 col, float depth, float h) {
  float f = clamp((depth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  float g = uGroundFog * exp(-max(h, 0.0) / 50.0);
  return mix(col, uFogColor, clamp(f + g, 0.0, 0.9));
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform sampler2D emissiveMap;
uniform float emissiveStrength;
uniform vec3 tint;
${LIGHT_GLSL}
${FOG_GLSL}
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDepth;
void main() {
  vec4 tex = texture2D(map, vUv);
  if (tex.a < 0.5) discard;
  // 바탕색은 채도를 낮춰 두고 (아트 규칙: 배경은 채도를 낮춘다) 색은 빛이 입힌다
  vec3 alb = mix(vec3(dot(tex.rgb, vec3(0.3, 0.59, 0.11))), tex.rgb, 0.55) * uAlbedo;
  vec3 col = alb * tint * lightAt(vWorld, normalize(vNormal));
  col += texture2D(emissiveMap, vUv).rgb * emissiveStrength;
  // 알파 0: 바닥이 아니다 (화면 반사는 알파에 젖은 정도를 쓴 바닥에만 더한다)
  gl_FragColor = vec4(applyFog(col, vDepth, vWorld.y), 0.0);
}
`;

/** 아무것도 없는 발광 텍스처 (검정 1px) */
const BLACK = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

/** 도트 텍스처를 광원으로 비추는 재질. emissive: 스스로 빛나는 부분(창·네온) */
export function litMaterial(map: THREE.Texture, opts: { emissive?: THREE.Texture; emissiveStrength?: number; tint?: number; side?: THREE.Side } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      map: { value: map },
      emissiveMap: { value: opts.emissive ?? BLACK },
      emissiveStrength: { value: opts.emissiveStrength ?? 1 },
      tint: { value: new THREE.Color(opts.tint ?? 1, opts.tint ?? 1, opts.tint ?? 1) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: opts.side ?? THREE.FrontSide,
  });
}

/** 캔버스(도트 그림) → 텍스처: nearest, 밉맵 없음, sRGB */
export function pixelTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** 투명·가산 재질이 화면 알파(바닥 젖음 = 반사 세기)를 건드리지 않게 하는 섞기 */
function keepAlpha(m: THREE.ShaderMaterial, additive: boolean): THREE.ShaderMaterial {
  m.transparent = true;
  m.depthWrite = false;
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}

/** 먼 겹 판 (빛을 받지 않는 그림): 어둡게 누르고 안개에 묻는다. fog: 0~1 */
export function backdropMaterial(map: THREE.Texture, tint: number, fog: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, map: { value: map }, tint: { value: tint }, fogAmount: { value: fog } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float tint;
      uniform float fogAmount;
      uniform vec3 uFogColor;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.5) discard;
        gl_FragColor = vec4(mix(t.rgb * tint, uFogColor, fogAmount), 0.0);
      }
    `,
  });
}

/**
 * 젖은 바닥: 아스팔트 그림을 빛으로 비추고, 화면 알파에 젖은 정도(반사 세기)를 쓴다.
 * 반사 자체는 후처리(화면 반사)가 이 알파를 보고 더한다. wet: 웅덩이 무늬(빨강 채널), 가로 x·세로 z로 반복.
 */
export function floorMaterial(map: THREE.Texture, mapScale: THREE.Vector2, wet: THREE.Texture, wetScale: THREE.Vector2): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, map: { value: map }, mapScale: { value: mapScale }, wet: { value: wet }, wetScale: { value: wetScale } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec2 mapScale;
      uniform sampler2D wet;
      uniform vec2 wetScale;
      ${LIGHT_GLSL}
      ${FOG_GLSL}
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vDepth;
      /**
       * 바닥 빛 웅덩이: 화면에 보이는 길은 대부분 싸우는 면 앞쪽이라 광원(건물 쪽)과 깊이 차이가 크다.
       * 거의 수평으로 보는 카메라에서는 깊이 차이가 화면에 거의 드러나지 않으므로, 광원과의 깊이 차이를 줄여 재서
       * 가로등·간판 아래 바닥에 빛 웅덩이가 보이게 한다.
       */
      vec3 floorLight(vec3 p) {
        vec3 sum = uAmbientGround;
        for (int i = 0; i < LIGHT_N; i++) {
    if (i >= uLightCount) break;
          vec3 q = vec3(p.x, p.y, mix(p.z, uLightPos[i].z, 0.85));
          vec3 L = uLightPos[i].xyz - q;
          float d = length(L);
          float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
          sum += uLightCol[i].rgb * (k * k) * clamp(L.y / max(d, 0.001) * 0.8 + 0.2, 0.0, 1.0);
        }
        return sum;
      }
      void main() {
        vec3 tex = texture2D(map, vWorld.xz * mapScale).rgb;
        float w = texture2D(wet, vWorld.xz * wetScale).r;
        // 젖은 곳은 바탕이 더 어둡고(물이 덮음) 반사가 세다
        vec3 col = tex * uAlbedo * mix(1.0, 0.55, w) * floorLight(vWorld);
        gl_FragColor = vec4(applyFog(col, vDepth, 0.0), 0.35 + 0.6 * w);
      }
    `,
  });
}

/**
 * 빛줄기 (가로등·전조등 아래로 쏟아지는 빛): 원뿔 표면을 가산으로. 꼭짓점 쪽이 밝고 끝으로 옅어지며,
 * 원뿔 가장자리(시선과 비스듬한 곳)는 흐리게 (연기 속을 지나는 빛). 화면 알파는 건드리지 않는다.
 */
export function shaftMaterial(color: string, strength: number): THREE.ShaderMaterial {
  const c = new THREE.Color(color).convertSRGBToLinear();
  const m = new THREE.ShaderMaterial({
    uniforms: { ...shared, color: { value: c }, strength: { value: strength } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFacing;
      varying vec3 vWorld;
      void main() {
        vAlong = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vec3 v = normalize(cameraPosition - wp.xyz);
        vFacing = abs(dot(n, v));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float strength;
      uniform float uTime;
      varying float vAlong;
      varying float vFacing;
      varying vec3 vWorld;
      void main() {
        float along = pow(vAlong, 1.6);
        float edge = pow(vFacing, 2.0);
        float dust = 0.8 + 0.2 * sin(vWorld.y * 0.21 + uTime * 0.05) * sin(vWorld.x * 0.17 - uTime * 0.03);
        gl_FragColor = vec4(color * strength * along * edge * dust, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
  return keepAlpha(m, true);
}

/** 반투명 판 (안개 카드·증기): 색·세기, 무늬 텍스처의 빨강 채널을 농도로 */
export function hazeMaterial(noise: THREE.Texture, color: string, strength: number, scale: number, lit = true): THREE.ShaderMaterial {
  const c = new THREE.Color(color).convertSRGBToLinear();
  const m = new THREE.ShaderMaterial({
    defines: lit ? { LIT: '' } : {},
    uniforms: {
      ...shared, noise: { value: noise }, color: { value: c }, strength: { value: strength }, drift: { value: new THREE.Vector2(0.0006, 0.00015) },
      noiseScale: { value: new THREE.Vector2(1 / (300 * scale), 1 / (110 * scale)) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D noise;
      uniform vec3 color;
      uniform float strength;
      uniform vec2 drift;
      uniform vec2 noiseScale;
      uniform float uTime;
      ${LIGHT_GLSL}
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float n = texture2D(noise, vWorld.xy * noiseScale + drift * uTime).r;
        // 아래쪽이 짙고 위로 갈수록 옅게
        float a = strength * n * smoothstep(1.0, 0.15, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
        // 안개는 둘레 빛을 받아 밝아진다 (빛 받은 안개). 광원이 닿지 않는 먼 안개 판은 계산하지 않는다
        #ifdef LIT
        vec3 lit = color + lightAt(vWorld, vec3(0.0, 0.0, 1.0)) * 0.6;
        #else
        vec3 lit = color;
        #endif
        gl_FragColor = vec4(lit, a);
      }
    `,
    side: THREE.DoubleSide,
  });
  return keepAlpha(m, false);
}

export { keepAlpha };

/** 빛을 받지 않는 그림 판 (먼지·잔상·이펙트·그림자): 알파 0.5 미만은 버리고, 화면 알파는 0 */
export function flatMaterial(map: THREE.Texture, color?: string): THREE.ShaderMaterial {
  const c = new THREE.Color(color ?? '#ffffff').convertSRGBToLinear();
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: c } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.5) discard;
        gl_FragColor = vec4(t.rgb * color, 0.0);
      }
    `,
    depthWrite: false,
  });
}

/**
 * 캐릭터 판: 시트에서 한 프레임을 잘라 그리고, 가까운 광원 쪽 테두리를 그 빛 색으로 물들인다
 * (이 칸은 차 있고 빛 쪽 한 칸 옆이 비어 있으면 1px 테두리, 두 칸 옆까지 비면 한 줄 더 옅게).
 * 깊이는 쓰지 않는다 (깊이 외곽선이 캐릭터에 덧그어지지 않게, 시트에 이미 외곽선이 있다).
 */
export function spriteMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      frame: { value: new THREE.Vector4(0, 0, 1, 1) },
      texel: { value: new THREE.Vector2(1, 1) },
      rimDir: { value: new THREE.Vector2(0, 0) },
      rimColor: { value: new THREE.Color(0, 0, 0) },
      bright: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec4 frame;
      uniform vec2 texel;
      uniform vec2 rimDir;
      uniform vec3 rimColor;
      uniform float bright;
      varying vec2 vUv;
      void main() {
        vec2 uv = frame.xy + vUv * frame.zw;
        vec4 t = texture2D(map, uv);
        if (t.a < 0.5) discard;
        float n1 = texture2D(map, uv + rimDir * texel).a;
        float n2 = texture2D(map, uv + rimDir * texel * 2.0).a;
        float rim = (1.0 - step(0.5, n1)) + (1.0 - step(0.5, n2)) * step(0.5, n1) * 0.45;
        rim *= step(0.001, abs(rimDir.x) + abs(rimDir.y));
        gl_FragColor = vec4(t.rgb * bright + rimColor * rim, 0.0);
      }
    `,
    depthWrite: false,
  });
}

/**
 * 앞겹 실루엣 (카메라 앞을 스치는 기둥·전선): 아주 어둡게, 화면 가운데로 올수록 디더링으로 사라져
 * 가장자리에서만 보이게 한다 (아트 규칙 '앞겹').
 */
export function fgMaterial(color: string): THREE.ShaderMaterial {
  const c = new THREE.Color(color).convertSRGBToLinear();
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: c }, screenW: { value: 482 } },
    vertexShader: /* glsl */ `
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float screenW;
      float m2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
      float bayer(vec2 p) {
        vec2 q = mod(floor(p), 4.0);
        return (4.0 * m2(mod(q, 2.0)) + m2(floor(q * 0.5)) + 0.5) / 16.0;
      }
      void main() {
        float edge = abs(gl_FragCoord.x / screenW - 0.5) * 2.0;
        float keep = smoothstep(0.45, 0.8, edge);
        if (keep < bayer(gl_FragCoord.xy)) discard;
        gl_FragColor = vec4(color, 0.0);
      }
    `,
  });
}
