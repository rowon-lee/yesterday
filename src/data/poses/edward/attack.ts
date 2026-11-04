import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { HAMMER } from '../../../anim/decor/edward';
import { aim, E, E_STANCE, grip2 } from './stance';

/*
 * 에드워드 평타 (2026-11-02 피드백 12-1 '느리고 크게': 라이덴이 끊어 친다면 에드워드는 느리게 들어 올려 한 번에 무너뜨린다).
 * 박자 (지상 평타 14프레임): 감기 4프레임(표시 틱 3~5, 마지막 멈춤 6~8, 해머를 어깨 뒤로 크게 넘긴다) → 스미어 1프레임(1틱, 해머 머리 잔상 3개)
 * → 타격 2프레임(2틱씩) → 지나치기 2프레임(2틱씩, 머리가 땅에 닿거나 몸이 끌려간다) → 여운 2프레임(5~6틱, 해머를 쥔 채 멈춤)
 * → 복귀 3프레임(3틱씩, 해머를 끌어 올려 어깨에 걸친다). 한 동작 길이는 라이덴의 약 1.9배.
 * 머리 무게: 휘두를 때 팔이 먼저 가고 해머 머리가 가장 늦게 따라온다(스미어·첫 타격 프레임의 무기 각도가 뒤에 처진다),
 * 멈출 때 머리가 한 번 더 쏠렸다가(지나치기) 돌아온다(여운).
 * 해머 머리 자리는 그림 px(발밑 기준, 몸 배율을 곱한 자리)로 적는다: 휘두르는 동안의 머리는 타원 원호(EDWARD_ARCS) 위를 지난다.
 * 렌더의 청동빛 원호도 같은 원호를 그린다 (render/chars/edward.ts). 판정은 해머 머리를 감싼 궤적 상자 (data/characters/edward.ts).
 * 1타는 기본자세에서 시작하고, 2·3·4타는 앞 타의 판정이 끝난 자세(연타로 넘어가는 자리)에서 이어 시작한다 (한 동작처럼 이어지게).
 */

/** 해머 머리가 지나는 원호 (그림 px, 발밑 기준, 오른쪽 보는 기준): 가운데, 가로·세로 반지름, 시작·끝 각도 (도, 화면 좌표: 0 앞, 90 아래) */
export interface HammerArc {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  a0: number;
  a1: number;
}

/** 원호 위 한 점 */
export const arcAt = (a: HammerArc, deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [Math.round((a.cx + Math.cos(r) * a.rx) * 10) / 10, Math.round((a.cy + Math.sin(r) * a.ry) * 10) / 10];
};

/** 두 손 해머 포즈: 해머 머리 가운데를 그림 자리 (x, y)에 */
const A = (o: Partial<Pose>, at: readonly [number, number]): Pose => aim(E(o), at[0], at[1]);
/** 두 손으로 쥔 포즈 (앞손 목표는 포즈대로) */
const G = (o: Partial<Pose>): Pose => grip2(E(o));
/** 두 손 해머 포즈: 앞손을 그림 자리 hand에 두고, 해머 머리는 손에서 무기 각도(wa)로 해머 길이(30px)만큼 (손이 튀지 않게 손 길을 먼저 정할 때) */
const AH = (o: Partial<Pose>, hand: readonly [number, number]): Pose => {
  const a = ((o.wa ?? 0) * Math.PI) / 180;
  return A(o, [hand[0] + Math.cos(a) * HAMMER.reach, hand[1] + Math.sin(a) * HAMMER.reach]);
};
/** 해머가 몸 둘레를 한 바퀴 돌고 어깨로 돌아온 기본자세 (각도만 한 바퀴 뺀 값: 그림은 기본자세와 같다) */
const STANCE_TURNED: Pose = { ...E_STANCE, wa: (E_STANCE.wa ?? 0) - 360 };

// ---- 1타: 어깨에서 내려 앞으로 가로 휘두르기 (몸 앞 반원 지름 72px) ----
/** 1타 원호: 어깨 위 뒤에서 넘어와 가슴 앞을 지나 앞 아래로 (시계 방향) */
const ARC1: HammerArc = { cx: 14, cy: -36, rx: 36, ry: 32, a0: -125, a1: 20 };
/** 감기 1: 두 손으로 해머를 어깨에서 들어 올린다 (머리는 어깨에 처진 채) */
const C1_LIFT = A({ hx: -0.5, hy: -21.6, tl: -6, hd: -5, tw: -1, lFx: 7, lBx: -8, wa: -150 }, [-26, -61]);
/** 감기 2: 몸을 뒤로 틀며 해머를 어깨 뒤로 크게 넘긴다 (엉덩이 높이가 출렁 내려앉는다) */
const C1_COIL = A({ hx: -2, hy: -20.6, tl: -10, hd: -6, tw: -3, lFx: 9, lBx: -10.5, wa: -166 }, [-41, -57]);
/** 감기 끝 (멈춤 7틱): 뒷발에 싣고 (엉덩이 3px 뒤로) 해머가 등 뒤로 수평에 가깝게 눕는다 */
const C1_MAX = A({ hx: -3, hy: -20, tl: -13, hd: -6, tw: -4, lFx: 10, lBx: -12, wa: -176 }, [-48, -50]);
/** 풀림: 허리·어깨가 먼저 돌아 나온다. 손과 해머는 아직 머리 뒤에 남는다 */
const C1_RELEASE = A({ hx: -0.5, hy: -19.6, tl: -4, hd: -6, tw: -1, lFx: 12, lBx: -13, wa: -168 }, [-46.8, -52.7]);
/** 스미어: 두 손이 가슴 앞 위로 끌려 나오고, 해머 머리는 머리 위 뒤에 처져 뒤따른다 */
const C1_SMEAR = A({ hx: 2, hy: -19, tl: 10, hd: -6, tw: 3, lFx: 14, lBx: -14, wa: -138 }, arcAt(ARC1, -125));
/** 타격: 머리가 손을 따라잡아 가슴 앞을 가로지른다 (팔과 한 줄로) */
const C1_HIT = A({ hx: 3.5, hy: -18, tl: 20, hd: -4, tw: 4.5, lFx: 16, lBx: -15, wa: -30 }, arcAt(ARC1, -35));
const C1_HIT2 = A({ hx: 4.5, hy: -17.5, tl: 26, hd: -2, tw: 5, lFx: 16.5, lBx: -15.5, wa: 2 }, arcAt(ARC1, 0));
/** 지나치기: 머리가 앞 아래로 더 쏠리며 몸이 끌려간다 → 머리가 땅에 닿는다 */
export const C1_OVER = A({ hx: 5, hy: -16.5, tl: 32, hd: 0, tw: 5, lFx: 17, lBx: -16, wa: 36 }, arcAt(ARC1, 32));
const C1_OVER2 = A({ hx: 5.5, hy: -15.5, tl: 36, hd: 2, tw: 4.5, lFx: 17, lBx: -16.5, wa: 66 }, [34, -7]);
/** 여운: 땅에 닿은 해머를 쥔 채 멈춘다 (쏠렸던 머리가 조금 돌아오고, 몸이 2px 내려앉는다) */
const C1_HOLD = A({ hx: 5, hy: -16, tl: 34, hd: 0, tw: 4, lFx: 17, lBx: -16, wa: 60 }, [36, -7]);
const C1_HOLD2 = A({ hx: 4.8, hy: -15, tl: 33, hd: -1, tw: 4, lFx: 17, lBx: -16, wa: 62 }, [36, -7]);
/** 복귀: 무게가 먼저 뒤로 빠지며 일어난다 (해머 머리는 아직 땅에) → 앞에서 끌어 올려 → 얼굴 앞에 세우고 → 손이 어깨로 오는 동안 머리가 넘어간다 */
const C1_BACK0 = A({ hx: 2.5, hy: -18.5, tl: 22, hd: -2, tw: 2.5, lFx: 15, lBx: -14, wa: 58 }, [33, -7]);
const C1_BACK1 = G({ hx: 2, hy: -20, tl: 12, hd: -3, tw: 2, aFx: 12, aFy: 3, lFx: 12.5, lBx: -11.5, wa: -15 });
const C1_BACK2 = G({ hx: 1, hy: -21.4, tl: 3, hd: -3, tw: 1, aFx: 8, aFy: -6, lFx: 9.5, lBx: -9, wa: -92 });
const C1_BACK3 = E({ hx: 0.5, hy: -22, tl: -2, hd: -4, aFx: 5.5, aFy: 3, aBx: 1, aBy: 8, lFx: 7.5, lBx: -7.5, wa: -142 });

