import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { KEEP_RULES as R } from '../../stage/citadel';
import type { CitadelState } from '../../sim';
import { COLORS as C } from '../palette';
import { canvas, ditherRect, hash, rect } from '../dither';
import { scaleAt } from './core';
import { Beam, Flame, Puffs } from './fx';
import { plane } from './kit';
import { lightPool } from './lights';
import { litMaterial, pixelTexture } from './shaders';

/**
 * 시타델 붕괴의 그림 (렌더 전용, 기획서 '시타델 붕괴'). sim의 시타델 상태(단계·무너진 틱·잔해 언덕)만 보고 그린다:
 * 같은 상태·같은 틱이면 늘 같은 그림이다.
 * - 1단계 금, 2단계 유리 깨짐, 3단계 세로로 갈라짐·그을음·불길(실제 광원·연기). 기둥탑 앞면에도 금이 는다
 * - 무너짐: 본관 세로 덩어리가 차례로 기울며 땅 아래로 주저앉고, 먼 겹의 탑 윗부분도 내려앉는다.
 *   옥상 처마·서치라이트는 바로, 기둥탑 윗부분과 계단·계단참·테라스는 먼지 속에서 사라진다
 * - 잔해 언덕: sim의 잔해 언덕 덩어리 그대로 (기둥탑 밑동이 가장 높다), 다 쌓이기까지 자라고, 불길·연기·잉걸불이 남는다.
 *   광장 양 끝 초소·검문소 서치라이트가 폐허를 쓸고 지나간다
 * 화면 흔들림·먼지 구름·폭발은 싸우는 면 이펙트(render/fightvfx.ts)가 'citadel' 이벤트로 그린다.
 */

const P = D.plaza;
const K = P.keep;
const T = P.tower;
const W = K.x1 - K.x0;

/** 광장 그림(plaza.ts)이 넘겨주는 본관과 묻히는 것들 */
export interface KeepParts {
  keepZ: number;
  /** 서 있는 본관 (상자 하나, 월드 좌표 그대로) */
  whole: THREE.Mesh;
  /** 무너질 때의 본관 세로 덩어리 (평소 숨김. 자리 = 덩어리 밑변 가운데)와 그 x 범위 */
  slabs: THREE.Mesh[];
  slabX: Array<[number, number]>;
  /** 본관 옥상 처마·서치라이트 받침 (본관과 함께 무너진다) */
  crown: THREE.Object3D;
  /** 옥상 서치라이트 */
  beams: Beam[];
  /** 기둥탑 둘 (윗부분이 부러진다. 밑동은 잔해 언덕 그림이 그린다) */
  pylons: THREE.Object3D;
  /** 잔해 언덕에 묻히는 것: 계단·계단참·테라스·기둥 덮개·경고등·정문 캐노피 */
  buried: THREE.Object3D;
}

/** 본관 불길 자리 (3단계): 월드 x, 높이. 싸우는 화면에 보이는 로비 위·아래층 */
const FIRE_SPOTS: ReadonlyArray<[number, number]> = [
  [1272, 176], [1352, 214], [1418, 132], [1520, 236], [1622, 196], [1690, 138], [1790, 222], [1866, 168], [1934, 206],
];
/** 3단계 세로로 크게 갈라진 틈: x, 아래 끝 높이, 위 끝 높이 */
const SPLITS: ReadonlyArray<[number, number, number]> = [[1404, 10, 470], [1572, 96, 470], [1786, 20, 440]];
/** 잔해 언덕 불길: 덩어리 번호와 덩어리 안 자리(0~1) */
const HILL_FIRES: ReadonlyArray<[number, number]> = [[1, 0.5], [3, 0.4], [6, 0.3], [8, 0.6], [9, 0.5], [12, 0.4], [14, 0.6]];
/** 잔해 언덕 앞판의 x 범위·높이 (밑동 위로 철근이 조금 솟는다) */
const HX0 = R.hill[0].x0 - 8;
const HX1 = R.hill[R.hill.length - 1].x1 + 8;
const HH = 200;
/** 잔해 언덕 앞판 깊이 (싸우는 면 바로 뒤: 땅에 선 캐릭터는 그 앞을 지나간다), 뒤판 깊이 (무너진 본관 덩어리) */
const HILL_Z = -6;
const BACK_Z = -120;
const BX0 = K.x0 - 30;
const BX1 = K.x1 + 30;
const BH = 280;

