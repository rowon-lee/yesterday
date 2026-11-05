// 에드워드 공격 이펙트 (숫자 데이터만, 동작연출지침서 14-8 '길티기어식 이펙트' 문법 + 14-4 에드워드 색·고유 모양 + 14-9 연출 기법).
// 판정·동작 데이터(data/characters/edward, data/moves/time)와 따로 둔다. 원호 띠는 해머 머리가 지나는 원호(data/poses/edward EDWARD_ARCS)를
// 따라 휘고, 가장 굵고 밝은 머리 쪽(흰 심)이 판정 상자를 지난다 (14-5). 머리는 뭉툭하고 꼬리는 가늘다 (해머 머리가 가장 늦게 따라온다, 12-0).
// 12장 '느리게 들어 올려 한 번에 무너뜨린다' — 무게 (2026-11-05 사용자 피드백): 빠른 베기가 아니라 짓누르는 무게.
//   위로 뻗는 빛기둥은 줄이고 (차지만 예외), 맞을 때마다 바닥이 반응한다: 바닥을 따라 낮고 넓게 밀려가는 물마루 (surge), 바닥에서 차례로 들려 올라오는
//   돌덩이 (lift), 아래로 2~4px 눌리는 화면 (sink), 바닥을 따라 굴러가며 1.5~2초 남는 흙먼지. 흩어짐·잔향은 다른 캐릭터보다 길다
//   (모양 흩어짐 16~24틱 · 불씨 50~64틱 · 먼지 70~120틱 · 빛 24~34틱. 라이덴은 10~13 · 34~50 · 20~40 · 15~25).
//   파란 장막 고리는 가장 큰 두 기술 (차지 3단계·필살기 잡는 순간)에만 둔다. 다른 기술의 푸른 잔상은 해머 머리 뒤 짧은 띠로만.
// 색 단계: 0 심 따뜻한 흰 · 1 주색 밝은 청동 · 2 진한 주색 짙은 청동 · 3 잉크 아주 어두운 밤색 · 4 푸른 잔상 (껍데기 장막)
// · 5 밝은 장막 · 6 짙은 장막 · 7 흙먼지 따뜻한 회색 (render/chars/edward-gg)
// 좌표: 오른쪽 보기 px, 공격자 발밑 (anchor 'self', 판정이 시작하는 틱 자리) 또는 맞은 점 (anchor 'hit') 기준, y 위가 −. 480×270 화면 (14-8 크기 × 1.5)
// 14-9 기법: tech에 주 기법 1개 + 보조 기법 (한 캐릭터 안에서 주 기법이 겹치지 않는다), fx에 화면·카메라·환경 기법.
// 4타·차지·스킬·필살기는 사용자가 고른 시안 (2026-11-05: 4타 시안 3, 차지 시안 1, 재현 시안 2, 염동력 시안 2, 필살기 시안 3)만 둔다.
import type { GChunks, GMove, GQuake, GShape, GSmoke, GSurge, GSwoosh, GTone } from './types';

/** 해머 원호 띠 (14-4 '가장 굵은 원호'): 원 가운데·가로·세로 반지름 (EDWARD_ARCS) → 스우시. 머리 쪽이 굵고 뭉툭하다 */
const arc = (c: readonly [number, number], rx: number, ry: number, a0: number, a1: number, w: number, o: Partial<GSwoosh> = {}): GSwoosh => ({
  kind: 'swoosh', c, r: rx, sy: ry / rx, a0, a1, w, peak: 0.76, bulge: [0.95, 0.42], skew: 0.25, coreLen: 0.6, hold: 1, fade: 16, ...o,
});
/**
 * 푸른 잔상 띠 (12-1 '청동빛 원호 + 푸른 잔상(껍데기 색)'): 원호보다 조금 뒤·바깥에서 따라오는 장막 색 띠.
 * part: 머리 쪽에서 남기는 비 (기본 0.42: 해머 머리 바로 뒤 짧은 띠. 온 원호를 덮는 푸른 원호는 차지 3단계만)
 */
