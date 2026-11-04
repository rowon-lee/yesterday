import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { aim, E, grip2 } from './stance';

/*
 * 에드워드 벽 기동 (캐릭터 기획서 '움직임': 벽은 묵직하게 딛는다). 오른쪽을 보는 기준.
 * 벽 붙기·벽 점프·벽 박차기 공격·벽 낙법은 벽을 등지고(벽 면은 발밑 기준점에서 뒤로 7px), 벽 달리기는 벽을 본다(벽 면 앞 7px).
 * 프레임 구간은 sim이 쓰는 기본형과 같다 (붙기 5번부터 되풀이, 달리기 11번부터 꼭대기 넘기).
 * 해머는 늘 앞손에 있다 (붙기·달리기는 어깨에 걸친 채, 박차기 공격은 두 손으로 내리친다).
 */

// ---- 벽 붙기 (벽은 뒤쪽 x = -7) ----
/** 등이 벽에 쿵 부딪힌다: 몸이 벽 쪽으로 젖혀지고 뒷손이 벽을 친다 (해머는 어깨에서 튄다) */
const CL_HIT = E({ hx: -1, hy: -24, tl: -6, hd: -10, aFx: 5, aFy: 4, aBx: -8, aBy: 1, lFx: 6, lFy: -4, lBx: -6, lBy: -6, wa: -160 });
/** 무게를 받아 깊게 웅크린다 (멈칫): 뒷발이 벽을 딛고 무릎이 접힌다 */
const CL_SQUASH = E({ hx: -2, hy: -19, tl: 18, hd: 10, aFx: 6, aFy: 6, aBx: -8, aBy: -2, lFx: 7, lFy: -1, lBx: -6, lBy: -9, wa: -150 });
/** 붙은 자세: 벽을 등지고 웅크려 뒷손·뒷발로 벽을 짚는다 */
const CL_HOLD = E({ hx: -2, hy: -21, tl: 14, hd: 6, aFx: 5.5, aFy: 6, aBx: -8, aBy: -5, lFx: 6, lFy: -1, lBx: -6, lBy: -11, wa: -152 });
/** 미끄러지며 뒷손이 벽을 긁어 내려간다 (무거워 빨리 미끄러진다) */
const CL_DRAG = E({ hx: -2, hy: -20.5, tl: 16, hd: 8, aFx: 5.5, aFy: 6.5, aBx: -8, aBy: 2, lFx: 6, lFy: 0, lBx: -6, lBy: -7, wa: -150 });
/** 뒷손을 다시 짚고 뒷발을 다시 딛는다 */
const CL_REGRIP = E({ hx: -2, hy: -22, tl: 12, hd: 5, aFx: 5.5, aFy: 5.5, aBx: -8, aBy: -8, lFx: 5, lFy: -2, lBx: -6, lBy: -13, wa: -154 });

/** 부딪힌 무게로 몸이 접힌다 (해머 머리는 늦게 어깨에 눌린다) */
const CL_HIT2 = E({ hx: -1.5, hy: -21.5, tl: 6, hd: 2, aFx: 5.5, aFy: 5, aBx: -8, aBy: -1, lFx: 6.5, lFy: -2, lBx: -6, lBy: -8, wa: -164 });
/** 미끄러지기 시작한다 */
const CL_SLIP = E({ hx: -2, hy: -20.8, tl: 15, hd: 7, aFx: 5.5, aFy: 6.2, aBx: -8, aBy: -2, lFx: 6, lFy: -0.5, lBx: -6, lBy: -9, wa: -152 });
/** 더 내려간다: 뒷손이 벽을 끝까지 긁는다 */
const CL_DRAG2 = E({ hx: -2, hy: -20, tl: 17, hd: 9, aFx: 5.5, aFy: 6.8, aBx: -8, aBy: 4, lFx: 6, lFy: 0, lBx: -6, lBy: -6, wa: -147 });
/** 다시 짚은 무게가 실리며 자리 잡는다 (해머 머리가 늦게 튄다) */
const CL_GRIP_SET = E({ hx: -2, hy: -21.4, tl: 13, hd: 5.5, aFx: 5.5, aFy: 5.8, aBx: -8, aBy: -6.5, lFx: 5.5, lFy: -1.5, lBx: -6, lBy: -12, wa: -158 });

