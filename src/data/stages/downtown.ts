/**
 * 첫 구역 '도심 대로' 배치. 숫자 데이터만. x는 각 겹(레이어) 안의 좌표, y는 화면 좌표(바닥 160).
 * 겹마다 카메라 이동 대비 움직이는 비율(speed)이 다르다: 멀수록 느리다.
 */
export const DOWNTOWN = {
  width: 960,
  ground: 160,
  sun: { x: 236, y: 60, r: 16 },

  /** 먼 공장 지대: 톱니 지붕과 굴뚝, 매연 */
  factories: {
    speed: 0.2,
    base: 134,
    chimneys: [
      { x: 34, w: 5, top: 64 },
      { x: 46, w: 4, top: 74 },
      { x: 150, w: 6, top: 56 },
      { x: 262, w: 5, top: 68 },
      { x: 274, w: 4, top: 78 },
      { x: 378, w: 6, top: 60 },
      { x: 420, w: 4, top: 72 },
    ],
    seed: 7,
  },

  /** 먼 시가지 실루엣: 급수탑, 드문드문 켜진 창 */
  skyline: { speed: 0.35, base: 142, seed: 31 },

  /** 가운데 겹: 높은 벽돌 건물, 칠한 벽 간판, 감시탑 */
  mid: {
    speed: 0.6,
    base: 152,
    seed: 113,
    tower: { x: 404, top: 22 },
    wallSigns: [
      { building: 1, text: 'HOTEL' },
      { building: 4, text: 'TONIC' },
      { building: 8, text: 'COAL' },
    ],
  },

  /**
   * 앞 겹: 길가 건물. 1층 가게(차양·간판), 위층 창, 철제 비상계단, 선전 포스터.
   * 쇼윈도를 캐릭터가 부술 수 있도록 거리와 같은 속도(1)로 움직인다.
   */
  front: {
    speed: 1,
    buildings: [
      { w: 58, h: 72, shop: 'GARAGE', escape: false, poster: '' },
      { w: 14, h: 0, shop: '', escape: false, poster: '' }, // 골목
      { w: 66, h: 80, shop: 'COFFEE', escape: true, poster: 'OBEY' },
      { w: 52, h: 66, shop: 'BANK', escape: false, poster: '' },
      { w: 12, h: 0, shop: '', escape: false, poster: '' },
      { w: 70, h: 84, shop: 'MARKET', escape: true, poster: 'ORDER' },
      { w: 56, h: 70, shop: 'BARBER', escape: false, poster: 'WORK' },
      { w: 16, h: 0, shop: '', escape: false, poster: '' },
      { w: 62, h: 78, shop: 'DINER', escape: true, poster: '' },
      { w: 54, h: 68, shop: 'TAILOR', escape: false, poster: 'OBEY' },
      { w: 14, h: 0, shop: '', escape: false, poster: '' },
      { w: 68, h: 82, shop: 'HOTEL', escape: true, poster: 'UNITY' },
      { w: 60, h: 64, shop: 'PAWN', escape: false, poster: '' },
      { w: 66, h: 76, shop: 'SALOON', escape: true, poster: 'ORDER' },
    ],
    seed: 271,
  },

  /** 거리 (캐릭터와 같은 속도): 보도, 노면전차 선로, 부서지지 않는 소품 */
  street: {
    lamps: [70, 210, 350, 490, 630, 770, 910],
    props: [
      { kind: 'barricade', x: 0 },
      { kind: 'posterboard', x: 172, text: 'OBEY' },
      { kind: 'mailbox', x: 300 },
      { kind: 'posterboard', x: 452, text: 'ORDER' },
      { kind: 'barrel', x: 724 },
      { kind: 'mailbox', x: 838 },
      { kind: 'posterboard', x: 862, text: 'WORK' },
      { kind: 'barricade', x: 922 },
    ],
  },

  /**
   * 부서지는 물건 (게임 기획서 '부서지는 것' 표). x는 왼쪽 끝 px.
   * 가스등은 street.lamps 자리에, 쇼윈도는 길가 건물 1층마다 하나씩 생긴다.
   */
  breakables: {
    cars: [112, 664],
    hydrants: [260, 560],
    newsstands: [418],
    /** 내구도와 판정 상자 (발밑 기준 폭·높이, px) */
    car: { hp: 220, w: 46, h: 20 },
    lamp: { hp: 90, w: 8, h: 50 },
    glass: { hp: 50, h: 18 },
    newsstand: { hp: 120, w: 22, h: 24 },
    hydrant: { hp: 70, w: 7, h: 11 },
    /** 내구도가 이 % 아래로 내려가면 '망가짐' 모습 */
    damagedAt: 50,
    /** 세게 날아온 캐릭터가 부딪히면 한 번에 부서진다: 이 속도(px/틱) 이상일 때 */
    crashSpeed: 2.5,
    /** 부딪힌 쪽 추가 피해 */
    crashDamage: 50,
  },
} as const;
