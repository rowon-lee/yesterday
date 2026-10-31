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
 * 2.5D 렌더 후처리 팔레트 계단: 마지막 단계에서 화면 색을 COLORS와 이 계단을 합친 팔레트로 줄이고 디더링한다.
 * 어둠은 차가운 남색·청록, 빛은 주황·분홍·청록 (아트 규칙 '색 온도').
 */
export const RAMPS: readonly string[] = [
  // 남색 어둠 → 청록 그늘
  '#04050a', '#080b14', '#0d121f', '#131a2c', '#1a2439', '#223047', '#2b3d56', '#354b66', '#405a76', '#4c6a86',
  // 주황 빛 (나트륨등·백열등·불길)
  '#24120a', '#3d1d0e', '#5e2c12', '#844018', '#ad5a20', '#d4792c', '#f29c40', '#ffc16e', '#ffe2a8', '#fff4d8',
  // 분홍 빛 (네온)
  '#26091c', '#3f0f2f', '#611648', '#8a2066', '#b42d86', '#df45a7', '#ff6fc3', '#ffa6da', '#ffd6ee',
  // 청록 빛 (네온·형광등)
  '#061c20', '#0b2f35', '#10464e', '#17616a', '#22808a', '#33a3ab', '#55c8cc', '#8fe6e6', '#c9f7f5',
  // 무채색 (비·안개)
  '#121318', '#1d1f26', '#2a2d36', '#3a3e49', '#4f5460', '#686d7a', '#868b98', '#a8adb8', '#cdd1d9', '#eef0f4',
];
