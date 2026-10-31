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

const total = { propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, wins: [0, 0, 0], rounds: 0, ticks: 0 };
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
    console.log(`${ok ? 'OK ' : 'NG '} ${String(m + 1).padStart(2)}판 시드 ${seed}: ${a.log.length}틱, ${a.rounds}라운드, ${w}, 히트 ${a.stats.hit} 방어 ${a.stats.block} 띄우기 ${a.stats.launch} 낙법 ${a.stats.tech} 크러시 ${a.stats.crush} 필살 ${a.stats.cutin} 최대콤보 ${a.stats.maxCombo} 물건파괴 ${a.stats.propBroken}(부딪힘 ${a.stats.propCrash}) | 해시 ${a.hash}${a.hash === b ? '' : ` ≠ 재생 ${b}`}${a.hash === c ? '' : ` ≠ 저장·복원 ${c}`}${a.ended ? '' : ' | 경기가 끝나지 않음'}`);
    for (const p of a.problems.slice(0, 5)) console.log(`      ${p}`);
    for (const k of Object.keys(a.stats)) if (k !== 'maxCombo') total[k] += a.stats[k];
    total.maxCombo = Math.max(total.maxCombo, a.stats.maxCombo);
    total.wins[a.winner < 0 ? 2 : a.winner]++;
    total.rounds += a.rounds;
    total.ticks += a.log.length;
  } catch (e) {
    failed++;
    console.log(`NG  ${m + 1}판 (시드 ${seed}): 예외 ${e?.stack ?? e}`);
  }
}
await vite.close();

console.log(`\n합계 ${args.matches}판 ${total.rounds}라운드 (${(total.ticks / 60 / 60).toFixed(1)}분 분량), ${Date.now() - t0}ms`);
console.log(`  1P 승 ${total.wins[0]}, 2P 승 ${total.wins[1]}, 무승부 ${total.wins[2]}`);
console.log(`  히트 ${total.hit}, 방어 ${total.block}, 가드 크러시 ${total.crush}, 띄우기 ${total.launch}, 낙법 ${total.tech}, 다운 ${total.knockdown}, KO ${total.ko}, 시간 초과 ${total.timeup}, 필살 ${total.cutin}, 최대 콤보 ${total.maxCombo}`);
console.log(`  부서지는 물건: 망가짐 ${total.propDamaged}, 파괴 ${total.propBroken} (그중 날아온 캐릭터에 부딪혀서 ${total.propCrash})`);
console.log(failed ? `실패 ${failed}건` : '모두 통과');
process.exit(failed ? 1 : 0);

/** CPU 둘이 싸우고, 틱마다 넣은 입력을 기록한다. 틱마다 규칙 범위를 검사한다. */
function runCpuMatch(seed, ticks) {
  const state = sim.createState(seed);
  const cpus = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const log = [];
  const problems = [];
  const stats = { propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0 };
  while (log.length < ticks && state.phase !== 'matchEnd') {
    const inputs = [sim.cpuInput(cpus[0], state, 0), sim.cpuInput(cpus[1], state, 1)];
    log.push(inputs);
    sim.step(state, inputs);
    for (const e of state.events) {
      if (e.type in stats) stats[e.type]++;
      if (e.type === 'hit') stats.maxCombo = Math.max(stats.maxCombo, e.combo);
      if (e.type === 'prop') {
        if (e.text === 'damaged') stats.propDamaged++;
        else {
          stats.propBroken++;
          if (e.heavy) stats.propCrash++;
        }
      }
    }
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
    if (!Number.isInteger(f.x) || !Number.isInteger(f.y) || !Number.isInteger(f.vx) || !Number.isInteger(f.vy)) bad(`${n} 위치·속도가 정수가 아님`);
    try {
      sim.fighterPose(f);
    } catch (e) {
      bad(`${n} 그림 프레임 오류 ${e.message}`);
    }
  }
  if (Math.abs(a.x - b.x) > R.MAX_SEPARATION + 256) bad(`둘 사이가 화면 밖 ${Math.abs(a.x - b.x) / 256}px`);
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