/**
 * 벽 붙기 (2차 리워크): 1~4프레임 쿵 부딪혀(해머는 늦게 눌림) 웅크리고 붙음(한 번) →
 * 5~9프레임 미끄러지는 동안 되풀이: 미끄러지기 시작 → 긁으며 내려감 → 더 내려감 → 탁 다시 짚음 → 자리 잡음(해머가 늦게 튐).
 * 9프레임 36틱 (되풀이 시작 프레임은 모든 캐릭터 공통 WALL_CLING_LOOP_FROM 그대로)
 */
export const EDWARD_WALL_CLING: MotionData = {
  name: 'edward/wall_cling',
  label: '에드워드 벽 붙기',
  dur: [1, 2, 3, 3, 5, 8, 2, 3, 9],
  keys: [
    { at: 0, pose: CL_HIT },
    { at: 1, pose: CL_HIT2 },
    { at: 2, pose: CL_SQUASH, stop: true },
    { at: 3, pose: CL_HOLD },
    { at: 4, pose: CL_SLIP },
    { at: 5, pose: CL_DRAG },
    { at: 6, pose: CL_DRAG2, stop: true },
    { at: 7, pose: { ...CL_REGRIP, wa: -150 } },
    { at: 8, pose: CL_GRIP_SET },
  ],
};

// ---- 벽 점프 (벽은 뒤쪽) ----
/** 두 발로 벽을 쿵 차며 몸을 앞으로 던진다: 해머는 어깨 위에 눕고 뒷손은 뒤로 젖혀진다 */
const WJ_KICK = E({ hx: 3, hy: -20, tl: 34, hd: -14, aFx: 5, aFy: 4, aBx: -9, aBy: 2, lFx: -9, lFy: -9, lBx: -12, lBy: -3, wa: -128 });
/** 튕겨 나간다: 몸이 솟고 해머가 등 뒤로 기운다, 다리는 뒤에 끌린다 */
const WJ_LAUNCH = E({ hx: 2, hy: -24, tl: 20, hd: -12, aFx: 5, aFy: 3, aBx: -7, aBy: -2, lFx: -6, lFy: -7, lBx: -10, lBy: -3, wa: -140 });
/** 박차는 힘에 몸이 먼저 튀어 나간다 (해머는 아직 어깨 위에 누운 채) */
const WJ_KICK2 = E({ hx: 2.5, hy: -22, tl: 27, hd: -13, aFx: 5, aFy: 3.5, aBx: -8, aBy: 0, lFx: -7.5, lFy: -8, lBx: -11, lBy: -3, wa: -128 });
/** 솟는 동안 해머 머리가 뒤로 끌린다 */
const WJ_LAUNCH2 = E({ hx: 1.5, hy: -24.5, tl: 17, hd: -10, aFx: 5, aFy: 3.5, aBx: -6.5, aBy: -1, lFx: -4, lFy: -9, lBx: -8, lBy: -5, wa: -160 });
/** 무릎을 끌어당기며 해머를 어깨로 되돌린다 */
const WJ_TUCK = E({ hy: -25, tl: 10, hd: -2, aFx: 5, aFy: 4, aBx: -5, aBy: 4, lFx: 7, lFy: -13, lBx: -1, lBy: -11, wa: -140 });
/** 낙하 자세로 이어진다 */
const WJ_FALL = E({ hy: -24, tl: 3, hd: -2, aFx: 5, aFy: 5.5, aBx: -7, aBy: 2, lFx: 7, lFy: -5, lBx: -5, lBy: -4, wa: -150 });