const ghost = (c: readonly [number, number], rx: number, ry: number, a0: number, a1: number, w: number, o: Partial<GSwoosh> & { part?: number } = {}): GSwoosh => {
  const { part = 0.42, ...rest } = o;
  return {
    kind: 'swoosh', c, r: rx, sy: ry / rx, a0: a1 - (a1 - a0) * part, a1, w, peak: 0.62, bulge: [1, 0.6], skew: 0.4, tones: [6, 4, 5], main: 0.5, core: 0.18, coreLen: 0.4, hold: 0, fade: 12, ...rest,
  };
};
/** 맞은 점 섬광 (14-8 ⑤): 다섯 갈래, 공격 방향으로 길다 */
const spark = (dir: number, size: number, hold = 1, fade = 5, rim: GTone = 2): GShape => ({
  kind: 'flash', anchor: 'hit', layer: 'front', hold, fade, rim,
  spikes: [[dir, 15 * size, 2.8], [dir + 72, 8 * size, 2], [dir + 150, 10 * size, 2.2], [dir - 150, 7 * size, 1.8], [dir - 72, 9 * size, 2]],
});
/** 불씨 (14-8 ⑦): 청동·흰 1~2px, 떨어져 바닥에서 튄다 */
const embers = (n: number, dir: number, speed: number, life: number, fan = 120): GShape => ({ kind: 'embers', anchor: 'hit', layer: 'front', n, spread: 6, speed, dir, fan, life });
/** 맞은 점 열기 (14-2 잔향): 짙은 청동 → 잉크 덩어리가 천천히 오른다 */
const puff = (at: readonly [number, number], n: number, size: number, life: number, anchor: 'self' | 'hit' = 'hit'): GShape => ({ kind: 'smoke', anchor, at, n, spread: 8, rise: 0.35, size, life, delay: 2 });
/** 길게 남는 흙먼지 (무게의 잔향): 바닥을 따라 양옆으로 굴러가며 1.5~2초 머문다 (짙은 청동 → 따뜻한 회색) */
const dust = (at: readonly [number, number], n: number, size: number, life: number, roll = 2.2, o: Partial<GSmoke> = {}): GSmoke => ({
  kind: 'smoke', at, n, spread: 12, rise: 0.05, size, life, roll, tones: [2, 7], delay: 1, ...o,
});
/** 날아가는 덩어리 파편 (14-4) */
const rocks = (at: readonly [number, number], n: number, size: readonly [number, number], speed: number, dir: number, fan: number, life: number, o: Partial<GChunks> = {}): GChunks => ({
  kind: 'chunks', at, n, spread: 6, size, speed, dir, fan, life, ...o,
});
/** 바닥에서 들려 올라오는 돌덩이 (무게): 물마루가 지나가는 차례로 바닥 줄 (at ± spread)에서 솟았다가 무겁게 떨어져 눕는다 */
const heave = (at: readonly [number, number], n: number, spread: number, size: readonly [number, number], o: Partial<GChunks> = {}): GChunks => ({
  kind: 'chunks', at, n, spread, size, speed: 3, dir: -90, fan: 30, life: 64, gravity: 0.14, lift: 5, ...o,
});
/** 바닥을 따라 낮고 넓게 밀려가는 물마루 (무게): 바닥 점에서 양옆 (또는 한쪽)으로, 앞끝 거리 r · 높이 h · 길이 len (처음 → 끝) */
const surge = (at: readonly [number, number], r: readonly [number, number], h: readonly [number, number], len: readonly [number, number], o: Partial<GSurge> = {}): GSurge => ({
  kind: 'surge', at, r, h, len, dip: 4, spread: 26, hold: 3, fade: 20, ...o,
});
/** 짓누르는 충격파 (14-4): 바닥 점에서 퍼지며 납작해지는 낮은 반원 띠 (해머가 바닥을 누른 자리) */
const crush = (at: readonly [number, number], r: readonly [number, number], h: readonly [number, number], w: number, o: Partial<GQuake> = {}): GQuake => ({
  kind: 'quake', at, r, h, spread: 10, w, hold: 2, fade: 16, ...o,
});
/** 맞은 점 기준으로 옮긴다: 맞은 점이 바닥 위 dy px일 때 (모양의 y 0이 바닥에 놓이게) */
const onHitFloor = (list: readonly GShape[], dy: number): GShape[] => list.map((sh) => {
  const at = 'at' in sh && sh.at ? sh.at : [0, 0];
  return { ...sh, anchor: 'hit', at: [at[0], at[1] + dy] } as GShape;
});
/** 일반 타 맞은 점: 섬광 + 불씨 + 열기 */
const smallHit = (dir: number, size: number, life = 34): GShape[] => [spark(dir, size), embers(9 + Math.round(4 * size), dir - 20, 1.6 + 0.4 * size, life), puff([2, -2], 2, 2.5 + size, 26)];
/** 아래로 눌리는 화면 (무게): 일반 2px 1틱 · 강 3px 2틱 · 필살기·차지 4px 2틱 */
const SINK_N = { px: 2, ticks: 1 } as const;
const SINK_S = { px: 3, ticks: 2 } as const;
const SINK_X = { px: 4, ticks: 2 } as const;
/** 배경 한 색 + 맞은 점에서 퍼져 나간 금 (14-8 ⑧, 무게: 가까울수록 조각이 잘고 멀수록 크다) */
const CRACK = (ticks: number) => ({ mode: 'crack', ticks, color: '#6e3a12', crack: '#170b06', radial: true }) as const;

// ───────────────────────── 1~4타 한 문장 (14-9 F 보조): 1타 원호 하나 → 2타 원호 + 바닥이 밀림 → 3타 원호가 박혀 바닥이 터짐 → 4타 가장 굵은 원호 + 화면 밖까지 밀려가는 물마루 ─────────────────────────

/** 4타 풀스윙 원호 (ARC4 가운데 0,−32 · 55×22): 몸 뒤에서 발 앞을 지나 앞으로, 가장 굵게. 납작한 원을 6° 기울인다 (밑이 수평으로 길게 눕지 않게) */
const ATK4_ARC: GShape[] = [
  ghost([0, -32], 62, 28, 190, -30, 30, { rot: -6, part: 0.4 }),
  arc([0, -32], 58, 25, 205, -22, 54, { rot: -6, peak: 0.8, coreLen: 0.55, ruffle: 0.06, hold: 2, fade: 20 }),
];

