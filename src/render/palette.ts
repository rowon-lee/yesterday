/**
 * 제한 팔레트. 캐릭터와 이펙트가 같은 색을 쓴다.
 * 색 이름 → 실제 색. 새 색은 여기에만 추가한다.
 */
export const COLORS = {
  ink: '#0a0712', // 외곽선
  night: '#07040e',
  panel: '#120a24',
  panelLight: '#1a1030',
  grid: '#2a1f44',
  gridLight: '#5a4c90',
  white: '#f4f0e6',
  gold: '#ffd25e',
  goldLight: '#fff3a8',
  goldDark: '#b07a26',
  sky: '#7fe3ff',
  skyLight: '#d4f8ff',
  skyDark: '#2a7fa6',
  red: '#ff4d6d',
  green: '#7bd88f',
  // 라이덴 (대표 색: 붉은 전격, 검붉은 잔상). 몸은 붉은색, 정장 재킷은 검은 보랏빛. 머리는 1P 흰색, 2P 검정(붉은 안쪽 머리·붉은 윤기)
  raiden: '#d93a3c',
  raidenLight: '#ff7a66',
  raidenDark: '#8e1f2b',
  raidenDeep: '#4c0f1a',
  // 라이덴 애니 이펙트 4색 띠 (동작연출지침서 14-4: 흰 → 밝은 빨강 → 검붉은 → 자홍 테두리 소량, 노랑·주황 금지). 흰 심은 fxWhite
  raidenFxRed: '#ff2440',
  raidenFxCrimson: '#a00c2c',
  raidenFxMagenta: '#ff2ec4',
  // 라이덴 길티기어식 이펙트 색 (동작연출지침서 14-8 '라이덴 색'): 심 흰·연분홍 → 주색 밝은 빨강 → 진한 주색 → 가장 바깥·잉크 검붉은,
  // 고리·테두리 자홍 소량 (노랑·주황 금지)
  raidenFxCore: '#fff6f8',
  raidenFxRose: '#ff526e',
  raidenFxScarlet: '#cd1634',
  raidenFxDark: '#46081e',
  raidenFxSpark: '#ff46c8',
  suit: '#2d2735',
  suitLight: '#4a4156',
  suitDark: '#1a161f',
  suitGrey: '#575163',
  suitGreyLight: '#787286',
  suitGreyDark: '#38333f',
  paleGrey: '#b3b5c5',
  // 백은우 (대표 색: 흰 가운·금색 실·백합 연분홍). 몸은 연분홍, 가운은 흰색(그늘은 차가운 회청), 머리는 밝은 갈색
  lily: '#e9a0b4',
  lilyLight: '#ffd2de',
  lilyDark: '#a85f78',
  lilyDeep: '#5e2f44',
  gown: '#d9dce8',
  gownShade: '#9ea4ba',
  gownDark: '#646a82',
  hairBrown: '#9c6c45',
  hairBrownLight: '#c99a66',
  hairBrownDark: '#5e3e28',
  thread: '#e8b84a',
  threadLight: '#fff0a0',
  // 피부 (얼굴·손, 2026-11-02 '피부는 손·얼굴만'): 창백한 살빛 세 단계
  skin: '#e6c9bc',
  skinLight: '#f6e4da',
  skinDark: '#ad8879',
  // 백은우 일러스트 (2026-11-02): 잿빛 머리 (분홍기 도는 회갈색)
  ash: '#a8998f',
  ashLight: '#d6cac2',
  ashDark: '#6e625d',
  // 에드워드 (붉은 정장·흰 넥타이·푸른 장막·청동). 몸은 붉은 정장(라이덴 붉은색보다 푸른 기 도는 짙은 다홍), 머리는 흰색
  crimson: '#a3233f',
  crimsonLight: '#d0455f',
  crimsonDark: '#661528',
  crimsonDeep: '#3b0b18',
  veil: '#4f8fff',
  veilLight: '#b6d4ff',
  veilDark: '#2a4ca8',
  bronze: '#a6743c',
  bronzeLight: '#dcaa64',
  bronzeDark: '#5e3e1e',
  hammer: '#4a5260',
  hammerLight: '#8a94a6',
  hammerDark: '#262a32',
  // 오스카 (올블랙 정장·짧은 금발·은빛 검). 몸은 검은 정장(달빛 받는 쪽 회청), 이펙트는 은빛 달빛·핏빛 달·짙은 바다
  blackSuit: '#23252d',
  blackSuitLight: '#4a4f5e',
  blackSuitDark: '#14151a',
  blond: '#d2b25a',
  blondLight: '#f2dc90',
  blondDark: '#8e7232',
  moon: '#cdd8ec',
  moonLight: '#f4f8ff',
  moonDark: '#7c8aa6',
  bloodMoon: '#b3202e',
  bloodMoonDark: '#5c0f18',
  deepSea: '#14384a',
  deepSeaLight: '#2a6680',
  // 이펙트 (Sprite Fusion 램프를 이 색으로 맞춘다). 캐릭터와 같은 팔레트를 쓴다
  fxWhite: '#ffffff',
  fxYellow: '#ffe26b',
  fxOrange: '#ff8a2a',
  fxFlame: '#f2561d',
  fxRed: '#c9281f',
  fxSoot: '#17121d',
  fxBlue: '#3a8bd8',
  fxDeepBlue: '#2c58aa',
  fxNavy: '#212f6b',
  // 무대 (채도를 낮춘 녹슨 갈색·회색 벽돌·매연 낀 하늘). 밝은 색은 불빛에만 쓴다.
  smog0: '#18161c',
  smog1: '#211e25',
  smog2: '#2c282d',
  smog3: '#3a3434',
  smogHaze: '#463e3b',
  sunDim: '#5e4b40',
  factory: '#25222a',
  skylineFar: '#2d292f',
  skylineLit: '#6e5a42',
  brick: '#46363a',
  brickDark: '#3a2d31',
  brickLight: '#534147',
  brickRed: '#4e3532',
  brickRedDark: '#402b29',
  stone: '#5a544f',
  stoneDark: '#45403d',
  iron: '#232026',
  ironLight: '#36323a',
  windowDark: '#1c1a20',
  windowLit: '#8c6a43',
  paintTeal: '#3f5352',
  paintOchre: '#7d6643',
  paintCream: '#968a72',
  posterRed: '#6e322d',
  posterRedDark: '#4c2421',
  awning: '#4a3a33',
  awningStripe: '#5d4c42',
  sidewalk: '#38332f',
  sidewalkJoint: '#2d2926',
  curb: '#4d4640',
  street: '#26221f',
  streetLine: '#33302c',
  rail: '#625b54',
  railDark: '#3d3833',
  smoke: '#4a4446',
  smokeDark: '#3b3639',
  sandbag: '#4f4639',
  rust: '#5a3424',
  wire: '#55504c',
  // 1960년대 거리: 크롬, 두 가지 색 차체
  chrome: '#b9c0c6',
  chromeDark: '#6f767d',
  carCream: '#c9bea3',
  carMint: '#5f8f88',
  carCoral: '#a04e48',
  // 시타델 마천루: 색 넣은 유리, 하늘이 비친 유리, 형광등 켜진 사무실
  glass: '#1f2a31',
  glassEdge: '#2f3f47',
  officeLit: '#93a596',
  // 네온관 (밝은 관, 어두운 관). 꺼지면 어두운 관만 남는다
  neonPink: '#ff5fb4',
  neonPinkDark: '#6e2a4e',
  neonCyan: '#59f1ff',
  neonCyanDark: '#1f5560',
  neonAmber: '#ffbb4a',
  neonAmberDark: '#6a4520',
  neonGreen: '#7dff8e',
  neonGreenDark: '#2a5a33',
  neonRed: '#ff4b4b',
  neonRedDark: '#5e2222',
  // 가로등 (나트륨 주황), 빗방울
  sodium: '#ffb15e',
  rain: '#7f93ad',
  rainLight: '#c7d8ef',
  // 불빛 (밝은 색은 여기만)
  lampGlow: '#ffcf7a',
  lampCore: '#fff1c4',
  lampWarm: '#c98d45',
  beam: '#d9d6c4',
  windowLight: '#d8a85e',
} as const;

