import { HAMMER } from '../../anim/decor/edward';
import type { MoveId } from '../../data/moves/base';
import { EDWARD_INTRO_T } from '../../data/poses/edward/show';
import { BREAKABLES, movesOf, type Fighter } from '../../sim';
import { EX, SHELL_MAX } from '../../sim/chars/edward';
import { GROUND as GROUND_Y } from '../../stage/citadel';
import explosion from '../../vfx/explosion';
import glint from '../../vfx/glint';
import impact from '../../vfx/impact';
import powerUp from '../../vfx/power-up';
import { darkness, ghost, hammerArc, memories, shockwave, tether, veilRing, veilShell } from '../../vfx/edward-fx';
import { lights } from '../light';
import { COLORS, type ColorName } from '../palette';
import { fxColor, fxHex, fxRamp, FX_PX } from '../vfx';
import type { CharFx, CharRender } from '.';

/*
 * 에드워드 고유 연출 (렌더 전용, sim 상태를 읽기만 한다). 대표 색: 푸른 장막(이펙트·빛), 붉은 정장, 청동.
 * - 평타: 해머 머리가 지난 길을 따라 굵고 짧은 원호 (동작연출지침서 7장), 센 타격은 충격파·바닥 파편·흔들림
 * - 껍데기: 맞을 때마다 몸 윤곽에 푸른 장막이 비친다 (깨지면 조각), 체력바 위 푸른 게이지
 * - 재현:나: 푸른 오라와 반짝임, 강화된 평타는 푸른 잔상을 남긴다
 * - 염동력: 손과 상대를 잇는 푸른 궤적 (끌어당김·밀어냄), 으스러진 물건이 상대에게 날아간다
 * - 차지: 땅을 내리치면 충격파가 바닥을 타고 달린다
 * - 필살기: 화면이 어두워지고 기억 조각이 푸른 장막을 타고 빨려 든다, 끝에 껍데기가 차오른다
 * - 등장: 하늘에서 떨어져 해머와 함께 쿵 (바닥이 패이고 먼지·충격파, 껍데기가 비침). 착지할 때마다 바닥이 울린다
 */

/** 푸른 장막 계단 (흰 → 밝은 푸른 → 푸른 → 어두운 푸른 → 남색) */
export const VEIL: ColorName[] = ['fxWhite', 'veilLight', 'veil', 'veilDark', 'fxNavy'];
/** 바닥 파편 (돌·흙) */
const RUBBLE: ColorName[] = ['stone', 'stoneDark', 'sidewalk', 'curb'];

/** 해머 원호 굵기 (px) */
const ARC_W: Partial<Record<MoveId, number>> = {
  atk1: 9, atk2: 10, atk3: 11, atk4: 14, launcher: 12, sweep: 11, dashAttack: 13, air1: 9, air2: 10, air3: 12, slam: 13, charge: 16,
};
/** 센 타격 (흔들림·파편) */
const HEAVY: ReadonlySet<MoveId> = new Set(['atk4', 'launcher', 'dashAttack', 'slam', 'charge']);

/** 사람마다 지난 틱의 상태 (상태가 바뀌는 순간을 잡는다), 강화된 평타 중인가, 염동력 방향 */
const prev: Array<{ mode: string; t: number; jumpKind: number }> = [
  { mode: '', t: 0, jumpKind: 0 },
  { mode: '', t: 0, jumpKind: 0 },
];
const empowered = [false, false];

/** 등장: 보이지 않다가 hide틱부터 화면 위 하늘(INTRO_DROP px 위)에서 land틱까지 점점 빨리 떨어진다 */
const INTRO_DROP = 220;

const world = (f: Fighter, x: number, y: number): [number, number] => [(f.x / 256 + f.facing * x) * FX_PX, (GROUND_Y + f.y / 256 + y) * FX_PX];

/**
 * 해머 머리가 지난 길 (이펙트 좌표): 판정 한 프레임 앞(스미어)부터 마지막 판정 프레임까지 해머 머리 가운데 (굵고 짧은 원호).
 * 그동안 몸이 나아간 만큼(advance) 앞 프레임은 뒤로 물려 놓는다 (그 자리에서 휘두른 길로)
 */
