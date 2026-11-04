// 목업 그림 → 이펙트 실루엣 점 데이터 (src/data/vfx). 목업이 기준일 때 피크 키를 목업에서 그대로 뽑는다 (사용자 결정 2026-11-04).
//   node tools/vfxtrace.mjs --in docs/refs/effect_mockup_raiden4.png --origin 83,130 --front 135,92,26 \
//     --name RAIDEN_ATK4_PEAK --out src/data/vfx/raiden-atk4-peak.ts --check out/vfxtrace
// - 목업은 게임 화면(480×270)의 일부를 정수배로 키운 그림이어야 한다. 배수는 스스로 찾는다.
// - --origin: 목업(1배) 칸 가운데 공격자 발밑 (판정이 시작하는 틱 공격자 자리) → 데이터 좌표 (0, 0)
// - 색표 (--colors 생략 시 라이덴 목업 색): 덩어리 띠 색 4단계(안 → 밖)와 선 색. 목업 칸은 이 색과 거의 같아야 한다 (채널마다 8 안)
// - 덩어리 띠: 띠 k = '그 색이거나 더 안쪽 색'인 두꺼운 칸 → 윤곽 고리 (칸 모서리, 짝홀) → 더글러스-포이커로 줄임
// - 얇은 것 (1~2px 선: 속도선·번개 줄기·가시·테두리 번개): 색마다 이어진 칸 → 가장 긴 길부터 꺾은선으로 → 줄임
// - --front x,y,r: 이 원 안의 선은 앞 겹 (맞은 자리 가시 별: 맞는 쪽 몸 위에)
// - 확인: 뽑은 데이터를 게임 그리기 코드(src/vfx/silhouette.ts)로 다시 그려 목업과 칸마다 견준다 (--check 폴더에 그림)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { decodePng, encodePng } from './png.mjs';

const argv = process.argv.slice(2);
// --orig 그림,x,y: 목업을 칠하기 전 원래 게임 화면(1배)과 목업이 잘린 자리. 원래와 같은 칸(캐릭터)에 가려 생긴 덩어리 구멍은 메운다
// (목업에서는 이펙트가 맞는 쪽 몸 뒤로 지나가지만, 실제 피크 틱에는 몸 자세·자리가 달라 구멍이 빈 동그라미로 보인다)
const opt = { in: '', origin: '0,0', front: '', name: 'DESIGN', out: '', check: 'out/vfxtrace', eps: 0.75, lineEps: 0.6, orig: '' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i].replace(/^--/, '');
  if (a in opt) opt[a] = argv[++i];
}
const [OX0, OY0] = opt.origin.split(',').map(Number);
const front = opt.front ? opt.front.split(',').map(Number) : null;
const EPS = Number(opt.eps);
const LEPS = Number(opt.lineEps);

// ---------------------------------------------------------------- 색표 (라이덴 4타 목업)
/** 덩어리 띠 (안 → 밖): 실루엣 색 단계 번호와 색 */
const BANDS = [
  { id: 'core', step: 1, hex: '#fff6f8' },
  { id: 'rose', step: 3, hex: '#ff526e' },
  { id: 'scarlet', step: 4, hex: '#cd1634' },
  { id: 'dark', step: 6, hex: '#46081e' },
];
/** 선 색 (덩어리 띠 색도 얇은 곳은 선이 된다) */
const LINES = [
  { id: 'white', step: 0, hex: '#ffffff' },
  { id: 'core', step: 1, hex: '#fff6f8' },
  { id: 'pink', step: 2, hex: '#ff96b4' },
  { id: 'rose', step: 3, hex: '#ff526e' },
  { id: 'scarlet', step: 4, hex: '#cd1634' },
  { id: 'wine', step: 5, hex: '#961e3c' },
  { id: 'dark', step: 6, hex: '#46081e' },
  { id: 'spark', step: 7, hex: '#ff46c8' },
];
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---------------------------------------------------------------- 목업 읽기 → 1배
const src = decodePng(readFileSync(opt.in));
let S = 1;
for (let s = 6; s >= 2; s--) {
  if (src.w % s || src.h % s) continue;
  let ok = 0;
  let tot = 0;
  for (let by = 0; by + s <= src.h; by += s * 3) {
    for (let bx = 0; bx + s <= src.w; bx += s * 3) {
      tot++;
      const i0 = (by * src.w + bx) * 3;
      let same = true;
      for (let y = 0; y < s && same; y++) for (let x = 0; x < s && same; x++) {
        const i = ((by + y) * src.w + bx + x) * 3;
        if (src.d[i] !== src.d[i0] || src.d[i + 1] !== src.d[i0 + 1] || src.d[i + 2] !== src.d[i0 + 2]) same = false;
      }
      if (same) ok++;
    }
  }
  if (ok / tot > 0.95) {
    S = s;
    break;
  }
}
const W = src.w / S;
const H = src.h / S;
const px = new Uint8Array(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = ((y * S + (S >> 1)) * src.w + x * S + (S >> 1)) * 3;
  px.set(src.d.subarray(i, i + 3), (y * W + x) * 3);
}
console.log(`목업 ${src.w}×${src.h} = ${S}배 → ${W}×${H}`);

