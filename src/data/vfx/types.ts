// YESTERDAY 이펙트 문법 데이터 형식 (숫자 데이터만). 그리는 것은 vfx/gg.
// 기준: 동작연출지침서 14-8 '길티기어식 이펙트' 여덟 가지 (2026-11-04). 레퍼런스 그림을 베끼지 않고 문법만 옮긴다.
// 공격 하나의 이펙트는 큰 모양 몇 개의 숫자(기준점, 축 방향, 길이, 두께 곡선, 꺾임, 잉크 쐐기, 고리…)로 정한다.
// 난수는 불씨 위치·속도 같은 작은 변화에만 쓴다 (14-7).
// 시간 (14-2, 2026-11-04 고침): 전조 −4~−1 (vfx/gg/prelude) → 펼쳐짐 0~2틱 (0틱 전체 길이·두께 1/3) → 살아 있는 정지 (히트스톱 동안도
// 다시 꺾이고 맥동하고 자란다) → 흩어짐 (fade: 꼬리부터 가닥으로 찢어져 공격 방향으로 흘러가고, 바깥 단계 색부터 빠진다) → 잔향 (불씨·연기·빛).
//
// 좌표: 오른쪽 보기 기준 px. x는 공격 방향 앞이 +, y는 아래가 + (위가 −). 각도는 도, 0 = 앞, −90 = 위, 90 = 아래.
// 기준(anchor): 'self' = 공격자 발밑 (판정이 시작하는 틱 자리), 'hit' = 맞은 점 (맞은 틱에만 나온다).
// 화면은 480×270이라 14-8의 320×180 기준 크기에 1.5를 곱해 적는다.

export type GPt = readonly [number, number];

/**
 * 셀 색 단계 (캐릭터 색표 번호): 0 심 (흰·크림) · 1 주색 · 2 진한 주색 · 3 잉크 (아주 어두운) · 4 고리·테두리 (보색 소량)
 * · 5 덧색 (백은우 백합 꽃잎 연분홍, 에드워드 밝은 장막) · 6 짙은 주색 (백은우 짙은 하늘: 물빛 그늘, 에드워드 짙은 장막). 색표에 없는 번호는 0으로 그린다
 */
export type GTone = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 모든 모양에 붙는 것 */
interface GBase {
  /** 기준: 공격자 발밑 (기본) · 맞은 점 */
  anchor?: 'self' | 'hit';
  /** 캐릭터 뒤 (기본) · 앞. 앞 겹에는 섬광·불씨만 (14-7 '맞는 사람은 덩어리 앞에') */
  layer?: 'back' | 'front';
  /** 히트스톱이 끝난 뒤에도 살아 있는 정지로 머무는 틱 (히트스톱 동안은 따로 머문다) */
  hold?: number;
  /** 흩어지는 틱 (14-2: 꼬리부터 가닥으로 찢어지며 흘러간다. 진행 0.7쯤에서 보이지 않게 된다) */
  fade?: number;
  /** 나타나는 틱 (기본 0, 진행 시계: 히트스톱 동안은 세지 않는다) */
  delay?: number;
  /**
   * 나타나는 틱 (살아 있는 시계: 히트스톱 동안도 센다). 14-9 B 지연 폭발처럼 세상이 멈춘 동안 늦게 터지는 것.
   * delay와 함께 쓰지 않는다
   */
  wait?: number;
  /** 14-9 N 맥동: 흩어지기 직전 3틱 동안 한 번 더 부풀었다 (최대 +16%) 흩어진다 */
  pulse?: boolean;
  /** 14-9 I 시간 엇갈림: 살아 있는 정지 동안 자라는 빠르기 배수 (기본 1, 자라는 상한도 함께 늘어난다) */
  grow?: number;
  /** 오래 머무는 모양 (14-9 J 탄 자국)이 같은 그림으로 멈추지 않게 두께가 이 비율로 천천히 숨쉰다 (살아 있는 시계, 약 9틱 주기) */
  breathe?: number;
}

