import type { CharId } from '../../data/characters';
import type { MoveId } from '../../data/moves/base';
import type { PlayerInput } from '../input';
import type { Fighter, SimState } from '../types';
import { EDWARD_HOOKS } from './edward';
import { EUNWOO_HOOKS } from './eunwoo';
import { OSCAR_HOOKS } from './oscar';
import { RAIDEN_HOOKS } from './raiden';

/**
 * 캐릭터 고유 규칙 (고유 특성·스킬·차지·필살기의 특별한 효과). sim의 정해진 자리에서 부른다.
 * 모두 결정론이어야 한다 (무작위 함수·시간 값 금지: 난수는 s.rng, 렌더·DOM 모름). 위치·속도는 1/256px 정수.
 * 캐릭터만의 상태는 f.ext (숫자 배열, 길이 EXT_LEN, 라운드마다 0으로)에 둔다: 칸 번호는 그 캐릭터 파일이 정한다.
 * 다른 사람에게 거는 상태(느려짐 등)는 공통 필드(slowT 등)를 쓴다.
 */
export interface CharHooks {
  /** 라운드가 시작할 때 (f.ext는 이미 0으로 비워져 있다) */
  reset?(s: SimState, f: Fighter): void;
  /** 틱마다 updateFighter 맨 앞 (히트스톱으로 멈춘 틱·연출 중에는 불리지 않는다) */
  tick?(s: SimState, f: Fighter, input: PlayerInput): void;
  /** 기술을 시작한 순간 (기력은 이미 깎였고 mode는 'attack') */
  start?(s: SimState, f: Fighter, id: MoveId): void;
  /** 기술 진행 중 틱마다 (몸 이동 앞). true를 돌려주면 그 틱의 기본 몸 이동(advance·blink·dive·step)을 건너뛴다 */
  move?(s: SimState, f: Fighter, id: MoveId, input: PlayerInput): boolean | void;
  /** 때리는 쪽: 맞힌 피해를 바꾼다 (콤보 보정 뒤, 맞는 쪽 defend 앞) */
  damage?(s: SimState, att: Fighter, def: Fighter, id: MoveId, damage: number): number;
  /** 때리는 쪽: 이 타격이 막혀도 방어를 깨는가 (가드 크러시) */
  breaks?(s: SimState, att: Fighter, def: Fighter, id: MoveId): boolean;
  /**
   * 맞는 쪽: 받을 피해를 바꾼다. -1을 돌려주면 이 타격을 통째로 막아 낸다 (체력·경직·날림 없음, 히트스톱만,
   * 사건 { type: 'char', who: 막은 사람, text: 'shield' }). 막기(가드)와 따로, 맞을 때만 불린다
   */
  defend?(s: SimState, def: Fighter, att: Fighter, id: MoveId, damage: number): number;
  /** 때리는 쪽: 판정을 낸 뒤 (blocked = 막힘). 통째로 막혔으면 shielded */
  hit?(s: SimState, att: Fighter, def: Fighter, id: MoveId, blocked: boolean, shielded: boolean): void;
  /** 필살기 연출이 끝나 끝 타격을 준 뒤 */
  cineEnd?(s: SimState, att: Fighter, def: Fighter, id: MoveId): void;
}

/** f.ext 길이 */
export const EXT_LEN = 24;

const NONE: CharHooks = {};
let table: Partial<Record<CharId, CharHooks>> | null = null;
/** 이 캐릭터의 고유 규칙 (없으면 빈 것) */
export function hooksOf(c: CharId): CharHooks {
  const t = (table ??= { raiden: RAIDEN_HOOKS, eunwoo: EUNWOO_HOOKS, edward: EDWARD_HOOKS, oscar: OSCAR_HOOKS });
  return t[c] ?? NONE;
}
