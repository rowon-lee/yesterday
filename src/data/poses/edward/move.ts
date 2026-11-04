import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import type { Key } from '../../../anim/keyed';
import { E, E_SCALE, E_STANCE } from './stance';

/*
 * 에드워드 대기·걷기 (캐릭터 기획서 '움직임': 해머를 어깨에 걸친 채 여유롭게 걷는 가주. 걸음은 느리고 보폭이 크다).
 */

// ---- 대기 (2026-11-02 피드백 12-4): 가슴을 펴고 턱을 든 당당한 자세, 해머는 오른쪽(앞) 어깨, 왼손(뒷손)은 바지 주머니 ----
// 아주 느린 숨 (한 바퀴 120틱), 숨 끝에 해머 자루로 어깨를 한 번 툭 (들었다 떨어뜨린다).
// 어깨 위 해머는 몸보다 한 박자 늦게 따라간다 (가슴이 부푼 다음 프레임에 머리가 들리고, 어깨가 내려앉은 다음 프레임에 머리가 내려앉는다)
/** 들숨: 가슴이 부풀기 시작한다 (해머는 아직 그대로) */
const ID_IN1 = E({ hx: 0.1, hy: -23, tl: -5, hd: -5, aFx: 4.5, aFy: 6, wa: -148 });
/** 다 들이쉼: 가슴을 펴고 턱을 든다 */
const ID_IN2 = E({ hx: 0.2, hy: -23.6, tl: -6.2, hd: -6.5, aFx: 4.6, aFy: 5.4, wa: -146 });
/** 해머 머리가 늦게 들린다 */
const ID_IN3 = E({ hx: 0.2, hy: -23.5, tl: -5.9, hd: -7.2, aFx: 4.6, aFy: 5.3, wa: -142 });
/** 날숨: 어깨가 내려앉는다 */
const ID_OUT1 = E({ hx: 0.25, hy: -22.6, tl: -4.2, hd: -5, aFx: 4.5, aFy: 6.4, wa: -143 });
const ID_OUT2 = E({ hx: 0.3, hy: -21.9, tl: -3.2, hd: -3.4, aFx: 4.5, aFy: 7, wa: -147 });
/** 해머 머리가 늦게 내려앉는다 */
const ID_OUT3 = E({ hx: 0.3, hy: -22, tl: -3.3, hd: -3.1, aFx: 4.5, aFy: 7.1, wa: -152 });
/** 해머로 어깨 툭: 앞손이 자루를 들어 올린다 (해머는 손과 함께 통째로 뜬다) */
const ID_TAP_UP = E({ hx: 0.3, hy: -22.4, tl: -4, hd: -4, aFx: 5, aFy: 4.2, wa: -149 });
/** 손이 먼저 내려오고 몸이 받아 내려앉는다. 해머 머리는 아직 허공에 들린 채 (손보다 늦다) */
const ID_TAP_DOWN = E({ hx: 0.2, hy: -21.7, tl: -3.5, hd: -4.5, aFx: 4.6, aFy: 7, wa: -137 });
/** 해머 머리가 늦게 떨어져 어깨에 쿵 걸친다 (한 번 더 눌렸다 돌아온다) */
const ID_TAP_BOUNCE = E({ hx: 0.1, hy: -22.2, tl: -3.8, hd: -4.2, aFx: 4.5, aFy: 6.7, wa: -156 });

/** 대기 (2차 리워크): 들숨(가슴 → 늦게 해머) → 날숨(어깨 → 늦게 해머) → 해머로 어깨 툭(손 → 늦게 해머 머리) → 자리 잡음. 10프레임 120틱 (같은 자세를 늘어놓지 않고 dur로 쉰다) */
export const EDWARD_IDLE: MotionData = {
  name: 'edward/idle',
  label: '에드워드 대기',
  loop: true,
  dur: [16, 14, 16, 8, 12, 16, 10, 6, 4, 18],
  keys: [
    { at: 0, pose: E_STANCE },
    { at: 1, pose: ID_IN1 },
    { at: 2, pose: ID_IN2, stop: true },
    { at: 3, pose: ID_IN3 },
    { at: 4, pose: ID_OUT1 },
    { at: 5, pose: ID_OUT2, stop: true },
    { at: 6, pose: ID_OUT3 },
    { at: 7, pose: ID_TAP_UP },
    { at: 8, pose: ID_TAP_DOWN, stop: true },
    { at: 9, pose: ID_TAP_BOUNCE },
    { at: 10, pose: E_STANCE },
  ],
};

