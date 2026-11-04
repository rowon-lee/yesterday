// 동작 점검 (애니메이션 재수정 지침 0장, docs/motions/애니메이션재수정지침.md): 모든 동작의 문제 신호를 코드로 검사해
// docs/motions/점검표.md를 쓰고, 캐릭터마다 모든 동작의 단색 실루엣 띠를 previews/motions/silhouette-<캐릭터>.png로 뽑는다.
//   npm run motioncheck                       검사 → 점검표 + 실루엣 띠 + out/motioncheck.json(숫자 전부)
//   npm run motioncheck -- --only raiden/jab  그 동작의 숫자를 자세히 (콘솔만, 파일은 쓰지 않는다)
//   npm run motioncheck -- --no-png           점검표만
// 그림 데이터(포즈 → 관절, 장식)만 읽는다. 공격 데이터·이펙트·sim은 읽기만 한다 (판정 프레임으로 타격 프레임을 찾는다).
// 좌표는 발밑 기준점 상대 px, 오른쪽을 보는 기준(앞 = +x), 아래가 +y. 프레임 번호는 보고할 때 1부터 (시트와 같다).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const only = valuesOf('--only');
const noPng = argv.includes('--no-png');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const load = (p) => vite.ssrLoadModule(p);
const { MOTION_DATA } = await load('/src/data/poses/index.ts');
const { MOTIONS } = await load('/src/anim/motions.ts');
const { smeared } = await load('/src/anim/bake.ts');
const { drawSkeleton } = await load('/src/anim/skeleton.ts');
const { Indexed } = await load('/src/anim/raster.ts');
const { SKINS, skinForMotion } = await load('/src/anim/skins.ts');
const { hammerHead } = await load('/src/anim/decor/edward.ts');
const { CHARACTERS } = await load('/src/data/characters/index.ts');
const { BASE_MOVES } = await load('/src/data/moves/base.ts');
const { glyphRows } = await load('/src/render/font.ts');
await vite.close();

// ───────────────────────── 기준 (지침 0·1·2·3장, 동작연출지침서 2·3장) ─────────────────────────

/** 1장 보호 목록: 등급만 적고 고치지 않는다. 에드워드 '껍데기'는 고유 특성(렌더 이펙트)이라 동작이 없다 */
const PROTECTED = {
  'raiden/axe_kick': '도끼차기', 'raiden/leg_sweep': '쓸기', 'raiden/flying_knee': '대시 공격',
  'raiden/air_jab': '공중 1타', 'raiden/air_cross': '공중 2타', 'raiden/air_roundhouse': '공중 3타', 'raiden/zanhen': '잔흔',
  'eunwoo/air_flick': '공중 1타', 'eunwoo/air_rise': '공중 2타', 'eunwoo/air_spin': '공중 3타',
  'edward/super': '필살기 껍데기 뒤집어쓰기', 'edward/super_lift': '필살기 껍데기 뒤집어쓰기', 'edward/super_absorb': '필살기 껍데기 뒤집어쓰기',
  'edward/super_release': '필살기 껍데기 뒤집어쓰기', 'edward/super_lifted': '필살기 껍데기 뒤집어쓰기', 'edward/super_drained': '필살기 껍데기 뒤집어쓰기',
  'edward/super_dropped': '필살기 껍데기 뒤집어쓰기',
  'oscar/walk_f': '걷기', 'oscar/walk_b': '걷기', 'oscar/dash': '대시(월영)', 'oscar/jump2': '검영 밟기',
  'oscar/wall_cling': '벽 기동', 'oscar/wall_jump': '벽 기동', 'oscar/wall_run': '벽 기동', 'oscar/wall_kick': '벽 기동', 'oscar/wall_tech': '벽 기동',
};

/** 재수정 전에 이미 승인된 동작 (docs/motions/승인목록.md 위 표들). 1장 보호 목록은 아니지만 등급 칸에 적는다 */
const APPROVED = {
  'common/hit_light': '2026-11-01', 'common/hit_heavy': '2026-11-01', 'common/guard_crush': '2026-11-01', 'common/hit_air': '2026-11-01',
  'common/knockdown': '2026-11-01', 'common/getup': '2026-11-01', 'common/tech': '2026-11-01',
  'base/wall_cling': '2026-10-31', 'base/wall_jump': '2026-10-31', 'base/wall_run': '2026-10-31', 'base/wall_kick': '2026-10-31', 'base/wall_tech': '2026-10-31',
  'base/dash_attack': '2026-11-01', 'base/charge': '2026-11-01',
};

/**
 * 등급 판단 (사람이 실루엣 띠를 보고 자동 등급을 바꾼 것만): 이름 → [등급, 이유].
 * 자동 등급은 아래 점수 규칙. 그림을 다시 깎은 뒤에는 이 표를 비우고 다시 본다.
 */
const JUDGED = {
  'eunwoo/goodwill': ['B', '발동은 치는 동작이 아니라 눈을 감고 연검을 내리는 동작(동작연출지침서 11-5)이라 감기·지나치기·직선·몸통 신호가 맞지 않음. 12~14 눌림·간격만 본다'],
};

/** 동작연출지침서 3장 프레임 수 참고값 (규칙이 아니라 참고값: 벗어나면 '12~14에 눌림' 후보) */
const RANGE = { fast: [6, 10], normal: [10, 16], heavy: [16, 24], skill: [16, 30], loop: [8, 24] };
const KIND_LABEL = {
  fast: '빠른 타격', normal: '일반 평타', heavy: '큰 휘두르기', skill: '차지·스킬', loop: '반복', hit: '맞는 동작', show: '연출', move: '이동·기본',
};

