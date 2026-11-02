import type { MoveId } from '../../data/moves/base';
import {
  BLOOM_CUTS, BLOOMS, CUT_HALF, OSCAR_CUTS, SKILL1_CUT, SKILL1_MID, superCutCount, superCuts, type Cut,
} from '../../data/poses/oscar/slashes';
import { BREAKABLES } from '../../stage/citadel';
import { damageCity } from '../city';
import { hurtOf, strikeBox, type WBox } from '../combat';
import { setMode } from '../fighter';
import { movesOf } from '../frames';
import { floorBelow } from '../platforms';
import { boxOf, smashProps } from '../props';
import { px } from '../rules';
import type { Fighter, SimState } from '../types';
import type { CharHooks } from '.';

/*
 * 오스카 고유 규칙 (캐릭터 기획서 13장).
 * 베기의 문법: 모든 공격은 앞 허공(또는 표식 자리)에 긴 베기 선이 한 번에 생기는 것이다. 판정은 그 선 (두께 6px의 긴 선)이고,
 * 선이 생기는 틱에 상대 몸에 닿았는지 정한 뒤, 상대는 LATE틱 늦게 맞는다 (베인 걸 늦게 안다. 히트스톱은 그 순간). 그 사이 무적이 되면 빗나간다.
 * 선에 걸린 작은 물건(가로등·간판·가판대)은 잘려 부서진다.
 * 고유 특성 검영: 선이 생길 때마다 그 기술의 주된 선 가운데에 검영이 하나 남는다 (최대 5개, 가장 오래된 것부터 바뀜).
 * 검영은 SHADOW_LIFE틱 뒤 사라지고, 스킬 2(검영으로 순간이동)와 필살기(검영 수만큼 선이 많아지고 세짐)의 재료가 된다.
 * 상태는 f.ext 칸에 둔다 (EXT): 검영 5개의 자리 x·y (1/256px, y는 땅 기준), 남은 틱, 모양(어느 기술의 선인지·방향) 등.
 * 모양은 정수로만 둔다 (기울기 각도는 렌더가 data/poses/oscar/slashes에서 계산: 삼각함수 값이 sim 상태에 들어가지 않게).
 */

/** 검영 최대 수와 남는 시간 (틱) */
export const SHADOW_MAX = 5;
export const SHADOW_LIFE = 420;
/** 선이 생기고 상대가 맞기까지 (틱) */
export const LATE = 3;

/** f.ext 칸 번호 */
export const EXT = {
  /** 검영 x (5칸) */
  X: 0,
  /** 검영 y (5칸) */
  Y: 5,
  /** 검영 남은 틱 (5칸, 0 = 빈 칸) */
  LIFE: 10,
  /** 검영 모양 (5칸): SHADOW_KINDS 번호 × 2 + (왼쪽을 보고 벴으면 1) */
  KIND: 15,
  /** 이번 기술의 선이 이미 생겼다 (1) */
  SLASHED: 20,
  /** 스킬 1 월하참뢰검: 벨 자리 x·y(상대 발밑)와 표식이 뜬 뒤 지난 틱 (0 없음) */
  MARK_X: 21,
  MARK_Y: 22,
  MARK_T: 23,
  /** 늦게 맞을 타격: 남은 틱 (0 없음)과 기술 (CUT_IDS 번호) */
  LATE: 24,
  LATE_ID: 25,
  /** 스킬 2 월하윤회궤: 고른 검영 칸 + 1 (0 = 검영 없음) */
  PICK: 26,
} as const;

/** 검영 모양: 어느 선이 남긴 것인지 (렌더가 그 선의 기울기로 그린다) */
export const SHADOW_KINDS: readonly string[] = ['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick', 'skill1', 'bloom'];

/** 베기 선을 내는 기술 (늦게 맞는 타격의 기술 번호) */
const CUT_IDS: readonly MoveId[] = ['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick', 'skill1', 'charge'];
/** 앞 허공에 선이 생기는 평타 11개 + 벽 박차기 공격 */
const SLASH_MOVES: ReadonlySet<MoveId> = new Set<MoveId>(['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick']);

