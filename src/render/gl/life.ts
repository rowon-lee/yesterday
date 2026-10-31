import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { BIG, BREAK_RULES, GROUND, tramAt } from '../../stage/citadel';
import type { PropState } from '../../sim';
import { drawText } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, hash, line, rect } from '../dither';
import { farChimneys, farLight, keepBeacons, keepLights, midGround, midSeaX } from './backdrops';
import { depthOfSpeed } from './core';
import { Beam, Sparks, upload } from './fx';
import { plane } from './kit';
import { lightPool, shared } from './lights';
import { litMaterial, pixelTexture } from './shaders';

/**
 * 움직이는 도시 (모두 렌더 전용, sim과 무관): 노면전차, 멀리 도망치는 행인, 분수 물줄기, 먼 공장 매연, 바다 위 먼 등대 불빛,
 * 시타델 탑 왕관 서치라이트와 경고등. 틱만 보고 그려서 같은 틱이면 늘 같은 그림이다 (행인만 카메라와 싸움 자리를 본다).
 * 먼 겹(하늘·먼 마천루·시타델 탑·중간 건물)에 붙는 것은 그 겹의 판과 같은 깊이·배율에 놓아 겹과 함께 움직인다.
 */

/** 겹 좌표 (겹 속도 s) → 월드 (x, 바닥 위 y). backdrop 판과 같은 자리 맞춤 */
function layerToWorld(s: number, lx: number, ly: number): [number, number] {
  const x0 = (-(SCREEN_W / 2) * (1 - s)) / s;
  const y0 = (-(SCREEN_H / 2) * (1 - s)) / s;
  return [x0 + lx / s, GROUND - (y0 + ly / s)];
}

/** 먼 겹 판과 같은 색 처리 (어둡게 누르고 안개에 묻는다) + 디더링으로 옅어지는 판 여러 개 */
class FarSprites {
  readonly mesh: THREE.InstancedMesh;
  private readonly fade: THREE.InstancedBufferAttribute;
  private readonly cell: THREE.InstancedBufferAttribute;
  private n = 0;
  private readonly m4 = new THREE.Matrix4();

  constructor(private readonly max: number, atlas: HTMLCanvasElement, cells: number, tint: number, fog: number, emissive = 0) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: pixelTexture(atlas) }, cells: { value: cells }, tint: { value: tint }, fogAmount: { value: fog }, uFogColor: shared.uFogColor, emissive: { value: emissive } },
      vertexShader: /* glsl */ `
        attribute float fade;
        attribute float cell;
        uniform float cells;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vUv = vec2((uv.x + cell) / cells, uv.y);
          vFade = fade;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float tint;
        uniform float fogAmount;
        uniform vec3 uFogColor;
        uniform float emissive;
        varying vec2 vUv;
        varying float vFade;
        float m2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
        float bayer(vec2 p) { vec2 q = mod(floor(p), 4.0); return 4.0 * m2(mod(q, 2.0)) + m2(floor(q * 0.5)); }
        void main() {
          vec4 t = texture2D(map, vUv);
          if (t.a < 0.5 || bayer(gl_FragCoord.xy) >= vFade * 16.0) discard;
          vec3 c = emissive > 0.0 ? t.rgb * emissive : mix(t.rgb * tint, uFogColor, fogAmount);
          gl_FragColor = vec4(c, 0.0);
        }
      `,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.cell = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('fade', this.fade);
    geo.setAttribute('cell', this.cell);
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  /** 아래 가운데 (월드 x, 바닥 위 y), 깊이, 폭·높이, 칸 번호, 농도 0~1 */
  add(x: number, y: number, z: number, w: number, h: number, cell: number, fade: number): void {
    if (this.n >= this.max || fade <= 0.02) return;
    this.m4.makeScale(w, h, 1);
    this.m4.setPosition(x, y, z);
    this.mesh.setMatrixAt(this.n, this.m4);
    this.fade.setX(this.n, fade);
    this.cell.setX(this.n, cell);
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    if (!this.n) return;
    upload(this.mesh.instanceMatrix, this.n * 16);
    upload(this.fade, this.n);
    upload(this.cell, this.n);
  }
}

