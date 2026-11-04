// 효과음 모음을 WAV(모노 22kHz, 16비트)로 뽑아 previews/sound/에 저장하고, 잰 값으로 스스로 확인한다 (사운드기획서 4장).
//   npm run sound
// 1) 소리 연결(src/audio/events.ts)이 sim 상태를 바꾸지 않는지: CPU 대전을 소리 연결 있이·없이 같이 돌려 상태 해시를 비교하고,
//    소리 연결에는 쓰기를 막은 상태(읽기 전용 프록시)를 넘긴다. 어떤 사건에서 어떤 소리가 났는지 센다.
// 2) 헤드리스 Chromium의 OfflineAudioContext로 게임과 같은 믹서·부품에 통과시켜 뽑는다 (tools/pages/sound.ts).
//    재는 것: 피크(찢어짐), 시작 시각(맞는 틱에 바로), 길이(피크보다 40dB 낮아질 때까지), 저음 비중(200Hz 아래 에너지),
//    1→4타가 갈수록 저음 비중과 길이가 늘어나는지, 강타 덕킹 깊이, 1→4타 틱 간격
// 결과: previews/sound/NN-이름.wav, previews/sound/README.md(번호표·잰 값), previews/sound/waveforms.png(파형 모음)
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const OUT = 'previews/sound';
/** --wav: 소리 연결 확인(CPU 대전)을 건너뛰고 WAV만 (레시피를 고치는 동안) */
const WAV_ONLY = process.argv.includes('--wav');
let failed = 0;
const ng = (msg) => {
  failed++;
  console.log(`NG  ${msg}`);
};

// ---------- 1) 소리 연결이 sim을 바꾸지 않는가 ----------
const vite = await createServer({ logLevel: 'error', server: { port: 5183 } });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
const { SoundBridge } = await vite.ssrLoadModule('/src/audio/events.ts');
const { comboCues } = await vite.ssrLoadModule('/src/audio/demo.ts');

/** 쓰기를 막은 상태 (깊이 따라감): 소리 연결이 무엇이든 쓰면 바로 예외 */
const ro = new WeakMap();
function readOnly(o) {
  if (!o || typeof o !== 'object') return o;
  let p = ro.get(o);
  if (!p) {
    const deny = (k) => {
      throw new Error(`소리 연결이 sim 상태를 바꾸려 함: ${String(k)}`);
    };
    p = new Proxy(o, {
      get: (t, k) => readOnly(Reflect.get(t, k)),
      set: (_t, k) => deny(k),
      deleteProperty: (_t, k) => deny(k),
      defineProperty: (_t, k) => deny(k),
    });
    ro.set(o, p);
  }
  return p;
}

