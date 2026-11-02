import { hiltDir, mouthAt, SWORD } from '../../data/poses/oscar/stance';
import type { Joints, Point } from '../pose';
import type { Decor, Look } from '../skeleton';
import { add, flutter, hangDir, headFrame, norm, torso } from './kit';

import type { Skin } from '../skins';

/*
 * 오스카 표식 (캐릭터 기획서 + 사용자 일러스트 2026-11-02 `docs/refs/오스카_일러스트.webp`).
 * - 살짝 굽은 노인의 자세(포즈), 흐트러진 곱슬 금발(이마와 귀를 덮는다)
 * - 올블랙: 검은 정장(몸)과 발목까지 내려오는 검은 롱코트(뒷자락은 한 단계 어둡게, 걸음·숙임에 휘날린다), 검은 장갑, 짙은 핏빛 넥타이
 * - 허리에 비스듬히 꽂은 긴 카타나: 칼집은 짙은 바다색 옻칠, 칼자루는 검은 끈 감개에 금빛 마름모, 둥근 금빛 날밑.
 *   칼자루가 몸 앞 위로, 칼집이 뒤 아래로 한 직선 (자리 계산은 data/poses/oscar/stance.ts와 같다).
 *   앞손이 칼자루 줄 위에 있으면 칼자루가 손을 따라 나와 그만큼 칼날(은빛)이 드러난다 (살짝 뽑기·납도). 손이 멀면 칼은 칼집에 꽂힌 채.
 * 눈은 그리지 않는다.
 */

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
  /** 피부는 얼굴만 (검은 장갑, 일러스트) */
  skin: { face: true },
  /** 롱코트 뒷자락: 굽은 등에서 발목 높이까지 (한 단계 어둡게). 끝단은 넓게 퍼지고, 걸음·숙임에 뒤로 휘날린다 */
  behind(pen, j) {
    const { down, front, back } = torso(j);
    const k = flutter(j);
    const hang = hangDir(j, k, 0.55);
    const top = add(j.neck, down, 2);
    const len = 22 + 2 * k;
    pen.fill('bodyBack', (s) => s.poly([
      add(top, back, 3),
      add(top, front, 0.5),
      add(add(j.hip, front, 1), hang, 8),
      add(add(j.hip, front, 0), hang, len - 2),
      add(add(j.hip, back, 3 + 2 * k), hang, len),
      add(add(j.hip, back, 6 + 3 * k), hang, len - 3),
      add(j.hip, back, 5),
    ]));
  },
  /** 코트 몸판·옷깃·앞자락, 넥타이, 그리고 허리의 카타나 (칼집 → 드러난 칼날 → 날밑 → 칼자루) */
  body(pen, j) {
    const { up, down, front } = torso(j);
    const top = add(j.neck, down, 1.5);
    const k = flutter(j);
    const hang = norm([down[0] * 0.6 - front[0] * 0.15 * k, down[1] * 0.6 + 0.4 - front[1] * 0.15 * k]);
    // 코트 몸판: 어깨가 넓고(등 쪽 4px) 몸통보다 1px씩 넓다. 앞자락은 열려 무릎 아래까지 늘어진다
    pen.fill('body', (s) => {
      s.poly([add(top, front, 2.8), add(add(top, front, -4), up, 0.5), add(j.hip, front, -4), add(j.hip, front, 3)]);
      s.poly([add(j.hip, front, 3), add(j.hip, front, -1), add(add(j.hip, front, -0.5), hang, 14 + 2 * k), add(add(j.hip, front, 2.5), hang, 12)]);
    });
    // 옷깃: 목 아래에서 가슴 앞으로 접힌 깃 (한 단계 어둡게) — 열린 코트 앞판의 가장자리
    pen.fill('bodyBack', (s) => s.poly([add(top, front, 0.4), add(top, front, 2.6), add(add(top, down, 6), front, 2.4), add(add(top, down, 4), front, 1)]));
    // 짙은 핏빛 넥타이: 매듭에서 가슴 아래까지
    const knot = add(add(top, down, 1), front, 1.8);
    pen.fill('trim', (s) => {
      s.disc(knot, 0.8);
      s.line(knot, add(add(top, down, 7), front, 2.2), 1);
    });
    // 카타나
    const m = mouthAt([j.hip[0], j.hip[1]], [up[0], up[1]], [front[0], front[1]]);
    const h = hiltDir([up[0], up[1]], [front[0], front[1]]);
    const drawn = drawnOf(j, m, h);
    const guard = add(m, h, drawn);
    const n: Point = [-h[1], h[0]];
    // 칼집: 입구에서 뒤 아래로, 끝은 금빛 마개
    pen.fill('cloth', (s) => s.line(add(m, h, -1), add(m, h, -SWORD.sheath), 2));
    pen.fill('accent', (s) => {
      s.line(add(m, h, -SWORD.sheath), add(m, h, -SWORD.sheath - 1), 2);
      s.line(add(m, h, -0.5), add(m, h, -1.5), 2);
    });
    // 드러난 칼날 (뽑힌 만큼, 은빛)
    if (drawn > 0) pen.fill('metal', (s) => s.line(m, add(m, h, drawn), 1));
    // 날밑: 둥근 금빛 (칼자루와 수직으로 3px)
    pen.fill('accent', (s) => s.line(add(guard, n, -1.5), add(guard, n, 1.5), 2));
    // 칼자루: 짙은 끈 감개(칼집과 같은 옻빛, 검은 코트 앞에서도 보이게)에 금빛 마름모 두 점, 끝 장식 금빛
    pen.fill('cloth', (s) => s.line(add(guard, h, 1.5), add(guard, h, SWORD.hilt - 1), 2));
    pen.fill('accent', (s) => {
      s.disc(add(guard, h, 3.5), 0.5);
      s.disc(add(guard, h, 6), 0.5);
      s.line(add(guard, h, SWORD.hilt - 0.5), add(guard, h, SWORD.hilt), 2);
    });
  },
  /**
   * 흐트러진 곱슬 금발 (일러스트): 머리보다 조금 큰 볼륨에 물결진 가장자리, 이마를 덮는 앞머리(눈썹까지, 끝이 말림),
   * 귀를 덮는 옆머리, 목덜미까지 오는 뒷머리. 아랫단은 한 단계 어둡게, 정수리 쪽 몇 가닥은 밝게
   */
  head(pen, j) {
    const { c, u, f, at } = headFrame(j);
    pen.fill('hairBack', (s) => {
      // 목덜미까지 오는 뒷머리 아랫단
      s.poly([at([-1.0, 0.6]), at([-6.0, 1.4]), at([-5.8, -3.2]), at([-3.0, -3.4]), at([-1.6, -1.2])]);
      // 귀를 덮는 옆머리 아랫단
      s.poly([at([1.4, 2.0]), at([-1.2, 2.2]), at([-0.6, -2.8]), at([1.0, -2.4])]);
    });
    pen.fill('hair', (s) => {
      // 볼륨: 머리 위·뒤를 덮는 조금 큰 둥근 머리 (얼굴 앞 아래는 남긴다)
      const o = at([-0.6, 0.9]);
      s.area(c[0] - 9, c[1] - 9, c[0] + 9, c[1] + 9, (x, y) => {
        const dx = x - c[0];
        const dy = y - c[1];
        const up = dx * u[0] + dy * u[1];
        const fr = dx * f[0] + dy * f[1];
        return Math.hypot(x - o[0], y - o[1]) <= 5.9 && (up >= 1.4 || fr <= -1.4);
      });
      // 물결진 가장자리: 뒤통수·목덜미 쪽에 작은 곱슬 덩어리 (정수리는 둥글게 두어 삐죽하지 않게)
      for (const p of [[-5.6, 3.6], [-6.4, 0.2], [-4.6, -2.8]] as const) s.disc(at(p), 1);
      // 앞머리: 이마를 덮고 눈썹 높이로 흘러내려 끝이 안쪽으로 말린다
      s.poly([at([-0.6, 6.0]), at([4.6, 4.8]), at([5.6, 2.6]), at([5.2, 1.0]), at([4.0, 1.8]), at([3.0, 1.0]), at([2.0, 2.8])]);
      // 옆머리: 귀를 덮고 귀 아래에서 말린다
      s.poly([at([1.6, 2.6]), at([-0.6, 2.8]), at([-0.4, -2.2]), at([1.2, -1.6])]);
    });
  },
};

