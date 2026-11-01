import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/*
 * 기본 스틱맨 임시 필살기의 연출 장면 (캐릭터 기획서 '필살기 연출'의 틀 확인용, 시스템 확인용 base 동작).
 * 필살기가 맞으면 세 장면을 차례로 재생한다: 난타 → 어퍼로 띄우기 → 내려찍기. 장면마다 발동자 동작 하나와
 * 상대 반응 동작 하나 (상대 반응은 필살기에 딸린 데이터라 누가 맞든 같다). 동작마다 14프레임,
 * 같은 장면의 두 동작은 표시 틱 합이 같다. 두 사람이 옮겨 가는 자리는 기술 데이터(moves/base.ts의 cinematic).
 * 오른쪽을 보는 기준. 상대 반응은 발동자를 바라보는 쪽(오른쪽을 보는 그림을 상대 쪽으로 뒤집어 그린다)이다.
 */

const P = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o });
const r = (n: number, len: number): number[] => Array(len).fill(n);

// ---- 1장면: 난타 (양 주먹을 번갈아 곧게) ----
const RU_READY = P({ hx: 1, hy: -19, tl: 14, hd: 0, aFx: 8, aFy: 2, aBx: 6, aBy: 4, lFx: 12, lBx: -11 });
const RU_F1 = P({ hx: 3, hy: -19, tl: 18, hd: -2, aFx: 17, aFy: -2, aBx: 3, aBy: 7, lFx: 12, lBx: -11 });
const RU_B1 = P({ hx: 4, hy: -18, tl: 20, hd: -2, aFx: 5, aFy: 4, aBx: 16, aBy: -1, lFx: 12, lBx: -12 });
const RU_F2 = P({ hx: 3, hy: -19, tl: 18, hd: -2, aFx: 17, aFy: 0, aBx: 3, aBy: 6, lFx: 12, lBx: -11 });
const RU_B2 = P({ hx: 4, hy: -18, tl: 20, hd: -2, aFx: 5, aFy: 3, aBx: 16, aBy: -3, lFx: 12, lBx: -12 });
const RU_F3 = P({ hx: 3, hy: -19, tl: 18, hd: -3, aFx: 17, aFy: -4, aBx: 3, aBy: 6, lFx: 12, lBx: -11 });
const RU_B3 = P({ hx: 4, hy: -18, tl: 20, hd: -2, aFx: 6, aFy: 4, aBx: 17, aBy: -1, lFx: 12, lBx: -12 });
const RU_END = P({ hx: 2, hy: -18, tl: 16, hd: 0, aFx: 9, aFy: 3, aBx: 6, aBy: 5, lFx: 12, lBx: -11 });

export const SUPER_RUSH: MotionData = {
  name: 'base/super_rush',
  label: '임시 필살 1장면: 난타',
  dur: r(3, 14),
  keys: [
    { at: 0, pose: RU_READY }, { at: 1, pose: RU_F1 }, { at: 3, pose: RU_B1 }, { at: 5, pose: RU_F2 },
    { at: 7, pose: RU_B2 }, { at: 9, pose: RU_F3 }, { at: 11, pose: RU_B3 }, { at: 13, pose: RU_END },
  ],
};

// 상대: 주먹마다 고개와 몸이 뒤로 꺾였다 돌아온다
const RH_BACK = P({ hx: -6, hy: -20, tl: -22, hd: -26, aFx: -2, aFy: 8, aBx: -8, aBy: 6, lFx: 9, lBx: -8 });
const RH_FWD = P({ hx: -3, hy: -20, tl: -8, hd: -10, aFx: 5, aFy: 3, aBx: -1, aBy: 6, lFx: 9, lBx: -8 });
const RH_BACK2 = P({ hx: -7, hy: -19, tl: -26, hd: -30, aFx: -3, aFy: 9, aBx: -9, aBy: 6, lFx: 10, lBx: -9 });

export const SUPER_RUSH_HIT: MotionData = {
  name: 'base/super_rush_hit',
  label: '임시 필살 1장면 상대: 난타에 흔들림',
  dur: r(3, 14),
  keys: [
    { at: 0, pose: RH_FWD }, { at: 1, pose: RH_BACK }, { at: 3, pose: RH_FWD }, { at: 5, pose: RH_BACK },
    { at: 7, pose: RH_FWD }, { at: 9, pose: RH_BACK2 }, { at: 11, pose: RH_FWD }, { at: 13, pose: RH_BACK2 },
  ],
};

// ---- 2장면: 어퍼로 띄우기 (웅크렸다 솟구치며 올려친다. 자리가 위로 오르는 것은 기술 데이터) ----
const RI_CROUCH = P({ hx: -1, hy: -14, tl: 22, hd: -6, aFx: 6, aFy: 10, aBx: 2, aBy: 8, lFx: 11, lBx: -11 });
const RI_DRIVE = P({ hx: 2, hy: -22, tl: 6, hd: 6, aFx: 8, aFy: -18, aBx: -6, aBy: 6, lFx: 6, lFy: -2, lBx: -6 });
const RI_UP = P({ hx: 2, hy: -26, tl: -6, hd: 10, aFx: 4, aFy: -20, aBx: -8, aBy: 4, lFx: 4, lFy: -8, lBx: -6, lBy: -2 });
const RI_TUCK = P({ hy: -26, tl: 4, hd: 4, aFx: 6, aFy: -16, aBx: -4, aBy: 2, lFx: 8, lFy: -14, lBx: 0, lBy: -10 });
const RI_APEX = P({ hy: -25, tl: 8, hd: 2, aFx: 8, aFy: -8, aBx: -2, aBy: 2, lFx: 6, lFy: -8, lBx: -4, lBy: -6 });
const RISE_DUR = [3, 3, 3, 3, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4];

