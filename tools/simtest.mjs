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

const total = { wallcling: 0, walljump: 0, wallrun: 0, wallkick: 0, walltech: 0, bigDamaged: 0, bigBroken: 0, structTicks: 0, cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0, neon: 0, wins: [0, 0, 0], rounds: 0, ticks: 0 };
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
    console.log(`${ok ? 'OK ' : 'NG '} ${String(m + 1).padStart(2)}판 시드 ${seed}: ${a.log.length}틱, ${a.rounds}라운드, ${w}, 히트 ${a.stats.hit} 방어 ${a.stats.block} 띄우기 ${a.stats.launch} 낙법 ${a.stats.tech} 크러시 ${a.stats.crush} 필살 ${a.stats.cutin} 최대콤보 ${a.stats.maxCombo} 물건파괴 ${a.stats.propBroken}(부딪힘 ${a.stats.propCrash}) 벽붙기 ${a.stats.wallcling} 벽점프 ${a.stats.walljump} 벽달리기 ${a.stats.wallrun} 박차기 ${a.stats.wallkick} 붕괴 ${a.stats.collapse} 벽꽝 ${a.stats.wallsplat}(벽낙법 ${a.stats.walltech}) 발판 ${a.stats.perch}(최고 ${a.stats.maxPerch}px) | 해시 ${a.hash}${a.hash === b ? '' : ` ≠ 재생 ${b}`}${a.hash === c ? '' : ` ≠ 저장·복원 ${c}`}${a.ended ? '' : ' | 경기가 끝나지 않음'}`);
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
await vite.close();

console.log(`\n합계 ${args.matches}판 ${total.rounds}라운드 (${(total.ticks / 60 / 60).toFixed(1)}분 분량), ${Date.now() - t0}ms`);
console.log(`  1P 승 ${total.wins[0]}, 2P 승 ${total.wins[1]}, 무승부 ${total.wins[2]}`);
console.log(`  히트 ${total.hit}, 방어 ${total.block}, 가드 크러시 ${total.crush}, 띄우기 ${total.launch}, 낙법 ${total.tech}, 다운 ${total.knockdown}, KO ${total.ko}, 시간 초과 ${total.timeup}, 필살 ${total.cutin}, 최대 콤보 ${total.maxCombo}`);
console.log(`  건물: 깎인 덩어리 ${total.cityChunks}, 붕괴 ${total.collapse}, 벽꽝 ${total.wallsplat}`);
console.log(`  부서지는 물건: 망가짐 ${total.propDamaged}, 파괴 ${total.propBroken} (그중 날아온 캐릭터에 부딪혀서 ${total.propCrash}, 네온 간판 꺼짐 ${total.neon})`);
console.log(`  발판: 올라선 횟수 ${total.perch}, 발판 위 ${(total.perchTicks / 60).toFixed(0)}초 (그중 새 구조물 위 ${(total.structTicks / 60).toFixed(0)}초), ↓+점프로 내려옴 ${total.drop}, 가장 높이 선 곳 ${total.maxPerch}px`);
console.log(`  큰 물건: 망가짐 ${total.bigDamaged}, 크게 무너짐 ${total.bigBroken}`);
console.log(`  벽 기동: 벽 붙기 ${total.wallcling}, 벽 점프 ${total.walljump}, 벽 달리기 ${total.wallrun}, 벽 박차기 공격 ${total.wallkick}, 벽 낙법 ${total.walltech} (벽꽝 ${total.wallsplat}번 중)`);
console.log(failed ? `실패 ${failed}건` : '모두 통과');
process.exit(failed ? 1 : 0);

