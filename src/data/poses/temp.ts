import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/*
 * 임시 동작 (승인 전). 전투 엔진이 돌아가게 하려고 시제품(reference/prototype.html)의 포즈를
 * 옮겨 크게·빠르게 고친 것이다. 하나씩 사양을 받아 다시 만들고 승인받으면 이 파일에서 빠진다.
 * 모두 12~14프레임. 공격 동작의 dur는 그대로 기술의 발동·지속·후딜레이 틱이 된다.
 * 공격은 예비 동작을 짧게, 뻗는 순간을 크게(몸을 싣고 다리를 벌림), 끝자세를 잠깐 멈춰 보이게 했다.
 */

const P = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o });

// ---- 공통 포즈 ----
const CROUCH = P({ hx: -1, hy: -13, tl: 18, hd: -8, aFx: 9, aFy: -2, aBx: 6, aBy: 1, lFx: 9, lFy: 0, lBx: -8, lBy: 0 });
const SQ = P({ hy: -14, tl: 16, hd: -6, aFx: 4, aFy: 8, aBx: -5, aBy: 8, lFx: 9, lBx: -9 });
const UP = P({ hy: -25, tl: 0, hd: 4, aFx: 6, aFy: -16, aBx: -6, aBy: -14, lFx: 2, lFy: 0, lBx: -3, lBy: 2 });
const TK = P({ hy: -24, tl: 8, hd: 2, aFx: 9, aFy: -4, aBx: -3, aBy: -2, lFx: 8, lFy: -11, lBx: -4, lBy: -8 });
const TUCK = P({ hy: -24, tl: 24, hd: -8, aFx: 6, aFy: 3, aBx: 2, aBy: 5, lFx: 7, lFy: -15, lBx: 0, lBy: -13 });
const FL = P({ hy: -24, tl: 4, hd: 2, aFx: 9, aFy: -9, aBx: -7, aBy: -6, lFx: 6, lFy: -2, lBx: -6, lBy: -1 });
const LANDED = P({ hy: -15, tl: 16, hd: -4, aFx: 8, aFy: 8, aBx: -4, aBy: 10, lFx: 11, lBx: -11 });

// 앞으로 뛰기 (한 바퀴 48px). 뛴 거리로 프레임을 넘긴다. 몸을 앞으로 숙이고 팔을 크게 흔든다.
const RUN_A = P({ hy: -19, tl: 24, hd: -8, aFx: -6, aFy: 7, aBx: 10, aBy: -2, lFx: 14, lFy: 0, lBx: -11, lBy: -8 });
const RUN_B = P({ hy: -22, tl: 22, hd: -8, aFx: 1, aFy: 8, aBx: 3, aBy: 7, lFx: 2, lFy: 0, lBx: 5, lBy: -11 });
const RUN_C = P({ hy: -19, tl: 24, hd: -8, aFx: 10, aFy: -2, aBx: -6, aBy: 7, lFx: -11, lFy: -8, lBx: 14, lBy: 0 });
const RUN_D = P({ hy: -22, tl: 22, hd: -8, aFx: 3, aFy: 7, aBx: 1, aBy: 8, lFx: 5, lFy: -11, lBx: 2, lBy: 0 });
// 뒤로 뛰기: 몸을 세우고 깡충깡충 물러선다 (한 바퀴 32px)
const BRUN_A = P({ hy: -20, tl: -2, hd: 6, aFx: 9, aFy: 1, aBx: -3, aBy: 8, lFx: 10, lFy: 0, lBx: -4, lBy: -7 });
const BRUN_B = P({ hy: -23, tl: -4, hd: 6, aFx: 9, aFy: -1, aBx: -4, aBy: 6, lFx: 6, lFy: -4, lBx: -6, lBy: -4 });
const BRUN_C = P({ hy: -20, tl: -2, hd: 6, aFx: 9, aFy: 1, aBx: -3, aBy: 8, lFx: 4, lFy: -7, lBx: -10, lBy: 0 });