export type ColorName = keyof typeof COLORS;

/**
 * 2.5D 렌더 후처리 팔레트 계단 묶음 (이름 → 색). 마지막 단계에서 화면 색을 구간 팔레트로 줄인다:
 * 구간 팔레트 = 늘 쓰는 색(COMMON) + 그 구간이 고른 계단 묶음 (data/stages의 moods[구간].ramps).
 * 어둠은 차가운 남색·청록, 빛은 주황·분홍·청록 (아트 규칙 '색 온도'). 어둠 쪽을 촘촘하게 해서 안개·빛 번짐이 점무늬 없이 이어지게.
 */
export const RAMP_SETS = {
  /** 남색 어둠 → 청록 그늘 */
  navy: ['#04050a', '#080b14', '#0d121f', '#131a2c', '#1a2439', '#223047', '#2b3d56', '#354b66', '#405a76', '#4c6a86'],
  /** 주황 빛 (나트륨등·백열등·불길) */
  amber: ['#24120a', '#3d1d0e', '#5e2c12', '#844018', '#ad5a20', '#d4792c', '#f29c40', '#ffc16e', '#ffe2a8', '#fff4d8'],
  /** 분홍 빛 (네온) */
  pink: ['#26091c', '#3f0f2f', '#611648', '#8a2066', '#b42d86', '#df45a7', '#ff6fc3', '#ffa6da', '#ffd6ee'],
  /** 청록 빛 (네온·형광등) */
  teal: ['#061c20', '#0b2f35', '#10464e', '#17616a', '#22808a', '#33a3ab', '#55c8cc', '#8fe6e6', '#c9f7f5'],
  /** 무채색 (비·안개) */
  gray: ['#121318', '#1d1f26', '#2a2d36', '#3a3e49', '#4f5460', '#686d7a', '#868b98', '#a8adb8', '#cdd1d9', '#eef0f4'],
  /** 남보라 (극장 거리·아파트 그림자) */
  indigo: ['#07050f', '#0e0a1c', '#16102a', '#1f173a', '#2a1f4c', '#372860', '#463376', '#58418e', '#6d52a8', '#8a6cc4'],
  /** 검붉은 빛 (공장 용광로·경고등) */
  ember: ['#0d0405', '#1c080a', '#2e0c10', '#451216', '#62181c', '#842024', '#a82c2a', '#cc4034', '#ec6046', '#ff9070'],
  /** 형광 청록 (고가 철도) */
  fluo: ['#030c0a', '#071a15', '#0c2a21', '#123d2f', '#1a5440', '#246e52', '#338c66', '#4aad7e', '#72cf9c', '#b0f0c8'],
  /** 밝은 청록 네온 */
  cyan: ['#0a2430', '#0f3a4c', '#16566e', '#1f7896', '#2c9cbe', '#47c2e0', '#7fe0f4', '#c8f6ff'],
  /** 차가운 강철 (서치라이트·달빛·성벽) */
  steel: ['#0a0e14', '#121a24', '#1c2836', '#28384a', '#364a60', '#475e78', '#5c7690', '#7690aa', '#98b0c6', '#c4d6e6'],
  /** 빛 받은 벽돌 (따뜻한 어둠) */
  brick: ['#0c0806', '#17100c', '#231812', '#302018', '#3e2a1f', '#4e3527', '#614231', '#78523d', '#93664c', '#b5835f'],
  /** 나트륨 안개 (공원·항만) */
  sodium: ['#0c0c06', '#1a190c', '#2a2812', '#3e3a1a', '#565024', '#726a30', '#968a42', '#c0b25e'],
  /** 분홍 안개 (네온 거리) */
  pinkfog: ['#120914', '#1f1022', '#2e1832', '#3e2244', '#512e58', '#673c6e', '#804c88', '#a066a8'],
  /** 호박 갈색 (불 켜진 실내 벽·빛 웅덩이 중간 단계: 벽돌과 주황 사이. 따뜻한 중간 밝기가 차 페인트 색으로 튀지 않게) */
  umber: ['#2e1a10', '#46281a', '#5e3622', '#78452a', '#925632', '#ab683a', '#c27c44', '#d8924e'],
  /** 따뜻한 회색 (항만·공장의 매연·안개: 갈색빛 회색이 올리브·벽돌 사이를 오가며 얼룩지지 않게) */
  taupe: ['#14120f', '#1d1a16', '#27231e', '#322d27', '#3e3830', '#4b443a', '#5a5145', '#6b6152'],
  /** 빛의 심 */
  core: ['#fff8ec', '#f0f6ff', '#ffeef6', '#e8fff8'],
} as const satisfies Record<string, readonly string[]>;
export type RampName = keyof typeof RAMP_SETS;

