import type { Joints } from '../anim/pose';
import { frameAtTick, frameStretched, motionFrames, MOVES, STATS } from './frames';
import { GETUP_TICKS, KNOCKDOWN_TICKS } from './rules';
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

function pick(f: Fighter): [string, number] {
  switch (f.mode) {
    case 'idle':
      return loop('base/idle', f.t);
    case 'run': {
      // 뛴 거리로 프레임을 넘긴다 (발이 미끄러지지 않게)
      const fwd = f.dir > 0;
      const cycle = fwd ? STATS.runCycle : STATS.runBackCycle;
      const n = motionFrames('base/run_f').dur.length;
      const i = Math.floor(((f.runDist % cycle) * n) / cycle);
      return [fwd ? 'base/run_f' : 'base/run_b', i];
    }
    case 'guard':
      return once('base/guard', f.t);
    case 'blockstun':
      return stretch('base/guard_hit', f.t, f.len);
    case 'crush':
      return stretch('base/guard_crush', f.t, f.len);
    case 'wallsplat':
      // 정면에 박혀 팔다리를 벌린 모습 (가드 크러시의 젖혀진 프레임)
      return ['base/guard_crush', 5];
    case 'jumpsquat':
      return ['base/jump', 0];
    case 'air':
      if (f.vy < 0) return f.jumpKind === 2 ? once('base/jump2', f.t) : once('base/jump', f.t + 2);
      return once('base/fall', Math.floor(f.vy / 64));
    case 'land':
      return stretch('base/land', f.t, Math.max(1, f.len));
    case 'dash':
      return stretch('base/dash', f.t, STATS.dashTicks);
    case 'airdash':
      return stretch('base/air_dash', f.t, STATS.airDashTicks);
    case 'attack':
      return once(MOVES[f.move!].frames.name, f.t);
    case 'hitstun':
      return stretch(f.heavyHit ? 'base/hit_heavy' : 'base/hit_light', f.t, f.len);
    case 'airhit':
      return loop('base/hit_air', f.t);
    case 'knockdown':
      return stretch('base/knockdown', f.t, KNOCKDOWN_TICKS);
    case 'getup':
      return stretch('base/getup', f.t, GETUP_TICKS);
    case 'tech':
      return stretch('base/tech', f.t, Math.max(1, f.len));
    case 'ko':
      return f.y < 0 ? loop('base/hit_air', f.t) : stretch('base/knockdown', Math.min(f.t, KNOCKDOWN_TICKS), KNOCKDOWN_TICKS);
    case 'win':
      return once('base/win', f.t);
  }
}
