import { HAMMER } from '../../anim/decor/edward';
import type { MoveId } from '../../data/moves/base';
import { arcAt, EDWARD_ARCS, type HammerArc } from '../../data/poses/edward/attack';
import { EDWARD_INTRO_T } from '../../data/poses/edward/show';
import { CHARGE_ARC } from '../../data/poses/edward/skill';
import { BREAKABLES, movesOf, type Fighter } from '../../sim';
import { advanceBefore, animFrameAt, fighterPose, moveAnim } from '../pose';
import { EX, SHELL_MAX, SHELL_QUIET } from '../../sim/chars/edward';
import { GROUND as GROUND_Y } from '../../stage/citadel';
import explosion from '../../vfx/explosion';
import glint from '../../vfx/glint';
import impact from '../../vfx/impact';
import powerUp from '../../vfx/power-up';
import { cracks, darkness, dome, ghost, hammerArc, memories, scrape, shockwave, slabs, veilAura, veilBands, veilBox, veilHand, veilRing, veilShell, veilWall } from '../../vfx/edward-fx';
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
/** 해머 원호: 청동빛 (2026-11-02 피드백 12-1 '청동빛 원호 + 푸른 잔상(껍데기 색)') */
const BRONZE: ColorName[] = ['bronzeLight', 'bronzeLight', 'bronze', 'bronzeDark'];
/** 젖은 바닥에 튀는 물 */
const WATER: ColorName[] = ['fxWhite', 'skyLight', 'sky'];

/** 해머 원호 굵기 (px, 8~12) */
const ARC_W: Partial<Record<MoveId, number>> = {
  atk1: 9, atk2: 9, atk3: 11, atk4: 12, launcher: 11, sweep: 10, dashAttack: 11, air1: 8, air2: 8, air3: 10, slam: 12, charge: 12,
};
/** 센 타격 (흔들림·파편) */
const HEAVY: ReadonlySet<MoveId> = new Set(['atk4', 'launcher', 'dashAttack', 'slam', 'charge']);
/** 해머 평타 (맞힐 때마다 바닥이 반응한다: 물 튐) */
const HAMMER_HITS: ReadonlySet<MoveId> = new Set(['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick']);
/** 해머 머리가 바닥에 닿는 프레임 (그 프레임이 시작하는 틱에 물 튐·균열·먼지): 기술 → [프레임, 해머 머리 앞 거리 px, 크기 0~1] */
const GROUND_TOUCH: Partial<Record<MoveId, [number, number, number]>> = {
  atk1: [8, 34, 0.35], atk3: [7, 48, 0.8], sweep: [4, 50, 0.4],
};

/** 사람마다 지난 틱의 상태 (상태가 바뀌는 순간을 잡는다), 강화된 평타 중인가, 염동력 방향 */
const prev: Array<{ mode: string; t: number; jumpKind: number }> = [
  { mode: '', t: 0, jumpKind: 0 },
  { mode: '', t: 0, jumpKind: 0 },
];
const empowered = [false, false];

/** 등장 (피드백 12-5): 화면 위(INTRO_DROP px 위)에서 꼿꼿이 선 채 land틱까지 점점 빨리 떨어진다 */
const INTRO_DROP = 260;

const px256 = (v: number): number => v * 256;

const world = (f: Fighter, x: number, y: number): [number, number] => [(f.x / 256 + f.facing * x) * FX_PX, (GROUND_Y + f.y / 256 + y) * FX_PX];

/**
 * 해머 머리가 지난 길 (이펙트 좌표): 판정 한 프레임 앞(스미어)부터 마지막 판정 프레임까지 해머 머리 가운데 (굵고 짧은 원호).
 * 그동안 몸이 나아간 만큼(advance) 앞 프레임은 뒤로 물려 놓는다 (그 자리에서 휘두른 길로)
 */
