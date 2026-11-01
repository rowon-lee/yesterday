import * as THREE from 'three';
import { GONE_N, LIGHTS_DECL, shared, withLights } from './lights';

/**
 * 셰이더 조각과 재질 (렌더 전용). 색은 선형으로 계산하고(텍스처는 sRGB로 읽어 선형으로 바꾼다),
 * 마지막 후처리에서 화면 색으로 바꿔 팔레트로 줄인다.
 */
export const LIGHT_GLSL = /* glsl */ `
${LIGHTS_DECL}
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
    if (float(i) >= uLightCount) break;
    vec3 L = uLightPos[i].xyz - p;
    float d = length(L);
    float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
    float ndl = clamp(dot(n, L / max(d, 0.001)) * 0.75 + 0.25, 0.0, 1.0);
    // 아래로만 비추는 등: 광원 바로 아래가 가장 밝고, 광원 높이 근처의 벽은 비추지 않는다
    float spot = uLightCol[i].w > 1.5 ? smoothstep(0.25, 0.75, L.y / max(d, 0.001)) : 1.0;
    sum += uLightCol[i].rgb * (k * k) * ndl * spot;
  }
  return sum;
}
/**
 * lightAt과 같고, 젖은 면의 반짝임(빛 쪽으로 기운 결에 맺히는 하이라이트)을 spec에 더한다. v: 카메라 쪽 방향
 */
vec3 lightAtSpec(vec3 p, vec3 n, vec3 v, float wet, inout vec3 spec) {
  vec3 sum = mix(uAmbientGround, uAmbient, n.y * 0.5 + 0.5);
  for (int i = 0; i < LIGHT_N; i++) {
    if (float(i) >= uLightCount) break;
    vec3 L = uLightPos[i].xyz - p;
    float d = length(L);
    float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
    if (k <= 0.0) continue;
    vec3 l = L / max(d, 0.001);
    float ndl = clamp(dot(n, l) * 0.75 + 0.25, 0.0, 1.0);
    float spot = uLightCol[i].w > 1.5 ? smoothstep(0.25, 0.75, l.y) : 1.0;
    vec3 c = uLightCol[i].rgb * (k * k) * spot;
    sum += c * ndl;
    // 반짝임은 센 빛 4개까지만 (광원 배열은 센 순서로 실린다)
    if (i < 4) {
      vec3 h = normalize(l + v);
      spec += c * pow(clamp(dot(n, h), 0.0, 1.0), 26.0) * wet;
    }
  }
  return sum;
}
`;

