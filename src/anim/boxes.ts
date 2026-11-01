import type { JointName, Joints } from './pose';

/** 상자. 발밑 기준점 상대 좌표, 오른쪽을 보는 기준 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 공격 판정: 이 프레임들에서 limb[0]→limb[1] 구간 끝쪽 (팔꿈치→주먹, 무릎→발) */
export interface HitSpec {
  frames: readonly number[];
  limb: readonly [JointName, JointName];
  /** 번개 사거리 (px): 구간 끝(주먹·발·무릎)에서 그 구간 방향으로 이만큼 더 닿는다 (붉은 전격이 뻗는 만큼) */
  reach?: number;
}

/** 피격 판정에 넣을 관절과 여유 (px) */
const HURT: ReadonlyArray<[JointName, number]> = [
  ['head', 6], ['neck', 4], ['hip', 4], ['kF', 3], ['kB', 3], ['fF', 3], ['fB', 3], ['eF', 3], ['eB', 3],
];

/** 피격 상자: 몸 관절을 감싼 상자 */
export function hurtBox(j: Joints): Box {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [k, r] of HURT) {
    const [x, y] = j[k];
    x0 = Math.min(x0, x - r);
    x1 = Math.max(x1, x + r);
    y0 = Math.min(y0, y - r);
    y1 = Math.max(y1, y + r);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * 공격 상자: 구간의 끝쪽 1/3 + 여유 4px. 판정 프레임이 아니면 null.
 * 번개 사거리(reach)가 있으면 구간 끝에서 구간 방향으로 reach px 더 뻗은 자리까지 감싼다.
 * 관절이 정수라 제곱근·곱·나눗셈(IEEE 정확한 반올림)과 Math.round만 써서 어느 브라우저에서나 같은 값이 나온다 (sim 판정)
 */
export function hitBox(j: Joints, frame: number, spec?: HitSpec): Box | null {
  if (!spec || !spec.frames.includes(frame)) return null;
  const [ax, ay] = j[spec.limb[0]];
  const [bx, by] = j[spec.limb[1]];
  const mx = Math.round((ax + bx * 2) / 3);
  const my = Math.round((ay + by * 2) / 3);
  const [tx, ty] = reachTip(ax, ay, bx, by, spec.reach ?? 0);
  const x0 = Math.min(mx, bx, tx);
  const y0 = Math.min(my, by, ty);
  return {
    x: x0 - 4,
    y: y0 - 4,
    w: Math.max(mx, bx, tx) - x0 + 8,
    h: Math.max(my, by, ty) - y0 + 8,
  };
}

/** 구간 a→b 끝에서 같은 방향으로 reach px 더 간 자리 (정수). 구간 길이가 0이면 끝 그대로 */
export function reachTip(ax: number, ay: number, bx: number, by: number, reach: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!reach || len < 1) return [bx, by];
  return [bx + Math.round((dx * reach) / len), by + Math.round((dy * reach) / len)];
}
