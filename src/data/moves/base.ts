import type { JointName } from '../../anim/pose';

/**
 * 기술 하나의 수치 (피해·경직·밀림·날리기·연출…). 거리는 px, 속도는 px/틱, 시간은 틱. 피해는 체력 1000 기준.
 * **시간·판정·캔슬·몸 이동은 여기 없다**: 캐릭터 × 기술마다 data/moves/time.ts (틱 단위 발동·지속·회복, 판정 상자, 캔슬 구간,
 * 몸 이동·내디딤·벽 박차기·순간이동·차지 구간)와 data/moves/hurt.ts (피격 상자 시간표)에 따로 둔다 (3-0a(2)). 그림과 상관없다.
 */
export interface MoveData {
  /** 그림 이름 (src/data/poses/). 렌더가 그린다 (sim의 시간은 data/moves/time.ts) */
  motion: string;
  /** 이펙트가 시작하는 팔다리 구간 (렌더 전용: 번개·궤적이 이 관절에서 뻗는다). 판정과는 상관없다 */
  limb?: readonly [JointName, JointName];
  /** 번개 사거리 (px, 렌더 전용: 번개 휩쓸기 길이). 판정과는 상관없다 */
  reach?: number;
  damage: number;
  /** 막았을 때 깎이는 방어 내구도 */
  guardDamage: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  /** 지상에서 맞거나 막았을 때 밀리는 속도 */
  push: number;
  /** 맞으면 공중으로 뜬다 (띄우기, 공중 타격) */
  launch?: { vx: number; vy: number };
  /** 지상에서 맞으면 다운 (쓸기) */
  knockdown?: boolean;
  /** 공중에서 맞으면 바닥으로 내리꽂혀 한 번 튀고 다운 (내려찍기) */
  spike?: boolean;
  /** 화면 흔들림·번쩍임을 주는 강한 타격 */
  heavy?: boolean;
  /**
   * 궤적·번개 모양 (렌더 전용, 동작연출지침서 4장·7-1장): 번개·궤적 이펙트가 채우는 상자와 모양 (발밑 기준, 오른쪽 보는 기준 px).
   * 판정 상자는 data/moves/time.ts에 따로 있다 (처음에는 이 상자를 합쳐 옮겼다. 하나를 바꾸면 다른 쪽도 맞춘다)
   */
  box?: TrailBox;
  /**
   * 판정을 캐릭터 고유 규칙이 직접 낸다 (sim/chars가 strikeBox로): 공통 판정(공격 상자 겹침)과 물건 깎기를 하지 않는다.
   * 시간표의 상자는 사거리 계산(CPU)용으로만 쓴다. 오스카 베기 선 (두께 6px의 긴 선, 선보다 늦게 맞는다)
   */
  selfHit?: boolean;
  /** 맞히면 점프로 끊고 쫓아갈 수 있다 */
  jumpCancel?: boolean;
  /** 기력 소모 (칸) */
  meterCost?: number;
  /** 공중 기술 */
  air?: boolean;
  /** 공중에서도 쓸 수 있는 지상 기술 */
  alsoAir?: boolean;
  /** 방어 중·방어 막힘 중에도 쓸 수 있다 */
  fromGuard?: boolean;
  /** 공중에서 맞히면 때린 쪽도 맞은 쪽과 함께 떠오른다: 맞은 쪽 속도보다 이만큼 느리게 (px/틱) */
  airFollow?: number;
  /** 벽 쪽으로 날림: 맞은 쪽 뒤에 건물 정면이 있으면 정면에 박힌다 (벽꽝) */
  wall?: boolean;
  /**
   * 화면을 멈추고 컷인을 띄운 뒤 발동. 문자열(예전 형식: 사건·영상 훅 이름만)이나 컷인 데이터 (띠 색·한국어 이름·한자·정지 길이).
   * 컷인 그림은 render/cutin.ts가 이 데이터로 그린다
   */
  cutin?: string | CutinData;
  /** 벽 박차기: 맞히거나 막히면 (히트스톱이 끝난 뒤) 때린 쪽이 뒤로 튕겨 오르고 날아가는 구간 뒤로 넘어간다 (px/틱). 날아가는 구간은 시간표 dive */
  rebound?: { vx: number; vy: number };
  /** 헛치고 땅·발판에 닿으면 굳는 틱 (없으면 공중 공격 착지 굳음) */
  landLag?: number;
  /**
   * 차지 (공격 길게 눌렀다 떼기, 기획서 '누르기와 길게 누르기'). 모으는 동안 되풀이하는 구간과 떼면 치기 시작하는 틱은 시간표 charge.
   * levels: 모으기를 시작하고 at틱이 지나면 그 단계. 단계마다 피해·방어 깎기·날리기를 바꾼다 (나머지는 기술 데이터 그대로).
   * auto: 마지막 단계에서 이만큼 더 쥐고 있으면 저절로 나간다
   */
  charge?: {
    auto: number;
    levels: ReadonlyArray<ChargeLevel>;
  };
  /** 필살기 연출 (맞으면 장면 재생, 빗나가면 큰 빈틈) */
  cinematic?: Cinematic;
  /**
   * 다른 그림: 캐릭터 고유 규칙(CharHooks.altMotion)이 고르면 이 동작 그림으로 보인다 (판정 관절도 이 그림). 표시 틱은 motion과 같아야 한다
   * (발동·지속·회복은 motion으로 계산). 에드워드 염동력: 앞+스킬 2 끌어당김은 motion, 뒤+스킬 2 밀어냄은 alt
   */
  alt?: string;
}