function headPath(f: Fighter, id: MoveId): Array<[number, number]> {
  const mv = movesOf(f.char)[id];
  const A = moveAnim(mv);
  const J = A.joints;
  // 판정 틱(공격 데이터)이 그림에서 몇 번째 프레임인지, 그림 프레임 k가 끝날 때까지 나아간 거리
  const a0 = mv.time.hits.length ? animFrameAt(A, mv.activeStart) : 0;
  const a1 = mv.time.hits.length ? animFrameAt(A, mv.activeEnd - 1) : a0;
  const upto = (k: number) => advanceBefore(mv, A.cum[k]!);
  const out: Array<[number, number]> = [];
  for (let k = Math.max(0, a0 - 1); k <= a1; k++) {
    const j = J[k]!;
    const hx = j.hF[0] + Math.cos(j.wa) * HAMMER.reach - (upto(a0) - upto(k));
    const hy = j.hF[1] + Math.sin(j.wa) * HAMMER.reach;
    out.push(world(f, hx, hy));
  }
  return out;
}

/** 해머 머리가 지나는 원호 (data/poses/edward/attack EDWARD_ARCS)를 이펙트 좌표로 */
function arcPath(f: Fighter, a: HammerArc): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const [x, y] = arcAt(a, a.a0 + ((a.a1 - a.a0) * k) / n);
    out.push(world(f, x, y));
  }
  return out;
}

/** 젖은 바닥에 해머가 닿거나 맞은 자리: 물방울이 튀고 물결 고리가 퍼진다 (size 0~1) */
function splash(c: CharFx, x: number, ground: number, dir: number, size: number): void {
  c.debris.burst('water', x / FX_PX, ground / FX_PX - 1, dir, 4 + Math.round(size * 8));
  c.debris.burst('water', x / FX_PX, ground / FX_PX - 1, -dir, 2 + Math.round(size * 4));
  c.layer.add(veilRing({ x, y: ground, radius: 8 + size * 14, flat: 0.25, ticks: 14 + Math.round(size * 8), ramp: fxRamp(WATER) }));
}

/** 등장 착지 (피드백 12-5): 두 발로 선 채 쿵 — 바닥에 방사형 균열, 먼지, 충격파 고리, 물, 화면 흔들림 */
function introImpact(c: CharFx, f: Fighter): void {
  const [fx, fy] = c.feet(f);
  const wx = fx / FX_PX;
  const wy = fy / FX_PX;
  c.layer.add(cracks({ x: fx, y: fy, count: 9, len: 26, color: fxColor('fxSoot'), ticks: 150, seed: c.seed() }));
  for (const dir of [-1, 1]) {
    c.layer.add(shockwave({ x: fx, y: fy, dir, len: 60, speed: 380, height: 6, ramp: fxRamp(VEIL), crack: fxColor('fxSoot'), rubble: fxRamp(RUBBLE), seed: c.seed() }));
    c.debris.burst('brick', wx, wy - 2, dir, 5);
  }
  c.layer.add(veilRing({ x: fx, y: fy, radius: 46, flat: 0.28, ticks: 20, ramp: fxRamp(['fxWhite', 'veilLight', 'stone', 'stoneDark']) }));
  splash(c, fx, fy, f.facing, 1);
  c.debris.dustCloud(wx - 40, wx + 40, 1, wy);
  c.glow(wx, wy - 8, 120, COLORS.veilLight, 0.9, 16);
  c.fx.shake(0.7);
  c.fx.flashFor(1);
}

