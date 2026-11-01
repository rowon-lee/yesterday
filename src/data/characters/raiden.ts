import { BASE_STATS } from './base';
import type { CharacterData } from './types';

/**
 * 라이덴 (캐릭터 기획서): 근접 러시, 속도 빠름, 체력 보통.
 * 움직임: MMA 파이터의 바운스 스텝. 가드를 올린 채 가볍게 뛰며 걷고, 대시는 붉은 잔상을 남기며 낮게 파고든다.
 * 점프는 힘있게 튀어오르고, 벽은 걸어차듯 딛는다.
 * 전용 동작은 하나씩 승인받아 motions에 더한다 (없는 자리는 기본 스틱맨 동작). 능력치는 동작을 만들며 정한다.
 */
export const RAIDEN: CharacterData = {
  id: 'raiden',
  label: '라이덴',
  stats: { ...BASE_STATS },
  motions: {
    idle: 'raiden/idle',
  },
};
