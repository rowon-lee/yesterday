import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import type { Key } from '../../../anim/keyed';
import { E, E_STANCE } from './stance';

/*
 * 에드워드 대기·걷기 (캐릭터 기획서 '움직임': 해머를 어깨에 걸친 채 여유롭게 걷는 가주. 걸음은 느리고 보폭이 크다).
 */

// ---- 대기: 느린 숨. 가슴이 부풀며 해머가 어깨 위에서 조금 들렸다 내려앉는다 ----
/** 들숨: 가슴을 펴고 턱을 든다, 해머가 1px 들린다 */
const ID_IN = E({ hx: 0.3, hy: -23.2, tl: -4.5, hd: -4, aFx: 5.2, aFy: 5.2, wa: -152 });
/** 날숨: 어깨가 내려앉고 몸이 조금 앞으로 (무게가 앞발로) */
const ID_OUT = E({ hx: 0.6, hy: -22.1, tl: -1.5, hd: -1, aFx: 5, aFy: 6.6, wa: -148 });

/** 대기: 숨 한 번 (들숨 → 멈춤 → 날숨). 14프레임 70틱 */
export const EDWARD_IDLE: MotionData = {
  name: 'edward/idle',
  label: '에드워드 대기',
  loop: true,
  dur: [5, 5, 5, 5, 6, 6, 5, 5, 5, 5, 5, 5, 4, 4],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 4, pose: ID_IN, stop: true },
    { at: 6, pose: ID_IN },
    { at: 10, pose: ID_OUT, stop: true },
    { at: 14, pose: E_STANCE },
  ],
};

// ---- 걷기: 큰 보폭의 느린 걸음 (두 다리를 번갈아 앞으로 내딛는다) ----
/*
 * 한 바퀴 = 두 걸음, 14프레임. 발 하나는 8프레임 동안 바닥을 딛고(몸이 나아간 만큼 뒤로 밀려 미끄러지지 않는다)
 * 6프레임 동안 들려 앞으로 나간다. 앞다리(밝은 쪽)와 뒷다리(어두운 쪽)는 반 바퀴 어긋난다.
 * 두 발이 다 닿는 순간(내딛는 순간)에 엉덩이가 가장 낮고, 한 발로 설 때 가장 높다 (묵직하게 오르내린다).
 * 해머는 어깨 위에서 걸음마다 한 박자 늦게 흔들리고, 뒷손은 주머니에 넣은 채다.
 */
/** 앞 걷기 한 바퀴 거리 (px): 한 걸음 24px. 능력치 runCycle */
export const E_WALK_F = 48;
/** 뒤 걷기 한 바퀴 거리 (px): 한 걸음 20px. 능력치 runBackCycle */
export const E_WALK_B = 40;
const FRAMES = 14;
const STANCE = 8;

/** 발 하나의 자리 (발밑 기준): 바퀴 속 위치 k (0~13)에서. dir 1 앞으로 걸음, -1 뒤로 걸음 */
function foot(k: number, d: number, dir: number, lift: number, center: number): [number, number] {
  const half = (STANCE / 2) * d;
  if (k < STANCE) return [center + dir * (half - k * d), 0];
  const s = (k - STANCE) / (FRAMES - STANCE);
  const e = s * s * (3 - 2 * s);
  return [center + dir * (-half + 2 * half * e), -lift * Math.sin(Math.PI * s)];
}

function walk(dist: number, dir: number, o: { low: number; high: number; tl: number; hd: number; lift: number; center: number; hx: number }): Key[] {
  const d = dist / FRAMES;
  const keys: Key[] = [];
  for (let i = 0; i <= FRAMES; i++) {
    const k = i % FRAMES;
    const [fx, fy] = foot(k, d, dir, o.lift, o.center);
    const [bx, by] = foot((k + FRAMES / 2) % FRAMES, d, dir, o.lift, o.center);
    // 엉덩이: 두 발이 닿는 순간(0, 7) 가장 낮고, 한 발로 설 때(3.5, 10.5) 가장 높다
    const up = Math.sin((Math.PI * k) / (FRAMES / 2)) ** 2;
    // 해머·몸통은 엉덩이보다 한 박자 늦게 흔들린다
    const lag = Math.sin((Math.PI * (k - 1.5)) / (FRAMES / 2)) ** 2;
    const pose: Pose = E({
      hx: o.hx,
      hy: -(o.low + (o.high - o.low) * up),
      tl: o.tl + 1.2 * (lag - 0.5),
      hd: o.hd - 1.2 * (lag - 0.5),
      aFx: 5,
      aFy: 6.6 - 1.4 * lag,
      wa: -150 + 4 * (lag - 0.5),
      lFx: fx,
      lFy: fy,
      lBx: bx,
      lBy: by,
    });
    keys.push({ at: i, pose });
  }
  return keys;
}

/** 앞 걷기 (sim 자리 run_f): 큰 보폭으로 느긋하게. 14프레임, 표시 틱은 1.7px/틱으로 한 바퀴 48px를 가는 시간 */
export const EDWARD_WALK_F: MotionData = {
  name: 'edward/walk_f',
  label: '에드워드 앞 걷기',
  loop: true,
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: walk(E_WALK_F, 1, { low: 19, high: 21.6, tl: -2.5, hd: -2, lift: 4, center: 0.5, hx: 0.3 }),
};

/** 뒤 걷기 (sim 자리 run_b): 같은 걸음으로 물러난다 (발 디딤은 거꾸로). 몸을 조금 세우고 턱을 든다. 한 바퀴 40px, 1.4px/틱 */
export const EDWARD_WALK_B: MotionData = {
  name: 'edward/walk_b',
  label: '에드워드 뒤 걷기',
  loop: true,
  dur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: walk(E_WALK_B, -1, { low: 19.8, high: 21.8, tl: -4, hd: -3, lift: 3, center: -0.5, hx: -0.3 }),
};

export const EDWARD_MOVE_MOTIONS: readonly MotionData[] = [EDWARD_IDLE, EDWARD_WALK_F, EDWARD_WALK_B];
