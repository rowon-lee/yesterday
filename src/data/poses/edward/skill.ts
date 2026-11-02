import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { arcAt, C1_OVER, type HammerArc } from './attack';
import { aim, E, E_STANCE, grip2 } from './stance';

/*
 * 에드워드 스킬 1·스킬 2·차지·필살기 (캐릭터 기획서 표). 모두 128×96 칸 (필살기 상대 반응만 64×64).
 * - 스킬 1 재현:나: 해머를 바닥에 쿵 세우고 가슴을 펴면 푸른 장막이 몸을 덮는다 (판정 없음, 다음 평타 강화)
 * - 스킬 2 불완전한 염동력: 해머는 앞손에 늘어뜨리고, 빈 뒷손을 상대 쪽으로 뻗어 움켜쥔다 (푸른 궤적, 끌어당김/밀어냄은 sim)
 * - 차지 워 해머 올려치기: 해머를 몸 뒤 바닥에 끌어 놓고 모았다가(모으는 동안 되풀이) 아래 → 앞 → 위로 크게 올려친다 (앞쪽 바닥이 솟구친다)
 * - 필살기 껍데기 뒤집어쓰기: 해머를 바닥에 세우고 빈 뒷손으로 상대 머리를 움켜쥔다 (잡기). 맞으면 연출 세 장면
 */

/** 두 손 해머 포즈: 해머 머리 가운데를 그림 자리 (x, y)에 */
const A = (o: Partial<Pose>, at: readonly [number, number]): Pose => aim(E(o), at[0], at[1]);

// ---- 스킬 1 재현:나 ----
/** 해머를 어깨에서 들어 머리 위로 (손은 가슴 앞) */
const R_LIFT = E({ hx: 0, hy: -21.5, tl: -4, hd: -6, aFx: 6, aFy: 3, aBx: -3, aBy: 10, lFx: 8, lBx: -9, wa: -100 });
/** 해머 머리를 발 앞 바닥에 쿵 세운다 (손잡이가 똑바로), 몸을 조금 숙여 누른다 */
const R_PLANT = grip2(E({ hx: 1, hy: -20, tl: 10, hd: 4, aFx: 13, aFy: 10, lFx: 9, lBx: -10, wa: 90 }), 2.5);
/** 가슴을 펴고 턱을 든다: 두 손을 손잡이 끝에 포갠 채 (푸른 장막이 덮는다) */
const R_SWELL = grip2(E({ hx: 0, hy: -23, tl: -6, hd: -14, aFx: 12.5, aFy: 12, lFx: 8, lBx: -9, wa: 90 }), 2.5);
const R_SWELL2 = grip2(E({ hx: 0, hy: -23.3, tl: -7, hd: -15, aFx: 12.5, aFy: 12.2, lFx: 8, lBx: -9, wa: 90 }), 2.5);
/** 해머를 뽑아 어깨로 되돌린다 */
const R_BACK = E({ hx: 0.5, hy: -22, tl: -2, hd: -4, aFx: 8, aFy: 2, aBx: -3, aBy: 11, lFx: 7, lBx: -8, wa: -60 });

/** 스킬 1 재현:나 (128×96): 해머를 들어(2~3) → 바닥에 쿵 세우고(4~5) → 가슴을 펴 장막을 두른다(6~10) → 어깨로(11~13). 13프레임 */
export const EDWARD_REENACT: MotionData = {
  name: 'edward/reenact',
  label: '에드워드 스킬 1 재현:나',
  wide: true,
  dur: [2, 2, 2, 2, 3, 3, 3, 4, 4, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 2, pose: R_LIFT },
    { at: 3, pose: R_PLANT, stop: true },
    { at: 5, pose: R_SWELL },
    { at: 8, pose: R_SWELL2, stop: true },
    { at: 10, pose: R_BACK },
    { at: 12, pose: { ...E_STANCE, wa: -150 } },
  ],
};

