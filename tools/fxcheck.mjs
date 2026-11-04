// 이펙트 확인 (동작연출지침서 14-6). 한 장면을 이전 버전과 지금 버전으로 같은 입력으로 찍어 PR에 붙일 자료를 만든다.
//   npm run fxcheck -- raiden_combo --moves atk1,atk2,atk3,atk4 --look src/render/chars/raiden-anime.ts:RAIDEN_LOOK --out previews/fx/raiden
//     → <out>/<장면>-vs-ref.png        1) 피크 프레임과 레퍼런스(docs/refs/이펙트_레퍼런스_애니격투.png)를 나란히 (2배)
//       <out>/<장면>-numbers.md        2) 피크 숫자 표 (14-3 기준과 견줌: 이 화면은 480×270이라 지침서 값 × 1.5)
//       <out>/<장면>-gray.png          3) 피크 프레임 흑백 (이펙트 속 캐릭터 실루엣이 읽히는지)
//       <out>/<장면>-before-after.gif  4) 같은 장면 이전(왼쪽)·지금(오른쪽) (1배, 실제 빠르기)
//       <out>/<장면>-after-slow.gif       지금 버전만 느리게 (2배, 1/3 빠르기: 14-2 시간표를 본다)
//       <out>/<장면>-peaks.png, -peaks-before.png  기술마다 피크 프레임 (지금·이전, 2배)
//   npm run fxcheck -- --swatch --look src/render/chars/raiden-anime.ts:RAIDEN_LOOK --name raiden --out previews/fx/raiden
//     → <out>/<name>-swatch.png  14-4 색표 견본 (4색 띠 + 그 색으로 그린 띠 하나, 4배)
// 이전 버전 = --base (기본 origin/main). --no-base면 지금 버전만.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { encodeGif } from './gif.mjs';
import { encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const opt = { base: 'origin/main', noBase: false, moves: '', out: 'out/fxcheck', swatch: false, look: '', name: '' };
let sceneName = '';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--base') opt.base = argv[++i];
  else if (a === '--no-base') opt.noBase = true;
  else if (a === '--moves') opt.moves = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--swatch') opt.swatch = true;
  else if (a === '--look') opt.look = argv[++i];
  else if (a === '--name') opt.name = argv[++i];
  else sceneName = a;
}
mkdirSync(opt.out, { recursive: true });

// ---------------------------------------------------------------- 그림 도우미 (RGB 버퍼)
const img = (w, h, fill = 0) => ({ w, h, d: new Uint8Array(w * h * 3).fill(fill) });
function blit(dst, src, ox, oy, scale = 1, map = null) {
  for (let y = 0; y < src.h * scale; y++) {
    for (let x = 0; x < src.w * scale; x++) {
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
      const si = (Math.floor(y / scale) * src.w + Math.floor(x / scale)) * 3;
      const di = (dy * dst.w + dx) * 3;
      let r = src.d[si];
      let g = src.d[si + 1];
      let b = src.d[si + 2];
      if (map) [r, g, b] = map(r, g, b);
      dst.d[di] = r;
      dst.d[di + 1] = g;
      dst.d[di + 2] = b;
    }
  }
}
const gray = (r, g, b) => {
  const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return [l, l, l];
};
function crop(src, x0, y0, w, h) {
  const o = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y0 + y) * src.w + x0 + x) * 3;
    const di = (y * w + x) * 3;
    o.d[di] = src.d[si];
    o.d[di + 1] = src.d[si + 1];
    o.d[di + 2] = src.d[si + 2];
  }
  return o;
}
const save = (file, im) => {
  writeFileSync(file, encodePng(im.w, im.h, im.d));
  console.log(`    ${file} (${im.w}×${im.h})`);
};
/** 3×5 도트 글자 (src/render/font.ts와 같은 글꼴): 글자표는 vite로 불러온다 */
let glyphRows = null;
function text(dst, s, x, y, scale, rgb) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const rows = glyphRows(ch);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      if (!(rows[r] & (4 >> c))) continue;
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
        const dx = cx + c * scale + xx;
        const dy = y + r * scale + yy;
        if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
        const i = (dy * dst.w + dx) * 3;
        dst.d[i] = rgb[0];
        dst.d[i + 1] = rgb[1];
        dst.d[i + 2] = rgb[2];
      }
    }
    cx += 4 * scale;
  }
}
/** PNG 읽기 (8비트 RGB/RGBA, 비월 없음): 레퍼런스 그림 */
function readPng(file) {
  const buf = readFileSync(file);
  let p = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const out = img(w, h);
  const stride = w * bpp;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out.d[(y * w + x) * 3 + k] = line[x * bpp + k];
    prev = line;
  }
  return out;
}
/** 넓이 평균으로 줄이기 (레퍼런스 640×360 → 480×270) */
function shrink(src, w, h) {
  const o = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor((x * src.w) / w);
    const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.w) / w));
    const y0 = Math.floor((y * src.h) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.h) / h));
    const acc = [0, 0, 0];
    let n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      for (let k = 0; k < 3; k++) acc[k] += src.d[(yy * src.w + xx) * 3 + k];
      n++;
    }
    for (let k = 0; k < 3; k++) o.d[(y * w + x) * 3 + k] = Math.round(acc[k] / n);
  }
  return o;
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
glyphRows = (await vite.ssrLoadModule('/src/render/font.ts')).glyphRows;
const pal = await vite.ssrLoadModule('/src/render/palette.ts');
const hexOf = (c) => {
  const r = c & 255;
  const g = (c >>> 8) & 255;
  const b = (c >>> 16) & 255;
  return [r, g, b];
};