/** 모든 계단을 합친 목록 (그림을 그릴 때 쓰는 전체 팔레트) */
export const RAMPS: readonly string[] = Object.values(RAMP_SETS).flat();

/**
 * 후처리 마지막 단계의 밝기 계단 (흑백 0~255, 0.299R + 0.587G + 0.114B). 모든 색 갈래가 같은 밝기 칸을 쓴다:
 * 빛의 번짐이 한 갈래에서 다른 갈래로 넘어가도 밝기 경계는 늘 같은 자리라 고리 무늬가 겹으로 지지 않고(색만 바뀐다),
 * 흑백으로 봐도 단계가 고르다. 어둠 쪽을 촘촘하게 (화면 대부분이 흑백 10~60).
 */
export const POST_LADDER: readonly number[] = [4, 9, 14, 20, 27, 35, 44, 54, 66, 80, 96, 115, 137, 162, 190, 220, 246];

/**
 * 후처리 색 갈래 (이름 → 기준 색들). 무대 칸은 구간이 고른 갈래(data/stages moods[구간].ramps) 안에서 밝기 계단으로 줄인다.
 * 갈래마다 기준 색(위 RAMP_SETS 계단을 바탕으로, 어둠 쪽과 밝은 심 쪽을 이은 것)을 OKLab에서 밝기 순으로 이어,
 * 밝기 계단 칸마다 그 밝기에 정확히 맞춘 색을 만든다 (render/gl/post.ts). 밝은 끝은 모두 그 빛 색을 띤 거의 하양 (네온 관·전구의 심).
 * 어둠은 차가운 남색·청록·남보라, 빛은 주황·분홍·청록 (아트 규칙 '색 온도').
 */
