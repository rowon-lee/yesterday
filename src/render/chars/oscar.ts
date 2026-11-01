import type { TrailBox } from '../../data/moves/base';
import { OSCAR_SLASHES, slashAngle, type SlashLine } from '../../data/poses/oscar/slashes';
import { movesOf, type Fighter, type SimEvent, type SimState } from '../../sim';
import { BLOOM_BOX, CHARGE_BLOOMS, SHADOW_LIFE, SHADOW_MAX, shadowCount, shadowsOf, SKILL1_BOX } from '../../sim/chars/oscar';
import { GROUND } from '../../stage/citadel';
import dashBlink from '../../vfx/dash-blink';
import oscarBloom from '../../vfx/oscar-bloom';
import oscarMark from '../../vfx/oscar-mark';
import oscarMoon from '../../vfx/oscar-moon';
import oscarRift from '../../vfx/oscar-rift';
import oscarWhite from '../../vfx/oscar-white';
import oscarShadows from '../../vfx/oscar-shadows';
import oscarSlash from '../../vfx/oscar-slash';
import oscarStep from '../../vfx/oscar-step';
import { lights } from '../light';
import { COLORS, type ColorName } from '../palette';
import { FX_PX, fxRamp } from '../vfx';
import type { CharFx, CharRender, HudSlot } from '.';

/*
 * 오스카 고유 연출 (렌더 전용): 대표 색은 은빛 달빛·핏빛 달·짙은 바다.
 * - 평타: 앞 허공에 은빛 검격 선이 생겨났다 베이고 사라진다 (vfx/oscar-slash, 모양은 data/poses/oscar/slashes)
 * - 고유 특성 검영: 베인 자리마다 은빛 칼 그림자가 남는다 (vfx/oscar-shadows, 자리는 sim 상태). HUD 이름 옆에 검영 수
 * - 등장: 허공에 은빛 선 → 공간이 잘려 열림 → 걸어 나옴 → 틈이 닫힘 (vfx/oscar-rift)
 * - 2단 점프: 발밑 허공에 생긴 검영을 밟고 뛴다 (vfx/oscar-step)
 * - 대시(월영)·기력 오라·맞힘 불꽃은 은빛·짙은 바다 계단 (ramp)
 */

/** 은빛 달빛 계단 (흰 → 달빛 → 짙은 바다): 대시 그림자 잔상·맞힘 불꽃·기력 오라 */
export const MOON_RAMP: readonly ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark', 'deepSeaLight', 'deepSea', 'blackSuitDark'];
/** 틈 (흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다, 틈 속 어둠) */
const RIFT_RAMP: readonly ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark', 'deepSea', 'night'];
/** 검격·검영 (흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은, 짙은 바다) */
const SLASH_RAMP: readonly ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark', 'deepSeaLight', 'deepSea'];

/** 핏빛 달·물결 (핏빛 달, 어두운 핏빛, 달빛 밝은, 달빛, 짙은 바다 밝은, 짙은 바다) */
const MOON_SCENE: readonly ColorName[] = ['bloodMoon', 'bloodMoonDark', 'moonLight', 'moon', 'deepSeaLight', 'deepSea'];
/** 흰 화면 (흰, 먹, 달빛 밝은, 달빛, 달빛 어두운) */
const WHITE_RAMP: readonly ColorName[] = ['fxWhite', 'ink', 'moonLight', 'moon', 'moonDark'];
/** 스킬 1 표식이 떠 있는 틱 (sim: 표식 → 벰까지) */
const MARK_TICKS = 23;
/** 필살기 연출 길이 (장면 1~3 표시 틱 합) */
const SUPER_TICKS = 48 + 36 + 62;

/** 등장 틈 자리: 발밑에서 뒤로 18px (등장 동작 첫 프레임의 엉덩이 자리) */
const RIFT_BACK = 18;

function feetPx(f: Fighter): [number, number] {
  return [f.x / 256, GROUND + f.y / 256];
}

