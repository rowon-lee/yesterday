// oscar 대전 장면 (npm run moveclip -- 장면 이름). 형식은 tools/moveclip.mjs의 SCENES와 같다
// 키: J 공격, K 점프, L 대시, U 스킬 1, I 스킬 2, O 필살기, 화살표 방향. 1P 오스카는 왼쪽(오른쪽을 봄)
const Q = 'scene=fight&p2=idle&p1char=oscar&p2char=raiden';
/** 공격을 n번, 4틱마다 */
const taps = (n, key = 'KeyJ', gap = 3) => Array.from({ length: n }, () => [[[key], 1], [[], gap]]).flat();

export default {
  // 등장: 허공에 은빛 선 → 틈이 열리고 오스카가 걸어 나옴 → 틈이 닫힘 (경기 시작부터)
  oscar_intro: { q: Q, stopAt: 1, settle: 0, steps: [[[], 96]] },
  // 이동: 앞 걷기 → 뒤 걷기 → 점프 → 2단 점프(허공 검영을 밟음) → 공중 대시 → 착지 → 대시(월영)
  oscar_move: {
    q: Q, p1: 3100, p2: 3290, settle: 20,
    steps: [
      [['ArrowRight'], 40], [[], 6], [['ArrowLeft'], 30], [[], 6],
      [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 10],
      [['KeyL', 'ArrowRight'], 1], [[], 40], [['KeyL', 'ArrowRight'], 1], [[], 30],
    ],
  },
  // 벽 기동: 맵 서쪽 끝 벽으로 → 벽 붙기 → 벽 점프
  oscar_wall: {
    q: Q, p1: 440, p2: 700, settle: 20,
    steps: [[['ArrowLeft'], 10], [['KeyK', 'ArrowLeft'], 1], [['ArrowLeft'], 30], [[], 20], [['KeyK'], 1], [[], 50]],
  },
  // 1~4타 연타 (같은 거리에서 시작): 검격이 앞 허공에 생긴다
  oscar_ground: { q: Q, p1: 3150, p2: 3200, settle: 30, steps: [[[], 6], ...taps(14), [[], 50]] },
  oscar_ground_boxes: { q: `${Q}&boxes=1`, p1: 3150, p2: 3200, settle: 30, steps: [[[], 6], ...taps(14), [[], 50]] },
  // 띄우기(↑+공격) → 점프로 쫓아 공중 1·2·3타
  oscar_air: {
    q: Q, p1: 3150, p2: 3195, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], ...taps(9), [[], 50]],
  },
  // 띄우기 → 쫓아 점프 → 내려찍기(↓+공격)
  oscar_slam: {
    q: Q, p1: 3150, p2: 3195, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], [['ArrowDown', 'KeyJ'], 1], [[], 70]],
  },
  // 쓸기(↓+공격) → 물러났다가 대시 공격
  oscar_low: {
    q: Q, p1: 3150, p2: 3200, settle: 30,
    steps: [[[], 6], [['ArrowDown', 'KeyJ'], 1], [[], 100], [['ArrowLeft'], 20], [[], 6], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 50]],
  },
  // 스킬 1 월하참뢰검: 멀리 선 상대 자리에 표식 → 23틱 뒤 그 자리를 곧바로 벤다
  oscar_skill1: { q: Q, p1: 3000, p2: 3190, settle: 20, prep: 's.fighters[0].meter = 100;', steps: [[[], 6], [['KeyU'], 1], [[], 70]] },
  // 스킬 2 월하윤회: 평타 세 번으로 검영을 남기고 → 물러났다가 → 검영(상대에게 가장 가까운 것)으로 순간이동
  oscar_skill2: {
    q: Q, p1: 3150, p2: 3200, settle: 20, prep: 's.fighters[0].meter = 300;',
    steps: [[[], 6], ...taps(3, 'KeyJ', 5), [[], 30], [['ArrowLeft'], 30], [[], 6], [['KeyI'], 1], [[], 40]],
  },
  // 차지 만검지화: 공격을 길게 눌러 3단계까지 (검영 셋이 만개) → 떼면 '탁' 납도하는 순간 한꺼번에 베인다
  oscar_charge: { q: Q, p1: 3150, p2: 3230, settle: 30, steps: [[[], 6], [['KeyJ'], 76], [[], 60]] },
  // 필살기 월령수류: 평타로 검영 셋을 남긴 뒤 → 발동 (컷인) → 핏빛 달 → 백색 → 납도
  oscar_super: {
    q: Q, p1: 3150, p2: 3230, settle: 20, prep: 's.fighters[0].meter = 300;',
    steps: [[[], 6], ...taps(3, 'KeyJ', 5), [[], 20], [['KeyO'], 1], [[], 250]],
  },
};
