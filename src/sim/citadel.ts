import { BIG, D_PLAZA, KEEP_RULES as R, KEEP_ZONE, type HillBlock } from '../stage/citadel';
import { activeHitOf, type WBox } from './combat';
import { MOVES } from './frames';
import { breakProp, SMASH_KEEP } from './props';
import { px } from './rules';
import type { CitadelState, SimState } from './types';

/**
 * 시타델 붕괴 (기획서 '시타델 붕괴'). 본관 내구도·단계·무너진 틱·잔해 언덕은 sim 상태다 (결정론).
 * 파편·먼지·불길 그림은 렌더 전용이다 (render/gl/plaza.ts).
 * - 구역(본관 정면 앞, 두 기둥탑 포함) 안의 강한 타격, 기둥탑 벽꽝, 필살기가 내구도를 깎는다
 * - 금(1) → 유리 깨짐·간판 떨어짐(2) → 외벽 갈라짐·불(3). 3단계에서는 1 아래로 내려가지 않는다
 * - 3단계에서 필살기 판정이 구역에 닿으면 무너진다(4): 슬로모션, 계단참·기둥탑·테라스·쓰러진 간판이 묻히고
 *   settle틱 뒤 잔해 언덕이 다 쌓여 발판·벽이 된다. 라운드가 넘어가도 남고, 한 경기에 한 번이다 (새 경기에만 새로)
 */
export function createCitadel(): CitadelState {
  return { hp: R.hp, stage: 0, stageAt: [-1, -1, -1, -1], by: -1, hill: [] };
}

/** 본관이 서 있는가 (무너지기 전) */
export const keepStanding = (s: SimState): boolean => s.citadel.stage < 4;

/** 무너진 뒤 다 쌓인 잔해 언덕 (아직 아니면 빈 목록) */
export function settledHill(s: SimState): readonly HillBlock[] {
  const c = s.citadel;
  return c.stage === 4 && s.tick - c.stageAt[3] >= R.settle ? c.hill : [];
}

const inZone = (x: number): boolean => x >= KEEP_ZONE.x0 && x < KEEP_ZONE.x1;

/**
 * 구역 안 x(월드 px)에서 본관 내구도를 amount만큼 깎는다 (who: 깎은 사람). 단계가 넘어가면 이벤트, 2단계가 되면 정면 간판이 떨어진다.
 * 3단계에서는 1 아래로 내려가지 않는다 (필살기로만 무너진다)
 */
export function damageCitadel(s: SimState, x: number, amount: number, who: number): void {
  const c = s.citadel;
  if (c.stage >= 4 || !inZone(x)) return;
  c.hp = Math.max(1, c.hp - amount);
  s.events.push({ type: 'citadel', who, x: px(x), y: -px(40), text: 'damage', combo: amount });
  const stages: readonly number[] = R.stages;
  while (c.stage < 3 && c.hp <= stages[c.stage]) {
    c.stage = (c.stage + 1) as CitadelState['stage'];
    c.stageAt[c.stage - 1] = s.tick;
    s.events.push({ type: 'citadel', who, x: px(x), y: -px(KEEP_ZONE.h / 2), text: 'stage', combo: c.stage });
    // 2단계: 유리가 깨지고 정면 대형 간판이 떨어진다 (이미 떨어졌으면 그대로)
    if (c.stage === 2) dropSign(s);
  }
}

/** 정면 대형 간판이 아직 붙어 있으면 떨어뜨린다 (큰 물건 '시타델 간판') */
function dropSign(s: SimState): void {
  const p = s.props[BIG.bigsign];
  if (p.stage === 2) return;
  const sg = D_PLAZA.sign;
  p.dir = 1;
  breakProp(s, BIG.bigsign, px(sg.x + sg.w / 2), -px(sg.bottom + sg.h / 2), false, SMASH_KEEP);
}

/** 기둥탑 앞면에 박히는가 (벽꽝): 본관이 서 있고, x(월드 px)가 기둥탑 폭 안이고, 높이 h(px)가 기둥탑 높이 아래 */
export function towerBehind(s: SimState, x: number, h: number): boolean {
  if (!keepStanding(s) || h >= D_PLAZA.tower.h) return false;
  return D_PLAZA.towers.some((t) => x >= t.x && x < t.x + D_PLAZA.tower.w);
}

/** 구역 상자 (월드, 1/256px): 본관 정면 앞 바닥부터 본관 높이까지 */
const ZONE_BOX: WBox = { x0: px(KEEP_ZONE.x0), x1: px(KEEP_ZONE.x1), y0: -px(KEEP_ZONE.h), y1: 0 };
const overlap = (a: WBox, b: WBox): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * 필살기 판정이 구역에 닿으면 (상대에게 맞았는지와 상관없이, 기술 하나에 한 번): 3단계면 무너지고, 아니면 내구도를 크게 깎는다.
 * 틱마다 공격 판정이 정해진 뒤에 부른다
 */
export function hitCitadel(s: SimState): void {
  s.fighters.forEach((f, who) => {
    if (!keepStanding(s) || f.citadelHit) return;
    const hb = activeHitOf(f);
    if (!hb || !MOVES[f.move!].data.cutin || !overlap(hb, ZONE_BOX)) return;
    f.citadelHit = true;
    const x = Math.round((hb.x0 + hb.x1) / 2 / 256);
    if (s.citadel.stage === 3) collapse(s, who, Math.min(KEEP_ZONE.x1 - 1, Math.max(KEEP_ZONE.x0, x)));
    else damageCitadel(s, Math.min(KEEP_ZONE.x1 - 1, Math.max(KEEP_ZONE.x0, x)), R.damage.super, who);
  });
}

/** 본관이 무너진다 (x: 필살기가 닿은 자리). 잔해 언덕은 settle틱 뒤에 발판·벽이 된다 */
function collapse(s: SimState, who: number, x: number): void {
  const c = s.citadel;
  c.stage = 4;
  c.hp = 0;
  c.stageAt[3] = s.tick;
  c.by = who;
  c.hill = R.hill.map((b) => ({ x0: b.x0, x1: b.x1, h: b.h }));
  s.slow = Math.max(s.slow, R.slow);
  dropSign(s);
  s.events.push({ type: 'citadel', who, x: px(x), y: -px(KEEP_ZONE.h / 2), text: 'collapse', combo: 4 });
}
