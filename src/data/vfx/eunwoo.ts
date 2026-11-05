// 백은우 공격 이펙트 (숫자 데이터만, 동작연출지침서 14-8 '길티기어식 이펙트' 문법 + 14-4 백은우 색·고유 모양 + 14-9 연출 기법).
// 판정·동작 데이터(data/characters/eunwoo, data/moves/time)와 따로 둔다. 리본 띠는 그 기술의 연검 리본(판정 선)을 따라 휘고 (11-2 '궤적은 리본 자체를 따라'),
// 흰 심이 지나는 곳이 판정 선이다 (14-5). 판정 밖으로 뻗는 머리·꼬리는 바깥 두 단(은백·옅은 하늘)과 금실, 흩어지는 가닥과 꽃잎으로만.
// 공격자 머리·몸통 위로는 큰 모양이 지나가지 않는다 (몸 둘레를 도는 리본은 몸 뒤 겹).
// 색 단계: 0 심 흰·크림 · 1 은백 · 2 옅은 하늘 · 3 잉크 남색 · 4 금실 · 5 백합 꽃잎 연분홍 · 6 짙은 하늘 (render/chars/eunwoo-gg)
// 좌표: 오른쪽 보기 px, 공격자 발밑 (anchor 'self', 판정이 시작하는 틱 자리) 또는 맞은 점 (anchor 'hit') 기준, y 위가 −. 480×270 화면 (14-8 크기 × 1.5)
// 14-9 기법: tech에 주 기법 1개 + 보조 기법 (한 캐릭터 안에서 주 기법이 겹치지 않는다), fx에 화면·카메라·환경 기법.
import type { GMove, GShape } from './types';

/** 맞은 점의 네 갈래 은빛 반짝임 (백은우 섬광: 가로가 길고 세로가 짧은 별) */
const glint = (dir: number, size: number, hold = 1, fade = 4): GShape => ({
  kind: 'flash', anchor: 'hit', layer: 'front', hold, fade, rim: 2,
  spikes: [[dir, 14 * size, 2.6], [dir + 90, 7 * size, 1.9], [dir + 180, 9 * size, 2.1], [dir - 90, 8 * size, 1.9], [dir + 38, 5 * size, 1.4]],
});
/** 빛 가루 (14-8 ⑦ 잔불 점: 흰·은백·금 1~2px, 떨어져 바닥에서 튄다) */
const dust = (n: number, dir: number, speed: number, life: number, fan = 120): GShape => ({ kind: 'embers', anchor: 'hit', layer: 'front', n, spread: 6, speed, dir, fan, life });
/** 물안개 (14-2 잔향: 은백 → 옅은 하늘 덩어리가 천천히 오른다) */
const mist = (n: number, size: number, life: number, at: readonly [number, number] = [2, -2]): GShape => ({ kind: 'smoke', anchor: 'hit', at, n, spread: 5, rise: 0.4, size, life, delay: 2, tones: [1, 2] });
/** 일반 타 맞은 점: 반짝임 + 빛 가루 + 물안개 */
const smallHit = (dir: number, size: number, life = 24): GShape[] => [glint(dir, size), dust(8 + Math.round(4 * size), dir - 20, 1.5 + 0.4 * size, life), mist(2, 2.5 + size, 18 + Math.round(4 * size))];

// ───────────────────────── 지상 1~4타: 한 문장 (14-9 F 보조) — 1타 꽃잎 하나, 2타 둘, 3타 반쯤 핀 원, 4타 다 핀 백합이 터진다 ─────────────────────────