/** 신호 (지침 0장 순서) */
const SIG = {
  dup: { ko: '복사로 길이 채움', code: 'DUP', pt: 1 },
  wind: { ko: '감기 없음', code: 'WIND', pt: 2 },
  over: { ko: '지나치기 없음', code: 'OVER', pt: 2 },
  line: { ko: '직선 궤적', code: 'LINE', pt: 1 },
  even: { ko: '일정한 간격', code: 'EVEN', pt: 1 },
  body: { ko: '몸통 고정', code: 'BODY', pt: 2 },
  sec: { ko: '2차 동작 없음', code: 'SEC', pt: 1 },
  sil: { ko: '실루엣 겹침', code: 'SIL', pt: 2 },
  press: { ko: '12~14에 눌림', code: 'PRESS', pt: 1 },
};
/** 임계값 (px·비율). 지침 0장 문장을 숫자로 옮긴 것 */
const T = {
  dupPx: 1, // 복사: 앞 프레임과 모든 관절 차이가 이 px 이하
  windPx: 2, // 감기: 타격 앞 1~4프레임 안에 끝·치는 쪽 어깨·엉덩이 중 하나가 공격 반대쪽으로 이만큼 이상
  overPx: 2, // 지나치기: 타격 다음 프레임에 끝이 공격 방향으로 이만큼 이상 더 나감
  lineMinChord: 8, // 직선 판단에 필요한 최소 경로 길이
  lineSag: 0.08, // 경로의 가장 큰 휨 / 현 길이가 이보다 작으면 직선 (약 35° 호보다 납작)
  evenRatio: 2.2, // 빠르기(px/틱) 최대 ÷ 가운데값이 이보다 작으면 일정
  bodyPx: 4, // 몸통: 엉덩이·어깨가 첫 프레임에서 가장 멀어진 거리가 이보다 작으면 고정
  sil: 0.8, // 실루엣: 대기와 타격 프레임의 겹침(교집합 ÷ 합집합)이 이 이상
  pressKeys: 4, // 키 하나에 프레임이 평균 이만큼 이상이면 사이 프레임으로 채운 것
  secMin: 3, // 2차 동작: 장식 끝이 붙은 관절에 대해 움직인 거리 합이 이보다 작으면 고정
};
/** 등급: 0점 A, 1~3점 B, 4점 이상이면서 2점짜리(핵심) 신호가 있거나 5점 이상이면 C (1점짜리 넷은 몇 프레임 손질로 본다) */
const GRADE_OF = (pts, core) => (pts === 0 ? 'A' : pts >= 5 || (pts >= 4 && core) ? 'C' : 'B');

// ───────────────────────── 동작 → 쓰는 기술 ─────────────────────────

/** 동작 → 그 동작을 그리는 기술 (판정 프레임이 있는 것만 공격) */
const ATTACK = new Map();
/** 동작 → 기술 이름 (판정이 없는 기술도: 스킬 1 응답처럼) */
const MOVE_ID = new Map();
for (const [cid, c] of Object.entries(CHARACTERS)) {
  for (const id of Object.keys(BASE_MOVES)) {
    const own = c.moves?.[id];
    if (cid !== 'base' && !own) continue;
    const d = { ...BASE_MOVES[id], ...own };
    for (const name of [d.motion, d.alt].filter(Boolean)) {
      if (!MOVE_ID.has(name)) MOVE_ID.set(name, id);
      if (name === d.motion && d.active?.length && !ATTACK.has(name)) ATTACK.set(name, { cid, id, d });
    }
  }
}

const DATA = new Map(MOTION_DATA.map((d) => [d.name, d]));
const BY_NAME = new Map(MOTIONS.map((m) => [m.name, m]));
const whoOf = (name) => name.slice(0, name.indexOf('/'));
const IDLE_OF = { raiden: 'raiden/idle', eunwoo: 'eunwoo/idle', edward: 'edward/idle', oscar: 'oscar/idle' };

function kindOf(name) {
  const who = whoOf(name);
  const short = name.slice(name.indexOf('/') + 1);
  if (who === 'common') return 'hit';
  if (DATA.get(name).loop) return 'loop';
  const id = MOVE_ID.get(name);
  if (id) {
    if (['charge', 'skill1', 'skill2', 'super'].includes(id)) return 'skill';
    if (id === 'wallKick') return 'normal';
    if (who === 'edward') return 'heavy';
    if (who === 'eunwoo' && (id === 'atk3' || id === 'air3')) return 'heavy';
    if (who === 'oscar' && id !== 'atk4') return 'fast';
    if (who === 'raiden' && ['atk1', 'atk2', 'air1', 'air2'].includes(id)) return 'fast';
    return 'normal';
  }
  if (/^(intro|win)$/.test(short) || /super|pacheon/.test(short) || who === 'react') return 'show';
  return 'move';
}

// ───────────────────────── 그리기 (시트와 같은 관절·장식) ─────────────────────────

/** 모든 동작을 한 크기 칸(128×96, 발밑 64, 93)에 맞춰 그린 실루엣 (1 = 칠해짐) */
const SLOT = { w: 128, h: 96, fx: 64, fy: 93 };
const silCache = new Map();
function silhouettes(m) {
  let s = silCache.get(m.name);
  if (s) return s;
  const d = DATA.get(m.name);
  const { w: cw, h: ch, fx, fy } = m.cell;
  const decor = SKINS[skinForMotion(m.name)].decor;
  // 시트와 똑같이 프레임을 가로로 늘어놓은 한 장에 칸마다 잘라 그린다 (칸 하나씩 따로 그리면 반지름 0.5 원처럼
  // 소수 좌표로 찍힌 점이 줄을 넘어 칸 안에 들어오는 일이 생겨 시트와 달라진다)
  const n = m.joints.length;
  const img = new Indexed(n * cw, ch);
  m.joints.forEach((j, i) => {
    const drawn = d.smear && d.smear.frame === i ? smeared(j, d.smear.limb, d.smear.stretch) : j;
    const ghost = d.smear?.ghosts && d.smear.frame === i && i > 0 ? { prev: m.joints[i - 1], n: d.smear.ghosts } : undefined;
    drawSkeleton(img, drawn, i * cw + fx, fy, decor, [i * cw, (i + 1) * cw], ghost);
  });
  s = m.joints.map((_, i) => {
    const out = new Uint8Array(SLOT.w * SLOT.h);
    const dx = SLOT.fx - fx;
    const dy = SLOT.fy - fy;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (!img.a[y * img.w + i * cw + x]) continue;
        const X = x + dx;
        const Y = y + dy;
        if (X >= 0 && Y >= 0 && X < SLOT.w && Y < SLOT.h) out[Y * SLOT.w + X] = 1;
      }
    }
    return out;
  });
  silCache.set(m.name, s);
  return s;
}
function iou(a, b) {
  let and = 0;
  let or = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] && b[k]) and++;
    if (a[k] || b[k]) or++;
  }
  return or ? and / or : 1;
}

/** 장식 부위 점 (2차 동작 확인용): 시트를 그리는 장식 함수를 그대로 불러 찍는 자리만 모은다 */
const PART_GROUP = { hair: 'hair', hairBack: 'hair', cloth: 'cloth', clothBack: 'cloth', body: 'cloth', bodyBack: 'cloth', metal: 'weapon', metalBack: 'weapon', blade: 'weapon' };
const PART_ANCHOR = { hair: 'head', cloth: 'hip', weapon: 'hF' };
const PART_KO = { hair: '머리카락', cloth: '옷자락', weapon: '무기' };
function partCentroids(j, decor) {
  const pts = { hair: [], cloth: [], weapon: [] };
  const pen = {
    fill(part, draw) {
      const g = PART_GROUP[part];
      if (!g) return;
      const add = (p) => pts[g].push(p);
      draw({
        line: (a, b) => { add(a); add(b); },
        disc: (c) => add(c),
        poly: (ps) => ps.forEach(add),
        area: (x0, y0, x1, y1, test) => {
          for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (test(x, y)) add([x, y]);
        },
      });
    },
  };
  for (const k of ['behind', 'backLeg', 'body', 'head', 'top']) decor[k]?.(pen, j);
  const out = {};
  for (const [g, ps] of Object.entries(pts)) {
    if (!ps.length) continue;
    const c = ps.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
    const a = j[PART_ANCHOR[g]];
    out[g] = [c[0] / ps.length - a[0], c[1] / ps.length - a[1]];
  }
  return out;
}

