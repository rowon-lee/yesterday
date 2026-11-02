import * as THREE from 'three';
import type { CityState, PropState } from '../../sim';
import { CITADEL as D } from '../../data/stages/citadel';
import { BREAKABLES, chunkIndex, FRONT, GLASS_BOTTOM, GRIDS, marqueeOf, type Breakable } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { hash } from '../dither';
import { FRONT_Z } from './buildings';
import { Flame, Puffs, Sparks, WaterColumn } from './fx';
import { box, Details, facedBox, FREE, Geo, plane, type UvFn } from './kit';
import { lightPool } from './lights';
import { lampLook, registerSign, roleOf, type LampLook, type SignRole } from './signs';
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


const INTACT: PropState = { hp: 1, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1, at: 0 };
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

// ---------------------------------------------------------------- 가로등 (생김새·상태는 signs.ts의 lampLook)
/**
 * 가로등: 코브라 머리 나트륨등, 굽은 목 쇠갓 옛 백열등, 광장 두 구 주철 등, 공원 등롱.
 * 등마다 색(따뜻한 빛 안에서)·세기·낡음·상태(켜짐·어두움·꺼짐·끊김)가 달라 같은 등이 같은 간격으로 이어 보이지 않는다.
 * 빛줄기는 물체가 아니라 공기: 좁은 안쪽 원뿔과 넓고 옅은 바깥 원뿔을 겹쳐 가장자리가 길게 사라진다.
 */
class LampView implements View {
  shown = -1;
  private readonly pole = new THREE.Group();
  private readonly upper = new THREE.Group();
  private readonly lens: THREE.ShaderMaterial;
  private readonly shafts: THREE.Mesh[] = [];
  private readonly side: number;
  private readonly cx: number;
  private readonly look: LampLook;
  /** 빛이 나오는 곳 (upper 기준) */
  private readonly head: THREE.Vector3;
  /** 늘 조금 기운 각도 (낡은 등) */
  private readonly lean: number;
  private shownDir = 0;
  /** 쓰러진 머리 쪽 길에 흩어진 유리 조각 (오른쪽·왼쪽으로 쓰러졌을 때) */
  private readonly bits: THREE.Mesh[];

