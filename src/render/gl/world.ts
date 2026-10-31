import * as THREE from 'three';
import type { CityState, PropState } from '../../sim';
import { CITADEL as D } from '../../data/stages/citadel';
import { GROUND } from '../../stage/citadel';
import { lights as lights2d } from '../light';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { hash } from '../stage/dither';
import { buildFar, buildKeep, buildMid, buildSky, type Layer } from '../stage/layers';
import { depthOfSpeed } from './core';
import { lightPool } from './lights';
import { backdropMaterial, fgMaterial, floorMaterial, hazeMaterial, pixelTexture } from './shaders';
import { buildTheater, type TheaterSection } from './theater';
import { paintNoise, paintPuddles, paintStreet } from './tex';
import { Rain } from './rain';
import { Steam } from './steam';
import type { GlView } from './view';
import { quality } from '../light';

/**
 * 2.5D 무대 전체 (렌더 전용): 먼 겹 판(하늘·먼 마천루·시타델 탑·중간 건물), 겹 사이 안개, 젖은 길,
 * 구간 무대 (지금은 극장·다이너 거리만). 매 프레임 sim 상태(부서진 물건)를 보고 빛과 깜빡임만 바꾼다.
 */
export class World {
  readonly group = new THREE.Group();
  private theater: TheaterSection;
  private readonly rain = new Rain();
  private readonly steam = new Steam();

  constructor() {
    for (const [layer, tint, fog] of [
      [buildSky(), 0.55, 0.15],
      [buildFar(), 0.4, 0.45],
      [buildKeep(), 0.45, 0.35],
      [buildMid(), 0.32, 0.3],
    ] as const) this.group.add(backdrop(layer, tint, fog));
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
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5200 * k, h * k), mat);
      m.renderOrder = z < 0 ? 1 : 21;
      m.position.set(1600, (h * k) / 2 - 4 * k, z);
      this.group.add(m);
    }
    // 젖은 길 (차도): 가로 x, 세로 z. 화면 아래 줄은 싸우는 면 앞쪽 길이다
    const street = pixelTexture(paintStreet(256, 128, 3, [30, 50]));
    street.wrapS = THREE.RepeatWrapping;
    street.wrapT = THREE.RepeatWrapping;
    const puddles = pixelTexture(paintPuddles(128, 11));
    puddles.wrapS = THREE.RepeatWrapping;
    puddles.wrapT = THREE.RepeatWrapping;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4800, 2400),
      floorMaterial(street, new THREE.Vector2(1 / 256, 1 / 512), puddles, new THREE.Vector2(1 / 420, 1 / 900)),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(1600, 0, -24 + 1200);
    this.group.add(floor);
    this.theater = buildTheater();
    this.group.add(this.theater.group, this.rain.group, this.steam.group);
    this.group.add(foreground());
  }

  /** 이번 틱의 빛 후보를 채우고 깜빡이는 것들을 바꾼다 */
  update(view: GlView, tick: number, props: readonly PropState[] | null, _city: CityState | null): void {
    const T = this.theater;
    const p = view.placed;
    // 품질 낮음: 광원 6개, 비 절반, 빛 번짐 끔
    const low = quality() === 'low';
    this.rain.setHalf(low);
    lightPool.setLimit(low ? 6 : 12);
    view.bloom = !low;
    this.rain.update(tick, view.camera.position.x, view.camera.position.y, p.ix, p.iy);
    this.steam.update(tick);
    for (const s of T.signs) {
      const p = props?.[s.index];
      const stage = p?.stage ?? 0;
      let on = s.role !== 'off' && stage !== 2;
      if (on && (s.role === 'flicker' || stage === 1)) {
        // 불안정한 관: 대부분 켜져 있다가 몇 틱씩 끊긴다
        const r = hash((tick >> 2) * 131 + s.index * 17);
        on = r > (stage === 1 ? 0.45 : 0.22);
      }
      const k = on ? (s.role === 'hero' ? 2.4 : s.role === 'dim' ? 0.9 : 1.5) : 0;
      s.mat.uniforms.emissiveStrength.value = k;
      if (on) lightPool.add(s.light.x, s.light.y, s.light.z, s.light.range, s.light.color, s.light.power);
    }
    for (const l of T.lamps) {
      const p = props?.[l.index];
      const stage = p?.stage ?? 0;
      const flick = stage === 1 ? hash((tick >> 2) * 31 + l.index * 7) < 0.45 : hash((tick >> 3) * 31 + l.index * 7) < 0.03;
      const on = stage !== 2 && !flick;
      l.lens.uniforms.emissiveStrength.value = on ? 3 : 0;
      l.shaft.visible = on;
      if (on) lightPool.add(l.head.x, l.head.y, l.head.z, 140, C.sodium, 1.6);
    }
    for (const f of T.fixed) lightPool.add(f.x, f.y, f.z, f.range, f.color, f.power);
    for (const tv of T.tvs) {
      // TV: 장면이 바뀔 때마다 밝기·색이 튄다
      const r = hash((tick >> 3) * 977 + tv.seed);
      const k = 0.5 + r * 0.9;
      tv.mat.uniforms.emissiveStrength.value = k;
      lightPool.add(tv.x, tv.y, -34, 48, r < 0.5 ? '#7fb6ff' : '#bfe3ff', 0.35 * k);
    }
    // 이펙트 빛 (기존 빛 목록: 타격 번쩍임·기력·필살기): 싸우는 면 바로 앞
    for (const p of lights2d.points) lightPool.add(p.x, GROUND - p.y, 12, p.r * 1.3, p.color, p.a * 1.6);
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

/**
 * 앞겹: 카메라 앞(겹 속도 1.5 = 깊이 +1000)을 스치는 가로등 기둥과 늘어진 전선. 아주 어두운 실루엣이고
 * 화면 가운데로 오면 사라져 가장자리에서만 보인다.
 */
function foreground(): THREE.Group {
  const g = new THREE.Group();
  const z = depthOfSpeed(D.fg.speed);
  const mat = fgMaterial('#05040a');
  const posts = D.fg.items.filter((it) => it.kind === 'post');
  for (const it of posts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 420, 6), mat);
    m.position.set(it.x, 210, z);
    g.add(m);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 3), mat);
    arm.position.set(it.x - 10, 400, z);
    g.add(arm);
  }
  for (const it of D.fg.items) {
    if (it.kind !== 'wire') continue;
    const to = (it as { to?: number }).to ?? it.x;
    for (const [dy, sag] of [[0, 30], [7, 26]] as const) {
      const segs = 24;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const x0 = it.x + (to - it.x) * t0;
        const x1 = it.x + (to - it.x) * t1;
        const y0 = 396 - dy - Math.sin(Math.PI * t0) * sag;
        const y1 = 396 - dy - Math.sin(Math.PI * t1) * sag;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.5, 0.8, 0.8), mat);
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
        m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
        g.add(m);
      }
    }
  }
  return g;
}
