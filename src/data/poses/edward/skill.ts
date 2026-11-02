import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { aim, E, E_STANCE, grip2 } from './stance';

/*
 * 에드워드 스킬 1·스킬 2·차지·필살기 (캐릭터 기획서 표). 모두 128×96 칸 (필살기 상대 반응만 64×64).
 * - 스킬 1 재현:나: 해머를 바닥에 쿵 세우고 가슴을 펴면 푸른 장막이 몸을 덮는다 (판정 없음, 다음 평타 강화)
 * - 스킬 2 불완전한 염동력: 해머는 앞손에 늘어뜨리고, 빈 뒷손을 상대 쪽으로 뻗어 움켜쥔다 (푸른 궤적, 끌어당김/밀어냄은 sim)
 * - 차지 워 해머 내려치기: 해머를 뒤로 끌어 바닥에 대고 모았다가(모으는 동안 되풀이) 머리 위로 크게 넘겨 땅을 내리친다
 * - 필살기 껍데기 뒤집어쓰기: 해머를 바닥에 세우고 빈 뒷손으로 상대 머리를 움켜쥔다 (잡기). 맞으면 연출 세 장면
 */

const A = (o: Partial<Pose>, x: number, y: number): Pose => aim(E(o), x, y);
const G = (o: Partial<Pose>): Pose => grip2(E(o));

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

// ---- 스킬 2 불완전한 염동력 ----
/** 해머를 앞손에 늘어뜨리고 (머리가 발 옆 바닥), 뒷손을 가슴으로 당겨 모은다 */
const T_GATHER = E({ hx: -1, hy: -20, tl: 4, hd: -2, tw: -1, aFx: 2, aFy: 13, aBx: 4, aBy: -2, lFx: 9, lBx: -10, wa: -272 });
/** 뒷손을 상대 쪽으로 쭉 뻗는다 (뒷어깨가 앞으로, 손바닥을 편다) */
const T_REACH = E({ hx: 2, hy: -19, tl: 14, hd: -6, tw: -5, aFx: 1, aFy: 13, aBx: 17.8, aBy: -3, lFx: 13, lBx: -12, wa: -272 });
const T_REACH2 = E({ hx: 2.5, hy: -19, tl: 15, hd: -6, tw: -5.5, aFx: 1, aFy: 13, aBx: 18, aBy: -2.5, lFx: 13, lBx: -12.5, wa: -272 });
/** 움켜쥔다: 뻗은 손이 떨리며 조금 당겨진다 (끌어당김·밀어냄은 렌더의 푸른 궤적이 보여 준다) */
const T_CLENCH = E({ hx: 1.5, hy: -19.5, tl: 10, hd: -6, tw: -4, aFx: 1, aFy: 13, aBx: 15.5, aBy: -4, lFx: 13, lBx: -12, wa: -272 });
/** 거둔다 */
const T_BACK = E({ hx: 0.5, hy: -21, tl: 2, hd: -3, aFx: 6, aFy: 4, aBx: -2, aBy: 10, lFx: 9, lBx: -9, wa: -120 });

/** 스킬 2 불완전한 염동력 (128×96): 뒷손을 모으고(2~3) → 상대 쪽으로 뻗어(4~6 판정) → 움켜쥐고(7~8) → 해머를 어깨로(9~13). 13프레임 */
export const EDWARD_TELEKINESIS: MotionData = {
  name: 'edward/telekinesis',
  label: '에드워드 스킬 2 불완전한 염동력',
  wide: true,
  dur: [2, 2, 2, 2, 2, 2, 3, 3, 3, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 2, pose: T_GATHER, stop: true },
    { at: 3, pose: T_REACH },
    { at: 5, pose: T_REACH2 },
    { at: 7, pose: T_CLENCH, stop: true },
    { at: 9, pose: T_CLENCH },
    { at: 11, pose: T_BACK },
    { at: 12, pose: E_STANCE },
  ],
};