// ---------------------------------------------------------------- 노면전차
/** 이 틱의 전차 위치 (차체 왼쪽 끝, 월드 x)와 방향. 지나가는 중이 아니면 null */
/**
 * 1960년대 유선형 노면전차 옆모습 (기준: 차체 왼쪽 끝, 바닥): 둥근 앞뒤, 크림색 위·녹색 아래, 크롬 허리띠, 이어진 띠 창(불 켜진 실내와 승객),
 * 가운데 전조등과 행선 표지, 가공선에 닿은 트롤리 막대. glow: 창·전조등·꼬리등.
 */
export function paintTram(dir: number): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const T = D.tram;
  const L = T.length;
  const H = T.wire + 4;
  const [map, g] = canvas(L, H);
  const [glow, e] = canvas(L, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, L, H);
  const G = H;
  const front = dir > 0 ? L : 0;
  const inset = (y: number) => {
    const t = Math.abs(y - (G - 32)) / 24;
    return Math.round(Math.max(0, t * t * 10));
  };
  for (let y = G - 56; y < G - 10; y++) {
    const k = inset(y);
    rect(g, k, y, L - k * 2, 1, y < G - 30 ? C.carCream : C.carMint);
  }
  rect(g, 4, G - 31, L - 8, 2, C.chrome);
  rect(g, 10, G - 12, L - 20, 2, C.iron);
  rect(g, 30, G - 59, L - 60, 3, C.chromeDark);
  for (let wx = 14, k = 0; wx + 10 < L - 14; wx += 13, k++) {
    rect(g, wx, G - 46, 11, 13, C.windowLit);
    rect(e, wx, G - 46, 11, 13, C.windowLit);
    rect(g, wx, G - 46, 11, 2, C.windowLight);
    rect(e, wx, G - 46, 11, 2, C.windowLight);
    if (hash(k * 31 + 7) < 0.6) {
      const px = wx + 3 + Math.floor(hash(k * 17) * 5);
      disc(g, px, G - 40, 2, C.iron);
      disc(e, px, G - 40, 2, '#000');
      rect(g, px - 2, G - 38, 5, 5, C.iron);
      rect(e, px - 2, G - 38, 5, 5, '#000');
    }
    rect(g, wx + 11, G - 47, 2, 15, C.carCream);
    rect(g, wx, G - 50, 11, 2, C.windowDark);
  }
  for (const bx of [22, L - 46]) {
    rect(g, bx - 2, G - 11, 28, 3, C.iron);
    for (const wx of [bx + 4, bx + 20]) {
      disc(g, wx, G - 5, 5, C.iron);
      disc(g, wx, G - 5, 2, C.chromeDark);
    }
  }
  const fx = dir > 0 ? front - 12 : front + 2;
  rect(g, fx, G - 50, 10, 16, C.windowDark);
  rect(g, dir > 0 ? front - 9 : front + 3, G - 55, 6, 4, C.windowDark);
  drawText(g, '7', dir > 0 ? front - 8 : front + 4, G - 55, C.lampGlow, 1);
  drawText(e, '7', dir > 0 ? front - 8 : front + 4, G - 55, C.lampGlow, 1);
  const hx = dir > 0 ? front - 3 : front + 1;
  rect(g, hx, G - 24, 3, 4, C.lampCore);
  rect(e, hx, G - 24, 3, 4, C.lampCore);
  rect(g, dir > 0 ? 2 : L - 4, G - 22, 2, 3, C.neonRed);
  rect(e, dir > 0 ? 2 : L - 4, G - 22, 2, 3, C.neonRed);
  drawText(g, 'CITADEL LINE', Math.floor(L / 2) - 23, G - 27, C.carCream, 1);
  // 트롤리 막대: 뒤쪽 지붕에서 가공선까지 비스듬히
  const baseX = dir > 0 ? 34 : L - 34;
  const tipX = baseX - dir * 34;
  line(g, baseX, G - 59, tipX, G - T.wire + 2, C.iron);
  line(g, baseX + 1, G - 59, tipX + 1, G - T.wire + 2, C.ironLight);
  rect(g, tipX - 1, G - T.wire, 3, 3, C.ironLight);
  return { map, glow };
}

