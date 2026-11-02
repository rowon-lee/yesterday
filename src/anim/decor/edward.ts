import type { Joints, Point } from '../pose';
import type { Decor, Look } from '../skeleton';
import type { Skin } from '../skins';

/*
 * 에드워드 '아서' 와인포드 표식 (캐릭터 기획서): 가장 큰 체격(선을 한 단계 굵게: 팔다리 5px·몸통 6px), 흰 짧은 머리,
 * 붉은 정장에 흰 넥타이, 워 해머, 허리의 청동 단검. 눈은 그리지 않는다 (CLAUDE.md).
 * 모두 관절에 붙는 도형이라 어떤 동작에서도 따라간다. 오른쪽을 보는 모습 기준 (왼쪽은 시트를 그릴 때 뒤집는다).
 * 해머는 앞손이 쥐고, 포즈의 무기 각도(wa)대로 앞손에서 해머 머리가 뻗는다. 두 손으로 쥘 때는 뒷손을 손잡이 아래쪽에 둔다
 * (data/poses/edward/stance.ts의 grip2).
 */

const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k];
const norm = (v: Point): Point => {
  const d = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / d, v[1] / d];
};

/** 몸통 방향(엉덩이 → 목)과 몸의 앞쪽 (오른쪽을 볼 때 가슴 쪽) */
function torso(j: Joints): { up: Point; down: Point; front: Point } {
  const up = norm([j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]]);
  return { up, down: [-up[0], -up[1]], front: [-up[1], up[0]] };
}

/** 해머 치수 (px): 손에서 해머 머리 가운데까지, 손에서 손잡이 끝까지, 머리 반길이(손잡이와 수직), 머리 반두께(손잡이 방향) */
export const HAMMER = { reach: 21, pommel: 2.5, half: 6, thick: 3.5 } as const;

/** 해머 머리 가운데 자리 (발밑 기준 px): 앞손에서 무기 각도로 HAMMER.reach */
export function hammerHead(j: Joints): Point {
  return [j.hF[0] + Math.cos(j.wa) * HAMMER.reach, j.hF[1] + Math.sin(j.wa) * HAMMER.reach];
}

/** 해머: 청동 손잡이(끝에 청동 마개), 쇠 머리(양 끝에 청동 띠, 위를 향한 모서리에 흰 빛 1px) */
function hammer(pen: Parameters<NonNullable<Decor['body']>>[0], j: Joints): void {
  const u: Point = [Math.cos(j.wa), Math.sin(j.wa)];
  const v: Point = [-u[1], u[0]];
  const hand = j.hF;
  const head = add(hand, u, HAMMER.reach);
  const pommel = add(hand, u, -HAMMER.pommel);
  const corner = (a: number, b: number): Point => add(add(head, v, a), u, b);
  pen.fill('accent', (s) => {
    // 손잡이 (2px), 손잡이 끝 마개
    s.line(pommel, add(head, u, -HAMMER.thick), 2);
    s.disc(pommel, 1);
  });
  pen.fill('glow', (s) => {
    s.poly([corner(-HAMMER.half, -HAMMER.thick), corner(HAMMER.half, -HAMMER.thick), corner(HAMMER.half, HAMMER.thick), corner(-HAMMER.half, HAMMER.thick)]);
  });
  pen.fill('accent', (s) => {
    // 머리 양 끝을 감은 청동 띠
    for (const k of [-1, 1]) s.line(corner(k * (HAMMER.half - 1.5), -HAMMER.thick + 0.5), corner(k * (HAMMER.half - 1.5), HAMMER.thick - 0.5), 2);
  });
  pen.fill('trim', (s) => {
    // 위를 향한 긴 모서리에 흰 빛 (쇠가 빛을 받는다)
    const side = v[1] < 0 ? 1 : -1;
    const a = corner(side * (HAMMER.half - 0.5), -HAMMER.thick + 1.5);
    const b = corner(side * (HAMMER.half - 0.5), HAMMER.thick - 1.5);
    s.line(a, b, 1);
  });
}