export class KeepFall {
  readonly group = new THREE.Group();
  private readonly overlay: { c: HTMLCanvasElement; glow: HTMLCanvasElement; tex: THREE.CanvasTexture; gtex: THREE.CanvasTexture; mat: THREE.ShaderMaterial };
  /** 서 있는 본관 앞 덧그림 판 (한 장), 무너질 때 덩어리마다 붙은 덧그림 판 */
  private readonly overlayWhole: THREE.Mesh;
  private readonly pylonOverlays: THREE.Mesh[] = [];
  private readonly pylonCracks: Array<{ c: HTMLCanvasElement; tex: THREE.CanvasTexture; x: number }> = [];
  private readonly keepFires: Flame[] = [];
  private readonly hillFires: Flame[] = [];
  private readonly smoke = new Puffs(70, C.smokeDark, C.night, 6, 0.42);
  private readonly front: { mesh: THREE.Mesh; c: HTMLCanvasElement; tex: THREE.CanvasTexture };
  private readonly back: { mesh: THREE.Mesh; c: HTMLCanvasElement; tex: THREE.CanvasTexture };
  private readonly posts: Beam[] = [];
  private tower: THREE.Object3D | null = null;
  private towerY = 0;
  /** 지금 그려 둔 단계 (덧그림·기둥 금), 잔해 언덕이 자란 정도 (0~10) */
  private painted = -1;
  private grown = -1;
  private readonly sk: number;
  private readonly tw: number;
  private readonly th: number;

  constructor(private readonly parts: KeepParts) {
    const z = parts.keepZ;
    this.sk = scaleAt(z);
    this.tw = Math.round(W * this.sk);
    this.th = Math.round(K.h * this.sk);
    // 1) 본관 정면 덧그림 (단계마다 다시 그린다): 덩어리마다 그 몫의 판을 앞에 붙여 함께 무너진다
    const [c] = canvas(this.tw, this.th);
    const [glow] = canvas(this.tw, this.th);
    const tex = pixelTexture(c);
    const gtex = pixelTexture(glow);
    const mat = litMaterial(tex, { emissive: gtex, emissiveStrength: 0 });
    this.overlay = { c, glow, tex, gtex, mat };
    this.overlayWhole = plane(K.x0, K.x1, 0, K.h, z + 0.6, mat);
    this.overlayWhole.visible = false;
    this.group.add(this.overlayWhole);
    parts.slabs.forEach((slab, i) => {
      const [x0, x1] = parts.slabX[i];
      const geo = new THREE.PlaneGeometry(x1 - x0, K.h);
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setX(k, ((uv.getX(k) ? x1 : x0) - K.x0) / W);
      const m = new THREE.Mesh(geo, mat);
      // 덩어리 자리(밑변 가운데) 기준: 정면 바로 앞
      m.position.set(0, K.h / 2, z + 0.6 - slab.position.z);
      slab.add(m);
    });
    // 2) 기둥탑 앞면 금 (단계마다)
    const pz = -15.6;
    const ps = scaleAt(pz);
    for (const t of P.towers) {
      const [pc] = canvas(Math.round(T.w * ps), Math.round(T.h * ps));
      const ptex = pixelTexture(pc);
      const m = plane(t.x, t.x + T.w, 0, T.h, pz, litMaterial(ptex));
      m.visible = false;
      parts.pylons.add(m);
      this.pylonOverlays.push(m);
      this.pylonCracks.push({ c: pc, tex: ptex, x: t.x });
    }
    // 3) 본관 불길 (3단계, 무너지기 전)
    FIRE_SPOTS.forEach((_, i) => {
      const f = new Flame(16, 22, 300 + i);
      this.keepFires.push(f);
      this.group.add(f.mesh);
    });
    // 4) 잔해 언덕: 앞판(발판·벽이 되는 덩어리, 기둥탑 밑동)과 뒤판(무너진 본관 덩어리)
    this.front = this.hillPlane(HX0, HX1, HH, HILL_Z);
    this.back = this.hillPlane(BX0, BX1, BH, BACK_Z);
    HILL_FIRES.forEach((_, i) => {
      const f = new Flame(20, 26, 400 + i);
      this.hillFires.push(f);
      this.group.add(f.mesh);
    });
    this.group.add(this.smoke.mesh);
    this.smoke.mesh.visible = false;
    // 5) 광장 양 끝 초소(서쪽 문기둥 안쪽)와 검문소의 서치라이트: 무너진 뒤 폐허를 쓸고 지나간다
    for (const [x, y, zz] of [[P.gatePiers[0] + 50, 40, -30], [P.checkpoint.x + P.checkpoint.w / 2, P.checkpoint.h + 10, -30]] as const) {
      const b = new Beam(420, 34, C.beam, 0.24, 2);
      b.pivot.position.set(x, y, zz);
      b.pivot.visible = false;
      this.group.add(b.pivot);
      this.posts.push(b);
    }
  }

