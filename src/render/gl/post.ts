import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { COLORS, COMMON, RAMP_SETS, type RampName } from '../palette';
import { SCREEN_W } from '../screen';
import { FAR, MARGIN, NEAR, RT_H, RT_W, type Placed } from './core';
import { LIGHT_N, loadedLights } from './lights';
import { SHEAR_MAX, shearFrame, tint } from '../screenfx';

/**
 * 구간 팔레트 (맵 아트 지침서 '팔레트'): 구간마다 늘 쓰는 색(캐릭터·이펙트) + 그 구간이 고른 계단 묶음 (data/stages moods[구간].ramps).
 * 경계 양쪽 PAL_HALF는 두 구간 팔레트를 합친 완충 구간 (화면 반 칸).
 */
const PAL_HALF = SCREEN_W / 4;
const SECTION_N = D.sections.length;
const BOUNDS = D.sections.slice(1).map((s) => s.x0 as number);
const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const SECTION_PALETTES: string[][] = D.sections.map((s) => {
  const m = (D.moods as Record<string, { ramps?: readonly string[] } | undefined>)[s.id];
  const names = (m?.ramps ?? Object.keys(RAMP_SETS)) as RampName[];
  return [...new Set([...COMMON.map((n) => COLORS[n]), ...names.flatMap((n) => RAMP_SETS[n])])];
});
/**
 * 늘 쓰는 색(캐릭터·이펙트)은 거리를 이만큼 늘려 본다: 무대의 어두운 하늘·안개가 이펙트의 진한 파랑·그을음 색으로 튀지 않고
 * 구간 계단으로 가게 (캐릭터·이펙트의 진한 색은 구간 계단과 멀어 그대로 남는다)
 */
const COMMON_WEIGHT = 2.5;
const COMMON_SET = new Set<string>(COMMON.map((n) => COLORS[n]));
/** 표 순서: 구간 0..N-1, 그다음 경계 k(구간 k와 k+1)의 합친 팔레트 */
const LUT_PALETTES: string[][] = [
  ...SECTION_PALETTES,
  ...BOUNDS.map((_, k) => [...new Set([...SECTION_PALETTES[k], ...SECTION_PALETTES[k + 1]])]),
];

/**
 * 후처리 (렌더 전용, 낮은 해상도 화면에서). 순서는 CLAUDE.md '2.5D 렌더 규칙'대로:
 *   젖은 바닥 반사 → 빛 번짐(밝은 곳에만: 네 겹 크기로 넓게, 강한 빛은 가로로 길게 번지는 플레어) → 안개 속 빛 무리
 *   → 구간 분위기 색 보정·대비·가장자리 어둡게 → 구간 팔레트 (색 단계가 바뀌는 경계 2~3칸에서만 8×8 디더링).
 * 무대에는 외곽선을 긋지 않는다 (무테, 맵 아트 지침서). 넓은 면은 디더 없이 단색이다.
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
/** 화면 물들이기 (render/screenfx tint): rgb는 밝기 1로 맞춘 색, a는 세기. 밝기는 그대로 색만 그 쪽으로 */
uniform vec4 wash;
varying vec2 vUv;

vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  // 밝은 쪽만 부드럽게 눌러 하얗게 날아가지 않게
  c = mix(c, 1.0 - 0.25 * exp(-(c - 0.75) / 0.25), step(0.75, c));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
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
  t = mix(t, l * wash.rgb, wash.a);
  // 아주 센 빛의 심(네온 관·전구·가로등 유리)은 필름처럼 하얗게 날아간다
  float hot = smoothstep(0.7, 2.2, l);
  return mix(t, vec3(max(t.r, max(t.g, t.b))), hot * 0.65);
}
void main() {
  vec3 c = texture2D(hdr, vUv).rgb;
  if (bloomStrength > 0.0) {
    vec3 b = texture2D(bloomQ, vUv).rgb * 0.5 + texture2D(bloomE, vUv).rgb * 0.45 + texture2D(bloomS, vUv).rgb * 0.45;
    c += b * bloomStrength;
    vec3 st = texture2D(streak, vUv).rgb;
    c += mix(st, vec3(dot(st, LUMA)) * vec3(0.7, 0.85, 1.05), 0.45) * streakStrength;
  }
  c = grade(c);
  vec3 s = toSrgb(c);
  // 대비 (S자), 가장자리 어둡게
  s = mix(s, s * s * (3.0 - 2.0 * s), gradeContrast);
  vec2 v = (vUv - 0.5) * vec2(1.0, 0.72);
  s *= 1.0 - vignette * smoothstep(0.28, 0.62, length(v)) * (1.0 - 0.6 * dot(s, vec3(0.299, 0.587, 0.114)));
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;

/**
 * 제한 팔레트 + 경계에서만 디더링. 색 보정까지 마친 화면(graded)을 칸마다 팔레트 색으로 줄이고,
 * 바로 옆(가로·세로) 칸과 팔레트 색이 다른데 원래 색은 매끄럽게 이어지는 곳 — 빛의 그러데이션이 색 단계를 넘는 경계 — 에서만
 * 8×8 바이어 무늬를 더한다. 그래서 디더는 두 색이 만나는 경계 양쪽 한 칸씩(2칸 띠)에만 생기고,
 * 넓은 면과 물체의 윤곽(원래 색이 크게 다른 경계)은 단색으로 깨끗하다.
 */
const PALETTE_FRAG = /* glsl */ `
#define SECTION_N ${SECTION_N}
#define BOUND_N ${BOUNDS.length}
uniform sampler2D graded;
uniform sampler2D lut;
uniform vec2 texel;
uniform vec2 ditherOrigin;
uniform float ditherAmount;
uniform float smoothLimit;
uniform float curveLimit;
uniform float gradLimit;
/** 구간 경계 (월드 x), 완충 구간 반폭, 화면 칸 → 싸우는 면의 월드 x */
uniform float bounds[BOUND_N];
uniform float palHalf;
uniform float viewX;
varying vec2 vUv;
/** 이 칸이 쓰는 팔레트 표 (구간 또는 경계의 합친 팔레트) */
float lutRow = 0.0;
/** 8×8 바이어 무늬 (-0.5~0.5): 2×2 무늬를 세 번 겹쳐 계산 (표를 찾지 않는다) */
float m2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
float bayer8(vec2 p) {
  vec2 q = mod(floor(p), 8.0);
  float v = 16.0 * m2(mod(q, 2.0)) + 4.0 * m2(mod(floor(q * 0.5), 2.0)) + m2(floor(q * 0.25));
  return (v + 0.5) / 64.0 - 0.5;
}
vec3 palette(vec3 c) {
  vec3 q = clamp(c, 0.0, 1.0) * 31.0;
  vec3 i = floor(q + 0.5);
  vec2 uv = vec2((i.b * 32.0 + i.r + 0.5) / 1024.0, (lutRow * 32.0 + i.g + 0.5) / (32.0 * float(SECTION_N + BOUND_N)));
  return texture2D(lut, uv).rgb;
}
float lutFor(float wx) {
  for (int k = 0; k < BOUND_N; k++) {
    if (wx < bounds[k] - palHalf) return float(k);
    if (wx < bounds[k] + palHalf) return float(SECTION_N + k);
  }
  return float(SECTION_N - 1);
}
float maxc(vec3 v) { return max(v.r, max(v.g, v.b)); }
float same(vec3 a, vec3 b) { vec3 d = abs(a - b); return step(d.r + d.g + d.b, 0.002); }
/**
 * 한 방향(off)으로 양옆 두 칸씩: 원래 색이 매끄럽게 이어지고 (양옆 차이가 작고 거의 곧게 변한다 — 빛의 그러데이션),
 * 바로 옆이 다른 팔레트 색인 경계이며, 경계 양쪽 띠가 모두 넓을 때(이쪽 띠 3칸 이상, 저쪽 띠 2칸 이상)만 1.
 * 도트 그림의 1칸짜리 무늬·윤곽은 곧게 변하지 않아 빠지고, 폭 1~2칸짜리 좁은 띠가 촘촘한 곳은 섞지 않는다 (넓은 바둑판이 되지 않게).
 */
float band(vec3 s, vec3 p, vec2 off) {
  vec3 a1 = texture2D(graded, vUv - off * texel).rgb;
  vec3 b1 = texture2D(graded, vUv + off * texel).rgb;
  float smooth1 = step(max(maxc(abs(a1 - s)), maxc(abs(b1 - s))), smoothLimit);
  float straight = step(maxc(abs(a1 + b1 - 2.0 * s)), curveLimit);
  if (smooth1 * straight < 0.5) return 0.0;
  vec3 a2 = texture2D(graded, vUv - 2.0 * off * texel).rgb;
  vec3 b2 = texture2D(graded, vUv + 2.0 * off * texel).rgb;
  // 느린 그러데이션만 (칸당 변화가 작아 띠가 넓은 곳): 띠가 좁으면 띠마다 양 끝이 섞여 넓은 바둑판이 된다
  if (maxc(abs(b2 - a2)) * 0.25 > gradLimit) return 0.0;
  vec3 pa1 = palette(a1);
  vec3 pb1 = palette(b1);
  vec3 pa2 = palette(a2);
  vec3 pb2 = palette(b2);
  // 오른쪽(아래쪽) 경계: 이쪽 띠가 왼쪽으로 두 칸 더, 저쪽 띠가 한 칸 더 이어진다. 왼쪽 경계는 거꾸로
  float right = (1.0 - same(pb1, p)) * same(pa1, p) * same(pa2, p) * same(pb2, pb1);
  float left = (1.0 - same(pa1, p)) * same(pb1, p) * same(pb2, p) * same(pa2, pa1);
  return max(right, left);
}
void main() {
  // 이 칸의 팔레트: 화면 칸이 가리키는 싸우는 면의 월드 x로 고른다. 팔레트가 바뀌는 자리는 12칸 폭을 바이어 무늬로 섞는다
  // (두 팔레트가 같은 색을 다르게 줄이는 곳(안개 색 등)에서 수직선으로 딱 잘리지 않게. 같게 줄이는 곳은 무늬가 생기지 않는다)
  lutRow = lutFor(viewX + gl_FragCoord.x + bayer8(gl_FragCoord.xy + ditherOrigin) * 12.0);
  vec3 s = texture2D(graded, vUv).rgb;
  vec3 p = palette(s);
#ifdef EDGE_DITHER
  float e = band(s, p, vec2(1.0, 0.0)) + band(s, p, vec2(0.0, 1.0));
  if (e > 0.5) p = palette(s + bayer8(gl_FragCoord.xy + ditherOrigin) * ditherAmount);
#endif
  gl_FragColor = vec4(p, 1.0);
}
`;

/**
 * 안개 속 빛 무리: 광원마다 그 둘레에만 작은 판을 더해 그린다 (화면 전체를 광원 수만큼 돌지 않게).
 * 이 칸의 물체가 광원보다 훨씬 앞이면 그 사이 안개만 빛나므로 약하게. 아래로만 비추는 등은 무리가 아래로 처진다.
 */
/** 빛 무리를 그리는 가장 약한 빛 (선형 색 세 성분 합 × 세기): 가로등·네온·분수 등불은 넘고, 창·골목 전구는 못 넘는다 */
const HALO_MIN = 1.0;
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
  // 판 크기와 가운데 (아래로 비추는 등은 무리가 등 밑으로 조금만 처진다: 세로로 길게 늘이면 등 밑에 캡슐 모양 판이 서서
  // 팔레트 단계 경계가 딱딱한 테두리로 보인다. 아래로 퍼지는 빛은 빛줄기(shaft)가 맡는다)
  vec2 ext = down ? vec2(r * 0.75, r * 0.8) : vec2(r);
  vec2 ctr = down ? vec2(0.0, -r * 0.15) : vec2(0.0);
  vec2 offs = ctr + position.xy * ext;
  vD = down ? vec2(offs.x, (offs.y + r * 0.15) * 0.95) : offs;
  vR = down ? r * 0.72 : r;
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

/**
 * 선 따라 어긋남 (render/screenfx): 마지막 팔레트 화면을 칸 단위로 옮겨 찍는다 (새 색이 생기지 않는다).
 * 선마다 A = (시작점 x, y, 방향 x, y: 화면 px, y 아래로 +), B = (길이 (0 = 끝없음), 미치는 범위 (0 = 화면 끝까지), + 쪽 밀림, − 쪽 밀림).
 * + 쪽 = 선 방향의 오른쪽 (오른쪽으로 긋는 선이면 아래). 밀림은 선 방향으로 px, 여러 선이면 더한다
 */
const SHEAR_FRAG = /* glsl */ `
uniform sampler2D src;
uniform vec2 size;
uniform float margin;
uniform int count;
uniform vec4 lineA[${SHEAR_MAX}];
uniform vec4 lineB[${SHEAR_MAX}];
varying vec2 vUv;
void main() {
  vec2 frag = floor(vUv * size);
  vec2 p = vec2(frag.x - margin + 0.5, size.y - 1.0 - frag.y - margin + 0.5);
  vec2 off = vec2(0.0);
  for (int i = 0; i < ${SHEAR_MAX}; i++) {
    if (i >= count) break;
    vec4 A = lineA[i];
    vec4 B = lineB[i];
    vec2 q = p - A.xy;
    float t = dot(q, A.zw);
    float s = A.z * q.y - A.w * q.x;
    float w = 1.0;
    if (B.x > 0.0) w *= clamp(1.0 - max(-t, t - B.x) / 8.0, 0.0, 1.0);
    if (B.y > 0.0) w *= clamp(2.0 - abs(s) / B.y, 0.0, 1.0);
    off += A.zw * (s > 0.0 ? B.z : B.w) * w;
  }
  vec2 sp = p - floor(off + 0.5);
  gl_FragColor = texture2D(src, vec2(sp.x + margin, size.y - sp.y - margin) / size);
}
`;

/** 팔레트 여럿 → 32×32×32 색 상자마다 가장 가까운 팔레트 색 표를 세로로 쌓은 그림 (가로 1024 = 파랑 32칸 × 빨강 32칸, 표마다 세로 초록 32칸) */
function buildLut(palettes: string[][]): THREE.DataTexture {
  const n = palettes.length;
  const data = new Uint8Array(1024 * 32 * n * 4);
  palettes.forEach((pal, L) => {
    const P = pal.map(hexRgb);
    const W = pal.map((h) => (COMMON_SET.has(h) ? COMMON_WEIGHT : 1));
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        for (let r = 0; r < 32; r++) {
          const R = (r / 31) * 255;
          const G = (g / 31) * 255;
          const B = (b / 31) * 255;
          let best = 0;
          let bd = Infinity;
          for (let k = 0; k < P.length; k++) {
            const p = P[k];
            const d = (3 * (p[0] - R) ** 2 + 4 * (p[1] - G) ** 2 + 2 * (p[2] - B) ** 2) * W[k];
            if (d < bd) {
              bd = d;
              best = k;
            }
          }
          const o = ((L * 32 + g) * 1024 + b * 32 + r) * 4;
          data[o] = P[best][0];
          data[o + 1] = P[best][1];
          data[o + 2] = P[best][2];
          data[o + 3] = 255;
        }
      }
    }
  });
  const t = new THREE.DataTexture(data, 1024, 32 * n);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** 확인 도구용: 깊이 버퍼 → 카메라에서의 거리(0~FAR)를 16비트로 나눠 담는다 (빨강 = 위 8비트, 초록 = 아래 8비트). 아무것도 안 그린 칸은 FAR */
