import type { CharFx, CharRender } from '.';
import type { MoveId } from '../../data/moves/base';
import { fighterPose, movesOf, statsOf, type Fighter, type SimState } from '../../sim';
import { EUNWOO_RULES, EW } from '../../sim/chars/eunwoo';
import { GROUND as GROUND_Y } from '../../stage/citadel';
import eunwooButterflies from '../../vfx/eunwoo-butterfly';
import { lilyMark, lilyShield } from '../../vfx/eunwoo-lily';
import eunwooMind from '../../vfx/eunwoo-mind';
import eunwooRibbon from '../../vfx/eunwoo-ribbon';
import eunwooThread from '../../vfx/eunwoo-thread';
import impact from '../../vfx/impact';
import { lights } from '../light';
import { COLORS, type ColorName } from '../palette';
import { fxRamp, FX_PX } from '../vfx';

/*
 * 백은우 고유 연출 (렌더 전용, sim 상태를 읽기만 한다).
 * - 평타 궤적 (동작연출지침서 5장·7장): 연검 칼끝이 지난 길을 따라 은빛 리본이 채찍처럼 쏘아 나가 궤적 상자(= 판정)를 덮고,
 *   앞끝이 휘어지며 가늘어진다. 리본은 무대를 비추는 은빛 광원이다.
 * - 내려찍기·차지: 은빛 와이어가 쏘아 나가 감아 채고 끌어당긴다. 대시·응답: 금색 실을 따라 미끄러지고 순간이동한다.
 * - 백합 낙인: 가슴에 작은 백합이 은은히 빛나고(연분홍 빛), 막아 내면 연분홍 막이 깨지며 꽃잎이 흩날린다.
 * - 아직 여기 있어: 흰 나비들이 몸 둘레를 돌고, 회복하는 동안 금빛 반짝임이 오른다. 등장: 흰 나비 떼가 모여 흩어지면 은우가 서 있다.
 * - 선의: 연출 동안 화면이 백합이 핀 물가의 심상세계로 바뀐다. 끝나면 상대 몸 위로 무거운 잿빛 알갱이가 떨어진다(둔해짐).
 */

type MoveOf = ReturnType<typeof movesOf>[MoveId];
type P = [number, number];

/** 은빛 리본 색: 흰 심 → 밝은 은빛 → 은빛 → 회청 → 어두운 회청 → 금색 반짝임 */
const RIBBON: ColorName[] = ['fxWhite', 'gown', 'paleGrey', 'gownShade', 'gownDark', 'threadLight'];
/** 금색 실 (대시·순간이동), 은빛 와이어 (내려찍기·차지) */
const GOLD: ColorName[] = ['threadLight', 'thread', 'goldDark'];
const SILVER: ColorName[] = ['fxWhite', 'gown', 'gownShade'];
/** 나비 [흰 날개, 그늘, 연분홍, 금빛], 백합 [흰 꽃잎, 연분홍, 분홍, 짙은 분홍, 금빛 꽃술], 심상세계 하늘·물 */
const BUTTERFLY: ColorName[] = ['fxWhite', 'gown', 'lilyLight', 'threadLight'];
const LILY: ColorName[] = ['fxWhite', 'lilyLight', 'lily', 'lilyDark', 'threadLight'];
const MIND_SKY: ColorName[] = ['fxNavy', 'gownDark', 'gownShade', 'gownDark', 'gownShade', 'gown', 'fxWhite'];

/** 기술마다 리본 굵기 (px): 1~3타 가늘게, 4타·띄우기·쓸기·대시·차지는 굵게 */
const WIDTH: Partial<Record<MoveId, number>> = {
  atk1: 6, atk2: 7, atk3: 8, atk4: 10, launcher: 9, sweep: 8, dashAttack: 8, air1: 6, air2: 7, air3: 8, wallKick: 8, charge: 12,
};

/**
 * 리본 길 (발밑 기준 px, 오른쪽 보는 기준, 꼬리 → 앞끝): 칼 쥔 손이 판정 두 프레임 앞에 있던 자리에서 시작해
 * 궤적 상자 모양대로 휘어 상자 끝까지 (판정 범위를 덮는다). 앞끝 말림은 리본 이펙트가 더한다
 */
