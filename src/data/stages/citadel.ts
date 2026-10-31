/**
 * 대련 무대 '시타델 1구역' 배치. 숫자 데이터만.
 * 시타델은 뉴 샌디에이고 제1구역 한가운데 있는 히어로 총국 본부다. 대련은 성벽 안 도시 한 겹만 쓴다.
 * 맵은 3200×540px (화면 480×270의 가로 약 6.7배, 세로 2배). 바닥은 맵 아래에서 30px 위.
 * 구간 5개를 서쪽부터 잇는다: 해안 부두 → 극장·다이너 거리 → 시타델 광장 → 비상계단 아파트 → 시타델 공원.
 * 시작 위치는 광장 가운데 분수 양쪽.
 * 높이는 세 층: 지상, 중층(차양·비상계단·계단참), 옥상(지붕·테라스). 발판은 위에서 내려올 때만 서는 한 방향 발판이다.
 * 겹(레이어)은 6개이고, 카메라 이동 대비 움직이는 비율(speed)이 멀수록 작다 (가로·세로 모두):
 *   하늘과 바다 → 1구역 마천루 → 시타델 상층부 → 중간 건물 → 싸우는 거리(1) → 앞겹(카메라 앞을 스침)
 * 먼 겹일수록 매연 색을 디더링으로 덮어 흐리고 색이 빠지게 한다 (haze: 0~16).
 * 겹 안의 x는 그 겹의 좌표, 높이는 '바닥에서 위로 몇 px'로 적는다.
 * 축척: 캐릭터 키 52px ≈ 사람 한 명. 1층 80px, 위층 한 층 56px (3층 192px ~ 6층 360px).
 */
