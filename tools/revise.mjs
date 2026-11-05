// 동작 재수정 확인 자료 (애니메이션 재수정 지침 4·5장): 바꾸기 전(git worktree) 그림과 지금 그림을 나란히.
//   node tools/revise.mjs --before <바꾸기 전 작업 폴더> [--out previews/<폴더>] raiden/jab raiden/cross …
// 동작마다 (--out 폴더에, 이름은 '/'를 '-'로):
//   <이름>-compare.gif       전후 나란히, 실제 속도 (같은 자리, 판정 상자 없음. 판정 틱은 위 글줄에 HIT)
//   <이름>-compare-half.gif  같은 것 0.5배속
//   <이름>-path.png          끝점 경로 (공격은 치는 손발 끝, 나머지는 가장 많이 움직인 관절): 회색 = 전, 노랑 = 지금, 점 옆 숫자 = 프레임
//   <이름>-sil.png           단색 실루엣 띠 (위 = 전, 아래 = 지금. 주황 = 판정 틱의 프레임, 빨강 = 첫 판정 프레임과 대기 그림자)
//   --lineup이면 <out>/lineup.png 하나 더: 네 캐릭터의 같은 공격(1~4타·띄우기·차지·스킬·필살기) 첫 판정 틱 그림을 나란히 (5장)
// 그리고 out/revise.json: 프레임 수·틱·그림과 판정 데이터의 차이 (그림 관절로 만든 상자 vs 공격 데이터, 연검 선 판정은 그림 리본 vs 판정 선, 에드워드 해머 판정은 판정 틱마다 그림 해머 머리가 궤적 상자 밖으로 나간 거리. 8px 넘으면 표에 적는다: 4장)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { encodeGif } from './gif.mjs';
import { encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const opt = { before: '', out: 'previews/rework', lineup: false };
const names = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--before') opt.before = argv[++i];
  else if (argv[i] === '--out') opt.out = argv[++i];
  else if (argv[i] === '--lineup') opt.lineup = true;
  else names.push(argv[i]);
}
if (!opt.before || !names.length) {
  console.log('쓰는 법: node tools/revise.mjs --before <바꾸기 전 작업 폴더> [--out 폴더] 동작이름 …');
  process.exit(1);
}

async function loadAt(root) {
  const vite = await createServer({ root: resolve(root), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const L = (p) => vite.ssrLoadModule(p);
  const m = {
    MOTION_DATA: (await L('/src/data/poses/index.ts')).MOTION_DATA,
    MOTIONS: (await L('/src/anim/motions.ts')).MOTIONS,
    smeared: (await L('/src/anim/bake.ts')).smeared,
    sk: await L('/src/anim/skeleton.ts'),
    Indexed: (await L('/src/anim/raster.ts')).Indexed,
    skins: await L('/src/anim/skins.ts'),
    boxes: await L('/src/anim/boxes.ts'),
    sim: await L('/src/sim/index.ts'),
    font: await L('/src/render/font.ts'),
  };
  await vite.close();
  return m;
}
const OLD = await loadAt(opt.before);
const NEW = await loadAt('.');

const SLOT = { w: 144, h: 108, fx: 72, fy: 105 };
const cumOf = (dur) => dur.reduce((a, d) => (a.push((a[a.length - 1] ?? 0) + d), a), []);
const frameAt = (cum, t) => {
  for (let i = 0; i < cum.length; i++) if (t < cum[i]) return i;
  return cum.length - 1;
};

/** 동작 그림 전부: 프레임마다 128×96 칸의 RGB(0이면 빈칸)와 관절 */
function render(M, name) {
  const m = M.MOTIONS.find((x) => x.name === name);
  const d = M.MOTION_DATA.find((x) => x.name === name);
  if (!m) return null;
  const { w: cw, h: ch, fx, fy } = m.cell;
  const skin = M.skins.skinForMotion(name);
  const decor = M.skins.SKINS[skin].decor;
  // 바꾸기 전 코드에 lookTable이 없으면 지금 것 (색표 계산은 같다)
  const table = (M.sk.lookTable ?? NEW.sk.lookTable)(M.skins.lookOf(skin, 'p1'));
  const n = m.joints.length;
  const img = new M.Indexed(n * cw, ch);
  m.joints.forEach((j, i) => {
    const drawn = d.smear && d.smear.frame === i ? M.smeared(j, d.smear.limb, d.smear.stretch) : j;
    const ghost = d.smear?.ghosts && d.smear.frame === i && i > 0 ? { prev: m.joints[i - 1], n: d.smear.ghosts } : undefined;
    M.sk.drawSkeleton(img, drawn, i * cw + fx, fy, decor, [i * cw, (i + 1) * cw], ghost);
  });
  const frames = m.joints.map((_, i) => {
    const px = new Int32Array(SLOT.w * SLOT.h).fill(-1);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const c = img.a[y * img.w + i * cw + x];
        if (!c) continue;
        const X = x + SLOT.fx - fx;
        const Y = y + SLOT.fy - fy;
        if (X < 0 || Y < 0 || X >= SLOT.w || Y >= SLOT.h) continue;
        const [r, g, b] = table[c];
        px[Y * SLOT.w + X] = (r << 16) | (g << 8) | b;
      }
    }
    return px;
  });
  return { name, dur: m.dur, cum: cumOf(m.dur), total: m.dur.reduce((a, b) => a + b, 0), joints: m.joints, frames };
}