  constructor(private readonly owner: Props, b: Breakable, private readonly i: number, det: Details) {
    const cx = b.x + b.w / 2;
    this.cx = cx;
    this.side = i % 2 ? -1 : 1;
    const L = lampLook(cx);
    this.look = L;
    const s = this.side;
    const old = L.age > 0.55;
    // 밑동 (쓰러져도 남는다): 낡은 등은 녹슨 밑동
    det.add(cx - 4, cx + 5, 0, 4, LAMP_Z - 4, LAMP_Z + 4, old ? C.rust : C.iron);
    det.add(cx - 4, cx + 5, 3.5, 4, LAMP_Z - 4, LAMP_Z + 4, C.ironLight);
    // 기둥 아래 (밑동 위 4에서 돌아 쓰러진다): 빛 받는 쪽 모서리 한 줄 (등 머리 쪽)
    const lower = new Details();
    const pw = L.kind === 'twin' ? 2.5 : L.kind === 'lantern' ? 1.5 : 2;
    lower.add(-pw, pw, 0, 70, -2, 2, C.iron);
    lower.add(s > 0 ? pw - 1 : -pw, s > 0 ? pw : -pw + 1, 8, 70, 2, 2.2, C.ironLight);
    if (L.kind === 'twin') {
      // 주철 등: 굵은 받침과 마디
      lower.add(-4, 4, 0, 12, -3, 3, C.iron);
      lower.add(-4, 4, 11, 12, -3, 3, C.ironLight);
      lower.add(-3, 3, 40, 42, -2.5, 2.5, C.ironLight);
    }
    if (old) lower.add(-pw - 0.2, pw + 0.2, 2, 10 + Math.round(L.age * 10), -2.2, 2.25, C.rust);
    this.pole.add(lower.build());
    this.pole.position.set(cx, 4, LAMP_Z);
    // 기둥 위·팔·머리 (74에서 휘어진다)
    const up = new Details();
    const glowCol = L.state === 'dead' ? C.iron : L.color;
    this.lens = litMaterial(pixelTexture(solid(L.state === 'dead' ? C.ironLight : glowCol)), { emissive: pixelTexture(solid(glowCol)), emissiveStrength: 0 });
    if (L.kind === 'cobra') {
      up.add(-1.5, 1.5, 0, 30, -1.5, 1.5, C.iron);
      const armX0 = s > 0 ? 0 : -18;
      up.add(armX0, armX0 + 18, 28, 31, -1.5, 1.5, C.iron);
      const hx = s * 18;
      // 머리: 윗면은 하늘빛을 받는 크롬, 앞면은 어두운 크롬, 아래 유리 (빛나는 것)
      up.add(hx - 7, hx + 7, 30, 35, -4, 4, C.chromeDark);
      up.add(hx - 7, hx + 7, 34, 35, -4, 4, old ? C.chromeDark : C.chrome);
      up.add(hx - 7, hx + 7, 30, 31, -4, 4, C.iron);
      this.upper.add(box(hx - 5, hx + 5, 28.5, 30, -3, 3, this.lens));
      this.head = new THREE.Vector3(hx, 28, 2);
    } else if (L.kind === 'goose') {
      // 굽은 목: 기둥에서 둥글게 휘어 나와 쇠갓을 단다
      up.add(-1.2, 1.2, 0, 20, -1.2, 1.2, C.iron);
      const pts: Array<[number, number]> = [[0, 19], [1.5, 24], [4.5, 27], [8, 28.5], [12, 28.5]];
      for (let k = 0; k < pts.length - 1; k++) up.bar(s * pts[k][0], pts[k][1], s * pts[k + 1][0], pts[k + 1][1], 2, -1.2, 1.2, C.iron);
      const hx = s * 12;
      // 쇠갓 (얕은 접시): 윗면 밝게, 아래 그늘
      up.add(hx - 2, hx + 2, 26, 28.5, -2, 2, C.iron);
      up.add(hx - 7, hx + 7, 23, 26, -5, 5, old ? C.rust : C.paintTeal);
      up.add(hx - 7, hx + 7, 25.5, 26, -5, 5, C.chromeDark);
      up.add(hx - 8, hx + 8, 23, 24, -5.5, 5.5, C.iron);
      this.upper.add(box(hx - 2, hx + 2, 21, 23, -2, 2, this.lens));
      this.head = new THREE.Vector3(hx, 22, 2);
    } else if (L.kind === 'twin') {
      // 두 구 주철 등: 가로대 양 끝에 우윳빛 유리 구, 가운데 꼭지
      up.add(-1.5, 1.5, 0, 16, -1.5, 1.5, C.iron);
      up.add(-11, 11, 14, 16, -1.5, 1.5, C.iron);
      up.add(-11, 11, 15.5, 16, -1.5, 1.5, C.ironLight);
      for (const gx of [-9, 9]) {
        up.add(gx - 2, gx + 2, 16, 17, -2, 2, C.iron);
        this.upper.add(box(gx - 3, gx + 3, 17, 24, -3, 3, this.lens));
        up.add(gx - 2, gx + 2, 24, 25, -2, 2, C.iron);
      }
      up.add(-1, 1, 16, 26, -1, 1, C.iron);
      this.head = new THREE.Vector3(0, 20, 4);
    } else {
      // 공원 등롱: 네모 유리 상자, 지붕과 꼭지
      up.add(-1.2, 1.2, 0, 8, -1.2, 1.2, C.iron);
      up.add(-4, 4, 7, 8, -4, 4, C.iron);
      this.upper.add(box(-3.5, 3.5, 8, 17, -3.5, 3.5, this.lens));
      for (const gx of [-3.5, 3]) up.add(gx, gx + 0.5, 8, 17, -3.8, 3.8, C.iron);
      up.add(-5, 5, 17, 19, -5, 5, C.iron);
      up.add(-5, 5, 18.5, 19, -5, 5, C.ironLight);
      up.add(-3, 3, 19, 21, -3, 3, C.iron);
      up.add(-0.5, 0.5, 21, 24, -0.5, 0.5, C.iron);
      this.head = new THREE.Vector3(0, 13, 4);
    }
    this.upper.add(up.build());
    this.lean = L.state === 'dead' ? -s * 0.07 : L.age > 0.75 ? -s * 0.03 : 0;
    // 빛줄기: 안쪽 좁은 원뿔 + 바깥 넓고 옅은 원뿔 (나트륨 불빛보다 한 단계 노랗게: 남색 공기에서 분홍으로 바래지 않게)
    if (L.shaft > 0) {
      const hy = this.head.y + 70 + 4;
      const shaftCol = L.color === '#ffe2a8' ? '#ffe2a8' : L.color === '#ffcf7a' ? '#ffcf7a' : C.lampGlow;
      for (const [r, k] of [[L.spread * 0.5, 0.55], [L.spread, 0.45]] as const) {
        const smat = shaftMaterial(shaftCol, L.shaft * k);
        smat.transparent = false;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, hy, 24, 1, true), smat);
        cone.renderOrder = 2;
        cone.position.set(this.head.x, this.head.y - hy / 2, 0);
        this.upper.add(cone);
        this.shafts.push(cone);
      }
    }
    this.upper.position.set(0, 70, 0);
    this.upper.rotation.z = this.lean;
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
    const L = this.look;
    if (this.shown !== p.stage || this.shownDir !== dir) {
      this.shown = p.stage;
      this.shownDir = dir;
      // 망가짐: 위쪽이 맞은 방향으로 휜다. 파괴: 밑동에서 맞은 방향으로 보도 위에 눕는다
      this.upper.rotation.z = p.stage === 1 ? -dir * 0.2 : this.lean;
      this.pole.rotation.z = p.stage === 2 ? -dir * (Math.PI / 2 - 0.04) : 0;
      this.pole.position.y = p.stage === 2 ? 3 : 4;
      this.pole.updateMatrixWorld(true);
      this.bits[0].visible = p.stage === 2 && dir > 0;
      this.bits[1].visible = p.stage === 2 && dir < 0;
    }
    // 꺼진 등은 켜지지 않고, 끊기는 등은 자주, 낡은 등은 가끔 끊긴다
    const base = L.state === 'dead' ? 1 : L.state === 'flicker' ? 0.3 : L.state === 'dim' ? 0.05 : 0.01;
    const flick = p.stage === 1 ? hash((tick >> 2) * 31 + this.i * 7) < 0.45 : hash((tick >> 3) * 31 + this.i * 7) < base;
    const on = p.stage < 2 && !flick;
    this.lens.uniforms.emissiveStrength.value = on ? (L.state === 'dim' ? 1.5 : 2.6) : 0;
    for (const sh of this.shafts) sh.visible = on;
    if (on) {
      const head = this.head.clone();
      this.upper.localToWorld(head);
      // 코브라 머리·쇠갓은 아래로 비춘다 (보도와 길, 가게 앞이 밝고 위층 벽은 어둡게). 구·등롱은 둘레를 고루
      const down = L.kind === 'cobra' || L.kind === 'goose';
      lightPool.add(head.x, head.y, head.z, L.range, L.color, L.power * (p.stage === 1 ? 0.7 : 1), down);
    }
    if (p.stage === 2) {
      // 쓰러진 직후 잠깐 불꽃이 튄다 (꺼져 있던 등은 튀지 않는다)
      const since = p.brokenAt >= 0 ? tick - p.brokenAt : 0;
      if (L.state !== 'dead' && since < 150 && hash((tick >> 1) * 3 + this.i) < 0.35) {
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
  // 주인공만 세게, 나머지는 한 단계 낮게 (청록·호박 간판은 색만으로도 밝아 더 낮춘다)
  return role === 'hero' ? 2.4 : role === 'dim' ? 0.6 : role === 'board' ? 1.0 : 0.95;
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
    this.role = roleOf(b);
    const t: SignTex = paintSign(b, i, this.role === 'hero');
    this.tex = { map: pixelTexture(t.map), broken: pixelTexture(t.broken), glows: t.glows.map(pixelTexture), damaged: pixelTexture(t.damaged) };
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
    if (b.style === 'blade') {
      // 세로 간판 옆면은 빛나는 테두리 관 줄을 쓴다 (어두운 1px 옆면이 외곽선처럼 서지 않게: 옆면도 네온 빛을 받는다)
      const geo = new Geo();
      const uv: UvFn = (f, x, y) => [f === 'px' || f === 'nx' ? 1.5 / w : (x - b.x) / w, (y - b.bottom) / h];
      geo.box('s', b.x, b.x + w, b.bottom, b.bottom + h, z0, this.z1, uv, FREE);
      this.mesh = geo.build({ s: this.mat });
    } else this.mesh = box(b.x, b.x + w, b.bottom, b.bottom + h, z0, this.z1, this.mat);
    // 글자 자리: 판 전체가 아니라 실제로 글자를 그린 자리 (판 안에서 화면 경계를 비켜 두기도 한다)
    const tb = t.text ?? { x0: 0, x1: w, y0: 0, y1: h };
    if (b.text) registerSign(b.text, `간판(${b.style ?? 'flat'})`, b.x + tb.x0, b.x + tb.x1, b.bottom + h - tb.y1, b.bottom + h - tb.y0, this.z1, tb.x1 - tb.x0, w);
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
    const tb = t.text ?? { x0: 0, x1: w, y0: 0, y1: 22 };
    if (b.text) registerSign(b.text, '극장 차양', m.x0 + tb.x0, m.x0 + tb.x1, m.h - tb.y1, m.h - tb.y0, 8, tb.x1 - tb.x0, m.x1 - m.x0 - 4);
    const geo = new Geo();
    // 아랫면(처마 밑)은 전구가 박힌 밝은 판 줄을 쓴다: 어두운 1px 띠가 아니라 불 켜진 처마 (극장 입구가 거리에서 가장 밝다)
    geo.attachedBox(b.b, 'm', m.x0, m.x1, m.h - 22, m.h, FRONT_Z, 8, (f, x, y) => [(x - m.x0) / w, f === 'py' ? 0.95 : f === 'ny' ? 0.55 : (y - (m.h - 22)) / 22]);
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
  /** 낱말마다 [꺼짐, 켜짐, 부서짐] 글씨 띠 (판 가운데에 맞춘 한 낱말) */
  private readonly words: THREE.Texture[][];
  private readonly z = FRONT_Z - 70;

  constructor(private readonly owner: Props, private readonly b: Breakable, private readonly i: number, det: Details) {
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    const t = paintBillboard(w, h);
    this.tex = { map: pixelTexture(t.map), broken: pixelTexture(t.broken), glows: t.glows.map(pixelTexture), damaged: pixelTexture(t.damaged) };
    this.mat = litMaterial(this.tex.map, { emissive: this.tex.glows[0], emissiveStrength: 1.3 });
    this.group.add(box(b.x - 2, b.x + w + 2, b.bottom - 2, b.bottom + h + 2, this.z - 4, this.z, this.mat));
    // 글씨 판 (판 앞): 문구를 낱말 하나씩 판 가운데에 띄우고 차례로 바꾼다 (흘러가는 띠는 늘 반쯤 잘린 글자가 보여서)
    const cols = Math.floor((w - 6) / 3);
    const slots = Math.ceil(cols / 4);
    const list = (b.text ?? '').trim().split(/\s+/).filter(Boolean);
    this.words = list.map((word) => {
      const left = Math.floor((slots - word.length) / 2);
      const padded = ' '.repeat(Math.max(0, left)) + word + ' '.repeat(Math.max(0, slots - left - word.length));
      return [0, 1, 2].map((st) => pixelTexture(boardStrip(padded, st, i)));
    });
    this.text = scrollMaterial(this.words[0]?.[1] ?? pixelTexture(boardStrip(' ', 0, i)), cols);
    const ty = b.bottom + h - Math.floor((h - 15) / 2) - 15;
    this.group.add(plane(b.x + 3, b.x + 3 + cols * 3, ty, ty + 15, this.z + 0.3, this.text));
    // 글자 폭은 가장 긴 낱말 (한 글자 = 4칸 × 3px, 끝 칸 빼고)과 판에 보이는 폭
    const longest = list.reduce((m, word) => Math.max(m, word.length), 0);
    if (b.text) registerSign(b.text.trim(), '옥상 전광판', b.x, b.x + w, ty, ty + 15, this.z, longest * 12 - 3, cols * 3);
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
    // 낱말 하나를 48틱 띄우고, 바뀔 때 6틱 꺼진다
    if (this.words.length) {
      const k = Math.floor(tick / 48) % this.words.length;
      const gap = tick % 48 < 6;
      const t = this.words[k];
      this.text.uniforms.strip.value = t[p.stage === 2 ? 2 : on && !gap ? 1 : 0];
      this.text.uniforms.stripW.value = (t[0].image as HTMLCanvasElement).width;
      this.text.uniforms.offset.value = 0;
    }
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

