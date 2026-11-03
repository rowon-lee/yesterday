import { reachTip } from '../anim/boxes';
import { cellOf } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import { BREAKABLES, cineScenes, GRIDS, fighterPose, movesOf, RULES, statsOf, tramRestX, WRECKS, type Fighter, type SimState, type WreckMat } from '../sim';
import type { DebrisKind } from './debris';
import { CITADEL as D } from '../data/stages/citadel';
import { KNOCKDOWN_RELAND } from '../data/poses/common';
import type { TrailBox } from '../data/moves/base';
import { HWAGWASAN, PACHEON_ASH, RAIDEN_EXT } from '../sim/chars/raiden';
import type { SkinId } from '../anim/skins';
import { Debris } from './debris';
import arc from '../vfx/arc';
import raidenAura, { type AuraJoints } from '../vfx/raiden-aura';
import raidenTrail from '../vfx/raiden-trail';
import raidenStrike from '../vfx/raiden-strike';
import { raidenChargeArmor, raidenChargeCone, raidenCurse, raidenSteam, type Body as ChargeBody } from '../vfx/raiden-charge';
import { hwagwasanBarrier, hwagwasanDome, hwagwasanDrag } from '../vfx/raiden-hwagwasan';
import { pacheonAshFall, pacheonContact, pacheonCrack, pacheonEmbers, pacheonSurge } from '../vfx/raiden-pacheon';
import trail from '../vfx/trail';
import dashBlink from '../vfx/dash-blink';
import explosion from '../vfx/explosion';
import glint from '../vfx/glint';
import impact from '../vfx/impact';
import lightning from '../vfx/lightning';
import powerUp from '../vfx/power-up';
import slash from '../vfx/slash';
import type { Effects } from './effects';
import type { ColorName } from './palette';
import { BREAK_RULES, GROUND as GROUND_Y } from '../stage/citadel';
import { facadeAtlas } from './gl/buildings';
import { keepAtlas } from './gl/plaza';
import { fxColor, fxHex, fxRamp, FX_PX, type VfxLayer } from './vfx';
import { lights } from './light';
import { rendersOf, type CharFx } from './chars';
import { clearScreenFx } from './screenfx';
import { COLORS } from './palette';

/**
 * 전투 이벤트 → Sprite Fusion 이펙트 (렌더 전용, 게임 기획서 '이펙트 배치' 표대로).
 * - 평타 타격: Impact (불꽃·파편)
 * - 발차기·쓸기처럼 휘두르는 공격: Slash (휘두른 궤적). 기본 스틱맨은 베는 무기가 없어 발차기 궤적으로 쓴다
 * - 대시·공중 대시: Dash & Blink (잔상, 박차는 먼지)
 * - 기력 3칸이 찬 동안: Power Up (몸 윤곽을 따라 도는 오라)
 * - 필살 적중·가드 크러시·KO: Explosion
 * - 큰 물건이 크게 무너질 때: Explosion·먼지·화면 흔들림 (부서지는 순간, 그리고 쓰러져 땅·지붕에 닿는 순간)
 * 맞은 쪽 하얀 번쩍임과 히트스톱 중 떨림도 여기서 정한다.
 */

/** 플레이어별 이펙트 색 (밝은 → 어두운): 1P 금빛, 2P 하늘빛 */
const SIDE_RAMP: Record<0 | 1, ColorName[]> = {
  0: ['fxWhite', 'goldLight', 'fxYellow', 'gold', 'fxOrange', 'goldDark', 'fxRed'],
  1: ['fxWhite', 'skyLight', 'sky', 'fxBlue', 'skyDark', 'fxDeepBlue', 'fxNavy'],
};
/** 라이덴 (캐릭터 기획서: 붉은 전격, 검붉은 잔상): 대시 잔상 등 플레이어 색 대신 쓴다 */
const RAIDEN_RAMP: ColorName[] = ['fxWhite', 'raidenLight', 'raiden', 'fxRed', 'raidenDark', 'raidenDeep'];
/** 이 사람의 이펙트 색: 캐릭터 대표 색이 있으면 그것, 없으면 플레이어 색 */
const rampOf = (f: Fighter, side: 0 | 1): ColorName[] => (f.char === 'raiden' ? RAIDEN_RAMP : ((rendersOf(f.char).ramp as ColorName[] | undefined) ?? SIDE_RAMP[side]));
/**
 * 라이덴 등장 (사용자 요청 2026-11-01 '번개가 쾅! 치고 거기서 히어로 랜딩 자세로 떨어지자. 순간이동으로 등장한 것처럼'):
 * 처음 hide틱은 보이지 않다가 hide틱에 붉은 번개가 제자리에 내리꽂히고, 그 번개 속에서 drop px 위에 나타나
 * land틱에 땅에 떨어진다 (히어로 랜딩, 등장 동작 4번째 프레임). 높이는 렌더 전용 (sim 자리는 땅 그대로)
 */
export const RAIDEN_INTRO = { hide: 6, land: 10, drop: 54 };
/** 라이덴 등장 중 보이지 않는가 */
export const raidenIntroHidden = (f: Fighter): boolean =>
  (f.char === 'raiden' && f.mode === 'intro' && f.t < RAIDEN_INTRO.hide) || (f.mode === 'intro' && (rendersOf(f.char).introHidden?.(f) ?? false));
/** 라이덴 등장 중 땅 위로 띄워 그리는 높이 (px): 번개 속에서 나타나 점점 빨리 떨어진다 */
export function raidenIntroLift(f: Fighter): number {
  // 캐릭터 고유 등장 높이 (render/chars)
  const own = f.mode === 'intro' ? rendersOf(f.char).introLift?.(f) : undefined;
  if (own !== undefined) return own;
  if (f.char !== 'raiden' || f.mode !== 'intro' || f.t >= RAIDEN_INTRO.land) return 0;
  const u = Math.max(0, (f.t - RAIDEN_INTRO.hide) / (RAIDEN_INTRO.land - RAIDEN_INTRO.hide));
  return Math.round(RAIDEN_INTRO.drop * (1 - u * u));
}
/** 타격 불꽃 (뜨거운 색) */
/** 구조물 재질 → 튀는 조각 종류, 떨어지는 덩어리 색 (첫 색은 쓰지 않는 자리: 몸 색은 1번부터) */
const DEBRIS_OF: Record<WreckMat, DebrisKind> = { brick: 'brick', concrete: 'concrete', stone: 'concrete', steel: 'metal', sheet: 'metal', glass: 'glass', wood: 'wood', sand: 'sand' };
const DEBRIS_FALL: Record<WreckMat, readonly string[]> = {
  brick: ['', '#4a3634', '#3a2c2c', '#5e4440'],
  concrete: ['', '#44423e', '#34343a', '#5e5a54'],
  stone: ['', '#4a4844', '#3a3a3e', '#6a6660'],
  steel: ['', '#34343a', '#26262c', '#55555c'],
  sheet: ['', '#3e3c38', '#2c2c2e', '#5e5a50'],
  glass: ['', '#3a5864', '#2a3c46', '#7aa8b8'],
  wood: ['', '#4e3626', '#3a2a20', '#6a4a32'],
  sand: ['', '#5a5040', '#4a4234', '#7a6c52'],
};
const WARM: ColorName[] = ['fxWhite', 'goldLight', 'fxYellow', 'fxOrange', 'fxFlame', 'fxRed'];
/** 차지를 모으는 동안 몸 둘레 오라와 빛 (기본 스틱맨은 흰 주황. 캐릭터를 얹으면 대표 색) */
const CHARGE_RAMP: ColorName[] = ['fxWhite', 'goldLight', 'fxYellow', 'fxOrange', 'fxFlame', 'goldDark', 'fxRed'];
/** 막혔을 때 (차가운 색) */
const COOL: ColorName[] = ['fxWhite', 'skyLight', 'sky', 'fxBlue', 'fxDeepBlue', 'fxNavy'];
/** 휘두른 궤적 */
const STEEL: ColorName[] = ['fxWhite', 'white', 'skyLight', 'sky', 'fxBlue', 'fxDeepBlue', 'fxNavy'];

/** 휘두르는 공격: 판정이 나오는 틱에 궤적을 그린다 */
const SWINGS: Partial<Record<string, { size: number; squash: number; tilt: number; dy: number; from?: number; to?: number }>> = {
  atk3: { size: 0.32, squash: 0.75, tilt: -0.2, dy: -26 },
  air3: { size: 0.32, squash: 0.7, tilt: 0.1, dy: -18 },
  sweep: { size: 0.36, squash: 0.3, tilt: 0, dy: -4, from: -2.9, to: 0.3 },
  slam: { size: 0.3, squash: 0.8, tilt: 1.2, dy: -20 },
};

/**
 * 필살기 연출 장면의 타격 시각 (렌더 전용 데이터): 발동자 동작 이름 → 그 장면 안 틱마다 타격 종류.
 * 기본 스틱맨 임시 필살기: 난타(주먹이 뻗는 프레임마다) → 어퍼(올려친 순간) → 내려찍기(내리친 순간, 바닥에 꽂힌 순간)
 */
interface CineCue {
  t: number;
  kind: 'jab' | 'upper' | 'hammer' | 'slam' | 'pcPress' | 'pcSurge' | 'pcFlash' | 'pcBurst' | 'pcFly' | 'pcAfter';
}
const CINE_CUES: Record<string, CineCue[]> = {
  'base/super_rush': [3, 9, 15, 21, 27, 33].map((t) => ({ t, kind: 'jab' as const })),
  'base/super_rise': [{ t: 14, kind: 'upper' }],
  'base/super_slam': [{ t: 13, kind: 'hammer' }, { t: 26, kind: 'slam' }],
  // 라이덴 파천 (사용자 피드백 2026-11-02 9-4): 정적(닿은 점만 붉다) → 몸 안으로(어둡게 비친 상대 뼈대를 따라 전류, 섬광 두 번) →
  // 등 뒤로(검붉은 원뿔, 흰 심) → 잿더미(sim 'ash' 사건, 불씨) → 잔심(김·잔 스파크·재)
  'raiden/pacheon_press': [{ t: 0, kind: 'pcPress' }],
  'raiden/pacheon_surge': [{ t: 0, kind: 'pcSurge' }, { t: 6, kind: 'pcFlash' }, { t: 16, kind: 'pcFlash' }],
  'raiden/pacheon_burst': [{ t: 2, kind: 'pcBurst' }],
  'raiden/pacheon_fly': [{ t: 0, kind: 'pcFly' }],
  'raiden/pacheon_after': [{ t: 0, kind: 'pcAfter' }],
};

/** 맞은 쪽 하얀 번쩍임: 맞은 순간부터 이 틱 동안 하얗게 (센 타격은 한 번 더 깜빡) */
const FLASH_LIGHT = 3;
/** 낙법 가능 깜빡임 틱 */
const TECH_BLINK = 3;
/** 다운에서 다시 바닥에 닿는 틱 (6번 프레임이 시작하는 틱) */
const KD_RELAND_T = (() => {
  const m = MOTIONS.find((x) => x.name === 'common/knockdown')!;
  return m.dur.slice(0, KNOCKDOWN_RELAND).reduce((a, b) => a + b, 0);
})();
const FLASH_HEAVY = 4;

const motionByName = new Map(MOTIONS.map((m) => [m.name, m]));
/** 차지를 모으는 동안 허리에 당긴 주먹 자리 (발밑 기준, 오른쪽 보는 기준): 그 캐릭터 차지에서 되풀이하는 첫 프레임의 앞주먹 */
const chargeFist = (f: Fighter) => {
  const mv = movesOf(f.char).charge;
  return mv.frames.joints[mv.data.charge!.windup].hF;
};
/**
 * 번개 휩쓸기 길 (발밑 기준 px, 오른쪽 보는 기준): 치는 팔다리 끝(주먹·발·무릎)이 판정 두 프레임 앞부터
 * 마지막 판정 프레임까지 지나간 자리, 끝은 번개 사거리 끝 (판정 상자와 같은 자리, anim/boxes reachTip).
 * 판정 프레임 가운데 처음 자리에서 가장 먼 사거리 끝까지 뻗는다 (곧은 주먹은 앞으로, 어퍼컷은 위로, 해머는 아래로)
 */
type MoveOf = ReturnType<typeof movesOf>[keyof ReturnType<typeof movesOf>];
const sweepCache = new Map<string, Array<[number, number]>>();
function sweepPath(mv: MoveOf): Array<[number, number]> | null {
  const d = mv.data;
  if (!d.limb) return null;
  const key = d.motion;
  const hit = sweepCache.get(key);
  if (hit) return hit;
  const [a, b] = d.limb;
  const J = mv.frames.joints;
  const first = d.active[0];
  const last = d.active[d.active.length - 1];
  const pts: Array<[number, number]> = [];
  for (let i = Math.max(0, first - 2); i <= last; i++) {
    const p = J[i][b];
    const q = pts[pts.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) pts.push([p[0], p[1]]);
  }
  let best: [number, number] = pts[pts.length - 1];
  let far = -1;
  for (const i of d.active) {
    const t = reachTip(J[i][a][0], J[i][a][1], J[i][b][0], J[i][b][1], d.reach ?? 0);
    const dist = Math.hypot(t[0] - pts[0][0], t[1] - pts[0][1]);
    if (dist > far) {
      far = dist;
      best = t;
    }
  }
  pts.push(best);
  sweepCache.set(key, pts);
  return pts;
}
/**
 * 라이덴 궤적 번개 길 (발밑 기준 px, 오른쪽 보는 기준, 꼬리 → 앞끝): 치는 손발 끝이 판정 두 프레임 앞에 있던 자리에서 시작해
 * 궤적 상자 모양대로 휜다 (사용자 레퍼런스 2026-11-01 '궤적을 따라 크게 휘는 초승달'). 앞부분이 궤적 상자(= 판정)를 덮는다.
 * line: 살짝 위로 부푼 직선 → 상자 앞끝, arc: 뒤 아래에서 위를 돌아 앞으로 내려오는 반원, rise: 아래에서 앞으로 부풀며 위로,
 * fall: 뒤 위에서 앞 아래로 내리긋는 반원, ground: 바닥을 스치는 낮은 반원, circle: 한 바퀴, tail: 몸 뒤에서 끌려오는 꼬리
 */
const trailCache = new Map<string, Array<[number, number]>>();
type P2 = [number, number];
/**
 * 라이덴 기술마다 따로 잡은 번개 길 (동작연출지침서 7장 라이덴 표, 발밑 기준·오른쪽 보는 기준, 꼬리 → 앞끝).
 * 손발 끝이 실제로 지나는 궤적을 크게 부풀린 모양이고, 앞부분이 궤적 상자(판정)를 덮는다. tip(i) = i번째 프레임의 치는 손발 끝
 */
