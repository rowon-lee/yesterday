import * as THREE from 'three';
import type { CityState } from '../../sim';
import { CITADEL as D } from '../../data/stages/citadel';
import {
  awningOf, BIG, BREAKABLES, CHUNKS, chunkIndex, chunkStage, CITY_RULES, escapeOf, FLOOR_H, FRONT, FRONT_GAPS, GRIDS, GROUND, MAP_H, MAP_W,
  rubbleOf, SHOP_H, type FrontBuildingPlace,
} from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, hash, line, rect } from '../dither';
import { scaleAt } from './core';
import { Flame } from './fx';
import { paintInterior } from './interior';
import { Details, Geo, plane, type UvFn } from './kit';
import { lightPool, shared } from './lights';
import { litMaterial, pixelTexture } from './shaders';
import { entranceX, paintAwning, paintCornice, paintFacade, paintRoof, paintSide } from './tex';

/**
 * 길가의 부서지는 건물 (극장·다이너 거리, 비상계단 아파트)의 2.5D 무대 (렌더 전용).
 * 깊이(z, 카메라 쪽 +): 몸통 BACK_Z ~ 실내 판 INNER_Z ~ 정면 FRONT_Z → 보도 → 싸우는 면(0).
 * 올라설 수 있는 곳(처마·차양·비상계단 발판)은 정면에서 싸우는 면까지 튀어나와, 그 위에 선 캐릭터와 깊이가 맞는다.
 * 부서짐 (sim의 덩어리 내구도): 정면 그림에서 바뀐 덩어리만 고쳐 그린다. 금 → 구멍(실내가 조금 보임) → 뚫림(실내가 보임).
 * 무너진 칸은 정면·실내·몸통·처마·차양·비상계단이 모두 사라져 뒤쪽 겹이 보인다. 무너진 자리 앞에는 잔해 더미가 쌓인다.
 */
export const FRONT_Z = -40;
export const DEPTH = 140;
const BACK_Z = FRONT_Z - DEPTH;
/** 실내 판 (정면이 뚫리면 보인다) */
const INNER_Z = FRONT_Z - 20;
const S = scaleAt(FRONT_Z);
const SI = scaleAt(INNER_Z);

export interface FixedLight {
  x: number;
  y: number;
  z: number;
  range: number;
  color: string;
  power: number;
  /** 이 덩어리가 뚫리거나 무너지면 꺼진다 (-1이면 늘 켜짐) */
  chunk: number;
}

interface Tv {
  mat: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  seed: number;
  chunk: number;
}

/** 건물 하나의 정면·실내 그림 (고쳐 그리는 캔버스와 처음 모습) */
interface Face {
  b: FrontBuildingPlace;
  bi: number;
  map: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  mapTex: THREE.CanvasTexture;
  glowTex: THREE.CanvasTexture;
  pristine: ImageData;
  pristineGlow: ImageData;
  inner: HTMLCanvasElement;
  innerTex: THREE.CanvasTexture;
  pristineInner: ImageData;
}

/** 이 건물(bi)의 월드 자리(x, 바닥 위 h)에 있는 덩어리 번호 */
function chunkAt(bi: number, x: number, h: number): number {
  const g = GRIDS[bi];
  const c = Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.x) / 16)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.floor(h / 16)));
  return chunkIndex(g, c, r);
}

/** 무너지기 전 정면 그림을 월드 자리에 모은 것 (무너질 때 떨어지는 조각을 잘라 간다). 처음 쓸 때 만든다 */
const registry: Face[] = [];
let atlas: HTMLCanvasElement | null = null;

export function facadeAtlas(): HTMLCanvasElement {
  if (atlas) return atlas;
  const [c, g] = canvas(MAP_W, MAP_H);
  g.imageSmoothingEnabled = false;
  for (const f of registry) {
    const [p, pg] = canvas(f.pristine.width, f.pristine.height);
    pg.putImageData(f.pristine, 0, 0);
    g.drawImage(p, 0, 0, p.width, p.height, f.b.x, GROUND - f.b.h, f.b.w, f.b.h);
  }
  // 빛을 받지 않는 평면 층에 그대로 얹히므로 밤빛(어둡고 차갑게)을 미리 곱해 둔다
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#5d6488';
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.globalCompositeOperation = 'destination-in';
  for (const f of registry) {
    const [p, pg] = canvas(f.pristine.width, f.pristine.height);
    pg.putImageData(f.pristine, 0, 0);
    g.drawImage(p, 0, 0, p.width, p.height, f.b.x, GROUND - f.b.h, f.b.w, f.b.h);
  }
  atlas = c;
  return c;
}

export class Buildings {
  readonly group = new THREE.Group();
  readonly fixed: FixedLight[] = [];
  private readonly tvs: Tv[] = [];
  private readonly faces: Face[] = [];
  /** 덩어리마다 마지막으로 그린 모습 (단계·이웃) */
  private readonly drawn = new Int16Array(CHUNKS.length);
  private readonly rubble: Rubble;
  /** 마지막으로 맞춘 덩어리 내구도의 지문 */
  private sig = -1;

