import { fxColor } from '../vfx';

/**
 * 백은우 길티기어식 이펙트 색표 (동작연출지침서 14-4 '흰 → 은백 → 옅은 하늘 → 금색 실 한 가닥', data/vfx의 색 단계 번호 순서):
 * 0 심 흰·크림 #fffbef · 1 주색 은백 #d3e0f2 · 2 진한 주색 옅은 하늘 #86bde8 · 3 잉크 아주 어두운 남색 #101a3c · 4 금실 #ffcf52 (소량)
 * · 5 백합 꽃잎 연분홍 · 6 짙은 하늘 #3d63a8 (물빛 그늘)
 */
export const EUNWOO_GG_RAMP: readonly number[] = (['eunwooFxCore', 'eunwooFxSilver', 'eunwooFxSky', 'eunwooFxInk', 'eunwooFxGold', 'lilyLight', 'eunwooFxDeep'] as const).map(fxColor);

/** 14-9 L 색 뒤집기: 1틱 동안 은백 → 금실, 옅은 하늘 → 호박색 (보색 쪽 따뜻한 빛) */
export const EUNWOO_GG_FLIP: readonly number[] = (['eunwooFxCore', 'eunwooFxGold', 'eunwooFxAmber', 'eunwooFxInk', 'eunwooFxCore', 'lilyLight', 'eunwooFxDeep'] as const).map(fxColor);
