// 백은우 공격 이펙트 (숫자 데이터만, 동작연출지침서 14-8 '길티기어식 이펙트' 문법 + 14-4 백은우 색·고유 모양 + 14-9 연출 기법).
// 판정·동작 데이터(data/characters/eunwoo, data/moves/time)와 따로 둔다. 리본 띠는 그 기술의 연검 리본(판정 선)을 따라 휘고 (11-2 '궤적은 리본 자체를 따라'),
// 흰 심이 지나는 곳이 판정 선이다 (14-5). 판정 밖으로 뻗는 머리·꼬리는 바깥 두 단(은백·옅은 하늘)과 금 테, 흩어지는 가닥과 꽃잎으로만.
// 공격자 머리·몸통 위로는 큰 모양이 지나가지 않는다 (몸 둘레를 도는 리본은 몸 뒤 겹).
// 14-10 강화 점검표 (2026-11-05, 크기·구도는 그대로 두고 힘을 키운다):
//   ① 큰 리본·빛기둥·고리의 맨 바깥에 아주 어두운 남색 띠 (2~3px), 강타 이상은 배경을 65~70% 눌러 짙은 남색으로
//   ② 금색이 두 번째 주인공: 리본 한쪽 가장자리의 굵은 금 테 (거의 온 길이 3.5px), 섬광 몸 (남색 테 → 금 별 → 작은 흰 심), 금 불씨, 강타 맞은 점 금 고리
//   ③ 40px 넘는 가는 곡선 (얇은 물결 고리)은 가운데가 굵고 양 끝이 뾰족한 리본 호로 (taper), 한 화면에 큰 곡선은 리본 + 고리 정도
//   ④ 잉크 쐐기는 밑동 9~10px · 길이 46~70px로 짧게, 가장 밝은 리본 머리를 가로지르게
//   ⑤ 강타 이상 맞은 점: 반지름 84px 넘는 고리 (화면 높이 60% 넘게), 금빛 테두리 실루엣, 섬광 지름 36px 넘게
//   ⑥ 발도 3단계: 휘두른 꼬리는 짧게, 가장 굵은 자리와 터지는 빛기둥은 맞은 사람을 지나 앞쪽으로
//   ⑦ 큰 모양은 기술마다 2~3개 (방사 가시·작은 쐐기·겹치는 고리는 뺐다), 남긴 것은 15~20% 굵게
// 색 단계: 0 심 흰·크림 · 1 은백 · 2 옅은 하늘 · 3 잉크 남색 · 4 금 · 5 백합 꽃잎 연분홍 · 6 짙은 하늘 (render/chars/eunwoo-gg)
// 좌표: 오른쪽 보기 px, 공격자 발밑 (anchor 'self', 판정이 시작하는 틱 자리) 또는 맞은 점 (anchor 'hit') 기준, y 위가 −. 480×270 화면 (14-8 크기 × 1.5)
// 14-9 기법: tech에 주 기법 1개 + 보조 기법 (한 캐릭터 안에서 주 기법이 겹치지 않는다), fx에 화면·카메라·환경 기법.
import type { GMove, GRing, GShape } from './types';

/** ① 큰 리본·빛기둥 맨 바깥 남색 띠 (px, 480 화면: 320 기준 2.7px) · 작은 리본·고리는 3px (320 기준 2px) */
const RIM = 4;
const RIM_S = 3;
/** ② 리본 한쪽 가장자리의 굵은 금 테: [시작 u, 끝 u, 굵기 px, 쪽] (거의 온 길이) */
const gold = (side: 1 | -1, w = 3.5) => [0.05, 0.97, w, side] as const;
/**
 * ① 강타 이상: 배경을 65% 눌러 짙은 남색으로 (캐릭터·이펙트는 그대로) · 차지 3단계·필살기는 70%.
 * 밝은 모양이 다 펼쳐지는 틱까지 (히트스톱 안에서) 누른다: 밝은 이펙트는 어두운 바탕 위에서만 빛난다
 */
const pressS = (ticks: number) => ({ mode: 'tint', ticks, color: '#060a1c', scale: 0.35 }) as const;
const pressX = (ticks: number) => ({ mode: 'tint', ticks, color: '#060a1c', scale: 0.3 }) as const;
/** ② 맞은 점 반짝임 (백은우 섬광: 가로가 길고 세로가 짧은 별): 남색 테두리 → 금 별 → 작은 흰 심 */
const glint = (dir: number, size: number, hold = 1, fade = 5): GShape => ({
  kind: 'flash', anchor: 'hit', layer: 'front', hold, fade, rim: 3, inner: 4,
  spikes: [[dir, 14 * size, 2.6], [dir + 90, 7 * size, 1.9], [dir + 180, 9 * size, 2.1], [dir - 90, 8 * size, 1.9], [dir + 38, 5 * size, 1.4]],
});
/** ② 빛 가루 (14-8 ⑦ 잔불 점): 금이 셋에 둘, 흰·은백 1~2px, 떨어져 바닥에서 튄다 */
const dust = (n: number, dir: number, speed: number, life: number, fan = 120): GShape => ({ kind: 'embers', anchor: 'hit', layer: 'front', n, spread: 6, speed, dir, fan, life, tones: [4, 0, 4, 1, 4, 4] });
/** 물안개 (14-2 잔향: 은백 → 옅은 하늘 덩어리가 천천히 오른다) */
const mist = (n: number, size: number, life: number, at: readonly [number, number] = [2, -2]): GShape => ({ kind: 'smoke', anchor: 'hit', at, n, spread: 5, rise: 0.4, size, life, delay: 2, tones: [1, 2] });
/** 일반 타 맞은 점: 반짝임 + 빛 가루 + 물안개 */
const smallHit = (dir: number, size: number, life = 24): GShape[] => [glint(dir, size), dust(8 + Math.round(4 * size), dir - 20, 1.5 + 0.4 * size, life), mist(2, 2.5 + size, 18 + Math.round(4 * size))];
/**
 * ⑤ 강타 이상 맞은 점 고리: 반지름 r (84px 넘게 = 화면 높이 60% 넘게), 금 호 셋 (가운데가 굵고 양 끝이 뾰족한 리본 호, 가장 굵은 쪽 thick),
 * 남색 테·흰 심. 끊긴 곳은 가장 굵은 쪽에서 80° 안팎·180°
 */
