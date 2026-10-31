import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { BIG, BREAK_RULES, BREAKABLES, tramRestX } from '../../stage/citadel';
import type { PropState } from '../../sim';
import { COLORS as C } from '../palette';
import { canvas, ditherRect, hash, line, rect } from '../dither';
import { Beam, Flame, Puffs, Sparks } from './fx';
import { Details, facedBox } from './kit';
import { paintTram } from './life';
import { lightPool } from './lights';
import { KEEP_Z, paintCitadelSign } from './plaza';
import { decalMaterial, litMaterial, pixelTexture } from './shaders';

/**
 * 큰 물건 4개의 2.5D 모습과 무너지는 연출 (렌더 전용, 게임 기획서 '부서지는 것'의 큰 물건).
 * 단계(멀쩡·망가짐·무너짐)와 무너진 틱은 sim 상태이고, 여기서는 무너진 뒤 지난 틱만 보고 그린다 (같은 틱이면 같은 그림).
 * - 급수탑: 망가지면 물이 새고, 무너지면 옆으로 쓰러져 터지며 물이 지붕에서 길로 쏟아진다
 * - 등대: 망가지면 금이 가고 등이 깜빡이고, 무너지면 꺾인 자리 위가 바다 쪽으로 쓰러져 물보라가 솟는다. 밑동이 남는다
 * - 노면전차: 탈선해 미끄러지며 굴러 뒤집힌다 (반대쪽 옆면이 거꾸로 보이고 바퀴가 위로). 실내등이 깜빡이다 꺼진다
 * - 시타델 간판: 불꽃을 튀며 떨어져 분수에 기대 쓰러진다 (광장 조명은 plaza.ts가 끈다)
 * 쓰러진 뒤의 자리와 높이는 sim의 발판·벽(stage/citadel.ts)과 같은 숫자를 쓴다.
 */

const INTACT: PropState = { hp: 1, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1, at: 0 };
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

interface BigView {
  update(p: PropState, tick: number): void;
}

export class BigProps {
  readonly group = new THREE.Group();
  /** 불꽃·유리 조각 (스스로 빛나는 점) */
  readonly sparks = new Sparks(260);
  /** 물 (새는 물·쏟아지는 물·물보라) */
  readonly water = new Sparks(720);
  /** 먼지와 연기 */
  readonly dust = new Puffs(90, C.stone, C.stoneDark, 7, 0.55);
  private readonly views: Array<{ i: number; v: BigView; x0: number; x1: number }>;

  constructor() {
    const T = D.tram;
    this.views = [
      { i: BIG.watertower, v: new WaterTowerView(this), x0: BREAKABLES[BIG.watertower].x - 40, x1: BREAKABLES[BIG.watertower].x + 160 },
      { i: BIG.lighthouse, v: new LighthouseView(this), x0: -400, x1: 600 },
      { i: BIG.tram, v: new TramWreckView(this), x0: T.x0 - 200, x1: T.x1 + 200 },
      { i: BIG.bigsign, v: new SignFallView(this), x0: D.plaza.sign.x - 300, x1: D.plaza.sign.x + D.plaza.sign.w + 300 },
    ];
    this.group.add(this.sparks.mesh, this.water.mesh, this.dust.mesh);
  }

  /** 상태에 맞는 모습과 연출 (camX0~camX1: 화면 둘레 월드 x. 멀리 있는 물건은 움직임만 맞추고 연출은 건너뛴다) */
  update(props: readonly PropState[] | null, tick: number, camX0: number, camX1: number): void {
    this.sparks.begin();
    this.water.begin();
    this.dust.begin();
    for (const { i, v, x0, x1 } of this.views) {
      if (x1 < camX0 - 60 || x0 > camX1 + 60) continue;
      v.update(props?.[i] ?? INTACT, tick);
    }
    this.sparks.end();
    this.water.end();
    this.dust.end();
  }
}

function solid(color: string): HTMLCanvasElement {
  const [c, g] = canvas(4, 4);
  rect(g, 0, 0, 4, 4, color);
  return c;
}

/** 돌림 축을 (x, y, z)에 둔 무리: 안(inner)에는 월드 좌표 그대로 만든 것을 넣는다 */
function pivotAt(x: number, y: number, z: number): { pivot: THREE.Group; inner: THREE.Group } {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const inner = new THREE.Group();
  inner.position.set(-x, -y, -z);
  pivot.add(inner);
  return { pivot, inner };
}

/** 떨어지며 튀는 불꽃 줄기: (x, y)에서 n개가 life틱마다 다시 떨어진다. 바닥 floor에서 멈춘다 */
function sparkFall(o: BigProps, x: number, y: number, z: number, tick: number, n: number, life: number, seed: number, floor = 0): void {
  for (let i = 0; i < n; i++) {
    const age = (tick + Math.floor((i * life) / n) + seed * 7) % life;
    const vx = (hash(seed * 31 + i * 7) - 0.5) * 1.6;
    const py = y - 0.21 * age * age + hash(i + seed) * 2;
    if (py < floor) continue;
    const hot = age < life * 0.3;
    o.sparks.add(x + vx * age, py, z, hot ? C.fxWhite : age < life * 0.6 ? C.fxYellow : C.fxOrange, hot ? 2.2 : 1.4);
  }
}

