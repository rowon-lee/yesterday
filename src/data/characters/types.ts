import type { MoveData, MoveId } from '../moves/base';
import type { BASE_STATS } from './base';

/**
 * 상태(모드)에 맞는 동작 그림 자리. 캐릭터마다 자기 동작 이름을 넣고, 아직 없는 자리는 기본 스틱맨 동작을 쓴다.
 * 맞는 동작 7개(common/)는 모든 캐릭터가 같이 쓰므로 자리가 없다.
 */
export type MotionSlot =
  | 'idle' | 'intro' | 'win'
  | 'run_f' | 'run_b' | 'jump' | 'jump2' | 'fall' | 'land' | 'dash' | 'air_dash'
  | 'guard' | 'guard_hit'
  | 'wall_cling' | 'wall_jump' | 'wall_run' | 'wall_tech'
  /** 탈진 (강한 기술 뒤). 기본 스틱맨은 착지 그림으로 대신 */
  | 'exhaust';

/** 능력치 (px, px/틱, 틱). 이름과 뜻은 기본 스틱맨(base.ts)과 같다 */
export type Stats = { -readonly [K in keyof typeof BASE_STATS]: number };

/** 캐릭터 하나: 능력치와 동작 그림 자리 (숫자 데이터만) */
export interface CharacterData {
  id: string;
  label: string;
  stats: Stats;
  motions: Partial<Record<MotionSlot, string>>;
  /**
   * 기술마다 바꾸는 것: 그림(motion)과 기술 수치(피해·경직·밀림·날리기·이펙트 모양…).
   * 적지 않은 것은 기본 스틱맨 기술 그대로 쓴다. 발동·지속·회복·판정 상자·캔슬·몸 이동은 여기가 아니라 data/moves/time.ts (캐릭터 × 기술, 틱 단위).
   */
  moves?: Partial<Record<MoveId, Partial<MoveData>>>;
  /**
   * CPU가 스킬·필살기를 쓰는 거리 [가장 가까이, 가장 멀리] (px, 두 사람 가운데 사이).
   * 적지 않으면 그 기술의 판정이 닿는 거리 안에서 쓴다 (원격 베기·회복·순간이동처럼 판정 거리와 쓰는 거리가 다른 기술만 적는다)
   */
  cpu?: Partial<Record<'skill1' | 'skill2' | 'super', readonly [number, number]>>;
}
