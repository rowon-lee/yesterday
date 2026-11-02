// 백은우 시험 (정해진 입력으로). simtest.mjs가 불러 결과를 찍는다: [이름, 통과, 메모]
// 고유 특성 백합 낙인(방어막·미끄러짐), 스킬 1 응답(순간이동 3번), 스킬 2(회복·빨라짐·낙인), 차지(끌어당김), 필살기(연출 330틱·짧은 판·회복·둔해짐),
// 연검 판정 선(그림과 같음·리치), 연타 이음(몸·리본), 등장 160틱, 결정론
export default function checks(sim, { runCpuMatch, replay }) {
  const results = [];
  const I = sim;
  const EXT = { LILY: 0, BUFF: 1, CHAIN: 2, DULL: 3, HEALED: 4 };
  /** 은우(1P)와 상대(2P) — 싸움이 시작된 상태로 */
  const fresh = (x0, x1, p2 = 'raiden') => {
    const s = sim.createState(1, { chars: ['eunwoo', p2] });
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  const run = (s, inputs, p2 = 0) => {
    const ev = [];
    for (const inp of inputs) {
      sim.step(s, [inp, typeof p2 === 'function' ? p2(s) : p2]);
      ev.push(...s.events);
    }
    return ev;
  };
  const hold = (inp, n) => Array(n).fill(inp);

  // 1) 스킬 2: 기력 1칸으로 낙인과 5초 회복·빨라짐. 체력이 조금씩 찬다
  let s = fresh(2400, 2600);
  let e = s.fighters[0];
  e.meter = 100;
  e.hp = 500;
  run(s, [I.IN_SKILL2]);
  const marked = e.ext[EXT.LILY] === 1 && e.ext[EXT.BUFF] > 0 && e.meter === 0;
  run(s, hold(0, 320));
  results.push(['스킬 2: 낙인·나비 5초, 체력이 조금씩 찬다 (모두 90)', marked && e.hp === 590 && e.ext[EXT.BUFF] === 0, `낙인 ${marked}, 체력 500 → ${e.hp}`]);

  // 2) 백합 낙인: 다음 공격 한 번을 통째로 막는다 (체력·경직 없음, 맞는 동작 없이 조금만 미끄러짐), 낙인은 사라진다. 그다음 공격은 맞는다
  s = fresh(2400, 2440);
  e = s.fighters[0];
  e.ext[EXT.LILY] = 1;
  const hp0 = e.hp;
  const xs0 = e.x;
  let ev = run(s, hold(0, 1), I.IN_ATTACK);
  const modes = new Set();
  for (let k = 0; k < 30; k++) {
    ev.push(...run(s, [0]));
    modes.add(e.mode);
  }
  const shielded = ev.some((x) => x.type === 'char' && x.text === 'shield' && x.who === 0);
  const slid = (xs0 - e.x) / 256;
  const noHitMotion = !modes.has('hitstun') && !modes.has('blockstun');
  results.push(['백합 방어막: 맞는 동작 없이 조금만 뒤로 미끄러진다 (1~12px)', shielded && noHitMotion && slid >= 1 && slid <= 12, `미끄러짐 ${slid.toFixed(1)}px, 상태 ${[...modes].join('·')}`]);
  const hp1 = e.hp;
  ev = run(s, hold(0, 1), I.IN_ATTACK);
  ev.push(...run(s, hold(0, 30)));
  const hitAfter = ev.some((x) => x.type === 'hit' && x.who === 1);
  results.push(['백합 낙인: 다음 공격 한 번을 방어막이 막고 사라진다 (그다음은 맞는다)', shielded && hp1 === hp0 && e.ext[EXT.LILY] === 0 && hitAfter && e.hp < hp0, `막음 ${shielded}, 체력 ${hp0} → ${hp1} → ${e.hp}, 그다음 맞음 ${hitAfter}`]);

  // 3) 스킬 1 응답: 앞으로 76px 순간이동, 기술이 끝나기 전 다시 누르면 기력 없이 이어 튐 (3번까지)
  s = fresh(2000, 2400);
  e = s.fighters[0];
  e.meter = 100;
  const x0 = e.x;
  ev = run(s, [I.IN_SKILL1, ...hold(0, 7)]);
  const d1 = (e.x - x0) / 256;
  ev.push(...run(s, [I.IN_SKILL1, ...hold(0, 7), I.IN_SKILL1, ...hold(0, 7), I.IN_SKILL1, ...hold(0, 30)]));
  const teles = ev.filter((x) => x.type === 'char' && x.text === 'teleport' && x.who === 0).length;
  results.push(['스킬 1 응답: 앞으로 76px 순간이동, 다시 눌러 기력 없이 3번까지 이어 튐', d1 === 76 && teles === 3 && e.meter === 0, `첫 순간이동 ${d1}px, 순간이동 ${teles}번, 기력 ${e.meter}`]);

  // 4) 스킬 1 응답: 위를 누르면 위로 (공중에서 천천히 내려온다)
  s = fresh(2000, 2400);
  e = s.fighters[0];
  e.meter = 100;
  run(s, [I.IN_SKILL1 | I.IN_UP, ...hold(I.IN_UP, 6)]);
  const up = -e.y / 256;
  run(s, hold(0, 80));
  results.push(['스킬 1 응답: 위를 누르면 56px 위로 (떠 있다 천천히 내려옴), 내려와 다시 선다', up >= 54 && up <= 56 && e.y === 0 && e.mode !== 'attack', `높이 ${up}px → 끝 ${-e.y / 256}px ${e.mode}`]);

  // 5) 차지 스텔라리스 발도: 맞으면 상대가 은우 쪽으로 끌려온다 (날림 vx가 은우 쪽)
  s = fresh(2400, 2470);
  e = s.fighters[0];
  const d = s.fighters[1];
  ev = run(s, hold(I.IN_ATTACK, 60));
  ev.push(...run(s, hold(0, 4)));
  const chargeHit = ev.find((x) => x.type === 'hit' && x.move === 'charge' && x.who === 0);
  let pulled = false;
  for (let k = 0; k < 20 && !pulled; k++) {
    if (d.vx < 0) pulled = true;
    run(s, [0]);
  }
  results.push(['차지 스텔라리스 발도: 맞은 상대를 와이어로 은우 쪽으로 끌어당긴다', !!chargeHit && pulled, `맞힘 ${!!chargeHit}, 끌려옴 ${pulled}`]);

  // 6) 필살기 선의 (11-5): 맞으면 연출 약 330틱 → 끝에 은우 회복 260·낙인, 상대는 느려짐 (점점 더 둔해짐)
  s = fresh(2400, 2450);
  e = s.fighters[0];
  e.meter = 300;
  e.hp = 400;
  ev = [];
  let cineTicks1 = 0;
  for (let k = 0; k < 420; k++) {
    ev.push(...run(s, [k === 0 ? I.IN_SUPER : 0]));
    if (s.cine) cineTicks1++;
  }
  const cine = ev.some((x) => x.type === 'cine' && x.text === 'start' && x.who === 0);
  const ended = ev.some((x) => x.type === 'cine' && x.text === 'end' && x.who === 0);
  const slowed = s.fighters[1].slowT > 0 || s.fighters[1].mode === 'knockdown' || s.fighters[1].mode === 'getup';
  results.push(['필살기 선의: 연출 300틱(발동과 합쳐 약 330) → 은우 체력 260 회복·백합 낙인, 상대 둔해짐', cine && ended && cineTicks1 === 300 && e.hp === 660 && e.ext[EXT.LILY] === 1 && e.ext[EXT.DULL] > 0 && slowed, `연출 ${cine}/${ended} ${cineTicks1}틱, 체력 400 → ${e.hp}, 낙인 ${e.ext[EXT.LILY]}, 둔해짐 ${e.ext[EXT.DULL]}틱 남음`]);

  // 6-2) 같은 경기 두 번째 선의는 짧은 판 (전개 30틱 → 연출 270틱)
  s = fresh(2400, 2450);
  e = s.fighters[0];
  e.meter = 300;
  e.cines = 1;
  let cineTicks2 = 0;
  let short = false;
  for (let k = 0; k < 400; k++) {
    run(s, [k === 0 ? I.IN_SUPER : 0]);
    if (s.cine) {
      cineTicks2++;
      short = short || s.cine.short;
    }
  }
  results.push(['필살기 선의 두 번째부터 짧은 판 (전개를 30틱으로: 연출 270틱)', short && cineTicks2 === 270, `짧은 판 ${short}, 연출 ${cineTicks2}틱`]);

  // 8) 연검 판정 선 (11-0): 공격 데이터의 선이 지금 동작 그림의 리본과 같다 (점 8개: 손, 손잡이 끝, 날 마디 6개)
  const mv = sim.movesOf('eunwoo');
  const PICK = [0, 1, 3, 4, 5, 6, 8, 9];
  let lineMoves = 0;
  let lineBad = [];
  for (const [id, m] of Object.entries(mv)) {
    if (!m.data.line) continue;
    lineMoves++;
    for (const f of m.data.active) {
      const rib = m.frames.joints[f]?.fx?.rib;
      const want = rib && PICK.map((k) => rib[k]);
      const got = m.data.line[f];
      if (!want || !got || JSON.stringify(want) !== JSON.stringify(got)) lineBad.push(`${id}#${f}`);
    }
  }
  results.push(['연검 판정 선 = 그 프레임 리본 위의 점 8개 (공격 데이터, tools/ribbon-lines.mjs)', lineMoves >= 8 && lineBad.length === 0, `선 판정 기술 ${lineMoves}개${lineBad.length ? `, 다름 ${lineBad.join(' ')}` : ''}`]);

  // 9) 연검 선 판정: 1타는 리본 끝(약 60px)까지 닿고, 그보다 멀면 상자가 겹쳐도 선이 지나지 않으면 맞지 않는다
  const reachTest = (dist) => {
    const st = fresh(2400, 2400 + dist);
    const evs = run(st, [I.IN_ATTACK, ...hold(0, 22)]);
    return evs.some((x) => x.type === 'hit' && x.who === 0 && x.move === 'atk1');
  };
  const near = reachTest(50);
  const far = reachTest(78);
  results.push(['연검 1타: 50px에서 맞고 78px에서 헛친다 (리본 선 판정)', near && !far, `50px ${near ? '맞음' : '헛침'}, 78px ${far ? '맞음' : '헛침'}`]);

  // 10) 연타 이음 (11-2): 다음 타의 첫 프레임 = 앞 타의 판정 바로 뒤 프레임 (몸·리본 모두), 기본자세로 돌아가지 않는다
  const chain = [['atk1', 'atk2'], ['atk2', 'atk3'], ['atk3', 'atk4']].map(([a, b]) => {
    const A = mv[a];
    const B = mv[b];
    const fa = A.frames.joints[A.data.active[A.data.active.length - 1] + 1];
    const fb = B.frames.joints[0];
    const same = ['hip', 'neck', 'hF', 'hB', 'fF', 'fB'].every((k) => fa[k][0] === fb[k][0] && fa[k][1] === fb[k][1]);
    const rib = JSON.stringify(fa.fx?.rib) === JSON.stringify(fb.fx?.rib);
    return [a, b, same && rib];
  });
  results.push(['연타 이음: 다음 타 첫 프레임 = 앞 타 판정 뒤 프레임 (몸·연검 리본)', chain.every((c) => c[2]), chain.map((c) => `${c[0]}→${c[1]} ${c[2] ? '이어짐' : '끊김'}`).join(', ')]);

  // 11) 등장 (11-3): 첫 라운드 시작 연출이 은우 등장 160틱만큼
  const s0 = sim.createState(1, { chars: ['eunwoo', 'raiden'] });
  let introT = 0;
  while (s0.phase !== 'fight' && introT < 400) {
    sim.step(s0, [0, 0]);
    introT++;
  }
  results.push(['등장 160틱: 첫 라운드 시작 연출이 은우 등장 길이만큼', introT >= 160 && introT <= 175, `싸움 시작까지 ${introT}틱`]);

  // 7) 결정론: 은우가 낀 CPU 대전 (재생·저장/복원 해시가 같다)
  for (const chars of [['eunwoo', 'raiden'], ['raiden', 'eunwoo'], ['eunwoo', 'eunwoo']]) {
    const opts = { chars };
    const a = runCpuMatch(77, 6000, null, opts);
    const b = replay(77, a.log, null, null, opts);
    const c = replay(77, a.log, Math.floor(a.log.length / 2), null, opts);
    results.push([`CPU 대전 ${chars.join(' 대 ')} 결정론`, a.hash === b && a.hash === c && a.problems.length === 0, `${a.log.length}틱 히트 ${a.stats.hit} 해시 ${a.hash}${a.problems.length ? ` 문제 ${a.problems[0]}` : ''}`]);
  }
  return results;
}
