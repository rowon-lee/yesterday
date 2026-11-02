import type { MoveId } from '../data/moves/base';
import { cinematicFinish } from './combat';
import { setMode } from './fighter';
import { motionFrames, movesOf } from './frames';
import { hooksOf } from './chars';
import type { CharId } from '../data/characters';
import { floorBelow } from './platforms';
import { px } from './rules';
import type { Fighter, SimState } from './types';

/**
 * 필살기 연출 (캐릭터 기획서 '필살기 연출'). sim 규칙:
 * - 필살기가 맞으면 (막히지 않으면) 연출이 시작된다. 두 사람은 연출 장면의 자리·동작대로 고정되고,
 *   그동안 입력·판정·시간·도시 시계가 모두 멈춘다.
 * - 장면은 기술 데이터(cinematic.scenes)를 차례로: 발동자 동작 하나 + 상대 반응 동작 하나, 자리는 키 사이를 부드럽게.
 * - 끝에 피해·날리기·파괴(건물·물건·시타델)를 한 번에 준다 (온라인에서 양쪽이 같은 틱에 같은 결과).
 * 연출을 어떻게 보여 줄지(확대·컷인·이펙트)는 렌더가 정한다.
 */
export function startCine(s: SimState, att: Fighter, def: Fighter, move: MoveId): void {
  const who = s.fighters.indexOf(att);
  // 같은 경기 두 번째 연출부터는 짧은 판 (있으면)
  const short = att.cines > 0 && !!movesOf(att.char)[move].data.cinematic!.short;
  att.cines++;
  s.cine = { who, move, scene: 0, t: 0, ox: att.x, oy: att.y, dir: att.facing, short };
  for (const f of [att, def]) {
    setMode(f, 'cine');
    f.vx = 0;
    f.vy = 0;
    f.hitstop = 0;
    f.invuln = 0;
    f.chargeArm = false;
  }
  def.facing = -att.facing as 1 | -1;
  place(s);
  s.events.push({ type: 'cine', who, x: att.x, y: att.y, text: 'start', move });
}

/** 연출 한 틱: 장면을 넘기고, 다 끝나면 두 사람을 놓아 주며 끝 타격을 준다 */
export function stepCine(s: SimState): void {
  const c = s.cine!;
  const ch = s.fighters[c.who].char;
  const scenes = scenesOf(ch, c.move, c.short);
  c.t++;
  if (c.t >= sceneTicks(ch, c.move, c.scene, c.short)) {
    c.scene++;
    c.t = 0;
    if (c.scene >= scenes.length) {
      finish(s);
      return;
    }
    s.events.push({ type: 'cine', who: c.who, x: s.fighters[c.who].x, y: s.fighters[c.who].y, text: 'scene', combo: c.scene, move: c.move });
    place(s);
    // 캐릭터 고유 규칙: 장면이 바뀌는 틱의 효과 (라이덴 파천: 넷째 장면에 등 뒤 일직선 잿더미)
    hooksOf(s.fighters[c.who].char).cineScene?.(s, s.fighters[c.who], s.fighters[1 - c.who], c.move, c.scene);
    return;
  }
  place(s);
}

/** 장면 하나의 길이 (발동자 동작의 표시 틱 합) */
export function sceneTicks(ch: CharId, move: MoveId, scene: number, short = false): number {
  return motionFrames(scenesOf(ch, move, short)[scene].a.motion).total;
}

/** 이번 연출의 장면들: 짧은 판이면 short (없으면 scenes) */
export function scenesOf(ch: CharId, move: MoveId, short = false): NonNullable<ReturnType<typeof movesOf>[MoveId]['data']['cinematic']>['scenes'] {
  const cin = movesOf(ch)[move].data.cinematic!;
  return short && cin.short ? cin.short : cin.scenes;
}

/** 지금 재생 중인 연출의 장면들 (렌더가 쓴다) */
export function cineScenes(s: SimState): ReturnType<typeof scenesOf> {
  const c = s.cine!;
  return scenesOf(s.fighters[c.who].char, c.move, c.short);
}

/** 연출 전체 길이 (틱) */
export function cineTicks(ch: CharId, move: MoveId, short = false): number {
  return scenesOf(ch, move, short).reduce((n, _, i) => n + sceneTicks(ch, move, i, short), 0);
}

function place(s: SimState): void {
  const c = s.cine!;
  const att = s.fighters[c.who];
  const def = s.fighters[1 - c.who];
  const sc = scenesOf(att.char, c.move, c.short)[c.scene];
  const u = Math.min(1, c.t / Math.max(1, sceneTicks(att.char, c.move, c.scene, c.short)));
  for (const [f, actor] of [[att, sc.a], [def, sc.d]] as const) {
    const [x, y] = posAt(actor.pos, u);
    f.x = c.ox + c.dir * px(x);
    f.y = c.oy + px(y);
    f.floor = 0;
    f.cineMotion = actor.motion;
    f.t = c.t;
  }
}

/** 자리 키 [진행, x, y] 사이를 부드럽게 (키 구간마다 천천히 출발해 천천히 멈춤) */
function posAt(keys: ReadonlyArray<readonly [number, number, number]>, u: number): [number, number] {
  if (u <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    const [u1, x1, y1] = keys[i];
    if (u <= u1) {
      const [u0, x0, y0] = keys[i - 1];
      const k = (u - u0) / Math.max(1e-6, u1 - u0);
      const e = k * k * (3 - 2 * k);
      return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
    }
  }
  const last = keys[keys.length - 1];
  return [last[1], last[2]];
}

/** 연출 끝: 두 사람을 놓아 주고 (연출 동안 쌓인 버튼은 버린다), 끝 타격으로 피해·날리기·파괴를 한 번에 */
function finish(s: SimState): void {
  const c = s.cine!;
  s.cine = null;
  const att = s.fighters[c.who];
  const def = s.fighters[1 - c.who];
  for (const f of [att, def]) {
    f.cineMotion = '';
    f.buf.fill(0);
    // 서 있는 바닥 (땅이나 발판). 바닥보다 위면 떨어진다
    const under = floorBelow(s, f.x, f.y);
    f.floor = under === f.y ? f.y : 0;
  }
  // 발동자: 바닥에 섰으면 잠깐 착지, 떠 있으면 떨어진다
  setMode(att, att.floor === att.y ? 'land' : 'air', 12);
  setMode(def, 'idle');
  s.events.push({ type: 'cine', who: c.who, x: def.x, y: def.y, text: 'end', move: c.move });
  cinematicFinish(s, att, def, c.move);
  hooksOf(att.char).cineEnd?.(s, att, def, c.move);
}
