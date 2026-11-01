// 밸런스 확인: 캐릭터끼리 CPU 자동 대전을 모든 짝(양쪽 자리 바꿔)으로 돌려 승률·남은 체력·경기 길이·기술 쓰임을 표로 낸다.
//   node tools/balance.mjs [--seeds 6] [--skill 55] [--ticks 20000] [--chars raiden,eunwoo,edward,oscar]
// → 화면 표 + out/balance.md. 같은 시드면 언제나 같은 결과 (sim 결정론).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const argv = process.argv.slice(2);
const opt = { seeds: 6, skill: 55, ticks: 20000, chars: 'raiden,eunwoo,edward,oscar' };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (k in opt) opt[k] = typeof opt[k] === 'number' ? Number(argv[++i]) : argv[++i];
}
const chars = opt.chars.split(',');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');

/** 한 판 (3판 2선승): 이긴 쪽, 라운드 수, 틱, 남은 체력 비율 합, 사건 수 */
function match(a, b, seed) {
  const s = sim.createState(seed, { chars: [a, b] });
  const cpus = [sim.createCpu(seed * 2 + 1, opt.skill), sim.createCpu(seed * 2 + 2, opt.skill)];
  const use = [{}, {}];
  const dealt = [0, 0];
  let ticks = 0;
  while (ticks < opt.ticks && s.phase !== 'matchEnd') {
    const hp = s.fighters.map((f) => f.hp);
    sim.step(s, [sim.cpuInput(cpus[0], s, 0), sim.cpuInput(cpus[1], s, 1)]);
    ticks++;
    s.fighters.forEach((f, i) => {
      if (f.hp < hp[i]) dealt[1 - i] += hp[i] - f.hp;
      if (f.mode === 'attack' && f.move && f.t === 1 && f.hitstop === 0) use[i][f.move] = (use[i][f.move] ?? 0) + 1;
    });
  }
  return { winner: s.matchWinner, rounds: s.round, ticks, dealt, use };
}

const table = {};
const usage = Object.fromEntries(chars.map((c) => [c, {}]));
const dmg = Object.fromEntries(chars.map((c) => [c, { dealt: 0, games: 0 }]));
const t0 = Date.now();
for (const a of chars) {
  for (const b of chars) {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let ticks = 0;
    for (let k = 0; k < opt.seeds; k++) {
      const r = match(a, b, 1000 + k);
      if (r.winner === 0) wins++;
      else if (r.winner === 1) losses++;
      else draws++;
      ticks += r.ticks;
      dmg[a].dealt += r.dealt[0];
      dmg[a].games++;
      dmg[b].dealt += r.dealt[1];
      dmg[b].games++;
      for (const [i, c] of [[0, a], [1, b]]) for (const [m, n] of Object.entries(r.use[i])) usage[c][m] = (usage[c][m] ?? 0) + n;
    }
    table[`${a}|${b}`] = { wins, losses, draws, ticks: Math.round(ticks / opt.seeds) };
  }
}
await vite.close();

// 캐릭터별 승률 (모든 짝, 양쪽 자리)
const rate = Object.fromEntries(chars.map((c) => [c, { w: 0, n: 0 }]));
for (const a of chars) {
  for (const b of chars) {
    if (a === b) continue;
    const r = table[`${a}|${b}`];
    rate[a].w += r.wins;
    rate[a].n += r.wins + r.losses + r.draws;
    rate[b].w += r.losses;
    rate[b].n += r.wins + r.losses + r.draws;
  }
}
const lines = [];
lines.push(`# 밸런스 (CPU 강도 ${opt.skill}, 짝마다 ${opt.seeds}판, 3판 2선승)`, '');
lines.push(`| 1P \\ 2P | ${chars.join(' | ')} |`, `| --- | ${chars.map(() => '---').join(' | ')} |`);
for (const a of chars) lines.push(`| ${a} | ${chars.map((b) => { const r = table[`${a}|${b}`]; return `${r.wins}승 ${r.losses}패${r.draws ? ` ${r.draws}무` : ''} (${(r.ticks / 60).toFixed(0)}초)`; }).join(' | ')} |`);
lines.push('', '| 캐릭터 | 다른 캐릭터 상대 승률 | 한 판 평균 준 피해 |', '| --- | --- | --- |');
for (const c of chars) lines.push(`| ${c} | ${rate[c].n ? Math.round((100 * rate[c].w) / rate[c].n) : 0}% (${rate[c].w}/${rate[c].n}) | ${Math.round(dmg[c].dealt / Math.max(1, dmg[c].games))} |`);
lines.push('', '| 캐릭터 | 기술 쓰임 (많은 순) |', '| --- | --- |');
for (const c of chars) lines.push(`| ${c} | ${Object.entries(usage[c]).sort((x, y) => y[1] - x[1]).map(([m, n]) => `${m} ${n}`).join(', ')} |`);
const md = lines.join('\n');
console.log(md);
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}초`);
mkdirSync('out', { recursive: true });
writeFileSync('out/balance.md', md + '\n');
