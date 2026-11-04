// YESTERDAY 애니 격투 게임 이펙트 (동작연출지침서 14장, 렌더 전용) — 공용 부품을 등급표(14-3)대로 묶어 내는 곳.
// 캐릭터는 색표(AnimeLook.ramp)와 모양값(AnimeLook의 꺾임·조각 모양, AnimeMove의 길 모양·길이·두께 모양·가닥·가지·가시)만 넘긴다.
// - animeSwing: 판정이 시작하는 틱 (헛쳐도). 궤적 띠(꽉 찬 면 + 4색 띠 + 찢어진 꼬리) + 잔불, 강 이상은 속도선.
// - animeImpact: 맞힌 틱. 공격 방향으로 방사하는 가시 파편, 강 이상은 배경 누르기.
// 방향 (사용자 피드백 2026-11-04): 힘은 주먹에서 시작해 상대를 관통해 앞으로 터져 나간다. 덩어리는 상대 너머에, 찢어진 꼬리는 앞끝에.
// 판정과의 관계 (14-5): 흰 심이 든 가장 밝은 곳 = 판정 상자. 상자 밖으로 나가는 몸통·가닥은 바깥 두 색으로만.
import animeBand from './band';
import arcBolt from './arcbolt';
import { boltFx } from './bolt';
import embers from './embers';
import pressBackground from './press';
import speedLines from './speedlines';
import spikes from './spikes';
import { sweep, type Sweep } from './sweep';
import { GRADE_SPEC, SCALE, TIMING, type AFrame, type Grade, type Layer, type Ramp4 } from './common';

export { animeBand, arcBolt, embers, pressBackground, speedLines, spikes, GRADE_SPEC, SCALE, TIMING };
export type { AFrame, Grade, Layer, Ramp4 };

/** 이펙트 층에 얹는 것 (render/vfx VfxInstance와 같은 모양) */
export interface Fx {
  update(dt: number): void;
  draw(f: AFrame, layer?: Layer): void;
  done(): boolean;
}

/** 캐릭터 색표와 모양값 (14-4) */
export interface AnimeLook {
  /** 4색 띠: 흰 심 → 밝은 주색 → 진한 주색 → 보색 테두리 */
  ramp: Ramp4;
  /** 배경 누르기 색 ('#rrggbb'): 진한 주색 쪽 */
  press: string;
  /** 띠 가장자리 번개 꺾임 (px, 0 = 매끈)·꼭짓점 간격 (px)·다시 꺾는 틱 (0 = 고정) */
  edge?: number;
  edgeStep?: number;
  crackle?: number;
  /** 잔불 조각 모양 */
  ember?: 'shard' | 'bolt' | 'dot';
  /** 보색 테두리 두께 (px), 흰 심 깊이 (px) */
  rimW?: number;
  coreIn?: number;
}

