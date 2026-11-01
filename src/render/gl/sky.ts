import * as THREE from 'three';
import { shared } from './lights';

/**
 * 하늘과 바다 (렌더 전용, 하늘 겹 판에 그린다). 도트 그림 대신 셰이더로 칸마다 계산한다 (칸 = 화면 1px, 흐림 없음):
 * - 하늘: 꼭대기는 어둡고, 지평선으로 갈수록 도시 불빛이 번져 구간 분위기 색(glow)으로 물든다.
 * - 구름: 가로로 길게 늘어진 층구름이 천천히 흐른다. 아랫면 가장자리와 지평선 쪽은 도시 불빛을 받아 밝다.
 * - 달: 구름이 옅을 때만 비치고, 둘레에 달무리.
 * - 번개 (가끔): 구름 속이 번쩍이고, 때로 갈지자 줄기가 내리친다.
 * - 바다: 지평선 가까이 하늘 빛이 비치고, 가로 물결 줄과 달빛 길이 반짝인다.
 * 바닥에는 비치지 않는 판이라 화면 알파는 0.
 */
const FRAG = /* glsl */ `
uniform vec2 size;
uniform float horizon;
uniform vec3 moon;
uniform float uTime;
uniform vec3 zenith;
uniform vec3 midSky;
uniform vec3 glow;
uniform float glowK;
uniform vec3 cloud;
uniform vec3 cloudLit;
uniform float cover;
uniform float flash;
uniform vec2 bolt;
varying vec2 vUv;

float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h12(i);
  float b = h12(i + vec2(1.0, 0.0));
  float c = h12(i + vec2(0.0, 1.0));
  float d = h12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm4(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.07 + vec2(13.7, 7.3);
    a *= 0.5;
  }
  return s * 1.07;
}
/** 구름 짙기 (0~1): 가로로 길게 늘어진 층구름. t는 꼭대기 0 ~ 지평선 1 */
float cloudAt(vec2 p, float t) {
  vec2 q = vec2(p.x / 150.0 + uTime * 0.00022, p.y / 34.0);
  float warp = vnoise(q * 0.6 + vec2(uTime * 0.00008, 3.1)) * 0.7 + vnoise(q * 1.3 + 9.2) * 0.3;
  float n = fbm4(q + vec2(warp * 0.9, warp * 0.25));
  float band = smoothstep(0.02, 0.3, t) * (1.0 - 0.55 * smoothstep(0.75, 1.0, t));
  return smoothstep(1.0 - cover - 0.05, 1.0 - cover + 0.28, n) * band;
}
void main() {
  vec2 p = floor(vec2(vUv.x, 1.0 - vUv.y) * size) + 0.5;
  vec3 col;
  float md = length(p - moon.xy);
  if (p.y < horizon) {
    float t = clamp(p.y / horizon, 0.0, 1.0);
    col = mix(zenith, midSky, smoothstep(0.0, 0.9, t));
    col += glow * glowK * (pow(t, 2.6) * 0.9 + pow(t, 8.0) * 0.8);
    col += vec3(0.30, 0.34, 0.42) * 0.10 * smoothstep(moon.z * 4.5, 0.0, md);
    float d = cloudAt(p, t);
    // 아랫면 가장자리: 아래로 갈수록 옅어지는 곳 (화면 미분으로 한 번에)
    float rim = clamp(dFdy(d) * 3.0, 0.0, 1.0);
    vec3 cc = mix(cloud, cloudLit, clamp(smoothstep(0.25, 1.0, t) * 0.85 + rim * 1.6, 0.0, 1.0));
    cc += vec3(0.20, 0.22, 0.27) * 0.25 * smoothstep(moon.z * 6.0, 0.0, md);
    cc += (cloudLit * 1.5 + vec3(0.35, 0.38, 0.55)) * flash * (0.4 + d);
    col = mix(col, cc, d);
    col = mix(col, vec3(0.62, 0.64, 0.66), step(md, moon.z) * (1.0 - smoothstep(0.15, 0.7, d)));
    if (bolt.y > 0.0) {
      float seg = floor(p.y / 7.0);
      float f = fract(p.y / 7.0);
      float bx = bolt.x + mix((h12(vec2(seg, bolt.x)) - 0.5) * 12.0, (h12(vec2(seg + 1.0, bolt.x)) - 0.5) * 12.0, f);
      float on = step(abs(p.x - bx), 0.6) * step(p.y, horizon * (0.5 + 0.4 * h12(vec2(bolt.x, 9.0))));
      col += vec3(0.8, 0.85, 1.0) * on * bolt.y * 2.5;
    }
  } else {
    float d = p.y - horizon;
    col = mix(midSky * 0.8 + glow * glowK * 0.45, zenith * 0.4, smoothstep(0.0, 26.0, d));
    float w = vnoise(vec2(p.x / (7.0 + d * 0.3) + uTime * 0.003, p.y * 0.85));
    col += glow * glowK * 0.25 * step(0.8, w) * (1.0 - smoothstep(4.0, 50.0, d));
    float path = smoothstep(4.0 + d * 0.5, 0.0, abs(p.x - moon.x));
    float glint = step(0.8, h12(vec2(floor(p.x / 2.0), p.y) + floor(uTime / 7.0)));
    col += vec3(0.42, 0.45, 0.5) * path * glint * 0.5;
    col += (cloudLit + vec3(0.2)) * flash * 0.3 * (1.0 - smoothstep(0.0, 30.0, d));
  }
  gl_FragColor = vec4(col, 0.0);
}
`;

