import { bakeFollow } from './follow';
import { keyed } from './keyed';
import { MAX_CELL, SMALL_CELL, WIDE_CELL, type Motion, type MotionData } from './motion';
import { solve, type Joints, type Point } from './pose';
import { Indexed, outlineSilhouette } from './raster';
import { drawSkeleton, lookTable, SLOT, type LookName } from './skeleton';
import { lookOf, SKINS, type SkinId } from './skins';

/** 동작 한 프레임의 그림: 색 번호, 칸 안에서 그림이 있는 네모(x, y, w, h)만 잘라 둔다 (비었으면 w = 0) */
export interface CellFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  a: Uint8Array;
}

/** 이 캐릭터 겉모습·색 묶음의 색 번호 → 픽셀 (RGBA를 리틀엔디언 32비트 하나로). 확인 도구·실루엣·2D 그리기가 같이 쓴다 */
const rgbaCache = new Map<string, Uint32Array>();
export function lookRGBA(skin: SkinId, look: LookName): Uint32Array {
  const key = `${skin}/${look}`;
  let t = rgbaCache.get(key);
  if (!t) {
    const tbl = lookTable(lookOf(skin, look));
    t = new Uint32Array(tbl.length);
    tbl.forEach((c, i) => {
      if (c && i) t![i] = ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
    });
    rgbaCache.set(key, t);
  }
  return t;
}

/** 2D로 한 프레임을 옮겨 그릴 때 쓰는 칸 하나 크기 캔버스 (가장 큰 칸, 처음 그릴 때 한 번 만든다) */
let scratch: { c: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData; px: Uint32Array } | null = null;
function scratchCell() {
  if (!scratch) {
    const c = document.createElement('canvas');
    c.width = MAX_CELL.w;
    c.height = MAX_CELL.h;
    const g = c.getContext('2d')!;
    const img = g.createImageData(MAX_CELL.w, MAX_CELL.h);
    scratch = { c, g, img, px: new Uint32Array(img.data.buffer) };
  }
  return scratch;
}

/** 그림을 다 그린 동작 프레임 수 (불러오기 막대용) */
export const bakeStats = { frames: 0, ms: 0 };

/**
 * 동작 데이터 → 동작. 관절은 바로 풀고, 그림(프레임마다 색 번호)은 캐릭터 겉모습(스킨)마다 처음 쓸 때 그린다.
 * 대련에서는 불러오기 화면이 미리 다 그려 둔다 (bakeSome으로 조금씩). 색은 그릴 때 입힌다:
 * 3D 화면은 셰이더가 색 번호를 색 묶음 표로 바꾸고(render/gl/sprites), 2D는 draw가 칸 하나만 바꿔 옮긴다.
 */
export type BakedMotion = Motion & Required<Pick<Motion, 'image' | 'rgba' | 'frames' | 'bakeSome' | 'isBaked'>>;