/** 기술 하나의 모양값: 궤적 길 모양과 크기 (흰 심 = 판정 상자) */
export interface AnimeMove {
  grade: Grade;
  /**
   * line: 주먹에서 상자 가운데 높이로 앞으로 곧게 · arc: 발이 지난 반원을 번개 줄기로 + 반원 앞에서 앞으로 터지는 띠 ·
   * ground: 주먹에서 바닥으로 꽂히는 번개 + 바닥을 타고 앞으로 달리는 쐐기
   */
  path: 'line' | 'arc' | 'ground';
  /** 띠 길이 (시작 → 앞끝, px) */
  len: number;
  /** 가장 굵은 곳 두께 (px). ground는 바닥에 잘리기 전 두께 */
  width: number;
  /** 두께 모양: [길 위 자리 u (0 시작 → 1 앞끝), 가장 굵은 곳 대비 비율] */
  profile?: ReadonlyArray<readonly [number, number]>;
  /** 앞끝에서 흩어지는 가닥: 수, 피크 때 갈라진 앞쪽 비율, 퍼지는 각 (도), 띠 끝을 넘어 뻗는 길이 (px), 뿌리 굵기 (px), 날아가는 빠르기 (px/틱) */
  strands?: number;
  scatter?: number;
  spread?: number;
  reach?: number;
  strandW?: number;
  fly?: number;
  /** 띠 안팎으로 갈라지는 굵은 전류 가지: 수, 길이 (px), 뿌리 굵기 (px) */
  branches?: number;
  branchLen?: number;
  branchW?: number;
  /** 가장자리 번개 꺾임 (px): 없으면 색표의 값 */
  edge?: number;
  /** 흰 심·밝은 주색 반두께 비율 (띠 두께 대비, 기본 0.32·0.72): 넓은 판정 상자에서 밝은 곳이 네모로 보이지 않게 줄인다 */
  coreW?: number;
  mainW?: number;
  /** 속도선 다발 가운데 높이 (발밑 기준 px, 위가 −)와 퍼지는 폭 (px) */
  speedAt?: { y: number; spread: number };
  /** 시간표 바꾸기 (빠른 타) */
  timing?: { hold: number; tear: number };
  /** 가시 파편: 수, 부채꼴 (도, 공격 방향 기준, 위가 −), 길이 범위 (px), 뿌리 굵기 (px), 맞은 자리에서 앞으로 옮길 거리 (px: 공격자 몸에 닿지 않게) */
  spikes: { count: number; fan: readonly [number, number]; len: readonly [number, number]; base?: number; ahead?: number };
  /** arc: 반원 반지름 (px), 번개 줄기 수, 바깥 가지 수, 가운데 줄기 굵기 (px) */
  arc?: { r: number; bolts: number; forks: number; width?: number };
  /** ground: 주먹 → 바닥 번개 굵기 (px), 꽂히는 자리 (주먹 x에서 앞으로 px), 쐐기가 시작하는 자리 (발밑 기준 px) */
  ground?: { strikeW: number; land: number; from: number };
}

/** 판정 상자 (발밑 기준, 오른쪽 보는 기준 px: data/moves TrailBox와 같다) */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 공격자 자리: 발밑 월드 px, 바닥 월드 y, 보는 쪽 */
export interface Who {
  x: number;
  y: number;
  floor: number;
  facing: number;
}

const GRADE_N: Record<Grade, { speed: number; speedTicks: number; embers: number; emberLife: readonly [number, number]; press: number; spikeHold: number; spikeTicks: number }> = {
  normal: { speed: 0, speedTicks: 0, embers: 16, emberLife: [6, 11], press: 0, spikeHold: 1, spikeTicks: 7 },
  strong: { speed: 14, speedTicks: 6, embers: 28, emberLife: [8, 15], press: 2, spikeHold: 3, spikeTicks: 9 },
  skill: { speed: 14, speedTicks: 7, embers: 28, emberLife: [9, 16], press: 2, spikeHold: 4, spikeTicks: 10 },
  super: { speed: 20, speedTicks: 8, embers: 30, emberLife: [10, 18], press: 3, spikeHold: 5, spikeTicks: 12 },
};

/**
 * 깔아 둔 면 (기술·방향·상자·바닥 높이가 같으면 다시 쓴다: 띠를 처음 낼 때 한 번만 계산하고, 그 뒤로는 자리만 옮긴다).
 * 면은 공격자 발밑 기준 좌표 (보는 쪽 반영)
 */
const SWEEPS = new Map<string, Sweep>();

/**
 * 판정이 시작하는 틱: 궤적 띠 + 잔불 (+ 강 이상 속도선). fist = 그 틱 주먹·발 자리 (발밑 기준, 오른쪽 보는 기준 px).
 * 띠를 돌려준다 (빛·확인용)
 */
