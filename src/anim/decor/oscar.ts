import { hiltDir, mouthAt, SWORD } from '../../data/poses/oscar/stance';
import type { Joints, Point } from '../pose';
import type { Decor, Look } from '../skeleton';
import type { Skin } from '../skins';

/*
 * 오스카 표식 (캐릭터 기획서): 살짝 굽은 노인의 자세(포즈), 짧은 금발, 올블랙 정장, 허리에 꽂은 검.
 * 몸(팔다리·몸통) 색이 검은 정장이고, 재킷은 몸판을 조금 넓히고 엉덩이 아래로 자락을 낸다.
 * 검은 칼집째 허리띠에 비스듬히 꽂혀 칼자루가 몸 앞 위로, 칼집이 뒤 아래로 한 직선이다 (자리 계산은 data/poses/oscar/stance.ts와 같다).
 * 앞손이 칼자루 줄 위에 있으면 칼자루가 손을 따라 나와 그만큼 칼날(은빛)이 드러난다 (살짝 뽑기·납도). 손이 멀면 칼은 칼집에 꽂힌 채.
 * 색: 머리 금발, 칼집(옷 갈래) 짙은 바다색 옻칠, 칼자루 장식(작은 장식 갈래) 은빛, 칼날(빛나는 곳 갈래) 달빛. 눈은 그리지 않는다.
 */

const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k];
const norm = (v: Point): Point => {
  const d = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / d, v[1] / d];
};

/** 몸통 방향(엉덩이 → 목)과 몸 앞쪽 */
function torso(j: Joints): { up: [number, number]; down: Point; front: [number, number] } {
  const u = norm([j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]]);
  return { up: [u[0], u[1]], down: [-u[0], -u[1]], front: [-u[1], u[0]] };
}

/** 칼이 뽑힌 길이: 앞손이 칼자루 줄 위(줄에서 3px 안)에 있고 쥐는 자리보다 앞이면 그만큼 */
function drawnOf(j: Joints, m: Point, h: Point): number {
  const d: Point = [j.hF[0] - m[0], j.hF[1] - m[1]];
  const along = d[0] * h[0] + d[1] * h[1];
  const perp = Math.abs(d[0] * -h[1] + d[1] * h[0]);
  if (perp > 3 || along < SWORD.grip - 2.5 || along > SWORD.grip + SWORD.maxDraw + 2) return 0;
  const k = along - SWORD.grip;
  return k < 1.2 ? 0 : Math.min(SWORD.maxDraw, Math.round(k));
}

