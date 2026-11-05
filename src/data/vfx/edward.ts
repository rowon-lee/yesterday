// 에드워드 공격 이펙트 (숫자 데이터만, 동작연출지침서 14-8 '길티기어식 이펙트' 문법 + 14-4 에드워드 색·고유 모양 + 14-9 연출 기법).
// 판정·동작 데이터(data/characters/edward, data/moves/time)와 따로 둔다. 원호 띠는 해머 머리가 지나는 원호(data/poses/edward EDWARD_ARCS)를
// 따라 휘고, 가장 굵고 밝은 머리 쪽(흰 심)이 판정 상자를 지난다 (14-5). 머리는 뭉툭하고 꼬리는 가늘다 (해머 머리가 가장 늦게 따라온다, 12-0).
// 12장 '느리게 들어 올려 한 번에 무너뜨린다': 원호는 다른 캐릭터보다 굵고 (일반 28~34px, 강 44~58px), 맞을 때마다 바닥이 반응한다
// (바닥 덩어리 파편, 짓누르는 충격파). 공격자 머리·몸통 위로는 큰 모양이 지나가지 않는다 (몸 둘레를 도는 원호는 몸 뒤 겹).
// 색 단계: 0 심 따뜻한 흰 · 1 주색 밝은 청동 · 2 진한 주색 짙은 청동 · 3 잉크 아주 어두운 밤색 · 4 푸른 잔상 (껍데기 장막)
// · 5 밝은 장막 · 6 짙은 장막 (render/chars/edward-gg)
// 좌표: 오른쪽 보기 px, 공격자 발밑 (anchor 'self', 판정이 시작하는 틱 자리) 또는 맞은 점 (anchor 'hit') 기준, y 위가 −. 480×270 화면 (14-8 크기 × 1.5)
// 14-9 기법: tech에 주 기법 1개 + 보조 기법 (한 캐릭터 안에서 주 기법이 겹치지 않는다), fx에 화면·카메라·환경 기법.
import type { GChunks, GMove, GQuake, GShape, GSwoosh, GTone } from './types';

/** 해머 원호 띠 (14-4 '가장 굵은 원호'): 원 가운데·가로·세로 반지름 (EDWARD_ARCS) → 스우시. 머리 쪽이 굵고 뭉툭하다 */
const arc = (c: readonly [number, number], rx: number, ry: number, a0: number, a1: number, w: number, o: Partial<GSwoosh> = {}): GSwoosh => ({
  kind: 'swoosh', c, r: rx, sy: ry / rx, a0, a1, w, peak: 0.76, bulge: [0.95, 0.42], skew: 0.25, coreLen: 0.6, hold: 1, fade: 12, ...o,
});
/** 푸른 잔상 띠 (12-1 '청동빛 원호 + 푸른 잔상(껍데기 색)'): 원호보다 조금 뒤·바깥에서 따라오는 장막 색 띠 */
const ghost = (c: readonly [number, number], rx: number, ry: number, a0: number, a1: number, w: number, o: Partial<GSwoosh> = {}): GSwoosh => ({
  kind: 'swoosh', c, r: rx, sy: ry / rx, a0, a1, w, peak: 0.7, bulge: [1, 0.6], skew: 0.4, tones: [6, 4, 5], main: 0.5, core: 0.18, coreLen: 0.4, hold: 0, fade: 8, ...o,
});
/** 맞은 점 섬광 (14-8 ⑤): 다섯 갈래, 공격 방향으로 길다 */
const spark = (dir: number, size: number, hold = 1, fade = 4, rim: GTone = 2): GShape => ({
  kind: 'flash', anchor: 'hit', layer: 'front', hold, fade, rim,
  spikes: [[dir, 15 * size, 2.8], [dir + 72, 8 * size, 2], [dir + 150, 10 * size, 2.2], [dir - 150, 7 * size, 1.8], [dir - 72, 9 * size, 2]],
});
/** 불씨 (14-8 ⑦): 청동·흰 1~2px, 떨어져 바닥에서 튄다 */
const embers = (n: number, dir: number, speed: number, life: number, fan = 120): GShape => ({ kind: 'embers', anchor: 'hit', layer: 'front', n, spread: 6, speed, dir, fan, life });
/** 흙먼지·열기 (14-2 잔향): 짙은 청동 → 잉크 덩어리가 천천히 오른다 */
const dust = (at: readonly [number, number], n: number, size: number, life: number, anchor: 'self' | 'hit' = 'self'): GShape => ({ kind: 'smoke', anchor, at, n, spread: 8, rise: 0.35, size, life, delay: 2 });
/** 바닥 덩어리 파편 (14-4) */
const rocks = (at: readonly [number, number], n: number, size: readonly [number, number], speed: number, dir: number, fan: number, life: number, o: Partial<GChunks> = {}): GChunks => ({
  kind: 'chunks', at, n, spread: 6, size, speed, dir, fan, life, ...o,
});
/** 짓누르는 충격파 (14-4): 바닥 점에서 퍼지며 납작해지는 반원 띠 */
const crush = (at: readonly [number, number], r: readonly [number, number], h: readonly [number, number], w: number, o: Partial<GQuake> = {}): GQuake => ({
  kind: 'quake', at, r, h, spread: 10, w, hold: 2, fade: 12, ...o,
});
/** 맞은 점 기준으로 옮긴다: 맞은 점이 바닥 위 dy px일 때 (모양의 y 0이 바닥에 놓이게) */
const onHitFloor = (list: readonly GShape[], dy: number): GShape[] => list.map((sh) => {
  const at = 'at' in sh && sh.at ? sh.at : [0, 0];
  return { ...sh, anchor: 'hit', at: [at[0], at[1] + dy] } as GShape;
});
/** 일반 타 맞은 점: 섬광 + 불씨 + 흙먼지 */
const smallHit = (dir: number, size: number, life = 24): GShape[] => [spark(dir, size), embers(9 + Math.round(4 * size), dir - 20, 1.6 + 0.4 * size, life), dust([2, -2], 2, 2.5 + size, 18, 'hit')];

// ───────────────────────── 1~4타 한 문장 (14-9 F 보조): 1타 원호 하나 → 2타 원호 + 바닥 조각 → 3타 원호가 박혀 바닥이 터짐 → 4타 온전한 원 + 양쪽 충격파 ─────────────────────────

