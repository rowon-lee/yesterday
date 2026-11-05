// 온라인 경기 기록(어긋남 조사용)을 sim에 다시 넣어 본다.
//   npm run netreplay -- 기록.json
// 기록은 게임이 남긴 것 (src/net/log.ts): ONLINE → COPY LAST LOG로 복사한 JSON을 파일로 저장해 넣는다. 배열(여러 판)이면 모두.
// 시드·캐릭터·양쪽 입력으로 sim을 처음부터 다시 돌려, 기록된 30틱마다의 해시(내 것·상대 것)와 견준다.
//   다시 돌린 해시 = 내 해시 ≠ 상대 해시 → 상대 기기에서 어긋남 (그 기기·브라우저의 계산이 다름)
//   다시 돌린 해시 ≠ 내 해시 → 이 기기에서 어긋남
// 처음 어긋난 해시 틱과 그 앞 30틱 동안의 입력을 보여 준다.
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const file = process.argv[2];
if (!file) {
  console.log('쓰는 법: npm run netreplay -- 기록.json');
  process.exit(2);
}
const raw = JSON.parse(readFileSync(file, 'utf8'));
const logs = Array.isArray(raw) ? raw : [raw];
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
let bad = 0;
for (const log of logs) {
  console.log(`기록: ${log.at} 빌드 ${log.build} 경기 ${log.match} 시드 ${log.seed} ${log.chars.join(' vs ')} 지연 ${log.delay}틱, 내 자리 ${log.side + 1}P, ${log.inputs.length / 2}틱`);
  console.log(`      ${log.ua}`);
  const s = sim.createState(log.seed, { chars: log.chars });
  const want = new Map(log.hashes.map(([k, mine, theirs]) => [k, { mine, theirs }]));
  let first = null;
  for (let t = 1; t * 2 <= log.inputs.length; t++) {
    sim.step(s, [log.inputs[t * 2 - 2], log.inputs[t * 2 - 1]]);
    const w = want.get(t);
    if (!w) continue;
    const h = sim.hashState(s);
    if (h !== w.mine || (w.theirs && h !== w.theirs)) {
      first = { t, h, ...w };
      break;
    }
  }
  if (!first) {
    console.log(`OK  기록된 해시 ${want.size}개가 모두 다시 돌린 결과와 같음${log.desync ? ` (그런데 경기 중 ${log.desync.k}틱 어긋남 표시가 있었음: 기록에 없는 상대 해시)` : ''}`);
    continue;
  }
  bad++;
  const who = first.h === first.mine ? '상대 기기' : first.h === first.theirs ? '이 기록을 남긴 기기' : '양쪽 다';
  console.log(`NG  ${first.t}틱에서 처음 어긋남: 다시 돌림 ${first.h}, 내 것 ${first.mine}, 상대 ${first.theirs} → ${who}에서 계산이 달라짐`);
  const from = Math.max(1, first.t - 30);
  const rows = [];
  for (let t = from; t <= first.t; t++) rows.push(`${t}:${log.inputs[t * 2 - 2]}/${log.inputs[t * 2 - 1]}`);
  console.log(`    ${from}~${first.t}틱 입력 (1P/2P 비트): ${rows.join(' ')}`);
}
await vite.close();
process.exit(bad ? 1 : 0);