export const EDWARD_GG: Partial<Record<string, GMove>> = {
  /**
   * 1 기본 1타 가로 휘두르기 (일반): 어깨에서 넘어와 가슴 앞을 가로지르는 굵은 청동 원호 하나 (ARC1 지름 72px), 해머 머리 뒤 짧은 푸른 잔상.
   * 머리가 바닥을 스치는 틱에 발 앞 바닥이 짧게 밀리고 덩어리가 솟는다. L 색 뒤집기 (맞는 순간 1틱 청동이 껍데기의 푸른 장막으로) / F
   */
  atk1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'L', aux: ['F'] },
    hitY: -44,
    light: { r: 26, t: 24 },
    fx: { flip: { at: 1, ticks: 1 }, sink: SINK_N },
    shapes: [
      ghost([14, -36], 41, 37, -138, -14, 20),
      arc([14, -36], 36, 32, -125, 12, 30),
      // 머리가 바닥에 닿는 틱 (지나치기, 진행 6틱): 발 앞 바닥이 짧게 밀리고 작은 덩어리가 솟는다
      surge([40, 0], [8, 58], [9, 5], [24, 42], { delay: 6, spread: 22, hold: 2, fade: 18 }),
      heave([40, 0], 3, 28, [4, 8], { delay: 6, speed: 2.4, life: 44 }),
      dust([40, -2], 4, 8, 72, 1.6, { delay: 7 }),
      ...smallHit(-10, 1),
    ],
  },
  /**
   * 2 기본 2타 되돌려 휘두르기 (일반): 반대 방향 낮은 원호 (아래 뒤 → 앞 위, ARC2), 해머 머리 뒤 푸른 잔상, 바닥을 긁고 앞으로 밀려가는 낮은 물마루와 퍼 올린 조각.
   * I 시간 엇갈림 (히트스톱 동안 세상은 멈추고 원호만 계속 돈다) / F
   */
  atk2: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'I', aux: ['F'] },
    hitY: -20,
    light: { r: 26, t: 24 },
    fx: { sink: SINK_N },
    shapes: [
      ghost([16, -28], 47, 33, 150, 6, 20),
      arc([16, -28], 42, 28, 136, -24, 32, { grow: 2.2, skew: -0.2 }),
      { kind: 'ink', at: [28, -52], angle: 72, len: 50, w: 8, notch: [[0.4, 2], [0.66, 2]], hold: 1, fade: 12 },
      surge([8, 0], [6, 50], [8, 5], [22, 36], { sides: 1, spread: 20, hold: 2, fade: 18 }),
      rocks([8, -2], 4, [4, 8], 2.6, -55, 50, 44),
      dust([8, -2], 4, 8, 72, 1.6),
      ...smallHit(-35, 1.1),
    ],
  },
  /**
   * 3 기본 3타 머리 위로 돌려 내려찍기 (일반): 위 → 아래 큰 원호 (ARC3), 맞는 순간엔 섬광만, 해머가 바닥에 박히는 틱(진행 4틱: 맞혔으면 히트스톱 11틱 뒤)에
   * 바닥이 늦게 터진다: 박힌 자리를 누르는 낮은 충격파 + 양옆으로 밀려가는 물마루 (12-1 '바닥 균열 40px') + 차례로 들리는 판석 + 화면이 아래로 눌린다. B 지연 폭발 / F
   */
  atk3: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'B', aux: ['F'] },
    hitY: -40,
    light: { r: 30, t: 24 },
    fx: { sink: { at: 15, px: 3, ticks: 1 } },
    shapes: [
      ghost([18, -40], 41, 45, -132, 18, 20),
      arc([18, -40], 36, 40, -122, 46, 32, { peak: 0.66 }),
      // B: 바닥에 박힌 자리에서 늦게 터진다 (해머가 닿는 진행 4틱)
      crush([55, 0], [8, 28], [14, 8], 14, { delay: 4, hold: 2, fade: 16, spread: 10 }),
      surge([55, 0], [12, 100], [13, 6], [30, 62], { delay: 4, spread: 24, hold: 3, fade: 20 }),
      heave([55, 0], 6, 56, [5, 11], { delay: 4, life: 56 }),
      { kind: 'ink', at: [34, -62], angle: 70, len: 66, w: 9, notch: [[0.4, 2], [0.7, 2]], delay: 4, hold: 1, fade: 12 },
      dust([55, -2], 8, 10, 88, 2.2, { delay: 5 }),
      spark(60, 0.9, 1, 4),
      embers(10, -60, 1.8, 40),
    ],
  },
  /**
   * 4 기본 4타 풀스윙 (강, 시안 3 채택): 가장 굵은 원호 + 날아가는 쪽 (앞 위 −12°) 빛기둥 하나, 해머가 발 앞 바닥을 스친 자리에서 낮은 물마루가 앞쪽 화면 밖까지
   * 밀려가며 판석이 차례로 들린다. E 화면 밖으로 / G 검은 틈 (원호 머리와 빛기둥 한가운데를 잉크가 가른다) · N 맥동 (빛기둥·물마루가 사라지기 직전 한 번 더 부푼다)
   */
  atk4: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7, 8],
    tech: { main: 'E', aux: ['G', 'N'] },
    hitY: -24,
    light: { r: 70, t: 30 },
    screen: { press: CRACK(2), silhouette: 3 },
    fx: { kick: { at: 0, dx: 6, dy: 0, ticks: 8 }, sink: SINK_S },
    shapes: [
      ...ATK4_ARC,
      // G: 원호의 굵은 머리를 가르는 검은 틈
      { kind: 'ink', at: [-10, -6], angle: -14, len: 92, w: 11, notch: [[0.34, 2], [0.62, 3]], hold: 2, fade: 14 },
      // E: 날아가는 쪽으로 빛기둥 하나 (예전 −30°·−12° 둘 → 낮은 하나), G: 그 한가운데를 가르는 잉크
      { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: -12, back: 14, fwd: 250, w: 22, peak: 0.12, bulge: [0.7, 1.4], skew: -0.2, hold: 2, fade: 18, pulse: true },
      { kind: 'ink', anchor: 'hit', at: [6, -1], angle: -12, len: 180, w: 7, notch: [[0.3, 2], [0.6, 2]], hold: 2, fade: 14 },
      // E: 바닥 물마루가 앞쪽 화면 밖까지 밀려간다 (뒤쪽은 짧게)
      surge([8, 0], [18, 330], [18, 8], [50, 124], { sides: 1, spread: 30, hold: 3, fade: 22, pulse: true }),
      surge([8, 0], [10, 92], [12, 6], [28, 56], { sides: -1, spread: 22, hold: 2, fade: 18 }),
      heave([8, 0], 8, 120, [6, 14], { sides: 1, lift: 7, life: 66 }),
      {
        kind: 'rays', anchor: 'hit', hold: 2, fade: 12,
        lines: [[-160, 100, 50, 3.5, 0], [-118, 94, 58, 3, 1], [-64, 102, 52, 3.5, 0], [24, 96, 60, 3, 1], [62, 100, 48, 3.5, 0], [104, 94, 56, 3, 1], [146, 98, 52, 3.5, 0]],
      },
      { kind: 'ink', anchor: 'hit', at: [-24, -46], angle: 36, len: 112, w: 10, notch: [[0.3, 2], [0.58, 3], [0.82, 2]], hold: 2, fade: 14 },
      { kind: 'ink', anchor: 'hit', at: [10, 22], angle: -40, len: 84, w: 8, notch: [[0.4, 2], [0.7, 2]], hold: 1, fade: 13 },
      spark(-30, 1.7, 2, 6),
      embers(26, -40, 2.8, 64, 140),
      puff([4, -4], 4, 6, 40),
      dust([8, -2], 9, 13, 104, 2.6),
    ],
  },
  /**
   * 5 띄우기 퍼 올리기 (강): 발 앞 바닥에서 머리 위까지 솟는 세로 원호 → 바닥 물마루 → 퍼 올린 바닥 덩어리가 솟구친다.
   * C 모양 변신 (원호 → 물마루 → 덩어리) / D 2.5D 깊이 (덩어리가 카메라 쪽으로 커진다) · I 시간 엇갈림 (히트스톱 동안 원호가 계속 솟는다)
   */
  launcher: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'C', aux: ['D', 'I'] },
    hitY: -40,
    light: { r: 46, t: 28 },
    fx: { sink: SINK_S },
    shapes: [
      {
        kind: 'ribbon', pts: [[24, 2], [30, -22], [34, -48], [30, -74], [18, -96], [2, -110]],
        w: 40, peak: 0.6, bulge: [1, 0.5], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, grow: 2, hold: 2, fade: 16,
      },
      { kind: 'ink', at: [44, -20], angle: -96, len: 92, w: 9, notch: [[0.32, 2], [0.6, 3]], hold: 2, fade: 13 },
      // C 둘째 모양: 바닥 물마루 (살아 있는 2틱 뒤)
      surge([28, 0], [10, 96], [14, 6], [26, 56], { wait: 2, spread: 22, hold: 2, fade: 20 }),
      // C 셋째 모양: 퍼 올린 바닥 덩어리 (살아 있는 6틱 뒤), D 카메라 쪽으로 커진다
      rocks([28, -2], 9, [5, 12], 3.8, -92, 56, 58, { wait: 6, layer: 'front', zoom: 0.02 }),
      heave([28, 0], 4, 44, [5, 10], { wait: 3, life: 52 }),
      spark(-90, 1.4, 2, 5),
      embers(18, -90, 2.6, 54, 90),
      dust([28, -2], 8, 10, 88, 2),
    ],
  },
  /**
   * 6 쓸기 바닥 쓸기 (일반): 발목 높이를 가로지르는 낮고 납작한 원호, 앞으로 밀려가는 낮은 물마루와 돌.
   * H 환경 반응 (빗줄기가 멈추고 쓸고 간 자리의 물웅덩이가 솟는다) / D 2.5D 깊이 (맞은 사람 발밑에 누운 청동 타원 고리)
   */
  sweep: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'H', aux: ['D'] },
    hitY: -12,
    light: { r: 26, t: 24 },
    fx: { rain: { ticks: 20 }, puddle: { at: [-34, -8, 18], n: 8 }, sink: SINK_N },
    shapes: [
      {
        kind: 'ribbon', pts: [[-28, -4], [-4, -5], [22, -11], [44, -21], [62, -34]],
        w: 28, peak: 0.72, bulge: [1, 0.45], skew: 0.15, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, hold: 1, fade: 15,
      },
      { kind: 'ring', cap: true, anchor: 'hit', tone: 2, ripple: 0.35, at: [0, 10], r: 58, w: 5, thick: 90, sy: 0.22, rot: -7, gaps: [[-150, -128]], hold: 2, fade: 16 },
      surge([30, 0], [10, 116], [10, 5], [28, 62], { sides: 1, spread: 22, hold: 2, fade: 20 }),
      rocks([30, -2], 4, [4, 8], 2.8, -30, 40, 44),
      dust([30, -2], 6, 9, 84, 2.2),
      ...smallHit(-20, 1),
    ],
  },
  /**
   * 7 대시 공격 돌진 휘두르기 (강): 몸 아래를 지나 크게 가로지르는 원호 (뒤 아래 → 앞 위), 돌진하던 바닥을 따라 앞으로 밀려가는 물마루와 덩어리, 잉크 쐐기.
   * K 카메라 (줌 펀치 1.06배 + 돌진 방향으로만 흔들기 + 아래로 눌림) / J 남는 흔적 (원호가 지나간 자리에 탄 자국이 1초 넘게 남는다) · D (덩어리가 카메라 쪽으로)
   */
  dashAttack: {
    grade: 'strong',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'K', aux: ['J', 'D'] },
    hitY: -28,
    light: { r: 50, t: 28 },
    fx: { zoom: { at: 0, k: 1.06, ticks: 1 }, kick: { at: 0, dx: 8, dy: 0, ticks: 8, shake: true }, sink: SINK_S },
    shapes: [
      {
        kind: 'ribbon', pts: [[-44, -36], [-16, -20], [14, -13], [42, -19], [60, -32], [70, -50]],
        w: 46, peak: 0.66, bulge: [1, 0.45], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.08, hold: 2, fade: 16,
      },
      // J: 지나간 자리에 남는 탄 자국 (잉크·짙은 청동, 흩어진 뒤에도 1초 넘게)
      {
        kind: 'ribbon', pts: [[-40, -34], [-14, -19], [14, -13], [42, -19], [60, -32], [68, -48]],
        w: 12, peak: 0.6, bulge: [1, 0.8], skew: 0, tones: [3, 2, 2], main: 0.5, core: 0, wave: [0, 40], ruffle: 0.08, breathe: 0.14, delay: 10, hold: 44, fade: 30,
      },
      { kind: 'ink', anchor: 'hit', at: [-18, -40], angle: 40, len: 86, w: 9, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 13 },
      surge([20, 0], [12, 150], [14, 7], [34, 84], { sides: 1, spread: 26, hold: 3, fade: 22 }),
      rocks([20, -2], 7, [5, 11], 3.2, -62, 70, 54, { layer: 'front', zoom: 0.02 }),
      heave([20, 0], 4, 76, [5, 10], { sides: 1, life: 56 }),
      spark(-14, 1.4, 2, 5),
      embers(20, -20, 2.6, 54),
      dust([20, -2], 8, 10, 96, 2.4),
    ],
  },
  /** 8~10 공중 1타 내려치기 (일반): 원 조각 (ARC_A1), 해머 머리 뒤 푸른 잔상. F 콤보 변주 (1타 조각 → 2타 반원 → 3타 온전한 원) / L 색 뒤집기 */
  air1: {
    grade: 'normal',
    grammar: [1, 2, 5, 7],
    tech: { main: 'F', aux: ['L'] },
    hitY: -44,
    light: { r: 24, t: 24 },
    fx: { flip: { at: 1, ticks: 1 }, sink: SINK_N },
    shapes: [
      ghost([12, -42], 37, 37, -112, 0, 18),
      arc([12, -42], 32, 32, -100, 16, 26),
      ...smallHit(20, 0.9, 30),
    ],
  },
  /** 9 공중 2타 퍼 올리기 (일반): 아래에서 앞 위로 반원 (ARC_A2), 잉크 쐐기. F / I 시간 엇갈림 (히트스톱 동안 원호가 계속 돈다) */
  air2: {
    grade: 'normal',
    grammar: [1, 2, 3, 5, 7],
    tech: { main: 'F', aux: ['I'] },
    hitY: -26,
    light: { r: 24, t: 24 },
    fx: { sink: SINK_N },
    shapes: [
      ghost([12, -30], 37, 37, 154, -20, 18),
      arc([12, -30], 32, 32, 142, -40, 28, { grow: 2.2, skew: -0.2 }),
      { kind: 'ink', at: [30, -66], angle: 70, len: 46, w: 7, notch: [[0.45, 2]], hold: 1, fade: 12 },
      ...smallHit(-40, 1, 32),
    ],
  },
  /**
   * 10 공중 3타 내려쳐 떨어뜨리기 (강): 몸 둘레 한 바퀴 온전한 원 (ARC_A3, 몸 뒤 겹) → 맞은 점에서 바닥으로 꽂히는 빛 쐐기 → 맞은 점에서 아래로 쏟아지는 덩어리
   * (아래로 짓눌러 떨어뜨린다). F / C 모양 변신 (원 → 아래로 꽂히는 쐐기 → 떨어지는 덩어리) · K 카메라 (아래로만 흔들기 + 눌림)
   */
  air3: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'F', aux: ['C', 'K'] },
    hitY: -32,
    light: { r: 40, t: 26 },
    fx: { kick: { at: 5, dx: 0, dy: 6, ticks: 7, shake: true }, sink: SINK_S },
    shapes: [
      ghost([14, -36], 37, 37, -170, 70, 20, { part: 0.5 }),
      arc([14, -36], 32, 32, -160, 92, 32, { peak: 0.62, hold: 1, fade: 14 }),
      // C 둘째 모양: 아래로 꽂히는 빛 쐐기 (살아 있는 3틱 뒤)
      { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: 76, back: 20, fwd: 150, w: 28, peak: 0.14, bulge: [0.7, 1.3], wait: 3, hold: 2, fade: 16 },
      { kind: 'ink', anchor: 'hit', at: [-26, -20], angle: 58, len: 70, w: 8, notch: [[0.4, 2], [0.7, 2]], wait: 3, hold: 1, fade: 12 },
      // C 셋째 모양: 맞은 점에서 아래로 쏟아지는 덩어리 (무겁게 떨어져 바닥에서 튄다)
      rocks([0, 4], 7, [4, 9], 2.6, 76, 40, 48, { anchor: 'hit', wait: 5, gravity: 0.26 }),
      spark(76, 1.3, 2, 5),
      embers(16, 70, 2.4, 48, 100),
    ],
  },
  /**
   * 11 내려찍기 (강): 머리 위로 든 해머가 수직으로 떨어지는 세로 원호 (공중, 판정이 시작하는 틱). 착지는 slamLand 사건 (EDWARD_GG_SLAM_LAND):
   * 낮은 물마루가 양옆으로 넓게 밀려가고, 판석이 차례로 들리고, 바닥에 누운 큰 청동 타원 고리, 덩어리가 카메라 쪽으로.
   * D 2.5D 깊이 / H 환경 반응 (빗줄기 멈춤·물웅덩이) · K 카메라 (아래로만 흔들기 + 눌림)
   */
  slam: {
    grade: 'strong',
    grammar: [1, 2, 3, 5, 7, 8],
    tech: { main: 'D', aux: ['H', 'K'] },
    hitY: -30,
    light: { r: 40, t: 26 },
    shapes: [
      {
        kind: 'ribbon', pts: [[-12, -96], [12, -100], [34, -84], [46, -54], [44, -24], [38, 2]],
        w: 40, peak: 0.62, bulge: [1, 0.5], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, hold: 2, fade: 16,
      },
      { kind: 'ink', at: [14, -104], angle: 64, len: 84, w: 9, notch: [[0.34, 2], [0.62, 2]], hold: 1, fade: 13 },
      spark(80, 1.3, 2, 5),
      embers(18, 60, 2.4, 44),
    ],
    // 떨어지는 몸을 따라오는 꼬리: 머리 위로 짧게 남는 빛 쐐기 하나 (해머가 끌고 내려오는 무게, 예전 120·90px 둘 → 70px 하나)
    trail: [
      { kind: 'wedge', at: [10, -40], angle: -92, back: 0, fwd: 70, w: 24, peak: 0.12, bulge: [0.6, 1.3], hold: 8, fade: 8 },
    ],
  },
  /**
   * 12 벽 박차기 (강): 벽을 박찬 몸과 함께 머리 위에서 앞 아래로 내리치는 대각선 원호, 한가운데를 가르는 잉크 (빛이 둘로),
   * 맞은 점에서 앞 아래 화면 밖까지 빛기둥. G 검은 틈 / E 화면 밖으로 (앞 아래로 화면을 민다) · K 카메라 (대각선으로만 흔들기 + 눌림)
   */
  wallKick: {
    grade: 'strong',
    grammar: [1, 2, 3, 4, 5, 7],
    tech: { main: 'G', aux: ['E', 'K'] },
    hitY: -16,
    light: { r: 46, t: 26 },
    fx: { kick: { at: 0, dx: 6, dy: 5, ticks: 9, shake: true }, sink: SINK_S },
    shapes: [
      {
        kind: 'ribbon', pts: [[-22, -74], [6, -88], [32, -72], [46, -42], [50, -10], [46, 6]],
        w: 44, peak: 0.62, bulge: [1, 0.5], skew: 0.2, coreLen: 0.55, wave: [0, 40], ruffle: 0.03, hold: 2, fade: 16,
      },
      // G: 원호 한가운데를 가르는 검은 틈
      { kind: 'ink', at: [-4, -86], angle: 42, len: 104, w: 11, notch: [[0.3, 2], [0.56, 3], [0.8, 2]], hold: 2, fade: 14 },
      { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: 38, back: 24, fwd: 280, w: 26, peak: 0.12, bulge: [0.7, 1.3], hold: 2, fade: 16 },
      spark(38, 1.3, 2, 5),
      embers(18, 30, 2.4, 48),
      puff([2, 4], 3, 4, 34),
    ],
    rehit: [spark(38, 0.7, 1, 3), embers(6, 30, 1.6, 24)],
  },
};

