import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { awningOf, BREAKABLES, frontBuildings, GLASS_BOTTOM, marqueeOf, type Breakable, type FrontBuildingPlace } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, ditherRect, hash, rect } from '../stage/dither';
import { scaleAt } from './core';
import { litMaterial, pixelTexture, shaftMaterial } from './shaders';
import { neonText, paintAwning, paintCar, paintCornice, paintFacade, paintRoof, paintSide, paintSwatches } from './tex';

/**
 * 극장·다이너 거리 (월드 x 400~1,000)의 2.5D 무대 (렌더 전용).
 * 깊이(z, 카메라 쪽 +): 건물 정면 FRONT_Z → 보도 → 길가 주차 줄(차) → 전차 → 싸우는 면(0).
 * 올라설 수 있는 곳(처마·차양·극장 차양)은 정면에서 싸우는 면까지 튀어나와, 그 위에 선 캐릭터와 깊이가 맞는다.
 * 건물·차양·간판 자리는 stage/citadel.ts(판정과 같은 숫자)에서 가져온다.
 */
export const FRONT_Z = -40;
const DEPTH = 140;
const S = scaleAt(FRONT_Z);

/** 간판 위계: 구간마다 주인공 간판 하나만 가장 밝게. 나머지는 어둡거나, 깜빡이거나, 꺼짐 */
type SignRole = 'hero' | 'dim' | 'flicker' | 'off' | 'marquee';
const SIGN_ROLE: Record<string, SignRole> = {
  'blade:PALACE': 'hero',
  'marquee:TONIGHT': 'marquee',
  'board:DINER': 'dim',
  'blade:HOTEL': 'flicker',
  'shop:HOTEL': 'off',
  'shop:BAKERY': 'off',
};

const NEON_HEX: Record<string, [string, string]> = {
  pink: [C.neonPink, C.neonPinkDark],
  cyan: [C.neonCyan, C.neonCyanDark],
  amber: [C.neonAmber, C.neonAmberDark],
  green: [C.neonGreen, C.neonGreenDark],
  red: [C.neonRed, C.neonRedDark],
};

/** 빛을 내는 간판 하나 (부서지는 물건 번호, 역할, 재질, 빛 자리) */
export interface SignInst {
  index: number;
  role: SignRole;
  mat: THREE.ShaderMaterial;
  light: { x: number; y: number; z: number; range: number; color: string; power: number };
}

export interface LampInst {
  index: number;
  x: number;
  head: THREE.Vector3;
  lens: THREE.ShaderMaterial;
  shaft: THREE.Mesh;
}

export interface TheaterSection {
  group: THREE.Group;
  signs: SignInst[];
  lamps: LampInst[];
  /** 붙박이 빛 후보 (창·로비·골목 전구): 위치·닿는 거리·색·세기 */
  fixed: Array<{ x: number; y: number; z: number; range: number; color: string; power: number }>;
  tvs: Array<{ mat: THREE.ShaderMaterial; x: number; y: number; seed: number }>;
}

const inSection = (x: number) => x >= 380 && x < 1010;

/** 상자 하나 (월드 좌표 x0~x1, 바닥 위 y0~y1, 깊이 z0~z1) */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

/** 정면만 보이는 판 (월드 좌표, 깊이 z) */
function plane(x0: number, x1: number, y0: number, y1: number, z: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  return m;
}

/** 작은 장식 상자들 (배관·실외기·물탱크·쓰레기봉투…)을 색 칸 텍스처 하나와 한 덩어리로 묶는다 (그리기 호출 1번) */
class Details {
  private readonly colors: string[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];

  add(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string): void {
    let i = this.colors.indexOf(color);
    if (i < 0) {
      i = this.colors.length;
      this.colors.push(color);
    }
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const u = ((i % 16) * 4 + 2) / 64;
    const v = 1 - (Math.floor(i / 16) * 4 + 2) / 64;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u, v);
    this.geos.push(g);
  }

  build(): THREE.Mesh {
    const merged = mergeBoxes(this.geos);
    return new THREE.Mesh(merged, litMaterial(pixelTexture(paintSwatches(this.colors))));
  }
}