/**
 * 필살기 컷인 (사용자 피드백 2026-11-02 '10. 공통 — 필살기 컷인'): 띠 색은 캐릭터 대표 색, 글자는 한국어 기술 이름
 * (한자가 있으면 한자를 크게, 한국어 이름은 작게). 영어를 쓰지 않는다. 색은 팔레트 이름 (render/palette.ts)
 */
export interface CutinData {
  /** 사건·영상 훅에 넘기는 이름 (화면에는 쓰지 않는다) */
  id: string;
  /** 기술 이름 (한국어, 도트 글자는 render/glyphs-ko.ts) */
  name: string;
  /** 한자 (있으면 크게) */
  hanja?: string;
  /** 띠 색 [어두운 아랫단, 바탕, 밝은 테두리 줄] */
  band: readonly [string, string, string];
  /** 글자 색 [심, 테두리] */
  ink: readonly [string, string];
  /** 덧무늬: 라이덴 번개 · 백은우 금실 · 에드워드 푸른 베일 · 오스카 핏빛 달 */
  accent?: { motif: 'bolt' | 'thread' | 'veil' | 'moon'; color: string; light: string };
  /** 발동 정지 길이 (틱, 없으면 RULES.SUPER_FREEZE) */
  freeze?: number;
  /** 정지 동안 배경을 거의 검게 (두 사람만 남긴다) */
  dark?: boolean;
}

/** 필살기 연출 장면 하나: 발동자 동작 + 상대 반응 동작 (표시 틱 합이 같다)과 렌더 표시 (카메라·확대·비 멈춤) */
export interface CineScene {
  a: CineActor;
  d: CineActor;
  cam?: 'a' | 'both';
  zoom?: number;
  still?: boolean;
}

/**
 * 필살기 연출 (캐릭터 기획서 '필살기 연출'): 맞으면 두 사람을 sim에서 고정하고 장면들을 차례로 재생한 뒤,
 * 끝에 피해·날리기·파괴를 한 번에 준다. 장면 하나 = 발동자 동작 하나 + 상대 반응 동작 하나 (표시 틱 합이 같다).
 */
export interface Cinematic {
  /**
   * 장면들. 렌더 표시 (sim은 읽지 않는다): cam 'a'면 카메라가 발동자에 머문다 (상대가 멀리 날아가도), zoom 확대 배수 (없으면 아래 zoom),
   * still이면 그 장면 동안 시간이 멈춘 듯 비가 공중에 선다
   */
  scenes: ReadonlyArray<CineScene>;
  /**
   * 짧은 판 (2026-11-02 '영역 전개형은 한 경기에서 두 번째부터 짧은 판'): 있으면 같은 경기에서 이 사람의 두 번째 연출부터 이 장면들을 재생한다
   * (전개 과정을 압축, 약 3초). 없으면 늘 scenes
   */
  short?: ReadonlyArray<CineScene>;
  /** 빗나가면 기술이 끝난 뒤 이만큼 더 굳는다 (큰 빈틈) */
  whiff: number;
  /** 연출 동안 카메라 확대 (렌더 전용, 정수배). 없으면 2배. 영역 전개형은 1 (보이는 화면 전체가 무대) */
  zoom?: number;
  /** 연출 끝에 상대를 날리는 힘과 벽 쪽으로 날림 */
  end: { launch: { vx: number; vy: number }; wall?: boolean };
}

/** 연출 장면 속 한 사람: 동작과 자리 키 [장면 진행 0~1, x, y] (맞힌 순간 발동자 자리 기준 px, 바라보는 쪽이 +x, 위가 -y) */
export interface CineActor {
  motion: string;
  pos: ReadonlyArray<readonly [number, number, number]>;
}

