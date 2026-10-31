import type { JointName } from '../../anim/pose';

/**
 * 기술 하나. 발동·지속·후딜레이는 그 동작 그림의 프레임별 표시 틱(dur)과 판정 프레임(active)으로 정해진다.
 * 거리는 px, 속도는 px/틱, 시간은 틱. 피해는 체력 1000 기준.
 */
export interface MoveData {
  /** 그림 이름 (src/data/poses/) */
  motion: string;
  /** 공격 판정이 있는 프레임 번호 (0부터) */
  active: readonly number[];
  /** 판정 구간: 팔꿈치→주먹, 무릎→발. 없으면 몸 둘레 전체 (밀쳐내기류) */
  limb?: readonly [JointName, JointName];
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
  /** 이 프레임 동안 앞으로 이동 */
  step?: { from: number; to: number; speed: number };
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
  /** 공중에서 맞히면 때린 쪽도 이 속도로 떠올라 따라간다 (px/틱, 위가 -) */
  airFollow?: number;
  /** 화면을 어둡게 하고 컷인을 띄운 뒤 발동 */
  cutin?: string;
}

const LIGHT = { guardDamage: 10, hitstun: 16, blockstun: 12, hitstop: 7, push: 1.3 };

/** 기본 스틱맨의 기술. 기술 A·B·필살은 캐릭터를 얹기 전까지 쓸 임시 기술이다. */
export const BASE_MOVES = {
  atk1: { motion: 'base/atk1', active: [4, 5], limb: ['eF', 'hF'], damage: 40, ...LIGHT },
  atk2: { motion: 'base/atk2', active: [4, 5], limb: ['eB', 'hB'], damage: 45, ...LIGHT, step: { from: 2, to: 4, speed: 2.0 } },
  atk3: {
    motion: 'base/atk3', active: [5, 6], limb: ['kF', 'fF'], damage: 55, ...LIGHT, hitstun: 19, hitstop: 8, push: 1.5,
    step: { from: 2, to: 5, speed: 2.2 },
  },
  atk4: {
    motion: 'base/atk4', active: [6, 7], limb: ['eF', 'hF'], damage: 80, guardDamage: 22,
    hitstun: 26, blockstun: 16, hitstop: 11, push: 4.2, heavy: true, step: { from: 4, to: 7, speed: 3.2 },
    launch: { vx: 4.0, vy: -2.9 },
  },
  launcher: {
    motion: 'base/launcher', active: [4, 5, 6], limb: ['eF', 'hF'], damage: 60, guardDamage: 16,
    hitstun: 30, blockstun: 14, hitstop: 9, push: 1.5, launch: { vx: 0.6, vy: -7.4 }, jumpCancel: true,
    step: { from: 2, to: 5, speed: 2.2 },
  },
  sweep: {
    motion: 'base/sweep', active: [4, 5, 6], limb: ['kF', 'fF'], damage: 60, guardDamage: 16,
    hitstun: 20, blockstun: 14, hitstop: 9, push: 2.0, knockdown: true, step: { from: 2, to: 5, speed: 1.8 },
  },
  air1: {
    motion: 'base/air1', active: [3, 4], limb: ['eF', 'hF'], damage: 35, guardDamage: 10,
    hitstun: 22, blockstun: 12, hitstop: 7, push: 1.0, launch: { vx: 0.7, vy: -2.9 }, air: true, jumpCancel: true, airFollow: -1.9,
  },
  air2: {
    motion: 'base/air2', active: [3, 4], limb: ['kF', 'fF'], damage: 40, guardDamage: 10,
    hitstun: 22, blockstun: 12, hitstop: 7, push: 1.0, launch: { vx: 0.7, vy: -2.9 }, air: true, jumpCancel: true, airFollow: -1.9,
  },
  air3: {
    motion: 'base/air3', active: [4, 5], limb: ['kF', 'fF'], damage: 55, guardDamage: 14,
    hitstun: 26, blockstun: 14, hitstop: 9, push: 1.8, launch: { vx: 3.0, vy: -2.4 }, air: true, airFollow: -1.2,
  },
  slam: {
    motion: 'base/slam', active: [5, 6, 7], limb: ['eF', 'hF'], damage: 70, guardDamage: 18,
    hitstun: 30, blockstun: 16, hitstop: 11, push: 1.4, spike: true, heavy: true, air: true,
  },
  skillA: {
    motion: 'base/skill_a', active: [4, 5, 6, 7, 8], limb: ['eF', 'hF'], damage: 90, guardDamage: 25,
    hitstun: 28, blockstun: 16, hitstop: 10, push: 3.2, launch: { vx: 3.4, vy: -4.3 },
    step: { from: 2, to: 8, speed: 7.0 }, meterCost: 1, alsoAir: true, heavy: true,
  },
  skillB: {
    motion: 'base/skill_b', active: [5, 6], damage: 50, guardDamage: 30,
    hitstun: 24, blockstun: 20, hitstop: 10, push: 6.0, launch: { vx: 5.0, vy: -2.9 }, meterCost: 1, fromGuard: true, heavy: true,
  },
  super: {
    motion: 'base/super', active: [6, 7, 8], limb: ['eF', 'hF'], damage: 280, guardDamage: 60,
    hitstun: 40, blockstun: 24, hitstop: 12, push: 3.6, launch: { vx: 5.6, vy: -5.2 },
    step: { from: 4, to: 8, speed: 4.0 }, meterCost: 3, heavy: true, cutin: 'SUPER',
  },
} as const satisfies Record<string, MoveData>;

export type MoveId = keyof typeof BASE_MOVES;

/** 연타 순서 */
export const GROUND_CHAIN: readonly MoveId[] = ['atk1', 'atk2', 'atk3', 'atk4'];
export const AIR_CHAIN: readonly MoveId[] = ['air1', 'air2', 'air3'];