// ───────────────────────── 차지 워 해머 올려치기 (12-2, 시안 1 채택): 단계마다 커지는 아래 → 앞 → 위 큰 반원 + 남는 탄 자국 (J) ─────────────────────────
// 차지는 무게 고침에서 빛기둥을 그대로 둔다 (위로 올려치는 기술: 사용자 지정). 푸른 장막 고리와 온 원호를 덮는 푸른 잔상은 3단계에만 (가장 큰 기술)

/** 차지 원호 (CHARGE_ARC 가운데 4,−34 · 44×28을 조금 키워): 몸 뒤 바닥에서 아래 → 앞 → 머리 위로 */
const chargeArc = (lv: number): GShape[] => {
  const w = [36, 46, 58][lv - 1]!;
  const k = [1, 1.08, 1.16][lv - 1]!;
  return [
    ghost([4, -34], 52 * k, 40 * k, 160, -84, w * 0.62, { part: lv >= 3 ? 1 : 0.42, peak: 0.7 }),
    arc([4, -34], 46 * k, 34 * k, 150, -96, w, { peak: 0.55, coreLen: 0.5, hold: 2, fade: 18 }),
  ];
};
/** J 남는 흔적: 원호가 지나간 자리에 탄 자국 (잉크·짙은 청동)이 1~2초 남았다가 꼬리부터 찢어진다 */
const chargeScar = (lv: number): GShape => ({
  kind: 'swoosh', c: [4, -34], r: 46 * [1, 1.08, 1.16][lv - 1]!, sy: 34 / 46, a0: 140, a1: -80, w: 10 + 2 * lv, peak: 0.55, bulge: [1, 0.8], skew: 0,
  tones: [3, 2, 2], main: 0.5, core: 0, breathe: 0.14, delay: 12, hold: 40 + 20 * lv, fade: 30,
});
/** 차지 맞은 점 (단계별) */
const chargeHit = (lv: number): GShape[] => [
  ...(lv >= 3 ? [{ kind: 'ring', cap: true, anchor: 'hit', tone: 4, ripple: 0.4, r: 112, w: 7, thick: -90, rot: -4, gaps: [[-20, -4], [96, 112], [190, 204]], hold: 2, fade: 14 } as GShape] : []),
  { kind: 'wedge', anchor: 'hit', at: [0, 0], angle: -84, back: 16, fwd: [140, 220, 360][lv - 1]!, w: [20, 28, 38][lv - 1]!, peak: 0.12, bulge: [0.7, 1.3], hold: 2, fade: 16 },
  ...(lv >= 2 ? [{ kind: 'ink', anchor: 'hit', at: [-30, -60], angle: 62, len: 96, w: 10, notch: [[0.3, 2], [0.62, 3]], hold: 2, fade: 13 } as GShape] : []),
  ...(lv >= 3 ? [
    { kind: 'ink', anchor: 'hit', at: [22, 20], angle: -120, len: 76, w: 8, notch: [[0.45, 2]], hold: 1, fade: 13 } as GShape,
    {
      kind: 'rays', anchor: 'hit', hold: 2, fade: 12,
      lines: [[-150, 100, 54, 3.5, 0], [-104, 96, 60, 3, 1], [-40, 102, 50, 3.5, 0], [10, 96, 58, 3, 1], [56, 100, 52, 3.5, 0], [128, 94, 56, 3, 1]],
    } as GShape,
  ] : []),
  spark(-84, 1 + 0.3 * lv, 2, 5),
  embers(14 + 6 * lv, -90, 2.2 + 0.3 * lv, 54, 100),
];
/** 차지 단계별 (시안 1 채택): J 남는 흔적 / A 임팩트 프레임 (3단계 두 색 2틱) · K 카메라 (줌 펀치 + 위로만 흔들기, 맞는 순간 아래로 눌림) */
const chargeLv = (lv: number): GMove => ({
  grade: 'strong',
  grammar: lv >= 3 ? [1, 2, 3, 4, 5, 7, 8] : [1, 2, 3, 4, 5, 7],
  tech: { main: 'J', aux: ['A', 'K'] },
  hitY: -36,
  light: { r: [40, 56, 80][lv - 1]!, t: 30 },
  screen: lv >= 3 ? { press: CRACK(2), silhouette: 3 } : lv === 2 ? { silhouette: 2 } : undefined,
  fx: lv >= 3
    ? { impact: { at: 0, ticks: 2, bg: '#fff3dc', ink: '#170b06' }, zoom: { at: 2, k: 1.07, ticks: 1 }, kick: { at: 2, dx: 0, dy: -8, ticks: 9, shake: true }, sink: SINK_X }
    : { sink: SINK_S },
  shapes: [...chargeArc(lv), chargeScar(lv), ...chargeHit(lv)],
});
export const EDWARD_GG_CHARGE: readonly GMove[] = [1, 2, 3].map(chargeLv);

