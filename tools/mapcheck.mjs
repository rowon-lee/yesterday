// 맵 검사 (docs/맵아트지침서.md 12장의 자동 검사 다섯 가지). 화면 한 장(480×270)의 색과 칸마다 카메라에서의 거리,
// 간판·글자 자리 목록(window.__debug.mapProbe())을 받아 잰다.
//   1. 외곽선: 형태 경계(깊이가 크게 바뀌는 곳)를 따라 양옆보다 어두운 1px 선이 이어지는가
//   2. 큰 네모 픽셀: 색 덩어리가 2~4px 크기로만 바뀌는 (그림을 키워 쓴) 곳. 간판 글자 자리는 뺀다
//   3. 디더: 두 색이 번갈아 나오는 무늬가 넓은 면(8×8 넘게)을 덮은 비율
//   4. 명도: 흑백 히스토그램, 광원(200 이상) 비율, 겹(하늘·먼 겹·중간 겹·싸우는 줄·앞겹)별 평균 밝기와 겹 경계의 밝기 차
//   5. 글자: 글자가 판보다 넓은지, 화면 가장자리에서 반쯤 잘리는지, 같은 깊이 글자끼리 겹치는지, 같은 문구가 한 화면에 두 번인지
// 흑백은 compare와 같은 식 (0.299R + 0.587G + 0.114B).

/** 맵 촬영 자리: 지면(y=270)·위층(y=0), CAM 0부터 460 간격 (지침서 12장 5) */
export const MAP_CAMS = Array.from({ length: 14 }, (_, i) => Math.min(i * 460, 5920));
export const MAP_HEIGHTS = [
  { id: 'ground', camy: 270, name: '지면' },
  { id: 'upper', camy: 0, name: '위층' },
];

const DIST = 3000;
const FAR = 140000;
export const CLASS_NAMES = ['하늘', '먼 겹', '중간 겹', '싸우는 줄', '앞겹'];

/** 기준 (지침서 4장 명도 다섯 단계, 12장 검사) */
export const LIMITS = {
  outline: 2, // 형태 경계 중 외곽선이 그어진 비율 (%) 이하
  bigPixels: 0.5, // 큰 네모 픽셀 면적 (%) 이하
  dither: 3, // 넓은 면 디더 면적 (%) 이하
  lights: [2, 5], // 흑백 200 이상 비율 (%)
  far: [15, 40],
  mid: [25, 60],
};

export function decodeProbe(p) {
  const rgba = Uint8Array.from(Buffer.from(p.rgba, 'base64'));
  const db = Buffer.from(p.depth, 'base64');
  const depth = new Float32Array(db.buffer.slice(db.byteOffset, db.byteOffset + db.byteLength));
  return { ...p, rgba, depth };
}

const luma = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

function classOf(d, camZ) {
  if (d >= FAR * 0.999) return 0;
  const z = camZ - d;
  if (z < -40000) return 0;
  if (z < -4500) return 1;
  if (z < -650) return 2;
  if (z < 120) return 3;
  return 4;
}

/** 간판 자리 → 화면 사각형 [x0, y0, x1, y1] (화면 위가 0) */
function signRect(s, probe) {
  if (s.layer) {
    return [s.x0 - probe.view.x * s.layer, s.y0 - probe.view.y * s.layer, s.x1 - probe.view.x * s.layer, s.y1 - probe.view.y * s.layer];
  }
  const k = DIST / (DIST - s.z);
  const sx = (x) => probe.w / 2 + (x - probe.cam.x) * k;
  const sy = (y) => probe.h / 2 - (y - probe.cam.y) * k;
  return [sx(s.x0), sy(s.y1), sx(s.x1), sy(s.y0)];
}

