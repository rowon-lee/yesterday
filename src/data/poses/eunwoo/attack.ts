import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { spin } from './air';
import { E, E_STANCE } from './stance';

/*
 * 백은우 평타 11개 (캐릭터 기획서 '평타': 연검 스텔라리스를 휘두른다. 리본처럼 휘어지는 긴 궤적으로 중간 거리를 훑는다.
 * 공중 내려찍기는 와이어를 던져 끌어내린다). 동작연출지침서 1~4장을 따른다:
 * - 모두 128×96 칸 (발밑 64, 93). 감기(마지막 키 멈칫) → 스미어 1틱(치는 팔 1.4배) → 타격 1~2프레임 → 지나치기 → 여운 → 복귀.
 * - 타격 프레임: 발 간격 28~40px, 엉덩이 4~10px 낮게, 몸통 20~40°, 치는 팔 98~100% (18px), 치는 쪽 어깨 4~6px 앞(tw).
 * - 범위: 몸 이동(advance) + 팔 + 칼날이 리본처럼 늘어나는 궤적 상자(box). 칼끝 궤적이 가장 길다 (7장).
 *   늘어난 칼날과 은빛 띠는 렌더(render/chars/eunwoo.ts)가 궤적 상자 모양대로 그린다. 판정·수치는 data/characters/eunwoo.ts.
 * 연검은 앞손에 쥔다 (decor). 뒷손은 균형을 잡고, 내려찍기에서는 와이어를 던진다.
 */

/** 공중 기본 자세 (공중 공격의 시작·끝) */
const AIR = E({ hx: 0, hy: -24, tl: 8, hd: 0, aFx: 11, aFy: -2, aBx: -9, aBy: -2, lFx: 7, lFy: -7, lBx: -6, lBy: -5 });

const motion = (name: string, label: string, dur: number[], keys: MotionData['keys'], limb: 'aF' | 'aB' = 'aF', smear = 3): MotionData => ({
  name: `eunwoo/${name}`,
  label: `백은우 ${label}`,
  wide: true,
  smear: { frame: smear, limb, stretch: 1.4 },
  dur,
  keys,
});
const K = (at: number, pose: Pose, stop = false) => ({ at, pose, stop });

// ---- 1타: 손목 채찍질 (칼날을 앞으로 곧게 쏘아 보낸다) ----
const A1_LOAD = E({ hx: -1, hy: -21, tl: 4, hd: 2, tw: -1.5, aFx: 4, aFy: 6, aBx: -5, aBy: 12, lFx: 9, lBx: -9 });
/** 감기 끝 (멈칫): 무게를 뒷발로, 칼 쥔 손을 허리 뒤로 당겨 어깨를 감는다 */
const A1_COIL = E({ hx: -2.5, hy: -20, tl: 0, hd: 4, tw: -3, aFx: 0, aFy: 4, aBx: -6, aBy: 11, lFx: 10, lBx: -10 });
const A1_SMEAR = E({ hx: 2, hy: -16.5, tl: 26, hd: -2, tw: 3, aFx: 15, aFy: -7, aBx: -9, aBy: 9, lFx: 17, lBx: -13 });
/** 타격: 앞발을 크게 내디뎌 몸을 싣고 칼 쥔 팔을 끝까지 (뒷팔은 뒤로 뻗어 한 줄) */
const A1_HIT = E({ hx: 4, hy: -15.5, tl: 36, hd: -6, tw: 5, aFx: 15.6, aFy: -8.9, aBx: -12, aBy: 6, lFx: 20, lBx: -15 });
const A1_HIT2 = E({ hx: 4.5, hy: -15.3, tl: 37, hd: -6, tw: 5.5, aFx: 16.1, aFy: -8.3, aBx: -12.5, aBy: 6, lFx: 20, lBx: -15.5 });
const A1_OVER = E({ hx: 5, hy: -15, tl: 39, hd: -6, tw: 6, aFx: 16.5, aFy: -5, aBx: -13, aBy: 5, lFx: 20, lBx: -16 });
const A1_HOLD = E({ hx: 4.5, hy: -15.5, tl: 37, hd: -5, tw: 5, aFx: 16, aFy: -4, aBx: -12, aBy: 6, lFx: 20, lBx: -15 });
const A_BACK1 = (lf: number, lb: number) => E({ hx: 2, hy: -18.5, tl: 20, hd: 0, tw: 2, aFx: 13, aFy: 2, aBx: -8, aBy: 10, lFx: lf, lBx: lb });
const A_BACK2 = E({ hx: 0.5, hy: -20.5, tl: 10, hd: 1, tw: 0.5, aFx: 11.5, aFy: 4, aBx: -5, aBy: 13, lFx: 10, lBx: -9 });