  /** 먼 겹의 시타델 탑 윗부분 (무너지면 내려앉는다) */
  attachTower(tower: THREE.Object3D): void {
    this.tower = tower;
    this.towerY = tower.position.y;
  }

  private hillPlane(x0: number, x1: number, h: number, z: number): { mesh: THREE.Mesh; c: HTMLCanvasElement; tex: THREE.CanvasTexture } {
    const s = scaleAt(z);
    const [c] = canvas(Math.round((x1 - x0) * s), Math.round(h * s));
    const tex = pixelTexture(c);
    const mesh = plane(x0, x1, 0, h, z, litMaterial(tex));
    mesh.visible = false;
    this.group.add(mesh);
    return { mesh, c, tex };
  }

  update(tick: number, c: CitadelState | null): void {
    const stage = c ? c.stage : 0;
    if (stage !== this.painted) {
      this.painted = stage;
      // 금이 가기 전에는 덧그림 판을 그리지 않는다 (서 있는 동안 그리기 호출을 늘리지 않게)
      this.overlayWhole.visible = stage >= 1 && stage < 4;
      for (const m of this.pylonOverlays) m.visible = stage >= 1;
      paintDamage(this.overlay.c, this.overlay.glow, Math.min(3, stage), this.sk);
      this.overlay.tex.needsUpdate = true;
      this.overlay.gtex.needsUpdate = true;
      for (const p of this.pylonCracks) {
        paintPylonCracks(p.c, Math.min(3, stage), p.x);
        p.tex.needsUpdate = true;
      }
    }
    const fallen = c !== null && stage === 4;
    const t = fallen ? tick - c.stageAt[3] : -1;
    this.collapse(t);
    this.keepBurn(tick, stage === 3);
    this.hill(tick, t);
  }

  /** 3단계: 본관 창 몇 곳에서 불길이 일렁이고, 둘레를 주황빛으로 비추고, 연기가 오른다 */
  private keepBurn(tick: number, on: boolean): void {
    const z = this.parts.keepZ;
    this.overlay.mat.uniforms.emissiveStrength.value = on ? 0.9 + 0.3 * hash((tick >> 2) * 13 + 1) : 0;
    this.smoke.begin();
    this.smoke.mesh.visible = on;
    FIRE_SPOTS.forEach(([x, y], i) => {
      const f = this.keepFires[i];
      if (!on) return f.set(0, 0, 0, 0);
      const h = 14 + Math.round(6 * hash((tick >> 3) * 7 + i * 31));
      f.set(x - 8, y - 6, z + 2, h);
      lightPool.add(x, y + 6, z + 40, 90, C.fxOrange, 0.55 + 0.35 * hash((tick >> 2) * 5 + i * 17));
      for (let k = 0; k < 2; k++) {
        const age = (tick + i * 23 + k * 45) % 90;
        this.smoke.add(x + Math.sin((tick + k * 50) * 0.02 + i) * 4 + age * 0.12, y + 14 + age * 0.8, z + 1, 8 + age * 0.12, 1 - age / 90);
      }
    });
  }

