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
  },
  // 기술: 그림과 바꾼 수치만 적는다 (나머지는 기본 스틱맨 기술 그대로)
  moves: {
    // 1타 잽: 기본보다 1틱 빠른 발동(3틱), 반 걸음 들어감
    atk1: { motion: 'raiden/jab', active: [3, 4], limb: ['eF', 'hF'], damage: 38, step: { from: 1, to: 3, speed: 2.0 } },
    // 2타 스트레이트: 뒷손, 허리를 틀며 들어감
    atk2: { motion: 'raiden/cross', active: [3, 4], limb: ['eB', 'hB'], damage: 45, step: { from: 1, to: 4, speed: 2.4 } },
    // 3타 훅: 앞손 (기본 3타는 발차기)
    atk3: { motion: 'raiden/hook', active: [5, 6], limb: ['eF', 'hF'], damage: 55 },
    // 4타 니킥: 엉덩이→무릎 구간 (무릎 끝으로 친다). 맞으면 벽 쪽으로 날림은 기본 4타 그대로
    atk4: { motion: 'raiden/knee', active: [6, 7], limb: ['hip', 'kF'], damage: 80 },
    wallKick: { motion: 'raiden/wall_kick' },
  },
};