/** 1타 채찍질: 감기(2~3) → 스미어(4) → 판정(5~6) → 지나치기 → 여운(8~9) → 복귀. 12프레임 21틱 */
export const EUNWOO_ATK1 = motion('flick', '1타 채찍질', [1, 1, 2, 1, 2, 1, 1, 3, 3, 2, 2, 2], [
  K(0, E_STANCE), K(1, A1_LOAD), K(2, A1_COIL, true), K(3, A1_SMEAR), K(4, A1_HIT), K(5, A1_HIT2), K(6, A1_OVER),
  K(7, A1_OVER, true), K(8, A1_HOLD), K(9, A_BACK1(15, -12)), K(10, A_BACK2), K(11, E_STANCE),
]);

// ---- 2타: 되돌려 내리베기 (머리 위로 감았다가 앞아래로 비스듬히) ----
const A2_LOAD = E({ hx: 1, hy: -20.5, tl: 10, hd: 0, tw: -2, aFx: 2, aFy: -10, aBx: -6, aBy: 11, lFx: 11, lBx: -10 });
/** 감기 끝: 칼 쥔 손을 머리 위 뒤로 높이 감는다 */
const A2_COIL = E({ hx: 0, hy: -20, tl: 4, hd: -6, tw: -4, aFx: -4, aFy: -14, aBx: -4, aBy: 12, lFx: 12, lBx: -11 });
const A2_SMEAR = E({ hx: 3, hy: -17.5, tl: 22, hd: -4, tw: 2, aFx: 12, aFy: -6, aBx: -9, aBy: 9, lFx: 17, lBx: -13 });
/** 타격: 앞아래로 비스듬히 내리베며 깊이 디딘다 */
const A2_HIT = E({ hx: 5, hy: -15.5, tl: 32, hd: -2, tw: 5, aFx: 15.6, aFy: 8.8, aBx: -12, aBy: 4, lFx: 21, lBx: -14 });
const A2_HIT2 = E({ hx: 5.5, hy: -15.3, tl: 33, hd: -2, tw: 5.5, aFx: 14.2, aFy: 11, aBx: -12.5, aBy: 4, lFx: 21, lBx: -14.5 });
const A2_OVER = E({ hx: 6, hy: -15, tl: 35, hd: -2, tw: 6, aFx: 10, aFy: 14, aBx: -13, aBy: 3, lFx: 21, lBx: -15 });
const A2_HOLD = E({ hx: 5.5, hy: -15.5, tl: 33, hd: -1, tw: 5, aFx: 10.5, aFy: 13.5, aBx: -12, aBy: 4, lFx: 21, lBx: -14 });

/** 2타 되돌려 내리베기: 12프레임 21틱 */
export const EUNWOO_ATK2 = motion('backhand', '2타 되돌려 내리베기', [1, 1, 2, 1, 2, 1, 1, 3, 3, 2, 2, 2], [
  K(0, E_STANCE), K(1, A2_LOAD), K(2, A2_COIL, true), K(3, A2_SMEAR), K(4, A2_HIT), K(5, A2_HIT2), K(6, A2_OVER),
  K(7, A2_OVER, true), K(8, A2_HOLD), K(9, A_BACK1(15, -12)), K(10, A_BACK2), K(11, E_STANCE),
]);

