import * as THREE from 'three';
import type { CitadelState, CityState, PropState } from '../../sim';
import { GROUND, MAP_W } from '../../stage/citadel';
import { lights as lights2d, quality } from '../light';
import { SCREEN_W } from '../screen';
import { buildFar, buildKeep, buildKeepTower, buildMid, horizonY, layerH, layerW, type Layer } from './backdrops';
import { BigProps } from './bigprops';
import { Buildings } from './buildings';
import { depthOfSpeed } from './core';
import { Edges } from './edges';
import { Life } from './life';
import { Outskirts } from './outskirts';
import { lightPool, shared } from './lights';
import { moodAt } from './mood';
import { lightningAt, skyMaterial } from './sky';
import { Plaza } from './plaza';
import { Props } from './props';
import { Rain } from './rain';
import { backdropMaterial, hazeMaterial, pixelTexture, setDetail } from './shaders';
import { Steam } from './steam';
import { buildStreet, foreground } from './street';
import { paintNoise } from './tex';
import type { GlView } from './view';
import { SCREEN_H } from '../screen';
import { CITADEL as D } from '../../data/stages/citadel';

/**
 * 2.5D 무대 전체 (렌더 전용): 먼 겹 판(하늘·먼 마천루·시타델 탑·중간 건물), 겹 사이 안개, 구간마다 다른 젖은 바닥,
 * 길가의 부서지는 건물(극장·다이너 거리, 비상계단 아파트), 시타델 광장과 본관, 부두와 공원, 부서지는 물건, 움직이는 도시, 비와 증기.
 * 매 프레임 sim 상태(부서진 건물 덩어리·물건)를 보고 모습과 빛을 바꾼다. sim에는 아무것도 쓰지 않는다.
 */
export class World {
  readonly group = new THREE.Group();
  private readonly buildings = new Buildings();
  private readonly props = new Props();
  private readonly big = new BigProps();
  private readonly plaza = new Plaza();
  private readonly edges = new Edges();
  /** 맵을 넓히며 붙인 네 구간 (공장 지대·항만 창고 부두·고가 철도 밑·성벽 검문소) */
  private readonly outskirts = new Outskirts();
  private readonly life = new Life();
  private readonly rain = new Rain();
  private readonly steam = new Steam();
  /** 앞겹 (카메라 앞을 스치는 기둥·전선·깃발). 확인용으로 끌 수 있다 */
  readonly foreground = foreground();
  /** 움직이지 않는 무대 (먼 겹 판·안개 판·길·건물·앞겹) */
  private readonly statics: THREE.Object3D[] = [];
  /** 하늘과 바다 (셰이더로 그린다: 구름·달·번개·바다). 하늘 겹 크기 그림에 몇 틱마다 그려 두고 하늘 판이 그 그림을 쓴다 */
  private readonly sky: THREE.ShaderMaterial;
  private readonly skyW: number;
  private readonly skyH: number;
  private readonly skyPlaneMat: THREE.ShaderMaterial;
  private readonly skyScene = new THREE.Scene();
  private readonly skyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private skyRT: THREE.WebGLRenderTarget | null = null;
  private skyAt = -1e9;
  private skyFlash = 0;
  /** 겹 사이 안개 판 (구간 분위기로 짙기를 바꾼다)와 처음 짙기 */
  private readonly hazes: Array<[THREE.ShaderMaterial, number]> = [];