// ---- 걷기 (2026-11-02 피드백 12-4): 보폭 24px의 느린 걸음, 한 바퀴(두 걸음) 약 70틱 ----
/*
 * 한 바퀴 = 두 걸음, 14프레임. 발 하나는 10프레임 동안 바닥을 딛고(몸이 나아간 만큼 뒤로 밀려 미끄러지지 않는다)
 * 4프레임 만에 들려 앞으로 나간다 (2차 리워크: 오래 디디고 무겁게 한 번에 옮긴다, 두 발이 함께 딛는 때가 길다). 내딛는 발은 무릎을 펴 발뒤꿈치부터 닿는다. 디디는 순간 엉덩이가 2px 내려앉고 (묵직하게),
 * 어깨와 해머는 걸음과 반대 방향으로 흔들린다 (앞발이 나가면 앞어깨가 뒤로). 뒷손은 주머니에 넣은 채다.
 */
/** 앞 걷기 한 바퀴 거리 (px, 그림): 한 걸음 24px. 능력치 runCycle (포즈는 배율로 나눠 적는다) */
export const E_WALK_F = 48;
/** 뒤 걷기 한 바퀴 거리 (px, 그림): 한 걸음 16px. 능력치 runBackCycle */
export const E_WALK_B = 32;
const FRAMES = 14;
const STANCE = 10;

/** 발 하나의 자리 (발밑 기준, 포즈 단위): 바퀴 속 위치 k (0~13)에서. dir 1 앞으로 걸음, -1 뒤로 걸음 */
function foot(k: number, d: number, dir: number, lift: number, center: number): [number, number] {
  const half = (STANCE / 2) * d;
  if (k < STANCE) return [center + dir * (half - k * d), 0];
  const s = (k - STANCE) / (FRAMES - STANCE);
  const e = s * s * (3 - 2 * s);
  return [center + dir * (-half + 2 * half * e), -lift * Math.sin(Math.PI * s)];
}

function walk(dist: number, dir: number, o: { low: number; high: number; tl: number; hd: number; lift: number; center: number; hx: number; sway: number }): Key[] {
  // 그림 거리 → 포즈 단위 (몸 배율로 나눈다: 그려진 발이 그림 거리만큼 디딘다)
  const d = dist / E_SCALE / FRAMES;
  const keys: Key[] = [];
  for (let i = 0; i <= FRAMES; i++) {
    const k = i % FRAMES;
    const [fx, fy] = foot(k, d, dir, o.lift, o.center);
    const [bx, by] = foot((k + FRAMES / 2) % FRAMES, d, dir, o.lift, o.center);
    // 엉덩이: 두 발이 닿는 순간(0, 7) 가장 낮고 (2px 내려앉음), 한 발로 설 때(3.5, 10.5) 가장 높다
    const up = Math.sin((Math.PI * k) / (FRAMES / 2)) ** 2;
    // 어깨·해머: 걸음과 반대로 흔들린다 (앞발이 앞이면 앞어깨가 뒤로), 몸통보다 한 박자 늦게
    const sw = Math.cos((2 * Math.PI * (k - 1)) / FRAMES);
    // 해머 머리는 어깨보다 두 박자 더 늦게 흔들린다 (무게, 2차 리워크)
    const swH = Math.cos((2 * Math.PI * (k - 3)) / FRAMES);
    const pose: Pose = E({
      hx: o.hx,
      hy: -(o.low + (o.high - o.low) * up),
      tl: o.tl,
      hd: o.hd,
      tw: 1.5 - o.sway * sw,
      aFx: 4.5,
      aFy: 6.5 + 0.6 * (1 - up),
      wa: -148 + 5 * swH,
      lFx: fx,
      lFy: fy,
      lBx: bx,
      lBy: by,
    });
    keys.push({ at: i, pose });
  }
  return keys;
}

/** 앞 걷기 (sim 자리 run_f): 보폭 24px로 느긋하게, 발뒤꿈치부터. 14프레임 70틱 (0.7px/틱으로 한 바퀴 48px) */
export const EDWARD_WALK_F: MotionData = {
  name: 'edward/walk_f',
  label: '에드워드 앞 걷기',
  loop: true,
  dur: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  keys: walk(E_WALK_F, 1, { low: 19.6, high: 21.4, tl: -3.5, hd: -4, lift: 4, center: 0.5, hx: 0.3, sway: 2.5 }),
};

/** 뒤 걷기 (sim 자리 run_b): 몸을 돌리지 않고 상대를 본 채 천천히 물러난다 (보폭 16px). 14프레임 64틱 (0.5px/틱으로 한 바퀴 32px) */
export const EDWARD_WALK_B: MotionData = {
  name: 'edward/walk_b',
  label: '에드워드 뒤 걷기',
  loop: true,
  dur: [5, 5, 5, 4, 5, 5, 4, 5, 5, 4, 5, 5, 4, 3],
  keys: walk(E_WALK_B, -1, { low: 20.2, high: 21.6, tl: -5, hd: -5, lift: 3, center: -0.5, hx: -0.3, sway: 1.5 }),
};

export const EDWARD_MOVE_MOTIONS: readonly MotionData[] = [EDWARD_IDLE, EDWARD_WALK_F, EDWARD_WALK_B];
