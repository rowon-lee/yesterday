import type { HitSpec } from './boxes';
import type { FollowSpec } from './follow';
import type { Key } from './keyed';
import type { Joints } from './pose';
import type { LookName } from './skeleton';
import type { SkinId } from './skins';

/** 동작 데이터 (src/data/poses/). 숫자와 포즈만 들어 있다. */
export interface MotionData {
  /** '캐릭터/동작' 꼴. 시트 파일 경로로도 쓴다. 예: 'base/idle' */
  name: string;
  /** 뷰어에 보이는 이름 */
  label: string;
  /** 프레임별 표시 틱 수. 길이가 곧 프레임 수 (동작의 목적에 맞게 정한다: 동작연출지침서 3장) */
  dur: readonly number[];
  /** 끝나면 처음으로 돌아가는 동작 */
  loop?: boolean;
  keys: readonly Key[];
  hit?: HitSpec;
  /** 큰 칸 128×96 (발밑 64, 93): 공격·기술·차지·필살기와 크게 날아가는 피격 (동작연출지침서 1장). 없으면 64×64 */
  wide?: boolean;
  /**
   * 스미어 프레임 (동작연출지침서 3장 '팔다리를 1.3~1.5배 늘려 그린다'): 그 프레임만 치는 팔다리(limb)를 stretch배 길이로 그린다.
   * 그림 전용 (판정 관절은 그대로). ghosts: 그 프레임에 앞 프레임부터의 잔상 개수 (장식의 ghost가 그린다: 에드워드 해머 머리)
   */
  smear?: { frame: number; limb: 'aF' | 'aB' | 'lF' | 'lB' | 'kF' | 'kB'; stretch: number; ghosts?: number };
  /**
   * 따라 움직이는 것 (anim/follow.ts): 휘는 무기(연검 리본)·옷자락·머리의 늦게 따라오는 움직임을 미리 계산해 프레임마다 관절(fx)에 붙인다.
   * 그림 전용 (연검 판정 선은 여기서 뽑아 공격 데이터에 적는다)
   */
  follow?: FollowSpec;
  /**
   * 몸 크기 배율 (없으면 1): 풀린 관절을 발밑 기준점에서 이만큼 키운다 (포즈 수치·뼈 길이는 그대로, 그림·판정 관절 모두).
   * 체격이 큰 캐릭터 (에드워드 키 약 58px, 2026-11-02 피드백 12-0)
   */
  scale?: number;
}

/** 캐릭터 칸: 크기와 발밑 기준점 (칸 왼쪽 위 기준) */
export interface Cell {
  w: number;
  h: number;
  fx: number;
  fy: number;
}
/** 보통 칸 64×64, 발밑 (32, 61) */
export const SMALL_CELL: Cell = { w: 64, h: 64, fx: 32, fy: 61 };
/** 큰 칸 128×96, 발밑 (64, 93). 보통 칸과 발밑을 맞춰 바꿔 그린다 */
export const WIDE_CELL: Cell = { w: 128, h: 96, fx: 64, fy: 93 };
/** 이 동작의 칸 */
export const cellOf = (m: { cell?: Cell }): Cell => m.cell ?? SMALL_CELL;

export interface DrawOptions {
  look?: LookName;
  /** 왼쪽을 보게 뒤집기 */
  flip?: boolean;
  /** 캐릭터 겉모습 (장식·색 묶음). 기본은 기본 스틱맨 */
  skin?: SkinId;
}

/** 한 동작. 프레임 수는 동작의 목적에 맞게 정하고(12~14 규칙은 2026-11-02 폐기), 속도는 프레임별 표시 틱(dur)으로 조절한다. */
export interface Motion {
  name: string;
  label: string;
  /** 칸 (크기와 발밑). 없으면 보통 칸 64×64 */
  cell?: Cell;
  dur: readonly number[];
  loop?: boolean;
  /** 프레임별 관절 위치 (판정용) */
  joints?: readonly Joints[];
  hit?: HitSpec;
  /** frame번째 프레임을 칸 왼쪽 위 (ox, oy)에 그린다. 기본은 오른쪽을 보는 모습. */
  draw(ctx: CanvasRenderingContext2D, frame: number, ox: number, oy: number, opts?: DrawOptions): void;
  /** 미리 그린 시트 (프레임을 가로로 늘어놓은 캔버스, 색 한 벌·방향 하나·캐릭터 겉모습 하나). 2.5D 렌더가 텍스처로 쓴다 */
  sheet?(look: LookName, flip: boolean, skin?: SkinId): HTMLCanvasElement;
}

export const DEFAULT_CELL = 64;
/** 발밑 기준점 (보통 칸 64 기준, SMALL_CELL과 같다). 서 있을 때 발바닥 맨 아랫줄이 이 줄이다. 칸마다 다르면 cellOf(m)를 쓴다 */
export const FOOT_X = 32;
export const FOOT_Y = 61;