const ATK4_RIBBON: GShape = {
  // 위에서 아래로 큰 세로 S: 머리 위 높은 곳에서 휘어 내려와 앞 바닥에 끝이 꽂힌다 (11-2 4타)
  kind: 'ribbon', pts: [[-4, -150], [22, -138], [46, -112], [46, -84], [34, -60], [41, -36], [50, -16], [60, 0]],
  w: 30, peak: 0.72, bulge: [1.2, 0.55], skew: 0.15, coreLen: 0.5, twist: [[0.3, 0.38], [0.55, 0.5]], thread: [0.4, 0.95, 3, -1], wave: [4, 60], hold: 2, fade: 14,
};
/** 4타 지연 폭발 (14-9 B): 맞은 순간엔 반짝임만, 살아 있는 4틱 뒤 (히트스톱 중) 앞 바닥 꽂힌 자리에서 다 핀 백합이 터진다 (F 완성) */
const ATK4_BLOOM: GShape[] = [
  // 두 꽃잎은 대각선 빛기둥으로 화면 밖까지 (14-8 ④), 셋은 짧은 꽃잎
  { kind: 'wedge', at: [56, -2], angle: -58, back: 20, fwd: 300, w: 30, peak: 0.16, bulge: [0.7, 1.35], skew: 0.2, wait: 4, hold: 2, fade: 14 },
  { kind: 'wedge', at: [56, -2], angle: -122, back: 14, fwd: 210, w: 18, peak: 0.18, bulge: [0.7, 1.4], skew: -0.2, wait: 4, hold: 2, fade: 12 },
  { kind: 'wedge', at: [56, -2], angle: -88, back: 6, fwd: 96, w: 22, peak: 0.3, bulge: [0.6, 1.1], wait: 5, hold: 2, fade: 11 },
  { kind: 'wedge', at: [56, -2], angle: -20, back: 4, fwd: 74, w: 16, peak: 0.3, bulge: [0.6, 1.2], skew: 0.3, wait: 5, hold: 1, fade: 10 },
  { kind: 'wedge', at: [56, -2], angle: -156, back: 4, fwd: 62, w: 14, peak: 0.3, bulge: [0.6, 1.2], skew: -0.3, wait: 5, hold: 1, fade: 10 },
];
/** 4타 맞은 점 공통: 큰 원 고리, 방사 가시, 잉크 쐐기 (리본을 가로지른다), 반짝임, 빛 가루, 물안개 */
const ATK4_HIT: GShape[] = [
  { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', r: 108, w: 4, thick: -120, gaps: [[-36, -20], [60, 74], [150, 160]], wait: 4, hold: 2, fade: 12 },
  {
    kind: 'rays', anchor: 'hit', wait: 4, hold: 2, fade: 9,
    lines: [[-150, 100, 52, 3.5, 0], [-112, 94, 60, 3, 1], [-30, 98, 50, 3.5, 0], [12, 96, 58, 3, 1], [48, 100, 64, 3.5, 0], [96, 95, 50, 3, 1], [136, 98, 56, 3.5, 0]],
  },
  { kind: 'ink', at: [18, -96], angle: 28, len: 120, w: 10, notch: [[0.3, 2], [0.56, 3], [0.8, 2]], wait: 4, hold: 2, fade: 11 },
  glint(-70, 1.6, 1, 4),
  dust(24, -70, 2.6, 42, 140),
  mist(5, 6, 34, [4, -4]),
];
/** 4타 꽃잎이 카메라 쪽으로 커지며 날아온다 (14-9 D, 앞 겹) */
const ATK4_PETALS: GShape = { kind: 'flutter', layer: 'front', from: [[48, -6], [56, -10], [64, -6]], n: 9, fly: 0.3, size: 7, dir: -70, speed: 2.4, fan: 150, lift: 0.1, life: 40, every: 1, zoom: 0.035, wait: 5 };

/** 4타 시안 1 (채택): B 지연 폭발 / D 2.5D 깊이 (바닥에 누운 고리·카메라 쪽으로 날아오는 꽃잎) · K 카메라 (줌 펀치 + 아래로만 흔들기) */
const ATK4_V1: GMove = {
  grade: 'strong',
  grammar: [1, 2, 3, 4, 5, 7, 8],
  tech: { main: 'B', aux: ['D', 'K'] },
  hitY: -26,
  light: { r: 64, t: 20 },
  screen: { press: { mode: 'tint', ticks: 2, color: '#060a1c', scale: 0.4 }, silhouette: 3 },
  fx: { zoom: { at: 4, k: 1.07, ticks: 1 }, kick: { at: 4, dx: 0, dy: 6, ticks: 7, shake: true } },
  shapes: [
    ATK4_RIBBON,
    ...ATK4_BLOOM,
    // D: 꽂힌 자리 둘레 바닥에 누운 큰 타원 고리
    { kind: 'ring', tone: 2, ripple: 1, at: [56, -1], r: 96, w: 5, thick: 90, sy: 0.2, rot: -7, gaps: [[-120, -100]], wait: 4, hold: 2, fade: 14 },
    ...ATK4_HIT,
    ATK4_PETALS,
  ],
};
/** 4타 시안 2: B / H 환경 반응 (빗줄기가 멈추고 물웅덩이가 솟는다) · A 임팩트 프레임 (터지는 틱에 두 색 2틱) */
const ATK4_V2: GMove = {
  ...ATK4_V1,
  tech: { main: 'B', aux: ['H', 'A'] },
  fx: { impact: { at: 4, ticks: 2, bg: '#fffbef', ink: '#101a3c' }, rain: { ticks: 18 }, puddle: { at: [-10, 14, 40], n: 9 } },
  shapes: [ATK4_RIBBON, ...ATK4_BLOOM, ...ATK4_HIT, { ...ATK4_PETALS, zoom: 0, layer: 'back' } as GShape],
};
/** 4타 시안 3: B / G 검은 틈 (잉크가 리본 한가운데를 갈라 빛이 둘로) · E 화면 밖으로 (오른쪽 위로 화면을 민다) */
const ATK4_V3: GMove = {
  ...ATK4_V1,
  tech: { main: 'B', aux: ['G', 'E'] },
  fx: { kick: { at: 4, dx: 7, dy: -5, ticks: 9 } },
  shapes: [
    ATK4_RIBBON,
    // G: 리본 한가운데를 따라 내려오는 검은 틈 (빛이 둘로 쪼개진다)
    { kind: 'ink', at: [16, -136], angle: 62, len: 128, w: 9, notch: [[0.35, 2], [0.62, 2]], hold: 2, fade: 13 },
    ...ATK4_BLOOM.map((s) => (s.kind === 'wedge' && s.fwd > 200 ? { ...s, fwd: s.fwd + 180 } : s)),
    { kind: 'ink', at: [56, -2], angle: -58, len: 260, w: 7, notch: [[0.3, 2], [0.6, 2]], wait: 4, hold: 2, fade: 12 },
    ...ATK4_HIT,
    { ...ATK4_PETALS, zoom: 0 } as GShape,
  ],
};

export const EUNWOO_GG: Partial<Record<string, GMove>> = {
  /** 1 기본 1타 손목 채찍 (일반): 손끝에서 앞으로 S자로 휘며 끝이 꺾이는 리본 띠 (꽃잎 하나), 금실. L 색 뒤집기 (끝이 꺾이는 순간 1틱 금빛) / F */
  atk1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'L', aux: ['F'] },
    hitY: -38,
    light: { r: 18, t: 15 },
    fx: { flip: { at: 1, ticks: 1 } },
    shapes: [
      {
        kind: 'ribbon', pts: [[14, -26], [26, -31], [40, -38], [54, -43], [70, -42], [86, -36], [100, -30]],
        w: 18, peak: 0.55, bulge: [1.1, 0.7], skew: -0.1, coreLen: 0.62, twist: [[0.22, 0.42]], thread: [0.3, 0.92, 2.5, 1], wave: [2.5, 40], hold: 1, fade: 10,
      },
      { kind: 'flutter', from: [[16, -27], [24, -30]], n: 3, size: 5, dir: -150, speed: 1.2, fan: 70, life: 24, delay: 3 },
      ...smallHit(-6, 1, 22),
    ],
  },
  /** 2 기본 2타 손등 베기 (일반): 바닥을 S자로 훑고 앞에서 상대를 감아 오르는 낮은 리본 띠 (꽃잎 둘), 잉크 쐐기 1개. I 시간 엇갈림 (히트스톱 동안 리본만 계속 감아 오른다) / F */
  atk2: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'I', aux: ['F'] },
    hitY: -18,
    light: { r: 18, t: 15 },
    shapes: [
      {
        // 바닥을 S자로 훑고 (판정 선) 상대 뒤로 솟아 머리 위로 감겨 돌아온다 (끌어당김). 큰 띠는 뒤 겹이라 상대 몸이 위에 그려진다
        kind: 'ribbon', pts: [[8, -6], [26, -3], [42, -9], [58, -3], [76, -14], [86, -38], [78, -62], [58, -72], [38, -64]],
        w: 21, peak: 0.34, bulge: [1.1, 0.75], skew: 0.2, coreLen: 0.5, twist: [[0.5, 0.42], [0.78, 0.45]], thread: [0.2, 0.9, 2.5, -1], wave: [2.5, 40], grow: 3, hold: 1, fade: 10,
      },
      { kind: 'ink', at: [62, -84], angle: 70, len: 64, w: 8, notch: [[0.36, 2], [0.62, 2]], hold: 1, fade: 9 },
      { kind: 'flutter', from: [[10, -4], [20, -3], [30, -6]], n: 4, size: 5, dir: -160, speed: 1, fan: 60, life: 24, delay: 3 },
      ...smallHit(-30, 1.1, 24),
    ],
  },
  /**
   * 3 기본 3타 피루엣 (일반): 몸 둘레를 도는 리본 원 (앞쪽 반원이 밝다, 몸 뒤 겹) → 고리 → 꽃잎으로 바뀐다 (반쯤 핀 꽃).
   * C 모양 변신 / F
   */
  atk3: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'C', aux: ['F'] },
    hitY: -40,
    light: { r: 20, t: 15 },
    shapes: [
      {
        kind: 'ribbon', pts: [[-16, -76], [6, -84], [30, -76], [46, -54], [48, -32], [38, -12], [18, -4]],
        w: 18, peak: 0.42, bulge: [1, 0.8], skew: 0.25, coreLen: 0.55, twist: [[0.72, 0.42]], thread: [0.2, 0.7, 2.5, 1], wave: [2, 44], hold: 1, fade: 5,
      },
      { kind: 'ring', tone: 2, ripple: 1, at: [10, -40], r: 46, w: 5, thick: -20, sy: 0.92, gaps: [[100, 150], [200, 214]], delay: 2, hold: 1, fade: 8 },
      { kind: 'ink', at: [40, -92], angle: 70, len: 60, w: 7, notch: [[0.4, 2], [0.66, 2]], hold: 1, fade: 7 },
      { kind: 'flutter', from: [[34, -72], [52, -44], [50, -18], [30, -4]], n: 9, fly: 0.2, size: 6, dir: -20, speed: 1.4, fan: 120, life: 30, delay: 4 },
      ...smallHit(-20, 1.2, 24),
    ],
  },
  /** 4 기본 4타 뛰어 내리꽂기 (강): 시안 1 (채택) — 시안 2·3은 EUNWOO_GG_DRAFTS */
  atk4: ATK4_V1,
  /**
   * 5 띄우기 올려 베기 (강): 앞 바닥에서 화면 위 밖까지 감아 오르는 나선 리본, 고리, 잉크 쐐기, 나비.
   * E 화면 밖으로 (위로 화면을 민다) / I 시간 엇갈림 (히트스톱 동안 계속 감아 오른다) · J 남는 흔적 (나선 자리에 꽃잎이 1초 넘게 떠 있다)
   */
  launcher: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'E', aux: ['I', 'J'] },
    hitY: -46,
    light: { r: 44, t: 20 },
    fx: { kick: { at: 0, dx: 0, dy: -7, ticks: 8 } },
    shapes: [
      { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', r: 92, w: 4, thick: 150, gaps: [[-104, -84], [20, 32]], hold: 2, fade: 12 },
      {
        kind: 'ribbon', pts: [[34, -2], [42, -22], [30, -42], [16, -60], [26, -84], [42, -110], [32, -142], [16, -176], [24, -216], [40, -262], [34, -310]],
        w: 38, peak: 0.3, bulge: [1, 0.5], skew: -0.15, coreLen: 0.36, twist: [[0.2, 0.4], [0.47, 0.42], [0.72, 0.45]], thread: [0.15, 0.8, 3, 1], wave: [3, 64], grow: 2.5, hold: 2, fade: 13,
      },
      { kind: 'ink', at: [-6, -70], angle: -40, len: 90, w: 9, notch: [[0.3, 3], [0.55, 3], [0.78, 2]], hold: 2, fade: 10 },
      // J: 나선 자리에 꽃잎이 오래 떠 있다가 (살아 있는 70틱) 천천히 흩어진다
      { kind: 'flutter', from: [[40, -24], [18, -58], [40, -106], [18, -172]], n: 10, size: 6, dir: -90, speed: 0.25, fan: 360, lift: 0.04, life: 80, every: 2, delay: 6 },
      { kind: 'flutter', layer: 'front', from: [[30, -120], [26, -200]], n: 5, fly: 1, size: 9, dir: -95, speed: 1.6, fan: 60, lift: 0.2, life: 50, delay: 4 },
      glint(-84, 1.4, 1, 5),
      dust(16, -88, 2.4, 38, 110),
      mist(4, 5, 30, [0, -6]),
    ],
  },
  /**
   * 6 쓸기 다리 걸기 (일반): 바닥에 납작하게 누운 리본 스우시, 물웅덩이가 솟는 물보라.
   * H 환경 반응 (빗줄기가 히트스톱 동안 공중에 멈추고 물웅덩이가 솟는다) / D 바닥에 누운 타원 고리
   */
  sweep: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'H', aux: ['D'] },
    hitY: -8,
    light: { r: 20, t: 15 },
    fx: { rain: { ticks: 12 }, puddle: { at: [-24, 0, 22], n: 6 } },
    shapes: [
      {
        kind: 'ribbon', pts: [[-8, -3], [12, -7], [32, -4], [52, -9], [72, -5], [94, -11], [110, -8]],
        w: 15, peak: 0.6, bulge: [1.2, 0.6], skew: 0.3, coreLen: 0.5, twist: [[0.32, 0.45]], thread: [0.3, 0.9, 2, 1], wave: [1.5, 34], hold: 0, fade: 9,
      },
      { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', at: [0, 7], r: 70, w: 4, thick: 80, sy: 0.18, rot: -7, gaps: [[-130, -110]], hold: 1, fade: 11 },
      ...smallHit(-30, 1, 26),
    ],
  },
  /**
   * 7 대시 공격 실 타고 찌르기 (강): 먼저 그어진 금실을 따라 화면 밖까지 뻗는 가늘고 긴 리본 찌르기, 고리, 잉크 쐐기.
   * M 전조 (판정 6틱 전부터 금실이 앞으로 그어지고 맞을 자리에 빛점) / E 화면 밖으로 (앞으로 화면을 민다) · L 색 뒤집기 (맞는 틱)
   */
  dashAttack: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'M', aux: ['E', 'L'] },
    hitY: -40,
    light: { r: 40, t: 20 },
    fx: { kick: { at: 0, dx: 7, dy: 0, ticks: 7 }, flip: { at: 1, ticks: 1 } },
    pre: [
      // M: 금실 한 줄이 손에서 앞으로 그어진다 (화면 밖까지)
      { kind: 'wedge', at: [20, -34], angle: -13, back: 0, fwd: 320, w: 5, peak: 0.18, bulge: [0.9, 1.4], main: 0, core: 0.34, coreLen: 0.9, edge: 4, hold: 6, fade: 6 },
    ],
    shapes: [
      // 뿌리는 짧게 (굵어지는 기울기가 축 기울기와 맞아 아래 테두리가 수평으로 눕지 않게)
      { kind: 'wedge', at: [38, -38], angle: -13, back: 8, fwd: 330, w: 20, peak: 0.05, bulge: [0.6, 1.5], skew: -0.1, coreLen: 0.28, hold: 2, fade: 12 },
      {
        kind: 'ribbon', pts: [[24, -30], [40, -44], [58, -34], [76, -48], [96, -38], [118, -50], [142, -42]],
        w: 14, peak: 0.4, bulge: [1, 0.7], skew: 0.1, coreLen: 0.45, twist: [[0.25, 0.4], [0.55, 0.42]], thread: [0.2, 0.8, 2, 1], wave: [2, 30], hold: 2, fade: 11,
      },
      { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', r: 84, w: 3, thick: -20, gaps: [[156, 176], [40, 52]], hold: 2, fade: 12 },
      { kind: 'ink', anchor: 'hit', at: [-30, 30], angle: -60, len: 80, w: 8, notch: [[0.35, 2], [0.6, 2]], hold: 2, fade: 10 },
      glint(-10, 1.3, 1, 4),
      dust(14, -20, 2.2, 36, 140),
      mist(4, 5, 30),
    ],
  },
  /** 8 공중 1타 채찍질 (일반): 앞아래로 비스듬한 짧은 리본 조각. F 콤보 변주 (공중 콤보의 첫 조각) / L 색 뒤집기 */
  air1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'F', aux: ['L'] },
    hitY: -30,
    light: { r: 16, t: 15 },
    fx: { flip: { at: 1, ticks: 1 } },
    shapes: [
      {
        kind: 'ribbon', pts: [[16, -44], [30, -40], [46, -30], [62, -20], [80, -14], [98, -16], [110, -22]],
        w: 19, peak: 0.55, bulge: [1.1, 0.7], skew: 0.15, coreLen: 0.6, twist: [[0.25, 0.45]], thread: [0.3, 0.9, 2, 1], wave: [2, 36], hold: 1, fade: 8,
      },
      ...smallHit(14, 1, 22),
    ],
  },
  /** 9 공중 2타 올려 베기 (일반): 앞 아래에서 위로 휘감아 오르는 반원 리본 (반쯤). F / I 시간 엇갈림 (히트스톱 동안 계속 감아 오른다) */
  air2: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'F', aux: ['I'] },
    hitY: -50,
    light: { r: 18, t: 15 },
    shapes: [
      {
        kind: 'ribbon', pts: [[34, -20], [40, -40], [34, -60], [40, -78], [56, -86], [74, -80]],
        w: 17, peak: 0.45, bulge: [1, 0.7], skew: -0.2, coreLen: 0.55, twist: [[0.6, 0.45]], thread: [0.25, 0.85, 2.5, -1], wave: [2, 40], grow: 2.5, hold: 1, fade: 9,
      },
      ...smallHit(-60, 1.1, 24),
    ],
  },
  /**
   * 10 공중 3타 회전 베기 (강): 몸 둘레 온전한 리본 원 (공중 콤보 문장의 끝: 다 핀 원) → 고리로 바뀌고 흰 나비로 흩어진다.
   * F / C 모양 변신 · N 맥동 (흩어지기 직전 한 번 더 부푼다)
   */
  air3: {
    grade: 'strong',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'F', aux: ['C', 'N'] },
    hitY: -30,
    light: { r: 36, t: 20 },
    shapes: [
      {
        kind: 'ribbon', pts: [[-30, -40], [-22, -66], [6, -80], [36, -70], [52, -44], [48, -14], [26, 4], [-4, 6], [-26, -12]],
        w: 22, peak: 0.5, bulge: [1, 0.8], skew: 0.25, coreLen: 0.5, twist: [[0.18, 0.4], [0.82, 0.42]], thread: [0.3, 0.7, 3, 1], wave: [2.5, 50], pulse: true, hold: 2, fade: 8,
      },
      { kind: 'ring', tone: 2, ripple: 1, at: [12, -30], r: 50, w: 5, thick: 30, sy: 0.95, gaps: [[150, 170], [-60, -44]], delay: 4, hold: 1, fade: 10 },
      { kind: 'ink', anchor: 'hit', at: [-40, -40], angle: 34, len: 84, w: 8, notch: [[0.4, 2], [0.66, 2]], hold: 2, fade: 9 },
      { kind: 'flutter', layer: 'front', from: [[40, -64], [52, -36], [36, -4], [0, 4]], n: 8, fly: 0.75, size: 9, dir: -40, speed: 1.6, fan: 160, lift: 0.18, life: 46, every: 1, delay: 6 },
      glint(-30, 1.3, 1, 5),
      dust(14, -40, 2.2, 34, 140),
      mist(3, 4.5, 28),
    ],
  },
  /**
   * 11 내려찍기 와이어 끌어내리기 (강): 와이어가 감아 채는 순간 (와이어는 렌더가 따로: 곧은 은빛 띠), 끌려 내려가는 세로 리본 기둥,
   * 바닥에 부딪는 자리의 납작한 고리. A 임팩트 프레임 (감아 채는 순간 두 색 2틱) / D 바닥에 누운 고리 · H 물웅덩이가 솟는다
   */
  slam: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7, 8],
    tech: { main: 'A', aux: ['D', 'H'] },
    hitY: -20,
    light: { r: 50, t: 20 },
    screen: { silhouette: 2 },
    fx: { impact: { at: 1, ticks: 2, bg: '#fffbef', ink: '#101a3c' }, puddle: { at: [-6, 12, 30], n: 7 }, rain: { ticks: 14 } },
    shapes: [
      {
        kind: 'ribbon', pts: [[40, -96], [30, -74], [40, -52], [30, -30], [40, -10], [36, 2]],
        w: 26, peak: 0.62, bulge: [1.2, 0.5], skew: 0.2, coreLen: 0.45, twist: [[0.3, 0.42]], thread: [0.35, 0.9, 2.5, 1], wave: [3, 50], hold: 2, fade: 12,
      },
      // 바닥에 부딪는 자리 납작한 물결 고리 (흩어지며 퍼질 때도 위·아래 테두리가 눕지 않게 조금 더 기울이고 굽이친다)
      { kind: 'ring', tone: 2, ripple: 1.4, anchor: 'hit', at: [0, 20], r: 100, w: 5, thick: 90, sy: 0.2, rot: -11, gaps: [[-150, -130]], delay: 2, hold: 2, fade: 14 },
      { kind: 'ink', anchor: 'hit', at: [-46, -50], angle: 52, len: 96, w: 9, notch: [[0.32, 2], [0.6, 3]], hold: 2, fade: 10 },
      glint(90, 1.4, 1, 5),
      dust(18, -90, 2.4, 40, 150),
      mist(4, 5, 30),
    ],
  },
  /**
   * 12 벽 박차기 (강): 벽에서 맞는 점을 지나 화면 밖까지 대각선으로 내리긋는 리본 띠 (6연타 동안 굽이친다).
   * K 카메라 (대각선 축으로만 흔들기 + 첫 타 줌 펀치) / J 남는 흔적 (지나간 대각선에 꽃잎이 1초 넘게 남는다) · G 검은 틈 (리본 한가운데 잉크)
   */
  wallKick: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 7],
    tech: { main: 'K', aux: ['J', 'G'] },
    hitY: -26,
    light: { r: 36, t: 20 },
    fx: { zoom: { at: 0, k: 1.05, ticks: 1 }, kick: { at: 0, dx: 5, dy: 5, ticks: 10, shake: true } },
    rehit: [glint(30, 0.9, 1, 3), dust(5, 20, 1.6, 20, 100)],
    shapes: [
      {
        // 몸 앞에서 시작해 (몸을 가로지르지 않게) 맞는 점을 지나 앞아래 화면 밖까지
        kind: 'ribbon', pts: [[20, -60], [38, -44], [56, -26], [76, -8], [100, 12], [128, 34], [158, 62], [190, 96]],
        w: 28, peak: 0.36, bulge: [1, 0.55], skew: 0.15, coreLen: 0.4, twist: [[0.18, 0.4], [0.52, 0.45]], thread: [0.2, 0.8, 3, 1], wave: [4, 70], hold: 14, fade: 12,
      },
      { kind: 'ink', at: [30, -66], angle: 38, len: 130, w: 8, notch: [[0.3, 2], [0.55, 2], [0.8, 2]], hold: 14, fade: 11 },
      { kind: 'flutter', from: [[30, -50], [60, -24], [96, 8], [130, 30]], n: 10, size: 6, dir: 40, speed: 0.3, fan: 360, lift: 0.03, life: 80, every: 2, delay: 10 },
      glint(30, 1.3, 1, 4),
      dust(14, 20, 2.2, 34, 140),
      mist(3, 4.5, 28),
    ],
  },
};

