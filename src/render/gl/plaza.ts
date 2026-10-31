import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { BIG } from '../../stage/citadel';
import type { PropState } from '../../sim';
import { textWidth } from '../font';
import { COLORS as C } from '../palette';
import { canvas, disc, ditherRect, hash, line, rect } from '../dither';
import { star } from './backdrops';
import { scaleAt } from './core';
import { Beam } from './fx';
import { box, Details, facedBox, facedInto, FREE, Geo, matKeys, plane, type UvFn } from './kit';
import { lightPool } from './lights';
import { litMaterial, pixelTexture } from './shaders';
import { neonText } from './tex';

/**
 * 시타델 광장 (월드 x 1,000~2,200)의 2.5D 무대 (렌더 전용). 무너지지 않는다.
 * 깊이(z, 카메라 쪽 +): 본관 정면 KEEP_Z → 계단(뒤로 올라간다) → 분수 → 싸우는 면(0).
 * 본관은 1960년대 마천루의 아랫부분: 유리 커튼월(굵은 콘크리트 기둥, 켜진 사무실), 2층 높이 유리 로비, 가운데 높은 유리 홀과 정문.
 * 올라설 수 있는 곳(계단참·기둥 테라스·기둥 꼭대기)은 얇은 판으로 싸우는 면까지 튀어나오고, 서 있지 못하는 덩어리(기둥·계단)는
 * 싸우는 면보다 뒤에 둔다 (캐릭터가 그 앞을 지나간다).
 */
const P = D.plaza;
const K = P.keep;
const T = P.tower;
const L = P.landing;
export const KEEP_Z = -170;
const SK = scaleAt(KEEP_Z);
/** 계단참 아래 계단: 맨 아래 단 앞이 이 깊이, 한 단 올라갈 때마다 뒤로 */
const STAIR_Z = -92;
const STAIR_STEP = 7;
const FOUNTAIN_Z = -50;

const ax0 = P.towers[0].x + T.w;
const ax1 = P.towers[1].x;
const gx = Math.round((L.x0 + L.x1 - P.gate.w) / 2);

interface Glow {
  x: number;
  y: number;
  z: number;
  range: number;
  color: string;
  power: number;
}

export class Plaza {
  readonly group = new THREE.Group();
  /** 광장 전기로 켜진 빛 (간판이 떨어지면 꺼진다) */
  private readonly fixed: Glow[] = [];
  /** 검문소 초소 불빛 (따로 발전기를 쓴다) */
  private booth: Glow | null = null;
  /** 옥상 서치라이트 (간판이 떨어져도 남는다) */
  private readonly beams: Beam[] = [];
  /** 기둥 발치·본관 날개 밑 투광등 (광장 전기) */
  private readonly floods: Beam[] = [];
  /** 광장 전기로 빛나는 면: 재질과 켜졌을 때 세기 */
  private readonly glows: Array<{ mat: THREE.ShaderMaterial; k: number }> = [];
  private signMesh!: THREE.Mesh;
  private signMat!: THREE.ShaderMaterial;
  /** 분수 가운데 받침과 그릇 (간판에 깔리면 사라진다) */
  private readonly fountainTop: THREE.Object3D[] = [];
  private readonly beacons: Array<{ mat: THREE.ShaderMaterial; x: number; y: number; z: number; phase: number }> = [];
  private readonly checkLight: THREE.ShaderMaterial;

  constructor() {
    const det = new Details();
    this.keep(det);
    this.pylons(det);
    this.stairs(det);
    this.sign();
    this.fountain();
    this.walls(det);
    statue(this.group, det);
    this.gatePiers(det);
    this.checkLight = this.checkpoint(det);
    this.group.add(det.build());
  }

  /** 본관: 커튼월 정면 그림을 붙인 큰 상자, 옥상 처마와 서치라이트 받침, 정문 캐노피와 벽등 */
  private keep(det: Details): void {
    const f = paintKeep(this.fixed);
    const side = litMaterial(pixelTexture(paintKeepSide()), { tint: 0.7 });
    const roof = litMaterial(pixelTexture(solidTex(C.smog1)));
    const front = litMaterial(pixelTexture(f.map), { emissive: pixelTexture(f.glow), emissiveStrength: 0.7 });
    this.glows.push({ mat: front, k: 0.7 });
    this.group.add(facedBox(K.x0, K.x1, 0, K.h, KEEP_Z - 400, KEEP_Z, { px: side, nx: side, py: roof, pz: front }));
    // 옥상 처마 띠와 서치라이트 받침
    det.add(K.x0 - 4, K.x1 + 4, K.h, K.h + 8, KEEP_Z - 6, KEEP_Z + 4, C.stone);
    det.add(K.x0 - 4, K.x1 + 4, K.h + 7, K.h + 8, KEEP_Z - 6, KEEP_Z + 4, C.paintCream);
    K.lights.forEach((lx) => {
      det.add(lx - 10, lx + 10, K.h + 8, K.h + 14, KEEP_Z - 20, KEEP_Z - 4, C.iron);
      det.add(lx - 6, lx + 6, K.h + 14, K.h + 22, KEEP_Z - 16, KEEP_Z - 8, C.ironLight);
      const beam = new Beam(520, 46, C.beam, 0.2, 2);
      beam.pivot.position.set(lx, K.h + 20, KEEP_Z - 12);
      this.group.add(beam.pivot);
      this.beams.push(beam);
    });
    // 정문 캐노피 (얇게 튀어나온 돌판, 아래 매입등)
    const gTop = L.h + P.gate.h;
    det.add(gx - 36, gx + P.gate.w + 36, gTop + 10, gTop + 16, KEEP_Z, KEEP_Z + 40, C.stone);
    det.add(gx - 36, gx + P.gate.w + 36, gTop + 15, gTop + 16, KEEP_Z, KEEP_Z + 40, C.paintCream);
    for (let x = gx - 30; x < gx + P.gate.w + 32; x += 14) det.add(x, x + 3, gTop + 9.5, gTop + 10.5, KEEP_Z + 30, KEEP_Z + 38, C.lampCore);
    for (let x = gx - 18; x < gx + P.gate.w + 32; x += 42) this.fixed.push({ x, y: gTop + 4, z: KEEP_Z + 44, range: 40, color: C.lampGlow, power: 0.6 });
    // 정문 양옆 원통 벽등
    for (const lx of [gx - 22, gx + P.gate.w + 14]) this.fixed.push({ x: lx + 4, y: L.h + 64, z: KEEP_Z + 16, range: 52, color: C.lampWarm, power: 0.9 });
  }