/** 칸마다: 띠 번호 (0~3, 없으면 −1), 선 색 번호 (LINES, 없으면 −1) */
const band = new Int8Array(W * H).fill(-1);
const lineCol = new Int8Array(W * H).fill(-1);
const near = (i, hex) => {
  const c = rgbOf(hex);
  return Math.abs(px[i * 3] - c[0]) <= 8 && Math.abs(px[i * 3 + 1] - c[1]) <= 8 && Math.abs(px[i * 3 + 2] - c[2]) <= 8;
};
for (let i = 0; i < W * H; i++) {
  BANDS.forEach((b, k) => { if (band[i] < 0 && near(i, b.hex)) band[i] = k; });
  LINES.forEach((b, k) => { if (lineCol[i] < 0 && near(i, b.hex)) lineCol[i] = k; });
}
const isFx = (i) => lineCol[i] >= 0;
/** 목업에서 원래 화면과 같은 칸 (칠하지 않은 캐릭터): 배경은 목업에서 어둡게 바뀌어 같지 않다 */
const kept = new Uint8Array(W * H);
if (opt.orig) {
  const [file, ax, ay] = opt.orig.split(',');
  const o = decodePng(readFileSync(file));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x + Number(ax);
    const Y = y + Number(ay);
    if (X < 0 || Y < 0 || X >= o.w || Y >= o.h) continue;
    const i = y * W + x;
    const j = (Y * o.w + X) * 3;
    if (Math.abs(o.d[j] - px[i * 3]) <= 6 && Math.abs(o.d[j + 1] - px[i * 3 + 1]) <= 6 && Math.abs(o.d[j + 2] - px[i * 3 + 2]) <= 6) kept[i] = 1;
  }
}

// ---------------------------------------------------------------- 두꺼운 덩어리 (2×2로 깎고, 붙은 칸을 되살리고, 선이 지나간 구멍은 메운다)
const inN = (x, y) => x >= 0 && y >= 0 && x < W && y < H && band[y * W + x] >= 0;
const thick = new Uint8Array(W * H);
for (let y = 0; y + 1 < H; y++) for (let x = 0; x + 1 < W; x++) {
  if (inN(x, y) && inN(x + 1, y) && inN(x, y + 1) && inN(x + 1, y + 1)) {
    thick[y * W + x] = thick[y * W + x + 1] = thick[(y + 1) * W + x] = thick[(y + 1) * W + x + 1] = 1;
  }
}
const fill = new Int8Array(W * H).fill(-1);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (thick[i]) fill[i] = band[i];
  else if (band[i] >= 0) {
    const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => thick[(y + dy) * W + x + dx] && x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H).length;
    if (n4 >= 2) fill[i] = band[i];
  }
}
// 캐릭터에 가린 덩어리: 원래 화면과 같은 칸(캐릭터)인데 같은 줄 왼쪽·오른쪽 14px 안에 모두 덩어리가 있으면
// 덩어리가 그 뒤로 이어진다고 보고 메운다 (양쪽 띠 색 중 바깥쪽 색: 흰 심이 번지지 않게). 찢어진 틈(배경 칸)은 그대로 둔다
{
  const R = 14;
  const side = (x, y, dx) => {
    for (let k = 1; k <= R; k++) {
      const X = x + dx * k;
      if (X < 0 || X >= W) return -1;
      const j = y * W + X;
      if (fill[j] >= 0) return fill[j];
      if (!kept[j] && !isFx(j)) return -1;
    }
    return -1;
  };
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (fill[i] >= 0 || !kept[i]) continue;
    const a = side(x, y, -1);
    const b = side(x, y, 1);
    if (a >= 0 && b >= 0) add.push([i, Math.max(a, b)]);
  }
  for (const [i, b] of add) fill[i] = b;
}

