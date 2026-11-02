import { bakeFollow } from './follow';
import { keyed } from './keyed';
import { SMALL_CELL, WIDE_CELL, type Motion, type MotionData } from './motion';
import { solve, type Joints, type Point } from './pose';
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
  // 몸 크기 배율 (에드워드처럼 큰 체격): 관절을 발밑 기준점에서 키운다. sim 판정도 이 관절을 쓰므로 함께 커진다
  const joints = keyed(n, d.keys).map((p) => solve(p, d.scale ?? 1));
  // 따라 움직이는 것 (연검 리본·옷자락·머리): 동작 자신의 손·몸 움직임으로 한 번 계산해 관절에 붙인다
  if (d.follow) bakeFollow(d.name, d.follow, joints, d.dur, !!d.loop).forEach((fx, i) => (joints[i] = { ...joints[i]!, fx }));
  const cell = d.wide ? WIDE_CELL : SMALL_CELL;
  const { w: cw, h: ch, fx, fy } = cell;
  // 그리는 관절: 스미어 프레임만 치는 팔다리를 늘린다 (판정 관절 joints는 그대로)
  const drawn = joints.map((j, i) => (d.smear && d.smear.frame === i ? smeared(j, d.smear.limb, d.smear.stretch) : j));
  const baked = new Map<SkinId, Record<LookName, Baked>>();

  const bakeSkin = (skin: SkinId): Record<LookName, Baked> => {
    const done = baked.get(skin);
    if (done) return done;
    const img = new Indexed(n * cw, ch);
    const decor = (SKINS[skin] as { decor?: Parameters<typeof drawSkeleton>[4] }).decor;
    drawn.forEach((j, i) => {
      // 스미어 프레임: 앞 프레임 관절에서 지금까지 잔상 (장식이 ghost를 그리는 캐릭터만)
      const g = d.smear?.ghosts && d.smear.frame === i && i > 0 ? { prev: joints[i - 1], n: d.smear.ghosts } : undefined;
      drawSkeleton(img, j, i * cw + fx, fy, decor, [i * cw, (i + 1) * cw], g);
    });
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
      for (let i = 0; i < n; i++) lc.drawImage(right, i * cw, 0, cw, ch, -(i + 1) * cw, 0, cw, ch);
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
      ctx.drawImage(opts.flip ? s.left : s.right, frame * cw, 0, cw, ch, ox, oy, cw, ch);
    },
    sheet(look, flip, skin = 'base') {
      const s = bakeSkin(skin)[look];
      return flip ? s.left : s.right;
    },
  };
}

/**
 * 스미어: 치는 팔(어깨→팔꿈치→주먹)이나 다리(엉덩이→무릎→발)를 stretch배 길이로 늘려 그린다.
 * 위쪽 마디(위팔·허벅지)는 그대로 두고 아래 마디를 늘려 끝을 멀리 보낸다 (늘어난 길이 = 팔다리 전체 길이 × (stretch − 1))
 */
function smeared(j: Joints, limb: 'aF' | 'aB' | 'lF' | 'lB' | 'kF' | 'kB', stretch: number): Joints {
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
