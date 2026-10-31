import * as THREE from 'three';
import type { CityState, PropState } from '../../sim';
import { GROUND } from '../../stage/citadel';
import { lights as lights2d, quality } from '../light';
import { SCREEN_W } from '../screen';
import { buildFar, buildKeep, buildMid, buildSky, type Layer } from './backdrops';
import { BigProps } from './bigprops';
import { Buildings } from './buildings';
import { depthOfSpeed } from './core';
import { Edges } from './edges';
import { Life } from './life';
import { lightPool } from './lights';
import { Plaza } from './plaza';
import { Props } from './props';
import { Rain } from './rain';
import { backdropMaterial, hazeMaterial, pixelTexture } from './shaders';
import { Steam } from './steam';
import { buildStreet, foreground } from './street';
import { paintNoise } from './tex';
import type { GlView } from './view';
import { SCREEN_H } from '../screen';

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
  private readonly life = new Life();
  private readonly rain = new Rain();
  private readonly steam = new Steam();
  /** 앞겹 (카메라 앞을 스치는 기둥·전선·깃발). 확인용으로 끌 수 있다 */
  readonly foreground = foreground();
  /** 움직이지 않는 무대 (먼 겹 판·안개 판·길·건물·앞겹) */
  private readonly statics: THREE.Object3D[] = [];

  constructor() {
    for (const [layer, tint, fog] of [
      [buildSky(), 0.55, 0.15],
      [buildFar(), 0.4, 0.45],
      [buildKeep(), 0.45, 0.35],
      [buildMid(), 0.32, 0.3],
    ] as const) this.statics.push(backdrop(layer, tint, fog));
    // 겹 사이 안개: 중간 건물과 시타델 탑 사이, 싸우는 줄과 중간 건물 사이, 길 위 바닥 안개
    const noise = pixelTexture(paintNoise(128, 7, 4, 3));
    noise.wrapS = THREE.RepeatWrapping;
    noise.wrapT = THREE.RepeatWrapping;
    noise.magFilter = THREE.LinearFilter;
    noise.minFilter = THREE.LinearFilter;
    for (const [z, h, color, strength] of [
      [-4200, 900, '#26304a', 0.55],
      [-900, 260, '#232c44', 0.42],
      [60, 34, '#2a3550', 0.32],
    ] as const) {
      const k = (3000 - z) / 3000;
      const mat = hazeMaterial(noise, color, strength, k, z > -2000);
      // 캐릭터(깊이를 쓰지 않음)보다 뒤 안개는 캐릭터보다 먼저, 앞 안개는 나중에 그린다
      mat.transparent = false;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9000 * k, h * k), mat);
      m.renderOrder = z < 0 ? 1 : 21;
      m.position.set(1600, (h * k) / 2 - 4 * k, z);
      this.statics.push(m);
    }
    this.statics.push(buildStreet(), this.buildings.group, this.foreground);
    this.group.add(...this.statics, this.plaza.group, this.edges.group, this.props.group, this.big.group, this.life.group, this.rain.group, this.steam.group);
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
   * clock: sim의 도시 시계 (노면전차가 이 시계로 다닌다. 없으면 tick)
   */
  update(view: GlView, tick: number, props: readonly PropState[] | null, city: CityState | null, focusX: number | null = null, clock = tick): void {
    const p = view.placed;
    // 품질 낮음: 광원 6개, 비 절반, 빛 번짐 끔
    const low = quality() === 'low';
    this.rain.setHalf(low);
    lightPool.setLimit(low ? 6 : 12);
    view.bloom = !low;
    this.rain.update(tick, view.camera.position.x, view.camera.position.y, p.ix, p.iy);
    this.steam.update(tick);
    this.buildings.update(city, tick);
    this.buildings.lights(city, tick);
    this.props.update(props, city, tick, p.ix, p.ix + SCREEN_W);
    this.big.update(props, tick, p.ix, p.ix + SCREEN_W);
    this.plaza.update(tick, props);
    this.life.update(tick, p.ix, focusX, clock, props);
    // 이펙트 빛 (타격 번쩍임·기력·필살기·부서질 때 불꽃): 싸우는 면 바로 앞
    for (const pt of lights2d.points) lightPool.add(pt.x, GROUND - pt.y, 12, pt.r * 1.3, pt.color, pt.a * 1.6);
  }
}

/** 먼 겹 그림 → 그 겹 속도의 깊이에 놓은 판 (2D 시차와 똑같이 움직인다) */
function backdrop(l: Layer, tint: number, fog: number): THREE.Mesh {
  const s = l.speed;
  const cw = l.canvas.width;
  const ch = l.canvas.height;
  const x0 = (-(SCREEN_W / 2) * (1 - s)) / s;
  const y0 = (-(SCREEN_H / 2) * (1 - s)) / s;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(cw / s, ch / s), backdropMaterial(pixelTexture(l.canvas), tint, fog));
  m.position.set(x0 + cw / s / 2, GROUND - (y0 + ch / s / 2), depthOfSpeed(s));
  return m;
}
