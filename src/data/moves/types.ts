/**
 * 공격 데이터의 시간·판정·몸 이동 (틱 단위, 3-0a(2)). 그림과 따로 관리한다 (CLAUDE.md 시뮬레이션 원칙):
 * 애니메이션은 이 틱에 맞춰 재생만 하고, 프레임 수나 자세를 바꿔도 판정·캔슬·몸 이동은 바뀌지 않는다.
 * 틱은 기술 시작 뒤 0부터, 구간은 [시작, 끝) (끝 틱은 포함하지 않는다). 상자는 발밑 기준·오른쪽 보는 기준 px [x, y, w, h].
 */

/** 상자 (발밑 기준·오른쪽 보는 기준 px). sim과 anim이 같이 쓴다 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 상자 [x, y, w, h] */
export type BoxArr = readonly [number, number, number, number];

/** 판정 구간 하나: 그 틱 동안 이 상자로 맞는다 */
export interface HitSpan {
  /** [시작 틱, 끝 틱) */
  t: readonly [number, number];
  /** 공격 상자 (오스카 베기처럼 캐릭터 규칙이 판정을 내는 기술도 CPU 사거리 계산에 쓴다) */
  box: BoxArr | null;
  /** 차지 단계별 상자 (1단계부터, 모은 단계가 더 높으면 마지막 것). 없으면 box */
  levels?: ReadonlyArray<BoxArr | null>;
  /** 휘는 무기 판정 선 (백은우 연검): 이 선이 피격 상자를 지나야 맞는다. box는 이 선을 감싼 상자 */
  line?: ReadonlyArray<readonly [number, number]>;
}

/** 기술 하나의 시간표 */
export interface MoveTime {
  /** 그리는 동작 이름 (렌더·뷰어가 판정 상자를 그림에 겹칠 때 쓴다. sim은 피격 상자 시간표 이름으로만 쓴다) */
  motion: string;
  /** 기술 전체 길이 (틱) */
  total: number;
  /** 판정 구간 (없으면 판정 없는 기술). 발동 = 첫 구간 시작, 지속 = 첫 시작 ~ 마지막 끝, 회복 = 마지막 끝 ~ total */
  hits: readonly HitSpan[];
  /**
   * 캔슬 구간 [예약을 받기 시작하는 틱, 넘어가는 틱]: 연타 다음 타는 앞 틱부터 누르면 예약되고 뒤 틱에 넘어간다.
   * 평타를 길게 누르면 뒤 틱부터 차지로 넘어간다. CPU도 뒤 틱을 '판정 끝'으로 본다. 판정 없는 기술은 없다
   */
  chain?: readonly [number, number];
  /** 몸 이동: [틱 수, px] 구간을 차례로. 그 구간 동안 px를 고르게 나눠 앞으로 움직인다 (뒤로는 음수) */
  advance?: ReadonlyArray<readonly [number, number]>;
  /** 차지 단계별 몸 이동 (없는 단계는 advance) */
  levelAdvance?: ReadonlyArray<ReadonlyArray<readonly [number, number]> | null>;
  /** 내디딤: [from, to) 틱 동안 앞으로 speed px/틱 */
  step?: { from: number; to: number; speed: number };
  /** 벽 박차기: from 틱 전까지 벽에 머물고 [from, to) 동안 아래 대각선으로 곧게 날아간다 (px/틱) */
  dive?: { from: number; to: number; vx: number; vy: number };
  /** 순간이동: at 틱에 최대 dist px, 상대 바로 앞(가운데끼리 gap px)에서 멈춘다 */
  blink?: { at: number; dist: number; gap: number };
  /** 차지: 모으는 동안 [loop[0], loop[1]) 틱을 되풀이, 떼면 release 틱부터 친다 */
  charge?: { loop: readonly [number, number]; release: number };
  /** 캐릭터 규칙이 쓰는 시점 (틱, sim/chars/*.ts) */
  marks?: Readonly<Record<string, number>>;
  /** 필살기 연출 장면 길이 (틱, 장면 차례대로)·짧은 판 */
  scenes?: readonly number[];
  short?: readonly number[];
}

/** 피격 상자 시간표 한 구간: [틱 수, x, y, w, h] */
export type HurtSpan = readonly [number, number, number, number, number];
