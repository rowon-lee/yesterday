// oscar 대전 장면 (npm run moveclip -- 장면 이름). 형식은 tools/moveclip.mjs의 SCENES와 같다
// 키: J 공격, K 점프, L 대시, U 스킬 1, I 스킬 2, O 필살기, 화살표 방향. 1P 오스카는 왼쪽(오른쪽을 봄)
// 오스카 등장이 112틱이라 첫 라운드 시작 연출이 끝난 뒤(130틱)부터 자리를 놓는다 (S)
const Q = 'scene=fight&p2=idle&p1char=oscar&p2char=raiden';
const S = 130;
/** 공격을 n번, 4틱마다 */
const taps = (n, key = 'KeyJ', gap = 3) => Array.from({ length: n }, () => [[[key], 1], [[], gap]]).flat();

export default {
  // 일러스트 디자인 확인 (2026-11-02): 1P·2P 모두 oscar (2P 색 묶음), 가만히 선 채 → 앞으로 걷기 → 뒤로 걷기
  oscar_design: {
    q: 'scene=fight&p2=idle&p1char=oscar&p2char=oscar', p1: 3080, p2: 3200, settle: 40, stopAt: S,
    steps: [[[], 50], [['ArrowRight'], 30], [['ArrowLeft'], 30], [[], 20]],
  },
  // 등장 (13-6): 허공에 세로 선 → 틈이 열림 → 칼을 뽑아 든 채 세 걸음 → 틈이 닫힘 → 납도 '탁' (경기 시작부터)
  oscar_intro: { q: Q, stopAt: 1, settle: 0, steps: [[[], 124]] },
  // 이동: 앞 걷기 → 뒤 걷기 → 점프 → 2단 점프(허공 검영을 밟음) → 공중 대시 → 착지 → 대시(월영)
  oscar_move: {
    q: Q, p1: 3100, p2: 3290, settle: 20, stopAt: S,
    steps: [
      [['ArrowRight'], 40], [[], 6], [['ArrowLeft'], 30], [[], 6],
      [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 10],
      [['KeyL', 'ArrowRight'], 1], [[], 40], [['KeyL', 'ArrowRight'], 1], [[], 30],
    ],
  },
  // 벽 기동: 맵 서쪽 끝 벽으로 → 벽 붙기 → 벽 점프
  oscar_wall: {
    q: Q, p1: 440, p2: 700, settle: 20, stopAt: S,
    steps: [[['ArrowLeft'], 10], [['KeyK', 'ArrowLeft'], 1], [['ArrowLeft'], 30], [[], 20], [['KeyK'], 1], [[], 50]],
  },
  // 1~4타 연타 (같은 거리에서 시작, 13-2): 1타 비스듬히 64 → 2타 반대 각도 72 (X자) → 3타 가로 두 줄 80 → 4타 납도 '탁'에 세 줄 96
  oscar_ground: { q: Q, p1: 3150, p2: 3200, settle: 30, stopAt: S, steps: [[[], 6], ...taps(14), [[], 50]] },
  oscar_ground_boxes: { q: `${Q}&boxes=1`, p1: 3150, p2: 3200, settle: 30, stopAt: S, steps: [[[], 6], ...taps(14), [[], 50]] },
  // 띄우기(↑+공격, 세로 선 88) → 점프로 쫓아 공중 1·2·3타 (선 1·1·2줄, 3타 X자)
  oscar_air: {
    q: Q, p1: 3150, p2: 3195, settle: 30, stopAt: S,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], ...taps(9), [[], 50]],
  },
  // 띄우기 → 쫓아 점프 → 내려찍기(↓+공격): 위에서 아래로 세로 선, 바닥까지 갈라짐
  oscar_slam: {
    q: Q, p1: 3150, p2: 3195, settle: 30, stopAt: S,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], [['ArrowDown', 'KeyJ'], 1], [[], 70]],
  },
  // 쓸기(↓+공격, 바닥에 붙은 가로 선 96) → 물러났다가 대시 공격
  oscar_low: {
    q: Q, p1: 3150, p2: 3200, settle: 30, stopAt: S,
    steps: [[[], 6], [['ArrowDown', 'KeyJ'], 1], [[], 100], [['ArrowLeft'], 20], [[], 6], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 50]],
  },
  // 스킬 1 월하참뢰검 (13-3): 멀리 선 상대 자리에 앞으로 그어질 선이 점선으로 (진공 일렁임, 빗방울이 빨려 듦) → 18틱 실선 → 늦게 맞음 → 진공 터짐
  oscar_skill1: { q: Q, p1: 3000, p2: 3190, settle: 20, stopAt: S, prep: 's.fighters[0].meter = 100;', steps: [[[], 6], [['KeyU'], 1], [[], 50]] },
  // 스킬 2 월하윤회궤 (13-4): 평타 세 번으로 검영을 남기고 → 물러났다가 → 고른 검영이 맥동 → 앞 허공의 세로 틈으로 들어가 검영 자리 틈에서 나옴
  oscar_skill2: {
    q: Q, p1: 3150, p2: 3200, settle: 20, stopAt: S, prep: 's.fighters[0].meter = 150;',
    steps: [[[], 6], ...taps(3, 'KeyJ', 5), [[], 30], [['ArrowLeft'], 30], [[], 6], [['KeyI'], 1], [[], 34]],
  },
  // 차지 만검지화 (13-5): 공격을 길게 눌러 3단계까지 (앞 48·80·112px에 검영 꽃 셋) → 떼면 꽃들이 한꺼번에 선 다발로 펼쳐진다
  oscar_charge: { q: Q, p1: 3150, p2: 3230, settle: 30, stopAt: S, steps: [[[], 6], [['KeyJ'], 76], [[], 50]] },
  // 필살기 월령수류 (13-7): 평타로 검영 셋을 남긴 뒤 → 발동 (컷인) → 전개·검영·정적·백색·어긋남·납도 → 달빛이 걷힘
  oscar_super: {
    q: Q, p1: 3150, p2: 3230, settle: 20, stopAt: S, prep: 's.fighters[0].meter = 300;',
    steps: [[[], 6], ...taps(3, 'KeyJ', 5), [[], 20], [['KeyO'], 1], [[], 400]],
  },
  // 같은 경기 두 번째 월령수류: 짧은 판 (전개·검영 40틱)
  oscar_super_short: {
    q: Q, p1: 3150, p2: 3230, settle: 20, stopAt: S, prep: 's.fighters[0].meter = 300; s.fighters[0].cines = 1;',
    steps: [[[], 6], ...taps(3, 'KeyJ', 5), [[], 20], [['KeyO'], 1], [[], 330]],
  },
};