  /** 정문 양옆 콘크리트 기둥: 거푸집 줄눈, 가운데 빛 홈, 얇게 튀어나온 테라스와 쇠 난간, 꼭대기 덮개와 항공 경고등, 발치 투광등 */
  private pylons(det: Details): void {
    const mat = litMaterial(pixelTexture(paintPylon()), { emissive: pixelTexture(paintPylon(true)), emissiveStrength: 0.45 });
    this.glows.push({ mat, k: 0.45 });
    const side = litMaterial(pixelTexture(solidTex(C.stoneDark)), { tint: 0.8 });
    // 기둥 둘을 한 기하로 (옆면 한 번, 앞면 한 번)
    const geo = new Geo();
    const faces = { px: side, nx: side, py: side, pz: mat };
    for (const t of P.towers) facedInto(geo, t.x, t.x + T.w, 0, T.h, KEEP_Z, -16, faces);
    this.group.add(geo.build(matKeys(faces)));
    P.towers.forEach((t, i) => {
      // 테라스 (윗면이 발판): 정면에서 싸우는 면까지
      const tx0 = t.x - T.terraceOver;
      const tx1 = t.x + T.w + T.terraceOver;
      det.add(tx0, tx1, T.terrace - 5, T.terrace, KEEP_Z, 6, C.stone);
      det.add(tx0, tx1, T.terrace - 1, T.terrace, KEEP_Z, 6, C.paintCream);
      for (let x = tx0; x <= tx1 - 1; x += 8) det.add(x, x + 1, T.terrace, T.terrace + 10, 4, 5, C.chromeDark);
      det.add(tx0, tx1, T.terrace + 10, T.terrace + 11, 4, 5, C.chrome);
      det.add(tx0, tx1, T.terrace + 5, T.terrace + 6, 4, 5, C.chromeDark);
      // 꼭대기 덮개 (윗면이 발판)와 경고등 기둥
      det.add(t.x - 2, t.x + T.w + 2, T.h - 6, T.h, KEEP_Z, 6, C.stone);
      det.add(t.x - 2, t.x + T.w + 2, T.h - 1, T.h, KEEP_Z, 6, C.paintCream);
      const bx = t.x + T.w - 10;
      det.add(bx, bx + 2, T.h, T.h + 10, -40, -38, C.chromeDark);
      const red = litMaterial(pixelTexture(solidTex(C.neonRedDark)), { emissive: pixelTexture(solidTex(C.neonRed)), emissiveStrength: 0 });
      this.group.add(box(bx - 1, bx + 3, T.h + 10, T.h + 13, -41, -37, red));
      this.beacons.push({ mat: red, x: bx + 1, y: T.h + 12, z: -30, phase: i * 45 });
      // 빛 홈 (기둥 가운데 세로로 빛나는 홈)
      for (const k of [0.2, 0.5, 0.8]) this.fixed.push({ x: t.x + T.w / 2, y: 24 + (T.h - 44) * k, z: -6, range: 34, color: C.officeLit, power: 0.4 });
      // 발치 투광등: 기둥을 따라 위로 쏘는 차가운 빛
      const up = new Beam(300, 26, C.beam, 0.32, 2);
      up.pivot.position.set(t.x + T.w / 2, 2, -10);
      this.group.add(up.pivot);
      this.floods.push(up);
      this.fixed.push({ x: t.x + T.w / 2, y: 30, z: -4, range: 90, color: C.beam, power: 0.5 });
    });
    // 본관 양 날개 밑 투광등
    for (const x of [K.x0 + 70, K.x1 - 70]) {
      const up = new Beam(240, 30, C.skyLight, 0.18, 2);
      up.pivot.position.set(x, 2, KEEP_Z + 8);
      this.group.add(up.pivot);
      this.floods.push(up);
      this.fixed.push({ x, y: 40, z: KEEP_Z + 30, range: 110, color: C.skyLight, power: 0.35 });
    }
  }

