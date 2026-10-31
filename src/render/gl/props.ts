import * as THREE from 'three';
import type { CityState, PropState } from '../../sim';
import { CITADEL as D } from '../../data/stages/citadel';
import { BREAKABLES, chunkIndex, FRONT, GLASS_BOTTOM, GRIDS, marqueeOf, type Breakable } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { hash } from '../dither';
import { FRONT_Z } from './buildings';
import { Flame, Puffs, Sparks, WaterColumn } from './fx';
import { box, Details, facedBox, Geo, plane } from './kit';
import { lightPool } from './lights';
import {
  boardStrip, NEON_HEX, paintBillboard, paintGlass, paintMarquee, paintNewsstand, paintNewsWreck, paintPapers, paintPuddle, paintScorch,
  paintShards, paintSign, type SignTex,
} from './proptex';
import { decalMaterial, litMaterial, pixelTexture, scrollMaterial, shaftMaterial } from './shaders';
import { paintCar, paintCarWreck, paintSide } from './tex';

/**
 * 부서지는 물건 41개의 2.5D 모습 (렌더 전용). 상태(멀쩡·망가짐·파괴, 언제 부서졌는지)는 sim이 정하고,
 * 여기서는 그 상태와 지난 틱으로 모습(단계마다 미리 그린 텍스처를 바꿔 낌)과 연출(불길·연기·불꽃·물기둥·깜빡임)만 정한다.
 * 빛을 내는 물건(가로등·네온 간판·쇼윈도·불붙은 차)은 광원 후보를 낸다. 부서지면 빛도 꺼진다.
 * 건물에 붙은 쇼윈도·간판은 받치던 덩어리가 무너지면 같이 사라진다.
 * 깊이: 쇼윈도·간판은 건물 정면, 가판대·소화전·가로등은 보도, 차는 길가 주차 줄(-22~-8). 바닥 무늬(유리 조각·그을음·
 * 물웅덩이·신문지)는 싸우는 면 앞 길 위에 깐다 (거의 수평으로 보는 카메라라 그 앞에 깔아야 보인다).
 */

/** 간판 위계: 구간마다 주인공 간판 하나만 가장 밝게. 나머지는 어둡거나, 깜빡이거나, 꺼짐 */
type SignRole = 'hero' | 'dim' | 'flicker' | 'off' | 'marquee' | 'board';
const SIGN_ROLE: Record<string, SignRole> = {
  'blade:PALACE': 'hero',
  'marquee:TONIGHT': 'marquee',
  'board:DINER': 'dim',
  'blade:HOTEL': 'flicker',
  'shop:HOTEL': 'off',
  'shop:BAKERY': 'off',
  'shop:RADIO': 'hero',
  'shop:LAUNDRY': 'flicker',
  'shop:GROCER': 'dim',
};
const roleOf = (b: Breakable): SignRole => (b.style === 'billboard' ? 'board' : SIGN_ROLE[`${b.style}:${b.text}`] ?? 'off');

const INTACT: PropState = { hp: 1, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1 };
const CAR_Z0 = -22;
const CAR_Z1 = -8;
const LAMP_Z = -30;

/** 바닥 무늬 판 (싸우는 면 앞 길 위): x0~x1, 깊이 z0~z1 */
function decal(x0: number, x1: number, z0: number, z1: number, c: HTMLCanvasElement, wet: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), decalMaterial(pixelTexture(c), wet));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, 0.4, (z0 + z1) / 2);
  m.visible = false;
  return m;
}

interface View {
  /** 마지막으로 맞춘 단계 (화면 밖이어도 단계가 바뀌면 모습을 맞춘다) */
  shown: number;
  update(p: PropState, tick: number, gone: boolean): void;
}

export class Props {
  readonly group = new THREE.Group();
  private readonly views: Array<View | null> = [];
  readonly smoke = new Puffs(80, C.smoke, C.smokeDark, 7, 0.65);
  readonly sparks = new Sparks(160);