  constructor() {
    const det = new Details();
    FRONT.forEach((b, bi) => this.building(b, bi, det));
    for (const gap of FRONT_GAPS) this.alley(gap.x, gap.w, det);
    // 보도 (연석 높이 2): 극장 거리와 아파트 거리
    const walk = litMaterial(pixelTexture(sidewalkTex()));
    const geo = new Geo();
    for (const id of ['theater', 'apartments'] as const) {
      const sec = D.sections.find((s) => s.id === id)!;
      const uv: UvFn = (f, x, y, z) => (f === 'py' ? [x / 64, (z - FRONT_Z) / 16] : [x / 64, (y + 2) / 16]);
      geo.box('w', sec.x0 - (id === 'theater' ? 20 : 0), sec.x1, -2, 2, FRONT_Z, -24, uv);
    }
    walk.uniforms.map.value.wrapS = THREE.RepeatWrapping;
    walk.uniforms.map.value.wrapT = THREE.RepeatWrapping;
    this.group.add(geo.build({ w: walk }));
    this.group.add(det.build());
    this.rubble = new Rubble(this.group);
  }

  private building(b: FrontBuildingPlace, bi: number, det: Details): void {
    const group = this.group;
    // 정면 (부서지면 고쳐 그린다)
    const f = paintFacade(b, { s: S });
    const fg = f.map.getContext('2d', { willReadFrequently: true })!;
    const eg = f.glow.getContext('2d', { willReadFrequently: true })!;
    const mapTex = pixelTexture(f.map);
    const glowTex = pixelTexture(f.glow);
    group.add(plane(b.x, b.x + b.w, 0, b.h, FRONT_Z, litMaterial(mapTex, { emissive: glowTex, emissiveStrength: 0.9 })));
    // 실내 (정면이 뚫리면 보인다)
    const inner = paintInterior(b, bi, SI);
    const innerTex = pixelTexture(inner.map);
    group.add(plane(b.x, b.x + b.w, 0, b.h, INNER_Z, litMaterial(innerTex, { emissive: pixelTexture(inner.glow), emissiveStrength: 0.7 })));
    const face: Face = {
      b, bi, map: f.map, glow: f.glow, mapTex, glowTex,
      pristine: fg.getImageData(0, 0, f.tw, f.th),
      pristineGlow: eg.getImageData(0, 0, f.tw, f.th),
      inner: inner.map, innerTex,
      pristineInner: inner.map.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, inner.map.width, inner.map.height),
    };
    this.faces.push(face);
    registry.push(face);

    // 몸통: 칸마다 잘라 둔 옆면·지붕 (무너진 칸은 사라진다). 실내 판 앞쪽은 바깥 옆면만
    const set = b.kind === 'theater' ? 1 : Math.floor(hash(b.seed * 7919) * 3);
    const side = litMaterial(pixelTexture(paintSide(DEPTH, b.h, b.seed, set)), { tint: 0.8, attached: true });
    const roof = litMaterial(pixelTexture(paintRoof(b.w, DEPTH, b.seed)), { attached: true });
    const uv: UvFn = (fc, x, y, z) => (fc === 'py' ? [(x - b.x) / b.w, (z - BACK_Z) / DEPTH] : [(z - BACK_Z) / DEPTH, y / b.h]);
    const body = new Geo();
    body.attachedBox(bi, { px: 's', nx: 's', py: 'r' }, b.x, b.x + b.w, 0, b.h, BACK_Z, INNER_Z, uv, ['px', 'nx', 'py']);
    body.attachedBox(bi, { py: 'r' }, b.x, b.x + b.w, 0, b.h, INNER_Z, FRONT_Z, uv, ['py']);
    body.attachedBox(bi, { nx: 's' }, b.x, b.x + 1, 0, b.h, INNER_Z, FRONT_Z, uv, ['nx']);
    body.attachedBox(bi, { px: 's' }, b.x + b.w - 1, b.x + b.w, 0, b.h, INNER_Z, FRONT_Z, uv, ['px']);
    group.add(body.build({ s: side, r: roof }));
    // 층 바닥판 (구멍으로 보이는 단면)
    for (let fl = 1; fl < b.floors; fl++) {
      const y = SHOP_H + (fl - 1) * FLOOR_H;
      det.addAttached(bi, b.x, b.x + b.w, y - 3, y + 1, INNER_Z, FRONT_Z - 0.5, C.stoneDark);
    }

    // 지붕 처마: 정면에서 싸우는 면까지 튀어나와 옥상에 선 캐릭터와 깊이가 맞는다
    const cor = new Geo();
    const cw = b.w + 4;
    cor.attachedBox(bi, 'c', b.x - 2, b.x + b.w + 2, b.h - 9, b.h, FRONT_Z, 2, (fc, x, y, z) =>
      fc === 'py' ? [(x - b.x + 2) / cw, (z - FRONT_Z) / 42] : fc === 'pz' ? [(x - b.x + 2) / cw, (y - b.h + 9) / 9] : [0.5, (y - b.h + 9) / 9],
    ['px', 'nx', 'py', 'pz', 'ny']);
    group.add(cor.build({ c: litMaterial(pixelTexture(paintCornice(cw, 9, b.seed)), { attached: true }) }));