/** 4타 풀스윙 원호 (ARC4 가운데 0,−32 · 55×22): 몸 뒤에서 발 앞을 지나 앞으로, 가장 굵게. 납작한 원을 6° 기울인다 (밑이 수평으로 길게 눕지 않게) */
const ATK4_ARC: GShape[] = [
  ghost([0, -32], 62, 28, 190, -30, 30, { rot: -6, fade: 10 }),
  arc([0, -32], 58, 25, 205, -22, 54, { rot: -6, peak: 0.8, coreLen: 0.55, hold: 2, fade: 14 }),
];
/** 4타 화면 밖으로 (14-9 E): 맞은 점에서 날아가는 쪽(위 앞 −30°)으로 화면 밖까지 빛기둥 둘 */
const ATK4_OUT: GShape[] = [
  { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: -30, back: 34, fwd: 400, w: 36, peak: 0.1, bulge: [0.7, 1.3], skew: 0.15, hold: 2, fade: 14 },
  { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: -12, back: 12, fwd: 300, w: 20, peak: 0.12, bulge: [0.7, 1.4], skew: -0.2, hold: 1, fade: 12 },
];
/** 4타 맞은 점 공통: 큰 원 고리 (푸른 잔상), 방사 가시, 잉크 쐐기 둘, 섬광, 불씨, 흙먼지 */
const ATK4_HIT: GShape[] = [
  { kind: 'ring', anchor: 'hit', tone: 4, ripple: 0.4, r: 110, w: 5, thick: -150, rot: -5, gaps: [[-50, -34], [40, 54], [128, 140]], hold: 2, fade: 12 },
  {
    kind: 'rays', anchor: 'hit', hold: 2, fade: 9,
    lines: [[-160, 100, 50, 3.5, 0], [-118, 94, 58, 3, 1], [-64, 102, 52, 3.5, 0], [24, 96, 60, 3, 1], [62, 100, 48, 3.5, 0], [104, 94, 56, 3, 1], [146, 98, 52, 3.5, 0]],
  },
  { kind: 'ink', anchor: 'hit', at: [-24, -46], angle: 36, len: 112, w: 10, notch: [[0.3, 2], [0.58, 3], [0.82, 2]], hold: 2, fade: 11 },
  { kind: 'ink', anchor: 'hit', at: [10, 22], angle: -40, len: 84, w: 8, notch: [[0.4, 2], [0.7, 2]], hold: 1, fade: 10 },
  spark(-30, 1.7, 2, 5),
  embers(26, -40, 2.8, 44, 140),
  dust([4, -4], 5, 6, 34, 'hit'),
];
/** 4타 발밑 (F 완성): 해머가 발 앞 바닥을 스치며 양쪽으로 짓누르는 충격파 + 바닥 덩어리 */
const ATK4_FLOOR: GShape[] = [
  crush([8, 0], [12, 50], [22, 8], 18, { hold: 3, fade: 14 }),
  rocks([12, -2], 8, [5, 12], 3.6, -72, 80, 44),
];

/** 4타 시안 1 (채택): E 화면 밖으로 / D 2.5D 깊이 (바닥에 누운 큰 타원 고리·카메라 쪽으로 커지며 날아오는 덩어리) · K 카메라 (줌 펀치 + 날아가는 쪽으로만 흔들기) */
const ATK4_V1: GMove = {
  grade: 'strong',
  grammar: [1, 2, 3, 4, 5, 7, 8],
  tech: { main: 'E', aux: ['D', 'K'] },
  hitY: -24,
  light: { r: 70, t: 22 },
  screen: { press: { mode: 'crack', ticks: 2, color: '#6e3a12', crack: '#170b06' }, silhouette: 3 },
  fx: { kick: { at: 0, dx: 9, dy: -5, ticks: 10, shake: true }, zoom: { at: 0, k: 1.08, ticks: 1 } },
  shapes: [
    ...ATK4_ARC,
    // D: 맞은 사람 발밑 바닥에 누운 큰 타원 고리
    { kind: 'ring', anchor: 'hit', tone: 2, ripple: 0.35, at: [0, 24], r: 92, w: 6, thick: 90, sy: 0.2, rot: -8, gaps: [[-130, -108]], hold: 2, fade: 14 },
    ...ATK4_OUT,
    ...ATK4_HIT,
    crush([8, 0], [12, 50], [22, 8], 18, { hold: 3, fade: 14 }),
    // D: 덩어리가 카메라 쪽으로 커지며 날아온다 (앞 겹)
    rocks([12, -2], 8, [5, 11], 3.6, -72, 80, 44, { layer: 'front', zoom: 0.025 }),
  ],
};
/** 4타 시안 2: E / A 임팩트 프레임 (맞은 틱에 두 색 2틱) · H 환경 반응 (빗줄기가 멈추고 물웅덩이가 솟는다) */
const ATK4_V2: GMove = {
  ...ATK4_V1,
  tech: { main: 'E', aux: ['A', 'H'] },
  fx: { kick: { at: 0, dx: 9, dy: -5, ticks: 10 }, impact: { at: 0, ticks: 2, bg: '#fff3dc', ink: '#170b06' }, rain: { ticks: 20 }, puddle: { at: [-30, 6, 40], n: 9 } },
  shapes: [...ATK4_ARC, ...ATK4_OUT, ...ATK4_HIT, ...ATK4_FLOOR],
};
/** 4타 시안 3: E / G 검은 틈 (원호 한가운데를 잉크가 갈라 빛이 둘로) · N 맥동 (고리·빛기둥이 사라지기 직전 한 번 더 부푼다) */
const ATK4_V3: GMove = {
  ...ATK4_V1,
  tech: { main: 'E', aux: ['G', 'N'] },
  fx: { kick: { at: 0, dx: 9, dy: -5, ticks: 10 } },
  shapes: [
    ...ATK4_ARC,
    // G: 원호의 굵은 머리를 가르는 검은 틈
    { kind: 'ink', at: [-10, -6], angle: -14, len: 92, w: 11, notch: [[0.34, 2], [0.62, 3]], hold: 2, fade: 12 },
    ...ATK4_OUT.map((s) => ({ ...s, pulse: true }) as GShape),
    { kind: 'ink', anchor: 'hit', at: [6, -2], angle: -30, len: 220, w: 8, notch: [[0.3, 2], [0.6, 2]], hold: 2, fade: 12 },
    ...ATK4_HIT.map((s) => (s.kind === 'ring' ? ({ ...s, pulse: true } as GShape) : s)),
    ...ATK4_FLOOR,
  ],
};