// ---------------------------------------------------------------- 옥상 급수탑
const WT = BREAKABLES[BIG.watertower];
const TB = WT.bottom;
/** 탱크 가운데 깊이 (건물 정면 바로 뒤 지붕 위) */
const TZ = -58;
/** 다리, 받침판, 통, 지붕 높이 (합이 sim의 급수탑 높이) */
const LEG = 16;
const DECK = 2;
const CAP = 6;
const TANK = WT.h - LEG - DECK - CAP;
const TR = WT.w / 2;
const TX = WT.x + TR;
/** 물이 흘러내리는 깊이 (건물 정면 바로 앞) */
const SHEET_Z = -38;

class WaterTowerView implements BigView {
  /** 오른쪽 아래 모서리를 축으로 지붕 위에 쓰러진다 */
  private readonly pivot: THREE.Group;
  private readonly tank: THREE.Mesh;
  private readonly tankMats: THREE.ShaderMaterial[];
  private readonly planks: THREE.Mesh;
  private readonly puddle: THREE.Mesh;
  private shown = -1;

  constructor(private readonly o: BigProps) {
    const { pivot, inner } = pivotAt(WT.x + WT.w, TB, TZ);
    this.pivot = pivot;
    const det = new Details();
    // 다리 넷(앞 둘은 밝게)과 엇갈린 가새, 받침판
    for (const [lx, z0, col] of [[WT.x + 3, -50, C.ironLight], [WT.x + WT.w - 5, -50, C.ironLight], [WT.x + 3, -68, C.iron], [WT.x + WT.w - 5, -68, C.iron]] as const) {
      det.add(lx, lx + 2, TB, TB + LEG, z0, z0 + 2, col);
    }
    det.bar(WT.x + 5, TB + 2, WT.x + WT.w - 5, TB + LEG - 2, 1, -49, -48, C.iron);
    det.bar(WT.x + WT.w - 5, TB + 2, WT.x + 5, TB + LEG - 2, 1, -49, -48, C.iron);
    const y0 = TB + LEG + DECK;
    det.add(WT.x - 2, WT.x + WT.w + 2, TB + LEG, y0, -72, -44, C.iron);
    det.add(WT.x - 2, WT.x + WT.w + 2, y0 - 1, y0, -72, -44, C.ironLight);
    // 쇠 띠 셋과 오른쪽 사다리
    for (const k of [4, 14, 24]) det.add(WT.x - 0.5, WT.x + WT.w + 0.5, y0 + k, y0 + k + 1, -48, -46.5, C.iron);
    for (const lx of [WT.x + WT.w - 9, WT.x + WT.w - 4]) det.add(lx, lx + 1, TB + 2, y0 + TANK, -45, -44, C.iron);
    for (let y = TB + 4; y < y0 + TANK; y += 5) det.add(WT.x + WT.w - 9, WT.x + WT.w - 3, y, y + 1, -45, -44, C.iron);
    inner.add(det.build());
    // 나무 통 (세로 널판)과 낮은 원뿔 지붕 (꼭대기가 sim 발판 높이)
    this.tankMats = [0, 1, 2].map((st) => litMaterial(pixelTexture(paintStaves(st))));
    this.tank = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, TANK, 18, 1, false), this.tankMats[0]);
    this.tank.scale.z = 0.6;
    this.tank.position.set(TX, y0 + TANK / 2, TZ);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(TR + 2, CAP, 18), litMaterial(pixelTexture(paintCap())));
    cap.scale.z = 0.6;
    cap.position.set(TX, y0 + TANK + CAP / 2, TZ);
    inner.add(this.tank, cap);
    // 터진 뒤 지붕에 흩어진 널판 조각
    const bits = new Details();
    for (let k = 0; k < 9; k++) {
      const bx = WT.x + WT.w + 4 + Math.floor(hash(k * 13 + 1) * 64);
      const len = 6 + Math.floor(hash(k * 7 + 2) * 9);
      const z = -70 + hash(k * 3) * 30;
      bits.bar(bx, TB + 1, bx + len, TB + 1 + (hash(k * 5) - 0.5) * 4, 2, z, z + 2, k % 3 ? C.awning : C.awningStripe);
    }
    this.planks = bits.build();
    this.planks.visible = false;
    // 길 위 물웅덩이 (쏟아진 물이 고인다)
    const pw = 120;
    this.puddle = new THREE.Mesh(new THREE.PlaneGeometry(pw, 56), decalMaterial(pixelTexture(paintPuddle(pw, 56)), 0.95));
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.position.set(WT.x + WT.w + 20, 0.5, -8);
    this.puddle.visible = false;
    o.group.add(pivot, this.planks, this.puddle);
  }

  update(p: PropState, tick: number): void {
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.tank.material = this.tankMats[p.stage];
      this.planks.visible = p.stage === 2;
      this.puddle.visible = p.stage === 2;
      if (p.stage < 2) this.pivot.rotation.z = 0;
    }
    const y0 = TB + LEG + DECK;
    if (p.stage === 0) return;
    if (p.stage === 1) {
      // 금 간 널판 사이로 물이 새어 지붕에 떨어진다
      for (const [sx, sy, seed] of [[WT.x + 9, y0 + 11, 1], [WT.x + 26, y0 + 19, 2]] as const) {
        for (let i = 0; i < 7; i++) {
          const age = (tick + i * 5 + seed * 3) % 34;
          const py = sy - 0.06 * age * age;
          if (py > TB) this.o.water.add(sx + Math.floor(age * 0.15), py, -45, i % 2 ? C.skyLight : C.sky, 0.6, 1, 2);
        }
      }
      return;
    }
    const t = tick - p.brokenAt;
    // 오른쪽으로 쓰러진다 (22틱에 지붕에 닿아 터진다)
    const u = clamp01(t / 22);
    const bounce = t > 22 && t < 32 ? 0.05 * Math.sin((t - 22) * 0.9) * (1 - (t - 22) / 10) : 0;
    this.pivot.rotation.z = -(Math.PI / 2) * u * u + bounce;
    if (t >= 22 && this.tank.material !== this.tankMats[2]) this.tank.material = this.tankMats[2];
    if (t < 22) return;
    const k = Math.max(0.1, clamp01(1 - (t - 22) / 360));
    // 터진 자리에서 물보라 (처음 잠깐)
    if (t < 50) {
      for (let i = 0; i < 40; i++) {
        const a = hash(i * 17) * Math.PI;
        const r = (t - 22) * (1.2 + hash(i * 3) * 1.6);
        this.o.water.add(WT.x + WT.w + 20 + Math.cos(a) * r, TB + 4 + Math.sin(a) * r * 0.8 - 0.05 * (t - 22) ** 2, -50, i % 3 ? C.skyLight : C.white, 0.8);
      }
    }
    // 지붕 앞 끝에서 길로 쏟아지는 물줄기 (처음 6초 세게, 그 뒤 가늘게)
    const n = Math.round(330 * k);
    const x0 = WT.x + WT.w - 6;
    const span = 70;
    for (let i = 0; i < n; i++) {
      // 가운데가 굵은 물줄기 (가장자리는 성기게)
      const r = hash(i * 3 + 1);
      const x = x0 + Math.floor((0.5 + (r - 0.5) * Math.abs(r - 0.5) * 2) * span * (0.35 + 0.65 * k));
      const age = (tick + i * 13) % 37;
      const py = TB - 0.21 * age * age;
      if (py < 0) continue;
      this.o.water.add(x + Math.round(Math.sin((age + i) * 0.4)), py, SHEET_Z, i % 4 === 0 ? C.white : i % 2 ? C.skyLight : C.sky, 0.7, 1, 2 + Math.min(4, age >> 3));
    }
    // 지붕 끝 물 넘침 띠와 바닥 물보라
    for (let i = 0; i < Math.round(30 * k); i++) {
      const x = x0 + Math.floor(hash(i * 11 + (tick >> 1)) * span);
      this.o.water.add(x, TB - 1 + (i & 1), SHEET_Z + 0.5, C.white, 0.8);
      const sy = Math.abs(Math.sin((tick + i * 7) * 0.3)) * 7 * k;
      this.o.water.add(x + Math.round(Math.cos(tick * 0.2 + i) * 3), sy, SHEET_Z + 6, C.skyLight, 0.7);
    }
    // 물웅덩이가 번진다
    this.puddle.scale.set(clamp01((t - 30) / 160) * 0.9 + 0.1, clamp01((t - 30) / 200) * 0.8 + 0.2, 1);
  }
}

