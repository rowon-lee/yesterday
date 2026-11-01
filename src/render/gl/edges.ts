import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { PARK_GATE_W } from '../../stage/citadel';
import { drawText, textWidth } from '../font';
import { COLORS as C } from '../palette';
import { canvas, disc, ditherRect, hash, paint, rect } from '../dither';
import { box, Details, facedBox, plane } from './kit';
import { Sparks } from './fx';
import { lightPool } from './lights';
import { paintPuddle } from './proptex';
import { figure, sil } from './rooms';
import { decalMaterial, hazeMaterial, litMaterial, pixelTexture } from './shaders';
import { paintNoise } from './tex';

/**
 * 해안 부두와 시타델 공원 (렌더 전용, 무너지지 않는다).
 * - 부두: 컨테이너 더미(구조물: 윗면이 발판, 양옆이 벽), 방파제 철제 난간(너머로 바다), 볼라드와 밧줄, 나무 상자.
 *   등대는 무너지는 큰 물건이라 bigprops.ts가 그린다.
 * - 공원: 뒤쪽 산울타리, 키 큰 나무, 동쪽 철책과 문기둥(구조물 벽). 그 너머로 고가 철도 밑 거리가 이어진다.
 */
/** 공원 분수 깊이 (공원 바닥 안개 판보다 앞: 돌 정면이 안개에 묻히지 않게, 싸우는 면보다는 뒤) */
const FOUNTAIN_Z = -30;

