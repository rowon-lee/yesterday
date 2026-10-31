import type { MoveId } from '../data/moves/base';

/** 싸우는 사람의 상태 이름 */
export type Mode =
  | 'idle' | 'run' | 'guard' | 'blockstun' | 'crush'
  | 'jumpsquat' | 'air' | 'land' | 'dash' | 'airdash'
  | 'attack' | 'hitstun' | 'airhit' | 'knockdown' | 'getup' | 'tech'
  | 'ko' | 'win'
  /** 벽꽝: 건물 정면에 박혀 잠깐 갇힘 */
  | 'wallsplat';

/** 직렬화 가능한 평범한 객체. 위치·속도는 1/256px 정수. */
export interface Fighter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 = 오른쪽을 봄, -1 = 왼쪽 */
  facing: 1 | -1;
  mode: Mode;
  /** 이 상태에 들어온 뒤 지난 틱 */
  t: number;
  /** 길이가 정해지는 상태(경직, 착지 등)의 길이 */
  len: number;
  /** 지금 쓰는 기술 */
  move: MoveId | null;
  /** 이번 기술이 판정을 이미 냈다 (맞히든 막히든) */
  moveHit: boolean;
  /** 이번 기술이 맞았다 */
  moveConnected: boolean;
  /** 연타 다음 타를 예약 */
  queued: MoveId | null;
  /** 대시 방향 (1 앞, -1 뒤), 지상 점프 방향 */
  dir: number;
  /** 띄우기 뒤 쫓아가는 점프였는지, 2단 점프인지 (그림용) */
  jumpKind: 0 | 1 | 2;
  hp: number;
  meter: number;
  guard: number;
  guardWait: number;
  hitstop: number;
  invuln: number;
  flash: number;
  airJumpUsed: boolean;
  airDashUsed: boolean;
  /** 이번 콤보에서 맞은 횟수 */
  comboHits: number;
  /** 내려찍기를 맞아 땅에서 한 번 튈 차례 */
  bounce: boolean;
  /** 세게 맞은 경직 (그림 선택용) */
  heavyHit: boolean;
  /** 뛰기 그림을 넘기는 누적 거리 */
  runDist: number;
  wins: number;
  /** 공격 버튼을 누른 순간의 위·아래 방향 (미리 눌러 둔 공격이 나중에 나가도 방향을 지킨다) */
  atkDir: number;
  /** 버튼별 남은 버퍼 틱 [공격, 점프, 대시, 기술A, 기술B, 필살] */
  buf: number[];
  prevInput: number;
  /** 지금 기술이 이미 친 부서지는 물건 번호들 */
  propHits: number[];
  /** 이번에 날아가는 동안 이미 깎은 건물 덩어리 번호들 */
  cityHits: number[];
  /** 서 있는 바닥의 y (0 땅, 음수면 발판 위). 떠 있는 동안은 0 */
  floor: number;
  /** ↓+점프로 발판에서 내려온 뒤 발판을 지나치는 남은 틱 */
  dropT: number;
}

/** 건물 파괴 상태. hp는 덩어리마다 (1~100 멀쩡~금~구멍, 0 뚫림, -1 무너져 사라짐) */
export interface CityState {
  hp: number[];
  /** 무너진 기록: 건물 번호, 무너진 칸 범위, 틱 */
  collapses: Array<{ b: number; c0: number; c1: number; tick: number }>;
}

/** 부서지는 물건 하나의 상태. 위치·크기는 stage/citadel.ts의 BREAKABLES[번호] */
export interface PropState {
  hp: number;
  /** 0 멀쩡, 1 망가짐, 2 파괴 */
  stage: 0 | 1 | 2;
  /** 망가진 틱, 부서진 틱 (-1 아직) */
  damagedAt: number;
  brokenAt: number;
  /** 날아온 캐릭터에 부딪혀 부서졌다 */
  crashed: boolean;
  /** 부서질 때 맞은 방향 (1 오른쪽으로, -1 왼쪽으로). 잔해가 날아가는 쪽 */
  dir: number;
}

export type Phase = 'intro' | 'fight' | 'roundEnd' | 'matchEnd';

/** 이번 틱에 일어난 일. 렌더(이펙트·소리)가 읽고, 다음 틱에 비워진다. */
export interface SimEvent {
  type:
    | 'hit' | 'block' | 'crush' | 'tech' | 'ko' | 'cutin' | 'round' | 'fight' | 'timeup' | 'winner' | 'launch' | 'knockdown'
    /** 부서지는 물건: who = 물건 번호, text = 'damaged' | 'broken', heavy = 캐릭터가 부딪혀 부서짐 */
    | 'prop'
    /** 건물 덩어리가 깎임: text = 원인('hit' | 'fly' | 'explosion' | 'wallsplat'), combo = 깎인 덩어리 수 */
    | 'city'
    /** 건물이 무너짐: who = 건물 번호, combo = 무너진 폭(px), text = '첫 칸,끝 칸' */
    | 'collapse'
    /** 벽꽝: who = 때린 쪽 */
    | 'wallsplat';
  /** 한 사람 (때린 쪽, 기술 쓴 쪽, 이긴 쪽) */
  who: number;
  x: number;
  y: number;
  heavy?: boolean;
  combo?: number;
  move?: MoveId;
  text?: string;
}

export interface SimState {
  tick: number;
  /** 시드 난수 상태 (core/rng). 지금 규칙에는 무작위가 없지만 자리를 둔다. */
  rng: number;
  phase: Phase;
  /** 이 단계에 들어온 뒤 지난 틱 */
  phaseT: number;
  round: number;
  /** 남은 라운드 시간 (틱) */
  timer: number;
  /** 필살 컷인으로 둘 다 멈춘 남은 틱 */
  freeze: number;
  /** 라운드 승자 (-1 무승부) */
  roundWinner: number;
  /** 경기 승자 (-1 아직) */
  matchWinner: number;
  fighters: [Fighter, Fighter];
  events: SimEvent[];
  /** 부서지는 물건 (라운드마다 새로). 어느 물건이 언제 부서졌는지 양쪽 화면이 같게 보이도록 sim에 둔다 */
  props: PropState[];
  /** 건물 파괴: 덩어리 내구도와 무너진 기록. 라운드가 넘어가도 유지 */
  city: CityState;
  /** 무너질 때 게임 시간이 반 속도로 가는 남은 틱 */
  slow: number;
}