/** 나무 통 널판 (st 0 멀쩡, 1 금 가고 젖음, 2 터짐: 널판이 빠지고 구멍) */
function paintStaves(st: number): HTMLCanvasElement {
  const w = 72;
  const h = TANK;
  const [c, g] = canvas(w, h);
  for (let x = 0; x < w; x += 4) {
    const shade = hash(x * 7) < 0.3 ? C.awningStripe : hash(x * 3) < 0.5 ? C.awning : C.rust;
    rect(g, x, 0, 4, h, shade);
    rect(g, x, 0, 1, h, C.iron);
  }
  ditherRect(g, 0, 0, w, h, C.smog1, 3);
  if (st >= 1) {
    // 금과 젖은 자국
    line(g, 18, 3, 23, 16, C.iron);
    line(g, 52, 8, 49, 24, C.iron);
    for (let k = 0; k < 10; k++) rect(g, Math.floor(hash(k * 5 + 9) * w), Math.floor(hash(k * 11) * h), 1, 4, C.skyDark);
  }
  if (st === 2) {
    // 널판이 빠진 구멍 (안쪽 어둠)
    for (const [hx, hw] of [[8, 8], [28, 12], [56, 8]]) {
      rect(g, hx, 4, hw, h - 9, C.night);
      for (let y = 4; y < h - 5; y += 3) rect(g, hx + (y % 2), y, 1, 2, C.awning);
    }
  }
  return c;
}

function paintCap(): HTMLCanvasElement {
  const [c, g] = canvas(32, 8);
  rect(g, 0, 0, 32, 8, C.iron);
  for (let x = 0; x < 32; x += 4) rect(g, x, 0, 1, 8, C.ironLight);
  ditherRect(g, 0, 0, 32, 8, C.rust, 2);
  return c;
}

/** 물웅덩이: 가장자리가 들쭉날쭉한 짙은 물 (반사가 세다) */
function paintPuddle(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  for (let y = 0; y < h; y++) {
    const v = (y - h / 2) / (h / 2);
    const half = (w / 2) * Math.sqrt(Math.max(0, 1 - v * v)) * (0.85 + 0.15 * hash(y * 3));
    rect(g, Math.round(w / 2 - half), y, Math.round(half * 2), 1, y % 5 ? C.skyDark : C.smog1);
  }
  return c;
}

