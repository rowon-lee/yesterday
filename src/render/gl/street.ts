import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITADEL as D } from '../../data/stages/citadel';
import { textWidth } from '../font';
import { COLORS as C } from '../palette';
import { canvas, disc, ditherRect, hash, rect } from '../dither';
import { depthOfSpeed } from './core';
import { star } from './backdrops';
import { KEEP_Z } from './plaza';
import { Details, plane } from './kit';
import { fgMaterial, floorMaterial, litMaterial, pixelTexture } from './shaders';
import { neonText, paintPuddles, paintStreet } from './tex';

/**
 * 길 (렌더 전용): 구간마다 다른 바닥(부두 돌 포장·아스팔트·광장 돌판·공원 자갈길), 전차 가공선, 부서지지 않는 길가 소품,
 * 카메라 앞을 스치는 앞겹(가로등 기둥·전선·깃대와 깃발).
 * 바닥은 싸우는 면 뒤(건물·난간 앞)에서 시작해 카메라 쪽으로 길게 깔린다. 화면 아래 줄은 싸우는 면 앞쪽 길이다.
 * 바닥 알파에 젖은 정도를 써서 화면 반사가 그만큼 비친다.
 */
const sec = (id: string) => D.sections.find((s) => s.id === id)!;
/** 전차 선로 (바닥 텍스처의 깊이 줄 번호) */
const RAILS = [30, 50];

export function buildStreet(): THREE.Group {
  const g = new THREE.Group();
  const puddles = repeat(pixelTexture(paintPuddles(128, 11)));
  const wetScale = new THREE.Vector2(1 / 420, 1 / 900);
  const floor = (x0: number, x1: number, zBack: number, map: HTMLCanvasElement, scale: THREE.Vector2, wetK: number, gain = 3) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2400 - zBack), floorMaterial(repeat(pixelTexture(map)), scale, puddles, wetScale, wetK, gain));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0, (zBack + 2400) / 2);
    g.add(m);
  };
  const street = paintStreet(256, 128, 3, RAILS);
  const asphalt = paintStreet(256, 128, 5, []);
  const s512 = new THREE.Vector2(1 / 256, 1 / 512);
  floor(-200, sec('pier').x1, -46, paintQuay(256, 128, RAILS), s512, 0.9);
  floor(sec('theater').x0, sec('theater').x1, -24, street, s512, 1);
  floor(sec('plaza').x0, sec('plaza').x1, KEEP_Z, paintPavers(192, 128), new THREE.Vector2(1 / 192, 1 / 512), 0.9, 2);
  floor(sec('apartments').x0, sec('apartments').x1, -24, asphalt, s512, 1);
  floor(sec('park').x0, MAP_RIGHT, -46, paintGravel(256, 128), s512, 0.35, 1.2);
  const det = new Details();
  tramWire(det);
  props(det, g);
  g.add(det.build());
  return g;
}

const MAP_RIGHT = 3400;