/** 이 동작을 그리는 기술 (지금 공격 데이터) */
function moveOf(name) {
  for (const c of NEW.sim.CHAR_IDS) for (const [id, mv] of Object.entries(NEW.sim.movesOf(c))) if (mv.time.motion === name) return { c, id, mv };
  return null;
}

// ---- 그리기 도우미 (RGB 캔버스, 정수 배율) ----
function canvas(w, h, bg) {
  return { w, h, px: new Int32Array(w * h).fill(bg) };
}
const put = (cv, x, y, c) => {
  if (x >= 0 && y >= 0 && x < cv.w && y < cv.h) cv.px[y * cv.w + x] = c;
};
const rect = (cv, x, y, w, h, c) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(cv, xx, yy, c);
};
function text(cv, s, x, y, c) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = NEW.font.glyphRows(ch);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r] & (4 >> k)) put(cv, cx + k, y + r, c);
    cx += 4;
  }
}
const blit = (cv, frame, ox, oy) => {
  for (let i = 0; i < frame.length; i++) if (frame[i] >= 0) put(cv, ox + (i % SLOT.w), oy + Math.floor(i / SLOT.w), frame[i]);
};
function scaled(cv, s) {
  const out = new Int32Array(cv.w * s * cv.h * s);
  for (let y = 0; y < cv.h * s; y++) for (let x = 0; x < cv.w * s; x++) out[y * cv.w * s + x] = cv.px[Math.floor(y / s) * cv.w + Math.floor(x / s)];
  return { w: cv.w * s, h: cv.h * s, px: out };
}
function png(cv) {
  const rgb = new Uint8Array(cv.w * cv.h * 3);
  cv.px.forEach((c, i) => {
    rgb[i * 3] = (c >> 16) & 255;
    rgb[i * 3 + 1] = (c >> 8) & 255;
    rgb[i * 3 + 2] = c & 255;
  });
  return encodePng(cv.w, cv.h, rgb);
}
function gif(cvs, delays) {
  const pal = [];
  const idx = new Map();
  const frames = cvs.map((cv) => {
    const data = new Uint8Array(cv.px.length);
    cv.px.forEach((c, i) => {
      let k = idx.get(c);
      if (k === undefined) {
        k = pal.length < 256 ? pal.length : 0;
        if (pal.length < 256) {
          pal.push(c);
          idx.set(c, k);
        }
      }
      data[i] = k;
    });
    return data;
  });
  return encodeGif(cvs[0].w, cvs[0].h, pal, frames, delays);
}

const BG = 0x07040e;
const CELL = 0x120a24;
const GROUND = 0x2a1f44;
const GOLD = 0xffd25e;
const RED = 0xff5a4a;
const GREY = 0x8e86a8;
mkdirSync(opt.out, { recursive: true });
const report = [];