// ---- 차지 워 해머 내려치기 ----
/** 해머를 어깨에서 내려 뒤로 끌어 머리를 바닥에 댄다 (몸을 낮추고 뒤로 실음) */
const H_DRAG = G({ hx: -3, hy: -16, tl: 14, hd: -6, tw: -3, aFx: -7, aFy: 12, lFx: 11, lBx: -13, wa: -184 });
/** 모으는 자세: 깊게 웅크려 해머를 뒤 바닥에 끌어 둔 채 힘을 모은다 (되풀이: 몸이 떨린다) */
const H_HOLD_A = G({ hx: -4, hy: -14, tl: 20, hd: -8, tw: -4, aFx: -9, aFy: 12, lFx: 12, lBx: -14, wa: -180 });
const H_HOLD_B = G({ hx: -4.5, hy: -13.5, tl: 21, hd: -9, tw: -4.5, aFx: -9.5, aFy: 12, lFx: 12, lBx: -14, wa: -179 });
/** 뗀다: 해머를 머리 위로 크게 넘긴다 (몸을 일으키며 앞발을 내딛는다) */
const H_LIFT = G({ hx: 0, hy: -21, tl: -8, hd: -10, tw: 2, aFx: 3, aFy: -12, lFx: 15, lBx: -14, wa: -95 });
/** 스미어 */
const H_SMEAR = A({ hx: 4, hy: -16, tl: 20, hd: -6, tw: 3, lFx: 18, lBx: -16, wa: -30 }, 44, -58);
/** 땅을 내리친다: 해머 머리가 발 앞 바닥에 박힌다 (깊게 숙인다) */
const H_SLAM = A({ hx: 6, hy: -13, tl: 38, hd: 4, tw: 4.5, lFx: 19, lBx: -17, wa: 60 }, 50, -3.5);
/** 박힌 채 버틴다 (충격파가 달리는 동안) */
const H_HOLD = A({ hx: 6, hy: -13, tl: 38, hd: 6, tw: 4.5, lFx: 19, lBx: -17, wa: 63 }, 49.5, -3.5);
/** 뽑아 어깨로 */
const H_BACK = G({ hx: 2, hy: -19, tl: 10, hd: -2, tw: 1, aFx: 7, aFy: -6, lFx: 12, lBx: -11, wa: -95 });
const H_END: Pose = E_STANCE;

/**
 * 차지 워 해머 내려치기 (128×96): 1~4프레임 해머를 뒤로 끌어 바닥에 댐(한 번) → 5~8프레임 모으기(누르는 동안 되풀이) →
 * 떼면 9프레임 머리 위로 넘김 → 10 스미어 → 11~12 땅을 내리침(판정, 충격파 출발, 박힌 채 버팀) → 13~14 뽑아 어깨로. 14프레임
 */
export const EDWARD_CHARGE: MotionData = {
  name: 'edward/charge',
  label: '에드워드 차지 워 해머 내려치기',
  wide: true,
  smear: { frame: 9, limb: 'aF', stretch: 1.4 },
  dur: [3, 3, 3, 3, 4, 4, 4, 4, 3, 1, 2, 12, 6, 4],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 2, pose: H_DRAG },
    { at: 3, pose: H_HOLD_A },
    { at: 4, pose: H_HOLD_A, stop: true },
    { at: 5, pose: H_HOLD_B },
    { at: 6, pose: H_HOLD_A },
    { at: 7, pose: H_HOLD_B, stop: true },
    { at: 8, pose: H_LIFT },
    { at: 9, pose: H_SMEAR },
    { at: 10, pose: H_SLAM },
    { at: 11, pose: H_HOLD, stop: true },
    { at: 12, pose: H_BACK },
    { at: 13, pose: H_END },
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
  EDWARD_REENACT, EDWARD_TELEKINESIS, EDWARD_CHARGE, EDWARD_SUPER,
  EDWARD_SUPER_LIFT, EDWARD_SUPER_ABSORB, EDWARD_SUPER_RELEASE, EDWARD_SUPER_LIFTED, EDWARD_SUPER_DRAINED, EDWARD_SUPER_DROPPED,
];