/**
 * 1타 가로 휘두르기 (128×96, 2차 리워크): 1~4 감기(어깨에서 들어 등 뒤로 넘김, 4번 7틱 멈춤) → 5 허리가 먼저 풀림 → 6 스미어(잔상 3개) →
 * 7~8 가슴 앞을 가로지름(판정) → 9~10 지나쳐 머리가 땅에 닿음 → 11~12 쥔 채 멈춤 → 13~17 무게가 뒤로 빠진 뒤 끌어 올려 어깨로.
 * 17프레임 43틱 (공격 데이터 그대로: 발동 16 · 지속 4 · 회복 23)
 */
export const EDWARD_CHOP: MotionData = {
  name: 'edward/chop',
  label: '에드워드 1타 가로 휘두르기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [2, 2, 3, 7, 1, 1, 2, 2, 2, 2, 4, 3, 2, 2, 3, 3, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: C1_LIFT },
    { at: 2, pose: C1_COIL },
    { at: 3, pose: C1_MAX, stop: true },
    { at: 4, pose: C1_RELEASE },
    { at: 5, pose: C1_SMEAR },
    { at: 6, pose: C1_HIT },
    { at: 7, pose: C1_HIT2 },
    { at: 8, pose: C1_OVER },
    { at: 9, pose: C1_OVER2, stop: true },
    { at: 10, pose: C1_HOLD },
    { at: 11, pose: C1_HOLD2, stop: true },
    { at: 12, pose: C1_BACK0 },
    { at: 13, pose: C1_BACK1 },
    { at: 14, pose: C1_BACK2 },
    { at: 15, pose: C1_BACK3 },
    { at: 16, pose: E_STANCE },
  ],
};

// ---- 2타: 반대 방향으로 되돌려 휘두르기 (반 걸음 전진, 낮게: 반원 지름 72px) ----
/** 2타 원호: 몸 뒤 아래에서 발 앞 바닥을 스치고 앞 위로 (반시계 방향) */
const ARC2: HammerArc = { cx: 16, cy: -26, rx: 36, ry: 20, a0: 115, a1: -20 };
/** 감기: 땅에 닿은 해머를 몸 뒤로 끌어 온다 (머리가 바닥을 긁는다) */
const C2_DRAG = A({ hx: 2, hy: -17, tl: 24, hd: -4, tw: 0, lFx: 15, lBx: -14, wa: 112 }, [10, -7]);
const C2_COIL = A({ hx: -1.5, hy: -16, tl: 16, hd: -6, tw: -4, lFx: 13, lBx: -14, wa: 150 }, [-24, -9]);
/** 감기 끝 (멈춤 7틱): 낮게 웅크려 해머를 등 뒤 아래에 늘어뜨린다 */
const C2_MAX = A({ hx: -2.5, hy: -15, tl: 12, hd: -8, tw: -5, lFx: 13, lBx: -15, wa: 165 }, [-30, -14]);
/** 풀림: 반 걸음 내디디며 허리·어깨가 먼저 돈다. 손과 해머는 아직 몸 뒤 아래 */
const C2_RELEASE = A({ hx: 0, hy: -15.3, tl: 14, hd: -8, tw: -2, lFx: 15, lBx: -14.5, wa: 160 }, [-29.7, -11.7]);
/** 스미어: 두 손이 허리 앞으로 끌려 나오고, 해머 머리는 발밑 바닥을 스치며 처져 따라온다 */
const C2_SMEAR = A({ hx: 2, hy: -15, tl: 18, hd: -8, tw: 2, lFx: 16, lBx: -14, wa: 127 }, arcAt(ARC2, 115));
/** 타격: 처진 머리가 손을 따라잡아 낮게 앞을 가로질러 올라온다 */
const C2_HIT = A({ hx: 4, hy: -15.5, tl: 20, hd: -8, tw: 5, lFx: 17, lBx: -15, wa: 42 }, arcAt(ARC2, 45));
const C2_HIT2 = A({ hx: 5, hy: -16.5, tl: 14, hd: -10, tw: 5.5, lFx: 17, lBx: -15.5, wa: 9 }, arcAt(ARC2, 5));
/** 지나치기: 머리가 앞 위로 더 쏠린다 (몸이 따라 일어선다) */
export const C2_OVER = A({ hx: 5, hy: -18, tl: 6, hd: -12, tw: 5, lFx: 17, lBx: -15, wa: -46 }, arcAt(ARC2, -35));
const C2_OVER2 = A({ hx: 4.5, hy: -19.5, tl: 0, hd: -12, tw: 4.5, lFx: 17, lBx: -15, wa: -80 }, [30, -50]);
/** 여운: 앞 위로 치켜든 채 멈춘다 (쏠린 머리가 조금 돌아오고, 몸이 2px 내려앉는다) */
const C2_HOLD = A({ hx: 4.5, hy: -19.5, tl: 2, hd: -11, tw: 4.5, lFx: 17, lBx: -15, wa: -72 }, [33, -48]);
const C2_HOLD2 = A({ hx: 4.3, hy: -18.4, tl: 3, hd: -11, tw: 4.3, lFx: 17, lBx: -15, wa: -74 }, [33, -46]);
/** 복귀: 무게가 먼저 뒤로 빠진다 (해머는 아직 앞 위) → 손이 얼굴 앞으로 → 어깨로 오는 동안 머리가 뒤로 넘어간다 → 어깨에 걸치며 한 번 더 내려앉는다 */
const C2_BACK0 = A({ hx: 2, hy: -20.5, tl: 0, hd: -9, tw: 2.5, lFx: 14, lBx: -13, wa: -74 }, [29, -50]);
const C2_BACK1 = G({ hx: 1.5, hy: -21.4, tl: -2, hd: -7, tw: 2, aFx: 7, aFy: -8, lFx: 11, lBx: -10.5, wa: -98 });
const C2_BACK2 = G({ hx: 1, hy: -22, tl: -3, hd: -5, tw: 1.5, aFx: 6, aFy: -1, lFx: 9, lBx: -9, wa: -125 });
const C2_BACK3 = E({ hx: 0.5, hy: -21.8, tl: -3, hd: -4, aFx: 5, aFy: 4, aBx: 1, aBy: 8, lFx: 7.5, lBx: -7.5, wa: -153 });

/**
 * 2타 되돌려 휘두르기 (128×96, 2차 리워크): 1타 지나치기 자세에서 → 2~4 해머를 바닥에 끌어 등 뒤 아래로 감음(4번 7틱 멈춤) →
 * 5 반 걸음 내디디며 허리가 먼저 → 6 스미어 → 7~8 낮게 앞을 가로질러 올라옴(판정) → 9~10 앞 위로 쏠림 → 11~12 치켜든 채 멈춤 →
 * 13~17 무게가 뒤로 빠진 뒤 어깨로. 17프레임 43틱 (공격 데이터 그대로: 발동 16 · 지속 4 · 회복 23)
 */
export const EDWARD_SWING: MotionData = {
  name: 'edward/swing',
  label: '에드워드 2타 되돌려 휘두르기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [2, 2, 3, 7, 1, 1, 2, 2, 2, 2, 4, 3, 2, 2, 3, 3, 2],
  keys: [
    { at: 0, pose: C1_OVER },
    { at: 1, pose: C2_DRAG },
    { at: 2, pose: C2_COIL },
    { at: 3, pose: C2_MAX, stop: true },
    { at: 4, pose: C2_RELEASE },
    { at: 5, pose: C2_SMEAR },
    { at: 6, pose: C2_HIT },
    { at: 7, pose: C2_HIT2 },
    { at: 8, pose: C2_OVER },
    { at: 9, pose: C2_OVER2, stop: true },
    { at: 10, pose: C2_HOLD },
    { at: 11, pose: C2_HOLD2, stop: true },
    { at: 12, pose: C2_BACK0 },
    { at: 13, pose: C2_BACK1 },
    { at: 14, pose: C2_BACK2 },
    { at: 15, pose: C2_BACK3 },
    { at: 16, pose: E_STANCE },
  ],
};