  /**
   * 무너지는 모습 (t: 무너진 뒤 틱, 없으면 -1). 처음 R.slow틱은 sim이 반 속도로 가므로 그림도 반 속도로 (슬로모션).
   * 덩어리마다 필살기가 닿은 쪽 가운데부터 차례로 기울며 내려앉는다
   */
  private collapse(t: number): void {
    const { whole, slabs, slabX, crown, beams, pylons, buried } = this.parts;
    const down = t >= 0;
    // 서 있는 동안은 상자 하나, 무너지면 덩어리들 (덩어리마다 덧그림 판이 붙어 있다)
    whole.visible = !down;
    const p = !down ? 0 : t <= R.slow ? t / 2 : R.slow / 2 + (t - R.slow);
    crown.visible = !down;
    for (const b of beams) b.pivot.visible = !down;
    pylons.visible = !down || p < 14;
    buried.visible = !down || p < 22;
    slabs.forEach((m, i) => {
      const [x0, x1] = slabX[i];
      const cx = (x0 + x1) / 2;
      const delay = 2 + Math.abs(cx - (K.x0 + W / 2)) / W * 26 + hash(i * 31 + 7) * 6;
      const q = Math.max(0, p - delay);
      const fall = 0.5 * 0.11 * q * q;
      const lean = (i < slabs.length / 2 ? -1 : 1) * (0.03 + 0.03 * hash(i * 13 + 3));
      m.position.y = -fall;
      m.position.x = cx + lean * fall * 0.4;
      m.rotation.z = -lean * Math.min(1, q / 30) * 1.4;
      m.visible = down && fall < K.h + 40;
    });
    // 먼 겹의 탑: 본관 가운데 덩어리보다 조금 늦게, 같은 화면 높이만큼 내려앉는다
    if (this.tower) {
      const q = Math.max(0, p - 8);
      const fall = 0.5 * 0.1 * q * q;
      const ks = D.keep.speed;
      this.tower.position.y = this.towerY - (fall * this.sk) / ks;
      this.tower.visible = fall * this.sk < 520;
    }
  }

  /** 잔해 언덕: 무너진 뒤 settle틱 동안 자라고(먼지 속), 다 쌓이면 sim의 발판·벽과 같은 모양. 불길·연기·초소 서치라이트 */
  private hill(tick: number, t: number): void {
    const on = t >= 0;
    this.front.mesh.visible = on;
    this.back.mesh.visible = on;
    if (on) this.smoke.mesh.visible = true;
    for (const b of this.posts) b.pivot.visible = on && t > 40;
    if (!on) {
      this.grown = -1;
      for (const f of this.hillFires) f.set(0, 0, 0, 0);
      this.smoke.end();
      return;
    }
    const step = Math.min(10, Math.floor((t / R.settle) * 10));
    if (step !== this.grown) {
      this.grown = step;
      paintHillFront(this.front.c, step / 10);
      paintHillBack(this.back.c, step / 10);
      this.front.tex.needsUpdate = true;
      this.back.tex.needsUpdate = true;
    }
    const grow = step / 10;
    HILL_FIRES.forEach(([bi, at], i) => {
      const b = R.hill[bi];
      const f = this.hillFires[i];
      if (grow < 0.6) return f.set(0, 0, 0, 0);
      const x = b.x0 + (b.x1 - b.x0) * at;
      const h = Math.round((14 + 10 * hash((tick >> 3) * 11 + i * 7)) * Math.min(1, (grow - 0.5) * 2));
      f.set(x - 10, b.h * grow - 4, HILL_Z + 1, h);
      lightPool.add(x, b.h + 10, -14, 110, C.fxOrange, 0.75 + 0.35 * hash((tick >> 2) * 9 + i * 5));
      for (let k = 0; k < 2; k++) {
        const age = (tick + i * 29 + k * 50) % 100;
        this.smoke.add(x + Math.sin((tick + k * 40) * 0.017 + i) * 5 + age * 0.1, b.h + 16 + age * 0.9, HILL_Z - 2, 9 + age * 0.13, 1 - age / 100);
      }
    });
    this.smoke.end();
    // 초소·검문소 서치라이트: 폐허 위를 천천히 오가며 비춘다
    this.posts.forEach((b, i) => {
      const base = i === 0 ? -0.75 : 0.75;
      b.aim(base + 0.35 * Math.sin(tick * 0.011 + i * 2.1));
      lightPool.add(i === 0 ? 1180 + 120 * (1 + Math.sin(tick * 0.011)) : 1980 - 120 * (1 + Math.sin(tick * 0.011 + 2.1)), 120, -20, 120, C.beam, 0.35);
    });
  }
}

