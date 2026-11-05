import type { LookName } from '../../anim/skeleton';
import type { CharId } from '../../data/characters';
import { EDWARD_GG, EDWARD_GG_CHARGE, EDWARD_SKILL2, EDWARD_SUPER } from '../../data/vfx/edward';
import { EUNWOO_GG, EUNWOO_GG_DRAFTS, EUNWOO_GG_SUPER_END } from '../../data/vfx/eunwoo';
import { RAIDEN_GG, RAIDEN_GG_CHARGE } from '../../data/vfx/raiden';
import type { GMove } from '../../data/vfx/types';
import { COLORS } from '../palette';
import { EDWARD_GG_FLIP, EDWARD_GG_RAMP } from './edward-gg';
import { EUNWOO_GG_FLIP, EUNWOO_GG_RAMP } from './eunwoo-gg';
import { RAIDEN_GG_RAMP } from './raiden-gg';

/**
 * 캐릭터마다 길티기어식 이펙트 (동작연출지침서 14-8) 설정: 색표, 기술별 모양, 전조 모양, 맞은 점 빛·실루엣·배경 누르기 색.
 * render/fightvfx가 캐릭터 이름 대신 이 표를 본다
 */
export interface GGChar {
  ramp: readonly number[];
  /** 14-9 L 색 뒤집기 색표 */
  flip?: readonly number[];
  /** 기술 이펙트 (차지는 모은 단계, 필살기는 판정 물결이 맞힌 틱) */
  move(id: string, chargeLv: number): GMove | undefined;
  /** 전조가 사슬을 타는 모양: bolt 굵은 번개 (라이덴) · glint 은빛 리본 조각 (백은우, 사슬 = 연검 리본) · hammer 청동 조각 (에드워드, 사슬 = 팔 → 해머 머리) */
  prelude: 'bolt' | 'glint' | 'hammer';
  /** 맞은 점 빛 색, 맞은 사람 실루엣 색 묶음, 배경 누르기 어두운 단·밝은 단 */
  light: string;
  look: LookName;
  press: { dark: string; hi: string };
}

/**
 * 시안 고르기 (14-9 '4타·차지·스킬·필살기는 시안 3개'): 주소 ?ggdraft=atk4:2,charge:3 (확인 도구가 시안 피크 화면을 찍을 때).
 * 없으면 1번 (게임에 들어간 채택안)
 */
export const GG_DRAFT: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('ggdraft') : null;
  for (const part of (q ?? '').split(',')) {
    const [k, v] = part.split(':');
    if (k && v && Number(v) >= 1 && Number(v) <= 3) out[k] = Number(v);
  }
  return out;
})();
export const draftOf = (id: string): number => GG_DRAFT[id] ?? 1;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const GG_CHARS: Partial<Record<CharId, GGChar>> = {
  raiden: {
    ramp: RAIDEN_GG_RAMP,
    move: (id, lv) => (id === 'charge' ? RAIDEN_GG_CHARGE[clamp(lv, 1, 4) - 1] : RAIDEN_GG[id]),
    prelude: 'bolt',
    light: COLORS.raidenFxRose,
    look: 'struck',
    press: { dark: COLORS.raidenFxDark, hi: COLORS.raidenFxRose },
  },
  eunwoo: {
    ramp: EUNWOO_GG_RAMP,
    flip: EUNWOO_GG_FLIP,
    move: (id, lv) => {
      const d = draftOf(id) - 1;
      if (id === 'charge') return EUNWOO_GG_DRAFTS.charge[d]?.[clamp(lv, 1, 3) - 1];
      if (id === 'atk4') return EUNWOO_GG_DRAFTS.atk4[d];
      // 필살기 'hit'은 연출 끝 한 번에 들어가는 피해 (판정 물결은 연출 시작 사건: render/fightvfx eunwooSuperStart)
      if (id === 'super') return EUNWOO_GG_SUPER_END;
      return EUNWOO_GG[id];
    },
    prelude: 'glint',
    light: COLORS.eunwooFxSilver,
    look: 'struckEw',
    press: { dark: COLORS.eunwooFxInk, hi: COLORS.eunwooFxSilver },
  },
  edward: {
    ramp: EDWARD_GG_RAMP,
    flip: EDWARD_GG_FLIP,
    // 시안은 사용자가 골랐다 (2026-11-05): 고른 것만 data/vfx/edward에 둔다
    move: (id, lv) => {
      if (id === 'charge') return EDWARD_GG_CHARGE[clamp(lv, 1, 3) - 1];
      // 염동력은 맞힌 틱의 맞은 점 모양 (장막 손·벽·터짐은 sim 사건: render/fightvfx edwardEvent)
      if (id === 'skill2') return EDWARD_SKILL2.hit;
      // 필살기 'hit'은 연출 끝 한 번에 들어가는 피해 (잡는 순간은 연출 시작 사건: render/fightvfx edwardSuperStart)
      if (id === 'super') return EDWARD_SUPER.end;
      return EDWARD_GG[id];
    },
    prelude: 'hammer',
    light: COLORS.edwardFxBronze,
    look: 'struckEd',
    press: { dark: COLORS.edwardFxInk, hi: COLORS.edwardFxBronze },
  },
};
