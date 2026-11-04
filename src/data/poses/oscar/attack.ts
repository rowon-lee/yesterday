import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { O_STANCE, OD, OR } from './stance';

/*
 * 오스카 평타 11개 (캐릭터 기획서 13장 '베기의 문법'): 작은 몸, 거대한 베기. 몸은 거의 움직이지 않는데 화면이 길게 베인다.
 * 칼을 휘두르지 않는다: 칼자루에 손을 얹고, 칼날이 2~6px만 빠졌다 들어가는(은빛 1틱 반짝) 순간 앞 허공에 긴 베기 선이 한 번에 생긴다.
 * 칼자루가 칼집에 닿는 '탁'에서 1프레임 멈춘다. 판정은 그 선 (data/poses/oscar/slashes, sim/chars/oscar.ts). 선 그림은 렌더.
 * 칸은 128×96 (발밑 64, 93). 박자 (13프레임 26틱): 손을 얹음 2프레임 → 칼날이 비침 1틱 (선이 생김) → '탁' 2프레임 (멈춤)
 * → 그대로 3프레임 (선이 화면을 가르고, 상대가 늦게 맞고, 선이 가루로 흩어진다) → 기본자세 4프레임.
 * 4타만 "반쯤 뽑아 들었다가 납도하는 '탁'에 세 줄".
 */

/**
 * 표준 발도 13프레임: 기본자세 → 손을 얹음(멈칫) → 칼날이 비침(1틱) → '탁'(1프레임 멈춤) → 그대로 → 기본자세.
 * air: 공중 평타 (손을 얹는 멈칫이 한 프레임 짧다. 전에는 프레임 수 12로 알아냈다 — 3-0a에서 프레임 수와 떼어 냄)
 */
function iai(name: string, label: string, p: { from?: Pose; ready: Pose; flick: Pose; click: Pose; still: Pose; end?: Pose }, dur: number[], air = false): MotionData {
  const k = air ? -1 : 0;
  return {
    name,
    label,
    wide: true,
    dur,
    keys: [
      { at: 0, pose: p.from ?? O_STANCE },
      { at: 1, pose: p.ready, stop: true },
      ...(air ? [] : [{ at: 2, pose: p.ready, stop: true }]),
      { at: 3 + k, pose: p.flick },
      { at: 4 + k, pose: p.click, stop: true },
      { at: 5 + k, pose: p.click, stop: true },
      { at: 8 + k, pose: p.still, stop: true },
      { at: dur.length - 1, pose: p.end ?? O_STANCE },
    ],
  };
}

/** 땅 평타 박자 (13프레임 26틱): 칼날이 비치는 3번째(0부터) 프레임 = 4틱째에 선이 생긴다. 판정 3~5번째 프레임 (늦게 맞는 틱까지) */
const QUICK = [1, 2, 1, 1, 2, 2, 2, 3, 3, 3, 2, 2, 2];
/** 띄우기·쓸기: 손을 조금 더 오래 얹는다 */
const HEAVY = [1, 2, 2, 1, 2, 2, 2, 3, 3, 3, 2, 2, 2];

// ---- 1타 칼자루에 손: 몸은 그대로, 엄지로 날밑을 밀어 칼날이 4px 비쳤다 들어간다 ----
export const OSCAR_ATK1 = iai('oscar/atk1', '오스카 1타 (칼자루에 손)', {
  ready: OD({ hy: -21.8, tl: 14, hd: 11, lFx: 6, lBx: -6 }, 0),
  flick: OD({ hx: 0.5, hy: -21.8, tl: 15, hd: 10, lFx: 6.5, lBx: -6, tw: 1 }, 4),
  click: OD({ hy: -21.8, tl: 14, hd: 12, lFx: 6.5, lBx: -6 }, 0),
  still: OD({ hy: -22, tl: 13.5, hd: 13, lFx: 6.5, lBx: -6 }, 0),
}, QUICK);