/**
 * 벽 점프: 두 발로 벽을 차고(1~2프레임) → 해머를 치켜들며 솟고 → 무릎을 당겼다가 → 낙하 자세. 14프레임.
 * 해머 머리는 몸보다 늦다 (2차 리워크): 박차고 튀어 나가는 동안 뒤로 끌렸다가, 무릎을 당길 때 앞으로 지나치고, 낙하 자세에서 자리 잡는다
 */
export const EDWARD_WALL_JUMP: MotionData = {
  name: 'edward/wall_jump',
  label: '에드워드 벽 점프',
  dur: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: WJ_KICK },
    { at: 1, pose: WJ_KICK2 },
    { at: 2, pose: { ...WJ_LAUNCH, wa: -146 } },
    { at: 3, pose: WJ_LAUNCH2 },
    { at: 6, pose: { ...WJ_TUCK, wa: -150 } },
    { at: 7, pose: { ...WJ_TUCK, hy: -24.6, tl: 8, wa: -128 }, stop: true },
    { at: 13, pose: WJ_FALL },
  ],
};

// ---- 벽 달리기 (벽은 앞쪽 x = +7): 한 걸음씩 묵직하게 디뎌 오른다 ----
/** 대시에서 이어져 앞발을 벽에 쿵 딛는다 */
const WR_PLANT = E({ hx: 0, hy: -20, tl: 18, hd: -8, aFx: 5, aFy: 5, aBx: -6, aBy: 4, lFx: 6, lFy: -14, lBx: -6, lBy: -1, wa: -158 });
/** 앞발을 높이 딛고 뒷다리로 밀어 올린다 (뒷손은 균형) */
const WR_A = E({ hx: 0, hy: -24, tl: 12, hd: -14, aFx: 5, aFy: 5, aBx: -7, aBy: 2, lFx: 6, lFy: -22, lBx: 0, lBy: -4, wa: -156 });
/** 발을 바꿔 뒷발을 높이 딛는다 */
const WR_B = E({ hx: 0, hy: -24, tl: 12, hd: -14, aFx: 5, aFy: 5.5, aBx: -5, aBy: 6, lFx: 0, lFy: -4, lBx: 6, lBy: -22, wa: -152 });
/** 꼭대기 모서리를 뒷손으로 잡는다 (해머는 어깨에) */
const WR_GRAB = E({ hx: 0, hy: -24, tl: 4, hd: -20, aFx: 5, aFy: 4, aBx: 4, aBy: -17, lFx: 4, lFy: -8, lBx: 1, lBy: -2, wa: -150 });
/** 팔로 끌어올리며 무릎을 당긴다 */
const WR_PULL = E({ hx: 2, hy: -27, tl: 24, hd: -4, aFx: 5, aFy: 5, aBx: 4, aBy: 6, lFx: 6, lFy: -19, lBx: 3, lBy: -15, wa: -152 });
/** 팔로 한 번에 끌어올려 무릎이 윗면을 넘는다 (해머 머리는 늦게 끌려 처진다) */
const WR_HAUL = E({ hx: 3, hy: -25, tl: 22, hd: -3, aFx: 5, aFy: 5.5, aBx: 1, aBy: 6.5, lFx: 9, lFy: -14, lBx: -1, lBy: -8, wa: -168 });
/** 한 발을 윗면에 쿵 올리며 넘어간다 */
const WR_OVER = E({ hx: 3, hy: -22, tl: 18, hd: -2, aFx: 5, aFy: 6, aBx: -2, aBy: 7, lFx: 9, lFy: -12, lBx: -4, lBy: -4, wa: -150 });

