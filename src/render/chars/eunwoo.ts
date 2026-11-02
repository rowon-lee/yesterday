import type { CharFx, CharRender } from '.';
import { fighterPose, movesOf, statsOf, type Fighter, type SimState, cineScenes } from '../../sim';
import { EUNWOO_RULES, EW } from '../../sim/chars/eunwoo';
import { GROUND as GROUND_Y } from '../../stage/citadel';
import eunwooButterflies from '../../vfx/eunwoo-butterfly';
import { lilyAura, lilyMark, lilyShield } from '../../vfx/eunwoo-lily';
import eunwooMind from '../../vfx/eunwoo-mind';
import { MOTIONS } from '../../anim/motions';
import eunwooThread from '../../vfx/eunwoo-thread';
import eunwooIntro from '../../vfx/eunwoo-intro';
import eunwooTrail from '../../vfx/eunwoo-trail';
import { EUNWOO_INTRO_PILLAR, EUNWOO_INTRO_T } from '../../data/poses/eunwoo/show';
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

type P = [number, number];

/** 연검 궤적 띠 색 (11-2: 리본 자체를 따라가는 은빛 띠 + 금실 한 줄): 흰 심 → 밝은 은빛 → 은빛 → 회청 → 어두운 회청 */
const TRAIL: ColorName[] = ['fxWhite', 'moonLight', 'moon', 'gownShade', 'gownDark'];
const TRAIL_GOLD: ColorName[] = ['threadLight', 'thread'];
/** 칼끝 섬광 (칼끝이 꺾이는 순간·맞힌 순간) */
const TIP: ColorName[] = ['fxWhite', 'moonLight', 'moon', 'moonDark'];
/** 금색 실 (대시·순간이동), 은빛 와이어 (내려찍기·차지) */
const GOLD: ColorName[] = ['threadLight', 'thread', 'goldDark'];
const SILVER: ColorName[] = ['fxWhite', 'gown', 'gownShade'];
/** 나비 [흰 날개, 그늘, 연분홍, 금빛], 백합 [흰 꽃잎, 연분홍, 분홍, 짙은 분홍, 금빛 꽃술], 심상세계 하늘·물 */
const BUTTERFLY: ColorName[] = ['fxWhite', 'gown', 'lilyLight', 'threadLight'];
const LILY: ColorName[] = ['fxWhite', 'lilyLight', 'lily', 'lilyDark', 'threadLight'];
/** 심상세계 하늘 [맨 위, 위, 가운데, 아래, 수평선 분홍 짙음, 수평선 분홍, 금빛 줄], 물 [깊음, 가운데, 수평선 아래, 물결 밝음, 물결 흰] */
const MIND_SKY: ColorName[] = ['fxNavy', 'gownDark', 'moonDark', 'moon', 'lily', 'lilyLight', 'threadLight'];
const MIND_WATER: ColorName[] = ['fxNavy', 'gownDark', 'moonDark', 'moon', 'moonLight'];

/** 살아 있는 궤적·실·나비·막 (빛을 낸다) */
const trails: Array<ReturnType<typeof eunwooTrail> | null> = [null, null];
/** 사람마다 등장 나비 (11-3) */
const intros: Array<ReturnType<typeof eunwooIntro> | null> = [null, null];
/** 등장 나비 색: 흰 날개, 옅은 금빛 테두리, 몸, 빛 먼지 */
const INTRO_FLY: ColorName[] = ['fxWhite', 'threadLight', 'gown', 'goldLight'];
/** 사람마다 지난 틱의 동작 프레임 (프레임이 바뀌는 순간을 잡는다) */
const lastFrame: Array<string> = ['', ''];
const threads: Array<{ fx: ReturnType<typeof eunwooThread>; color: string }> = [];
const swarms: Array<ReturnType<typeof eunwooButterflies>> = [];
const shields: Array<ReturnType<typeof lilyShield>> = [];
/** 사람마다 지금 붙어 있는 낙인·심상세계 (없으면 null) */
const marks: Array<ReturnType<typeof lilyMark> | null> = [null, null];
const auras: Array<ReturnType<typeof lilyAura> | null> = [null, null];
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

/** 몸 가운데 (엉덩이와 목 사이, 이펙트 2단위): 백합 방어막 타원의 가운데 */
function bodyCenter(f: Fighter): [number, number] {
  const j = fighterPose(f).joints;
  return toFx(f, [(j.hip[0] + j.neck[0]) / 2, Math.min(-30, (j.hip[1] + j.neck[1]) / 2)]);
}