// ───────────────────────── 계산 도우미 ─────────────────────────

const JOINT_KO = { hip: '엉덩이', neck: '목', sh: '어깨', shF: '앞어깨', shB: '뒷어깨', head: '머리', eF: '앞팔꿈치', hF: '앞손', eB: '뒷팔꿈치', hB: '뒷손', kF: '앞무릎', fF: '앞발', kB: '뒷무릎', fB: '뒷발' };
const JOINTS = ['hip', 'neck', 'sh', 'shF', 'shB', 'head', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB'];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const unit = (v) => {
  const l = len(v);
  return l < 1e-9 ? null : [v[0] / l, v[1] / l];
};
const r1 = (x) => Math.round(x * 10) / 10;
const F = (i) => `${i + 1}`; // 보고용 프레임 번호 (1부터)
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const argmax = (xs, from = 0, to = xs.length - 1) => {
  let k = -1;
  for (let i = Math.max(0, from); i <= Math.min(xs.length - 1, to); i++) if (k < 0 || xs[i] > xs[k]) k = i;
  return k;
};

/** 프레임별 비교용 점 묶음: 관절 + 해머 머리 + (있으면) 연검 리본 점 */
function pointsOf(j, who) {
  const p = JOINTS.map((k) => j[k]);
  if (who === 'edward') p.push(hammerHead(j));
  if (j.fx?.rib) p.push(...j.fx.rib);
  return p;
}

/** 공격의 끝 (손·발·무기 끝) */
function tipFn(name, atk, joints) {
  const who = whoOf(name);
  if (who === 'edward') return { f: (j) => hammerHead(j), ko: '해머 머리' };
  if (who === 'eunwoo' && joints.every((j) => j.fx?.rib)) return { f: (j) => j.fx.rib[j.fx.rib.length - 1], ko: '연검 끝' };
  if (who === 'oscar') return { f: (j) => j.hF, ko: '칼자루 손' };
  const limb = atk.d.boxOnly && !atk.d.limb ? null : atk.d.limb;
  if (limb) return { f: (j) => j[limb[1]], ko: { hF: '앞손', hB: '뒷손', fF: '앞발', fB: '뒷발', kF: '앞무릎', kB: '뒷무릎' }[limb[1]] ?? limb[1], joint: limb[1] };
  // 판정 구간이 없는 기술: 첫 프레임보다 가장 많이 앞으로 나간 손·발
  const hit = atk.d.active[0];
  let best = 'hF';
  for (const k of ['hF', 'hB', 'fF', 'fB']) if (joints[hit][k][0] - joints[0][k][0] > joints[hit][best][0] - joints[0][best][0]) best = k;
  return { f: (j) => j[best], ko: { hF: '앞손', hB: '뒷손', fF: '앞발', fB: '뒷발' }[best], joint: best };
}

/** 치는 쪽 어깨와 그 앞 마디 (어깨 → 팔꿈치 → 손 → 무기 끝, 엉덩이 → 무릎 → 발) */
function chainOf(name, tip) {
  const who = whoOf(name);
  if (who === 'edward' || who === 'eunwoo' && tip.ko === '연검 끝') return { sh: 'shF', mids: ['eF', 'hF'], weapon: true };
  const k = tip.joint ?? 'hF';
  if (k === 'hF') return { sh: 'shF', mids: ['eF', 'hF'] };
  if (k === 'hB') return { sh: 'shB', mids: ['eB', 'hB'] };
  if (k === 'fF') return { sh: 'sh', mids: ['kF', 'fF'], leg: 'F' };
  if (k === 'fB') return { sh: 'sh', mids: ['kB', 'fB'], leg: 'B' };
  if (k === 'kF') return { sh: 'sh', mids: ['hip', 'kF'], leg: 'F' };
  if (k === 'kB') return { sh: 'sh', mids: ['hip', 'kB'], leg: 'B' };
  return { sh: 'sh', mids: [k] };
}

// ───────────────────────── 검사 ─────────────────────────