/** 두 자세의 가운데 (걸음 사이 프레임: 두 발이 모두 벽에서 떨어져 있다) */
const mid = (a: Pose, b: Pose, wa: number): Pose => {
  const o: Record<string, number> = {};
  for (const k of Object.keys(a) as Array<keyof Pose>) o[k] = ((a[k] as number) + ((b[k] ?? a[k]) as number)) / 2;
  return { ...(o as unknown as Pose), wa };
};
/*
 * 걸음마다 (2차 리워크): 발을 바꿔 딛는 동안 몸이 먼저 올라가고 해머 머리는 아래로 처졌다가 (사이 프레임),
 * 발을 딛고 버틸 때 늦게 들썩인다
 */
const WR_AB = mid(WR_A, WR_B, -163);
const WR_BA = mid(WR_B, WR_A, -161);

/**
 * 벽 달리기 (2차 리워크): 1~10프레임 발을 번갈아 묵직하게 딛고 오름 (해머는 걸음보다 늦게 들썩임),
 * 11~14프레임 모서리를 잡고 한 번에 끌어올려 넘어감(해머 머리는 늦게 끌려 처졌다 튀어 오름). 14프레임 39틱 (꼭대기 넘기 시작 프레임은 모든 캐릭터 공통 WALL_RUN_TOP_FROM 그대로)
 */
export const EDWARD_WALL_RUN: MotionData = {
  name: 'edward/wall_run',
  label: '에드워드 벽 달리기',
  dur: [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: WR_PLANT },
    { at: 1, pose: { ...WR_A, wa: -150 }, stop: true },
    { at: 2, pose: WR_AB },
    { at: 3, pose: { ...WR_B, wa: -146 }, stop: true },
    { at: 4, pose: WR_BA },
    { at: 5, pose: { ...WR_A, wa: -148 }, stop: true },
    { at: 6, pose: WR_AB },
    { at: 7, pose: { ...WR_B, wa: -146 }, stop: true },
    { at: 8, pose: WR_BA },
    { at: 9, pose: { ...WR_A, wa: -148 } },
    { at: 10, pose: WR_GRAB },
    { at: 11, pose: WR_PULL, stop: true },
    { at: 12, pose: WR_HAUL },
    { at: 13, pose: { ...WR_OVER, wa: -144 } },
  ],
};

// ---- 벽 박차기 공격 (128×96. 벽은 뒤쪽): 벽을 박차고 아래 대각선으로 날아가며 해머를 내리친다 ----
/** 붙은 채 해머를 두 손으로 등 뒤로 감는다 (뒷발은 벽을 딛는다) */
const WK_COIL = grip2(E({ hx: -3, hy: -21, tl: 16, hd: 14, aFx: 2, aFy: -9, lFx: 3, lFy: -8, lBx: -6, lBy: -12, wa: -175 }));
/** 감기 끝 (멈칫): 더 깊이 웅크리며 해머를 등 뒤 아래로 한 번 더 끌어당긴다 (머리가 벽 쪽으로 처진다) */
const WK_SQUASH = grip2(E({ hx: -3, hy: -18.5, tl: 24, hd: 16, aFx: -1, aFy: -6, lFx: 2, lFy: -9, lBx: -6, lBy: -11, wa: -203 }));
/** 벽을 박차 튀어 나가며 두 손이 머리 위로 올라가고, 해머 머리는 머리 뒤 위로 크게 치켜 올라간다 (내리치기 직전의 감기) */
const WK_PUSH = aim(E({ hx: 3, hy: -21, tl: 10, hd: 4, lFx: 7, lFy: -12, lBx: -12, lBy: -9, wa: -150 }), -16, -72);
/** 두 손이 먼저 앞으로 끌려 내려오고, 해머 머리는 아직 머리 위에 처져 있다 */
const WK_SWING = aim(E({ hx: 2, hy: -20.5, tl: 18, hd: -2, lFx: 5.5, lFy: -10, lBx: -11, lBy: -7.5, wa: -100 }), 13, -77);
/** 내리친다: 두 팔을 앞아래로 뻗고 해머 머리가 앞 아래에 (몸은 앞으로 숙이고 다리는 뒤로) */
const WK_SMASH = grip2(E({ hx: 1, hy: -20, tl: 26, hd: -6, aFx: 14, aFy: 9, lFx: 4, lFy: -8, lBx: -10, lBy: -6, wa: 48 }));
/** 지나치기: 머리가 앞 아래로 한 번 더 쏠린다 */
const WK_OVER = grip2(E({ hx: 1.5, hy: -19.8, tl: 28, hd: -6, aFx: 15.5, aFy: 10, lFx: 3.5, lFy: -8.5, lBx: -10.5, lBy: -6, wa: 54 }));
/** 내리친 자세 그대로 날아간다 */
const WK_DIVE = grip2(E({ hx: 1, hy: -20, tl: 28, hd: -6, aFx: 14.5, aFy: 9.5, lFx: 3, lFy: -9, lBx: -11, lBy: -6, wa: 58 }));
/** 날아가는 끝: 해머가 조금 들린다 */
const WK_DIVE_END = grip2(E({ hx: 0, hy: -21, tl: 20, hd: -4, aFx: 13, aFy: 6, lFx: 5, lFy: -8, lBx: -9, lBy: -6, wa: 40 }));
/** 손이 먼저 해머를 거두며 몸을 세운다 (해머 머리는 아직 앞 아래) */
const WK_RETRACT: Pose = E({ hx: 0, hy: -23, tl: 6, hd: -2, aFx: 7, aFy: 1, aBx: -6, aBy: 3, lFx: 7, lFy: -8, lBx: -5, lBy: -6, wa: 10 });
/** 해머 머리가 늦게 어깨 쪽으로 넘어온다 */
const WK_RETRACT2: Pose = E({ hx: 0, hy: -23.5, tl: 4, hd: -2, aFx: 6, aFy: 3, aBx: -6, aBy: 3, lFx: 7, lFy: -8, lBx: -5, lBy: -6, wa: -125 });

