import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';
import { PARK_GATE_W } from '../../stage/citadel';
import { drawText, textWidth } from '../font';
import { COLORS as C } from '../palette';
import { canvas, disc, ditherRect, hash, paint, rect, solidTex } from '../dither';
import { box, Details, facedBox, plane } from './kit';
import { Sparks } from './fx';
import { lightPool } from './lights';
import { paintPuddle } from './proptex';
import { figure, sil } from './rooms';
import { scaleAt } from './core';
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
  /** 항만 조명탑의 켜진 투광등과 꼭대기 빨간 불 */
  private readonly flood = litMaterial(pixelTexture(solidTex('#ffe2a8')), { emissive: pixelTexture(solidTex('#fff4d8')), emissiveStrength: 1.6 });
  private readonly beacon = litMaterial(pixelTexture(solidTex(C.neonRedDark)), { emissive: pixelTexture(solidTex(C.neonRed)), emissiveStrength: 0 });

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
    this.wires(det);
    this.group.add(det.build(), this.drops.mesh);
    // 조명탑 가운데 투광등 유리 (아래를 본다)와 꼭대기 경고등
    this.group.add(box(1871, 1877, 337.5, 338.5, -59.5, -58.5, this.flood));
    this.group.add(box(1872, 1876, 388, 391, -66, -62, this.beacon));
  }

  /** 이번 틱의 빛과 물방울: 공원 분수 등불 (낡은 등이라 아주 조금 일렁인다), 그릇 가장자리에서 떨어지는 물방울 */
  update(tick: number): void {
    // 항만 조명탑: 투광등 하나가 부두를 내려 비추고, 꼭대기 빨간 불이 천천히 깜빡인다 (위층 화면의 빛)
    lightPool.add(1874, 330, -50, 390, '#ffe2a8', 0.55, true);
    const blink = tick % 100 < 50;
    this.beacon.uniforms.emissiveStrength.value = blink ? 2.4 : 0.1;
    if (blink) lightPool.add(1874, 392, -56, 40, C.neonRed, 0.8);
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

  /**
   * 위층에 보이는 것 (공중 콤보 때 빈 하늘만 보이지 않게, 지침서 8장): 부두의 나무 전신주 둘과 극장 블록 지붕까지 처진 전선,
   * 전선과 가로대에 앉은 비둘기, 전신주 꼭대기 변압기. 공원 쪽은 라디오 가게 지붕에서 철책 너머 전신주까지 처진 전선.
   * 서 있을 수 없는 것 (발판이 아니다): 싸우는 면보다 뒤에 둔다
   */
  private wires(det: Details): void {
    const pole = (x: number, h: number, z: number) => {
      det.add(x - 2, x + 2, 0, h, z - 2, z + 2, '#2e1a10');
      det.add(x + 1, x + 2, 40, h, z + 2, z + 2.2, '#46281a');
      for (const [ay, half] of [[h - 8, 16], [h - 22, 12]] as const) {
        det.add(x - half, x + half, ay, ay + 3, z - 1.5, z + 1.5, '#2e1a10');
        // 애자 (사기 절연체: 하늘빛을 받는 작은 흰 점)
        for (const ix of [x - half + 2, x - 4, x + 3, x + half - 3]) det.add(ix, ix + 1, ay + 3, ay + 5, z - 1, z + 1, '#868b98');
      }
      // 변압기 통 (윗면이 젖어 반짝인다)
      det.add(x + 3, x + 11, h - 52, h - 36, z - 4, z + 4, '#3a3e49');
      det.add(x + 3, x + 11, h - 37, h - 36, z - 4, z + 4, '#686d7a');
    };
    /** 항만 조명탑: 두 다리가 위로 모이는 쇠 격자, 전선 가로대, 조명 받침 (투광등 셋, 하나만 켜짐), 꼭대기 빨간 불 */
    const mast = (x: number, z: number) => {
      const top = 382;
      const leg = (s: number) => (h: number) => x + s * (9 - (h / top) * 6);
      for (const s of [-1, 1] as const) {
        const L = leg(s);
        for (let h = 0; h < top; h += 24) det.bar(L(h), h, L(h + 24), h + 24, 2, z - 1, z + 1, '#232026');
      }
      // 격자: 마디마다 엇갈린 사선과 가로대
      for (let h = 12, k = 0; h < top - 10; h += 24, k++) {
        const a = leg(-1)(h);
        const b = leg(1)(h + 24);
        det.bar(k % 2 ? a : leg(1)(h), h, k % 2 ? b : leg(-1)(h + 24), h + 24, 1, z - 0.5, z + 0.5, '#232026');
        det.bar(leg(-1)(h), h, leg(1)(h), h, 1, z - 0.5, z + 0.5, '#2a2d36');
      }
      // 전선 가로대 (애자)
      for (const [ay, half] of [[310, 18], [296, 14]] as const) {
        det.add(x - half, x + half, ay, ay + 2, z - 1.5, z + 1.5, '#232026');
        for (const ix of [x - half + 2, x + half - 3]) det.add(ix, ix + 1, ay + 2, ay + 4, z - 1, z + 1, '#868b98');
      }
      // 조명 받침과 투광등 셋 (가운데 하나만 켜져 부두 바닥을 비춘다: Edges.update)
      det.add(x - 14, x + 14, 344, 347, z - 4, z + 4, '#232026');
      det.add(x - 14, x + 14, 346.5, 347, z - 4, z + 4, '#4f5460');
      for (const fx of [-10, 0, 10]) det.add(x + fx - 3, x + fx + 3, 338, 344, z + 1, z + 5, '#3a3e49');
      det.add(x - 1, x + 1, top, top + 6, z - 1, z + 1, '#232026');
    };
    /** 처진 전선 (x0,y0)→(x1,y1), 처짐 sag, 깊이 z. 위에 앉은 새 n마리 */
    const span = (x0: number, y0: number, x1: number, y1: number, sag: number, z: number, birds: number, seed: number) => {
      const segs = Math.max(6, Math.round(Math.abs(x1 - x0) / 10));
      const at = (t: number) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * sag] as const;
      for (let k = 0; k < segs; k++) {
        const [ax, ay] = at(k / segs);
        const [bx, by] = at((k + 1) / segs);
        det.bar(ax, ay, bx, by, 0.8, z - 0.3, z + 0.3, '#14151a');
      }
      for (let b = 0; b < birds; b++) {
        const t = 0.15 + hash(seed + b * 7) * 0.7;
        const [bx, by] = at(t);
        const left = hash(seed + b * 13) < 0.5;
        det.add(bx - 2, bx + 2, by + 0.5, by + 3.5, z - 1, z + 1, '#0b0c10');
        det.add(left ? bx - 3 : bx + 1, left ? bx - 1 : bx + 3, by + 3, by + 5, z - 1, z + 1, '#0b0c10');
      }
    };
    // 부두: 컨테이너 더미 뒤 전신주와 방파제의 항만 조명탑(쇠 격자, 꼭대기 빨간 경고등), 극장 블록 빵집 지붕 모서리까지
    pole(1652, 300, -126);
    mast(1874, -64);
    for (const [dy, sag, birds] of [[-8, 18, 4], [-22, 14, 1]] as const) {
      span(1652, 300 + dy + 3, 1874, 318 + dy + 3, sag, -95, birds, 1700 + dy);
      span(1874, 318 + dy + 3, 2003, 286 + dy * 0.5, sag * 0.6, -52, dy === -8 ? 3 : 0, 1900 + dy);
    }
    // 서쪽으로 화면 밖 창고까지 이어지는 전선 한 줄
    span(1520, 286, 1652, 295, 12, -126, 1, 1500);
    // 공원: 라디오 가게 지붕에서 철책 너머 전신주까지 (나무 사이로 처진다)
    pole(4796, 330, -110);
    span(4402, 372, 4796, 325, 34, -60, 4, 4400);
    span(4402, 360, 4796, 311, 30, -62, 0, 4410);
  }

  /** 컨테이너 더미 (구조물: 윗면이 발판, 양옆이 벽. 전차 선로 서쪽 끝을 가린다) */
  private containers(): void {
    const CT = D.pier.containers;
    // 칠 색은 부두 팔레트에 있는 색 쪽으로 (녹슨 갈색·청록·호박·남보라): 어둠 속에서도 색이 회청색 하나로 지워지지 않게,
    // 칠 색 그대로 아주 옅게 스스로 빛나게 둔다 (빛이 닿지 않아도 컨테이너마다 색이 남는다)
    const colors = ['#78452a', '#17616a', '#844018', '#372860'];
    for (let r = 0; r < CT.rows; r++) {
      const col = colors[r % colors.length];
      // 단마다 조금씩 엇갈려 쌓였지만, 발판·벽이 있는 자리(x0~x1)를 넘지 않는다
      const x0 = CT.x0 + (r % 2 ? 3 : 0);
      const x1 = CT.x1 - (r % 2 ? 0 : 3);
      const y = r * CT.rowH;
      const front = paintContainer(x1 - x0, CT.rowH, col, r);
      const tex = litMaterial(pixelTexture(front), { emissive: pixelTexture(front), emissiveStrength: 0.1 });
      const endC = paintContainer(60, CT.rowH, col, r + 7);
      const end = litMaterial(pixelTexture(endC), { emissive: pixelTexture(endC), emissiveStrength: 0.06 });
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
      const cy = t.h + h * 0.28;
      // 가까운 등 쪽에서 오는 빛 (잎 덩어리의 그 쪽 가장자리가 따뜻하게 밝다)
      const lamp = nearestParkLight(t.x);
      for (const [dz, back] of [[-6, true], [6, false]] as const) {
        this.group.add(canopyPlane(t.x, cy, w, h, z + dz, kind, t.x * 7 + (back ? 3 : 0), back, lamp));
      }
    });
    // 뒤쪽 큰 플라타너스 둘: 위층(공중 콤보 때 보이는 곳)까지 솟아 공원 하늘이 비지 않게 (빛이 닿지 않는 어두운 덩어리, 윗면만 하늘빛)
    for (const [bx, th, r, bz] of [[4506, 196, 74, -150], [4706, 176, 62, -166]] as const) {
      det.add(bx - 5, bx + 5, 0, th, bz - 4, bz + 4, '#231812');
      det.bar(bx, th * 0.62, bx - 34, th * 0.95, 4, bz - 2, bz + 2, '#231812');
      det.bar(bx + 1, th * 0.7, bx + 30, th + 6, 4, bz - 2, bz + 2, '#231812');
      const w = Math.ceil(r * 2.5);
      const h = Math.ceil(r * 1.9);
      this.group.add(canopyPlane(bx, th + h * 0.22, w, h, bz, 'plane', bx * 13, true, null));
    }
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

