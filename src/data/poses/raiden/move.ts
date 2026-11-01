import type { MotionData } from '../../../anim/motion';
import { R, R_STANCE } from './stance';

/*
 * 라이덴 이동 (캐릭터 기획서 '움직임': MMA 파이터의 바운스 스텝).
 */

/** 대기 1번째 튀어 오른 꼭대기: 몸이 앞으로 실리며 발이 1px 뜨고, 손은 몸을 따라 오르다 살짝 처진다 */
const IDLE_UP_A = R({ hx: 0.5, hy: -21.5, tl: 13, hd: 8, aFx: 13, aFy: -3, aBx: 8, aBy: 1, lFy: -1, lBy: -1 });
/** 대기 2번째 꼭대기: 몸이 뒤로 실리고 앞손이 한 번 까딱인다 (앞손을 조금 내밀었다 당김) */
const IDLE_UP_B = R({ hx: -1.5, hy: -21.5, tl: 14, hd: 7, aFx: 14.5, aFy: -4.5, aBx: 7.5, aBy: 0.5, lFy: -1, lBy: -1 });

/**
 * 대기: 가드를 올린 채 제자리에서 가볍게 두 번 튄다 (한 번은 몸이 앞, 한 번은 뒤로 실림).
 * 바닥에 닿는 순간은 짧고(2틱) 꼭대기에서 잠깐 머문다(5틱): 통통 튀는 리듬. 12프레임 44틱, 1초에 약 2.7번 튄다.
 */
export const RAIDEN_IDLE: MotionData = {
  name: 'raiden/idle',
  label: '라이덴 대기',
  loop: true,
  dur: [2, 3, 4, 5, 4, 4, 2, 3, 4, 5, 4, 4],
  keys: [
    { at: 0, pose: R_STANCE },
    { at: 3, pose: IDLE_UP_A },
    { at: 6, pose: R_STANCE },
    { at: 9, pose: IDLE_UP_B },
    { at: 12, pose: R_STANCE },
  ],
};

export const RAIDEN_MOVE_MOTIONS: readonly MotionData[] = [RAIDEN_IDLE];
