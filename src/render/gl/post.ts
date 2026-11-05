import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { COLORS, COMMON, POST_FAMILIES, POST_LADDER, type PostRampName } from '../palette';
import { SCREEN_W } from '../screen';
import { DIST, FAR, MARGIN, NEAR, RT_H, RT_W, type Placed } from './core';
import { LIGHT_N, loadedLights } from './lights';
import { fxGlowScale, impact, impactAt, press, pressAt, SHEAR_MAX, shearFrame, tint, zoomAt, zoomPunch } from '../screenfx';

/** 이펙트 빛 번짐 세기 (애니 이펙트 둘레 무대에 더하는 빛) */
const FX_GLOW = 2.6;

/**
 * 구간 팔레트 (맵 아트 지침서 '팔레트', CLAUDE.md '구간 분위기').
 *
 * 무대 칸은 '계단(램프) 하나 안에서' 줄인다: 칸마다 먼저 그 색이 어느 계단 묶음(색 갈래: 남색 어둠·주황 빛·분홍 네온…)에
 * 속하는지 고르고(같은 밝기에서 색이 가장 가까운 계단), 그 계단 안에서 밝기로 단계를 정한다.
 * 그래서 빛의 번짐·빛줄기·안개·하늘처럼 천천히 바뀌는 그러데이션이 한 색 갈래 안에서 밝기 순서대로 이어지고
 * (예전처럼 가장 가까운 점을 고르면 회색·갈색·남색 계단을 오가며 여러 색 고리가 졌다), 흑백 밝기는 그대로 남는다.
 * 단계가 바뀌는 경계에서만 8×8 바이어 무늬로 2~3칸을 섞는다: 띠가 넓을수록(느린 빛) 섞는 폭이 화면 칸으로 일정하고,
 * 넓은 면(단계 경계가 없는 곳)과 물체의 윤곽(밝기가 한 칸에 크게 바뀌는 곳)은 단색으로 깨끗하다.
 *
 * 캐릭터·이펙트 칸(view.ts가 그린 표시)은 늘 쓰는 색(COMMON)과 계단 색 중 가장 가까운 색으로 줄인다:
 * 캐릭터 색은 어느 구간에서나 시트 색 그대로 남고, 무대 칸은 캐릭터 색(정장 남색·그을음·외곽선 검정 …)에 빼앗기지 않는다.
 *
 * 칸마다 쓸 구간: 보이는 면의 깊이로 그 칸의 월드 x를 구한다. 싸우는 줄 근처 물체는 제 자리 x의 구간을,
 * 먼 겹(먼 마천루·중간 건물·하늘)은 카메라 자리의 구간을 쓴다 (하늘·안개·환경광이 카메라 자리 분위기라 서로 맞는다).
 * 구간 경계 양쪽 PAL_HALF는 두 구간 팔레트를 합친 완충 구간이고, 바뀌는 자리를 12칸 폭 바이어 무늬로 흔든다.
 * 분위기 색 보정(그림자·밝은 쪽 색·채도·대비)도 같은 x로 칸마다 섞는다: 카메라가 걸어도 건물 색이 바뀌지 않는다.
 */
const PAL_HALF = SCREEN_W / 4;
const SECTION_N = D.sections.length;
const BOUNDS = D.sections.slice(1).map((s) => s.x0 as number);
/** 구간 분위기 섞는 폭 (mood.ts와 같다) */
export const MOOD_BLEND = 180;
type MoodLike = { ramps?: readonly string[]; grade: { shadow: string; high: string; sat: number; contrast: number }; exposure?: number };
const MOODS = D.moods as unknown as Record<string, MoodLike | undefined>;
const moodOf = (i: number): MoodLike => {
  for (let k = 0; k < SECTION_N; k++) {
    const a = MOODS[D.sections[i - k]?.id ?? ''] ?? MOODS[D.sections[i + k]?.id ?? ''];
    if (a) return a;
  }
  return Object.values(MOODS)[0]!;
};
const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const luma = (c: readonly number[]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

// ---------------------------------------------------------------- 밝기 계단에 맞춘 색 갈래 (OKLab)
const toLin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v: number): number => {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
};
function oklab(rgb: readonly number[]): [number, number, number] {
  const [r, g, b] = rgb.map((v) => toLin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2,
  ];
}
function fromOklab(L: number, A: number, B: number): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s2 = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    255 * toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2),
    255 * toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2),
    255 * toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2),
  ];
}
/** 갈래 기준 색들을 밝기 순으로 OKLab에서 이어, 흑백 밝기 Lt에 정확히 맞춘 색 (어둠 아래는 검정, 밝은 끝 위는 하양 쪽으로) */
function familyAt(anchors: readonly string[], Lt: number): [number, number, number] {
  const A = anchors
    .map((h) => {
      const c = hexRgb(h);
      return { l: luma(c), lab: oklab(c) };
    })
    .sort((a, b) => a.l - b.l);
  let lab: number[];
  const top = A[A.length - 1];
  if (Lt <= A[0].l) lab = A[0].lab.map((v) => (v * Lt) / Math.max(A[0].l, 1e-6));
  else if (Lt >= top.l) {
    const t = (Lt - top.l) / Math.max(255 - top.l, 1e-6);
    lab = top.lab.map((v, i) => v * (1 - t) + (i === 0 ? t : 0));
  } else {
    let k = 0;
    while (A[k + 1].l < Lt) k++;
    const t = (Lt - A[k].l) / (A[k + 1].l - A[k].l);
    lab = A[k].lab.map((v, i) => v + (A[k + 1].lab[i] - v) * t);
  }
  // 밝기 맞추기: OKLab의 L만 바꿔 (색은 그대로) 흑백 밝기가 Lt가 되게
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (luma(fromOklab(mid, lab[1], lab[2])) < Lt) lo = mid;
    else hi = mid;
  }
  return fromOklab((lo + hi) / 2, lab[1], lab[2]).map((v) => Math.round(Math.min(255, Math.max(0, v)))) as [number, number, number];
}

/** 후처리 색 갈래 (전역 번호): 계단 칸마다 색 */
interface PostRamp {
  name: PostRampName;
  colors: Array<[number, number, number]>;
}
const LADDER = POST_LADDER;
const STEPS = LADDER.length;
const POST_RAMPS: PostRamp[] = [];
const rampKeys = new Map<string, number>();
function rampIndex(name: PostRampName): number {
  let i = rampKeys.get(name);
  if (i === undefined) {
    i = POST_RAMPS.length;
    POST_RAMPS.push({ name, colors: LADDER.map((L) => familyAt(POST_FAMILIES[name], L)) });
    rampKeys.set(name, i);
  }
  return i;
}
/** 구간마다 갈래 목록 (첫 갈래가 그 구간의 환경 어둠) */
const SECTION_RAMPS: number[][] = D.sections.map((_, i) => {
  const names = ((moodOf(i).ramps ?? ['navy', 'gray', 'amber']) as readonly string[]).filter((n) => n in POST_FAMILIES) as PostRampName[];
  return names.map((n) => rampIndex(n));
});
const SECTION_ENV: number[] = SECTION_RAMPS.map((r) => r[0]);
/** 표 순서: 구간 0..N-1, 그다음 경계 k(구간 k와 k+1)의 합친 팔레트 */
const LUT_RAMPS: number[][] = [
  ...SECTION_RAMPS,
  ...BOUNDS.map((_, k) => [...new Set([...SECTION_RAMPS[k], ...SECTION_RAMPS[k + 1]])]),
];
const LUT_ENV: Array<Set<number>> = [
  ...SECTION_ENV.map((e) => new Set([e])),
  ...BOUNDS.map((_, k) => new Set([SECTION_ENV[k], SECTION_ENV[k + 1]])),
];
const LUT_N = LUT_RAMPS.length;
const RAMP_N = POST_RAMPS.length;
/**
 * 갈래 고르기 거리: 같은 밝기에서의 색 차이 (밝기를 뺀 색 성분, 초록을 더 무겁게).
 * 어두운 곳(흑백 8~38)에서는 환경 갈래가 아닌 갈래에 작은 벌점을 더해 어둠이 그 구간의 차가운 한 갈래로 모인다
 * (어두운 갈래끼리는 색 차이가 작아 칸마다 이리저리 갈리면 얼룩이 된다).
 */
