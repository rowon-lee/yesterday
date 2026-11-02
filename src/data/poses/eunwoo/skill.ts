import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { E, E_STANCE } from './stance';

/*
 * 백은우 기술 4개와 필살기 연출 (캐릭터 기획서): 모두 128×96 칸.
 * - 스킬 1 응답: 손가락을 튀기면 금색 실을 따라 짧게 순간이동 (sim: 3프레임 시작 틱에 고른 방향으로, 회복 중 다시 누르면 3번까지 이어 튐)
 * - 스킬 2 아직 여기 있어: 두 손을 가슴에 모았다가 펼쳐 흰 나비를 날려 보낸다 (회복·이동 빨라짐·백합 낙인)
 * - 차지 스텔라리스 발도: 접은 연검을 허리 칼집에 쥐고 모았다가, 떼면 펼쳐 뽑으며 크게 휘두르고 뒷손으로 은빛 와이어를 던져 끌어당긴다
 * - 필살기 선의: 두 손을 모았다가 뒷손을 펼쳐 내민다 (맞으면 연출: 걸어가 → 어깨에 손 → 상대가 물 위에 주저앉고 백합이 핀다)
 * 상대 반응 동작(super_daze·super_kneel·super_rest)은 필살기에 딸린 데이터라 누가 맞든 같은 반응을 하고, 그 사람 겉모습으로 그린다.
 */

const motion = (name: string, label: string, dur: number[], keys: MotionData['keys'], smear?: MotionData['smear']): MotionData => ({
  name: `eunwoo/${name}`,
  label: `백은우 ${label}`,
  wide: true,
  ...(smear ? { smear } : {}),
  dur,
  keys,
});
const K = (at: number, pose: Pose, stop = false) => ({ at, pose, stop });

// ---- 스킬 1 응답: 손가락을 튀겨 금색 실을 따라 순간이동 (3프레임 시작 틱 = 5틱째에 옮겨 간다) ----
const AN_PREP = E({ hx: 0, hy: -21, tl: 4, hd: -2, aFx: 10, aFy: 6, aBx: 8, aBy: -8, lFx: 8, lBx: -8 });
/** 손가락을 튀긴다 (멈칫): 뒷손을 앞위로 튕겨 실을 쏜다 */
const AN_SNAP = E({ hx: 0.5, hy: -21.5, tl: 8, hd: -4, aFx: 10, aFy: 6, aBx: 12, aBy: -11, lFx: 8, lBx: -8 });
/** 실을 따라 도착: 발을 모으고 몸을 접은 채 나타난다 */
const AN_ARRIVE = E({ hx: 0, hy: -22, tl: 10, hd: 4, aFx: 8, aFy: 8, aBx: 4, aBy: 4, lFx: 4, lFy: -2, lBx: -4, lBy: -2 });
/** 내려서며 팔을 가볍게 펼친다 (가운 자락이 펄럭) */
const AN_OPEN = E({ hx: 0, hy: -21, tl: 8, hd: 0, aFx: 12, aFy: 2, aBx: -8, aBy: 6, lFx: 7, lBx: -7 });

/** 스킬 1 응답: 준비 → 튀김(멈칫) → 3프레임에 도착(순간이동) → 펼침 → 기본자세. 12프레임 21틱 */
export const EUNWOO_ANSWER = motion('answer', '스킬 1 응답', [1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2], [
  K(0, E_STANCE), K(1, AN_PREP), K(2, AN_SNAP, true), K(3, AN_ARRIVE), K(5, AN_OPEN, true), K(8, AN_OPEN), K(11, E_STANCE),
]);
/** 순간이동하는 틱 (3프레임이 시작하는 틱) */
export const ANSWER_TELE_TICK = 5;