/** 상자 여러 개를 한 덩어리로 (위치·법선·uv만) */
function mergeBoxes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let verts = 0;
  let idx = 0;
  for (const g of geos) {
    verts += g.getAttribute('position').count;
    idx += g.getIndex()!.count;
  }
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const uvs = new Float32Array(verts * 2);
  const index = new Uint32Array(idx);
  let vo = 0;
  let io = 0;
  for (const g of geos) {
    pos.set(g.getAttribute('position').array as Float32Array, vo * 3);
    nor.set(g.getAttribute('normal').array as Float32Array, vo * 3);
    uvs.set(g.getAttribute('uv').array as Float32Array, vo * 2);
    const gi = g.getIndex()!.array;
    for (let k = 0; k < gi.length; k++) index[io + k] = gi[k] + vo;
    vo += g.getAttribute('position').count;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

export function buildTheater(): TheaterSection {
  const group = new THREE.Group();
  const signs: SignInst[] = [];
  const lamps: LampInst[] = [];
  const fixed: TheaterSection['fixed'] = [];
  const tvs: TheaterSection['tvs'] = [];
  const det = new Details();
  const buildings = frontBuildings().filter((b) => b.section === 'theater');

  for (const b of buildings) {
    building(group, b, fixed, tvs, det);
  }
  // 골목 (극장과 다이너 사이): 깊은 안쪽 벽, 뒷문 위 맨 전구, 쓰레기통과 쓰레기봉투, 바닥 증기 구멍
  for (const gap of D.front.theater.list.reduce<Array<{ x: number; w: number }>>((acc, it, k, arr) => {
    if (it.kind === 'alley') acc.push({ x: D.front.theater.x0 + arr.slice(0, k).reduce((s, a) => s + a.w, 0), w: it.w });
    return acc;
  }, [])) {
    const back = plane(gap.x - 2, gap.x + gap.w + 2, 0, 330, FRONT_Z - DEPTH + 2, litMaterial(pixelTexture(paintSide(gap.w + 4, 330, 31, 2)), { tint: 0.6 }));
    group.add(back);
    det.add(gap.x + 3, gap.x + gap.w - 3, 0, 18, FRONT_Z - 70, FRONT_Z - 40, C.paintTeal);
    det.add(gap.x + 2, gap.x + gap.w - 2, 18, 20, FRONT_Z - 72, FRONT_Z - 38, C.iron);
    det.add(gap.x + 2, gap.x + 9, 0, 7, FRONT_Z - 30, FRONT_Z - 22, C.smog1);
    det.add(gap.x + 8, gap.x + 14, 0, 6, FRONT_Z - 26, FRONT_Z - 19, '#1d1a20');
    det.add(gap.x + gap.w / 2 - 1, gap.x + gap.w / 2 + 1, 60, 62, FRONT_Z - DEPTH + 4, FRONT_Z - DEPTH + 10, C.lampCore);
    fixed.push({ x: gap.x + gap.w / 2, y: 58, z: FRONT_Z - DEPTH + 16, range: 70, color: C.lampWarm, power: 0.9 });
  }
  // 간판 (부서지는 네온 물건 자리 그대로)
  BREAKABLES.forEach((b, i) => {
    if (b.kind !== 'neon' || !inSection(b.x)) return;
    const s = sign(b, i);
    if (s) {
      group.add(s.mesh);
      signs.push(s.inst);
    }
  });
  // 쇼윈도 유리 (부서지는 물건): 불 켜진 가게 안
  BREAKABLES.forEach((b) => {
    if (b.kind !== 'glass' || !inSection(b.x)) return;
    group.add(shopGlass(b));
    fixed.push({ x: b.x + b.w / 2, y: GLASS_BOTTOM + b.h / 2, z: FRONT_Z + 10, range: 64, color: C.windowLit, power: 0.5 });
  });
  // 가로등 (부서지는 물건)
  BREAKABLES.forEach((b, i) => {
    if (b.kind !== 'lamp' || !inSection(b.x + b.w / 2)) return;
    const l = lamp(b, i, det, group);
    lamps.push(l);
  });
  // 길가에 선 차 (부서지는 물건)
  BREAKABLES.forEach((b, i) => {
    if (b.kind !== 'car' || !inSection(b.x)) return;
    group.add(car(b, i));
  });
  // 가판대·소화전 (부서지는 물건), 우체통·드럼통·포스터 판 (안 부서지는 소품)
  BREAKABLES.forEach((b) => {
    if (!inSection(b.x)) return;
    if (b.kind === 'newsstand') newsstand(b, det, group);
    if (b.kind === 'hydrant') {
      det.add(b.x + 1, b.x + 9, 0, 14, -34, -26, C.posterRedDark);
      det.add(b.x - 1, b.x + 11, 8, 11, -33, -27, C.posterRedDark);
      det.add(b.x + 3, b.x + 7, 14, 18, -32, -28, C.posterRedDark);
    }
  });
  for (const p of D.street.props) {
    if (!inSection(p.x)) continue;
    if (p.kind === 'mailbox') {
      det.add(p.x, p.x + 14, 5, 26, -36, -26, C.paintTeal);
      det.add(p.x + 2, p.x + 4, 0, 5, -33, -29, C.iron);
      det.add(p.x + 10, p.x + 12, 0, 5, -33, -29, C.iron);
    } else if (p.kind === 'barrel') {
      det.add(p.x, p.x + 14, 0, 20, -38, -26, C.rust);
      det.add(p.x - 0.5, p.x + 14.5, 16, 17, -38.5, -25.5, C.iron);
    } else if (p.kind === 'posterboard') {
      det.add(p.x, p.x + 2, 0, 40, -37, -35, C.iron);
      det.add(p.x + 30, p.x + 32, 0, 40, -37, -35, C.iron);
    }
  }
  // 보도 (연석 높이 2)와 연석 앞면
  group.add(box(380, 1010, -2, 2, FRONT_Z, -24, litMaterial(pixelTexture(sidewalkTex()))));
  group.add(det.build());
  return { group, signs, lamps, fixed, tvs };
}

/** 보도: 콘크리트 판과 이음매, 젖은 얼룩 */
function sidewalkTex(): HTMLCanvasElement {
  const [c, g] = canvas(64, 16);
  rect(g, 0, 0, 64, 16, C.sidewalk);
  for (let x = 0; x < 64; x += 16) rect(g, x, 0, 1, 16, C.sidewalkJoint);
  ditherRect(g, 0, 0, 64, 16, C.smog1, 4);
  rect(g, 0, 0, 64, 1, C.curb);
  return c;
}

function building(group: THREE.Group, b: FrontBuildingPlace, fixed: TheaterSection['fixed'], tvs: TheaterSection['tvs'], det: Details): void {
  const f = paintFacade(b, { s: S });
  const set = b.kind === 'theater' ? 1 : Math.floor(hash(b.seed * 7919) * 3);
  const front = litMaterial(pixelTexture(f.map), { emissive: pixelTexture(f.glow), emissiveStrength: 0.9 });
  const side = litMaterial(pixelTexture(paintSide(DEPTH, b.h, b.seed, set)), { tint: 0.8 });
  const roof = litMaterial(pixelTexture(paintRoof(b.w, DEPTH, b.seed)));
  // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z
  group.add(box(b.x, b.x + b.w, 0, b.h, FRONT_Z - DEPTH, FRONT_Z, [side, side, roof, side, front, side]));
  // 지붕 처마: 정면에서 싸우는 면까지 튀어나와 옥상에 선 캐릭터와 깊이가 맞는다
  const cor = litMaterial(pixelTexture(paintCornice(b.w + 4, 9, b.seed)));
  group.add(box(b.x - 2, b.x + b.w + 2, b.h - 9, b.h, FRONT_Z, 2, cor));
  // 가게 차양 (윗면이 발판)
  const a = awningOf(b);
  if (a) {
    const [stripe, base] = b.kind === 'diner' ? [C.paintTeal, C.carCream] : b.sign === 'HOTEL' ? [C.posterRedDark, C.posterRed] : [C.awningStripe, C.awning];
    const tex = litMaterial(pixelTexture(paintAwning(a.x1 - a.x0, 14, stripe, base)));
    group.add(box(a.x0, a.x1, a.h - 3, a.h, FRONT_Z, 4, tex));
    group.add(box(a.x0, a.x1, a.h - 14, a.h, 4, 5, tex));
  }
  // 극장 전구 차양 (윗면이 발판, 아래에 전구가 줄지어 로비를 비춘다)
  const mq = marqueeOf(b);
  if (mq) {
    const [mc, mg] = canvas(mq.x1 - mq.x0, 22);
    const [ec, eg] = canvas(mq.x1 - mq.x0, 22);
    eg.fillStyle = '#000';
    eg.fillRect(0, 0, ec.width, 22);
    rect(mg, 0, 0, mc.width, 22, C.iron);
    rect(mg, 2, 5, mc.width - 4, 12, C.paintCream);
    rect(eg, 2, 5, mc.width - 4, 12, '#2c271f');
    // 테두리 전구: 반쯤 죽었다
    for (let x = 2; x < mc.width - 2; x += 4) {
      for (const y of [1, 19]) {
        const alive = hash(x * 31 + y) < 0.55;
        rect(mg, x, y, 2, 2, alive ? C.lampGlow : C.awning);
        if (alive) rect(eg, x, y, 2, 2, C.lampGlow);
      }
    }
    // 글씨판: 검은 글자 TONIGHT
    const text = 'TONIGHT';
    const tw = text.length * 8 - 2;
    neonText(mg, null, text, Math.floor((mc.width - tw) / 2), 6, 2, C.iron, C.iron);
    neonText(eg, null, text, Math.floor((mc.width - tw) / 2), 6, 2, '#000000', '#000000');
    const mat = litMaterial(pixelTexture(mc), { emissive: pixelTexture(ec), emissiveStrength: 1.1 });
    group.add(box(mq.x0, mq.x1, mq.h - 22, mq.h, FRONT_Z, 8, mat));
    fixed.push({ x: (mq.x0 + mq.x1) / 2, y: mq.h - 30, z: 14, range: 100, color: C.lampGlow, power: 0.8 });
  }
  // 불 켜진 창 몇 개는 둘레를 물들인다 (붙박이 빛 후보)
  f.lit.slice(0, 4).forEach((w) => {
    fixed.push({ x: b.x + w.x / S, y: b.h - w.y / S, z: FRONT_Z + 8, range: 50, color: w.warm ? C.windowLight : C.officeLit, power: 0.3 });
  });
  // TV 창: 푸르스름한 빛이 깜빡이는 판
  f.tvs.forEach((t, k) => {
    const [tc, tg] = canvas(4, 4);
    rect(tg, 0, 0, 4, 4, '#ffffff');
    const mat = litMaterial(pixelTexture(tc), { emissive: pixelTexture(tc), emissiveStrength: 0 });
    mat.uniforms.tint.value.setRGB(0, 0, 0);
    const x0 = b.x + t.x / S;
    const y1 = b.h - t.y / S;
    group.add(plane(x0 + 1, x0 + t.w / S - 1, y1 - t.h / S + 2, y1 - 2, FRONT_Z + 0.3, mat));
    tvs.push({ mat, x: x0 + t.w / S / 2, y: y1 - t.h / S / 2, seed: b.seed + k * 17 });
  });
  // 배관 (지붕에서 땅까지, 건물 한쪽 모서리)과 받침쇠, 실외기 몇 대, 지붕 위 굴뚝·물탱크·안테나
  const px = hash(b.seed * 3) < 0.5 ? b.x + 3 : b.x + b.w - 6;
  det.add(px, px + 3, 0, b.h - 6, FRONT_Z, FRONT_Z + 3, C.ironLight);
  for (let y = 20; y < b.h - 10; y += 50) det.add(px - 1, px + 4, y, y + 2, FRONT_Z, FRONT_Z + 4, C.iron);
  for (let k = 0; k < 2; k++) {
    if (hash(b.seed + k * 13) < 0.4 || b.floors < 3) continue;
    const fl = 1 + Math.floor(hash(b.seed + k * 29) * (b.floors - 1));
    const ax = b.x + 10 + Math.floor(hash(b.seed + k * 41) * (b.w - 34));
    const ay = D.front.shopH + (fl - 1) * D.front.floorH + 8;
    det.add(ax, ax + 16, ay, ay + 11, FRONT_Z, FRONT_Z + 10, C.chromeDark);
    det.add(ax + 1, ax + 15, ay + 9, ay + 11, FRONT_Z, FRONT_Z + 10, C.ironLight);
  }
  if (b.sign === 'HOTEL') {
    // 물탱크 (다리 넷)와 안테나
    const tx = b.x + b.w - 44;
    for (const lx of [tx + 2, tx + 24]) det.add(lx, lx + 2, b.h, b.h + 14, FRONT_Z - 60, FRONT_Z - 58, C.iron);
    det.add(tx, tx + 28, b.h + 14, b.h + 40, FRONT_Z - 74, FRONT_Z - 46, C.awning);
    det.add(tx - 2, tx + 30, b.h + 40, b.h + 44, FRONT_Z - 76, FRONT_Z - 44, C.iron);
    det.add(b.x + 16, b.x + 17, b.h, b.h + 46, FRONT_Z - 30, FRONT_Z - 29, C.ironLight);
  } else {
    det.add(b.x + 14, b.x + 26, b.h, b.h + 22, FRONT_Z - 50, FRONT_Z - 38, C.brickDark);
    det.add(b.x + 13, b.x + 27, b.h + 22, b.h + 24, FRONT_Z - 51, FRONT_Z - 37, C.stoneDark);
  }
  // 쓰레기봉투 (가게 앞 보도)
  if (b.kind !== 'theater' && hash(b.seed * 11) < 0.7) {
    const bx = b.x + b.w - 26;
    det.add(bx, bx + 9, 0, 8, FRONT_Z + 2, FRONT_Z + 10, '#16141a');
    det.add(bx + 7, bx + 15, 0, 6, FRONT_Z + 4, FRONT_Z + 11, C.smog1);
  }
}

/** 네온 간판: 관 글씨 (켜지면 발광), 뒤판, 빛 자리. 역할에 따라 세기가 다르다 */
function sign(b: Breakable, index: number): { mesh: THREE.Mesh; inst: SignInst } | null {
  const role = SIGN_ROLE[`${b.style}:${b.text}`] ?? 'off';
  const [bright, dark] = NEON_HEX[b.color ?? 'pink'];
  const w = Math.round(b.w);
  const h = Math.round(b.h);
  const [mc, g] = canvas(w, h);
  const [ec, e] = canvas(w, h);
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  const text = b.text ?? '';
  let z0 = FRONT_Z + 0.5;
  let z1 = FRONT_Z + 3;
  if (b.style === 'blade') {
    // 세로 간판: 쇠 뒤판, 테두리 관, 세로 글씨
    rect(g, 0, 0, w, h, C.iron);
    rect(g, 1, 1, w - 2, h - 2, '#1a1418');
    for (const [x, y, ww, hh] of [[1, 1, w - 2, 1], [1, h - 2, w - 2, 1], [1, 1, 1, h - 2], [w - 2, 1, 1, h - 2]] as const) {
      rect(g, x, y, ww, hh, dark);
      rect(e, x, y, ww, hh, bright);
    }
    const step = Math.floor((h - 8) / Math.max(1, text.length));
    const s = Math.max(2, Math.min(Math.floor((w - 6) / 3), Math.floor((step - 3) / 5)));
    [...text].forEach((ch, k) => neonText(g, e, ch, Math.floor((w - 3 * s) / 2), 4 + k * step + Math.floor((step - 5 * s) / 2), s, bright, dark));
    z0 = FRONT_Z + 14;
    z1 = FRONT_Z + 24;
  } else if (b.style === 'board') {
    rect(g, 0, 0, w, h, C.iron);
    rect(g, 2, 2, w - 4, h - 4, '#1c1216');
    for (let x = 2; x < w - 2; x += 4) {
      rect(g, x, 0, 2, 2, C.lampWarm);
      rect(g, x, h - 2, 2, 2, C.lampWarm);
    }
    const tw = text.length * 12 - 3;
    neonText(g, e, text, Math.floor((w - tw) / 2), Math.floor((h - 15) / 2), 3, bright, dark);
    // 다이너는 N 한 글자가 죽어 있다 ("DI ER")
    if (text === 'DINER') rect(e, Math.floor((w - tw) / 2) + 2 * 12, 0, 11, h, '#000000');
  } else if (b.style === 'shop') {
    rect(g, 0, 0, w, h, C.iron);
    neonText(g, e, text, 4, Math.floor((h - 10) / 2), 2, bright, dark);
  } else {
    return null;
  }
  const mat = litMaterial(pixelTexture(mc), { emissive: pixelTexture(ec), emissiveStrength: 0 });
  const mesh = box(b.x, b.x + w, b.bottom, b.bottom + h, z0, z1, mat);
  const power = role === 'hero' ? 2.4 : role === 'dim' ? 0.7 : role === 'flicker' ? 1.0 : 0;
  const range = role === 'hero' ? 190 : 110;
  return {
    mesh,
    inst: { index, role, mat, light: { x: b.x + w / 2, y: b.bottom + h / 2, z: z1 + 20, range, color: bright, power } },
  };
}

/** 쇼윈도 유리: 불 켜진 가게 안 (선반·빵·카운터 그림자), 유리 비침 */
function shopGlass(b: Breakable): THREE.Mesh {
  const w = Math.round(b.w);
  const h = Math.round(b.h);
  const [c, g] = canvas(w, h);
  const [ec, e] = canvas(w, h);
  rect(g, 0, 0, w, h, C.windowLit);
  rect(e, 0, 0, w, h, '#5a4026');
  for (const y of [Math.floor(h * 0.45), Math.floor(h * 0.75)]) {
    rect(g, 2, y, w - 4, 2, C.iron);
    rect(e, 2, y, w - 4, 2, '#000000');
    for (let x = 4; x < w - 6; x += 7) {
      if (hash(b.x * 7 + x + y) < 0.35) continue;
      rect(g, x, y - 4, 5, 4, C.paintOchre);
      rect(e, x, y - 4, 5, 4, '#3a2410');
    }
  }
  // 유리에 비친 거리 (사선) 와 진열창 아래 김서림
  for (let k = 0; k < Math.floor(w / 22); k++) {
    for (let y = 0; y < h; y++) {
      const x = k * 22 + 8 + Math.floor(y * 0.4);
      if (x < w - 1) rect(g, x, h - 1 - y, 1, 1, C.glassEdge);
    }
  }
  ditherRect(g, 0, h - 10, w, 10, C.smog3, 6);
  ditherRect(e, 0, h - 10, w, 10, '#000000', 6);
  return plane(b.x, b.x + w, b.bottom, b.bottom + h, FRONT_Z + 0.4, litMaterial(pixelTexture(c), { emissive: pixelTexture(ec), emissiveStrength: 1.2 }));
}

/** 코브라 헤드 나트륨 가로등: 강철 기둥, 굽은 팔, 머리(아래 렌즈가 발광), 아래로 쏟아지는 빛줄기 */
function lamp(b: Breakable, index: number, det: Details, group: THREE.Group): LampInst {
  const cx = b.x + b.w / 2;
  const z = -30;
  const side = index % 2 ? -1 : 1;
  det.add(cx - 4, cx + 5, 0, 4, z - 4, z + 4, C.iron);
  det.add(cx - 2, cx + 2, 0, 74, z - 2, z + 2, C.iron);
  det.add(cx - 1.5, cx + 1.5, 74, 104, z - 1.5, z + 1.5, C.iron);
  const armX0 = side > 0 ? cx : cx - 18;
  det.add(armX0, armX0 + 18, 102, 105, z - 1.5, z + 1.5, C.iron);
  const hx = cx + side * 18;
  det.add(hx - 7, hx + 7, 104, 109, z - 4, z + 4, C.chromeDark);
  const [lc, lg] = canvas(4, 4);
  rect(lg, 0, 0, 4, 4, C.sodium);
  const lens = litMaterial(pixelTexture(lc), { emissive: pixelTexture(lc), emissiveStrength: 3 });
  const lensMesh = box(hx - 5, hx + 5, 102.5, 104, z - 3, z + 3, lens);
  group.add(lensMesh);
  const smat = shaftMaterial(C.sodium, 0.22);
  // 빛줄기는 캐릭터보다 뒤(보도)라 캐릭터보다 먼저 그린다 (캐릭터는 깊이를 쓰지 않는다)
  smat.transparent = false;
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(42, 102, 20, 1, true), smat);
  shaft.renderOrder = 2;
  shaft.position.set(hx, 102 - 51, z);
  group.add(shaft);
  return { index, x: cx, head: new THREE.Vector3(hx, 100, z + 2), lens, shaft };
}