/** 스킬 1: 표식이 닿는 가장 먼 거리 (px) */
export const SKILL1_RANGE = 300;
/** 스킬 2 월하윤회궤: 이 틱에 고른 검영 자리로 옮긴다 (틈 속에 사라진 8~10틱의 가운데), 이보다 높이 뜬 검영(px)이면 그 위에 서서 뛴다, 검영이 없으면 뒤로 물러나는 거리 */
export const SKILL2_WARP = 9;
export const SKILL2_HIGH = 50;
export const SKILL2_BACK = 64;
/** 검영을 밟고 뛰는 속도 (px/틱) */
const SHADOW_JUMP_VY = 7.4;
/** 필살기: 남은 검영 하나에 더하는 피해, 판정이 닿는 거리 (보이는 화면 전체: 발동자에게서 좌우로 px) */
export const SUPER_PER_SHADOW = 24;
export const SUPER_REACH = 240;
/** 선에 걸리면 한 번에 잘려 부서지는 작은 물건 */
const SMALL_PROPS: ReadonlySet<string> = new Set(['lamp', 'newsstand', 'neon', 'hydrant']);

export interface Shadow {
  x: number;
  y: number;
  life: number;
  /** 남긴 선 (SHADOW_KINDS) */
  kind: string;
  /** 벨 때 바라보던 쪽 */
  facing: 1 | -1;
  /** 칸 번호 */
  slot: number;
}

/** 살아 있는 검영들 (칸 번호 순) */
export function shadowsOf(f: Fighter): Shadow[] {
  const out: Shadow[] = [];
  for (let i = 0; i < SHADOW_MAX; i++) {
    const life = f.ext[EXT.LIFE + i];
    if (life <= 0) continue;
    const code = f.ext[EXT.KIND + i];
    out.push({ x: f.ext[EXT.X + i], y: f.ext[EXT.Y + i], life, kind: SHADOW_KINDS[code >> 1] ?? 'atk1', facing: code & 1 ? -1 : 1, slot: i });
  }
  return out;
}

export const shadowCount = (f: Fighter): number => {
  let n = 0;
  for (let i = 0; i < SHADOW_MAX; i++) if (f.ext[EXT.LIFE + i] > 0) n++;
  return n;
};

/** 검영 하나를 남긴다: 빈 칸, 없으면 가장 오래된(남은 틱이 가장 적은) 칸에. kind: 남긴 선 (SHADOW_KINDS) */
export function addShadow(s: SimState, f: Fighter, x: number, y: number, kind: string): void {
  let slot = 0;
  let least = Infinity;
  for (let i = 0; i < SHADOW_MAX; i++) {
    const life = f.ext[EXT.LIFE + i];
    if (life < least) {
      least = life;
      slot = i;
    }
  }
  f.ext[EXT.X + slot] = x;
  f.ext[EXT.Y + slot] = Math.min(0, y);
  f.ext[EXT.LIFE + slot] = SHADOW_LIFE;
  f.ext[EXT.KIND + slot] = Math.max(0, SHADOW_KINDS.indexOf(kind)) * 2 + (f.facing < 0 ? 1 : 0);
  s.events.push({ type: 'char', who: s.fighters.indexOf(f), x, y, text: 'shadow', combo: shadowCount(f) });
}

/** 검영 하나를 지운다 (칸 번호) */
export function removeShadow(f: Fighter, slot: number): void {
  f.ext[EXT.LIFE + slot] = 0;
}

/** 월드 선 (1/256px): [x0, y0, x1, y1] */
type WLine = [number, number, number, number];

/** 선 하나를 월드로: (ox, oy) 기준, facing 쪽으로 뒤집는다 */
function toWorldCut(c: Cut, facing: number, ox: number, oy: number): WLine {
  return [ox + facing * px(c[0]), oy + px(c[1]), ox + facing * px(c[2]), oy + px(c[3])];
}

/** 땅(y = 0) 밑으로 넘는 곳을 자른다 (정수 나눗셈 한 번: 결정론) */
function clipGround(l: WLine): WLine | null {
  const [x0, y0, x1, y1] = l;
  if (y0 <= 0 && y1 <= 0) return l;
  if (y0 > 0 && y1 > 0) return null;
  const gx = x0 + Math.trunc(((x1 - x0) * (0 - y0)) / (y1 - y0));
  return y0 > 0 ? [gx, 0, x1, y1] : [x0, y0, gx, 0];
}

/** 이 기술이 지금 내는 월드 선들 (발밑 기준 데이터를 바라보는 쪽으로) */
function cutsOf(f: Fighter, id: MoveId): WLine[] {
  return (OSCAR_CUTS[id] ?? []).map((c) => clipGround(toWorldCut(c, f.facing, f.x, f.y))).filter((l): l is WLine => l !== null);
}