for (const name of names) {
  const A = render(OLD, name);
  const B = render(NEW, name);
  if (!B) {
    console.log(`NG  ${name}: 지금 동작 없음`);
    continue;
  }
  const mo = moveOf(name);
  const hits = mo ? mo.mv.time.hits.map((h) => h.t) : [];
  const inHit = (t) => hits.some(([a, b]) => t >= a && t < b);
  const file = `${opt.out}/${name.replace('/', '-')}`;

  // 1) 전후 GIF (틱마다 합성, 같은 그림이 이어지면 한 장으로)
  const T = Math.max(A?.total ?? 0, B.total);
  const W = SLOT.w * 2 + 6;
  const H = SLOT.h + 9;
  const comps = [];
  const spans = [];
  for (let t = 0; t < T; t++) {
    const cv = canvas(W, H, BG);
    for (const [k, R] of [[0, A], [1, B]]) {
      const ox = k * (SLOT.w + 6);
      rect(cv, ox, 9, SLOT.w, SLOT.h, CELL);
      rect(cv, ox, 9 + SLOT.fy + 1, SLOT.w, 1, GROUND);
      if (!R) continue;
      const f = frameAt(R.cum, Math.min(t, R.total - 1));
      blit(cv, R.frames[f], ox, 9);
      text(cv, `${k ? 'NOW' : 'BEFORE'} ${f + 1}/${R.frames.length}`, ox + 1, 2, k ? GOLD : GREY);
    }
    text(cv, `T${t}`, W - 22, 2, GREY);
    if (inHit(t)) text(cv, 'HIT', SLOT.w - 6, 2, RED);
    const key = cv.px.join(',');
    if (comps.length && comps[comps.length - 1].key === key) spans[spans.length - 1][1] = t + 1;
    else {
      comps.push({ key, cv });
      spans.push([t, t + 1]);
    }
  }
  const cs = (t) => Math.round((t * 100) / 60);
  const delays = (k) => spans.map(([a, b], i) => Math.max(2, cs(b * k) - cs(a * k)) + (i === spans.length - 1 ? 40 : 0));
  const big = comps.map((c) => scaled(c.cv, 3));
  writeFileSync(`${file}-compare.gif`, gif(big, delays(1)));
  writeFileSync(`${file}-compare-half.gif`, gif(big, delays(2)));

  // 끝점: 공격은 치는 손발 끝 (판정 구간 limb 끝, 없으면 앞손), 나머지는 지금 그림에서 가장 많이 움직인 관절
  const J = ['hip', 'neck', 'sh', 'head', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB'];
  let tipJ = mo?.mv.data.limb?.[1] ?? (mo ? 'hF' : null);
  if (!tipJ) {
    let most = -1;
    for (const k of J) {
      const p = B.joints.reduce((s, j, i) => s + (i ? Math.hypot(j[k][0] - B.joints[i - 1][k][0], j[k][1] - B.joints[i - 1][k][1]) : 0), 0);
      if (p > most) {
        most = p;
        tipJ = k;
      }
    }
  }

  // 2) 끝점 경로 그림 (4배): 지금 그림의 첫 판정(없으면 가장 많이 움직인) 프레임을 어둡게 깔고, 전(회색)·지금(노랑) 경로
  {
    const S = 4;
    const cv = canvas(SLOT.w * S, SLOT.h * S + 14, BG);
    rect(cv, 0, 14, SLOT.w * S, SLOT.h * S, CELL);
    rect(cv, 0, 14 + (SLOT.fy + 1) * S, SLOT.w * S, S, GROUND);
    const hitF = hits.length ? frameAt(B.cum, hits[0][0]) : 0;
    const bgf = B.frames[hitF];
    for (let i = 0; i < bgf.length; i++) if (bgf[i] >= 0) rect(cv, (i % SLOT.w) * S, 14 + Math.floor(i / SLOT.w) * S, S, S, 0x3a3060);
    const drawPath = (R, col, dot) => {
      if (!R) return;
      const pts = R.joints.map((j) => [(SLOT.fx + j[tipJ][0]) * S + S / 2, 14 + (SLOT.fy + j[tipJ][1]) * S + S / 2]);
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
        for (let k = 0; k <= n; k++) put(cv, Math.round(ax + ((bx - ax) * k) / n), Math.round(ay + ((by - ay) * k) / n), col);
      }
      pts.forEach(([x, y], i) => {
        rect(cv, Math.round(x) - dot, Math.round(y) - dot, dot * 2 + 1, dot * 2 + 1, col);
        text(cv, i + 1, Math.round(x) + dot + 2, Math.round(y) - 7, col);
      });
    };
    drawPath(A, GREY, 1);
    drawPath(B, GOLD, 2);
    text(cv, `${name} ${tipJ}  BEFORE(GREY) ${A ? A.frames.length : 0}F  NOW(GOLD) ${B.frames.length}F`, 3, 4, GOLD);
    writeFileSync(`${file}-path.png`, png(cv));
  }

  // 3) 실루엣 띠 (2배): 위 = 전, 아래 = 지금
  {
    const idle = render(NEW, `${name.slice(0, name.indexOf('/'))}/idle`) ?? render(NEW, 'base/idle');
    const ghost = idle.frames[0];
    const n = Math.max(A?.frames.length ?? 0, B.frames.length);
    const cv = canvas(n * (SLOT.w + 1) + 4, 2 * (SLOT.h + 10) + 4, BG);
    for (const [row, R] of [[0, A], [1, B]]) {
      if (!R) continue;
      const y0 = row * (SLOT.h + 10) + 2;
      text(cv, `${row ? 'NOW' : 'BEFORE'} ${R.frames.length}F ${R.total}T`, 2, y0, row ? GOLD : GREY);
      const firstHit = hits.length ? frameAt(R.cum, hits[0][0]) : -1;
      R.frames.forEach((fr, i) => {
        const x0 = 2 + i * (SLOT.w + 1);
        const t0 = i ? R.cum[i - 1] : 0;
        const act = hits.some(([a, b]) => a < R.cum[i] && b > t0);
        rect(cv, x0, y0 + 8, SLOT.w, SLOT.h, CELL);
        text(cv, i + 1, x0 + 2, y0 + 10, GREY);
        for (let k = 0; k < fr.length; k++) {
          const X = x0 + (k % SLOT.w);
          const Y = y0 + 8 + Math.floor(k / SLOT.w);
          if (fr[k] >= 0) put(cv, X, Y, i === firstHit ? RED : act ? 0xffb347 : 0xe9e4f5);
          else if (i === firstHit && ghost[k] >= 0) put(cv, X, Y, 0x4b4280);
        }
      });
    }
    writeFileSync(`${file}-sil.png`, png(scaled(cv, 2)));
  }

  // 3-1) 색 띠 (3배, 작업 확인용이라 out/revise/에만): 위 = 전, 아래 = 지금. 칸 위 = 프레임 번호·표시 틱·시작 틱, 빨강 = 판정 틱이 든 프레임.
  // 모든 프레임 그림이 든 범위만 잘라 낸다
  {
    let x0b = SLOT.w;
    let x1b = 0;
    let y0b = SLOT.h;
    for (const R of [A, B]) {
      if (!R) continue;
      for (const fr of R.frames) {
        for (let k = 0; k < fr.length; k++) {
          if (fr[k] < 0) continue;
          x0b = Math.min(x0b, k % SLOT.w);
          x1b = Math.max(x1b, k % SLOT.w);
          y0b = Math.min(y0b, Math.floor(k / SLOT.w));
        }
      }
    }
    x0b = Math.max(0, x0b - 2);
    x1b = Math.min(SLOT.w - 1, Math.max(x1b + 2, x0b + 34));
    y0b = Math.max(0, y0b - 2);
    const cw = x1b - x0b + 1;
    const chh = SLOT.h - y0b;
    const n = Math.max(A?.frames.length ?? 0, B.frames.length);
    const cv = canvas(n * (cw + 1) + 4, 2 * (chh + 8) + 4, BG);
    for (const [row, R] of [[0, A], [1, B]]) {
      if (!R) continue;
      const y0 = row * (chh + 8) + 2;
      R.frames.forEach((fr, i) => {
        const xo = 2 + i * (cw + 1);
        const t0 = i ? R.cum[i - 1] : 0;
        const act = hits.some(([a, b]) => a < R.cum[i] && b > t0);
        rect(cv, xo, y0 + 7, cw, chh, CELL);
        rect(cv, xo, y0 + 7 + SLOT.fy + 1 - y0b, cw, 1, GROUND);
        text(cv, `${i + 1}:${R.dur[i]}`, xo + 1, y0, act ? RED : row ? GOLD : GREY);
        for (let k = 0; k < fr.length; k++) {
          const X = k % SLOT.w;
          const Y = Math.floor(k / SLOT.w);
          if (fr[k] >= 0 && X >= x0b && X <= x1b && Y >= y0b) put(cv, xo + X - x0b, y0 + 7 + Y - y0b, fr[k]);
        }
      });
    }
    mkdirSync('out/revise', { recursive: true });
    writeFileSync(`out/revise/${name.replace('/', '-')}-strip.png`, png(scaled(cv, 3)));
  }

  // 4) 그림과 판정 데이터의 차이 (그림 관절로 예전 방식대로 만든 상자 vs 지금 공격 데이터): 4장 '8px 넘게 어긋나면 표에만'
  const edge = (a, b) => (a && b ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.w - b.x - b.w), Math.abs(a.y + a.h - b.y - b.h)) : null);
  let hurtDrift = 0;
  let tl = null;
  try {
    tl = NEW.sim.timelineOf(name);
  } catch {}
  if (tl) {
    for (let t = 0; t < B.total; t++) {
      const drawn = NEW.boxes.hurtBox(B.joints[frameAt(B.cum, t)]);
      const data = tl.hurt[frameAt(tl.cum, Math.min(t, tl.total - 1))];
      hurtDrift = Math.max(hurtDrift, edge(drawn, data));
    }
  }
  const hitDrift = [];
  let hammerBefore = null;
  // 판정이 연검 선인 기술 (백은우): 그 판정 구간이 시작하는 틱의 그림 리본 점 8개와 판정 선 점 8개의 가장 큰 차이 (tools/ribbon-lines.mjs와 같은 잣대)
  const PICK = [0, 1, 3, 4, 5, 6, 8, 9];
  if (mo && mo.mv.time.hits.some((h) => h.line)) {
    for (const h of mo.mv.time.hits) {
      const rib = h.line && B.joints[frameAt(B.cum, h.t[0])]?.fx?.rib;
      hitDrift.push(rib ? Math.round(Math.max(...PICK.map((k, i) => Math.hypot(rib[k][0] - h.line[i][0], rib[k][1] - h.line[i][1]))) * 10) / 10 : null);
    }
  } else if (mo && mo.mv.data.limb) {
    for (const h of mo.mv.time.hits) {
      const f = frameAt(B.cum, h.t[0]);
      let b = NEW.boxes.hitBox(B.joints[f], f, { frames: [f], limb: mo.mv.data.limb, reach: mo.mv.data.reach });
      const tb = mo.mv.data.box;
      if (b && tb) {
        const x0 = Math.min(b.x, tb.x);
        const y0 = Math.min(b.y, tb.y);
        b = { x: x0, y: y0, w: Math.max(b.x + b.w, tb.x + tb.w) - x0, h: Math.max(b.y + b.h, tb.y + tb.h) - y0 };
      }
      const data = h.box && { x: h.box[0], y: h.box[1], w: h.box[2], h: h.box[3] };
      hitDrift.push(edge(b, data));
    }
  } else if (mo && name.startsWith('edward/') && mo.mv.time.hits.some((h) => h.box)) {
    // 해머 판정 (에드워드): 판정 상자는 해머 머리가 지나는 길을 감싼 궤적 상자다. 판정 틱마다 그림 해머 머리 가운데(염동력은 뒷손, 내려찍기는 엉덩이)가 상자 밖으로 나간 거리의 최대
    const out = (R, h) => {
      let m = 0;
      for (let t = h.t[0]; t < h.t[1]; t++) {
        const j = R.joints[frameAt(R.cum, t)];
        // 염동력은 장막을 뻗는 뒷손, 내려찍기의 떨어지는 판정은 몸(엉덩이)이 판정 자리다
        const [x, y] = name === 'edward/telekinesis' ? j.hB : name === 'edward/air_slam' ? j.hip : [j.hF[0] + Math.cos(j.wa) * 30, j.hF[1] + Math.sin(j.wa) * 30];
        const [bx, by, bw, bh] = h.box;
        m = Math.max(m, Math.hypot(Math.max(bx - x, 0, x - bx - bw), Math.max(by - y, 0, y - by - bh)));
      }
      return Math.round(m * 10) / 10;
    };
    for (const h of mo.mv.time.hits) if (h.box) hitDrift.push(out(B, h));
    if (A) hammerBefore = mo.mv.time.hits.filter((h) => h.box).map((h) => out(A, h));
  }
  const r = {
    name, before: A && { frames: A.frames.length, ticks: A.total, dur: A.dur }, now: { frames: B.frames.length, ticks: B.total, dur: B.dur },
    dataTicks: mo?.mv.total ?? tl?.total ?? null, hits, hurtDrift, hitDrift, hammerBefore, tip: tipJ,
  };
  report.push(r);
  const warn = [r.dataTicks !== null && r.dataTicks !== B.total ? `틱 ${B.total} ≠ 데이터 ${r.dataTicks}` : '', hurtDrift > 8 ? `피격 ${hurtDrift}px` : '', hitDrift.some((x) => x > 8) ? `판정 ${Math.max(...hitDrift)}px` : '']
    .filter(Boolean).join(', ');
  console.log(`${warn ? '!! ' : 'OK '} ${name}: ${A ? `${A.frames.length}F ${A.total}T → ` : ''}${B.frames.length}F ${B.total}T, 피격 차이 ${hurtDrift}px${hitDrift.length ? `, 판정 차이 ${hammerBefore ? `${hammerBefore.join('/')} → ` : ''}${hitDrift.join('/')}px` : ''}${warn ? `  (${warn})` : ''}`);
}
mkdirSync('out', { recursive: true });
writeFileSync('out/revise.json', JSON.stringify(report, null, 1));

