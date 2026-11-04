// 라이덴 길티기어식 이펙트 확인 (동작연출지침서 14-8). 이전 버전(--base, 기본 origin/main)과 지금 버전을 같은 입력으로 찍어 PR 자료를 만든다.
//   node tools/ggcheck.mjs [--base origin/main] [--out previews/fx/raiden-gg] [--only 1,4,5]
//     → <out>/style-sample.png    스타일 견본: 잽·미들킥·4타·띄우기 피크 정지 화면 + 레퍼런스 세 장 (docs/refs/gg_ref_*.png)
//       <out>/NN-<기술>.gif        동작마다 번호: 왼쪽 이전 · 오른쪽 지금 (같은 장면·같은 틱, 2배, 0.55배 빠르기)
//       <out>/NN-<기술>-peak.png   지금 버전 피크 (2배)
//       <out>/check.md             자체 점검: 1px 선 다발 · 자로 그은 직사각형 · 같은 굵기 평행선 · 공격자 머리·몸통 위 칸
// 피크 = 그 기술이 처음 맞힌 틱 (없으면 판정이 시작한 틱). 파천은 등 뒤로 뚫고 나가는 틱.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { encodeGif } from './gif.mjs';
import { decodePng, encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const opt = { base: 'origin/main', out: 'previews/fx/raiden-gg', only: '', noBase: false, debug: '', dump: '' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--base') opt.base = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--only') opt.only = argv[++i];
  else if (a === '--no-base') opt.noBase = true;
  else if (a === '--debug') opt.debug = argv[++i];
  else if (a === '--dump') opt.dump = argv[++i];
}
mkdirSync(opt.out, { recursive: true });

/** 14-8 라이덴 동작별 표 순서 (번호 = PR의 번호) */
const MOVES = [
  { n: 1, id: 'atk1', name: 'JAB', scene: 'raiden_combo' },
  { n: 2, id: 'atk2', name: 'CROSS', scene: 'raiden_combo' },
  { n: 3, id: 'atk3', name: 'MIDDLE KICK', scene: 'raiden_combo' },
  { n: 4, id: 'atk4', name: 'SUPERMAN PUNCH', scene: 'raiden_combo' },
  { n: 5, id: 'launcher', name: 'LAUNCHER', scene: 'raiden_air' },
  { n: 6, id: 'sweep', name: 'SWEEP', scene: 'raiden_low' },
  { n: 7, id: 'dashAttack', name: 'FLYING KNEE', scene: 'raiden_low' },
  { n: 8, id: 'air1', name: 'AIR JAB', scene: 'raiden_air' },
  { n: 9, id: 'air2', name: 'AIR CROSS', scene: 'raiden_air' },
  { n: 10, id: 'air3', name: 'AIR ROUNDHOUSE', scene: 'raiden_air' },
  { n: 11, id: 'slam', name: 'AXE KICK', scene: 'raiden_slam' },
  { n: 12, id: 'charge', name: 'CHARGE LV4', scene: 'raiden_charge4' },
  { n: 13, id: 'skill2', name: 'HWAGWASAN', scene: 'raiden_hwagwasan' },
  { n: 14, id: 'super', name: 'PACHEON', scene: 'raiden_pacheon' },
].filter((m) => !opt.only || opt.only.split(',').map(Number).includes(m.n));
const SAMPLE = ['atk1', 'atk3', 'atk4', 'launcher'];

