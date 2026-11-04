import { R_HOP_B, R_HOP_F } from '../poses/raiden/move';
import { BASE_STATS } from './base';
import type { CharacterData } from './types';

/**
 * 라이덴 (캐릭터 기획서): 근접 러시, 속도 빠름, 체력 보통.
 * 움직임: MMA 파이터의 바운스 스텝. 가드를 올린 채 가볍게 뛰며 걷고, 대시는 붉은 잔상을 남기며 낮게 파고든다.
 * 점프는 힘있게 튀어오르고, 벽은 걸어차듯 딛는다.
 * 전용 동작은 하나씩 승인받아 motions에 더한다 (없는 자리는 기본 스틱맨 동작). 능력치는 동작을 만들며 정한다.
 */
export const RAIDEN: CharacterData = {
  id: 'raiden',
  label: '라이덴',
  stats: {
    ...BASE_STATS,
    // 걷기: 기본 스틱맨처럼 뛰지 않고 바운스 스텝으로 걷는다. 한 번 튈 때 앞 42px · 뒤 32px, 한 바퀴는 두 번 튐
    runForward: 3.2,
    runBack: 2.6,
    runCycle: R_HOP_F * 2,
    runBackCycle: R_HOP_B * 2,
  },
  motions: {
    idle: 'raiden/idle',
    run_f: 'raiden/walk_f',
    run_b: 'raiden/walk_b',
    jump: 'raiden/jump',
    jump2: 'raiden/jump2',
    fall: 'raiden/fall',
    land: 'raiden/land',
    dash: 'raiden/dash',
    air_dash: 'raiden/air_dash',
    guard: 'raiden/guard',
    guard_hit: 'raiden/guard_hit',
    intro: 'raiden/intro',
    win: 'raiden/win',
    wall_cling: 'raiden/wall_cling',
    wall_jump: 'raiden/wall_jump',
    wall_run: 'raiden/wall_run',
    wall_tech: 'raiden/wall_tech',
    exhaust: 'raiden/exhaust',
  },
  // 기술: 그림과 바꾼 수치만 적는다 (나머지는 기본 스틱맨 기술 그대로).
  // reach: 번개 사거리 — 치는 팔다리 끝에서 붉은 전격이 이만큼 더 뻗어 그만큼 더 닿는다 (사용자 요청 2026-11-01 '공격 범위를 전반적으로 크게')
  // CPU가 스킬을 쓰는 거리: 잔흔은 떨어진 상대에게 순간이동해 들어가고(최대 150px), 화과산은 붙은 상대를 밀어낸다
  cpu: { skill1: [60, 170], skill2: [0, 56] },
  moves: {
    // 지상 1~4타 (사용자 피드백 2026-11-02): 공격 하나에 방향 하나, 번개는 주먹·발에서 몸 밖으로, 몰아치며(몸 이동) 맞으면 확실히 밀려난다.
    // 몸 이동 10·10·8·28px, 상대 밀림 6·6·10px (밀림 속도 push × 약 4.3 = 경직 동안 밀리는 거리, simtest로 잰다), 4타는 날아감.
    // 히트스톱 4·5·6·10틱. 궤적 상자 = 번개 범위 (렌더 vfx/raiden-strike가 같은 상자를 읽어 그린다)
    // 1타 잽: 앞발 내딛고 앞손. 주먹(5번 프레임 x 33)에서 앞으로 곧은 줄기 40px, 가지 1
    atk1: {
      motion: 'raiden/jab', limb: ['eF', 'hF'], damage: 23, push: 1.8, hitstop: 4, reach: undefined,
      box: { x: 33, y: -40, w: 43, h: 10, shape: 'line' },
    },
    // 2타 크로스: 뒷발 비틀며 뒷손. 주먹(x 34)에서 곧은 줄기 52px, 가지 3
    atk2: {
      motion: 'raiden/cross', limb: ['eB', 'hB'], damage: 26, push: 1.65, hitstop: 5, reach: undefined,
      box: { x: 34, y: -41, w: 54, h: 12, shape: 'line' },
    },
    // 3타 미들킥: 뒷다리 반원. 허리 높이 몸 앞쪽에만 반원 (지름 56px: 가운데 x 21·y −30, 반지름 28 → 아래에서 앞을 돌아 위로)
    atk3: {
      motion: 'raiden/middle_kick', limb: ['kB', 'fB'], damage: 34, push: 2.5, hitstop: 6, reach: undefined,
      box: { x: 21, y: -58, w: 28, h: 56, shape: 'arc' },
    },
    // 4타 슈퍼맨 펀치: 튀어 올라 전신 일직선. 주먹(x 42·y −46)에서 바닥으로 꽂혀 바닥 가까이 앞으로 80px 달리는 줄기, 끝에서 갈래.
    // 맞으면 멀리 날아가 벽꽝
    atk4: {
      motion: 'raiden/superman_punch', limb: ['eB', 'hB'], damage: 45, push: 4.2, hitstop: 10, reach: undefined,
      box: { x: 24, y: -20, w: 98, h: 20, shape: 'ground' },
      launch: { vx: 10, vy: -5 },
    },
    // 띄우기 어퍼컷 (지침서 7장): 몸이 함께 솟구치며 뒷주먹을 머리 위까지. 아래에서 위로 세로 번개
    launcher: {
      motion: 'raiden/uppercut', limb: ['eB', 'hB'], reach: undefined,
      box: { x: 8, y: -98, w: 30, h: 84, shape: 'rise' },
    },
    // 쓸기 다리 걸기 (지침서 7장): 낮게 엎드려 뒷다리로 바닥을 쓸어 넘어뜨린다. 바닥을 쓰는 반원 번개 + 물 튐
    sweep: {
      motion: 'raiden/leg_sweep', limb: ['kB', 'fB'], reach: undefined,
      box: { x: -2, y: -16, w: 60, h: 16, shape: 'ground' },
    },
    // 대시 공격 플라잉 니 (지침서 7장): 달려와 뛰어들며 앞무릎 (엉덩이→무릎). 몸 뒤로 끌리는 번개 꼬리. 54px 들어간다
    dashAttack: {
      motion: 'raiden/flying_knee', limb: ['hip', 'kF'], reach: undefined,
      box: { x: -4, y: -48, w: 48, h: 30, shape: 'tail' },
    },
    // 공중 1타 잽 → 2타 크로스 (지침서 7장 '1~2는 직선'): 앞 아래로 비스듬히 뻗는 직선 번개
    air1: {
      motion: 'raiden/air_jab', limb: ['eF', 'hF'], reach: undefined,
      box: { x: 26, y: -42, w: 40, h: 22, shape: 'line' },
    },
    air2: {
      motion: 'raiden/air_cross', limb: ['eB', 'hB'], reach: undefined,
      box: { x: 26, y: -42, w: 46, h: 22, shape: 'line' },
    },
    // 공중 3타 돌려차기 (지침서 7장 '3은 원'): 뒷다리가 한 바퀴 원을 그리며 휘돌아 찬다. 비스듬히 날린다
    air3: {
      motion: 'raiden/air_roundhouse', limb: ['kB', 'fB'], reach: undefined,
      box: { x: -4, y: -64, w: 58, h: 56, shape: 'circle' },
    },
    // 내려찍기 도끼차기 (지침서 7장): 앞다리를 머리 위로 곧게 들었다가 앞으로 내리꽂는다. 위에서 아래 반원 + 바닥 방전
    slam: {
      motion: 'raiden/axe_kick', limb: ['kF', 'fF'], reach: undefined,
      box: { x: -2, y: -78, w: 50, h: 76, shape: 'fall' },
    },
    wallKick: { motion: 'raiden/wall_kick', reach: 12 },
    // 스킬 1 잔흔: 붉은 잔상을 남기며 앞으로 순간이동(3프레임 시작 틱, 최대 150px, 상대가 앞에 있으면 가운데끼리 18px 앞, 잔상이 바로 상대에 닿는다)해
    // 나타나자마자 뒷다리 하이킥 (뒷무릎→발, 머리 높이 반원 번개). 공중에서도 쓴다 (그 높이에 떠서 찬다). 피해·띄우기·기력은 기본 스킬 1 그대로
    skill1: {
      motion: 'raiden/zanhen', limb: ['kB', 'fB'], reach: undefined,
      box: { x: 4, y: -68, w: 56, h: 44, shape: 'arc' },
    },
    // 스킬 2 화과산 (캐릭터 기획서): 숨을 내쉬며 몸 둘레로 스파크를 터뜨려 붙은 상대를 크게 밀어낸다 (앞뒤 모두, 뒤에 있으면 뒤로).
    // 밀려난 상대는 전격 저주 (3초 동안 라이덴에게 주는 피해 30% 감소), 밀어낸 범위 끝에 적빛 전류 방벽이 1.5초 남아
    // 들어오는 상대를 튕겨낸다 (sim/chars/raiden.ts). 방어 중·막는 중에도 쓴다 (궁지에서 빠져나오는 수단)
    // 사용자 피드백 2026-11-02 (9-3): 0~6틱 들숨(웅크리며 몸 윤곽에 전류) → 7~10틱 날숨: 바닥에 붙은 반구 스파크 반지름 40px = 판정,
    // 히트스톱 3 → 10~30틱 동안 상대가 64~80px 밀려난다 (밀림 16px/틱), 12틱부터 라이덴 앞 40px에 전류 방벽 (sim/chars/raiden.ts)
    skill2: {
      motion: 'raiden/hwagwasan', limb: undefined,
      box: { x: -40, y: -40, w: 80, h: 40, shape: 'dome' },
      damage: 39, push: 16, hitstop: 3, launch: undefined, wall: false,
    },
    // 필살기 파천 (캐릭터 기획서): 검붉은 전격을 두른 붕권. 맞으면 연출: 상대 몸통에 주먹을 댄 채 멈춤 → 몸 안의 전격이 등 뒤로
    // 터져 나감 (뒤쪽 땅과 건물이 일직선으로 잿더미, sim/chars/raiden.ts) → 상대가 날아감 (벽 쪽으로). 빗나가면 풍압만 앞으로 날아가고 40틱 굳는다
    super: {
      motion: 'raiden/pacheon', limb: ['eB', 'hB'],
      box: { x: 16, y: -48, w: 48, h: 24, shape: 'line' },
      damage: 234,
      // 컷인 (사용자 피드백 2026-11-02 9-4·10): 검붉은 사선 띠에 큰 한자 破天과 작은 파천, 정지 20틱 동안 배경은 거의 검게
      cutin: {
        id: 'PACHEON', name: '파천', hanja: '破天', band: ['raidenDeep', 'raidenDark', 'raiden'], ink: ['fxWhite', 'raidenDeep'],
        accent: { motif: 'bolt', color: 'raidenDark', light: 'raidenLight' }, freeze: 20, dark: true,
      },
      // 150틱: 정지 20 + 발동 12 + 장면 24·24·16·34·20. 상대 몸 가운데는 라이덴 앞 40px (주먹이 가슴에 닿고 실루엣은 겹치지 않는다)
      cinematic: {
        whiff: 40,
        end: { launch: { vx: 5, vy: -4 }, wall: true },
        scenes: [
          { a: { motion: 'raiden/pacheon_press', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'raiden/pacheon_react1', pos: [[0, 40, 0], [1, 40, 0]] }, cam: 'a', still: true },
          { a: { motion: 'raiden/pacheon_surge', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'raiden/pacheon_react2', pos: [[0, 40, 0], [1, 40, 0]] }, cam: 'a' },
          {
            a: { motion: 'raiden/pacheon_burst', pos: [[0, 0, 0], [0.3, 2, 0], [1, 2, 0]] },
            d: { motion: 'raiden/pacheon_react3', pos: [[0, 40, 0], [0.3, 42, 0], [1, 44, 0]] }, cam: 'a',
          },
          {
            a: { motion: 'raiden/pacheon_fly', pos: [[0, 2, 0], [1, 2, 0]] },
            d: { motion: 'raiden/pacheon_react4', pos: [[0, 44, 0], [0.12, 72, -14], [0.6, 196, -34], [1, 248, -22]] }, cam: 'a',
          },
          {
            a: { motion: 'raiden/pacheon_after', pos: [[0, 2, 0], [1, 2, 0]] },
            d: { motion: 'raiden/pacheon_react5', pos: [[0, 248, -22], [1, 262, -6]] }, zoom: 1,
          },
        ],
      },
    },
    // 차지 투전승불 (사용자 피드백 2026-11-02, 9-1): 모은 틱 20·45·75·110에 1~4단계 (20틱 전에 떼도 1단계 수치).
    // 모으는 동안 전류가 뼈대를 따라 팔 → 다리 → 몸통·머리 → 전신으로 번진다 (그림은 render/fightvfx.ts raidenCharge).
    // 떼면 뒷주먹 붕권: 몸 이동 12/16/20/24, 리치 56/64/72/80 (몸 가운데에서 원뿔 끝까지), 원뿔 28/36/44/52px (= 판정, 8틱에 사라짐).
    // 상대: 1 약하게 짧게 밀림, 2 중간 밀림, 3 세게 멀리 (벽 쪽), 4 막아도 방어가 깨지고 아주 멀리 (벽 쪽). 4단계 뒤 탈진 40틱
    charge: {
      motion: 'raiden/charge', limb: ['eB', 'hB'], reach: undefined,
      box: { x: 28, y: -42, w: 28, h: 18, shape: 'cone' },
      launch: undefined, jumpCancel: false,
      charge: {
        auto: 50,
        levels: [
          {
            at: 20, damage: 55, guardDamage: 30, push: 2.4,
            box: { x: 28, y: -42, w: 28, h: 18, shape: 'cone' },
          },
          {
            at: 45, damage: 70, guardDamage: 45, push: 4.4,
            box: { x: 28, y: -44, w: 36, h: 22, shape: 'cone' },
          },
          {
            at: 75, damage: 90, guardDamage: 70, launch: { vx: 6.5, vy: -5.0 }, wall: true,
            box: { x: 28, y: -46, w: 44, h: 26, shape: 'cone' },
          },
          // 4단계: 방어 깎기 100 = 방어 게이지 전부 (막아도 가드 크러시), 끝난 뒤 40틱 탈진 (기획서 '최고 단계로 쓰면 짧게 탈진')
          {
            at: 110, damage: 117, guardDamage: 100, launch: { vx: 11.0, vy: -5.0 }, wall: true, exhaust: 40,
            box: { x: 28, y: -48, w: 52, h: 30, shape: 'cone' },
          },
        ],
      },
    },
  },
};
