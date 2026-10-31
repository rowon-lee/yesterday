// 무대를 바꿨을 때: 고정 카메라 지점에서 이전 버전과 지금 버전을 컬러·흑백으로 나란히 찍고, 영역별 흑백 밝기를 잰다.
//   npm run compare                              이전 = origin/main, 지금 = 작업 중인 코드. 지점 세 곳
//   npm run compare -- --base HEAD~1             이전 버전을 다른 커밋으로
//   npm run compare -- --new "quality=low"       지금 버전 주소에 옵션을 붙인다 (--base-query는 이전 버전 주소에)
//   npm run compare -- --only theater            그 지점만
// 결과: out/compare/<지점>-color.png, <지점>-gray.png (왼쪽 이전, 오른쪽 지금), out/compare/stats.md
// 아트 규칙 '명도'를 숫자로 본다: 벽과 바닥이 같은 밝기로 뭉치면 안 되고, 광원(주인공 간판)이 가장 밝아야 한다.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview, build } from 'vite';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = { base: 'origin/main', new: '', only: '', baseQuery: '' };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--base') opt.base = argv[++i];
  else if (argv[i] === '--new') opt.new = argv[++i];
  else if (argv[i] === '--base-query') opt.baseQuery = argv[++i];
  else if (argv[i] === '--only') opt.only = argv[++i];
}

/**
 * 고정 카메라 지점 (CLAUDE.md 확인 절차): 극장·다이너 거리, 시타델 광장, 비상계단 아파트.
 * 영역(화면 1배 좌표): 벽(위층 벽면), 바닥(길 띠), 간판(구간 주인공 간판 자리).
 */
const POINTS = [
  { id: 'theater', name: '극장·다이너 거리', q: 'scene=stage&cam=420', regions: { wall: [290, 40, 400, 130], floor: [0, 246, 480, 270], sign: [160, 0, 190, 140] } },
  { id: 'plaza', name: '시타델 광장', q: 'scene=stage&cam=1360', regions: { wall: [0, 120, 80, 220], floor: [0, 246, 480, 270], sign: [170, 0, 310, 60] } },
  { id: 'apartments', name: '비상계단 아파트', q: 'scene=stage&cam=2300', regions: { wall: [130, 40, 260, 130], floor: [0, 246, 480, 270], sign: [340, 140, 410, 170] } },
].filter((p) => !opt.only || opt.only.split(',').includes(p.id));

const root = resolve('.');
const tmp = resolve('out/compare-base');
mkdirSync('out/compare', { recursive: true });

// 이전 버전: 임시 작업 트리에 꺼내 빌드
console.log(`이전 버전 ${opt.base} 빌드 중…`);
if (existsSync(tmp)) {
  try { execSync(`git worktree remove --force ${tmp}`, { stdio: 'ignore' }); } catch { rmSync(tmp, { recursive: true, force: true }); }
}
execSync('git worktree prune', { stdio: 'ignore' });
execSync(`git worktree add --detach ${tmp} ${opt.base}`, { stdio: 'ignore' });
if (!existsSync(`${tmp}/node_modules`)) symlinkSync(resolve('node_modules'), `${tmp}/node_modules`);
await build({ root: tmp, logLevel: 'error', build: { outDir: `${tmp}/dist`, emptyOutDir: true } });
console.log('지금 버전 빌드 중…');
await build({ root, logLevel: 'error', build: { outDir: resolve('out/compare-new'), emptyOutDir: true } });

const baseServer = await preview({ root: tmp, preview: { port: 4301, strictPort: true }, build: { outDir: `${tmp}/dist` }, logLevel: 'error' });
const newServer = await preview({ root, preview: { port: 4302, strictPort: true }, build: { outDir: resolve('out/compare-new') }, logLevel: 'error' });
const browser = await chromium.launch();

async function shoot(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__debug?.tick >= 300, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  // 화면 그대로 (2배로 키운 캔버스 자리, 3D면 HUD까지 겹친 모습)
  const png = await page.locator('#screen').screenshot();
  await page.close();
  if (errors.length) throw new Error(`${url}: ${errors.join(' / ')}`);
  return png.toString('base64');
}

