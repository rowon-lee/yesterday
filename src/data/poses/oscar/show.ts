import type { MotionData } from '../../../anim/motion';
import { O_STANCE, OD, OR } from './stance';

/*
 * 오스카 등장·승리 (캐릭터 기획서 13-6 '허공을 베고 나와서 납도').
 * 등장: 0~16틱 빈 자리 허공에 세로 베기 선 → 16~36 선이 좌우로 벌어져 날카로운 세로 틈 (폭 0 → 12px, 안은 달빛 어둠) →
 * 36~70 칼을 뽑아 든 채 틈에서 천천히 걸어 나온다 (굽은 노인의 걸음 세 걸음, 칼날에 달빛) → 70~80 뒤에서 틈이 선으로 닫힌다 →
 * 80~110 멈춰 서서 천천히 납도 ('탁' 1프레임 멈춤, 칼자루에 작은 은빛 반짝) → 칼자루에 손을 얹은 대기 자세.
 * sim 자리는 그대로이고, 그림 안에서 엉덩이가 틈(발밑 뒤 20px)에서 제자리까지 걸어 나온다. 선·틈·반짝임은 렌더 (render/chars/oscar.ts).
 * 처음 36틱은 몸을 감춘다 (틈이 열리는 동안). 칼집이 칸 밖으로 나가지 않게 128×96 칸.
 */

/** 틈 속: 칼을 뽑아 든 채 20px 뒤에 서 있다 */
const IN_SLIT = OD({ hx: -20, lFx: -14, lBx: -26 }, 14);
/** 세 걸음: 앞발이 나가고 뒷발이 끌려온다 (노인의 걸음) */
const W1_MID = OD({ hx: -17.5, hy: -22.4, lFx: -10, lFy: -2, lBx: -26 }, 14);
const W1 = OD({ hx: -15, lFx: -7, lBx: -21, lBy: -1 }, 14);
const W2_MID = OD({ hx: -10.5, hy: -22.4, lFx: -3, lFy: -2, lBx: -18 }, 14);
const W2 = OD({ hx: -8, lFx: 0, lBx: -14, lBy: -1 }, 14);
const W3_MID = OD({ hx: -3.5, hy: -22.4, lFx: 3, lFy: -2, lBx: -10 }, 14);
const W3 = OD({ hx: 0, lFx: 6, lBx: -6 }, 14);
/** 멈춰 서서 칼끝을 칼집 입구로 가져간다 (고개가 숙는다) */
const SH0 = OD({ hy: -21.8, tl: 14, hd: 13 }, 12);
/** 천천히 밀어 넣는다 */
const SH1 = OD({ hd: 14 }, 9);
const SH2 = OD({ hd: 15 }, 6.5);
/** 칼날 5px를 남기고 멈춘다 */
const SH3 = OD({ hy: -21.8, tl: 13.5, hd: 16 }, 5);
/** 1틱 긴장 (어깨가 조금 내려앉는다) */
const SH4 = OD({ hy: -21.5, tl: 14.5, hd: 16.5 }, 4.5);
/** '탁' — 칼자루가 칼집에 닿는다 (1프레임 멈춤, 100틱. 렌더가 101틱에 칼자루 반짝) */
const CLICK = OD({ hd: 17 }, 0);

/**
 * 등장 (2차 리워크): 틈 속 (36틱 숨김) → 세 걸음 (36~70) → 틈이 닫히는 동안 서 있음 (64~76) → 칼끝을 칼집 입구로 →
 * 천천히 납도 (81~95) → 칼날 5px를 남기고 멈춤 → 1틱 긴장 → 남은 칼날이 한 번에 미끄러져 들어가 '탁' (100틱) 멈춤 → 대기 자세. 14프레임 112틱
 * (같은 자세를 두 장씩 늘어놓던 서 있기·'탁'을 한 장으로)
 */
export const OSCAR_INTRO: MotionData = {
  name: 'oscar/intro',
  label: '오스카 등장',
  wide: true,
  dur: [36, 6, 5, 6, 5, 6, 12, 5, 7, 7, 4, 1, 5, 7],
  keys: [
    { at: 0, pose: IN_SLIT },
    { at: 1, pose: W1_MID },
    { at: 2, pose: W1 },
    { at: 3, pose: W2_MID },
    { at: 4, pose: W2 },
    { at: 5, pose: W3_MID },
    { at: 6, pose: W3, stop: true },
    { at: 7, pose: SH0 },
    { at: 8, pose: SH1 },
    { at: 9, pose: SH2 },
    { at: 10, pose: SH3, stop: true },
    { at: 11, pose: SH4 },
    { at: 12, pose: CLICK, stop: true },
    { at: 13, pose: O_STANCE },
  ],
};

/** 승리: 칼을 한 뼘 뽑아 칼날을 내려다보고 → 천천히 칼집에 밀어 넣어 '탁' → 고개를 숙였다 → 뒷짐을 진 채 꼿꼿이 선다. 14프레임 */
const WIN_DRAW = OD({ hd: 22, tl: 14, hy: -21.5 }, 12);
const WIN_HALF = OD({ hd: 20, tl: 14, hy: -21.5 }, 6);
const WIN_CLICK = OR({ hd: 22, tl: 17, hy: -21 });
const WIN_STAND = OR({ hd: 2, tl: 8, hy: -22.8 });

export const OSCAR_WIN: MotionData = {
  name: 'oscar/win',
  label: '오스카 승리',
  dur: [4, 4, 6, 8, 5, 5, 5, 5, 3, 8, 5, 5, 5, 6],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 2, pose: WIN_DRAW, stop: true },
    { at: 3, pose: WIN_DRAW },
    { at: 6, pose: WIN_HALF },
    { at: 8, pose: WIN_CLICK, stop: true },
    { at: 9, pose: WIN_CLICK },
    { at: 12, pose: WIN_STAND, stop: true },
    { at: 13, pose: WIN_STAND },
  ],
};

export const OSCAR_SHOW_MOTIONS: readonly MotionData[] = [OSCAR_INTRO, OSCAR_WIN];