export function buildMotion(d: MotionData): BakedMotion {
  const n = d.dur.length;
  // 몸 크기 배율 (에드워드처럼 큰 체격): 관절을 발밑 기준점에서 키운다. sim 판정도 이 관절을 쓰므로 함께 커진다
  const joints = keyed(n, d.keys).map((p) => solve(p, d.scale ?? 1));
  // 따라 움직이는 것 (연검 리본·옷자락·머리): 동작 자신의 손·몸 움직임으로 한 번 계산해 관절에 붙인다
  if (d.follow) bakeFollow(d.name, d.follow, joints, d.dur, !!d.loop).forEach((fx, i) => (joints[i] = { ...joints[i]!, fx }));
  const cell = d.cell ?? (d.wide ? WIDE_CELL : SMALL_CELL);
  const { w: cw, h: ch, fx, fy } = cell;
  // 그리는 관절: 스미어 프레임만 치는 팔다리를 늘린다 (판정 관절 joints는 그대로)
  const drawn = joints.map((j, i) => (d.smear && d.smear.frame === i ? smeared(j, d.smear.limb, d.smear.stretch) : j));
  const baked = new Map<SkinId, CellFrame[]>();
  /** 칸 하나 크기 그림 (겉모습마다 돌려 쓴다) */
  let canvasCell: Indexed | null = null;
  /** 이 겉모습으로 그리다가 칸 가장자리에 닿은 프레임이 있었나 (있으면 다 그린 뒤 예전 방식으로 다시 그린다) */
  const touched = new Set<SkinId>();
  const decorOf = (skin: SkinId) => (SKINS[skin] as { decor?: Parameters<typeof drawSkeleton>[4] }).decor;
  const ghostOf = (i: number) => (d.smear?.ghosts && d.smear.frame === i && i > 0 ? { prev: joints[i - 1], n: d.smear.ghosts } : undefined);

  /** 칸 안에서 그림이 있는 네모만 잘라 둔다 */
  const crop = (a: Uint8Array, stride: number, ox: number): CellFrame => {
    let x0 = cw;
    let y0 = ch;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (!a[y * stride + ox + x]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return { x: 0, y: 0, w: 0, h: 0, a: new Uint8Array(0) };
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) out.set(a.subarray((y0 + y) * stride + ox + x0, (y0 + y) * stride + ox + x0 + w), y * w);
    return { x: x0, y: y0, w, h, a: out };
  };

  /** i번 프레임을 칸 하나 크기에 그린다 */
  const bakeFrame = (skin: SkinId, i: number): CellFrame => {
    const t0 = performance.now();
    const img = canvasCell ?? (canvasCell = new Indexed(cw, ch));
    img.a.fill(0);
    // 좌표는 예전 긴 띠 그대로 (이 칸이 띠에서 시작하는 x부터의 창): 반올림·소수 좌표까지 예전 그림과 같게
    img.ox = i * cw;
    img.stride = n * cw;
    const decor = decorOf(skin);
    // 스미어 프레임: 앞 프레임 관절에서 지금까지 잔상 (장식이 ghost를 그리는 캐릭터만)
    drawSkeleton(img, drawn[i]!, i * cw + fx, fy, decor, [i * cw, (i + 1) * cw], ghostOf(i));
    // 예전 그림과 같게: 예전에는 프레임을 긴 띠에 차례로 그리며 뒤 프레임마다 띠 전체에 외곽선 처리를 다시 돌렸다.
    // 그래서 i번 프레임은 그 처리를 (n − i)번 받아 몸 사이 빈틈이 한 겹씩 더 메워졌다. 같은 횟수만큼 (더 바뀌지 않으면 그만) 되풀이한다
    for (let k = i + 1; k < n; k++) if (!outlineSilhouette(img, SLOT.outline, decor?.keepHoles ?? 0)) break;
    // 몸이 칸 왼쪽·오른쪽 끝 줄에 닿았나: 예전 띠에서는 옆 칸으로 번지고(외곽선·팔다리) 옆 프레임도 이 칸에 번졌다
    for (let y = 0; y < ch && !touched.has(skin); y++) {
      const l = img.a[y * cw]!;
      const r = img.a[y * cw + cw - 1]!;
      if ((l && l !== SLOT.outline) || (r && r !== SLOT.outline)) touched.add(skin);
    }
    const f = crop(img.a, cw, 0);
    bakeStats.frames++;
    bakeStats.ms += performance.now() - t0;
    return f;
  };

  /** 칸 끝에 닿는 프레임이 있는 동작: 예전처럼 긴 띠 한 장에 차례로 그려 옆 칸 번짐까지 같은 그림으로 (그런 동작은 몇 안 된다) */
  const bakeStrip = (skin: SkinId): CellFrame[] => {
    const t0 = performance.now();
    const img = new Indexed(n * cw, ch);
    const decor = decorOf(skin);
    drawn.forEach((j, i) => drawSkeleton(img, j, i * cw + fx, fy, decor, [i * cw, (i + 1) * cw], ghostOf(i)));
    const out = drawn.map((_, i) => crop(img.a, img.w, i * cw));
    bakeStats.ms += performance.now() - t0;
    return out;
  };
  const listOf = (skin: SkinId): CellFrame[] => {
    let list = baked.get(skin);
    if (!list) baked.set(skin, (list = []));
    return list;
  };
  /** 시간이 deadline(performance.now)을 넘을 때까지 그린다. 다 그렸으면 true */
  const bakeSome = (skin: SkinId, deadline = Infinity): boolean => {
    const list = listOf(skin);
    if (list.length >= n) return true;
    while (list.length < n) {
      list.push(bakeFrame(skin, list.length));
      if (list.length >= n && touched.has(skin)) {
        const exact = bakeStrip(skin);
        exact.forEach((f, i) => (list[i] = f));
      }
      if (performance.now() > deadline) break;
    }
    return list.length >= n;
  };
  const frames = (skin: SkinId): readonly CellFrame[] => {
    bakeSome(skin);
    return baked.get(skin)!;
  };

  /** 한 프레임을 이 색 묶음으로 칸 캔버스에 옮긴다: 캔버스와 칸 안 자리 (좌우 뒤집기 포함) */
  const image = (frame: number, look: LookName, flip: boolean, skin: SkinId) => {
    const f = frames(skin)[frame]!;
    const s = scratchCell();
    if (f.w) {
      const tbl = lookRGBA(skin, look);
      const W = MAX_CELL.w;
      for (let y = 0; y < f.h; y++) {
        const row = y * f.w;
        const out = y * W;
        if (flip) for (let x = 0; x < f.w; x++) s.px[out + x] = tbl[f.a[row + f.w - 1 - x]!]!;
        else for (let x = 0; x < f.w; x++) s.px[out + x] = tbl[f.a[row + x]!]!;
      }
      s.g.putImageData(s.img, 0, 0, 0, 0, f.w, f.h);
    }
    return { canvas: s.c, x: flip ? cw - f.x - f.w : f.x, y: f.y, w: f.w, h: f.h };
  };

  return {
    name: d.name,
    label: d.label,
    cell,
    dur: d.dur,
    loop: d.loop,
    joints,
    hit: d.hit,
    frames,
    bakeSome,
    isBaked: (skin) => (baked.get(skin)?.length ?? 0) >= n,
    image(frame, opts = {}) {
      return image(frame, opts.look ?? 'p1', !!opts.flip, opts.skin ?? 'base');
    },
    draw(ctx, frame, ox, oy, opts = {}) {
      const im = image(frame, opts.look ?? 'p1', !!opts.flip, opts.skin ?? 'base');
      if (im.w) ctx.drawImage(im.canvas, 0, 0, im.w, im.h, ox + im.x, oy + im.y, im.w, im.h);
    },
    rgba(frame, opts = {}) {
      const f = frames(opts.skin ?? 'base')[frame]!;
      const tbl = lookRGBA(opts.skin ?? 'base', opts.look ?? 'p1');
      const out = new Uint32Array(cw * ch);
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const c = f.a[y * f.w + x]!;
          if (c) out[(f.y + y) * cw + (opts.flip ? cw - 1 - (f.x + x) : f.x + x)] = tbl[c]!;
        }
      }
      return out;
    },
  };
}

