import type { MoveId } from '../../data/moves/base';
import {
  BLOOM_CUTS, BLOOMS, cutAngle, OSCAR_CUTS, PETALS, SKILL1_CUT, SKILL1_MID, superCutCount, superCuts, type Cut,
} from '../../data/poses/oscar/slashes';
import { cineScenes, movesOf, type Fighter, type SimEvent, type SimState } from '../../sim';
import { motionFrames } from '../../sim/frames';
import { nearestShadow, SHADOW_LIFE, SHADOW_MAX, shadowCount, shadowsOf, SKILL2_WARP, superAnchor } from '../../sim/chars/oscar';
import { GROUND } from '../../stage/citadel';
import dashBlink from '../../vfx/dash-blink';
import oscarBloom from '../../vfx/oscar-bloom';
import oscarCut from '../../vfx/oscar-cut';
import oscarDomain from '../../vfx/oscar-domain';
import oscarMark from '../../vfx/oscar-mark';
import oscarShadows from '../../vfx/oscar-shadows';
import oscarSlit from '../../vfx/oscar-slit';
import oscarStep from '../../vfx/oscar-step';
import type { Frame, Layer } from '../../vfx/impact';
import { put } from '../../vfx/oscar-px';
import { lights } from '../light';
import { COLORS, type ColorName } from '../palette';
import { addShear, rainHold, tint } from '../screenfx';
import { FX_PX, fxColor, fxRamp } from '../vfx';
import type { CharFx, CharRender, HudSlot } from '.';

/*
 * 오스카 고유 연출 (렌더 전용, 캐릭터 기획서 13장): 대표 색은 은빛 달빛·핏빛 달·짙은 바다. 노란색 없음.
 * - 베기의 문법 (13-0): 칼날이 비치는 1틱 반짝 → 긴 선이 한 번에 (vfx/oscar-cut) → 선을 따라 화면이 1~2px 어긋났다 붙는다
 *   (render/screenfx 어긋남) → 상대는 3틱 늦게 맞는다 (sim) → 선이 가운데부터 가루로 → 그 자리에 검영. 공통 맞힘 불꽃은 쓰지 않는다
 * - 검영 (13-1): 얇은 은빛 선 조각 (vfx/oscar-shadows). 스킬 2가 고를 검영은 한 번 맥동한다
 * - 스킬 1 (13-3) 표식 점선·진공 (vfx/oscar-mark), 스킬 2 (13-4) 세로 틈 (vfx/oscar-slit), 차지 (13-5) 검영 꽃 (vfx/oscar-bloom)
 * - 등장 (13-6): 허공에 세로 선 → 틈 → 걸어 나와 납도 (vfx/oscar-slit)
 * - 필살기 월령수류 (13-7): 영역 전개 (vfx/oscar-domain) + 화면 물들이기·비 멈춤·화면 조각 어긋남 (render/screenfx)
 */

/** 은빛 달빛 계단 (흰 → 달빛 → 짙은 바다): 대시 그림자 잔상·기력 오라 */
export const MOON_RAMP: readonly ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark', 'deepSeaLight', 'deepSea', 'blackSuitDark'];
/** 베기 선·검영·꽃 (흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은, 짙은 바다) */
const SLASH_RAMP: readonly ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark', 'deepSeaLight', 'deepSea'];
/** 틈 (흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은, 짙은 바다, 틈 속 어둠) */
const SLIT_RAMP: readonly ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark', 'deepSeaLight', 'deepSea', 'night'];
/** 표식 (흰, 달빛 밝은, 달빛, 달빛 어두운, 빗방울) */
const MARK_RAMP: readonly ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark', 'blackSuitLight'];

/** 스킬 1: 표식이 뜬 뒤 실선이 되는 틱 (기술 데이터의 판정 시작) */
const markTicks = (): number => movesOf('oscar').skill1.activeStart;
/** 등장 틈 자리: 발밑에서 뒤로 20px (등장 동작 첫 프레임의 엉덩이 자리) */
const SLIT_BACK = 20;
/** 필살기 콘티: 전체 판 장면 길이와 연출 뒤 달빛이 걷히는 틱 */
const DOMAIN_END = 220;
const DOMAIN_FADE = 80;