export const EDWARD_DECOR: Decor = {
  limbW: 5,
  torsoW: 6,
  headR: 5,
  /** 정장 재킷(넓은 어깨, 엉덩이 아래 자락), 어두운 셔츠 깃과 흰 넥타이, 허리 뒤쪽의 청동 단검, 해머 */
  body(pen, j) {
    const { down, front } = torso(j);
    const top = add(j.neck, down, 1.2);
    // 자락은 몸이 기울어도 아래로 처지게 몸통 방향에 중력을 섞는다. 어깨가 넓고(등 쪽 4.8px), 자락은 짧고 반듯하다
    const hang = norm([down[0] * 0.6, down[1] * 0.6 + 0.4]);
    pen.fill('cloth', (s) => s.poly([
      add(top, front, 3.4),
      add(add(top, front, -4.8), down, 0.5),
      add(add(j.hip, front, -4.6), down, -2),
      add(add(j.hip, front, -5.2), hang, 7),
      add(add(j.hip, front, -1), hang, 6),
      add(add(j.hip, front, 3.4), hang, 4.5),
      add(add(j.hip, front, 3.6), down, -3),
    ]));
    // 셔츠 깃: 목 아래 가슴 앞 가장자리의 어두운 V (옆모습이라 앞팔에 가리지 않게 가슴 앞선에 둔다)
    pen.fill('clothBack', (s) => s.poly([add(top, front, 1.4), add(top, front, 4.2), add(add(top, down, 5), front, 3.8)]));
    // 흰 넥타이: 매듭에서 배까지 가슴 앞선을 따라 내려온다 (옆모습의 넥타이)
    const knot = add(add(top, down, 1.2), front, 3.4);
    pen.fill('trim', (s) => {
      s.disc(knot, 1);
      s.line(knot, add(add(top, down, 10.5), front, 3.9), 2);
    });
    // 청동 단검: 허리 뒤쪽에 비스듬히 찬다 (자루와 날밑은 청동, 칼집은 어둡게)
    const hilt = add(add(j.hip, front, -3.4), down, -2.5);
    const guard = add(add(j.hip, front, -4), down, -0.5);
    pen.fill('clothBack', (s) => s.line(guard, add(add(j.hip, front, -6.5), down, 5.5), 2));
    pen.fill('accent', (s) => {
      s.line(hilt, guard, 2);
      s.line(add(guard, front, 1.2), add(guard, front, -1.6), 1);
    });
    hammer(pen, j);
  },
  /** 흰 짧은 머리: 뒤로 단정히 넘긴 머리 (윗머리는 위·뒤로 조금 부풀고 뒷머리는 귀 높이까지), 아랫단은 한 단계 어둡게 */
  head(pen, j) {
    const c = j.head;
    const r = j.ha;
    const u: Point = [Math.sin(r), -Math.cos(r)];
    const f: Point = [-u[1], u[0]];
    const at = (p: readonly [number, number]): Point => [c[0] + f[0] * p[0] + u[0] * p[1], c[1] + f[1] * p[0] + u[1] * p[1]];
    pen.fill('hairBack', (s) => {
      // 목덜미 쪽 짧게 친 아랫단
      s.poly([at([-1.5, 0.5]), at([-5.6, 1.2]), at([-5.2, -2.8]), at([-2.6, -2.2])]);
    });
    pen.fill('hair', (s) => {
      const o = at([-0.8, 1]);
      s.area(c[0] - 8, c[1] - 8, c[0] + 8, c[1] + 8, (x, y) => {
        const dx = x - c[0];
        const dy = y - c[1];
        const up = dx * u[0] + dy * u[1];
        const fr = dx * f[0] + dy * f[1];
        return Math.hypot(x - o[0], y - o[1]) <= 5.9 && (up >= 1.2 || (fr <= -1.8 && up >= -1.5));
      });
      // 이마 위에서 뒤로 넘긴 앞머리 (조금 솟는다)
      s.poly([at([3.6, 3.2]), at([1.8, 6.6]), at([-2.6, 6.4]), at([0.2, 4.6])]);
    });
  },
};

/** 에드워드 1P: 붉은 정장(몸·재킷), 흰 머리, 청동(단검·해머 손잡이·띠), 흰 넥타이, 쇠 해머 머리(빛나는 곳 자리) */
const EDWARD_P1: Look = {
  outline: 'ink', shadow: 'crimsonDark', base: 'crimson', light: 'crimsonLight',
  hair: ['paleGrey', 'white', 'fxWhite'],
  cloth: ['crimsonDeep', 'crimson', 'crimsonLight'],
  accent: ['bronze', 'bronzeLight'],
  trim: 'white',
  glow: 'hammerLight',
};
/** 에드워드 2P (같은 캐릭터끼리): 밝은 회색 정장(어두운 밤에도 몸이 읽히게), 같은 흰 머리·청동·해머 */
const EDWARD_P2: Look = {
  outline: 'ink', shadow: 'suitGrey', base: 'suitGreyLight', light: 'paleGrey',
  hair: ['paleGrey', 'white', 'fxWhite'],
  cloth: ['suitGreyDark', 'suitGreyLight', 'paleGrey'],
  accent: ['bronze', 'bronzeLight'],
  trim: 'white',
  glow: 'hammerLight',
};
/** 푸른 잔상 (대시·돌진·재현) */
const EDWARD_GHOST: Look = { outline: 'veilDark', shadow: 'veilDark', base: 'veil', light: 'veil' };
/** 차지를 모으는 동안 몸이 푸른 장막 빛으로 빛난다 (해머 머리는 희게) */
const EDWARD_GLOW: Look = { outline: 'ink', shadow: 'veil', base: 'veilLight', light: 'white', glow: 'white' };

/** 에드워드 겉모습: 장식과 색 묶음 (1P·2P·잔상·빛남) */
export const EDWARD_SKIN: Skin = {
  id: 'edward',
  label: '에드워드',
  decor: EDWARD_DECOR,
  looks: { p1: EDWARD_P1, p2: EDWARD_P2, ghost1: EDWARD_GHOST, ghost2: EDWARD_GHOST, glow1: EDWARD_GLOW, glow2: EDWARD_GLOW },
};
