import type { Box } from '../data/moves/types';
import { HURT_RULES } from '../data/moves/hurt';
import { frameAtTick, frameFitted, frameStretched, motionOf, movesOf, statsOf, timelineOf, type Timing } from './frames';
import { hooksOf } from './chars';
import type { Fighter } from './types';

/**
 * 상태 → 동작 이름과 구간을 고르는 규칙. sim(피격 상자 시간표)과 렌더(그림 프레임)가 같은 규칙을 쓰고,
 * 각자 자기 박자(timing)와 구간 번호 규칙(rules)을 넘긴다. sim은 그림을 읽지 않는다 (3-0a(2)).
 * 차지 되풀이·순간이동 같은 기술 시간은 공격 데이터의 틱(sim)이라 두 쪽 모두 같은 틱을 쓴다.
 */
export interface PoseTiming {
  timing(name: string): Timing;
  rules: {
    /** 공중에서 맞음: 이 구간(0부터)부터 끝까지 되풀이 */
    hitAirLoopFrom: number;
    /** 벽 붙기: 이 구간부터 끝까지 되풀이 */
    wallClingLoopFrom: number;
    /** 벽 달리기: 이 구간부터는 꼭대기 넘어가기 */
    wallRunTopFrom: number;
    /** 맞는 동작: 경직 길이에 맞춰 늘리는 구간 */
    stretch: Readonly<Record<string, number>>;
  };
}

/** sim의 박자: 피격 상자 시간표 (data/moves/hurt.ts) */
const SIM_TIMING: PoseTiming = { timing: timelineOf, rules: HURT_RULES };

/** 지금 상태의 동작 이름과 피격 상자 시간표 구간 */
export function fighterSpan(f: Fighter): { motion: string; frame: number } {
  const [motion, frame] = pickPose(f, SIM_TIMING);
  return { motion, frame };
}

/** 지금 피격 상자 (발밑 기준, 오른쪽 보는 기준): 피격 상자 시간표에서 */
export function fighterHurt(f: Fighter): Box {
  const [motion, frame] = pickPose(f, SIM_TIMING);
  return timelineOf(motion).hurt[frame]!;
}