// ---- 3타: 머리 위로 크게 돌려 내려찍기 (위 → 아래 원호, 끝에서 바닥 균열 40px) ----
/** 3타 원호: 머리 위 뒤에서 넘어와 앞 아래 바닥으로 (시계 방향) */
const ARC3: HammerArc = { cx: 18, cy: -40, rx: 36, ry: 40, a0: -110, a1: 30 };
/** 감기: 두 손이 먼저 해머를 앞에서 머리 위로 들어 올린다 (머리는 아직 앞 위를 향한다) */
const C3_UP = A({ hx: 3, hy: -20.5, tl: -4, hd: -12, tw: 2, lFx: 15, lBx: -13, wa: -58 }, [23, -88]);
/** 머리 위를 지나 등 뒤로 넘긴다 (몸을 젖힌다) */
const C3_OVER_HEAD = A({ hx: 0, hy: -21, tl: -12, hd: -12, tw: -1, lFx: 13, lBx: -13, wa: -122 }, [-12, -84]);
/** 감기 끝 (멈춤 7틱): 등 뒤로 크게 젖혀 해머가 뒤 위에 걸린다 */
const C3_MAX = A({ hx: -2, hy: -20.5, tl: -18, hd: -10, tw: -3, lFx: 13, lBx: -14, wa: -150 }, [-36, -70]);
/** 풀림: 허리·어깨가 먼저 앞으로 접히기 시작한다. 손과 해머는 아직 머리 뒤 위 */
const C3_RELEASE = A({ hx: 0.5, hy: -20, tl: -10, hd: -10, tw: -1, lFx: 15, lBx: -14.5, wa: -144 }, [-34.8, -72.6]);
/** 스미어: 몸을 앞으로 접으며 두 손이 이마 앞으로 끌려 나오고, 해머 머리는 머리 위에 처져 뒤따른다 */
const C3_SMEAR = A({ hx: 3, hy: -19, tl: 10, hd: -8, tw: 3, lFx: 16, lBx: -15, wa: -107 }, arcAt(ARC3, -110));
/** 타격: 머리가 손을 따라잡아 앞 위에서 앞 아래로 내려찍는다 */
const C3_HIT = A({ hx: 5, hy: -17, tl: 24, hd: -4, tw: 5, lFx: 18, lBx: -16, wa: -29 }, arcAt(ARC3, -40));
const C3_HIT2 = A({ hx: 6, hy: -15, tl: 34, hd: 0, tw: 5, lFx: 18.5, lBx: -16.5, wa: 15 }, arcAt(ARC3, 5));
/** 지나치기: 머리가 바닥에 쿵 박힌다 (바닥 균열), 몸이 깊이 끌려 숙인다 */
export const C3_IMPACT = A({ hx: 6.5, hy: -13.5, tl: 42, hd: 4, tw: 4.5, lFx: 19, lBx: -17, wa: 70 }, [48, -6]);
const C3_IMPACT2 = A({ hx: 6.8, hy: -13, tl: 44, hd: 6, tw: 4.5, lFx: 19, lBx: -17, wa: 78 }, [49, -6]);
/** 여운: 바닥에 박힌 해머를 쥔 채 버틴다 (몸이 2px 내려앉는다) */
const C3_HOLD = A({ hx: 6.5, hy: -13.5, tl: 42, hd: 5, tw: 4.5, lFx: 19, lBx: -17, wa: 74 }, [48.5, -6]);
const C3_HOLD2 = A({ hx: 6.3, hy: -12.5, tl: 43, hd: 4, tw: 4.3, lFx: 19, lBx: -17, wa: 75 }, [48.5, -6]);
/**
 * 복귀: 무게가 먼저 뒤로 빠진다 (해머는 아직 바닥에 박힌 채) → 두 손으로 뽑아 끌어 올리고 → 얼굴 앞으로 (머리는 아직 앞 위) →
 * 손이 어깨로 오는 동안 머리가 뒤로 넘어가 어깨에 걸치며 한 번 더 내려앉는다
 */
const C3_BACK0 = A({ hx: 5, hy: -14.5, tl: 36, hd: 2, tw: 3.5, lFx: 18, lBx: -16, wa: 72 }, [46, -6]);
const C3_BACK1 = G({ hx: 3.5, hy: -17.5, tl: 20, hd: -2, tw: 2, aFx: 13, aFy: 4, lFx: 15, lBx: -13, wa: 50 });
const C3_BACK2 = G({ hx: 2, hy: -20, tl: 8, hd: -3, tw: 1, aFx: 9, aFy: -6, lFx: 11, lBx: -10.5, wa: -40 });
const C3_BACK3 = E({ hx: 0.5, hy: -21.8, tl: -2, hd: -4, aFx: 5, aFy: 4, aBx: 1, aBy: 8, lFx: 7.5, lBx: -7.5, wa: -153 });

/**
 * 3타 머리 위로 돌려 내려찍기 (128×96, 2차 리워크): 2타 지나치기 자세에서 → 2~4 해머를 앞에서 머리 위로 돌려 등 뒤로 넘김(4번 7틱 멈춤) →
 * 5 허리가 먼저 접힘 → 6 스미어 → 7~8 위에서 앞 아래로 내려찍음(판정) → 9~10 바닥에 박힘(균열 40px) → 11~12 박힌 채 버팀 →
 * 13~17 무게가 뒤로 빠진 뒤 뽑아 어깨로. 17프레임 44틱 (공격 데이터 그대로: 발동 17 · 지속 4 · 회복 23)
 */
export const EDWARD_RISE: MotionData = {
  name: 'edward/rise',
  label: '에드워드 3타 머리 위로 돌려 내려찍기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [3, 2, 3, 7, 1, 1, 2, 2, 2, 2, 4, 4, 2, 3, 3, 2, 1],
  keys: [
    { at: 0, pose: C2_OVER },
    { at: 1, pose: C3_UP },
    { at: 2, pose: C3_OVER_HEAD },
    { at: 3, pose: C3_MAX, stop: true },
    { at: 4, pose: C3_RELEASE },
    { at: 5, pose: C3_SMEAR },
    { at: 6, pose: C3_HIT },
    { at: 7, pose: C3_HIT2 },
    { at: 8, pose: C3_IMPACT },
    { at: 9, pose: C3_IMPACT2, stop: true },
    { at: 10, pose: C3_HOLD },
    { at: 11, pose: C3_HOLD2, stop: true },
    { at: 12, pose: C3_BACK0 },
    { at: 13, pose: C3_BACK1 },
    { at: 14, pose: C3_BACK2 },
    { at: 15, pose: C3_BACK3 },
    { at: 16, pose: E_STANCE },
  ],
};