/** 두께 6px의 선이 상자에 닿는가 (선분과 상자를 두께의 반만큼 넓힌 상자의 교차, 리앙-바스키). 나눗셈은 IEEE라 어디서나 같은 값 */
export function cutHits(l: readonly number[], b: WBox): boolean {
  const h = px(CUT_HALF);
  let t0 = 0;
  let t1 = 1;
  const axes: Array<[number, number, number, number]> = [
    [l[0]!, l[2]! - l[0]!, b.x0 - h, b.x1 + h],
    [l[1]!, l[3]! - l[1]!, b.y0 - h, b.y1 + h],
  ];
  for (const [p, d, lo, hi] of axes) {
    if (d === 0) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let a = (lo - p) / d;
    let c = (hi - p) / d;
    if (a > c) [a, c] = [c, a];
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) return false;
  }
  return true;
}

const other = (s: SimState, f: Fighter): Fighter => s.fighters[1 - s.fighters.indexOf(f)];

/**
 * 선들이 생기는 순간: 상대 몸에 닿았으면 LATE틱 뒤에 맞을 타격을 걸어 두고, 걸린 작은 물건을 자른다.
 * (선 그림과 화면 어긋남은 렌더가 'cut' 사건을 보고 그린다)
 */
function cutNow(s: SimState, f: Fighter, id: MoveId, lines: readonly WLine[]): void {
  const op = other(s, f);
  const hu = hurtOf(op);
  if (hu && !f.moveHit && lines.some((l) => cutHits(l, hu))) {
    f.ext[EXT.LATE] = LATE;
    f.ext[EXT.LATE_ID] = CUT_IDS.indexOf(id);
  }
  // 선에 걸린 물건: 작은 물건(가로등·가판대·간판·소화전)은 잘려 부서지고, 큰 물건은 그 기술 피해만큼 깎인다
  const dmg = movesOf(f.char)[id].data.damage;
  for (let i = 0; i < BREAKABLES.length; i++) {
    if (s.props[i]!.stage === 2) continue;
    const box = boxOf(s, i);
    if (!box || !lines.some((l) => cutHits(l, box))) continue;
    const b = BREAKABLES[i]!;
    smashProps(s, f, box, SMALL_PROPS.has(b.kind) && !b.big ? b.hp : dmg, false);
  }
}

/** 걸어 둔 늦은 타격을 낸다: 이미 베였다 (그 사이 무적이 되었으면 빗나간다) */
function lateHit(s: SimState, f: Fighter): void {
  const id = CUT_IDS[f.ext[EXT.LATE_ID]];
  f.ext[EXT.LATE] = 0;
  if (!id) return;
  const hu = hurtOf(other(s, f));
  if (hu) strikeBox(s, f, hu, id);
}

