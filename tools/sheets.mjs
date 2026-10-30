// 모든 동작 시트를 out/sheets/<캐릭터>/<동작>.png로 출력한다 (가로 띠, 4배, 프레임 번호).
// 같은 이름의 .md에 프레임별 표시 틱 표를 적는다 (PR 설명에 붙여 넣는 용도).
//   npm run sheets                        모든 동작
//   npm run sheets -- --only raiden/jab   그 동작만
//   npm run sheets -- --approve raiden/jab  출력 후 previews/raiden/jab.png로 복사 (승인 요청용)
//   npm run sheets -- --selftest          도구 확인용 가짜 동작
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const only = valuesOf('--only');
const approve = valuesOf('--approve');
const selftest = argv.includes('--selftest');

const query = new URLSearchParams();
for (const n of [...only, ...approve]) query.append('only', n);
if (selftest) query.set('selftest', '');

const vite = await createServer({ logLevel: 'error', server: { port: 5181 } });
await vite.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(`${vite.resolvedUrls.local[0]}tools/pages/sheets.html?${query}`);
await page.waitForFunction(() => window.__sheets !== undefined, null, { timeout: 15000 }).catch(() => {});
const sheets = (await page.evaluate(() => window.__sheets)) ?? [];
await browser.close();
await vite.close();

let failed = pageErrors.length;
pageErrors.forEach((e) => console.log(`NG  페이지 오류: ${e}`));
if (!sheets.length && !failed) console.log('출력할 동작이 없습니다. (src/anim/motions.ts의 MOTIONS가 비어 있음)');

for (const s of sheets) {
  if (s.errors.length) {
    failed++;
    console.log(`NG  ${s.name}: ${s.errors.join(', ')}`);
    continue;
  }
  const png = `out/sheets/${s.name}.png`;
  mkdirSync(dirname(png), { recursive: true });
  writeFileSync(png, Buffer.from(s.png.split(',')[1], 'base64'));
  writeFileSync(`out/sheets/${s.name}.md`, durTable(s));
  const total = s.dur.reduce((a, b) => a + b, 0);
  console.log(`OK  ${s.name}: ${s.dur.length}프레임, 총 ${total}틱 → ${png}`);
  if (approve.includes(s.name)) {
    const dest = `previews/${s.name}.png`;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(png, dest);
    console.log(`    승인용 복사 → ${dest}`);
  }
}
for (const n of [...only, ...approve]) {
  if (!sheets.some((s) => s.name === n)) { failed++; console.log(`NG  ${n}: 그런 동작이 없습니다`); }
}
process.exit(failed ? 1 : 0);

function durTable(s) {
  const head = `| 프레임 | ${s.dur.map((_, i) => i + 1).join(' | ')} | 합계 |`;
  const line = `| --- | ${s.dur.map(() => '---').join(' | ')} | --- |`;
  const row = `| 표시 틱 | ${s.dur.join(' | ')} | ${s.dur.reduce((a, b) => a + b, 0)} |`;
  return `### ${s.name}\n\n${head}\n${line}\n${row}\n`;
}

function valuesOf(flag) {
  const out = [];
  argv.forEach((a, i) => { if (a === flag && argv[i + 1]) out.push(argv[i + 1]); });
  return out;
}
