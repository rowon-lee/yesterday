import type { FollowSpec } from '../../../anim/follow';
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

const motion = (name: string, label: string, dur: number[], keys: MotionData['keys'], limb: 'aF' | 'aB' = 'aF', smear = 3, follow?: FollowSpec): MotionData => ({
  name: `eunwoo/${name}`,
  label: `백은우 ${label}`,
  wide: true,
  smear: { frame: smear, limb, stretch: 1.4 },
  dur,
  keys,
  ...(follow ? { follow } : {}),
});
const K = (at: number, pose: Pose, stop = false) => ({ at, pose, stop });

/**
 * 연검 휘두르기 박자 (follow.ribbon.keys): 감는 동안 낭창하게(휘어짐이 늦게 전해짐) → 타격 프레임에 세게·곧게(끝이 마지막에 가장 빠르게 꺾여 뻗음)
 * → 지나치며 다시 풀려 S자로 출렁임. hit = 첫 판정 프레임
 */
const whip = (hit: number, o: { load?: number; snap?: number; relax?: number; curl?: number } = {}) => [
  { at: 0, stiff: 0.6, curl: 1 },
  { at: Math.max(0.5, hit - 2), stiff: o.load ?? 0.45, curl: 1 },
  // 스미어 프레임 동안 뻗기 시작해 첫 판정 프레임에는 이미 거의 다 뻗는다 (판정 두 프레임 모두 리본 끝까지)
  { at: hit - 1, stiff: (o.snap ?? 3.2) * 0.7, curl: (o.curl ?? 0.15) + 0.25 },
  { at: hit, stiff: o.snap ?? 3.2, curl: o.curl ?? 0.15 },
  { at: hit + 1, stiff: (o.snap ?? 3.2) * 0.8, curl: (o.curl ?? 0.15) + 0.1 },
  { at: hit + 2, stiff: o.relax ?? 0.9, curl: 0.8 },
  { at: hit + 4, stiff: 0.6, curl: 1 },
];

/*
 * 지상 평타 4연타 (11-2 2026-11-02): 공중 콤보처럼 몸이 계속 돌고 연검이 크게 원을 그린다. 연타로 이어지면 기본자세로 돌아가지 않는다:
 * 앞 타의 판정 바로 뒤 프레임(연타가 넘어가는 자리) 자세가 다음 타의 첫 프레임(감기 시작)이고, 연검 리본도 그 순간 모양에서 이어 받는다
 * (follow.from). 연타가 끊기면 그 뒤 프레임(지나치기·여운·복귀)이 보인다. 손잡이 방향은 포즈의 무기 각도(wa, 도)로 정한다.
 */