export class Edges {
  readonly group = new THREE.Group();
  /** 분수 물방울: 위 그릇 가장자리에서 수반으로 떨어지는 물방울과 수반에 튀는 물보라 */
  private readonly drops = new Sparks(48);

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
    this.fountain(det);
    this.fence(det);
    this.group.add(det.build(), this.drops.mesh);
  }

  /** 이번 틱의 빛과 물방울: 공원 분수 등불 (낡은 등이라 아주 조금 일렁인다), 그릇 가장자리에서 떨어지는 물방울 */
  update(tick: number): void {
    const x = D.park.fountain.x;
    const flicker = 0.93 + 0.07 * Math.sin(tick * 0.21) * Math.sin(tick * 0.057 + 1);
    // 등불 빛 (주황, 나뭇가지·그릇 윗면·벤치까지)과 수반 정면에 고이는 낮은 빛 (돌 정면이 어둠에 묻히지 않게)
    lightPool.add(x, 70, FOUNTAIN_Z + 8, 130, '#f29c40', 1.15 * flicker);
    lightPool.add(x, 26, FOUNTAIN_Z + 24, 70, '#f29c40', 0.35 * flicker);
    this.drops.begin();
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const t = ((tick * 0.7 + i * 4.3 + (side > 0 ? 2 : 0)) % 26) / 26;
        const dx = side * (21 + Math.round(4 * Math.sqrt(t)));
        // 등불 가까이(위)는 따뜻하게, 아래로 갈수록 차가운 물빛
        this.drops.add(x + dx, 45 - t * 29, FOUNTAIN_Z + 12.5, t < 0.4 ? '#ffe2a8' : C.skyLight, 0.55, 1, 2);
      }
      if (((tick >> 2) + (side > 0 ? 1 : 0)) % 3 === 0) this.drops.add(x + side * 25 + (hash(tick + side) > 0.5 ? 1 : -1), 16, FOUNTAIN_Z + 16.5, C.skyLight, 0.6);
    }
    this.drops.end();
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
      const end = litMaterial(pixelTexture(paintContainer(60, CT.rowH, col, r + 7)));
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
    // 산울타리는 분수 자리에서 끊긴다 (분수가 빈터에 선다)
    const fx = P.fountain.x;
    for (const [a, b] of [[x0, fx - 46], [fx + 46, x1]] as const) {
      this.group.add(plane(a, b, 0, 24, -44, litMaterial(pixelTexture(paintHedge(b - a, 24)))));
      det.add(a, b, 0, 20, -60, -45, C.iron);
    }
    P.trees.forEach((t, i) => {
      const z = -70 - (i % 2) * 14;
      const kind = t.kind as TreeKind;
      const trunkW = kind === 'young' ? 2 : kind === 'poplar' ? 3 : 4;
      det.add(t.x - trunkW, t.x + trunkW, 0, t.h, z - 3, z + 4, C.awning);
      det.add(t.x + trunkW - 2, t.x + trunkW, 0, t.h, z + 4, z + 4.5, C.awningStripe);
      if (kind === 'bare') {
        // 잎 진 마른 나무: 갈라지는 가지가 하늘을 긋는다 (길이·각도 제각각)
        for (const [hy, dx, dy, w] of [[0.55, -26, 30, 3], [0.62, 22, 34, 3], [0.8, -12, 30, 2], [0.86, 14, 26, 2], [0.95, -4, 22, 2], [0.7, -34, 12, 2], [0.75, 30, 10, 2]] as const) {
          const y0 = t.h * hy;
          det.bar(t.x, y0, t.x + dx, y0 + dy, w, z - 1, z + 2, C.awning);
          det.bar(t.x + dx, y0 + dy, t.x + dx * 1.25 + 4, y0 + dy + 10, 1.5, z - 1, z + 2, C.awning);
        }
        return;
      }
      det.bar(t.x, t.h - 20, t.x - 16, t.h + 4, 3, z - 1, z + 2, C.awning);
      det.bar(t.x + 1, t.h - 30, t.x + 18, t.h - 6, 3, z - 1, z + 2, C.awning);
      const [wf, hf] = kind === 'poplar' ? [0.5, 1.5] : kind === 'oak' ? [1.2, 0.72] : [0.9, 0.9];
      const w = Math.ceil(t.r * 2.4 * wf);
      const h = Math.ceil(t.r * 2.4 * hf);
      for (const [dz, back] of [[-6, true], [6, false]] as const) {
        const [map, sky] = paintCanopy(w, h, t.r, t.x * 7 + (back ? 3 : 0), back, kind);
        // 앞 겹 잎 윗면은 구름에 비친 도시 불빛을 받아 은은하게 밝다 (빛이 닿지 않아도 실루엣 윗선이 보이게)
        const leaf = litMaterial(pixelTexture(map), { side: THREE.DoubleSide, emissive: pixelTexture(sky), emissiveStrength: back ? 0 : 0.85 });
        const cy = t.h + h * 0.28;
        this.group.add(plane(t.x - w / 2, t.x + w / 2, cy - h / 2, cy + h / 2, z + dz, leaf));
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
    // 가로등 밑 벤치에 신문지를 덮고 웅크려 잠든 사람 (사는 흔적: 젖은 신문지가 등불을 받아 하얗게 뜬다), 우산 쓴 사람 (실루엣)
    const [pc, pg] = canvas(40, 60);
    const [, pe] = canvas(40, 60);
    sil(pg, pe, 4, 44, 26, 6, C.iron);
    sil(pg, pe, 26, 40, 8, 7, C.iron);
    sil(pg, pe, 2, 48, 6, 4, C.iron);
    rect(pg, 7, 42, 17, 3, '#a8a290');
    rect(pg, 7, 42, 17, 1, '#cdc7b2');
    rect(pg, 23, 43, 3, 2, '#a8a290');
    for (const [nx, nw] of [[9, 4], [15, 3], [19, 2]] as const) rect(pg, nx, 43, nw, 1, '#6b6152');
    this.group.add(plane(P.benches[0] + 2, P.benches[0] + 42, 6, 66, -33, litMaterial(pixelTexture(pc), { side: THREE.DoubleSide })));
    const [uc, ug] = canvas(30, 64);
    const [, ue] = canvas(30, 64);
    figure(ug, ue, 15, 64, 46, 'walk');
    for (let k = 0; k < 7; k++) sil(ug, ue, 15 - (13 - k * 2), 10 + k, (13 - k * 2) * 2, 1, C.iron);
    sil(ug, ue, 14, 16, 1, 14, C.iron);
    this.group.add(plane(P.benches[1] - 40, P.benches[1] - 10, 0, 64, -30, litMaterial(pixelTexture(uc), { side: THREE.DoubleSide })));
    // 길 위 물웅덩이: 크기·간격 제각각, 가로등과 분수 등불이 비친다 (거의 수평으로 보는 카메라라 싸우는 면 앞에 깐다)
    for (const [px0, pw, pz0, pd] of [[4462, 58, 30, 110], [4578, 40, 70, 150], [4708, 26, 40, 90]] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), decalMaterial(pixelTexture(paintPuddle(pw, Math.round(pd / 6))), 0.95));
      m.rotation.x = -Math.PI / 2;
      m.position.set(px0 + pw / 2, 0.4, pz0 + pd / 2);
      this.group.add(m);
    }
    for (const x of P.benches) {
      det.add(x, x + 36, 10, 13, -38, -30, C.awningStripe);
      det.add(x, x + 36, 19, 22, -39, -37, C.awningStripe);
      det.add(x + 2, x + 4, 0, 22, -38, -36, C.iron);
      det.add(x + 32, x + 34, 0, 22, -38, -36, C.iron);
      det.add(x + 2, x + 4, 0, 10, -32, -30, C.iron);
      det.add(x + 32, x + 34, 0, 10, -32, -30, C.iron);
    }
  }

  /**
   * 공원의 주인공: 낡은 두 단 돌 분수. 이끼 낀 아래 수반, 가는 기둥, 위 그릇, 그 위에 무쇠 등불 하나.
   * 위 그릇에 고인 빗물이 가장자리로 흘러내린다 (흐르는 1px 선). 등불이 돌 윗면과 마른 나무 가지, 젖은 테두리를 비춘다
   */
  private fountain(det: Details): void {
    const x = D.park.fountain.x;
    const z = FOUNTAIN_Z;
    this.group.add(box(x - 42, x + 42, 0, 13, z - 14, z + 14, litMaterial(pixelTexture(paintBasin(84, 13)), { wet: 0.8 })));
    // 수반 테두리: 어두운 돌 턱, 윗면은 젖어 등불을 받는다
    det.add(x - 44, x + 44, 12, 16, z - 16, z + 16, C.stoneDark);
    det.add(x - 44, x + 44, 15.5, 16, z - 16, z + 16, C.paintCream);
    // 기둥: 아래 굽, 몸통 (등불 반대쪽 오른 면은 한 단계 어둡게)
    det.add(x - 8, x + 8, 16, 20, z - 8, z + 8, C.stoneDark);
    det.add(x - 4.5, x + 4.5, 20, 38, z - 4.5, z + 4.5, C.stone);
    det.add(x + 2.5, x + 4.5, 20, 38, z + 4.5, z + 5, C.stoneDark);
    // 위 그릇: 아래로 좁아지는 둥근 그릇 (단을 셋으로 쌓아 굽은 옆선, 아랫면은 어둡게), 빛 받는 테두리와 젖은 가장자리
    det.add(x - 9, x + 9, 36, 39, z - 8, z + 8, C.stoneDark);
    det.add(x - 14, x + 14, 39, 41, z - 10, z + 10, C.stoneDark);
    det.add(x - 19, x + 19, 41, 43, z - 11, z + 11, C.stoneDark);
    det.add(x - 22, x + 22, 43, 47, z - 12, z + 12, C.stone);
    det.add(x - 22, x + 22, 46.5, 47, z - 12, z + 12, C.paintCream);
    // 무쇠 등불: 가는 대, 받침, 빛나는 주황 유리(가운데 하얀 심), 지붕과 꼭지
    det.add(x - 1, x + 1, 47, 64, z - 1, z + 1, C.iron);
    det.add(x - 4.5, x + 4.5, 63, 65, z - 4.5, z + 4.5, C.iron);
    const [gc, gg] = canvas(7, 9);
    rect(gg, 0, 0, 7, 9, '#f29c40');
    rect(gg, 1, 1, 5, 7, '#ffc16e');
    rect(gg, 2, 2, 3, 5, '#fff4d8');
    const lens = litMaterial(pixelTexture(gc), { emissive: pixelTexture(gc), emissiveStrength: 1.3 });
    this.group.add(box(x - 3.5, x + 3.5, 65, 74, z - 3.5, z + 3.5, lens));
    det.add(x - 5.5, x + 5.5, 74, 76, z - 5.5, z + 5.5, C.iron);
    det.add(x - 3.5, x + 3.5, 76, 78, z - 3.5, z + 3.5, C.iron);
    det.add(x - 0.5, x + 0.5, 78, 82, z - 0.5, z + 0.5, C.iron);
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
/** 컨테이너 회사 이름 (지어낸 해운사: 색 바랜 글씨) */
const LINES = ['NORD', 'ATLAS', 'KESTREL', 'ORIENT', 'HALCYON', 'C.S.L', 'MERIDIAN'];

/**
 * 컨테이너 옆면: 칠한 색마다 한 단계 어두운 골, 빛 받는 윗테와 아래 그늘 면(2칸), 문 쪽 잠금 막대,
 * 위에서 흘러내린 녹 줄(길이 제각각), 색 바랜 해운사 글씨 (컨테이너마다 다르다, 지침서 '컨테이너마다 색·글자·녹')
 */
export function paintContainer(w: number, h: number, color: string, seed: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, color);
  // 골: 같은 색 계열로 한 단계 어둡게 (검은 줄이 외곽선처럼 줄서지 않게)
  ditherRect(g, 0, 0, w, h, C.smog1, 3, 0, 0, false);
  for (let x = 3; x < w - 2; x += 4) ditherRect(g, x, 3, 1, h - 6, C.smog0, 6, 0, 0, false);
  rect(g, 0, 0, w, 1, C.chromeDark);
  rect(g, 0, 1, w, 1, C.iron);
  rect(g, 0, h - 2, w, 2, C.smog0);
  // 문 쪽 잠금 막대 둘 (빛 받는 왼쪽 모서리)
  for (const lx of [w - 10, w - 5]) {
    rect(g, lx, 4, 2, h - 8, C.iron);
    rect(g, lx, 4, 1, h - 8, C.ironLight);
  }
  // 녹: 윗테에서 흘러내린 줄
  for (let k = 0; k < Math.floor(w / 10); k++) {
    const rx = 2 + Math.floor(hash(seed * 31 + k) * (w - 14));
    rect(g, rx, 2, 1, 3 + Math.floor(hash(seed * 17 + k) * (h - 8)), C.rust);
  }
  // 해운사 글씨 (판이 넓을 때만)
  if (w >= 50) {
    const name = LINES[Math.floor(hash(seed * 7 + 3) * LINES.length)];
    const tx = 4 + Math.floor(hash(seed * 11) * Math.max(1, w - 18 - textWidth(name)));
    drawText(g, name, tx, Math.floor(h / 2) - 3, C.paintCream, 1);
    ditherRect(g, tx, Math.floor(h / 2) - 3, textWidth(name), 5, color, 6, 0, 0, false);
  }
  return c;
}