export function analyze(probe) {
  const { w, h, rgba, depth } = probe;
  const n = w * h;
  const L = new Float32Array(n);
  const col = new Uint32Array(n);
  const cls = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = luma(rgba, i * 4);
    col[i] = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    cls[i] = classOf(depth[i], probe.cam.z);
  }
  const jump = (a, b) => {
    const da = depth[a];
    const db = depth[b];
    return Math.abs(da - db) > Math.max(12, 0.004 * Math.min(da, db));
  };
  /**
   * 바닥처럼 깊이가 줄마다 고르게 변하는 면인가: 후보 칸(i) 양옆 a·b 너머(aa·bb)에서도 깊이가 같은 빠르기로 이어지면
   * 끊긴 곳(형태의 경계)이 아니다 (젖은 바닥의 빗물 무늬·반사 줄을 외곽선으로 세지 않게)
   */
  const ramp = (aa, a, b, bb) => {
    const across = Math.abs(depth[a] - depth[b]) / 2;
    return Math.abs(depth[aa] - depth[a]) > 0.5 * across && Math.abs(depth[b] - depth[bb]) > 0.5 * across;
  };

  // 1. 외곽선
  const cand = new Uint8Array(n); // 1: 세로선 후보, 2: 가로선 후보
  let boundary = 0;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (jump(i, i + 1) || jump(i, i + w)) boundary++;
      if (L[i] < Math.min(L[i - 1], L[i + 1]) - 6 && jump(i - 1, i + 1) && !ramp(i - 2, i - 1, i + 1, i + 2)) cand[i] |= 1;
      if (L[i] < Math.min(L[i - w], L[i + w]) - 6 && jump(i - w, i + w) && !ramp(i - 2 * w, i - w, i + w, i + 2 * w)) cand[i] |= 2;
    }
  }
  const outlineMask = new Uint8Array(n);
  // 선으로 3칸 넘게 이어진 것만
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y <= h; y++) {
      const on = y < h && cand[y * w + x] & 1;
      if (on) run++;
      else {
        if (run >= 3) for (let k = 1; k <= run; k++) outlineMask[(y - k) * w + x] = 1;
        run = 0;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      const on = x < w && cand[y * w + x] & 2;
      if (on) run++;
      else {
        if (run >= 3) for (let k = 1; k <= run; k++) outlineMask[y * w + x - k] = 1;
        run = 0;
      }
    }
  }
  let outlinePx = 0;
  for (let i = 0; i < n; i++) outlinePx += outlineMask[i];
  const outline = { px: outlinePx, boundary, pct: boundary ? (outlinePx / boundary) * 100 : 0 };

  // 간판 자리 (큰 픽셀 검사에서 빼고, 글자 검사에 쓴다)
  const signMask = new Uint8Array(n);
  const visible = [];
  for (const s of probe.signs) {
    const r = signRect(s, probe);
    const vis = r[2] > 0 && r[0] < w && r[3] > 0 && r[1] < h;
    if (!vis) continue;
    // 다른 것에 가려진 간판은 뺀다: 화면에 든 자리 중 깊이가 간판 깊이와 맞는 칸이 30%는 돼야 보이는 것
    const want = DIST - (s.layer ? DIST * (1 - 1 / s.layer) : s.z);
    const tol = Math.max(15, want * 0.03);
    let seen = 0;
    let all = 0;
    for (let y = Math.max(0, Math.floor(r[1])); y < Math.min(h, Math.ceil(r[3])); y++) {
      for (let x = Math.max(0, Math.floor(r[0])); x < Math.min(w, Math.ceil(r[2])); x++) {
        all++;
        if (Math.abs(depth[y * w + x] - want) < tol) seen++;
      }
    }
    if (!all || seen / all < 0.3) continue;
    visible.push({ s, r });
    for (let y = Math.max(0, Math.floor(r[1]) - 2); y < Math.min(h, Math.ceil(r[3]) + 2); y++) {
      for (let x = Math.max(0, Math.floor(r[0]) - 2); x < Math.min(w, Math.ceil(r[2]) + 2); x++) signMask[y * w + x] = 1;
    }
  }

  // 2. 큰 네모 픽셀: 16×16 칸마다 같은 색이 이어지는 길이. 1칸짜리가 거의 없고 2~4칸짜리가 대부분이면 키운 그림
  const bigMask = new Uint8Array(n);
  let bigWin = 0;
  const B = 16;
  for (let y0 = 0; y0 + B <= h; y0 += B) {
    for (let x0 = 0; x0 + B <= w; x0 += B) {
      let signs = 0;
      for (let y = y0; y < y0 + B; y++) for (let x = x0; x < x0 + B; x++) signs += signMask[y * w + x];
      if (signs > (B * B) / 4) continue;
      // 가로 줄과 세로 줄을 따로 센다: 키운 그림은 두 방향 모두 2~4칸 덩어리다
      // (넓은 단색 벽에 2~3칸 굵기 가로 띠만 있는 곳은 세로로만 2~3칸이라 빠진다)
      const runs = (horizontal) => {
        const r = { total: 0, one: 0, mid: 0 };
        for (let a = 0; a < B; a++) {
          let len = 1;
          let first = true;
          for (let b = 1; b < B; b++) {
            const i = horizontal ? (y0 + a) * w + x0 + b : (y0 + b) * w + x0 + a;
            const j = horizontal ? i - 1 : i - w;
            if (col[i] === col[j]) len++;
            else {
              if (!first) {
                r.total++;
                if (len === 1) r.one++;
                else if (len <= 4) r.mid++;
              }
              first = false;
              len = 1;
            }
          }
        }
        return r;
      };
      const big = (r) => r.total >= 8 && r.one / r.total < 0.05 && r.mid / r.total >= 0.6;
      if (big(runs(true)) && big(runs(false))) {
        bigWin++;
        for (let y = y0; y < y0 + B; y++) for (let x = x0; x < x0 + B; x++) bigMask[y * w + x] = 1;
      }
    }
  }
  const bigPixels = { windows: bigWin, pct: ((bigWin * B * B) / n) * 100 };

  // 3. 디더: 칸마다 '번갈아 나오기' (가로 A B A 또는 세로 A B A). 8×8 칸의 40% 넘게 번갈아 나오면 넓은 면 디더
  const alt = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 2 < w && col[i] !== col[i + 1] && col[i] === col[i + 2]) alt[i] = 1;
      else if (y + 2 < h && col[i] !== col[i + w] && col[i] === col[i + 2 * w]) alt[i] = 1;
    }
  }
  const ditherMask = new Uint8Array(n);
  for (let y0 = 0; y0 + 8 <= h; y0 += 4) {
    for (let x0 = 0; x0 + 8 <= w; x0 += 4) {
      let a = 0;
      for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) a += alt[y * w + x];
      if (a >= 26) for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) ditherMask[y * w + x] = 1;
    }
  }
  let ditherPx = 0;
  for (let i = 0; i < n; i++) ditherPx += ditherMask[i];
  const dither = { pct: (ditherPx / n) * 100 };

  // 4. 명도
  const hist = new Array(16).fill(0);
  let lights = 0;
  const sum = [0, 0, 0, 0, 0];
  const cnt = [0, 0, 0, 0, 0];
  const fight = [];
  for (let i = 0; i < n; i++) {
    hist[Math.min(15, Math.floor(L[i] / 16))]++;
    if (L[i] >= 200) lights++;
    sum[cls[i]] += L[i];
    cnt[cls[i]]++;
    if (cls[i] === 3) fight.push(L[i]);
  }
  fight.sort((a, b) => a - b);
  const pct = (arr, q) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q))] : 0);
  // 겹 경계의 밝기 차 (하늘|먼 겹, 먼 겹|중간 겹, 중간 겹|싸우는 줄): 실루엣이 갈라지는지
  const edge = {};
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      for (const j of [i + 1, i + w]) {
        const a = cls[i];
        const b = cls[j];
        if (a === b) continue;
        const key = `${Math.min(a, b)}|${Math.max(a, b)}`;
        edge[key] ??= { sum: 0, n: 0 };
        edge[key].sum += Math.abs(L[i] - L[j]);
        edge[key].n++;
      }
    }
  }
  const value = {
    hist: hist.map((v) => (v / n) * 100),
    lightsPct: (lights / n) * 100,
    mean: sum.map((v, k) => (cnt[k] ? v / cnt[k] : null)),
    share: cnt.map((v) => (v / n) * 100),
    fight: { p10: pct(fight, 0.1), p50: pct(fight, 0.5), p90: pct(fight, 0.9) },
    edge: Object.fromEntries(Object.entries(edge).filter(([, v]) => v.n >= 40).map(([k, v]) => [k, v.sum / v.n])),
  };

  // 5. 글자
  const text = { cut: [], overlap: [], dup: [], overflow: [] };
  const seen = new Map();
  for (const { s, r } of visible) {
    const inside = r[0] >= 0 && r[2] <= w && r[1] >= 0 && r[3] <= h;
    if (!inside) text.cut.push(s.text);
    if (s.textW > s.plateW + 0.5) text.overflow.push(s.text);
    seen.set(s.text, (seen.get(s.text) ?? 0) + 1);
  }
  for (const [t, c] of seen) if (c > 1) text.dup.push(`${t}×${c}`);
  for (let a = 0; a < visible.length; a++) {
    for (let b = a + 1; b < visible.length; b++) {
      const A = visible[a];
      const Bv = visible[b];
      if (!!A.s.layer !== !!Bv.s.layer || Math.abs(A.s.z - Bv.s.z) > 60) continue;
      const ix = Math.min(A.r[2], Bv.r[2]) - Math.max(A.r[0], Bv.r[0]);
      const iy = Math.min(A.r[3], Bv.r[3]) - Math.max(A.r[1], Bv.r[1]);
      if (ix > 1 && iy > 1) text.overlap.push(`${A.s.text}/${Bv.s.text}`);
    }
  }

  return { outline, bigPixels, dither, value, text, masks: { outlineMask, bigMask, ditherMask } };
}

