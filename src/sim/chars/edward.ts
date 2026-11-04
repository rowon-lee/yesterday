import type { MoveId } from '../../data/moves/base';
import { CITY_RULES } from '../../stage/citadel';
import { wallBehind, wallSplat } from '../city';
import { startCine } from '../cine';
import { activeHitOf, hurtOf, overlap, strikeBox, type WBox } from '../combat';
import { isAirborne, setMode } from '../fighter';
import { movesOf } from '../frames';
import { IN_LEFT, IN_RIGHT } from '../input';
import { floorBelow } from '../platforms';
import { smashProps } from '../props';
import { px } from '../rules';
import type { Fighter, SimState } from '../types';
import type { CharHooks } from '.';

/*
 * 에드워드 '아서' 와인포드 고유 규칙 (캐릭터 기획서).
 * - 고유 특성 껍데기: 체력바 위에 따로 있는 푸른 껍데기 게이지. 맞으면 피해를 껍데기가 먼저 대신 받는다 (경직·날림은 그대로).
 *   SHELL_QUIET틱(2초) 동안 맞지 않으면 SHELL_REGEN틱마다 1씩 찬다. 라운드마다 가득 찬 채(400) 시작. 체력 자체는 가장 낮다 (900).
 * - 평타(해머)는 작은 물건(가로등·쇼윈도·가판대·소화전)을 한 방에 부순다. 자동차는 두 방.
 * - 스킬 1 재현:나: 기력 1칸 + 껍데기 REENACT_COST를 깎아 다음 평타 한 번을 크게 강화한다 (피해 ×1.7, 막혀도 방어가 깨진다).
 *   EMPOWER_TICKS(6초) 안에 평타를 내지 않으면 사라진다.
 * - 스킬 2 불완전한 염동력: 앞+스킬 2는 상대를 앞(에드워드 앞 36px)으로 끌어당기고, 뒤+스킬 2(방향 없이도)는 밀어내 날린다
 *   (뒤에 건물 정면이 있으면 벽꽝). 막혀도 끌려오고 밀려난다. 앞쪽 근처의 자동차·가로등 같은 물건을 으스러뜨리고,
 *   으스러뜨린 물건(최대 2개)을 상대에게 날려 하나마다 피해 +35.
 * - 차지 워 해머 올려치기: 해머를 몸 뒤 바닥에서 앞 위로 올려치고, 앞쪽 바닥이 일직선으로 차례로 솟구친다 (단계별 길이 64·80·96px = 판정,
 *   떼고 6~20틱). 해머에 맞지 않았으면 솟는 바닥이 맞힌다 (상대를 높이 띄운다). 지나는 자리의 물건을 부수고, 들린 바닥 조각은 잔해로 남는다.
 * - 필살기 껍데기 뒤집어쓰기: 잡기형이라 방어로 막을 수 없다 (잡는 범위에 몸이 닿으면 막고 있어도 곧바로 연출). 사거리가 아주 짧다.
 *   연출이 끝나면 껍데기가 SUPER_SHELL만큼 찬다.
 */

/** f.ext 칸 번호 */
export const EX = {
  /** 껍데기 (0 ~ SHELL_MAX) */
  SHELL: 0,
  /** 마지막으로 맞은 뒤 지난 틱 */
  QUIET: 1,
  /** 재현:나: 다음 평타 강화가 남아 있음 (1) */
  EMPOWER: 2,
  /** 재현:나: 강화가 사라지기까지 남은 틱 */
  EMPOWER_T: 3,
  /** 지금 기술이 강화된 평타 (1) */
  EMP_NOW: 4,
  /** 염동력 방향: 1 끌어당김, -1 밀어냄 */
  TK_DIR: 5,
  /** 이번 염동력으로 으스러뜨린 물건 수 */
  TK_PROPS: 6,
  /** 차지 충격파: 앞끝 x (1/256px), 남은 거리 (px), 방향, 바닥 높이 (1/256px) */
  WAVE_X: 7,
  WAVE_LEFT: 8,
  WAVE_DIR: 9,
  WAVE_Y: 10,
  /** 내려찍기: 1 수직으로 떨어지는 중, 2 착지해 땅 위에서 이어지는 중 */
  SLAM: 11,
  /** 차지 바닥 파도: 틱마다 나아가는 거리 (px) */
  WAVE_STEP: 12,
  /**
   * 차지로 들린 바닥 조각 (파괴 상태, 라운드 동안 남는다. 새 차지가 덮어쓴다): 시작 x (1/256px), 길이 (px), 방향, 바닥 높이 (1/256px),
   * 몇 번째 잔해인가 (0이면 없음). 그림은 렌더가 이 값으로 그린다
   */
  RUBBLE_X: 13,
  RUBBLE_LEN: 14,
  RUBBLE_DIR: 15,
  RUBBLE_Y: 16,
  RUBBLE_N: 17,
  /** 염동력으로 붙잡은 상대: 1 끌어당기는 중, 2 밀어붙이는 중 (0 없음). 붙잡은 순간 상대 자리 x·y (1/256px), 막혔는가, 공중이었는가 */
  TK_GRAB: 18,
  TK_FROM: 19,
  TK_Y: 20,
  TK_BLOCK: 21,
  TK_AIR: 22,
} as const;

