import type { Joints } from '../anim/pose';
import { HIT_AIR_LOOP_FROM, HIT_STRETCH } from '../data/poses/common';
import { WALL_CLING_LOOP_FROM, WALL_RUN_TOP_FROM } from '../data/poses/wall';
import { frameAtTick, frameFitted, frameStretched, motionFrames, motionOf, MOVES, statsOf } from './frames';
import type { Fighter } from './types';

/**
 * 지금 상태에 맞는 그림과 프레임. 판정(관절 위치)과 렌더가 같은 함수를 쓴다.
 */
export function fighterPose(f: Fighter): { motion: string; frame: number; joints: Joints } {
  const [motion, frame] = pick(f);
  const m = motionFrames(motion);
  return { motion, frame, joints: m.joints[frame] };
}

function loop(name: string, t: number): [string, number] {
  const m = motionFrames(name);
  return [name, frameAtTick(m, t % m.total)];
}
function once(name: string, t: number): [string, number] {
  return [name, frameAtTick(motionFrames(name), t)];
}
function stretch(name: string, t: number, len: number): [string, number] {
  return [name, frameStretched(motionFrames(name), t, len)];
}
/** 공통 맞는 동작: 늘어나는 프레임의 표시 틱만 바꿔 상태 길이에 맞춘다 (공통 동작 사양서) */
function fitted(name: string, t: number, len: number): [string, number] {
  return [name, frameFitted(motionFrames(name), t, len, HIT_STRETCH[name])];
}
/** 앞 프레임들은 한 번, from번째 프레임부터는 되풀이 (벽 붙기: 붙는 순간 뒤 미끄러지는 동안) */
function holdLoop(name: string, t: number, from: number): [string, number] {
  const m = motionFrames(name);
  const head = m.cum[from - 1];
  if (t < head) return [name, frameAtTick(m, t)];
  const span = m.total - head;
  const u = head + ((t - head) % span);
  return [name, frameAtTick(m, u)];
}

function pick(f: Fighter): [string, number] {
  switch (f.mode) {
    case 'idle':
      return loop(motionOf(f.char, 'idle'), f.t);
    case 'intro':
      return once(motionOf(f.char, 'intro'), f.t);
    case 'run': {
      // 뛴 거리로 프레임을 넘긴다 (발이 미끄러지지 않게)
      const fwd = f.dir > 0;
      const cycle = fwd ? statsOf(f.char).runCycle : statsOf(f.char).runBackCycle;
      const n = motionFrames(motionOf(f.char, 'run_f')).dur.length;
      const i = Math.floor(((f.runDist % cycle) * n) / cycle);
      return [fwd ? motionOf(f.char, 'run_f') : motionOf(f.char, 'run_b'), i];
    }
    case 'guard':
      return once(motionOf(f.char, 'guard'), f.t);
    case 'blockstun':
      return stretch(motionOf(f.char, 'guard_hit'), f.t, f.len);
    case 'crush':
      // 가드 크러시 (공통 동작): 크러시 길이가 기본 44틱과 다르면 7번 프레임이 늘거나 준다
      return fitted('common/guard_crush', f.t, f.len);
    case 'wallsplat':
      // 정면에 박혀 팔다리를 벌린 모습 (가드 크러시에서 두 팔이 위·뒤로 벌어진 3번 프레임)
      return ['common/guard_crush', 2];
    case 'jumpsquat':
      return [motionOf(f.char, 'jump'), 0];
    case 'air':
      // 벽 점프는 그 그림이 끝날 때까지 (꼭대기를 지나 떨어지는 자세로 이어진다)
      if (f.jumpKind === 3 && f.t < motionFrames(motionOf(f.char, 'wall_jump')).total) return once(motionOf(f.char, 'wall_jump'), f.t);
      // 벽 달리기로 꼭대기를 넘어가는 중: 벽 달리기 그림의 뒷부분 (모서리를 잡고 넘어감)
      if (f.jumpKind === 4) {
        const m = motionFrames(motionOf(f.char, 'wall_run'));
        const from = m.cum[WALL_RUN_TOP_FROM - 1];
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
    case 'attack':
      return once(MOVES[f.move!].frames.name, f.t);
    case 'hitstun':
      // 약하게 맞음·세게 맞음 (공통 동작): 경직이 길면 늘어나는 프레임(5번·6번)이 늘고, 짧으면 줄인다
      return fitted(f.heavyHit ? 'common/hit_heavy' : 'common/hit_light', f.t, f.len);
    case 'airhit':
      // 공중에서 맞음: 1~9번은 한 번, 떨어지는 동안 10~12번을 되풀이. 다시 맞으면 (상태를 새로 시작해 t = 0) 1번부터
      return holdLoop('common/hit_air', f.t, HIT_AIR_LOOP_FROM);
    case 'knockdown':
      // 다운: 14번(완전히 누운 자세)에서 멈춘 채 누워 기다린다
      return once('common/knockdown', f.t);
    case 'getup':
      return once('common/getup', f.t);
    case 'tech':
      return once('common/tech', f.t);
    case 'walltech':
      return once(motionOf(f.char, 'wall_tech'), f.t);
    case 'ko':
      // 쓰러짐: 날아가는 동안은 공중에서 맞음, 바닥에 닿으면 (t가 0부터 다시) 다운
      return f.y < f.floor ? holdLoop('common/hit_air', f.t, HIT_AIR_LOOP_FROM) : once('common/knockdown', f.t);
    case 'win':
      return once(motionOf(f.char, 'win'), f.t);
    case 'wallcling':
      return holdLoop(motionOf(f.char, 'wall_cling'), f.t, WALL_CLING_LOOP_FROM);
    case 'wallrun': {
      // 달려 오르는 구간만 (꼭대기 앞까지), 길게 달리면 마지막 걸음에 머문다
      const m = motionFrames(motionOf(f.char, 'wall_run'));
      return [motionOf(f.char, 'wall_run'), Math.min(WALL_RUN_TOP_FROM - 1, frameAtTick(m, f.t))];
    }
    case 'cine': {
      // 필살기 연출: 연출 장면의 동작 t틱째 (sim/cine.ts가 정한다)
      const name = f.cineMotion || motionOf(f.char, 'idle');
      return [name, frameAtTick(motionFrames(name), f.t)];
    }
    case 'charge': {
      // 모으기: 끌어 모으는 프레임은 한 번, 그 뒤 모으는 프레임(windup ~ loopTo)을 되풀이 (떼면 기술의 치는 프레임으로)
      const mv = MOVES.charge;
      const c = mv.data.charge!;
      const m = mv.frames;
      const head = m.cum[c.windup - 1];
      if (f.t < head) return [m.name, frameAtTick(m, f.t)];
      const span = m.cum[c.loopTo] - head;
      return [m.name, frameAtTick(m, head + ((f.t - head) % span))];
    }
  }
}