/** 1P (일러스트): 올블랙 정장·롱코트(빛 받는 쪽은 회청), 곱슬 금발, 짙은 바다색 칼집, 금빛 날밑·장식, 은빛 칼날, 짙은 핏빛 넥타이 */
const OSCAR_P1: Look = {
  outline: 'ink', shadow: 'blackSuitDark', base: 'blackSuit', light: 'blackSuitLight',
  hair: ['blondDark', 'blond', 'blondLight'],
  cloth: ['blackSuitDark', 'deepSea', 'deepSeaLight'],
  accent: ['goldDark', 'gold'],
  trim: 'bloodMoonDark',
  glow: 'moonLight',
  metal: ['moonDark', 'moon', 'moonLight'],
  skin: ['skinDark', 'skin', 'skinLight'],
};
/** 2P: 짙은 바다색 정장·코트, 은발, 핏빛 칼집, 은빛 장식 */
const OSCAR_P2: Look = {
  outline: 'ink', shadow: 'blackSuitDark', base: 'deepSea', light: 'deepSeaLight',
  hair: ['moonDark', 'moon', 'moonLight'],
  cloth: ['blackSuitDark', 'bloodMoonDark', 'bloodMoon'],
  accent: ['moonDark', 'moon'],
  trim: 'bloodMoon',
  glow: 'moonLight',
  metal: ['moonDark', 'moon', 'moonLight'],
  skin: ['skinDark', 'skin', 'skinLight'],
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
