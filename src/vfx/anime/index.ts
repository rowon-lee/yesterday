// YESTERDAY 애니 격투 게임 이펙트 (동작연출지침서 14장, 렌더 전용) — 공용 부품을 등급표(14-3)대로 묶어 내는 곳.
// 캐릭터는 색표(AnimeLook.ramp)와 모양값(AnimeLook의 꺾임·가닥·전류 가닥·조각 모양, AnimeMove의 길 모양·길이·두께)만 넘긴다.
// - animeSwing: 판정이 시작하는 틱 (헛쳐도). 궤적 띠(꽉 찬 면 + 4색 띠 + 찢어진 꼬리) + 잔불, 강 이상은 속도선.
// - animeImpact: 맞힌 틱. 가시 파편, 강 이상은 배경 누르기.
// 판정과의 관계 (14-5): 흰 심이 든 머리 = 판정 상자. 상자 밖으로 나가는 몸통·꼬리는 바깥 두 색과 가닥으로만.
import animeBand from './band';
import embers from './embers';
import pressBackground from './press';
import { sweep, type Sweep } from './sweep';
import speedLines from './speedlines';
import spikes from './spikes';
import { GRADE_SPEC, SCALE, TIMING, type AFrame, type Grade, type Layer, type Ramp4 } from './common';

export { animeBand, embers, pressBackground, speedLines, spikes, GRADE_SPEC, SCALE, TIMING };
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
  /** 띠 가장자리 꺾임 (px, 0 = 매끈)·간격 (px)·다시 꺾는 틱 (0 = 고정) */
  edge?: number;
  edgeStep?: number;
  crackle?: number;
  /** 꼬리 가닥 수 (3~7), 피크 때 갈라진 꼬리 비율, 가닥 묶음 꺾임 */
  strands?: number;
  tail?: number;
  wiggle?: number;
  /** 가지 치는 가닥 (일반·강) */
  filaments?: readonly [number, number];
  filamentLen?: number;
  /** 잔불 조각 모양 */
  ember?: 'shard' | 'bolt' | 'dot';
  /** 보색 테두리 두께 (px), 흰 심 깊이 (px) */
  rimW?: number;
  coreIn?: number;
}

