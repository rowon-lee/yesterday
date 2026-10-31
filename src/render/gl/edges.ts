import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { MAP_W } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, disc, ditherRect, hash, rect } from '../dither';
import { Beam } from './fx';
import { box, Details, plane } from './kit';
import { lightPool } from './lights';
import { litMaterial, pixelTexture } from './shaders';

/**
 * 맵 양 끝 구간 (렌더 전용, 무너지지 않는다): 서쪽 해안 부두와 동쪽 시타델 공원.
 * - 부두: 서쪽 끝 컨테이너 더미(벽), 방파제 철제 난간(너머로 바다), 등대(중간 발코니·꼭대기 둘레가 발판, 꼭대기에서 쓸고 지나가는 빛줄기),
 *   볼라드와 밧줄, 나무 상자.
 * - 공원: 뒤쪽 산울타리, 키 큰 나무, 동쪽 끝 철책(벽)과 돌기둥.
 * 올라설 수 있는 등대 둘레는 싸우는 면까지 튀어나오고, 등대 몸통은 그보다 뒤에 둔다.
 */
const H = D.pier.lighthouse;
const HX = H.x + H.w / 2;
const HZ = -26;

export class Edges {
  readonly group = new THREE.Group();
  private readonly beam: Beam;
  private readonly lampAt = new THREE.Vector3(HX, H.h - 11, HZ);

  constructor() {
    const det = new Details();
    this.containers();
    this.railing(det);
    this.lighthouse(det);
    for (const x of D.pier.bollards) {
      det.add(x, x + 8, 0, 12, -34, -26, C.iron);
      det.add(x - 1, x + 9, 11, 14, -35, -25, C.ironLight);
      det.bar(x + 8, 8, x + 22, 2, 1, -30, -29, C.awningStripe);
    }
    this.park(det);
    this.fence(det);
    this.group.add(det.build());
    this.beam = new Beam(380, 30, C.beam, 0.24, 2);
    this.beam.pivot.position.copy(this.lampAt);
    this.group.add(this.beam.pivot);
  }

  /** 서쪽 끝 컨테이너 더미 (캐릭터가 넘지 못하는 벽, 전차 선로 시작을 가린다) */
  private containers(): void {
    const CT = D.pier.containers;
    const colors = [C.rust, C.paintTeal, C.paintOchre, C.brickRed];
    for (let r = 0; r < CT.rows; r++) {
      const col = colors[r % colors.length];
      const x0 = CT.x0 - (r % 2 ? 6 : 0) - 30;
      const y = r * 28;
      const tex = litMaterial(pixelTexture(paintContainer(CT.x1 - x0, 28, col, r)));
      const end = litMaterial(pixelTexture(paintContainer(60, 28, col, r + 7)), { tint: 0.75 });
      this.group.add(box(x0, CT.x1, y, y + 28, -110, -0.6, [end, end, end, end, tex, end]));
    }
  }

  /** 방파제 철제 난간: 돌 턱, 기둥, 위·가운데 가로대 (너머로 바다가 보인다) */
  private railing(det: Details): void {
    const R = D.pier.railing;
    det.add(R.x0, R.x1, 0, 4, -46, -36, C.stoneDark);
    det.add(R.x0, R.x1, 3, 4, -46, -36, C.stone);
    for (let x = R.x0; x < R.x1; x += 16) det.add(x, x + 2, 4, R.h, -42, -40, C.iron);
    det.add(R.x0, R.x1, R.h - 2, R.h, -43, -39, C.ironLight);
    det.add(R.x0, R.x1, 13, 14, -42, -40, C.iron);
  }

