import { fxColor } from '../vfx';

/**
 * 라이덴 길티기어식 이펙트 색표 (동작연출지침서 14-8 '라이덴 색', data/vfx의 색 단계 번호 순서):
 * 0 심 흰·연분홍 #fff6f8 · 1 주색 밝은 빨강 #ff526e · 2 진한 주색 #cd1634 · 3 가장 바깥·잉크 검붉은 #46081e · 4 고리·테두리 자홍 #ff46c8 (소량)
 */
export const RAIDEN_GG_RAMP: readonly number[] = (['raidenFxCore', 'raidenFxRose', 'raidenFxScarlet', 'raidenFxDark', 'raidenFxSpark'] as const).map(fxColor);