// ---- 3타: 돌려 베기 (몸을 돌리며 칼끝이 허리 높이로 크게 반원을 그린다, 뒷다리는 뒤로 들어 올린다) ----
const A3_LOAD = E({ hx: -1, hy: -20, tl: -4, hd: 4, tw: -3, aFx: -6, aFy: 4, aBx: 6, aBy: 4, lFx: 10, lBx: -9 });
/** 감기 끝: 칼 쥔 팔을 몸 뒤로 멀리 감고 뒷손은 앞으로 (몸을 비튼다) */
const A3_COIL = E({ hx: -2.5, hy: -19, tl: -10, hd: 8, tw: -5, aFx: -12, aFy: 2, aBx: 9, aBy: 0, lFx: 11, lBx: -9 });
const A3_SMEAR = E({ hx: 2, hy: -17, tl: 12, hd: 0, tw: 2, aFx: 6, aFy: 8, aBx: -4, aBy: 8, lFx: 16, lBx: -12, lBy: -3 });
/** 타격: 몸이 돌아 앞으로 실리고 칼 쥔 팔이 허리 높이로 끝까지, 뒷다리는 뒤로 들려 한 줄 (아라베스크) */
const A3_HIT = E({ hx: 5, hy: -16, tl: 26, hd: -4, tw: 6, aFx: 17.8, aFy: 2.4, aBx: -14, aBy: 2, lFx: 18, lBx: -16, lBy: -8 });
const A3_HIT2 = E({ hx: 5.5, hy: -16, tl: 27, hd: -4, tw: 6.5, aFx: 17.2, aFy: -3.8, aBx: -14, aBy: 1, lFx: 18, lBx: -16.5, lBy: -9 });
const A3_OVER = E({ hx: 6, hy: -16, tl: 28, hd: -4, tw: 6, aFx: 14, aFy: -9, aBx: -14, aBy: 1, lFx: 18, lBx: -16, lBy: -8 });
const A3_HOLD = E({ hx: 5.5, hy: -16.5, tl: 27, hd: -3, tw: 5, aFx: 14, aFy: -8, aBx: -13, aBy: 2, lFx: 18, lBx: -15, lBy: -6 });

/** 3타 돌려 베기: 12프레임 23틱 */
export const EUNWOO_ATK3 = motion('spin', '3타 돌려 베기', [1, 2, 2, 1, 2, 1, 2, 3, 3, 2, 2, 2], [
  K(0, E_STANCE), K(1, A3_LOAD), K(2, A3_COIL, true), K(3, A3_SMEAR), K(4, A3_HIT), K(5, A3_HIT2), K(6, A3_OVER),
  K(7, A3_OVER, true), K(8, A3_HOLD), K(9, A_BACK1(14, -12)), K(10, A_BACK2), K(11, E_STANCE),
]);