// ---- 4타: 몸 한 바퀴 돌린 풀스윙 (가로 원호 지름 110px, 해머 머리 잔상) ----
/** 4타 원호: 등 뒤 멀리에서 몸 아래를 휘돌아 앞 멀리로 (반시계 방향, 가로로 납작한 반원) */
const ARC4: HammerArc = { cx: 0, cy: -32, rx: 55, ry: 22, a0: 175, a1: -5 };
/** 감기: 두 손이 먼저 해머를 바닥에서 뽑아 몸 쪽으로 끈다 (머리는 아직 바닥을 긁는다) */
const C4_PULL = A({ hx: 2, hy: -17, tl: 20, hd: -6, tw: -1, lFx: 15, lBx: -12, wa: 80 }, [19, -5]);
/** 몸을 크게 틀며 해머를 몸 뒤로 끌어 돌린다 (머리는 손보다 늦게 따라온다) */
const C4_TURN = A({ hx: -2, hy: -17, tl: 6, hd: -10, tw: -5, lFx: 12, lBx: -14, wa: 135 }, [-39, -12]);
/** 감기 끝 (멈춤 7틱): 등을 보일 만큼 몸을 틀어 해머를 등 뒤 멀리 수평으로 뻗는다 */
const C4_MAX = A({ hx: -4, hy: -17.5, tl: -4, hd: -12, tw: -7, lFx: 12, lBx: -16, wa: 180 }, [-54, -34]);
/** 풀림: 허리가 먼저 돌아 나온다 (뒷발 앞꿈치로 돈다). 손과 해머는 아직 등 뒤 멀리 */
const C4_RELEASE = A({ hx: -1.5, hy: -17, tl: 2, hd: -12, tw: -4, lFx: 13, lBx: -15, lBy: -1, wa: 177 }, [-54, -32.4]);
/** 스미어: 몸이 한 바퀴 풀리며 뒷발이 앞으로 넘어온다, 두 손이 허리 앞으로 끌려 나오고 해머 머리는 몸 아래 뒤에 처져 휘돈다 */
const C4_SMEAR = A({ hx: 2, hy: -15, tl: 14, hd: -10, tw: 2, lFx: 15, lBx: -12, wa: 132 }, arcAt(ARC4, 110));
/** 타격: 머리가 손을 따라잡아 몸 아래를 휘돌아 앞으로 크게 뻗는다 */
const C4_HIT = A({ hx: 5, hy: -15, tl: 18, hd: -10, tw: 6, lFx: 19, lBx: -15, wa: 28 }, arcAt(ARC4, 50));
const C4_HIT2 = A({ hx: 7, hy: -16, tl: 12, hd: -12, tw: 6.5, lFx: 20, lBx: -15, wa: -10 }, arcAt(ARC4, 5));
/** 지나치기: 머리가 앞 위로 크게 쏠리며 몸이 앞으로 끌려간다 (뒷발이 들린다) */
const C4_OVER = A({ hx: 8, hy: -18, tl: 4, hd: -14, tw: 6, lFx: 20, lBx: -13, lBy: -3, wa: -52 }, [44, -62]);
const C4_OVER2 = A({ hx: 8, hy: -19.5, tl: 0, hd: -14, tw: 5.5, lFx: 20, lBx: -12, lBy: -2, wa: -82 }, [32, -76]);
/** 여운: 앞 위로 치켜든 채 멈춘다 (쏠린 머리가 조금 돌아오고, 들린 뒷발이 내려오며 2px 내려앉는다) */
const C4_HOLD = A({ hx: 7.5, hy: -19.5, tl: 2, hd: -13, tw: 5, lFx: 20, lBx: -13, wa: -74 }, [35, -73]);
const C4_HOLD2 = A({ hx: 7, hy: -18.5, tl: 3, hd: -12, tw: 5, lFx: 20, lBx: -13.5, wa: -76 }, [34, -71]);
/** 복귀: 무게가 먼저 뒤로 빠진다 (해머는 아직 앞 위) → 뒷발을 끌어 오며 손이 얼굴 앞으로 → 어깨로 오는 동안 머리가 넘어간다 → 어깨에 걸침 */
const C4_BACK0 = A({ hx: 5, hy: -20, tl: 0, hd: -11, tw: 4, lFx: 18, lBx: -12, wa: -76 }, [31, -73]);
const C4_BACK1 = G({ hx: 3.5, hy: -21, tl: -2, hd: -8, tw: 2, aFx: 6, aFy: -10, lFx: 15, lBx: -10, wa: -95 });
const C4_BACK2 = G({ hx: 2, hy: -21.8, tl: -3, hd: -5, tw: 1.5, aFx: 5, aFy: -1, lFx: 11, lBx: -8.5, wa: -122 });
const C4_BACK3 = E({ hx: 0.8, hy: -21.8, tl: -3, hd: -4, aFx: 5, aFy: 4, aBx: 1, aBy: 8, lFx: 8, lBx: -7.5, wa: -153 });

/**
 * 4타 풀스윙 (128×96, 2차 리워크): 3타 박힌 자세에서 → 2~4 해머를 뽑아(머리는 바닥에 끌린다) 몸 뒤로 끌어 돌리고 등을 보일 만큼 틀어 7틱 멈춤 →
 * 5 허리가 먼저 풀림 → 6 스미어(몸이 한 바퀴 풀림, 잔상) → 7~8 몸 아래를 휘돌아 앞으로(판정, 멀리 날림) → 9~10 앞 위로 쏠림 →
 * 11~12 치켜든 채 멈춤 → 13~17 무게가 뒤로 빠진 뒤 어깨로. 17프레임 48틱 (공격 데이터 그대로: 발동 19 · 지속 4 · 회복 25)
 */
export const EDWARD_SMASH: MotionData = {
  name: 'edward/smash',
  label: '에드워드 4타 한 바퀴 풀스윙',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.35, ghosts: 3 },
  dur: [3, 3, 4, 7, 1, 1, 2, 2, 2, 2, 6, 6, 2, 2, 2, 2, 1],
  keys: [
    { at: 0, pose: C3_IMPACT },
    { at: 1, pose: C4_PULL },
    { at: 2, pose: C4_TURN },
    { at: 3, pose: C4_MAX, stop: true },
    { at: 4, pose: C4_RELEASE },
    { at: 5, pose: C4_SMEAR },
    { at: 6, pose: C4_HIT },
    { at: 7, pose: C4_HIT2 },
    { at: 8, pose: C4_OVER },
    { at: 9, pose: C4_OVER2, stop: true },
    { at: 10, pose: C4_HOLD },
    { at: 11, pose: C4_HOLD2, stop: true },
    { at: 12, pose: C4_BACK0 },
    { at: 13, pose: C4_BACK1 },
    { at: 14, pose: C4_BACK2 },
    { at: 15, pose: C4_BACK3 },
    { at: 16, pose: E_STANCE },
  ],
};

// ---- 띄우기: 퍼 올리기 (바닥을 긁고 수직으로 솟구친다, 몸도 함께 솟는다) ----
/** 두 손이 먼저 해머를 어깨에서 들어 앞으로 (머리는 어깨 뒤에 처진다) */
const L_LIFT = G({ hx: -0.5, hy: -21, tl: 6, hd: -4, tw: 0.5, aFx: 8, aFy: 2, lFx: 9, lBx: -10, wa: -140 });
/** 웅크린다: 손은 가슴 앞으로 내려왔지만 해머는 아직 머리 위에 서 있다 (손보다 늦다) */
const L_LOAD = AH({ hx: -1, hy: -15, tl: 28, hd: -8, tw: 1, lFx: 13, lBx: -14, wa: -100 }, [22, -37]);
/** 감기 끝 (멈춤 5틱): 더 깊이 웅크리고, 해머 머리가 발 앞 바닥에 쿵 떨어져 바닥을 긁는다 */
const L_COIL = A({ hx: -1.5, hy: -13.5, tl: 32, hd: -10, tw: 1.5, lFx: 14, lBx: -14, wa: 96 }, [20, -7]);
/** 풀림: 엉덩이가 먼저 솟기 시작한다. 손과 해머 머리는 아직 바닥 */
const L_RELEASE = A({ hx: 0.5, hy: -15.5, tl: 24, hd: -12, tw: 2.5, lFx: 14.5, lBx: -13.5, wa: 96 }, [20, -7.5]);
/** 스미어: 두 손이 가슴 앞으로 끌려 올라오고, 해머 머리는 손 아래에 처져 뒤따른다 */
const L_SMEAR = AH({ hx: 3.5, hy: -20.5, tl: 4, hd: -15, tw: 3.5, lFx: 14, lBx: -12, wa: 70 }, [18, -54]);
/** 타격: 머리가 손을 앞질러 수직으로 솟구치고, 몸도 발끝까지 펴지며 솟는다 */
const L_HIT = AH({ hx: 4, hy: -23, tl: -2, hd: -18, tw: 4.5, lFx: 12, lFy: -2, lBx: -10, lBy: -1, wa: -60 }, [14, -56]);
const L_HIT2 = AH({ hx: 4, hy: -24, tl: -6, hd: -20, tw: 4.5, lFx: 11, lFy: -3, lBx: -9, lBy: -2, wa: -78 }, [10, -58]);
/** 지나치기: 머리가 머리 위 뒤로 더 넘어가고 몸이 한 번 더 늘어난다 */
const L_OVER = AH({ hx: 4, hy: -24.5, tl: -8, hd: -20, tw: 4.3, lFx: 11, lFy: -3.5, lBx: -9, lBy: -2.5, wa: -95 }, [8, -60]);
const L_OVER2 = AH({ hx: 3.8, hy: -24.3, tl: -9, hd: -19, tw: 4, lFx: 11, lFy: -3, lBx: -9, lBy: -2, wa: -102 }, [8, -61]);
/** 여운: 치켜든 채 머리가 조금 돌아오고, 발뒤꿈치가 내려와 무게가 내려앉는다 */
const L_HOLD = AH({ hx: 3.5, hy: -23, tl: -6, hd: -18, tw: 4, lFx: 11, lFy: -1, lBx: -9, wa: -98 }, [8, -60]);
const L_HOLD2 = AH({ hx: 3.2, hy: -21.4, tl: -5, hd: -16, tw: 3.5, lFx: 11, lBx: -9, wa: -98 }, [8, -57]);
/** 복귀: 손이 어깨로 내려오는 동안 해머가 뒤로 넘어가 어깨에 걸친다 (뒷손은 끝에 주머니로) */
const L_BACK1 = G({ hx: 2, hy: -21.4, tl: -3, hd: -9, tw: 2, aFx: 5, aFy: -9, lFx: 10, lBx: -9, wa: -112 });
const L_BACK2 = G({ hx: 1, hy: -22, tl: -3, hd: -6, tw: 1.5, aFx: 5, aFy: -2, lFx: 8.5, lBx: -8.5, wa: -124 });
const L_BACK3 = E({ hx: 0.5, hy: -21.8, tl: -3, hd: -4, aFx: 5, aFy: 4, aBx: 1, aBy: 8, lFx: 7.5, lBx: -7.5, wa: -158 });