// ---- 2타 반 걸음 미끄러짐: 앞발이 반 걸음 미끄러지며 칼날이 5px 비친다 (몸 이동 8px) ----
export const OSCAR_ATK2 = iai('oscar/atk2', '오스카 2타 (반 걸음 미끄러짐)', {
  ready: OD({ hx: 0.5, hy: -21.5, tl: 15, hd: 11, lFx: 7, lBx: -7, tw: -1 }, 0),
  flick: OD({ hx: 1.5, hy: -21.3, tl: 16, hd: 10, lFx: 9, lBx: -6, tw: 1 }, 5),
  click: OD({ hx: 1.5, hy: -21.5, tl: 15, hd: 12, lFx: 9, lBx: -6 }, 0),
  still: OD({ hx: 1, hy: -21.8, tl: 14, hd: 13, lFx: 8.5, lBx: -6.5 }, 0),
}, QUICK);

// ---- 3타 몸을 살짝 낮춤: 무릎을 굽혀 엉덩이를 2px 낮추고 칼날이 5px 비친다 ----
export const OSCAR_ATK3 = iai('oscar/atk3', '오스카 3타 (몸을 살짝 낮춤)', {
  ready: OD({ hy: -20.5, tl: 15, hd: 10, lFx: 7, lBx: -8 }, 0),
  flick: OD({ hx: 0.5, hy: -19.8, tl: 17, hd: 9, lFx: 7.5, lBx: -8.5, tw: 1 }, 5),
  click: OD({ hy: -20, tl: 16, hd: 12, lFx: 7.5, lBx: -8.5 }, 0),
  still: OD({ hy: -20.3, tl: 15, hd: 13, lFx: 7.5, lBx: -8 }, 0),
}, QUICK);

// ---- 4타 반쯤 뽑았다 납도: 칼을 반(7px) 뽑아 든 채 멈췄다가, 천천히 밀어 넣어 '탁' 하는 순간 앞 공간이 세 줄로 베인다 ----
const A4_READY = OD({ hy: -21, tl: 15, hd: 9, lFx: 7, lBx: -8 }, 1);
/** 반쯤 뽑아 든다 (칼날에 달빛) */
const A4_HALF = OD({ hx: 1, hy: -20.5, tl: 16, hd: 7, lFx: 8, lBx: -8, tw: 1 }, 7);
/** 밀어 넣는다 */
const A4_IN = OD({ hx: 1, hy: -20.5, tl: 16, hd: 9, lFx: 8, lBx: -8 }, 2);
/** '탁' — 납도하는 순간 (선 세 줄): 고개를 숙인다 */
const A4_CLICK = OD({ hx: 0.5, hy: -21, tl: 15, hd: 14, lFx: 8, lBx: -8 }, 0);
const A4_STILL = OD({ hy: -21.5, tl: 14, hd: 15, lFx: 7.5, lBx: -7.5 }, 0);

/** 4타: 손을 얹음 → 반쯤 뽑아 듦(멈춤) → 밀어 넣음 → '탁'(6번째 프레임 = 10틱, 선 세 줄, 1프레임 멈춤) → 그대로 → 기본자세. 14프레임 30틱 */
export const OSCAR_ATK4: MotionData = {
  name: 'oscar/atk4',
  label: '오스카 4타 (반쯤 뽑았다 납도)',
  wide: true,
  dur: [1, 2, 2, 2, 2, 1, 1, 2, 2, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 1, pose: A4_READY, stop: true },
    { at: 2, pose: A4_HALF },
    { at: 4, pose: A4_HALF, stop: true },
    { at: 5, pose: A4_IN },
    { at: 6, pose: A4_CLICK, stop: true },
    { at: 7, pose: A4_CLICK, stop: true },
    { at: 9, pose: A4_STILL, stop: true },
    { at: 13, pose: O_STANCE },
  ],
};