// 구멍: 덩어리 밖과 이어지지 않은 칸 묶음 (4방향). 모두 이펙트 칸이면 (선이 덩어리 위를 지나간 자리) 둘레 띠 색으로 메운다
{
  const seen = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (fill[s] >= 0 || seen[s]) continue;
    const q = [s];
    seen[s] = 1;
    const comp = [];
    let border = false;
    let allFx = true;
    while (q.length) {
      const i = q.pop();
      comp.push(i);
      const x = i % W;
      const y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      if (!isFx(i) && !kept[i]) allFx = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx;
        const Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X;
        if (fill[j] < 0 && !seen[j]) {
          seen[j] = 1;
          q.push(j);
        }
      }
    }
    // 아주 작은 구멍 (6칸 이하: 캐릭터 눈·목 같은 자국)은 무엇이든 메운다
    if (border || ((!allFx || comp.length > 160) && comp.length > 6)) continue;
    // 둘레 띠 색 중 가장 많은 색으로 (같으면 바깥쪽 색: 흰 심이 번지지 않게)
    for (let pass = 0; pass < 12; pass++) {
      const set = [];
      for (const i of comp) {
        if (fill[i] >= 0) continue;
        const x = i % W;
        const y = (i / W) | 0;
        const n = [0, 0, 0, 0];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (y + dy) * W + x + dx;
          if (fill[j] >= 0) n[fill[j]]++;
        }
        let best = -1;
        for (let b = 0; b < 4; b++) if (n[b] && (best < 0 || n[b] >= n[best])) best = b;
        if (best >= 0) set.push([i, best]);
      }
      for (const [i, b] of set) fill[i] = b;
    }
  }
}