// ---- 스킬 2 불완전한 염동력 (2026-11-02 피드백 12-3: 모양 언어는 껍데기와 같은 푸른 장막) ----
/*
 * 끌어당김(앞+스킬 2)과 밀어냄(뒤+스킬 2)은 표시 틱이 같은 두 그림이다 (sim: 같은 기술, 밀어냄은 기술 데이터 alt 그림).
 * 0~10틱 손을 내밀거나 모으고 → 10~14틱 장막을 뻗는다(판정) → 14~34틱 끌어당기거나 밀어붙인다 → 34~40틱 놓는다 → 기본자세.
 * 해머는 앞손이 가슴 앞에서 쥔 채 어깨에 걸쳐 둔다 (가슴 앞 버팀). 손을 뻗는 것은 빈 뒷손
 */
/** 염동력 박자: 14프레임 48틱 (0~10 준비, 10~14 뻗음, 14~34 당김·밀어붙임, 34~40 놓음, 40~48 복귀) */
const TK_DUR = [2, 4, 4, 2, 2, 4, 4, 4, 4, 4, 3, 3, 4, 4] as const;
/** 끌어당김 0~10틱: 뒷손을 앞으로 뻗어 손바닥을 편다 (뒷어깨가 앞으로, 앞손은 가슴 앞에서 해머를 쥐고 버틴다) */
const TP_REACH = E({ hx: 0.5, hy: -21.5, tl: 4, hd: -6, tw: -4, aBx: 13, aBy: -5, lFx: 9, lBx: -9.5 });
const TP_REACH2 = E({ hx: 1.5, hy: -21, tl: 8, hd: -6, tw: -6, aBx: 17.5, aBy: -4, lFx: 11, lBx: -11 });
/** 10~14틱: 손끝에서 푸른 띠가 뻗는다 (손바닥을 더 내민다) */
const TP_SHOOT = E({ hx: 2, hy: -21, tl: 10, hd: -6, tw: -6.5, aBx: 18, aBy: -3.5, lFx: 11.5, lBx: -11 });
/** 14~34틱: 주먹을 쥐며 팔을 당긴다 (몸을 뒤로 젖혀 버틴다) */
const TP_CLENCH = E({ hx: 1.5, hy: -21, tl: 6, hd: -6, tw: -5, aBx: 15.5, aBy: -4, lFx: 11, lBx: -11 });
const TP_PULL1 = E({ hx: 0, hy: -21, tl: 0, hd: -5, tw: -3, aBx: 11, aBy: -2.5, lFx: 11, lBx: -11.5 });
const TP_PULL2 = E({ hx: -1.5, hy: -21.5, tl: -5, hd: -5, tw: -1.5, aBx: 7, aBy: 0, lFx: 11, lBx: -12 });
const TP_PULL3 = E({ hx: -2.5, hy: -21.5, tl: -8, hd: -6, tw: -0.5, aBx: 4, aBy: 2, lFx: 11, lBx: -12 });
/** 34~40틱: 쥔 손을 펴 떨어뜨린다 */
const TP_DROP = E({ hx: -1, hy: -22, tl: -3, hd: -4, tw: -1, aBx: 8, aBy: 7, lFx: 9.5, lBx: -10 });

/** 스킬 2 염동력 끌어당김 (128×96): 손을 뻗어(1~3) → 띠가 뻗어 움켜쥠(4~5 판정) → 주먹을 쥐고 당김(6~10) → 놓음(11~12) → 기본자세. 14프레임 48틱 */
export const EDWARD_TELEKINESIS: MotionData = {
  name: 'edward/telekinesis',
  label: '에드워드 스킬 2 염동력 끌어당김',
  wide: true,
  dur: TK_DUR,
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: TP_REACH },
    { at: 2, pose: TP_REACH2, stop: true },
    { at: 3, pose: TP_SHOOT },
    { at: 4, pose: TP_SHOOT },
    { at: 5, pose: TP_CLENCH },
    { at: 6, pose: TP_PULL1 },
    { at: 8, pose: TP_PULL2 },
    { at: 9, pose: TP_PULL3, stop: true },
    { at: 10, pose: TP_DROP },
    { at: 11, pose: TP_DROP, stop: true },
    { at: 13, pose: E_STANCE },
  ],
};