/** 검격 선들을 월드 2단위 좌표로: 궤적 상자 안 비율 좌표 → 발밑 기준 px → 바라보는 쪽으로 뒤집어 월드 */
export function slashWorld(f: Fighter, box: TrailBox, pattern: readonly SlashLine[], ox = 0, oy = 0): Array<[number, number, number, number, number]> {
  const [fx, fy] = feetPx(f);
  return pattern.map(([u0, v0, u1, v1, d]) => {
    const x0 = box.x + u0 * box.w;
    const y0 = box.y + v0 * box.h;
    const x1 = box.x + u1 * box.w;
    const y1 = box.y + v1 * box.h;
    return [(fx + ox + f.facing * x0) * FX_PX, (fy + oy + y0) * FX_PX, (fx + ox + f.facing * x1) * FX_PX, (fy + oy + y1) * FX_PX, d];
  });
}

/** 검영이 누운 기울기 (도, 화면 좌표): 남긴 검격의 주된 베기 기울기, 왼쪽을 보고 벴으면 좌우를 뒤집는다 */
function shadowAngle(kind: string, facing: number): number {
  const box = kind === 'skill1' ? SKILL1_BOX : kind === 'bloom' ? { w: BLOOM_BOX, h: BLOOM_BOX } : movesOf('oscar')[kind as 'atk1']?.data.box;
  const a = box ? slashAngle(kind, box.w, box.h) : 0;
  return facing > 0 ? a : 180 - a;
}

/** 사람마다 검영 그림 (계속 살아 있는 이펙트 하나): 마지막으로 살아 있음을 알린 틱, 그리는 사람 */
const field: Array<{ seen: number; who: Fighter | null }> = [
  { seen: -99, who: null },
  { seen: -99, who: null },
];
let nowTick = 0;
/** 필살기 연출이 시작된 틱과 발동자 (달빛 무대 조명용) */
const superAt: Array<{ tick: number; x: number; y: number }> = [
  { tick: -999, x: 0, y: 0 },
  { tick: -999, x: 0, y: 0 },
];

/** 이 사람이 차지를 모으는 중이거나, 떼고 아직 베기 전인가 (만개한 검영이 살아 있는 동안) */
const blooming = (f: Fighter): boolean => {
  if (f.mode === 'charge') return true;
  if (f.mode !== 'attack' || f.move !== 'charge') return false;
  return f.t < movesOf(f.char).charge.activeStart;
};