// ---- 4타: 내려치는 채찍 (등을 젖혀 칼을 머리 위 뒤로 들었다가, 깊이 내디디며 앞으로 내리친다. 칼끝이 가장 멀리 뻗는다) ----
const A4_LOAD = E({ hx: -1, hy: -21, tl: -2, hd: -4, tw: -2, aFx: 2, aFy: -12, aBx: -6, aBy: 10, lFx: 10, lBx: -9 });
const A4_RAISE = E({ hx: -2.5, hy: -21.5, tl: -12, hd: -8, tw: -4, aFx: -5, aFy: -16, aBx: -2, aBy: 8, lFx: 11, lBx: -10 });
/** 감기 끝 (멈칫): 등을 활처럼 젖히고 칼 쥔 손이 머리 뒤 */
const A4_COIL = E({ hx: -3.5, hy: -21, tl: -16, hd: -8, tw: -5, aFx: -9, aFy: -15, aBx: 0, aBy: 6, lFx: 12, lBx: -10 });
const A4_SMEAR = E({ hx: 3, hy: -17, tl: 20, hd: -6, tw: 3, aFx: 12, aFy: -8, aBx: -10, aBy: 6, lFx: 20, lBx: -14 });
/** 타격: 깊이 내디뎌 온몸을 실어 앞아래로 내리친다 */
const A4_HIT = E({ hx: 7, hy: -14, tl: 38, hd: -6, tw: 6, aFx: 14.3, aFy: 10.8, aBx: -14, aBy: 0, lFx: 26, lBx: -13 });
const A4_HIT2 = E({ hx: 7.5, hy: -13.8, tl: 39, hd: -6, tw: 6, aFx: 12, aFy: 13.4, aBx: -14, aBy: 0, lFx: 26, lBx: -13.5 });
const A4_OVER = E({ hx: 8, hy: -13.5, tl: 41, hd: -6, tw: 6, aFx: 8, aFy: 15.5, aBx: -14, aBy: -1, lFx: 26, lBx: -14 });
const A4_HOLD = E({ hx: 7.5, hy: -14, tl: 39, hd: -5, tw: 5, aFx: 8.5, aFy: 15, aBx: -13, aBy: 0, lFx: 26, lBx: -13 });

/** 4타 내려치는 채찍: 감기 4프레임 → 스미어 → 판정(6~7) → 지나치기 → 여운(9~10) → 복귀. 13프레임 28틱 (128×96) */
export const EUNWOO_ATK4 = motion('lash', '4타 내려치는 채찍', [1, 2, 2, 2, 1, 2, 2, 2, 4, 4, 2, 2, 2], [
  K(0, E_STANCE), K(1, A4_LOAD), K(2, A4_RAISE), K(3, A4_COIL, true), K(4, A4_SMEAR), K(5, A4_HIT), K(6, A4_HIT2), K(7, A4_OVER),
  K(8, A4_OVER, true), K(9, A4_HOLD), K(10, A_BACK1(18, -12)), K(11, A_BACK2), K(12, E_STANCE),
], 'aF', 4);

// ---- 띄우기: 올려 베기 (낮게 웅크려 칼을 바닥 가까이 두었다가, 솟구치며 아래에서 위로 크게) ----
const L_LOAD = E({ hx: 0, hy: -18, tl: 20, hd: -2, tw: -1, aFx: 6, aFy: 10, aBx: -6, aBy: 10, lFx: 11, lBx: -10 });
/** 감기 끝: 깊이 웅크려 칼 쥔 손을 앞 바닥 가까이 */
const L_COIL = E({ hx: 1, hy: -14.5, tl: 34, hd: -6, tw: -2, aFx: 2, aFy: 14, aBx: -9, aBy: 6, lFx: 14, lBx: -12 });
const L_SMEAR = E({ hx: 4, hy: -20, tl: 12, hd: -10, tw: 3, aFx: 13, aFy: -6, aBx: -10, aBy: 6, lFx: 16, lBx: -10 });
/** 타격: 앞발로 솟구쳐 몸을 펴고 칼 쥔 팔을 머리 위로 끝까지 (뒷발은 들린다) */
const L_HIT = E({ hx: 6, hy: -24, tl: -6, hd: -16, tw: 5, aFx: 5, aFy: -17.2, aBx: -12, aBy: 2, lFx: 14, lBx: -12, lBy: -4 });
const L_HIT2 = E({ hx: 6.5, hy: -24.5, tl: -8, hd: -18, tw: 5.5, aFx: 1.5, aFy: -17.9, aBx: -12, aBy: 1, lFx: 14, lBx: -12, lBy: -5 });
const L_OVER = E({ hx: 6.5, hy: -24.5, tl: -10, hd: -18, tw: 5, aFx: -3, aFy: -17.5, aBx: -12, aBy: 1, lFx: 14, lBx: -12, lBy: -5 });
const L_HOLD = E({ hx: 6, hy: -24, tl: -8, hd: -16, tw: 4, aFx: -2, aFy: -17, aBx: -11, aBy: 2, lFx: 14, lBx: -12, lBy: -3 });

