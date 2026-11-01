/**
 * 포즈 = 엉덩이 위치, 몸통 기울기, 고개 각도, 양손 목표(어깨 기준), 양발 목표(발밑 기준).
 * 단위는 px와 도(°). 오른쪽을 보는 모습 기준, y는 아래가 +, 발밑 기준점이 (0, 0).
 */
export interface Pose {
  /** 엉덩이 위치 */
  hx: number;
  hy: number;
  /** 몸통 기울기 (앞으로 숙이면 +) */
  tl: number;
  /** 고개 각도 (몸통 기준, 앞으로 숙이면 +) */
  hd: number;
  /** 앞손 목표 (어깨 기준) */
  aFx: number;
  aFy: number;
  /** 뒷손 목표 (어깨 기준) */
  aBx: number;
  aBy: number;
  /** 앞발 목표 (발밑 기준) */
  lFx: number;
  lFy: number;
  /** 뒷발 목표 (발밑 기준) */
  lBx: number;
  lBy: number;
  /**
   * 어깨 비틀기 (px, 없으면 0): 몸을 비틀어 치는 쪽 어깨를 |tw|만큼 앞으로, 다른 쪽을 0.6배만큼 뒤로.
   * 양수면 앞어깨가(앞손으로 칠 때), 음수면 뒷어깨가(뒷손으로 칠 때) 앞장선다.
   * 손 목표는 각자 어깨 기준이라 치는 쪽 팔이 그만큼 더 나간다 (동작연출지침서 2장 '치는 쪽 어깨가 앞으로 4~6px')
   */
  tw?: number;
  /**
   * 무기 각도 (도, 없으면 0): 무기를 쥔 손에서 무기 끝(해머 머리 등)이 향하는 방향. 0 = 앞, 90 = 아래, -90 = 위, ±180 = 뒤.
   * 그림 전용 (캐릭터 장식이 읽는다. 판정은 공격 데이터의 궤적 상자). 무기가 있는 캐릭터만 쓴다 (에드워드 해머)
   */
  wa?: number;
}

export const POSE_KEYS: readonly (keyof Pose)[] = [
  'hx', 'hy', 'tl', 'hd', 'aFx', 'aFy', 'aBx', 'aBy', 'lFx', 'lFy', 'lBx', 'lBy', 'tw', 'wa',
];

/** 뼈 길이 (px) */
export const BONE = { torso: 17, upperArm: 9, foreArm: 9, thigh: 12, shin: 12, neck: 6 } as const;

export type Point = readonly [number, number];

/** 관절 위치. 발밑 기준점 상대 좌표, 정수 px. F = 앞쪽, B = 뒤쪽. */
export interface Joints {
  hip: Point;
  neck: Point;
  /** 어깨 (몸통 위 가운데) */
  sh: Point;
  /** 앞어깨·뒷어깨 (어깨 비틀기가 없으면 sh와 같다). 팔은 여기서 나온다 */
  shF: Point;
  shB: Point;
  head: Point;
  /** 머리 기울기 (라디안, 그리기 전용) */
  ha: number;
  /** 무기 각도 (라디안, 그리기 전용: 포즈의 wa) */
  wa: number;
  eF: Point;
  hF: Point;
  eB: Point;
  hB: Point;
  kF: Point;
  fF: Point;
  kB: Point;
  fB: Point;
}

export type JointName = Exclude<keyof Joints, 'ha' | 'wa'>;

/**
 * 발목을 발밑보다 이만큼 올린다. 4px 붓은 중심에서 아래로 1px 더 칠하므로,
 * 발목을 1px 올려야 발바닥 맨 아랫줄이 발밑 기준점 줄에 닿는다.
 */
const ANKLE_LIFT = 1;

/**
 * 2관절 IK. 뿌리 a에서 목표 t로 길이 l1, l2인 뼈 두 개를 뻗는다.
 * bend는 굽는 방향 부호. 고정해 두어야 프레임 사이에서 관절이 뒤집히지 않는다.
 * 돌려주는 값: [가운데 관절, 끝].
 */
export function ik(a: Point, t: Point, l1: number, l2: number, bend: 1 | -1): [Point, Point] {
  let dx = t[0] - a[0];
  let dy = t[1] - a[1];
  let d = Math.hypot(dx, dy);
  let tx = t[0];
  let ty = t[1];
  const max = l1 + l2 - 0.01;
  const min = Math.abs(l1 - l2) + 0.5;
  if (d < 1e-6) {
    dx = 0;
    dy = 1;
    d = 1e-6;
  }
  if (d > max) {
    tx = a[0] + (dx / d) * max;
    ty = a[1] + (dy / d) * max;
    d = max;
  }
  if (d < min) {
    tx = a[0] + (dx / d) * min;
    ty = a[1] + (dy / d) * min;
    d = min;
  }
  const ang = Math.atan2(ty - a[1], tx - a[0]);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ja = ang - bend * Math.acos(Math.max(-1, Math.min(1, cos)));
  return [[a[0] + Math.cos(ja) * l1, a[1] + Math.sin(ja) * l1], [tx, ty]];
}

/**
 * 포즈 → 관절 위치. 팔꿈치는 아래·뒤, 무릎은 앞으로 굽는다.
 * 결과는 정수로 반올림한다. 나중에 sim이 판정에 쓸 때 브라우저마다 삼각함수 끝자리가
 * 달라도 같은 값이 나오게 하려는 것이다.
 */
export function solve(p: Pose): Joints {
  const r = Math.PI / 180;
  const t = p.tl * r;
  const hip: Point = [p.hx, p.hy];
  const neck: Point = [hip[0] + Math.sin(t) * BONE.torso, hip[1] - Math.cos(t) * BONE.torso];
  const sh: Point = [hip[0] + Math.sin(t) * (BONE.torso - 2), hip[1] - Math.cos(t) * (BONE.torso - 2)];
  const ha = (p.tl + p.hd) * r;
  const head: Point = [neck[0] + Math.sin(ha) * BONE.neck, neck[1] - Math.cos(ha) * BONE.neck];
  const tw = p.tw ?? 0;
  const shF: Point = [sh[0] + (tw >= 0 ? tw : tw * 0.6), sh[1]];
  const shB: Point = [sh[0] - (tw >= 0 ? tw * 0.6 : tw), sh[1]];
  const aF = ik(shF, [shF[0] + p.aFx, shF[1] + p.aFy], BONE.upperArm, BONE.foreArm, -1);
  const aB = ik(shB, [shB[0] + p.aBx, shB[1] + p.aBy], BONE.upperArm, BONE.foreArm, -1);
  const lF = ik(hip, [p.lFx, p.lFy - ANKLE_LIFT], BONE.thigh, BONE.shin, 1);
  const lB = ik(hip, [p.lBx, p.lBy - ANKLE_LIFT], BONE.thigh, BONE.shin, 1);
  const R = (q: Point): Point => [Math.round(q[0]), Math.round(q[1])];
  return {
    hip: R(hip), neck: R(neck), sh: R(sh), shF: R(shF), shB: R(shB), head: R(head), ha, wa: (p.wa ?? 0) * r,
    eF: R(aF[0]), hF: R(aF[1]), eB: R(aB[0]), hB: R(aB[1]),
    kF: R(lF[0]), fF: R(lF[1]), kB: R(lB[0]), fB: R(lB[1]),
  };
}
