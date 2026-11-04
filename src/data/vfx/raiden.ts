// 라이덴 공격 이펙트 (숫자 데이터만, 동작연출지침서 14-8 '길티기어식 이펙트' 라이덴 동작별 표).
// 판정·동작 데이터(data/characters/raiden)와 따로 둔다. 방향과 판정은 그대로: 기준점은 판정이 시작하는 프레임의 주먹·발,
// 축은 판정 상자 방향, 흰 심이 지나는 곳이 판정 상자 (14-5·14-7). 공격자 머리·몸통 위로는 큰 모양이 지나가지 않는다.
// 색 단계: 0 심 #fff6f8 · 1 주색 #ff526e · 2 진한 주색 #cd1634 · 3 잉크 #46081e · 4 고리 #ff46c8 (render/chars/raiden-gg)
// 좌표: 오른쪽 보기 px, 공격자 발밑 (anchor 'self') 또는 맞은 점 (anchor 'hit') 기준, y 위가 −. 480×270 화면 (14-8 크기 × 1.5)
// 잉크 쐐기는 밝은 모양을 비스듬히 가로질러 그 위에 긋는다 (그리는 순서 뒤, 테두리 없음): 밝은 면을 가르는 검은 칼자국. 빛 모양과 나란히 두지 않는다.
import type { GMove, GPt, GShape } from './types';

/** 맞은 점의 작은 섬광과 불씨 (일반 타) */
const smallHit = (dir: number, size: number): GShape[] => [
  { kind: 'flash', anchor: 'hit', layer: 'front', spikes: [[dir, 13 * size, 2.5], [dir + 178, 6 * size, 2], [dir - 80, 7 * size, 1.5], [dir + 66, 6 * size, 1.5], [dir - 36, 9 * size, 1.5]], hold: 1, fade: 3 },
  { kind: 'embers', anchor: 'hit', layer: 'front', n: 8 + Math.round(4 * size), spread: 5, speed: 1.6 + 0.4 * size, dir: dir - 20, fan: 130, life: 12 },
];

