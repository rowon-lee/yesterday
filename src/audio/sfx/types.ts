/**
 * 효과음 레시피 형식 (숫자 데이터). 효과음 하나 = 부품(층) 몇 개를 겹친 것 (사운드기획서 1장).
 * 시간은 초, 주파수는 Hz, 크기는 0~1 배율. 재생할 때 피치·길이를 조금씩 흔든다 (synth.ts).
 */

/**
 * 엔벨로프: a 올라감, h 머묾 (그동안 크기가 hl배까지 천천히 줄어듦), d 내려감 (지수로 -60dB까지).
 * hs가 있으면 머묾 길이를 히트스톱에 묶는다: 히트스톱 길이 × hs가 될 때까지 머문다 (강타 몸통이 히트스톱 동안 이어짐)
 */
export interface Env {
  a: number;
  h?: number;
  hl?: number;
  hs?: number;
  d: number;
}

/** 필터: f에서 시작해 t초 동안 to로 쓸어 간다 (to 없으면 그대로) */
export interface Filt {
  type: BiquadFilterType;
  f: number;
  to?: number;
  t?: number;
  q?: number;
}

interface LayerBase {
  /** 이 층의 크기 */
  gain: number;
  /** 시작 (초, 소리 시작 기준) */
  at?: number;
  /** 히트스톱이 풀리는 순간부터 센다 (꼬리: 맞은 쪽이 날아가기 시작할 때) */
  afterStop?: boolean;
  filter?: Filt;
  /** 디스토션 세기 (tanh, 1이면 거의 그대로, 클수록 찌그러짐) */
  drive?: number;
}

/** 오실레이터: f에서 t초 동안 to로 피치 스윕 */
export interface OscLayer extends LayerBase {
  kind: 'osc';
  wave: OscillatorType;
  f: number;
  to?: number;
  t?: number;
  env: Env;
}

/** FM: 반송파 f, 변조파 f × ratio, 변조 깊이 index (변조파 주파수 배수) → indexTo로 t초 동안 */
export interface FmLayer extends LayerBase {
  kind: 'fm';
  f: number;
  to?: number;
  t?: number;
  ratio: number;
  index: number;
  indexTo?: number;
  env: Env;
}

/** 노이즈: 흰색(밝음)·분홍(고름)·갈색(어둡고 낮음) */
export interface NoiseLayer extends LayerBase {
  kind: 'noise';
  color: 'white' | 'pink' | 'brown';
  env: Env;
}

/**
 * 흩뿌림: 짧은 알갱이 count개를 spread 구간 안 아무 때에 낸다 (유리 조각, 물방울).
 * 알갱이마다 주파수는 f 범위(로그로 고름)에서, 내려감은 d 범위에서 고르고, rise배로 피치가 움직인다
 */
export interface ScatterLayer extends LayerBase {
  kind: 'scatter';
  count: number;
  wave: OscillatorType;
  f: readonly [number, number];
  rise?: number;
  spread: readonly [number, number];
  a: number;
  d: readonly [number, number];
}

export type Layer = OscLayer | FmLayer | NoiseLayer | ScatterLayer;

/** 소리가 가는 길: sfx 보통 효과음 (강타 때 낮아짐), focus 강타 자신 (낮아지지 않음), stage 무대 소리 */
export type BusName = 'sfx' | 'focus' | 'stage';

export interface Recipe {
  layers: readonly Layer[];
  /** 전체 크기 */
  gain: number;
  /** 리버브로 보내는 양 (0~1) */
  send: number;
  bus: BusName;
  /** 강타: 히트스톱 동안 다른 소리(효과음·무대·음악)를 이만큼 낮춘다 (dB) */
  duck?: number;
}