const DEPTH_PACK_FRAG = /* glsl */ `
uniform sampler2D depthTex;
varying vec2 vUv;
void main() {
  float d = texture2D(depthTex, vUv).r;
  float v = d >= 0.999999 ? 1.0 : ${NEAR.toFixed(1)} * ${FAR.toFixed(1)} / (${FAR.toFixed(1)} - d * (${FAR.toFixed(1)} - ${NEAR.toFixed(1)})) / ${FAR.toFixed(1)};
  float q = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5);
  float hi = floor(q / 256.0);
  gl_FragColor = vec4(hi / 255.0, (q - hi * 256.0) / 255.0, 0.0, 1.0);
}
`;

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
  /** 색 보정까지 마친 화면 (팔레트로 줄이기 전) */
  private readonly graded: THREE.WebGLRenderTarget;
  readonly final: THREE.WebGLRenderTarget;
  private readonly quad: THREE.Mesh;
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly scene = new THREE.Scene();
  private readonly bright: THREE.ShaderMaterial;
  private readonly down: THREE.ShaderMaterial;
  private readonly blur: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly palette: THREE.ShaderMaterial;
  /** 품질 낮음: 경계 디더 없이 팔레트만 (칸마다 텍스처를 덜 읽는다) */
  private readonly paletteFast: THREE.ShaderMaterial;
  private readonly blit: THREE.ShaderMaterial;
  private readonly shear: THREE.ShaderMaterial;
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
    this.graded = target(RT_W, RT_H, THREE.UnsignedByteType);
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
      bloomQ: { value: this.q[0].texture },
      bloomE: { value: this.e[0].texture },
      bloomS: { value: this.s[0].texture },
      streak: { value: this.st[0].texture },
      bloomStrength: { value: 0.55 },
      streakStrength: { value: 0.3 },
      gradeShadow: { value: new THREE.Color() },
      gradeHigh: { value: new THREE.Color() },
      gradeSat: { value: 1 },
      gradeContrast: { value: 0.12 },
      exposure: { value: 1 },
      vignette: { value: 0.2 },
      wash: { value: new THREE.Vector4(1, 1, 1, 0) },
    });
    this.palette = mat(PALETTE_FRAG, {
      graded: { value: this.graded.texture },
      lut: { value: buildLut(LUT_PALETTES) },
      texel: { value: new THREE.Vector2(1 / RT_W, 1 / RT_H) },
      bounds: { value: BOUNDS },
      palHalf: { value: PAL_HALF },
      viewX: { value: 0 },
      ditherOrigin: { value: new THREE.Vector2() },
      ditherAmount: { value: 0.05 },
      smoothLimit: { value: 0.035 },
      curveLimit: { value: 0.012 },
      gradLimit: { value: 0.006 },
    });
    this.palette.defines = { EDGE_DITHER: '' };
    // 낮은 품질용은 같은 유니폼을 함께 쓴다 (표·경계·카메라 자리는 한 번만 바꾸면 둘 다에 들어간다)
    this.paletteFast = new THREE.ShaderMaterial({
      vertexShader: FULL_VERT, fragmentShader: PALETTE_FRAG, uniforms: this.palette.uniforms, depthTest: false, depthWrite: false,
    });
    this.blit = mat(BLIT_FRAG, { src: { value: this.final.texture } });
    this.shear = mat(SHEAR_FRAG, {
      src: { value: this.final.texture },
      size: { value: new THREE.Vector2(RT_W, RT_H) },
      margin: { value: MARGIN },
      count: { value: 0 },
      lineA: { value: Array.from({ length: SHEAR_MAX }, () => new THREE.Vector4()) },
      lineB: { value: Array.from({ length: SHEAR_MAX }, () => new THREE.Vector4()) },
    });
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
    this.drawHalos(renderer, camera, 0.1 * L.halo * tint.halo);
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
    // 화면 물들이기 (캐릭터 연출, render/screenfx): 색 보정의 두 색과 채도를 그 색 쪽으로, 그리고 색을 그 색으로 씻는다
    if (tint.k > 0) {
      const k = Math.min(1, tint.k);
      u.gradeShadow.value.lerp(this.tintColor.set(tint.shadow), k);
      u.gradeHigh.value.lerp(this.tintColor.set(tint.high), k);
      u.gradeSat.value += (tint.sat - u.gradeSat.value) * k;
      const c = this.tintColor.set(tint.high);
      const l = Math.max(0.001, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
      u.wash.value.set(c.r / l, c.g / l, c.b / l, 0.55 * k);
    } else u.wash.value.w = 0;

    this.pass(renderer, this.composite, this.graded);
    // 디더 무늬는 싸우는 면에 붙여 카메라가 움직여도 지글거리지 않게
    this.palette.uniforms.ditherOrigin.value.set(placed.ix, -placed.iy);
    this.palette.uniforms.viewX.value = placed.ix - MARGIN - 0.5;
    this.pass(renderer, opts.bloom ? this.palette : this.paletteFast, this.final);
    // 선 따라 어긋남 (render/screenfx): final → graded로 옮겨 찍고 다시 final로 (확인 도구가 final을 읽는다)
    const cuts = shearFrame(time, placed.ix, placed.iy);
    if (cuts.length) {
      const su = this.shear.uniforms;
      su.count.value = cuts.length;
      cuts.forEach((c, i) => {
        su.lineA.value[i].set(c.ax, c.ay, c.dx, c.dy);
        su.lineB.value[i].set(c.len, c.reach, c.pos, c.neg);
      });
      this.pass(renderer, this.shear, this.graded);
      this.blit.uniforms.src.value = this.graded.texture;
      this.pass(renderer, this.blit, this.final);
      this.blit.uniforms.src.value = this.final.texture;
    }
    this.pass(renderer, this.blit, null);
  }
  private readonly tintColor = new THREE.Color();

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
      // 약한 빛(켜진 창·골목 전구)은 무리를 그리지 않는다: 옅은 무리는 팔레트 한 단계짜리 회색 원판이 되어 물체처럼 보인다
      if (c.x + c.y + c.z < HALO_MIN) continue;
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
  /**
   * 확인 도구용: 마지막 프레임의 칸마다 카메라에서의 거리 (화면 w×h, 위 줄부터). 아무것도 안 그린 칸(하늘)은 FAR.
   * 맵 검사(tools/mapcheck.mjs)가 겹(하늘·먼 겹·중간 겹·싸우는 줄·앞겹)을 나누고 형태 경계를 찾는 데 쓴다
   */
  readDepth(renderer: THREE.WebGLRenderer, w: number, h: number): Float32Array {
    if (!this.depthRT) {
      this.depthRT = target(RT_W, RT_H, THREE.UnsignedByteType);
      this.depthPack = new THREE.ShaderMaterial({
        vertexShader: FULL_VERT, fragmentShader: DEPTH_PACK_FRAG, uniforms: { depthTex: { value: this.hdr.depthTexture } }, depthTest: false, depthWrite: false,
      });
    }
    this.pass(renderer, this.depthPack!, this.depthRT);
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(this.depthRT, MARGIN, MARGIN, w, h, buf);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((h - 1 - y) * w + x) * 4;
        out[y * w + x] = ((buf[i] * 256 + buf[i + 1]) / 65535) * FAR;
      }
    }
    return out;
  }
  private depthRT: THREE.WebGLRenderTarget | null = null;
  private depthPack: THREE.ShaderMaterial | null = null;

  read(renderer: THREE.WebGLRenderer, w: number, h: number): Uint8ClampedArray {
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(this.final, MARGIN, MARGIN, w, h, buf);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return out;
  }
}