// ---------------------------------------------------------------- 그리기

/** 금 하나: (x, y)에서 위로 갈래를 치며 뻗는 들쭉날쭉한 선 (텍스처 좌표). 굵기 2px, 빛 받는 쪽 가장자리 */
function crack(g: CanvasRenderingContext2D, x: number, y: number, len: number, seed: number, dark: string, light: string): void {
  let cx = x;
  let cy = y;
  for (let k = 0; k < len; k++) {
    const r = hash(seed * 97 + k * 13);
    cx += r < 0.33 ? -1 : r < 0.66 ? 0 : 1;
    cy -= hash(seed * 31 + k * 7) < 0.85 ? 1 : 0;
    rect(g, cx, cy, k < len * 0.6 ? 2 : 1, 1, dark);
    if (hash(seed * 53 + k) < 0.4) rect(g, cx - 1, cy, 1, 1, light);
    // 갈래
    if (k > 4 && hash(seed * 17 + k * 3) < 0.06) crack(g, cx, cy, Math.round(len * 0.35), seed * 7 + k, dark, light);
  }
}

/**
 * 본관 정면 덧그림 (stage 0~3): 투명 바탕에 금, 깨진 유리, 세로로 갈라진 틈과 철근, 그을음, 불 켜진(타는) 창.
 * glow: 불길 빛 (3단계)
 */