// ---------------------------------------------------------------- 그림 도우미 (RGB)
const img = (w, h, fill = 0) => ({ w, h, d: new Uint8Array(w * h * 3).fill(fill) });
function blit(dst, src, ox, oy, scale = 1) {
  for (let y = 0; y < src.h * scale; y++) {
    for (let x = 0; x < src.w * scale; x++) {
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
      const si = (Math.floor(y / scale) * src.w + Math.floor(x / scale)) * 3;
      dst.d.set(src.d.subarray(si, si + 3), (dy * dst.w + dx) * 3);
    }
  }
}
function crop(src, x0, y0, w, h) {
  const o = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = Math.max(0, Math.min(src.w - 1, x0 + x));
    const Y = Math.max(0, Math.min(src.h - 1, y0 + y));
    o.d.set(src.d.subarray((Y * src.w + X) * 3, (Y * src.w + X) * 3 + 3), (y * w + x) * 3);
  }
  return o;
}
/** 넓이 평균으로 줄이기 (레퍼런스) */
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
const save = (file, im) => {
  writeFileSync(file, encodePng(im.w, im.h, im.d));
  console.log(`    ${file} (${im.w}×${im.h})`);
};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const glyphRows = (await vite.ssrLoadModule('/src/render/font.ts')).glyphRows;
const { RAIDEN_GG, RAIDEN_GG_CHARGE, RAIDEN_GG_SUPER } = await vite.ssrLoadModule('/src/data/vfx/raiden.ts');
await vite.close();
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
        dst.d.set(rgb, (dy * dst.w + dx) * 3);
      }
    }
    cx += 4 * scale;
  }
}
const grammarOf = (id) => (id === 'charge' ? RAIDEN_GG_CHARGE[3].grammar : id === 'super' ? RAIDEN_GG_SUPER.burst.grammar : RAIDEN_GG[id]?.grammar) ?? [];

// ---------------------------------------------------------------- 장면 찍기 (이전·지금 각각 한 번 빌드)
const SCENES = {};
for (const file of readdirSync(new URL('./scenes/', import.meta.url)).filter((n) => n.endsWith('.mjs')).sort()) {
  Object.assign(SCENES, (await import(`./scenes/${file}`)).default);
}
const root = resolve('.');
const tmp = resolve('out/ggcheck-base');
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
await build({ root, logLevel: 'error', build: { outDir: resolve('out/ggcheck-new'), emptyOutDir: true } });
const browser = await chromium.launch();
const servers = {
  new: await preview({ root, preview: { port: 4322, strictPort: true }, build: { outDir: resolve('out/ggcheck-new') }, logLevel: 'error' }),
  base: opt.noBase ? null : await preview({ root: tmp, preview: { port: 4321, strictPort: true }, build: { outDir: `${tmp}/dist` }, logLevel: 'error' }),
};

async function run(which, sc) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const stopAt = sc.stopAt ?? 75;
  await page.goto(`${servers[which].resolvedUrls.local[0]}?${sc.q}&stopAt=${stopAt}&ff=1&quality=high`, { timeout: 600000 });
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
  const marks = which === 'new' && (await page.evaluate(() => typeof window.__fxMarks === 'function' && (window.__fxMarks(), true)));
  const frames = [];
  const held = new Set();
  for (const [keys, n] of sc.steps) {
    for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    for (let i = 0; i < n; i++) {
      frames.push(await page.evaluate((mk) => {
        const fr = window.__debug.frame(1);
        const s = window.__fight();
        const v = window.__debug.gl?.view.placed;
        return { ...fr, tick: s.tick, cam: v ? [v.ix, v.iy] : [0, 0], marks: mk ? window.__fxMarks() : null, who: s.fighters.map((x) => ({ x: x.x / 256, y: x.y / 256, mode: x.mode, move: x.move })) };
      }, marks));
    }
  }
  for (const k of held) await page.keyboard.up(k);
  const log = await page.evaluate(() => (window.__animeLog ? window.__animeLog() : []));
  await page.close();
  if (errors.length) throw new Error(`${which} 페이지 오류: ${errors.join(' / ')}`);
  return {
    log,
    frames: frames.map((f) => {
      const raw = Buffer.from(f.data, 'base64');
      const o = img(f.w, f.h);
      for (let i = 0; i < f.w * f.h; i++) {
        const c = f.colors[raw[i]];
        o.d[i * 3] = (c >> 16) & 255;
        o.d[i * 3 + 1] = (c >> 8) & 255;
        o.d[i * 3 + 2] = c & 255;
      }
      return { ...o, tick: f.tick, cam: f.cam, who: f.who, marks: f.marks ? Buffer.from(f.marks, 'base64') : null };
    }),
  };
}