  constructor() {
    const det = new Details();
    BREAKABLES.forEach((b, i) => {
      switch (b.kind) {
        case 'car':
          this.views.push(new CarView(this, b, i));
          break;
        case 'lamp':
          this.views.push(new LampView(this, b, i, det));
          break;
        case 'glass':
          this.views.push(new GlassView(this, b, i));
          break;
        case 'neon':
          this.views.push(b.style === 'marquee' ? new MarqueeView(this, b, i) : b.style === 'billboard' ? new BillboardView(this, b, i, det) : new SignView(this, b, i, det));
          break;
        case 'newsstand':
          this.views.push(new NewsView(this, b, i));
          break;
        case 'hydrant':
          this.views.push(new HydrantView(this, b, i));
          break;
        default:
          this.views.push(null);
      }
    });
    this.group.add(det.build(), this.smoke.mesh, this.sparks.mesh);
  }

  /** 상태에 맞는 모습과 연출, 빛 후보 (camX0~camX1: 화면 둘레 월드 x, 밖의 물건은 연출을 건너뛴다) */
  update(props: readonly PropState[] | null, city: CityState | null, tick: number, camX0: number, camX1: number): void {
    this.smoke.begin();
    this.sparks.begin();
    BREAKABLES.forEach((b, i) => {
      const v = this.views[i];
      if (!v) return;
      const p = props?.[i] ?? INTACT;
      const gone = !!city && b.b >= 0 && city.hp[chunkIndex(GRIDS[b.b], b.col, b.row)] < 0;
      const near = b.x + b.w > camX0 - 120 && b.x < camX1 + 120;
      if (near || p.stage !== v.shown) v.update(p, tick, gone);
    });
    this.smoke.end();
    this.sparks.end();
  }
}

/** 깜빡이는 불길 빛과 연기 */
function burn(owner: Props, x: number, y: number, w: number, h: number, tick: number, seed: number, puffs: number, smokeX: number, smokeY: number): void {
  lightPool.add(x + w / 2, y + h / 2, -6, 40 + h * 3, C.fxOrange, 0.9 + 0.5 * hash((tick >> 2) * 7 + seed));
  for (let k = 0; k < puffs; k++) {
    const life = 110;
    const age = (tick + k * (life / puffs) + seed * 13) % life;
    const u = age / life;
    owner.smoke.add(smokeX + Math.sin((age + seed * 9) * 0.07) * 4 + u * 10, smokeY + age * 0.5, -4 + k * 0.05, 8 + u * 18, (1 - u) * (u < 0.1 ? u * 10 : 1));
  }
}

// ---------------------------------------------------------------- 1960년대 세단
const PAINTS = [C.carMint, C.carCoral, C.paintTeal, C.posterRed];

class CarView implements View {
  shown = -1;
  private readonly body: THREE.Mesh;
  private readonly sides: THREE.ShaderMaterial[];
  private readonly wreck: THREE.Mesh;
  private readonly scorch: THREE.Mesh;
  private readonly small: Flame;
  private readonly big: Flame;

  constructor(private readonly owner: Props, private readonly b: Breakable, private readonly i: number) {
    const w = Math.round(b.w);
    const h = 34;
    const paint = PAINTS[i % PAINTS.length];
    this.sides = [false, true].map((dent) => {
      const t = paintCar(w, h, paint, i, dent);
      return litMaterial(pixelTexture(t.map), { emissive: pixelTexture(t.glow), emissiveStrength: 0.8 });
    });
    const end = litMaterial(pixelTexture(paintSide(14, h, i, 2)), { tint: 0.5 });
    const top = litMaterial(pixelTexture(paintSide(w, 14, i, 2)), { tint: 0.3 });
    this.body = facedBox(b.x, b.x + w, 0, h, CAR_Z0, CAR_Z1, { px: end, nx: end, py: top, pz: this.sides[0] });
    const wc = paintCarWreck(w, 22);
    const wm = litMaterial(pixelTexture(wc));
    this.wreck = facedBox(b.x - 4, b.x - 4 + wc.width, 0, 22, CAR_Z0 + 2, CAR_Z1 - 2, { px: end, nx: end, py: top, pz: wm });
    this.wreck.visible = false;
    this.scorch = decal(b.x - 14, b.x + w + 14, -26, 40, paintScorch(w + 28, 66), 0.05);
    this.small = new Flame(20, 14, i);
    this.big = new Flame(w - 26, 22, i + 7);
    owner.group.add(this.body, this.wreck, this.scorch, this.small.mesh, this.big.mesh);
  }