type TreeKind = 'poplar' | 'oak' | 'bare' | 'young' | 'plane';

/** 나무에 가장 가까운 공원 빛 (등롱·분수 등불): 월드 x와 높이 */
function nearestParkLight(x: number): { x: number; y: number } {
  const lights = [{ x: 4480, y: 92 }, { x: 4680, y: 92 }, { x: D.park.fountain.x, y: 70 }];
  return lights.reduce((m, l) => (Math.abs(l.x - x) < Math.abs(m.x - x) ? l : m), lights[0]);
}

/** 잎 판 하나: 깊이 z의 배율로 그려 (텍스처 한 칸 = 화면 1px) 월드 크기 w×h, 가운데 (x, cy)에 세운다. lamp: 잎을 비추는 등 (월드) */
function canopyPlane(x: number, cy: number, w: number, h: number, z: number, kind: TreeKind, seed: number, back: boolean, lamp: { x: number; y: number } | null): THREE.Mesh {
  const s = scaleAt(z);
  const tw = Math.round(w * s);
  const th = Math.round(h * s);
  const lt = lamp ? { x: (lamp.x - (x - w / 2)) * s, y: (cy + h / 2 - lamp.y) * s } : null;
  const [map, sky] = paintCanopy(tw, th, seed, back, kind, lt);
  // 잎 윗면은 구름에 비친 도시 불빛을 받아 은은하게 밝다 (빛이 닿지 않아도 실루엣 윗선이 보이게)
  const leaf = litMaterial(pixelTexture(map), { side: THREE.DoubleSide, emissive: pixelTexture(sky), emissiveStrength: back ? 0.5 : 0.85 });
  return plane(x - w / 2, x + w / 2, cy - h / 2, cy + h / 2, z, leaf);
}

