import * as THREE from 'three';
import { COLORS, RAMPS } from '../palette';
import { FAR, MARGIN, NEAR, RT_H, RT_W, type Placed } from './core';
import { LIGHT_N, loadedLights } from './lights';

/**
 * 후처리 (렌더 전용, 낮은 해상도 화면에서). 순서는 CLAUDE.md '2.5D 렌더 규칙'대로:
 *   젖은 바닥 반사 → 빛 번짐(밝은 곳에만: 네 겹 크기로 넓게, 강한 빛은 가로로 길게 번지는 플레어) → 안개 속 빛 무리
 *   → 구간 분위기 색 보정·대비·가장자리 어둡게 → 깊이 기반 1px 외곽선 → 제한 팔레트 + 8×8 디더링.
 * 흐림은 빛(번짐·플레어·빛 무리)과 반사에만 쓴다. 그림(텍스처)은 흐리지 않는다.
 * 마지막에 팔레트 화면을 같은 크기 캔버스에 옮기고, 정수배 확대와 카메라의 남는 소수점 밀기는 CSS가 맡는다 (view.ts).
 */
const FULL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * 젖은 바닥 반사 (화면 공간): 바닥 칸(화면 알파 = 젖은 정도)에 바닥선 위 장면을 뒤집어 더한다.
 * 카메라가 거의 수평이라 바닥은 화면 아래 몇십 줄뿐이므로, 위쪽을 stretch배로 늘여 비춰 네온·창이 바닥에 길게 비친다.
 * 물웅덩이(알파가 큰 곳)는 거울처럼 또렷하게, 덜 젖은 곳은 세로로 길게 번진다. 빗방울이 떨어진 자리에 동심원이 퍼져 비친 그림이 흔들린다.
 * 바닥선에 가까울수록(멀리 보는 바닥) 더 세게 비춘다 (프레넬).
 */
const REFLECT_FRAG = /* glsl */ `
uniform sampler2D hdr;
uniform vec2 size;
uniform float horizon;
uniform float stretch;
uniform float time;
uniform vec2 origin;
uniform float strength;
varying vec2 vUv;
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
/** 빗방울 동심원: 셀마다 정해진 박자로 떨어진 빗방울이 퍼지는 고리 (바닥 좌표, 세로는 원근으로 눌림) */
float ripple(vec2 p) {
  vec2 cell = floor(p / vec2(14.0, 5.0));
  float acc = 0.0;
  for (int j = 0; j < 2; j++) {
    vec2 c = cell + vec2(float(j), 0.0);
    float ph = h21(c);
    float period = 34.0 + 30.0 * h21(c + 7.0);
    float t = mod(time + ph * period, period) / period;
    vec2 ctr = (c + vec2(0.2 + 0.6 * h21(c + 3.1), 0.2 + 0.6 * h21(c + 5.7))) * vec2(14.0, 5.0);
    vec2 d = (p - ctr) * vec2(1.0, 2.8);
    float r = t * 9.0;
    acc += (1.0 - t) * smoothstep(1.2, 0.0, abs(length(d) - r));
  }
  return acc;
}
void main() {
  vec4 c = texture2D(hdr, vUv);
  vec3 col = c.rgb;
  float row = (1.0 - vUv.y) * size.y;
  float d = row - horizon;
  if (c.a > 0.01 && d > 0.0) {
    float x = vUv.x * size.x;
    vec2 wp = vec2(x + origin.x, d);
    float rip = sin(d * 0.9 + time * 0.16 + wp.x * 0.045) * (0.3 + d * 0.04)
              + sin(d * 2.3 - time * 0.11 + wp.x * 0.13) * 0.4;
    float rr = ripple(wp);
    rip += rr * 1.6;
    // 물웅덩이: 거울 (번짐 적게), 덜 젖은 길: 세로로 길게 번진다
    float mirror = smoothstep(0.75, 0.95, c.a);
    float spread = mix(3.0, 0.8, mirror);
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int k = 0; k < 6; k++) {
      float src = horizon - d * stretch - float(k) * spread - 1.0;
      float ok = step(0.0, src);
      vec2 uv = vec2((x + rip) / size.x, 1.0 - max(src, 0.0) / size.y);
      float w = (1.0 - float(k) * 0.14) * ok;
      acc += texture2D(hdr, uv).rgb * w;
      wsum += w;
    }
    // 바닥선 가까이(멀리 보는 바닥)는 더 세게 비친다
    float fresnel = mix(1.15, 0.8, clamp(d / 60.0, 0.0, 1.0));
    // 젖은 길은 빛(간판·창·가로등)을 세게 비추고 어두운 벽은 거의 비추지 않는다: 밝기에 따라 비추는 양을 정한다
    vec3 r = acc / max(wsum, 0.001);
    float lum = dot(r, vec3(0.299, 0.587, 0.114));
    float k = mix(smoothstep(0.012, 0.09, lum), 0.9, mirror * 0.6);
    col += r * k * c.a * strength * fresnel;
    // 동심원 테두리에 빛이 걸려 반짝인다
    col += r * rr * 0.35 * c.a;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/** 밝은 곳만 (부드러운 문턱) 4칸 평균으로 줄여 담는다 */
const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D src;
uniform vec2 texel;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
    vec3 s = texture2D(src, vUv + (vec2(float(x), float(y)) - 0.5) * texel * 2.0).rgb;
    float l = dot(s, vec3(0.299, 0.587, 0.114));
    c += s * smoothstep(threshold, threshold * 2.2, l);
  }
  gl_FragColor = vec4(c * 0.25, 1.0);
}
`;

