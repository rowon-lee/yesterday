import type { TrailBox } from '../../moves/base';

/**
 * 오스카 베기 선 (숫자 데이터, 캐릭터 기획서 13장 '베기의 문법'): 몸은 거의 안 움직이는데 화면이 길게 베인다.
 * 선은 그려지는 과정 없이 한 번에 전체 길이로 생기고(흰 심 1px + 은빛 테두리 1px), 상대 몸을 관통해 뒤로 뻗는다.
 * 판정도 이 선이다: 두께 6px의 긴 선 (sim/chars/oscar.ts, 관절 판정 예외). 렌더(베기 선·검영 기울기)와 sim이 같이 쓴다.
 * 선 하나 = [x0, y0, x1, y1]: 발밑 기준 px, 오른쪽 보는 기준 (위가 −). 첫 선이 그 기술의 주된 베기 (검영이 이 선 가운데에 이 기울기로 남는다).
 * 선의 가운데는 오스카 앞 40~72px. 길이: 평타 56~96px, 스킬 96~140px, 차지 꽃 하나당 80~120px, 필살기는 화면 끝에서 끝까지.
 */
export type Cut = readonly [number, number, number, number];

/** 판정 두께의 반 (px): 선에서 이만큼 안쪽이면 베인다 */
export const CUT_HALF = 3;

export const OSCAR_CUTS: Readonly<Record<string, readonly Cut[]>> = {
  /** 1타 칼자루에 손: 상대 쪽으로 내려 긋는 비스듬한 선 한 줄 (64px) */
  atk1: [[18, -47, 74, -17]],
  /** 2타 반 걸음 미끄러짐: 반대 각도로 올려 긋는 선 한 줄 (72px, 1타와 X자) */
  atk2: [[17, -14, 79, -50]],
  /** 3타 몸을 살짝 낮춤: 가로 선 두 줄 평행 (80px) */
  atk3: [[12, -40, 92, -40], [12, -24, 92, -24]],
  /** 4타 반쯤 뽑았다 납도: 앞쪽 공간에 선 세 줄이 한꺼번에 (96px), 납도하는 순간 */
  atk4: [[8, -30, 104, -34], [14, -58, 98, -10], [16, -8, 96, -56]],
  /** 띄우기 위를 올려봄: 아래에서 위로 세로 선 (88px) */
  launcher: [[40, 6, 46, -82]],
  /** 쓸기 낮게: 바닥에 붙은 가로 선 (96px, 물이 갈라진다) */
  sweep: [[8, -3, 104, -3]],
  /** 대시 공격 월영 베기: 지나온 길 앞을 길게 (88px) */
  dashAttack: [[4, -24, 92, -38]],
  /** 공중 1타: 앞 아래로 비스듬히 (64px). 공중 선은 쫓아간 상대 몸 높이(발밑 위 30~40px)를 지난다 */
  air1: [[14, -50, 70, -18]],
  /** 공중 2타: 반대 각도로 (72px) */
  air2: [[12, -22, 76, -54]],
  /** 공중 3타: X자 두 줄 (80px) */
  air3: [[13, -63, 79, -17], [13, -17, 79, -63]],
  /** 내려찍기 내려다봄: 위에서 아래로 세로 선, 바닥까지 갈라진다 (땅 밑으로 넘는 곳은 잘라 쓴다) */
  slam: [[30, -44, 38, 200]],
  /** 벽 박차기 공격: 앞 아래로 길게 (80px) */
  wallKick: [[8, -44, 72, 4]],
};

/** 스킬 1 월하참뢰검: 표식 자리(상대 몸 가운데) 기준 선 한 줄 (120px, 비스듬히. 땅 밑으로 넘는 곳은 잘라 쓴다) */
export const SKILL1_CUT: Cut = [-37, -47, 37, 47];
/** 표식 자리: 상대 발밑에서 이만큼 위 (몸 가운데) */
export const SKILL1_MID = 30;

/** 차지 만검지화: 꽃이 피는 자리 (발밑 기준 px, 오스카 앞 48·80·112px) */
export const BLOOMS: ReadonlyArray<readonly [number, number]> = [[48, -34], [80, -42], [112, -30]];
/** 꽃 하나가 펼쳐지는 베기 선 다발 (꽃 자리 기준): 서로 다른 각도로 교차하는 세 줄 (80~120px) */
export const BLOOM_CUTS: ReadonlyArray<readonly Cut[]> = [
  [[-39, -10, 39, 10], [-26, 38, 26, -38], [-14, -48, 14, 48]],
  [[-49, 9, 49, -9], [-30, -42, 30, 42], [-40, 40, 40, -40]],
  [[-58, -15, 58, 15], [-20, 45, 20, -45], [-42, -22, 42, 22]],
];
/** 모으는 동안 피는 검영 꽃: 한 점에서 꽃잎처럼 퍼지는 은빛 선 (꽃마다 각도(도)와 길이 px) */
export const PETALS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-90, 28], [-30, 26], [25, 30], [90, 24], [150, 28], [210, 26]],
  [[-70, 30], [-10, 32], [50, 26], [110, 30], [170, 26]],
  [[-100, 26], [-40, 30], [20, 28], [80, 32], [140, 26], [200, 30]],
];