/**
 * 빛 쐐기·빛기둥 (문법 1·4): 축을 따라 가운데가 두껍고 양 끝이 뾰족한 납작한 면. 셀 3단 (진한 주색 → 주색 → 심).
 * 빛기둥은 길게 (화면 밖까지), 쐐기는 짧게
 */
export interface GWedge extends GBase {
  kind: 'wedge';
  /** 축 위 기준점과 축 방향 (도) */
  at: GPt;
  angle: number;
  /** 기준점에서 앞쪽·뒤쪽 길이 */
  fwd: number;
  back: number;
  /** 가장 두꺼운 곳의 두께 (px, 전체) */
  w: number;
  /** 가장 두꺼운 자리 (0 뒤끝 → 1 앞끝, 기본 0.4) */
  peak?: number;
  /** 뒤·앞 끝으로 가는 모양 (1 곧게, 1보다 작으면 볼록하게 두툼, 크면 오목하게 바늘) */
  bulge?: readonly [number, number];
  /** 축 위쪽(화면 위)으로 두께를 몰기 (−1~1) */
  skew?: number;
  /** 주색·심 두께 비 (전체 두께 대비, 기본 0.66·0.3)와 심 길이 비 (기본 0.78) */
  main?: number;
  core?: number;
  coreLen?: number;
  /** 바깥 단 색 (기본 2 진한 주색) */
  edge?: GTone;
  /** 셀 3단 색을 통째로 바꾼다 [바깥 단, 주색 단, 심] (기본 [edge, 1, 0]). 에드워드 푸른 장막 띠 [6, 4, 5] */
  tones?: readonly [GTone, GTone, GTone];
}

/** 스우시 띠 (문법 1): 원호를 따라 휘는 굵은 띠. 두께는 꼬리에서 머리로 (u 0 → 1) */
export interface GSwoosh extends GBase {
  kind: 'swoosh';
  /** 원 가운데·반지름·시작각 → 끝각 (도) */
  c: GPt;
  r: number;
  a0: number;
  a1: number;
  w: number;
  peak?: number;
  bulge?: readonly [number, number];
  /** 바깥(앞날)으로 두께를 몰기 (−1~1) */
  skew?: number;
  main?: number;
  core?: number;
  coreLen?: number;
  edge?: GTone;
  /** 반지름 비 (가로·세로, 바닥에 납작하게: 기본 1·1) */
  sx?: number;
  sy?: number;
  /** 납작한 원 기울기 (도, 가운데 기준. 꼭대기가 수평으로 길게 눕지 않게) */
  rot?: number;
  /** 셀 3단 색을 통째로 바꾼다 [바깥 단, 주색 단, 심] (기본 [edge, 1, 0]). 에드워드 푸른 장막 띠 [6, 4, 5] */
  tones?: readonly [GTone, GTone, GTone];
}

/**
 * 굵은 번개 (문법 6): 꺾인 긴 마디 3~5개, 날카로운 모서리, 바깥에 어두운 테두리 1px.
 * 점을 직접 주거나 (pts), 원호를 따라 꺾임을 준다 (arc)
 */
export interface GBolt extends GBase {
  kind: 'bolt';
  pts?: readonly GPt[];
  /** 원호를 따라: 가운데·반지름·시작각·끝각 (도), 꺾임 [자리 u, 바깥으로 px]… (u는 0~1 사이 마디 자리) */
  arc?: { c: GPt; r: number; a0: number; a1: number; kinks: ReadonlyArray<readonly [number, number]>; sx?: number; sy?: number };
  /** 시작·끝 굵기 (px, 테두리 빼고). wPeak가 있으면 자리 peak (0~1)에서 가장 굵다 */
  w0: number;
  w1: number;
  wPeak?: number;
  peak?: number;
  /** 가지 번개: [마디 자리 u, 각도 (마디 방향 기준 도), 길이] */
  forks?: ReadonlyArray<readonly [number, number, number]>;
}