const hitRing = (r: number, thick: number, o: Partial<GRing> = {}): GShape => ({
  kind: 'ring', anchor: 'hit', tone: 4, core: 0, rim: RIM_S, taper: true, r, w: 11, thick,
  gaps: [[thick + 78, thick + 104], [thick + 168, thick + 194], [thick - 104, thick - 78]], hold: 2, fade: 13, ...o,
});
/** ③ 바닥에 누운 물결 고리: 가는 고리 대신 끝이 뾰족한 옅은 하늘 호 (남색 테), 맨 위·맨 아래를 끊어 길게 눕는 수평 테두리가 없게 */
const floorRing = (at: readonly [number, number], r: number, o: Partial<GRing> = {}): GShape => ({
  kind: 'ring', tone: 2, ripple: 0.6, at, r, w: 8, thick: 90, sy: 0.2, rot: -7, cap: true, taper: true, rim: RIM_S, gaps: [[-130, -110]], hold: 2, fade: 14, ...o,
});

// ───────────────────────── 지상 1~4타: 한 문장 (14-9 F 보조) — 1타 꽃잎 하나, 2타 둘, 3타 반쯤 핀 원, 4타 다 핀 백합이 터진다 ─────────────────────────

const ATK4_RIBBON: GShape = {
  // 위에서 아래로 큰 세로 S: 머리 위 높은 곳에서 휘어 내려와 앞 바닥에 끝이 꽂힌다 (11-2 4타)
  kind: 'ribbon', pts: [[-4, -150], [22, -138], [46, -112], [46, -84], [34, -60], [41, -36], [50, -16], [60, 0]],
  w: 36, peak: 0.72, bulge: [1.2, 0.55], skew: 0.15, coreLen: 0.5, twist: [[0.3, 0.38], [0.55, 0.5]], thread: gold(-1, 4), rim: RIM, wave: [4, 60], hold: 2, fade: 14,
};
/**
 * 4타 지연 폭발 (14-9 B): 맞은 순간엔 반짝임만, 살아 있는 4틱 뒤 (히트스톱 중) 앞 바닥 꽂힌 자리에서 다 핀 백합이 터진다 (F 완성).
 * ⑦ 꽃잎 다섯 → 앞 위로 화면 밖까지 가는 큰 빛기둥 하나 + 위로 짧은 꽃잎 하나 (뒤로 가는 꽃잎·작은 꽃잎은 뺐다: ⑥)
 */
const ATK4_BLOOM: GShape[] = [
  { kind: 'wedge', at: [56, -2], angle: -58, back: 20, fwd: 300, w: 36, peak: 0.16, bulge: [0.7, 1.35], skew: 0.2, thread: gold(-1, 3.5), rim: RIM, wait: 4, hold: 2, fade: 14 },
  { kind: 'wedge', at: [56, -2], angle: -86, back: 6, fwd: 100, w: 26, peak: 0.3, bulge: [0.6, 1.1], rim: RIM, wait: 5, hold: 2, fade: 11 },
];
/** 4타 맞은 점 공통: ⑤ 큰 금 고리, ④ 리본 머리를 가로지르는 짧은 잉크 쐐기, 반짝임, 빛 가루, 물안개 (③⑦ 방사 가시는 뺐다) */
const ATK4_HIT: GShape[] = [
  hitRing(104, -30, { wait: 4 }),
  { kind: 'ink', at: [30, -100], angle: 32, len: 64, w: 10, notch: [[0.34, 2], [0.62, 3]], wait: 4, hold: 2, fade: 11 },
  glint(-70, 1.9, 1, 5),
  dust(26, -70, 2.6, 44, 140),
  mist(5, 6, 34, [4, -4]),
];
/** 4타 꽃잎이 카메라 쪽으로 커지며 날아온다 (14-9 D, 앞 겹) */
const ATK4_PETALS: GShape = { kind: 'flutter', layer: 'front', from: [[48, -6], [56, -10], [64, -6]], n: 9, fly: 0.3, size: 7, dir: -70, speed: 2.4, fan: 150, lift: 0.1, life: 40, every: 1, zoom: 0.035, wait: 5 };

/** 4타 시안 1 (채택): B 지연 폭발 / D 2.5D 깊이 (카메라 쪽으로 날아오는 꽃잎) · K 카메라 (줌 펀치 + 아래로만 흔들기) */
const ATK4_V1: GMove = {
  grade: 'strong',
  grammar: [1, 2, 3, 4, 5, 7, 8],
  tech: { main: 'B', aux: ['D', 'K'] },
  hitY: -26,
  light: { r: 64, t: 20 },
  screen: { press: pressS(8), silhouette: 3 },
  fx: { zoom: { at: 4, k: 1.07, ticks: 1 }, kick: { at: 4, dx: 0, dy: 6, ticks: 7, shake: true } },
  shapes: [ATK4_RIBBON, ...ATK4_BLOOM, ...ATK4_HIT, ATK4_PETALS],
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
    // G: 리본 한가운데를 가르는 검은 틈
    { kind: 'ink', at: [24, -128], angle: 62, len: 70, w: 10, notch: [[0.35, 2], [0.62, 2]], hold: 2, fade: 13 },
    ...ATK4_BLOOM.map((s) => (s.kind === 'wedge' && s.fwd > 200 ? { ...s, fwd: s.fwd + 180 } : s)),
    ...ATK4_HIT,
    { ...ATK4_PETALS, zoom: 0 } as GShape,
  ],
};

