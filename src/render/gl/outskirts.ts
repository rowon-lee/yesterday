import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { MAP_ENDS } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, ditherRect, hash, rect } from '../dither';
import { drawText, textWidth } from '../font';
import { paintContainer } from './edges';
import { Beam, Sparks } from './fx';
import { scaleAt } from './core';
import { box, Details, facedBox, plane } from './kit';
import { lightPool } from './lights';
import { FLUO, figure, glowRect, PINK, roomWall, sil, TV, WARM, type RoomLamp, type RoomRamp } from './rooms';
import { litMaterial, pixelTexture } from './shaders';
import { star } from './backdrops';
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
  private train!: THREE.Mesh;
  private trainMats: THREE.ShaderMaterial[] = [];
  private readonly sparks = new Sparks(48);
  /** 서치라이트: 빛줄기, 받침 자리, 위상, 훑는 폭(라디안) */
  private readonly searchlights: Array<{ beam: Beam; x: number; y: number; phase: number; sweep: number }> = [];

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
    // 선로 아래 가게들 (벽돌 2층): 불 켜진 쇼윈도 안 (전당포·재즈 바·주류점·구두 수선·이발소·카페), 간판, 위층 창
    const sh = paintUnderShops(SHOPS_W, 170);
    const shops = litMaterial(pixelTexture(sh.map), { emissive: pixelTexture(sh.glow), emissiveStrength: 1.1 });
    this.group.add(plane(SHOPS_X0, SHOPS_X0 + SHOPS_W, 0, 170, -70, shops));
    // 쇼윈도 불빛이 젖은 길로 쏟아진다 (가게마다 실내 색)
    UNDER_SHOPS.forEach((u, i) => {
      const x = SHOPS_X0 + 6 + i * 126 + 43;
      this.lamps.push({ x, y: 30, z: -40, range: 90, color: u.light, power: u.key === 'jazz' ? 0.9 : 0.55, flicker: 0, down: false });
    });
    // 고가 열차 (선로 위를 오가며, 창 불빛과 바퀴 불꽃, 선로 밑으로 새는 빛)
    const track = kindOf(OS.decks, 'rail')[0];
    this.trainMats = [1, -1].map((dir) => {
      const t = paintElTrain(dir);
      return litMaterial(pixelTexture(t.map), { emissive: pixelTexture(t.glow), emissiveStrength: 1, clip: [track.x0 - 60, track.x1 + 60], side: THREE.DoubleSide });
    });
    this.train = plane(0, TRAIN.length, 0, TRAIN.height, 0, this.trainMats[0]);
    this.train.visible = false;
    this.group.add(this.train, this.sparks.mesh);
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
    const R = MAP_ENDS.right;
    // 1) 높이 50m(약 1,500px)의 1구역 성벽: 검문소 뒤로 길게 서 있고 동쪽 끝에서 길을 막는다. 꼭대기는 화면 위로 보이지 않는다.
    //    거푸집 이음·폼타이 구멍과 녹물, 벽 속 회랑의 좁은 창, 거대한 스텐실 글씨, 위에서 늘어진 붉은 깃발, 큰 철문
    const sk = scaleAt(WALL.z);
    const face = paintColossalWall(WALL.x0, R + 380 - WALL.x0, WALL.h, sk, true);
    const concrete = litMaterial(pixelTexture(face.map), { emissive: pixelTexture(face.glow), emissiveStrength: 1.2, wet: 0.45, bump: 0.6 });
    const dark = litMaterial(pixelTexture(solid('#1d1f26')), { tint: 0.8 });
    this.group.add(facedBox(WALL.x0, R + 380, 0, WALL.h, WALL.z - 90, WALL.z, { pz: concrete, nx: dark, py: dark }));
    // 동쪽 끝 (맵 끝 벽): 같은 성벽이 길을 가로질러 앞으로 꺾여 나온 모서리
    const endFace = paintColossalWall(R, 380, WALL.h, scaleAt(6), false);
    const endMat = litMaterial(pixelTexture(endFace.map), { emissive: pixelTexture(endFace.glow), emissiveStrength: 1.2, wet: 0.45, bump: 0.6 });
    this.group.add(facedBox(R, R + 380, 0, WALL.h, WALL.z, 6, { pz: endMat, nx: endMat, py: dark }));
    for (const y of [120, 260, 400]) {
      const m = beaconMaterial();
      this.beacons.push(m);
      this.group.add(box(R - 4, R + 2, y, y + 4, 2, 8, m));
      this.lamps.push({ x: R - 4, y: y + 2, z: 10, range: 70, color: C.neonRed, power: 0.9, flicker: -1, down: false });
    }
    // 서쪽 끝 모서리 보루 (앞으로 튀어나온 거대한 기둥, 좁은 총안 창)
    const bastion = paintColossalWall(WALL.x0 - 80, 90, WALL.h, scaleAt(WALL.z + 40), false);
    const bMat = litMaterial(pixelTexture(bastion.map), { emissive: pixelTexture(bastion.glow), emissiveStrength: 1.2, wet: 0.45, bump: 0.6 });
    this.group.add(facedBox(WALL.x0 - 80, WALL.x0 + 10, 0, WALL.h, WALL.z - 60, WALL.z + 40, { pz: bMat, nx: dark, px: dark, py: dark }));
    // 버팀벽 (벽에서 튀어나온 콘크리트 기둥)과 그 위 나트륨 투광등 (벽 아래쪽만 따뜻하게 비춘다)
    for (const x of WALL.buttress) {
      const bt = litMaterial(pixelTexture(paintButtress(36, WALL.h, x)), { wet: 0.45, bump: 0.6 });
      this.group.add(facedBox(x, x + 36, 0, WALL.h, WALL.z - 2, WALL.z + 24, { pz: bt, nx: dark, px: dark }));
      // 버팀벽 발치에서 위로 쏘는 차가운 투광등 (벽면을 세로로 쓸어 올리는 빛)
      det.add(x + 8, x + 28, 0, 8, WALL.z + 26, WALL.z + 40, C.iron);
      det.add(x + 10, x + 26, 8, 9, WALL.z + 28, WALL.z + 38, C.skyLight);
      this.lamps.push({ x: x + 18, y: 14, z: WALL.z + 36, range: 300, color: '#c4d6e6', power: 0.95, flicker: 0, down: false });
      const wash = new Beam(520, 30, '#c4d6e6', 0.05, 2);
      wash.pivot.position.set(x + 18, 8, WALL.z + 34);
      this.group.add(wash.pivot);
    }
    // 철문 위 경고등과 문 앞 투광등
    this.lamps.push({ x: (WALL.gate[0] + WALL.gate[1]) / 2, y: 250, z: WALL.z + 40, range: 220, color: C.sodium, power: 1.2, flicker: 0, down: true });
    // 2) 성벽 꼭대기(화면 위)에서 내리쬐는 서치라이트: 거리와 벽을 천천히 훑는다
    for (const s of WALL.searchlights) {
      const b = new Beam(980, 78, C.beam, 0.15, 2);
      b.pivot.position.set(s.x, s.y, WALL.z + 40);
      this.group.add(b.pivot);
      this.searchlights.push({ beam: b, x: s.x, y: s.y, phase: s.phase, sweep: s.sweep });
    }
    // 3) 성벽 아래 막사 (낮은 2층 콘크리트, 불 켜진 창 몇 개)
    const bw = WALL.barracks[1] - WALL.barracks[0];
    const br = paintBarracks(bw, 96, scaleAt(-150));
    const barracks = litMaterial(pixelTexture(br.map), { emissive: pixelTexture(br.glow), emissiveStrength: 1.1 });
    this.group.add(facedBox(WALL.barracks[0], WALL.barracks[1], 0, 96, -170, -150, { pz: barracks, py: dark, px: dark, nx: dark }));
    det.add(WALL.barracks[0] - 4, WALL.barracks[1] + 4, 96, 100, -172, -148, C.smog1);
    // 감시탑: 다리 둘과 가새, 초소 (불 켜진 창 안의 경비), 지붕 위 서치라이트
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
      const cab = paintCabin(c.w, c.h - c.h0, 41);
      this.group.add(box(c.x, c.x + c.w, c.h0, c.h, -40, -20, litMaterial(pixelTexture(cab.map), { emissive: pixelTexture(cab.glow), emissiveStrength: 1.2 })));
      this.lamps.push({ x: c.x + c.w / 2, y: c.h0 + 18, z: -14, range: 110, color: C.windowLight, power: 0.8, flicker: 0, down: false });
    }
    for (const d of kindOf(OS.decks, 'watch')) det.add(d.x0, d.x1, d.h - 4, d.h, -44, -16, C.ironLight);
    for (const d of kindOf(OS.decks, 'watchRoof')) {
      det.add(d.x0, d.x1, d.h - 4, d.h, -44, -16, C.iron);
      det.add(d.x0 + 30, d.x0 + 44, d.h, d.h + 10, -34, -24, C.chromeDark);
      const b = new Beam(330, 44, C.beam, 0.2, 2);
      b.pivot.position.set(d.x0 + 37, d.h + 8, -29);
      this.group.add(b.pivot);
      this.searchlights.push({ beam: b, x: d.x0 + 37, y: d.h + 8, phase: 2.1, sweep: 0.55 });
    }
    // 초소 (불 켜진 창 안의 경비), 차단기 (빨강·하양 줄 막대), 모래주머니 벽
    for (const b of kindOf(OS.blocks, 'booth')) {
      const cab = paintCabin(b.x1 - b.x0, b.h, 53);
      this.group.add(box(b.x0, b.x1, 0, b.h, -50, -6, litMaterial(pixelTexture(cab.map), { emissive: pixelTexture(cab.glow), emissiveStrength: 1.2 })));
      det.add(b.x0 - 3, b.x1 + 3, b.h - 3, b.h, -53, -3, C.iron);
      this.lamps.push({ x: (b.x0 + b.x1) / 2, y: b.h - 16, z: -2, range: 90, color: C.windowLight, power: 0.8, flicker: 0, down: false });
      det.add(b.x1 + 2, b.x1 + 8, 0, 30, -60, -54, C.iron);
      for (let k = 0; k < 10; k++) det.add(b.x1 + 8 + k * 9, b.x1 + 17 + k * 9, 26, 30, -58, -56, k % 2 ? C.white : C.neonRedDark);
    }
    for (const b of kindOf(OS.blocks, 'sandbags')) {
      this.group.add(box(b.x0, b.x1, 0, b.h, -40, -6, litMaterial(pixelTexture(paintSandbags(b.x1 - b.x0, b.h)))));
    }
    // 길 위 콘크리트 방벽과 대전차 장애물 (성벽 아래 어둠 속 실루엣)
    for (const x of [5660, 5740, 6020]) {
      det.add(x, x + 40, 0, 16, -96, -84, C.stoneDark);
      det.add(x + 4, x + 36, 16, 22, -94, -86, C.stoneDark);
    }
    for (const x of [5800, 5830, 6110]) {
      det.bar(x, 0, x + 16, 18, 3, -120, -116, C.ironLight);
      det.bar(x + 16, 0, x, 18, 3, -118, -114, C.ironLight);
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
    this.updateTrain(tick, view0, view1);
    // 서치라이트: 아래로 비추며 천천히 좌우로 훑는다. 빛이 닿는 바닥에 밝은 웅덩이
    for (const [i, s] of this.searchlights.entries()) {
      const d = s.sweep * Math.sin(tick * 0.0085 + s.phase) + 0.12 * Math.sin(tick * 0.023 + i);
      s.beam.aim(Math.PI + d);
      const hx = s.x + s.y * Math.tan(d);
      if (hx > view0 - 160 && hx < view1 + 160) lightPool.add(hx, 8, -24, 150, C.beam, 1.25);
      // 성벽 앞을 지나는 빛줄기는 벽면 중턱도 밝힌다
      if (s.y > 400) {
        const wx = s.x + (s.y - 260) * Math.tan(d);
        if (wx > view0 - 120 && wx < view1 + 120) lightPool.add(wx, 260, WALL.z + 50, 170, C.beam, 0.8);
      }
    }
  }

  /** 고가 열차: 틱만 보고 자리를 정한다 (trainAt). 창 불빛, 선로 밑으로 깜빡이며 새는 빛, 바퀴 불꽃 */
  private updateTrain(tick: number, view0: number, view1: number): void {
    this.sparks.begin();
    const at = trainAt(tick);
    const rail = kindOf(OS.decks, 'rail')[0];
    this.train.visible = !!at && at.x < view1 + 40 && at.x + TRAIN.length > view0 - 40;
    if (at && this.train.visible) {
      this.train.material = this.trainMats[at.dir > 0 ? 0 : 1];
      this.train.position.set(at.x + TRAIN.length / 2, rail.h + 4 + TRAIN.height / 2, TRAIN.z);
      const lo = Math.max(at.x, rail.x0 - 60);
      const hi = Math.min(at.x + TRAIN.length, rail.x1 + 60);
      for (let x = lo + 50; x < hi - 20; x += 130) {
        // 창 불빛 (선로 위)과 침목 틈으로 새는 빛 (선로 밑, 침목이 지나갈 때마다 깜빡인다)
        lightPool.add(x, rail.h + 26, -6, 120, '#b0f0c8', 0.7);
        const strobe = 0.35 + 0.65 * hash(((tick + Math.floor(x / 7)) >> 1) * 7 + 3);
        lightPool.add(x, rail.h - 20, -12, 120, '#d8fff0', 0.55 * strobe, true);
      }
      // 바퀴 불꽃: 대차마다 가끔 번쩍이며 아래로 튄다
      for (let c = 0; c < TRAIN.cars; c++) {
        for (const bx of [12, TRAIN.car - 20]) {
          const wx = at.x + c * (TRAIN.car + TRAIN.gap) + bx;
          if (wx < lo || wx > hi) continue;
          const r = hash(tick * 3 + c * 17 + bx);
          if (r > 0.16) continue;
          for (let k = 0; k < 6; k++) {
            const a = hash(tick * 5 + k * 13 + c);
            this.sparks.add(wx + (a - 0.5) * 10 - at.dir * k * 1.5, rail.h + 2 - k * 2 - a * 3, -10, k < 2 ? C.lampCore : C.skyLight, 2.4);
          }
          lightPool.add(wx, rail.h + 4, -8, 90, '#c8f6ff', 1.3);
        }
      }
    }
    this.sparks.end();
  }
}

