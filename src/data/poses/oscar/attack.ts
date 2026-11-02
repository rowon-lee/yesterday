import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { O_STANCE, OD, OR } from './stance';

/*
 * 오스카 평타 11개 (캐릭터 기획서 '평타', 동작연출지침서 7장 오스카: 몸은 거의 안 움직이고 앞 허공에 검격이 생긴다. 리치는 검격 위치).
 * 칼을 휘두르지 않는다. 뒷손으로 칼집 입구를 잡고(엄지로 날밑을 밀고) 앞손으로 칼을 살짝 뽑았다가 '탁' 납도하는 짧은 동작뿐이고,
 * 판정은 앞쪽 허공에 생겨난 검격 자리 (data/characters/oscar.ts의 궤적 상자, boxOnly). 검격 그림은 렌더 (render/chars/oscar.ts).
 * 칸은 128×96 (발밑 64, 93). 박자: 감기 1~2프레임(엄지로 날밑 밀기, 마지막 멈칫) → 섬광 1프레임(칼이 뽑힘) → 판정 2프레임 →
 * 여운 3프레임(뽑은 채 멈춤) → 납도 '탁' 1프레임 → 복귀 3프레임. 4타만 "지나치며 뽑고, 납도하는 순간 베인다".
 */

/** 표준 발도 13프레임: 기본자세 → 날밑 밀기(멈칫) → 섬광(뽑음) → 판정 → 여운 → 납도 '탁'(멈칫) → 기본자세 */
function iai(name: string, label: string, p: { from?: Pose; ready: Pose; draw: Pose; hit: Pose; hold: Pose; click: Pose; end?: Pose }, dur: number[]): MotionData {
  return {
    name,
    label,
    wide: true,
    dur,
    keys: [
      { at: 0, pose: p.from ?? O_STANCE },
      { at: 1, pose: p.ready, stop: true },
      { at: 2, pose: p.draw },
      { at: 3, pose: p.hit },
      { at: 5, pose: p.hold },
      { at: 8, pose: p.hold, stop: true },
      { at: 9, pose: p.click, stop: true },
      { at: dur.length - 1, pose: p.end ?? O_STANCE },
    ],
  };
}

/** 빠른 평타 박자 (13프레임, 26틱): 판정 3·4번째 (0부터) 프레임 = 4~6틱 */
const QUICK = [1, 2, 1, 2, 1, 1, 3, 3, 4, 2, 2, 2, 2];

// ---- 1타: 날밑 밀기 — 엄지로 날밑을 튕겨 칼날이 한 뼘 비치는 순간, 가슴 높이에 가로 검격 ----
export const OSCAR_ATK1 = iai('oscar/atk1', '오스카 1타 (날밑 밀기)', {
  ready: OD({ hy: -21, tl: 15, hd: 10, lFx: 7, lBx: -7 }, 2),
  draw: OD({ hx: 2, hy: -20.5, tl: 18, hd: 8, lFx: 9, lBx: -7, tw: 2 }, 6),
  hit: OD({ hx: 2.5, hy: -20.5, tl: 19, hd: 8, lFx: 9.5, lBx: -7, tw: 2 }, 6),
  hold: OD({ hx: 2.5, hy: -20.5, tl: 19, hd: 9, lFx: 9.5, lBx: -7, tw: 1 }, 6),
  click: OD({ hx: 2, hy: -21, tl: 16, hd: 11, lFx: 9, lBx: -7 }, 0),
}, QUICK);

// ---- 2타: 반 발 내딛어 뽑기 — 앞발을 반 발 내딛으며 어깨를 틀어 9px 뽑는다. 아래에서 위로 비스듬히 ----
export const OSCAR_ATK2 = iai('oscar/atk2', '오스카 2타 (반 발 뽑기)', {
  ready: OD({ hx: 0.5, hy: -20.5, tl: 16, hd: 10, lFx: 8, lBx: -8, tw: -1 }, 3),
  draw: OD({ hx: 3.5, hy: -20, tl: 21, hd: 7, lFx: 13, lBx: -8, tw: 3 }, 9),
  hit: OD({ hx: 4, hy: -20, tl: 22, hd: 7, lFx: 13, lBx: -8, tw: 3 }, 9),
  hold: OD({ hx: 4, hy: -20, tl: 22, hd: 8, lFx: 13, lBx: -8, tw: 2 }, 9),
  click: OD({ hx: 3, hy: -20.5, tl: 18, hd: 11, lFx: 12, lBx: -8 }, 0),
}, QUICK);