const RAIDEN_TRAILS: Partial<Record<string, (tip: (i: number) => P2, b: TrailBox, a0: number) => P2[]>> = {
  // 3타 미들킥: 뒷발이 뒤 아래에서 위로 크게 돌아 몸통 높이로 내려오는 지름 약 56px 반원
  atk3: (_t, b) => [[b.x - 16, b.y + b.h + 6], [b.x - 10, b.y + 20], [b.x + 10, b.y + 2], [b.x + 34, b.y + 2], [b.x + b.w - 6, b.y + 14], [b.x + b.w, b.y + 28]],
  // 띄우기: 웅크린 주먹 자리에서 앞으로 부풀며 머리 위 높이까지 솟는 세로 번개
  launcher: (t, b, a0) => [t(a0 - 2), [b.x + b.w - 2, b.y + b.h - 26], [b.x + b.w / 2 + 4, b.y + 30], [b.x + b.w / 2 - 4, b.y]],
  // 쓸기: 뒷발이 몸 뒤 바닥에서 앞으로 바닥을 쓸며 지나는 낮은 반원
  sweep: (_t, b) => [[b.x - 18, b.y + b.h - 2], [b.x - 2, b.y + 6], [b.x + 22, b.y + 1], [b.x + 46, b.y + 4], [b.x + b.w, b.y + b.h - 3]],
  // 플라잉 니: 몸 뒤로 길게 끌리다가 앞무릎에서 끝나는 꼬리
  dashAttack: (_t, b) => [[b.x - 40, b.y + 22], [b.x - 18, b.y + 16], [b.x + 4, b.y + 12], [b.x + 26, b.y + 10], [b.x + b.w, b.y + 14]],
  // 공중 돌려차기: 다리가 그리는 원 (뒤 아래 → 뒤 위 → 머리 위 → 앞 → 앞 아래, 거의 한 바퀴)
  air3: (_t, b) => Array.from({ length: 12 }, (_, k): P2 => {
    const a = ((140 + (280 * k) / 11) * Math.PI) / 180;
    return [b.x + b.w / 2 + Math.cos(a) * (b.w / 2), b.y + b.h / 2 + Math.sin(a) * (b.h / 2)];
  }),
  // 도끼차기: 머리 위로 든 발에서 앞으로 크게 돌아 바닥까지 내리긋는 반원
  slam: (_t, b) => [[b.x + 6, b.y + 2], [b.x + 28, b.y + 8], [b.x + 44, b.y + 28], [b.x + b.w - 4, b.y + 52], [b.x + 36, b.y + b.h]],
  // 잔흔 하이킥: 뒤 아래에서 머리 위를 돌아 머리 높이로 내려오는 반원
  skill1: (_t, b) => [[b.x - 14, b.y + b.h + 8], [b.x - 8, b.y + 18], [b.x + 12, b.y + 1], [b.x + 36, b.y + 1], [b.x + b.w - 4, b.y + 14], [b.x + b.w, b.y + 26]],
};
function trailPath(mv: MoveOf, id: string, b: TrailBox): Array<[number, number]> {
  const d = mv.data;
  const key = `${id}:${d.motion}:${b.x},${b.y},${b.w},${b.h},${b.shape}`;
  const hit = trailCache.get(key);
  if (hit) return hit;
  const custom = RAIDEN_TRAILS[id];
  const J = mv.frames.joints;
  const end = (d.limb?.[1] ?? 'hF') as 'hF';
  const a0 = d.active[0];
  const tip = (i: number): [number, number] => {
    const p = J[Math.max(0, Math.min(J.length - 1, i))][end];
    return [p[0], p[1]];
  };
  const x0 = b.x;
  const x1 = b.x + b.w;
  const y0 = b.y;
  const y1 = b.y + b.h;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  /** 타원 위의 점 (각도는 도, 0 = 앞, 90 = 아래, 270 = 위) */
  const ell = (ccx: number, ccy: number, rx: number, ry: number, deg: number): [number, number] => {
    const r = (deg * Math.PI) / 180;
    return [ccx + Math.cos(r) * rx, ccy + Math.sin(r) * ry];
  };
  const sweep = (ccx: number, ccy: number, rx: number, ry: number, from: number, to: number, n: number) =>
    Array.from({ length: n + 1 }, (_, k) => ell(ccx, ccy, rx, ry, from + ((to - from) * k) / n));
  let path: Array<[number, number]>;
  if (custom) {
    path = custom(tip, b, a0);
    trailCache.set(key, path);
    return path;
  }
  switch (b.shape) {
    case 'line': {
      const s = tip(a0 - 2);
      const e: [number, number] = [x1, cy];
      const m: [number, number] = [s[0] + (e[0] - s[0]) * 0.45, Math.min(s[1], e[1]) - b.h * 0.35];
      path = [s, m, e];
      break;
    }
    case 'arc':
      path = sweep(cx, y1, b.w / 2, b.h, 170, 365, 6);
      break;
    case 'rise':
      path = [[cx - b.w * 0.15, y1], [x1 - b.w * 0.1, y1 - b.h * 0.4], [cx + b.w * 0.15, y0 + b.h * 0.12], [cx - b.w * 0.2, y0]];
      break;
    case 'fall':
      path = [[x0, cy], [cx - b.w * 0.15, y0], [x1 - b.w * 0.1, y0 + b.h * 0.3], [x1 - b.w * 0.15, y1]];
      break;
    case 'ground':
      path = sweep(cx, y1, b.w / 2, b.h, 180, 360, 6);
      break;
    case 'circle':
      path = sweep(cx, cy, b.w / 2, b.h / 2, 120, 470, 10);
      break;
    case 'tail':
    default:
      path = [[x0, cy + b.h * 0.25], [cx, cy + b.h * 0.1], [x1, cy - b.h * 0.15]];
      break;
  }
  trailCache.set(key, path);
  return path;
}
/** 번개 휩쓸기 굵기: 센 기술(니킥·어퍼컷·대시 공격·내려찍기·차지)은 굵게 */
const HEAVY_SWEEP: ReadonlySet<string> = new Set(['atk4', 'launcher', 'dashAttack', 'slam', 'charge', 'skill1', 'wallKick']);
/**
 * 라이덴 지상 1~4타 번개 (사용자 피드백 2026-11-02 '공격 하나에 방향 하나'): 한 방향으로 뻗는 줄기 하나 (vfx/raiden-strike).
 * 심 굵기·가지·끝 갈래·꺾임, 맞힘 빛 (반지름 px, 틱), 맞힘 불꽃 크기. 1 → 4타로 굵고 길어진다
 */
const RAIDEN_STRIKE: Partial<Record<string, { width: number; branches: number; forks: number; jag: number; hitR: number; hitT: number; spark: number }>> = {
  atk1: { width: 1, branches: 1, forks: 0, jag: 1.4, hitR: 12, hitT: 2, spark: 0.18 },
  atk2: { width: 1, branches: 3, forks: 0, jag: 1.6, hitR: 14, hitT: 2, spark: 0.2 },
  atk3: { width: 2, branches: 0, forks: 0, jag: 1.8, hitR: 16, hitT: 2, spark: 0.22 },
  atk4: { width: 2, branches: 0, forks: 3, jag: 2, hitR: 20, hitT: 3, spark: 0.28 },
};
/** 적뢰 범위 번개 색 (흰 심 → 밝은 붉은 테두리 → 붉은 → 검붉은 → 아주 어두운) */
/** 화과산 전류 방벽 높이 (px, sim과 같은 값) */
const RAIDEN_BARRIER_H = HWAGWASAN.barrierH;
const BOLT_RANGE: ColorName[] = ['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep'];
/** 라이덴의 작은 맞힘 (지상 1~4타, 투전승불): 맞힘 빛 반지름·틱, 불꽃 크기. 그 밖의 기술은 undefined (큰 맞힘) */
function raidenSmallHit(move: string, chargeLv: number): { hitR: number; hitT: number; spark: number } | undefined {
  if (move === 'charge') {
    const lv = Math.max(1, Math.min(4, chargeLv));
    return { hitR: 12 + 3 * lv, hitT: lv >= 3 ? 3 : 2, spark: 0.18 + 0.04 * lv };
  }
  // 화과산: 맞힌 자리는 작게 (밀려나는 거리와 반구 스파크가 보이게)
  if (move === 'skill2') return { hitR: 14, hitT: 2, spark: 0.2 };
  return RAIDEN_STRIKE[move];
}
/** 적뢰 세기 (지침서 7-1장 '단계 차이': 1→4타로 갈수록 굵고 길고 가지가 많다) */
const RANGE_POWER: Partial<Record<string, number>> = { atk1: 1, atk2: 2, atk3: 2, atk4: 4, launcher: 3, sweep: 3, dashAttack: 3, air1: 1, air2: 2, air3: 3, slam: 4, charge: 4, skill1: 3, super: 4 };
/**
 * 전신 전격 세기 (0~1): 감기 동안 0.45에서 0.9까지 오르고, 판정 프레임 동안 1, 그 뒤 여운·복귀에서 0.2까지 내려간다
 */
function auraLevelOf(mv: MoveOf, t: number): number {
  const a = mv.activeStart;
  const b = mv.activeEnd;
  if (t < a) return 0.45 + 0.45 * (t / Math.max(1, a));
  if (t < b) return 1;
  return Math.max(0.2, 1 - (0.8 * (t - b)) / Math.max(1, mv.total - b));
}
/** 라이덴 파천 색: 검붉은 계열 하나 (심만 흰빛, 사용자 피드백 2026-11-02 9-4) */
const PACHEON_RAMP: ColorName[] = ['fxWhite', 'raiden', 'raidenDark', 'raidenDeep', 'raidenDeep'];
/** 라이덴 번개 색 (흰 심지 → 붉은 빛 → 검붉은 테두리) */
const BOLT: ColorName[] = ['fxWhite', 'raiden', 'fxRed', 'raidenDark', 'raidenDeep'];

/** 실루엣을 그리는 캔버스 (가장 큰 칸 128×96) */
const silCanvas = document.createElement('canvas');
silCanvas.width = 128;
silCanvas.height = 96;
const silCache = new Map<string, Uint32Array>();

/** 동작 한 프레임의 실루엣 픽셀 (칸 크기, 캐시) */
function silData(motion: string, frame: number, facing: number, skin: SkinId) {
  const m = motionByName.get(motion)!;
  const cell = cellOf(m);
  const key = `${skin}/${motion}/${frame}/${facing}`;
  let data = silCache.get(key);
  if (!data) {
    const g = silCanvas.getContext('2d', { willReadFrequently: true })!;
    g.clearRect(0, 0, cell.w, cell.h);
    m.draw(g, frame, 0, 0, { look: 'p1', flip: facing < 0, skin });
    data = new Uint32Array(g.getImageData(0, 0, cell.w, cell.h).data.buffer.slice(0));
    silCache.set(key, data);
  }
  return { cell, data };
}

/** 지금 모습의 실루엣 (Power Up 오라·대시 잔상이 몸 윤곽을 따라가도록). 이펙트 픽셀 좌표 */
function silhouette(f: Fighter, skin: SkinId = 'base') {
  const p = fighterPose(f);
  const { cell, data } = silData(p.motion, p.frame, f.facing, skin);
  return { x: Math.round(f.x / 256) - cell.fx, y: Math.round(GROUND_Y + f.y / 256) - cell.fy, w: cell.w, h: cell.h, data };
}

/** 정해진 동작·프레임을 월드 자리(wx, wy: 발밑, px)에 놓은 실루엣 (순간이동으로 떠난 자리에 남는 잔상) */
function silhouetteAt(motion: string, frame: number, facing: number, skin: SkinId, wx: number, wy: number) {
  const { cell, data } = silData(motion, frame, facing, skin);
  return { x: Math.round(wx) - cell.fx, y: Math.round(wy) - cell.fy, w: cell.w, h: cell.h, data };
}

const feet = (f: Fighter): [number, number] => [(f.x / 256) * FX_PX, (GROUND_Y + f.y / 256) * FX_PX];

export class FightVfx {
  /** 맞은 뒤 지난 틱 (번쩍임용), 센 타격이었는지 */
  private since = [99, 99];
  private heavy = [false, false];
  /** 낙법이 가능해진 순간 한 번 하얗게 깜빡임 (공통 동작 사양서 '공중에서 맞음', 렌더 전용): 남은 틱, 지난 틱에 가능했나 */
  private blink = [0, 0];
  private techReady = [false, false];
  private prevMeter = [0, 0];
  private prevMode = ['idle', 'idle'];
  private prevMoveT = [-1, -1];
  private seed = 1;

  /** 두 사람의 캐릭터 겉모습 (실루엣을 따라가는 이펙트용, 대련 장면이 정한다) */
  skins: [SkinId, SkinId] = ['base', 'base'];
  private cfxCache: CharFx | null = null;
  /** 캐릭터 고유 연출(render/chars)에 넘기는 도구 */
  private get cfx(): CharFx {
    return (this.cfxCache ??= {
      layer: this.layer,
      fx: this.fx,
      debris: this.debris,
      seed: () => this.seed++,
      glow: (x, y, r, color, a, ticks) => this.glow(x, y, r, color, a, ticks),
      feet,
      skinOf: (f) => this.skinOf(f),
      silhouetteAt,
      silhouette: (f) => silhouette(f, this.skinOf(f)),
    });
  }

  private skinOf(f: Fighter): SkinId {
    return f === this.fighters?.[1] ? this.skins[1] : this.skins[0];
  }
  private fighters: readonly Fighter[] | null = null;

  /** 부서질 때 튀는 조각 */
  readonly debris = new Debris();
  private round = 0;
  /** 이펙트가 내는 빛 (월드 좌표): 타격 불꽃, 폭발, 필살, 네온 불꽃. 틱마다 줄어든다 */
  private glows: Array<{ x: number; y: number; r: number; color: string; a: number; life: number; t: number }> = [];

  private glow(x: number, y: number, r: number, color: string, a: number, life: number): void {
    this.glows.push({ x, y, r, color, a, life, t: 0 });
  }

