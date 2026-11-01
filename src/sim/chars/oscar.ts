import type { MoveId } from '../../data/moves/base';
import { damageCity } from '../city';
import { strikeBox } from '../combat';
import { movesOf } from '../frames';
import { px } from '../rules';
import type { Fighter, SimState } from '../types';
import type { CharHooks } from '.';

/*
 * 오스카 고유 규칙 (캐릭터 기획서).
 * 고유 특성 검영: 검격이 생길 때마다 그 자리(검격 상자 가운데)에 검영이 하나 남는다 (최대 5개, 가장 오래된 것부터 바뀜).
 * 검영은 SHADOW_LIFE틱 뒤 사라지고, 스킬 2(검영으로 순간이동)와 필살기(검영 수만큼 강해짐)의 재료가 된다.
 * 상태는 f.ext 칸에 둔다 (EXT): 검영 5개의 자리 x·y (1/256px, y는 땅 기준), 남은 틱, 모양(어느 기술의 검격인지·방향).
 * 모양은 정수로만 둔다 (기울기 각도는 렌더가 data/poses/oscar/slashes에서 계산: 삼각함수 값이 sim 상태에 들어가지 않게).
 */

/** 검영 최대 수와 남는 시간 (틱) */
export const SHADOW_MAX = 5;
export const SHADOW_LIFE = 420;

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
  /** 이번 기술의 검격이 이미 생겼다 (1) */
  SLASHED: 20,
  /** 스킬 1 월하참뢰검: 벨 자리 x·y와 표식이 뜬 뒤 지난 틱 (0 없음) */
  MARK_X: 21,
  MARK_Y: 22,
  MARK_T: 23,
} as const;

/** 검영 모양: 어느 검격이 남긴 것인지 (렌더가 그 검격의 주된 베기 기울기로 그린다) */
export const SHADOW_KINDS: readonly string[] = ['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick', 'skill1', 'bloom'];

export interface Shadow {
  x: number;
  y: number;
  life: number;
  /** 남긴 검격 (SHADOW_KINDS) */
  kind: string;
  /** 벨 때 바라보던 쪽 */
  facing: 1 | -1;
}

/** 살아 있는 검영들 (칸 번호 순) */
export function shadowsOf(f: Fighter): Shadow[] {
  const out: Shadow[] = [];
  for (let i = 0; i < SHADOW_MAX; i++) {
    const life = f.ext[EXT.LIFE + i];
    if (life <= 0) continue;
    const code = f.ext[EXT.KIND + i];
    out.push({ x: f.ext[EXT.X + i], y: f.ext[EXT.Y + i], life, kind: SHADOW_KINDS[code >> 1] ?? 'atk1', facing: code & 1 ? -1 : 1 });
  }
  return out;
}

export const shadowCount = (f: Fighter): number => {
  let n = 0;
  for (let i = 0; i < SHADOW_MAX; i++) if (f.ext[EXT.LIFE + i] > 0) n++;
  return n;
};

/** 검영 하나를 남긴다: 빈 칸, 없으면 가장 오래된(남은 틱이 가장 적은) 칸에. kind: 남긴 검격 (SHADOW_KINDS) */
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

/** 이 기술의 검격 상자 가운데 (월드, 1/256px) */
export function slashCenter(f: Fighter, id: MoveId): { x: number; y: number } | null {
  const b = movesOf(f.char)[id].data.box;
  if (!b) return null;
  return { x: f.x + f.facing * px(b.x + b.w / 2), y: f.y + px(b.y + b.h / 2) };
}

/** 검격이 앞 허공에 생기는 기술 (평타 11개 + 벽 박차기 공격): 판정이 처음 켜지는 틱에 검격 상자 가운데에 검영이 남는다 */
const SLASH_MOVES: ReadonlySet<MoveId> = new Set<MoveId>(['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick']);

/** 스킬 1 월하참뢰검: 벨 자리 상자 (표식 자리 = 상대 발밑 기준 px: 너비, 위로 높이)와 표식이 닿는 가장 먼 거리 (px) */
export const SKILL1_BOX = { w: 34, h: 56 } as const;
export const SKILL1_RANGE = 300;
/** 차지 만검지화: 단계마다 만개하는 검영 자리 (발밑 기준, 오른쪽 보는 기준 px)와 벨 상자 한 변 */
export const CHARGE_BLOOMS: ReadonlyArray<readonly [number, number]> = [[34, -36], [60, -52], [84, -24]];
export const BLOOM_BOX = 34;
/** 스킬 2 월하윤회: 이 프레임이 시작하는 틱에 순간이동, 이보다 높이 뜬 검영(px)이면 그 위에 서서 뛴다, 검영이 없으면 뒤로 물러나는 거리 */
export const SKILL2_FRAME = 3;
export const SKILL2_HIGH = 50;
export const SKILL2_BACK = 64;
/** 검영을 밟고 뛰는 속도 (px/틱) */
const SHADOW_JUMP_VY = 7.4;
/** 필살기: 남은 검영 하나에 더하는 피해 */
export const SUPER_PER_SHADOW = 24;