function repeat(t: THREE.Texture): THREE.Texture {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 노면전차 가공선: 120px마다 걸쇠, 사이는 조금 처진다 (선로 구간 x0~x1, 높이 wire) */
function tramWire(det: Details): void {
  const T = D.tram;
  const seg = 12;
  for (let x = T.x0; x < T.x1; x += seg) {
    const sag = (u: number) => Math.sin((((u - T.x0) % 120) / 120) * Math.PI) * 3;
    det.bar(x, T.wire - sag(x), Math.min(T.x1, x + seg), T.wire - sag(x + seg - 0.01), 1, -3.5, -2.5, C.wire);
  }
  for (let x = T.x0; x < T.x1; x += 120) det.add(x, x + 1, T.wire, T.wire + 10, -3.5, -2.5, C.iron);
}

/** 부서지지 않는 길가 소품: 나무 상자, 포스터 판, 우체통, 드럼통, 벤치, 화분 */
function props(det: Details, g: THREE.Group): void {
  for (const p of D.street.props) {
    const x = p.x;
    switch (p.kind) {
      case 'crates':
        for (const [cx, cy, s, z] of [[0, 0, 18, -40], [18, 0, 18, -34], [8, 18, 16, -38]] as const) {
          det.add(x + cx, x + cx + s, cy, cy + s, z - s, z, C.awning);
          det.add(x + cx, x + cx + s, cy + s - 1, cy + s, z - s, z, C.awningStripe);
          det.bar(x + cx + 1, cy + 1, x + cx + s - 1, cy + s - 1, 1.5, z, z + 0.3, C.awningStripe);
        }
        break;
      case 'mailbox':
        det.add(x, x + 14, 5, 24, -36, -26, C.paintTeal);
        det.add(x, x + 14, 24, 26, -36, -26, C.ironLight);
        det.add(x + 3, x + 11, 19, 20, -26, -25.8, C.iron);
        det.add(x + 2, x + 4, 0, 5, -33, -29, C.iron);
        det.add(x + 10, x + 12, 0, 5, -33, -29, C.iron);
        break;
      case 'barrel':
        det.add(x, x + 14, 0, 20, -38, -26, C.rust);
        det.add(x - 0.5, x + 14.5, 16, 17, -38.5, -25.5, C.iron);
        det.add(x - 0.5, x + 14.5, 5, 6, -38.5, -25.5, C.iron);
        break;
      case 'bench':
        det.add(x, x + 36, 10, 13, -38, -30, C.awningStripe);
        det.add(x, x + 36, 19, 22, -39, -37, C.awningStripe);
        det.add(x + 2, x + 4, 0, 22, -38, -36, C.iron);
        det.add(x + 32, x + 34, 0, 22, -38, -36, C.iron);
        break;
      case 'planter': {
        det.add(x, x + 30, 0, 16, -44, -28, C.stone);
        det.add(x, x + 30, 15, 16, -44, -28, C.paintCream);
        const [c, cg] = canvas(28, 22);
        disc(cg, 14, 12, 11, C.iron);
        disc(cg, 11, 9, 7, C.paintTeal, 7);
        g.add(plane(x + 1, x + 29, 12, 34, -36, litMaterial(pixelTexture(c), { side: THREE.DoubleSide })));
        break;
      }
      case 'posterboard': {
        const text = 'text' in p ? p.text : '';
        const pw = Math.max(32, textWidth(text, 2) + 12);
        det.add(x + 3, x + 6, 0, 32, -38, -35, C.iron);
        det.add(x + pw - 6, x + pw - 3, 0, 32, -38, -35, C.iron);
        const [c, cg] = canvas(pw, 48);
        rect(cg, 0, 0, pw, 48, C.iron);
        rect(cg, 2, 2, pw - 4, 44, C.posterRed);
        rect(cg, 2, 2, pw - 4, 1, C.paintCream);
        star(cg, Math.floor(pw / 2), 14, 2, C.posterRedDark);
        neonText(cg, null, text, Math.floor((pw - textWidth(text, 2)) / 2), 30, 2, C.paintCream, C.paintCream);
        ditherRect(cg, 2, 2, Math.floor(pw * 0.4), 20, C.posterRedDark, 3);
        g.add(plane(x, x + pw, 30, 78, -34, litMaterial(pixelTexture(c))));
        break;
      }
    }
  }
}

/** 부두 돌 포장 (큰 돌판, 이음매, 소금기)과 전차 선로 */
function paintQuay(w: number, d: number, rails: readonly number[]): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  rect(g, 0, 0, w, d, C.sidewalk);
  for (let y = 0; y < d; y += 6) {
    rect(g, 0, y, w, 1, C.sidewalkJoint);
    const off = (y / 6) % 2 ? 12 : 0;
    for (let x = off; x < w; x += 24) rect(g, x, y, 1, 6, C.sidewalkJoint);
  }
  ditherRect(g, 0, 0, w, d, C.smog1, 3);
  for (let k = 0; k < 60; k++) rect(g, Math.floor(hash(k * 13 + 5) * w), Math.floor(hash(k * 7 + 9) * d), 2, 1, C.stone);
  for (const rz of rails) {
    rect(g, 0, rz, w, 2, C.rail);
    rect(g, 0, rz + 2, w, 1, C.railDark);
  }
  return c;
}