// ---------------------------------------------------------------- 도망치는 행인 (가운데 겹)
interface Walker {
  x: number;
  dir: number;
  speed: number;
  phase: number;
  age: number;
}

/** 행인 자세 칸: 휘두름 -5~5 × 기울기 -2·0·2 (칸 폭 20, 높이 30, 발밑 (10, 27)) */
const SWINGS = 11;
function walkerAtlas(): HTMLCanvasElement {
  const [c, g] = canvas(20 * SWINGS * 3, 30);
  for (let li = 0; li < 3; li++) {
    for (let si = 0; si < SWINGS; si++) {
      const swing = si - 5;
      const lean = (li - 1) * 2;
      const x = (li * SWINGS + si) * 20 + 10;
      const foot = 27;
      const hip = foot - 11;
      const neck = foot - 20;
      const col = C.night;
      line(g, x, hip, x - swing, foot, col);
      line(g, x, hip, x + swing, foot, col);
      line(g, x, hip, x + lean, neck, col);
      line(g, x + 1, hip, x + lean + 1, neck, col);
      line(g, x + lean, neck + 1, x + lean + swing, neck + 8, col);
      line(g, x + lean, neck + 1, x + lean - swing, neck + 8, col);
      disc(g, x + lean, neck - 2, 2, col);
      rect(g, x + lean - 2, neck - 5, 5, 1, col);
      rect(g, x + lean - 1, neck - 6, 3, 1, col);
    }
  }
  return c;
}

/**
 * 멀리 반 크기 실루엣 행인. 가운데 겹의 바닥을 걷다가, 싸움이 있으면 싸움 반대쪽으로 뛰어 도망간다.
 * 앞쪽 건물에 가려 광장·골목처럼 트인 곳에서만 보인다.
 */
class Walkers {
  private list: Walker[] = [];
  private last = -1;
  private seed = 1;

  step(tick: number, camX: number, focusX: number | null): void {
    if (tick === this.last) return;
    const steps = this.last < 0 || tick < this.last ? 300 : Math.min(600, tick - this.last);
    this.last = tick;
    const s = D.mid.speed;
    const view0 = camX * s - 80;
    const view1 = camX * s + SCREEN_W + 80;
    const focus = focusX === null ? null : focusX - camX + camX * s;
    for (let n = 0; n < steps; n++) {
      const x = view0 + hash(this.seed * 131 + 1) * (view1 - view0);
      if (this.list.length < 18 && x > midSeaX() + 4 && hash(this.seed * 7919) < (focus === null ? 0.05 : 0.12)) {
        const dir = focus === null ? (hash(this.seed * 17) < 0.5 ? -1 : 1) : x < focus ? -1 : 1;
        this.list.push({ x, dir, speed: focus === null ? 0.25 + hash(this.seed * 3) * 0.2 : 0.9 + hash(this.seed * 5) * 0.8, phase: hash(this.seed * 11) * 8, age: 0 });
      }
      this.seed++;
      for (const w of this.list) {
        w.x += w.dir * w.speed;
        w.phase += w.speed * 0.35;
        w.age++;
      }
    }
    this.list = this.list.filter((w) => w.age < 900 && w.x > Math.max(view0 - 120, midSeaX()) && w.x < view1 + 120);
  }