/** 밀어냄 0~10틱: 두 손을 가슴 앞에 모은다 (몸을 조금 웅크린다) */
const TS_GATHER = E({ hx: -1, hy: -21, tl: -2, hd: -4, tw: -1, aBx: 5, aBy: -1, lFx: 9, lBx: -10 });
const TS_GATHER2 = E({ hx: -1.5, hy: -20.5, tl: -4, hd: -5, tw: -1.5, aBx: 3, aBy: 0, lFx: 9.5, lBx: -10.5 });
/** 10~14틱: 앞으로 밀친다 (앞발을 내딛고 손바닥을 끝까지 뻗는다) */
const TS_THRUST = E({ hx: 3, hy: -20, tl: 14, hd: -6, tw: -6, aBx: 18, aBy: -3, lFx: 14, lBx: -12 });
/** 14~34틱: 밀어붙인 채 버틴다 */
const TS_HOLD = E({ hx: 3.5, hy: -20, tl: 16, hd: -6, tw: -6, aBx: 18, aBy: -2.5, lFx: 14.5, lBx: -12.5 });
const TS_HOLD2 = E({ hx: 4, hy: -19.8, tl: 18, hd: -6, tw: -6.5, aBx: 18, aBy: -2, lFx: 15, lBx: -13 });
/** 34~40틱: 장막이 터지며 손이 튕겨 돌아온다 */
const TS_RECOIL = E({ hx: 1.5, hy: -21, tl: 6, hd: -5, tw: -3, aBx: 13, aBy: -7, lFx: 12, lBx: -11 });

/** 스킬 2 염동력 밀어냄 (128×96): 두 손을 가슴 앞에 모아(1~3) → 앞으로 밀침(4~5 판정, 장막 벽) → 밀어붙임(6~10) → 장막이 터짐(11~12) → 기본자세. 14프레임 48틱 */
export const EDWARD_TK_PUSH: MotionData = {
  name: 'edward/tk_push',
  label: '에드워드 스킬 2 염동력 밀어냄',
  wide: true,
  dur: TK_DUR,
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: TS_GATHER },
    { at: 2, pose: TS_GATHER2, stop: true },
    { at: 3, pose: TS_THRUST },
    { at: 4, pose: TS_THRUST },
    { at: 5, pose: TS_HOLD },
    { at: 7, pose: TS_HOLD2 },
    { at: 9, pose: TS_HOLD, stop: true },
    { at: 10, pose: TS_RECOIL },
    { at: 11, pose: TS_RECOIL, stop: true },
    { at: 13, pose: E_STANCE },
  ],
};

// ---- 차지 워 해머 올려치기 (2026-11-02 피드백 12-2: 모으는 자세와 떼는 궤적이 한 동작처럼 이어진다) ----
/*
 * 차지는 평타 판정이 끝난 자리에서 이어진다 (보통 1타: 해머가 앞 아래로 떨어진 자세). 그 해머를 바닥에 끌어 몸 뒤로 가져와
 * 무릎을 굽혀 모으고 (머리가 바닥을 긁는다), 떼면 그 자리(몸 뒤 바닥)에서 아래 → 앞 → 위로 큰 반원을 그리며 올려친다.
 * 몸이 따라 일어서 발끝까지 펴지고, 해머를 머리 위로 치켜든 채 앞쪽 바닥이 차례로 솟구치는 동안 멈춘다 (sim/chars/edward.ts).
 */
