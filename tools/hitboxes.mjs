// 판정 상자 대표 프레임 (3-0a(2)): 캐릭터마다 기술의 첫 판정 틱 그림에 공격 데이터의 피격 상자(초록)·공격 상자(빨강)·연검 판정 선(금색)을 겹친다.
//   npm run hitboxes   → previews/hitboxes/<캐릭터>.png (3배)
// 상자는 sim이 쓰는 값 그대로라, 그림을 다시 깎은 뒤 돌리면 그림과 판정이 어긋난 곳이 보인다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const vite = await createServer({ logLevel: 'error', server: { port: 5183 } });
await vite.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${vite.resolvedUrls.local[0]}tools/pages/hitboxes.html`, { timeout: 600000 });
await page.waitForFunction(() => window.__hitboxes !== undefined, null, { timeout: 600000 }).catch(() => {});
const out = (await page.evaluate(() => window.__hitboxes)) ?? [];
await browser.close();
await vite.close();
errors.forEach((e) => console.log(`NG  페이지 오류: ${e}`));
mkdirSync('previews/hitboxes', { recursive: true });
for (const { char, png } of out) {
  const file = `previews/hitboxes/${char}.png`;
  writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`OK  ${file}`);
}
process.exit(errors.length || !out.length ? 1 : 0);