/** 광장 돌판 (엇갈린 네모 판, 판마다 조금 다른 색) */
function paintPavers(w: number, d: number): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  rect(g, 0, 0, w, d, C.sidewalk);
  for (let y = 0; y < d; y += 4) {
    const off = (y / 4) % 2 ? 6 : 0;
    for (let x = -off; x < w; x += 12) {
      const r = hash(x * 31 + y * 17);
      if (r < 0.3) rect(g, Math.max(0, x + 1), y + 1, 10, 3, r < 0.15 ? C.curb : C.streetLine);
      rect(g, Math.max(0, x), y, 1, 4, C.sidewalkJoint);
    }
    rect(g, 0, y, w, 1, C.sidewalkJoint);
  }
  return c;
}

/** 공원 자갈길과 앞쪽 풀 */
function paintGravel(w: number, d: number): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  rect(g, 0, 0, w, d, C.sandbag);
  ditherRect(g, 0, 0, w, d, C.awning, 6);
  for (let k = 0; k < 160; k++) rect(g, Math.floor(hash(k * 3 + 1) * w), Math.floor(hash(k * 5 + 2) * d), 1, 1, C.stone);
  ditherRect(g, 0, Math.floor(d * 0.55), w, d - Math.floor(d * 0.55), C.paintTeal, 9);
  return c;
}

/**
 * 앞겹: 카메라 앞(겹 속도 1.5 = 깊이 +1000)을 스치는 가로등 기둥과 늘어진 전선, 깃대와 깃발. 아주 어두운 실루엣이고
 * 화면 가운데로 오면 사라져 가장자리에서만 보인다.
 */
export function foreground(): THREE.Group {
  const g = new THREE.Group();
  const z = depthOfSpeed(D.fg.speed);
  // 막대마다 따로 그리면 그리기 호출이 수백 번이라 한 기하로 묶는다 (실루엣 하나, 깃발 하나)
  const bars: THREE.BufferGeometry[] = [];
  const bar = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const geo = new THREE.BoxGeometry(len + 0.5, t, t);
    geo.rotateZ(Math.atan2(y1 - y0, x1 - x0));
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
    bars.push(geo);
  };
  const flags: THREE.BufferGeometry[] = [];
  for (const it of D.fg.items) {
    if (it.kind === 'post') {
      bar(it.x, 0, it.x, 420, 6);
      bar(it.x - 20, 400, it.x, 400, 3);
    } else if (it.kind === 'wire') {
      const to = (it as { to?: number }).to ?? it.x;
      for (const [dy, sag] of [[0, 30], [7, 26]] as const) {
        const segs = 24;
        for (let k = 0; k < segs; k++) {
          const t0 = k / segs;
          const t1 = (k + 1) / segs;
          bar(it.x + (to - it.x) * t0, 396 - dy - Math.sin(Math.PI * t0) * sag, it.x + (to - it.x) * t1, 396 - dy - Math.sin(Math.PI * t1) * sag, 0.8);
        }
      }
    } else {
      // 깃대와 크게 늘어진 붉은 깃발 (어둡게)
      bar(it.x, 0, it.x, 470, 5);
      const flag = new THREE.PlaneGeometry(56, 96, 8, 1);
      const pos = flag.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const fx = pos.getX(i) + 28;
        pos.setY(i, pos.getY(i) + Math.sin(fx * 0.12) * 3 + (pos.getY(i) < 0 ? fx * 0.2 : 0));
      }
      flag.translate(it.x + 31, 192, z);
      flags.push(flag.toNonIndexed());
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(bars.map((b) => b.toNonIndexed())), fgMaterial('#05040a')));
  if (flags.length) g.add(new THREE.Mesh(mergeGeometries(flags), fgMaterial('#1a0809')));
  return g;
}
