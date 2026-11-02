import type { CharHooks } from '.';
import { damageCity } from '../city';
import { isAirborne, setMode } from '../fighter';
import { smashProps } from '../props';
import { px } from '../rules';
import type { Fighter, SimState } from '../types';

/*
 * 라이덴 고유 규칙 (캐릭터 기획서). 금강(스택·금강불괴)과 잔흔(잔상)은 공통 필드(kongo·zan*)로 combat.ts에 있고,
 * 여기는 스킬 2 화과산(전격 저주·전류 방벽)과 필살기 파천(등 뒤 일직선 잿더미)의 효과다. 상태는 f.ext 칸 번호로.
 */

/** f.ext 칸: 전격 저주 남은 틱, 전류 방벽 남은 틱·자리(1/256px)·방향(밀어낸 쪽 +1/−1)·켜짐(상대가 방벽 너머로 나간 적 있음) */
export const RAIDEN_EXT = { curseT: 0, barrierT: 1, barrierX: 2, barrierDir: 3, barrierArmed: 4 } as const;

/**
 * 화과산 (캐릭터 기획서 스킬 2) 수치: 전격 저주 길이·피해 감소(%), 전류 방벽 길이·자리(라이덴에게서 px)·높이(px).
 * 사용자 피드백 2026-11-02 9-3: 방벽은 라이덴 앞 40px(두 사람 사이)에 높이 약 80px
 */
export const HWAGWASAN = { curseTicks: 180, curseCut: 30, barrierTicks: 90, barrierDist: 40, barrierH: 80 } as const;
/** 파천: 맞은 상대 등 뒤로 일직선 잿더미가 되는 거리 (px)와 그 사이 건물을 깎는 간격·높이 */
export const PACHEON_ASH = { length: 360, step: 40, heights: [8, 40, 80], radius: 18, amount: 60 } as const;

const E = RAIDEN_EXT;

export const RAIDEN_HOOKS: CharHooks = {
  tick(s, f) {
    const e = f.ext;
    if (e[E.curseT] > 0) e[E.curseT]--;
    if (e[E.barrierT] > 0) {
      e[E.barrierT]--;
      barrier(s, f);
    }
  },
  hit(s, att, def, id, blocked, shielded) {
    if (id !== 'skill2' || shielded) return;
    // 뒤에 붙어 있던 상대는 뒤로 밀어낸다 (몸 둘레로 터지는 스파크)
    const dir = (def.x - att.x) * att.facing >= 0 ? att.facing : -att.facing;
    if (dir !== att.facing) {
      def.vx = -def.vx;
      def.facing = att.facing;
    }
    // 전격 저주는 맞았을 때만, 방벽은 막혀도 남는다
    if (!blocked) att.ext[E.curseT] = HWAGWASAN.curseTicks;
    att.ext[E.barrierT] = HWAGWASAN.barrierTicks;
    att.ext[E.barrierX] = att.x + dir * px(HWAGWASAN.barrierDist);
    att.ext[E.barrierDir] = dir;
    att.ext[E.barrierArmed] = 0;
    const who = s.fighters.indexOf(att);
    s.events.push({ type: 'char', who, x: att.ext[E.barrierX], y: att.y, text: 'barrier', combo: dir, move: id });
    if (!blocked) s.events.push({ type: 'char', who, x: def.x, y: def.y, text: 'curse', move: id });
  },
  defend(_s, def, _att, _id, damage) {
    // 전격 저주: 화과산에 밀려난 상대의 공격은 라이덴에게 약하게 들어간다
    if (def.ext[E.curseT] > 0) return Math.max(1, Math.trunc((damage * (100 - HWAGWASAN.curseCut)) / 100));
    return damage;
  },
  cineScene(s, att, def, id, scene) {
    // 파천 넷째 장면 (사용자 피드백 2026-11-02 9-4, 96틱째): 상대 등 뒤 일직선이 잿더미가 된다 (파괴 상태는 sim에 남는다)
    if (id === 'super' && scene === 3) ashLine(s, att, def);
  },
};

/**
 * 전류 방벽: 밀어낸 범위 끝에 세로로 선 벽. 상대가 한 번 방벽 너머로 밀려난 뒤(켜짐)에는, 다시 라이덴 쪽으로 넘어오면 튕겨 낸다
 * (대시·공격·점프로 들어오던 것은 막힘 경직 14틱). 방벽 높이보다 높이 뛰어 넘으면 지나간다
 */
function barrier(s: SimState, f: Fighter): void {
  const e = f.ext;
  const o = s.fighters[1 - s.fighters.indexOf(f)];
  if (o.mode === 'ko' || o.mode === 'cine' || -o.y > px(HWAGWASAN.barrierH)) return;
  const dir = e[E.barrierDir];
  const beyond = (o.x - e[E.barrierX]) * dir;
  if (beyond > 0) {
    e[E.barrierArmed] = 1;
    return;
  }
  if (!e[E.barrierArmed]) return;
  o.x = e[E.barrierX] + dir * px(2);
  o.vx = dir * px(3);
  if (isAirborne(o)) {
    // 공중으로 넘어오던 것은 튕겨 떨어진다
    if (o.mode === 'airdash' || o.mode === 'attack') setMode(o, 'air');
    o.vy = Math.max(o.vy, px(1));
  } else if (o.mode === 'dash' || o.mode === 'attack' || o.mode === 'run') setMode(o, 'blockstun', 14);
  s.events.push({ type: 'char', who: s.fighters.indexOf(f), x: e[E.barrierX], y: o.y, text: 'deflect' });
}

/** 파천 넷째 장면: 맞은 상대 등 뒤로 일직선 위의 건물 덩어리와 물건이 무너져 잿더미가 된다 */
function ashLine(s: SimState, att: Fighter, def: Fighter): void {
  const dir = att.facing;
  const x0 = Math.round(def.x / 256);
  for (let d = 0; d <= PACHEON_ASH.length; d += PACHEON_ASH.step) {
    for (const h of PACHEON_ASH.heights) damageCity(s, x0 + dir * d, h, PACHEON_ASH.radius, PACHEON_ASH.amount, 'explosion');
  }
  const a = def.x;
  const b = def.x + dir * px(PACHEON_ASH.length);
  smashProps(s, att, { x0: Math.min(a, b), x1: Math.max(a, b), y0: def.y - px(90), y1: def.y + px(6) }, 400, true);
  s.events.push({ type: 'char', who: s.fighters.indexOf(att), x: def.x, y: def.y, text: 'ash', combo: dir, move: 'super' });
}