function paintDamage(c: HTMLCanvasElement, glow: HTMLCanvasElement, stage: number, sk: number): void {
  const g = c.getContext('2d')!;
  const e = glow.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  e.fillStyle = '#000';
  e.fillRect(0, 0, glow.width, glow.height);
  if (stage <= 0) return;
  const X = (x: number) => Math.round((x - K.x0) * sk);
  const Y = (h: number) => Math.round((K.h - h) * sk);
  // 1단계부터: 로비와 아래층 커튼월을 타고 오르는 금 (싸우는 화면에 보이는 높이)
  const cracks = stage === 1 ? 16 : stage === 2 ? 26 : 36;
  for (let i = 0; i < cracks; i++) {
    const x = K.x0 + 20 + hash(i * 41 + 5) * (W - 40);
    const h = hash(i * 19 + 3) < 0.6 ? 6 + hash(i * 7) * 60 : 150 + hash(i * 11) * 120;
    crack(g, X(x), Y(h), Math.round((34 + hash(i * 23) * 70) * sk), i + 1, C.night, C.glassEdge);
  }
  if (stage >= 2) {
    // 깨진 유리: 커튼월 칸 다섯에 둘쯤 어두운 구멍, 가장자리에 남은 유리 조각
    for (let f = 0; 162 + (f + 1) * K.floor < K.h - 14; f++) {
      const fb = 162 + f * K.floor;
      for (let x: number = K.x0; x < K.x1; x += K.pane) {
        if (hash(f * 131 + x * 7) > 0.38) continue;
        const x0 = X(x + 2);
        const y0 = Y(fb + K.floor - 5);
        const w = Math.max(1, X(x + K.pane) - x0);
        const h = Math.max(1, Y(fb) - y0);
        rect(g, x0, y0, w, h, C.night);
        ditherRect(g, x0, y0, w, h, C.smog1, 5);
        for (let k = 0; k < 3; k++) rect(g, x0 + Math.floor(hash(f * 3 + x + k) * w), y0 + Math.floor(hash(f + x * 3 + k) * h), 1, 1, C.glassEdge);
      }
    }
    // 로비 유리: 듬성듬성 깨짐
    for (let x: number = K.x0 + 8; x < K.x1 - 8; x += 22) {
      if (hash(x * 3 + 1) > 0.45) continue;
      rect(g, X(x), Y(140), Math.max(1, Math.round(16 * sk)), Math.round(60 * sk), C.night);
      ditherRect(g, X(x), Y(140), Math.max(1, Math.round(16 * sk)), Math.round(60 * sk), C.smog1, 6);
    }
  }
  if (stage >= 3) {
    // 세로로 크게 갈라진 틈 셋: 꼭대기에서 로비까지, 아래로 갈수록 넓다. 안쪽은 어둡고 불씨가 비치고 철근이 드러난다
    for (const [x, h0, h1] of SPLITS) {
      let cx = X(x);
      for (let y = Y(h1); y < Y(h0); y++) {
        cx += hash(x + y * 7) < 0.3 ? -1 : hash(x * 3 + y) < 0.3 ? 1 : 0;
        const wd = 3 + Math.round(3 * hash(x + y * 13)) + Math.round((y - Y(h1)) / 30);
        rect(g, cx - (wd >> 1), y, wd, 1, C.night);
        rect(g, cx - (wd >> 1) - 1, y, 1, 1, C.stone);
        if (hash(x * 5 + y) < 0.12) {
          rect(g, cx, y, 1, 1, C.fxOrange);
          rect(e, cx, y, 1, 1, C.fxOrange);
        }
        if (y % 5 === 0) rect(g, cx - (wd >> 1), y, wd, 1, C.rust);
      }
    }
    // 불 붙은 창: 주황으로 빛나고, 위로 그을음
    for (const [x, h] of FIRE_SPOTS) {
      const x0 = X(x - 12);
      const y0 = Y(h + 14);
      const w = Math.round(24 * sk);
      const hh = Math.round(18 * sk);
      rect(g, x0, y0, w, hh, C.fxFlame);
      ditherRect(g, x0, y0, w, hh, C.fxOrange, 8);
      rect(e, x0, y0, w, hh, C.fxOrange);
      ditherRect(e, x0, y0, w, hh, C.fxYellow, 4);
      ditherRect(g, x0 - 2, Y(h + 60), w + 4, Y(h + 14) - Y(h + 60), C.night, 6);
    }
  }
}

/** 기둥탑 앞면 금 (stage 0~3): 벽꽝 높이(바닥 근처)부터 위로, 3단계면 큰 금과 떨어져 나간 모서리 */
function paintPylonCracks(c: HTMLCanvasElement, stage: number, seed: number): void {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  if (stage <= 0) return;
  const n = stage === 1 ? 3 : stage === 2 ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const x = 6 + Math.floor(hash(seed + i * 17) * (c.width - 12));
    const y = c.height - 8 - Math.floor(hash(seed * 3 + i * 5) * (stage === 3 ? c.height * 0.8 : c.height * 0.4));
    crack(g, x, y, 18 + Math.floor(hash(seed + i) * (stage === 3 ? 70 : 30)), seed + i * 3, C.iron, C.stone);
  }
  if (stage >= 2) {
    // 떨어져 나간 모서리 (안쪽 철근)
    for (let i = 0; i < stage; i++) {
      const y = c.height - 30 - Math.floor(hash(seed * 7 + i) * c.height * 0.6);
      const left = hash(seed + i * 9) < 0.5;
      const x = left ? 0 : c.width - 6;
      rect(g, x, y, 6, 9, C.stoneDark);
      rect(g, x + (left ? 1 : 3), y + 2, 2, 1, C.rust);
      rect(g, x + (left ? 2 : 2), y + 5, 2, 1, C.rust);
    }
  }
}

