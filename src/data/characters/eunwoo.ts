import { RIBBON_LINES } from '../moves/lines';
import { E_RUN_BACK_CYCLE, E_RUN_CYCLE } from '../poses/eunwoo/move';
import { BASE_STATS } from './base';
import type { CharacterData } from './types';

/**
 * 백은우 (캐릭터 기획서): 프론티어. 기동·버티기, 체력 낮음, 아주 빠름, 중간 사거리(연검 스텔라리스).
 * 움직임: 빠르고 가벼운 걸음, 매우 유연해 동작이 크고 부드럽다. 대시는 금색 실을 따라 미끄러지듯, 벽 달리기는 가장 가볍고,
 * 착지는 사뿐하다. 가운 자락이 크게 휘날린다.
 */
export const EUNWOO: CharacterData = {
  id: 'eunwoo',
  label: '백은우',
  stats: {
    ...BASE_STATS,
    // 체력 낮음 (기본 1000)
    hp: 950,
    // 아주 빠름: 다리를 번갈아 가볍게 뛴다. 한 걸음 34px (뒤로는 22px), 한 바퀴는 두 걸음 (발이 미끄러지지 않게)
    runForward: 4.8,
    runBack: 3.6,
    runCycle: E_RUN_CYCLE,
    runBackCycle: E_RUN_BACK_CYCLE,
    // 가볍게 높이 뛴다 (약 110px), 2단 점프도 높다. 공중에서 잘 움직인다
    jumpVy: 9.6,
    jumpVx: 3.8,
    doubleJumpVy: 8.4,
    airAccel: 0.2,
    airMaxVx: 3.8,
    // 대시: 금색 실을 따라 오래 미끄러진다 (2~9틱째 11px/틱)
    dashTicks: 12,
    dashMoveFrom: 1,
    dashMoveTo: 9,
    dashSpeed: 11,
    airDashTicks: 12,
    airDashMoveTo: 9,
    airDashSpeed: 9.5,
    // 착지는 사뿐하게 짧다
    landTicks: 3,
    airAttackLandTicks: 4,
    // 벽: 가볍게 붙어 천천히 미끄러지고, 벽 달리기는 가장 빠르고 높다 (160 ÷ 6.4 = 25틱)
    wallSlide: 1.0,
    wallSlideAccel: 0.05,
    wallJumpVx: 4.8,
    wallJumpVy: 9.0,
    wallRunSpeed: 6.4,
    wallRunHeight: 160,
  },
  motions: {
    idle: 'eunwoo/idle',
    run_f: 'eunwoo/walk_f',
    run_b: 'eunwoo/walk_b',
    jump: 'eunwoo/jump',
    jump2: 'eunwoo/jump2',
    fall: 'eunwoo/fall',
    land: 'eunwoo/land',
    dash: 'eunwoo/dash',
    air_dash: 'eunwoo/air_dash',
    guard: 'eunwoo/guard',
    guard_hit: 'eunwoo/guard_hit',
    intro: 'eunwoo/intro',
    win: 'eunwoo/win',
    wall_cling: 'eunwoo/wall_cling',
    wall_jump: 'eunwoo/wall_jump',
    wall_run: 'eunwoo/wall_run',
    wall_tech: 'eunwoo/wall_tech',
  },
  // 기술 (동작연출지침서 4장): advance = 프레임별 몸 이동(px), box = 칼날이 리본처럼 늘어나 닿는 궤적 상자 (발밑 기준, 오른쪽 보는 기준).
  // 판정 = 칼 쥔 팔(팔꿈치→손) + 궤적 상자. 연검이라 칼끝 궤적이 가장 길다 (중간 사거리). 체력이 낮은 대신 빠르고 길게 친다
  // CPU가 스킬을 쓰는 거리: 응답(금색 실 순간이동)은 떨어진 상대에게 파고들 때, 아직 여기 있어(회복)는 떨어져 있을 때
  cpu: { skill1: [70, 230], skill2: [100, 400] },
  moves: {
    // 지상 4연타 (11-2): 판정은 그 프레임 연검 리본 위의 점 8개를 이은 선 (line, tools/ribbon-lines.mjs가 그림에서 뽑아 적는다).
    // 연타로 이어지면 앞 타의 판정 바로 뒤 프레임이 다음 타의 첫 프레임이다 (기본자세로 돌아가지 않는다)
    // 1타 손목 채찍: 가볍게 한 걸음(4px), 칼날이 수평으로 앞으로 뻗고 끝이 꺾인다. 리치 약 60
    atk1: {
      motion: 'eunwoo/flick', active: [4, 5], limb: ['eF', 'hF'], damage: 72, push: 2.6, reach: undefined, step: undefined,
      advance: [0, -1, -1, 2, 2, 0, 0, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/flick'],
    },
    // 2타 반 바퀴 손등 베기: 등을 보이며 돌았다가 낮게 쓸어 칼날이 바닥을 S자로 훑고 되돌아온다. 리치 약 56.
    // 되돌아오는 칼날이 상대를 감아 조금 끌어당긴다 (push 음수): 몸 둘레를 도는 3타 피루엣이 이어서 닿게
    atk2: {
      motion: 'eunwoo/backhand', active: [4, 5], limb: ['eF', 'hF'], damage: 82, push: -1.2, reach: undefined, step: undefined,
      advance: [0, 2, 1, 3, 2, 1, 0, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/backhand'],
    },
    // 3타 피루엣: 발끝으로 한 바퀴 돌며 칼끝이 몸 둘레 반지름 약 40의 원을 그린다 (앞쪽 반원만 판정). 리치 약 44
    atk3: {
      motion: 'eunwoo/spin', active: [4, 5], limb: ['eF', 'hF'], damage: 94, push: 2.0, hitstun: 19, hitstop: 8, reach: undefined, step: undefined,
      advance: [0, 2, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/spin'],
    },
    // 4타 뛰어 내리꽂기: 작게 뛰어 돌며 위에서 아래로 큰 세로 S, 칼끝이 앞 바닥에 꽂힌다 (은빛 섬광·물보라). 리치 약 72
    atk4: {
      motion: 'eunwoo/lash', active: [5, 6], limb: ['eF', 'hF'], damage: 142, push: 4.0, reach: undefined, step: undefined,
      advance: [0, 2, 2, 2, 4, 4, 1, 1, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/lash'],
    },
    // 띄우기 올려 베기: 솟구치며 아래에서 위로 크게 (20px 들어감), 점프로 쫓는다
    launcher: {
      motion: 'eunwoo/rise', active: [4, 5], limb: ['eF', 'hF'], damage: 106, reach: undefined, step: undefined,
      advance: [0, 0, 2, 8, 6, 3, 1, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/rise'],
    },
    // 쓸기 다리 걸기: 다리를 찢어 낮게 엎드리며 칼끝이 바닥을 스친다 (19px 들어감), 다운
    sweep: {
      motion: 'eunwoo/low', active: [4, 5], limb: ['eF', 'hF'], damage: 101, reach: undefined, step: undefined,
      advance: [0, 0, 2, 8, 6, 2, 1, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/low'],
    },
    // 대시 공격 실 타고 찌르기: 금색 실을 따라 52px 미끄러져 들어오며 펜싱처럼 길게 찌른다
    dashAttack: {
      motion: 'eunwoo/thrust', active: [3, 4], limb: ['eF', 'hF'], damage: 112, push: 2.6, reach: undefined, step: undefined,
      advance: [8, 6, 10, 12, 8, 4, 2, 2, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/thrust'],
    },
    // 공중 1타 채찍질: 앞아래로 비스듬히 (6px)
    air1: {
      motion: 'eunwoo/air_flick', active: [3, 4], limb: ['eF', 'hF'], damage: 61, reach: undefined,
      advance: [0, 0, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/air_flick'],
    },
    // 공중 2타 올려 베기: 몸 아래 앞에서 위로 휘감아 올린다 (6px)
    air2: {
      motion: 'eunwoo/air_rise', active: [3, 4], limb: ['eF', 'hF'], damage: 72, reach: undefined,
      advance: [0, 0, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/air_rise'],
    },
    // 공중 3타 회전 베기: 몸을 한 바퀴 돌려 칼끝이 둘레에 원을 그린다 (8px), 비스듬히 날린다.
    // 판정은 몸 둘레 원 상자 그대로 (사용자가 좋아한 공중 콤보의 느낌을 지킨다: 리본 선으로 바꾸면 판정 프레임에 칼날이 몸 뒤에 있다)
    air3: {
      motion: 'eunwoo/air_spin', active: [4, 5], limb: ['eF', 'hF'], damage: 98, reach: undefined,
      advance: [0, 0, 2, 3, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: -20, y: -62, w: 70, h: 70, shape: 'circle' },
    },
    // 내려찍기 와이어 끌어내리기: 뒷손으로 와이어를 앞아래로 던져 감아 채고 끌어당겨 내리꽂는다 (바닥에 튀고 다운)
    slam: {
      motion: 'eunwoo/wire', active: [5, 6, 7], limb: ['eB', 'hB'], damage: 125, reach: undefined,
      advance: [0, 0, 0, 0, 2, 3, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 6, y: -30, w: 52, h: 56, shape: 'fall' },
    },
    // 스킬 1 응답 (기력 1칸): 손가락을 튀겨 금색 실을 따라 순간이동 (sim/chars/eunwoo.ts). 판정 없음, 공중에서도, 이어서 3번까지.
    // 방향을 고르지 않으면 앞의 상대 바로 앞에 내려선다 (콤보를 이어 쫓아간다)
    skill1: {
      motion: 'eunwoo/answer', active: [], limb: undefined, damage: 0, guardDamage: 0, push: 0, launch: undefined, step: undefined,
      heavy: false, alsoAir: true,
    },
    // 스킬 2 아직 여기 있어 (기력 1칸): 흰 나비 — 5초 동안 조금씩 회복·이동 빨라짐, 백합 낙인. 판정 없음, 막는 중에도 쓴다 (버티기)
    skill2: {
      motion: 'eunwoo/still_here', active: [], damage: 0, guardDamage: 0, push: 0, launch: undefined, wall: false, heavy: false, fromGuard: true,
    },
    // 차지 스텔라리스 발도 (기력 없음): 펼쳐 뽑으며 크게 휘두르고(22px 내디딤) 은빛 와이어로 맞은 상대를 앞으로 끌어당긴다
    // (날림 vx가 음수 = 은우 쪽으로). 단계가 오를수록 세고 높이 끌려 오며 점프로 쫓는다. 3단계는 막혀도 방어를 깬다
    charge: {
      motion: 'eunwoo/batto', active: [9, 10], limb: ['eF', 'hF'], damage: 102, guardDamage: 30, push: 2.0, reach: undefined, step: undefined,
      advance: [0, 0, -1, -1, 0, 0, 0, 0, 10, 8, 4, 0, -2, 0],
      box: undefined, line: RIBBON_LINES['eunwoo/batto'],
      launch: { vx: -2.2, vy: -7.5 }, jumpCancel: true,
      charge: {
        windup: 4, loopTo: 7, from: 8, auto: 50,
        levels: [
          { at: 0, damage: 102, guardDamage: 30, launch: { vx: -2.2, vy: -7.5 }, jumpCancel: true },
          { at: 24, damage: 138, guardDamage: 50, launch: { vx: -3.0, vy: -9.5 }, jumpCancel: true },
          { at: 48, damage: 179, guardDamage: 100, launch: { vx: -3.6, vy: -10.5 }, jumpCancel: true },
        ],
      },
    },
    // 필살기 선의 (기력 3칸, 11-5 영역 전개형 약 330틱): 연검을 내리고 뒷손을 펴면 발밑에서 물결이 퍼진다 (판정: 앞 70px 안, 물결).
    // 맞으면 연출 (전개 60 → 세계 40 → 걸어감 70 → 어깨에 손 40 → 주저앉음·백합 50 → 돌아옴 40 = 300틱, 발동 30틱과 합쳐 330틱).
    // 같은 경기 두 번째부터는 짧은 판 (전개 30틱). 끝에 은우는 크게 회복·백합 낙인, 상대는 한동안 둔해진다 (sim/chars/eunwoo.ts)
    super: {
      motion: 'eunwoo/goodwill', active: [8, 9, 10], limb: undefined, damage: 96, guardDamage: 40, push: 1.0, step: undefined,
      // 컷인: 선의(善意), 흰색·금색 띠에 금실 덧무늬 (공용 컷인 render/cutin.ts)
      launch: undefined, wall: false, heavy: false, cutin: { id: 'GOODWILL', name: '선의', hanja: '善意', band: ['gownDark', 'white', 'gold'], ink: ['goldDark', 'white'], accent: { motif: 'thread', color: 'thread', light: 'threadLight' }, freeze: 30 },
      advance: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: -6, y: -56, w: 76, h: 56, shape: 'ground' }, boxOnly: true,
      cinematic: {
        whiff: 40,
        end: { launch: { vx: 0.6, vy: -2.4 } },
        scenes: [
          { a: { motion: 'eunwoo/super_deploy', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_world', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_walk', pos: [[0, 0, 0], [1, 46, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_touch', pos: [[0, 46, 0], [0.3, 50, 0], [1, 50, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_heal', pos: [[0, 50, 0], [1, 50, 0]] }, d: { motion: 'eunwoo/super_kneel', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_release', pos: [[0, 50, 0], [0.5, 38, 0], [1, 38, 0]] }, d: { motion: 'eunwoo/super_rest', pos: [[0, 64, 0], [1, 64, 0]] } },
        ],
        short: [
          { a: { motion: 'eunwoo/super_deploy_s', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_world', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_walk', pos: [[0, 0, 0], [1, 46, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_touch', pos: [[0, 46, 0], [0.3, 50, 0], [1, 50, 0]] }, d: { motion: 'eunwoo/super_daze', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_heal', pos: [[0, 50, 0], [1, 50, 0]] }, d: { motion: 'eunwoo/super_kneel', pos: [[0, 64, 0], [1, 64, 0]] } },
          { a: { motion: 'eunwoo/super_release', pos: [[0, 50, 0], [0.5, 38, 0], [1, 38, 0]] }, d: { motion: 'eunwoo/super_rest', pos: [[0, 64, 0], [1, 64, 0]] } },
        ],
      },
    },
    // 벽 박차기 공격: 벽을 박차고 내리꽂히며 연검을 앞아래로 크게 휘두른다 (기본은 앞발 차기).
    // 판정 = 앞팔(팔꿈치→손) + 칼날이 닿는 궤적 상자 (몸 앞 아래, 칼날이 리본처럼 늘어나는 범위)
    wallKick: {
      motion: 'eunwoo/wall_kick', limb: ['eF', 'hF'],
      box: undefined, line: RIBBON_LINES['eunwoo/wall_kick'],
    },
  },
};