export const EUNWOO_GG: Partial<Record<string, GMove>> = {
  /** 1 기본 1타 손목 채찍 (일반): 손끝에서 앞으로 S자로 휘며 끝이 꺾이는 리본 띠 (꽃잎 하나), 금 테. L 색 뒤집기 (끝이 꺾이는 순간 1틱 금빛) / F */
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
        w: 22, peak: 0.55, bulge: [1.1, 0.7], skew: -0.1, coreLen: 0.62, twist: [[0.22, 0.42]], thread: gold(1), rim: RIM, wave: [2.5, 40], hold: 1, fade: 10,
      },
      { kind: 'flutter', from: [[16, -27], [24, -30]], n: 3, size: 5, dir: -150, speed: 1.2, fan: 70, life: 24, delay: 3 },
      ...smallHit(-6, 1.1, 24),
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
        w: 25, peak: 0.34, bulge: [1.1, 0.75], skew: 0.2, coreLen: 0.5, twist: [[0.5, 0.42], [0.78, 0.45]], thread: gold(-1), rim: RIM, wave: [2.5, 40], grow: 3, hold: 1, fade: 10,
      },
      // ④ 감아 오르는 리본 머리를 가로지르는 짧은 쐐기
      { kind: 'ink', at: [64, -82], angle: 72, len: 48, w: 9, notch: [[0.4, 2]], hold: 1, fade: 9 },
      { kind: 'flutter', from: [[10, -4], [20, -3], [30, -6]], n: 4, size: 5, dir: -160, speed: 1, fan: 60, life: 24, delay: 3 },
      ...smallHit(-30, 1.2, 26),
    ],
  },
  /**
   * 3 기본 3타 피루엣 (일반): 몸 둘레를 도는 리본 원 (앞쪽 반원이 밝다, 몸 뒤 겹) → 끝이 뾰족한 호 → 꽃잎으로 바뀐다 (반쯤 핀 꽃).
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
        w: 22, peak: 0.42, bulge: [1, 0.8], skew: 0.25, coreLen: 0.55, twist: [[0.72, 0.42]], thread: gold(1, 5), rim: RIM, wave: [2, 44], hold: 1, fade: 5,
      },
      // C 둘째 모양: 가는 고리 대신 끝이 뾰족한 은백 호 둘 (③, 가운데 금 심)
      { kind: 'ring', tone: 1, core: 4, rim: RIM_S, taper: true, at: [10, -40], r: 48, w: 12, thick: -20, sy: 0.92, gaps: [[100, 150], [200, 214]], delay: 1, hold: 1, fade: 8 },
      { kind: 'ink', at: [42, -90], angle: 70, len: 46, w: 9, notch: [[0.45, 2]], hold: 1, fade: 7 },
      { kind: 'flutter', from: [[34, -72], [52, -44], [50, -18], [30, -4]], n: 9, fly: 0.2, size: 6, dir: -20, speed: 1.4, fan: 120, life: 30, delay: 4 },
      ...smallHit(-20, 1.4, 24),
    ],
  },
  /** 4 기본 4타 뛰어 내리꽂기 (강): 시안 1 (채택) — 시안 2·3은 EUNWOO_GG_DRAFTS */
  atk4: ATK4_V1,
  /**
   * 5 띄우기 올려 베기 (강): 앞 바닥에서 화면 위 밖까지 감아 오르는 나선 리본, 맞은 점 큰 금 고리, 잉크 쐐기, 나비.
   * E 화면 밖으로 (위로 화면을 민다) / I 시간 엇갈림 (히트스톱 동안 계속 감아 오른다) · J 남는 흔적 (나선 자리에 꽃잎이 1초 넘게 떠 있다)
   */
  launcher: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7, 8],
    tech: { main: 'E', aux: ['I', 'J'] },
    hitY: -46,
    light: { r: 44, t: 20 },
    screen: { press: pressS(6), silhouette: 2 },
    fx: { kick: { at: 0, dx: 0, dy: -7, ticks: 8 } },
    shapes: [
      hitRing(92, 150),
      {
        kind: 'ribbon', pts: [[34, -2], [42, -22], [30, -42], [16, -60], [26, -84], [42, -110], [32, -142], [16, -176], [24, -216], [40, -262], [34, -310]],
        w: 44, peak: 0.3, bulge: [1, 0.5], skew: -0.15, coreLen: 0.36, twist: [[0.2, 0.4], [0.47, 0.42], [0.72, 0.45]], thread: gold(1, 4), rim: RIM, wave: [3, 64], grow: 2.5, hold: 2, fade: 13,
      },
      // ④ 나선 아랫마디를 가로지르는 짧은 쐐기
      { kind: 'ink', at: [4, -80], angle: -34, len: 62, w: 10, notch: [[0.32, 3], [0.62, 2]], hold: 2, fade: 10 },
      // J: 나선 자리에 꽃잎이 오래 떠 있다가 (살아 있는 70틱) 천천히 흩어진다
      { kind: 'flutter', from: [[40, -24], [18, -58], [40, -106], [18, -172]], n: 10, size: 6, dir: -90, speed: 0.25, fan: 360, lift: 0.04, life: 80, every: 2, delay: 6 },
      { kind: 'flutter', layer: 'front', from: [[30, -120], [26, -200]], n: 5, fly: 1, size: 9, dir: -95, speed: 1.6, fan: 60, lift: 0.2, life: 50, delay: 4 },
      glint(-84, 1.8, 1, 5),
      dust(18, -88, 2.4, 40, 110),
      mist(4, 5, 30, [0, -6]),
    ],
  },
  /**
   * 6 쓸기 다리 걸기 (일반): 바닥에 납작하게 누운 리본 스우시, 물웅덩이가 솟는 물보라.
   * H 환경 반응 (빗줄기가 히트스톱 동안 공중에 멈추고 물웅덩이가 솟는다) / D 바닥에 누운 물결 호
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
        w: 18, peak: 0.6, bulge: [1.2, 0.6], skew: 0.3, coreLen: 0.5, twist: [[0.32, 0.45]], thread: gold(1, 4.5), rim: RIM_S, wave: [1.5, 34], hold: 0, fade: 9,
      },
      { ...floorRing([0, 7], 72, { w: 7, hold: 1, fade: 11 }), anchor: 'hit' } as GShape,
      ...smallHit(-30, 1.3, 26),
    ],
  },
  /**
   * 7 대시 공격 실 타고 찌르기 (강): 먼저 그어진 금실을 따라 화면 밖까지 뻗는 긴 찌르기 (바깥 단이 금), 리본, 맞은 점 큰 금 고리, 잉크 쐐기.
   * M 전조 (판정 6틱 전부터 금실이 앞으로 그어지고 맞을 자리에 빛점) / E 화면 밖으로 (앞으로 화면을 민다) · L 색 뒤집기 (맞는 틱)
   */
  dashAttack: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7, 8],
    tech: { main: 'M', aux: ['E', 'L'] },
    hitY: -40,
    light: { r: 40, t: 20 },
    screen: { press: pressS(6), silhouette: 2 },
    fx: { kick: { at: 0, dx: 7, dy: 0, ticks: 7 }, flip: { at: 1, ticks: 1 } },
    pre: [
      // M: 금실이 손에서 앞으로 그어진다 (화면 밖까지). ③ 가는 선이 아니라 가운데가 굵은 금 띠 (남색 테)
      { kind: 'wedge', at: [20, -34], angle: -13, back: 0, fwd: 320, w: 9, peak: 0.18, bulge: [0.9, 1], main: 0, core: 0.34, coreLen: 0.9, edge: 4, rim: RIM_S, hold: 6, fade: 4 },
    ],
    shapes: [
      // 뿌리는 짧게 (굵어지는 기울기가 축 기울기와 맞아 아래 테두리가 수평으로 눕지 않게). ② 위쪽 가장자리 금 테 (실을 타고 간다)
      { kind: 'wedge', at: [38, -38], angle: -13, back: 8, fwd: 330, w: 24, peak: 0.05, bulge: [0.6, 1.1], skew: -0.1, coreLen: 0.28, thread: gold(1, 3), rim: RIM, hold: 2, fade: 12 },
      {
        kind: 'ribbon', pts: [[24, -30], [40, -44], [58, -34], [76, -48], [96, -38], [118, -50], [142, -42]],
        w: 18, peak: 0.4, bulge: [1, 0.7], skew: 0.1, coreLen: 0.45, twist: [[0.25, 0.4], [0.55, 0.42]], thread: gold(1, 3), rim: RIM_S, wave: [2, 30], hold: 2, fade: 11,
      },
      hitRing(88, 160, { w: 9 }),
      { kind: 'ink', anchor: 'hit', at: [-22, 18], angle: -58, len: 56, w: 9, notch: [[0.35, 2], [0.6, 2]], hold: 2, fade: 10 },
      glint(-10, 1.8, 1, 5),
      dust(16, -20, 2.2, 38, 140),
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
        w: 23, peak: 0.55, bulge: [1.1, 0.7], skew: 0.15, coreLen: 0.6, twist: [[0.25, 0.45]], thread: gold(1), rim: RIM, wave: [2, 36], hold: 1, fade: 8,
      },
      ...smallHit(14, 1.1, 22),
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
        w: 21, peak: 0.45, bulge: [1, 0.7], skew: -0.2, coreLen: 0.55, twist: [[0.6, 0.45]], thread: gold(-1), rim: RIM, wave: [2, 40], grow: 2.5, hold: 1, fade: 9,
      },
      ...smallHit(-60, 1.2, 24),
    ],
  },
  /**
   * 10 공중 3타 회전 베기 (강): 몸 둘레 온전한 리본 원 (공중 콤보 문장의 끝: 다 핀 원) → 맞은 점 큰 금 고리로 바뀌고 흰 나비로 흩어진다.
   * F / C 모양 변신 · N 맥동 (흩어지기 직전 한 번 더 부푼다)
   */
  air3: {
    grade: 'strong',
    grammar: [1, 2, 3, 5, 7, 8],
    tech: { main: 'F', aux: ['C', 'N'] },
    hitY: -30,
    light: { r: 36, t: 20 },
    screen: { press: pressS(6), silhouette: 2 },
    shapes: [
      {
        kind: 'ribbon', pts: [[-30, -40], [-22, -66], [6, -80], [36, -70], [52, -44], [48, -14], [26, 4], [-4, 6], [-26, -12]],
        w: 26, peak: 0.5, bulge: [1, 0.8], skew: 0.25, coreLen: 0.5, twist: [[0.18, 0.4], [0.82, 0.42]], thread: gold(1), rim: RIM, wave: [2.5, 50], pulse: true, hold: 2, fade: 8,
      },
      // C 둘째 모양: 맞은 점 큰 금 고리 (살아 있는 4틱 뒤)
      hitRing(86, -20, { delay: 4, hold: 1, fade: 11, pulse: true }),
      { kind: 'ink', anchor: 'hit', at: [-34, -30], angle: 34, len: 56, w: 9, notch: [[0.4, 2], [0.66, 2]], hold: 2, fade: 9 },
      { kind: 'flutter', layer: 'front', from: [[40, -64], [52, -36], [36, -4], [0, 4]], n: 8, fly: 0.75, size: 9, dir: -40, speed: 1.6, fan: 160, lift: 0.18, life: 46, every: 1, delay: 6 },
      glint(-30, 1.7, 1, 5),
      dust(16, -40, 2.2, 36, 140),
      mist(3, 4.5, 28),
    ],
  },
  /**
   * 11 내려찍기 와이어 끌어내리기 (강): 와이어가 감아 채는 순간 (와이어는 렌더가 따로: 곧은 은빛 띠), 끌려 내려가는 세로 리본 기둥,
   * 바닥에 부딪는 자리의 납작한 물결 호, 맞은 점 큰 금 고리. A 임팩트 프레임 (감아 채는 순간 두 색 2틱) / D 바닥에 누운 호 · H 물웅덩이가 솟는다
   */
  slam: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7, 8],
    tech: { main: 'A', aux: ['D', 'H'] },
    hitY: -20,
    light: { r: 50, t: 20 },
    screen: { press: pressS(7), silhouette: 3 },
    fx: { impact: { at: 1, ticks: 2, bg: '#fffbef', ink: '#101a3c' }, puddle: { at: [-6, 12, 30], n: 7 }, rain: { ticks: 14 } },
    shapes: [
      {
        kind: 'ribbon', pts: [[40, -96], [30, -74], [40, -52], [30, -30], [40, -10], [36, 2]],
        w: 30, peak: 0.62, bulge: [1.2, 0.5], skew: 0.2, coreLen: 0.45, twist: [[0.3, 0.42]], thread: gold(1, 5), rim: RIM, wave: [3, 50], hold: 2, fade: 12,
      },
      hitRing(86, 70, { delay: 1 }),
      // 바닥에 부딪는 자리 납작한 물결 호
      { ...floorRing([0, 20], 100, { w: 9, delay: 2, rot: -11 }), anchor: 'hit' } as GShape,
      { kind: 'ink', anchor: 'hit', at: [-30, -40], angle: 52, len: 58, w: 10, notch: [[0.32, 2], [0.6, 3]], hold: 2, fade: 10 },
      glint(90, 2, 1, 5),
      dust(24, -90, 2.4, 42, 150),
      mist(4, 5, 30),
    ],
  },
  /**
   * 12 벽 박차기 (강): 벽에서 맞는 점을 지나 화면 밖까지 대각선으로 내리긋는 리본 띠 (6연타 동안 굽이친다), 첫 타 맞은 점 큰 금 고리.
   * K 카메라 (대각선 축으로만 흔들기 + 첫 타 줌 펀치) / J 남는 흔적 (지나간 대각선에 꽃잎이 1초 넘게 남는다) · G 검은 틈 (리본 한가운데 잉크)
   */
  wallKick: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7, 8],
    tech: { main: 'K', aux: ['J', 'G'] },
    hitY: -26,
    light: { r: 36, t: 20 },
    screen: { press: pressS(6), silhouette: 2 },
    fx: { zoom: { at: 0, k: 1.05, ticks: 1 }, kick: { at: 0, dx: 5, dy: 5, ticks: 10, shake: true } },
    rehit: [glint(30, 1, 1, 3), dust(6, 20, 1.6, 22, 100)],
    shapes: [
      {
        // 몸 앞에서 시작해 (몸을 가로지르지 않게) 맞는 점을 지나 앞아래 화면 밖까지
        kind: 'ribbon', pts: [[20, -60], [38, -44], [56, -26], [76, -8], [100, 12], [128, 34], [158, 62], [190, 96]],
        w: 32, peak: 0.36, bulge: [1, 0.55], skew: 0.15, coreLen: 0.4, twist: [[0.18, 0.4], [0.52, 0.45]], thread: gold(1), rim: RIM, wave: [4, 70], hold: 14, fade: 12,
      },
      // G: 리본 머리 쪽을 가르는 짧은 검은 틈
      { kind: 'ink', at: [44, -56], angle: 40, len: 70, w: 10, notch: [[0.3, 2], [0.6, 2]], hold: 14, fade: 11 },
      hitRing(88, 40),
      { kind: 'flutter', from: [[30, -50], [60, -24], [96, 8], [130, 30]], n: 10, size: 6, dir: 40, speed: 0.3, fan: 360, lift: 0.03, life: 80, every: 2, delay: 10 },
      glint(30, 1.7, 1, 5),
      dust(16, 20, 2.2, 36, 140),
      mist(3, 4.5, 28),
    ],
  },
};

