// CPU끼리 N판 자동 대전. 예외, 규칙 범위, 결정론(같은 입력 재생·저장/복원 후 같은 해시)을 확인한다.
//   npm run simtest -- [--matches 20] [--ticks 20000] [--seed 1]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const args = parseArgs(process.argv.slice(2), { matches: 20, ticks: 20000, seed: 1 });
let failed = 0;
/** 새 구조물 발판 (컨테이너 더미·등대 밑동·급수탑·쓰러진 간판·뒤집힌 전차·잔해 더미) */
const NEW_KINDS = new Set(['containers', 'stump', 'watertower', 'sign', 'tram', 'rubble']);

// 1) sim/ 안에 무작위·시간 값이 없는지 소스를 훑는다.
const FORBIDDEN = /\b(Math\.random|Date\.now|performance\.now|new Date)\b/;
for (const file of walk('src/sim')) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (FORBIDDEN.test(line)) {
      failed++;
      console.log(`NG  금지된 값 사용: ${file}:${i + 1}  ${line.trim()}`);
    }
  });
}

// 2) sim 코드를 그대로 불러와 돌린다 (TypeScript는 Vite가 변환).
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
const R = sim.RULES;
const HP = sim.createState(0).fighters[0].hp;

const total = { chargeGo: 0, chargeLv: [0, 0, 0], chargeHit: 0, chargeCut: 0, dashAtk: 0, dashAtkHit: 0, keepStage: [0, 0, 0, 0, 0], keepFall: 0, wallcling: 0, walljump: 0, wallrun: 0, wallkick: 0, walltech: 0, bigDamaged: 0, bigBroken: 0, structTicks: 0, cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0, neon: 0, wins: [0, 0, 0], rounds: 0, ticks: 0 };
const t0 = Date.now();
for (let m = 0; m < args.matches; m++) {
  const seed = args.seed + m;
  try {
    const a = runCpuMatch(seed, args.ticks);
    const b = replay(seed, a.log, null);
    const c = replay(seed, a.log, Math.floor(a.log.length / 2));
    const ok = a.hash === b && a.hash === c && a.ended && a.problems.length === 0;
    if (!ok) failed++;
    const w = a.winner < 0 ? '무승부' : `${a.winner + 1}P 승`;
    console.log(`${ok ? 'OK ' : 'NG '} ${String(m + 1).padStart(2)}판 시드 ${seed}: ${a.log.length}틱, ${a.rounds}라운드, ${w}, 히트 ${a.stats.hit} 방어 ${a.stats.block} 띄우기 ${a.stats.launch} 낙법 ${a.stats.tech} 크러시 ${a.stats.crush} 필살 ${a.stats.cutin} 최대콤보 ${a.stats.maxCombo} 물건파괴 ${a.stats.propBroken}(부딪힘 ${a.stats.propCrash}) 벽붙기 ${a.stats.wallcling} 벽점프 ${a.stats.walljump} 벽달리기 ${a.stats.wallrun} 박차기 ${a.stats.wallkick} 대시공격 ${a.stats.dashAtk} 차지 ${a.stats.chargeGo} 붕괴 ${a.stats.collapse} 벽꽝 ${a.stats.wallsplat}(벽낙법 ${a.stats.walltech}) 시타델 ${a.keep.stage}단계${a.keep.stage === 4 ? `(${a.keep.round}라운드에 붕괴)` : ''} ${a.keep.hp} 발판 ${a.stats.perch}(최고 ${a.stats.maxPerch}px) | 해시 ${a.hash}${a.hash === b ? '' : ` ≠ 재생 ${b}`}${a.hash === c ? '' : ` ≠ 저장·복원 ${c}`}${a.ended ? '' : ' | 경기가 끝나지 않음'}`);
    for (const p of a.problems.slice(0, 5)) console.log(`      ${p}`);
    for (const k of Object.keys(a.stats)) {
      if (k === 'chargeLv') a.stats.chargeLv.forEach((v, i) => (total.chargeLv[i] += v));
      else if (k !== 'maxCombo' && k !== 'maxPerch') total[k] += a.stats[k];
    }
    total.maxCombo = Math.max(total.maxCombo, a.stats.maxCombo);
    total.maxPerch = Math.max(total.maxPerch, a.stats.maxPerch);
    total.wins[a.winner < 0 ? 2 : a.winner]++;
    total.keepStage[a.keep.stage]++;
    total.rounds += a.rounds;
    total.ticks += a.log.length;
  } catch (e) {
    failed++;
    console.log(`NG  ${m + 1}판 (시드 ${seed}): 예외 ${e?.stack ?? e}`);
  }
}
// 3) 발판 규칙을 하나씩 확인한다 (정해진 입력으로)
const plat = platformChecks();
for (const [name, ok, note] of plat) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 발판 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 2-1) 공격 버튼 (정해진 입력으로): 대시 공격
for (const [name, ok, note] of attackChecks()) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 공격 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 5) 벽 기동 (정해진 입력으로)
for (const [name, ok, note] of wallChecks()) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 벽 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 4) 구조물과 큰 물건 (정해진 입력으로)
for (const [name, ok, note] of structureChecks()) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 구조물 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 5-1) 등장: 경기 첫 라운드 시작 연출 동안 등장 동작, 끝나면 대기. 두 번째 라운드는 등장 없이
{
  const s = sim.createState(1);
  const first = s.fighters.every((f) => f.mode === 'intro');
  let idleBeforeFight = false;
  while (s.phase === 'intro') {
    sim.step(s, [0, 0]);
    if (s.phase === 'intro') idleBeforeFight = s.fighters.every((f) => f.mode === 'idle');
  }
  const fightIdle = s.fighters.every((f) => f.mode === 'idle');
  s.fighters[1].hp = 0;
  const round = s.round;
  while (s.round === round && s.tick < 2000) sim.step(s, [0, 0]);
  const second = s.round === round + 1 && s.fighters.every((f) => f.mode === 'idle');
  const ok = first && idleBeforeFight && fightIdle && second;
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 등장 시험: 첫 라운드 시작 연출 동안 등장 동작, 싸움 전에 대기로, 두 번째 라운드는 등장 없음 (처음 ${first}, 싸움 전 대기 ${idleBeforeFight}, 둘째 라운드 ${second})`);
}
// 5-4) 공통 맞는 동작: 프레임 수는 그대로, 늘어나는 프레임의 표시 틱만 바꿔 경직 길이에 맞춘다 (공통 동작 사양서)
for (const [name, ok, note] of [...hitMotionChecks(), ...commonMotionChecks()]) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 맞는 동작 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 5-5) 캐릭터: 캐릭터마다 자기 동작 그림과 능력치, 라이덴이 낀 CPU 대전도 결정론
for (const [name, ok, note] of charChecks()) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 캐릭터 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 5-3) 필살기 연출 (정해진 입력으로)
for (const [name, ok, note] of cineChecks()) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 필살기 연출 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 5-2) 연습: 시간이 흐르지 않고, 쓰러지지 않으며(체력 1에서 멈춤), 맞는 콤보가 끝나고 1초 뒤 체력·기력·방어가 다시 찬다
{
  const s = sim.createState(1, { practice: true });
  while (s.phase !== 'fight') sim.step(s, [0, 0]);
  const t0 = s.timer;
  const [a, d] = s.fighters;
  a.x = 2400 * 256;
  d.x = 2440 * 256;
  d.hp = 5;
  let minHp = d.hp;
  let ko = false;
  for (let k = 0; k < 40; k++) {
    sim.step(s, [k % 4 === 0 ? sim.IN_ATTACK : 0, 0]);
    minHp = Math.min(minHp, d.hp);
    ko ||= d.mode === 'ko';
  }
  // 마지막 타에 벽꽝·다운·기상까지 가므로 넉넉히 기다린다
  for (let k = 0; k < 320; k++) sim.step(s, [0, 0]);
  const ok = s.timer === t0 && minHp === 1 && !ko && d.hp === HP && a.meter === R.METER_MAX && s.phase === 'fight';
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 연습 시험: 시간이 그대로, 체력 1에서 멈추고 쓰러지지 않음, 1초 뒤 체력·기력이 다시 참 (시간 ${t0} → ${s.timer}, 가장 낮은 체력 ${minHp}, 쓰러짐 ${ko}, 다시 찬 체력 ${d.hp}, 기력 ${a.meter})`);
}
// 6) 시타델 붕괴 (정해진 입력으로)
for (const [name, ok, note] of keepChecks()) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'NG '} 시타델 시험: ${name}${note ? ` (${note})` : ''}`);
}
// 7) 시타델을 3단계로 놓고(기력 가득) 시작하는 CPU 대전: 필살기로 무너뜨리고 잔해 언덕 위에서 싸운다 (예외·규칙 범위·결정론)
const keepSetup = (st) => {
  const c = st.citadel;
  c.hp = sim.KEEP_RULES.stages[2];
  c.stage = 3;
  c.stageAt = [0, 0, 0, -1];
  const p = st.props[sim.BIG.bigsign];
  Object.assign(p, { hp: 0, stage: 2, damagedAt: 0, brokenAt: 0 });
  st.fighters.forEach((f) => (f.meter = R.METER_MAX));
};
for (let m = 0; m < 6; m++) {
  const seed = 200 + m;
  try {
    const a = runCpuMatch(seed, args.ticks, keepSetup);
    const b = replay(seed, a.log, null, keepSetup);
    const c = replay(seed, a.log, Math.floor(a.log.length / 2), keepSetup);
    const ok = a.hash === b && a.hash === c && a.ended && a.problems.length === 0 && a.keep.stage === 4;
    if (!ok) failed++;
    total.keepFall += a.keep.stage === 4 ? 1 : 0;
    console.log(`${ok ? 'OK ' : 'NG '} 시타델 3단계로 시작 시드 ${seed}: ${a.log.length}틱, ${a.rounds}라운드, ${a.keep.stage === 4 ? `${a.keep.round}라운드에 붕괴` : `${a.keep.stage}단계 (안 무너짐)`}, 발판 ${a.stats.perch}(최고 ${a.stats.maxPerch}px) 벽붙기 ${a.stats.wallcling} 벽달리기 ${a.stats.wallrun} | 해시 ${a.hash}${a.hash === b ? '' : ` ≠ 재생 ${b}`}${a.hash === c ? '' : ` ≠ 저장·복원 ${c}`}${a.ended ? '' : ' | 경기가 끝나지 않음'}`);
    for (const p of a.problems.slice(0, 5)) console.log(`      ${p}`);
  } catch (e) {
    failed++;
    console.log(`NG  시타델 3단계로 시작 시드 ${seed}: 예외 ${e?.stack ?? e}`);
  }
}
await vite.close();

console.log(`\n합계 ${args.matches}판 ${total.rounds}라운드 (${(total.ticks / 60 / 60).toFixed(1)}분 분량), ${Date.now() - t0}ms`);
console.log(`  1P 승 ${total.wins[0]}, 2P 승 ${total.wins[1]}, 무승부 ${total.wins[2]}`);
console.log(`  히트 ${total.hit}, 방어 ${total.block}, 가드 크러시 ${total.crush}, 띄우기 ${total.launch}, 낙법 ${total.tech}, 다운 ${total.knockdown}, KO ${total.ko}, 시간 초과 ${total.timeup}, 필살 ${total.cutin}, 최대 콤보 ${total.maxCombo}`);
console.log(`  건물: 깎인 덩어리 ${total.cityChunks}, 붕괴 ${total.collapse}, 벽꽝 ${total.wallsplat}`);
console.log(`  부서지는 물건: 망가짐 ${total.propDamaged}, 파괴 ${total.propBroken} (그중 날아온 캐릭터에 부딪혀서 ${total.propCrash}, 네온 간판 꺼짐 ${total.neon})`);
console.log(`  발판: 올라선 횟수 ${total.perch}, 발판 위 ${(total.perchTicks / 60).toFixed(0)}초 (그중 새 구조물 위 ${(total.structTicks / 60).toFixed(0)}초), ↓+점프로 내려옴 ${total.drop}, 가장 높이 선 곳 ${total.maxPerch}px`);
console.log(`  큰 물건: 망가짐 ${total.bigDamaged}, 크게 무너짐 ${total.bigBroken}`);
console.log(`  시타델: CPU 대전 ${args.matches}판이 끝났을 때 단계 0~4 = ${total.keepStage.join(' / ')}, 3단계로 시작한 6판 중 붕괴 ${total.keepFall}판`);
console.log(`  공격 버튼: 대시 공격 ${total.dashAtk} (맞힘 ${total.dashAtkHit}), 차지 ${total.chargeGo} (1·2·3단계 ${total.chargeLv.join('·')}, 맞힘 ${total.chargeHit}, 모으다 맞아 취소 ${total.chargeCut})`);
console.log(`  벽 기동: 벽 붙기 ${total.wallcling}, 벽 점프 ${total.walljump}, 벽 달리기 ${total.wallrun}, 벽 박차기 공격 ${total.wallkick}, 벽 낙법 ${total.walltech} (벽꽝 ${total.wallsplat}번 중)`);
console.log(failed ? `실패 ${failed}건` : '모두 통과');
process.exit(failed ? 1 : 0);

/** CPU 둘이 싸우고, 틱마다 넣은 입력을 기록한다. 틱마다 규칙 범위를 검사한다. */
/**
 * 캐릭터 시험: 캐릭터마다 자기 동작 그림(아직 없는 자리는 기본 스틱맨 동작)과 능력치를 쓴다.
 * 모든 캐릭터의 모든 자리에 동작 그림이 있고, 라이덴 대기가 12프레임 모두 차례로 돌고, 라이덴이 낀 CPU 대전도 결정론이다.
 */
function charChecks() {
  const out = [];
  const SLOTS = ['idle', 'intro', 'win', 'run_f', 'run_b', 'jump', 'jump2', 'fall', 'land', 'dash', 'air_dash', 'guard', 'guard_hit', 'wall_cling', 'wall_jump', 'wall_run', 'wall_tech'];
  const missing = [];
  for (const c of sim.CHAR_IDS) {
    for (const slot of SLOTS) {
      try {
        sim.motionFrames(sim.motionOf(c, slot));
      } catch {
        missing.push(`${c}.${slot}`);
      }
    }
  }
  out.push([`모든 캐릭터(${sim.CHAR_IDS.join('·')})의 동작 자리 ${SLOTS.length}개에 그림이 있음`, missing.length === 0, missing.join(', ')]);
  // 라이덴(1P)과 기본 스틱맨(2P): 싸움이 시작되면 각자 자기 대기
  const s = sim.createState(1, { chars: ['raiden', 'base'] });
  while (s.phase === 'intro') sim.step(s, [0, 0]);
  const p0 = sim.fighterPose(s.fighters[0]).motion;
  const p1 = sim.fighterPose(s.fighters[1]).motion;
  out.push(['라이덴은 라이덴 대기, 기본 스틱맨은 기본 대기', p0 === 'raiden/idle' && p1 === 'base/idle', `${p0} · ${p1}`]);
  // 라이덴 대기: 한 바퀴(44틱) 동안 12프레임이 차례로 한 번씩, 다음 바퀴는 1번부터
  const m = sim.motionFrames('raiden/idle');
  const seen = [];
  for (let t = 0; t < m.total * 2 + 1; t++) {
    const fr = sim.fighterPose(s.fighters[0]).frame;
    if (seen[seen.length - 1] !== fr) seen.push(fr);
    sim.step(s, [0, 0]);
  }
  // 대기는 등장 연출 동안 이미 돌기 시작했으므로, 처음 나온 1번 프레임부터 한 바퀴를 본다
  const order = seen.slice(seen.indexOf(0), seen.indexOf(0) + m.dur.length + 1).join(',');
  const want = [...m.dur.keys(), 0].join(',');
  out.push([`라이덴 대기 ${m.dur.length}프레임 ${m.total}틱 되풀이`, s.fighters[0].mode === 'idle' && order === want, `프레임 차례 ${order}`]);
  // 캐릭터가 자기 그림을 쓰는 기술(라이덴 벽 박차기 공격): 그림은 라이덴 것, 판정 프레임·시간은 기본 기술과 같다
  const rk = sim.movesOf('raiden').wallKick;
  const bk = sim.movesOf('base').wallKick;
  out.push(['라이덴 벽 박차기 공격은 라이덴 그림, 시간은 기본 기술과 같음', rk.frames.name === 'raiden/wall_kick' && rk.activeStart === bk.activeStart && rk.activeEnd === bk.activeEnd && rk.total === bk.total,
    `${rk.frames.name} 판정 ${rk.activeStart}~${rk.activeEnd}틱 / 기본 ${bk.activeStart}~${bk.activeEnd}틱, 전체 ${rk.total}/${bk.total}`]);
  // 라이덴 평타 (MMA): 가만히 선 기본 스틱맨에게 1~4타 연타, 띄우기 → 점프 → 공중 1·2·3타, 쓸기, 대시 공격
  const rfresh = (x0, x1) => {
    const st = sim.createState(1, { chars: ['raiden', 'base'] });
    while (st.phase !== 'fight') sim.step(st, [0, 0]);
    st.fighters[0].x = x0 * 256;
    st.fighters[1].x = x1 * 256;
    return st;
  };
  const rrun = (st, inputs) => {
    const hits = [];
    for (const inp of inputs) {
      sim.step(st, [inp, 0]);
      for (const e of st.events) if (e.type === 'hit' && e.who === 0) hits.push(e.move);
    }
    return hits;
  };
  const tap = (inp, gap) => [inp, ...Array(gap).fill(0)];
  let st = rfresh(3150, 3190);
  // 공격을 4틱마다 눌러 연타 (다음 타는 앞 타가 맞은 뒤 예약된다)
  const mash = (inp, n) => Array.from({ length: n }, (_, i) => (i % 4 === 0 ? inp : 0));
  let hits = rrun(st, [...mash(sim.IN_ATTACK, 72), ...Array(30).fill(0)]);
  out.push(['라이덴 1~4타 연타 (잽 → 스트레이트 → 훅 → 니킥), 니킥에 상대가 날아감', hits.join(',') === 'atk1,atk2,atk3,atk4' && st.fighters[1].mode !== 'hitstun' && st.fighters[1].mode !== 'idle',
    `맞힌 기술 ${hits.join(' → ') || '없음'}, 상대 ${st.fighters[1].mode}`]);
  st = rfresh(3150, 3186);
  hits = rrun(st, [...tap(sim.IN_UP | sim.IN_ATTACK, 14), ...tap(sim.IN_JUMP | sim.IN_RIGHT, 8), ...mash(sim.IN_ATTACK, 40), ...Array(30).fill(0)]);
  out.push(['라이덴 띄우기(어퍼컷) → 점프로 쫓아 공중 잽 · 스트레이트 · 니킥', hits.join(',') === 'launcher,air1,air2,air3',
    `맞힌 기술 ${hits.join(' → ') || '없음'}`]);
  st = rfresh(3150, 3188);
  hits = rrun(st, tap(sim.IN_DOWN | sim.IN_ATTACK, 30));
  out.push(['라이덴 쓸기(로킥) → 상대 다운', hits[0] === 'sweep' && st.fighters[1].mode === 'knockdown', `맞힌 기술 ${hits.join(',') || '없음'}, 상대 ${st.fighters[1].mode}`]);
  st = rfresh(3100, 3214);
  hits = rrun(st, [...tap(sim.IN_DASH | sim.IN_RIGHT, 3), ...tap(sim.IN_ATTACK, 40)]);
  out.push(['라이덴 대시 공격(슈퍼맨 펀치)', hits[0] === 'dashAttack', `맞힌 기술 ${hits.join(',') || '없음'}`]);
  // 라이덴이 낀 CPU 대전: 예외 없이 끝나고, 같은 입력 재생·저장/복원 뒤 같은 해시
  for (const chars of [['raiden', 'base'], ['base', 'raiden'], ['raiden', 'raiden']]) {
    const opts = { chars };
    const a = runCpuMatch(7, args.ticks, null, opts);
    const b = replay(7, a.log, null, null, opts);
    const c = replay(7, a.log, Math.floor(a.log.length / 2), null, opts);
    out.push([`CPU 대전 ${chars.join(' 대 ')}`, a.hash === b && a.hash === c && a.ended && a.problems.length === 0,
      `${a.log.length}틱 ${a.rounds}라운드, 히트 ${a.stats.hit}, 해시 ${a.hash}${a.hash === b ? '' : ` ≠ 재생 ${b}`}${a.hash === c ? '' : ` ≠ 저장·복원 ${c}`}${a.problems.length ? ` 문제 ${a.problems[0]}` : ''}`]);
  }
  return out;
}

function runCpuMatch(seed, ticks, setup = null, opts = {}) {
  const state = sim.createState(seed, opts);
  if (setup) setup(state);
  let keepRound = -1;
  const cpus = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const log = [];
  const problems = [];
  const stats = { chargeGo: 0, chargeLv: [0, 0, 0], chargeHit: 0, chargeCut: 0, dashAtk: 0, dashAtkHit: 0, wallcling: 0, walljump: 0, wallrun: 0, wallkick: 0, walltech: 0, bigDamaged: 0, bigBroken: 0, structTicks: 0, cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0, neon: 0 };
  const was = [0, 0];
  while (log.length < ticks && state.phase !== 'matchEnd') {
    const inputs = [sim.cpuInput(cpus[0], state, 0), sim.cpuInput(cpus[1], state, 1)];
    log.push(inputs);
    const charging = state.fighters.map((f) => f.mode === 'charge');
    sim.step(state, inputs);
    // 모으다 맞아서 취소됨
    state.fighters.forEach((f, i) => {
      if (charging[i] && (f.mode === 'hitstun' || f.mode === 'airhit' || f.mode === 'ko' || f.mode === 'wallsplat')) stats.chargeCut++;
    });
    for (const e of state.events) {
      if (e.type === 'citadel' && e.text === 'collapse') keepRound = state.round;
      if (e.type in stats) stats[e.type]++;
      if (e.type === 'hit') stats.maxCombo = Math.max(stats.maxCombo, e.combo);
      if (e.type === 'hit' && e.move === 'dashAttack') stats.dashAtkHit++;
      if (e.type === 'hit' && e.move === 'charge') stats.chargeHit++;
      if (e.type === 'charge' && e.text === 'release') {
        stats.chargeGo++;
        stats.chargeLv[e.combo - 1]++;
      }
      if (e.type === 'city') stats.cityChunks += e.combo;
      if (e.type === 'prop') {
        if (sim.BREAKABLES[e.who].big) stats[e.text === 'damaged' ? 'bigDamaged' : 'bigBroken']++;
        if (e.text === 'damaged') stats.propDamaged++;
        else {
          stats.propBroken++;
          if (e.heavy) stats.propCrash++;
          if (sim.BREAKABLES[e.who].kind === 'neon') stats.neon++;
        }
      }
    }
    // 발판: 새로 올라선 횟수, 발판 위에 있던 틱, ↓+점프로 내려온 횟수, 가장 높이 선 발판
    state.fighters.forEach((f, i) => {
      if (f.mode === 'attack' && f.move === 'dashAttack' && f.t === 0 && f.hitstop === 0) stats.dashAtk++;
      if (f.floor < 0 && was[i] === 0) stats.perch++;
      if (f.floor < 0) {
        stats.perchTicks++;
        stats.maxPerch = Math.max(stats.maxPerch, -f.floor / 256);
        // 새 구조물 (컨테이너 더미·등대 밑동·급수탑·뒤집힌 전차·쓰러진 간판·잔해 더미) 위
        if (sim.surfacesOf(state).some((sf) => NEW_KINDS.has(sf.kind) && -sf.h * 256 === f.floor && sim.surfaceSolid(state, sf, f.x))) stats.structTicks++;
      }
      if (f.dropT === 9) stats.drop++;
      was[i] = f.floor;
    });
    if (problems.length < 20) check(state, problems);
  }
  const keep = { stage: state.citadel.stage, hp: state.citadel.hp, round: keepRound };
  return { log, hash: sim.hashState(state), stats, problems, ended: state.phase === 'matchEnd', winner: state.matchWinner, rounds: state.round, keep };
}

function check(s, problems) {
  const [a, b] = s.fighters;
  const bad = (msg) => problems.push(`틱 ${s.tick}: ${msg}`);
  for (const [i, f] of s.fighters.entries()) {
    const n = `${i + 1}P`;
    if (f.hp < 0 || f.hp > HP) bad(`${n} 체력 범위 밖 ${f.hp}`);
    if (f.meter < 0 || f.meter > R.METER_MAX) bad(`${n} 기력 범위 밖 ${f.meter}`);
    if (f.guard < 0 || f.guard > R.GUARD_MAX) bad(`${n} 방어 내구도 범위 밖 ${f.guard}`);
    if (f.x < sim.wallLeft(f.y) || f.x > R.WALL_R) bad(`${n} 벽 밖 x=${f.x / 256} y=${f.y / 256}`);
    if (f.y > 0) bad(`${n} 바닥 아래 y=${f.y / 256}`);
    if (f.y < -256 * 490) bad(`${n} 맵 위로 나감 y=${f.y / 256}`);
    if (f.mode === 'attack' && !f.move) bad(`${n} 기술 없이 공격 상태`);
    // 발판: 서 있으면 발밑에 실제로 바닥이 있어야 하고, 떠 있는 동안은 floor가 0
    const standing = !sim.isAirborne(f);
    if (f.floor > 0 || !Number.isInteger(f.floor)) bad(`${n} 바닥 값 이상 ${f.floor}`);
    if (standing && f.y !== f.floor) bad(`${n} 서 있는데 바닥과 높이가 다름 y=${f.y / 256} floor=${f.floor / 256}`);
    if (standing && f.floor < 0 && sim.floorBelow(s, f.x, f.y) !== f.y) bad(`${n} 발판이 없는 곳에 서 있음 x=${f.x / 256} y=${f.y / 256}`);
    if (!standing && f.floor !== 0) bad(`${n} 떠 있는데 바닥 값이 남음 ${f.floor / 256}`);
    if (f.dropT < 0) bad(`${n} 내려오기 틱 음수`);
    if (!Number.isInteger(f.x) || !Number.isInteger(f.y) || !Number.isInteger(f.vx) || !Number.isInteger(f.vy)) bad(`${n} 위치·속도가 정수가 아님`);
    try {
      sim.fighterPose(f);
    } catch (e) {
      bad(`${n} 그림 프레임 오류 ${e.message}`);
    }
  }
  if (Math.abs(a.x - b.x) > R.MAX_SEPARATION + 256) bad(`둘 사이가 화면 밖 ${Math.abs(a.x - b.x) / 256}px`);
  if (s.city.hp.length !== sim.CHUNKS.length) bad(`건물 덩어리 수가 다름 ${s.city.hp.length}`);
  for (let i = 0; i < s.city.hp.length; i++) {
    const v = s.city.hp[i];
    if (!Number.isInteger(v) || v < -1 || v > 100) {
      bad(`덩어리 ${i} 내구도 범위 밖 ${v}`);
      break;
    }
  }
  for (const c of s.city.collapses) {
    for (let cc = c.c0; cc <= c.c1; cc++) {
      const g = sim.GRIDS[c.b];
      if (s.city.hp[g.first + (g.rows - 1) * g.cols + cc] !== -1) bad(`무너진 기둥 꼭대기가 남아 있음 (건물 ${c.b}, 칸 ${cc})`);
    }
  }
  if (s.props.length !== sim.BREAKABLES.length) bad(`부서지는 물건 수가 다름 ${s.props.length}`);
  s.props.forEach((p, i) => {
    const max = sim.BREAKABLES[i].hp;
    if (p.hp < 0 || p.hp > max) bad(`물건 ${i} 내구도 범위 밖 ${p.hp}`);
    if ((p.stage === 2) !== (p.hp === 0)) bad(`물건 ${i} 파괴 단계와 내구도가 안 맞음 (${p.stage}, ${p.hp})`);
    if (!Number.isInteger(p.at)) bad(`물건 ${i} 탈선한 자리가 정수가 아님 ${p.at}`);
    if (p.stage === 2 && p.brokenAt < 0) bad(`물건 ${i} 부서진 시점이 없음`);
  });
}

/** 기록한 입력만으로 다시 돌린다. saveAt이 있으면 그 틱에 상태를 직렬화했다가 복원해서 이어 간다. */
function replay(seed, log, saveAt, setup = null, opts = {}) {
  let state = sim.createState(seed, opts);
  if (setup) setup(state);
  log.forEach((inputs, i) => {
    if (i === saveAt) state = JSON.parse(JSON.stringify(state));
    sim.step(state, inputs);
  });
  return sim.hashState(state);
}

/**
 * 시타델 붕괴 시험. 1P만 정해진 입력으로 움직이고 2P는 가만히 있다 (막는 시험만 ↓).
 * 깎는 원인(강한 타격·막힘·구역 밖·기둥탑 벽꽝·필살기), 단계 문턱과 2단계 간판 낙하, 3단계 바닥(1),
 * 3단계 필살기로 붕괴(슬로모션, 기둥탑 위 사람 떨어짐), 잔해 언덕(다 쌓인 뒤 발판·벽, 벽 붙기·벽 달리기),
 * 다음 라운드 유지·한 번만·새 경기 멀쩡, 붕괴 장면 결정론.
 */
function keepChecks() {
  const I = sim;
  const K = sim.KEEP_RULES;
  const results = [];
  const fresh = (x0, x1) => {
    const s = sim.createState(1);
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    const [a, b] = s.fighters;
    a.x = x0 * 256;
    b.x = x1 * 256;
    a.facing = x1 > x0 ? 1 : -1;
    b.facing = x1 > x0 ? -1 : 1;
    return s;
  };
  const run = (s, inputs, p2 = 0) => {
    const ev = [];
    for (const inp of inputs) {
      sim.step(s, [inp, p2]);
      ev.push(...s.events);
    }
    return ev;
  };
  const hold = (inp, n) => Array(n).fill(inp);
  const cit = (ev, text) => ev.filter((e) => e.type === 'citadel' && e.text === text);
  const stage3 = (s) => {
    Object.assign(s.citadel, { hp: K.stages[2], stage: 3, stageAt: [0, 0, 0, -1] });
    Object.assign(s.props[sim.BIG.bigsign], { hp: 0, stage: 2, damagedAt: 0, brokenAt: 0 });
  };
  const towerTop = sim.SURFACES.find((x) => x.kind === 'tower');
  const tx = Math.round((towerTop.x0 + towerTop.x1) / 2);
  const solidAt = (s, x, h) => sim.floorBelow(s, x * 256, -(h + 400) * 256) === -h * 256;

  // 1) 구역 안 강한 타격(스킬 1)은 40, 막히면 20, 구역 밖은 그대로
  for (const [label, x, p2, want] of [['구역 안 강한 타격(스킬 1)은 본관 내구도를 깎는다', 3180, 0, K.damage.heavy], ['막힌 강한 타격은 절반만 깎는다', 3180, I.IN_DOWN, K.damage.blocked], ['구역 밖 강한 타격은 깎지 않는다', 2500, 0, 0]]) {
    const s = fresh(x, x + 30);
    s.fighters[0].meter = R.METER_MAX;
    const ev = run(s, [I.IN_SKILL1, ...hold(0, 40)], p2);
    const landed = ev.some((e) => (e.type === 'hit' || e.type === 'block') && e.move === 'skill1');
    results.push([label, landed && K.hp - s.citadel.hp === want, `${landed ? '닿음' : '안 닿음'}, 깎인 양 ${K.hp - s.citadel.hp}`]);
  }
  // 2) 기둥탑 앞에서 벽 쪽으로 날리면 기둥탑에 박히고(벽꽝) 본관이 깎인다 (스킬 2는 강한 타격이기도 하다)
  {
    const s = fresh(tx + 30, tx);
    s.fighters[0].meter = R.METER_MAX;
    const ev = run(s, [I.IN_SKILL2, ...hold(0, 30)]);
    const splat = ev.some((e) => e.type === 'wallsplat');
    results.push(['기둥탑 앞에서 벽 쪽으로 날리면 기둥탑에 박히고(벽꽝) 본관이 깎인다', splat && K.hp - s.citadel.hp === K.damage.heavy + K.damage.splat, `벽꽝 ${splat}, 깎인 양 ${K.hp - s.citadel.hp}`]);
  }
  // 3) 단계 문턱: 금 → 유리 깨짐·간판 떨어짐 → 갈라짐·불. 3단계에서는 1 아래로 안 내려간다
  {
    const s = fresh(3180, 3240);
    const seen = [];
    const hit = (n) => {
      sim.damageCitadel(s, 3200, n, 0);
      seen.push(...cit(s.events, 'stage').map((e) => e.combo));
      s.events = [];
    };
    hit(K.hp - K.stages[0] - 1);
    const s0 = s.citadel.stage;
    hit(1);
    const s1 = s.citadel.stage;
    hit(s.citadel.hp - K.stages[1]);
    const sign = s.props[sim.BIG.bigsign].stage;
    hit(s.citadel.hp - K.stages[2]);
    const s3 = s.citadel.stage;
    hit(5000);
    results.push(['내구도가 문턱을 넘을 때마다 단계가 오른다 (금 → 유리 깨짐 → 갈라짐·불)', s0 === 0 && s1 === 1 && s3 === 3 && seen.join(',') === '1,2,3', `단계 ${s0} → ${s1} → ${s3}, 이벤트 ${seen.join(',')}`]);
    results.push(['2단계가 되면 정면 대형 간판이 떨어진다', sign === 2, `간판 단계 ${sign}`]);
    results.push(['3단계에서는 강한 타격으로 아무리 깎아도 1에서 멈추고 무너지지 않는다', s.citadel.hp === 1 && s.citadel.stage === 3, `내구도 ${s.citadel.hp}, 단계 ${s.citadel.stage}`]);
  }
  // 4) 3단계 전의 필살기는 크게 깎기만 한다
  {
    const s = fresh(3180, 3240);
    s.fighters[0].meter = R.METER_MAX;
    run(s, [I.IN_SUPER, ...hold(0, 90)]);
    results.push(['3단계 전 필살기는 본관을 크게 깎기만 한다', K.hp - s.citadel.hp === K.damage.super && s.citadel.stage < 4, `깎인 양 ${K.hp - s.citadel.hp}, 단계 ${s.citadel.stage}`]);
  }
  // 5) 3단계에서 필살기가 구역에 닿으면 무너진다: 슬로모션, 기둥탑 위에 서 있던 사람은 떨어진다
  const collapseScene = () => {
    const s = fresh(3200, tx);
    stage3(s);
    s.fighters[0].meter = R.METER_MAX;
    const b = s.fighters[1];
    b.y = -towerTop.h * 256;
    b.floor = b.y;
    return s;
  };
  {
    const s = collapseScene();
    const b = s.fighters[1];
    let at = -1;
    let slow = 0;
    for (let k = 0; k < 120 && at < 0; k++) {
      sim.step(s, [k === 0 ? I.IN_SUPER : 0, 0]);
      if (cit(s.events, 'collapse').length) {
        at = s.tick;
        slow = s.slow;
      }
    }
    const towerGone = !solidAt(s, tx, towerTop.h);
    run(s, hold(0, 3));
    const falling = sim.isAirborne(b) || b.y === 0;
    results.push(['3단계에서 필살기가 구역에 닿으면 무너진다 (슬로모션)', at > 0 && s.citadel.stage === 4 && slow > 0, `무너진 틱 ${at}, 슬로모션 ${slow}`]);
    results.push(['무너지면 기둥탑 꼭대기 발판이 사라지고 그 위에 서 있던 사람은 떨어진다', towerGone && falling, `기둥탑 발판 ${!towerGone}, 2P ${b.mode} 높이 ${-b.y / 256}`]);
    const before = solidAt(s, tx, K.hill[5].h);
    run(s, hold(0, K.settle + 10));
    const after = sim.surfacesOf(s).filter((x) => x.kind === 'hill').length;
    results.push(['잔해 언덕은 다 쌓인 뒤에야 발판이 된다', !before && after === K.hill.length && solidAt(s, tx, K.hill[5].h), `쌓이기 전 ${before}, 쌓인 뒤 발판 ${after}개`]);
    // 잔해 위에 내려선다
    const a = s.fighters[0];
    const blk = K.hill[7];
    Object.assign(a, { x: Math.round((blk.x0 + blk.x1) / 2) * 256, y: -(blk.h + 30) * 256, floor: 0, vx: 0, vy: 0, mode: 'air', t: 0 });
    run(s, hold(0, 30));
    results.push(['잔해 언덕 위에 내려선다', a.y === -blk.h * 256 && !sim.isAirborne(a), `높이 ${-a.y / 256} (덩어리 ${blk.h})`]);
    // 기둥탑 밑동 오른쪽 면에 ↖로 붙는다 (구조물 벽)
    const stump = K.hill[5];
    Object.assign(a, { x: (stump.x1 + 8) * 256, y: -(K.hill[6].h + 14) * 256, floor: 0, vx: 0, vy: 0, mode: 'air', t: 0 });
    run(s, hold(I.IN_LEFT | I.IN_UP, 6));
    results.push(['잔해 언덕 벽(기둥탑 밑동)에 ↖로 붙는다', a.mode === 'wallcling' && a.wallX === stump.x1, `${a.mode} 벽 ${a.wallX}`]);
    // 잔해 위에서 ↑+대시로 밑동을 달려 올라 윗면에 선다
    Object.assign(a, { x: (stump.x1 + 26) * 256, y: -K.hill[6].h * 256, floor: -K.hill[6].h * 256, vx: 0, vy: 0, mode: 'idle', t: 0, wallId: -1, wallCount: 0 });
    run(s, [I.IN_LEFT | I.IN_UP | I.IN_DASH, ...hold(I.IN_LEFT, 12), ...hold(0, 30)]);
    results.push(['잔해 위에서 ↑+대시로 밑동을 달려 올라 윗면에 선다', a.y === -stump.h * 256 && !sim.isAirborne(a), `높이 ${-a.y / 256} (밑동 ${stump.h})`]);
    // 한 경기에 한 번: 무너진 뒤에는 깎이지도, 다시 무너지지도 않는다
    s.fighters[0].meter = R.METER_MAX;
    Object.assign(a, { x: 3200 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0 });
    const again = run(s, [I.IN_SUPER, ...hold(0, 90)]);
    sim.damageCitadel(s, 3200, 100, 0);
    results.push(['무너진 뒤에는 다시 깎이거나 무너지지 않는다 (한 경기에 한 번)', cit(again, 'collapse').length === 0 && cit(s.events, 'damage').length === 0 && s.citadel.hp === 0, `다시 무너짐 ${cit(again, 'collapse').length}, 내구도 ${s.citadel.hp}`]);
    // 다음 라운드까지 유지
    const round = s.round;
    s.fighters[1].hp = 0;
    for (let k = 0; k < 600 && s.round === round; k++) sim.step(s, [0, 0]);
    results.push(['붕괴와 잔해 언덕은 다음 라운드에도 남는다', s.round === round + 1 && s.citadel.stage === 4 && solidAt(s, tx, K.hill[5].h), `라운드 ${round} → ${s.round}, 단계 ${s.citadel.stage}`]);
  }
  // 6) 새 경기는 멀쩡한 시타델에서
  {
    const s = sim.createState(1);
    results.push(['새 경기는 멀쩡한 시타델에서 시작한다', s.citadel.stage === 0 && s.citadel.hp === K.hp && solidAt(s, tx, towerTop.h), `단계 ${s.citadel.stage}, 내구도 ${s.citadel.hp}`]);
  }
  // 7) 붕괴 장면: 같은 입력이면 같은 해시 (두 번, 중간 저장·복원)
  {
    const inputs = [I.IN_SUPER, ...hold(0, 60), ...hold(I.IN_RIGHT, 40), I.IN_JUMP | I.IN_LEFT, ...hold(I.IN_LEFT | I.IN_UP, 30), ...hold(0, 100)];
    const play = (cut) => {
      let s = collapseScene();
      inputs.forEach((inp, k) => {
        if (k === cut) s = JSON.parse(JSON.stringify(s));
        sim.step(s, [inp, 0]);
      });
      return sim.hashState(s);
    };
    const h1 = play(-1);
    const h2 = play(-1);
    const h3 = play(Math.floor(inputs.length / 2));
    results.push(['붕괴 장면: 같은 입력·저장·복원이면 같은 해시', h1 === h2 && h1 === h3, `${h1} ${h2} ${h3}`]);
  }
  return results;
}

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.ts$/.test(e.name)) yield p;
  }
}

function parseArgs(argv, defaults) {
  const out = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key in out) out[key] = Number(argv[++i]);
  }
  return out;
}

/**
 * 발판 시험. 1P만 정해진 입력으로 움직이고 2P는 가만히 있다.
 * 계단참 아래에서 제자리 점프 → 계단참에 선다, ↓+점프 → 땅으로 내려온다, 걸어서 끝을 넘으면 떨어진다,
 * 부서지는 건물 지붕에 서 있다가 그 자리가 무너지면 떨어진다.
 */
function platformChecks() {
  const I = sim;
  const results = [];
  const fresh = (x0, x1) => {
    const s = sim.createState(1);
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  const run = (s, inputs) => {
    for (const inp of inputs) sim.step(s, [inp, 0]);
  };
  const hold = (inp, n) => Array(n).fill(inp);
  const landing = sim.SURFACES.find((sf) => sf.kind === 'landing');
  const lx = (landing.x0 + landing.x1) / 2;

  // 1) 계단참 아래에서 제자리 점프
  let s = fresh(lx, lx + 150);
  run(s, [I.IN_JUMP, ...hold(0, 70)]);
  let f = s.fighters[0];
  results.push(['계단참으로 점프해 선다', f.y === -landing.h * 256 && f.floor === f.y && !sim.isAirborne(f), `y=${-f.y / 256}`]);

  // 2) ↓+점프로 내려온다
  run(s, [I.IN_DOWN | I.IN_JUMP, ...hold(0, 60)]);
  f = s.fighters[0];
  results.push(['↓+점프로 땅까지 내려온다', f.y === 0 && f.floor === 0, `y=${-f.y / 256}`]);

  // 3) 다시 올라가 오른쪽 끝을 넘을 때까지 걷는다
  run(s, [I.IN_JUMP, ...hold(0, 70)]);
  const up = s.fighters[0].y;
  run(s, hold(I.IN_RIGHT, 80));
  run(s, hold(0, 40));
  f = s.fighters[0];
  // (계단참 끝 바로 옆이 기둥탑 벽이라, 오른쪽을 누른 채 떨어지면 벽에 붙었다가 놓고 내려온다)
  results.push(['걸어서 끝을 넘으면 떨어진다', up === -landing.h * 256 && f.y === 0 && f.x > (landing.x1 - 8) * 256, `x=${Math.round(f.x / 256)}`]);

  // 4) 부서지는 건물의 지붕에 세워 두고, 발밑 지붕 덩어리를 무너뜨린다
  const roof = sim.SURFACES.find((sf) => sf.kind === 'roof');
  const g = sim.GRIDS[roof.b];
  const rx = roof.x0 + 40;
  s = fresh(rx, rx + 150);
  f = s.fighters[0];
  f.y = -roof.h * 256;
  f.floor = f.y;
  run(s, hold(0, 5));
  const stood = s.fighters[0].y === -roof.h * 256;
  const col = Math.floor((rx - g.x) / 16);
  for (let c = Math.max(0, col - 1); c <= Math.min(g.cols - 1, col + 1); c++) s.city.hp[g.first + (g.rows - 1) * g.cols + c] = -1;
  run(s, hold(0, 90));
  f = s.fighters[0];
  results.push(['무너진 지붕에서는 떨어진다', stood && f.y > -roof.h * 256, `처음 ${roof.h}px → ${-f.y / 256}px`]);

  // 5) 차양 위에 서 있는데, 날아온 상대가 1층을 뚫어 그 건물이 무너진다 → 그 틱에 바로 떨어지기 시작한다
  //    (무너질 때 슬로모션으로 다음 틱이 건너뛰어져도 허공에 서 있지 않게)
  const awn = sim.SURFACES.find((sf) => sf.kind === 'awning' && sf.b >= 0);
  const ag = sim.GRIDS[awn.b];
  const ax = Math.round((awn.x0 + awn.x1) / 2);
  const ac = Math.floor((ax - ag.x) / 16);
  s = fresh(ax, ax + 200);
  f = s.fighters[0];
  f.y = -awn.h * 256;
  f.floor = f.y;
  run(s, hold(0, 5));
  const onAwning = f.y === -awn.h * 256 && !sim.isAirborne(f);
  // 1층 기둥 넷(ac-1 ~ ac+2)을 거의 다 뚫어 두고 ac 기둥만 한 덩어리 남긴다. 날아온 2P가 그 덩어리를 뚫으면 무너진다
  // (가는 길에 물건에 부딪혀 속도가 반으로 줄어도 건물을 깎을 만큼 빠르게)
  for (let c = ac - 1; c <= ac + 2; c++) for (let r = 0; r < 3; r++) s.city.hp[ag.first + r * ag.cols + c] = c === ac && r === 0 ? 1 : 0;
  Object.assign(s.fighters[1], { mode: 'airhit', t: 0, x: (ag.x + ac * 16 + 1) * 256, y: -4 * 256, floor: 0, vx: 12 * 256, vy: 0, cityHits: [] });
  sim.step(s, [0, 0]);
  const collapsed = s.events.some((e) => e.type === 'collapse');
  const fellNow = f.floor === 0;
  const slowNext = s.slow > 0;
  sim.step(s, [0, 0]);
  const noFloat = !(f.floor < 0 && sim.floorBelow(s, f.x, f.y) !== f.y);
  run(s, hold(0, 60));
  results.push(['차양 위에 서 있던 건물이 무너지면 그 틱에 바로 떨어진다 (슬로모션 틱에도 허공에 서 있지 않다)', onAwning && collapsed && fellNow && noFloat && f.y > -awn.h * 256, `무너짐 ${collapsed}, 그 틱에 떨어지기 시작 ${fellNow}, 슬로모션 ${slowNext}, 60틱 뒤 ${-f.y / 256}px`]);
  return results;
}

/**
 * 구조물과 큰 물건 시험. 1P만 정해진 입력으로 움직이고 2P는 가만히 있다 (필요하면 2P가 필살기를 쓴다).
 * - 서쪽 끝 컨테이너 더미: 2단 점프로 올라서고, ↓+점프로 뚫리지 않고, 걸어서 끝을 넘으면 떨어져 벽 안쪽으로 돌아온다
 * - 큰 물건: 평타·그냥 부딪힘은 망가짐까지, 필살기·벽 쪽으로 날린 상대(4타)는 크게 무너짐
 * - 무너진 큰 물건: 등대 꼭대기에 선 사람은 밑동으로 떨어지고, 급수탑 위에 선 사람은 지붕으로, 뒤집힌 전차·쓰러진 간판·잔해 더미는 자리를 잡은 뒤 발판
 * - 같은 입력을 두 번, 중간에 저장·복원해서 같은 해시
 */
function structureChecks() {
  const results = [];
  const I = sim;
  const fresh = (x0, x1) => {
    const s = sim.createState(1);
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  /** 입력을 넣고, 그동안 나온 이벤트를 모은다. p2는 2P 입력 (함수면 틱마다) */
  const run = (s, inputs, p2 = 0) => {
    const ev = [];
    for (const inp of inputs) {
      sim.step(s, [inp, typeof p2 === 'function' ? p2(s) : p2]);
      ev.push(...s.events);
    }
    return ev;
  };
  const hold = (inp, n) => Array(n).fill(inp);
  const place = (f, x, h) => {
    f.x = x * 256;
    f.y = -h * 256;
    f.floor = f.y;
    f.vx = 0;
    f.vy = 0;
  };
  const surf = (s, kind, x) => sim.surfacesOf(s).find((sf) => sf.kind === kind && sim.surfaceSolid(s, sf, x * 256));
  const broke = (ev, i) => ev.find((e) => e.type === 'prop' && e.who === i && e.text === 'broken');
  const L = sim.BIG.lighthouse;
  const T = sim.BIG.tram;
  const W = sim.BIG.watertower;
  const S = sim.BIG.bigsign;
  const top = sim.CONTAINER_TOP.h;

  // 1) 컨테이너 더미 (해안 부두의 구조물 x 1600~1666: 윗면이 발판, 양옆이 벽): 오른쪽 앞에서 제자리 점프 → 2단 점프
  //    → 더미 높이를 넘은 뒤 왼쪽으로 → 더미 위에 선다 (↑ 없이 뛰면 옆면에 붙지 않고 그 앞을 지나간다)
  const CX0 = 1600;
  const CX1 = 1666;
  let s = fresh(CX1 + 6, CX1 + 200);
  run(s, [I.IN_JUMP, ...hold(0, 18), I.IN_JUMP, ...hold(0, 10), ...hold(I.IN_LEFT, 12), ...hold(0, 50)]);
  let f = s.fighters[0];
  results.push(['2단 점프로 컨테이너 더미 위에 선다', f.y === -top * 256 && f.floor === f.y && f.x > CX0 * 256 && f.x < CX1 * 256, `x=${Math.round(f.x / 256)} y=${-f.y / 256}`]);
  run(s, [I.IN_DOWN | I.IN_JUMP, ...hold(0, 80)]);
  f = s.fighters[0];
  results.push(['컨테이너 더미 위에서 ↓+점프는 뚫고 내려가지 않는다', f.y === -top * 256 && f.x < CX1 * 256, `y=${-f.y / 256}`]);
  run(s, [...hold(I.IN_RIGHT, 40), ...hold(0, 40)]);
  f = s.fighters[0];
  results.push(['더미 끝을 넘으면 떨어져 땅에 선다', f.y === 0 && f.x > CX1 * 256, `x=${Math.round(f.x / 256)}`]);

  // 2) 등대: 평타는 망가짐까지 (내구도 1에서 멈춤)
  s = fresh(1728, 1930);
  s.props[L].hp = 60;
  let ev = run(s, hold([I.IN_ATTACK, 0, 0, 0, 0, 0, 0, 0, 0, 0], 12).flat());
  let p = s.props[L];
  results.push(['평타로는 큰 물건(등대)이 망가짐까지만 간다', p.stage === 1 && p.hp === 1 && !broke(ev, L), `단계 ${p.stage}, 내구도 ${p.hp}`]);
  // 필살기가 닿으면 크게 무너진다
  place(s.fighters[0], 1728, 0);
  s.fighters[0].meter = sim.RULES.METER_MAX;
  run(s, hold(0, 30));
  ev = run(s, [I.IN_SUPER, ...hold(0, 120)]);
  p = s.props[L];
  results.push(['필살기가 닿으면 등대가 크게 무너진다', p.stage === 2 && broke(ev, L)?.combo === 1, `단계 ${p.stage}`]);
  const gallery = sim.SURFACES.find((x) => x.kind === 'gallery' && x.h === 196);
  results.push(['무너진 등대: 꼭대기 둘레는 없고 밑동 윗면이 발판', !sim.surfaceSolid(s, gallery, 1768 * 256) && !!surf(s, 'stump', 1768)]);

  // 3) 등대 꼭대기에 선 사람은 꺾이면 밑동으로 떨어진다 (2P가 땅에서 필살기)
  s = fresh(1768, 1720);
  place(s.fighters[0], 1768, 196);
  s.fighters[1].meter = sim.RULES.METER_MAX;
  run(s, hold(0, 4));
  const stood = s.fighters[0].y === -196 * 256;
  ev = run(s, hold(0, 150), (st) => (st.tick % 2 ? I.IN_SUPER : 0));
  f = s.fighters[0];
  results.push(['등대가 꺾이면 꼭대기에 선 사람은 밑동으로 떨어진다', stood && s.props[L].stage === 2 && f.y === -sim.SURFACES.find((x) => x.kind === 'stump').h * 256, `${-f.y / 256}px`]);

  // 4) 그냥 날아와 부딪히면 망가짐까지, '벽 쪽으로 날림'에 맞아 날아오면 무너진다
  for (const [wall, name] of [[false, '그냥 날아와 부딪히면 등대가 망가짐까지만'], [true, '벽 쪽으로 날린 상대가 부딪히면 등대가 무너진다']]) {
    // 가로등(1716) 뒤에서 출발한다 (가로등에 먼저 부딪히면 느려진다)
    s = fresh(1930, 1726);
    const d = s.fighters[1];
    d.x = 1726 * 256;
    d.y = -60 * 256;
    d.mode = 'airhit';
    d.t = 0;
    d.len = 40;
    d.vx = 7 * 256;
    d.vy = -256;
    d.wallFly = wall;
    ev = run(s, hold(0, 20));
    p = s.props[L];
    results.push([name, wall ? p.stage === 2 && broke(ev, L)?.combo === 2 : p.stage <= 1 && p.hp >= 1, `단계 ${p.stage}, 내구도 ${p.hp}`]);
  }
  // 4타(벽 쪽으로 날림)로 날린 상대가 등대에 부딪힌다 (입력만으로)
  s = fresh(1696, 1722);
  ev = run(s, hold([I.IN_ATTACK, 0, 0, 0, 0, 0, 0], 14).flat());
  results.push(['4타로 날린 상대가 부딪혀 등대가 무너진다', s.props[L].stage === 2 && broke(ev, L)?.combo === 2, `단계 ${s.props[L].stage}`]);

  // 5) 급수탑: 위에 선 사람은 무너지면 지붕으로 떨어진다 (2P가 지붕에서 필살기)
  const wt = sim.BREAKABLES[W];
  const roof = sim.SURFACES.find((x) => x.kind === 'roof' && x.x0 <= wt.x && wt.x < x.x1);
  s = fresh(wt.x + 18, roof.x0 + 2);
  place(s.fighters[0], wt.x + 18, wt.bottom + wt.h);
  place(s.fighters[1], roof.x0 + 2, wt.bottom);
  s.fighters[1].meter = sim.RULES.METER_MAX;
  run(s, hold(0, 4));
  const onTank = s.fighters[0].y === -(wt.bottom + wt.h) * 256;
  ev = run(s, hold(0, 150), (st) => (st.tick % 2 ? I.IN_SUPER : 0));
  f = s.fighters[0];
  results.push(['급수탑이 무너지면 위에 선 사람은 지붕으로 떨어진다', onTank && s.props[W].stage === 2 && broke(ev, W)?.combo === 1 && f.y === -wt.bottom * 256, `${-f.y / 256}px`]);

  // 6) 노면전차: 지나가는 중에 필살기 → 탈선해 뒤집히고, 자리를 잡은 뒤 윗면이 발판. 같은 입력·저장·복원으로 같은 해시
  const tramRun = (saveAt) => {
    let st = fresh(2200, 2400);
    let k = 0;
    const step = (inp) => {
      if (k++ === saveAt) st = JSON.parse(JSON.stringify(st));
      sim.step(st, [inp, 0]);
      return st.events;
    };
    while (!(sim.tramAt(st.clock)?.dir === 1 && sim.tramAt(st.clock).x >= 2076)) step(0);
    const at = sim.tramAt(st.clock).x;
    st.fighters[0].meter = sim.RULES.METER_MAX;
    const evs = [...step(I.IN_SUPER)];
    for (let i = 0; i < 120 && !broke(evs, T); i++) evs.push(...step(0));
    const mid = sim.tramRestX(st.props[T].at) + 78;
    const before = !!surf(st, 'tram', mid);
    for (let i = 0; i < 40; i++) step(0);
    const after = surf(st, 'tram', mid);
    // 뒤집힌 전차 바로 위에서 떨어뜨린다 (극장 차양이 위에 있어 뛰어오르면 차양에 선다)
    const ff = st.fighters[0];
    ff.x = mid * 256;
    ff.y = -60 * 256;
    ff.floor = 0;
    for (let i = 0; i < 40; i++) step(0);
    return { st, evs, at, before, after, hash: sim.hashState(st) };
  };
  const tr = tramRun(-1);
  const tp = tr.st.props[T];
  const rest = sim.tramRestX(tp.at);
  results.push(['필살기에 맞은 노면전차가 탈선해 뒤집힌다', tp.stage === 2 && broke(tr.evs, T)?.combo === 1 && Math.abs(tp.at - tr.at) < 40 && rest >= sim.RULES.WALL_L / 256, `지나던 자리 ${tr.at}, 탈선한 자리 ${tp.at}, 놓인 자리 ${rest}`]);
  results.push(['뒤집힌 전차는 자리를 잡은 뒤에야 발판이 된다', !tr.before && !!tr.after && tr.after.h === sim.tramLying(rest).h, `높이 ${tr.after?.h}`]);
  results.push(['뒤집힌 전차 위로 떨어지면 선다', tr.st.fighters[0].y === -sim.tramLying(rest).h * 256, `${-tr.st.fighters[0].y / 256}px`]);
  const tr2 = tramRun(-1);
  const tr3 = tramRun(150);
  results.push(['전차 장면: 같은 입력·저장·복원이면 같은 해시', tr.hash === tr2.hash && tr.hash === tr3.hash, `${tr.hash} ${tr2.hash} ${tr3.hash}`]);

  // 7) 시타델 간판: 기둥탑 꼭대기에서 필살기 → 떨어져 분수에 기대 쓰러지고, 자리를 잡은 뒤 윗변이 발판
  const tower = sim.SURFACES.find((x) => x.kind === 'tower');
  s = fresh(tower.x1 - 4, tower.x1 + 230);
  place(s.fighters[0], tower.x1 - 4, tower.h);
  place(s.fighters[1], tower.x1 + 230, 0);
  s.fighters[0].meter = sim.RULES.METER_MAX;
  run(s, hold(0, 2));
  ev = run(s, [I.IN_SUPER]);
  for (let i = 0; i < 120 && !broke(ev, S); i++) ev.push(...run(s, [0]));
  const sg = s.props[S];
  const lying = sim.SURFACES.find((x) => x.kind === 'sign');
  const early = !!surf(s, 'sign', 3200);
  run(s, hold(0, 40));
  results.push(['기둥탑 꼭대기에서 필살기를 맞은 시타델 간판이 떨어져 쓰러진다', sg.stage === 2 && broke(ev, S)?.combo === 1, `단계 ${sg.stage}`]);
  results.push(['쓰러진 간판은 자리를 잡은 뒤 발판이 된다', !early && !!surf(s, 'sign', 3200) && lying.h > 0, `높이 ${lying.h}`]);

  // 8) 잔해 더미: 다이너 1층을 크게 뚫어 무너뜨리면, 쌓인 뒤 윗면이 발판
  s = fresh(2200, 2500);
  for (let x = 2312; x <= 2420; x += 12) {
    sim.damageCity(s, x, 16, 14, 100, 'test');
    sim.damageCity(s, x, 46, 14, 100, 'test');
  }
  const col = s.city.collapses[0];
  const r = col && sim.rubbleOf(col.b, col.c0, col.c1);
  const cx = r ? Math.round((r.tx0 + r.tx1) / 2) : 0;
  const soon = r ? !!surf(s, 'rubble', cx) : true;
  run(s, hold(0, 45));
  const pile = r && surf(s, 'rubble', cx);
  s.fighters[0].x = cx * 256;
  run(s, [I.IN_JUMP, ...hold(0, 70)]);
  results.push(['무너진 자리의 잔해 더미는 쌓인 뒤 발판이 된다', !!col && !soon && !!pile && pile.h === r.h, col ? `높이 ${r.h}, 윗면 ${r.tx0}~${r.tx1}` : '무너지지 않음']);
  results.push(['잔해 더미 위로 뛰어오르면 선다', !!r && s.fighters[0].y === -r.h * 256, `${-s.fighters[0].y / 256}px`]);

  // 9) 벽 목록: 맵 끝 벽 둘, 무너진 등대·급수탑은 위쪽 벽이 없다
  const walls = sim.wallsOf(tr.st);
  results.push(['맵 끝 벽(공장 벽돌 담·1구역 성벽)이 벽 목록에 있다', walls.filter((w) => w.end).length === 2 && sim.WALLS.filter((w) => w.end).every((w) => sim.wallSolid(tr.st, w, 50))]);
  return results;
}

/**
 * 벽 기동 시험. 1P만 정해진 입력으로 움직인다.
 * 벽 붙기: 공중에서 벽 쪽을 누르면 붙고(벽을 등지고, 2단 점프·공중 대시가 다시 생김), 천천히 미끄러지고, 놓으면 떨어지고,
 * 땅에 닿으면 착지하고, 같은 벽은 연속 두 번까지, 맵 끝 벽에도 붙고, 붙은 건물 칸이 무너지면 떨어진다.
 */
/** 공격 버튼을 상황별로 나눈 것 (기획서 '조작과 전투 시스템'): 대시 공격 */
function attackChecks() {
  const results = [];
  const I = sim;
  const fresh = (x0, x1) => {
    const s = sim.createState(1);
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  const hold = (inp, n) => Array(n).fill(inp);
  /** 입력을 넣고, 틱마다 [이벤트, 1P 모드·기술, 2P 모드]를 모은다 */
  const run = (s, inputs, p2 = 0) => {
    const log = [];
    for (const inp of inputs) {
      sim.step(s, [inp, p2]);
      log.push({ ev: s.events, a: `${s.fighters[0].mode}/${s.fighters[0].move}`, b: s.fighters[1].mode });
    }
    return log;
  };

  // 1) 앞으로 대시하는 중에 공격하면 그 틱에 대시 공격이 나가고, 미끄러지며 들어가 맞힌다 (상대는 땅에 선 채 경직, 기력은 쓰지 않음)
  let s = fresh(2400, 2500);
  let f = s.fighters[0];
  run(s, [I.IN_DASH | I.IN_RIGHT, 0, 0]);
  const dashing = f.mode === 'dash';
  const x0 = f.x;
  const meter0 = f.meter;
  run(s, [I.IN_ATTACK]);
  const started = f.mode === 'attack' && f.move === 'dashAttack';
  let log = run(s, hold(0, 40));
  const hitAt = log.findIndex((l) => l.ev.some((e) => e.type === 'hit' && e.move === 'dashAttack'));
  const stunned = hitAt >= 0 && log[hitAt].b === 'hitstun';
  results.push(['앞으로 대시하는 중 공격 → 그 틱에 대시 공격', dashing && started, `${dashing ? '대시 중' : '대시 아님'} → ${started ? 'dashAttack' : `${f.mode}/${f.move}`}`]);
  results.push(['대시 공격은 미끄러지며 들어가 맞히고, 상대는 땅에 선 채 경직된다', stunned && f.x - x0 > 30 * 256, `맞힘 ${hitAt >= 0 ? `${hitAt + 1}틱째` : '없음'}, 상대 ${hitAt >= 0 ? log[hitAt].b : '-'}, 미끄러진 거리 ${((f.x - x0) / 256).toFixed(0)}px`]);
  results.push(['대시 공격은 기력을 쓰지 않는다', f.meter >= meter0, `기력 ${meter0} → ${f.meter}`]);

  // 2) 뒤로 대시하는 중에 공격하면 대시 공격이 아니라, 대시가 끝날 무렵 평타 1타
  s = fresh(2400, 2600);
  f = s.fighters[0];
  run(s, [I.IN_DASH | I.IN_LEFT, 0]);
  log = run(s, [I.IN_ATTACK, ...hold(0, 14)]);
  const moves = new Set(log.map((l) => l.a).filter((a) => a.startsWith('attack/')));
  results.push(['뒤로 대시하는 중 공격 → 대시 공격이 아니라 평타', !moves.has('attack/dashAttack') && moves.has('attack/atk1'), [...moves].join(', ') || '공격 없음']);

  // 3) 대시 공격이 막히면 빈틈이 크다: 막은 쪽이 먼저 움직일 수 있다
  s = fresh(2400, 2500);
  f = s.fighters[0];
  const g = s.fighters[1];
  run(s, [I.IN_DASH | I.IN_RIGHT, 0, 0], I.IN_DOWN);
  log = run(s, [I.IN_ATTACK, ...hold(0, 40)], I.IN_DOWN);
  const blockAt = log.findIndex((l) => l.ev.some((e) => e.type === 'block' && e.move === 'dashAttack'));
  let gFree = -1;
  let fFree = -1;
  for (let i = blockAt + 1; i < log.length && blockAt >= 0; i++) {
    if (gFree < 0 && log[i].b === 'guard') gFree = i;
    if (fFree < 0 && !log[i].a.startsWith('attack')) fFree = i;
  }
  results.push(['대시 공격이 막히면 막은 쪽이 먼저 움직인다 (빈틈)', blockAt >= 0 && gFree >= 0 && fFree > gFree, `막힘 ${blockAt + 1}틱째, 막은 쪽 풀림 ${gFree + 1}틱째, 대시 공격 끝 ${fFree + 1}틱째`]);

  // ---- 누르기와 길게 누르기 (기획서): 연타가 씹히거나 차지가 실수로 나가면 안 된다 ----
  const H = sim.RULES.CHARGE_HOLD;
  const charging = (l) => l.a.startsWith('charge');
  // 4) 누른 틱에 바로 평타가 시작된다 (기다렸다가 판단하지 않는다)
  s = fresh(2400, 2440);
  f = s.fighters[0];
  run(s, [I.IN_ATTACK]);
  results.push(['누른 틱에 바로 평타가 나간다 (지연 0틱)', f.mode === 'attack' && f.move === 'atk1' && f.t === 0, `${f.mode}/${f.move} t=${f.t}`]);
  // 5) 연타: 1틱씩, 8틱씩 누르고 떼기 → 4타까지 끊기지 않고, 모으기는 한 번도 없다
  for (const [label, on, off] of [['1틱씩', 1, 3], ['8틱씩', 8, 2]]) {
    s = fresh(2400, 2440);
    const seq = [];
    for (let k = 0; k < 8; k++) seq.push(...hold(I.IN_ATTACK, on), ...hold(0, off));
    log = run(s, [...seq, ...hold(0, 40)]);
    const chain = ['atk1', 'atk2', 'atk3', 'atk4'].filter((m) => log.some((l) => l.a === `attack/${m}`));
    const charged = log.some(charging);
    results.push([`연타 (${label} 누르고 떼기) → 4타까지 끊기지 않고 차지는 나오지 않는다`, chain.length === 4 && !charged, `${chain.join('→')}${charged ? ', 모으기 나옴' : ''}`]);
  }
  // 6) 길게 누르기: 평타(1타)가 바로 나가고, 누른 지 18틱째에 모으기로. 떼면 차지가 나가 맞히고, 기력은 쓰지 않는다
  s = fresh(2400, 2456);
  f = s.fighters[0];
  const m0 = f.meter;
  log = run(s, hold(I.IN_ATTACK, 30));
  const startAt = log.findIndex(charging);
  results.push([`길게 누르면 평타 뒤 ${H}틱째에 모으기로 넘어간다`, log[0].a === 'attack/atk1' && startAt === H - 1, `첫 틱 ${log[0].a}, 모으기 ${startAt + 1}틱째`]);
  log = run(s, hold(0, 50));
  const relAt = log.findIndex((l) => l.a === 'attack/charge');
  const chHit = log.findIndex((l) => l.ev.some((e) => e.type === 'hit' && e.move === 'charge'));
  results.push(['떼면 차지가 나가 맞히고, 기력은 쓰지 않는다', relAt === 0 && chHit > 0 && f.meter >= m0, `뗀 틱 ${relAt + 1}틱째 차지, 맞힘 ${chHit + 1}틱째, 기력 ${m0} → ${f.meter}`]);
  // 7) 단계: 모으기 30틱이면 2단계, 60틱이면 3단계. 3단계는 막혀도 방어를 깬다
  s = fresh(2400, 2456);
  log = run(s, hold(I.IN_ATTACK, H + 62), I.IN_DOWN);
  const lvAt = (lv) => log.findIndex((l) => l.ev.some((e) => e.type === 'charge' && e.text === 'level' && e.combo === lv));
  results.push(['모으기 30틱이면 2단계, 60틱이면 3단계', lvAt(2) === H - 1 + 30 && lvAt(3) === H - 1 + 60, `2단계 ${lvAt(2) + 1}틱째, 3단계 ${lvAt(3) + 1}틱째`]);
  log = run(s, hold(0, 40), I.IN_DOWN);
  const crushed = log.some((l) => l.ev.some((e) => e.type === 'crush' && e.move === 'charge'));
  results.push(['3단계 차지는 막혀도 방어를 깬다', crushed, crushed ? '가드 크러시' : log.flatMap((l) => l.ev.map((e) => e.type)).join(',')]);
  // 7-1) 1단계 차지가 막히면 막은 쪽이 먼저 움직인다 (빈틈)
  s = fresh(2400, 2456);
  run(s, hold(I.IN_ATTACK, H + 12), I.IN_DOWN);
  log = run(s, hold(0, 40), I.IN_DOWN);
  const cBlock = log.findIndex((l) => l.ev.some((e) => e.type === 'block' && e.move === 'charge'));
  const cG = log.findIndex((l, i) => i > cBlock && l.b === 'guard');
  const cA = log.findIndex((l, i) => i > cBlock && !l.a.startsWith('attack'));
  results.push(['1단계 차지가 막히면 막은 쪽이 먼저 움직인다 (빈틈)', cBlock >= 0 && cG >= 0 && cA > cG, `막힘 ${cBlock + 1}틱째, 막은 쪽 풀림 ${cG + 1}틱째, 차지 끝 ${cA + 1}틱째`]);
  // 8) 모으는 중에는 무방비: ↓를 눌러도 막지 못하고, 맞으면 취소된다 (차지는 나가지 않는다). 2P가 붙어서 1타
  s = fresh(2400, 2456);
  f = s.fighters[0];
  run(s, hold(I.IN_ATTACK | I.IN_DOWN, H + 4));
  const wasCharging = f.mode === 'charge';
  s.fighters[1].x = f.x + 30 * 256;
  log = [];
  for (let k = 0; k < 50; k++) {
    sim.step(s, [k < 20 ? I.IN_ATTACK | I.IN_DOWN : 0, k === 0 ? I.IN_ATTACK : 0]);
    log.push({ ev: s.events, a: `${f.mode}/${f.move}` });
  }
  const gotHit = log.findIndex((l) => l.ev.some((e) => e.type === 'hit' && e.who === 1));
  const blocked = log.some((l) => l.ev.some((e) => e.type === 'block' && e.who === 1));
  const fired = log.some((l) => l.a === 'attack/charge');
  results.push(['모으는 중에는 ↓를 눌러도 막지 못하고, 맞으면 취소된다', wasCharging && gotHit >= 0 && !blocked && !fired, `모으는 중 ${wasCharging}, 맞음 ${gotHit + 1}틱째, 막음 ${blocked}, 차지 나감 ${fired}`]);
  // 9) 공중 공격을 길게 눌러도 (내려와서도) 차지가 되지 않는다
  s = fresh(2400, 2600);
  run(s, [I.IN_JUMP, ...hold(0, 8)]);
  log = run(s, hold(I.IN_ATTACK, 80));
  results.push(['공중 공격을 길게 눌러도 내려와서 차지가 되지 않는다', log.some((l) => l.a.startsWith('attack/air')) && !log.some(charging), log.some(charging) ? '모으기 나옴' : '모으기 없음']);
  // 10) 평타를 누른 채 앞을 눌러도 걷지 않고 서서 모으기로 (방향은 무시)
  s = fresh(2400, 2600);
  log = run(s, hold(I.IN_ATTACK | I.IN_RIGHT, 30));
  results.push(['평타를 누른 채 방향을 눌러도 걷지 않고 모으기로 넘어간다', !log.some((l) => l.a.startsWith('run')) && log.some(charging), `${log.some((l) => l.a.startsWith('run')) ? '걸음' : '안 걸음'}, ${log.some(charging) ? '모으기' : '모으기 없음'}`]);
  // 11) 평타를 누른 채 점프하면 차지는 취소된다
  s = fresh(2400, 2600);
  log = run(s, [...hold(I.IN_ATTACK, 10), I.IN_ATTACK | I.IN_JUMP, ...hold(I.IN_ATTACK, 40)]);
  results.push(['평타를 누른 채 점프하면 차지는 취소된다', log.some((l) => l.a.startsWith('jumpsquat')) && !log.some(charging), log.some(charging) ? '모으기 나옴' : '모으기 없음']);
  // 12) 최고 단계에서 1초(60틱) 더 쥐고 있으면 저절로 나간다
  s = fresh(2400, 2600);
  log = run(s, hold(I.IN_ATTACK, H + 140));
  const autoAt = log.findIndex((l) => l.a === 'attack/charge');
  results.push(['최고 단계에서 1초 더 쥐고 있으면 저절로 나간다', autoAt === H - 1 + 120, `모으기 시작 ${H}틱째, 나감 ${autoAt + 1}틱째`]);
  // 14) 연속 장면: 대시 → 대시 공격을 누른 채 → 차지 1단계 → 점프로 쫓아 공중 1·2·3타가 끊기지 않고 다섯 대로 이어진다
  //     (화면 캡처 npm run moveclip -- combo 와 같은 시작·같은 입력)
  {
    const st = sim.createState(1);
    while (st.tick < 75) sim.step(st, [0, 0]);
    Object.assign(st.fighters[0], { x: 2196 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: 1 });
    Object.assign(st.fighters[1], { x: 2296 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: -1 });
    for (let i = 0; i < 70; i++) sim.step(st, [0, 0]);
    const R = I.IN_RIGHT;
    const seq = [[0, 6], [I.IN_DASH, 1], [0, 2], [I.IN_ATTACK, 19], [0, 4], [I.IN_JUMP | R, 1], [R, 14], [I.IN_ATTACK | R, 1], [R, 6], [I.IN_ATTACK | R, 1], [R, 6], [I.IN_ATTACK | R, 1], [0, 60]].flatMap(([b, n]) => Array(n).fill(b));
    const hits = [];
    for (const inp of seq) {
      sim.step(st, [inp, 0]);
      for (const e of st.events) if (e.type === 'hit' && e.who === 0) hits.push(`${e.move}(${e.combo})`);
    }
    const want = 'dashAttack(1) charge(2) air1(3) air2(4) air3(5)';
    results.push(['연속 장면: 대시 공격 → 차지 → 점프 → 공중 3타가 다섯 대 콤보로 이어진다', hits.join(' ') === want, hits.join(' ')]);
  }
  // 13) 대시 공격을 누른 채 있으면 대시 공격 뒤 모으기로 (땅에서 시작한 평타)
  s = fresh(2400, 2600);
  run(s, [I.IN_DASH | I.IN_RIGHT, 0, 0]);
  log = run(s, hold(I.IN_ATTACK, 30));
  results.push(['대시 공격을 누른 채 있으면 대시 공격 뒤 모으기로 넘어간다', log[0].a === 'attack/dashAttack' && log.findIndex(charging) === H - 1, `첫 틱 ${log[0].a}, 모으기 ${log.findIndex(charging) + 1}틱째`]);
  return results;
}

/**
 * 공통 맞는 동작 (docs/공통동작사양서.md): 약하게 맞음은 12프레임·기본 20틱, 늘어나는 프레임은 5번.
 * 경직이 길면 5번만 늘고, 짧으면 줄여서 모든 프레임을 차례로 보이고 기준 자세(12번)로 끝난다.
 */
function hitMotionChecks() {
  const results = [];
  const m = sim.motionFrames('common/hit_light');
  const STRETCH = 4;
  /** 길이 len틱 동안 틱마다 보이는 프레임 (0부터) */
  const frames = (len) => Array.from({ length: len }, (_, t) => sim.frameFitted(m, t, len, STRETCH));
  /** 프레임마다 보인 틱 수 */
  const spans = (fr) => {
    const c = Array(m.dur.length).fill(0);
    for (const i of fr) c[i]++;
    return c;
  };
  const inOrder = (fr) => fr.every((v, i) => i === 0 || v === fr[i - 1] || v === fr[i - 1] + 1);
  results.push(['약하게 맞음은 12프레임, 기본 20틱', m.dur.length === 12 && m.total === 20, `${m.dur.length}프레임, ${m.total}틱 (${m.dur.join(' ')})`]);

  const base = spans(frames(20));
  results.push(['경직 20틱이면 사양서 표시 틱 그대로', base.every((n, i) => n === m.dur[i]), base.join(' ')]);

  const long = spans(frames(26));
  const onlyFive = long.every((n, i) => (i === STRETCH ? n === m.dur[i] + 6 : n === m.dur[i]));
  results.push(['경직 26틱이면 5번 프레임만 6틱 늘어난다', onlyFive && frames(26)[25] === 11, long.join(' ')]);

  const ok16 = frames(16);
  const s16 = spans(ok16);
  results.push(['경직 16틱(평타 1·2타)이면 줄여서 12프레임이 모두 차례로 보이고 12번으로 끝난다', inOrder(ok16) && s16.every((n) => n >= 1) && ok16[15] === 11, s16.join(' ')]);

  const ok8 = frames(8);
  results.push(['콤보 보정으로 8틱까지 줄어도 앞으로만 넘어간다 (고르게 건너뜀)', ok8[0] === 0 && ok8.every((v, i) => i === 0 || v > ok8[i - 1]) && ok8[7] <= 11, ok8.map((v) => v + 1).join(' ')]);

  // 실제 대전: 평타 1타에 맞으면 약하게 맞음을 처음부터 끝까지 (히트스톱 동안 1번, 경직 마지막 틱에 12번)
  const s = sim.createState(1);
  while (s.phase !== 'fight') sim.step(s, [0, 0]);
  s.fighters[0].x = 2400 * 256;
  s.fighters[1].x = 2440 * 256;
  const d = s.fighters[1];
  const seen = [];
  let len = 0;
  for (let t = 0; t < 60; t++) {
    sim.step(s, [t === 0 ? sim.IN_ATTACK : 0, 0]);
    if (d.mode === 'hitstun') {
      len = d.len;
      const p = sim.fighterPose(d);
      seen.push(`${p.motion}#${p.frame + 1}`);
    }
  }
  const fr = seen.map((v) => Number(v.split('#')[1]));
  const allLight = seen.length > 0 && seen.every((v) => v.startsWith('common/hit_light#'));
  results.push(['평타 1타에 맞으면 약하게 맞음을 1번부터 12번까지 재생한다', allLight && fr[0] === 1 && fr[fr.length - 1] === 12 && fr.every((v, i) => i === 0 || v >= fr[i - 1]),
    `경직 ${len}틱, 히트스톱 포함 ${seen.length}틱: ${[...new Set(fr)].join(' ')}`]);
  return results;
}