/** 띄우기 올려 베기: 12프레임 21틱 */
export const EUNWOO_LAUNCHER = motion('rise', '띄우기 올려 베기', [1, 1, 2, 1, 2, 1, 1, 3, 3, 2, 2, 2], [
  K(0, E_STANCE), K(1, L_LOAD), K(2, L_COIL, true), K(3, L_SMEAR), K(4, L_HIT), K(5, L_HIT2), K(6, L_OVER),
  K(7, L_OVER, true), K(8, L_HOLD), K(9, A_BACK1(14, -11)), K(10, A_BACK2), K(11, E_STANCE),
]);

// ---- 쓸기: 다리 걸기 (낮게 다리를 찢어 엎드리며 칼끝이 바닥을 스친다) ----
const S_LOAD = E({ hx: -1, hy: -18, tl: 14, hd: 0, tw: -2, aFx: 2, aFy: 8, aBx: -6, aBy: 10, lFx: 10, lBx: -10 });
const S_COIL = E({ hx: -2, hy: -13, tl: 24, hd: 4, tw: -4, aFx: -8, aFy: 10, aBx: 2, aBy: 10, lFx: 12, lBx: -12 });
const S_SMEAR = E({ hx: 2, hy: -10, tl: 40, hd: -10, tw: 2, aFx: 10, aFy: 13, aBx: -10, aBy: 4, lFx: 18, lBx: -18 });
/** 타격: 다리를 앞뒤로 길게 찢어 낮게 엎드리고, 칼 쥔 팔이 바닥 가까이 앞으로 끝까지 */
const S_HIT = E({ hx: 4, hy: -9, tl: 50, hd: -16, tw: 5, aFx: 15.2, aFy: 9.5, aBx: -14, aBy: -2, lFx: 21, lBx: -17 });
const S_HIT2 = E({ hx: 4.5, hy: -9, tl: 51, hd: -16, tw: 5.5, aFx: 17, aFy: 5.8, aBx: -14, aBy: -2, lFx: 21, lBx: -17 });
const S_OVER = E({ hx: 5, hy: -9, tl: 52, hd: -16, tw: 5, aFx: 16.5, aFy: 2, aBx: -14, aBy: -3, lFx: 21, lBx: -17 });
const S_HOLD = E({ hx: 4.5, hy: -9.5, tl: 50, hd: -14, tw: 4, aFx: 16, aFy: 3, aBx: -13, aBy: -2, lFx: 21, lBx: -17 });
const S_BACK = E({ hx: 2, hy: -14, tl: 32, hd: -6, tw: 2, aFx: 12, aFy: 6, aBx: -9, aBy: 6, lFx: 16, lBx: -14 });

/** 쓸기 다리 걸기: 12프레임 22틱 */
export const EUNWOO_SWEEP = motion('low', '쓸기 다리 걸기', [1, 1, 2, 1, 2, 1, 2, 3, 3, 2, 2, 2], [
  K(0, E_STANCE), K(1, S_LOAD), K(2, S_COIL, true), K(3, S_SMEAR), K(4, S_HIT), K(5, S_HIT2), K(6, S_OVER),
  K(7, S_OVER, true), K(8, S_HOLD), K(9, S_BACK), K(10, A_BACK2), K(11, E_STANCE),
]);