// ---------------------------------------------------------------- 부두 등대
const H = D.pier.lighthouse;
const HX = H.x + H.w / 2;
const HZ = -26;
const BOTTOM_R = H.w / 2;
const TOP_R = BOTTOM_R * 0.75;
const rAt = (y: number): number => BOTTOM_R + (TOP_R - BOTTOM_R) * (y / H.gallery);

class LighthouseView implements BigView {
  /** 꺾이는 자리 위 (꺾인 자리를 축으로 쓰러진다) */
  private readonly upper: THREE.Group;
  private readonly bodyMats: THREE.ShaderMaterial[];
  private readonly bodies: THREE.Mesh[];
  private readonly lamp: THREE.ShaderMaterial;
  private readonly beam: Beam;
  private readonly lampAt = new THREE.Vector3(HX, H.h - 11, HZ);
  /** 꺾인 밑동 끝 (무너진 뒤에만) */
  private readonly stump: THREE.Mesh;
  private readonly axis = new THREE.Vector3();
  private shown = -1;

  constructor(private readonly o: BigProps) {
    this.bodyMats = [false, true].map((cracked) => litMaterial(pixelTexture(paintLighthouse(cracked))));
    const lower = new Details();
    const upperDet = new Details();
    // 몸통: 꺾이는 높이에서 둘로 나눈 원뿔대 (텍스처는 한 장을 나눠 쓴다)
    const part = (y0: number, y1: number): THREE.Mesh => {
      const geo = new THREE.CylinderGeometry(rAt(y1), rAt(y0), y1 - y0, 24, 1, true);
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setY(i, (y0 + uv.getY(i) * (y1 - y0)) / H.gallery);
      const m = new THREE.Mesh(geo, this.bodyMats[0]);
      m.position.set(HX, (y0 + y1) / 2, HZ);
      return m;
    };
    const low = part(0, H.snap);
    const high = part(H.snap, H.gallery);
    this.bodies = [low, high];
    // 문과 창
    lower.add(HX - 8, HX + 8, 0, 26, HZ + BOTTOM_R - 2, HZ + BOTTOM_R + 1, C.iron);
    for (let y = 60; y < H.gallery - 20; y += 50) {
      (y + 9 < H.snap ? lower : upperDet).add(HX - 3, HX + 3, y, y + 9, HZ + rAt(y) - 4, HZ + rAt(y) - 0.5, C.windowDark);
    }
    // 발코니(아래)와 꼭대기 둘레(위): 원판, 앞 난간, 까치발 (앞 끝이 싸우는 면)
    const rings: THREE.Mesh[] = [];
    for (const [h, w, det] of [[H.balcony, H.balconyW, lower], [H.gallery, H.galleryW, upperDet]] as const) {
      const r = w / 2;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 24), litMaterial(pixelTexture(solid(C.iron))));
      ring.scale.z = (-HZ + 2) / r;
      ring.position.set(HX, h - 1.5, HZ);
      rings.push(ring);
      det.add(HX - r, HX + r, h - 0.6, h, 0, 1.5, C.ironLight);
      for (let x = HX - r; x <= HX + r - 1; x += 5) det.add(x, x + 1, h, h + 9, 1, 2, C.iron);
      det.add(HX - r, HX + r, h + 9, h + 10, 1, 2, C.ironLight);
      det.bar(HX - r + 2, h - 3, HX - 14, h - 14, 1, HZ + 4, HZ + 14, C.iron);
      det.bar(HX + r - 2, h - 3, HX + 14, h - 14, 1, HZ + 4, HZ + 14, C.iron);
    }
    // 등실(빛나는 유리)과 지붕, 피뢰침
    this.lamp = litMaterial(pixelTexture(paintLantern(false)), { emissive: pixelTexture(paintLantern(true)), emissiveStrength: 1.8 });
    const room = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, H.h - H.gallery, 16, 1, false), this.lamp);
    room.position.set(HX, (H.h + H.gallery) / 2, HZ);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(14, 10, 16), litMaterial(pixelTexture(solid(C.iron))));
    roof.position.set(HX, H.h + 5, HZ);
    upperDet.add(HX, HX + 1, H.h + 10, H.h + 17, HZ - 0.5, HZ + 0.5, C.ironLight);
    // 꺾인 밑동 끝: 들쭉날쭉한 벽 조각과 삐져나온 철근
    const stump = new Details();
    const r0 = rAt(H.snap);
    for (let k = 0; k < 8; k++) {
      const x = HX - r0 + k * ((r0 * 2) / 8);
      const hgt = 2 + Math.floor(hash(k * 7 + 3) * 7);
      stump.add(x, x + (r0 * 2) / 8, H.snap - 1, H.snap + hgt, HZ + r0 - 3, HZ + r0, k % 2 ? C.paintCream : C.posterRed);
    }
    for (let k = 0; k < 3; k++) stump.bar(HX - 8 + k * 7, H.snap, HX - 10 + k * 9, H.snap + 9 + k * 3, 1, HZ + r0 - 2, HZ + r0 - 1, C.iron);
    this.stump = stump.build();
    this.stump.visible = false;
    // 등실에서 바다 쪽을 쓸고 지나가는 빛줄기
    this.beam = new Beam(380, 30, C.beam, 0.24, 2);
    this.beam.pivot.position.copy(this.lampAt);
    // 꺾이는 자리 위는 한 무리로 (쓰러질 때 함께 돈다)
    const { pivot, inner } = pivotAt(HX, H.snap, HZ);
    this.upper = pivot;
    inner.add(high, rings[1], room, roof, upperDet.build(), this.beam.pivot);
    o.group.add(low, rings[0], lower.build(), this.stump, pivot);
  }

  update(p: PropState, tick: number): void {
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      for (const m of this.bodies) m.material = this.bodyMats[p.stage > 0 ? 1 : 0];
      this.stump.visible = p.stage === 2;
      if (p.stage < 2) {
        this.upper.visible = true;
        this.upper.quaternion.identity();
        this.upper.position.set(HX, H.snap, HZ);
      }
    }
    if (p.stage < 2) {
      // 망가지면 등이 깜빡인다
      const on = p.stage === 0 || hash((tick >> 2) * 13 + 1) > 0.3;
      this.lamp.uniforms.emissiveStrength.value = on ? 1.8 : 0.15;
      this.beam.mesh.visible = on;
      this.beam.aim(Math.PI / 2 - 0.35 + 0.55 * Math.sin(tick * 0.02));
      if (on) lightPool.add(this.lampAt.x, this.lampAt.y, this.lampAt.z + 20, 80, C.lampGlow, 1.3);
      return;
    }
    const t = tick - p.brokenAt;
    this.lamp.uniforms.emissiveStrength.value = 0;
    this.beam.mesh.visible = false;
    // 바다 쪽(뒤)으로, 맞은 방향으로 조금 기울며 쓰러진다. 40틱이면 수평을 지나 바다로 빠진다
    const dx = Math.sign(p.dir || 1) * 0.5;
    const dz = -1;
    const len = Math.hypot(dx, dz);
    this.axis.set(dz / len, 0, -dx / len);
    const fall = Math.min(1.9, 1.75 * (t / 40) ** 2);
    this.upper.quaternion.setFromAxisAngle(this.axis, fall);
    this.upper.position.set(HX, H.snap - (t > 40 ? 0.5 * (t - 40) ** 2 : 0), HZ);
    this.upper.visible = t < 58;
    // 꺾인 자리에서 오르는 먼지·연기
    if (t < 900) {
      for (let k = 0; k < 4; k++) {
        const life = 120;
        const age = (tick + k * 30) % life;
        const u = age / life;
        this.o.dust.add(HX + Math.sin(age * 0.06 + k) * 4 + u * 8, H.snap + 4 + age * 0.4, HZ + 10, 8 + u * 16, (1 - u) * (1 - t / 900));
      }
    }
    // 등실이 바다에 빠지는 자리에서 물보라 (44틱부터 40틱 동안)
    const sx = HX + (dx / len) * 106;
    const sz = HZ + (dz / len) * 106;
    if (t >= 42 && t < 110) {
      const a = t - 42;
      for (let i = 0; i < 140; i++) {
        const vx = (hash(i * 7) - 0.5) * 3;
        const vy = 3 + hash(i * 13) * 6.5;
        const py = vy * a - 0.16 * a * a;
        if (py < 0) continue;
        this.o.water.add(sx + vx * a, py, sz, i % 3 ? C.skyLight : C.white, 1.1, 2, 2);
      }
      for (let k = 0; k < 6; k++) this.o.dust.add(sx + (k - 2.5) * 10 + a * (k - 2.5) * 0.3, 10 + a * 0.6, sz + 2, 14 + a * 0.5, Math.max(0, 0.8 - a / 70));
    }
  }
}

