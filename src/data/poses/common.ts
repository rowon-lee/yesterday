import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/*
 * 공통 동작: 모든 캐릭터가 같이 쓰는 맞는 동작 7개 (docs/공통동작사양서.md). 사양서 순서대로 하나씩 만들고 승인받는다.
 * 오른쪽을 보는 캐릭터가 앞(오른쪽)에서 맞는 기준. 동작은 제자리에서 몸만 반응하고, 밀려나는 거리는 sim이 정한다.
 *
 * 자세는 사양서처럼 '기준 자세(STANCE)에서 바뀌는 양'으로 적는다 (아래 D):
 * - 몸통: 도, 앞으로 숙임 +. tl = STANCE.tl + 몸통
 * - 머리: 화면에서 보이는 기울기의 변화(도). 우리 자세 데이터의 hd는 몸통 기준이라 hd = STANCE.hd + 머리 − 몸통
 * - 엉덩이: px, 오른쪽 +, 높이는 위 + (자세 데이터 hy는 아래가 +라서 부호를 바꾼다)
 * - 팔다리 목표는 자세 데이터 값 그대로 (손은 어깨 기준, 발은 발밑 기준)
 *
 * 맞는 시간(경직)은 공격마다 달라서, 프레임 수는 그대로 두고 '늘어나는 프레임'의 표시 틱만 바꿔 길이를 맞춘다
 * (sim/frames.ts의 frameFitted, 늘어나는 프레임은 HIT_STRETCH).
 */
function D(torso: number, head: number, hipX = 0, hipUp = 0, limbs: Partial<Pose> = {}): Pose {
  return {
    ...STANCE,
    ...limbs,
    hx: STANCE.hx + hipX,
    hy: STANCE.hy - hipUp,
    tl: STANCE.tl + torso,
    hd: STANCE.hd + head - torso,
  };
}

// ---- 1. 약하게 맞음 (12프레임, 기본 20틱, 늘어나는 프레임 5) ----
// 1 충격: 머리가 먼저 젖혀진다 (머리 −15°, 몸통 −5°)
const HL_IMPACT = D(-5, -15);
// 2 몸통 −10°, 앞손이 몸 쪽으로 움츠러든다 (사양서에 값이 적힌 사이 프레임이라 키로 둔다: 충격 뒤 빠르게 젖혀지고 5번에서 멎는다)
const HL_RECOIL = D(-10, -19, 0, 0, { aFx: 6, aFy: 4, aBx: 5, aBy: 10 });
// 5 최대로 젖혀짐: 몸통 −18°, 머리 −22°, 엉덩이 뒤로 2px·1px 내려앉음(무릎 살짝 굽음), 두 팔은 가슴 앞으로
const HL_PEAK = D(-18, -22, -2, -1, { aFx: 6, aFy: 2, aBx: 4, aBy: 4 });
// 8 돌아오는 중: 몸통 −8°, 머리 −6° (머리가 몸통보다 먼저 돌아온다)
const HL_BACK = D(-8, -6, -1, 0, { aFx: 8, aFy: 4, aBx: 5, aBy: 8 });

export const HIT_LIGHT: MotionData = {
  name: 'common/hit_light',
  label: '약하게 맞음',
  dur: [1, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1],
  keys: [
    { at: 0, pose: HL_IMPACT },
    { at: 1, pose: HL_RECOIL },
    { at: 4, pose: HL_PEAK, stop: true },
    { at: 7, pose: HL_BACK },
    { at: 11, pose: STANCE },
  ],
};

/** 절대값으로 적는 자세 (누운 자세·공중 자세처럼 기준 자세에서 멀리 벗어난 것) */
const A = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o });

/**
 * 몸 전체를 엉덩이를 중심으로 deg도 돌린다 (뒤로 돌면 −). 손은 어깨 기준, 발은 발밑 기준이라 함께 돌려 준다
 * (공중제비: 웅크린 자세를 통째로 돌린다. 벽 낙법과 같은 방식)
 */
