import type { MotionData } from '../../../anim/motion';
import type { Pose } from '../../../anim/pose';
import { R } from './stance';

/*
 * 라이덴 벽 기동 (캐릭터 기획서 '움직임': 벽은 걸어차듯 딛는다).
 * 기본 스틱맨 벽 기동과 같은 sim 규칙·프레임 구조를 쓴다 (벽 붙기 5번째 프레임부터 되풀이, 벽 달리기 11번째 프레임부터 꼭대기 넘기).
 * 벽에 붙으면 벽을 등지고 바깥을 본다: 벽 면은 발밑 기준점에서 뒤로 7px. 벽 달리기는 벽을 바라본다 (벽은 앞으로 7px).
 * 발은 벽을 '딛는' 게 아니라 발바닥으로 걷어차듯 꽂고, 손 하나는 늘 얼굴 앞 가드에 둔다.
 */

/** 몸 전체를 엉덩이를 중심으로 돌린다 (공중제비). 손 목표는 어깨 기준이라 같이 돌리고, 발은 엉덩이 둘레로 돌린다 */
function spin(p: Pose, deg: number): Pose {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const rot = (x: number, y: number): [number, number] => [x * c - y * s, x * s + y * c];
  const [aFx, aFy] = rot(p.aFx, p.aFy);
  const [aBx, aBy] = rot(p.aBx, p.aBy);
  const [fx, fy] = rot(p.lFx - p.hx, p.lFy - p.hy);
  const [bx, by] = rot(p.lBx - p.hx, p.lBy - p.hy);
  return { ...p, tl: p.tl + deg, aFx, aFy, aBx, aBy, lFx: p.hx + fx, lFy: p.hy + fy, lBx: p.hx + bx, lBy: p.hy + by };
}

// ---- 벽 붙기 (벽은 뒤 x = -7) ----
/** 등이 벽에 부딪힌다: 뒷발바닥을 벽에 걷어차듯 꽂고, 몸이 벽 쪽으로 젖혀진다. 앞손은 가드, 뒷손은 벽을 친다 */
const CL_HIT = R({ hx: -1, hy: -24, tl: 0, hd: 2, aFx: 11, aFy: -6, aBx: -7, aBy: 0, lFx: 7, lFy: -4, lBx: -7, lBy: -10 });
/** 꽂은 다리로 충격을 받아 웅크린다 (멈칫): 무릎이 접히고 턱을 당긴다 */
const CL_SQUASH = R({ hx: -2, hy: -21, tl: 18, hd: 12, aFx: 11, aFy: -3, aBx: -8, aBy: 1, lFx: 6, lFy: -1, lBx: -7, lBy: -9 });
/** 붙은 자세: 벽을 등지고 뒷발바닥·뒷손으로 벽을 짚고, 앞손은 얼굴 앞 가드, 앞다리는 아래로 늘어뜨려 차기 준비 */
const CL_HOLD = R({ hx: -2, hy: -22, tl: 15, hd: 10, aFx: 11, aFy: -4, aBx: -9, aBy: -3, lFx: 5, lFy: -2, lBx: -7, lBy: -11 });
/** 미끄러지며 뒷발이 벽을 긁고 내려간다 */
const CL_DRAG = R({ hx: -2, hy: -21, tl: 17, hd: 12, aFx: 11, aFy: -3, aBx: -9, aBy: 1, lFx: 6, lFy: -1, lBx: -7, lBy: -7 });
/** 뒷발로 벽을 다시 걷어차 꽂으며 살짝 치켜 오른다 */
const CL_STOMP = R({ hx: -2, hy: -23, tl: 13, hd: 9, aFx: 11, aFy: -5, aBx: -9, aBy: -6, lFx: 5, lFy: -3, lBx: -7, lBy: -13 });

