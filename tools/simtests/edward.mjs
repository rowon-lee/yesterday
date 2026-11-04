// 에드워드 시험 (정해진 입력으로). simtest.mjs가 불러 결과를 찍는다: [이름, 통과, 메모]
// 껍데기(먼저 대신 받음·2초 뒤 참), 해머가 작은 물건을 한 방에, 재현:나(방어 깨기·피해 강화·껍데기 깎임),
// 염동력(앞: 끌어당김 32px, 뒤: 밀어냄 80px), 차지 바닥 파도·잔해, 평타 연타·넉백, 내려찍기 충격파, 잡기 필살기(막을 수 없음·껍데기가 참), CPU 대전 결정론
const SHELL = 0;
const SHELL_MAX = 400;

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
  // 2초 동안 맞지 않으면 찬다: 맞고 1.5초 동안은 그대로, 2초가 넘으면 1틱에 1씩 (피드백 12 뒤 밸런스)
  run(s, hold(0, 60));
  const still = ed.ext[SHELL];
  run(s, hold(0, 120));
  const from = ed.ext[SHELL];
  run(s, hold(0, 60));
  results.push(['2초 동안 맞지 않으면 껍데기가 찬다 (1틱에 1)', still === 0 && from > 0 && ed.ext[SHELL] - from === 60, `맞고 1.5초 ${still}, 3.5초 ${from}, 1초 더 ${ed.ext[SHELL]}`]);

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

  // 4) 염동력 (피드백 12-3): 앞+스킬 2는 멀리 선 상대를 장막으로 움켜쥐어 끌어당긴다 — 끌려오는 동안 발이 뜨고, 에드워드 앞 32px에 떨어진다
  s = fresh(3060, 3190);
  s.fighters[0].meter = 100;
  let lifted = false;
  run(s, [I.IN_SKILL2 | I.IN_RIGHT, ...hold(I.IN_RIGHT, 2), ...hold(0, 30)]);
  lifted = s.fighters[1].y < 0;
  run(s, hold(0, 30));
  const gap = Math.abs(s.fighters[1].x - s.fighters[0].x) / 256;
  results.push(['앞+스킬 2: 130px 떨어진 상대가 발이 뜬 채 끌려와 에드워드 앞 32px에 떨어진다', lifted && Math.abs(gap - 32) <= 2 && s.fighters[1].y === 0,
    `떨어진 거리 130 → ${gap.toFixed(1)}px, 끌려오는 중 발 뜸 ${lifted}`]);
  // 뒤+스킬 2는 장막 벽에 붙여 80px 밀어낸 뒤 장막이 터지며 날린다 (밀어내는 동안은 두 손으로 미는 다른 그림)
  s = fresh(3150, 3196);
  s.fighters[0].meter = 100;
  run(s, [I.IN_SKILL2 | I.IN_LEFT, ...hold(I.IN_LEFT, 2), ...hold(0, 12)]);
  const alt = sim.fighterSpan(s.fighters[0]).motion;
  log = run(s, hold(0, 34));
  const d = s.fighters[1];
  const carried = (d.x / 256) - 3196;
  const flown = d.mode === 'airhit' || d.mode === 'wallsplat';
  results.push(['뒤+스킬 2: 장막 벽에 붙은 채 80px 밀려났다가 장막이 터지며 날아간다 (그림은 tk_push)', flown && carried >= 78 && alt === 'edward/tk_push' && log.some((x) => x.some((v) => v.type === 'char' && v.text === 'tkBurst')),
    `상태 ${d.mode}, 밀린 거리 ${carried.toFixed(0)}px, 그림 ${alt}`]);

  // 5) 차지 3단계 (피드백 12-2 올려치기): 해머가 닿지 않는 거리의 상대를 앞쪽 바닥 파도(96px)가 맞혀 높이 띄우고, 들린 바닥은 잔해로 남는다
  s = fresh(3100, 3240);
  log = run(s, [...hold(I.IN_ATTACK, 96), ...hold(0, 40)]);
  const waveHit = log.some((evs) => evs.some((x) => x.type === 'hit' && x.move === 'charge'));
  const e0 = s.fighters[0];
  results.push(['차지 3단계: 140px 떨어진 상대를 바닥 파도가 맞혀 띄우고, 잔해(96px)가 남는다', waveHit && e0.ext[17] === 1 && e0.ext[14] === 96,
    `맞힘 ${waveHit}, 상대 ${s.fighters[1].mode}, 잔해 ${e0.ext[17]}번 길이 ${e0.ext[14]}px`]);

  // 5-2) 평타 (피드백 12-1): 1~4타가 모두 이어지고, 1타 넉백은 12px
  s = fresh(3130, 3176);
  const x1 = s.fighters[1].x;
  run(s, [I.IN_ATTACK, ...hold(0, 50)]);
  const knock = (s.fighters[1].x - x1) / 256;
  s = fresh(3130, 3184);
  log = run(s, [...Array.from({ length: 30 }, () => [I.IN_ATTACK, 0, 0, 0, 0]).flat(), ...hold(0, 60)]);
  const chain = ['atk1', 'atk2', 'atk3', 'atk4'].filter((m) => log.some((evs) => evs.some((x) => x.type === 'hit' && x.move === m)));
  results.push(['평타 1~4타가 모두 이어 맞고, 1타 넉백은 12px', chain.length === 4 && Math.abs(knock - 12) <= 1.5, `맞은 타 ${chain.join('·')}, 1타 넉백 ${knock.toFixed(1)}px`]);
  // 5-3) 내려찍기: 공중에 멈췄다 수직으로 떨어져 착지 지점 반원 충격파(반지름 48px)로 서 있는 상대를 맞힌다
  s = fresh(3150, 3190);
  log = run(s, [I.IN_JUMP, ...hold(0, 12), I.IN_ATTACK | I.IN_DOWN, ...hold(0, 70)]);
  const landed = log.some((evs) => evs.some((x) => x.type === 'char' && x.text === 'slamLand'));
  const slamHit = log.some((evs) => evs.some((x) => x.type === 'hit' && x.move === 'slam'));
  results.push(['내려찍기: 수직으로 떨어져 착지하며 반원 충격파, 가까이 선 상대를 맞힌다', landed && slamHit, `착지 ${landed}, 맞힘 ${slamHit}`]);

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