/** 차지 바닥 파도 (slabs 사건, 판 줄이 시작하는 바닥 기준): J 남는 흔적의 둘째 몫 — 솟은 판은 잔해로 남는다 (render/chars/edward slabs) */
export const edwardSlabs = (len: number): GMove => ({
  grade: 'strong', grammar: [1, 2, 7], tech: { main: 'J', aux: [] }, light: { r: 50 + len / 3, t: 30 }, shapes: chargeSlabs(len),
});
/**
 * 차지 바닥 파도 (slabs 사건, 12-2 '앞쪽 바닥이 일직선으로 솟구친다, 바닥 판이 차례로 들려 올라가는 파도'): 판 줄(길이 len)을 따라 앞으로 밀려가는 물마루,
 * 그 물마루가 지나는 차례로 들리는 판석, 판 줄 끝에서 솟는 빛 쐐기 (차지는 빛기둥을 그대로 둔다), 굴러가는 흙먼지
 */
export function chargeSlabs(len: number): GShape[] {
  const k = len / 96;
  return [
    surge([0, 0], [12, len + 44], [10 + 8 * k, 7], [30, 56 + 24 * k], { sides: 1, spread: 22, hold: 3, fade: 22 }),
    { kind: 'wedge', at: [len, 0], angle: -74, back: 6, fwd: 70 + 50 * k, w: 22 + 8 * k, peak: 0.22, bulge: [0.6, 1.2], skew: 0.2, delay: 4, hold: 2, fade: 16 },
    heave([0, 0], 6 + Math.round(4 * k), len, [6, 14], { sides: 1, life: 66 }),
    dust([len * 0.5, -2], 9, 12, 104, 2.4),
  ];
}