/** 벽 붙기: 1~4프레임 붙는 순간(한 번), 5~13프레임 미끄러지며 뒷발로 벽을 다시 걷어차 꽂기를 되풀이. 13프레임 */
export const RAIDEN_WALL_CLING: MotionData = {
  name: 'raiden/wall_cling',
  label: '라이덴 벽 붙기',
  dur: [1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  keys: [
    { at: 0, pose: CL_HIT },
    { at: 2, pose: CL_SQUASH, stop: true },
    { at: 3, pose: CL_HOLD },
    { at: 6, pose: CL_DRAG },
    { at: 9, pose: CL_STOMP, stop: true },
    { at: 12, pose: CL_HOLD },
  ],
};

// ---- 벽 점프 (벽은 뒤. 첫 프레임에는 이미 벽에서 4px쯤 떨어져 있다) ----
/** 뒷발 하나로 벽을 걷어차 몸을 앞으로 던진다: 뒷다리는 벽 쪽으로 쭉, 앞무릎은 가슴으로 차올림(날아차기 준비), 가드 */
const WJ_KICK = R({ hx: 3, hy: -22, tl: 30, hd: -6, aFx: 12, aFy: -5, aBx: 8, aBy: -2, lFx: 9, lFy: -11, lBx: -12, lBy: -6 });
/** 튕겨 나간다: 몸이 비스듬히 솟고, 앞무릎을 앞으로 내지르듯 (플라잉 니), 뒷다리는 뒤에 끌린다 */
const WJ_LAUNCH = R({ hx: 2, hy: -25, tl: 20, hd: -4, aFx: 12, aFy: -6, aBx: 8, aBy: -3, lFx: 11, lFy: -12, lBx: -9, lBy: -4 });
/** 솟으며 뒷다리도 당겨 웅크린다 */
const WJ_TUCK = R({ hx: 0, hy: -26, tl: 18, hd: 6, aFx: 11, aFy: -4, aBx: 8, aBy: -1, lFx: 8, lFy: -14, lBx: 0, lBy: -12 });
/** 꼭대기에서 몸을 펴 떨어질 준비 (라이덴 낙하 둘째 자세와 같은 꼴) */
const WJ_OPEN = R({ hx: 0, hy: -25, tl: 14, hd: 7, aFx: 11, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -7, lBx: -6, lBy: -5 });

/** 벽 점프: 뒷발 하나로 벽을 걷어차고 → 앞무릎을 내지르며 비스듬히 솟고 → 웅크렸다 → 몸을 펴 낙하로. 14프레임 */
export const RAIDEN_WALL_JUMP: MotionData = {
  name: 'raiden/wall_jump',
  label: '라이덴 벽 점프',
  dur: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  keys: [
    { at: 0, pose: WJ_KICK },
    { at: 2, pose: WJ_LAUNCH },
    { at: 6, pose: WJ_TUCK, stop: true },
    { at: 11, pose: WJ_OPEN },
    { at: 13, pose: WJ_OPEN },
  ],
};

// ---- 벽 달리기 (벽은 앞 x = +7. 벽을 바라보며 달려 오른다) ----
/** 대시에서 이어져 앞발바닥을 벽에 걷어차듯 꽂는다 (앞무릎을 높이 차올려), 가드는 그대로 */
const WR_PLANT = R({ hx: 0, hy: -20, tl: 12, hd: -6, aFx: 9, aFy: -6, aBx: 7, aBy: -2, lFx: 7, lFy: -16, lBx: -6, lBy: -1 });
/** 앞발로 벽을 차 밀어 올리고, 뒷무릎을 높이 차올려 다음 걸음을 준비 (앞손 가드, 뒷손은 뒤로 흔든다) */
const WR_A = R({ hx: 0, hy: -25, tl: 6, hd: -14, aFx: 9, aFy: -8, aBx: -4, aBy: 4, lFx: 7, lFy: -24, lBx: 3, lBy: -6 });
/** 발을 바꿔 뒷발바닥을 높이 벽에 꽂는다 (뒷손이 앞으로, 앞손은 뒤로) */
const WR_B = R({ hx: 0, hy: -25, tl: 6, hd: -14, aFx: -4, aFy: 4, aBx: 8, aBy: -8, lFx: 3, lFy: -6, lBx: 7, lBy: -24 });
/** 꼭대기 모서리를 두 손으로 잡는다 */
const WR_GRAB = R({ hx: 0, hy: -24, tl: 4, hd: -20, aFx: 5, aFy: -16, aBx: 3, aBy: -16, lFx: 5, lFy: -9, lBx: 1, lBy: -2 });
/** 팔로 밀어 몸을 끌어올리며 무릎을 당긴다 */
const WR_PULL = R({ hx: 2, hy: -28, tl: 24, hd: -4, aFx: 6, aFy: 4, aBx: 4, aBy: 6, lFx: 6, lFy: -20, lBx: 3, lBy: -16 });
/** 윗면에 발을 걷어차듯 올리며 넘어가 가드를 올린다 */
const WR_OVER = R({ hx: 3, hy: -22, tl: 20, hd: 4, aFx: 11, aFy: -4, aBx: 7, aBy: 0, lFx: 9, lFy: -12, lBx: -4, lBy: -4 });

/** 벽 달리기: 1~10프레임 발바닥을 번갈아 벽에 걷어차 꽂으며 달려 오름, 11~14프레임 모서리를 잡고 끌어올려 넘어감. 14프레임 */
export const RAIDEN_WALL_RUN: MotionData = {
  name: 'raiden/wall_run',
  label: '라이덴 벽 달리기',
  dur: [2, 2, 3, 2, 3, 2, 3, 2, 3, 3, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: WR_PLANT },
    { at: 1, pose: WR_A },
    { at: 3, pose: WR_B },
    { at: 5, pose: WR_A },
    { at: 7, pose: WR_B },
    { at: 9, pose: WR_A },
    { at: 10, pose: WR_GRAB },
    { at: 11, pose: WR_PULL, stop: true },
    { at: 13, pose: WR_OVER },
  ],
};

