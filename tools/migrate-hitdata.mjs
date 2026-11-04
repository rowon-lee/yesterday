// 3-0a(2) 옮기기 도구 (한 번 쓰는 것): 판정을 애니메이션에서 떼어 공격 데이터로 옮긴다.
// 바꾸기 전 코드(그림 프레임 번호로 판정·시간을 계산하던 sim)를 그대로 불러, sim이 실제로 쓰던 값을 틱 단위 숫자로 받아 적는다.
//   git worktree add ../before <바꾸기 전 커밋> && node tools/migrate-hitdata.mjs --from ../before
// → src/data/moves/time.ts (캐릭터 × 기술: 길이·판정 구간과 상자·연타 구간·몸 이동·순간이동·벽 박차기·차지·캐릭터 규칙 시점·연출 장면 길이)
//   src/data/moves/hurt.ts (동작 이름마다 구간별 틱 수와 피격 상자, 되풀이·늘이기 구간)
//   out/migrate-expected.json (바꾸기 전 sim의 틱마다 공격 상자·판정 선, 프레임마다 피격 상자: tools/hitcheck.mjs가 비교)
// 옮긴 뒤에는 이 숫자들이 판정의 기준이다. 그림을 다시 깎아도 이 도구로 다시 뽑지 않는다 (판정을 그림에 다시 묶게 된다).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const argv = process.argv.slice(2);
const from = resolve(argv[argv.indexOf('--from') + 1] ?? '.');
const vite = await createServer({ root: from, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const L = (p) => vite.ssrLoadModule(p);
const frames = await L('/src/sim/frames.ts');
const { MOTIONS } = await L('/src/anim/motions.ts');
const { hurtBox } = await L('/src/anim/boxes.ts');
const { CHARACTERS } = await L('/src/data/characters/index.ts');
const { BASE_MOVES } = await L('/src/data/moves/base.ts');
const { HIT_AIR_LOOP_FROM, HIT_STRETCH } = await L('/src/data/poses/common.ts');
const { WALL_CLING_LOOP_FROM, WALL_RUN_TOP_FROM } = await L('/src/data/poses/wall.ts');
await vite.close();

const ID_KO = { atk1: '1타', atk2: '2타', atk3: '3타', atk4: '4타', launcher: '띄우기', sweep: '쓸기', dashAttack: '대시 공격', charge: '차지', air1: '공중 1타', air2: '공중 2타', air3: '공중 3타', slam: '내려찍기', wallKick: '벽 박차기', skill1: '스킬 1', skill2: '스킬 2', super: '필살기' };
/** 에드워드 캐릭터 규칙이 프레임 번호로 쓰던 시점 (sim/chars/edward.ts, 0부터 센 프레임 → 그 프레임이 시작하는 틱) */
const EDWARD_MARKS = { slam: { slamDrop: 4, slamHold: 6, slamLand: 6 }, charge: { slab: 11 }, skill2: { tkPull: 5, tkDrop: 10 } };

const boxArr = (b) => (b ? [b.x, b.y, b.w, b.h] : null);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (msg) => {
  console.error(`NG  ${msg}`);
  process.exit(1);
};

const expected = { hit: {}, hurt: {} };
const time = {};
for (const cid of Object.keys(CHARACTERS)) {
  const ms = frames.movesOf(cid);
  time[cid] = {};
  for (const id of Object.keys(BASE_MOVES)) {
    const mv = ms[id];
    const d = mv.data;
    const fr = mv.frames;
    const n = fr.dur.length;
    const cum = fr.cum;
    /** 프레임 k가 시작하는 틱 */
    const at = (k) => (k <= 0 ? 0 : cum[k - 1]);
    const levels = d.charge?.levels.some((l) => l.box) ? d.charge.levels.length : 0;
    // 판정 구간: 판정 프레임마다 (그 프레임 동안 상자가 하나)
    const hits = [];
    for (const k of d.active) {
      const t0 = at(k);
      const t1 = cum[k];
      const box = boxArr(frames.moveHitBox(mv, t0, 0));
      const h = { t: [t0, t1], box };
      if (levels) h.levels = Array.from({ length: levels }, (_, i) => boxArr(frames.moveHitBox(mv, t0, i + 1)));
      const line = frames.moveHitLine(mv, t0);
      if (line) h.line = line.map((p) => [p[0], p[1]]);
      for (let t = t0; t < t1; t++) {
        if (!same(boxArr(frames.moveHitBox(mv, t, 0)), box)) fail(`${cid}.${id}: ${t}틱 상자가 프레임 안에서 바뀜`);
      }
      hits.push(h);
    }
    for (let i = 1; i < hits.length; i++) if (hits[i].t[0] !== hits[i - 1].t[1]) fail(`${cid}.${id}: 판정 프레임이 이어지지 않음`);
    const T = { total: mv.total, hits };
    if (hits.length) T.chain = [mv.activeStart, mv.activeEnd];
    // 몸 이동: 프레임마다 [표시 틱, px] (0인 프레임은 이어 붙인다: 고르게 나누는 계산이 같다)
    const runs = (adv) => {
      const out = [];
      for (let k = 0; k < n; k++) {
        const p = adv[k] ?? 0;
        const last = out[out.length - 1];
        if (p === 0 && last && last[1] === 0) last[0] += fr.dur[k];
        else out.push([fr.dur[k], p]);
      }
      return out;
    };
    if (d.advance) T.advance = runs(d.advance);
    if (d.charge?.levels.some((l) => l.advance)) T.levelAdvance = d.charge.levels.map((l) => (l.advance ? runs(l.advance) : null));
    // 프레임 번호 [from, to] 구간 → 틱 [시작, 끝). 마지막 프레임까지면 sim이 끝 뒤에도 그 프레임으로 보았으므로 따로 확인한다
    const span = (a, b, what) => {
      if (b >= n - 1) fail(`${cid}.${id}: ${what}가 마지막 프레임까지 (틱으로 옮기면 끝 틱 처리가 달라진다)`);
      return [at(a), cum[b]];
    };
    if (d.step) {
      const [f0, f1] = span(d.step.from, d.step.to, 'step');
      T.step = { from: f0, to: f1, speed: d.step.speed };
    }
    if (d.dive) {
      const [f0, f1] = span(d.dive.from, d.dive.to, 'dive');
      T.dive = { from: f0, to: f1, vx: d.dive.vx, vy: d.dive.vy };
    }
    if (d.blink) {
      if (d.active[d.active.length - 1] >= n - 1) fail(`${cid}.${id}: 순간이동 기술의 판정이 마지막 프레임까지`);
      T.blink = { at: mv.blink.tick, dist: d.blink.dist, gap: d.blink.gap };
    }
    if (d.charge) T.charge = { loop: [at(d.charge.windup), cum[d.charge.loopTo]], release: at(d.charge.from) };
    const marks = cid === 'edward' ? EDWARD_MARKS[id] : undefined;
    if (marks) T.marks = Object.fromEntries(Object.entries(marks).map(([k, f]) => [k, at(f)]));
    if (d.cinematic) {
      const total = (sc) => sc.map((x) => MOTIONS.find((m) => m.name === x.a.motion).dur.reduce((a, b) => a + b, 0));
      T.scenes = total(d.cinematic.scenes);
      if (d.cinematic.short) T.short = total(d.cinematic.short);
    }
    time[cid][id] = { motion: d.motion, ...T };
    // 비교용: 틱마다 바꾸기 전 sim의 공격 상자·판정 선 (단계별)
    const ex = [];
    for (let t = 0; t <= mv.total + 2; t++) {
      const row = [boxArr(frames.moveHitBox(mv, t, 0)), frames.moveHitLine(mv, t)?.map((p) => [p[0], p[1]]) ?? null];
      for (let lv = 1; lv <= levels; lv++) row.push(boxArr(frames.moveHitBox(mv, t, lv)));
      ex.push(row);
    }
    expected.hit[`${cid}.${id}`] = { total: mv.total, activeStart: mv.activeStart ?? null, activeEnd: mv.activeEnd ?? null, ticks: ex };
  }
}

// 피격 상자: 동작마다 프레임별 (sim은 상태에 맞는 그림·프레임을 골라 그 관절로 피격 상자를 만들었다)
const hurt = {};
for (const m of MOTIONS) {
  hurt[m.name] = m.dur.map((d, i) => [d, ...boxArr(hurtBox(m.joints[i]))]);
  expected.hurt[m.name] = hurt[m.name];
}

// ---- 파일 쓰기 ----
const J = (v) =>
  JSON.stringify(v)
    .replace(/"(\w+)":/g, '$1: ')
    .replace(/"/g, "'")
    .replace(/,(?=\S)/g, ', ')
    .replace(/\{(?=\S)/g, '{ ')
    .replace(/(?<=\S)\}/g, ' }')
    .replace(/':(?=\S)/g, "': ");
const WHO = { base: '기본 스틱맨', raiden: '라이덴', eunwoo: '백은우', edward: '에드워드', oscar: '오스카' };
let ts = `import type { MoveTime } from './types';

/*
 * 공격 데이터 — 시간·판정·몸 이동 (틱 단위, 3-0a(2) 2026-11-04). sim은 판정을 그림이 아니라 이 숫자에서 얻는다.
 * 처음 값은 바꾸기 전 sim이 그림(프레임별 표시 틱·관절)에서 계산하던 값을 그대로 옮겼다 (tools/migrate-hitdata.mjs). 이제부터는 이 숫자가 기준:
 * 그림을 다시 깎아도 여기는 바뀌지 않고, 판정·박자를 바꾸려면 여기를 고친다. 상자는 발밑 기준·오른쪽 보는 기준 px [x, y, w, h].
 * 캐릭터 × 기술마다 하나씩 (상속 없음). 뜻은 ./types.ts MoveTime.
 */
export const MOVE_TIME: Readonly<Record<string, Readonly<Record<string, MoveTime>>>> = {
`;
for (const [cid, ms] of Object.entries(time)) {
  ts += `  // ---- ${WHO[cid]} ----\n  ${cid}: {\n`;
  for (const [id, T] of Object.entries(ms)) {
    const h = T.hits;
    const sum = h.length ? `발동 ${T.chain[0]} · 지속 ${T.chain[1] - T.chain[0]} · 회복 ${T.total - T.chain[1]}` : '판정 없음';
    ts += `    // ${ID_KO[id]} (${T.motion}): ${T.total}틱 = ${sum}\n    ${id}: ${J(T)},\n`;
  }
  ts += '  },\n';
}
ts += '};\n';

let hs = `import type { HurtSpan } from './types';

/*
 * 피격 상자 시간표 (3-0a(2) 2026-11-04): 상태에 맞는 동작 이름마다 구간별 [틱 수, x, y, w, h] (발밑 기준·오른쪽 보는 기준 px).
 * sim은 지금 상태가 이 시간표의 몇 번째 구간인지 골라(sim/pose.ts) 그 상자를 피격 상자로 쓴다. 그림은 읽지 않는다.
 * 처음 값은 바꾸기 전 그림의 프레임별 표시 틱과 관절로 만든 피격 상자를 그대로 옮겼다 (tools/migrate-hitdata.mjs).
 */
export const HURT: Readonly<Record<string, readonly HurtSpan[]>> = {
${Object.entries(hurt).map(([k, v]) => `  '${k}': ${J(v)},`).join('\n')}
};

/** 구간 번호 규칙 (0부터, 위 시간표의 구간): 공중에서 맞음·벽 붙기의 되풀이 시작, 벽 달리기 꼭대기 넘어가기 시작, 경직 길이에 맞춰 늘리는 구간 */
export const HURT_RULES = {
  hitAirLoopFrom: ${HIT_AIR_LOOP_FROM},
  wallClingLoopFrom: ${WALL_CLING_LOOP_FROM},
  wallRunTopFrom: ${WALL_RUN_TOP_FROM},
  stretch: ${J(HIT_STRETCH)} as Readonly<Record<string, number>>,
} as const;
`;

writeFileSync('src/data/moves/time.ts', ts);
writeFileSync('src/data/moves/hurt.ts', hs);
mkdirSync('out', { recursive: true });
writeFileSync('out/migrate-expected.json', JSON.stringify(expected));
console.log(`OK  src/data/moves/time.ts (${Object.values(time).reduce((a, m) => a + Object.keys(m).length, 0)}개 기술), src/data/moves/hurt.ts (${Object.keys(hurt).length}개 동작), out/migrate-expected.json`);