/** 사건 하나 (오스카 쪽): 표식·원격 베기·순간이동·만개·필살기 연출 */
function onEvent(c: CharFx, s: SimState, e: SimEvent, i: number): void {
  if (e.who !== i) return;
  const f = s.fighters[i]!;
  const wx = e.x / 256;
  const wy = GROUND + e.y / 256;
  if (e.type === 'char' && e.text === 'mark') {
    // 월하참뢰검 표식: 상대 몸 가운데에 은빛 고리와 진공 왜곡
    c.layer.add(oscarMark({ x: wx * FX_PX, y: (wy - SKILL1_BOX.h / 2) * FX_PX, life: MARK_TICKS, ramp: fxRamp(SLASH_RAMP) }));
  } else if (e.type === 'char' && e.text === 'cut') {
    // 표식 자리를 곧바로 벤다: X + 가로 세 줄 (굵게), 진공이 터지듯 흔들림
    const box: TrailBox = { x: -SKILL1_BOX.w / 2, y: -SKILL1_BOX.h, w: SKILL1_BOX.w, h: SKILL1_BOX.h, shape: 'line' };
    const lines = OSCAR_SLASHES.skill1!.map(([u0, v0, u1, v1, d]) => [
      (wx + box.x + u0 * box.w) * FX_PX, (wy + box.y + v0 * box.h) * FX_PX, (wx + box.x + u1 * box.w) * FX_PX, (wy + box.y + v1 * box.h) * FX_PX, d,
    ] as [number, number, number, number, number]);
    const fighter = f;
    c.layer.add(oscarSlash({ lines, ramp: fxRamp(SLASH_RAMP), seed: c.seed(), held: () => fighter.hitstop > 0, weight: 2 }));
    c.glow(wx, wy - SKILL1_BOX.h / 2, 90, COLORS.moonLight, 1, 12);
    c.fx.shake(0.25);
  } else if (e.type === 'char' && e.text === 'warp') {
    // 월하윤회: 떠난 자리에 그림자 잔상, 검영 자리에 나타난다
    const tx = (e.to ?? e.x) / 256;
    const ty = GROUND + (e.combo ?? 0) / 256;
    const sil = c.silhouetteAt('oscar/skill2', 2, f.facing, c.skinOf(f), wx, wy);
    c.layer.add(dashBlink({
      kind: 'blink',
      actor: { feet: () => [wx * FX_PX, wy * FX_PX], silhouette: () => sil },
      to: tx * FX_PX,
      colors: fxRamp(MOON_RAMP),
      seed: c.seed(),
      shake: (k) => c.fx.shake(k * 0.4),
      blinkTimes: { out: 0.02, in: 0.02, arrive: 0.05, linger: 0.45 },
      ghostSolid: true,
    }));
    c.glow(wx, wy - 24, 60, COLORS.deepSeaLight, 0.8, 10);
    c.glow(tx, ty - 24, 70, COLORS.moonLight, 0.9, 10);
  } else if (e.type === 'charge' && (e.text === 'start' || e.text === 'level')) {
    // 만검지화: 단계마다 앞 허공에 검영 하나가 만개한다
    const k = Math.max(1, Math.min(CHARGE_BLOOMS.length, e.combo ?? 1)) - 1;
    const [bx, by] = CHARGE_BLOOMS[k]!;
    const [fx, fy] = feetPx(f);
    const fighter = f;
    c.layer.add(oscarBloom({ x: (fx + f.facing * bx) * FX_PX, y: (fy + by) * FX_PX, alive: () => blooming(fighter), ramp: fxRamp(SLASH_RAMP), turn: k * 0.4 }));
    c.glow(fx + f.facing * bx, fy + by, 40, COLORS.moonLight, 0.8, 8);
  } else if (e.type === 'char' && e.text === 'bloomcut') {
    // 만개한 자리들이 한꺼번에 베인다
    const n = e.combo ?? 1;
    const [fx, fy] = feetPx(f);
    const fighter = f;
    for (let k = 0; k < n; k++) {
      const [bx, by] = CHARGE_BLOOMS[k]!;
      const box: TrailBox = { x: bx - BLOOM_BOX / 2, y: by - BLOOM_BOX / 2, w: BLOOM_BOX, h: BLOOM_BOX, shape: 'circle' };
      c.layer.add(oscarSlash({ lines: slashWorld(f, box, OSCAR_SLASHES.bloom!), ramp: fxRamp(SLASH_RAMP), seed: c.seed(), held: () => fighter.hitstop > 0, weight: 2 }));
      c.glow(fx + f.facing * bx, fy + by, 70, COLORS.moonLight, 1, 12);
    }
    c.fx.shake(0.15 + 0.08 * n);
  } else if (e.type === 'cine' && e.move === 'super' && f.char === 'oscar') {
    const d = s.fighters[1 - i]!;
    const [ax] = feetPx(f);
    const mid = (ax + d.x / 256) / 2;
    if (e.text === 'start') {
      // 장면 1: 핏빛 달과 물결 (연출 내내)
      superAt[i] = { tick: s.tick, x: mid, y: GROUND - 70 };
      c.layer.add(oscarMoon({ moonX: (mid + f.facing * 10) * FX_PX, moonY: (GROUND - 70) * FX_PX, waterX: (d.x / 256) * FX_PX, ground: GROUND * FX_PX, life: SUPER_TICKS + 10, ramp: fxRamp(MOON_SCENE) }));
    } else if (e.text === 'scene' && e.combo === 1) {
      // 장면 2: 칼자루에 손을 얹는 순간 화면이 하얗게, 무수한 검격 (남은 검영이 많을수록 많이)
      c.layer.add(oscarWhite({ x: mid * FX_PX, y: (GROUND - 40) * FX_PX, count: 12 + 6 * shadowCount(f), seed: c.seed(), ramp: fxRamp(WHITE_RAMP) }));
      c.fx.shake(0.4);
    } else if (e.text === 'end') {
      c.glow(d.x / 256, GROUND + d.y / 256 - 30, 140, COLORS.moonLight, 1, 20);
      c.fx.shake(0.5);
    }
  }
}

