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
 * 축척 (아트 규칙): 캐릭터 키 52px ≈ 사람 한 명. 문 약 70px, 1층 110px(문 + 간판 띠), 위층 한 층 90px
 * (2층 200px ~ 5층 470px), 1960년대 자동차 길이 120px, 가로등 110px.
 */
export const CITADEL = {
  width: 6400,
  height: 540,
  /** 바닥: 맵(과 각 겹) 아래 끝에서 이만큼 위 */
  groundFromBottom: 30,
  /** 맵 끝 벽: 서쪽 공장 벽돌 담, 동쪽 1구역 성벽 (캐릭터가 넘지 못하는 x). h는 벽 높이 (벽 기동에 쓴다) */
  walls: { left: 56, right: 6344, leftH: 420, rightH: 440 },

  /** 구간 (월드 x). 건물·소품·앞겹이 구간마다 다르다 */
  sections: [
    { id: 'factory', name: '공장 지대', x0: 0, x1: 800 },
    { id: 'docks', name: '항만 창고 부두', x0: 800, x1: 1600 },
    { id: 'pier', name: '해안 부두', x0: 1600, x1: 2000 },
    { id: 'theater', name: '극장·다이너 거리', x0: 2000, x1: 2600 },
    { id: 'plaza', name: '시타델 광장', x0: 2600, x1: 3800 },
    { id: 'apartments', name: '비상계단 아파트', x0: 3800, x1: 4400 },
    { id: 'park', name: '시타델 공원', x0: 4400, x1: 4800 },
    { id: 'elrail', name: '고가 철도 밑', x0: 4800, x1: 5600 },
    { id: 'wall', name: '1구역 성벽 검문소', x0: 5600, x1: 6400 },
  ],

  /**
   * 구간마다 다른 밤 (렌더 전용, 카메라가 있는 구간의 값을 경계에서 섞어 쓴다). 색은 '#rrggbb'.
   * sky: 하늘 꼭대기(zenith)와 중간(mid), 지평선 빛 번짐(glow, 세기 glowK), 구름 어두운 면(cloud)과 도시 불빛을 받은 아랫면(cloudLit), 구름 양(cover 0~1)
   * fog: 안개 색, 바닥 안개(mist 0~1), 겹 사이 안개 배율(haze). ambient: 하늘 쪽·바닥 쪽 환경광
   * grade: 화면 색 보정 (그림자 쪽 색 shadow, 밝은 쪽 색 high, 채도 sat, 대비 contrast)
   * halo: 안개 속 빛 무리 세기, streak: 강한 빛의 가로 플레어 세기, lightning: 먼 번개 잦기 (0이면 없음)
   * ramps: 구간 팔레트 (render/palette.ts의 POST_FAMILIES 색 갈래 이름, 첫 갈래가 그 구간의 환경 어둠). 마지막 화면의 무대 칸은
   *   이 갈래들 안에서 밝기 계단(POST_LADDER)으로 줄이고, 캐릭터·이펙트 칸은 늘 쓰는 색(COMMON)으로 줄인다.
   *   구간 경계 양쪽 화면 반 칸(240px)은 두 구간 팔레트를 합친 완충 구간이다 (수직선으로 딱 잘리지 않게)
   */
  moods: {
    // 2026-11-02 그래픽 다듬기: 환경(안개·환경광)은 차갑게(남색·청록), 따뜻한 색은 빛(용광로·가로등·네온)에만. 하늘색은 그대로 두고 채도만 조금 낮춘다.
    // ramps는 구간마다 '환경 어둠(첫 갈래) + 무채색 + 빛 한두 가지'로 줄였다 (같은 밝기에서 색이 갈리는 갈래가 적을수록 빛 번짐이 한 갈래로 이어진다)
    factory: {
      sky: { zenith: '#0a0507', mid: '#1a0d0f', glow: '#963a1e', glowK: 1.05, cloud: '#120a0c', cloudLit: '#6a2a1a', cover: 0.75 },
      fog: { color: '#1e222c', mist: 0.5, haze: 1.25 },
      ambient: { sky: '#191d28', ground: '#06070a' },
      grade: { shadow: '#262a3c', high: '#ffb070', sat: 0.95, contrast: 0.2 },
      halo: 1.3, streak: 0.3, lightning: 0.2,
      ramps: ['navy', 'gray', 'steel', 'fire'],
    },
    docks: {
      sky: { zenith: '#05070c', mid: '#121418', glow: '#8a5a2a', glowK: 1.0, cloud: '#0c0e12', cloudLit: '#5a4024', cover: 0.6 },
      fog: { color: '#1e2632', mist: 0.6, haze: 1.35 },
      ambient: { sky: '#1a2230', ground: '#07080c' },
      grade: { shadow: '#1e4048', high: '#ffc070', sat: 0.95, contrast: 0.14 },
      halo: 1.4, streak: 0.25, lightning: 0.6,
      ramps: ['navy', 'gray', 'steel', 'taupe', 'amber', 'umber'],
    },
    pier: {
      sky: { zenith: '#05070d', mid: '#0d1621', glow: '#3e6a72', glowK: 0.9, cloud: '#0b1018', cloudLit: '#2c4a52', cover: 0.55 },
      fog: { color: '#22343e', mist: 0.55, haze: 1.3 },
      ambient: { sky: '#1a2a3a', ground: '#070b10' },
      grade: { shadow: '#2a5560', high: '#ffd9a8', sat: 1.0, contrast: 0.14 },
      halo: 1.1, streak: 0.25, lightning: 0.8,
      ramps: ['navy', 'gray', 'steel', 'teal', 'indigo', 'amber', 'umber'],
    },
    theater: {
      sky: { zenith: '#07050e', mid: '#160c1e', glow: '#7a2a5a', glowK: 1.0, cloud: '#120a16', cloudLit: '#5a2a4a', cover: 0.6 },
      fog: { color: '#2c2440', mist: 0.4, haze: 1.0 },
      ambient: { sky: '#1e1c36', ground: '#08070e' },
      grade: { shadow: '#1c3a5c', high: '#ffc0d8', sat: 1.0, contrast: 0.15 },
      halo: 1.2, streak: 0.3, lightning: 0.3,
      ramps: ['indigo', 'navy', 'gray', 'pinkfog', 'pink', 'amber', 'umber'],
    },
    plaza: {
      sky: { zenith: '#04060c', mid: '#0c1220', glow: '#4a5a7a', glowK: 0.8, cloud: '#0a0e18', cloudLit: '#3a4a66', cover: 0.65 },
      fog: { color: '#26324a', mist: 0.35, haze: 1.0 },
      ambient: { sky: '#1a2236', ground: '#06080e' },
      grade: { shadow: '#1e3050', high: '#e8f0ff', sat: 0.95, contrast: 0.2 },
      halo: 1.0, streak: 0.35, lightning: 0.5,
      ramps: ['navy', 'gray', 'steel', 'cyan', 'teal', 'amber', 'umber'],
    },
    apartments: {
      sky: { zenith: '#06050c', mid: '#140d16', glow: '#7a4228', glowK: 0.9, cloud: '#100a10', cloudLit: '#5a3020', cover: 0.6 },
      fog: { color: '#2a2636', mist: 0.4, haze: 1.0 },
      ambient: { sky: '#1e1a30', ground: '#08070c' },
      grade: { shadow: '#1a3452', high: '#ffcf9a', sat: 1.0, contrast: 0.15 },
      halo: 1.1, streak: 0.25, lightning: 0.3,
      ramps: ['indigo', 'navy', 'gray', 'pinkfog', 'pink', 'amber', 'umber'],
    },
    park: {
      sky: { zenith: '#04070a', mid: '#0a1414', glow: '#4a5a32', glowK: 0.7, cloud: '#081010', cloudLit: '#2e3a22', cover: 0.5 },
      fog: { color: '#22343a', mist: 0.7, haze: 1.4 },
      ambient: { sky: '#16222c', ground: '#060a0c' },
      grade: { shadow: '#1e4040', high: '#fff0b0', sat: 0.95, contrast: 0.12 },
      halo: 1.3, streak: 0.2, lightning: 0.4,
      ramps: ['pine', 'navy', 'gray', 'teal', 'fluo', 'amber', 'umber'],
    },
    elrail: {
      sky: { zenith: '#04080a', mid: '#0a1616', glow: '#2a6a5a', glowK: 0.8, cloud: '#081010', cloudLit: '#204a40', cover: 0.6 },
      fog: { color: '#1e3238', mist: 0.45, haze: 1.1 },
      ambient: { sky: '#142630', ground: '#05090c' },
      grade: { shadow: '#14403a', high: '#d8fff0', sat: 1.0, contrast: 0.18 },
      halo: 1.1, streak: 0.35, lightning: 0.3,
      ramps: ['pine', 'navy', 'gray', 'teal', 'fluo', 'amber', 'umber', 'pink'],
    },
    wall: {
      sky: { zenith: '#05060a', mid: '#10131a', glow: '#5a5e6a', glowK: 0.8, cloud: '#0c0e14', cloudLit: '#40444e', cover: 0.7 },
      fog: { color: '#262e3c', mist: 0.5, haze: 1.2 },
      ambient: { sky: '#1a1e2c', ground: '#06070a' },
      grade: { shadow: '#24304a', high: '#f0f4ff', sat: 0.85, contrast: 0.25 },
      halo: 1.2, streak: 0.4, lightning: 0.7,
      ramps: ['navy', 'gray', 'steel', 'amber', 'ember', 'umber'],
    },
  },

  /** 1. 하늘과 바다: 수평선(바닥에서 seaTop 위)부터 아래가 바다, 멀리 깜빡이는 등대 불빛 */
  sky: { speed: 0.03, moon: { x: 120, fromTop: 60, r: 20 }, seaTop: 96, farLight: { x: 58, every: 90 } },

  /** 2. 1구역 마천루 실루엣 (아르데코: 층층이 들어간 지붕, 첨탑). from 앞쪽은 바다 */
  far: {
    speed: 0.12, haze: 10, seed: 7, from: 392, min: 120, max: 250,
    /** 공장 매연: 공원 쪽 먼 하늘에 선 굴뚝 (먼 겹 x, 높이). 매연은 매 틱 그린다 */
    chimneys: [{ x: 704, w: 10, h: 176 }, { x: 732, w: 8, h: 150 }, { x: 778, w: 12, h: 196 }, { x: 812, w: 8, h: 160 }],
  },

  /**
   * 3. 시타델 탑 윗부분: 광장 뒤로 솟은 마천루 (x는 광장 가운데 월드 x). 층층이 들어간 몸통(w는 가운데 몸통 폭, h는 꼭대기 높이),
   * 빛나는 유리 왕관, 안테나(mast)와 경고등, 왕관 모서리 서치라이트. 둘레에 낮은 사무동(slabs: 탑 가운데에서 dx, 폭, 높이)
   */
  keep: {
    speed: 0.3, haze: 6, worldX: 3200, w: 200, h: 282, mast: 44,
    slabs: [{ dx: -330, w: 84, h: 150 }, { dx: -236, w: 96, h: 196 }, { dx: 142, w: 92, h: 182 }, { dx: 246, w: 80, h: 138 }],
  },

  /** 4. 가운데 겹: 중간 건물. seaUntil 앞쪽(부두 뒤)은 비워 바다가 보이게, 공원 뒤는 나무 */
  mid: { speed: 0.6, haze: 4, seed: 113, min: 100, max: 220, seaFrom: 780, seaUntil: 1980, parkFrom: 4380, parkUntil: 4820 },

  /**
   * 5. 싸우는 거리의 부서지는 건물 (캐릭터와 같은 속도). 구간마다 x0부터 이어 놓고, 사이는 골목(alley)이다.
   * kind: shop 상가(1층 가게·쇼윈도·차양), theater 극장(전구 차양·세로 간판), diner 다이너(긴 창·간판), apartment 아파트(층마다 비상계단).
   * floors = 1층을 포함한 층수. 높이 = 1층 shopH + 위층 (floors-1) × floorH. sign은 가게 이름 (없으면 현관).
   * 부두·광장·공원은 부서지는 건물 없이 장치만 있다 (아래 pier·plaza·park).
   */
  front: {
    seed: 271,
    floorH: 90,
    shopH: 110,
    /** 다이너는 2층(200px): 차양(76)에서 2단 점프(약 160)로 지붕에 오를 수 있게 */
    theater: {
      x0: 2000,
      list: [
        { kind: 'shop', w: 110, floors: 3, sign: 'BAKERY', poster: 'OBEY' },
        { kind: 'theater', w: 170, floors: 4, sign: 'PALACE', poster: '' },
        { kind: 'alley', w: 22 },
        { kind: 'diner', w: 130, floors: 2, sign: 'DINER', poster: '' },
        { kind: 'shop', w: 110, floors: 5, sign: 'HOTEL', poster: 'ORDER' },
      ],
    },
    apartments: {
      x0: 3800,
      list: [
        { kind: 'apartment', w: 130, floors: 4, sign: 'LAUNDRY', poster: 'WORK', posterLeft: true },
        { kind: 'alley', w: 24 },
        { kind: 'apartment', w: 140, floors: 5, sign: '', poster: 'UNITY' },
        { kind: 'apartment', w: 120, floors: 3, sign: 'GROCER', poster: '' },
        { kind: 'alley', w: 22 },
        { kind: 'apartment', w: 164, floors: 4, sign: 'RADIO', poster: 'OBEY' },
      ],
    },
  },

  /**
   * 발판 높이: 가게 차양, 극장 차양(과 전구 판 높이 marqueeH), 비상계단 발판(층 바닥에서 위로), 발판 폭,
   * 비상계단 난간 높이(rail)와 맨 아래 발판에서 접힌 사다리 끝까지(ladder). 비상계단 바깥 기둥은 사다리 끝부터 맨 위 난간까지 벽이다.
   * (점프 한 번이면 약 95px, 2단 점프까지 약 160px 오른다)
   */
  ledges: { awning: 76, marquee: 92, marqueeH: 22, escapeW: 56, escapeAbove: 4, rail: 12, ladder: 33 },

  /**
   * 해안 부두: 서쪽 끝 컨테이너 더미(벽), 방파제 난간, 등대(중간 발코니·꼭대기 둘레가 발판, 꼭대기 서치라이트).
   * 컨테이너 더미는 rows단 × rowH (윗면이 발판, 양옆이 벽: 맵이 넓어져 맵 끝 벽에서 구조물이 됐다).
   * 등대는 큰 물건: 내구도 hp, 무너지면 snap 높이에서 꺾여 바다 쪽으로 쓰러지고 밑동 윗면이 발판으로 남는다.
   */
  pier: {
    containers: { x0: 1600, x1: 1666, rows: 4, rowH: 28 },
    railing: { x0: 1666, x1: 2000, h: 26 },
    lighthouse: { x: 1750, w: 36, h: 226, gallery: 196, galleryW: 60, balcony: 92, balconyW: 52, hp: 450, snap: 120 },
    bollards: [1724, 1980],
  },

  /**
   * 시타델 광장: 본관(1960년대 마천루 아랫부분), 정문 계단과 계단참(중층 발판), 정문 양옆 콘크리트 기둥
   * (중간 테라스·꼭대기는 옥상 발판), 정면 대형 간판, 옥상 서치라이트, 분수, 히어로 동상, 광장 입구 문기둥.
   * 정면 대형 간판은 큰 물건: 판 x ~ x+w, 바닥에서 bottom ~ bottom+h. 무너지면 불꽃을 튀며 떨어져 분수에 기대 쓰러진다
   * (쓰러진 간판 윗변 높이 lyingH가 발판, 양 끝이 벽).
   * 본관 커튼월: 굵은 기둥 간격(pier), 유리 칸 폭(pane), 층 높이(floor), 로비 높이(lobby), 가운데 높은 유리 홀 꼭대기(atrium)
   */
  plaza: {
    keep: { x0: 2840, x1: 3560, h: 470, lights: [2930, 3470], pier: 90, pane: 15, floor: 26, lobby: 150, atrium: 236 },
    landing: { x0: 3096, x1: 3304, h: 88 },
    gate: { w: 80, h: 120 },
    towers: [{ x: 3040 }, { x: 3304 }],
    tower: { w: 56, h: 296, terrace: 200, terraceOver: 12 },
    sign: { text: 'CITADEL', sub: 'DISTRICT 1', x: 3128, w: 144, bottom: 274, h: 56, hp: 300, lyingH: 50 },
    fountain: { x: 3200, w: 128 },
    statue: { x: 2710 },
    gatePiers: [2584, 3784],
    /** 광장 동쪽 입구 검문소: 초소 왼쪽 끝, 폭과 높이 */
    checkpoint: { x: 3738, w: 38, h: 46 },
  },

  /**
   * 시타델 붕괴 (기획서 '시타델 붕괴'). 본관 내구도 hp. 단계 문턱 stages: 이 값 이하가 되면 1단계(금), 2단계(유리 깨짐·간판 떨어짐),
   * 3단계(외벽 갈라짐·불). 3단계에서는 1 아래로 내려가지 않아 필살기로만 무너진다.
   * 깎는 양 damage: 구역(본관 정면 앞, 기둥탑 포함) 안의 강한 타격(막히면 blocked), 기둥탑 벽꽝, 필살기(판정이 구역에 닿으면).
   * 무너지면 slow틱 슬로모션, settle틱 뒤 잔해 언덕이 다 쌓여 발판·벽이 된다.
   * 잔해 언덕 hill: 덩어리마다 x0 ~ x1, 윗면 높이 h (두 기둥탑 밑동이 가장 높다). 이웃보다 wallMin 이상 높은 옆면이 벽이다.
   */
  keepCollapse: {
    hp: 1000,
    stages: [700, 400, 150],
    damage: { heavy: 40, blocked: 20, splat: 120, super: 250 },
    slow: 50,
    settle: 120,
    wallMin: 20,
    hill: [
      { x0: 2780, x1: 2828, h: 24 },
      { x0: 2828, x1: 2884, h: 46 },
      { x0: 2884, x1: 2936, h: 72 },
      { x0: 2936, x1: 2984, h: 58 },
      { x0: 2984, x1: 3040, h: 96 },
      { x0: 3040, x1: 3096, h: 176 },
      { x0: 3096, x1: 3152, h: 112 },
      { x0: 3152, x1: 3204, h: 138 },
      { x0: 3204, x1: 3252, h: 100 },
      { x0: 3252, x1: 3304, h: 124 },
      { x0: 3304, x1: 3360, h: 168 },
      { x0: 3360, x1: 3416, h: 88 },
      { x0: 3416, x1: 3472, h: 108 },
      { x0: 3472, x1: 3524, h: 64 },
      { x0: 3524, x1: 3572, h: 40 },
      { x0: 3572, x1: 3620, h: 20 },
    ],
  },

  /**
   * 새 구간의 구조물 (공장 지대·항만 창고 부두·고가 철도 밑·1구역 성벽 검문소). 자리와 크기만, 모양은 렌더가 정한다.
   * blocks: 상자 (윗면이 발판, 옆면이 벽, 아래가 꽉 찬 윗면). decks: 판 (윗면만 발판). posts: 기둥 (옆면만 벽, 바닥에서 h0 ~ h).
   * 점프 한 번 약 95px, 2단 점프까지 약 160px, 벽 달리기 약 135px.
   */
  outskirts: {
    blocks: [
      // 공장 지대: 용광로 굴뚝 (꼭대기가 옥상), 저탄 탑
      { kind: 'stack', x0: 160, x1: 224, h: 286 },
      { kind: 'hopper', x0: 640, x1: 724, h: 196 },
      // 항만 창고 부두: 컨테이너 2단·3단 더미, 하역장
      { kind: 'crate2', x0: 1170, x1: 1232, h: 56 },
      { kind: 'crate3', x0: 1232, x1: 1294, h: 84 },
      { kind: 'dock', x0: 1380, x1: 1560, h: 40 },
      // 1구역 성벽 검문소: 초소, 모래주머니 벽
      { kind: 'booth', x0: 6080, x1: 6140, h: 58 },
      { kind: 'sandbags', x0: 6200, x1: 6262, h: 34 },
    ],
    decks: [
      // 공장: 굴뚝 둘레 작업대, 철제 통로
      { kind: 'ring', x0: 138, x1: 246, h: 140 },
      { kind: 'catwalk', x0: 330, x1: 600, h: 118 },
      // 항만: 갠트리 크레인 위 들보·아래 들보, 하역장 차양
      { kind: 'crane', x0: 880, x1: 1110, h: 236 },
      { kind: 'craneLow', x0: 900, x1: 1090, h: 120 },
      { kind: 'dockAwning', x0: 1396, x1: 1544, h: 112 },
      // 고가 철도: 선로 바닥, 역 계단참
      { kind: 'rail', x0: 4860, x1: 5540, h: 176 },
      { kind: 'stairs', x0: 5236, x1: 5316, h: 92 },
      // 성벽: 감시탑 초소 바닥과 지붕
      { kind: 'watch', x0: 5880, x1: 5980, h: 170 },
      { kind: 'watchRoof', x0: 5888, x1: 5972, h: 212 },
    ],
    posts: [
      // 철제 통로 기둥, 크레인 다리
      { kind: 'catwalkLeg', x: 330, w: 8, h0: 0, h: 118 }, { kind: 'catwalkLeg', x: 592, w: 8, h0: 0, h: 118 },
      { kind: 'craneLeg', x: 896, w: 14, h0: 0, h: 236 }, { kind: 'craneLeg', x: 1080, w: 14, h0: 0, h: 236 },
      // 고가 철도 기둥 (선로 아래)
      { kind: 'railLeg', x: 4880, w: 12, h0: 0, h: 176 }, { kind: 'railLeg', x: 5050, w: 12, h0: 0, h: 176 },
      { kind: 'railLeg', x: 5220, w: 12, h0: 0, h: 176 }, { kind: 'railLeg', x: 5390, w: 12, h0: 0, h: 176 },
      { kind: 'railLeg', x: 5520, w: 12, h0: 0, h: 176 },
      // 감시탑 다리와 초소 옆면
      { kind: 'watchLeg', x: 5884, w: 8, h0: 0, h: 170 }, { kind: 'watchLeg', x: 5968, w: 8, h0: 0, h: 170 },
      { kind: 'watchCabin', x: 5880, w: 100, h0: 170, h: 212 },
    ],
  },

  /** 비상계단 아파트 옥상 전광판 (아파트 구간의 몇 번째 건물인지, 글씨) */
  billboard: { building: 3, w: 124, h: 44, text: 'THE CITADEL PROTECTS YOU' },

  /** 시타델 공원: 나무(가운데 x, 줄기 높이, 잎 반지름), 벤치, 동쪽 끝 철책 */
  park: {
    /**
     * 나무 (렌더 전용): 줄기 높이 h, 잎 반지름 r. 나무마다 실루엣이 다르다 (지침서 '나무가 둥근 덩어리 반복' 고침):
     * poplar 좁고 키 큰 포플러, oak 옆으로 퍼진 울퉁불퉁한 참나무, bare 잎 진 마른 나무(가지만), young 어린 나무. 간격도 제각각
     */
    trees: [
      { x: 4440, h: 92, r: 30, kind: 'poplar' },
      { x: 4552, h: 104, r: 50, kind: 'oak' },
      { x: 4628, h: 88, r: 0, kind: 'bare' },
      { x: 4720, h: 66, r: 34, kind: 'young' },
    ],
    /** 벤치 (렌더 전용): 첫째에는 신문지를 덮고 잠든 사람, 둘째 옆에는 우산 쓴 사람 */
    benches: [4492, 4690],
    /** 공원의 주인공 (렌더 전용, 지침서 '낡은 분수'): 두 단 돌 분수와 그 위 등불. 가운데 x */
    fountain: { x: 4598 },
    fence: { x0: 4756, h: 150 },
  },

  /**
   * 노면전차: 선로 구간(월드 x, 양 끝은 컨테이너와 광장 문기둥에 가려진다), 가공선 높이, 주기(틱), 속도(px/틱), 첫 출발 틱, 길이.
   * 다니는 자리는 틱만으로 정해진다 (sim과 렌더가 같은 계산). 큰 물건: 판정 상자 높이 h, 내구도 hp.
   * 무너지면 탈선해 굴러 뒤집힌다 (뒤집힌 차체 높이 lyingH가 발판, 양 끝이 벽). 그 경기 동안 전차는 더 다니지 않는다.
   */
  tram: { x0: 1600, x1: 2600, wire: 104, every: 1500, speed: 3.2, first: 200, length: 156, h: 60, hp: 400, lyingH: 60 },

  /** 거리 (캐릭터와 같은 속도): 보도, 부서지지 않는 소품 */
  street: {
    sidewalk: 9,
    props: [
      { kind: 'barrel', x: 250 },
      { kind: 'crates', x: 612 },
      { kind: 'crates', x: 960 },
      { kind: 'barrel', x: 1330 },
      { kind: 'crates', x: 1670 },
      { kind: 'posterboard', x: 2004, text: 'WORK' },
      { kind: 'mailbox', x: 2220 },
      { kind: 'manhole', x: 2340 },
      { kind: 'barrel', x: 2560 },
      { kind: 'bench', x: 2780 },
      { kind: 'planter', x: 2836 },
      { kind: 'manhole', x: 2872 },
      { kind: 'planter', x: 3564 },
      { kind: 'mailbox', x: 4160 },
      { kind: 'barrel', x: 4220 },
      { kind: 'manhole', x: 4300 },
      { kind: 'manhole', x: 5100 },
      { kind: 'mailbox', x: 5450 },
      { kind: 'barrel', x: 5650 },
      { kind: 'crates', x: 6290 },
    ],
  },

  /**
   * 6. 앞겹 (카메라 앞을 스치는 어두운 실루엣, 캐릭터 앞에 그린다). x는 '이 월드 x가 화면 가운데일 때 화면 가운데에 온다'.
   * kind: post 가로등 기둥, wire 늘어진 전선(다음 기둥까지), flag 깃대와 깃발
   */
  fg: {
    speed: 1.5,
    items: [
      { kind: 'post', x: 200 }, { kind: 'wire', x: 200, to: 520 }, { kind: 'post', x: 520 },
      { kind: 'post', x: 1000 }, { kind: 'wire', x: 1000, to: 1300 }, { kind: 'post', x: 1300 },
      { kind: 'post', x: 1900 }, { kind: 'wire', x: 1900, to: 2240 }, { kind: 'post', x: 2240 }, { kind: 'wire', x: 2240, to: 2520 },
      { kind: 'post', x: 2520 },
      { kind: 'flag', x: 2780 }, { kind: 'flag', x: 3620 },
      { kind: 'post', x: 3980 }, { kind: 'wire', x: 3980, to: 4320 }, { kind: 'post', x: 4320 },
      { kind: 'post', x: 4620 },
      { kind: 'post', x: 5000 }, { kind: 'wire', x: 5000, to: 5300 }, { kind: 'post', x: 5300 },
      { kind: 'flag', x: 5760 }, { kind: 'flag', x: 6180 },
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
    /**
     * 무너진 자리의 잔해 더미: settle틱 동안 쌓인 뒤 윗면(가운데 top 비율)이 발판, 양옆이 벽이 된다.
     * 높이 = min(max, base + 건물 높이 / per)
     */
    rubble: { settle: 40, max: 60, base: 10, per: 6, top: 0.6 },
  },

  /**
   * 부서지는 물건 (게임 기획서 '부서지는 것' 표). x는 왼쪽 끝 px (가로등은 기둥 가운데).
   * 쇼윈도는 가게(상가·다이너·1층 가게가 있는 아파트) 1층마다 하나씩 생긴다.
   * 네온 간판은 건물에서 생긴다: 가게 이름 간판, 극장 세로 간판과 전구 차양, 다이너 간판, 호텔 세로 네온, 옥상 전광판.
   */
  breakables: {
    /** 꺼진 가로등과 깜빡이는 가로등 (렌더 전용: 지침서 '가로등 일부는 꺼져 있다'). 값은 lamps의 x */
    lampsDark: [452, 1716],
    lampsFlicker: [2262, 5492],
    lamps: [84, 318, 452, 760, 860, 1140, 1330, 1520, 1716, 1934, 2074, 2262, 2484, 2662, 2826, 3510, 3728, 3884, 4074, 4342, 4480, 4680, 4960, 5104, 5330, 5492, 5680, 5860, 6020, 6240],
    /** 차가 길어져(120) 가로등·소화전·가판대와 겹치지 않게 옮김 */
    cars: [380, 1420, 1808, 2082, 2344, 3600, 3980, 5000, 5380, 5720],
    hydrants: [560, 1110, 1952, 2240, 2624, 4204, 5170, 5990],
    newsstands: [2288, 3522, 5250],
    /** 내구도와 판정 상자 (발밑 기준 폭·높이, px). 자동차는 1960년대 세단 (길고 낮다) */
    car: { hp: 240, w: 120, h: 36 },
    /** 네온 간판·전광판 (건물에 붙어 있어 판정 상자는 간판 자리, 높이 77~360). 큰 간판은 big */
    neon: { hp: 60, big: 110 },
    lamp: { hp: 90, w: 10, h: 110 },
    glass: { hp: 50, h: 56 },
    newsstand: { hp: 130, w: 36, h: 46 },
    hydrant: { hp: 70, w: 10, h: 18 },
    /** 내구도가 이 % 아래로 내려가면 '망가짐' 모습 */
    damagedAt: 50,
    /** 세게 날아온 캐릭터가 부딪히면 한 번에 부서진다: 이 속도(px/틱) 이상일 때 */
    crashSpeed: 4,
    /** 부딪힌 쪽 추가 피해 */
    crashDamage: 50,
    /**
     * 큰 물건 (노면전차·급수탑·등대·시타델 간판. 전차·등대·간판의 자리와 내구도는 tram·pier·plaza에 있다).
     * 평타·기술로는 망가짐까지만 가고, 필살기가 닿거나 벽 쪽으로 날린 상대가 부딪히면 크게 무너진다.
     * 급수탑: 비상계단 아파트 구간 building번째 건물(식료품점) 지붕 위, 건물 왼쪽 끝에서 dx. 다리·통·지붕을 합친 높이 h (윗면이 발판).
     */
    watertower: { building: 2, dx: 16, w: 36, h: 54, hp: 300 },
    /** 무너진 큰 물건(뒤집힌 전차·쓰러진 간판)이 자리를 잡아 새 발판과 벽이 되기까지 틱 */
    settle: 36,
  },

  /**
   * 구조물 손상 (2026-11-02 파괴 범위 확대). 그동안 부서지지 않던 구조물(바깥 네 구간의 굴뚝·저탄 탑·크레인·컨테이너·하역장·
   * 고가 철도·감시탑·초소·모래주머니, 해안 부두 컨테이너 더미, 광장 문기둥·검문소·동상, 공원 철책 문기둥)과 거리 소품.
   * sim에는 단계(0 멀쩡 · 1 금 · 2 부분 파괴 · 3 무너짐/부서짐)와 부서진 틱·자리만 둔다. 판정에 영향을 주지 않는 장식이다:
   * 캐릭터를 막거나 느리게 하거나 피해를 주지 않고, 딛는 벽과 발판은 부서져도 그대로 남는다 (윗면·옆면은 뼈대가 받친다).
   * 내구도 hp, 단계 문턱 stages(내구도 % 이하: 1단계, 2단계, 0이면 3단계).
   * 크기 size: small 소품(평타로도 부서짐), mid 중간 구조물(평타는 2단계까지), big 큰 구조물(평타는 금까지, 센 타격은 부분 파괴까지,
   * 필살기·자동차 폭발·벽 쪽으로 날린 상대만 무너뜨림). 긴 구조물은 segment px마다 나눠 맞은 자리만 부서진다.
   * 깎는 양: 공격 판정이 닿으면 그 기술 피해 (기술 하나에 한 번), 센 타격이 맞은 자리 둘레 heavy, 세게 날아온 몸 fly,
   * 자동차 폭발 explosion, 필살기는 피해 × superMul.
   */
  wreck: {
    stages: [70, 35],
    segment: 180,
    heavy: { radius: 18, amount: 45 },
    fly: { minSpeed: 4, amount: 45, wallMul: 3 },
    explosion: { radius: 48, amount: 90 },
    superMul: 4,
    /** 필살기 연출 끝 타격의 충격파: 끝 자리 둘레 radius 안 구조물을 amount만큼 (가장자리는 절반) */
    superWave: { radius: 96, amount: 320 },
    /** 바깥 네 구간 구조물: 재질, 크기, 내구도, 판정 높이 (outskirts의 kind 이름별. 판은 윗면 아래 depth px까지) */
    outskirts: {
      stack: { mat: 'brick', size: 'big', hp: 900 },
      hopper: { mat: 'steel', size: 'big', hp: 700 },
      crate2: { mat: 'steel', size: 'mid', hp: 320 },
      crate3: { mat: 'steel', size: 'mid', hp: 400 },
      dock: { mat: 'concrete', size: 'mid', hp: 360 },
      booth: { mat: 'glass', size: 'mid', hp: 200 },
      sandbags: { mat: 'sand', size: 'mid', hp: 160 },
      ring: { mat: 'steel', size: 'mid', hp: 200, depth: 12 },
      catwalk: { mat: 'steel', size: 'mid', hp: 240, depth: 14 },
      crane: { mat: 'steel', size: 'big', hp: 700, depth: 16 },
      craneLow: { mat: 'steel', size: 'mid', hp: 300, depth: 9 },
      dockAwning: { mat: 'sheet', size: 'mid', hp: 120, depth: 8 },
      rail: { mat: 'concrete', size: 'big', hp: 700, depth: 18 },
      stairs: { mat: 'steel', size: 'mid', hp: 260, depth: 92 },
      watch: { mat: 'wood', size: 'mid', hp: 280, depth: 4 },
      watchRoof: { mat: 'wood', size: 'mid', hp: 180, depth: 6 },
      catwalkLeg: { mat: 'steel', size: 'mid', hp: 200 },
      craneLeg: { mat: 'steel', size: 'big', hp: 700 },
      railLeg: { mat: 'concrete', size: 'big', hp: 600 },
      watchLeg: { mat: 'steel', size: 'mid', hp: 200 },
      watchCabin: { mat: 'glass', size: 'mid', hp: 220 },
    },
    /** 그 밖의 구조물 (x0 ~ x1, 바닥에서 y0 ~ y1) */
    others: [
      { kind: 'containers', mat: 'steel', size: 'big', hp: 600, x0: 1600, x1: 1666, y0: 0, y1: 112 },
      { kind: 'gatePier', mat: 'stone', size: 'big', hp: 520, x0: 2584, x1: 2616, y0: 0, y1: 140 },
      { kind: 'statue', mat: 'stone', size: 'big', hp: 650, x0: 2710, x1: 2758, y0: 0, y1: 116 },
      { kind: 'checkpoint', mat: 'glass', size: 'mid', hp: 190, x0: 3738, x1: 3776, y0: 0, y1: 46 },
      { kind: 'gatePier', mat: 'stone', size: 'big', hp: 520, x0: 3784, x1: 3816, y0: 0, y1: 140 },
      { kind: 'parkGate', mat: 'stone', size: 'big', hp: 450, x0: 4756, x1: 4770, y0: 0, y1: 160 },
    ],
    /** 거리 소품 (street.props의 kind별 판정 상자 폭·높이와 재질, 내구도). 맨홀은 바닥이라 빠진다 */
    street: {
      crates: { mat: 'wood', w: 34, h: 34, hp: 50 },
      mailbox: { mat: 'steel', w: 14, h: 26, hp: 70 },
      barrel: { mat: 'steel', w: 14, h: 20, hp: 45 },
      bench: { mat: 'wood', w: 36, h: 22, hp: 60 },
      planter: { mat: 'concrete', w: 30, h: 34, hp: 80 },
      posterboard: { mat: 'wood', w: 36, h: 78, hp: 50 },
    },
  },
} as const;
