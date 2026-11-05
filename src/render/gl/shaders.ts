import * as THREE from 'three';
import { CUT_N, GONE_N, LIGHTS_DECL, shared, withLights } from './lights';

/**
 * 셰이더 조각과 재질 (렌더 전용). 색은 선형으로 계산하고(텍스처는 sRGB로 읽어 선형으로 바꾼다),
 * 마지막 후처리에서 화면 색으로 바꿔 팔레트로 줄인다.
 */

/**
 * 하늘과 공기가 함께 쓰는 값 (렌더 전용, sky.ts의 lightningAt이 매 프레임 채운다).
 * uFlash: 먼 번개 번쩍임 세기 0~1 (구름·안개·비가 이 빛을 받는다)
 */
export const atmos = {
  uFlash: { value: 0 },
};

export const LIGHT_GLSL = /* glsl */ `
${LIGHTS_DECL}
uniform vec3 uAmbient;
uniform vec3 uAmbientGround;
uniform float uAlbedo;
/** 환경광은 반구: 위(하늘)에서 오는 차가운 남색과 아래(젖은 길)에서 올라오는 더 어두운 빛 */
vec3 ambientAt(vec3 n) {
  return mix(uAmbientGround, uAmbient, n.y * 0.5 + 0.5);
}
/**
 * 점 광원만 (환경광 없이): 거리에 따라 부드럽게 줄고 (닿는 거리에서 0), 면이 빛을 등지면 어둡다 (조금 감싸 돌게).
 * 아래로만 비추는 등은 광원 바로 아래가 가장 밝고, 광원 높이 근처의 벽은 비추지 않는다
 */
vec3 directAt(vec3 p, vec3 n) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < LIGHT_N; i++) {
    if (float(i) >= uLightCount) break;
    vec3 L = uLightPos[i].xyz - p;
    float d = length(L);
    float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
    if (k <= 0.0) continue;
    vec3 l = L / max(d, 0.001);
    float ndl = clamp(dot(n, l) * 0.75 + 0.25, 0.0, 1.0);
    float spot = uLightCol[i].w > 1.5 ? smoothstep(0.25, 0.75, l.y) : 1.0;
    sum += uLightCol[i].rgb * (k * k) * ndl * spot;
  }
  return sum;
}
/**
 * directAt과 같고, 젖은 면의 반짝임(빛 쪽으로 기운 결에 맺히는 하이라이트)을 spec에 더한다. v: 카메라 쪽 방향.
 * 반짝임은 센 빛 안에서만 (약한 빛이 닿는 어두운 벽에는 맺히지 않는다)
 */
vec3 directAtSpec(vec3 p, vec3 n, vec3 v, float wet, inout vec3 spec) {
  vec3 sum = vec3(0.0);
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
    // 반짝임은 센 빛 6개까지만 (광원 배열은 센 순서로 실린다)
    if (i < 6) {
      vec3 h = normalize(l + v);
      float strong = smoothstep(0.06, 0.45, dot(c, vec3(0.3, 0.59, 0.11)));
      spec += c * pow(clamp(dot(n, h), 0.0, 1.0), 26.0) * wet * strong;
    }
  }
  return sum;
}
/** 환경광 + 점 광원 (예전 그대로: 다른 재질이 쓴다) */
vec3 lightAt(vec3 p, vec3 n) {
  return ambientAt(n) + directAt(p, n);
}
/** lightAt + 젖은 반짝임 */
vec3 lightAtSpec(vec3 p, vec3 n, vec3 v, float wet, inout vec3 spec) {
  return ambientAt(n) + directAtSpec(p, n, v, wet, spec);
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
uniform float flatten;
${LIGHT_GLSL}
${FOG_GLSL}
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDepth;
#ifdef CLIPX
uniform vec2 clipX;
#endif
uniform vec4 uCutA[${CUT_N}];
uniform vec4 uCutB[${CUT_N}];
float cutHash(float n) {
  return fract(sin(n * 12.9898) * 43758.5453);
}
const vec3 LW = vec3(0.3, 0.59, 0.11);
void main() {
#ifdef CLIPX
  // 이 x 구간 밖은 그리지 않는다 (선로 끝에서 사라지는 전차)
  if (vWorld.x < clipX.x || vWorld.x > clipX.y) discard;
#endif
  // 무너져 떨어져 나간 자리 (lights.ts uCutA·uCutB): 그리지 않는다. 가장자리는 깨진 단면 (1 빛 받는 윗변, 2 그늘)
  float cutEdge = 0.0;
#ifndef NOCUT
  for (int i = 0; i < ${CUT_N}; i++) {
    vec4 A = uCutA[i];
    vec4 B = uCutB[i];
    if (B.w <= 0.0) continue;
    if (vWorld.z < B.x || vWorld.z > B.y) continue;
    vec2 p = floor(vWorld.xy + 0.001);
    if (p.x < A.x - 4.0 || p.x > A.y + 4.0) continue;
    float fi = float(i) * 37.0 + A.x;
    // 아랫변: 큰 굴곡(6px 칸)과 잔 톱니(2px 칸), 윗변·옆변은 3px 줄마다 들쭉날쭉
    float bot = A.z + B.z * (p.x - A.x) + (cutHash(floor(p.x / 6.0) + fi) - 0.5) * 1.4 * B.w + (cutHash(floor(p.x / 2.0) * 1.7 + fi) - 0.5) * 0.8 * B.w;
    float top = A.w + (cutHash(floor(p.x / 5.0) * 2.3 + fi + 5.0) - 0.5) * 1.2 * B.w;
    float lx = A.x + cutHash(floor(p.y / 3.0) * 1.3 + fi + 11.0) * B.w;
    float rx = A.y - cutHash(floor(p.y / 3.0) * 1.9 + fi + 23.0) * B.w;
    bool inX = p.x >= lx && p.x < rx;
    bool inY = p.y >= bot && p.y < top;
    if (inX && inY) discard;
    if (inX) {
      float d = bot - p.y;
      if (d > 0.0 && d <= 1.0) cutEdge = max(cutEdge, 1.0);
      else if (d > 1.0 && d <= 3.0) cutEdge = max(cutEdge, 2.0);
      float u = p.y - top;
      if (u >= 0.0 && u < 2.0) cutEdge = max(cutEdge, 2.0);
    }
    if (inY) {
      float d = min(lx - p.x, p.x - rx + 1.0);
      if (d > 0.0 && d <= 2.0) cutEdge = max(cutEdge, 2.0);
    }
  }
#endif
  vec4 tex = texture2D(map, vUv);
  if (tex.a < 0.5) discard;
  vec2 ts = 1.0 / vec2(textureSize(map, 0));
  // 둘레 평균색 (벽돌 한 장·줄눈·얼룩 같은 작은 무늬를 지운 색, 창·문 같은 큰 형태는 남는다).
  // 빛이 닿지 않은 면은 이 색으로 어둠에 묻는다 (아트 규칙: 디테일은 빛이 닿은 면에만)
  vec4 a1 = texture2D(map, vUv + vec2(2.0, 1.0) * ts);
  vec4 a2 = texture2D(map, vUv + vec2(-1.0, 2.0) * ts);
#ifdef DETAIL
  vec4 a3 = texture2D(map, vUv + vec2(-2.0, -1.0) * ts);
  vec4 a4 = texture2D(map, vUv + vec2(1.0, -2.0) * ts);
  vec3 mean = (tex.rgb + a1.rgb * a1.a + a2.rgb * a2.a + a3.rgb * a3.a + a4.rgb * a4.a) / (1.0 + a1.a + a2.a + a3.a + a4.a);
#else
  vec3 mean = (tex.rgb + a1.rgb * a1.a + a2.rgb * a2.a) / (1.0 + a1.a + a2.a);
#endif
  vec3 n0 = normalize(vNormal);
  vec3 n = n0;
  vec3 spec = vec3(0.0);
#ifdef DETAIL
  // 벽 결: 도트 그림의 밝기를 높이로 보고(줄눈·창틀 홈은 낮고 벽돌 면은 높다) 칸마다 면을 기울인다.
  // 빛이 움직이면 벽돌 결과 창틀 모서리를 따라 밝고 어두운 면이 생긴다 (품질 높음에서만: setDetail).
  // 결은 점 광원에만 쓴다: 환경광은 기울지 않은 면으로 받아, 빛이 닿지 않은 곳에는 결이 서지 않는다
  if (bump > 0.0) {
    float h0 = dot(tex.rgb, LW);
    float hr = dot(texture2D(map, vUv + vec2(ts.x, 0.0)).rgb, LW);
    float hu = dot(texture2D(map, vUv + vec2(0.0, ts.y)).rgb, LW);
    vec3 nt = normalize(vec3((h0 - hr) * bump * 8.0, (h0 - hu) * bump * 8.0, 1.0));
    // 면의 결 방향: 무대는 거의 상자와 판이라 면 방향만 보고 정한다 (상자 그림의 u·v 방향, 화면 미분 없이)
    vec3 an = abs(n0);
    vec3 T = an.z >= max(an.x, an.y) ? vec3(sign(n0.z), 0.0, 0.0) : an.x >= an.y ? vec3(0.0, 0.0, -sign(n0.x)) : vec3(1.0, 0.0, 0.0);
    vec3 B = an.y > max(an.x, an.z) ? vec3(0.0, 0.0, -sign(n0.y)) : vec3(0.0, 1.0, 0.0);
    n = normalize(mat3(T, B, n0) * nt);
  }
  // 비에 젖은 면은 센 빛 쪽으로 기운 결마다 반짝인다
  vec3 direct = directAtSpec(vWorld, n, normalize(cameraPosition - vWorld), wet, spec);
#else
  vec3 direct = directAt(vWorld, n);
#endif
  vec3 amb = ambientAt(n0);
  // 이 면이 받은 빛 (환경광 말고 광원에서 온 빛): 어둠 0 ~ 빛 웅덩이 1
  float litK = smoothstep(0.03, 0.3, dot(direct, LW));
  // 작은 무늬는 빛이 닿은 만큼만 드러난다
  vec3 albTex = mix(mean, tex.rgb, mix(1.0 - flatten * 0.92, 1.0, litK));
  // 색: 어둠은 채도를 낮춰 차갑게 묻고 (환경광이 남색), 빛이 닿은 곳은 칠한 색(녹·페인트·포스터)이 살아난다
  vec3 alb = mix(vec3(dot(albTex, LW)), albTex, mix(0.48, 1.0, litK)) * uAlbedo;
  vec3 col = alb * tint * (amb + direct) + spec;
  // 스스로 빛나는 것(창·네온·로비)은 안개를 덜 먹는다: 빛이 안개를 뚫고 나와 색이 살아 있다
  float fk = fogK(vDepth, vWorld.y);
  vec3 em = texture2D(emissiveMap, vUv).rgb * emissiveStrength;
  // 알파 0: 바닥이 아니다 (화면 반사는 알파에 젖은 정도를 쓴 바닥에만 더한다)
  // 깨진 단면: 윗변 1px은 속 재질이 드러나 밝고 (빛이 없어도 읽히게 환경광 몫을 더한다), 그 아래 2px은 부서진 그늘
  if (cutEdge > 1.5) { col *= 0.38; em *= 0.2; }
  else if (cutEdge > 0.5) { col = col * 1.6 + alb * 0.12 + vec3(0.012, 0.011, 0.012); em *= 0.3; }
  gl_FragColor = vec4(mix(col, uFogColor, fk) + em * (1.0 - 0.5 * fk), 0.0);
}
`;

