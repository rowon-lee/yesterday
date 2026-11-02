import type { Joints, Point } from '../pose';
import { toeOf, type DecorPart, type DecorPen } from '../skeleton';

/*
 * 캐릭터 장식 공용 도구: 벡터 계산, 몸통·머리 좌표, 바지(다리를 옷 색으로 덮기), 자락이 휘날리는 정도.
 * 좌표는 발밑 기준점 상대, 오른쪽을 보는 모습 기준.
 */

export const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k];
export const norm = (v: Point): Point => {
  const d = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / d, v[1] / d];
};
export const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1];

/** 몸통 방향(엉덩이 → 목)과 몸의 앞쪽 (오른쪽을 볼 때 가슴 쪽), 뒤쪽 */
export function torso(j: Joints): { up: Point; down: Point; front: Point; back: Point } {
  const up = norm([j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]]);
  return { up, down: [-up[0], -up[1]], front: [-up[1], up[0]], back: [up[1], -up[0]] };
}

/** 머리 좌표: at([앞 +, 위 +]) → 칸 좌표. 머리 기울기를 따른다 (머리 반지름 5 기준) */
export function headFrame(j: Joints): { c: Point; u: Point; f: Point; at: (p: readonly [number, number]) => Point } {
  const c = j.head;
  const u: Point = [Math.sin(j.ha), -Math.cos(j.ha)];
  const f: Point = [-u[1], u[0]];
  return { c, u, f, at: (p) => [c[0] + f[0] * p[0] + u[0] * p[1], c[1] + f[1] * p[0] + u[1] * p[1]] };
}

/**
 * 바지(와 신발): 엉덩이 → 무릎 → 발목 → 발끝을 다리 굵기 그대로 옷 색으로 덮는다 (뼈대가 그린 다리와 같은 자리라 외곽선은 그대로).
 * 뒷다리는 backLeg 훅에서 'clothBack'으로 (한 단계 어둡게), 앞다리는 body 훅에서 'cloth'로 부른다
 */
export function trousers(pen: DecorPen, j: Joints, which: 'F' | 'B', width: number, part: DecorPart): void {
  const knee = which === 'F' ? j.kF : j.kB;
  const foot = which === 'F' ? j.fF : j.fB;
  pen.fill(part, (s) => {
    s.line(j.hip, knee, width);
    s.line(knee, foot, width);
    s.line(foot, toeOf(knee, foot), width);
  });
}

/**
 * 자락이 뒤로 휘날리는 정도 (0 늘어짐 ~ 1 크게 휘날림). 그림에는 속도가 없으니 몸이 앞으로 숙을수록,
 * 뒷다리가 엉덩이 뒤로 멀리 갈수록 (달리기·내딛기) 크게 휘날린다
 */
export function flutter(j: Joints): number {
  const { up, back } = torso(j);
  const lean = Math.max(0, Math.min(1, (up[0] - 0.1) / 0.6));
  const behind = dot([j.fB[0] - j.hip[0], j.fB[1] - j.hip[1]], back);
  const stride = Math.max(0, Math.min(1, (behind - 6) / 12));
  return Math.max(lean, stride * 0.8);
}

/** 늘어진 자락의 방향: 몸 아래와 중력을 섞고, 휘날릴수록 뒤로 (k 0~1, gravity 중력 섞는 비율) */
export function hangDir(j: Joints, k: number, gravity = 0.5): Point {
  const { down, back } = torso(j);
  return norm([down[0] * (1 - gravity) + back[0] * (0.2 + 0.9 * k), down[1] * (1 - gravity) + gravity + back[1] * (0.2 + 0.9 * k)]);
}
