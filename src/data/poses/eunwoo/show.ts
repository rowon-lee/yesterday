import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { E, E_STANCE } from './stance';

/*
 * 백은우 등장·승리 (캐릭터 기획서 '등장 연출').
 * 등장 (11-3): 빛나는 흰 나비들이 나선 기둥으로 모였다가 흩어지면 은우가 걸어 나온다 (160틱, 경기 첫 라운드 시작 연출이 그만큼 길어진다).
 * 승리 (11-1): 은우는 사람을 죽이지 않는다 — 연검을 한 바퀴 감았다가 접어 넣고, 가운 깃을 바로잡는다.
 */

// ---- 등장 (11-3 2026-11-02, 160틱): 빛나는 흰 나비들이 모여 사람 키만 한 나선 기둥이 되고, 맥박치듯 빛난 뒤 위로 흩어지면
// 그 속에서 은우가 발끝으로 서너 걸음 걸어 나온다 (가운이 내려앉는다). 나비 두세 마리가 어깨를 돌다 빛 먼지로 흩어진다.
// 나비·기둥·빛은 렌더(render/chars/eunwoo.ts, vfx/eunwoo-intro.ts)가 sim의 등장 틱에 맞춰 그린다. 0~80틱은 몸을 감춘다.
// 기둥은 섰을 자리에서 30px 뒤에 서고, 동작이 몸을 그만큼 앞으로 옮긴다 (128×96 칸: 걸어 나오는 거리를 담으려고)
/** 나선 기둥이 서는 자리 (발밑 기준 x, 바라보는 쪽이 +) */
export const EUNWOO_INTRO_PILLAR = -30;
/** 등장 단계 (틱): 나비가 날아오기 시작, 기둥이 다 모임, 맥박, 흩어지며 걸어 나옴, 어깨의 나비 */
export const EUNWOO_INTRO_T = { fly: 20, pillar: 30, pulse: 70, reveal: 80, walked: 130, end: 160 } as const;

const P0 = EUNWOO_INTRO_PILLAR;
/** 나비 기둥 속에서 막 생겨난 모습: 발끝으로 서서 고개를 숙이고 팔을 살짝 벌린다 */
const IN_FORM = E({ hx: P0 - 1, hy: -24, tl: 2, hd: 16, aFx: 7, aFy: 11, aBx: -7, aBy: 11, lFx: P0 + 4, lFy: -1.5, lBx: P0 - 5, lBy: -1, wa: 90 });
/** 발끝 걸음 (k = 0..7): 엉덩이가 30px 앞으로 미끄러지듯, 발은 두 프레임마다 번갈아 디딘다 */
const STEP_FEET: ReadonlyArray<readonly [number, number, number, number]> = [
  [P0 + 6, -4, P0 - 5, -1], [P0 + 12, -1, P0 - 3, -2], [P0 + 12, -1, P0 + 4, -5], [P0 + 12, -2, P0 + 20, -1],
  [P0 + 26, -5, P0 + 21, -1], [P0 + 31, -1, P0 + 21, -2], [P0 + 33, -1, P0 + 26, -4], [6, -1, -4.5, 0],
];
const stepOut = (k: number): Pose => {
  const u = (k + 1) / 8;
  const x = P0 - 1 + (P0 * -1 - 0.5) * (u * u * (3 - 2 * u));
  const [lFx, lFy, lBx, lBy] = STEP_FEET[k]!;
  const sw = Math.sin((k / 2) * Math.PI);
  return E({ hx: x, hy: -23.6 + 0.4 * Math.abs(sw), tl: 6 - 3 * u, hd: 12 - 8 * u, aFx: 6 + 2 * sw, aFy: 12, aBx: -6 - 2 * sw, aBy: 12, lFx, lFy, lBx, lBy });
};
/** 어깨를 도는 나비를 바라보며 고개를 기울이고, 뒷손을 어깨 쪽으로 가볍게 든다 */
const IN_SHOULDER = E({ hy: -23.2, tl: 1, hd: 14, aBx: 4, aBy: -4 });

/**
 * 등장: 0프레임 80틱(나비가 날아와 기둥이 되고 맥박치는 동안 감춤) → 1~8프레임 걸어 나옴(80~128틱) → 9~13프레임 어깨의 나비를 바라봄·기본자세(128~160틱).
 * 14프레임 160틱 (128×96 칸)
 */