/**
 * 1구역 성벽 (렌더 전용): 높이 50m ≈ 1,500px (2026-11-01 사용자 결정). 카메라가 가장 높이 올라가도 이 깊이에서 약 550px까지만 보이므로
 * 상자와 앞면 그림은 h(640)까지만 만든다 (꼭대기는 언제나 화면 위). 서치라이트 받침도 화면 위에 둔다.
 * x0: 서쪽 끝 (보루), z: 앞면 깊이, gate: 철문 x 범위, buttress: 버팀벽 x, barracks: 막사 x 범위, searchlights: 꼭대기 쪽 서치라이트 받침
 */
const WALL = {
  x0: 5560, z: -190, h: 640, gate: [6168, 6330] as const, buttress: [5644, 5960, 6118] as const, barracks: [5600, 5860] as const,
  searchlights: [{ x: 5790, y: 760, phase: 0, sweep: 0.42 }, { x: 6160, y: 760, phase: 2.6, sweep: 0.38 }],
};

/** 고가 열차 규격 (렌더 전용): 칸 넷, 칸 길이·사이, 높이, 깊이(선로 둘 사이), 주기와 속도 */
const TRAIN = { cars: 4, car: 108, gap: 4, height: 50, z: -33, period: 1500, speed: 4.5, length: 4 * 108 + 3 * 4 };