const feetPx = (f: Fighter): [number, number] => [f.x / 256, GROUND + f.y / 256];

/** 선 하나를 월드 px로 (발밑 (fx, fy) 기준, 바라보는 쪽으로 뒤집고, 땅 밑으로 넘는 곳은 자른다) */
function worldCut(c: Cut, facing: number, fx: number, fy: number): [number, number, number, number] {
  let [x0, y0, x1, y1] = [fx + facing * c[0], fy + c[1], fx + facing * c[2], fy + c[3]];
  if (y0 > GROUND && y1 > GROUND) return [x0, GROUND, x1, GROUND];
  if (y1 > GROUND) {
    const k = (GROUND - y0) / (y1 - y0);
    [x1, y1] = [x0 + (x1 - x0) * k, GROUND];
  } else if (y0 > GROUND) {
    const k = (GROUND - y1) / (y0 - y1);
    [x0, y0] = [x1 + (x0 - x1) * k, GROUND];
  }
  return [x0, y0, x1, y1];
}

/** 선을 따라 화면이 어긋났다 다시 붙는다 (13-0: 1~10틱, 선 양옆이 선 방향으로 반대로 1px씩). heavy면 한쪽이 2px */
function shearCut(s: SimState, l: readonly [number, number, number, number], heavy = false): void {
  const len = Math.hypot(l[2] - l[0], l[3] - l[1]);
  addShear({
    x0: l[0], y0: l[1], x1: l[2], y1: l[3], at: s.tick, life: 11, reach: Math.max(16, Math.round(len / 3)),
    shift: (age) => (age >= 1 && age <= 9 ? (heavy && age <= 6 ? [2, -1] : [1, -1]) : [0, 0]),
  });
}

/** 검영이 누운 기울기 (도, 화면 좌표): 남긴 선의 기울기, 왼쪽을 보고 벴으면 좌우를 뒤집는다 */
function shadowAngle(kind: string, facing: number): number {
  const a = cutAngle(kind);
  return facing > 0 ? a : 180 - a;
}

/** 칼자루의 작은 은빛 반짝 (1~2틱, 칼날이 비치는 순간·납도하는 순간) */
function hiltGlint(x: number, y: number, ramp: readonly number[]) {
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= 3;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'front') return;
      const k = t * 60;
      put(f, x, y, ramp[0]!);
      if (k < 2) {
        put(f, x + 1, y, ramp[1]!);
        put(f, x - 1, y, ramp[1]!);
        put(f, x, y - 1, ramp[2]!);
      }
    },
  };
}

/** 원래 자리에 남는 검은 잔상 (실루엣을 어둠 한 색으로, life틱 동안 성기게 사라진다) */
function darkGhost(sil: { x: number; y: number; w: number; h: number; data: Uint32Array }, color: number, life: number) {
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'back') return;
      const k = (t * 60) / life;
      for (let y = 0; y < sil.h; y++) {
        for (let x = 0; x < sil.w; x++) {
          if (!(sil.data[y * sil.w + x]! >>> 24)) continue;
          if (k > 0.4 && ((x + y + Math.floor(t * 60)) % 4) < (k - 0.4) * 7) continue;
          put(f, sil.x + x, sil.y + y, color);
        }
      }
    },
  };
}

/** 두 자리를 잇는 은빛 직선 (1틱, 다음 틱은 옅게) */
function linkLine(x0: number, y0: number, x1: number, y1: number, ramp: readonly number[]) {
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= 2;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'front') return;
      const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let s = 0; s <= n; s++) {
        if (t * 60 >= 1 && s % 2) continue;
        put(f, x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, t * 60 < 1 ? ramp[0]! : ramp[2]!);
      }
    },
  };
}