// ---- 띄우기 (↑+공격) 위를 올려봄: 고개를 들어 위를 보는 순간 아래에서 위로 세로 선 ----
export const OSCAR_LAUNCHER = iai('oscar/launcher', '오스카 띄우기 (위를 올려봄)', {
  ready: OD({ hy: -21.5, tl: 12, hd: 4, lFx: 6, lBx: -6 }, 0),
  flick: OD({ hx: 0.5, hy: -22.5, tl: 6, hd: -14, lFx: 6, lBx: -6, tw: 1 }, 4),
  click: OD({ hy: -22.3, tl: 7, hd: -12, lFx: 6, lBx: -6 }, 0),
  still: OD({ hy: -22.2, tl: 9, hd: -8, lFx: 6, lBx: -6 }, 0),
}, HEAVY);

// ---- 쓸기 (↓+공격) 낮게: 낮게 웅크린 채 칼날이 비치는 순간 바닥에 붙은 가로 선 (물이 갈라진다) ----
export const OSCAR_SWEEP = iai('oscar/sweep', '오스카 쓸기 (낮게)', {
  ready: OD({ hy: -19, tl: 20, hd: 10, lFx: 8, lBx: -9 }, 0),
  flick: OD({ hx: 1, hy: -16.5, tl: 26, hd: 6, lFx: 11, lBx: -10, tw: 1 }, 5),
  click: OD({ hx: 1, hy: -16.8, tl: 25, hd: 10, lFx: 11, lBx: -10 }, 0),
  still: OD({ hx: 0.5, hy: -17.5, tl: 23, hd: 12, lFx: 10.5, lBx: -10 }, 0),
}, HEAVY);

// ---- 대시 공격: 월영(그림자 대시)으로 미끄러지다 앞발로 멈추며 칼날이 비친다. 지나온 길 앞을 길게 ----
/** 미끄러지는 자세 (대시와 같은 꼴): 깊이 숙여 두 발을 끈다, 엄지는 날밑에 */
const DA_GLIDE = OD({ hx: 3, hy: -18, tl: 34, hd: 4, lFx: 4, lBx: -10, lBy: -2 }, 2);
/** 대시 공격: 미끄러짐(0~2) → 앞발로 멈추며 칼날이 비침(3번째 프레임, 선) → '탁' 멈춤 → 그대로 → 기본자세. 13프레임 */
export const OSCAR_DASH_ATTACK: MotionData = {
  name: 'oscar/dash_attack',
  label: '오스카 대시 공격 (월영 베기)',
  wide: true,
  dur: [1, 1, 2, 1, 2, 2, 2, 3, 3, 3, 2, 2, 2],
  keys: [
    { at: 0, pose: DA_GLIDE },
    { at: 2, pose: DA_GLIDE },
    { at: 3, pose: OD({ hx: 3, hy: -19, tl: 24, hd: 6, lFx: 10, lBx: -10, tw: 1 }, 6) },
    { at: 4, pose: OD({ hx: 2.5, hy: -19.5, tl: 20, hd: 11, lFx: 10, lBx: -10 }, 0), stop: true },
    { at: 5, pose: OD({ hx: 2.5, hy: -19.5, tl: 20, hd: 11, lFx: 10, lBx: -10 }, 0), stop: true },
    { at: 8, pose: OD({ hx: 2, hy: -20, tl: 18, hd: 12, lFx: 9.5, lBx: -9.5 }, 0), stop: true },
    { at: 12, pose: O_STANCE },
  ],
};

// ---- 공중 1·2·3타: 공중에서 몸을 비틀며 칼날이 비친다 ----
/** 공중 기본: 다리를 가볍게 접은 자세 (점프 꼭대기와 같은 꼴), 엄지는 날밑에 */
const AIR = { hy: -25, tl: 14, hd: 14, lFx: 5, lFy: -8, lBx: -1, lBy: -6 } as const;
const AIR_END = OR({ hy: -25, tl: 13, hd: 12, lFx: 5, lFy: -8, lBx: -1, lBy: -6 });

