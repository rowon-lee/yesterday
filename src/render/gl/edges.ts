import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { MAP_W } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, disc, ditherRect, hash, rect } from '../dither';
import { box, Details, facedBox, plane } from './kit';
import { litMaterial, pixelTexture } from './shaders';

/**
 * 맵 양 끝 구간 (렌더 전용, 무너지지 않는다): 서쪽 해안 부두와 동쪽 시타델 공원.
 * - 부두: 서쪽 끝 컨테이너 더미(벽, 윗면이 발판), 방파제 철제 난간(너머로 바다), 볼라드와 밧줄, 나무 상자.
 *   등대는 무너지는 큰 물건이라 bigprops.ts가 그린다.
 * - 공원: 뒤쪽 산울타리, 키 큰 나무, 동쪽 끝 철책(벽)과 돌기둥.
 */
export class Edges {
  readonly group = new THREE.Group();

  constructor() {
    const det = new Details();
    this.containers();
    this.railing(det);
    for (const x of D.pier.bollards) {
      det.add(x, x + 8, 0, 12, -34, -26, C.iron);
      det.add(x - 1, x + 9, 11, 14, -35, -25, C.ironLight);
      det.bar(x + 8, 8, x + 22, 2, 1, -30, -29, C.awningStripe);
    }
    this.park(det);
    this.fence(det);
    this.group.add(det.build());
  }

  /** 서쪽 끝 컨테이너 더미 (캐릭터가 넘지 못하는 벽, 전차 선로 시작을 가린다) */
  private containers(): void {
    const CT = D.pier.containers;
    const colors = [C.rust, C.paintTeal, C.paintOchre, C.brickRed];
    for (let r = 0; r < CT.rows; r++) {
      const col = colors[r % colors.length];
      const x0 = CT.x0 - (r % 2 ? 6 : 0) - 30;
      const y = r * CT.rowH;
      const tex = litMaterial(pixelTexture(paintContainer(CT.x1 - x0, CT.rowH, col, r)));
      const end = litMaterial(pixelTexture(paintContainer(60, CT.rowH, col, r + 7)), { tint: 0.75 });
      this.group.add(facedBox(x0, CT.x1, y, y + CT.rowH, -110, -0.6, { px: end, py: end, pz: tex }));
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