  update(p: PropState, tick: number): void {
    const b = this.b;
    const w = Math.round(b.w);
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.body.visible = p.stage < 2;
      this.wreck.visible = p.stage === 2;
      this.scorch.visible = p.stage === 2;
      if (p.stage < 2) {
        // 옆면 재질만 바꿔 낀다 (멀쩡 ↔ 찌그러짐)
        const mats = this.body.material as THREE.Material[];
        const k = mats.findIndex((m) => this.sides.includes(m as THREE.ShaderMaterial));
        mats[k] = this.sides[p.stage];
      }
    }
    if (p.stage === 0) {
      this.small.set(0, 0, 0, 0);
      this.big.set(0, 0, 0, 0);
      lightPool.add(b.x + 3, 13, CAR_Z1 + 2, 18, C.neonRed, 0.45);
      return;
    }
    if (p.stage === 1) {
      const since = p.damagedAt >= 0 ? tick - p.damagedAt : 0;
      const h = 8 + Math.min(6, since >> 5);
      this.small.set(b.x + w - 28, 14, CAR_Z1 + 0.5, h);
      this.big.set(0, 0, 0, 0);
      burn(this.owner, b.x + w - 28, 14, 20, h, tick, this.i, 4, b.x + w - 18, 24);
      return;
    }
    const since = p.brokenAt >= 0 ? tick - p.brokenAt : 0;
    const fire = Math.max(0, 1 - since / 420);
    this.small.set(0, 0, 0, 0);
    if (fire > 0) {
      const h = Math.round(6 + 14 * fire);
      this.big.set(b.x + 12, 6, CAR_Z1 - 1.5, h);
      burn(this.owner, b.x + 12, 6, w - 26, h, tick, this.i, 5, b.x + w / 2, 20);
    } else {
      this.big.set(0, 0, 0, 0);
      // 다 탄 뒤에도 가는 연기
      for (let k = 0; k < 3; k++) {
        const age = (tick + k * 37 + this.i * 13) % 110;
        const u = age / 110;
        this.owner.smoke.add(b.x + w / 2 + Math.sin(age * 0.07) * 4 + u * 10, 16 + age * 0.5, -4, 6 + u * 14, (1 - u) * 0.7);
      }
    }
  }
}

// ---------------------------------------------------------------- 코브라 헤드 나트륨 가로등
class LampView implements View {
  shown = -1;
  private readonly pole = new THREE.Group();
  private readonly upper = new THREE.Group();
  private readonly lens: THREE.ShaderMaterial;
  private readonly shaft: THREE.Mesh;
  private readonly side: number;
  private readonly cx: number;
  private shownDir = 0;
  /** 쓰러진 머리 쪽 길에 흩어진 유리 조각 (오른쪽·왼쪽으로 쓰러졌을 때) */
  private readonly bits: THREE.Mesh[];

  constructor(private readonly owner: Props, b: Breakable, private readonly i: number, det: Details) {
    const cx = b.x + b.w / 2;
    this.cx = cx;
    this.side = i % 2 ? -1 : 1;
    // 밑동 (쓰러져도 남는다)
    det.add(cx - 4, cx + 5, 0, 4, LAMP_Z - 4, LAMP_Z + 4, C.iron);
    // 기둥 아래 (밑동 위 4에서 돌아 쓰러진다)
    const lower = new Details();
    lower.add(-2, 2, 0, 70, -2, 2, C.iron);
    lower.add(1, 2, 0, 70, 2, 2.2, C.ironLight);
    this.pole.add(lower.build());
    this.pole.position.set(cx, 4, LAMP_Z);
    // 기둥 위·팔·머리 (74에서 휘어진다)
    const up = new Details();
    const s = this.side;
    up.add(-1.5, 1.5, 0, 30, -1.5, 1.5, C.iron);
    const armX0 = s > 0 ? 0 : -18;
    up.add(armX0, armX0 + 18, 28, 31, -1.5, 1.5, C.iron);
    const hx = s * 18;
    up.add(hx - 7, hx + 7, 30, 35, -4, 4, C.chromeDark);
    up.add(hx - 7, hx + 7, 34, 35, -4, 4, C.chrome);
    this.upper.add(up.build());
    this.lens = litMaterial(pixelTexture(solid(C.sodium)), { emissive: pixelTexture(solid(C.sodium)), emissiveStrength: 3 });
    this.upper.add(box(hx - 5, hx + 5, 28.5, 30, -3, 3, this.lens));
    const smat = shaftMaterial(C.sodium, 0.22);
    smat.transparent = false;
    this.shaft = new THREE.Mesh(new THREE.ConeGeometry(42, 102, 20, 1, true), smat);
    this.shaft.renderOrder = 2;
    this.shaft.position.set(hx, 28 - 51, 0);
    this.upper.add(this.shaft);
    this.upper.position.set(0, 70, 0);
    this.pole.add(this.upper);
    owner.group.add(this.pole);
    this.pole.updateMatrixWorld(true);
    this.bits = [1, -1].map((d) => {
      const x0 = cx + d * 78 - 16;
      const m = decal(x0, x0 + 32, -2, 22, paintGlassBits(32, 24, i + d), 0.5);
      owner.group.add(m);
      return m;
    });
  }