  /**
   * 등대: 붉은 띠와 흰 띠가 번갈아 가며 위로 좁아지는 탑, 작은 창과 문, 중간 발코니와 꼭대기 둘레(윗면이 발판, 싸우는 면까지),
   * 쇠 난간, 등실(빛나는 유리), 지붕.
   */
  private lighthouse(det: Details): void {
    const bottomR = H.w / 2;
    const topR = (H.w / 2) * 0.75;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(topR, bottomR, H.gallery, 24, 1, true), litMaterial(pixelTexture(paintLighthouse())));
    tower.position.set(HX, H.gallery / 2, HZ);
    this.group.add(tower);
    // 문과 창
    det.add(HX - 8, HX + 8, 0, 26, HZ + bottomR - 2, HZ + bottomR + 1, C.iron);
    for (let y = 60; y < H.gallery - 20; y += 50) det.add(HX - 3, HX + 3, y, y + 9, HZ + bottomR - 4, HZ + bottomR - 0.5, C.windowDark);
    // 발코니와 꼭대기 둘레: 원판 (앞 끝이 싸우는 면)
    for (const [h, w] of [[H.balcony, H.balconyW], [H.gallery, H.galleryW]] as const) {
      const r = w / 2;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 24), litMaterial(pixelTexture(solidTex(C.iron))));
      ring.scale.z = (-HZ + 2) / r;
      ring.position.set(HX, h - 1.5, HZ);
      this.group.add(ring);
      det.add(HX - r, HX + r, h - 0.6, h, 0, 1.5, C.ironLight);
      // 앞 난간 (싸우는 면 바로 앞)과 받침 까치발
      for (let x = HX - r; x <= HX + r - 1; x += 5) det.add(x, x + 1, h, h + 9, 1, 2, C.iron);
      det.add(HX - r, HX + r, h + 9, h + 10, 1, 2, C.ironLight);
      det.bar(HX - r + 2, h - 3, HX - 14, h - 14, 1, HZ + 4, HZ + 14, C.iron);
      det.bar(HX + r - 2, h - 3, HX + 14, h - 14, 1, HZ + 4, HZ + 14, C.iron);
    }
    // 등실: 빛나는 유리와 쇠 기둥, 지붕
    const lamp = litMaterial(pixelTexture(paintLantern(false)), { emissive: pixelTexture(paintLantern(true)), emissiveStrength: 1.8 });
    const room = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, H.h - H.gallery, 16, 1, false), lamp);
    room.position.set(HX, (H.h + H.gallery) / 2, HZ);
    this.group.add(room);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(14, 10, 16), litMaterial(pixelTexture(solidTex(C.iron))));
    roof.position.set(HX, H.h + 5, HZ);
    this.group.add(roof);
    det.add(HX, HX + 1, H.h + 10, H.h + 17, HZ - 0.5, HZ + 0.5, C.ironLight);
  }

  /** 시타델 공원: 뒤쪽 산울타리, 키 큰 나무 (줄기는 상자, 잎은 빛을 받는 그림 판 두 겹) */
  private park(det: Details): void {
    const P = D.park;
    const x0 = D.sections[4].x0;
    const x1 = P.fence.x0;
    const hedge = litMaterial(pixelTexture(paintHedge(x1 - x0, 24)));
    this.group.add(plane(x0, x1, 0, 24, -44, hedge));
    det.add(x0, x1, 0, 20, -60, -45, C.iron);
    P.trees.forEach((t, i) => {
      const z = -70 - (i % 2) * 14;
      det.add(t.x - 3, t.x + 4, 0, t.h, z - 3, z + 4, C.awning);
      det.add(t.x + 2, t.x + 4, 0, t.h, z + 4, z + 4.5, C.awningStripe);
      det.bar(t.x, t.h - 20, t.x - 16, t.h + 4, 3, z - 1, z + 2, C.awning);
      det.bar(t.x + 1, t.h - 30, t.x + 18, t.h - 6, 3, z - 1, z + 2, C.awning);
      const size = Math.ceil(t.r * 2.4);
      for (const [dz, back] of [[-6, true], [6, false]] as const) {
        const leaf = litMaterial(pixelTexture(paintCanopy(size, t.r, t.x * 7 + (back ? 3 : 0), back)), { side: THREE.DoubleSide });
        const cy = t.h + t.r * 0.6;
        this.group.add(plane(t.x - size / 2, t.x + size / 2, cy - size / 2, cy + size / 2, z + dz, leaf));
      }
    });
    for (const x of P.benches) {
      det.add(x, x + 36, 10, 13, -38, -30, C.awningStripe);
      det.add(x, x + 36, 19, 22, -39, -37, C.awningStripe);
      det.add(x + 2, x + 4, 0, 22, -38, -36, C.iron);
      det.add(x + 32, x + 34, 0, 22, -38, -36, C.iron);
      det.add(x + 2, x + 4, 0, 10, -32, -30, C.iron);
      det.add(x + 32, x + 34, 0, 10, -32, -30, C.iron);
    }
  }

  /** 동쪽 끝 철책 (캐릭터가 넘지 못하는 벽)과 돌기둥 */
  private fence(det: Details): void {
    const FN = D.park.fence;
    det.add(FN.x0, MAP_W + 40, 0, 14, -100, -1, C.stoneDark);
    det.add(FN.x0, MAP_W + 40, 13, 14, -100, -1, C.stone);
    for (let x = FN.x0 + 2; x < MAP_W + 40; x += 5) {
      det.add(x, x + 2, 14, FN.h, -4, -2, C.iron);
      det.add(x - 1, x + 3, FN.h, FN.h + 3, -4.5, -1.5, C.ironLight);
    }
    det.add(FN.x0, MAP_W + 40, FN.h - 16, FN.h - 14, -4.5, -1.5, C.iron);
    det.add(FN.x0, MAP_W + 40, 38, 40, -4.5, -1.5, C.iron);
    this.group.add(box(FN.x0 - 4, FN.x0 + 10, 0, FN.h + 10, -30, -0.6, litMaterial(pixelTexture(paintPillar(14, FN.h + 10)))));
  }

  /** 등대 빛 (등실의 붙박이 빛과 바다 쪽을 쓸고 지나가는 빛줄기) */
  update(tick: number): void {
    this.beam.aim(Math.PI / 2 - 0.35 + 0.55 * Math.sin(tick * 0.02));
    lightPool.add(this.lampAt.x, this.lampAt.y, this.lampAt.z + 20, 80, C.lampGlow, 1.3);
  }
}