export const EDWARD_GG: Partial<Record<string, GMove>> = {
  /**
   * 1 기본 1타 가로 휘두르기 (일반): 어깨에서 넘어와 가슴 앞을 가로지르는 굵은 청동 원호 하나 (ARC1 지름 72px), 뒤에 푸른 잔상.
   * 머리가 바닥에 닿는 틱에 작은 덩어리. L 색 뒤집기 (맞는 순간 1틱 청동이 껍데기의 푸른 장막으로) / F
   */
  atk1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'L', aux: ['F'] },
    hitY: -44,
    light: { r: 24, t: 16 },
    fx: { flip: { at: 1, ticks: 1 } },
    shapes: [
      ghost([14, -36], 41, 37, -138, -14, 20),
      arc([14, -36], 36, 32, -125, 12, 30),
      // 머리가 바닥에 닿는 틱 (지나치기, 진행 6틱): 발 앞 작은 덩어리
      rocks([40, -2], 3, [4, 7], 2.2, -100, 70, 30, { delay: 6 }),
      ...smallHit(-10, 1, 22),
    ],
  },
  /**
   * 2 기본 2타 되돌려 휘두르기 (일반): 반대 방향 낮은 원호 (아래 뒤 → 앞 위, ARC2), 푸른 잔상, 바닥을 스치며 퍼 올린 조각, 잉크 쐐기 1개.
   * I 시간 엇갈림 (히트스톱 동안 세상은 멈추고 원호만 계속 돈다) / F
   */
  atk2: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'I', aux: ['F'] },
    hitY: -20,
    light: { r: 24, t: 16 },
    shapes: [
      ghost([16, -28], 47, 33, 150, 6, 20),
      arc([16, -28], 42, 28, 136, -24, 32, { grow: 2.2, skew: -0.2 }),
      { kind: 'ink', at: [28, -52], angle: 72, len: 50, w: 8, notch: [[0.4, 2], [0.66, 2]], hold: 1, fade: 9 },
      rocks([8, -2], 4, [4, 8], 2.6, -55, 50, 32),
      ...smallHit(-35, 1.1, 24),
    ],
  },
  /**
   * 3 기본 3타 머리 위로 돌려 내려찍기 (일반): 위 → 아래 큰 원호 (ARC3), 맞는 순간엔 섬광만, 해머가 바닥에 박히는 틱(진행 4틱)에
   * 바닥이 늦게 터진다: 짓누르는 충격파 (양쪽 20px씩, 12-1 '바닥 균열 40px') + 덩어리 + 짧은 빛기둥. B 지연 폭발 / F
   */
  atk3: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'B', aux: ['F'] },
    hitY: -40,
    light: { r: 26, t: 16 },
    shapes: [
      ghost([18, -40], 41, 45, -132, 18, 20),
      arc([18, -40], 36, 40, -122, 46, 32, { peak: 0.66 }),
      // B: 바닥에 박힌 자리에서 늦게 터진다 (해머가 닿는 진행 4틱: 맞혔으면 히트스톱이 끝난 뒤)
      crush([55, 0], [12, 56], [36, 11], 24, { delay: 4, hold: 3, fade: 13, spread: 12 }),
      { kind: 'wedge', at: [55, 0], angle: -98, back: 4, fwd: 112, w: 28, peak: 0.22, bulge: [0.6, 1.2], skew: 0.2, delay: 4, hold: 2, fade: 11 },
      { kind: 'wedge', at: [58, 0], angle: -62, back: 2, fwd: 64, w: 16, peak: 0.25, bulge: [0.6, 1.2], delay: 5, hold: 1, fade: 10 },
      { kind: 'ink', at: [34, -62], angle: 70, len: 66, w: 9, notch: [[0.4, 2], [0.7, 2]], delay: 4, hold: 1, fade: 9 },
      rocks([55, -2], 9, [5, 12], 3.4, -90, 120, 40, { delay: 4 }),
      dust([55, -2], 3, 4, 26),
      spark(60, 0.9, 1, 3),
      embers(10, -60, 1.8, 22),
    ],
  },
  atk4: ATK4_V1,
  /**
   * 5 띄우기 퍼 올리기 (강): 발 앞 바닥에서 머리 위까지 솟는 세로 원호 → 맞은 점 둘레 고리 → 퍼 올린 바닥 덩어리가 솟구친다.
   * C 모양 변신 (원호 → 고리 → 덩어리) / D 2.5D 깊이 (덩어리가 카메라 쪽으로 커진다) · I 시간 엇갈림 (히트스톱 동안 원호가 계속 솟는다)
   */
  launcher: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'C', aux: ['D', 'I'] },
    hitY: -40,
    light: { r: 46, t: 20 },
    shapes: [
      {
        kind: 'ribbon', pts: [[24, 2], [30, -22], [34, -48], [30, -74], [18, -96], [2, -110]],
        w: 40, peak: 0.6, bulge: [1, 0.5], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, grow: 2, hold: 2, fade: 12,
      },
      { kind: 'ink', at: [44, -20], angle: -96, len: 92, w: 9, notch: [[0.32, 2], [0.6, 3]], hold: 2, fade: 10 },
      // C 둘째 모양: 고리 (살아 있는 3틱 뒤)
      { kind: 'ring', anchor: 'hit', tone: 4, ripple: 0.4, r: 74, w: 5, thick: -100, rot: -4, gaps: [[20, 36], [150, 166]], wait: 3, hold: 2, fade: 11 },
      // C 셋째 모양: 퍼 올린 바닥 덩어리 (살아 있는 6틱 뒤), D 카메라 쪽으로 커진다
      rocks([28, -2], 9, [5, 12], 4.4, -92, 56, 46, { wait: 6, layer: 'front', zoom: 0.02 }),
      crush([28, 0], [8, 34], [16, 6], 14, { hold: 2, fade: 10 }),
      spark(-90, 1.4, 2, 4),
      embers(18, -90, 2.6, 36, 90),
    ],
  },
  /**
   * 6 쓸기 바닥 쓸기 (일반): 발목 높이를 가로지르는 낮고 납작한 원호, 바닥을 따라 밀려나는 물과 돌.
   * H 환경 반응 (빗줄기가 멈추고 쓸고 간 자리의 물웅덩이가 솟는다) / D 2.5D 깊이 (맞은 사람 발밑에 누운 타원 고리)
   */
  sweep: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'H', aux: ['D'] },
    hitY: -12,
    light: { r: 24, t: 16 },
    fx: { rain: { ticks: 20 }, puddle: { at: [-34, -8, 18], n: 8 } },
    shapes: [
      {
        kind: 'ribbon', pts: [[-28, -6], [-2, -3], [24, -6], [46, -13], [66, -24]],
        w: 28, peak: 0.72, bulge: [1, 0.45], skew: 0.15, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, hold: 1, fade: 11,
      },
      { kind: 'ring', anchor: 'hit', tone: 2, ripple: 0.35, at: [0, 10], r: 58, w: 5, thick: 90, sy: 0.22, rot: -7, gaps: [[-150, -128]], hold: 2, fade: 12 },
      rocks([30, -2], 4, [4, 8], 2.8, -30, 40, 32),
      ...smallHit(-20, 1, 24),
    ],
  },
  /**
   * 7 대시 공격 돌진 휘두르기 (강): 몸 아래를 지나 크게 가로지르는 원호 (뒤 아래 → 앞 위), 돌진하던 바닥의 덩어리, 잉크 쐐기.
   * K 카메라 (줌 펀치 1.06배 + 돌진 방향으로만 흔들기) / J 남는 흔적 (원호가 지나간 자리에 탄 자국이 1초 넘게 남는다) · D (덩어리가 카메라 쪽으로)
   */
  dashAttack: {
    grade: 'strong',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'K', aux: ['J', 'D'] },
    hitY: -28,
    light: { r: 50, t: 20 },
    fx: { zoom: { at: 0, k: 1.06, ticks: 1 }, kick: { at: 0, dx: 8, dy: 0, ticks: 8, shake: true } },
    shapes: [
      {
        kind: 'ribbon', pts: [[-44, -36], [-16, -20], [14, -13], [42, -19], [60, -32], [70, -50]],
        w: 46, peak: 0.66, bulge: [1, 0.45], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, hold: 2, fade: 12,
      },
      // J: 지나간 자리에 남는 탄 자국 (잉크·짙은 청동, 흩어진 뒤에도 1초 넘게)
      {
        kind: 'ribbon', pts: [[-40, -34], [-14, -19], [14, -13], [42, -19], [60, -32], [68, -48]],
        w: 12, peak: 0.6, bulge: [1, 0.8], skew: 0, tones: [3, 2, 2], main: 0.5, core: 0, wave: [0, 40], ruffle: 0.08, breathe: 0.14, delay: 10, hold: 44, fade: 30,
      },
      { kind: 'ink', anchor: 'hit', at: [-18, -40], angle: 40, len: 86, w: 9, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 10 },
      { kind: 'ring', anchor: 'hit', tone: 4, ripple: 0.4, r: 70, w: 5, thick: 180, rot: -4, gaps: [[60, 76], [-80, -64]], hold: 2, fade: 11 },
      rocks([20, -2], 7, [5, 11], 3.4, -62, 70, 40, { layer: 'front', zoom: 0.02 }),
      spark(-14, 1.4, 2, 4),
      embers(20, -20, 2.6, 36),
      dust([4, -2], 3, 4, 26, 'hit'),
    ],
  },
  /** 8~10 공중 1타 내려치기 (일반): 원 조각 (ARC_A1), 푸른 잔상. F 콤보 변주 (1타 조각 → 2타 반원 → 3타 온전한 원) / L 색 뒤집기 */
  air1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'F', aux: ['L'] },
    hitY: -44,
    light: { r: 22, t: 15 },
    fx: { flip: { at: 1, ticks: 1 } },
    shapes: [
      ghost([12, -42], 37, 37, -112, 0, 18),
      arc([12, -42], 32, 32, -100, 16, 26),
      ...smallHit(20, 0.9, 20),
    ],
  },
  /** 9 공중 2타 퍼 올리기 (일반): 아래에서 앞 위로 반원 (ARC_A2), 잉크 쐐기. F / I 시간 엇갈림 (히트스톱 동안 원호가 계속 돈다) */
  air2: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'F', aux: ['I'] },
    hitY: -26,
    light: { r: 22, t: 15 },
    shapes: [
      ghost([12, -30], 37, 37, 154, -20, 18),
      arc([12, -30], 32, 32, 142, -40, 28, { grow: 2.2, skew: -0.2 }),
      { kind: 'ink', at: [30, -66], angle: 70, len: 46, w: 7, notch: [[0.45, 2]], hold: 1, fade: 9 },
      ...smallHit(-40, 1, 22),
    ],
  },
  /**
   * 10 공중 3타 내려쳐 떨어뜨리기 (강): 몸 둘레 한 바퀴 온전한 원 (ARC_A3, 몸 뒤 겹) → 고리 → 맞은 점에서 바닥으로 꽂히는 빛 쐐기 (아래로 짓눌러 떨어뜨린다).
   * F / C 모양 변신 (원 → 고리 → 아래로 꽂히는 쐐기) · K 카메라 (아래로만 흔들기)
   */
  air3: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'F', aux: ['C', 'K'] },
    hitY: -32,
    light: { r: 40, t: 18 },
    fx: { kick: { at: 5, dx: 0, dy: 6, ticks: 7, shake: true } },
    shapes: [
      ghost([14, -36], 37, 37, -170, 70, 20),
      arc([14, -36], 32, 32, -160, 92, 32, { peak: 0.62, hold: 1, fade: 10 }),
      { kind: 'ring', anchor: 'hit', tone: 4, ripple: 0.4, r: 58, w: 5, thick: 60, rot: -4, gaps: [[-120, -104], [160, 172]], wait: 2, hold: 2, fade: 10 },
      { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: 76, back: 20, fwd: 150, w: 28, peak: 0.14, bulge: [0.7, 1.3], wait: 5, hold: 2, fade: 11 },
      { kind: 'ink', anchor: 'hit', at: [-26, -20], angle: 58, len: 70, w: 8, notch: [[0.4, 2], [0.7, 2]], wait: 5, hold: 1, fade: 9 },
      spark(76, 1.3, 2, 4),
      embers(16, 70, 2.4, 30, 100),
    ],
  },
  /**
   * 11 내려찍기 (강): 머리 위로 든 해머가 수직으로 떨어지는 세로 원호 (공중, 판정이 시작하는 틱). 착지는 slamLand 사건 (EDWARD_GG_EVENTS):
   * 반원 충격파 (반지름 48px → 72px)가 짓누르며 퍼지고, 바닥에 누운 큰 타원 고리, 덩어리가 카메라 쪽으로.
   * D 2.5D 깊이 / H 환경 반응 (빗줄기 멈춤·물웅덩이) · K 카메라 (아래로만 흔들기)
   */
  slam: {
    grade: 'strong',
    grammar: [1, 2, 3, 5, 7, 8],
    tech: { main: 'D', aux: ['H', 'K'] },
    hitY: -30,
    light: { r: 40, t: 18 },
    shapes: [
      {
        kind: 'ribbon', pts: [[-12, -96], [12, -100], [34, -84], [46, -54], [44, -24], [38, 2]],
        w: 40, peak: 0.62, bulge: [1, 0.5], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, hold: 2, fade: 12,
      },
      { kind: 'ink', at: [14, -104], angle: 64, len: 84, w: 9, notch: [[0.34, 2], [0.62, 2]], hold: 1, fade: 10 },
      spark(80, 1.3, 2, 4),
      embers(18, 60, 2.4, 30),
    ],
    // 떨어지는 몸을 따라오는 꼬리: 머리 위로 길게 남는 빛 쐐기 둘 (해머가 끌고 내려오는 무게)
    trail: [
      { kind: 'wedge', at: [10, -40], angle: -92, back: 0, fwd: 120, w: 26, peak: 0.12, bulge: [0.6, 1.3], hold: 8, fade: 7 },
      { kind: 'wedge', at: [30, -16], angle: -98, back: 0, fwd: 90, w: 14, peak: 0.15, bulge: [0.6, 1.3], delay: 1, hold: 6, fade: 7 },
    ],
  },
  /**
   * 12 벽 박차기 (강): 벽을 박찬 몸과 함께 머리 위에서 앞 아래로 내리치는 대각선 원호, 한가운데를 가르는 잉크 (빛이 둘로),
   * 맞은 점에서 앞 아래 화면 밖까지 빛기둥. G 검은 틈 / E 화면 밖으로 (앞 아래로 화면을 민다) · K 카메라 (대각선으로만 흔들기)
   */
  wallKick: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'G', aux: ['E', 'K'] },
    hitY: -16,
    light: { r: 46, t: 18 },
    fx: { kick: { at: 0, dx: 6, dy: 5, ticks: 9, shake: true } },
    shapes: [
      {
        kind: 'ribbon', pts: [[-22, -74], [6, -88], [32, -72], [46, -42], [50, -10], [46, 6]],
        w: 44, peak: 0.62, bulge: [1, 0.5], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, hold: 2, fade: 12,
      },
      // G: 원호 한가운데를 가르는 검은 틈
      { kind: 'ink', at: [-4, -86], angle: 42, len: 104, w: 11, notch: [[0.3, 2], [0.56, 3], [0.8, 2]], hold: 2, fade: 11 },
      { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: 38, back: 24, fwd: 280, w: 26, peak: 0.12, bulge: [0.7, 1.3], hold: 2, fade: 12 },
      { kind: 'ring', anchor: 'hit', tone: 4, ripple: 0.4, r: 64, w: 5, thick: -140, rot: -4, gaps: [[30, 46], [-110, -94]], hold: 2, fade: 10 },
      spark(38, 1.3, 2, 4),
      embers(18, 30, 2.4, 30),
      dust([2, 4], 3, 4, 24, 'hit'),
    ],
    rehit: [spark(38, 0.7, 1, 3), embers(6, 30, 1.6, 18)],
  },
};