const pathCache = new Map<string, P[]>();
function ribbonPath(mv: MoveOf): P[] {
  const d = mv.data;
  const b = d.box!;
  const key = `${d.motion}:${b.x},${b.y},${b.w},${b.h},${b.shape}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const J = mv.frames.joints;
  const end = (d.limb?.[1] ?? 'hF') as 'hF' | 'hB';
  const a0 = d.active[0];
  const hand = (i: number): P => {
    const p = J[Math.max(0, Math.min(J.length - 1, i))][end];
    return [p[0], p[1]];
  };
  const x0 = b.x;
  const x1 = b.x + b.w;
  const y0 = b.y;
  const y1 = b.y + b.h;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const ell = (ccx: number, ccy: number, rx: number, ry: number, deg: number): P => {
    const r = (deg * Math.PI) / 180;
    return [ccx + Math.cos(r) * rx, ccy + Math.sin(r) * ry];
  };
  const sweep = (ccx: number, ccy: number, rx: number, ry: number, from: number, to: number, n: number): P[] =>
    Array.from({ length: n + 1 }, (_, k) => ell(ccx, ccy, rx, ry, from + ((to - from) * k) / n));
  let path: P[];
  switch (b.shape) {
    case 'line': {
      // 곧게 쏘아 나간다: 손에서 출발해 살짝 위로 부풀었다가 상자 끝
      const s = hand(a0 - 1);
      const e: P = [x1, cy];
      path = [s, hand(a0), [s[0] + (e[0] - s[0]) * 0.6, Math.min(s[1], e[1]) - b.h * 0.3], e];
      break;
    }
    case 'fall':
      // 위 뒤에서 앞아래로 내리친다
      path = [hand(a0 - 2), [x0 + b.w * 0.2, y0], [cx + b.w * 0.15, y0 + b.h * 0.15], [x1 - b.w * 0.05, cy], [x1 - b.w * 0.2, y1]];
      break;
    case 'rise':
      // 아래 앞에서 위로 올려 벤다
      path = [hand(a0 - 2), [x1 - b.w * 0.1, y1 - b.h * 0.25], [x1 - b.w * 0.05, cy], [cx, y0 + b.h * 0.08], [x0 + b.w * 0.2, y0]];
      break;
    case 'ground':
      // 바닥을 스치며 앞으로
      path = [hand(a0 - 2), ...sweep(cx, y1, b.w / 2, b.h, 200, 350, 5)];
      break;
    case 'circle':
      path = sweep(cx, cy, b.w / 2, b.h / 2, 150, 500, 12);
      break;
    case 'arc':
    default:
      // 뒤 아래에서 위를 돌아 앞으로 크게 반원
      path = [hand(a0 - 2), ...sweep(cx, y1, b.w / 2, b.h, 190, 350, 6)];
      break;
  }
  pathCache.set(key, path);
  return path;
}

/** 살아 있는 리본·실·나비·막 (빛을 낸다) */
const ribbons: Array<ReturnType<typeof eunwooRibbon>> = [];
const threads: Array<{ fx: ReturnType<typeof eunwooThread>; color: string }> = [];
const swarms: Array<ReturnType<typeof eunwooButterflies>> = [];
const shields: Array<ReturnType<typeof lilyShield>> = [];
/** 사람마다 지금 붙어 있는 낙인·심상세계 (없으면 null) */
const marks: Array<ReturnType<typeof lilyMark> | null> = [null, null];
const minds: Array<ReturnType<typeof eunwooMind> | null> = [null, null];

/** 월드 좌표 (2단위): 발밑 기준 관절 p를 그 사람 방향·자리로 */
const toFx = (f: Fighter, p: readonly [number, number]): [number, number] => [
  (f.x / 256 + f.facing * p[0]) * FX_PX,
  (GROUND_Y + f.y / 256 + p[1]) * FX_PX,
];
/** 그 사람의 관절 (월드 2단위) */
const joint = (f: Fighter, name: 'hB' | 'hF' | 'neck' | 'hip'): [number, number] => toFx(f, fighterPose(f).joints[name]);
const opponent = (s: SimState, f: Fighter): Fighter => s.fighters.find((o) => o !== f)!;

/** 작은 반짝임 (금빛·흰빛 점이 터지듯) */
function sparkle(c: CharFx, x: number, y: number, size: number): void {
  c.layer.add(impact({ kind: 'hit', x, y, angle: -Math.PI / 2, size, ramp: fxRamp(['fxWhite', 'threadLight', 'thread', 'goldDark']), seed: c.seed() }));
}

export const EUNWOO_RENDER: CharRender = {
  strike(c, s, f, _i, id) {
    const mv = movesOf(f.char)[id];
    if (!mv.data.box) return;
    // 내려찍기: 뒷손에서 은빛 와이어가 앞아래로 쏘아 나가 감아 채고, 끌어당겨 거둔다
    if (id === 'slam') {
      const b = mv.data.box;
      const tip: P = [b.x + b.w * 0.8, b.y + b.h * 0.8];
      const ox = f.x;
      const oy = f.y;
      const facing = f.facing;
      const fx = eunwooThread({
        from: () => joint(f, 'hB'),
        to: () => {
          // 맞혔으면 상대 몸에 감긴 채 따라간다
          const d = opponent(s, f);
          if (f.moveConnected) return [(d.x / 256) * FX_PX, (GROUND_Y + d.y / 256 - 26) * FX_PX];
          return [(ox / 256 + facing * tip[0]) * FX_PX, (GROUND_Y + oy / 256 + tip[1]) * FX_PX];
        },
        shoot: 3, hold: 8, back: 6, retract: true, sag: 4, width: 2,
        ramp: fxRamp(SILVER), seed: c.seed(), held: () => f.hitstop > 0,
      });
      c.layer.add(fx);
      threads.push({ fx, color: COLORS.gown });
      return;
    }
    const fighter = f;
    const fx = eunwooRibbon({
      path: ribbonPath(mv).map((p) => toFx(f, p)),
      width: WIDTH[id] ?? 7,
      curl: id === 'atk4' || id === 'charge' ? 14 : 10,
      ticks: id === 'atk4' || id === 'charge' ? 16 : 12,
      ramp: fxRamp(RIBBON),
      seed: c.seed(),
      held: () => fighter.hitstop > 0,
    });
    c.layer.add(fx);
    ribbons.push(fx);
    if (id === 'atk4' || id === 'launcher' || id === 'charge') c.fx.shake(id === 'charge' ? 0.3 : 0.18);
  },
  tick(c, s, f, i) {
    const e = f.ext;
    // 백합 낙인: 가슴에 작은 백합 (낙인이 있는 동안)
    if (e[EW.LILY] > 0 && !marks[i] && f.mode !== 'ko') {
      const mk = lilyMark({
        at: () => {
          const j = fighterPose(f).joints;
          return toFx(f, [(j.neck[0] * 2 + j.hip[0]) / 3 + 2, (j.neck[1] * 2 + j.hip[1]) / 3]);
        },
        alive: () => f.ext[EW.LILY] > 0 && f.mode !== 'ko',
        ramp: fxRamp(LILY),
      });
      marks[i] = mk;
      c.layer.add(mk);
    }
    if (marks[i]?.done()) marks[i] = null;
    // 아직 여기 있어: 회복하는 동안 금빛 반짝임이 오른다
    if (e[EW.BUFF] > 0 && e[EW.BUFF] % (EUNWOO_RULES.SKILL2_EVERY * 3) === 0 && f.hp < statsOf(f.char).hp) {
      const [x, y] = joint(f, 'neck');
      sparkle(c, x + (((s.tick * 7) % 13) - 6) * FX_PX, y, 0.22);
    }
    // 지상·공중 대시: 손가락으로 쏜 금색 실을 따라 미끄러진다
    if ((f.mode === 'dash' || f.mode === 'airdash') && f.t === 1 && f.dir > 0) {
      const ox = f.x;
      const oy = f.y;
      const facing = f.facing;
      const st = statsOf(f.char);
      const reach = f.mode === 'dash' ? ((st.dashMoveTo - st.dashMoveFrom) * st.dashSpeed) / 256 + 20 : (st.airDashMoveTo * st.airDashSpeed) / 256 + 20;
      const fx = eunwooThread({
        from: () => joint(f, 'hB'),
        to: () => [(ox / 256 + facing * reach) * FX_PX, (GROUND_Y + oy / 256 - 24) * FX_PX],
        shoot: 2, hold: 6, back: 5, retract: false, sag: 1, width: 1,
        ramp: fxRamp(GOLD), seed: c.seed(),
      });
      c.layer.add(fx);
      threads.push({ fx, color: COLORS.thread });
    }
    // 등장: 흰 나비 떼가 날아와 모였다가 흩어지면 은우가 서 있다 (몇 마리는 어깨 둘레를 돌다 사라진다)
    if (f.mode === 'intro' && f.t === 1) {
      const sw = eunwooButterflies({
        center: () => toFx(f, [0, -26]), mode: 'gather', count: 26, gather: 14, hold: 4, scatter: 26,
        ramp: fxRamp(BUTTERFLY), seed: c.seed(),
      });
      c.layer.add(sw);
      swarms.push(sw);
    }
    // 선의: 연출 동안 백합이 핀 물가의 심상세계
    const cine = s.cine;
    if (cine && cine.who === i && cine.move === 'super' && !minds[i]) {
      const d = opponent(s, f);
      const total = movesOf(f.char).super.data.cinematic!.scenes.length;
      const md = eunwooMind({
        origin: () => [(f.x / 256) * FX_PX, (GROUND_Y + f.y / 256) * FX_PX],
        target: () => [(d.x / 256) * FX_PX, (GROUND_Y + d.y / 256) * FX_PX],
        bloom: () => {
          const c2 = s.cine;
          if (!c2) return 1;
          return Math.max(0, Math.min(1, (c2.scene + c2.t / 42 - (total - 2.2)) / 1.8));
        },
        alive: () => !!s.cine && s.cine.who === i,
        sky: fxRamp(MIND_SKY), lily: fxRamp(LILY), seed: c.seed(),
      });
      minds[i] = md;
      c.layer.add(md);
    }
    if (minds[i]?.done()) minds[i] = null;
    // 선의로 둔해진 상대: 몸 위로 무거운 잿빛 알갱이가 천천히 떨어진다
    if (e[EW.DULL] > 0 && s.tick % 5 === 0) {
      const d = opponent(s, f);
      const x = (d.x / 256 + (((s.tick * 13) % 21) - 10)) * FX_PX;
      const y = (GROUND_Y + d.y / 256 - 52) * FX_PX;
      c.layer.add(impact({ kind: 'hit', x, y, angle: Math.PI / 2, size: 0.12, ramp: fxRamp(['gown', 'gownShade', 'gownDark', 'suitGrey']), seed: c.seed() }));
    }
  },
  event(c, s, e, i) {
    const f = s.fighters[i]!;
    // 맞히면 리본이 가장 크게 펼친 순간으로 돌아가 히트스톱 동안 멈춘다 (은빛 섬광 한 번)
    if (e.type === 'hit' && e.who === i) {
      ribbons[ribbons.length - 1]?.rewind();
      c.glow(e.x / 256, GROUND_Y + e.y / 256, e.heavy ? 70 : 48, COLORS.gown, e.heavy ? 0.9 : 0.7, e.heavy ? 14 : 9);
      // 스텔라리스 발도: 뒷손의 은빛 와이어가 맞은 상대에게 감겨 끌어당긴다
      if (e.move === 'charge') {
        const d = opponent(s, f);
        const fx = eunwooThread({
          from: () => joint(f, 'hB'),
          to: () => [(d.x / 256) * FX_PX, (GROUND_Y + d.y / 256 - 26) * FX_PX],
          shoot: 2, hold: 14, back: 6, retract: true, sag: 3, width: 2,
          ramp: fxRamp(SILVER), seed: c.seed(), held: () => f.hitstop > 0,
        });
        c.layer.add(fx);
        threads.push({ fx, color: COLORS.gown });
      }
    }
    if (e.type !== 'char' || e.who !== i) return;
    if (e.text === 'teleport') {
      // 응답: 떠난 자리에서 나타난 자리까지 금색 실이 한 줄 그어지고, 양 끝에서 금빛 반짝임
      const ax = (e.x / 256) * FX_PX;
      const ay = (GROUND_Y + e.y / 256 - 24) * FX_PX;
      const bx = ((e.to ?? e.x) / 256) * FX_PX;
      const by = (GROUND_Y + (e.combo ?? e.y) / 256 - 24) * FX_PX;
      const fx = eunwooThread({ from: () => [ax, ay], to: () => [bx, by], shoot: 1, hold: 3, back: 8, retract: false, sag: 0, width: 1, ramp: fxRamp(GOLD), seed: c.seed() });
      c.layer.add(fx);
      threads.push({ fx, color: COLORS.thread });
      sparkle(c, ax, ay, 0.35);
      sparkle(c, bx, by, 0.45);
      c.glow(bx / FX_PX, by / FX_PX, 46, COLORS.thread, 0.8, 8);
    } else if (e.text === 'butterfly') {
      const sw = eunwooButterflies({
        center: () => toFx(f, [0, -2]), mode: 'orbit', count: 7, radius: 15,
        alive: () => f.ext[EW.BUFF] > 0 && f.mode !== 'ko', ramp: fxRamp(BUTTERFLY), seed: c.seed(),
      });
      c.layer.add(sw);
      swarms.push(sw);
      const [nx, ny] = joint(f, 'neck');
      sparkle(c, nx, ny, 0.4);
    } else if (e.text === 'shield') {
      // 백합 낙인 방어막: 맞은 자리 앞에 연분홍 막이 번쩍 생겼다가 깨지며 꽃잎이 흩날린다
      const att = opponent(s, f);
      const side = att.x > f.x ? 1 : -1;
      const sh = lilyShield({ x: (f.x / 256 + side * 6) * FX_PX, y: (GROUND_Y + f.y / 256 - 26) * FX_PX, facing: side, ramp: fxRamp(LILY), seed: c.seed() });
      c.layer.add(sh);
      shields.push(sh);
      c.fx.shake(0.2);
    } else if (e.text === 'lily') {
      c.glow(f.x / 256, GROUND_Y + f.y / 256 - 30, 50, COLORS.lilyLight, 0.8, 16);
    }
  },
  hidden(s, f) {
    // 등장: 나비 떼가 모여드는 동안은 보이지 않는다 (흩어지면 그 자리에 서 있다)
    return f.mode === 'intro' && s.round === 1 && f.t < 15;
  },
  lights(s, f, i) {
    // 리본은 무대의 은빛 광원 (펼쳐진 동안 밝고, 걷히며 어두워진다)
    for (let k = ribbons.length - 1; k >= 0; k--) {
      const r = ribbons[k]!;
      if (r.done()) {
        ribbons.splice(k, 1);
        continue;
      }
      const ph = r.phase();
      for (const [x, y] of ph.pts) lights.point(x, y, 44, COLORS.gown, 0.55 * ph.k);
    }
    for (let k = threads.length - 1; k >= 0; k--) {
      const t = threads[k]!;
      if (t.fx.done()) {
        threads.splice(k, 1);
        continue;
      }
      const ph = t.fx.phase();
      lights.point(ph.b[0], ph.b[1], 30, t.color, 0.5 * ph.k);
    }
    for (let k = swarms.length - 1; k >= 0; k--) {
      const w = swarms[k]!;
      if (w.done()) {
        swarms.splice(k, 1);
        continue;
      }
      const ph = w.phase();
      lights.point(ph.c[0], ph.c[1], 36, COLORS.gown, 0.3 * ph.k);
    }
    for (let k = shields.length - 1; k >= 0; k--) {
      const w = shields[k]!;
      if (w.done()) {
        shields.splice(k, 1);
        continue;
      }
      const ph = w.phase();
      lights.point(ph.c[0], ph.c[1], 60, COLORS.lilyLight, 0.9 * ph.k);
    }
    // 백합 낙인: 은은한 연분홍 빛, 심상세계: 은우 위로 넓은 흰 빛
    if (f.ext[EW.LILY] > 0 && f.mode !== 'ko') lights.point(f.x / 256, GROUND_Y + f.y / 256 - 30, 26, COLORS.lilyLight, 0.25 + 0.08 * Math.sin(s.tick / 8));
    const md = minds[i];
    if (md) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 60, 160, COLORS.gown, 0.28 * md.level());
  },
  hud(ctx, s, f, _i, slot) {
    // 이름 옆: 백합 낙인(연분홍 백합), 아직 여기 있어가 남은 동안 흰 나비와 남은 시간 막대
    let x = slot.left ? slot.nameEdge + 4 : slot.nameEdge - 4 - 7;
    const y = 18;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x - 1, y - 1, 9, 8);
    const px = (dx: number, dy: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    };
    if (f.ext[EW.LILY] > 0) {
      const pulse = (s.tick >> 3) & 1;
      px(3, 0, COLORS.threadLight);
      for (const [dx, dy] of [[3, 1], [2, 2], [4, 2], [1, 3], [5, 3], [3, 3]] as const) px(dx, dy, COLORS.fxWhite);
      for (const [dx, dy] of [[0, 2], [6, 2], [2, 4], [4, 4]] as const) px(dx, dy, pulse ? COLORS.lilyLight : COLORS.lily);
      px(3, 4, COLORS.lilyDark);
      px(3, 5, COLORS.lilyDark);
    } else {
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(x, y, 7, 6);
    }
    const buff = f.ext[EW.BUFF];
    if (buff > 0) {
      x = slot.left ? x + 10 : x - 10;
      // 나비 (날개를 번갈아)
      ctx.fillStyle = COLORS.fxWhite;
      if ((s.tick >> 2) & 1) {
        ctx.fillRect(x, y + 1, 2, 2);
        ctx.fillRect(x + 4, y + 1, 2, 2);
      } else ctx.fillRect(x + 2, y, 2, 1);
      ctx.fillStyle = COLORS.gown;
      ctx.fillRect(x + 2, y + 1, 2, 3);
      const w = Math.ceil((buff / EUNWOO_RULES.SKILL2_TICKS) * 16);
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(slot.left ? x + 8 : x - 18, y + 2, 16, 2);
      ctx.fillStyle = COLORS.threadLight;
      ctx.fillRect(slot.left ? x + 8 : x - 2 - w, y + 2, w, 2);
    }
  },
};
