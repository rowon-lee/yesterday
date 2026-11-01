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
    // 1타 잽 (동작연출지침서 7장): 감기 뒤 앞발을 크게 내디뎌 13px 들어가며(감기에서 3px 물러났다 16px) 앞손 스트레이트.
    // 궤적 상자 = 주먹 끝에서 앞으로 41px 뻗는 직선 번개 (발밑 기준 x 28~74, 높이 14px). 넉백 3.2px/틱 (약 17px 밀림, 다음 타가 리치 끝에서)
    atk1: {
      motion: 'raiden/jab', active: [4, 5], limb: ['eF', 'hF'], damage: 34, push: 3.2, reach: undefined, step: undefined,
      advance: [0, -2, -1, 6, 6, 3, 1, 0, 0, 0, 0, 0],
      box: { x: 28, y: -42, w: 46, h: 14, shape: 'line' },
    },
    // 2타 크로스 (지침서 7장): 뒷발을 비틀며 몸통을 돌려 뒷손 스트레이트. 14px 들어가며 더 긴 직선 번개 + 전류 가지
    atk2: {
      motion: 'raiden/cross', active: [4, 5], limb: ['eB', 'hB'], damage: 38, push: 3.4, reach: undefined, step: undefined,
      advance: [0, -2, -1, 7, 6, 3, 1, 0, 0, 0, 0, 0],
      box: { x: 30, y: -43, w: 58, h: 16, shape: 'line' },
    },
    // 3타 미들킥 (지침서 7장): 뒷다리가 크게 반원을 그려 몸통을 찬다. 지름 약 56px 반원 번개
    atk3: {
      motion: 'raiden/middle_kick', active: [4, 5], limb: ['kB', 'fB'], damage: 50, push: 3.6, reach: undefined, step: undefined,
      advance: [0, 4, 2, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 6, y: -54, w: 56, h: 40, shape: 'arc' },
    },
    // 4타 슈퍼맨 펀치 (지침서 7장): 한 발로 튀어 올라 전신을 한 줄로 뻗으며 날아든다. 앞으로 64px 넘게 뻗는 적뢰 줄기,
    // 맞으면 멀리 날아가 벽꽝 (줄기가 바닥을 타고 더 멀리 달리는 것은 그림만, 판정은 상자까지)
    atk4: {
      motion: 'raiden/superman_punch', active: [5, 6], limb: ['eB', 'hB'], damage: 66, push: 4.2, reach: undefined, step: undefined,
      advance: [0, 3, 1, 6, 8, 6, 3, 2, 1, 0, 0, 0, 0, 0],
      box: { x: 20, y: -54, w: 86, h: 20, shape: 'line' },
      launch: { vx: 10, vy: -5 },
    },
    // 띄우기 어퍼컷 (지침서 7장): 몸이 함께 솟구치며 뒷주먹을 머리 위까지. 아래에서 위로 세로 번개
    launcher: {
      motion: 'raiden/uppercut', active: [4, 5, 6], limb: ['eB', 'hB'], reach: undefined, step: undefined,
      advance: [0, 1, 2, 8, 5, 2, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 8, y: -98, w: 30, h: 84, shape: 'rise' },
    },
    // 쓸기 다리 걸기 (지침서 7장): 낮게 엎드려 뒷다리로 바닥을 쓸어 넘어뜨린다. 바닥을 쓰는 반원 번개 + 물 튐
    sweep: {
      motion: 'raiden/leg_sweep', active: [4, 5, 6], limb: ['kB', 'fB'], reach: undefined, step: undefined,
      advance: [0, 2, 2, 6, 6, 2, 0, 0, 0, 0, 0, 0, 0],
      box: { x: -2, y: -16, w: 60, h: 16, shape: 'ground' },
    },
    // 대시 공격 플라잉 니 (지침서 7장): 달려와 뛰어들며 앞무릎 (엉덩이→무릎). 몸 뒤로 끌리는 번개 꼬리. 54px 들어간다
    dashAttack: {
      motion: 'raiden/flying_knee', active: [4, 5, 6], limb: ['hip', 'kF'], reach: undefined, step: undefined,
      advance: [6, 6, 8, 10, 8, 6, 4, 2, 0, 2, 2, 0, 0],
      box: { x: -4, y: -48, w: 48, h: 30, shape: 'tail' },
    },
    // 공중 1타 잽 → 2타 크로스 (지침서 7장 '1~2는 직선'): 앞 아래로 비스듬히 뻗는 직선 번개
    air1: {
      motion: 'raiden/air_jab', active: [4, 5], limb: ['eF', 'hF'], reach: undefined,
      advance: [0, 0, -1, 3, 3, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 26, y: -42, w: 40, h: 22, shape: 'line' },
    },
    air2: {
      motion: 'raiden/air_cross', active: [4, 5], limb: ['eB', 'hB'], reach: undefined,
      advance: [0, 0, -1, 3, 4, 1, 0, 0, 0, 0, 0, 0],
      box: { x: 26, y: -42, w: 46, h: 22, shape: 'line' },
    },
    // 공중 3타 돌려차기 (지침서 7장 '3은 원'): 뒷다리가 한 바퀴 원을 그리며 휘돌아 찬다. 비스듬히 날린다
    air3: {
      motion: 'raiden/air_roundhouse', active: [4, 5, 6], limb: ['kB', 'fB'], reach: undefined,
      advance: [0, 0, 1, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0],
      box: { x: -4, y: -64, w: 58, h: 56, shape: 'circle' },
    },
    // 내려찍기 도끼차기 (지침서 7장): 앞다리를 머리 위로 곧게 들었다가 앞으로 내리꽂는다. 위에서 아래 반원 + 바닥 방전
    slam: {
      motion: 'raiden/axe_kick', active: [4, 5, 6], limb: ['kF', 'fF'], reach: undefined,
      advance: [0, 0, 0, 2, 3, 2, 1, 0, 0, 0, 0, 0, 0],
      box: { x: -2, y: -78, w: 50, h: 76, shape: 'fall' },
    },
    wallKick: { motion: 'raiden/wall_kick', reach: 12 },
    // 스킬 1 잔흔: 붉은 잔상을 남기며 앞으로 순간이동(3프레임 시작 틱, 최대 150px, 상대가 앞에 있으면 가운데끼리 18px 앞, 잔상이 바로 상대에 닿는다)해
    // 나타나자마자 뒷다리 하이킥 (뒷무릎→발, 머리 높이 반원 번개). 공중에서도 쓴다 (그 높이에 떠서 찬다). 피해·띄우기·기력은 기본 스킬 1 그대로
    skill1: {
      motion: 'raiden/zanhen', active: [5, 6], limb: ['kB', 'fB'], reach: undefined,
      step: { from: 3, to: 6, speed: 1.5 }, blink: { at: 2, dist: 150, gap: 18 },
      box: { x: 4, y: -68, w: 56, h: 44, shape: 'arc' },
    },
    // 스킬 2 화과산 (캐릭터 기획서): 숨을 내쉬며 몸 둘레로 스파크를 터뜨려 붙은 상대를 크게 밀어낸다 (앞뒤 모두, 뒤에 있으면 뒤로).
    // 밀려난 상대는 전격 저주 (3초 동안 라이덴에게 주는 피해 30% 감소), 밀어낸 범위 끝에 적빛 전류 방벽이 1.5초 남아
    // 들어오는 상대를 튕겨낸다 (sim/chars/raiden.ts). 방어 중·막는 중에도 쓴다 (궁지에서 빠져나오는 수단)
    skill2: {
      motion: 'raiden/hwagwasan', active: [4, 5, 6], limb: undefined, boxOnly: true,
      box: { x: -44, y: -62, w: 88, h: 64, shape: 'circle' },
      damage: 50, push: 12, launch: undefined, wall: false,
    },
    // 필살기 파천 (캐릭터 기획서): 검붉은 전격을 두른 붕권. 맞으면 연출: 상대 몸통에 주먹을 댄 채 멈춤 → 몸 안의 전격이 등 뒤로
    // 터져 나감 (뒤쪽 땅과 건물이 일직선으로 잿더미, sim/chars/raiden.ts) → 상대가 날아감 (벽 쪽으로). 빗나가면 풍압만 앞으로 날아가고 40틱 굳는다
    super: {
      motion: 'raiden/pacheon', active: [5, 6, 7], limb: ['eB', 'hB'], step: undefined,
      advance: [0, 0, 0, 4, 6, 6, 2, 0, 0, 0, 0, 0, 0, 0],
      box: { x: 16, y: -48, w: 48, h: 24, shape: 'line' },
      damage: 300, cutin: 'PACHEON',
      cinematic: {
        whiff: 40,
        end: { launch: { vx: 12, vy: -5 }, wall: true },
        scenes: [
          { a: { motion: 'raiden/pacheon_press', pos: [[0, 0, 0], [1, 0, 0]] }, d: { motion: 'raiden/pacheon_react1', pos: [[0, 30, 0], [1, 30, 0]] } },
          {
            a: { motion: 'raiden/pacheon_burst', pos: [[0, 0, 0], [0.2, 2, 0], [1, 2, 0]] },
            d: { motion: 'raiden/pacheon_react2', pos: [[0, 30, 0], [0.2, 32, 0], [1, 34, 0]] },
          },
          {
            a: { motion: 'raiden/pacheon_after', pos: [[0, 2, 0], [1, 2, 0]] },
            d: { motion: 'raiden/pacheon_react3', pos: [[0, 34, 0], [0.15, 52, -12], [0.6, 116, -34], [1, 156, -40]] },
          },
        ],
      },
    },
    // 차지 투전승불: 4단계 (설정의 신체능력 4·5·6·7배). 단계가 높을수록 방어를 많이 깎고 멀리 날린다.
    // 1·2단계는 띄워 점프로 쫓고, 3·4단계는 벽 쪽으로 날린다. 뒷주먹 (기본 차지는 앞주먹).
    // 번개(= 판정)는 단계마다 길어진다: 주먹 끝에서 88 → 128 → 182 → 240px (4단계는 화면 폭의 절반, 지침서 7-1장)
    charge: {
      motion: 'raiden/charge', active: [9, 10], limb: ['eB', 'hB'], step: undefined, reach: undefined,
      advance: [0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 4, 2, 0, 0],
      box: { x: 32, y: -44, w: 56, h: 18, shape: 'line' },
      charge: {
        windup: 4, loopTo: 7, from: 8, auto: 50,
        levels: [
          { at: 0, damage: 70, guardDamage: 30, launch: { vx: 1.0, vy: -11.2 }, jumpCancel: true, box: { x: 32, y: -44, w: 56, h: 18, shape: 'line' } },
          { at: 20, damage: 90, guardDamage: 45, launch: { vx: 1.6, vy: -11.6 }, jumpCancel: true, box: { x: 32, y: -46, w: 96, h: 22, shape: 'line' } },
          { at: 40, damage: 115, guardDamage: 70, launch: { vx: 7.0, vy: -6.0 }, wall: true, box: { x: 32, y: -48, w: 150, h: 26, shape: 'line' } },
          // 4단계는 끝난 뒤 36틱 탈진 (기획서 '최고 단계로 쓰면 짧게 탈진')
          {
            at: 60, damage: 150, guardDamage: 110, launch: { vx: 11.0, vy: -5.0 }, wall: true, exhaust: 36,
            box: { x: 32, y: -50, w: 208, h: 30, shape: 'line' },
          },
        ],
      },
    },
  },
};