function spin(p: Pose, deg: number): Pose {
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

// ---- 2. 세게 맞음 (14프레임, 기본 32틱, 늘어나는 프레임 6) ----
// 1 충격: 배 쪽이 뒤로 빠지며 앞으로 접힌다 (몸통 +20°, 머리 +10°, 엉덩이 뒤로 3px)
const HH_FOLD = D(20, 10, -3, 0, { aFx: 9, aFy: 8, aBx: 7, aBy: 10 });
// 2 두 팔이 앞으로 늘어진다
const HH_DANGLE = D(24, 14, -4, -1, { aFx: 5, aFy: 15, aBx: 3, aBy: 15 });
// 4 반동: 몸통이 뒤로 튕겨 −15°, 머리 −25° (팔은 따라서 앞으로 튄다)
const HH_SNAP = D(-15, -25, -4, 0, { aFx: 9, aFy: 0, aBx: 6, aBy: 3 });
// 6 휘청: 뒷발이 한 걸음 뒤로(−6px), 앞발은 끌림, 엉덩이 뒤로 6px·3px 내려앉음, 몸통 −20°, 팔은 균형을 잡듯 앞뒤로 벌어짐
const HH_STAGGER = D(-20, -24, -6, -3, { aFx: 12, aFy: -2, aBx: -11, aBy: 0, lFx: 7, lFy: 0, lBx: -15, lBy: 0 });
// 8 엉덩이 −4px, 몸통 −12°
const HH_RECOVER = D(-12, -12, -4, -2, { aFx: 10, aFy: 2, aBx: -7, aBy: 5, lFx: 7, lBx: -15 });
// 10 앞발을 끌어 모은다
const HH_DRAG = D(-7, -6, -4, -1, { aFx: 9, aFy: 4, aBx: -2, aBy: 8, lFx: 4, lBx: -14 });
// 13 몸통 −3°
const HH_SETTLE = D(-3, -2, -1, 0, { lFx: 8, lBx: -10 });

export const HIT_HEAVY: MotionData = {
  name: 'common/hit_heavy',
  label: '세게 맞음',
  dur: [1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: HH_FOLD },
    { at: 1, pose: HH_DANGLE },
    { at: 3, pose: HH_SNAP },
    { at: 5, pose: HH_STAGGER, stop: true },
    { at: 7, pose: HH_RECOVER },
    { at: 9, pose: HH_DRAG },
    { at: 12, pose: HH_SETTLE },
    { at: 13, pose: STANCE },
  ],
};

// ---- 3. 가드 크러시 (12프레임, 기본 44틱, 늘어나는 프레임 7) ----
// 1 방어 자세(두 팔을 얼굴 앞에 모음, 무릎 굽힘)에서 시작
const GC_GUARD = A({ hx: -2, hy: -18, tl: -2, hd: -4, aFx: 7, aFy: -10, aBx: 8, aBy: -6 });
// 3 두 팔이 위·뒤로 크게 벌어진다 (손이 머리보다 위), 몸통 −15°, 머리 −20°
const GC_BREAK = D(-15, -20, -3, 1, { aFx: 3, aFy: -19, aBx: -9, aBy: -16 });
// 5 엉덩이 −4px, 뒷발 한 걸음 뒤로
const GC_STEP = D(-18, -24, -4, 0, { aFx: 4, aFy: -15, aBx: -10, aBy: -12, lBx: -15 });
// 7 무방비: 몸통 −22°, 머리가 힘없이 뒤로 −30°, 팔은 벌어진 채 늘어지기 시작, 무릎이 굽어 흔들린다
const GC_DAZE = D(-22, -30, -5, -2, { aFx: 14, aFy: 5, aBx: -10, aBy: 2, lFx: 8, lBx: -15 });
// 8 몸통이 앞으로 흔들려 −10°
const GC_SWAY = D(-10, -14, -4, -1, { aFx: 7, aFy: 1, aBx: -7, aBy: 4, lFx: 8, lBx: -14 });
// 9 고개를 털 듯 머리를 한 번 흔든다 (앞으로 숙였다 돌아온다)
const GC_SHAKE = D(-8, 6, -3, -1, { aFx: 7, aFy: 3, aBx: -5, aBy: 6, lFx: 8, lBx: -13 });
// 10 팔을 다시 앞으로 모으기 시작
const GC_GATHER = D(-5, -4, -2, 0, { aFx: 8, aFy: 4, aBx: 1, aBy: 9, lFx: 9, lBx: -12 });