/**
 * 벽 박차기 공격 (128×96, 2차 리워크): 1~2프레임 붙은 채 해머를 등 뒤 아래로 끌어당겨 감음(벽에 머묾) → 3프레임 박차고 나가며 해머를 머리 뒤 위로 치켜듦 →
 * 4프레임 손이 먼저 앞으로 내려오고 머리는 처짐 → 5~10프레임 해머를 앞아래로 내리친 채 날아감(7틱부터 판정, 6번은 머리가 한 번 더 쏠림) →
 * 11~14프레임 손이 먼저 거두고 머리가 늦게 넘어와 낙하 자세로. 14프레임 33틱 (공격 데이터 그대로: 박차기 5틱, 판정 7~23틱)
 */
export const EDWARD_WALL_KICK: MotionData = {
  name: 'edward/wall_kick',
  label: '에드워드 벽 박차기 공격',
  wide: true,
  dur: [2, 3, 1, 1, 2, 3, 3, 3, 3, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: WK_COIL },
    { at: 1, pose: WK_SQUASH, stop: true },
    { at: 2, pose: WK_PUSH },
    { at: 3, pose: WK_SWING },
    { at: 4, pose: WK_SMASH },
    { at: 5, pose: WK_OVER },
    { at: 6, pose: WK_DIVE },
    { at: 9, pose: WK_DIVE_END, stop: true },
    { at: 10, pose: WK_RETRACT },
    { at: 11, pose: WK_RETRACT2 },
    { at: 13, pose: WJ_FALL },
  ],
};