function check(m) {
  const name = m.name;
  const d = DATA.get(name);
  const who = whoOf(name);
  const n = m.dur.length;
  const J = m.joints;
  const ticks = m.dur.reduce((a, b) => a + b, 0);
  const kind = kindOf(name);
  const atk = ATTACK.get(name);
  const sig = {}; // 걸린 신호 → 설명
  const note = {}; // 신호별 점수 조정 (의도된 것)
  const info = { name, label: d.label, who, n, ticks, kind, attack: !!atk, protected: PROTECTED[name] ?? null, approved: APPROVED[name] ?? null };

  // 키 프레임: stop 키와 양 끝 키는 접선 0 (멈칫) → 복사 검사에서 뺀다
  const keyAt = d.keys.map((k) => k.at);
  const still = new Set(d.keys.filter((k, i) => k.stop || i === 0 || i === d.keys.length - 1).map((k) => k.at).filter(Number.isInteger));

  // 1) 복사로 길이 채움: 앞 프레임과 모든 관절(리본·해머 머리 포함) 차이가 1px 이하. stop 키·양 끝 키에 닿는 쌍은 뺀다
  const P = J.map((j) => pointsOf(j, who));
  const step = [0];
  // 리본이 숨은 프레임(접어 넣음)이 섞이면 두 프레임 모두 있는 점만 비교한다
  for (let i = 1; i < n; i++) step.push(Math.max(...P[i].map((p, k) => (P[i - 1][k] ? len(sub(p, P[i - 1][k])) : 0))));
  const dups = [];
  for (let i = 1; i < n; i++) if (step[i] <= T.dupPx && !still.has(i) && !still.has(i - 1)) dups.push(i);
  if (dups.length) sig.dup = dups.map((i) => `${F(i - 1)}=${F(i)}`).join(' ');

  // 12~14에 눌림: 3-0a(1) 조사 표(.agent/hitbox-survey.md 2장)와 같은 기준 — 3장 참고 범위 밖, 키가 적어 사이 프레임으로 채움,
  // 모든 프레임이 1틱 (12프레임을 채우려고 1틱짜리 사이 프레임을 늘어놓음. 걷기·달리기는 거리로 넘기므로 뺀다). 복사한 자세는 '복사' 신호가 따로 본다
  const keyCount = new Set(keyAt.filter((a) => a < n)).size;
  const range = RANGE[kind];
  const press = [];
  if (range && n > range[1]) press.push(`참고 ${range[0]}~${range[1]}보다 많음`);
  if (range && n < range[0]) press.push(`참고 ${range[0]}~${range[1]}보다 적음`);
  if (n / keyCount >= T.pressKeys) press.push(`키 ${keyCount}개를 ${n}프레임으로 늘림`);
  if (!d.loop && n >= 12 && m.dur.every((t) => t === 1)) press.push(`${n}프레임이 모두 1틱`);
  if (press.length) sig.press = press.join(', ');
  // 키가 적어 대부분 사이 프레임인 것은 프레임 수를 크게 줄여야 해서 2점
  if (n / keyCount >= T.pressKeys) note.press = '+1';
  info.keys = keyCount;

  // 일정한 간격 (모든 동작): 공격은 끝, 나머지는 관절 평균 이동. 빠르기 = 이동 px ÷ 앞 프레임 표시 틱
  let tip = null;
  let hit = -1;
  if (atk) {
    tip = tipFn(name, atk, J);
    hit = atk.d.active[0];
  }
  const track = (f) => J.map(f);
  const T0 = tip ? track(tip.f) : null;
  // 공격이 아니면 가장 많이 움직인 관절 (평균을 내면 팔다리의 빨라지고 느려짐이 묻힌다)
  let mover = 'hip';
  if (!tip) {
    let most = -1;
    for (const k of JOINTS) {
      const pathLen = J.reduce((s, j, i) => s + (i ? len(sub(j[k], J[i - 1][k])) : 0), 0);
      if (pathLen > most) {
        most = pathLen;
        mover = k;
      }
    }
  }
  const TR = tip ? T0 : track((j) => j[mover]);
  const moveAmt = [0];
  for (let i = 1; i < n; i++) moveAmt.push(len(sub(TR[i], TR[i - 1])));
  const speed = moveAmt.map((a, i) => (i ? a / m.dur[i - 1] : 0));
  const moving = speed.filter((v, i) => i && moveAmt[i] >= 0.5);
  if (moving.length >= 3) {
    const ratio = Math.max(...moving) / Math.max(1e-6, median(moving));
    info.evenRatio = r1(ratio);
    if (ratio < T.evenRatio) sig.even = `${tip ? '끝' : JOINT_KO[mover]} 빠르기 최대/가운데 ${r1(ratio)}배`;
  }

  // 2차 동작 (장식이 있는 캐릭터): 머리카락·옷자락·무기 끝이 붙은 관절에 대해 늦게 움직이나
  const decor = SKINS[skinForMotion(name)].decor;
  if (decor) {
    const C = J.map((j) => partCentroids(j, decor));
    // 몸 = 뼈대 관절만 (리본·해머 머리는 빼고 비교한다)
    const body = J.map((j, i) => (i ? Math.max(...JOINTS.map((k) => len(sub(j[k], J[i - 1][k])))) : 0));
    const groups = {};
    for (const g of ['hair', 'cloth', 'weapon']) {
      if (!C.every((c) => c[g])) continue;
      const r = [0];
      for (let i = 1; i < n; i++) r.push(len(sub(C[i][g], C[i - 1][g])));
      const total = r.reduce((a, b) => a + b, 0);
      const source = who === 'eunwoo' && d.follow ? 'follow' : who === 'edward' && g === 'weapon' ? 'keyed' : 'rigid';
      if (total < T.secMin) {
        groups[g] = { lag: 0, total: r1(total), source, fixed: true };
        continue;
      }
      // 몸 움직임과 장식 움직임이 가장 잘 겹치는 지연 (0~4프레임)
      let best = 0;
      let bestC = -Infinity;
      for (let s = 0; s <= 4; s++) {
        let ab = 0;
        let aa = 0;
        let bb = 0;
        for (let i = 1; i + s < n; i++) {
          ab += body[i] * r[i + s];
          aa += body[i] ** 2;
          bb += r[i + s] ** 2;
        }
        const c = aa && bb ? ab / Math.sqrt(aa * bb) : 0;
        if (c > bestC + 0.02) {
          bestC = c;
          best = s;
        }
      }
      groups[g] = { lag: best, total: r1(total), source };
    }
    info.secondary = groups;
    const gs = Object.entries(groups);
    if (gs.length && gs.every(([, v]) => v.lag === 0)) {
      sig.sec = gs.map(([g, v]) => `${PART_KO[g]} ${v.fixed ? '고정' : '지연 0'}`).join(', ');
      // 머리카락·옷자락이 관절에 고정된 도형인 캐릭터는 동작이 아니라 장식(follow)에서 고칠 일: 점수에 넣지 않는다
      if (gs.every(([, v]) => v.source === 'rigid')) note.sec = '장식 고정: 캐릭터 공통';
    }
  }

  if (!atk) {
    info.elements = null;
    return finish(info, sig, note);
  }

  // ───── 공격 ─────
  const chain = chainOf(name, tip);
  const SH = track((j) => j[chain.sh]);
  const HIP = track((j) => j.hip);
  const last = atk.d.active[atk.d.active.length - 1];
  info.hit = hit;
  info.active = atk.d.active;
  info.tip = tip.ko;
  info.move = `${atk.cid}.${atk.id}`;
  const air = !!atk.d.air || /air|wall_kick/.test(name) || atk.id === 'slam';
  info.air = air;

  // 공격 방향 d: 타격 프레임으로 들어오는 끝의 움직임 (없으면 엉덩이 → 끝)
  const dirAt = (k) => unit(sub(T0[k], T0[Math.max(0, k - 1)])) ?? unit(sub(T0[k], T0[Math.max(0, k - 2)])) ?? unit(sub(T0[k], HIP[k])) ?? [1, 0];
  const dir = unit(sub(T0[hit], T0[Math.max(0, hit - 2)])) ?? dirAt(hit);
  info.dir = dir.map(r1);

  // 감기 없음: 타격 앞 1~4프레임 안에 끝·치는 쪽 어깨·엉덩이가 공격 반대쪽으로 움직였나
  const lo = Math.max(1, hit - 4);
  let windBest = { amt: 0, what: '', at: -1 };
  for (const [what, tr] of [['끝', T0], ['어깨', SH], ['엉덩이', HIP]]) {
    for (let i = lo; i <= hit - 1; i++) {
      const back = -dot(sub(tr[i], tr[i - 1]), dir);
      if (back > windBest.amt) windBest = { amt: back, what, at: i };
    }
  }
  // 감기 끝 = 타격 앞 4프레임 안에서 끝이 공격 반대쪽으로 가장 물러난 프레임
  let windEnd = Math.max(0, hit - 1);
  for (let i = Math.max(0, hit - 4); i < hit; i++) if (dot(T0[i], dir) < dot(T0[windEnd], dir)) windEnd = i;
  info.windEnd = windEnd;
  info.windBack = r1(windBest.amt);
  // 그 전에 감아 두고 버티는 감기 (차지처럼): 창 안의 자리가 첫 프레임보다 공격 반대쪽으로 2px 넘게 물러나 있으면 감기로 본다
  let held = 0;
  for (const tr of [T0, SH, HIP]) for (let i = Math.max(0, hit - 4); i < hit; i++) held = Math.max(held, -dot(sub(tr[i], tr[0]), dir));
  info.windHeld = r1(held);
  // 오스카 (3장): 감기 대신 움직이기 직전 1~2프레임 완전히 멈춘다
  let freeze = -1;
  for (let i = Math.max(1, hit - 3); i < hit; i++) if (Math.max(...JOINTS.map((k) => len(sub(J[i][k], J[i - 1][k])))) <= T.dupPx) freeze = i;
  info.freeze = freeze;
  const oscarStill = who === 'oscar' && freeze >= 0;
  if (windBest.amt < T.windPx && held < T.windPx && !oscarStill) {
    sig.wind = `${F(Math.max(0, hit - 4))}~${F(hit - 1)}번에 뒤로 ${r1(windBest.amt)}px (버틴 감기 ${r1(held)}px)`;
    if (who === 'oscar') sig.wind += ', 직전 정지도 없음';
  }

  // 지나치기 없음: 타격 다음 프레임에 끝이 공격 방향으로 더 나갔나
  const d1 = dirAt(hit);
  const over1 = hit + 1 < n ? dot(sub(T0[hit + 1], T0[hit]), d1) : 0;
  const over2 = hit + 2 < n ? dot(sub(T0[hit + 2], T0[hit]), d1) : -Infinity;
  info.over = r1(over1);
  if (over1 < T.overPx) {
    sig.over = `${F(hit + 1)}번 ${over1 >= 0 ? '+' : ''}${r1(over1)}px`;
    if (who === 'oscar') note.over = '의도: 오스카는 칼자루 손이 납도로 돌아오고 베기 선이 끝 (13-0)';
  }

  // 직선 궤적: 감기 끝 → 타격 다음 프레임 사이 끝의 경로가 휘었나
  const pathEnd = Math.min(n - 1, hit + 1);
  const path = T0.slice(windEnd, pathEnd + 1);
  const chordV = sub(path[path.length - 1], path[0]);
  const chord = len(chordV);
  let sag = 0;
  if (chord >= T.lineMinChord && path.length >= 3) {
    const u = unit(chordV);
    for (const p of path) sag = Math.max(sag, Math.abs(-u[1] * (p[0] - path[0][0]) + u[0] * (p[1] - path[0][1])));
    info.sag = Math.round((sag / chord) * 100) / 100;
    if (sag / chord < T.lineSag) sig.line = `${F(windEnd)}~${F(pathEnd)}번 휨 ${r1(sag)}px / ${r1(chord)}px`;
  } else info.sag = null;

  // 몸통 고정: 엉덩이·어깨가 첫 프레임에서 가장 멀어진 거리
  const bodyMove = Math.max(...J.map((j) => Math.max(len(sub(j.hip, J[0].hip)), len(sub(j.sh, J[0].sh)))));
  info.bodyMove = r1(bodyMove);
  if (bodyMove < T.bodyPx) {
    sig.body = `엉덩이·어깨 최대 ${r1(bodyMove)}px`;
    if (who === 'oscar') note.body = '의도: 오스카는 몸 대신 손과 칼자루 (3장)';
  }

  // 실루엣 겹침: 대기(공중 기술은 그 동작 첫 프레임)와 타격 프레임의 단색 실루엣
  const S = silhouettes(m);
  const baseSil = air ? S[0] : silhouettes(BY_NAME.get(IDLE_OF[who] ?? 'base/idle'))[0];
  const ov = iou(baseSil, S[hit]);
  info.silIoU = r1(ov * 100) / 100;
  info.silBase = air ? '첫 프레임' : '대기';
  if (ov >= T.sil) {
    sig.sil = `${info.silBase}와 ${Math.round(ov * 100)}%`;
    if (who === 'oscar') note.sil = '오스카: 몸은 거의 그대로이고 손·칼자루로 읽혀야 함 (1점)';
  }

  // ───── 일곱 요소가 든 프레임 ─────
  const el = {};
  // ① 상체 비틀림: 치는 쪽 어깨 − 엉덩이 (앞 +). 감기 끝에서 뒤, 타격에서 앞
  const tw = (i) => SH[i][0] - HIP[i][0];
  const twB = tw(windEnd);
  const twH = tw(hit);
  el[1] = twH - twB >= 4 ? `${F(windEnd)}→${F(hit)}(${r1(twB)}→${r1(twH)}px)` : null;
  // ② 무게중심: 감기 때 엉덩이 뒤로, 타격 때 앞으로 (첫 프레임 기준)
  let backAt = 0;
  for (let i = 0; i < hit; i++) if (HIP[i][0] < HIP[backAt][0]) backAt = i;
  const back = HIP[backAt][0] - HIP[0][0];
  const fwd = HIP[hit][0] - HIP[backAt][0];
  const bob = Math.max(...HIP.map((p) => p[1])) - Math.min(...HIP.map((p) => p[1]));
  el[2] = back <= -2 || fwd >= 4 ? `${back <= -2 ? `${F(backAt)}(${r1(back)})→` : ''}${F(hit)}(+${r1(fwd)}), 높이 ${r1(bob)}` : null;
  // ③ 어깨가 먼저: 감기 끝 뒤 공격 방향으로 1px 이상 움직이기 시작한 프레임
  const startOf = (tr) => {
    for (let i = windEnd + 1; i <= hit; i++) if (dot(sub(tr[i], tr[i - 1]), dir) >= 1) return i;
    return -1;
  };
  const shStart = startOf(SH);
  const handTr = track((j) => j[chain.mids[chain.mids.length - 1]]);
  const handStart = startOf(handTr);
  el[3] = shStart >= 0 && handStart >= 0 && shStart < handStart ? `${F(shStart)}<${F(handStart)}` : null;
  info.shStart = shStart;
  info.handStart = handStart;
  // ④ 팔·무기는 늦게: 마디마다 가장 빨라지는 프레임 (팔꿈치 → 손 → 무기 끝 / 무릎 → 발)
  const peakOf = (tr) => {
    const sp = tr.map((p, i) => (i ? len(sub(p, tr[i - 1])) : 0));
    return argmax(sp, Math.max(1, windEnd), Math.min(n - 1, hit + 1));
  };
  const peaks = [...chain.mids.map((k) => peakOf(track((j) => j[k]))), ...(chain.weapon ? [peakOf(T0)] : [])];
  const ordered = peaks.every((p, i) => !i || p >= peaks[i - 1]) && peaks[peaks.length - 1] > peaks[0];
  el[4] = ordered ? peaks.map(F).join('→') : null;
  info.peaks = peaks.map(F).join('→');
  // ⑤ 타격 실루엣: 뒷발 → 엉덩이 → (어깨) → 끝이 거의 한 직선 (꺾임 15° 이내)
  const kickF = chain.leg === 'F';
  const kickB = chain.leg === 'B';
  const rear = kickF ? J[hit].fB : kickB ? J[hit].fF : J[hit].fF[0] < J[hit].fB[0] ? J[hit].fF : J[hit].fB;
  const pts = [rear, J[hit].hip, ...(chain.leg ? [] : [SH[hit]]), T0[hit]];
  const whole = unit(sub(pts[pts.length - 1], pts[0]));
  let bend = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = unit(sub(pts[i], pts[i - 1]));
    if (s && whole) bend = Math.max(bend, (Math.acos(Math.max(-1, Math.min(1, dot(s, whole)))) * 180) / Math.PI);
  }
  info.lineBend = Math.round(bend);
  el[5] = `${F(hit)}(${Math.round(bend)}°${bend <= 15 ? '' : ' 꺾임'}, 겹침 ${Math.round(ov * 100)}%)`;
  // ⑥ 반동: 타격 다음 1~2프레임 동안 더 나갔다가 되돌아옴
  const outAmt = Math.max(over1, over2);
  const outAt = over2 > over1 ? hit + 2 : hit + 1;
  const backAmt = outAt + 1 < n ? outAmt - dot(sub(T0[outAt + 1], T0[hit]), d1) : 0;
  el[6] = outAmt >= T.overPx ? `${F(outAt)}(+${r1(outAmt)}/−${r1(Math.max(0, backAmt))})` : null;
  // ⑦ 자세 회복: 판정 끝 뒤 처음엔 빠르고 끝으로 갈수록 느리게, 마지막은 첫 프레임 자세 가까이
  const rec = [];
  for (let i = last + 1; i < n; i++) rec.push(step[i] / m.dur[i - 1]);
  // 기본자세 = 그 캐릭터 대기 첫 프레임 (연타는 앞 타격이 끝난 자세에서 시작하므로 첫 프레임과 비교하지 않는다). 공중 기술은 자기 첫 프레임
  const rest = air ? J[0] : BY_NAME.get(IDLE_OF[who] ?? 'base/idle').joints[0];
  const endGap = Math.max(...JOINTS.map((k) => len(sub(J[n - 1][k], rest[k]))));
  const easing = rec.length >= 2 && rec[rec.length - 1] <= Math.max(...rec.slice(0, Math.ceil(rec.length / 2)));
  info.endGap = r1(endGap);
  el[7] = rec.length >= 2 && easing ? `${F(last + 1)}~${F(n - 1)}${endGap > 4 ? ` (끝이 ${air ? '첫 자세' : '대기'}와 ${Math.round(endGap)}px)` : ''}` : null;
  info.elements = el;
  return finish(info, sig, note);
}

