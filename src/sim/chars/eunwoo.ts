import type { CharHooks } from '.';
import { ANSWER_TELE_TICK } from '../../data/poses/eunwoo/skill';
import { movesOf, statsOf } from '../frames';
import { IN_DOWN, IN_LEFT, IN_RIGHT, IN_UP } from '../input';
import { wallLeft } from '../platforms';
import { px, WALL_R } from '../rules';
import type { Fighter, Mode, SimState } from '../types';

/*
 * 백은우 고유 규칙 (캐릭터 기획서). 상태는 f.ext 칸 번호(EW)로, 모두 결정론 (정수 틱·1/256px).
 * - 고유 특성 백합 낙인: 자기를 치유하면(스킬 2, 필살기) 낙인이 생긴다. 낙인이 있는 동안 다음 공격 한 번을 방어막이 막고(체력·경직 없음)
 *   낙인은 사라진다. 막기(가드)와 따로 맞을 때만, 필살기 연출의 끝 타격은 막지 않는다.
 * - 스킬 1 응답: 3프레임이 시작하는 틱에 고른 방향(8방향, 안 누르면 앞)으로 금색 실을 따라 순간이동 (가로 76px · 세로 56px, 대각은 0.75배).
 *   공중에서도 쓰고, 기술이 끝나기 전에 스킬 1을 다시 누르면 기력 없이 이어서 튄다 (처음 것까지 3번).
 * - 스킬 2 아직 여기 있어: 흰 나비들이 5초 동안 몸 주위를 돌며 10틱마다 체력 3씩(모두 90) 차고, 뛰는 속도가 25% 빨라진다. 백합 낙인.
 * - 필살기 선의: 연출 끝에 은우는 체력 260을 되찾고 백합 낙인을 얻는다. 상대는 5초 동안 몸이 무거워진다:
 *   처음부터 반 속도(느려짐), 2초가 지나면 6틱마다·4초가 지나면 3틱마다 한 틱씩 더 멈춰 점점 더 둔해진다 (맞는 경직 중에는 멈추지 않는다).
 */

/** f.ext 칸 번호 */
export const EW = {
  /** 백합 낙인 (1 있음) */
  LILY: 0,
  /** 스킬 2 남은 틱 */
  BUFF: 1,
  /** 응답: 이번 기술에서 더 이어 튈 수 있는 횟수 */
  CHAIN: 2,
  /** 필살기로 상대에게 건 둔해짐 남은 틱 */
  DULL: 3,
  /** 스킬 2로 회복한 양 (확인용) */
  HEALED: 4,
  /** 백합 방어막이 막아 낸 뒤 미끄러지는 남은 틱, 방향 (+1 오른쪽) */
  SLIDE: 5,
  SLIDE_DIR: 6,
} as const;

export const EUNWOO_RULES = {
  TELE_X: 76,
  TELE_Y: 56,
  /** 방향 없이 쓰면 앞의 상대 바로 앞(가운데끼리 이만큼)에 내려선다 */
  TELE_GAP: 30,
  /** 응답 한 번에 튀는 횟수 (처음 것 포함) */
  CHAIN_MAX: 3,
  SKILL2_TICKS: 300,
  /** 스킬 2: 이 틱마다 체력 */
  SKILL2_EVERY: 10,
  SKILL2_HEAL: 3,
  /** 스킬 2: 뛰는 속도 더하기 (%) */
  SKILL2_SPEED: 25,
  /** 백합 방어막이 막아 낸 뒤 뒤로 미끄러지는 거리 (틱마다 px, 모두 8px) */
  SHIELD_SLIDE: [2, 2, 1.5, 1, 1, 0.5],
  SUPER_HEAL: 260,
  DULL_TICKS: 300,
} as const;

/** 둔해짐이 걸리는 상태 (스스로 움직이는 상태. 맞거나 막는 경직·다운은 아니다) */
const DULLABLE: ReadonlySet<Mode> = new Set(['idle', 'run', 'guard', 'jumpsquat', 'air', 'land', 'dash', 'airdash', 'attack', 'charge', 'wallcling', 'wallrun']);

const other = (s: SimState, f: Fighter): Fighter => s.fighters[1 - s.fighters.indexOf(f)];

/** 응답: 고른 방향으로 순간이동 (맵 끝 벽 안, 땅 아래로는 안 감) */
function teleport(s: SimState, f: Fighter, input: number): void {
  const R = EUNWOO_RULES;
  let h = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
  const v = (input & IN_DOWN ? 1 : 0) - (input & IN_UP ? 1 : 0);
  const free = !h && !v;
  if (free) h = f.facing;
  const k = h && v ? 0.75 : 1;
  const x0 = f.x;
  const y0 = f.y;
  const y = Math.min(0, f.y + px(v * R.TELE_Y * k));
  let tx = f.x + px(h * R.TELE_X * k);
  // 방향을 고르지 않으면 앞의 상대에게 실을 걸어 바로 앞(가운데끼리 30px)에 내려선다 (멀면 76px까지, 이미 가까우면 제자리)
  const o = other(s, f);
  const ahead = (o.x - f.x) * f.facing;
  if (free && o.mode !== 'ko' && ahead > 0 && ahead <= px(R.TELE_X + R.TELE_GAP) && Math.abs(o.y - f.y) < px(60)) {
    tx = ahead > px(R.TELE_GAP) ? o.x - f.facing * px(R.TELE_GAP) : f.x;
  }
  const x = Math.max(wallLeft(y), Math.min(WALL_R, tx));
  f.x = x;
  f.y = y;
  if (y < 0) f.floor = 0;
  f.vx = 0;
  f.vy = 0;
  f.invuln = Math.max(f.invuln, 3);
  s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: x0, y: y0, to: x, combo: y, text: 'teleport', move: 'skill1' });
}

