// raiden 대전 장면 (npm run moveclip -- 장면 이름). 형식은 tools/moveclip.mjs의 SCENES와 같다
export default {
  // 사용자 피드백 2026-11-02 (9-3) 스킬 2 화과산(I): 들숨(몸 윤곽 전류) → 날숨 반구 스파크(반지름 40 = 판정) → 상대 64~80px 밀림(발 끌며 물 튐 두 줄)
  // → 라이덴 앞 40px 전류 방벽 커튼(마지막 12틱 깜빡이며 사라짐) · 상대 머리 위 저주 표식과 윤곽을 찌릿 지나는 검붉은 전류
  raiden_hwagwasan: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4530, p2: 4560, settle: 30,
    prep: 's.fighters[0].meter = 100; s.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 8], [['KeyI'], 1], [[], 115]],
  },
  // 사용자 피드백 2026-11-02 (9-4) 필살기 파천(O) 150틱: 0~20 시간 정지(배경 거의 검게, 2배 확대, 검붉은 사선 띠 破天·파천) →
  // 20~32 진각(바닥 금·물 튐)·붕권 → 32~56 정적(비가 공중에 서고 닿은 점만 붉다) → 56~80 어둡게 비친 상대 뼈대를 따라 전류(섬광 두 번)
  // → 80~96 등 뒤로 검붉은 원뿔(흰 심) → 96~130 일직선 잿더미·불씨, 상대는 화면 밖으로, 카메라는 라이덴에 → 130~150 잔심(김·재)
  // 상대 등 뒤(오른쪽)에 아파트 건물 정면이 있는 자리 (잿더미 줄이 건물을 깎는다)
  raiden_pacheon: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3700, p2: 3740, settle: 30,
    prep: 's.fighters[0].meter = 300; s.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], [['KeyO'], 1], [[], 175]],
  },
  // 파천이 빗나감: 가로 풍압 줄 3~4개가 앞으로 날아가고 40틱 굳는다
  raiden_pacheon_whiff: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4500, p2: 4700, settle: 30,
    prep: 's.fighters[0].meter = 300;',
    steps: [[[], 6], [['KeyO'], 1], [[], 110]],
  },
  // 필살기 컷인 네 개 (사용자 피드백 2026-11-02 '10. 공통'): 캐릭터 대표 색 띠 + 한국어 이름(한자)
  cutin_raiden: { q: 'scene=fight&p2=idle&p1char=raiden', p1: 4500, p2: 4700, settle: 30, prep: 's.fighters[0].meter = 300;', steps: [[[], 4], [['KeyO'], 1], [[], 24]] },
  cutin_eunwoo: { q: 'scene=fight&p2=idle&p1char=eunwoo', p1: 4500, p2: 4700, settle: 30, prep: 's.fighters[0].meter = 300;', steps: [[[], 4], [['KeyO'], 1], [[], 24]] },
  cutin_edward: { q: 'scene=fight&p2=idle&p1char=edward', p1: 4500, p2: 4700, settle: 30, prep: 's.fighters[0].meter = 300;', steps: [[[], 4], [['KeyO'], 1], [[], 24]] },
  cutin_oscar: { q: 'scene=fight&p2=idle&p1char=oscar', p1: 4500, p2: 4700, settle: 30, prep: 's.fighters[0].meter = 300;', steps: [[[], 4], [['KeyO'], 1], [[], 24]] },
  // 사용자 피드백 2026-11-02 (9-2): 64px 떨어진 상대에게 지상 1~4타 (몸 이동 10·10·8·28, 상대 밀림 6·6·10 → 날아감, 줄기 하나씩)
  // 금강(4합째 금강불괴 반짝임)이 4타와 겹치지 않게 두 사람 스택을 미리 비워 둔다 (이 장면은 1~4타 이펙트만 본다)
  raiden_combo: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4490, p2: 4554, settle: 30,
    prep: 's.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], ...Array.from({ length: 16 }, () => [[['KeyJ'], 1], [[], 3]]).flat(), [[], 50]],
  },
  raiden_combo_boxes: {
    q: 'scene=fight&p2=idle&p1char=raiden&boxes=1', p1: 4490, p2: 4554, settle: 30,
    prep: 's.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], ...Array.from({ length: 16 }, () => [[['KeyJ'], 1], [[], 3]]).flat(), [[], 50]],
  },
  // 동작연출지침서 8장 2번: 1~4타 연타를 판정 상자와 함께 (번개가 덮는 범위와 판정 상자가 맞는지)
  raiden_ground_boxes: {
    q: 'scene=fight&p2=idle&p1char=raiden&boxes=1', p1: 3150, p2: 3190, settle: 30,
    steps: [[[], 6], ...Array.from({ length: 18 }, () => [[['KeyJ'], 1], [[], 3]]).flat(), [[], 40]],
  },
  // 사용자 피드백 2026-11-02 (9-1) 투전승불: 60px 앞 상대에게 끝까지(4단계) 모아 뗀다 → 원뿔 방전 → 방어 깨짐·아주 멀리 → 40틱 탈진(김)
  // (J를 18틱 넘게 쥐면 잽 뒤에 모으기 시작: 모은 틱 ≈ 쥔 틱 − 18. 단계 20·45·75·110)
  raiden_charge4: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4490, p2: 4550, settle: 30,
    prep: 's.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], [['KeyJ'], 133], [[], 80]],
  },
  // 막는 상대에게 4단계: 방어가 깨지고(가드 크러시) 라이덴은 40틱 탈진 (한쪽 무릎을 꿇고 어깨로 숨, 김)
  raiden_charge4_guard: {
    q: 'scene=fight&dummy=guard&p1char=raiden', p1: 4490, p2: 4550, settle: 30,
    prep: 's.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], [['KeyJ'], 133], [[], 90]],
  },
  // 단계별 떼기 (1·2·3단계): 같은 60px에서 몸 이동·원뿔·밀림 차이
  raiden_charge1: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4490, p2: 4550, settle: 30,
    prep: 's.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], [['KeyJ'], 43], [[], 50]],
  },
  raiden_charge2: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4490, p2: 4550, settle: 30,
    prep: 's.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], [['KeyJ'], 68], [[], 50]],
  },
  raiden_charge3: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4490, p2: 4550, settle: 30,
    prep: 's.fighters[0].kongo = -4; s.fighters[1].kongo = -4;',
    steps: [[[], 6], [['KeyJ'], 98], [[], 60]],
  },
};
