import { WRECK_CAPS, WRECK_RULES as R, WRECKS, wreckStageOf } from '../stage/citadel';
import type { WBox } from './combat';
import { px } from './rules';
import type { Fighter, SimState, WreckState } from './types';

/**
 * 구조물 손상 (2026-11-02 파괴 범위 확대). 그동안 부서지지 않던 구조물과 거리 소품이 금 → 부분 파괴 → 무너짐으로 부서진다.
 * sim에는 단계·내구도·부서진 틱·맞은 자리만 둔다 (결정론). 파편·먼지·잔해 그림은 렌더 전용이다 (render/gl/wreck.ts).
 * 판정에 영향을 주지 않는 장식이다: 캐릭터를 막거나 느리게 하거나 피해·히트스톱을 주지 않고, 발판·벽 충돌은 그대로 둔다.
 * 그래서 이 파일은 사람(Fighter)의 값을 읽기만 한다 (기술 하나에 한 번 치는 기록만 f.propHits에 남긴다: smashWreck).
 * 공격 세기(tier): 0 평타·기술, 1 센 타격·날아온 몸, 2 필살기·자동차 폭발·벽 쪽으로 날린 상대.
 * 크기마다 세기별로 갈 수 있는 단계가 정해져 있다 (WRECK_CAPS: 큰 구조물은 평타로 금까지, 센 타격으로 부분 파괴까지).
 */
export function createWreck(): WreckState {
  return {
    hp: WRECKS.map((w) => w.hp),
    stage: WRECKS.map(() => 0),
    at: WRECKS.map(() => [-1, -1, -1]),
    hx: WRECKS.map((w) => Math.round((w.x1 - w.x0) / 2)),
    hy: WRECKS.map((w) => Math.round((w.y1 - w.y0) / 2)),
    dir: WRECKS.map(() => 1),
    fly: [[], []],
  };
}

const CAUSES = ['hit', 'heavy', 'fly', 'explosion', 'super'] as const;
type Cause = (typeof CAUSES)[number];

/**
 * 구조물 i를 amount만큼 깎는다 (tier: 공격 세기, x·h: 맞은 자리 월드 px·바닥에서 높이, dir: 맞은 방향).
 * 세기에 맞는 단계 밑으로는 내려가지 않는다. 단계가 오르면 그 틱을 적고 이벤트를 낸다.
 */
export function damageWreck(s: SimState, i: number, amount: number, tier: 0 | 1 | 2, x: number, h: number, dir: number, cause: Cause): void {
  const w = WRECKS[i];
  const st = s.wreck;
  if (st.stage[i] >= 3 || !(amount > 0)) return;
  const cap = WRECK_CAPS[w.size][tier];
  // 그 단계까지만: 다음 단계 문턱 바로 위에서 멈춘다
  const floor = cap >= 3 ? 0 : cap === 2 ? 1 : Math.floor((w.hp * R.stages[cap]) / 100) + 1;
  const before = st.stage[i];
  const hp = Math.max(Math.min(st.hp[i], floor), st.hp[i] - amount);
  if (hp === st.hp[i]) return;
  st.hp[i] = hp;
  st.hx[i] = Math.max(0, Math.min(w.x1 - w.x0, Math.round(x - w.x0)));
  st.hy[i] = Math.max(0, Math.min(w.y1 - w.y0, Math.round(h - w.y0)));
  st.dir[i] = dir < 0 ? -1 : 1;
  const stage = wreckStageOf(w, hp);
  for (let k = before + 1; k <= stage; k++) st.at[i][k - 1] = s.tick;
  st.stage[i] = stage;
  s.events.push({
    type: 'wreck', who: i, x: px(x), y: -px(h), combo: stage > before ? stage : 0, text: cause, heavy: tier > 0,
  });
}

const overlaps = (w: (typeof WRECKS)[number], b: WBox): boolean =>
  px(w.x0) < b.x1 && b.x0 < px(w.x1) && -px(w.y1) < b.y1 && b.y0 < -px(w.y0);

/** 상자(월드, 1/256px)와 구조물이 겹치는 가운데 자리 (px) */
function contact(w: (typeof WRECKS)[number], b: WBox): [number, number] {
  const x0 = Math.max(w.x0, b.x0 / 256);
  const x1 = Math.min(w.x1, b.x1 / 256);
  const y0 = Math.max(w.y0, -b.y1 / 256);
  const y1 = Math.min(w.y1, -b.y0 / 256);
  return [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)];
}

