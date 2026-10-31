import * as THREE from 'three';
import { CHUNK, GRIDS } from '../../stage/citadel';
import { litMaterial, pixelTexture } from './shaders';
import { paintSwatches } from './tex';

/**
 * 2.5D 무대 짓기 도구 (렌더 전용): 상자·판 하나, 여러 상자를 한 덩어리로 묶는 기하 (그리기 호출을 줄인다).
 * 부서지는 건물에 붙은 것(몸통·처마·차양·비상계단·배관…)은 꼭짓점마다 '건물 번호 + 1, 칸'을 달아 두고,
 * 그 칸이 무너지면 셰이더가 그 부분만 지운다 (shaders.ts의 ATTACHED, lights.ts의 uGone).
 */

/** 상자 하나 (월드 좌표 x0~x1, 바닥 위 y0~y1, 깊이 z0~z1) */
export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

/** 정면만 보이는 판 (월드 좌표, 깊이 z) */
export function plane(x0: number, x1: number, y0: number, y1: number, z: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  return m;
}

/** 면: +x, -x, 윗면, 밑면, 앞(카메라 쪽), 뒤 */
export type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
export const FACES: readonly Face[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
/** 카메라에서 보이는 면 (뒤·밑은 거의 보이지 않는다) */
export const SEEN: readonly Face[] = ['px', 'nx', 'py', 'pz'];

/** 꼭짓점 자리 → 텍스처 좌표 */
export type UvFn = (face: Face, x: number, y: number, z: number) => [number, number];

/** 면마다 꼭짓점 넷 (밖에서 볼 때 왼쪽 아래 → 오른쪽 아래 → 오른쪽 위 → 왼쪽 위)과 법선 */
const CORNERS: Record<Face, { n: [number, number, number]; c: Array<[0 | 1, 0 | 1, 0 | 1]> }> = {
  pz: { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  nz: { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  px: { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  nx: { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  py: { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  ny: { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
};
const FIT: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** 붙은 자리: [건물 번호 + 1, 칸]. [0, 0]이면 어디에도 붙지 않음 (무너져도 남는다) */
export type Attach = readonly [number, number];
export const FREE: Attach = [0, 0];

/** 건물 bi의 월드 x 자리가 몇째 칸인가 */
export function attachAt(bi: number, x: number): Attach {
  if (bi < 0) return FREE;
  const g = GRIDS[bi];
  return [bi + 1, Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.x) / CHUNK)))];
}

/**
 * 상자 여러 개를 재질별로 묶은 기하 하나. 재질 이름마다 그리기 호출이 한 번.
 */
export class Geo {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly bc: number[] = [];
  private readonly idx = new Map<string, number[]>();
  private n = 0;

  get empty(): boolean {
    return this.n === 0;
  }

  /** 꼭짓점 넷짜리 면 하나 */
  quad(key: string, pts: ReadonlyArray<readonly [number, number, number]>, normal: readonly [number, number, number], uvs: ReadonlyArray<readonly [number, number]>, at: Attach = FREE): void {
    let list = this.idx.get(key);
    if (!list) {
      list = [];
      this.idx.set(key, list);
    }
    const b = this.n;
    for (let k = 0; k < 4; k++) {
      this.pos.push(pts[k][0], pts[k][1], pts[k][2]);
      this.nor.push(normal[0], normal[1], normal[2]);
      this.uv.push(uvs[k][0], uvs[k][1]);
      this.bc.push(at[0], at[1]);
    }
    list.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }

  /**
   * 상자 하나. key: 모든 면에 같은 재질이면 이름 하나, 면마다 다르면 {면: 재질 이름} (없는 면은 만들지 않는다).
   * uv를 주지 않으면 면마다 텍스처 한 장을 꽉 채운다.
   */
  box(
    key: string | Partial<Record<Face, string>>, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    uv: UvFn | null = null, at: Attach = FREE, faces: readonly Face[] = FACES,
  ): void {
    const xs = [x0, x1];
    const ys = [y0, y1];
    const zs = [z0, z1];
    for (const f of faces) {
      const k = typeof key === 'string' ? key : key[f];
      if (!k) continue;
      const { n, c } = CORNERS[f];
      const pts = c.map(([i, j, l]) => [xs[i], ys[j], zs[l]] as const);
      const uvs = uv ? pts.map((p) => uv(f, p[0], p[1], p[2])) : FIT;
      this.quad(k, pts, n, uvs, at);
    }
  }

  /** 건물 bi에 붙은 상자: 칸(16px) 경계마다 잘라서 칸 번호를 단다 (무너진 칸 부분만 사라지게) */
  attachedBox(
    bi: number, key: string | Partial<Record<Face, string>>, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    uv: UvFn | null = null, faces: readonly Face[] = FACES,
  ): void {
    if (bi < 0) {
      this.box(key, x0, x1, y0, y1, z0, z1, uv, FREE, faces);
      return;
    }
    const g = GRIDS[bi];
    let x = x0;
    while (x < x1 - 1e-6) {
      const c = Math.max(0, Math.min(g.cols - 1, Math.floor((x + 1e-6 - g.x) / CHUNK)));
      const end = c >= g.cols - 1 ? x1 : Math.min(x1, g.x + (c + 1) * CHUNK);
      // 잘린 안쪽 면도 둔다: 옆 칸이 무너지면 부서진 단면이 된다
      this.box(key, x, end, y0, y1, z0, z1, uv, [bi + 1, c], faces);
      x = end;
    }
  }

  /** 재질 이름 → 재질. 붙은 상자가 있으면 재질이 ATTACHED여야 무너진 칸이 사라진다 */
  build(materials: Record<string, THREE.Material>): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('bc', new THREE.Float32BufferAttribute(this.bc, 2));
    const keys = [...this.idx.keys()];
    const all: number[] = [];
    keys.forEach((k, mi) => {
      const list = this.idx.get(k)!;
      g.addGroup(all.length, list.length, mi);
      for (const v of list) all.push(v);
    });
    g.setIndex(all);
    g.computeBoundingSphere();
    const mats = keys.map((k) => {
      const m = materials[k];
      if (!m) throw new Error(`재질 없음: ${k}`);
      return m;
    });
    return new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
  }
}

/** 작은 장식 상자들 (배관·실외기·물탱크·쓰레기봉투…)을 색 칸 텍스처 하나와 한 덩어리로 묶는다 (그리기 호출 1번) */
export class Details {
  private readonly colors: string[] = [];
  private readonly geo = new Geo();

  private uvOf(color: string): [number, number] {
    let i = this.colors.indexOf(color);
    if (i < 0) {
      i = this.colors.length;
      this.colors.push(color);
    }
    return [((i % 16) * 4 + 2) / 64, 1 - (Math.floor(i / 16) * 4 + 2) / 64];
  }

  /** 상자 하나 (at: 붙은 건물 칸) */
  add(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string, at: Attach = FREE, faces: readonly Face[] = FACES): void {
    const uv = this.uvOf(color);
    this.geo.box('d', x0, x1, y0, y1, z0, z1, () => uv, at, faces);
  }

  /** 건물 bi에 붙은 긴 상자 (칸마다 잘라 무너진 칸 부분만 사라진다) */
  addAttached(bi: number, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string): void {
    const uv = this.uvOf(color);
    this.geo.attachedBox(bi, 'd', x0, x1, y0, y1, z0, z1, () => uv);
  }

  /** 기울어진 막대 (난간 기둥·계단 옆판·쓰러진 것): (x0, y0)에서 (x1, y1)까지, 굵기 t, 깊이 z0~z1 */
  bar(x0: number, y0: number, x1: number, y1: number, t: number, z0: number, z1: number, color: string, at: Attach = FREE): void {
    const uv = this.uvOf(color);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (t / 2);
    const ny = (dx / len) * (t / 2);
    const p = (x: number, y: number, z: number) => [x, y, z] as const;
    const uvs = [uv, uv, uv, uv];
    // 앞면과 윗면만 (얇은 막대는 옆이 거의 보이지 않는다)
    this.geo.quad('d', [p(x0 - nx, y0 - ny, z1), p(x1 - nx, y1 - ny, z1), p(x1 + nx, y1 + ny, z1), p(x0 + nx, y0 + ny, z1)], [0, 0, 1], uvs, at);
    this.geo.quad('d', [p(x0 + nx, y0 + ny, z1), p(x1 + nx, y1 + ny, z1), p(x1 + nx, y1 + ny, z0), p(x0 + nx, y0 + ny, z0)], [0, 1, 0], uvs, at);
  }

  get empty(): boolean {
    return this.geo.empty;
  }

  build(): THREE.Mesh {
    return this.geo.build({ d: litMaterial(pixelTexture(paintSwatches(this.colors)), { attached: true }) });
  }
}

/**
 * 면마다 재질이 다른 상자: 보이는 면만 만들고 같은 재질의 면은 한 번에 그린다
 * (THREE.BoxGeometry에 재질 배열을 주면 면 여섯 개를 따로 그린다). 텍스처는 면마다 한 장을 꽉 채운다.
 */
export function facedBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mats: Partial<Record<Face, THREE.Material>>): THREE.Mesh {
  const geo = new Geo();
  facedInto(geo, x0, x1, y0, y1, z0, z1, mats);
  return geo.build(matKeys(mats));
}

/** facedBox와 같지만 여러 상자를 한 기하에 모은다 (재질이 같으면 한 번에 그린다). build(matKeys(…))로 마무리 */
export function facedInto(geo: Geo, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mats: Partial<Record<Face, THREE.Material>>): void {
  const keys: Partial<Record<Face, string>> = {};
  for (const [f, m] of Object.entries(mats) as Array<[Face, THREE.Material]>) keys[f] = `m${m.id}`;
  geo.box(keys, x0, x1, y0, y1, z0, z1, null, FREE, Object.keys(mats) as Face[]);
}

/** 재질 이름 표 (facedInto가 쓰는 이름) */
export function matKeys(...list: Array<Partial<Record<Face, THREE.Material>>>): Record<string, THREE.Material> {
  const out: Record<string, THREE.Material> = {};
  for (const mats of list) for (const m of Object.values(mats)) if (m) out[`m${m.id}`] = m;
  return out;
}
