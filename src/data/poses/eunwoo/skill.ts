import type { FollowSpec } from '../../../anim/follow';
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

const motion = (name: string, label: string, dur: number[], keys: MotionData['keys'], smear?: MotionData['smear'], follow: FollowSpec = { ribbon: {} }): MotionData => ({
  name: `eunwoo/${name}`,
  label: `백은우 ${label}`,
  wide: true,
  ...(smear ? { smear } : {}),
  dur,
  keys,
  follow,
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
], { frame: 8, limb: 'aF', stretch: 1.5 }, {
  // 접어 칼집에 넣은 동안(2~8프레임)은 연검이 보이지 않고, 뽑으며 펼쳐 크게 휘두른다
  ribbon: {
    hidden: [2, 3, 4, 5, 6, 7], damp: 0.93, gravity: 0.6,
    keys: [{ at: 0, stiff: 0.6, curl: 1 }, { at: 8, stiff: 0.4, curl: 1.2 }, { at: 9, stiff: 3.2, curl: 0.15 }, { at: 10, stiff: 2.6, curl: 0.25 }, { at: 11, stiff: 0.9, curl: 0.8 }, { at: 13, stiff: 0.6, curl: 1 }],
  },
  wind: 0.3,
});

// ---- 필살기 선의 (11-5 2026-11-02, 영역 전개형 약 330틱. 컷인은 공용 컷인이 그린다) ----
// 0~30 발동: 연검을 바닥까지 늘어뜨려 내리고 뒷손을 가볍게 편다. 발밑에서 퍼지는 첫 물결이 닿으면(판정) 연출이 시작된다.
// 연출 (장면마다 은우 동작 + 상대 반응 동작, 시간은 전체 330틱 기준):
//  30~90  전개: 은우 발밑에서 물결 고리가 퍼지며 도시를 겹마다 지운다 (앞겹 → 거리 → 건물 → 하늘) → 잔잔한 물과 새벽 하늘. 비가 멎고 빗방울이 빛 먼지가 된다
//  90~130 세계 완성: 끝없는 물, 옅은 안개, 수평선 빛, 백합 봉오리가 떠오르고 두 사람이 물에 비친다
// 130~200 은우가 천천히 걸어간다 (걸음마다 물결), 상대는 멈춰 있다
// 200~240 어깨에 손: 20틱 멈춤, 손끝에서 금실이 나온다
// 240~290 상대가 물 위에 천천히 주저앉고, 백합이 안에서 밖으로 동심원을 그리며 피고, 금빛 치유의 빛이 은우를 채운다
// 290~330 세계가 흰 나비로 부서지며 도시가 돌아온다 (둔해짐이 남은 동안 상대 발밑에 작은 물결과 꽃잎)
// 같은 경기 두 번째부터는 짧은 판: 30~90 전개를 30틱으로 줄인다 (약 300틱)
/** 내린 칼: 연검 쥔 손을 엉덩이 옆에 늘어뜨리고, 뒷손을 가볍게 편다 */
const GW_LOWER = E({ hx: -1, hy: -23, tl: 2, hd: 10, aFx: 5, aFy: 15, aBx: -2, aBy: 13, lFx: 6, lBx: -5, wa: 90 });
const GW_OPEN = E({ hx: -0.5, hy: -23.4, tl: 0, hd: 4, aFx: 5, aFy: 15, aBx: 7, aBy: 7, lFx: 6, lBx: -5, wa: 90 });

/** 필살기 선의 발동: 칼을 내림(1~4) → 뒷손을 편다(5~7) → 판정(8~10: 발밑 물결) → 거둠. 13프레임 33틱 */
export const EUNWOO_GOODWILL = motion('goodwill', '필살기 선의', [2, 2, 3, 3, 2, 3, 3, 2, 3, 3, 3, 2, 2], [
  K(0, E_STANCE), K(2, GW_LOWER), K(4, GW_LOWER, true), K(6, GW_OPEN), K(8, GW_OPEN, true), K(11, GW_LOWER), K(12, E_STANCE),
], undefined, { ribbon: { stiff: 0.4, gravity: 1.3 }, breeze: 0.5 });

/** 장면 길이 맞추기: n프레임에 total틱을 고르게 */
const spread = (n: number, total: number): number[] => Array.from({ length: n }, (_, i) => Math.floor(((i + 1) * total) / n) - Math.floor((i * total) / n));
// 2차 리워크 (재수정 지침 3장 백은우 '멈추지 않는 흐름, 정지가 거의 없다'): 장면 길이(공격 데이터 scenes)는 그대로.
// 두 자세를 12프레임으로 늘이던 장면을 프레임마다 다른 자세로 (숨·걸음·손 얹기의 박자). 머리·가운·연검은 follow가 늦게 따라온다
const SCENE_FOLLOW: FollowSpec = { ribbon: { stiff: 0.4, gravity: 1.3 }, breeze: 0.9 };