/** 스킬 2: 상대에게 가장 가까운 검영 칸 (없으면 -1). 렌더도 고를 검영을 미리 보여 주는 데 쓴다 */
export function nearestShadow(f: Fighter, to: Fighter): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < SHADOW_MAX; i++) {
    if (f.ext[EXT.LIFE + i] <= 0) continue;
    const d = Math.abs(f.ext[EXT.X + i] - to.x) + Math.abs(f.ext[EXT.Y + i] - (to.y - px(26)));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * 스킬 2 순간이동: 고른 검영 자리로 (높이 뜬 검영이면 그 위에 서서 뛰고, 낮으면 그 아래 바닥에 선다). 기술이 끝났으면 true.
 * 사건 'warp': to = 나타난 x, combo = 검영 높이 (낮으면 0), heavy = 검영을 썼다 (없으면 뒤로 그림자 걸음, combo = 지금 높이)
 */
function warp(s: SimState, f: Fighter): boolean {
  const who = s.fighters.indexOf(f);
  const from = { x: f.x, y: f.y };
  const slot = f.ext[EXT.PICK] - 1;
  if (slot < 0 || f.ext[EXT.LIFE + slot] <= 0) {
    // 검영이 없다: 뒤로 그림자 걸음 (높이는 그대로)
    f.x -= f.facing * px(SKILL2_BACK);
    s.events.push({ type: 'char', who, x: from.x, y: from.y, to: f.x, combo: f.y, text: 'warp', move: 'skill2' });
    return false;
  }
  const op = other(s, f);
  let sx = f.ext[EXT.X + slot];
  const sy = f.ext[EXT.Y + slot];
  removeShadow(f, slot);
  // 검영이 상대 몸에 겹쳐 있으면 상대 바로 옆(검영이 있는 쪽, 가운데끼리 26px)에 나타난다: 상대 너머의 검영이면 등 뒤로
  const dx = sx - op.x;
  if (Math.abs(dx) < px(26)) sx = op.x + (dx !== 0 ? Math.sign(dx) : f.x < op.x ? -1 : 1) * px(26);
  f.x = sx;
  f.vx = 0;
  if (sy < -px(SKILL2_HIGH)) {
    // 높이 뜬 검영: 그 위에 서서 밟고 한 번 더 뛴다 (2단 점프가 다시 생긴다)
    f.y = sy;
    f.floor = 0;
    f.vy = -px(SHADOW_JUMP_VY);
    f.airJumpUsed = false;
    f.move = null;
    f.mode = 'air';
    f.t = 0;
    f.len = 0;
    f.jumpKind = 2;
    s.events.push({ type: 'char', who, x: from.x, y: from.y, to: sx, combo: sy, text: 'warp', move: 'skill2', heavy: true });
    return true;
  }
  // 낮은 검영: 그 아래 바닥(땅이나 발판)에 선다
  f.y = 0;
  f.floor = 0;
  f.vy = 0;
  s.events.push({ type: 'char', who, x: from.x, y: from.y, to: sx, combo: 0, text: 'warp', move: 'skill2', heavy: true });
  return false;
}

/** 필살기 월령수류의 선이 지나는 기준점: 상대 발밑 (연출 동안 상대는 그 자리에 서 있다) */
export function superAnchor(def: Fighter): number {
  return def.x;
}

export const OSCAR_HOOKS: CharHooks = {
  tick(s, f) {
    // 검영이 사그라든다
    for (let i = 0; i < SHADOW_MAX; i++) if (f.ext[EXT.LIFE + i] > 0) f.ext[EXT.LIFE + i]--;
    // 늦게 맞을 타격: 기술이 이어지는 동안에만 (오스카가 맞아 끊기면 사라진다)
    if (f.ext[EXT.LATE] > 0) {
      if (f.mode !== 'attack') f.ext[EXT.LATE] = 0;
      else if (--f.ext[EXT.LATE] === 0) lateHit(s, f);
    }
  },
  start(s, f, id) {
    // 앞 기술의 늦은 타격이 남아 있으면 지금 낸다 (그 판정·연결은 앞 기술 것이라 새 기술에는 남기지 않는다)
    if (f.ext[EXT.LATE] > 0) {
      lateHit(s, f);
      f.moveHit = false;
      f.moveConnected = false;
    }
    f.ext[EXT.SLASHED] = 0;
    if (id === 'skill1') {
      // 월하참뢰검: 상대가 있는 자리에 표식 (멀면 가장 먼 거리까지)
      const op = other(s, f);
      const range = px(SKILL1_RANGE);
      const mx = Math.max(f.x - range, Math.min(f.x + range, op.x));
      f.ext[EXT.MARK_X] = mx;
      f.ext[EXT.MARK_Y] = op.y;
      f.ext[EXT.MARK_T] = 1;
      s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: mx, y: op.y, text: 'mark', move: 'skill1' });
    } else if (id === 'skill2') {
      // 월하윤회궤: 갈 검영을 먼저 고른다 (렌더가 0~4틱 밝게 맥동시킨다)
      const slot = nearestShadow(f, other(s, f));
      f.ext[EXT.PICK] = slot + 1;
      const who = s.fighters.indexOf(f);
      if (slot >= 0) s.events.push({ type: 'char', who, x: f.ext[EXT.X + slot], y: f.ext[EXT.Y + slot], text: 'pick', combo: slot, move: 'skill2' });
    }
  },
  move(s, f, id) {
    const mv = movesOf(f.char)[id];
    const who = s.fighters.indexOf(f);
    // 선이 생기는 순간 (판정이 처음 켜지는 틱): 늦은 타격을 걸고, 주된 선 가운데에 검영이 남는다
    if (SLASH_MOVES.has(id) && !f.ext[EXT.SLASHED] && f.t >= mv.activeStart) {
      f.ext[EXT.SLASHED] = 1;
      const lines = cutsOf(f, id);
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: 'cut', move: id });
      cutNow(s, f, id, lines);
      const m = lines[0];
      if (m) addShadow(s, f, Math.trunc((m[0] + m[2]) / 2), Math.trunc((m[1] + m[3]) / 2), id);
      return;
    }
    if (id === 'skill1' && f.ext[EXT.MARK_T] > 0) {
      f.ext[EXT.MARK_T]++;
      if (f.t >= mv.activeStart) {
        // 표식 자리를 곧바로 벤다 (그 사이 상대가 비켜났으면 헛벤다): 120px 선 한 줄, 벤 자리에 검영
        const mx = f.ext[EXT.MARK_X];
        const my = f.ext[EXT.MARK_Y] - px(SKILL1_MID);
        f.ext[EXT.MARK_T] = 0;
        const l = clipGround(toWorldCut(SKILL1_CUT, f.facing, mx, my));
        s.events.push({ type: 'char', who, x: mx, y: f.ext[EXT.MARK_Y], text: 'cut', move: 'skill1' });
        if (l) cutNow(s, f, 'skill1', [l]);
        addShadow(s, f, mx, my, 'skill1');
      }
      return;
    }
    if (id === 'skill2' && f.t === SKILL2_WARP) return warp(s, f);
    if (id === 'charge' && !f.ext[EXT.SLASHED] && f.t >= mv.activeStart) {
      // 만검지화: 피어 있던 꽃이 한꺼번에 선 다발로 펼쳐진다 (한 기술에 한 번 맞는다). 꽃 자리는 검영으로 남는다
      f.ext[EXT.SLASHED] = 1;
      const n = Math.max(1, Math.min(BLOOMS.length, f.chargeLv));
      const lines: WLine[] = [];
      for (let k = 0; k < n; k++) {
        const [bx, by] = BLOOMS[k]!;
        const cx = f.x + f.facing * px(bx);
        const cy = f.y + px(by);
        for (const c of BLOOM_CUTS[k]!) {
          const l = clipGround(toWorldCut(c, f.facing, cx, cy));
          if (l) lines.push(l);
        }
        addShadow(s, f, cx, cy, 'bloom');
      }
      s.events.push({ type: 'char', who, x: f.x, y: f.y, text: 'bloomcut', combo: n, move: 'charge' });
      cutNow(s, f, 'charge', lines);
      return;
    }
    if (id === 'super' && !f.ext[EXT.SLASHED] && f.t >= mv.activeStart) {
      // 월령수류: 보이는 화면 전체를 벤다 (빗나감 없음). 막으면 막힌다, 무적이면 빗나간다
      f.ext[EXT.SLASHED] = 1;
      const op = other(s, f);
      const hu = hurtOf(op);
      if (hu && Math.abs(op.x - f.x) <= px(SUPER_REACH)) strikeBox(s, f, hu, 'super');
    }
  },
  damage(_s, att, _def, id, damage) {
    // 월령수류: 화면에 남은 검영이 많을수록 세다
    return id === 'super' ? damage + SUPER_PER_SHADOW * shadowCount(att) : damage;
  },
  cineEnd(s, att, def) {
    // 월령수류 끝 ('탁' 납도하는 순간): 화면 끝에서 끝까지 그어진 선들을 따라 건물 정면이 베여 내려앉고, 보이는 화면의 물건이 모두 잘린다.
    // 검영은 모두 쓴다
    const n = shadowCount(att);
    const ax = Math.round(superAnchor(def) / 256);
    for (const [x0, y0, x1, y1] of superCuts(superCutCount(n))) {
      // 선을 따라 40px마다: 화면 안(기준점 좌우 240px)이고 땅 위 8~250px인 곳의 건물 덩어리를 깎는다
      const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      const steps = Math.trunc(len / 40);
      for (let k = 0; k <= steps; k++) {
        const x = x0 + Math.trunc(((x1 - x0) * k) / steps);
        const y = y0 + Math.trunc(((y1 - y0) * k) / steps);
        if (Math.abs(x) > 240 || y > -8 || y < -250) continue;
        damageCity(s, ax + x, -y, 18, 90, 'hit');
      }
    }
    const view: WBox = { x0: def.x - px(260), x1: def.x + px(260), y0: -px(280), y1: px(4) };
    smashProps(s, att, view, 999, true);
    for (let i = 0; i < SHADOW_MAX; i++) removeShadow(att, i);
    // 방금 베여 무너진 발판(시타델 계단참 등) 위에 서 있었으면 바로 떨어진다 (연출 끝 틱에는 보통 틱의 발판 확인이 돌지 않는다)
    for (const f of [att, def]) {
      if (f.y < 0 && f.floor === f.y && floorBelow(s, f.x, f.y) !== f.y) {
        f.floor = 0;
        if (f.mode === 'land' || f.mode === 'idle') setMode(f, 'air');
      }
    }
    s.events.push({ type: 'char', who: s.fighters.indexOf(att), x: def.x, y: def.y, text: 'supercut', combo: n, move: 'super' });
  },
};
