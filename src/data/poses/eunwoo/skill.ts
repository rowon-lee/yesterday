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

/** 뒷손이 얼굴 옆으로 올라와 손가락을 건다 */
const AN_COCK = E({ hx: 0.2, hy: -21.3, tl: 6, hd: -3, aFx: 10, aFy: 6, aBx: 9, aBy: -10, lFx: 8, lBx: -8 });
/** 접었던 몸이 풀린다 (떠 있는 채) */
const AN_UNFOLD = E({ hx: 0, hy: -21.8, tl: 9, hd: 3, aFx: 9.5, aFy: 6, aBx: 1, aBy: 5, lFx: 5, lFy: -1.5, lBx: -5, lBy: -1.5 });
const AN_SPREAD = E({ hx: 0, hy: -21.5, tl: 8.5, hd: 1.5, aFx: 11, aFy: 3.5, aBx: -4, aBy: 5.5, lFx: 6, lFy: -0.8, lBx: -6, lBy: -0.8 });
/** 떠 있는 동안 (가운 자락이 내려앉는다): 팔이 깃털처럼 천천히 내려온다 */
const AN_FLOAT_A = E({ hx: 0, hy: -21.3, tl: 7, hd: -1, aFx: 12.5, aFy: 1, aBx: -9, aBy: 5, lFx: 7, lBx: -7 });
const AN_FLOAT_B = E({ hx: 0, hy: -21.6, tl: 6, hd: -1.5, aFx: 12, aFy: 2.5, aBx: -8.5, aBy: 7, lFx: 7, lBx: -7 });
const AN_FLOAT_C = E({ hx: -0.1, hy: -21.4, tl: 6.5, hd: -0.5, aFx: 11.5, aFy: 4, aBx: -8, aBy: 8, lFx: 7, lBx: -7 });
const AN_DESC_A = E({ hx: -0.3, hy: -21.2, tl: 6, hd: 1, aFx: 10.5, aFy: 6, aBx: -7, aBy: 9, lFx: 7, lBx: -6.5 });
const AN_DESC_B = E({ hx: -0.6, hy: -20.6, tl: 6.5, hd: 3, aFx: 9, aFy: 9, aBx: -6.5, aBy: 11, lFx: 7, lBx: -6 });
/** 사뿐히 무게를 싣는다 */
const AN_SOFT = E({ hx: -1, hy: -20.2, tl: 6, hd: 4.5, aFx: 8, aFy: 11, aBx: -6, aBy: 12.5, lFx: 6.8, lBx: -5.5 });
const AN_RISE = E({ hx: -1.3, hy: -22.2, tl: 3.5, hd: 5.5, aFx: 7.3, aFy: 12.8, aBx: -5.7, aBy: 13.6, lFx: 6.6, lFy: -0.6, lBx: -4.7 });

/**
 * 스킬 1 응답 (2차 리워크): 준비 → 손가락을 걸고 → 튀김(멈칫) → 5틱에 도착(순간이동, sim ANSWER_TELE_TICK) → 접었던 몸이 풀리며 팔을 펼침
 * → 떠 있는 동안 팔이 깃털처럼 내려옴 → 사뿐히 무게를 싣고 기본자세. 12프레임 → 16프레임 21틱 (dur 1~2로 고르게 짧게, 3장 백은우)
 */