// ───────────────────────── 차지 스텔라리스 발도: 모은 단계마다 (1·2·3단계, 판정·동작은 그대로) ─────────────────────────

const chargeRibbon = (k: number): GShape => ({
  // 칼집에서 뽑아 위 앞에서 아래로 그어 내려와 바닥을 스치고 다시 앞 위로 솟는 초승달 (발도: 뽑아 그은 칼끝이 올라간다). 3단계는 화면 밖까지.
  // ⑥ 휘두른 꼬리는 짧게: 은우 머리 위가 아니라 상대 바로 위 앞에서 시작하고, 가장 굵은 자리 (peak)는 맞은 사람을 지난 앞쪽에 둔다.
  // (바닥 줄 위로 지나게: 흩어지는 조각이 바닥에 걸려 가는 줄로 잘리지 않게, 가장 낮은 곳에서 짧게 꺾어 올라간다)
  kind: 'ribbon',
  pts: [[60, -44 - 6 * k], [70, -30 - 2 * k], [80, -20], [92, -13], [108, -12], [128, -20], [154 + 30 * k, -38 - 8 * k], [190 + 50 * k, -62 - 18 * k], [214 + 70 * k, -80 - 26 * k]],
  w: 24 + 10 * k, peak: 0.6, bulge: [0.6, 0.6], skew: 0.2, coreLen: 0.5, twist: [[0.2, 0.42], [0.86, 0.45]], thread: gold(-1, 3 + 0.5 * k), rim: RIM, wave: [2.5, 50], hold: 2, fade: 10 + 2 * k,
});
/** 14-9 G 검은 틈: 리본 가장 굵은 자리를 가로지르는 짧은 잉크 (빛이 둘로 쪼개진다) */
const chargeGap = (k: number): GShape => ({ kind: 'ink', at: [98 + 10 * k, -40 - 10 * k], angle: 58, len: 44 + 8 * k, w: 8 + k, notch: [[0.36, 2], [0.64, 2]], hold: 2, fade: 9 + 2 * k });
const chargeHit = (k: number): GShape[] => [
  // ⑤ 큰 금 고리 (1단계도 반지름 84px = 화면 높이 60% 넘게): 가장 굵은 쪽이 앞 (은우 쪽으로 돌아 감기지 않게)
  hitRing(72 + 12 * k, 0, { w: 8 + k, fade: 11 + k }),
  glint(-40, 1.5 + 0.2 * k, 1, 4 + k),
  dust(10 + 6 * k, -30, 2 + 0.3 * k, 30 + 6 * k, 140),
  mist(2 + k, 4 + k, 26 + 4 * k),
];
/**
 * ⑥ 3단계: 가장 큰 덩어리가 맞은 사람을 지나 앞쪽으로 터진다 (맞은 점에서 앞으로 화면 밖까지 가는 큰 빛기둥, 위쪽 가장자리 금 테).
 * 앞끝까지 두툼하게 (흩어지는 조각이 길고 가는 선으로 남지 않게) 빨리 흩어진다
 */