// ---- 1타: 손목 채찍 (가볍게 한 걸음, 칼날이 수평으로 앞으로 뻗고 끝이 꺾인다. 리치 60) ----
const A1_LOAD = E({ hx: -2, hy: -22, tl: 0, hd: 4, tw: -2, aFx: 2, aFy: 11, aBx: -5, aBy: 13, lFx: 8, lBx: -6, wa: 110 });
/** 감기 끝 (멈칫): 손을 엉덩이 뒤로 당겨 손목을 젖힌다 (칼날은 뒤아래로 늘어진다) */
const A1_COIL = E({ hx: -2.5, hy: -21.5, tl: -2, hd: 4, tw: -3, aFx: -2, aFy: 8, aBx: -4, aBy: 12, lFx: 9, lBx: -7, wa: 160 });
/** 가볍게 한 걸음 내디디며 손목을 앞으로 튕긴다 (스미어) */
const A1_SNAP = E({ hx: 1.5, hy: -20, tl: 12, hd: -2, tw: 3, aFx: 12, aFy: 0, aBx: -8, aBy: 9, lFx: 14, lBx: -9, wa: 40 });
/** 타격: 손을 가슴 앞으로 뻗어 칼날을 수평으로 쏘아 보낸다 (뒷팔은 뒤로 뻗어 균형) */
const A1_HIT = E({ hx: 2.5, hy: -19.5, tl: 14, hd: -4, tw: 3.5, aFx: 12.5, aFy: -3, aBx: -10, aBy: 7, lFx: 15, lBx: -10, wa: 0 });
const A1_HIT2 = E({ hx: 3, hy: -19.5, tl: 15, hd: -4, tw: 4, aFx: 13, aFy: -2, aBx: -10.5, aBy: 7, lFx: 15, lBx: -10, wa: 8 });
/** 지나치기 (2타로 넘어가는 자리): 손이 앞아래로 떨어지며 칼날이 출렁인다 */
const A1_OVER = E({ hx: 3, hy: -19.5, tl: 14, hd: -2, tw: 3, aFx: 11, aFy: 4, aBx: -9, aBy: 8, lFx: 15, lBx: -10, wa: 40 });
const A1_HOLD = E({ hx: 2.5, hy: -20, tl: 12, hd: 0, tw: 2, aFx: 10, aFy: 7, aBx: -8, aBy: 9, lFx: 15, lBx: -10, wa: 55 });
const A_BACK1 = (lf: number, lb: number, wa = 65) => E({ hx: 0.5, hy: -21.5, tl: 7, hd: 3, tw: 1, aFx: 8.5, aFy: 11, aBx: -7, aBy: 12, lFx: lf, lBx: lb, wa });
const A_BACK2 = E({ ...E_STANCE, hy: -22.5, tl: 4, wa: 75 });
/** 기본자세 (손잡이는 아래 앞으로) */
const ES = E({ wa: 80 });

/** 1타 손목 채찍: 감기(2~3) → 튕김(4) → 판정(5~6, 칼끝이 꺾여 뻗은 6프레임을 3틱) → 지나치기(7, 2타로) → 여운 → 복귀. 12프레임 21틱 */
export const EUNWOO_ATK1 = motion('flick', '1타 손목 채찍', [1, 1, 1, 1, 2, 3, 1, 2, 2, 2, 2, 2], [
  K(0, ES), K(1, A1_LOAD), K(2, A1_COIL, true), K(3, A1_SNAP), K(4, A1_HIT), K(5, A1_HIT2), K(6, A1_OVER),
  K(7, A1_HOLD, true), K(9, A_BACK1(13, -9)), K(10, A_BACK2), K(11, ES),
], 'aF', 3, { ribbon: { drive: 'wa', damp: 0.93, gravity: 0.6, keys: whip(4) }, wind: 0.2 });

