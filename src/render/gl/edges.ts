import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { PARK_GATE_W } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { canvas, disc, ditherRect, hash, paint, rect } from '../dither';
import { box, Details, facedBox, plane } from './kit';
import { figure, sil } from './rooms';
import { hazeMaterial, litMaterial, pixelTexture } from './shaders';
import { paintNoise } from './tex';

/**
 * 해안 부두와 시타델 공원 (렌더 전용, 무너지지 않는다).
 * - 부두: 컨테이너 더미(구조물: 윗면이 발판, 양옆이 벽), 방파제 철제 난간(너머로 바다), 볼라드와 밧줄, 나무 상자.
 *   등대는 무너지는 큰 물건이라 bigprops.ts가 그린다.
 * - 공원: 뒤쪽 산울타리, 키 큰 나무, 동쪽 철책과 문기둥(구조물 벽). 그 너머로 고가 철도 밑 거리가 이어진다.
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

  /** 컨테이너 더미 (구조물: 윗면이 발판, 양옆이 벽. 전차 선로 서쪽 끝을 가린다) */
  private containers(): void {
    const CT = D.pier.containers;
    const colors = [C.rust, C.paintTeal, C.paintOchre, C.brickRed];
    for (let r = 0; r < CT.rows; r++) {
      const col = colors[r % colors.length];
      // 단마다 조금씩 엇갈려 쌓였지만, 발판·벽이 있는 자리(x0~x1)를 넘지 않는다
      const x0 = CT.x0 + (r % 2 ? 3 : 0);
      const x1 = CT.x1 - (r % 2 ? 0 : 3);
      const y = r * CT.rowH;
      const tex = litMaterial(pixelTexture(paintContainer(x1 - x0, CT.rowH, col, r)));
      const end = litMaterial(pixelTexture(paintContainer(60, CT.rowH, col, r + 7)), { tint: 0.75 });
      this.group.add(facedBox(x0, x1, y, y + CT.rowH, -110, -0.6, { nx: end, px: end, py: end, pz: tex }));
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
    // 젖은 난간: 위 가로대 윗면에 물기 반짝임, 가로대에 맺혀 떨어지는 물방울 (간격 제각각)
    det.add(R.x0, R.x1, R.h - 0.5, R.h, -43, -39, C.chrome);
    det.add(R.x0, R.x1, 3.5, 4, -46, -36, C.paintCream);
    for (let x = R.x0 + 5, k = 0; x < R.x1 - 2; x += 9 + Math.floor(hash(k * 17 + 3) * 13), k++) det.add(x, x + 1, R.h - 4, R.h - 2, -42, -41, C.skyLight);
  }

  /** 시타델 공원: 뒤쪽 산울타리, 키 큰 나무 (줄기는 상자, 잎은 빛을 받는 그림 판 두 겹) */
  private park(det: Details): void {
    const P = D.park;
    const x0 = D.sections.find((s) => s.id === 'park')!.x0;
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
    // 공원 바닥에 깔린 안개 (가로등 빛을 받아 밝아진다)
    const mistTex = pixelTexture(paintNoise(64, 31, 3, 3));
    mistTex.wrapS = THREE.RepeatWrapping;
    mistTex.wrapT = THREE.RepeatWrapping;
    mistTex.magFilter = THREE.LinearFilter;
    mistTex.minFilter = THREE.LinearFilter;
    const mist = hazeMaterial(mistTex, '#2a3e3a', 0.5, 0.5, true);
    mist.transparent = false;
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 120, 46), mist);
    mm.position.set((x0 + x1) / 2, 18, -34);
    mm.renderOrder = 1;
    this.group.add(mm);
    // 벤치에 웅크려 잠든 사람, 가로등 아래 우산 쓴 사람 (실루엣)
    const [pc, pg] = canvas(40, 60);
    const [, pe] = canvas(40, 60);
    sil(pg, pe, 4, 44, 26, 6, C.iron);
    sil(pg, pe, 26, 40, 8, 7, C.iron);
    sil(pg, pe, 2, 48, 6, 4, C.iron);
    this.group.add(plane(P.benches[1] + 2, P.benches[1] + 42, 6, 66, -33, litMaterial(pixelTexture(pc), { side: THREE.DoubleSide })));
    const [uc, ug] = canvas(30, 64);
    const [, ue] = canvas(30, 64);
    figure(ug, ue, 15, 64, 46, 'walk');
    for (let k = 0; k < 7; k++) sil(ug, ue, 15 - (13 - k * 2), 10 + k, (13 - k * 2) * 2, 1, C.iron);
    sil(ug, ue, 14, 16, 1, 14, C.iron);
    this.group.add(plane(P.benches[2] - 40, P.benches[2] - 10, 0, 64, -30, litMaterial(pixelTexture(uc), { side: THREE.DoubleSide })));
    for (const x of P.benches) {
      det.add(x, x + 36, 10, 13, -38, -30, C.awningStripe);
      det.add(x, x + 36, 19, 22, -39, -37, C.awningStripe);
      det.add(x + 2, x + 4, 0, 22, -38, -36, C.iron);
      det.add(x + 32, x + 34, 0, 22, -38, -36, C.iron);
      det.add(x + 2, x + 4, 0, 10, -32, -30, C.iron);
      det.add(x + 32, x + 34, 0, 10, -32, -30, C.iron);
    }
  }

  /** 공원 동쪽 철책 문기둥(구조물 벽)과 그 너머 짧은 철책 (공원이 끝나는 곳까지) */
  private fence(det: Details): void {
    const FN = D.park.fence;
    const end = D.sections.find((s) => s.id === 'park')!.x1;
    det.add(FN.x0, end, 0, 14, -100, -40, C.stoneDark);
    det.add(FN.x0, end, 13, 14, -100, -40, C.stone);
    for (let x = FN.x0 + PARK_GATE_W + 2; x < end; x += 5) {
      det.add(x, x + 2, 14, FN.h, -44, -42, C.iron);
      det.add(x - 1, x + 3, FN.h, FN.h + 3, -44.5, -41.5, C.ironLight);
    }
    det.add(FN.x0 + PARK_GATE_W, end, FN.h - 16, FN.h - 14, -44.5, -41.5, C.iron);
    det.add(FN.x0 + PARK_GATE_W, end, 38, 40, -44.5, -41.5, C.iron);
    this.group.add(box(FN.x0, FN.x0 + PARK_GATE_W, 0, FN.h + 10, -30, -0.6, litMaterial(pixelTexture(paintPillar(PARK_GATE_W, FN.h + 10)))));
  }
}