/**
 * 띄우기 퍼 올리기 (128×96, 2차 리워크): 1~2 두 손이 먼저 해머를 들고 → 3 웅크림(해머는 아직 머리 위) → 4 감기 끝(5틱 멈춤, 머리가 발 앞 바닥에 떨어져 긁음) →
 * 5 엉덩이가 먼저 솟음 → 6 스미어(손이 가슴 앞으로, 머리는 처짐) → 7~8 머리가 손을 앞질러 수직으로 솟구침(판정, 몸도 발끝까지) →
 * 9~10 머리 위 뒤로 더 넘어감 → 11~12 여운(발뒤꿈치가 내려와 내려앉음) → 13~16 어깨로. 16프레임 36틱 (공격 데이터 그대로: 발동 11 · 지속 4 · 회복 21)
 */
export const EDWARD_SCOOP: MotionData = {
  name: 'edward/scoop',
  label: '에드워드 띄우기 퍼 올리기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [1, 1, 2, 5, 1, 1, 2, 2, 2, 2, 5, 3, 2, 2, 2, 3],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: L_LIFT },
    { at: 2, pose: L_LOAD },
    { at: 3, pose: L_COIL, stop: true },
    { at: 4, pose: L_RELEASE },
    { at: 5, pose: L_SMEAR },
    { at: 6, pose: L_HIT },
    { at: 7, pose: L_HIT2 },
    { at: 8, pose: L_OVER },
    { at: 9, pose: L_OVER2, stop: true },
    { at: 10, pose: L_HOLD },
    { at: 11, pose: L_HOLD2, stop: true },
    { at: 12, pose: L_BACK1 },
    { at: 13, pose: L_BACK2 },
    { at: 14, pose: L_BACK3 },
    { at: 15, pose: E_STANCE },
  ],
};

// ---- 쓸기: 바닥 쓸기 (낮게 엎드려 해머 머리로 발목 높이를 가로지른다) ----
/*
 * 손이 먼저 낮고 고르게 앞으로 나가고 (허리 앞 → 앞 무릎 위), 해머 머리는 손 뒤 바닥에 끌리다가 손을 앞질러 휘돈다.
 * 머리 자리는 손 자리 + 해머 길이(30px) × 무기 방향으로 정했다 (손이 튀지 않게)
 */
/** 해머를 어깨에서 내린다: 두 손이 먼저 앞으로 나오고 머리는 어깨 뒤에 처진다, 무릎을 굽히기 시작한다 */
const W_LIFT = G({ hx: -0.5, hy: -20.5, tl: 8, hd: -4, tw: 0, aFx: 7, aFy: 6, lFx: 9, lBx: -10, wa: -150 });
/** 낮게 웅크린다: 머리는 아직 몸 뒤 허공에서 내려오는 중 */
const W_LOAD = A({ hx: -1.5, hy: -15, tl: 22, hd: -10, tw: -2, lFx: 12, lBx: -14, wa: -160 }, [-25, -25]);
/** 감기 끝 (멈춤 6틱): 뒷발에 싣고 (엉덩이 4px 뒤로) 어깨를 뒤로 틀어 해머 머리를 뒤 바닥 멀리 내려놓는다 */
const W_COIL = A({ hx: -4, hy: -13, tl: 26, hd: -12, tw: -4, lFx: 13, lBx: -15, wa: -190 }, [-36, -8]);
/** 풀림: 허리·어깨가 먼저 돌고 앞발이 미끄러져 나간다. 손은 아직 뒤에 있고 해머 머리는 뒤 바닥에 끌린다 */
const W_RELEASE = A({ hx: 0, hy: -12.5, tl: 30, hd: -13, tw: 1, lFx: 15, lBx: -15, wa: -196 }, [-34, -8]);
/** 스미어: 두 손이 허리 앞으로 끌려 나오고, 해머 머리는 손 뒤 바닥을 긁으며 따라온다 (잔상) */
const W_SMEAR = A({ hx: 3, hy: -12, tl: 33, hd: -14, tw: 3, lFx: 18, lBx: -16, wa: -230 }, [-11, -3]);
/** 타격: 머리가 손을 앞질러 휘돌며 정강이 높이를 가로지른다 */
const W_HIT = A({ hx: 5, hy: -11.5, tl: 37, hd: -14, tw: 4.5, lFx: 19, lBx: -17, wa: -345 }, [43, -16]);
const W_HIT2 = A({ hx: 5.5, hy: -11.2, tl: 38, hd: -13, tw: 5, lFx: 19, lBx: -17.5, wa: -355 }, [50, -18]);
/** 지나치기: 머리가 앞 위로 더 쏠리며, 몸이 끌려 나간다 (뒷발 뒤꿈치가 들린다) */
const W_OVER = A({ hx: 6.5, hy: -10.8, tl: 39, hd: -12, tw: 5, lFx: 19.5, lBx: -17, lBy: -1, wa: -375 }, [54, -26]);
const W_OVER2 = A({ hx: 7, hy: -10.4, tl: 40, hd: -11, tw: 4.5, lFx: 19.5, lBx: -16, lBy: -1.5, wa: -395 }, [52, -33]);
/** 여운: 쏠린 머리가 조금 돌아오고 (2~4px), 몸이 내려앉는다 */
const W_HOLD = A({ hx: 6.5, hy: -10.8, tl: 38, hd: -11, tw: 4.5, lFx: 19.5, lBx: -16.5, wa: -388 }, [52.5, -31]);
const W_HOLD2 = A({ hx: 6.3, hy: -10.2, tl: 38, hd: -11, tw: 4.3, lFx: 19.5, lBx: -16.5, wa: -385 }, [53, -29]);
/**
 * 복귀: 무게가 먼저 뒤로 빠지며 일어난다 (해머는 아직 앞에) → 두 손이 해머를 앞에서 가슴 높이로 들고 (머리는 아직 앞) →
 * 손이 어깨로 오는 동안 해머가 머리 위로 넘어간다 → 어깨에 걸치며 머리가 한 번 더 내려앉는다 (뒷손은 손잡이를 놓고 두 프레임에 걸쳐 주머니로)
 */
const W_BACK1 = G({ hx: 3, hy: -14, tl: 24, hd: -6, tw: 2, aFx: 14, aFy: 6, lFx: 15, lBx: -14, wa: -385 });
const W_BACK2 = G({ hx: 1.5, hy: -18, tl: 12, hd: -4, tw: 1.5, aFx: 12, aFy: -6, lFx: 12, lBx: -12, wa: -395 });
const W_BACK3 = G({ hx: 0.5, hy: -20.5, tl: 2, hd: -3, tw: 1, aFx: 6, aFy: 0, lFx: 9.5, lBx: -9.5, wa: -455 });
const W_BACK4 = E({ hx: 0.3, hy: -21, tl: -2, hd: -4, aFx: 5, aFy: 5, aBx: 1, aBy: 8, lFx: 7.5, lBx: -8, wa: -515 });

/**
 * 쓸기 바닥 쓸기 (128×96, 2차 리워크): 1~3 해머를 내려 몸 뒤 바닥에 떨구며 웅크림 → 4 감기 끝(6틱 멈춤) →
 * 5 허리가 먼저 풀리고 머리는 뒤에 끌림 → 6 스미어 → 7~8 발목 높이를 가로지름(판정) → 9~10 머리가 쏠리며 몸이 끌려 나감 →
 * 11~12 여운 → 13~17 무게가 뒤로 빠진 뒤 해머를 들어 어깨로. 17프레임 36틱 (공격 데이터 그대로: 발동 11 · 지속 4 · 회복 21)
 */
export const EDWARD_SWEEP: MotionData = {
  name: 'edward/sweep',
  label: '에드워드 쓸기 바닥 쓸기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [1, 1, 1, 6, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 2, 2, 3],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: W_LIFT },
    { at: 2, pose: W_LOAD },
    { at: 3, pose: W_COIL, stop: true },
    { at: 4, pose: W_RELEASE },
    { at: 5, pose: W_SMEAR },
    { at: 6, pose: W_HIT },
    { at: 7, pose: W_HIT2 },
    { at: 8, pose: W_OVER },
    { at: 9, pose: W_OVER2, stop: true },
    { at: 10, pose: W_HOLD },
    { at: 11, pose: W_HOLD2, stop: true },
    { at: 12, pose: W_BACK1 },
    { at: 13, pose: W_BACK2 },
    { at: 14, pose: W_BACK3 },
    { at: 15, pose: W_BACK4 },
    { at: 16, pose: STANCE_TURNED },
  ],
};

