import { HAMMER } from '../../../anim/decor/edward';
import { solve, type Pose } from '../../../anim/pose';

/**
 * 에드워드 몸 크기 배율 (2026-11-02 피드백 12-0 '키 약 58px, 다른 캐릭터 52px'): 모든 에드워드 동작의 관절을 발밑 기준점에서 이만큼 키운다
 * (data/poses/edward/index.ts가 동작마다 scale로 넣는다. 필살기 상대 반응 동작은 상대 몸이라 빼고).
 * 포즈 수치는 보통 몸 단위로 적고, 그림·판정은 배율을 곱한 자리다
 */
export const E_SCALE = 1.14;

/** 포즈 단위 해머: 앞손 → 머리 가운데 (그림 30px ÷ 배율), 두 손으로 쥘 때 앞손 → 뒷손 (그림 6px 머리 쪽: 음수) */
export const E_REACH = HAMMER.reach / E_SCALE;
const GAP = -6 / E_SCALE;

/**
 * 에드워드 기본자세 (캐릭터 기획서 '움직임': 해머를 어깨에 걸친 채 여유롭게 선 가주. 피드백 12-4 '가슴을 펴고 턱을 든 당당한 자세').
 * 꼿꼿하게 서서 가슴을 펴고(몸통 4° 뒤로) 턱을 든다. 발은 어깨너비로 편하게 벌린다 (무릎은 거의 편다).
 * 오른손(앞손)은 가슴 앞에서 해머 자루를 쥐고, 자루는 앞어깨 위를 지나 해머 머리가 등 뒤 머리 높이에 걸린다 (무기 각도 −148°).
 * 왼손(뒷손)은 바지 주머니에 넣는다 (손이 엉덩이 뒤 옆에 붙는다). 어깨를 조금 틀어 넓은 어깨가 보인다 (tw 1.5)
 */
export const E_STANCE: Pose = {
  hx: 0, hy: -22.5, tl: -4, hd: -4, tw: 1.5,
  aFx: 4.5, aFy: 6.5, aBx: -2.5, aBy: 13,
  lFx: 6.5, lFy: 0, lBx: -7, lBy: 0,
  wa: -148,
};

/** 기본자세에서 바뀐 만큼만 적는다 */
export const E = (o: Partial<Pose>): Pose => ({ ...E_STANCE, ...o });

/**
 * 두 손으로 쥐기: 뒷손을 자루에서 앞손보다 gap(포즈 단위)만큼 자루 끝 쪽에 둔다 (음수면 머리 쪽: 기본은 머리 쪽 6px).
 * 앞손 자리는 포즈대로 두고 뒷손 목표(aBx·aBy)만 바꾼다 (뒷어깨에서 닿지 않으면 IK가 닿는 데까지 뻗는다)
 */
export function grip2(p: Pose, gap = GAP): Pose {
  const j = solve(p);
  const a = ((p.wa ?? 0) * Math.PI) / 180;
  const hx = j.hF[0] - Math.cos(a) * gap;
  const hy = j.hF[1] - Math.sin(a) * gap;
  return { ...p, aBx: round1(hx - j.shB[0]), aBy: round1(hy - j.shB[1]) };
}

/**
 * 해머 머리 가운데를 그림 자리 (x, y)(발밑 기준 그림 px: 배율을 곱한 자리)에 두는 앞손 목표.
 * 손 = 머리 − 무기 방향 × 해머 길이. 팔이 닿지 않으면 IK가 닿는 데까지 뻗는다. two면 뒷손도 자루에 (grip2)
 */
export function aim(p: Pose, x: number, y: number, two = true, gap = GAP): Pose {
  const j = solve({ ...p });
  const a = ((p.wa ?? 0) * Math.PI) / 180;
  const hx = x / E_SCALE - Math.cos(a) * E_REACH;
  const hy = y / E_SCALE - Math.sin(a) * E_REACH;
  const q = { ...p, aFx: round1(hx - j.shF[0]), aFy: round1(hy - j.shF[1]) };
  return two ? grip2(q, gap) : q;
}

/**
 * 앞팔을 끝까지 뻗은 해머 포즈 (동작연출지침서 2장 '뻗는 팔은 완전히 편다', 팔 길이 그대로): 앞손이 앞어깨에서 armDeg 방향으로 18(포즈 단위).
 * 해머 각도(wa)는 포즈대로. two면 뒷손도 자루에 (grip2)
 */
export function extend(p: Pose, armDeg: number, two = true, gap = GAP): Pose {
  const a = (armDeg * Math.PI) / 180;
  const q = { ...p, aFx: round1(Math.cos(a) * 18), aFy: round1(Math.sin(a) * 18) };
  return two ? grip2(q, gap) : q;
}

/**
 * 앞손이 앞어깨에서 armDeg 방향으로 len(포즈 단위, 18이면 끝까지)만큼 나간 해머 포즈. 무기 각도는 포즈대로
 */
export function reachArm(p: Pose, armDeg: number, len: number, two = true, gap = GAP): Pose {
  const a = (armDeg * Math.PI) / 180;
  const q = { ...p, aFx: round1(Math.cos(a) * len), aFy: round1(Math.sin(a) * len) };
  return two ? grip2(q, gap) : q;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