/** 올려치기 원호: 몸 뒤 바닥 → 발 아래 → 앞 → 위 (반시계 방향) */
export const CHARGE_ARC: HammerArc = { cx: 4, cy: -34, rx: 44, ry: 28, a0: 125, a1: -25 };
/** 끌어 오기: 앞 아래의 해머 머리를 바닥에 대고 몸 쪽으로 끈다 */
const H_DRAG1 = A({ hx: 3, hy: -17, tl: 26, hd: -4, tw: 2, lFx: 15, lBx: -14, wa: 96 }, [24, -6]);
/** 해머 머리가 발밑을 지나 몸 뒤로 끌려간다 (바닥을 긁는다) */
const H_DRAG2 = A({ hx: 0, hy: -15.5, tl: 22, hd: -6, tw: -1, lFx: 13, lBx: -14, wa: 135 }, [-14, -6]);
/** 모으는 자세: 무릎을 깊이 굽히고 해머를 몸 뒤 바닥에 끌어 놓는다 (두 손으로 자루를 쥐고 앞으로 숙인다) */
const H_HOLD_A = A({ hx: -1.5, hy: -14.5, tl: 24, hd: -8, tw: -3, lFx: 13, lBx: -14, wa: 168 }, [-40, -6]);
/** 모으는 동안 몸이 떨린다 (조금 더 웅크린다) */
const H_HOLD_B = A({ hx: -2, hy: -14, tl: 26, hd: -9, tw: -3.5, lFx: 13, lBx: -14.5, wa: 167 }, [-41, -6]);
/** 떼기 0틱: 무릎을 펴기 시작하며 해머 머리가 뒤 바닥에서 아래로 (머리는 뒤에 처진다) */
const H_SWING1 = A({ hx: 1, hy: -16, tl: 18, hd: -10, tw: 0, lFx: 14, lBx: -13, wa: 150 }, arcAt(CHARGE_ARC, 110));
/** 스미어: 발 아래를 지나 앞으로 (잔상) */
const H_SMEAR = A({ hx: 3, hy: -18, tl: 10, hd: -12, tw: 3, lFx: 15, lBx: -12, wa: 70 }, arcAt(CHARGE_ARC, 60));
/** 앞 위로 크게 올려친다: 몸이 따라 일어선다 */
const H_UP = A({ hx: 4, hy: -21.5, tl: -2, hd: -16, tw: 4.5, lFx: 14, lFy: -1, lBx: -10, lBy: -1, wa: -10 }, arcAt(CHARGE_ARC, -5));
/** 머리 위로 치켜든다: 발끝까지 펴진다 (앞쪽 바닥이 솟구치는 동안 이 자세) */
const H_TOP = A({ hx: 3, hy: -24.5, tl: -6, hd: -18, tw: 3, lFx: 11, lFy: -2.5, lBx: -8, lBy: -2.5, wa: -84 }, [14, -84]);
/** 여운: 치켜든 채 버틴다 (발뒤꿈치가 내려온다) */
const H_TOP2 = A({ hx: 2.5, hy: -23.5, tl: -5, hd: -16, tw: 3, lFx: 11, lFy: -1, lBx: -8, lBy: -1, wa: -88 }, [12, -84]);

/**
 * 차지 워 해머 올려치기 (128×96): 1~4프레임 1타 자세에서 해머를 바닥에 끌어 몸 뒤로 (한 번) → 5~8프레임 모으기 (누르는 동안 되풀이) →
 * 떼면 9~11 뒤 바닥에서 아래 → 앞 → 위로 큰 반원 (10번 스미어, 10~11 판정, 떼고 6틱 만에 머리 위) →
 * 12 머리 위로 치켜든 채 (앞쪽 바닥이 차례로 솟구친다, 떼고 6~20틱) → 13 여운 → 14 어깨로. 14프레임
 */
export const EDWARD_CHARGE: MotionData = {
  name: 'edward/charge',
  label: '에드워드 차지 워 해머 올려치기',
  wide: true,
  smear: { frame: 9, limb: 'aF', stretch: 1.3, ghosts: 3 },
  dur: [3, 3, 3, 3, 4, 4, 4, 4, 2, 1, 3, 14, 8, 6],
  keys: [
    { at: 0, pose: C1_OVER },
    { at: 1, pose: H_DRAG1 },
    { at: 2, pose: H_DRAG2 },
    { at: 3, pose: H_HOLD_A, stop: true },
    { at: 4, pose: H_HOLD_B },
    { at: 5, pose: H_HOLD_A },
    { at: 6, pose: H_HOLD_B },
    { at: 7, pose: H_HOLD_A, stop: true },
    { at: 8, pose: H_SWING1 },
    { at: 9, pose: H_SMEAR },
    { at: 10, pose: H_UP },
    { at: 11, pose: H_TOP, stop: true },
    { at: 12, pose: H_TOP2, stop: true },
    { at: 13, pose: { ...E_STANCE, wa: (E_STANCE.wa ?? 0) - 360 } },
  ],
};