/** 잉크 쐐기 (문법 3): 밝은 모양 옆의 끝이 뾰족한 아주 어두운 쐐기. 한쪽 날에 톱니 */
export interface GInk extends GBase {
  kind: 'ink';
  at: GPt;
  angle: number;
  len: number;
  /** 뿌리 두께 (px) */
  w: number;
  /** 톱니: [자리 u, 깊이 px]… (한쪽 날) */
  notch?: ReadonlyArray<readonly [number, number]>;
  /** 둘레 1px 테두리 색 (기본 없음 −1: 밤 배경으로 삐져나온 곳에서 1px 선이 된다. 잉크는 밝은 모양을 가로질러 그 위에서만 보이게 놓는다) */
  rim?: GTone | -1;
}

/** 큰 원 고리 (문법 5): 맞은 점 둘레 얇은 테. 지름은 화면 높이의 60~90% */
export interface GRing extends GBase {
  kind: 'ring';
  at?: GPt;
  r: number;
  /** 가장 두꺼운 곳 두께 (px)와 그 방향 (도). 반대쪽은 1px */
  w: number;
  thick?: number;
  /** 끊긴 곳 [시작각, 끝각]… */
  gaps?: ReadonlyArray<readonly [number, number]>;
  /** 납작하게 (세로 비, 기본 1) */
  sy?: number;
  /** 기울기 (도, 가운데 기준, 기본 0) */
  rot?: number;
  /** 물결 (백은우 물결 고리): 테두리가 이 진폭(px)으로 느리게 굽이치며 흐른다 (파장 약 32px). 위·아래 테두리가 한 줄로 곧게 이어지지 않는다 */
  ripple?: number;
  /** 맨 위·맨 아래 (곡선이 수평이 되는 자리)를 약 32px씩 끊는다 (에드워드: 큰 고리·바닥에 누운 고리가 자로 그은 듯 평평해지지 않게, 끊긴 압력 고리) */
  cap?: boolean;
  tone?: GTone;
}

/** 방사 속도선 (문법 5): 고리 안쪽에서 맞은 점으로 모이는 가는 선. 바깥이 굵고 안쪽 끝이 뾰족 */
export interface GRays extends GBase {
  kind: 'rays';
  at?: GPt;
  /** 선마다 [각도, 바깥 반지름, 안쪽 반지름, 뿌리 굵기, 색]… (부채꼴, 같은 길이·같은 간격 금지) */
  lines: ReadonlyArray<readonly [number, number, number, number, GTone]>;
}

/** 섬광 (문법 5): 맞은 점의 날카로운 별. 가시마다 [각도, 길이, 뿌리 반폭] */
export interface GFlash extends GBase {
  kind: 'flash';
  at?: GPt;
  /** 테두리 색 (기본 4) */
  rim?: GTone;
  spikes: ReadonlyArray<readonly [number, number, number]>;
}

/** 불씨 (문법 7): 1~2px 점을 맞은 점 둘레에 흩뿌린다 (자리·속도만 시드 난수) */
export interface GEmbers extends GBase {
  kind: 'embers';
  at?: GPt;
  n: number;
  /** 처음 퍼진 반지름, 날아가는 빠르기 (px/틱), 주로 날아가는 방향 (도)과 퍼짐 (도) */
  spread: number;
  speed: number;
  dir: number;
  fan: number;
  /** 사는 틱 (14-2 잔향: 중력으로 떨어져 바닥에서 튀고, 식으며 색이 어두워진다) */
  life: number;
}

/** 연기·열기 (14-2 잔향): 단단한 경계의 작은 덩어리가 천천히 오르며 커졌다 작아진다. 처음은 진한 주색(열기) → 잉크색 */
export interface GSmoke extends GBase {
  kind: 'smoke';
  at?: GPt;
  /** 덩어리 수, 처음 퍼진 반지름 (px) */
  n: number;
  spread: number;
  /** 오르는 빠르기 (px/틱), 가장 클 때 반지름 (px), 사는 틱 */
  rise: number;
  size: number;
  life: number;
  /** 처음 1/4 색 → 그 뒤 색 (기본 [2, 3]: 열기 → 연기. 백은우는 물안개 [1, 2]) */
  tones?: readonly [GTone, GTone];
}

