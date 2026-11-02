import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { SCREEN_W } from '../screen';
import { shared } from './lights';
import { atmos } from './shaders';

/**
 * 하늘과 바다 (렌더 전용, 하늘 겹 판에 그린다). 도트 그림 대신 셰이더로 칸마다 계산한다 (칸 = 화면 1px, 흐림 없음):
 * - 하늘: 꼭대기는 어둡고, 지평선으로 갈수록 도시 불빛이 번져 구간 분위기 색(glow)으로 물든다.
 * - 구름: 낮은 층구름(아랫면이 도시 불빛을 받는다)은 곳에 따라 길게 늘어진 띠가 되었다가 조각조각 끊긴 덩어리가 되고,
 *   높은 곳에는 옅은 새털구름이 달빛을 받는다. 구름은 달보다 가까워 카메라를 따라 달보다 조금 더 움직인다 (겹 사이 깊이).
 * - 달: 하나, 하늘 겹(가장 먼 겹)에 붙어 있다. 구름이 덮으면 원판 전체가 고르게 흐려지고(조각만 남아 떠다니지 않게),
 *   매연·짙은 구름 구간(공장·성벽)에서는 보이지 않는다. 달무리는 그 구간 하늘빛으로 부드럽게 퍼진다 (다른 색 고리가 서지 않게).
 * - 먼 번개 (가끔): 친 자리 둘레 구름 속이 번쩍이고, 때로 갈지자 줄기(가지 하나)가 내리친다. 안개·비·거리도 잠깐 밝아진다.
 * - 바다: 지평선 가까이 하늘 빛이 비치고, 달빛 길과 파도 마루가 달빛·도시 불빛 색으로 반짝인다.
 *   수평선에 먼 화물선이 아주 천천히 지나가고, 하늘에 갈매기 떼.
 * 바닥에는 비치지 않는 판이라 화면 알파는 0.
 */

/** 구름이 달(하늘 겹)보다 더 움직이는 비율: 카메라 1px에 구름 0.025px 더 (겹 속도 0.03 + 0.025) */
const CLOUD_PAR = 0.025;

/** 카메라 가운데 (월드 x, three y). Life.update가 매 프레임 채운다 (setSkyView) */
const skyView = { value: new THREE.Vector2(0, 0) };
/** 마지막으로 하늘을 그릴 때의 구름 밀림 (px) */
let drawnShift = Number.NaN;
/** 먼 번개: x(하늘 겹 px), 씨앗, 친 뒤 틱, 줄기 세기 */
const strike = { value: new THREE.Vector4(0, 0, 0, 0) };

/** 카메라 가운데 월드 x를 하늘에 알려 준다 (구름 겹 사이 깊이·번개 자리). 렌더 전용 */
export function setSkyView(centerX: number, centerY = 0): void {
  skyView.value.set(centerX, centerY);
}