/** 분수 아래 수반 정면 (w × h): 돌 블록 이음, 테두리 밑 빗물 자국, 바닥 쪽 이끼 (빛 닿는 윗부분만 결이 보인다) */
function paintBasin(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.stone);
  rect(g, 0, h - 3, w, 3, C.stoneDark);
  for (let x = 6, k = 0; x < w - 2; x += 11 + Math.floor(hash(k * 7 + 2) * 6), k++) rect(g, x, 1, 1, h - 4, C.stoneDark);
  for (let k = 0; k < 7; k++) rect(g, 2 + Math.floor(hash(k * 13 + 9) * (w - 4)), 0, 1, 2 + Math.floor(hash(k * 5 + 1) * (h - 5)), C.stoneDark);
  for (let x = 0; x < w; x += 2 + Math.floor(hash(x * 3 + 1) * 3)) rect(g, x, h - 4, 2, 1 + Math.floor(hash(x + 5) * 2), C.paintTeal);
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

type TreeKind = 'poplar' | 'oak' | 'bare' | 'young';

/**
 * 나무 잎 (w × h): 잎 뭉치(원)를 나무 모양대로 흩어 놓고, 뭉치마다 위가 밝고 아래가 어둡게 (하늘빛을 받는 잎 윗면).
 * 포플러는 세로로 길게, 참나무는 옆으로 넓고 위가 울퉁불퉁하게, 어린 나무는 작은 뭉치 몇 개. 가장자리는 칸 단위로 깔끔하게 (외톨이 점 없이)
 */
