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
    // 체력은 낮은 편 (껍데기 300이 먼저 받는다: sim/chars/edward.ts). 느린 대신 한 방이 크다 (피드백 12-1 뒤 밸런스: 체력 820 → 900, 껍데기 300 → 400, 평타 피해 약 1.7배)
    hp: 900,
    // 걷기 (2026-11-02 피드백 12-4): 보폭 24px, 한 바퀴(두 걸음 48px) 약 70틱 → 0.7px/틱. 뒤 걷기는 보폭 16px로 천천히 (0.5px/틱).
    // 걸은 거리로 그림 프레임을 넘긴다 (한 바퀴 거리 = runCycle): 발이 미끄러지지 않는다
    runForward: 0.7,
    runBack: 0.5,
    runCycle: E_WALK_F,
    runBackCycle: E_WALK_B,
    // 점프 (피드백 12-4): 무릎을 깊이 굽히는 준비 8틱, 낮게 뜬다 (약 63px, 2단 점프 약 45px), 무겁게 떨어진다
    jumpSquat: 8,
    jumpVy: 7.6,
    jumpVx: 3.0,
    doubleJumpVy: 6.4,
    chaseJumpVy: 11.2,
    chaseJumpVx: 2.0,
    gravity: 0.46,
    maxFall: 10.5,
    airAccel: 0.12,
    airMaxVx: 3.0,
    // 대시 (피드백 12-4): 세 걸음 쿵쿵쿵 돌진 (2~20틱째 2.2px/틱 = 약 40px), 걸음마다 물 튐·작은 흔들림 (렌더)
    dashTicks: 24,
    dashMoveFrom: 2,
    dashMoveTo: 20,
    dashSpeed: 2.2,
    airDashTicks: 12,
    airDashMoveTo: 7,
    airDashSpeed: 7.0,
    // 착지할 때마다 두 발로 쿵 (무릎을 크게 굽힌다, 6틱)
    landTicks: 6,
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
    // ---- 평타 (2026-11-02 피드백 12-1 '느리고 크게'): 한 동작이 라이덴의 약 1.9배, 히트스톱 9~12틱, 맞힐 때마다 바닥이 반응한다 (렌더) ----
    // 넉백은 맞은 쪽이 미끄러지는 거리 (경직 동안 틱마다 13/16로 줄어드는 속도의 합, sim에서 재면 push × 약 4.2) → 1·2타 12px (push 2.85)
    // 1타 가로 휘두르기: 어깨에서 내려 몸 앞 반원(지름 72px)을 가로지른다. 판정은 6~7프레임 해머 머리 (43,-55 → 50,-36)
    atk1: {
      motion: 'edward/chop', active: [5, 6], limb: undefined, boxOnly: true, damage: 78, guardDamage: 22, hitstun: 26, blockstun: 24, hitstop: 9, push: 2.85,
      advance: [0, 0, -1, -1, 4, 4, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 26, y: -64, w: 34, h: 38, shape: 'fall' },
    },
    // 2타 되돌려 휘두르기: 반 걸음(12px) 내딛으며 반대 방향으로 낮게 (반원 지름 72px). 해머 머리 (42,-11 → 52,-25)
    atk2: {
      motion: 'edward/swing', active: [5, 6], limb: undefined, boxOnly: true, damage: 84, guardDamage: 24, hitstun: 27, blockstun: 24, hitstop: 9, push: 2.85,
      advance: [0, 0, 0, 0, 6, 4, 2, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 28, y: -36, w: 32, h: 34, shape: 'arc' },
    },
    // 3타 머리 위로 돌려 내려찍기: 위 → 아래 원호, 끝에서 바닥 균열 40px. 넉백은 작게 (5px), 세게 맞아 무릎이 꺾인다 (경직 24 이상)
    atk3: {
      motion: 'edward/rise', active: [5, 6], limb: undefined, boxOnly: true, damage: 98, guardDamage: 28, hitstun: 30, blockstun: 26, hitstop: 11, push: 1.0,
      advance: [0, 0, -1, -1, 4, 4, 3, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 30, y: -72, w: 32, h: 46, shape: 'fall' },
    },
    // 4타 한 바퀴 풀스윙: 몸을 한 바퀴 돌려 가로 원호(지름 110px)로 쳐 멀리 날린다 (벽 쪽으로 날림, 주변 작은 물건 파괴, 화면 흔들림)
    atk4: {
      motion: 'edward/smash', active: [5, 6], limb: undefined, boxOnly: true, damage: 133, guardDamage: 40, hitstun: 30, blockstun: 28, hitstop: 12, push: 4.6,
      heavy: true, launch: { vx: 8.4, vy: -5.6 }, wall: true,
      advance: [0, 0, -2, -2, 6, 6, 4, 2, 0, 0, 0, 0, 0, 0],
      box: { x: 20, y: -40, w: 42, h: 34, shape: 'arc' },
    },
    // 띄우기 퍼 올리기: 웅크려 바닥을 긁고 해머를 수직으로 퍼 올리며 솟구친다 (해머 머리가 발 앞 아래 → 머리 위)
    launcher: {
      motion: 'edward/scoop', active: [4, 5], limb: undefined, boxOnly: true, damage: 84, guardDamage: 18, hitstun: 32, blockstun: 15, hitstop: 10, push: 1.5,
      launch: { vx: 0.6, vy: -11.6 }, jumpCancel: true,
      advance: [0, -1, -1, 8, 8, 3, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 12, y: -88, w: 36, h: 80, shape: 'rise' },
    },
    // 쓸기 바닥 쓸기: 엎드리듯 낮게 해머 머리로 발목 높이를 가로지른다 (넘어뜨림)
    sweep: {
      motion: 'edward/sweep', active: [4, 5], limb: undefined, boxOnly: true, damage: 84, guardDamage: 17, hitstun: 22, blockstun: 15, hitstop: 10, push: 2.0,
      knockdown: true,
      advance: [0, -1, -1, 8, 8, 3, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 10, y: -20, w: 50, h: 20, shape: 'ground' },
    },
    // 대시 공격 돌진 휘두르기: 세 걸음 돌진하던 힘을 실어 해머가 등 뒤에서 몸 아래를 지나 크게 가로지른다 (몸 이동 44px)
    dashAttack: {
      motion: 'edward/rush', active: [5, 6], limb: undefined, boxOnly: true, damage: 98, guardDamage: 20, hitstun: 28, blockstun: 12, hitstop: 11, push: 2.8,
      step: undefined,
      advance: [6, 8, 6, 4, 6, 6, 4, 2, 0, 0, 0, 0, 0],
      box: { x: 14, y: -42, w: 46, h: 32, shape: 'arc' },
    },
    // 공중 평타: 해머 무게에 몸이 끌려 돈다 (원호 지름 64px). 감는 동안은 공중에 버틴다 (sim/chars/edward.ts), 맞히면 함께 떠오른다
    // 공중 1타 내려치기
    air1: {
      motion: 'edward/air_chop', active: [5, 6], limb: undefined, boxOnly: true, damage: 64, guardDamage: 12, hitstun: 30, hitstop: 9,
      launch: { vx: 1.0, vy: -5.4 }, airFollow: 0.4,
      advance: [0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 24, y: -68, w: 30, h: 44, shape: 'fall' },
    },
    // 공중 2타 퍼 올리기
    air2: {
      motion: 'edward/air_swing', active: [5, 6], limb: undefined, boxOnly: true, damage: 70, guardDamage: 13, hitstun: 30, hitstop: 9,
      launch: { vx: 1.0, vy: -6.0 }, airFollow: 0.4,
      advance: [0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 22, y: -48, w: 30, h: 48, shape: 'rise' },
    },
    // 공중 3타 내려쳐 떨어뜨리기: 머리 위로 크게 돌려 아래로 내려쳐 상대를 바닥에 내리꽂는다 (튀고 다운)
    air3: {
      motion: 'edward/air_spin', active: [5, 6], limb: undefined, boxOnly: true, damage: 88, guardDamage: 16, hitstun: 30, hitstop: 11, spike: true, airFollow: undefined,
      launch: undefined,
      advance: [0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 26, y: -54, w: 30, h: 50, shape: 'fall' },
    },
    // 내려찍기: 머리 위로 들고 공중에 멈췄다가 수직으로 떨어진다 (떨어지는 몸에 닿으면 내리꽂음). 착지 지점에서 반원 충격파 (반지름 48px:
    // sim/chars/edward.ts가 착지한 틱에 판정), 바닥 패임·먼지·화면 흔들림
    slam: {
      motion: 'edward/air_slam', active: [4, 5], limb: undefined, boxOnly: true, damage: 105, guardDamage: 22, hitstun: 30, hitstop: 12, heavy: true,
      advance: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      box: { x: -8, y: -40, w: 44, h: 46, shape: 'fall' },
    },
    // 스킬 1 재현:나: 해머를 바닥에 세우고 푸른 장막을 두른다 (판정 없음). 기력 1칸 + 껍데기 70 → 다음 평타 한 번 피해 ×1.7, 막혀도 방어가 깨진다
    skill1: {
      motion: 'edward/reenact', active: [], limb: undefined, damage: 0, guardDamage: 0, hitstun: 0, blockstun: 0, hitstop: 0, push: 0,
      launch: undefined, step: undefined, heavy: false, meterCost: 1, alsoAir: false,
    },
    // 스킬 2 불완전한 염동력 (2026-11-02 피드백 12-3): 뒷손을 뻗어 앞쪽 멀리(16~176px)까지 푸른 장막으로 움켜쥔다 (10~14틱 판정).
    // 앞+스킬 2 끌어당김: 14~34틱 상대 발이 5px 뜬 채 에드워드 앞 32px까지 끌려와 떨어진다. 뒤(방향 없이도)+스킬 2 밀어냄(alt 그림): 장막 벽에 붙은 채
    // 80px 밀려나 장막이 터진다 (뒤에 건물 정면이 있으면 벽꽝). 막혀도 끌려오고 밀려난다 (sim/chars/edward.ts). 방어 막힘 중에도 쓸 수 있다.
    // 근처 물건을 으스러뜨려 상대에게 날린다 (물건 하나에 +35)
    skill2: {
      motion: 'edward/telekinesis', alt: 'edward/tk_push', active: [3, 4], limb: undefined, boxOnly: true, damage: 42, guardDamage: 22, hitstun: 32, blockstun: 18,
      hitstop: 10, push: 0, launch: undefined, wall: false, heavy: true, meterCost: 1, fromGuard: true,
      box: { x: 16, y: -70, w: 160, h: 70, shape: 'line' },
    },
    // 차지 워 해머 올려치기 (2026-11-02 피드백 12-2): 평타에서 이어 해머를 몸 뒤 바닥에 끌어 놓고 모았다가(되풀이), 떼면 아래 → 앞 → 위로 큰 반원.
    // 해머 판정은 10~11프레임 몸 앞, 떼고 6~20틱에는 앞쪽 바닥이 차례로 솟구친다 (단계별 64·80·96px = 판정, sim/chars/edward.ts). 맞으면 높이 뜬다
    charge: {
      motion: 'edward/charge', active: [9, 10], limb: undefined, boxOnly: true, damage: 56, guardDamage: 30, hitstun: 34, blockstun: 12, hitstop: 12,
      push: 2.0, heavy: true, step: undefined, advance: [1, 1, 0, -1, 0, 0, 0, 0, 2, 3, 2, 0, 0, 0],
      box: { x: 8, y: -52, w: 50, h: 52, shape: 'rise' },
      charge: {
        windup: 4, loopTo: 7, from: 8, auto: 50,
        levels: [
          { at: 0, damage: 77, guardDamage: 30, launch: { vx: 1.0, vy: -12.2 }, jumpCancel: true },
          { at: 24, damage: 98, guardDamage: 50, launch: { vx: 1.2, vy: -13.0 }, jumpCancel: true },
          { at: 48, damage: 126, guardDamage: 110, launch: { vx: 1.4, vy: -13.8 }, jumpCancel: true },
        ],
      },
    },
    // 필살기 껍데기 뒤집어쓰기: 잡기 (사거리가 아주 짧다: 3~5프레임에 10px 내디디며 몸 앞 8~36px, 처음 자리에서 46px까지).
    // 막을 수 없다 (sim/chars/edward.ts). 맞으면 연출 세 장면 → 끝에 큰 피해 + 상대가 앞으로 무너진다, 에드워드 껍데기 +200. 빗나가면 40틱 굳음
    super: {
      motion: 'edward/super', active: [5, 6], limb: undefined, boxOnly: true, damage: 210, guardDamage: 0, hitstun: 40, blockstun: 0, hitstop: 12, push: 0,
      step: undefined, advance: [0, 0, 0, 3, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0], launch: { vx: 1.2, vy: -2.4 }, wall: false, cutin: { id: 'THE SHELL', name: '껍데기 뒤집어쓰기', band: ['crimsonDeep', 'crimsonDark', 'crimsonLight'], ink: ['white', 'crimsonDeep'], accent: { motif: 'veil', color: 'veilDark', light: 'veilLight' } },
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
      damage: 52, guardDamage: 20, hitstop: 11, heavy: true,
      dive: { from: 2, to: 8, vx: 5.0, vy: 4.4 }, rebound: { vx: 1.4, vy: -4.2 }, landLag: 16,
    },
  },
};
