import { BONE, type Pose } from '../../../anim/pose';

/**
 * 오스카 기본자세 (캐릭터 기획서 '움직임': 살짝 굽은 채 칼자루에 손을 얹은 노인).
 * 등이 조금 굽고(몸통 13°) 고개가 앞으로 나와 처진다. 무릎은 살짝 굽혀 발을 좁게(12px) 모으고,
 * 앞손은 허리에 꽂은 칼의 칼자루를 쥐고, 뒷손은 등 뒤 허리에 얹는다. 오스카의 모든 동작이 여기서 시작해 여기로 끝난다.
 */
const BASE: Pose = {
  hx: 0.5, hy: -22, tl: 13, hd: 12,
  aFx: 0, aFy: 0, aBx: 0, aBy: 0,
  lFx: 6, lFy: 0, lBx: -6, lBy: 0,
};

/**
 * 검 (칼집째 허리띠에 비스듬히 꽂혀 있다): 칼자루는 몸 앞 위로, 칼집은 뒤 아래로 한 직선.
 * 자리는 엉덩이와 몸통 방향으로 계산한다 (그림 장식 anim/decor/oscar.ts와 포즈가 같은 식을 쓴다).
 */
export const SWORD = {
  /** 칼집 입구: 엉덩이에서 몸 앞으로, 위로 (px) */
  mouthFront: 3,
  mouthUp: 2,
  /** 칼자루가 몸 앞 방향에서 위로 기운 각도 (도) */
  tilt: 40,
  /** 칼자루 길이, 손이 쥐는 자리 (입구에서 칼자루 쪽으로) */
  hilt: 8,
  grip: 3.5,
  /** 칼집 길이 (입구에서 뒤 아래로) */
  sheath: 19,
  /** 칼을 살짝 뽑을 수 있는 가장 긴 길이 (칼날이 이만큼 드러난다) */
  maxDraw: 14,
} as const;

type V = [number, number];

/** 몸통 기울기(도)의 몸 위쪽·앞쪽 단위 벡터 (오른쪽 보는 기준) */
export function axes(tl: number): { up: V; front: V } {
  const t = (tl * Math.PI) / 180;
  return { up: [Math.sin(t), -Math.cos(t)], front: [Math.cos(t), Math.sin(t)] };
}

/** 칼자루 방향 (입구에서 칼자루 끝 쪽, 단위 벡터). 칼집은 그 반대 */
export function hiltDir(up: V, front: V): V {
  const a = (SWORD.tilt * Math.PI) / 180;
  return [front[0] * Math.cos(a) + up[0] * Math.sin(a), front[1] * Math.cos(a) + up[1] * Math.sin(a)];
}

/** 칼집 입구 자리 */
export function mouthAt(hip: V, up: V, front: V): V {
  return [hip[0] + front[0] * SWORD.mouthFront + up[0] * SWORD.mouthUp, hip[1] + front[1] * SWORD.mouthFront + up[1] * SWORD.mouthUp];
}

/** 어깨 자리 (anim/pose solve와 같은 식): 가운데, 앞어깨, 뒷어깨 */
function shoulders(p: Pose): { shF: V; shB: V } {
  const { up } = axes(p.tl);
  const sh: V = [p.hx + up[0] * (BONE.torso - 2), p.hy + up[1] * (BONE.torso - 2)];
  const tw = p.tw ?? 0;
  return { shF: [sh[0] + (tw >= 0 ? tw : tw * 0.6), sh[1]], shB: [sh[0] - (tw >= 0 ? tw * 0.6 : tw), sh[1]] };
}

/** 앞손이 칼자루를 쥔다. drawn: 칼을 그만큼 뽑는다 (칼날이 드러나는 길이, 0~SWORD.maxDraw) */
export function hilt(p: Pose, drawn = 0): Pose {
  const { up, front } = axes(p.tl);
  const h = hiltDir(up, front);
  const m = mouthAt([p.hx, p.hy], up, front);
  const g: V = [m[0] + h[0] * (SWORD.grip + drawn), m[1] + h[1] * (SWORD.grip + drawn)];
  const { shF } = shoulders(p);
  return { ...p, aFx: g[0] - shF[0], aFy: g[1] - shF[1] };
}

