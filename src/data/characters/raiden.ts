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
  moves: {
    // 1타 잽: 기본보다 1틱 빠른 발동(3틱), 앞발을 크게 미끄러뜨려 들어감
    atk1: { motion: 'raiden/jab', active: [3, 4], limb: ['eF', 'hF'], damage: 38, step: { from: 1, to: 4, speed: 3.0 }, reach: 14 },
    // 2타 스트레이트: 뒷손, 허리를 틀며 앞발로 깊이 디딤
    atk2: { motion: 'raiden/cross', active: [3, 4], limb: ['eB', 'hB'], damage: 45, step: { from: 1, to: 4, speed: 3.6 }, reach: 18 },
    // 3타 훅: 앞손 (기본 3타는 발차기), 몸을 돌리며 들어감
    atk3: { motion: 'raiden/hook', active: [5, 6], limb: ['eF', 'hF'], damage: 55, step: { from: 3, to: 6, speed: 3.0 }, reach: 16 },
    // 4타 플라잉 니킥: 엉덩이→무릎 구간 (무릎 끝으로 친다). 맞으면 벽 쪽으로 날림은 기본 4타 그대로
    atk4: { motion: 'raiden/knee', active: [6, 7], limb: ['hip', 'kF'], damage: 80, step: { from: 2, to: 7, speed: 3.6 }, reach: 12 },
    // 띄우기 어퍼컷: 뒷손 (기본은 앞손), 뛰어오르며 위로 길게
    launcher: { motion: 'raiden/uppercut', active: [4, 5, 6], limb: ['eB', 'hB'], step: { from: 2, to: 5, speed: 2.6 }, reach: 18 },
    // 쓸기 로킥: 뒷다리 정강이 (기본은 앞다리)
    sweep: { motion: 'raiden/low_kick', active: [4, 5, 6], limb: ['kB', 'fB'], step: { from: 2, to: 6, speed: 2.4 }, reach: 16 },
    // 대시 공격 슈퍼맨 펀치: 뒷손, 판정 한 프레임 늦게 (높이 뛰어올랐다 내지른다)
    dashAttack: { motion: 'raiden/superman', active: [5, 6], limb: ['eB', 'hB'], step: { from: 0, to: 6, speed: 7.0 }, reach: 20 },
    air1: { motion: 'raiden/air_jab', active: [3, 4], limb: ['eF', 'hF'], reach: 14 },
    // 공중 2타 스트레이트: 뒷손 (기본은 발차기)
    air2: { motion: 'raiden/air_cross', active: [3, 4], limb: ['eB', 'hB'], reach: 16 },
    // 공중 3타 니킥: 엉덩이→무릎
    air3: { motion: 'raiden/air_knee', active: [4, 5], limb: ['hip', 'kF'], reach: 12 },
    // 내려찍기 해머 피스트
    slam: { motion: 'raiden/hammer', active: [5, 6, 7], limb: ['eF', 'hF'], reach: 16 },
    wallKick: { motion: 'raiden/wall_kick', reach: 12 },
    // 차지 투전승불: 4단계 (설정의 신체능력 4·5·6·7배). 단계가 높을수록 방어를 많이 깎고 멀리 날린다.
    // 1·2단계는 띄워 점프로 쫓고, 3·4단계는 벽 쪽으로 날린다. 뒷주먹 (기본 차지는 앞주먹)
    charge: {
      motion: 'raiden/charge', active: [10, 11], limb: ['eB', 'hB'], step: { from: 8, to: 11, speed: 6.0 }, reach: 22,
      charge: {
        windup: 4, loopTo: 7, from: 8, auto: 50,
        levels: [
          { at: 0, damage: 70, guardDamage: 30, launch: { vx: 1.0, vy: -11.2 }, jumpCancel: true },
          { at: 20, damage: 90, guardDamage: 45, launch: { vx: 1.6, vy: -11.6 }, jumpCancel: true },
          { at: 40, damage: 115, guardDamage: 70, launch: { vx: 7.0, vy: -6.0 }, wall: true },
          // 4단계는 끝난 뒤 36틱 탈진 (기획서 '최고 단계로 쓰면 짧게 탈진')
          { at: 60, damage: 150, guardDamage: 110, launch: { vx: 11.0, vy: -5.0 }, wall: true, exhaust: 36 },
        ],
      },
    },
  },
};
