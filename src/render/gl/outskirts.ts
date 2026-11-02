import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { MAP_ENDS } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, hash, rect, solidTex } from '../dither';
import { drawText, glyphRows, textWidth } from '../font';
import { Beam, Puffs, Sparks } from './fx';
import { scaleAt } from './core';
import { Details, FREE, Geo, plane, type Face } from './kit';
import { lightPool } from './lights';
import { FLUO, FURNACE, figure, glowRect, PINK, roomWall, sil, TV, WARM, type RoomLamp, type RoomRamp } from './rooms';
import { decalMaterial, detailEnabled, litMaterial, pixelTexture } from './shaders';
import { registerSign } from './signs';
import { neonText } from './tex';

/**
 * 맵을 넓히며 붙인 네 구간 (렌더 전용, 무너지지 않는다). 발판·벽 자리는 데이터(outskirts)와 sim이 정하고,
 * 여기서는 그 자리에 모양을 세운다. 구간마다 그림 모음(Atlas) 한 장: 면마다 그 깊이의 배율로 칠해서
 * 텍스처 한 칸이 화면 1px이고 (픽셀 크기 하나), 구간의 상자·판이 한 기하로 묶인다 (그리기 호출이 적다).
 * - 공장 지대: 서쪽 끝 공장(맵 끝 벽), 그을린 벽돌 제철소와 계단탑, 용광로 굴뚝(주인공: 화구 불빛과 불티), 저탄 탑과 컨베이어,
 *   뒤로 솟은 고로·열풍로·굴뚝 둘(위층: 붉은 경고등과 연기)
 * - 항만 창고 부두: 갠트리 크레인(주인공: A자 탑과 경고등), 칠·글씨·녹이 제각각인 컨테이너, 창고 7, 정박한 화물선, 먼 크레인들
 * - 고가 철도 밑: 철골 선로와 기둥, 타일 두른 가게 줄(튀어나온 간판·차양), 뒤 건물과 옥상 광고판, 신호탑과 전선
 * - 1구역 성벽 검문소: 50m 성벽(녹물·물때·지운 낙서·스텐실), 버팀벽과 투광등, 막사, 감시탑, 초소, 철문
 */
const OS = D.outskirts;
const kindOf = <T extends { kind: string }>(list: readonly T[], k: string): T[] => list.filter((b) => b.kind === k);

interface Lamp { x: number; y: number; z: number; range: number; color: string; power: number; flicker: number; down: boolean }

// ---------------------------------------------------------------- 그림 모음 (구간마다 한 장)
/** 칠하기 틀: 텍스처 칸 크기 w×h, 배율 sk, 면 왼쪽 아래 기준 월드 거리 → 텍스처 칸 (Y는 위가 0) */
interface Frame {
  g: CanvasRenderingContext2D;
  e: CanvasRenderingContext2D;
  w: number;
  h: number;
  sk: number;
  X: (dx: number) => number;
  Y: (dy: number) => number;
  S: (v: number) => number;
}
type Paint = (f: Frame) => void;
interface Cell { ox: number; oy: number; w: number; h: number }

function frame(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, w: number, h: number, sk: number): Frame {
  return { g, e, w, h, sk, X: (dx) => Math.round(dx * sk), Y: (dy) => h - Math.round(dy * sk), S: (v) => Math.max(1, Math.round(v * sk)) };
}

/**
 * 구간 그림 모음: 칸마다 그림을 칠해 한 장(바탕·발광)에 모으고, 상자 면을 그 칸에 붙인다.
 * 칸 둘레 2칸에는 가장자리 줄을 늘려 둔다 (벽 결 셰이더가 이웃 칸을 읽지 않게). 투명한 칸은 셰이더가 버린다 (실루엣 판).
 */
class Atlas {
  readonly map: HTMLCanvasElement;
  readonly glow: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly e: CanvasRenderingContext2D;
  private readonly geo = new Geo();
  private readonly faces: Array<{ key: string; c: Cell; f: Face; b: readonly number[] }> = [];
  private x = 0;
  private y = 0;
  private row = 0;

  constructor(readonly W: number, readonly H: number) {
    [this.map, this.g] = canvas(W, H);
    [this.glow, this.e] = canvas(W, H);
    this.e.fillStyle = '#000';
    this.e.fillRect(0, 0, W, H);
  }

  cell(w: number, h: number, sk: number, fn: Paint): Cell {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (this.x + w + 4 > this.W) {
      this.x = 0;
      this.y += this.row;
      this.row = 0;
    }
    if (this.y + h + 4 > this.H) throw new Error(`outskirts atlas full (${w}×${h})`);
    const ox = this.x + 2;
    const oy = this.y + 2;
    this.x += w + 4;
    this.row = Math.max(this.row, h + 4);
    const [mc, mg] = canvas(w, h);
    const [gc, gg] = canvas(w, h);
    gg.fillStyle = '#000';
    gg.fillRect(0, 0, w, h);
    fn(frame(mg, gg, w, h, sk));
    for (const [src, dst] of [[mc, this.g], [gc, this.e]] as const) {
      dst.imageSmoothingEnabled = false;
      dst.drawImage(src, ox, oy);
      dst.drawImage(src, 0, 0, w, 1, ox, oy - 2, w, 2);
      dst.drawImage(src, 0, h - 1, w, 1, ox, oy + h, w, 2);
      dst.drawImage(src, 0, 0, 1, h, ox - 2, oy, 2, h);
      dst.drawImage(src, w - 1, 0, 1, h, ox + w, oy, 2, h);
    }
    return { ox, oy, w, h };
  }

  /** 칸 c를 상자 면 f 하나에 붙인다 (텍스처 좌표는 다 모은 뒤 쓴 높이로 잘라서 정한다: build) */
  put(key: string, c: Cell, f: Face, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
    this.faces.push({ key, c, f, b: [x0, x1, y0, y1, z0, z1] });
  }

  private place(key: string, c: Cell, f: Face, b: readonly number[], W: number, H: number): void {
    const [x0, x1, y0, y1, z0, z1] = b;
    this.geo.box(key, x0, x1, y0, y1, z0, z1, (face, x, y, z) => {
      let s: number;
      let t: number;
      if (face === 'px') {
        s = (z1 - z) / (z1 - z0);
        t = (y - y0) / (y1 - y0);
      } else if (face === 'nx') {
        s = (z - z0) / (z1 - z0);
        t = (y - y0) / (y1 - y0);
      } else if (face === 'py' || face === 'ny') {
        s = (x - x0) / (x1 - x0);
        t = (z1 - z) / (z1 - z0);
      } else {
        s = (x - x0) / (x1 - x0);
        t = (y - y0) / (y1 - y0);
      }
      return [(c.ox + s * c.w) / W, 1 - (c.oy + (1 - t) * c.h) / H];
    }, FREE, [f]);
  }

  /** 앞면 (깊이 z): 그 깊이의 배율로 칠한다 */
  front(key: string, x0: number, x1: number, y0: number, y1: number, z: number, fn: Paint): void {
    const sk = scaleAt(z);
    this.put(key, this.cell((x1 - x0) * sk, (y1 - y0) * sk, sk, fn), 'pz', x0, x1, y0, y1, z, z);
  }

  /** 옆면 (x 자리, 깊이 z0~z1): 폭 w칸 띠 (거의 정면만 보는 카메라에서 옆면은 몇 칸 폭이라 세로 무늬만 칠한다) */
  side(key: string, f: 'px' | 'nx', x: number, y0: number, y1: number, z0: number, z1: number, w: number, fn: Paint): void {
    const sk = scaleAt(z1);
    this.put(key, this.cell(w, (y1 - y0) * sk, sk, fn), f, x, x, y0, y1, z0, z1);
  }

  build(mats: Record<string, Parameters<typeof litMaterial>[1]>): THREE.Mesh {
    // 쓴 높이만큼만 (4칸 단위) 남긴다
    const H = Math.min(this.H, Math.ceil((this.y + this.row) / 4) * 4);
    const crop = (src: HTMLCanvasElement) => {
      const [c, g] = canvas(this.W, H);
      g.drawImage(src, 0, 0);
      return c;
    };
    for (const p of this.faces) this.place(p.key, p.c, p.f, p.b, this.W, H);
    const map = pixelTexture(crop(this.map));
    const glow = pixelTexture(crop(this.glow));
    const out: Record<string, THREE.Material> = {};
    for (const [k, o] of Object.entries(mats)) out[k] = litMaterial(map, { emissive: glow, ...o });
    return this.geo.build(out);
  }
}

/**
 * 깜빡이는 붉은 경고등: 유리(빛나는 상자)와 빛이 같은 위상으로 켜지고 꺼진다. 위상 둘(번갈아), 위상마다 재질 하나.
 */
class Beacons {
  private readonly geo = [new Geo(), new Geo()];
  readonly mats = [beaconMaterial(), beaconMaterial()];
  readonly list: Array<{ x: number; y: number; z: number; range: number; power: number; p: number }> = [];

  add(x: number, y: number, z: number, p: number, size = 4, range = 60, power = 0.8): void {
    const k = p % 2;
    const h = size / 2;
    this.geo[k].box('b', x - h, x + h, y - h, y + h, z - h, z + h, null, FREE, ['pz', 'py', 'px', 'nx']);
    this.list.push({ x, y, z: z + 6, range, power, p: k });
  }

  /** 이 틱에 위상 p가 켜졌는가 */
  static on(tick: number, p: number): boolean {
    return ((tick >> 5) + p) % 2 === 0;
  }

  build(): THREE.Mesh[] {
    return this.geo.filter((g) => !g.empty).map((g) => g.build({ b: this.mats[this.geo.indexOf(g)] }));
  }
}

/** 깜빡이는 붉은 경고등 유리 */
function beaconMaterial(): THREE.ShaderMaterial {
  const t = pixelTexture(solidTex(C.neonRed));
  return litMaterial(t, { emissive: t, emissiveStrength: 3 });
}

/** 빛나는 단색 유리 (투광등·쇳물·초소 창·신호등): 같은 재질끼리 한 기하 */
class Glows {
  private readonly geo = new Geo();
  private readonly mats: Record<string, THREE.Material> = {};

  add(key: string, color: string, glow: string, k: number, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
    this.mats[key] ??= litMaterial(pixelTexture(solidTex(color)), { emissive: pixelTexture(solidTex(glow)), emissiveStrength: k });
    this.geo.box(key, x0, x1, y0, y1, z0, z1, null, FREE, ['pz', 'py', 'px', 'nx']);
  }

  build(): THREE.Mesh {
    return this.geo.build(this.mats);
  }
}

// ---------------------------------------------------------------- 무대 배치 (렌더 전용)
/** 제철소 뒤 건물: 서쪽 끝 x, 동쪽 끝 x, 처마 높이, 톱니 지붕 꼭대기, 깊이 */
const MILL = { x0: MAP_ENDS.left, x1: 800, eave: 206, h: 238, z: -120 };
/** 제철소 벽기둥 (월드 x, 폭 8): 칸마다 폭이 조금씩 다르다 (같은 창을 같은 간격으로 잇지 않게) */
const MILL_PIERS = [60, 118, 176, 246, 312, 380, 446, 520, 588, 652, 712, 748] as const;
/** 칸마다 창 상태: hot 용광로 빛, dim 어둑한 붉은빛, dark 깨진 검은 창, door 큰 철문 */
const MILL_BAYS: ReadonlyArray<'hot' | 'dim' | 'dark' | 'door'> = ['dim', 'hot', 'dim', 'hot', 'dark', 'dim', 'door', 'dim', 'dim', 'dark', 'dim'];
/** 제철소 간판 (주인공은 용광로: 한 단계 낮게 켠 관 글씨). 화면 CAM 460 안에 다 들고, 저탄 탑에 가리지 않는 자리 */
const MILL_SIGN = { text: 'CITADEL STEEL', x: 500, y: 176, s: 2 };