  update(p: PropState, tick: number): void {
    const dir = p.dir || 1;
    if (this.shown !== p.stage || this.shownDir !== dir) {
      this.shown = p.stage;
      this.shownDir = dir;
      // 망가짐: 위쪽이 맞은 방향으로 휜다. 파괴: 밑동에서 맞은 방향으로 보도 위에 눕는다
      this.upper.rotation.z = p.stage === 1 ? -dir * 0.2 : 0;
      this.pole.rotation.z = p.stage === 2 ? -dir * (Math.PI / 2 - 0.04) : 0;
      this.pole.position.y = p.stage === 2 ? 3 : 4;
      this.pole.updateMatrixWorld(true);
      this.bits[0].visible = p.stage === 2 && dir > 0;
      this.bits[1].visible = p.stage === 2 && dir < 0;
    }
    const flick = p.stage === 1 ? hash((tick >> 2) * 31 + this.i * 7) < 0.45 : hash((tick >> 3) * 31 + this.i * 7) < 0.03;
    const on = p.stage < 2 && !flick;
    this.lens.uniforms.emissiveStrength.value = on ? 3 : 0;
    this.shaft.visible = on;
    if (on) {
      const head = new THREE.Vector3(this.side * 18, 28, 2);
      this.upper.localToWorld(head);
      // 코브라 헤드는 아래로 비춘다: 보도와 길, 가게 앞이 밝고 위층 벽은 어둡게 남는다
      lightPool.add(head.x, head.y, head.z, 150, C.sodium, 2.2, true);
    }
    if (p.stage === 2) {
      // 쓰러진 직후 잠깐 불꽃이 튄다
      const since = p.brokenAt >= 0 ? tick - p.brokenAt : 0;
      if (since < 150 && hash((tick >> 1) * 3 + this.i) < 0.35) {
        const x = this.cx + dir * 3;
        for (let k = 0; k < 6; k++) {
          const a = hash(tick * 5 + k + this.i) * Math.PI;
          const r = 3 + hash(tick * 7 + k) * 8;
          this.owner.sparks.add(x + Math.cos(a) * r, 6 + Math.sin(a) * r, LAMP_Z + 6, k % 2 ? C.fxYellow : C.skyLight, 2);
        }
        lightPool.add(x, 6, LAMP_Z + 6, 30, C.skyLight, 0.6);
      }
    }
  }
}

/** 깨진 가로등 유리 조각 (나트륨 주황과 크림색 점) */
function paintGlassBits(w: number, d: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = d;
  const g = c.getContext('2d')!;
  for (let k = 0; k < 14; k++) {
    g.fillStyle = k % 3 ? C.sodium : C.paintCream;
    g.fillRect(Math.floor(hash(seed * 31 + k) * w), Math.floor(hash(seed * 17 + k * 7) * d), 1, 1);
  }
  return c;
}

function solid(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 4, 4);
  return c;
}

// ---------------------------------------------------------------- 쇼윈도 유리
class GlassView implements View {
  shown = -1;
  private readonly mesh: THREE.Mesh;
  private readonly mats: THREE.ShaderMaterial[];
  private readonly shards: THREE.Mesh;