export const POST_FAMILIES = {
  /** 남색 어둠 → 청록 그늘 → 차가운 빛 (환경) */
  navy: ['#04050a', '#080b14', '#0d121f', '#131a2c', '#1a2439', '#223047', '#2b3d56', '#354b66', '#405a76', '#4c6a86', '#7690aa', '#c4d6e6', '#f0f6ff'],
  /** 무채색 (비·안개·콘크리트) */
  gray: ['#0b0c10', '#121318', '#1d1f26', '#2a2d36', '#3a3e49', '#4f5460', '#686d7a', '#868b98', '#a8adb8', '#cdd1d9', '#eef0f4'],
  /** 차가운 강철 (유리·서치라이트·달빛·성벽) */
  steel: ['#0a0e14', '#121a24', '#1c2836', '#28384a', '#364a60', '#475e78', '#5c7690', '#7690aa', '#98b0c6', '#c4d6e6', '#f0f6ff'],
  /** 남보라 (극장 거리·아파트의 어둠) */
  indigo: ['#07050f', '#0e0a1c', '#16102a', '#1f173a', '#2a1f4c', '#372860', '#463376', '#58418e', '#6d52a8', '#8a6cc4', '#b49ce0', '#ddd2f6', '#f6f2ff'],
  /** 청록 빛 (네온·형광등·물) */
  teal: ['#030c0e', '#061c20', '#0b2f35', '#10464e', '#17616a', '#22808a', '#33a3ab', '#55c8cc', '#8fe6e6', '#c9f7f5', '#e8fff8'],
  /** 밝은 청록 네온 */
  cyan: ['#04101a', '#0a2430', '#0f3a4c', '#16566e', '#1f7896', '#2c9cbe', '#47c2e0', '#7fe0f4', '#c8f6ff', '#f0faff'],
  /** 형광 초록 (고가 철도 신호·열차) */
  fluo: ['#030c0a', '#071a15', '#0c2a21', '#123d2f', '#1a5440', '#246e52', '#338c66', '#4aad7e', '#72cf9c', '#b0f0c8', '#e8fff8'],
  /** 짙은 녹청 (공원·고가 철도 밑의 어둠) */
  pine: ['#040808', '#081010', '#0c1816', '#12221f', '#182c28', '#203833', '#2a4640', '#36564e', '#44665c', '#54786c', '#7a9a8c', '#b0c8bc', '#e8f4ee'],
  /** 주황 빛 (나트륨등·백열등·불 켜진 창) */
  amber: ['#120806', '#24120a', '#3d1d0e', '#5e2c12', '#844018', '#ad5a20', '#d4792c', '#f29c40', '#ffc16e', '#ffe2a8', '#fff4d8', '#fff8ec'],
  /** 용광로 불빛: 검붉은 어둠 → 빨강 → 주황 → 노랑 → 하얀 심 (번짐이 한 갈래 안에서 색을 틀며 이어진다) */
  fire: ['#080203', '#1a0607', '#2c0b0a', '#43100c', '#5e180f', '#7c2312', '#9c3215', '#bc4618', '#d8601c', '#ec8226', '#f8a63c', '#ffc865', '#ffe4a0', '#fff6dc'],
  /** 검붉은 빛 (경고등) */
  ember: ['#0d0405', '#1c080a', '#2e0c10', '#451216', '#62181c', '#842024', '#a82c2a', '#cc4034', '#ec6046', '#ff9070', '#ffc0a8', '#ffe9e0'],
  /** 분홍 빛 (네온) */
  pink: ['#12040d', '#26091c', '#3f0f2f', '#611648', '#8a2066', '#b42d86', '#df45a7', '#ff6fc3', '#ffa6da', '#ffd6ee', '#ffeef6'],
  /** 분홍 안개 (네온 거리의 벽·공기) */
  pinkfog: ['#120914', '#1f1022', '#2e1832', '#3e2244', '#512e58', '#673c6e', '#804c88', '#a066a8', '#c48ccc', '#e6c8ec', '#faf0fc'],
  /** 호박 갈색 (불 켜진 실내 벽·빛 웅덩이 중간: 벽돌과 주황 사이) */
  umber: ['#0e0805', '#1a0e08', '#2e1a10', '#46281a', '#5e3622', '#78452a', '#925632', '#ab683a', '#c27c44', '#d8924e', '#ecb478', '#fff8ec'],
  /** 따뜻한 회색 (항만의 노을 빛 띤 안개) */
  taupe: ['#0b0a08', '#14120f', '#1d1a16', '#27231e', '#322d27', '#3e3830', '#4b443a', '#5a5145', '#6b6152', '#8a806e', '#b8b0a0', '#eeeae0'],
  /** 빛 받은 벽돌 */
  brick: ['#0c0806', '#17100c', '#231812', '#302018', '#3e2a1f', '#4e3527', '#614231', '#78523d', '#93664c', '#b5835f', '#d8b090', '#f6ece2'],
  /** 나트륨 안개 */
  sodium: ['#0c0c06', '#1a190c', '#2a2812', '#3e3a1a', '#565024', '#726a30', '#968a42', '#c0b25e', '#e8dc94', '#fffbe0'],
} as const satisfies Record<string, readonly string[]>;
export type PostRampName = keyof typeof POST_FAMILIES;