const CHARGE_BURST: GShape = { kind: 'wedge', anchor: 'hit', at: [6, 2], angle: -13, back: 10, fwd: 300, w: 40, peak: 0.14, bulge: [0.6, 0.85], skew: 0.15, thread: gold(1, 4.5), rim: RIM, hold: 2, fade: 11 };
const chargeLv = (k: number, aux: string[], fx: GMove['fx'], extra: GShape[] = []): GMove => ({
  grade: 'strong',
  grammar: k >= 3 ? [1, 2, 3, 4, 5, 7, 8] : [1, 2, 3, 5, 7, 8],
  tech: { main: 'G', aux },
  hitY: -26,
  light: { r: 30 + 12 * k, t: 20 },
  screen: k >= 3 ? { press: pressX(8), silhouette: 3 } : { press: pressS(6), silhouette: 2 },
  fx: k >= 3 ? fx : undefined,
  shapes: [chargeRibbon(k), ...(k >= 3 ? [CHARGE_BURST] : []), chargeGap(k), ...extra, ...chargeHit(k)],
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
 * 나타난 자리는 'hit' 기준 (나타난 몸 가운데). 시안 1 (채택): J 남는 흔적 / C 모양 변신 (반짝임 → 호 → 꽃잎) · M 전조 (손끝으로 빨려 드는 선)
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

/** ② 나타나는 자리 반짝임: 남색 테 → 금 별 → 흰 심 */
const ARRIVE_GLINT: GShape = { kind: 'flash', anchor: 'hit', layer: 'front', rim: 3, inner: 4, spikes: [[0, 18, 2.8], [90, 11, 2.1], [180, 18, 2.8], [-90, 13, 2.1], [45, 7, 1.5], [-135, 7, 1.5]], hold: 1, fade: 5 };
const STITCH = { len: 7, w: 3, gap: 7, slant: 52, sew: 4, life: 66 };
export const EUNWOO_GG_SKILL1: readonly GSkill[] = [
  {
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'J', aux: ['C', 'M'] }, stitch: STITCH, prelude: true, light: { r: 46, t: 20 },
    shapes: [
      ARRIVE_GLINT,
      // C: 반짝임 → 끝이 뾰족한 은백 호 (③ 가는 고리 대신)
      { kind: 'ring', tone: 1, rim: RIM_S, taper: true, anchor: 'hit', r: 42, w: 9, thick: 60, gaps: [[150, 170], [-30, -14]], delay: 2, hold: 1, fade: 8 },
      { kind: 'flutter', anchor: 'hit', from: [[-30, -6], [0, -32], [30, -6], [0, 26]], n: 8, size: 6, dir: -90, speed: 1.2, fan: 360, lift: 0.1, life: 34, delay: 4 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 12, spread: 8, speed: 1.6, dir: -90, fan: 200, life: 30, tones: [4, 0, 4, 1, 4] },
    ],
    from: [{ kind: 'flutter', from: [[0, -40], [0, -10]], n: 5, size: 6, dir: -90, speed: 0.8, fan: 160, lift: 0.12, life: 30 }],
  },
  {
    // 시안 2: J / D 2.5D 깊이 (나타난 자리 바닥에 누운 호, 카메라 쪽으로 꽃잎) · L 색 뒤집기 (나타나는 틱)
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'J', aux: ['D', 'L'] }, stitch: STITCH, light: { r: 46, t: 20 },
    fx: { flip: { at: 0, ticks: 1 } },
    shapes: [
      ARRIVE_GLINT,
      { ...floorRing([0, 28], 58, { w: 7, gaps: [[-100, -84]], hold: 2, fade: 10 }), anchor: 'hit' } as GShape,
      { kind: 'flutter', anchor: 'hit', layer: 'front', from: [[0, -6], [0, 6]], n: 7, size: 6, dir: -60, speed: 1.6, fan: 200, lift: 0.08, life: 30, zoom: 0.04, delay: 1 },
    ],
  },
  {
    // 시안 3: J / N 맥동 (풀리기 직전 바늘땀이 한 번 더 굵어진다) · E 화면 밖으로 (간 방향으로 화면을 민다)
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'J', aux: ['N', 'E'] }, stitch: { ...STITCH, w: 3.5 }, light: { r: 46, t: 20 },
    fx: { kick: { at: 0, dx: 6, dy: 0, ticks: 6 } },
    shapes: [
      ARRIVE_GLINT,
      { kind: 'wedge', anchor: 'hit', at: [-6, 0], angle: 0, back: 40, fwd: 260, w: 14, peak: 0.12, bulge: [0.6, 1.5], coreLen: 0.3, rim: RIM_S, pulse: true, hold: 1, fade: 9 },
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 12, spread: 8, speed: 2, dir: 0, fan: 120, life: 28, tones: [4, 0, 4, 1, 4] },
    ],
  },
];