/**
 * 하늘 셰이더 재질. 하늘은 거의 움직이지 않으므로(겹 속도 0.03, 구름도 아주 천천히 흐른다) 하늘 겹 크기의 그림에
 * 몇 틱마다 한 번만 그려 두고(world.ts), 하늘 판은 그 그림을 쓴다: 화면 전체를 매 프레임 계산하지 않게.
 * 이 재질은 그림 전체를 덮는 사각형(-1~1)에 그린다.
 */
export function skyMaterial(w: number, h: number, horizon: number, moon: { x: number; y: number; r: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      size: { value: new THREE.Vector2(w, h) },
      horizon: { value: horizon },
      moon: { value: new THREE.Vector3(moon.x, moon.y, moon.r) },
      zenith: { value: new THREE.Color() },
      midSky: { value: new THREE.Color() },
      glow: { value: new THREE.Color() },
      glowK: { value: 1 },
      cloud: { value: new THREE.Color() },
      cloudLit: { value: new THREE.Color() },
      cover: { value: 0.6 },
      flash: { value: 0 },
      bolt: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * 먼 번개 (렌더 전용, 틱만 보고 정한다): 몇 초~수십 초마다 한 번, 두세 번 번쩍인다. 첫 번쩍임에는 가끔 줄기가 보인다.
 * often: 구간 분위기의 번개 잦기 (0이면 없음). 반환: flash 0~1, boltX(하늘 겹 x, 줄기가 없으면 -1)
 */
export function lightningAt(tick: number, often: number, skyW: number): { flash: number; boltX: number } {
  if (often <= 0.01) return { flash: 0, boltX: -1 };
  const period = 900;
  const cycle = Math.floor(tick / period);
  const h = (n: number): number => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  // 이번 주기에 번개가 치는지 (잦기만큼), 친다면 언제
  if (h(cycle * 3.1) > often * 0.85) return { flash: 0, boltX: -1 };
  const at = Math.floor(h(cycle * 7.7) * (period - 60));
  const t = (tick % period) - at;
  if (t < 0 || t > 40) return { flash: 0, boltX: -1 };
  const pulse = (start: number, k: number): number => (t >= start && t < start + 6 ? k * (1 - (t - start) / 6) : 0);
  const flash = Math.max(pulse(0, 1), pulse(7, 0.55), pulse(16, 0.8));
  const boltX = h(cycle * 5.3) < 0.6 && t < 5 ? 40 + h(cycle * 9.1) * (skyW - 80) : -1;
  return { flash, boltX };
}
