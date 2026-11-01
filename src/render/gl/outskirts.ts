import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { MAP_ENDS } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, ditherRect, hash, rect } from '../dither';
import { paintContainer } from './edges';
import { box, Details, facedBox, plane } from './kit';
import { lightPool } from './lights';
import { litMaterial, pixelTexture } from './shaders';
import { brickWall, neonText, weather } from './tex';

/**
 * 맵을 넓히며 붙인 네 구간 (렌더 전용, 무너지지 않는다). 발판·벽 자리는 데이터(outskirts)와 sim이 정하고,
 * 여기서는 그 자리에 모양을 세운다.
 * - 공장 지대: 서쪽 끝 공장 벽돌 담(맵 끝 벽), 용광로 굴뚝과 둘레 작업대, 철제 통로, 저탄 탑, 뒤쪽 제철소 건물. 용광로 불빛.
 * - 항만 창고 부두: 갠트리 크레인, 컨테이너 더미 둘, 하역장과 차양, 창고, 멀리 정박한 화물선.
 * - 고가 철도 밑: 선로 바닥(철골 상판)과 철 기둥, 역 계단참, 선로 아래 가게들. 형광등 불빛.
 * - 1구역 성벽 검문소: 동쪽 끝 성벽(맵 끝 벽)과 철문, 감시탑, 초소, 모래주머니 벽, 뒤쪽 막사. 투광등과 붉은 경고등.
 */
const OS = D.outskirts;
const kindOf = <T extends { kind: string }>(list: readonly T[], k: string): T[] => list.filter((b) => b.kind === k);

export class Outskirts {
  readonly group = new THREE.Group();
  /** 빛 후보 (자리·색·세기·깜빡임 씨앗) */
  private readonly lamps: Array<{ x: number; y: number; z: number; range: number; color: string; power: number; flicker: number; down: boolean }> = [];
  private readonly beacons: THREE.ShaderMaterial[] = [];

  constructor() {
    const det = new Details();
    this.factory(det);
    this.docks(det);
    this.elrail(det);
    this.wall(det);
    this.group.add(det.build());
  }