export const EDWARD_RENDER: CharRender = {
  ramp: VEIL,
  light: COLORS.veil,
  ownIntro: true,
  ownChargeAura: true,
  ownDash: true,
  introHidden: (f) => f.t < EDWARD_INTRO_T.hide,
  introLift(f) {
    const I = EDWARD_INTRO_T;
    if (f.t >= I.land) return 0;
    const u = Math.max(0, (f.t - I.hide) / (I.land - I.hide));
    return Math.round(INTRO_DROP * (1 - u * u));
  },

  strike(c, _s, f, _i, id) {
    const w = ARC_W[id];
    if (w) {
      // 해머 머리가 지난 길을 따라 청동빛 원호 + 푸른 해머 머리 잔상 (히트스톱 동안 멈춘다). 원호가 정해진 평타는 그 원호를 그린다
      const mv = movesOf(f.char)[id];
      const arc = EDWARD_ARCS[mv.data.motion] ?? (id === 'charge' ? CHARGE_ARC : undefined);
      const path = arc ? arcPath(f, arc) : headPath(f, id);
      const fighter = f;
      c.layer.add(hammerArc({
        path, width: w, ticks: HEAVY.has(id) ? 16 : 12, ramp: fxRamp(BRONZE), ghost: fxRamp(VEIL.slice(1)), heads: HEAVY.has(id) ? 5 : 3,
        head: { half: HAMMER.half, thick: HAMMER.thick }, held: () => fighter.hitstop > 0,
      }));
      const [ex, ey] = path[path.length - 1]!;
      c.glow(ex / FX_PX, ey / FX_PX, HEAVY.has(id) ? 80 : 50, COLORS.bronzeLight, HEAVY.has(id) ? 0.8 : 0.5, 10);
      const ground = (GROUND_Y + f.floor / 256) * FX_PX;
      if (id === 'launcher') c.debris.burst('brick', ex / FX_PX, ground / FX_PX - 2, f.facing, 4);
      // 4타 풀스윙: 화면이 흔들리고 발밑 먼지가 휘말린다
      if (id === 'atk4') {
        c.fx.shake(0.45);
        c.debris.dustCloud(f.x / 256 - 30, f.x / 256 + 40, 0.6, ground / FX_PX);
      } else if (HEAVY.has(id)) c.fx.shake(0.12);
    } else if (id === 'skill2') {
      // 염동력: 장막을 뻗는 순간 손바닥이 푸르게 번쩍 (띠·손·벽은 붙잡았을 때: event tkGrab·tkWall)
      const j = fighterPose(f).joints;
      const [hx, hy] = world(f, j.hB[0], j.hB[1]);
      c.layer.add(glint({ x: hx, y: hy, size: 0.6, ramp: fxRamp(VEIL) }));
      c.glow(hx / FX_PX, hy / FX_PX, 60, COLORS.veilLight, 0.8, 10);
    } else if (id === 'super') {
      // 잡는 손에 푸른 빛이 번쩍
      const j = moveAnim(movesOf(f.char).super).joints[5]!;
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
    if (e.type === 'hit' && e.move && HAMMER_HITS.has(e.move)) {
      // 맞을 때마다 바닥 반응: 맞은 자리 아래 젖은 바닥에 물이 튄다 (공중이면 바닥 가까울 때만)
      const op = s.fighters[1 - i]!;
      const ground = (GROUND_Y + op.floor / 256) * FX_PX;
      if (op.floor - op.y < px256(40)) splash(c, (op.x / 256) * FX_PX, ground, f.facing, HEAVY.has(e.move) ? 0.8 : 0.4);
    }
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
    if (e.type === 'charge' && (e.text === 'start' || e.text === 'level')) {
      // 단계가 오를 때만: 발밑 젖은 바닥이 한 번 크게 울린다 (물결 고리 + 물방울)
      const lv = e.combo ?? 1;
      c.layer.add(veilRing({ x: fx, y: fy, radius: 14 + 8 * lv, flat: 0.22, ticks: 18, ramp: fxRamp(WATER) }));
      c.debris.burst('water', wx, wy - 1, 1, 2 + 2 * lv);
      c.debris.burst('water', wx, wy - 1, -1, 2 + 2 * lv);
      if (e.text === 'start') {
        // 모으기 시작: 해머 머리가 바닥을 긁는다 (홈·청동빛 불꽃), 팔·등에 푸른 장막 윤곽이 단계마다 짙어진다
        const fighter = f;
        const windup = movesOf(f.char).charge.time.charge!.loop[0];
        c.layer.add(scrape({
          head: () => {
            if (fighter.mode !== 'charge' || fighter.t >= windup) return null;
            const j = fighterPose(fighter).joints;
            return world(fighter, j.hF[0] + Math.cos(j.wa) * HAMMER.reach, j.hF[1] + Math.sin(j.wa) * HAMMER.reach);
          },
          ground: (GROUND_Y + f.floor / 256) * FX_PX, groove: fxColor('fxSoot'), sparks: fxRamp(['fxWhite', 'bronzeLight', 'bronze']), seed: c.seed(),
        }));
        c.layer.add(veilAura({
          silhouette: () => c.silhouette(fighter), level: () => (fighter.mode === 'charge' ? Math.max(1, fighter.chargeLv) : 0),
          feet: () => c.feet(fighter), facing: () => fighter.facing, ramp: fxRamp(VEIL),
        }));
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
      case 'tkGrab': {
        // 끌어당김: 손에서 꼬인 장막 띠 세 가닥이 뻗고, 상대보다 한 둘레 큰 장막 손이 움켜쥔다 (흰 번쩍 1틱). 끌려가는 발밑에 물 자국
        const op = s.fighters[1 - i]!;
        const hand = () => {
          const j = fighterPose(fighter).joints;
          return world(fighter, j.hB[0], j.hB[1]);
        };
        const chest = (): [number, number] => [(op.x / 256) * FX_PX, (GROUND_Y + op.y / 256 - 26) * FX_PX];
        const alive = () => fighter.ext[EX.TK_GRAB] === 1 && fighter.mode === 'attack';
        c.layer.add(veilBands({ from: hand, to: chest, alive, ramp: fxRamp(VEIL) }));
        c.layer.add(veilHand({ at: chest, from: -f.facing, size: 30, alive, ramp: fxRamp(VEIL), seed: c.seed() }));
        c.layer.add(scrape({
          head: () => (alive() ? [(op.x / 256) * FX_PX, (GROUND_Y + op.floor / 256) * FX_PX] : null),
          ground: (GROUND_Y + op.floor / 256) * FX_PX, groove: fxColor('fxSoot'), sparks: fxRamp(WATER), seed: c.seed(),
        }));
        c.glow(op.x / 256, GROUND_Y + op.y / 256 - 26, 80, COLORS.veilLight, 0.9, 12);
        c.fx.flashFor(1);
        break;
      }
      case 'tkWall': {
        // 밀어냄: 높이 70px 장막 벽이 상대를 붙인 채 밀려 나가고, 벽 밑 젖은 바닥이 갈라진다
        const op = s.fighters[1 - i]!;
        const alive = () => fighter.ext[EX.TK_GRAB] === 2 && fighter.mode === 'attack';
        c.layer.add(veilWall({
          at: () => [((op.x / 256) - fighter.facing * 12) * FX_PX, (GROUND_Y + op.floor / 256) * FX_PX],
          dir: f.facing, height: 70, alive, ramp: fxRamp(VEIL), seed: c.seed(),
        }));
        c.glow(op.x / 256, GROUND_Y + op.y / 256 - 30, 90, COLORS.veilLight, 0.9, 14);
        c.fx.shake(0.15);
        break;
      }
      case 'tkDrop': {
        // 끌려온 상대가 떨어진다: 발밑 물이 튀고 장막 손이 깨져 흩어진다 (veilHand)
        const op = s.fighters[1 - i]!;
        splash(c, (op.x / 256) * FX_PX, (GROUND_Y + op.floor / 256) * FX_PX, -f.facing, 0.5);
        c.fx.shake(0.12);
        break;
      }
      case 'tkBurst': {
        // 장막 벽이 터진다 (veilWall 조각), 화면이 흔들린다
        const op = s.fighters[1 - i]!;
        c.glow(op.x / 256, GROUND_Y + op.y / 256 - 30, 110, COLORS.veilLight, 1, 12);
        splash(c, (op.x / 256) * FX_PX, (GROUND_Y + op.floor / 256) * FX_PX, f.facing, 0.7);
        c.fx.shake(0.35);
        break;
      }
      case 'crush': {
        // 염동력이 으스러뜨린 물건: 같은 장막이 감싸 조였다가 조각이 상대 쪽으로 날아간다
        const b = BREAKABLES[e.combo ?? 0];
        if (!b) break;
        c.layer.add(veilBox({ x: b.x * FX_PX, y: (GROUND_Y - b.bottom - b.h) * FX_PX, w: b.w * FX_PX, h: b.h * FX_PX, ticks: 8, ramp: fxRamp(VEIL), seed: c.seed() }));
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
      case 'slamLand': {
        // 내려찍기 착지: 반원 충격파(반지름 48px)가 퍼지고 바닥이 패인다, 먼지·물·흙이 튀고 화면이 흔들린다
        const g = (GROUND_Y + f.y / 256) * FX_PX;
        const x = fx + f.facing * 20 * FX_PX;
        c.layer.add(dome({ x, y: g, radius: e.combo ?? 48, ticks: 16, ramp: fxRamp(['fxWhite', 'bronzeLight', 'veilLight', 'veil']), crack: fxColor('fxSoot'), seed: c.seed() }));
        c.layer.add(impact({ kind: 'hit', x, y: g - 2 * FX_PX, angle: -Math.PI / 2, size: 0.8, ramp: fxRamp(['fxWhite', 'bronzeLight', 'stone', 'stoneDark', 'fxSoot']), seed: c.seed() }));
        splash(c, x, g, f.facing, 1);
        c.debris.burst('brick', x / FX_PX, g / FX_PX - 2, f.facing, 6);
        c.debris.burst('brick', x / FX_PX, g / FX_PX - 2, -f.facing, 4);
        c.debris.dustCloud(x / FX_PX - 40, x / FX_PX + 40, 0.9, g / FX_PX);
        c.glow(x / FX_PX, g / FX_PX - 10, 120, COLORS.bronzeLight, 0.9, 16);
        c.fx.shake(0.6);
        c.fx.flashFor(1);
        break;
      }
      case 'slabs': {
        // 차지 올려치기: 앞쪽 바닥 판이 일직선으로 차례로 솟구쳐 (sim 판정과 같은 길이·빠르기) 기울어진 채 잔해로 남는다
        const x = (e.x / 256) * FX_PX;
        const g = (GROUND_Y + e.y / 256) * FX_PX;
        const len = e.combo ?? 64;
        const serial = f.ext[EX.RUBBLE_N]!;
        const fighter = f;
        c.layer.add(slabs({
          x, y: g, dir: f.facing, len, ticks: 14, ramp: fxRamp(['paleGrey', 'sidewalk', 'stone', 'stoneDark']),
          keep: () => fighter.ext[EX.RUBBLE_N] === serial, glow: fxColor('veilLight'), seed: c.seed(),
        }));
        for (let k = 0; k <= len; k += 16) {
          const wx = e.x / 256 + f.facing * k;
          c.debris.burst('brick', wx, g / FX_PX - 3, f.facing, 2);
        }
        c.debris.dustCloud(Math.min(e.x / 256, e.x / 256 + f.facing * len), Math.max(e.x / 256, e.x / 256 + f.facing * len), 0.7, g / FX_PX);
        splash(c, x, g, f.facing, 0.8);
        c.glow(e.x / 256 + (f.facing * len) / 2, g / FX_PX - 10, 70, COLORS.veilLight, 0.55, 16);
        c.fx.shake(0.4);
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
    // 염동력 밀어냄: 장막 벽 밑 젖은 바닥이 갈라진다 (밀려 나가는 동안 물이 양옆으로 튄다)
    if (f.ext[EX.TK_GRAB] === 2 && f.mode === 'attack' && s.tick % 3 === 0) {
      const op = s.fighters[1 - i]!;
      c.debris.burst('water', op.x / 256 - f.facing * 12, GROUND_Y + op.floor / 256 - 1, f.facing, 2);
    }
    // 차지를 모으는 동안 발밑 물이 떨린다 (작은 물결 고리가 이어진다)
    if (f.mode === 'charge' && s.tick % 12 === 0) c.layer.add(veilRing({ x: fx, y: fy, radius: 9, flat: 0.22, ticks: 12, ramp: fxRamp(['skyLight', 'sky', 'skyDark']) }));
    // 해머 머리가 바닥에 닿는 프레임: 물이 튀고, 3타는 바닥에 균열 40px (양쪽 20px씩)·먼지·흔들림
    if (f.mode === 'attack' && f.move) {
      const touch = GROUND_TOUCH[f.move];
      const mv = movesOf(f.char)[f.move];
      if (touch && f.t === moveAnim(mv).cum[touch[0] - 1]) {
        const g = (GROUND_Y + f.floor / 256) * FX_PX;
        const x = fx + f.facing * touch[1] * FX_PX;
        splash(c, x, g, f.facing, touch[2]);
        if (f.move === 'atk3') {
          for (const dir of [-1, 1]) c.layer.add(shockwave({ x, y: g, dir, len: 20, speed: 300, height: 4, ramp: fxRamp(['stone', 'stoneDark', 'fxSoot']), crack: fxColor('fxSoot'), rubble: fxRamp(RUBBLE), seed: c.seed() }));
          c.debris.burst('brick', x / FX_PX, g / FX_PX - 2, f.facing, 5);
          c.debris.dustCloud(x / FX_PX - 16, x / FX_PX + 16, 0.5, g / FX_PX);
          c.fx.shake(0.25);
        } else c.debris.dustCloud(x / FX_PX - 6, x / FX_PX + 6, 0.25 + touch[2] * 0.3, g / FX_PX);
      }
    }
    // 착지할 때마다 두 발로 쿵: 먼지 고리가 퍼지고 물이 튀고 화면이 1px쯤 흔들린다 (피드백 12-4)
    if (f.mode === 'land' && was.mode !== 'land') {
      c.fx.shake(0.16);
      c.debris.dustCloud(wx - 14, wx + 14, 0.5, wy);
      c.layer.add(veilRing({ x: fx, y: fy, radius: 20, flat: 0.25, ticks: 14, ramp: fxRamp(['stone', 'stoneDark', 'sidewalk', 'fxSoot']) }));
      splash(c, fx, fy, f.facing, 0.35);
    }
    // 2단 점프: 발밑 허공에 푸른 장막 디딤판
    if (f.mode === 'air' && f.jumpKind === 2 && (was.jumpKind !== 2 || was.mode !== 'air')) {
      c.layer.add(veilRing({ x: fx, y: fy + 2 * FX_PX, radius: 18, ticks: 14, ramp: fxRamp(VEIL) }));
      c.glow(wx, wy, 50, COLORS.veil, 0.8, 10);
    }
    // 대시 (피드백 12-4): 세 걸음 쿵쿵쿵 — 디딜 때마다 (6·12·18틱, 3·6·9프레임) 젖은 바닥에 물이 튀고 화면이 조금 흔들린다
    if (f.mode === 'dash' && (f.t === 6 || f.t === 12 || f.t === 18)) {
      splash(c, fx + f.facing * 10 * FX_PX, fy, f.facing, 0.45);
      c.debris.dustCloud(wx + f.facing * 4, wx + f.facing * 14, 0.25, wy);
      c.fx.shake(0.1);
    }
    // 벽 (피드백 12-4 '발바닥 전체로 찍듯, 벽에 금'): 붙는 순간 쿵 하고 발 자리에 금이 가고, 달려 오를 때 걸음마다 금이 간다
    if (f.mode === 'wallcling' && was.mode !== 'wallcling') {
      c.fx.shake(0.14);
      c.layer.add(cracks({ x: f.wallX * FX_PX, y: fy - 6 * FX_PX, count: 6, len: 10, color: fxColor('fxSoot'), seed: c.seed() }));
      c.debris.burst('brick', f.wallX, wy - 6, -f.wallSide || -f.facing, 3);
    }
    if (f.mode === 'wallrun' && f.t % 6 === 1) {
      c.fx.shake(0.06);
      c.layer.add(cracks({ x: f.wallX * FX_PX, y: fy - 4 * FX_PX, count: 4, len: 7, color: fxColor('fxSoot'), ticks: 60, seed: c.seed() }));
    }
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
      // 차는 중(맞지 않은 지 SHELL_QUIET틱이 지남)이면 끝이 반짝인다
      const filling = f.ext[EX.QUIET]! >= SHELL_QUIET && r < 1;
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