// ───────────────────────── 차지 워 해머 올려치기 (12-2): 단계마다 커지는 아래 → 앞 → 위 큰 반원 + 남는 탄 자국 (J) ─────────────────────────

/** 차지 원호 (CHARGE_ARC 가운데 4,−34 · 44×28을 조금 키워): 몸 뒤 바닥에서 아래 → 앞 → 머리 위로 */
const chargeArc = (lv: number): GShape[] => {
  const w = [36, 46, 58][lv - 1]!;
  const k = [1, 1.08, 1.16][lv - 1]!;
  return [
    ghost([4, -34], 52 * k, 40 * k, 160, -84, w * 0.62, { fade: 9 }),
    arc([4, -34], 46 * k, 34 * k, 150, -96, w, { peak: 0.55, coreLen: 0.5, hold: 2, fade: 13 }),
  ];
};
/** J 남는 흔적: 원호가 지나간 자리에 탄 자국 (잉크·짙은 청동)이 1~2초 남았다가 꼬리부터 찢어진다 */
const chargeScar = (lv: number): GShape => ({
  kind: 'swoosh', c: [4, -34], r: 46 * [1, 1.08, 1.16][lv - 1]!, sy: 34 / 46, a0: 140, a1: -80, w: 10 + 2 * lv, peak: 0.55, bulge: [1, 0.8], skew: 0,
  tones: [3, 2, 2], main: 0.5, core: 0, breathe: 0.14, delay: 12, hold: 40 + 20 * lv, fade: 30,
});
/** 차지 맞은 점 (단계별) */
const chargeHit = (lv: number): GShape[] => [
  { kind: 'ring', anchor: 'hit', tone: 4, ripple: 0.4, r: [62, 84, 112][lv - 1]!, w: 4 + lv, thick: -90, rot: -4, gaps: [[-20, -4], [96, 112], [190, 204]], hold: 2, fade: 11 },
  { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: -84, back: 16, fwd: [140, 220, 360][lv - 1]!, w: [20, 28, 38][lv - 1]!, peak: 0.12, bulge: [0.7, 1.3], hold: 2, fade: 12 },
  ...(lv >= 2 ? [{ kind: 'ink', anchor: 'hit', at: [-30, -60], angle: 62, len: 96, w: 10, notch: [[0.3, 2], [0.62, 3]], hold: 2, fade: 10 } as GShape] : []),
  ...(lv >= 3 ? [
    { kind: 'ink', anchor: 'hit', at: [22, 20], angle: -120, len: 76, w: 8, notch: [[0.45, 2]], hold: 1, fade: 10 } as GShape,
    {
      kind: 'rays', anchor: 'hit', hold: 2, fade: 9,
      lines: [[-150, 100, 54, 3.5, 0], [-104, 96, 60, 3, 1], [-40, 102, 50, 3.5, 0], [10, 96, 58, 3, 1], [56, 100, 52, 3.5, 0], [128, 94, 56, 3, 1]],
    } as GShape,
  ] : []),
  spark(-84, 1 + 0.3 * lv, 2, 4),
  embers(14 + 6 * lv, -90, 2.2 + 0.3 * lv, 36, 100),
];
const chargeLv = (lv: number, o: { tech: { main: string; aux: string[] }; extra?: (lv: number) => GShape[]; fx?: GMove['fx']; screen?: GMove['screen']; pulse?: boolean }): GMove => ({
  grade: 'strong',
  grammar: lv >= 3 ? [1, 2, 3, 4, 5, 7, 8] : [1, 2, 3, 4, 5, 7],
  tech: o.tech,
  hitY: -36,
  light: { r: [40, 56, 80][lv - 1]!, t: 20 },
  screen: lv >= 3 ? o.screen ?? { press: { mode: 'crack', ticks: 2, color: '#6e3a12', crack: '#170b06' }, silhouette: 3 } : lv === 2 ? { silhouette: 2 } : undefined,
  fx: lv >= 3 ? o.fx : undefined,
  shapes: [...chargeArc(lv), chargeScar(lv), ...chargeHit(lv).map((sh) => (o.pulse && (sh.kind === 'ring' || sh.kind === 'wedge') ? ({ ...sh, pulse: true } as GShape) : sh)), ...(o.extra?.(lv) ?? [])],
});
/** 차지 시안 1 (채택): J 남는 흔적 / A 임팩트 프레임 (3단계 두 색 2틱) · K 카메라 (줌 펀치 + 위로만 흔들기) */
const CHARGE_V1: GMove[] = [1, 2, 3].map((lv) => chargeLv(lv, {
  tech: { main: 'J', aux: ['A', 'K'] },
  fx: { impact: { at: 0, ticks: 2, bg: '#fff3dc', ink: '#170b06' }, zoom: { at: 2, k: 1.07, ticks: 1 }, kick: { at: 2, dx: 0, dy: -8, ticks: 9, shake: true } },
}));
/** 차지 시안 2: J / G 검은 틈 (솟는 빛기둥 한가운데를 잉크가 가른다) · N 맥동 (고리·빛기둥이 한 번 더 부푼다) */
const CHARGE_V2: GMove[] = [1, 2, 3].map((lv) => chargeLv(lv, {
  tech: { main: 'J', aux: ['G', 'N'] },
  fx: { kick: { at: 0, dx: 0, dy: -6, ticks: 8 } },
  pulse: true,
  extra: (l) => [
    { kind: 'ink', anchor: 'hit', at: [2, 30], angle: -84, len: [120, 180, 260][l - 1]!, w: 8 + l, notch: [[0.3, 2], [0.6, 2]], hold: 2, fade: 11 },
  ],
}));
/** 차지 시안 3: J / H 환경 반응 (빗줄기 멈춤·물웅덩이) · D 2.5D 깊이 (맞은 사람 발밑 바닥에 누운 큰 타원 고리) */
const CHARGE_V3: GMove[] = [1, 2, 3].map((lv) => chargeLv(lv, {
  tech: { main: 'J', aux: ['H', 'D'] },
  fx: { rain: { ticks: 24 }, puddle: { at: [-20, 10, 36], n: 9 } },
  extra: (l) => [{ kind: 'ring', anchor: 'hit', tone: 2, ripple: 0.35, at: [0, 30], r: [60, 80, 104][l - 1]!, w: 6, thick: 90, sy: 0.2, rot: -8, gaps: [[-130, -110]], hold: 2, fade: 13 }],
}));

