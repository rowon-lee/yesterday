import type { MotionData } from '../../anim/motion';
import type { Pose } from '../../anim/pose';
import { STANCE } from './stance';

/*
 * 공통 동작: 모든 캐릭터가 같이 쓰는 맞는 동작 7개 (docs/공통동작사양서.md). 사양서 순서대로 하나씩 만들고 승인받는다.
 * 오른쪽을 보는 캐릭터가 앞(오른쪽)에서 맞는 기준. 동작은 제자리에서 몸만 반응하고, 밀려나는 거리는 sim이 정한다.
 *
 * 자세는 사양서처럼 '기준 자세(STANCE)에서 바뀌는 양'으로 적는다 (아래 D):
 * - 몸통: 도, 앞으로 숙임 +. tl = STANCE.tl + 몸통
 * - 머리: 화면에서 보이는 기울기의 변화(도). 우리 자세 데이터의 hd는 몸통 기준이라 hd = STANCE.hd + 머리 − 몸통
 * - 엉덩이: px, 오른쪽 +, 높이는 위 + (자세 데이터 hy는 아래가 +라서 부호를 바꾼다)
 * - 팔다리 목표는 자세 데이터 값 그대로 (손은 어깨 기준, 발은 발밑 기준)
 *
 * 맞는 시간(경직)은 공격마다 달라서, 프레임 수는 그대로 두고 '늘어나는 프레임'의 표시 틱만 바꿔 길이를 맞춘다
 * (sim/frames.ts의 frameFitted, 늘어나는 프레임은 HIT_STRETCH).
 */
function D(torso: number, head: number, hipX = 0, hipUp = 0, limbs: Partial<Pose> = {}): Pose {
  return {
    ...STANCE,
    ...limbs,
    hx: STANCE.hx + hipX,
    hy: STANCE.hy - hipUp,
    tl: STANCE.tl + torso,
    hd: STANCE.hd + head - torso,
  };
}

// ---- 1. 약하게 맞음 (12프레임, 기본 20틱, 늘어나는 프레임 5) ----
// 1 충격: 머리가 먼저 젖혀진다 (머리 −15°, 몸통 −5°)
const HL_IMPACT = D(-5, -15);
// 2 몸통 −10°, 앞손이 몸 쪽으로 움츠러든다 (사양서에 값이 적힌 사이 프레임이라 키로 둔다: 충격 뒤 빠르게 젖혀지고 5번에서 멎는다)
const HL_RECOIL = D(-10, -19, 0, 0, { aFx: 6, aFy: 4, aBx: 5, aBy: 10 });
// 5 최대로 젖혀짐: 몸통 −18°, 머리 −22°, 엉덩이 뒤로 2px·1px 내려앉음(무릎 살짝 굽음), 두 팔은 가슴 앞으로
const HL_PEAK = D(-18, -22, -2, -1, { aFx: 6, aFy: 2, aBx: 4, aBy: 4 });
// 8 돌아오는 중: 몸통 −8°, 머리 −6° (머리가 몸통보다 먼저 돌아온다)
const HL_BACK = D(-8, -6, -1, 0, { aFx: 8, aFy: 4, aBx: 5, aBy: 8 });

export const HIT_LIGHT: MotionData = {
  name: 'common/hit_light',
  label: '약하게 맞음',
  dur: [1, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1],
  keys: [
    { at: 0, pose: HL_IMPACT },
    { at: 1, pose: HL_RECOIL },
    { at: 4, pose: HL_PEAK, stop: true },
    { at: 7, pose: HL_BACK },
    { at: 11, pose: STANCE },
  ],
};

/** 공통 동작의 늘어나는 프레임 (0부터 센 번호). 경직이 기본 길이보다 길면 이 프레임의 표시 틱이 늘어난다 */
export const HIT_STRETCH: Readonly<Record<string, number>> = {
  'common/hit_light': 4,
};

export const COMMON_MOTIONS: MotionData[] = [HIT_LIGHT];
