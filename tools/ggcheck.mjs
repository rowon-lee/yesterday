// 길티기어식 이펙트 확인 (동작연출지침서 14-8·14-2·14-9). 이전 버전(--base, 기본 origin/main)과 지금 버전을 같은 입력으로 찍어 PR 자료를 만든다.
//   node tools/ggcheck.mjs [--char raiden|eunwoo|edward] [--base origin/main] [--out previews/fx/<캐릭터>-gg] [--only 1,4,5] [--drafts]
//     --drafts: 14-9 시안 (4타·차지·스킬·필살기 시안 3개씩)을 ?ggdraft=로 찍어 <out>/drafts.png 한 장으로 (백은우·에드워드)
//     --base-draft atk4:3,super:3: 이전 버전을 그 시안으로 찍는다 (고른 시안의 전후 비교)
//     --compare 4,13: 그 번호 기술마다 전후 비교 PNG (<out>/<번호>-<기술>-compare.png: 위 이전 · 아래 이번, 같은 틱 넷)
//     --sample-compare: 스타일 견본 네 기술의 피크를 이전(왼쪽)·이번(오른쪽) 나란히 한 장 (<out>/sample-compare.png)
//     → <out>/style-sample.png    스타일 견본: 잽·미들킥·4타·띄우기 피크 정지 화면 + 레퍼런스 세 장 (docs/refs/gg_ref_*.png)
//       <out>/NN-<기술>-1x.gif     동작마다 번호: 왼쪽 이전 · 오른쪽 지금, 맞기 20틱 전 ~ 맞은 뒤 45틱 (같은 장면·같은 틱, 2배), 실제 속도
//       <out>/NN-<기술>-half.gif   같은 범위 0.5배속 (틱마다 한 장)
//       <out>/NN-<기술>-peak.png   지금 버전 피크 (맞은 틱 +2: 다 펼쳐진 모습, 2배)
//       <out>/check.md             자체 점검: 1px 선 다발 · 자로 그은 직사각형 · 같은 굵기 평행선 · 같은 그림 정지 (2틱 넘게) · 공격자 머리·몸통 위 칸
// 맞은 틱(0) = 그 기술이 처음 맞힌 틱 (없으면 판정이 시작한 틱). 파천은 등 뒤로 뚫고 나가는 틱. 점검은 −20 ~ +45틱 전부 (동작연출지침서 14-2)
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { encodeGifDelta } from './gif.mjs';
import { decodePng, encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const opt = { char: 'raiden', base: 'origin/main', out: '', only: '', noBase: false, debug: '', dump: '', drafts: false, baseDraft: '', compare: '', sampleCompare: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--char') opt.char = argv[++i];
  else if (a === '--drafts') opt.drafts = true;
  else if (a === '--base') opt.base = argv[++i];
  else if (a === '--base-draft') opt.baseDraft = argv[++i];
  else if (a === '--compare') opt.compare = argv[++i];
  else if (a === '--sample-compare') opt.sampleCompare = true;
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--only') opt.only = argv[++i];
  else if (a === '--no-base') opt.noBase = true;
  else if (a === '--debug') opt.debug = argv[++i];
  else if (a === '--dump') opt.dump = argv[++i];
}
if (!opt.out) opt.out = `previews/fx/${opt.char}-gg`;
mkdirSync(opt.out, { recursive: true });

/** 14-8 라이덴 동작별 표 순서 (번호 = PR의 번호) */
const RAIDEN_MOVES = [
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
/**
 * 백은우 (14-8 형식 동작별 표 순서, 14-9 기법). peak = 다 펼쳐진 모습을 보는 틱 (맞은 틱 기준. 4타는 지연 폭발이 다 핀 틱).
 * 응답·아직 여기 있어는 판정이 없어 사건 틱 (순간이동·나비), 선의는 해제 (세계가 깨지는 틱)가 0
 */
const EUNWOO_MOVES = [
  { n: 1, id: 'atk1', name: 'FLICK', scene: 'eunwoo_ground' },
  { n: 2, id: 'atk2', name: 'BACKHAND', scene: 'eunwoo_ground' },
  { n: 3, id: 'atk3', name: 'PIROUETTE', scene: 'eunwoo_ground' },
  { n: 4, id: 'atk4', name: 'LASH', scene: 'eunwoo_ground', peak: 6 },
  { n: 5, id: 'launcher', name: 'RISING CUT', scene: 'eunwoo_air' },
  { n: 6, id: 'sweep', name: 'LOW SWEEP', scene: 'eunwoo_low' },
  { n: 7, id: 'dashAttack', name: 'THREAD THRUST', scene: 'eunwoo_low' },
  { n: 8, id: 'air1', name: 'AIR FLICK', scene: 'eunwoo_air' },
  { n: 9, id: 'air2', name: 'AIR RISE', scene: 'eunwoo_air' },
  { n: 10, id: 'air3', name: 'AIR SPIN', scene: 'eunwoo_air' },
  { n: 11, id: 'slam', name: 'WIRE SLAM', scene: 'eunwoo_slam', peak: 4 },
  { n: 12, id: 'wallKick', name: 'WALL KICK', scene: 'eunwoo_wallkick' },
  { n: 13, id: 'charge', name: 'BATTO LV3', scene: 'eunwoo_charge', peak: 4 },
  { n: 14, id: 'skill1', name: 'ANSWER', scene: 'eunwoo_skill1', peak: 3 },
  { n: 15, id: 'skill2', name: 'STILL HERE', scene: 'eunwoo_skill2', peak: 8 },
  { n: 16, id: 'super', log: 'superRelease', name: 'GOODWILL RELEASE', scene: 'eunwoo_super', peak: 3 },
];
/** 시안 피크 틱 (시안 1·2·3): 기법이 보이는 틱 (A 임팩트 프레임은 그 틱) */
const EUNWOO_DRAFT_PEAK = { atk4: [6, 5, 6], charge: [4, 1, 4], skill1: [3, 3, 3], skill2: [8, 8, 5], super: [3, 3, 3] };
/**
 * 에드워드 (14-8 형식 동작별 표 순서, 14-9 기법). 3타는 해머가 박힌 바닥이 늦게 터지는 틱 (히트스톱 11 + 진행 4), 띄우기는 덩어리가 솟는 틱,
 * 내려찍기는 착지 (slamLand 사건)가 0. 재현:나는 해머를 세우는 사건, 염동력은 장막 손 (끌어당김)·장막 벽 (밀어냄),
 * 필살기는 잡는 순간 (연출 시작)과 끝 타격 둘 (번호 l = PR에 적는 번호)
 */
const EDWARD_MOVES = [
  { n: 1, id: 'atk1', name: 'HORIZONTAL SWING', scene: 'edward_ground' },
  { n: 2, id: 'atk2', name: 'BACKSWING', scene: 'edward_ground' },
  { n: 3, id: 'atk3', name: 'OVERHEAD SMASH', scene: 'edward_ground', peak: 17 },
  { n: 4, id: 'atk4', name: 'FULL SWING', scene: 'edward_ground' },
  { n: 5, id: 'launcher', name: 'SCOOP', scene: 'edward_air', peak: 8 },
  { n: 6, id: 'sweep', name: 'FLOOR SWEEP', scene: 'edward_low' },
  { n: 7, id: 'dashAttack', name: 'RUSH SWING', scene: 'edward_low' },
  { n: 8, id: 'air1', name: 'AIR CHOP', scene: 'edward_air' },
  { n: 9, id: 'air2', name: 'AIR SWING', scene: 'edward_air' },
  { n: 10, id: 'air3', name: 'AIR SPIN', scene: 'edward_air', peak: 6 },
  { n: 11, id: 'slam', log: 'slamLand', name: 'SLAM LANDING', scene: 'edward_slam', peak: 3 },
  { n: 12, id: 'wallKick', name: 'WALL SMASH', scene: 'edward_wallkick' },
  { n: 13, id: 'charge', name: 'HAMMER RISE LV3', scene: 'edward_charge' },
  { n: 14, id: 'skill1', name: 'REENACT', scene: 'edward_reenact', peak: 6 },
  { n: 15, id: 'skill2', log: 'tkGrab', l: '15-1', name: 'TELEKINESIS PULL', scene: 'edward_pull', peak: 4 },
  { n: 16, id: 'skill2', log: 'tkWall', l: '15-2', name: 'TELEKINESIS PUSH', scene: 'edward_push', peak: 4 },
  { n: 17, id: 'super', log: 'superGrab', l: '16-1', name: 'THE SHELL GRAB', scene: 'edward_super', peak: 1 },
  { n: 18, id: 'super', l: '16-2', name: 'THE SHELL END', scene: 'edward_super', peak: 2 },
];
/** 에드워드는 시안을 골랐다 (2026-11-05): 시안 촬영 없음. 고른 시안의 전후 비교는 --base-draft atk4:3,skill1:2,skill2:2,super:3 --compare 4,13,14,15,18 */
const CHAR = opt.char;
const ALL_MOVES = CHAR === 'eunwoo' ? EUNWOO_MOVES : CHAR === 'edward' ? EDWARD_MOVES : RAIDEN_MOVES;
const MOVES = ALL_MOVES.filter((m) => !opt.only || opt.only.split(',').map(Number).includes(m.n));
const DRAFT_PEAK = CHAR === 'eunwoo' ? EUNWOO_DRAFT_PEAK : null;
/** 시안 줄의 기술 (백은우) */
const draftMove = (id) => ALL_MOVES.find((x) => x.id === id);
const SAMPLE = CHAR === 'eunwoo' ? ['atk1', 'atk4', 'launcher', 'charge'] : CHAR === 'edward' ? ['atk1', 'atk4', 'slam', 'charge'] : ['atk1', 'atk3', 'atk4', 'launcher'];
const LABEL = CHAR === 'eunwoo' ? [190, 225, 255] : CHAR === 'edward' ? [240, 182, 104] : [255, 200, 210];
const CHAR_NAME = { raiden: '라이덴', eunwoo: '백은우', edward: '에드워드' }[CHAR] ?? CHAR;
const peakOf = (m) => m.peak ?? PEAK_AT;
/** 맞기 전·맞은 뒤 틱 (14-2 미리보기) */
const PRE = 20;
const POST = 45;
/** 피크 정지 화면: 다 펼쳐진 틱 (14-2 펼쳐짐 0~2틱) */
const PEAK_AT = 2;

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
const EW = await vite.ssrLoadModule('/src/data/vfx/eunwoo.ts');
const ED = await vite.ssrLoadModule('/src/data/vfx/edward.ts');
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
/** 에드워드 기술 → 그 줄의 대표 GMove (고른 시안) */
const edwardMove = (id) => {
  if (id === 'charge') return ED.EDWARD_GG_CHARGE[2];
  if (id === 'skill1') return ED.EDWARD_SKILL1.plant;
  if (id === 'skill2') return ED.EDWARD_SKILL2.grab;
  if (id === 'super') return ED.EDWARD_SUPER.end;
  if (id === 'slam') return { ...ED.EDWARD_GG.slam, grammar: [...new Set([...ED.EDWARD_GG.slam.grammar, ...ED.EDWARD_GG_SLAM_LAND.grammar])].sort((a, b) => a - b) };
  return ED.EDWARD_GG[id];
};
const grammarOf = (id) => (CHAR === 'eunwoo'
  ? (id === 'charge' ? EW.EUNWOO_GG_CHARGE[2].grammar : id === 'skill1' ? EW.EUNWOO_GG_SKILL1[0].grammar : id === 'skill2' ? EW.EUNWOO_GG_SKILL2[0].grammar : id === 'super' ? EW.EUNWOO_GG_SUPER[0].grammar : EW.EUNWOO_GG[id]?.grammar)
  : CHAR === 'edward' ? edwardMove(id)?.grammar
  : (id === 'charge' ? RAIDEN_GG_CHARGE[3].grammar : id === 'super' ? RAIDEN_GG_SUPER.burst.grammar : RAIDEN_GG[id]?.grammar)) ?? [];

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

/** 맞기 20틱 전부터 찍히게 처음 기다림을, 맞은 뒤 45틱까지 찍히게 마지막 기다림을 늘린다 (두 버전 같은 입력) */
function padded(sc) {
  const steps = sc.steps.map((st) => [st[0], st[1]]);
  if (steps.length && steps[0][0].length === 0) steps[0][1] = Math.max(steps[0][1], PRE + 8);
  const last = steps[steps.length - 1];
  if (last && last[0].length === 0) last[1] = Math.max(last[1], POST + 15);
  return { ...sc, steps };
}

async function run(which, sc0, draft = '') {
  const sc = padded(sc0);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const stopAt = sc.stopAt ?? 75;
  const dq = which === 'base' && opt.baseDraft ? opt.baseDraft : draft;
  await page.goto(`${servers[which].resolvedUrls.local[0]}?${sc.q}&stopAt=${stopAt}&ff=1&quality=high${dq ? `&ggdraft=${dq}` : ''}`, { timeout: 600000 });
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
/** 시안 2·3 촬영 (14-9): 시안 1은 위 지금 버전 그대로 */
const draftShots = {};
if (opt.drafts && DRAFT_PEAK) {
  for (const id of Object.keys(DRAFT_PEAK)) {
    const dm = draftMove(id);
    const m = dm && MOVES.find((x) => x.n === dm.n);
    if (!m) continue;
    for (const d of [2, 3]) {
      console.log(`시안 ${id} ${d} …`);
      draftShots[`${id}:${d}`] = await run('new', SCENES[m.scene], `${id}:${d}`);
    }
  }
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
  // 백은우 선의는 해제 (세계가 깨지는 틱, 'superRelease' 기록)가 0
  const hit = sh.log.find((l) => l.move === (m.log ?? m.id) && l.impact);
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

// ---------------------------------------------------------------- 금 면적 (14-10 ②: 금이 두 번째 주인공 색, 이펙트의 15~25%)
/** 따뜻한 노랑·호박색 (색상 28~62°, 채도 0.4 넘게, 밝기 0.5 넘게): 금 테·금 별·금 불씨·금 고리 */
function isGold(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx < 128 || mx - mn < 0.4 * mx || mx !== r) return false;
  const hue = (60 * (g - b)) / (mx - mn);
  return hue >= 28 && hue <= 62;
}
/** 보이는 이펙트 칸 (밤 배경에 묻히는 어두운 남색 테·잉크 칸은 뺀다) 가운데 금 칸의 비율 */
function goldShare(f) {
  if (!f?.marks) return null;
  let all = 0;
  let gold = 0;
  for (let i = 0; i < W * H; i++) {
    if (!f.marks[i]) continue;
    const r = f.d[i * 3];
    const g = f.d[i * 3 + 1];
    const b = f.d[i * 3 + 2];
    if (0.299 * r + 0.587 * g + 0.114 * b < 45) continue;
    all++;
    if (isGold(r, g, b)) gold++;
  }
  return all ? { all, gold, share: gold / all } : null;
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
const GOLD_COL = CHAR === 'eunwoo';
lines.push(`| 번호 | 기술 | 쓴 문법 (14-8) | 1px 선 (24px 넘게) | 같은 방향 1px 선 최대 | 자로 그은 곧은 테두리 (30px 넘게) | 같은 그림이 이어진 가장 긴 틱 | 공격자 몸통·머리 위 칸 (+2틱) |${GOLD_COL ? ' 금 면적 (피크) |' : ''}`);
lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |${GOLD_COL ? ' --- |' : ''}`);
for (const m of MOVES) {
  if (m.idx < 0) continue;
  const sh = shots[m.scene].new;
  let thin = 0;
  let thinMax = 0;
  let parallel = 0;
  let straight = 0;
  let body = 0;
  let where = '';
  // 맞기 20틱 전 (전조) ~ 맞은 뒤 45틱 (잔향) 전부: 펼쳐지고 흩어지는 동안 긴 1px 선이 남지 않는지도 본다
  for (let d = -PRE; d <= POST; d++) {
    const f = sh.frames[m.idx + d];
    if (!f) continue;
    const r = checkFrame(f, m.at);
    if (!r) continue;
    thin = Math.max(thin, r.thin);
    thinMax = Math.max(thinMax, r.thinMax);
    parallel = Math.max(parallel, r.parallel);
    if (r.straight > straight) where = `${d >= 0 ? '+' : ''}${d}틱 ${r.where.slice(0, 2).join(' ')}`;
    if (opt.debug && r.boxes.length) debugShot(m, f, d, r.boxes);
    straight = Math.max(straight, r.straight);
    if (d === peakOf(m)) body = r.body;
  }
  // 같은 그림 정지 (14-2): 이펙트 칸(월드 자리 + 색)이 3틱 넘게 이어서 같으면 실패. 카메라가 움직여도 월드 자리로 맞춰 본다
  const sig = [];
  for (let d = -PRE; d <= POST; d++) {
    const f = sh.frames[m.idx + d];
    if (!f || !f.marks) { sig.push(null); continue; }
    let h = 2166136261;
    let n = 0;
    for (let i = 0; i < W * H; i++) {
      if (!f.marks[i]) continue;
      const wx = (i % W) + f.cam[0];
      const wy = ((i / W) | 0) + f.cam[1];
      const c = (f.d[i * 3] << 16) | (f.d[i * 3 + 1] << 8) | f.d[i * 3 + 2];
      h = Math.imul(h ^ (wx * 73856093) ^ (wy * 19349663) ^ c, 16777619) >>> 0;
      n++;
    }
    sig.push(n ? `${n}:${h}` : null);
  }
  let run = 1;
  let longest = 1;
  let frozen = '';
  for (let k = 1; k < sig.length; k++) {
    run = sig[k] && sig[k] === sig[k - 1] ? run + 1 : 1;
    if (run > longest) {
      longest = run;
      if (run >= 3) frozen = `${k - PRE - run + 1 >= 0 ? '+' : ''}${k - PRE - run + 1}~${k - PRE >= 0 ? '+' : ''}${k - PRE}틱`;
    }
  }
  const gs = goldShare(sh.frames[m.idx + peakOf(m)]);
  m.check = { thin, parallel, straight, body, longest, gold: gs };
  const goldCol = GOLD_COL ? ` ${gs ? `${Math.round(gs.share * 100)}% (${gs.gold}/${gs.all})` : '-'} |` : '';
  lines.push(`| ${m.l ?? m.n} | ${m.id} | ${grammarOf(m.id).join(' · ')} | ${thin}${thin ? ` (가장 긴 ${thinMax}px)` : ''} | ${parallel} | ${straight}${straight ? ` (${where})` : ''} | ${longest}${longest >= 3 ? ` (${frozen})` : ''} | ${body} |${goldCol}`);
}
const md = [`## ${CHAR_NAME} 길티기어식 이펙트 자체 점검 (지금 버전, 맞기 20틱 전 ~ 맞은 뒤 45틱)`, '', '- 1px 선: 보이는 이펙트 칸(밤 배경에 묻히는 어두운 잉크·테두리 칸은 뺀다) 묶음 중, 상하좌우가 모두 이펙트인 칸(가로·세로 3칸 굵기)이 하나도 없이 24px 넘게 이어진 것. 2px 띠도 1px 선으로 센다', '- 자로 그은 곧은 테두리: 같은 줄에서 이펙트 위·아래 경계가 30칸 넘게 곧게 이어진 곳 수', '- 같은 그림이 이어진 가장 긴 틱: 이펙트 칸(월드 자리·색)이 그대로인 틱 수 (14-2: 2틱 넘으면 실패, 이펙트가 없는 틱은 세지 않는다)', '- 공격자 몸통·머리 위 칸: 맞은 틱 +2(다 펼쳐진 모습)에 공격자 몸통(엉덩이 → 목 선 4px 안)·머리(7px 안)에 칠한 이펙트 칸 (뒤 겹이면 몸이 위에 그려진다)', ...(GOLD_COL ? ['- 금 면적 (14-10 ②, 목표 15~25%): 피크 틱(스타일 견본과 같은 틱)의 보이는 이펙트 칸 가운데 금·호박색 칸 (색상 28~62°, 채도 0.4 넘게). 어두운 남색 테·잉크 칸은 분모에서 뺀다'] : []), '', ...lines, ''].join('\n');
writeFileSync(`${opt.out}/check.md`, md);
console.log(md);

// ---------------------------------------------------------------- 동작마다 전후 GIF (2배, 맞기 20틱 전 ~ 맞은 뒤 45틱, 실제 속도 · 0.5배속) + 지금 피크 PNG
/** 프레임 사이 시간 (1/100초): 3·3·4를 돌려 평균 3.33 = 0.5배속 한 틱 = 실제 속도 두 틱 */
const DELAYS = [3, 3, 4];
function gif(file, list) {
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
        // 255색까지 (255번은 '앞 프레임과 같음' 투명색)
        if (palette.length >= 255) {
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
  const delays = out.map((_, k) => DELAYS[k % DELAYS.length]);
  delays[delays.length - 1] += 80;
  const buf = encodeGifDelta(OW, OH, palette, out, delays);
  writeFileSync(file, buf);
  console.log(`    ${file} (${OW}×${OH}, ${out.length}장, ${(buf.length / 1024).toFixed(0)}KB)`);
}
const CW = 260;
const CH = 150;
const S = 2;
/** GIF는 1배 (원래 칸 크기): 66틱 × 두 속도 × 14개라 2배면 60MB가 넘는다 */
const GS = 1;
for (const m of MOVES) {
  if (m.idx < 0) continue;
  const sh = shots[m.scene];
  const f0 = sh.new.frames[m.idx + peakOf(m)] ?? sh.new.frames[m.idx];
  const [x0, y0] = windowOf(m, f0, CW, CH);
  const tag = `${String(m.n).padStart(2, '0')}-${m.id}`;
  const peak = img(CW * S, CH * S);
  blit(peak, crop(f0, x0, y0, CW, CH), 0, 0, S);
  save(`${opt.out}/${tag}-peak.png`, peak);
  const frameAt = (list, i) => list[Math.max(0, Math.min(list.length - 1, i))];
  const make = (i, speed) => {
    const o = img(CW * GS * (sh.base ? 2 : 1) + (sh.base ? 6 : 0), CH * GS + 16, 24);
    if (sh.base) blit(o, crop(frameAt(sh.base.frames, i), x0, y0, CW, CH), 0, 16, GS);
    blit(o, crop(frameAt(sh.new.frames, i), x0, y0, CW, CH), sh.base ? CW * GS + 6 : 0, 16, GS);
    text(o, sh.base ? `${m.l ?? m.n} BEFORE` : `${m.l ?? m.n} AFTER ${speed}`, 4, 3, 2, sh.base ? [235, 235, 240] : LABEL);
    if (sh.base) text(o, `AFTER ${speed}`, CW * GS + 10, 3, 2, LABEL);
    const d = i - m.idx;
    text(o, `${d >= 0 ? '+' : ''}${d}`, o.w - 34, 3, 2, d >= 0 && d <= 2 ? [255, 236, 120] : [180, 180, 190]);
    return o;
  };
  const half = [];
  for (let d = -PRE; d <= POST; d++) half.push(make(m.idx + d, '0.5X'));
  gif(`${opt.out}/${tag}-half.gif`, half);
  const real = [];
  for (let d = -PRE; d <= POST; d += 2) real.push(make(m.idx + d, '1X'));
  gif(`${opt.out}/${tag}-1x.gif`, real);
}

// ---------------------------------------------------------------- 고른 시안의 전후 비교 (--compare): 위 이전 · 아래 이번, 같은 틱 넷 (펼쳐진 피크 → 흩어짐 → 잔향)
if (opt.compare) {
  const TICKS = [1, 4, 14, 32];
  const PW = 260;
  const PH = 150;
  const GAP = 8;
  const LH = 24;
  const frameAt = (list, i) => list[Math.max(0, Math.min(list.length - 1, i))];
  for (const n of opt.compare.split(',').map(Number)) {
    const m = MOVES.find((x) => x.n === n);
    const sh = m && shots[m.scene];
    if (!m || m.idx < 0 || !sh?.base) continue;
    const [x0, y0] = windowOf(m, frameAt(sh.new.frames, m.idx + 1), PW, PH);
    const o = img(TICKS.length * (PW * 2 + GAP) - GAP, 2 * (PH * 2 + LH), 18);
    TICKS.forEach((d, c) => {
      [['BEFORE', sh.base, [235, 235, 240]], ['AFTER', sh.new, LABEL]].forEach(([lab, s, rgb], r) => {
        const ox = c * (PW * 2 + GAP);
        const oy = r * (PH * 2 + LH) + LH;
        blit(o, crop(frameAt(s.frames, m.idx + d), x0, y0, PW, PH), ox, oy, 2);
        text(o, `${m.l ?? m.n} ${lab}  +${d}`, ox + 4, oy - 20, 2, rgb);
      });
    });
    save(`${opt.out}/${String(m.n).padStart(2, '0')}-${m.id}-compare.png`, o);
  }
}

// ---------------------------------------------------------------- 네 장면 전후 피크 (--sample-compare): 기술마다 한 줄, 왼쪽 이전 · 오른쪽 이번 (같은 장면·같은 입력·같은 틱·같은 자리)
if (opt.sampleCompare) {
  const pk = SAMPLE.map((id) => MOVES.find((m) => m.id === id)).filter((m) => m && m.idx >= 0 && shots[m.scene].base);
  if (pk.length) {
    const PW = 400;
    const PH = 225;
    const GAP = 8;
    const LH = 26;
    const o = img(PW * 2 * 2 + GAP, pk.length * (PH * 2 + LH + GAP) - GAP, 18);
    pk.forEach((m, r) => {
      const sh = shots[m.scene];
      const f1 = sh.new.frames[m.idx + peakOf(m)] ?? sh.new.frames[m.idx];
      // 이전 버전도 같은 입력이라 맞은 틱 번호가 같다 (그 버전 기록으로 다시 찾는다)
      const e = sh.base.log.find((l) => l.move === (m.log ?? m.id) && l.impact) ?? sh.base.log.find((l) => l.move === m.id && l.swing);
      const bi = e ? sh.base.frames.findIndex((f) => f.tick === e.tick) : m.idx;
      const f0 = sh.base.frames[(bi >= 0 ? bi : m.idx) + peakOf(m)] ?? sh.base.frames[m.idx];
      const [x0, y0] = windowOf(m, f1, PW, PH);
      const oy = r * (PH * 2 + LH + GAP) + LH;
      const g0 = goldShare(f0);
      const g1 = goldShare(f1);
      const pct = (g) => (g ? `  GOLD ${Math.round(g.share * 100)}%` : '');
      [[f0, 'NOW (MAIN)', [235, 235, 240], g0], [f1, '14-10', LABEL, g1]].forEach(([f, lab, rgb, g], c) => {
        const ox = c * (PW * 2 + GAP);
        blit(o, crop(f, x0, y0, PW, PH), ox, oy, 2);
        text(o, `${m.l ?? m.n} ${m.name}  ${lab}  +${peakOf(m)}${pct(g)}`, ox + 4, oy - 21, 2, rgb);
      });
    });
    save(`${opt.out}/sample-compare.png`, o);
  }
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
      const f0 = sh.frames[m.idx + peakOf(m)] ?? sh.frames[m.idx];
      const [x0, y0] = windowOf(m, f0, PW, PH);
      const ox = (k % 2) * (PW * 2 + GAP);
      const oy = 24 + RH + GAP + Math.floor(k / 2) * (PH * 2 + 24) + 24;
      blit(o, crop(f0, x0, y0, PW, PH), ox, oy, 2);
      text(o, `${m.l ?? m.n} ${m.name} - PEAK`, ox + 4, oy - 19, 3, LABEL);
    });
    save(`${opt.out}/style-sample.png`, o);
  }
}

// ---------------------------------------------------------------- 시안 (14-9): 기술마다 한 줄, 시안 1·2·3 피크 (기법 글자)
if (opt.drafts && DRAFT_PEAK) {
  const PW = 300;
  const PH = 170;
  const GAP = 8;
  const rows = Object.keys(DRAFT_PEAK);
  const techOf = (id, d) => {
    const v = id === 'atk4' ? EW.EUNWOO_GG_DRAFTS.atk4[d - 1] : id === 'charge' ? EW.EUNWOO_GG_DRAFTS.charge[d - 1][2] : EW.EUNWOO_GG_DRAFTS[id][d - 1];
    return v?.tech ? `${v.tech.main} / ${v.tech.aux.join(' ')}` : '';
  };
  const o = img(PW * 2 * 3 + GAP * 2, rows.length * (PH * 2 + 26), 18);
  rows.forEach((id, r) => {
    const m = draftMove(id);
    const base = shots[m.scene]?.new;
    const mm = MOVES.find((x) => x.n === m.n);
    if (!base || !mm || mm.idx < 0) return;
    for (let d = 1; d <= 3; d++) {
      const sh = d === 1 ? base : draftShots[`${id}:${d}`];
      if (!sh) continue;
      // 시안 장면도 같은 입력이라 맞은 틱 번호가 같다 (그 시안 로그로 다시 찾는다)
      const e = sh.log.find((l) => l.move === (mm.log ?? id) && l.impact) ?? sh.log.find((l) => l.move === id && l.swing);
      const idx = e ? sh.frames.findIndex((f) => f.tick === e.tick) : mm.idx;
      const f0 = sh.frames[idx + DRAFT_PEAK[id][d - 1]] ?? sh.frames[idx];
      const [x0, y0] = windowOf({ ...mm, at: e?.at ?? mm.at }, f0, PW, PH);
      const ox = (d - 1) * (PW * 2 + GAP);
      const oy = r * (PH * 2 + 26) + 24;
      blit(o, crop(f0, x0, y0, PW, PH), ox, oy, 2);
      text(o, `${m.l ?? m.n} ${m.name}  DRAFT ${d}${d === 1 ? ' (IN GAME)' : ''}  ${techOf(id, d)}`, ox + 4, oy - 20, 2, d === 1 ? [255, 236, 120] : LABEL);
    }
  });
  save(`${opt.out}/drafts.png`, o);
}