/** 1구역 성벽 (렌더 전용, 높이 50m ≈ 1,500px: 상자는 화면에 보이는 높이 h까지만). 앞면 깊이, 서쪽 보루, 철문, 버팀벽, 막사 */
const WALL = {
  x0: 5560, z: -190, h: 640, gate: [6168, 6330] as const, buttress: [5644, 5960, 6118] as const, barracks: [5600, 5860] as const,
  /** 벽면에 매단 감시 초소 (가운데 x, 바닥 높이) */
  posts: [{ x: 5772, y: 352, w: 64 }, { x: 6226, y: 404, w: 56 }],
  searchlights: [{ x: 5790, y: 404, phase: 0, sweep: 0.42 }, { x: 6240, y: 448, phase: 2.6, sweep: 0.38 }],
  catwalk: 300,
  /** 벽면 그림이 덮는 x (보루 뒤에서 동쪽 끝 모서리 너머까지: 화면에 보이는 곳만) */
  face: [5470, 6430] as const,
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

export class Outskirts {
  readonly group = new THREE.Group();
  /** 빛 후보 (자리·색·세기·깜빡임 씨앗) */
  private readonly lamps: Lamp[] = [];
  private readonly beacons = new Beacons();
  private readonly glows = new Glows();
  private train!: THREE.Mesh;
  private trainMats: THREE.ShaderMaterial[] = [];
  private readonly sparks = new Sparks(48);
  /** 용광로 화구 (가운데 x, 굴뚝 꼭대기 높이): 불씨와 굴뚝 연기 */
  private readonly furnaces: Array<{ x: number; top: number }> = [];
  private readonly embers = new Sparks(90);
  private readonly smoke = new Puffs(72, '#2e2a2e', '#242024', 5, 0.42);
  /** 연기 나는 굴뚝 꼭대기 (x, 높이, 깊이, 크기 배수) */
  private readonly flues: Array<{ x: number; top: number; z: number; k: number }> = [];
  /** 성벽 투광등이 벽면을 쓸어 올리는 옅은 빛줄기 (품질 낮음이면 숨긴다) */
  private readonly washes: Beam[] = [];
  /** 서치라이트: 빛줄기, 받침 자리, 위상, 훑는 폭(라디안) */
  private readonly searchlights: Array<{ beam: Beam; x: number; y: number; phase: number; sweep: number }> = [];

  constructor() {
    const det = new Details();
    this.factory(det);
    this.docks(det);
    this.elrail(det);
    this.wall(det);
    this.group.add(det.build(), this.glows.build(), ...this.beacons.build(), this.embers.mesh, this.smoke.mesh, this.sparks.mesh);
  }

  private lamp(x: number, y: number, z: number, range: number, color: string, power: number, flicker = 0, down = false): void {
    this.lamps.push({ x, y, z, range, color, power, flicker, down });
  }

  // ---------------------------------------------------------------- 공장 지대
  private factory(det: Details): void {
    const A = new Atlas(1024, 1024);
    const L = MAP_ENDS.left;
    // 뒤로 솟은 제철 설비 (위층의 실루엣: 굴뚝 둘, 고로, 열풍로, 컨베이어). 붉은 하늘을 등진 어두운 실루엣, 아래쪽은 화구 빛을 받는다
    A.front('sil', 88, 120, 0, 506, -420, paintBrickChimney);
    A.front('sil', 546, 584, 0, 458, -340, paintSteelChimney);
    A.front('sil', 240, 324, 0, 340, -360, paintStoves);
    A.front('sil', 300, 480, 0, 480, -300, paintBlastFurnace);
    A.front('sil', 392, 708, 176, 400, -210, paintConveyor);
    this.flues.push({ x: 104, top: 506, z: -410, k: 1.2 }, { x: 565, top: 458, z: -330, k: 1 });
    this.beacons.add(104, 478, -416, 0, 4, 70, 0.7);
    this.beacons.add(565, 440, -336, 1, 4, 70, 0.7);
    this.beacons.add(346, 470, -296, 1, 3, 50, 0.6);
    // 고로 꼭대기 방산관 불꽃 (가스가 타는 작은 불): 위층 하늘에 주황 빛점
    this.lamp(384, 472, -280, 120, C.fxOrange, 0.9, 3);
    this.lamp(365, 404, -270, 110, C.windowLight, 0.6);
    // 서쪽 끝 공장 (맵 끝 벽): 앞면과 용광로 쪽을 보는 옆면
    A.front('brick', -8, L, 0, 460, 6, paintEndWall);
    A.side('brick', 'px', L, 0, 460, -320, 6, 18, paintEndSide);
    // 제철소 몸통
    A.front('brick', MILL.x0, MILL.x1, 0, MILL.h, MILL.z, paintMillFront);
    registerSign(MILL_SIGN.text, '제철소 간판', MILL_SIGN.x, MILL_SIGN.x + textWidth(MILL_SIGN.text, MILL_SIGN.s) / scaleAt(MILL.z),
      MILL_SIGN.y, MILL_SIGN.y + (5 * MILL_SIGN.s) / scaleAt(MILL.z), MILL.z, textWidth(MILL_SIGN.text, MILL_SIGN.s) / scaleAt(MILL.z),
      (textWidth(MILL_SIGN.text, MILL_SIGN.s) + 12) / scaleAt(MILL.z));
    this.lamp(MILL_SIGN.x + 52, MILL_SIGN.y + 4, MILL.z + 24, 110, C.neonAmber, 0.75);
    // 벽기둥 (벽에서 튀어나온 벽돌 기둥: 앞면, 빛 받는 돌 갓), 처마 띠, 가로 배관 둘 (받침 쇠)
    for (const p of MILL_PIERS) {
      det.add(p, p + 8, 0, MILL.eave, MILL.z, MILL.z + 6, '#3b3539');
      det.add(p - 1, p + 9, MILL.eave - 3, MILL.eave, MILL.z, MILL.z + 7, '#5d5550');
    }
    det.add(MILL.x0, MILL.x1, MILL.eave, MILL.eave + 3, MILL.z, MILL.z + 4, '#2c282c');
    for (const [py, d] of [[44, 10], [192, 9]] as const) {
      det.add(MILL.x0, 748, py, py + 4, MILL.z + d, MILL.z + d + 4, '#3f3a40');
      det.add(MILL.x0, 748, py + 3.4, py + 4, MILL.z + d, MILL.z + d + 4, '#6a5f5c');
      for (let x = MILL.x0 + 14, k = 0; x < 740; x += 52 + (k % 3) * 9, k++) det.add(x, x + 3, py - 3, py + 5, MILL.z + 6, MILL.z + d + 2, '#2c282c');
    }
    // 창 빛이 길로 번진다 (용광로 빛이 가장 밝은 창 둘: 굴뚝 양옆)
    for (const x of [148, 280]) this.lamp(x, 104, MILL.z + 30, 160, C.fxOrange, 0.8, 7);
    // 동쪽 끝: 처마 위로 솟은 계단탑과 낮은 펌프실 (제철소 몸통이 자로 자른 듯 끝나지 않게)
    A.front('brick', 748, 802, 0, 272, -106, paintStairTower);
    A.side('brick', 'px', 802, 0, 272, -134, -106, 3, (f) => sideStrip(f, '#4a4246', '#5a5054', true));
    det.add(746, 804, 268, 272, -136, -104, '#5d5550');
    det.add(752, 798, 272, 274, -132, -108, '#2c282c');
    this.lamp(775, 40, -80, 90, C.sodium, 0.7, 0, true);
    A.front('steel', 806, 866, 0, 84, -58, paintPumpHouse);
    A.side('steel', 'nx', 806, 0, 84, -96, -58, 2, (f) => sideStrip(f, '#3e3a36', '#4c4640'));
    det.add(803, 869, 84, 87, -98, -55, '#4a4440');
    this.lamp(846, 70, -40, 70, C.sodium, 0.6, 0, true);
    // 용광로 굴뚝 (주인공): 아래는 내화 벽돌, 위는 리벳 강판 통. 둘레 쇠띠(튀어나온 고리), 꼭대기 테
    for (const s of kindOf(OS.blocks, 'stack')) {
      A.front('stack', s.x0, s.x1, 0, s.h, -4, paintStack);
      A.side('stack', 'px', s.x1, 0, s.h, -40, -4, 3, (f) => sideStrip(f, '#4a4650', '#615c66', true));
      A.side('stack', 'nx', s.x0, 0, s.h, -40, -4, 3, (f) => sideStrip(f, '#4a4650', '#615c66', true));
      det.add(s.x0, s.x1, s.h - 0.6, s.h, -40, -4, '#7a7470');
      for (const by of [112, 196, 246]) {
        det.add(s.x0 - 2, s.x1 + 2, by, by + 3, -42, -2, '#3c3840');
        det.add(s.x0 - 2, s.x1 + 2, by + 2.4, by + 3, -42, -2, '#6c6670');
      }
      det.add(s.x0 - 3, s.x1 + 3, s.h - 6, s.h, -43, -1, '#2e2a30');
      det.add(s.x0 - 3, s.x1 + 3, s.h - 0.6, s.h, -43, -1, '#7a7470');
      // 꼭대기 불빛 (용광로 가스 불꽃)
      this.lamp((s.x0 + s.x1) / 2, s.h + 8, -20, 120, C.fxOrange, 1.1, 3);
      // 밑동 아치 화구: 쇳물 빛이 이글거린다 (구간의 주인공 빛). 뒤 제철소 벽도 같이 숨 쉬듯 밝아졌다 어두워진다
      const cx = (s.x0 + s.x1) / 2;
      this.lamp(cx, 22, 10, 230, C.fxOrange, 1.9, 7);
      this.lamp(cx + 30, 60, -80, 170, C.fxOrange, 1.0, 7);
      // 쇳물 도랑: 화구에서 오른쪽 국자로 흐르는 빛나는 쇳물, 국자(쇠 통)와 달아오른 테두리
      det.add(cx - 3, cx + 46, 0, 1, -16, -8, C.iron);
      this.glows.add('lava', '#ffc16e', '#ff9070', 1.6, cx - 2, cx + 45, 1, 2, -14, -10);
      det.add(cx + 44, cx + 64, 0, 13, -18, -6, '#3a3036');
      det.add(cx + 43, cx + 65, 12, 14, -19, -5, '#6a4a3a');
      this.glows.add('lava', '#ffc16e', '#ff9070', 1.6, cx + 46, cx + 62, 13, 14.5, -16, -8);
      this.lamp(cx + 54, 20, -2, 80, C.fxYellow, 0.7, 7);
      this.furnaces.push({ x: cx, top: s.h });
      this.flues.push({ x: cx - 8, top: s.h + 6, z: -22, k: 1 });
    }
    for (const r of kindOf(OS.decks, 'ring')) {
      det.add(r.x0, r.x1, r.h - 4, r.h, -48, -2, '#2e2a30');
      det.add(r.x0, r.x1, r.h - 0.6, r.h, -48, -2, '#6c6670');
      rail(det, r.x0, r.x1, r.h, -3);
      for (const x of [r.x0 + 4, r.x1 - 6]) det.bar(x, r.h - 4, x + (x < (r.x0 + r.x1) / 2 ? 18 : -18), r.h - 30, 2, -30, -28, C.iron);
    }
    // 철제 통로 (기둥 둘), 난간, 아래 매달린 전등 (간격 제각각, 하나는 꺼짐)
    for (const c of kindOf(OS.decks, 'catwalk')) {
      det.add(c.x0, c.x1, c.h - 4, c.h, -36, -4, '#2e2a30');
      det.add(c.x0, c.x1, c.h - 0.6, c.h, -36, -4, '#6c6670');
      rail(det, c.x0, c.x1, c.h, -5);
      [[44, true], [132, true], [196, false]].forEach(([dx, on]) => {
        const x = c.x0 + (dx as number);
        det.add(x, x + 6, c.h - 10, c.h - 4, -12, -8, C.chromeDark);
        if (on) {
          this.glows.add('flood', '#ffe2a8', '#ffc16e', 1.4, x + 1, x + 5, c.h - 11, c.h - 10, -11.5, -8.5);
          this.lamp(x + 3, c.h - 10, -6, 110, C.sodium, 1.2, 0, true);
        }
      });
    }
    for (const p of kindOf(OS.posts, 'catwalkLeg')) {
      det.add(p.x, p.x + p.w, p.h0, p.h, -24, -16, '#2e2a30');
      det.add(p.x, p.x + 1.5, p.h0, p.h, -16, -15.6, '#4e4850');
      det.bar(p.x + p.w / 2, 10, p.x + p.w / 2 + (p.x < 400 ? 30 : -30), p.h - 20, 2, -22, -20, C.iron);
    }
    // 저탄 탑: 리벳 강판 몸통(녹·글씨), 아래 깔때기와 다리, 꼭대기 작업등
    for (const h of kindOf(OS.blocks, 'hopper')) {
      A.front('steel', h.x0, h.x1, 40, h.h, -4, paintHopper);
      A.side('steel', 'px', h.x1, 40, h.h, -50, -4, 3, (f) => sideStrip(f, '#5c4a3e', '#6c5848', true));
      A.side('steel', 'nx', h.x0, 40, h.h, -50, -4, 3, (f) => sideStrip(f, '#5c4a3e', '#6c5848', true));
      det.add(h.x0, h.x1, h.h - 0.6, h.h, -50, -4, '#6c6058');
      det.add(h.x0 + 18, h.x1 - 18, 14, 40, -40, -12, '#2e2a30');
      det.add(h.x0 + 34, h.x1 - 34, 4, 14, -36, -16, '#2e2a30');
      for (const x of [h.x0 + 4, h.x1 - 10]) {
        det.add(x, x + 6, 0, 40, -48, -6, '#2e2a30');
        det.add(x, x + 1.5, 0, 40, -6, -5.6, '#4e4850');
      }
      rail(det, h.x0, h.x1, h.h, -5);
      det.add(h.x1 - 14, h.x1 - 12, h.h, h.h + 18, -8, -6, C.iron);
      det.add(h.x1 - 18, h.x1 - 8, h.h + 16, h.h + 19, -12, -4, C.chromeDark);
      this.glows.add('flood', '#ffe2a8', '#ffc16e', 1.4, h.x1 - 17, h.x1 - 9, h.h + 15.4, h.h + 16, -11, -5);
      this.lamp(h.x1 - 13, h.h + 14, 0, 140, C.sodium, 0.9, 0, true);
    }
    this.group.add(A.build({
      brick: { emissiveStrength: 1.15, bump: 0.7, wet: 0.3 },
      stack: { emissiveStrength: 1.1, bump: 0.6, wet: 0.45 },
      steel: { emissiveStrength: 1.1, bump: 0.5, wet: 0.5 },
      sil: { emissiveStrength: 1.2, bump: 0, wet: 0.3 },
    }));
  }

  // ---------------------------------------------------------------- 항만 창고 부두
  private docks(det: Details): void {
    const A = new Atlas(1024, 1024);
    // 먼 크레인 둘 (바다 쪽으로 줄지은 부두 크레인: 해 질 녘 하늘을 등진 실루엣, 꼭대기 경고등)
    A.front('sil', 1150, 1340, 0, 452, -600, (f) => paintFarCrane(f, 3));
    A.front('sil', 1380, 1540, 0, 430, -640, (f) => paintFarCrane(f, 7));
    this.beacons.add(1237, 424, -598, 1, 3, 60, 0.5);
    this.beacons.add(1468, 426, -638, 0, 3, 60, 0.45);
    // 정박한 화물선: 검은 선체, 붉은 흘수선, 갑판 컨테이너, 하역 기둥, 선미 선교와 굴뚝, 무선 돛대 (위층까지)
    A.front('sil', 1004, 1336, -6, 262, -380, paintShip);
    // 갠트리 크레인 (구간 주인공): 다리 둘(보강판·사다리), 들보(윗면이 발판), A자 탑과 기계실, 꼭대기 경고등
    for (const p of kindOf(OS.posts, 'craneLeg')) {
      A.front('steel', p.x, p.x + p.w, p.h0, p.h, -18, (f) => paintCraneLeg(f, p.x < 1000));
      A.side('steel', 'px', p.x + p.w, p.h0, p.h, -32, -18, 2, (f) => sideStrip(f, '#6a5634', '#8a7044', true));
      A.side('steel', 'nx', p.x, p.h0, p.h, -32, -18, 2, (f) => sideStrip(f, '#6a5634', '#8a7044', true));
      det.add(p.x - 6, p.x + p.w + 6, 0, 12, -38, -12, '#3a3226');
      det.add(p.x - 6, p.x + p.w + 6, 11.4, 12, -38, -12, '#7a6a50');
      for (const wx of [p.x - 2, p.x + p.w - 4]) det.add(wx, wx + 6, 0, 6, -12, -11, '#23201e');
      det.bar(p.x + p.w / 2, 20, p.x + p.w / 2 + (p.x < 1000 ? 40 : -40), 110, 3, -27, -23, '#6a5634');
    }
    det.add(860, 1130, 0, 1, -40, -10, '#4a4640');
    for (const b of kindOf(OS.decks, 'crane')) {
      A.front('steel', b.x0, b.x1, b.h - 14, b.h, -14, paintCraneBeam);
      det.add(b.x0, b.x1, b.h - 0.6, b.h, -36, -14, '#a08a5c');
      det.add(b.x0, b.x1, b.h - 14, b.h - 0.6, -36, -14.4, '#4e4030');
      A.front('sil', b.x0, b.x1, b.h, 428, -30, paintCraneTop);
      // 기계실 창 불빛 (운전수)
      this.lamp(b.x0 + 96, b.h + 16, -14, 90, C.windowLight, 0.7);
      // A자 탑 꼭대기와 들보 양 끝 항공 경고등 (같은 위상으로 깜빡인다)
      this.beacons.add(b.x0 + 115, 424, -28, 0, 4, 70, 0.8);
      this.beacons.add(b.x0 + 4, b.h + 2, -26, 1, 4, 60, 0.7);
      this.beacons.add(b.x1 - 4, b.h + 2, -26, 1, 4, 60, 0.7);
      // 들보 밑 투광등 둘: 컨테이너 더미 쪽으로 내리쬐는 나트륨 빛 (빛줄기와 바닥 웅덩이)
      for (const x of [b.x0 + 40, b.x0 + 190]) {
        det.add(x - 6, x + 6, b.h - 20, b.h - 14, -30, -22, C.iron);
        this.glows.add('flood', '#ffe2a8', '#ffc16e', 1.5, x - 4, x + 4, b.h - 21.5, b.h - 20, -28, -24);
        const f = new Beam(b.h - 16, 34, C.sodium, 0.12, 2);
        f.pivot.position.set(x, b.h - 20, -26);
        f.aim(Math.PI + (x < (b.x0 + b.x1) / 2 ? -0.12 : 0.12));
        this.group.add(f.pivot);
        this.lamp(x, b.h - 22, -20, 230, C.sodium, 1.2, 0, true);
      }
      // 트롤리에서 늘어진 줄과 갈고리
      det.add(b.x0 + 150, b.x0 + 151, b.h - 92, b.h - 14, -26, -25, C.iron);
      det.add(b.x0 + 157, b.x0 + 158, b.h - 92, b.h - 14, -26, -25, C.iron);
      det.add(b.x0 + 144, b.x0 + 164, b.h - 100, b.h - 92, -28, -22, '#6a5634');
      det.add(b.x0 + 144, b.x0 + 164, b.h - 92.6, b.h - 92, -28, -22, '#a08a5c');
    }
    for (const b of kindOf(OS.decks, 'craneLow')) {
      A.front('steel', b.x0, b.x1, b.h - 7, b.h, -20, (f) => paintGirder(f, '#6a5634', '#a08a5c', '#4e4030', 3));
      det.add(b.x0, b.x1, b.h - 0.6, b.h, -30, -20, '#a08a5c');
    }
    // 컨테이너 2단·3단: 칠·녹·글씨·찌그러짐이 제각각 (같은 이름이 한 화면에 두 번 나오지 않게)
    let k = 0;
    for (const b of [...kindOf(OS.blocks, 'crate2'), ...kindOf(OS.blocks, 'crate3')]) {
      const rows = Math.round(b.h / 28);
      for (let r = 0; r < rows; r++) {
        const c = CONTAINERS[k++ % CONTAINERS.length];
        const y0 = r * 28;
        A.front('box', b.x0, b.x1, y0, y0 + 28, -0.6, (f) => paintContainerSide(f, c));
        A.side('box', 'px', b.x1, y0, y0 + 28, -90, -0.6, 10, (f) => paintContainerEnd(f, c, true));
        A.side('box', 'nx', b.x0, y0, y0 + 28, -90, -0.6, 10, (f) => paintContainerEnd(f, c, false));
        det.add(b.x0, b.x1, y0 + 27.4, y0 + 28, -90, -0.6, tone(c.paint, 1.25));
      }
    }
    // 부두 투광 기둥 (높은 기둥 위 등 셋): 컨테이너 더미와 창고 앞을 위에서 비춘다 (위층에도 보이는 빛)
    det.add(1309, 1313, 0, 336, -104, -100, '#2e2c30');
    det.add(1309, 1310, 0, 336, -100, -99.6, '#5a5650');
    det.add(1298, 1324, 336, 340, -108, -96, '#2e2c30');
    for (const x of [1300, 1309, 1318]) this.glows.add('flood', '#ffe2a8', '#ffc16e', 1.6, x, x + 5, 333, 336, -106, -98);
    this.lamp(1311, 330, -60, 320, C.sodium, 1.6, 0, true);
    this.beacons.add(1311, 344, -102, 0, 3, 50, 0.5);
    // 하역장 (콘크리트 턱, 고무 방현재, 계선주)과 차양
    for (const b of kindOf(OS.blocks, 'dock')) {
      A.front('concrete', b.x0, b.x1, 0, b.h, -2, paintDockFace);
      det.add(b.x0, b.x1, b.h - 0.6, b.h, -70, -2, '#6a645a');
      for (const x of [b.x0 + 22, b.x0 + 104, b.x1 - 30]) {
        det.add(x, x + 8, b.h, b.h + 6, -10, -4, '#2a2826');
        det.add(x - 1, x + 9, b.h + 6, b.h + 8, -11, -3, '#3a3634');
        det.add(x - 1, x + 9, b.h + 7.4, b.h + 8, -11, -3, '#6a645e');
      }
    }
    // 하역장 위 나무 팔레트 더미와 그물 덮은 상자 (항만의 나무 냄새)
    for (const [px0, n] of [[1386, 3], [1528, 2]] as const) {
      for (let i = 0; i < n; i++) {
        det.add(px0, px0 + 22, 40 + i * 4, 43 + i * 4, -40, -20, '#5a4632');
        det.add(px0, px0 + 22, 42.4 + i * 4, 43 + i * 4, -40, -20, '#86684a');
      }
    }
    for (const a of kindOf(OS.decks, 'dockAwning')) {
      // 하역장 차양: 윗판(빛 받음), 앞 테, 아랫면(어두운 면), 창고 벽에 드리운 그림자 면
      det.add(a.x0, a.x1, a.h - 4, a.h, -72, -6, '#4a4844');
      det.add(a.x0, a.x1, a.h - 0.6, a.h, -72, -6, '#8a8478');
      det.add(a.x0, a.x1, a.h - 6, a.h - 4, -72, -6, '#1c1b1e');
      det.add(a.x0 + 2, a.x1 + 4, a.h - 18, a.h - 6, -71.7, -71.3, '#0f1014');
      for (const x of [a.x0 + 4, a.x1 - 8]) det.bar(x, a.h - 4, x + (x < (a.x0 + a.x1) / 2 ? 20 : -20), a.h - 34, 2, -40, -38, C.iron);
    }
    // 창고 7: 골함석 상자, 처마 테와 낙수관, 셔터 말림 통, 지붕 위 물탱크와 무선 기둥
    const WX = 1336;
    A.front('steel', WX, 1596, 0, 200, -72, paintWarehouse);
    registerSign('WAREHOUSE 7', '창고 페인트 글씨', WH_SIGN.x, WH_SIGN.x + textWidth('WAREHOUSE 7', 4) / scaleAt(-72), WH_SIGN.y,
      WH_SIGN.y + 20 / scaleAt(-72), -72, textWidth('WAREHOUSE 7', 4) / scaleAt(-72), (textWidth('WAREHOUSE 7', 4) + 8) / scaleAt(-72));
    det.add(WX - 2, 1598, 198, 204, -78, -68, '#3e4446');
    det.add(WX - 2, 1598, 203.4, 204, -78, -68, '#8a9290');
    det.add(WX - 2, 1598, 196, 198, -76, -70, '#1c1e22');
    for (const x of [WX + 2, 1590]) {
      det.add(x, x + 3, 0, 198, -71, -68, '#3a3e40');
      det.add(x, x + 1, 0, 198, -68, -67.6, '#6a7270');
    }
    for (const [sx, open] of [[30, 46], [140, 0]] as const) {
      const x0 = WX + sx - 4;
      const x1 = WX + sx + 84;
      det.add(x0, x1, 100, 108, -72, -64, '#34383a');
      det.add(x0, x1, 107.4, 108, -72, -64, '#7a8280');
      det.add(x0 + 2, x1 + 2, 95, 100, -71.7, -71.3, '#0f1014');
      for (const gx of [x0, x1 - 3]) {
        det.add(gx, gx + 3, 0, 100, -72, -69, '#2a2c30');
        det.add(gx, gx + 1, 0, 100, -69, -68.6, '#5a6260');
      }
      if (open) {
        det.add(WX + sx, WX + sx + 80, open, open + 3, -72, -69, '#2a2c30');
        det.add(WX + sx, WX + sx + 80, open + 2.4, open + 3, -72, -69, '#7a8280');
      }
    }
    this.lamp(1406, 40, -40, 150, C.sodium, 1.1);
    for (const x of [1406, 1516]) this.lamp(x, 112, -50, 110, C.sodium, 0.9, 0, true);
    A.front('sil', 1494, 1564, 200, 304, -112, paintWaterTower);
    det.add(1580, 1582, 204, 372, -96, -94, '#2e2c30');
    for (let y = 214; y < 366; y += 22) det.bar(1572, y, 1590, y + 20, 1, -96, -95, '#2e2c30');
    this.beacons.add(1581, 374, -95, 1, 3, 50, 0.5);
    this.group.add(A.build({
      steel: { emissiveStrength: 1.15, bump: 0.5, wet: 0.6 },
      box: { emissiveStrength: 1, bump: 0.4, wet: 0.6 },
      concrete: { emissiveStrength: 1, bump: 0.6, wet: 0.5 },
      sil: { emissiveStrength: 1.3, bump: 0, wet: 0.4 },
    }));
  }

  // ---------------------------------------------------------------- 고가 철도 밑
  private elrail(det: Details): void {
    const A = new Atlas(1024, 1024);
    // 뒤 건물 둘 (선로 위로 보이는 위층: 켜진 창 몇, 비상계단, 옥상 물탱크와 광고판)
    A.front('sil', 4846, 4994, 0, 410, -300, paintOfficeTower);
    A.front('brick', 5062, 5252, 0, 392, -240, paintTenement);
    A.front('sil', 5084, 5236, 392, 462, -238, paintBillboard);
    registerSign(BILLBOARD.text, '고가철도 옥상 광고판', BILLBOARD.x, BILLBOARD.x + textWidth(BILLBOARD.text, 2) / scaleAt(-238), BILLBOARD.y,
      BILLBOARD.y + 10 / scaleAt(-238), -238, textWidth(BILLBOARD.text, 2) / scaleAt(-238), 120 / scaleAt(-238));
    for (const x of [5118, 5202]) {
      this.glows.add('flood', '#ffe2a8', '#ffc16e', 1.4, x - 3, x + 3, 398, 400, -224, -218);
      this.lamp(x, 402, -200, 110, '#ffe2a8', 0.75);
    }
    this.beacons.add(5244, 470, -236, 0, 3, 50, 0.5);
    this.beacons.add(4920, 476, -296, 1, 3, 50, 0.5);
    // 뒤 건물 비상계단 (벽에서 튀어나온 쇠 발판과 계단: 윗면이 빛을 받는다)
    for (let fy = 96, i = 0; fy < 380; fy += 84, i++) {
      det.add(5074, 5124, fy, fy + 2, -240, -226, '#262a2a');
      det.add(5074, 5124, fy + 1.4, fy + 2, -240, -226, '#5a6260');
      det.add(5074, 5124, fy + 10, fy + 11, -227, -226, '#262a2a');
      det.bar(i % 2 ? 5080 : 5118, fy + 2, i % 2 ? 5118 : 5080, fy + 84, 2, -232, -230, '#262a2a');
    }
    // 선로 아래 가게들: 타일 두른 가게 앞면, 튀어나온 간판 상자와 차양, 벽돌 기둥
    A.front('brick', SHOPS_X0, SHOPS_X0 + SHOPS_W, 0, 170, -70, paintUnderShops);
    this.shopSigns(A, det);
    // 가게 줄 양 끝 모서리 (벽돌 모퉁이 기둥과 낙수관: 판이 자로 자른 듯 끝나지 않게)
    for (const [cx0, cx1] of [[SHOPS_X0 - 8, SHOPS_X0 + 4], [SHOPS_X0 + SHOPS_W - 4, SHOPS_X0 + SHOPS_W + 8]] as const) {
      det.add(cx0, cx1, 0, 166, -84, -62, '#4a3430');
      det.add(cx0, cx1, 164, 168, -86, -60, '#6a625c');
      det.add(cx0 + (cx0 < SHOPS_X0 ? 1 : 8), cx0 + (cx0 < SHOPS_X0 ? 3 : 10), 0, 166, -62, -60, '#2e3434');
    }
    // 쇼윈도 불빛이 젖은 길로 쏟아진다 (가게마다 실내 색)
    UNDER_SHOPS.forEach((u, i) => {
      const F = SHOP_FORM[u.key];
      const x = SHOPS_X0 + SHOP_X[i] + (F.doorLeft ? 34 : 4) + F.win / 2;
      this.lamp(x, 30, -40, 90, u.light, u.key === 'jazz' ? 0.9 : 0.55);
    });
    // 고가 열차 (선로 위를 오가며, 창 불빛과 바퀴 불꽃, 선로 밑으로 새는 빛)
    const track = kindOf(OS.decks, 'rail')[0];
    this.trainMats = [1, -1].map((dir) => {
      const t = paintElTrain(dir);
      return litMaterial(pixelTexture(t.map), { emissive: pixelTexture(t.glow), emissiveStrength: 1, clip: [track.x0 - 60, track.x1 + 60], side: THREE.DoubleSide });
    });
    this.train = plane(0, TRAIN.length, 0, TRAIN.height, 0, this.trainMats[0]);
    this.train.visible = false;
    this.group.add(this.train);
    // 선로 바닥: 리벳 판 거더 (윗 테가 빛을 받는다), 위에 침목과 레일
    for (const d of kindOf(OS.decks, 'rail')) {
      A.front('steel', d.x0 - 60, d.x1 + 60, d.h - 14, d.h, -2, (f) => paintGirder(f, '#2c3834', '#5a6c64', '#1c2420', 2));
      det.add(d.x0 - 60, d.x1 + 60, d.h - 0.6, d.h, -64, -2, '#5a6c64');
      for (let x = d.x0 - 60, k = 0; x < d.x1 + 60; x += 7, k++) det.add(x, x + 4, d.h, d.h + 2, -60, -6, k % 9 === 4 ? '#3a3430' : '#4a3a33');
      det.add(d.x0 - 60, d.x1 + 60, d.h + 2, d.h + 4, -50, -46, C.chromeDark);
      det.add(d.x0 - 60, d.x1 + 60, d.h + 2, d.h + 4, -20, -16, C.chromeDark);
      // 상판 아래 형광등: 간격 제각각, 하나는 나갔고 하나는 깜빡인다
      [[54, 'on'], [232, 'flicker'], [372, 'dead'], [566, 'on']].forEach(([dx, state]) => {
        const x = d.x0 + (dx as number);
        det.add(x - 10, x + 10, d.h - 17, d.h - 14, -20, -14, C.iron);
        if (state !== 'dead') {
          this.glows.add('fluo', '#e8fff8', '#9effd8', 1.3, x - 9, x + 9, d.h - 17.6, d.h - 17, -19, -15);
          this.lamp(x, d.h - 18, -10, 160, '#9effd8', 1.3, state === 'flicker' ? 5 : 0, true);
        }
      });
      rail(det, d.x0 - 60, d.x1 + 60, d.h + 4, -3);
    }
    const floorShadow = decalMaterial(pixelTexture(paintPillarShadow(48, 30)), 0.15);
    const shadowGeo = new Geo();
    for (const p of kindOf(OS.posts, 'railLeg')) {
      A.front('steel', p.x, p.x + p.w, p.h0, p.h - 14, -24, paintRailLeg);
      A.side('steel', 'px', p.x + p.w, p.h0, p.h - 14, -40, -24, 2, (f) => sideStrip(f, '#26302c', '#3e4a44', true));
      A.side('steel', 'nx', p.x, p.h0, p.h - 14, -40, -24, 2, (f) => sideStrip(f, '#26302c', '#3e4a44', true));
      det.add(p.x - 4, p.x + p.w + 4, 0, 6, -44, -20, '#3a403c');
      det.add(p.x - 4, p.x + p.w + 4, 5.4, 6, -44, -20, '#6a7470');
      // 기둥 그림자: 뒤 가게 벽에 드리운 세로 면은 가게 앞면 그림에 칠했다 (따로 세운 얇은 판은 기둥 옆에 1칸 검은 줄로 남는다).
      // 바닥에 앞으로 뻗은 짙은 자국
      shadowGeo.quad('s', [[p.x - 18, 0.3, -3], [p.x + p.w + 18, 0.3, -3], [p.x + p.w + 18, 0.3, -33], [p.x - 18, 0.3, -33]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]]);
      det.bar(p.x + p.w, p.h - 40, p.x + p.w + 30, p.h - 14, 3, -34, -30, '#26302c');
      det.bar(p.x, p.h - 40, p.x - 30, p.h - 14, 3, -34, -30, '#26302c');
    }
    this.group.add(shadowGeo.build({ s: floorShadow }));
    this.signalTowers(det);
    // 역 계단참과 계단 (계단참에서 선로까지)
    for (const s of kindOf(OS.decks, 'stairs')) {
      det.add(s.x0, s.x1, s.h - 4, s.h, -44, -10, '#2a3230');
      det.add(s.x0, s.x1, s.h - 0.6, s.h, -44, -10, '#6a7470');
      rail(det, s.x0, s.x1, s.h, -11);
      for (let i = 0; i < 9; i++) {
        det.add(s.x1 + i * 6, s.x1 + i * 6 + 6, s.h + i * 9, s.h + i * 9 + 2, -40, -14, '#2a3230');
        det.add(s.x1 + i * 6, s.x1 + i * 6 + 6, s.h + i * 9 + 1.4, s.h + i * 9 + 2, -40, -14, '#5a6460');
      }
      for (let i = 0; i < 9; i++) {
        det.add(s.x0 - i * 6 - 6, s.x0 - i * 6, s.h - i * 10 - 2, s.h - i * 10, -40, -14, '#2a3230');
        det.add(s.x0 - i * 6 - 6, s.x0 - i * 6, s.h - i * 10 - 0.6, s.h - i * 10, -40, -14, '#5a6460');
      }
      det.add(s.x0 + 4, s.x0 + 8, 0, s.h, -30, -26, '#2a3230');
      det.add(s.x1 - 8, s.x1 - 4, 0, s.h, -30, -26, '#2a3230');
    }
    this.group.add(A.build({
      brick: { emissiveStrength: 1.1, bump: 0.6, wet: 0.4 },
      steel: { emissiveStrength: 1, bump: 0.5, wet: 0.55 },
      sign: { emissiveStrength: 1.25, bump: 0, wet: 0.3 },
      sil: { emissiveStrength: 1.2, bump: 0, wet: 0.3 },
    }));
  }

  /**
   * 선로 아래 가게 간판: 벽에서 튀어나온 상자 (앞면 글씨, 빛 받는 윗면, 어두운 옆면). 주인공은 세로 간판 JAZZ 하나 (가장 밝게).
   * 차양: 줄무늬 천 앞 테와 벽에 드리운 그림자 (그림자는 가게 앞면 그림에 칠했다)
   */
  private shopSigns(A: Atlas, det: Details): void {
    const Z = -70;
    UNDER_SHOPS.forEach((u, i) => {
      const F = SHOP_FORM[u.key];
      const x0 = SHOPS_X0 + SHOP_X[i];
      const W = F.w;
      const tw = textWidth(u.name, 2);
      const box = (bx0: number, bx1: number, by0: number, by1: number, zf: number, paintFace: Paint, edge: string) => {
        A.front('sign', bx0, bx1, by0, by1, zf, paintFace);
        det.add(bx0, bx1, by1 - 0.6, by1, Z, zf, tone(edge, 1.4));
        if (zf - Z > 8) for (const sx of [bx0, bx1 - 1]) det.add(sx, sx + 1, by0, by1, Z, zf - 0.5, tone(edge, 1.25));
      };
      if (F.sign === 'band') {
        // 가게 폭 띠 간판 (글자는 왼쪽: 가운데 앞을 선로 기둥이 가린다)
        box(x0, x0 + W, 68, 86, Z + 4, (f) => paintSignPanel(f, u, 6, 4, 'band'), '#2a2830');
        registerSign(u.name, '고가철도 가게 간판', x0 + 6 / scaleAt(Z + 4), x0 + (6 + tw) / scaleAt(Z + 4), 72, 82, Z + 4, tw, W);
        det.add(x0 + W - 18, x0 + W - 4, 99, 100, Z, Z + 6, C.iron);
        for (const [bxo, byo] of [[-16, 104], [-10, 108], [-4, 104]] as const) det.add(x0 + W + bxo, x0 + W + bxo + 4, byo - 4, byo, Z + 4, Z + 8, C.paintOchre);
      } else if (F.sign === 'board') {
        const bw = tw + 14;
        const bx = x0 + Math.round((W - bw) / 2);
        box(bx, bx + bw, 76, 94, Z + 5, (f) => paintSignPanel(f, u, 7, 4, 'board'), '#2a2830');
        registerSign(u.name, '고가철도 가게 간판', bx + 7, bx + 7 + tw, 80, 90, Z + 5, tw, bw);
      } else if (F.sign === 'blade') {
        // 세로 간판 (주인공): 벽에서 크게 튀어나온 상자, 굵은 관 글씨, 위아래 쇠 받침
        const bx = x0 + 3;
        const bw = 20;
        const bh = 84;
        box(bx, bx + bw, 76, 76 + bh, Z + 24, (f) => paintBladeSign(f, u), '#1f3a40');
        registerSign(u.name, '고가철도 세로 간판', bx + 4, bx + 14, 82, 76 + bh - 4, Z + 24, 9, bw);
        for (const by of [80, 76 + bh - 6]) det.add(bx + 6, bx + 14, by, by + 2, Z, Z + 22, C.iron);
        this.lamp(bx + 10, 118, Z + 40, 80, u.tube, 0.85);
      } else if (F.sign === 'hang') {
        // 팔걸이 (벽에서 나온 쇠막대)와 쇠사슬 둘에 매단 판
        const bw = tw + 8;
        const bx = x0 + Math.round((W - bw) / 2) + 6;
        det.add(bx - 8, bx + bw + 4, 97, 100, Z, Z + 14, '#3a363c');
        det.add(bx - 8, bx + bw + 4, 99.4, 100, Z, Z + 14, '#6a646a');
        for (const cx of [bx + 2, bx + bw - 3]) det.add(cx, cx + 1, 94, 98, Z + 11, Z + 12, C.iron);
        box(bx, bx + bw, 80, 94, Z + 12, (f) => paintSignPanel(f, u, 4, 3, 'wood'), '#3e2a1f');
        registerSign(u.name, '고가철도 매단 간판', bx + 4, bx + 4 + tw, 82, 92, Z + 12, tw, bw);
      } else if (F.sign === 'box') {
        const bw = tw + 10;
        const bx = x0 + 1;
        box(bx, bx + bw, 70, 84, Z + 5, (f) => paintSignPanel(f, u, 5, 2, 'board'), '#2a2830');
        registerSign(u.name, '고가철도 가게 간판', bx + 5, bx + 5 + tw, 72, 82, Z + 5, tw, bw);
      }
      if (u.awning) {
        // 줄무늬 천 차양: 앞 테(물결 끝), 빛 받는 윗판, 쇠 팔
        const ax0 = x0 + 2;
        const ax1 = x0 + 2 + (F.doorLeft ? W - 4 : W - 32);
        A.front('sign', ax0, ax1, 92, 102, Z + 18, (f) => paintAwningFront(f, u.awning!));
        det.add(ax0, ax1, 101.4, 102, Z, Z + 18, tone(u.awning, 1.5));
        for (const ax of [ax0 + 2, ax1 - 3]) det.bar(ax, 102, ax, 92, 1, Z + 1, Z + 17, C.iron);
      }
      if (F.sign === 'awning') {
        // 카페: 차양 위 띠에 글자 (차양과 한 몸)
        const bx = x0 + 6;
        const bw = tw + 10;
        box(bx, bx + bw, 102, 114, Z + 16, (f) => paintSignPanel(f, u, 5, 1, 'board'), '#2a2830');
        registerSign(u.name, '고가철도 차양 간판', bx + 5, bx + 5 + tw, 104, 112, Z + 16, tw, bw);
      }
      // 가게 사이 벽돌 기둥 (벽에서 튀어나온 면, 빛 받는 돌 갓)
      det.add(x0 - 6, x0 - 1, 0, 90, Z, Z + 4, '#4a3632');
      det.add(x0 - 7, x0, 88, 92, Z, Z + 5, '#6a6460');
    });
  }

  /**
   * 고가 철도 신호탑 둘과 전선 다발 (위층이 빈 초록 안개만 보이지 않게, 지침서 13장).
   * 철골 격자 탑 (위로 좁아지는 다리 둘, 지그재그 버팀대, 점검 발판), 꼭대기 신호등 (하나만 켜짐)과 깜빡이는 항공 경고등.
   */
  private signalTowers(det: Details): void {
    const Z = -96;
    const towers = [{ x: 4792, h: 420, lit: C.neonRed }, { x: 5352, h: 392, lit: C.neonGreen }];
    for (const [ti, t] of towers.entries()) {
      const { x, h } = t;
      det.bar(x - 14, 0, x - 5, h, 2, Z - 2, Z + 2, '#262a2c');
      det.bar(x + 14, 0, x + 5, h, 2, Z - 2, Z + 2, '#262a2c');
      const half = (y: number) => 14 - (9 * y) / h;
      for (let y = 0, k = 0; y + 26 <= h; y += 26, k++) {
        const y1 = y + 26;
        const [ax, bx] = k % 2 ? [x - half(y), x + half(y1)] : [x + half(y), x - half(y1)];
        det.bar(ax, y, bx, y1, 1, Z - 1, Z + 1, '#262a2c');
        det.add(x - half(y1), x + half(y1), y1, y1 + 1, Z - 1, Z + 1, '#262a2c');
      }
      for (const py of [Math.round(h * 0.56), h - 34]) {
        const w = half(py) + 6;
        det.add(x - w, x + w, py - 2, py, Z - 8, Z + 8, '#262a2c');
        det.add(x - w, x + w, py - 0.6, py, Z - 8, Z + 8, '#5a6260');
        det.add(x - w, x + w, py + 8, py + 9, Z + 7, Z + 8, '#262a2c');
        for (const rx of [x - w, x + w - 1]) det.add(rx, rx + 1, py, py + 9, Z + 7, Z + 8, '#262a2c');
      }
      det.add(x - 5, x + 5, h - 26, h, Z + 2, Z + 6, '#0a0c10');
      [0, 1, 2].forEach((k) => {
        const ly = h - 8 - k * 8;
        const on = (t.lit === C.neonRed && k === 0) || (t.lit === C.neonGreen && k === 2);
        const col = k === 0 ? C.neonRed : k === 1 ? C.neonAmber : C.neonGreen;
        if (on) this.glows.add(`sig${k}`, col, col, 1.6, x - 2, x + 2, ly - 2, ly + 2, Z + 6, Z + 7);
        else det.add(x - 2, x + 2, ly - 2, ly + 2, Z + 6, Z + 6.5, '#1d1f26');
        det.add(x - 3, x + 3, ly + 2, ly + 3, Z + 6, Z + 9, C.iron);
      });
      this.lamp(x, h - 10, Z + 20, 70, t.lit, 0.7);
      det.add(x - 0.5, x + 0.5, h, h + 26, Z - 0.5, Z + 0.5, C.iron);
      this.beacons.add(x, h + 28, Z, ti, 4, 50, 0.7);
    }
    // 전선 다발: 아파트(라디오 가게) 지붕 → 신호탑 1 → 뒤 건물 → 신호탑 2 → 성벽 쪽 전신주 (가닥 셋, 처짐 제각각)
    const anchors: Array<[number, number]> = [[4398, 372], [towers[0].x, towers[0].h - 40], [4994, 360], [towers[1].x, towers[1].h - 40], [5640, 340]];
    for (let a = 0; a + 1 < anchors.length; a++) {
      const [x0, y0] = anchors[a];
      const [x1, y1] = anchors[a + 1];
      for (let k = 0; k < 3; k++) {
        const sag = 22 + k * 9 + (a % 3) * 6;
        const n = 12;
        let px = x0;
        let py = y0 - k * 3;
        for (let i = 1; i <= n; i++) {
          const tt = i / n;
          const nx = x0 + (x1 - x0) * tt;
          const ny = y0 - k * 3 + (y1 - y0) * tt - sag * 4 * tt * (1 - tt);
          det.bar(px, py, nx, ny, 0.8, Z - 4 + k, Z - 3.4 + k, '#1e2224');
          px = nx;
          py = ny;
        }
      }
    }
  }

  // ---------------------------------------------------------------- 1구역 성벽 검문소
  private wall(det: Details): void {
    const A = new Atlas(2048, 1024);
    const R = MAP_ENDS.right;
    // 1) 50m 성벽 앞면: 거푸집 단, 폼타이 구멍과 녹물, 물때, 지운 낙서, 스텐실, 붉은 깃발, 큰 철문
    A.front('concrete', WALL.face[0], WALL.face[1], 0, WALL.h, WALL.z, paintWallFace);
    registerSign(WALL_SIGN.text, '장벽 스텐실', WALL_SIGN.x, WALL_SIGN.x + textWidth(WALL_SIGN.text, WALL_SIGN.s) / scaleAt(WALL.z), WALL_SIGN.y,
      WALL_SIGN.y + (5 * WALL_SIGN.s) / scaleAt(WALL.z), WALL.z, textWidth(WALL_SIGN.text, WALL_SIGN.s) / scaleAt(WALL.z),
      WALL.buttress[1] - WALL.buttress[0] - 36);
    // 동쪽 끝 (맵 끝 벽): 같은 성벽이 길을 가로질러 앞으로 꺾여 나온 모서리 (앞면과 서쪽을 보는 옆면)
    A.front('concrete', R, R + 80, 0, WALL.h, 6, (f) => paintWallBlock(f, 11, true));
    A.side('concrete', 'nx', R, 0, WALL.h, WALL.z, 6, 12, paintCornerSide);
    for (const y of [120, 260, 400]) this.beacons.add(R - 2, y + 2, 4, y === 260 ? 1 : 0, 4, 70, 0.9);
    // 서쪽 끝 모서리 보루 (앞으로 튀어나온 거대한 기둥, 좁은 총안 창)
    A.front('concrete', 5480, 5570, 0, WALL.h, -150, (f) => paintWallBlock(f, 5, false));
    A.side('concrete', 'px', 5570, 0, WALL.h, -250, -150, 6, (f) => sideStrip(f, '#40454f', '#4c515c', true));
    A.side('concrete', 'nx', 5480, 0, WALL.h, -250, -150, 6, (f) => sideStrip(f, '#3a3f49', '#464b56', true));
    // 버팀벽 (벽에서 튀어나온 콘크리트 기둥: 앞면과 두 옆면)과 발치에서 위로 쏘는 차가운 투광등
    for (const x of WALL.buttress) {
      A.front('concrete', x, x + 36, 0, WALL.h, WALL.z + 24, (f) => paintButtress(f, x));
      // (옆면은 화면에서 1칸 남짓: 앞면보다 어두우면 외곽선이 된다. 투광등·서치라이트를 받는 밝은 모서리로)
      A.side('concrete', 'px', x + 36, 0, WALL.h, WALL.z, WALL.z + 24, 3, (f) => sideStrip(f, '#4e535e', '#5e636e', true));
      A.side('concrete', 'nx', x, 0, WALL.h, WALL.z, WALL.z + 24, 3, (f) => sideStrip(f, '#525762', '#626772', true));
      det.add(x + 8, x + 28, 0, 8, WALL.z + 26, WALL.z + 40, '#2a2c32');
      this.glows.add('search', '#f0f6ff', '#c4d6e6', 1.6, x + 10, x + 26, 8, 9, WALL.z + 28, WALL.z + 38);
      this.lamp(x + 18, 14, WALL.z + 36, 300, '#c4d6e6', 0.95);
      const wash = new Beam(400, 22, '#c4d6e6', 0.032, 2);
      wash.pivot.position.set(x + 18, 8, WALL.z + 34);
      this.group.add(wash.pivot);
      this.washes.push(wash);
    }
    // 세로 낙수관 둘 (받침 쇠)과 점검 사다리
    for (const x of [5732, 6044]) {
      det.add(x, x + 4, 0, WALL.h, WALL.z, WALL.z + 4, '#2c3038');
      det.add(x, x + 1, 0, WALL.h, WALL.z + 4, WALL.z + 4.4, '#5a6070');
      for (let y = 30; y < WALL.h; y += 64) det.add(x - 1, x + 5, y, y + 2, WALL.z, WALL.z + 5, '#3a3e48');
    }
    for (const rx of [5908, 5914]) det.add(rx, rx + 1, 212, WALL.catwalk, WALL.z, WALL.z + 3, '#3a3e48');
    for (let y = 216; y < WALL.catwalk; y += 6) det.add(5908, 5915, y, y + 1, WALL.z, WALL.z + 2.6, '#3a3e48');
    // 철문 위 나트륨 등 (문 앞을 비춘다)
    const gx = (WALL.gate[0] + WALL.gate[1]) / 2;
    det.add(gx - 12, gx + 12, 248, 254, WALL.z, WALL.z + 10, '#2a2c32');
    this.glows.add('flood', '#ffe2a8', '#ffc16e', 1.6, gx - 10, gx + 10, 247, 248, WALL.z + 1, WALL.z + 9);
    this.lamp(gx, 250, WALL.z + 40, 220, C.sodium, 1.2, 0, true);
    // 2) 벽면에 매단 감시 초소: 콘크리트 함(불 켜진 총안 창 줄), 받침 까치발, 지붕 위 서치라이트, 모서리 경고등
    for (const [pi, p] of WALL.posts.entries()) {
      const x0 = p.x - p.w / 2;
      const x1 = p.x + p.w / 2;
      const z0 = WALL.z;
      const z1 = WALL.z + 26;
      A.front('concrete', x0, x1, p.y, p.y + 40, z1, paintPostFront);
      det.add(x0, x1, p.y + 39.4, p.y + 40, z0, z1, '#4f5460');
      det.add(x0 - 3, x1 + 3, p.y + 40, p.y + 44, z0, z1 + 3, '#3e434e');
      det.add(x0 - 3, x1 + 3, p.y + 43.4, p.y + 44, z0, z1 + 3, '#7a808c');
      det.add(x0, x1, p.y - 2, p.y, z0, z1, '#22252c');
      det.add(x0 + 4, x1 + 6, p.y - 14, p.y - 2, z0 + 0.4, z0 + 0.8, '#121318');
      for (const bx of [x0 + 6, x1 - 8]) det.bar(bx, p.y, bx + 1, p.y - 22, 3, z0 + 6, z0 + 10, '#2a2d36');
      this.lamp(p.x, p.y + 22, z1 + 14, 90, C.windowLight, 0.6);
      this.beacons.add(x1 - 2, p.y + 46, z1 - 2, pi, 4, 50, 0.7);
    }
    for (const s of WALL.searchlights) {
      det.add(s.x - 7, s.x + 7, s.y - 4, s.y + 6, WALL.z + 10, WALL.z + 24, C.iron);
      this.glows.add('search', '#f0f6ff', '#c4d6e6', 1.6, s.x - 5, s.x + 5, s.y - 5, s.y - 3.5, WALL.z + 12, WALL.z + 22);
      const b = new Beam(s.y + 120, 58, C.beam, 0.16, 2);
      b.pivot.position.set(s.x, s.y - 4, WALL.z + 40);
      this.group.add(b.pivot);
      this.searchlights.push({ beam: b, x: s.x, y: s.y, phase: s.phase, sweep: s.sweep });
    }
    // 철조망 난간 통로: 벽면을 따라 좁은 쇠 통로, 기둥과 위에 감긴 철조망, 통로 호박색 작업등 (몇 개만 켜짐)
    const cw = WALL.catwalk;
    det.add(WALL.x0, R, cw - 3, cw, WALL.z, WALL.z + 12, '#2a2d36');
    det.add(WALL.x0, R, cw - 0.6, cw, WALL.z, WALL.z + 12, '#6a707c');
    det.add(WALL.x0, R, cw - 9, cw - 3, WALL.z + 0.4, WALL.z + 0.8, '#121318');
    for (let x = WALL.x0 + 4, k = 0; x < R; x += 22 + (k % 3) * 3, k++) det.add(x, x + 1, cw, cw + 14, WALL.z + 11, WALL.z + 12, '#4f5460');
    A.front('sil', WALL.x0, R, cw + 12, cw + 18, WALL.z + 11.6, paintWireCoil);
    for (const x of [5826, 6006, 6292]) {
      this.glows.add('amber', '#ffc16e', '#d4792c', 1.3, x, x + 3, cw + 3, cw + 6, WALL.z + 10, WALL.z + 12);
      this.lamp(x + 1, cw + 4, WALL.z + 20, 70, C.neonAmber, 0.45);
    }
    // 3) 성벽 아래 막사 (밝은 콘크리트 2층: 성벽보다 두 단계 밝게), 처마 테, 문 위 차양과 등, 실외기
    const [bx0, bx1] = WALL.barracks;
    A.front('concrete', bx0, bx1, 0, 96, -150, paintBarracks);
    A.side('concrete', 'nx', bx0, 0, 96, -170, -150, 2, (f) => sideStrip(f, '#4a463e', '#5c564c'));
    det.add(bx0 - 4, bx1 + 4, 96, 100, -172, -148, '#5c5850');
    det.add(bx0 - 4, bx1 + 4, 99.4, 100, -172, -148, '#9a958a');
    const door = bx0 + Math.round((bx1 - bx0) * 0.62);
    det.add(door - 4, door + 22, 40, 43, -150, -138, '#3a3a3e');
    det.add(door - 4, door + 22, 42.4, 43, -150, -138, '#8a8680');
    this.glows.add('flood', '#ffe2a8', '#ffc16e', 1.4, door + 4, door + 14, 39.4, 40, -146, -142);
    this.lamp(door + 9, 38, -130, 90, C.sodium, 0.8, 0, true);
    for (const ax of [bx0 + 30, bx0 + 150]) {
      det.add(ax, ax + 14, 60, 70, -150, -144, '#4a4c50');
      det.add(ax, ax + 14, 69.4, 70, -150, -144, '#7a7c80');
    }
    // 감시탑: 다리 둘과 가새, 초소 (불 켜진 창 안의 경비), 지붕 위 서치라이트
    for (const p of kindOf(OS.posts, 'watchLeg')) {
      det.add(p.x, p.x + p.w, p.h0, p.h, -34, -26, '#2a2c32');
      det.add(p.x, p.x + 1.5, p.h0, p.h, -26, -25.6, '#5a5e68');
    }
    const legs = kindOf(OS.posts, 'watchLeg');
    if (legs.length === 2) {
      const [a, b] = legs;
      for (let y = 20; y < a.h - 20; y += 50) {
        det.bar(a.x + a.w, y, b.x, y + 46, 2, -31, -29, '#2a2c32');
        det.bar(b.x, y, a.x + a.w, y + 46, 2, -31, -29, '#2a2c32');
      }
    }
    for (const c of kindOf(OS.posts, 'watchCabin')) {
      A.front('concrete', c.x, c.x + c.w, c.h0, c.h, -20, (f) => paintCabin(f, 41));
      A.side('concrete', 'px', c.x + c.w, c.h0, c.h, -40, -20, 2, (f) => sideStrip(f, '#3a2e28', '#4a3a33'));
      A.side('concrete', 'nx', c.x, c.h0, c.h, -40, -20, 2, (f) => sideStrip(f, '#3a2e28', '#4a3a33'));
      this.lamp(c.x + c.w / 2, c.h0 + 18, -14, 110, C.windowLight, 0.8);
    }
    for (const d of kindOf(OS.decks, 'watch')) {
      det.add(d.x0, d.x1, d.h - 4, d.h, -44, -16, '#2a2c32');
      det.add(d.x0, d.x1, d.h - 0.6, d.h, -44, -16, '#6a707c');
    }
    for (const d of kindOf(OS.decks, 'watchRoof')) {
      det.add(d.x0, d.x1, d.h - 4, d.h, -44, -16, '#2a2c32');
      det.add(d.x0, d.x1, d.h - 0.6, d.h, -44, -16, '#6a707c');
      det.add(d.x0 + 30, d.x0 + 44, d.h, d.h + 10, -34, -24, C.chromeDark);
      const b = new Beam(330, 44, C.beam, 0.2, 2);
      b.pivot.position.set(d.x0 + 37, d.h + 8, -29);
      this.group.add(b.pivot);
      this.searchlights.push({ beam: b, x: d.x0 + 37, y: d.h + 8, phase: 2.1, sweep: 0.55 });
    }
    // 초소 (불 켜진 창 안의 경비), 차단기 (빨강·하양 줄 막대), 모래주머니 벽
    for (const b of kindOf(OS.blocks, 'booth')) {
      A.front('concrete', b.x0, b.x1, 0, b.h, -6, (f) => paintCabin(f, 53));
      A.side('concrete', 'nx', b.x0, 0, b.h, -50, -6, 3, (f) => sideStrip(f, '#3a2e28', '#4a3a33'));
      det.add(b.x0 - 3, b.x1 + 3, b.h - 3, b.h, -53, -3, '#2a2c32');
      det.add(b.x0 - 3, b.x1 + 3, b.h - 0.6, b.h, -53, -3, '#7a7e88');
      this.lamp((b.x0 + b.x1) / 2, b.h - 16, -2, 90, C.windowLight, 0.8);
      det.add(b.x1 + 2, b.x1 + 8, 0, 30, -60, -54, C.iron);
      for (let k = 0; k < 10; k++) det.add(b.x1 + 8 + k * 9, b.x1 + 17 + k * 9, 26, 30, -58, -56, k % 2 ? '#c8c4b8' : '#8a2a26');
    }
    for (const b of kindOf(OS.blocks, 'sandbags')) {
      A.front('concrete', b.x0, b.x1, 0, b.h, -6, paintSandbags);
      det.add(b.x0, b.x1, b.h - 0.6, b.h, -40, -6, '#7a705e');
    }
    // 길 위 콘크리트 방벽과 대전차 장애물 (성벽 아래 어둠 속 실루엣)
    for (const x of [5660, 5740, 6020]) {
      det.add(x, x + 40, 0, 16, -96, -84, '#3e3c3a');
      det.add(x + 4, x + 36, 16, 22, -94, -86, '#3e3c3a');
      det.add(x + 4, x + 36, 21.4, 22, -94, -86, '#6a6660');
    }
    for (const x of [5800, 5830, 6110]) {
      det.bar(x, 0, x + 16, 18, 3, -120, -116, '#4a4a4e');
      det.bar(x + 16, 0, x, 18, 3, -118, -114, '#4a4a4e');
    }
    this.group.add(A.build({
      concrete: { emissiveStrength: 1.2, bump: 0.6, wet: 0.45 },
      sil: { emissiveStrength: 1, bump: 0, wet: 0.4 },
    }));
  }

  /** 이번 틱의 빛 후보와 깜빡임 (렌더 전용, 틱만 보고 정한다) */
  update(tick: number, view0: number, view1: number): void {
    for (const [i, l] of this.lamps.entries()) {
      if (l.x < view0 - l.range || l.x > view1 + l.range) continue;
      let p = l.power;
      // 용광로(7): 숨 쉬듯 천천히 밝아졌다 어두워지고 그 위에 잔 일렁임. 나머지는 몇 틱씩 끊기는 깜빡임
      if (l.flicker === 7) p *= 0.8 + 0.12 * Math.sin(tick * 0.045 + i * 1.7) + 0.08 * hash((tick >> 2) * 13 + i * 7);
      else if (l.flicker > 0) p *= 0.75 + 0.25 * hash((tick >> 2) * 13 + i * l.flicker);
      lightPool.add(l.x, l.y, l.z, l.range, l.color, p, l.down);
    }
    // 경고등: 유리와 빛이 같은 위상으로 깜빡인다
    for (const [p, m] of this.beacons.mats.entries()) m.uniforms.emissiveStrength.value = Beacons.on(tick, p) ? 3 : 0.3;
    for (const b of this.beacons.list) {
      if (b.x < view0 - b.range || b.x > view1 + b.range) continue;
      lightPool.add(b.x, b.y, b.z, b.range, C.neonRed, b.power * (Beacons.on(tick, b.p) ? 1 : 0.12));
    }
    this.updateTrain(tick, view0, view1);
    this.updateFurnaces(tick, view0, view1);
    const detail = detailEnabled();
    for (const w of this.washes) w.pivot.visible = detail;
    // 서치라이트: 아래로 비추며 천천히 좌우로 훑는다. 빛이 닿는 바닥에 밝은 웅덩이
    for (const [i, s] of this.searchlights.entries()) {
      const d = s.sweep * Math.sin(tick * 0.0085 + s.phase) + 0.12 * Math.sin(tick * 0.023 + i);
      s.beam.aim(Math.PI + d);
      const hx = s.x + s.y * Math.tan(d);
      if (hx > view0 - 160 && hx < view1 + 160) lightPool.add(hx, 8, -24, 150, C.beam, 1.25);
      if (s.y > 400) {
        const wx = s.x + (s.y - 260) * Math.tan(d);
        if (wx > view0 - 120 && wx < view1 + 120) lightPool.add(wx, 260, WALL.z + 50, 170, C.beam, 0.8);
      }
    }
  }

  /**
   * 용광로: 화구에서 튀어 오르는 불씨 (오르며 흔들리고 노랑 → 주황 → 빨강으로 식는다), 굴뚝 꼭대기 연기 (불꽃 빛에 아랫면이 물든다).
   * 틱만 보고 정한다 (불씨 하나마다 나이 = (틱 + 씨앗) % 수명)
   */
  private updateFurnaces(tick: number, view0: number, view1: number): void {
    this.embers.begin();
    this.smoke.begin();
    for (const f of this.furnaces) {
      if (f.x < view0 - 200 || f.x > view1 + 200) continue;
      for (let i = 0; i < 70; i++) {
        const life = 70 + Math.floor(hash(i * 7 + 1) * 90);
        const age = (tick + Math.floor(hash(i * 13 + 5) * 400)) % life;
        const t = age / life;
        const sway = Math.sin(age * 0.07 + i * 1.9) * (3 + t * 8);
        const x = f.x + (hash(i * 3 + 2) - 0.5) * 26 + sway + t * 14;
        const y = 30 + age * (0.55 + hash(i * 5) * 0.5);
        const color = t < 0.25 ? C.lampCore : t < 0.55 ? C.fxYellow : t < 0.8 ? C.fxOrange : C.fxRed;
        if (hash(i * 17 + (tick >> 2)) < 0.15 && t > 0.6) continue;
        this.embers.add(x, y, 12, color, t < 0.5 ? 2.2 : 1.5);
      }
    }
    // 굴뚝 연기: 바람에 동쪽으로 흘러가며 커지고 옅어진다 (굴뚝마다 박자가 다르다)
    for (const [fi, f] of this.flues.entries()) {
      if (f.x < view0 - 240 || f.x > view1 + 160) continue;
      for (let k = 0; k < 9; k++) {
        const life = 170 + fi * 23;
        const age = (tick + k * Math.floor(life / 9) + fi * 41) % life;
        const t = age / life;
        this.smoke.add(f.x + Math.sin(age * 0.03 + k + fi) * 6 + age * 0.4 * f.k, f.top + 4 + age * 0.7, f.z, (12 + age * 0.22) * f.k, 1 - t);
      }
    }
    this.embers.end();
    this.smoke.end();
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
        lightPool.add(x, rail.h + 26, -6, 120, '#b0f0c8', 0.7);
        const strobe = 0.35 + 0.65 * hash(((tick + Math.floor(x / 7)) >> 1) * 7 + 3);
        lightPool.add(x, rail.h - 20, -12, 120, '#d8fff0', 0.55 * strobe, true);
      }
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

/** 통로·작업대 난간 (윗면 h, 앞 깊이 z) */
function rail(det: Details, x0: number, x1: number, h: number, z: number): void {
  det.add(x0, x1, h + 13, h + 14, z - 1, z, '#4e4850');
  det.add(x0, x1, h + 6, h + 7, z - 1, z, C.iron);
  for (let x = x0, k = 0; x < x1; x += 14 + (k % 2) * 2, k++) det.add(x, x + 1, h, h + 14, z - 1, z, C.iron);
}

// ---------------------------------------------------------------- 색과 붓
const hx = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const hexOf = (r: number, g: number, b: number): string => `#${((1 << 24) | (cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).slice(1)}`;
/** 두 색 사이 (t = 0이면 a) */
function mix(a: string, b: string, t: number): string {
  const A = hx(a);
  const B = hx(b);
  return hexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
/** 밝기 배수 */
function tone(a: string, k: number): string {
  const A = hx(a);
  return hexOf(A[0] * k, A[1] * k, A[2] * k);
}
/** 이어진 값 잡음 (0~1): 얼룩·때의 덩어리 */
function vnoise(x: number, y: number, cell: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const sx = (fx - ix) * (fx - ix) * (3 - 2 * (fx - ix));
  const sy = (fy - iy) * (fy - iy) * (3 - 2 * (fy - iy));
  const h = (a: number, b: number) => hash(seed * 1013 + a * 7919 + b * 104729);
  return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
}
const px = (g: CanvasRenderingContext2D, x: number, y: number, c: string) => rect(g, x, y, 1, 1, c);

/**
 * 흘러내린 자국 (녹물·물때): (x, y)에서 아래로 len. 머리는 굵고 아래로 가늘어지며, 끝으로 갈수록 끊기고 결을 따라 한 칸씩 비뚤어진다
 */
function drip(g: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, color: string, seed: number): void {
  let cx = x;
  for (let d = 0; d < len; d++) {
    const t = d / len;
    if (t > 0.45 && hash(seed + d * 13) < (t - 0.45) * 1.3) continue;
    const ww = Math.max(1, Math.round(w * (1 - t * 0.75)));
    if (d > 0 && d % 9 === 0 && hash(seed * 3 + d) < 0.3) cx += hash(seed + d) < 0.5 ? -1 : 1;
    rect(g, cx - Math.floor((ww - 1) / 2), y + d, ww, 1, color);
  }
}

/** 벽돌 색 묶음 (줄눈, 바탕, 어두운, 밝은, 어둠 속 한 면) */
interface Bricks { mortar: string; base: string; dark: string; light: string; flat: string }
/** 그을린 제철소 벽돌 (어둠 속에서는 차가운 쪽) */
const SOOT: Bricks = { mortar: '#2e2a30', base: '#564a4e', dark: '#4a4044', light: '#665a5c', flat: '#4a4246' };
/** 내화 벽돌 (용광로 굴뚝 아래) */
const FIRE: Bricks = { mortar: '#4a342c', base: '#84584a', dark: '#704a3e', light: '#966a58', flat: '#74503f' };
/** 선로 밑 그을린 붉은 벽돌 */
const RAILBRICK: Bricks = { mortar: '#2a2224', base: '#5e3e38', dark: '#4e3430', light: '#6e4a42', flat: '#4e3834' };

/**
 * 벽돌 (8×4 칸: 벽돌 7×3 + 줄눈 1, 맵 전체 같은 크기). lit(x, y): 그 칸에 빛이 닿는 정도 (0~1).
 * 빛이 닿은 곳만 줄눈과 벽돌 색이 갈리고, 어둠 속은 한 면이다 (디테일은 빛 닿은 면에만). 경계는 벽돌 단위로 흩어진다.
 */
function masonry(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, seed: number, T: Bricks, lit: (x: number, y: number) => number): void {
  rect(g, x0, y0, w, h, T.flat);
  for (let row = 0, y = y0 + h - 4; y > y0 - 4; row++, y -= 4) {
    const off = row % 2 ? 4 : 0;
    for (let col = 0, x = x0 - off; x < x0 + w; col++, x += 8) {
      const r = hash(seed * 7 + row * 131 + col * 17 + 5);
      if (lit(x + 4 - x0, y + 2 - y0) <= 0.12 + r * 0.38) continue;
      const c = r < 0.55 ? T.base : r < 0.78 ? T.dark : r < 0.94 ? T.light : T.mortar;
      const xa = Math.max(x0, x);
      const ya = Math.max(y0, y);
      const xb = Math.min(x0 + w, x + 8);
      const yb = Math.min(y0 + h, y + 4);
      if (xb <= xa || yb <= ya) continue;
      rect(g, xa, ya, xb - xa, yb - ya, T.mortar);
      const bx = Math.min(x0 + w, x + 7);
      const by = Math.min(y0 + h, y + 3);
      if (bx > xa && by > ya) rect(g, xa, ya, bx - xa, by - ya, c);
    }
  }
}

/** 옆면 띠: 세로로 바탕색, 위쪽 몇 칸은 밝게 (빛 받는 모서리). light이면 전체를 밝은 쪽으로 (가까운 빛을 받는 옆면) */
function sideStrip(f: Frame, base: string, lit: string, light = false): void {
  rect(f.g, 0, 0, f.w, f.h, light ? lit : base);
  if (!light) rect(f.g, 0, 0, f.w, Math.min(f.h, 3), lit);
  for (let y = 5 + (f.h % 7); y < f.h; y += 23) rect(f.g, 0, y, f.w, 1, tone(light ? lit : base, 0.85));
}

/**
 * 3×5 글꼴을 관(선)으로만 긋는다 (칸을 키워 찍지 않는다): 글자 한 칸 s, 선 굵기 t. chip: 페인트가 벗겨진 비율
 */
function strokeText(g: CanvasRenderingContext2D, text: string, x: number, y: number, s: number, t: number, color: string, chip = 0, seed = 1, vertical = false): void {
  const c0 = Math.floor((s - t) / 2);
  [...text].forEach((ch, k) => {
    const rows = glyphRows(ch);
    const on = (r: number, c: number) => r >= 0 && r < 5 && c >= 0 && c < 3 && (rows[r] & (4 >> c)) !== 0;
    const ox = vertical ? x : x + k * 4 * s;
    const oy = vertical ? y + k * 6 * s : y;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (!on(r, c)) continue;
        const cx = ox + c * s + c0;
        const cy = oy + r * s + c0;
        const segs: Array<[number, number, number, number]> = [[cx, cy, t, t]];
        if (on(r, c + 1)) segs.push([cx, cy, s + t, t]);
        if (on(r + 1, c)) segs.push([cx, cy, t, s + t]);
        for (const [sx, sy, sw, sh] of segs) {
          for (let yy = 0; yy < sh; yy++) {
            for (let xx = 0; xx < sw; xx++) {
              if (chip > 0 && hash(seed + (sx + xx) * 31 + (sy + yy) * 17) < chip) continue;
              px(g, sx + xx, sy + yy, color);
            }
          }
        }
      }
    }
  });
}