/** 컨테이너 옆면: 골판 줄, 문 잠금 막대, 녹과 그을음 */
export function paintContainer(w: number, h: number, color: string, seed: number): HTMLCanvasElement {
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

/**
 * 나무 잎 덩어리: 작은 잎 뭉치 여럿이 겹친 둥근 수관. 뭉치마다 위·왼쪽(빛 쪽)이 밝고 아래가 어두운 서너 단계 명암,
 * 가장자리는 잎 모양으로 들쭉날쭉하다 (점무늬 디더링 원을 쓰지 않는다). back이면 뒤 겹이라 더 어둡고 뭉치가 적다
 */
function paintCanopy(size: number, r: number, seed: number, back: boolean): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const n = back ? 9 : 16;
  const clumps: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i * 7) * Math.PI * 2;
    const d = Math.sqrt(hash(seed + i * 13)) * 0.62;
    clumps.push([cx + Math.cos(a) * d * r, cy + Math.sin(a) * d * r * 0.78 - r * 0.08, r * (0.3 + hash(seed + i * 3) * 0.2)]);
  }
  clumps.sort((p, q) => q[1] - p[1]);
  const tones = back ? [C.night, '#0c1418', '#121c20', '#16222a'] : ['#0e1614', '#16241f', '#22362c', '#2f4a3a', '#4a6a50'];
  paint(g, 0, 0, size, size, (x, y) => {
    // 위에 그린 (y가 작은) 뭉치가 앞: 마지막으로 덮는 뭉치의 명암을 쓴다
    let tone = -1;
    for (const [px, py, rad] of clumps) {
      const jag = (hash(x * 7 + y * 13 + seed) - 0.5) * 0.28;
      const d = Math.hypot(x + 0.5 - px, y + 0.5 - py) / rad + jag;
      if (d > 1) continue;
      const ly = (y + 0.5 - py) / rad;
      const lx = (x + 0.5 - px) / rad;
      const light = -ly * 0.7 - lx * 0.3 + (1 - d) * 0.25 - (y / size) * 0.5;
      const k = Math.max(0, Math.min(tones.length - 1, Math.floor((light + 0.75) * (tones.length / 1.6))));
      tone = k;
    }
    return tone < 0 ? null : tones[tone];
  });
  // 잎 사이 틈 몇 개 (뒤가 비친다)와 빛 쪽 잎 끝 반짝임
  if (!back) {
    for (let k = 0; k < 10; k++) rect(g, Math.floor(cx + (hash(seed + k * 31) - 0.5) * r * 1.2), Math.floor(cy + (hash(seed + k * 37) - 0.5) * r), 1, 1, C.night);
    for (let k = 0; k < 12; k++) rect(g, Math.floor(cx + (hash(seed + k) - 0.5) * r * 1.4), Math.floor(cy - r * 0.2 + (hash(seed + k * 7) - 0.5) * r * 0.8), 1, 1, C.carMint);
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