// ---- 벽 낙법 (벽꽝: 뒤쪽 정면에 박히는 순간. 정면을 박차고 뒤로 공중제비를 돌아 튕겨 나간다) ----
/** 정면에 부딪힌 순간: 몸이 젖혀지고 해머를 쥔 팔이 어깨 위로 들린다 */
const WT_HIT = E({ hx: -6, hy: -22, tl: -20, hd: -16, aFx: 4, aFy: -8, aBx: -9, aBy: -14, lFx: 10, lFy: 0, lBx: -7, lBy: 0, wa: -125 });
/** 무릎을 끌어당기며 해머를 등 뒤로 눕혀 끌어안는다 (낙법에서는 머리가 늦게 따라와 박찰 때 눕는다) */
const WT_PULL = E({ hx: -3, hy: -25, tl: -10, hd: 4, aFx: 6, aFy: 3, aBx: 3, aBy: 4, lFx: 7, lFy: -16, lBx: 2, lBy: -14, wa: -190 });
/** 두 발로 정면을 박찬다 */
const WT_PUSH = E({ hx: -2, hy: -27, tl: -14, hd: -8, aFx: 6, aFy: -2, aBx: -6, aBy: -12, lFx: 3, lFy: 0, lBx: -3, lBy: 1, wa: -194 });
/*
 * 뒤로 공중제비: 해머를 등 뒤로 눕혀 끌어안고 웅크린 몸을 엉덩이를 중심으로 통째로 돌린다 (해머도 몸과 같이 돈다: 몸 기준 뒤쪽).
 * 몸통 기울기 -60° → -150° → -240° → -320°
 */
const tuck = (tl: number, lF: [number, number], lB: [number, number], aF: [number, number], lag = 0): Pose =>
  E({ hx: -1, hy: -30, tl, hd: -8, aFx: aF[0], aFy: aF[1], aBx: aF[0] - 1, aBy: aF[1] + 3, lFx: lF[0], lFy: lF[1], lBx: lB[0], lBy: lB[1], wa: -180 + tl + lag });
/* 해머는 몸보다 늦게 돈다 (2차 리워크): 몸이 돌기 시작해도 머리는 뒤에 남았다가 따라잡고, 다 돌 무렵 한 번 지나친다 (lag: 무기 각도가 몸보다 덜 돈 만큼) */
const WT_FLIP1 = tuck(-60, [9, -34], [10, -27], [4, -6], 40);
const WT_FLIP2 = tuck(-150, [-7, -38], [0, -39], [-6, -4], 30);
const WT_FLIP3 = tuck(-240, [-11, -22], [-12, -29], [-4, 6], 40);
const WT_FLIP4 = tuck(-320, [3, -17], [-4, -17], [5, 5], -8);
/** 한 바퀴를 다 돌며 몸을 편다 (-372° = -12°) */
const WT_OPEN = E({ hx: 0, hy: -25, tl: -372, hd: 6, aFx: 7, aFy: -2, aBx: -9, aBy: -8, lFx: 7, lFy: -7, lBx: -6, lBy: -3, wa: -150 - 360 });
/** 낙하 자세 (한 바퀴 돈 각도로 적는다) */
const WT_FALL: Pose = { ...WJ_FALL, tl: WJ_FALL.tl - 360, wa: (WJ_FALL.wa ?? 0) - 360 };

/** 벽 낙법: 부딪힌 순간 → 웅크림 → 박참 → 4~10프레임 해머를 끌어안고 뒤로 한 바퀴 → 몸을 펴 낙하 자세로 */
export const EDWARD_WALL_TECH: MotionData = {
  name: 'edward/wall_tech',
  label: '에드워드 벽 낙법',
  dur: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],
  keys: [
    { at: 0, pose: WT_HIT },
    { at: 1, pose: { ...WT_PULL, wa: -150 } },
    { at: 2, pose: WT_PUSH },
    { at: 3, pose: WT_FLIP1 },
    { at: 5, pose: WT_FLIP2 },
    { at: 6, pose: WT_FLIP3 },
    { at: 8, pose: WT_FLIP4 },
    { at: 10, pose: WT_OPEN },
    { at: 12, pose: WT_FALL },
  ],
};

export const EDWARD_WALL_MOTIONS: readonly MotionData[] = [EDWARD_WALL_CLING, EDWARD_WALL_JUMP, EDWARD_WALL_RUN, EDWARD_WALL_KICK, EDWARD_WALL_TECH];
