// 정해진 입력으로 대전 장면 한 토막을 GIF로 찍는다 (동작 승인·연속 캡처용). 상대는 가만히 선다(?p2=idle).
//   npm run moveclip -- dash_attack [--every 1] [--scale 2] [--crop x,y,w,h] [--to previews/base/dash_attack-fight.gif]
// → out/clips/<장면>.gif, 확인용으로 프레임을 이어 붙인 out/clips/<장면>-strip.png
//
// 장면은 아래 SCENES에 적는다: 두 사람 자리, 카메라가 자리 잡을 때까지 기다리는 틱, 그 뒤 틱마다 누를 키.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { encodeGif } from './gif.mjs';

/**
 * steps: [키 묶음, 틱 수]. 키 묶음은 그동안 누르고 있는 키 (KeyboardEvent.code). 빈 배열이면 모두 뗀다.
 * 1P는 왼쪽(오른쪽을 봄), 2P는 오른쪽.
 */
const SCENES = {
  // 대시(L) → 3틱 뒤 공격(J) → 맞히고 일어설 때까지
  dash_attack: {
    p1: 2196, p2: 2310, settle: 70,
    steps: [[[], 8], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 44]],
  },
  // 공격(J)을 길게 눌러 평타 → 모으기 1·2·3단계 → 떼면 3단계 차지 (막혀도 방어를 깨고, 맞으면 벽 쪽으로 날림)
  charge: {
    p1: 4300, p2: 4356, settle: 70,
    steps: [[[], 6], [['KeyJ'], 82], [[], 56]],
  },
};

const argv = process.argv.slice(2);
const opt = { every: 1, scale: 2, crop: '', to: '' };
let name = '';
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (argv[i].startsWith('--') && k in opt) opt[k] = typeof opt[k] === 'number' ? Number(argv[++i]) : argv[++i];
  else name = argv[i];
}
const sc = SCENES[name];
if (!sc) {
  console.log(`장면 이름: ${Object.keys(SCENES).join(', ')}`);
  process.exit(1);
}

const server = await preview({ preview: { port: 4186 }, logLevel: 'error' });
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${server.resolvedUrls.local[0]}?scene=fight&p2=idle&stopAt=75&ff=1&quality=high`);
await page.waitForFunction(() => window.__debug?.tick >= 75);
await page.evaluate(() => window.__debug.unstop());
await page.evaluate(([x1, x2]) => {
  const s = window.__fight();
  const [a, b] = s.fighters;
  Object.assign(a, { x: x1 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: 1 });
  Object.assign(b, { x: x2 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: -1 });
}, [sc.p1, sc.p2]);
await page.evaluate((n) => window.__debug.benchTicks(n), sc.settle);

const frames = [];
const log = [];
const held = new Set();
let tick = 0;
for (const [keys, n] of sc.steps) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  for (let i = 0; i < n; i++) {
    tick++;
    if (tick % opt.every === 0 || i === 0) {
      frames.push(await page.evaluate((m) => window.__debug.frame(m), 1));
      log.push(await page.evaluate(() => {
        const s = window.__fight();
        return s.fighters.map((f) => `${f.mode}${f.move ? `/${f.move}` : ''}${f.t ? `@${f.t}` : ''}`).join(' | ');
      }));
    } else await page.evaluate((m) => window.__debug.benchTicks(m), 1);
  }
}
for (const k of held) await page.keyboard.up(k);
await browser.close();
await new Promise((r) => server.httpServer.close(r));
if (errors.length) {
  console.log('NG  페이지 오류:', errors.join(' / '));
  process.exit(1);
}

// 자르기와 확대, 한 팔레트로 합치기
const { w, h } = frames[0];
const [cx, cy, cw, ch] = opt.crop ? opt.crop.split(',').map(Number) : [0, 0, w, h];
const S = opt.scale;
const W = cw * S;
const H = ch * S;
const palette = [];
const global = new Map();
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
    const sy = (cy + Math.floor(y / S)) * w;
    for (let x = 0; x < W; x++) out[y * W + x] = map[raw[sy + cx + Math.floor(x / S)]];
  }
  return out;
});
const delay = Math.max(2, Math.round((opt.every * 100) / 60));
const delays = gifFrames.map(() => delay);
delays[delays.length - 1] += 60;
const gif = encodeGif(W, H, palette, gifFrames, delays);
mkdirSync('out/clips', { recursive: true });
const file = `out/clips/${name}.gif`;
writeFileSync(file, gif);
console.log(`OK  ${file}  ${frames.length}장, ${tick}틱, 색 ${palette.length}개, ${(gif.length / 1024).toFixed(0)}KB`);
log.forEach((l, i) => console.log(`    ${String(i + 1).padStart(3)} ${l}`));
if (opt.to) {
  mkdirSync(dirname(opt.to), { recursive: true });
  copyFileSync(file, opt.to);
  console.log(`    → ${opt.to}`);
}