function headPath(f: Fighter, id: MoveId): Array<[number, number]> {
  const mv = movesOf(f.char)[id];
  const d = mv.data;
  const J = mv.frames.joints;
  const a0 = d.active[0] ?? 0;
  const a1 = d.active[d.active.length - 1] ?? a0;
  const adv = d.advance ?? [];
  const upto = (k: number) => adv.slice(0, k + 1).reduce((a, b) => a + b, 0);
  const out: Array<[number, number]> = [];
  for (let k = Math.max(0, a0 - 1); k <= a1; k++) {
    const j = J[k]!;
    const hx = j.hF[0] + Math.cos(j.wa) * HAMMER.reach - (upto(a0) - upto(k));
    const hy = j.hF[1] + Math.sin(j.wa) * HAMMER.reach;
    out.push(world(f, hx, hy));
  }
  return out;
}

function introImpact(c: CharFx, f: Fighter): void {
  const [fx, fy] = c.feet(f);
  const wx = fx / FX_PX;
  const wy = fy / FX_PX;
  const head = f.facing * 24;
  c.layer.add(impact({ kind: 'hit', x: fx + head * FX_PX, y: fy - 2 * FX_PX, angle: -Math.PI / 2, size: 0.95, ramp: fxRamp(['fxWhite', 'veilLight', 'stone', 'stoneDark', 'fxSoot']), seed: c.seed() }));
  for (const dir of [-1, 1]) {
    c.layer.add(shockwave({ x: fx + head * FX_PX, y: fy, dir, len: 70, speed: 380, height: 8, ramp: fxRamp(VEIL), crack: fxColor('fxSoot'), rubble: fxRamp(RUBBLE), seed: c.seed() }));
    c.debris.burst('brick', wx + head, wy - 2, dir, 6);
  }
  c.layer.add(veilRing({ x: fx + head * FX_PX, y: fy, radius: 42, ticks: 18, ramp: fxRamp(VEIL) }));
  c.debris.dustCloud(wx - 34, wx + 34, 0.9, wy);
  c.glow(wx + head, wy - 8, 130, COLORS.veilLight, 1, 18);
  c.fx.shake(0.7);
  c.fx.flashFor(1);
}

/** 센 해머가 바닥을 칠 때: 바닥 충격파·파편·먼지·흔들림 */
function groundSlam(c: CharFx, x: number, y: number, dir: number, len: number, size: number): void {
  c.layer.add(impact({ kind: 'hit', x, y: y - 2 * FX_PX, angle: -Math.PI / 2, size, ramp: fxRamp(['fxWhite', 'veilLight', 'stone', 'stoneDark', 'fxSoot']), seed: c.seed() }));
  c.layer.add(shockwave({ x, y, dir, len, speed: 440, height: 6 + size * 6, ramp: fxRamp(VEIL), crack: fxColor('fxSoot'), rubble: fxRamp(RUBBLE), seed: c.seed() }));
  c.debris.burst('brick', x / FX_PX, y / FX_PX - 2, dir, 4 + Math.round(size * 4));
  c.debris.burst('brick', x / FX_PX, y / FX_PX - 2, -dir, 2 + Math.round(size * 2));
  c.debris.dustCloud(x / FX_PX - 10, x / FX_PX + 10, 0.4 + size * 0.4, y / FX_PX);
  c.fx.shake(0.2 + 0.25 * size);
}