/** 등대 몸통: 붉은 띠와 흰 띠 (28px마다). cracked면 금과 떨어진 칠 */
function paintLighthouse(cracked: boolean): HTMLCanvasElement {
  const w = 96;
  const [c, g] = canvas(w, H.gallery);
  for (let y = 0; y < H.gallery; y++) {
    const band = Math.floor((H.gallery - y) / 28) % 2 ? C.paintCream : C.posterRed;
    rect(g, 0, y, w, 1, band);
  }
  ditherRect(g, 0, 0, w, H.gallery, C.smog1, 4);
  for (let k = 0; k < 40; k++) rect(g, Math.floor(hash(k * 13) * w), Math.floor(hash(k * 7 + 1) * H.gallery), 1, 3, C.smog3);
  if (cracked) {
    // 꺾일 자리 둘레로 칠이 떨어져 벽돌이 드러나고, 굵은 금이 갈라져 나간다
    const y = H.gallery - H.snap;
    for (let k = 0; k < 18; k++) {
      const cx = Math.floor(hash(k * 29) * w);
      const cy = y - 8 + Math.floor(hash(k * 3) * 16);
      rect(g, cx, cy, 4 + (k % 3), 3, k % 2 ? C.brickRed : C.brickLight);
    }
    for (let k = 0; k < 8; k++) {
      const x = 4 + k * 12;
      const y0 = y - 4 + (k % 3) * 2;
      line(g, x, y0, x + 11, y0 + (k % 2 ? 3 : -3), C.night);
      line(g, x, y0 + 1, x + 11, y0 + 1 + (k % 2 ? 3 : -3), C.night);
      line(g, x + 5, y0, x + 3 + (k % 2), y0 + 16, C.night);
      line(g, x + 6, y0, x + 9, y0 - 12, C.night);
    }
  }
  return c;
}

