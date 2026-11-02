// raiden 대전 장면 (npm run moveclip -- 장면 이름). 형식은 tools/moveclip.mjs의 SCENES와 같다
export default {
  // 스킬 2 화과산(I): 붙은 상대를 몸 둘레 번개 고리로 크게 밀어내고, 밀어낸 범위 끝에 전류 방벽이 선다 (상대 몸에 전격 저주)
  raiden_hwagwasan: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3150, p2: 3180, settle: 30,
    prep: 's.fighters[0].meter = 100;',
    steps: [[[], 8], [['KeyI'], 1], [[], 80]],
  },
  // 필살기 파천(O): 컷인 → 붕권이 맞으면 연출 세 장면 (주먹을 대고 멈춤 → 등 뒤로 터져 나감 → 날아감) → 등 뒤 일직선 잿더미
  raiden_pacheon: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 2950, p2: 2990, settle: 30,
    prep: 's.fighters[0].meter = 300;',
    steps: [[[], 8], [['KeyO'], 1], [[], 230]],
  },
  // 파천이 빗나감: 풍압만 앞으로 날아가고 40틱 굳는다
  raiden_pacheon_whiff: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3100, p2: 3300, settle: 30,
    prep: 's.fighters[0].meter = 300;',
    steps: [[[], 8], [['KeyO'], 1], [[], 130]],
  },
  // 동작연출지침서 8장 2번: 1~4타 연타를 판정 상자와 함께 (번개가 덮는 범위와 판정 상자가 맞는지)
  raiden_ground_boxes: {
    q: 'scene=fight&p2=idle&p1char=raiden&boxes=1', p1: 3150, p2: 3190, settle: 30,
    steps: [[[], 6], ...Array.from({ length: 18 }, () => [[['KeyJ'], 1], [[], 3]]).flat(), [[], 40]],
  },
  // 투전승불 4단계: 상대를 멀리 두고 끝까지 모아 떼면 화면 폭 절반(240px)까지 뻗는 번개
  raiden_charge4: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3000, p2: 3230, settle: 30,
    steps: [[[], 6], [['KeyJ'], 100], [[], 80]],
  },
};