// ---- 필살기 껍데기 뒤집어쓰기: 잡기 ----
/** 해머를 어깨에서 내려 발 옆 바닥에 세운다 (앞손은 손잡이를 쥔 채) */
const SG_PLANT = E({ hx: 0, hy: -21, tl: 4, hd: -4, aFx: 3, aFy: 13, aBx: -4, aBy: 8, lFx: 8, lBx: -9, wa: -268 });
/** 뒷손을 뒤로 당겨 모은다 */
const SG_WIND = E({ hx: -1, hy: -19, tl: 6, hd: -6, tw: 2, aFx: 3, aFy: 13, aBx: -8, aBy: -4, lFx: 10, lBx: -11, wa: -268 });
/** 잡는다: 앞으로 크게 내딛으며 빈 뒷손을 상대 얼굴 높이로 뻗는다 (뒷어깨가 앞으로) */
const SG_GRAB = E({ hx: 3, hy: -18, tl: 14, hd: -8, tw: -6, aFx: 2, aFy: 13, aBx: 17, aBy: -6, lFx: 15, lBx: -13, wa: -268 });
const SG_GRAB2 = E({ hx: 3.5, hy: -18, tl: 15, hd: -8, tw: -6, aFx: 2, aFy: 13, aBx: 17.5, aBy: -5, lFx: 15, lBx: -13, wa: -268 });
/** 헛잡음: 손이 허공을 움켜쥐고 몸이 앞으로 쏠린 채 굳는다 */
const SG_MISS = E({ hx: 4, hy: -17, tl: 20, hd: -4, tw: -5, aFx: 2, aFy: 13, aBx: 15, aBy: 0, lFx: 16, lBx: -13, wa: -266 });
const SG_BACK = E({ hx: 1, hy: -20, tl: 6, hd: -2, aFx: 5, aFy: 6, aBx: -3, aBy: 10, lFx: 9, lBx: -9, wa: -100 });

/** 필살기 껍데기 뒤집어쓰기 (128×96): 해머를 바닥에 세우고(2~3) → 뒷손을 모아(4) → 잡는다(5~7 판정, 사거리가 아주 짧다) → 헛잡으면 쏠린 채 굳었다 돌아온다. 14프레임 */
export const EDWARD_SUPER: MotionData = {
  name: 'edward/super',
  label: '에드워드 필살기 껍데기 뒤집어쓰기',
  wide: true,
  dur: [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 2, pose: SG_PLANT },
    { at: 4, pose: SG_WIND, stop: true },
    { at: 5, pose: SG_GRAB },
    { at: 6, pose: SG_GRAB2 },
    { at: 8, pose: SG_MISS, stop: true },
    { at: 11, pose: SG_BACK },
    { at: 13, pose: E_STANCE },
  ],
};

// ---- 필살기 연출 (맞았을 때): 발동자 동작 + 상대 반응 동작, 장면마다 표시 틱 합이 같다 ----
/*
 * 자리 (data/characters/edward.ts cinematic): 에드워드는 맞힌 자리 그대로(조금 물러섬), 상대는 12~16px 앞.
 * 에드워드의 뒷손이 상대 머리를 움켜쥔다: 뒷어깨를 앞으로 비틀고(tw −6) 몸을 뒤로 젖혀 팔을 앞위로 뻗는다.
 * 해머는 앞손에 쥔 채 머리를 발 옆 바닥에 세워 둔다.
 */
