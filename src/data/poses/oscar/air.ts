import type { MotionData } from '../../../anim/motion';
import { O_STANCE, OR } from './stance';

/*
 * 오스카 점프·2단 점프·낙하·착지·지상 대시·공중 대시 (캐릭터 기획서 '움직임').
 * 동작은 작고 군더더기가 없다: 점프는 무릎만 살짝 굽혔다 가볍게 떠오르고, 손은 늘 칼자루와 뒷짐.
 * 2단 점프는 허공에 생긴 검영을 한 발로 밟고 뛴다 (발밑 검영은 렌더). 대시(월영)는 그림자처럼 순식간에 옮겨 간다.
 */

/** 점프 준비 (sim의 점프 준비 동안 이 프레임): 무릎만 굽혀 4px 내려앉는다. 등은 그대로 굽은 채 */
const J_SQUAT = OR({ hy: -18, tl: 16, hd: 12, lFx: 6, lBx: -6 });
/** 떠오른다: 몸을 곧게 펴고 두 발을 모아 아래로 늘어뜨린다 (발끝이 아래) */
const J_RISE = OR({ hy: -25, tl: 9, hd: 10, lFx: 2, lFy: -1, lBx: -2.5, lBy: 0 });
/** 솟는 동안: 앞무릎을 조금 들어 발을 모은다 */
const J_UP = OR({ hy: -25, tl: 11, hd: 11, lFx: 4, lFy: -5, lBx: -2, lBy: -2 });
/** 꼭대기 근처: 두 무릎을 가볍게 접어 몸 밑에 모은다 (웅크리지 않는다) */
const J_TOP = OR({ hy: -25, tl: 13, hd: 12, lFx: 5, lFy: -8, lBx: -1, lBy: -6 });

/** 점프: 1프레임 내려앉음 → 2~3프레임 곧게 떠오름 → 다리를 가볍게 접는다. 12프레임 × 2틱 */
export const OSCAR_JUMP: MotionData = {
  name: 'oscar/jump',
  label: '오스카 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_SQUAT },
    { at: 2, pose: J_RISE },
    { at: 5, pose: J_UP },
    { at: 9, pose: J_TOP, stop: true },
    { at: 11, pose: J_TOP },
  ],
};

// ---- 2단 점프: 허공의 검영을 한 발로 밟고 한 번 더 뛴다 ----
/** 앞발을 아래로 내려 발밑에 생긴 검영을 딛는다 (몸은 그대로) */
const J2_STEP = OR({ hy: -25, tl: 12, hd: 14, lFx: 3, lFy: 2, lBx: -3, lBy: -7 });
/** 딛은 발로 밀어 올린다: 앞다리를 쭉 펴 몸이 솟고, 뒷무릎은 들어 올린다 */
const J2_PUSH = OR({ hy: -27, tl: 8, hd: 9, lFx: 1, lFy: 0, lBx: 2, lBy: -11 });
/** 솟으며 다리를 모은다 */
const J2_RISE = OR({ hy: -26, tl: 10, hd: 10, lFx: 4, lFy: -6, lBx: -1, lBy: -7 });

/** 2단 점프: 앞발로 허공의 검영을 딛고(1~2프레임) → 밀어 올라(3~4프레임) → 다리를 모아 꼭대기로. 12프레임 × 2틱 */
export const OSCAR_JUMP2: MotionData = {
  name: 'oscar/jump2',
  label: '오스카 2단 점프',
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: J_TOP },
    { at: 1, pose: J2_STEP, stop: true },
    { at: 3, pose: J2_PUSH },
    { at: 6, pose: J2_RISE },
    { at: 10, pose: J_TOP, stop: true },
    { at: 11, pose: J_TOP },
  ],
};

/** 내려오며 다리를 편다 */
const F_OPEN = OR({ hy: -25, tl: 12, hd: 13, lFx: 4, lFy: -3, lBx: -3, lBy: -2 });
/** 빨리 떨어질 때: 두 발을 조금 벌려 내리고 무릎을 살짝 굽혀 착지 준비 (등은 굽은 그대로, 고개는 아래를 본다) */
const F_READY = OR({ hy: -24, tl: 14, hd: 16, lFx: 6, lFy: -1, lBx: -5, lBy: 0 });

/**
 * 낙하 (2차 리워크): 접은 다리(꼭대기에 오래 머문다) → 무릎이 살짝 풀림 → 다리가 한 번에 펴진다 → 발을 뻗어 땅을 찾음 →
 * 발을 벌려 착지 준비 → 빨리 떨어지면 무릎을 더 굽혀 내려앉을 채비. 6프레임 (떨어지는 속도로 프레임이 넘어간다: dur 합 36 그대로)
 */
export const OSCAR_FALL: MotionData = {
  name: 'oscar/fall',
  label: '오스카 낙하',
  dur: [8, 3, 4, 8, 7, 6],
  keys: [
    { at: 0, pose: J_TOP },
    { at: 1, pose: OR({ hy: -25, tl: 12.8, hd: 12.5, lFx: 4.8, lFy: -7, lBx: -1.5, lBy: -5 }) },
    { at: 2, pose: F_OPEN },
    { at: 3, pose: OR({ hy: -24.6, tl: 13, hd: 15, lFx: 5, lFy: -1.5, lBx: -4, lBy: -0.5 }) },
    { at: 4, pose: F_READY, stop: true },
    { at: 5, pose: OR({ hy: -23.4, tl: 15.5, hd: 17, lFx: 6.5, lFy: 0, lBx: -5.5, lBy: 0.5 }) },
  ],
};