/** 이 틱의 열차 자리 (왼쪽 끝 x)와 방향. 주기마다 방향을 바꿔 한 번 지나간다. 없으면 null */
export function trainAt(tick: number): { x: number; dir: number } | null {
  const rail = kindOf(OS.decks, 'rail')[0];
  const x0 = rail.x0 - 60;
  const x1 = rail.x1 + 60;
  const cycle = Math.floor(tick / TRAIN.period);
  const t = tick - cycle * TRAIN.period - 200;
  const travel = (x1 - x0 + TRAIN.length) / TRAIN.speed;
  if (t < 0 || t >= travel) return null;
  const dir = cycle % 2 ? -1 : 1;
  const d = t * TRAIN.speed;
  return { x: dir > 0 ? x0 - TRAIN.length + d : x1 - d, dir };
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

/** 선로 아래 가게 판 자리 (월드 x, 폭) */
const SHOPS_X0 = 4820;
const SHOPS_W = 760;

/** 선로 아래 가게 (왼쪽부터): 간판 글자, 실내 색, 길로 쏟아지는 빛 색, 간판(주인공 하나만 밝게, 나머지는 어둡거나 꺼짐), 네온관 색, 차양 */
const UNDER_SHOPS: ReadonlyArray<{
  key: string; name: string; ramp: RoomRamp; light: string; sign: 'hero' | 'dim' | 'off'; tube: string; tubeDark: string; awning: string | null;
}> = [
  { key: 'pawn', name: 'PAWN', ramp: WARM, light: C.windowLight, sign: 'off', tube: C.neonAmber, tubeDark: C.neonAmberDark, awning: C.rust },
  { key: 'jazz', name: 'JAZZ', ramp: PINK, light: C.neonPink, sign: 'hero', tube: C.neonCyan, tubeDark: C.neonCyanDark, awning: null },
  { key: 'liquor', name: 'LIQUOR', ramp: FLUO, light: '#b0f0c8', sign: 'dim', tube: C.neonPink, tubeDark: C.neonPinkDark, awning: null },
  { key: 'shoes', name: 'SHOES', ramp: WARM, light: C.lampWarm, sign: 'off', tube: C.windowLight, tubeDark: C.neonAmberDark, awning: C.paintTeal },
  { key: 'barber', name: 'BARBER', ramp: FLUO, light: '#b0f0c8', sign: 'off', tube: C.neonGreen, tubeDark: C.neonGreenDark, awning: null },
  { key: 'cafe', name: 'CAFE', ramp: WARM, light: C.windowLight, sign: 'dim', tube: C.neonAmber, tubeDark: C.neonAmberDark, awning: C.posterRed },
];

/** 어둡게 켜진 네온관의 발광 색 */
const DIM: Record<string, string> = {
  [C.neonPink]: '#8a2066', [C.neonAmber]: '#ad5a20', [C.neonGreen]: '#246e52', [C.neonCyan]: '#1f7896', [C.windowLight]: '#844018',
};

/** 가게 안 밝기 바탕과 등 (쇼윈도 칸 좌표 wx, wy, 폭 ww, 높이 wh) */
function shopLight(key: string, wx: number, wy: number, ww: number, wh: number): { base: number; lamps: RoomLamp[] } {
  switch (key) {
    case 'pawn': return { base: 0.2, lamps: [[wx + 20, wy + 6, 26, 40, 0.6], [wx + 60, wy + 6, 26, 40, 0.5]] };
    case 'jazz': return { base: 0.2, lamps: [[wx + 62, wy + 6, 20, 54, 0.95], [wx + 24, wy + wh - 14, 36, 14, 0.5]] };
    case 'liquor': return { base: 0.42, lamps: [[wx + ww / 2, wy + 2, 56, 26, 0.55]] };
    case 'shoes': return { base: 0.1, lamps: [[wx + 30, wy + wh - 22, 24, 18, 0.85]] };
    case 'barber': return { base: 0.32, lamps: [[wx + ww / 2, wy + 2, 50, 30, 0.6]] };
    default: return { base: 0.3, lamps: [[wx + 20, wy + 14, 22, 26, 0.7], [wx + 58, wy + 14, 22, 26, 0.7]] };
  }
}

/** 쇼윈도 안 실루엣: 가게마다 다른 살림과 사람 (발 높이 = 쇼윈도 아래 끝) */
function furnish(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, key: string, wx: number, wy: number, ww: number, wh: number, seed: number): void {
  const foot = wy + wh;
  const counter = (x: number, w: number, hh: number, top: string, topGlow: string, color = '#231812') => {
    sil(g, e, x, foot - hh, w, hh, color);
    glowRect(g, e, x, foot - hh - 1, w, 1, top, topGlow);
  };
  if (key === 'pawn') {
    // 걸어 둔 기타 넷, 선반 위 라디오, 계산대 뒤 중절모 주인
    for (let k = 0; k < 4; k++) {
      const gx = wx + 6 + k * 9;
      sil(g, e, gx + 2, wy + 3, 1, 11);
      sil(g, e, gx, wy + 14, 5, 7);
      sil(g, e, gx + 1, wy + 13, 3, 9);
    }
    sil(g, e, wx + 4, foot - 26, 12, 7);
    figure(g, e, wx + 58, foot - 2, 44, 'hat');
    counter(wx + 34, ww - 34, 15, C.windowLight, '#844018');
  } else if (key === 'jazz') {
    // 뒤 선반의 빛나는 술병, 바 의자에 앉은 손님 둘, 조명 아래 색소폰 연주자
    for (let x = wx + 2; x < wx + 40; x += 4) glowRect(g, e, x, wy + 14 + (x % 3), 2, 5, '#a066a8', '#8a2066');
    sil(g, e, wx + 1, wy + 20, 40, 1, C.ironLight);
    counter(wx, 42, 14, '#df45a7', '#b42d86', '#26091c');
    for (const x of [wx + 8, wx + 28]) figure(g, e, x, foot, 40, 'sit');
    figure(g, e, wx + 62, foot, 44, 'bare');
    sil(g, e, wx + 64, foot - 31, 2, 12);
    sil(g, e, wx + 64, foot - 21, 5, 3);
  } else if (key === 'liquor') {
    // 선반 세 줄의 술병 (몇 병은 호박색으로 반짝), 계산원
    for (const row of [wy + 8, wy + 20, wy + 32]) {
      for (let x = wx + 3; x < wx + ww - 22; x += 3) {
        if (hash(seed + x * 7 + row) < 0.2) continue;
        const bh = 4 + Math.floor(hash(seed + x + row * 3) * 4);
        sil(g, e, x, row + 8 - bh, 2, bh);
        if (hash(x * 11 + row) < 0.3) glowRect(g, e, x, row + 8 - bh + 1, 1, 2, '#ad5a20', '#5e2c12');
      }
      sil(g, e, wx + 2, row + 8, ww - 22, 1, C.ironLight);
    }
    figure(g, e, wx + ww - 10, foot, 44, 'bare');
  } else if (key === 'shoes') {
    // 탁상등 아래 앉은 수선공과 작업대, 뒤 선반의 구두
    for (const row of [wy + 10, wy + 20]) for (let x = wx + 46; x < wx + ww - 4; x += 7) sil(g, e, x, row, 5, 3);
    figure(g, e, wx + 26, foot, 40, 'sit');
    counter(wx + 8, 40, 12, C.windowLit, '#5e2c12');
    sil(g, e, wx + 30, foot - 22, 1, 10);
    glowRect(g, e, wx + 27, foot - 24, 6, 3, C.lampCore, '#ffc070');
  } else if (key === 'barber') {
    // 뒷벽 큰 거울, 의자에 앉은 손님과 서 있는 이발사
    rect(g, wx + 6, wy + 6, ww - 12, 22, C.glassEdge);
    glowRect(g, e, wx + 6, wy + 6, ww - 12, 1, '#c9f7f5', '#55c8cc');
    for (const x of [wx + 16, wx + 50]) {
      figure(g, e, x, foot - 6, 38, 'sit');
      sil(g, e, x - 4, foot - 8, 12, 8);
      sil(g, e, x + 1, foot - 8, 2, 8);
    }
    figure(g, e, wx + 34, foot, 46, 'bare');
  } else {
    // 펜던트 등 둘, 계산대 뒤 종업원, 앞 의자에 앉은 손님 둘
    for (const x of [wx + 18, wx + 56]) {
      sil(g, e, x + 2, wy, 1, 9);
      glowRect(g, e, x, wy + 9, 5, 3, C.lampCore, '#ffc070');
    }
    figure(g, e, wx + 38, foot - 2, 44, 'bare');
    counter(wx, ww, 13, C.windowLight, '#844018');
    for (const x of [wx + 14, wx + 54]) figure(g, e, x, foot, 40, 'sit');
  }
}

/** 줄무늬 천 차양 (위 쇠틀, 아래 물결 끝) */
function awning(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  rect(g, x, y, w, h, color);
  for (let i = 0; i < w; i += 8) rect(g, x + i, y, 4, h, C.paintCream);
  for (let i = 0; i < w; i += 8) {
    rect(g, x + i + 1, y + h, 6, 2, color);
    rect(g, x + i + 2, y + h, 2, 2, C.paintCream);
  }
  rect(g, x, y, w, 1, C.iron);
}

/** 위층 창: 돌 인방과 창턱, 켜진 방(커튼 그림자나 사람)·텔레비전 방·꺼진 창 */
function upstairs(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): 'lit' | 'tv' | 'dark' {
  rect(g, x - 2, y - 3, w + 4, 3, C.stoneDark);
  rect(g, x - 2, y + h, w + 4, 2, C.stone);
  const r = hash(seed * 13 + 1);
  let kind: 'lit' | 'tv' | 'dark' = 'dark';
  if (r < 0.42) {
    kind = 'lit';
    roomWall(g, e, x, y, w, h, [[x + w * 0.55, y + 5, w * 0.8, h * 0.9, 0.75]], 0.2, WARM, 5);
    if (hash(seed + 3) < 0.5) {
      sil(g, e, x, y, 7, h, '#3e2a1f');
      for (let yy = y; yy < y + h; yy += 3) rect(g, x + 6, yy, 1, 2, '#614231');
    } else {
      const cx = x + Math.round(w * 0.62);
      sil(g, e, cx - 5, y + h - 12, 10, 12);
      sil(g, e, cx - 2, y + h - 18, 5, 6);
    }
  } else if (r < 0.55) {
    kind = 'tv';
    roomWall(g, e, x, y, w, h, [[x + w * 0.3, y + h - 4, w * 0.7, h * 0.7, 0.85]], 0.06, TV, 5);
  } else {
    rect(g, x, y, w, h, C.windowDark);
    rect(g, x + 2, y + 2, 2, h - 8, C.glassEdge);
    rect(g, x + 4, y + 4, 1, h - 14, C.glassEdge);
  }
  sil(g, e, x + Math.floor(w / 2), y, 1, h, C.ironLight);
  sil(g, e, x, y + Math.floor(h / 2), w, 1, C.ironLight);
  return kind;
}

/** 선로 아래 가게들: 벽돌 2층 (1층 가게 여섯, 위층 창), 돌 띠 */
function paintUnderShops(w: number, h: number): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const [map, g] = canvas(w, h);
  const [glow, e] = canvas(w, h);
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  brickWall(g, 0, 0, w, h, 97, 0);
  weather(g, 0, 0, w, h, 97);
  const Y = (hh: number) => h - hh;
  rect(g, 0, Y(90), w, 4, C.stoneDark);
  rect(g, 0, Y(90), w, 1, C.stone);
  UNDER_SHOPS.forEach((u, i) => {
    const x0 = 6 + i * 126;
    const seed = 400 + i * 37;
    // 가게 앞면 (어두운 칠 나무 틀)
    rect(g, x0, Y(86), 120, 86, C.iron);
    rect(g, x0, Y(86), 1, 86, C.ironLight);
    // 쇼윈도: 실내 빛과 실루엣, 가는 창살, 위아래 턱
    const wx = x0 + 4;
    const ww = 80;
    const wy = Y(60);
    const wh = 52;
    const L = shopLight(u.key, wx, wy, ww, wh);
    roomWall(g, e, wx, wy, ww, wh, L.lamps, L.base, u.ramp, 14);
    furnish(g, e, u.key, wx, wy, ww, wh, seed);
    for (const k of [1, 2]) sil(g, e, wx + Math.round((ww * k) / 3), wy, 1, wh, C.ironLight);
    rect(g, wx - 2, wy + wh, ww + 4, 3, C.stoneDark);
    rect(g, wx - 2, wy - 2, ww + 4, 2, C.ironLight);
    // 문: 위는 유리 (가게 안 불빛), 아래는 판과 손잡이
    const dx = x0 + 92;
    rect(g, dx - 2, Y(68), 26, 68, C.ironLight);
    roomWall(g, e, dx, Y(64), 22, 30, [[dx + 11, Y(64) + 4, 18, 28, 0.5]], L.base * 0.7, u.ramp, 6);
    rect(g, dx, Y(34), 22, 34, C.awning);
    rect(g, dx + 2, Y(30), 18, 12, C.awningStripe);
    rect(g, dx + 17, Y(40), 2, 4, C.chrome);
    if (u.key === 'barber') {
      // 이발소 기둥 (빨강·하양·파랑 사선 줄, 위 둥근 등)
      for (let yy = Y(62); yy < Y(26); yy++) for (let xx = 0; xx < 4; xx++) {
        const t = (yy + xx) % 9;
        rect(g, x0 + 86 + xx, yy, 1, 1, t < 3 ? C.neonRed : t < 6 ? C.white : C.fxBlue);
      }
      glowRect(g, e, x0 + 85, Y(66), 6, 4, C.lampCore, '#ffe2a8');
    }
    // 간판 띠와 네온 글자
    rect(g, x0, Y(86), 120, 18, C.smog1);
    rect(g, x0, Y(86), 120, 1, C.ironLight);
    const tx = x0 + Math.round((120 - textWidth(u.name, 2)) / 2);
    if (u.sign === 'off') neonText(g, null, u.name, tx, Y(82), 2, u.tubeDark, u.tubeDark);
    else neonText(g, e, u.name, tx, Y(82), 2, u.sign === 'hero' ? u.tube : DIM[u.tube] ?? u.tube, u.tubeDark);
    if (u.awning) awning(g, x0 + 2, Y(68), 88, 8, u.awning);
    // 위층 창 둘
    upstairs(g, e, x0 + 18, Y(140), 26, 34, seed);
    upstairs(g, e, x0 + 72, Y(140), 26, 34, seed + 5);
  });
  return { map, glow };
}

