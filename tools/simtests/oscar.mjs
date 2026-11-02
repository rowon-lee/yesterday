// oscar 시험 (정해진 입력으로). simtest.mjs가 불러 결과를 찍는다: [이름, 통과, 메모]
// 오스카 (캐릭터 기획서): 평타 검격 자리 판정·검영(최대 5, 사라짐)·스킬 1 원격 베기(표식 뒤 피할 틈)·스킬 2 검영 순간이동·
// 차지 만검지화(단계만큼 만개, 벤 자리 검영)·필살기 월령수류(연출, 검영 수만큼 세짐)·결정론
export default function checks(sim, { runCpuMatch, replay } = {}) {
  const results = [];
  const I = sim;
  const fresh = (x0, x1, chars = ['oscar', 'base']) => {
    const s = sim.createState(1, { chars });
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  const hold = (inp, n) => Array(n).fill(inp);
  const run = (s, inputs, p2 = 0) => {
    const log = [];
    for (const inp of inputs) {
      sim.step(s, [inp, p2]);
      log.push({ ev: s.events.slice(), a: `${s.fighters[0].mode}/${s.fighters[0].move}`, b: s.fighters[1].mode });
    }
    return log;
  };
  const shadows = (f) => {
    let n = 0;
    for (let i = 0; i < 5; i++) if (f.ext[10 + i] > 0) n++;
    return n;
  };
  const evs = (log, pred) => log.flatMap((l) => l.ev).filter(pred);

  // 1) 1타: 베기 선은 몸에서 떨어진 앞 허공에 한 번에 생기고, 상대는 선보다 3틱 늦게 맞는다 — 50px 떨어진 상대가 맞는다
  let s = fresh(2400, 2450);
  let f = s.fighters[0];
  let log = run(s, [I.IN_ATTACK, ...hold(0, 20)]);
  const hit1 = evs(log, (e) => e.type === 'hit' && e.move === 'atk1').length;
  const cutT = log.findIndex((l) => l.ev.some((e) => e.type === 'char' && e.text === 'cut'));
  const hitT = log.findIndex((l) => l.ev.some((e) => e.type === 'hit'));
  results.push(['1타 베기 선이 50px 떨어진 상대를 벤다 (판정 = 선), 선보다 3틱 늦게 맞는다', hit1 === 1 && hitT - cutT === 3, `맞힘 ${hit1}, 선 ${cutT + 1}틱째 → 맞음 ${hitT + 1}틱째`]);
  results.push(['1타 뒤 검영이 하나 남는다', shadows(f) === 1, `검영 ${shadows(f)}`]);

  // 2) 1~4타 연타: 네 번 다 맞고, 그동안 두 몸 중심은 16px 넘게 떨어져 있다
  s = fresh(2400, 2445);
  f = s.fighters[0];
  let minGap = 1e9;
  log = [];
  for (let k = 0; k < 80; k++) {
    sim.step(s, [k % 4 === 0 && k < 48 ? I.IN_ATTACK : 0, 0]);
    log.push({ ev: s.events.slice() });
    minGap = Math.min(minGap, Math.abs(s.fighters[1].x - f.x) / 256);
  }
  const chain = ['atk1', 'atk2', 'atk3', 'atk4'].map((m) => evs(log, (e) => e.type === 'hit' && e.move === m).length);
  results.push(['1~4타 연타가 모두 맞는다', chain.every((n) => n === 1), `맞힘 ${chain.join('·')}`]);
  results.push(['연타 동안 두 몸 중심이 16px 넘게 떨어져 있다', minGap >= 16, `가장 가까울 때 ${minGap.toFixed(1)}px`]);
  results.push(['검영은 최대 5개', (() => {
    for (let k = 0; k < 80; k++) sim.step(s, [k % 4 === 0 ? I.IN_ATTACK : 0, 0]);
    return shadows(f) <= 5;
  })(), `검영 ${shadows(f)}`]);

  // 3) 검영은 시간이 지나면 사라진다 (420틱)
  s = fresh(2400, 2450);
  f = s.fighters[0];
  run(s, [I.IN_ATTACK, ...hold(0, 30)]);
  const before = shadows(f);
  run(s, hold(0, 420));
  results.push(['검영은 일정 시간 뒤 사라진다', before === 1 && shadows(f) === 0, `${before} → ${shadows(f)}`]);

  // 4) 스킬 1: 멀리(190px) 선 상대 자리에 표식(점선)이 뜨고, 가만히 있으면 18틱째 실선으로 베이고 3틱 늦게 맞는다 / 표식 뒤 비켜나면 헛벤다
  s = fresh(2400, 2590);
  f = s.fighters[0];
  f.meter = 100;
  log = run(s, [I.IN_SKILL1, ...hold(0, 50)]);
  const mark = evs(log, (e) => e.type === 'char' && e.text === 'mark');
  const cutAt = log.findIndex((l) => l.ev.some((e) => e.type === 'char' && e.text === 'cut'));
  const s1hit = evs(log, (e) => e.type === 'hit' && e.move === 'skill1').length;
  const s1At = log.findIndex((l) => l.ev.some((e) => e.type === 'hit' && e.move === 'skill1'));
  results.push(['스킬 1: 상대 자리에 표식 → 18틱째 그 자리를 곧바로 벤다 (190px 밖에서도), 3틱 늦게 맞음', mark.length === 1 && s1hit === 1 && cutAt === 18 && s1At === cutAt + 3, `표식 ${mark.length}, 벰 ${cutAt + 1}틱째, 맞음 ${s1At + 1}틱째, 맞힘 ${s1hit}`]);
  s = fresh(2400, 2590);
  f = s.fighters[0];
  f.meter = 100;
  log = run(s, [I.IN_SKILL1, ...hold(0, 4)], 0);
  log.push(...run(s, hold(0, 40), I.IN_RIGHT));
  const dodged = evs(log, (e) => e.type === 'hit' && e.move === 'skill1').length;
  results.push(['스킬 1: 표식이 뜬 뒤 비켜나면 헛벤다 (피할 틈)', dodged === 0, `맞힘 ${dodged}`]);

  // 5) 스킬 2: 검영이 있으면 그 자리로 순간이동 (검영 하나 씀), 없으면 뒤로 그림자 걸음
  s = fresh(2400, 2450);
  f = s.fighters[0];
  f.meter = 300;
  run(s, [I.IN_ATTACK, ...hold(0, 30)]);
  const sx = f.ext[0];
  const n0 = shadows(f);
  run(s, hold(I.IN_LEFT, 30));
  const x0 = f.x;
  log = run(s, [I.IN_SKILL2, ...hold(0, 30)]);
  const warp = evs(log, (e) => e.type === 'char' && e.text === 'warp');
  // 검영이 상대 몸에 겹쳐 있으면 상대 바로 옆(가운데끼리 26px)에 나타난다
  const gapAfter = Math.abs(s.fighters[1].x - f.x) / 256;
  results.push(['스킬 2: 검영 자리로 순간이동하고 그 검영은 사라진다 (상대와 겹치지 않게)', warp.length === 1 && Math.abs(f.x - sx) < 256 * 30 && gapAfter >= 16 && shadows(f) === n0 - 1, `순간이동 ${warp.length}, ${(x0 / 256).toFixed(0)} → ${(f.x / 256).toFixed(0)} (검영 ${(sx / 256).toFixed(0)}, 상대와 ${gapAfter.toFixed(0)}px), 검영 ${n0} → ${shadows(f)}`]);
  s = fresh(2400, 2600);
  f = s.fighters[0];
  f.meter = 100;
  const bx = f.x;
  run(s, [I.IN_SKILL2, ...hold(0, 20)]);
  results.push(['스킬 2: 검영이 없으면 뒤로 64px 그림자 걸음', Math.round((bx - f.x) / 256) === 64, `${((f.x - bx) / 256).toFixed(0)}px`]);
  // 높이 뜬 검영: 그 위에 서서 한 번 더 뛴다 (공중, 2단 점프가 다시 생김)
  s = fresh(2400, 2600);
  f = s.fighters[0];
  f.meter = 100;
  f.ext[0] = 2500 * 256;
  f.ext[5] = -90 * 256;
  f.ext[10] = 300;
  log = run(s, [I.IN_SKILL2, ...hold(0, 10)]);
  results.push(['스킬 2: 고른 검영 자리로 (9틱째) — 높이 뜬 검영 위에 서서 뛰어오른다 (2단 점프 다시)', f.mode === 'air' && f.vy < 0 && !f.airJumpUsed && Math.abs(f.x - 2500 * 256) < 256, `${f.mode} vy ${(f.vy / 256).toFixed(1)} x ${(f.x / 256).toFixed(0)}`]);

  // 6) 차지 만검지화: 길게 눌러 3단계 → 떼면 만개한 자리 셋이 한꺼번에 베이고 (맞힘 한 번), 벤 자리 셋이 검영으로 남는다
  s = fresh(2400, 2470);
  f = s.fighters[0];
  log = run(s, [...hold(I.IN_ATTACK, 80), ...hold(0, 60)]);
  const lv = evs(log, (e) => e.type === 'charge' && e.text === 'release')[0]?.combo ?? 0;
  const cut = evs(log, (e) => e.type === 'char' && e.text === 'bloomcut')[0]?.combo ?? 0;
  const chit = evs(log, (e) => e.type === 'hit' && e.move === 'charge').length;
  results.push(['차지: 3단계로 떼면 검영 셋이 한꺼번에 베인다 (맞힘 1번)', lv === 3 && cut === 3 && chit === 1, `단계 ${lv}, 벤 자리 ${cut}, 맞힘 ${chit}`]);
  results.push(['차지: 벤 자리가 검영으로 남는다 (1타 1개 + 만개 3개)', shadows(f) === 4, `검영 ${shadows(f)}`]);

  // 7) 필살기 월령수류: 맞으면 연출 → 끝에 피해 (기술 데이터) + 검영 하나에 24, 검영은 모두 쓴다. 빗나가면 40틱 굳음
  const superDamage = (n) => {
    const st = fresh(2400, 2480);
    const a = st.fighters[0];
    const d = st.fighters[1];
    a.meter = 300;
    for (let i = 0; i < n; i++) {
      a.ext[i] = (2300 + i * 10) * 256;
      a.ext[5 + i] = -30 * 256;
      a.ext[10 + i] = 400;
    }
    const hp0 = d.hp;
    const l = run(st, [I.IN_SUPER, ...hold(0, 360)]);
    const ends = evs(l, (e) => e.type === 'cine' && e.text === 'end').length;
    return { dmg: hp0 - d.hp, ends, left: shadows(a) };
  };
  const s0 = superDamage(0);
  const s5 = superDamage(5);
  // 기본 피해는 기술 데이터에서 읽는다 (밸런스로 바뀐다), 검영 하나에 24
  const base = sim.movesOf('oscar').super.data.damage;
  results.push([`필살기: 맞으면 연출이 끝까지 가고 피해 ${base} (기술 데이터)`, s0.ends === 1 && s0.dmg === base, `연출 끝 ${s0.ends}, 피해 ${s0.dmg}`]);
  results.push([`필살기: 검영 5개면 피해 ${base} + 5×24 = ${base + 120}, 검영은 모두 쓴다`, s5.dmg === base + 120 && s5.left === 0, `피해 ${s5.dmg}, 남은 검영 ${s5.left}`]);
  s = fresh(2400, 2700);
  f = s.fighters[0];
  f.meter = 300;
  log = run(s, [I.IN_SUPER, ...hold(0, 140)]);
  const stuck = log.filter((l) => l.a.startsWith('land')).length;
  results.push(['필살기: 빗나가면 크게 굳는다 (240px 밖)', stuck >= 40, `굳은 틱 ${stuck}`]);

  // 7-2) 월령수류는 보이는 화면 전체를 벤다 (220px 떨어져도 맞음). 연출 220틱 (전개 70·검영 40·정적 20·백색 20·어긋남 40·납도 30),
  //      같은 경기 두 번째부터 짧은 판 150틱 (전개·검영을 40틱으로). 막으면 연출 없이 막힌다
  const cineLen = (l) => {
    const a = l.findIndex((x) => x.ev.some((e) => e.type === 'cine' && e.text === 'start'));
    const b = l.findIndex((x) => x.ev.some((e) => e.type === 'cine' && e.text === 'end'));
    return a >= 0 && b > a ? b - a : -1;
  };
  s = fresh(2400, 2620);
  f = s.fighters[0];
  f.meter = 300;
  log = run(s, [I.IN_SUPER, ...hold(0, 360)]);
  const full = cineLen(log);
  s.fighters[0].meter = 300;
  s.fighters[0].x = 2400 * 256;
  s.fighters[1].x = 2480 * 256;
  while (s.fighters[0].mode !== 'idle' || s.fighters[1].mode !== 'idle') sim.step(s, [0, 0]);
  log = run(s, [I.IN_SUPER, ...hold(0, 300)]);
  const second = cineLen(log);
  results.push(['필살기: 220px 떨어진 상대도 벤다 (화면 전체), 연출 220틱 → 같은 경기 두 번째는 짧은 판 150틱', full === 220 && second === 150, `첫 연출 ${full}틱, 두 번째 ${second}틱`]);
  s = fresh(2400, 2520);
  f = s.fighters[0];
  f.meter = 300;
  log = run(s, [I.IN_SUPER, ...hold(0, 120)], I.IN_DOWN);
  const blocked = evs(log, (e) => e.type === 'block' && e.move === 'super').length;
  const cined = evs(log, (e) => e.type === 'cine' && e.text === 'start').length;
  results.push(['필살기: 막으면 연출 없이 막힌다 (빗나감은 없지만 방어는 된다)', blocked === 1 && cined === 0, `막힘 ${blocked}, 연출 ${cined}`]);

  // 9) 선에 걸린 작은 물건(가로등)은 잘려 부서진다: 가로등 앞에서 1타 (선이 기둥을 지난다)
  const lampI = I.BREAKABLES.findIndex((b) => b.kind === 'lamp' && b.x > 900);
  if (lampI >= 0) {
    const lamp = I.BREAKABLES[lampI];
    s = fresh(Math.round(lamp.x - 40), Math.round(lamp.x + 260));
    log = run(s, [I.IN_ATTACK, ...hold(0, 20)]);
    results.push(['선에 걸린 가로등은 한 번에 잘려 부서진다', s.props[lampI].stage === 2, `가로등 ${lampI} 단계 ${s.props[lampI].stage}`]);
  }

  // 8) 결정론: 오스카가 낀 CPU 대전 (재생·저장 복원 같은 해시)
  if (runCpuMatch && replay) {
    for (const chars of [['oscar', 'raiden'], ['raiden', 'oscar'], ['oscar', 'oscar']]) {
      const a = runCpuMatch(7, 20000, null, { chars });
      const b = replay(7, a.log, null, null, { chars });
      const c = replay(7, a.log, Math.floor(a.log.length / 2), null, { chars });
      results.push([`CPU 대전 ${chars.join(' 대 ')} 결정론·문제 없음`, a.hash === b && a.hash === c && a.problems.length === 0 && a.ended, `${a.log.length}틱, ${a.rounds}라운드, 승자 ${a.winner + 1}P, 히트 ${a.stats.hit}, 필살 ${a.stats.cutin}${a.problems.length ? `, ${a.problems[0]}` : ''}`]);
    }
  }
  return results;
}