export const OSCAR_DECOR: Decor = {
  /** 재킷 뒷자락 (몸 뒤로 늘어지는 짧은 자락): 굽은 등에서 엉덩이 아래로 */
  behind(pen, j) {
    const { down, front } = torso(j);
    const hang = norm([down[0] * 0.55, down[1] * 0.55 + 0.45]);
    pen.fill('body', (s) => s.poly([
      add(j.hip, front, -1),
      add(j.hip, front, -4.5),
      add(add(j.hip, front, -5.5), hang, 7),
      add(add(j.hip, front, -1.5), hang, 6),
    ]));
  },
  /** 정장 재킷 앞판·자락, 그리고 허리의 검 (칼집 → 드러난 칼날 → 날밑 → 칼자루) */
  body(pen, j) {
    const { up, down, front } = torso(j);
    const top = add(j.neck, down, 2);
    const hang = norm([down[0] * 0.6, down[1] * 0.6 + 0.4]);
    // 재킷: 몸통보다 1px씩 넓은 몸판, 앞자락은 엉덩이 아래로 짧게
    pen.fill('body', (s) => s.poly([
      add(top, front, 2.6),
      add(top, front, -3.2),
      add(j.hip, front, -3.6),
      add(add(j.hip, front, -2), hang, 5),
      add(add(j.hip, front, 2.6), hang, 4),
    ]));
    // 검
    const m = mouthAt([j.hip[0], j.hip[1]], up, front);
    const h = hiltDir(up, front);
    const drawn = drawnOf(j, m, h);
    const guard = add(m, h, drawn);
    // 칼집: 입구에서 뒤 아래로 (끝 1px은 은빛 마개)
    pen.fill('cloth', (s) => s.line(add(m, h, -1), add(m, h, -SWORD.sheath), 2));
    pen.fill('accent', (s) => {
      s.line(add(m, h, -SWORD.sheath), add(m, h, -SWORD.sheath - 1), 2);
      // 칼집 입구 테 (은빛 고리)
      s.line(add(m, h, -0.5), add(m, h, -1.5), 2);
    });
    // 드러난 칼날 (뽑힌 만큼, 달빛)
    if (drawn > 0) pen.fill('glow', (s) => s.line(m, add(m, h, drawn), 1));
    // 칼자루: 날밑(은빛 짧은 가로대) → 손잡이(짙은 옻칠) → 끝 장식(은빛)
    const n: Point = [-h[1], h[0]];
    pen.fill('accent', (s) => s.line(add(guard, n, -1.5), add(guard, n, 1.5), 1));
    pen.fill('cloth', (s) => s.line(add(guard, h, 1), add(guard, h, SWORD.hilt - 1), 2));
    pen.fill('accent', (s) => s.line(add(guard, h, SWORD.hilt - 0.5), add(guard, h, SWORD.hilt), 2));
  },
  /** 짧은 금발: 뒤로 넘겨 빗은 짧은 머리 (정수리·뒤통수를 매끈하게 덮고, 이마 위는 짧게, 뒤는 목덜미 위에서 끝난다) */
  head(pen, j) {
    const c = j.head;
    const r = j.ha;
    const u: Point = [Math.sin(r), -Math.cos(r)];
    const f: Point = [-u[1], u[0]];
    const at = (p: readonly [number, number]): Point => [c[0] + f[0] * p[0] + u[0] * p[1], c[1] + f[1] * p[0] + u[1] * p[1]];
    pen.fill('hairBack', (s) => {
      // 뒤통수 아래 짧게 깎은 머리 (한 단계 어둡게)
      s.poly([at([-1.5, 0.5]), at([-5.4, 0.8]), at([-5, -2.4]), at([-2.6, -2])]);
    });
    pen.fill('hair', (s) => {
      // 머리 위·뒤를 매끈하게 덮는 반달: 머리 중심에서 조금 뒤로 물린 원 안에서, 이마선(앞 위)과 귀 위 선(뒤)까지
      const o = at([-0.8, 0.4]);
      s.area(c[0] - 8, c[1] - 8, c[0] + 8, c[1] + 8, (x, y) => {
        const dx = x - c[0];
        const dy = y - c[1];
        const upv = dx * u[0] + dy * u[1];
        const fr = dx * f[0] + dy * f[1];
        return Math.hypot(x - o[0], y - o[1]) <= 5.7 && (upv >= 1.5 + Math.max(0, fr) * 0.35 || (fr <= -2 && upv >= -1.5));
      });
    });
  },
};

/** 1P: 올블랙 정장(빛 받는 쪽은 회청), 짧은 금발, 짙은 바다색 칼집, 은빛 장식, 달빛 칼날 */
const OSCAR_P1: Look = {
  outline: 'ink', shadow: 'blackSuitDark', base: 'blackSuit', light: 'blackSuitLight',
  hair: ['blondDark', 'blond', 'blondLight'],
  cloth: ['blackSuitDark', 'deepSea', 'deepSeaLight'],
  accent: ['moonDark', 'moon'],
  trim: 'moon',
  glow: 'moonLight',
};
/** 2P (같은 캐릭터끼리): 짙은 바다색 정장, 은발, 핏빛 칼집 */
const OSCAR_P2: Look = {
  outline: 'ink', shadow: 'blackSuitDark', base: 'deepSea', light: 'deepSeaLight',
  hair: ['moonDark', 'moon', 'moonLight'],
  cloth: ['blackSuitDark', 'bloodMoonDark', 'bloodMoon'],
  accent: ['moonDark', 'moon'],
  trim: 'moon',
  glow: 'moonLight',
};
/** 그림자 잔상 (월영 대시·월하윤회 순간이동): 짙은 바다색 실루엣, 달빛 테두리 */
const OSCAR_GHOST: Look = { outline: 'moonDark', shadow: 'deepSea', base: 'deepSea', light: 'deepSeaLight' };
/** 차지로 모으는 동안: 은빛 달빛으로 빛난다 */
const OSCAR_GLOW: Look = { outline: 'ink', shadow: 'moonDark', base: 'moon', light: 'moonLight' };

/** 오스카 겉모습: 장식과 색 묶음 (1P·2P·잔상·빛남) */
export const OSCAR_SKIN: Skin = {
  id: 'oscar',
  label: '오스카',
  decor: OSCAR_DECOR,
  looks: { p1: OSCAR_P1, p2: OSCAR_P2, ghost1: OSCAR_GHOST, ghost2: OSCAR_GHOST, glow1: OSCAR_GLOW, glow2: OSCAR_GLOW },
};