/** 비스듬한 굵은 막대 (텍스처 칸, 끝점 두 개, 굵기 t): 줄마다(또는 칸마다) 같은 폭으로 그어 계단이 고르다 */
function seg(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number, color: string): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (Math.abs(dy) >= Math.abs(dx)) {
    const n = Math.round(Math.abs(dy));
    for (let i = 0; i <= n; i++) {
      const k = n ? i / n : 0;
      rect(g, Math.round(x0 + dx * k - (t - 1) / 2), Math.round(y0 + dy * k), t, 1, color);
    }
  } else {
    const n = Math.round(Math.abs(dx));
    for (let i = 0; i <= n; i++) {
      const k = n ? i / n : 0;
      rect(g, Math.round(x0 + dx * k), Math.round(y0 + dy * k - (t - 1) / 2), 1, t, color);
    }
  }
}

/** 원통 명암 (u: 0~1 왼쪽 → 오른쪽): 왼쪽(빛 쪽) 조금 밝고 오른쪽으로 어두워진다. 맨 끝 두 칸은 평평하게 (어두운 테가 외곽선이 되지 않게) */
function cylK(u: number): number {
  const v = Math.min(u, 0.9);
  return 1.1 - 0.42 * Math.pow(Math.abs(v - 0.28) / 0.72, 1.4) * (v > 0.28 ? 1 : 0.4);
}

