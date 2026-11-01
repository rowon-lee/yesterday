import type { MoveId } from '../../data/moves/base';
import { CITY_RULES } from '../../stage/citadel';
import { wallBehind, wallSplat } from '../city';
import { startCine } from '../cine';
import { activeHitOf, hurtOf, overlap, strikeBox, type WBox } from '../combat';
import { isAirborne, setMode } from '../fighter';
import { movesOf } from '../frames';
import { IN_LEFT, IN_RIGHT } from '../input';
import { smashProps } from '../props';
import { px } from '../rules';
import type { Fighter, SimState } from '../types';
import type { CharHooks } from '.';

/*
 * 에드워드 '아서' 와인포드 고유 규칙 (캐릭터 기획서).
 * - 고유 특성 껍데기: 체력바 위에 따로 있는 푸른 껍데기 게이지. 맞으면 피해를 껍데기가 먼저 대신 받는다 (경직·날림은 그대로).
 *   SHELL_QUIET틱(3초) 동안 맞지 않으면 SHELL_REGEN틱마다 1씩 천천히 찬다. 라운드마다 가득 찬 채(300) 시작. 체력 자체는 가장 낮다 (820).
 * - 평타(해머)는 작은 물건(가로등·쇼윈도·가판대·소화전)을 한 방에 부순다. 자동차는 두 방.
 * - 스킬 1 재현:나: 기력 1칸 + 껍데기 REENACT_COST를 깎아 다음 평타 한 번을 크게 강화한다 (피해 ×1.7, 막혀도 방어가 깨진다).
 *   EMPOWER_TICKS(6초) 안에 평타를 내지 않으면 사라진다.
 * - 스킬 2 불완전한 염동력: 앞+스킬 2는 상대를 앞(에드워드 앞 36px)으로 끌어당기고, 뒤+스킬 2(방향 없이도)는 밀어내 날린다
 *   (뒤에 건물 정면이 있으면 벽꽝). 막혀도 끌려오고 밀려난다. 앞쪽 근처의 자동차·가로등 같은 물건을 으스러뜨리고,
 *   으스러뜨린 물건(최대 2개)을 상대에게 날려 하나마다 피해 +35.
 * - 차지 워 해머 내려치기: 해머가 땅에 박히면 충격파가 앞으로 바닥을 타고 달린다 (단계별 거리 70·100·140px, 틱마다 8px).
 *   해머 머리에 맞지 않았으면 충격파가 맞힌다 (상대를 띄운다). 지나는 자리의 물건을 부순다.
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
} as const;

export const SHELL_MAX = 300;
/** 이만큼 맞지 않으면 차기 시작 (3초) */
export const SHELL_QUIET = 180;
/** 이 틱마다 1씩 찬다 */
export const SHELL_REGEN = 2;
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
/** 염동력: 끌어당겨 멈추는 거리 (몸 가운데끼리), 물건을 으스러뜨리는 범위 (발밑 기준 앞쪽), 날린 물건 하나 피해 */
const TK_STOP = px(36);
const TK_REACH: { x0: number; x1: number; h: number } = { x0: -24, x1: 170, h: 130 };
const TK_THROW = 35;
/** 차지 충격파: 단계별 거리 (px), 틱마다 나아가는 거리 (px) */
const WAVE_LEN = [70, 100, 140];
const WAVE_SPEED = 8;

/** 해머 평타 (재현:나가 강화하고, 작은 물건을 한 방에 부순다) */
const BASIC: ReadonlySet<MoveId> = new Set(['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick']);

const other = (s: SimState, f: Fighter): Fighter => s.fighters[1 - s.fighters.indexOf(f)];

/** 발밑 기준 상자 → 월드 상자 (1/256px) */
function worldBox(f: Fighter, x0: number, x1: number, y0: number, y1: number): WBox {
  const a = f.facing > 0 ? x0 : -x1;
  const b = f.facing > 0 ? x1 : -x0;
  return { x0: f.x + px(a), x1: f.x + px(b), y0: f.y + px(y0), y1: f.y + px(y1) };
}