/**
 * 고가 열차 (칸 넷): 차가운 강철 차체, 형광등 켜진 창과 손잡이를 잡고 선 승객 실루엣, 칸마다 문 둘, 대차와 바퀴,
 * 앞 칸 전조등과 행선판(LOOP), 뒤 칸 붉은 미등. dir: 1이면 오른쪽으로 달린다 (앞이 오른쪽)
 */
function paintElTrain(dir: number): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const L = TRAIN.length;
  const H = TRAIN.height;
  const [map, g] = canvas(L, H);
  const [glow, e] = canvas(L, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, L, H);
  for (let c = 0; c < TRAIN.cars; c++) {
    const x0 = c * (TRAIN.car + TRAIN.gap);
    const W = TRAIN.car;
    rect(g, x0 + 2, 4, W - 4, 4, C.smog2);
    rect(g, x0, 8, W, 34, '#3a3e49');
    rect(g, x0, 8, W, 1, '#7690aa');
    rect(g, x0, 31, W, 2, '#4f5460');
    rect(g, x0, 40, W, 2, C.iron);
    for (let k = 0; k < 8; k++) {
      const wx = x0 + 5 + k * 13;
      const door = k === 1 || k === 6;
      if (door) {
        rect(g, wx - 1, 10, 12, 31, '#2a2d36');
        sil(g, e, wx + 5, 10, 1, 31, C.iron);
      }
      // 창 (형광등): 위 줄이 가장 밝다
      glowRect(g, e, wx, 12, 10, 11, '#93a596', '#338c66');
      glowRect(g, e, wx, 12, 10, 2, '#c9f7f5', '#72cf9c');
      const r = hash(c * 31 + k * 7 + 3);
      if (r < 0.55) {
        const px = wx + 2 + Math.floor(hash(c * 13 + k) * 5);
        sil(g, e, px, 16, 3, 3);
        sil(g, e, px - 2, 19, 7, 4);
        if (r < 0.25) sil(g, e, px + 3, 12, 1, 5);
      }
      sil(g, e, wx - 1, 12, 1, 11, '#2a2d36');
    }
    // 대차와 바퀴
    for (const bx of [8, W - 28]) {
      sil(g, e, x0 + bx, 41, 20, 3, C.iron);
      for (const wx of [bx + 4, bx + 15]) {
        rect(g, x0 + wx - 3, 43, 7, 7, C.iron);
        rect(g, x0 + wx - 1, 45, 3, 3, C.chromeDark);
      }
    }
    if (c < TRAIN.cars - 1) rect(g, x0 + W, 20, TRAIN.gap, 14, C.iron);
  }
  // 앞 칸 (전조등·행선판)과 뒤 칸 (미등)
  const front = dir > 0 ? L - 1 : 0;
  const inward = dir > 0 ? -1 : 1;
  const fx = (dx: number, w: number) => (dir > 0 ? front - dx - w + 1 : front + dx);
  glowRect(g, e, fx(3, 14), 9, 14, 6, C.windowLit, C.neonAmber);
  drawText(g, 'LOOP', fx(4, 13), 10, C.lampGlow, 1);
  drawText(e, 'LOOP', fx(4, 13), 10, C.lampCore, 1);
  for (const dy of [33, 36]) glowRect(g, e, fx(1, 3), dy, 3, 2, C.lampCore, C.lampCore);
  const back = dir > 0 ? 0 : L - 3;
  glowRect(g, e, back, 34, 3, 3, C.neonRed, C.neonRed);
  void inward;
  return { map, glow };
}