/** CPU 둘이 싸우고, 틱마다 넣은 입력을 기록한다. 틱마다 규칙 범위를 검사한다. */
function runCpuMatch(seed, ticks) {
  const state = sim.createState(seed);
  const cpus = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const log = [];
  const problems = [];
  const stats = { wallcling: 0, walljump: 0, wallrun: 0, wallkick: 0, walltech: 0, bigDamaged: 0, bigBroken: 0, structTicks: 0, cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0, neon: 0 };
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

  // 1) 컨테이너 더미: 벽 앞에서 제자리 점프 → 2단 점프 → 더미 높이를 넘은 뒤 왼쪽으로 → 더미 위에 선다
  //    (벽 쪽을 누른 채 뛰면 더미 앞면에 붙는다. 벽 달리기가 생기면 그것으로도 오른다)
  let s = fresh(72, 260);
  run(s, [I.IN_JUMP, ...hold(0, 18), I.IN_JUMP, ...hold(0, 10), ...hold(I.IN_LEFT, 70)]);
  let f = s.fighters[0];
  results.push(['2단 점프로 컨테이너 더미 위에 선다', f.y === -top * 256 && f.floor === f.y && f.x < 66 * 256, `x=${Math.round(f.x / 256)} y=${-f.y / 256}`]);
  run(s, [I.IN_DOWN | I.IN_JUMP, ...hold(0, 80)]);
  f = s.fighters[0];
  results.push(['컨테이너 더미 위에서 ↓+점프는 뚫고 내려가지 않는다', f.y === -top * 256 && f.x < 66 * 256, `y=${-f.y / 256}`]);
  run(s, [...hold(I.IN_RIGHT, 40), ...hold(0, 40)]);
  f = s.fighters[0];
  results.push(['더미 끝을 넘으면 떨어져 벽 안쪽 땅에 선다', f.y === 0 && f.x >= sim.RULES.WALL_L, `x=${Math.round(f.x / 256)}`]);

  // 2) 등대: 평타는 망가짐까지 (내구도 1에서 멈춤)
  s = fresh(128, 330);
  s.props[L].hp = 60;
  let ev = run(s, hold([I.IN_ATTACK, 0, 0, 0, 0, 0, 0, 0, 0, 0], 12).flat());
  let p = s.props[L];
  results.push(['평타로는 큰 물건(등대)이 망가짐까지만 간다', p.stage === 1 && p.hp === 1 && !broke(ev, L), `단계 ${p.stage}, 내구도 ${p.hp}`]);
  // 필살기가 닿으면 크게 무너진다
  place(s.fighters[0], 128, 0);
  s.fighters[0].meter = sim.RULES.METER_MAX;
  run(s, hold(0, 30));
  ev = run(s, [I.IN_SUPER, ...hold(0, 120)]);
  p = s.props[L];
  results.push(['필살기가 닿으면 등대가 크게 무너진다', p.stage === 2 && broke(ev, L)?.combo === 1, `단계 ${p.stage}`]);
  const gallery = sim.SURFACES.find((x) => x.kind === 'gallery' && x.h === 196);
  results.push(['무너진 등대: 꼭대기 둘레는 없고 밑동 윗면이 발판', !sim.surfaceSolid(s, gallery, 168 * 256) && !!surf(s, 'stump', 168)]);

  // 3) 등대 꼭대기에 선 사람은 꺾이면 밑동으로 떨어진다 (2P가 땅에서 필살기)
  s = fresh(168, 120);
  place(s.fighters[0], 168, 196);
  s.fighters[1].meter = sim.RULES.METER_MAX;
  run(s, hold(0, 4));
  const stood = s.fighters[0].y === -196 * 256;
  ev = run(s, hold(0, 150), (st) => (st.tick % 2 ? I.IN_SUPER : 0));
  f = s.fighters[0];
  results.push(['등대가 꺾이면 꼭대기에 선 사람은 밑동으로 떨어진다', stood && s.props[L].stage === 2 && f.y === -sim.SURFACES.find((x) => x.kind === 'stump').h * 256, `${-f.y / 256}px`]);

  // 4) 그냥 날아와 부딪히면 망가짐까지, '벽 쪽으로 날림'에 맞아 날아오면 무너진다
  for (const [wall, name] of [[false, '그냥 날아와 부딪히면 등대가 망가짐까지만'], [true, '벽 쪽으로 날린 상대가 부딪히면 등대가 무너진다']]) {
    // 가로등(116) 뒤에서 출발한다 (가로등에 먼저 부딪히면 느려진다)
    s = fresh(330, 126);
    const d = s.fighters[1];
    d.x = 126 * 256;
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
  s = fresh(96, 122);
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
    let st = fresh(600, 800);
    let k = 0;
    const step = (inp) => {
      if (k++ === saveAt) st = JSON.parse(JSON.stringify(st));
      sim.step(st, [inp, 0]);
      return st.events;
    };
    while (!(sim.tramAt(st.clock)?.dir === 1 && sim.tramAt(st.clock).x >= 476)) step(0);
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
  const early = !!surf(s, 'sign', 1600);
  run(s, hold(0, 40));
  results.push(['기둥탑 꼭대기에서 필살기를 맞은 시타델 간판이 떨어져 쓰러진다', sg.stage === 2 && broke(ev, S)?.combo === 1, `단계 ${sg.stage}`]);
  results.push(['쓰러진 간판은 자리를 잡은 뒤 발판이 된다', !early && !!surf(s, 'sign', 1600) && lying.h > 0, `높이 ${lying.h}`]);

  // 8) 잔해 더미: 다이너 1층을 크게 뚫어 무너뜨리면, 쌓인 뒤 윗면이 발판
  s = fresh(600, 900);
  for (let x = 712; x <= 820; x += 12) {
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
  results.push(['맵 끝 벽(컨테이너 더미·공원 철책)이 벽 목록에 있다', walls.filter((w) => w.end).length === 2 && sim.WALLS.filter((w) => w.end).every((w) => sim.wallSolid(tr.st, w, 50))]);
  return results;
}

/**
 * 벽 기동 시험. 1P만 정해진 입력으로 움직인다.
 * 벽 붙기: 공중에서 벽 쪽을 누르면 붙고(벽을 등지고, 2단 점프·공중 대시가 다시 생김), 천천히 미끄러지고, 놓으면 떨어지고,
 * 땅에 닿으면 착지하고, 같은 벽은 연속 두 번까지, 맵 끝 벽에도 붙고, 붙은 건물 칸이 무너지면 떨어진다.
 */
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

  // 6) 서쪽 끝 컨테이너 더미 앞면 (맵 끝 벽): 왼쪽을 누르면 붙는다
  s = fresh(90, 300);
  f = s.fighters[0];
  air(f, 75, 60);
  run(s, hold(I.IN_LEFT, 6));
  results.push(['맵 끝 벽(컨테이너 더미)은 ↑ 없이 벽 쪽만 눌러도 붙는다', f.mode === 'wallcling' && f.x === (66 + reach) * 256 && f.facing === 1, `${f.mode} x=${f.x / 256}`]);

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
  // 컨테이너 더미 앞면(112): 꼭대기가 달리는 높이 안이라 모서리를 넘어 윗면에 선다
  s = fresh(120, 330);
  f = s.fighters[0];
  run(s, [I.IN_LEFT | I.IN_DASH, ...hold(I.IN_LEFT, 50)]);
  results.push(['맵 끝 벽은 ↑ 없이 대시해도 달리고, 꼭대기가 닿으면 모서리를 넘어 윗면에 선다 (컨테이너 더미)', f.y === -sim.CONTAINER_TOP.h * 256 && f.x < 66 * 256 && !sim.isAirborne(f), `x=${(f.x / 256).toFixed(0)} 높이 ${-f.y / 256}`]);
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

  // 벽 낙법: 건물 정면 앞에서 2P가 1P의 기술 B(벽 쪽으로 날림)에 맞아 정면에 박힌다 (2P가 점프를 누르는 때를 바꿔 가며)
  const g1 = sim.GRIDS[1];
  const gx = Math.round(g1.x + g1.w / 2);
  const skillB = sim.MOVES.skillB.data.damage;
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
      sim.step(sp, [k === 0 ? I.IN_SKILL_B : 0, at >= 0 && k === at + jumpAfter ? I.IN_JUMP : 0]);
      if (at < 0 && sp.events.some((e) => e.type === 'wallsplat')) at = k;
      if (at >= 0) seen.push(d.mode);
      if (d.mode === 'walltech' && seen.filter((m) => m === 'walltech').length === 1) {
        return { d, hp0, at, teched: true, vx: d.vx, vy: d.vy, invuln: d.invuln, hpAtTech: d.hp };
      }
      if (at >= 0 && k > at + 40) break;
    }
    return { d, hp0, at, teched: false, seen };
  };
  const hit = skillB;
  let r = splat(3);
  results.push(['벽꽝에 박히는 순간(히트스톱 중) 점프하면 벽 낙법: 박히지 않고 상대 반대쪽 위로 튕겨 나가며 무적', r.at >= 0 && r.teched && r.vx > 0 && r.vy < 0 && r.invuln > 0, `벽꽝 ${r.at >= 0}, 낙법 ${r.teched}, vx ${(r.vx / 256).toFixed(1)} vy ${(r.vy / 256).toFixed(1)} 무적 ${r.invuln}`]);
  results.push(['벽 낙법이면 벽꽝 추가 피해를 받지 않는다', r.teched && r.hp0 - r.hpAtTech === hit, `피해 ${r.hp0 - r.hpAtTech} (기술 B ${hit})`]);
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