// ---- 대시 공격: 세 걸음 돌진하던 힘을 실어 해머가 크게 가로지른다 ----
/*
 * 손 길을 먼저 정하고 (어깨 뒤 위 → 가슴 앞 → 앞으로 뻗음), 해머 머리는 손에서 해머 길이만큼 무기 각도로 둔다.
 * 머리는 몸 뒤 어깨 높이 → 몸 옆 허리 아래로 처졌다가 → 가슴 앞을 가로질러 → 앞 위로 쏠린다 (아래로 처진 호)
 */
/** 돌진 자세: 몸을 숙여 달리며 두 손으로 해머를 어깨에 걸쳐 쥔다 */
const D_RUSH = G({ hx: 2, hy: -17, tl: 26, hd: -12, tw: 2, aFx: 2, aFy: 1, lFx: 15, lBx: -15, wa: -150 });
/** 앞발이 쿵 디딘다 (엉덩이 2px 내려앉음): 손이 먼저 해머를 들기 시작한다 */
const D_STEP = G({ hx: 2.5, hy: -15.5, tl: 24, hd: -10, tw: 1, aFx: 0, aFy: -3, lFx: 14, lBx: -13, wa: -154 });
/** 두 손을 머리 옆으로 들어 올리고, 해머 머리는 뒤로 넘어가며 처진다 */
const D_LIFT = AH({ hx: 1.5, hy: -17, tl: 18, hd: -10, tw: -2, lFx: 15, lBx: -14, wa: -168 }, [-6, -46]);
/** 감기 끝 (멈춤 6틱): 어깨를 뒤로 틀어 해머를 등 뒤 어깨 높이에 눕힌다 (돌진하던 힘으로 미끄러진다) */
const D_COIL = AH({ hx: 0, hy: -17.5, tl: 12, hd: -10, tw: -4, lFx: 16, lBx: -15, wa: -188 }, [-14, -40]);
/** 풀림: 허리·어깨가 먼저 돌며 앞발을 더 내딛는다. 손은 아직 뒤, 해머 머리는 처진다 */
const D_RELEASE = AH({ hx: 2, hy: -16.5, tl: 16, hd: -9, tw: -2, lFx: 18, lBx: -16, wa: -196 }, [-15, -40]);
/** 스미어: 두 손이 가슴 앞으로 끌려 나오고, 해머 머리는 몸 옆 허리 아래로 처져 따라온다 (잔상) */
const D_SMEAR = AH({ hx: 3.5, hy: -15.5, tl: 22, hd: -8, tw: 3, lFx: 18, lBx: -16, wa: -225 }, [12, -41]);
/** 타격: 머리가 손을 앞질러 허리 앞을 가로질러 올라온다 */
const D_HIT = AH({ hx: 5, hy: -15, tl: 24, hd: -6, tw: 5, lFx: 19, lBx: -17, wa: -330 }, [16, -36]);
const D_HIT2 = AH({ hx: 5.5, hy: -15.5, tl: 22, hd: -7, tw: 5.5, lFx: 19, lBx: -17.5, wa: -350 }, [24, -36]);
/** 지나치기: 머리가 앞 위로 쏠리며 몸이 끌려 나간다 (뒷발 뒤꿈치가 들린다) */
const D_OVER = AH({ hx: 6.5, hy: -16, tl: 18, hd: -8, tw: 5, lFx: 19.5, lBx: -16, lBy: -1.5, wa: -375 }, [28, -38]);
const D_OVER2 = AH({ hx: 7, hy: -16.5, tl: 15, hd: -9, tw: 4.5, lFx: 19.5, lBx: -15, lBy: -2, wa: -398 }, [28, -40]);
/** 여운: 쏠린 머리가 조금 돌아오며 (3px), 뒷발이 내려앉는다 */
const D_HOLD = AH({ hx: 6.5, hy: -15.8, tl: 15, hd: -8, tw: 4.5, lFx: 19.5, lBx: -15.5, wa: -390 }, [27, -39]);
/** 복귀: 무게가 먼저 뒤로 빠진다 (해머는 아직 앞 위) → 두 손으로 얼굴 앞에 들고 → 손이 어깨로 오는 동안 해머가 머리 위로 넘어간다 → 두 손으로 어깨에 걸치고, 끝에 뒷손이 주머니로 */
const D_BACK1 = G({ hx: 3.5, hy: -18, tl: 10, hd: -5, tw: 2, aFx: 12, aFy: -2, lFx: 16, lBx: -14, wa: -390 });
const D_BACK2 = G({ hx: 2, hy: -19.5, tl: 6, hd: -4, tw: 1.5, aFx: 10, aFy: -8, lFx: 13, lBx: -12, wa: -400 });
const D_BACK3 = G({ hx: 1, hy: -21, tl: 0, hd: -3, tw: 1, aFx: 6, aFy: 0, lFx: 10, lBx: -10, wa: -455 });
const D_BACK4 = G({ hx: 0.5, hy: -21.3, tl: -2, hd: -4, aFx: 5, aFy: 5, lFx: 9, lBx: -9, wa: -515 });

/**
 * 대시 공격 돌진 휘두르기 (128×96, 2차 리워크): 1 돌진 → 2 앞발이 쿵 (손이 먼저 해머를 든다) → 3 머리 옆으로 들어 올림 →
 * 4 감기 끝(6틱 멈춤, 해머가 등 뒤에 눕는다) → 5 허리가 먼저 풀림 → 6 스미어 → 7~8 허리 앞을 가로질러 올라옴(판정) →
 * 9~10 머리가 앞 위로 쏠리며 몸이 끌려 나감 → 11 여운 → 12~16 무게가 뒤로 빠진 뒤 해머를 어깨로. 16프레임 33틱
 * (공격 데이터 그대로: 발동 11 · 지속 4 · 회복 18)
 */
export const EDWARD_RUSH: MotionData = {
  name: 'edward/rush',
  label: '에드워드 대시 공격 돌진 휘두르기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.35, ghosts: 3 },
  dur: [1, 1, 1, 6, 1, 1, 2, 2, 2, 2, 3, 2, 2, 2, 2, 3],
  keys: [
    { at: 0, pose: D_RUSH },
    { at: 1, pose: D_STEP, stop: true },
    { at: 2, pose: D_LIFT },
    { at: 3, pose: D_COIL, stop: true },
    { at: 4, pose: D_RELEASE },
    { at: 5, pose: D_SMEAR },
    { at: 6, pose: D_HIT },
    { at: 7, pose: D_HIT2 },
    { at: 8, pose: D_OVER },
    { at: 9, pose: D_OVER2, stop: true },
    { at: 10, pose: D_HOLD },
    { at: 11, pose: D_BACK1 },
    { at: 12, pose: D_BACK2 },
    { at: 13, pose: D_BACK3 },
    { at: 14, pose: D_BACK4 },
    { at: 15, pose: STANCE_TURNED },
  ],
};

// ---- 공중 평타: 해머 무게에 몸이 끌려 돈다 (각 원호 지름 64px) ----
/** 공중 기본 다리 (무릎을 조금 당긴다) */
const AIR_BASE: Partial<Pose> = { hy: -24, lFx: 7, lFy: -11, lBx: -3, lBy: -9 };
/** 공중 꼭대기 자세 (해머는 어깨) */
export const AIR_REST = E({ ...AIR_BASE, tl: 6, hd: -2, aFx: 5, aFy: 5.5, aBx: -6, aBy: 4, wa: -148 });