function finish(info, sig, note) {
  let pts = 0;
  let core = false;
  for (const k of Object.keys(sig)) {
    if (note[k]?.startsWith('의도') || note[k]?.startsWith('장식 고정')) continue;
    const p = k === 'sil' && note.sil ? 1 : k === 'press' && note.press ? 2 : SIG[k].pt;
    pts += p;
    if (p >= 2) core = true;
  }
  info.signals = sig;
  info.notes = note;
  info.points = pts;
  info.auto = GRADE_OF(pts, core);
  const j = JUDGED[info.name];
  info.grade = j ? j[0] : info.auto;
  info.why = j ? j[1] : '';
  return info;
}

// ───────────────────────── 실행 ─────────────────────────

const targets = only.length ? MOTIONS.filter((m) => only.includes(m.name)) : MOTIONS;
const results = targets.map(check);

if (only.length) {
  for (const r of results) console.log(JSON.stringify(r, null, 1));
  process.exit(0);
}

const count = (rs, g) => rs.filter((r) => r.grade === g).length;
mkdirSync('out', { recursive: true });
writeFileSync('out/motioncheck.json', JSON.stringify(results, null, 1));
writeFileSync('docs/motions/점검표.md', table(results));
console.log(`docs/motions/점검표.md: 동작 ${results.length}개`);
for (const [who, rs] of groupsOf(results)) console.log(`  ${who}: A ${count(rs, 'A')} · B ${count(rs, 'B')} · C ${count(rs, 'C')} (${rs.length}개)`);