  /** 정문 계단: 계단참에서 앞으로 내려오는 넓은 화강암 계단 (위로 갈수록 좁아지고 뒤로 물러난다). 계단참은 얇은 판 (윗면이 발판) */
  private stairs(det: Details): void {
    const steps = Math.ceil(L.h / 8);
    const tex = litMaterial(pixelTexture(paintStep()));
    const geo = new Geo();
    for (let i = 0; i < steps; i++) {
      const inset = 10 + i * 2;
      const z = STAIR_Z - i * STAIR_STEP;
      const uv: UvFn = (f, x, y) => [(x - L.x0) / 16, f === 'py' ? 0.95 : (y - i * 8) / 8];
      geo.box('s', L.x0 + inset, L.x1 - inset, i * 8, (i + 1) * 8, KEEP_Z - 2, z, uv, FREE, ['pz', 'py', 'px', 'nx']);
    }
    (tex.uniforms.map.value as THREE.Texture).wrapS = THREE.RepeatWrapping;
    this.group.add(geo.build({ s: tex }));
    // 계단참: 윗면(발판)과 앞 턱. 싸우는 면까지 튀어나온 얇은 판
    det.add(L.x0, L.x1, L.h - 6, L.h, KEEP_Z, 6, C.stone);
    det.add(L.x0, L.x1, L.h - 1, L.h, KEEP_Z, 6, C.paintCream);
    det.add(L.x0, L.x1, L.h - 8, L.h - 6, KEEP_Z, 6, C.stoneDark);
  }

  /** 정면 대형 간판: 어두운 띠에 빛나는 글자 CITADEL, 아래 DISTRICT 1, 양옆 붉은 별 (광장의 주인공 빛) */
  private sign(): void {
    const S = P.sign;
    const t = paintCitadelSign();
    this.signMat = litMaterial(pixelTexture(t.map), { emissive: pixelTexture(t.glow), emissiveStrength: 1.8 });
    const x0 = S.x - t.plateX0;
    this.signMesh = box(x0, x0 + t.w, S.bottom, S.bottom + S.h, KEEP_Z + 1, KEEP_Z + 6, this.signMat);
    this.group.add(this.signMesh);
    this.fixed.push({ x: S.x + S.w / 2, y: S.bottom + S.h / 2, z: KEEP_Z + 60, range: 200, color: C.beam, power: 1.6 });
  }