function paintCanopy(w: number, h: number, r: number, seed: number, back: boolean, kind: TreeKind): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, g] = canvas(w, h);
  const [e, ge] = canvas(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const n = kind === 'young' ? (back ? 6 : 10) : kind === 'poplar' ? (back ? 10 : 18) : back ? 14 : 34;
  const clumps: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i * 7) * Math.PI * 2;
    const d = Math.sqrt(hash(seed + i * 13)) * (kind === 'oak' ? 0.72 : 0.62);
    // 참나무: 위쪽 뭉치를 더 크게 (넓게 퍼진 머리), 포플러: 아래로 갈수록 조금 넓게
    const top = Math.sin(a) < 0 ? 1 : 0;
    const rad = r * (kind === 'oak' ? 0.17 + 0.09 * top : kind === 'poplar' ? 0.24 : 0.28) * (0.8 + hash(seed + i * 3) * 0.45);
    clumps.push([cx + Math.cos(a) * d * (w / 2), cy + Math.sin(a) * d * (h / 2) - h * 0.04, rad]);
  }
  clumps.sort((p, q) => q[1] - p[1]);
  const tones = back ? [C.night, '#0c1418', '#121c20', '#16222a'] : ['#0e1614', '#16241f', '#22362c', '#2f4a3a', '#4a6a50'];
  paint(g, 0, 0, w, h, (x, y) => {
    // 위에 그린 (y가 작은) 뭉치가 앞: 마지막으로 덮는 뭉치의 명암을 쓴다
    let tone = -1;
    for (const [px, py, rad] of clumps) {
      const d = Math.hypot(x + 0.5 - px, y + 0.5 - py) / rad;
      if (d > 1) continue;
      const ly = (y + 0.5 - py) / rad;
      const lx = (x + 0.5 - px) / rad;
      // 뭉치 윗면이 밝고(하늘빛), 나무 전체로도 위가 밝다
      const light = -ly * 0.8 - lx * 0.2 + (1 - d) * 0.2 - (y / h) * 0.6;
      tone = Math.max(0, Math.min(tones.length - 1, Math.floor((light + 0.75) * (tones.length / 1.6))));
    }
    return tone < 0 ? null : tones[tone];
  });
  // 잎 윗면 (가장 밝은 두 단계)만 하늘빛: 발광 그림 (나머지는 검정)
  const px = g.getImageData(0, 0, w, h).data;
  paint(ge, 0, 0, w, h, (x, y) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] === 0) return null;
    const hex = '#' + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    return hex === tones[tones.length - 1] ? '#1f4a48' : hex === tones[tones.length - 2] ? '#0e2626' : '#000000';
  });
  return [c, e];
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