export const SHELL_MAX = 400;
/** 이만큼 맞지 않으면 차기 시작 (2초, 피드백 12 뒤 밸런스: 3초 → 2초) */
export const SHELL_QUIET = 120;
/** 이 틱마다 1씩 찬다 (피드백 12 뒤 밸런스: 2 → 1, 가득 차는 데 5초) */
export const SHELL_REGEN = 1;
/** 재현:나에 깎이는 껍데기 */
export const REENACT_COST = 70;
/** 재현:나 강화가 남아 있는 틱 */
export const EMPOWER_TICKS = 360;
/** 강화된 평타의 피해 배율 (%) */
export const EMPOWER_DAMAGE = 170;
/** 필살기 연출 끝에 차는 껍데기 */
export const SUPER_SHELL = 200;
/** 평타가 작은 물건에 주는 피해 (가로등 90·가판대 130·소화전 70·쇼윈도 50을 한 번에) */
const PROP_SMASH = 140;
/**
 * 염동력 (2026-11-02 피드백 12-3): 10~14틱에 움켜쥐면 14~34틱 (TK_PULL_FRAME ~ TK_DROP_FRAME 프레임) 동안 상대를 옮긴다.
 * 끌어당김: 상대 발이 TK_LIFT 뜬 채 에드워드 앞 TK_STOP(몸 가운데끼리)까지 끌려와 34틱에 떨어진다 (세게 맞은 경직 TK_STUN, 이어 칠 수 있다).
 * 밀어냄: 장막 벽에 붙은 채 TK_PUSH px (막히면 TK_PUSH_BLOCK) 밀려나고 34틱에 장막이 터져 날아간다 (뒤에 건물 정면이면 벽꽝).
 * 옮기는 동안 상대는 굳어 있다 (히트스톱처럼). 물건을 으스러뜨리는 범위 (발밑 기준 앞쪽), 날린 물건 하나 피해
 */
const TK_STOP = 32;
const TK_LIFT = px(5);
const TK_PUSH = 80;
const TK_PUSH_BLOCK = 64;
const TK_STUN = 40;
const TK_REACH: { x0: number; x1: number; h: number } = { x0: -24, x1: 176, h: 130 };
const TK_THROW = 35;
/**
 * 차지 올려치기 바닥 파도 (2026-11-02 피드백 12-2): 떼고 6틱 뒤 (머리 위로 치켜든 프레임) 발 앞 SLAB_FROM px에서 앞쪽 바닥이 일직선으로 차례로 솟구친다.
 * 단계별 길이 (px) = 판정, SLAB_TICKS틱 동안 (떼고 6~20틱) 끝까지 간다. 판정은 솟는 앞끝 SLAB_BACK px 구간, 높이 SLAB_H px
 */
const SLAB_LEN = [64, 80, 96];
const SLAB_FROM = 22;
const SLAB_TICKS = 14;
const SLAB_BACK = 26;
const SLAB_H = 34;

/** 공중 평타: 감는 동안(첫 판정 틱 전) 해머 무게를 버티며 공중에 머문다 (떨어지지 않는다, 2026-11-02 피드백 12-1 '느리고 크게') */
const AIR_HANG: ReadonlySet<MoveId> = new Set(['air1', 'air2', 'air3']);
/*
 * 시점은 공격 데이터 시간표의 marks (data/moves/time.ts, 틱): 염동력 tkPull·tkDrop (끌어오기 시작·놓기), 차지 slab (바닥 파도 시작),
 * 내려찍기 slamDrop (이 틱부터 수직으로 떨어진다)·slamHold (떨어지는 동안 이 틱 바로 앞에 머문다)·slamLand (착지하면 이 틱부터 땅 위에서)
 */
