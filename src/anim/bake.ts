import { keyed } from './keyed';
import { DEFAULT_CELL, FOOT_X, FOOT_Y, type Motion, type MotionData } from './motion';
import { solve } from './pose';
import { Indexed } from './raster';
import { drawSkeleton, LOOKS, toImageData, type LookName } from './skeleton';

interface Baked {
  right: HTMLCanvasElement;
  left: HTMLCanvasElement;
}

/**
 * 동작 데이터 → 동작. 관절은 바로 풀고, 시트(프레임을 가로로 늘어놓은 캔버스)는
 * bake()에서 색 한 벌마다 오른쪽·왼쪽 두 장씩 미리 그린다. 게임 중에는 시트를 잘라 붙이기만 한다.
 */
export function buildMotion(d: MotionData): Motion & { bake(): void } {
  const n = d.dur.length;
  const joints = keyed(n, d.keys).map(solve);
  const cell = DEFAULT_CELL;
  let sheets: Record<LookName, Baked> | null = null;

  const bake = () => {
    if (sheets) return;
    const img = new Indexed(n * cell, cell);
    joints.forEach((j, i) => drawSkeleton(img, j, i * cell + FOOT_X, FOOT_Y));
    const make = (look: LookName): Baked => {
      const right = document.createElement('canvas');
      right.width = img.w;
      right.height = img.h;
      right.getContext('2d')!.putImageData(toImageData(img, LOOKS[look]), 0, 0);
      // 왼쪽: 칸마다 좌우를 뒤집는다 (칸 순서는 그대로)
      const left = document.createElement('canvas');
      left.width = img.w;
      left.height = img.h;
      const lc = left.getContext('2d')!;
      lc.scale(-1, 1);
      for (let i = 0; i < n; i++) lc.drawImage(right, i * cell, 0, cell, cell, -(i + 1) * cell, 0, cell, cell);
      return { right, left };
    };
    sheets = { p1: make('p1'), p2: make('p2') };
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
      bake();
      const s = sheets![opts.look ?? 'p1'];
      ctx.drawImage(opts.flip ? s.left : s.right, frame * cell, 0, cell, cell, ox, oy, cell, cell);
    },
  };
}
