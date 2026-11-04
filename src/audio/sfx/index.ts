/**
 * 효과음 모음. 지금은 공통 타격음(2-1)만. 이동(2-2)·캐릭터 표식(2-3)·연출(2-4)·무대(2-5)·화면(2-6)은 같은 형식으로 더한다.
 */
import { HIT_SFX } from './hit';
import type { Recipe } from './types';

export const SFX = { ...HIT_SFX } as const;

export type SfxName = keyof typeof SFX;

/** 소리 하나를 부르는 말 (sim 사건 → 소리 연결이 만들고, 엔진이 튼다) */
export interface Cue {
  sound: SfxName;
  /** 콤보 단계 (1~4, 연타 단계 기준). 단계가 없는 소리는 1 */
  step: number;
  /** 이 타격의 히트스톱 (틱, 없으면 0). 강타 몸통 길이·덕킹 길이 */
  stop: number;
}

export function recipeFor(c: Pick<Cue, 'sound' | 'step'>): Recipe {
  const list: readonly Recipe[] = SFX[c.sound];
  return list[Math.max(0, Math.min(list.length - 1, c.step - 1))]!;
}

/** 틱 → 초 (1초 60틱) */
export const TICK_SEC = 1 / 60;

/** 재생할 때마다 흔드는 폭: 피치 ±3.5%, 길이 ±6% (사운드기획서 1장 '같은 소리도 조금씩') */
export const JITTER = { pitch: 0.035, stretch: 0.06 };