  /**
   * 이번 프레임의 빛 목록에 이펙트 빛을 더한다 (drawStage 뒤, drawLights 앞에 부른다).
   * 기력 3칸이 찬 동안은 몸 둘레에 오라 빛, 필살 컷인 동안은 쓴 사람에게서 큰 빛.
   */
  emitLights(s: SimState): void {
    for (const g of this.glows) {
      const k = 1 - g.t / g.life;
      lights.point(g.x, g.y, g.r * (0.7 + 0.3 * k), g.color, g.a * k * k);
    }
    // 전신 전격: 몸 둘레를 붉게 비춘다 (세기만큼)
    s.fighters.forEach((f, i) => {
      const k = this.auraLevel[i];
      if (k > 0.05) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 26, 40 + 30 * k, COLORS.raiden, 0.3 * k * (s.tick % 3 === 0 ? 0.75 : 1));
    });
    // 적뢰는 무대의 실제 광원 (지침서 7-1장 '빛'): 섬광은 범위 가운데 센 흰 빛 + 화면 전체가 살짝 밝아지는 넓은 빛,
    // 방전은 줄기를 따라 붉은 빛 세 개가 떨리며 벽·젖은 바닥·상대를 비추고, 잔광은 어둡게 남는다
    this.bolts = this.bolts.filter((b) => !b.fx.done());
    for (const b of this.bolts) {
      const ph = b.fx.phase();
      const [p0, p1, p2] = ph.pts;
      const len = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
      if (ph.stage === 0) {
        // 섬광 빛은 앞끝(상대 쪽)에 둔다: 치는 사람의 자세가 하얗게 날아가지 않게
        lights.point(p2[0], p2[1], 40 + len * 0.6, COLORS.fxWhite, 0.8);
        lights.point(p1[0], p1[1], 260, COLORS.raidenLight, 0.24);
      } else if (ph.stage === 1) {
        const fl = s.tick % 3 === 0 ? 0.75 : 1;
        for (const p of ph.pts) lights.point(p[0], p[1], 46 + len * 0.3, COLORS.raiden, 0.85 * ph.k * fl);
      } else lights.point(p1[0], p1[1], 40, COLORS.raidenDark, ph.k);
    }
    // 지상 1~4타 줄기: 줄기를 따라 작은 붉은 빛 (두 사람이 빛에 묻히지 않게 작게)
    this.strikes = this.strikes.filter((b) => !b.fx.done());
    for (const b of this.strikes) {
      const ph = b.fx.phase();
      if (ph.stage === 2) {
        lights.point(ph.pts[2][0], ph.pts[2][1], 18 + 4 * b.power, COLORS.raidenDark, ph.k);
        continue;
      }
      const fl = s.tick % 3 === 0 ? 0.75 : 1;
      for (const p of ph.pts.slice(1)) lights.point(p[0], p[1], 20 + 5 * b.power, COLORS.raiden, (0.35 + 0.1 * b.power) * ph.k * fl);
    }
    // 화과산: 날숨 반구 빛, 서 있는 전류 방벽 (튕길 때 밝게), 저주가 찌릿할 때 작은 빛
    this.domes = this.domes.filter((d) => !d.done());
    for (const d of this.domes) {
      const ph = d.phase();
      if (ph.k > 0) lights.point(ph.x, ph.y, 56, COLORS.raidenLight, 0.9 * ph.k);
    }
    this.barriers.forEach((b, i) => {
      if (!b) return;
      if (b.fx.done()) {
        this.barriers[i] = null;
        return;
      }
      const ph = b.fx.phase();
      if (ph.on) lights.point(ph.x, ph.y, ph.flash ? 48 : 30, ph.flash ? COLORS.raidenLight : COLORS.raiden, (ph.flash ? 0.9 : 0.4) * (s.tick % 3 === 0 ? 0.75 : 1));
    });
    this.curses.forEach((c, i) => {
      if (!c) return;
      if (c.done()) {
        this.curses[i] = null;
        return;
      }
      const o = s.fighters[1 - i];
      if (c.zapping() && o) lights.point(o.x / 256, GROUND_Y + o.y / 256 - 26, 26, COLORS.raidenDark, 0.5);
    });
    // 투전승불 원뿔 방전: 원뿔 가운데 붉은 빛 (8틱에 사그라든다)
    this.cones = this.cones.filter((c) => !c.fx.done());
    for (const c of this.cones) {
      const ph = c.fx.phase();
      if (ph.k > 0) lights.point(ph.x, ph.y, 22 + 6 * c.power, COLORS.raidenLight, (0.35 + 0.12 * c.power) * ph.k);
    }
    s.fighters.forEach((f, i) => rendersOf(f.char).lights?.(s, f, i));
    s.fighters.forEach((f, i) => {
      if (f.meter >= RULES.METER_MAX) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 26, 54, f.char === 'raiden' ? COLORS.raiden : rendersOf(f.char).light ?? (i === 0 ? COLORS.gold : COLORS.sky), 0.45);
      // 라이덴 투전승불: 0단계는 빛이 없고, 단계마다 작은 붉은 빛 (맥동하는 틱만 밝게), 4단계 왼눈(역안)에 아주 작은 빛
      if (f.mode === 'charge' && f.char === 'raiden') {
        const st = this.armor[i]?.state();
        if (st && st.stage > 0) {
          const [hx, hy] = [f.x / 256, GROUND_Y + f.y / 256 - 26];
          lights.point(hx, hy, 18 + 6 * st.stage, st.stage >= 4 ? COLORS.raidenLight : COLORS.raiden, (0.1 + 0.06 * st.stage + (st.pulse ? 0.35 : 0)) * st.fade);
        }
      } else if (f.mode === 'charge') {
        // 차지를 모으는 동안: 캐릭터가 광원이 되어 바닥과 벽을 비춘다 (단계마다 한 계단씩 넓고 밝게. 반짝임은 단계가 오를 때 한 번)
        const lv = Math.max(1, f.chargeLv);
        lights.point(f.x / 256, GROUND_Y + f.y / 256 - 24, 34 + 16 * lv, f.char === 'raiden' ? (lv >= 3 ? COLORS.raidenLight : COLORS.raiden) : rendersOf(f.char).light ?? (lv >= 3 ? COLORS.fxYellow : COLORS.fxOrange), 0.3 + 0.15 * lv);
      }
    });
    if (s.freeze > 0) {
      const who = s.events.find((e) => e.type === 'cutin')?.who ?? this.lastCutin;
      const f = s.fighters[who];
      if (f) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 26, 150, who === 0 ? COLORS.goldLight : COLORS.skyLight, 0.8);
    }
  }

  private lastCutin = 0;
  /** 공격마다 새 번호 (전신 전격이 자기 공격이 끝났는지 안다), 지금 전신 전격 세기 (빛) */
  private attackSerial = [0, 0];
  private auraLevel = [0, 0];
  private prevMoveId: Array<string | null> = [null, null];
  /** 지금 살아 있는 적뢰 (누가 쳤는지): 맞으면 섬광으로 되돌리고, 빛을 낸다 */
  private bolts: Array<{ who: number; fx: ReturnType<typeof raidenTrail> }> = [];
  /** 지상 1~4타 한 줄기 번개 (빛은 작게): 세기 1~4 */
  private strikes: Array<{ who: number; fx: ReturnType<typeof raidenStrike>; power: number }> = [];
  /** 투전승불: 모으는 동안의 전류 윤곽 (사람마다), 그 단계, 떼면서 낸 원뿔 방전 (빛을 낸다) */
  private armor: Array<ReturnType<typeof raidenChargeArmor> | null> = [null, null];
  private chargeStage = [0, 0];
  private cones: Array<{ fx: ReturnType<typeof raidenChargeCone>; power: number }> = [];
  /** 화과산: 날숨 반구 (빛), 전류 방벽 (사람마다: 언제 섰는지·튕긴 틱), 전격 저주 (저주를 건 사람마다), 밀려나며 발을 끄는 남은 틱 */
  private domes: Array<ReturnType<typeof hwagwasanDome>> = [];
  private barriers: Array<{ fx: ReturnType<typeof hwagwasanBarrier>; born: number; flash: number } | null> = [null, null];
  private curses: Array<ReturnType<typeof raidenCurse> | null> = [null, null];
  private dragT = [0, 0];
  /** 파천 몸 안으로 (56~80틱): 감추는 사람과 그 끝 틱 (그동안 이펙트가 어둡게 비친 몸을 대신 그린다) */
  private surge: ReturnType<typeof pacheonSurge> | null = null;
  private surgeHide = -1;
  private surgeUntil = 0;

  /** 이 사람을 그리지 않는가 (fight.ts: 이펙트가 대신 그린다) */
  hides(i: number): boolean {
    return i === this.surgeHide && this.now < this.surgeUntil;
  }
  /** 나중 틱에 낼 연출 (큰 물건이 쓰러져 땅에 닿는 순간 등). at은 sim 틱 */
  private later: Array<{ at: number; run: () => void }> = [];
  private now = 0;

  constructor(private layer: VfxLayer, private fx: Effects) {}

  /** 새 경기: 남은 이펙트를 지운다 */
  reset(s: SimState): void {
    this.layer.clear();
    clearScreenFx();
    this.debris.clear();
    this.later = [];
    this.round = s.round;
    this.since = [99, 99];
    this.blink = [0, 0];
    this.techReady = [false, false];
    this.prevMeter = s.fighters.map((f) => f.meter);
    this.prevMode = s.fighters.map((f) => f.mode);
  }

  /** sim 한 틱 뒤에 부른다 */
  tick(s: SimState): void {
    this.fighters = s.fighters;
    const shake = (k: number) => (t: number) => this.fx.shake(t * k);
    // 필살기 연출 장면의 타격 (렌더 전용): 발동자 동작마다 정해 둔 틱에 불꽃·빛·흔들림 (피해는 끝 타격에서 한 번)
    if (s.cine) {
      const c = s.cine;
      const motion = cineScenes(s)[c.scene].a.motion;
      for (const cue of CINE_CUES[motion] ?? []) if (cue.t === c.t) this.cineCue(s, cue.kind);
    }
    for (const g of this.glows) g.t++;
    this.glows = this.glows.filter((g) => g.t < g.life);
    this.now = s.tick;
    if (this.later.length) {
      const due = this.later.filter((l) => l.at <= s.tick);
      this.later = this.later.filter((l) => l.at > s.tick);
      for (const l of due) l.run();
    }
    for (const e of s.events) {
      s.fighters.forEach((f, i) => rendersOf(f.char).event?.(this.cfx, s, e, i));
      const strikeHit = e.type === 'hit' && s.fighters[e.who]?.char === 'raiden' && e.move ? raidenSmallHit(e.move, s.fighters[e.who]!.chargeLv) : undefined;
      // 라이덴 지상 1~4타는 줄기가 상대 몸을 지나 뻗으므로, 맞힌 자리(불꽃·빛)는 판정 상자 가운데가 아니라 상대 몸 앞쪽 가장자리
      const hitter = s.fighters[e.who];
      const struck = strikeHit && hitter ? s.fighters[1 - e.who] : undefined;
      const wx = struck ? struck.x / 256 - hitter!.facing * 5 : e.x / 256;
      const wy = GROUND_Y + e.y / 256;
      const x = wx * FX_PX;
      const y = wy * FX_PX;
      // 라이덴 지상 1~4타: 맞힘 빛은 작고 짧게 (12~20px, 2~3틱. 사용자 피드백 2026-11-02)
      if (strikeHit) this.glow(wx, wy, strikeHit.hitR, COLORS.raidenLight, 0.9, strikeHit.hitT);
      else if (e.type === 'hit') this.glow(wx, wy, e.heavy ? 90 : 56, e.move === 'super' ? (s.fighters[e.who]?.char === 'raiden' ? COLORS.raidenDark : COLORS.fxWhite) : s.fighters[e.who]?.char === 'raiden' ? COLORS.raidenLight : (s.fighters[e.who] && rendersOf(s.fighters[e.who].char).light) || COLORS.fxOrange, e.heavy ? 1 : 0.8, e.heavy ? 18 : 10);
      else if (e.type === 'block') this.glow(wx, wy, 44, COLORS.fxBlue, 0.7, 10);
      else if (e.type === 'crush') this.glow(wx, wy, 90, COLORS.fxYellow, 1, 20);
      else if (e.type === 'ko') this.glow(wx, wy, 130, COLORS.fxOrange, 1, 40);
      else if (e.type === 'wallsplat') this.glow(wx, wy, 80, COLORS.fxOrange, 0.9, 16);
      else if (e.type === 'charge') this.charge(s, e.who, e.text ?? '', e.combo ?? 1);
      else if (e.type === 'cutin') {
        this.lastCutin = e.who;
        this.glow(wx, wy - 26, 200, e.who === 0 ? COLORS.goldLight : COLORS.skyLight, 1, 50);
      }
      const att = s.fighters[e.who];
      const def = s.fighters[1 - e.who];
      const angle = att && att.facing > 0 ? 0 : Math.PI;
      if (e.type === 'hit') {
        const stop = e.move && att ? movesOf(att.char)[e.move].data.hitstop : 7;
        const size = strikeHit ? strikeHit.spark : e.heavy ? 0.7 : stop >= 9 ? 0.55 : 0.42;
        // 라이덴의 타격은 붉은 전격이 튄다 (캐릭터 기획서 '평타'): 불꽃에 더해 맞힌 자리에서 사방으로 짧은 번개가 튄다
        // 맞힌 자리 불꽃을 스스로 그리는 캐릭터 (오스카: 베기 선 끝의 작은 반짝임만)는 공통 불꽃을 쓰지 않는다
        if (!(att && rendersOf(att.char).ownSpark)) this.layer.add(impact({ kind: 'hit', x, y, angle, size, ramp: fxRamp(att?.char === 'raiden' ? RAIDEN_RAMP : (att && (rendersOf(att.char).ramp as ColorName[] | undefined)) || WARM), seed: this.seed++ }));
        // 라이덴 지상 1~4타: 작은 불꽃만 (흰 덩어리·엉킨 번개 없이), 4타는 짧게 흔들림
        if (strikeHit) {
          const lv = e.move === 'charge' && att ? Math.max(1, att.chargeLv) : 0;
          if (e.move === 'atk4') this.fx.shake(0.25);
          // 투전승불 3·4단계는 흔들림, 4단계는 상대 등 뒤로 짧은 방전 (몸을 뚫고 나간 전류)
          if (lv >= 3) this.fx.shake(lv >= 4 ? 0.35 : 0.25);
          if (lv >= 4 && att && def) this.behindDischarge(att, def);
          // 강한 타격의 화면 전체 번쩍임(effects.ts)은 라이덴 4타·투전승불 1~3단계에 쓰지 않는다: 맞힘 빛만 작게
          // (같은 틱에 KO·가드 크러시가 없을 때. 투전승불 4단계는 섬광 1틱을 남긴다)
          if (lv < 4 && e.move !== 'skill2' && !s.events.some((o) => o.type === 'ko' || o.type === 'crush' || (o.type === 'hit' && o !== e && o.heavy))) this.fx.flash = 0;
        } else if (att?.char === 'raiden') {
          // 맞으면 범위 번개가 섬광으로 되돌아가 히트스톱 동안 멈춰 보인다 (지침서 7-1장 '히트스톱')
          const bolt = this.bolts.find((b) => b.who === e.who);
          if (bolt) bolt.fx.rewind();
          this.boltBurst(x, y, att.facing, e.heavy ? 5 : 3, e.heavy ? 22 : 14);
          // 내려찍기 도끼차기: 맞은 자리에서 바닥으로 번개가 꽂혀 젖은 바닥을 타고 퍼진다
          if (e.move === 'slam' && def) this.groundDischarge(x, y, GROUND_Y + def.floor / 256);
        }
        this.since[1 - e.who] = 0;
        this.heavy[1 - e.who] = !!e.heavy;
        // 센 타격 환경 반응 (2026-11-02): 땅에 선 채 맞으면 발밑 젖은 바닥에서 물보라가 튀고, 흙먼지가 밀려나는 쪽으로 바닥을 따라 깔린다
        if (e.heavy && def && att && def.y > -4 * 256) {
          const fxw = def.x / 256;
          this.debris.burst('water', fxw, GROUND_Y - 2, att.facing, 10);
          this.debris.dustSweep(fxw, att.facing, e.move === 'super' ? 1.2 : 0.5);
        }
        // 화과산에 맞으면 밀려나는 두 발이 바닥을 끈다: 물 튐(raidenLasting)과 긁힌 자국 두 줄
        if (e.move === 'skill2' && att?.char === 'raiden' && def) {
          this.dragT[1 - e.who] = 22;
          const d = def;
          const footX = (): [number, number] => {
            const p = fighterPose(d);
            return [d.x / 256 + d.facing * p.joints.fF[0], d.x / 256 + d.facing * p.joints.fB[0]];
          };
          this.layer.add(hwagwasanDrag({ from: d.x / 256, floor: GROUND_Y + d.floor / 256, feet: footX, ramp: fxRamp(['fxBlue', 'suitGrey', 'suitGreyDark']), seed: this.seed++ }));
        }
        // 필살기 끝 타격: 흙먼지 폭발 (라이덴 파천은 검붉은 계열 하나: 주황 폭발·화면 번쩍임 없이, 잿더미는 넷째 장면에서 이미 났다)
        // (불꽃을 스스로 그리는 캐릭터는 폭발도 쓰지 않는다: 오스카 월령수류는 선을 따라 도시가 무너진다)
        if (e.move === 'super' && att?.char === 'raiden') this.fx.flash = 0;
        else if (e.move === 'super' && !(att && rendersOf(att.char).ownSpark)) {
          this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.5, surface: fxColor('street'), seed: this.seed++, shake: shake(0.3) }));
        }
      } else if (e.type === 'blink' && att && e.to !== undefined) {
        this.teleport(att, e.x, e.y, e.to, e.move);
      } else if (e.type === 'slowed' && def) {
        // 잔상에 닿아 느려짐: 닿은 사람 몸에서 붉은 전격이 튀고 잠깐 붉게 비춘다
        const [dx, dy] = feet(def);
        this.boltBurst(dx, dy - 26 * FX_PX, -att!.facing, 4, 12);
        this.layer.add(glint({ x: dx, y: dy - 26 * FX_PX, size: 0.7, ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']) }));
        this.glow(dx / FX_PX, dy / FX_PX - 26, 70, COLORS.raiden, 0.8, 14);
      } else if (e.type === 'kongo' && att) {
        // 라이덴 금강불괴 발동: 몸에서 붉은 빛이 한 번 크게 반짝이고 둘레를 비춘다
        const [fx, fy] = feet(att);
        this.layer.add(glint({ x: fx, y: fy - 26 * FX_PX, size: 1.2, ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']) }));
        this.glow(fx / FX_PX, fy / FX_PX - 26, 110, COLORS.raidenLight, 0.9, 24);
      } else if (e.type === 'block') {
        this.layer.add(impact({ kind: 'hit', x, y, angle, size: 0.32, ramp: fxRamp(COOL), seed: this.seed++ }));
      } else if (e.type === 'crush') {
        this.layer.add(impact({ kind: 'hit', x, y, angle, size: 0.8, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.3, surface: fxColor('street'), seed: this.seed++, fire: 0.1 }));
        // 가드 크러시 (공통 동작 사양서): 방어막이 깨지는 파편이 양쪽으로 튀고 화면이 짧게 흔들린다
        this.debris.burst('glass', wx, wy, 1, 6);
        this.debris.burst('glass', wx, wy, -1, 6);
        this.fx.shake(0.35);
        this.since[1 - e.who] = 0;
        this.heavy[1 - e.who] = true;
      } else if (e.type === 'prop') {
        if (BREAKABLES[e.who].big) this.bigProp(e.who, e.text === 'broken', wx, wy, s.props[e.who].dir, s.props[e.who].at);
        else this.prop(e.who, e.text === 'broken', !!e.heavy, s.props[e.who].dir);
      } else if (e.type === 'wreck') {
        this.wreck(s, e.who, e.combo ?? 0, e.text ?? '', wx, wy);
      } else if (e.type === 'city') {
        // 깎인 벽에서 벽돌 조각이 튄다
        const n = Math.min(12, 3 + (e.combo ?? 1) * 2);
        const cdir = e.x > (att?.x ?? 0) ? 1 : -1;
        this.debris.burst('brick', e.x / 256, GROUND_Y + e.y / 256, cdir, n);
        // 여러 덩어리가 한꺼번에 깎이면 큰 벽돌 덩어리도 떨어진다 (작은 부스러기와 구분되게)
        if ((e.combo ?? 1) >= 3) this.debris.chunks('brick', e.x / 256, GROUND_Y + e.y / 256, cdir, Math.min(4, (e.combo ?? 1) - 1), 0.8);
      } else if (e.type === 'collapse') {
        // 건물이 무너짐: 위 덩어리가 잔해로 떨어지고 큰 먼지 구름, 화면 흔들림
        const g = GRIDS[e.who];
        const [c0, c1] = (e.text ?? '0,0').split(',').map(Number);
        const fx0 = g.x + c0 * 16;
        const fx1 = Math.min(g.x + g.w, g.x + (c1 + 1) * 16);
        this.debris.collapse(fx0, fx1, g.h, facadeAtlas());
        // 무너진 폭만큼 큰 덩어리가 길 쪽으로 굴러 나오고, 먼지가 바닥을 따라 양옆으로 깔린다 (2026-11-02)
        this.debris.chunks('brick', (fx0 + fx1) / 2, GROUND_Y - 20, 1, Math.min(10, 3 + (e.combo ?? 16) / 16), 1.2);
        this.debris.chunks('concrete', (fx0 + fx1) / 2, GROUND_Y - 20, -1, Math.min(8, 2 + (e.combo ?? 16) / 24), 1);
        this.after(10, () => {
          this.debris.dustSweep(fx1, 1, Math.min(1.6, 0.6 + (e.combo ?? 16) / 64));
          this.debris.dustSweep(fx0, -1, Math.min(1.6, 0.6 + (e.combo ?? 16) / 64));
        });
        // 넓게 무너질수록 크게 흔들린다 (기둥 한 줄 0.45 ~ 여섯 줄 이상 0.85)
        this.fx.shake(Math.min(0.85, 0.35 + (e.combo ?? 16) / 16 * 0.08));
        if ((e.combo ?? 0) >= 48) this.fx.flashFor(1);
      } else if (e.type === 'wallsplat') {
        // 벽꽝: 정면에 박히는 큰 충격
        this.layer.add(impact({ kind: 'hit', x, y, angle: -Math.PI / 2, size: 0.9, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('brick', e.x / 256, GROUND_Y + e.y / 256, 1, 10);
        this.debris.burst('brick', e.x / 256, GROUND_Y + e.y / 256, -1, 10);
        this.debris.chunks('brick', e.x / 256, GROUND_Y + e.y / 256, 1, 3, 0.9);
        this.debris.chunks('brick', e.x / 256, GROUND_Y + e.y / 256, -1, 3, 0.9);
        this.debris.dustCloud(e.x / 256 - 16, e.x / 256 + 16, 0.6);
        this.fx.shake(0.5);
      } else if (e.type === 'ko') {
        this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.45, surface: fxColor('street'), seed: this.seed++, shake: shake(0.2) }));
      } else if (e.type === 'wallrun') {
        // 벽을 딛는 첫 발 (먼지와 부스러기), 꼭대기 모서리를 넘을 때 (작은 먼지)
        const f = s.fighters[e.who];
        const out = f ? f.wallSide : 1;
        if (e.text === 'start') {
          this.layer.add(impact({ kind: 'hit', x, y: y - 10 * FX_PX, angle: out > 0 ? 0 : Math.PI, size: 0.25, ramp: fxRamp(COOL), seed: this.seed++ }));
          this.debris.dustCloud(wx - 4, wx + 4, 0.4, wy);
        } else this.debris.dustCloud(wx - 6, wx + 6, 0.3, wy);
        this.debris.burst('brick', wx, wy - 6, out, 3);
      } else if (e.type === 'walljump') {
        // 두 발로 벽을 차는 자리: 벽에서 튀는 먼지와 부스러기
        const f = s.fighters[e.who];
        const out = f ? f.facing : 1;
        this.layer.add(impact({ kind: 'hit', x, y, angle: out > 0 ? 0 : Math.PI, size: 0.3, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('brick', wx, wy, out, 4);
        this.debris.dustCloud(wx - 3, wx + 3, 0.35, wy + 6);
      } else if (e.type === 'round' && s.round === 1) {
        // 등장: 두 사람이 위에서 내려선 자리에 충격과 먼지, 바닥 부스러기, 가벼운 흔들림
        for (const f of s.fighters) {
          // 라이덴은 번개와 함께 떨어지는 자기 등장 연출이 따로 있다 (raidenIntro)
          if (f.char === 'raiden' || rendersOf(f.char).ownIntro) continue;
          const fx = f.x / 256;
          const [px, py] = feet(f);
          this.layer.add(impact({ kind: 'hit', x: px, y: py, angle: -Math.PI / 2, size: 0.3, ramp: fxRamp(COOL), seed: this.seed++ }));
          this.debris.dustCloud(fx - 14, fx + 14, 0.4);
          this.debris.burst('brick', fx, GROUND_Y - 2, 1, 3);
          this.debris.burst('brick', fx, GROUND_Y - 2, -1, 3);
        }
        this.fx.shake(0.25);
      } else if (e.type === 'citadel') {
        this.citadel(e.text ?? '', e.combo ?? 0, wx, wy, e.x > (att?.x ?? 0) ? 1 : -1);
      } else if (e.type === 'walltech') {
        // 벽 낙법: 정면을 박차는 자리에서 푸른 충격과 먼지, 빠져나온 몸이 잠깐 빛난다
        this.glow(wx, wy, 60, COLORS.fxBlue, 0.9, 14);
        this.layer.add(impact({ kind: 'hit', x, y, angle: -Math.PI / 2, size: 0.32, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.dustCloud(wx - 6, wx + 6, 0.35, wy + 10);
        this.debris.burst('brick', wx, wy, 1, 3);
        this.debris.burst('brick', wx, wy, -1, 3);
      } else if (e.type === 'wallkick') {
        // 벽을 박차고 나가는 자리: 벽 점프보다 조금 센 충격, 튀는 부스러기와 먼지
        const f = s.fighters[e.who];
        const out = f ? f.facing : 1;
        this.layer.add(impact({ kind: 'hit', x, y, angle: out > 0 ? 0 : Math.PI, size: 0.36, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('brick', wx, wy, out, 5);
        this.debris.dustCloud(wx - 3, wx + 3, 0.4, wy + 6);
      } else if (e.type === 'wallcling') {
        // 벽에 등이 부딪히는 작은 충격과 벽에서 떨어지는 부스러기
        const f = s.fighters[e.who];
        const out = f ? f.wallSide : 1;
        this.layer.add(impact({ kind: 'hit', x, y, angle: out > 0 ? 0 : Math.PI, size: 0.22, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('brick', wx, wy, out, 3);
      } else if (e.type === 'char' && att?.char === 'raiden') this.raidenEvent(s, e.text ?? '', e.x, e.y, e.combo ?? 1, att);
      else if (e.type === 'cine' && e.text === 'whiff' && att?.char === 'raiden') this.pacheonWhiff(att);
    }

    s.fighters.forEach((f, i) => {
      const side = i as 0 | 1;
      rendersOf(f.char).tick?.(this.cfx, s, f, i);
      // 라이덴 등장: 번개가 쾅! 내리꽂히고 → 그 속에서 떨어져 → 히어로 랜딩 충격 (바닥 먼지·부스러기·사방으로 튀는 전격)
      if (f.mode === 'intro' && f.char === 'raiden') this.raidenIntro(f);
      // 라이덴 화과산이 남긴 전류 방벽과 전격 저주 (sim/chars/raiden.ts)
      if (f.char === 'raiden') this.raidenLasting(s, f, i);
      // 라이덴 투전승불: 모으는 동안 뼈대를 따라 번지는 전류 윤곽, 탈진하는 동안 김
      if (f.char === 'raiden') this.raidenChargeTick(s, f, i);
      // 잔상에 닿아 느려진 동안: 몸 둘레에서 짧은 붉은 전격이 지직거린다
      if (f.slowT > 0 && s.tick % 7 === 0) {
        const [fx, fy] = feet(f);
        const k = this.seed % 4;
        const x0 = fx + (k - 1.5) * 6 * FX_PX;
        const y0 = fy - (14 + ((this.seed * 7) % 20)) * FX_PX;
        this.layer.add(arc({ path: [[x0, y0], [x0 + (k % 2 ? 9 : -9) * FX_PX, y0 + (k < 2 ? -7 : 6) * FX_PX]], ramp: fxRamp(BOLT), seed: this.seed++, sweep: 0.02, hold: 0.04, width: 0, jag: 2, forks: 0, sparks: 2 }));
      }
      // 벽을 달려 오르는 동안: 발이 벽을 딛는 자리에서 먼지가 인다
      if (f.mode === 'wallrun' && f.t % 5 === 2) {
        const fy = GROUND_Y + f.y / 256;
        this.debris.dustCloud(f.wallX - 2, f.wallX + 2, 0.15, fy - 10);
      }
      // 벽에 붙어 미끄러지는 동안: 손·발이 긁는 자리에서 먼지가 인다
      if (f.mode === 'wallcling' && f.vy > 128 && s.tick % 5 === 0) {
        const fy = GROUND_Y + f.y / 256;
        this.debris.dustCloud(f.wallX - 2, f.wallX + 2, 0.15, fy - 8);
      }
      // 대시·공중 대시가 시작되는 틱: 잔상과 박차는 먼지
      if ((f.mode === 'dash' || f.mode === 'airdash') && this.prevMode[i] !== f.mode && !(f.mode === 'dash' && rendersOf(f.char).ownDash)) {
        const air = f.mode === 'airdash';
        const st = statsOf(f.char);
        const ticks = air ? st.airDashMoveTo : st.dashMoveTo - st.dashMoveFrom;
        const speed = air ? st.airDashSpeed : st.dashSpeed;
        const fighter = f;
        this.layer.add(dashBlink({
          kind: 'dash',
          actor: { feet: () => feet(fighter), silhouette: () => silhouette(fighter, this.skinOf(fighter)) },
          facing: f.facing * f.dir,
          distance: ((speed * ticks) / 256) * FX_PX,
          time: ticks / 60,
          delay: 0,
          colors: fxRamp(rampOf(f, side)),
          groundColor: fxColor('street'),
          ground: air ? feet(f)[1] : GROUND_Y * FX_PX,
          seed: this.seed++,
          shake: shake(0.4),
        }));
      }
      // 휘두르는 공격의 궤적. 번개 사거리가 있는 기술(라이덴)은 치는 팔다리 끝이 지나간 길을 따라 붉은 번개가 휩쓴다
      if (f.mode === 'attack' && f.move) {
        const mv = movesOf(f.char)[f.move];
        // 새 공격이 시작됐다 (연타로 다음 타가 이어져도): 라이덴은 공격 내내 전격이 전신을 휘감는다
        if (this.prevMoveT[i] < 0 || f.t < this.prevMoveT[i] || f.move !== this.prevMoveId[i]) {
          this.attackSerial[i]++;
          // 지상 1~4타는 전신 전격 없이 줄기 하나만 (사용자 피드백 2026-11-02 '이펙트가 몸 밖으로 뻗는다': 두 실루엣을 덮지 않는다)
          if (f.char === 'raiden' && f.move === 'skill2') this.hwagwasanInhale(f, mv);
          else if (f.char === 'raiden' && !RAIDEN_STRIKE[f.move] && f.move !== 'charge' && f.move !== 'super') this.raidenAura(f, i, mv);
          rendersOf(f.char).attackStart?.(this.cfx, s, f, i, f.move);
        }
        this.prevMoveId[i] = f.move;
        if (f.char === 'raiden') this.auraLevel[i] = RAIDEN_STRIKE[f.move] || f.move === 'charge' || f.move === 'skill2' || f.move === 'super' ? 0 : auraLevelOf(mv, f.t);
        const swing = mv.data.reach || mv.data.box ? undefined : SWINGS[f.move];
        const starts = f.t >= mv.activeStart && this.prevMoveT[i] < mv.activeStart;
        // 라이덴 적뢰 (동작연출지침서 7-1장): 궤적 상자가 있는 기술은 타격 프레임에 번개가 범위를 통째로 채운다 (헛쳐도)
        if (mv.data.box && f.char === 'raiden' && starts) {
          if (f.move === 'skill2') this.hwagwasan(f);
          else if (f.move === 'charge') this.raidenCone(f, mv);
          // 파천 붕권은 번개 없이 디딤(바닥 금·물 튐)과 주먹만: 연출 장면이 전격을 맡는다 (사용자 피드백 2026-11-02 9-4)
          else if (f.move === 'super') void 0;
          else if (RAIDEN_STRIKE[f.move]) this.raidenStrike(f, i, f.move, mv);
          else this.rangeBolt(f, i, f.move, mv);
        }
        else if (mv.data.reach && starts) this.boltSweep(f, f.move, mv);
        // 다른 캐릭터(지금은 기본 스틱맨): 주먹·발 끝이 지난 길을 따라 대표 색 궤적 띠 (지침서 5장)
        else if (f.char !== 'raiden' && starts) {
          const strike = rendersOf(f.char).strike;
          if (strike) strike(this.cfx, s, f, i, f.move);
          else this.attackTrail(f, mv, i as 0 | 1);
        }
        // 크게 내디디는 프레임이 시작하면 앞발 자리에 물 튐과 먼지 (지침서 5장 '발밑')
        if (mv.advance && f.char === 'raiden') this.stepSplash(f, mv, i);
        if (swing && f.t >= mv.activeStart && this.prevMoveT[i] < mv.activeStart) {
          const [fx, fy] = feet(f);
          this.layer.add(slash({
            x: fx + f.facing * 6 * FX_PX, y: fy + swing.dy * FX_PX, facing: f.facing, size: swing.size, squash: swing.squash,
            tilt: swing.tilt, from: swing.from, to: swing.to, ramp: fxRamp(STEEL), sparkRamp: fxRamp(WARM.slice(1, 5)),
            ground: GROUND_Y * FX_PX, seed: this.seed++,
          }));
        }
        this.prevMoveT[i] = f.t;
      } else {
        this.prevMoveT[i] = -1;
        this.prevMoveId[i] = null;
        this.auraLevel[i] = 0;
      }
      // 기력 3칸이 찬 순간: 오라가 켜지고, 찬 동안 유지된다
      if (f.meter >= RULES.METER_MAX && this.prevMeter[i] < RULES.METER_MAX) {
        const fighter = f;
        this.layer.add(powerUp({
          actor: { feet: () => feet(fighter), silhouette: () => silhouette(fighter, this.skinOf(fighter)) },
          palette: fxHex(rampOf(f, side)),
          size: 0.55,
          seed: this.seed++,
          sustain: () => fighter.meter >= RULES.METER_MAX,
          shake: shake(0.5),
        }));
      }
      // 다운: 한 번 튀었다가 다시 바닥에 닿는 순간 (6번 프레임) 몸을 따라 먼지가 인다
      if (f.mode === 'knockdown' && f.t === KD_RELAND_T) {
        // 누운 몸은 머리가 뒤쪽 약 20px, 발이 앞쪽 약 25px
        const a = f.x / 256 - 20 * f.facing;
        const b = f.x / 256 + 25 * f.facing;
        this.debris.dustCloud(Math.min(a, b), Math.max(a, b), 0.35, GROUND_Y + f.y / 256);
      }
      // 공중에서 맞는 중 낙법이 가능해진 순간 (콤보 TECH_HITS대 이상, 히트스톱이 끝난 틱) 몸이 한 번 하얗게 깜빡인다
      const ready = f.mode === 'airhit' && f.comboHits >= RULES.TECH_HITS && f.hitstop === 0;
      if (ready && !this.techReady[i]) this.blink[i] = TECH_BLINK;
      this.techReady[i] = ready;
      if (this.blink[i] > 0) this.blink[i]--;
      this.prevMeter[i] = f.meter;
      this.prevMode[i] = f.mode;
      if (this.since[i] < 99) this.since[i]++;
    });
    // 새 라운드: 날던 조각만 지운다 (부서진 자리와 잔해 더미는 sim 상태라 그대로 남는다)
    if (s.round !== this.round) {
      this.round = s.round;
      this.debris.clear();
    }
    // 건물이 무너지는 슬로모션 동안은 연출도 반 속도
    const dt = s.slow > 0 ? 0.5 : 1;
    this.debris.tick(dt);
    this.layer.tick(dt);
  }

  /** 라이덴 등장 연출 (틱마다): 번개 → 떨어짐 → 히어로 랜딩 충격 → 무릎 꿇은 동안 몸 둘레 전격 → 일어날 때 주먹 자리 먼지 */
  private raidenIntro(f: Fighter): void {
    const [fx, fy] = feet(f);
    const wx = fx / FX_PX;
    const wy = fy / FX_PX;
    const I = RAIDEN_INTRO;
    if (f.t === I.hide) {
      // 쾅: 하늘에서 굵은 번개 두 줄기가 제자리에 내리꽂히고 화면이 번쩍인다
      this.layer.add(lightning({ x: fx, y: fy, length: 320 * FX_PX, ramp: fxRamp(RAIDEN_RAMP), seed: this.seed++ }));
      this.layer.add(lightning({ x: fx + f.facing * 5 * FX_PX, y: fy, length: 300 * FX_PX, ramp: fxRamp(RAIDEN_RAMP), seed: this.seed++ }));
      this.glow(wx, wy - 50, 170, COLORS.raidenLight, 1, 16);
      this.fx.flashFor(1);
      this.fx.shake(0.35);
    }
    if (f.t === I.land) {
      // 히어로 랜딩: 땅에 박히는 충격, 양쪽으로 부스러기와 먼지, 주먹 자리에서 사방으로 전격
      const fist = f.facing * 18;
      this.layer.add(impact({ kind: 'hit', x: fx + fist * FX_PX, y: fy - 2 * FX_PX, angle: -Math.PI / 2, size: 0.85, ramp: fxRamp(RAIDEN_RAMP), seed: this.seed++ }));
      this.boltBurst(fx + fist * FX_PX, fy - 2 * FX_PX, f.facing, 5, 24);
      this.boltBurst(fx + fist * FX_PX, fy - 2 * FX_PX, -f.facing, 3, 18);
      this.debris.dustCloud(wx - 30, wx + 30, 0.8, wy);
      this.debris.burst('brick', wx + fist, wy - 2, 1, 7);
      this.debris.burst('brick', wx + fist, wy - 2, -1, 7);
      this.glow(wx + fist, wy - 10, 140, COLORS.raiden, 1, 20);
      this.fx.shake(0.6);
      this.fx.flashFor(1);
    }
    // 무릎 꿇고 있는 동안: 몸 둘레에서 짧은 붉은 전격이 지직거린다
    if (f.t > I.land + 4 && f.t < I.land + 30 && f.t % 5 === 0) {
      const k = this.seed % 3;
      const x0 = fx + f.facing * (k * 7 - 6) * FX_PX;
      const y0 = fy - (6 + k * 5) * FX_PX;
      this.layer.add(arc({ path: [[x0, y0], [x0 + f.facing * (k % 2 ? 10 : -8) * FX_PX, y0 - (6 + k * 3) * FX_PX]], ramp: fxRamp(BOLT), seed: this.seed++, sweep: 0.02, hold: 0.05, width: 0, jag: 2, forks: 1, sparks: 2 }));
    }
    // 주먹으로 바닥을 밀고 일어나는 순간: 주먹 자리에서 작은 먼지
    if (f.t === I.land + 30) this.debris.dustCloud(wx + f.facing * 14, wx + f.facing * 22, 0.3, wy);
  }

  /**
   * 순간이동 (라이덴 스킬 1 잔흔, Dash & Blink 붉은색): 떠난 자리에 웅크린 실루엣이 붉은 잔상으로 남아 어두워지다 사라지고
   * (sim 잔상과 같은 시간), 떠난 자리에서 나타난 자리까지 붉은 번개 한 줄기가 지나가며, 나타난 자리에서 불꽃이 터진다.
   * x·y: 떠난 자리, to: 나타난 자리 x (1/256px)
   */
  private teleport(f: Fighter, x: number, y: number, to: number, move?: string): void {
    const mv = move ? movesOf(f.char)[move as keyof ReturnType<typeof movesOf>] : undefined;
    const frame = Math.max(0, (mv?.data.blink?.at ?? 1) - 1);
    const wx = x / 256;
    const wy = GROUND_Y + y / 256;
    const tx = to / 256;
    const sil = mv ? silhouetteAt(mv.data.motion, frame, f.facing, this.skinOf(f), wx, wy) : null;
    this.layer.add(dashBlink({
      kind: 'blink',
      actor: { feet: () => [wx * FX_PX, wy * FX_PX], silhouette: () => sil },
      to: tx * FX_PX,
      colors: fxRamp(RAIDEN_RAMP),
      seed: this.seed++,
      shake: (t) => this.fx.shake(t * 0.6),
      blinkTimes: { out: 0.02, in: 0.02, arrive: 0.06, linger: RULES.ZAN_TICKS / 60 - 0.03 },
      ghostSolid: true,
    }));
    // 지나간 길: 허리 높이로 붉은 번개 한 줄기
    if (Math.abs(tx - wx) > 4) {
      this.layer.add(arc({
        path: [[wx * FX_PX, (wy - 22) * FX_PX], [tx * FX_PX, (wy - 22) * FX_PX]],
        ramp: fxRamp(BOLT), seed: this.seed++, sweep: 0.03, hold: 0.08, width: 2, jag: 3, forks: 3, sparks: 6,
      }));
    }
    this.glow(wx, wy - 24, 70, COLORS.raiden, 0.9, 12);
    this.glow(tx, wy - 24, 80, COLORS.raidenLight, 0.9, 10);
    this.debris.dustCloud(tx - 8, tx + 8, 0.3, wy);
  }

  /**
   * 번개 휩쓸기 (라이덴: 공격마다 붉은 전격이 휩쓴다): 판정이 나오는 틱에 치는 팔다리 끝이 지나간 길을 따라
   * 번개 사거리 끝까지 뻗는다. 끝 자리가 잠깐 붉게 둘레를 비춘다. 차지는 모은 단계가 높을수록 굵고 갈래가 많다
   */
  private boltSweep(f: Fighter, id: string, mv: MoveOf): void {
    const path = sweepPath(mv);
    if (!path) return;
    const ox = f.x / 256;
    const oy = GROUND_Y + f.y / 256;
    const world = path.map(([x, y]) => [(ox + f.facing * x) * FX_PX, (oy + y) * FX_PX] as [number, number]);
    const lv = id === 'charge' ? Math.max(1, f.chargeLv) : 0;
    const heavy = HEAVY_SWEEP.has(id);
    this.layer.add(arc({
      path: world,
      ramp: fxRamp(BOLT),
      seed: this.seed++,
      width: heavy ? 2 : 1,
      jag: heavy ? 3 : 2.5,
      forks: 2 + lv,
      sparks: heavy ? 8 : 5,
      hold: 0.07 + 0.02 * lv,
    }));
    // 차지 3·4단계는 한 번 더 겹쳐 굵은 번개 두 줄기
    if (lv >= 3) this.layer.add(arc({ path: world, ramp: fxRamp(BOLT), seed: this.seed++, width: 1, jag: 4, forks: 3, sparks: 6, sweep: 0.07, hold: 0.1 }));
    const [tx, ty] = world[world.length - 1];
    this.glow(tx / FX_PX, ty / FX_PX, heavy ? 60 + 10 * lv : 40, COLORS.raiden, heavy ? 0.9 : 0.7, heavy ? 10 : 7);
  }

  /** 전신 전격: 이 공격이 이어지는 동안 팔다리·몸통을 휘감는 붉은 전격 (사용자 피드백 '전신을 휘감고') */
  private raidenAura(f: Fighter, i: number, mv: MoveOf): void {
    const serial = this.attackSerial[i];
    const end = mv.data.limb?.[1];
    const tip = end === 'hF' || end === 'hB' || end === 'fF' || end === 'fB' || end === 'kF' || end === 'kB' ? end : 'hF';
    this.layer.add(raidenAura({
      joints: () => {
        const p = fighterPose(f);
        const ox = f.x / 256;
        const oy = GROUND_Y + f.y / 256;
        const W = (q: readonly [number, number]) => [(ox + f.facing * q[0]) * FX_PX, (oy + q[1]) * FX_PX] as const;
        const j = p.joints;
        return { hip: W(j.hip), neck: W(j.neck), head: W(j.head), shF: W(j.shF), eF: W(j.eF), hF: W(j.hF), shB: W(j.shB), eB: W(j.eB), hB: W(j.hB), kF: W(j.kF), fF: W(j.fF), kB: W(j.kB), fB: W(j.fB) } as AuraJoints;
      },
      level: () => this.auraLevel[i],
      alive: () => f.mode === 'attack' && this.attackSerial[i] === serial,
      tip,
      ramp: fxRamp(BOLT_RANGE),
      seed: this.seed++,
    }));
  }

  /**
   * 라이덴 지상 1~4타 번개 (사용자 피드백 2026-11-02): 판정이 시작하는 틱에 주먹·발에서 한 방향으로 뻗는 줄기 하나.
   * 잽·크로스 = 주먹에서 앞으로 곧게 상자 끝까지, 미들킥 = 상자 왼쪽 가운데를 중심으로 아래 → 앞 → 위 반원(몸 앞쪽에만),
   * 슈퍼맨 펀치 = 주먹에서 바닥으로 꽂혀 바닥 가까이 상자 끝까지 달리고 끝에서 갈래. 궤적 상자 = 판정 = 번개 범위
   */
  private raidenStrike(f: Fighter, who: number, id: string, mv: MoveOf): void {
    const cfg = RAIDEN_STRIKE[id]!;
    const b = mv.data.box!;
    const ox = f.x / 256;
    const oy = GROUND_Y + f.y / 256;
    const W = (x: number, y: number): P2 => [(ox + f.facing * x) * FX_PX, (oy + y) * FX_PX];
    const j = mv.frames.joints[mv.data.active[0]];
    const tip = j[(mv.data.limb?.[1] ?? 'hF') as 'hF'];
    const end = b.x + b.w;
    let path: P2[];
    if (b.shape === 'arc') {
      // 허리 높이 몸 앞쪽 반원: 가운데 (b.x, 가운데 높이), 반지름 b.h/2, 아래(90°) → 앞(0°) → 위(−90°)
      const cy = b.y + b.h / 2;
      const r = b.h / 2;
      path = Array.from({ length: 10 }, (_, k) => {
        const a = (Math.PI / 2) * (1 - (2 * k) / 9);
        return W(b.x + Math.cos(a) * r, cy + Math.sin(a) * r);
      });
    } else if (b.shape === 'ground') {
      // 바닥 가까이 (바닥 위 3px) 상자 앞끝에서 상자 끝까지 앞으로 달린다. 주먹은 상대 머리 높이에 닿아 있으므로
      // 주먹에서 바닥으로 꽂으면 줄기가 상대 몸을 세로로 가른다: 줄기는 두 사람 사이 바닥에서 시작한다
      const floor = f.floor / 256 - f.y / 256 - 3;
      path = [W(b.x, floor), W((b.x + end) / 2, floor), W(end, floor)];
    } else path = [W(tip[0], tip[1]), W(end, tip[1])];
    const fighter = f;
    const fx = raidenStrike({
      path,
      width: cfg.width,
      branches: cfg.branches,
      forks: cfg.forks,
      jag: cfg.jag,
      ramp: fxRamp(BOLT_RANGE),
      seed: this.seed++,
      held: () => fighter.hitstop > 0,
    });
    this.layer.add(fx);
    this.strikes = this.strikes.filter((x) => x.who !== who);
    this.strikes.push({ who, fx, power: Object.keys(RAIDEN_STRIKE).indexOf(id) + 1 });
  }

  /**
   * 라이덴 적뢰 (동작연출지침서 7-1장): 타격 프레임에 주먹·발 끝에서 번개가 터져 궤적 상자(= sim 판정)를 섬광 → 방전 → 잔광으로 채운다.
   * 1타 → 4타·차지로 갈수록 굵고 가지가 많다 (power). 히트스톱 동안은 멈춘다
   */
  private rangeBolt(f: Fighter, who: number, id: string, mv: MoveOf): void {
    const ox = f.x / 256;
    const oy = GROUND_Y + f.y / 256;
    // 차지는 모은 단계마다 번개가 길어진다 (단계별 궤적 상자 = sim 판정). 3·4단계는 가장 굵게, 4단계는 화면 폭 절반까지
    const lv = id === 'charge' ? Math.max(1, f.chargeLv) : 0;
    const box = (lv ? mv.data.charge?.levels[lv - 1]?.box : undefined) ?? mv.data.box!;
    const power = lv ? Math.min(4, 1 + lv) : RANGE_POWER[id] ?? 1;
    const fighter = f;
    const W = (x: number, y: number): P2 => [(ox + f.facing * x) * FX_PX, (oy + y) * FX_PX];
    const fx = raidenTrail({
      path: trailPath(mv, id, box).map(([x, y]) => W(x, y)),
      power,
      ramp: fxRamp(BOLT_RANGE),
      seed: this.seed++,
      held: () => fighter.hitstop > 0,
      ground: (GROUND_Y + f.floor / 256) * FX_PX,
    });
    this.layer.add(fx);
    this.bolts = this.bolts.filter((x) => x.who !== who);
    this.bolts.push({ who, fx });
    if (power >= 3) this.fx.shake(0.15 + 0.05 * power);
    const floorY = GROUND_Y + f.floor / 256;
    const end = box.x + box.w;
    // 4타 슈퍼맨 펀치·차지 3단계 이상 (지침서 7-1장 '4타는 앞으로 뻗은 줄기가 맵 바닥을 타고 더 멀리 달린다', 판정은 상자까지):
    // 상자 끝에서 바닥으로 꺾여 내려가 젖은 바닥을 타고 앞으로 더 달리는 번개
    if (id === 'atk4' || lv >= 3) {
      const run = id === 'atk4' ? 110 : 60 + 40 * lv;
      const sy = box.y + box.h / 2;
      this.layer.add(arc({
        path: [W(end - 4, sy), W(end + 10, (sy + (floorY - oy)) / 2), W(end + 18, floorY - oy - 1), W(end + 18 + run, floorY - oy - 1)],
        ramp: fxRamp(BOLT), seed: this.seed++, sweep: 0.1, hold: 0.12, width: 1, jag: 2.5, forks: 4, sparks: 8,
      }));
      this.glow(ox + f.facing * (end + 18 + run / 2), floorY - 4, 70 + run / 3, COLORS.raiden, 0.8, 14);
    }
    // 쓸기: 쓰는 발 끝을 따라 젖은 바닥의 물이 반원으로 튄다
    if (id === 'sweep' && f.y >= 0) {
      for (let k = 0; k < 4; k++) this.debris.burst('water', ox + f.facing * (box.x + (box.w * (k + 1)) / 5), floorY - 1, f.facing, 4);
      this.debris.dustCloud(ox + f.facing * box.x, ox + f.facing * end, 0.3, floorY);
    }
  }

  /**
   * 라이덴 스킬 2 화과산 날숨 (판정이 시작하는 틱, 사용자 피드백 2026-11-02 9-3): 가슴을 펴는 순간 바닥에 붙은 반구(반지름 40 = 판정)
   * 안에서 스파크가 바깥으로 튄다. 흰 섬광 1틱, 발치 물 튐. 고리·마법진 모양은 쓰지 않는다
   */
  private hwagwasan(f: Fighter): void {
    const ox = f.x / 256;
    const floor = GROUND_Y + f.floor / 256;
    const b = movesOf(f.char).skill2.data.box!;
    const fx = hwagwasanDome({ x: ox, floor: GROUND_Y + f.y / 256, r: b.h, ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']), seed: this.seed++ });
    this.layer.add(fx);
    this.domes.push(fx);
    if (f.y >= f.floor) {
      this.debris.burst('water', ox - 12, floor - 1, -1, 4);
      this.debris.burst('water', ox + 12, floor - 1, 1, 4);
    }
    this.fx.shake(0.2);
    this.fx.flashFor(1);
  }

  /** 화과산 들숨 (0~6틱): 어깨가 올라가며 웅크리는 동안 몸 윤곽을 따라 전류가 돈다 (맥동·튀는 줄기 없이) */
  private hwagwasanInhale(f: Fighter, mv: MoveOf): void {
    const fighter = f;
    this.layer.add(raidenChargeArmor({
      body: () => this.chargeBody(fighter),
      stage: () => (fighter.mode === 'attack' && fighter.move === 'skill2' && fighter.t < mv.activeStart ? 3 : 0),
      alive: () => fighter.mode === 'attack' && fighter.move === 'skill2' && fighter.t < mv.activeStart,
      ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']),
      hair: fxRamp(['raidenLight', 'raiden', 'raidenDark']),
      hairStage: 9,
      quiet: true,
      seed: this.seed++,
    }));
  }

  /** 라이덴 고유 사건 (sim/chars/raiden.ts): 전류 방벽이 섬, 방벽이 상대를 튕겨 냄, 전격 저주, 파천 잿더미 줄 */
  private raidenEvent(s: SimState, text: string, x: number, y: number, dir: number, att: Fighter): void {
    const wx = x / 256;
    const wy = GROUND_Y + y / 256;
    const floor = GROUND_Y + att.floor / 256;
    const who = s.fighters.indexOf(att);
    if (text === 'barrier') {
      // 라이덴 앞 40px(두 사람 사이)에 세로 전류 커튼 (5틱 뒤에 바닥에서 솟는다 = 화과산 12틱째)
      const rec = { fx: null as unknown as ReturnType<typeof hwagwasanBarrier>, born: s.tick, flash: -99 };
      rec.fx = hwagwasanBarrier({
        x: () => att.ext[RAIDEN_EXT.barrierX] / 256,
        floor,
        h: RAIDEN_BARRIER_H,
        left: () => (this.barriers[who] === rec ? att.ext[RAIDEN_EXT.barrierT] : 0),
        delay: 5,
        flashAt: () => rec.flash - rec.born,
        ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']),
        seed: this.seed++,
      });
      this.barriers[who] = rec;
      this.layer.add(rec.fx);
      this.debris.burst('water', wx, floor - 1, dir, 4);
    } else if (text === 'deflect') {
      // 방벽에 튕겨 나감: 커튼이 번쩍이고 부딪힌 자리에서 작은 불꽃
      const rec = this.barriers[who];
      if (rec) rec.flash = s.tick;
      this.layer.add(impact({ kind: 'hit', x: wx * FX_PX, y: (wy - 24) * FX_PX, angle: dir > 0 ? 0 : Math.PI, size: 0.3, ramp: fxRamp(RAIDEN_RAMP), seed: this.seed++ }));
      this.glow(wx, wy - 30, 40, COLORS.raidenLight, 0.9, 4);
      this.fx.shake(0.15);
    } else if (text === 'curse') {
      // 전격 저주: 밀려난 상대 머리 위 작은 표식 + 2.5초마다 몸 윤곽을 따라 검붉은 금 간 전류
      const def = s.fighters[1 - who];
      if (def) {
        const fx = raidenCurse({
          body: () => this.chargeBody(def),
          left: () => (this.curses[who] === fx ? att.ext[RAIDEN_EXT.curseT] : 0),
          ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']),
          seed: this.seed++,
        });
        this.curses[who] = fx;
        this.layer.add(fx);
      }
    } else if (text === 'ash') {
      // 파천 넷째 장면 (96틱째): 맞은 상대 등 뒤로 땅과 건물이 일직선으로 잿빛으로 무너진다 (sim이 깎은 자리)
      // 잿빛 먼지·벽돌 조각, 검붉은 불씨, 바닥을 타는 검붉은 전격(흰 심). 주황 불길은 쓰지 않는다 (검붉은 계열 하나)
      const len = PACHEON_ASH.length;
      const x1 = wx + dir * len;
      this.debris.dustCloud(Math.min(wx, x1), Math.max(wx, x1), 1, floor);
      for (let d = 30; d <= len; d += 45) this.debris.burst('brick', wx + dir * d, floor - 4 - (d % 3) * 12, dir, 4);
      this.layer.add(pacheonEmbers({ x0: wx, x1, floor, life: 70, ramp: fxRamp(PACHEON_RAMP), seed: this.seed++ }));
      this.layer.add(arc({
        path: [[wx * FX_PX, (floor - 2) * FX_PX], [(wx + dir * len * 0.5) * FX_PX, (floor - 4) * FX_PX], [x1 * FX_PX, (floor - 2) * FX_PX]],
        ramp: fxRamp(PACHEON_RAMP), seed: this.seed++, sweep: 0.1, hold: 0.25, width: 2, jag: 3, forks: 5, sparks: 10,
      }));
      this.glow(wx + (dir * len) / 2, floor - 20, 220, COLORS.raidenDark, 1, 30);
      this.fx.shake(0.6);
    }
    void s;
  }

  /** 화과산에 밀려나는 동안 (틱마다): 상대의 두 발이 젖은 바닥을 끌며 물이 튄다 (방벽·저주는 각자 이펙트가 sim 상태를 읽어 그린다) */
  private raidenLasting(s: SimState, f: Fighter, i: number): void {
    const o = s.fighters[1 - i];
    if (!o || this.dragT[1 - i] <= 0) return;
    this.dragT[1 - i]--;
    if (o.y < o.floor || Math.abs(o.vx) < 128 || o.hitstop > 0 || s.tick % 2) return;
    const p = fighterPose(o);
    const floor = GROUND_Y + o.floor / 256;
    const away = o.vx > 0 ? 1 : -1;
    for (const foot of [p.joints.fF, p.joints.fB]) this.debris.burst('water', o.x / 256 + o.facing * foot[0], floor - 1, -away, 1);
    void f;
  }

  /** 파천이 빗나감: 풍압이 주먹 앞으로 날아간다 (흰 바람 줄기와 바닥 먼지) */
  private pacheonWhiff(f: Fighter): void {
    const ox = f.x / 256;
    const oy = GROUND_Y + f.y / 256;
    for (let k = 0; k < 4; k++) {
      const y = oy - 18 - k * 8;
      const x0 = ox + f.facing * (30 + k * 6);
      this.layer.add(arc({
        path: [[x0 * FX_PX, y * FX_PX], [(x0 + f.facing * (120 - k * 14)) * FX_PX, (y + 2) * FX_PX]],
        ramp: fxRamp(['fxWhite', 'white', 'paleGrey', 'suitGreyLight', 'suitGrey']), seed: this.seed++, sweep: 0.12, hold: 0.04, width: 0, jag: 0.5, forks: 0, sparks: 2,
      }));
    }
    this.debris.dustCloud(Math.min(ox, ox + f.facing * 150), Math.max(ox, ox + f.facing * 150), 0.5, GROUND_Y + f.floor / 256);
    this.fx.shake(0.2);
  }

  /**
   * 라이덴 내려찍기 도끼차기가 맞은 순간 (지침서 7장 '바닥 방전'): 맞은 자리에서 바닥까지 번개가 내리꽂히고,
   * 바닥에 닿은 자리에서 양옆으로 전격이 젖은 바닥을 타고 퍼진다. x·y는 맞은 자리 (이펙트 2단위)
   */
  private groundDischarge(x: number, y: number, floorY: number): void {
    const gy = floorY * FX_PX;
    this.layer.add(arc({ path: [[x, y], [x, gy - FX_PX]], ramp: fxRamp(BOLT), seed: this.seed++, sweep: 0.04, hold: 0.1, width: 2, jag: 3, forks: 2, sparks: 6 }));
    for (const dir of [-1, 1]) {
      this.layer.add(arc({
        path: [[x, gy - FX_PX], [x + dir * 34 * FX_PX, gy - 2 * FX_PX], [x + dir * 70 * FX_PX, gy - FX_PX]],
        ramp: fxRamp(BOLT), seed: this.seed++, sweep: 0.08, hold: 0.1, width: 1, jag: 2.5, forks: 3, sparks: 5,
      }));
    }
    this.glow(x / FX_PX, floorY - 6, 110, COLORS.raidenLight, 0.9, 14);
    this.debris.burst('water', x / FX_PX - 10, floorY - 1, -1, 5);
    this.debris.burst('water', x / FX_PX + 10, floorY - 1, 1, 5);
    this.fx.shake(0.35);
  }

  /** 궤적 띠 (동작연출지침서 5장): 판정이 나오는 틱에 끝이 지난 길(판정 두 프레임 앞부터)을 따라 초승달 띠, 6~10틱에 끝부터 사라짐 */
  private attackTrail(f: Fighter, mv: MoveOf, side: 0 | 1): void {
    const path = sweepPath(mv);
    if (!path || path.length < 2) return;
    const ox = f.x / 256;
    const oy = GROUND_Y + f.y / 256;
    const R = SIDE_RAMP[side];
    this.layer.add(trail({
      path: path.map(([x, y]) => [(ox + f.facing * x) * FX_PX, (oy + y) * FX_PX] as [number, number]),
      width: mv.data.heavy ? 10 : 7,
      ticks: mv.data.heavy ? 10 : 7,
      ramp: fxRamp([R[0], R[1], R[3], R[5]]),
    }));
  }

  /** 크게 내디디는 프레임(몸 이동이 가장 큰 프레임)이 시작하는 틱: 앞발이 닿는 자리에 물 튐과 먼지 (렌더 전용, 땅에서만) */
  private stepSplash(f: Fighter, mv: MoveOf, i: number): void {
    const adv = mv.data.advance!;
    let k = 0;
    adv.forEach((a, n) => {
      if (a > adv[k]) k = n;
    });
    if (adv[k] <= 0 || f.y < 0) return;
    const start = k === 0 ? 0 : mv.frames.cum[k - 1];
    if (!(this.prevMoveT[i] < start && f.t >= start)) return;
    const foot = mv.frames.joints[Math.min(mv.frames.joints.length - 1, k + 1)].fF;
    const wx = f.x / 256 + f.facing * foot[0];
    const wy = GROUND_Y + f.y / 256;
    this.debris.burst('water', wx, wy - 1, f.facing, 6);
    this.debris.dustCloud(wx - 5, wx + 5, 0.25, wy);
  }

  /** 맞힌 자리에서 사방으로 튀는 짧은 붉은 전격 (라이덴 타격). n줄기, 길이 len px */
  private boltBurst(x: number, y: number, facing: number, n: number, len: number): void {
    for (let k = 0; k < n; k++) {
      // 맞힌 방향(앞)으로 많이, 위아래로 퍼지게
      const a = (facing > 0 ? 0 : Math.PI) + ((k + 0.5) / n - 0.5) * 2.6 + ((this.seed * 37) % 7 - 3) * 0.05;
      const l = len * (0.7 + ((this.seed * 13 + k * 5) % 7) / 14);
      this.layer.add(arc({
        path: [[x, y], [x + Math.cos(a) * l * FX_PX, y + Math.sin(a) * l * FX_PX]],
        ramp: fxRamp(BOLT),
        seed: this.seed++,
        sweep: 0.03,
        hold: 0.05,
        width: 1,
        jag: 2,
        forks: 1,
        sparks: 3,
      }));
    }
  }

  /**
   * 구조물 손상 (sim 'wreck' 이벤트, 2026-11-02): 깎일 때는 재질 부스러기, 단계가 오를 때 크기·재질에 맞는 연출.
   * 1단계 금: 작은 충격과 부스러기. 2단계 부분 파괴: 큰 덩어리가 맞은 쪽으로 튀고 바닥을 따라 먼지가 깔리며, 강철은 불꽃, 유리는 산산조각.
   * 3단계 무너짐: 큰 구조물은 위에서 덩어리가 떨어져 바닥 먼지에 묻히고 큰 흔들림·번쩍임, 소품은 부서지는 소리 대신 파편과 먼지.
   * 먼지는 바닥 쪽(캐릭터 뒤)에 짙게, 앞에는 갓 피어난 것만 옅게 (debris.drawDust) — 캐릭터를 가리지 않게
   */
  private wreck(s: SimState, i: number, stage: number, cause: string, wx: number, wy: number): void {
    const w = WRECKS[i];
    if (!w) return;
    const dir = s.wreck.dir[i] || 1;
    const kind = DEBRIS_OF[w.mat];
    const area = (w.x1 - w.x0) * (w.y1 - w.y0);
    const big = w.size === 'big';
    const small = w.size === 'small';
    const angle = dir > 0 ? 0 : Math.PI;
    const ramp = w.mat === 'glass' ? COOL : WARM;
    if (stage === 0) {
      // 깎이기만: 재질 부스러기 몇 개 (강철은 튕기는 불꽃)
      this.debris.burst(kind, wx, wy, dir, small ? 3 : 4);
      if (w.mat === 'steel' || w.mat === 'sheet') {
        this.layer.add(impact({ kind: 'ricochet', x: wx * FX_PX, y: wy * FX_PX, angle, normal: angle + Math.PI, surface: fxColor('iron'), ground: GROUND_Y * FX_PX, size: 0.3, ramp: fxRamp(WARM), seed: this.seed++ }));
      }
      return;
    }
    const heavyCause = cause === 'super' || cause === 'explosion';
    if (stage === 1) {
      this.layer.add(impact({ kind: 'hit', x: wx * FX_PX, y: wy * FX_PX, angle, size: small ? 0.3 : 0.42, ramp: fxRamp(ramp), seed: this.seed++ }));
      this.debris.burst(kind, wx, wy, dir, small ? 6 : 10);
      if (!small) this.debris.chunks(kind, wx, wy, dir, 2, 0.7);
      this.fx.shake(big ? 0.22 : 0.12);
      return;
    }
    if (stage === 2) {
      this.layer.add(impact({ kind: 'hit', x: wx * FX_PX, y: wy * FX_PX, angle, size: small ? 0.4 : 0.62, ramp: fxRamp(ramp), seed: this.seed++ }));
      this.debris.burst(kind, wx, wy, dir, w.mat === 'glass' ? 28 : 14);
      this.debris.chunks(kind, wx, wy, dir, small ? 2 : 5, small ? 0.6 : 1);
      this.debris.dustSweep(wx, dir, small ? 0.4 : 0.8);
      if (w.mat === 'steel' || w.mat === 'sheet') {
        this.layer.add(impact({ kind: 'ricochet', x: wx * FX_PX, y: wy * FX_PX, angle, normal: -Math.PI / 2, surface: fxColor('iron'), ground: GROUND_Y * FX_PX, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.glow(wx, wy, 70, COLORS.fxOrange, 0.8, 12);
      }
      this.fx.shake(big ? 0.4 : 0.25);
      return;
    }
    // 3단계: 무너짐
    if (small) {
      this.layer.add(impact({ kind: 'hit', x: wx * FX_PX, y: wy * FX_PX, angle, size: 0.5, ramp: fxRamp(ramp), seed: this.seed++ }));
      this.debris.burst(kind, wx, wy, dir, 14);
      this.debris.chunks(kind, wx, wy, dir, 4, 0.7);
      if (w.kind === 'mailbox' || w.kind === 'posterboard') this.debris.burst('paper', wx, wy - 6, dir, 12);
      if (w.kind === 'planter') this.debris.burst('sand', wx, wy, dir, 10);
      this.debris.dustCloud(w.x0 - 6, w.x1 + 6, 0.35);
      this.fx.shake(0.18);
      return;
    }
    const cx = (w.x0 + w.x1) / 2;
    const top = Math.min(w.y1, w.y0 + 200);
    this.layer.add(impact({ kind: 'hit', x: wx * FX_PX, y: wy * FX_PX, angle, size: big ? 0.9 : 0.7, ramp: fxRamp(ramp), seed: this.seed++ }));
    this.debris.fallBlocks(w.x0, w.x1, Math.max(w.y0, top - Math.min(80, (w.y1 - w.y0) * 0.6)), top, DEBRIS_FALL[w.mat], dir);
    this.debris.burst(kind, wx, wy, dir, w.mat === 'glass' ? 40 : 22);
    this.debris.chunks(kind, wx, wy, dir, big ? 10 : 6, big ? 1.3 : 1);
    // 먼지: 무너진 자리 바닥에 구름, 맞은 쪽으로 깔리는 먼지 (높은 판·들보면 그 아래 땅에서)
    const dustSize = Math.min(1.6, 0.5 + area / 6000);
    this.debris.dustCloud(w.x0 - 12, w.x1 + 12, dustSize);
    this.debris.dustSweep(cx, dir, dustSize);
    this.debris.dustSweep(cx, -dir, dustSize * 0.5);
    if (w.y0 > 40) this.after(16, () => this.debris.dustCloud(w.x0 - 6, w.x1 + 6, dustSize * 0.7));
    if (w.mat === 'steel' || w.mat === 'sheet') {
      for (const k of [0, 6, 12]) this.after(k, () => this.layer.add(impact({ kind: 'ricochet', x: (w.x0 + (w.x1 - w.x0) * (0.2 + 0.3 * (k / 6))) * FX_PX, y: (GROUND_Y - top + 6) * FX_PX, angle, normal: Math.PI / 2, surface: fxColor('iron'), ground: GROUND_Y * FX_PX, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ })));
      this.glow(cx, GROUND_Y - (w.y0 + w.y1) / 2, 120, COLORS.fxOrange, 0.9, 20);
    }
    if (big || heavyCause) {
      this.fx.flashFor(1);
      this.fx.shake(0.7);
      this.after(18, () => this.fx.shake(0.4));
    } else this.fx.shake(0.45);
  }

  /** 부서지는 물건: 망가질 때 작은 충격, 부서질 때 물건마다 다른 연출 */
  private prop(i: number, broken: boolean, crash: boolean, dir: number): void {
    const b = BREAKABLES[i];
    const cx = b.x + b.w / 2;
    const cy = GROUND_Y - b.bottom - b.h / 2;
    const ramp = b.kind === 'glass' || b.kind === 'hydrant' ? COOL : WARM;
    const angle = dir > 0 ? 0 : Math.PI;
    if (crash) this.fx.shake(0.3);
    if (!broken) {
      this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.35, ramp: fxRamp(ramp), seed: this.seed++ }));
      if (b.kind === 'glass') this.debris.burst('glass', cx, cy, dir, 4);
      return;
    }
    switch (b.kind) {
      case 'neon':
        // 네온관이 깨지며 불꽃과 유리관 조각, 빛이 번쩍 했다가 꺼진다
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.5, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('glass', cx, cy, dir, 16);
        this.debris.burst('metal', cx, cy, dir, 5);
        this.glow(cx, cy, 80, COLORS.skyLight, 1, 14);
        break;
      case 'car':
        // 찌그러짐 → 불붙음 → 폭발
        this.glow(cx, GROUND_Y - 20, 170, COLORS.fxOrange, 1, 50);
        this.layer.add(explosion({ x: cx * FX_PX, ground: GROUND_Y * FX_PX, size: 0.45, surface: fxColor('street'), seed: this.seed++, shake: (t) => this.fx.shake(t * 0.4) }));
        this.debris.burst('metal', cx, GROUND_Y - 14, dir, 14);
        this.fx.flashFor(2);
        break;
      case 'lamp':
        // 쓰러지며 불꽃과 전기
        this.layer.add(impact({ kind: 'ricochet', x: cx * FX_PX, y: (GROUND_Y - 6) * FX_PX, angle, normal: -Math.PI / 2, surface: fxColor('iron'), ground: GROUND_Y * FX_PX, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('glass', cx + dir * 40, GROUND_Y - 4, dir, 8);
        break;
      case 'glass':
        // 금 → 산산조각
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.55, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('glass', cx, cy, dir, 26);
        break;
      case 'newsstand':
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('paper', cx, cy - 6, dir, 18);
        this.debris.burst('metal', cx, cy, dir, 6);
        break;
      case 'hydrant':
        // 부러지면 물기둥 (물기둥 자체는 물건 그림이 라운드 끝까지 그린다)
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: (GROUND_Y - 6) * FX_PX, angle, size: 0.45, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('water', cx, GROUND_Y - 8, dir, 20);
        this.debris.burst('metal', cx, GROUND_Y - 8, dir, 4);
        break;
    }
  }

  /**
   * 시타델 본관 (sim 'citadel' 이벤트, wx·wy: 그 자리). 깎일 때 벽돌 부스러기. 단계가 넘어갈 때 흔들림과 먼지,
   * 2단계부터 유리 조각, 3단계 불꽃 빛. 무너질 때 번쩍임·큰 흔들림, 본관 밑동을 따라 차례로 터지는 폭발,
   * 광장을 덮는 먼지 구름 여러 겹, 떨어지는 커튼월 조각, 이어지는 진동 (본관이 내려앉는 모습은 render/gl/keepfall.ts)
   */
  private citadel(text: string, stage: number, wx: number, wy: number, dir: number): void {
    const K = D.plaza.keep;
    if (text === 'damage') {
      this.debris.burst('brick', wx, wy, dir, 2);
      return;
    }
    if (text === 'stage') {
      this.fx.shake(0.2 + stage * 0.08);
      this.debris.dustCloud(wx - 90, wx + 90, 0.25 + stage * 0.08);
      if (stage >= 2) for (let k = 0; k < 4; k++) this.debris.burst('glass', wx - 60 + k * 40, GROUND_Y - 110, k % 2 ? 1 : -1, 5);
      if (stage === 3) this.glow(wx, GROUND_Y - 150, 160, COLORS.fxOrange, 0.9, 24);
      return;
    }
    if (text !== 'collapse') return;
    this.fx.flashFor(2);
    this.fx.shake(0.95);
    this.glow(wx, GROUND_Y - 120, 260, COLORS.fxOrange, 1, 40);
    [K.x0 + 60, K.x0 + 220, K.x0 + 380, K.x0 + 540, K.x1 - 60].forEach((x, i) =>
      this.after(i * 5, () => {
        this.layer.add(explosion({ x: x * FX_PX, ground: GROUND_Y * FX_PX, size: 0.7, surface: fxColor('street'), seed: this.seed++, fire: 0.3 }));
        this.fx.shake(0.6);
      }));
    for (const [at, size] of [[0, 0.8], [12, 1], [30, 1], [55, 0.8], [85, 0.6]] as const) this.after(at, () => this.debris.dustCloud(K.x0 - 60, K.x1 + 60, size));
    this.after(8, () => this.debris.collapse(K.x0, K.x1, 300, keepAtlas()));
    for (const at of [20, 45, 80, 120]) this.after(at, () => this.fx.shake(0.5));
  }

  /** 틱 뒤에 연출을 낸다 (sim 틱 기준) */
  private after(ticks: number, run: () => void): void {
    this.later.push({ at: this.now + ticks, run });
  }

  /**
   * 큰 물건 (wx, wy: 부서진 자리, 화면 월드 좌표). 망가질 때는 큰 충격만, 크게 무너질 때는 물건마다:
   * 노면전차는 탈선하는 순간 폭발·불꽃·유리, 굴러 뒤집혀 떨어지는 순간 긴 먼지. 급수탑은 지붕 위 폭발·물보라, 지붕에 닿아 터지는 순간 물과 먼지.
   * 등대는 꺾이는 자리 폭발·등실 유리, 밑동 먼지. 시타델 간판은 걸쇠의 번개 불꽃·네온 유리관, 바닥에 닿는 순간 폭발과 먼지.
   */
  private bigProp(i: number, broken: boolean, wx: number, wy: number, dir: number, at: number): void {
    const b = BREAKABLES[i];
    const angle = dir > 0 ? 0 : Math.PI;
    const G = GROUND_Y * FX_PX;
    if (!broken) {
      this.layer.add(impact({ kind: 'hit', x: wx * FX_PX, y: wy * FX_PX, angle, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.debris.burst(b.kind === 'watertower' ? 'water' : b.kind === 'bigsign' ? 'glass' : 'metal', wx, wy, dir, 8);
      this.fx.shake(0.35);
      return;
    }
    const boom = (x: number, ground: number, size: number, fire: number, y?: number) =>
      this.layer.add(explosion({ x: x * FX_PX, y: y === undefined ? undefined : y * FX_PX, ground: ground * FX_PX, size, fire, surface: fxColor('street'), seed: this.seed++, shake: (t) => this.fx.shake(t * 0.5) }));
    this.fx.shake(0.8);
    this.fx.flashFor(2);
    switch (b.kind) {
      case 'tram': {
        const x0 = at;
        const rest = tramRestX(at);
        boom(x0 + b.w / 2, GROUND_Y, 0.55, 0.25);
        this.layer.add(impact({ kind: 'ricochet', x: (x0 + b.w / 2) * FX_PX, y: (GROUND_Y - 30) * FX_PX, angle, normal: -Math.PI / 2, surface: fxColor('iron'), ground: G, size: 0.8, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('glass', x0 + b.w / 2, GROUND_Y - 40, dir, 24);
        this.debris.burst('metal', x0 + b.w / 2, GROUND_Y - 20, dir, 12);
        this.glow(x0 + b.w / 2, GROUND_Y - 30, 180, COLORS.fxOrange, 1, 50);
        // 굴러 뒤집혀 떨어지는 순간: 차체 길이만큼 먼지와 흔들림
        this.after(30, () => {
          this.debris.dustCloud(rest - 10, rest + b.w + 10, 1.6);
          this.debris.burst('metal', rest + b.w / 2, GROUND_Y - 10, -dir, 8);
          this.fx.shake(0.6);
        });
        break;
      }
      case 'watertower': {
        const roof = GROUND_Y - b.bottom;
        boom(b.x + b.w / 2, roof, 0.4, 0);
        this.debris.burst('water', b.x + b.w / 2, roof - 30, dir, 30);
        this.debris.burst('brick', b.x + b.w / 2, roof - 20, dir, 10);
        // 지붕에 닿아 터지는 순간: 물이 사방으로, 지붕 위 먼지
        this.after(22, () => {
          this.debris.burst('water', b.x + b.w + 20, roof - 8, 1, 40);
          this.debris.burst('water', b.x + b.w + 20, roof - 8, -1, 20);
          this.debris.dustCloud(b.x + b.w, b.x + b.w + 60, 1, roof);
          this.fx.shake(0.5);
        });
        break;
      }
      case 'lighthouse': {
        const L = D.pier.lighthouse;
        const cx = L.x + L.w / 2;
        boom(cx, GROUND_Y, 0.6, 0.2, GROUND_Y - L.snap);
        this.debris.burst('glass', cx, GROUND_Y - L.h + 12, dir, 26);
        this.debris.burst('brick', cx, GROUND_Y - L.snap, dir, 18);
        this.debris.dustCloud(cx - 30, cx + 30, 1.2);
        this.glow(cx, GROUND_Y - L.snap, 160, COLORS.fxOrange, 1, 40);
        this.after(44, () => this.fx.shake(0.4));
        break;
      }
      case 'bigsign': {
        const S = D.plaza.sign;
        const top = GROUND_Y - S.bottom - S.h;
        // 걸쇠가 끊어지며 번개 불꽃, 네온 유리관 조각
        for (const mx of [S.x + 12, S.x + S.w - 12]) {
          this.layer.add(impact({ kind: 'ricochet', x: mx * FX_PX, y: top * FX_PX, angle, normal: Math.PI / 2, surface: fxColor('iron'), ground: G, size: 0.7, ramp: fxRamp(COOL), seed: this.seed++ }));
        }
        this.debris.burst('glass', S.x + S.w / 2, top + 20, dir, 30);
        this.debris.burst('metal', S.x + S.w / 2, top + 10, dir, 8);
        this.glow(S.x + S.w / 2, top, 220, COLORS.skyLight, 1, 24);
        // 바닥(분수)에 닿는 순간 (sim이 쓰러진 간판 발판을 놓는 틱) 폭발과 먼지
        this.after(BREAK_RULES.settle, () => {
          boom(S.x + S.w / 2, GROUND_Y, 0.7, 0.4);
          this.debris.dustCloud(S.x - 20, S.x + S.w + 20, 2);
          this.debris.burst('water', S.x + S.w / 2, GROUND_Y - 20, 1, 24);
          this.debris.burst('water', S.x + S.w / 2, GROUND_Y - 20, -1, 24);
          this.glow(S.x + S.w / 2, GROUND_Y - 20, 200, COLORS.fxOrange, 1, 60);
          this.fx.shake(0.85);
          this.fx.flashFor(2);
        });
        break;
      }
    }
  }

  /**
   * 차지: 모으기 시작과 단계가 오를 때마다 '캉!' 하고 한 번 반짝인다 — 허리에 당긴 주먹에서 십자 빛이 번쩍였다 줄고 고리가 퍼지며,
   * 짧고 센 빛이 바닥과 벽을 한 번 때린다 (몸이 하얗게 번쩍이는 것은 fight.ts). 몸 둘레 오라는 단계마다 한 겹씩 커진다 (모으는 동안 유지).
   * 3단계는 화면도 한 번 번쩍. 떼는 순간 앞으로 빛
   */
  private charge(s: SimState, who: number, what: string, lv: number): void {
    const f = s.fighters[who];
    // 라이덴 투전승불은 단계를 틱으로 따로 센다 (raidenChargeTick): 오라·반짝임·하늘 번개를 쓰지 않는다 (사용자 피드백 2026-11-02 9-1)
    if (f.char === 'raiden') return;
    const wx = f.x / 256;
    const wy = GROUND_Y + f.y / 256 - 24;
    if (what === 'start' || what === 'level') {
      // 몸 둘레 오라 (캐릭터가 모으는 모습을 스스로 그리면 빼고: 에드워드는 팔·등의 장막 윤곽. 라이덴은 위에서 이미 돌아갔다)
      if (!rendersOf(f.char).ownChargeAura) {
        this.layer.add(powerUp({
          actor: { feet: () => feet(f), silhouette: () => silhouette(f, this.skinOf(f)) },
          palette: fxHex((rendersOf(f.char).ramp as ColorName[] | undefined) ?? CHARGE_RAMP),
          size: 0.36 + 0.14 * lv,
          seed: this.seed++,
          sustain: () => f.mode === 'charge',
        }));
      }
      // 허리에 당긴 주먹 자리 (모으는 동안 되풀이하는 첫 프레임의 주먹)
      const fist = chargeFist(f);
      const gx = wx + f.facing * fist[0];
      const gy = GROUND_Y + f.y / 256 + fist[1];
      this.layer.add(glint({ x: gx * FX_PX, y: gy * FX_PX, size: 0.5 + 0.3 * lv, ramp: fxRamp(rendersOf(f.char).ramp ?? ['fxWhite', 'goldLight', 'fxYellow', 'fxOrange', 'fxFlame']) }));
      this.glow(gx, gy, 40 + 12 * lv, rendersOf(f.char).light ?? COLORS.fxYellow, 0.9, 4);
      this.fx.shake(0.06 + 0.05 * lv);
      if (lv >= 3) this.fx.flashFor(1);
    } else if (what === 'release') {
      this.glow(wx + f.facing * 14, wy, 60 + 14 * lv, rendersOf(f.char).light ?? COLORS.fxYellow, 0.8, 10);
    }
  }

  /** 라이덴 투전승불이 지금 몇 단계인가 (모은 틱으로 센다, 0~4. 20틱 전은 0: 이펙트 없음) */
  private raidenStageOf(f: Fighter): number {
    if (f.mode !== 'charge') return 0;
    return movesOf(f.char).charge.data.charge!.levels.filter((l) => f.t >= l.at).length;
  }

  /** 차지 그림이 읽는 지금 모습: 실루엣·관절(월드 px)·머리 방향·발밑 */
  private chargeBody(f: Fighter): ChargeBody {
    const p = fighterPose(f);
    const ox = f.x / 256;
    const oy = GROUND_Y + f.y / 256;
    const j = p.joints;
    const W = (q: readonly [number, number]) => [ox + f.facing * q[0], oy + q[1]] as const;
    return {
      sil: silhouette(f, this.skinOf(f)),
      j: { hip: W(j.hip), neck: W(j.neck), head: W(j.head), shF: W(j.shF), eF: W(j.eF), hF: W(j.hF), shB: W(j.shB), eB: W(j.eB), hB: W(j.hB), kF: W(j.kF), fF: W(j.fF), kB: W(j.kB), fB: W(j.fB) },
      front: [f.facing * Math.cos(j.ha), Math.sin(j.ha)],
      up: [f.facing * Math.sin(j.ha), -Math.cos(j.ha)],
      feet: [ox, oy],
    };
  }

  /**
   * 라이덴 투전승불 (사용자 피드백 2026-11-02 9-1, 렌더 전용): 모으기를 시작하면 전류 윤곽(raiden-charge.ts armor)을 붙이고,
   * 단계가 오르는 틱에 3단계는 바닥 물 튐, 4단계는 짧은 화면 흔들림. 탈진(4단계 뒤)하는 동안 어깨·등에서 김이 오른다
   */
  private raidenChargeTick(s: SimState, f: Fighter, i: number): void {
    if (f.mode === 'charge') {
      const a = this.armor[i];
      if (!a || a.done() || this.prevMode[i] !== 'charge') {
        const fighter = f;
        const fx = raidenChargeArmor({
          body: () => this.chargeBody(fighter),
          stage: () => this.raidenStageOf(fighter),
          alive: () => fighter.mode === 'charge' || (fighter.mode === 'attack' && fighter.move === 'charge' && fighter.t < movesOf(fighter.char).charge.activeStart),
          ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']),
          hair: fxRamp(['raidenLight', 'raiden', 'raidenDark']),
          seed: this.seed++,
        });
        this.layer.add(fx);
        this.armor[i] = fx;
        this.chargeStage[i] = 0;
      }
      const st = this.raidenStageOf(f);
      if (st > this.chargeStage[i]) {
        const [fx0, fy0] = feet(f);
        if (st === 3) {
          // 3단계: 발밑 젖은 바닥에서 물이 튄다
          this.debris.burst('water', fx0 / FX_PX + 8, fy0 / FX_PX - 1, 1, 6);
          this.debris.burst('water', fx0 / FX_PX - 8, fy0 / FX_PX - 1, -1, 6);
        }
        if (st === 4) this.fx.shake(0.5);
        this.chargeStage[i] = st;
      }
    } else if (f.mode !== 'attack' || f.move !== 'charge') this.chargeStage[i] = 0;
    // 파천 진각 (20~32틱 '굳게 디딤'): 3번 프레임이 시작하는 틱에 앞발 자리 바닥 금과 물 튐
    if (f.mode === 'attack' && f.move === 'super') {
      const mv = movesOf(f.char).super;
      const at = mv.frames.cum[2];
      if (this.prevMoveT[i] < at && f.t >= at) {
        const foot = mv.frames.joints[3].fF;
        const fx0 = f.x / 256 + f.facing * foot[0];
        const fl = GROUND_Y + f.floor / 256;
        this.layer.add(pacheonCrack({ x: fx0, floor: fl, dir: f.facing, life: 150, ramp: fxRamp(PACHEON_RAMP), seed: this.seed++ }));
        this.debris.burst('water', fx0, fl - 1, f.facing, 6);
        this.debris.burst('water', fx0, fl - 1, -f.facing, 4);
        this.fx.shake(0.35);
      }
    }
    // 탈진: 어깨·등에서 김이 오른다 (3틱마다 한 줄기)
    if (f.mode === 'exhaust' && s.tick % 3 === 0) {
      const p = fighterPose(f);
      const ox = f.x / 256;
      const oy = GROUND_Y + f.y / 256;
      const k = Math.floor(s.tick / 3) % 3;
      const from = k === 0 ? p.joints.head : k === 1 ? p.joints.shB : p.joints.neck;
      this.layer.add(raidenSteam({
        x: ox + f.facing * (from[0] - 2), y: oy + from[1] - 3, drift: -f.facing,
        ramp: fxRamp(['paleGrey', 'smog3', 'smog2']), seed: this.seed++,
      }));
    }
  }

  /**
   * 투전승불 떼기: 판정이 시작하는 틱에 주먹에서 앞으로 원뿔 방전 (모은 단계의 궤적 상자 = 판정 = 원뿔).
   * 1 줄기 4 · 2 + 가지 2 · 3 + 가지 4 + 바닥 긁는 스파크 · 4 + 첫 틱 섬광 (원뿔과 화면 1틱)
   */
  private raidenCone(f: Fighter, mv: MoveOf): void {
    const lv = Math.max(1, Math.min(4, f.chargeLv));
    const b = mv.data.charge?.levels[lv - 1]?.box ?? mv.data.box!;
    const ox = f.x / 256;
    const oy = GROUND_Y + f.y / 256;
    const fx = raidenChargeCone({
      x: ox + f.facing * b.x, y: oy + b.y + b.h / 2, dir: f.facing,
      length: b.w, height: b.h,
      bolts: 3 + lv, branches: [0, 2, 4, 4][lv - 1], floor: lv >= 3 ? GROUND_Y + f.floor / 256 : undefined,
      flash: lv >= 4, thick: lv >= 3,
      ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']), seed: this.seed++,
    });
    this.layer.add(fx);
    this.cones.push({ fx, power: lv });
    if (lv >= 4) this.fx.flashFor(1);
  }

  /** 투전승불 4단계가 맞으면: 상대 등 뒤로 짧은 방전 (몸을 뚫고 나간 전류, 8틱) */
  private behindDischarge(att: Fighter, def: Fighter): void {
    const fx = raidenChargeCone({
      x: def.x / 256 + att.facing * 6, y: GROUND_Y + def.y / 256 - 30, dir: att.facing,
      length: 20, height: 18, bolts: 3, branches: 1,
      ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']), seed: this.seed++,
    });
    this.layer.add(fx);
    this.cones.push({ fx, power: 2 });
  }

  /** 연출 장면 속 한 대: 상대 몸에 불꽃, 빛, 흔들림 (끝에 줄 피해와는 따로, 보이기만) */
  private cineCue(s: SimState, kind: CineCue['kind']): void {
    const c = s.cine!;
    const def = s.fighters[1 - c.who];
    const att = s.fighters[c.who];
    const wx = def.x / 256;
    const wy = GROUND_Y + def.y / 256 - 26;
    const x = wx * FX_PX;
    const y = wy * FX_PX;
    const toward = att.facing > 0 ? Math.PI : 0;
    if (kind === 'jab') {
      this.layer.add(impact({ kind: 'hit', x, y, angle: toward + (this.seed % 3 - 1) * 0.3, size: 0.35, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.glow(wx, wy, 50, COLORS.fxOrange, 0.8, 6);
      this.fx.shake(0.12);
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = false;
    } else if (kind === 'upper') {
      this.layer.add(impact({ kind: 'hit', x, y: y + 8 * FX_PX, angle: -Math.PI / 2, size: 0.8, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.glow(wx, wy, 90, COLORS.fxWhite, 1, 10);
      this.fx.shake(0.35);
      this.fx.flashFor(1);
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = true;
    } else if (kind === 'hammer') {
      this.layer.add(impact({ kind: 'hit', x, y: y - 6 * FX_PX, angle: Math.PI / 2, size: 0.7, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.glow(wx, wy, 80, COLORS.fxYellow, 1, 8);
      this.fx.shake(0.3);
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = true;
    } else if (kind === 'pcPress') {
      // 32~56 정적: 아무것도 튀지 않는다. 주먹이 닿은 점 하나만 붉다 (비는 fight.ts가 공중에 세운다)
      const a = att;
      this.layer.add(pacheonContact({
        at: () => {
          const fist = fighterPose(a).joints.hB;
          return [a.x / 256 + a.facing * (fist[0] + 2), GROUND_Y + a.y / 256 + fist[1]] as const;
        },
        life: 24,
        ramp: fxRamp(PACHEON_RAMP),
      }));
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = true;
    } else if (kind === 'pcSurge') {
      // 56~80 몸 안으로: 상대를 감추고 어둡게 비친 몸과 뼈대를 따라 번지는 검붉은 전류를 대신 그린다
      const d = def;
      this.surge = pacheonSurge({ body: () => this.chargeBody(d), life: 24, ramp: fxRamp(PACHEON_RAMP), seed: this.seed++ });
      this.layer.add(this.surge);
      this.surgeHide = 1 - c.who;
      this.surgeUntil = s.tick + 24;
      this.fx.shake(0.15);
    } else if (kind === 'pcFlash') {
      // 섬광: 전류가 하얗게 2틱, 화면 1틱
      this.surge?.flash();
      this.glow(wx, wy, 70, COLORS.raidenLight, 1, 3);
      this.fx.flashFor(1);
      this.fx.shake(0.2);
    } else if (kind === 'pcBurst') {
      // 80~96 등 뒤로: 상대 등에서 검붉은 원뿔(흰 심)이 화면 끝까지 뚫고 나간다
      const dir = att.facing;
      this.layer.add(raidenChargeCone({
        x: wx + dir * 6, y: wy - 2, dir, length: 300, height: 64, bolts: 9, branches: 6, thick: true, core: true, ticks: 16,
        ramp: fxRamp(PACHEON_RAMP), seed: this.seed++,
      }));
      this.glow(wx + dir * 90, wy, 200, COLORS.raidenDark, 1, 16);
      this.glow(wx + dir * 20, wy, 60, COLORS.raidenLight, 0.9, 4);
      this.fx.shake(0.6);
      this.fx.flashFor(1);
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = true;
    } else if (kind === 'pcFly') {
      // 96~130: 잿더미는 sim의 'ash' 사건이 그린다 (raidenEvent). 상대가 날아가는 자리에 먼지
      this.debris.dustCloud(wx - 16, wx + 16, 0.5, GROUND_Y + def.floor / 256);
    } else if (kind === 'pcAfter') {
      // 130~150 잔심: 뻗었던 팔과 어깨에서 김, 주먹 둘레에 잔 스파크, 위에서 재가 떨어진다
      const p = fighterPose(att);
      const ax = att.x / 256;
      const ay = GROUND_Y + att.y / 256;
      for (const [k, jn] of [[0, p.joints.hB], [1, p.joints.shB], [2, p.joints.eB]] as const) {
        this.layer.add(raidenSteam({ x: ax + att.facing * jn[0], y: ay + jn[1] - 2, drift: -att.facing, ramp: fxRamp(['paleGrey', 'smog3', 'smog2']), seed: this.seed++ + k }));
      }
      const fx = ax + att.facing * p.joints.hB[0];
      const fy = ay + p.joints.hB[1];
      for (let k = 0; k < 2; k++) {
        this.layer.add(arc({
          path: [[fx * FX_PX, fy * FX_PX], [(fx + att.facing * (5 + k * 3)) * FX_PX, (fy - 4 + k * 7) * FX_PX]],
          ramp: fxRamp(PACHEON_RAMP), seed: this.seed++, sweep: 0.02, hold: 0.06, width: 0, jag: 1.5, forks: 0, sparks: 1,
        }));
      }
      this.layer.add(pacheonAshFall({ x0: ax - 140, x1: ax + att.facing * 260, top: ay - 150, floor: ay, life: 90, ramp: fxRamp(['ashLight', 'ash', 'ashDark']), seed: this.seed++ }));
    } else {
      // 바닥에 꽂힘: 흙먼지 폭발과 큰 흔들림
      this.layer.add(explosion({ x, ground: (GROUND_Y + def.y / 256) * FX_PX, size: 0.55, surface: fxColor('street'), seed: this.seed++ }));
      this.debris.dustCloud(wx - 20, wx + 20, 0.7, GROUND_Y + def.y / 256);
      this.glow(wx, GROUND_Y + def.y / 256 - 6, 110, COLORS.fxOrange, 1, 14);
      this.fx.shake(0.55);
      this.fx.flashFor(2);
    }
  }

  /** 맞은 쪽을 하얗게 그릴 틱인가 */
  white(i: number): boolean {
    if (this.blink[i] > 0) return true;
    const t = this.since[i];
    return this.heavy[i] ? t < FLASH_HEAVY || t === 6 : t < FLASH_LIGHT;
  }
}