  // ---------------------------------------------------------------- 공장 지대
  private factory(det: Details): void {
    // 서쪽 끝 공장 벽돌 담 (맵 끝 벽): 화면 위까지 솟은 제철소 몸통. 큰 철문과 높은 창
    const L = MAP_ENDS.left;
    const end = litMaterial(pixelTexture(paintFactory(360, 460, 17, true)), { emissive: pixelTexture(paintFactoryGlow(360, 460, 17)), emissiveStrength: 1.4 });
    this.group.add(box(L - 360, L, 0, 460, -320, 6, end));
    // 뒤쪽 제철소 건물 (낮고 긴 벽돌 몸통, 톱니 지붕)
    const back = litMaterial(pixelTexture(paintFactory(740, 230, 29, false)), { emissive: pixelTexture(paintFactoryGlow(740, 230, 29)), emissiveStrength: 1.2 });
    this.group.add(plane(L, 800, 0, 230, -120, back));
    // 용광로 굴뚝 (윗면이 옥상), 둘레 작업대와 난간
    for (const s of kindOf(OS.blocks, 'stack')) {
      const tex = litMaterial(pixelTexture(paintStack(s.x1 - s.x0, s.h, 41)));
      this.group.add(box(s.x0, s.x1, 0, s.h, -40, -4, tex));
      det.add(s.x0 - 3, s.x1 + 3, s.h - 6, s.h, -43, -1, C.iron);
      // 꼭대기 불빛 (용광로 가스 불꽃)
      this.lamps.push({ x: (s.x0 + s.x1) / 2, y: s.h + 8, z: -20, range: 120, color: C.fxOrange, power: 1.1, flicker: 3, down: false });
      // 밑동 화구: 붉게 이글거린다
      this.lamps.push({ x: (s.x0 + s.x1) / 2, y: 24, z: 10, range: 170, color: C.fxFlame, power: 1.6, flicker: 7, down: false });
      det.add(s.x0 + 14, s.x1 - 14, 6, 34, -3.5, -3, C.fxRed);
    }
    for (const r of kindOf(OS.decks, 'ring')) {
      det.add(r.x0, r.x1, r.h - 4, r.h, -48, -2, C.iron);
      det.add(r.x0, r.x1, r.h - 4, r.h - 3, -48, -2, C.ironLight);
      rail(det, r.x0, r.x1, r.h, -3);
      for (const x of [r.x0 + 4, r.x1 - 6]) det.bar(x, r.h - 4, x + (x < (r.x0 + r.x1) / 2 ? 18 : -18), r.h - 30, 2, -30, -28, C.iron);
    }
    // 철제 통로 (기둥 둘), 난간, 아래 매달린 전등
    for (const c of kindOf(OS.decks, 'catwalk')) {
      det.add(c.x0, c.x1, c.h - 4, c.h, -36, -4, C.iron);
      det.add(c.x0, c.x1, c.h - 1, c.h, -36, -4, C.ironLight);
      rail(det, c.x0, c.x1, c.h, -5);
      for (let x = c.x0 + 40; x < c.x1 - 20; x += 80) {
        det.add(x, x + 6, c.h - 10, c.h - 4, -12, -8, C.chromeDark);
        this.lamps.push({ x: x + 3, y: c.h - 10, z: -6, range: 110, color: C.sodium, power: 1.2, flicker: 0, down: true });
      }
    }
    for (const p of kindOf(OS.posts, 'catwalkLeg')) {
      det.add(p.x, p.x + p.w, p.h0, p.h, -24, -16, C.iron);
      det.bar(p.x + p.w / 2, 10, p.x + p.w / 2 + (p.x < 400 ? 30 : -30), p.h - 20, 2, -22, -20, C.iron);
    }
    // 저탄 탑: 리벳 강판 몸통, 아래 깔때기
    for (const h of kindOf(OS.blocks, 'hopper')) {
      const tex = litMaterial(pixelTexture(paintSteel(h.x1 - h.x0, h.h, C.rust, 53)), { wet: 0.5 });
      this.group.add(box(h.x0, h.x1, 40, h.h, -50, -4, tex));
      det.add(h.x0 + 18, h.x1 - 18, 0, 40, -40, -12, C.iron);
      for (const x of [h.x0 + 4, h.x1 - 10]) det.add(x, x + 6, 0, 40, -48, -6, C.iron);
      rail(det, h.x0, h.x1, h.h, -5);
    }
  }