const shots = {};
for (const sc of [...new Set(MOVES.map((m) => m.scene))]) {
  console.log(`장면 ${sc} …`);
  shots[sc] = { new: await run('new', SCENES[sc]), base: opt.noBase ? null : await run('base', SCENES[sc]) };
}
await browser.close();
await new Promise((r) => servers.new.httpServer.close(r));
if (servers.base) await new Promise((r) => servers.base.httpServer.close(r));
if (!opt.noBase) {
  try { execSync(`git worktree remove --force ${tmp}`, { stdio: 'ignore' }); } catch { /* 남겨 둔다 */ }
}

// ---------------------------------------------------------------- 기술마다 피크
const W = 480;
const H = 270;
for (const m of MOVES) {
  const sh = shots[m.scene].new;
  const hit = sh.log.find((l) => l.move === m.id && l.impact);
  const sw = sh.log.find((l) => l.move === m.id && l.swing);
  const e = hit ?? sw;
  m.idx = e ? sh.frames.findIndex((f) => f.tick === e.tick) : -1;
  m.at = e?.at;
  if (m.idx < 0) console.log(`NG  ${m.n} ${m.id}: 피크를 찾지 못함`);
}

/** 피크 둘레 자르기: 공격자와 맞은 점 사이 가운데, 바닥이 아래쪽에 오게 */
function windowOf(m, f, w, h) {
  const at = m.at ?? {};
  const ax = (at.ax ?? f.who[0].x) - f.cam[0];
  const px = (at.px ?? at.dx ?? at.ax ?? f.who[1].x) - f.cam[0];
  const ay = (at.ay ?? 0) - f.cam[1];
  const cx = Math.round((ax + px) / 2);
  const x0 = Math.max(0, Math.min(W - w, cx - Math.round(w / 2)));
  const y0 = Math.max(0, Math.min(H - h, Math.round(ay) + 34 - h));
  return [x0, y0];
}

