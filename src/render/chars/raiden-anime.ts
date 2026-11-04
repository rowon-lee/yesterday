import type { AnimeLook, AnimeMove } from '../../vfx/anime';
import { COLORS } from '../palette';
import { fxColor } from '../vfx';

/**
 * 라이덴 애니 격투 이펙트 (동작연출지침서 14장): 색표와 모양값만 적는다. 그리는 것은 공용 부품 (vfx/anime).
 * 4색 띠 (14-4, 승인 2026-11-04): 흰 심 → 밝은 빨강 → 검붉은 → 자홍 테두리 소량 (노랑·주황 금지).
 * 고유 모양: 꽉 찬 번개 띠 (가장자리가 지그재그로 꺾이고 2틱마다 다시 꺾여 지직거린다) + 띠 안팎으로 굵게 갈라지는 전류 가지 + 꺾인 번개 조각 잔불.
 */
export const RAIDEN_LOOK: AnimeLook = {
  ramp: { core: fxColor('fxWhite'), main: fxColor('raidenFxRed'), deep: fxColor('raidenFxCrimson'), rim: fxColor('raidenFxMagenta') },
  press: COLORS.raidenFxCrimson,
  edge: 3,
  edgeStep: 6,
  crackle: 2,
  ember: 'bolt',
  rimW: 2,
  coreIn: 2,
};

/**
 * 기술별 모양값 (사용자 피드백 2026-11-04): 힘이 주먹에서 상대를 관통해 앞으로 터져 나간다. 덩어리는 상대 너머, 찢어진 가닥은 앞끝.
 * 흰 심이 든 가장 밝은 곳 = 판정 상자 (data/characters/raiden의 box). 등급 (14-3, 480×270이라 지침서 값 × 1.5):
 * 1~3타 일반 (길이 72~144 · 두께 15~30), 4타 강 (192~288 · 36~72). 타마다 다르게:
 * - 잽: 가늘고 빠른 직선 (유지 1틱, 가닥이 빨리 날아간다), 가시 3개 좁은 부채꼴
 * - 크로스: 더 굵은 직선 + 굵은 전류 가지 4, 가시 5개 넓은 부채꼴
 * - 미들킥: 발이 지난 반원을 번개 줄기 3가닥으로 (매끈한 초승달 금지, 9-2, 앞 겹이라 맞는 쪽 몸에 가려지지 않는다) + 반원 앞에서 상대 너머로 터지는 띠, 가시는 위 앞쪽
 * - 슈퍼맨 펀치: 주먹에서 바닥으로 꽂히는 번개 + 바닥을 타고 앞으로 갈수록 가늘어지는 큰 쐐기, 가시 7개 앞·위로 (공격자 머리에 닿지 않게 12px 앞에서)
 */
export const RAIDEN_ANIME_MOVES: Partial<Record<string, AnimeMove>> = {
  atk1: {
    grade: 'normal',
    path: 'line',
    len: 110,
    width: 14,
    profile: [[0, 0.45], [0.2, 0.8], [0.45, 1], [0.7, 0.8], [1, 0.45]],
    edge: 2.5,
    strands: 4,
    scatter: 0.35,
    spread: 8,
    reach: 28,
    strandW: 2,
    fly: 7,
    branches: 1,
    branchLen: 14,
    branchW: 2,
    timing: { hold: 1, tear: 7 },
    spikes: { count: 3, fan: [-16, 16], len: [30, 52], base: 2 },
  },
  atk2: {
    grade: 'normal',
    path: 'line',
    len: 112,
    width: 24,
    profile: [[0, 0.45], [0.22, 0.85], [0.45, 1], [0.72, 0.85], [1, 0.5]],
    strands: 5,
    scatter: 0.32,
    spread: 16,
    reach: 28,
    strandW: 3,
    fly: 4,
    branches: 4,
    branchLen: 26,
    branchW: 3,
    spikes: { count: 5, fan: [-38, 30], len: [30, 56], base: 3 },
  },
  atk3: {
    grade: 'normal',
    path: 'arc',
    len: 96,
    width: 18,
    arc: { r: 26, bolts: 3, forks: 4, width: 4 },
    profile: [[0, 0.5], [0.3, 0.9], [0.5, 1], [0.75, 0.8], [1, 0.45]],
    strands: 4,
    scatter: 0.35,
    spread: 18,
    reach: 26,
    strandW: 2,
    fly: 4,
    branches: 2,
    branchLen: 18,
    branchW: 2,
    spikes: { count: 4, fan: [-70, 0], len: [28, 48], base: 3 },
  },
  atk4: {
    grade: 'strong',
    path: 'ground',
    len: 240,
    width: 100,
    // 맞힌 자리 바로 앞이 가장 높고, 앞으로 갈수록 가늘어진다 (바닥을 타고 달리는 쐐기)
    profile: [[0, 0.7], [0.06, 1], [0.3, 0.68], [0.6, 0.38], [1, 0.1]],
    ground: { strikeW: 5, land: 12, from: 40 },
    // 흰 심·밝은 주색은 쐐기 모양을 따라 앞으로 가늘어지게 (판정 상자 네모에 잘리지 않게)
    coreW: 0.1,
    mainW: 0.16,
    // 속도선은 쐐기 위로 (쐐기 실루엣을 가리지 않게)
    speedAt: { y: -78, spread: 26 },
    strands: 7,
    scatter: 0.3,
    spread: 12,
    reach: 34,
    strandW: 4,
    fly: 5,
    branches: 6,
    branchLen: 34,
    branchW: 4,
    spikes: { count: 7, fan: [-62, -8], len: [40, 72], base: 4, ahead: 12 },
  },
};
