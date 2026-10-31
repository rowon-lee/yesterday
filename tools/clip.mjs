// 장면 한 토막을 움직이는 GIF로 저장한다 (동작 느낌 확인, PR 미리보기용). → out/clips/*.gif
//   npm run clip -- "fight?p1=cpu&seed=1" --from 900 --ticks 180 [--every 2] [--scale 2] [--name 이름]
import { mkdirSync, writeFileSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { encodeGif } from './gif.mjs';

const argv = process.argv.slice(2);
const opt = { from: 60, ticks: 180, every: 2, scale: 2, name: '' };
let scene = 'fight?p1=cpu';
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (argv[i].startsWith('--') && k in opt) opt[k] = k === 'name' ? argv[++i] : Number(argv[++i]);
  else scene = argv[i];
}

const server = await preview({ preview: { port: 4180 }, logLevel: 'error' });
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const [name, extra] = scene.split('?');
// 시작 틱까지 바로 돌린 뒤 멈춰 두고, 한 토막씩 진행하며 찍는다
await page.goto(`${server.resolvedUrls.local[0]}?scene=${name}${extra ? `&${extra}` : ''}&stopAt=${opt.from}&ff=1`);
await page.waitForFunction(() => window.__debug?.tick >= 1);
await page.evaluate(() => { window.__debug.unstop?.(); });

const frames = [];
const steps = Math.floor(opt.ticks / opt.every);
for (let i = 0; i < steps; i++) frames.push(await page.evaluate((n) => window.__debug.frame(n), i === 0 ? 0 : opt.every));
await browser.close();
await new Promise((r) => server.httpServer.close(r));
if (errors.length) {
  console.log('NG  페이지 오류:', errors.join(' / '));
  process.exit(1);
}

// 프레임마다 다른 색 번호를 하나의 팔레트로 합치고, 정수배로 키운다
const palette = [];
const global = new Map();
const { w, h } = frames[0];
const W = w * opt.scale;
const H = h * opt.scale;
const gifFrames = frames.map((f) => {
  const raw = Buffer.from(f.data, 'base64');
  const map = f.colors.map((c) => {
    if (!global.has(c)) {
      if (palette.length >= 256) return 0;
      global.set(c, palette.length);
      palette.push(c);
    }
    return global.get(c);
  });
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = Math.floor(y / opt.scale) * w;
    for (let x = 0; x < W; x++) out[y * W + x] = map[raw[sy + Math.floor(x / opt.scale)]];
  }
  return out;
});
const gif = encodeGif(W, H, palette, gifFrames, Math.round((opt.every * 100) / 60));
mkdirSync('out/clips', { recursive: true });
const file = `out/clips/${opt.name || `${scene.replace(/[?&=]+/g, '-')}-${opt.from}`}.gif`;
writeFileSync(file, gif);
console.log(`OK  ${file}  ${frames.length}장, ${opt.ticks}틱, 색 ${palette.length}개, ${(gif.length / 1024).toFixed(0)}KB`);