const MATCHES = WAV_ONLY ? [] : [
  ['raiden', 'raiden'], ['eunwoo', 'edward'], ['oscar', 'raiden'], ['edward', 'oscar'],
  ['raiden', 'eunwoo'], ['oscar', 'eunwoo'], ['base', 'base'], ['edward', 'raiden'],
];
const cueCount = {};
const eventCount = {};
for (let m = 0; m < MATCHES.length; m++) {
  const seed = 101 + m;
  const opts = { chars: MATCHES[m] };
  const a = sim.createState(seed, opts);
  const b = sim.createState(seed, opts);
  const ca = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const cb = [sim.createCpu(seed * 2 + 1), sim.createCpu(seed * 2 + 2)];
  const bridge = new SoundBridge();
  let ticks = 0;
  let diverged = -1;
  try {
    while (ticks < 20000 && a.phase !== 'matchEnd') {
      sim.step(a, [sim.cpuInput(ca[0], a, 0), sim.cpuInput(ca[1], a, 1)]);
      sim.step(b, [sim.cpuInput(cb[0], b, 0), sim.cpuInput(cb[1], b, 1)]);
      for (const c of bridge.read(readOnly(b))) {
        const k = c.sound === 'hitLight' || c.sound === 'hitAir' ? `${c.sound} ${c.step}` : c.sound;
        cueCount[k] = (cueCount[k] ?? 0) + 1;
      }
      for (const e of b.events) eventCount[e.type] = (eventCount[e.type] ?? 0) + 1;
      ticks++;
      if (ticks % 300 === 0 && sim.hashState(a) !== sim.hashState(b)) {
        diverged = ticks;
        break;
      }
    }
  } catch (e) {
    ng(`${m + 1}판 ${MATCHES[m].join(' vs ')}: ${e.message}`);
    continue;
  }
  const ha = sim.hashState(a);
  const hb = sim.hashState(b);
  if (diverged >= 0 || ha !== hb) ng(`${m + 1}판 ${MATCHES[m].join(' vs ')}: 소리 연결을 붙이니 상태가 달라짐 (${diverged >= 0 ? `${diverged}틱` : '끝'}) ${ha} ≠ ${hb}`);
  else console.log(`OK  ${m + 1}판 ${MATCHES[m].join(' vs ')} 시드 ${seed}: ${ticks}틱, 소리 연결 있이·없이 같은 해시 ${ha}`);
}
console.log(`    사건 수: 맞음 ${eventCount.hit ?? 0}, 가드 ${eventCount.block ?? 0}, 크러시 ${eventCount.crush ?? 0}, 다운 ${eventCount.knockdown ?? 0}, 낙법 ${(eventCount.tech ?? 0) + (eventCount.walltech ?? 0)}`);
console.log(`    낸 소리: ${Object.entries(cueCount).sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (!WAV_ONLY) for (const k of ['hitLight 1', 'hitLight 2', 'hitLight 3', 'hitHeavy', 'hitAir 1', 'guard', 'down', 'getup', 'tech']) {
  if (!cueCount[k]) ng(`CPU 대전 ${MATCHES.length}판에서 '${k}' 소리가 한 번도 나지 않음`);
}
const combo = comboCues('raiden');
const comboSteps = combo.map((c) => `${c.cue.sound}${c.cue.step}`).join(' → ');
if (comboSteps !== 'hitLight1 → hitLight2 → hitLight3 → hitHeavy4') ng(`라이덴 1→4타 소리 순서가 다름: ${comboSteps}`);
else console.log(`OK  라이덴 1→4타 (실제 sim): ${combo.map((c) => `${c.tick}틱 ${c.cue.sound} ${c.cue.step}(히트스톱 ${c.cue.stop})`).join(', ')}`);

// ---------- 2) WAV 뽑기와 재기 ----------
await vite.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(`${vite.resolvedUrls.local[0]}tools/pages/sound.html`, { timeout: 300000 });
await page.waitForFunction(() => window.__sound !== undefined || window.__soundError !== undefined, null, { timeout: 300000 });
const res = await page.evaluate(() => window.__sound ?? { error: window.__soundError });
await browser.close();
await vite.close();
pageErrors.forEach((e) => ng(`페이지 오류: ${e}`));
if (res.error) {
  ng(`뽑기 실패: ${res.error}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
// 번호표에서 빠진 옛 파일은 지운다 (번호·이름이 바뀌었을 때)
for (const f of readdirSync(OUT)) if (f.endsWith('.wav')) unlinkSync(`${OUT}/${f}`);

const rows = [];
const measured = {};
for (const it of res.items) {
  const x = f32(it.pcm);
  const dry = f32(it.dry);
  const name = `${String(it.no).padStart(2, '0')}-${it.file}.wav`;
  writeFileSync(`${OUT}/${name}`, wav(x, it.rate));
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  // 시작: 첫 소리를 부른 시각(0)부터 (바닥 소리를 깐 덕킹 확인은 첫 타격부터)
  const first = it.marks[0]?.at ?? 0;
  const on = onsetMs(it.bedOnly ? x.subarray(Math.round(first * it.rate)) : x, it.rate, peak);
  // 길이·저음 비중은 리버브를 뺀 소리로, 울림은 그 뒤에 남는 리버브 꼬리의 크기 (피크 대비 dB)
  const dryEnd = lengthMs(dry, it.rate);
  const len = dryEnd - onsetMs(dry, it.rate, dry.reduce((m, v) => Math.max(m, Math.abs(v)), 0));
  const low = lowRatio(dry, it.rate);
  const verb = 20 * Math.log10(Math.max(1e-6, rms(x, it.rate, dryEnd / 1000 + 0.01, dryEnd / 1000 + 0.06)) / peak);
  measured[it.no] = { peak, on, len, low, verb, marks: it.marks };
  let extra = '';
  const problems = [];
  if (peak >= 0.999) problems.push(`찢어짐 (피크 ${peak.toFixed(3)})`);
  if (peak < 0.2) problems.push(`너무 작음 (피크 ${peak.toFixed(3)})`);
  if (!it.bedOnly && on > 1000 / 60) problems.push(`시작이 1틱보다 늦음 (${on.toFixed(1)}ms)`);
  if (it.target && it.marks.length === 1 && (len < it.target[0] || len > it.target[1])) problems.push(`길이 ${len.toFixed(0)}ms가 목표 ${it.target[0]}~${it.target[1]}ms 밖`);
  if (it.bedOnly) {
    // 덕킹 깊이: 타격 소리를 0으로 한 판에서 4타 히트스톱 동안과 그 앞의 바닥 소리 크기
    const bed = f32(it.bedOnly);
    const h4 = it.marks[it.marks.length - 1];
    const before = rms(bed, it.rate, h4.at - 0.12, h4.at - 0.01);
    const during = rms(bed, it.rate, h4.at + 0.015, h4.at + h4.stop - 0.005);
    const after = rms(bed, it.rate, h4.at + h4.stop + 0.15, h4.at + h4.stop + 0.3);
    const db = 20 * Math.log10(during / before);
    extra = ` 덕킹 ${db.toFixed(1)}dB (히트스톱 ${Math.round(h4.stop * 60)}틱 동안), 풀린 뒤 ${(20 * Math.log10(after / before)).toFixed(1)}dB`;
    measured[it.no].duck = db;
    if (db > -6) problems.push(`덕킹이 얕음 (${db.toFixed(1)}dB)`);
  }
  if (it.marks.length > 1) extra += ` 소리 ${it.marks.length}개, 시작 틱 ${it.marks.map((m) => Math.round(m.at * 60)).join('·')}`;
  else if (it.marks[0]?.stop) extra += ` 히트스톱 ${Math.round(it.marks[0].stop * 60)}틱`;
  const line = `${String(it.no).padStart(2, '0')} ${it.name}: 피크 ${peak.toFixed(2)}, 시작 ${on.toFixed(1)}ms, 길이 ${len.toFixed(0)}ms${it.target ? ` (목표 ${it.target[0]}~${it.target[1]})` : ''}, 저음 비중 ${(low * 100).toFixed(0)}%, 울림 ${verb.toFixed(0)}dB${extra} → ${OUT}/${name}`;
  if (problems.length) ng(`${line}  ${problems.join(', ')}`);
  else console.log(`OK  ${line}`);
  rows.push({ ...it, wav: name, peak, on, len, low, verb, extra });
}

// 1→4타로 갈수록 묵직해지는가: 저음 비중과 길이가 단계마다 늘어야 한다
const steps = [1, 2, 3, 4].map((n) => measured[n]);
for (let i = 1; i < steps.length; i++) {
  if (!(steps[i].low > steps[i - 1].low)) ng(`${i + 1}타 저음 비중(${(steps[i].low * 100).toFixed(0)}%)이 ${i}타(${(steps[i - 1].low * 100).toFixed(0)}%)보다 크지 않음`);
  if (!(steps[i].len > steps[i - 1].len)) ng(`${i + 1}타 길이(${steps[i].len.toFixed(0)}ms)가 ${i}타(${steps[i - 1].len.toFixed(0)}ms)보다 길지 않음`);
}
console.log(`    1→4타: 저음 비중 ${steps.map((s) => `${(s.low * 100).toFixed(0)}%`).join(' → ')}, 길이 ${steps.map((s) => `${s.len.toFixed(0)}ms`).join(' → ')}`);

writeFileSync(`${OUT}/waveforms.png`, Buffer.from(res.png.split(',')[1], 'base64'));
writeFileSync(`${OUT}/README.md`, readme(rows));
console.log(`    파형 모음 → ${OUT}/waveforms.png, 번호표 → ${OUT}/README.md`);
console.log(failed ? `NG ${failed}개` : '모두 통과');
process.exit(failed ? 1 : 0);

// ---------- 도우미 ----------
function f32(b64) {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

/** 16비트 PCM 모노 WAV */
function wav(x, rate) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return b;
}

/** 소리가 시작한 시각 (ms): 피크의 2%를 처음 넘는 샘플 */
function onsetMs(x, rate, peak) {
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > peak * 0.02) return (i / rate) * 1000;
  return 0;
}