/** 높은 아치 창 (텍스처 칸: 왼쪽 x, 위 끝(아치 꼭대기) y, 폭 w, 높이 h) */
function archWindow(f: Frame, x: number, y: number, w: number, h: number, state: 'hot' | 'dim' | 'dark', seed: number): void {
  const { g, e } = f;
  const R = Math.floor(w / 2);
  const inset = (k: number) => {
    const dy = R - k - 0.5;
    return k < R ? Math.round(R - Math.sqrt(Math.max(0, R * R - dy * dy))) : 0;
  };
  // 아치 바깥 (벽)은 칠하기 전 그대로 되돌린다: 창 안만 칠한다
  const bx0 = x - 3;
  const by0 = y - 3;
  const bw = w + 6;
  const bh = h + 7;
  const before = g.getImageData(bx0, by0, bw, bh);
  const beforeE = e.getImageData(bx0, by0, bw, bh);
  if (state === 'hot') {
    roomWall(g, e, x, y, w, h, [[x + w * (0.3 + hash(seed) * 0.4), y + h + 4, w * 0.9, h * 0.75, 1.05], [x + w / 2, y, w, h * 0.25, 0.25]], 0.14, FURNACE, 4);
  } else if (state === 'dim') {
    roomWall(g, e, x, y, w, h, [[x + w * 0.5, y + h + 2, w * 0.6, h * 0.4, 0.3]], 0.03, FURNACE, 4);
  } else {
    rect(g, x, y, w, h, '#18151a');
    rect(e, x, y, w, h, '#000');
  }
  // 천장 기중기 들보와 사슬·국자 (밝은 창에만), 쇳물 튀는 불꽃 점
  if (state === 'hot') {
    sil(g, e, x, y + Math.round(h * 0.24), w, f.S(3), '#1c080a');
    const lx = x + Math.round(w * (0.25 + hash(seed * 7) * 0.5));
    sil(g, e, lx, y + Math.round(h * 0.24), 1, Math.round(h * 0.31), '#1c080a');
    sil(g, e, lx - 5, y + Math.round(h * 0.55), 11, 8, '#1c080a');
    glowRect(g, e, lx - 3, y + Math.round(h * 0.55) - 1, 7, 1, '#ffc16e', '#ffc16e');
    for (let k = 0; k < 4; k++) glowRect(g, e, x + Math.floor(hash(seed + k * 3) * w), y + h - 4 - Math.floor(hash(seed + k * 7) * h * 0.4), 1, 1, C.lampCore, '#ffe2a8');
  }
  // 쇠 창살: 세로 6칸마다 (아치 머리까지), 아치가 시작하는 줄에 가로 창틀, 그 아래 8칸마다
  for (let gx = x + 5; gx < x + w - 1; gx += 6) sil(g, e, gx, y, 1, h, '#262226');
  sil(g, e, x, y + R, w, 2, '#262226');
  for (let gy = y + R + 9; gy < y + h; gy += 8) sil(g, e, x, gy, w, 1, '#262226');
  // 깨진 칸
  for (let k = 0; k < 3; k++) {
    if (hash(seed * 5 + k) > (state === 'dark' ? 0.9 : 0.35)) continue;
    const kx = x + 1 + Math.floor(hash(seed * 31 + k) * Math.max(1, w / 6 - 1)) * 6;
    const ky = y + R + 3 + Math.floor(hash(seed * 37 + k) * Math.max(1, (h - R) / 8 - 1)) * 8;
    if (state === 'dark') glowRect(g, e, kx, ky, 5, 7, '#3e1a14', '#2e0c10');
    else sil(g, e, kx, ky, 5, 7, '#18151a');
  }
  // 아치 바깥 되돌리기
  const now = g.getImageData(bx0, by0, bw, bh);
  const nowE = e.getImageData(bx0, by0, bw, bh);
  const inside = (i: number, j: number) => {
    const px0 = bx0 + i;
    const py0 = by0 + j;
    if (px0 < x || px0 >= x + w || py0 < y || py0 >= y + h) return false;
    const k = py0 - y;
    const ins = inset(k);
    return px0 >= x + ins && px0 < x + w - ins;
  };
  for (let j = 0; j < bh; j++) {
    for (let i = 0; i < bw; i++) {
      if (inside(i, j)) continue;
      const o = (j * bw + i) * 4;
      for (let c = 0; c < 4; c++) {
        now.data[o + c] = before.data[o + c];
        nowE.data[o + c] = beforeE.data[o + c];
      }
    }
  }
  g.putImageData(now, bx0, by0);
  e.putImageData(nowE, bx0, by0);
  // 돌 아치 테 (2칸 폭, 빛 받는 위쪽이 밝다)와 돌 창턱
  for (let k = -2; k < R; k++) {
    const i = inset(Math.max(0, k));
    const ring = k < 0 ? w + 4 - i * 2 : 2;
    const c = k < R / 2 ? '#665c58' : '#544a48';
    rect(g, x - 2 + i, y + k, ring, 1, c);
    if (k >= 0) rect(g, x + w - i, y + k, 2, 1, c);
  }
  rect(g, x + R - 1, y - 3, 3, 4, '#766a64');
  rect(g, x - 3, y + h, w + 6, 3, '#5a5250');
  rect(g, x - 3, y + h, w + 6, 1, '#7a706a');
}

// ---------------------------------------------------------------- 공장 그림
/** 서쪽 끝 공장 앞면 (월드 x -8 ~ 56): 그을린 벽돌, 위층 높은 창 하나(용광로 빛), 아래 어둑한 창, 맨 위 그을음 */
function paintEndWall(f: Frame): void {
  const { g, w, h, X, Y } = f;
  const lit = (x: number, y: number) => {
    const hh = (h - y) / f.sk;
    return Math.max(hh < 110 ? 0.9 - hh / 140 : 0, Math.abs(x - X(34)) < 30 && hh > 240 && hh < 420 ? 0.8 : 0);
  };
  masonry(g, 0, 0, w, h, 17, SOOT, lit);
  archWindow(f, X(16), Y(410), X(34) - X(16) + 8, Y(262) - Y(410), 'hot', 5);
  archWindow(f, X(18), Y(190), 22, Y(70) - Y(190), 'dim', 9);
  rect(g, 0, Y(8), w, Y(0) - Y(8), '#4e4a48');
  for (let y = 0; y < 14; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 5, 17) < 0.8 - y / 16) px(g, x, y, '#2a262a');
}

/** 서쪽 끝 공장 옆면 (용광로 쪽을 본다): 벽돌 줄, 작은 창 몇, 세로 관 */
function paintEndSide(f: Frame): void {
  const { g, w, h, Y } = f;
  rect(g, 0, 0, w, h, '#504548');
  for (let y = h - 4; y > 0; y -= 4) rect(g, 0, y + 3, w, 1, '#3a3236');
  for (const [hh, lit] of [[60, false], [150, true], [240, false], [330, false]] as const) {
    rect(g, 4, Y(hh + 26), 6, Y(hh) - Y(hh + 26), lit ? '#844018' : '#1c181c');
    if (lit) rect(f.e, 4, Y(hh + 26), 6, Y(hh) - Y(hh + 26), '#5e2c12');
  }
  rect(g, w - 4, 0, 2, h, '#3e383c');
  for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 4, 23) < 0.8 - y / 18) px(g, x, y, '#2a262a');
}