    // 가게 차양 (윗면이 발판)
    const a = awningOf(b);
    if (a) {
      const [stripe, base] = b.kind === 'diner' ? [C.paintTeal, C.carCream] : b.sign === 'HOTEL' ? [C.posterRedDark, C.posterRed]
        : b.sign === 'LAUNDRY' ? [C.paintTeal, C.paintCream] : b.sign === 'GROCER' ? [C.carMint, C.paintCream] : [C.awningStripe, C.awning];
      const aw = a.x1 - a.x0;
      const tex = litMaterial(pixelTexture(paintAwning(aw, 14, stripe, base)), { attached: true });
      const ag = new Geo();
      const auv: UvFn = (fc, x, y) => [(x - a.x0) / aw, fc === 'py' ? 0.9 : (y - (a.h - 14)) / 14];
      ag.attachedBox(bi, 'a', a.x0, a.x1, a.h - 3, a.h, FRONT_Z, 4, auv, ['py', 'px', 'nx']);
      ag.attachedBox(bi, 'a', a.x0, a.x1, a.h - 14, a.h, 4, 5, auv, ['pz', 'py', 'px', 'nx']);
      group.add(ag.build({ a: tex }));
    }

    // 아파트: 비상계단, 현관 돌계단
    const esc = escapeOf(b);
    if (esc) fireEscape(det, bi, esc);
    if (b.kind === 'apartment' && !b.sign) {
      const dx = b.x + entranceX(b);
      for (let st = 0; st < 3; st++) {
        const x0 = dx - 6 - st * 3;
        det.addAttached(bi, x0, x0 + 40 + st * 6, 8 - st * 4, 12 - st * 4, FRONT_Z, FRONT_Z + 6 + st * 4, st % 2 ? C.stoneDark : C.stone);
      }
      // 현관 등 (문 위 작은 등)
      det.add(dx + 12, dx + 16, 92, 96, FRONT_Z, FRONT_Z + 3, C.lampCore, [bi + 1, Math.floor((dx + 14 - b.x) / 16)]);
      this.fixed.push({ x: dx + 14, y: 90, z: FRONT_Z + 10, range: 54, color: C.lampWarm, power: 0.7, chunk: chunkAt(bi, dx + 14, 90) });
    }

    // 불 켜진 창 몇 개는 둘레를 물들인다 (붙박이 빛 후보)
    f.lit.slice(0, 5).forEach((w) => {
      const x = b.x + w.x / S;
      const y = b.h - w.y / S;
      this.fixed.push({ x, y, z: FRONT_Z + 8, range: 50, color: w.warm ? C.windowLight : C.officeLit, power: 0.3, chunk: chunkAt(bi, x, y) });
    });
    if (b.kind === 'theater') this.fixed.push({ x: b.x + b.w / 2, y: 30, z: FRONT_Z + 14, range: 80, color: C.windowLit, power: 0.6, chunk: chunkAt(bi, b.x + b.w / 2, 30) });
    // TV 창: 푸르스름한 빛이 깜빡이는 판
    f.tvs.forEach((t, k) => {
      const [tc, tg] = canvas(4, 4);
      rect(tg, 0, 0, 4, 4, '#4f6f9c');
      const mat = litMaterial(pixelTexture(tc), { emissive: pixelTexture(tc), emissiveStrength: 0 });
      mat.uniforms.tint.value.setRGB(0, 0, 0);
      const x0 = b.x + t.x / S;
      const y1 = b.h - t.y / S;
      const mesh = plane(x0 + 1, x0 + t.w / S - 1, y1 - t.h / S + 2, y1 - 2, FRONT_Z + 0.3, mat);
      group.add(mesh);
      const cx = x0 + t.w / S / 2;
      const cy = y1 - t.h / S / 2;
      this.tvs.push({ mat, mesh, x: cx, y: cy, seed: b.seed + k * 17, chunk: chunkAt(bi, cx, cy) });
    });