const rows = [];
for (const p of POINTS) {
  const bq = `?${p.q}${opt.baseQuery ? `&${opt.baseQuery}` : ''}&stopAt=300&ff=1`;
  const nq = `?${p.q}${opt.new ? `&${opt.new}` : ''}&stopAt=300&ff=1`;
  const before = await shoot(`http://localhost:4301/${bq}`);
  const after = await shoot(`http://localhost:4302/${nq}`);
  const page = await browser.newPage();
  const out = await page.evaluate(async ({ before, after, regions }) => {
    const W = 480;
    const H = 270;
    // 2배 캡처 → 1배 (칸마다 왼쪽 위 화소)
    const decode = async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      const k = img.width / W;
      const out = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const s = (Math.floor(y * k) * img.width + Math.floor(x * k)) * 4;
          out.set(d.subarray(s, s + 4), (y * W + x) * 4);
        }
      }
      return out;
    };
    const a = await decode(before);
    const b = await decode(after);
    const luma = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const stats = (d) => {
      const res = {};
      for (const [k, [x0, y0, x1, y1]] of Object.entries(regions)) {
        const v = [];
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) v.push(luma(d, (y * W + x) * 4));
        v.sort((p, q) => p - q);
        res[k] = { median: Math.round(v[v.length >> 1]), p95: Math.round(v[Math.floor(v.length * 0.95)]) };
      }
      const all = [];
      for (let i = 0; i < W * H; i++) all.push(luma(d, i * 4));
      all.sort((p, q) => p - q);
      res.all = { median: Math.round(all[all.length >> 1]), p99: Math.round(all[Math.floor(all.length * 0.99)]) };
      return res;
    };
    // 나란히 (2배로 키움): 컬러, 흑백
    const sheet = (gray) => {
      const c = document.createElement('canvas');
      c.width = W * 4 + 8;
      c.height = H * 2;
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, c.width, c.height);
      [a, b].forEach((d, k) => {
        const img = new ImageData(W, H);
        for (let i = 0; i < W * H; i++) {
          if (gray) {
            const l = luma(d, i * 4);
            img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = l;
          } else {
            img.data[i * 4] = d[i * 4];
            img.data[i * 4 + 1] = d[i * 4 + 1];
            img.data[i * 4 + 2] = d[i * 4 + 2];
          }
          img.data[i * 4 + 3] = 255;
        }
        const t = document.createElement('canvas');
        t.width = W;
        t.height = H;
        t.getContext('2d').putImageData(img, 0, 0);
        g.imageSmoothingEnabled = false;
        g.drawImage(t, k * (W * 2 + 8), 0, W * 2, H * 2);
      });
      return c.toDataURL('image/png');
    };
    return { color: sheet(false), gray: sheet(true), before: stats(a), after: stats(b) };
  }, { before, after, regions: p.regions });
  await page.close();
  for (const kind of ['color', 'gray']) writeFileSync(`out/compare/${p.id}-${kind}.png`, Buffer.from(out[kind].split(',')[1], 'base64'));
  rows.push({ p, s: out });
  const f = (r) => `벽 ${r.wall.median} · 바닥 ${r.floor.median} (차이 ${Math.abs(r.wall.median - r.floor.median)}) · 간판 밝은 5% ${r.sign.p95} · 화면 밝은 1% ${r.all.p99}`;
  console.log(`${p.name}\n  이전: ${f(out.before)}\n  지금: ${f(out.after)}\n  → out/compare/${p.id}-color.png, ${p.id}-gray.png`);
}

const md = ['| 지점 | 버전 | 벽 (중앙값) | 바닥 (중앙값) | 벽-바닥 차이 | 주인공 간판 (밝은 5%) | 화면 밝은 1% |', '| --- | --- | --- | --- | --- | --- | --- |'];
for (const { p, s } of rows) {
  for (const [label, r] of [['이전', s.before], ['지금', s.after]]) {
    md.push(`| ${p.name} | ${label} | ${r.wall.median} | ${r.floor.median} | ${Math.abs(r.wall.median - r.floor.median)} | ${r.sign.p95} | ${r.all.p99} |`);
  }
}
writeFileSync('out/compare/stats.md', md.join('\n') + '\n');
console.log('흑백 밝기 표 → out/compare/stats.md');

await browser.close();
baseServer.httpServer.close();
newServer.httpServer.close();
execSync(`git worktree remove --force ${tmp}`, { stdio: 'ignore' });