// ---- 3타: 몸을 낮춰 뽑기 — 무릎을 굽혀 엉덩이를 3.5px 낮추고 11px 뽑는다. X자 두 줄 ----
export const OSCAR_ATK3 = iai('oscar/atk3', '오스카 3타 (낮춰 뽑기)', {
  ready: OD({ hx: -0.5, hy: -20, tl: 14, hd: 10, lFx: 8, lBx: -9 }, 3),
  draw: OD({ hx: 3, hy: -18.5, tl: 24, hd: 6, lFx: 13, lBx: -10, tw: 3 }, 11),
  hit: OD({ hx: 3.5, hy: -18.5, tl: 25, hd: 6, lFx: 13, lBx: -10, tw: 3 }, 11),
  hold: OD({ hx: 3.5, hy: -18.5, tl: 25, hd: 7, lFx: 13, lBx: -10, tw: 2 }, 11),
  click: OD({ hx: 2, hy: -20, tl: 18, hd: 11, lFx: 11, lBx: -9 }, 0),
}, QUICK);

// ---- 4타: 지나치며 뽑고 납도 — 크게 한 발 파고들며 칼을 다 뽑았다가, 천천히 칼집에 밀어 넣어 '탁' 하는 순간 앞 허공이 세 줄로 베인다 ----
/** 웅크려 엄지로 날밑을 민다 (멈칫) */
const A4_READY = OD({ hx: -1, hy: -19, tl: 20, hd: 8, lFx: 9, lBx: -10 }, 2);
/** 크게 파고든다: 발 간격 30px, 엉덩이 5px 낮게, 몸통 30°, 칼날 12px (섬광) */
const A4_LUNGE = OD({ hx: 6, hy: -17, tl: 30, hd: 2, lFx: 18, lBx: -12, tw: 3 }, 12);
/** 다 뽑아 멈춘다 (칼날 14px) */
const A4_DRAWN = OD({ hx: 7, hy: -17, tl: 31, hd: 2, lFx: 18, lBx: -12, tw: 4 }, 14);
/** 천천히 밀어 넣는다 */
const A4_SHEATHE = OD({ hx: 6.5, hy: -17.5, tl: 29, hd: 6, lFx: 18, lBx: -12, tw: 2 }, 6);
/** '탁' — 납도하는 순간 (판정): 고개를 숙이고 등을 조금 편다 */
const A4_CLICK = OD({ hx: 6, hy: -18, tl: 26, hd: 12, lFx: 17, lBx: -12 }, 0);
/** 베인 뒤 가만히 선다 */
const A4_STILL = OD({ hx: 5.5, hy: -18.5, tl: 24, hd: 14, lFx: 17, lBx: -12 }, 0);

/** 4타: 웅크림 → 파고들며 뽑음(섬광) → 다 뽑아 멈춤 → 천천히 밀어 넣음 → '탁'(판정 8·9번째 프레임) → 가만히 → 기본자세. 14프레임 31틱 */
export const OSCAR_ATK4: MotionData = {
  name: 'oscar/atk4',
  label: '오스카 4타 (지나치며 납도)',
  wide: true,
  dur: [1, 2, 1, 2, 3, 2, 2, 2, 1, 4, 3, 3, 2, 3],
  keys: [
    { at: 0, pose: O_STANCE },
    { at: 1, pose: A4_READY, stop: true },
    { at: 2, pose: A4_LUNGE },
    { at: 3, pose: A4_DRAWN },
    { at: 4, pose: A4_DRAWN, stop: true },
    { at: 6, pose: A4_SHEATHE },
    { at: 7, pose: A4_CLICK, stop: true },
    { at: 9, pose: A4_STILL, stop: true },
    { at: 11, pose: OR({ hx: 3, lFx: 12, lBx: -8 }) },
    { at: 13, pose: O_STANCE },
  ],
};

// ---- 띄우기 (↑+공격): 발끝으로 일어서며 칼자루를 위로 치켜 뽑는다. 땅에서 하늘로 곧은 검격 ----
export const OSCAR_LAUNCHER = iai('oscar/launcher', '오스카 띄우기 (치켜 뽑기)', {
  ready: OD({ hy: -19.5, tl: 18, hd: 12, lFx: 8, lBx: -8 }, 2),
  draw: OD({ hx: 2, hy: -24, tl: 2, hd: -14, lFx: 7, lFy: -2, lBx: -6, tw: 2 }, 10),
  hit: OD({ hx: 2, hy: -24.5, tl: 0, hd: -16, lFx: 7, lFy: -2, lBx: -6, tw: 2 }, 10),
  hold: OD({ hx: 2, hy: -24.5, tl: 0, hd: -16, lFx: 7, lFy: -2, lBx: -6, tw: 1 }, 10),
  click: OD({ hx: 1, hy: -22, tl: 10, hd: 4, lFx: 7, lBx: -7 }, 0),
}, [1, 2, 1, 2, 2, 1, 3, 3, 4, 2, 2, 2, 2]);