export const GUARD_CRUSH: MotionData = {
  name: 'common/guard_crush',
  label: '가드 크러시',
  dur: [1, 1, 2, 2, 3, 3, 8, 4, 5, 5, 5, 5],
  keys: [
    { at: 0, pose: GC_GUARD },
    { at: 2, pose: GC_BREAK },
    { at: 4, pose: GC_STEP },
    { at: 6, pose: GC_DAZE, stop: true },
    { at: 7, pose: GC_SWAY },
    { at: 8, pose: GC_SHAKE },
    { at: 9, pose: GC_GATHER },
    { at: 11, pose: STANCE },
  ],
};

// ---- 4. 공중에서 맞음 (12프레임: 1~9번 16틱 한 번, 10~12번 8틱 떨어지는 동안 되풀이) ----
// 1 충격: 몸통 −20°, 머리 −25°, 다리가 앞으로 들린다
const HA_IMPACT = D(-20, -25, -1, 4, { aFx: 3, aFy: -6, aBx: -5, aBy: -4, lFx: 10, lFy: -8, lBx: 4, lBy: -6 });
// 4 몸 전체가 뒤로 기울며 돈다 (몸통 −50°)
const HA_TILT = A({ hx: -1, hy: -24, tl: -40, hd: -6, aFx: 0, aFy: -11, aBx: -8, aBy: -8, lFx: 13, lFy: -13, lBx: 8, lBy: -9 });
// 6 몸통 −70°, 팔은 위로 끌려 올라가고 다리는 굽혀진다
const HA_ROLL = A({ hx: 0, hy: -24, tl: -60, hd: -6, aFx: -5, aFy: -13, aBx: -10, aBy: -9, lFx: 11, lFy: -18, lBx: 6, lBy: -15 });
// 8 몸통 −80° (거의 누운 채 공중), 팔다리가 느슨하게 벌어진다 (팔은 힘없이 아래로 늘어진다)
const HA_LAY = A({ hx: 0, hy: -23, tl: -70, hd: -4, aFx: 1, aFy: 7, aBx: -6, aBy: 8, lFx: 16, lFy: -15, lBx: 11, lBy: -11 });
// 10~12 공중 유지: 팔다리가 천천히 흔들린다 (세 자세가 한 바퀴를 돌아 12번 → 10번이 이어진다)
const HA_HOLD1 = A({ hx: 0, hy: -23, tl: -70, hd: -4, aFx: 0, aFy: 8, aBx: -6, aBy: 8, lFx: 16, lFy: -16, lBx: 11, lBy: -11 });
const HA_HOLD2 = A({ hx: 0, hy: -23, tl: -68, hd: -3, aFx: 2, aFy: 7, aBx: -7, aBy: 7, lFx: 15, lFy: -14, lBx: 12, lBy: -10 });
const HA_HOLD3 = A({ hx: 0, hy: -23, tl: -72, hd: -5, aFx: -1, aFy: 7, aBx: -5, aBy: 9, lFx: 17, lFy: -15, lBx: 10, lBy: -12 });

export const HIT_AIR: MotionData = {
  name: 'common/hit_air',
  label: '공중에서 맞음',
  dur: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: HA_IMPACT },
    { at: 3, pose: HA_TILT },
    { at: 5, pose: HA_ROLL },
    { at: 7, pose: HA_LAY },
    { at: 9, pose: HA_HOLD1 },
    { at: 10, pose: HA_HOLD2 },
    { at: 11, pose: HA_HOLD3 },
  ],
};
/** 공중에서 맞음: 이 프레임(0부터)부터 떨어지는 동안 되풀이 (10~12번) */
export const HIT_AIR_LOOP_FROM = 9;

