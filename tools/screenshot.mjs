// 장면을 헤드리스 브라우저로 띄워 out/shots/<장면>-<화면>.png로 저장한다.
// 빌드된 dist/를 쓰므로 GitHub Pages에 올라가는 것과 같은 결과다.
// 찍으면서 오류가 없는지, 캔버스가 정수배인지, 60틱/초로 도는지, 키 입력이 모이는지 확인한다.
//   npm run shot                         모든 장면, 모든 화면 크기
//   npm run shot -- blank                그 장면만
//   npm run shot -- "fight?p1=cpu&boxes=1"  장면 뒤에 주소 옵션을 붙일 수 있다
//   npm run shot -- --tick 300           300틱째에 멈추고 찍기 (기본 60)
//   npm run shot -- --view pc-1280x720   그 화면 크기만
//   npm run shot -- --fast               멈출 틱까지 바로 돌려서 찍기 (긴 대전 장면용, 틱 속도·입력 검사는 건너뜀)
//   npm run shot -- --no-map             맵 검사(아래)를 건너뛴다
//   npm run shot -- --map-only           맵 검사만 한다
// 장면을 고르지 않으면 맵 검사도 한다 (docs/맵아트지침서.md 12장): 지면(y=270)·위층(y=0) CAM 0부터 460 간격으로 무대를 찍고
// 외곽선·큰 네모 픽셀·디더·명도·글자를 재서 out/shots/checks.md에 표로, out/shots/checks/<높이>-<CAM>.png에 표시 그림으로 남긴다
// (빨강 외곽선, 노랑 큰 픽셀, 청록 넓은 디더, 초록 글자 자리, 자주 잘린 글자). 휴대폰 화면 크기 한 프레임 시간도 잰다.
// 맵 검사의 NG는 알림이다 (종료 코드를 바꾸지 않는다). --map-strict면 NG가 있을 때 실패로 끝낸다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { analyze, decodeProbe, MAP_CAMS, MAP_HEIGHTS, problems, row, TABLE_HEAD } from './mapcheck.mjs';

const VIEWS = [
  { name: 'pc-1280x720', width: 1280, height: 720, dpr: 1 },
  { name: 'pc-1366x768', width: 1366, height: 768, dpr: 1 },
  { name: 'phone-landscape', width: 844, height: 390, dpr: 3, mobile: true },
  { name: 'phone-portrait', width: 390, height: 844, dpr: 3, mobile: true },
];

const argv = process.argv.slice(2);
let stopAt = 60;
let fast = false;
let noMap = false;
let mapStrict = false;
let mapOnly = false;
const viewNames = [];
let sceneNames = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tick') stopAt = Number(argv[++i]);
  else if (argv[i] === '--fast') fast = true;
  else if (argv[i] === '--view') viewNames.push(argv[++i]);
  else if (argv[i] === '--no-map') noMap = true;
  else if (argv[i] === '--map-strict') mapStrict = true;
  else if (argv[i] === '--map-only') mapOnly = true;
  else sceneNames.push(argv[i]);
}
const views = viewNames.length ? VIEWS.filter((v) => viewNames.includes(v.name)) : VIEWS;
if (!views.length) fail(`없는 화면 크기: ${viewNames}. 있는 것: ${VIEWS.map((v) => v.name).join(', ')}`);