    // 배관 (지붕에서 땅까지, 건물 한쪽 모서리)과 받침쇠, 실외기 몇 대, 지붕 위 굴뚝·물탱크·안테나
    const px = esc ? b.x + 3 : hash(b.seed * 3) < 0.5 ? b.x + 3 : b.x + b.w - 6;
    det.addAttached(bi, px, px + 3, 0, b.h - 6, FRONT_Z, FRONT_Z + 3, C.ironLight);
    for (let y = 20; y < b.h - 10; y += 50) det.addAttached(bi, px - 1, px + 4, y, y + 2, FRONT_Z, FRONT_Z + 4, C.iron);
    for (let k = 0; k < 2; k++) {
      if (hash(b.seed + k * 13) < 0.4 || b.floors < 3) continue;
      const fl = 1 + Math.floor(hash(b.seed + k * 29) * (b.floors - 1));
      const span = esc ? esc.x0 - b.x - 30 : b.w - 34;
      const ax = b.x + 10 + Math.floor(hash(b.seed + k * 41) * Math.max(1, span));
      const ay = SHOP_H + (fl - 1) * FLOOR_H + 8;
      det.addAttached(bi, ax, ax + 16, ay, ay + 11, FRONT_Z, FRONT_Z + 10, C.chromeDark);
      det.addAttached(bi, ax + 1, ax + 15, ay + 9, ay + 11, FRONT_Z, FRONT_Z + 10, C.ironLight);
    }
    // 큰 급수탑이 선 지붕(식료품점)에는 작은 물탱크를 두지 않는다 (급수탑은 bigprops.ts)
    const tank = b.sign === 'HOTEL' || (b.kind === 'apartment' && hash(b.seed * 5) < 0.6 && b.sign !== 'RADIO' && bi !== BREAKABLES[BIG.watertower].b);
    if (tank) {
      // 물탱크 (다리 넷, 나무 통, 원뿔 지붕)
      const tx = b.kind === 'apartment' ? b.x + 18 : b.x + b.w - 44;
      const at = [bi + 1, Math.floor((tx + 14 - b.x) / 16)] as const;
      for (const lx of [tx + 2, tx + 24]) det.add(lx, lx + 2, b.h, b.h + 14, FRONT_Z - 60, FRONT_Z - 58, C.iron, at);
      det.add(tx, tx + 28, b.h + 14, b.h + 40, FRONT_Z - 74, FRONT_Z - 46, C.awning, at);
      for (let y = b.h + 18; y < b.h + 40; y += 7) det.add(tx - 0.5, tx + 28.5, y, y + 1, FRONT_Z - 74.5, FRONT_Z - 45.5, C.iron, at);
      for (let k = 0; k < 4; k++) det.add(tx + k * 3, tx + 28 - k * 3, b.h + 40 + k, b.h + 41 + k, FRONT_Z - 76 + k * 3, FRONT_Z - 44 - k * 3, C.ironLight, at);
      det.add(b.x + b.w - 16, b.x + b.w - 15, b.h, b.h + 46, FRONT_Z - 30, FRONT_Z - 29, C.ironLight, [bi + 1, Math.floor((b.w - 16) / 16)]);
    } else {
      const at = [bi + 1, Math.floor(20 / 16)] as const;
      det.add(b.x + 14, b.x + 26, b.h, b.h + 22, FRONT_Z - 50, FRONT_Z - 38, C.brickDark, at);
      det.add(b.x + 13, b.x + 27, b.h + 22, b.h + 24, FRONT_Z - 51, FRONT_Z - 37, C.stoneDark, at);
    }
    // 쓰레기봉투 (가게 앞 보도)
    if (b.kind !== 'theater' && hash(b.seed * 11) < 0.7) {
      const bx = esc ? esc.x0 - 22 : b.x + b.w - 26;
      det.add(bx, bx + 9, 0, 8, FRONT_Z + 2, FRONT_Z + 10, '#16141a');
      det.add(bx + 7, bx + 15, 0, 6, FRONT_Z + 4, FRONT_Z + 11, C.smog1);
    }
  }

  /** 골목: 깊은 안쪽 벽, 뒷문 위 맨 전구, 쓰레기통과 쓰레기봉투 */
  private alley(x: number, w: number, det: Details): void {
    this.group.add(plane(x - 2, x + w + 2, 0, 330, BACK_Z + 2, litMaterial(pixelTexture(paintSide(w + 4, 330, Math.round(x), 2)), { tint: 0.6 })));
    det.add(x + 3, x + w - 3, 0, 18, FRONT_Z - 70, FRONT_Z - 40, C.paintTeal);
    det.add(x + 2, x + w - 2, 18, 20, FRONT_Z - 72, FRONT_Z - 38, C.iron);
    det.add(x + 2, x + 9, 0, 7, FRONT_Z - 30, FRONT_Z - 22, C.smog1);
    det.add(x + 8, x + 14, 0, 6, FRONT_Z - 26, FRONT_Z - 19, '#1d1a20');
    det.add(x + w / 2 - 1, x + w / 2 + 1, 60, 62, BACK_Z + 4, BACK_Z + 10, C.lampCore);
    // 뒷문
    det.add(x + 3, x + w - 3, 0, 40, BACK_Z + 2, BACK_Z + 3, C.iron);
    this.fixed.push({ x: x + w / 2, y: 58, z: BACK_Z + 16, range: 70, color: C.lampWarm, power: 0.9, chunk: -1 });
  }

  /** 부서진 덩어리를 고쳐 그리고, 무너진 칸을 지우고, 잔해 더미를 쌓는다 */
  update(city: CityState | null, tick: number): void {
    const hp = city?.hp ?? null;
    // 덩어리 내구도가 지난 프레임과 같으면 덩어리를 훑지 않는다 (대부분의 프레임)
    let sig = city ? city.collapses.length : -2;
    if (hp) for (let i = 0; i < hp.length; i++) sig = (Math.imul(sig, 31) + hp[i] + 7) | 0;
    if (sig !== this.sig) {
      this.sig = sig;
      this.patch(hp);
    }
    this.rubble.update(city, tick);
  }

  /** 모습이 바뀐 덩어리만 다시 그리고 무너진 칸 비트를 맞춘다 */
  private patch(hp: readonly number[] | null): void {
    const changed = new Set<Face>();
    const innerChanged = new Set<Face>();
    for (let i = 0; i < CHUNKS.length; i++) {
      const key = hp ? keyOf(hp, i) : 0;
      const was = this.drawn[i];
      if (key === was) continue;
      const face = this.faces[CHUNKS[i].b];
      patchFacade(face, i, key);
      changed.add(face);
      if ((key >> 8 === 4) !== (was >> 8 === 4)) {
        patchInner(face, i, key >> 8 === 4);
        innerChanged.add(face);
      }
      this.drawn[i] = key;
    }
    for (const f of changed) {
      f.mapTex.needsUpdate = true;
      f.glowTex.needsUpdate = true;
    }
    for (const f of innerChanged) f.innerTex.needsUpdate = true;
    // 무너진 칸 (칸마다 비트)
    const gone = shared.uGone.value;
    GRIDS.forEach((g, bi) => {
      let m = 0;
      if (hp) for (let c = 0; c < g.cols; c++) if (hp[chunkIndex(g, c, 0)] < 0) m |= 1 << c;
      gone[bi] = m;
    });
  }

  /** 붙박이 빛 (뚫리거나 무너진 덩어리의 창은 꺼진다)과 깜빡이는 TV */
  lights(city: CityState | null, tick: number): void {
    const hp = city?.hp ?? null;
    const solid = (chunk: number) => chunk < 0 || !hp || hp[chunk] > 0;
    for (const f of this.fixed) if (solid(f.chunk)) lightPool.add(f.x, f.y, f.z, f.range, f.color, f.power);
    for (const tv of this.tvs) {
      const on = solid(tv.chunk);
      tv.mesh.visible = on;
      if (!on) continue;
      // TV: 장면이 바뀔 때마다 밝기·색이 튄다
      const r = hash((tick >> 3) * 977 + tv.seed);
      const k = 0.5 + r * 0.9;
      tv.mat.uniforms.emissiveStrength.value = k;
      lightPool.add(tv.x, tv.y, -34, 48, r < 0.5 ? '#7fb6ff' : '#bfe3ff', 0.35 * k);
    }
  }
}