/** 움켜쥔 순간: 팔을 얼굴 높이로 뻗어 머리를 잡는다 */
const SC_HOLD = E({ hx: 1, hy: -20, tl: 6, hd: -10, tw: -6, aFx: 2, aFy: 13, aBx: 15, aBy: -9, lFx: 12, lBx: -11, wa: -268 });
/** 들어 올린다: 몸을 뒤로 젖히며 팔을 앞위로 (상대 발이 땅에서 뜬다) */
const SC_LIFT = E({ hx: -1, hy: -21.5, tl: -8, hd: -14, tw: -6, aFx: 1, aFy: 13, aBx: 9, aBy: -15.5, lFx: 11, lBx: -12, wa: -268 });
/** 들어 올린 채 버틴다 (몸이 한 번 흔들린다) */
const SC_LIFT2 = E({ hx: -1.5, hy: -21.8, tl: -9, hd: -15, tw: -6, aFx: 1, aFy: 13, aBx: 9, aBy: -16, lFx: 11, lBx: -12.5, wa: -267 });
/** 흡수: 가슴을 펴고 고개를 젖힌다 (푸른 장막·기억 조각은 렌더) */
const SC_DRAIN = E({ hx: -1.5, hy: -22, tl: -12, hd: -20, tw: -6, aFx: 0, aFy: 13, aBx: 8.5, aBy: -16, lFx: 11, lBx: -12.5, wa: -266 });
const SC_DRAIN2 = E({ hx: -1.5, hy: -22.3, tl: -13, hd: -22, tw: -6, aFx: 0, aFy: 13, aBx: 8.5, aBy: -16.3, lFx: 11, lBx: -12.5, wa: -266 });
/** 놓는다: 손을 펴 떨어뜨리며 몸을 바로 세운다 */
const SC_DROP = E({ hx: 0, hy: -21, tl: 2, hd: -4, tw: -3, aFx: 2, aFy: 13, aBx: 12, aBy: -4, lFx: 10, lBx: -11, wa: -267 });
/** 해머를 들어 어깨에 다시 걸친다 */
const SC_SHOULDER = E({ hx: 0, hy: -22, tl: -3, hd: -6, aFx: 6, aFy: 3, aBx: -3, aBy: 11, lFx: 7, lBx: -8, wa: -100 });

/** 연출 1 (발동자): 머리를 움켜쥐고 들어 올린다. 14프레임 36틱 */
export const EDWARD_SUPER_LIFT: MotionData = {
  name: 'edward/super_lift',
  label: '에드워드 필살기 연출 1 들어 올림',
  wide: true,
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: SC_HOLD },
    { at: 2, pose: SC_HOLD, stop: true },
    { at: 7, pose: SC_LIFT, stop: true },
    { at: 10, pose: SC_LIFT2 },
    { at: 13, pose: SC_LIFT },
  ],
};
/** 연출 2 (발동자): 화면이 어두워지고 상대의 기억이 푸른 장막을 타고 빨려 든다. 14프레임 60틱 */
export const EDWARD_SUPER_ABSORB: MotionData = {
  name: 'edward/super_absorb',
  label: '에드워드 필살기 연출 2 흡수',
  wide: true,
  dur: [4, 4, 4, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4],
  keys: [
    { at: 0, pose: SC_LIFT },
    { at: 4, pose: SC_DRAIN },
    { at: 7, pose: SC_DRAIN2 },
    { at: 10, pose: SC_DRAIN },
    { at: 13, pose: SC_DRAIN2 },
  ],
};
/** 연출 3 (발동자): 놓아 떨어뜨리고 해머를 어깨에 다시 걸친다. 14프레임 32틱 */
export const EDWARD_SUPER_RELEASE: MotionData = {
  name: 'edward/super_release',
  label: '에드워드 필살기 연출 3 놓음',
  wide: true,
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: SC_DRAIN },
    { at: 2, pose: SC_DROP, stop: true },
    { at: 7, pose: SC_SHOULDER },
    { at: 13, pose: E_STANCE },
  ],
};