/** 닿는 순간: 무릎으로 가볍게 받는다 (소리 없이) */
const L_TOUCH = OR({ hy: -20, tl: 16, hd: 14, lFx: 6, lBx: -5 });
/** 가장 낮게: 2px 더 내려앉고 고개가 숙는다 */
const L_LOW = OR({ hy: -18.3, tl: 18.5, hd: 16, lFx: 6, lBx: -5.5 });

/**
 * 착지 (2차 리워크): 닿음 → 무릎으로 받아 가장 낮게 (고개가 숙는다) → 일어나기 시작 → 고개를 들며 일어섬 → 기본자세.
 * 5프레임 (sim은 착지 길이를 프레임 수로 고르게 나눈다: 표시 틱은 뷰어·시트용. 키 4개를 12장 × 1틱으로 늘이던 것 대신)
 */
export const OSCAR_LAND: MotionData = {
  name: 'oscar/land',
  label: '오스카 착지',
  dur: [1, 2, 3, 3, 3],
  keys: [
    { at: 0, pose: L_TOUCH },
    { at: 1, pose: L_LOW, stop: true },
    { at: 2, pose: OR({ hy: -19.8, tl: 16.5, hd: 14.5, lFx: 6, lBx: -5.5 }) },
    { at: 3, pose: OR({ hy: -21.2, tl: 14.5, hd: 11 }) },
    { at: 4, pose: O_STANCE },
  ],
};

// ---- 지상 대시 (월영): 그림자처럼 순식간에 옮겨 간다. 몸을 낮게 숙여 미끄러지듯, 발은 거의 떼지 않는다 ----
/** 가라앉는다: 무릎을 굽혀 1프레임 사이 그림자 속으로 꺼지듯 */
const D_SINK = OR({ hy: -19, tl: 20, hd: 10, lFx: 6, lBx: -6 });
/** 미끄러진다: 몸을 깊이 숙여 앞으로 기울이고, 두 발은 모아 뒤로 끈다 (그림자 잔상은 렌더) */
const D_GLIDE = OR({ hx: 3, hy: -18, tl: 34, hd: 4, lFx: 4, lFy: 0, lBx: -10, lBy: -2 });
/** 나타나 멈춘다: 앞발로 바닥을 짚어 몸을 세운다 */
const D_STOP = OR({ hx: 1, hy: -20, tl: 20, hd: 10, lFx: 8, lBx: -6 });

/** 지상 대시 (월영): 가라앉음 → 2~6프레임 깊이 숙여 미끄러짐 → 앞발로 멈춰 세운다. 12프레임 × 1틱 */
export const OSCAR_DASH: MotionData = {
  name: 'oscar/dash',
  label: '오스카 대시 (월영)',
  dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  keys: [
    { at: 0, pose: D_SINK },
    { at: 1, pose: D_GLIDE },
    { at: 5, pose: D_GLIDE, stop: true },
    { at: 7, pose: D_STOP, stop: true },
    { at: 11, pose: O_STANCE },
  ],
};

/** 공중에서 몸을 앞으로 눕혀 그림자처럼 미끄러진다: 칼자루를 쥔 채, 두 다리는 모아 뒤로 */
const AD_GLIDE = OR({ hx: 2, hy: -24, tl: 52, hd: -8, lFx: -3, lFy: -6, lBx: -9, lBy: -9 });

/**
 * 공중 대시 (2차 리워크): 꼭대기 → 그림자 속으로 몸을 숙여 들어감 → 몸을 눕혀 미끄러짐 → 다리가 더 끌리며 길게 늘어짐 →
 * 몸을 일으켜 나옴 → 낙하 준비. 6프레임 (sim은 공중 대시 길이를 프레임 수로 고르게 나눈다. 같은 자세 7장 대신 프레임마다 다른 자세)
 */
export const OSCAR_AIR_DASH: MotionData = {
  name: 'oscar/air_dash',
  label: '오스카 공중 대시',
  dur: [1, 1, 3, 3, 2, 2],
  keys: [
    { at: 0, pose: J_TOP },
    { at: 1, pose: OR({ hx: 1, hy: -24.5, tl: 30, hd: 4, lFx: 1, lFy: -7, lBx: -5, lBy: -8 }) },
    { at: 2, pose: AD_GLIDE },
    { at: 3, pose: OR({ hx: 2.5, hy: -23.8, tl: 55, hd: -10, lFx: -5, lFy: -5, lBx: -11.5, lBy: -8 }) },
    { at: 4, pose: OR({ hx: 1.5, hy: -24.5, tl: 30, hd: 6, lFx: 2, lFy: -5, lBx: -5, lBy: -4 }) },
    { at: 5, pose: F_OPEN },
  ],
};

export const OSCAR_AIR_MOTIONS: readonly MotionData[] = [OSCAR_JUMP, OSCAR_JUMP2, OSCAR_FALL, OSCAR_LAND, OSCAR_DASH, OSCAR_AIR_DASH];