/**
 * 스킬 2 아직 여기 있어 (기술): 몸 둘레로 퍼지는 백합 꽃잎 호와 큰 흰 나비 떼, 심장이 뛰듯 두 번 맥동한다 (몸 가운데 'hit' 기준).
 * 시안 1 (채택): N 맥동 / C 모양 변신 (호가 나비로) · H 환경 반응 (빗줄기가 잠깐 멈춘다, 발밑 물결)
 * ③ 얇은 물결 고리 대신 끝이 뾰족한 굵은 호 (남색 테), 첫 고리는 금 (②)
 */
const HEART_RING = (r: number, wait: number, tone: 0 | 1 | 2 | 4 | 5 = 1, hold = 2): GShape => ({ kind: 'ring', anchor: 'hit', taper: true, rim: RIM_S, ...(tone === 4 ? { core: 0 } : {}), r, w: 9, thick: -90, gaps: [[60, 76], [200, 214]], tone, wait, hold, fade: 9, pulse: true });
const BUTTERFLIES = (n: number, zoom = 0): GShape => ({ kind: 'flutter', anchor: 'hit', layer: 'front', from: [[-26, -10], [0, -34], [26, -10], [0, 18]], n, fly: 1, size: 11, dir: -90, speed: 1.6, fan: 300, lift: 0.22, life: 60, every: 1, zoom, wait: 6 });
export const EUNWOO_GG_SKILL2: readonly GSkill[] = [
  {
    grade: 'skill', grammar: [1, 2, 3, 5, 7], tech: { main: 'N', aux: ['C', 'H'] }, light: { r: 60, t: 25 },
    fx: { rain: { ticks: 20 }, puddle: { at: [-14, 14], n: 5 } },
    shapes: [
      HEART_RING(48, 0, 4, 4),
      HEART_RING(64, 5, 5),
      // 머리 위에서 솟는 빛 쐐기 (몸을 가리지 않게 머리 위에서 시작), 한쪽 금 테
      { kind: 'wedge', anchor: 'hit', at: [0, -36], angle: -90, back: 0, fwd: 120, w: 22, peak: 0.2, bulge: [0.7, 1.1], coreLen: 0.4, thread: gold(1, 4), rim: RIM, pulse: true, hold: 3, fade: 10 },
      { kind: 'ink', anchor: 'hit', at: [-12, -64], angle: 30, len: 48, w: 9, notch: [[0.4, 2]], hold: 3, fade: 9 },
      BUTTERFLIES(9),
      { kind: 'embers', anchor: 'hit', layer: 'front', n: 16, spread: 14, speed: 1.2, dir: -90, fan: 160, life: 40, tones: [4, 0, 4, 1, 4] },
    ],
  },
  {
    // 시안 2: N / J 남는 흔적 (꽃잎이 몸 둘레에 1초 넘게 떠 있다) · I 시간 엇갈림 (나비가 날개를 멈춘 채 떠 있다가 날아간다)
    grade: 'skill', grammar: [1, 2, 5, 7], tech: { main: 'N', aux: ['J', 'I'] }, light: { r: 60, t: 25 },
    shapes: [
      HEART_RING(48, 0, 4),
      HEART_RING(64, 5, 5),
      { kind: 'flutter', anchor: 'hit', from: [[-34, -20], [0, -46], [34, -20], [0, 22]], n: 14, size: 7, tone: 5, dir: -90, speed: 0.2, fan: 360, lift: 0.03, life: 90, every: 1, wait: 4 },
      { ...BUTTERFLIES(7), wait: 14 } as GShape,
    ],
  },
  {
    // 시안 3: N / A 임팩트 프레임 (두 번째 맥동에 흰 화면 1틱) · D 2.5D 깊이 (발밑 물결 호가 바닥에 누워 퍼진다, 나비가 카메라 쪽으로)
    grade: 'skill', grammar: [1, 2, 5, 7, 8], tech: { main: 'N', aux: ['A', 'D'] }, light: { r: 60, t: 25 },
    fx: { impact: { at: 5, ticks: 1, bg: '#fffbef', ink: '#101a3c' } },
    shapes: [
      HEART_RING(48, 0, 4),
      { ...floorRing([0, 30], 72, { w: 7, gaps: [[-120, -100]], wait: 5, hold: 2, fade: 12, pulse: true }), anchor: 'hit' } as GShape,
      BUTTERFLIES(8, 0.03),
    ],
  },
];