/** 쓴 검영: 은빛으로 한 번 튀고(2틱) 가루로 부서진다 */
function shadowBreak(x: number, y: number, ramp: readonly number[], seed: number) {
  let t = 0;
  const bits = Array.from({ length: 10 }, (_, k) => ({ a: (k / 10) * Math.PI * 2 + seed * 0.37, v: 0.6 + ((k * 7 + seed) % 5) * 0.15 }));
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= 14;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'front') return;
      const k = t * 60;
      if (k < 2) for (let q = -10; q <= 10; q++) put(f, x + q, y - (k < 1 ? 1 : 0), k < 1 ? ramp[0]! : ramp[1]!);
      else
        for (const b of bits) {
          const r = (k - 2) * b.v;
          if (k > 9 && Math.floor(k + b.a * 3) % 2) continue;
          put(f, x + Math.cos(b.a) * r * 1.6, y + Math.sin(b.a) * r * 0.6 + (k - 2) * 0.3, k < 8 ? ramp[2]! : ramp[3]!);
        }
    },
  };
}

/** 사람마다 렌더 상태 */
interface Slot {
  /** 검영 그림 (계속 살아 있는 이펙트 하나): 마지막으로 살아 있음을 알린 틱, 그리는 사람 */
  seen: number;
  who: Fighter | null;
  /** 검영 칸마다 맥동이 끝나는 틱 */
  pulse: number[];
  /** 스킬 2가 지금 고를 검영 (바뀌면 한 번 맥동) */
  cand: number;
  /** 필살기 영역: 콘티 시계 D (없으면 -1), 켜짐, 연출이 끝난 틱, 짧은 판, 달 자리, 선, 어긋남을 건 연출 */
  D: number;
  domainOn: boolean;
  endTick: number;
  short: boolean;
  moonX: number;
  moonY: number;
  lines: Array<[number, number, number, number]>;
  sliced: boolean;
  /** 영역 그림 (2D 겹의 흰 화면을 그리려고 잡아 둔다) */
  domainFx: ReturnType<typeof oscarDomain> | null;
  /** 스킬 2 틈 빛 (월드 자리, 끝 틱) */
  slitLight: { x: number; y: number; until: number };
}
const slots: Slot[] = [0, 1].map(() => ({
  seen: -99, who: null, pulse: [0, 0, 0, 0, 0], cand: -1, D: -1, domainOn: false, endTick: -1, short: false, moonX: 0, moonY: 0, lines: [],
  sliced: false, domainFx: null, slitLight: { x: 0, y: 0, until: -1 },
}));
let nowTick = 0;

/** 이 사람이 차지를 모으는 중이거나, 떼고 아직 펼치기 전인가 (꽃이 살아 있는 동안) */
const blooming = (f: Fighter): boolean => {
  if (f.mode === 'charge') return true;
  if (f.mode !== 'attack' || f.move !== 'charge') return false;
  return f.t < movesOf(f.char).charge.activeStart;
};

/** 땅이나 발판에 서 있는가 */
const grounded = (f: Fighter): boolean => f.y === f.floor || f.y === 0;

/** 필살기 콘티 시계 D: 연출 중이면 장면 길이를 더해 (짧은 판은 첫 장면을 콘티 110틱으로 늘려 센다), 연출 뒤에는 끝난 틱부터 */
function domainClock(s: SimState, i: number, sl: Slot): number {
  const c = s.cine;
  if (c && c.who === i && c.move === 'super') {
    const sc = cineScenes(s);
    let T = c.t;
    for (let k = 0; k < c.scene; k++) T += motionFrames(sc[k]!.a.motion).total;
    if (!c.short) return T;
    const first = motionFrames(sc[0]!.a.motion).total;
    return T < first ? (T * 110) / first : T - first + 110;
  }
  if (sl.endTick >= 0) {
    const D = DOMAIN_END + (s.tick - sl.endTick);
    return D < DOMAIN_END + DOMAIN_FADE ? D : -1;
  }
  return -1;
}

/** 필살기 영역의 화면 효과 (틱마다): 핏빛 물들이기, 비 멈춤 */
function domainScreen(D: number): void {
  const k = D < 40 ? D / 40 : D < 130 ? 1 : D < 150 ? 0.5 : D < DOMAIN_END ? 0.45 : 0.45 * Math.max(0, 1 - (D - DOMAIN_END) / DOMAIN_FADE);
  tint.k = k;
  tint.shadow = COLORS.bloodMoonDark;
  tint.high = COLORS.bloodMoon;
  tint.ambient = COLORS.bloodMoonDark;
  tint.sat = 1.1;
  // 영역이 무대를 덮는 동안 (D 8~150) 덮인 광원의 빛 무리를 끈다
  tint.halo = D >= 8 && D < 150 ? 0 : 1;
  rainHold.on = D >= 30 && D < DOMAIN_END + 24;
}

