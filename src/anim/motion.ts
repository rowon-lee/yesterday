import type { HitSpec } from './boxes';
import type { FollowSpec } from './follow';
import type { CellFrame } from './bake';
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
  /** 칸을 직접 정한다 (wide보다 먼저): 큰 워 해머가 128×96을 넘는 에드워드 (EDWARD_CELL) */
  cell?: Cell;
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
/**
 * 에드워드 칸 144×108, 발밑 (72, 105): 키운 회색 워 해머(2026-11-05 피드백 '회색 워해머 정도로 크기도 키우고')를 머리 위로 들거나
 * 끝까지 뻗으면 128×96을 넘는다 (가장 높이 99px, 앞 67px, 뒤 61px). 발밑 아래 여유는 다른 칸과 같은 3px (바닥에 박힌 해머 머리는 바닥선에서 잘린다)
 */
export const EDWARD_CELL: Cell = { w: 144, h: 108, fx: 72, fy: 105 };
/** 가장 큰 칸 (잔상·실루엣을 그리는 캔버스 크기) */
export const MAX_CELL = { w: 144, h: 108 } as const;
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
  /**
   * 한 프레임을 색 입혀 칸 캔버스(돌려 쓰는 것 하나)에 옮겨 둔다: 그 캔버스의 (0, 0, w, h)를 칸 안 (x, y)에 붙이면 된다.
   * 다음 image·draw 호출 때 덮어쓰므로 바로 옮겨 그린다 (확대해서 붙일 때)
   */
  image?(frame: number, opts?: DrawOptions): { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number };
  /** 한 프레임의 칸 크기 픽셀 (RGBA를 32비트 하나로, 투명은 0). 이펙트가 몸 윤곽·밝기를 따라갈 때 */
  rgba?(frame: number, opts?: DrawOptions): Uint32Array;
  /** 프레임마다 색 번호 그림 (칸 안에서 그림이 있는 네모만). 처음 부르면 그 겉모습을 다 그린다 */
  frames?(skin: SkinId): readonly CellFrame[];
  /** 불러오기 화면이 조금씩 그릴 때: deadline(performance.now)까지 그리고, 다 그렸으면 true */
  bakeSome?(skin: SkinId, deadline?: number): boolean;
  isBaked?(skin: SkinId): boolean;
  /** 다른 곳(그림 일꾼, render/sprite-workers)에서 다 그린 프레임을 받아 둔다 (이미 다 그렸으면 그대로) */
  adopt?(skin: SkinId, frames: CellFrame[]): void;
}

export const DEFAULT_CELL = 64;
/** 발밑 기준점 (보통 칸 64 기준, SMALL_CELL과 같다). 서 있을 때 발바닥 맨 아랫줄이 이 줄이다. 칸마다 다르면 cellOf(m)를 쓴다 */
export const FOOT_X = 32;
export const FOOT_Y = 61;