// ---- 5. 다운 (14프레임, 32틱 + 누운 채 대기는 14번을 유지) ----
// 1 바닥 충돌: 등이 바닥에 닿고 (머리가 뒤쪽) 팔다리가 충격으로 들린다
const KD_IMPACT = A({ hx: 3, hy: -3, tl: -90, hd: -4, aFx: -5, aFy: -6, aBx: 3, aBy: -5, lFx: 22, lFy: -9, lBx: 20, lBy: -6 });
// 3 튕김: 몸 전체가 4px 떠오르고 몸통이 살짝 꺾인다
const KD_BOUNCE = A({ hx: 3, hy: -7, tl: -80, hd: -6, aFx: -6, aFy: -2, aBx: 2, aBy: -1, lFx: 23, lFy: -10, lBx: 21, lBy: -8 });
// 6 다시 바닥 (먼지는 렌더)
const KD_LAND = A({ hx: 3, hy: -3, tl: -90, hd: -2, aFx: -6, aFy: 0, aBx: 4, aBy: 1, lFx: 24, lFy: -4, lBx: 23, lBy: -2 });
// 8 팔다리가 바닥에 늘어진다 (14번과 같은 완전히 누운 자세)
const KD_LIE = A({ hx: 3, hy: -3, tl: -90, hd: 0, aFx: -7, aFy: 2, aBx: 5, aBy: 3, lFx: 25, lFy: -1, lBx: 24, lBy: 0 });
// 11 가슴이 한 번 크게 들썩인다 (숨)
const KD_BREATH = A({ ...KD_LIE, hy: -4, tl: -86, hd: -2 });

export const KNOCKDOWN: MotionData = {
  name: 'common/knockdown',
  label: '다운',
  dur: [1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: KD_IMPACT },
    { at: 2, pose: KD_BOUNCE },
    { at: 5, pose: KD_LAND },
    { at: 7, pose: KD_LIE },
    { at: 10, pose: KD_BREATH },
    { at: 13, pose: KD_LIE },
  ],
};
/** 다운: 다시 바닥에 닿는 프레임 (0부터, 6번). 렌더가 이 순간 먼지를 일으킨다 */
export const KNOCKDOWN_RELAND = 5;

// ---- 6. 기상 (12프레임 × 2틱 = 24틱) ----
// 1 누운 자세에서 뒤쪽 팔이 바닥을 짚는다
const GU_PLANT = A({ ...KD_LIE, hd: 4, aFx: -6, aFy: 2, aBx: 2, aBy: 3 });
// 3 상체를 일으킨다 (몸통 −45°), 머리가 앞으로. 뒷손은 뒤쪽 바닥을 짚고 있다
const GU_SITUP = A({ hx: -1, hy: -3, tl: -35, hd: 52, aFx: 6, aFy: 8, aBx: -4, aBy: 15, lFx: 19, lFy: -1, lBx: 17, lBy: 0 });
// 5 앉은 자세, 앞 무릎을 세운다
const GU_SIT = A({ hx: -2, hy: -4, tl: -10, hd: 18, aFx: 7, aFy: 8, aBx: -5, aBy: 15, lFx: 6, lFy: 0, lBx: 14, lBy: 0 });
// 7 짚은 손을 밀고 한쪽 무릎을 꿇는다 (뒷무릎이 바닥에, 앞발은 앞에 딛는다)
const GU_KNEEL = A({ hx: -1, hy: -12, tl: 10, hd: -4, aFx: 6, aFy: 8, aBx: -2, aBy: 10, lFx: 8, lFy: 0, lBx: -12, lBy: 0 });
// 9 일어서는 중: 엉덩이 높이 −6px, 몸통 +15°
const GU_RISE = D(15, 0, 0, -6, { aFx: 8, aFy: 8, aBx: 3, aBy: 11 });
// 11 팔이 기준 자세로
const GU_ARMS = D(5, 0, 0, -2);