// ───────────────────────── 차지 스텔라리스 발도: 모은 단계마다 (1·2·3단계, 판정·동작은 그대로) ─────────────────────────

const chargeRibbon = (k: number): GShape => ({
  // 칼집에서 뽑아 위 앞에서 아래 앞으로 크게 긋는 초승달 리본 (단계가 높을수록 크고 화면 밖까지)
  kind: 'ribbon',
  // 위 앞에서 아래로 그어 내려와 바닥을 스치고 다시 앞 위로 솟는 초승달 (발도: 뽑아 그은 칼끝이 올라간다). 3단계는 화면 밖까지
  // (바닥 줄 위로 지나게: 흩어지는 조각이 바닥에 걸려 가는 줄로 잘리지 않게)
  // (가장 낮은 곳에서 짧게 꺾어 올라간다: 완만한 바닥이 자로 그은 수평 테두리가 되지 않게)
  pts: [[10, -60 - 30 * k], [40, -66 - 26 * k], [66, -48 - 12 * k], [76, -26], [88, -14], [104, -12], [124, -20], [154 + 30 * k, -38 - 8 * k], [190 + 50 * k, -62 - 18 * k]],
  w: 20 + 9 * k, peak: 0.45, bulge: [1.1, 0.55], skew: 0.2, coreLen: 0.45, twist: [[0.25, 0.42], [0.78, 0.45]], thread: [0.2, 0.85, 2.5 + 0.5 * k, -1], wave: [2.5, 50], hold: 2, fade: 10 + 2 * k,
});
/** 14-9 G 검은 틈: 리본 한가운데를 따라 긋는 잉크 (빛이 둘로 쪼개진다) */
const chargeGap = (k: number): GShape => ({ kind: 'ink', at: [26, -62 - 28 * k], angle: 52 - 6 * k, len: 70 + 34 * k, w: 6 + 2 * k, notch: [[0.34, 2], [0.62, 2]], hold: 2, fade: 9 + 2 * k });
const chargeHit = (k: number): GShape[] => [
  { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', r: 70 + 18 * k, w: 3 + (k > 1 ? 1 : 0), thick: -150, gaps: [[-30, -14], [100, 116]], hold: 2, fade: 11 + k },
  glint(-40, 1 + 0.25 * k, 1, 4 + k),
  dust(10 + 5 * k, -30, 2 + 0.3 * k, 30 + 6 * k, 140),
  mist(2 + k, 4 + k, 26 + 4 * k),
];
const chargeLv = (k: number, aux: string[], fx: GMove['fx'], extra: GShape[] = []): GMove => ({
  grade: 'strong',
  grammar: k >= 3 ? [1, 2, 3, 4, 5, 7, 8] : [1, 2, 3, 5, 7],
  tech: { main: 'G', aux },
  hitY: -26,
  light: { r: 30 + 12 * k, t: 20 },
  screen: k >= 3 ? { press: { mode: 'tint', ticks: 2, color: '#060a1c', scale: 0.4 }, silhouette: 3 } : k >= 2 ? { silhouette: 2 } : undefined,
  fx: k >= 3 ? fx : undefined,
  shapes: [chargeRibbon(k), chargeGap(k), ...extra, ...chargeHit(k)],
});
/** 차지 3단계 (시안 1 채택): G 검은 틈 / A 임팩트 프레임 · K 카메라 (긋는 방향으로만 흔들기 + 줌 펀치) */
export const EUNWOO_GG_CHARGE: readonly GMove[] = [
  chargeLv(1, ['A', 'K'], undefined),
  chargeLv(2, ['A', 'K'], undefined),
  chargeLv(3, ['A', 'K'], { impact: { at: 1, ticks: 2, bg: '#fffbef', ink: '#101a3c' }, zoom: { at: 1, k: 1.06, ticks: 1 }, kick: { at: 1, dx: 5, dy: 3, ticks: 8, shake: true } }),
];

// ───────────────────────── 스킬 1 응답 · 스킬 2 아직 여기 있어 · 필살기 선의 (판정 없는 기술은 사건 자리 기준) ─────────────────────────

/**
 * 스킬 1 응답 (기술): 떠난 자리 → 나타난 자리를 잇는 금실 바늘땀이 공간에 1초 넘게 남는다 (stitch 길은 렌더가 사건 자리로 만든다).
 * 나타난 자리는 'hit' 기준 (나타난 몸 가운데). 시안 1 (채택): J 남는 흔적 / C 모양 변신 (반짝임 → 고리 → 꽃잎) · M 전조 (손끝으로 빨려 드는 선)
 */
export interface GSkill {
  grade: 'skill';
  grammar: readonly number[];
  tech: { main: string; aux: readonly string[] };
  /** 바늘땀·흔적 설정 (길 점은 렌더가 채운다) */
  stitch?: { len: number; w: number; gap: number; slant: number; sew: number; life: number };
  /** 나타난 자리 (또는 몸 가운데) 기준 모양 */
  shapes: readonly GShape[];
  /** 떠난 자리 기준 모양 */
  from?: readonly GShape[];
  fx?: GMove['fx'];
  light?: { r: number; t: number };
  /** 전조를 쓰는가 (스킬 시작 틱에 손끝으로 빨려 드는 선) */
  prelude?: boolean;
}

const ARRIVE_GLINT: GShape = { kind: 'flash', anchor: 'hit', layer: 'front', rim: 2, spikes: [[0, 16, 2.6], [90, 10, 2], [180, 16, 2.6], [-90, 12, 2], [45, 6, 1.4], [-135, 6, 1.4]], hold: 1, fade: 4 };
const STITCH = { len: 7, w: 3, gap: 7, slant: 52, sew: 4, life: 66 };
export const EUNWOO_GG_SKILL1: readonly GSkill[] = [
  {
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'J', aux: ['C', 'M'] }, stitch: STITCH, prelude: true, light: { r: 46, t: 20 },
    shapes: [
      ARRIVE_GLINT,
      { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', r: 40, w: 4, thick: 60, gaps: [[150, 170]], delay: 2, hold: 1, fade: 8 },
      { kind: 'flutter', anchor: 'hit', from: [[-30, -6], [0, -32], [30, -6], [0, 26]], n: 8, size: 6, dir: -90, speed: 1.2, fan: 360, lift: 0.1, life: 34, delay: 4 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 10, spread: 8, speed: 1.6, dir: -90, fan: 200, life: 28 },
    ],
    from: [{ kind: 'flutter', from: [[0, -40], [0, -10]], n: 5, size: 6, dir: -90, speed: 0.8, fan: 160, lift: 0.12, life: 30 }],
  },
  {
    // 시안 2: J / D 2.5D 깊이 (나타난 자리 바닥에 누운 고리, 카메라 쪽으로 꽃잎) · L 색 뒤집기 (나타나는 틱)
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'J', aux: ['D', 'L'] }, stitch: STITCH, light: { r: 46, t: 20 },
    fx: { flip: { at: 0, ticks: 1 } },
    shapes: [
      ARRIVE_GLINT,
      { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', at: [0, 28], r: 56, w: 5, thick: 90, sy: 0.2, rot: -7, gaps: [[-100, -84]], hold: 2, fade: 10 },
      { kind: 'flutter', anchor: 'hit', layer: 'front', from: [[0, -6], [0, 6]], n: 7, size: 6, dir: -60, speed: 1.6, fan: 200, lift: 0.08, life: 30, zoom: 0.04, delay: 1 },
    ],
  },
  {
    // 시안 3: J / N 맥동 (풀리기 직전 바늘땀이 한 번 더 굵어진다) · E 화면 밖으로 (간 방향으로 화면을 민다)
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'J', aux: ['N', 'E'] }, stitch: { ...STITCH, w: 3.5 }, light: { r: 46, t: 20 },
    fx: { kick: { at: 0, dx: 6, dy: 0, ticks: 6 } },
    shapes: [
      ARRIVE_GLINT,
      { kind: 'wedge', anchor: 'hit', at: [-6, 0], angle: 0, back: 40, fwd: 260, w: 12, peak: 0.12, bulge: [0.6, 1.5], coreLen: 0.3, pulse: true, hold: 1, fade: 9 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 12, spread: 8, speed: 2, dir: 0, fan: 120, life: 28 },
    ],
  },
];

