import { STATS } from './frames';
import { faceOpponent, physics, readButtons, setMode, settle, updateFighter, isAirborne } from './fighter';
import { resolveHits } from './combat';
import { crashProps, createProps, hitProps } from './props';
import { createCity, flyThroughCity } from './city';
import { wallLeft } from './platforms';
import type { PlayerInput } from './input';
import {
  GUARD_MAX, INTRO_TICKS, MAX_SEPARATION, px, PUSH_H, PUSH_W, ROUND_END_TICKS, ROUND_TICKS, START_GAP,
  MAX_ROUNDS, STAGE_W, WALL_R, WINS_NEEDED,
} from './rules';
import type { Fighter, SimState } from './types';

export type { Fighter, SimState, SimEvent, Mode, Phase } from './types';
export { SUBPX } from './rules';

function newFighter(x: number, facing: 1 | -1): Fighter {
  return {
    x, y: 0, vx: 0, vy: 0, facing, mode: 'idle', t: 0, len: 0,
    move: null, moveHit: false, moveConnected: false, queued: null, dir: 1, jumpKind: 0,
    hp: STATS.hp, meter: 0, guard: GUARD_MAX, guardWait: 0, hitstop: 0, invuln: 0, flash: 0,
    airJumpUsed: false, airDashUsed: false, comboHits: 0, bounce: false, heavyHit: false,
    runDist: 0, wins: 0, atkDir: 0, buf: [0, 0, 0, 0, 0, 0], prevInput: 0, propHits: [], cityHits: [], floor: 0, dropT: 0,
    wallFly: false, wallId: -1, wallCount: 0, wallX: 0, wallSide: 0,
  };
}

export function createState(seed: number): SimState {
  const s: SimState = {
    tick: 0, clock: 0, rng: seed | 0, phase: 'intro', phaseT: 0, round: 1, timer: ROUND_TICKS, freeze: 0,
    roundWinner: -1, matchWinner: -1,
    fighters: [newFighter(0, 1), newFighter(0, -1)],
    events: [],
    // 부서지는 물건과 건물은 라운드가 넘어가도 남는다 (3라운드쯤이면 거리가 폐허). 새 경기에만 새로
    props: createProps(),
    city: createCity(),
    slow: 0,
  };
  resetRound(s);
  return s;
}

function resetRound(s: SimState): void {
  const mid = px(STAGE_W / 2);
  s.fighters.forEach((f, i) => {
    const keep = { wins: f.wins, meter: f.meter };
    Object.assign(f, newFighter(mid + (i === 0 ? -START_GAP : START_GAP), i === 0 ? 1 : -1), keep);
  });
  s.phase = 'intro';
  s.phaseT = 0;
  s.timer = ROUND_TICKS;
  s.roundWinner = -1;
}

/** 한 틱 진행. 입력 두 개 → 상태 갱신. 같은 입력이면 언제나 같은 결과. */
export function step(s: SimState, inputs: readonly [PlayerInput, PlayerInput]): void {
  s.tick++;
  s.phaseT++;
  s.events = [];
  const [a, b] = s.fighters;
  readButtons(a, inputs[0]);
  readButtons(b, inputs[1]);

  if (s.phase === 'matchEnd') {
    s.clock++;
    for (const f of s.fighters) stepFighter(s, f, 0, false);
    return;
  }

  // 필살 컷인: 둘 다 멈춘다
  if (s.freeze > 0) {
    s.freeze--;
    return;
  }
  // 건물이 무너질 때: 게임 시간이 반 속도 (한 틱 걸러 한 번만 진행)
  if (s.slow > 0) {
    s.slow--;
    if (s.slow % 2 === 1) return;
  }
  s.clock++;

  const fighting = s.phase === 'fight';
  stepFighter(s, a, inputs[0], fighting);
  stepFighter(s, b, inputs[1], fighting);
  separate(a, b);
  // 밀려서 발판 끝을 넘었으면 떨어진다
  settle(s, a);
  settle(s, b);
  resolveHits(s);
  crashProps(s);
  hitProps(s);
  flyThroughCity(s);
  faceOpponent(a, b);
  faceOpponent(b, a);
  roundFlow(s);
}

function stepFighter(s: SimState, f: Fighter, input: PlayerInput, controllable: boolean): void {
  // 맞아서 떠오르기 시작했으면 (히트스톱으로 멈춰 있어도) 서 있던 바닥을 떠난다
  if (f.vy < 0) f.floor = 0;
  // 히트스톱 동안 멈춤 (버튼 눌림은 기억)
  if (f.hitstop > 0) {
    f.hitstop--;
    return;
  }
  updateFighter(s, f, input, controllable);
  physics(s, f);
}