/** 보도: 콘크리트 판과 이음매, 젖은 얼룩 */
function sidewalkTex(): HTMLCanvasElement {
  const [c, g] = canvas(64, 16);
  rect(g, 0, 0, 64, 16, C.sidewalk);
  for (let x = 0; x < 64; x += 16) rect(g, x, 0, 1, 16, C.sidewalkJoint);
  for (let k = 0; k < 40; k++) rect(g, Math.floor(hash(k * 13 + 1) * 64), Math.floor(hash(k * 7 + 3) * 16), 1, 1, C.smog1);
  rect(g, 0, 0, 64, 1, C.curb);
  return c;
}

/**
 * 철제 비상계단: 층마다 발판(윗면이 발판 높이, 정면에서 싸우는 면까지), 앞 난간, 발판 사이를 잇는 비스듬한 계단,
 * 맨 아래 접힌 사다리, 발판 밑 받침쇠. 발판 높이는 stage/citadel.ts의 escapeOf와 같다 (판정과 그림이 같은 숫자).
 */
function fireEscape(det: Details, bi: number, e: { x0: number; x1: number; landings: number[] }): void {
  const at = (x: number) => [bi + 1, Math.max(0, Math.min(GRIDS[bi].cols - 1, Math.floor((x - GRIDS[bi].x) / 16)))] as const;
  e.landings.forEach((h, n) => {
    // 발판: 쇠살 (아래 짙게, 윗면 밝게)
    det.addAttached(bi, e.x0, e.x1, h - 3, h - 1, FRONT_Z, 2, C.iron);
    det.addAttached(bi, e.x0, e.x1, h - 1, h, FRONT_Z, 2, C.ironLight);
    // 앞 난간: 위 가로대, 가운데 가로대, 세로살 (싸우는 면 바로 앞)
    det.addAttached(bi, e.x0, e.x1, h + 11, h + 12, 1, 2, C.ironLight);
    det.addAttached(bi, e.x0, e.x1, h + 5, h + 6, 1, 2, C.iron);
    for (let x = e.x0; x <= e.x1 - 1; x += 6) det.add(x, x + 1, h, h + 11, 1, 2, C.iron, at(x));
    // 옆 난간 (정면에서 앞으로)
    for (const x of [e.x0, e.x1 - 1]) {
      det.add(x, x + 1, h + 11, h + 12, FRONT_Z, 1, C.ironLight, at(x));
      det.add(x, x + 1, h, h + 11, FRONT_Z + 20, FRONT_Z + 21, C.iron, at(x));
    }
    // 받침쇠
    for (const x of [e.x0 + 4, e.x1 - 6]) det.add(x, x + 2, h - 10, h - 3, FRONT_Z, FRONT_Z + 3, C.iron, at(x));
    det.bar(e.x0 + 5, h - 10, e.x0 + 5, h - 3, 1, FRONT_Z, FRONT_Z + 24, C.iron, at(e.x0 + 5));
    // 아래 발판에서 올라오는 계단 (번갈아 방향이 바뀐다)
    const below = e.landings[n - 1];
    if (below !== undefined) {
      const [ax, bx] = n % 2 ? [e.x0 + 6, e.x1 - 10] : [e.x1 - 6, e.x0 + 10];
      det.bar(ax, h - 1, bx, below, 2, -26, -24, C.iron, at((ax + bx) / 2));
      det.bar(ax, h - 1, bx, below, 2, -12, -10, C.iron, at((ax + bx) / 2));
      for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const sx = ax + (bx - ax) * t;
        const sy = h - 1 + (below - (h - 1)) * t;
        det.add(sx - 2, sx + 2, sy - 1, sy, -26, -10, C.ironLight, at(sx));
      }
    }
  });
  // 맨 아래 접힌 사다리
  const ly = e.landings[0] - 3;
  for (const lx of [e.x0 + 10, e.x0 + 18]) det.add(lx, lx + 1, ly - 30, ly, -6, -5, C.iron, at(lx));
  for (let y = ly - 26; y < ly; y += 5) det.add(e.x0 + 10, e.x0 + 19, y, y + 1, -6, -5, C.iron, at(e.x0 + 14));
}

