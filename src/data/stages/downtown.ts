/**
 * 첫 구역 '도심' 배치. 숫자 데이터만.
 * 맵은 3200×540px (화면 480×270의 가로 약 6.7배, 세로 2배). 바닥은 맵 아래에서 30px 위.
 * 구간 4개를 왼쪽부터 잇는다: 도로 → 철교 밑 → 광장 → 공장 앞. 싸움은 맵 가운데(1600)에서 시작한다.
 * 겹(레이어)은 6개이고, 카메라 이동 대비 움직이는 비율(speed)이 멀수록 작다 (가로·세로 모두):
 *   하늘 → 먼 실루엣(거대 굴뚝·철교) → 먼 도시 → 중간 건물 → 싸우는 거리(1) → 앞겹(카메라 앞을 스침)
 * 먼 겹일수록 매연 색을 디더링으로 덮어 흐리고 색이 빠지게 한다 (haze: 0~16).
 * 겹 안의 x는 그 겹의 좌표, 높이는 '바닥에서 위로 몇 px'로 적는다.
 * 축척: 캐릭터 키 52px ≈ 사람 한 명. 1층 가게 80px, 위층 한 층 56px (3층 192px ~ 6층 360px).
 */
export const DOWNTOWN = {
  width: 3200,
  height: 540,
  /** 바닥: 맵(과 각 겹) 아래 끝에서 이만큼 위 */
  groundFromBottom: 30,

  /** 구간 (월드 x). 건물·소품·앞겹이 구간마다 다르다 */
  sections: [
    { id: 'road', name: '도로', x0: 0, x1: 960 },
    { id: 'bridge', name: '철교 밑', x0: 960, x1: 1680 },
    { id: 'plaza', name: '광장', x0: 1680, x1: 2480 },
    { id: 'factory', name: '공장 앞', x0: 2480, x1: 3200 },
  ],

  sky: { speed: 0.03, moon: { x: 300, fromTop: 64, r: 22 } },

  /** 먼 실루엣: 거대 굴뚝(매연을 매 틱 그린다)과 먼 철교 */
  far: {
    speed: 0.12,
    haze: 10,
    seed: 7,
    chimneys: [
      { x: 60, w: 16, h: 236 }, { x: 150, w: 10, h: 196 }, { x: 330, w: 20, h: 262 },
      { x: 520, w: 12, h: 210 }, { x: 640, w: 18, h: 248 }, { x: 760, w: 10, h: 188 },
    ],
    /** 먼 철교: 바닥에서 높이 h에 걸친 트러스, 교각 간격 */
    bridge: { x0: 180, x1: 600, h: 120, pierEvery: 60 },
    blockMin: 30,
    blockMax: 80,
  },

  /** 먼 도시 실루엣: 급수탑, 드문드문 켜진 창 */
  skyline: { speed: 0.3, haze: 7, seed: 31, min: 70, max: 190 },

  /** 가운데 겹: 고층 벽돌 건물(계단식 지붕), 칠한 벽 간판, 감시탑(서치라이트). 공장 구간 뒤에는 공장 건물 */
  mid: {
    speed: 0.6,
    haze: 4,
    seed: 113,
    min: 110,
    max: 240,
    towers: [{ x: 560, h: 300 }, { x: 1180, h: 280 }, { x: 1880, h: 310 }],
    wallSigns: ['HOTEL', 'TONIC', 'COAL', 'RADIO', 'STEEL', 'CIGARS'],
  },

  /**
   * 싸우는 거리의 길가 건물 (캐릭터와 같은 속도). 구간마다 왼쪽부터 이어 놓는다.
   * kind: shop 상가(1층 가게·쇼윈도), flat 공동주택, warehouse 창고, hall 히어로 국 청사, wing 청사 날개, factory 공장.
   * 빈자리: alley 골목, lot 빈터(철망), open 광장(돌 난간), yard 공장 마당(철문). 빈자리는 부서지지 않고 뒤 겹이 보인다.
   * floors = 1층을 포함한 층수. 높이 = 1층 shopH + 위층 (floors-1) × floorH.
   */
  front: {
    speed: 1,
    seed: 271,
    floorH: 56,
    shopH: 80,
    road: [
      { kind: 'shop', w: 132, floors: 5, sign: 'COFFEE', escape: true, poster: 'OBEY' },
      { kind: 'alley', w: 24 },
      { kind: 'shop', w: 140, floors: 6, sign: 'MARKET', escape: true, poster: 'ORDER' },
      { kind: 'shop', w: 120, floors: 4, sign: 'BANK', escape: false, poster: '' },
      { kind: 'alley', w: 26 },
      { kind: 'flat', w: 128, floors: 5, sign: '', escape: true, poster: 'WORK' },
      { kind: 'shop', w: 112, floors: 4, sign: 'BARBER', escape: false, poster: '' },
      { kind: 'shop', w: 136, floors: 6, sign: 'HOTEL', escape: true, poster: 'UNITY' },
      { kind: 'alley', w: 22 },
      { kind: 'shop', w: 120, floors: 5, sign: 'DINER', escape: true, poster: '' },
    ],
    bridge: [
      { kind: 'warehouse', w: 150, floors: 4, sign: 'FREIGHT', escape: false, poster: '' },
      { kind: 'flat', w: 120, floors: 5, sign: '', escape: true, poster: 'OBEY' },
      { kind: 'lot', w: 60 },
      { kind: 'warehouse', w: 160, floors: 3, sign: 'STORAGE', escape: false, poster: 'ORDER' },
      { kind: 'shop', w: 120, floors: 4, sign: 'PAWN', escape: true, poster: '' },
      { kind: 'alley', w: 24 },
      { kind: 'shop', w: 86, floors: 3, sign: 'BAR', escape: false, poster: '' },
    ],
    plaza: [
      { kind: 'open', w: 150 },
      { kind: 'wing', w: 90, floors: 3, sign: '', escape: false, poster: '' },
      { kind: 'hall', w: 300, floors: 6, sign: 'HERO BUREAU', escape: false, poster: 'UNITY' },
      { kind: 'wing', w: 90, floors: 3, sign: '', escape: false, poster: '' },
      { kind: 'open', w: 170 },
    ],
    factory: [
      { kind: 'factory', w: 210, floors: 4, sign: 'IRON WORKS', escape: false, poster: '' },
      { kind: 'yard', w: 70 },
      { kind: 'factory', w: 230, floors: 3, sign: 'NO 7', escape: false, poster: 'WORK' },
      { kind: 'factory', w: 210, floors: 4, sign: 'STEEL CO', escape: false, poster: '' },
    ],
  },

  /** 고가 철교 (철교 밑 구간, 월드 좌표). 상판 아래 끝 높이, 상판 두께, 난간 트러스 높이, 뒤쪽 기둥 간격, 양 끝 돌 교각 폭 */
  bridge: { x0: 960, x1: 1680, deck: 236, deckH: 24, truss: 26, pillarEvery: 144, pillarW: 12, pierW: 28 },

  /** 노면전차 (렌더 전용): 선로 구간(월드 x), 가공선 높이, 한 번 지나가는 주기와 속도(px/틱), 처음 나오는 틱 */
  tram: { x0: 0, x1: 1680, wire: 104, every: 1500, speed: 3.2, first: 200, length: 156 },

  /** 거리 (캐릭터와 같은 속도): 보도, 노면전차 선로, 부서지지 않는 소품 */
  street: {
    sidewalk: 9,
    props: [
      { kind: 'barricade', x: 0 },
      { kind: 'posterboard', x: 236, text: 'OBEY' },
      { kind: 'mailbox', x: 520 },
      { kind: 'manhole', x: 380 },
      { kind: 'posterboard', x: 780, text: 'ORDER' },
      { kind: 'barrel', x: 1180 },
      { kind: 'manhole', x: 1340 },
      { kind: 'mailbox', x: 1610 },
      { kind: 'flagpole', x: 1840, text: '' },
      { kind: 'statue', x: 1730 },
      { kind: 'flagpole', x: 2296, text: '' },
      { kind: 'posterboard', x: 2420, text: 'WORK' },
      { kind: 'barrel', x: 2560 },
      { kind: 'crates', x: 2700 },
      { kind: 'barrel', x: 3000 },
      { kind: 'crates', x: 3060 },
      { kind: 'barricade', x: 3130 },
    ],
  },

  /**
   * 앞겹 (카메라 앞을 스치는 어두운 실루엣, 캐릭터 앞에 그린다). x는 '이 월드 x가 화면 가운데일 때 화면 가운데에 온다'.
   * kind: post 가로등 기둥, wire 늘어진 전선(다음 기둥까지), pillar 철교 기둥, pipe 공장 배관
   */
  fg: {
    speed: 1.5,
    items: [
      { kind: 'post', x: 200 }, { kind: 'wire', x: 200, to: 560 }, { kind: 'post', x: 560 }, { kind: 'wire', x: 560, to: 900 },
      { kind: 'post', x: 900 },
      { kind: 'pillar', x: 1100 }, { kind: 'pillar', x: 1400 }, { kind: 'pillar', x: 1640 },
      { kind: 'post', x: 1960 }, { kind: 'wire', x: 1960, to: 2400 }, { kind: 'post', x: 2400 },
      { kind: 'pipe', x: 2640, to: 2900 }, { kind: 'post', x: 2900 }, { kind: 'pipe', x: 3060, to: 3260 },
    ],
  },

  /**
   * 건물 파괴 (게임 기획서 '건물 파괴'). 길가 건물 정면을 chunk×chunk px 덩어리로 나눈다.
   * 내구도 hp에서 crackAt 이하면 금, holeAt 이하면 구멍, 0이면 뚫림. 무너지면 사라진다.
   */
  city: {
    chunk: 16,
    hp: 100,
    crackAt: 70,
    holeAt: 35,
    /** 센 타격(강타·기술·필살)이 맞은 자리 둘레 */
    hit: { radius: 12, amount: 35 },
    /** 날아가는 캐릭터: 이 속도(px/틱) 이상이면 몸이 지나간 덩어리를 깎는다. 깎는 양 = (속도 - min + 1) × per, 최대 max */
    fly: { minSpeed: 4, per: 8, max: 40 },
    /** 자동차 폭발 */
    explosion: { radius: 40, amount: 80 },
    /** 벽꽝: 정면에 박힌 자리, 추가 피해, 박혀 있는 틱 */
    wallsplat: { radius: 20, amount: 100, damage: 60, ticks: 40 },
    /**
     * 붕괴: 1층(아래 groundRows줄)에서 덩어리가 brokenPerColumn개 이상 뚫린 기둥이 minColumns개 이상 이어지면 그 위가 무너진다.
     * 한 번에 slowColumns줄 이상 무너질 때만 슬로모션 (옆 기둥이 따라 무너지는 것은 흔들림만)
     */
    collapse: { groundRows: 4, brokenPerColumn: 3, minColumns: 4, slowColumns: 3 },
    /** 무너질 때 게임 시간이 반 속도로 가는 틱 */
    slowTicks: 40,
  },

  /**
   * 부서지는 물건 (게임 기획서 '부서지는 것' 표). x는 왼쪽 끝 px (가스등은 기둥 가운데).
   * 쇼윈도는 상가(shop) 1층마다 하나씩 생긴다.
   */
  breakables: {
    lamps: [100, 300, 500, 700, 900, 1060, 1290, 1520, 1700, 1900, 2350, 2600, 2840, 3100],
    cars: [150, 610, 1210, 2336, 2860],
    hydrants: [420, 1450, 2000, 2760],
    newsstands: [860, 2240],
    /** 내구도와 판정 상자 (발밑 기준 폭·높이, px) */
    car: { hp: 240, w: 78, h: 34 },
    lamp: { hp: 90, w: 10, h: 92 },
    glass: { hp: 50, h: 50 },
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