// ---- 대시 공격: 실 타고 찌르기 (금색 실을 따라 미끄러져 들어오며 펜싱처럼 길게 찌른다) ----
/** 대시에서 이어진 자세: 낮게 미끄러지며 뒷손은 실을 쥐고 앞으로 */
const DA_GLIDE = E({ hx: 3, hy: -15, tl: 28, hd: -12, tw: -1, aFx: 2, aFy: 6, aBx: 12, aBy: -2, lFx: 14, lBx: -17 });
/** 감기 끝: 칼 쥔 손을 허리 뒤로 당긴다 */
const DA_COIL = E({ hx: 2, hy: -16, tl: 22, hd: -8, tw: -3, aFx: -6, aFy: 2, aBx: 8, aBy: -2, lFx: 12, lBx: -16 });
const DA_SMEAR = E({ hx: 5, hy: -14.5, tl: 34, hd: -12, tw: 3, aFx: 15.5, aFy: -6, aBx: -10, aBy: -2, lFx: 20, lBx: -18 });
/** 타격: 앞무릎을 깊이 굽히고 뒷다리·뒷팔을 뒤로 길게 뻗어 칼 쥔 팔과 한 줄 (펜싱 런지) */
const DA_HIT = E({ hx: 7, hy: -13.5, tl: 40, hd: -16, tw: 6, aFx: 15.8, aFy: -8.4, aBx: -14, aBy: -2, lFx: 24, lBx: -16 });
const DA_HIT2 = E({ hx: 7.5, hy: -13.5, tl: 41, hd: -16, tw: 6, aFx: 16.2, aFy: -7.7, aBx: -14, aBy: -2, lFx: 24, lBx: -16.5 });
const DA_OVER = E({ hx: 8, hy: -13, tl: 43, hd: -16, tw: 6, aFx: 16.6, aFy: -6, aBx: -14, aBy: -2, lFx: 24, lBx: -17 });
const DA_HOLD = E({ hx: 7.5, hy: -13.5, tl: 41, hd: -15, tw: 5, aFx: 16.2, aFy: -5, aBx: -13, aBy: -1, lFx: 24, lBx: -16 });

/** 대시 공격 실 타고 찌르기: 12프레임 24틱 (판정 4~5프레임) */
export const EUNWOO_DASH_ATTACK = motion('thrust', '대시 공격 실 타고 찌르기', [2, 3, 1, 2, 2, 1, 3, 3, 2, 2, 2, 1], [
  K(0, DA_GLIDE), K(1, DA_COIL, true), K(2, DA_SMEAR), K(3, DA_HIT), K(4, DA_HIT2), K(5, DA_OVER),
  K(6, DA_OVER, true), K(7, DA_HOLD), K(8, A_BACK1(18, -14)), K(9, A_BACK1(14, -12)), K(10, A_BACK2), K(11, E_STANCE),
], 'aF', 2);

// ---- 공중 1타: 공중 채찍질 (앞아래로 비스듬히 쏘아 보낸다) ----
const AA1_COIL = E({ hx: -1, hy: -24, tl: 0, hd: 2, tw: -3, aFx: -2, aFy: -10, aBx: -6, aBy: 6, lFx: 6, lFy: -9, lBx: -5, lBy: -6 });
const AA1_SMEAR = E({ hx: 1, hy: -24, tl: 16, hd: -4, tw: 3, aFx: 14, aFy: 2, aBx: -10, aBy: 2, lFx: 8, lFy: -8, lBx: -8, lBy: -4 });
const AA1_HIT = E({ hx: 2, hy: -24, tl: 22, hd: -6, tw: 5, aFx: 16.2, aFy: 7.4, aBx: -12, aBy: 0, lFx: 6, lFy: -10, lBx: -10, lBy: -4 });
const AA1_HIT2 = E({ hx: 2.5, hy: -24, tl: 23, hd: -6, tw: 5.5, aFx: 15, aFy: 9.6, aBx: -12, aBy: 0, lFx: 6, lFy: -10, lBx: -10, lBy: -4 });
const AA1_OVER = E({ hx: 3, hy: -24, tl: 25, hd: -6, tw: 5, aFx: 12, aFy: 13, aBx: -12, aBy: 0, lFx: 6, lFy: -10, lBx: -10, lBy: -4 });

