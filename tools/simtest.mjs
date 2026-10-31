// CPU끼리 N판 자동 대전. 예외, 규칙 범위, 결정론(같은 입력 재생·저장/복원 후 같은 해시)을 확인한다.
//   npm run simtest -- [--matches 20] [--ticks 20000] [--seed 1]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const args = parseArgs(process.argv.slice(2), { matches: 20, ticks: 20000, seed: 1 });
let failed = 0;

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

const total = { cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0, wins: [0, 0, 0], rounds: 0, ticks: 0 };
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
    console.log(`${ok ? 'OK ' : 'NG '} ${String(m + 1).padStart(2)}판 시드 ${seed}: ${a.log.length}틱, ${a.rounds}라운드, ${w}, 히트 ${a.stats.hit} 방어 ${a.stats.block} 띄우기 ${a.stats.launch} 낙법 ${a.stats.tech} 크러시 ${a.stats.crush} 필살 ${a.stats.cutin} 최대콤보 ${a.stats.maxCombo} 물건파괴 ${a.stats.propBroken}(부딪힘 ${a.stats.propCrash}) 붕괴 ${a.stats.collapse} 벽꽝 ${a.stats.wallsplat} 발판 ${a.stats.perch}(최고 ${a.stats.maxPerch}px) | 해시 ${a.hash}${a.hash === b ? '' : ` ≠ 재생 ${b}`}${a.hash === c ? '' : ` ≠ 저장·복원 ${c}`}${a.ended ? '' : ' | 경기가 끝나지 않음'}`);
    for (const p of a.problems.slice(0, 5)) console.log(`      ${p}`);
    for (const k of Object.keys(a.stats)) if (k !== 'maxCombo' && k !== 'maxPerch') total[k] += a.stats[k];
    total.maxCombo = Math.max(total.maxCombo, a.stats.maxCombo);
    total.maxPerch = Math.max(total.maxPerch, a.stats.maxPerch);
    total.wins[a.winner < 0 ? 2 : a.winner]++;
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
await vite.close();

console.log(`\n합계 ${args.matches}판 ${total.rounds}라운드 (${(total.ticks / 60 / 60).toFixed(1)}분 분량), ${Date.now() - t0}ms`);
console.log(`  1P 승 ${total.wins[0]}, 2P 승 ${total.wins[1]}, 무승부 ${total.wins[2]}`);
console.log(`  히트 ${total.hit}, 방어 ${total.block}, 가드 크러시 ${total.crush}, 띄우기 ${total.launch}, 낙법 ${total.tech}, 다운 ${total.knockdown}, KO ${total.ko}, 시간 초과 ${total.timeup}, 필살 ${total.cutin}, 최대 콤보 ${total.maxCombo}`);
console.log(`  건물: 깎인 덩어리 ${total.cityChunks}, 붕괴 ${total.collapse}, 벽꽝 ${total.wallsplat}`);
console.log(`  부서지는 물건: 망가짐 ${total.propDamaged}, 파괴 ${total.propBroken} (그중 날아온 캐릭터에 부딪혀서 ${total.propCrash})`);
console.log(`  발판: 올라선 횟수 ${total.perch}, 발판 위 ${(total.perchTicks / 60).toFixed(0)}초, ↓+점프로 내려옴 ${total.drop}, 가장 높이 선 곳 ${total.maxPerch}px`);
console.log(failed ? `실패 ${failed}건` : '모두 통과');
process.exit(failed ? 1 : 0);

/** CPU 둘이 싸우고, 틱마다 넣은 입력을 기록한다. 틱마다 규칙 범위를 검사한다. */
function runCpuMatch(seed, ticks) {
  const state = sim.createState(seed);
  const cpus = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const log = [];
  const problems = [];
  const stats = { cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0 };
  const was = [0, 0];
  while (log.length < ticks && state.phase !== 'matchEnd') {
    const inputs = [sim.cpuInput(cpus[0], state, 0), sim.cpuInput(cpus[1], state, 1)];
    log.push(inputs);
    sim.step(state, inputs);
    for (const e of state.events) {
      if (e.type in stats) stats[e.type]++;
      if (e.type === 'hit') stats.maxCombo = Math.max(stats.maxCombo, e.combo);
      if (e.type === 'city') stats.cityChunks += e.combo;
      if (e.type === 'prop') {
        if (e.text === 'damaged') stats.propDamaged++;
        else {
          stats.propBroken++;
          if (e.heavy) stats.propCrash++;
        }
      }
    }
    // 발판: 새로 올라선 횟수, 발판 위에 있던 틱, ↓+점프로 내려온 횟수, 가장 높이 선 발판
    state.fighters.forEach((f, i) => {
      if (f.floor < 0 && was[i] === 0) stats.perch++;
      if (f.floor < 0) {
        stats.perchTicks++;
        stats.maxPerch = Math.max(stats.maxPerch, -f.floor / 256);
      }
      if (f.dropT === 9) stats.drop++;
      was[i] = f.floor;
    });
    if (problems.length < 20) check(state, problems);
  }
  return { log, hash: sim.hashState(state), stats, problems, ended: state.phase === 'matchEnd', winner: state.matchWinner, rounds: state.round };
}

function check(s, problems) {
  const [a, b] = s.fighters;
  const bad = (msg) => problems.push(`틱 ${s.tick}: ${msg}`);
  for (const [i, f] of s.fighters.entries()) {
    const n = `${i + 1}P`;
    if (f.hp < 0 || f.hp > HP) bad(`${n} 체력 범위 밖 ${f.hp}`);
    if (f.meter < 0 || f.meter > R.METER_MAX) bad(`${n} 기력 범위 밖 ${f.meter}`);
    if (f.guard < 0 || f.guard > R.GUARD_MAX) bad(`${n} 방어 내구도 범위 밖 ${f.guard}`);
    if (f.x < R.WALL_L || f.x > R.WALL_R) bad(`${n} 벽 밖 x=${f.x / 256}`);
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
    if (p.stage === 2 && p.brokenAt < 0) bad(`물건 ${i} 부서진 시점이 없음`);
  });
}

/** 기록한 입력만으로 다시 돌린다. saveAt이 있으면 그 틱에 상태를 직렬화했다가 복원해서 이어 간다. */
function replay(seed, log, saveAt) {
  let state = sim.createState(seed);
  log.forEach((inputs, i) => {
    if (i === saveAt) state = JSON.parse(JSON.stringify(state));
    sim.step(state, inputs);
  });
  return sim.hashState(state);
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
  results.push(['걸어서 끝을 넘으면 떨어진다', up === -landing.h * 256 && f.y === 0 && f.x > landing.x1 * 256, `x=${Math.round(f.x / 256)}`]);

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
  return results;
}