/**
 * 모습 열쇠: 단계 ×256 + 뚫린 이웃(4비트) ×16 + 사라진 이웃(4비트).
 * 이웃 비트: 1 왼쪽, 2 오른쪽, 4 위, 8 아래. 가장자리를 부서진 모양으로 그리려고 이웃까지 본다.
 */
function keyOf(hp: readonly number[], i: number): number {
  const st = chunkStage(hp[i]);
  if (st === 4) return 4 * 256;
  const k = CHUNKS[i];
  const g = GRIDS[k.b];
  const stageAt = (c: number, r: number) => (c >= 0 && c < g.cols && r >= 0 && r < g.rows ? chunkStage(hp[chunkIndex(g, c, r)]) : 0);
  const nb = [stageAt(k.c - 1, k.r), stageAt(k.c + 1, k.r), stageAt(k.c, k.r + 1), stageAt(k.c, k.r - 1)];
  let open = 0;
  let gone = 0;
  nb.forEach((v, j) => {
    if (v === 3) open |= 1 << j;
    if (v === 4) gone |= 1 << j;
  });
  return st * 256 + open * 16 + gone;
}

/** 덩어리의 텍스처 칸 사각형 (배율 s) */
function texRect(b: FrontBuildingPlace, i: number, s: number, th: number): [number, number, number, number] {
  const k = CHUNKS[i];
  const x0 = Math.round((k.x - b.x) * s);
  const x1 = Math.round((k.x + k.w - b.x) * s);
  const y0 = th - Math.round((k.y0 + k.h) * s);
  const y1 = th - Math.round(k.y0 * s);
  return [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
}

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const SOOT = hexRgb(C.fxSoot);
const BRICK_DARK = hexRgb(C.brickDark);
const BRICK_LIGHT = hexRgb(C.brickLight);

/**
 * 덩어리 하나를 단계에 맞게 고쳐 그린다 (정면 그림과 발광). 투명한 칸은 뒤 실내 판이 보이고, 무너진 칸은 뒤쪽 겹이 보인다.
 * 금(갈라진 선) → 구멍(벽돌이 떨어져 실내가 조금 보임) → 뚫림(실내) → 사라짐. 이웃이 뚫리거나 사라진 쪽 가장자리는 부서진 모양.
 */
function patchFacade(f: Face, i: number, key: number): void {
  const th = f.map.height;
  const [x, y, w, h] = texRect(f.b, i, S, th);
  if (w <= 0 || h <= 0) return;
  const g = f.map.getContext('2d')!;
  const e = f.glow.getContext('2d')!;
  const out = g.createImageData(w, h);
  const eout = e.createImageData(w, h);
  const P = f.pristine;
  const PG = f.pristineGlow;
  const st = key >> 8;
  const open = (key >> 4) & 15;
  const gone = key & 15;
  const seed = i * 2654435761;
  const r = (j: number) => hash(seed + j * 7919);
  // 처음 모습을 옮긴다
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const s = ((y + py) * P.width + x + px) * 4;
      const d = (py * w + px) * 4;
      for (let c = 0; c < 4; c++) {
        out.data[d + c] = P.data[s + c];
        eout.data[d + c] = PG.data[s + c];
      }
    }
  }
  const set = (px: number, py: number, rgb: [number, number, number] | null) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const d = (py * w + px) * 4;
    if (rgb) {
      out.data[d] = rgb[0];
      out.data[d + 1] = rgb[1];
      out.data[d + 2] = rgb[2];
      out.data[d + 3] = 255;
    } else out.data[d + 3] = 0;
    eout.data[d] = eout.data[d + 1] = eout.data[d + 2] = 0;
  };
  /** 가장자리 띠: sides 쪽 변에서 4칸 안쪽까지, 그 변에서의 거리와 함께 */
  const ragged = (sides: number, fn: (px: number, py: number, edge: number) => void) => {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const edge = Math.min(sides & 1 ? px : 9, sides & 2 ? w - 1 - px : 9, sides & 4 ? py : 9, sides & 8 ? h - 1 - py : 9);
        if (edge < 4) fn(px, py, edge);
      }
    }
  };
  if (st === 4) {
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) set(px, py, null);
  } else if (st === 3) {
    // 뚫림: 실내가 보이고, 아직 서 있는 이웃 쪽 가장자리는 부서진 벽돌이 삐죽 남는다
    const keep = new Uint8Array(w * h);
    const solid = ~(open | gone) & 15;
    ragged(solid, (px, py, edge) => {
      if (r(py * 17 + px) < (3 - edge) * 0.3) keep[py * w + px] = edge === 2 ? 2 : 1;
    });
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const k = keep[py * w + px];
        if (!k) set(px, py, null);
        else if (k === 2) set(px, py, BRICK_DARK);
      }
    }
  } else {
    if (open) ragged(open, (px, py, edge) => {
      if (r(py * 23 + px + 5) < (3 - edge) * 0.28) set(px, py, null);
    });
    if (gone) ragged(gone, (px, py, edge) => {
      const v = r(py * 29 + px + 9);
      if (v < (4 - edge) * 0.24) set(px, py, null);
      else if (edge < 4 && v < (4 - edge) * 0.32) set(px, py, BRICK_DARK);
    });
  }
  if (st === 1 || st === 2) {
    // 금: 벽돌 사이로 갈라진 선 세 줄
    const cx = Math.floor(w * (0.3 + r(1) * 0.4));
    const cy = Math.floor(h * (0.3 + r(2) * 0.4));
    const plot = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let t = 0; t <= n; t++) set(Math.round(x0 + ((x1 - x0) * t) / n), Math.round(y0 + ((y1 - y0) * t) / n), SOOT);
    };
    for (let j = 0; j < 3; j++) {
      const ang = r(j + 3) * Math.PI * 2;
      const len = 5 + r(j + 6) * 8;
      const mx = Math.round(cx + Math.cos(ang) * len * 0.5 + (r(j + 9) - 0.5) * 3);
      const my = Math.round(cy + Math.sin(ang) * len * 0.5 + (r(j + 12) - 0.5) * 3);
      plot(cx, cy, mx, my);
      plot(mx, my, Math.round(cx + Math.cos(ang) * len), Math.round(cy + Math.sin(ang) * len));
    }
    if (st === 2) {
      // 구멍: 벽돌이 떨어져 나간 자리로 실내가 조금 보인다. 가장자리는 벽돌 단면
      const rad = 4 + r(20) * 2.5;
      for (let py = -7; py <= 7; py++) {
        for (let px = -7; px <= 7; px++) {
          const d = Math.hypot(px, py * 1.2) + (r(py * 31 + px + 40) - 0.5) * 2.4;
          if (d < rad) set(cx + px, cy + py, null);
          else if (d < rad + 1.5) set(cx + px, cy + py, d < rad + 0.8 ? BRICK_DARK : BRICK_LIGHT);
        }
      }
    }
  }
  g.putImageData(out, x, y);
  e.putImageData(eout, x, y);
}