// ---------------------------------------------------------------- 자체 점검 (14-7·14-8 금지 모양)
/** 이펙트 칸 묶음: 1px 굵기로 길게 이어진 것 (1px 선), 그 방향, 수평·수직 곧은 테두리 (자로 그은 직사각형) */
function checkFrame(f, at) {
  if (!f.marks) return null;
  const M = f.marks;
  // 보이는 이펙트 칸: 밤 배경에 묻히는 어두운 칸(잉크 #46081e·번개 테두리)은 빼고 센다.
  // 밝은 몸이 1px인데 어두운 테두리 때문에 굵게 세어지는 일이 없게 (1px 선 검사는 이 칸으로)
  const B = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!M[i]) continue;
    const l = 0.299 * f.d[i * 3] + 0.587 * f.d[i * 3 + 1] + 0.114 * f.d[i * 3 + 2];
    if (l >= 45) B[i] = 1;
  }
  const seen = new Uint8Array(W * H);
  const thin = [];
  let straight = 0;
  let body = 0;
  const cam = f.cam;
  const seg = (px, py, ax, ay, bx, by) => {
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(px - ax - vx * t, py - ay - vy * t);
  };
  for (let s = 0; s < W * H; s++) {
    if (!B[s] || seen[s]) continue;
    const q = [s];
    seen[s] = 1;
    const comp = [];
    while (q.length) {
      const i = q.pop();
      comp.push(i);
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const X = x + dx;
        const Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X;
        if (B[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    // 굵기: 칸마다 가로·세로 중 짧은 쪽 이어짐 (1이면 1px 선 위)
    let fat = 0;
    let minX = W;
    let maxX = 0;
    let minY = H;
    let maxY = 0;
    for (const i of comp) {
      const x = i % W;
      const y = (i / W) | 0;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const h = (B[i - 1] && x > 0 ? 1 : 0) + (B[i + 1] && x < W - 1 ? 1 : 0);
      const v = (y > 0 && B[i - W] ? 1 : 0) + (y < H - 1 && B[i + W] ? 1 : 0);
      if (h === 2 && v === 2) fat++;
    }
    const len = Math.hypot(maxX - minX, maxY - minY);
    if (len >= 24 && fat === 0) thin.push({ len: Math.round(len), ang: Math.round((Math.atan2(maxY - minY, maxX - minX) * 180) / Math.PI), n: comp.length, box: [minX, minY, maxX, maxY] });
  }
  // 자로 그은 직사각형: 같은 줄에서 이펙트 칸 위·아래 경계가 30칸 넘게 곧게 이어진 곳 (위아래 모두). 자리(화면 칸)를 남긴다
  const where = [];
  const boxes = [];
  for (let y = 1; y < H - 1; y++) {
    let runTop = 0;
    let runBot = 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const top = M[i] && !M[i - W];
      const bot = M[i] && !M[i + W];
      runTop = top ? runTop + 1 : 0;
      runBot = bot ? runBot + 1 : 0;
      if (runTop === 30) { straight++; where.push(`${x - 29},${y}↑`); boxes.push([x - 29, y, x, y]); }
      if (runBot === 30) { straight++; where.push(`${x - 29},${y}↓`); boxes.push([x - 29, y, x, y]); }
    }
  }
  // 공격자 몸통(엉덩이 → 목 선에서 4px 안)·머리(7px 안) 위 이펙트 칸
  if (at && at.hx !== undefined) {
    for (let i = 0; i < W * H; i++) {
      if (!M[i]) continue;
      const x = i % W;
      const y = (i / W) | 0;
      if (seg(x, y, at.hx - cam[0], at.hy - cam[1], at.nx - cam[0], at.ny - cam[1]) <= 4 || Math.hypot(x - (at.kx - cam[0]), y - (at.ky - cam[1])) <= 7) body++;
    }
  }
  // 같은 굵기 평행선: 1px 선 셋 이상이 같은 방향 (±6도)
  let parallel = 0;
  for (const a of thin) {
    const same = thin.filter((b) => Math.abs(b.ang - a.ang) <= 6).length;
    parallel = Math.max(parallel, same);
  }
  return { thin: thin.length, thinMax: thin.reduce((v, t) => Math.max(v, t.len), 0), parallel, straight, body, where, boxes: [...thin.map((t) => t.box), ...boxes] };
}

/** 문제 자리 확대 (--debug): 이펙트 칸은 그 색, 나머지는 어둡게, 문제 상자는 초록 */
function debugShot(m, f, d, boxes) {
  mkdirSync(opt.debug, { recursive: true });
  const b = boxes[0];
  const cw = 200;
  const ch = 120;
  const x0 = Math.max(0, Math.min(W - cw, Math.round((b[0] + b[2]) / 2 - cw / 2)));
  const y0 = Math.max(0, Math.min(H - ch, Math.round((b[1] + b[3]) / 2 - ch / 2)));
  const o = img(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y0 + y) * W + x0 + x;
    const k = (y * cw + x) * 3;
    const dim = f.marks[i] ? 1 : 0.3;
    for (let c = 0; c < 3; c++) o.d[k + c] = Math.round(f.d[i * 3 + c] * dim);
  }
  for (const bb of boxes) {
    for (let x = bb[0] - 1; x <= bb[2] + 1; x++) for (const y of [bb[1] - 2, bb[3] + 2]) {
      const X = x - x0;
      const Y = y - y0;
      if (X >= 0 && Y >= 0 && X < cw && Y < ch) o.d.set([40, 255, 80], (Y * cw + X) * 3);
    }
  }
  const big = img(cw * 4, ch * 4);
  blit(big, o, 0, 0, 4);
  save(`${opt.debug}/${String(m.n).padStart(2, '0')}-${m.id}-d${d}.png`, big);
}

// --dump 14:24,4:10 → 그 기술 피크 +틱 화면 전체를 이펙트 칸 표시와 함께 (이펙트 칸은 그 색, 나머지 어둡게)
if (opt.dump) {
  for (const spec of opt.dump.split(',')) {
    const [n, d] = spec.split(':').map(Number);
    const m = MOVES.find((x) => x.n === n);
    if (!m || m.idx < 0) continue;
    const f = shots[m.scene].new.frames[m.idx + d];
    if (!f) continue;
    debugShot(m, f, d, [[0, 0, W - 1, H - 1]]);
    const full = img(W * 2, H * 2);
    const o = img(W, H);
    for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) o.d[i * 3 + c] = Math.round(f.d[i * 3 + c] * (f.marks[i] ? 1 : 0.3));
    blit(full, o, 0, 0, 2);
    mkdirSync(opt.debug || 'out/ggdebug', { recursive: true });
    save(`${opt.debug || 'out/ggdebug'}/dump-${String(n).padStart(2, '0')}-${m.id}-d${d}.png`, full);
  }
}