// ───────────────────────── 스킬·필살기 (고른 시안) ─────────────────────────

/** 스킬 1 재현:나 (해머를 바닥에 세우는 reenact 사건, 발밑 기준) */
export interface EdwardSkill1 {
  /** 해머를 세운 자리 (발밑 기준) 모양 */
  plant: GMove;
}
/**
 * 스킬 1 재현:나 (시안 2 채택): N 맥동 — 해머를 세운 자리에서 푸른 장막 물마루가 심장처럼 두 번 (6틱 간격) 바닥을 따라 밀려가고, 사라지기 직전 한 번 더 부푼다.
 * 세운 해머 둘레는 낮은 장막 불꽃만 (예전 170px 빛기둥 → 62px). L 색 뒤집기 (세우는 순간 1틱 장막 → 청동) · D 2.5D 깊이 (장막 덩어리가 카메라 쪽으로 커지며 솟는다)
 */
export const EDWARD_SKILL1: EdwardSkill1 = {
  plant: {
    grade: 'skill',
    grammar: [1, 2, 5, 7],
    tech: { main: 'N', aux: ['L', 'D'] },
    light: { r: 70, t: 32 },
    fx: { flip: { at: 1, ticks: 1 }, sink: SINK_S },
    shapes: [
      { kind: 'wedge', at: [14, 0], angle: -90, back: 4, fwd: 62, w: 26, peak: 0.24, bulge: [0.6, 1.2], tones: [6, 4, 5], main: 0.6, core: 0.24, hold: 4, fade: 18 },
      crush([14, 0], [6, 30], [12, 6], 12, { tones: [6, 4, 5] }),
      surge([14, 0], [10, 124], [14, 6], [30, 66], { tones: [6, 4, 5], spread: 22, hold: 3, fade: 20, pulse: true }),
      surge([14, 0], [8, 92], [10, 5], [24, 52], { tones: [6, 4, 5], delay: 6, spread: 20, hold: 3, fade: 18, pulse: true }),
      heave([14, 0], 6, 72, [5, 11], { tones: [6, 4, 5], layer: 'front', zoom: 0.012, life: 58 }),
      { kind: 'embers', at: [14, -10], n: 16, spread: 8, speed: 1.8, dir: -90, fan: 100, life: 58 },
      dust([14, -2], 8, 10, 92, 2),
    ],
  },
};