const FRAG = /* glsl */ `
uniform vec2 size;
uniform float horizon;
uniform vec3 moon;
/** 먼 화물선 자리 (하늘 겹 x) */
uniform vec2 ship;
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
uniform vec2 view;
uniform vec4 strike;
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
/** 구름 띠 (꼭대기 0 ~ 지평선 1): 높은 하늘은 옅고 가운데·아래가 짙다 */
float bandAt(float t) {
  return smoothstep(0.02, 0.3, t) * (1.0 - 0.55 * smoothstep(0.75, 1.0, t));
}
/** 구름 모양 값: 곳에 따라 (kind 0) 길게 늘어진 층구름 띠 ~ (kind 1) 조각난 뭉게 덩어리. warp는 같은 칸에서 다시 쓴다 */
float kindAt(float cx) {
  return smoothstep(0.25, 0.75, vnoise(vec2(cx / 340.0, 4.1)));
}
vec2 cloudQ(vec2 cp, float kind) {
  return vec2(cp.x / mix(190.0, 80.0, kind) + uTime * 0.00022, cp.y / mix(30.0, 21.0, kind));
}
float cloudFrom(float n, float t, float kind) {
  float thr = 1.0 - cover - 0.05 + kind * 0.07;
  return smoothstep(thr, thr + 0.3 - kind * 0.12, n) * bandAt(t);
}
/** 갈지자 번개 줄기까지의 거리 (px): (x0, y0)에서 y1까지, 마디 길이와 꺾임이 씨앗마다 다르다 */
float boltDist(vec2 p, float x0, float y0, float y1, float seed, float wiggle) {
  vec2 a = vec2(x0, y0);
  float best = 99.0;
  for (int k = 0; k < 18; k++) {
    float fk = float(k);
    float seg = 4.0 + 8.0 * h12(vec2(seed, fk));
    vec2 b = vec2(a.x + (h12(vec2(fk, seed + 1.7)) - 0.5) * wiggle, min(a.y + seg, y1));
    vec2 pa = p - a;
    vec2 ba = b - a;
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
    best = min(best, length(pa - ba * hh));
    a = b;
    if (a.y >= y1) break;
  }
  return best;
}
vec3 bright1(vec3 c) {
  return c / max(max(c.r, max(c.g, c.b)), 1e-4);
}
void main() {
  vec2 p = floor(vec2(vUv.x, 1.0 - vUv.y) * size) + 0.5;
  // 구름 자리: 구름은 달보다 가까워 카메라를 따라 조금 더 흐른다
  vec2 cp = vec2(p.x + floor(view.x * ${CLOUD_PAR.toFixed(4)}), p.y);
  vec3 col;
  vec3 glowN = bright1(glow);
  vec3 skyN = bright1(mix(midSky, glow, 0.35));
  // 달: 그 구간 하늘빛을 조금 띤 흰빛. 매연·짙은 구름 구간에서는 보이지 않는다
  float vis = 1.0 - smoothstep(0.52, 0.66, cover);
  vec3 moonCol = mix(vec3(0.8, 0.83, 0.88), glowN, 0.1);
  float R = moon.z * 0.7;
  float md = length(p - moon.xy);
  // 먼 번개가 비추는 곳: 친 자리 둘레 (하늘 겹 px)
  float fl = flash * (0.18 + 0.82 * exp(-abs(p.x - strike.x) / 150.0));
  vec3 flashCol = mix(vec3(0.75, 0.8, 1.0), cloudLit * 4.0, 0.25);
  if (p.y < horizon) {
    float t = clamp(p.y / horizon, 0.0, 1.0);
    col = mix(zenith, midSky, smoothstep(0.0, 0.9, t));
    col += glow * glowK * (pow(t, 2.6) * 0.9 + pow(t, 8.0) * 0.8);
    // 달무리: 하늘빛을 그 색 그대로 밝힌다 (다른 색을 얹지 않아 팔레트 고리가 서지 않는다). 두 겹: 좁고 밝은 무리 + 넓은 빛
    float halo = (exp(-max(md - R, 0.0) / (R * 0.9)) * 0.75 + exp(-md / (R * 4.0)) * 0.3) * vis;
    col += skyN * halo * 0.035 + col * halo * 0.8;
    // 낮은 구름
    float kind = kindAt(cp.x);
    vec2 q = cloudQ(cp, kind);
    float warp = vnoise(q * 0.6 + vec2(uTime * 0.00008, 3.1)) * 0.7 + vnoise(q * 1.3 + 9.2) * 0.3;
    vec2 wq = q + vec2(warp * 0.9, warp * 0.3);
    // 달이 보이는 구간에서는 달 둘레 구름이 트여 있다 (구름 사이 빈 하늘에 뜬 달)
    float clear = mix(1.0, smoothstep(R * 1.1, R * 3.6, md), 0.88 * vis);
    float d = cloudFrom(fbm4(wq), t, kind) * clear;
    // 아랫면 가장자리: 아래로 갈수록 옅어지는 곳. 바로 아래 칸과의 차로 칸마다 따로 계산한다
    // (화면 미분 dFdy는 2×2 칸 묶음마다 같은 값이라 테두리가 큰 네모 픽셀이 된다)
    float tb = clamp((p.y + 1.0) / horizon, 0.0, 1.0);
    float dBelow = cloudFrom(fbm4(wq + vec2(0.0, 1.0 / mix(30.0, 21.0, kind))), tb, kind) * mix(1.0, smoothstep(R * 1.1, R * 3.6, length(p + vec2(0.0, 1.0) - moon.xy)), 0.88 * vis);
    float rim = clamp((d - dBelow) * 3.0, 0.0, 1.0);
    vec3 cc = mix(cloud, cloudLit, clamp(smoothstep(0.25, 1.0, t) * 0.85 + rim * 1.6, 0.0, 1.0));
    // 달 가까이 구름의 옅은 가장자리는 달빛을 받아 은빛으로
    cc += moonCol * halo * 0.05 * (1.0 - d * 0.6);
    // 번개: 친 자리 둘레 구름 속이 안에서부터 번쩍인다 (짙은 구름일수록 밝게)
    cc += flashCol * fl * (0.25 + 1.1 * d);
    col = mix(col, cc, d);
    // 높은 새털구름: 옅게, 가로로 길게 (달빛과 번개를 받는다)
    vec2 cq = vec2(cp.x / 240.0 + uTime * 0.0004, p.y / 6.5);
    float ci = smoothstep(0.6, 0.92, vnoise(cq + vec2(vnoise(cq * 0.37 + 2.0) * 1.6, 0.0)));
    ci *= smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.3, 0.55, t)) * (0.35 + 0.5 * cover);
    col = mix(col, cloud * 1.3 + moonCol * halo * 0.08 + flashCol * fl * 0.6, ci * 0.45);
    // 달 원판: 구름이 덮은 만큼 원판 전체가 고르게 흐려진다 (가운데 짙기 위주: 얇은 조각만 남지 않게)
    if (md < R + 1.0 && vis > 0.0) {
      vec2 mq = (p - moon.xy) / R;
      float mr = length(mq);
      if (mr < 1.0) {
        float maria = vnoise(mq * 2.3 + 3.1) * 0.6 + vnoise(mq * 4.9 + 7.7) * 0.4;
        float face = 0.95 - 0.2 * smoothstep(0.5, 0.75, maria) - 0.14 * mr * mr;
        float kc = kindAt(moon.x + floor(view.x * ${CLOUD_PAR.toFixed(4)}));
        vec2 qc = cloudQ(vec2(moon.x + floor(view.x * ${CLOUD_PAR.toFixed(4)}), moon.y), kc);
        float dc = cloudFrom(fbm4(qc + vec2(warp * 0.9, warp * 0.3)), clamp(moon.y / horizon, 0.0, 1.0), kc);
        float veil = clamp(mix(d, dc * clear, 0.75) * 1.3, 0.0, 1.0);
        col = mix(col, moonCol * face, (1.0 - veil) * vis);
      }
    }
    // 갈매기 떼: 바다 쪽 하늘을 천천히 건너는 작은 V 일곱 (어두운 실루엣, 날갯짓에 따라 V가 펴졌다 접힌다)
    if (abs(p.y - horizon * 0.42) < 22.0) {
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 b = vec2(mod(uTime * 0.05 + ship.x + fi * 9.0 + h12(vec2(fi, 3.0)) * 14.0, size.x + 40.0) - 20.0,
                      horizon * 0.42 + fi * 3.0 + sin(uTime * 0.02 + fi) * 2.0 - abs(fi - 3.0) * 2.0);
        vec2 gq = floor(p) - floor(b);
        float flap = step(0.5, fract(uTime * 0.04 + fi * 0.37));
        float on = (gq.y == 0.0 && (gq.x == -1.0 || gq.x == 1.0)) || (gq.y == 1.0 - flap && gq.x == 0.0) || (flap > 0.5 && gq.y == -1.0 && (gq.x == -2.0 || gq.x == 2.0)) ? 1.0 : 0.0;
        col = mix(col, vec3(0.05, 0.055, 0.07) + flashCol * fl * 0.02, on);
      }
    }
    // 번개 줄기: 구름 밑에서 수평선까지 갈지자로, 가지 하나. 1px 심 둘레로 1px 옅은 빛
    if (bolt.y > 0.0 && abs(p.x - bolt.x) < 48.0) {
      float y0 = horizon * (0.18 + 0.2 * h12(vec2(strike.y, 2.0)));
      float bd = boltDist(p, bolt.x, y0, horizon, strike.y, 9.0);
      float by = y0 + (horizon - y0) * (0.25 + 0.3 * h12(vec2(strike.y, 5.0)));
      float bx = bolt.x + (h12(vec2(strike.y, 6.0)) - 0.5) * 10.0;
      float bd2 = boltDist(p, bx, by, by + (horizon - by) * 0.55, strike.y + 3.3, 14.0);
      float core = max(step(bd, 0.55), step(bd2, 0.55) * 0.6);
      float aura = max(step(bd, 1.6), step(bd2, 1.6) * 0.5) * (1.0 - core);
      col += vec3(0.85, 0.9, 1.0) * core * bolt.y * 2.4 + flashCol * aura * bolt.y * 0.25;
    }
  } else {
    float dd = p.y - horizon;
    col = mix(midSky * 0.8 + glow * glowK * 0.45, zenith * 0.4, smoothstep(0.0, 26.0, dd));
    float w = vnoise(vec2(p.x / (7.0 + dd * 0.3) + uTime * 0.003, p.y * 0.85));
    col += glow * glowK * 0.25 * step(0.8, w) * (1.0 - smoothstep(4.0, 50.0, dd));
    // 달빛 길: 달 아래로 좁게 늘어선 반짝임 (앞으로 올수록 조금만 넓어진다), 달빛 색으로
    float path = (1.0 - smoothstep(0.0, 3.0 + dd * 0.14, abs(p.x - moon.x))) * vis;
    float glint = step(0.86, h12(vec2(floor(p.x / 2.0), p.y) + floor(uTime / 7.0)));
    col += moonCol * path * glint * 0.42;
    // 파도 반짝임: 물결 마루에 걸린 짧은 가로 반짝임 (달빛 길 밖에도 드문드문, 앞으로 올수록 길게). 몇 초마다 자리를 바꾼다.
    // 달빛 길 안은 달빛 색, 밖은 지평선 도시 불빛 색
    float seg = 3.0 + dd * 0.18;
    vec2 cellW = vec2(floor(p.x / seg), floor(p.y / 2.0));
    float wave = step(0.955, h12(cellW + floor(uTime / 13.0 + h12(cellW.yx) * 5.0))) * step(0.5, fract(p.y / 2.0));
    vec3 waveCol = mix(glowN * (0.12 + 0.25 * glowK), moonCol * 0.33, path);
    col += waveCol * wave * (0.3 + 0.7 * path) * (1.0 - 0.6 * smoothstep(20.0, 90.0, dd));
    // 번개: 바다가 그 빛을 비춘다 (수평선 가까이, 친 자리 아래가 밝게)
    col += flashCol * fl * 0.22 * (1.0 - smoothstep(0.0, 30.0, dd)) * (0.6 + 0.8 * w);
  }
  // 먼 화물선: 수평선에 걸린 어두운 선체(지평선 빛에 실루엣)와 선실, 불 켜진 둥근 창 줄 (빈 바다에 사는 흔적).
  // 아주 천천히 옆으로 지나간다 (한 판에 몇 px)
  float sxp = mod(ship.x + uTime * 0.004 + 60.0, size.x + 120.0) - 60.0;
  float sx = p.x - floor(sxp);
  float dd2 = p.y - horizon;
  if (dd2 >= -3.0 && dd2 < 1.0 && abs(sx) < 22.0 - max(0.0, dd2 + 1.0) * 2.0) {
    col = vec3(0.02, 0.024, 0.032);
    if (dd2 >= -2.0 && dd2 < -1.0 && abs(sx) < 18.0 && mod(floor(sx + 22.0), 4.0) < 1.0) col = vec3(1.0, 0.8, 0.5);
  }
  if (sx > 3.0 && sx < 13.0 && dd2 >= -8.0 && dd2 < -3.0) {
    col = vec3(0.025, 0.03, 0.04);
    if (dd2 >= -6.0 && dd2 < -5.0 && mod(floor(sx), 3.0) < 1.0) col = vec3(1.0, 0.82, 0.55);
  }
  if (abs(sx - 8.0) < 0.5 && dd2 >= -12.0 && dd2 < -8.0) col = vec3(0.03, 0.03, 0.04);
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
      // 먼 화물선: 달 오른쪽 바다 (해안 부두에서 보이는 자리)
      ship: { value: new THREE.Vector2(moon.x + 80, 0) },
      zenith: { value: new THREE.Color() },
      midSky: { value: new THREE.Color() },
      glow: { value: new THREE.Color() },
      glowK: { value: 1 },
      cloud: { value: new THREE.Color() },
      cloudLit: { value: new THREE.Color() },
      cover: { value: 0.6 },
      flash: { value: 0 },
      bolt: { value: new THREE.Vector2(0, 0) },
      view: skyView,
      strike,
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
 * 먼 번개 (렌더 전용, 틱만 보고 정한다): 몇 초~수십 초마다 한 번, 두세 번 번쩍인다 (첫 번쩍임이 가장 세고, 사이에 깜빡임).
 * 첫 번쩍임에는 가끔 줄기가 보인다. 번쩍임은 친 자리(지금 보이는 하늘 안) 둘레 구름을 밝히고, 안개·비·빛줄기도 그 빛을 받는다 (atmos.uFlash).
 * often: 구간 분위기의 번개 잦기 (0이면 없음). 반환: flash 0~1, boltX(하늘 겹 x, 줄기가 없으면 -1).
 * 카메라가 움직여 구름 자리가 1px 넘게 바뀌면 아주 작은 flash를 돌려 하늘을 다시 그리게 한다 (보이지 않는 값).
 */
export function lightningAt(tick: number, often: number, skyW: number): { flash: number; boltX: number } {
  const shift = Math.floor(skyView.value.x * CLOUD_PAR);
  const redraw = shift !== drawnShift ? 1e-4 : 0;
  drawnShift = shift;
  const none = (): { flash: number; boltX: number } => {
    atmos.uFlash.value = 0;
    strike.value.w = 0;
    return { flash: redraw, boltX: -1 };
  };
  if (often <= 0.01) return none();
  const period = 900;
  const cycle = Math.floor(tick / period);
  const h = (n: number): number => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  // 이번 주기에 번개가 치는지 (잦기만큼), 친다면 언제
  if (h(cycle * 3.1) > often * 0.85) return none();
  const at = Math.floor(h(cycle * 7.7) * (period - 60));
  const t = (tick % period) - at;
  if (t < 0 || t > 44) return none();
  // 번쩍임: 확 켜졌다가 빨리 사그라든다. 첫 번은 짧게 두 번 깜빡이고, 잠시 뒤 약하게, 다시 세게
  const pulse = (start: number, k: number, len: number): number => (t >= start && t < start + len ? k * Math.pow(1 - (t - start) / len, 1.6) : 0);
  const flash = Math.max(pulse(0, 1, 4), pulse(5, 0.85, 7), pulse(16, 0.45, 6), pulse(27, 0.7, 9));
  // 친 자리: 지금 보이는 하늘 안 (화면 가운데 둘레)
  const s = D.sky.speed;
  const center = skyView.value.x * s + (SCREEN_W / 2) * (1 - s);
  const x = Math.max(30, Math.min(skyW - 30, center + (h(cycle * 9.1) - 0.5) * 360));
  const boltX = h(cycle * 5.3) < 0.65 && (t < 3 || (t >= 5 && t < 8)) ? x : -1;
  strike.value.set(x, (cycle % 97) + 1, t, boltX >= 0 ? 1 : 0);
  atmos.uFlash.value = flash;
  return { flash: Math.max(flash, redraw), boltX };
}
