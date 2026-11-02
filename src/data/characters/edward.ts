import { E_WALK_B, E_WALK_F } from '../poses/edward/move';
import { BASE_STATS } from './base';
import type { CharacterData } from './types';

/**
 * 에드워드 '아서' 와인포드 (캐릭터 기획서): 중량 파워, 체력은 가장 낮지만 껍데기가 피해를 먼저 받는다, 느림, 중간 사거리(워 해머).
 * 움직임: 해머를 어깨에 걸친 채 여유롭게 걷는 가주. 걸음은 느리고 보폭이 크다. 대시는 짧고 묵직한 돌진, 점프는 낮고,
 * 착지할 때마다 바닥이 울린다. 벽은 묵직하게 딛는다.
 */
export const EDWARD: CharacterData = {
  id: 'edward',
  label: '에드워드',
  stats: {
    ...BASE_STATS,
    // 체력은 넷 가운데 가장 낮다 (껍데기 300이 먼저 받는다: sim/chars/edward.ts)
    hp: 820,
    // 걷기: 큰 보폭(한 걸음 24px)으로 느리게. 한 바퀴(두 걸음)를 걷는 동안 그림 한 바퀴
    runForward: 1.7,
    runBack: 1.4,
    runCycle: E_WALK_F,
    runBackCycle: E_WALK_B,
    // 점프: 준비가 길고 낮게 뜬다 (약 72px, 2단 점프 약 50px), 무겁게 떨어진다
    jumpSquat: 3,
    jumpVy: 8.2,
    jumpVx: 3.0,
    doubleJumpVy: 6.8,
    chaseJumpVy: 11.2,
    chaseJumpVx: 2.0,
    gravity: 0.46,
    maxFall: 10.5,
    airAccel: 0.12,
    airMaxVx: 3.0,
    // 대시: 짧고 묵직한 돌진 (2~7틱째 7.5px/틱 = 약 45px), 끝에 쿵 멈추느라 길다
    dashTicks: 16,
    dashMoveFrom: 2,
    dashMoveTo: 8,
    dashSpeed: 7.5,
    airDashTicks: 12,
    airDashMoveTo: 7,
    airDashSpeed: 7.0,
    // 착지할 때마다 쿵 (4틱)
    landTicks: 4,
    airAttackLandTicks: 7,
    // 벽: 무거워 빨리 미끄러지고, 벽 점프는 낮고 짧게, 벽 달리기는 느리게 한 층쯤
    wallSlide: 1.7,
    wallSlideAccel: 0.08,
    wallJumpVx: 4.0,
    wallJumpVy: 8.0,
    wallRunSpeed: 4.4,
    wallRunHeight: 120,
  },
  motions: {
    idle: 'edward/idle',
    run_f: 'edward/walk_f',
    run_b: 'edward/walk_b',
    jump: 'edward/jump',
    jump2: 'edward/jump2',
    fall: 'edward/fall',
    land: 'edward/land',
    dash: 'edward/dash',
    air_dash: 'edward/air_dash',
    guard: 'edward/guard',
    guard_hit: 'edward/guard_hit',
    intro: 'edward/intro',
    win: 'edward/win',
    wall_cling: 'edward/wall_cling',
    wall_jump: 'edward/wall_jump',
    wall_run: 'edward/wall_run',
    wall_tech: 'edward/wall_tech',
  },
  // 기술: 그림과 바꾼 수치만 적는다 (나머지는 기본 스틱맨 기술 그대로). 해머 공격은 모두 판정이 해머 머리를 감싼 궤적 상자뿐이다 (boxOnly:
  // 팔 관절이 아니라 해머 머리가 맞힌다). 상자는 발밑 기준(오른쪽 보는 기준) px, 몸 이동(advance)은 프레임별 px.
  // 느리지만 묵직하다: 발동이 라이덴보다 2~6틱 늦고, 피해·히트스톱·밀어내기가 크다. 작은 물건은 한 방에 부서진다 (sim/chars/edward.ts)
  // CPU가 스킬을 쓰는 거리: 재현:나(다음 평타 강화)는 아무 데서나, 염동력(끌어당김·밀어냄)은 상자 안 (판정 160px)
  cpu: { skill1: [0, 400], skill2: [30, 150] },
  moves: {
    // 1타 어깨 내려찍기: 어깨에서 해머가 머리 위를 넘어와 가슴 높이 앞을 내려친다 (해머 머리 가운데 53,-27 → 53,-22)
    atk1: {
      motion: 'edward/chop', active: [4, 5], limb: undefined, boxOnly: true, damage: 60, guardDamage: 13, hitstun: 20, blockstun: 14, hitstop: 9, push: 2.4,
      advance: [0, -1, -1, 4, 4, 2, 0, 0, 0, 0, 0, 0],
      box: { x: 16, y: -44, w: 46, h: 36, shape: 'fall' },
    },
    // 2타 옆 휘두르기: 해머가 등 뒤에서 아래로 돌아 가슴 높이로 앞을 가로지른다 (해머 머리 56,-33)
    atk2: {
      motion: 'edward/swing', active: [5, 6], limb: undefined, boxOnly: true, damage: 66, guardDamage: 15, hitstun: 21, blockstun: 15, hitstop: 10, push: 2.6,
      advance: [0, -1, -1, 2, 5, 4, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 14, y: -46, w: 50, h: 28, shape: 'arc' },
    },
    // 3타 올려치기: 뒤 아래에서 퍼 올려 해머 머리가 가슴 → 얼굴 높이로 솟는다 (54,-38 → 50,-52)
    atk3: {
      motion: 'edward/rise', active: [4, 5], limb: undefined, boxOnly: true, damage: 78, guardDamage: 18, hitstun: 24, blockstun: 16, hitstop: 11, push: 2.8,
      advance: [0, -1, -1, 5, 5, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 16, y: -62, w: 46, h: 44, shape: 'rise' },
    },
    // 4타 내려찍기: 머리 위에서 발 앞 바닥에 내리꽂는다. 충격파가 앞으로 퍼져 판정이 바닥을 타고 74px까지 (상대가 벽 쪽으로 날아간다)
    atk4: {
      motion: 'edward/smash', active: [6, 7], limb: undefined, boxOnly: true, damage: 118, guardDamage: 28, hitstun: 28, blockstun: 18, hitstop: 13, push: 4.6,
      heavy: true, launch: { vx: 7.6, vy: -4.8 }, wall: true,
      advance: [0, 0, -1, -1, 0, 6, 8, 4, 2, 1, 0, 0, 0, 0],
      box: { x: 14, y: -52, w: 60, h: 52, shape: 'fall' },
    },
    // 띄우기 퍼 올리기: 웅크려 바닥을 긁고 해머를 수직으로 퍼 올리며 솟구친다 (해머 머리가 발 앞 아래 → 머리 위)
    launcher: {
      motion: 'edward/scoop', active: [4, 5, 6], limb: undefined, boxOnly: true, damage: 78, guardDamage: 18, hitstun: 30, blockstun: 15, hitstop: 10, push: 1.5,
      launch: { vx: 0.6, vy: -11.4 }, jumpCancel: true,
      advance: [0, -1, -1, 8, 8, 3, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 14, y: -86, w: 34, h: 78, shape: 'rise' },
    },
    // 쓸기 바닥 쓸기: 엎드리듯 낮게 해머 머리로 발목 높이를 가로지른다 (넘어뜨림)
    sweep: {
      motion: 'edward/sweep', active: [4, 5], limb: undefined, boxOnly: true, damage: 76, guardDamage: 17, hitstun: 20, blockstun: 15, hitstop: 10, push: 2.0,
      knockdown: true,
      advance: [0, -1, -1, 8, 8, 3, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 12, y: -18, w: 48, h: 18, shape: 'ground' },
    },
    // 대시 공격 돌진 휘두르기: 돌진하던 힘을 실어 해머가 크게 가로지른다 (몸 이동 48px)
    dashAttack: {
      motion: 'edward/rush', active: [5, 6], limb: undefined, boxOnly: true, damage: 90, guardDamage: 20, hitstun: 26, blockstun: 12, hitstop: 11, push: 2.8,
      step: undefined,
      advance: [6, 8, 8, 8, 6, 6, 4, 2, 0, 0, 0, 0, 0],
      box: { x: 14, y: -46, w: 52, h: 30, shape: 'arc' },
    },
    // 공중 1타 내려치기
    air1: {
      motion: 'edward/air_chop', active: [4, 5], limb: undefined, boxOnly: true, damage: 50, guardDamage: 11, hitstop: 8,
      advance: [0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 14, y: -34, w: 46, h: 36, shape: 'fall' },
    },
    // 공중 2타 옆 휘두르기
    air2: {
      motion: 'edward/air_swing', active: [4, 5], limb: undefined, boxOnly: true, damage: 58, guardDamage: 12, hitstop: 9,
      advance: [0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 14, y: -58, w: 48, h: 36, shape: 'arc' },
    },
    // 공중 3타 한 바퀴 돌려치기: 해머가 몸 앞을 위에서 아래로 크게 돈다 (원)
    air3: {
      motion: 'edward/air_spin', active: [4, 5, 6], limb: undefined, boxOnly: true, damage: 72, guardDamage: 15, hitstop: 10,
      advance: [0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 18, y: -74, w: 42, h: 76, shape: 'circle' },
    },
    // 내려찍기: 해머를 발 앞 아래로 수직으로 내리꽂는다 (공중에서 맞히면 바닥에 내리꽂혀 튄다)
    slam: {
      motion: 'edward/air_slam', active: [4, 5, 6], limb: undefined, boxOnly: true, damage: 96, guardDamage: 20, hitstop: 12,
      advance: [0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 16, y: -34, w: 32, h: 42, shape: 'fall' },
    },
    // 스킬 1 재현:나: 해머를 바닥에 세우고 푸른 장막을 두른다 (판정 없음). 기력 1칸 + 껍데기 70 → 다음 평타 한 번 피해 ×1.7, 막혀도 방어가 깨진다
    skill1: {
      motion: 'edward/reenact', active: [], limb: undefined, damage: 0, guardDamage: 0, hitstun: 0, blockstun: 0, hitstop: 0, push: 0,
      launch: undefined, step: undefined, heavy: false, meterCost: 1, alsoAir: false,
    },
    // 스킬 2 불완전한 염동력: 뒷손을 뻗어 앞쪽 멀리(16~160px)까지 움켜쥔다. 앞+스킬 2는 끌어당김, 뒤(방향 없이도)+스킬 2는 밀어냄 (sim/chars/edward.ts).
    // 방어 막힘 중에도 쓸 수 있다. 근처 물건을 으스러뜨려 상대에게 날린다 (물건 하나에 +35)
    skill2: {
      motion: 'edward/telekinesis', active: [4, 5, 6], limb: undefined, boxOnly: true, damage: 40, guardDamage: 22, hitstun: 32, blockstun: 18, hitstop: 10, push: 0,
      launch: undefined, wall: false, heavy: true, meterCost: 1, fromGuard: true,
      box: { x: 16, y: -62, w: 144, h: 62, shape: 'line' },
    },
    // 차지 워 해머 내려치기: 해머를 뒤로 끌어 모았다가(되풀이) 머리 위로 넘겨 땅을 내리친다. 해머 머리 판정 + 충격파가 바닥을 타고 앞으로
    // (단계별 70·100·140px, sim/chars/edward.ts). 모든 단계가 띄운다 (점프로 쫓아간다). 3단계는 막혀도 방어를 깬다
    charge: {
      motion: 'edward/charge', active: [10], limb: undefined, boxOnly: true, damage: 80, guardDamage: 30, hitstun: 30, blockstun: 12, hitstop: 13,
      push: 2.0, heavy: true, step: undefined, advance: [0, 0, -1, -1, 0, 0, 0, 0, 2, 4, 4, 2, 0, 0],
      box: { x: 30, y: -40, w: 34, h: 40, shape: 'fall' },
      charge: {
        windup: 4, loopTo: 7, from: 8, auto: 50,
        levels: [
          { at: 0, damage: 80, guardDamage: 30, launch: { vx: 1.2, vy: -10.6 }, jumpCancel: true },
          { at: 24, damage: 105, guardDamage: 50, launch: { vx: 1.6, vy: -11.4 }, jumpCancel: true },
          { at: 48, damage: 135, guardDamage: 110, launch: { vx: 2.2, vy: -12.2 }, jumpCancel: true },
        ],
      },
    },
    // 필살기 껍데기 뒤집어쓰기: 잡기 (사거리가 아주 짧다: 3~5프레임에 10px 내디디며 몸 앞 8~36px, 처음 자리에서 46px까지).
    // 막을 수 없다 (sim/chars/edward.ts). 맞으면 연출 세 장면 → 끝에 큰 피해 + 상대가 앞으로 무너진다, 에드워드 껍데기 +200. 빗나가면 40틱 굳음
    super: {
      motion: 'edward/super', active: [5, 6], limb: undefined, boxOnly: true, damage: 300, guardDamage: 0, hitstun: 40, blockstun: 0, hitstop: 12, push: 0,
      step: undefined, advance: [0, 0, 0, 3, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0], launch: { vx: 1.2, vy: -2.4 }, wall: false, cutin: 'THE SHELL',
      box: { x: 8, y: -56, w: 28, h: 42, shape: 'line' },
      cinematic: {
        whiff: 40,
        end: { launch: { vx: 1.2, vy: -2.4 }, wall: false },
        scenes: [
          {
            a: { motion: 'edward/super_lift', pos: [[0, 0, 0], [0.5, -1, 0], [1, -2, 0]] },
            d: { motion: 'edward/super_lifted', pos: [[0, 20, 0], [0.3, 19, 0], [0.6, 15, -5], [1, 14, -7]] },
          },
          {
            a: { motion: 'edward/super_absorb', pos: [[0, -2, 0], [1, -3, 0]] },
            d: { motion: 'edward/super_drained', pos: [[0, 14, -7], [0.25, 13, -8], [0.5, 14, -7], [0.75, 13, -8], [1, 14, -8]] },
          },
          {
            a: { motion: 'edward/super_release', pos: [[0, -3, 0], [1, -2, 0]] },
            d: { motion: 'edward/super_dropped', pos: [[0, 14, -8], [0.2, 16, 0], [1, 18, 0]] },
          },
        ],
      },
    },
    // 벽 박차기 공격: 벽을 박차고 아래 대각선으로 날아가며 해머를 두 손으로 내리친다. 판정은 해머 머리 앞 상자 (발밑 기준)
    wallKick: {
      motion: 'edward/wall_kick', active: [3, 4, 5, 6, 7, 8], limb: undefined, boxOnly: true,
      box: { x: 10, y: -30, w: 30, h: 34, shape: 'fall' },
      damage: 75, guardDamage: 20, hitstop: 11, heavy: true,
      dive: { from: 2, to: 8, vx: 5.0, vy: 4.4 }, rebound: { vx: 1.4, vy: -4.2 }, landLag: 16,
    },
  },
};