export const RAIDEN_GG: Partial<Record<string, GMove>> = {
  /** 1 기본 1타 잽 (일반): 주먹에서 앞으로 짧은 빛 쐐기 1개 + 작은 섬광, 불씨 */
  atk1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    hitY: -35,
    light: { r: 16, t: 2 },
    shapes: [
      { kind: 'wedge', at: [33, -35], angle: -13, back: 8, fwd: 72, w: 18, peak: 0.28, bulge: [0.6, 1.3], skew: -0.2, hold: 1, fade: 5 },
      ...smallHit(-6, 1),
    ],
  },
  /** 2 기본 2타 크로스 (일반): 더 긴 빛 쐐기 + 굵은 번개 1줄, 잉크 쐐기 1개 */
  atk2: {
    grade: 'normal',
    grammar: [1, 2, 3, 4, 5, 6, 7],
    hitY: -35,
    light: { r: 18, t: 2 },
    shapes: [
      { kind: 'wedge', at: [34, -35], angle: -14, back: 6, fwd: 82, w: 18, peak: 0.28, bulge: [0.6, 1.25], skew: 0.2, hold: 2, fade: 6 },
      { kind: 'bolt', pts: [[33, -37], [50, -47], [61, -32], [82, -44], [104, -35]], w0: 5, w1: 2, forks: [[0.56, -55, 12]], hold: 2, fade: 5 },
      { kind: 'ink', at: [58, -8], angle: -64, len: 66, w: 8, notch: [[0.34, 2], [0.6, 2]], hold: 2, fade: 5 },
      ...smallHit(-9, 1.2),
    ],
  },
  /** 3 기본 3타 미들킥 (일반): 몸 앞 반원으로 도는 굵은 번개 띠 (초승달 칼자국 금지) + 잉크 쐐기 1개, 불씨 */
  atk3: {
    grade: 'normal',
    grammar: [2, 3, 4, 5, 6, 7],
    hitY: -32,
    light: { r: 20, t: 2 },
    shapes: [
      {
        kind: 'bolt', arc: { c: [14, -31], r: 41, a0: 80, a1: -84, kinks: [[0.18, 3], [0.36, -2], [0.54, 4], [0.72, -2], [0.88, 3]] },
        w0: 3, wPeak: 12, w1: 2, peak: 0.5, forks: [[0.44, 50, 18], [0.66, -34, 12]], hold: 2, fade: 6,
      },
      { kind: 'ink', at: [36, 2], angle: -52, len: 64, w: 7, notch: [[0.34, 2], [0.62, 2]], hold: 2, fade: 5 },
      ...smallHit(-30, 1.3),
    ],
  },
  /**
   * 4 기본 4타 슈퍼맨 펀치 (강): 맞는 점을 지나 화면 밖까지 부채꼴로 퍼지는 대각선 빛기둥 3개 + 주먹에서 바닥으로 꽂혀 바닥을 달리는 굵은 번개.
   * 큰 원 고리, 방사 속도선, 잉크 쐐기 2개, 배경 누르기, 맞은 사람 실루엣
   */
  atk4: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 6, 7, 8],
    hitY: -30,
    light: { r: 60, t: 6 },
    screen: { press: { mode: 'tint', ticks: 3, color: '#1a0410', scale: 0.42 }, silhouette: 3 },
    shapes: [
      { kind: 'ring', anchor: 'hit', r: 104, w: 4, thick: -140, gaps: [[-40, -24], [58, 70]], hold: 2, fade: 8 },
      {
        kind: 'rays', anchor: 'hit', hold: 2, fade: 6,
        // 굵은 뿌리 → 뾰족한 끝 가시 8개 (가는 선 다발이 되지 않게: 뿌리 폭 6~7px, 빛기둥 방향은 비운다)
        lines: [
          [-160, 98, 50, 3.5, 0], [-118, 96, 58, 3, 1], [-90, 99, 46, 3.5, 0], [-8, 97, 54, 3, 1],
          [22, 100, 62, 3.5, 0], [58, 95, 48, 3, 1], [100, 98, 56, 3.5, 0], [140, 96, 44, 3, 1],
        ],
      },
      { kind: 'wedge', anchor: 'hit', at: [4, 3], angle: -33, back: 70, fwd: 320, w: 11, peak: 0.3, bulge: [0.7, 1.4], skew: -0.2, hold: 2, fade: 7 },
      { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: -54, back: 120, fwd: 280, w: 22, peak: 0.36, bulge: [0.75, 1.2], skew: 0.15, hold: 2, fade: 8 },
      { kind: 'wedge', anchor: 'hit', at: [-3, -2], angle: -72, back: 50, fwd: 230, w: 7, peak: 0.25, bulge: [0.8, 1.5], hold: 2, fade: 6 },
      {
        kind: 'bolt', pts: [[42, -46], [54, -30], [47, -21], [62, -5], [92, -15], [126, -3], [168, -14], [214, -1]],
        w0: 6, w1: 2, forks: [[0.55, -40, 18], [0.78, 35, 12]], hold: 2, fade: 7,
      },
      { kind: 'ink', anchor: 'hit', at: [0, -36], angle: -13, len: 118, w: 10, notch: [[0.28, 2], [0.52, 3], [0.74, 2]], hold: 2, fade: 7 },
      { kind: 'ink', anchor: 'hit', at: [120, -18], angle: -112, len: 74, w: 8, notch: [[0.4, 2], [0.66, 2]], hold: 2, fade: 7 },
      { kind: 'flash', anchor: 'hit', layer: 'front', spikes: [[-54, 30, 4], [126, 18, 3], [-33, 22, 3], [40, 12, 2], [-112, 14, 2], [172, 10, 2]], hold: 1, fade: 4 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 22, spread: 10, speed: 2.6, dir: -45, fan: 170, life: 20 },
    ],
  },
  /** 5 띄우기 어퍼컷 (강): 아래에서 위로 솟는 세로 빛기둥 + 번개, 고리, 잉크 쐐기 */
  launcher: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 6, 7],
    hitY: -44,
    light: { r: 40, t: 4 },
    shapes: [
      { kind: 'ring', anchor: 'hit', r: 88, w: 3, thick: 150, gaps: [[-100, -80]], hold: 2, fade: 7 },
      { kind: 'wedge', at: [23, -44], angle: -84, back: 54, fwd: 200, w: 20, peak: 0.32, bulge: [0.7, 1.25], skew: -0.15, hold: 2, fade: 7 },
      { kind: 'bolt', pts: [[18, -8], [30, -34], [17, -58], [33, -86], [22, -114], [36, -146]], w0: 5, w1: 2, forks: [[0.4, 50, 14], [0.7, -60, 12]], hold: 2, fade: 6 },
      { kind: 'ink', at: [2, -64], angle: -30, len: 84, w: 9, notch: [[0.3, 3], [0.55, 3], [0.78, 2]], hold: 2, fade: 6 },
      { kind: 'flash', anchor: 'hit', layer: 'front', spikes: [[-82, 24, 3.5], [98, 10, 2.5], [-40, 12, 2], [-130, 13, 2], [20, 9, 1.5]], hold: 1, fade: 4 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 16, spread: 8, speed: 2.4, dir: -85, fan: 110, life: 18 },
    ],
  },
  /** 6 쓸기 (일반): 바닥을 스치는 낮은 스우시 띠, 물보라 (렌더가 따로), 불씨 */
  sweep: {
    grade: 'normal',
    grammar: [1, 2, 7],
    hitY: -8,
    light: { r: 18, t: 2 },
    shapes: [
      { kind: 'swoosh', c: [32, 3], r: 44, sx: 1, sy: 0.32, rot: -9, a0: -150, a1: -6, w: 13, peak: 0.72, bulge: [1.1, 0.55], skew: 0.3, hold: 2, fade: 6 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 12, spread: 6, speed: 1.8, dir: -30, fan: 100, life: 12 },
    ],
  },
  /** 7 대시 공격 플라잉 니 (강): 몸 뒤로 끌리는 스우시 + 맞는 점 빛 쐐기, 고리 */
  dashAttack: {
    grade: 'strong',
    grammar: [1, 2, 4, 5, 7],
    hitY: -34,
    light: { r: 36, t: 4 },
    shapes: [
      { kind: 'swoosh', c: [-38, 58], r: 96, a0: -130, a1: -77, w: 16, peak: 0.86, bulge: [1.3, 0.45], skew: -0.25, hold: 2, fade: 6 },
      { kind: 'ring', anchor: 'hit', r: 82, w: 3, thick: -30, gaps: [[150, 172]], hold: 2, fade: 7 },
      { kind: 'wedge', anchor: 'hit', at: [-4, 0], angle: -12, back: 12, fwd: 72, w: 17, peak: 0.24, bulge: [0.65, 1.2], skew: 0, hold: 2, fade: 6 },
      { kind: 'flash', anchor: 'hit', layer: 'front', spikes: [[-12, 20, 3], [168, 9, 2], [-78, 11, 2], [70, 9, 1.5], [-40, 13, 2]], hold: 1, fade: 3 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 14, spread: 7, speed: 2.2, dir: -20, fan: 140, life: 16 },
    ],
  },
  /** 8 공중 1타 잽 (일반): 앞 아래로 짧은 쐐기, 불씨 */
  air1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    hitY: -30,
    light: { r: 14, t: 2 },
    shapes: [
      { kind: 'wedge', at: [35, -32], angle: 14, back: 0, fwd: 52, w: 14, peak: 0.24, bulge: [0.65, 1.2], skew: 0.2, hold: 1, fade: 5 },
      ...smallHit(12, 0.9),
    ],
  },
  /** 9 공중 2타 크로스 (일반): 더 긴 짧은 쐐기, 불씨 */
  air2: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    hitY: -30,
    light: { r: 16, t: 2 },
    shapes: [
      { kind: 'wedge', at: [36, -31], angle: 18, back: 0, fwd: 64, w: 17, peak: 0.24, bulge: [0.65, 1.2], skew: 0.2, hold: 2, fade: 5 },
      ...smallHit(17, 1.1),
    ],
  },
  /** 10 공중 3타 돌려차기 (강): 원으로 도는 굵은 번개 띠, 불씨 */
  air3: {
    grade: 'strong',
    grammar: [2, 5, 6, 7],
    hitY: -32,
    light: { r: 30, t: 3 },
    shapes: [
      {
        kind: 'bolt', arc: { c: [25, -36], r: 33, a0: -112, a1: 122, kinks: [[0.12, 3], [0.27, -2], [0.42, 4], [0.57, -2], [0.72, 3], [0.87, -2]] },
        w0: 2, wPeak: 10, w1: 2, peak: 0.42, forks: [[0.38, -50, 16], [0.6, 55, 14]], hold: 2, fade: 6,
      },
      ...smallHit(-10, 1.4),
    ],
  },
  /** 11 내려찍기 도끼차기 (강): 위에서 아래 반원 번개 띠 + 바닥에 퍼지는 번개, 바닥에 납작한 고리, 잉크 쐐기 */
  slam: {
    grade: 'strong',
    grammar: [2, 3, 4, 5, 6, 7],
    hitY: -24,
    light: { r: 44, t: 4 },
    shapes: [
      { kind: 'ring', at: [22, -1], r: 86, sy: 0.22, w: 3, thick: 150, gaps: [[-122, -58], [62, 112]], hold: 2, fade: 8 },
      {
        kind: 'bolt', arc: { c: [12, -40], r: 38, a0: -104, a1: 74, kinks: [[0.18, 3], [0.36, -2], [0.54, 4], [0.72, -2], [0.88, 3]] },
        w0: 2, wPeak: 10, w1: 4, peak: 0.6, forks: [[0.42, -50, 16]], hold: 2, fade: 6,
      },
      { kind: 'bolt', pts: [[22, -1], [44, -11], [64, -2], [92, -13], [122, -1]], w0: 5, w1: 2, forks: [[0.5, -60, 10]], hold: 2, fade: 7 },
      { kind: 'bolt', pts: [[18, -1], [0, -10], [-22, -1], [-46, -9]], w0: 4, w1: 2, hold: 2, fade: 6 },
      { kind: 'ink', at: [70, -84], angle: 118, len: 92, w: 9, notch: [[0.3, 3], [0.6, 2]], hold: 2, fade: 6 },
      { kind: 'flash', anchor: 'hit', layer: 'front', spikes: [[84, 20, 3], [-96, 12, 2.5], [20, 11, 2], [150, 10, 2], [-30, 9, 1.5]], hold: 1, fade: 3 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 16, spread: 8, speed: 2.2, dir: -90, fan: 160, life: 16 },
    ],
  },
  /**
   * 13 화과산 (기술): 바닥에 붙은 반구 빛 (9-3, 반지름 40 = 판정) — 셀 3단 아치 + 아치 안쪽에서 바깥으로 뻗는 굵은 번개, 불씨.
   * 두 사람 사이 번개 방벽은 RAIDEN_GG_BARRIER (sim 사건으로 12틱째부터)
   */
  skill2: {
    grade: 'skill',
    grammar: [1, 2, 6, 7],
    hitY: -20,
    light: { r: 50, t: 4 },
    shapes: [
      { kind: 'swoosh', c: [0, 1], r: 39, a0: -178, a1: -2, w: 11, peak: 0.5, bulge: [0.75, 0.75], skew: 0.4, coreLen: 0.86, hold: 2, fade: 6 },
      { kind: 'bolt', pts: [[12, -2], [26, -10], [33, -2], [48, -9]], w0: 4, w1: 2, hold: 2, fade: 5 },
      { kind: 'bolt', pts: [[-12, -2], [-26, -11], [-34, -3], [-48, -10]], w0: 4, w1: 2, hold: 2, fade: 5 },
      { kind: 'embers', at: [0, -14], n: 18, spread: 18, speed: 2, dir: -90, fan: 180, life: 16 },
    ],
  },
};