// ---- 스킬 2 아직 여기 있어: 두 손을 가슴에 모았다가 펼쳐 흰 나비를 날려 보낸다 ----
const SH_GATHER = E({ hx: 0, hy: -21.5, tl: 10, hd: 8, aFx: 4, aFy: 2, aBx: 6, aBy: 0, lFx: 7, lBx: -7 });
/** 가슴 앞에 두 손을 오므려 모은다 (멈칫) */
const SH_CUP = E({ hx: 0, hy: -21, tl: 12, hd: 14, aFx: 3, aFy: -1, aBx: 5, aBy: -2, lFx: 7, lBx: -7 });
/** 두 팔을 위로 펼쳐 날려 보내며 고개를 든다 (발끝으로 선다) */
const SH_OPEN = E({ hx: 0, hy: -23, tl: -4, hd: -12, aFx: 12, aFy: -10, aBx: -10, aBy: -10, lFx: 6, lFy: -1, lBx: -6, lBy: -1 });
const SH_HOLD = E({ hx: 0, hy: -22.5, tl: -2, hd: -8, aFx: 12, aFy: -6, aBx: -10, aBy: -6, lFx: 6, lBx: -6 });

/** 스킬 2 아직 여기 있어: 모음 → 오므림(멈칫) → 펼쳐 날려 보냄 → 기본자세. 12프레임 28틱 */
export const EUNWOO_STILL_HERE = motion('still_here', '스킬 2 아직 여기 있어', [1, 2, 2, 3, 3, 2, 2, 2, 3, 3, 3, 2], [
  K(0, E_STANCE), K(1, SH_GATHER), K(3, SH_CUP, true), K(5, SH_OPEN), K(7, SH_HOLD, true), K(9, SH_HOLD), K(11, E_STANCE),
]);

// ---- 차지 스텔라리스 발도 (windup 4, 되풀이 4~7, 떼면 8프레임부터, 판정 10~11프레임) ----
/** 접은 연검을 뒤허리 칼집으로 가져간다 */
const BT_FOLD = E({ hx: -0.5, hy: -19.5, tl: 14, hd: 4, tw: -3, aFx: -2, aFy: 12, aBx: -4, aBy: 12, lFx: 9, lBx: -9 });
/** 칼집에 쥐고 몸을 낮춰 모은다 (멈칫) */
const BT_SET = E({ hx: -1, hy: -17, tl: 22, hd: 6, tw: -4, aFx: -4, aFy: 13, aBx: -3, aBy: 12, lFx: 11, lBx: -10 });
/** 모으는 동안 (되풀이 두 자세): 숨을 고르며 몸이 아주 조금 오르내린다 */
const BT_HOLD_A = E({ hx: -1, hy: -16.5, tl: 24, hd: 6, tw: -4, aFx: -4, aFy: 13, aBx: -3, aBy: 12.5, lFx: 11, lBx: -10 });
const BT_HOLD_B = E({ hx: -1, hy: -17.2, tl: 22, hd: 4, tw: -4, aFx: -4, aFy: 12.6, aBx: -3, aBy: 12, lFx: 11, lBx: -10 });
/** 뗀 순간: 칼을 뽑아 펼치며 앞위로 휘둘러 나간다 (스미어) */
const BT_DRAW = E({ hx: 3, hy: -16, tl: 24, hd: -6, tw: 4, aFx: 14, aFy: -10, aBx: -9, aBy: 8, lFx: 18, lBx: -14 });
/** 타격: 펼친 연검을 크게 휘두른다 (칼 쥔 팔 끝까지, 깊이 내디딤) */
const BT_HIT = E({ hx: 6, hy: -15, tl: 30, hd: -6, tw: 6, aFx: 17.8, aFy: -2.4, aBx: -12, aBy: 4, lFx: 22, lBx: -16 });
const BT_HIT2 = E({ hx: 6.5, hy: -15, tl: 32, hd: -6, tw: 6, aFx: 16, aFy: 7.6, aBx: -12, aBy: 4, lFx: 22, lBx: -16 });
/** 뒷손으로 은빛 와이어를 던진다 */
const BT_WIRE = E({ hx: 5, hy: -16, tl: 24, hd: -4, tw: -4, aFx: 6, aFy: 12, aBx: 16, aBy: -6, lFx: 22, lBx: -15 });
/** 감아 챈 와이어를 끌어당긴다 (몸을 뒤로 젖힌다) */
const BT_PULL = E({ hx: 1, hy: -19, tl: 4, hd: 2, tw: -2, aFx: 10, aFy: 6, aBx: -6, aBy: 4, lFx: 16, lBx: -12 });