/** 기술 하나의 모양값: 궤적 길 모양과 크기 (머리 = 판정 상자) */
export interface AnimeMove {
  grade: Grade;
  /** line: 상자 가운데 높이로 곧게 (머리 = 상자 앞끝) · arc: 상자 왼쪽 가운데를 중심으로 뒤 → 아래 → 앞 → 위 · ground: 바닥을 따라 (아랫변이 바닥) */
  path: 'line' | 'arc' | 'ground';
  /** 머리 + 몸통 + 꼬리 길이 (px) */
  len: number;
  /** 머리 두께 (px). ground는 바닥에 잘리기 전 두께 (보이는 두께 ≈ 상자 높이/2 + 반두께) */
  width: number;
  /** 꼬리 끝 두께 비율, 머리 앞 둥근 마감 (px) */
  taper?: number;
  cap?: number;
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

const GRADE_N: Record<Grade, { fil: 0 | 1; speed: number; speedTicks: number; spikes: number; embers: number; emberLife: readonly [number, number]; press: number; spikeHold: number; spikeTicks: number }> = {
  normal: { fil: 0, speed: 0, speedTicks: 0, spikes: 4, embers: 16, emberLife: [6, 11], press: 0, spikeHold: 2, spikeTicks: 7 },
  strong: { fil: 1, speed: 14, speedTicks: 6, spikes: 7, embers: 28, emberLife: [8, 15], press: 2, spikeHold: 3, spikeTicks: 9 },
  skill: { fil: 1, speed: 14, speedTicks: 7, spikes: 7, embers: 28, emberLife: [9, 16], press: 2, spikeHold: 4, spikeTicks: 10 },
  super: { fil: 1, speed: 20, speedTicks: 8, spikes: 9, embers: 30, emberLife: [10, 18], press: 3, spikeHold: 5, spikeTicks: 12 },
};

/**
 * 깔아 둔 면 (기술·방향·상자·바닥 높이가 같으면 다시 쓴다: 띠를 처음 낼 때 한 번만 계산하고, 그 뒤로는 자리만 옮긴다).
 * 면은 공격자 발밑 기준 좌표 (보는 쪽 반영)
 */
const SWEEPS = new Map<string, Sweep>();

/** 판정이 시작하는 틱: 궤적 띠 + 잔불 (+ 강 이상 속도선). 띠를 돌려준다 (빛·확인용) */
export function animeSwing(add: (fx: Fx) => void, look: AnimeLook, mv: AnimeMove, box: Box, who: Who, seed: number) {
  const fc = who.facing >= 0 ? 1 : -1;
  // 공격자 발밑 (정수 px): 면·길은 이 자리 기준으로 깔고 그릴 때 옮긴다
  const OX = Math.round(who.x);
  const OY = Math.round(who.y);
  const L = (x: number, y: number): [number, number] => [fc * x, y];
  const W = (x: number, y: number): [number, number] => [OX + fc * x, OY + y];
  const local: Array<[number, number]> = [];
  const headX = box.x + box.w;
  const taper = mv.taper ?? 0.55;
  if (mv.path === 'arc') {
    // 상자 왼쪽 가운데를 중심으로: 바깥 가장자리가 상자 반지름을 조금 넘게. 머리는 위(−90°), 아래(90°)를 지나 뒤로 감기는 꼬리
    const cx = box.x;
    const cy = box.y + box.h / 2;
    const r = box.h / 2 - mv.width * 0.15;
    const back = Math.max(0, (mv.len - Math.PI * r) / r);
    const a0 = Math.PI / 2 + back;
    const a1 = -Math.PI / 2;
    const n = Math.max(8, Math.ceil(((a0 - a1) * r) / 2));
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      local.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  } else if (mv.path === 'ground') {
    // 가운데 줄은 상자 가운데 높이 (바닥 가까이): 아래 절반은 바닥에 잘리고, 위로 반두께만큼 솟는다 (바닥을 타고 달리는 줄기)
    const cy = Math.min(box.y + box.h / 2, who.floor - OY - 2);
    local.push([headX - mv.len, cy], [headX, cy]);
  } else {
    const cy = box.y + box.h / 2;
    local.push([headX - mv.len, cy], [headX, cy]);
  }
  const path = local.map(([x, y]) => W(x, y));
  const lpath = local.map(([x, y]) => L(x, y));
  const range = (X: number, Y: number): boolean => {
    const lx = X * fc;
    return lx >= box.x && lx <= box.x + box.w && Y >= box.y && Y <= box.y + box.h;
  };
  const N = GRADE_N[mv.grade];
  const edge = (look.edge ?? 0) * Math.max(1, Math.min(1.6, mv.width / 24));
  const floorL = Math.round(who.floor - OY) + 1;
  const key = [fc, mv.path, mv.len, mv.width, taper, mv.cap ?? '', box.x, box.y, box.w, box.h, floorL, edge].join('|');
  let S = SWEEPS.get(key);
  if (!S) {
    S = sweep({ path: lpath, width: mv.width, taper, cap: mv.cap, slack: edge + 1, floor: floorL, range });
    SWEEPS.set(key, S);
    if (SWEEPS.size > 48) SWEEPS.delete(SWEEPS.keys().next().value!);
  }
  const band = animeBand({
    path: lpath,
    width: mv.width,
    taper,
    cap: mv.cap,
    floor: floorL,
    range,
    sweep: S,
    offset: [OX, OY],
    ramp: look.ramp,
    grade: mv.grade,
    // 꺾임은 띠가 굵을수록 크게 (머리 두께 24px 기준)
    edge,
    edgeStep: look.edgeStep,
    crackle: look.crackle,
    strands: look.strands,
    tail: look.tail,
    wiggle: look.wiggle,
    filaments: look.filaments?.[N.fil] ?? 0,
    filamentLen: look.filamentLen,
    rimW: look.rimW,
    coreIn: look.coreIn,
    seed,
  });
  add(band);
  const dir = fc > 0 ? 0 : Math.PI;
  const T = TIMING[mv.grade];
  // 잔불: 궤적 위 점들과 공격자 둘레에서, 띠가 찢어지는 동안 생긴다
  const from: Array<[number, number]> = [];
  for (let k = 0; k < path.length; k++) from.push(path[k]!);
  for (let k = 0; k < 6; k++) from.push(W(-6 + (k % 3) * 8, -18 - 10 * Math.floor(k / 3)));
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
  // 강 이상: 공격 방향으로 화면을 가로지르는 속도선
  let sl: ReturnType<typeof speedLines> | null = null;
  if (N.speed) {
    const spec = GRADE_SPEC[mv.grade];
    const mid = W(headX - mv.len * 0.45, box.y + box.h / 2 - 8);
    sl = speedLines({
      x: mid[0],
      y: mid[1],
      dir,
      count: N.speed,
      ticks: N.speedTicks,
      len: [40 * SCALE, 200 * SCALE],
      spread: 72,
      reach: spec.len[1],
      colors: [look.ramp.core, look.ramp.main, look.ramp.rim],
      seed: seed + 23,
    });
    add(sl);
  }
  return {
    band,
    /** 확인용 숫자 (피크): 띠 길이·두께, 색 단계, 꼬리 가닥, 전류 가닥, 속도선, 잔불 */
    metrics() {
      const m = band.metrics();
      return { ...m, speed: sl?.count ?? 0, embers: em.count, grade: mv.grade };
    },
  };
}

/** 맞힌 틱: 가시 파편 (+ 강 이상 배경 누르기). x·y = 맞은 자리 (월드 px), tick = 지금 sim 틱 */
export function animeImpact(add: (fx: Fx) => void, look: AnimeLook, grade: Grade, x: number, y: number, facing: number, tick: number, seed: number) {
  const N = GRADE_N[grade];
  const spec = GRADE_SPEC[grade];
  const dir = facing >= 0 ? 0 : Math.PI;
  const sp = spikes({ x, y, dir, count: N.spikes, len: spec.spikeLen, white: look.ramp.core, rim: look.ramp.rim, hold: N.spikeHold, ticks: N.spikeTicks, seed });
  add(sp);
  // 맞은 자리 작은 불꽃 점 (가시 사이로 튄다)
  add(embers({ from: [[x, y]], count: 8, dir, colors: [look.ramp.core, look.ramp.main, look.ramp.rim], kind: 'dot', born: [0, 2], life: [4, 8], speed: 3.2, layer: 'front', seed: seed + 5 }));
  if (N.press) pressBackground({ tick, ticks: N.press, k: 0.88, color: look.press });
  return { spikes: sp.count, spikeLen: sp.lengths(), press: N.press };
}