  constructor() {
    // 하늘: 하늘 겹 크기의 판을 셰이더로 칠한다
    const ss = D.sky.speed;
    this.skyW = layerW(ss);
    this.skyH = layerH(ss);
    this.sky = skyMaterial(this.skyW, this.skyH, horizonY(), { x: D.sky.moon.x, y: D.sky.moon.fromTop, r: D.sky.moon.r });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.sky);
    quad.frustumCulled = false;
    this.skyScene.add(quad);
    this.skyPlaneMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;
        void main() { gl_FragColor = vec4(texture2D(map, vUv).rgb, 0.0); }
      `,
      depthWrite: false,
    });
    this.statics.push(layerPlane(ss, this.skyW, this.skyH, this.skyPlaneMat));
    for (const [layer, tint, fog, glow] of [
      [buildFar(), 0.45, 0.5, 0.6],
      [buildKeep(), 0.5, 0.45, 0.55],
      [buildMid(), 0.36, 0.34, 0.35],
    ] as const) this.statics.push(backdrop(layer, tint, fog, glow));
    // 겹 사이 안개: 중간 건물과 시타델 탑 사이, 싸우는 줄과 중간 건물 사이, 길 위 바닥 안개
    const noise = pixelTexture(paintNoise(128, 7, 4, 3));
    noise.wrapS = THREE.RepeatWrapping;
    noise.wrapT = THREE.RepeatWrapping;
    noise.magFilter = THREE.LinearFilter;
    noise.minFilter = THREE.LinearFilter;
    for (const [z, h, color, strength] of [
      // 먼 겹 앞 안개: 화면 높이 안에서 위로 옅어지게 낮게 깐다 (먼 마천루 윗부분이 밝은 안개에 묻혀 회색 기둥처럼 뜨지 않게)
      [-4200, 340, '#26304a', 0.55],
      [-900, 260, '#232c44', 0.42],
      [60, 34, '#2a3550', 0.32],
    ] as const) {
      const k = (3000 - z) / 3000;
      const mat = hazeMaterial(noise, color, strength, k, z > -2000);
      this.hazes.push([mat, strength]);
      // 캐릭터(깊이를 쓰지 않음)보다 뒤 안개는 캐릭터보다 먼저, 앞 안개는 나중에 그린다
      mat.transparent = false;
      const m = new THREE.Mesh(new THREE.PlaneGeometry((MAP_W + 6000) * k, h * k), mat);
      m.renderOrder = z < 0 ? 1 : 21;
      m.position.set(MAP_W / 2, (h * k) / 2 - 4 * k, z);
      this.statics.push(m);
    }
    this.statics.push(buildStreet(), this.buildings.group, this.foreground);
    // 시타델 탑 윗부분: 둘레 사무동 겹 바로 앞. 시타델이 무너지면 내려앉으므로 움직이지 않는 무대에서 뺀다
    const tower = backdrop(buildKeepTower(), 0.5, 0.45, 0.55);
    tower.position.z += 1;
    this.plaza.attachTower(tower);
    this.group.add(...this.statics, tower, this.plaza.group, this.edges.group, this.outskirts.group, this.props.group, this.big.group, this.life.group, this.rain.group, this.steam.group);
    // 움직이지 않는 무대는 자리 행렬을 한 번만 계산한다 (매 프레임 수백 개를 다시 계산하지 않게)
    for (const o of this.statics) {
      o.updateMatrixWorld(true);
      o.traverse((c) => {
        c.matrixAutoUpdate = false;
      });
      o.matrixWorldAutoUpdate = false;
    }
  }

  /**
   * 이번 틱의 모습과 빛 후보. props·city는 sim 상태 (없으면 모두 멀쩡).
   * focusX: 싸움이 벌어지는 월드 x (멀리 행인이 그 반대쪽으로 도망간다). 없으면 행인이 그냥 걷는다.
   * clock: sim의 도시 시계 (노면전차가 이 시계로 다닌다. 없으면 tick). citadel: 시타델 본관 상태 (없으면 멀쩡)
   */
  update(
    view: GlView, tick: number, props: readonly PropState[] | null, city: CityState | null, focusX: number | null = null, clock = tick,
    citadel: CitadelState | null = null,
  ): void {
    const p = view.placed;
    this.applyMood(view, tick);
    // 품질 낮음: 광원 6개, 비 절반, 빛 번짐 끔
    const low = quality() === 'low';
    this.rain.setHalf(low);
    lightPool.setLimit(low ? 6 : 12);
    setDetail(!low);
    view.bloom = !low;
    this.rain.update(tick, view.camera.position.x, view.camera.position.y, p.ix, p.iy);
    this.steam.update(tick);
    this.buildings.update(city, tick);
    this.buildings.lights(city, tick);
    this.props.update(props, city, tick, p.ix, p.ix + SCREEN_W);
    this.big.update(props, tick, p.ix, p.ix + SCREEN_W);
    this.plaza.update(tick, props, citadel);
    this.outskirts.update(tick, p.ix, p.ix + SCREEN_W);
    this.life.update(tick, p.ix, focusX, clock, props, citadel !== null && citadel.stage === 4);
    // 이펙트 빛 (타격 번쩍임·기력·필살기·부서질 때 불꽃): 싸우는 면 바로 앞
    for (const pt of lights2d.points) lightPool.add(pt.x, GROUND - pt.y, 12, pt.r * 1.3, pt.color, pt.a * 1.6);
  }

  /**
   * 카메라가 있는 구간의 분위기를 하늘·안개·환경광·화면 색 보정에 싣는다. 먼 번개가 치면 하늘과 거리가 잠깐 밝아진다.
   */
  private applyMood(view: GlView, tick: number): void {
    const m = moodAt(view.camera.position.x);
    const u = this.sky.uniforms;
    u.zenith.value.copy(m.zenith);
    u.midSky.value.copy(m.mid);
    u.glow.value.copy(m.glow);
    u.glowK.value = m.glowK;
    u.cloud.value.copy(m.cloud);
    u.cloudLit.value.copy(m.cloudLit);
    u.cover.value = m.cover;
    const bolt = lightningAt(tick, m.lightning, this.skyW);
    u.flash.value = bolt.flash;
    u.bolt.value.set(bolt.boltX, bolt.boltX >= 0 ? bolt.flash : 0);
    // 하늘 그림: 10틱마다 (번개가 치는 동안은 매 틱, 막 그친 틱에도 한 번) 다시 그린다
    const r = view.renderer;
    if (!this.skyRT) {
      this.skyRT = new THREE.WebGLRenderTarget(this.skyW, this.skyH, {
        type: THREE.UnsignedByteType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: false,
      });
      this.skyPlaneMat.uniforms.map.value = this.skyRT.texture;
    }
    const due = Math.abs(tick - this.skyAt) >= 10 || bolt.flash > 0 || this.skyFlash > 0;
    this.skyFlash = bolt.flash;
    if (due) {
      this.skyAt = tick;
      const prev = r.getRenderTarget();
      r.setRenderTarget(this.skyRT);
      r.render(this.skyScene, this.skyCam);
      r.setRenderTarget(prev);
    }
    shared.uFogColor.value.copy(m.fog);
    shared.uFogGlow.value.copy(m.glow).multiplyScalar(m.glowK * 0.4);
    shared.uMist.value = m.mist;
    shared.uAmbient.value.copy(m.ambient);
    shared.uAmbientGround.value.copy(m.ambientGround);
    if (bolt.flash > 0) {
      shared.uAmbient.value.r += 0.1 * bolt.flash;
      shared.uAmbient.value.g += 0.11 * bolt.flash;
      shared.uAmbient.value.b += 0.16 * bolt.flash;
    }
    for (const [mat, k] of this.hazes) mat.uniforms.strength.value = k * m.haze;
    const L = view.post.look;
    L.shadow.copy(m.shadow);
    L.high.copy(m.high);
    L.sat = m.sat;
    L.contrast = m.contrast;
    L.halo = m.halo;
    L.streak = m.streak;
  }
}

/** 겹 속도 s, 겹 크기 cw×ch의 판을 그 속도의 깊이에 놓는다 (2D 시차와 똑같이 움직인다) */
function layerPlane(s: number, cw: number, ch: number, mat: THREE.Material): THREE.Mesh {
  const x0 = (-(SCREEN_W / 2) * (1 - s)) / s;
  const y0 = (-(SCREEN_H / 2) * (1 - s)) / s;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(cw / s, ch / s), mat);
  m.position.set(x0 + cw / s / 2, GROUND - (y0 + ch / s / 2), depthOfSpeed(s));
  return m;
}

/** 먼 겹 그림 → 그 겹 속도의 깊이에 놓은 판. glow: 안개가 지평선 도시 불빛 색을 띠는 정도 */
function backdrop(l: Layer, tint: number, fog: number, glow: number): THREE.Mesh {
  return layerPlane(l.speed, l.canvas.width, l.canvas.height, backdropMaterial(pixelTexture(l.canvas), tint, fog, glow));
}