export const SUPER_RISE: MotionData = {
  name: 'base/super_rise',
  label: '임시 필살 2장면: 어퍼로 띄우기',
  dur: RISE_DUR,
  keys: [
    { at: 0, pose: RU_END }, { at: 3, pose: RI_CROUCH, stop: true }, { at: 5, pose: RI_DRIVE },
    { at: 7, pose: RI_UP, stop: true }, { at: 10, pose: RI_TUCK }, { at: 13, pose: RI_APEX },
  ],
};

// 상대: 배를 맞아 몸이 접혔다가 뒤로 젖혀지며 솟구친다
const RIH_FOLD = P({ hx: 0, hy: -24, tl: 20, hd: 20, aFx: 6, aFy: 10, aBx: 2, aBy: 10, lFx: 6, lFy: -4, lBx: -6, lBy: -2 });
const RIH_ARCH = P({ hx: -2, hy: -26, tl: -30, hd: -20, aFx: 4, aFy: -14, aBx: -6, aBy: -12, lFx: 6, lFy: -10, lBx: -4, lBy: -6 });
const RIH_TUMBLE = P({ hx: -2, hy: -24, tl: -50, hd: -30, aFx: -2, aFy: -10, aBx: -10, aBy: -6, lFx: 10, lFy: -12, lBx: 2, lBy: -14 });
const RIH_END = P({ hx: -2, hy: -22, tl: -38, hd: -22, aFx: -2, aFy: -9, aBx: -8, aBy: -11, lFx: 11, lFy: -7, lBx: 4, lBy: -3 });

export const SUPER_RISE_HIT: MotionData = {
  name: 'base/super_rise_hit',
  label: '임시 필살 2장면 상대: 올려 맞아 솟구침',
  dur: RISE_DUR,
  keys: [
    { at: 0, pose: RH_BACK2 }, { at: 3, pose: RH_FWD }, { at: 5, pose: RIH_FOLD, stop: true },
    { at: 8, pose: RIH_ARCH }, { at: 11, pose: RIH_TUMBLE }, { at: 13, pose: RIH_END },
  ],
};

// ---- 3장면: 내려찍기 (상대 위로 넘어가 두 주먹으로 내리치고 내려선다) ----
const SL_OVER = P({ hy: -26, tl: 30, hd: -10, aFx: 2, aFy: -14, aBx: -2, aBy: -16, lFx: 6, lFy: -16, lBx: 0, lBy: -14 });
const SL_SWING = P({ hy: -25, tl: 40, hd: -16, aFx: 14, aFy: 6, aBx: 12, aBy: 8, lFx: 4, lFy: -12, lBx: -6, lBy: -10 });
const SL_DIVE = P({ hy: -25, tl: 50, hd: -18, aFx: 10, aFy: 14, aBx: 8, aBy: 14, lFx: 2, lFy: -14, lBx: -8, lBy: -12 });
const SL_LAND = P({ hx: 0, hy: -14, tl: 24, hd: -6, aFx: 10, aFy: 10, aBx: 6, aBy: 12, lFx: 11, lBx: -11 });
const SL_END = P({ hx: 0, hy: -19, tl: 12, hd: 2, aFx: 10, aFy: 6, aBx: 5, aBy: 11, lFx: 10, lBx: -10 });
const SLAM_DUR = [3, 3, 3, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4];

export const SUPER_SLAM: MotionData = {
  name: 'base/super_slam',
  label: '임시 필살 3장면: 내려찍기',
  dur: SLAM_DUR,
  keys: [
    { at: 0, pose: RI_APEX }, { at: 3, pose: SL_OVER, stop: true }, { at: 5, pose: SL_SWING },
    { at: 7, pose: SL_DIVE, stop: true }, { at: 9, pose: SL_LAND, stop: true }, { at: 13, pose: SL_END },
  ],
};

// 상대: 위에서 맞아 몸이 꺾이고, 바닥에 꽂혀 한 번 튀었다가 눕는다
const SLH_HIT = P({ hx: 0, hy: -24, tl: 30, hd: 30, aFx: 4, aFy: -12, aBx: -2, aBy: -12, lFx: 8, lFy: -12, lBx: 0, lBy: -10 });
const SLH_FALL = P({ hx: 0, hy: -18, tl: -80, hd: -10, aFx: -6, aFy: -12, aBx: -10, aBy: -10, lFx: 14, lFy: -14, lBx: 8, lBy: -16 });
const SLH_LIE = P({ hx: 3, hy: -3, tl: -90, hd: 0, aFx: -6, aFy: 2, aBx: -2, aBy: 2, lFx: 25, lFy: -2, lBx: 24, lBy: 0 });
const SLH_BOUNCE = P({ hx: 3, hy: -8, tl: -84, hd: -4, aFx: -6, aFy: -2, aBx: -2, aBy: -1, lFx: 24, lFy: -8, lBx: 23, lBy: -5 });

export const SUPER_SLAM_HIT: MotionData = {
  name: 'base/super_slam_hit',
  label: '임시 필살 3장면 상대: 바닥에 꽂힘',
  dur: SLAM_DUR,
  keys: [
    { at: 0, pose: RIH_END }, { at: 4, pose: SLH_HIT, stop: true }, { at: 7, pose: SLH_FALL },
    { at: 9, pose: SLH_LIE, stop: true }, { at: 11, pose: SLH_BOUNCE }, { at: 13, pose: SLH_LIE },
  ],
};

export const SUPER_MOTIONS: MotionData[] = [SUPER_RUSH, SUPER_RUSH_HIT, SUPER_RISE, SUPER_RISE_HIT, SUPER_SLAM, SUPER_SLAM_HIT];