// ---- 쓸기 (↓+공격): 깊이 웅크려 발을 넓게 벌리고 뽑는다. 바닥을 가로로 낮게 베는 검격 ----
export const OSCAR_SWEEP = iai('oscar/sweep', '오스카 쓸기 (웅크려 뽑기)', {
  ready: OD({ hy: -18, tl: 24, hd: 8, lFx: 9, lBx: -9 }, 2),
  draw: OD({ hx: 3, hy: -13, tl: 38, hd: -4, lFx: 16, lBx: -12, tw: 2 }, 8),
  hit: OD({ hx: 3.5, hy: -13, tl: 39, hd: -4, lFx: 16, lBx: -12, tw: 2 }, 8),
  hold: OD({ hx: 3.5, hy: -13, tl: 39, hd: -2, lFx: 16, lBx: -12, tw: 1 }, 8),
  click: OD({ hx: 2, hy: -15.5, tl: 32, hd: 4, lFx: 15, lBx: -12 }, 0),
}, [1, 2, 1, 2, 2, 1, 3, 3, 4, 2, 2, 2, 2]);

// ---- 대시 공격: 월영(그림자 대시)으로 미끄러지며 그대로 뽑는다. 지나간 길 앞을 길게 ----
/** 미끄러지는 자세 (대시와 같은 꼴): 깊이 숙여 두 발을 끈다, 엄지는 날밑에 */
const DA_GLIDE = OD({ hx: 3, hy: -18, tl: 34, hd: 4, lFx: 4, lBx: -10, lBy: -2 }, 2);
/** 앞발로 바닥을 짚으며 뽑는다 (섬광) */
const DA_DRAW = OD({ hx: 6, hy: -18, tl: 30, hd: 4, lFx: 16, lBx: -13, tw: 3 }, 12);
/** 대시 공격: 미끄러짐(0~2) → 앞발로 짚으며 뽑음(판정 3·4번째 프레임) → 여운 → 납도 → 기본자세. 13프레임 */
export const OSCAR_DASH_ATTACK: MotionData = {
  name: 'oscar/dash_attack',
  label: '오스카 대시 공격 (월영 베기)',
  wide: true,
  dur: [1, 1, 1, 2, 1, 1, 3, 3, 4, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: DA_GLIDE },
    { at: 2, pose: DA_GLIDE },
    { at: 3, pose: DA_DRAW },
    { at: 5, pose: OD({ hx: 6.5, hy: -18, tl: 31, hd: 5, lFx: 16, lBx: -13, tw: 2 }, 12) },
    { at: 8, pose: OD({ hx: 6.5, hy: -18.5, tl: 30, hd: 6, lFx: 16, lBx: -13, tw: 1 }, 12), stop: true },
    { at: 9, pose: OD({ hx: 5, hy: -19.5, tl: 22, hd: 11, lFx: 14, lBx: -11 }, 0), stop: true },
    { at: 12, pose: O_STANCE },
  ],
};

// ---- 공중 1·2·3타: 공중에서 다리를 가볍게 접은 채 뽑는다 ----
/** 공중 기본: 다리를 가볍게 접은 자세 (점프 꼭대기와 같은 꼴), 엄지는 날밑에 */
const AIR = { hy: -25, tl: 14, hd: 14, lFx: 5, lFy: -8, lBx: -1, lBy: -6 } as const;
const AIR_END = OR({ hy: -25, tl: 13, hd: 12, lFx: 5, lFy: -8, lBx: -1, lBy: -6 });

/** 공중 박자 (12프레임): 판정 3·4번째 프레임 = 3~5틱 */
const AIR_QUICK = [1, 1, 1, 2, 1, 1, 3, 3, 2, 2, 2, 2];