/**
 * 모든 구간 팔레트에 늘 들어가는 색: 캐릭터 시트와 이펙트가 어느 구간에서나 같은 색으로 보이게
 * (무대 텍스처의 색은 구간 팔레트에서 가장 가까운 색으로 바뀐다)
 */
export const COMMON: readonly ColorName[] = [
  'ink', 'night', 'white', 'gold', 'goldLight', 'goldDark',
  'sky', 'skyLight', 'skyDark', 'red', 'green',
  'fxWhite', 'fxYellow', 'fxOrange', 'fxFlame', 'fxRed', 'fxSoot', 'fxBlue', 'fxDeepBlue', 'fxNavy', 'neonRed', 'neonPink',
  // 라이덴
  'raiden', 'raidenLight', 'raidenDark', 'raidenDeep', 'raidenFxRed', 'raidenFxCrimson', 'raidenFxMagenta',
  'raidenFxCore', 'raidenFxRose', 'raidenFxScarlet', 'raidenFxDark', 'raidenFxSpark', 'suit', 'suitLight', 'suitDark', 'suitGrey', 'suitGreyLight', 'suitGreyDark', 'paleGrey',
  // 백은우
  'lily', 'lilyLight', 'lilyDark', 'lilyDeep', 'gown', 'gownShade', 'gownDark', 'hairBrown', 'hairBrownLight', 'hairBrownDark', 'thread', 'threadLight', 'ash', 'ashLight', 'ashDark', 'skin', 'skinLight', 'skinDark',
  // 에드워드
  'crimson', 'crimsonLight', 'crimsonDark', 'crimsonDeep', 'veil', 'veilLight', 'veilDark', 'bronze', 'bronzeLight', 'bronzeDark', 'hammer', 'hammerLight', 'hammerDark',
  // 오스카
  'blackSuit', 'blackSuitLight', 'blackSuitDark', 'blond', 'blondLight', 'blondDark', 'moon', 'moonLight', 'moonDark', 'bloodMoon', 'bloodMoonDark', 'deepSea', 'deepSeaLight',
];