/**
 * 잔해 언덕 앞판 (sim의 덩어리와 같은 자리·윗면 높이): 콘크리트 덩이·유리벽 조각·휜 철골·그을음.
 * 기둥탑 밑동은 처음부터 서 있고(부러진 끝과 철근), 다른 덩어리는 grow(0~1)만큼 쌓인다. 윗면은 밝은 턱, 이웃보다 높은 옆면은 어두운 벽
 */
function paintHillFront(c: HTMLCanvasElement, grow: number): void {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  const s = c.width / (HX1 - HX0);
  const X = (x: number) => Math.round((x - HX0) * s);
  const Y = (h: number) => Math.round((HH - h) * s);
  const stumps = new Set([5, 10]);
  const heightOf = (k: number) => (k < 0 || k >= R.hill.length ? 0 : R.hill[k].h * (stumps.has(k) ? 1 : grow));
  // 불길이 붙은 덩어리 (윗면 가장자리가 주황빛을 받는다)
  const burning = new Set(HILL_FIRES.map(([bi]) => bi));
  R.hill.forEach((b, i) => {
    const stump = stumps.has(i);
    const h = heightOf(i);
    if (h < 2) return;
    const x0 = X(b.x0);
    const x1 = X(b.x1);
    const top = (x: number) => Y(h) + (stump ? Math.round(hash(x * 7 + i) * 8) - 4 : Math.round(hash(x * 13 + i * 5) * 3) - 1);
    if (stump) {
      // 기둥탑 밑동: 콘크리트 몸통(빛 받는 왼쪽 모서리 밝게), 거푸집 줄눈, 가운데 꺼진 빛 홈, 부러진 끝의 철근
      for (let x = x0; x < x1; x++) rect(g, x, top(x), 1, c.height - top(x), x - x0 < 2 ? C.paintCream : x1 - x < 3 ? C.iron : C.stoneDark);
      ditherRect(g, x0 + 2, Y(h), x1 - x0 - 5, c.height - Y(h), C.stone, 4);
      for (let y = Y(h) + 10; y < c.height; y += 14) rect(g, x0 + 2, y, x1 - x0 - 5, 1, C.iron);
      rect(g, Math.round((x0 + x1) / 2) - 1, Y(h) + 8, 3, c.height - Y(h) - 8, C.night);
      for (let k = 0; k < 5; k++) {
        const rx = x0 + 4 + Math.floor(hash(i * 11 + k) * (x1 - x0 - 8));
        const len = 6 + Math.floor(hash(i + k * 3) * 10);
        for (let j = 0; j < len; j++) rect(g, rx + (j > len / 2 && hash(k + i) < 0.5 ? 1 : 0), top(rx) - j, 1, 1, C.rust);
      }
      return;
    }
    // 돌무더기 바탕 (가운데 밝기): 아래로 갈수록 어둡게
    for (let x = x0; x < x1; x++) {
      const t0 = top(x);
      rect(g, x, t0, 1, c.height - t0, C.smog3);
      ditherRect(g, x, t0 + Math.round((c.height - t0) * 0.55), 1, c.height - t0, C.smog2, 8);
    }
    // 콘크리트 덩이·유리벽 조각·휜 철골·그을음
    for (let k = 0; k < (x1 - x0) * 0.9; k++) {
      const r = hash(i * 977 + k * 31);
      const px = x0 + Math.floor(hash(i * 13 + k * 7) * (x1 - x0));
      const py = Y(h) + 4 + Math.floor(hash(i * 5 + k * 17) * (c.height - Y(h)));
      const w = 2 + Math.floor(hash(k * 3 + i) * 7);
      const hh = 2 + Math.floor(hash(k * 5 + i) * 5);
      if (py + hh > c.height || px + w > x1) continue;
      if (r < 0.4) {
        rect(g, px, py, w, hh, C.stone);
        rect(g, px, py, w, 1, C.paintCream);
        rect(g, px, py + hh - 1, w, 1, C.iron);
      } else if (r < 0.56) {
        rect(g, px, py, w + 2, hh + 1, C.glass);
        rect(g, px, py, w + 2, 1, C.chromeDark);
        rect(g, px + 1, py + 1, 1, 1, C.glassEdge);
      } else if (r < 0.68) for (let j = 0; j < w + 6 && px + j < x1; j++) rect(g, px + j, py + Math.floor(j * (hash(k) - 0.5)), 1, 1, C.rust);
      else ditherRect(g, px, py, w + 2, hh + 2, C.night, 6);
    }
    // 윗면 턱 (발판): 밝은 두 줄, 불길 둘레는 주황빛
    for (let x = x0; x < x1; x++) {
      const t0 = top(x);
      rect(g, x, t0, 1, 1, burning.has(i) ? C.fxOrange : C.paintCream);
      rect(g, x, t0 + 1, 1, 1, C.stone);
    }
    // 이웃보다 높은 옆면 (벽): 어두운 면과 밝은 모서리 한 줄
    const left = heightOf(i - 1);
    const right = heightOf(i + 1);
    if (h - left >= R.wallMin * grow) {
      rect(g, x0, Y(h), 3, Y(Math.max(0, left)) - Y(h), C.iron);
      rect(g, x0, Y(h), 1, Y(Math.max(0, left)) - Y(h), C.stone);
    }
    if (h - right >= R.wallMin * grow) {
      rect(g, x1 - 3, Y(h), 3, Y(Math.max(0, right)) - Y(h), C.iron);
      rect(g, x1 - 1, Y(h), 1, Y(Math.max(0, right)) - Y(h), C.night);
    }
  });
  // 바닥 근처 그을음과 웅덩이
  ditherRect(g, 0, c.height - 4, c.width, 4, C.night, 5);
}