/**
 * 필살기 선의 (11-5 콘티 그대로, 14-8 문법). 맞힌 틱의 물결과, 연출 장면마다의 신호 (render가 장면 틱에 맞춰 띄운다).
 * 주 기법 D 2.5D 깊이: 물결 호가 수면에 누운 큰 타원으로 퍼진다. 시안 1 (채택): D / A 임팩트 프레임 (해제: 세계가 깨지는 순간 두 색) · H 환경 반응 (빗줄기가 멈춘다)
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
  screen: { press: { ...pressX(8), color: '#0a1638' }, silhouette: 3 },
  shapes: [
    floorRing([0, -1], 120, { w: 9, sy: 0.18, gaps: [[-140, -120]], hold: 3, fade: 16 }),
    { kind: 'ribbon', pts: [[-40, -2], [-10, -10], [24, -4], [56, -14], [88, -6], [126, -16]], w: 20, peak: 0.5, bulge: [1, 0.7], coreLen: 0.5, thread: gold(1, 3), rim: RIM, wave: [2, 40], hold: 3, fade: 12 },
    hitRing(96, -30, { anchor: 'hit', hold: 3, fade: 14 }),
    { kind: 'ink', anchor: 'hit', at: [-40, -56], angle: 38, len: 66, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 3, fade: 11 },
    glint(-60, 2, 2, 6),
    dust(22, -80, 1.8, 50, 160),
  ],
};
/** 연출 끝 한 번에 들어가는 피해 (sim 'hit'): 세계가 돌아온 뒤 상대 둘레에 금빛 반짝임과 꽃잎만 (은우는 사람을 죽이지 않는다, 폭발 없음) */
export const EUNWOO_GG_SUPER_END: GMove = {
  grade: 'super',
  grammar: [5, 7],
  hitY: -26,
  light: { r: 50, t: 25 },
  shapes: [
    glint(-90, 1.4, 2, 6),
    { kind: 'flutter', anchor: 'hit', from: [[-14, -10], [0, -24], [14, -10]], n: 7, size: 6, tone: 5, dir: -90, speed: 0.6, fan: 220, lift: 0.08, life: 50, every: 2 },
    mist(3, 5, 34, [0, 6]),
  ],
};
const RELEASE_FLY = (zoom: number): GShape => ({ kind: 'flutter', layer: 'front', from: [[-150, -120], [-60, -60], [0, -40], [60, -60], [150, -120], [0, -150]], n: 26, fly: 0.8, size: 12, dir: -90, speed: 2.2, fan: 300, lift: 0.3, life: 60, every: 1, zoom });
/** ② 해제 순간 금: 금빛 나비 몇 마리와 금 불씨가 흰 나비 떼에 섞인다 */
const RELEASE_GOLD: GShape[] = [
  { kind: 'flutter', layer: 'front', from: [[-90, -90], [-20, -50], [40, -80], [110, -110]], n: 9, fly: 0.8, size: 12, tone: 4, dir: -90, speed: 2, fan: 280, lift: 0.3, life: 56, every: 1 },
  { kind: 'embers', layer: 'front', at: [0, -30], n: 30, spread: 30, speed: 2.6, dir: -90, fan: 300, life: 46, tones: [4, 0, 4, 4, 1] },
];
/** 전개 물결 (은우 발밑): 수면에 누운 끝이 뾰족한 큰 호 (③) */
const SUPER_RIPPLE = (pulse = false): GShape => floorRing([0, -1], 150, { w: 9, sy: 0.16, gaps: [[-140, -120], [40, 56]], hold: 2, fade: 22, pulse });
const TOUCH: GShape = { kind: 'flash', layer: 'front', rim: 3, inner: 4, spikes: [[0, 14, 2.6], [90, 8, 2], [180, 10, 2.2], [-90, 9, 2]], hold: 6, fade: 6 };
export const EUNWOO_GG_SUPER: readonly GSuper[] = [
  {
    grammar: [1, 2, 3, 5, 7, 8], tech: { main: 'D', aux: ['A', 'H'] },
    hit: { ...SUPER_HIT, tech: { main: 'D', aux: ['A', 'H'] }, fx: { rain: { ticks: 40 } } },
    release: {
      fx: { impact: { at: 0, ticks: 2, bg: '#fffbef', ink: '#101a3c' }, rain: { ticks: 30 } },
      press: { mode: 'crack', ticks: 6, color: '#86bde8', crack: '#101a3c' },
      shapes: [
        floorRing([0, -1], 160, { w: 10, sy: 0.16, gaps: [[-150, -130], [10, 24]], hold: 3, fade: 18 }),
        { kind: 'ink', at: [-96, -150], angle: 40, len: 80, w: 11, notch: [[0.3, 3], [0.6, 3]], hold: 3, fade: 12 },
        { kind: 'ink', at: [130, -140], angle: 128, len: 70, w: 10, notch: [[0.4, 2], [0.7, 2]], hold: 3, fade: 12 },
        RELEASE_FLY(0.025),
        ...RELEASE_GOLD,
      ],
    },
    ripple: [SUPER_RIPPLE()],
    touch: [TOUCH],
  },
  {
    // 시안 2: D / J 남는 흔적 (해제 뒤 백합 꽃잎이 화면에 2초 가까이 떠 있다) · N 맥동 (깨지기 직전 세계가 한 번 부푼다: 호 맥동)
    grammar: [1, 2, 3, 5, 7], tech: { main: 'D', aux: ['J', 'N'] },
    hit: { ...SUPER_HIT, tech: { main: 'D', aux: ['J', 'N'] } },
    release: {
      shapes: [
        floorRing([0, -1], 160, { w: 10, sy: 0.16, gaps: [[-150, -130], [10, 24]], pulse: true, hold: 3, fade: 18 }),
        { kind: 'flutter', from: [[-170, -100], [-80, -150], [0, -60], [80, -150], [170, -100]], n: 24, size: 8, tone: 5, dir: -90, speed: 0.3, fan: 360, lift: 0.05, life: 110, every: 1 },
        RELEASE_FLY(0),
        ...RELEASE_GOLD,
      ],
    },
    ripple: [SUPER_RIPPLE(true)],
    touch: [TOUCH],
  },
  {
    // 시안 3: D / C 모양 변신 (호 → 리본 → 나비) · K 카메라 (해제 순간 줌 펀치 + 위로 흔들기)
    grammar: [1, 2, 3, 5, 7], tech: { main: 'D', aux: ['C', 'K'] },
    hit: { ...SUPER_HIT, tech: { main: 'D', aux: ['C', 'K'] } },
    release: {
      fx: { zoom: { at: 0, k: 1.08, ticks: 1 }, kick: { at: 0, dx: 0, dy: -6, ticks: 9, shake: true } },
      shapes: [
        floorRing([0, -1], 140, { w: 9, sy: 0.16, gaps: [[-150, -130]], hold: 1, fade: 6 }),
        { kind: 'ribbon', pts: [[-180, -20], [-120, -70], [-40, -40], [20, -110], [90, -70], [170, -140], [230, -100]], w: 30, peak: 0.5, coreLen: 0.5, thread: gold(1, 4), rim: RIM, wave: [4, 80], delay: 2, hold: 2, fade: 10 },
        { ...RELEASE_FLY(0.02), delay: 5 } as GShape,
        ...RELEASE_GOLD,
      ],
    },
    ripple: [SUPER_RIPPLE()],
    touch: [TOUCH],
  },
];