export function animeSwing(add: (fx: Fx) => void, look: AnimeLook, mv: AnimeMove, box: Box, who: Who, seed: number, fist?: readonly [number, number]) {
  const fc = who.facing >= 0 ? 1 : -1;
  // 공격자 발밑 (정수 px): 면·길은 이 자리 기준으로 깔고 그릴 때 옮긴다
  const OX = Math.round(who.x);
  const OY = Math.round(who.y);
  const L = (x: number, y: number): [number, number] => [fc * x, y];
  const W = (x: number, y: number): [number, number] => [OX + fc * x, OY + y];
  const floorL = Math.round(who.floor - OY) + 1;
  const range = (X: number, Y: number): boolean => {
    const lx = X * fc;
    return lx >= box.x && lx <= box.x + box.w && Y >= box.y && Y <= box.y + box.h;
  };
  const inRangeW = (X: number, Y: number) => range(X - OX, Y - OY);
  const T = mv.timing ?? TIMING[mv.grade];
  const cy = box.y + box.h / 2;
  const tip = fist ?? [box.x, cy];
  // 띠 시작 (오른쪽 보는 기준): line = 주먹, arc = 반원 앞 끝, ground = 쐐기 시작 (바닥 가까이 상자 가운데 높이)
  let start: [number, number];
  let arcFx: ReturnType<typeof arcBolt> | null = null;
  if (mv.path === 'arc') {
    const a = mv.arc ?? { r: box.h / 2 - 4, bolts: 3, forks: 3 };
    const c: [number, number] = [box.x, cy];
    arcFx = arcBolt({
      center: c,
      r: a.r,
      // 아래(뒤쪽 조금 앞) → 앞 → 위: 양 끝은 공격자 다리·몸 쪽으로 감기지 않게 조금 덜 돈다
      a0: (80 * Math.PI) / 180,
      a1: (-85 * Math.PI) / 180,
      bolts: a.bolts,
      forks: a.forks,
      width: a.width,
      ramp: look.ramp,
      grade: mv.grade,
      timing: mv.timing,
      range,
      offset: [OX, OY],
      facing: fc,
      crackle: look.crackle,
      seed: seed + 3,
    });
    add(arcFx);
    start = [c[0] + a.r, cy];
  } else if (mv.path === 'ground') {
    const g = mv.ground ?? { strikeW: 4, land: 12, from: box.x };
    const gy = Math.min(cy, who.floor - OY - 2);
    start = [g.from, gy];
    // 주먹 → 바닥: 번개가 꽂힌다
    add(boltFx({
      a: W(tip[0], tip[1]),
      b: W(tip[0] + g.land, who.floor - OY),
      width: g.strikeW,
      forks: 3,
      ramp: look.ramp,
      grade: mv.grade,
      timing: mv.timing,
      inRange: inRangeW,
      floor: who.floor,
      seed: seed + 5,
    }));
  } else start = [tip[0], cy];
  const lpath: Array<[number, number]> = [L(start[0], start[1]), L(start[0] + mv.len, start[1])];
  const edge = mv.edge ?? (look.edge ?? 0) * Math.max(1, Math.min(1.6, mv.width / 24));
  const key = [fc, mv.path, mv.len, mv.width, JSON.stringify(mv.profile ?? []), start[0], start[1], box.x, box.y, box.w, box.h, floorL, edge].join('|');
  let S = SWEEPS.get(key);
  if (!S) {
    S = sweep({ path: lpath, width: mv.width, profile: mv.profile, slack: edge * 1.6 + 1, floor: floorL, range });
    SWEEPS.set(key, S);
    if (SWEEPS.size > 48) SWEEPS.delete(SWEEPS.keys().next().value!);
  }
  const band = animeBand({
    path: lpath,
    width: mv.width,
    profile: mv.profile,
    floor: floorL,
    range,
    sweep: S,
    offset: [OX, OY],
    ramp: look.ramp,
    grade: mv.grade,
    timing: mv.timing,
    edge,
    edgeStep: look.edgeStep,
    crackle: look.crackle,
    strands: mv.strands,
    scatter: mv.scatter,
    spread: mv.spread,
    reach: mv.reach,
    strandW: mv.strandW,
    fly: mv.fly,
    branches: mv.branches,
    branchLen: mv.branchLen,
    branchW: mv.branchW,
    rimW: look.rimW,
    coreIn: look.coreIn,
    coreW: mv.coreW,
    mainW: mv.mainW,
    seed,
  });
  add(band);
  const N = GRADE_N[mv.grade];
  const dir = fc > 0 ? 0 : Math.PI;
  // 잔불: 주먹부터 앞으로 띠를 따라, 띠가 찢어지는 동안 생긴다 (공격자 몸 쪽에는 내지 않는다)
  const from: Array<[number, number]> = [];
  for (let k = 0; k <= 8; k++) from.push(W(start[0] + (mv.len * k) / 8, start[1]));
  from.push(W(tip[0], tip[1]));
  const em = embers({
    from,
    count: N.embers,
    dir,
    colors: [look.ramp.core, look.ramp.main, look.ramp.rim, look.ramp.deep],
    kind: look.ember,
    born: [T.hold, T.tear],
    life: N.emberLife,
    seed: seed + 11,
  });
  add(em);
  // 강 이상: 공격 방향으로 화면을 가로지르는 속도선 (주먹보다 뒤로는 넘어가지 않는다)
  let sl: ReturnType<typeof speedLines> | null = null;
  if (N.speed) {
    // 다발 가운데는 띠 위쪽 (모양값이 있으면 그 높이, 바닥 아래로는 그리지 않는다)
    const mid = W(start[0] + mv.len * 0.5, mv.speedAt ? who.floor - OY + mv.speedAt.y : Math.min(box.y + box.h / 2 - 10, who.floor - OY - 44));
    sl = speedLines({
      x: mid[0],
      y: mid[1],
      dir,
      count: N.speed,
      ticks: N.speedTicks,
      len: [40 * SCALE, 200 * SCALE],
      spread: mv.speedAt?.spread ?? 46,
      reach: mv.len,
      colors: [look.ramp.core, look.ramp.main, look.ramp.rim],
      // 주먹보다 24px 앞부터 (공격자 머리·몸통 위로 지나가지 않게)
      back: -mv.len * 0.5 + 24,
      floor: who.floor,
      seed: seed + 23,
    });
    add(sl);
  }
  return {
    band,
    /** 확인용 숫자 (피크): 띠 길이·두께, 색 단계, 앞끝 가닥, 전류 가지, 반원 줄기, 속도선, 잔불 */
    metrics() {
      const m = band.metrics();
      return { ...m, arc: arcFx?.metrics() ?? null, speed: sl?.count ?? 0, embers: em.count, grade: mv.grade };
    },
  };
}