export const OSCAR_AIR1 = iai('oscar/air1', '오스카 공중 1타', {
  from: AIR_END,
  ready: OD({ ...AIR }, 2),
  draw: OD({ ...AIR, hx: 1.5, tl: 22, hd: 12, lFx: 6, lFy: -7, lBx: -2, lBy: -7, tw: 2 }, 7),
  hit: OD({ ...AIR, hx: 2, tl: 23, hd: 12, lFx: 6, lFy: -7, lBx: -2, lBy: -7, tw: 2 }, 7),
  hold: OD({ ...AIR, hx: 2, tl: 23, hd: 13, lFx: 6, lFy: -7, lBx: -2, lBy: -7, tw: 1 }, 7),
  click: OD({ ...AIR, hx: 1, tl: 18, hd: 13 }, 0),
  end: AIR_END,
}, AIR_QUICK);

export const OSCAR_AIR2 = iai('oscar/air2', '오스카 공중 2타', {
  from: AIR_END,
  ready: OD({ ...AIR, tw: -1 }, 3),
  draw: OD({ ...AIR, hx: 2, tl: 18, hd: 8, lFx: 8, lFy: -6, lBx: -3, lBy: -5, tw: 3 }, 10),
  hit: OD({ ...AIR, hx: 2.5, tl: 19, hd: 8, lFx: 8, lFy: -6, lBx: -3, lBy: -5, tw: 3 }, 10),
  hold: OD({ ...AIR, hx: 2.5, tl: 19, hd: 9, lFx: 8, lFy: -6, lBx: -3, lBy: -5, tw: 2 }, 10),
  click: OD({ ...AIR, hx: 1, tl: 15, hd: 12 }, 0),
  end: AIR_END,
}, AIR_QUICK);

/** 공중 3타: 몸을 한 번 크게 비틀며 다 뽑는다 (사방으로 네 줄) */
export const OSCAR_AIR3 = iai('oscar/air3', '오스카 공중 3타 (꽃잎 베기)', {
  from: AIR_END,
  ready: OD({ ...AIR, hx: -1, tl: 8, hd: 16, lFx: 3, lFy: -10, lBx: -3, lBy: -8, tw: -2 }, 3),
  draw: OD({ ...AIR, hx: 2.5, tl: 26, hd: 6, lFx: 9, lFy: -4, lBx: -6, lBy: -3, tw: 4 }, 13),
  hit: OD({ ...AIR, hx: 3, tl: 27, hd: 6, lFx: 9, lFy: -4, lBx: -6, lBy: -3, tw: 4 }, 13),
  hold: OD({ ...AIR, hx: 3, tl: 26, hd: 8, lFx: 9, lFy: -4, lBx: -6, lBy: -3, tw: 3 }, 13),
  click: OD({ ...AIR, hx: 1, tl: 16, hd: 12 }, 0),
  end: AIR_END,
}, [1, 2, 1, 2, 2, 1, 3, 3, 4, 2, 2, 2, 2]);

// ---- 내려찍기 (공중 ↓+공격): 발밑을 내려다보며 뽑는다. 발밑 아래로 곧은 검격 (맞으면 바닥으로 내리꽂힘) ----
export const OSCAR_SLAM = iai('oscar/slam', '오스카 내려찍기 (내려다보며 뽑기)', {
  from: AIR_END,
  ready: OD({ hy: -25, tl: 30, hd: 30, lFx: 4, lFy: -6, lBx: -3, lBy: -5 }, 2),
  draw: OD({ hx: 1, hy: -24, tl: 40, hd: 28, lFx: 3, lFy: -4, lBx: -4, lBy: -4, tw: 2 }, 11),
  hit: OD({ hx: 1, hy: -24, tl: 41, hd: 28, lFx: 3, lFy: -4, lBx: -4, lBy: -4, tw: 2 }, 11),
  hold: OD({ hx: 1, hy: -24, tl: 40, hd: 26, lFx: 3, lFy: -4, lBx: -4, lBy: -4, tw: 1 }, 11),
  click: OD({ hx: 0, hy: -25, tl: 26, hd: 18, lFx: 4, lFy: -6, lBx: -2, lBy: -5 }, 0),
  end: AIR_END,
}, [1, 2, 1, 2, 2, 1, 3, 3, 4, 2, 2, 2, 2]);

export const OSCAR_ATTACK_MOTIONS: readonly MotionData[] = [
  OSCAR_ATK1, OSCAR_ATK2, OSCAR_ATK3, OSCAR_ATK4, OSCAR_LAUNCHER, OSCAR_SWEEP, OSCAR_DASH_ATTACK,
  OSCAR_AIR1, OSCAR_AIR2, OSCAR_AIR3, OSCAR_SLAM,
];