/** 반 크기로 줄이기 (4칸 평균). gate > 0이면 아주 밝은 곳만 남긴다 (가로 플레어) */
const DOWN_FRAG = /* glsl */ `
uniform sampler2D src;
uniform vec2 texel;
uniform float gate;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) c += texture2D(src, vUv + (vec2(float(x), float(y)) - 0.5) * texel).rgb;
  c *= 0.25;
  if (gate > 0.0) c *= smoothstep(gate, gate * 2.5, dot(c, vec3(0.299, 0.587, 0.114)));
  gl_FragColor = vec4(c, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D src;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(src, vUv).rgb * 0.36;
  c += texture2D(src, vUv + dir).rgb * 0.24;
  c += texture2D(src, vUv - dir).rgb * 0.24;
  c += texture2D(src, vUv + dir * 2.0).rgb * 0.08;
  c += texture2D(src, vUv - dir * 2.0).rgb * 0.08;
  gl_FragColor = vec4(c, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D hdr;
uniform sampler2D depthTex;
uniform sampler2D bloomQ;
uniform sampler2D bloomE;
uniform sampler2D bloomS;
uniform sampler2D streak;
uniform sampler2D lut;
uniform vec2 texel;
uniform float bloomStrength;
uniform float streakStrength;
uniform vec3 gradeShadow;
uniform vec3 gradeHigh;
uniform float gradeSat;
uniform float gradeContrast;
uniform float exposure;
uniform float vignette;
uniform vec2 ditherOrigin;
uniform float ditherAmount;
uniform float outlineRange;
uniform vec3 outlineColor;
varying vec2 vUv;

float viewDepth(vec2 uv) {
  float d = texture2D(depthTex, uv).r;
  return ${NEAR.toFixed(1)} * ${FAR.toFixed(1)} / (${FAR.toFixed(1)} - d * (${FAR.toFixed(1)} - ${NEAR.toFixed(1)}));
}
/** 8×8 바이어 무늬 (-0.5~0.5): 2×2 무늬를 세 번 겹쳐 계산 (표를 찾지 않는다) */
float m2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
float bayer8(vec2 p) {
  vec2 q = mod(floor(p), 8.0);
  float v = 16.0 * m2(mod(q, 2.0)) + 4.0 * m2(mod(floor(q * 0.5), 2.0)) + m2(floor(q * 0.25));
  return (v + 0.5) / 64.0 - 0.5;
}
vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  // 밝은 쪽만 부드럽게 눌러 하얗게 날아가지 않게
  c = mix(c, 1.0 - 0.25 * exp(-(c - 0.75) / 0.25), step(0.75, c));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 palette(vec3 c) {
  vec3 q = clamp(c, 0.0, 1.0) * 31.0;
  vec3 i = floor(q + 0.5);
  vec2 uv = vec2((i.b * 32.0 + i.r + 0.5) / 1024.0, (i.g + 0.5) / 32.0);
  return texture2D(lut, uv).rgb;
}
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
/** 분위기 색 보정: 그림자 쪽은 gradeShadow, 밝은 쪽은 gradeHigh 색으로 물들이고(밝기는 그대로) 채도를 맞춘다 */
vec3 grade(vec3 c) {
  c *= exposure;
  float l = dot(c, LUMA);
  vec3 sh = gradeShadow / max(dot(gradeShadow, LUMA), 0.001);
  vec3 hi = gradeHigh / max(dot(gradeHigh, LUMA), 0.001);
  vec3 tint = mix(sh, hi, smoothstep(0.015, 0.45, l));
  // 물들이되 밝기는 그대로 (흑백으로 봐도 명도가 바뀌지 않게)
  vec3 t = mix(c, c * tint, 0.4);
  t *= l / max(dot(t, LUMA), 1e-5);
  t = mix(vec3(l), t, gradeSat);
  // 아주 센 빛의 심(네온 관·전구·가로등 유리)은 필름처럼 하얗게 날아간다
  float hot = smoothstep(0.7, 2.2, l);
  return mix(t, vec3(max(t.r, max(t.g, t.b))), hot * 0.65);
}
void main() {
  float depth = viewDepth(vUv);
  vec3 c = texture2D(hdr, vUv).rgb;
  if (bloomStrength > 0.0) {
    vec3 b = texture2D(bloomQ, vUv).rgb * 0.5 + texture2D(bloomE, vUv).rgb * 0.45 + texture2D(bloomS, vUv).rgb * 0.45;
    c += b * bloomStrength;
    vec3 st = texture2D(streak, vUv).rgb;
    c += mix(st, vec3(dot(st, LUMA)) * vec3(0.7, 0.85, 1.05), 0.45) * streakStrength;
  }
  c = grade(c);
  // 깊이 외곽선: 바로 옆이 훨씬 가까운 물체면 이 칸(바깥쪽)을 어둡게 (먼 겹에는 긋지 않는다).
  // 깊이의 역수는 평면 위에서 화면 좌표에 선형이라, 2차 차분이 0이 아닌 곳만 끊긴 곳으로 본다
  // (거의 수평으로 보이는 바닥처럼 줄마다 깊이가 크게 바뀌는 평면에는 긋지 않는다).
  float w0 = 1.0 / depth;
  float wl = 1.0 / viewDepth(vUv - vec2(texel.x, 0.0));
  float wr = 1.0 / viewDepth(vUv + vec2(texel.x, 0.0));
  float wd = 1.0 / viewDepth(vUv - vec2(0.0, texel.y));
  float wu = 1.0 / viewDepth(vUv + vec2(0.0, texel.y));
  float bend = max(abs(wl + wr - 2.0 * w0), abs(wu + wd - 2.0 * w0));
  float wn = max(max(wl, wr), max(wu, wd));
  float edge = step(w0 * 0.006, bend) * step(w0 * 0.006, wn - w0) * step(1.0 / outlineRange, wn);
  vec3 s = toSrgb(c);
  // 대비 (S자), 가장자리 어둡게
  s = mix(s, s * s * (3.0 - 2.0 * s), gradeContrast);
  vec2 v = (vUv - 0.5) * vec2(1.0, 0.72);
  s *= 1.0 - vignette * smoothstep(0.28, 0.62, length(v)) * (1.0 - 0.6 * dot(s, vec3(0.299, 0.587, 0.114)));
  s = mix(s, outlineColor, edge);
  s += bayer8(gl_FragCoord.xy + ditherOrigin) * ditherAmount;
  gl_FragColor = vec4(palette(s), 1.0);
}
`;