/** 맞힌 틱: 공격 방향으로 방사하는 가시 파편 (+ 강 이상 배경 누르기). x·y = 맞은 자리 (월드 px), tick = 지금 sim 틱 */
export function animeImpact(add: (fx: Fx) => void, look: AnimeLook, mv: AnimeMove, x: number, y: number, facing: number, tick: number, seed: number) {
  const N = GRADE_N[mv.grade];
  const fc = facing >= 0 ? 1 : -1;
  const dir = fc > 0 ? 0 : Math.PI;
  const rad = (d: number) => (d * Math.PI) / 180;
  const fan: [number, number] = fc > 0 ? [rad(mv.spikes.fan[0]), rad(mv.spikes.fan[1])] : [-rad(mv.spikes.fan[1]), -rad(mv.spikes.fan[0])];
  const sx = x + fc * (mv.spikes.ahead ?? 0);
  const sp = spikes({ x: sx, y, dir, count: mv.spikes.count, len: mv.spikes.len, fan, base: mv.spikes.base, white: look.ramp.core, rim: look.ramp.rim, hold: N.spikeHold, ticks: N.spikeTicks, seed });
  add(sp);
  // 맞은 자리 작은 불꽃 점 (앞으로 튄다)
  add(embers({ from: [[x, y]], count: 8, dir, colors: [look.ramp.core, look.ramp.main, look.ramp.rim], kind: 'dot', born: [0, 2], life: [4, 8], speed: 3.2, layer: 'front', seed: seed + 5 }));
  if (N.press) pressBackground({ tick, ticks: N.press, k: 0.88, color: look.press });
  return { spikes: sp.count, spikeLen: sp.lengths(), fan: mv.spikes.fan, press: N.press };
}