  constructor(owner: Props, private readonly b: Breakable, i: number) {
    const shop = b.b >= 0 ? FRONT[b.b].sign : '';
    this.mats = [0, 1, 2].map((st) => {
      const t = paintGlass(b, i, shop, st);
      return litMaterial(pixelTexture(t.map), { emissive: pixelTexture(t.glow), emissiveStrength: 1.2 });
    });
    this.mesh = plane(b.x, b.x + Math.round(b.w), b.bottom, b.bottom + Math.round(b.h), FRONT_Z + 0.4, this.mats[0]);
    this.shards = decal(b.x - 8, b.x + b.w + 8, -2, 26, paintShards(Math.round(b.w) + 16, 28, i), 0.6);
    owner.group.add(this.mesh, this.shards);
  }

  update(p: PropState, _tick: number, gone: boolean): void {
    const b = this.b;
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.mesh.material = this.mats[p.stage];
      this.shards.visible = p.stage === 2;
    }
    this.mesh.visible = !gone;
    if (!gone && p.stage < 2) lightPool.add(b.x + b.w / 2, GLASS_BOTTOM + b.h / 2, FRONT_Z + 16, 84, C.windowLit, p.stage === 1 ? 0.6 : 0.8);
  }
}

// ---------------------------------------------------------------- 네온 간판 (가게 이름 판, 세로 간판, 다이너 판)
/** 간판 켜짐 세기: 역할과 단계, 깜빡임 */
function signLevel(role: SignRole, p: PropState, tick: number, i: number): number {
  if (p.stage === 2 || role === 'off') return 0;
  let on = true;
  if (role === 'flicker' || p.stage === 1) {
    // 불안정한 관: 대부분 켜져 있다가 몇 틱씩 끊긴다
    on = hash((tick >> 2) * 131 + i * 17) > (p.stage === 1 ? 0.45 : 0.22);
  }
  if (!on) return 0;
  return role === 'hero' ? 2.4 : role === 'dim' ? 0.9 : role === 'board' ? 1.3 : 1.5;
}

function brokenSparks(owner: Props, p: PropState, tick: number, i: number, x: number, y: number, z: number, color: string): void {
  const since = p.brokenAt >= 0 ? tick - p.brokenAt : 0;
  if (since >= 120 || hash((tick >> 1) * 5 + i) >= 0.4) return;
  for (let k = 0; k < 7; k++) {
    const a = hash(tick * 3 + k + i) * Math.PI * 2;
    const r = 2 + hash(tick * 9 + k) * 9;
    owner.sparks.add(x + Math.cos(a) * r, y + Math.sin(a) * r, z, k % 2 ? C.fxYellow : color, 2);
  }
  lightPool.add(x, y, z + 10, 34, color, 0.7);
}

class SignView implements View {
  shown = -1;
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly tex: { map: THREE.Texture; broken: THREE.Texture; glows: THREE.Texture[]; damaged: THREE.Texture };
  private readonly role: SignRole;
  private readonly z1: number;
  private readonly wire: THREE.Mesh;

  constructor(private readonly owner: Props, private readonly b: Breakable, private readonly i: number, det: Details) {
    const t: SignTex = paintSign(b, i);
    this.tex = { map: pixelTexture(t.map), broken: pixelTexture(t.broken), glows: t.glows.map(pixelTexture), damaged: pixelTexture(t.damaged) };
    this.role = roleOf(b);
    this.mat = litMaterial(this.tex.map, { emissive: this.tex.glows[0], emissiveStrength: 0 });
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    let z0 = FRONT_Z + 0.5;
    this.z1 = FRONT_Z + 3;
    if (b.style === 'blade') {
      z0 = FRONT_Z + 14;
      this.z1 = FRONT_Z + 24;
      // 벽에서 간판까지 받침쇠
      for (let y = b.bottom + 8; y < b.bottom + h; y += 40) det.add(b.x + w / 2 - 1, b.x + w / 2 + 1, y, y + 2, FRONT_Z, z0, C.iron);
    } else if (b.style === 'board') {
      // 다이너 판: 차양 위 받침 두 개
      for (const x of [b.x + 6, b.x + w - 8]) det.add(x, x + 2, D.ledges.awning, b.bottom, FRONT_Z + 1, FRONT_Z + 3, C.iron);
    }
    this.mesh = box(b.x, b.x + w, b.bottom, b.bottom + h, z0, this.z1, this.mat);
    // 깨진 뒤 늘어진 전선
    this.wire = box(b.x + w - 6, b.x + w - 5, b.bottom - 14, b.bottom, this.z1 - 1, this.z1, litMaterial(pixelTexture(solid(C.iron))));
    this.wire.visible = false;
    owner.group.add(this.mesh, this.wire);
  }