/** 스킬 2 염동력: 맞힌 틱 (맞은 점), 끌어당김 장막 손 (tkGrab, 상대 가슴), 밀어냄 장막 벽 (tkWall, 상대 발밑), 장막이 터짐 (tkBurst, 상대 가슴) */
export interface EdwardSkill2 {
  hit: GMove;
  grab: GMove;
  wall: GMove;
  burst: GMove;
}
/** 장막 손 (12-3 '상대보다 한 둘레 큰 손 모양 막'): 다섯 손가락 쐐기가 사방에서 상대 가슴으로 모여 움켜쥔다 (장막 색). 둘레 고리는 뺐다 (파란 원호는 큰 두 기술에만) */
const VEIL_HAND: GShape[] = ([[-150, 52, 15], [-108, 58, 17], [-62, 56, 16], [-26, 50, 14], [128, 46, 13]] as const).map(([a, r, w]) => ({
  kind: 'wedge', at: [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r], angle: a + 180, back: 4, fwd: r * 0.78, w, peak: 0.3, bulge: [0.6, 1.2],
  tones: [6, 4, 5], main: 0.6, core: 0.22, hold: 6, fade: 14,
}) as GShape);
/**
 * 스킬 2 염동력 (시안 2 채택): M 전조 (붙잡기 4틱 전, 상대 가슴으로 공기가 빨려 들고 뒷손에 장막 조각이 모인다: render/fightvfx)
 * / G 검은 틈 (장막 손 한가운데를 잉크가 가른다) · K 카메라 (끌어당기는 쪽으로만 흔들기)
 */
const SK2_TECH = { main: 'M', aux: ['G', 'K'] };
export const EDWARD_SKILL2: EdwardSkill2 = {
  hit: { grade: 'skill', grammar: [5, 7], tech: SK2_TECH, hitY: -30, light: { r: 40, t: 28 }, shapes: [spark(180, 1.1, 2, 5, 4), embers(14, 180, 1.8, 44)] },
  grab: {
    grade: 'skill', grammar: [1, 2, 3, 5, 7], tech: SK2_TECH, light: { r: 70, t: 30 },
    fx: { kick: { at: 0, dx: -7, dy: 0, ticks: 8, shake: true } },
    shapes: [
      ...VEIL_HAND,
      { kind: 'ink', at: [-40, -40], angle: 40, len: 84, w: 9, notch: [[0.34, 2], [0.62, 2]], hold: 3, fade: 13 },
      // G: 장막 손 한가운데를 가르는 잉크
      { kind: 'ink', at: [-6, -50], angle: 84, len: 100, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 4, fade: 13 },
    ],
  },
  wall: {
    grade: 'skill', grammar: [1, 2, 3, 7], tech: SK2_TECH, light: { r: 80, t: 30 },
    shapes: [
      // 높이 70px 장막 벽 (12-3): 바닥에서 솟는 두 장막 쐐기, 뒤에 짙은 장막
      { kind: 'wedge', at: [-10, 2], angle: -86, back: 6, fwd: 108, w: 30, peak: 0.3, bulge: [0.6, 1.1], skew: 0.3, tones: [6, 4, 5], main: 0.62, core: 0.22, hold: 8, fade: 16 },
      { kind: 'wedge', at: [-2, 2], angle: -96, back: 4, fwd: 84, w: 18, peak: 0.36, bulge: [0.6, 1.2], tones: [6, 4, 5], main: 0.6, core: 0.3, delay: 2, hold: 6, fade: 14 },
      // 벽 밑동에서 앞으로 밀려가는 장막 물마루 (바닥 물이 갈라진다, 예전 바닥에 누운 장막 고리 대신)
      surge([-4, 0], [6, 64], [10, 5], [24, 42], { sides: 1, tones: [6, 4, 5], spread: 16, hold: 4, fade: 18 }),
    ],
  },
  burst: {
    grade: 'skill', grammar: [2, 5, 7], tech: SK2_TECH, light: { r: 80, t: 30 },
    shapes: [
      rocks([0, 0], 10, [5, 11], 3.4, -60, 160, 48, { tones: [6, 4, 5], gravity: 0.12 }),
      { kind: 'embers', at: [0, 0], n: 14, spread: 8, speed: 2, dir: -90, fan: 160, life: 50 },
    ],
  },
};

