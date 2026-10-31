/**
 * 전투 규칙 수치. 시간은 틱, 거리는 1/256px 정수 (px(…)로 바꿔 쓴다).
 * 기획서: 방어 내구도, 기력 3칸, 낙법, 콤보 보정(최소 35%), 히트스톱 7~12틱.
 */
import { MAP_ENDS, MAP_W } from '../stage/citadel';

export const SUBPX = 256;
export const px = (v: number): number => Math.round(v * SUBPX);

// 무대
export const STAGE_W = MAP_W;
/** 맵 끝 벽 (서쪽 컨테이너 더미, 동쪽 철책) */
export const WALL_L = px(MAP_ENDS.left);
export const WALL_R = px(MAP_ENDS.right);
/** 두 사람은 화면 한 칸 안에서 벗어날 수 없다 */
export const MAX_SEPARATION = px(440);
/** 몸끼리 겹치지 않는 폭 */
export const PUSH_W = px(14);
export const PUSH_H = px(40);

// 라운드 (3판 2선승, 60초)
export const ROUND_TICKS = 60 * 60;
export const WINS_NEEDED = 2;
/** 무승부가 이어질 때 여기서 경기를 끝낸다 */
export const MAX_ROUNDS = 5;
export const INTRO_TICKS = 70;
export const ROUND_END_TICKS = 150;
/** 시작 위치: 광장 가운데 분수 양쪽 (맵 가운데 ± 이만큼) */
export const START_GAP = px(120);

// 발판 (한 방향)
/** ↓+점프로 발판에서 내려온 뒤 이 틱 동안은 발판을 지나친다 (바닥에는 선다) */
export const DROP_TICKS = 10;

// 벽 기동 (기획서 '벽 기동과 구조물')
/** 벽에 붙었을 때 몸 가운데와 벽 면 사이 (벽 기동 그림의 벽 면 자리와 같다) */
export const WALL_REACH = px(7);
/** 벽을 잡는 높이: 발밑에서 이만큼 위 (손이 벽에 닿아야 붙는다. 벽 아래 끝보다 발이 이만큼 내려가면 떨어진다) */
export const WALL_GRAB_H = 30;
/** 같은 벽은 연속 이만큼까지만 딛는다 */
export const SAME_WALL_MAX = 2;
/** 벽에서 손을 놓을 때 벽 반대쪽으로 밀려나는 속도 */
export const WALL_PUSH = px(1.2);
/** 벽 점프 직후 이 틱 동안은 공중 좌우 조작이 듣지 않는다 (곧바로 같은 벽으로 되돌아가지 않게) */
export const WALL_JUMP_LOCK = 10;

// 방어
export const GUARD_MAX = 100;
/** 막지 않은 채 이만큼 지나면 내구도가 차기 시작 */
export const GUARD_REGEN_DELAY = 40;
/** 이 틱마다 1씩 참 */
export const GUARD_REGEN_EVERY = 3;
export const CRUSH_TICKS = 50;

// 기력 (3칸)
export const METER_BAR = 100;
export const METER_MAX = 3 * METER_BAR;
export const METER_HIT = 8;
export const METER_HURT = 6;
export const METER_BLOCK = 3;
export const METER_BLOCKED = 2;

// 콤보
/** 한 콤보에서 n번째 맞을 때 피해 % = max(MIN, 100 - STEP × (n-1)) */
export const SCALE_STEP = 12;
export const SCALE_MIN = 35;
/**
 * 지상 경직 보정 (기획서 밖, 무한 콤보 방지): 한 콤보에서 FROM번째 타 이후로 한 대마다 STEP틱씩 줄고,
 * 원래의 MIN% 아래로는 줄지 않는다.
 */
export const STUN_DECAY_FROM = 4;
export const STUN_DECAY_STEP = 2;
export const STUN_DECAY_MIN = 50;
/** 콤보 중 이만큼 맞으면 낙법 가능 */
export const TECH_HITS = 5;
export const TECH_TICKS = 14;
/** 낙법: 뒤로 몸을 돌려 빠져나가는 속도 */
export const TECH_VX = px(2.6);
export const TECH_VY = px(-5.5);
/** 공중에서 맞을 때마다 더 빨리 떨어진다 (맞은 횟수당 중력 추가, 상한) */
export const JUGGLE_GRAVITY_PER_HIT = px(0.03);
export const JUGGLE_GRAVITY_MAX = px(0.3);
export const AIR_HIT_DEFAULT = { vx: 1.6, vy: -4.0 };
export const SPIKE_VY = px(11);
export const BOUNCE_VY = px(-5);

export const KNOCKDOWN_TICKS = 40;
export const GETUP_TICKS = 26;
/** 맞은 쪽이 하얗게 번쩍이는 틱 */
export const FLASH_TICKS = 6;
/** 막았을 때 히트스톱은 이만큼 짧게 (최소 4) */
export const BLOCK_HITSTOP_CUT = 3;
/** 필살 컷인 동안 둘 다 멈춤 */
export const SUPER_FREEZE = 45;
/** 버튼을 미리 눌러 두면 이 틱 동안 기억 */
export const BUFFER_TICKS = 8;