/**
 * 잔해 언덕 뒤판: 무너진 본관 덩어리 (가운데가 높고 들쭉날쭉. 부서진 층판이 겹겹이 쌓이고 비스듬히 선 커튼월 조각과 철골).
 * 하늘과 먼 도시가 그 위로 보이게 낮게. grow만큼 쌓인다
 */
function paintHillBack(c: HTMLCanvasElement, grow: number): void {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  if (grow <= 0) return;
  const s = c.width / (BX1 - BX0);
  const tops: number[] = [];
  for (let x = 0; x < c.width; x++) {
    const u = x / c.width;
    const mound = (Math.sin(u * Math.PI) ** 0.8 * 150 + 40) * grow + (hash(x * 3) * 6 - 3) + (hash(Math.floor(x / 11) * 7) * 24 - 12) * grow;
    const top = Math.round(c.height - Math.max(0, mound) * s);
    tops.push(top);
    rect(g, x, top, 1, c.height - top, C.smog1);
    rect(g, x, top, 1, 1, C.smog3);
  }
  // 부서진 층판: 비스듬한 가로 띠 (밝은 윗변)
  for (let k = 0; k < 26; k++) {
    const x = Math.floor(hash(k * 17 + 3) * c.width);
    const w = 18 + Math.floor(hash(k * 5) * 40);
    const y = tops[Math.min(c.width - 1, x)] + 6 + Math.floor(hash(k * 11) * 40);
    const slope = (hash(k * 23) - 0.5) * 0.3;
    for (let j = 0; j < w && x + j < c.width; j++) {
      const yy = y + Math.round(j * slope);
      if (yy < tops[x + j]) continue;
      rect(g, x + j, yy, 1, 3, C.factory);
      rect(g, x + j, yy, 1, 1, C.smog3);
    }
  }
  // 비스듬히 선 커튼월 조각 (쇠틀과 몇 칸 남은 유리)
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(c.width * (0.12 + 0.13 * k + hash(k) * 0.05));
    const h = Math.round((40 + hash(k * 3) * 60) * grow * s);
    const lean = (hash(k * 7) - 0.5) * 0.8;
    const base = tops[Math.min(c.width - 1, x)] + 10;
    for (let y = 0; y < h; y++) {
      const px = x + Math.round(y * lean);
      rect(g, px, base - y, 10, 1, y % 9 === 0 ? C.chromeDark : hash(k * 13 + y) < 0.15 ? C.glass : C.iron);
    }
  }
}