/** 등실 유리: 쇠 기둥 사이로 빛나는 등. glow는 빛나는 부분만 */
function paintLantern(glow: boolean): HTMLCanvasElement {
  const [c, g] = canvas(32, 30);
  rect(g, 0, 0, 32, 30, glow ? '#000' : C.iron);
  rect(g, 0, 2, 32, 26, C.lampWarm);
  rect(g, 12, 6, 8, 12, C.lampCore);
  if (!glow) for (let x = 0; x < 32; x += 8) rect(g, x, 0, 1, 30, C.iron);
  return c;
}

// ---------------------------------------------------------------- 노면전차 (탈선해 뒤집힘)
const TRAM = D.tram;
/** 차체 높이 (뒤집힌 뒤 윗면 = sim의 누운 높이)와 폭. 다니는 전차 옆면 깊이 */
const BODY = TRAM.lyingH;
const WIDE = 40;
const TRAM_Z = -4;

class TramWreckView implements BigView {
  /** 차체 가운데 긴 축을 축으로 굴러 뒤집힌다 */
  private readonly pivot = new THREE.Group();
  private readonly box: THREE.Mesh;
  /** 옆면 [앞쪽 옆면, 반대쪽 옆면] × 달리던 방향 둘 */
  private readonly sides: THREE.ShaderMaterial[][];
  private shown = -1;

  constructor(private readonly o: BigProps) {
    this.sides = [1, -1].map((dir) => [dir, -dir].map((d) => {
      const t = paintTram(d);
      return litMaterial(pixelTexture(cropBottom(t.map, BODY)), { emissive: pixelTexture(cropBottom(t.glow, BODY)), emissiveStrength: 1 });
    }));
    const under = litMaterial(pixelTexture(paintTramUnder()));
    const roof = litMaterial(pixelTexture(solid(C.smog2)), { tint: 0.7 });
    const end = litMaterial(pixelTexture(paintTramEnd()), { tint: 0.8 });
    // 가운데를 원점으로 (굴러도 제자리에서 돈다)
    this.box = facedBox(-TRAM.length / 2, TRAM.length / 2, -BODY / 2, BODY / 2, -WIDE / 2, WIDE / 2, {
      pz: this.sides[0][0], nz: this.sides[0][1], ny: under, py: roof, px: end, nx: end,
    });
    this.pivot.add(this.box);
    this.pivot.visible = false;
    o.group.add(this.pivot);
  }

  update(p: PropState, tick: number): void {
    const mats = this.box.material as THREE.ShaderMaterial[];
    const pair = this.sides[p.dir < 0 ? 1 : 0];
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.pivot.visible = p.stage === 2;
      if (p.stage === 2) {
        const all = this.sides.flat();
        let k = 0;
        mats.forEach((m, i) => {
          if (all.includes(m)) mats[i] = pair[k++];
        });
      }
    }
    if (p.stage < 2) return;
    const t = tick - p.brokenAt;
    const rest = tramRestX(p.at);
    // 탈선해 미끄러지며 (20틱) 튀어 올라 긴 축으로 굴러 (30틱) 뒤집혀 떨어지고 몇 번 들썩인다
    const s = clamp01(t / 20);
    const x = p.at + (rest - p.at) * (1 - (1 - s) ** 3);
    const u = clamp01(t / 30);
    const hop = Math.sin(Math.PI * u) * 26;
    const settle = t > 30 && t < 44 ? 2.5 * Math.abs(Math.sin((t - 30) * 0.9)) * (1 - (t - 30) / 14) : 0;
    const roll = Math.PI * (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
    this.pivot.position.set(Math.round(x + TRAM.length / 2), BODY / 2 + hop + settle, TRAM_Z - WIDE / 2);
    this.pivot.rotation.x = -roll;
    // 실내등: 구르며 깜빡이다 꺼진다 (뒤집힌 뒤에는 거꾸로 된 창에서 가끔)
    const flick = t < 8 ? 1 : t < 240 && hash(Math.floor(t / 3) * 11) < 0.55 - t / 480 ? 0.8 : 0;
    for (const m of pair) m.uniforms.emissiveStrength.value = flick;
    if (flick > 0 && t > 30) lightPool.add(x + TRAM.length / 2, BODY * 0.3, 2, 80, C.windowLight, 0.6 * flick);
    // 떨어지는 순간 먼지가 길게 일고, 그 뒤 바퀴 쪽에서 연기, 가끔 불꽃
    if (t >= 28 && t < 130) {
      const a = t - 28;
      for (let k = 0; k < 10; k++) {
        const px0 = x + (k + 0.5) * (TRAM.length / 10);
        this.o.dust.add(px0 + (k - 4.5) * a * 0.15, 4 + a * 0.12, 0, 10 + a * 0.25, Math.max(0, 1 - a / 102));
      }
    }
    if (t >= 30 && t < 1200) {
      for (let k = 0; k < 3; k++) {
        const life = 140;
        const age = (tick + k * 47) % life;
        const v = age / life;
        this.o.dust.add(x + 40 + k * 38 + v * 10, BODY + age * 0.35, -20, 7 + v * 14, (1 - v) * 0.8 * (1 - t / 1200));
      }
      if (hash(Math.floor(tick / 4) * 37 + 3) < 0.18) sparkFall(this.o, x + (p.dir < 0 ? TRAM.length - 30 : 30), BODY + 2, 0, tick, 8, 20, 5);
    }
  }
}