/**
 * 제철소 앞면: 그을린 벽돌(빛 닿는 곳만 결), 칸마다 다른 높은 창(용광로 빛·어둑함·깨짐), 큰 철문, 돌 받침,
 * 처마 위 톱니 지붕 (유리 면 몇 장에 불빛), 관 글씨 간판 CITADEL STEEL과 벽에 드리운 그림자
 */
function paintMillFront(f: Frame): void {
  const { g, e, w, h, X, Y, sk } = f;
  const L = MILL.x0;
  const wx = (x: number) => X(x - L);
  const hot = MILL_PIERS.slice(0, -1).map((p, i) => [p + 8, MILL_PIERS[i + 1], MILL_BAYS[i]] as const).filter(([, , s]) => s === 'hot');
  const lit = (x: number, y: number) => {
    const wxw = x / sk + L;
    const hh = (h - y) / sk;
    let v = hh < 100 ? 0.55 - hh / 220 : 0;
    for (const lx of [84, 318, 760]) if (Math.abs(wxw - lx) < 60 && hh < 120) v = Math.max(v, 0.85 - Math.abs(wxw - lx) / 90 - hh / 260);
    for (const [a, b] of hot) {
      const d = Math.max(0, Math.abs(wxw - (a + b) / 2) - (b - a) / 2);
      if (hh > 40 && hh < 190) v = Math.max(v, 0.9 - d / 26);
    }
    if (wxw > 120 && wxw < 270 && hh < 170) v = Math.max(v, 0.95 - hh / 200);
    if (wxw > MILL_SIGN.x - 20 && wxw < MILL_SIGN.x + 126 && hh > 150 && hh < 204) v = Math.max(v, 0.7);
    return v;
  };
  const eave = Y(MILL.eave);
  masonry(g, 0, eave, w, h - eave, 29, SOOT, lit);
  // 처마 밑 그을음 (덩어리째 아래로 옅어진다)
  for (let y = eave; y < eave + 16; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 6, 3) < 0.75 - (y - eave) / 22) px(g, x, y, '#2e2a30');
  // 돌 받침
  rect(g, 0, Y(10), w, Y(0) - Y(10), '#4e4a48');
  for (let x = 6, k = 0; x < w; x += 15 + (k % 3) * 3, k++) rect(g, x, Y(10), 1, Y(0) - Y(10), '#3a3634');
  rect(g, 0, Y(10), w, 1, '#6a6460');
  // 톱니 지붕: 비탈 지붕(어두운 쇠)과 세운 유리 면 (몇 장만 불빛)
  let x = 0;
  for (let k = 0; x < w; k++) {
    const period = Math.round((40 + (k % 4) * 3 + (k % 3)) * sk);
    const tooth = Math.round((MILL.h - MILL.eave - 4) * sk);
    for (let i = 0; i < period; i++) {
      const hgt = Math.round(tooth * (i / period));
      if (hgt <= 0 || x + i >= w) continue;
      rect(g, x + i, eave - hgt, 1, hgt, i > period - 4 ? '#3a343a' : '#252228');
      if (hgt > 2) rect(g, x + i, eave - hgt, 1, 1, '#4e4850');
    }
    // 세운 유리 면 (톱니 오른쪽 끝, 2칸 폭)
    const gx = x + period - 3;
    const litPane = hash(k * 7 + 3) < 0.3;
    for (let y = eave - tooth + 2; y < eave - 1; y++) {
      if (gx + 2 >= w) break;
      if (litPane) glowRect(g, e, gx, y, 2, 1, '#62181c', '#451216');
      else rect(g, gx, y, 2, 1, '#1c181e');
      if ((y - eave) % 4 === 0) rect(g, gx, y, 2, 1, '#2e2a30');
    }
    x += period;
  }
  rect(g, 0, eave, w, 2, '#2c282c');
  // 칸마다 창
  MILL_BAYS.forEach((state, i) => {
    const a = MILL_PIERS[i] + 8;
    const b = MILL_PIERS[i + 1];
    if (state === 'door') {
      // 큰 철문 (골 진 강철, 아래 틈으로 용광로 불빛이 샌다), 위 판자로 막은 창
      const dx0 = wx(a + 4);
      const dw = wx(b - 4) - dx0;
      rect(g, dx0 - 2, Y(84), dw + 4, Y(0) - Y(84), '#3e3a3a');
      rect(g, dx0, Y(80), dw, Y(0) - Y(80), '#2e2c30');
      for (let y = Y(78); y < Y(4); y += 4) rect(g, dx0 + 1, y, dw - 2, 1, '#45414a');
      rect(g, dx0 + Math.floor(dw / 2), Y(80), 1, Y(4) - Y(80), '#1e1c20');
      glowRect(g, e, dx0, Y(4), dw, Y(0) - Y(4), '#ec6046', '#ec6046');
      glowRect(g, e, dx0, Y(4), dw, 1, '#ffc16e', '#ffc16e');
      const by = Y(150);
      rect(g, dx0 + 4, by, dw - 8, Y(100) - by, '#3a2e28');
      for (let y = by; y < Y(100); y += 5) rect(g, dx0 + 4, y + 4, dw - 8, 1, '#2a201c');
      return;
    }
    const ww = Math.min(48, b - a - 10);
    const x0 = wx(a + (b - a - ww) / 2);
    archWindow(f, x0, Y(166), Math.round(ww * sk), Y(62) - Y(166), state, 29 + i * 13);
  });
  // 간판 CITADEL STEEL: 벽에 건 판의 관 글씨 (한 글자는 어둡다). 판 아래·오른쪽 벽에 드리운 그림자 면
  const s = MILL_SIGN.s;
  const twd = textWidth(MILL_SIGN.text, s);
  const tx = wx(MILL_SIGN.x);
  const ty = Y(MILL_SIGN.y) - 5 * s;
  const px0 = tx - 6;
  const pw = twd + 12;
  const py0 = ty - 4;
  const ph = 5 * s + 8;
  rect(g, px0 + 3, py0 + ph, pw, 3, '#241f24');
  rect(g, px0 + pw, py0 + 3, 3, ph, '#241f24');
  rect(g, px0, py0, pw, ph, '#2c2226');
  rect(g, px0, py0, pw, 1, '#5a4a48');
  rect(e, px0, py0, pw, ph, '#0d0405');
  neonText(g, e, MILL_SIGN.text, tx, ty, s, '#ffc16e', C.neonAmberDark);
  // 'STEEL'의 두 번째 E는 관이 나갔다 (어둡게 남은 관)
  const dead = tx + 10 * 4 * s;
  rect(e, dead, ty, 3 * s, 5 * s, '#000');
  for (const [bx, by] of [[px0 + 8, py0 - 6], [px0 + pw - 10, py0 - 6]]) rect(g, bx, by, 2, 6, '#262226');
}

/** 용광로 굴뚝 앞면: 아래 내화 벽돌(화구 둘레가 달아올랐다), 위 리벳 강판 통(판 이음·리벳·녹물), 원통 명암, 꼭대기 그을음 */
function paintStack(f: Frame): void {
  const { g, e, w, h, Y } = f;
  const brickTop = Y(56);
  // 위: 강판 통 (차가운 강철: 붉게 물든 제철소 벽돌과 갈리게)
  for (let x = 0; x < w; x++) rect(g, x, 0, 1, brickTop, tone('#5c5c68', cylK(x / (w - 1))));
  for (let hh = 92; hh < 286; hh += 36) {
    const y = Y(hh);
    for (let x = 0; x < w; x++) {
      px(g, x, y, tone('#3e3a44', cylK(x / (w - 1))));
      px(g, x, y - 1, tone('#86828c', cylK(x / (w - 1))));
      if (x % 4 === 2) px(g, x, y + 2, tone('#8e8a94', cylK(x / (w - 1))));
    }
    const off = (hh / 36) % 2 ? 18 : 40;
    for (let yy = y - 34; yy < y; yy++) if (yy > 0) px(g, off, yy, tone('#4a4650', cylK(off / (w - 1))));
  }
  // 녹물 (판 이음과 리벳에서 흘러내림)
  for (let k = 0; k < 9; k++) drip(g, 3 + Math.floor(hash(k * 7 + 3) * (w - 6)), Y(92 + Math.floor(hash(k * 5) * 5) * 36) + 2, 10 + Math.floor(hash(k * 3 + 1) * 26), 2, k % 3 ? '#4e4644' : '#5e4234', k * 17);
  // 꼭대기 그을음 (덩어리)
  for (let y = 0; y < 40; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 5, 9) < 0.85 - y / 46) px(g, x, y, tone('#2e2a30', 0.9 + 0.2 * cylK(x / (w - 1))));
  // 아래: 내화 벽돌 (화구 빛이 닿는 아래쪽만 결)
  masonry(g, 0, brickTop, w, h - brickTop, 41, FIRE, (x, y) => 1 - (y / (h - brickTop)) * 0.2 - Math.abs(x - w / 2) / w * 0.3);
  rect(g, 0, brickTop - 2, w, 2, '#3e3a44');
  // 화구 둘레가 쇳물 빛으로 달아올랐다 (발광 단계, 화구에서 멀어질수록 한 단계씩)
  const aw = 40;
  const ah = 46;
  const ax = Math.round((w - aw) / 2);
  const ay = h - ah;
  const steps = ['#62181c', '#451216', '#2e0c10', '#1c080a'];
  for (let y = brickTop; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - w / 2) / 1.25, y + 0.5 - (h - 10)) - aw * 0.5;
      const k = Math.floor((d + (hash(x * 13 + y * 7) - 0.5) * 3) / 13);
      if (k >= 0 && k < steps.length) px(e, x, y, steps[k]);
    }
  }
  rect(g, ax - 4, ay - 6, aw + 8, ah + 6, '#4a4040');
  rect(g, ax - 4, ay - 6, aw + 8, 1, '#7a6a62');
  roomWall(g, e, ax, ay, aw, ah, [[ax + aw / 2, h, aw * 0.75, ah * 0.9, 1.8], [ax + aw / 2, h - 6, aw, 10, 0.8]], 0.3, FURNACE, 4);
  for (let k = 0; k < 10; k++) {
    const inset = Math.round(10 - Math.sqrt(100 - (10 - k) * (10 - k)));
    sil(g, e, ax, ay + k, inset, 1, '#4a4040');
    sil(g, e, ax + aw - inset, ay + k, inset, 1, '#4a4040');
  }
  // 반쯤 올린 쇠문 (아래로 빛이 쏟아진다)
  sil(g, e, ax + 2, ay + 4, aw - 4, 12, '#2e2a30');
  for (let x = ax + 4; x < ax + aw - 4; x += 5) sil(g, e, x, ay + 5, 1, 10, '#4e4850');
  glowRect(g, e, ax + 2, ay + 16, aw - 4, 1, C.lampCore, C.lampCore);
}

/** 저탄 탑 앞면: 녹슨 리벳 강판, 판 이음, 녹물, 페인트 글씨 COKE */
function paintHopper(f: Frame): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h, '#5e4c42');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 9, 21) > 0.68) px(g, x, y, '#6a5244');
  for (let x = 14; x < w - 2; x += 28) {
    rect(g, x, 0, 1, h, '#46382f');
    for (let y = 3; y < h; y += 5) px(g, x + 2, y, '#7a6656');
  }
  for (let y = 26; y < h; y += 40) {
    rect(g, 0, y, w, 1, '#46382f');
    rect(g, 0, y - 1, w, 1, '#76604e');
  }
  for (let k = 0; k < 8; k++) drip(g, 2 + Math.floor(hash(k * 11 + 1) * (w - 4)), 26 + Math.floor(hash(k * 3) * 3) * 40 + 1, 8 + Math.floor(hash(k * 7) * 24), 2, '#4a2e22', k * 29);
  strokeText(g, 'COKE', Math.round((w - textWidth('COKE', 3)) / 2), 8, 3, 1, '#a8987e', 0.2, 77);
  registerSign('COKE', '저탄 탑 글씨', 640 + Math.round((w - textWidth('COKE', 3)) / 2) + 1, 640 + Math.round((w - textWidth('COKE', 3)) / 2) + textWidth('COKE', 3), 196 - 8 - 15, 196 - 8, -4, textWidth('COKE', 3), w);
}

/** 계단탑: 그을린 벽돌, 계단을 따라 엇갈려 오르는 좁은 창 (맨 위 하나 불), 아래 문과 문 위 등 */
function paintStairTower(f: Frame): void {
  const { g, e, w, h, Y, sk } = f;
  masonry(g, 0, 0, w, h, 53, SOOT, (x, y) => ((h - y) / sk < 110 ? 0.75 : 0.15 + 0.1 * Math.sin(x)));
  for (const [k, hh] of [30, 74, 118, 162, 206, 236].entries()) {
    const x = k % 2 ? w - 16 : 8;
    const lit = k === 5 || k === 2;
    if (lit) roomWall(g, e, x, Y(hh + 22), 8, Y(hh) - Y(hh + 22), [[x + 4, Y(hh + 22) + 2, 6, 14, 0.8]], 0.2, WARM, 2);
    else rect(g, x, Y(hh + 22), 8, Y(hh) - Y(hh + 22), '#1c181c');
    rect(g, x - 1, Y(hh), 10, 2, '#5a5250');
  }
  rect(g, Math.round(w / 2) - 9, Y(40), 18, Y(0) - Y(40), '#2a2428');
  roomWall(g, e, Math.round(w / 2) - 6, Y(36), 12, 10, [[w / 2, Y(36), 10, 12, 0.6]], 0.15, WARM, 3);
  glowRect(g, e, Math.round(w / 2) - 2, Y(46), 4, 2, C.lampCore, C.lampGlow);
  for (let y = 0; y < 10; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 4, 53) < 0.75 - y / 12) px(g, x, y, '#2e2a30');
}

/** 펌프실: 녹슨 골함석, 불 켜진 작은 창이 난 문, 문 위 등 */
function paintPumpHouse(f: Frame): void {
  const { g, e, w, h } = f;
  for (let x = 0; x < w; x++) rect(g, x, 0, 1, h, x % 3 === 0 ? '#6e5a4a' : x % 3 === 1 ? '#5e4c40' : '#4e3e34');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 7, 31) > 0.7) px(g, x, y, '#4a3226');
  const dx = 10;
  rect(g, dx - 1, h - 46, 20, 46, '#2a2422');
  rect(g, dx, h - 45, 18, 45, '#3a302a');
  roomWall(g, e, dx + 4, h - 40, 10, 9, [[dx + 9, h - 40, 8, 10, 0.7]], 0.2, WARM, 2);
  glowRect(g, e, dx + 6, h - 52, 6, 2, C.lampCore, C.lampGlow);
  rect(g, 0, h - 4, w, 4, '#3a3230');
}

/** 벽돌 굴뚝 (실루엣 판): 위로 조금씩 좁아지는 몸통, 쇠띠, 사다리, 꼭대기 벌어진 테 */
function paintBrickChimney(f: Frame): void {
  const { g, w, h, Y, sk } = f;
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    const hh = (h - y) / sk;
    const half = hh > 494 ? 13 * sk : (11 - (hh / 506) * 3.5) * sk;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0 - 1);
      const band = hh % 64 < 3 && hh < 490;
      const base = hh > 494 ? '#3a3234' : band ? '#2e282c' : (Math.floor(hh / 4) + (Math.floor((x + (Math.floor(hh / 4) % 2) * 3) / 6))) % 7 === 0 ? '#423638' : '#4a3c3e';
      px(g, x, y, tone(base, cylK(u) * (0.75 + 0.25 * Math.min(1, (h - y) / (h * 0.5)))));
    }
  }
  // 사다리 (오른쪽)
  for (let y = Y(480); y < h; y++) {
    if (Y(480) > y) continue;
    const half = (11 - (((h - y) / sk) / 506) * 3.5) * sk;
    const rx = Math.round(cx + half) - 4;
    px(g, rx, y, '#5a4e4c');
    if (y % 3 === 0) px(g, rx - 1, y, '#5a4e4c');
  }
}

/** 강판 굴뚝 (실루엣 판): 리벳 이음, 녹물, 꼭대기 테와 받침 줄 */
function paintSteelChimney(f: Frame): void {
  const { g, w, h, sk } = f;
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    const hh = (h - y) / sk;
    const half = hh > 452 ? 12 * sk : 9 * sk;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0 - 1);
      const seam = hh % 42 < 1.5;
      px(g, x, y, tone(seam ? '#3a3a40' : hh > 452 ? '#4a4a50' : '#54545c', cylK(u) * (0.72 + 0.28 * Math.min(1, (h - y) / (h * 0.5)))));
    }
  }
  for (let k = 0; k < 6; k++) drip(g, Math.round(cx - 6 + hash(k * 3) * 12), Math.round(hash(k * 7) * h * 0.8), 10 + Math.floor(hash(k) * 30), 1, '#4a3a32', k * 11);
}

/** 열풍로 둘 (실루엣 판): 둥근 지붕의 높은 원통, 열풍 관, 리벳 띠 */
function paintStoves(f: Frame): void {
  const { g, w, h, sk, X, Y } = f;
  for (const [a, b] of [[8, 40], [46, 78]] as const) {
    const x0 = X(a);
    const x1 = X(b);
    const r = (x1 - x0) / 2;
    const top = Y(318);
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0 - 1);
      const dx = x + 0.5 - (x0 + r);
      const dome = Math.round(Math.sqrt(Math.max(0, r * r - dx * dx)) * 0.7);
      for (let y = top - dome; y < h; y++) {
        const hh = (h - y) / sk;
        px(g, x, y, tone(hh % 48 < 2 ? '#3e3a46' : '#545260', cylK(u) * (0.7 + 0.3 * Math.min(1, (h - y) / (h * 0.45)))));
      }
    }
  }
  // 열풍 본관 (고로 쪽으로)
  rect(g, X(40), Y(128), w - X(40), Y(120) - Y(128), '#3a3640');
  rect(g, X(40), Y(128), w - X(40), 1, '#5e5a64');
  void w;
}

/**
 * 고로 (실루엣 판): 원통 몸통(냉각 띠·풍구 고리), 좁아지는 목, 꼭대기 작업대와 난간, 방산관 둘, 상승관과 하강관,
 * 오른쪽 제진기(원통과 깔때기, 다리 둘)
 */
function paintBlastFurnace(f: Frame): void {
  const { g, e, w, h, X, Y, S } = f;
  const shell = '#3e3a44';
  // 제진기
  const dc0 = X(130);
  const dc1 = X(164);
  for (let x = dc0; x < dc1; x++) {
    const u = (x - dc0) / (dc1 - dc0 - 1);
    for (let y = Y(300); y < Y(150); y++) px(g, x, y, tone(shell, cylK(u) * 0.9));
  }
  for (let y = Y(150); y < Y(122); y++) {
    const t = (y - Y(150)) / (Y(122) - Y(150));
    const half = Math.round(((dc1 - dc0) / 2) * (1 - t * 0.7));
    rect(g, Math.round((dc0 + dc1) / 2) - half, y, half * 2, 1, tone(shell, 0.8));
  }
  for (const lx of [X(134), X(156)]) rect(g, lx, Y(122), S(3), Y(0) - Y(122), '#36323a');
  // 몸통
  const b0 = X(30);
  const b1 = X(100);
  for (let x = b0; x < b1; x++) {
    const u = (x - b0) / (b1 - b0 - 1);
    for (let y = Y(352); y < h; y++) {
      const hh = (h - y) / f.sk;
      const ring = hh % 30 < 2;
      px(g, x, y, x === b0 ? '#6e5048' : tone(ring ? '#302c36' : shell, cylK(u) * (0.72 + 0.28 * Math.min(1, (h - y) / (h * 0.5)))));
      if (ring && hh % 30 >= 1.5 && x > b0) px(g, x, y, tone('#5a5662', cylK(u)));
    }
  }
  // 풍구 고리 (튀어나온 관)
  for (let x = b0 - S(4); x < b1 + S(4); x++) for (let y = Y(146); y < Y(138); y++) px(g, x, y, tone('#3e3a44', cylK((x - b0 + S(4)) / (b1 - b0 + S(8)))));
  // 목 (좁아진다: 세 줄마다 한 칸씩)
  for (let y = Y(384); y < Y(352); y++) {
    const k = Math.floor((Y(352) - y) / 3);
    const x0 = b0 + Math.min(k, X(14));
    const x1 = b1 - Math.min(k, X(14));
    for (let x = x0; x < x1; x++) px(g, x, y, tone(shell, cylK((x - x0) / Math.max(1, x1 - x0 - 1)) * 0.8));
  }
  // 꼭대기 작업대, 난간
  rect(g, X(36), Y(388), X(96) - X(36), S(4), '#34303a');
  rect(g, X(36), Y(388), X(96) - X(36), 1, '#6a5e5a');
  rect(g, X(36), Y(398), X(96) - X(36), 1, '#34303a');
  for (let x = X(36); x < X(96); x += 6) rect(g, x, Y(398), 1, Y(388) - Y(398), '#34303a');
  // 꼭대기 장입 건물 (창 둘에 불)
  rect(g, X(50), Y(410), X(80) - X(50), Y(388) - Y(410), '#34303a');
  rect(g, X(50), Y(410), X(80) - X(50), 1, '#6a5e5a');
  for (const wx of [54, 68]) roomWall(g, e, X(wx), Y(404), S(6), S(6), [[X(wx) + 3, Y(404), 5, 7, 0.8]], 0.3, WARM, 2);
  // 방산관 둘 (꼭대기 작은 불)
  for (const bx of [44, 82]) {
    rect(g, X(bx), Y(468), S(4), Y(388) - Y(468), '#3a3640');
    rect(g, X(bx) - 1, Y(472), S(4) + 2, Y(468) - Y(472), '#2e2a32');
  }
  glowRect(g, e, X(82), Y(476), S(4), S(4), '#ffc16e', '#d4792c');
  px(g, X(83), Y(479), '#ffe2a8');
  px(e, X(83), Y(479), '#ffc16e');
  // 상승관과 하강관 (제진기로)
  rect(g, X(92), Y(430), S(6), Y(380) - Y(430), '#3a3640');
  seg(g, X(95), Y(430), X(150), Y(318), S(6), '#3a3640');
  rect(g, X(146), Y(318), S(6), Y(300) - Y(318), '#3a3640');
  // 화구 쪽 아래 몸통이 붉게 물든다 (발광 단계 둘)
  for (let y = Y(40); y < h; y++) for (let x = b0; x < b1; x++) px(e, x, y, y > Y(16) ? '#2e0c10' : '#1c080a');
  void w;
}