/** 지금 프레임의 연검 리본 (월드 px 점 10개). 리본이 없는 프레임이면 null */
function ribbonWorld(f: Fighter): P[] | null {
  const rib = fighterPose(f).joints.fx?.rib;
  if (!rib) return null;
  return rib.map((p) => [f.x / 256 + f.facing * p[0], GROUND_Y + f.y / 256 + p[1]] as P);
}
/** 칼끝 (월드 px) */
function ribbonTip(f: Fighter): P | null {
  const r = ribbonWorld(f);
  return r ? r[r.length - 1]! : null;
}
/** 칼끝 섬광: 작은 은빛 터짐 + 잠깐 비추는 은빛 광원 */
function tipFlash(c: CharFx, p: P, size: number): void {
  c.layer.add(impact({ kind: 'hit', x: p[0] * FX_PX, y: p[1] * FX_PX, angle: -Math.PI / 2, size, ramp: fxRamp(TIP), seed: c.seed() }));
  c.glow(p[0], p[1], 20 + 60 * size, COLORS.moonLight, 0.5 + size, 6);
}

/** 동작 이름 → 표시 틱 합 */
const motionTotal = new Map(MOTIONS.map((m) => [m.name, m.dur.reduce((a, b) => a + b, 0)]));
/**
 * 선의 전체 기준 틱 (0~30 발동, 30부터 연출): 지금 연출 장면·틱에서 센다. 짧은 판은 첫 장면(전개)을 30~90에 늘려 맞춘다.
 * 이 사람의 선의 연출이 아니면 -1
 */
function superTime(s: SimState, i: number): number {
  const c = s.cine;
  if (!c || c.who !== i || c.move !== 'super') return -1;
  const sc = cineScenes(s);
  const ticks = sc.map((x) => motionTotal.get(x.a.motion) ?? 0);
  let el = c.t;
  for (let k = 0; k < c.scene; k++) el += ticks[k]!;
  const first = ticks[0]!;
  return el < first ? 30 + (el * 60) / first : 90 + el - first;
}

/** HUD 백합 낙인 (가슴 문양과 같은 7×7) */
const HUD_LILY = ['...3...', '.3.1.3.', '..121..', '3122213', '..121..', '.3.1.3.', '...3...'];