/** 캔버스 아래 rows줄만 잘라 낸다 (전차 그림에서 차체만) */
function cropBottom(src: HTMLCanvasElement, rows: number): HTMLCanvasElement {
  const [c, g] = canvas(src.width, rows);
  g.drawImage(src, 0, src.height - rows, src.width, rows, 0, 0, src.width, rows);
  return c;
}

/** 전차 밑바닥 (누우면 카메라 쪽): 녹슨 차대, 가로 받침, 바퀴 넷씩 달린 대차 둘, 전동기 상자, 위아래로 차체 가장자리 */
function paintTramUnder(): HTMLCanvasElement {
  const w = TRAM.length;
  const h = WIDE;
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.iron);
  rect(g, 0, 0, w, 3, C.carMint);
  rect(g, 0, h - 3, w, 3, C.carMint);
  rect(g, 0, 3, w, 1, C.chromeDark);
  rect(g, 0, h - 4, w, 1, C.chromeDark);
  for (const y of [10, h - 12]) rect(g, 4, y, w - 8, 2, C.ironLight);
  for (let x = 8; x < w - 6; x += 12) rect(g, x, 6, 2, h - 12, C.smog2);
  for (const bx of [16, w - 52]) {
    rect(g, bx, 8, 36, h - 16, C.smog1);
    rect(g, bx, 8, 36, 1, C.ironLight);
    for (const wx of [bx + 3, bx + 25]) {
      for (const wy of [9, h - 17]) {
        rect(g, wx, wy, 8, 8, C.chromeDark);
        rect(g, wx + 1, wy + 3, 6, 2, C.chrome);
      }
    }
    rect(g, bx + 13, h / 2 - 3, 10, 6, C.iron);
  }
  rect(g, w / 2 - 14, h / 2 - 5, 28, 10, C.smog1);
  rect(g, w / 2 - 14, h / 2 - 5, 28, 1, C.ironLight);
  ditherRect(g, 0, 0, w, h, C.rust, 3);
  for (let k = 0; k < 16; k++) rect(g, Math.floor(hash(k * 19) * w), Math.floor(hash(k * 23) * h), 2, 1, C.rust);
  return c;
}

/** 전차 앞뒤 끝 (크림색 위, 녹색 아래, 창 하나) */
function paintTramEnd(): HTMLCanvasElement {
  const [c, g] = canvas(WIDE, BODY);
  rect(g, 0, 0, WIDE, BODY, C.carCream);
  rect(g, 0, BODY - 30, WIDE, 30, C.carMint);
  rect(g, 8, 12, WIDE - 16, 14, C.windowDark);
  rect(g, 0, BODY - 32, WIDE, 2, C.chrome);
  ditherRect(g, 0, 0, WIDE, BODY, C.smog1, 3);
  return c;
}

// ---------------------------------------------------------------- 시타델 정면 대형 간판
const SG = D.plaza.sign;
/** 걸려 있던 깊이와 쓰러져 기댄 아래 끝 깊이, 기운 각 (윗변 높이가 sim 발판 높이가 되게) */
const SIGN_Z = KEEP_Z + 3.5;
const REST_Z = -14;
const LEAN = Math.acos(SG.lyingH / SG.h);
/** 걸쇠가 끊어져 떨어지기 시작하는 틱과 바닥에 닿는 틱 (닿는 틱 = sim이 발판을 놓는 틱) */
const DROP_AT = 6;
const LAND_AT = BREAK_RULES.settle;
const DROP_G = (2 * SG.bottom) / (LAND_AT - DROP_AT) ** 2;

class SignFallView implements BigView {
  /** 판 아래 변 가운데를 축으로 */
  private readonly pivot = new THREE.Group();
  private readonly face: THREE.ShaderMaterial;
  private readonly cables: THREE.Mesh;
  private readonly fires: Flame[] = [];
  private shown = -1;

  constructor(private readonly o: BigProps) {
    const t = paintCitadelSign();
    const [mc, mg] = canvas(SG.w, SG.h);
    mg.drawImage(t.map, t.plateX0, 0, SG.w, SG.h, 0, 0, SG.w, SG.h);
    // 떨어진 간판: 찌그러진 모서리와 금
    line(mg, 10, 0, 22, 18, C.smog1);
    line(mg, SG.w - 30, SG.h - 1, SG.w - 12, SG.h - 20, C.smog1);
    rect(mg, SG.w - 9, 0, 9, 7, C.night);
    const [ec, eg] = canvas(SG.w, SG.h);
    eg.drawImage(t.glow, t.plateX0, 0, SG.w, SG.h, 0, 0, SG.w, SG.h);
    this.face = litMaterial(pixelTexture(mc), { emissive: pixelTexture(ec), emissiveStrength: 1.8 });
    const back = litMaterial(pixelTexture(solid(C.iron)));
    const plate = facedBox(-SG.w / 2, SG.w / 2, 0, SG.h, -5, 0, { pz: this.face, nz: back, py: back, px: back, nx: back });
    this.pivot.add(plate);
    this.pivot.visible = false;
    // 본관 정면에 남은 끊긴 전선 둘
    const det = new Details();
    for (const [mx, dx] of [[SG.x + 12, -4], [SG.x + SG.w - 12, 5]] as const) {
      det.bar(mx, SG.bottom + SG.h, mx + dx, SG.bottom + SG.h - 26, 1, KEEP_Z + 6, KEEP_Z + 7, C.iron);
    }
    this.cables = det.build();
    this.cables.visible = false;
    // 쓰러진 간판 밑에서 타는 불 (어두워진 광장의 빛)
    for (let k = 0; k < 2; k++) {
      const f = new Flame(18, 16, 40 + k);
      this.fires.push(f);
      o.group.add(f.mesh);
    }
    o.group.add(this.pivot, this.cables);
  }