/** 내려찍기 떨어지는 속도 (1/256px/틱), 착지 지점 반원 충격파 반지름·높이 (px) */
const SLAM_VY = px(9);
const SLAM_RADIUS = 48;
const SLAM_HEIGHT = 40;
/** 4타 풀스윙: 휘두르는 순간 주변 작은 물건을 부순다 (발밑 기준 범위 px) */
const SPIN_REACH: { x0: number; x1: number; h: number } = { x0: -64, x1: 96, h: 96 };

/** 해머 평타 (재현:나가 강화하고, 작은 물건을 한 방에 부순다) */
const BASIC: ReadonlySet<MoveId> = new Set(['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick']);

const other = (s: SimState, f: Fighter): Fighter => s.fighters[1 - s.fighters.indexOf(f)];

/** 발밑 기준 상자 → 월드 상자 (1/256px) */
function worldBox(f: Fighter, x0: number, x1: number, y0: number, y1: number): WBox {
  const a = f.facing > 0 ? x0 : -x1;
  const b = f.facing > 0 ? x1 : -x0;
  return { x0: f.x + px(a), x1: f.x + px(b), y0: f.y + px(y0), y1: f.y + px(y1) };
}

/**
 * 염동력으로 붙잡은 상대를 옮긴다 (기술 진행 틱마다): 14~34틱 동안 부드럽게 (3u² − 2u³, 정수 계산) 끌어당기거나 밀어붙이고, 34틱에 놓는다.
 * 옮기는 동안 상대는 굳어 있다 (히트스톱을 2틱씩 이어 준다)
 */
function tkCarry(s: SimState, f: Fighter, marks: Readonly<Record<string, number>>): void {
  const def = other(s, f);
  const t0 = marks.tkPull!;
  const t1 = marks.tkDrop!;
  const pull = f.ext[EX.TK_GRAB] === 1;
  const blocked = f.ext[EX.TK_BLOCK] === 1;
  const air = f.ext[EX.TK_AIR] === 1;
  if (def.mode === 'ko' || s.cine) {
    f.ext[EX.TK_GRAB] = 0;
    return;
  }
  if (f.t < t0) {
    def.hitstop = Math.max(def.hitstop, 2);
    return;
  }
  const from = f.ext[EX.TK_FROM]!;
  const dir = f.facing;
  if (f.t < t1) {
    const n = f.t - t0 + 1;
    const d = t1 - t0;
    const eNum = n * n * (3 * d - 2 * n);
    const eDen = d * d * d;
    const to = pull ? f.x + dir * px(TK_STOP) : from + dir * px(blocked ? TK_PUSH_BLOCK : TK_PUSH);
    def.x = from + Math.trunc(((to - from) * eNum) / eDen);
    // 옮기는 동안은 장막에 들려 떠 있다 (바닥 값 0): 끌어당김은 발이 TK_LIFT 뜨고, 밀어냄·막힘·공중은 붙잡힌 높이 그대로
    def.y = f.ext[EX.TK_Y]! - (pull && !blocked && !air ? TK_LIFT : 0);
    def.floor = 0;
    def.vx = 0;
    def.vy = 0;
    def.hitstop = Math.max(def.hitstop, 2);
    return;
  }
  // 34틱: 놓는다. 붙잡힌 높이로 내려놓고, 그 자리에 바닥이 있으면 선다 (없으면 떨어진다)
  f.ext[EX.TK_GRAB] = 0;
  def.hitstop = 0;
  def.y = f.ext[EX.TK_Y]!;
  const ground = !air && floorBelow(s, def.x, def.y) === def.y;
  def.floor = ground ? def.y : 0;
  const who = s.fighters.indexOf(f);
  if (pull) {
    if (!ground && !air) {
      setMode(def, 'airhit', 24);
      def.vy = 0;
    } else if (blocked) setMode(def, 'blockstun', 14);
    else if (air) {
      setMode(def, 'airhit', 24);
      def.vy = px(-1);
    } else {
      setMode(def, 'hitstun', TK_STUN);
      def.heavyHit = true;
    }
    s.events.push({ type: 'char', who, x: def.x, y: def.y, text: 'tkDrop' });
    return;
  }
  // 밀어냄: 장막이 터진다 (막혔으면 그 자리에서 버티고, 맞았으면 날아간다. 뒤에 건물 정면이 있으면 벽꽝)
  s.events.push({ type: 'char', who, x: def.x, y: def.y, text: 'tkBurst' });
  if (blocked && ground) {
    setMode(def, 'blockstun', 12);
    def.vx = dir * px(2);
    return;
  }
  const sx = Math.round(def.x / 256);
  const sh = Math.round(-def.y / 256) + 22;
  if (wallBehind(s, sx, sh)) {
    setMode(def, 'wallsplat', CITY_RULES.wallsplat.ticks);
    def.vx = 0;
    def.vy = 0;
    def.wallFly = false;
    wallSplat(s, def, who);
    return;
  }
  setMode(def, 'airhit', 30);
  def.vx = dir * px(4);
  def.vy = px(-4);
  def.y = Math.min(def.y, -1);
  def.floor = 0;
  def.wallFly = true;
}

