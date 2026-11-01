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

export const RAIDEN_MOVE_MOTIONS: readonly MotionData[] = [RAIDEN_IDLE];