/** 차지 바닥 파도 (slabs 사건, 판 줄이 시작하는 바닥 기준): J 남는 흔적의 둘째 몫 — 솟은 판은 잔해로 남는다 (render/chars/edward slabs) */
export const edwardSlabs = (len: number): GMove => ({
  grade: 'strong', grammar: [1, 2, 7], tech: { main: 'J', aux: [] }, light: { r: 50 + len / 3, t: 20 }, shapes: chargeSlabs(len),
});
/** 차지 바닥 파도 (slabs 사건, 12-2 '앞쪽 바닥이 일직선으로 솟구친다'): 판 줄(길이 len) 끝까지 짓누르는 충격파 + 솟는 빛 쐐기 + 덩어리 */
export function chargeSlabs(len: number): GShape[] {
  const k = len / 96;
  return [
    crush([len * 0.5, 0], [len * 0.25, len * 0.62], [26 * k, 10], 16 + 6 * k, { sides: 0, spread: 14, hold: 4, fade: 14 }),
    { kind: 'wedge', at: [len, 0], angle: -74, back: 6, fwd: 70 + 50 * k, w: 22 + 8 * k, peak: 0.22, bulge: [0.6, 1.2], skew: 0.2, delay: 4, hold: 2, fade: 12 },
    rocks([len * 0.4, -2], 6 + Math.round(4 * k), [5, 12], 3.6, -80, 70, 46, { spread: len * 0.4, every: 1 }),
    dust([len * 0.5, -2], 4, 5, 30),
  ];
}