// ---- 벽 낙법 (벽꽝: 뒤쪽 건물 정면에 박히는 순간. 상대 쪽을 본 채 정면을 걷어차고 뒤로 공중제비를 돌아 튕겨 나간다) ----
/** 부딪힌 순간: 몸이 젖혀지고 팔이 들린다 */
const WT_HIT = R({ hx: -6, hy: -22, tl: -18, hd: -14, aFx: 3, aFy: -17, aBx: -8, aBy: -15, lFx: 10, lFy: 0, lBx: -7, lBy: 0 });
/** 박히기 전에 뒷무릎을 끌어당겨 걷어찰 준비, 앞손은 가드로 */
const WT_COIL = R({ hx: -3, hy: -25, tl: -6, hd: 6, aFx: 10, aFy: -6, aBx: 4, aBy: 2, lFx: 6, lFy: -14, lBx: 0, lBy: -16 });
/** 뒷발 하나로 정면을 뒤로 걷어찬다 (뒷다리를 뒤로 쭉, 몸은 앞으로 숙음) */
const WT_KICK = R({ hx: -1, hy: -26, tl: 22, hd: -6, aFx: 11, aFy: -6, aBx: 7, aBy: -2, lFx: 6, lFy: -14, lBx: -16, lBy: -14 });
/** 공중제비: 무릎을 가슴에 붙이고 두 주먹은 얼굴 앞에 둔 웅크림을 통째로 돌린다 */
const WT_BALL = R({ hx: -1, hy: -28, tl: 20, hd: 8, aFx: 9, aFy: -4, aBx: 7, aBy: -1, lFx: 7, lFy: -38, lBx: 2, lBy: -36 });
/** 한 바퀴를 다 돌며 몸을 펴 가드 (떨어지는 자세로) */
const WT_OPEN = R({ hx: 0, hy: -25, tl: 14 - 360, hd: 7, aFx: 11, aFy: -5, aBx: 8, aBy: -1, lFx: 9, lFy: -7, lBx: -6, lBy: -5 });

/** 벽 낙법: 부딪힌 순간 → 뒷무릎을 당겨 → 정면을 뒤로 걷어참 → 웅크린 채 뒤로 한 바퀴 → 몸을 펴 가드. 13프레임 */
export const RAIDEN_WALL_TECH: MotionData = {
  name: 'raiden/wall_tech',
  label: '라이덴 벽 낙법',
  dur: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],
  keys: [
    { at: 0, pose: WT_HIT },
    { at: 1, pose: WT_COIL },
    { at: 2, pose: WT_KICK },
    { at: 3, pose: spin(WT_BALL, -80) },
    { at: 5, pose: spin(WT_BALL, -170) },
    { at: 6, pose: spin(WT_BALL, -250) },
    { at: 8, pose: spin(WT_BALL, -320) },
    { at: 10, pose: WT_OPEN },
    { at: 12, pose: WT_OPEN },
  ],
};

