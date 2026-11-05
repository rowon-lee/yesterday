import * as THREE from 'three';
import type { BakedMotion } from '../../anim/bake';
import type { LookName } from '../../anim/skeleton';
import type { SkinId } from '../../anim/skins';
import { cellOf } from '../../anim/motion';
import { GROUND } from '../../stage/citadel';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas } from '../dither';
import { lightPool } from './lights';
import { contactShadowMaterial, flatMaterial, pixelTexture, spriteMaterial } from './shaders';
import { SpriteAtlas } from './sprites';

/**
 * 2.5D 화면의 캐릭터와 이펙트 (렌더 전용).
 * - 캐릭터: 미리 그린 스틱맨 그림(그림 모음 텍스처, sprites.ts)을 싸우는 면(z = 0)의 판으로 세운다. 무대의 빛을 받고 (어두운 곳은 어둡고 차갑게,
 *   가로등·간판·이펙트 빛 가까이는 밝고 그 빛 색으로), 가까운 광원 색으로 테두리 빛.
 * - 그림자: 발밑 바닥(발판)에 눕힌 부드러운 어두운 타원. 뜰수록 작고 옅다.
 * - 평면 층(뒤·앞): 기존 2D 그림(먼지·잔상·잔해·Sprite Fusion 이펙트)을 화면 크기 캔버스에 그려 싸우는 면 바로 뒤·앞의 판으로 얹는다.
 * 그리는 차례(renderOrder): 무대(0) → 뒤 평면 층(8) → 그림자(9) → 캐릭터(10) → 앞 평면 층(11). 캐릭터와 평면 층은 깊이를 쓰지 않는다.
 */
export interface CharDraw {
  motion: BakedMotion;
  frame: number;
  look: LookName;
  flip: boolean;
  /** 캐릭터 겉모습 (장식·색). 없으면 기본 스틱맨 */
  skin?: SkinId;
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

/**
 * 평면 층 하나: 화면 크기 캔버스에 2D로 그리고, 이번 프레임에 그린 곳과 지난 프레임에 그렸던 곳만 텍스처에 올린다
 * (화면 전체를 매 프레임 올리면 휴대폰에서 무겁다). 그린 자리는 캔버스의 그리기 함수를 감싸서 잰다.
 */
class Flat {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh;
  /** 올릴 때 읽는 쪽 (캔버스 그대로, 화면에는 쓰지 않는다) */
  private readonly src: THREE.Texture;
  /** 이번 프레임에 그린 사각형 [x0, y0, x1, y1]과 지난 프레임 것 */
  private box: number[] | null = null;
  private prev: number[] | null = null;
  private readonly region = new THREE.Box2();
  private readonly at = new THREE.Vector2();

  constructor(z: number, order: number) {
    [this.canvas, this.ctx] = canvas(SCREEN_W, SCREEN_H);
    this.ctx.imageSmoothingEnabled = false;
    this.tex = pixelTexture(this.canvas);
    // 부분 올리기는 위아래를 뒤집지 않고 올린다 (텍스처 0번 줄 = 캔버스 맨 위). 판의 uv를 대신 뒤집는다
    this.tex.flipY = false;
    this.src = new THREE.Texture(this.canvas);
    const geo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.mesh = new THREE.Mesh(geo, flatMaterial(this.tex));
    this.mesh.position.z = z;
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
    this.track();
  }

  private grow(x: number, y: number, w: number, h: number): void {
    const x0 = Math.floor(Math.min(x, x + w));
    const y0 = Math.floor(Math.min(y, y + h));
    const x1 = Math.ceil(Math.max(x, x + w));
    const y1 = Math.ceil(Math.max(y, y + h));
    const b = this.box;
    if (!b) this.box = [x0, y0, x1, y1];
    else {
      b[0] = Math.min(b[0], x0);
      b[1] = Math.min(b[1], y0);
      b[2] = Math.max(b[2], x1);
      b[3] = Math.max(b[3], y1);
    }
  }

  /** fillRect·drawImage·putImageData가 그린 자리를 잰다 (평면 층에 그리는 것들은 옮김·회전을 쓰지 않는다) */
  private track(): void {
    const g = this.ctx;
    const fill = g.fillRect.bind(g);
    g.fillRect = (x: number, y: number, w: number, h: number) => {
      this.grow(x, y, w, h);
      fill(x, y, w, h);
    };
    const draw = g.drawImage.bind(g) as (...a: unknown[]) => void;
    g.drawImage = ((...a: number[]) => {
      const img = a[0] as unknown as { width: number; height: number };
      if (a.length >= 9) this.grow(a[5], a[6], a[7], a[8]);
      else if (a.length >= 5) this.grow(a[1], a[2], a[3], a[4]);
      else this.grow(a[1], a[2], img.width, img.height);
      draw(...a);
    }) as unknown as typeof g.drawImage;
    const put = g.putImageData.bind(g) as (...a: unknown[]) => void;
    g.putImageData = ((...a: number[]) => {
      const img = a[0] as unknown as ImageData;
      if (a.length >= 7) this.grow(a[1] + a[3], a[2] + a[4], a[5], a[6]);
      else this.grow(a[1], a[2], img.width, img.height);
      put(...a);
    }) as unknown as typeof g.putImageData;
  }