/** 상태에 맞는 동작 이름과 구간 (T의 박자로) */
export function pickPose(f: Fighter, T: PoseTiming): [string, number] {
  const R = T.rules;
  const loop = (name: string, t: number): [string, number] => {
    const m = T.timing(name);
    return [name, frameAtTick(m, t % m.total)];
  };
  const once = (name: string, t: number): [string, number] => [name, frameAtTick(T.timing(name), t)];
  const stretch = (name: string, t: number, len: number): [string, number] => [name, frameStretched(T.timing(name), t, len)];
  /** 공통 맞는 동작: 늘어나는 구간의 틱만 바꿔 상태 길이에 맞춘다 (공통 동작 사양서) */
  const fitted = (name: string, t: number, len: number): [string, number] => [name, frameFitted(T.timing(name), t, len, R.stretch[name]!)];
  /** 앞 구간들은 한 번, from번째 구간부터는 되풀이 (벽 붙기: 붙는 순간 뒤 미끄러지는 동안) */
  const holdLoop = (name: string, t: number, from: number): [string, number] => {
    const m = T.timing(name);
    const head = m.cum[from - 1]!;
    if (t < head) return [name, frameAtTick(m, t)];
    const span = m.total - head;
    const u = head + ((t - head) % span);
    return [name, frameAtTick(m, u)];
  };

  switch (f.mode) {
    case 'idle':
      return loop(motionOf(f.char, 'idle'), f.t);
    case 'intro':
      return once(motionOf(f.char, 'intro'), f.t);
    case 'run': {
      // 뛴 거리로 구간을 넘긴다 (발이 미끄러지지 않게)
      const fwd = f.dir > 0;
      const cycle = fwd ? statsOf(f.char).runCycle : statsOf(f.char).runBackCycle;
      const n = T.timing(motionOf(f.char, 'run_f')).dur.length;
      const i = Math.floor(((f.runDist % cycle) * n) / cycle);
      return [fwd ? motionOf(f.char, 'run_f') : motionOf(f.char, 'run_b'), i];
    }
    case 'guard':
      return once(motionOf(f.char, 'guard'), f.t);
    case 'blockstun':
      return stretch(motionOf(f.char, 'guard_hit'), f.t, f.len);
    case 'crush':
      // 가드 크러시 (공통 동작): 크러시 길이가 기본 44틱과 다르면 늘어나는 구간이 늘거나 준다
      return fitted('common/guard_crush', f.t, f.len);
    case 'wallsplat':
      // 정면에 박혀 팔다리를 벌린 모습 (가드 크러시에서 두 팔이 위·뒤로 벌어진 3번째 구간)
      return ['common/guard_crush', 2];
    case 'jumpsquat':
      return [motionOf(f.char, 'jump'), 0];
    case 'air':
      // 벽 점프는 그 동작이 끝날 때까지 (꼭대기를 지나 떨어지는 자세로 이어진다)
      if (f.jumpKind === 3 && f.t < T.timing(motionOf(f.char, 'wall_jump')).total) return once(motionOf(f.char, 'wall_jump'), f.t);
      // 벽 달리기로 꼭대기를 넘어가는 중: 벽 달리기의 뒷부분 (모서리를 잡고 넘어감)
      if (f.jumpKind === 4) {
        const m = T.timing(motionOf(f.char, 'wall_run'));
        const from = m.cum[R.wallRunTopFrom - 1]!;
        if (from + f.t < m.total) return once(motionOf(f.char, 'wall_run'), from + f.t);
      }
      if (f.vy < 0) return f.jumpKind === 2 ? once(motionOf(f.char, 'jump2'), f.t) : once(motionOf(f.char, 'jump'), f.t + 2);
      return once(motionOf(f.char, 'fall'), Math.floor(f.vy / 64));
    case 'land':
      return stretch(motionOf(f.char, 'land'), f.t, Math.max(1, f.len));
    case 'dash':
      return stretch(motionOf(f.char, 'dash'), f.t, statsOf(f.char).dashTicks);
    case 'airdash':
      return stretch(motionOf(f.char, 'air_dash'), f.t, statsOf(f.char).airDashTicks);
    case 'attack': {
      const mv = movesOf(f.char)[f.move!];
      // 캐릭터 규칙이 고른 다른 동작 (박자는 같다)
      if (mv.data.alt && hooksOf(f.char).altMotion?.(f, f.move!)) return once(mv.data.alt, f.t);
      return once(mv.time.motion, f.t);
    }
    case 'hitstun':
      // 약하게 맞음·세게 맞음 (공통 동작): 경직이 길면 늘어나는 구간이 늘고, 짧으면 줄인다
      return fitted(f.heavyHit ? 'common/hit_heavy' : 'common/hit_light', f.t, f.len);
    case 'airhit':
      // 공중에서 맞음: 앞 구간들은 한 번, 떨어지는 동안 뒤 구간들을 되풀이. 다시 맞으면 (상태를 새로 시작해 t = 0) 처음부터
      return holdLoop('common/hit_air', f.t, R.hitAirLoopFrom);
    case 'knockdown':
      // 다운: 마지막 구간(완전히 누운 자세)에서 멈춘 채 누워 기다린다
      return once('common/knockdown', f.t);
    case 'getup':
      return once('common/getup', f.t);
    case 'exhaust':
      return stretch(motionOf(f.char, 'exhaust'), f.t, Math.max(1, f.len));
    case 'tech':
      return once('common/tech', f.t);
    case 'walltech':
      return once(motionOf(f.char, 'wall_tech'), f.t);
    case 'ko':
      // 쓰러짐: 날아가는 동안은 공중에서 맞음, 바닥에 닿으면 (t가 0부터 다시) 다운
      return f.y < f.floor ? holdLoop('common/hit_air', f.t, R.hitAirLoopFrom) : once('common/knockdown', f.t);
    case 'win':
      return once(motionOf(f.char, 'win'), f.t);
    case 'wallcling':
      return holdLoop(motionOf(f.char, 'wall_cling'), f.t, R.wallClingLoopFrom);
    case 'wallrun': {
      // 달려 오르는 구간만 (꼭대기 앞까지), 길게 달리면 마지막 걸음에 머문다
      const m = T.timing(motionOf(f.char, 'wall_run'));
      return [motionOf(f.char, 'wall_run'), Math.min(R.wallRunTopFrom - 1, frameAtTick(m, f.t))];
    }
    case 'cine': {
      // 필살기 연출: 연출 장면의 동작 t틱째 (sim/cine.ts가 정한다)
      const name = f.cineMotion || motionOf(f.char, 'idle');
      return [name, frameAtTick(T.timing(name), f.t)];
    }
    case 'charge': {
      // 모으기: 끌어 모으는 틱은 한 번, 그 뒤 모으는 구간(공격 데이터 charge.loop 틱)을 되풀이 (떼면 기술의 치는 틱으로)
      const mv = movesOf(f.char).charge;
      const [head, end] = mv.time.charge!.loop;
      const m = T.timing(mv.time.motion);
      if (f.t < head) return [mv.time.motion, frameAtTick(m, f.t)];
      return [mv.time.motion, frameAtTick(m, head + ((f.t - head) % (end - head)))];
    }
  }
}
