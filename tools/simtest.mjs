// CPU끼리 N판 자동 대전. 예외가 없는지, 같은 입력을 다시 돌리면 같은 상태가 되는지 확인한다.
//   npm run simtest -- [--matches 20] [--ticks 5400] [--seed 1]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const args = parseArgs(process.argv.slice(2), { matches: 20, ticks: 5400, seed: 1 });
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

const t0 = Date.now();
for (let m = 0; m < args.matches; m++) {
  const seed = args.seed + m;
  try {
    const a = runCpuMatch(seed, args.ticks);
    const b = replay(seed, a.log, null);
    const c = replay(seed, a.log, Math.floor(args.ticks / 2));
    const ok = a.hash === b && a.hash === c;
    if (!ok) failed++;
    console.log(`${ok ? 'OK ' : 'NG '} ${m + 1}판 (시드 ${seed}, ${a.log.length}틱): 해시 ${a.hash} / 재생 ${b} / 저장·복원 ${c}`);
  } catch (e) {
    failed++;
    console.log(`NG  ${m + 1}판 (시드 ${seed}): 예외 ${e?.stack ?? e}`);
  }
}
await vite.close();

console.log(`\n${args.matches}판, 판마다 최대 ${args.ticks}틱, ${Date.now() - t0}ms. ${failed ? `실패 ${failed}건` : '모두 통과'}`);
process.exit(failed ? 1 : 0);

/** CPU 둘이 싸우고, 틱마다 넣은 입력을 기록한다. */
function runCpuMatch(seed, ticks) {
  const state = sim.createState(seed);
  const cpus = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const log = [];
  while (state.tick < ticks && !state.over) {
    const inputs = [sim.cpuInput(cpus[0], state, 0), sim.cpuInput(cpus[1], state, 1)];
    log.push(inputs);
    sim.step(state, inputs);
  }
  return { log, hash: sim.hashState(state) };
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
