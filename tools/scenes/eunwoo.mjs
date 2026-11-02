// 백은우 대전 장면 (npm run moveclip -- 장면 이름). 형식은 tools/moveclip.mjs의 SCENES와 같다.
// 1P 은우(왼쪽, 오른쪽을 봄), 2P는 가만히 선 라이덴.
const Q = 'scene=fight&p2=idle&p1char=eunwoo&p2char=raiden';
const tap = (key, n = 1) => [[[key], 1], [[], n]];

export default {
  // 1단계: 대기 (무대 빛·테두리 빛 속에서)
  eunwoo_idle: { q: Q, p1: 3120, p2: 3220, settle: 30, steps: [[[], 70]] },
  // 2단계: 앞 걷기 → 뒤 걷기 → 점프 → 2단 점프 → 착지 → 대시 → 공중 대시
  eunwoo_move: {
    q: Q, p1: 3000, p2: 3330, settle: 30,
    steps: [
      [['ArrowRight'], 40], [[], 6], [['ArrowLeft'], 34], [[], 8],
      [['KeyK'], 1], [[], 16], [['KeyK'], 1], [[], 40],
      [['KeyL'], 1], [[], 20], [['KeyK'], 1], [[], 10], [['KeyL'], 1], [[], 40],
    ],
  },
  // 방어: 2P 라이덴이 치고 은우가 막는다 (2P CPU 대신 1P가 ←를 눌러 막는다)
  eunwoo_guard: {
    q: 'scene=fight&p2=idle&p1char=raiden&p2char=eunwoo', p1: 3150, p2: 3200, settle: 30,
    steps: [[[], 6], ...tap('KeyJ', 3), ...tap('KeyJ', 3), ...tap('KeyJ', 3), ...tap('KeyJ', 3), [[], 40]],
  },
  // 지상 평타 1~4타 (같은 거리에서 시작한 4타 연속, 동작연출지침서 8장)
  eunwoo_ground: {
    q: Q, p1: 3120, p2: 3190, settle: 30,
    steps: [[[], 6], ...Array.from({ length: 14 }, () => tap('KeyJ', 3)).flat(), [[], 50]],
  },
  // 띄우기 → 쫓아 점프 → 공중 1~3타
  eunwoo_air: {
    q: Q, p1: 3120, p2: 3180, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], ...Array.from({ length: 10 }, () => tap('KeyJ', 3)).flat(), [[], 50]],
  },
  // 띄우기 → 쫓아 점프 → 내려찍기 (와이어로 끌어내림)
  eunwoo_slam: {
    q: Q, p1: 3120, p2: 3180, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], [['ArrowDown', 'KeyJ'], 1], [[], 70]],
  },
  // 쓸기 → 물러났다 대시 공격
  eunwoo_low: {
    q: Q, p1: 3120, p2: 3185, settle: 30,
    steps: [[[], 6], [['ArrowDown', 'KeyJ'], 1], [[], 100], [['ArrowLeft'], 24], [[], 6], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 50]],
  },
  // 등장: 흰 나비 떼가 모였다가 흩어지면 은우가 서 있다 (경기 시작부터)
  eunwoo_intro: { q: 'scene=fight&p2=idle&p1char=eunwoo&p2char=raiden', stopAt: 1, settle: 0, steps: [[[], 90]] },
  // 스킬 2 아직 여기 있어: 흰 나비가 몸 둘레를 돌고 금빛 반짝임 (회복), 가슴에 백합 낙인, HUD에 낙인·나비 시간
  eunwoo_skill2: {
    q: Q, p1: 3120, p2: 3230, settle: 20, prep: 's.fighters[0].meter = 100; s.fighters[0].hp = 600;',
    steps: [[[], 6], [['KeyI'], 1], [[], 40], [['ArrowRight'], 24], [[], 40]],
  },
  // 백합 낙인 방어막: 낙인이 있는 은우(2P)를 라이덴(1P)이 치면 연분홍 막이 한 번 막고 깨진다 (그다음 타는 맞는다)
  eunwoo_shield: {
    q: 'scene=fight&p2=idle&p1char=raiden&p2char=eunwoo', p1: 3120, p2: 3175, settle: 20,
    prep: 's.fighters[1].ext[0] = 1;',
    steps: [[[], 10], ...tap('KeyJ', 3), ...tap('KeyJ', 3), ...tap('KeyJ', 3), [[], 40]],
  },
  // 스킬 1 응답: 앞으로 → 위로 → 앞아래로 세 번 이어 튐 (금색 실)
  eunwoo_skill1: {
    q: Q, p1: 3040, p2: 3260, settle: 20, prep: 's.fighters[0].meter = 100;',
    steps: [[[], 6], [['KeyU'], 1], [[], 9], [['KeyU', 'ArrowUp'], 1], [['ArrowUp'], 8], [['KeyU', 'ArrowRight', 'ArrowDown'], 1], [['ArrowRight', 'ArrowDown'], 8], [[], 60]],
  },
  // 차지 스텔라리스 발도: 공격을 길게 눌러 모았다가 떼면 펼쳐 휘두르고 와이어로 끌어당김 → 점프로 쫓아 공중 1타
  eunwoo_charge: {
    q: Q, p1: 3100, p2: 3180, settle: 30,
    steps: [[[], 6], [['KeyJ'], 70], [[], 16], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 6], ...tap('KeyJ', 3), ...tap('KeyJ', 3), [[], 50]],
  },
  // 필살기 선의: 기력 3칸, 가까이에서 → 연출 (심상세계·어깨에 손·주저앉음·백합) → 회복·둔해짐
  eunwoo_super: {
    q: Q, p1: 3120, p2: 3170, settle: 20, prep: 's.fighters[0].meter = 300; s.fighters[0].hp = 420;',
    steps: [[[], 6], [['KeyO'], 1], [[], 300]],
  },
};