// ---------------------------------------------------------------- 윤곽 고리 (칸 모서리를 따라, 짝홀)
function traceRings(mask) {
  // 방향 있는 변: 칸 오른쪽에 영역을 두고 돈다 (화면 y 아래로 +)
  const out = new Map();
  const add = (x0, y0, x1, y1) => {
    const k = y0 * (W + 1) + x0;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push([x1, y1]);
  };
  const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m(x, y)) continue;
    if (!m(x, y - 1)) add(x, y, x + 1, y);
    if (!m(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!m(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!m(x - 1, y)) add(x, y + 1, x, y);
  }
  const rings = [];
  for (const [k0, list] of out) {
    while (list.length) {
      let [x, y] = [k0 % (W + 1), Math.floor(k0 / (W + 1))];
      const ring = [[x, y]];
      let [nx, ny] = list.pop();
      let guard = 0;
      while (!(nx === ring[0][0] && ny === ring[0][1]) && guard++ < 100000) {
        const dx0 = nx - x;
        const dy0 = ny - y;
        x = nx;
        y = ny;
        ring.push([x, y]);
        const cand = out.get(y * (W + 1) + x);
        // 갈림길 (대각선으로 닿은 칸): 오른쪽으로 꺾는 변 먼저
        let pick = 0;
        if (cand.length > 1) {
          let bestScore = -9;
          cand.forEach(([cx, cy], j) => {
            const dx1 = cx - x;
            const dy1 = cy - y;
            const cross = dx0 * dy1 - dy0 * dx1;
            if (cross > bestScore) {
              bestScore = cross;
              pick = j;
            }
          });
        }
        [nx, ny] = cand.splice(pick, 1)[0];
      }
      rings.push(ring);
    }
  }
  return rings;
}
/** 같은 직선 위 점 빼기 */
function dropCollinear(r) {
  const o = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[(i - 1 + r.length) % r.length];
    const b = r[i];
    const c = r[(i + 1) % r.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) o.push(b);
  }
  return o;
}
function dpOpen(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const L = Math.hypot(bx - ax, by - ay) || 1;
  let dmax = -1;
  let k = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = L > 1e-9 ? Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
    if (d > dmax) {
      dmax = d;
      k = i;
    }
  }
  if (dmax <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dpOpen(pts.slice(0, k + 1), eps).slice(0, -1), ...dpOpen(pts.slice(k), eps)];
}
function dpRing(r, eps) {
  if (r.length < 4) return r;
  // 가장 먼 두 점으로 나눠 양쪽을 줄인다
  let far = 0;
  let fd = -1;
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]);
    if (d > fd) {
      fd = d;
      far = i;
    }
  }
  const a = dpOpen(r.slice(0, far + 1), eps);
  const b = dpOpen([...r.slice(far), r[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
const area = (r) => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [x0, y0] = r[i];
    const [x1, y1] = r[(i + 1) % r.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
};

const parts = [];
for (let k = BANDS.length - 1; k >= 0; k--) {
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (fill[i] >= 0 && fill[i] <= k) mask[i] = 1;
  const rings = traceRings(mask)
    .map((r) => dpRing(dropCollinear(r), EPS))
    .filter((r) => r.length >= 3 && Math.abs(area(r)) >= 1.5)
    .map((r) => r.flatMap(([x, y]) => [x - OX0, y - OY0]));
  if (rings.length) parts.push({ id: `band-${BANDS[k].id}`, step: BANDS[k].step, kind: 'fill', layer: 'back', rings });
}

// ---------------------------------------------------------------- 얇은 것 → 꺾은선
const thin = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (isFx(i) && fill[i] < 0) thin[i] = 1;
// 덩어리 위를 지나간 선 (메운 칸이지만 색이 선 색인 칸: 흰 줄·자홍 가시·속도선): 덩어리 위에 다시 그린다
for (let i = 0; i < W * H; i++) if (fill[i] >= 0 && lineCol[i] >= 0 && band[i] < 0) thin[i] = 1;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const lineParts = new Map();
for (let c = 0; c < LINES.length; c++) {
  const left = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (thin[i] && lineCol[i] === c) left[i] = 1;
  const bfs = (s) => {
    const dist = new Map([[s, 0]]);
    const par = new Map();
    const q = [s];
    let last = s;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      last = i;
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of N8) {
        const X = x + dx;
        const Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X;
        if (left[j] && !dist.has(j)) {
          dist.set(j, dist.get(i) + 1);
          par.set(j, i);
          q.push(j);
        }
      }
    }
    return { last, par };
  };
  for (let s = 0; s < W * H; s++) {
    while (left[s]) {
      const a = bfs(s).last;
      const { last: b, par } = bfs(a);
      const path = [b];
      while (path[path.length - 1] !== a) path.push(par.get(path[path.length - 1]));
      for (const i of path) left[i] = 0;
      const pts = dpOpen(path.map((i) => [i % W, (i / W) | 0]), LEPS);
      const cx = pts.reduce((v, p) => v + p[0], 0) / pts.length;
      const cy = pts.reduce((v, p) => v + p[1], 0) / pts.length;
      const layer = front && Math.hypot(cx - front[0], cy - front[1]) <= front[2] ? 'front' : 'back';
      const key = `${c}|${layer}`;
      if (!lineParts.has(key)) lineParts.set(key, { id: `line-${LINES[c].id}${layer === 'front' ? '-front' : ''}`, step: LINES[c].step, kind: 'line', layer, rings: [] });
      lineParts.get(key).rings.push(pts.flatMap(([x, y]) => [x - OX0, y - OY0]));
    }
  }
}
// 선 그리는 순서: 뒤 겹은 어두운 색부터, 앞 겹은 그 위
const lp = [...lineParts.values()].sort((p, q) => (p.layer === q.layer ? q.step - p.step : p.layer === 'back' ? -1 : 1));
parts.push(...lp);

// ---------------------------------------------------------------- 게임 그리기 코드로 다시 그려 견주기
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const SIL = await vite.ssrLoadModule('/src/vfx/silhouette.ts');
await vite.close();
const ramp = [...new Set(LINES.map((l) => l.hex))].map((h) => {
  const [r, g, b] = rgbOf(h);
  return (255 << 24) | (b << 16) | (g << 8) | r;
});
const stepHex = new Map(LINES.map((l) => [l.step, l.hex]));
const design = { keys: [{ name: 'peak', at: 0 }], end: 1, center: [0, 0], parts: parts.map((p) => ({ ...p, keys: { peak: p.rings } })) };
const frame = { w: W, h: H, ox: 0, oy: 0, color: new Uint32Array(W * H), light: new Uint32Array(W * H), mark: new Uint8Array(W * H), box: [W, H, -1, -1] };
const fx = SIL.default({ design, ramp: [...Array(8)].map((_, s) => { const [r, g, b] = rgbOf(stepHex.get(s)); return (255 << 24) | (b << 16) | (g << 8) | r; }), offset: [OX0, OY0], facing: 1 });
fx.draw(frame, 'back');
fx.draw(frame, 'front');
let agree = 0;
let fxN = 0;
let extra = 0;
let miss = 0;
for (let i = 0; i < W * H; i++) {
  const want = isFx(i);
  const got = frame.color[i] >>> 24 ? frame.color[i] : 0;
  if (want) fxN++;
  if (want && got) {
    const r = got & 255;
    const g = (got >>> 8) & 255;
    const b = (got >>> 16) & 255;
    if (Math.abs(r - px[i * 3]) <= 8 && Math.abs(g - px[i * 3 + 1]) <= 8 && Math.abs(b - px[i * 3 + 2]) <= 8) agree++;
  } else if (want) miss++;
  else if (got) extra++;
}
const nPts = parts.reduce((v, p) => v + p.rings.reduce((u, r) => u + r.length / 2, 0), 0);
console.log(`조각 ${parts.length}개 (띠 ${parts.filter((p) => p.kind === 'fill').length}, 선 ${parts.filter((p) => p.kind === 'line').length}), 고리·선 ${parts.reduce((v, p) => v + p.rings.length, 0)}개, 점 ${nPts}개`);
console.log(`목업 이펙트 칸 ${fxN}: 같은 색 ${agree} (${((agree / fxN) * 100).toFixed(1)}%), 빠짐 ${miss}, 목업에 없는 칸 ${extra}`);
for (const p of parts) console.log(`  ${p.id} (${p.kind}, ${p.layer}, 단계 ${p.step}): ${p.rings.length}개, 점 ${p.rings.reduce((u, r) => u + r.length / 2, 0)}`);
if (opt.check) {
  mkdirSync(opt.check, { recursive: true });
  // 목업 이펙트만 | 다시 그린 것 | 다른 칸 (빨강 = 빠짐, 파랑 = 더 칠함, 노랑 = 색 다름), 4배
  const Z = 4;
  const o = new Uint8Array(W * Z * 3 * H * Z * 3);
  const OW = W * Z * 3;
  const set = (x, y, rgb) => {
    for (let yy = 0; yy < Z; yy++) for (let xx = 0; xx < Z; xx++) o.set(rgb, ((y * Z + yy) * OW + x * Z + xx) * 3);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const bg = [14, 12, 22];
    set(x, y, isFx(i) ? [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]] : bg);
    const got = frame.color[i] >>> 24 ? frame.color[i] : 0;
    set(x + W, y, got ? [got & 255, (got >>> 8) & 255, (got >>> 16) & 255] : bg);
    let d = [24, 22, 30];
    if (isFx(i) && !got) d = [255, 60, 60];
    else if (!isFx(i) && got) d = [60, 120, 255];
    else if (isFx(i) && got && !(Math.abs((got & 255) - px[i * 3]) <= 8 && Math.abs(((got >>> 8) & 255) - px[i * 3 + 1]) <= 8 && Math.abs(((got >>> 16) & 255) - px[i * 3 + 2]) <= 8)) d = [255, 220, 60];
    else if (isFx(i)) d = [70, 70, 80];
    set(x + W * 2, y, d);
  }
  writeFileSync(`${opt.check}/trace-check.png`, encodePng(OW, H * Z, o));
  console.log(`    ${opt.check}/trace-check.png`);
}

