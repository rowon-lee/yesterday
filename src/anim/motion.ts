import type { HitSpec } from './boxes';
import type { Key } from './keyed';
import type { Joints } from './pose';
import type { LookName } from './skeleton';

/** 동작 데이터 (src/data/poses/). 숫자와 포즈만 들어 있다. */
export interface MotionData {
  /** '캐릭터/동작' 꼴. 시트 파일 경로로도 쓴다. 예: 'base/idle' */
  name: string;
  /** 뷰어에 보이는 이름 */
  label: string;
  /** 프레임별 표시 틱 수. 길이가 곧 프레임 수 (12~14) */
  dur: readonly number[];
  /** 끝나면 처음으로 돌아가는 동작 */
  loop?: boolean;
  keys: readonly Key[];
  hit?: HitSpec;
}

export interface DrawOptions {
  look?: LookName;
  /** 왼쪽을 보게 뒤집기 */
  flip?: boolean;
}

/** 한 동작. 모든 동작은 12~14프레임, 속도는 프레임별 표시 틱(dur)으로 조절한다. */
export interface Motion {
  name: string;
  label: string;
  /** 칸 크기. 기본 64. 96은 허용 여부를 먼저 묻는다. */
  cell?: number;
  dur: readonly number[];
  loop?: boolean;
  /** 프레임별 관절 위치 (판정용) */
  joints?: readonly Joints[];
  hit?: HitSpec;
  /** frame번째 프레임을 칸 왼쪽 위 (ox, oy)에 그린다. 기본은 오른쪽을 보는 모습. */
  draw(ctx: CanvasRenderingContext2D, frame: number, ox: number, oy: number, opts?: DrawOptions): void;
}

export const MIN_FRAMES = 12;
export const MAX_FRAMES = 14;
export const DEFAULT_CELL = 64;
/** 발밑 기준점 (64칸 기준). 서 있을 때 발바닥 맨 아랫줄이 이 줄이다. */
export const FOOT_X = 32;
export const FOOT_Y = 61;