  /** 분수: 둥근 돌 수반(물 위에 비친 빛), 가운데 받침과 그릇 (물줄기는 움직이는 도시가 매 틱 그린다) */
  private fountain(): void {
    const F = P.fountain;
    const stone = litMaterial(pixelTexture(paintBasin()));
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(F.w / 2, F.w / 2, 18, 28, 1, true), stone);
    basin.scale.z = 0.45;
    basin.position.set(F.x, 9, FOUNTAIN_Z);
    this.group.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(F.w / 2 - 3, 28), litMaterial(pixelTexture(solidTex(C.skyDark)), { tint: 0.6 }));
    water.rotation.x = -Math.PI / 2;
    water.scale.y = 0.45;
    water.position.set(F.x, 14, FOUNTAIN_Z);
    this.group.add(water);
    const column = box(F.x - 5, F.x + 5, 14, 46, FOUNTAIN_Z - 5, FOUNTAIN_Z + 5, litMaterial(pixelTexture(solidTex(C.stone))));
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(20, 14, 5, 20, 1, false), stone);
    bowl.position.set(F.x, 47.5, FOUNTAIN_Z);
    bowl.scale.z = 0.5;
    this.group.add(column, bowl);
    this.fountainTop.push(column, bowl);
    this.fixed.push({ x: F.x, y: 26, z: FOUNTAIN_Z + 34, range: 80, color: C.sky, power: 0.3 });
  }

  /** 광장 양옆 낮은 콘크리트 담과 쇠 난간 (너머로 먼 길과 행인이 보인다) */
  private walls(det: Details): void {
    for (const [x0, x1] of [[P.gatePiers[0] + 32, K.x0], [K.x1, P.gatePiers[1]]] as const) {
      det.add(x0, x1, 0, 12, -52, -40, C.stone);
      det.add(x0, x1, 11, 12, -52, -40, C.paintCream);
      for (let bx = x0 + 2; bx < x1 - 2; bx += 10) det.add(bx, bx + 1, 12, 24, -47, -46, C.chromeDark);
      det.add(x0, x1, 24, 25, -47.5, -45.5, C.chrome);
    }
  }

  /** 광장 입구 문기둥 둘 (돌기둥, 덮개, 등롱). 서쪽 것이 전차 선로 끝을 가린다 */
  private gatePiers(det: Details): void {
    const mat = litMaterial(pixelTexture(paintStone(32, 120, 16)));
    for (const px of P.gatePiers) {
      this.group.add(box(px, px + 32, 0, 120, -34, -0.6, mat));
      det.add(px - 3, px + 35, 120, 126, -37, -0.5, C.stone);
      det.add(px - 3, px + 35, 125, 126, -37, -0.5, C.paintCream);
      const lan = litMaterial(pixelTexture(solidTex(C.lampWarm)), { emissive: pixelTexture(solidTex(C.lampGlow)), emissiveStrength: 1.6 });
      this.glows.push({ mat: lan, k: 1.6 });
      this.group.add(box(px + 10, px + 22, 126, 138, -24, -12, lan));
      det.add(px + 9, px + 23, 138, 140, -25, -11, C.iron);
      this.fixed.push({ x: px + 16, y: 132, z: -4, range: 60, color: C.lampGlow, power: 0.9 });
    }
  }

  /** 광장 동쪽 입구 검문소: 모래주머니, 초소(불 켜진 창·줄무늬 띠·HALT), 들어 올린 차단봉, 붉은 경광등 */
  private checkpoint(det: Details): THREE.ShaderMaterial {
    const CP = P.checkpoint;
    const [mc, g] = canvas(CP.w, CP.h);
    const [ec, e] = canvas(CP.w, CP.h);
    e.fillStyle = '#000';
    e.fillRect(0, 0, CP.w, CP.h);
    rect(g, 0, 0, CP.w, CP.h, C.ironLight);
    rect(g, 4, 8, CP.w - 8, 12, C.windowLit);
    rect(g, 4, 8, CP.w - 8, 3, C.windowLight);
    rect(e, 4, 8, CP.w - 8, 12, C.windowLit);
    rect(g, CP.w / 2, 8, 1, 12, C.iron);
    rect(e, CP.w / 2, 8, 1, 12, '#000');
    for (let k = 0; k < CP.w; k += 6) rect(g, k, 24, 3, 3, C.posterRed);
    neonText(g, null, 'HALT', Math.floor((CP.w - 15) / 2), 30, 1, C.paintCream, C.paintCream);
    ditherRect(g, 0, 0, CP.w, CP.h, C.smog1, 3);
    const booth = litMaterial(pixelTexture(mc), { emissive: pixelTexture(ec), emissiveStrength: 1 });
    const side = litMaterial(pixelTexture(solidTex(C.ironLight)), { tint: 0.7 });
    this.group.add(facedBox(CP.x, CP.x + CP.w, 0, CP.h, -44, -18, { px: side, nx: side, py: side, pz: booth }));
    det.add(CP.x - 2, CP.x + CP.w + 2, CP.h, CP.h + 4, -46, -16, C.iron);
    // 모래주머니 두 단
    for (let row = 0; row < 2; row++) for (let k = 0; k < 3 - row; k++) {
      const bx = CP.x - 34 + k * 11 + row * 5;
      det.add(bx, bx + 11, row * 7, row * 7 + 7, -30, -16, C.sandbag);
      det.add(bx, bx + 11, row * 7 + 6, row * 7 + 7, -30, -16, C.awning);
    }
    // 차단봉: 기둥과 위로 들린 줄무늬 봉
    det.add(CP.x + CP.w - 2, CP.x + CP.w + 4, 0, 34, -14, -10, C.iron);
    for (let k = 0; k < 8; k++) {
      const a = 1.1;
      const x0 = CP.x + CP.w + 1 + Math.cos(a) * k * 5;
      const y0 = 30 + Math.sin(a) * k * 5;
      det.bar(x0, y0, x0 + Math.cos(a) * 5, y0 + Math.sin(a) * 5, 2, -13, -11, k % 2 ? C.posterRed : C.paintCream);
    }
    // 경광등
    const red = litMaterial(pixelTexture(solidTex(C.neonRedDark)), { emissive: pixelTexture(solidTex(C.neonRed)), emissiveStrength: 0 });
    this.group.add(box(CP.x + CP.w / 2 - 2, CP.x + CP.w / 2 + 2, CP.h + 4, CP.h + 8, -32, -28, red));
    this.booth = { x: CP.x + CP.w / 2, y: CP.h - 14, z: -6, range: 40, color: C.windowLit, power: 0.6 };
    return red;
  }

  /**
   * 붙박이 빛과 깜빡이는 경고등, 쓸고 지나가는 서치라이트.
   * 시타델 간판이 떨어지면 (sign: 간판 상태) 광장 전기가 몇 번 깜빡이다 나간다: 본관 창·기둥 빛 홈·투광등·문기둥 등롱·분수 빛이 꺼지고
   * 옥상 서치라이트와 경고등, 검문소 불빛만 남는다. 간판이 망가지면 간판 글씨가 깜빡인다.
   */
  update(tick: number, props: readonly PropState[] | null = null): void {
    const sign = props?.[BIG.bigsign];
    const since = sign && sign.stage === 2 ? tick - sign.brokenAt : -1;
    // 광장 전기: 떨어진 뒤 30틱 동안 깜빡이다 나간다
    const on = since < 0 ? 1 : since < 30 && hash(Math.floor(since / 3) * 17 + 5) < 0.55 - since / 60 ? 0.8 : 0;
    if (on > 0) for (const f of this.fixed) lightPool.add(f.x, f.y, f.z, f.range, f.color, f.power * on);
    for (const g of this.glows) g.mat.uniforms.emissiveStrength.value = g.k * on;
    for (const b of this.floods) b.mesh.visible = on > 0;
    this.signMesh.visible = since < 0;
    this.signMat.uniforms.emissiveStrength.value = sign?.stage === 1 && hash(Math.floor(tick / 4) * 7 + 3) < 0.3 ? 0.4 : 1.8;
    const crushed = since >= 0 && since >= 44;
    for (const o of this.fountainTop) o.visible = !crushed;
    if (this.booth) lightPool.add(this.booth.x, this.booth.y, this.booth.z, this.booth.range, this.booth.color, this.booth.power);
    this.beams.forEach((b, i) => {
      if (i < 2) b.aim(0.7 * Math.sin(tick * 0.013 + i * 1.7));
    });
    for (const b of this.beacons) {
      const on = (tick + b.phase) % 90 < 45;
      b.mat.uniforms.emissiveStrength.value = on ? 2 : 0;
      if (on) lightPool.add(b.x, b.y, b.z, 30, C.neonRed, 0.9);
    }
    const CP = P.checkpoint;
    const blink = tick % 40 < 20;
    this.checkLight.uniforms.emissiveStrength.value = blink ? 2 : 0;
    if (blink) lightPool.add(CP.x + CP.w / 2, CP.h + 8, -20, 40, C.neonRed, 0.9);
  }
}