/** 컨베이어 다리 (실루엣 판): 저탄 탑에서 고로 꼭대기로 오르는 덮개 컨베이어 (작은 창 몇에 불), 아래 트러스와 받침탑 */
function paintConveyor(f: Frame): void {
  const { g, e, w, h, X, Y, S } = f;
  const x0 = X(708 - 392);
  const y0 = Y(196 - 176);
  const x1 = X(402 - 392);
  const y1 = Y(384 - 176);
  const n = x0 - x1;
  const th = S(12);
  for (let i = 0; i <= n; i++) {
    const x = x0 - i;
    const yc = Math.round(y0 + ((y1 - y0) * i) / n);
    rect(g, x, yc - th, 1, th, i % 5 === 0 ? '#2e2a30' : '#3a343a');
    px(g, x, yc - th, '#5e5658');
    // 아래 트러스 (지그재그)
    const zz = (i % 16) < 8 ? i % 8 : 7 - (i % 8);
    px(g, x, yc + 1 + zz, '#2e2a30');
    px(g, x, yc + 8, '#2e2a30');
    if (i % 23 === 7 && hash(i) < 0.6) glowRect(g, e, x, yc - th + 4, 2, 2, '#d8a85e', '#844018');
  }
  // 받침탑 둘
  for (const bx of [600, 500]) {
    const x = X(bx - 392);
    const i = x0 - x;
    const yc = Math.round(y0 + ((y1 - y0) * i) / n);
    for (let y = yc + 8; y < h; y++) {
      px(g, x - 4, y, '#2e2a30');
      px(g, x + 4, y, '#2e2a30');
      if ((y - yc) % 10 < 1) rect(g, x - 4, y, 9, 1, '#2e2a30');
      else px(g, x - 4 + Math.floor(((y - yc) % 10) * 0.9), y, '#2e2a30');
    }
  }
  void w;
}

// ---------------------------------------------------------------- 항만 그림
/** 컨테이너 칠·이름 (같은 이름이 두 번 나오지 않게) */
const CONTAINERS: ReadonlyArray<{ paint: string; name: string; dent: boolean; logo: string | null }> = [
  { paint: '#8a3c2c', name: 'TRITON', dent: false, logo: null },
  { paint: '#2f6a62', name: '', dent: true, logo: '#c8c0a8' },
  { paint: '#5a6a7e', name: 'BOREAL', dent: false, logo: null },
  { paint: '#9a7838', name: '', dent: false, logo: '#2a2420' },
  { paint: '#a89c80', name: 'OSPREY', dent: true, logo: null },
];

/** 컨테이너 긴 면: 칠, 골(밝은 날·바탕·그늘 4칸 주기), 위아래 테, 녹물, 찌그러짐, 해운사 이름이나 띠 */
function paintContainerSide(f: Frame, c: { paint: string; name: string; dent: boolean; logo: string | null }): void {
  const { g, w, h } = f;
  const lit = tone(c.paint, 1.18);
  const dark = tone(c.paint, 0.78);
  for (let x = 0; x < w; x++) rect(g, x, 0, 1, h, x % 4 === 0 ? lit : x % 4 === 3 ? dark : c.paint);
  rect(g, 0, 0, w, 2, tone(c.paint, 0.7));
  rect(g, 0, 0, w, 1, tone(c.paint, 1.3));
  rect(g, 0, h - 2, w, 2, tone(c.paint, 0.62));
  rect(g, 0, 2, 2, h - 4, tone(c.paint, 1.1));
  rect(g, w - 2, 2, 2, h - 4, tone(c.paint, 1.1));
  const seed = hx(c.paint)[0] * 7 + w;
  // 녹: 윗테·모서리에서 흘러내림, 아래쪽 번진 녹
  for (let k = 0; k < Math.floor(w / 9); k++) drip(g, 3 + Math.floor(hash(seed + k * 31) * (w - 6)), 2, 4 + Math.floor(hash(seed + k * 17) * (h - 10)), 2, mix(c.paint, '#5a3424', 0.7), seed + k);
  for (let x = 0; x < w; x++) for (let y = h - 7; y < h - 2; y++) if (vnoise(x, y, 4, seed) > 0.62 + (h - 2 - y) * 0.04) px(g, x, y, mix(c.paint, '#5a3424', 0.6));
  if (c.dent) {
    const dx = 8 + Math.floor(hash(seed * 3) * (w - 26));
    for (let y = 9; y < 18; y++) for (let x = dx; x < dx + 12; x++) if (Math.hypot((x - dx - 6) / 6, (y - 13.5) / 4.5) < 1) px(g, x, y, x < dx + 6 ? dark : tone(c.paint, 1.1));
  }
  if (c.name) {
    const tx = 6 + Math.floor(hash(seed * 11) * Math.max(1, w - 12 - textWidth(c.name)));
    drawText(g, c.name, tx, Math.floor(h / 2) - 3, mix(c.paint, '#e8e0cc', 0.75), 1);
  }
  if (c.logo) {
    rect(g, 4, Math.floor(h / 2) - 3, w - 8, 3, c.logo);
    for (let x = 4; x < w - 4; x++) if (hash(seed + x * 5) < 0.18) px(g, x, Math.floor(h / 2) - 3 + Math.floor(hash(x) * 3), c.paint);
  }
}

/** 컨테이너 끝면 (옆에서 본 좁은 띠): 문짝 둘과 잠금 막대(door) 또는 골 진 막힌 끝 */
function paintContainerEnd(f: Frame, c: { paint: string }, door: boolean): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h, tone(c.paint, 0.86));
  rect(g, 0, 0, w, 2, tone(c.paint, 0.7));
  rect(g, 0, h - 2, w, 2, tone(c.paint, 0.6));
  if (door) {
    for (const x of [2, 4, 6, 8]) rect(g, x, 3, 1, h - 6, tone(c.paint, 1.25));
    rect(g, 5, 2, 1, h - 4, tone(c.paint, 0.6));
  } else for (let y = 3; y < h - 2; y += 3) rect(g, 0, y, w, 1, tone(c.paint, 0.72));
}

/** 갠트리 크레인 다리 앞면: 칠한 강판, 보강판(밝은 날), 리벳, 녹물, 왼쪽 다리에는 사다리 */
function paintCraneLeg(f: Frame, ladder: boolean): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h, '#7a6038');
  rect(g, 2, 0, 1, h, '#8e7246');
  rect(g, w - 3, 0, 1, h, '#64502e');
  for (let y = 18; y < h; y += 38) {
    rect(g, 0, y, w, 3, '#8e7246');
    rect(g, 0, y + 3, w, 1, '#5a4628');
    for (let x = 2; x < w - 1; x += 3) px(g, x, y + 1, '#a08a5c');
  }
  for (let k = 0; k < 6; k++) drip(g, 2 + Math.floor(hash(k * 13 + (ladder ? 1 : 2)) * (w - 4)), 18 + Math.floor(hash(k * 7) * 5) * 38 + 4, 8 + Math.floor(hash(k * 3 + 1) * 22), 2, '#4e3a26', k * 7 + (ladder ? 0 : 99));
  if (ladder) for (let y = 4; y < h - 2; y++) {
    px(g, w - 6, y, '#3e3222');
    px(g, w - 2, y, '#3e3222');
    if (y % 4 === 0) rect(g, w - 6, y, 5, 1, '#3e3222');
  }
}

/** 크레인 들보 앞면: 상자 들보 (윗 테가 빛을 받는다), 리벳 줄, 들보 밑 전선 관 */
function paintCraneBeam(f: Frame): void {
  paintGirder(f, '#7a6038', '#a08a5c', '#5a4628', 2);
  const { g, w, h } = f;
  for (let x = 8, k = 0; x < w - 8; x += 26 + (k % 3) * 5, k++) rect(g, x, 3, 2, h - 5, '#8e7246');
  rect(g, 0, h - 4, w, 1, '#3e3222');
}

/** 판 거더 (선로·크레인 아래 들보): 윗 테 lit, 몸판 base, 아래 테 low, 보강재·리벳 */
function paintGirder(f: Frame, base: string, lit: string, low: string, flange: number): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h, base);
  rect(g, 0, 0, w, flange, lit);
  rect(g, 0, h - flange, w, flange, low);
  for (let x = 2; x < w; x += 4) {
    px(g, x, flange, tone(lit, 0.9));
    px(g, x, h - flange - 1, tone(base, 1.2));
  }
  for (let x = 14, k = 0; x < w - 2; x += 30 + (k % 4) * 4, k++) rect(g, x, flange, 2, h - flange * 2, tone(base, 1.22));
  for (let k = 0; k < w / 24; k++) drip(g, Math.floor(hash(k * 17 + w) * w), flange + 1, 3 + Math.floor(hash(k * 5 + h) * (h - flange * 2)), 1, mix(base, '#5a3424', 0.6), k * 3 + w);
}

/** 크레인 위 (실루엣 판, 들보 위 236~428): 기계실(불 켜진 창의 운전수), A자 탑과 가새, 꼭대기 도르래, 탑에서 들보 끝으로 내린 버팀줄 */
function paintCraneTop(f: Frame): void {
  const { g, e, w, h, X, Y, S } = f;
  const steel = '#5e4a2c';
  const lit = '#8e7246';
  // 버팀줄 (가늘게)
  for (const ex of [4, 226]) {
    const ax = X(115);
    const ay = Y(186);
    const n = Math.max(Math.abs(X(ex) - ax), Math.abs(Y(0) - ay));
    for (let i = 0; i <= n; i++) px(g, Math.round(ax + ((X(ex) - ax) * i) / n), Math.round(ay + ((Y(2) - ay) * i) / n), '#3a3226');
  }
  // A자 다리 둘 (꼭대기에서 모인다), 가로 묶음 둘, 가새
  seg(g, X(26), Y(2), X(110), Y(180), S(4), steel);
  seg(g, X(204), Y(2), X(120), Y(180), S(4), steel);
  seg(g, X(26) - 1, Y(2), X(110) - 1, Y(180), 1, lit);
  for (const [hy, a, b] of [[64, 56, 174], [126, 84, 146]] as const) rect(g, X(a), Y(hy), X(b) - X(a), S(3), steel);
  seg(g, X(56), Y(64), X(146), Y(126), 1, steel);
  seg(g, X(174), Y(64), X(84), Y(126), 1, steel);
  // 꼭대기 도르래 머리
  rect(g, X(104), Y(192), X(126) - X(104), Y(176) - Y(192), '#4e3e26');
  rect(g, X(104), Y(192), X(126) - X(104), 1, lit);
  // 기계실과 운전실 (들보 위)
  const mx0 = X(70);
  const mx1 = X(132);
  rect(g, mx0, Y(30), mx1 - mx0, Y(0) - Y(30), '#6e5a3a');
  rect(g, mx0, Y(30), mx1 - mx0, 1, lit);
  for (let x = mx0 + 3; x < mx1 - 2; x += 5) rect(g, x, Y(28), 1, Y(2) - Y(28), '#5e4c30');
  for (const [wx0, on] of [[mx0 + 6, false], [mx0 + 24, true], [mx0 + 40, false]] as const) {
    if (on) {
      roomWall(g, e, wx0, Y(24), 12, 9, [[wx0 + 6, Y(24) + 1, 10, 10, 0.85]], 0.2, WARM, 3);
      figure(g, e, wx0 + 7, Y(15), 10, 'bare');
    } else rect(g, wx0, Y(24), 12, 9, '#1e1c1c');
  }
  void w;
  void h;
}

/** 먼 부두 크레인 (실루엣 판): 다리 둘과 가로보, 바다 쪽으로 뻗은 붐, A자 탑과 줄, 기계실 창 하나 */
function paintFarCrane(f: Frame, seed: number): void {
  const { g, e, w, h, X, Y, S } = f;
  const c = '#34343c';
  const L0 = X(24);
  const L1 = X(150);
  for (const lx of [L0, L1]) rect(g, lx, Y(260), S(6), h - Y(260), c);
  seg(g, L0 + S(6), Y(40), L1, Y(200), 1, c);
  seg(g, L1, Y(40), L0 + S(6), Y(200), 1, c);
  rect(g, X(0), Y(268), w, S(8), c);
  for (let x = X(0); x < w; x += S(10)) seg(g, x, Y(268), x + S(5), Y(260), 1, c);
  // A자 탑과 버팀줄
  seg(g, X(40), Y(268), X(84), Y(420), S(3), c);
  seg(g, X(130), Y(268), X(90), Y(420), S(3), c);
  for (const ex of [0, 186]) seg(g, X(87), Y(420), X(ex) + (ex ? -1 : 1), Y(270), 1, c);
  rect(g, X(70), Y(300), X(104) - X(70), Y(268) - Y(300), c);
  if (hash(seed) < 0.8) glowRect(g, e, X(80), Y(292), S(5), S(4), '#d8a85e', '#844018');
  for (let k = 0; k < 3; k++) glowRect(g, e, X(10 + k * 60 + Math.floor(hash(seed + k) * 20)), Y(262), 1, 1, '#ffc16e', '#ad5a20');
}

/**
 * 창고 7 앞면: 칠한 골함석(밝은 날·바탕·그늘 3칸 주기), 소금기·녹물, 큰 페인트 글씨 WAREHOUSE 7 (선 글씨, 군데군데 벗겨짐),
 * 높은 채광창 띠(몇 칸 불), 셔터 둘 — 왼쪽은 반쯤 올라가 불 켜진 창고 안, 오른쪽은 닫혀 아래 틈으로만 빛, 문 위 거위목 등
 */
const WH_SIGN = { x: 1410, y: 150 };
function paintWarehouse(f: Frame): void {
  const { g, e, w, h, X, Y } = f;
  const base = '#566664';
  for (let x = 0; x < w; x++) rect(g, x, 0, 1, h, x % 3 === 0 ? '#687a76' : x % 3 === 1 ? base : '#465452');
  // 소금기 (아래쪽 덩어리째 밝게 번짐), 녹물 (지붕 볼트에서)
  for (let y = Y(60); y < h; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 8, 61) > 0.6 + (h - y) / 260) px(g, x, y, x % 3 === 2 ? '#5e6a66' : '#7a8a84');
  for (let k = 0; k < 16; k++) drip(g, 2 + Math.floor(hash(k * 7 + 3) * (w - 4)), 4, 12 + Math.floor(hash(k * 13) * 60), 2, k % 3 ? '#4a3a30' : '#5a3424', k * 19);
  // 맨 위 그을음 띠
  for (let y = 0; y < 8; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 5, 7) < 0.8 - y / 10) px(g, x, y, '#2e3436');
  // 채광창 띠 (불 켜진 칸 몇)
  for (let x = 10, k = 0; x < w - 14; x += 17 + (k % 2), k++) {
    const y = Y(132);
    if (hash(k * 5 + 1) < 0.28) roomWall(g, e, x, y, 11, 8, [[x + 5, y, 10, 10, 0.6]], 0.2, WARM, 2);
    else rect(g, x, y, 11, 8, '#1e2224');
    rect(g, x + 5, y, 1, 8, '#2e3436');
    rect(g, x - 1, y + 8, 13, 1, '#7a8a84');
  }
  // 페인트 글씨
  const tx = X(WH_SIGN.x - 1336);
  const ty = Y(WH_SIGN.y) - 20;
  strokeText(g, 'WAREHOUSE 7', tx, ty, 4, 2, '#c4b898', 0.12, 7);
  // 왼쪽 셔터: 반쯤 올라갔다 (위 셔터 판, 아래는 불 켜진 창고 안)
  const lx = 30;
  const open = 46;
  rect(g, lx - 4, h - 100, 88, 100, '#2a2c30');
  roomWall(g, e, lx, h - open, 80, open, [[lx + 24, h - open + 4, 40, 50, 0.9], [lx + 60, h - open + 2, 30, 40, 0.6]], 0.22, WARM, 8);
  sil(g, e, lx + 2, h - 26, 22, 26, '#231812');
  sil(g, e, lx + 6, h - 40, 16, 14, '#231812');
  glowRect(g, e, lx + 2, h - 27, 22, 1, '#93664c', '#5e2c12');
  sil(g, e, lx + 46, h - 18, 26, 12, C.iron);
  sil(g, e, lx + 50, h - 30, 12, 12, C.iron);
  sil(g, e, lx + 44, h - 34, 2, 30, C.iron);
  sil(g, e, lx + 40, h - 8, 8, 2, C.iron);
  for (const wx of [lx + 50, lx + 66]) sil(g, e, wx - 3, h - 7, 7, 7, C.iron);
  figure(g, e, lx + 33, h, 40, 'hat');
  for (let y = h - 100; y < h - open; y += 4) {
    rect(g, lx, y, 80, 3, '#4a4e52');
    rect(g, lx, y + 3, 80, 1, '#2e3034');
  }
  rect(g, lx, h - open - 3, 80, 3, '#2a2c30');
  // 오른쪽 셔터: 닫힘, 아래 틈 빛
  const rx = 140;
  rect(g, rx - 4, h - 100, 88, 100, '#2a2c30');
  for (let y = h - 98; y < h; y += 4) {
    rect(g, rx, y, 80, 3, '#4a4e52');
    rect(g, rx, y + 3, 80, 1, '#2e3034');
  }
  glowRect(g, e, rx, h - 2, 80, 2, C.windowLight, '#d4792c');
  for (const gx of [lx + 40, rx + 40]) {
    rect(g, gx, h - 112, 1, 8, C.iron);
    rect(g, gx - 4, h - 112, 5, 1, C.iron);
    glowRect(g, e, gx - 7, h - 112, 5, 2, C.lampCore, C.lampGlow);
  }
}

/** 하역장 앞면: 콘크리트 판(이음·물때), 고무 방현재 셋, 닳은 노란 칠 모서리 */
function paintDockFace(f: Frame): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h, '#5a5650');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 6, 71) > 0.62) px(g, x, y, '#4e4a46');
  for (let x = 0, k = 0; x < w; x += 30 + (k % 2) * 6, k++) rect(g, x, 2, 1, h - 2, '#46423e');
  for (let x = 0; x < w; x++) if (hash(x * 3 + 1) < 0.75) px(g, x, 0, '#8a7a48');
  rect(g, 0, 1, w, 1, '#6a645a');
  // 나무 방현재 (세로 각목: 빛 받는 윗면, 젖은 아래쪽)과 고무 타이어 하나
  for (const fx of [10, 46, 98, 132, 168]) {
    rect(g, fx, 3, 6, h - 3, '#4e3e2e');
    rect(g, fx, 3, 6, 1, '#7a6248');
    rect(g, fx + 4, 4, 1, h - 4, '#3e3024');
    rect(g, fx, h - 8, 6, 8, '#3a2e24');
  }
  rect(g, 72, 10, 12, 18, '#1e1c1e');
  rect(g, 73, 10, 10, 1, '#3a3638');
  for (let k = 0; k < 10; k++) drip(g, Math.floor(hash(k * 7) * w), 2, 6 + Math.floor(hash(k * 3) * 20), 2, '#3e3a36', k * 5);
}

/**
 * 화물선 (실루엣 판, 깊이 -380): 검은 선체와 붉은 흘수선, 뱃머리 이름, 둥근 창 몇(불), 갑판 컨테이너(칠 제각각),
 * 하역 기둥과 붐, 선미 선교(층마다 창, 몇 칸 불)와 굴뚝(띠), 무선 돛대(흰빛·붉은빛), 갑판등 (간격 제각각)
 */
function paintShip(f: Frame): void {
  const { g, e, w, h, X, Y, S } = f;
  // (판은 월드 x 1004부터, 바닥 -6부터: Y(d)는 판 아래에서 d 위)
  const deck = Y(80);
  for (let y = deck; y < h; y++) {
    const d = (y - deck) / (h - deck);
    const bow = Math.round(S(30) * d * d);
    const stern = Math.round(S(10) * d * d * d);
    rect(g, bow, y, w - bow - stern, 1, y > Y(14) ? '#4a2420' : '#26282e');
  }
  rect(g, 0, deck, w, 1, '#46484f');
  for (let x = S(40), k = 0; x < w - S(20); x += S(52) + (k % 3) * 7, k++) rect(g, x, deck + 4, 1, Y(16) - deck - 4, '#202228');
  // 둥근 창 (간격 제각각, 몇 개만 불)
  for (let x = S(44), k = 0; x < w - S(24); x += S(15) + Math.floor(hash(k * 5) * S(12)), k++) {
    if (hash(k * 11 + 3) < 0.35) glowRect(g, e, x, Y(56), 2, 2, C.windowLight, '#d4792c');
    else rect(g, x, Y(56), 2, 2, '#1a1c20');
  }
  drawText(g, 'NEREID', S(34), Y(70), '#6a6c72', 1);
  // 갑판 컨테이너 (한 단·두 단, 폭·칠 제각각)
  const stacks: Array<[number, number, number, string]> = [[30, 48, 1, '#5a3a30'], [84, 60, 2, '#3a5450'], [150, 40, 1, '#5e5236'], [194, 26, 1, '#4a4e5e']];
  for (const [sx, sw, rows, col] of stacks) {
    for (let r = 0; r < rows; r++) {
      const top = deck - S(18) * (r + 1);
      const x0 = X(sx + r * 4);
      const x1 = X(sx + sw - r * 4);
      rect(g, x0, top, x1 - x0, S(18), tone(col, 1 - r * 0.08));
      for (let x = x0 + 2; x < x1; x += 4) rect(g, x, top + 1, 1, S(18) - 2, tone(col, 0.8));
      rect(g, x0, top, x1 - x0, 1, tone(col, 1.25));
    }
  }
  // 하역 기둥 둘과 비스듬한 붐, 꼭대기 흰빛
  for (const [mx, bx] of [[76, 124], [212, 168]] as const) {
    rect(g, X(mx), Y(196), S(3), deck - Y(196), '#24262c');
    seg(g, X(mx) + 1, Y(184), X(bx), Y(124), 1, '#24262c');
    glowRect(g, e, X(mx), Y(199), S(3), S(3), C.lampCore, C.lampCore);
  }
  // 선미 선교: 층층이 들어간 세 층, 창 줄 (몇 칸 불, 안에 사람)
  for (let k = 0; k < 3; k++) {
    const y0 = deck - S(22) * (k + 1);
    const x0 = X(234) + S(6) * k;
    const x1 = X(306) - S(2) * k;
    rect(g, x0, y0, x1 - x0, S(22), k % 2 ? '#3a3c44' : '#42444c');
    rect(g, x0, y0, x1 - x0, 1, '#686a72');
    for (let x = x0 + 4, j = 0; x < x1 - 6; x += 7, j++) {
      if (hash(k * 31 + j * 7) < 0.42) {
        roomWall(g, e, x, y0 + 7, 4, 5, [[x + 2, y0 + 7, 4, 6, 0.8]], 0.3, WARM, 2);
        if (hash(j * 3 + k) < 0.3) sil(g, e, x + 1, y0 + 9, 2, 3);
      } else rect(g, x, y0 + 7, 4, 5, '#1a1c20');
    }
  }
  // 굴뚝 (붉은 띠)과 무선 돛대 (위층에서 보이는 흰빛·붉은빛)
  rect(g, X(266), Y(196), X(290) - X(266), deck - S(66) - Y(196), '#30323a');
  rect(g, X(266), Y(184), X(290) - X(266), S(6), '#6e322d');
  rect(g, X(264), Y(196), X(292) - X(264), S(3), '#22242a');
  const mast = X(318);
  rect(g, mast, Y(262), S(2), deck - S(66) - Y(262), '#24262c');
  rect(g, mast - S(8), Y(236), S(18), 1, '#24262c');
  glowRect(g, e, mast - 1, Y(264), S(3) + 1, S(3), C.lampCore, C.lampCore);
  glowRect(g, e, mast - S(8), Y(237), S(2), S(2), C.neonRed, C.neonRed);
  // 갑판등 (간격 제각각), 이물 초록·고물 붉은 등
  for (let x = S(20), k = 0; x < w - S(30); x += S(20) + Math.floor(hash(k * 13) * S(16)), k++) glowRect(g, e, x, deck - 2, 2, 1, C.sodium, '#d4792c');
  glowRect(g, e, S(30), deck - 6, 3, 3, C.neonGreen, C.neonGreen);
  glowRect(g, e, w - S(12), deck - 6, 3, 3, C.neonRed, C.neonRed);
}