  update(p: PropState, tick: number, gone: boolean): void {
    const b = this.b;
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.mat.uniforms.map.value = p.stage === 2 ? this.tex.broken : this.tex.map;
      this.wire.visible = p.stage === 2;
    }
    this.mesh.visible = !gone;
    this.wire.visible = !gone && p.stage === 2;
    if (gone) return;
    const k = signLevel(this.role, p, tick, this.i);
    this.mat.uniforms.emissiveStrength.value = k;
    this.mat.uniforms.emissiveMap.value = p.stage === 1 ? this.tex.damaged : this.tex.glows[(tick >> 3) % 3];
    const [bright] = NEON_HEX[b.color ?? 'pink'];
    if (k > 0) {
      const power = this.role === 'hero' ? 2.4 : this.role === 'dim' ? 0.7 : 1.0;
      const range = this.role === 'hero' ? 190 : 110;
      lightPool.add(b.x + b.w / 2, b.bottom + b.h / 2, this.z1 + 20, range, bright, power * (p.stage === 1 ? 0.7 : 1));
    }
    if (p.stage === 2) brokenSparks(this.owner, p, tick, this.i, b.x + b.w / 2, b.bottom + b.h / 2, this.z1 + 1, bright);
  }
}

/** 극장 전구 차양 (윗면이 발판): 건물에 붙은 상자라 무너진 칸 부분만 사라진다. 전구가 차례로 돌고 아래 로비를 비춘다 */
class MarqueeView implements View {
  shown = -1;
  private readonly mat: THREE.ShaderMaterial;
  private readonly tex: { map: THREE.Texture; broken: THREE.Texture; glows: THREE.Texture[]; damaged: THREE.Texture };

  constructor(private readonly owner: Props, private readonly b: Breakable, private readonly i: number) {
    const w = Math.round(b.w);
    const t = paintMarquee(w, b.text ?? '', i);
    this.tex = { map: pixelTexture(t.map), broken: pixelTexture(t.broken), glows: t.glows.map(pixelTexture), damaged: pixelTexture(t.damaged) };
    this.mat = litMaterial(this.tex.map, { emissive: this.tex.glows[0], emissiveStrength: 1.1, attached: true });
    const m = marqueeOf(FRONT[b.b])!;
    const geo = new Geo();
    geo.attachedBox(b.b, 'm', m.x0, m.x1, m.h - 22, m.h, FRONT_Z, 8, (f, x, y) => [(x - m.x0) / w, f === 'py' ? 0.95 : (y - (m.h - 22)) / 22]);
    owner.group.add(geo.build({ m: this.mat }));
  }

  update(p: PropState, tick: number): void {
    const b = this.b;
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.mat.uniforms.map.value = p.stage === 2 ? this.tex.broken : this.tex.map;
    }
    const k = signLevel('marquee', p, tick, this.i);
    this.mat.uniforms.emissiveStrength.value = k > 0 ? 1.1 : 0;
    this.mat.uniforms.emissiveMap.value = p.stage === 1 ? this.tex.damaged : this.tex.glows[(tick >> 3) % 3];
    if (k > 0) lightPool.add(b.x + b.w / 2, b.bottom - 8, 14, 100, C.lampGlow, p.stage === 1 ? 0.5 : 0.8);
    if (p.stage === 2) brokenSparks(this.owner, p, tick, this.i, b.x + b.w / 2, b.bottom + 11, 9, C.lampGlow);
  }
}

/** 옥상 전광판: 쇠다리 위 판에 전구 글씨가 흘러가고 테두리 전구가 차례로 깜빡인다 */
class BillboardView implements View {
  shown = -1;
  private readonly group = new THREE.Group();
  private readonly mat: THREE.ShaderMaterial;
  private readonly text: THREE.ShaderMaterial;
  private readonly tex: { map: THREE.Texture; broken: THREE.Texture; glows: THREE.Texture[]; damaged: THREE.Texture };
  private readonly strips: THREE.Texture[];
  private readonly len: number;
  private readonly z = FRONT_Z - 70;

