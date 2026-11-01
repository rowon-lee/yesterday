import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 이동 (캐릭터 기획서 '움직임': MMA 파이터의 바운스 스텝).
 */

// ---- 대기: 한 번 튈 때마다 내려앉음 → 웅크림 → 박참 → 떠오름 → 꼭대기 → 떨어짐 → 닿음 ----
/** 웅크림: 내려앉은 힘을 무릎으로 받아 더 낮아지고, 몸이 앞으로 숙고 턱이 내려가며 손이 1.5px 처진다 (몸이 앞으로 실림) */
const SQUASH_A = R({ hx: 0, hy: -17, tl: 18, hd: 11, aFx: 12.5, aFy: -2.5, aBx: 8, aBy: 1.5 });
/** 박참: 발끝으로 바닥을 밀며 몸이 솟기 시작한다 (발은 아직 바닥) */
const PUSH_A = R({ hx: 0.5, hy: -20.5, tl: 15, hd: 9, aFx: 13, aFy: -3, aBx: 8, aBy: 1 });
/** 꼭대기: 몸이 펴지며 엉덩이 5px 위, 두 발이 3px 떠서 몸 밑으로 조금 모이고, 손은 관성으로 1px 뜬다 */
const TOP_A = R({ hx: 0.5, hy: -24, tl: 12, hd: 6, aFx: 13, aFy: -5, aBx: 8, aBy: -1, lFx: 7.5, lFy: -3, lBx: -8.5, lBy: -3 });
/** 2번째 웅크림: 몸이 뒤로 실린다 */
const SQUASH_B = R({ hx: -1.5, hy: -17, tl: 17, hd: 10, aFx: 12.5, aFy: -2.5, aBx: 7.5, aBy: 1.5 });
const PUSH_B = R({ hx: -1.5, hy: -20.5, tl: 15, hd: 8, aFx: 13.5, aFy: -3.5, aBx: 7.5, aBy: 1 });
/** 2번째 꼭대기: 앞손을 2.5px 내밀어 한 번 까딱인다 */
const TOP_B = R({ hx: -1.5, hy: -24, tl: 13, hd: 6, aFx: 15.5, aFy: -5.5, aBx: 7.5, aBy: -1, lFx: 7.5, lFy: -3, lBx: -8.5, lBy: -3 });

/**
 * 대기: 가드를 올린 채 제자리에서 두 번 통통 튄다 (한 번은 몸이 앞, 한 번은 뒤로 실림).
 * 바닥에 닿는 순간은 짧게 웅크렸다 바로 박차고(2~3틱), 꼭대기에서 잠깐 떠 있다(6틱). 14프레임 42틱, 1초에 약 2.9번 튄다.
 */
export const RAIDEN_IDLE: MotionData = {
  name: 'raiden/idle',
  label: '라이덴 대기',
  loop: true,
  dur: [2, 3, 2, 3, 6, 3, 2, 2, 3, 2, 3, 6, 3, 2],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 1, pose: SQUASH_A },
    { at: 2, pose: PUSH_A },
    { at: 4, pose: TOP_A, stop: true },
    { at: 7, pose: R_STANCE, stop: true },
    { at: 8, pose: SQUASH_B },
    { at: 9, pose: PUSH_B },
    { at: 11, pose: TOP_B, stop: true },
    { at: 14, pose: R_STANCE },
  ],
};

// ---- 앞 걷기·뒤 걷기: 바운스 스텝 ----
/*
 * 기본 스틱맨처럼 다리를 엇갈려 뛰지 않고, 가드를 올린 채 두 발을 같이 띄워 통통 튀며 나아간다 (앞발은 늘 앞, 뒷발은 늘 뒤).
 * 한 바퀴 = 두 번 튐 (14프레임, 한 번에 7프레임). 프레임은 움직인 거리로 넘긴다 (sim: runCycle).
 * 한 번 튈 때: 닿음(0) → 박참(1, 두 발이 바닥을 민다) → 공중(2~6, 발이 몸 앞으로 돌아와 다음 착지를 준비).
 * 바닥에 닿아 있는 0~1번 사이에는 발이 몸이 움직인 만큼 뒤로 가서 바닥에서 미끄러지지 않는다.
 */
/** 앞 걷기 한 번에 나아가는 거리 (px). 한 바퀴(두 번 튐)는 그 두 배 = 라이덴 runCycle */
export const R_HOP_F = 42;
/** 뒤 걷기 한 번에 물러나는 거리 (px). 한 바퀴는 두 배 = runBackCycle */
export const R_HOP_B = 32;
/** 한 프레임에 움직이는 거리 */
const STEP_F = R_HOP_F / 7;
const STEP_B = R_HOP_B / 7;

