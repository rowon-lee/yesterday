import { fxColor } from '../vfx';

/**
 * 에드워드 길티기어식 이펙트 색표 (동작연출지침서 14-4 '흰 → 청동 → 짙은 청동 → 푸른 잔상(껍데기 색)', data/vfx의 색 단계 번호 순서):
 * 0 심 따뜻한 흰 #fff3dc · 1 주색 밝은 청동 #eba64e · 2 진한 주색 짙은 청동 #9c5822 · 3 잉크 아주 어두운 밤색 #170b06
 * · 4 푸른 잔상 (껍데기 장막 #4f8fff) · 5 밝은 장막 #b6d4ff · 6 짙은 장막 #2a4ca8
 */
export const EDWARD_GG_RAMP: readonly number[] = (['edwardFxCore', 'edwardFxBronze', 'edwardFxDeep', 'edwardFxInk', 'veil', 'veilLight', 'veilDark'] as const).map(fxColor);

/** 14-9 L 색 뒤집기: 1틱 동안 청동이 껍데기의 푸른 장막으로 (밝은 청동 → 장막, 짙은 청동 → 짙은 장막), 푸른 잔상은 청동으로 */
export const EDWARD_GG_FLIP: readonly number[] = (['edwardFxCore', 'veil', 'veilDark', 'edwardFxInk', 'edwardFxBronze', 'veilLight', 'veilDark'] as const).map(fxColor);
