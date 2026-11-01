import { O_STEP_B, O_STEP_F } from '../poses/oscar/move';
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
  // 평타는 모두 boxOnly: 판정은 앞 허공에 생겨난 검격 자리 = 궤적 상자 (발밑 기준, 오른쪽 보는 기준 px).
  // 노화로 한 대 피해는 낮고(기본 스틱맨의 85~90%: 자동 대전으로 맞춤, 처음 70%에서 올림), 예비 동작이 거의 없어 빠르다 (1~3타 발동 4틱).
  // 리치(몸 중심 → 판정 끝)는 지침서 4장 기준보다 길다: 캐릭터 기획서의 '사거리 김 (검영)'.
  // 검격은 몸 앞 10px 안팎부터 먼 끝까지 그어진다 (붙어 오는 상대도 벤다. 자동 대전에서 바짝 붙은 상대를 못 베어 고침)
  // CPU가 스킬을 쓰는 거리: 월하참뢰검은 떨어진 상대 자리를 바로 벤다(300px까지), 월하윤회(검영으로 순간이동)는 아무 데서나
  cpu: { skill1: [70, 290], skill2: [0, 400] },
  moves: {
    // 1타 날밑 밀기: 가슴 높이 가로 검격. 몸 이동 7px, 리치 58px
    atk1: {
      motion: 'oscar/atk1', active: [3, 4], boxOnly: true, damage: 38, push: 2.4,
      advance: [0, 1, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 12, y: -42, w: 58, h: 14, shape: 'line' },
    },
    // 2타 반 발 뽑기: 아래에서 위로 비스듬히. 몸 이동 9px, 리치 62px
    atk2: {
      motion: 'oscar/atk2', active: [3, 4], boxOnly: true, damage: 43, push: 2.6, step: undefined,
      advance: [0, 1, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 12, y: -54, w: 62, h: 34, shape: 'rise' },
    },
    // 3타 낮춰 뽑기: X자. 몸 이동 10px, 리치 62px
    atk3: {
      motion: 'oscar/atk3', active: [3, 4], boxOnly: true, damage: 52, push: 2.8, step: undefined,
      advance: [0, 1, 4, 3, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 10, y: -52, w: 64, h: 38, shape: 'arc' },
    },
    // 4타 지나치며 납도: 크게 파고들어(14px) 뽑았다가 '탁' 납도하는 순간 세 줄. 벽 쪽으로 날림 (기본 4타 날리기 그대로)
    atk4: {
      motion: 'oscar/atk4', active: [7, 8], boxOnly: true, damage: 76, step: undefined,
      advance: [0, 0, 9, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 8, y: -48, w: 92, h: 26, shape: 'line' },
    },
    // 띄우기 치켜 뽑기: 땅에서 하늘로 곧은 검격 (높이 86px). 몸 이동 7px
    launcher: {
      motion: 'oscar/launcher', active: [3, 4], boxOnly: true, damage: 56, step: undefined,
      advance: [0, 1, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 10, y: -90, w: 38, h: 86, shape: 'rise' },
    },
    // 쓸기 웅크려 뽑기: 바닥을 가로로 낮게 (다운). 몸 이동 12px
    sweep: {
      motion: 'oscar/sweep', active: [3, 4], boxOnly: true, damage: 56, step: undefined,
      advance: [0, 2, 6, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 10, y: -16, w: 60, h: 16, shape: 'ground' },
    },
    // 대시 공격 월영 베기: 미끄러지며(50px) 그대로 뽑는다. 대시의 속도는 이어받지 않고 몸 이동값으로만 간다
    dashAttack: {
      motion: 'oscar/dash_attack', active: [3, 4], boxOnly: true, damage: 60, step: undefined,
      advance: [12, 14, 12, 6, 3, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 4, y: -46, w: 58, h: 28, shape: 'tail' },
    },
    // 공중 1·2·3타: 다리를 접은 채 뽑는다. 3타는 사방으로 네 줄 (기본 공중 3타 날리기 그대로)
    air1: {
      motion: 'oscar/air1', active: [3, 4], boxOnly: true, damage: 33,
      advance: [0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 8, y: -42, w: 44, h: 32, shape: 'fall' },
    },
    air2: {
      motion: 'oscar/air2', active: [3, 4], boxOnly: true, damage: 38,
      advance: [0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 10, y: -40, w: 46, h: 24, shape: 'line' },
    },
    air3: {
      motion: 'oscar/air3', active: [3, 4], boxOnly: true, damage: 52,
      advance: [0, 1, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 2, y: -58, w: 54, h: 56, shape: 'circle' },
    },
    // 내려찍기: 발밑 아래로 곧은 검격 (맞으면 바닥으로 내리꽂힘)
    slam: {
      motion: 'oscar/slam', active: [3, 4, 5], boxOnly: true, damage: 67,
      advance: [0, 0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: -6, y: -12, w: 38, h: 42, shape: 'fall' },
    },
    // 벽 박차기 공격: 벽을 밀고 아래 대각선으로 날며 칼을 살짝 뽑아 앞 아래 허공에 검격 (판정 = 검격 자리)
    wallKick: {
      motion: 'oscar/wall_kick', boxOnly: true, damage: 56,
      box: { x: 6, y: -34, w: 38, h: 32, shape: 'fall' },
    },
    // ---- 기술 4개 (기력: 스킬 1·2는 1칸, 필살기 3칸, 차지는 없음). 판정·이동은 sim/chars/oscar.ts가 정한다 ----
    // 스킬 1 월하참뢰검: 쓰는 순간 상대 자리(최대 300px)에 표식이 뜨고, 23틱 뒤(8번째 프레임) 그 자리를 곧바로 벤다 (피할 틈).
    // 자기 몸 판정은 없다 (0 크기 상자). 맞으면 위로 띄운다. 공중에서도 쓴다
    skill1: {
      motion: 'oscar/skill1', active: [7], boxOnly: true, box: { x: 0, y: 0, w: 0, h: 0, shape: 'line' }, step: undefined,
      damage: 85, guardDamage: 25, hitstun: 28, hitstop: 10, push: 2.0, launch: { vx: 3.0, vy: -7.0 },
    },
    // 스킬 2 월하윤회: 검영 하나(상대에게 가장 가까운 것)로 잔상을 남기며 순간이동 (그 검영은 사라진다).
    // 높이 뜬 검영(50px 넘게)이면 그 위에 서서 한 번 더 뛴다 (2단 점프가 다시 생긴다). 검영이 없으면 뒤로 64px 그림자 걸음.
    // 판정 없음 (0 크기 상자). 방어 중에도, 공중에서도 쓴다
    skill2: {
      motion: 'oscar/skill2', active: [4], boxOnly: true, box: { x: 0, y: 0, w: 0, h: 0, shape: 'line' },
      damage: 0, launch: undefined, wall: false, heavy: false, alsoAir: true,
    },
    // 차지 만검지화: 모으는 동안 앞 허공에 검영이 단계마다 하나씩 만개(최대 3)하고, 떼면 '탁' 납도하는 순간 한꺼번에 베인다.
    // 판정은 만개한 자리들 (sim/chars/oscar.ts CHARGE_BLOOMS), 벤 자리는 고유 특성의 검영으로 남는다.
    // 1·2단계는 띄워 점프로 쫓고, 3단계는 벽 쪽으로 날린다
    charge: {
      motion: 'oscar/charge', active: [10, 11], boxOnly: true, box: { x: 0, y: 0, w: 0, h: 0, shape: 'line' }, step: undefined,
      damage: 60, guardDamage: 24, heavy: true,
      charge: {
        windup: 4, loopTo: 7, from: 8, auto: 50,
        levels: [
          { at: 0, damage: 60, guardDamage: 24, launch: { vx: 1.0, vy: -10.5 }, jumpCancel: true },
          { at: 24, damage: 85, guardDamage: 40, launch: { vx: 1.6, vy: -11.2 }, jumpCancel: true },
          { at: 48, damage: 115, guardDamage: 70, launch: { vx: 7.5, vy: -5.5 }, wall: true },
        ],
      },
    },
    // 필살기 월령수류: 칼을 살짝 뽑는 순간 앞쪽 먼 곳까지(136px) 판정. 맞으면 연출 세 장면
    // (핏빛 달·물결 → 화면 백색과 무수한 검격, 상대를 지나쳐 등 뒤에 섬 → 색이 돌아오면 상대와 뒤 배경이 베여 있고 조용히 납도).
    // 피해 220 + 남은 검영 하나에 24 (연출 끝에 검영은 모두 쓴다). 빗나가면 40틱 굳음
    super: {
      motion: 'oscar/super', active: [5, 6, 7], boxOnly: true, box: { x: 6, y: -70, w: 146, h: 66, shape: 'line' }, step: undefined,
      damage: 220, guardDamage: 50, cutin: 'WOLRYEONG SURYU',
      cinematic: {
        whiff: 40,
        end: { launch: { vx: 1.5, vy: -3.0 } },
        scenes: [
          { a: { motion: 'oscar/super_moon', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'react/oscar_moon', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_white', pos: [[0, 0, 0], [0.1, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_white', pos: [[0, 48, 0], [1, 48, 0]] } },
          { a: { motion: 'oscar/super_sheathe', pos: [[0, 96, 0], [1, 96, 0]] }, d: { motion: 'react/oscar_fall', pos: [[0, 48, 0], [1, 48, 0]] } },
        ],
      },
    },
  },
};