export const OSCAR_RENDER: CharRender = {
  ramp: MOON_RAMP,
  light: COLORS.moonLight,
  // 등장은 허공의 틈에서 걸어 나온다 (기본 '내려선 자리 충격·먼지'를 쓰지 않는다). 틈이 열리기 전 첫 두 틱은 몸을 숨긴다
  ownIntro: true,
  introHidden: (f) => f.t < 2,

  event: onEvent,

  strike(c: CharFx, _s: SimState, f: Fighter, _i: number, id) {
    const mv = movesOf(f.char)[id];
    const box = mv.data.box;
    const pattern = OSCAR_SLASHES[id];
    if (!box || !pattern || box.w <= 0) return;
    const fighter = f;
    const heavy = id === 'atk4' || id === 'air3' || id === 'launcher';
    c.layer.add(oscarSlash({ lines: slashWorld(f, box, pattern), ramp: fxRamp(SLASH_RAMP), seed: c.seed(), held: () => fighter.hitstop > 0, weight: heavy ? 2 : 1 }));
    // 차가운 빛: 검격 가운데에서 잠깐 (센 기술은 넓게)
    const [fx, fy] = feetPx(f);
    c.glow(fx + f.facing * (box.x + box.w / 2), fy + box.y + box.h / 2, heavy ? 80 : 54, COLORS.moonLight, heavy ? 0.9 : 0.7, heavy ? 12 : 8);
    if (heavy) c.fx.shake(0.12);
  },

  tick(c: CharFx, s: SimState, f: Fighter, i: number) {
    nowTick = s.tick;
    // 검영 그림: 라운드·경기가 바뀌어 이펙트 층이 비워졌으면 다시 띄운다
    const slot = field[i]!;
    slot.who = f;
    if (s.tick - slot.seen > 2) {
      slot.seen = s.tick;
      c.layer.add(oscarShadows({
        shadows: () => {
          const w = slot.who;
          if (!w || w.char !== 'oscar') return null;
          return shadowsOf(w).map((sh) => ({ x: sh.x / 256, y: GROUND + sh.y / 256, life: sh.life, ang: shadowAngle(sh.kind, sh.facing) }));
        },
        full: SHADOW_LIFE,
        ramp: fxRamp(SLASH_RAMP),
        onTick: () => {
          slot.seen = nowTick;
        },
      }));
    }
    // 등장: 첫 틱에 틈이 열리기 시작한다 (오스카는 그 속에서 걸어 나온다)
    if (f.mode === 'intro' && f.t === 1) {
      const [x, y] = feetPx(f);
      c.layer.add(oscarRift({ x: (x - f.facing * RIFT_BACK) * FX_PX, y: y * FX_PX, ramp: fxRamp(RIFT_RAMP), seed: c.seed() }));
      c.glow(x - f.facing * RIFT_BACK, y - 30, 70, COLORS.moonLight, 0.9, 8);
    }
    // 2단 점프: 발밑 허공에 검영이 생기고 밟혀 부서진다
    if (f.mode === 'air' && f.jumpKind === 2 && f.t === 1) {
      const [x, y] = feetPx(f);
      c.layer.add(oscarStep({ x: x * FX_PX, y: y * FX_PX, facing: f.facing, ramp: fxRamp(SLASH_RAMP) }));
      c.glow(x, y, 40, COLORS.moon, 0.7, 8);
    }
  },

  lights(s: SimState, f: Fighter, i: number) {
    // 필살기 연출 동안: 핏빛 달이 무대를 붉게 비춘다 (흰 화면이 걷힌 뒤에는 차가운 달빛)
    const sp = superAt[i]!;
    const age = s.tick - sp.tick;
    if (s.cine && s.cine.who === i && age >= 0 && age < SUPER_TICKS + 10) {
      const rise = Math.min(1, age / 30);
      lights.point(sp.x, sp.y, 260, age < 48 + 36 ? COLORS.bloodMoon : COLORS.moon, 0.55 * rise);
    }
    // 차지를 모으는 동안: 만개한 검영들이 차갑게 빛난다
    if (f.mode === 'charge') {
      const [fx, fy] = feetPx(f);
      const n = Math.max(1, Math.min(CHARGE_BLOOMS.length, f.chargeLv));
      for (let k = 0; k < n; k++) {
        const [bx, by] = CHARGE_BLOOMS[k]!;
        lights.point(fx + f.facing * bx, fy + by, 34, COLORS.moonLight, 0.35);
      }
    }
    // 등장 틈이 열려 있는 동안: 틈에서 차가운 달빛이 새어 나와 벽과 바닥을 비춘다
    if (f.mode === 'intro' && f.t < 56) {
      const [x, y] = feetPx(f);
      const k = f.t < 12 ? f.t / 12 : f.t > 44 ? (56 - f.t) / 12 : 1;
      lights.point(x - f.facing * RIFT_BACK, y - 30, 60, COLORS.moon, 0.55 * k);
    }
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