// ---- 상대 반응 (누가 맞든 같은 반응: 그 사람 겉모습으로 그린다). 상대는 에드워드를 바라본다 ----
/** 반응 기본: 몸을 세운 사람 (해머가 있는 겉모습이면 손에서 늘어뜨린다) */
const V: Pose = { hx: 0, hy: -22, tl: 0, hd: 0, aFx: 6, aFy: 10, aBx: 3, aBy: 12, lFx: 6, lFy: 0, lBx: -6, lBy: 0, wa: 90 };
const Vp = (o: Partial<Pose>): Pose => ({ ...V, ...o });
/** 머리를 잡힌 순간: 고개가 뒤로 젖혀지고 두 손이 잡은 팔을 움켜쥐려 올라온다 */
const VL_GRABBED = Vp({ hx: -1, hy: -21.5, tl: -6, hd: -16, aFx: 7, aFy: -11, aBx: 5, aBy: -9, lFx: 5, lBx: -7 });
/** 들려 올라간다: 발끝이 땅에서 떨어져 늘어지고, 두 손은 팔을 움켜쥔다 */
const VL_LIFTED = Vp({ hx: 0, hy: -23, tl: -4, hd: -18, aFx: 6, aFy: -13, aBx: 4, aBy: -12, lFx: 3, lFy: 2, lBx: -3, lBy: 2 });
/** 버둥거린다 (다리를 차고 몸을 비튼다) */
const VL_KICK = Vp({ hx: 0, hy: -23, tl: 2, hd: -14, aFx: 7, aFy: -12, aBx: 3, aBy: -12, lFx: 7, lFy: -3, lBx: -4, lBy: 2 });
/** 기억이 빠져나간다: 손이 떨어져 늘어지고 고개가 뒤로 꺾인다 */
const VD_LIMP = Vp({ hx: 0, hy: -23, tl: -6, hd: -24, aFx: 2, aFy: 14, aBx: -1, aBy: 15, lFx: 2, lFy: 3, lBx: -2, lBy: 3 });
const VD_TWITCH = Vp({ hx: 0, hy: -23, tl: -9, hd: -26, aFx: 6, aFy: 11, aBx: -4, aBy: 13, lFx: 4, lFy: 2, lBx: -3, lBy: 3 });
/** 떨어져 무릎이 꺾인다 */
const VR_KNEE = Vp({ hx: -1, hy: -12, tl: 20, hd: 14, aFx: 4, aFy: 14, aBx: 2, aBy: 15, lFx: 6, lBx: -10, lBy: 0 });
/** 앞으로 무너진다 (바닥을 짚지 못하고) */
const VR_COLLAPSE = Vp({ hx: 0, hy: -9, tl: 46, hd: 20, aFx: 6, aFy: 13, aBx: 3, aBy: 14, lFx: 6, lBx: -11 });

/** 연출 1 (상대): 머리를 잡혀 들려 올라가며 버둥거린다. 64×64, 14프레임 36틱 */
export const EDWARD_SUPER_LIFTED: MotionData = {
  name: 'edward/super_lifted',
  label: '에드워드 필살기 반응 1 들림',
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: VL_GRABBED },
    { at: 3, pose: VL_GRABBED, stop: true },
    { at: 7, pose: VL_LIFTED },
    { at: 9, pose: VL_KICK },
    { at: 11, pose: VL_LIFTED },
    { at: 13, pose: VL_KICK },
  ],
};
/** 연출 2 (상대): 힘이 빠져 늘어지고 몸이 떨린다. 64×64, 14프레임 60틱 */
export const EDWARD_SUPER_DRAINED: MotionData = {
  name: 'edward/super_drained',
  label: '에드워드 필살기 반응 2 흡수당함',
  dur: [4, 4, 4, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4],
  keys: [
    { at: 0, pose: VL_KICK },
    { at: 3, pose: VD_LIMP },
    { at: 6, pose: VD_TWITCH },
    { at: 8, pose: VD_LIMP },
    { at: 11, pose: VD_TWITCH },
    { at: 13, pose: VD_LIMP },
  ],
};
/** 연출 3 (상대): 놓여 떨어지며 무릎이 꺾이고 앞으로 무너진다. 64×64, 14프레임 32틱 */
export const EDWARD_SUPER_DROPPED: MotionData = {
  name: 'edward/super_dropped',
  label: '에드워드 필살기 반응 3 쓰러짐',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: VD_LIMP },
    { at: 3, pose: VR_KNEE, stop: true },
    { at: 8, pose: VR_COLLAPSE },
    { at: 13, pose: VR_COLLAPSE },
  ],
};

export const EDWARD_SKILL_MOTIONS: readonly MotionData[] = [
  EDWARD_REENACT, EDWARD_TELEKINESIS, EDWARD_TK_PUSH, EDWARD_CHARGE, EDWARD_SUPER,
  EDWARD_SUPER_LIFT, EDWARD_SUPER_ABSORB, EDWARD_SUPER_RELEASE, EDWARD_SUPER_LIFTED, EDWARD_SUPER_DRAINED, EDWARD_SUPER_DROPPED,
];