/**
 * 12 차지 투전승불 (강): 단계별 갑옷 윤곽 (9-1, 렌더가 따로) → 떼면 원뿔 빛 쐐기 (판정 상자 길이·높이, 80px 이하),
 * 속도선 (주먹 앞에서 부채꼴로), 4단계는 고리 + 배경 누르기. 단계 1~4 순서
 */
export const RAIDEN_GG_CHARGE: readonly GMove[] = [1, 2, 3, 4].map((lv): GMove => {
  // 판정 상자: x 28, 길이 28/36/44/52, 높이 18/22/26/30 (data/characters/raiden charge.levels)
  const len = 20 + 8 * lv;
  const h = 14 + 4 * lv;
  // 속도선: 주먹 앞 부채꼴 빛 조각 2~3개 (굵기·길이를 서로 다르게: 같은 굵기 평행선·가는 선 다발이 되지 않게)
  const speed: GShape[] = [-16, -5, 9].slice(0, 1 + Math.min(2, lv)).map((a, k) => ({
    kind: 'wedge', at: [40 + 6 * k, -33 + a * 0.5] as GPt, angle: a, back: 0, fwd: 50 + 10 * lv + [0, 14, 6][k]!, w: [6, 4.5, 5.5][k]!, peak: 0.22, bulge: [0.6, 1.4] as const, main: 0.55, core: 0, hold: 2, fade: 4,
  }));
  return {
    grade: lv >= 3 ? 'strong' : 'normal',
    grammar: lv >= 4 ? [1, 2, 5, 7, 8] : [1, 2, 5, 7],
    hitY: -33,
    light: { r: 20 + 10 * lv, t: 2 + lv },
    screen: lv >= 4 ? { press: { mode: 'tint', ticks: 2, color: '#1a0410', scale: 0.48 } } : undefined,
    shapes: [
      ...speed,
      { kind: 'wedge', at: [34, -33], angle: -3, back: 4, fwd: len + 18, w: h * 1.15, peak: 0.7, bulge: [1.05, 0.55], skew: 0.1, coreLen: 0.7, hold: 2, fade: 4 + lv },
      ...(lv >= 4 ? [{ kind: 'ring', anchor: 'hit', r: 92, w: 4, thick: -160, gaps: [[20, 36]], hold: 2, fade: 8 } as GShape] : []),
      { kind: 'flash', anchor: 'hit', layer: 'front', spikes: [[-4, 12 + 4 * lv, 2.5 + 0.4 * lv], [176, 6 + lv, 2], [-84, 7 + lv, 1.5], [66, 6 + lv, 1.5]], hold: 1 + (lv >> 1), fade: 3 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 8 + 3 * lv, spread: 6, speed: 1.8 + 0.3 * lv, dir: -15, fan: 130, life: 12 + 2 * lv },
    ],
  };
});