  /** 이번 프레임 그림: draw가 무언가 그렸으면 true를 돌려준다 (안 그렸으면 판을 숨긴다) */
  paint(renderer: THREE.WebGLRenderer, ix: number, iy: number, draw: (ctx: CanvasRenderingContext2D) => boolean): void {
    const p = this.prev;
    if (p) this.ctx.clearRect(p[0], p[1], p[2] - p[0], p[3] - p[1]);
    this.box = null;
    const drew = draw(this.ctx);
    const cur = drew ? this.box : null;
    // 올릴 곳: 지난 프레임에 그렸던 곳(지운 자리)과 이번에 그린 곳
    let d: number[] | null = null;
    for (const b of [p, cur]) {
      if (!b) continue;
      d = d ? [Math.min(d[0], b[0]), Math.min(d[1], b[1]), Math.max(d[2], b[2]), Math.max(d[3], b[3])] : [...b];
    }
    if (d) {
      const x0 = Math.max(0, d[0]);
      const y0 = Math.max(0, d[1]);
      const x1 = Math.min(SCREEN_W, d[2]);
      const y1 = Math.min(SCREEN_H, d[3]);
      if (x1 > x0 && y1 > y0) {
        this.region.min.set(x0, y0);
        this.region.max.set(x1, y1);
        this.at.set(x0, y0);
        renderer.copyTextureToTexture(this.src, this.tex, this.region, this.at);
      }
    }
    this.prev = cur ? [Math.max(0, cur[0]), Math.max(0, cur[1]), Math.min(SCREEN_W, cur[2]), Math.min(SCREEN_H, cur[3])] : null;
    this.mesh.visible = drew;
    if (drew) {
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
  /** 캐릭터 그림 모음 (불러오기 화면이 미리 채운다) */
  readonly sprites = new SpriteAtlas();

  constructor() {
    this.group.add(this.back.mesh, this.front.mesh);
    // 발밑 그림자 판: 바닥에 눕힌 -1~1 네모 (셰이더가 자리·크기를 정한다)
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, -1, 0, 1, 1, 0, 1, 1, 0, -1], 3));
    sgeo.setIndex([0, 1, 2, 0, 2, 3]);
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), spriteMaterial());
      m.renderOrder = 10;
      m.frustumCulled = false;
      this.chars.push(m);
      const s = new THREE.Mesh(sgeo, contactShadowMaterial());
      s.renderOrder = 9;
      s.frustumCulled = false;
      this.shadows.push(s);
      this.group.add(m, s);
    }
  }

  /** 불러오기 화면이 셰이더를 미리 만들 때: 캐릭터 판에 그림 모음 첫 장을 물린다 (그 그리기에서 실제 텍스처로 만들어지게) */
  warm(): void {
    const page = this.sprites.pages[0];
    for (const m of this.chars) {
      const u = (m.material as THREE.ShaderMaterial).uniforms;
      u.map.value = page?.tex ?? null;
      u.palette.value = this.sprites.palette;
      u.rect.value.set(0, 0, 64, 64);
      u.cellInfo.value.set(0, 0, 64, 64);
    }
  }

  /** 캐릭터가 없는 화면(타이틀 등): 캐릭터·그림자·이펙트 층을 모두 감춘다 */
  hide(): void {
    for (const m of this.chars) m.visible = false;
    for (const s of this.shadows) s.visible = false;
    this.back.mesh.visible = false;
    this.front.mesh.visible = false;
  }

  /** 캐릭터 둘 (빛은 이미 실려 있어야 한다: view.commitLights 뒤) */
  update(list: readonly CharDraw[]): void {
    list.forEach((d, i) => {
      const m = this.chars[i];
      const s = this.shadows[i];
      m.visible = d.visible;
      // 그림자: 발밑 바닥에, 높이 뜰수록 작고 옅게 (뜬 높이 140px쯤에서 사라진다)
      const air = Math.max(0, d.h - d.floor);
      const su = (s.material as THREE.ShaderMaterial).uniforms;
      su.at.value.set(Math.round(d.x), d.floor, Math.max(5, 13 - air * 0.05));
      su.strength.value = 0.72 * Math.max(0, 1 - air / 140);
      s.visible = d.visible && su.strength.value > 0.03;
      if (!d.visible) return;
      const skin = d.skin ?? 'base';
      const spr = this.sprites.get(d.motion, skin, d.frame);
      const mat = m.material as THREE.ShaderMaterial;
      const u = mat.uniforms;
      u.map.value = spr.tex;
      u.palette.value = this.sprites.palette;
      u.row.value = this.sprites.row(skin, d.look);
      u.flip.value = d.flip ? 1 : 0;
      u.rect.value.set(spr.ax, spr.ay, spr.f.w, spr.f.h);
      // 칸 크기는 동작마다 (보통 64×64 발밑 32,61 · 큰 칸 128×96 발밑 64,93): 판을 칸 크기로 늘리고 발밑을 맞춘다
      const cell = cellOf(d.motion);
      u.cellInfo.value.set(spr.f.x, spr.f.y, cell.w, cell.h);
      m.scale.set(cell.w / 64, cell.h / 64, 1);
      // 판 가운데는 발에서 위로 (발밑 줄 − 칸 높이의 반)px
      m.position.set(Math.round(d.x) - cell.fx + cell.w / 2, Math.round(d.h) + cell.fy - cell.h / 2, 0);
      m.renderOrder = 10 + d.order;
      // 무대의 빛: 맞아서 하얗게 번쩍일 때는 시트 색 그대로, 기 모으기 빛(glow)은 반만 (스스로 빛나는 색이라)
      u.lit.value = !d.rim || d.look === 'flash' ? 0 : d.look.startsWith('glow') ? 0.4 : 1;
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