function solidTex(color: string): HTMLCanvasElement {
  const [c, g] = canvas(4, 4);
  rect(g, 0, 0, 4, 4, color);
  return c;
}

/**
 * 시타델 정면 대형 간판 그림: 쇠판(plateX0부터 판 폭 D.plaza.sign.w)에 빛나는 글자 CITADEL과 DISTRICT 1, 양옆에 붉은 별.
 * glow는 빛나는 부분만. 본관에 걸린 간판과 떨어지는 간판이 같이 쓴다.
 */
export function paintCitadelSign(): { map: HTMLCanvasElement; glow: HTMLCanvasElement; w: number; plateX0: number } {
  const S = P.sign;
  const tw = textWidth(S.text, 4);
  const plateX0 = 36;
  const w = S.w + plateX0 * 2;
  const h = S.h;
  const [map, g] = canvas(w, h);
  const [glow, e] = canvas(w, h);
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  rect(g, plateX0, 0, S.w, h, C.iron);
  rect(g, plateX0, 0, S.w, 1, C.ironLight);
  neonText(g, e, S.text, plateX0 + Math.round((S.w - tw) / 2), 10, 4, C.lampCore, C.chromeDark);
  neonText(g, e, S.sub, plateX0 + Math.round((S.w - textWidth(S.sub, 2)) / 2), 36, 2, C.beam, C.chromeDark);
  for (const cx of [18, w - 18]) star(g, cx, 26, 3, C.posterRed);
  return { map, glow, w, plateX0 };
}

/** 돌 벽 (블록 줄눈) */
function paintStone(w: number, h: number, block: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.stone);
  for (let y = 7; y < h; y += 8) {
    rect(g, 0, y, w, 1, C.stoneDark);
    const off = (y >> 3) % 2 ? block / 2 : 0;
    for (let x = off; x < w; x += block) rect(g, x, y - 7, 1, 7, C.stoneDark);
  }
  ditherRect(g, 0, 0, w, h, C.stoneDark, 2);
  return c;
}

/** 계단 한 단 (앞면 위 밝은 모서리, 아래 그늘) */
function paintStep(): HTMLCanvasElement {
  const [c, g] = canvas(16, 8);
  rect(g, 0, 0, 16, 8, C.stone);
  rect(g, 0, 5, 16, 3, C.stoneDark);
  rect(g, 0, 0, 16, 1, C.paintCream);
  rect(g, 9, 2, 1, 2, C.stoneDark);
  return c;
}

/** 분수 수반 둘레 (돌 띠, 물때) */
function paintBasin(): HTMLCanvasElement {
  const [c, g] = canvas(64, 18);
  rect(g, 0, 0, 64, 18, C.stone);
  rect(g, 0, 0, 64, 2, C.paintCream);
  rect(g, 0, 14, 64, 4, C.stoneDark);
  ditherRect(g, 0, 4, 64, 6, C.skyDark, 3);
  return c;
}

/** 본관 옆면 (어두운 유리 띠와 기둥) */
function paintKeepSide(): HTMLCanvasElement {
  const [c, g] = canvas(64, 128);
  rect(g, 0, 0, 64, 128, C.glass);
  for (let y = 0; y < 128; y += 13) rect(g, 0, y, 64, 3, C.iron);
  for (let x = 0; x < 64; x += 16) rect(g, x, 0, 3, 128, C.stoneDark);
  return c;
}

/** 콘크리트 기둥 앞면 (56 × 296): 거푸집 줄눈, 밝은 왼쪽 모서리, 가운데 빛 홈. glow: 빛 홈만 */
function paintPylon(glow = false): HTMLCanvasElement {
  const [c, g] = canvas(T.w, T.h);
  if (glow) {
    rect(g, 0, 0, T.w, T.h, '#000');
  } else {
    rect(g, 0, 0, T.w, T.h, C.stone);
    for (let y = 14; y < T.h; y += 16) rect(g, 0, y, T.w, 1, C.stoneDark);
    rect(g, 0, 0, 3, T.h, C.paintCream);
    rect(g, T.w - 4, 0, 4, T.h, C.stoneDark);
    for (let k = 0; k < 30; k++) rect(g, Math.floor(hash(k * 7 + 3) * T.w), Math.floor(hash(k * 11 + 5) * T.h), 1, 3, C.smog3);
  }
  const sx = Math.round(T.w / 2) - 3;
  if (!glow) rect(g, sx, 16, 6, T.h - 40, C.iron);
  rect(g, sx + 1, 18, 4, T.h - 44, glow ? '#3d4c45' : C.glassEdge);
  ditherRect(g, sx + 1, 18, 4, T.h - 44, glow ? C.officeLit : C.paintTeal, 4);
  return c;
}