/** 맵 끝 벽 안으로 (서쪽은 컨테이너 더미 높이 위면 더미 위까지) */
const clampX = (f: Fighter): void => {
  f.x = Math.max(wallLeft(f.y), Math.min(WALL_R, f.x));
};

/** 몸이 겹치지 않게, 벽 밖으로 나가지 않게, 둘이 화면 한 칸 안에 있게 */
function separate(a: Fighter, b: Fighter): void {
  clampX(a);
  clampX(b);
  const dx = b.x - a.x;
  if (Math.abs(dx) < PUSH_W && Math.abs(a.y - b.y) < PUSH_H && a.mode !== 'ko' && b.mode !== 'ko') {
    const sign = dx !== 0 ? Math.sign(dx) : a.facing;
    const over = PUSH_W - Math.abs(dx);
    const half = Math.trunc(over / 2);
    a.x -= sign * half;
    b.x += sign * (over - half);
    // 벽에 막히면 남은 만큼 반대쪽이 밀린다
    for (const [f, o] of [[a, b], [b, a]] as const) {
      const left = wallLeft(f.y);
      if (f.x < left) {
        o.x += left - f.x;
        f.x = left;
      }
      if (f.x > WALL_R) {
        o.x -= f.x - WALL_R;
        f.x = WALL_R;
      }
    }
  }
  const sep = b.x - a.x;
  if (Math.abs(sep) > MAX_SEPARATION) {
    const excess = Math.abs(sep) - MAX_SEPARATION;
    const sign = Math.sign(sep);
    // 멀어지는 쪽을 붙잡는다
    const aAway = -sign * a.vx > 0;
    const bAway = sign * b.vx > 0;
    if (aAway && !bAway) a.x += sign * excess;
    else if (bAway && !aAway) b.x -= sign * excess;
    else {
      const h = Math.trunc(excess / 2);
      a.x += sign * h;
      b.x -= sign * (excess - h);
    }
  }
  clampX(a);
  clampX(b);
}

function roundFlow(s: SimState): void {
  const [a, b] = s.fighters;
  switch (s.phase) {
    case 'intro':
      if (s.phaseT === 1) s.events.push({ type: 'round', who: -1, x: 0, y: 0, text: `ROUND ${s.round}` });
      if (s.phaseT >= INTRO_TICKS) {
        s.phase = 'fight';
        s.phaseT = 0;
        s.events.push({ type: 'fight', who: -1, x: 0, y: 0, text: 'FIGHT' });
      }
      break;
    case 'fight': {
      s.timer--;
      const koA = a.hp <= 0;
      const koB = b.hp <= 0;
      if (koA || koB || s.timer <= 0) {
        let w = -1;
        if (koA && !koB) w = 1;
        else if (koB && !koA) w = 0;
        else if (!koA && !koB) {
          if (s.timer <= 0) s.events.push({ type: 'timeup', who: -1, x: 0, y: 0, text: 'TIME' });
          w = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
        }
        s.roundWinner = w;
        if (w >= 0) s.fighters[w].wins++;
        s.phase = 'roundEnd';
        s.phaseT = 0;
      }
      break;
    }
    case 'roundEnd': {
      const w = s.roundWinner;
      if (w >= 0 && s.phaseT >= 60) {
        const f = s.fighters[w];
        if (f.mode !== 'win' && !isAirborne(f) && ['idle', 'run', 'guard', 'land', 'attack', 'blockstun', 'hitstun', 'dash'].includes(f.mode)) {
          setMode(f, 'win');
          f.vx = 0;
        }
      }
      if (s.phaseT >= ROUND_END_TICKS) {
        let champ = s.fighters.findIndex((f) => f.wins >= WINS_NEEDED);
        // 무승부가 이어져 끝나지 않는 것을 막는다: 최대 라운드에서 끝낸다
        const last = s.round >= MAX_ROUNDS;
        if (last && champ < 0) champ = a.wins === b.wins ? -1 : a.wins > b.wins ? 0 : 1;
        if (champ >= 0 || last) {
          s.matchWinner = champ;
          s.phase = 'matchEnd';
          s.phaseT = 0;
          s.events.push({ type: 'winner', who: champ, x: 0, y: 0 });
        } else {
          s.round++;
          resetRound(s);
        }
      }
      break;
    }
    default:
      break;
  }
}
