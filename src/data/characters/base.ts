/**
 * 기본 스틱맨 능력치. 거리는 px, 속도는 px/틱, 가속은 px/틱². 시간은 틱.
 * sim이 불러올 때 1/256px 정수로 바꾼다.
 */
export const BASE_STATS = {
  hp: 1000,
  /** 좌우는 걷지 않고 뛴다 */
  runForward: 3.2,
  runBack: 2.4,
  /** 뛰기 그림 한 바퀴에 움직이는 거리 (앞, 뒤) */
  runCycle: 48,
  runBackCycle: 32,
  jumpSquat: 2,
  jumpVy: 5.6,
  jumpVx: 2.4,
  doubleJumpVy: 4.8,
  /** 띄우기를 맞히고 점프로 쫓아갈 때 */
  chaseJumpVy: 6.8,
  chaseJumpVx: 1.6,
  gravity: 0.34,
  maxFall: 7.5,
  airAccel: 0.12,
  airMaxVx: 2.4,
  /** 지상 대시: 순간이동식 돌진 */
  dashTicks: 12,
  dashMoveFrom: 1,
  dashMoveTo: 7,
  dashSpeed: 8,
  airDashTicks: 11,
  airDashMoveTo: 8,
  airDashSpeed: 6,
  landTicks: 3,
  /** 공중 공격 중 착지했을 때 */
  airAttackLandTicks: 5,
} as const;