  // ---------------------------------------------------------------- 항만 창고 부두
  private docks(det: Details): void {
    // 멀리 정박한 화물선: 검은 선체와 선교, 둥근 창 몇 개에 불
    const ship = litMaterial(pixelTexture(paintShip(560, 150)), { emissive: pixelTexture(paintShipGlow(560, 150)), emissiveStrength: 1.6 });
    this.group.add(plane(880, 1440, -6, 144, -380, ship));
    // 창고 (골함석 벽, 큰 셔터 문, 간판)
    const wh = litMaterial(pixelTexture(paintWarehouse(260, 200)), { emissive: pixelTexture(paintWarehouseGlow(260, 200)), emissiveStrength: 1.3, wet: 0.6 });
    this.group.add(plane(1336, 1596, 0, 200, -72, wh));
    this.lamps.push({ x: 1470, y: 140, z: -50, range: 140, color: C.sodium, power: 1.4, flicker: 0, down: true });
    // 갠트리 크레인: 다리 둘, 위 들보와 기계실, 아래 들보, 늘어진 갈고리
    const crane = litMaterial(pixelTexture(paintSteel(16, 240, C.paintOchre, 61)), { wet: 0.5 });
    for (const p of kindOf(OS.posts, 'craneLeg')) {
      this.group.add(box(p.x, p.x + p.w, p.h0, p.h, -34, -16, crane));
      det.bar(p.x + p.w / 2, 20, p.x + p.w / 2 + (p.x < 1000 ? 40 : -40), 110, 3, -27, -23, C.paintOchre);
    }
    for (const b of kindOf(OS.decks, 'crane')) {
      const beam = litMaterial(pixelTexture(paintSteel(b.x1 - b.x0, 12, C.paintOchre, 67)), { wet: 0.5 });
      this.group.add(box(b.x0, b.x1, b.h - 12, b.h, -38, -12, beam));
      det.add(b.x0 + 70, b.x0 + 120, b.h, b.h + 26, -34, -16, C.paintOchre);
      det.add(b.x0 + 76, b.x0 + 92, b.h + 10, b.h + 20, -16, -15.5, C.windowLit);
      this.lamps.push({ x: b.x0 + 84, y: b.h + 14, z: -10, range: 90, color: C.windowLight, power: 0.8, flicker: 0, down: false });
      det.add(b.x0 + 150, b.x0 + 152, b.h - 90, b.h - 12, -26, -24, C.iron);
      det.add(b.x0 + 144, b.x0 + 158, b.h - 98, b.h - 90, -28, -22, C.ironLight);
    }
    for (const b of kindOf(OS.decks, 'craneLow')) det.add(b.x0, b.x1, b.h - 6, b.h, -30, -20, C.paintOchre);
    // 컨테이너 2단·3단
    const colors = [C.paintTeal, C.rust, C.brickRed, C.paintOchre];
    let k = 0;
    for (const b of [...kindOf(OS.blocks, 'crate2'), ...kindOf(OS.blocks, 'crate3')]) {
      const rows = Math.round(b.h / 28);
      for (let r = 0; r < rows; r++) {
        const col = colors[k++ % colors.length];
        const tex = litMaterial(pixelTexture(paintContainer(b.x1 - b.x0, 28, col, k + 11)), { wet: 0.6 });
        const endTex = litMaterial(pixelTexture(paintContainer(60, 28, col, k + 19)), { tint: 0.75, wet: 0.6 });
        this.group.add(facedBox(b.x0, b.x1, r * 28, (r + 1) * 28, -90, -0.6, { nx: endTex, px: endTex, py: endTex, pz: tex }));
      }
    }
    // 하역장 (콘크리트 턱)과 차양
    for (const b of kindOf(OS.blocks, 'dock')) {
      this.group.add(box(b.x0, b.x1, 0, b.h, -70, -2, litMaterial(pixelTexture(paintConcrete(b.x1 - b.x0, b.h, 71)))));
      det.add(b.x0, b.x1, b.h - 2, b.h, -70, -2, C.stone);
      for (let x = b.x0 + 10; x < b.x1 - 10; x += 34) det.add(x, x + 8, 8, 30, -1.5, -1, C.iron);
    }
    for (const a of kindOf(OS.decks, 'dockAwning')) {
      det.add(a.x0, a.x1, a.h - 4, a.h, -72, -6, C.ironLight);
      det.add(a.x0, a.x1, a.h - 4, a.h - 3, -8, -6, C.iron);
      for (const x of [a.x0 + 4, a.x1 - 8]) det.bar(x, a.h - 4, x + (x < (a.x0 + a.x1) / 2 ? 20 : -20), a.h - 34, 2, -40, -38, C.iron);
    }
  }