  draw(out: FarSprites): void {
    const s = D.mid.speed;
    const z = depthOfSpeed(s) + 2;
    for (const w of this.list) {
      const swing = Math.round(Math.sin(w.phase) * (w.speed > 0.6 ? 5 : 3));
      const lean = w.speed > 0.6 ? w.dir * 2 : 0;
      const [x, y] = layerToWorld(s, Math.round(w.x), midGround() + 2 + 3);
      out.add(x, y, z, 20 / s, 30 / s, (lean / 2 + 1) * SWINGS + swing + 5, 1);
    }
  }
}

export class Life {
  readonly group = new THREE.Group();
  private readonly tram: THREE.Mesh;
  private readonly tramMats: THREE.ShaderMaterial[];
  private readonly headBeam = new Beam(150, 18, C.lampGlow, 0.3, 2);
  private readonly sparks = new Sparks(160);
  private readonly walkers = new Walkers();
  private readonly walkerSprites: FarSprites;
  private readonly smoke: FarSprites;
  private readonly crown: Beam[] = [];
  private readonly beacons: FarSprites;

  constructor() {
    const T = D.tram;
    this.tramMats = [1, -1].map((dir) => {
      const t = paintTram(dir);
      return litMaterial(pixelTexture(t.map), { emissive: pixelTexture(t.glow), emissiveStrength: 1, clip: [T.x0, T.x1], side: THREE.DoubleSide });
    });
    this.tram = plane(0, T.length, 0, T.wire + 4, -4, this.tramMats[0]);
    this.tram.visible = false;
    this.headBeam.mesh.visible = false;
    this.group.add(this.tram, this.headBeam.pivot, this.sparks.mesh);
    // 행인 (가운데 겹)
    this.walkerSprites = new FarSprites(24, walkerAtlas(), SWINGS * 3, 0.32, 0.3);
    // 공장 매연 (먼 겹): 디더링 원 하나를 크게 늘려 쓴다
    const [sc, sg] = canvas(32, 32);
    disc(sg, 16, 16, 15, C.smoke);
    this.smoke = new FarSprites(48, sc, 1, 0.4, 0.45);
    // 시타델 탑 경고등과 먼 등대 불빛 (빛나는 점)
    const [bc, bg] = canvas(16, 8);
    rect(bg, 2, 2, 4, 4, C.neonRed);
    rect(bg, 0, 3, 8, 2, C.neonRed);
    disc(bg, 12, 4, 3, C.lampWarm);
    disc(bg, 12, 4, 1, C.lampCore);
    this.beacons = new FarSprites(8, bc, 2, 1, 0, 1.6);
    this.group.add(this.walkerSprites.mesh, this.smoke.mesh, this.beacons.mesh);
    // 시타델 탑 왕관 서치라이트 (먼 겹 깊이에 겹 배율만큼 크게)
    const ks = D.keep.speed;
    for (const l of keepLights()) {
      const [x, y] = layerToWorld(ks, l.x, l.y);
      const b = new Beam(380 / ks, (380 * 0.1) / ks, C.beam, 0.12, 0.5);
      b.pivot.position.set(x, y, depthOfSpeed(ks) + 10);
      this.group.add(b.pivot);
      this.crown.push(b);
    }
  }