if (!noPng) {
  mkdirSync('previews/motions', { recursive: true });
  for (const [who, rs] of groupsOf(results)) {
    const file = `previews/motions/silhouette-${who}.png`;
    writeFileSync(file, strip(rs));
    console.log(`  → ${file}`);
  }
}

/** 캐릭터 묶음: 네 명 + 공통·기본 (공통 맞는 동작, 기본 스틱맨, 필살기 상대 반응) */
function groupsOf(rs) {
  const order = ['raiden', 'eunwoo', 'edward', 'oscar', 'common-base'];
  const map = new Map(order.map((k) => [k, []]));
  for (const r of rs) map.get(['raiden', 'eunwoo', 'edward', 'oscar'].includes(r.who) ? r.who : 'common-base').push(r);
  return [...map].filter(([, v]) => v.length);
}

// ───────────────────────── 점검표 ─────────────────────────

function table(rs) {
  const WHO = { raiden: '라이덴', eunwoo: '백은우', edward: '에드워드', oscar: '오스카', 'common-base': '공통 맞는 동작 · 기본 스틱맨 · 필살기 상대 반응' };
  const sum = (rs2) => `A ${count(rs2, 'A')} · B ${count(rs2, 'B')} · C ${count(rs2, 'C')}`;
  const sigCount = Object.keys(SIG).map((k) => `${SIG[k].ko} ${rs.filter((r) => r.signals[k]).length}`).join(' · ');
  let no = 0;
  const out = [];
  out.push(`# 동작 점검표 (애니메이션 재수정 지침 0장)

자동 생성: \`npm run motioncheck\` (\`tools/motioncheck.mjs\`). 손으로 고치지 않는다. 사람이 바꾼 등급은 도구의 \`JUDGED\` 표에 이유와 함께 적고, 등급 칸에 "자동 → 판단"으로 나온다.
실루엣 띠: \`previews/motions/silhouette-<캐릭터>.png\` (아래 '실루엣 띠 읽는 법').

동작 ${rs.length}개 — ${sum(rs)}. 보호 목록 ${rs.filter((r) => r.protected).length}개는 등급만 적고 고치지 않는다(1장).
신호별 개수: ${sigCount}.

## 읽는 법

- **번호(#)**: 이 표의 일련번호. 답할 때 번호로 말하면 된다.
- **프레임 번호는 1부터** (시트 PNG·GIF와 같다). 타격 프레임 = 공격 데이터의 첫 판정 프레임.
- **끝**: 손·발·무기 끝. 공격 데이터의 판정 구간 끝 관절(라이덴·기본), 해머 머리(에드워드), 연검 끝(백은우, 리본이 없는 프레임이 있으면 손), 칼자루 쥔 앞손(오스카).
- **일곱 요소가 든 프레임 번호** (공격만, 없으면 \`–\`):
  ① 상체 비틀림: 치는 쪽 어깨 − 엉덩이(앞 +)가 감기 끝 → 타격에서 4px 넘게 앞으로. \`감기끝→타격(px→px)\`
  ② 무게중심: 감기 때 엉덩이가 2px 넘게 뒤로, 또는 타격 때 4px 넘게 앞으로. \`뒤 프레임(px)→타격(+px), 높이 출렁임 px\`
  ③ 어깨가 먼저: 감기 끝 뒤 공격 방향으로 움직이기 시작한 프레임이 어깨 < 손. \`어깨<손\`
  ④ 팔·무기는 늦게: 가장 빨라지는 프레임이 팔꿈치 → 손 → 무기 끝(발차기는 무릎 → 발) 순서. \`팔꿈치→손→끝\`
  ⑤ 타격 실루엣: 뒷발 → 엉덩이 → 어깨 → 끝의 꺾임(15° 이내면 한 직선)과 대기 실루엣 겹침. 늘 적는다
  ⑥ 반동: 타격 다음 1~2프레임에 끝이 2px 넘게 더 나감. \`프레임(+더 나감/−되돌아옴)\`
  ⑦ 자세 회복: 판정 끝 뒤 빠르기가 끝으로 갈수록 줄어듦. 마지막 자세가 대기 첫 프레임(공중 기술은 그 동작 첫 프레임)과 4px 넘게 다르면 적는다
  공격이 아닌 동작(대기·이동·맞는 동작·연출)은 "해당 없음 — 공격 아님"(판정 프레임이 없어 타격·감기·반동을 정할 수 없다).
- **문제 신호** (지침 0장, 코드 검사. 임계값은 도구 맨 위 \`T\`):
  - 복사로 길이 채움: 앞 프레임과 모든 관절(연검 리본·해머 머리 포함) 차이가 ${T.dupPx}px 이하. stop 키·양 끝 키에 닿는 쌍은 뺀다. \`앞=뒤\` 프레임
  - 감기 없음: 타격 앞 1~4프레임 안에 끝·치는 쪽 어깨·엉덩이 중 무엇도 공격 반대쪽으로 ${T.windPx}px 이상 움직이지 않음. 그보다 먼저 감아 두고 버티는 감기(차지)는 그 창 안의 자리가 첫 프레임보다 ${T.windPx}px 넘게 물러나 있으면 감기로 본다. 오스카는 3장대로 타격 직전 1~3프레임 안에 완전히 멈춘 프레임(${T.dupPx}px 이하)이 있으면 감기로 본다
  - 지나치기 없음: 타격 다음 프레임에 끝이 공격 방향으로 ${T.overPx}px 이상 더 나가지 않음
  - 직선 궤적: 감기 끝 → 타격 다음 프레임 사이 끝의 경로가 현 길이의 ${T.lineSag * 100}%보다 덜 휨 (경로 ${T.lineMinChord}px 미만은 판단 안 함)
  - 일정한 간격: 프레임 사이 빠르기(이동 px ÷ 앞 프레임 표시 틱)의 최대가 가운데값의 ${T.evenRatio}배보다 작음. 공격은 끝, 나머지는 그 동작에서 가장 많이 움직인 관절
  - 몸통 고정: 공격 중 엉덩이·어깨가 첫 프레임에서 ${T.bodyPx}px보다 덜 움직임
  - 2차 동작 없음: 머리카락·옷자락·무기(장식 도형의 무게중심, 붙은 관절 기준)가 몸보다 늦게 움직이지 않음(몸 움직임과 가장 잘 겹치는 지연이 0프레임이거나 움직임 합 ${T.secMin}px 미만). 장식이 없는 기본 스틱맨은 검사 안 함
  - 실루엣 겹침: 대기 첫 프레임(공중 기술·벽 박차기는 그 동작 첫 프레임)과 타격 프레임의 단색 실루엣 교집합 ÷ 합집합 ${T.sil * 100}% 이상
  - 12~14에 눌림: 3-0a(1) 조사 표(\`.agent/hitbox-survey.md\` 2장)와 같은 기준 — 동작연출지침서 3장 프레임 수 참고값 밖(빠른 타격 6~10, 일반 평타 10~16, 큰 휘두르기 16~24, 차지·스킬 16~30)이거나, 키 하나에 프레임이 평균 ${T.pressKeys}장 이상(사이 프레임으로 채움)이거나, 반복이 아닌 12프레임 이상 동작의 모든 프레임이 1틱(1틱짜리 사이 프레임으로 12장을 채움). 복사한 자세는 '복사로 길이 채움'이 따로 본다
- **등급**: 점수 = 감기 없음·지나치기 없음·몸통 고정·실루엣 겹침 2점, 12~14에 눌림은 키가 적어 사이 프레임으로 채운 것이면 2점·참고 범위만 벗어나면 1점, 나머지 1점. 0점 A(그대로 둠), 1~3점 B(몇 프레임만 고침), 4점 이상이면서 2점짜리 신호가 있거나 5점 이상이면 C(다시 만듦). 1점짜리 넷(4점)은 B.
  점수에서 빼는 것: 오스카 몸통 고정·지나치기 없음(3장·13-0 몸의 언어에서 의도: 몸은 그대로, 칼자루 손은 납도로 돌아오고 베기 선이 끝), 오스카 실루엣 겹침은 1점, 라이덴·에드워드·오스카의 머리카락·옷자락처럼 관절에 고정된 장식의 2차 동작 없음(동작마다가 아니라 장식에 follow를 붙여 한 번에 고칠 일, '장식 고정' 표시).
  보호 목록은 등급 옆에 **보호**를 붙이고 고치지 않는다.

## 요약

| 묶음 | 동작 수 | A | B | C | 보호 |
| --- | --- | --- | --- | --- | --- |
${groupsOf(rs).map(([w, g]) => `| ${WHO[w]} | ${g.length} | ${count(g, 'A')} | ${count(g, 'B')} | ${count(g, 'C')} | ${g.filter((r) => r.protected).length} |`).join('\n')}
`);
  for (const [w, g] of groupsOf(rs)) {
    out.push(`\n## ${WHO[w]} (${g.length}개 — ${sum(g)})\n`);
    out.push('| # | 동작 | 프레임 수 / 총 틱 | 일곱 요소가 든 프레임 번호 | 문제 신호 | 등급 |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const r of g) {
      no++;
      r.no = no;
      const el = r.elements
        ? [1, 2, 3, 4, 5, 6, 7].map((k) => `${'①②③④⑤⑥⑦'[k - 1]}${r.elements[k] ?? '–'}`).join(' ')
        : '해당 없음 — 공격 아님';
      const sigs = Object.entries(r.signals).map(([k, v]) => {
        const n2 = r.notes[k];
        return `**${SIG[k].ko}**(${v})${n2 && n2 !== '+1' ? ` _${n2}_` : ''}`;
      });
      const kind = `${KIND_LABEL[r.kind]}${r.move ? ` · ${r.move}` : ''}${r.attack ? ` · 끝: ${r.tip}` : ''}`;
      const grade = `**${r.grade}**${r.protected ? ' · 보호' : ''} (${r.points}점${r.why ? `, 자동 ${r.auto} → 판단 ${r.grade}: ${r.why}` : ''})${r.approved ? `<br>기존 승인 ${r.approved}` : ''}`;
      out.push(`| ${no} | \`${r.name}\` ${r.label}<br>${kind} | ${r.n} / ${r.ticks} | ${el} | ${sigs.join('<br>') || '없음'} | ${grade} |`);
    }
  }
  out.push(`
## 실루엣 띠 읽는 법

\`previews/motions/silhouette-<묶음>.png\` (2배). 한 줄 = 동작 하나, 칸 = 프레임(128×96 칸에 발밑을 맞춰 그림, 64×64 동작도 같은 칸에).
줄 머리: \`#번호 등급 이름 프레임수F 총틱T 신호\`. 신호 약자: ${Object.values(SIG).map((s) => `${s.code} ${s.ko}`).join(', ')}. 보호 목록은 \`P\`.
흰색 = 보통 프레임, 주황 = 판정 프레임, 빨강 = 타격 프레임(첫 판정 프레임, 뒤의 보라색 그림자는 비교한 대기 또는 첫 프레임 실루엣), 칸 아래 하늘색 막대 = stop 키 프레임.
`);
  return out.join('\n') + '\n';
}