// ---- 2타: 반 바퀴 돌아 등을 보이며 손등 베기 (칼날이 낮게 S자로 바닥을 쓸고 되돌아온다. 리치 56) ----
/** 반 바퀴: 칼 쥔 손이 몸 뒤로 넘어가고 어깨가 돌아 등이 보인다 (발을 모으며 돈다) */
const A2_TURN = E({ hx: 1, hy: -21, tl: 8, hd: 12, tw: -5, aFx: -9, aFy: 6, aBx: 6, aBy: 8, lFx: 9, lBx: -5, wa: 190 });
/** 감기 끝 (멈칫): 낮게 웅크려 칼 쥔 손을 뒤아래로 멀리, 칼날은 몸 뒤 바닥에 끌린다 */
const A2_WIND = E({ hx: 0, hy: -17.5, tl: 20, hd: 8, tw: -6, aFx: -13, aFy: 10, aBx: 7, aBy: 5, lFx: 11, lBx: -9, wa: 200 });
/** 손등으로 낮게 휘두르기 시작 (스미어): 손이 앞으로 쓸고 칼날은 뒤에서 끌려온다 */
const A2_SWEEP = E({ hx: 3, hy: -16, tl: 26, hd: 0, tw: 2, aFx: 6, aFy: 13, aBx: -8, aBy: 6, lFx: 17, lBx: -12, wa: 150 });
/** 타격: 낮게 앞으로 뻗은 손에서 칼날이 바닥을 쓸며 S자로 앞까지 */
const A2_HIT = E({ hx: 3, hy: -15.5, tl: 26, hd: -4, tw: 3, aFx: 12, aFy: 10, aBx: -11, aBy: 4, lFx: 18, lBx: -12, wa: 25 });
const A2_HIT2 = E({ hx: 3.5, hy: -15.5, tl: 26, hd: -4, tw: 3, aFx: 13, aFy: 8, aBx: -11, aBy: 4, lFx: 18, lBx: -12, wa: 10 });
/** 되돌아옴 (3타로 넘어가는 자리): 손이 떠오르며 칼날이 바닥에서 들려 되돌아온다 */
const A2_RISE = E({ hx: 3, hy: -17, tl: 20, hd: -4, tw: 2, aFx: 12, aFy: 2, aBx: -10, aBy: 5, lFx: 18, lBx: -12, wa: -40 });
const A2_HOLD = E({ hx: 3, hy: -18.5, tl: 16, hd: -2, tw: 2, aFx: 11, aFy: 5, aBx: -9, aBy: 7, lFx: 18, lBx: -12, wa: 20 });

/** 2타 반 바퀴 손등 베기: 12프레임 22틱 */
export const EUNWOO_ATK2 = motion('backhand', '2타 반 바퀴 손등 베기', [1, 2, 2, 1, 2, 3, 1, 2, 2, 2, 2, 2], [
  K(0, A1_OVER), K(1, A2_TURN), K(2, A2_WIND, true), K(3, A2_SWEEP), K(4, A2_HIT), K(5, A2_HIT2), K(6, A2_RISE),
  K(7, A2_HOLD, true), K(9, A_BACK1(15, -11, 50)), K(10, A_BACK2), K(11, ES),
], 'aF', 3, {
  ribbon: { drive: 'wa', damp: 0.92, gravity: 1.1, keys: whip(4, { load: 0.35, snap: 1.6, curl: 0.55 }) },
  wind: 0.3, from: { motion: 'eunwoo/flick', frame: 6 },
});

// ---- 3타: 피루엣 (발끝으로 한 바퀴 돌며 가운이 둥글게 펼쳐지고, 칼끝이 몸 둘레 반지름 약 40의 원을 그린다. 앞쪽 반원만 판정, 리치 44) ----
/** 손을 몸 둘레로 돌린다: θ 0 = 앞, 90 = 아래, 180 = 뒤, 270 = 위 (화면에서 시계 방향). 칼날은 손에서 바깥으로 */
const turnAt = (deg: number, o: Partial<Pose> = {}): Pose => {
  const r = (deg * Math.PI) / 180;
  return E({
    hx: 0.5, hy: -24, tl: 4, hd: 2, tw: 2, aFx: 12 * Math.cos(r), aFy: -1 + 12 * Math.sin(r), aBx: -10, aBy: -2,
    lFx: 3, lFy: -1, lBx: -3, lBy: 0, wa: deg, ...o,
  });
};
/** 발끝으로 올라서며 팔을 뒤로 펼친다 (회전 준비) */
const A3_RELEVE = turnAt(160, { hy: -23.5, tl: 10, hd: 6, aBx: 8, aBy: 4, lFx: 6, lBx: -5 });