/** 공중 1타: 12프레임 20틱 (판정 4~5프레임) */
export const EUNWOO_AIR1 = motion('air_flick', '공중 1타 채찍질', [1, 2, 1, 2, 1, 1, 3, 3, 2, 2, 1, 1], [
  K(0, AIR), K(1, AA1_COIL, true), K(2, AA1_SMEAR), K(3, AA1_HIT), K(4, AA1_HIT2), K(5, AA1_OVER),
  K(6, AA1_OVER, true), K(7, AA1_HIT2), K(9, E({ ...AIR, aFx: 12, aFy: 4 })), K(11, AIR),
], 'aF', 2);

// ---- 공중 2타: 공중 올려 베기 (몸 아래 앞에서 위로 휘감아 올린다) ----
const AA2_COIL = E({ hx: 0, hy: -24, tl: 18, hd: 2, tw: -3, aFx: 2, aFy: 12, aBx: -8, aBy: -4, lFx: 7, lFy: -8, lBx: -6, lBy: -6 });
const AA2_SMEAR = E({ hx: 1, hy: -24, tl: 10, hd: -4, tw: 2, aFx: 14, aFy: 4, aBx: -10, aBy: 0, lFx: 8, lFy: -7, lBx: -7, lBy: -5 });
const AA2_HIT = E({ hx: 1, hy: -24, tl: 4, hd: -10, tw: 5, aFx: 14.8, aFy: -10, aBx: -12, aBy: 2, lFx: 9, lFy: -6, lBx: -8, lBy: -5 });
const AA2_HIT2 = E({ hx: 1, hy: -24, tl: 2, hd: -12, tw: 5.5, aFx: 12, aFy: -13.3, aBx: -12, aBy: 2, lFx: 9, lFy: -6, lBx: -8, lBy: -5 });
const AA2_OVER = E({ hx: 1, hy: -24, tl: 0, hd: -12, tw: 5, aFx: 8, aFy: -15.5, aBx: -12, aBy: 2, lFx: 9, lFy: -6, lBx: -8, lBy: -5 });

/** 공중 2타: 12프레임 20틱 (판정 4~5프레임) */
export const EUNWOO_AIR2 = motion('air_rise', '공중 2타 올려 베기', [1, 2, 1, 2, 1, 1, 3, 3, 2, 2, 1, 1], [
  K(0, AIR), K(1, AA2_COIL, true), K(2, AA2_SMEAR), K(3, AA2_HIT), K(4, AA2_HIT2), K(5, AA2_OVER),
  K(6, AA2_OVER, true), K(7, AA2_HIT2), K(9, E({ ...AIR, aFx: 12, aFy: -6 })), K(11, AIR),
], 'aF', 2);

// ---- 공중 3타: 공중 회전 베기 (팔을 뻗은 채 몸을 한 바퀴 돌려 칼끝이 둘레에 원을 그린다) ----
const AA3_COIL = E({ hx: 0, hy: -24, tl: -10, hd: 4, tw: -3, aFx: -10, aFy: -6, aBx: 6, aBy: 4, lFx: 8, lFy: -10, lBx: -4, lBy: -8 });
/** 돌리는 몸: 무릎을 접고 칼 쥔 팔을 쭉 뻗는다 (이것을 통째로 돌린다) */
const AA3_SPIN = E({ hx: 0, hy: -24, tl: 0, hd: 0, tw: 4, aFx: 17.8, aFy: 2, aBx: -12, aBy: 4, lFx: 6, lFy: -8, lBx: -6, lBy: -8 });
const AA3_END = E({ ...AIR, tl: AIR.tl + 360 });

/** 공중 3타: 12프레임 21틱 (판정 5~6프레임, 몸이 한 바퀴) */
export const EUNWOO_AIR3 = motion('air_spin', '공중 3타 회전 베기', [1, 2, 1, 1, 2, 2, 1, 2, 3, 2, 2, 2], [
  K(0, AIR), K(1, AA3_COIL, true), K(2, spin(AA3_SPIN, 60)), K(3, spin(AA3_SPIN, 130)), K(4, spin(AA3_SPIN, 210)),
  K(5, spin(AA3_SPIN, 290)), K(6, spin(AA3_SPIN, 345)), K(8, AA3_END, true), K(11, AA3_END),
]);