  /**
   * camX: 화면 왼쪽 끝 월드 x, focusX: 싸움이 벌어지는 월드 x (없으면 행인이 그냥 걷는다).
   * clock: 도시 시계 (노면전차가 이 시계로 다닌다). props: 부서지는 물건 상태 (무너진 전차는 더 다니지 않고, 간판이 떨어지면 분수가 부서진다)
   */
  update(tick: number, camX: number, focusX: number | null, clock = tick, props: readonly PropState[] | null = null): void {
    this.sparks.begin();
    const tram = props?.[BIG.tram];
    this.updateTram(tick, tram && tram.stage === 2 ? null : tramAt(clock), tram?.stage === 1);
    const sign = props?.[BIG.bigsign];
    const crushed = sign && sign.stage === 2 && tick - sign.brokenAt >= BREAK_RULES.settle ? tick - sign.brokenAt - BREAK_RULES.settle : -1;
    if (crushed < 0) this.fountain(tick);
    else this.brokenFountain(tick, crushed);
    this.sparks.end();
    this.walkers.step(tick, camX, focusX);
    this.walkerSprites.begin();
    this.walkers.draw(this.walkerSprites);
    this.walkerSprites.end();
    this.farSmoke(tick);
    // 왕관 서치라이트: 먼 하늘을 천천히 쓴다. 경고등: 천천히 깜빡인다. 먼 등대: 몇 초마다 두 번 깜빡인다
    this.crown.forEach((b, i) => b.aim(-0.9 * Math.sin(tick * 0.009 + i * 2.4)));
    this.beacons.begin();
    if (tick % 90 < 45) {
      const ks = D.keep.speed;
      for (const p of keepBeacons()) {
        const [x, y] = layerToWorld(ks, p.x, p.y);
        this.beacons.add(x, y - 4 / ks, depthOfSpeed(ks) + 12, 8 / ks, 8 / ks, 0, 1);
      }
    }
    const t = tick % D.sky.farLight.every;
    if (!(t > 16 && (t < 24 || t > 30) && t < 38)) {
      const s = D.sky.speed;
      const p = farLight();
      const [x, y] = layerToWorld(s, p.x, p.y);
      this.beacons.add(x, y - 4 / s, depthOfSpeed(s) + 100, 8 / s, 8 / s, 1, 1);
    }
    this.beacons.end();
  }

  /** 다니는 노면전차 (at: 지금 자리, 없으면 숨김). dented: 망가짐 (실내등이 깜빡이고 불꽃이 자주 튄다) */
  private updateTram(tick: number, at: { x: number; dir: number } | null, dented: boolean): void {
    const T = D.tram;
    this.tram.visible = !!at;
    this.headBeam.mesh.visible = !!at;
    if (!at) return;
    const x = Math.round(at.x);
    this.tram.material = this.tramMats[at.dir > 0 ? 0 : 1];
    this.tram.position.set(x + T.length / 2, (T.wire + 4) / 2, -4);
    const front = at.dir > 0 ? x + T.length : x;
    const hx = at.dir > 0 ? front - 2 : front + 2;
    const inLine = (px: number) => px >= T.x0 && px <= T.x1;
    const lit = !dented || hash(Math.floor(tick / 3) * 31) > 0.35;
    (this.tram.material as THREE.ShaderMaterial).uniforms.emissiveStrength.value = lit ? 1 : 0.15;
    if (inLine(x + T.length / 2) && lit) lightPool.add(x + T.length / 2, 40, 0, T.length * 0.6, C.windowLight, 0.5);
    this.headBeam.pivot.position.set(hx, 22, -2);
    this.headBeam.aim(at.dir > 0 ? -Math.PI / 2 - 0.08 : Math.PI / 2 + 0.08);
    this.headBeam.mesh.visible = inLine(hx);
    if (inLine(hx)) lightPool.add(hx + at.dir * 30, 22, 4, 90, C.lampGlow, 1.1);
    // 가공선 불꽃 (가끔): 순간 파랗게 번쩍인다
    const tipX = (at.dir > 0 ? x + 34 : x + T.length - 34) - at.dir * 34;
    if (inLine(tipX) && hash(Math.floor(tick / 3) * 7919) < (dented ? 0.6 : 0.25)) {
      for (let i = 0; i < 6; i++) {
        const r = hash(tick * 13 + i * 101);
        this.sparks.add(tipX + (r - 0.5) * 10, T.wire - 1 + hash(tick * 7 + i) * 6 - 2, -2.5, i % 2 ? C.fxYellow : C.fxWhite, 2);
      }
      lightPool.add(tipX, T.wire, 6, 70, C.skyLight, 1.2);
    }
  }