/** 가만히 선 장면 (숨만 쉰다): 은우 */
const still = (name: string, label: string, n: number, total: number, from: Pose, to: Pose) =>
  motion(name, label, spread(n, total), [K(0, from), K(n - 1, to)], undefined, { ribbon: { stiff: 0.4, gravity: 1.3 }, breeze: 0.6 });

/** 장면 1 전개 (60틱, 짧은 판 30틱): 칼을 내린 채 눈을 감고 숨을 천천히 깊이 들이쉬었다가(16틱), 짧게 내쉬며 고개를 숙이고(8틱) 자리 잡는다 (발밑에서 물결이 퍼진다) */
const DEPLOY_IN = E({ ...GW_LOWER, hy: -24, tl: -2, hd: 5, aFx: 5.5, aFy: 14, aBx: -3.5, aBy: 11 });
const DEPLOY_OUT = E({ ...GW_LOWER, hy: -22.8, tl: 3, hd: 12.5, aBx: -1.3, aBy: 13.6 });
const DEPLOY_END = E({ ...GW_LOWER, hd: 14, aBx: -1, aBy: 14 });
export const EUNWOO_SUPER_DEPLOY = motion('super_deploy', '선의 연출 1 전개', [16, 8, 10, 26], [
  K(0, GW_LOWER), K(1, DEPLOY_IN), K(2, DEPLOY_OUT), K(3, DEPLOY_END),
], undefined, SCENE_FOLLOW);
export const EUNWOO_SUPER_DEPLOY_SHORT = motion('super_deploy_s', '선의 연출 1 전개 (짧은 판)', [8, 4, 5, 13], [
  K(0, GW_LOWER), K(1, DEPLOY_IN), K(2, DEPLOY_OUT), K(3, DEPLOY_END),
], undefined, SCENE_FOLLOW);
/** 장면 2 세계 완성 (40틱): 고개를 들어 상대를 바라본다 */
const LOOK = E({ ...GW_LOWER, hd: 2, tl: 0 });
export const EUNWOO_SUPER_WORLD = still('super_world', '선의 연출 2 세계', 13, 40, DEPLOY_END, LOOK);

/** 장면 3 (70틱): 물 위를 천천히 걸어간다 (네 걸음) */
const walk = (i: number): Pose => {
  const ph = (i / 14) * Math.PI * 4;
  const s2 = Math.sin(ph);
  return E({ hx: -1 + 0.5 * Math.abs(Math.cos(ph)), hy: -23 + 0.4 * Math.abs(Math.cos(ph)), tl: 3, hd: 4, aFx: 5 - 1.5 * s2, aFy: 15, aBx: -2 + 2 * s2, aBy: 13, lFx: 3 + 6 * s2, lFy: s2 < 0 ? 2.5 * s2 : 0, lBx: -3 - 6 * s2, lBy: s2 > 0 ? -2.5 * s2 : 0, wa: 90 });
};
export const EUNWOO_SUPER_WALK = motion('super_walk', '선의 연출 3 걸어감', Array(14).fill(5), Array.from({ length: 14 }, (_, i) => K(i, walk(i))), undefined, { ribbon: { stiff: 0.4, gravity: 1.3 }, wind: 0.15 });

/** 장면 4 (40틱): 다가가 상대 어깨에 뒷손을 얹고 멈춘다 (20틱 정적) */
const TOUCH_A = E({ hx: 0, hy: -23, tl: 6, hd: 4, aFx: 5, aFy: 15, aBx: 8, aBy: 2, lFx: 7, lBx: -5, wa: 90 });
const TOUCH_B = E({ hx: 1, hy: -22.8, tl: 10, hd: 10, tw: -3, aFx: 5, aFy: 15, aBx: 15, aBy: -5, lFx: 8, lBx: -5, wa: 90 });
export const EUNWOO_SUPER_TOUCH = motion('super_touch', '선의 연출 4 어깨에 손', [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4], [
  K(0, walk(0)), K(3, TOUCH_A), K(5, TOUCH_B, true), K(12, TOUCH_B),
], undefined, { ribbon: { stiff: 0.4, gravity: 1.3 } });