/**
 * 50m 성벽 앞면 (월드 x0부터 폭 w, 높이 h; sk = 그 깊이의 배율 → 텍스처 한 칸이 화면 1px):
 * 거푸집 한 단(64px)마다 다른 회색, 이음 줄과 폼타이 구멍, 구멍에서 흘러내린 녹물·때, 신축 이음, 벽 속 회랑의 좁은 창(몇 개만 불),
 * main이면 거대한 스텐실 글씨 'DISTRICT 1', 위에서 늘어진 붉은 깃발 둘, 큰 철문 (빨강·노랑 경고 띠, 사람 드나드는 문)
 */
function paintColossalWall(x0: number, w: number, h: number, sk: number, main: boolean): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const tw = Math.round(w * sk);
  const th = Math.round(h * sk);
  const [map, g] = canvas(tw, th);
  const [glow, e] = canvas(tw, th);
  e.fillStyle = '#000';
  e.fillRect(0, 0, tw, th);
  const X = (x: number) => Math.round((x - x0) * sk);
  const Y = (hh: number) => Math.round(th - hh * sk);
  const seed = Math.round(x0);
  const tones = ['#3a3e49', '#3e424d', '#363a44', '#424652', '#383c47'];
  for (let k = 0, hh = 0; hh < h; k++, hh += 64) {
    rect(g, 0, Y(hh + 64), tw, Y(hh) - Y(hh + 64), tones[Math.floor(hash(seed + k * 7) * tones.length)]);
    // 단마다 조금 다른 반죽 얼룩 (넓게 번진 얼룩, 점무늬 없이 덩어리로)
    for (let m = 0; m < tw / 40; m++) {
      const bx = Math.floor(hash(seed + k * 31 + m) * tw);
      const bw = 10 + Math.floor(hash(seed + k * 17 + m * 3) * 40);
      const by = Y(hh + 64) + Math.floor(hash(seed + k * 5 + m * 11) * 50 * sk);
      rect(g, bx, by, bw, 2 + Math.floor(hash(m + k) * 8), hash(m * 7 + k) < 0.5 ? '#30333d' : '#464a56');
    }
  }
  // 이음 줄 (위 단 밑이 조금 튀어나와 그 아래가 어둡다)과 폼타이 구멍, 구멍에서 흘러내린 자국
  for (let hh = 64; hh < h; hh += 64) {
    rect(g, 0, Y(hh), tw, 1, '#1d1f26');
    rect(g, 0, Y(hh) + 1, tw, 1, '#2a2d36');
    rect(g, 0, Y(hh) - 1, tw, 1, '#4f5460');
    for (const f of [0.33, 0.67]) {
      const yy = Y(hh - 64 * f);
      for (let x = 6; x < tw; x += Math.round(24 * sk)) {
        rect(g, x, yy, 2, 2, '#16171c');
        if (hash(seed + x * 3 + yy) < 0.35) {
          const len = 6 + Math.floor(hash(x + yy * 7) * 40);
          const rust = hash(x * 5 + yy) < 0.4;
          for (let d = 2; d < len; d++) if (hash(seed + x * 13 + d * 7 + yy) < 0.85 - d / len / 1.4) rect(g, x, yy + d, 1, 1, rust ? '#4e3527' : '#2a2d36');
        }
      }
    }
  }
  // 신축 이음 (세로)
  for (let x = Math.round(128 * sk); x < tw; x += Math.round(128 * sk)) {
    rect(g, x, 0, 1, th, '#1d1f26');
    rect(g, x + 1, 0, 1, th, '#4f5460');
  }
  // 땅 가까이 튄 물때와 소금기
  for (let x = 0; x < tw; x++) {
    const top = Math.floor(10 + hash(seed + x * 3) * 12);
    rect(g, x, th - top, 1, top, hash(x * 7) < 0.5 ? '#2a2d36' : '#30333d');
  }
  // 벽 속 회랑의 좁은 창 (가로 줄 셋): 대부분 어둡고 몇 개만 불
  for (const hh of [340, 470, 590]) {
    if (hh > h - 20) continue;
    for (let x = 18; x < tw - 6; x += Math.round(46 * sk)) {
      const r = hash(seed + x * 11 + hh);
      const lit = r < 0.22;
      const cold = r < 0.07;
      rect(g, x, Y(hh), 3, Math.round(12 * sk), lit ? (cold ? '#c9f7f5' : C.windowLight) : '#121318');
      if (lit) rect(e, x, Y(hh), 3, Math.round(12 * sk), cold ? '#55c8cc' : '#d4792c');
    }
  }
  if (main) {
    // 거대한 스텐실 글씨 (페인트가 군데군데 벗겨졌다)
    const text = 'DISTRICT 1';
    const s = 6;
    const [tc, tg] = canvas(textWidth(text, s), 5 * s);
    neonText(tg, null, text, 0, 0, s, '#868b98', '#868b98');
    const tx = X(5698);
    const ty = Y(232);
    const img = tg.getImageData(0, 0, tc.width, tc.height).data;
    for (let j = 0; j < tc.height; j++) {
      for (let i = 0; i < tc.width; i++) {
        if (img[(j * tc.width + i) * 4 + 3] < 128) continue;
        const r = hash(i * 7 + j * 131);
        if (r < 0.12) continue;
        rect(g, tx + i, ty + j, 1, 1, r < 0.3 ? '#686d7a' : '#868b98');
      }
    }
    // 위에서 늘어진 붉은 깃발 둘 (주름, 아래쪽 별)
    for (const bx of [5880, 6060]) {
      const x = X(bx);
      const bw2 = Math.round(54 * sk);
      const bottom = Y(250);
      rect(g, x, 0, bw2, bottom, '#8a3a32');
      for (let k = 6; k < bw2; k += 9) rect(g, x + k, 0, 2, bottom, C.posterRed);
      rect(g, x, bottom - 4, bw2, 4, C.posterRedDark);
      for (let k = 0; k < bw2; k += 6) rect(g, x + k + 2, bottom, 3, 3, C.posterRedDark);
      star(g, x + Math.round(bw2 / 2), bottom - 34, 5, C.paintOchre);
      rect(g, x - 2, 0, 1, bottom, '#1d1f26');
    }
    // 큰 철문: 두꺼운 콘크리트 테, 가로 골 진 강철 문 두 짝, 경고 띠, 가운데 이음, 사람 드나드는 작은 문 (창에 불)
    const gx0 = X(WALL.gate[0]);
    const gx1 = X(WALL.gate[1]);
    const gTop = Y(236);
    rect(g, gx0 - 10, gTop - 14, gx1 - gx0 + 20, th - gTop + 14, '#3a3e49');
    rect(g, gx0 - 10, gTop - 14, gx1 - gx0 + 20, 2, '#4f5460');
    glowRect(g, e, gx0 + 6, gTop - 9, gx1 - gx0 - 12, 3, C.sodium, '#d4792c');
    rect(g, gx0, gTop, gx1 - gx0, th - gTop, '#28384a');
    for (let y = gTop + 3; y < th; y += 5) rect(g, gx0, y, gx1 - gx0, 2, '#1c2836');
    for (let x = gx0 + 4; x < gx1; x += 12) for (let y = gTop + 6; y < th; y += 24) rect(g, x, y, 1, 1, '#5c7690');
    const mid = Math.round((gx0 + gx1) / 2);
    rect(g, mid - 1, gTop, 2, th - gTop, '#0a0e14');
    for (let x = gx0; x < gx1; x++) {
      const t = (x + 0) % 16;
      rect(g, x, gTop, 1, 8, t < 8 ? C.fxYellow : '#16171c');
      rect(g, x, th - 22, 1, 8, t < 8 ? C.fxYellow : '#16171c');
    }
    const dx = mid + 16;
    rect(g, dx, th - 72, 22, 50, '#1c2836');
    roomWall(g, e, dx + 5, th - 66, 12, 10, [[dx + 11, th - 66, 10, 12, 0.6]], 0.3, WARM, 3);
    neonText(g, null, '1', mid - 20, gTop + 40, 6, '#868b98', '#868b98');
  }
  return { map, glow };
}