// ---- 내려찍기: 와이어 끌어내리기 (뒷손으로 와이어를 앞아래로 던져 감아 채고, 끌어당겨 내리꽂는다) ----
const SL_LOAD = E({ hx: 0, hy: -24, tl: -6, hd: 4, tw: 2, aFx: 10, aFy: -4, aBx: -6, aBy: -10, lFx: 7, lFy: -8, lBx: -6, lBy: -6 });
const SL_WIND = E({ hx: -1, hy: -24, tl: -12, hd: 2, tw: 4, aFx: 10, aFy: -2, aBx: -10, aBy: -12, lFx: 7, lFy: -9, lBx: -6, lBy: -7 });
/** 감기 끝: 등을 젖히고 와이어 쥔 뒷손을 머리 뒤로 */
const SL_COIL = E({ hx: -1.5, hy: -24, tl: -16, hd: 2, tw: 5, aFx: 10, aFy: 0, aBx: -12, aBy: -11, lFx: 7, lFy: -9, lBx: -6, lBy: -7 });
const SL_SMEAR = E({ hx: 1, hy: -24, tl: 18, hd: -10, tw: -3, aFx: 8, aFy: -6, aBx: 12, aBy: 6, lFx: 4, lFy: -12, lBx: -8, lBy: -10 });
/** 타격: 몸을 숙이며 와이어 쥔 뒷팔을 앞아래로 끝까지 던진다 */
const SL_HIT = E({ hx: 2, hy: -24, tl: 30, hd: -16, tw: -5, aFx: 6, aFy: -8, aBx: 12, aBy: 13.2, lFx: 2, lFy: -14, lBx: -10, lBy: -12 });
const SL_HIT2 = E({ hx: 2, hy: -24, tl: 31, hd: -16, tw: -5.5, aFx: 6, aFy: -8, aBx: 10.5, aBy: 14.6, lFx: 2, lFy: -14, lBx: -10, lBy: -12 });
/** 감아 챈 와이어를 끌어당긴다 */
const SL_YANK = E({ hx: 1, hy: -24, tl: 18, hd: -10, tw: -3, aFx: 8, aFy: -6, aBx: 4, aBy: 10, lFx: 4, lFy: -12, lBx: -8, lBy: -10 });
const SL_PULL = E({ hx: 0, hy: -24, tl: 6, hd: -4, tw: -1, aFx: 10, aFy: -4, aBx: -2, aBy: 6, lFx: 6, lFy: -10, lBx: -6, lBy: -8 });

/** 내려찍기 와이어 끌어내리기: 감기(2~4) → 스미어(5) → 던짐(6~7, 판정) → 끌어당김(8, 판정) → 거둠. 13프레임 25틱 (뒷손) */
export const EUNWOO_SLAM = motion('wire', '내려찍기 와이어 끌어내리기', [1, 1, 2, 2, 1, 2, 2, 2, 3, 3, 2, 2, 2], [
  K(0, AIR), K(1, SL_LOAD), K(2, SL_WIND), K(3, SL_COIL, true), K(4, SL_SMEAR), K(5, SL_HIT), K(6, SL_HIT2), K(7, SL_YANK),
  K(8, SL_PULL, true), K(10, E({ ...AIR, aBx: -6, aBy: 2 })), K(12, AIR),
], 'aB', 4);

export const EUNWOO_ATTACK_MOTIONS: readonly MotionData[] = [
  EUNWOO_ATK1, EUNWOO_ATK2, EUNWOO_ATK3, EUNWOO_ATK4, EUNWOO_LAUNCHER, EUNWOO_SWEEP, EUNWOO_DASH_ATTACK,
  EUNWOO_AIR1, EUNWOO_AIR2, EUNWOO_AIR3, EUNWOO_SLAM,
];