/** 장면 5 (50틱): 손을 얹은 채 상대를 따라 조금 숙이고, 금빛 치유의 빛이 차오른다 */
const HEAL_A = E({ hx: 1, hy: -22.5, tl: 14, hd: 14, tw: -3, aFx: 5, aFy: 15, aBx: 15, aBy: 0, lFx: 8, lBx: -5, wa: 90 });
const HEAL_B = E({ hx: 1, hy: -22, tl: 18, hd: 18, tw: -2, aFx: 5, aFy: 15, aBx: 14, aBy: 6, lFx: 8, lBx: -5, wa: 90 });
export const EUNWOO_SUPER_HEAL = motion('super_heal', '선의 연출 5 백합', [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5], [
  K(0, TOUCH_B), K(5, HEAL_A), K(11, HEAL_B),
], undefined, { ribbon: { stiff: 0.4, gravity: 1.3 } });

/** 장면 6 (40틱): 한 걸음 물러나 손을 거두고 칼을 쥔 채 선다 (세계가 나비로 부서진다) */
const RELEASE = E({ hx: -1.5, hy: -23, tl: 2, hd: 8, aFx: 6, aFy: 14, aBx: -4, aBy: 14, lFx: 6, lBx: -6, wa: 90 });
export const EUNWOO_SUPER_RELEASE = motion('super_release', '선의 연출 6 돌아옴', [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4], [
  K(0, HEAL_B), K(4, RELEASE, true), K(12, E_STANCE),
], undefined, { ribbon: { stiff: 0.5, gravity: 1.1 } });

/** 상대 반응: 시간이 멈춘 듯 선 채로 굳는다 (맞은 순간의 꼿꼿한 자세, 고개만 아주 조금) */
const FROZEN = { hx: -1, hy: -22, tl: -2, hd: 6, aFx: 3, aFy: 15, aBx: -2, aBy: 15, lFx: 6, lFy: 0, lBx: -6, lBy: 0 };
export const EUNWOO_SUPER_DAZE = motion('super_daze', '선의 반응 1 멈춤', Array(12).fill(5), [K(0, FROZEN), K(11, { ...FROZEN, hd: 9 })], undefined, {});

/** 상대 반응 (장면 5): 어깨에 손이 얹힌 채 힘이 빠져 무릎을 꿇고, 물 위에 천천히 주저앉는다 */
const KN_SLUMP = { hx: -1, hy: -21, tl: 14, hd: 20, aFx: 3, aFy: 15, aBx: -1, aBy: 15, lFx: 6, lFy: 0, lBx: -6, lBy: 0 };
const KN_KNEEL = { hx: -2, hy: -12, tl: 12, hd: 24, aFx: 5, aFy: 12, aBx: 1, aBy: 12, lFx: 8, lFy: 0, lBx: -10, lBy: 0 };
const KN_SIT = { hx: -3, hy: -6, tl: 4, hd: 28, aFx: 7, aFy: 8, aBx: 3, aBy: 9, lFx: 12, lFy: 0, lBx: 4, lBy: 0 };
export const EUNWOO_SUPER_KNEEL = motion('super_kneel', '선의 반응 2 주저앉음', [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5], [
  K(0, { ...FROZEN, hd: 9 }), K(3, KN_SLUMP), K(7, KN_KNEEL, true), K(10, KN_SIT, true), K(11, KN_SIT),
], undefined, {});

/** 상대 반응 (장면 6): 물 위에 앉은 채 고개를 떨군다 */
const REST_B = { ...KN_SIT, hx: -3.5, hy: -5.5, tl: -4, hd: 36, aFx: 8, aFy: 7, aBx: 4, aBy: 8 };
export const EUNWOO_SUPER_REST = motion('super_rest', '선의 반응 3 쉼', [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4], [
  K(0, KN_SIT), K(5, { ...KN_SIT, hd: 32 }, true), K(12, REST_B),
], undefined, {});

export const EUNWOO_SKILL_MOTIONS: readonly MotionData[] = [
  EUNWOO_ANSWER, EUNWOO_STILL_HERE, EUNWOO_BATTO, EUNWOO_GOODWILL,
  EUNWOO_SUPER_DEPLOY, EUNWOO_SUPER_DEPLOY_SHORT, EUNWOO_SUPER_WORLD, EUNWOO_SUPER_WALK, EUNWOO_SUPER_TOUCH, EUNWOO_SUPER_HEAL, EUNWOO_SUPER_RELEASE,
  EUNWOO_SUPER_DAZE, EUNWOO_SUPER_KNEEL, EUNWOO_SUPER_REST,
];