  // ---------------------------------------------------------------- 고가 철도 밑
  private elrail(det: Details): void {
    // 선로 아래 가게들 (벽돌 2층, 쇼윈도와 간판)
    const shops = litMaterial(pixelTexture(paintShops(760, 170)), { emissive: pixelTexture(paintShopsGlow(760, 170)), emissiveStrength: 1.4 });
    this.group.add(plane(4820, 5580, 0, 170, -70, shops));
    // 선로 바닥: 철골 상판 (옆판에 리벳), 위에 침목과 레일
    for (const d of kindOf(OS.decks, 'rail')) {
      const girder = litMaterial(pixelTexture(paintSteel(d.x1 - d.x0, 14, C.iron, 79)), { wet: 0.5 });
      this.group.add(box(d.x0 - 60, d.x1 + 60, d.h - 14, d.h, -64, -2, girder));
      for (let x = d.x0 - 60; x < d.x1 + 60; x += 7) det.add(x, x + 4, d.h, d.h + 2, -60, -6, C.awning);
      det.add(d.x0 - 60, d.x1 + 60, d.h + 2, d.h + 4, -50, -46, C.chromeDark);
      det.add(d.x0 - 60, d.x1 + 60, d.h + 2, d.h + 4, -20, -16, C.chromeDark);
      // 상판 아래 형광등 (청록 빛이 길을 물들인다)
      for (let x = d.x0 + 60; x < d.x1; x += 170) {
        det.add(x - 10, x + 10, d.h - 17, d.h - 14, -20, -14, C.neonGreen);
        this.lamps.push({ x, y: d.h - 18, z: -10, range: 160, color: '#9effd8', power: 1.3, flicker: x % 3 === 0 ? 5 : 0, down: true });
      }
      rail(det, d.x0 - 60, d.x1 + 60, d.h + 4, -3);
    }
    const leg = litMaterial(pixelTexture(paintSteel(12, 180, C.iron, 83)), { wet: 0.6 });
    for (const p of kindOf(OS.posts, 'railLeg')) {
      this.group.add(box(p.x, p.x + p.w, p.h0, p.h - 14, -40, -24, leg));
      det.bar(p.x + p.w, p.h - 40, p.x + p.w + 30, p.h - 14, 3, -34, -30, C.iron);
      det.bar(p.x, p.h - 40, p.x - 30, p.h - 14, 3, -34, -30, C.iron);
    }
    // 역 계단참과 계단 (계단참에서 선로까지)
    for (const s of kindOf(OS.decks, 'stairs')) {
      det.add(s.x0, s.x1, s.h - 4, s.h, -44, -10, C.ironLight);
      rail(det, s.x0, s.x1, s.h, -11);
      for (let i = 0; i < 9; i++) det.add(s.x1 + i * 6, s.x1 + i * 6 + 6, s.h + i * 9, s.h + i * 9 + 2, -40, -14, C.iron);
      for (let i = 0; i < 9; i++) det.add(s.x0 - i * 6 - 6, s.x0 - i * 6, s.h - i * 10 - 2, s.h - i * 10, -40, -14, C.iron);
      det.add(s.x0 + 4, s.x0 + 8, 0, s.h, -30, -26, C.iron);
      det.add(s.x1 - 8, s.x1 - 4, 0, s.h, -30, -26, C.iron);
    }
  }