/** 3타 피루엣: 칼끝이 뒤 → 위 → 앞(판정 5~6) → 아래로 한 바퀴. 12프레임 22틱 */
export const EUNWOO_ATK3 = motion('spin', '3타 피루엣', [1, 2, 2, 2, 2, 3, 1, 2, 2, 2, 2, 1], [
  K(0, A2_RISE), K(1, A3_RELEVE), K(2, turnAt(215, { lFx: 2, lFy: -9 })), K(3, turnAt(275, { lFx: 2, lFy: -10 })),
  K(4, turnAt(330, { lFx: 2, lFy: -10 })), K(5, turnAt(375, { lFx: 2, lFy: -9 })), K(6, turnAt(420, { lFx: 3, lFy: -6, tl: 8 })),
  K(7, E({ hx: 1, hy: -22.5, tl: 8, hd: 4, aFx: 9, aFy: 11, aBx: -9, aBy: 6, lFx: 8, lBx: -7, wa: 100 }), true),
  K(9, A_BACK1(10, -8, 85)), K(10, A_BACK2), K(11, ES),
], 'aF', 3, {
  ribbon: { drive: 'wa', damp: 0.94, gravity: 0.5, keys: whip(4, { load: 0.7, snap: 1.3, relax: 1.2, curl: 0.6 }), back: [2, 3] },
  wind: 0.3, from: { motion: 'eunwoo/backhand', frame: 6 },
  flare: [{ at: 0, v: 0 }, { at: 1, v: 0.4 }, { at: 3, v: 1 }, { at: 6, v: 1 }, { at: 8, v: 0.2 }, { at: 11, v: 0 }],
});

// ---- 4타: 작게 뛰어 돌며 위에서 아래로 큰 세로 S, 칼끝이 앞 바닥에 꽂힌다 (은빛 섬광·물보라, 리치 72) ----
/** 작게 뛰어오르며 몸을 돌린다: 칼 쥔 손이 뒤로 넘어가고 다리를 접는다 */
const A4_HOP = E({ hx: -1, hy: -27, tl: -6, hd: -6, tw: -3, aFx: -8, aFy: -4, aBx: 6, aBy: 4, lFx: 6, lFy: -7, lBx: -6, lBy: -5, wa: 200 });
/** 꼭대기 (멈칫): 등을 젖히고 칼 쥔 손을 머리 위로, 칼날이 뒤로 크게 늘어진다 */
const A4_TOP = E({ hx: -1.5, hy: -28, tl: -14, hd: -10, tw: -4, aFx: 1, aFy: -17, aBx: -6, aBy: 6, lFx: 7, lFy: -8, lBx: -7, lBy: -6, wa: 250 });
/** 내려오며 위에서 앞으로 내리친다 (스미어) */
const A4_SMEAR = E({ hx: 3, hy: -20, tl: 18, hd: -6, tw: 3, aFx: 13, aFy: -9, aBx: -10, aBy: 4, lFx: 18, lFy: -2, lBx: -12, lBy: -1, wa: 330 });
/** 타격: 깊이 내디뎌 앉으며 손을 앞아래로, 칼날이 위에서 바닥까지 큰 세로 S를 그리고 칼끝이 앞 바닥에 꽂힌다 */
const A4_HIT = E({ hx: 6, hy: -14, tl: 36, hd: -6, tw: 6, aFx: 15, aFy: 8, aBx: -13, aBy: 0, lFx: 24, lBx: -13, wa: 40 });
const A4_HIT2 = E({ hx: 6.5, hy: -13.8, tl: 37, hd: -6, tw: 6, aFx: 14, aFy: 10, aBx: -13, aBy: 0, lFx: 24, lBx: -13.5, wa: 55 });
const A4_OVER = E({ hx: 6.5, hy: -14, tl: 36, hd: -5, tw: 5, aFx: 12, aFy: 12, aBx: -13, aBy: 1, lFx: 24, lBx: -13.5, wa: 65 });
const A4_HOLD = E({ hx: 6, hy: -14.5, tl: 34, hd: -4, tw: 5, aFx: 11.5, aFy: 12, aBx: -12, aBy: 2, lFx: 24, lBx: -13, wa: 70 });