const DF = P({ hx: 3, hy: -17, tl: 32, hd: -12, aFx: -2, aFy: 8, aBx: -8, aBy: 6, lFx: 16, lBx: -15, lBy: -3 });
const DF2 = P({ hx: 2, hy: -18, tl: 20, aFx: 7, aFy: 4, lFx: 12, lBx: -9 });
const ADASH = P({ hy: -24, tl: 34, hd: -12, aFx: 4, aFy: 6, aBx: -8, aBy: 6, lFx: -4, lFy: -10, lBx: -14, lBy: -5 });

const GS = P({ hx: -2, tl: -2, hd: -4, aFx: 7, aFy: -10, aBx: 8, aBy: -6 });
const GS_R = P({ hx: -5, tl: -9, hd: -8, aFx: 5, aFy: -9, aBx: 6, aBy: -5, lFx: 9, lBx: -9 });
const CRUSH = P({ hx: -6, hy: -22, tl: -20, hd: -16, aFx: 2, aFy: -19, aBx: -9, aBy: -16, lFx: 10, lBx: -7 });

const HS = P({ hx: -5, tl: -18, hd: -24, aFx: 0, aFy: 7, aBx: -7, aBy: 5, lFx: 9, lBx: -7 });
const HS2 = P({ hx: -7, tl: -24, hd: -28, aFx: -3, aFy: 8, aBx: -9, aBy: 6, lFx: 9, lBx: -8 });
const HS3 = P({ hx: -3, tl: -6, hd: -10, aFx: 6, aFy: 2, aBx: 0, aBy: 6 });
const HH = P({ hx: -9, hy: -18, tl: -32, hd: -26, aFx: -5, aFy: 9, aBx: -11, aBy: 7, lFx: 11, lBx: -6 });
const KD_A = P({ hx: -2, hy: -22, tl: -38, hd: -22, aFx: -2, aFy: -9, aBx: -8, aBy: -11, lFx: 11, lFy: -7, lBx: 4, lBy: -3 });
const KD_B = P({ hx: 0, hy: -16, tl: -72, hd: -10, aFx: -4, aFy: -11, aBx: -10, aBy: -9, lFx: 15, lFy: -15, lBx: 10, lBy: -10 });
const LIE = P({ hx: 3, hy: -3, tl: -90, hd: 0, aFx: -6, aFy: 2, aBx: -2, aBy: 2, lFx: 25, lFy: -2, lBx: 24, lBy: 0 });
const BNC = { ...LIE, hy: -6, tl: -84, lFy: -6, lBy: -3 };
const GU1 = P({ hx: -2, hy: -7, tl: -30, hd: 10, aFx: 2, aFy: 8, aBx: -10, aBy: 16, lFx: 10, lFy: 0, lBx: 4, lBy: 0 });

const W1 = P({ tl: 2, hd: -4, aFx: 6, aFy: -8, aBx: 4, aBy: -2 });
const W2 = P({ hy: -22, tl: -2, hd: -10, aFx: 3, aFy: -19, aBx: -6, aBy: 3, lFx: 6, lBx: -6 });