/**
 * 공통 동작 2~7 (docs/공통동작사양서.md): 프레임 수·길이, 늘어나는 프레임, 되풀이, 무적 구간, 다음 동작을 실제 대전 상태로 확인
 */
function commonMotionChecks() {
  const results = [];
  const R = sim.RULES;
  const I = sim;
  const mf = (n) => sim.motionFrames(n);
  // 1) 프레임 수와 기본 길이 (사양서 표)
  const spec = [['hit_light', 12, 20], ['hit_heavy', 14, 32], ['guard_crush', 12, 44], ['hit_air', 12, 24], ['knockdown', 14, 32], ['getup', 12, 24], ['tech', 12, 18]];
  const got = spec.map(([n, f, t]) => [n, mf(`common/${n}`).dur.length === f && mf(`common/${n}`).total === t, `${mf(`common/${n}`).dur.length}·${mf(`common/${n}`).total}`]);
  results.push(['공통 동작 7개의 프레임 수·기본 길이가 사양서대로', got.every((g) => g[1]), got.map((g) => `${g[0]} ${g[2]}`).join(', ')]);
  // 2) sim 길이·무적이 동작과 맞는다
  const cum = (n, k) => mf(`common/${n}`).cum[k - 1];
  const timing = R.CRUSH_TICKS === 44 && R.KNOCKDOWN_TICKS === mf('common/knockdown').total + R.KNOCKDOWN_WAIT && R.GETUP_TICKS === mf('common/getup').total
    && R.GETUP_INVULN === cum('getup', 10) && R.TECH_TICKS === mf('common/tech').total && R.TECH_INVULN === cum('tech', 8);
  results.push(['sim 길이·무적이 사양서 값과 같다', timing,
    `크러시 ${R.CRUSH_TICKS}, 다운 ${R.KNOCKDOWN_TICKS} (그림 32 + 대기 ${R.KNOCKDOWN_WAIT}), 기상 ${R.GETUP_TICKS} (무적 ${R.GETUP_INVULN} = 1~10번), 낙법 ${R.TECH_TICKS} (무적 ${R.TECH_INVULN} = 1~8번)`]);
  // 3) 세게 맞음: 경직이 짧으면(26틱) 14프레임이 차례로 다 보이고 14번으로 끝나고, 길면(40틱) 6번만 늘어난다
  const mh = mf('common/hit_heavy');
  const fit = (m, len, k) => Array.from({ length: len }, (_, t) => sim.frameFitted(m, t, len, k));
  const spans = (m, fr) => {
    const c = Array(m.dur.length).fill(0);
    for (const i of fr) c[i]++;
    return c;
  };
  const h26 = fit(mh, 26, 5);
  const h40 = spans(mh, fit(mh, 40, 5));
  results.push(['세게 맞음: 경직 26틱이면 14프레임이 차례로 다 보이고, 40틱이면 6번 프레임만 8틱 늘어난다',
    spans(mh, h26).every((n) => n >= 1) && h26[25] === 13 && h40.every((n, i) => (i === 5 ? n === mh.dur[5] + 8 : n === mh.dur[i])), `26틱 ${spans(mh, h26).join(' ')} / 40틱 ${h40.join(' ')}`]);

  /** 대전 상태: 1P x0, 2P x1 (서로 마주 봄) */
  const fresh = (x0, x1) => {
    const s = sim.createState(1);
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  /** n틱 동안 [1P, 2P] 입력을 넣으며 2P의 모드·그림·프레임·맞는 상자를 모은다 */
  const watch = (s, n, inputs) => {
    const log = [];
    for (let t = 0; t < n; t++) {
      sim.step(s, inputs(t, s));
      const d = s.fighters[1];
      const p = sim.fighterPose(d);
      log.push({ mode: d.mode, motion: p.motion, frame: p.frame + 1, hurt: !!sim.boxesOf(d).hurt, hitstop: d.hitstop, ev: s.events });
    }
    return log;
  };
  const framesOf = (log, motion) => log.filter((l) => l.motion === motion).map((l) => l.frame);
  const ordered = (fr) => fr.length > 0 && fr.every((v, i) => i === 0 || v === fr[i - 1] || v === fr[i - 1] + 1);

  // 4) 세게 맞음 실제: 대시 공격(경직 26틱)에 맞으면 1번부터 14번까지
  {
    const s = fresh(2400, 2500);
    const log = watch(s, 70, (t) => [t === 0 ? I.IN_DASH | I.IN_RIGHT : t === 3 ? I.IN_ATTACK : 0, 0]);
    const fr = framesOf(log, 'common/hit_heavy');
    results.push(['세게 맞음: 대시 공격에 맞으면 1번부터 14번까지 차례로', ordered(fr) && fr[0] === 1 && fr[fr.length - 1] === 14, [...new Set(fr)].join(' ')]);
  }
  // 5) 가드 크러시 실제: 막다가 방어가 깨지면 44틱 동안 1번부터 12번까지, 그동안 맞는 판정은 켜져 있다
  {
    const s = fresh(2400, 2440);
    s.fighters[1].guard = 1;
    const log = watch(s, 90, (t) => [t === 2 ? I.IN_ATTACK : 0, I.IN_DOWN]);
    const crush = log.filter((l) => l.mode === 'crush' && l.hitstop === 0);
    const fr = framesOf(log.filter((l) => l.mode === 'crush'), 'common/guard_crush');
    // 히트스톱이 끝난 뒤 44틱 (히트스톱 동안은 1번 프레임에 멈춰 있다)
    results.push(['가드 크러시: 방어가 깨지면 히트스톱 뒤 44틱 동안 1번부터 12번까지, 무적 없음', crush.length === R.CRUSH_TICKS && ordered(fr) && fr[0] === 1 && fr[fr.length - 1] === 12 && crush.every((l) => l.hurt),
      `크러시 ${crush.length}틱, 프레임 ${[...new Set(fr)].join(' ')}`]);
  }
  // 6) 공중에서 맞음 실제: 띄우기에 맞으면 1~9번은 한 번, 그 뒤 떨어지는 동안 10·11·12번을 되풀이, 바닥에 닿으면 다운
  {
    const s = fresh(2400, 2440);
    const log = watch(s, 140, (t) => [t === 0 ? I.IN_ATTACK | I.IN_UP : 0, 0]);
    const air = log.filter((l) => l.mode === 'airhit' && l.hitstop === 0).map((l) => l.frame);
    const head = air.slice(0, air.indexOf(10));
    const tail = air.slice(air.indexOf(10));
    const loops = tail.every((v, i) => i === 0 || v === tail[i - 1] || v === (tail[i - 1] === 12 ? 10 : tail[i - 1] + 1));
    const kd = log.findIndex((l) => l.mode === 'knockdown');
    results.push(['공중에서 맞음: 1~9번은 한 번, 그 뒤 10·11·12번을 되풀이하다 바닥에 닿으면 다운', ordered(head) && head[0] <= 2 && tail.length > 8 && tail.includes(12) && loops && kd > 0 && log[kd].motion === 'common/knockdown',
      `앞 ${[...new Set(head)].join(' ')} / 되풀이 ${tail.slice(0, 12).join(' ')}… (${tail.length}틱) → ${kd > 0 ? log[kd].motion : '다운 없음'}`]);
  }
  // 7) 공중에서 다시 맞으면 1번부터: 연속 장면(대시 공격 → 차지 → 점프 → 공중 3타)의 공중 타격마다 2P가 1번 프레임
  {
    const st = sim.createState(1);
    while (st.tick < 75) sim.step(st, [0, 0]);
    Object.assign(st.fighters[0], { x: 2196 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: 1 });
    Object.assign(st.fighters[1], { x: 2296 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: -1 });
    for (let i = 0; i < 70; i++) sim.step(st, [0, 0]);
    const RT = I.IN_RIGHT;
    const seq = [[0, 6], [I.IN_DASH, 1], [0, 2], [I.IN_ATTACK, 19], [0, 4], [I.IN_JUMP | RT, 1], [RT, 14], [I.IN_ATTACK | RT, 1], [RT, 6], [I.IN_ATTACK | RT, 1], [RT, 6], [I.IN_ATTACK | RT, 1], [0, 30]].flatMap(([b, n]) => Array(n).fill(b));
    const at = [];
    for (const inp of seq) {
      sim.step(st, [inp, 0]);
      if (st.events.some((e) => e.type === 'hit' && e.who === 0 && String(e.move).startsWith('air'))) at.push(sim.fighterPose(st.fighters[1]));
    }
    results.push(['공중에서 다시 맞으면 1번부터 다시', at.length === 3 && at.every((p) => p.motion === 'common/hit_air' && p.frame === 0), at.map((p) => `${p.motion.split('/')[1]}#${p.frame + 1}`).join(' ')]);
  }
  // 8) 다운·기상 실제: 쓸기에 맞아 넘어지면 다운 1번부터 14번에서 멈춰 누워 있고 (내내 무적), 기상 24틱 중 앞 20틱만 무적
  {
    const s = fresh(2400, 2440);
    const log = watch(s, 200, (t) => [t === 0 ? I.IN_ATTACK | I.IN_DOWN : 0, 0]);
    const kd = log.filter((l) => l.mode === 'knockdown');
    const fr = kd.map((l) => l.frame);
    const gu = log.filter((l) => l.mode === 'getup');
    const guHurt = gu.map((l) => (l.hurt ? 1 : 0)).join('');
    const after = log.findIndex((l, i) => i > 0 && log[i - 1].mode === 'getup' && l.mode !== 'getup');
    results.push(['다운: 1번부터 14번까지 한 번, 14번에서 멈춘 채 누워 기다리고 내내 무적', ordered(fr) && fr[0] === 1 && fr[fr.length - 1] === 14 && fr.filter((v) => v === 14).length >= R.KNOCKDOWN_WAIT && kd.length === R.KNOCKDOWN_TICKS && kd.every((l) => !l.hurt),
      `다운 ${kd.length}틱, 14번 ${fr.filter((v) => v === 14).length}틱, 맞는 판정 ${kd.some((l) => l.hurt) ? '있음' : '없음'}`]);
    results.push(['기상: 24틱, 1~10번(20틱)은 무적이고 11~12번은 맞는다, 끝나면 대기', gu.length === R.GETUP_TICKS && guHurt === '0'.repeat(R.GETUP_INVULN) + '1'.repeat(R.GETUP_TICKS - R.GETUP_INVULN) && after > 0 && log[after].mode === 'idle',
      `기상 ${gu.length}틱, 맞는 판정 ${guHurt}, 다음 ${after > 0 ? log[after].mode : '-'}`]);
  }
  // 9) 낙법 실제: 콤보 다섯 대째가 넘은 채 공중에서 맞고 있을 때 점프 → 18틱, 1~8번(12틱) 무적, 끝나면 낙하
  {
    const s = fresh(2400, 2440);
    let pressed = -1;
    const log = watch(s, 60, (t, st) => {
      const d = st.fighters[1];
      // 띄우기에 맞아 공중에 뜨면 콤보를 다섯 대째로 (낙법 가능), 히트스톱이 끝나면 점프
      if (d.mode === 'airhit' && d.comboHits < R.TECH_HITS) d.comboHits = R.TECH_HITS;
      const go = pressed < 0 && d.mode === 'airhit' && d.hitstop === 0;
      if (go) pressed = t;
      return [t === 0 ? I.IN_ATTACK | I.IN_UP : 0, go ? I.IN_JUMP : 0];
    });
    const tech = log.filter((l) => l.mode === 'tech');
    const fr = tech.map((l) => l.frame);
    const hurt = tech.map((l) => (l.hurt ? 1 : 0)).join('');
    const end = log.findIndex((l, i) => i > 0 && log[i - 1].mode === 'tech' && l.mode !== 'tech');
    results.push(['낙법: 18틱 동안 1번부터 12번까지, 1~8번(12틱)은 무적, 끝나면 낙하(공중)', tech.length === R.TECH_TICKS && ordered(fr) && fr[0] <= 2 && fr[fr.length - 1] === 12
      && hurt.startsWith('0'.repeat(R.TECH_INVULN - 1)) && hurt.endsWith('1'.repeat(R.TECH_TICKS - R.TECH_INVULN)) && end > 0 && ['air', 'land'].includes(log[end].mode),
      `낙법 ${tech.length}틱, 프레임 ${[...new Set(fr)].join(' ')}, 맞는 판정 ${hurt}, 다음 ${end > 0 ? log[end].mode : '-'}`]);
  }
  // 10) 쓰러짐: 공중에서 쓰러져 바닥에 닿으면 다운 그림을 1번부터
  {
    const s = fresh(2400, 2440);
    s.fighters[1].hp = 1;
    const log = watch(s, 140, (t) => [t === 0 ? I.IN_ATTACK | I.IN_UP : 0, 0]);
    const landAt = log.findIndex((l, i) => i > 0 && l.mode === 'ko' && l.motion === 'common/knockdown' && log[i - 1].motion !== 'common/knockdown');
    results.push(['쓰러짐: 날아가는 동안 공중에서 맞음, 바닥에 닿으면 다운 1번부터', landAt > 0 && log[landAt].frame === 1 && log.slice(0, landAt).some((l) => l.mode === 'ko' && l.motion === 'common/hit_air'),
      landAt > 0 ? `바닥에 닿은 틱 다운 ${log[landAt].frame}번` : '바닥에 닿지 않음']);
  }
  return results;
}

/** 필살기 연출 (캐릭터 기획서 '필살기 연출'): 맞으면 고정·장면 재생·끝에 한 번에, 빗나가면 큰 빈틈, 막히면 연출 없음 */
function cineChecks() {
  const results = [];
  const I = sim;
  const fresh = (x0, x1) => {
    const s = sim.createState(1);
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    s.fighters[0].meter = R.METER_MAX;
    return s;
  };
  const total = sim.MOVES.super.data.cinematic.scenes.reduce((n, sc) => n + sim.motionFrames(sc.a.motion).total, 0);
  // 1) 맞으면: 연출 동안 둘 다 고정(cine), 체력·시간 그대로, 끝에 한 번에 피해
  let s = fresh(2400, 2440);
  const [a, d] = s.fighters;
  const hp0 = d.hp;
  let startAt = -1;
  let endAt = -1;
  let hpDuring = true;
  let timerDuring = true;
  let hits = 0;
  let splats = 0;
  let t0 = 0;
  for (let k = 0; k < 400; k++) {
    sim.step(s, [k === 0 ? I.IN_SUPER : 0, 0]);
    for (const e of s.events) {
      if (e.type === 'cine' && e.text === 'start') {
        startAt = k;
        t0 = s.timer;
      }
      if (e.type === 'cine' && e.text === 'end') endAt = k;
      if (e.type === 'hit' && e.who === 0 && e.move === 'super') hits++;
      if (e.type === 'wallsplat') splats++;
    }
    if (startAt >= 0 && endAt < 0 && k > startAt) {
      if (d.hp !== hp0) hpDuring = false;
      if (s.timer !== t0 || a.mode !== 'cine' || d.mode !== 'cine') timerDuring = false;
    }
  }
  const dealt = hp0 - d.hp;
  results.push(['필살기가 맞으면 연출이 시작되고, 장면이 다 끝나야 끝난다', startAt >= 0 && endAt - startAt === total, `시작 ${startAt}틱째, 길이 ${endAt - startAt}틱 (장면 합 ${total}틱)`]);
  results.push(['연출 동안 두 사람은 고정되고, 체력·시간이 그대로다', hpDuring && timerDuring, `체력 그대로 ${hpDuring}, 시간·모드 그대로 ${timerDuring}`]);
  const want = sim.MOVES.super.data.damage + splats * sim.CITY_RULES.wallsplat.damage;
  results.push(['피해는 연출 끝에 한 번에 (필살기 피해, 건물에 박히면 벽꽝 피해 더)', hits === 1 && dealt === want, `맞힘 이벤트 ${hits}번, 깎인 체력 ${dealt} (필살기 ${sim.MOVES.super.data.damage} + 벽꽝 ${splats}번)`]);
  // 2) 연출 중간에 저장·복원해도 같은 결과
  s = fresh(2400, 2440);
  for (let k = 0; k < 120; k++) sim.step(s, [k === 0 ? I.IN_SUPER : 0, 0]);
  const mid = s.cine !== null;
  const copy = JSON.parse(JSON.stringify(s));
  for (let k = 0; k < 200; k++) {
    sim.step(s, [0, 0]);
    sim.step(copy, [0, 0]);
  }
  results.push(['연출 중간에 저장·복원해도 같은 해시', mid && sim.hashState(s) === sim.hashState(copy), `${mid ? '연출 중 저장' : '연출 아님'} ${sim.hashState(s)} ${sim.hashState(copy)}`]);
  // 3) 빗나가면: 연출 없이 끝나고, 한참 굳어 아무것도 못 한다
  s = fresh(2400, 2700);
  const w = s.fighters[0];
  let whiffAt = -1;
  let started = false;
  for (let k = 0; k < 200 && whiffAt < 0; k++) {
    sim.step(s, [k === 0 ? I.IN_SUPER : 0, 0]);
    if (s.events.some((e) => e.type === 'cine' && e.text === 'start')) started = true;
    if (s.events.some((e) => e.type === 'cine' && e.text === 'whiff')) whiffAt = k;
  }
  let acted = false;
  for (let k = 0; k < 30; k++) {
    sim.step(s, [k % 2 ? I.IN_ATTACK : I.IN_JUMP, 0]);
    if (w.mode !== 'land') acted = true;
  }
  results.push(['빗나가면 연출 없이 끝나고 한참(40틱) 굳는다', !started && whiffAt >= 0 && !acted, `연출 ${started}, 빗나감 ${whiffAt + 1}틱째, 굳은 동안 움직임 ${acted}`]);
  // 4) 막히면 연출이 없다
  s = fresh(2400, 2440);
  let blocked = false;
  started = false;
  for (let k = 0; k < 200; k++) {
    sim.step(s, [k === 0 ? I.IN_SUPER : 0, I.IN_DOWN]);
    if (s.events.some((e) => e.type === 'block' && e.move === 'super')) blocked = true;
    if (s.events.some((e) => e.type === 'cine' && e.text === 'start')) started = true;
  }
  results.push(['막히면 연출 없이 그냥 막힌다', blocked && !started, `막힘 ${blocked}, 연출 ${started}`]);
  // 5) 시타델 3단계 광장에서 맞히면, 무너지는 것은 연출이 끝난 뒤
  s = fresh(3180, 3220);
  const c = s.citadel;
  c.hp = sim.KEEP_RULES.stages[2];
  c.stage = 3;
  c.stageAt = [0, 0, 0, -1];
  Object.assign(s.props[sim.BIG.bigsign], { hp: 0, stage: 2, damagedAt: 0, brokenAt: 0 });
  let fellAt = -1;
  let cineEnd = -1;
  for (let k = 0; k < 400; k++) {
    sim.step(s, [k === 0 ? I.IN_SUPER : 0, 0]);
    for (const e of s.events) {
      if (e.type === 'citadel' && e.text === 'collapse') fellAt = k;
      if (e.type === 'cine' && e.text === 'end') cineEnd = k;
    }
  }
  results.push(['시타델 3단계에서 맞히면 연출 끝 타격에 무너진다 (연출 동안은 그대로)', cineEnd >= 0 && fellAt === cineEnd, `연출 끝 ${cineEnd}틱째, 무너짐 ${fellAt}틱째`]);
  return results;
}

function wallChecks() {
  const results = [];
  const I = sim;
  const fresh = (x0, x1) => {
    const s = sim.createState(1);
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  const run = (s, inputs) => {
    for (const inp of inputs) sim.step(s, [inp, 0]);
  };
  const hold = (inp, n) => Array(n).fill(inp);
  const air = (f, x, h) => {
    f.x = x * 256;
    f.y = -h * 256;
    f.floor = 0;
    f.vx = 0;
    f.vy = 0;
    f.mode = 'air';
    f.t = 0;
  };
  const tower = sim.SURFACES.find((x) => x.kind === 'tower');
  const reach = sim.RULES.WALL_REACH / 256;

  // 1) 기둥탑 왼쪽 면: 공중에서 오른쪽을 누르면 붙는다 (테라스 200 아래에서)
  let s = fresh(tower.x0 - 20, tower.x0 + 200);
  let f = s.fighters[0];
  air(f, tower.x0 - 9, 170);
  f.airJumpUsed = true;
  f.airDashUsed = true;
  run(s, hold(I.IN_RIGHT | I.IN_UP, 6));
  const towerWall = f.wallId;
  results.push(['공중에서 벽 쪽 대각선 위(↗)를 누르면 벽을 등지고 붙는다', f.mode === 'wallcling' && f.x === (tower.x0 - reach) * 256 && f.facing === -1, `${f.mode} x=${f.x / 256} 바라봄 ${f.facing}`]);
  results.push(['벽을 디디면 2단 점프·공중 대시가 다시 생긴다', !f.airJumpUsed && !f.airDashUsed]);
  // 2) 천천히 미끄러진다 (30틱에 내려간 거리)
  const y0 = f.y;
  run(s, hold(I.IN_RIGHT, 30));
  const slid = (f.y - y0) / 256;
  results.push(['붙은 채 천천히 미끄러진다', f.mode === 'wallcling' && slid > 3 && slid <= 30 * 1.2 + 1, `30틱에 ${slid.toFixed(1)}px (그냥 떨어지면 약 190px)`]);
  // 3) 놓으면 벽 반대쪽으로 떨어진다
  run(s, hold(0, 3));
  results.push(['벽 쪽을 놓으면 떨어진다', f.mode === 'air' && f.x < (tower.x0 - reach) * 256, `${f.mode} x=${(f.x / 256).toFixed(1)}`]);
  // 4) 같은 벽은 연속 두 번까지: 이미 두 번 디뎠으면 안 붙고, 한 번이면 붙어서 두 번째가 된다. 땅에 내려서면 처음부터
  air(f, tower.x0 - 9, 170);
  f.wallId = towerWall;
  f.wallCount = 2;
  run(s, hold(I.IN_RIGHT | I.IN_UP, 6));
  const third = f.mode === 'wallcling';
  air(f, tower.x0 - 9, 170);
  f.wallId = towerWall;
  f.wallCount = 1;
  run(s, hold(I.IN_RIGHT | I.IN_UP, 6));
  const second = f.mode === 'wallcling' && f.wallCount === 2;
  run(s, hold(0, 160));
  const reset = f.y === 0 && f.wallId === -1 && f.wallCount === 0;
  air(f, tower.x0 - 9, 170);
  run(s, hold(I.IN_RIGHT | I.IN_UP, 6));
  results.push(['같은 벽은 연속 두 번까지 (내려서면 다시)', second && !third && reset && f.mode === 'wallcling' && f.wallCount === 1, `두 번째 ${second}, 세 번째 ${third}, 내려서 지움 ${reset}, 다시 ${f.mode}`]);
  // 5) 미끄러져 땅에 닿으면 착지한다
  run(s, hold(I.IN_RIGHT, 300));
  results.push(['붙은 채 땅까지 미끄러지면 착지한다', f.y === 0 && f.mode !== 'wallcling', `${f.mode} y=${-f.y / 256}`]);

  // 6) 서쪽 끝 공장 벽돌 담 (맵 끝 벽): 왼쪽을 누르면 붙는다
  s = fresh(80, 300);
  f = s.fighters[0];
  air(f, 65, 60);
  run(s, hold(I.IN_LEFT, 6));
  results.push(['맵 끝 벽(공장 벽돌 담)은 ↑ 없이 벽 쪽만 눌러도 붙는다', f.mode === 'wallcling' && f.x === (56 + reach) * 256 && f.facing === 1, `${f.mode} x=${f.x / 256}`]);

  // 7) 솟는 중에 닿아도 붙어서 벽을 타고 조금 오르다 미끄러진다
  s = fresh(tower.x0 - 30, tower.x0 + 200);
  f = s.fighters[0];
  air(f, tower.x0 - 9, 20);
  f.vy = -8 * 256;
  run(s, hold(I.IN_RIGHT | I.IN_UP, 3));
  const rising = f.mode === 'wallcling' && f.vy < 0;
  run(s, hold(I.IN_RIGHT, 30));
  results.push(['솟는 중에 닿으면 벽을 타고 오르다 미끄러진다', rising && f.mode === 'wallcling' && f.vy > 0, `솟는 중 붙음 ${rising}, 30틱 뒤 ${f.mode} vy=${(f.vy / 256).toFixed(2)}`]);

  // 벽 점프: 붙은 채 점프 → 벽 반대쪽으로 튕겨 오른다. 2단 점프·공중 대시는 남고, 잠깐 좌우 조작이 듣지 않는다
  const st = sim.STATS;
  for (const [label, inp] of [['벽 쪽을 누른 채', I.IN_RIGHT], ['벽 반대쪽을 누르며', I.IN_LEFT]]) {
    s = fresh(tower.x0 - 20, tower.x0 + 200);
    f = s.fighters[0];
    air(f, tower.x0 - 9, 150);
    run(s, hold(I.IN_RIGHT | I.IN_UP, 6));
    const clungJ = f.mode === 'wallcling';
    run(s, [inp | I.IN_JUMP]);
    // (그 틱에 중력이 한 번 더해진다)
    const jumped = f.mode === 'air' && f.jumpKind === 3 && f.vx === -st.wallJumpVx && f.vy === st.wallJumpVy + st.gravity;
    const kept = !f.airJumpUsed && !f.airDashUsed;
    results.push([`${label} 점프하면 벽 점프 (벽 반대쪽으로 튕겨 오름, 2단 점프·대시는 남음)`, clungJ && jumped && kept, `붙음 ${clungJ}, vx ${(f.vx / 256).toFixed(1)} vy ${(f.vy / 256).toFixed(1)}`]);
  }
  // 벽 점프 직후 벽 쪽을 눌러도 바로 되돌아가지 않고, 그 뒤 2단 점프가 된다
  const vx0 = f.vx;
  run(s, hold(I.IN_RIGHT, sim.RULES.WALL_JUMP_LOCK - 1));
  const locked = f.vx === vx0;
  run(s, hold(0, 4));
  run(s, [I.IN_JUMP]);
  results.push(['벽 점프 직후 잠깐 좌우 조작이 듣지 않고, 그 뒤 2단 점프가 된다', locked && f.jumpKind === 2 && f.airJumpUsed, `잠김 ${locked}, 점프 종류 ${f.jumpKind}`]);
  // 벽 점프 뒤 공중 대시가 끝나면 보통 낙하 그림 (벽 점프 그림이 처음부터 다시 나오지 않는다)
  s = fresh(tower.x0 - 20, tower.x0 + 200);
  f = s.fighters[0];
  air(f, tower.x0 - 9, 150);
  run(s, hold(I.IN_RIGHT | I.IN_UP, 6));
  run(s, [I.IN_JUMP, ...hold(0, 3), I.IN_DASH, ...hold(0, sim.STATS.airDashTicks + 1)]);
  const poseAfter = sim.fighterPose(f).motion;
  results.push(['벽 점프 뒤 공중 대시가 끝나면 벽 점프 그림이 다시 나오지 않는다', f.mode === 'air' && poseAfter !== 'base/wall_jump', `${f.mode} ${poseAfter}`]);

  // 벽 달리기: 지상 대시로 기둥탑 왼쪽 면에 닿으면 벽을 바라보며 달려 오르고, 꼭대기(296)에 못 닿으면 끝에서 벽에 붙는다
  s = fresh(tower.x0 - 40, tower.x0 - 140);
  f = s.fighters[0];
  run(s, [I.IN_RIGHT | I.IN_UP | I.IN_DASH, ...hold(I.IN_RIGHT, 3)]);
  const running = f.mode === 'wallrun' && f.facing === 1 && f.x === (tower.x0 - reach) * 256;
  run(s, hold(I.IN_RIGHT, st.wallRunTicks));
  const h = -f.y / 256;
  results.push(['↑+대시로 벽에 닿으면 벽을 바라보며 달려 오르고, 다 달리면 벽에 붙는다', running && f.mode === 'wallcling' && f.facing === -1 && h > 120 && h < 145, `달림 ${running}, 끝 ${f.mode} 높이 ${h.toFixed(0)}px`]);
  // ↑ 없이 시작한 대시도 벽에 닿을 때 ↑를 누르고 있으면 달린다
  s = fresh(tower.x0 - 40, tower.x0 - 140);
  f = s.fighters[0];
  run(s, [I.IN_RIGHT | I.IN_DASH, ...hold(I.IN_RIGHT | I.IN_UP, 3)]);
  results.push(['↑ 없이 시작한 대시도 벽에 닿을 때 ↑를 누르고 있으면 달린다', f.mode === 'wallrun', f.mode]);
  // 맵 끝 벽(공장 벽돌 담, 420)은 ↑ 없이 대시해도 달린다. 꼭대기가 달리는 높이보다 멀어 다 달린 뒤 붙는다
  s = fresh(100, 330);
  f = s.fighters[0];
  run(s, [I.IN_LEFT | I.IN_DASH, ...hold(I.IN_LEFT, 50)]);
  results.push(['맵 끝 벽은 ↑ 없이 대시해도 달리고, 꼭대기가 멀면 다 달린 뒤 붙는다 (공장 벽돌 담)', f.mode === 'wallcling' && -f.y / 256 > 100, `${f.mode} 높이 ${-f.y / 256}`]);
  // 컨테이너 더미 옆면(112, 구조물): ↑+대시로 달려, 꼭대기가 달리는 높이 안이라 모서리를 넘어 윗면에 선다
  s = fresh(1700, 1900);
  f = s.fighters[0];
  run(s, [I.IN_LEFT | I.IN_UP | I.IN_DASH, ...hold(I.IN_LEFT | I.IN_UP, 20), ...hold(0, 40)]);
  results.push(['컨테이너 더미(구조물)는 ↑+대시로 달려 올라 모서리를 넘어 윗면에 선다', f.y === -sim.CONTAINER_TOP.h * 256 && f.x < 1666 * 256 && !sim.isAirborne(f), `x=${(f.x / 256).toFixed(0)} 높이 ${-f.y / 256}`]);
  // 공중 대시로 벽에 닿아도 달려 오른다 (그 높이에서), 2단 점프·공중 대시가 다시 생긴다
  s = fresh(tower.x0 - 60, tower.x0 - 160);
  f = s.fighters[0];
  air(f, tower.x0 - 60, 60);
  f.airJumpUsed = true;
  run(s, [I.IN_RIGHT | I.IN_UP | I.IN_DASH, ...hold(I.IN_RIGHT, 8)]);
  results.push(['공중 대시로 벽에 닿아도 달려 오르고, 2단 점프·대시가 다시 생긴다', f.mode === 'wallrun' && -f.y / 256 > 60 && !f.airJumpUsed && !f.airDashUsed, `${f.mode} 높이 ${(-f.y / 256).toFixed(0)}`]);
  // 달리는 중에 점프하면 벽 점프 (벽 반대쪽으로)
  run(s, [I.IN_RIGHT | I.IN_JUMP]);
  results.push(['달리는 중에 점프하면 벽 반대쪽으로 벽 점프', f.mode === 'air' && f.jumpKind === 3 && f.vx < 0 && f.facing === -1, `${f.mode} vx ${(f.vx / 256).toFixed(1)}`]);
  // 같은 벽을 이미 두 번 디뎠으면 대시해도 달리지 않고 지나간다
  s = fresh(tower.x0 - 40, tower.x0 - 140);
  f = s.fighters[0];
  f.wallId = towerWall;
  f.wallCount = 2;
  f.y = -1;
  f.vy = 0;
  f.mode = 'air';
  air(f, tower.x0 - 40, 30);
  f.wallId = towerWall;
  f.wallCount = 2;
  run(s, [I.IN_RIGHT | I.IN_UP | I.IN_DASH, ...hold(0, 8)]);
  results.push(['같은 벽을 두 번 디뎠으면 대시해도 달리지 않는다', f.mode !== 'wallrun', f.mode]);

  // 벽 박차기 공격: 기둥탑 왼쪽 면 높이 약 100에 붙어 (왼쪽을 본다) 공격한다
  const wk = sim.MOVES.wallKick;
  const kickFrom = (p2x) => {
    const sk = fresh(tower.x0 - 20, p2x);
    air(sk.fighters[0], tower.x0 - 9, 100);
    run(sk, hold(I.IN_RIGHT | I.IN_UP, 6));
    return sk;
  };
  // 상대를 등 뒤 멀리 두고 헛친다: 벽에 머물러 웅크렸다가 박차고 아래 대각선으로 곧게 날아가고, 땅에 닿으면 오래 굳는다
  s = kickFrom(tower.x0 + 300);
  f = s.fighters[0];
  const kx0 = f.x;
  const ky0 = f.y;
  const kev = [];
  const kstep = (inp, p2 = 0) => {
    sim.step(s, [inp, p2]);
    kev.push(...s.events);
  };
  kstep(I.IN_ATTACK);
  for (let i = 0; i < 3; i++) kstep(0);
  const stayed = f.mode === 'attack' && f.move === 'wallKick' && f.x === kx0 && f.y === ky0;
  for (let i = 0; i < 10; i++) kstep(0);
  const kdx = (kx0 - f.x) / 256;
  const kdy = (f.y - ky0) / 256;
  const straight = f.vx === -wk.dive.vx && f.vy === wk.dive.vy;
  results.push(['붙은 채 공격하면 벽에 머물러 웅크렸다가 박차고 벽 반대쪽 아래 대각선으로 곧게 날아간다', stayed && straight && kdx > 50 && kdy > 35 && kev.some((e) => e.type === 'wallkick'), `머묾 ${stayed}, 10틱 뒤 앞 ${kdx.toFixed(0)}px 아래 ${kdy.toFixed(0)}px, 곧게 ${straight}`]);
  for (let i = 0; i < 30 && f.mode === 'attack'; i++) kstep(0);
  results.push(['벽 박차기 공격을 헛치고 땅에 닿으면 오래 굳는다', f.mode === 'land' && f.len === wk.data.landLag, `${f.mode} ${f.len}틱`]);
  // 길목에 선 상대를 맞히면 상대는 날아가고, 때린 쪽은 히트스톱 뒤 뒤로 튕겨 오른다. 점프로 끊으면 2단 점프로 쫓아간다
  for (const [label, p2in] of [['맞히면 상대는 날아가고', 0], ['막히면 상대는 막고', I.IN_DOWN]]) {
    s = kickFrom(tower.x0 - 105);
    f = s.fighters[0];
    const o = s.fighters[1];
    let hitAt = -1;
    let what = '';
    for (let i = 0; i < 40 && hitAt < 0; i++) {
      sim.step(s, [i === 0 ? I.IN_ATTACK : 0, p2in]);
      const e = s.events.find((x) => (x.type === 'hit' || x.type === 'block') && x.move === 'wallKick');
      if (e) {
        hitAt = i;
        what = e.type;
      }
    }
    const defOk = p2in ? what === 'block' && o.mode === 'blockstun' : what === 'hit' && o.mode === 'airhit' && o.vx < 0;
    for (let i = 0; i < wk.data.hitstop + 1; i++) sim.step(s, [0, p2in]);
    const rebound = f.mode === 'attack' && f.vx > 0 && f.vy < 0 && f.t >= wk.frames.cum[wk.dive.to];
    results.push([`벽 박차기 공격을 ${label}, 때린 쪽은 뒤로 튕겨 오른다`, hitAt > 0 && defOk && rebound, `${what || '안 맞음'} ${o.mode}, 때린 쪽 ${f.mode} vx ${(f.vx / 256).toFixed(1)} vy ${(f.vy / 256).toFixed(1)}`]);
    if (!p2in) {
      run(s, [I.IN_JUMP | I.IN_LEFT]);
      results.push(['벽 박차기 공격을 맞히고 점프하면 2단 점프로 쫓아간다', f.mode === 'air' && f.jumpKind === 2 && f.airJumpUsed && f.vx < 0, `${f.mode} 점프 종류 ${f.jumpKind}`]);
    }
  }

  // 벽 낙법: 건물 정면 앞에서 2P가 1P의 스킬 2(벽 쪽으로 날림)에 맞아 정면에 박힌다 (2P가 점프를 누르는 때를 바꿔 가며)
  const g1 = sim.GRIDS[1];
  const gx = Math.round(g1.x + g1.w / 2);
  const skill2 = sim.MOVES.skill2.data.damage;
  const splat = (jumpAfter, hp = null) => {
    const sp = fresh(gx - 22, gx);
    const [a, d] = sp.fighters;
    a.facing = 1;
    d.facing = -1;
    a.meter = sim.RULES.METER_MAX;
    if (hp !== null) d.hp = hp;
    const hp0 = d.hp;
    let at = -1;
    const seen = [];
    for (let k = 0; k < 80; k++) {
      sim.step(sp, [k === 0 ? I.IN_SKILL2 : 0, at >= 0 && k === at + jumpAfter ? I.IN_JUMP : 0]);
      if (at < 0 && sp.events.some((e) => e.type === 'wallsplat')) at = k;
      if (at >= 0) seen.push(d.mode);
      if (d.mode === 'walltech' && seen.filter((m) => m === 'walltech').length === 1) {
        return { d, hp0, at, teched: true, vx: d.vx, vy: d.vy, invuln: d.invuln, hpAtTech: d.hp };
      }
      if (at >= 0 && k > at + 40) break;
    }
    return { d, hp0, at, teched: false, seen };
  };
  const hit = skill2;
  let r = splat(3);
  results.push(['벽꽝에 박히는 순간(히트스톱 중) 점프하면 벽 낙법: 박히지 않고 상대 반대쪽 위로 튕겨 나가며 무적', r.at >= 0 && r.teched && r.vx > 0 && r.vy < 0 && r.invuln > 0, `벽꽝 ${r.at >= 0}, 낙법 ${r.teched}, vx ${(r.vx / 256).toFixed(1)} vy ${(r.vy / 256).toFixed(1)} 무적 ${r.invuln}`]);
  results.push(['벽 낙법이면 벽꽝 추가 피해를 받지 않는다', r.teched && r.hp0 - r.hpAtTech === hit, `피해 ${r.hp0 - r.hpAtTech} (스킬 2 ${hit})`]);
  r = splat(10 + sim.RULES.WALL_TECH_TICKS + 4);
  const late = r.d;
  results.push(['낙법 구간이 지나 점프하면 박혀서 벽꽝 추가 피해를 받는다', r.at >= 0 && !r.teched && r.hp0 - late.hp === hit + sim.CITY_RULES.wallsplat.damage, `낙법 ${r.teched}, 피해 ${r.hp0 - late.hp}`]);
  r = splat(999, hit + 30);
  results.push(['벽꽝 추가 피해로 체력이 다하면 쓰러진다 (KO)', r.at >= 0 && r.d.mode === 'ko' && r.d.hp === 0, `${r.d.mode} 체력 ${r.d.hp}`]);

  // ↑ 없이 벽 쪽을 누르면 구조물 앞을 지나간다: 왼쪽 기둥탑 앞에 선 상대에게 뛰어들기·대시
  const right = tower.x1;
  s = fresh(right + 64, right - 16);
  f = s.fighters[0];
  let caught = false;
  for (const inp of [I.IN_JUMP | I.IN_LEFT, ...hold(I.IN_LEFT, 40)]) {
    sim.step(s, [inp, 0]);
    caught ||= f.mode === 'wallcling';
  }
  results.push(['↑ 없이 기둥탑 앞 상대에게 뛰어들면 붙지 않고 지나간다', !caught && f.x < (right - 10) * 256, `붙음 ${caught}, 끝 x=${(f.x / 256).toFixed(0)}`]);
  s = fresh(right + 64, right - 16);
  f = s.fighters[0];
  caught = false;
  for (const inp of [I.IN_LEFT | I.IN_DASH, ...hold(I.IN_LEFT, 20)]) {
    sim.step(s, [inp, 0]);
    caught ||= f.mode === 'wallrun';
  }
  results.push(['↑ 없이 대시하면 구조물 앞을 지나간다', !caught && f.x < (right - 4) * 256, `벽 달리기 ${caught}, 끝 x=${(f.x / 256).toFixed(0)}`]);

  // 8) 비상계단 바깥 기둥 (건물에 붙은 벽): 붙은 높이의 칸이 무너지면 떨어진다
  const esc = sim.WALLS.find((w) => w.b >= 0 && w.side === 1 && w.h1 - w.h0 > 200);
  s = fresh(esc.x + 30, esc.x + 200);
  f = s.fighters[0];
  air(f, esc.x + 9, 150);
  run(s, hold(I.IN_LEFT | I.IN_UP, 6));
  const clung = f.mode === 'wallcling';
  const g = sim.GRIDS[esc.b];
  const col = Math.floor((esc.x - 1 - g.x) / 16);
  for (let r = 0; r < g.rows; r++) s.city.hp[g.first + r * g.cols + col] = -1;
  run(s, hold(I.IN_LEFT, 3));
  results.push(['붙은 건물 칸이 무너지면 떨어진다', clung && f.mode === 'air', `붙음 ${clung}, 무너진 뒤 ${f.mode}`]);
  return results;
}
