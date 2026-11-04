// YESTERDAY 이펙트 실루엣 데이터 형식 (숫자 데이터만, 렌더 전용 그림의 설계도).
// 사용자 결정 (2026-11-04): 이펙트를 난수로 흩뿌리지 않는다. 공격마다 키 실루엣(피크·찢어짐·흩어짐)을
// 다각형 점으로 디자인하고, 키 사이는 같은 번호의 점끼리 보간한다. 그리는 것은 vfx/silhouette.
//
// 좌표: 공격자 발밑 기준, 오른쪽 보는 기준 px. x는 공격 방향 앞이 +, y는 아래가 + (위가 −, 바닥 = 0).
// 판정이 시작하는 틱의 공격자 자리에 놓이고, 왼쪽을 보면 좌우를 뒤집는다.

/**
 * 점 목록 (평평하게: x0, y0, x1, y1, …).
 * - fill: 다각형 고리. 점은 칸 모서리 (칸 i는 i ~ i+1을 덮는다). 칸 가운데가 안에 들면 칠한다 (짝홀 규칙: 고리 안의 고리는 구멍)
 * - line: 1px 꺾은선. 점은 칸 번호 (칸 i). 점 하나면 한 칸
 */
export type VRing = readonly number[];

/** 키 이름: 피크 (0틱에 가장 크게) · 찢어짐 (앞끝부터 가닥으로) · 흩어짐 (조각만 남음) */
export type VKeyName = 'peak' | 'tear' | 'scatter';

/** 실루엣 한 조각 (한 색) */
export interface VPart {
  /** 이름 (설계 그림·확인 표에 적는다) */
  id: string;
  /** 색 단계: 캐릭터 색표(render/chars의 실루엣 색표)의 번호 */
  step: number;
  /** fill = 칠한 다각형 · line = 1px 선 */
  kind: 'fill' | 'line';
  /** 캐릭터 뒤 (기본) · 앞. 앞 겹은 맞는 쪽만 덮고 공격자 몸통은 덮지 않는다 (14-5) */
  layer?: 'back' | 'front';
  /** 키마다 고리(꺾은선) 목록. 키 사이에 보간하려면 두 키의 고리 수와 고리마다 점 수가 같아야 한다. 어떤 키에 없으면 그 키부터 그리지 않는다 */
  keys: Partial<Record<VKeyName, readonly VRing[]>>;
}

/** 키 하나: 그 모양이 되는 틱과 그대로 머무는 틱 수 */
export interface VKey {
  name: VKeyName;
  /** 판정이 시작하는 틱 = 0 */
  at: number;
  /** 이 모양 그대로 머무는 틱 수 (기본 0) */
  hold?: number;
}

/** 배경 누르기 (동작연출지침서 14-1 ⑥): 맞힌 틱부터 ticks틱 */
export interface VPress {
  ticks: number;
  /** dark: 이펙트 색으로 납작하게 (공통 색표로 뭉침) · tint: 밝기를 scale배로 낮추고 color를 더한다 (무대 무늬는 그대로) */
  mode: 'dark' | 'tint';
  /** 세기 0~1 */
  k: number;
  /** dark: 물들일 색 · tint: 더할 색 ('#rrggbb') */
  color: string;
  /** tint: 밝기 배수 */
  scale?: number;
}

/** 공격 하나의 이펙트 실루엣 설계 */
export interface VDesign {
  /** 키 (at 순서). 마지막 키는 end 틱까지 머문다 */
  keys: readonly VKey[];
  end: number;
  /** 그리는 순서대로 (뒤에 적은 것이 위에 칠해진다) */
  parts: readonly VPart[];
  /** 눈이 먼저 가는 중심 (맞은 자리, 실제 광원 자리) */
  center: readonly [number, number];
  /** 덩어리 가운데 (두 번째 광원 자리) */
  mass?: readonly [number, number];
  press?: VPress;
  /** 이펙트 빛 번짐 배수 (기본 1): 덩어리가 아주 크면 번짐이 무대를 덮지 않게 줄인다 */
  glow?: number;
  /** 실제 광원 세기 배수 (기본 1) */
  light?: number;
}