/** 기술 하나에 구조물마다 한 번: 사람 f의 이번 기술이 친 구조물 번호 (f.propHits에 물건 번호와 겹치지 않게 더해 적는다) */
export const WRECK_HIT_BASE = 100000;

/**
 * 공격 상자 hb에 닿은 구조물을 깎는다 (기술 하나에 구조물마다 한 번). isSuper면 필살기 세기.
 * 물건 깎기(sim/props.ts smashProps)와 같은 자리에서 부른다. 기록은 f.propHits에 WRECK_HIT_BASE를 더해 남긴다
 * (기술이 시작될 때 비워지는 목록이라 기술마다 한 번이 된다. 이 번호들은 물건 판정에 쓰이지 않는다)
 */
export function smashWreck(s: SimState, f: Fighter, hb: WBox, amount: number, isSuper: boolean, heavy: boolean): void {
  const tier = isSuper ? 2 : heavy ? 1 : 0;
  const dmg = isSuper ? amount * R.superMul : amount;
  for (let i = 0; i < WRECKS.length; i++) {
    if (s.wreck.stage[i] >= 3 || f.propHits.includes(WRECK_HIT_BASE + i)) continue;
    const w = WRECKS[i];
    if (!overlaps(w, hb)) continue;
    f.propHits.push(WRECK_HIT_BASE + i);
    const [x, h] = contact(w, hb);
    damageWreck(s, i, dmg, tier, x, h, f.facing, isSuper ? 'super' : 'hit');
  }
}

/** (cx, ch) 둘레 radius 안의 구조물을 깎는다 (센 타격이 맞은 자리, 자동차 폭발). 가장자리(반지름 절반 밖)는 절반만 */
export function wreckArea(s: SimState, cx: number, ch: number, radius: number, amount: number, tier: 0 | 1 | 2, dir: number, cause: Cause): void {
  for (let i = 0; i < WRECKS.length; i++) {
    if (s.wreck.stage[i] >= 3) continue;
    const w = WRECKS[i];
    const dx = Math.max(w.x0 - cx, 0, cx - w.x1);
    const dy = Math.max(w.y0 - ch, 0, ch - w.y1);
    const d2 = dx * dx + dy * dy;
    if (d2 > radius * radius) continue;
    const amt = d2 * 4 <= radius * radius ? amount : amount >> 1;
    damageWreck(s, i, amt, tier, Math.max(w.x0, Math.min(w.x1, cx)), Math.max(w.y0, Math.min(w.y1, ch)), dir, cause);
  }
}

const FLYING = new Set(['airhit', 'ko', 'hitstun', 'crush']);
const BODY_H = 40;

/**
 * 세게 날아온 몸이 부딪힌 구조물을 깎는다 (한 번 날아가는 동안 구조물마다 한 번). '벽 쪽으로 날림'에 맞아 날아온 몸이면 세기 2.
 * 몸은 막히지도 느려지지도 않는다 (장식). 틱마다 사람이 움직인 뒤에 부른다
 */
export function flyWreck(s: SimState): void {
  s.fighters.forEach((f, who) => {
    const seen = s.wreck.fly[who];
    if (!FLYING.has(f.mode)) {
      if (seen.length) s.wreck.fly[who] = [];
      return;
    }
    const speed = Math.max(Math.abs(f.vx), Math.abs(f.vy)) / 256;
    if (speed < R.fly.minSpeed) return;
    const x = Math.round(f.x / 256);
    const feet = Math.round(-f.y / 256);
    for (let i = 0; i < WRECKS.length; i++) {
      if (s.wreck.stage[i] >= 3 || seen.includes(i)) continue;
      const w = WRECKS[i];
      if (x + 4 <= w.x0 || x - 4 >= w.x1 || feet + BODY_H <= w.y0 || feet >= w.y1) continue;
      seen.push(i);
      const amount = f.wallFly ? R.fly.amount * R.fly.wallMul : R.fly.amount;
      damageWreck(s, i, amount, f.wallFly ? 2 : 1, x, Math.max(w.y0, Math.min(w.y1, feet + BODY_H / 2)), Math.sign(f.vx) || 1, 'fly');
    }
  });
}