  constructor(private readonly owner: Props, private readonly b: Breakable, private readonly i: number, det: Details) {
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    const t = paintBillboard(w, h);
    this.tex = { map: pixelTexture(t.map), broken: pixelTexture(t.broken), glows: t.glows.map(pixelTexture), damaged: pixelTexture(t.damaged) };
    this.mat = litMaterial(this.tex.map, { emissive: this.tex.glows[0], emissiveStrength: 1.3 });
    this.group.add(box(b.x - 2, b.x + w + 2, b.bottom - 2, b.bottom + h + 2, this.z - 4, this.z, this.mat));
    // 흘러가는 글씨 띠 (판 앞)
    this.strips = [0, 1, 2].map((st) => {
      const tx = pixelTexture(boardStrip(b.text ?? '', st, i));
      tx.wrapS = THREE.RepeatWrapping;
      return tx;
    });
    this.len = (this.strips[0].image as HTMLCanvasElement).width / 3;
    const cols = Math.floor((w - 6) / 3);
    this.text = scrollMaterial(this.strips[1], cols);
    const ty = b.bottom + h - Math.floor((h - 15) / 2) - 15;
    this.group.add(plane(b.x + 3, b.x + 3 + cols * 3, ty, ty + 15, this.z + 0.3, this.text));
    // 쇠다리와 버팀대 (지붕에서 판 밑까지)
    const roof = b.bottom - 12;
    for (const lx of [b.x + 10, b.x + w - 14]) {
      const a = [b.b + 1, Math.floor((lx - GRIDS[b.b].x) / 16)] as const;
      det.add(lx, lx + 4, roof, b.bottom - 2, this.z - 4, this.z - 1, C.iron, a);
      det.bar(lx, roof, lx + 14, b.bottom - 2, 2, this.z - 4, this.z - 2, C.iron, a);
    }
    owner.group.add(this.group);
  }

  update(p: PropState, tick: number, gone: boolean): void {
    const b = this.b;
    this.group.visible = !gone;
    if (gone) return;
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.mat.uniforms.map.value = p.stage === 2 ? this.tex.broken : this.tex.map;
    }
    const on = p.stage < 2 && (p.stage === 0 || hash((tick >> 2) * 17 + this.i * 7) > 0.35);
    this.mat.uniforms.emissiveStrength.value = on ? 1.3 : 0;
    this.mat.uniforms.emissiveMap.value = this.tex.glows[Math.floor(tick / 6) % 3];
    this.text.uniforms.strip.value = this.strips[p.stage === 2 ? 2 : on ? 1 : 0];
    this.text.uniforms.offset.value = (Math.floor(tick / 5) % this.len) * 3;
    if (on) {
      lightPool.add(b.x + b.w * 0.3, b.bottom + b.h / 2, this.z + 30, 90, C.neonAmber, 0.9);
      lightPool.add(b.x + b.w * 0.7, b.bottom + b.h / 2, this.z + 30, 90, C.neonAmber, 0.9);
    }
    if (p.stage === 2) brokenSparks(this.owner, p, tick, this.i, b.x + b.w / 2, b.bottom + b.h / 2, this.z + 2, C.neonAmber);
  }
}

// ---------------------------------------------------------------- 신문 가판대
class NewsView implements View {
  shown = -1;
  private readonly body: THREE.Mesh;
  private readonly mats: THREE.ShaderMaterial[];
  private readonly wreck: THREE.Mesh;
  private readonly papers: THREE.Mesh;
  private readonly roof: THREE.Mesh;