// 5) 네 캐릭터 같은 공격의 첫 판정 틱 그림 (지금 그림, 색 그대로). 줄 = 공격, 칸 = 캐릭터
if (opt.lineup) {
  const CHARS = ['raiden', 'eunwoo', 'edward', 'oscar'];
  const ROWS = [['atk1', '1'], ['atk2', '2'], ['atk3', '3'], ['atk4', '4'], ['launcher', 'UP'], ['charge', 'CHARGE'], ['skill1', 'S1'], ['skill2', 'S2'], ['super', 'SUPER']];
  const LW = 34;
  const cv = canvas(LW + CHARS.length * (SLOT.w + 1), 10 + ROWS.length * (SLOT.h + 10), BG);
  CHARS.forEach((c, k) => text(cv, c, LW + k * (SLOT.w + 1) + 2, 2, GOLD));
  ROWS.forEach(([id, label], r) => {
    const y0 = 10 + r * (SLOT.h + 10);
    text(cv, label, 2, y0 + 10, GOLD);
    CHARS.forEach((c, k) => {
      const x0 = LW + k * (SLOT.w + 1);
      rect(cv, x0, y0 + 8, SLOT.w, SLOT.h, CELL);
      rect(cv, x0, y0 + 8 + SLOT.fy + 1, SLOT.w, 1, GROUND);
      const mv = NEW.sim.movesOf(c)[id];
      if (!mv || !mv.time.hits.length) return;
      const R = render(NEW, mv.time.motion);
      if (!R) return;
      const f = frameAt(R.cum, mv.activeStart);
      blit(cv, R.frames[f], x0, y0 + 8);
      text(cv, `${mv.time.motion.slice(mv.time.motion.indexOf('/') + 1).replace(/_/g, '-')} ${f + 1}F T${mv.activeStart}`, x0 + 2, y0 + 1, GREY);
    });
  });
  writeFileSync(`${opt.out}/lineup.png`, png(scaled(cv, 2)));
  console.log(`→ ${opt.out}/lineup.png`);
}
