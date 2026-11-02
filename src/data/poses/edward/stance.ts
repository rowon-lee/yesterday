import { HAMMER } from '../../../anim/decor/edward';
import { solve, type Pose } from '../../../anim/pose';

/**
 * 에드워드 기본자세 (캐릭터 기획서 '움직임': 해머를 어깨에 걸친 채 여유롭게 선 가주). 에드워드의 모든 동작이 여기서 시작해 여기로 끝난다.
 * 꼿꼿하게 서서 가슴을 펴고(몸통 3° 뒤로) 턱을 든다. 발은 어깨너비로 편하게 벌린다 (무릎은 거의 편다).
 * 앞손은 가슴 앞에서 해머 손잡이를 쥐고, 손잡이는 앞어깨 위를 지나 해머 머리가 등 뒤 어깨 높이에 걸린다 (무기 각도 −150°).
 * 뒷손은 바지 주머니에 넣는다 (손이 엉덩이 뒤에 붙는다).
 */
export const E_STANCE: Pose = {
  hx: 0, hy: -22.5, tl: -3, hd: -2,
  aFx: 5, aFy: 6, aBx: -2.5, aBy: 13,
  lFx: 6, lFy: 0, lBx: -7, lBy: 0,
  wa: -150,
};

/** 기본자세에서 바뀐 만큼만 적는다 */
export const E = (o: Partial<Pose>): Pose => ({ ...E_STANCE, ...o });

/**
 * 두 손으로 쥐기: 뒷손을 손잡이에서 앞손보다 gap px 아래(손잡이 끝 쪽)에 둔다.
 * 앞손 자리는 포즈대로 두고 뒷손 목표(aBx·aBy)만 바꾼다 (뒷어깨에서 닿지 않으면 IK가 닿는 데까지 뻗는다)
 */
export function grip2(p: Pose, gap = 4.5): Pose {
  const j = solve(p);
  const a = ((p.wa ?? 0) * Math.PI) / 180;
  const hx = j.hF[0] - Math.cos(a) * gap;
  const hy = j.hF[1] - Math.sin(a) * gap;
  return { ...p, aBx: round1(hx - j.shB[0]), aBy: round1(hy - j.shB[1]) };
}

/**
 * 해머 머리 가운데를 (x, y)에 두는 앞손 목표: 손 = 머리 − 무기 방향 × HAMMER.reach. 팔이 닿지 않으면 IK가 닿는 데까지 뻗는다.
 * two면 뒷손도 손잡이에 (grip2)
 */
export function aim(p: Pose, x: number, y: number, two = true, gap = 4.5): Pose {
  const j = solve({ ...p });
  const a = ((p.wa ?? 0) * Math.PI) / 180;
  const hx = x - Math.cos(a) * HAMMER.reach;
  const hy = y - Math.sin(a) * HAMMER.reach;
  const q = { ...p, aFx: round1(hx - j.shF[0]), aFy: round1(hy - j.shF[1]) };
  return two ? grip2(q, gap) : q;
}

/**
 * 앞팔을 끝까지 뻗은 해머 포즈 (동작연출지침서 2장 '뻗는 팔은 완전히 편다', 팔 길이 그대로): 앞손이 앞어깨에서 armDeg 방향으로 18px.
 * 해머 각도(wa)는 포즈대로. two면 뒷손도 손잡이에 (grip2)
 */
export function extend(p: Pose, armDeg: number, two = true, gap = 4.5): Pose {
  const a = (armDeg * Math.PI) / 180;
  const q = { ...p, aFx: round1(Math.cos(a) * 18), aFy: round1(Math.sin(a) * 18) };
  return two ? grip2(q, gap) : q;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
