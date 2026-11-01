// 모든 동작 시트를 out/sheets/<캐릭터>/<동작>.png로 출력한다 (가로 띠, 4배, 프레임 번호).
// 같은 이름의 .md에 프레임별 표시 틱 표를 적는다 (PR 설명에 붙여 넣는 용도).
//   npm run sheets                        모든 동작
//   npm run sheets -- --only raiden/jab   그 동작만
//   npm run sheets -- --approve raiden/jab  승인 요청용 GIF 두 장을 previews/raiden/jab.gif(실제 속도),
//                                           jab-slow.gif(프레임마다 0.3초, 번호·표시 틱·판정 상자)로 (2026-11-01: 승인용은 GIF)
//   --only·--approve로 고른 동작은 out/sheets/에도 같은 GIF를 쓴다
//   npm run sheets -- --selftest          도구 확인용 가짜 동작
//   npm run sheets -- --only base/idle --skin raiden   캐릭터 겉모습(장식·색)으로 → out/sheets/raiden/look-base-idle.png
//                                                    (--approve와 함께면 previews/raiden/look-base-idle.gif)
//   npm run sheets -- --approve raiden/idle --look p2   2P 색으로 → previews/raiden/idle-p2.gif
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { encodeGif } from './gif.mjs';
import { dirname } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const only = valuesOf('--only');
const approve = valuesOf('--approve');
const selftest = argv.includes('--selftest');
const skin = valuesOf('--skin')[0] ?? '';
/** 색 묶음: --look p2면 2P 색으로 그리고 이름 끝에 -p2 */
const look = valuesOf('--look')[0] ?? 'p1';
/** 출력 이름: 캐릭터 겉모습으로 그린 것은 <캐릭터>/look-<동작 이름> */
const outName = (name) => (skin ? `${skin}/look-${name.replace('/', '-')}` : name) + (look === 'p1' ? '' : `-${look}`);

const query = new URLSearchParams();
for (const n of [...only, ...approve]) query.append('only', n);
if (selftest) query.set('selftest', '');
if (skin) query.set('skin', skin);
if (look !== 'p1') query.set('look', look);
if (only.length || approve.length) query.set('gif', '');

const vite = await createServer({ logLevel: 'error', server: { port: 5181 } });
await vite.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(`${vite.resolvedUrls.local[0]}tools/pages/sheets.html?${query}`);
await page.waitForFunction(() => window.__sheets !== undefined, null, { timeout: 15000 }).catch(() => {});
const sheets = (await page.evaluate(() => window.__sheets)) ?? [];
await browser.close();
await vite.close();

let failed = pageErrors.length;
pageErrors.forEach((e) => console.log(`NG  페이지 오류: ${e}`));
if (!sheets.length && !failed) console.log('출력할 동작이 없습니다. (src/anim/motions.ts의 MOTIONS가 비어 있음)');

for (const s of sheets) {
  if (s.errors.length) {
    failed++;
    console.log(`NG  ${s.name}: ${s.errors.join(', ')}`);
    continue;
  }
  const out = outName(s.name);
  const png = `out/sheets/${out}.png`;
  mkdirSync(dirname(png), { recursive: true });
  writeFileSync(png, Buffer.from(s.png.split(',')[1], 'base64'));
  writeFileSync(`out/sheets/${out}.md`, durTable(s));
  const total = s.dur.reduce((a, b) => a + b, 0);
  console.log(`OK  ${s.name}: ${s.dur.length}프레임, 총 ${total}틱 → ${png}`);
  if (s.gif) {
    const real = `out/sheets/${out}.gif`;
    const slow = `out/sheets/${out}-slow.gif`;
    // 실제 속도: 표시 틱 → 1/100초 (GIF는 2 아래를 브라우저가 느리게 틀어서 2 이상), 끝에 0.4초 멈춤
    const realDelay = s.dur.map((d) => Math.max(2, Math.round((d * 100) / 60)));
    realDelay[realDelay.length - 1] += 40;
    const slowDelay = s.dur.map(() => 30);
    slowDelay[slowDelay.length - 1] += 50;
    writeFileSync(real, gifOf(s.gif.w, s.gif.h, s.gif.real, realDelay));
    writeFileSync(slow, gifOf(s.gif.w, s.gif.h, s.gif.slow, slowDelay));
    console.log(`    GIF → ${real}, ${slow}`);
    if (approve.includes(s.name)) {
      for (const [from, to] of [[real, `previews/${out}.gif`], [slow, `previews/${out}-slow.gif`]]) {
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
        console.log(`    승인용 복사 → ${to}`);
      }
    }
  }
}
for (const n of [...only, ...approve]) {
  if (!sheets.some((s) => s.name === n)) { failed++; console.log(`NG  ${n}: 그런 동작이 없습니다`); }
}
process.exit(failed ? 1 : 0);

function durTable(s) {
  const head = `| 프레임 | ${s.dur.map((_, i) => i + 1).join(' | ')} | 합계 |`;
  const line = `| --- | ${s.dur.map(() => '---').join(' | ')} | --- |`;
  const row = `| 표시 틱 | ${s.dur.join(' | ')} | ${s.dur.reduce((a, b) => a + b, 0)} |`;
  return `### ${s.name}\n\n${head}\n${line}\n${row}\n`;
}

/** 1배 RGBA 프레임들(base64) → SCALE배로 키운 GIF. 모든 프레임이 한 팔레트를 쓴다 (시트 색은 많지 않다) */
function gifOf(w, h, frames, delays) {
  const S = 4;
  const rgba = frames.map((b64) => Buffer.from(b64, 'base64'));
  const index = new Map();
  const palette = [];
  const W = w * S;
  const H = h * S;
  const out = rgba.map((px) => {
    const data = new Uint8Array(W * H);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const rgb = (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
        let k = index.get(rgb);
        if (k === undefined) {
          k = palette.length < 256 ? palette.length : nearest(palette, rgb);
          if (palette.length < 256) {
            palette.push(rgb);
            index.set(rgb, k);
          }
        }
        for (let dy = 0; dy < S; dy++) data.fill(k, (y * S + dy) * W + x * S, (y * S + dy) * W + x * S + S);
      }
    }
    return data;
  });
  return encodeGif(W, H, palette, out, delays);
}

function nearest(palette, rgb) {
  let best = 0;
  let bestD = Infinity;
  palette.forEach((c, i) => {
    const d = ((c >> 16) - (rgb >> 16)) ** 2 + (((c >> 8) & 255) - ((rgb >> 8) & 255)) ** 2 + ((c & 255) - (rgb & 255)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function valuesOf(flag) {
  const out = [];
  argv.forEach((a, i) => { if (a === flag && argv[i + 1]) out.push(argv[i + 1]); });
  return out;
}