/**
 * 안개 속 빛 무리: 광원마다 그 둘레에만 작은 판을 더해 그린다 (화면 전체를 광원 수만큼 돌지 않게).
 * 이 칸의 물체가 광원보다 훨씬 앞이면 그 사이 안개만 빛나므로 약하게. 아래로만 비추는 등은 무리가 아래로 처진다.
 */
const HALO_VERT = /* glsl */ `
attribute vec4 hA;
attribute vec4 hC;
uniform vec2 rtSize;
varying vec2 vD;
varying vec2 vUv;
varying float vR;
varying float vDepth;
varying vec3 vCol;
void main() {
  float r = hA.w;
  bool down = hC.w > 1.5;
  // 판 크기와 가운데 (아래로 비추는 등은 아래로 처지고 세로로 길다)
  vec2 ext = down ? vec2(r * 0.9, r * 1.2) : vec2(r);
  vec2 ctr = down ? vec2(0.0, -r * 0.35) : vec2(0.0);
  vec2 offs = ctr + position.xy * ext;
  vD = down ? vec2(offs.x, (offs.y + r * 0.35) * 0.75) : offs;
  vR = down ? r * 0.85 : r;
  vUv = hA.xy + offs / rtSize;
  vDepth = hA.z;
  vCol = hC.rgb;
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}
`;
const HALO_FRAG = /* glsl */ `
uniform sampler2D depthTex;
uniform sampler2D scene;
uniform float strength;
varying vec2 vD;
varying vec2 vUv;
varying float vR;
varying float vDepth;
varying vec3 vCol;
float viewDepth(vec2 uv) {
  float d = texture2D(depthTex, uv).r;
  return ${NEAR.toFixed(1)} * ${FAR.toFixed(1)} / (${FAR.toFixed(1)} - d * (${FAR.toFixed(1)} - ${NEAR.toFixed(1)}));
}
void main() {
  float k = clamp(1.0 - length(vD) / vR, 0.0, 1.0);
  if (k <= 0.0) discard;
  float occ = clamp(viewDepth(vUv) / vDepth, 0.3, 1.0);
  // 이미 밝은 칸(간판 글자·전구)에는 덜 얹어 글자가 뭉개지지 않게
  float lum = dot(texture2D(scene, vUv).rgb, vec3(0.299, 0.587, 0.114));
  float spare = 1.0 - 0.75 * smoothstep(0.25, 1.2, lum);
  gl_FragColor = vec4(vCol * (k * k * k) * occ * spare * strength, 1.0);
}
`;