/** 뒷손이 칼집 입구를 잡는다 (엄지로 날밑을 밀어 칼을 뽑을 준비). back: 입구에서 칼집 쪽으로 이만큼 */
export function sheathHold(p: Pose, back = 2): Pose {
  const { up, front } = axes(p.tl);
  const h = hiltDir(up, front);
  const m = mouthAt([p.hx, p.hy], up, front);
  const g: V = [m[0] - h[0] * back, m[1] - h[1] * back];
  const { shB } = shoulders(p);
  return { ...p, aBx: g[0] - shB[0], aBy: g[1] - shB[1] };
}

/** 뒷손을 등 뒤 허리에 얹는다 (노인의 뒷짐) */
export function behindBack(p: Pose): Pose {
  const { up, front } = axes(p.tl);
  const g: V = [p.hx - front[0] * 4.5 + up[0] * 1.5, p.hy - front[1] * 4.5 + up[1] * 1.5];
  const { shB } = shoulders(p);
  return { ...p, aBx: g[0] - shB[0], aBy: g[1] - shB[1] };
}

/** 칼자루를 쥐고 뒷짐을 진 자세로 맞춘다 (몸 자리·기울기만 바꾼 포즈에 손을 다시 붙인다) */
export const rest = (p: Pose, drawn = 0): Pose => behindBack(hilt(p, drawn));

/** 오스카 기본자세 */
export const O_STANCE: Pose = rest(BASE);

/** 기본자세에서 바뀐 만큼만 적는다 (손은 따로 hilt·behindBack·sheathHold로 붙인다) */
export const O = (o: Partial<Pose>): Pose => ({ ...O_STANCE, ...o });
/** 기본자세에서 바뀐 만큼 적고, 앞손은 칼자루·뒷손은 뒷짐으로 다시 붙인다 */
export const OR = (o: Partial<Pose>, drawn = 0): Pose => rest({ ...O_STANCE, ...o }, drawn);

/** 뒷손을 발밑 기준 (x, y)에 둔다 (벽을 짚는 손 등) */
export function handB(p: Pose, x: number, y: number): Pose {
  const { shB } = shoulders(p);
  return { ...p, aBx: x - shB[0], aBy: y - shB[1] };
}
/** 앞손을 발밑 기준 (x, y)에 둔다 */
export function handF(p: Pose, x: number, y: number): Pose {
  const { shF } = shoulders(p);
  return { ...p, aFx: x - shF[0], aFy: y - shF[1] };
}

/** 몸 전체를 엉덩이를 중심으로 돌린다 (공중제비). 손 목표는 어깨 기준이라 같이 돌고(칼자루를 쥔 손도 칼과 함께), 발은 엉덩이 둘레로 돈다 */
export function spin(p: Pose, deg: number): Pose {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const rot = (x: number, y: number): [number, number] => [x * c - y * s, x * s + y * c];
  const [aFx, aFy] = rot(p.aFx, p.aFy);
  const [aBx, aBy] = rot(p.aBx, p.aBy);
  const [fx, fy] = rot(p.lFx - p.hx, p.lFy - p.hy);
  const [bx, by] = rot(p.lBx - p.hx, p.lBy - p.hy);
  return { ...p, tl: p.tl + deg, aFx, aFy, aBx, aBy, lFx: p.hx + fx, lFy: p.hy + fy, lBx: p.hx + bx, lBy: p.hy + by };
}

/** 칼을 뽑을 자세: 앞손은 칼자루(drawn만큼 뽑음), 뒷손은 칼집 입구를 잡는다 (발도 직전·반쯤 뽑아 막기) */
export const ready = (p: Pose, drawn = 0): Pose => sheathHold(hilt(p, drawn));
/** 기본자세에서 바뀐 만큼 적고 칼을 뽑을 자세로 손을 붙인다 */
export const OD = (o: Partial<Pose>, drawn = 0): Pose => ready({ ...O_STANCE, ...o }, drawn);
