import * as THREE from 'three';
import type { Motion } from '../../anim/motion';
import type { LookName } from '../../anim/skeleton';
import { FOOT_X, FOOT_Y } from '../../anim/motion';
import { GROUND } from '../../stage/citadel';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas } from '../dither';
import { lightPool } from './lights';
import { flatMaterial, pixelTexture, spriteMaterial } from './shaders';

/**
 * 2.5D 화면의 캐릭터와 이펙트 (렌더 전용).
 * - 캐릭터: 미리 그린 스틱맨 시트를 싸우는 면(z = 0)의 판으로 세운다. 가까운 광원 색으로 테두리 빛.
 * - 그림자: 발밑의 어두운 납작한 판.
 * - 평면 층(뒤·앞): 기존 2D 그림(먼지·잔상·잔해·Sprite Fusion 이펙트)을 화면 크기 캔버스에 그려 싸우는 면 바로 뒤·앞의 판으로 얹는다.
 * 그리는 차례(renderOrder): 무대(0) → 뒤 평면 층(8) → 그림자(9) → 캐릭터(10) → 앞 평면 층(11). 캐릭터와 평면 층은 깊이를 쓰지 않는다.
 */
export interface CharDraw {
  motion: Motion;
  frame: number;
  look: LookName;
  flip: boolean;
  /** 발밑 월드 x, 바닥 위 높이 (px) */
  x: number;
  h: number;
  /** 그림자 높이 (발밑 바닥: 땅이나 발판) */
  floor: number;
  /** 테두리 빛을 칠할지 (맞아서 하얗게 번쩍일 때는 끈다) */
  rim: boolean;
  visible: boolean;
  /** 앞에 그릴수록 큰 값 */
  order: number;
}

class Flat {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh;
  private dirty = false;

  constructor(z: number, order: number) {
    [this.canvas, this.ctx] = canvas(SCREEN_W, SCREEN_H);
    this.ctx.imageSmoothingEnabled = false;
    this.tex = pixelTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), flatMaterial(this.tex));
    this.mesh.position.z = z;
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
  }

  /** 이번 프레임 그림: draw가 무언가 그렸으면 true를 돌려준다 (안 그렸으면 올리지 않는다) */
  paint(ix: number, iy: number, draw: (ctx: CanvasRenderingContext2D) => boolean): void {
    if (this.dirty) this.ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    const drew = draw(this.ctx);
    this.dirty = drew;
    this.mesh.visible = drew;
    if (drew) {
      this.tex.needsUpdate = true;
      this.mesh.position.x = ix + SCREEN_W / 2;
      this.mesh.position.y = GROUND - (iy + SCREEN_H / 2);
    }
  }
}

export class Actors {
  readonly group = new THREE.Group();
  readonly back = new Flat(-0.6, 8);
  readonly front = new Flat(0.6, 11);
  private readonly chars: THREE.Mesh[] = [];
  private readonly shadows: THREE.Mesh[] = [];
  private readonly texCache = new Map<HTMLCanvasElement, THREE.CanvasTexture>();

  constructor() {
    this.group.add(this.back.mesh, this.front.mesh);
    const [sc, sg] = canvas(2, 2);
    sg.fillStyle = '#0a0712';
    sg.fillRect(0, 0, 2, 2);
    const shadowMat = flatMaterial(pixelTexture(sc));
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), spriteMaterial());
      m.renderOrder = 10;
      m.frustumCulled = false;
      this.chars.push(m);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), shadowMat);
      s.renderOrder = 9;
      s.frustumCulled = false;
      this.shadows.push(s);
      this.group.add(m, s);
    }
  }

  private texture(c: HTMLCanvasElement): THREE.CanvasTexture {
    let t = this.texCache.get(c);
    if (!t) {
      t = pixelTexture(c);
      this.texCache.set(c, t);
    }
    return t;
  }

  /** 캐릭터 둘 (빛은 이미 실려 있어야 한다: view.commitLights 뒤) */
  update(list: readonly CharDraw[]): void {
    list.forEach((d, i) => {
      const m = this.chars[i];
      const s = this.shadows[i];
      m.visible = d.visible;
      // 그림자: 발밑 바닥에, 높이 뜰수록 작게
      const w = Math.max(4, 14 + Math.round((d.floor - d.h) / 10));
      s.visible = true;
      s.scale.set(w, 1, 1);
      s.position.set(Math.round(d.x), d.floor - 1, -0.4);
      if (!d.visible) return;
      const sheet = d.motion.sheet!(d.look, d.flip);
      const mat = m.material as THREE.ShaderMaterial;
      const u = mat.uniforms;
      u.map.value = this.texture(sheet);
      const n = sheet.width / 64;
      u.frame.value.set(d.frame / n, 0, 1 / n, 1);
      u.texel.value.set(1 / sheet.width, 1 / sheet.height);
      // 발밑 기준점 (32, 61): 판 가운데는 발에서 위로 29px
      m.position.set(Math.round(d.x) - FOOT_X + 32, Math.round(d.h) + FOOT_Y - 32, 0);
      m.renderOrder = 10 + d.order;
      // 테두리 빛: 몸 가운데 둘레에서 가장 센 빛 쪽으로
      const l = d.rim ? lightPool.strongest(d.x, d.h + 26, 0) : null;
      if (l && l.k > 0.04) {
        const sx = Math.abs(l.dx) > 0.38 ? Math.sign(l.dx) : 0;
        const sy = Math.abs(l.dy) > 0.38 ? Math.sign(l.dy) : 0;
        u.rimDir.value.set(sx, sy);
        const mx = Math.max(l.r, l.g, l.b, 1e-4);
        const k = Math.min(1, l.k * 3) * 1.6;
        u.rimColor.value.setRGB((l.r / mx) * k, (l.g / mx) * k, (l.b / mx) * k);
      } else u.rimDir.value.set(0, 0);
    });
  }
}