/** 차지 스텔라리스 발도: 14프레임 36틱 (모으기 되풀이 한 바퀴 12틱) */
export const EUNWOO_BATTO = motion('batto', '차지 스텔라리스 발도', [2, 2, 2, 3, 3, 3, 3, 3, 1, 2, 2, 3, 4, 3], [
  K(0, E_STANCE), K(1, BT_FOLD), K(3, BT_SET, true), K(4, BT_HOLD_A), K(6, BT_HOLD_B), K(7, BT_HOLD_A, true),
  K(8, BT_DRAW), K(9, BT_HIT), K(10, BT_HIT2), K(11, BT_WIRE), K(12, BT_PULL, true), K(13, E_STANCE),
], { frame: 8, limb: 'aF', stretch: 1.5 });

// ---- 필살기 선의: 두 손을 가슴에 모았다가 뒷손을 펼쳐 내민다 (판정 7~9프레임: 손이 닿으면 연출) ----
const GW_PRAY = E({ hx: 0, hy: -21.5, tl: 8, hd: 10, aFx: 4, aFy: 0, aBx: 6, aBy: -1, lFx: 7, lBx: -7 });
const GW_GLOW = E({ hx: 0, hy: -22, tl: 4, hd: 12, aFx: 3, aFy: -2, aBx: 5, aBy: -3, lFx: 7, lBx: -7 });
const GW_STEP = E({ hx: 2, hy: -20, tl: 12, hd: 0, tw: -3, aFx: 8, aFy: 8, aBx: 12, aBy: -6, lFx: 14, lBx: -10 });
const GW_REACH = E({ hx: 4, hy: -19, tl: 18, hd: -2, tw: -4, aFx: 6, aFy: 10, aBx: 15, aBy: -8, lFx: 18, lBx: -12 });
/** 뒷손을 펼쳐 앞으로 끝까지 내민다 (손바닥) */
const GW_TOUCH = E({ hx: 5, hy: -18.5, tl: 20, hd: -2, tw: -5, aFx: 6, aFy: 10, aBx: 17, aBy: -5.6, lFx: 18, lBx: -12 });

/** 필살기 선의: 모음 → 빛남(멈칫) → 디디며 뒷손을 펼쳐 내밂(판정 7~9) → 거둠. 13프레임 33틱 */
export const EUNWOO_GOODWILL = motion('goodwill', '필살기 선의', [2, 2, 3, 3, 2, 1, 2, 2, 2, 4, 4, 3, 3], [
  K(0, E_STANCE), K(1, GW_PRAY), K(3, GW_GLOW, true), K(4, GW_STEP), K(5, GW_REACH), K(6, GW_TOUCH), K(8, GW_TOUCH),
  K(9, GW_TOUCH, true), K(11, GW_PRAY), K(12, E_STANCE),
], { frame: 5, limb: 'aB', stretch: 1.3 });

// ---- 필살기 연출 장면 (각 14프레임 × 3틱 = 42틱): 발동자 동작 + 상대 반응 동작 ----
/** 장면 1 (은우): 물 위를 천천히 걸어간다 */
const walk = (i: number): Pose => {
  const s = Math.sin((i / 14) * Math.PI * 4);
  const c = Math.cos((i / 14) * Math.PI * 4);
  return E({ hx: 0, hy: -22 + 0.5 * Math.abs(c), tl: 4, hd: 4, aFx: 7 - 3 * s, aFy: 12, aBx: -3 + 3 * s, aBy: 13, lFx: 4 + 6 * s, lFy: s < 0 ? -2 * s : 0, lBx: -4 - 6 * s, lBy: s > 0 ? 2 * s : 0 });
};
export const EUNWOO_SUPER_WALK = motion('super_walk', '선의 연출 1 걸어감', Array(14).fill(3), Array.from({ length: 14 }, (_, i) => K(i, walk(i))));

/** 장면 1 (상대): 멍하니 선 채 고개가 이리저리 기운다 (팔이 늘어진다) */
const daze = (i: number): Pose => {
  const s = Math.sin((i / 14) * Math.PI * 2);
  return { hx: -1 + s, hy: -22, tl: -4 + 3 * s, hd: 10 + 8 * s, aFx: 3, aFy: 15, aBx: -2, aBy: 15, lFx: 6, lFy: 0, lBx: -6, lBy: 0 };
};
export const EUNWOO_SUPER_DAZE = motion('super_daze', '선의 반응 1 멍하니', Array(14).fill(3), Array.from({ length: 14 }, (_, i) => K(i, daze(i))));