/** 소리가 끝난 시각 (ms): 1ms 창 RMS가 가장 큰 창보다 40dB 낮아진 뒤 다시 넘지 않는 곳 */
function lengthMs(x, rate) {
  const win = Math.max(1, Math.round(rate / 1000));
  const r = [];
  for (let i = 0; i < x.length; i += win) {
    let s = 0;
    for (let k = i; k < Math.min(x.length, i + win); k++) s += x[k] * x[k];
    r.push(Math.sqrt(s / win));
  }
  const top = Math.max(...r);
  let last = 0;
  r.forEach((v, i) => {
    if (v > top * 0.01) last = i + 1;
  });
  return (last * win * 1000) / rate;
}

/** 200Hz 아래 에너지 비중 (2차 저역 통과로 나눔) */
function lowRatio(x, rate) {
  const f = 200;
  const w = (2 * Math.PI * f) / rate;
  const q = Math.SQRT1_2;
  const al = Math.sin(w) / (2 * q);
  const cw = Math.cos(w);
  const a0 = 1 + al;
  const b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, b2 = (1 - cw) / 2 / a0, a1 = (-2 * cw) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, el = 0, et = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    el += y * y;
    et += x[i] * x[i];
  }
  return et > 0 ? el / et : 0;
}

function rms(x, rate, t0, t1) {
  const i0 = Math.max(0, Math.floor(t0 * rate));
  const i1 = Math.min(x.length, Math.floor(t1 * rate));
  let s = 0;
  for (let i = i0; i < i1; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, i1 - i0));
}