/**
 * 나무 잎 (w × h 텍스처 칸): 가장자리가 들쭉날쭉한 잎 뭉치 여럿을 겹친 덩어리 (뭉치 둘레로 2칸 잎 다발이 삐져나오고,
 * 안쪽 몇 곳은 하늘이 비친다). 명암은 덩어리 전체로: 하늘을 보는 윗가장자리만 차가운 하늘빛, 등을 보는 가장자리는 따뜻한 등불빛,
 * 뭉치 아래쪽은 위 뭉치가 드리운 그늘, 깊은 안쪽은 어둠 (뭉치마다 밝은 모자를 씌우지 않는다: 동그란 덩어리 반복처럼 보인다).
 * 넓은 면에 점무늬를 쓰지 않는다. lamp: 등 자리 (텍스처 칸, 덩어리 밖 아래쪽일 수 있다)
 */
function paintCanopy(w: number, h: number, seed: number, back: boolean, kind: TreeKind, lamp: { x: number; y: number } | null): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, g] = canvas(w, h);
  const [e, ge] = canvas(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;
  const n = kind === 'young' ? 6 : kind === 'poplar' ? 8 : kind === 'plane' ? 12 : 10;
  const clumps: Array<{ x: number; y: number; r: number; ph: number; d: number }> = [];
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i * 7) * Math.PI * 2;
    const rr = Math.sqrt(hash(seed + i * 13));
    let x = cx + Math.cos(a) * rr * (w / 2 - R * 0.38);
    let y = cy + Math.sin(a) * rr * (h / 2 - R * 0.38);
    if (kind === 'poplar') x = cx + (x - cx) * 0.65;
    if ((kind === 'oak' || kind === 'plane') && y > cy) y = cy + (y - cy) * 0.65;
    const r = R * (kind === 'poplar' ? 0.48 : kind === 'young' ? 0.55 : 0.42) * (0.75 + hash(seed + i * 3) * 0.5);
    clumps.push({ x, y, r, ph: hash(seed + i * 5) * 6.28, d: hash(seed + i * 11) });
  }
  clumps.sort((p, q) => p.d - q.d);
  // 1) 덩어리 칸 그림과 칸마다 앞 뭉치
  const own = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let k = clumps.length - 1; k >= 0; k--) {
        const q = clumps[k];
        const dx = x + 0.5 - q.x;
        const dy = y + 0.5 - q.y;
        const ang = Math.atan2(dy, dx);
        const edge = q.r * (0.82 + 0.1 * Math.sin(ang * 5 + q.ph) + 0.08 * Math.sin(ang * 11 + q.ph * 2));
        const d = Math.hypot(dx, dy);
        const tuft = d < edge + 2.5 && hash(seed + ((x >> 1) * 31 + (y >> 1) * 17) * 7 + k) < 0.42;
        if (d > edge && !tuft) continue;
        own[y * w + x] = k;
        break;
      }
    }
  }
  // 하늘이 비치는 구멍 (2~3칸)
  for (let k = 0; k < (kind === 'young' ? 2 : 6); k++) {
    const hx = Math.floor(hash(seed + 900 + k) * w);
    const hy = Math.floor(hash(seed + 950 + k) * h * 0.8);
    const hw = 2 + Math.floor(hash(seed + 990 + k) * 2);
    let inside = true;
    for (let y = hy - 1; y <= hy + 2; y++) for (let x = hx - 1; x <= hx + hw; x++) if (x < 0 || y < 0 || x >= w || y >= h || own[y * w + x] < 0) inside = false;
    if (!inside) continue;
    for (let y = hy; y < hy + 2; y++) for (let x = hx; x < hx + hw; x++) own[y * w + x] = -1;
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : own[y * w + x]);
  const tones = back
    ? ['#070c0b', '#0b1210', '#0f1814', '#14201a', '#1a2a22', '#22362c']
    : ['#0b1210', '#111c18', '#18281f', '#22362a', '#2f4a40', '#3a5a4a'];
  const warm = back ? ['#1a2010', '#26301a'] : ['#3e4a2a', '#565024'];
  const tone = new Int8Array(w * h).fill(-1);
  const warmth = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = own[y * w + x];
      if (k < 0) continue;
      // 바깥 쪽 방향 (둘레 3칸 안의 빈 칸 쪽)과 가장자리까지 거리
      let ox = 0;
      let oy = 0;
      let near = 9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (at(x + dx, y + dy) >= 0) continue;
        ox += dx;
        oy += dy;
        near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
      }
      const ol = Math.hypot(ox, oy) || 1;
      const nx = ox / ol;
      const ny = oy / ol;
      const q = clumps[k];
      let t = 2 + (q.d > 0.6 ? 0 : -1 * (q.d < 0.25 ? 1 : 0));
      // 뭉치 아래쪽: 위 뭉치·자기 자신이 드리운 그늘
      if ((y + 0.5 - q.y) / q.r > 0.35) t -= 1;
      // 깊은 안쪽은 어둠, 나무 아래쪽일수록 어둡게
      if (near > 4) t -= 1;
      if (y > h * 0.75) t -= 1;
      // 하늘을 보는 윗가장자리 (덩어리 전체 실루엣의 위쪽만)
      if (near <= 2 && ny < -0.55) t = near <= 1 ? 5 : 4;
      tone[y * w + x] = Math.max(0, Math.min(tones.length - 1, t));
      // 등을 보는 가장자리: 등 쪽을 향한 면이 따뜻하게 (등에 가까울수록 더)
      if (lamp && !back && near <= 4) {
        const lx = lamp.x - (x + 0.5);
        const ly = lamp.y - (y + 0.5);
        const ld = Math.hypot(lx, ly) || 1;
        const f = (nx * lx + ny * ly) / ld;
        if (f > 0.25 && ld < 90) warmth[y * w + x] = f > 0.55 && ld < 55 && near <= 2 ? 2 : 1;
      }
    }
  }
  paint(g, 0, 0, w, h, (x, y) => {
    const t = tone[y * w + x];
    if (t < 0) return null;
    const wm = warmth[y * w + x];
    return wm ? warm[wm - 1] : tones[t];
  });
  // 하늘빛을 받는 윗가장자리만 발광 (나머지는 검정)
  paint(ge, 0, 0, w, h, (x, y) => {
    const t = tone[y * w + x];
    if (t < 0) return null;
    if (warmth[y * w + x]) return '#000000';
    return t === 5 ? '#1f4a48' : t === 4 ? '#0e2626' : '#000000';
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