/** 장면 2 (은우): 다가가 상대 어깨에 뒷손을 얹는다 */
const TOUCH_A = E({ hx: 1, hy: -21.5, tl: 6, hd: 4, aFx: 6, aFy: 12, aBx: 6, aBy: 4, lFx: 8, lBx: -6 });
const TOUCH_B = E({ hx: 2, hy: -21.5, tl: 10, hd: 8, tw: -3, aFx: 6, aFy: 12, aBx: 15, aBy: -5, lFx: 9, lBx: -6 });
const TOUCH_C = E({ hx: 2, hy: -21, tl: 14, hd: 14, tw: -3, aFx: 6, aFy: 12, aBx: 15, aBy: -2, lFx: 9, lBx: -6 });
export const EUNWOO_SUPER_TOUCH = motion('super_touch', '선의 연출 2 어깨에 손', Array(14).fill(3), [
  K(0, walk(0)), K(3, TOUCH_A), K(6, TOUCH_B, true), K(10, TOUCH_C), K(13, TOUCH_C),
]);

/** 장면 2 (상대): 어깨에 손이 닿자 힘이 빠져 무릎을 꿇고, 물 위에 주저앉는다 */
const KN_SLUMP = { hx: -1, hy: -21, tl: 14, hd: 20, aFx: 3, aFy: 15, aBx: -1, aBy: 15, lFx: 6, lFy: 0, lBx: -6, lBy: 0 };
const KN_KNEEL = { hx: -2, hy: -12, tl: 12, hd: 24, aFx: 5, aFy: 12, aBx: 1, aBy: 12, lFx: 8, lFy: 0, lBx: -10, lBy: 0 };
const KN_SIT = { hx: -3, hy: -6, tl: 4, hd: 28, aFx: 7, aFy: 8, aBx: 3, aBy: 9, lFx: 12, lFy: 0, lBx: 4, lBy: 0 };
export const EUNWOO_SUPER_KNEEL = motion('super_kneel', '선의 반응 2 주저앉음', Array(14).fill(3), [
  K(0, daze(0)), K(4, KN_SLUMP), K(8, KN_KNEEL, true), K(12, KN_SIT, true), K(13, KN_SIT),
]);

/** 장면 3 (은우): 한 걸음 물러나 두 손을 모으고 고개를 숙인다 (백합이 핀다) */
const BLOOM_A = E({ hx: 0, hy: -22, tl: 4, hd: 10, aFx: 7, aFy: 10, aBx: 6, aBy: 11, lFx: 5, lBx: -5 });
const BLOOM_B = E({ hx: 0, hy: -22.5, tl: 10, hd: 16, aFx: 6, aFy: 8, aBx: 5, aBy: 9, lFx: 5, lBx: -5 });
export const EUNWOO_SUPER_BLOOM = motion('super_bloom', '선의 연출 3 백합', Array(14).fill(3), [
  K(0, TOUCH_C), K(4, BLOOM_A), K(8, BLOOM_B, true), K(13, BLOOM_B),
]);

/** 장면 3 (상대): 물 위에 앉은 채 고개를 떨구고, 몸이 무거워 천천히 기운다 */
const REST_A = { ...KN_SIT, hd: 32 };
const REST_B = { ...KN_SIT, hx: -3.5, hy: -5.5, tl: -4, hd: 36, aFx: 8, aFy: 7, aBx: 4, aBy: 8 };
export const EUNWOO_SUPER_REST = motion('super_rest', '선의 반응 3 무거워짐', Array(14).fill(3), [
  K(0, KN_SIT), K(5, REST_A, true), K(13, REST_B),
]);

export const EUNWOO_SKILL_MOTIONS: readonly MotionData[] = [
  EUNWOO_ANSWER, EUNWOO_STILL_HERE, EUNWOO_BATTO, EUNWOO_GOODWILL,
  EUNWOO_SUPER_WALK, EUNWOO_SUPER_DAZE, EUNWOO_SUPER_TOUCH, EUNWOO_SUPER_KNEEL, EUNWOO_SUPER_BLOOM, EUNWOO_SUPER_REST,
];