  update(p: PropState, tick: number): void {
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.pivot.visible = p.stage === 2;
      this.cables.visible = p.stage === 2;
      if (p.stage < 2) for (const f of this.fires) f.set(0, 0, 0, 0);
    }
    if (p.stage < 2) return;
    const t = tick - p.brokenAt;
    const cx = SG.x + SG.w / 2;
    const dir = Math.sign(p.dir || 1);
    let y: number;
    let z: number;
    let lean: number;
    let roll: number;
    if (t < DROP_AT) {
      // 걸쇠가 끊어지며 한쪽으로 처진다
      y = SG.bottom - t * 0.4;
      z = SIGN_Z;
      lean = 0;
      roll = dir * 0.012 * t;
    } else if (t < LAND_AT) {
      const a = t - DROP_AT;
      const u = a / (LAND_AT - DROP_AT);
      y = Math.max(0, SG.bottom - DROP_AT * 0.4 - 0.5 * DROP_G * a * a);
      z = SIGN_Z + (REST_Z - SIGN_Z) * u;
      lean = LEAN * u * u;
      roll = dir * 0.1 * (1 - u);
    } else {
      const a = t - LAND_AT;
      y = a < 10 ? 3 * Math.abs(Math.sin(a * 0.8)) * (1 - a / 10) : 0;
      z = REST_Z;
      lean = LEAN;
      roll = 0;
    }
    this.pivot.position.set(cx, y, z);
    this.pivot.rotation.set(-lean, 0, roll);
    // 글씨: 떨어지는 동안 깜빡이고, 바닥에 닿은 뒤 가끔 살아났다 꺼진다
    const glow = t < LAND_AT ? (hash(Math.floor(t / 2) * 7 + 1) < 0.5 ? 1.6 : 0.1) : t < LAND_AT + 240 && hash(Math.floor(t / 3) * 13) < 0.1 ? 1 : 0;
    this.face.uniforms.emissiveStrength.value = glow;
    if (glow > 0.5) lightPool.add(cx, y + SG.h / 2, z + 30, 120, C.beam, 0.8 * glow);
    // 끊긴 전선에서 쏟아지는 불꽃 (처음 2초), 바닥에 닿은 뒤에는 간판 끝에서 가끔 합선 불꽃
    if (t < 120) {
      const n = t < 30 ? 14 : 6;
      sparkFall(this.o, SG.x + 12, SG.bottom + SG.h - 2, KEEP_Z + 12, tick, n, 30, 1);
      sparkFall(this.o, SG.x + SG.w - 12, SG.bottom + SG.h - 2, KEEP_Z + 12, tick, n, 30, 2);
      if (t < 30) lightPool.add(cx, SG.bottom + SG.h, KEEP_Z + 40, 90, C.fxYellow, 0.9);
    }
    if (t >= LAND_AT && t < LAND_AT + 600 && hash(Math.floor(tick / 5) * 19 + 7) < 0.25) {
      const ex = hash(Math.floor(tick / 5)) < 0.5 ? SG.x + 6 : SG.x + SG.w - 6;
      sparkFall(this.o, ex, SG.lyingH, -20, tick, 10, 18, 3);
      lightPool.add(ex, SG.lyingH, -10, 60, C.skyLight, 0.9);
    }
    // 바닥에 닿는 순간 먼지 (간판 폭만큼)
    if (t >= LAND_AT && t < LAND_AT + 100) {
      const a = t - LAND_AT;
      for (let k = 0; k < 9; k++) {
        const px0 = SG.x + (k + 0.5) * (SG.w / 9);
        this.o.dust.add(px0 + (k - 4) * a * 0.2, 3 + a * 0.15, -6, 10 + a * 0.3, Math.max(0, 1 - a / 100));
      }
    }
    // 간판 아래에서 타는 불: 15초 동안 줄어들며 광장의 몇 안 남은 빛이 된다
    const fire = t >= LAND_AT ? clamp01(1 - (t - LAND_AT) / 900) : 0;
    this.fires.forEach((f, k) => {
      if (fire <= 0) return f.set(0, 0, 0, 0);
      const fx = cx + (k ? 34 : -46);
      const h = Math.round(6 + 10 * fire);
      f.set(fx, 1, REST_Z + 2, h);
      lightPool.add(fx + 9, h, -4, 50 + h * 4, C.fxOrange, (0.8 + 0.4 * hash((tick >> 2) * 7 + k)) * fire);
    });
  }
}