/**
 * 리본 띠 (백은우 고유 모양, 14-4 '리본처럼 휘는 넓은 띠'): 점들을 매끄럽게 이은 곡선을 따라 휘는 넓은 띠. 셀 3단 (옅은 하늘 → 은백 → 흰 심).
 * 두께는 꼬리(점 0) → 머리(마지막 점). 비틀린 자리(twist)는 띠가 좁아지며 뒷면(바깥 단 색)만 보인다.
 * 앞날을 따라 금색 실 한 가닥(thread, 색 4)이 띠 안쪽에 붙어 지난다 (1px 선이 따로 떠 있지 않게).
 * 살아 있는 정지 동안 천처럼 물결치고 (꼬리일수록 크게, 머리는 판정 자리에 머문다), 흩어지면 꼬리부터 찢어져 띠를 따라 흘러간다
 */
export interface GRibbon extends GBase {
  kind: 'ribbon';
  /** 가운데 선이 지나는 점 (꼬리 → 머리) */
  pts: readonly GPt[];
  /** 가장 두꺼운 곳의 두께 (px) */
  w: number;
  /** 가장 두꺼운 자리 (0 꼬리 → 1 머리, 기본 0.66)와 양 끝으로 가는 모양 (기본 [1.1, 0.6]) */
  peak?: number;
  bulge?: readonly [number, number];
  /** 위쪽(가는 방향 왼쪽)으로 두께를 몰기 (−1~1) */
  skew?: number;
  main?: number;
  core?: number;
  coreLen?: number;
  edge?: GTone;
  /** 비틀림: [자리 u, 남는 두께 비 (0.3~0.6)]… */
  twist?: ReadonlyArray<readonly [number, number]>;
  /** 금색 실: [시작 u, 끝 u, 굵기 px, 쪽 (+1 위쪽 날, −1 아래쪽 날)] */
  thread?: readonly [number, number, number, number];
  /** 물결: [꼬리 쪽 진폭 px, 파장 px] (기본 [2.5, 46]) */
  wave?: readonly [number, number];
  /** 천의 잔물결: 두께가 이 비율로 약 15px마다 굽이친다 (기본 0.06) */
  ruffle?: number;
  /** 셀 3단 색을 통째로 바꾼다 [바깥 단, 주색 단, 심] (기본 [edge, 1, 0]). 에드워드 푸른 장막 띠 [6, 4, 5] */
  tones?: readonly [GTone, GTone, GTone];
}

/**
 * 나비·꽃잎 조각 (백은우 14-4 '꼬리에서 흰 나비·꽃잎 조각', 14-9 D 카메라 쪽으로 커지는 조각): 점들(리본 꼬리 등)에서 차례로 떨어져 나와
 * 날갯짓하거나 맴돌며 흘러가고, 떠오르고, 식으며 (심 → 주색 → 진한 주색) 작아져 사라진다. 살아 있는 시계로 산다
 */
export interface GFlutter extends GBase {
  kind: 'flutter';
  /** 떨어져 나오는 자리 (차례로) */
  from: readonly GPt[];
  n: number;
  /** 나비 비율 (0~1, 나머지는 꽃잎) */
  fly?: number;
  /** 크기 (px: 나비 날개폭, 꽃잎 길이) */
  size: number;
  /** 흘러가는 방향 (도)·빠르기 (px/틱)·퍼짐 (도) */
  dir: number;
  speed: number;
  fan: number;
  /** 떠오르는 빠르기 (px/틱, 위로 +, 기본 0.12) */
  lift?: number;
  /** 사는 틱 */
  life: number;
  /** 하나씩 나오는 간격 (틱, 기본 1) */
  every?: number;
  /** 틱마다 커지는 비 (14-9 D: 카메라 쪽으로 날아오는 조각, 기본 0) */
  zoom?: number;
  /** 꽃잎 색 (기본 0 → 1 → 2로 식는다. 5면 연분홍 꽃잎) */
  tone?: GTone;
}

