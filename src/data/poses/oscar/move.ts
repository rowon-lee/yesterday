import type { MotionData } from '../../../anim/motion';
import type { Key } from '../../../anim/keyed';
import { O_STANCE, OR } from './stance';

/*
 * 오스카 이동 (캐릭터 기획서 '움직임': 살짝 굽은 채 칼자루에 손을 얹고 천천히 걷는 노인. 동작은 작고 군더더기가 없다).
 */

// ---- 대기: 숨을 쉬듯 몸이 1px 오르내리고, 숨을 내쉴 때 엄지로 날밑을 밀어 칼이 한 번 살짝 나왔다 들어간다 ----
/** 들숨: 등이 조금 펴지며 1px 오르고 고개가 든다 */
const BREATH_IN = OR({ hy: -23, tl: 11, hd: 9 });
/** 날숨: 다시 굽으며 내려앉고, 엄지로 날밑을 밀어 칼날이 2px 비친다 (몸에 밴 버릇) */
const BREATH_OUT = OR({ hy: -21, tl: 14, hd: 13 }, 2);

/** 대기: 들숨 → 머무름 → 날숨에 날밑을 밀었다가 → 칼을 다시 밀어 넣으며 제자리. 14프레임 72틱 (1.2초에 한 번 숨) */
export const OSCAR_IDLE: MotionData = {
  name: 'oscar/idle',
  label: '오스카 대기',
  loop: true,
  dur: [6, 6, 6, 6, 6, 4, 4, 4, 6, 6, 4, 4, 5, 5],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 4, pose: BREATH_IN, stop: true },
    { at: 6, pose: BREATH_IN },
    { at: 9, pose: BREATH_OUT, stop: true },
    { at: 11, pose: OR({ hy: -21.5, tl: 14, hd: 13 }) },
    { at: 14, pose: O_STANCE },
  ],
};

// ---- 앞 걷기·뒤 걷기: 노인의 걸음 (발을 낮게 끌듯 옮기는 보폭 작은 걸음) ----
/*
 * 기본 스틱맨처럼 뛰지 않고, 라이덴처럼 튀지도 않는다. 한 발씩 낮게(2px) 들어 옮기는 걸음.
 * 한 바퀴 = 두 걸음 (14프레임, 한 걸음 7프레임). 프레임은 움직인 거리로 넘긴다 (sim: runCycle).
 * 디딘 발은 몸이 움직인 만큼 뒤로(뒤 걷기는 앞으로) 가서 바닥에서 미끄러지지 않는다.
 * 손은 늘 칼자루와 뒷짐 (몸이 오르내리고 기울어도 손이 따라 붙는다).
 */
/** 앞 걷기 한 걸음 보폭 (px). 한 바퀴(두 걸음)는 두 배 = 오스카 runCycle */
export const O_STEP_F = 16;
/** 뒤 걷기 한 걸음 보폭 (px). 한 바퀴는 두 배 = runBackCycle */
export const O_STEP_B = 12;

/** 걸음 한 바퀴의 키 14개 (프레임마다): dir 1 앞, -1 뒤 */
function walkKeys(step: number, dir: 1 | -1): Key[] {
  const keys: Key[] = [];
  const half = step / 2;
  for (let i = 0; i <= 14; i++) {
    const k = i % 7;
    const u = k / 7;
    // 첫 걸음(0~6): 앞발이 디딘 발, 뒷발이 옮기는 발. 둘째 걸음(7~13): 반대
    const firstStep = i < 7 || i === 14;
    // 디딘 발: 몸이 간 만큼 반대로 (앞 걷기면 앞 → 뒤)
    const planted = dir * (half - step * u);
    // 옮기는 발: 뒤에서 앞으로 (앞 걷기), 처음·끝은 천천히 (발을 끌듯)
    const sw = u * u * (3 - 2 * u);
    const swing = dir * (-half + step * sw);
    const lift = -2 * Math.sin(Math.PI * u);
    // 디딘 발 위로 몸이 지나갈 때 가장 높고 (0.8px), 두 발이 다 닿을 때 가장 낮다. 등은 걸음마다 1° 끄덕
    const bob = Math.sin(Math.PI * u);
    const pose = OR({
      hx: 0.5 + dir * 0.4 * bob,
      hy: -21.6 - 0.8 * bob,
      tl: (dir > 0 ? 14 : 11) - bob,
      hd: (dir > 0 ? 12 : 13) - bob,
      lFx: firstStep ? planted : swing,
      lFy: firstStep ? 0 : lift,
      lBx: firstStep ? swing : planted,
      lBy: firstStep ? lift : 0,
    });
    keys.push({ at: i, pose: i === 14 ? keys[0].pose : pose });
  }
  return keys;
}

/** 앞 걷기 (sim 자리 run_f): 굽은 채 한 발씩 낮게 옮기는 노인의 걸음. 14프레임, 한 바퀴 32px */
export const OSCAR_WALK_F: MotionData = {
  name: 'oscar/walk_f',
  label: '오스카 앞 걷기',
  loop: true,
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: walkKeys(O_STEP_F, 1),
};

/** 뒤 걷기 (sim 자리 run_b): 같은 걸음으로 물러난다 (보폭이 더 작고 등을 조금 편다). 14프레임, 한 바퀴 24px */
export const OSCAR_WALK_B: MotionData = {
  name: 'oscar/walk_b',
  label: '오스카 뒤 걷기',
  loop: true,
  dur: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: walkKeys(O_STEP_B, -1),
};

export const OSCAR_MOVE_MOTIONS: readonly MotionData[] = [OSCAR_IDLE, OSCAR_WALK_F, OSCAR_WALK_B];