function solidTex(color: string): HTMLCanvasElement {
  const [c, g] = canvas(4, 4);
  rect(g, 0, 0, 4, 4, color);
  return c;
}

/** 컨테이너 옆면: 골판 줄, 문 잠금 막대, 녹과 그을음 */
function paintContainer(w: number, h: number, color: string, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, color);
  rect(g, 0, 0, w, 2, C.iron);
  rect(g, 0, h - 1, w, 1, C.smog0);
  for (let x = 3; x < w - 2; x += 4) rect(g, x, 3, 1, h - 5, C.iron);
  rect(g, w - 10, 6, 2, 16, C.iron);
  rect(g, w - 5, 6, 2, 16, C.iron);
  for (let k = 0; k < Math.floor(w / 8); k++) rect(g, Math.floor(hash(seed * 31 + k) * w), Math.floor(hash(seed * 17 + k) * h), 2, 1, C.rust);
  ditherRect(g, 0, 0, w, h, C.smog1, 4);
  return c;
}

/** 등대 몸통: 붉은 띠와 흰 띠 (28px마다), 빛 받는 쪽은 밝게 */
function paintLighthouse(): HTMLCanvasElement {
  const w = 96;
  const [c, g] = canvas(w, H.gallery);
  for (let y = 0; y < H.gallery; y++) {
    const band = Math.floor((H.gallery - y) / 28) % 2 ? C.paintCream : C.posterRed;
    rect(g, 0, y, w, 1, band);
  }
  ditherRect(g, 0, 0, w, H.gallery, C.smog1, 4);
  for (let k = 0; k < 40; k++) rect(g, Math.floor(hash(k * 13) * w), Math.floor(hash(k * 7 + 1) * H.gallery), 1, 3, C.smog3);
  return c;
}

/** 등실 유리: 쇠 기둥 사이로 빛나는 등. glow는 빛나는 부분만 */
function paintLantern(glow: boolean): HTMLCanvasElement {
  const [c, g] = canvas(32, 30);
  rect(g, 0, 0, 32, 30, glow ? '#000' : C.iron);
  rect(g, 0, 2, 32, 26, glow ? C.lampWarm : C.lampWarm);
  rect(g, 12, 6, 8, 12, C.lampCore);
  if (!glow) for (let x = 0; x < 32; x += 8) rect(g, x, 0, 1, 30, C.iron);
  return c;
}

/** 산울타리 (어두운 잎 덩어리와 청록 빛 받은 잎) */
function paintHedge(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 4, w, h - 4, C.iron);
  for (let x = 0; x < w; x += 6) disc(g, x + 3, 5, 5, C.iron);
  ditherRect(g, 0, 0, w, h, C.paintTeal, 3);
  return c;
}

/** 나무 잎 덩어리 (둥근 덩어리 몇 개, 위쪽이 청록 빛을 받는다). back이면 더 어둡게 */
function paintCanopy(size: number, r: number, seed: number, back: boolean): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const blobs = back
    ? [[0, 0.1, 1], [-0.6, 0.3, 0.7], [0.6, 0.3, 0.7]]
    : [[0, 0, 0.85], [-0.5, 0.25, 0.6], [0.5, 0.25, 0.6], [-0.3, -0.45, 0.55], [0.35, -0.4, 0.55]];
  for (const [dx, dy, rr] of blobs) disc(g, cx + dx * r, cy + dy * r, r * rr, back ? C.night : C.iron);
  if (!back) {
    disc(g, cx - r * 0.2, cy - r * 0.25, r * 0.7, C.paintTeal, 6);
    disc(g, cx + r * 0.25, cy - r * 0.45, r * 0.4, C.paintTeal, 9);
    for (let k = 0; k < 12; k++) rect(g, Math.floor(cx + (hash(seed + k) - 0.5) * r * 1.6), Math.floor(cy + (hash(seed + k * 7) - 0.5) * r), 2, 1, C.carMint);
  }
  return c;
}

/** 돌기둥 (철책 끝) */
function paintPillar(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.stone);
  for (let y = 7; y < h; y += 8) rect(g, 0, y, w, 1, C.stoneDark);
  rect(g, 0, 0, 1, h, C.paintCream);
  ditherRect(g, 0, 0, w, h, C.stoneDark, 3);
  return c;
}