export const EDWARD_HOOKS: CharHooks = {
  reset(_s, f) {
    f.ext[EX.SHELL] = SHELL_MAX;
    f.ext[EX.QUIET] = SHELL_QUIET;
  },

  tick(s, f) {
    // 내려찍기: 수직으로 떨어지다 땅·발판에 닿으면 (착지 상태가 된 바로 다음 틱) 땅 위에서 내리꽂는 프레임으로 이어지고, 착지 지점에서 반원 충격파
    if (f.ext[EX.SLAM] === 1 && f.mode === 'land') {
      const mv = movesOf(f.char).slam;
      setMode(f, 'attack');
      f.move = 'slam';
      f.queued = null;
      f.t = mv.time.marks!.slamLand!;
      f.vx = 0;
      f.ext[EX.SLAM] = 2;
      const who = s.fighters.indexOf(f);
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: 'slamLand', combo: SLAM_RADIUS });
      const box = worldBox(f, -SLAM_RADIUS, SLAM_RADIUS, -SLAM_HEIGHT, 2);
      smashProps(s, f, box, PROP_SMASH, false);
      strikeBox(s, f, box, 'slam');
    } else if (f.ext[EX.SLAM]! > 0 && (f.mode !== 'attack' || f.move !== 'slam')) f.ext[EX.SLAM] = 0;
    // 껍데기: 3초 동안 맞지 않으면 천천히 찬다
    if (f.ext[EX.QUIET]! < SHELL_QUIET) f.ext[EX.QUIET]!++;
    else if (f.ext[EX.SHELL]! < SHELL_MAX && s.tick % SHELL_REGEN === 0) f.ext[EX.SHELL]!++;
    // 재현:나: 시간이 지나면 사라지고, 강화된 평타가 끝나면 지운다
    if (f.ext[EX.EMPOWER]! > 0 && --f.ext[EX.EMPOWER_T]! <= 0) {
      f.ext[EX.EMPOWER] = 0;
      s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: f.x, y: f.y, text: 'empowerFade' });
    }
    if (f.ext[EX.EMP_NOW]! > 0 && (f.mode !== 'attack' || !f.move || !BASIC.has(f.move))) f.ext[EX.EMP_NOW] = 0;
    // 차지 바닥 파도: 앞쪽 바닥이 차례로 솟구치며 나아간다 (올려치기 해머에 맞지 않았으면 맞힌다, 지나는 물건을 부순다)
    if (f.ext[EX.WAVE_LEFT]! > 0) {
      if (f.mode !== 'attack' || f.move !== 'charge') f.ext[EX.WAVE_LEFT] = 0;
      else {
        const step = Math.min(f.ext[EX.WAVE_STEP]!, f.ext[EX.WAVE_LEFT]!);
        f.ext[EX.WAVE_X] = f.ext[EX.WAVE_X]! + f.ext[EX.WAVE_DIR]! * px(step);
        f.ext[EX.WAVE_LEFT] = f.ext[EX.WAVE_LEFT]! - step;
        const front = f.ext[EX.WAVE_X]!;
        const dir = f.ext[EX.WAVE_DIR]!;
        const y = f.ext[EX.WAVE_Y]!;
        const box: WBox = { x0: Math.min(front, front - dir * px(SLAB_BACK)), x1: Math.max(front, front - dir * px(SLAB_BACK)), y0: y - px(SLAB_H), y1: y + px(2) };
        smashProps(s, f, box, 400, false);
        strikeBox(s, f, box, 'charge');
      }
    }
  },

  start(s, f, id) {
    const who = s.fighters.indexOf(f);
    // 내려찍기: 시작부터 땅에 닿으면 (떨어지기 전이라도) 땅 위에서 내리꽂는다
    f.ext[EX.SLAM] = id === 'slam' ? 1 : 0;
    if (id === 'skill1') {
      // 재현:나: 껍데기를 깎아 다음 평타를 강화한다
      f.ext[EX.SHELL] = Math.max(0, f.ext[EX.SHELL]! - REENACT_COST);
      f.ext[EX.QUIET] = 0;
      f.ext[EX.EMPOWER] = 1;
      f.ext[EX.EMPOWER_T] = EMPOWER_TICKS;
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: 'reenact', combo: f.ext[EX.SHELL] });
    } else if (BASIC.has(id) && f.ext[EX.EMPOWER]! > 0) {
      // 강화된 평타 한 번 (이 기술이 끝나면 지운다)
      f.ext[EX.EMPOWER] = 0;
      f.ext[EX.EMP_NOW] = 1;
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: 'empowered', move: id });
    } else if (id === 'skill2') {
      // 염동력: 앞을 누르고 있으면 끌어당김, 뒤(또는 방향 없음)면 밀어냄
      const fwd = f.facing > 0 ? IN_RIGHT : IN_LEFT;
      f.ext[EX.TK_DIR] = f.prevInput & fwd ? 1 : -1;
      f.ext[EX.TK_PROPS] = 0;
      f.ext[EX.TK_GRAB] = 0;
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: f.ext[EX.TK_DIR] === 1 ? 'pull' : 'push', move: id });
    }
  },

  move(s, f, id) {
    const mv = movesOf(f.char)[id];
    const marks = mv.time.marks;
    // 공중 평타: 감는 동안 공중에 버틴다 (떨어지던 속도를 멈춘다. 솟는 중이면 그대로)
    if (AIR_HANG.has(id) && isAirborne(f)) {
      if (f.t < mv.activeStart && f.vy > 0) f.vy = 0;
      // 앞으로 날던 힘은 해머 무게에 줄어든다 (상대를 지나쳐 날아가지 않게)
      f.vx = Math.trunc((f.vx * 7) / 8);
    }
    if (id === 'slam' && f.ext[EX.SLAM] === 1) {
      // 내려찍기: 치켜드는 동안 공중에 멈췄다가 (slamDrop 틱부터) 수직으로 떨어진다. 땅에 닿을 때까지 떨어지는 자리(slamHold 바로 앞 틱)에 머문다
      if (f.t < marks!.slamDrop!) {
        f.vx = Math.trunc((f.vx * 3) / 4);
        if (f.vy > 0) f.vy = 0;
      } else if (isAirborne(f)) {
        f.ext[EX.SLAM] = 1;
        f.vx = 0;
        f.vy = SLAM_VY;
        if (f.t >= marks!.slamHold!) f.t = marks!.slamHold! - 1;
      }
      return true;
    }
    if (id === 'skill2' && f.ext[EX.TK_GRAB]! > 0) tkCarry(s, f, marks!);
    const hb = activeHitOf(f);
    // 4타 풀스윙: 휘두르는 순간 주변 작은 물건까지 부순다
    if (id === 'atk4' && f.t === mv.activeStart + 1) smashProps(s, f, worldBox(f, SPIN_REACH.x0, SPIN_REACH.x1, -SPIN_REACH.h, 2), PROP_SMASH, false);
    // 해머 평타는 작은 물건을 한 방에 부순다
    if (hb && BASIC.has(id)) smashProps(s, f, hb, PROP_SMASH, false);
    if (id === 'skill2' && hb) {
      // 염동력: 앞쪽 근처 물건을 으스러뜨린다 (큰 물건은 망가짐까지)
      const before = s.props.map((p) => p.stage);
      smashProps(s, f, worldBox(f, TK_REACH.x0, TK_REACH.x1, -TK_REACH.h, 2), 999, false);
      s.props.forEach((p, i) => {
        if (before[i] !== 2 && p.stage === 2) {
          f.ext[EX.TK_PROPS]!++;
          s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: f.x, y: f.y, text: 'crush', combo: i });
        }
      });
    }
    if (id === 'charge' && f.t === marks!.slab) {
      // 머리 위로 치켜든 틱 (떼고 6틱): 발 앞에서 앞쪽 바닥이 일직선으로 차례로 솟구치기 시작한다 (단계마다 더 길게). 들린 바닥은 잔해로 남는다
      const lv = Math.max(1, Math.min(3, f.chargeLv));
      const len = SLAB_LEN[lv - 1]!;
      const x0 = f.x + f.facing * px(SLAB_FROM);
      f.ext[EX.WAVE_X] = x0;
      f.ext[EX.WAVE_LEFT] = len;
      f.ext[EX.WAVE_STEP] = Math.ceil(len / SLAB_TICKS);
      f.ext[EX.WAVE_DIR] = f.facing;
      f.ext[EX.WAVE_Y] = f.y;
      f.ext[EX.RUBBLE_X] = x0;
      f.ext[EX.RUBBLE_LEN] = len;
      f.ext[EX.RUBBLE_DIR] = f.facing;
      f.ext[EX.RUBBLE_Y] = f.y;
      f.ext[EX.RUBBLE_N] = f.ext[EX.RUBBLE_N]! + 1;
      s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: x0, y: f.y, text: 'slabs', combo: len });
    }
    if (id === 'super' && hb && !f.moveHit && !s.cine) {
      // 잡기: 잡는 범위에 상대 몸이 닿으면 막고 있어도 곧바로 연출로 (방어로 막을 수 없다. 무적이면 닿지 않는다)
      const def = other(s, f);
      const hu = hurtOf(def);
      if (hu && overlap(hb, hu)) {
        f.moveHit = true;
        f.moveConnected = true;
        startCine(s, f, def, 'super');
      }
    }
  },

  damage(s, att, def, id, damage) {
    let d = damage;
    if (att.ext[EX.EMP_NOW]! > 0 && BASIC.has(id)) d = Math.trunc((d * EMPOWER_DAMAGE) / 100);
    // 염동력으로 으스러뜨린 물건을 상대에게 날린다
    if (id === 'skill2') d += TK_THROW * Math.min(2, att.ext[EX.TK_PROPS]!);
    void s;
    void def;
    return d;
  },

  breaks(_s, att, _def, id) {
    return att.ext[EX.EMP_NOW]! > 0 && BASIC.has(id);
  },

  defend(s, def, _att, _id, damage) {
    // 껍데기가 먼저 대신 받는다
    def.ext[EX.QUIET] = 0;
    const shell = def.ext[EX.SHELL]!;
    if (shell <= 0) return damage;
    const took = Math.min(shell, damage);
    def.ext[EX.SHELL] = shell - took;
    s.events.push({ type: 'char', who: s.fighters.indexOf(def), x: def.x, y: def.y, text: shell - took > 0 ? 'shell' : 'shellBreak', combo: took });
    return damage - took;
  },

  hit(s, att, def, id, blocked, shielded) {
    if (shielded) return;
    // 강화된 평타는 한 번만 (맞히거나 막히면 끝)
    if (att.ext[EX.EMP_NOW]! > 0 && BASIC.has(id)) att.ext[EX.EMP_NOW] = 0;
    if (id !== 'skill2' || def.mode === 'ko') return;
    // 염동력: 장막이 상대를 움켜쥔다 (옮기는 것은 move의 tkCarry). 막혀도 붙잡는다
    att.ext[EX.TK_GRAB] = att.ext[EX.TK_DIR] === 1 ? 1 : 2;
    att.ext[EX.TK_FROM] = def.x;
    att.ext[EX.TK_Y] = def.y;
    att.ext[EX.TK_BLOCK] = blocked ? 1 : 0;
    att.ext[EX.TK_AIR] = isAirborne(def) ? 1 : 0;
    def.vx = 0;
    def.vy = 0;
    s.events.push({ type: 'char', who: s.fighters.indexOf(att), x: def.x, y: def.y, text: att.ext[EX.TK_GRAB] === 1 ? 'tkGrab' : 'tkWall' });
  },

  altMotion(f, id) {
    // 염동력 밀어냄은 두 손을 모았다 밀치는 그림
    return id === 'skill2' && f.ext[EX.TK_DIR] === -1;
  },

  cineEnd(s, att) {
    // 필살기: 상대의 껍데기를 뒤집어써 껍데기가 크게 찬다
    att.ext[EX.SHELL] = Math.min(SHELL_MAX, att.ext[EX.SHELL]! + SUPER_SHELL);
    att.ext[EX.QUIET] = SHELL_QUIET;
    s.events.push({ type: 'char', who: s.fighters.indexOf(att), x: att.x, y: att.y, text: 'shellFill', combo: att.ext[EX.SHELL] });
  },
};