/** 공중 1타 원호: 머리 뒤 위에서 앞 아래로 (시계 방향) */
const ARC_A1: HammerArc = { cx: 12, cy: -42, rx: 32, ry: 32, a0: -120, a1: 30 };
const A1_LIFT = A({ ...AIR_BASE, tl: -4, hd: -6, tw: -2, wa: -150 }, [-24, -66]);
const A1_COIL = A({ ...AIR_BASE, tl: -9, hd: -7, tw: -2.5, lFx: 6.5, lFy: -9.5, lBx: -4.5, lBy: -7.5, wa: -168 }, [-35, -57]);
/** 감기 끝 (멈춤 6틱): 몸을 뒤로 젖혀 해머를 머리 뒤로 눕힌다 (다리가 앞으로 모인다) */
const A1_MAX = A({ ...AIR_BASE, tl: -14, hd: -8, tw: -3, lFx: 6, lFy: -8, lBx: -6, lBy: -6, wa: -170 }, [-38, -56]);
/** 풀림: 허리가 먼저 앞으로 접히기 시작한다. 손과 해머는 아직 머리 뒤 */
const A1_RELEASE = A({ ...AIR_BASE, tl: -2, hd: -7, tw: -1, lFx: 5, lFy: -8, lBx: -7, lBy: -6, wa: -165 }, [-37.5, -58.6]);
/** 스미어: 두 손이 머리 앞 위로 끌려 나오고, 해머 머리는 머리 위에 처져 뒤따른다 */
const A1_SMEAR = A({ ...AIR_BASE, tl: 10, hd: -6, tw: 3, wa: -122 }, arcAt(ARC_A1, -110));
/** 타격: 머리가 손을 따라잡고, 해머 무게에 몸이 앞으로 끌려 돈다 (다리가 뒤로 들린다) */
const A1_HIT = A({ hy: -24, tl: 30, hd: -4, tw: 4.5, lFx: 2, lFy: -6, lBx: -10, lBy: -4, wa: -30 }, arcAt(ARC_A1, -30));
const A1_HIT2 = A({ hy: -24, tl: 40, hd: -2, tw: 5, lFx: 0, lFy: -5, lBx: -12, lBy: -3, wa: 1 }, arcAt(ARC_A1, 10));
const A1_OVER = A({ hy: -24, tl: 49, hd: 0, tw: 5, lFx: -2, lFy: -4, lBx: -13, lBy: -2, wa: 56 }, arcAt(ARC_A1, 47));
const A1_OVER2 = A({ hy: -24, tl: 52, hd: 2, tw: 4.5, lFx: -3, lFy: -4, lBx: -13, lBy: -1, wa: 70 }, arcAt(ARC_A1, 60));
/** 여운: 쏠린 머리가 돌아오고 몸이 조금씩 되감긴다 */
const A1_HOLD = A({ hy: -24, tl: 46, hd: 0, tw: 4, lFx: -1, lFy: -5, lBx: -12, lBy: -2, wa: 60 }, arcAt(ARC_A1, 52));
const A1_HOLD2 = A({ hy: -24, tl: 40, hd: -1, tw: 3.5, lFx: 1, lFy: -6, lBx: -10, lBy: -3, wa: 56 }, arcAt(ARC_A1, 48));
/** 복귀: 몸이 먼저 바로 서고 (해머는 아직 앞 아래) → 두 손이 앞 위로 들고 (해머는 아직 앞을 향한다) → 손이 어깨로 오는 동안 해머가 넘어가 어깨에 걸친다 */
const A1_BACK = G({ ...AIR_BASE, tl: 26, hd: -3, tw: 2, aFx: 12, aFy: 6, wa: 48 });
const A1_BACK2 = E({ ...AIR_BASE, tl: 12, hd: -3, tw: 1.5, aFx: 8, aFy: -6, aBx: 6, aBy: -3, wa: 15 });
const A1_BACK3 = E({ ...AIR_BASE, tl: 7, hd: -2.5, tw: 0.5, aFx: 5.5, aFy: 2, aBx: 1, aBy: 1, wa: -140 });

/**
 * 공중 1타 내려치기 (128×96, 2차 리워크): 2~3 해머를 머리 뒤로 들어 감고 → 4 감기 끝(6틱 멈춤) → 5 허리가 먼저 접힘 → 6 스미어 →
 * 7~8 몸이 앞으로 끌려 돌며 앞 아래로 내려침(판정) → 9~10 쏠림 → 11~12 여운 → 13~16 몸이 먼저 바로 선 뒤 어깨로.
 * 16프레임 34틱 (공격 데이터 그대로: 발동 14 · 지속 4 · 회복 16)
 */
export const EDWARD_AIR_CHOP: MotionData = {
  name: 'edward/air_chop',
  label: '에드워드 공중 1타 내려치기',
  wide: true,
  smear: { frame: 5, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [1, 2, 3, 6, 1, 1, 2, 2, 2, 2, 3, 3, 1, 2, 2, 1],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 1, pose: A1_LIFT },
    { at: 2, pose: A1_COIL },
    { at: 3, pose: A1_MAX, stop: true },
    { at: 4, pose: A1_RELEASE },
    { at: 5, pose: A1_SMEAR },
    { at: 6, pose: A1_HIT },
    { at: 7, pose: A1_HIT2 },
    { at: 8, pose: A1_OVER },
    { at: 9, pose: A1_OVER2, stop: true },
    { at: 10, pose: A1_HOLD },
    { at: 11, pose: A1_HOLD2, stop: true },
    { at: 12, pose: A1_BACK },
    { at: 13, pose: A1_BACK2 },
    { at: 14, pose: A1_BACK3 },
    { at: 15, pose: AIR_REST },
  ],
};

/** 공중 2타 원호: 몸 뒤 아래에서 앞 위로 퍼 올린다 (반시계 방향) */
const ARC_A2: HammerArc = { cx: 12, cy: -30, rx: 32, ry: 32, a0: 120, a1: -30 };
const A2_DROP = A({ ...AIR_BASE, tl: 14, hd: -4, tw: 1, wa: -250 }, [4, -8]);
const A2_COIL = A({ ...AIR_BASE, tl: 8, hd: -6, tw: -4, lFx: 9, lFy: -12, lBx: -1, lBy: -12, wa: -210 }, [-22, -14]);
const A2_SMEAR = A({ ...AIR_BASE, tl: -2, hd: -8, tw: 2, wa: -240 }, arcAt(ARC_A2, 100));
/** 타격: 퍼 올리는 해머에 몸이 뒤로 젖혀지며 끌려 돈다 */
const A2_HIT = A({ hy: -24, tl: -10, hd: -10, tw: 5, lFx: 9, lFy: -14, lBx: 1, lBy: -13, wa: -330 }, arcAt(ARC_A2, 40));
const A2_HIT2 = A({ hy: -24, tl: -18, hd: -12, tw: 5, lFx: 10, lFy: -15, lBx: 3, lBy: -14, wa: -374 }, arcAt(ARC_A2, 0));
const A2_OVER = A({ hy: -24, tl: -26, hd: -12, tw: 5, lFx: 10, lFy: -15, lBx: 4, lBy: -14, wa: -422 }, arcAt(ARC_A2, -45));
const A2_OVER2 = A({ hy: -24, tl: -30, hd: -10, tw: 4.5, lFx: 10, lFy: -14, lBx: 4, lBy: -13, wa: -446 }, arcAt(ARC_A2, -70));
const A2_HOLD = A({ hy: -24, tl: -26, hd: -10, tw: 4, lFx: 10, lFy: -14, lBx: 3, lBy: -13, wa: -438 }, arcAt(ARC_A2, -62));
const A2_BACK = G({ ...AIR_BASE, tl: -10, hd: -6, tw: 2, aFx: 5, aFy: -10, wa: -470 });

/** 공중 2타 퍼 올리기 (128×96): 해머를 몸 뒤 아래로 떨궈 감고(2~4) → 스미어(5) → 몸이 뒤로 끌려 돌며 앞 위로 퍼 올림(6~7 판정) → 쏠림 → 여운 → 어깨로. 14프레임 34틱 */
export const EDWARD_AIR_SWING: MotionData = {
  name: 'edward/air_swing',
  label: '에드워드 공중 2타 퍼 올리기',
  wide: true,
  smear: { frame: 4, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [2, 3, 3, 5, 1, 2, 2, 2, 2, 3, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 1, pose: A2_DROP },
    { at: 2, pose: A2_COIL },
    { at: 3, pose: A2_COIL, stop: true },
    { at: 4, pose: A2_SMEAR },
    { at: 5, pose: A2_HIT },
    { at: 6, pose: A2_HIT2 },
    { at: 7, pose: A2_OVER },
    { at: 8, pose: A2_OVER2, stop: true },
    { at: 9, pose: A2_HOLD },
    { at: 10, pose: A2_HOLD, stop: true },
    { at: 11, pose: A2_BACK },
    { at: 13, pose: { ...AIR_REST, wa: (AIR_REST.wa ?? 0) - 360 } },
  ],
};