const CHROMA_W = [1, 4 / 3, 2 / 3];
const DARK_BIAS = 25;

/** 갈래마다 밝기 0~255(정수)에서의 색 (계단 칸 사이는 선형) */
const rampAtLuma: Float32Array[] = POST_RAMPS.map((r) => {
  const out = new Float32Array(256 * 3);
  for (let Y = 0; Y < 256; Y++) {
    let c: number[];
    if (Y <= LADDER[0]) c = r.colors[0].map((v) => (v * Y) / LADDER[0]);
    else if (Y >= LADDER[STEPS - 1]) c = r.colors[STEPS - 1];
    else {
      let k = 0;
      while (k < STEPS - 2 && Y > LADDER[k + 1]) k++;
      const t = (Y - LADDER[k]) / (LADDER[k + 1] - LADDER[k]);
      c = r.colors[k].map((v, j) => v + (r.colors[k + 1][j] - v) * t);
    }
    out.set(c, Y * 3);
  }
  return out;
});

/** 팔레트 여럿 → 32×32×32 색 상자마다 고른 갈래 번호 표를 세로로 쌓은 그림 (가로 1024 = 파랑 32칸 × 빨강 32칸, 표마다 세로 초록 32칸) */
function buildChoiceLut(): THREE.DataTexture {
  const data = new Uint8Array(1024 * 32 * LUT_N * 4);
  LUT_RAMPS.forEach((ramps, L) => {
    const env = LUT_ENV[L];
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        for (let r = 0; r < 32; r++) {
          const R = (r / 31) * 255;
          const G = (g / 31) * 255;
          const B = (b / 31) * 255;
          const Y = 0.299 * R + 0.587 * G + 0.114 * B;
          const Yi = Math.min(255, Math.round(Y));
          const dark = 1 - Math.min(1, Math.max(0, (Y - 8) / 30));
          let best = ramps[0];
          let bd = Infinity;
          for (const ri of ramps) {
            const t = rampAtLuma[ri];
            const cr = t[Yi * 3];
            const cg = t[Yi * 3 + 1];
            const cb = t[Yi * 3 + 2];
            const cy = 0.299 * cr + 0.587 * cg + 0.114 * cb;
            const dr = R - Y - (cr - cy);
            const dg = G - Y - (cg - cy);
            const db = B - Y - (cb - cy);
            let d = CHROMA_W[0] * dr * dr + CHROMA_W[1] * dg * dg + CHROMA_W[2] * db * db;
            if (!env.has(ri)) d += DARK_BIAS * dark;
            if (d < bd) {
              bd = d;
              best = ri;
            }
          }
          const o = ((L * 32 + g) * 1024 + b * 32 + r) * 4;
          data[o] = best;
          data[o + 3] = 255;
        }
      }
    }
  });
  const t = new THREE.DataTexture(data, 1024, 32 * LUT_N);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/**
 * 캐릭터·이펙트 칸 표: 32³ 색 상자마다 늘 쓰는 색(COMMON)과 모든 갈래 색 중 가장 가까운 색 (구간과 상관없이 하나).
 * 캐릭터 색은 시트 색 그대로 돌아오고, 테두리 빛·이펙트 번짐은 갈래 색으로 줄어든다.
 */