/** 실내 판: 무너진 칸은 비우고, 다시 서면(새 판) 되돌린다 */
function patchInner(f: Face, i: number, gone: boolean): void {
  const th = f.inner.height;
  const [x, y, w, h] = texRect(f.b, i, SI, th);
  if (w <= 0 || h <= 0) return;
  const g = f.inner.getContext('2d')!;
  if (gone) g.clearRect(x, y, w, h);
  else g.putImageData(f.pristineInner, 0, 0, x, y, w, h);
}

/**
 * 무너진 자리의 잔해 더미 (정면 앞 보도): 무너진 직후부터 40틱 동안 차오른다. 벽돌·돌 조각, 삐져나온 철골과 판자.
 * 차오르는 동안만 몇 번 다시 그리고, 다 쌓이면 그대로 둔다.
 */
/**
 * 무너진 자리의 잔해 더미와 타는 불: 무너진 뒤 15초 동안 더미 위에서 불길이 줄어들며 타고, 그 뒤로는 잉걸불 빛만 남는다
 * (어둠 속에서 더미와 그 위에 선 사람을 비추는 실제 광원).
 */
class Rubble {
  private readonly piles: Array<{ mesh: THREE.Mesh; c: HTMLCanvasElement; tex: THREE.CanvasTexture; step: number; key: string }> = [];
  private readonly flames: Flame[] = [];

  constructor(private readonly group: THREE.Group) {}

  update(city: CityState | null, tick: number): void {
    const list = city?.collapses ?? [];
    while (this.piles.length > list.length) {
      const p = this.piles.pop()!;
      this.group.remove(p.mesh);
      p.tex.dispose();
      (p.mesh.material as THREE.Material).dispose();
      p.mesh.geometry.dispose();
    }
    this.fires(list, tick);
    list.forEach((col, k) => {
      const r = rubbleOf(col.b, col.c0, col.c1);
      const { x0, x1 } = r;
      const key = `${col.b}:${col.c0}:${col.c1}:${col.tick}`;
      let p = this.piles[k];
      if (p && p.key !== key) {
        this.group.remove(p.mesh);
        p = undefined as unknown as typeof p;
      }
      if (!p) {
        const [c] = canvas(x1 - x0, 64);
        const tex = pixelTexture(c);
        const mesh = plane(x0, x1, 0, 64, FRONT_Z + 10, litMaterial(tex));
        this.group.add(mesh);
        // 건물 무리는 자리 행렬을 다시 계산하지 않으므로 새로 놓은 더미는 직접 한 번 계산한다
        mesh.updateMatrixWorld(true);
        p = { mesh, c, tex, step: -1, key };
        this.piles[k] = p;
      }
      const step = Math.min(8, Math.max(0, Math.floor(((tick - col.tick) / CITY_RULES.rubble.settle) * 8)));
      if (step === p.step) return;
      p.step = step;
      paintRubble(p.c, r, step / 8, col.b * 977 + col.c0 * 31);
      p.tex.needsUpdate = true;
    });
  }