  /**
   * 광장 분수 물줄기: 가운데 그릇에서 솟는 물기둥(높이가 천천히 오르내림)과 양옆으로 휘어 떨어지는 물줄기, 수반에 떨어지는 물보라.
   */
  private fountain(tick: number): void {
    const F = D.plaza.fountain;
    const z = -50;
    const base = 50;
    const height = 46 + Math.round(Math.sin(tick * 0.03) * 14);
    for (let i = 0; i < 26; i++) {
      const t = ((tick * 0.9 + i * 7) % 40) / 40;
      const y = base + Math.round(height * Math.sin(Math.PI * t));
      const x = F.x + Math.round((hash(i * 17 + Math.floor(tick / 3)) - 0.5) * 4 * t);
      this.sparks.add(x - 1, y - 2, z, i % 3 ? C.skyLight : C.white, 0.55, 2, 2);
    }
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 18; i++) {
        const t = ((tick * 1.1 + i * 5 + (dir > 0 ? 9 : 0)) % 36) / 36;
        const x = F.x + dir * Math.round(8 + t * 44);
        const y = base + Math.round(28 * Math.sin(Math.PI * Math.min(1, t * 0.9))) - Math.round(t * 36);
        if (y > 16) this.sparks.add(x, y - 2, z + 4, i % 2 ? C.skyLight : C.sky, 0.5, 1, 2);
      }
    }
    for (let i = 0; i < 12; i++) {
      const r = hash(i * 31 + Math.floor(tick / 4) * 7);
      const x = F.x - F.w / 2 + 6 + Math.round(r * (F.w - 12));
      if (((x + tick) & 3) < 2) this.sparks.add(x, 18 + Math.round(hash(i + tick) * 3), z + 22, C.white, 0.6);
    }
  }

  /**
   * 간판에 깔려 부서진 분수 (t: 깔린 뒤 틱): 터진 관에서 물이 간판 뒤로 높이 치솟았다가 (처음 2초) 낮은 물보라로 남는다.
   */
  private brokenFountain(tick: number, t: number): void {
    const F = D.plaza.fountain;
    const z = -56;
    const burst = Math.max(0, 1 - t / 120);
    const height = Math.round(30 + 70 * burst + Math.sin(tick * 0.2) * 4);
    const n = 14 + Math.round(20 * burst);
    for (let i = 0; i < n; i++) {
      const u = ((tick * 1.3 + i * 11) % 34) / 34;
      const lean = (hash(i * 7) - 0.5) * (10 + 30 * burst);
      const y = 20 + Math.round(height * Math.sin(Math.PI * u));
      const x = F.x + 6 + Math.round(lean * u);
      if (y > 20) this.sparks.add(x, y, z, i % 3 ? C.skyLight : C.white, 0.6, 1, 2);
    }
    // 수반 밖으로 넘친 물이 바닥에 튄다
    for (let i = 0; i < 10; i++) {
      const r = hash(i * 23 + Math.floor(tick / 3) * 5);
      const x = F.x - F.w / 2 + Math.round(r * F.w);
      if (((x + tick) & 3) < 2) this.sparks.add(x, Math.round(hash(i + tick) * 4), -12, C.skyLight, 0.55);
    }
  }

  /** 공장 굴뚝 매연 (먼 겹): 뭉게뭉게 솟아 바람에 흘러간다 */
  private farSmoke(tick: number): void {
    const s = D.far.speed;
    const z = depthOfSpeed(s) + 40;
    this.smoke.begin();
    farChimneys().forEach((ch, ci) => {
      const life = 260;
      for (let p = 0; p < 9; p++) {
        const age = (tick * 0.5 + p * (life / 9) + ci * 37) % life;
        const k = age / life;
        const lx = ch.x + ch.w / 2 + age * 0.35 + Math.sin((age + ci * 20) * 0.05) * 4;
        const ly = ch.top - 3 - age * 0.45;
        const r = 6 + k * 20;
        const [x, y] = layerToWorld(s, lx, ly + r);
        this.smoke.add(x, y, z + p * 0.5, (r * 2) / s, (r * 2) / s, 0, Math.max(0.15, 0.65 * (1 - k)));
      }
    });
    this.smoke.end();
  }
}