/**
 * 본관 정면 그림 (텍스처 칸 = 화면 1px이 되게 본관 깊이의 배율로 그린다).
 * 유리 커튼월(층마다 켜진 사무실·스팬드럴·멀리언·굵은 기둥), 로비 띠, 2층 높이 유리 로비(승강기 문·깃발), 화강암 받침,
 * 가운데 유리 홀(큰 깃발)과 계단참 위 정문(회전문)·벽등.
 */
function paintKeep(fixed: Glow[]): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const W = K.x1 - K.x0;
  const tw = Math.round(W * SK);
  const th = Math.round(K.h * SK);
  const [map, g] = canvas(tw, th);
  const [glow, e] = canvas(tw, th);
  e.fillStyle = '#000';
  e.fillRect(0, 0, tw, th);
  const X = (x: number) => Math.round((x - K.x0) * SK);
  const Y = (h: number) => Math.round((K.h - h) * SK);
  /** 월드 x0~x1, 높이 h0~h1 사각형 */
  const R = (c: CanvasRenderingContext2D, x0: number, x1: number, h0: number, h1: number, color: string, min = 1) =>
    rect(c, X(x0), Y(h1), Math.max(min, X(x1) - X(x0)), Math.max(min, Y(h0) - Y(h1)), color);
  const RD = (c: CanvasRenderingContext2D, x0: number, x1: number, h0: number, h1: number, color: string, level: number) =>
    ditherRect(c, X(x0), Y(h1), Math.max(1, X(x1) - X(x0)), Math.max(1, Y(h0) - Y(h1)), color, level);
  const wallBottom = K.lobby + 12;
  const ly = L.h;

  // 1) 유리 커튼월
  R(g, K.x0, K.x1, wallBottom, K.h, C.glass);
  for (let f = 0; wallBottom + (f + 1) * K.floor < K.h - 14; f++) {
    const fb = wallBottom + f * K.floor;
    const ft = fb + K.floor;
    const allLit = hash(f * 97 + 13) < 0.14;
    const warmFloor = hash(f * 41 + 5) < 0.35;
    for (let bay = 0; bay * K.pier < W; bay++) {
      let n = 0;
      for (let k = 0; k < K.pier / K.pane; k++) {
        const x = K.x0 + bay * K.pier + k * K.pane;
        if (x >= K.x1) break;
        if (fb < K.atrium && x + K.pane > ax0 && x < ax1) continue;
        const on = allLit || hash(f * 31 + (bay * 6 + k) * 7) < 0.15;
        if (on) {
          n++;
          const warm = allLit ? warmFloor : hash(f * 5 + k * 3 + bay) < 0.4;
          officePane(g, e, X(x + 2), Y(ft - 5), X(x + K.pane) - X(x + 2), Y(fb) - Y(ft - 5), warm, hash(f * 11 + k * 17 + bay * 5));
        } else {
          const band = (x + (K.h - ft) * 0.8) % 210 < 46;
          if (band) RD(g, x + 2, x + K.pane, fb, ft - 5, C.glassEdge, 5);
          else RD(g, x + 2, x + K.pane, ft - 8, ft - 5, C.glassEdge, 4);
        }
      }
      if (n >= 2) {
        const bx = K.x0 + bay * K.pier + K.pier / 2;
        const color = allLit ? (warmFloor ? C.windowLight : C.officeLit) : C.officeLit;
        fixed.push({ x: bx, y: fb + K.floor / 2, z: KEEP_Z + 14, range: 26 + n * 6, color, power: 0.18 + n * 0.06 });
      }
    }
    // 스팬드럴 (층 바닥 띠)
    R(g, K.x0, K.x1, ft - 5, ft, C.iron);
    R(g, K.x0, K.x1, ft - 1, ft, C.ironLight);
  }
  // 가는 쇠 멀리언
  for (let x: number = K.x0; x < K.x1; x += K.pane) {
    rect(g, X(x), 0, 1, Y(wallBottom), C.chromeDark);
    rect(g, X(x) + 1, 0, 1, Y(wallBottom), C.iron);
  }
  // 굵은 콘크리트 기둥 (빛 받는 왼쪽 모서리가 밝다): 꼭대기에서 땅까지. 가운데 유리 홀 안은 홀 꼭대기에서 멈춘다
  const pier = (x: number, h0: number, h1: number) => {
    const pw = x === K.x0 || x === K.x1 ? 10 : 7;
    const px = x === K.x1 ? x - pw : x === K.x0 ? x : x - 3;
    R(g, px, px + pw, h0, h1, C.stone);
    R(g, px, px + 1, h0, h1, C.paintCream);
    R(g, px + pw - 2, px + pw, h0, h1, C.stoneDark);
  };
  const inAtrium = (x: number) => x > ax0 && x < ax1;
  for (let x: number = K.x0; x <= K.x1; x += K.pier) pier(x, inAtrium(x) ? K.atrium : 0, K.h);

  // 2) 로비 위 띠, 유리 로비 (안쪽 불빛·승강기 문·늘어진 깃발), 화강암 받침
  R(g, K.x0, K.x1, K.lobby, wallBottom, C.stone);
  R(g, K.x0, K.x1, wallBottom - 1, wallBottom, C.paintCream);
  R(g, K.x0, K.x1, K.lobby, K.lobby + 2, C.stoneDark);
  for (const [x0, x1] of [[K.x0, ax0], [ax1, K.x1]] as const) {
    R(g, x0, x1, 22, K.lobby, C.glass);
    // 로비 불빛: 위쪽 띠는 거의 꽉 차게, 아래는 듬성듬성 (바둑판 반반 무늬는 철망처럼 보여 피한다)
    RD(g, x0, x1, K.lobby - 56, K.lobby - 6, C.windowLit, 12);
    RD(e, x0, x1, K.lobby - 56, K.lobby - 6, '#7a5c3a', 12);
    RD(g, x0, x1, 22, K.lobby - 56, C.windowLit, 6);
    RD(e, x0, x1, 22, K.lobby - 56, '#7a5c3a', 6);
    R(g, x0, x1, K.lobby - 6, K.lobby, C.iron);
    R(e, x0, x1, K.lobby - 6, K.lobby, '#000');
    for (let x = x0 + 6; x < x1 - 4; x += 12) {
      R(g, x, x + 3, K.lobby - 7, K.lobby - 6, C.lampCore);
      R(e, x, x + 3, K.lobby - 7, K.lobby - 6, C.lampCore);
    }
    for (let x = x0 + 20; x + 24 < x1; x += 45) {
      if (hash(x) < 0.5) {
        R(g, x, x + 9, 22, 52, C.paintOchre);
        R(g, x + 10, x + 19, 22, 52, C.paintOchre);
        R(g, x + 9, x + 10, 22, 52, C.iron);
        R(g, x - 1, x + 20, 52, 55, C.iron);
        R(e, x - 1, x + 20, 22, 55, '#000');
      } else {
        R(g, x + 4, x + 16, K.lobby - 64, K.lobby - 6, C.posterRed);
        R(g, x + 4, x + 16, K.lobby - 64, K.lobby - 62, C.posterRedDark);
        R(e, x + 4, x + 16, K.lobby - 64, K.lobby - 6, '#000');
        star(g, X(x + 10), Y(K.lobby - 26), 1, C.paintOchre);
      }
    }
    for (let x = x0; x < x1; x += 30) {
      R(g, x, x + 1, 22, K.lobby - 6, C.chromeDark);
      R(e, x, x + 1, 22, K.lobby - 6, '#000');
    }
    R(g, x0, x1, K.lobby - 71, K.lobby - 70, C.chromeDark);
    for (let x = x0 + 45; x < x1; x += 90) fixed.push({ x, y: 60, z: KEEP_Z + 40, range: 110, color: C.windowLit, power: 0.7 });
  }
  R(g, K.x0, K.x1, 0, 22, C.iron);
  R(g, K.x0, K.x1, 21, 22, C.ironLight);
  RD(g, K.x0, K.x1, 14, 20, C.ironLight, 3);
  // 로비 앞 굵은 기둥 (커튼월 기둥이 땅까지 내려온 것)
  for (let x: number = K.x0; x <= K.x1; x += K.pier) if (!inAtrium(x)) pier(x, 0, wallBottom);

  // 3) 가운데 유리 홀: 계단참에서 높이 솟은 유리, 큰 깃발, 홀 꼭대기 띠
  R(g, ax0, ax1, ly, K.atrium, C.glass);
  RD(g, ax0, ax1, ly, K.atrium - 30, C.windowLit, 11);
  RD(e, ax0, ax1, ly, K.atrium - 30, '#6a4e30', 11);
  for (let x = ax0 + 26; x < ax1; x += 26) {
    R(g, x, x + 1, ly, K.atrium, C.chromeDark);
    R(e, x, x + 1, ly, K.atrium, '#000');
  }
  for (let h = K.atrium - 34; h > ly; h -= 34) {
    R(g, ax0, ax1, h, h + 1, C.chromeDark);
    R(e, ax0, ax1, h, h + 1, '#000');
  }
  const bcx = Math.round((ax0 + ax1) / 2);
  R(g, bcx - 16, bcx + 16, K.atrium - 89, K.atrium - 6, C.posterRed);
  R(g, bcx - 16, bcx + 16, K.atrium - 89, K.atrium - 86, C.posterRedDark);
  R(e, bcx - 16, bcx + 16, K.atrium - 89, K.atrium - 6, '#000');
  star(g, X(bcx), Y(K.atrium - 36), 3, C.paintOchre);
  R(g, ax0, ax1, K.atrium, K.atrium + 6, C.stone);
  R(g, ax0, ax1, K.atrium + 5, K.atrium + 6, C.paintCream);
  fixed.push({ x: bcx, y: K.atrium - 70, z: KEEP_Z + 30, range: 110, color: C.windowLit, power: 0.6 });

  // 4) 유리 정문: 쇠틀, 불 켜진 유리문 넷과 가운데 회전문, 양옆 원통 벽등
  const gTop = ly + P.gate.h;
  R(g, gx - 4, gx + P.gate.w + 4, ly, gTop, C.iron);
  R(e, gx - 4, gx + P.gate.w + 4, ly, gTop, '#000');
  R(g, gx, gx + P.gate.w, ly, gTop - 4, C.glass);
  RD(g, gx, gx + P.gate.w, ly, gTop - 40, C.windowLit, 12);
  RD(e, gx, gx + P.gate.w, ly, gTop - 40, '#7a5c3a', 12);
  for (let x = gx + 20; x < gx + P.gate.w; x += 20) R(g, x, x + 1, ly, gTop - 4, C.iron);
  R(g, gx, gx + P.gate.w, gTop - 38, gTop - 36, C.iron);
  const rx = gx + P.gate.w / 2 - 12;
  R(g, rx, rx + 24, ly, ly + 46, C.paintOchre);
  R(g, rx + 2, rx + 22, ly, ly + 44, C.glass);
  RD(g, rx + 2, rx + 22, ly, ly + 44, C.windowLight, 5);
  RD(e, rx + 2, rx + 22, ly, ly + 44, C.windowLight, 5);
  R(g, rx + 11, rx + 13, ly, ly + 44, C.paintOchre);
  R(g, rx, rx + 24, ly + 46, ly + 48, C.paintOchre);
  for (const lx of [gx - 22, gx + P.gate.w + 14]) {
    R(g, lx + 1, lx + 7, ly + 54, ly + 74, C.chromeDark);
    R(g, lx + 1, lx + 2, ly + 54, ly + 74, C.chrome);
    R(g, lx + 3, lx + 5, ly + 58, ly + 70, C.lampGlow);
    R(e, lx + 3, lx + 5, ly + 58, ly + 70, C.lampGlow);
  }
  return { map, glow };
}