  // ---------------------------------------------------------------- 1구역 성벽 검문소
  private wall(det: Details): void {
    // 동쪽 끝 성벽 (맵 끝 벽): 콘크리트 판, 경고 띠, 스텐실 글씨, 위에 철조망과 붉은 경고등
    const R = MAP_ENDS.right;
    const wallTex = litMaterial(pixelTexture(paintWall(380, 480)), { emissive: pixelTexture(paintWallGlow(380, 480)), emissiveStrength: 1.5 });
    this.group.add(box(R, R + 380, 0, 480, -320, 6, wallTex));
    for (let x = R + 6; x < R + 380; x += 18) det.bar(x, 480, x + 12, 492, 1, -10, -9, C.wire);
    for (const y of [120, 260, 400]) {
      const m = beaconMaterial();
      this.beacons.push(m);
      this.group.add(box(R - 4, R + 2, y, y + 4, 2, 8, m));
      this.lamps.push({ x: R - 4, y: y + 2, z: 10, range: 70, color: C.neonRed, power: 0.9, flicker: -1, down: false });
    }
    // 성벽을 비추는 투광등 둘 (맵 끝이 어둠에 묻히지 않게)
    for (const [x, y] of [[R - 120, 150], [R - 260, 90]]) {
      det.add(x - 4, x + 4, y - 4, y + 4, -6, 2, C.chromeDark);
      this.lamps.push({ x: x + 40, y, z: 40, range: 240, color: C.beam, power: 1.3, flicker: 0, down: false });
    }
    // 뒤쪽 막사 (낮은 콘크리트, 창 몇 개에 불)
    const barracks = litMaterial(pixelTexture(paintBarracks(720, 130)), { emissive: pixelTexture(paintBarracksGlow(720, 130)), emissiveStrength: 1.3 });
    this.group.add(plane(5620, R, 0, 130, -110, barracks));
    // 감시탑: 다리 둘과 가새, 초소 바닥·벽·지붕, 지붕 위 서치라이트
    for (const p of kindOf(OS.posts, 'watchLeg')) det.add(p.x, p.x + p.w, p.h0, p.h, -34, -26, C.iron);
    const legs = kindOf(OS.posts, 'watchLeg');
    if (legs.length === 2) {
      const [a, b] = legs;
      for (let y = 20; y < a.h - 20; y += 50) {
        det.bar(a.x + a.w, y, b.x, y + 46, 2, -31, -29, C.iron);
        det.bar(b.x, y, a.x + a.w, y + 46, 2, -31, -29, C.iron);
      }
    }
    for (const c of kindOf(OS.posts, 'watchCabin')) {
      const cab = litMaterial(pixelTexture(paintCabin(c.w, c.h - c.h0)), { emissive: pixelTexture(paintCabinGlow(c.w, c.h - c.h0)), emissiveStrength: 1.6 });
      this.group.add(box(c.x, c.x + c.w, c.h0, c.h, -40, -20, cab));
      this.lamps.push({ x: c.x + c.w / 2, y: c.h0 + 18, z: -14, range: 110, color: C.windowLight, power: 0.9, flicker: 0, down: false });
    }
    for (const d of kindOf(OS.decks, 'watch')) det.add(d.x0, d.x1, d.h - 4, d.h, -44, -16, C.ironLight);
    for (const d of kindOf(OS.decks, 'watchRoof')) {
      det.add(d.x0, d.x1, d.h - 4, d.h, -44, -16, C.iron);
      det.add(d.x0 + 30, d.x0 + 44, d.h, d.h + 10, -34, -24, C.chromeDark);
      this.lamps.push({ x: d.x0 + 37, y: d.h + 6, z: -10, range: 200, color: C.beam, power: 1.5, flicker: 0, down: false });
    }
    // 초소 (창에 불), 모래주머니 벽
    for (const b of kindOf(OS.blocks, 'booth')) {
      const tex = litMaterial(pixelTexture(paintCabin(b.x1 - b.x0, b.h)), { emissive: pixelTexture(paintCabinGlow(b.x1 - b.x0, b.h)), emissiveStrength: 1.5 });
      this.group.add(box(b.x0, b.x1, 0, b.h, -50, -6, tex));
      det.add(b.x0 - 3, b.x1 + 3, b.h - 3, b.h, -53, -3, C.iron);
      this.lamps.push({ x: (b.x0 + b.x1) / 2, y: b.h - 16, z: -2, range: 90, color: C.windowLight, power: 0.8, flicker: 0, down: false });
    }
    for (const b of kindOf(OS.blocks, 'sandbags')) {
      this.group.add(box(b.x0, b.x1, 0, b.h, -40, -6, litMaterial(pixelTexture(paintSandbags(b.x1 - b.x0, b.h)))));
    }
  }

  /** 이번 틱의 빛 후보와 깜빡임 (렌더 전용, 틱만 보고 정한다) */
  update(tick: number, view0: number, view1: number): void {
    for (const [i, l] of this.lamps.entries()) {
      if (l.x < view0 - l.range || l.x > view1 + l.range) continue;
      let p = l.power;
      if (l.flicker > 0) p *= 0.75 + 0.25 * hash((tick >> 2) * 13 + i * l.flicker);
      if (l.flicker < 0) p *= ((tick >> 5) + i) % 2 ? 1 : 0.15;
      lightPool.add(l.x, l.y, l.z, l.range, l.color, p, l.down);
    }
    const on = (tick >> 5) % 2 === 0;
    for (const [i, m] of this.beacons.entries()) m.uniforms.emissiveStrength.value = (on ? i % 2 === 0 : i % 2 === 1) ? 3 : 0.3;
  }
}