/** 공중 박자 (12프레임 20틱): 칼날이 비치는 2번째 프레임 = 2틱째에 선. 판정 2~4번째 프레임 */
const AIR_QUICK = [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];

export const OSCAR_AIR1 = iai('oscar/air1', '오스카 공중 1타', {
  from: AIR_END,
  ready: OD({ ...AIR, tw: -1 }, 0),
  flick: OD({ ...AIR, hx: 1, tl: 18, hd: 12, tw: 2 }, 4),
  click: OD({ ...AIR, hx: 1, tl: 17, hd: 13, tw: 1 }, 0),
  still: OD({ ...AIR, hx: 0.5, tl: 16, hd: 13 }, 0),
  end: AIR_END,
}, AIR_QUICK, true);

export const OSCAR_AIR2 = iai('oscar/air2', '오스카 공중 2타', {
  from: AIR_END,
  ready: OD({ ...AIR, tw: 1 }, 0),
  flick: OD({ ...AIR, hx: 1, tl: 10, hd: 8, lFx: 7, lFy: -6, tw: -2 }, 5),
  click: OD({ ...AIR, tl: 11, hd: 12, lFx: 7, lFy: -6 }, 0),
  still: OD({ ...AIR, tl: 12, hd: 12, lFx: 6, lFy: -7 }, 0),
  end: AIR_END,
}, AIR_QUICK, true);

/** 공중 3타: 한 번 크게 비틀며 X자 두 줄 */
export const OSCAR_AIR3 = iai('oscar/air3', '오스카 공중 3타 (X자)', {
  from: AIR_END,
  ready: OD({ ...AIR, hx: -0.5, tl: 10, hd: 16, tw: -2 }, 1),
  flick: OD({ ...AIR, hx: 1.5, tl: 20, hd: 8, lFx: 7, lFy: -5, lBx: -4, lBy: -4, tw: 3 }, 6),
  click: OD({ ...AIR, hx: 1, tl: 18, hd: 12, lFx: 7, lFy: -5, lBx: -4, lBy: -4 }, 0),
  still: OD({ ...AIR, hx: 0.5, tl: 16, hd: 13, lFx: 6, lFy: -6, lBx: -3, lBy: -5 }, 0),
  end: AIR_END,
}, AIR_QUICK, true);

// ---- 내려찍기 (공중 ↓+공격) 내려다봄: 발밑을 내려다보는 순간 위에서 아래로 세로 선이 바닥까지 갈라진다 ----
export const OSCAR_SLAM = iai('oscar/slam', '오스카 내려찍기 (내려다봄)', {
  from: AIR_END,
  ready: OD({ hy: -25, tl: 22, hd: 26, lFx: 4, lFy: -6, lBx: -3, lBy: -5 }, 0),
  flick: OD({ hx: 0.5, hy: -25, tl: 28, hd: 30, lFx: 4, lFy: -5, lBx: -3, lBy: -5, tw: 1 }, 5),
  click: OD({ hy: -25, tl: 26, hd: 28, lFx: 4, lFy: -5, lBx: -3, lBy: -5 }, 0),
  still: OD({ hy: -25, tl: 24, hd: 24, lFx: 4, lFy: -6, lBx: -3, lBy: -5 }, 0),
  end: AIR_END,
}, QUICK);

export const OSCAR_ATTACK_MOTIONS: readonly MotionData[] = [
  OSCAR_ATK1, OSCAR_ATK2, OSCAR_ATK3, OSCAR_ATK4, OSCAR_LAUNCHER, OSCAR_SWEEP, OSCAR_DASH_ATTACK,
  OSCAR_AIR1, OSCAR_AIR2, OSCAR_AIR3, OSCAR_SLAM,
];