/** 선 끝을 땅(발밑 기준 y = lift 아래로 넘는 곳)에서 자른다: 내려찍기·월하참뢰검 선이 바닥에서 멈추게 */
export function clipToGround(c: Cut, ground: number): Cut {
  const [x0, y0, x1, y1] = c;
  if (y0 <= ground && y1 <= ground) return c;
  if (y0 > ground && y1 > ground) return [x0, ground, x1, ground];
  const k = (ground - y0) / (y1 - y0);
  const gx = Math.round(x0 + (x1 - x0) * k);
  return y0 > ground ? [gx, ground, x1, y1] : [x0, y0, gx, ground];
}

/** 이 기술의 선들을 감싼 상자 (발밑 기준, CPU가 사거리를 잰다). 내려찍기는 발밑 아래 40px까지만 */
export function cutBox(id: string): TrailBox {
  const cuts = OSCAR_CUTS[id] ?? [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [a, b, c, d] of cuts) {
    x0 = Math.min(x0, a, c);
    x1 = Math.max(x1, a, c);
    y0 = Math.min(y0, b, d);
    y1 = Math.max(y1, Math.min(40, b), Math.min(40, d));
  }
  return { x: x0, y: y0 - CUT_HALF, w: x1 - x0, h: y1 - y0 + CUT_HALF * 2, shape: 'line' };
}

/** 주된 베기의 기울기 (도, 화면 좌표: 0 = 앞, 양수 = 아래로). 검영이 이 기울기로 눕는다 */
export function cutAngle(kind: string): number {
  const c = kind === 'skill1' ? SKILL1_CUT : kind === 'bloom' ? BLOOM_CUTS[0]![0]! : OSCAR_CUTS[kind]?.[0];
  if (!c) return 0;
  return Math.round((Math.atan2(c[3] - c[1], c[2] - c[0]) * 180) / Math.PI);
}

/** 3°마다 방향 (1000배 정수 cos·sin, -87° ~ 90°): 필살기 선의 기울기가 모두 다르게 (sim이 삼각함수를 쓰지 않게) */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [52, -999], [105, -995], [156, -988], [208, -978], [259, -966], [309, -951], [358, -934], [407, -914], [454, -891], [500, -866],
  [545, -839], [588, -809], [629, -777], [669, -743], [707, -707], [743, -669], [777, -629], [809, -588], [839, -545], [866, -500],
  [891, -454], [914, -407], [934, -358], [951, -309], [966, -259], [978, -208], [988, -156], [995, -105], [999, -52], [1000, 0],
  [999, 52], [995, 105], [988, 156], [978, 208], [966, 259], [951, 309], [934, 358], [914, 407], [891, 454], [866, 500],
  [839, 545], [809, 588], [777, 629], [743, 669], [707, 707], [669, 743], [629, 777], [588, 809], [545, 839], [500, 866],
  [454, 891], [407, 914], [358, 934], [309, 951], [259, 966], [208, 978], [156, 988], [105, 995], [52, 999], [0, 1000],
];
/** 필살기 선 수: 기본 30줄 + 검영 하나당 6줄 (최대 60) */
export const superCutCount = (shadows: number): number => Math.min(DIRS.length, 30 + 6 * shadows);

/**
 * 필살기 월령수류의 베기 선: 화면 끝에서 끝까지 (기본 30줄 + 검영 하나당 6줄, 기울기는 모두 다르게). 기준점(두 사람 가운데, 땅) 기준 px.
 * 정수만 쓰는 시드 난수로 정한다 (sim이 같은 선으로 물건·건물을 베고, 렌더가 같은 선을 그린다).
 * 선마다 지나는 점 하나(화면 안)와 3° 칸 하나의 방향으로, 양쪽으로 900px씩 뻗는다. 앞 30줄은 화면 가운데에 몰리지 않게 고르게 흩는다.
 */
export function superCuts(n: number): Cut[] {
  let r = 0x2545f491;
  const next = (m: number): number => {
    r = (Math.imul(r, 1103515245) + 12345) >>> 0;
    return (r >>> 8) % m;
  };
  const out: Cut[] = [];
  for (let i = 0; i < Math.min(n, DIRS.length); i++) {
    const [dx, dy] = DIRS[(i * 23 + 7) % DIRS.length]!;
    // 지나는 점: 가로 6칸 × 세로 3칸에 고르게 + 칸 안에서 흔들기 (화면 480×270, 땅 위 -230 ~ 20)
    const cx = -240 + ((i % 6) * 80) + next(80);
    const cy = -230 + ((Math.floor(i / 6) % 3) * 80) + next(80);
    out.push([cx - Math.round((dx * 900) / 1000), cy - Math.round((dy * 900) / 1000), cx + Math.round((dx * 900) / 1000), cy + Math.round((dy * 900) / 1000)]);
  }
  return out;
}