const lines = [];
lines.push('| 번호 | 기술 | 쓴 문법 (14-8) | 1px 선 (24px 넘게) | 같은 방향 1px 선 최대 | 자로 그은 곧은 테두리 (30px 넘게) | 공격자 몸통·머리 위 칸 (피크) |');
lines.push('| --- | --- | --- | --- | --- | --- | --- |');
for (const m of MOVES) {
  if (m.idx < 0) continue;
  const sh = shots[m.scene].new;
  let thin = 0;
  let thinMax = 0;
  let parallel = 0;
  let straight = 0;
  let body = 0;
  let where = '';
  // 피크 틱부터 이펙트가 사라질 때까지 (얇아지는 동안 긴 1px 선이 남지 않는지도 본다)
  for (let d = 0; d <= (m.id === 'super' ? 34 : 18); d++) {
    const f = sh.frames[m.idx + d];
    if (!f) continue;
    const r = checkFrame(f, m.at);
    if (!r) continue;
    thin = Math.max(thin, r.thin);
    thinMax = Math.max(thinMax, r.thinMax);
    parallel = Math.max(parallel, r.parallel);
    if (r.straight > straight) where = `+${d}틱 ${r.where.slice(0, 2).join(' ')}`;
    if (opt.debug && r.boxes.length) debugShot(m, f, d, r.boxes);
    straight = Math.max(straight, r.straight);
    if (d === 0) body = r.body;
  }
  m.check = { thin, parallel, straight, body };
  lines.push(`| ${m.n} | ${m.id} | ${grammarOf(m.id).join(' · ')} | ${thin}${thin ? ` (가장 긴 ${thinMax}px)` : ''} | ${parallel} | ${straight}${straight ? ` (${where})` : ''} | ${body} |`);
}
const md = ['## 라이덴 길티기어식 이펙트 자체 점검 (지금 버전, 피크 틱부터 사라질 때까지 18틱, 파천 34틱)', '', '- 1px 선: 보이는 이펙트 칸(밤 배경에 묻히는 어두운 잉크·테두리 칸은 뺀다) 묶음 중, 상하좌우가 모두 이펙트인 칸(가로·세로 3칸 굵기)이 하나도 없이 24px 넘게 이어진 것. 2px 띠도 1px 선으로 센다', '- 자로 그은 곧은 테두리: 같은 줄에서 이펙트 위·아래 경계가 30칸 넘게 곧게 이어진 곳 수', '- 공격자 몸통·머리 위 칸: 피크 틱에 공격자 몸통(엉덩이 → 목 선 4px 안)·머리(7px 안)에 칠한 이펙트 칸 (뒤 겹이면 몸이 위에 그려진다)', '', ...lines, ''].join('\n');
writeFileSync(`${opt.out}/check.md`, md);
console.log(md);

