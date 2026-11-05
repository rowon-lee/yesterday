// 온라인(딜레이 방식 락스텝) 시험: 브라우저 없이 두 사람을 한 프로세스에서 가상 시계로 돌린다.
//   npm run nettest -- [--matches 2] [--ticks 12000]
// 사람마다 sim 상태·CPU 입력·NetDriver(src/net/driver.ts)를 따로 갖고, 지연·흔들림·손실을 넣은 통로(src/net/link.ts)로 이어진다.
// 확인: 양쪽 해시가 끝까지 같은가, 양쪽이 쓴 입력 기록이 같은가, 그 기록을 sim에 다시 넣으면 같은 상태가 되는가,
//       일부러 한쪽 상태를 바꾸면 30틱 안에 어긋남(DESYNC)을 잡는가. 왕복 0·50·100·150ms × 입력 지연 2·3·4틱마다 기다림·반응 시간을 잰다.
import { createServer } from 'vite';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const MATCHES = Number(args.matches ?? 2);
const MAX_TICKS = Number(args.ticks ?? 12000);

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
const { NetDriver, HASH_EVERY } = await vite.ssrLoadModule('/src/net/driver.ts');
const { lagged, loopPair } = await vite.ssrLoadModule('/src/net/link.ts');

/** 가상 시계: 일어날 일을 시각 순으로 */
function makeClock() {
  const q = [];
  let now = 0;
  let seq = 0;
  return {
    now: () => now,
    later(fn, ms) {
      q.push({ at: now + Math.max(0, ms), seq: seq++, fn });
    },
    run(until) {
      while (q.length) {
        let bi = 0;
        for (let i = 1; i < q.length; i++) if (q[i].at < q[bi].at || (q[i].at === q[bi].at && q[i].seq < q[bi].seq)) bi = i;
        const e = q[bi];
        if (e.at > until) break;
        q.splice(bi, 1);
        now = e.at;
        e.fn();
      }
      now = until;
    },
  };
}