export const CITADEL = {
  width: 3200,
  height: 540,
  /** 바닥: 맵(과 각 겹) 아래 끝에서 이만큼 위 */
  groundFromBottom: 30,
  /** 맵 끝 벽: 서쪽 컨테이너 더미 앞면, 동쪽 철책 (캐릭터가 넘지 못하는 x) */
  walls: { left: 66, right: 3156 },

  /** 구간 (월드 x). 건물·소품·앞겹이 구간마다 다르다 */
  sections: [
    { id: 'pier', name: '해안 부두', x0: 0, x1: 400 },
    { id: 'theater', name: '극장·다이너 거리', x0: 400, x1: 1000 },
    { id: 'plaza', name: '시타델 광장', x0: 1000, x1: 2200 },
    { id: 'apartments', name: '비상계단 아파트', x0: 2200, x1: 2800 },
    { id: 'park', name: '시타델 공원', x0: 2800, x1: 3200 },
  ],

  /** 1. 하늘과 바다: 수평선(바닥에서 seaTop 위)부터 아래가 바다, 멀리 깜빡이는 등대 불빛 */
  sky: { speed: 0.03, moon: { x: 120, fromTop: 60, r: 20 }, seaTop: 96, farLight: { x: 58, every: 90 } },

  /** 2. 1구역 마천루 실루엣 (아르데코: 층층이 들어간 지붕, 첨탑). from 앞쪽은 바다 */
  far: { speed: 0.12, haze: 10, seed: 7, from: 200, min: 120, max: 250 },

  /** 3. 시타델 상층부: 광장 뒤로 솟은 거대한 탑과 성벽, 꼭대기 서치라이트 (x는 광장 가운데 월드 x) */
  keep: { speed: 0.3, haze: 6, worldX: 1600, w: 210, h: 270, wallW: 640, wallH: 110 },

  /** 4. 가운데 겹: 중간 건물. seaUntil 앞쪽(부두 뒤)은 비워 바다가 보이게, 공원 뒤는 나무 */
  mid: { speed: 0.6, haze: 4, seed: 113, min: 100, max: 220, seaUntil: 380, parkFrom: 2780 },

  /**
   * 5. 싸우는 거리의 부서지는 건물 (캐릭터와 같은 속도). 구간마다 x0부터 이어 놓고, 사이는 골목(alley)이다.
   * kind: shop 상가(1층 가게·쇼윈도·차양), theater 극장(전구 차양·세로 간판), diner 다이너(긴 창·간판), apartment 아파트(층마다 비상계단).
   * floors = 1층을 포함한 층수. 높이 = 1층 shopH + 위층 (floors-1) × floorH. sign은 가게 이름 (없으면 현관).
   * 부두·광장·공원은 부서지는 건물 없이 장치만 있다 (아래 pier·plaza·park).
   */
  front: {
    seed: 271,
    floorH: 56,
    shopH: 80,
    theater: {
      x0: 400,
      list: [
        { kind: 'shop', w: 110, floors: 4, sign: 'BAKERY', poster: 'OBEY' },
        { kind: 'theater', w: 170, floors: 5, sign: 'PALACE', poster: '' },
        { kind: 'alley', w: 22 },
        { kind: 'diner', w: 130, floors: 3, sign: 'DINER', poster: '' },
        { kind: 'shop', w: 110, floors: 5, sign: 'HOTEL', poster: 'ORDER' },
      ],
    },
    apartments: {
      x0: 2200,
      list: [
        { kind: 'apartment', w: 130, floors: 5, sign: 'LAUNDRY', poster: 'WORK' },
        { kind: 'alley', w: 24 },
        { kind: 'apartment', w: 140, floors: 6, sign: '', poster: 'UNITY' },
        { kind: 'apartment', w: 120, floors: 4, sign: 'GROCER', poster: '' },
        { kind: 'alley', w: 22 },
        { kind: 'apartment', w: 164, floors: 5, sign: 'RADIO', poster: 'OBEY' },
      ],
    },
  },

  /** 발판 높이: 가게 차양, 극장 차양, 비상계단 발판(층 바닥에서 위로), 발판 폭 */
  /** (점프 한 번이면 약 95px, 2단 점프까지 약 160px 오른다) */
  ledges: { awning: 76, marquee: 92, escapeW: 56, escapeAbove: 4 },

  /** 해안 부두: 서쪽 끝 컨테이너 더미(벽), 방파제 난간, 등대(중간 발코니·꼭대기 둘레가 발판, 꼭대기 서치라이트) */
  pier: {
    containers: { x0: 0, x1: 66, rows: 4 },
    railing: { x0: 66, x1: 400, h: 26 },
    lighthouse: { x: 150, w: 36, h: 226, gallery: 196, galleryW: 60, balcony: 92, balconyW: 52 },
    bollards: [124, 380],
  },

  /**
   * 시타델 광장: 본관(무너지지 않음), 정문 계단과 계단참(중층 발판), 정문 양옆 기둥탑(중간 테라스·꼭대기는 옥상 발판),
   * 정면 대형 간판, 지붕 서치라이트, 분수, 히어로 동상, 광장 입구 문기둥.
   */
  plaza: {
    keep: { x0: 1240, x1: 1960, h: 470, lights: [1330, 1870] },
    landing: { x0: 1496, x1: 1704, h: 88 },
    gate: { w: 80, h: 120 },
    towers: [{ x: 1440 }, { x: 1704 }],
    tower: { w: 56, h: 296, terrace: 200, terraceOver: 12 },
    sign: { text: 'CITADEL', sub: 'DISTRICT 1', h: 300 },
    fountain: { x: 1600, w: 128 },
    statue: { x: 1110 },
    gatePiers: [984, 2184],
  },

  /** 비상계단 아파트 옥상 전광판 (아파트 구간의 몇 번째 건물인지, 글씨) */
  billboard: { building: 3, w: 124, h: 44, text: 'THE CITADEL PROTECTS YOU   ' },

  /** 시타델 공원: 나무(가운데 x, 줄기 높이, 잎 반지름), 벤치, 동쪽 끝 철책 */
  park: {
    trees: [{ x: 2846, h: 90, r: 44 }, { x: 2950, h: 120, r: 58 }, { x: 3050, h: 100, r: 50 }, { x: 3124, h: 84, r: 40 }],
    benches: [2900, 3000, 3090],
    fence: { x0: 3156, h: 150 },
  },

  /** 노면전차 (렌더 전용): 선로 구간(월드 x, 양 끝은 컨테이너와 광장 문기둥에 가려진다), 가공선 높이, 주기, 속도(px/틱) */
  tram: { x0: 0, x1: 1000, wire: 104, every: 1500, speed: 3.2, first: 200, length: 156 },

  /** 거리 (캐릭터와 같은 속도): 보도, 부서지지 않는 소품 */
  street: {
    sidewalk: 9,
    props: [
      { kind: 'crates', x: 70 },
      { kind: 'posterboard', x: 404, text: 'OBEY' },
      { kind: 'mailbox', x: 620 },
      { kind: 'manhole', x: 740 },
      { kind: 'barrel', x: 960 },
      { kind: 'bench', x: 1180 },
      { kind: 'planter', x: 1236 },
      { kind: 'planter', x: 1964 },
      { kind: 'mailbox', x: 2560 },
      { kind: 'barrel', x: 2620 },
      { kind: 'manhole', x: 2700 },
    ],
  },

  /**
   * 6. 앞겹 (카메라 앞을 스치는 어두운 실루엣, 캐릭터 앞에 그린다). x는 '이 월드 x가 화면 가운데일 때 화면 가운데에 온다'.
   * kind: post 가로등 기둥, wire 늘어진 전선(다음 기둥까지), flag 깃대와 깃발
   */
  fg: {
    speed: 1.5,
    items: [
      { kind: 'post', x: 300 }, { kind: 'wire', x: 300, to: 640 }, { kind: 'post', x: 640 }, { kind: 'wire', x: 640, to: 920 },
      { kind: 'post', x: 920 },
      { kind: 'flag', x: 1180 }, { kind: 'flag', x: 2020 },
      { kind: 'post', x: 2380 }, { kind: 'wire', x: 2380, to: 2720 }, { kind: 'post', x: 2720 },
      { kind: 'post', x: 3020 },
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
   * 쇼윈도는 가게(상가·다이너·1층 가게가 있는 아파트) 1층마다 하나씩 생긴다.
   */
  breakables: {
    lamps: [116, 334, 474, 662, 884, 1062, 1290, 1910, 2128, 2262, 2512, 2742, 2880, 3080],
    cars: [208, 488, 796, 2036, 2400],
    hydrants: [300, 600, 1024, 2604],
    newsstands: [688, 1996],
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