// ───────────────────────── 스킬·필살기 (시안 3개씩) ─────────────────────────

/** 스킬 1 재현:나 (해머를 바닥에 세우는 reenact 사건, 발밑 기준) */
export interface EdwardSkill1 {
  /** 해머를 세운 자리 (발밑 기준) 모양 */
  plant: GMove;
}
/** 재현:나 공통: 해머를 세운 자리에서 솟는 푸른 장막 빛기둥, 해머가 바닥을 누르는 작은 충격파 */
const REENACT_BASE: GShape[] = [
  { kind: 'wedge', at: [14, 0], angle: -90, back: 4, fwd: 170, w: 28, peak: 0.18, bulge: [0.6, 1.25], tones: [6, 4, 5], main: 0.6, core: 0.24, hold: 4, fade: 14 },
  crush([14, 0], [6, 34], [12, 4], 12, { hold: 2, fade: 10 }),
  { kind: 'embers', at: [14, -10], n: 16, spread: 8, speed: 1.8, dir: -90, fan: 100, life: 40 },
];
/** 재현:나 N 맥동: 몸을 감싸는 장막 고리가 심장처럼 두 번 뛴다 (6틱 간격), 사라지기 직전 한 번 더 부푼다 */
const REENACT_PULSE: GShape[] = [
  { kind: 'ring', tone: 4, ripple: 0.4, at: [4, -30], r: 44, w: 6, thick: -70, rot: -4, gaps: [[60, 80]], hold: 4, fade: 10, pulse: true },
  { kind: 'ring', tone: 5, ripple: 0.4, at: [4, -30], r: 60, w: 5, thick: 110, rot: -4, gaps: [[-150, -130]], delay: 6, hold: 4, fade: 10, pulse: true },
];
const reenact = (tech: { main: string; aux: string[] }, extra: GShape[], fx?: GMove['fx']): EdwardSkill1 => ({
  plant: { grade: 'skill', grammar: [1, 2, 5, 7], tech, light: { r: 70, t: 24 }, fx, shapes: [...REENACT_BASE, ...REENACT_PULSE, ...extra] },
});