/**
 * 불 켜진 사무실 유리 칸 하나 (텍스처 칸 좌표): 천장 등 줄, 아래쪽 가구 그늘, r에 따라 블라인드·책상과 사람 그림자·서류장.
 * warm: 백열등(주황), 아니면 형광등(창백한 녹색).
 */
function officePane(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, warm: boolean, r: number): void {
  const col = warm ? C.windowLit : C.officeLit;
  rect(g, x, y, w, h, col);
  // 발광은 한 단계 낮춘다 (켜진 사무실이 간판보다 밝지 않게)
  rect(e, x, y, w, h, warm ? '#5e462c' : '#4a5850');
  rect(g, x, y, w, 1, warm ? C.windowLight : C.beam);
  rect(e, x, y, w, 1, warm ? C.windowLit : '#7a8478');
  ditherRect(g, x, y + h - 6, w, 6, C.glass, 6);
  ditherRect(e, x, y + h - 6, w, 6, '#000', 6);
  const dark = (xx: number, yy: number, ww: number, hh: number, c: string) => {
    rect(g, xx, yy, ww, hh, c);
    rect(e, xx, yy, ww, hh, '#000');
  };
  if (r < 0.3) {
    const down = 3 + Math.floor(r * 30);
    for (let yy = y + 1; yy < y + down; yy += 2) dark(x, yy, w, 1, warm ? C.paintOchre : C.chromeDark);
  } else if (r < 0.55) {
    dark(x + 1, y + h - 7, w - 2, 2, C.glass);
    dark(x + 2 + (Math.floor(r * 10) % 5), y + h - 12, 3, 5, C.glass);
    dark(x + 3 + (Math.floor(r * 10) % 5), y + h - 14, 2, 2, C.glass);
  } else if (r < 0.7) {
    dark(x + w - 5, y + h - 11, 4, 11, C.glass);
  }
}