export const EDWARD_RENDER: CharRender = {
  ramp: VEIL,
  light: COLORS.veil,
  ownIntro: true,
  introHidden: (f) => f.t < EDWARD_INTRO_T.hide,
  introLift(f) {
    const I = EDWARD_INTRO_T;
    if (f.t >= I.land) return 0;
    const u = Math.max(0, (f.t - I.hide) / (I.land - I.hide));
    return Math.round(INTRO_DROP * (1 - u * u));
  },

  strike(c, s, f, i, id) {
    const w = ARC_W[id];
    if (w) {
      // 해머 머리가 지난 길을 따라 굵고 짧은 원호 (히트스톱 동안 멈춘다)
      const path = headPath(f, id);
      const fighter = f;
      c.layer.add(hammerArc({ path, width: w, ticks: HEAVY.has(id) ? 13 : 10, ramp: fxRamp(VEIL), held: () => fighter.hitstop > 0 }));
      const [ex, ey] = path[path.length - 1]!;
      c.glow(ex / FX_PX, ey / FX_PX, HEAVY.has(id) ? 80 : 50, COLORS.veilLight, HEAVY.has(id) ? 0.9 : 0.6, 10);
      const ground = (GROUND_Y + f.floor / 256) * FX_PX;
      // 바닥을 치는 해머: 4타 내려찍기는 충격파가 판정 끝(74px)까지 달린다, 쓸기는 바닥을 긁는다, 공중 내려찍기는 바닥 가까우면
      if (id === 'atk4') groundSlam(c, ex, ground, f.facing, 34, 0.75);
      else if (id === 'sweep') {
        c.debris.dustCloud(ex / FX_PX - 14, ex / FX_PX + 6, 0.45, ground / FX_PX);
        c.debris.burst('brick', ex / FX_PX, ground / FX_PX - 1, f.facing, 4);
      } else if (id === 'slam' && ground - ey < 30 * FX_PX) groundSlam(c, ex, ground, f.facing, 20, 0.5);
      else if (id === 'launcher') c.debris.burst('brick', ex / FX_PX, ground / FX_PX - 2, f.facing, 4);
      if (HEAVY.has(id)) c.fx.shake(0.12);
    } else if (id === 'skill2') {
      // 염동력: 뻗은 뒷손과 상대 가슴을 잇는 푸른 궤적
      const op = s.fighters[1 - i]!;
      const fighter = f;
      const pull = f.ext[EX.TK_DIR] === 1;
      c.layer.add(tether({
        from: () => {
          const j = movesOf(fighter.char).skill2.frames.joints[6]!;
          return world(fighter, j.hB[0], j.hB[1]);
        },
        to: () => [(op.x / 256) * FX_PX, (GROUND_Y + op.y / 256 - 28) * FX_PX],
        ticks: 22,
        flow: pull ? 1 : -1,
        ramp: fxRamp(VEIL),
      }));
      c.glow(f.x / 256 + f.facing * 20, GROUND_Y + f.y / 256 - 26, 70, COLORS.veil, 0.8, 18);
    } else if (id === 'super') {
      // 잡는 손에 푸른 빛이 번쩍
      const j = movesOf(f.char).super.frames.joints[5]!;
      const [hx, hy] = world(f, j.hB[0], j.hB[1]);
      c.layer.add(glint({ x: hx, y: hy, size: 0.8, ramp: fxRamp(VEIL) }));
    }
  },

  event(c, s, e, i) {
    const f = s.fighters[i]!;
    if (e.who !== i) return;
    const [fx, fy] = c.feet(f);
    const wx = fx / FX_PX;
    const wy = fy / FX_PX;
    if (e.type === 'hit' && e.move && (HEAVY.has(e.move) || empowered[i])) {
      // 센 해머·강화된 평타: 맞은 자리에서 파편과 푸른 고리
      const x = (e.x / 256) * FX_PX;
      const y = (GROUND_Y + e.y / 256) * FX_PX;
      c.layer.add(veilRing({ x, y, radius: empowered[i] ? 30 : 20, flat: 1, ticks: 12, ramp: fxRamp(VEIL) }));
      c.debris.burst('brick', e.x / 256, GROUND_Y + e.y / 256, f.facing, 3);
      if (empowered[i]) {
        c.layer.add(explosion({ x, ground: (GROUND_Y + f.floor / 256) * FX_PX, size: 0.35, surface: fxColor('street'), seed: c.seed(), fire: 0 }));
        c.fx.shake(0.4);
        c.fx.flashFor(2);
      }
      return;
    }
    if (e.type !== 'char') return;
    const fighter = f;
    switch (e.text) {
      case 'shell':
      case 'shellBreak':
        // 껍데기가 피해를 대신 받는다: 몸 윤곽에 푸른 장막 (깨지면 조각이 흩어진다)
        c.layer.add(veilShell({ silhouette: () => c.silhouette(fighter), ticks: e.text === 'shellBreak' ? 18 : 11, broken: e.text === 'shellBreak', ramp: fxRamp(VEIL), seed: c.seed() }));
        c.glow(wx, wy - 26, e.text === 'shellBreak' ? 90 : 50, COLORS.veilLight, 0.7, 10);
        if (e.text === 'shellBreak') {
          c.layer.add(glint({ x: fx, y: fy - 26 * FX_PX, size: 1, ramp: fxRamp(VEIL) }));
          c.fx.shake(0.25);
        }
        break;
      case 'shellFill':
        c.layer.add(veilShell({ silhouette: () => c.silhouette(fighter), ticks: 24, ramp: fxRamp(VEIL), seed: c.seed() }));
        c.layer.add(veilRing({ x: fx, y: fy, radius: 36, ticks: 20, ramp: fxRamp(VEIL) }));
        c.glow(wx, wy - 26, 110, COLORS.veilLight, 1, 20);
        break;
      case 'reenact':
        // 재현:나: 푸른 오라가 몸을 덮고 (강화가 남은 동안), 해머에서 '캉' 반짝
        c.layer.add(powerUp({
          actor: { feet: () => c.feet(fighter), silhouette: () => c.silhouette(fighter) },
          palette: fxHex(VEIL),
          size: 0.6,
          seed: c.seed(),
          sustain: () => fighter.ext[EX.EMPOWER]! > 0 || fighter.ext[EX.EMP_NOW]! > 0,
          shake: (t) => c.fx.shake(t * 0.4),
        }));
        c.layer.add(glint({ x: fx + f.facing * 13 * FX_PX, y: fy - 14 * FX_PX, size: 1.1, ramp: fxRamp(VEIL) }));
        c.layer.add(veilShell({ silhouette: () => c.silhouette(fighter), ticks: 16, ramp: fxRamp(VEIL), seed: c.seed() }));
        c.glow(wx, wy - 26, 100, COLORS.veilLight, 0.9, 20);
        break;
      case 'empowered':
        empowered[i] = true;
        break;
      case 'crush': {
        // 염동력이 으스러뜨린 물건: 조각이 상대 쪽으로 날아간다
        const b = BREAKABLES[e.combo ?? 0];
        if (!b) break;
        const op = s.fighters[1 - i]!;
        const bx = b.x + b.w / 2;
        const by = GROUND_Y - b.bottom - b.h / 2;
        const toward = Math.sign(op.x / 256 - bx) || f.facing;
        c.debris.burst('brick', bx, by, toward, 8);
        c.layer.add(impact({ kind: 'hit', x: bx * FX_PX, y: by * FX_PX, angle: toward > 0 ? 0 : Math.PI, size: 0.6, ramp: fxRamp(VEIL), seed: c.seed() }));
        c.glow(bx, by, 70, COLORS.veil, 0.8, 12);
        c.fx.shake(0.2);
        break;
      }
      case 'wave': {
        // 차지: 땅을 내리친 자리에서 충격파가 바닥을 타고 앞으로 달린다 (sim 충격파와 같은 거리·빠르기)
        const x = (e.x / 256) * FX_PX;
        const g = (GROUND_Y + e.y / 256) * FX_PX;
        c.layer.add(shockwave({ x, y: g, dir: f.facing, len: e.combo ?? 70, speed: 480, height: 14, ramp: fxRamp(VEIL), crack: fxColor('fxSoot'), rubble: fxRamp(RUBBLE), seed: c.seed() }));
        c.layer.add(explosion({ x, ground: g, size: 0.45, surface: fxColor('street'), seed: c.seed(), fire: 0 }));
        c.debris.burst('brick', e.x / 256, g / FX_PX - 2, f.facing, 8);
        c.debris.burst('brick', e.x / 256, g / FX_PX - 2, -f.facing, 4);
        c.debris.dustCloud(e.x / 256 - 20, e.x / 256 + 20, 1, g / FX_PX);
        c.glow(e.x / 256, g / FX_PX - 10, 140, COLORS.veilLight, 1, 18);
        c.fx.shake(0.6);
        c.fx.flashFor(2);
        break;
      }
    }
  },

  tick(c, s, f, i) {
    const was = prev[i]!;
    const [fx, fy] = c.feet(f);
    const wx = fx / FX_PX;
    const wy = fy / FX_PX;
    if (f.mode === 'intro') {
      if (f.t === EDWARD_INTRO_T.land) introImpact(c, f);
      // 착지 충격을 대신 받은 껍데기가 푸른 장막으로 한 번 비친다
      if (f.t === EDWARD_INTRO_T.veil) {
        const fighter = f;
        c.layer.add(veilShell({ silhouette: () => c.silhouette(fighter), ticks: 16, ramp: fxRamp(VEIL), seed: c.seed() }));
      }
    }
    // 착지할 때마다 바닥이 울린다
    if (f.mode === 'land' && was.mode !== 'land') {
      c.fx.shake(0.16);
      c.debris.dustCloud(wx - 12, wx + 12, 0.45, wy);
      c.layer.add(veilRing({ x: fx, y: fy, radius: 16, ticks: 10, ramp: fxRamp(['stone', 'stoneDark', 'sidewalk', 'fxSoot']) }));
    }
    // 2단 점프: 발밑 허공에 푸른 장막 디딤판
    if (f.mode === 'air' && f.jumpKind === 2 && (was.jumpKind !== 2 || was.mode !== 'air')) {
      c.layer.add(veilRing({ x: fx, y: fy + 2 * FX_PX, radius: 18, ticks: 14, ramp: fxRamp(VEIL) }));
      c.glow(wx, wy, 50, COLORS.veil, 0.8, 10);
    }
    // 대시: 앞발로 쿵 멈추는 순간 바닥이 울린다
    if (f.mode === 'dash' && f.t === 11) {
      c.fx.shake(0.12);
      c.debris.dustCloud(wx + f.facing * 8, wx + f.facing * 16, 0.35, wy);
    }
    // 벽: 묵직하게 붙고(쿵), 달려 오를 때 걸음마다 울린다
    if (f.mode === 'wallcling' && was.mode !== 'wallcling') c.fx.shake(0.14);
    if (f.mode === 'wallrun' && f.t % 6 === 1) c.fx.shake(0.06);
    // 강화된 평타: 푸른 잔상을 남긴다
    if (f.mode !== 'attack') empowered[i] = false;
    if (empowered[i] && s.tick % 3 === 0) {
      const sil = c.silhouette(f);
      c.layer.add(ghost({ sil: { ...sil, data: sil.data.slice() }, ticks: 14, ramp: fxRamp(['veilLight', 'veil']) }));
    }
    // 필살기 연출: 흡수 장면에서 화면이 어두워지고 기억 조각이 빨려 든다
    const cine = s.cine;
    if (cine && cine.who === i && cine.move === 'super' && cine.t === 1) {
      const op = s.fighters[1 - i]!;
      const fighter = f;
      if (cine.scene === 0) {
        c.fx.shake(0.3);
        c.glow(wx + f.facing * 14, wy - 46, 60, COLORS.veilLight, 0.8, 14);
      }
      if (cine.scene === 1) {
        c.layer.add(darkness({
          center: () => [((fighter.x + op.x) / 512) * FX_PX, (GROUND_Y + fighter.y / 256 - 30) * FX_PX],
          radius: 46, color: fxColor('night'), fadeIn: 12, hold: 46, fadeOut: 20,
        }));
        c.layer.add(memories({
          from: () => [(op.x / 256) * FX_PX, (GROUND_Y + op.y / 256 - 46) * FX_PX],
          to: () => [(fighter.x / 256) * FX_PX, (GROUND_Y + fighter.y / 256 - 32) * FX_PX],
          ticks: 60,
          ramp: fxRamp(VEIL),
          seed: c.seed(),
        }));
        c.layer.add(veilShell({ silhouette: () => c.silhouette(fighter), ticks: 60, ramp: fxRamp(VEIL), seed: c.seed() }));
      }
      if (cine.scene === 2) c.fx.shake(0.35);
    }
    prev[i] = { mode: f.mode, t: f.t, jumpKind: f.jumpKind };
  },

  lights(s, f, i) {
    const x = f.x / 256;
    const y = GROUND_Y + f.y / 256 - 26;
    // 재현:나로 강화된 동안 몸 둘레가 푸르게 빛난다
    if (f.ext[EX.EMPOWER]! > 0 || f.ext[EX.EMP_NOW]! > 0) lights.point(x, y, 46, COLORS.veil, 0.35 * (s.tick % 4 === 0 ? 0.8 : 1));
    // 필살기 흡수 장면: 에드워드가 푸른 빛을 낸다
    if (s.cine && s.cine.who === i && s.cine.move === 'super' && s.cine.scene === 1) lights.point(x, y - 6, 120, COLORS.veilLight, 0.9);
  },

  hud(ctx, s, f, _i, slot) {
    // 껍데기 게이지: 체력바 바로 위 얇은 푸른 띠 (체력바처럼 안쪽부터 찬다). 비었으면 어둡게 깜빡인다
    const r = f.ext[EX.SHELL]! / SHELL_MAX;
    const y = 3;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(slot.x - 1, y - 1, slot.w + 2, 4);
    ctx.fillStyle = r <= 0 && (s.tick >> 3) & 1 ? COLORS.veilDark : COLORS.panel;
    ctx.fillRect(slot.x, y, slot.w, 2);
    const w = Math.round(slot.w * Math.max(0, Math.min(1, r)));
    if (w > 0) {
      const x0 = slot.left ? slot.x + slot.w - w : slot.x;
      // 차는 중(맞지 않은 지 3초가 지남)이면 끝이 반짝인다
      const filling = f.ext[EX.QUIET]! >= 180 && r < 1;
      ctx.fillStyle = COLORS.veil;
      ctx.fillRect(x0, y, w, 2);
      ctx.fillStyle = COLORS.veilLight;
      ctx.fillRect(x0, y, w, 1);
      if (filling && (s.tick >> 2) & 1) {
        ctx.fillStyle = COLORS.white;
        ctx.fillRect(slot.left ? x0 : x0 + w - 1, y, 1, 2);
      }
    }
  },
};