/** 품질에 따라 벽 결·젖은 반짝임을 넣고 빼는 재질들 (DETAIL 정의를 바꿔 다시 컴파일한다) */
const detailed: THREE.ShaderMaterial[] = [];
let detailOn = true;
/** 지금 품질이 높음인지 (벽 결·젖은 반짝임이 켜졌는지): 낮음이면 덜 중요한 빛줄기를 숨긴다 */
export function detailEnabled(): boolean {
  return detailOn;
}

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
 * attached: 건물에 붙은 기하 (무너진 칸을 지운다, kit.ts의 Geo), clip: 이 x 구간 밖은 그리지 않는다.
 * 빛이 닿지 않은 면은 작은 무늬(벽돌 결·얼룩·포스터 글자)가 어둠에 묻히고 색이 차갑게 빠진다.
 * 빛이 닿은 만큼 무늬와 칠한 색이 드러난다.
 */
export function litMaterial(
  map: THREE.Texture,
  opts: {
    emissive?: THREE.Texture; emissiveStrength?: number; tint?: number; side?: THREE.Side; attached?: boolean; clip?: [number, number];
    /** 벽 결 세기 (0이면 끔), 젖은 반짝임 세기 */
    bump?: number; wet?: number;
    /** 빛이 닿지 않은 곳에서 작은 무늬를 묻는 정도 (0: 늘 그대로 보임, 기본 1). 어둠에서도 읽혀야 하는 그림(글자 판 등)은 낮춘다 */
    flatten?: number;
    /** 무너진 자리(uCut)에 상관없이 그린다: 그 자리에 새로 놓는 잔해·뼈대 */
    nocut?: boolean;
  } = {},
): THREE.ShaderMaterial {
  const defines: Record<string, string> = {};
  if (opts.nocut) defines.NOCUT = '';
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
      flatten: { value: opts.flatten ?? 1 },
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

/** 먼 겹 안개 덩어리 무늬 (64×64 값 잡음, 부드럽게 늘여 쓴다: 안개는 흐림을 허용한다). 빛줄기 속 안개가 함께 쓴다 */
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
 * 연기·증기 덩어리의 짙기 (0~1, NOISE_GLSL 뒤에 넣는다). 그림을 키워 쓰지 않고 칸마다 계산한다 (픽셀 크기 하나).
 * q: 덩어리 안 좌표 (-1~1), px: 덩어리 지름 (화면 px), seed: 덩어리마다 다른 무늬, t: 무늬가 피어오르는 시간.
 * 둥근 공이 아니라 가장자리를 무늬가 갉아 먹은 뭉게 덩어리: 가운데가 짙고 가장자리로 부드럽게 사라진다.
 * 무늬 한 알갱이는 화면 6px 안팎이라 1px 점이 흩어지지 않는다
 */
export const PUFF_GLSL = /* glsl */ `
float puffDensity(vec2 q, float px, float seed, float t) {
  float r = length(q);
  if (r >= 1.0) return 0.0;
  vec2 s = q * (px / 12.0) + vec2(seed * 17.31, seed * 7.13);
  float n = vnoise(s + vec2(0.0, t)) * 0.62 + vnoise(s * 2.13 + vec2(3.7, -t * 1.3)) * 0.38;
  float edge = 1.0 - smoothstep(0.25 + 0.4 * n, 1.0, r + (0.5 - n) * 0.25);
  return clamp(edge * (0.55 + 0.6 * n), 0.0, 1.0);
}
`;

/**
 * 먼 겹 판 (빛을 받지 않는 그림): 어둡게 누르고 안개에 묻는다. fog: 0~1, glowMix: 안개가 지평선 도시 불빛 색을 얼마나 띠는지.
 * 안개는 그림에 칠하지 않고 여기서 덮는다 (점무늬 없이 이어지게): 겹 아래쪽(바닥 안개)이 짙고 위로 갈수록 옅다.
 * 안개 속에는 가로로 길게 늘어진 안개 자락이 천천히 흐른다 (한 화면 안에서도 짙고 옅은 곳이 갈마든다: 평평한 판이 되지 않게).
 * 안개는 그림을 다 덮지 않는다 (가장 짙어도 그림이 비쳐, 실루엣이 한 색 덩어리가 되지 않는다).
 * 불 켜진 창처럼 밝은 칸은 안개를 뚫고 빛난다. 먼 번개가 쳐도 먼 겹은 밝아지지 않는다 (번쩍이는 하늘을 등진 실루엣).
 */
export function backdropMaterial(map: THREE.Texture, tint: number, fog: number, glowMix = 0.5): THREE.ShaderMaterial {
  const img = map.image as HTMLCanvasElement;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared, map: { value: map }, tint: { value: tint }, fogAmount: { value: fog }, glowMix: { value: glowMix },
      texSize: { value: new THREE.Vector2(img.width, img.height) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vTop;
      void main() {
        vUv = uv;
        // 위쪽 안개 남김: 먼 겹(마천루)은 윗부분이 거의 맑아 어두운 실루엣, 가까운 겹(중간 건물)은 위까지 옅은 안개가 남아 먼 겹보다 밝다
        vTop = mix(0.2, 0.6, smoothstep(-18000.0, -3000.0, modelMatrix[3].z));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
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
      varying vec2 vUv;
      varying float vTop;
      ${NOISE_GLSL}
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.5) discard;
        vec2 p = floor(vUv * texSize);
        float l = dot(t.rgb, vec3(0.3, 0.59, 0.11));
        float resist = smoothstep(0.12, 0.4, l);
        float mist = uMist * (1.0 - smoothstep(0.0, 0.42, vUv.y));
        // 안개 자락: 가로로 길게 (겹 px로 140×40, 그 반 크기 한 겹 더), 천천히 옆으로 흐른다.
        // 짙기를 조금만 흔들어 안개 띠의 경계가 물결치게 한다 (줄무늬가 갈마들거나 한 덩어리 언덕이 되지 않게)
        vec2 q = p / vec2(140.0, 40.0) + vec2(uTime * 0.0011, 0.0);
        float wisp = vnoise(q) * 0.62 + vnoise(q * vec2(2.3, 2.7) + vec2(5.2, 1.3) - vec2(uTime * 0.0017, 0.0)) * 0.38;
        float bank = 0.72 + 0.56 * wisp;
        // 안개는 땅 가까이가 짙고 위로 갈수록 옅다 (도시 불빛에 물든 안개가 바닥에 깔린다):
        // 마천루는 아래쪽이 안개에 묻히고, 윗부분은 어두운 하늘을 등진 실루엣과 켜진 창으로 보인다
        float high = smoothstep(0.04, 0.65, vUv.y);
        float f = (fogAmount * mix(1.0, vTop, high) + mist * 0.45) * bank;
        f = min(f, 0.72);
        vec3 fogCol = mix(uFogColor, uFogGlow, glowMix * (1.0 - vUv.y * 0.6));
        // 불 켜진 창은 안개를 뚫고 빛나되, 짙은 안개 속에서는 흐려진다 (안개 위에 점이 떠 보이지 않게)
        f *= 1.0 - resist * 0.6 * (1.0 - f);
        vec3 c = t.rgb * tint * (1.0 + resist * 2.0 * (1.0 - f));
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
    if (k <= 0.0) continue;
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
 * 무늬(돌판 줄눈·자갈)는 빛 웅덩이 안에서만 또렷하다 (빛이 닿지 않은 길은 어둡고 고르게: 캐릭터가 서는 바닥 띠가 벽보다 어둡게 갈라진다).
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
        vec2 uv = vWorld.xz * mapScale;
        vec3 tex = texture2D(map, uv).rgb;
        float w = texture2D(wet, vWorld.xz * wetScale).r * wetK;
        vec3 lit = floorLight(vWorld);
        // 빛이 닿지 않은 길은 무늬를 둘레 평균으로 묻는다
        vec2 ts = 1.0 / vec2(textureSize(map, 0));
        vec3 mean = (tex + texture2D(map, uv + vec2(2.0, 1.0) * ts).rgb + texture2D(map, uv + vec2(-2.0, -1.0) * ts).rgb) / 3.0;
        float litK = smoothstep(0.03, 0.35, dot(lit - uAmbientGround, vec3(0.3, 0.59, 0.11)));
        tex = mix(mean, tex, 0.25 + 0.75 * litK);
        // 젖은 곳은 바탕이 더 어둡고(물이 덮음) 반사가 세다
        vec3 col = tex * uAlbedo * mix(1.0, 0.55, w) * lit;
        // 물기에 번진 빛: 웅덩이일수록 세다
        float wk = min(1.0, wetK * 1.5);
        col += floorSheen * (0.3 + 0.7 * w) * 0.12 * wk;
        gl_FragColor = vec4(applyFog(col, vDepth, 0.0), (0.35 + 0.6 * w) * wk);
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
 * 빛줄기 (가로등·전조등 아래로 쏟아지는 빛, 서치라이트): 원뿔 표면을 가산으로. 빛은 물체가 아니다 —
 * 광원 쪽이 밝고 끝으로 길게 옅어지며, 원뿔 가장자리(시선과 비스듬한 곳)는 넓게 부드럽게 사라진다.
 * 가운데 심만 조금 밝고(평평한 판이 아니라 빛 기둥), 바닥 가까이에서는 바닥에 닿기 전에 옅어진다 (바닥에 잘린 단면이 서지 않게).
 * 등마다 세기와 안개 무늬가 조금씩 다르다 (같은 빛줄기가 줄지어 서지 않게: 판 자리로 정한다).
 * 광원 바로 옆은 빛 무리(후처리)가 맡으므로 눌러 둔다 (하얀 심이 박힌 물방울 모양이 되지 않게). 화면 알파는 건드리지 않는다.
 * 먼 번개가 치면 빛줄기 속 안개도 잠깐 밝아진다.
 */
export function shaftMaterial(color: string, strength: number): THREE.ShaderMaterial {
  const c = new THREE.Color(color).convertSRGBToLinear();
  const m = new THREE.ShaderMaterial({
    uniforms: { ...shared, color: { value: c }, strength: { value: strength }, bankNoise: { value: fogBankNoise() }, uFlash: atmos.uFlash },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFacing;
      varying vec3 vWorld;
      varying float vSeed;
      void main() {
        vAlong = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vec3 v = normalize(cameraPosition - wp.xyz);
        vFacing = abs(dot(n, v));
        // 이 빛줄기 하나의 값 (판 자리로 정한다)
        vec3 o = modelMatrix[3].xyz;
        vSeed = fract(sin(dot(floor(o.xy), vec2(12.9898, 78.233))) * 43758.5453);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float strength;
      uniform float uTime;
      uniform float uFlash;
      uniform sampler2D bankNoise;
      varying float vAlong;
      varying float vFacing;
      varying vec3 vWorld;
      varying float vSeed;
      void main() {
        // 광원에서 3할쯤 내려온 곳이 가장 밝고, 광원 바로 옆은 눌러 두고, 끝은 길게 옅어진다
        float along = smoothstep(0.0, 0.8, vAlong) * (1.0 - 0.55 * smoothstep(0.72, 1.0, vAlong));
        along *= along * 0.3 + 0.7;
        // 원뿔 가장자리는 넓게 부드럽게, 가운데 심이 조금 더 밝다
        float edge = smoothstep(0.0, 1.0, vFacing);
        edge = edge * edge * (0.55 + 0.45 * edge);
        // 바닥 가까이는 옅게 (빛줄기가 바닥에 닿아 잘린 단면이 서지 않게)
        float floorFade = 0.4 + 0.6 * smoothstep(-6.0, 40.0, vWorld.y);
        // 빛 속 안개가 천천히 흐르고 뭉친다 (칸 단위 잡음, 빛줄기마다 무늬 자리가 다르다)
        vec2 p = floor(vWorld.xy);
        float mist = 0.4 + 0.6 * texture2D(bankNoise, vec2(p.x / 180.0 + uTime * 0.0009 + vSeed * 3.1, p.y / 120.0 - uTime * 0.0004 + vSeed * 1.7)).r;
        float k = strength * (0.85 + 0.35 * vSeed) * (1.0 + uFlash * 0.6);
        gl_FragColor = vec4(color * k * along * edge * mist * floorFade, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
  return keepAlpha(m, true);
}

/**
 * 반투명 판 (안개 카드·증기): 색·세기, 무늬 텍스처의 빨강 채널을 농도로.
 * 안개는 공기다: 가로로 길게 늘어진 자락이 두 겹으로 천천히 흐르고 (짙은 곳과 트인 곳이 갈마든다),
 * 아래(땅 가까이)가 짙고 위로 갈수록 옅어져 위 끝에서 사라진다 (윗변이 선으로 서지 않게).
 * 가까운 안개는 둘레 빛을 받아 그 빛 색으로 밝아지고, 먼 번개가 치면 잠깐 밝아진다.
 */
export function hazeMaterial(noise: THREE.Texture, color: string, strength: number, scale: number, lit = true): THREE.ShaderMaterial {
  const c = new THREE.Color(color).convertSRGBToLinear();
  const m = new THREE.ShaderMaterial({
    defines: lit ? { LIT: '' } : {},
    uniforms: {
      ...shared, noise: { value: noise }, color: { value: c }, strength: { value: strength }, drift: { value: new THREE.Vector2(0.0006, 0.00015) },
      noiseScale: { value: new THREE.Vector2(1 / (300 * scale), 1 / (110 * scale)) }, uFlash: atmos.uFlash,
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
      uniform float uFlash;
      uniform vec3 uFogColor;
      ${LIGHT_GLSL}
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        // 안개 자락: 크기가 다른 두 무늬가 서로 다른 빠르기로 흐른다 (같은 덩어리가 같은 간격으로 줄짓지 않게).
        // 짙기 차이는 너무 크지 않게 (차이가 크면 팔레트 단계로 나뉘어 얼룩처럼 보인다)
        vec2 w = vWorld.xy * noiseScale;
        float n1 = texture2D(noise, w * vec2(1.7, 2.2) + drift * uTime).r;
        float n2 = texture2D(noise, w * vec2(0.55, 0.8) + vec2(0.31, 0.17) - drift * uTime * 0.6).r;
        float n = smoothstep(0.15, 0.85, n1 * 0.45 + n2 * 0.55);
        // 아래쪽이 짙고 위로 갈수록 옅게, 위 끝은 0으로 (윗변이 보이지 않게)
        float up = 1.0 - smoothstep(0.0, 0.92, vUv.y);
        float a = strength * (0.22 + 0.56 * n) * up * smoothstep(0.0, 0.08, vUv.y);
        // 안개는 둘레 빛을 받아 밝아진다 (빛 받은 안개). 광원이 닿지 않는 먼 안개 판은 계산하지 않는다
        // 안개 색은 그 구간 안개 색 쪽으로 (구간마다 공기 색이 다르다)
        vec3 base = mix(color, uFogColor, 0.45);
        #ifdef LIT
        vec3 lit = base + directAt(vWorld, vec3(0.0, 0.0, 1.0)) * 0.6;
        #else
        vec3 lit = base;
        #endif
        lit += vec3(0.035, 0.038, 0.05) * uFlash;
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
    uniforms: { map: { value: map }, color: { value: c }, uFlatPass: shared.uFlatPass },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    // 애니 이펙트 칸(vfx/gg)은 캔버스 알파 254로 표시돼 있다: 표시 그림 단계(1)에서는 알파 1을 적고 (후처리가 색 보정 없이 그대로),
    // 빛 번짐 원본 단계(2)에서는 그 칸만 그린다. 화면 단계(0)의 알파는 0 (젖은 바닥 반사가 이펙트 칸을 바닥으로 보지 않게)
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      uniform float uFlatPass;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.5) discard;
        float anime = step(t.a, 0.998);
        if (uFlatPass > 1.5) {
          if (anime < 0.5) discard;
          // 빛 번짐 원본: 채도만큼 (흰 심은 번지지 않고 밝은 주색·보색 테두리가 그 색으로 번진다: 흰 안개 덩어리가 뜨지 않게)
          float mx = max(t.r, max(t.g, t.b));
          float mn = min(t.r, min(t.g, t.b));
          gl_FragColor = vec4(t.rgb * ((mx - mn) / max(mx, 1e-3)), 1.0);
          return;
        }
        // 화면 단계: 애니 이펙트 칸은 반 밝기로 적는다 (무대 빛 번짐 문턱을 넘지 않게: 이펙트 빛 번짐은 따로 한다).
        // 후처리 합치기가 그 칸을 두 배로 되돌려 그린 색 그대로 보여 준다
        gl_FragColor = vec4(t.rgb * color * (anime > 0.5 && uFlatPass < 0.5 ? 0.5 : 1.0), uFlatPass > 0.5 ? anime : 0.0);
      }
    `,
    depthWrite: false,
  });
}

/**
 * 캐릭터 판: 시트에서 한 프레임을 잘라 그리고, 무대의 빛을 받는다.
 * - 어두운 곳(빛이 닿지 않는 공원)에서는 한 단계 어둡고 그 구간 환경광 쪽으로 조금 차갑게,
 *   가로등·간판·이펙트 빛 가까이에서는 밝아지며 그 빛 색을 조금 띤다 (색은 알아볼 수 있게 살짝만).
 *   시트의 1px 어두운 외곽선은 그대로 어둡다.
 * - 가까운 광원 쪽 테두리를 그 빛 색으로 물들인다
 *   (이 칸은 차 있고 빛 쪽 한 칸 옆이 비어 있으면 1px 테두리, 두 칸 옆까지 비면 한 줄 더 옅게).
 * lit 0이면 시트 색 그대로 (맞아서 하얗게 번쩍일 때). 깊이는 쓰지 않는다 (시트에 이미 외곽선이 있다).
 */
export function spriteMaterial(): THREE.ShaderMaterial {
  return withLights(new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      palette: { value: null },
      rect: { value: new THREE.Vector4(0, 0, 0, 0) },
      cellInfo: { value: new THREE.Vector4(0, 0, 64, 64) },
      flip: { value: 0 },
      row: { value: 0 },
      rimDir: { value: new THREE.Vector2(0, 0) },
      rimColor: { value: new THREE.Color(0, 0, 0) },
      bright: { value: 1 },
      lit: { value: 1 },
      uAmbient: shared.uAmbient,
      uAmbientGround: shared.uAmbientGround,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHTS_DECL}
      // 캐릭터 그림 모음 (색 번호 1바이트, render/gl/sprites)과 색 묶음 표
      uniform sampler2D map;
      uniform sampler2D palette;
      // 이 프레임 그림이 모음 안에 있는 자리 (왼쪽 위 x, y, 폭, 높이)
      uniform vec4 rect;
      // 그 그림이 칸 안에 있는 자리 (x, y)와 칸 크기 (폭, 높이)
      uniform vec4 cellInfo;
      uniform float flip;
      uniform float row;
      uniform vec2 rimDir;
      uniform vec3 rimColor;
      uniform float bright;
      uniform float lit;
      uniform vec3 uAmbient;
      uniform vec3 uAmbientGround;
      varying vec2 vUv;
      varying vec3 vWorld;
      const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
      // 칸 안 픽셀 (오른쪽을 보는 그림 기준, 위에서 아래로)의 색 번호. 그림 네모 밖은 0 (투명)
      int colorIndex(ivec2 p) {
        ivec2 q = p - ivec2(cellInfo.xy);
        if (q.x < 0 || q.y < 0 || q.x >= int(rect.z) || q.y >= int(rect.w)) return 0;
        return int(texelFetch(map, ivec2(rect.xy) + q, 0).r * 255.0 + 0.5);
      }
      void main() {
        int cw = int(cellInfo.z);
        int ch = int(cellInfo.w);
        int px = clamp(int(floor(vUv.x * cellInfo.z)), 0, cw - 1);
        int py = clamp(int(floor((1.0 - vUv.y) * cellInfo.w)), 0, ch - 1);
        // 왼쪽을 볼 때는 칸을 좌우로 뒤집어 읽는다
        bool flipped = flip > 0.5;
        ivec2 p = ivec2(flipped ? cw - 1 - px : px, py);
        int ci = colorIndex(p);
        if (ci == 0) discard;
        vec4 t = texelFetch(palette, ivec2(ci, int(row)), 0);
        // 테두리 빛: 빛 쪽으로 1·2칸 옆이 비었나 (그림을 뒤집었으면 옆도 뒤집어 본다. 화면 위 = 그림 위쪽 줄)
        ivec2 d = ivec2(int(rimDir.x) * (flipped ? -1 : 1), -int(rimDir.y));
        float n1 = colorIndex(p + d) > 0 ? 1.0 : 0.0;
        float n2 = colorIndex(p + d * 2) > 0 ? 1.0 : 0.0;
        float rim = (1.0 - step(0.5, n1)) + (1.0 - step(0.5, n2)) * step(0.5, n1) * 0.45;
        rim *= step(0.001, abs(rimDir.x) + abs(rimDir.y));
        vec3 c = t.rgb * bright;
        if (lit > 0.0) {
          // 몸에 닿는 빛: 몸은 둥글어 옆·뒤에서 온 빛도 조금 받는다 (나머지는 테두리 빛이 맡는다)
          vec3 L = vec3(0.0);
          for (int i = 0; i < LIGHT_N; i++) {
            if (float(i) >= uLightCount) break;
            vec3 d3 = uLightPos[i].xyz - vWorld;
            float d = length(d3);
            float k = clamp(1.0 - d / uLightPos[i].w, 0.0, 1.0);
            if (k <= 0.0) continue;
            vec3 l = d3 / max(d, 0.001);
            float spot = uLightCol[i].w > 1.5 ? smoothstep(0.05, 0.55, l.y) : 1.0;
            L += uLightCol[i].rgb * (k * k) * spot * (0.6 + 0.4 * max(l.z, 0.0));
          }
          vec3 amb = mix(uAmbientGround, uAmbient, 0.65);
          float al = max(dot(amb, LW), 1e-4);
          float ll = dot(L, LW);
          // 밝기: 빛이 없으면 0.66 (구간 환경광이 밝으면 조금 더), 빛 속에서 1.18까지
          float lev = min(0.66 * clamp(al / 0.1, 0.9, 1.2) + 1.0 * ll, 1.18);
          // 색: 어둠은 환경광 색 쪽으로 아주 조금, 빛 속은 그 빛 색 쪽으로 조금. 밝은 색(흰 머리·흰 옷)은 거의 물들이지 않는다
          // (팔레트가 다른 캐릭터의 색으로 바꿔 버리지 않게: 시트 색을 알아볼 수 있게)
          float keep = 1.0 - smoothstep(0.35, 0.8, dot(t.rgb, LW));
          vec3 cool = mix(vec3(1.0), amb / al, 0.08 * keep);
          vec3 warm = mix(vec3(1.0), L / max(ll, 1e-4), 0.14 * keep);
          vec3 tintC = mix(cool, warm, smoothstep(0.0, 0.2, ll));
          tintC /= max(dot(tintC, LW), 1e-4);
          c *= mix(vec3(1.0), lev * tintC, lit);
        }
        gl_FragColor = vec4(c + rimColor * rim, 0.0);
      }
    `,
    depthWrite: false,
  }));
}

/**
 * 발밑 그림자: 바닥(또는 발판 윗면)에 눕힌 어두운 타원. 가운데가 짙고 가장자리로 부드럽게 사라진다 (그림자는 선이 아니라 면).
 * 카메라가 거의 수평이라 바닥에 눕힌 판은 납작하게 보이므로, 깊이 폭을 카메라 높이에 맞춰 늘여 화면에서 늘 4~5px 높이가 되게 한다.
 * at = (발밑 x, 바닥 높이, 반폭 px), strength: 짙기 (뜰수록 옅게). 위에서 보는 면만 그린다 (발판 밑에서는 보이지 않는다)
 */
export function contactShadowMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { at: { value: new THREE.Vector3() }, strength: { value: 0.7 } },
    vertexShader: /* glsl */ `
      uniform vec3 at;
      varying vec2 vQ;
      void main() {
        vQ = position.xz;
        float h = max(cameraPosition.y - at.y, 24.0);
        float zext = 2.4 * cameraPosition.z / h;
        vec3 wp = vec3(at.x + position.x * at.z, at.y + 0.08, position.z * zext);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float strength;
      varying vec2 vQ;
      void main() {
        float r = length(vQ);
        float a = strength * (1.0 - smoothstep(0.3, 1.0, r));
        if (a < 0.02) discard;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
      }
    `,
  });
  return keepAlpha(m, false);
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