/** 옥상 물탱크 (실루엣 판): 나무통(띠 셋), 원뿔 지붕, 쇠다리와 가새 */
function paintWaterTower(f: Frame): void {
  const { g, w, X, Y, S } = f;
  const c = '#3a3430';
  for (const lx of [8, 54]) rect(g, X(lx), Y(52), S(3), Y(0) - Y(52), '#262428');
  seg(g, X(10), Y(4), X(56), Y(48), 1, '#262428');
  seg(g, X(56), Y(4), X(10), Y(48), 1, '#262428');
  const t0 = X(4);
  const t1 = X(66);
  for (let x = t0; x < t1; x++) {
    const u = (x - t0) / (t1 - t0 - 1);
    rect(g, x, Y(92), 1, Y(52) - Y(92), tone(c, cylK(u)));
  }
  for (const hy of [60, 72, 84]) rect(g, t0, Y(hy), t1 - t0, 1, '#262428');
  for (let k = 0; k < S(12); k++) {
    const inset = Math.round((k * (t1 - t0)) / 2 / S(12));
    rect(g, t0 + inset, Y(92) - S(12) + k, t1 - t0 - inset * 2, 1, '#2e2a28');
  }
  void w;
}

// ---------------------------------------------------------------- 고가 철도 그림
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

/**
 * 가게마다 폭·쇼윈도 폭·문 자리·간판 모양이 다르다 (지침서: 같은 폭·같은 구조의 가게 줄을 바꾼다).
 * 간판: band 가게 폭 띠, board 테두리 두른 판, blade 세로 간판(주인공), hang 팔걸이에 매단 판, box 작은 상자 간판, awning 차양 위 글자
 */
type UnderSign = 'band' | 'board' | 'blade' | 'hang' | 'box' | 'awning';
const SHOP_FORM: Record<string, { w: number; win: number; doorLeft: boolean; sign: UnderSign }> = {
  pawn: { w: 104, win: 60, doorLeft: false, sign: 'band' },
  jazz: { w: 148, win: 92, doorLeft: true, sign: 'blade' },
  liquor: { w: 116, win: 72, doorLeft: false, sign: 'board' },
  shoes: { w: 96, win: 56, doorLeft: true, sign: 'hang' },
  barber: { w: 106, win: 62, doorLeft: true, sign: 'box' },
  cafe: { w: 128, win: 92, doorLeft: false, sign: 'awning' },
};
/** 가게 왼쪽 끝 (가게 판 칸 좌표): 사이 벽돌 기둥 폭도 조금씩 다르다 */
const SHOP_X: readonly number[] = (() => {
  let x = 6;
  return UNDER_SHOPS.map((u, i) => {
    const x0 = x;
    x += SHOP_FORM[u.key].w + 8 + (i % 3) * 3;
    return x0;
  });
})();

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
    for (let x = wx + 2; x < wx + 40; x += 4) glowRect(g, e, x, wy + 14 + (x % 3), 2, 5, '#a066a8', '#8a2066');
    sil(g, e, wx + 1, wy + 20, 40, 1, C.ironLight);
    counter(wx, 42, 14, '#df45a7', '#b42d86', '#26091c');
    for (const x of [wx + 8, wx + 28]) figure(g, e, x, foot, 40, 'sit');
    figure(g, e, wx + 62, foot, 44, 'bare');
    sil(g, e, wx + 64, foot - 31, 2, 12);
    sil(g, e, wx + 64, foot - 21, 5, 3);
  } else if (key === 'liquor') {
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
    for (const row of [wy + 10, wy + 20]) for (let x = wx + 46; x < wx + ww - 4; x += 7) sil(g, e, x, row, 5, 3);
    figure(g, e, wx + 26, foot, 40, 'sit');
    counter(wx + 8, 40, 12, C.windowLit, '#5e2c12');
    sil(g, e, wx + 30, foot - 22, 1, 10);
    glowRect(g, e, wx + 27, foot - 24, 6, 3, C.lampCore, '#ffc070');
  } else if (key === 'barber') {
    rect(g, wx + 6, wy + 6, ww - 12, 22, C.glassEdge);
    glowRect(g, e, wx + 6, wy + 6, ww - 12, 1, '#c9f7f5', '#55c8cc');
    for (const x of [wx + 16, wx + 50]) {
      figure(g, e, x, foot - 6, 38, 'sit');
      sil(g, e, x - 4, foot - 8, 12, 8);
      sil(g, e, x + 1, foot - 8, 2, 8);
    }
    figure(g, e, wx + 34, foot, 46, 'bare');
  } else {
    for (const x of [wx + 18, wx + 56]) {
      sil(g, e, x + 2, wy, 1, 9);
      glowRect(g, e, x, wy + 9, 5, 3, C.lampCore, '#ffc070');
    }
    figure(g, e, wx + 38, foot - 2, 44, 'bare');
    counter(wx, ww, 13, C.windowLight, '#844018');
    for (const x of [wx + 14, wx + 54]) figure(g, e, x, foot, 40, 'sit');
  }
}

/** 위층 창: 돌 인방과 창턱, 켜진 방(커튼 그림자나 사람)·텔레비전 방·꺼진 창 */
function upstairs(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  rect(g, x - 2, y - 3, w + 4, 3, '#4e4844');
  rect(g, x - 2, y + h, w + 4, 2, '#6a625c');
  const r = hash(seed * 13 + 1);
  if (r < 0.42) {
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
    roomWall(g, e, x, y, w, h, [[x + w * 0.3, y + h - 4, w * 0.7, h * 0.7, 0.85]], 0.06, TV, 5);
  } else {
    rect(g, x, y, w, h, '#1c1a20');
    rect(g, x + 2, y + 2, 2, h - 8, '#2a3236');
  }
  sil(g, e, x + Math.floor(w / 2), y, 1, h, '#36323a');
  sil(g, e, x, y + Math.floor(h / 2), w, 1, '#36323a');
}

/**
 * 선로 아래 가게 앞면: 그을린 붉은 벽돌 위층(빛 닿는 곳만 결), 가게 앞을 두른 유약 타일 띠(가게마다 색), 쇼윈도 안 실내와 사람,
 * 문, 이발소 기둥, 위층 창. 간판 상자·차양이 벽에 드리운 그림자 면 (상자는 따로 세운다)
 */
function paintUnderShops(f: Frame): void {
  const { g, e, w, h } = f;
  const Y = (hh: number) => h - hh;
  const lamps = [4960, 5104, 5330, 5492].map((x) => x - SHOPS_X0);
  masonry(g, 0, 0, w, Y(88), 97, RAILBRICK, (x, y) => {
    let v = 0.15;
    for (const lx of lamps) v = Math.max(v, 0.9 - Math.abs(x - lx) / 70 - (Y(88) - y) / 120);
    return v;
  });
  // 선로 기둥이 벽에 드리운 그림자 (넓은 면, 가장자리 두 칸은 옅게)
  g.save();
  g.globalCompositeOperation = 'multiply';
  for (const lx of OS.posts.filter((p) => p.kind === 'railLeg').map((p) => p.x - SHOPS_X0)) {
    g.fillStyle = '#9a9a9a';
    g.fillRect(lx - 8, 0, 30, h);
    g.fillStyle = '#6e6e6e';
    g.fillRect(lx - 6, 0, 26, h);
  }
  g.restore();
  // 선로 그늘 (맨 위 덩어리째 어둡다)
  for (let y = 0; y < 22; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 7, 13) < 0.9 - y / 24) px(g, x, y, '#1e1a1c');
  UNDER_SHOPS.forEach((u, i) => {
    const F = SHOP_FORM[u.key];
    const x0 = SHOP_X[i];
    const W = F.w;
    const seed = 400 + i * 37;
    // 유약 타일 띠 (6×3 타일, 밝은 줄눈): 가게마다 색
    const tile = ['#4a6a60', '#3e3a52', '#5a6e64', '#6a5a44', '#4e6670', '#6a4e44'][i];
    rect(g, x0 - 2, Y(90), W + 4, 90, tile);
    for (let y = Y(90); y < h; y += 4) rect(g, x0 - 2, y + 3, W + 4, 1, tone(tile, 1.3));
    for (let y = Y(90), r = 0; y < h; y += 4, r++) for (let x = x0 - 2 + (r % 2) * 3; x < x0 + W + 2; x += 6) rect(g, x, y, 1, 3, tone(tile, 1.18));
    for (let y = Y(90); y < h; y++) for (let x = x0 - 2; x < x0 + W + 2; x++) if (vnoise(x, y, 5, seed) > 0.72) px(g, x, y, tone(tile, 0.82));
    rect(g, x0 - 2, Y(90), W + 4, 2, tone(tile, 1.45));
    const dx = F.doorLeft ? x0 + 6 : x0 + W - 28;
    const ww = F.win;
    const wx = F.doorLeft ? x0 + 34 : x0 + 4;
    const wy = Y(60);
    const wh = 52;
    const Lg = shopLight(u.key, wx, wy, ww, wh);
    roomWall(g, e, wx, wy, ww, wh, Lg.lamps, Lg.base, u.ramp, 14);
    furnish(g, e, u.key, wx, wy, ww, wh, seed);
    const bars = ww > 80 ? 3 : 2;
    for (let k = 1; k <= bars; k++) sil(g, e, wx + Math.round((ww * k) / (bars + 1)), wy, 1, wh, '#36323a');
    rect(g, wx - 2, wy + wh, ww + 4, 3, '#4e4844');
    rect(g, wx - 2, wy - 2, ww + 4, 2, '#5e5852');
    // 문 (안으로 들어간 문간: 둘레 그늘, 위 유리에 가게 불빛)
    rect(g, dx - 3, Y(70), 28, 70, '#1a1618');
    rect(g, dx - 1, Y(68), 24, 68, '#2e2a2c');
    roomWall(g, e, dx, Y(64), 22, 30, [[dx + 11, Y(64) + 4, 18, 28, 0.5]], Lg.base * 0.7, u.ramp, 6);
    rect(g, dx, Y(34), 22, 34, C.awning);
    rect(g, dx + 2, Y(30), 18, 12, C.awningStripe);
    rect(g, F.doorLeft ? dx + 3 : dx + 17, Y(40), 2, 4, C.chrome);
    if (u.key === 'barber') {
      const bx = F.doorLeft ? dx + 24 : dx - 9;
      for (let yy = Y(62); yy < Y(26); yy++) for (let xx = 0; xx < 4; xx++) {
        const t = (yy + xx) % 9;
        rect(g, bx + xx, yy, 1, 1, t < 3 ? C.neonRed : t < 6 ? C.white : C.fxBlue);
      }
      glowRect(g, e, bx - 1, Y(66), 6, 4, C.lampCore, '#ffe2a8');
    }
    // 간판·차양이 벽에 드리운 그림자 면 (판 아래로 짙은 면, 빛은 길 쪽 위에서 온다)
    const shade = (sx: number, sy: number, sw: number, sh: number) => {
      for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const t = (y - sy) / sh;
        if (t < 0.6 || hash(x * 7 + y * 13) > (t - 0.6) * 2.5) {
          px(g, x, y, '#141012');
          px(e, x, y, '#000');
        }
      }
    };
    const tw = textWidth(u.name, 2);
    if (F.sign === 'band') shade(x0 + 2, Y(68), W, 5);
    else if (F.sign === 'board') shade(x0 + Math.round((W - tw - 14) / 2) + 2, Y(76), tw + 14, 5);
    else if (F.sign === 'blade') shade(x0 + 5, Y(76 + 84), 4, 84);
    else if (F.sign === 'hang') shade(x0 + Math.round((W - tw - 8) / 2) + 8, Y(80), tw + 8, 4);
    else if (F.sign === 'box') shade(x0 + 3, Y(70), tw + 10, 4);
    if (u.awning) shade(x0 + 3, Y(92), F.doorLeft ? W - 4 : W - 32, 7);
    // 위층 창 (가게 폭에 따라 둘이나 셋, 높이도 조금씩 다르게)
    const n = W >= 130 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const ux = x0 + Math.round(((k + 0.5) * W) / n) - 13;
      upstairs(g, e, ux, Y(140 + ((i + k) % 2) * 4), 26, 34, seed + k * 5);
    }
  });
}

/** 간판 판 앞면: 바탕(밝은 윗테), 관 글씨 (주인공은 하얀 심, dim은 한 단계 어두운 관, off는 꺼진 관) */
function paintSignPanel(f: Frame, u: (typeof UNDER_SHOPS)[number], tx: number, ty: number, kind: 'band' | 'board' | 'wood'): void {
  const { g, e, w, h } = f;
  const bg = kind === 'wood' ? '#4e3426' : '#262a30';
  rect(g, 0, 0, w, h, bg);
  rect(g, 0, 0, w, 1, kind === 'wood' ? '#86604a' : '#5a606a');
  rect(g, 0, h - 1, w, 1, tone(bg, 0.7));
  if (kind === 'board') {
    rect(g, 1, 1, 1, h - 2, '#3e434c');
    rect(g, w - 2, 1, 1, h - 2, '#3e434c');
  }
  if (kind === 'wood') for (let y = 3; y < h - 1; y += 4) rect(g, 1, y, w - 2, 1, '#3e2a1f');
  const glowCol = u.sign === 'hero' ? '#c8f6ff' : DIM[u.tube] ?? u.tube;
  if (u.sign !== 'off') neonText(g, e, u.name, tx, ty, 2, glowCol, u.tubeDark);
  else neonText(g, null, u.name, tx, ty, 2, tone(u.tubeDark, 1.3), u.tubeDark);
}

/** 주인공 세로 간판 JAZZ: 검은 판, 테두리 관(분홍), 굵은 청록 관 글씨 (하얀 심), 위아래 별 */
function paintBladeSign(f: Frame, u: (typeof UNDER_SHOPS)[number]): void {
  const { g, e, w, h } = f;
  rect(g, 0, 0, w, h, '#14181c');
  rect(g, 0, 0, w, 1, '#3a4248');
  // 테두리 관 (분홍, 한 단계 어둡게)
  for (const [x, y, ww, hh] of [[1, 2, w - 2, 1], [1, h - 3, w - 2, 1], [1, 2, 1, h - 4], [w - 2, 2, 1, h - 4]] as const) glowRect(g, e, x, y, ww, hh, '#6e2a4e', '#b42d86');
  const s = 3;
  const tx = Math.round((w - 3 * s) / 2);
  neonText(g, e, u.name, tx, 8, s, '#c8f6ff', '#1f5560', true);
  glowRect(g, e, Math.round(w / 2) - 1, 4, 2, 2, '#ffd6ee', '#ff6fc3');
  glowRect(g, e, Math.round(w / 2) - 1, h - 6, 2, 2, '#ffd6ee', '#ff6fc3');
}

/** 줄무늬 천 차양 앞 테 (물결 끝, 위는 빛 받는 쇠틀) */
function paintAwningFront(f: Frame, color: string): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h - 2, color);
  for (let i = 0; i < w; i += 8) rect(g, i, 0, 4, h - 2, '#a89c84');
  for (let i = 0; i < w; i += 8) {
    rect(g, i + 1, h - 2, 6, 2, color);
    rect(g, i + 2, h - 2, 2, 2, '#a89c84');
  }
  rect(g, 0, 0, w, 1, '#6a6460');
  for (let x = 0; x < w; x++) for (let y = 1; y < h - 2; y++) if (vnoise(x, y, 4, w) > 0.7) px(g, x, y, tone(x % 8 < 4 ? '#a89c84' : color, 0.82));
}

/** 선로 기둥 앞면: H형 강 (밝은 날개 둘, 가운데 어두운 몸판), 리벳 줄, 녹물, 아래 받침판 */
function paintRailLeg(f: Frame): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h, '#2c3834');
  rect(g, 0, 0, 3, h, '#3e4c46');
  rect(g, w - 3, 0, 3, h, '#36423e');
  rect(g, 4, 0, w - 8, h, '#222c28');
  for (let y = 4; y < h; y += 5) {
    px(g, 1, y, '#5a6c64');
    px(g, w - 2, y, '#4e5e58');
  }
  for (let k = 0; k < 5; k++) drip(g, 4 + Math.floor(hash(k * 7 + w) * (w - 8)), Math.floor(hash(k * 3) * h * 0.6), 10 + Math.floor(hash(k * 5) * 30), 1, '#3e2a22', k * 31);
}

/** 뒤 사무 건물 (실루엣 판, 깊이 -300): 콘크리트 격자 (층 약 82px), 켜진 창 몇, 옥상 물탱크와 안테나 */
function paintOfficeTower(f: Frame): void {
  const { g, e, w, h, X, Y, S } = f;
  const top = Y(340);
  rect(g, 0, top, w, h - top, '#3a3e42');
  for (let x = 0; x < w; x += S(18)) rect(g, x, top, 2, h - top, '#46494e');
  for (let hh = 0, fl = 0; hh < 330; hh += 82, fl++) {
    rect(g, 0, Y(hh + 82) , w, 2, '#4a4e54');
    for (let x = S(6), k = 0; x < w - S(12); x += S(18), k++) {
      const y = Y(hh + 60);
      const ww = S(12);
      const wh = Y(hh + 30) - y;
      const r = hash(fl * 31 + k * 7 + 5);
      if (r < 0.22) roomWall(g, e, x, y, ww, wh, [[x + ww / 2, y + 2, ww, wh, 0.75]], 0.18, r < 0.06 ? FLUO : WARM, 3);
      else if (r < 0.3) roomWall(g, e, x, y, ww, wh, [[x + ww * 0.3, y + wh - 3, ww * 0.7, wh * 0.7, 0.8]], 0.05, TV, 3);
      else rect(g, x, y, ww, wh, '#1a1c20');
    }
  }
  rect(g, 0, top, w, 2, '#5a5e64');
  // 옥상 물탱크 (다리와 원뿔 지붕)
  const tx0 = X(90);
  const tx1 = X(126);
  for (const lx of [tx0 + 2, tx1 - 4]) rect(g, lx, Y(366), 2, Y(340) - Y(366), '#24262a');
  for (let x = tx0; x < tx1; x++) rect(g, x, Y(398), 1, Y(366) - Y(398), tone('#34302c', cylK((x - tx0) / (tx1 - tx0 - 1))));
  for (let k = 0; k < S(10); k++) {
    const inset = Math.round((k * (tx1 - tx0)) / 2 / S(10));
    rect(g, tx0 + inset, Y(398) - S(10) + k, tx1 - tx0 - inset * 2, 1, '#2a2826');
  }
  // 안테나
  rect(g, X(70), Y(408), 1, Y(340) - Y(408), '#24262a');
  rect(g, X(66), Y(392), S(9), 1, '#24262a');
  void w;
}

/**
 * 뒤 벽돌 건물 (깊이 -240, 층 약 84px): 붉은 벽돌 (빛 닿는 아래·창 둘레만 결), 층마다 창 다섯 (켜진 창 20~40%: 사람·커튼·TV),
 * 처마 테, 옥상 난간
 */
function paintTenement(f: Frame): void {
  const { g, e, w, h, X, Y, S, sk } = f;
  const T: Bricks = { mortar: '#2a2022', base: '#5a3a34', dark: '#4a302c', light: '#6a463e', flat: '#4a3430' };
  masonry(g, 0, 0, w, h, 113, T, (_x, y) => ((h - y) / sk > 176 && (h - y) / sk < 240 ? 0.6 : 0.2));
  let n = 0;
  for (let hh = 96, fl = 0; hh < 380; hh += 84, fl++) {
    rect(g, 0, Y(hh - 6), w, 2, '#4e4844');
    for (let k = 0; k < 5; k++) {
      const x = X(14 + k * 36);
      const y = Y(hh + 52);
      const ww = S(18);
      const wh = Y(hh + 8) - y;
      const r = hash(fl * 17 + k * 5 + 3);
      rect(g, x - 2, y - 3, ww + 4, 3, '#5e5650');
      rect(g, x - 2, y + wh, ww + 4, 2, '#6a625a');
      if (r < 0.26 || (fl === 2 && k === 3)) {
        n++;
        roomWall(g, e, x, y, ww, wh, [[x + ww * 0.5, y + 4, ww * 0.9, wh, 0.8]], 0.2, WARM, 4);
        if (n % 2) figure(g, e, x + Math.round(ww * 0.6), y + wh, Math.round(wh * 0.75), 'bare');
        else sil(g, e, x, y, 5, wh, '#3e2a1f');
      } else if (r < 0.36) roomWall(g, e, x, y, ww, wh, [[x + ww * 0.3, y + wh - 3, ww * 0.7, wh * 0.7, 0.85]], 0.05, TV, 4);
      else {
        rect(g, x, y, ww, wh, '#1c1a1e');
        rect(g, x + 2, y + 2, 1, wh - 6, '#2a3034');
      }
      sil(g, e, x + Math.floor(ww / 2), y, 1, wh, '#36323a');
    }
  }
  rect(g, 0, 0, w, S(8), '#3e3836');
  rect(g, 0, S(8), w, 1, '#6a625a');
}

/** 옥상 광고판 (실루엣 판): 쇠틀 다리와 점검 통로, 빛 바랜 판 'STAY INSIDE' (벗겨진 종이), 투광등 팔 둘 */
const BILLBOARD = { text: 'STAY INSIDE', x: 5112, y: 432 };
function paintBillboard(f: Frame): void {
  const { g, w, X, Y, S } = f;
  const steel = '#26282c';
  // 다리와 가새
  for (let x = X(8); x < w - S(8); x += S(34)) {
    rect(g, x, Y(18), 2, Y(0) - Y(18), steel);
    seg(g, x, Y(1), x + S(17), Y(17), 1, steel);
  }
  rect(g, 0, Y(18), w, 2, steel);
  // 판: 빛 바랜 종이 (가장자리가 벗겨지고 아래 판자가 보인다)
  const b0 = Y(64);
  const b1 = Y(20);
  rect(g, X(4), b0, w - X(4) * 2, b1 - b0, '#7e7a6c');
  for (let y = b0; y < b1; y++) for (let x = X(4); x < w - X(4); x++) {
    const n = vnoise(x, y, 11, 5);
    if (n > 0.78) px(g, x, y, '#625a4c');
    else if (n < 0.18) px(g, x, y, '#8a8676');
  }
  rect(g, X(4), b0, w - X(4) * 2, 2, '#4a4844');
  rect(g, X(4), b1 - 3, w - X(4) * 2, 3, '#3e3a36');
  // 붉은 띠와 글씨
  rect(g, X(4), Y(28), w - X(4) * 2, S(4), '#7a2e2a');
  strokeText(g, BILLBOARD.text, X(BILLBOARD.x - 5084), Y(BILLBOARD.y - 392) - 10, 2, 1, '#241c1c', 0.04, 3);
  // 투광등 팔
  for (const ax of [5118, 5202]) {
    seg(g, X(ax - 5084), Y(10), X(ax - 5084), Y(4), 1, steel);
  }
}