/** 통로·작업대 난간 (윗면 h, 앞 깊이 z) */
function rail(det: Details, x0: number, x1: number, h: number, z: number): void {
  det.add(x0, x1, h + 13, h + 14, z - 1, z, C.ironLight);
  det.add(x0, x1, h + 6, h + 7, z - 1, z, C.iron);
  for (let x = x0; x < x1; x += 14) det.add(x, x + 1, h, h + 14, z - 1, z, C.iron);
}

/** 깜빡이는 붉은 경고등 */
function beaconMaterial(): THREE.ShaderMaterial {
  const t = pixelTexture(solid(C.neonRed));
  return litMaterial(t, { emissive: t, emissiveStrength: 3 });
}

function solid(color: string): HTMLCanvasElement {
  const [c, g] = canvas(2, 2);
  rect(g, 0, 0, 2, 2, color);
  return c;
}

// ---------------------------------------------------------------- 그림 (도트 텍스처)
/** 제철소 벽돌 몸통: 높은 아치창(몇 개는 용광로 불빛), 큰 철문, 굴뚝 그을음 */
function paintFactory(w: number, h: number, seed: number, end: boolean): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  brickWall(g, 0, 0, w, h, seed, 2);
  for (let x = 12; x < w - 30; x += 46) {
    const top = end ? 120 : 70;
    rect(g, x, h - top - 90, 24, 90, C.windowDark);
    rect(g, x + 2, h - top - 96, 20, 6, C.windowDark);
    for (let y = h - top - 88; y < h - top - 2; y += 10) rect(g, x, y, 24, 1, C.iron);
    rect(g, x + 11, h - top - 92, 2, 92, C.iron);
    rect(g, x - 2, h - top, 28, 3, C.stoneDark);
  }
  // 큰 철문
  const dx = Math.floor(w * (end ? 0.55 : 0.4));
  rect(g, dx, h - 72, 60, 72, C.iron);
  for (let y = h - 70; y < h; y += 4) rect(g, dx + 2, y, 56, 1, C.ironLight);
  rect(g, dx, h - 76, 60, 4, C.stoneDark);
  if (end) {
    rect(g, 20, 40, 120, 22, C.posterRedDark);
    neonText(g, null, 'STEEL', 30, 44, 3, C.paintCream, C.paintCream);
  }
  weather(g, 0, 0, w, h, seed);
  return c;
}

/** 제철소 창 몇 개가 용광로 불빛으로 붉게 빛난다 (발광) */
function paintFactoryGlow(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  let i = 0;
  for (let x = 12; x < w - 30; x += 46, i++) {
    if (hash(seed * 7 + i) < 0.45) continue;
    const top = h > 300 ? 120 : 70;
    for (let y = h - top - 88; y < h - top - 2; y += 10) ditherRect(g, x + 1, y + 1, 22, 8, hash(seed + i + y) < 0.5 ? C.fxOrange : C.fxFlame, 10);
  }
  return c;
}

/** 용광로 굴뚝: 내화 벽돌, 쇠띠, 위로 갈수록 그을음 */
function paintStack(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  brickWall(g, 0, 0, w, h, seed, 1);
  for (let y = 12; y < h; y += 34) rect(g, 0, y, w, 3, C.iron);
  for (let k = 0; k < 6; k++) ditherRect(g, 0, k * 10, w, 10, C.smog0, 12 - k * 2);
  return c;
}

/** 리벳 강판: 판 이음, 리벳 줄, 녹 흘러내림 */
function paintSteel(w: number, h: number, color: string, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, color);
  ditherRect(g, 0, 0, w, h, C.iron, 5);
  for (let x = 0; x < w; x += 24) rect(g, x, 0, 1, h, C.iron);
  for (let y = 0; y < h; y += 20) rect(g, 0, y, w, 1, C.iron);
  for (let x = 3; x < w; x += 6) for (let y = 3; y < h; y += 20) rect(g, x, y, 1, 1, C.ironLight);
  for (let k = 0; k < Math.floor(w / 10); k++) {
    const x = Math.floor(hash(seed * 31 + k) * w);
    const y = Math.floor(hash(seed * 17 + k) * h);
    rect(g, x, y, 1, 4 + Math.floor(hash(seed + k) * 14), C.rust);
  }
  return c;
}