/** 팔레트 화면을 캔버스(같은 크기)에 그대로 옮긴다. 확대와 소수점 밀기는 CSS가 맡는다 */
const BLIT_FRAG = /* glsl */ `
uniform sampler2D src;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(src, vUv);
}
`;

/** 팔레트(COLORS + RAMPS) → 32×32×32 색 상자마다 가장 가까운 팔레트 색 (가로 1024 = 파랑 32칸 × 빨강 32칸, 세로 초록 32칸) */
export const PALETTE: ReadonlyArray<[number, number, number]> = [...new Set([...Object.values(COLORS), ...RAMPS])].map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
});

function buildLut(): THREE.DataTexture {
  const data = new Uint8Array(1024 * 32 * 4);
  for (let g = 0; g < 32; g++) {
    for (let b = 0; b < 32; b++) {
      for (let r = 0; r < 32; r++) {
        const R = (r / 31) * 255;
        const G = (g / 31) * 255;
        const B = (b / 31) * 255;
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < PALETTE.length; k++) {
          const p = PALETTE[k];
          const d = 3 * (p[0] - R) ** 2 + 4 * (p[1] - G) ** 2 + 2 * (p[2] - B) ** 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        const o = (g * 1024 + b * 32 + r) * 4;
        data[o] = PALETTE[best][0];
        data[o + 1] = PALETTE[best][1];
        data[o + 2] = PALETTE[best][2];
        data[o + 3] = 255;
      }
    }
  }
  const t = new THREE.DataTexture(data, 1024, 32);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

function target(w: number, h: number, type: THREE.TextureDataType, depth = false, linear = false): THREE.WebGLRenderTarget {
  const t = new THREE.WebGLRenderTarget(w, h, {
    type,
    minFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
    magFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: depth,
  });
  if (depth) t.depthTexture = new THREE.DepthTexture(w, h);
  return t;
}

export interface PostOptions {
  bloom: boolean;
}

/** 구간 분위기에 따라 매 프레임 바뀌는 값 (world.ts가 채운다) */
export interface PostLook {
  shadow: THREE.Color;
  high: THREE.Color;
  sat: number;
  contrast: number;
  halo: number;
  streak: number;
  exposure: number;
}

export class Post {
  readonly hdr: THREE.WebGLRenderTarget;
  private readonly lit: THREE.WebGLRenderTarget;
  private readonly reflect: THREE.ShaderMaterial;
  /** 바닥선 (렌더 타깃 위에서부터 몇째 줄, 싸우는 면 기준) */
  horizon = 0;
  /** 빛 번짐: 1/4, 1/8, 1/16 크기 (A·B는 가로·세로 흐림을 번갈아 담는다) */
  private readonly q: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readonly e: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readonly s: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  /** 가로 플레어 (1/8 크기) */
  private readonly st: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  readonly final: THREE.WebGLRenderTarget;
  private readonly quad: THREE.Mesh;
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly scene = new THREE.Scene();
  private readonly bright: THREE.ShaderMaterial;
  private readonly down: THREE.ShaderMaterial;
  private readonly blur: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly blit: THREE.ShaderMaterial;
  private readonly tmp = new THREE.Vector3();
  private readonly haloMesh: THREE.Mesh;
  private readonly haloGeo: THREE.InstancedBufferGeometry;
  private readonly haloScene = new THREE.Scene();
  readonly look: PostLook = {
    shadow: new THREE.Color(0x24304a),
    high: new THREE.Color(0xffe0c0),
    sat: 1,
    contrast: 0.12,
    halo: 1,
    streak: 0.3,
    exposure: 1,
  };

  constructor(renderer: THREE.WebGLRenderer) {
    const float = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const hdrType = float ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.hdr = target(RT_W, RT_H, hdrType, true);
    this.lit = target(RT_W, RT_H, hdrType);
    const pair = (k: number): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] => {
      const w = Math.ceil(RT_W / k);
      const h = Math.ceil(RT_H / k);
      return [target(w, h, hdrType, false, true), target(w, h, hdrType, false, true)];
    };
    this.q = pair(4);
    this.e = pair(8);
    this.s = pair(16);
    this.st = pair(8);
    this.final = target(RT_W, RT_H, THREE.UnsignedByteType);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: FULL_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.reflect = mat(REFLECT_FRAG, {
      hdr: { value: this.hdr.texture },
      size: { value: new THREE.Vector2(RT_W, RT_H) },
      horizon: { value: 0 },
      stretch: { value: 3.2 },
      time: { value: 0 },
      origin: { value: new THREE.Vector2() },
      strength: { value: 1.0 },
    });
    this.bright = mat(BRIGHT_FRAG, { src: { value: null }, texel: { value: new THREE.Vector2(1 / RT_W, 1 / RT_H) }, threshold: { value: 0.5 } });
    this.down = mat(DOWN_FRAG, { src: { value: null }, texel: { value: new THREE.Vector2() }, gate: { value: 0 } });
    this.blur = mat(BLUR_FRAG, { src: { value: null }, dir: { value: new THREE.Vector2() } });
    this.composite = mat(COMPOSITE_FRAG, {
      hdr: { value: this.lit.texture },
      depthTex: { value: this.hdr.depthTexture },
      bloomQ: { value: this.q[0].texture },
      bloomE: { value: this.e[0].texture },
      bloomS: { value: this.s[0].texture },
      streak: { value: this.st[0].texture },
      lut: { value: buildLut() },
      texel: { value: new THREE.Vector2(1 / RT_W, 1 / RT_H) },
      bloomStrength: { value: 0.55 },
      streakStrength: { value: 0.3 },
      gradeShadow: { value: new THREE.Color() },
      gradeHigh: { value: new THREE.Color() },
      gradeSat: { value: 1 },
      gradeContrast: { value: 0.12 },
      exposure: { value: 1 },
      vignette: { value: 0.2 },
      ditherOrigin: { value: new THREE.Vector2() },
      ditherAmount: { value: 0.028 },
      outlineRange: { value: 3400 },
      outlineColor: { value: new THREE.Color(0x07060e) },
    });
    this.blit = mat(BLIT_FRAG, { src: { value: this.final.texture } });
    this.haloGeo = new THREE.InstancedBufferGeometry();
    this.haloGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    this.haloGeo.setIndex([0, 1, 2, 0, 2, 3]);
    this.haloGeo.setAttribute('hA', new THREE.InstancedBufferAttribute(new Float32Array(LIGHT_N * 4), 4).setUsage(THREE.DynamicDrawUsage));
    this.haloGeo.setAttribute('hC', new THREE.InstancedBufferAttribute(new Float32Array(LIGHT_N * 4), 4).setUsage(THREE.DynamicDrawUsage));
    this.haloGeo.instanceCount = 0;
    this.haloMesh = new THREE.Mesh(this.haloGeo, new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { depthTex: { value: this.hdr.depthTexture }, scene: { value: this.hdr.texture }, rtSize: { value: new THREE.Vector2(RT_W, RT_H) }, strength: { value: 0.1 } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }));
    this.haloMesh.frustumCulled = false;
    this.haloScene.add(this.haloMesh);
    this.quad = new THREE.Mesh(geo, this.bright);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private pass(renderer: THREE.WebGLRenderer, m: THREE.ShaderMaterial, to: THREE.WebGLRenderTarget | null): void {
    this.quad.material = m;
    renderer.setRenderTarget(to);
    renderer.render(this.scene, this.cam);
  }

  /** 줄인 화면을 가로·세로로 흐린다 (A → B → A). step: 몇 칸 간격으로 짚을지 */
  private blur2(renderer: THREE.WebGLRenderer, p: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget], step = 1): void {
    const b = this.blur.uniforms;
    b.src.value = p[0].texture;
    b.dir.value.set(step / p[0].width, 0);
    this.pass(renderer, this.blur, p[1]);
    b.src.value = p[1].texture;
    b.dir.value.set(0, step / p[0].height);
    this.pass(renderer, this.blur, p[0]);
  }

  /** src를 반 크기 to로 줄인다 */
  private half(renderer: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, to: THREE.WebGLRenderTarget, gate = 0): void {
    const d = this.down.uniforms;
    d.src.value = src.texture;
    d.texel.value.set(1 / src.width, 1 / src.height);
    d.gate.value = gate;
    this.pass(renderer, this.down, to);
  }

  /** hdr에 그린 장면 → final(팔레트 화면) → 캔버스 */
  run(renderer: THREE.WebGLRenderer, placed: Placed, opts: PostOptions, time: number, camera: THREE.Camera): void {
    const u = this.composite.uniforms;
    const r = this.reflect.uniforms;
    r.horizon.value = this.horizon;
    r.time.value = time;
    r.origin.value.set(placed.ix, placed.iy);
    this.pass(renderer, this.reflect, this.lit);
    const L = this.look;
    this.drawHalos(renderer, camera, 0.1 * L.halo);
    if (opts.bloom) {
      this.bright.uniforms.src.value = this.lit.texture;
      this.pass(renderer, this.bright, this.q[0]);
      // 가로 플레어: 아주 밝은 곳만 1/8로 줄여 가로로만 넓게 세 번 번진다
      this.half(renderer, this.q[0], this.st[0], 0.35);
      const b = this.blur.uniforms;
      for (const [k, step] of [[0, 2.5], [1, 8]] as const) {
        const from = this.st[k];
        const to = this.st[1 - k];
        b.src.value = from.texture;
        b.dir.value.set(step / from.width, 0);
        this.pass(renderer, this.blur, to);
      }
      // (마지막 결과는 st[0]: 합칠 때 그것을 읽는다)
      // 빛 번짐 세 겹: 1/4 → 1/8 → 1/16
      this.half(renderer, this.q[0], this.e[0]);
      this.half(renderer, this.e[0], this.s[0]);
      // 1/16은 두 번 줄이며 이미 부드러워 따로 흐리지 않는다
      this.blur2(renderer, this.q);
      this.blur2(renderer, this.e);
      u.bloomStrength.value = 0.55;
      u.streakStrength.value = L.streak;
    } else {
      u.bloomStrength.value = 0;
      u.streakStrength.value = 0;
    }
    u.gradeShadow.value.copy(L.shadow);
    u.gradeHigh.value.copy(L.high);
    u.gradeSat.value = L.sat;
    u.gradeContrast.value = L.contrast;
    u.exposure.value = L.exposure;

    // 디더 무늬는 싸우는 면에 붙여 카메라가 움직여도 지글거리지 않게
    u.ditherOrigin.value.set(placed.ix, -placed.iy);
    this.pass(renderer, this.composite, this.final);
    this.pass(renderer, this.blit, null);
  }

  /** 빛 무리: 실린 광원마다 화면 자리를 한 번 계산해 둘레 판을 lit 위에 더한다 */
  private drawHalos(renderer: THREE.WebGLRenderer, camera: THREE.Camera, strength: number): void {
    const n = loadedLights.count();
    const A = this.haloGeo.getAttribute('hA') as THREE.InstancedBufferAttribute;
    const C = this.haloGeo.getAttribute('hC') as THREE.InstancedBufferAttribute;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const p = loadedLights.pos[i];
      const c = loadedLights.col[i];
      const depth = camera.position.z - p.z;
      if (depth <= 0) continue;
      this.tmp.set(p.x, p.y, p.z).project(camera);
      A.setXYZW(k, this.tmp.x * 0.5 + 0.5, this.tmp.y * 0.5 + 0.5, depth, p.w * 0.3);
      C.setXYZW(k, c.x, c.y, c.z, c.w);
      k++;
    }
    if (!k || strength <= 0) return;
    A.needsUpdate = true;
    C.needsUpdate = true;
    this.haloGeo.instanceCount = k;
    (this.haloMesh.material as THREE.ShaderMaterial).uniforms.strength.value = strength;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.lit);
    renderer.render(this.haloScene, this.cam);
    renderer.autoClear = auto;
  }

  /** 확인 도구용: 팔레트 화면(여유 칸 뺀 480×270)을 RGBA로 (위에서 아래로) */
  read(renderer: THREE.WebGLRenderer, w: number, h: number): Uint8ClampedArray {
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(this.final, MARGIN, MARGIN, w, h, buf);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return out;
  }
}