// ---------------------------------------------------------------- 성벽 그림
/** 장벽 스텐실 글씨 (철문의 1은 문짝에 따로 칠했다) */
const WALL_SIGN = { text: 'DISTRICT', x: 5692, y: 198, s: 6 };

/**
 * 50m 성벽 앞면 (깊이 -190): 거푸집 한 단(64px)마다 조금 다른 회색과 큰 덩어리 얼룩, 이음 줄(위 단 밑이 튀어나와 아래가 어둡다),
 * 폼타이 구멍과 녹물, 통로 배수구 아래 물때, 신축 이음, 지운 낙서, 회랑의 좁은 창, 스텐실 DISTRICT, 늘어진 붉은 깃발 둘(주름과 별),
 * 큰 철문 (사선 경고 띠, 사람 드나드는 문), 버팀벽 둘레 그늘 (땅 가까이)
 */
function paintWallFace(f: Frame): void {
  const { g, e, w, h, sk } = f;
  const x0 = WALL.face[0];
  const X = (x: number) => Math.round((x - x0) * sk);
  const Y = (hh: number) => h - Math.round(hh * sk);
  paintConcreteTiers(f, x0, 7);
  // 통로 배수구 아래 물때 (짙은 세로 띠, 아래로 옅어진다)
  for (let k = 0; k < 9; k++) {
    const sx = X(5600 + Math.floor(hash(k * 31 + 5) * 760));
    const len = Math.round((120 + hash(k * 7) * 160) * sk);
    const sw = 2 + Math.floor(hash(k * 3) * 4);
    for (let d = 0; d < len; d++) {
      const t = d / len;
      const ww = Math.max(1, Math.round(sw * (1 - t * 0.7)));
      if (t > 0.6 && vnoise(k * 7, d, 5, 3) < (t - 0.6) * 2) continue;
      rect(g, sx + Math.round(Math.sin(d * 0.05 + k) * 1.2), Y(WALL.catwalk - 10) + d, ww, 1, '#30343e');
    }
  }
  // 지운 낙서: 새로 덧칠한 판 (가장자리가 붓질로 들쭉날쭉), 판 밑으로 비치는 낙서 글자 흔적
  const ghosts = ['FREE', 'LIES', 'NO WALL', 'WE SEE'];
  for (let k = 0; k < 5; k++) {
    const gx = X(5600 + Math.floor(hash(k * 23 + 3) * 700));
    const gy = Y(40 + Math.floor(hash(k * 41 + 1) * 150));
    const pw = 46 + Math.floor(hash(k * 3 + 7) * 50);
    const ph = 14 + Math.floor(hash(k * 5 + 3) * 10);
    const col = hash(k * 13) < 0.5 ? '#4a4e58' : '#383c46';
    for (let y = gy; y < gy + ph; y++) {
      const ja = Math.floor(hash(y * 7 + k) * 4);
      const jb = Math.floor(hash(y * 11 + k) * 4);
      rect(g, gx + ja, y, pw - ja - jb, 1, col);
    }
    strokeText(g, ghosts[k % ghosts.length], gx + 6, gy + Math.floor(ph / 2) - 4, 2, 1, tone(col, 0.9), 0.35, k * 7);
  }
  // 회랑의 좁은 창 (가로 줄 셋): 대부분 어둡고 몇 개만 불
  for (const hh of [340, 470, 590]) {
    for (let x = 18, k = 0; x < w - 6; x += Math.round(46 * sk) + (k % 3) * 2, k++) {
      const r = hash(x * 11 + hh);
      const lit = r < 0.2;
      const cold = r < 0.07;
      rect(g, x, Y(hh), 3, Math.round(12 * sk), lit ? (cold ? '#c9f7f5' : C.windowLight) : '#14151a');
      if (lit) rect(e, x, Y(hh), 3, Math.round(12 * sk), cold ? '#55c8cc' : '#d4792c');
      rect(g, x - 1, Y(hh) + Math.round(12 * sk), 5, 1, '#5a5e68');
    }
  }
  // 버팀벽 둘레 그늘 (땅 가까이 덩어리째)
  for (const bx of WALL.buttress) {
    for (const [a, b] of [[bx - 10, bx], [bx + 36, bx + 46]] as const) {
      for (let x = X(a); x < X(b); x++) {
        const t = a < bx ? (x - X(a)) / (X(b) - X(a)) : 1 - (x - X(a)) / (X(b) - X(a));
        const top = Y(140) + Math.round((1 - t) * 60 + vnoise(x, 0, 6, bx) * 16);
        for (let y = top; y < h; y++) px(g, x, y, t > 0.55 ? '#262a32' : '#2e323a');
      }
    }
  }
  // 막사 뒤 벽 아래 그늘 (막사가 벽과 갈라지게)
  for (let x = X(WALL.barracks[0] - 20); x < X(WALL.barracks[1] + 20); x++) {
    const top = Y(118) + Math.round(vnoise(x, 0, 7, 41) * 10);
    for (let y = top; y < h; y++) px(g, x, y, y < top + 8 ? '#2c3038' : '#24272e');
  }
  // 스텐실 글씨 (선 글씨, 페인트가 군데군데 벗겨졌다)
  strokeText(g, WALL_SIGN.text, X(WALL_SIGN.x), Y(WALL_SIGN.y) - 5 * WALL_SIGN.s, WALL_SIGN.s, 3, '#a2a6b0', 0.08, 41);
  // 위에서 늘어진 붉은 깃발 둘: 주름 (밝은 면·바탕·그늘이 천천히 바뀐다), 아래 술, 금빛 별
  for (const bx of [5880, 6060]) {
    const x = X(bx);
    const bw = Math.round(54 * sk);
    const bottom = Y(250);
    for (let i = 0; i < bw; i++) {
      const fold = Math.sin((i / bw) * Math.PI * 5 + 0.6);
      const c = fold > 0.55 ? '#8a3a32' : fold > -0.35 ? '#6e2e2a' : '#4c2220';
      rect(g, x + i, 0, 1, bottom, c);
    }
    for (let i = 0; i < bw; i += 4) rect(g, x + i + 1, bottom, 2, 4 + (i % 8 ? 0 : 2), '#4c2220');
    rect(g, x, bottom - 6, bw, 2, '#a07a3a');
    paintStar(g, x + Math.round(bw / 2), bottom - Math.round(56 * sk), Math.round(15 * sk), '#a07a3a');
  }
  // 큰 철문: 두꺼운 콘크리트 테, 가로 골 진 강철 문 두 짝, 위아래 사선 경고 띠, 가운데 이음, 사람 드나드는 문 (창에 불), 문짝의 1
  const gx0 = X(WALL.gate[0]);
  const gx1 = X(WALL.gate[1]);
  const gTop = Y(236);
  rect(g, gx0 - 10, gTop - 14, gx1 - gx0 + 20, h - gTop + 14, '#3a3e48');
  rect(g, gx0 - 10, gTop - 14, gx1 - gx0 + 20, 2, '#5a5e68');
  rect(g, gx0, gTop, gx1 - gx0, h - gTop, '#28384a');
  for (let y = gTop + 3; y < h; y += 5) rect(g, gx0, y, gx1 - gx0, 2, '#1e2c3a');
  for (let x = gx0 + 4; x < gx1; x += 12) for (let y = gTop + 6; y < h; y += 24) px(g, x, y, '#5c7690');
  const mid = Math.round((gx0 + gx1) / 2);
  rect(g, mid - 1, gTop, 2, h - gTop, '#0e141c');
  for (const by of [gTop, h - 22]) {
    for (let y = by; y < by + 8; y++) for (let x = gx0; x < gx1; x++) px(g, x, y, (x + y) % 12 < 6 ? '#c8a440' : '#1c1c22');
  }
  const dx = mid + 16;
  rect(g, dx, h - 72, 22, 50, '#1c2836');
  roomWall(g, e, dx + 5, h - 66, 12, 10, [[dx + 11, h - 66, 10, 12, 0.6]], 0.3, WARM, 3);
  strokeText(g, '1', mid - 30, gTop + 30, 8, 4, '#a2a6b0', 0.06, 5);
}

/** 콘크리트 단 바탕 (거푸집 한 단 64px): 단마다 조금 다른 회색, 큰 덩어리 얼룩(세 단계, 경계만 흩어짐), 이음, 폼타이 구멍과 녹물, 신축 이음 */
function paintConcreteTiers(f: Frame, x0: number, seed: number): void {
  const { g, w, h, sk } = f;
  const Y = (hh: number) => h - Math.round(hh * sk);
  const tones = ['#3e434e', '#424752', '#3a3f4a', '#454a55', '#3c414c'];
  for (let k = 0, hh = 0; hh < 640; k++, hh += 64) {
    const c = tones[Math.floor(hash(seed + k * 7) * tones.length)];
    const ya = Math.max(0, Y(hh + 64));
    const yb = Math.min(h, Y(hh));
    for (let y = ya; y < yb; y++) {
      for (let x = 0; x < w; x++) {
        const n = vnoise(x + x0 * sk, y, 22, seed + 3) * 0.7 + vnoise(x + x0 * sk, y, 7, seed + 9) * 0.3;
        px(g, x, y, n > 0.66 ? tone(c, 0.86) : n < 0.3 ? tone(c, 1.08) : c);
      }
    }
  }
  for (let hh = 64; hh < 640; hh += 64) {
    const y = Y(hh);
    if (y < 1 || y >= h - 1) continue;
    rect(g, 0, y, w, 1, '#2a2e36');
    rect(g, 0, y + 1, w, 1, '#333740');
    rect(g, 0, y - 1, w, 1, '#525764');
    for (const fr of [0.33, 0.67]) {
      const yy = Y(hh - 64 * fr);
      for (let x = 6 + ((hh / 64) % 2) * 9; x < w; x += Math.round(24 * sk)) {
        rect(g, x, yy, 2, 2, '#1a1c22');
        const r = hash(seed + x * 3 + yy * 7);
        if (r < 0.3) drip(g, x + 1, yy + 2, 6 + Math.floor(hash(x + yy * 7) * 34), 2, r < 0.12 ? '#4e3a2e' : '#33373f', x * 13 + yy);
      }
    }
  }
  for (let x = Math.round(128 * sk) - ((x0 * sk) % Math.round(128 * sk)); x < w; x += Math.round(128 * sk)) {
    // 버팀벽 바로 뒤 이음은 빼다 (버팀벽 모서리 옆에 1칸 어두운 줄 = 외곽선으로 남는다)
    if (x < 1 || WALL.buttress.some((bx) => x0 + x / sk > bx - 24 && x0 + x / sk < bx + 60)) continue;
    rect(g, x, 0, 2, h, '#30343d');
    rect(g, x + 2, 0, 1, h, '#4f5460');
  }
  // 땅 가까이 튄 물때와 소금기 (덩어리)
  for (let x = 0; x < w; x++) {
    const top = Math.floor(10 + vnoise(x, 0, 9, seed) * 16);
    for (let y = h - top; y < h; y++) px(g, x, y, vnoise(x, y, 5, seed + 1) < 0.5 ? '#30343c' : '#383c46');
  }
}

/** 동쪽 끝 모서리·서쪽 보루 앞면: 콘크리트 단, 총안 창 줄 (main이면 경고 띠) */
function paintWallBlock(f: Frame, seed: number, corner: boolean): void {
  const { g, e, w, h, sk } = f;
  paintConcreteTiers(f, seed * 100, seed);
  const Y = (hh: number) => h - Math.round(hh * sk);
  for (const hh of corner ? [180, 360, 520] : [240, 420, 580]) {
    for (let x = 10; x < w - 8; x += 22) {
      const lit = hash(x * 7 + hh + seed) < 0.25;
      rect(g, x, Y(hh), 3, Math.round(14 * sk), lit ? C.windowLight : '#14151a');
      if (lit) rect(e, x, Y(hh), 3, Math.round(14 * sk), '#ad5a20');
    }
  }
  if (corner) for (let y = Y(18); y < Y(10); y++) for (let x = 0; x < w; x++) px(g, x, y, (x + y) % 12 < 6 ? '#c8a440' : '#1c1c22');
}

/** 모서리 벽 옆면 (서쪽을 보는 좁은 띠): 단 이음과 위아래 명암 */
function paintCornerSide(f: Frame): void {
  const { g, w, h, sk } = f;
  for (let y = 0; y < h; y++) rect(g, 0, y, w, 1, (h - y) / sk < 120 ? '#3c414c' : '#353a44');
  for (let hh = 64; hh < 640; hh += 64) rect(g, 0, h - Math.round(hh * sk), w, 1, '#2a2e36');
}

/** 버팀벽 앞면: 단 이음, 땅 가까이 물때, 위로 갈수록 그을음, 투광등이 비추는 아래쪽이 조금 밝다 */
function paintButtress(f: Frame, seed: number): void {
  const { g, w, h, sk } = f;
  for (let y = 0; y < h; y++) {
    const hh = (h - y) / sk;
    for (let x = 0; x < w; x++) {
      const n = vnoise(x, y, 9, seed);
      px(g, x, y, hh < 160 ? (n > 0.6 ? '#4a4f5a' : '#525764') : n > 0.6 ? '#3a3f4a' : '#42474f');
    }
  }
  for (let hh = 64; hh < 640; hh += 64) {
    const y = h - Math.round(hh * sk);
    rect(g, 0, y, w, 1, '#2e323a');
    rect(g, 0, y - 1, w, 1, '#5a5f6a');
  }
  for (let k = 0; k < 10; k++) drip(g, 3 + Math.floor(hash(seed + k * 7) * (w - 6)), Math.floor(hash(seed + k * 13) * h * 0.8), 10 + Math.floor(hash(k + seed) * 40), 2, '#30343c', seed + k);
}

/** 벽면 초소 앞면: 콘크리트 함, 총안 창 줄 (몇 칸만 불, 하나는 사람 그림자) */
function paintPostFront(f: Frame): void {
  const { g, e, w, h } = f;
  rect(g, 0, 0, w, h, '#4a4f5a');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 6, w) > 0.68) px(g, x, y, '#42464f');
  rect(g, 0, h - 3, w, 3, '#3a3e48');
  const cnt = Math.floor((w - 8) / 10);
  for (let k = 0; k < cnt; k++) {
    const x = 6 + k * 10;
    const lit = hash(w * 7 + k * 7) < 0.6;
    if (lit) {
      glowRect(g, e, x, 14, 6, 8, '#d8a85e', '#ad5a20');
      if (k === 1) sil(g, e, x + 2, 15, 2, 7, '#1c1410');
    } else rect(g, x, 14, 6, 8, '#121318');
    rect(g, x - 1, 22, 8, 1, '#6a707c');
  }
}

/** 별 문장 (가운데, 반지름 r): 다섯 꼭지 별을 실제 크기로 칠한다 (작은 별을 키워 찍지 않는다) */
function paintStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  const pts: Array<[number, number]> = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.42 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) px(g, x, y, color);
    }
  }
}

/** 막사 앞면: 밝은 콘크리트 2층 (성벽보다 두 단계 밝게), 층 띠, 창 줄 (몇 개만 불, 경비 실루엣), 문 */
function paintBarracks(f: Frame): void {
  const { g, e, w, h } = f;
  rect(g, 0, 0, w, h, '#7a7468');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = vnoise(x, y, 8, 77);
    if (n > 0.66) px(g, x, y, '#6e685e');
    else if (n < 0.22) px(g, x, y, '#847e72');
  }
  rect(g, 0, Math.round(h / 2) - 1, w, 3, '#5e5a52');
  rect(g, 0, Math.round(h / 2) - 1, w, 1, '#948e82');
  for (let k = 0; k < w / 9; k++) drip(g, Math.floor(hash(k * 13 + 5) * w), Math.floor(hash(k * 7) * h * 0.4), 4 + Math.floor(hash(k) * 12), 1, '#5e5a52', k);
  let i = 0;
  for (const row of [Math.round(h * 0.14), Math.round(h * 0.6)]) {
    for (let x = 10, k = 0; x < w - 24; x += 28 + (k % 3) * 3, k++, i++) {
      const r = hash(i * 11 + 5);
      const ww = 16;
      const wh = Math.round(h * 0.24);
      if (r < 0.34) {
        roomWall(g, e, x, row, ww, wh, [[x + 8, row + 2, 12, wh, 0.75]], 0.22, r < 0.1 ? FLUO : WARM, 4);
        if (r < 0.15) figure(g, e, x + 8, row + wh + 8, 22, 'guard');
      } else {
        rect(g, x, row, ww, wh, '#1c1d22');
        rect(g, x + 2, row + 2, 1, wh - 5, '#2e323a');
      }
      rect(g, x - 1, row + wh, ww + 2, 2, '#948e82');
    }
  }
  const dx = Math.round(w * 0.62);
  rect(g, dx - 1, h - Math.round(h * 0.4), 18, Math.round(h * 0.4), '#3a3a3e');
  rect(g, dx, h - Math.round(h * 0.38), 16, Math.round(h * 0.38), '#1c2836');
  roomWall(g, e, dx + 3, h - Math.round(h * 0.34), 10, 8, [[dx + 8, h - Math.round(h * 0.34), 8, 10, 0.6]], 0.2, FLUO, 3);
}

/** 초소·감시탑 오두막: 판자 벽, 큰 창 (불 켜진 안에 경비 실루엣), 창 아래 사선 경고 띠 */
function paintCabin(f: Frame, seed: number): void {
  const { g, e, w, h } = f;
  rect(g, 0, 0, w, h, '#5a4638');
  for (let y = 0; y < h; y += 4) rect(g, 0, y, w, 1, '#4a3a2e');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (vnoise(x, y, 5, seed) > 0.7) px(g, x, y, '#4e3c30');
  const wy = 8;
  const wh = Math.min(16, h - 16);
  roomWall(g, e, 6, wy, w - 12, wh, [[w / 2, wy + 2, w * 0.4, wh + 4, 0.8]], 0.25, WARM, 6);
  figure(g, e, Math.round(w * (0.3 + hash(seed) * 0.4)), wy + wh + 10, 26, 'guard');
  for (let x = 6 + Math.round((w - 12) / 3); x < w - 8; x += Math.round((w - 12) / 3)) sil(g, e, x, wy, 1, wh, C.iron);
  rect(g, 4, wy + wh, w - 8, 2, '#7a6a5a');
  rect(g, 0, 0, w, 2, '#2a2c32');
  for (let y = h - 7; y < h - 3; y++) for (let x = 0; x < w; x++) px(g, x, y, (x + y) % 8 < 4 ? '#c8a440' : '#2a2620');
}

/** 모래주머니 벽: 엇갈려 쌓은 둥근 자루 (윗면이 밝고 아래 그늘), 젖은 아래쪽 */
function paintSandbags(f: Frame): void {
  const { g, w, h } = f;
  rect(g, 0, 0, w, h, '#4a4234');
  for (let row = 0, y = 0; y < h; row++, y += 6) {
    for (let x = row % 2 ? -6 : 0; x < w; x += 12) {
      rect(g, x + 1, y, 10, 1, '#6e6450');
      rect(g, x + 1, y + 1, 10, 3, '#5a5040');
      rect(g, x + 1, y + 4, 10, 1, '#3e3628');
      rect(g, x, y + 5, 12, 1, '#2a241c');
    }
  }
  rect(g, 0, h - 3, w, 3, '#2e281e');
}

/** 철조망 (실루엣 판): 감긴 쇠 고리가 겹친다. 빛 받는 위쪽은 밝고 아래는 어둡게, 고리 사이는 비어 있다 */
function paintWireCoil(f: Frame): void {
  const { g, w, h } = f;
  for (let x = 0; x < w; x++) {
    const t = (x % 7) / 7;
    const y = Math.round((h - 1) / 2 + Math.sin(t * Math.PI * 2) * ((h - 1) / 2));
    rect(g, x, y, 1, 1, y < h / 2 ? '#7a808a' : '#3e424c');
    if (x % 7 === 3) rect(g, x, 0, 1, h, '#4a4e58');
  }
}

/** 선로 기둥 바닥 그림자 (w × d, 위에서 본 바닥 판): 기둥 밑에서 앞(카메라 쪽)으로 퍼지는 짙은 쐐기, 가장자리는 칸 계단 */
function paintPillarShadow(w: number, d: number): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  for (let y = 0; y < d; y++) {
    const t = y / (d - 1);
    const half = Math.round(6 + t * (w / 2 - 8));
    rect(g, Math.floor(w / 2) - half, y, half * 2, 1, t < 0.6 ? '#05080a' : '#0a0f14');
  }
  return c;
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
      glowRect(g, e, wx, 12, 10, 11, '#93a596', '#338c66');
      glowRect(g, e, wx, 12, 10, 2, '#e8fff8', '#c9f7f5');
      const r = hash(c * 31 + k * 7 + 3);
      if (r < 0.55) {
        const pxx = wx + 2 + Math.floor(hash(c * 13 + k) * 5);
        sil(g, e, pxx, 16, 3, 3);
        sil(g, e, pxx - 2, 19, 7, 4);
        if (r < 0.25) sil(g, e, pxx + 3, 12, 1, 5);
      }
      sil(g, e, wx - 1, 12, 1, 11, '#2a2d36');
    }
    for (const bx of [8, W - 28]) {
      sil(g, e, x0 + bx, 41, 20, 3, C.iron);
      for (const wx of [bx + 4, bx + 15]) {
        rect(g, x0 + wx - 3, 43, 7, 7, C.iron);
        rect(g, x0 + wx - 1, 45, 3, 3, C.chromeDark);
      }
    }
    if (c < TRAIN.cars - 1) rect(g, x0 + W, 20, TRAIN.gap, 14, C.iron);
  }
  const front = dir > 0 ? L - 1 : 0;
  const fx = (dx: number, w: number) => (dir > 0 ? front - dx - w + 1 : front + dx);
  glowRect(g, e, fx(3, 14), 9, 14, 6, C.windowLit, C.neonAmber);
  drawText(g, 'LOOP', fx(4, 13), 10, C.lampGlow, 1);
  drawText(e, 'LOOP', fx(4, 13), 10, C.lampCore, 1);
  for (const dy of [33, 36]) glowRect(g, e, fx(1, 3), dy, 3, 2, C.lampCore, C.lampCore);
  const back = dir > 0 ? 0 : L - 3;
  glowRect(g, e, back, 34, 3, 3, C.neonRed, C.neonRed);
  return { map, glow };
}