/** 콘크리트 턱: 판 이음, 얼룩, 모서리 깨짐 */
function paintConcrete(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.stoneDark);
  ditherRect(g, 0, 0, w, h, C.stone, 4);
  for (let x = 0; x < w; x += 30) rect(g, x, 0, 1, h, C.smog2);
  for (let k = 0; k < Math.floor(w / 12); k++) ditherRect(g, Math.floor(hash(seed + k) * w), Math.floor(hash(seed * 3 + k) * h), 6, 3, C.smog1, 8);
  rect(g, 0, 0, w, 1, C.stone);
  return c;
}

/** 화물선: 검은 선체, 붉은 흘수선, 선교와 굴뚝, 둥근 창 */
function paintShip(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const deck = h - 64;
  for (let y = deck; y < h; y++) {
    const inset = Math.floor(Math.max(0, (y - deck - 40) * 0.8));
    rect(g, inset, y, w - inset * 2, 1, y > h - 12 ? C.posterRedDark : C.smog0);
  }
  rect(g, 0, deck, w, 2, C.smog2);
  rect(g, w - 170, deck - 60, 110, 60, C.smog1);
  rect(g, w - 160, deck - 84, 70, 24, C.smog1);
  rect(g, w - 130, deck - 120, 20, 36, C.posterRedDark);
  for (let x = 40; x < w - 200; x += 70) {
    rect(g, x, deck - 40, 50, 40, [C.rust, C.paintTeal, C.paintOchre][(x / 70) % 3 | 0]);
    for (let k = 0; k < 50; k += 4) rect(g, x + k, deck - 40, 1, 40, C.iron);
  }
  rect(g, w - 60, deck - 30, 2, 30, C.iron);
  return c;
}

function paintShipGlow(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const deck = h - 64;
  for (let x = w - 160; x < w - 70; x += 12) if (hash(x) < 0.6) rect(g, x, deck - 50, 6, 4, C.windowLight);
  for (let x = 30; x < w - 40; x += 26) if (hash(x * 3) < 0.35) rect(g, x, deck + 14, 2, 2, C.windowLight);
  rect(g, w - 122, deck - 124, 2, 2, C.neonRed);
  return c;
}

/** 골함석 창고: 세로 골, 큰 셔터, 'WAREHOUSE 7' 페인트 글씨 */
function paintWarehouse(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.paintTeal);
  for (let x = 0; x < w; x += 3) rect(g, x, 0, 1, h, C.smog2);
  ditherRect(g, 0, 0, w, h, C.smog1, 6);
  for (const dx of [30, 140]) {
    rect(g, dx, h - 96, 80, 96, C.iron);
    for (let y = h - 94; y < h; y += 3) rect(g, dx + 2, y, 76, 1, C.ironLight);
  }
  rect(g, 20, 24, 210, 22, C.smog1);
  neonText(g, null, 'WAREHOUSE 7', 26, 28, 3, C.paintCream, C.paintCream);
  weather(g, 0, 0, w, h, 91);
  return c;
}

function paintWarehouseGlow(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  // 반쯤 열린 셔터 아래로 새는 불빛
  rect(g, 142, h - 10, 76, 10, C.sodium);
  ditherRect(g, 142, h - 22, 76, 12, C.sodium, 6);
  return c;
}

/** 선로 아래 가게들: 벽돌 2층, 쇼윈도와 간판 (PAWN·JAZZ·LIQUOR·SHOES) */
function paintShops(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  brickWall(g, 0, 0, w, h, 97, 0);
  const names = ['PAWN', 'JAZZ', 'LIQUOR', 'SHOES', 'BARBER', 'CAFE'];
  for (let i = 0, x = 10; x < w - 100; i++, x += 128) {
    rect(g, x, h - 70, 100, 62, C.windowDark);
    rect(g, x, h - 82, 100, 12, C.smog1);
    neonText(g, null, names[i % names.length], x + 6, h - 80, 2, C.paintCream, C.paintCream);
    for (let k = 0; k < 4; k++) rect(g, x + 8 + k * 24, h - 140, 14, 22, C.windowDark);
  }
  weather(g, 0, 0, w, h, 97);
  return c;
}

