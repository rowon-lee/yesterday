import { O_STEP_B, O_STEP_F } from '../poses/oscar/move';
import { cutBox } from '../poses/oscar/slashes';
import { BASE_STATS } from './base';
import type { CharacterData } from './types';

/**
 * 오스카 Y. 헨드릭스 — 킬러 웨일 (캐릭터 기획서): 검술 기교, 체력 보통, 속도 보통, 사거리 김(검영).
 * 움직임: 살짝 굽은 채 칼자루에 손을 얹고 천천히 걷는 노인. 대시(월영)는 그림자처럼 순식간에 옮겨 가고,
 * 공중에서는 검영을 밟고 뛴다. 동작은 작고 군더더기가 없다.
 * 평타는 칼을 휘두르지 않는다: 칼자루에 손을 얹거나 살짝 뽑는 짧은 동작에 앞쪽 허공에 은빛 검격이 생긴다.
 * 판정은 생겨난 검격 자리 (boxOnly: 궤적 상자만, 관절 판정 원칙의 예외).
 */
export const OSCAR: CharacterData = {
  id: 'oscar',
  label: '오스카',
  stats: {
    ...BASE_STATS,
    // 걷기: 노인의 걸음. 앞 2.0px/틱 (한 걸음 16px), 뒤 1.7px/틱 (한 걸음 12px). 한 바퀴는 두 걸음
    runForward: 2.0,
    runBack: 1.7,
    runCycle: O_STEP_F * 2,
    runBackCycle: O_STEP_B * 2,
    // 점프는 보통, 2단 점프는 허공의 검영을 밟아 조금 더 높이
    jumpVy: 9.0,
    jumpVx: 3.2,
    doubleJumpVy: 8.0,
    // 대시 (월영): 그림자처럼 순식간에 — 4틱 동안 19px/틱 (76px), 공중 대시는 6틱 동안 11px/틱
    dashTicks: 12,
    dashMoveFrom: 1,
    dashMoveTo: 5,
    dashSpeed: 19,
    airDashTicks: 11,
    airDashMoveTo: 6,
    airDashSpeed: 11,
  },
  motions: {
    idle: 'oscar/idle',
    run_f: 'oscar/walk_f',
    run_b: 'oscar/walk_b',
    jump: 'oscar/jump',
    jump2: 'oscar/jump2',
    fall: 'oscar/fall',
    land: 'oscar/land',
    dash: 'oscar/dash',
    air_dash: 'oscar/air_dash',
    guard: 'oscar/guard',
    guard_hit: 'oscar/guard_hit',
    intro: 'oscar/intro',
    win: 'oscar/win',
    wall_cling: 'oscar/wall_cling',
    wall_jump: 'oscar/wall_jump',
    wall_run: 'oscar/wall_run',
    wall_tech: 'oscar/wall_tech',
  },
  // 기술: 그림과 바꾼 수치만 적는다 (나머지는 기본 스틱맨 기술 그대로).
  // 평타는 베기 선 (캐릭터 기획서 13장 '베기의 문법'): 칼자루에 손을 얹고 칼날이 2~6px 비쳤다 들어가는 순간, 앞 허공에 긴 선이 한 번에 생긴다.
  // 판정은 그 선 (두께 6px의 긴 선, data/poses/oscar/slashes OSCAR_CUTS)을 sim/chars/oscar.ts가 직접 낸다 (selfHit, 관절 판정 예외).
  // 상대는 선보다 3틱 늦게 맞는다 (베인 걸 늦게 안다. 히트스톱은 그 순간). 궤적 상자(box)는 선들을 감싼 상자로 CPU 사거리용.
  // 판정 구간(data/moves/time.ts)은 선이 생기는 틱부터 늦게 맞는 틱 뒤까지 (다음 타는 그 뒤에 이어진다).
  // 노화로 한 대 피해는 낮고 (자동 대전으로 맞춤: 13장에서 늦게 맞는 3틱·느려진 연타를 메우려고 약 10% 올림), 몸 이동은 아주 작다 (2타만 반 걸음 미끄러진다).
  // CPU가 스킬을 쓰는 거리: 월하참뢰검은 떨어진 상대 자리를 바로 벤다(300px까지), 월하윤회궤(검영으로 순간이동)는 아무 데서나,
  // 월령수류는 보이는 화면 전체를 벤다 (230px 안)
  cpu: { skill1: [70, 290], skill2: [0, 400], super: [0, 230] },
  moves: {
    // 1타 칼자루에 손: 상대 쪽으로 내려 긋는 비스듬한 선 한 줄 (64px)
    atk1: {
      motion: 'oscar/atk1', selfHit: true, box: cutBox('atk1'), damage: 55, push: 2.4,
    },
    // 2타 반 걸음 미끄러짐: 반대 각도로 올려 긋는 선 (72px, 1타와 X자)
    atk2: {
      motion: 'oscar/atk2', selfHit: true, box: cutBox('atk2'), damage: 61, push: 2.6,
    },
    // 3타 몸을 살짝 낮춤: 가로 선 두 줄 평행 (80px)
    atk3: {
      motion: 'oscar/atk3', selfHit: true, box: cutBox('atk3'), damage: 74, push: 2.8,
    },
    // 4타 반쯤 뽑았다 납도: '탁' 하는 순간 앞쪽 공간에 선 세 줄이 한꺼번에 (96px), 벽 쪽으로 날림 (기본 4타 날리기 그대로)
    atk4: {
      motion: 'oscar/atk4', selfHit: true, box: cutBox('atk4'), damage: 109,
    },
    // 띄우기 위를 올려봄: 아래에서 위로 세로 선 (88px)
    launcher: {
      motion: 'oscar/launcher', selfHit: true, box: cutBox('launcher'), damage: 81,
    },
    // 쓸기 낮게: 바닥에 붙은 가로 선 (96px, 다운)
    sweep: {
      motion: 'oscar/sweep', selfHit: true, box: cutBox('sweep'), damage: 81,
    },
    // 대시 공격 월영 베기: 미끄러지며(44px) 칼날이 비치는 순간 지나온 길 앞을 길게 (88px)
    dashAttack: {
      motion: 'oscar/dash_attack', selfHit: true, box: cutBox('dashAttack'), damage: 86,
    },
    // 공중 1·2·3타: 공중에서 몸을 비틀며 선 1·1·2줄 (64~80px). 3타는 X자 (기본 공중 3타 날리기 그대로)
    air1: {
      motion: 'oscar/air1', selfHit: true, box: cutBox('air1'), damage: 47,
    },
    air2: {
      motion: 'oscar/air2', selfHit: true, box: cutBox('air2'), damage: 55,
    },
    air3: {
      motion: 'oscar/air3', selfHit: true, box: cutBox('air3'), damage: 74,
    },
    // 내려찍기 내려다봄: 위에서 아래로 세로 선, 바닥까지 갈라진다 (맞으면 바닥으로 내리꽂힘)
    slam: {
      motion: 'oscar/slam', selfHit: true, box: cutBox('slam'), damage: 96,
    },
    // 벽 박차기 공격: 벽을 밀고 아래 대각선으로 날며 칼날이 비치는 순간 앞 아래로 긴 선 (80px)
    wallKick: {
      motion: 'oscar/wall_kick', selfHit: true, box: cutBox('wallKick'), damage: 81,
    },
    // ---- 기술 4개 (기력: 스킬 1·2는 1칸, 필살기 3칸, 차지는 없음). 판정·이동은 sim/chars/oscar.ts가 정한다 ----
    // 스킬 1 월하참뢰검 (13-3): 쓰는 순간 상대 자리(최대 300px)에 표식 (앞으로 그어질 120px 선이 점선으로 미리 보인다),
    // 18틱째 칼날이 비치는 순간 점선이 실선이 되고, 3틱 늦게 맞는다 (그 사이 비켜나면 헛벤다). 맞으면 위로 띄운다. 공중에서도 쓴다
    skill1: {
      motion: 'oscar/skill1', selfHit: true, box: { x: 0, y: 0, w: 0, h: 0, shape: 'line' },
      damage: 120, guardDamage: 25, hitstun: 28, hitstop: 10, push: 2.0, launch: { vx: 3.0, vy: -7.0 },
    },
    // 스킬 2 월하윤회궤 (13-4): 검영 하나(상대에게 가장 가까운 것)를 먼저 고르고, 앞 허공의 세로 틈으로 들어가 그 검영 자리의 틈에서 걸어 나온다
    // (9틱째 옮김, 그 검영은 부서진다). 높이 뜬 검영(50px 넘게)이면 그 위에 서서 한 번 더 뛴다. 검영이 없으면 뒤로 64px 그림자 걸음.
    // 판정 없음. 방어 중에도, 공중에서도 쓴다
    skill2: {
      motion: 'oscar/skill2', selfHit: true, box: { x: 0, y: 0, w: 0, h: 0, shape: 'line' },
      damage: 0, launch: undefined, wall: false, heavy: false, alsoAir: true,
    },
    // 차지 만검지화 (13-5): 모으는 동안 앞 허공 48·80·112px에 검영 꽃(한 점에서 퍼지는 은빛 선 5~6줄)이 단계마다 하나씩 핀다(최대 3).
    // 떼면 칼날이 반쯤 나왔다 닫히고(0~2틱), 꽃들이 한꺼번에 80~120px 선 세 줄씩의 다발로 펼쳐진다. 판정은 그 선들 (셋 다 피우면 앞 약 140px).
    // 꽃 자리는 검영으로 남는다. 1·2단계는 띄워 점프로 쫓고, 3단계는 벽 쪽으로 날린다
    charge: {
      motion: 'oscar/charge', selfHit: true, box: { x: 8, y: -90, w: 162, h: 92, shape: 'line' },
      damage: 86, guardDamage: 24, heavy: true,
      charge: {
        auto: 50,
        levels: [
          { at: 0, damage: 86, guardDamage: 24, launch: { vx: 1.0, vy: -10.5 }, jumpCancel: true },
          { at: 24, damage: 122, guardDamage: 40, launch: { vx: 1.6, vy: -11.2 }, jumpCancel: true },
          { at: 48, damage: 164, guardDamage: 70, launch: { vx: 7.5, vy: -5.5 }, wall: true },
        ],
      },
    },
    // 필살기 월령수류 (13-7, 영역 전개형 약 5.5초): 눈을 감고 칼자루에 손 → 느리게(24틱) 엄지로 날밑을 미는 순간 보이는 화면 전체가 판정
    // (발동자 좌우 240px, 빗나감 없음. 막으면 막히고, 무적이면 빗나간다). 맞으면 연출 여섯 장면 (전개 70 → 검영 40 → 정적 20 → 백색 20 →
    // 어긋남 40 → 납도 30 = 220틱). '탁' 납도하는 순간 연출이 끝나며 피해·파괴가 한 번에 들어가고, 그 뒤 80틱 동안 달빛이 걷히며 밤 도시로 (렌더).
    // 같은 경기 두 번째부터는 전개·검영을 40틱으로 줄인 짧은 판 (150틱). 피해 220 + 남은 검영 하나에 24 (연출 끝에 검영은 모두 쓴다).
    // 연출 동안 카메라는 확대하지 않는다 (보이는 화면 전체가 무대). 빗나가면 40틱 굳음
    super: {
      motion: 'oscar/super', selfHit: true, box: { x: -240, y: -270, w: 480, h: 280, shape: 'line' },
      // 컷인: 월령수류, 짙은 바다색·은빛 띠에 핏빛 달 덧무늬 (사용자 피드백 13-7, 공용 컷인 render/cutin.ts)
      damage: 286, guardDamage: 50, cutin: { id: 'WOLRYEONG SURYU', name: '월령수류', band: ['deepSea', 'deepSeaLight', 'moon'], ink: ['moonLight', 'deepSea'], accent: { motif: 'moon', color: 'bloodMoon', light: 'bloodMoonDark' }, freeze: 30 },
      cinematic: {
        whiff: 40,
        zoom: 1,
        end: { launch: { vx: 0.6, vy: -2.0 } },
        scenes: [
          { a: { motion: 'oscar/super_open', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'react/oscar_open', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_orbit', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'react/oscar_orbit', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_still', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'react/oscar_still', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_white', pos: [[0, 0, 0], [0.15, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_white', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_cut', pos: [[0, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_cut', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_sheathe', pos: [[0, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_fall', pos: [[0, 48, 0], [1, 48, 0]] } },
        ],
        short: [
          { a: { motion: 'oscar/super_open_s', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'react/oscar_open_s', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_still', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'react/oscar_still', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_white', pos: [[0, 0, 0], [0.15, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_white', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_cut', pos: [[0, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_cut', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_sheathe', pos: [[0, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_fall', pos: [[0, 48, 0], [1, 48, 0]] } },
        ],
      },
    },
  },
};