export const EUNWOO_INTRO: MotionData = {
  name: 'eunwoo/intro',
  label: '백은우 등장',
  wide: true,
  dur: [80, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8],
  keys: [
    { at: 0, pose: IN_FORM },
    { at: 1, pose: IN_FORM, stop: true },
    ...Array.from({ length: 8 }, (_, k) => ({ at: 2 + k, pose: stepOut(k) })),
    { at: 10, pose: IN_SHOULDER, stop: true },
    { at: 12, pose: IN_SHOULDER },
    { at: 13, pose: E_STANCE },
  ],
  // 기둥 속의 바람에 들렸던 가운이 걸어 나오며 내려앉는다
  follow: { ribbon: { hidden: [0], stiff: 0.6 }, flare: [{ at: 0, v: 1 }, { at: 1, v: 1 }, { at: 4, v: 0.3 }, { at: 8, v: 0 }], breeze: 0.6 },
};

// ---- 승리 (11-1): 연검을 한 바퀴 감았다가 접어 넣고, 가운 깃을 바로잡는다 ----
/** 몸을 곧게 세우며 연검 쥔 손으로 원을 그리기 시작한다 */
const W_SWIRL_A = E({ hx: -0.5, hy: -23.5, tl: 0, hd: 0, aFx: 10, aFy: 4, aBx: -4, aBy: 14, lFx: 5, lFy: 0, lBx: -4, lBy: 0 });
const W_SWIRL_B = E({ hx: -0.5, hy: -23.5, tl: -2, hd: -2, aFx: 6, aFy: -8, aBx: -4, aBy: 14, lFx: 5, lFy: 0, lBx: -4, lBy: 0 });
const W_SWIRL_C = E({ hx: -0.5, hy: -23.5, tl: 0, hd: 2, aFx: 1, aFy: 2, aBx: -4, aBy: 14, lFx: 5, lFy: 0, lBx: -4, lBy: 0 });
/** 감긴 연검을 접어 허리 칼집에 넣는다 */
const W_SHEATH = E({ hx: 0, hy: -23.5, tl: 4, hd: 6, aFx: -4, aFy: 13, aBx: -2, aBy: 13, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });
/** 두 손으로 가운 깃을 잡는다 */
const W_COLLAR = E({ hx: 0, hy: -23.5, tl: 2, hd: 10, aFx: 4, aFy: 1, aBx: 5, aBy: 0, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });
/** 깃을 아래로 당겨 바로잡는다 (어깨를 편다) */
const W_PULL = E({ hx: 0, hy: -23.8, tl: -1, hd: 4, aFx: 4, aFy: 4, aBx: 5, aBy: 3, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });
/** 손을 내리고 고개를 조금 기울인 채 선다 */
const W_REST = E({ hx: 0, hy: -23.5, tl: 1, hd: 9, aFx: 3, aFy: 15, aBx: -2, aBy: 15, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });

/** 고개를 조금 더 기울이며 숨을 내쉰다 (끝 자세) */
const W_REST2 = E({ hx: 0, hy: -23.2, tl: 2, hd: 13, aFx: 3, aFy: 15.5, aBx: -2, aBy: 15.5, lFx: 4, lFy: 0, lBx: -4, lBy: 0 });

/**
 * 승리 (2차 리워크): 연검을 한 바퀴 감음(1~4, 2틱씩 빠르게) → 접어 넣음(5~6, 멈칫) → 가운 깃을 잡아 바로잡음(7~10, 천천히, 멈칫)
 * → 손을 내리고 고개를 기울인 채 숨을 내쉼(11~13). 14프레임 × 3틱(고른 간격) → 13프레임 42틱 (끝 자세에 머문다)
 */
export const EUNWOO_WIN: MotionData = {
  name: 'eunwoo/win',
  label: '백은우 승리',
  dur: [3, 2, 2, 2, 2, 4, 3, 3, 2, 4, 3, 4, 8],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: W_SWIRL_A },
    { at: 2, pose: W_SWIRL_B },
    { at: 3, pose: W_SWIRL_C },
    { at: 5, pose: W_SHEATH, stop: true },
    { at: 7, pose: W_COLLAR },
    { at: 9, pose: W_PULL, stop: true },
    { at: 11, pose: W_REST },
    { at: 12, pose: W_REST2 },
  ],
  follow: { ribbon: { stiff: 0.5, damp: 0.9, hidden: [6, 7, 8, 9, 10, 11, 12] }, breeze: 0.6 },
};

export const EUNWOO_SHOW_MOTIONS: readonly MotionData[] = [EUNWOO_INTRO, EUNWOO_WIN];