// ---- 공격 포즈: 예비(W) → 뻗음(H) → 거둠(R) ----
const J_W = P({ hx: -1, tl: 6, aFx: 2, aFy: 2, aBx: 6, aBy: -2, lFx: 10, lBx: -9 });
const J_H = P({ hx: 5, hy: -19, tl: 22, hd: -6, aFx: 18, aFy: -4, aBx: -3, aBy: 6, lFx: 13, lBx: -10 });
const J_R = P({ hx: 3, tl: 14, aFx: 13, aFy: -2 });
const S_H = P({ hx: 6, hy: -19, tl: 24, hd: -6, aFx: -2, aFy: 6, aBx: 19, aBy: -5, lFx: 13, lBx: -10 });
const H_C = P({ hx: -2, tl: -6, hd: 6, aFx: 6, aFy: -2, aBx: -4, aBy: 6, lFx: 10, lFy: -18 });
const H_E = P({ hx: -1, hy: -22, tl: -22, hd: 12, aFx: 2, aFy: 2, aBx: -8, aBy: 8, lFx: 24, lFy: -32, lBx: -6, lBy: 0 });
const H_R = P({ hx: -1, tl: -8, aFx: 5, aFy: -2, lFx: 13, lFy: -18 });
const BIG_W = P({ hx: -4, hy: -19, tl: -8, hd: 8, aFx: -6, aFy: 4, aBx: 9, aBy: -6, lFx: 10, lBx: -9 });
const BIG_H = P({ hx: 9, hy: -17, tl: 30, hd: -10, aFx: 19, aFy: -5, aBx: -6, aBy: 7, lFx: 18, lBx: -14 });
const UPC_W = P({ hx: -1, hy: -15, tl: 20, hd: -6, aFx: 4, aFy: 10, aBx: 2, aBy: -4, lFx: 11, lBx: -10 });
const UPC_M = P({ hx: 5, hy: -21, tl: 10, hd: 0, aFx: 17, aFy: -9, aBx: 2, aBy: 4, lFx: 12, lBx: -8 });
const UPC_H = P({ hx: 3, hy: -25, tl: -8, hd: 10, aFx: 9, aFy: -20, aBx: -4, aBy: 6, lFx: 6, lFy: 0, lBx: -6, lBy: -5 });
const SW_W = { ...CROUCH, hx: -2, hy: -10, tl: 26, aFx: 9, aFy: 15, aBx: 4, aBy: 12, lFx: 6, lBx: -9 };
const SW_H = { ...CROUCH, hx: 0, hy: -9, tl: 32, hd: -10, aFx: 6, aFy: 15, aBx: -2, aBy: 14, lFx: 27, lFy: -1, lBx: -9 };
const SW_R = { ...CROUCH, hx: -1, hy: -11, tl: 24, aFy: 10, lFx: 14 };
const AJ = P({ hy: -24, tl: 14, hd: -2, aFx: 18, aFy: -3, aBx: -2, aBy: 4, lFx: 6, lFy: -8, lBx: -4, lBy: -6 });
const AK0 = P({ hy: -24, tl: -4, aFx: 6, aFy: -8, lFx: 4, lFy: -12, lBx: -3, lBy: -10 });
const AK = P({ hy: -24, tl: -14, hd: 8, aFx: 2, aFy: -10, aBx: -8, aBy: -4, lFx: 22, lFy: -6, lBx: -2, lBy: -12 });
const AK3 = P({ hy: -24, tl: -22, hd: 12, aFx: 0, aFy: -10, aBx: -9, aBy: -2, lFx: 23, lFy: -1, lBx: 0, lBy: -10 });
const SLAM_W = P({ hy: -24, tl: -8, hd: 6, aFx: 4, aFy: -20, aBx: -2, aBy: -19, lFx: 6, lFy: -10, lBx: -4, lBy: -8 });
const SLAM_H = P({ hy: -24, tl: 34, hd: -12, aFx: 15, aFy: 10, aBx: 10, aBy: 9, lFx: 4, lFy: -10, lBx: -7, lBy: -8 });
const BURST_W = P({ hy: -14, tl: 18, hd: -6, aFx: 2, aFy: 2, aBx: 4, aBy: 0, lFx: 10, lBx: -10 });
const BURST_H = P({ hy: -23, tl: -6, hd: 8, aFx: 14, aFy: -12, aBx: -10, aBy: -12, lFx: 12, lBx: -12 });

const r = (n: number, len: number): number[] => Array(len).fill(n);

const m = (name: string, label: string, dur: number[], keys: MotionData['keys'], loop = false): MotionData => ({
  name: `base/${name}`,
  label: `${label} (임시)`,
  dur,
  loop,
  keys,
});

