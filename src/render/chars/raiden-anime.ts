import type { AnimeLook, AnimeMove } from '../../vfx/anime';
import { COLORS } from '../palette';
import { fxColor } from '../vfx';

/**
 * 라이덴 애니 격투 이펙트 (동작연출지침서 14장): 색표와 모양값만 적는다. 그리는 것은 공용 부품 (vfx/anime).
 * 4색 띠 (14-4): 흰 심 → 밝은 빨강 → 검붉은 → 자홍 테두리 소량 (노랑·주황 금지).
 * 고유 모양: 꽉 찬 번개 띠 (가장자리가 3px쯤 꺾이고 2틱마다 다시 꺾여 지직거린다) + 가지 치는 전류 가닥 (일반 2·강 4) + 꺾인 번개 조각 잔불.
 */
export const RAIDEN_LOOK: AnimeLook = {
  ramp: { core: fxColor('fxWhite'), main: fxColor('raidenFxRed'), deep: fxColor('raidenFxCrimson'), rim: fxColor('raidenFxMagenta') },
  press: COLORS.raidenFxCrimson,
  edge: 3,
  edgeStep: 7,
  crackle: 2,
  tail: 0.3,
  wiggle: 0.16,
  filaments: [2, 4],
  filamentLen: 22,
  ember: 'bolt',
  rimW: 2,
  coreIn: 2,
};

/**
 * 기술별 모양값: 길 모양·길이(머리 + 몸통 + 꼬리)·머리 두께. 머리 = 판정 상자 (data/characters/raiden의 box).
 * 등급 (14-3, 480×270이라 지침서 320×180 값 × 1.5): 1~3타 일반 (길이 72~144 · 두께 15~30), 4타 강 (192~288 · 36~72)
 * - 잽·크로스: 상자 가운데 높이로 앞으로 곧게 (사용자 피드백 9-2 '공격 하나에 방향 하나'는 그대로)
 * - 미들킥: 허리 높이 몸 앞쪽 반원 (뒤 → 아래 → 앞 → 위, 머리는 위)
 * - 슈퍼맨 펀치: 바닥을 타고 앞으로 달리는 줄기 (아래 절반은 바닥에 잘린다: 보이는 두께 ≈ 상자 반 높이 10 + 반두께 44 + 꺾임 ≈ 59px)
 */
export const RAIDEN_ANIME_MOVES: Partial<Record<string, AnimeMove>> = {
  atk1: { grade: 'normal', path: 'line', len: 135, width: 24 },
  atk2: { grade: 'normal', path: 'line', len: 144, width: 26 },
  atk3: { grade: 'normal', path: 'arc', len: 120, width: 24 },
  atk4: { grade: 'strong', path: 'ground', len: 280, width: 88, cap: 10, taper: 0.4 },
};