/**
 * 13 화과산 전류 방벽 (두 사람 사이, 1.5초): 굵은 번개 2줄 (어두운 테두리), 모양 둘을 4틱마다 바꿔 끼워 지직거린다 (난수 없이).
 * 좌표는 방벽 아래 가운데 기준 (y 위가 −, 높이 = 방벽 높이 비 0~1을 곱하지 않고 px)
 */
export const RAIDEN_GG_BARRIER: { variants: readonly (readonly GPt[])[][]; w0: number; w1: number } = {
  variants: [
    [[[-2, 0], [-6, -14], [2, -26], [-5, -40], [1, -54], [-3, -66]], [[3, -2], [8, -18], [1, -30], [7, -46], [2, -60]]],
    [[[-1, 0], [4, -12], [-4, -28], [3, -42], [-4, -56], [0, -66]], [[4, -4], [-1, -20], [7, -34], [0, -48], [5, -62]]],
  ],
  w0: 5,
  w1: 2,
};

/**
 * 14 필살기 파천 (9-4 콘티 그대로): 이 문법은 관통 원뿔(넷째 장면)과 잿더미 직선(다섯째 장면)에만.
 * burst: 상대 등에서 화면 밖까지 뚫고 나가는 큰 빛기둥 + 대각선 보조 기둥, 잉크 쐐기 3개, 화면 한 색 + 균열, 맞은 사람 실루엣
 * ash: 잿더미 줄을 따라 바닥을 달리는 굵은 번개, 잉크 쐐기 2개, 화면 한 색 + 균열 (짧게)
 * 맞은 점 기준 (anchor 'hit' 자리 = 상대 몸 가운데), ash는 줄 시작 (바닥)
 */