/** 1960년대 세단 (부서지는 물건): 옆모습 그림을 붙인 낮은 상자. 길가 주차 줄(깊이 -22~-8) */
function car(b: Breakable, index: number): THREE.Mesh {
  const paints = [C.carMint, C.carCoral, C.paintTeal, C.posterRed];
  const w = Math.round(b.w);
  const h = 34;
  const t = paintCar(w, h, paints[index % paints.length], index);
  const mat = litMaterial(pixelTexture(t.map), { emissive: pixelTexture(t.glow), emissiveStrength: 0.8 });
  const end = litMaterial(pixelTexture(paintSide(14, h, index, 2)), { tint: 0.5 });
  const top = litMaterial(pixelTexture(paintSide(w, 14, index, 2)), { tint: 0.3 });
  const m = box(b.x, b.x + w, 0, h, -22, -8, [end, end, top, top, mat, mat]);
  return m;
}

/** 신문 가판대: 지붕, 잡지 칸, NEWS 글씨 (가판대 앞이 거리 쪽) */
function newsstand(b: Breakable, det: Details, group: THREE.Group): void {
  const w = Math.round(b.w);
  const h = Math.round(b.h);
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.awning);
  rect(g, w - 3, 0, 3, h, C.awningStripe);
  rect(g, 3, 8, w - 6, 18, C.windowDark);
  for (let k = 0; k < 6; k++) rect(g, 4 + k * 5, 10 + (k % 2), 4, 14, k % 2 ? C.paintCream : C.stone);
  rect(g, 3, 28, w - 6, 2, C.iron);
  neonText(g, null, 'NEWS', 6, 32, 1, C.paintCream, C.paintCream);
  ditherRect(g, 0, 0, w, h, C.smog1, 4);
  group.add(box(b.x, b.x + w, 0, h - 4, -40, -24, litMaterial(pixelTexture(c))));
  det.add(b.x - 2, b.x + w + 2, h - 4, h, -42, -20, C.iron);
}