function paintShopsGlow(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const names = ['PAWN', 'JAZZ', 'LIQUOR', 'SHOES', 'BARBER', 'CAFE'];
  const colors = [C.neonAmber, C.neonCyan, C.neonPink, C.windowLight, C.neonGreen, C.neonAmber];
  for (let i = 0, x = 10; x < w - 100; i++, x += 128) {
    if (i % 3 !== 2) ditherRect(g, x + 2, h - 66, 96, 56, C.windowLight, 5);
    neonText(g, null, names[i % names.length], x + 6, h - 80, 2, colors[i % colors.length], colors[i % colors.length]);
    for (let k = 0; k < 4; k++) if (hash(i * 7 + k) < 0.35) rect(g, x + 9 + k * 24, h - 139, 12, 20, C.windowLight);
  }
  return c;
}

/** 성벽: 큰 콘크리트 판, 판 이음과 철근 녹물, 노랑·검정 경고 띠, 'DISTRICT 1' 스텐실, 닫힌 철문 */
function paintWall(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.stoneDark);
  ditherRect(g, 0, 0, w, h, C.stone, 3);
  for (let y = 0; y < h; y += 60) rect(g, 0, y, w, 1, C.smog2);
  for (let x = 0; x < w; x += 48) rect(g, x, 0, 1, h, C.smog2);
  for (let k = 0; k < 40; k++) rect(g, Math.floor(hash(k * 13) * w), Math.floor(hash(k * 7) * h), 1, 6 + Math.floor(hash(k) * 30), C.rust);
  for (let x = 0; x < w; x += 16) {
    rect(g, x, h - 40, 8, 10, C.paintOchre);
    rect(g, x + 8, h - 40, 8, 10, C.smog0);
  }
  neonText(g, null, 'DISTRICT 1', 30, h - 236, 4, C.paintCream, C.paintCream);
  rect(g, 0, h - 140, 90, 100, C.iron);
  for (let y = h - 138; y < h - 40; y += 6) rect(g, 2, y, 86, 1, C.ironLight);
  weather(g, 0, 0, w, h, 113);
  return c;
}

function paintWallGlow(w: number, h: number): HTMLCanvasElement {
  const [c] = canvas(w, h);
  return c;
}

/** 막사: 낮은 콘크리트, 창 줄 */
function paintBarracks(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.smog2);
  ditherRect(g, 0, 0, w, h, C.stoneDark, 4);
  for (let x = 12; x < w - 20; x += 30) rect(g, x, 40, 16, 14, C.windowDark);
  rect(g, 0, 0, w, 6, C.smog1);
  weather(g, 0, 0, w, h, 127);
  return c;
}

function paintBarracksGlow(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  for (let x = 12, i = 0; x < w - 20; x += 30, i++) if (hash(i * 11 + 5) < 0.3) rect(g, x + 1, 41, 14, 12, C.windowLight);
  return c;
}

/** 초소·감시탑 오두막: 판자 벽, 큰 창 */
function paintCabin(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.awning);
  for (let y = 0; y < h; y += 4) rect(g, 0, y, w, 1, C.awningStripe);
  rect(g, 6, 8, w - 12, Math.min(16, h - 16), C.windowDark);
  rect(g, 0, 0, w, 2, C.iron);
  return c;
}

function paintCabinGlow(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  ditherRect(g, 7, 9, w - 14, Math.min(14, h - 18), C.windowLight, 10);
  return c;
}

/** 모래주머니 벽: 엇갈려 쌓은 둥근 자루 */
function paintSandbags(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.sandbag);
  for (let row = 0, y = 0; y < h; row++, y += 6) {
    for (let x = row % 2 ? -6 : 0; x < w; x += 12) {
      rect(g, x + 1, y + 5, 10, 1, C.smog2);
      rect(g, x, y, 1, 6, C.smog2);
    }
  }
  ditherRect(g, 0, 0, w, h, C.smog1, 5);
  return c;
}