/** 스킬 2 염동력: 맞힌 틱 (맞은 점), 끌어당김 장막 손 (tkGrab, 상대 가슴), 밀어냄 장막 벽 (tkWall, 상대 발밑), 장막이 터짐 (tkBurst, 상대 가슴) */
export interface EdwardSkill2 {
  hit: GMove;
  grab: GMove;
  wall: GMove;
  burst: GMove;
}
/** 장막 손 (12-3 '상대보다 한 둘레 큰 손 모양 막'): 다섯 손가락 쐐기가 사방에서 상대 가슴으로 모여 움켜쥔다 (장막 색) */
const VEIL_HAND: GShape[] = [
  ...([[-150, 52, 15], [-108, 58, 17], [-62, 56, 16], [-14, 50, 14], [128, 46, 13]] as const).map(([a, r, w]) => ({
    kind: 'wedge', at: [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r], angle: a + 180, back: 4, fwd: r * 0.78, w, peak: 0.3, bulge: [0.6, 1.2],
    tones: [6, 4, 5], main: 0.6, core: 0.22, hold: 6, fade: 10,
  }) as GShape),
  { kind: 'ring', tone: 5, ripple: 0.4, r: 46, w: 5, thick: -120, rot: -4, gaps: [[40, 58], [170, 186]], hold: 4, fade: 10 },
];
const skill2 = (tech: { main: string; aux: string[] }, o: { grab?: GShape[]; wall?: GShape[]; burst?: GShape[]; fx?: GMove['fx']; flip?: boolean; grow?: number }): EdwardSkill2 => ({
  hit: { grade: 'skill', grammar: [5, 7], tech, hitY: -30, light: { r: 40, t: 20 }, shapes: [spark(180, 1.1, 2, 4, 4), embers(14, 180, 1.8, 30)] },
  grab: {
    grade: 'skill', grammar: [1, 2, 3, 5, 7], tech, light: { r: 70, t: 22 },
    fx: { ...(o.fx ?? {}), ...(o.flip ? { flip: { at: 1, ticks: 1 } } : {}) },
    shapes: [...VEIL_HAND.map((sh) => (o.grow && sh.kind === 'wedge' ? ({ ...sh, grow: o.grow } as GShape) : sh)), { kind: 'ink', at: [-40, -40], angle: 40, len: 84, w: 9, notch: [[0.34, 2], [0.62, 2]], hold: 3, fade: 10 }, ...(o.grab ?? [])],
  },
  wall: {
    grade: 'skill', grammar: [1, 2, 3, 7], tech, light: { r: 80, t: 22 },
    shapes: [
      // 높이 70px 장막 벽 (12-3): 바닥에서 솟는 두 장막 쐐기, 뒤에 짙은 장막
      { kind: 'wedge', at: [-10, 2], angle: -86, back: 6, fwd: 108, w: 30, peak: 0.3, bulge: [0.6, 1.1], skew: 0.3, tones: [6, 4, 5], main: 0.62, core: 0.22, hold: 8, fade: 12 },
      { kind: 'wedge', at: [-2, 2], angle: -96, back: 4, fwd: 84, w: 18, peak: 0.36, bulge: [0.6, 1.2], tones: [6, 4, 5], main: 0.6, core: 0.3, delay: 2, hold: 6, fade: 10 },
      { kind: 'ring', tone: 4, ripple: 0.35, at: [-4, 0], r: 56, w: 5, thick: 90, sy: 0.22, rot: -8, gaps: [[-140, -120]], hold: 4, fade: 12 },
      ...(o.wall ?? []),
    ],
  },
  burst: {
    grade: 'skill', grammar: [2, 5, 7], tech, light: { r: 80, t: 22 },
    shapes: [
      rocks([0, 0], 10, [5, 11], 3.4, -60, 160, 40, { tones: [6, 4, 5], gravity: 0.12 }),
      { kind: 'ring', tone: 5, ripple: 0.4, r: 64, w: 5, thick: 30, rot: -4, gaps: [[-60, -44], [120, 136]], hold: 2, fade: 10 },
      ...(o.burst ?? []),
    ],
  },
});

/** 필살기 껍데기 뒤집어쓰기 (12-6 연출 그대로): 잡는 순간 (연출 시작, 맞은 점) · 끝에 상대가 앞으로 무너지는 타격 (상대 발밑) */
export interface EdwardSuper {
  grab: GMove;
  end: GMove;
}
const SUPER_GRAB: GShape[] = [
  { kind: 'ring', tone: 4, ripple: 0.4, r: 96, w: 6, thick: -110, rot: -4, gaps: [[-30, -14], [70, 86], [160, 176]], hold: 3, fade: 12 },
  ...VEIL_HAND.map((s) => ({ ...s, hold: 8 }) as GShape),
  spark(-90, 1.5, 2, 5, 4),
];
const SUPER_END: GShape[] = [
  crush([0, 0], [16, 80], [30, 10], 24, { hold: 4, fade: 16, spread: 14 }),
  { kind: 'wedge', at: [0, 0], angle: -100, back: 6, fwd: 130, w: 30, peak: 0.2, bulge: [0.6, 1.2], hold: 2, fade: 12 },
  { kind: 'ink', at: [-36, -60], angle: 56, len: 100, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 11 },
  rocks([0, -2], 12, [5, 13], 4, -90, 120, 48),
  dust([0, -2], 5, 6, 36),
  { kind: 'embers', at: [0, -10], n: 24, spread: 10, speed: 2.6, dir: -90, fan: 150, life: 44 },
];
const superOf = (tech: { main: string; aux: string[] }, o: { grabFx?: GMove['fx']; endFx?: GMove['fx']; grab?: GShape[]; end?: GShape[] }): EdwardSuper => ({
  grab: {
    grade: 'super', grammar: [1, 2, 5, 8], tech, hitY: -36, light: { r: 90, t: 24 },
    screen: { silhouette: 3 },
    fx: { impact: { at: 0, ticks: 2, bg: '#fff3dc', ink: '#170b06' }, ...(o.grabFx ?? {}) },
    shapes: [...SUPER_GRAB, ...(o.grab ?? [])],
  },
  // 끝 타격은 맞은 점 기준 (맞은 점을 상대 발밑 8px 위로 두고, 모양의 바닥 0을 상대 발밑에)
  end: {
    grade: 'super', grammar: [1, 2, 3, 5, 7, 8], tech, hitY: -8, light: { r: 110, t: 26 },
    screen: { press: { mode: 'crack', ticks: 3, color: '#6e3a12', crack: '#170b06' } },
    fx: o.endFx,
    shapes: onHitFloor([...SUPER_END, ...(o.end ?? [])], 8),
  },
});