/**
 * 스킬 2 아직 여기 있어 (기술): 몸 둘레로 퍼지는 백합 꽃잎 고리와 큰 흰 나비 떼, 심장이 뛰듯 두 번 맥동한다 (몸 가운데 'hit' 기준).
 * 시안 1 (채택): N 맥동 / C 모양 변신 (고리가 나비로) · H 환경 반응 (빗줄기가 잠깐 멈춘다, 발밑 물결)
 */
const HEART_RING = (r: number, wait: number, tone: 0 | 1 | 2 | 5 = 1): GShape => ({ kind: 'ring', anchor: 'hit', ripple: 1, r, w: 5, thick: -90, gaps: [[60, 76], [200, 214]], tone, wait, hold: 2, fade: 9, pulse: true });
const BUTTERFLIES = (n: number, zoom = 0): GShape => ({ kind: 'flutter', anchor: 'hit', layer: 'front', from: [[-26, -10], [0, -34], [26, -10], [0, 18]], n, fly: 1, size: 11, dir: -90, speed: 1.6, fan: 300, lift: 0.22, life: 60, every: 1, zoom, wait: 6 });
export const EUNWOO_GG_SKILL2: readonly GSkill[] = [
  {
    grade: 'skill', grammar: [1, 2, 3, 5, 7], tech: { main: 'N', aux: ['C', 'H'] }, light: { r: 60, t: 25 },
    fx: { rain: { ticks: 20 }, puddle: { at: [-14, 14], n: 5 } },
    shapes: [
      HEART_RING(46, 0, 1),
      HEART_RING(62, 5, 5),
      // 머리 위에서 솟는 빛 쐐기 (몸을 가리지 않게 머리 위에서 시작)
      { kind: 'wedge', anchor: 'hit', at: [0, -36], angle: -90, back: 0, fwd: 120, w: 18, peak: 0.2, bulge: [0.7, 1.3], coreLen: 0.4, pulse: true, hold: 3, fade: 10 },
      { kind: 'ink', anchor: 'hit', at: [-60, -52], angle: 30, len: 70, w: 7, notch: [[0.4, 2], [0.66, 2]], hold: 3, fade: 9 },
      BUTTERFLIES(9),
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 14, spread: 14, speed: 1.2, dir: -90, fan: 160, life: 40 },
    ],
  },
  {
    // 시안 2: N / J 남는 흔적 (꽃잎이 몸 둘레에 1초 넘게 떠 있다) · I 시간 엇갈림 (나비가 날개를 멈춘 채 떠 있다가 날아간다)
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'N', aux: ['J', 'I'] }, light: { r: 60, t: 25 },
    shapes: [
      HEART_RING(46, 0, 1),
      HEART_RING(62, 5, 5),
      { kind: 'flutter', anchor: 'hit', from: [[-34, -20], [0, -46], [34, -20], [0, 22]], n: 14, size: 7, tone: 5, dir: -90, speed: 0.2, fan: 360, lift: 0.03, life: 90, every: 1, wait: 4 },
      { ...BUTTERFLIES(7), wait: 14 } as GShape,
    ],
  },
  {
    // 시안 3: N / A 임팩트 프레임 (두 번째 맥동에 흰 화면 1틱) · D 2.5D 깊이 (발밑 물결 고리가 바닥에 누워 퍼진다, 나비가 카메라 쪽으로)
    grade: 'skill', grammar: [1, 2, 5, 7, 8], tech: { main: 'N', aux: ['A', 'D'] }, light: { r: 60, t: 25 },
    fx: { impact: { at: 5, ticks: 1, bg: '#fffbef', ink: '#101a3c' } },
    shapes: [
      HEART_RING(46, 0, 1),
      { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', at: [0, 30], r: 70, w: 5, thick: 90, sy: 0.18, rot: -7, gaps: [[-120, -100]], wait: 5, hold: 2, fade: 12, pulse: true },
      { kind: 'ring', tone: 2, ripple: 1, anchor: 'hit', at: [0, 30], r: 110, w: 4, thick: 90, sy: 0.16, rot: -7, gaps: [[-60, -44]], wait: 9, hold: 1, fade: 12 },
      BUTTERFLIES(8, 0.03),
    ],
  },
];