/** 한 화면 결과의 NG 목록 */
export function problems(a) {
  const out = [];
  if (a.outline.pct > LIMITS.outline) out.push(`외곽선 ${a.outline.pct.toFixed(1)}%`);
  if (a.bigPixels.pct > LIMITS.bigPixels) out.push(`큰 네모 픽셀 ${a.bigPixels.pct.toFixed(1)}%`);
  if (a.dither.pct > LIMITS.dither) out.push(`넓은 면 디더 ${a.dither.pct.toFixed(1)}%`);
  const lp = a.value.lightsPct;
  if (lp < LIMITS.lights[0] || lp > LIMITS.lights[1]) out.push(`광원 ${lp.toFixed(1)}%`);
  const [, far, mid] = a.value.mean;
  const [, farShare, midShare] = a.value.share;
  if (far !== null && farShare >= 3 && (far < LIMITS.far[0] || far > LIMITS.far[1])) out.push(`먼 겹 ${far.toFixed(0)}`);
  if (mid !== null && midShare >= 3 && (mid < LIMITS.mid[0] || mid > LIMITS.mid[1])) out.push(`중간 겹 ${mid.toFixed(0)}`);
  if (a.text.cut.length) out.push(`잘린 글자 ${a.text.cut.join(',')}`);
  if (a.text.overlap.length) out.push(`겹친 글자 ${a.text.overlap.join(',')}`);
  if (a.text.dup.length) out.push(`같은 문구 ${a.text.dup.join(',')}`);
  if (a.text.overflow.length) out.push(`판보다 넓은 글자 ${a.text.overflow.join(',')}`);
  return out;
}

/** 표 한 줄 (checks.md) */
export function row(label, a) {
  const m = a.value.mean.map((v) => (v === null ? '-' : v.toFixed(0))).join(' / ');
  const e = ['0|1', '1|2', '2|3'].map((k) => (a.value.edge[k] === undefined ? '-' : a.value.edge[k].toFixed(0))).join(' / ');
  const p = problems(a);
  return `| ${label} | ${a.outline.pct.toFixed(1)} | ${a.bigPixels.pct.toFixed(1)} | ${a.dither.pct.toFixed(1)} | ${a.value.lightsPct.toFixed(1)} | ${m} | ${e} | ${a.value.fight.p10.toFixed(0)}·${a.value.fight.p50.toFixed(0)}·${a.value.fight.p90.toFixed(0)} | ${p.length ? p.join('; ') : 'OK'} |`;
}

export const TABLE_HEAD = [
  '| 화면 | 외곽선 % | 큰 픽셀 % | 넓은 디더 % | 광원 % (2~5) | 평균 밝기 하늘/먼/중간/싸우는 줄/앞 | 겹 경계 차 하늘·먼/먼·중간/중간·싸우는 | 싸우는 줄 p10·50·90 | 문제 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];