function readme(rows) {
  const lines = [
    '# 소리 미리듣기 (npm run sound가 만든다)',
    '',
    '번호로 답해 주세요 (예: "3 더 묵직하게"). 휴대폰에서는 파일을 누른 뒤 **View raw**(또는 다운로드)를 누르면 재생됩니다.',
    '배포된 게임에서는 타이틀 → OPTIONS → SOUND TEST에서 같은 번호로 바로 들을 수 있습니다.',
    '',
    '모두 코드로 합성 (Web Audio). 모노 22kHz 16비트. 첫 소리는 파일 첫머리에서 바로 시작합니다.',
    '길이 = 리버브를 뺀 소리가 피크보다 40dB 낮아질 때까지. 저음 비중 = 200Hz 아래 에너지 비율. 울림 = 소리가 끝난 직후 남는 리버브 꼬리 크기(피크 대비).',
    '',
    '| 번호 | 소리 | 들어 볼 것 | 길이 (목표) | 저음 비중 | 울림 | 파일 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.no} | ${r.name} | ${r.note}${r.extra ? `<br>${r.extra.trim()}` : ''} | ${r.marks.length === 1 ? `${r.len.toFixed(0)}ms${r.target ? ` (${r.target[0]}~${r.target[1]})` : ''}` : '—'} | ${r.marks.length === 1 ? `${(r.low * 100).toFixed(0)}%` : '—'} | ${r.marks.length === 1 ? `${r.verb.toFixed(0)}dB` : '—'} | [${r.wav}](${r.wav}) |`),
    '',
    '![파형 모음: 노란 세로줄 = 소리 시작(맞는 틱), 붉은 띠 = 히트스톱, 가는 세로줄 = 1틱](waveforms.png)',
    '',
  ];
  return lines.join('\n');
}