/** 버팀벽 앞면: 빛 받는 왼쪽 모서리, 단 이음, 위로 갈수록 그을음 */
function paintButtress(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, '#2d303a');
  rect(g, 0, 0, 2, h, '#4f5460');
  rect(g, w - 3, 0, 3, h, '#1d1f26');
  for (let y = h - 64; y > 0; y -= 64) {
    rect(g, 0, y, w, 1, '#1d1f26');
    rect(g, 0, y + 1, w, 1, '#3a3e49');
  }
  for (let k = 0; k < 14; k++) {
    const x = 3 + Math.floor(hash(seed + k * 7) * (w - 6));
    const y = Math.floor(hash(seed + k * 13) * h);
    rect(g, x, y, 1, 8 + Math.floor(hash(k + seed) * 30), '#25272f');
  }
  return c;
}

/** 막사 (월드 폭 w, 높이 h; sk 배율): 낮은 2층 콘크리트, 창 줄 (몇 개만 불, 경비 실루엣), 문 위 등 */
function paintBarracks(w: number, h: number, sk: number): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const tw = Math.round(w * sk);
  const th = Math.round(h * sk);
  const [map, g] = canvas(tw, th);
  const [glow, e] = canvas(tw, th);
  e.fillStyle = '#000';
  e.fillRect(0, 0, tw, th);
  rect(g, 0, 0, tw, th, '#3a3e49');
  rect(g, 0, Math.round(th / 2) - 1, tw, 3, '#2a2d36');
  rect(g, 0, 0, tw, 4, '#2a2d36');
  for (let k = 0; k < tw / 6; k++) rect(g, Math.floor(hash(k * 13 + 5) * tw), Math.floor(hash(k * 7) * th), 1, 4 + Math.floor(hash(k) * 12), '#2a2d36');
  let i = 0;
  for (const row of [Math.round(th * 0.14), Math.round(th * 0.6)]) {
    for (let x = 10; x < tw - 24; x += 30, i++) {
      const r = hash(i * 11 + 5);
      const ww = 16;
      const wh = Math.round(th * 0.24);
      if (r < 0.3) {
        roomWall(g, e, x, row, ww, wh, [[x + 8, row + 2, 12, wh, 0.75]], 0.22, r < 0.1 ? FLUO : WARM, 4);
        if (r < 0.15) figure(g, e, x + 8, row + wh + 8, 22, 'guard');
      } else {
        rect(g, x, row, ww, wh, '#121318');
        rect(g, x + 2, row + 2, 1, wh - 5, '#2a2d36');
      }
      rect(g, x - 1, row + wh, ww + 2, 2, '#4f5460');
    }
  }
  // 문과 문 위 등
  const dx = Math.round(tw * 0.62);
  rect(g, dx, th - Math.round(th * 0.38), 16, Math.round(th * 0.38), '#1c2836');
  glowRect(g, e, dx + 5, th - Math.round(th * 0.38) - 5, 6, 3, C.lampCore, C.lampGlow);
  return { map, glow };
}

/** 초소·감시탑 오두막: 판자 벽, 큰 창 (불 켜진 안에 경비 실루엣), 창 아래 경고 띠 */
function paintCabin(w: number, h: number, seed: number): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const [map, g] = canvas(w, h);
  const [glow, e] = canvas(w, h);
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  rect(g, 0, 0, w, h, C.awning);
  for (let y = 0; y < h; y += 4) rect(g, 0, y, w, 1, C.awningStripe);
  const wy = 8;
  const wh = Math.min(16, h - 16);
  roomWall(g, e, 6, wy, w - 12, wh, [[w / 2, wy + 2, w * 0.4, wh + 4, 0.8]], 0.25, WARM, 6);
  figure(g, e, Math.round(w * (0.3 + hash(seed) * 0.4)), wy + wh + 10, 26, 'guard');
  for (let x = 6 + Math.round((w - 12) / 3); x < w - 8; x += Math.round((w - 12) / 3)) sil(g, e, x, wy, 1, wh, C.iron);
  rect(g, 0, 0, w, 2, C.iron);
  for (let x = 0; x < w; x++) rect(g, x, h - 6, 1, 3, x % 8 < 4 ? C.fxYellow : C.iron);
  return { map, glow };
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