mkdirSync('out/shots', { recursive: true });
const server = await preview({ preview: { port: 4173 }, logLevel: 'error' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
let failed = 0;

// 장면을 안 고르면 게임에 등록된 장면 전부 (그리고 맵 검사). --map-only면 맵 검사만
const doMap = mapOnly || (!noMap && !sceneNames.length);
if (mapOnly) sceneNames = [];
else if (!sceneNames.length) {
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

let mapNg = 0;
if (doMap) mapNg = await mapChecks();

await browser.close();
await new Promise((r) => server.httpServer.close(r));
process.exit(failed || (mapStrict && mapNg) ? 1 : 0);

/** 맵 검사: 지면·위층 전 구간 (지침서 12장 4·5) */
async function mapChecks() {
  mkdirSync('out/shots/checks', { recursive: true });
  const lines = ['# 맵 검사 (npm run shot)', '', '기준: 외곽선 ≤ 2% (형태 경계 중), 큰 네모 픽셀 ≤ 0.5%, 넓은 면 디더 ≤ 3%, 광원(흑백 200 이상) 2~5%, 먼 겹 평균 15~40, 중간 겹 25~60.', ''];
  let ng = 0;
  for (const H of MAP_HEIGHTS) {
    lines.push(`## ${H.name} (y=${H.camy})`, '', ...TABLE_HEAD);
    for (const cam of MAP_CAMS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(`${url}?scene=stage&cam=${cam}&camy=${H.camy}&stopAt=300&ff=1&quality=high`);
      await page.waitForFunction(() => window.__debug?.tick >= 300, null, { timeout: 90000 });
      const raw = await page.evaluate(() => window.__debug.mapProbe());
      const probe = decodeProbe(raw);
      const a = analyze(probe);
      const b64 = (u8) => Buffer.from(u8).toString('base64');
      const png = await page.evaluate(drawOverlay, {
        rgba: raw.rgba, w: probe.w, h: probe.h,
        outline: b64(a.masks.outlineMask), big: b64(a.masks.bigMask), dither: b64(a.masks.ditherMask),
        signs: raw.signs, cam: raw.cam, view: raw.view,
      });
      writeFileSync(`out/shots/checks/${H.id}-${cam}.png`, Buffer.from(png, 'base64'));
      await page.close();
      const p = problems(a);
      if (p.length) ng++;
      lines.push(row(`${H.name} ${cam}`, a));
      console.log(`${p.length ? 'NG ' : 'OK '} 맵 ${H.name} CAM ${cam}  외곽선 ${a.outline.pct.toFixed(1)}% · 큰 픽셀 ${a.bigPixels.pct.toFixed(1)}% · 디더 ${a.dither.pct.toFixed(1)}% · 광원 ${a.value.lightsPct.toFixed(1)}%${p.length ? ` / ${p.join('; ')}` : ''}`);
    }
    lines.push('');
  }
  // 휴대폰 화면 크기에서 대전 한 프레임 (이 환경은 그래픽 칩이 없어 소프트웨어 그래픽이라 실제 휴대폰보다 느리다)
  const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await phone.goto(`${url}?scene=fight&p1=cpu&seed=2&stopAt=120&ff=1`);
  await phone.waitForFunction(() => window.__debug?.tick >= 120, null, { timeout: 90000 });
  const ms = await phone.evaluate(() => {
    window.__debug.unstop();
    window.__debug.bench(5);
    return window.__debug.bench(30);
  });
  const q = await phone.evaluate(() => window.__debug.quality);
  await phone.close();
  lines.push(`휴대폰 화면 크기(844×390, 3배) 대전 한 프레임: ${ms.toFixed(1)}ms (품질 ${q}, 이 환경은 그래픽 칩 없이 CPU로 그린다)`);
  console.log(`맵 검사: NG ${ng}곳 / ${MAP_CAMS.length * MAP_HEIGHTS.length}곳 → out/shots/checks.md · 휴대폰 화면 크기 대전 한 프레임 ${ms.toFixed(1)}ms (품질 ${q})`);
  writeFileSync('out/shots/checks.md', lines.join('\n'));
  return ng;
}

/** 페이지 안에서: 화면 위에 검사 결과를 칠해 2배 PNG(base64)로 */
async function drawOverlay(o) {
  const dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const rgba = dec(o.rgba);
  const out = dec(o.outline);
  const big = dec(o.big);
  const dit = dec(o.dither);
  const cv = document.createElement('canvas');
  cv.width = o.w;
  cv.height = o.h;
  const g = cv.getContext('2d');
  const img = g.createImageData(o.w, o.h);
  for (let i = 0; i < o.w * o.h; i++) {
    let r = rgba[i * 4];
    let gg = rgba[i * 4 + 1];
    let b = rgba[i * 4 + 2];
    if (dit[i]) { r = r * 0.5; gg = gg * 0.5 + 110; b = b * 0.5 + 110; }
    if (big[i]) { r = r * 0.5 + 120; gg = gg * 0.5 + 120; b = b * 0.5; }
    if (out[i]) { r = 255; gg = 40; b = 40; }
    img.data.set([r, gg, b, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  const DIST = 3000;
  for (const s of o.signs) {
    let r;
    if (s.layer) r = [s.x0 - o.view.x * s.layer, s.y0 - o.view.y * s.layer, s.x1 - o.view.x * s.layer, s.y1 - o.view.y * s.layer];
    else {
      const k = DIST / (DIST - s.z);
      r = [o.w / 2 + (s.x0 - o.cam.x) * k, o.h / 2 - (s.y1 - o.cam.y) * k, o.w / 2 + (s.x1 - o.cam.x) * k, o.h / 2 - (s.y0 - o.cam.y) * k];
    }
    if (r[2] < 0 || r[0] > o.w || r[3] < 0 || r[1] > o.h) continue;
    const cut = r[0] < 0 || r[2] > o.w || r[1] < 0 || r[3] > o.h;
    g.strokeStyle = cut ? '#ff40ff' : '#40ff60';
    g.strokeRect(Math.round(r[0]) + 0.5, Math.round(r[1]) + 0.5, Math.round(r[2] - r[0]), Math.round(r[3] - r[1]));
  }
  const big2 = document.createElement('canvas');
  big2.width = o.w * 2;
  big2.height = o.h * 2;
  const g2 = big2.getContext('2d');
  g2.imageSmoothingEnabled = false;
  g2.drawImage(cv, 0, 0, o.w * 2, o.h * 2);
  return big2.toDataURL('image/png').split(',')[1];
}

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
    // 첫 프레임(무대 미리 그리기 등)이 끝난 뒤부터 잰다: 밀린 틱을 한꺼번에 따라잡는 구간을 빼려고
    const warm = fast ? 0 : Math.min(10, stopAt - 1);
    await page.waitForFunction((n) => window.__debug.tick >= n, warm, { timeout: 15000 });
    const startTick = await page.evaluate(() => window.__debug.tick);
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
    const rate = ((stopAt - startTick) * 1000) / (Date.now() - start);
    const size = await page.evaluate(() => {
      const c = document.getElementById('screen');
      const r = c.getBoundingClientRect();
      return { w: r.width * devicePixelRatio, h: r.height * devicePixelRatio, iw: c.width, ih: c.height };
    });
    // 브라우저는 CSS 크기를 1/64px 단위로 저장하므로 dpr이 3 같은 값이면 끝자리가 조금 어긋난다.
    // 그릴 때는 물리 픽셀에 맞춰지므로 0.1 물리 픽셀까지는 정수배로 본다.
    // 내부 해상도(캔버스 크기)의 정수배인지
    const scale = Math.round(size.w / size.iw);
    if (scale < 1 || Math.abs(size.w - size.iw * scale) > 0.1 || Math.abs(size.h - size.ih * scale) > 0.1) {
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