export const EUNWOO_HOOKS: CharHooks = {
  tick(s, f) {
    const R = EUNWOO_RULES;
    const e = f.ext;
    // 백합 방어막이 막아 낸 뒤: 맞는 동작 없이 조금 미끄러진다 (히트스톱이 끝난 뒤)
    if (e[EW.SLIDE] > 0 && f.hitstop === 0 && !s.cine) {
      const k = R.SHIELD_SLIDE[R.SHIELD_SLIDE.length - e[EW.SLIDE]]!;
      f.x = Math.max(wallLeft(f.y), Math.min(WALL_R, f.x + e[EW.SLIDE_DIR] * px(k)));
      e[EW.SLIDE]--;
    }
    // 스킬 2: 나비가 도는 동안 조금씩 회복, 뛰는 속도 25% 더
    if (e[EW.BUFF] > 0) {
      e[EW.BUFF]--;
      if (e[EW.BUFF] % R.SKILL2_EVERY === 0 && f.hp > 0) {
        const before = f.hp;
        f.hp = Math.min(statsOf(f.char).hp, f.hp + R.SKILL2_HEAL);
        e[EW.HEALED] += f.hp - before;
      }
      if (f.mode === 'run') f.x = Math.max(wallLeft(f.y), Math.min(WALL_R, f.x + Math.trunc((f.vx * R.SKILL2_SPEED) / 100)));
    }
    // 필살기 선의의 둔해짐: 상대가 반 속도로, 시간이 갈수록 한 틱씩 더 멈춘다
    if (e[EW.DULL] > 0) {
      e[EW.DULL]--;
      const o = other(s, f);
      if (o.mode === 'ko') e[EW.DULL] = 0;
      else {
        if (o.slowT === 0) o.slowT = Math.min(60, e[EW.DULL]);
        const passed = R.DULL_TICKS - e[EW.DULL];
        const every = passed >= 240 ? 3 : passed >= 120 ? 6 : 0;
        if (every && passed % every === 0 && DULLABLE.has(o.mode) && o.hitstop === 0) o.hitstop = 1;
      }
    }
  },
  start(s, f, id) {
    const e = f.ext;
    const who = s.fighters.indexOf(f);
    if (id === 'skill1') e[EW.CHAIN] = EUNWOO_RULES.CHAIN_MAX - 1;
    if (id === 'skill2') {
      // 아직 여기 있어: 나비들이 돌며 회복·빨라짐, 자기를 치유했으니 백합 낙인
      e[EW.BUFF] = EUNWOO_RULES.SKILL2_TICKS;
      e[EW.LILY] = 1;
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: 'butterfly', move: id });
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: 'lily', move: id });
    }
  },
  move(s, f, id, input) {
    if (id !== 'skill1') return;
    // 응답: 3프레임 시작 틱에 순간이동, 그 뒤로는 떠 있다가(중력을 거의 받지 않고 천천히) 내려온다
    if (f.t === ANSWER_TELE_TICK) teleport(s, f, input);
    if (f.t >= ANSWER_TELE_TICK) {
      f.vx = 0;
      f.vy = Math.min(f.vy, 0);
      // 기술이 끝나기 전에 스킬 1을 다시 누르면 기력 없이 이어 튄다 (처음부터 다시)
      if (f.ext[EW.CHAIN] > 0 && f.buf[3] > 0) {
        f.buf[3] = 0;
        f.ext[EW.CHAIN]--;
        f.t = 1;
        f.moveHit = false;
      }
    }
    return true;
  },
  defend(_s, def, att, id, damage) {
    // 백합 낙인: 다음 공격 한 번을 방어막이 막는다 (필살기 연출의 끝 타격은 막지 않는다)
    if (def.ext[EW.LILY] > 0 && !movesOf(att.char)[id].data.cinematic) {
      def.ext[EW.LILY] = 0;
      // 맞는 동작 없이 조금만 뒤로 미끄러진다 (11-4): 히트스톱이 끝난 뒤 몇 틱 동안 (tick)
      def.ext[EW.SLIDE] = EUNWOO_RULES.SHIELD_SLIDE.length;
      def.ext[EW.SLIDE_DIR] = def.x >= att.x ? 1 : -1;
      return -1;
    }
    return damage;
  },
  cineEnd(s, att, _def, id) {
    if (id !== 'super') return;
    // 선의: 크게 회복하고 백합 낙인, 상대는 한동안 몸이 무거워진다
    att.hp = Math.min(statsOf(att.char).hp, att.hp + EUNWOO_RULES.SUPER_HEAL);
    att.ext[EW.LILY] = 1;
    att.ext[EW.DULL] = EUNWOO_RULES.DULL_TICKS;
    s.events.push({ type: 'char', who: s.fighters.indexOf(att), x: att.x, y: att.y, text: 'lily', move: id });
  },
};