/**
 * 색이 돌아오는 순간 (D 150): 화면 전체가 선을 따라 조각조각 어긋난다. 선마다 한쪽 조각이 선을 따라 1~2px 미끄러져 내려앉아 있다가 (D 150~220),
 * '탁'에 한 번 크게(4px) 무너지고 먼지 속에 걷힌다 (실제 파괴는 sim). 조각은 통째로 옮긴다 (선이 화면 끝까지라 한쪽 반 화면 전체)
 */
function sliceWorld(s: SimState, sl: Slot): void {
  const at = s.tick;
  sl.lines.forEach((l, k) => {
    // 선마다 어느 쪽 조각이 미끄러질지 번갈아 (한쪽으로만 쌓여 화면 전체가 흘러내리지 않게)
    const dir = k % 2 ? l : ([l[2], l[3], l[0], l[1]] as [number, number, number, number]);
    addShear({
      x0: dir[0], y0: dir[1], x1: dir[2], y1: dir[3], at, life: DOMAIN_END - 150 + 14, reach: 0, endless: true,
      shift: (age) => {
        const D = 150 + age;
        const slide = D < 200 ? 1 + (D - 150) / 50 : D < DOMAIN_END ? 2 : D < DOMAIN_END + 4 ? 4 : Math.max(0, 4 - (D - DOMAIN_END - 4) * 0.5);
        return [slide, 0];
      },
    });
  });
}