// ---- 벽 박차기 공격 (벽은 뒤. 벽을 걷어차고 바라보는 쪽 아래 대각선으로 날아가며 앞발 뒤꿈치로 내리찍듯 찬다) ----
/*
 * 기술 수치(판정 4~9프레임, 무릎→발 구간, 3~9프레임 동안 날아감)는 기본 스틱맨 벽 박차기 공격 그대로라
 * 프레임 수(13)와 표시 틱도 같게 만든다. 라이덴답게 가드를 올린 채, 뒷다리는 몸 밑에 접고 앞발 뒤꿈치로 내리찍는다.
 */
/** 붙은 채 앞무릎을 높이 접어 찰 준비, 뒷발바닥은 벽에, 가드를 올리고 아래 앞쪽 상대를 본다 */
const WK_COIL = R({ hx: -3, hy: -21, tl: 18, hd: 18, aFx: 10, aFy: -4, aBx: -8, aBy: -2, lFx: 4, lFy: -11, lBx: -7, lBy: -12 });
/** 더 깊이 웅크린다 (멈칫) */
const WK_SQUASH = R({ hx: -3, hy: -19, tl: 22, hd: 20, aFx: 10, aFy: -2, aBx: -8, aBy: 0, lFx: 3, lFy: -12, lBx: -7, lBy: -11 });
/** 뒷발로 벽을 걷어차 튀어 나간다: 뒷다리를 벽 쪽으로 쭉, 앞무릎은 높이 접고, 뒷손도 가드로 */
const WK_PUSH = R({ hx: 3, hy: -21, tl: 6, hd: 12, aFx: 11, aFy: -5, aBx: 7, aBy: -2, lFx: 8, lFy: -14, lBx: -13, lBy: -9 });
/** 앞발 뒤꿈치로 아래 대각선을 내리찍듯 쭉 뻗는다: 몸은 조금 뒤로, 뒷다리는 몸 밑에 접고, 두 손은 가드 */
const WK_KICK = R({ hx: -1, hy: -19, tl: -8, hd: 14, aFx: 10, aFy: -7, aBx: 7, aBy: -3, lFx: 17, lFy: -3, lBx: -4, lBy: -14 });
/** 찬 자세 그대로 날아간다 */
const WK_DIVE = R({ hx: -1, hy: -19, tl: -10, hd: 15, aFx: 10, aFy: -8, aBx: 7, aBy: -4, lFx: 18, lFy: -2, lBx: -4, lBy: -13 });
/** 날아가는 끝: 앞발을 조금 접기 시작한다 */
const WK_DIVE_END = R({ hx: -1, hy: -20, tl: -6, hd: 12, aFx: 10, aFy: -7, aBx: 7, aBy: -3, lFx: 15, lFy: -6, lBx: -4, lBy: -13 });
/** 다리를 거두며 몸을 세운다 */
const WK_RETRACT = R({ hx: 0, hy: -22, tl: 8, hd: 8, aFx: 11, aFy: -6, aBx: 8, aBy: -2, lFx: 9, lFy: -10, lBx: -5, lBy: -8 });

/** 벽 박차기 공격: 1~2프레임 웅크림 → 3프레임 걷어차고 나감 → 4~9프레임 뒤꿈치로 내리찍으며 날아감(판정) → 10~13프레임 다리를 거두고 낙하로. 13프레임 */
export const RAIDEN_WALL_KICK: MotionData = {
  name: 'raiden/wall_kick',
  label: '라이덴 벽 박차기 공격',
  dur: [2, 2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 3, 3],
  keys: [
    { at: 0, pose: WK_COIL },
    { at: 1, pose: WK_SQUASH, stop: true },
    { at: 2, pose: WK_PUSH },
    { at: 3, pose: WK_KICK },
    { at: 5, pose: WK_DIVE },
    { at: 8, pose: WK_DIVE_END, stop: true },
    { at: 9, pose: WK_RETRACT },
    { at: 12, pose: WJ_OPEN },
  ],
};

export const RAIDEN_WALL_MOTIONS: readonly MotionData[] = [RAIDEN_WALL_CLING, RAIDEN_WALL_JUMP, RAIDEN_WALL_RUN, RAIDEN_WALL_KICK, RAIDEN_WALL_TECH];