export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uGroundFog;
/** 안개 짙기 (0~0.9): 깊이 안개(먼 것일수록) + 바닥 쪽 거리 안개 */
float fogK(float depth, float h) {
  float f = clamp((depth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  float g = uGroundFog * exp(-max(h, 0.0) / 50.0);
  return clamp(f + g, 0.0, 0.9);
}
vec3 applyFog(vec3 col, float depth, float h) {
  return mix(col, uFogColor, fogK(depth, h));
}
`;

const VERT = /* glsl */ `
#ifdef ATTACHED
// 붙은 건물 (번호 + 1)과 칸. 0이면 어디에도 붙지 않음
attribute vec2 bc;
uniform float uGone[${GONE_N}];
#endif
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
#ifdef ATTACHED
  // 그 칸이 무너졌으면 화면 밖으로 (삼각형이 통째로 잘려 나간다)
  if (bc.x > 0.5) {
    float m = uGone[int(bc.x + 0.5) - 1];
    if (mod(floor(m / exp2(bc.y)), 2.0) > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
#endif
}
`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform sampler2D emissiveMap;
uniform float emissiveStrength;
uniform vec3 tint;
uniform float bump;
uniform float wet;
${LIGHT_GLSL}
${FOG_GLSL}
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDepth;
#ifdef CLIPX
uniform vec2 clipX;
#endif
void main() {
#ifdef CLIPX
  // 이 x 구간 밖은 그리지 않는다 (선로 끝에서 사라지는 전차)
  if (vWorld.x < clipX.x || vWorld.x > clipX.y) discard;
#endif
  vec4 tex = texture2D(map, vUv);
  if (tex.a < 0.5) discard;
  // 바탕색은 채도를 낮춰 두고 (아트 규칙: 배경은 채도를 낮춘다) 색은 빛이 입힌다
  vec3 alb = mix(vec3(dot(tex.rgb, vec3(0.3, 0.59, 0.11))), tex.rgb, 0.55) * uAlbedo;
  vec3 n = normalize(vNormal);
#ifdef DETAIL
  // 벽 결: 도트 그림의 밝기를 높이로 보고(줄눈·창틀 홈은 낮고 벽돌 면은 높다) 칸마다 면을 기울인다.
  // 빛이 움직이면 벽돌 결과 창틀 모서리를 따라 밝고 어두운 면이 생긴다 (품질 높음에서만: setDetail)
  if (bump > 0.0) {
    vec2 ts = 1.0 / vec2(textureSize(map, 0));
    vec3 W = vec3(0.3, 0.59, 0.11);
    float h0 = dot(tex.rgb, W);
    float hr = dot(texture2D(map, vUv + vec2(ts.x, 0.0)).rgb, W);
    float hu = dot(texture2D(map, vUv + vec2(0.0, ts.y)).rgb, W);
    vec3 nt = normalize(vec3((h0 - hr) * bump * 8.0, (h0 - hu) * bump * 8.0, 1.0));
    // 면의 결 방향: 무대는 거의 상자와 판이라 면 방향만 보고 정한다 (상자 그림의 u·v 방향, 화면 미분 없이)
    vec3 an = abs(n);
    vec3 T = an.z >= max(an.x, an.y) ? vec3(sign(n.z), 0.0, 0.0) : an.x >= an.y ? vec3(0.0, 0.0, -sign(n.x)) : vec3(1.0, 0.0, 0.0);
    vec3 B = an.y > max(an.x, an.z) ? vec3(0.0, 0.0, -sign(n.y)) : vec3(0.0, 1.0, 0.0);
    n = normalize(mat3(T, B, n) * nt);
  }
  // 비에 젖은 면은 빛 쪽으로 기운 결마다 반짝인다
  vec3 spec = vec3(0.0);
  vec3 col = alb * tint * lightAtSpec(vWorld, n, normalize(cameraPosition - vWorld), wet, spec);
  col += spec;
#else
  vec3 col = alb * tint * lightAt(vWorld, n);
#endif
  // 스스로 빛나는 것(창·네온·로비)은 안개를 덜 먹는다: 빛이 안개를 뚫고 나와 색이 살아 있다
  float fk = fogK(vDepth, vWorld.y);
  vec3 em = texture2D(emissiveMap, vUv).rgb * emissiveStrength;
  // 알파 0: 바닥이 아니다 (화면 반사는 알파에 젖은 정도를 쓴 바닥에만 더한다)
  gl_FragColor = vec4(mix(col, uFogColor, fk) + em * (1.0 - 0.5 * fk), 0.0);
}
`;

/** 품질에 따라 벽 결·젖은 반짝임을 넣고 빼는 재질들 (DETAIL 정의를 바꿔 다시 컴파일한다) */
const detailed: THREE.ShaderMaterial[] = [];
let detailOn = true;
/** 품질 높음이면 벽 결·젖은 반짝임을 켠다. 바뀔 때만 재질을 다시 컴파일한다 (품질은 보통 한 번만 바뀐다) */
export function setDetail(on: boolean): void {
  if (on === detailOn) return;
  detailOn = on;
  for (const m of detailed) {
    if (on) m.defines.DETAIL = '';
    else delete m.defines.DETAIL;
    m.needsUpdate = true;
  }
}

/** 아무것도 없는 발광 텍스처 (검정 1px) */
const BLACK = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

/**
 * 도트 텍스처를 광원으로 비추는 재질. emissive: 스스로 빛나는 부분(창·네온).
 * attached: 건물에 붙은 기하 (무너진 칸을 지운다, kit.ts의 Geo), clip: 이 x 구간 밖은 그리지 않는다
 */
export function litMaterial(
  map: THREE.Texture,
  opts: {
    emissive?: THREE.Texture; emissiveStrength?: number; tint?: number; side?: THREE.Side; attached?: boolean; clip?: [number, number];
    /** 벽 결 세기 (0이면 끔), 젖은 반짝임 세기 */
    bump?: number; wet?: number;
  } = {},
): THREE.ShaderMaterial {
  const defines: Record<string, string> = {};
  if (detailOn) defines.DETAIL = '';
  if (opts.attached) defines.ATTACHED = '';
  if (opts.clip) defines.CLIPX = '';
  const m = new THREE.ShaderMaterial({
    defines,
    uniforms: {
      ...shared,
      map: { value: map },
      emissiveMap: { value: opts.emissive ?? BLACK },
      emissiveStrength: { value: opts.emissiveStrength ?? 1 },
      tint: { value: new THREE.Color(opts.tint ?? 1, opts.tint ?? 1, opts.tint ?? 1) },
      clipX: { value: new THREE.Vector2(...(opts.clip ?? [-1e9, 1e9])) },
      bump: { value: opts.bump ?? 1 },
      wet: { value: opts.wet ?? 0.35 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: opts.side ?? THREE.FrontSide,
  });
  // 붙은 자리가 없는 기하(보통 상자·판)에서는 '어디에도 붙지 않음'으로 읽게
  if (opts.attached) (m as unknown as { defaultAttributeValues: Record<string, number[]> }).defaultAttributeValues = { ...m.defaultAttributeValues, bc: [0, 0] };
  detailed.push(m);
  return withLights(m);
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

/** 먼 겹 안개 덩어리 무늬 (64×64 값 잡음, 부드럽게 늘여 쓴다: 안개는 흐림을 허용한다). 모든 먼 겹이 함께 쓴다 */
let bankTex: THREE.DataTexture | null = null;
function fogBankNoise(): THREE.DataTexture {
  if (bankTex) return bankTex;
  const N = 64;
  const d = new Uint8Array(N * N * 4);
  const h = (x: number, y: number): number => {
    const s2 = Math.sin(((x % N) + N) % N * 127.1 + (((y % N) + N) % N) * 311.7) * 43758.5453;
    return s2 - Math.floor(s2);
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // 두 겹 값 잡음 (큰 덩어리 + 작은 덩어리), 끝이 이어지게
      let v = 0;
      for (const [cell, w] of [[16, 0.65], [8, 0.35]] as const) {
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        const fx = (x % cell) / cell;
        const fy = (y % cell) / cell;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const n = N / cell;
        const g = (a: number, b: number): number => h(((a % n) + n) % n * cell, ((b % n) + n) % n * cell);
        const top = g(gx, gy) + (g(gx + 1, gy) - g(gx, gy)) * sx;
        const bot = g(gx, gy + 1) + (g(gx + 1, gy + 1) - g(gx, gy + 1)) * sx;
        v += (top + (bot - top) * sy) * w;
      }
      const o = (y * N + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = Math.round(v * 255);
      d[o + 3] = 255;
    }
  }
  bankTex = new THREE.DataTexture(d, N, N);
  bankTex.wrapS = THREE.RepeatWrapping;
  bankTex.wrapT = THREE.RepeatWrapping;
  bankTex.magFilter = THREE.LinearFilter;
  bankTex.minFilter = THREE.LinearFilter;
  bankTex.needsUpdate = true;
  return bankTex;
}

/** 칸 단위 값 잡음 (0~1). 셰이더 안개·구름에서 함께 쓴다 */
export const NOISE_GLSL = /* glsl */ `
float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * 먼 겹 판 (빛을 받지 않는 그림): 어둡게 누르고 안개에 묻는다. fog: 0~1, glowMix: 안개가 지평선 도시 불빛 색을 얼마나 띠는지.
 * 안개는 그림에 칠하지 않고 여기서 덮는다 (점무늬 없이 이어지게): 겹 아래쪽(바닥 안개)이 짙고, 안개 덩어리가 천천히 흐른다.
 * 불 켜진 창처럼 밝은 칸은 안개를 뚫고 빛난다.
 */
export function backdropMaterial(map: THREE.Texture, tint: number, fog: number, glowMix = 0.5): THREE.ShaderMaterial {
  const img = map.image as HTMLCanvasElement;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared, map: { value: map }, tint: { value: tint }, fogAmount: { value: fog }, glowMix: { value: glowMix },
      texSize: { value: new THREE.Vector2(img.width, img.height) }, bankNoise: { value: fogBankNoise() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float tint;
      uniform float fogAmount;
      uniform float glowMix;
      uniform vec2 texSize;
      uniform vec3 uFogColor;
      uniform vec3 uFogGlow;
      uniform float uMist;
      uniform float uTime;
      uniform sampler2D bankNoise;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.5) discard;
        vec2 p = floor(vUv * texSize);
        float l = dot(t.rgb, vec3(0.3, 0.59, 0.11));
        float resist = smoothstep(0.12, 0.4, l);
        float mist = uMist * (1.0 - smoothstep(0.0, 0.42, vUv.y));
        float bank = 0.72 + 0.56 * texture2D(bankNoise, vec2(p.x / 4480.0 + uTime * 0.00001, p.y / 1408.0)).r;
        float f = clamp((fogAmount + mist * 0.55) * bank, 0.0, 0.96) * (1.0 - resist * 0.7);
        vec3 fogCol = mix(uFogColor, uFogGlow, glowMix * (1.0 - vUv.y * 0.6));
        vec3 c = t.rgb * tint * (1.0 + resist * 2.0);
        gl_FragColor = vec4(mix(c, fogCol, f), 0.0);
      }
    `,
  });
}

/**
 * 바닥 빛 웅덩이: 화면에 보이는 길은 대부분 싸우는 면 앞쪽이라 광원(건물 쪽)과 깊이 차이가 크다.
 * 거의 수평으로 보는 카메라에서는 깊이 차이가 화면에 거의 드러나지 않으므로, 광원과의 깊이 차이를 줄여 재서
 * 가로등·간판 아래 바닥에 빛 웅덩이가 보이게 한다.
 */
const FLOOR_LIGHT_GLSL = /* glsl */ `
/** 젖은 길의 물기에 번진 빛 (바탕색과 상관없이 더한다): floorLight가 함께 채운다 */
vec3 floorSheen = vec3(0.0);
vec3 floorLight(vec3 p) {
  vec3 sum = vec3(0.0);
  floorSheen = vec3(0.0);
  for (int i = 0; i < LIGHT_N; i++) {
    if (float(i) >= uLightCount) break;
    vec3 q = vec3(p.x, p.y, mix(p.z, uLightPos[i].z, 0.85));
    vec3 L = uLightPos[i].xyz - q;
    float d = length(L);
    float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
    float spot = uLightCol[i].w > 1.5 ? 1.25 : 1.0;
    vec3 c = uLightCol[i].rgb * (k * k) * spot;
    sum += c * clamp(L.y / max(d, 0.001) * 0.8 + 0.2, 0.0, 1.0);
    floorSheen += c;
  }
  // 젖은 길은 가까운 빛을 넓게 번져 받는다 (빛 웅덩이, 바닥마다 세기 lightGain). 빛이 없는 곳은 어두운 바닥 그대로
  return uAmbientGround + sum * lightGain;
}
`;

/**
 * 젖은 바닥: 아스팔트 그림을 빛으로 비추고, 화면 알파에 젖은 정도(반사 세기)를 쓴다.
 * 반사 자체는 후처리(화면 반사)가 이 알파를 보고 더한다. wet: 웅덩이 무늬(빨강 채널), 가로 x·세로 z로 반복.
 */
export function floorMaterial(
  map: THREE.Texture, mapScale: THREE.Vector2, wet: THREE.Texture, wetScale: THREE.Vector2, wetK = 1, lightGain = 3,
): THREE.ShaderMaterial {
  return withLights(new THREE.ShaderMaterial({
    uniforms: {
      ...shared, map: { value: map }, mapScale: { value: mapScale }, wet: { value: wet }, wetScale: { value: wetScale }, wetK: { value: wetK },
      lightGain: { value: lightGain },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec2 mapScale;
      uniform sampler2D wet;
      uniform vec2 wetScale;
      uniform float wetK;
      uniform float lightGain;
      ${LIGHT_GLSL}
      ${FOG_GLSL}
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vDepth;
      ${FLOOR_LIGHT_GLSL}
      void main() {
        vec3 tex = texture2D(map, vWorld.xz * mapScale).rgb;
        float w = texture2D(wet, vWorld.xz * wetScale).r * wetK;
        // 젖은 곳은 바탕이 더 어둡고(물이 덮음) 반사가 세다
        vec3 col = tex * uAlbedo * mix(1.0, 0.55, w) * floorLight(vWorld);
        // 물기에 번진 빛: 웅덩이일수록 세다
        col += floorSheen * (0.3 + 0.7 * w) * 0.12 * min(1.0, wetK * 1.5);
        gl_FragColor = vec4(applyFog(col, vDepth, 0.0), (0.35 + 0.6 * w) * min(1.0, wetK * 1.5));
      }
    `,
  }));
}

/**
 * 바닥 무늬 판 (유리 조각·그을음·물웅덩이·신문지): 길 위에 눕힌 판. 바닥처럼 빛 웅덩이를 받고,
 * 화면 알파에 젖은 정도 wet를 쓴다 (물웅덩이는 반사가 세다).
 */
export function decalMaterial(map: THREE.Texture, wet: number): THREE.ShaderMaterial {
  return withLights(new THREE.ShaderMaterial({
    uniforms: { ...shared, map: { value: map }, wet: { value: wet }, lightGain: { value: 3 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float wet;
      uniform float lightGain;
      ${LIGHT_GLSL}
      ${FOG_GLSL}
      ${FLOOR_LIGHT_GLSL}
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vDepth;
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.5) discard;
        vec3 col = t.rgb * uAlbedo * floorLight(vWorld) + floorSheen * wet * 0.12;
        gl_FragColor = vec4(applyFog(col, vDepth, 0.0), wet);
      }
    `,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }));
}

/**
 * 흘러가는 전구 글씨 (옥상 전광판): 글씨 띠 텍스처를 offset(px)만큼 밀어 cols칸만 보인다. 끝에서 처음으로 이어진다.
 * 켜진 전구(알파 1)는 밝게, 꺼진 전구는 어둡게, 전구 사이(알파 0)는 버린다. 빛을 받지 않는 발광 판.
 */
export function scrollMaterial(strip: THREE.Texture, cols: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      strip: { value: strip },
      offset: { value: 0 },
      cols: { value: cols },
      stripW: { value: (strip.image as HTMLCanvasElement).width },
      k: { value: 1.6 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D strip;
      uniform float offset;
      uniform float cols;
      uniform float stripW;
      uniform float k;
      varying vec2 vUv;
      void main() {
        float px = floor(vUv.x * cols * 3.0);
        float py = floor((1.0 - vUv.y) * 15.0);
        vec4 t = texture2D(strip, vec2((px + offset + 0.5) / stripW, 1.0 - (py + 0.5) / 15.0));
        if (t.a < 0.3) discard;
        gl_FragColor = vec4(t.rgb * (t.a > 0.9 ? k : 0.3), 0.0);
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
    uniforms: { ...shared, color: { value: c }, strength: { value: strength }, bankNoise: { value: fogBankNoise() } },
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
      uniform sampler2D bankNoise;
      varying float vAlong;
      varying float vFacing;
      varying vec3 vWorld;
      void main() {
        // 광원 쪽이 밝고 끝으로 갈수록 옅어진다. 원뿔 가장자리(시선과 비스듬한 면)는 부드럽게 사라진다
        float along = pow(vAlong, 1.3) * smoothstep(0.0, 0.3, vAlong);
        float edge = pow(vFacing, 2.6);
        // 빛 속 안개가 천천히 흐르고 뭉친다 (칸 단위 잡음)
        vec2 p = floor(vWorld.xy);
        float mist = 0.45 + 0.55 * texture2D(bankNoise, vec2(p.x / 200.0 + uTime * 0.0009, p.y / 140.0 - uTime * 0.0004)).r;
        // 빛의 심은 색이 조금 빠져 하얗게
        vec3 c = mix(color, vec3(dot(color, vec3(0.3, 0.59, 0.11))) * 1.25, 0.25 * along);
        gl_FragColor = vec4(c * strength * along * edge * mist, 1.0);
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
  return keepAlpha(withLights(m), false);
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
 * 앞겹 실루엣 (카메라 앞을 스치는 기둥·전선): 아주 어둡게, 화면 가운데로 올수록 투명해져
 * 가장자리에서만 보이게 한다 (아트 규칙 '앞겹'). 사라지는 중간 단계는 마지막 팔레트 디더가 곱게 잇는다.
 */
export function fgMaterial(color: string): THREE.ShaderMaterial {
  const c = new THREE.Color(color).convertSRGBToLinear();
  return keepAlpha(new THREE.ShaderMaterial({
    uniforms: { color: { value: c }, screenW: { value: 482 } },
    vertexShader: /* glsl */ `
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float screenW;
      void main() {
        float edge = abs(gl_FragCoord.x / screenW - 0.5) * 2.0;
        float keep = smoothstep(0.5, 0.85, edge);
        if (keep < 0.02) discard;
        gl_FragColor = vec4(color, keep);
      }
    `,
  }), false);
}