/**
 * 금실 바늘땀 (백은우, 14-9 J 남는 흔적): 길을 따라 짧은 금실 땀이 차례로 꿰매지고, 1~2초 동안 공간에 남아 빛이 한 땀씩 지나간 뒤
 * 시작 쪽부터 한 땀씩 풀려 사라진다. 땀마다 길이·굵기·기울기가 조금씩 달라 같은 선이 늘어서지 않는다 (가운데가 굵고 양 끝이 뾰족)
 */
export interface GStitch extends GBase {
  kind: 'stitch';
  /** 길 (시작 → 끝) */
  pts: readonly GPt[];
  /** 땀 길이 (px, 평균), 굵기 (px, 가장 굵은 곳), 간격 (px), 길과 이루는 각 (도) */
  len: number;
  w: number;
  gap: number;
  slant: number;
  /** 꿰매는 틱 (처음부터 끝까지), 남는 틱 (살아 있는 시계, 꿰맨 뒤) */
  sew: number;
  life: number;
  tone?: GTone;
}

/**
 * 짓누르는 충격파 (에드워드 14-4 고유 모양): 바닥 한 점 위 납작한 반원 껍데기 띠 (꼭대기가 가장 굵고 바닥에 닿는 끝이 뾰족하다).
 * 살아 있는 시계로 반지름은 r[0] → r[1]로 넓어지고 높이는 h[0] → h[1]로 낮아진다 (퍼지며 눌려 납작해진다: 히트스톱 동안도 퍼진다).
 * 흩어지면 바깥으로 밀려가며 찢어진다. at은 바닥 위 점 (y 0이 바닥)
 */
export interface GQuake extends GBase {
  kind: 'quake';
  at?: GPt;
  /** 반지름 (가로, px)·높이 (px): 처음 → 끝 */
  r: readonly [number, number];
  h: readonly [number, number];
  /** 퍼지는 틱 (살아 있는 시계, 처음이 빠르고 끝이 느리다) */
  spread: number;
  /** 꼭대기 두께 (px) */
  w: number;
  /** 기울기 (도, 기본 −5: 꼭대기가 수평으로 길게 눕지 않게) */
  rot?: number;
  /** 1 앞쪽 4분원만 · −1 뒤쪽만 · 0 양쪽 반원 (기본) */
  sides?: -1 | 0 | 1;
  peak?: number;
  bulge?: readonly [number, number];
  skew?: number;
  main?: number;
  core?: number;
  coreLen?: number;
  edge?: GTone;
  tones?: readonly [GTone, GTone, GTone];
}
/**
 * 바닥 덩어리 파편 (에드워드 14-4 고유 모양): 모난 큰 덩어리(4~16px)가 튀어 올라 돌며 떨어지고 바닥에서 튄다.
 * 셀 3단: 아래쪽 그늘 · 몸 · 위쪽 빛 받는 면 (처음 몇 틱은 빛 받는 면이 흰 심: 달궈진 단면). 살아 있는 시계로 산다.
 * 14-9 D: zoom이 있으면 카메라 쪽으로 커지며 날아온다
 */
export interface GChunks extends GBase {
  kind: 'chunks';
  at?: GPt;
  n: number;
  /** 처음 퍼진 반폭 (px), 크기 [가장 작은, 가장 큰] (px) */
  spread: number;
  size: readonly [number, number];
  /** 빠르기 (px/틱), 방향 (도), 퍼짐 (도) */
  speed: number;
  dir: number;
  fan: number;
  life: number;
  /** 하나씩 나오는 간격 (틱, 기본 0: 한꺼번에) */
  every?: number;
  /** 도는 빠르기 상한 (라디안/틱, 기본 0.25), 중력 (px/틱², 기본 0.2), 틱마다 커지는 비 (기본 0) */
  spin?: number;
  gravity?: number;
  zoom?: number;
  /** [그늘, 몸, 빛 받는 면] (기본 [3, 2, 1]) */
  tones?: readonly [GTone, GTone, GTone];
}
export type GShape = GWedge | GSwoosh | GBolt | GInk | GRing | GRays | GFlash | GEmbers | GSmoke | GRibbon | GFlutter | GStitch | GQuake | GChunks;

