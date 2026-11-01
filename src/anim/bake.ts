import { keyed } from './keyed';
import { DEFAULT_CELL, FOOT_X, FOOT_Y, type Motion, type MotionData } from './motion';
import { solve } from './pose';
import { Indexed } from './raster';
import { drawSkeleton, LOOKS, toImageData, type LookName } from './skeleton';
import { lookOf, SKINS, type SkinId } from './skins';

interface Baked {
  right: HTMLCanvasElement;
  left: HTMLCanvasElement;
}

/**
 * 동작 데이터 → 동작. 관절은 바로 풀고, 시트(프레임을 가로로 늘어놓은 캔버스)는
 * 캐릭터 겉모습(스킨)마다 처음 쓸 때 색 한 벌마다 오른쪽·왼쪽 두 장씩 미리 그린다. 게임 중에는 시트를 잘라 붙이기만 한다.
 * bake()는 기본 스틱맨 겉모습을 미리 그린다 (시작할 때 한 번).
 */
export function buildMotion(d: MotionData): Motion & { bake(skin?: SkinId): void } {
  const n = d.dur.length;
  const joints = keyed(n, d.keys).map(solve);
  const cell = DEFAULT_CELL;
  const baked = new Map<SkinId, Record<LookName, Baked>>();

  const bakeSkin = (skin: SkinId): Record<LookName, Baked> => {
    const done = baked.get(skin);
    if (done) return done;
    const img = new Indexed(n * cell, cell);
    const decor = (SKINS[skin] as { decor?: Parameters<typeof drawSkeleton>[4] }).decor;
    joints.forEach((j, i) => drawSkeleton(img, j, i * cell + FOOT_X, FOOT_Y, decor, [i * cell, (i + 1) * cell]));
    const make = (look: LookName): Baked => {
      const right = document.createElement('canvas');
      right.width = img.w;
      right.height = img.h;
      right.getContext('2d')!.putImageData(toImageData(img, lookOf(skin, look)), 0, 0);
      // 왼쪽: 칸마다 좌우를 뒤집는다 (칸 순서는 그대로)
      const left = document.createElement('canvas');
      left.width = img.w;
      left.height = img.h;
      const lc = left.getContext('2d')!;
      lc.scale(-1, 1);
      for (let i = 0; i < n; i++) lc.drawImage(right, i * cell, 0, cell, cell, -(i + 1) * cell, 0, cell, cell);
      return { right, left };
    };
    const sheets = Object.fromEntries((Object.keys(LOOKS) as LookName[]).map((k) => [k, make(k)])) as Record<LookName, Baked>;
    baked.set(skin, sheets);
    return sheets;
  };
  const bake = (skin: SkinId = 'base') => {
    bakeSkin(skin);
  };

  return {
    name: d.name,
    label: d.label,
    cell,
    dur: d.dur,
    loop: d.loop,
    joints,
    hit: d.hit,
    bake,
    draw(ctx, frame, ox, oy, opts = {}) {
      const s = bakeSkin(opts.skin ?? 'base')[opts.look ?? 'p1'];
      ctx.drawImage(opts.flip ? s.left : s.right, frame * cell, 0, cell, cell, ox, oy, cell, cell);
    },
    sheet(look, flip, skin = 'base') {
      const s = bakeSkin(skin)[look];
      return flip ? s.left : s.right;
    },
  };
}
