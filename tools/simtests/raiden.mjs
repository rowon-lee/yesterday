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
  // 3) 투전승불: 단계마다 번개(= 판정)가 길어져 4단계는 주먹 끝에서 화면 폭 절반(240px)까지
  {
    const levels = M.charge.data.charge.levels;
    const ends = [];
    for (const hold of [24, 45, 70, 100]) {
      const s = fresh(3000, 3600);
      let reach = -1;
      let lv = 0;
      for (let t = 0; t < hold + 40; t++) {
        sim.step(s, [t < hold ? sim.IN_ATTACK : 0, 0]);
        const f = s.fighters[0];
        if (f.mode === 'attack' && f.move === 'charge') {
          lv = f.chargeLv;
          const hb = sim.boxesOf(f).hit;
          if (hb) reach = Math.max(reach, Math.round((hb.x1 - f.x) / 256));
        }
      }
      ends.push([lv, reach]);
    }
    const ok = ends.every(([lv, r]) => lv >= 1 && r === levels[lv - 1].box.x + levels[lv - 1].box.w) && ends[3][0] === 4 && ends[3][1] === 240;
    results.push(['투전승불: 단계마다 판정이 길어져 4단계는 240px (번개 = 판정)', ok, ends.map(([lv, r]) => `${lv}단계 ${r}px`).join(', ')]);
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
    const ev = run(s, [sim.IN_SKILL1 * 0 + sim.IN_SKILL2, ...Array(50).fill(0)]);
    const hit = ev.find((e) => e.type === 'hit' && e.who === 0 && e.move === 'skill2');
    const pushed = (s.fighters[1].x - s.fighters[0].x) / 256;
    const cursed = s.fighters[0].ext[0] > 0;
    const barrier = ev.find((e) => e.type === 'char' && e.text === 'barrier');
    results.push(['화과산: 붙은 상대를 크게 밀어내고 (60px 넘게) 전격 저주·전류 방벽', !!hit && pushed > 60 && cursed && !!barrier,
      `맞힘 ${!!hit}, 떨어진 거리 ${pushed.toFixed(0)}px, 저주 ${s.fighters[0].ext[0]}틱, 방벽 ${barrier ? `${(barrier.x - s.fighters[0].x) / 256}px` : '없음'}`]);
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
    const start = ev.find((e) => e.type === 'cine' && e.text === 'start');
    const scenes = ev.filter((e) => e.type === 'cine' && e.text === 'scene').length;
    const end = ev.find((e) => e.type === 'cine' && e.text === 'end');
    const ash = ev.find((e) => e.type === 'char' && e.text === 'ash');
    const city = ev.filter((e) => e.type === 'city' && end && e.t >= end.t).length;
    const total = sim.cineTicks('raiden', 'super');
    results.push(['파천: 맞으면 장면 셋 (붕권 → 등 뒤로 터짐 → 날아감) 연출 뒤 잿더미 줄', !!start && scenes === 2 && !!end && end.t - start.t === total && !!ash,
      `연출 ${start && end ? end.t - start.t : '-'}틱 (데이터 ${total}), 장면 넘김 ${scenes}, 잿더미 ${!!ash}, 깎인 건물 사건 ${city}`]);
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