// ───────────────────────── 실루엣 띠 PNG ─────────────────────────

function strip(rs) {
  const S = 2;
  const GAP = 1;
  const LABEL = 9;
  const maxN = Math.max(...rs.map((r) => r.n));
  const W = 4 + maxN * (SLOT.w + GAP);
  // 줄마다 그림이 있는 높이만 (모든 프레임 실루엣의 위 끝 ~ 칸 아래)
  const rows = rs.map((r) => {
    const sil = silhouettes(BY_NAME.get(r.name));
    let top = SLOT.h;
    for (const s of sil) for (let k = 0; k < s.length; k++) if (s[k]) { top = Math.min(top, Math.floor(k / SLOT.w)); break; }
    const y0 = Math.max(0, top - 2);
    return { r, sil, y0, h: SLOT.h - y0 + 3 };
  });
  const H = rows.reduce((s, row) => s + LABEL + row.h + 4, 4);
  const img = new Uint8Array(W * S * H * S * 3);
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const C = {
    bg: hex('#15111f'), cell: hex('#1d1830'), ground: hex('#2e2648'), body: hex('#e9e4f5'), active: hex('#ffb347'), hit: hex('#ff5a4a'),
    ghost: hex('#4b4280'), stop: hex('#7fd1ff'), text: hex('#c9c2dc'), dim: hex('#8e86a8'), A: hex('#7be07b'), B: hex('#ffd25e'), C: hex('#ff6b6b'), P: hex('#7fd1ff'),
  };
  const px = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    for (let dy = 0; dy < S; dy++) {
      for (let dx = 0; dx < S; dx++) {
        const o = ((y * S + dy) * W * S + x * S + dx) * 3;
        img[o] = c[0];
        img[o + 1] = c[1];
        img[o + 2] = c[2];
      }
    }
  };
  const rect = (x, y, w, h, c) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(xx, yy, c);
  };
  const text = (s, x, y, c) => {
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const g = glyphRows(ch);
      for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r] & (4 >> k)) px(cx + k, y + r, c);
      cx += 4;
    }
    return cx;
  };
  rect(0, 0, W, H, C.bg);
  let y = 4;
  for (const { r, sil, y0, h } of rows) {
    const d = DATA.get(r.name);
    let x = text(`#${r.no}`, 4, y + 1, C.dim) + 4;
    x = text(r.grade, x, y + 1, C[r.grade]) + 4;
    if (r.protected) x = text('P', x, y + 1, C.P) + 4;
    x = text(`${r.name.replace(/_/g, '-')}  ${r.n}F ${r.ticks}T`, x, y + 1, C.text) + 8;
    text(Object.keys(r.signals).map((k) => SIG[k].code).join(' '), x, y + 1, C.dim);
    y += LABEL;
    const stops = new Set(d.keys.filter((k) => k.stop && Number.isInteger(k.at)).map((k) => k.at));
    const act = new Set(r.active ?? []);
    const cmp = r.attack ? (r.air ? sil[0] : silhouettes(BY_NAME.get(IDLE_OF[r.who] ?? 'base/idle'))[0]) : null;
    for (let i = 0; i < r.n; i++) {
      const cx = 4 + i * (SLOT.w + GAP);
      rect(cx, y, SLOT.w, h, C.cell);
      rect(cx, y + (SLOT.fy + 1 - y0), SLOT.w, 1, C.ground);
      text(String(i + 1), cx + 2, y + 2, C.dim);
      const col = i === r.hit ? C.hit : act.has(i) ? C.active : C.body;
      for (let yy = y0; yy < SLOT.h; yy++) {
        for (let xx = 0; xx < SLOT.w; xx++) {
          const k = yy * SLOT.w + xx;
          if (sil[i][k]) px(cx + xx, y + yy - y0, col);
          else if (i === r.hit && cmp?.[k]) px(cx + xx, y + yy - y0, C.ghost);
        }
      }
      if (stops.has(i)) rect(cx + SLOT.w / 2 - 6, y + h - 2, 12, 2, C.stop);
    }
    y += h + 4;
  }
  const rgb = new Uint8Array(img.buffer);
  return encodePng(W * S, H * S, rgb);
}

function valuesOf(flag) {
  const out = [];
  argv.forEach((a, i) => {
    if (a === flag && argv[i + 1]) out.push(argv[i + 1]);
  });
  return out;
}
