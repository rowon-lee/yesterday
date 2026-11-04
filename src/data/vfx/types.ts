// YESTERDAY 이펙트 문법 데이터 형식 (숫자 데이터만). 그리는 것은 vfx/gg.
// 기준: 동작연출지침서 14-8 '길티기어식 이펙트' 여덟 가지 (2026-11-04). 레퍼런스 그림을 베끼지 않고 문법만 옮긴다.
// 공격 하나의 이펙트는 큰 모양 몇 개의 숫자(기준점, 축 방향, 길이, 두께 곡선, 꺾임, 잉크 쐐기, 고리…)로 정한다.
// 난수는 불씨 위치·속도 같은 작은 변화에만 쓴다 (14-7).
//
// 좌표: 오른쪽 보기 기준 px. x는 공격 방향 앞이 +, y는 아래가 + (위가 −). 각도는 도, 0 = 앞, −90 = 위, 90 = 아래.
// 기준(anchor): 'self' = 공격자 발밑 (판정이 시작하는 틱 자리), 'hit' = 맞은 점 (맞은 틱에만 나온다).
// 화면은 480×270이라 14-8의 320×180 기준 크기에 1.5를 곱해 적는다.

export type GPt = readonly [number, number];

/**
 * 셀 색 단계 (캐릭터 색표 번호): 0 심 (흰·크림) · 1 주색 · 2 진한 주색 · 3 잉크 (아주 어두운) · 4 고리·테두리 (보색 소량)
 */
export type GTone = 0 | 1 | 2 | 3 | 4;

/** 모든 모양에 붙는 것 */
interface GBase {
  /** 기준: 공격자 발밑 (기본) · 맞은 점 */
  anchor?: 'self' | 'hit';
  /** 캐릭터 뒤 (기본) · 앞. 앞 겹에는 섬광·불씨만 (14-7 '맞는 사람은 덩어리 앞에') */
  layer?: 'back' | 'front';
  /** 최대 크기로 머무는 틱 (히트스톱 동안은 따로 머문다) */
  hold?: number;
  /** 그 뒤 두께부터 얇아져 사라지는 틱 (14-8 시간: 4~10) */
  fade?: number;
  /** 나타나는 틱 (기본 0) */
  delay?: number;
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
  /** 사는 틱 */
  life: number;
}

export type GShape = GWedge | GSwoosh | GBolt | GInk | GRing | GRays | GFlash | GEmbers;

/** 화면 전환 (문법 8): 맞힌 틱부터 */
export interface GScreen {
  /** 배경 누르기: 어둡게 (밝기 scale배 + 색) · 한 색 + 균열 */
  press?: { mode: 'tint' | 'crack'; ticks: number; color: string; scale?: number; crack?: string };
  /** 맞은 사람을 주색 실루엣 + 밝은 테두리로 (틱) */
  silhouette?: number;
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
  /** 맞은 점 빛 (실제 광원): 반지름 px, 틱 */
  light?: { r: number; t: number };
  /** 이 기술에 쓴 문법 번호 (14-8, 확인용) */
  grammar: readonly number[];
}