/** 캐릭터 색표 (--look 파일:내보낸 이름) */
const [lookFile, lookExp] = (opt.look || ':').split(':');
const look = opt.look ? (await vite.ssrLoadModule(`/${lookFile}`))[lookExp] : null;
const toHex = (rgb) => `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`;

// ---------------------------------------------------------------- 색 견본 (14-4)
if (opt.swatch) {
  const exp = lookExp;
  const A = await vite.ssrLoadModule('/src/vfx/anime/index.ts');
  const steps = [['CORE', look.ramp.core], ['MAIN', look.ramp.main], ['DEEP', look.ramp.deep], ['RIM', look.ramp.rim]];
  const nameOf = (rgb) => Object.entries(pal.COLORS).find(([, v]) => typeof v === 'string' && v.toLowerCase() === `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`)?.[0] ?? '';
  // 1배 그림 240×120: 위 4색 칸 (60×44), 아래 그 색으로 그린 띠 (일반 등급 잽 모양)
  const W = 240;
  const H = 128;
  const base = img(W, H);
  for (let i = 0; i < W * H; i++) base.d.set([14, 16, 30], i * 3);
  steps.forEach(([label, c], k) => {
    const rgb = hexOf(c);
    for (let y = 8; y < 44; y++) for (let x = 8 + k * 58; x < 8 + k * 58 + 52; x++) base.d.set(rgb, (y * W + x) * 3);
    text(base, label, 8 + k * 58, 47, 1, [200, 200, 210]);
    text(base, `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`, 8 + k * 58, 54, 1, [150, 150, 165]);
  });
  // 띠: 공용 부품으로 그린다 (판정 상자 = 머리)
  const fr = { w: W, h: H, ox: 0, oy: 0, color: new Uint32Array(W * H), light: new Uint32Array(W * H), mark: new Uint8Array(W * H), box: [W, H, -1, -1] };
  const list = [];
  A.animeSwing((fx) => list.push(fx), look, { grade: 'normal', path: 'line', len: 150, width: 26 }, { x: 33, y: -40, w: 50, h: 12 }, { x: 100, y: 134, floor: 140, facing: 1 }, 7);
  for (const fx of list) fx.draw(fr, 'back');
  for (let i = 0; i < W * H; i++) {
    const c = fr.color[i];
    if (c >>> 24 && Math.floor(i / W) > 64) base.d.set(hexOf(c), i * 3);
  }
  const out = img(W * 4, H * 4);
  blit(out, base, 0, 0, 4);
  const name = opt.name || exp.toLowerCase();
  save(`${opt.out}/${name}-swatch.png`, out);

  // 부품 시트: 공용 부품을 하나씩 (이 캐릭터 색표로). 칸 200×110, 2배
  const CW = 200;
  const CH = 110;
  const cells = [];
  const cell = (label, draw) => {
    const c = img(CW, CH);
    for (let i = 0; i < CW * CH; i++) c.d.set([14, 16, 30], i * 3);
    const fr2 = { w: CW, h: CH, ox: 0, oy: 0, color: new Uint32Array(CW * CH), light: new Uint32Array(CW * CH), mark: new Uint8Array(CW * CH), box: [CW, CH, -1, -1] };
    draw(fr2);
    for (let i = 0; i < CW * CH; i++) if (fr2.color[i] >>> 24) c.d.set(hexOf(fr2.color[i]), i * 3);
    text(c, label, 4, 4, 1, [210, 210, 220]);
    cells.push(c);
  };
  const SW = await vite.ssrLoadModule('/src/vfx/anime/sweep.ts');
  const BD = await vite.ssrLoadModule('/src/vfx/anime/bands.ts');
  const box = { x: 33, y: -40, w: 50, h: 12 };
  const who = { x: 70, y: 98, floor: 104, facing: 1 };
  const rangeFn = (X, Y) => { const lx = X - who.x; const ly = Y - who.y; return lx >= box.x && lx <= box.x + box.w && ly >= box.y && ly <= box.y + box.h; };
  const path = [[who.x + box.x + box.w - 150, who.y - 34], [who.x + box.x + box.w, who.y - 34]];
  const sweepOnly = SW.sweep({ path, width: 26, taper: 0.55, range: rangeFn });
  const paint = (fr2, fn) => {
    for (let c = 0; c < sweepOnly.n; c++) {
      const j = sweepOnly.at[c];
      const X = sweepOnly.x0 + (j % sweepOnly.w);
      const Y = sweepOnly.y0 + Math.floor(j / sweepOnly.w);
      const col = fn(c);
      if (col === null || X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
      fr2.color[Y * CW + X] = col >>> 0;
    }
  };
  cell('1 SWEEP', (fr2) => paint(fr2, (c) => (Math.abs(sweepOnly.v[c]) <= sweepOnly.hw[sweepOnly.s[c]] ? look.ramp.deep : null)));
  cell('2 BANDS', (fr2) => paint(fr2, (c) => {
    const k = sweepOnly.s[c];
    const E = sweepOnly.hw[k];
    const av = Math.abs(sweepOnly.v[c]);
    if (av > E) return null;
    const st = BD.stepOf(sweepOnly.rd[c], av, E, 2, 2, 0);
    return BD.colorOf(look.ramp, st);
  }));
  const bandAt = (fr2, t, tail, fil = false) => {
    const l2 = [];
    A.animeSwing((fx) => l2.push(fx), fil ? look : { ...look, filaments: [0, 0], tail }, { grade: 'normal', path: 'line', len: 150, width: 26 }, box, who, 7);
    const band = l2[0];
    band.update(t / 60);
    band.draw(fr2, 'back');
  };
  cell('3 TEAR 0', (fr2) => bandAt(fr2, 0, look.tail));
  cell('3 TEAR 5', (fr2) => bandAt(fr2, 5, look.tail));
  cell('4 SPEED', (fr2) => {
    const sl = A.speedLines({ x: 110, y: 60, dir: 0, count: 14, ticks: 6, len: [60, 300], spread: 40, reach: 160, colors: [look.ramp.core, look.ramp.main, look.ramp.rim], seed: 3 });
    sl.update(1 / 60);
    sl.draw(fr2, 'back');
  });
  cell('5 SPIKES', (fr2) => {
    const sp = A.spikes({ x: 100, y: 60, dir: 0, count: 7, len: [36, 72], white: look.ramp.core, rim: look.ramp.rim, seed: 5 });
    sp.draw(fr2, 'front');
  });
  cell('7 EMBERS', (fr2) => {
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push([30 + k * 17, 60]);
    const em = A.embers({ from: pts, count: 26, dir: 0, colors: [look.ramp.core, look.ramp.main, look.ramp.rim, look.ramp.deep], kind: look.ember, born: [0, 3], life: [8, 14], seed: 11 });
    em.update(5 / 60);
    em.draw(fr2, 'back');
  });
  cell('BAND+FIL', (fr2) => bandAt(fr2, 0, look.tail, true));
  const PC = 4;
  const sheet = img(PC * (CW + 2) - 2, Math.ceil(cells.length / PC) * (CH + 2) - 2, 40);
  cells.forEach((c, k) => blit(sheet, c, (k % PC) * (CW + 2), Math.floor(k / PC) * (CH + 2), 1));
  const big = img(sheet.w * 2, sheet.h * 2);
  blit(big, sheet, 0, 0, 2);
  save(`${opt.out}/${name}-parts.png`, big);
  console.log('    색:', steps.map(([l, c]) => `${l} ${nameOf(hexOf(c))}`).join(' · '));
  await vite.close();
  process.exit(0);
}

// ---------------------------------------------------------------- 장면 찍기
const SCENES = {};
for (const file of readdirSync(new URL('./scenes/', import.meta.url)).filter((n) => n.endsWith('.mjs')).sort()) {
  Object.assign(SCENES, (await import(`./scenes/${file}`)).default);
}
const sc = SCENES[sceneName];
if (!sc) {
  console.log(`장면 이름: ${Object.keys(SCENES).join(', ')}`);
  process.exit(1);
}
const moves = opt.moves ? opt.moves.split(',') : [];

const root = resolve('.');
const tmp = resolve('out/fxcheck-base');
if (!opt.noBase) {
  console.log(`이전 버전 ${opt.base} 빌드 중…`);
  if (existsSync(tmp)) {
    try { execSync(`git worktree remove --force ${tmp}`, { stdio: 'ignore' }); } catch { rmSync(tmp, { recursive: true, force: true }); }
  }
  execSync('git worktree prune', { stdio: 'ignore' });
  execSync(`git worktree add --detach ${tmp} ${opt.base}`, { stdio: 'ignore' });
  if (!existsSync(`${tmp}/node_modules`)) symlinkSync(resolve('node_modules'), `${tmp}/node_modules`);
  await build({ root: tmp, logLevel: 'error', build: { outDir: `${tmp}/dist`, emptyOutDir: true } });
}
console.log('지금 버전 빌드 중…');
await build({ root, logLevel: 'error', build: { outDir: resolve('out/fxcheck-new'), emptyOutDir: true } });

const browser = await chromium.launch();
async function run(dir, port) {
  const server = await preview({ root: dir === 'new' ? root : tmp, preview: { port, strictPort: true }, build: { outDir: dir === 'new' ? resolve('out/fxcheck-new') : `${tmp}/dist` }, logLevel: 'error' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const stopAt = sc.stopAt ?? 75;
  await page.goto(`${server.resolvedUrls.local[0]}?${sc.q}&stopAt=${stopAt}&ff=1&quality=high`, { timeout: 600000 });
  await page.waitForFunction((n) => window.__debug?.tick >= n, stopAt, { timeout: 600000 });
  await page.evaluate(() => window.__debug.unstop());
  if (sc.p1 !== undefined) {
    await page.evaluate(([x1, x2, meter, prep]) => {
      const s = window.__fight();
      const [a, b] = s.fighters;
      Object.assign(a, { x: x1 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: 1 });
      Object.assign(b, { x: x2 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: -1 });
      if (meter) a.meter = 300;
      if (prep) new Function('s', prep)(s);
    }, [sc.p1, sc.p2, !!sc.meter, sc.prep ?? '']);
  }
  await page.evaluate((n) => window.__debug.benchTicks(n), sc.settle);
  const frames = [];
  const held = new Set();
  for (const [keys, n] of sc.steps) {
    for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    for (let i = 0; i < n; i++) {
      const f = await page.evaluate(() => {
        const fr = window.__debug.frame(1);
        const s = window.__fight();
        const v = window.__debug.gl?.view.placed;
        return { ...fr, tick: s.tick, cam: v ? [v.ix, v.iy] : [0, 0], who: s.fighters.map((x) => ({ mode: x.mode, move: x.move, t: x.t, x: x.x / 256 })) };
      });
      frames.push(f);
    }
  }
  for (const k of held) await page.keyboard.up(k);
  const log = await page.evaluate(() => (window.__animeLog ? window.__animeLog() : []));
  await page.close();
  await new Promise((r) => server.httpServer.close(r));
  if (errors.length) {
    console.log(`NG  ${dir} 페이지 오류:`, errors.join(' / '));
    process.exit(1);
  }
  // 칸 번호 그림 → RGB
  const rgbFrames = frames.map((f) => {
    const raw = Buffer.from(f.data, 'base64');
    const o = img(f.w, f.h);
    for (let i = 0; i < f.w * f.h; i++) {
      const c = f.colors[raw[i]];
      o.d[i * 3] = (c >> 16) & 255;
      o.d[i * 3 + 1] = (c >> 8) & 255;
      o.d[i * 3 + 2] = c & 255;
    }
    return { ...o, tick: f.tick, cam: f.cam, who: f.who };
  });
  return { frames: rgbFrames, log };
}
const after = await run('new', 4312);
const before = opt.noBase ? null : await run('base', 4311);
await browser.close();
await vite.close();
if (!opt.noBase) {
  try { execSync(`git worktree remove --force ${tmp}`, { stdio: 'ignore' }); } catch { /* 남겨 둔다 */ }
}
const W = after.frames[0].w;
const H = after.frames[0].h;
console.log(`찍음: 지금 ${after.frames.length}장${before ? `, 이전 ${before.frames.length}장` : ''}`);

// ---------------------------------------------------------------- 피크 프레임: 기술마다 맞힌 틱 (없으면 띠가 난 틱)
const peaks = moves.map((m) => {
  const hit = after.log.find((l) => l.move === m && l.impact);
  const sw = after.log.find((l) => l.move === m && l.swing);
  const tick = (hit ?? sw)?.tick;
  const idx = after.frames.findIndex((f) => f.tick === tick);
  return { move: m, idx, tick, swing: sw?.swing, impact: hit?.impact };
});
for (const p of peaks) if (p.idx < 0) console.log(`NG  ${p.move}: 피크 프레임을 찾지 못함`);

// 이펙트 칸 (4색 띠 색과 같은 칸) 재기
const fxRgb = look ? [look.ramp.core, look.ramp.main, look.ramp.deep, look.ramp.rim].map((c) => toHex(hexOf(c))) : [];
function measure(fr, prev) {
  const set = new Set(fxRgb.map((h) => parseInt(h.replace('#', ''), 16)));
  let minX = W;
  let maxX = -1;
  let n = 0;
  const seen = new Map();
  // HUD(위 32줄)는 빼고 잰다
  for (let y = 32; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const c = (fr.d[i] << 16) | (fr.d[i + 1] << 8) | fr.d[i + 2];
    if (!set.has(c)) continue;
    seen.set(c, (seen.get(c) ?? 0) + 1);
    n++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  // 배경 밝기 (이펙트 색이 아닌 칸의 평균 흑백 밝기): 배경 누르기 확인
  const lum = (f) => {
    let acc = 0;
    let k = 0;
    for (let i = 0; i < W * H; i++) {
      const c = (f.d[i * 3] << 16) | (f.d[i * 3 + 1] << 8) | f.d[i * 3 + 2];
      if (set.has(c)) continue;
      acc += 0.299 * f.d[i * 3] + 0.587 * f.d[i * 3 + 1] + 0.114 * f.d[i * 3 + 2];
      k++;
    }
    return acc / Math.max(1, k);
  };
  return { span: maxX >= 0 ? maxX - minX + 1 : 0, px: n, steps: [...seen.values()].filter((v) => v >= 8).length, lum: lum(fr), lumPrev: prev ? lum(prev) : 0 };
}

// ---------------------------------------------------------------- 1) 레퍼런스와 나란히, 피크 모음, 흑백
const ref = shrink(readPng('docs/refs/이펙트_레퍼런스_애니격투.png'), W, H);
const strongest = peaks.filter((p) => p.idx >= 0).sort((a, b) => (b.swing?.len ?? 0) - (a.swing?.len ?? 0))[0];
if (strongest) {
  const o = img(W * 4 + 8, H * 2, 40);
  blit(o, ref, 0, 0, 2);
  blit(o, after.frames[strongest.idx], W * 2 + 8, 0, 2);
  save(`${opt.out}/${sceneName}-vs-ref.png`, o);
}
const okPeaks = peaks.filter((p) => p.idx >= 0);
const cols = 2;
const rows = Math.ceil(okPeaks.length / cols);
for (const [suffix, src, map] of [['peaks', after, null], ['gray', after, gray], ['peaks-before', before, null]]) {
  if (!src) continue;
  const o = img(cols * (W * 2 + 8) - 8, rows * (H * 2 + 8) - 8, 40);
  okPeaks.forEach((p, k) => blit(o, src.frames[p.idx], (k % cols) * (W * 2 + 8), Math.floor(k / cols) * (H * 2 + 8), 2, map));
  save(`${opt.out}/${sceneName}-${suffix}.png`, o);
}

// ---------------------------------------------------------------- 14-2 시간표: 기술마다 맞힌 틱부터 0·1·2·3·4·6·8·10·12·16·20틱 (두 사람 가운데를 240×150으로 잘라 1배)
{
  const OFF = [0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20];
  const CW = 240;
  const CH = 150;
  const o = img(OFF.length * (CW + 2) - 2, okPeaks.length * (CH + 2) - 2, 40);
  okPeaks.forEach((p, r) => {
    const f0 = after.frames[p.idx];
    const mid = (f0.who[0].x + f0.who[1].x) / 2 - f0.cam[0];
    const cx = Math.max(0, Math.min(W - CW, Math.round(mid - CW / 2)));
    const cy = H - CH - 6;
    OFF.forEach((d, c) => {
      const f = after.frames[Math.min(after.frames.length - 1, p.idx + d)];
      blit(o, crop(f, cx, cy, CW, CH), c * (CW + 2), r * (CH + 2), 1);
      text(o, `${d}`, c * (CW + 2) + 3, r * (CH + 2) + 3, 1, [255, 255, 255]);
    });
  });
  save(`${opt.out}/${sceneName}-timeline.png`, o);
}

// ---------------------------------------------------------------- 배경 누르기 (14-1 ⑥): 누르기가 걸린 기술의 맞히기 직전 · 맞힌 틱 · 2틱 뒤 (1배)
{
  const pk = okPeaks.find((p) => p.impact?.press);
  if (pk) {
    const o = img(W * 3 + 8, H, 40);
    [-1, 0, 2].forEach((d, k) => blit(o, after.frames[Math.max(0, pk.idx + d)], k * (W + 4), 0, 1));
    save(`${opt.out}/${sceneName}-press.png`, o);
  }
}

// ---------------------------------------------------------------- 2) 숫자 표
const spec = {
  normal: { len: [72, 144], thick: [15, 30], steps: 3, spikes: [3, 5] },
  strong: { len: [192, 288], thick: [36, 72], steps: 4, spikes: [5, 9], speed: [8, 20], press: [1, 2] },
};
const lines = [];
lines.push(`| 기술 | 등급 | 띠 길이 px (화면 폭 %) | 이펙트 전체 폭 px (%) | 두께 px | 색 단계 (그림에서) | 꼬리 가닥 | 전류 가닥 | 가시 (길이 px) | 속도선 | 잔불 | 배경 누르기 (배경 밝기) | 14-3 |`);
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const p of okPeaks) {
  const m = p.swing ?? {};
  const g = spec[m.grade] ?? spec.normal;
  const fr = after.frames[p.idx];
  const prev = after.frames[Math.max(0, p.idx - 1)];
  const ms = measure(fr, prev);
  const len = Math.round(m.len ?? 0);
  const thick = Math.round(m.thick ?? 0);
  const spikes = p.impact?.spikes ?? 0;
  const pr = p.impact?.press ?? 0;
  const pass = [
    (len >= g.len[0] || ms.span >= g.len[0]) && len <= g.len[1] * 1.1,
    thick >= g.thick[0] && thick <= g.thick[1] * 1.1,
    ms.steps >= g.steps,
    spikes >= g.spikes[0] && spikes <= g.spikes[1],
    !g.speed || (m.speed >= g.speed[0] && m.speed <= g.speed[1]),
    !g.press || (pr >= g.press[0] && pr <= g.press[1]),
  ];
  const ok = pass.every(Boolean);
  const lenTxt = `${len} (${Math.round((len / W) * 100)}%)`;
  const spanTxt = `${ms.span} (${Math.round((ms.span / W) * 100)}%)`;
  const sl = p.impact?.spikeLen ? `${Math.round(p.impact.spikeLen[0])}~${Math.round(p.impact.spikeLen[1])}` : '-';
  const press = pr ? `${pr}틱 (${ms.lumPrev.toFixed(0)} → ${ms.lum.toFixed(0)})` : '-';
  lines.push(`| ${p.move} | ${m.grade === 'strong' ? '강' : '일반'} | ${lenTxt} | ${spanTxt} | ${thick} | ${ms.steps} | ${m.strands ?? '-'} | ${m.filaments ?? '-'} | ${spikes} (${sl}) | ${m.speed || '-'} | ${m.embers ?? '-'} | ${press} | ${ok ? '통과' : `NG (${pass.map((v, i) => (v ? '' : ['길이', '두께', '색', '가시', '속도선', '누르기'][i])).filter(Boolean).join(',')})`} |`);
}
const md = [
  `## ${sceneName} 피크 숫자 (14-3 기준, 이 화면 480×270 = 지침서 320×180 × 1.5)`,
  '',
  '- 일반: 길이 72~144px · 두께 15~30px · 색 3단계 이상 · 가시 3~5 · 잔불',
  '- 강: 전체 길이 화면 폭 40~60% (192~288px) · 두께 36~72px · 4단계 · 속도선 8~20 · 가시 5~9 · 배경 누르기 1~2틱',
  '- 띠 길이 = 머리 + 몸통 + 찢어진 꼬리 (가장 긴 가닥 끝부터), 이펙트 전체 폭 = 피크 프레임에서 띠 4색이 칠한 가장 왼쪽~오른쪽 (가시·속도선 포함)',
  '',
  ...lines,
  '',
].join('\n');
writeFileSync(`${opt.out}/${sceneName}-numbers.md`, md);
console.log(md);

// ---------------------------------------------------------------- 4) GIF: 이전·지금 나란히 (1배), 지금만 느리게 (2배, 둘레 자름)
function gif(file, list, scale, delay, cropBox) {
  const [cx, cy, cw, ch] = cropBox ?? [0, 0, list[0].w, list[0].h];
  const OW = cw * scale;
  const OH = ch * scale;
  const palette = [];
  const index = new Map();
  const out = list.map((f) => {
    const o = new Uint8Array(OW * OH);
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
      const si = ((cy + Math.floor(y / scale)) * f.w + cx + Math.floor(x / scale)) * 3;
      const c = (f.d[si] << 16) | (f.d[si + 1] << 8) | f.d[si + 2];
      let k = index.get(c);
      if (k === undefined) {
        if (palette.length >= 256) {
          // 팔레트가 차면 가장 가까운 색
          let best = 0;
          let bd = Infinity;
          palette.forEach((p, j) => {
            const d = (((p >> 16) & 255) - (c >> 16 & 255)) ** 2 + (((p >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((p & 255) - (c & 255)) ** 2;
            if (d < bd) { bd = d; best = j; }
          });
          k = best;
        } else {
          k = palette.length;
          palette.push(c);
        }
        index.set(c, k);
      }
      o[y * OW + x] = k;
    }
    return o;
  });
  const delays = out.map(() => delay);
  delays[delays.length - 1] += 80;
  const buf = encodeGif(OW, OH, palette, out, delays);
  writeFileSync(file, buf);
  console.log(`    ${file} (${OW}×${OH}, ${out.length}장, ${(buf.length / 1024).toFixed(0)}KB)`);
}
// 장면에서 이펙트가 나는 구간만 (첫 피크 8틱 전 ~ 마지막 피크 30틱 뒤)
const i0 = Math.max(0, Math.min(...okPeaks.map((p) => p.idx)) - 8);
const i1 = Math.min(after.frames.length, Math.max(...okPeaks.map((p) => p.idx)) + 30);
if (before) {
  const pairs = after.frames.slice(i0, i1).map((f, k) => {
    const b = before.frames[i0 + k];
    const o = img(W * 2 + 4, H, 40);
    blit(o, b, 0, 0, 1);
    blit(o, f, W + 4, 0, 1);
    return o;
  });
  gif(`${opt.out}/${sceneName}-before-after.gif`, pairs, 1, 2);
}
gif(`${opt.out}/${sceneName}-after-slow.gif`, after.frames.slice(i0, i1), 2, 6, [40, 60, 400, 190]);