const other = (s: SimState, f: Fighter): Fighter => s.fighters[1 - s.fighters.indexOf(f)];

/** 월드 상자 (1/256px): 가운데 x, 아래 y, 너비·높이 px */
function boxAt(cx: number, bottom: number, w: number, h: number) {
  return { x0: cx - px(w / 2), x1: cx + px(w / 2), y0: bottom - px(h), y1: bottom };
}

/** 스킬 2: 상대에게 가장 가까운 검영 칸 (없으면 -1) */
function nearestShadow(f: Fighter, to: Fighter): number {
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

/** 스킬 2 순간이동: 검영 자리로 (높이 뜬 검영이면 그 위에 서서 뛰고, 낮으면 그 아래 바닥에 선다). 기술이 끝났으면 true */
function warp(s: SimState, f: Fighter): boolean {
  const who = s.fighters.indexOf(f);
  const from = { x: f.x, y: f.y };
  const slot = nearestShadow(f, other(s, f));
  if (slot < 0) {
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
    s.events.push({ type: 'char', who, x: from.x, y: from.y, to: sx, combo: sy, text: 'warp', move: 'skill2' });
    return true;
  }
  // 낮은 검영: 그 아래 바닥(땅이나 발판)에 선다
  f.y = 0;
  f.floor = 0;
  f.vy = 0;
  s.events.push({ type: 'char', who, x: from.x, y: from.y, to: sx, combo: 0, text: 'warp', move: 'skill2' });
  return false;
}

export const OSCAR_HOOKS: CharHooks = {
  tick(_s, f) {
    // 검영이 사그라든다
    for (let i = 0; i < SHADOW_MAX; i++) if (f.ext[EXT.LIFE + i] > 0) f.ext[EXT.LIFE + i]--;
  },
  start(s, f, id) {
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
    }
  },
  move(s, f, id) {
    const mv = movesOf(f.char)[id];
    // 검격이 생기는 순간 (판정이 처음 켜지는 틱): 그 자리에 검영이 남는다
    if (SLASH_MOVES.has(id) && !f.ext[EXT.SLASHED] && f.t >= mv.activeStart) {
      f.ext[EXT.SLASHED] = 1;
      const c = slashCenter(f, id);
      if (c) addShadow(s, f, c.x, c.y, id);
      return;
    }
    if (id === 'skill1' && f.ext[EXT.MARK_T] > 0) {
      f.ext[EXT.MARK_T]++;
      if (f.t >= mv.activeStart) {
        // 표식 자리를 곧바로 벤다 (그 사이 상대가 비켜났으면 헛벤다). 벤 자리에 검영
        const mx = f.ext[EXT.MARK_X];
        const my = f.ext[EXT.MARK_Y];
        f.ext[EXT.MARK_T] = 0;
        strikeBox(s, f, boxAt(mx, my + px(2), SKILL1_BOX.w, SKILL1_BOX.h), 'skill1');
        s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: mx, y: my, text: 'cut', move: 'skill1' });
        addShadow(s, f, mx, my - px(SKILL1_BOX.h / 2), 'skill1');
      }
      return;
    }
    if (id === 'skill2' && f.t === mv.frames.cum[SKILL2_FRAME - 1]) return warp(s, f);
    if (id === 'charge' && !f.ext[EXT.SLASHED] && f.t >= mv.activeStart) {
      // 만검지화: 만개한 검영들이 한꺼번에 베인다 (한 기술에 한 번 맞는다). 벤 자리는 검영으로 남는다
      f.ext[EXT.SLASHED] = 1;
      const n = Math.max(1, Math.min(CHARGE_BLOOMS.length, f.chargeLv));
      for (let k = 0; k < n; k++) {
        const [bx, by] = CHARGE_BLOOMS[k]!;
        const cx = f.x + f.facing * px(bx);
        const cy = f.y + px(by);
        strikeBox(s, f, boxAt(cx, cy + px(BLOOM_BOX / 2), BLOOM_BOX, BLOOM_BOX), 'charge');
        addShadow(s, f, cx, cy, 'bloom');
      }
      s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: f.x, y: f.y, text: 'bloomcut', combo: n, move: 'charge' });
    }
  },
  damage(_s, att, _def, id, damage) {
    // 월령수류: 화면에 남은 검영이 많을수록 세다
    return id === 'super' ? damage + SUPER_PER_SHADOW * shadowCount(att) : damage;
  },
  cineEnd(s, att, def) {
    // 월령수류 끝: 검영을 모두 쓰고, 상대 뒤 배경(건물 정면)이 비스듬한 한 줄로 베여 있다
    const n = shadowCount(att);
    for (let i = 0; i < SHADOW_MAX; i++) removeShadow(att, i);
    const dir = att.x > def.x ? -1 : 1;
    for (let k = 0; k < 4 + n; k++) {
      damageCity(s, Math.round(def.x / 256) + dir * (24 + 34 * k), 16 + 14 * k, 24, 70, 'hit');
    }
    s.events.push({ type: 'char', who: s.fighters.indexOf(att), x: def.x, y: def.y, text: 'supercut', combo: n, move: 'super' });
  },
};
