import * as THREE from 'three';
import type { BakedMotion, CellFrame } from '../../anim/bake';
import { LOOKS, lookTable, type LookName } from '../../anim/skeleton';
import { lookOf, SKINS, type SkinId } from '../../anim/skins';

/**
 * 캐릭터 그림 모음 (렌더 전용): 동작 프레임마다 색 번호 그림(1바이트, 그림이 있는 네모만)을 큰 텍스처 몇 장에 모아 둔다.
 * 색은 셰이더가 색 묶음 표(palette)에서 고른다 (캐릭터 겉모습 × 색 묶음 한 줄). 좌우는 셰이더가 칸을 뒤집어 읽는다.
 * 예전처럼 동작·색 묶음·방향마다 캔버스를 만들지 않으므로, 네 캐릭터를 모두 미리 올려도 텍스처 몇 장이면 된다.
 */
const PAGE = 2048;
/** 그림 둘레 빈 칸: 테두리 빛이 옆 그림을 읽지 않게 (셰이더가 네모 밖은 비었다고 보지만, 안전하게 한 칸 띄운다) */
const PAD = 1;

interface Page {
  data: Uint8Array;
  tex: THREE.DataTexture;
  dirty: boolean;
}

export interface SpriteFrame {
  tex: THREE.DataTexture;
  /** 모음 텍스처 안 자리 (그림이 있는 네모의 왼쪽 위) */
  ax: number;
  ay: number;
  f: CellFrame;
}

export class SpriteAtlas {
  readonly pages: Page[] = [];
  readonly palette: THREE.DataTexture;
  private readonly rows = new Map<string, number>();
  private readonly placed = new Map<string, SpriteFrame[]>();
  private shelfX = 0;
  private shelfY = 0;
  private shelfH = 0;
  /** 불러오기 화면이 미리 넣지 못해 대련 중에 그 자리에서 넣은 동작 수 (확인용, 0이어야 한다) */
  misses = 0;

  constructor() {
    // 색 묶음 표: 줄 = 겉모습 × 색 묶음, 칸 = 색 번호 (0은 투명)
    const skins = Object.keys(SKINS) as SkinId[];
    const looks = Object.keys(LOOKS) as LookName[];
    const W = 32;
    const H = skins.length * looks.length;
    const px = new Uint8Array(W * H * 4);
    let row = 0;
    for (const s of skins) {
      for (const l of looks) {
        const tbl = lookTable(lookOf(s, l));
        tbl.forEach((c, i) => {
          if (!c || !i) return;
          px.set([c[0], c[1], c[2], 255], (row * W + i) * 4);
        });
        this.rows.set(`${s}/${l}`, row++);
      }
    }
    this.palette = new THREE.DataTexture(px, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.palette.colorSpace = THREE.SRGBColorSpace;
    nearest(this.palette);
    this.palette.needsUpdate = true;
  }

  /** 색 묶음 표의 줄 */
  row(skin: SkinId, look: LookName): number {
    return this.rows.get(`${skin}/${look}`) ?? 0;
  }

  has(m: BakedMotion, skin: SkinId): boolean {
    return this.placed.has(`${m.name}|${skin}`);
  }

  /** 여러 동작을 한꺼번에 넣는다: 키 큰 그림부터 줄 지어 (빈 곳이 덜 생기게). 그림은 미리 그려 둬야 빠르다 */
  placeAll(list: ReadonlyArray<readonly [BakedMotion, SkinId]>): void {
    const items: Array<{ key: string; i: number; f: CellFrame }> = [];
    for (const [m, skin] of list) {
      const key = `${m.name}|${skin}`;
      if (this.placed.has(key)) continue;
      const frames = m.frames(skin);
      this.placed.set(key, new Array<SpriteFrame>(frames.length));
      frames.forEach((f, i) => items.push({ key, i, f }));
    }
    items.sort((a, b) => b.f.h - a.f.h || b.f.w - a.f.w);
    for (const it of items) this.placed.get(it.key)![it.i] = this.put(it.f);
  }

  /** 한 프레임 (넣지 않은 동작이면 그 자리에서 그려 넣는다: 불러오기 화면이 빠뜨린 것만) */
  get(m: BakedMotion, skin: SkinId, frame: number): SpriteFrame {
    let list = this.placed.get(`${m.name}|${skin}`);
    if (!list) {
      this.misses++;
      this.placeAll([[m, skin]]);
      // 바뀐 장은 다음 그리기 때 다시 올린다
      this.upload();
      list = this.placed.get(`${m.name}|${skin}`)!;
    }
    return list[Math.min(frame, list.length - 1)]!;
  }

  /** 바뀐 장을 GPU로 올린다 (renderer가 있으면 지금 바로, 없으면 다음 그리기 때) */
  upload(renderer?: THREE.WebGLRenderer): void {
    for (const p of this.pages) {
      if (!p.dirty) continue;
      p.dirty = false;
      p.tex.needsUpdate = true;
      renderer?.initTexture(p.tex);
    }
    renderer?.initTexture(this.palette);
  }

  /** 모음 텍스처 크기 합 (MB, 확인용) */
  get megabytes(): number {
    return (this.pages.length * PAGE * PAGE) / (1024 * 1024);
  }

  private put(f: CellFrame): SpriteFrame {
    const w = f.w + PAD * 2;
    const h = f.h + PAD * 2;
    if (this.pages.length === 0 || this.shelfX + w > PAGE) {
      this.shelfY += this.shelfH;
      this.shelfX = 0;
      this.shelfH = 0;
    }
    if (this.pages.length === 0 || this.shelfY + h > PAGE) {
      this.newPage();
      this.shelfX = 0;
      this.shelfY = 0;
      this.shelfH = 0;
    }
    const p = this.pages[this.pages.length - 1]!;
    const ax = this.shelfX + PAD;
    const ay = this.shelfY + PAD;
    for (let y = 0; y < f.h; y++) p.data.set(f.a.subarray(y * f.w, (y + 1) * f.w), (ay + y) * PAGE + ax);
    p.dirty = true;
    this.shelfX += w;
    this.shelfH = Math.max(this.shelfH, h);
    return { tex: p.tex, ax, ay, f };
  }

  private newPage(): void {
    const data = new Uint8Array(PAGE * PAGE);
    const tex = new THREE.DataTexture(data, PAGE, PAGE, THREE.RedFormat, THREE.UnsignedByteType);
    nearest(tex);
    tex.unpackAlignment = 1;
    this.pages.push({ data, tex, dirty: true });
  }
}

function nearest(t: THREE.Texture): void {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
}