// ---------------------------------------------------------------- 데이터 파일
if (opt.out) {
  const fmt = (r) => `[${r.join(', ')}]`;
  const body = parts
    .map((p) => `    {\n      id: '${p.id}', step: ${p.step}, kind: '${p.kind}', layer: '${p.layer}',\n      keys: {\n        peak: [\n${p.rings.map((r) => `          ${fmt(r)},`).join('\n')}\n        ],\n      },\n    },`)
    .join('\n');
  const ts = `// 자동 생성: tools/vfxtrace.mjs (${opt.in}, ${S}배, 공격자 발밑 = 목업 칸 ${OX0},${OY0}). 손으로 고쳐도 된다.
//   node tools/vfxtrace.mjs ${argv.join(' ')}
//   (--orig: 목업을 칠하기 전 게임 화면 = fxcheck --peak가 남기는 맞기 1틱 전 프레임)
// 피크 키만 있다. 점: fill = 칸 모서리 고리 (짝홀), line = 칸 번호 꺾은선 (data/vfx/types).
import type { VPart } from './types';

export const ${opt.name}: readonly VPart[] = [
${body}
];
`;
  writeFileSync(opt.out, ts);
  console.log(`    ${opt.out} (${(ts.length / 1024).toFixed(1)}KB)`);
}
