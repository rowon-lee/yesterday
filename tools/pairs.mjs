// 같은 장면을 이전 버전과 지금 버전으로 찍어 쌍으로 남긴다 (전후 비교 미리보기, 2026-11-02).
//   node tools/pairs.mjs                       이전 = HEAD, 아래 SHOTS 전부
//   node tools/pairs.mjs --base origin/main    이전 버전을 다른 커밋으로
//   node tools/pairs.mjs --only wreck-factory  그 이름만 (쉼표로 여럿)
//   node tools/pairs.mjs --out previews/visual-overhaul
// 결과: <out>/<이름>-before.png, <이름>-after.png (화면 2배 960×540, quality=high 고정), 둘을 나란히 붙인 <이름>-pair.png
// 이전 버전에 없는 주소 옵션(예: wreck=3)은 이전 버전이 무시하므로, '이전'은 손상이 없는 같은 자리가 된다.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview, build } from 'vite';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = { base: 'HEAD', only: '', out: 'previews/visual-overhaul', tick: 300 };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--base') opt.base = argv[++i];
  else if (argv[i] === '--only') opt.only = argv[++i];
  else if (argv[i] === '--out') opt.out = argv[++i];
}

/** 이름, 주소 (둘 다 같은 주소. tick: 멈출 틱) */
const SHOTS = [
  { name: 'wreck-factory-1', q: 'scene=stage&cam=60&wreck=1' },
  { name: 'wreck-factory-2', q: 'scene=stage&cam=60&wreck=2' },
  { name: 'wreck-factory-3', q: 'scene=stage&cam=60&wreck=3' },
  { name: 'wreck-docks-crane', q: 'scene=stage&cam=860&wreck=3' },
  { name: 'wreck-docks-crane-2', q: 'scene=stage&cam=860&wreck=2' },
  { name: 'wreck-docks-dock', q: 'scene=stage&cam=1160&wreck=3' },
  { name: 'wreck-pier', q: 'scene=stage&cam=1560&wreck=3' },
  { name: 'wreck-plaza-west', q: 'scene=stage&cam=2560&wreck=3' },
  { name: 'wreck-plaza-east', q: 'scene=stage&cam=3480&wreck=3' },
  { name: 'wreck-park', q: 'scene=stage&cam=4460&wreck=3' },
  { name: 'wreck-elrail', q: 'scene=stage&cam=4840&wreck=3' },
  { name: 'wreck-elrail-2', q: 'scene=stage&cam=5160&wreck=2' },
  { name: 'wreck-wall', q: 'scene=stage&cam=5860&wreck=3' },
  { name: 'wreck-crane-upper', q: 'scene=stage&cam=860&camy=120&wreck=3' },
  { name: 'ruin-theater', q: 'scene=stage&cam=2020&ruin=1' },
  // 싸우는 중 (CPU끼리, 같은 시드라 두 버전의 사람 움직임은 같다): 구조물이 부서지는 순간 몇 틱 뒤, 그리고 한참 뒤 잔해·연기
  { name: 'fight-factory', q: 'scene=fight&p1=cpu&seed=3&x=200&p1char=raiden&p2char=edward', tick: 566 },
  { name: 'fight-docks', q: 'scene=fight&p1=cpu&seed=3&x=1200&p1char=raiden&p2char=edward', tick: 510 },
  { name: 'fight-docks-later', q: 'scene=fight&p1=cpu&seed=3&x=1200&p1char=raiden&p2char=edward', tick: 760 },
  { name: 'fight-docks-eo', q: 'scene=fight&p1=cpu&seed=4&x=1200&p1char=eunwoo&p2char=oscar', tick: 512 },
  { name: 'fight-elrail', q: 'scene=fight&p1=cpu&seed=4&x=5000&p1char=raiden&p2char=edward', tick: 470 },
  { name: 'fight-plaza', q: 'scene=fight&p1=cpu&seed=4&x=2700&p1char=eunwoo&p2char=oscar', tick: 312 },
  { name: 'fight-wall', q: 'scene=fight&p1=cpu&seed=4&x=5900&p1char=raiden&p2char=edward', tick: 456 },
].filter((s) => !opt.only || opt.only.split(',').includes(s.name));

const root = resolve('.');
const tmp = resolve('out/pairs-base');
mkdirSync(opt.out, { recursive: true });
console.log(`이전 버전 ${opt.base} 빌드 중…`);
if (existsSync(tmp)) {
  try { execSync(`git worktree remove --force ${tmp}`, { stdio: 'ignore' }); } catch { rmSync(tmp, { recursive: true, force: true }); }
}
execSync('git worktree prune', { stdio: 'ignore' });
execSync(`git worktree add --detach ${tmp} ${opt.base}`, { stdio: 'ignore' });
if (!existsSync(`${tmp}/node_modules`)) symlinkSync(resolve('node_modules'), `${tmp}/node_modules`);
await build({ root: tmp, logLevel: 'error', build: { outDir: `${tmp}/dist`, emptyOutDir: true } });
console.log('지금 버전 빌드 중…');
await build({ root, logLevel: 'error', build: { outDir: resolve('out/pairs-new'), emptyOutDir: true } });
const baseServer = await preview({ root: tmp, preview: { port: 4311, strictPort: true }, build: { outDir: `${tmp}/dist` }, logLevel: 'error' });
const newServer = await preview({ root, preview: { port: 4312, strictPort: true }, build: { outDir: resolve('out/pairs-new') }, logLevel: 'error' });
const browser = await chromium.launch();

async function shoot(url, tick) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { timeout: 600000 });
  await page.waitForFunction((t) => window.__debug?.tick >= t, tick, { timeout: 600000 });
  await page.waitForTimeout(300);
  const png = await page.locator('#screen').screenshot();
  await page.close();
  if (errors.length) throw new Error(`${url}: ${errors.join(' / ')}`);
  return png;
}

let failed = 0;
for (const s of SHOTS) {
  const tick = s.tick ?? opt.tick;
  const q = `?${s.q}&quality=high&stopAt=${tick}&ff=1`;
  try {
    const a = await shoot(`http://localhost:4311/${q}`, tick);
    const b = await shoot(`http://localhost:4312/${q}`, tick);
    writeFileSync(`${opt.out}/${s.name}-before.png`, a);
    writeFileSync(`${opt.out}/${s.name}-after.png`, b);
    // 나란히 (왼쪽 이전, 오른쪽 지금)
    const page = await browser.newPage();
    const pair = await page.evaluate(async ([x, y]) => {
      const load = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        return img;
      };
      const [l, r] = [await load(x), await load(y)];
      const c = document.createElement('canvas');
      c.width = l.width + r.width + 8;
      c.height = Math.max(l.height, r.height);
      const g = c.getContext('2d');
      g.fillStyle = '#808080';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(l, 0, 0);
      g.drawImage(r, l.width + 8, 0);
      return c.toDataURL('image/png').split(',')[1];
    }, [a.toString('base64'), b.toString('base64')]);
    await page.close();
    writeFileSync(`${opt.out}/${s.name}-pair.png`, Buffer.from(pair, 'base64'));
    console.log(`OK  ${s.name}`);
  } catch (e) {
    failed++;
    console.log(`NG  ${s.name}: ${e.message}`);
  }
}
await browser.close();
baseServer.httpServer.close();
newServer.httpServer.close();
execSync(`git worktree remove --force ${tmp}`, { stdio: 'ignore' });
process.exit(failed ? 1 : 0);