/** 사건 하나 (오스카 쪽) */
function onEvent(c: CharFx, s: SimState, e: SimEvent, i: number): void {
  if (e.who !== i) return;
  const f = s.fighters[i]!;
  if (f.char !== 'oscar') return;
  const sl = slots[i]!;
  const wx = e.x / 256;
  const wy = GROUND + e.y / 256;
  const ramp = fxRamp(SLASH_RAMP);
  const fighter = f;
  const held = () => fighter.hitstop > 0;
  if (e.type === 'char' && e.text === 'cut' && e.move === 'skill1') {
    // 월하참뢰검: 점선이 한 번에 실선으로 (120px), 화면이 선을 따라 어긋난다
    const l = worldCut(SKILL1_CUT, f.facing, wx, wy - SKILL1_MID);
    c.layer.add(oscarCut({ lines: [l], ramp, seed: c.seed(), held }));
    shearCut(s, l, true);
    c.glow((l[0] + l[2]) / 2, (l[1] + l[3]) / 2, 90, COLORS.moonLight, 0.9, 10);
    c.fx.shake(0.15);
  } else if (e.type === 'char' && e.text === 'cut' && e.move && OSCAR_CUTS[e.move]) {
    // 평타: 앞 허공에 긴 선이 한 번에, 선마다 화면 어긋남
    const id = e.move;
    const lines = OSCAR_CUTS[id]!.map((cut) => worldCut(cut, f.facing, wx, wy));
    c.layer.add(oscarCut({ lines, ramp, seed: c.seed(), held }));
    const heavy = id === 'atk4' || id === 'slam' || id === 'launcher';
    for (const l of lines) shearCut(s, l, heavy);
    const m = lines[0]!;
    c.glow((m[0] + m[2]) / 2, (m[1] + m[3]) / 2, heavy ? 80 : 56, COLORS.moonLight, heavy ? 0.85 : 0.65, heavy ? 10 : 7);
    if (id === 'atk4') c.fx.shake(0.12);
    // 내려찍기·쓸기: 선이 닿은 바닥이 갈라진다 (낮은 먼지)
    if (id === 'slam' || id === 'sweep') {
      const gx = id === 'slam' ? m[2] : (m[0] + m[2]) / 2;
      c.debris.dustCloud(gx - (id === 'sweep' ? 40 : 8), gx + (id === 'sweep' ? 40 : 8), 0.25);
    }
  } else if (e.type === 'char' && e.text === 'mark') {
    // 월하참뢰검 표식: 앞으로 그어질 선이 점선으로, 빗방울이 빨려 들고, 선을 따라 공기가 일렁인다 (1px 흔들림)
    const l = worldCut(SKILL1_CUT, f.facing, wx, wy - SKILL1_MID);
    const cut = markTicks();
    c.layer.add(oscarMark({ line: l, cut, ramp: fxRamp(MARK_RAMP), seed: c.seed() }));
    addShear({
      x0: l[0], y0: l[1], x1: l[2], y1: l[3], at: s.tick, life: cut, reach: 6,
      shift: (age) => (age > 2 && (age >> 1) % 2 === 0 ? [1, 0] : [0, age > 2 ? -1 : 0]),
    });
    // 진공이 터지는 순간 둘레가 한 번 크게 어긋난다
    addShear({
      x0: l[0], y0: l[1], x1: l[2], y1: l[3], at: s.tick + cut + 10, life: 4, reach: 28,
      shift: (age) => (age < 3 ? [-1, 1] : [0, 0]),
    });
  } else if (e.type === 'char' && e.text === 'pick') {
    // 월하윤회궤: 갈 검영이 0~4틱 밝게 맥동한다. 땅에서 쓰면 앞 허공에 세로 틈이 열린다 (4~8틱, 9틱째 사라진다)
    sl.pulse[e.combo ?? 0] = s.tick + 6;
    if (grounded(f)) {
      const [fx, fy] = feetPx(f);
      const x = fx + f.facing * 10;
      c.layer.add(oscarSlit({ x, y: fy, h: 54, w: 5, open: 4, opened: 6, close: 9, closed: 11, gone: 17, ramp: fxRamp(SLIT_RAMP), seed: c.seed() }));
      sl.slitLight = { x, y: fy - 27, until: s.tick + 11 };
    }
  } else if (e.type === 'char' && e.text === 'warp') {
    const tx = (e.to ?? e.x) / 256;
    const high = e.heavy === true && (e.combo ?? 0) !== 0;
    const ty = GROUND + (e.combo ?? 0) / 256;
    if (!e.heavy) {
      // 검영이 없다: 뒤로 그림자 걸음 (잔상)
      const sil = c.silhouetteAt('oscar/skill2', 4, f.facing, c.skinOf(f), wx, wy);
      c.layer.add(dashBlink({
        kind: 'blink', actor: { feet: () => [wx * FX_PX, wy * FX_PX], silhouette: () => sil }, to: tx * FX_PX,
        colors: fxRamp(MOON_RAMP), seed: c.seed(), shake: (k) => c.fx.shake(k * 0.3),
        blinkTimes: { out: 0.02, in: 0.02, arrive: 0.05, linger: 0.4 }, ghostSolid: true,
      }));
      return;
    }
    // 원래 자리에 검은 잔상 하나, 두 자리를 은빛 직선이 1틱 잇고, 검영 자리의 틈에서 걸어 나온다 (공중이면 틈 없이 검영을 밟는다)
    const sil = c.silhouetteAt('oscar/skill2', 4, f.facing, c.skinOf(f), wx, wy);
    c.layer.add(darkGhost(sil, fxColor('night'), 12));
    c.layer.add(linkLine(wx, wy - 26, tx, (high ? ty : GROUND) - 26, ramp));
    if (!high) {
      c.layer.add(oscarSlit({ x: tx - f.facing * 4, y: GROUND, h: 54, w: 5, open: 0, opened: 2, close: 6, closed: 8, gone: 14, ramp: fxRamp(SLIT_RAMP), seed: c.seed() }));
      sl.slitLight = { x: tx, y: GROUND - 27, until: s.tick + 8 };
    }
    // 쓴 검영은 은빛으로 한 번 튀고 가루로 부서진다
    c.layer.add(shadowBreak(tx, high ? ty : GROUND - 30, ramp, c.seed()));
    c.glow(tx, (high ? ty : GROUND) - 24, 60, COLORS.moonLight, 0.8, 8);
  } else if (e.type === 'charge' && (e.text === 'start' || e.text === 'level')) {
    // 만검지화: 단계마다 앞 허공에 검영 꽃이 하나 핀다
    const k = Math.max(1, Math.min(BLOOMS.length, e.combo ?? 1)) - 1;
    const [bx, by] = BLOOMS[k]!;
    const [fx, fy] = feetPx(f);
    c.layer.add(oscarBloom({ x: fx + f.facing * bx, y: fy + by, facing: f.facing, petals: PETALS[k]!, alive: () => blooming(fighter), ramp }));
    c.glow(fx + f.facing * bx, fy + by, 40, COLORS.moonLight, 0.7, 8);
  } else if (e.type === 'char' && e.text === 'bloomcut') {
    // 꽃들이 한꺼번에 긴 선 다발로 펼쳐진다: 여러 방향으로 화면이 어긋난다
    const n = e.combo ?? 1;
    const lines: Array<[number, number, number, number]> = [];
    for (let k = 0; k < n; k++) {
      const [bx, by] = BLOOMS[k]!;
      for (const cut of BLOOM_CUTS[k]!) lines.push(worldCut(cut, f.facing, wx + f.facing * bx, wy + by));
      c.glow(wx + f.facing * bx, wy + by, 70, COLORS.moonLight, 0.9, 10);
    }
    c.layer.add(oscarCut({ lines, ramp, seed: c.seed(), held }));
    for (const l of lines) shearCut(s, l, true);
    c.fx.shake(0.12 + 0.06 * n);
  } else if (e.type === 'cine' && e.move === 'super') {
    const d = s.fighters[1 - i]!;
    if (e.text === 'start') {
      // 영역 전개: 달은 두 사람 사이 위로, 선은 상대 발밑 기준 (sim과 같은 선)
      const ax = superAnchor(d) / 256;
      const n = shadowCount(f);
      sl.lines = superCuts(superCutCount(n)).map(([x0, y0, x1, y1]) => [ax + x0, GROUND + y0, ax + x1, GROUND + y1]);
      sl.moonX = (f.x / 256 + ax) / 2;
      sl.moonY = GROUND - 120;
      sl.domainOn = true;
      sl.endTick = -1;
      sl.sliced = false;
      sl.D = 0;
      sl.short = s.cine?.short ?? false;
      const shadows = shadowsOf(f).map((sh) => ({ x: sh.x / 256, y: GROUND + sh.y / 256, ang: shadowAngle(sh.kind, sh.facing) }));
      const slot = sl;
      sl.domainFx = oscarDomain({
        clock: () => slot.D,
        ground: GROUND,
        moonX: sl.moonX,
        oscar: () => feetPx(fighter),
        shadows,
        lines: sl.lines,
        colors: {
          ink: fxColor('ink'), night: fxColor('night'), cloud: fxColor('blackSuitDark'), cloudLit: fxColor('bloodMoonDark'),
          bloodDark: fxColor('bloodMoonDark'), blood: fxColor('bloodMoon'), sea: fxColor('deepSea'), seaLight: fxColor('deepSeaLight'),
          white: fxColor('fxWhite'), moonLight: fxColor('moonLight'), moon: fxColor('moon'), moonDark: fxColor('moonDark'),
        },
        whiteHex: COLORS.fxWhite,
        inkHex: COLORS.ink,
        seed: c.seed(),
      });
      c.layer.add(sl.domainFx);
    } else if (e.text === 'end') {
      // '탁': 어긋났던 조각들이 한꺼번에 무너진다 (실제 파괴는 sim). 선을 따라 먼지가 일고 화면이 크게 흔들린다
      sl.endTick = s.tick;
      c.fx.shake(0.7);
      const ax = superAnchor(d) / 256;
      c.debris.dustCloud(ax - 240, ax + 240, 0.9);
      c.glow(d.x / 256, GROUND + d.y / 256 - 30, 160, COLORS.moonLight, 1, 16);
    }
  }
}

