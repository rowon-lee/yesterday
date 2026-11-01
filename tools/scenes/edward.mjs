// 에드워드 대전 장면 (npm run moveclip -- 장면 이름). 형식은 tools/moveclip.mjs의 SCENES와 같다
export default {
  // 에드워드 등장: 경기 시작부터 (1P·2P 모두 에드워드, 2P는 회색 정장)
  edward_intro: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=edward', stopAt: 1, settle: 0,
    steps: [[[], 96]],
  },
  // 에드워드 대기: 1P·2P 모두 에드워드, 가만히 한 바퀴 반 (70틱 × 1.5)
  edward_idle: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=edward', p1: 3060, p2: 3180, settle: 70,
    steps: [[[], 105]],
  },
  // 에드워드 이동: 앞 걷기 → 뒤 걷기 → 점프·2단 점프·낙하·착지(쿵) → 지상 대시 → 점프·공중 대시 → 방어
  edward_moves: {
    q: 'scene=fight&p2=idle&p1char=edward', p1: 3000, p2: 3260, settle: 70,
    steps: [
      [[], 16], [['ArrowRight'], 60], [[], 14], [['ArrowLeft'], 50], [[], 16],
      [['KeyK'], 1], [[], 24], [['KeyK'], 1], [[], 56],
      [['KeyL'], 1], [[], 34],
      [['KeyK'], 1], [[], 10], [['KeyL'], 1], [[], 50],
      [['KeyS'], 30], [[], 20],
    ],
  },
  // 에드워드 방어·방어 막힘: 2P 에드워드가 막기만 하고, 1P 기본 스틱맨이 평타 1·2·3타 → 대시 공격
  edward_guard: {
    q: 'scene=fight&dummy=guard&p2char=edward', p1: 3150, p2: 3196, settle: 30,
    steps: [[[], 10], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 40], [['ArrowLeft'], 12], [[], 6], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 50]],
  },
  // 에드워드 벽 기동: 기둥탑 왼쪽 면(x 3040) 앞. ↗ 점프로 벽 붙기 → 미끄러짐 → 벽 박차기 공격(해머 내려치기) → 다시 벽 쪽으로 걸어가
  // ↑+대시로 벽 달리기 → 꼭대기에 못 닿아 벽 붙기 → 벽 점프
  edward_wall: {
    q: 'scene=fight&p2=idle&p1char=edward', p1: 2992, p2: 3260, settle: 40,
    steps: [
      [[], 10], [['ArrowRight', 'ArrowUp', 'KeyK'], 1], [['ArrowRight', 'ArrowUp'], 18], [['ArrowRight'], 14], [['KeyJ'], 1], [[], 50],
      [['ArrowRight'], 36], [[], 4], [['ArrowRight', 'ArrowUp', 'KeyL'], 1], [['ArrowRight'], 34], [['ArrowRight'], 20], [['KeyK'], 1], [[], 50],
    ],
  },
  // 에드워드 승리: 체력이 거의 없는 상대를 평타로 쓰러뜨리고 승리 동작
  edward_win: {
    q: 'scene=fight&p2=idle&p1char=edward', settle: 10, p1: 3150, p2: 3200,
    prep: 's.fighters[0].wins = 1; s.round = 2; s.fighters[1].hp = 30;',
    steps: [[[], 4], [['KeyJ'], 1], [[], 8], [['KeyJ'], 1], [[], 8], [['KeyJ'], 1], [[], 8], [['KeyJ'], 1], [[], 200]],
  },
  // 에드워드 지상 평타: 공격을 5틱마다 눌러 1타 어깨 내려찍기 → 2타 옆 휘두르기 → 3타 올려치기 → 4타 내려찍기 (충격파, 벽 쪽으로 날림)
  edward_ground: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3130, p2: 3184, settle: 30,
    steps: [[[], 6], ...Array.from({ length: 16 }, () => [[['KeyJ'], 1], [[], 4]]).flat(), [[], 60]],
  },
  // 에드워드 띄우기(↑+공격, 퍼 올리기) → 점프로 쫓아 공중 1·2·3타 (내려치기 → 옆 휘두르기 → 한 바퀴 돌려치기)
  edward_air: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3150, p2: 3196, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 15], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 7], ...Array.from({ length: 10 }, () => [[['KeyJ'], 1], [[], 3]]).flat(), [[], 50]],
  },
  // 에드워드 띄우기 → 쫓아 점프 → 내려찍기(↓+공격)
  edward_slam: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3150, p2: 3196, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 15], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], [['ArrowDown', 'KeyJ'], 1], [[], 70]],
  },
  // 에드워드 쓸기(↓+공격, 바닥 쓸기) → 상대가 일어나면 물러났다가 대시 공격(돌진 휘두르기)
  edward_low: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3150, p2: 3196, settle: 30,
    steps: [[[], 6], [['ArrowDown', 'KeyJ'], 1], [[], 100], [['ArrowLeft'], 30], [[], 6], [['KeyL'], 1], [[], 4], [['KeyJ'], 1], [[], 60]],
  },
  // 에드워드 차지 워 해머 내려치기: 공격을 길게 눌러 1타 → 모으기 1~3단계 (푸른 빛) → 떼면 땅을 내리쳐 충격파가 바닥을 타고 달린다 (멀리 선 상대를 띄움)
  edward_charge: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3100, p2: 3240, settle: 40,
    steps: [[[], 6], [['KeyJ'], 96], [[], 80]],
  },
  // 에드워드 스킬 1 재현:나 → 막고 있는 상대에게 강화된 1타 (방어가 깨진다), 껍데기 게이지가 깎인다
  edward_reenact: {
    q: 'scene=fight&dummy=guard&p1char=edward&p2char=raiden', p1: 3130, p2: 3186, settle: 30,
    prep: 's.fighters[0].meter = 100;',
    steps: [[[], 6], [['KeyU'], 1], [[], 40], [['KeyJ'], 1], [[], 70]],
  },
  // 에드워드 스킬 2 염동력 (앞+스킬 2): 멀리 선 상대를 끌어당겨 1타·2타
  edward_pull: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3060, p2: 3190, settle: 30,
    prep: 's.fighters[0].meter = 100;',
    steps: [[[], 6], [['ArrowRight', 'KeyI'], 1], [['ArrowRight'], 30], [[], 2], [['KeyJ'], 1], [[], 5], [['KeyJ'], 1], [[], 50]],
  },
  // 에드워드 스킬 2 염동력 (뒤+스킬 2): 가까운 상대를 밀어내 날린다 (근처 가로등·자동차를 으스러뜨려 날림)
  edward_push: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3150, p2: 3196, settle: 30,
    prep: 's.fighters[0].meter = 100;',
    steps: [[[], 6], [['ArrowLeft', 'KeyI'], 1], [['ArrowLeft'], 20], [[], 70]],
  },
  // 에드워드 필살기 껍데기 뒤집어쓰기: 막고 있는 상대를 잡아 들어 올려 기억을 흡수한다 (막을 수 없다)
  edward_super: {
    q: 'scene=fight&dummy=guard&p1char=edward&p2char=raiden', p1: 3150, p2: 3184, settle: 30,
    meter: true,
    steps: [[[], 6], [['KeyO'], 1], [[], 250]],
  },
  // 에드워드 필살기 빗나감: 64px 떨어진 상대 (잡기 사거리 46px 밖) → 손이 허공을 쥐고 40틱 굳는다
  edward_super_whiff: {
    q: 'scene=fight&p2=idle&p1char=edward&p2char=raiden', p1: 3150, p2: 3214, settle: 30,
    meter: true,
    steps: [[[], 6], [['KeyO'], 1], [[], 110]],
  },
  // 껍데기: 2P 에드워드가 1P 라이덴에게 맞는다 (맞을 때마다 푸른 장막, 체력바 위 껍데기 게이지가 먼저 깎임)
  edward_shell: {
    q: 'scene=fight&p2=idle&p1char=raiden&p2char=edward', p1: 3150, p2: 3196, settle: 30,
    steps: [[[], 6], ...Array.from({ length: 8 }, () => [[['KeyJ'], 1], [[], 5]]).flat(), [[], 60]],
  },
};