function buildMaskLut(): THREE.DataTexture {
  const pal = [...new Set([...COMMON.map((n) => COLORS[n] as string)])].map(hexRgb);
  for (const r of POST_RAMPS) for (const c of r.colors) pal.push(c);
  const data = new Uint8Array(1024 * 32 * 4);
  for (let g = 0; g < 32; g++) {
    for (let b = 0; b < 32; b++) {
      for (let r = 0; r < 32; r++) {
        const R = (r / 31) * 255;
        const G = (g / 31) * 255;
        const B = (b / 31) * 255;
        let best = pal[0];
        let bd = Infinity;
        for (const p of pal) {
          const d = 3 * (p[0] - R) ** 2 + 4 * (p[1] - G) ** 2 + 2 * (p[2] - B) ** 2;
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        const o = (g * 1024 + b * 32 + r) * 4;
        data[o] = best[0];
        data[o + 1] = best[1];
        data[o + 2] = best[2];
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

/** 갈래 색 표: 가로 계단 칸, 세로 갈래 (sRGB 0~255 그대로) */
function buildRampTex(): THREE.DataTexture {
  const data = new Uint8Array(STEPS * RAMP_N * 4);
  POST_RAMPS.forEach((r, j) => {
    r.colors.forEach((c, k) => {
      const o = (j * STEPS + k) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    });
  });
  const t = new THREE.DataTexture(data, STEPS, RAMP_N);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/**
 * 밝기 → 계단 자리 표 (가로 흑백 밝기 0~255): 값 t는 '몇째 계단 칸(소수)'. 모든 갈래가 같은 밝기 계단을 쓴다.
 * 반정밀 부동소수 텍스처를 선형으로 읽어 밝기 소수점까지 매끄럽게 (칸마다 계단을 반복해 찾지 않는다)
 */
function buildStepTex(): THREE.DataTexture {
  const W = 256;
  const data = new Uint16Array(W * 4);
  for (let Y = 0; Y < W; Y++) {
    let t: number;
    if (Y <= LADDER[0]) t = 0;
    else if (Y >= LADDER[STEPS - 1]) t = STEPS - 1;
    else {
      let k = 0;
      while (k < STEPS - 2 && Y > LADDER[k + 1]) k++;
      t = k + (Y - LADDER[k]) / (LADDER[k + 1] - LADDER[k]);
    }
    data[Y * 4] = THREE.DataUtils.toHalfFloat(t);
    data[Y * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const t = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/**
 * 후처리 (렌더 전용, 낮은 해상도 화면에서). 순서는 CLAUDE.md '2.5D 렌더 규칙'대로:
 *   밝은 곳 뽑기(1/4) → 젖은 바닥 반사 → 빛 번짐(밝은 곳에만: 세 겹 크기로 넓게, 강한 빛은 가로로 길게 번지는 플레어)
 *   → 안개 속 빛 무리 → 구간 분위기 색 보정·대비·가장자리 어둡게 → 구간 팔레트 (계단 안에서 줄이고, 단계 경계 2~3칸에서만 8×8 디더링).
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

const VIEW_DEPTH_GLSL = /* glsl */ `
float viewDepth(sampler2D depthTex, vec2 uv) {
  float d = texture2D(depthTex, uv).r;
  return ${NEAR.toFixed(1)} * ${FAR.toFixed(1)} / (${FAR.toFixed(1)} - d * (${FAR.toFixed(1)} - ${NEAR.toFixed(1)}));
}
`;

/**
 * 젖은 바닥 반사 (화면 공간): 바닥 칸(화면 알파 = 젖은 정도)에 바닥선을 축으로 뒤집은 장면을 더한다 (거울).
 * 카메라가 거의 수평이라 싸우는 면 물체의 거울 자리는 바닥선에서 같은 거리만큼 아래다 (늘이지 않는다: 문·쇼윈도·빛 웅덩이가 제자리에 비친다).
 * 물웅덩이(알파가 큰 곳)는 거울처럼 또렷하게, 덜 젖은 길은 조금 번진다. 빗방울 자리에 동심원이 퍼져 비친 그림이 흔들린다.
 * 그 위에 '길게 비친 빛': 같은 세로줄 위쪽의 밝은 빛(네온·전구·창, 1/4 크기 밝은 곳 그림)이 젖은 길에 세로로 길게 끌린다.
 * 높은 간판도 바닥에 제 색의 빛 기둥을 남긴다 (네온 네 겹의 마지막 겹). 바닥선 가까이(멀리 보는 바닥)일수록 세게 비친다 (프레넬).
 */
const REFLECT_FRAG = /* glsl */ `
uniform sampler2D hdr;
uniform sampler2D glow;
uniform vec2 size;
uniform float horizon;
uniform float stretch;
uniform float time;
uniform vec2 origin;
uniform float strength;
uniform float streakK;
varying vec2 vUv;
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
#ifdef DETAIL
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
#endif
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
#ifdef DETAIL
    float rr = ripple(wp);
    rip += rr * 1.6;
#else
    float rr = 0.0;
#endif
    // 물웅덩이: 거울 (번짐 적게), 덜 젖은 길: 세로로 조금 번진다
    float mirror = smoothstep(0.75, 0.95, c.a);
    float spread = mix(1.8, 0.6, mirror);
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
#ifdef DETAIL
    const int TAPS = 4;
#else
    const int TAPS = 2;
#endif
    // 거울 자리: 바닥선 가까이는 1:1에 가깝게, 앞(아래)으로 올수록 더 높은 곳을 비춘다 (얇은 바닥 띠에 가게 앞 창·문이 비치게)
    float h = d * stretch + d * d * 0.05;
    for (int k = 0; k < TAPS; k++) {
      float src = horizon - h - float(k) * spread - 0.5;
      float ok = step(0.0, src);
      vec2 uv = vec2((x + rip) / size.x, 1.0 - max(src, 0.0) / size.y);
      float w = (1.0 - float(k) * 0.18) * ok;
      acc += texture2D(hdr, uv).rgb * w;
      wsum += w;
    }
    // 바닥선 가까이(멀리 보는 바닥)는 더 세게, 발치(가까운 바닥)는 약하게 비친다
    float fresnel = mix(1.15, 0.65, clamp(d / 60.0, 0.0, 1.0));
    // 젖은 길은 빛(간판·창·가로등)을 세게 비추고 어두운 벽은 거의 비추지 않는다: 밝기에 따라 비추는 양을 정한다
    vec3 r = acc / max(wsum, 0.001);
    float lum = dot(r, vec3(0.299, 0.587, 0.114));
    float k = mix(smoothstep(0.012, 0.09, lum), 0.9, mirror * 0.6);
    col += r * k * c.a * strength * fresnel;
    // 길게 비친 빛: 이 세로줄 위쪽의 밝은 빛이 젖은 길에 끌린다 (물결 따라 흔들리고, 앞으로 올수록 옅어진다)
    vec3 st = vec3(0.0);
#ifdef DETAIL
    const int STREAK = 6;
#else
    const int STREAK = 3;
#endif
    float sx = (x + rip * 1.8) / size.x;
    for (int k = 0; k < STREAK; k++) {
      float fk = float(k) / float(STREAK - 1);
      float src = horizon - h - 12.0 - fk * fk * 210.0;
      if (src < 0.0) break;
      st += texture2D(glow, vec2(sx, 1.0 - src / size.y)).rgb * (1.0 - 0.55 * fk);
    }
    st *= 6.0 / float(STREAK);
    float along = 1.0 - smoothstep(4.0, 46.0, d);
    col += st * streakK * c.a * (0.35 + 0.65 * along) * (0.6 + 0.4 * mirror);
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
    // 문턱은 밝기와 가장 센 성분 중 큰 쪽으로 (채도 높은 네온은 밝기가 낮아도 빛이다)
    float m = max(l, max(s.r, max(s.g, s.b)) * 0.6);
    c += s * smoothstep(threshold, threshold * 2.2, m);
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

/** 8×8 바이어 무늬 (-0.5~0.5): 2×2 무늬를 세 번 겹쳐 계산 (표를 찾지 않는다) */
const BAYER_GLSL = /* glsl */ `
float m2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
float bayer8(vec2 p) {
  vec2 q = mod(floor(p), 8.0);
  float v = 16.0 * m2(mod(q, 2.0)) + 4.0 * m2(mod(floor(q * 0.5), 2.0)) + m2(floor(q * 0.25));
  return (v + 0.5) / 64.0 - 0.5;
}
`;

/**
 * 합치기 + 분위기 색 보정. 칸마다 그 칸의 구간 x(보이는 면의 깊이로: 가까운 물체는 제 자리, 먼 겹은 카메라 자리)로
 * 구간 분위기 색 보정을 섞고, 쓸 팔레트 표 번호와 캐릭터·이펙트 표시를 알파에 담아 팔레트 단계로 넘긴다
 * (알파 = 표 번호 + 32 × 캐릭터 칸).
 */
const COMPOSITE_FRAG = /* glsl */ `
#define SECTION_N ${SECTION_N}
#define BOUND_N ${BOUNDS.length}
uniform sampler2D hdr;
uniform sampler2D bloomQ;
uniform sampler2D bloomE;
uniform sampler2D bloomS;
uniform sampler2D streak;
uniform sampler2D depthTex;
uniform sampler2D maskTex;
uniform float hasMask;
uniform float bloomStrength;
uniform float streakStrength;
uniform vec3 secShadow[SECTION_N];
uniform vec3 secHigh[SECTION_N];
/** 구간마다 (채도, 대비, 노출) */
uniform vec3 secLook[SECTION_N];
uniform float bounds[BOUND_N];
uniform float moodBlend;
uniform float palHalf;
uniform float camX;
uniform vec2 ditherOrigin;
/** 화면 물들이기 (render/screenfx tint): 그림자 쪽 색 + 세기, 밝은 쪽 색 + 채도 */
uniform vec4 tintShadow;
uniform vec4 tintHigh;
uniform float vignette;
/** 화면 물들이기 (render/screenfx tint): rgb는 밝기 1로 맞춘 색, a는 세기. 밝기는 그대로 색만 그 쪽으로 */
uniform vec4 wash;
/** 하얀 심: 가장 센 성분이 이 사이에서 하얗게 날아간다 */
uniform vec2 hot;
/** 이펙트 빛 번짐 (애니 이펙트 칸만 그려 번지게 한 것, 1/4 크기)과 세기: 무대 칸에만 더한다 (14-5) */
uniform sampler2D fxGlow;
uniform float fxGlowK;
/** 배경 누르기 (render/screenfx press, 14-1 ⑥): rgb = 물들일 색 (선형), a = 세기. 방식 0 어둡게·물들이기, 1 반전, 2 흰 화면, 3 어둡게 + 색 더하기 (tint) */
uniform vec4 press;
uniform float pressMode;
/** 임팩트 프레임 (render/screenfx impact, 14-9 A): 켜지면 무대는 impactBg, 캐릭터·이펙트 칸은 impactInk (sRGB) */
uniform float impactOn;
uniform vec3 impactBg;
uniform vec3 impactInk;
varying vec2 vUv;
${VIEW_DEPTH_GLSL}
${BAYER_GLSL}

vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  // 밝은 쪽만 부드럽게 눌러 하얗게 날아가지 않게
  c = mix(c, 1.0 - 0.25 * exp(-(c - 0.75) / 0.25), step(0.75, c));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float lutFor(float wx) {
  for (int k = 0; k < BOUND_N; k++) {
    if (wx < bounds[k] - palHalf) return float(k);
    if (wx < bounds[k] + palHalf) return float(SECTION_N + k);
  }
  return float(SECTION_N - 1);
}
void main() {
  vec3 c = texture2D(hdr, vUv).rgb;
  vec4 mt = hasMask > 0.5 ? texture2D(maskTex, vUv) : vec4(0.0);
  float mk = step(1e-6, dot(mt.rgb, vec3(1.0)));
  // 앞겹(카메라 앞을 스치는 기둥·전선, 깊이 +1000)이 가린 칸: 표시 그림에는 캐릭터·이펙트가 있어도 화면에는 앞겹이 보인다 → 무대 칸으로
  // (가린 물체 색이 캐릭터·이펙트 모양대로 따로 보정되어 떠 보이지 않게)
  if (mk > 0.5 && viewDepth(depthTex, vUv) < ${(DIST - 300).toFixed(1)}) mk = 0.0;
  // 임팩트 프레임: 두 색만 (무대 = 밝은 한 색, 캐릭터·이펙트 = 잉크 실루엣). 표시 칸으로 적어 팔레트 단계가 공통 색표로 맞춘다
  if (impactOn > 0.5) {
    gl_FragColor = vec4(mk > 0.5 ? impactInk : impactBg, 32.0 / 255.0);
    return;
  }
  // 애니 이펙트 칸 (vfx/gg, 표시 그림 알파 1): 색 보정·빛 번짐·가장자리 어둡게 없이 그린 색 그대로 (고채도 4색 띠를 지킨다).
  // 색은 표시 그림에서 읽는다 (화면 그림의 그 칸에는 이펙트 판 뒤에 그린 앞 안개·앞 비가 얹혀 있을 수 있다)
  if (mk * mt.a > 0.5) {
    vec3 e = clamp(mt.rgb, 0.0, 1.0);
    gl_FragColor = vec4(mix(e * 12.92, 1.055 * pow(e, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, e)), 32.0 / 255.0);
    return;
  }
  if (bloomStrength > 0.0) {
    vec3 b = texture2D(bloomQ, vUv).rgb * 0.5 + texture2D(bloomE, vUv).rgb * 0.45 + texture2D(bloomS, vUv).rgb * 0.45;
    c += b * bloomStrength;
    vec3 st = texture2D(streak, vUv).rgb;
    c += mix(st, vec3(dot(st, LUMA)) * vec3(0.7, 0.85, 1.05), 0.45) * streakStrength;
  }
  // 이 칸의 구간 x: 보이는 면의 월드 x. 싸우는 줄에서 멀어질수록(먼 겹·하늘) 카메라 자리로
  float dz = viewDepth(depthTex, vUv);
  float wx = camX + (gl_FragCoord.x - ${(RT_W / 2).toFixed(1)}) * dz / ${DIST.toFixed(1)};
  float far = smoothstep(${(DIST + 400).toFixed(1)}, ${(DIST + 1800).toFixed(1)}, dz);
  float px = mix(wx, camX, far);
  // 구간 분위기 (mood.ts moodAt과 같은 섞기: 경계 양쪽 moodBlend에서 반씩)
  vec3 sh = secShadow[0];
  vec3 hi = secHigh[0];
  vec3 lk = secLook[0];
  for (int k = 0; k < BOUND_N; k++) {
    float t = clamp(0.5 + (px - bounds[k]) / (2.0 * moodBlend), 0.0, 1.0);
    sh = mix(sh, secShadow[k + 1], t);
    hi = mix(hi, secHigh[k + 1], t);
    lk = mix(lk, secLook[k + 1], t);
  }
  sh = mix(sh, tintShadow.rgb, tintShadow.a);
  hi = mix(hi, tintHigh.rgb, tintShadow.a);
  float sat = mix(lk.x, tintHigh.a, tintShadow.a);
  // 분위기 색 보정: 그림자 쪽은 sh, 밝은 쪽은 hi 색으로 물들이고(밝기는 그대로) 채도를 맞춘다
  c *= lk.z;
  float l = dot(c, LUMA);
  vec3 shN = sh / max(dot(sh, LUMA), 0.001);
  vec3 hiN = hi / max(dot(hi, LUMA), 0.001);
  vec3 tnt = mix(shN, hiN, smoothstep(0.015, 0.45, l));
  vec3 t = mix(c, c * tnt, 0.4);
  t *= l / max(dot(t, LUMA), 1e-5);
  t = mix(vec3(l), t, sat);
  t = mix(t, l * wash.rgb, wash.a);
  // 빛의 심 (네온 관·전구·용광로 불·이펙트 심): 가장 센 성분이 넘치는 칸은 밝기가 그 세기를 따라오게 하양을 더한다.
  // 채도 높은 빛(분홍·빨강 네온)은 밝기가 낮아 흑백 200에 못 미치므로 그만큼만 하얗게 (관의 하얀 심), 이미 밝은 빛(주황 창·청록 네온)은 그대로
  float m = max(c.r, max(c.g, c.b));
  float hk = smoothstep(hot.x, hot.y, m);
  t += max(0.0, hk * 0.7 - dot(t, LUMA));
  vec3 s = toSrgb(t);
  // 대비 (S자), 가장자리 어둡게
  s = mix(s, s * s * (3.0 - 2.0 * s), lk.y);
  vec2 v = (vUv - 0.5) * vec2(1.0, 0.72);
  s *= 1.0 - vignette * smoothstep(0.28, 0.62, length(v)) * (1.0 - 0.6 * dot(s, vec3(0.299, 0.587, 0.114)));
  float pressed = 0.0;
  if (mk < 0.5) {
    // 배경 누르기: 무대만 (캐릭터·이펙트 칸은 그대로). 누른 무대는 캐릭터·이펙트 칸처럼 공통 색표로 줄여
    // (디더 없이 몇 단계로 뭉친다: 애니 '임팩트 프레임'처럼 납작한 이펙트 색 실루엣)
    // (tint는 여기서 하지 않는다: 구간 팔레트로 줄인 뒤 팔레트 단계에서 무대 칸 색만 바꾼다)
    if (press.a > 0.0 && pressMode < 2.5) {
      vec3 pc = pow(clamp(press.rgb, 0.0, 1.0), vec3(1.0 / 2.2));
      float ls = dot(s, vec3(0.299, 0.587, 0.114));
      vec3 dark = pc * (0.04 + 0.5 * ls);
      vec3 to = pressMode < 0.5 ? dark : pressMode < 1.5 ? 1.0 - s : vec3(1.0);
      s = mix(s, to, press.a);
      pressed = 1.0;
    }
    // 이펙트 빛 번짐: 이펙트 둘레 무대에 그 색 빛 (가장자리 밖 6~12px)
    if (fxGlowK > 0.0) {
      vec3 g = texture2D(fxGlow, vUv).rgb * fxGlowK;
      s = 1.0 - (1.0 - s) * exp(-g);
    }
  }
  // 팔레트 표: 구간 x를 바이어 무늬로 12칸 흔들어 바뀌는 자리가 수직선이 되지 않게
  float row = lutFor(px + bayer8(gl_FragCoord.xy + ditherOrigin) * 12.0);
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), (row + 32.0 * max(mk, pressed)) / 255.0);
}
`;

/**
 * 팔레트로 줄이기. 무대 칸: 계단 고르기 표 → 그 계단 안 자리 t(밝기로) → 단계 경계 근처에서만 바이어 무늬로 이웃 단계와 섞는다.
 * 섞는 폭은 t가 화면 칸마다 바뀌는 빠르기(2×2 칸 미분)로 정한다: 폭 = ditherK × 빠르기 → 화면 칸으로 늘 약 2칸.
 * 빠르기가 너무 크면(물체의 윤곽·도트 무늬) 섞지 않고, 2×2 칸 안에서 계단이 바뀌면(다른 색 갈래와 맞닿은 곳) 섞지 않는다.
 * 캐릭터·이펙트 칸은 COMMON + 계단 색 표에서 가장 가까운 색 (디더 없음).
 */
const PALETTE_FRAG = /* glsl */ `
#define LUT_N ${LUT_N}
#define RAMP_N ${RAMP_N}
#define STEPS ${STEPS}
uniform sampler2D graded;
uniform sampler2D choiceLut;
uniform sampler2D maskLut;
uniform sampler2D rampTex;
uniform sampler2D stepTex;
uniform vec2 ditherOrigin;
uniform float ditherK;
uniform float ditherMax;
uniform float curveLimit;
/** 배경 누르기 tint (render/screenfx press, 방식 tint): rgb = 더할 색 (sRGB), a = 세기. 팔레트로 줄인 무대 칸 색을 scale배로 낮추고 색을 더한다 */
uniform vec4 pressTint;
uniform float pressScale;
/** 배경 누르기 crack (14-8 ⑧): a = 세기, rgb = 한 색. 어두운 단·밝은 단·균열 색 (sRGB) */
uniform vec4 pressCrack;
uniform vec3 crackDark;
uniform vec3 crackHi;
uniform vec3 crackLine;
/** 퍼져 나간 금 (에드워드 '무게', 2026-11-05): xy = 가운데 (gl_FragCoord + ditherOrigin 자리), z = 번진 반지름 px (0이면 그물 금) */
uniform vec3 crackCenter;
varying vec2 vUv;
${BAYER_GLSL}
vec2 crackHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
/** 월드에 붙은 균열 그물: 가장 가까운 두 씨앗까지 거리 차 (px, 작을수록 금 위) */
float crackDist(vec2 w) {
  const float S = 26.0;
  vec2 g = floor(w / S);
  vec2 f = w / S - g;
  float d1 = 9.0;
  float d2 = 9.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 r = o + 0.1 + crackHash(g + o) * 0.8 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  return (sqrt(d2) - sqrt(d1)) * S;
}
/** 퍼져 나간 금의 그물 점: 고리 j (반지름 5px × 1.5^j)와 칸 s (14칸) → 가운데 기준 자리. 각과 반지름이 조금씩 비켜난다 */
vec2 crackNode(float s, float j) {
  vec2 h = crackHash(vec2(s, j));
  float th = (s + 0.5 + (h.x - 0.5) * 0.6) * 0.44879895 - 3.1415927;
  return vec2(cos(th), sin(th)) * (5.0 * pow(1.5, j) * (1.0 + (h.y - 0.5) * 0.16));
}
float crackSeg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  vec2 ap = p - a;
  return length(ap - ab * clamp(dot(ap, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0));
}
/**
 * 맞은 점에서 퍼져 나간 금: 그물 점을 잇는 곧은 금 조각. 바퀴살 금은 고리마다 꺾이며 바깥으로 뻗고 (안쪽 7줄, 2~4번째 고리부터 사이에서 갈라져 14줄),
 * 고리 금은 이웃 바퀴살 사이를 곧게 잇되 칸마다 있거나 없다 (안쪽일수록 많다). 고리 반지름이 1.5배씩 커져 가운데 가까울수록 조각이 잘고 바깥으로 갈수록 크다.
 * 바퀴살은 가운데 가까울수록 굵다 (3px → 1.7px). 금 위면 참
 */
bool radialCrack(vec2 w) {
  vec2 d = w - crackCenter.xy;
  float r = length(d);
  if (r > crackCenter.z) return false;
  if (r < 3.5) return true;
  float a = atan(d.y, d.x) + 3.1415927;
  float j0 = floor(log(r / 5.0) / log(1.5));
  float s0 = floor(a / 0.44879895);
  float spoke = 99.0;
  float ring = 99.0;
  for (int dj = -1; dj <= 1; dj++) {
    float j = j0 + float(dj);
    for (int ds = -1; ds <= 1; ds++) {
      float sl = mod(s0 + float(ds), 14.0);
      vec2 A = crackNode(sl, j);
      float born = mod(sl, 2.0) < 0.5 ? -9.0 : 2.0 + floor(crackHash(vec2(sl, 7.0)).x * 3.0);
      if (j >= born) spoke = min(spoke, crackSeg(d, A, crackNode(sl, j + 1.0)));
      if (j >= 1.0 && crackHash(vec2(sl + 31.0, j)).y < (j < 4.0 ? 0.75 : 0.5)) ring = min(ring, crackSeg(d, A, crackNode(mod(sl + 1.0, 14.0), j)));
    }
  }
  return spoke < mix(1.5, 0.85, clamp(r / 80.0, 0.0, 1.0)) || ring < 0.75;
}
vec2 lutUv(vec3 c, float row, float rows) {
  vec3 q = floor(clamp(c, 0.0, 1.0) * 31.0 + 0.5);
  return vec2((q.b * 32.0 + q.r + 0.5) / 1024.0, (row * 32.0 + q.g + 0.5) / (32.0 * rows));
}
void main() {
  vec4 s = texture2D(graded, vUv);
  float a = floor(s.a * 255.0 + 0.5);
  float isMask = step(31.5, a);
  float row = a - 32.0 * isMask;
  vec3 c = s.rgb;
  float r = floor(texture2D(choiceLut, lutUv(c, row, float(LUT_N))).r * 255.0 + 0.5);
  float Y = dot(c, vec3(0.299, 0.587, 0.114)) * 255.0;
  float t = texture2D(stepTex, vec2((Y + 0.5) / 256.0, 0.5)).r;
  // 계단 경계 근처만 섞는다 (미분은 모든 칸이 함께 계산한다). 모든 갈래가 같은 밝기 계단이라 갈래가 바뀌는 곳도 밝기로 이어진다
  float speed = length(vec2(dFdx(t), dFdy(t)));
  float edgeMask = abs(dFdx(isMask)) + abs(dFdy(isMask));
  float w = (edgeMask < 0.5 && speed < ditherMax) ? min(ditherK * speed, 0.5) : 0.0;
#ifdef DETAIL
  // 도트 무늬(벽돌 결·창틀) 안에서는 섞지 않는다: 양옆 밝기가 곧게 이어지는 매끄러운 빛에서만
  vec2 tx = vec2(dFdx(vUv.x), dFdy(vUv.y));
  vec3 W3 = vec3(0.299, 0.587, 0.114) * 255.0;
  float yl = dot(texture2D(graded, vUv - vec2(tx.x, 0.0)).rgb, W3);
  float yr = dot(texture2D(graded, vUv + vec2(tx.x, 0.0)).rgb, W3);
  float yd = dot(texture2D(graded, vUv - vec2(0.0, tx.y)).rgb, W3);
  float yu = dot(texture2D(graded, vUv + vec2(0.0, tx.y)).rgb, W3);
  if (max(abs(yl + yr - 2.0 * Y), abs(yd + yu - 2.0 * Y)) > curveLimit) w = 0.0;
#endif
  float B = bayer8(gl_FragCoord.xy + ditherOrigin);
  float stp = clamp(floor(t + 0.5 + B * 2.0 * w), 0.0, float(STEPS - 1));
#ifdef DETAIL
  // 무테: 계단으로 줄이며 생기는 1칸짜리 어두운 줄을 막는다. 양옆(또는 위아래)이 모두 더 높은 계단인데
  // 원래 밝기 차이가 작으면(흐린 줄) 이 칸도 그 계단으로 (형태를 따라 어두운 선이 서지 않게)
  float sl = floor(texture2D(stepTex, vec2((yl + 0.5) / 256.0, 0.5)).r + 0.5);
  float sr = floor(texture2D(stepTex, vec2((yr + 0.5) / 256.0, 0.5)).r + 0.5);
  float sd = floor(texture2D(stepTex, vec2((yd + 0.5) / 256.0, 0.5)).r + 0.5);
  float su = floor(texture2D(stepTex, vec2((yu + 0.5) / 256.0, 0.5)).r + 0.5);
  if (isMask < 0.5) {
    if (min(sl, sr) > stp && max(yl, yr) - Y < 8.0) stp = min(sl, sr);
    else if (min(sd, su) > stp && max(yd, yu) - Y < 8.0) stp = min(sd, su);
  }
#endif
  vec3 o = texelFetch(rampTex, ivec2(int(stp), int(r)), 0).rgb;
  if (isMask > 0.5) o = texture2D(maskLut, lutUv(c, 0.0, 1.0)).rgb;
  // 무대만 어둡게 + 색 (팔레트 색마다 한 색으로 바뀌므로 새 그러데이션이 생기지 않는다: 몇 틱 동안 팔레트를 바꿔 끼운 것)
  else if (pressTint.a > 0.0) o = mix(o, o * pressScale + pressTint.rgb, pressTint.a);
  // 한 색 + 균열 (14-8 ⑧): 밝기 세 단으로 칠하고 금을 긋는다 (금은 월드에 붙어 카메라가 흔들려도 같은 자리)
  else if (pressCrack.a > 0.0) {
    float l = dot(o, vec3(0.299, 0.587, 0.114));
    vec3 fill = l < 0.1 ? crackDark : l < 0.34 ? pressCrack.rgb : crackHi;
    vec2 cw = gl_FragCoord.xy + ditherOrigin;
    if (crackCenter.z > 0.0 ? radialCrack(cw) : crackDist(cw) < 1.6) fill = crackLine;
    o = mix(o, fill, step(0.5, pressCrack.a));
  }
  gl_FragColor = vec4(o, 1.0);
}
`;

/**
 * 안개 속 빛 무리: 광원마다 그 둘레에만 작은 판을 더해 그린다 (화면 전체를 광원 수만큼 돌지 않게). 빛 번짐 뒤에 그린다 (두 번 번지지 않게).
 * 가운데가 밝고 둘레로 길게 옅어져 끝에서 0으로 사라진다 (빛은 물체가 아니다). 크기·세기는 구간 안개 짙기를 따른다 (world.ts가 look.halo·haloSize에).
 * 이 칸의 물체가 광원보다 훨씬 앞이면 그 사이 안개만 빛나므로 약하게. 아래로만 비추는 등은 무리가 등 밑으로 조금 처진다.
 * 이펙트 빛은 작고 옅게 (이펙트 그림이 제 빛을 그린다: 커다란 회색 거품이 뜨지 않게).
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
${VIEW_DEPTH_GLSL}
void main() {
  float x = length(vD) / vR;
  if (x >= 1.0) discard;
  // 긴 꼬리 + 작은 심 (끝에서 기울기 0으로 사라진다)
  float k = pow(1.0 - x, 2.5) * 0.8 + 0.2 * exp(-x * x * 20.0) * (1.0 - x);
  float occ = clamp(viewDepth(depthTex, vUv) / vDepth, 0.3, 1.0);
  // 이미 밝은 칸(간판 글자·전구)에는 덜 얹어 글자가 뭉개지지 않게
  float lum = dot(texture2D(scene, vUv).rgb, vec3(0.299, 0.587, 0.114));
  float spare = 1.0 - 0.75 * smoothstep(0.25, 1.2, lum);
  gl_FragColor = vec4(vCol * k * occ * spare * strength, 1.0);
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
/** 줌 펀치 (render/screenfx zoomPunch, 14-9 K): 배율과 가운데 (화면 px, y 아래로 +). 칸 단위로 옮겨 찍는다 */
uniform float zoom;
uniform vec2 zoomC;
varying vec2 vUv;
void main() {
  vec2 frag = floor(vUv * size);
  vec2 p = vec2(frag.x - margin + 0.5, size.y - 1.0 - frag.y - margin + 0.5);
  if (abs(zoom - 1.0) > 0.001) p = floor(zoomC + (p - zoomC) / zoom) + 0.5;
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

/** 카메라 자리 분위기에 따라 매 프레임 바뀌는 값 (world.ts가 채운다). 색 보정은 구간 데이터로 칸마다 섞는다 */
export interface PostLook {
  /** 안개 속 빛 무리 세기·크기 (안개가 짙을수록 크고 세다) */
  halo: number;
  haloSize: number;
  streak: number;
  /** 젖은 바닥에 길게 비친 빛 세기 */
  wetStreak: number;
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
  /** 젖은 바닥에 길게 비칠 빛 (1/4 크기, 문턱 낮게: 네온까지) */
  private readonly glow: THREE.WebGLRenderTarget;
  /** 이펙트 빛 번짐 (14-5): 애니 이펙트 칸만 그린 원본 (화면 크기, gl/view가 그린다) → 1/2 → 1/4 (A·B) */
  readonly fxSrc: THREE.WebGLRenderTarget;
  private readonly fxH: THREE.WebGLRenderTarget;
  private readonly fxQ: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private fxGlowOn = false;
  /** 색 보정까지 마친 화면 (팔레트로 줄이기 전, 알파 = 팔레트 표 번호 + 캐릭터 표시) */
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
  private readonly blit: THREE.ShaderMaterial;
  private readonly shear: THREE.ShaderMaterial;
  private readonly tmp = new THREE.Vector3();
  private readonly haloMesh: THREE.Mesh;
  private readonly haloGeo: THREE.InstancedBufferGeometry;
  private readonly haloScene = new THREE.Scene();
  /** 품질 (높음: 빗방울 동심원·반사 탭 많이) */
  private detail = true;
  readonly look: PostLook = { halo: 1, haloSize: 1, streak: 0.3, wetStreak: 1 };

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
    this.glow = target(Math.ceil(RT_W / 4), Math.ceil(RT_H / 4), hdrType, false, true);
    this.fxSrc = target(RT_W, RT_H, THREE.UnsignedByteType);
    this.fxH = target(Math.ceil(RT_W / 2), Math.ceil(RT_H / 2), hdrType, false, true);
    this.fxQ = pair(4);
    this.graded = target(RT_W, RT_H, THREE.UnsignedByteType);
    this.final = target(RT_W, RT_H, THREE.UnsignedByteType);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: FULL_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.reflect = mat(REFLECT_FRAG, {
      hdr: { value: this.hdr.texture },
      glow: { value: this.glow.texture },
      size: { value: new THREE.Vector2(RT_W, RT_H) },
      horizon: { value: 0 },
      stretch: { value: 1.8 },
      time: { value: 0 },
      origin: { value: new THREE.Vector2() },
      strength: { value: 1.0 },
      streakK: { value: 0.5 },
    });
    this.reflect.defines = { DETAIL: '' };
    this.bright = mat(BRIGHT_FRAG, { src: { value: null }, texel: { value: new THREE.Vector2(1 / RT_W, 1 / RT_H) }, threshold: { value: 0.5 } });
    this.down = mat(DOWN_FRAG, { src: { value: null }, texel: { value: new THREE.Vector2() }, gate: { value: 0 } });
    this.blur = mat(BLUR_FRAG, { src: { value: null }, dir: { value: new THREE.Vector2() } });
    const sec = D.sections.map((_, i) => moodOf(i));
    this.composite = mat(COMPOSITE_FRAG, {
      hdr: { value: this.lit.texture },
      bloomQ: { value: this.q[0].texture },
      bloomE: { value: this.e[0].texture },
      bloomS: { value: this.s[0].texture },
      streak: { value: this.st[0].texture },
      depthTex: { value: this.hdr.depthTexture },
      maskTex: { value: null },
      hasMask: { value: 0 },
      bloomStrength: { value: 0.55 },
      streakStrength: { value: 0.3 },
      secShadow: { value: sec.map((m) => new THREE.Color(m.grade.shadow)) },
      secHigh: { value: sec.map((m) => new THREE.Color(m.grade.high)) },
      secLook: { value: sec.map((m) => new THREE.Vector3(m.grade.sat, m.grade.contrast, m.exposure ?? 1)) },
      bounds: { value: BOUNDS },
      moodBlend: { value: MOOD_BLEND },
      palHalf: { value: PAL_HALF },
      camX: { value: 0 },
      ditherOrigin: { value: new THREE.Vector2() },
      tintShadow: { value: new THREE.Vector4(0, 0, 0, 0) },
      tintHigh: { value: new THREE.Vector4(1, 1, 1, 1) },
      vignette: { value: 0.2 },
      wash: { value: new THREE.Vector4(1, 1, 1, 0) },
      hot: { value: new THREE.Vector2(0.6, 1.25) },
      fxGlow: { value: this.fxQ[0].texture },
      fxGlowK: { value: 0 },
      press: { value: new THREE.Vector4(0, 0, 0, 0) },
      pressMode: { value: 0 },
      impactOn: { value: 0 },
      impactBg: { value: new THREE.Vector3(1, 1, 1) },
      impactInk: { value: new THREE.Vector3(0, 0, 0) },
    });
    this.palette = mat(PALETTE_FRAG, {
      graded: { value: this.graded.texture },
      choiceLut: { value: buildChoiceLut() },
      maskLut: { value: buildMaskLut() },
      rampTex: { value: buildRampTex() },
      stepTex: { value: buildStepTex() },
      ditherOrigin: { value: new THREE.Vector2() },
      ditherK: { value: 0.9 },
      ditherMax: { value: 0.35 },
      curveLimit: { value: 4 },
      pressTint: { value: new THREE.Vector4(0, 0, 0, 0) },
      pressScale: { value: 1 },
      pressCrack: { value: new THREE.Vector4(0, 0, 0, 0) },
      crackDark: { value: new THREE.Vector3() },
      crackHi: { value: new THREE.Vector3() },
      crackLine: { value: new THREE.Vector3() },
      crackCenter: { value: new THREE.Vector3() },
    });
    this.palette.defines = { DETAIL: '' };
    this.blit = mat(BLIT_FRAG, { src: { value: this.final.texture } });
    this.shear = mat(SHEAR_FRAG, {
      src: { value: this.final.texture },
      size: { value: new THREE.Vector2(RT_W, RT_H) },
      margin: { value: MARGIN },
      count: { value: 0 },
      lineA: { value: Array.from({ length: SHEAR_MAX }, () => new THREE.Vector4()) },
      lineB: { value: Array.from({ length: SHEAR_MAX }, () => new THREE.Vector4()) },
      zoom: { value: 1 },
      zoomC: { value: new THREE.Vector2() },
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

  /** 이펙트 빛 번짐 원본(fxSrc)을 이번 프레임에 그렸는가 (view.ts가 정한다) */
  setFxGlow(on: boolean): void {
    this.fxGlowOn = on;
  }

  /** 캐릭터·이펙트 표시 그림 (view.ts가 그린다). null이면 표시 없음 */
  setMask(tex: THREE.Texture | null): void {
    const u = this.composite.uniforms;
    u.maskTex.value = tex;
    u.hasMask.value = tex ? 1 : 0;
  }

  /** 품질: 낮음이면 반사 탭·동심원을 줄인다 (셰이더를 바뀔 때만 다시 만든다) */
  private setDetail(on: boolean): void {
    if (on === this.detail) return;
    this.detail = on;
    for (const m of [this.reflect, this.palette]) {
      if (on) m.defines.DETAIL = '';
      else delete m.defines.DETAIL;
      m.needsUpdate = true;
    }
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
    const L = this.look;
    this.setDetail(opts.bloom);
    // 1. 밝은 곳 (1/4): 젖은 바닥의 길게 비친 빛 (문턱 낮게, 네온까지) — 품질 낮음에서도 (작은 그림이라 싸다)
    const bu = this.bright.uniforms;
    bu.src.value = this.hdr.texture;
    bu.threshold.value = 0.1;
    this.pass(renderer, this.bright, this.glow);
    // 2. 젖은 바닥 반사 (hdr → lit)
    const r = this.reflect.uniforms;
    r.horizon.value = this.horizon;
    r.time.value = time;
    r.origin.value.set(placed.ix, placed.iy);
    r.streakK.value = 0.55 * L.wetStreak;
    this.pass(renderer, this.reflect, this.lit);
    if (opts.bloom) {
      // 3. 빛 번짐: 밝은 곳만 1/4로 (반사 전 장면에서) → 가로 플레어 → 세 겹
      bu.src.value = this.hdr.texture;
      bu.threshold.value = 0.5;
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
    // 이펙트 빛 번짐 (14-5 '이펙트에는 강하게, 피크 프레임에 가장자리 밖 4~8px' → 이 화면 6~12px): 애니 이펙트 칸만 1/4로 줄여 가로·세로로 흐린다
    if (this.fxGlowOn) {
      this.half(renderer, this.fxSrc, this.fxH);
      this.half(renderer, this.fxH, this.fxQ[0]);
      this.blur2(renderer, this.fxQ, 1);
      u.fxGlowK.value = FX_GLOW * fxGlowScale.k;
    } else u.fxGlowK.value = 0;
    // 배경 누르기 (render/screenfx press)
    const pk = pressAt(time);
    const pu = this.palette.uniforms;
    const pt = pu.pressTint.value as THREE.Vector4;
    const pc = pu.pressCrack.value as THREE.Vector4;
    pt.w = 0;
    pc.w = 0;
    const srgb = (h: string): [number, number, number] => {
      const v = parseInt(h.slice(1), 16);
      return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    };
    if (pk > 0 && press.mode === 'tint') {
      // 팔레트 단계에서 (sRGB 그대로)
      pt.set(...srgb(press.color), pk);
      pu.pressScale.value = press.scale;
      u.press.value.w = 0;
    } else if (pk > 0 && press.mode === 'crack') {
      pc.set(...srgb(press.color), pk);
      (pu.crackDark.value as THREE.Vector3).set(...srgb(press.dark));
      (pu.crackHi.value as THREE.Vector3).set(...srgb(press.hi));
      (pu.crackLine.value as THREE.Vector3).set(...srgb(press.crack));
      // 퍼져 나간 금: 가운데 (월드 px → 이 단계 칸 자리 + 무늬 기준), 틱마다 바깥으로 번진다
      const cc = pu.crackCenter.value as THREE.Vector3;
      if (press.center) {
        const age = time - press.at;
        cc.set(press.center[0] + MARGIN, RT_H - MARGIN - press.center[1], age <= 0 ? 70 : age === 1 ? 170 : 4000);
      } else cc.z = 0;
      u.press.value.w = 0;
    } else if (pk > 0) {
      const pc = this.tintColor.set(press.color);
      u.press.value.set(pc.r, pc.g, pc.b, pk);
      u.pressMode.value = press.mode === 'invert' ? 1 : press.mode === 'white' ? 2 : 0;
    } else u.press.value.w = 0;
    // 임팩트 프레임 (14-9 A)
    if (impactAt(time)) {
      u.impactOn.value = 1;
      (u.impactBg.value as THREE.Vector3).set(...srgb(impact.bg));
      (u.impactInk.value as THREE.Vector3).set(...srgb(impact.ink));
    } else u.impactOn.value = 0;
    // 4. 안개 속 빛 무리 (빛 번짐 뒤: 두 번 번지지 않게)
    this.drawHalos(renderer, camera, 0.1 * L.halo * tint.halo, L.haloSize);
    // 5. 합치기·색 보정 (칸마다 구간 분위기, 알파에 팔레트 표 번호·캐릭터 표시)
    u.camX.value = placed.ix + SCREEN_W / 2;
    u.ditherOrigin.value.set(placed.ix, -placed.iy);
    // 화면 물들이기 (캐릭터 연출, render/screenfx): 색 보정의 두 색과 채도를 그 색 쪽으로, 그리고 색을 그 색으로 씻는다
    if (tint.k > 0) {
      const k = Math.min(1, tint.k);
      const sc = this.tintColor.set(tint.shadow);
      u.tintShadow.value.set(sc.r, sc.g, sc.b, k);
      const c = this.tintColor.set(tint.high);
      u.tintHigh.value.set(c.r, c.g, c.b, tint.sat);
      const l = Math.max(0.001, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
      u.wash.value.set(c.r / l, c.g / l, c.b / l, 0.55 * k);
    } else {
      u.tintShadow.value.w = 0;
      u.wash.value.w = 0;
    }
    this.pass(renderer, this.composite, this.graded);
    // 6. 팔레트 (디더 무늬는 싸우는 면에 붙여 카메라가 움직여도 지글거리지 않게)
    this.palette.uniforms.ditherOrigin.value.set(placed.ix, -placed.iy);
    this.pass(renderer, this.palette, this.final);
    // 선 따라 어긋남 (render/screenfx): final → graded로 옮겨 찍고 다시 final로 (확인 도구가 final을 읽는다)
    const cuts = shearFrame(time, placed.ix, placed.iy);
    const zk = zoomAt(time);
    if (cuts.length || zk !== 1) {
      const su = this.shear.uniforms;
      su.zoom.value = zk;
      (su.zoomC.value as THREE.Vector2).set(zoomPunch.x - placed.ix, zoomPunch.y - placed.iy);
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
  private drawHalos(renderer: THREE.WebGLRenderer, camera: THREE.Camera, strength: number, size: number): void {
    const n = loadedLights.count();
    const A = this.haloGeo.getAttribute('hA') as THREE.InstancedBufferAttribute;
    const C = this.haloGeo.getAttribute('hC') as THREE.InstancedBufferAttribute;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const p = loadedLights.pos[i];
      const c = loadedLights.col[i];
      const depth = camera.position.z - p.z;
      if (depth <= 0) continue;
      // 약한 빛(켜진 창·골목 전구)은 무리를 그리지 않는다: 옅은 무리는 팔레트 한 단계짜리 원판이 되어 물체처럼 보인다
      if (c.x + c.y + c.z < HALO_MIN) continue;
      this.tmp.set(p.x, p.y, p.z).project(camera);
      // 이펙트 빛: 작고 옅게 (이펙트 그림이 제 빛을 그린다)
      const fx = loadedLights.fx[i];
      const kk = fx ? 0.35 : 1;
      A.setXYZW(k, this.tmp.x * 0.5 + 0.5, this.tmp.y * 0.5 + 0.5, depth, p.w * 0.3 * size * (fx ? 0.55 : 1));
      C.setXYZW(k, c.x * kk, c.y * kk, c.z * kk, c.w);
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

  /** 확인 도구용: 팔레트 화면(여유 칸 뺀 480×270)을 RGBA로 (위에서 아래로). which = 'graded'면 팔레트로 줄이기 전 화면 */
  read(renderer: THREE.WebGLRenderer, w: number, h: number, which: 'final' | 'graded' = 'final'): Uint8ClampedArray {
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(which === 'graded' ? this.graded : this.final, MARGIN, MARGIN, w, h, buf);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return out;
  }
}
