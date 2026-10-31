import * as THREE from 'three';
import { COLORS, RAMPS } from '../palette';
import { FAR, MARGIN, NEAR, RT_H, RT_W, type Placed } from './core';

/**
 * 후처리 (렌더 전용, 낮은 해상도 화면에서): 빛 번짐(밝은 곳에만 약하게) → 깊이 기반 1px 외곽선 → 제한 팔레트 + 4×4 디더링.
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
 * 줄마다 물결로 좌우로 흔들고, 위로 몇 칸 더 섞어 세로로 번지게 한다.
 */
const REFLECT_FRAG = /* glsl */ `
uniform sampler2D hdr;
uniform vec2 size;
uniform float horizon;
uniform float stretch;
uniform float time;
uniform float originX;
uniform float strength;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(hdr, vUv);
  vec3 col = c.rgb;
  float row = (1.0 - vUv.y) * size.y;
  float d = row - horizon;
  if (c.a > 0.01 && d > 0.0) {
    float x = vUv.x * size.x;
    float rip = sin(d * 0.9 + time * 0.16 + (x + originX) * 0.045) * (0.4 + d * 0.05)
              + sin(d * 2.3 - time * 0.11 + (x + originX) * 0.13) * 0.5;
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int k = 0; k < 6; k++) {
      float src = horizon - d * stretch - float(k) * 3.0 - 1.0;
      float ok = step(0.0, src);
      vec2 uv = vec2((x + rip) / size.x, 1.0 - max(src, 0.0) / size.y);
      float w = (1.0 - float(k) * 0.14) * ok;
      acc += texture2D(hdr, uv).rgb * w;
      wsum += w;
    }
    float fade = 1.0 - clamp(d / 90.0, 0.0, 0.5);
    // 젖은 길은 빛(간판·창·가로등)을 세게 비추고 어두운 벽은 거의 비추지 않는다: 밝기에 따라 비추는 양을 정한다
    vec3 r = acc / max(wsum, 0.001);
    float lum = dot(r, vec3(0.299, 0.587, 0.114));
    col += r * smoothstep(0.012, 0.09, lum) * c.a * strength * fade;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

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
    c += s * smoothstep(threshold, threshold * 2.0, l);
  }
  gl_FragColor = vec4(c * 0.25, 1.0);
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
uniform sampler2D bloom;
uniform sampler2D lut;
uniform vec2 texel;
uniform float bloomStrength;
uniform vec2 ditherOrigin;
uniform float ditherAmount;
uniform float outlineRange;
uniform vec3 outlineColor;
varying vec2 vUv;

float viewDepth(vec2 uv) {
  float d = texture2D(depthTex, uv).r;
  return ${NEAR.toFixed(1)} * ${FAR.toFixed(1)} / (${FAR.toFixed(1)} - d * (${FAR.toFixed(1)} - ${NEAR.toFixed(1)}));
}
/** 4×4 바이어 무늬 (-0.5~0.5): 2×2 무늬를 두 번 겹쳐 계산 (표를 찾지 않는다) */
float m2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  return (4.0 * m2(mod(q, 2.0)) + m2(floor(q * 0.5)) + 0.5) / 16.0 - 0.5;
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
void main() {
  vec3 c = texture2D(hdr, vUv).rgb + texture2D(bloom, vUv).rgb * bloomStrength;
  // 깊이 외곽선: 바로 옆이 훨씬 가까운 물체면 이 칸(바깥쪽)을 어둡게 (먼 겹에는 긋지 않는다).
  // 깊이의 역수는 평면 위에서 화면 좌표에 선형이라, 2차 차분이 0이 아닌 곳만 끊긴 곳으로 본다
  // (거의 수평으로 보이는 바닥처럼 줄마다 깊이가 크게 바뀌는 평면에는 긋지 않는다).
  float w0 = 1.0 / viewDepth(vUv);
  float wl = 1.0 / viewDepth(vUv - vec2(texel.x, 0.0));
  float wr = 1.0 / viewDepth(vUv + vec2(texel.x, 0.0));
  float wd = 1.0 / viewDepth(vUv - vec2(0.0, texel.y));
  float wu = 1.0 / viewDepth(vUv + vec2(0.0, texel.y));
  float bend = max(abs(wl + wr - 2.0 * w0), abs(wu + wd - 2.0 * w0));
  float wn = max(max(wl, wr), max(wu, wd));
  float edge = step(w0 * 0.006, bend) * step(w0 * 0.006, wn - w0) * step(1.0 / outlineRange, wn);
  vec3 s = toSrgb(c);
  s = mix(s, outlineColor, edge);
  s += bayer(gl_FragCoord.xy + ditherOrigin) * ditherAmount;
  gl_FragColor = vec4(palette(s), 1.0);
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

function target(w: number, h: number, type: THREE.TextureDataType, depth = false): THREE.WebGLRenderTarget {
  const t = new THREE.WebGLRenderTarget(w, h, {
    type,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: depth,
  });
  if (depth) t.depthTexture = new THREE.DepthTexture(w, h);
  return t;
}

export interface PostOptions {
  bloom: boolean;
}

export class Post {
  readonly hdr: THREE.WebGLRenderTarget;
  private readonly lit: THREE.WebGLRenderTarget;
  private readonly reflect: THREE.ShaderMaterial;
  /** 바닥선 (렌더 타깃 위에서부터 몇째 줄, 싸우는 면 기준) */
  horizon = 0;
  private readonly quarterA: THREE.WebGLRenderTarget;
  private readonly quarterB: THREE.WebGLRenderTarget;
  readonly final: THREE.WebGLRenderTarget;
  private readonly quad: THREE.Mesh;
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly scene = new THREE.Scene();
  private readonly bright: THREE.ShaderMaterial;
  private readonly blur: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly blit: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer) {
    const float = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const hdrType = float ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.hdr = target(RT_W, RT_H, hdrType, true);
    this.lit = target(RT_W, RT_H, hdrType);
    const qw = Math.ceil(RT_W / 4);
    const qh = Math.ceil(RT_H / 4);
    this.quarterA = target(qw, qh, hdrType);
    this.quarterB = target(qw, qh, hdrType);
    for (const t of [this.quarterA, this.quarterB]) {
      t.texture.minFilter = THREE.LinearFilter;
      t.texture.magFilter = THREE.LinearFilter;
    }
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
      originX: { value: 0 },
      strength: { value: 1.0 },
    });
    this.bright = mat(BRIGHT_FRAG, { src: { value: null }, texel: { value: new THREE.Vector2(1 / RT_W, 1 / RT_H) }, threshold: { value: 0.55 } });
    this.blur = mat(BLUR_FRAG, { src: { value: null }, dir: { value: new THREE.Vector2() } });
    this.composite = mat(COMPOSITE_FRAG, {
      hdr: { value: this.lit.texture },
      depthTex: { value: this.hdr.depthTexture },
      bloom: { value: this.quarterA.texture },
      lut: { value: buildLut() },
      texel: { value: new THREE.Vector2(1 / RT_W, 1 / RT_H) },
      bloomStrength: { value: 0.5 },
      ditherOrigin: { value: new THREE.Vector2() },
      ditherAmount: { value: 0.035 },
      outlineRange: { value: 3400 },
      outlineColor: { value: new THREE.Color(0x07060e) },
    });
    this.blit = mat(BLIT_FRAG, { src: { value: this.final.texture } });
    this.quad = new THREE.Mesh(geo, this.bright);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private pass(renderer: THREE.WebGLRenderer, m: THREE.ShaderMaterial, to: THREE.WebGLRenderTarget | null): void {
    this.quad.material = m;
    renderer.setRenderTarget(to);
    renderer.render(this.scene, this.cam);
  }

  /** hdr에 그린 장면 → final(팔레트 화면) → 캔버스 */
  run(renderer: THREE.WebGLRenderer, placed: Placed, opts: PostOptions, time: number): void {
    const u = this.composite.uniforms;
    const r = this.reflect.uniforms;
    r.horizon.value = this.horizon;
    r.time.value = time;
    r.originX.value = placed.ix;
    this.pass(renderer, this.reflect, this.lit);
    if (opts.bloom) {
      this.bright.uniforms.src.value = this.lit.texture;
      this.pass(renderer, this.bright, this.quarterA);
      this.blur.uniforms.src.value = this.quarterA.texture;
      this.blur.uniforms.dir.value.set(1 / this.quarterA.width, 0);
      this.pass(renderer, this.blur, this.quarterB);
      this.blur.uniforms.src.value = this.quarterB.texture;
      this.blur.uniforms.dir.value.set(0, 1 / this.quarterA.height);
      this.pass(renderer, this.blur, this.quarterA);
      u.bloomStrength.value = 0.5;
    } else u.bloomStrength.value = 0;
    // 디더 무늬는 싸우는 면에 붙여 카메라가 움직여도 지글거리지 않게
    u.ditherOrigin.value.set(placed.ix, -placed.iy);
    this.pass(renderer, this.composite, this.final);
    this.pass(renderer, this.blit, null);
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