/** 시안 3개씩 (14-9 '4타·차지·스킬·필살기는 서로 다른 기법 조합의 시안 3개'): 주 기법은 그대로 두고 보조 기법 조합만 바꾼다. 1번이 게임에 들어간 채택안 */
export const EDWARD_GG_DRAFTS = {
  atk4: [ATK4_V1, ATK4_V2, ATK4_V3],
  charge: [CHARGE_V1, CHARGE_V2, CHARGE_V3],
  /** 스킬 1 재현:나 — N 맥동 */
  skill1: [
    // 시안 1: N / C 모양 변신 (빛기둥 → 고리 → 덩어리) · H 환경 반응 (빗줄기 멈춤)
    reenact({ main: 'N', aux: ['C', 'H'] }, [rocks([14, -4], 7, [4, 9], 2.8, -90, 90, 40, { wait: 8, tones: [6, 4, 5], gravity: 0.1 })], { rain: { ticks: 28 }, puddle: { at: [-16, 30], n: 7 } }),
    // 시안 2: N / L 색 뒤집기 (세우는 순간 1틱 장막 → 청동) · D 2.5D 깊이 (발밑 바닥에 누운 큰 장막 고리)
    reenact({ main: 'N', aux: ['L', 'D'] }, [{ kind: 'ring', tone: 4, ripple: 0.35, at: [8, 0], r: 84, w: 6, thick: 90, sy: 0.2, rot: -8, gaps: [[-120, -100]], hold: 4, fade: 14 }], { flip: { at: 1, ticks: 1 } }),
    // 시안 3: N / J 남는 흔적 (장막 조각이 1초 넘게 떠 있다) · K 카메라 (줌 펀치)
    reenact({ main: 'N', aux: ['J', 'K'] }, [rocks([4, -30], 8, [4, 8], 0.8, -90, 360, 80, { tones: [6, 4, 5], gravity: 0.004, spin: 0.06 })], { zoom: { at: 0, k: 1.05, ticks: 1 } }),
  ] as EdwardSkill1[],
  /** 스킬 2 염동력 — M 전조 (붙잡기 4틱 전, 상대 가슴으로 공기가 빨려 들고 뒷손에 장막 조각이 모인다: render/fightvfx) */
  skill2: [
    // 시안 1: M / I 시간 엇갈림 (히트스톱 동안 장막 손가락만 계속 조인다) · H 환경 반응 (빗줄기 멈춤·끌려가는 길의 물웅덩이)
    skill2({ main: 'M', aux: ['I', 'H'] }, { fx: { rain: { ticks: 26 }, puddle: { at: [-30, -60], n: 7 } }, grow: 2.4 }),
    // 시안 2: M / G 검은 틈 (장막 손 한가운데를 잉크가 가른다) · K 카메라 (끌어당기는 쪽으로만 흔들기)
    skill2({ main: 'M', aux: ['G', 'K'] }, { fx: { kick: { at: 0, dx: -7, dy: 0, ticks: 8, shake: true } }, grab: [{ kind: 'ink', at: [-6, -50], angle: 84, len: 100, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 4, fade: 10 }] }),
    // 시안 3: M / C 모양 변신 (장막 손 → 고리 → 장막 조각) · L 색 뒤집기 (움켜쥐는 순간 1틱 청동)
    skill2({ main: 'M', aux: ['C', 'L'] }, { flip: true, grab: [rocks([0, 0], 8, [4, 9], 2.4, -90, 360, 34, { wait: 6, tones: [6, 4, 5], gravity: 0.08 })] }),
  ] as EdwardSkill2[],
  /** 필살기 껍데기 뒤집어쓰기 — A 임팩트 프레임 (잡는 순간 두 색 2틱) */
  super: [
    // 시안 1: A / D 2.5D 깊이 (무너진 자리 바닥에 누운 큰 타원 고리, 덩어리가 카메라 쪽으로) · H 환경 반응 (빗줄기 멈춤)
    superOf({ main: 'A', aux: ['D', 'H'] }, {
      grabFx: { rain: { ticks: 30 } },
      endFx: { rain: { ticks: 30 }, puddle: { at: [-40, 30], n: 8 } },
      end: [
        { kind: 'ring', tone: 2, ripple: 0.35, at: [0, 0], r: 120, w: 6, thick: 90, sy: 0.2, rot: -8, gaps: [[-130, -110]], hold: 3, fade: 14 },
        rocks([0, -2], 8, [5, 11], 3.6, -80, 100, 44, { layer: 'front', zoom: 0.025 }),
      ],
    }),
    // 시안 2: A / N 맥동 (장막 고리가 한 번 더 부푼다) · J 남는 흔적 (무너진 자리에 장막 조각이 1초 넘게 떠 있다)
    superOf({ main: 'A', aux: ['N', 'J'] }, {
      grab: [{ kind: 'ring', tone: 5, ripple: 0.4, r: 70, w: 5, thick: 60, rot: -4, gaps: [[120, 140]], delay: 4, hold: 6, fade: 10, pulse: true }],
      end: [
        { kind: 'ring', tone: 4, ripple: 0.4, at: [0, -40], r: 88, w: 6, thick: -90, rot: -4, gaps: [[30, 46], [150, 166]], hold: 6, fade: 10, pulse: true },
        rocks([0, -30], 10, [4, 8], 0.9, -90, 360, 84, { tones: [6, 4, 5], gravity: 0.004, spin: 0.06 }),
      ],
    }),
    // 시안 3: A / G 검은 틈 (무너지는 충격파 한가운데를 잉크가 가른다) · K 카메라 (줌 펀치 + 아래로만 흔들기)
    superOf({ main: 'A', aux: ['G', 'K'] }, {
      endFx: { zoom: { at: 0, k: 1.08, ticks: 1 }, kick: { at: 0, dx: 0, dy: 7, ticks: 9, shake: true } },
      end: [{ kind: 'ink', at: [0, -4], angle: -92, len: 120, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 11 }],
    }),
  ] as EdwardSuper[],
};

/**
 * 내려찍기 착지 (slamLand 사건, 착지한 발밑 앞 20px 기준): 반원 충격파 (반지름 48px × 1.5)가 짓누르며 퍼지고, 바닥에 누운 큰 타원 고리 (D),
 * 덩어리가 카메라 쪽으로 커지며 날아오고, 빗줄기가 멈춘다 (H), 아래로만 흔들린다 (K), 배경 누르기
 */
export const EDWARD_GG_SLAM_LAND: GMove = {
  grade: 'strong',
  grammar: [1, 2, 3, 4, 5, 7, 8],
  tech: { main: 'D', aux: ['H', 'K'] },
  light: { r: 80, t: 22 },
  screen: { press: { mode: 'crack', ticks: 2, color: '#6e3a12', crack: '#170b06' } },
  fx: { rain: { ticks: 22 }, puddle: { at: [-40, 40], n: 8 }, kick: { at: 0, dx: 0, dy: 7, ticks: 9, shake: true } },
  shapes: [
    crush([0, 0], [20, 84], [52, 13], 34, { hold: 5, fade: 16, spread: 14 }),
    { kind: 'ring', tone: 2, ripple: 0.35, at: [0, 0], r: 108, w: 7, thick: 90, sy: 0.2, rot: -8, gaps: [[-130, -110]], hold: 3, fade: 14 },
    { kind: 'ring', tone: 4, ripple: 0.4, at: [0, 0], r: 70, w: 5, thick: 90, sy: 0.22, rot: 6, gaps: [[30, 50]], delay: 2, hold: 2, fade: 12 },
    { kind: 'wedge', at: [-4, 0], angle: -100, back: 6, fwd: 96, w: 22, peak: 0.2, bulge: [0.6, 1.2], skew: 0.2, delay: 1, hold: 2, fade: 11 },
    { kind: 'ink', at: [-40, -56], angle: 52, len: 92, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 11 },
    rocks([0, -2], 12, [5, 13], 4, -90, 130, 48, { layer: 'front', zoom: 0.025 }),
    dust([0, -2], 5, 6, 34),
    { kind: 'embers', at: [0, -8], n: 22, spread: 12, speed: 2.4, dir: -90, fan: 150, life: 40 },
  ],
};