export const EDWARD_HOOKS: CharHooks = {
  reset(_s, f) {
    f.ext[EX.SHELL] = SHELL_MAX;
    f.ext[EX.QUIET] = SHELL_QUIET;
  },

  tick(s, f) {
    // 껍데기: 3초 동안 맞지 않으면 천천히 찬다
    if (f.ext[EX.QUIET]! < SHELL_QUIET) f.ext[EX.QUIET]!++;
    else if (f.ext[EX.SHELL]! < SHELL_MAX && s.tick % SHELL_REGEN === 0) f.ext[EX.SHELL]!++;
    // 재현:나: 시간이 지나면 사라지고, 강화된 평타가 끝나면 지운다
    if (f.ext[EX.EMPOWER]! > 0 && --f.ext[EX.EMPOWER_T]! <= 0) {
      f.ext[EX.EMPOWER] = 0;
      s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: f.x, y: f.y, text: 'empowerFade' });
    }
    if (f.ext[EX.EMP_NOW]! > 0 && (f.mode !== 'attack' || !f.move || !BASIC.has(f.move))) f.ext[EX.EMP_NOW] = 0;
    // 차지 충격파: 바닥을 타고 앞으로 달린다 (해머 머리에 맞지 않았으면 맞힌다, 지나는 물건을 부순다)
    if (f.ext[EX.WAVE_LEFT]! > 0) {
      if (f.mode !== 'attack' || f.move !== 'charge') f.ext[EX.WAVE_LEFT] = 0;
      else {
        const step = Math.min(WAVE_SPEED, f.ext[EX.WAVE_LEFT]!);
        f.ext[EX.WAVE_X] = f.ext[EX.WAVE_X]! + f.ext[EX.WAVE_DIR]! * px(step);
        f.ext[EX.WAVE_LEFT] = f.ext[EX.WAVE_LEFT]! - step;
        const front = f.ext[EX.WAVE_X]!;
        const dir = f.ext[EX.WAVE_DIR]!;
        const y = f.ext[EX.WAVE_Y]!;
        const box: WBox = { x0: Math.min(front, front - dir * px(14)), x1: Math.max(front, front - dir * px(14)), y0: y - px(18), y1: y + px(2) };
        smashProps(s, f, box, 400, false);
        strikeBox(s, f, box, 'charge');
      }
    }
  },

  start(s, f, id) {
    const who = s.fighters.indexOf(f);
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
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: f.ext[EX.TK_DIR] === 1 ? 'pull' : 'push', move: id });
    }
  },

  move(s, f, id) {
    const mv = movesOf(f.char)[id];
    const hb = activeHitOf(f);
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
    if (id === 'charge' && f.t === mv.activeStart + 1) {
      // 해머가 땅에 박힌 틱: 충격파가 해머 머리 자리에서 출발한다 (단계마다 더 멀리)
      const lv = Math.max(1, Math.min(3, f.chargeLv));
      f.ext[EX.WAVE_X] = f.x + f.facing * px(54);
      f.ext[EX.WAVE_LEFT] = WAVE_LEN[lv - 1]!;
      f.ext[EX.WAVE_DIR] = f.facing;
      f.ext[EX.WAVE_Y] = f.y;
      s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: f.ext[EX.WAVE_X]!, y: f.y, text: 'wave', combo: WAVE_LEN[lv - 1] });
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
    const dir = att.facing;
    if (att.ext[EX.TK_DIR] === 1) {
      // 끌어당김: 에드워드 앞 TK_STOP까지 미끄러져 온다 (경직 동안 틱마다 13/16로 줄어드는 속도의 합 = 남은 거리)
      const dist = Math.abs(def.x - att.x);
      const v = Math.max(0, Math.trunc(((dist - TK_STOP) * 3) / 13));
      def.vx = -dir * v;
      if (isAirborne(def)) def.vy = Math.min(def.vy, px(-2));
      return;
    }
    // 밀어냄: 막히면 크게 밀려나고, 맞으면 날아간다 (뒤에 건물 정면이 있으면 벽꽝)
    if (blocked) {
      def.vx = dir * px(7);
      return;
    }
    const sx = Math.round(def.x / 256);
    const sh = Math.round(-def.y / 256) + 22;
    if (wallBehind(s, sx, sh)) {
      setMode(def, 'wallsplat', CITY_RULES.wallsplat.ticks);
      def.vx = 0;
      def.vy = 0;
      def.wallFly = false;
      wallSplat(s, def, s.fighters.indexOf(att));
      return;
    }
    setMode(def, 'airhit', 30);
    def.vx = dir * px(9);
    def.vy = px(-4.5);
    def.y = Math.min(def.y, -1);
    def.floor = 0;
    def.wallFly = true;
  },

  cineEnd(s, att) {
    // 필살기: 상대의 껍데기를 뒤집어써 껍데기가 크게 찬다
    att.ext[EX.SHELL] = Math.min(SHELL_MAX, att.ext[EX.SHELL]! + SUPER_SHELL);
    att.ext[EX.QUIET] = SHELL_QUIET;
    s.events.push({ type: 'char', who: s.fighters.indexOf(att), x: att.x, y: att.y, text: 'shellFill', combo: att.ext[EX.SHELL] });
  },
};