/** 히어로 동상: 돌 받침 위에 주먹을 든 영웅 (어두운 청동 실루엣, 눈 없음). 받침은 상자, 동상은 빛을 받는 그림 판 */
function statue(group: THREE.Group, det: Details): void {
  const x = P.statue.x;
  det.add(x, x + 48, 0, 40, -70, -32, C.stone);
  det.add(x - 3, x + 51, 36, 44, -73, -29, C.stoneDark);
  det.add(x - 3, x + 51, 0, 6, -73, -29, C.stoneDark);
  const [c, g] = canvas(40, 72);
  const bx = 20;
  const by = 71;
  const bronze = C.ironLight;
  rect(g, bx - 7, by - 5, 6, 5, bronze);
  rect(g, bx + 2, by - 5, 6, 5, bronze);
  for (const [a, b] of [[-5, -2], [-4, -1], [5, 2], [6, 3]] as const) line(g, bx + a, by - 5, bx + b, by - 26, bronze);
  rect(g, bx - 5, by - 48, 11, 23, bronze);
  disc(g, bx, by - 55, 6, bronze);
  line(g, bx + 5, by - 46, bx + 14, by - 60, bronze);
  line(g, bx + 6, by - 45, bx + 15, by - 59, bronze);
  rect(g, bx + 13, by - 66, 6, 7, bronze);
  line(g, bx - 5, by - 46, bx - 12, by - 32, bronze);
  line(g, bx - 6, by - 45, bx - 13, by - 31, bronze);
  for (let i = 0; i < 20; i++) rect(g, bx - 7 - Math.floor(i / 3), by - 46 + i, 3, 1, C.iron);
  // 빛 받는 왼쪽 가장자리
  for (let y = by - 48; y < by - 25; y++) rect(g, bx - 5, y, 1, 1, C.chromeDark);
  group.add(plane(x + 4, x + 44, 44, 116, -50, litMaterial(pixelTexture(c), { side: THREE.DoubleSide })));
}