  constructor(owner: Props, b: Breakable, i: number) {
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    this.mats = [0, 1].map((st) => litMaterial(pixelTexture(paintNewsstand(w, h, st))));
    const side = litMaterial(pixelTexture(paintSide(16, h, i, 0)), { tint: 0.6 });
    this.body = facedBox(b.x, b.x + w, 0, h - 4, -40, -24, { px: side, nx: side, py: side, pz: this.mats[0] });
    this.roof = box(b.x - 2, b.x + w + 2, h - 4, h, -42, -20, litMaterial(pixelTexture(solid(C.iron))));
    const wc = paintNewsWreck(w, 16);
    this.wreck = box(b.x - 4, b.x - 4 + wc.width, 0, 16, -40, -24, litMaterial(pixelTexture(wc)));
    this.wreck.visible = false;
    this.papers = decal(b.x - 24, b.x + w + 30, -4, 30, paintPapers(w + 54, 34, i), 0.2);
    owner.group.add(this.body, this.roof, this.wreck, this.papers);
  }

  update(p: PropState): void {
    if (this.shown === p.stage) return;
    this.shown = p.stage;
    this.body.visible = p.stage < 2;
    this.roof.visible = p.stage < 2;
    this.roof.rotation.z = p.stage === 1 ? -0.1 : 0;
    this.wreck.visible = p.stage === 2;
    this.papers.visible = p.stage >= 1;
    if (p.stage < 2) {
      const mats = this.body.material as THREE.Material[];
      mats[mats.findIndex((m) => this.mats.includes(m as THREE.ShaderMaterial))] = this.mats[p.stage];
    }
  }
}

// ---------------------------------------------------------------- 소화전
class HydrantView implements View {
  shown = -1;
  private readonly whole: THREE.Mesh;
  private readonly stump: THREE.Mesh;
  private readonly column = new WaterColumn();
  private readonly puddle: THREE.Mesh;
  private readonly x: number;

  constructor(private readonly owner: Props, b: Breakable, private readonly i: number) {
    const x = b.x;
    this.x = x;
    const d = new Details();
    d.add(x + 1, x + 9, 0, 14, -34, -26, C.posterRedDark);
    d.add(x - 1, x + 11, 8, 11, -33, -27, C.posterRedDark);
    d.add(x + 3, x + 7, 14, 18, -32, -28, C.posterRedDark);
    d.add(x + 2, x + 4, 1, 14, -26, -25.8, C.posterRed);
    this.whole = d.build();
    const s = new Details();
    s.add(x, x + 10, 0, 6, -34, -26, C.posterRedDark);
    s.add(x + 2, x + 4, 0, 5, -26, -25.8, C.posterRed);
    this.stump = s.build();
    this.stump.visible = false;
    this.puddle = decal(x - 46, x + 56, -4, 36, paintPuddle(102, 40), 1);
    owner.group.add(this.whole, this.stump, this.column.mesh, this.puddle);
  }

  update(p: PropState, tick: number): void {
    if (this.shown !== p.stage) {
      this.shown = p.stage;
      this.whole.visible = p.stage < 2;
      this.stump.visible = p.stage === 2;
      this.puddle.visible = p.stage >= 1;
    }
    const x = this.x;
    if (p.stage === 1) {
      // 금 간 곳에서 물이 똑똑 떨어지고 바닥이 조금 젖는다
      this.puddle.scale.set(0.35, 0.5, 1);
      this.owner.sparks.add(x + 9, 9 - ((tick >> 2) % 8), -25, C.skyLight, 0.8);
      this.column.set(0, 0, 0, 0);
      return;
    }
    if (p.stage !== 2) {
      this.column.set(0, 0, 0, 0);
      return;
    }
    // 물기둥: 처음엔 높이 솟고 차츰 낮아진다 (라운드 끝까지 멈추지 않음). 물웅덩이가 넓어진다
    const since = p.brokenAt >= 0 ? tick - p.brokenAt : 0;
    const height = Math.round(34 + 46 * Math.max(0, 1 - since / 600)) & ~1;
    this.column.set(x + 5, 6, -30, height);
    this.puddle.scale.set(Math.min(1, (10 + (since >> 3)) / 46), 1, 1);
    for (let k = 0; k < 14; k++) {
      const life = 34;
      const age = (tick + k * 3 + this.i * 5) % life;
      const side = k % 2 ? 1 : -1;
      const dx = side * (3 + age * (0.3 + hash(this.i * 7919 + k * 104729) * 0.4));
      const dy = height + 3 - (age * age) / 16;
      if (dy > 0) this.owner.sparks.add(x + 5 + dx, 6 + dy, -29, C.skyLight, 0.7);
    }
  }
}