/**
 * 필살기 선의 (11-5 콘티 그대로, 14-8 문법). 맞힌 틱의 물결과, 연출 장면마다의 신호 (render가 장면 틱에 맞춰 띄운다).
 * 주 기법 D 2.5D 깊이: 물결 고리가 수면에 누운 큰 타원으로 퍼진다. 시안 1 (채택): D / A 임팩트 프레임 (해제: 세계가 깨지는 순간 두 색) · H 환경 반응 (빗줄기가 멈춘다)
 */
export interface GSuper {
  grammar: readonly number[];
  tech: { main: string; aux: readonly string[] };
  /** 판정 물결이 닿은 틱 (sim 연출 시작 사건, 맞은 점·은우 발밑 기준) */
  hit: GMove;
  /** 해제 (세계가 흰 나비 떼로 부서진다, 상대 기준): 모양과 화면 기법 */
  release: { shapes: readonly GShape[]; fx?: GMove['fx']; press?: NonNullable<GMove['screen']>['press'] };
  /** 전개 물결 (은우 발밑 기준, 장면 틱마다) */
  ripple: readonly GShape[];
  /** 어깨에 손 (손끝 → 상대 어깨 금실) */
  touch: readonly GShape[];
}
const SUPER_HIT: GMove = {
  grade: 'super',
  grammar: [1, 2, 3, 5, 7, 8],
  hitY: -24,
  light: { r: 90, t: 25 },
  screen: { press: { mode: 'tint', ticks: 3, color: '#0a1638', scale: 0.38 } },
  shapes: [
    { kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 120, w: 6, thick: 90, sy: 0.18, rot: -7, gaps: [[-140, -120]], hold: 3, fade: 16 },
    { kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 70, w: 5, thick: 90, sy: 0.2, rot: -7, gaps: [[30, 46]], delay: 2, hold: 2, fade: 14 },
    { kind: 'ribbon', pts: [[-40, -2], [-10, -10], [24, -4], [56, -14], [88, -6], [126, -16]], w: 16, peak: 0.5, bulge: [1, 0.7], coreLen: 0.5, thread: [0.2, 0.8, 2.5, 1], wave: [2, 40], hold: 3, fade: 12 },
    { kind: 'ink', anchor: 'hit', at: [-60, -70], angle: 38, len: 120, w: 9, notch: [[0.3, 2], [0.6, 3]], hold: 3, fade: 11 },
    glint(-60, 1.6, 2, 6),
    dust(18, -80, 1.8, 50, 160),
  ],
};
/** 연출 끝 한 번에 들어가는 피해 (sim 'hit'): 세계가 돌아온 뒤 상대 둘레에 은빛 반짝임과 꽃잎만 (은우는 사람을 죽이지 않는다, 폭발 없음) */
export const EUNWOO_GG_SUPER_END: GMove = {
  grade: 'super',
  grammar: [5, 7],
  hitY: -26,
  light: { r: 50, t: 25 },
  shapes: [
    glint(-90, 1.2, 2, 6),
    { kind: 'flutter', anchor: 'hit', from: [[-14, -10], [0, -24], [14, -10]], n: 7, size: 6, tone: 5, dir: -90, speed: 0.6, fan: 220, lift: 0.08, life: 50, every: 2 },
    mist(3, 5, 34, [0, 6]),
  ],
};
const RELEASE_FLY = (zoom: number): GShape => ({ kind: 'flutter', layer: 'front', from: [[-150, -120], [-60, -60], [0, -40], [60, -60], [150, -120], [0, -150]], n: 26, fly: 0.8, size: 12, dir: -90, speed: 2.2, fan: 300, lift: 0.3, life: 60, every: 1, zoom });
export const EUNWOO_GG_SUPER: readonly GSuper[] = [
  {
    grammar: [1, 2, 3, 5, 7, 8], tech: { main: 'D', aux: ['A', 'H'] },
    hit: { ...SUPER_HIT, tech: { main: 'D', aux: ['A', 'H'] }, fx: { rain: { ticks: 40 } } },
    release: {
      fx: { impact: { at: 0, ticks: 2, bg: '#fffbef', ink: '#101a3c' }, rain: { ticks: 30 } },
      press: { mode: 'crack', ticks: 6, color: '#86bde8', crack: '#101a3c' },
      shapes: [
        { kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 160, w: 6, thick: 90, sy: 0.16, rot: -7, gaps: [[-150, -130], [10, 24]], hold: 3, fade: 18 },
        { kind: 'ink', at: [-120, -160], angle: 40, len: 170, w: 11, notch: [[0.3, 3], [0.6, 3]], hold: 3, fade: 12 },
        { kind: 'ink', at: [150, -150], angle: 128, len: 140, w: 9, notch: [[0.4, 2], [0.7, 2]], hold: 3, fade: 12 },
        RELEASE_FLY(0.025),
      ],
    },
    ripple: [{ kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 150, w: 6, thick: 90, sy: 0.16, rot: -7, gaps: [[-140, -120], [40, 56]], hold: 2, fade: 22 }],
    touch: [{ kind: 'flash', layer: 'front', spikes: [[0, 12, 2.4], [90, 7, 1.8], [180, 9, 2], [-90, 8, 1.8]], hold: 6, fade: 6 }],
  },
  {
    // 시안 2: D / J 남는 흔적 (해제 뒤 백합 꽃잎이 화면에 2초 가까이 떠 있다) · N 맥동 (깨지기 직전 세계가 한 번 부푼다: 고리 맥동)
    grammar: [1, 2, 3, 5, 7], tech: { main: 'D', aux: ['J', 'N'] },
    hit: { ...SUPER_HIT, tech: { main: 'D', aux: ['J', 'N'] } },
    release: {
      shapes: [
        { kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 160, w: 7, thick: 90, sy: 0.16, rot: -7, gaps: [[-150, -130], [10, 24]], pulse: true, hold: 3, fade: 18 },
        { kind: 'flutter', from: [[-170, -100], [-80, -150], [0, -60], [80, -150], [170, -100]], n: 24, size: 8, tone: 5, dir: -90, speed: 0.3, fan: 360, lift: 0.05, life: 110, every: 1 },
        RELEASE_FLY(0),
      ],
    },
    ripple: [{ kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 150, w: 6, thick: 90, sy: 0.16, rot: -7, gaps: [[-140, -120], [40, 56]], pulse: true, hold: 2, fade: 22 }],
    touch: [{ kind: 'flash', layer: 'front', spikes: [[0, 12, 2.4], [90, 7, 1.8], [180, 9, 2], [-90, 8, 1.8]], hold: 6, fade: 6 }],
  },
  {
    // 시안 3: D / C 모양 변신 (고리 → 리본 → 나비) · K 카메라 (해제 순간 줌 펀치 + 위로 흔들기)
    grammar: [1, 2, 3, 5, 7], tech: { main: 'D', aux: ['C', 'K'] },
    hit: { ...SUPER_HIT, tech: { main: 'D', aux: ['C', 'K'] } },
    release: {
      fx: { zoom: { at: 0, k: 1.08, ticks: 1 }, kick: { at: 0, dx: 0, dy: -6, ticks: 9, shake: true } },
      shapes: [
        { kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 140, w: 6, thick: 90, sy: 0.16, rot: -7, gaps: [[-150, -130]], hold: 1, fade: 6 },
        { kind: 'ribbon', pts: [[-180, -20], [-120, -70], [-40, -40], [20, -110], [90, -70], [170, -140], [230, -100]], w: 26, peak: 0.5, coreLen: 0.5, thread: [0.2, 0.8, 3, 1], wave: [4, 80], delay: 2, hold: 2, fade: 10 },
        { ...RELEASE_FLY(0.02), delay: 5 } as GShape,
      ],
    },
    ripple: [{ kind: 'ring', tone: 2, ripple: 1, at: [0, -1], r: 150, w: 6, thick: 90, sy: 0.16, rot: -7, gaps: [[-140, -120], [40, 56]], hold: 2, fade: 22 }],
    touch: [{ kind: 'flash', layer: 'front', spikes: [[0, 12, 2.4], [90, 7, 1.8], [180, 9, 2], [-90, 8, 1.8]], hold: 6, fade: 6 }],
  },
];