/**
 * 궤적 상자와 그 안을 채우는 번개·궤적 모양.
 * line: 앞으로 곧게 뻗는 줄기, arc: 반원(발차기), rise: 아래→위 세로, fall: 위→아래 반원, ground: 바닥을 쓰는 반원,
 * circle: 원(공중 돌려차기), tail: 몸 뒤로 끌리는 꼬리(대시), cone: 상자 왼쪽 가운데 꼭짓점에서 앞으로 퍼지는 원뿔(라이덴 투전승불 떼기),
 * dome: 바닥에 붙은 반구 (라이덴 화과산 날숨)
 */
export interface TrailBox {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'line' | 'arc' | 'rise' | 'fall' | 'ground' | 'circle' | 'tail' | 'cone' | 'dome';
}

/** 차지 한 단계 */
export interface ChargeLevel {
  at: number;
  damage: number;
  guardDamage: number;
  /** 날리기 (없으면 띄우지 않고 땅에서 밀려난다: push) */
  launch?: { vx: number; vy: number };
  /** 땅에서 밀려나는 속도 (px/틱, 없으면 기술의 push). launch가 없는 단계에 쓴다 */
  push?: number;
  /** 벽 쪽으로 날림 (벽꽝) */
  wall?: boolean;
  /** 맞히면 점프로 끊고 쫓아갈 수 있다 */
  jumpCancel?: boolean;
  /** 이 단계로 치면 기술이 끝난 뒤 이만큼 탈진한다 (아무것도 못 함, 패널티) */
  exhaust?: number;
  /** 이 단계의 궤적·번개 모양 (렌더 전용, 없으면 기술의 box). 판정 상자는 시간표 hits[].levels */
  box?: TrailBox;
}

const LIGHT = { guardDamage: 10, hitstun: 16, blockstun: 12, hitstop: 7, push: 1.3 };