/** 임시 공통 동작 */
export const TEMP_COMMON: MotionData[] = [
  m('run_f', '앞으로 뛰기', r(1, 14), [
    { at: 0, pose: RUN_A }, { at: 3.5, pose: RUN_B }, { at: 7, pose: RUN_C }, { at: 10.5, pose: RUN_D }, { at: 14, pose: RUN_A },
  ], true),
  m('run_b', '뒤로 뛰기', r(1, 14), [
    { at: 0, pose: BRUN_A }, { at: 3.5, pose: BRUN_B }, { at: 7, pose: BRUN_C }, { at: 10.5, pose: BRUN_B }, { at: 14, pose: BRUN_A },
  ], true),
  m('jump', '점프', r(2, 12), [{ at: 0, pose: SQ }, { at: 2, pose: UP }, { at: 7, pose: TK }, { at: 11, pose: TK }]),
  m('jump2', '2단 점프', r(2, 12), [{ at: 0, pose: TK }, { at: 3, pose: TUCK }, { at: 8, pose: TUCK, stop: true }, { at: 11, pose: TK }]),
  m('fall', '낙하', r(3, 12), [{ at: 0, pose: TK }, { at: 7, pose: FL }, { at: 11, pose: FL }]),
  m('land', '착지', r(1, 12), [{ at: 0, pose: FL }, { at: 2, pose: LANDED }, { at: 5, pose: LANDED, stop: true }, { at: 11, pose: STANCE }]),
  m('dash', '지상 대시', r(1, 12), [{ at: 0, pose: STANCE }, { at: 2, pose: DF }, { at: 8, pose: DF2 }, { at: 11, pose: STANCE }]),
  m('air_dash', '공중 대시', r(1, 12), [{ at: 0, pose: TK }, { at: 2, pose: ADASH }, { at: 8, pose: ADASH, stop: true }, { at: 11, pose: FL }]),
  m('guard', '방어', r(1, 12), [{ at: 0, pose: STANCE }, { at: 3, pose: GS }, { at: 11, pose: GS }]),
  m('guard_hit', '방어 막힘', r(1, 12), [{ at: 0, pose: GS_R }, { at: 5, pose: GS }, { at: 11, pose: GS }]),
  m('guard_crush', '가드 크러시', r(2, 12), [{ at: 0, pose: GS_R }, { at: 3, pose: CRUSH }, { at: 7, pose: CRUSH, stop: true }, { at: 11, pose: HS3 }]),
  m('hit_light', '약하게 맞음', r(1, 12), [{ at: 0, pose: HS }, { at: 2, pose: HS2 }, { at: 6, pose: HS3 }, { at: 11, pose: STANCE }]),
  m('hit_heavy', '세게 맞음', r(1, 12), [{ at: 0, pose: HS2 }, { at: 3, pose: HH }, { at: 6, pose: HH, stop: true }, { at: 11, pose: HS3 }]),
  m('hit_air', '공중에서 맞음', r(2, 12), [{ at: 0, pose: KD_A }, { at: 5, pose: KD_B }, { at: 11, pose: KD_A }]),
  m('knockdown', '다운', r(3, 14), [
    { at: 0, pose: KD_B }, { at: 5, pose: LIE }, { at: 7, pose: BNC }, { at: 9, pose: LIE }, { at: 13, pose: LIE },
  ]),
  m('getup', '기상', r(2, 14), [{ at: 0, pose: LIE }, { at: 4, pose: GU1 }, { at: 8, pose: { ...CROUCH, tl: 16 } }, { at: 13, pose: STANCE }]),
  m('tech', '낙법', r(1, 12), [{ at: 0, pose: KD_A }, { at: 3, pose: TUCK }, { at: 7, pose: TUCK, stop: true }, { at: 11, pose: FL }]),
  m('win', '승리', r(3, 14), [{ at: 0, pose: STANCE }, { at: 4, pose: W1 }, { at: 8, pose: W2 }, { at: 13, pose: W2 }]),
];

