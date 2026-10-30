/** 한 동작. 모든 동작은 12~14프레임, 속도는 프레임별 표시 틱(dur)으로 조절한다. */
export interface Motion {
  /** '캐릭터/동작' 꼴. 시트 파일 경로로도 쓴다. 예: 'raiden/jab' */
  name: string;
  /** 칸 크기. 기본 64. 96은 허용 여부를 먼저 묻는다. */
  cell?: number;
  /** 프레임별 표시 틱 수. 길이가 곧 프레임 수. */
  dur: readonly number[];
  /** 오른쪽을 보는 모습으로 frame번째 프레임을 칸 왼쪽 위 (ox, oy)에 그린다. */
  draw(ctx: CanvasRenderingContext2D, frame: number, ox: number, oy: number): void;
}

export const MIN_FRAMES = 12;
export const MAX_FRAMES = 14;
export const DEFAULT_CELL = 64;
/** 발밑 기준점 (64칸 기준) */
export const FOOT_X = 32;
export const FOOT_Y = 61;