/** 화면 전환 (문법 8): 맞힌 틱부터 */
export interface GScreen {
  /** 배경 누르기: 어둡게 (밝기 scale배 + 색) · 한 색 + 균열 */
  press?: { mode: 'tint' | 'crack'; ticks: number; color: string; scale?: number; crack?: string };
  /** 맞은 사람을 주색 실루엣 + 밝은 테두리로 (틱) */
  silhouette?: number;
}

/**
 * 14-9 연출 기법 중 화면·카메라·환경에 거는 것 (맞힌 틱부터, 틱은 살아 있는 시계)
 */
export interface GTech {
  /** A 임팩트 프레임: at틱부터 ticks틱 동안 화면을 두 색으로 (무대는 bg, 캐릭터·이펙트는 ink 실루엣) */
  impact?: { at?: number; ticks: number; bg: string; ink: string };
  /** E·K 화면 밀기·흔들기: 공격 방향 기준 (앞 +x, 아래 +y) px만큼 밀었다가 ticks틱에 돌아온다. shake면 그 축으로만 흔든다 */
  kick?: { at?: number; dx: number; dy: number; ticks: number; shake?: boolean };
  /** K 줌 펀치: at틱부터 ticks틱 동안 맞은 점을 가운데로 k배 */
  zoom?: { at?: number; k: number; ticks: number };
  /** H 환경 반응: 빗줄기가 ticks틱 동안 공중에 멈춘다, 물웅덩이가 솟는다 (맞은 점 기준 x 자리들, 바닥에서) */
  rain?: { ticks: number };
  puddle?: { at: readonly number[]; n: number };
  /** L 색 뒤집기: at틱부터 ticks틱 동안 주색 단계(1·2)가 보색(금빛) 단계로 */
  flip?: { at: number; ticks: number };
}

/** 공격 하나의 이펙트 */
export interface GMove {
  /** 등급 (14-3) */
  grade: 'normal' | 'strong' | 'skill' | 'super';
  /** 모양 (그리는 순서대로: 뒤에 적은 것이 위) */
  shapes: readonly GShape[];
  /** 맞은 점 높이 (공격자 발밑 기준 y). 없으면 판정 상자 가운데. 맞은 사람 몸 안으로 자른다 */
  hitY?: number;
  screen?: GScreen;
  /** 맞은 점 빛 (실제 광원): 반지름 px, 사그라드는 틱 (14-2: 모양보다 늦게, 15~25틱. 히트스톱 동안은 그대로) */
  light?: { r: number; t: number };
  /** 이 기술에 쓴 문법 번호 (14-8, 확인용) */
  grammar: readonly number[];
  /** 14-9 연출 기법: 주 기법 1개 + 보조 기법 (글자, 확인용) */
  tech?: { main: string; aux: readonly string[] };
  /** 14-9 화면·카메라·환경 기법 */
  fx?: GTech;
  /** 14-9 M 전조: 전조가 시작하는 틱에 (그때 공격자 발밑 기준) 미리 그어지는 모양 */
  pre?: readonly GShape[];
  /** 여러 번 맞히는 기술의 두 번째 타부터 맞은 점에 그리는 모양 (없으면 맞은 점 모양은 첫 타에만) */
  rehit?: readonly GShape[];
  /** 공격자를 따라가는 모양: 판정이 시작하는 틱에 나와 기준점이 틱마다 공격자 발밑으로 옮겨진다 (에드워드 내려찍기 낙하 꼬리) */
  trail?: readonly GShape[];
}
