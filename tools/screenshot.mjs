// 장면을 헤드리스 브라우저로 띄워 out/shots/<장면>-<화면>.png로 저장한다.
// 빌드된 dist/를 쓰므로 GitHub Pages에 올라가는 것과 같은 결과다.
// 찍으면서 오류가 없는지, 캔버스가 정수배인지, 60틱/초로 도는지, 키 입력이 모이는지 확인한다.
//   npm run shot                         모든 장면, 모든 화면 크기
//   npm run shot -- blank                그 장면만
//   npm run shot -- "fight?p1=cpu&boxes=1"  장면 뒤에 주소 옵션을 붙일 수 있다
//   npm run shot -- --tick 300           300틱째에 멈추고 찍기 (기본 60)
//   npm run shot -- --view pc-1280x720   그 화면 크기만
//   npm run shot -- --fast               멈출 틱까지 바로 돌려서 찍기 (긴 대전 장면용, 틱 속도·입력 검사는 건너뜀)
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright';

const VIEWS = [
  { name: 'pc-1280x720', width: 1280, height: 720, dpr: 1 },
  { name: 'pc-1366x768', width: 1366, height: 768, dpr: 1 },
  { name: 'phone-landscape', width: 844, height: 390, dpr: 3, mobile: true },
  { name: 'phone-portrait', width: 390, height: 844, dpr: 3, mobile: true },
];

const argv = process.argv.slice(2);
let stopAt = 60;
let fast = false;
const viewNames = [];
let sceneNames = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tick') stopAt = Number(argv[++i]);
  else if (argv[i] === '--fast') fast = true;
  else if (argv[i] === '--view') viewNames.push(argv[++i]);
  else sceneNames.push(argv[i]);
}
const views = viewNames.length ? VIEWS.filter((v) => viewNames.includes(v.name)) : VIEWS;
if (!views.length) fail(`없는 화면 크기: ${viewNames}. 있는 것: ${VIEWS.map((v) => v.name).join(', ')}`);

mkdirSync('out/shots', { recursive: true });
const server = await preview({ preview: { port: 4173, strictPort: true }, logLevel: 'error' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
let failed = 0;

// 장면을 안 고르면 게임에 등록된 장면 전부
if (!sceneNames.length) {
  const page = await browser.newPage();
  await page.goto(url);
  sceneNames = await page.evaluate(() => window.__debug.scenes);
  await page.close();
}

for (const scene of sceneNames) {
  for (const v of views) {
    if (!(await shoot(scene, v))) failed++;
  }
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
process.exit(failed ? 1 : 0);

async function shoot(scene, v) {
  const page = await browser.newPage({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dpr,
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const [name, extra] = scene.split('?');
  await page.goto(`${url}?scene=${encodeURIComponent(name)}${extra ? `&${extra}` : ''}&stopAt=${stopAt}${fast ? '&ff=1' : ''}`);
  const notes = [];
  try {
    await page.waitForFunction(() => window.__debug?.tick >= 1, null, { timeout: 15000 });
    const start = Date.now();
    // 틱이 도는 동안 키를 눌러 입력이 모이는지 본다 (멈추기 전에 시간이 있을 때만).
    let held = null;
    if (stopAt >= 10 && !fast) {
      await page.keyboard.down('KeyJ');
      await page.waitForFunction(() => window.__debug.held.includes('KeyJ'), null, { timeout: 1000 }).catch(() => {});
      held = await page.evaluate(() => window.__debug.held);
      await page.keyboard.up('KeyJ');
    }
    await page.waitForFunction((n) => window.__debug.tick >= n, stopAt, { timeout: stopAt * 50 + 5000 });
    const rate = ((stopAt - 1) * 1000) / (Date.now() - start);
    const size = await page.evaluate(() => {
      const r = document.getElementById('screen').getBoundingClientRect();
      return { w: r.width * devicePixelRatio, h: r.height * devicePixelRatio };
    });
    // 브라우저는 CSS 크기를 1/64px 단위로 저장하므로 dpr이 3 같은 값이면 끝자리가 조금 어긋난다.
    // 그릴 때는 물리 픽셀에 맞춰지므로 0.1 물리 픽셀까지는 정수배로 본다.
    const scale = Math.round(size.w / 320);
    if (Math.abs(size.w - 320 * scale) > 0.1 || Math.abs(size.h - 180 * scale) > 0.1) {
      errors.push(`정수배 아님 (${size.w}×${size.h})`);
    }
    notes.push(`배율 ${scale}배`);
    if (stopAt >= 30 && !fast) {
      if (rate < 50 || rate > 70) errors.push(`틱 속도 ${rate.toFixed(1)}/초`);
      notes.push(`${rate.toFixed(1)}틱/초`);
    }
    if (held) {
      if (!held.includes('KeyJ')) errors.push('키 입력이 안 모임');
      notes.push(`입력 [${held}]`);
    }
  } catch (e) {
    errors.push(e.message.split('\n')[0]);
  }
  const path = `out/shots/${scene.replace(/[?&=]+/g, '-')}-${stopAt}-${v.name}.png`;
  await page.screenshot({ path });
  await page.close();
  const ok = errors.length === 0;
  console.log(`${ok ? 'OK ' : 'NG '} ${path}  ${stopAt}틱째, ${notes.join(', ')}${ok ? '' : ` / 문제: ${errors.join(' / ')}`}`);
  return ok;
}

function fail(msg) {
  console.log(`NG  ${msg}`);
  process.exit(1);
}