export const RAIDEN_GG_SUPER: { burst: GMove; ash: GMove } = {
  burst: {
    grade: 'super',
    grammar: [1, 2, 3, 4, 5, 7, 8],
    light: { r: 120, t: 12 },
    screen: { press: { mode: 'crack', ticks: 6, color: '#cd1634', crack: '#0a0712' }, silhouette: 3 },
    shapes: [
      { kind: 'ring', anchor: 'hit', r: 118, w: 5, thick: 160, gaps: [[-20, -6], [100, 118]], hold: 8, fade: 10 },
      { kind: 'wedge', anchor: 'hit', at: [6, 0], angle: -9, back: 4, fwd: 340, w: 58, peak: 0.16, bulge: [0.5, 1.1], skew: 0.1, coreLen: 0.88, hold: 8, fade: 10 },
      { kind: 'wedge', anchor: 'hit', at: [10, 6], angle: -26, back: 30, fwd: 300, w: 14, peak: 0.3, bulge: [0.7, 1.3], hold: 8, fade: 9 },
      { kind: 'wedge', anchor: 'hit', at: [8, -6], angle: 18, back: 20, fwd: 280, w: 10, peak: 0.3, bulge: [0.7, 1.3], hold: 8, fade: 8 },
      { kind: 'ink', anchor: 'hit', at: [64, -58], angle: 62, len: 130, w: 14, notch: [[0.2, 3], [0.45, 4], [0.7, 3]], hold: 8, fade: 9 },
      { kind: 'ink', anchor: 'hit', at: [150, 46], angle: -64, len: 120, w: 10, notch: [[0.3, 3], [0.6, 3]], hold: 8, fade: 9 },
      { kind: 'ink', anchor: 'hit', at: [250, -60], angle: 96, len: 90, w: 7, notch: [[0.4, 2]], hold: 8, fade: 8 },
      { kind: 'flash', anchor: 'hit', layer: 'front', spikes: [[0, 40, 6], [180, 16, 4], [-60, 20, 3], [60, 18, 3], [-120, 14, 2.5], [120, 12, 2.5]], hold: 6, fade: 5 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 30, spread: 14, speed: 3, dir: 0, fan: 120, life: 26 },
    ],
  },
  ash: {
    grade: 'super',
    grammar: [3, 6, 7, 8],
    light: { r: 160, t: 20 },
    screen: { press: { mode: 'crack', ticks: 3, color: '#cd1634', crack: '#0a0712' } },
    shapes: [
      { kind: 'bolt', pts: [[0, -2], [38, -14], [80, -2], [128, -16], [176, -3], [232, -15], [290, -2]], w0: 7, w1: 3, forks: [[0.2, -70, 22], [0.48, -60, 26], [0.76, -75, 20]], hold: 10, fade: 12 },
      { kind: 'ink', at: [60, -62], angle: 24, len: 170, w: 11, notch: [[0.3, 3], [0.62, 3]], hold: 10, fade: 10 },
      { kind: 'ink', at: [40, 16], angle: -40, len: 120, w: 8, notch: [[0.5, 3]], hold: 10, fade: 10 },
      { kind: 'embers', at: [120, -10], n: 30, spread: 90, speed: 0.8, dir: -90, fan: 60, life: 40 },
    ],
  },
};