  /** 최근 더미부터 FIRES개까지 불길과 잉걸불 빛 */
  private fires(list: CityState['collapses'], tick: number): void {
    while (this.flames.length < FIRES) {
      const f = new Flame(22, 18, 70 + this.flames.length);
      this.flames.push(f);
      this.group.add(f.mesh);
    }
    this.flames.forEach((f, k) => {
      const col = list[list.length - 1 - k];
      if (!col) return f.set(0, 0, 0, 0);
      const r = rubbleOf(col.b, col.c0, col.c1);
      const age = tick - col.tick;
      const settled = age >= CITY_RULES.rubble.settle;
      const burn = settled ? Math.max(0, 1 - age / BURN) : 0;
      const cx = Math.round((r.tx0 + r.tx1) / 2 + (k % 2 ? 9 : -12));
      if (burn > 0) {
        const h = Math.round(5 + 13 * burn);
        f.set(cx - 11, r.h - 3, FRONT_Z + 11, h);
        lightPool.add(cx, r.h + h / 2, -10, 60 + h * 4, C.fxOrange, (0.7 + 0.4 * hash((tick >> 2) * 7 + k)) * (0.4 + 0.6 * burn));
      } else {
        f.set(0, 0, 0, 0);
        if (settled) lightPool.add(cx, r.h, -10, 54, C.fxOrange, 0.3 + 0.1 * hash((tick >> 3) * 11 + k));
      }
    });
  }
}

/** 불길을 붙이는 더미 수 (최근 것부터)와 불이 타는 틱 (그 뒤로는 잉걸불 빛만) */
const FIRES = 6;
const BURN = 900;

/**
 * 잔해 더미 (sim의 잔해 더미와 같은 자리·높이): 양 끝은 거의 서 있는 벽 조각(벽 기동에 쓰는 벽), 가운데 윗면은 고른 돌무더기(발판).
 * 다 쌓이면 윗면이 r.h에 닿는다. grow: 쌓인 정도 0~1.
 */
function paintRubble(c: HTMLCanvasElement, r: { x0: number; x1: number; h: number; tx0: number; tx1: number }, grow: number, seed: number): void {
  const g = c.getContext('2d')!;
  const w = c.width;
  const H = c.height;
  g.clearRect(0, 0, w, H);
  if (grow <= 0) return;
  const top = r.h * grow;
  const tx0 = r.tx0 - r.x0;
  const tx1 = r.tx1 - r.x0;
  for (let x = 0; x < w; x++) {
    // 양 끝 6px은 선 벽 조각, 그 안쪽은 윗면까지 가파르게 오른다
    const edge = Math.min(x, w - 1 - x);
    const ramp = x < tx0 ? (x - 6) / Math.max(1, tx0 - 6) : x > tx1 ? (w - 7 - x) / Math.max(1, w - 7 - tx1) : 1;
    const k = edge < 6 ? 0.92 - (edge % 3) * 0.04 : Math.max(0.55, Math.min(1, 0.55 + 0.45 * ramp));
    const bump = x >= tx0 && x <= tx1 ? (hash(seed + x) < 0.25 ? 1 : 0) : Math.floor(hash(seed + x * 3) * 4);
    const hgt = Math.max(0, Math.round(top * k) - bump);
    for (let y = 0; y < hgt; y++) {
      const n = hash(seed + x * 131 + y * 17);
      const wall = edge < 6;
      // 위쪽 몇 줄은 빛을 받는 돌 조각 (어둠 속에서도 더미 윤곽이 읽히게)
      const lit = hgt - y <= 3;
      const c = wall
        ? (y % 8 === 7 ? C.stoneDark : edge === 0 || edge === 5 ? C.stoneDark : n < 0.5 ? C.stone : C.brickRed)
        : lit ? (n < 0.5 ? C.stone : n < 0.8 ? C.brickLight : C.paintCream)
        : n < 0.4 ? C.brickRedDark : n < 0.7 ? C.brickRed : n < 0.88 ? C.stoneDark : C.brickLight;
      rect(g, x, H - 1 - y, 1, 1, c);
    }
    // 윗면 가장자리를 한 줄 밝게 (발판이 읽히게)
    if (hgt > 2 && x >= tx0 && x <= tx1) rect(g, x, H - hgt, 1, 1, C.paintCream);
  }
  // 삐져나온 철골과 판자
  for (let j = 0; j < 4; j++) {
    const bx = Math.floor(hash(seed + j * 3) * w);
    const len = 8 + Math.floor(hash(seed + j * 5) * 14);
    const dir = hash(seed + j * 7) < 0.5 ? -1 : 1;
    line(g, bx, H - Math.round(top * 0.6), bx + dir * len, H - Math.round(top * 0.6) - len, j % 2 ? C.iron : C.awning);
  }
}
