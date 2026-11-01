import { RAIDEN_DECOR } from './decor/raiden';
import { LOOKS, type Decor, type Look, type LookName } from './skeleton';

/**
 * 캐릭터 겉모습 (스킨): 관절에 붙는 장식과 색 묶음. 동작은 캐릭터마다 따로 짜지만(CLAUDE.md), 같은 동작 그림을
 * 어느 캐릭터의 겉모습으로도 그릴 수 있다 (공통 맞는 동작, 아직 전용 동작이 없는 동작).
 * 색 묶음이 없는 것(번쩍임·흰 잔상)은 공통 색 묶음(LOOKS)을 쓴다.
 */
export interface Skin {
  id: string;
  label: string;
  decor?: Decor;
  looks: Partial<Record<LookName, Look>>;
}

/** 라이덴 1P: 붉은 몸, 검은 보랏빛 정장 재킷, 흰 셔츠 깃과 붉은 넥타이, 흰 머리(회색 안쪽 머리) */
const RAIDEN_P1: Look = {
  outline: 'ink', shadow: 'raidenDark', base: 'raiden', light: 'raidenLight',
  hair: ['paleGrey', 'white', 'fxWhite'],
  cloth: ['suitDark', 'suit', 'suitLight'],
  accent: ['raiden', 'raidenLight'],
  trim: 'white',
};
/** 라이덴 2P (같은 캐릭터끼리 붙을 때): 검붉은 몸, 회색 재킷, 검은 머리(붉은 윤기 테두리, 안쪽 머리는 몸보다 한 단계 어두운 검붉은색) */
const RAIDEN_P2: Look = {
  outline: 'ink', shadow: 'raidenDeep', base: 'raidenDark', light: 'raiden',
  hair: ['raidenDeep', 'suitDark', 'raiden'],
  cloth: ['suitGreyDark', 'suitGrey', 'suitGreyLight'],
  accent: ['raidenDark', 'raiden'],
  trim: 'paleGrey',
};
/** 검붉은 잔상 (대시·돌진) */
const RAIDEN_GHOST: Look = { outline: 'raidenDark', shadow: 'raidenDark', base: 'raidenDark', light: 'raidenDark' };
/** 차지로 모으는 동안 몸이 대표 색(붉은 전격)으로 빛난다 */
const RAIDEN_GLOW: Look = { outline: 'ink', shadow: 'raiden', base: 'raidenLight', light: 'white' };

export const SKINS = {
  base: { id: 'base', label: '기본 스틱맨', looks: {} },
  raiden: {
    id: 'raiden',
    label: '라이덴',
    decor: RAIDEN_DECOR,
    looks: { p1: RAIDEN_P1, p2: RAIDEN_P2, ghost1: RAIDEN_GHOST, ghost2: RAIDEN_GHOST, glow1: RAIDEN_GLOW, glow2: RAIDEN_GLOW },
  },
} as const satisfies Record<string, Skin>;
export type SkinId = keyof typeof SKINS;

export const isSkin = (s: string | null | undefined): s is SkinId => !!s && s in SKINS;

/** 캐릭터 전용 동작('raiden/…')은 그 캐릭터 겉모습으로 그린다. 기본·공통 동작('base/…', 'common/…')은 fallback */
export function skinForMotion(name: string, fallback: SkinId = 'base'): SkinId {
  const who = name.slice(0, name.indexOf('/'));
  return isSkin(who) && who !== 'base' ? who : fallback;
}

/** 이 캐릭터의 색 묶음 (없으면 공통) */
export function lookOf(skin: SkinId, look: LookName): Look {
  return (SKINS[skin].looks as Partial<Record<LookName, Look>>)[look] ?? LOOKS[look];
}
