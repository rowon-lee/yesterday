// 판정 비교: 캐릭터끼리 CPU 자동 대전을 모든 짝(양쪽 자리 바꿔)·같은 시드로 돌려 캐릭터별 판정 수(맞힘·막힘·크러시)와
// 준 피해 합계, 기술별 맞힘 수, 판마다 끝 상태 해시를 낸다. 판정·시간을 옮기기 전후에 돌려 같은지 본다 (3-0a(2)).
//   node tools/hitcompare.mjs [--seeds 4] [--ticks 20000] [--skill 55] [--out out/hitcompare.json] [--root .]
// 같은 시드면 언제나 같은 결과 (sim 결정론). --root로 다른 작업 폴더(예: 바꾸기 전 git worktree)의 sim을 돌린다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const argv = process.argv.slice(2);
const opt = { seeds: 4, ticks: 20000, skill: 55, out: 'out/hitcompare.json', root: '.', chars: 'base,raiden,eunwoo,edward,oscar' };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (k in opt) opt[k] = typeof opt[k] === 'number' ? Number(argv[++i]) : argv[++i];
}
const chars = opt.chars.split(',');
const root = resolve(opt.root);
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
await vite.close();

const stat = () => ({ hit: 0, block: 0, crush: 0, other: 0, damage: 0, moves: {} });
const per = Object.fromEntries(chars.map((c) => [c, stat()]));
const hashes = {};
for (const a of chars) {
  for (const b of chars) {
    for (let k = 0; k < opt.seeds; k++) {
      const seed = 1000 + k;
      const s = sim.createState(seed, { chars: [a, b] });
      const cpus = [sim.createCpu(seed * 2 + 1, opt.skill), sim.createCpu(seed * 2 + 2, opt.skill)];
      let ticks = 0;
      while (ticks < opt.ticks && s.phase !== 'matchEnd') {
        const hp = s.fighters.map((f) => f.hp);
        sim.step(s, [sim.cpuInput(cpus[0], s, 0), sim.cpuInput(cpus[1], s, 1)]);
        ticks++;
        const who = [a, b];
        s.fighters.forEach((f, i) => {
          if (f.hp < hp[i]) per[who[1 - i]].damage += hp[i] - f.hp;
        });
        for (const e of s.events) {
          if (!['hit', 'block', 'crush'].includes(e.type) || e.who === undefined) continue;
          const c = per[who[e.who]];
          c[e.type]++;
          if (e.type === 'hit') c.moves[e.move] = (c.moves[e.move] ?? 0) + 1;
        }
      }
      hashes[`${a}|${b}|${seed}`] = `${sim.hashState(s)} ${ticks}틱`;
    }
  }
}
mkdirSync(dirname(opt.out), { recursive: true });
writeFileSync(opt.out, JSON.stringify({ opt, per, hashes }, null, 1));
console.log(`${opt.out}: ${Object.keys(hashes).length}판`);
console.log('| 캐릭터 | 맞힘 | 막힘 | 크러시 | 준 피해 합계 |');
console.log('| --- | --- | --- | --- | --- |');
for (const c of chars) console.log(`| ${c} | ${per[c].hit} | ${per[c].block} | ${per[c].crush} | ${per[c].damage} |`);
