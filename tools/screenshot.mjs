// 빌드된 dist/를 띄워 PC·휴대폰 화면 크기로 캡처한다. → out/shots/*.png
// 틱이 60틱/초로 도는지, 캔버스가 정수배인지, 키 입력이 모이는지도 함께 확인한다.
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright';

const VIEWS = [
  { name: 'pc-1280x720', width: 1280, height: 720, dpr: 1 },
  { name: 'pc-1366x768', width: 1366, height: 768, dpr: 1 },
  { name: 'phone-landscape', width: 844, height: 390, dpr: 3, mobile: true },
  { name: 'phone-portrait', width: 390, height: 844, dpr: 3, mobile: true },
];

mkdirSync('out/shots', { recursive: true });
const server = await preview({ preview: { port: 4173, strictPort: true } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
let failed = false;

for (const v of VIEWS) {
  const page = await browser.newPage({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dpr,
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  const t0 = await page.evaluate(() => window.__debug.tick);
  await page.waitForTimeout(1000);
  const t1 = await page.evaluate(() => window.__debug.tick);
  await page.keyboard.down('KeyJ');
  await page.waitForTimeout(50);
  const held = await page.evaluate(() => window.__debug.held);
  await page.keyboard.up('KeyJ');
  const size = await page.evaluate(() => {
    const c = document.getElementById('screen');
    const r = c.getBoundingClientRect();
    return { w: r.width * devicePixelRatio, h: r.height * devicePixelRatio };
  });
  const scale = size.w / 320;
  await page.screenshot({ path: `out/shots/${v.name}.png` });
  const ok = errors.length === 0 && Number.isInteger(scale) && size.h === 180 * scale
    && held.includes('KeyJ') && t1 - t0 >= 50 && t1 - t0 <= 70;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK ' : 'NG '} ${v.name}: 배율 ${scale}배, 1초에 ${t1 - t0}틱, 입력 [${held}]${errors.length ? ', 오류 ' + errors.join(' / ') : ''}`);
  await page.close();
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
process.exit(failed ? 1 : 0);