/** 임시 기본형 전용 동작 (평타 10개, 기술 A·B, 필살) */
export const TEMP_MOVES: MotionData[] = [
  m('atk1', '지상 1타', [1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1], [
    { at: 0, pose: STANCE }, { at: 3, pose: J_W }, { at: 4, pose: J_H }, { at: 6, pose: J_H, stop: true }, { at: 8, pose: J_R }, { at: 11, pose: STANCE },
  ]),
  m('atk2', '지상 2타', [1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1], [
    { at: 0, pose: STANCE }, { at: 3, pose: J_W }, { at: 4, pose: S_H }, { at: 6, pose: S_H, stop: true }, { at: 8, pose: J_R }, { at: 11, pose: STANCE },
  ]),
  m('atk3', '지상 3타', [1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1], [
    { at: 0, pose: STANCE }, { at: 3, pose: H_C }, { at: 5, pose: H_E }, { at: 7, pose: H_E, stop: true }, { at: 9, pose: H_R }, { at: 12, pose: STANCE },
  ]),
  m('atk4', '지상 4타', [1, 1, 1, 1, 2, 2, 1, 2, 2, 1, 1, 1, 2, 2], [
    { at: 0, pose: STANCE }, { at: 4, pose: BIG_W }, { at: 6, pose: BIG_H }, { at: 9, pose: BIG_H, stop: true }, { at: 11, pose: J_R }, { at: 13, pose: STANCE },
  ]),
  m('launcher', '띄우기', [1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2], [
    { at: 0, pose: STANCE }, { at: 3, pose: UPC_W }, { at: 4, pose: UPC_M }, { at: 6, pose: UPC_H }, { at: 8, pose: UPC_H, stop: true }, { at: 12, pose: STANCE },
  ]),
  m('sweep', '쓸기', [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2], [
    { at: 0, pose: STANCE }, { at: 3, pose: SW_W }, { at: 4, pose: SW_H }, { at: 7, pose: SW_H, stop: true }, { at: 10, pose: SW_R }, { at: 13, pose: STANCE },
  ]),
  m('air1', '공중 1타', [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1], [
    { at: 0, pose: TK }, { at: 2, pose: J_W }, { at: 3, pose: AJ }, { at: 5, pose: AJ, stop: true }, { at: 11, pose: TK },
  ]),
  m('air2', '공중 2타', [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1], [
    { at: 0, pose: TK }, { at: 2, pose: AK0 }, { at: 3, pose: AK }, { at: 5, pose: AK, stop: true }, { at: 11, pose: TK },
  ]),
  m('air3', '공중 3타', [1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 2], [
    { at: 0, pose: TK }, { at: 3, pose: AK0 }, { at: 4, pose: AK3 }, { at: 6, pose: AK3, stop: true }, { at: 12, pose: TK },
  ]),
  m('slam', '내려찍기', [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2], [
    { at: 0, pose: TK }, { at: 3, pose: SLAM_W }, { at: 5, pose: SLAM_H }, { at: 8, pose: SLAM_H, stop: true }, { at: 13, pose: FL },
  ]),
  m('skill_a', '기술 A: 돌진 찌르기', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2], [
    { at: 0, pose: STANCE }, { at: 2, pose: DF }, { at: 4, pose: BIG_H }, { at: 9, pose: BIG_H, stop: true }, { at: 13, pose: STANCE },
  ]),
  m('skill_b', '기술 B: 밀쳐내기', [1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 2], [
    { at: 0, pose: STANCE }, { at: 3, pose: BURST_W }, { at: 5, pose: BURST_H }, { at: 7, pose: BURST_H, stop: true }, { at: 12, pose: STANCE },
  ]),
  m('super', '필살: 큰 주먹', [2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3], [
    { at: 0, pose: STANCE }, { at: 4, pose: BIG_W }, { at: 6, pose: BIG_H }, { at: 9, pose: BIG_H, stop: true }, { at: 13, pose: STANCE },
  ]),
];