/** 시안 (14-9 '4타·차지·스킬·필살기는 서로 다른 기법 조합의 시안 3개'): 1번이 게임에 들어간 채택안 */
export const EUNWOO_GG_DRAFTS = {
  atk4: [ATK4_V1, ATK4_V2, ATK4_V3] as readonly GMove[],
  charge: [
    EUNWOO_GG_CHARGE,
    // 시안 2: G / L 색 뒤집기 · N 맥동
    [1, 2, 3].map((k) => chargeLv(k, ['L', 'N'], { flip: { at: 1, ticks: 1 } }, k >= 3 ? [{ ...chargeRibbon(k), w: 12 + 6 * k, pulse: true, wave: [1, 40] } as GShape] : [])),
    // 시안 3: G / E 화면 밖으로 · J 남는 흔적
    [1, 2, 3].map((k) => chargeLv(k, ['E', 'J'], { kick: { at: 1, dx: 8, dy: 2, ticks: 9 } }, k >= 3 ? [
      { kind: 'wedge', at: [70, -24], angle: 14, back: 60, fwd: 360, w: 18, peak: 0.16, bulge: [0.6, 1.5], coreLen: 0.3, hold: 2, fade: 12 },
      { kind: 'flutter', from: [[40, -90], [70, -48], [70, -6], [140, 10]], n: 12, size: 6, dir: 10, speed: 0.25, fan: 360, lift: 0.03, life: 90, every: 2, delay: 8 },
    ] : [])),
  ] as readonly (readonly GMove[])[],
  skill1: EUNWOO_GG_SKILL1,
  skill2: EUNWOO_GG_SKILL2,
  super: EUNWOO_GG_SUPER,
};