export const OSCAR_RENDER: CharRender = {
  ramp: MOON_RAMP,
  light: COLORS.moonLight,
  ownSpark: true,
  // 등장은 허공을 베고 나온다 (기본 '내려선 자리 충격·먼지'를 쓰지 않는다). 틈이 열리는 동안(36틱)은 몸을 숨긴다
  ownIntro: true,
  introHidden: (f) => f.t < 36,
  // 월하윤회궤: 틈 속에 사라진 동안 (8~10틱)
  hidden: (_s, f) => f.mode === 'attack' && f.move === 'skill2' && f.t >= SKILL2_WARP - 1 && f.t < SKILL2_WARP + 1,

  event: onEvent,

  /** 월령수류 백색: 화면 전체 흰색과 먹빛 선 (무대 앞 물건까지 덮는다) */
  overlay(ctx: CanvasRenderingContext2D, _s: SimState, _f: Fighter, i: number, cam: { x: number; y: number }) {
    const sl = slots[i]!;
    if (sl.domainOn && sl.domainFx) sl.domainFx.overlay(ctx, cam);
  },

  strike(c: CharFx, _s: SimState, f: Fighter, _i: number, id: MoveId) {
    // 칼날이 비치는 순간: 칼자루에 작은 은빛 반짝 (1~2틱). 선은 sim 'cut' 사건이 그린다
    if (id === 'super' || id === 'skill2') return;
    const [fx, fy] = feetPx(f);
    c.layer.add(hiltGlint(fx + f.facing * 7, fy - 25, fxRamp(SLASH_RAMP)));
  },

  tick(c: CharFx, s: SimState, f: Fighter, i: number) {
    nowTick = s.tick;
    const sl = slots[i]!;
    sl.who = f;
    // 필살기 영역 시계와 화면 효과 (끝나면 화면 효과를 끈다)
    if (sl.domainOn) {
      sl.D = domainClock(s, i, sl);
      if (sl.D < 0) {
        sl.domainOn = false;
        tint.k = 0;
        tint.halo = 1;
        rainHold.on = false;
      } else {
        domainScreen(sl.D);
        if (!sl.sliced && sl.D >= 150) {
          sl.sliced = true;
          sliceWorld(s, sl);
        }
      }
    }
    if (f.char !== 'oscar') return;
    // 스킬 2가 고를 검영: 기력이 1칸 넘게 있을 때, 고를 검영이 바뀌면 한 번 맥동한다
    if (f.meter >= 100 && f.mode !== 'cine') {
      const cand = nearestShadow(f, s.fighters[1 - i]!);
      if (cand !== sl.cand && cand >= 0) sl.pulse[cand] = Math.max(sl.pulse[cand]!, s.tick + 8);
      sl.cand = cand;
    } else sl.cand = -1;
    // 검영 그림: 라운드·경기가 바뀌어 이펙트 층이 비워졌으면 다시 띄운다
    if (s.tick - sl.seen > 2) {
      sl.seen = s.tick;
      c.layer.add(oscarShadows({
        shadows: () => {
          const w = sl.who;
          if (!w || w.char !== 'oscar' || (sl.domainOn && sl.D >= 70)) return null;
          return shadowsOf(w).map((sh) => ({ x: sh.x / 256, y: GROUND + sh.y / 256, life: sh.life, ang: shadowAngle(sh.kind, sh.facing), slot: sh.slot }));
        },
        full: SHADOW_LIFE,
        pulse: (slot) => {
          const left = sl.pulse[slot]! - nowTick;
          return left > 0 ? Math.min(1, left / 4) : 0;
        },
        ramp: fxRamp(SLASH_RAMP),
        onTick: () => {
          sl.seen = nowTick;
        },
      }));
    }
    // 등장: 첫 틱에 허공에 세로 선 → 16~36 틈이 열림 → 70~80 닫힘 → 110까지 가루로
    if (f.mode === 'intro' && f.t === 1) {
      const [x, y] = feetPx(f);
      const sx = x - f.facing * SLIT_BACK;
      c.layer.add(oscarSlit({ x: sx, y: y - 4, h: 64, w: 12, open: 16, opened: 36, close: 70, closed: 80, gone: 110, ramp: fxRamp(SLIT_RAMP), seed: c.seed() }));
      addShear({ x0: sx, y0: y - 68, x1: sx, y1: y - 4, at: s.tick, life: 12, reach: 20, shift: (age) => (age >= 1 && age <= 9 ? [1, -1] : [0, 0]) });
    }
    // 등장 '탁': 칼자루에 작은 은빛 반짝
    if (f.mode === 'intro' && f.t === 101) {
      const [x, y] = feetPx(f);
      c.layer.add(hiltGlint(x + f.facing * 7, y - 25, fxRamp(SLASH_RAMP)));
    }
    // 2단 점프: 발밑 허공에 검영이 생기고 밟혀 부서진다 (13-8 그대로)
    if (f.mode === 'air' && f.jumpKind === 2 && f.t === 1) {
      const [x, y] = feetPx(f);
      c.layer.add(oscarStep({ x: x * FX_PX, y: y * FX_PX, facing: f.facing, ramp: fxRamp(SLASH_RAMP) }));
      c.glow(x, y, 40, COLORS.moon, 0.7, 8);
    }
  },

  lights(s: SimState, f: Fighter, i: number) {
    const sl = slots[i]!;
    // 필살기 영역: 핏빛 달이 무대를 붉게 비춘다 (색이 돌아온 뒤에도 달빛이 남았다가 걷힌다)
    if (sl.domainOn && sl.D >= 0) {
      const D = sl.D;
      const k = D < 20 ? 0 : D < 70 ? (D - 20) / 50 : D < 130 ? 1 : D < 150 ? 0 : D < DOMAIN_END ? 0.4 : 0.4 * Math.max(0, 1 - (D - DOMAIN_END) / DOMAIN_FADE);
      if (k > 0) {
        lights.point(sl.moonX, sl.moonY, 150, COLORS.bloodMoon, 0.5 * k);
        lights.point(sl.moonX, GROUND - 16, 110, COLORS.bloodMoon, 0.35 * k);
      }
      // 검영이 도는 동안 오스카 둘레 은빛
      if (D >= 70 && D < 130) {
        const [x, y] = feetPx(f);
        lights.point(x, y - 30, 60, COLORS.moonLight, 0.5);
      }
    }
    // 차지를 모으는 동안: 피어 있는 꽃이 차갑게 빛난다
    if (f.mode === 'charge') {
      const [fx, fy] = feetPx(f);
      const n = Math.max(1, Math.min(BLOOMS.length, f.chargeLv));
      for (let k = 0; k < n; k++) {
        const [bx, by] = BLOOMS[k]!;
        lights.point(fx + f.facing * bx, fy + by, 34, COLORS.moonLight, 0.35);
      }
    }
    // 등장 틈이 열려 있는 동안: 틈에서 달빛이 새어 나와 벽과 바닥을 비춘다
    if (f.mode === 'intro' && f.t >= 16 && f.t < 80) {
      const [x, y] = feetPx(f);
      const k = f.t < 36 ? (f.t - 16) / 20 : f.t > 70 ? (80 - f.t) / 10 : 1;
      lights.point(x - f.facing * SLIT_BACK, y - 36, 64, COLORS.moon, 0.55 * k);
    }
    // 월하윤회궤 틈
    if (s.tick < sl.slitLight.until) lights.point(sl.slitLight.x, sl.slitLight.y, 40, COLORS.moon, 0.45);
  },

  /** 이름 옆 검영 수: 칼 모양 5칸 (남은 검영만큼 달빛, 곧 사라질 것은 깜빡임) */
  hud(ctx: CanvasRenderingContext2D, s: SimState, f: Fighter, _i: number, slot: HudSlot) {
    const list = shadowsOf(f);
    const x0 = slot.left ? slot.nameEdge + 4 : slot.nameEdge - 4 - SHADOW_MAX * 5;
    for (let k = 0; k < SHADOW_MAX; k++) {
      const x = x0 + k * 5;
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(x - 1, 17, 4, 8);
      const sh = list[k];
      const on = !!sh && !(sh.life < 60 && (s.tick >> 2) & 1);
      ctx.fillStyle = on ? COLORS.moonLight : COLORS.panel;
      // 칼날 (세로 1px × 5) + 날밑 (가로 3px)
      ctx.fillRect(x + 1, 18, 1, 5);
      ctx.fillStyle = on ? COLORS.moon : COLORS.panel;
      ctx.fillRect(x, 22, 3, 1);
    }
  },
};