/** 필살기 껍데기 뒤집어쓰기 (12-6 연출 그대로): 잡는 순간 (연출 시작, 맞은 점) · 끝에 상대가 앞으로 무너지는 타격 (상대 발밑) */
export interface EdwardSuper {
  grab: GMove;
  end: GMove;
}
/**
 * 필살기 (시안 3 채택): A 임팩트 프레임 (잡는 순간 두 색 2틱) / G 검은 틈 (무너지는 충격파 한가운데를 잉크가 가른다) · K 카메라 (줌 펀치 + 아래로만 흔들기 + 눌림).
 * 잡는 순간의 큰 장막 고리는 남긴다 (가장 큰 기술). 끝 타격은 위로 솟는 빛 쐐기 대신 가장 넓은 물마루·가장 많은 판석·가장 긴 먼지, 맞은 점에서 퍼져 나간 금
 */
const SUPER_TECH = { main: 'A', aux: ['G', 'K'] };
const SUPER_END: GShape[] = [
  crush([0, 0], [14, 52], [22, 10], 20, { hold: 4, fade: 20, spread: 14 }),
  surge([0, 0], [20, 250], [20, 9], [52, 134], { spread: 34, hold: 5, fade: 24 }),
  { kind: 'ink', at: [-36, -60], angle: 56, len: 100, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 14 },
  // G: 무너지는 충격파 한가운데를 가르는 잉크
  { kind: 'ink', at: [0, -4], angle: -92, len: 84, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 14 },
  heave([0, 0], 14, 150, [6, 16], { lift: 6, life: 76 }),
  dust([0, -2], 15, 16, 120, 3),
  { kind: 'embers', at: [0, -10], n: 24, spread: 10, speed: 2.6, dir: -90, fan: 150, life: 64 },
];
export const EDWARD_SUPER: EdwardSuper = {
  grab: {
    grade: 'super', grammar: [1, 2, 5, 8], tech: SUPER_TECH, hitY: -36, light: { r: 90, t: 32 },
    screen: { silhouette: 3 },
    fx: { impact: { at: 0, ticks: 2, bg: '#fff3dc', ink: '#170b06' } },
    shapes: [
      { kind: 'ring', cap: true, tone: 4, ripple: 0.4, r: 96, w: 6, thick: -110, rot: -4, gaps: [[-30, -14], [70, 86], [160, 176]], hold: 3, fade: 16 },
      ...VEIL_HAND.map((s) => ({ ...s, hold: 8 }) as GShape),
      spark(-90, 1.5, 2, 6, 4),
    ],
  },
  // 끝 타격은 맞은 점 기준 (맞은 점을 상대 발밑 8px 위로 두고, 모양의 바닥 0을 상대 발밑에)
  end: {
    grade: 'super', grammar: [1, 2, 3, 5, 7, 8], tech: SUPER_TECH, hitY: -8, light: { r: 110, t: 34 },
    screen: { press: CRACK(3) },
    fx: { zoom: { at: 0, k: 1.08, ticks: 1 }, kick: { at: 0, dx: 0, dy: 7, ticks: 9, shake: true }, sink: SINK_X },
    shapes: onHitFloor(SUPER_END, 8),
  },
};

/**
 * 내려찍기 착지 (slamLand 사건, 착지한 발밑 앞 20px 기준): 착지 자리를 누르는 낮은 충격파, 양옆으로 넓게 밀려가는 물마루 (12-1 반원 충격파 반지름 48px × 1.5를 낮고 넓게),
 * 차례로 들리는 판석, 바닥에 누운 큰 청동 타원 고리 (D), 덩어리가 카메라 쪽으로 커지며 날아오고, 빗줄기가 멈춘다 (H), 아래로만 흔들리고 눌린다 (K), 퍼져 나간 금
 */
export const EDWARD_GG_SLAM_LAND: GMove = {
  grade: 'strong',
  grammar: [1, 2, 3, 4, 5, 7, 8],
  tech: { main: 'D', aux: ['H', 'K'] },
  light: { r: 80, t: 30 },
  screen: { press: CRACK(2) },
  fx: { rain: { ticks: 22 }, puddle: { at: [-40, 40], n: 8 }, kick: { at: 0, dx: 0, dy: 7, ticks: 9, shake: true }, sink: SINK_X },
  shapes: [
    crush([0, 0], [14, 46], [20, 9], 18, { hold: 3, fade: 18, spread: 12 }),
    surge([0, 0], [18, 214], [18, 8], [46, 112], { spread: 32, hold: 4, fade: 22 }),
    { kind: 'ring', cap: true, tone: 2, ripple: 0.35, at: [0, 0], r: 108, w: 7, thick: 90, sy: 0.2, rot: -8, gaps: [[-130, -110]], hold: 3, fade: 18 },
    { kind: 'ink', at: [-40, -56], angle: 52, len: 92, w: 10, notch: [[0.3, 2], [0.6, 3]], hold: 2, fade: 14 },
    heave([0, 0], 12, 130, [6, 15], { lift: 6, life: 70 }),
    rocks([0, -2], 6, [5, 12], 3.4, -90, 100, 58, { layer: 'front', zoom: 0.025 }),
    dust([0, -2], 12, 14, 112, 2.8),
    { kind: 'embers', at: [0, -8], n: 22, spread: 12, speed: 2.4, dir: -90, fan: 150, life: 60 },
  ],
};
