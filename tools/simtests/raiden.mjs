// raiden 시험 (정해진 입력으로). simtest.mjs가 불러 결과를 찍는다: [이름, 통과, 메모]
// 평타 11개·투전승불·잔흔의 궤적 상자(번개 범위 = 판정), 화과산(밀어내기·전격 저주·전류 방벽), 파천(연출·잿더미 줄·빗나감)
export default function checks(sim) {
  const results = [];
  const M = sim.movesOf('raiden');
  const fresh = (x0, x1, chars = ['raiden', 'base']) => {
    const s = sim.createState(1, { chars });
    while (s.phase !== 'fight') sim.step(s, [0, 0]);
    s.fighters[0].x = x0 * 256;
    s.fighters[1].x = x1 * 256;
    return s;
  };
  /** 입력을 넣으며 [사건들]을 모은다 */
  const run = (s, inputs, p2 = () => 0) => {
    const ev = [];
    inputs.forEach((inp, t) => {
      sim.step(s, [inp, p2(t, s)]);
      ev.push(...s.events.map((e) => ({ ...e, t })));
    });
    return ev;
  };

  // 1) 평타 11개·잔흔·화과산·파천: 궤적 상자가 있고, 판정 프레임의 판정 끝이 궤적 상자 끝과 같다 (번개 범위 = 판정 범위)
  {
    const ids = ['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'skill1', 'super'];
    const bad = [];
    for (const id of ids) {
      const mv = M[id];
      const b = mv.data.box;
      if (!b) {
        bad.push(`${id} 상자 없음`);
        continue;
      }
      // 상자의 앞끝 (발밑 기준). 실제 대전의 판정 끝은 아래 2)에서 잰다
      const far = b.x + b.w;
      if (b.w < 20 || b.h < 10) bad.push(`${id} 상자가 작음 ${b.w}×${b.h}`);
      if (far < 34) bad.push(`${id} 리치 ${far}`);
    }
    results.push(['평타 11개·잔흔·파천 모두 궤적 상자(번개 범위)가 있다', bad.length === 0, bad.join(', ') || ids.map((id) => `${id} ${M[id].data.box.shape} ${M[id].data.box.x + M[id].data.box.w}px`).join(', ')]);
  }
  // 2) 실제 대전: 땅 평타는 헛쳐도 판정 끝이 궤적 상자 끝까지 (몸 중심 기준)
  {
    const want = { atk1: [sim.IN_ATTACK], launcher: [sim.IN_ATTACK | sim.IN_UP], sweep: [sim.IN_ATTACK | sim.IN_DOWN] };
    const got = [];
    let ok = true;
    for (const [id, inp] of Object.entries(want)) {
      const s = fresh(3000, 3500);
      let reach = -1;
      for (let t = 0; t < 40; t++) {
        sim.step(s, [t === 0 ? inp[0] : 0, 0]);
        const f = s.fighters[0];
        const hb = sim.boxesOf(f).hit;
        if (hb && f.move === id) reach = Math.max(reach, Math.round((hb.x1 - f.x) / 256));
      }
      const b = M[id].data.box;
      got.push(`${id} ${reach}/${b.x + b.w}`);
      ok &&= reach === b.x + b.w;
    }
    results.push(['헛쳐도 판정 끝 = 궤적 상자 끝 (잽·어퍼컷·다리 걸기)', ok, got.join(', ')]);
  }
  // 3) 투전승불 (사용자 피드백 2026-11-02 9-1): 모은 틱 20·45·75·110에 1~4단계 (20틱 전에 떼도 1단계).
  //    떼면 몸 이동 12/16/20/24px, 판정(원뿔) 끝 56/64/72/80px (몸 가운데에서)
  {
    const levels = M.charge.data.charge.levels;
    const ats = levels.map((l) => l.at).join('/');
    const rows = [];
    // 쥔 틱 → 모은 틱 ≈ 쥔 틱 − 18 (잽 뒤에 모으기 시작): 12(0단계 → 1단계 수치), 52, 82, 122
    for (const hold of [30, 70, 100, 140]) {
      const s = fresh(3000, 3600);
      let reach = -1;
      let lv = 0;
      let x0 = null;
      let x1 = null;
      for (let t = 0; t < hold + 60; t++) {
        sim.step(s, [t < hold ? sim.IN_ATTACK : 0, 0]);
        const f = s.fighters[0];
        if (f.mode === 'attack' && f.move === 'charge') {
          if (x0 === null) x0 = f.x;
          x1 = f.x;
          lv = f.chargeLv;
          const hb = sim.boxesOf(f).hit;
          if (hb) reach = Math.max(reach, Math.round((hb.x1 - f.x) / 256));
        }
      }
      rows.push({ lv, reach, adv: x0 === null ? -1 : Math.round((x1 - x0) / 256) });
    }
    const wantReach = [56, 64, 72, 80];
    const wantAdv = [12, 16, 20, 24];
    // 몸 이동은 떼는 틱(스미어 프레임 시작)부터 재므로 첫 틱 이동분은 빠질 수 있다 (±1)
    const ok = ats === '20/45/75/110' && rows.every((r, k) => r.lv === k + 1 && r.reach === wantReach[k] && Math.abs(r.adv - wantAdv[k]) <= 1);
    results.push(['투전승불: 단계 20·45·75·110틱, 떼면 몸 이동 12/16/20/24 · 원뿔 판정 끝 56/64/72/80px', ok,
      `단계 틱 ${ats}, ` + rows.map((r) => `${r.lv}단계 끝 ${r.reach}px 이동 ${r.adv}px`).join(', ')]);
    // 상대 반응: 1 짧게 < 2 중간 < 3 멀리 < 4 아주 멀리 (밀려난 거리), 4단계는 막아도 방어가 깨진다
    // 벽꽝이 나지 않는 자리 (공원: 뒤에 건물 정면·큰 물건이 없다)
    const pushed = [];
    for (const hold of [30, 70, 100, 140]) {
      const s = fresh(4490, 4550, ['raiden', 'raiden']);
      s.fighters[0].kongo = -9;
      s.fighters[1].kongo = -9;
      let dx = 0;
      let before = null;
      for (let t = 0; t < hold + 90; t++) {
        sim.step(s, [t < hold ? sim.IN_ATTACK : 0, 0]);
        for (const e of s.events) if (e.type === 'hit' && e.who === 0 && e.move === 'charge') before = s.fighters[1].x;
      }
      if (before !== null) dx = Math.round((s.fighters[1].x - before) / 256);
      pushed.push(dx);
    }
    const s4 = fresh(4490, 4550, ['raiden', 'raiden']);
    s4.fighters[0].kongo = -9;
    s4.fighters[1].kongo = -9;
    let crushed = false;
    for (let t = 0; t < 200; t++) {
      sim.step(s4, [t < 140 ? sim.IN_ATTACK : 0, sim.IN_DOWN]);
      crushed ||= s4.events.some((e) => e.type === 'crush' && e.who === 0 && e.move === 'charge');
    }
    const order = pushed.every((d, k) => k === 0 || d > pushed[k - 1]);
    results.push(['투전승불: 밀려난 거리 1 < 2 < 3 < 4단계, 4단계는 막아도 가드 크러시', order && pushed[0] > 0 && crushed,
      `밀려난 거리 ${pushed.map((d) => `${d}px`).join(' / ')}, 4단계 막음 → 크러시 ${crushed}`]);
  }
  // 4) 4타 슈퍼맨 펀치: 상대가 멀리 날아간다 (벽 쪽으로 날림)
  {
    const s = fresh(3150, 3190);
    const ev = run(s, Array.from({ length: 110 }, (_, i) => (i % 4 === 0 ? sim.IN_ATTACK : 0)));
    const hit4 = ev.find((e) => e.type === 'hit' && e.who === 0 && e.move === 'atk4');
    const d = s.fighters[1];
    const flown = hit4 ? Math.abs(d.x - s.fighters[0].x) / 256 : 0;
    results.push(['슈퍼맨 펀치(4타)에 맞으면 상대가 멀리 날아간다', !!hit4 && flown > 90, hit4 ? `떨어진 거리 ${flown.toFixed(0)}px, 상대 ${d.mode}` : '4타 맞힘 없음']);
  }
  // 5) 화과산: 붙은 상대를 크게 밀어내고 전격 저주 (라이덴에게 주는 피해 30% 감소), 범위 끝 전류 방벽이 다시 들어오는 대시를 튕겨 낸다
  {
    const s = fresh(3150, 3180);
    s.fighters[0].meter = sim.RULES.METER_MAX;
    let before = 0;
    const ev = [];
    for (let t = 0; t < 51; t++) {
      const x = s.fighters[1].x;
      sim.step(s, [t === 0 ? sim.IN_SKILL2 : 0, 0]);
      for (const e of s.events) {
        ev.push({ ...e, t });
        if (e.type === 'hit' && e.who === 0 && e.move === 'skill2') before = x;
      }
    }
    const hit = ev.find((e) => e.type === 'hit' && e.who === 0 && e.move === 'skill2');
    // 사용자 피드백 2026-11-02 (9-3): 날숨 판정 7~10틱, 상대 64~80px 밀림, 라이덴 앞 40px에 방벽
    const pushed = (s.fighters[1].x - before) / 256;
    const cursed = s.fighters[0].ext[0] > 0;
    const barrier = ev.find((e) => e.type === 'char' && e.text === 'barrier');
    const bdist = barrier ? Math.round((barrier.x - s.fighters[0].x) / 256) : -1;
    results.push(['화과산: 날숨(7~10틱)에 붙은 상대를 64~80px 밀어내고 전격 저주·라이덴 앞 40px 전류 방벽',
      !!hit && hit.t >= 6 && hit.t <= 10 && pushed >= 64 && pushed <= 80 && cursed && bdist === 40,
      `맞힘 ${hit ? `${hit.t}틱` : '없음'}, 밀린 거리 ${pushed.toFixed(0)}px, 저주 ${s.fighters[0].ext[0]}틱, 방벽 ${bdist}px`]);
    // 상대가 대시로 다시 들어오면 방벽에 튕겨 나간다
    for (let t = 0; t < 30 && s.fighters[1].mode !== 'idle'; t++) sim.step(s, [0, 0]);
    const ev2 = run(s, Array(40).fill(0), () => sim.IN_LEFT);
    const deflect = ev2.find((e) => e.type === 'char' && e.text === 'deflect');
    const outside = (s.fighters[1].x - s.fighters[0].ext[2]) / 256;
    results.push(['전류 방벽: 다시 걸어 들어오는 상대를 튕겨 낸다', !!deflect && outside >= 0, `튕김 ${!!deflect}, 방벽 너머 ${outside.toFixed(0)}px`]);
    // 전격 저주: 저주받은 상대의 공격은 라이덴에게 30% 약하다
    const hurt = (cursed2) => {
      const s2 = fresh(3150, 3190, ['base', 'raiden']);
      if (cursed2) s2.fighters[1].ext[0] = 120;
      const hp0 = s2.fighters[1].hp;
      for (let t = 0; t < 20; t++) sim.step(s2, [t === 0 ? sim.IN_ATTACK : 0, 0]);
      return hp0 - s2.fighters[1].hp;
    };
    const a = hurt(false);
    const b = hurt(true);
    results.push(['전격 저주: 저주받은 상대의 공격 피해 30% 감소', a > 0 && b === Math.max(1, Math.trunc((a * 70) / 100)), `보통 ${a}, 저주 ${b}`]);
    // 뒤에 붙은 상대는 뒤로 밀어낸다
    const s3 = fresh(3150, 3130);
    s3.fighters[0].meter = sim.RULES.METER_MAX;
    s3.fighters[0].facing = 1;
    run(s3, [sim.IN_SKILL2, ...Array(40).fill(0)]);
    const back = (s3.fighters[0].x - s3.fighters[1].x) / 256;
    results.push(['화과산: 뒤에 붙은 상대는 뒤로 밀려난다', back > 40, `뒤로 떨어진 거리 ${back.toFixed(0)}px`]);
  }
  // 6) 파천: 맞으면 장면 셋 연출 → 끝에 날아가고, 맞은 자리 등 뒤로 일직선 건물이 깎인다 (잿더미). 빗나가면 40틱 굳음
  {
    const s = fresh(3150, 3185);
    s.fighters[0].meter = sim.RULES.METER_MAX;
    const ev = run(s, [sim.IN_SUPER, ...Array(260).fill(0)]);
    const cut = ev.find((e) => e.type === 'cutin');
    const start = ev.find((e) => e.type === 'cine' && e.text === 'start');
    const sceneEv = ev.filter((e) => e.type === 'cine' && e.text === 'scene');
    const end = ev.find((e) => e.type === 'cine' && e.text === 'end');
    const ash = ev.find((e) => e.type === 'char' && e.text === 'ash');
    const city = ev.filter((e) => e.type === 'city' && ash && e.t >= ash.t).length;
    const total = sim.cineTicks('raiden', 'super');
    // 사용자 피드백 2026-11-02 (9-4): 발동부터 연출 끝까지 150틱 (정지 20 + 발동 12 + 장면 24·24·16·34·20), 넷째 장면(96틱째)에 잿더미 줄
    const all = cut && end ? end.t - cut.t : -1;
    const ashAt = cut && ash ? ash.t - cut.t : -1;
    results.push(['파천: 150틱 (정지 20·발동 12·장면 다섯 118), 넷째 장면 시작(96틱)에 잿더미 줄', !!start && sceneEv.length === 4 && !!end && end.t - start.t === total && all === 150 && ashAt === 96,
      `발동~끝 ${all}틱, 연출 ${start && end ? end.t - start.t : '-'}틱 (데이터 ${total}), 장면 넘김 ${sceneEv.length}, 잿더미 ${ashAt}틱째, 깎인 건물 사건 ${city}`]);
    const s2 = fresh(3000, 3500);
    s2.fighters[0].meter = sim.RULES.METER_MAX;
    let lag = 0;
    let whiff = false;
    for (let t = 0; t < 160; t++) {
      sim.step(s2, [t === 0 ? sim.IN_SUPER : 0, 0]);
      whiff ||= s2.events.some((e) => e.type === 'cine' && e.text === 'whiff');
      if (s2.fighters[0].mode === 'land' && s2.fighters[0].len > 20) lag++;
    }
    results.push(['파천: 빗나가면 풍압만 날아가고 40틱 굳는다', whiff && lag === M.super.data.cinematic.whiff, `빗나감 ${whiff}, 굳음 ${lag}틱`]);
  }
  return results;
}