export const GETUP: MotionData = {
  name: 'common/getup',
  label: '기상',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: GU_PLANT },
    { at: 2, pose: GU_SITUP },
    { at: 4, pose: GU_SIT },
    { at: 6, pose: GU_KNEEL },
    { at: 8, pose: GU_RISE },
    { at: 10, pose: GU_ARMS },
    { at: 11, pose: STANCE },
  ],
};

// ---- 7. 낙법 (12프레임, 18틱) ----
// 공중 웅크림 (곧게 선 방향): 무릎을 가슴에 붙이고 두 팔로 무릎을 감싼다. 이것을 통째로 돌려 뒤로 한 바퀴
const TC_BALL = A({ hx: -1, hy: -28, tl: 24, hd: -8, aFx: 4, aFy: 12, aBx: 2, aBy: 11, lFx: 6, lFy: -19, lBx: 2, lBy: -17 });
// 웅크림이 풀리기 시작한 모습 (손이 무릎에서 떨어지고 다리가 조금 내려간다)
const TC_LOOSE = A({ hx: -1, hy: -28, tl: 24, hd: -4, aFx: 8, aFy: 6, aBx: -2, aBy: 8, lFx: 8, lFy: -16, lBx: 0, lBy: -13 });
/** 공중에서 맞는 자세의 기울기에서 웅크려 돌기 시작한다 */
const TC_START = -54;
// 1 공중에서 맞는 자세에서 시작, 무릎을 가슴으로 당긴다
const TC_PULL = A({ hx: -1, hy: -26, tl: -30, hd: -6, aFx: 2, aFy: -6, aBx: -6, aBy: -3, lFx: 9, lFy: -16, lBx: 5, lBy: -13 });
// 9 공중 균형 자세 (점프 낙하 자세와 같다. 한 바퀴 돈 각도로 적는다)
const TC_FALL = A({ hx: 0, hy: -24, tl: 4 - 360, hd: 2, aFx: 9, aFy: -9, aBx: -7, aBy: -6, lFx: 6, lFy: -2, lBx: -6, lBy: -1 });
// 7 팔다리를 펼친다
const TC_OPEN = A({ hx: 0, hy: -26, tl: -372, hd: 6, aFx: 10, aFy: -9, aBx: -9, aBy: -9, lFx: 7, lFy: -8, lBx: -6, lBy: -4 });

export const TECH: MotionData = {
  name: 'common/tech',
  label: '낙법',
  dur: [1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 1],
  keys: [
    { at: 0, pose: TC_PULL },
    { at: 1, pose: spin(TC_BALL, TC_START) },
    { at: 2, pose: spin(TC_BALL, TC_START - 90) },
    { at: 3, pose: spin(TC_BALL, TC_START - 180) },
    { at: 4, pose: spin(TC_BALL, TC_START - 270) },
    { at: 5, pose: spin(TC_LOOSE, TC_START - 360) },
    { at: 6, pose: TC_OPEN },
    { at: 8, pose: TC_FALL },
    { at: 11, pose: TC_FALL },
  ],
};

/** 공통 동작의 늘어나는 프레임 (0부터 센 번호). 경직이 기본 길이보다 길면 이 프레임의 표시 틱이 늘어난다 */
export const HIT_STRETCH: Readonly<Record<string, number>> = {
  'common/hit_light': 4,
  'common/hit_heavy': 5,
  'common/guard_crush': 6,
};

/** 공통 동작 7개 (사양서 순서) */
export const COMMON_MOTIONS: MotionData[] = [HIT_LIGHT, HIT_HEAVY, GUARD_CRUSH, HIT_AIR, KNOCKDOWN, GETUP, TECH];