/** 시안 (14-9 '4타·차지·스킬·필살기는 서로 다른 기법 조합의 시안 3개'): 1번이 게임에 들어간 채택안 */
export const EUNWOO_GG_DRAFTS = {
  atk4: [ATK4_V1, ATK4_V2, ATK4_V3] as readonly GMove[],
  charge: [
    EUNWOO_GG_CHARGE,
    // 시안 2: G / L 색 뒤집기 · N 맥동
    [1, 2, 3].map((k) => chargeLv(k, ['L', 'N'], { flip: { at: 1, ticks: 1 } }, k >= 3 ? [{ ...chargeRibbon(k), w: 14 + 6 * k, pulse: true, wave: [1, 40] } as GShape] : [])),
    // 시안 3: G / E 화면 밖으로 · J 남는 흔적
    [1, 2, 3].map((k) => chargeLv(k, ['E', 'J'], { kick: { at: 1, dx: 8, dy: 2, ticks: 9 } }, k >= 3 ? [
      { kind: 'flutter', from: [[60, -60], [90, -20], [140, 10]], n: 12, size: 6, dir: 10, speed: 0.25, fan: 360, lift: 0.03, life: 90, every: 2, delay: 8 },
    ] : [])),
  ] as readonly (readonly GMove[])[],
  skill1: EUNWOO_GG_SKILL1,
  skill2: EUNWOO_GG_SKILL2,
  super: EUNWOO_GG_SUPER,
};