export const EUNWOO_ANSWER = motion('answer', '스킬 1 응답', [1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 2], [
  K(0, E_STANCE), K(1, AN_PREP), K(2, AN_COCK), K(3, AN_SNAP, true), K(4, AN_ARRIVE), K(5, AN_UNFOLD), K(6, AN_SPREAD), K(7, AN_OPEN),
  K(8, AN_FLOAT_A), K(9, AN_FLOAT_B), K(10, AN_FLOAT_C), K(11, AN_DESC_A), K(12, AN_DESC_B), K(13, AN_SOFT), K(14, AN_RISE), K(15, E_STANCE),
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

/** 두 손이 가슴 쪽으로 모이기 시작 (어깨가 안으로) */
const SH_GATHER_A = E({ hx: 0, hy: -22.2, tl: 6, hd: 7, aFx: 5.5, aFy: 7, aBx: 3, aBy: 5, lFx: 7, lBx: -7 });
/** 가슴 앞에서 두 손이 닿는다 */
const SH_CUP_IN = E({ hx: 0, hy: -21.2, tl: 11, hd: 11, aFx: 3.5, aFy: 0.5, aBx: 5.5, aBy: -1, lFx: 7, lBx: -7 });
/** 발끝으로 솟으며 오므린 손이 얼굴 앞으로 */
const SH_RISE_A = E({ hx: 0, hy: -22.4, tl: 6, hd: 4, aFx: 4.5, aFy: -5, aBx: 5.5, aBy: -6, lFx: 6.5, lFy: -0.5, lBx: -6.5, lBy: -0.5 });
const SH_RISE_B = E({ hx: 0, hy: -23, tl: 1, hd: -4, aFx: 6, aFy: -10, aBx: 4, aBy: -11, lFx: 6, lFy: -1, lBx: -6, lBy: -1 });
/** 날려 보낸 뒤 팔이 한 번 더 뒤로 벌어지고 가슴이 열린다 */
const SH_OVER = E({ hx: 0, hy: -23.2, tl: -6, hd: -14, aFx: 12.5, aFy: -9, aBx: -11, aBy: -9, lFx: 6, lFy: -1, lBx: -6, lBy: -1 });
/** 날아가는 나비를 눈으로 따라간다 */
const SH_WATCH = E({ hx: 0, hy: -22.6, tl: -1, hd: -6, aFx: 11.5, aFy: -4, aBx: -9.5, aBy: -4, lFx: 6, lBx: -6 });
const SH_LOWER_A = E({ hx: -0.3, hy: -22.5, tl: 0, hd: -2, aFx: 10, aFy: 1, aBx: -8.5, aBy: 2, lFx: 6.2, lBx: -5.6 });
const SH_LOWER_B = E({ hx: -0.8, hy: -22.6, tl: 1, hd: 2, aFx: 8.5, aFy: 7, aBx: -7, aBy: 8, lFx: 6.3, lBx: -5.2 });
const SH_SETTLE = E({ hx: -1.2, hy: -22.8, tl: 1.5, hd: 4.5, aFx: 7.5, aFy: 11, aBx: -6, aBy: 12, lFx: 6.4, lFy: -0.5, lBx: -4.8 });

/**
 * 스킬 2 아직 여기 있어 (2차 리워크): 두 손이 모이기 시작 → 가슴 앞에서 닿고 → 오므려 숨을 들이쉼(멈칫) → 발끝으로 솟으며 얼굴 앞으로
 * → 위로 펼쳐 날려 보냄 → 팔이 한 번 더 벌어짐 → 버팀(멈칫) → 나비를 눈으로 따라감 → 천천히 내리며 기본자세.
 * 12프레임 → 16프레임 28틱 (dur 1~3으로 고르게 짧게, 3장 백은우)
 */
export const EUNWOO_STILL_HERE = motion('still_here', '스킬 2 아직 여기 있어', [1, 1, 2, 2, 3, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1], [
  K(0, E_STANCE), K(1, SH_GATHER_A), K(2, SH_GATHER), K(3, SH_CUP_IN), K(4, SH_CUP, true), K(5, SH_RISE_A), K(6, SH_RISE_B), K(7, SH_OPEN),
  K(8, SH_OVER), K(9, SH_HOLD, true), K(10, SH_WATCH), K(11, SH_LOWER_A), K(12, SH_LOWER_B), K(13, SH_SETTLE), K(14, E({ ...E_STANCE, hd: 5, aBy: 13.6 })), K(15, E_STANCE),
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
/** 장면 2 세계 완성 (40틱): 눈을 뜨며 고개를 들어 → 한 번 더 올려다봤다가 → 상대를 바라본다 */
const LOOK_RISE = E({ ...GW_LOWER, hd: 9, tl: 1.5, aBy: 13.5 });
const LOOK_UP = E({ ...GW_LOWER, hy: -23.8, hd: -2, tl: -2, aBx: -4, aBy: 10 });
const LOOK = E({ ...GW_LOWER, hy: -23.4, hd: 2, tl: -0.5, aBx: -3.5, aBy: 11.5 });
export const EUNWOO_SUPER_WORLD = motion('super_world', '선의 연출 2 세계', [10, 6, 10, 14], [
  K(0, DEPLOY_END), K(1, LOOK_RISE), K(2, LOOK_UP), K(3, LOOK),
], undefined, SCENE_FOLLOW);

/**
 * 장면 3 (70틱): 물 위를 천천히 네 걸음. 한 걸음 5프레임: 닿음 → 무게를 앞으로 옮김 → 뒤꿈치를 듦 (여기까지 느리게) → 뒷발이 지나감 → 앞으로 내뻗음 (빠르게).
 * 걸음마다 앞뒤 발이 바뀐다 (k: 걸음 번호, f: 걸음 안의 프레임). 자리는 장면 위치 키가 옮긴다 (0 → 46px)
 */
const STEP_SWING: ReadonlyArray<readonly [number, number, number, number]> = [
  // [뒷발 x, 뒷발 y, 앞발 x, 앞발 y] (걷는 발 = 뒷발이 앞으로 넘어간다), 엉덩이 높이
  [-6, 0, 6, 0], [-6.5, -0.8, 5.5, 0], [-7, -2.2, 5, 0], [-0.5, -2.8, 4.5, 0], [5.5, -1, 4, 0],
];
const STEP_HIP = [0, 0.5, 0.7, 1, 0.6];
const walk = (i: number): Pose => {
  const k = Math.floor(i / 5);
  const f = i % 5;
  const [sx, sy, px, py] = STEP_SWING[f]!;
  // 짝수 걸음은 앞발(lF)이 디딘 발이고 뒷발(lB)이 넘어온다, 홀수 걸음은 반대
  const swingIsB = k % 2 === 0;
  const lift = STEP_HIP[f]!;
  const sw = swingIsB ? 1 : -1;
  return E({
    hx: -1 + 0.8 * lift, hy: -23 - 0.5 * lift, tl: 3, hd: 4, aFx: 5 - 1.2 * sw * (f / 4), aFy: 15, aBx: -2 + 1.5 * sw * (f / 4), aBy: 13,
    lFx: swingIsB ? px : sx, lFy: swingIsB ? py : sy, lBx: swingIsB ? sx : px, lBy: swingIsB ? sy : py, wa: 90,
  });
};
export const EUNWOO_SUPER_WALK = motion('super_walk', '선의 연출 3 걸어감', spread(20, 70), Array.from({ length: 20 }, (_, i) => K(i, walk(i))), undefined, { ribbon: { stiff: 0.4, gravity: 1.3 }, wind: 0.15, breeze: 0.5 });

/** 장면 4 (40틱): 마지막 한 걸음으로 다가가 (손은 아직 내린 채) → 뒷손을 크게 들어 → 어깨 위에서 → 얹으며 살짝 눌렀다가 → 20틱 정적 */
const TOUCH_STEP = E({ hx: -0.5, hy: -23.2, tl: 4, hd: 3, aFx: 5, aFy: 15, aBx: -1, aBy: 12, lFx: 6, lBx: -4, wa: 90 });
const TOUCH_A = E({ hx: 0, hy: -23, tl: 6, hd: 4, aFx: 5, aFy: 15, aBx: 8, aBy: 2, lFx: 7, lBx: -5, wa: 90 });
const TOUCH_REACH = E({ hx: 0.8, hy: -23, tl: 8, hd: 7, tw: -2, aFx: 5, aFy: 15, aBx: 14, aBy: -7, lFx: 8, lBx: -5, wa: 90 });
const TOUCH_PRESS = E({ hx: 1.2, hy: -22.6, tl: 11, hd: 11, tw: -3, aFx: 5, aFy: 15, aBx: 15.5, aBy: -4, lFx: 8, lBx: -5, wa: 90 });
const TOUCH_B = E({ hx: 1, hy: -22.8, tl: 10, hd: 10, tw: -3, aFx: 5, aFy: 15, aBx: 15, aBy: -5, lFx: 8, lBx: -5, wa: 90 });
export const EUNWOO_SUPER_TOUCH = motion('super_touch', '선의 연출 4 어깨에 손', [4, 4, 4, 4, 4, 20], [
  K(0, walk(0)), K(1, TOUCH_STEP), K(2, TOUCH_A), K(3, TOUCH_REACH), K(4, TOUCH_PRESS), K(5, TOUCH_B),
], undefined, { ribbon: { stiff: 0.4, gravity: 1.3 } });

/** 장면 5 (50틱): 손을 얹은 채 주저앉는 상대를 따라 천천히 숙인다 (상대가 무릎 꿇는 12~28틱에 함께), 금빛 치유의 빛이 차오른다 */
const HEAL_START = E({ hx: 1, hy: -22.7, tl: 11, hd: 11, tw: -3, aFx: 5, aFy: 15, aBx: 15, aBy: -4, lFx: 8, lBx: -5, wa: 90 });
const HEAL_A = E({ hx: 1, hy: -22.5, tl: 12.5, hd: 13, tw: -3, aFx: 5, aFy: 15, aBx: 15, aBy: -2.8, lFx: 8, lBx: -5, wa: 90 });
const HEAL_FOLLOW = E({ hx: 1, hy: -22.1, tl: 17, hd: 17, tw: -2.2, aFx: 5, aFy: 15, aBx: 14.2, aBy: 4.8, lFx: 8, lBx: -5, wa: 90 });
const HEAL_B = E({ hx: 1, hy: -22, tl: 18, hd: 18, tw: -2, aFx: 5, aFy: 15, aBx: 14, aBy: 6, lFx: 8, lBx: -5, wa: 90 });
export const EUNWOO_SUPER_HEAL = motion('super_heal', '선의 연출 5 백합', [8, 8, 10, 12, 12], [
  K(0, TOUCH_B), K(1, HEAL_START), K(2, HEAL_A), K(3, HEAL_FOLLOW), K(4, HEAL_B),
], undefined, { ribbon: { stiff: 0.4, gravity: 1.3 } });

/** 장면 6 (40틱): 손이 어깨에서 떨어지고 → 한 번에 거두며 몸을 세우고 → 한 걸음 물러나 (자리 50 → 38) → 칼을 쥔 채 서서 → 기본자세 (세계가 나비로 부서진다) */
const REL_LIFT = E({ hx: 0.8, hy: -22.6, tl: 12, hd: 13, tw: -1.8, aFx: 5, aFy: 15, aBx: 13, aBy: 4, lFx: 8, lBx: -5, wa: 90 });
const REL_STEP = E({ hx: -1, hy: -23.3, tl: 4, hd: 10, aFx: 5.5, aFy: 14.5, aBx: 1, aBy: 10, lFx: 9, lFy: -2.5, lBx: -6, wa: 90 });
const RELEASE = E({ hx: -1.5, hy: -23, tl: 2, hd: 8, aFx: 6, aFy: 14, aBx: -4, aBy: 14, lFx: 6, lBx: -6, wa: 90 });
const REL_SETTLE = E({ hx: -1.5, hy: -23.2, tl: 1.5, hd: 7, aFx: 6.5, aFy: 13.8, aBx: -5, aBy: 14, lFx: 6.3, lBx: -5, wa: 85 });
export const EUNWOO_SUPER_RELEASE = motion('super_release', '선의 연출 6 돌아옴', [4, 4, 6, 7, 7, 12], [
  K(0, HEAL_B), K(1, REL_LIFT), K(2, REL_STEP), K(3, RELEASE), K(4, REL_SETTLE), K(5, E_STANCE),
], undefined, { ribbon: { stiff: 0.5, gravity: 1.1 } });

/** 상대 반응: 시간이 멈춘 듯 선 채로 굳는다. 장면 1~4에서 처음부터 다시 재생되므로 한 장 (움직이면 장면이 바뀔 때마다 튄다) */
const FROZEN = { hx: -1, hy: -22, tl: -2, hd: 7, aFx: 3, aFy: 15, aBx: -2, aBy: 15, lFx: 6, lFy: 0, lBx: -6, lBy: 0 };
export const EUNWOO_SUPER_DAZE = motion('super_daze', '선의 반응 1 멈춤', [60], [K(0, FROZEN, true), K(1, FROZEN)], undefined, {});

/** 상대 반응 (장면 5): 어깨에 손이 얹힌 채 힘이 빠져 무릎을 꿇고, 물 위에 천천히 주저앉는다 */
const KN_SLUMP = { hx: -1, hy: -21, tl: 14, hd: 20, aFx: 3, aFy: 15, aBx: -1, aBy: 15, lFx: 6, lFy: 0, lBx: -6, lBy: 0 };
const KN_KNEEL = { hx: -2, hy: -12, tl: 12, hd: 24, aFx: 5, aFy: 12, aBx: 1, aBy: 12, lFx: 8, lFy: 0, lBx: -10, lBy: 0 };
const KN_SIT = { hx: -3, hy: -6, tl: 4, hd: 28, aFx: 7, aFy: 8, aBx: 3, aBy: 9, lFx: 12, lFy: 0, lBx: 4, lBy: 0 };
export const EUNWOO_SUPER_KNEEL = motion('super_kneel', '선의 반응 2 주저앉음', [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5], [
  K(0, { ...FROZEN, hd: 9 }), K(3, KN_SLUMP), K(7, KN_KNEEL, true), K(10, KN_SIT, true), K(11, KN_SIT),
], undefined, {});

/** 상대 반응 (장면 6): 물 위에 앉은 채 → 고개가 떨어지고 → 어깨까지 힘이 빠져 늘어진다 (숨 한 번) */
const REST_DROP = { ...KN_SIT, hx: -3.2, hy: -5.8, tl: 1, hd: 33, aFx: 7.5, aFy: 7.5, aBx: 3.5, aBy: 8.5 };
const REST_B = { ...KN_SIT, hx: -3.5, hy: -5.5, tl: -4, hd: 36, aFx: 8, aFy: 7, aBx: 4, aBy: 8 };
export const EUNWOO_SUPER_REST = motion('super_rest', '선의 반응 3 쉼', [8, 12, 20], [
  K(0, KN_SIT), K(1, REST_DROP), K(2, REST_B),
], undefined, { breeze: 1.2 });

export const EUNWOO_SKILL_MOTIONS: readonly MotionData[] = [
  EUNWOO_ANSWER, EUNWOO_STILL_HERE, EUNWOO_BATTO, EUNWOO_GOODWILL,
  EUNWOO_SUPER_DEPLOY, EUNWOO_SUPER_DEPLOY_SHORT, EUNWOO_SUPER_WORLD, EUNWOO_SUPER_WALK, EUNWOO_SUPER_TOUCH, EUNWOO_SUPER_HEAL, EUNWOO_SUPER_RELEASE,
  EUNWOO_SUPER_DAZE, EUNWOO_SUPER_KNEEL, EUNWOO_SUPER_REST,
];