/** 4타: 작게 뛰어 돎(2~3) → 꼭대기(4, 멈칫) → 내리침(5) → 판정(6~7) → 꽂힌 채 여운 → 복귀. 13프레임 30틱 */
export const EUNWOO_ATK4 = motion('lash', '4타 뛰어 내리꽂기', [1, 2, 2, 3, 1, 2, 2, 2, 4, 4, 2, 2, 3], [
  K(0, turnAt(420, { lFx: 3, lFy: -6, tl: 8 })), K(1, A4_HOP), K(2, A4_TOP), K(3, A4_TOP, true), K(4, A4_SMEAR), K(5, A4_HIT), K(6, A4_HIT2),
  K(7, A4_OVER), K(8, A4_OVER, true), K(9, A4_HOLD), K(10, A_BACK1(18, -12, 70)), K(11, A_BACK2), K(12, ES),
], 'aF', 4, {
  ribbon: { drive: 'wa', damp: 0.93, gravity: 0.9, keys: whip(5, { load: 0.4, snap: 3.4 }) },
  wind: 0.3, from: { motion: 'eunwoo/spin', frame: 6 },
});

// ---- 띄우기: 올려 베기 (낮게 웅크려 칼을 바닥 가까이 두었다가, 솟구치며 아래에서 위로 크게) ----
const L_LOAD = E({ hx: 0, hy: -18, tl: 20, hd: -2, tw: -1, aFx: 6, aFy: 10, aBx: -6, aBy: 10, lFx: 11, lBx: -10 });
/** 감기 끝: 깊이 웅크려 칼 쥔 손을 앞 바닥 가까이 */
const L_COIL = E({ hx: 1, hy: -14.5, tl: 34, hd: -6, tw: -2, aFx: 2, aFy: 14, aBx: -9, aBy: 6, lFx: 14, lBx: -12 });
/** 솟구치기 시작: 낮은 손이 앞으로 쓸며 올라온다 (스미어) */
const L_LOW = E({ hx: 3, hy: -17, tl: 24, hd: -8, tw: 2, aFx: 13, aFy: 8, aBx: -10, aBy: 6, lFx: 16, lBx: -11 });
/** 타격: 칼 쥔 손이 가슴 앞을 지나 위로 (칼날이 앞에서 아래→위로 휩쓴다) */
const L_SMEAR = E({ hx: 4, hy: -20, tl: 12, hd: -10, tw: 3, aFx: 13, aFy: -6, aBx: -10, aBy: 6, lFx: 16, lBx: -10 });
/** 타격: 앞발로 솟구쳐 몸을 펴고 칼 쥔 팔을 머리 위로 끝까지 (뒷발은 들린다) */
const L_HIT = E({ hx: 6, hy: -24, tl: -6, hd: -16, tw: 5, aFx: 5, aFy: -17.2, aBx: -12, aBy: 2, lFx: 14, lBx: -12, lBy: -4 });
const L_HIT2 = E({ hx: 6.5, hy: -24.5, tl: -8, hd: -18, tw: 5.5, aFx: 1.5, aFy: -17.9, aBx: -12, aBy: 1, lFx: 14, lBx: -12, lBy: -5 });
const L_OVER = E({ hx: 6.5, hy: -24.5, tl: -10, hd: -18, tw: 5, aFx: -3, aFy: -17.5, aBx: -12, aBy: 1, lFx: 14, lBx: -12, lBy: -5 });
const L_HOLD = E({ hx: 6, hy: -24, tl: -8, hd: -16, tw: 4, aFx: -2, aFy: -17, aBx: -11, aBy: 2, lFx: 14, lBx: -12, lBy: -3 });