export const EUNWOO_RENDER: CharRender = {
  strike(c, s, f, _i, id) {
    const mv = movesOf(f.char)[id];
    // 내려찍기: 뒷손에서 은빛 와이어(연검과 따로, 1px 곧은 쇠줄 11-0)가 앞아래로 쏘아 나가 감아 채고, 끌어당겨 거둔다
    if (id === 'slam' && mv.data.box) {
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
        shoot: 3, hold: 8, back: 6, retract: true, sag: 0, width: 1,
        ramp: fxRamp(SILVER), seed: c.seed(), held: () => f.hitstop > 0,
      });
      c.layer.add(fx);
      threads.push({ fx, color: COLORS.gown });
      return;
    }
    // 연검: 칼끝이 꺾이는 순간 칼끝에 작은 은빛 섬광 (궤적 띠는 tick이 리본을 따라 그린다)
    const tip = ribbonTip(f);
    if (tip) tipFlash(c, tip, 0.2);
    if (id === 'atk4' || id === 'launcher' || id === 'charge') c.fx.shake(id === 'charge' ? 0.3 : 0.18);
  },
  tick(c, s, f, i) {
    const e = f.ext;
    // 연검 궤적 (11-2): 공격 중 판정 두 프레임 앞부터 판정 두 프레임 뒤까지, 그 순간 리본을 궤적 띠에 넣는다
    const pose = fighterPose(f);
    const key = `${pose.motion}#${pose.frame}`;
    const changed = key !== lastFrame[i];
    lastFrame[i] = key;
    if ((f.mode === 'attack' || f.mode === 'charge') && f.move) {
      const mv = movesOf(f.char)[f.mode === 'charge' ? 'charge' : f.move];
      const a0 = mv.data.active[0] ?? 99;
      const a1 = mv.data.active[mv.data.active.length - 1] ?? -99;
      const rib = pose.motion === mv.frames.name && pose.frame >= a0 - 2 && pose.frame <= a1 + 2 ? ribbonWorld(f) : null;
      if (rib && f.move !== 'slam' && f.move !== 'super') {
        let tr = trails[i];
        if (!tr || tr.done()) {
          const fighter = f;
          tr = eunwooTrail({ ramp: fxRamp(TRAIL), gold: fxRamp(TRAIL_GOLD), held: () => fighter.hitstop > 0 });
          trails[i] = tr;
          c.layer.add(tr);
        }
        if (f.hitstop === 0) tr.feed(rib);
      }
      // 4타: 칼끝이 앞 바닥에 꽂히는 순간 은빛 섬광과 물보라
      if (changed && f.move === 'atk4' && pose.frame === a1 && pose.motion === mv.frames.name) {
        const tip = ribbonTip(f);
        if (tip) {
          tipFlash(c, tip, 0.4);
          c.debris.burst('water', tip[0], GROUND_Y + f.y / 256, f.facing, 7);
        }
      }
    }
    // 백합 낙인 (11-4): 가슴에 7×7 백합 문양 + 몸을 둘러싼 36×60 방어막 (낙인이 있는 동안)
    if (e[EW.LILY] > 0 && !marks[i] && f.mode !== 'ko') {
      const fighter = f;
      const alive = () => fighter.ext[EW.LILY] > 0 && fighter.mode !== 'ko';
      const mk = lilyMark({
        at: () => {
          const j = fighterPose(fighter).joints;
          return toFx(fighter, [(j.neck[0] * 2 + j.hip[0]) / 3 + 1, (j.neck[1] * 2 + j.hip[1]) / 3 + 1]);
        },
        alive,
        ramp: fxRamp(LILY),
      });
      const au = lilyAura({ center: () => bodyCenter(fighter), alive, ramp: fxRamp(LILY) });
      marks[i] = mk;
      auras[i] = au;
      c.layer.add(au);
      c.layer.add(mk);
    }
    if (marks[i]?.done()) marks[i] = null;
    if (auras[i]?.done()) auras[i] = null;
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
    // 등장 (11-3): 빛나는 흰 나비가 날아와 나선 기둥이 되고, 맥박치듯 빛난 뒤 흩어지면 그 속에서 걸어 나온다
    if (f.mode === 'intro' && f.t <= 1 && !intros[i]) {
      const fighter = f;
      const ox = f.x;
      const oy = f.y;
      const facing = f.facing;
      const fx = eunwooIntro({
        t: () => (fighter.mode === 'intro' ? fighter.t : -1),
        base: () => [ox / 256 + facing * EUNWOO_INTRO_PILLAR, GROUND_Y + oy / 256],
        shoulder: () => {
          const j = fighterPose(fighter).joints.shF;
          return [fighter.x / 256 + fighter.facing * j[0], GROUND_Y + fighter.y / 256 + j[1]];
        },
        ramp: fxRamp(INTRO_FLY),
        seed: c.seed(),
      });
      intros[i] = fx;
      c.layer.add(fx);
    }
    if (intros[i]?.done()) intros[i] = null;
    // 선의 (11-5): 연출 동안 발밑에서 물결이 퍼지며 도시가 지워지고 새벽 물가의 심상세계가 된다 (sim 연출 장면·틱을 따라간다)
    const cine = s.cine;
    if (cine && cine.who === i && cine.move === 'super' && !minds[i]) {
      const d = opponent(s, f);
      const fighter = f;
      const md = eunwooMind({
        T: () => superTime(s, i),
        feet: () => [fighter.x / 256, GROUND_Y + fighter.y / 256],
        target: () => [d.x / 256, GROUND_Y + d.y / 256],
        hand: () => {
          const j = fighterPose(fighter).joints.hB;
          return [fighter.x / 256 + fighter.facing * j[0], GROUND_Y + fighter.y / 256 + j[1]];
        },
        bodies: () => [c.silhouette(fighter), c.silhouette(d)],
        sky: fxRamp(MIND_SKY), water: fxRamp(MIND_WATER), lily: fxRamp(LILY), gold: fxRamp(['threadLight', 'thread']), fly: fxRamp(INTRO_FLY),
        seed: c.seed(),
      });
      minds[i] = md;
      c.layer.add(md);
    }
    if (minds[i]?.done()) minds[i] = null;
    // 선의로 둔해진 상대 (11-5): 둔해짐이 남은 동안 발밑에 작은 물결과 백합 꽃잎이 남는다
    if (e[EW.DULL] > 0 && !s.cine) {
      const d = opponent(s, f);
      const x = d.x / 256;
      const y = GROUND_Y + d.y / 256;
      if (s.tick % 16 === 0 && d.y === 0) c.debris.burst('water', x + (((s.tick * 13) % 17) - 8), y, 0, 2);
      if (s.tick % 22 === 5) {
        c.layer.add(impact({ kind: 'hit', x: (x + (((s.tick * 7) % 15) - 7)) * FX_PX, y: (y - 2) * FX_PX, angle: -Math.PI / 2, size: 0.12, ramp: fxRamp(['fxWhite', 'lilyLight', 'lily', 'lilyDark']), seed: c.seed() }));
      }
    }
  },
  event(c, s, e, i) {
    const f = s.fighters[i]!;
    // 맞히면 리본이 가장 크게 펼친 순간으로 돌아가 히트스톱 동안 멈춘다 (은빛 섬광 한 번)
    if (e.type === 'hit' && e.who === i) {
      const tip = ribbonTip(f);
      if (tip && e.move !== 'slam' && e.move !== 'super') tipFlash(c, tip, e.heavy ? 0.45 : 0.32);
      c.glow(e.x / 256, GROUND_Y + e.y / 256, e.heavy ? 70 : 48, COLORS.gown, e.heavy ? 0.9 : 0.7, e.heavy ? 14 : 9);
      // 스텔라리스 발도: 뒷손의 은빛 와이어가 맞은 상대에게 감겨 끌어당긴다
      if (e.move === 'charge') {
        const d = opponent(s, f);
        const fx = eunwooThread({
          from: () => joint(f, 'hB'),
          to: () => [(d.x / 256) * FX_PX, (GROUND_Y + d.y / 256 - 26) * FX_PX],
          shoot: 2, hold: 14, back: 6, retract: true, sag: 0, width: 1,
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
      // 백합 방어막이 막아 냄 (11-4): 맞은 쪽 테두리에서 꽃잎 조각이 흩어지고 흰 고리 섬광 한 번 (낙인은 꺼진다)
      const att = opponent(s, f);
      const side = att.x > f.x ? 1 : -1;
      const [bx, by] = bodyCenter(f);
      const sh = lilyShield({ x: bx, y: by, facing: side, ramp: fxRamp(LILY), seed: c.seed() });
      c.layer.add(sh);
      shields.push(sh);
      c.glow(bx / FX_PX, by / FX_PX, 70, COLORS.fxWhite, 0.9, 8);
      c.fx.shake(0.2);
    } else if (e.text === 'lily') {
      c.glow(f.x / 256, GROUND_Y + f.y / 256 - 30, 50, COLORS.lilyLight, 0.8, 16);
    }
  },
  ownIntro: true,
  // 등장: 나비가 모여 기둥이 되고 맥박치는 동안(0~80틱)은 몸을 감춘다
  introHidden: (f) => f.t < EUNWOO_INTRO_T.reveal,
  lights(s, f, i) {
    // 리본은 무대의 은빛 광원 (펼쳐진 동안 밝고, 걷히며 어두워진다)
    const tr = trails[i];
    if (tr && !tr.done()) for (const [x, y] of tr.points()) lights.point(x, y, 40, COLORS.moon, 0.45);
    // 방어: 돌리는 연검의 은빛 원이 은은히 빛난다
    const disc = fighterPose(f).joints.fx?.disc;
    if (disc) {
      const j = fighterPose(f).joints.hF;
      lights.point(f.x / 256 + f.facing * j[0], GROUND_Y + f.y / 256 + j[1], 34, COLORS.moon, 0.35 + 0.1 * Math.sin(s.tick / 3));
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
    const it = intros[i];
    if (it) {
      const lv = it.level();
      if (lv > 0) {
        const bx = f.x / 256 + f.facing * EUNWOO_INTRO_PILLAR;
        const by = GROUND_Y + f.y / 256;
        lights.point(bx, by - 28, 50 + 40 * lv, COLORS.gown, 0.7 * lv);
        lights.point(bx, by - 3, 36 + 24 * lv, COLORS.threadLight, 0.45 * lv);
      }
    }
    const md = minds[i];
    if (md) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 60, 160, COLORS.gown, 0.28 * md.level());
  },
  hud(ctx, s, f, _i, slot) {
    // 이름 옆: 백합 낙인(연분홍 백합), 아직 여기 있어가 남은 동안 흰 나비와 남은 시간 막대
    let x = slot.left ? slot.nameEdge + 4 : slot.nameEdge - 4 - 7;
    const y = 16;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x - 1, y - 1, 9, 9);
    // 백합 낙인 (11-4): 가슴의 문양과 같은 7×7 백합 (분홍 꽃잎, 흰 심). 낙인이 없으면 어두운 빈 칸
    if (f.ext[EW.LILY] > 0) {
      const pulse = (s.tick >> 3) & 1;
      HUD_LILY.forEach((row, dy) => {
        for (let dx = 0; dx < 7; dx++) {
          const v = row[dx];
          if (v === '.') continue;
          ctx.fillStyle = v === '2' ? COLORS.fxWhite : v === '3' ? (pulse ? COLORS.lilyLight : COLORS.lily) : COLORS.lily;
          ctx.fillRect(x + dx, y + dy, 1, 1);
        }
      });
    } else {
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(x, y, 7, 7);
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
