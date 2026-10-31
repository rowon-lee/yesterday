// CPU끼리 N판 자동 대전. 예외, 규칙 범위, 결정론(같은 입력 재생·저장/복원 후 같은 해시)을 확인한다.
//   npm run simtest -- [--matches 20] [--ticks 20000] [--seed 1]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const args = parseArgs(process.argv.slice(2), { matches: 20, ticks: 20000, seed: 1 });
let failed = 0;
/** 새 구조물 발판 (컨테이너 더미·등대 밑동·급수탑·누운 간판·누운 전차·잔해 더미) */
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

const total = { bigDamaged: 0, bigBroken: 0, structTicks: 0, cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0, neon: 0, wins: [0, 0, 0], rounds: 0, ticks: 0 };
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
console.log(failed ? `실패 ${failed}건` : '모두 통과');
process.exit(failed ? 1 : 0);

/** CPU 둘이 싸우고, 틱마다 넣은 입력을 기록한다. 틱마다 규칙 범위를 검사한다. */
function runCpuMatch(seed, ticks) {
  const state = sim.createState(seed);
  const cpus = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const log = [];
  const problems = [];
  const stats = { bigDamaged: 0, bigBroken: 0, structTicks: 0, cityChunks: 0, collapse: 0, wallsplat: 0, propDamaged: 0, propBroken: 0, propCrash: 0, hit: 0, block: 0, crush: 0, launch: 0, tech: 0, knockdown: 0, ko: 0, cutin: 0, timeup: 0, maxCombo: 0, perch: 0, perchTicks: 0, drop: 0, maxPerch: 0, neon: 0 };
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
        // 새 구조물 (컨테이너 더미·등대 밑동·급수탑·누운 전차·누운 간판·잔해 더미) 위
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
    if (!Number.isInteger(p.at)) bad(`물건 ${i} 누운 자리가 정수가 아님 ${p.at}`);
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

/**
 * 구조물과 큰 물건 시험. 1P만 정해진 입력으로 움직이고 2P는 가만히 있다 (필요하면 2P가 필살기를 쓴다).
 * - 서쪽 끝 컨테이너 더미: 2단 점프로 올라서고, ↓+점프로 뚫리지 않고, 걸어서 끝을 넘으면 떨어져 벽 안쪽으로 돌아온다
 * - 큰 물건: 평타·그냥 부딪힘은 망가짐까지, 필살기·벽 쪽으로 날린 상대(4타)는 크게 무너짐
 * - 무너진 큰 물건: 등대 꼭대기에 선 사람은 밑동으로 떨어지고, 급수탑 위에 선 사람은 지붕으로, 누운 전차·간판·잔해 더미는 자리를 잡은 뒤 발판
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

  // 1) 컨테이너 더미: 벽 앞에서 점프 → 정점 근처에서 2단 점프, 왼쪽을 누른 채 → 더미 위에 선다
  let s = fresh(72, 260);
  run(s, [I.IN_JUMP | I.IN_LEFT, ...hold(I.IN_LEFT, 18), I.IN_JUMP | I.IN_LEFT, ...hold(I.IN_LEFT, 70)]);
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

  // 6) 노면전차: 지나가는 중에 필살기 → 탈선해 눕고, 자리를 잡은 뒤 윗면이 발판. 같은 입력·저장·복원으로 같은 해시
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
    const before = !!surf(st, 'tram', st.props[T].at + 78);
    for (let i = 0; i < 40; i++) step(0);
    const after = surf(st, 'tram', st.props[T].at + 78);
    // 누운 전차 바로 위에서 떨어뜨린다 (극장 차양이 위에 있어 뛰어오르면 차양에 선다)
    const ff = st.fighters[0];
    ff.x = (st.props[T].at + 78) * 256;
    ff.y = -60 * 256;
    ff.floor = 0;
    for (let i = 0; i < 40; i++) step(0);
    return { st, evs, at, before, after, hash: sim.hashState(st) };
  };
  const tr = tramRun(-1);
  const tp = tr.st.props[T];
  results.push(['필살기에 맞은 노면전차가 탈선해 눕는다', tp.stage === 2 && broke(tr.evs, T)?.combo === 1 && tp.at === sim.tramRestX(tp.at), `지나던 자리 ${tr.at}, 누운 자리 ${tp.at}`]);
  results.push(['누운 전차는 자리를 잡은 뒤에야 발판이 된다', !tr.before && !!tr.after && tr.after.h === sim.tramLying(tp.at).h, `높이 ${tr.after?.h}`]);
  results.push(['누운 전차 위로 떨어지면 선다', tr.st.fighters[0].y === -sim.tramLying(tp.at).h * 256, `${-tr.st.fighters[0].y / 256}px`]);
  const tr2 = tramRun(-1);
  const tr3 = tramRun(150);
  results.push(['전차 장면: 같은 입력·저장·복원이면 같은 해시', tr.hash === tr2.hash && tr.hash === tr3.hash, `${tr.hash} ${tr2.hash} ${tr3.hash}`]);

  // 7) 시타델 간판: 기둥탑 꼭대기에서 필살기 → 떨어져 분수를 깔고 눕고, 자리를 잡은 뒤 발판
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
  results.push(['기둥탑 꼭대기에서 필살기를 맞은 시타델 간판이 떨어져 눕는다', sg.stage === 2 && broke(ev, S)?.combo === 1, `단계 ${sg.stage}`]);
  results.push(['누운 간판은 자리를 잡은 뒤 발판이 된다', !early && !!surf(s, 'sign', 1600) && lying.h > 0, `높이 ${lying.h}`]);

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
