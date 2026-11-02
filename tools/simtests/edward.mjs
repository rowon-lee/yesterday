// 에드워드 시험 (정해진 입력으로). simtest.mjs가 불러 결과를 찍는다: [이름, 통과, 메모]
// 껍데기(먼저 대신 받음·3초 뒤 참), 해머가 작은 물건을 한 방에, 재현:나(방어 깨기·피해 강화·껍데기 깎임),
// 염동력(앞: 끌어당김, 뒤: 밀어냄), 차지 충격파, 잡기 필살기(막을 수 없음·껍데기가 참), CPU 대전 결정론
const SHELL = 0;
const SHELL_MAX = 300;

export default function checks(sim, { runCpuMatch, replay }) {
  const results = [];
  const I = sim;
  const fresh = (x0, x1, chars = ['edward', 'raiden'], opts = {}) => {
    const s = sim.createState(1, { chars, ...opts });
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  const hold = (inp, n) => Array(n).fill(inp);
  const run = (s, inputs, p2 = 0) => {
    const log = [];
    for (const inp of inputs) {
      sim.step(s, [inp, typeof p2 === 'function' ? p2(s) : p2]);
      log.push(s.events.slice());
    }
    return log;
  };

  // 1) 껍데기: 라운드 시작에 가득, 맞으면 껍데기가 먼저 대신 받는다 (체력은 그대로)
  let s = fresh(3150, 3190, ['raiden', 'edward']);
  let ed = s.fighters[1];
  const hp0 = ed.hp;
  const shell0 = ed.ext[SHELL];
  run(s, [I.IN_ATTACK, ...hold(0, 30)]);
  results.push(['라운드 시작에 껍데기가 가득, 맞으면 껍데기가 먼저 받고 체력은 그대로', shell0 === SHELL_MAX && ed.ext[SHELL] < SHELL_MAX && ed.hp === hp0,
    `껍데기 ${shell0} → ${ed.ext[SHELL]}, 체력 ${hp0} → ${ed.hp}`]);
  // 껍데기가 바닥나면 체력이 깎인다
  ed.ext[SHELL] = 5;
  const hp1 = ed.hp;
  run(s, [I.IN_ATTACK, ...hold(0, 30)]);
  results.push(['껍데기가 모자라면 남은 피해는 체력으로', ed.ext[SHELL] === 0 && ed.hp < hp1, `껍데기 5 → ${ed.ext[SHELL]}, 체력 ${hp1} → ${ed.hp}`]);
  // 3초 동안 맞지 않으면 천천히 찬다: 맞고 2초 동안은 그대로, 3초가 넘으면 2틱에 1씩
  run(s, hold(0, 90));
  const still = ed.ext[SHELL];
  run(s, hold(0, 120));
  const from = ed.ext[SHELL];
  run(s, hold(0, 60));
  results.push(['3초 동안 맞지 않으면 껍데기가 천천히 찬다 (2틱에 1)', still === 0 && from > 0 && ed.ext[SHELL] - from === 30, `맞고 2초 ${still}, 4초 ${from}, 1초 더 ${ed.ext[SHELL]}`]);

  // 2) 해머 평타는 작은 물건(가로등)을 한 방에 부순다
  const lampIdx = sim.BREAKABLES.findIndex((b) => b.kind === 'lamp' && b.x > 2000 && b.x < 4400);
  if (lampIdx >= 0) {
    const lamp = sim.BREAKABLES[lampIdx];
    s = fresh(lamp.x - 46, lamp.x + 200);
    s.fighters[0].facing = 1;
    run(s, [I.IN_ATTACK, ...hold(0, 30)]);
    results.push(['해머 1타가 가로등(내구도 90)을 한 방에 부순다', s.props[lampIdx].stage === 2, `가로등 x=${lamp.x}, 단계 ${s.props[lampIdx].stage}`]);
  }

  // 3) 재현:나: 기력 1칸·껍데기 70을 쓰고, 다음 평타가 막혀도 방어를 깬다
  s = fresh(3130, 3186);
  s.fighters[0].meter = 100;
  let e = s.fighters[0];
  const sh0 = e.ext[SHELL];
  run(s, [I.IN_SKILL1, ...hold(0, 40)], I.IN_DOWN);
  const usedMeter = e.meter === 0;
  const cost = sh0 - e.ext[SHELL];
  let log = run(s, [I.IN_ATTACK, ...hold(0, 30)], I.IN_DOWN);
  const crushed = log.some((evs) => evs.some((x) => x.type === 'crush'));
  results.push(['재현:나: 기력 1칸과 껍데기 70을 쓰고, 다음 평타는 막혀도 방어를 깬다', usedMeter && cost === 70 && crushed, `기력 ${e.meter}, 껍데기 -${cost}, 가드 크러시 ${crushed}`]);
  // 강화된 평타는 피해가 1.7배
  s = fresh(3130, 3186);
  s.fighters[0].meter = 100;
  const plain = (() => {
    const t = fresh(3130, 3186);
    const h = t.fighters[1].hp;
    run(t, [I.IN_ATTACK, ...hold(0, 30)]);
    return h - t.fighters[1].hp;
  })();
  run(s, [I.IN_SKILL1, ...hold(0, 40)]);
  const h2 = s.fighters[1].hp;
  run(s, [I.IN_ATTACK, ...hold(0, 30)]);
  const boosted = h2 - s.fighters[1].hp;
  results.push(['강화된 평타는 피해 ×1.7, 한 번만', boosted === Math.trunc((plain * 170) / 100) && s.fighters[0].ext[2] === 0, `보통 ${plain}, 강화 ${boosted}`]);

  // 4) 염동력: 앞+스킬 2는 멀리 선 상대를 끌어당긴다
  s = fresh(3060, 3190);
  s.fighters[0].meter = 100;
  run(s, [I.IN_SKILL2 | I.IN_RIGHT, ...hold(I.IN_RIGHT, 40)]);
  const gap = Math.abs(s.fighters[1].x - s.fighters[0].x) / 256;
  results.push(['앞+스킬 2: 130px 떨어진 상대를 에드워드 앞까지 끌어당긴다', gap < 48 && s.fighters[1].hp < s.fighters[1].hp + 1, `떨어진 거리 130 → ${gap.toFixed(0)}px`]);
  // 뒤+스킬 2는 밀어내 날린다
  s = fresh(3150, 3196);
  s.fighters[0].meter = 100;
  log = run(s, [I.IN_SKILL2 | I.IN_LEFT, ...hold(I.IN_LEFT, 14)]);
  const d = s.fighters[1];
  const flown = d.mode === 'airhit' || d.mode === 'wallsplat';
  run(s, hold(0, 40));
  const far = Math.abs(s.fighters[1].x - s.fighters[0].x) / 256;
  results.push(['뒤+스킬 2: 가까운 상대를 밀어내 날린다 (벽 앞이면 벽꽝)', flown && (far > 70 || d.mode === 'wallsplat' || log.some((x) => x.some((v) => v.type === 'wallsplat'))), `상태 ${d.mode}, 거리 ${far.toFixed(0)}px`]);

  // 5) 차지 3단계: 해머가 닿지 않는 거리의 상대를 충격파가 바닥을 타고 가서 띄운다
  s = fresh(3100, 3240);
  log = run(s, [...hold(I.IN_ATTACK, 96), ...hold(0, 40)]);
  const waveHit = log.some((evs) => evs.some((x) => x.type === 'hit' && x.move === 'charge'));
  results.push(['차지 3단계: 140px 떨어진 상대를 충격파가 맞혀 띄운다', waveHit, `맞힘 ${waveHit}, 상대 ${s.fighters[1].mode}`]);

  // 6) 필살기: 막고 있는 상대도 잡는다 (연출), 끝나면 큰 피해와 껍데기가 찬다
  s = fresh(3150, 3184);
  e = s.fighters[0];
  e.meter = 300;
  e.ext[SHELL] = 20;
  const dh = s.fighters[1].hp;
  let cine = false;
  for (let k = 0; k < 400; k++) {
    sim.step(s, [k === 0 ? I.IN_SUPER : 0, I.IN_DOWN]);
    cine ||= !!s.cine;
  }
  results.push(['필살기는 막을 수 없는 잡기: 막는 상대도 연출로, 끝에 큰 피해 + 껍데기 +200', cine && dh - s.fighters[1].hp >= 200 && e.ext[SHELL] >= 220,
    `연출 ${cine}, 피해 ${dh - s.fighters[1].hp}, 껍데기 20 → ${e.ext[SHELL]}`]);
  // 사거리가 아주 짧다: 60px 떨어지면 빗나가 40틱 굳는다
  s = fresh(3150, 3210);
  s.fighters[0].meter = 300;
  log = run(s, [I.IN_SUPER, ...hold(0, 140)]);
  const whiff = log.some((evs) => evs.some((x) => x.type === 'cine' && x.text === 'whiff'));
  results.push(['필살기 사거리는 아주 짧다 (60px면 빗나가 굳는다)', whiff, `빗나감 ${whiff}`]);

  // 7) CPU 대전 결정론 (에드워드가 낀 판)
  for (const chars of [['edward', 'raiden'], ['raiden', 'edward'], ['edward', 'edward']]) {
    const a = runCpuMatch(5, 6000, null, { chars });
    const b = replay(5, a.log, null, null, { chars });
    const c = replay(5, a.log, Math.floor(a.log.length / 2), null, { chars });
    results.push([`CPU 대전 ${chars.join(' 대 ')} 결정론 (재생·저장/복원 같은 해시)`, a.hash === b && a.hash === c && a.problems.length === 0, `${a.log.length}틱, 히트 ${a.stats.hit}, 해시 ${a.hash}`]);
  }
  return results;
}