/** 앞 걷기 닿는 순간: 두 발이 몸 앞쪽에 닿고 (다음 박참까지 몸이 지나갈 만큼), 무릎을 굽혀 받는다 */
const WF_LAND = R({ hx: 0.5, hy: -19.5, tl: 18, hd: 9, lFx: 11, lBx: -6 });
/** 박참: 몸이 지나가 두 발이 뒤로 (닿은 자리 그대로), 가장 낮게 웅크려 민다. 손은 처진다 */
const WF_PUSH = R({ hx: 1, hy: -18, tl: 20, hd: 10, aFy: -2.5, aBy: 1.5, lFx: 11 - STEP_F, lBx: -6 - STEP_F });
/** 공중 꼭대기 (1번째): 엉덩이 4.5px 위, 두 발 3px 떠서 몸 밑으로 돌아오는 중, 앞손을 1.5px 내밀어 까딱 */
const WF_TOP_A = R({ hx: 1, hy: -23.5, tl: 16, hd: 7, aFx: 14.5, aFy: -5, aBy: -1, lFx: 8, lFy: -3, lBx: -9, lBy: -3 });
/** 공중 꼭대기 (2번째): 손은 가드 그대로, 몸이 조금 더 숙는다 */
const WF_TOP_B = R({ hx: 1.5, hy: -23.5, tl: 18, hd: 8, aFx: 13, aFy: -5, aBy: -1, lFx: 8, lFy: -3, lBx: -9, lBy: -3 });

/** 뒤 걷기 닿는 순간: 두 발이 몸 뒤쪽에 닿는다. 몸은 조금 세우고 턱을 더 당긴다 */
const WB_LAND = R({ hx: -1, hy: -19.5, tl: 12, hd: 10, aFx: 12, aFy: -5, lFx: 6, lBx: -11 });
/** 박참: 몸이 물러나 두 발이 앞으로 (닿은 자리 그대로) */
const WB_PUSH = R({ hx: -1.5, hy: -18, tl: 13, hd: 11, aFx: 12, aFy: -3.5, aBy: 1.5, lFx: 6 + STEP_B, lBx: -11 + STEP_B });
/** 공중 꼭대기: 엉덩이 3.5px 위, 두 발 2px 뜸. 1번째는 앞손을 앞으로 내밀어 거리를 재고, 2번째는 가드를 단단히 */
const WB_TOP_A = R({ hx: -1.5, hy: -22.5, tl: 11, hd: 9, aFx: 14.5, aFy: -4.5, aBy: -1, lFx: 9, lFy: -2, lBx: -8, lBy: -2 });
const WB_TOP_B = R({ hx: -1.5, hy: -22.5, tl: 12, hd: 10, aFx: 12, aFy: -5.5, aBy: -1, lFx: 9, lFy: -2, lBx: -8, lBy: -2 });

/** 앞 걷기 (sim 자리 run_f): 바운스 스텝으로 나아감. 14프레임, 표시 틱은 라이덴 속도(3.2px/틱)로 한 바퀴 84px를 가는 시간 */
export const RAIDEN_WALK_F: MotionData = {
  name: 'raiden/walk_f',
  label: '라이덴 앞 걷기',
  loop: true,
  dur: [2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1],
  keys: [
    { at: 0, pose: WF_LAND },
    { at: 1, pose: WF_PUSH },
    { at: 4, pose: WF_TOP_A, stop: true },
    { at: 7, pose: WF_LAND },
    { at: 8, pose: WF_PUSH },
    { at: 11, pose: WF_TOP_B, stop: true },
    { at: 14, pose: WF_LAND },
  ],
};

/** 뒤 걷기 (sim 자리 run_b): 같은 바운스 스텝으로 물러남. 한 번에 32px, 몸을 세우고 턱을 당긴다. 표시 틱은 2.6px/틱으로 한 바퀴 64px를 가는 시간 */
export const RAIDEN_WALK_B: MotionData = {
  name: 'raiden/walk_b',
  label: '라이덴 뒤 걷기',
  loop: true,
  dur: [2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 2, 1, 2, 1],
  keys: [
    { at: 0, pose: WB_LAND },
    { at: 1, pose: WB_PUSH },
    { at: 4, pose: WB_TOP_A, stop: true },
    { at: 7, pose: WB_LAND },
    { at: 8, pose: WB_PUSH },
    { at: 11, pose: WB_TOP_B, stop: true },
    { at: 14, pose: WB_LAND },
  ],
};

export const RAIDEN_MOVE_MOTIONS: readonly MotionData[] = [RAIDEN_IDLE, RAIDEN_WALK_F, RAIDEN_WALK_B];
