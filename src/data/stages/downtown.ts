/**
 * 첫 구역 '도심 대로' 배치. 숫자 데이터만.
 * 맵은 2560×540px (화면 480×270의 가로 5.3배, 세로 2배). 바닥은 맵 아래에서 30px 위.
 * 겹(레이어)마다 카메라 이동 대비 움직이는 비율(speed)이 다르다: 멀수록 느리다 (가로·세로 모두).
 * 겹 안의 x는 그 겹의 좌표, 높이는 '바닥에서 위로 몇 px'로 적는다.
 * 축척: 캐릭터 키 52px ≈ 사람 한 명. 건물 한 층 36px, 1층 가게 64px.
 */
export const DOWNTOWN = {
  width: 2560,
  height: 540,
  /** 바닥: 맵(과 각 겹) 아래 끝에서 이만큼 위 */
  groundFromBottom: 30,

  sky: { speed: 0.05, sun: { x: 330, fromTop: 70, r: 28 } },

  /** 먼 공장 지대: 톱니 지붕과 굴뚝, 매연 */
  factories: { speed: 0.15, seed: 7, chimneyEvery: 70, chimneyMin: 140, chimneyMax: 230, blockMin: 40, blockMax: 90 },

  /** 먼 시가지 실루엣: 급수탑, 드문드문 켜진 창 */
  skyline: { speed: 0.3, seed: 31, min: 90, max: 210 },

  /** 가운데 겹: 고층 벽돌 건물(계단식 지붕), 칠한 벽 간판, 감시탑 */
  mid: {
    speed: 0.6,
    seed: 113,
    min: 150,
    max: 330,
    towers: [{ x: 520, h: 330 }, { x: 1180, h: 310 }],
    wallSigns: ['HOTEL', 'TONIC', 'COAL', 'RADIO', 'STEEL', 'CIGARS'],
  },

  /**
   * 앞 겹: 길가 건물 (캐릭터와 같은 속도). 1층 가게(차양·간판·쇼윈도), 위층 창, 철제 비상계단, 선전 포스터.
   * floors = 1층 가게 위로 몇 층. 순서대로 맵 끝까지 되풀이해서 놓는다. h가 0이면 골목.
   */
  front: {
    speed: 1,
    seed: 271,
    floorH: 36,
    shopH: 64,
    buildings: [
      { w: 118, floors: 3, shop: 'GARAGE', escape: false, poster: '' },
      { w: 26, floors: 0, shop: '', escape: false, poster: '' },
      { w: 132, floors: 4, shop: 'COFFEE', escape: true, poster: 'OBEY' },
      { w: 104, floors: 2, shop: 'BANK', escape: false, poster: '' },
      { w: 22, floors: 0, shop: '', escape: false, poster: '' },
      { w: 140, floors: 5, shop: 'MARKET', escape: true, poster: 'ORDER' },
      { w: 112, floors: 3, shop: 'BARBER', escape: false, poster: 'WORK' },
      { w: 30, floors: 0, shop: '', escape: false, poster: '' },
      { w: 126, floors: 4, shop: 'DINER', escape: true, poster: '' },
      { w: 108, floors: 2, shop: 'TAILOR', escape: false, poster: 'OBEY' },
      { w: 24, floors: 0, shop: '', escape: false, poster: '' },
      { w: 136, floors: 4, shop: 'HOTEL', escape: true, poster: 'UNITY' },
      { w: 120, floors: 2, shop: 'PAWN', escape: false, poster: '' },
      { w: 132, floors: 3, shop: 'SALOON', escape: true, poster: 'ORDER' },
      { w: 28, floors: 0, shop: '', escape: false, poster: '' },
      { w: 124, floors: 2, shop: 'THEATER', escape: false, poster: 'UNITY' },
      { w: 110, floors: 4, shop: 'RADIO', escape: true, poster: 'WORK' },
    ],
  },

  /** 거리 (캐릭터와 같은 속도): 보도, 노면전차 선로, 부서지지 않는 소품 */
  street: {
    sidewalk: 9,
    props: [
      { kind: 'barricade', x: 0 },
      { kind: 'posterboard', x: 236, text: 'OBEY' },
      { kind: 'mailbox', x: 520 },
      { kind: 'posterboard', x: 760, text: 'ORDER' },
      { kind: 'barrel', x: 1010 },
      { kind: 'mailbox', x: 1290 },
      { kind: 'posterboard', x: 1560, text: 'WORK' },
      { kind: 'barrel', x: 1830 },
      { kind: 'posterboard', x: 2120, text: 'UNITY' },
      { kind: 'mailbox', x: 2330 },
      { kind: 'barricade', x: 2490 },
    ],
  },

  /**
   * 부서지는 물건 (게임 기획서 '부서지는 것' 표). x는 왼쪽 끝 px.
   * 가스등은 lampEvery 간격으로, 쇼윈도는 길가 건물 1층마다 하나씩 생긴다.
   */
  breakables: {
    lampFirst: 100,
    lampEvery: 200,
    cars: [150, 610, 1100, 1660, 2210],
    hydrants: [420, 960, 1460, 2040],
    newsstands: [860, 1960],
    /** 내구도와 판정 상자 (발밑 기준 폭·높이, px) */
    car: { hp: 240, w: 78, h: 34 },
    lamp: { hp: 90, w: 10, h: 92 },
    glass: { hp: 50, h: 40 },
    newsstand: { hp: 130, w: 36, h: 46 },
    hydrant: { hp: 70, w: 10, h: 18 },
    /** 내구도가 이 % 아래로 내려가면 '망가짐' 모습 */
    damagedAt: 50,
    /** 세게 날아온 캐릭터가 부딪히면 한 번에 부서진다: 이 속도(px/틱) 이상일 때 */
    crashSpeed: 4,
    /** 부딪힌 쪽 추가 피해 */
    crashDamage: 50,
  },
} as const;