/**
 * 스미어: 치는 팔(어깨→팔꿈치→주먹)이나 다리(엉덩이→무릎→발)를 stretch배 길이로 늘려 그린다.
 * 위쪽 마디(위팔·허벅지)는 그대로 두고 아래 마디를 늘려 끝을 멀리 보낸다 (늘어난 길이 = 팔다리 전체 길이 × (stretch − 1)).
 * 동작 점검(tools/motioncheck.mjs)이 그림과 같은 실루엣을 뽑으려고 함께 쓴다
 */
export function smeared(j: Joints, limb: 'aF' | 'aB' | 'lF' | 'lB' | 'kF' | 'kB', stretch: number): Joints {
  // 무릎 기술: 허벅지를 늘려 무릎을 멀리 보내고 정강이는 함께 옮긴다
  if (limb === 'kF' || limb === 'kB') {
    const knee = limb === 'kF' ? 'kF' : 'kB';
    const foot = limb === 'kF' ? 'fF' : 'fB';
    const h = j.hip;
    const k = j[knee];
    const nk: Point = [Math.round(h[0] + (k[0] - h[0]) * stretch), Math.round(h[1] + (k[1] - h[1]) * stretch)];
    return { ...j, [knee]: nk, [foot]: [j[foot][0] + nk[0] - k[0], j[foot][1] + nk[1] - k[1]] };
  }
  const [root, mid, end] = (
    { aF: ['shF', 'eF', 'hF'], aB: ['shB', 'eB', 'hB'], lF: ['hip', 'kF', 'fF'], lB: ['hip', 'kB', 'fB'] } as const
  )[limb];
  const a = j[root];
  const b = j[mid];
  const c = j[end];
  const upper = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const lower = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
  const k = (lower + (upper + lower) * (stretch - 1)) / lower;
  const tip: Point = [Math.round(b[0] + (c[0] - b[0]) * k), Math.round(b[1] + (c[1] - b[1]) * k)];
  return { ...j, [end]: tip };
}