/** 띄우기 올려 베기: 12프레임 21틱 */
export const EUNWOO_LAUNCHER = motion('rise', '띄우기 올려 베기', [1, 1, 2, 1, 2, 1, 1, 3, 3, 2, 2, 2], [
  K(0, E_STANCE), K(1, L_LOAD), K(2, L_COIL, true), K(3, L_LOW), K(4, L_SMEAR), K(5, L_HIT), K(6, L_HIT2),
  K(7, L_OVER, true), K(8, L_HOLD), K(9, A_BACK1(14, -11)), K(10, A_BACK2), K(11, E_STANCE),
], 'aF', 3, { ribbon: { damp: 0.93, gravity: 0.7, keys: whip(4, { load: 0.5, snap: 2.4, curl: 0.3 }) }, wind: 0.3 });

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
], 'aF', 3, { ribbon: { damp: 0.92, gravity: 1.2, keys: whip(4, { snap: 2, curl: 0.4 }) }, wind: 0.4 });

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
], 'aF', 2, { ribbon: { damp: 0.93, gravity: 0.5, keys: [{ at: 0, wind: 0.8, stiff: 0.5 }, ...whip(3, { snap: 3.4, curl: 0.1 }).slice(1).map((k) => ({ ...k, wind: 0 }))] }, wind: 0.8 });

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
], 'aF', 2, { ribbon: { air: true, damp: 0.93, gravity: 0.4, keys: whip(3, { snap: 2.6, curl: 0.25 }) }, wind: 0.3 });

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
], 'aF', 2, { ribbon: { air: true, damp: 0.93, gravity: 0.4, keys: whip(3, { snap: 2.4, curl: 0.3 }) }, wind: 0.3 });

// ---- 공중 3타: 공중 회전 베기 (팔을 뻗은 채 몸을 한 바퀴 돌려 칼끝이 둘레에 원을 그린다) ----
const AA3_COIL = E({ hx: 0, hy: -24, tl: -10, hd: 4, tw: -3, aFx: -10, aFy: -6, aBx: 6, aBy: 4, lFx: 8, lFy: -10, lBx: -4, lBy: -8 });
/** 돌리는 몸: 무릎을 접고 칼 쥔 팔을 쭉 뻗는다 (이것을 통째로 돌린다) */
const AA3_SPIN = E({ hx: 0, hy: -24, tl: 0, hd: 0, tw: 4, aFx: 17.8, aFy: 2, aBx: -12, aBy: 4, lFx: 6, lFy: -8, lBx: -6, lBy: -8 });
const AA3_END = E({ ...AIR, tl: AIR.tl + 360 });

/** 공중 3타: 12프레임 21틱 (판정 5~6프레임, 몸이 한 바퀴) */
export const EUNWOO_AIR3 = motion('air_spin', '공중 3타 회전 베기', [1, 2, 1, 1, 2, 2, 1, 2, 3, 2, 2, 2], [
  K(0, AIR), K(1, AA3_COIL, true), K(2, spin(AA3_SPIN, 60)), K(3, spin(AA3_SPIN, 130)), K(4, spin(AA3_SPIN, 210)),
  K(5, spin(AA3_SPIN, 290)), K(6, spin(AA3_SPIN, 345)), K(8, AA3_END, true), K(11, AA3_END),
], 'aF', 3, { ribbon: { air: true, damp: 0.94, gravity: 0.3, keys: whip(4, { load: 0.8, snap: 2, curl: 0.4, relax: 1.2 }) }, wind: 0.5, flare: [{ at: 0, v: 0 }, { at: 2, v: 0.8 }, { at: 6, v: 0.8 }, { at: 9, v: 0 }] });

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
], 'aB', 4, { ribbon: { air: true, gravity: 0.5, stiff: 0.6 }, wind: 0.3 });

export const EUNWOO_ATTACK_MOTIONS: readonly MotionData[] = [
  EUNWOO_ATK1, EUNWOO_ATK2, EUNWOO_ATK3, EUNWOO_ATK4, EUNWOO_LAUNCHER, EUNWOO_SWEEP, EUNWOO_DASH_ATTACK,
  EUNWOO_AIR1, EUNWOO_AIR2, EUNWOO_AIR3, EUNWOO_SLAM,
];