/** 기본 스틱맨의 기술. 스킬 1·2·필살기는 캐릭터를 얹기 전까지 쓸 임시 기술이다. */
export const BASE_MOVES = {
  atk1: { motion: 'base/atk1', limb: ['eF', 'hF'], damage: 40, ...LIGHT },
  atk2: { motion: 'base/atk2', limb: ['eB', 'hB'], damage: 45, ...LIGHT, },
  atk3: {
    motion: 'base/atk3', limb: ['kF', 'fF'], damage: 55, ...LIGHT, hitstun: 19, hitstop: 8, push: 1.5,
  },
  atk4: {
    motion: 'base/atk4', limb: ['eF', 'hF'], damage: 80, guardDamage: 22,
    hitstun: 26, blockstun: 16, hitstop: 11, push: 4.2, heavy: true,
    launch: { vx: 8.0, vy: -4.5 }, wall: true,
  },
  launcher: {
    motion: 'base/launcher', limb: ['eF', 'hF'], damage: 60, guardDamage: 16,
    hitstun: 30, blockstun: 14, hitstop: 9, push: 1.5, launch: { vx: 0.6, vy: -11.2 }, jumpCancel: true,
  },
  sweep: {
    motion: 'base/sweep', limb: ['kF', 'fF'], damage: 60, guardDamage: 16,
    hitstun: 20, blockstun: 14, hitstop: 9, push: 2.0, knockdown: true,
  },
  /**
   * 대시 공격: 앞으로 대시하는 중 공격 (뒤로 대시하는 중이면 평타). 미끄러지는 힘을 실어 몸을 낮추고 앞팔을 낮게 내지른다.
   * 맞으면 땅에 선 채 경직 (띄우기·차지로 이어진다), 막히면 빈틈이 크다
   */
  dashAttack: {
    motion: 'base/dash_attack', limb: ['eF', 'hF'], damage: 65, guardDamage: 18,
    hitstun: 26, blockstun: 12, hitstop: 9, push: 2.4,
  },
  /**
   * 차지 (기본형): 공격을 길게 누르면 평타 뒤에 모으기로 넘어가고, 떼면 앞으로 내디디며 크게 내지른다. 기력은 쓰지 않는다.
   * 1단계(바로)는 비스듬히 띄워 점프로 쫓아 공중 콤보, 2단계(0.5초)는 더 세고 높이, 3단계(1초)는 막혀도 방어를 깨고 맞으면 벽 쪽으로 날린다
   */
  charge: {
    motion: 'base/charge', limb: ['eF', 'hF'], damage: 70, guardDamage: 30,
    hitstun: 30, blockstun: 9, hitstop: 12, push: 3.0, heavy: true,
    launch: { vx: 1.0, vy: -11.2 }, jumpCancel: true,
    charge: {
      auto: 60,
      levels: [
        { at: 0, damage: 70, guardDamage: 30, launch: { vx: 1.0, vy: -11.2 }, jumpCancel: true },
        { at: 30, damage: 100, guardDamage: 50, launch: { vx: 1.8, vy: -11.8 }, jumpCancel: true },
        { at: 60, damage: 140, guardDamage: 100, launch: { vx: 10.0, vy: -5.0 }, wall: true },
      ],
    },
  },
  air1: {
    motion: 'base/air1', limb: ['eF', 'hF'], damage: 35, guardDamage: 10,
    hitstun: 22, blockstun: 12, hitstop: 7, push: 1.0, launch: { vx: 0.9, vy: -4.0 }, air: true, jumpCancel: true, airFollow: 0.6,
  },
  air2: {
    motion: 'base/air2', limb: ['kF', 'fF'], damage: 40, guardDamage: 10,
    hitstun: 22, blockstun: 12, hitstop: 7, push: 1.0, launch: { vx: 0.9, vy: -4.0 }, air: true, jumpCancel: true, airFollow: 0.6,
  },
  air3: {
    motion: 'base/air3', limb: ['kF', 'fF'], damage: 55, guardDamage: 14,
    hitstun: 26, blockstun: 14, hitstop: 9, push: 1.8, launch: { vx: 6.0, vy: -3.5 }, air: true, airFollow: 1.4,
  },
  slam: {
    motion: 'base/slam', limb: ['eF', 'hF'], damage: 70, guardDamage: 18,
    hitstun: 30, blockstun: 16, hitstop: 11, push: 1.4, spike: true, heavy: true, air: true,
  },
  /** 벽 박차기 공격: 벽에 붙은 채 공격. 벽을 박차고 아래 대각선으로 날아가며 앞발로 찬다 */
  wallKick: {
    motion: 'base/wall_kick', limb: ['kF', 'fF'], damage: 65, guardDamage: 16,
    hitstun: 24, blockstun: 14, hitstop: 9, push: 2.0, launch: { vx: 4.5, vy: -4.0 }, air: true, jumpCancel: true,
    rebound: { vx: 1.6, vy: -4.6 }, landLag: 12,
  },
  skill1: {
    motion: 'base/skill1', limb: ['eF', 'hF'], damage: 90, guardDamage: 25,
    hitstun: 28, blockstun: 16, hitstop: 10, push: 3.2, launch: { vx: 7.0, vy: -6.0 },
    meterCost: 1, alsoAir: true, heavy: true,
  },
  skill2: {
    motion: 'base/skill2', damage: 50, guardDamage: 30,
    hitstun: 24, blockstun: 20, hitstop: 10, push: 6.0, launch: { vx: 9.0, vy: -4.5 }, wall: true, meterCost: 1, fromGuard: true, heavy: true,
  },
  super: {
    motion: 'base/super', limb: ['eF', 'hF'], damage: 280, guardDamage: 60,
    hitstun: 40, blockstun: 24, hitstop: 12, push: 3.6, launch: { vx: 11.0, vy: -8.0 },
    meterCost: 3, heavy: true, wall: true, cutin: 'SUPER',
    // 임시 필살기 연출: 난타 → 어퍼로 띄우기 → 내려찍기 (약 2.1초, 각 장면 14프레임)
    cinematic: {
      whiff: 40,
      end: { launch: { vx: 5.0, vy: -4.5 }, wall: true },
      scenes: [
        {
          a: { motion: 'base/super_rush', pos: [[0, 0, 0], [1, 6, 0]] },
          d: { motion: 'base/super_rush_hit', pos: [[0, 26, 0], [1, 34, 0]] },
        },
        {
          a: { motion: 'base/super_rise', pos: [[0, 6, 0], [0.3, 8, 0], [1, 14, -70]] },
          d: { motion: 'base/super_rise_hit', pos: [[0, 34, 0], [0.36, 34, 0], [1, 44, -118]] },
        },
        {
          a: { motion: 'base/super_slam', pos: [[0, 14, -70], [0.3, 40, -150], [0.5, 42, -110], [0.68, 40, 0], [1, 38, 0]] },
          d: { motion: 'base/super_slam_hit', pos: [[0, 44, -118], [0.33, 46, -126], [0.62, 50, 0], [1, 54, 0]] },
        },
      ],
    },
  },
} as const satisfies Record<string, MoveData>;

export type MoveId = keyof typeof BASE_MOVES;

/** 연타 순서 */
export const GROUND_CHAIN: readonly MoveId[] = ['atk1', 'atk2', 'atk3', 'atk4'];
/** 길게 누르면 차지로 이어지는 평타 (땅에서 시작한 평타만. 공중 공격·벽 박차기 공격은 아니다) */
export const CHARGE_FROM: ReadonlySet<MoveId> = new Set(['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack']);
export const AIR_CHAIN: readonly MoveId[] = ['air1', 'air2', 'air3'];
