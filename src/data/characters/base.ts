/**
 * 기본 스틱맨 능력치. 거리는 px, 속도는 px/틱, 가속은 px/틱². 시간은 틱.
 * sim이 불러올 때 1/256px 정수로 바꾼다.
 */
export const BASE_STATS = {
  hp: 1000,
  walkForward: 1.4,
  walkBack: 1.0,
  /** 걷기 그림 한 바퀴에 걷는 거리 (앞, 뒤) */
  walkCycle: 28,
  walkBackCycle: 24,
  jumpSquat: 3,
  jumpVy: 4.6,
  jumpVx: 1.6,
  doubleJumpVy: 4.0,
  /** 띄우기를 맞히고 점프로 쫓아갈 때 */
  chaseJumpVy: 5.6,
  chaseJumpVx: 1.2,
  gravity: 0.24,
  maxFall: 6,
  airAccel: 0.08,
  airMaxVx: 1.6,
  /** 지상 대시: 순간이동식 돌진 */
  dashTicks: 14,
  dashMoveFrom: 2,
  dashMoveTo: 9,
  dashSpeed: 5.5,
  airDashTicks: 12,
  airDashMoveTo: 9,
  airDashSpeed: 4,
  landTicks: 5,
  /** 공중 공격 중 착지했을 때 */
  airAttackLandTicks: 7,
} as const;