/** 시드 난수 (지연 흔들림·손실을 매번 같게) */
function rng(seed) {
  let x = seed | 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

const CHARS = [['raiden', 'oscar'], ['eunwoo', 'edward'], ['oscar', 'raiden'], ['edward', 'eunwoo']];

/**
 * 한 판: 두 사람이 같은 시드·캐릭터로 시작해 CPU 입력으로 싸운다. lag = { rtt, jitter, loss }, delay = 입력 지연 틱.
 * corrupt = [사람, 틱]: 그 틱에 그 사람 상태를 일부러 바꾼다 (어긋남 잡기 시험)
 */
function runMatch({ seed, chars, lag, delay, corrupt = null }) {
  const clock = makeClock();
  const r = rng(seed * 7919 + lag.rtt * 13 + delay);
  const [ctlA, ctlB] = loopPair(clock);
  const [inpA, inpB] = loopPair(clock);
  const links = [
    { ctl: lagged(ctlA, lag, true, clock, r), inp: lagged(inpA, lag, false, clock, r) },
    { ctl: lagged(ctlB, lag, true, clock, r), inp: lagged(inpB, lag, false, clock, r) },
  ];
  const oneWay = lag.rtt / 2;
  // 방장(0)은 시작을 보낸 뒤 왕복의 절반 기다렸다 시작, 손님(1)은 받은 순간 시작 (+ 흔들림)
  const startAt = [oneWay, oneWay + (r() * 2 - 1) * lag.jitter];
  const sides = [0, 1].map((side) => {
    const s = sim.createState(seed, { chars });
    const cpu = sim.createCpu(seed * 31 + side, 60);
    const link = links[side];
    const d = new NetDriver(
      { side, delay, match: 1, seed, chars, build: 'test', now: clock.now, rtt: () => lag.rtt, startAt: startAt[side] },
      { inp: (x) => link.inp.send(x), ctl: (m) => link.ctl.send(JSON.stringify(m)) },
    );
    link.inp.onmessage = (x) => d.onInput(JSON.parse(x));
    link.ctl.onmessage = (x) => {
      const m = JSON.parse(x);
      if (m.t === 'hash') d.onHash(m.m, m.k, m.h);
    };
    return { s, cpu, d, side };
  });
  // 장면 틱: 사람마다 60Hz, 시작 위상이 조금 다르고 프레임마다 ±1ms 흔들림
  const phase = [0, r() * 16];
  const TICK = 1000 / 60;
  let done = false;
  for (const p of sides) {
    let n = 0;
    const frame = () => {
      if (done) return;
      const bits = sim.cpuInput(p.cpu, p.s, p.side);
      for (const [a, b] of p.d.tick(bits)) {
        sim.step(p.s, [a, b]);
        if (corrupt && corrupt[0] === p.side && p.s.tick === corrupt[1]) p.s.fighters[0].hp -= 1;
        p.d.afterStep(p.s);
      }
      n++;
      clock.later(frame, phase[p.side] + n * TICK + (r() * 2 - 1) - clock.now());
    };
    clock.later(frame, phase[p.side]);
  }
  const SLICE = 1000;
  for (let t = SLICE; ; t += SLICE) {
    clock.run(t);
    const [a, b] = sides;
    if ((a.s.phase === 'matchEnd' && b.s.phase === 'matchEnd') || Math.max(a.s.tick, b.s.tick) >= MAX_TICKS) break;
    if (corrupt && (a.d.desync || b.d.desync)) break;
    if (t > (MAX_TICKS / 60) * 1000 * 4) break;
  }
  done = true;
  const [a, b] = sides;
  // 같은 틱까지만 비교 (끝나는 순간 한쪽이 한두 틱 앞설 수 있다)
  const n = Math.min(a.s.tick, b.s.tick);
  const inA = a.d.log.inputs.slice(0, n * 2);
  const inB = b.d.log.inputs.slice(0, n * 2);
  const sameInputs = inA.length === inB.length && inA.every((v, i) => v === inB[i]);
  // 기록을 sim에 다시 넣기
  const re = sim.createState(seed, { chars });
  for (let i = 0; i < n; i++) sim.step(re, [inA[i * 2], inA[i * 2 + 1]]);
  const atA = a.s.tick === n ? sim.hashState(a.s) : null;
  const atB = b.s.tick === n ? sim.hashState(b.s) : null;
  const replay = sim.hashState(re);
  return { a, b, n, sameInputs, replay, atA, atB, seconds: clock.now() / 1000 };
}

let failed = 0;
const ng = (m) => {
  failed++;
  console.log(`NG  ${m}`);
};

// 1) 어긋남 잡기: 2P 쪽 상태를 600틱에 일부러 바꾼다 → 600~630틱 해시에서 잡아야 한다
{
  const r = runMatch({ seed: 5, chars: ['raiden', 'oscar'], lag: { rtt: 50, jitter: 5, loss: 0 }, delay: 3, corrupt: [1, 600] });
  const d = r.a.d.desync ?? r.b.d.desync;
  if (!d || d.k < 600 || d.k > 600 + HASH_EVERY) ng(`일부러 바꾼 상태(600틱)를 잡지 못함: ${JSON.stringify(d)}`);
  else console.log(`OK  어긋남 잡기: 600틱에 2P 상태를 바꿨더니 ${d.k}틱 해시에서 잡음 (양쪽 모두 ${r.a.d.desync && r.b.d.desync ? '표시' : '한쪽만 표시'})`);
}

// 2) 지연 표: 왕복 × 입력 지연, 판마다 끝까지
const table = [];
const LAGS = [0, 50, 100, 150];
for (const rtt of LAGS) {
  for (const delay of [2, 3, 4]) {
    const agg = { stalls: 0, scene: 0, maxStall: 0, sync: 0, reactSum: 0, reactN: 0, reactMax: 0, hashOk: 0, ticks: 0, sec: 0 };
    for (let m = 0; m < MATCHES; m++) {
      const seed = 11 + m;
      const chars = CHARS[m % CHARS.length];
      const lag = { rtt, jitter: rtt ? 8 : 0, loss: rtt ? 0.02 : 0 };
      const r = runMatch({ seed, chars, lag, delay });
      const tag = `왕복 ${rtt}ms·지연 ${delay}틱 ${m + 1}판 (${chars.join(' vs ')})`;
      if (r.a.d.desync || r.b.d.desync) ng(`${tag}: 어긋남 ${JSON.stringify(r.a.d.desync ?? r.b.d.desync)}`);
      if (!r.sameInputs) ng(`${tag}: 양쪽이 쓴 입력 기록이 다름`);
      if ((r.atA && r.atA !== r.replay) || (r.atB && r.atB !== r.replay)) ng(`${tag}: 기록을 다시 넣은 상태 ${r.replay}가 경기 상태(${r.atA}/${r.atB})와 다름`);
      if (r.n < 600) ng(`${tag}: ${r.n}틱밖에 진행 안 됨`);
      for (const p of [r.a, r.b]) {
        const st = p.d.stats;
        agg.stalls += st.stalls;
        agg.scene += st.sceneTicks;
        agg.maxStall = Math.max(agg.maxStall, st.maxStall);
        agg.sync += st.syncWaits;
        agg.reactSum += st.reactSum;
        agg.reactN += st.reactN;
        agg.reactMax = Math.max(agg.reactMax, st.reactMax);
        agg.hashOk += st.hashOk;
      }
      agg.ticks += r.n;
      agg.sec += r.seconds;
    }
    const row = {
      rtt,
      delay,
      stallPct: (agg.stalls / agg.scene) * 100,
      maxStall: agg.maxStall,
      tps: agg.ticks / agg.sec,
      react: agg.reactN ? agg.reactSum / agg.reactN : 0,
      reactMax: agg.reactMax,
      hashOk: agg.hashOk,
      sync: agg.sync,
    };
    table.push(row);
    console.log(
      `OK  왕복 ${String(rtt).padStart(3)}ms 지연 ${delay}틱: 기다림 ${row.stallPct.toFixed(1)}% (가장 길게 ${row.maxStall}틱), 진행 ${row.tps.toFixed(1)}틱/초, ` +
        `누름→반영 평균 ${row.react.toFixed(0)}ms 최대 ${row.reactMax.toFixed(0)}ms, 해시 일치 ${row.hashOk}번, 맞추기 쉼 ${row.sync}`,
    );
  }
}
await vite.close();
console.log(failed ? `NG ${failed}개` : '모두 통과');
process.exit(failed ? 1 : 0);