/** 공중 3타 원호: 머리 위로 크게 돌려 아래로 내려친다 (시계 방향, 상대를 바닥으로 떨어뜨린다) */
const ARC_A3: HammerArc = { cx: 14, cy: -36, rx: 32, ry: 32, a0: -110, a1: 50 };
const A3_UP = A({ ...AIR_BASE, tl: -8, hd: -10, tw: 1, wa: -86 }, [16, -76]);
const A3_BACKUP = A({ ...AIR_BASE, tl: -20, hd: -10, tw: -2, lFx: 9, lFy: -14, lBx: 1, lBy: -12, wa: -140 }, [-28, -66]);
const A3_MAX = A({ ...AIR_BASE, tl: -26, hd: -10, tw: -3, lFx: 10, lFy: -15, lBx: 2, lBy: -13, wa: -158 }, [-36, -58]);
const A3_SMEAR = A({ ...AIR_BASE, tl: 6, hd: -8, tw: 3, wa: -106 }, arcAt(ARC_A3, -95));
/** 타격: 몸이 앞으로 한 바퀴 끌려 돌며 해머가 앞 아래로 떨어진다 */
const A3_HIT = A({ hy: -24, tl: 34, hd: -4, tw: 5, lFx: 1, lFy: -6, lBx: -11, lBy: -4, wa: 0 }, arcAt(ARC_A3, -10));
const A3_HIT2 = A({ hy: -24, tl: 50, hd: 0, tw: 5, lFx: -3, lFy: -4, lBx: -13, lBy: -2, wa: 50 }, arcAt(ARC_A3, 35));
const A3_OVER = A({ hy: -24, tl: 60, hd: 4, tw: 4.5, lFx: -5, lFy: -2, lBx: -14, lBy: 0, wa: 84 }, arcAt(ARC_A3, 70));
const A3_OVER2 = A({ hy: -24, tl: 64, hd: 6, tw: 4, lFx: -6, lFy: -1, lBx: -14, lBy: 1, wa: 96 }, arcAt(ARC_A3, 84));
const A3_HOLD = A({ hy: -24, tl: 56, hd: 4, tw: 4, lFx: -4, lFy: -3, lBx: -13, lBy: -1, wa: 88 }, arcAt(ARC_A3, 76));
const A3_BACK = G({ ...AIR_BASE, tl: 30, hd: -2, tw: 2, aFx: 12, aFy: 4, wa: 20 });
const A3_BACK2 = G({ ...AIR_BASE, tl: 14, hd: -3, tw: 1, aFx: 7, aFy: -7, wa: -100 });

/** 공중 3타 내려쳐 떨어뜨리기 (128×96): 머리 위로 크게 돌려 감고(2~4) → 스미어(5) → 몸이 앞으로 끌려 돌며 앞 아래로(6~7 판정, 상대를 바닥으로) → 쏠림 → 여운 → 어깨로. 14프레임 42틱 */
export const EDWARD_AIR_SPIN: MotionData = {
  name: 'edward/air_spin',
  label: '에드워드 공중 3타 내려쳐 떨어뜨리기',
  wide: true,
  smear: { frame: 4, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [2, 3, 4, 6, 1, 2, 2, 2, 2, 4, 4, 3, 3, 4],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 1, pose: A3_UP },
    { at: 2, pose: A3_BACKUP },
    { at: 3, pose: A3_MAX, stop: true },
    { at: 4, pose: A3_SMEAR },
    { at: 5, pose: A3_HIT },
    { at: 6, pose: A3_HIT2 },
    { at: 7, pose: A3_OVER },
    { at: 8, pose: A3_OVER2, stop: true },
    { at: 9, pose: A3_HOLD },
    { at: 10, pose: A3_HOLD, stop: true },
    { at: 11, pose: A3_BACK },
    { at: 12, pose: A3_BACK2 },
    { at: 13, pose: AIR_REST },
  ],
};

// ---- 내려찍기 (공중): 해머를 머리 위로 들고 수직으로 떨어져 착지 지점을 내려찍는다 (반원 충격파 반지름 48px: sim/chars/edward.ts) ----
/** 머리 위로 치켜든다 (공중에 잠깐 멈춘다) */
const S_LIFT = A({ ...AIR_BASE, tl: -8, hd: -12, tw: 1, wa: -100 }, [2, -82]);
const S_MAX = A({ hy: -24, tl: -14, hd: -12, tw: 0, lFx: 5, lFy: -6, lBx: -5, lBy: -5, wa: -112 }, [-8, -82]);
/** 떨어진다: 두 다리를 아래로 뻗고 해머는 머리 위 (떨어지는 동안 이 자세) */
const S_DROP = A({ hy: -26, tl: -6, hd: -8, tw: 1, lFx: 4, lFy: 0, lBx: -5, lBy: 0, wa: -96 }, [6, -84]);
const S_DROP2 = A({ hy: -26, tl: -4, hd: -6, tw: 1, lFx: 5, lFy: 0, lBx: -5, lBy: 0, wa: -88 }, [10, -84]);
/** 착지 순간: 해머를 발 앞 바닥에 내리꽂는다 (스미어) */
const S_SMEAR = A({ hx: 3, hy: -17, tl: 20, hd: -6, tw: 3, lFx: 14, lBx: -13, wa: -10 }, [44, -48]);
const S_IMPACT = A({ hx: 5, hy: -12.5, tl: 42, hd: 4, tw: 4.5, lFx: 16, lBx: -15, wa: 72 }, [36, -6]);
const S_IMPACT2 = A({ hx: 5.2, hy: -12, tl: 44, hd: 6, tw: 4.5, lFx: 16, lBx: -15, wa: 80 }, [37, -6]);
const S_HOLD = A({ hx: 5, hy: -12.5, tl: 42, hd: 5, tw: 4.5, lFx: 16, lBx: -15, wa: 76 }, [36.5, -6]);
const S_BACK = G({ hx: 3, hy: -17, tl: 20, hd: -2, tw: 2, aFx: 12, aFy: 4, lFx: 13, lBx: -12, wa: 10 });
const S_BACK2 = G({ hx: 1.5, hy: -20.5, tl: 6, hd: -3, tw: 1, aFx: 8, aFy: -8, lFx: 10, lBx: -9, wa: -95 });

/**
 * 내려찍기 (128×96): 1~4 해머를 머리 위로 치켜들고 공중에 멈춤(4번 멈춤) → 5~6 수직으로 떨어짐(판정, 땅에 닿을 때까지 6번에 머문다) →
 * 7 착지하며 내리꽂음(스미어, 반원 충격파) → 8~10 바닥에 박힘 → 11~14 뽑아 어깨로. 착지부터는 땅 위에서 이어진다 (sim/chars/edward.ts). 14프레임
 */
export const EDWARD_AIR_SLAM: MotionData = {
  name: 'edward/air_slam',
  label: '에드워드 내려찍기',
  wide: true,
  smear: { frame: 6, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [2, 3, 4, 6, 2, 3, 1, 2, 3, 6, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: AIR_REST },
    { at: 1, pose: S_LIFT },
    { at: 2, pose: S_MAX },
    { at: 3, pose: S_MAX, stop: true },
    { at: 4, pose: S_DROP },
    { at: 5, pose: S_DROP2, stop: true },
    { at: 6, pose: S_SMEAR },
    { at: 7, pose: S_IMPACT },
    { at: 8, pose: S_IMPACT2, stop: true },
    { at: 9, pose: S_HOLD },
    { at: 10, pose: S_HOLD, stop: true },
    { at: 11, pose: S_BACK },
    { at: 12, pose: S_BACK2 },
    { at: 13, pose: E_STANCE },
  ],
};

/** 동작 이름 → 해머 머리가 지나는 원호 (렌더의 청동빛 원호가 같은 원호를 그린다) */
export const EDWARD_ARCS: Readonly<Record<string, HammerArc>> = {
  'edward/chop': ARC1,
  'edward/swing': ARC2,
  'edward/rise': ARC3,
  'edward/smash': ARC4,
  'edward/air_chop': ARC_A1,
  'edward/air_swing': ARC_A2,
  'edward/air_spin': ARC_A3,
};

export const EDWARD_ATTACK_MOTIONS: readonly MotionData[] = [
  EDWARD_CHOP, EDWARD_SWING, EDWARD_RISE, EDWARD_SMASH, EDWARD_SCOOP, EDWARD_SWEEP, EDWARD_RUSH,
  EDWARD_AIR_CHOP, EDWARD_AIR_SWING, EDWARD_AIR_SPIN, EDWARD_AIR_SLAM,
];