// ---------------------------------------------------------------- 동작마다 전후 GIF (2배, 0.55배 빠르기) + 지금 피크 PNG
function gif(file, list, delay) {
  const OW = list[0].w;
  const OH = list[0].h;
  const palette = [];
  const index = new Map();
  const out = list.map((f) => {
    const o = new Uint8Array(OW * OH);
    for (let i = 0; i < OW * OH; i++) {
      const c = (f.d[i * 3] << 16) | (f.d[i * 3 + 1] << 8) | f.d[i * 3 + 2];
      let k = index.get(c);
      if (k === undefined) {
        if (palette.length >= 256) {
          let best = 0;
          let bd = Infinity;
          palette.forEach((p, j) => {
            const d = (((p >> 16) & 255) - ((c >> 16) & 255)) ** 2 + (((p >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((p & 255) - (c & 255)) ** 2;
            if (d < bd) { bd = d; best = j; }
          });
          k = best;
        } else {
          k = palette.length;
          palette.push(c);
        }
        index.set(c, k);
      }
      o[i] = k;
    }
    return o;
  });
  const delays = out.map(() => delay);
  delays[delays.length - 1] += 60;
  const buf = encodeGif(OW, OH, palette, out, delays);
  writeFileSync(file, buf);
  console.log(`    ${file} (${OW}×${OH}, ${out.length}장, ${(buf.length / 1024).toFixed(0)}KB)`);
}
const CW = 260;
const CH = 150;
const S = 2;
for (const m of MOVES) {
  if (m.idx < 0) continue;
  const sh = shots[m.scene];
  const f0 = sh.new.frames[m.idx];
  const [x0, y0] = windowOf(m, f0, CW, CH);
  const tag = `${String(m.n).padStart(2, '0')}-${m.id}`;
  const peak = img(CW * S, CH * S);
  blit(peak, crop(f0, x0, y0, CW, CH), 0, 0, S);
  save(`${opt.out}/${tag}-peak.png`, peak);
  const from = Math.max(0, m.idx - 6);
  const to = Math.min(sh.new.frames.length, m.idx + (m.id === 'super' ? 34 : 18));
  const list = [];
  for (let i = from; i < to; i++) {
    const o = img(CW * S * (sh.base ? 2 : 1) + (sh.base ? 6 : 0), CH * S + 16, 24);
    if (sh.base) blit(o, crop(sh.base.frames[i] ?? sh.base.frames[sh.base.frames.length - 1], x0, y0, CW, CH), 0, 16, S);
    blit(o, crop(sh.new.frames[i], x0, y0, CW, CH), sh.base ? CW * S + 6 : 0, 16, S);
    text(o, `${m.n} ${m.name}${sh.base ? ' - BEFORE' : ''}`, 4, 3, 2, [235, 235, 240]);
    if (sh.base) text(o, `${m.n} ${m.name} - AFTER`, CW * S + 10, 3, 2, [255, 200, 210]);
    text(o, `${i - m.idx >= 0 ? '+' : ''}${i - m.idx}`, o.w - 40, 3, 2, [180, 180, 190]);
    list.push(o);
  }
  gif(`${opt.out}/${tag}.gif`, list, 3);
}

// ---------------------------------------------------------------- 스타일 견본: 레퍼런스 세 장 (위) + 잽·미들킥·4타·띄우기 피크 (아래 2×2)
{
  const refs = ['gg_ref_1_fire', 'gg_ref_2_hit', 'gg_ref_3_counter'].map((n) => decodePng(readFileSync(`docs/refs/${n}.png`)));
  const RH = 300;
  const pk = SAMPLE.map((id) => MOVES.find((m) => m.id === id)).filter((m) => m && m.idx >= 0);
  if (pk.length) {
    const PW = 400;
    const PH = 225;
    const GAP = 8;
    const refW = refs.map((r) => Math.round((r.w * RH) / r.h));
    const top = refW.reduce((a, b) => a + b, 0) + GAP * (refs.length - 1);
    const width = Math.max(top, PW * 2 * 2 + GAP);
    const o = img(width, 24 + RH + GAP + 24 + (PH * 2 + 24) * 2 + GAP, 18);
    let x = 0;
    refs.forEach((r, k) => {
      blit(o, shrink(r, refW[k], RH), x, 24, 1);
      text(o, `REF ${k + 1}`, x + 4, 5, 3, [235, 235, 240]);
      x += refW[k] + GAP;
    });
    pk.forEach((m, k) => {
      const sh = shots[m.scene].new;
      const f0 = sh.frames[m.idx];
      const [x0, y0] = windowOf(m, f0, PW, PH);
      const ox = (k % 2) * (PW * 2 + GAP);
      const oy = 24 + RH + GAP + Math.floor(k / 2) * (PH * 2 + 24) + 24;
      blit(o, crop(f0, x0, y0, PW, PH), ox, oy, 2);
      text(o, `${m.n} ${m.name} - PEAK`, ox + 4, oy - 19, 3, [255, 200, 210]);
    });
    save(`${opt.out}/style-sample.png`, o);
  }
}
