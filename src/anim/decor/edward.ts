import type { Joints, Point } from '../pose';
import type { Decor, DecorPen, Look } from '../skeleton';
import type { Skin } from '../skins';
import { add, flutter, hangDir, headFrame, norm, torso, trousers } from './kit';

/*
 * 에드워드 '아서' 와인포드 표식 (캐릭터 기획서 + 사용자 일러스트 2026-11-02 `docs/refs/에드워드_일러스트.webp`).
 * 일러스트의 두 모습: 와인포드 가주(붉은 롱코트·검은 조끼와 바지)와 제9대 이능력범죄대응국장(흰 롱코트·금빛 장식·워 해머).
 * - 1P = 가주: 소매까지 붉은 롱코트(종아리까지, 뒷자락은 한 단계 어둡게 휘날린다), 검은 조끼·바지·구두, 흰 넥타이(기획서)
 * - 2P = 국장: 흰 롱코트, 검은 제복, 금빛 장식·끈 (같은 모양에 색만 바꾼다)
 * - 흰 머리: 숱 많게 위·뒤로 쓸어 넘기고, 한 가닥이 이마로 흘러내린다
 * - 가장 큰 체격(선을 한 단계 굵게: 팔다리 5px·몸통 6px, 기획서)
 * - 워 해머 (일러스트): 긴 손잡이 끝의 장식 머리(고리·꼭지), 네모난 쇠 머리(양 끝에 띠). 앞손이 쥐고, 포즈의 무기 각도(wa)대로 머리가 뻗는다.
 *   두 손으로 쥘 때는 뒷손을 손잡이 아래쪽에 둔다 (data/poses/edward/stance.ts의 grip2)
 * - 허리의 청동 단검 (기획서), 일러스트의 허리에 찬 칼처럼 뒤로 비스듬히
 * 눈은 그리지 않는다 (CLAUDE.md). 모두 관절에 붙는 도형이라 어떤 동작에서도 따라간다. 오른쪽을 보는 모습 기준.
 */

const LIMB = 5;

/**
 * 해머 치수 (그림 px, 2026-11-02 피드백 12-0: 자루 30px, 머리 12×9px): 앞손에서 해머 머리 가운데까지(reach), 앞손에서 자루 끝까지(pommel),
 * 머리 반길이(자루와 수직, half), 머리 반두께(자루 방향, thick). 자루 = pommel + reach − thick = 30, 머리 = 2·half × 2·thick = 12 × 9.
 * 앞손은 자루 끝 가까이(4.5px 위)를, 두 손으로 쥘 때 뒷손은 앞손보다 6px 머리 쪽을 쥔다 (data/poses/edward/stance.ts grip2).
 * 몸은 크기 배율(E_SCALE)로 커지지만 해머는 이 그림 크기 그대로다 (포즈에서 쓸 때는 배율로 나눈다)
 */
export const HAMMER = { reach: 30, pommel: 4.5, half: 6, thick: 4.5 } as const;

/** 해머 머리 가운데 자리 (발밑 기준 그림 px): 앞손에서 무기 각도로 HAMMER.reach */
export function hammerHead(j: Joints): Point {
  return [j.hF[0] + Math.cos(j.wa) * HAMMER.reach, j.hF[1] + Math.sin(j.wa) * HAMMER.reach];
}

/**
 * 워 해머: 어두운 청동 자루(3px), 자루 끝의 둥근 꼭지, 머리 밑 고리, 청동 머리 12×9 (빛 받는 위·앞 면이 1px 밝다: 칠하기가 위·앞 가장자리를 밝힌다).
 * 일러스트의 장식 머리를 단순하게 (2026-11-02 피드백 12-0)
 */
function hammer(pen: DecorPen, j: Joints): void {
  const u: Point = [Math.cos(j.wa), Math.sin(j.wa)];
  const v: Point = [-u[1], u[0]];
  const hand = j.hF;
  const head = add(hand, u, HAMMER.reach);
  const end = add(hand, u, -HAMMER.pommel);
  const corner = (a: number, b: number): Point => add(add(head, v, a), u, b);
  // 자루 (3px, 어두운 청동)
  pen.fill('metalBack', (s) => s.line(end, add(head, u, -HAMMER.thick), 3));
  // 자루 끝 꼭지, 머리 밑 고리
  pen.fill('accent', (s) => {
    s.disc(end, 2);
    const collar = add(head, u, -HAMMER.thick - 1.5);
    s.line(add(collar, v, -2.5), add(collar, v, 2.5), 2);
  });
  // 청동 머리 12×9
  pen.fill('metal', (s) => {
    s.poly([corner(-HAMMER.half, -HAMMER.thick), corner(HAMMER.half, -HAMMER.thick), corner(HAMMER.half, HAMMER.thick), corner(-HAMMER.half, HAMMER.thick)]);
  });
}

/** 바람에 날리는 방향: 늘어진 방향(dir)을 바람(0~1)만큼 위로 (옆쪽 side로 조금 벌어진다) */
function windy(dir: Point, side: Point, wind: number): Point {
  if (wind <= 0) return dir;
  return norm([dir[0] * (1 - wind) + side[0] * 0.35 * wind, dir[1] * (1 - wind) - 1.0 * wind + side[1] * 0.35 * wind]);
}

/** 스미어 잔상: 앞 프레임 해머 머리에서 지금 머리까지 n개, 푸른 장막 색 (껍데기 색, 2026-11-02 피드백 12-1 '해머 머리 잔상 3개') */
function hammerGhosts(pen: DecorPen, j: Joints, prev: Joints, n: number): void {
  pen.fill('glow', (s) => {
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const a = prev.wa + (j.wa - prev.wa) * t;
      const u: Point = [Math.cos(a), Math.sin(a)];
      const v: Point = [-u[1], u[0]];
      const hand: Point = [prev.hF[0] + (j.hF[0] - prev.hF[0]) * t, prev.hF[1] + (j.hF[1] - prev.hF[1]) * t];
      const head = add(hand, u, HAMMER.reach);
      // 오래된 잔상일수록 조금 작다
      const h = HAMMER.half - (n - k) * 0.8;
      const w = HAMMER.thick - (n - k) * 0.6;
      const c = (p: number, q: number): Point => add(add(head, v, p), u, q);
      s.poly([c(-h, -w), c(h, -w), c(h, w), c(-h, w)]);
    }
  });
}

export const EDWARD_DECOR: Decor = {
  /** 피부는 얼굴과 손 (옷은 몸 색: 1P 붉은 코트, 2P 흰 코트) */
  skin: { face: true, hands: true },
  limbW: LIMB,
  torsoW: 6,
  headR: 5,
  ghost: hammerGhosts,
  /** 롱코트 뒷자락: 넓은 어깨 뒤에서 종아리까지 (한 단계 어둡게), 걸음·숙임에 뒤로 휘날린다 */
  behind(pen, j) {
    const { down, front, back } = torso(j);
    const k = flutter(j);
    // 바람 (수직으로 떨어질 때): 자락이 위로 펄럭인다
    const hang = windy(hangDir(j, k, 0.55), back, j.wind);
    const top = add(j.neck, down, 1.5);
    const len = 21 + 2 * k;
    pen.fill('bodyBack', (s) => s.poly([
      add(top, back, 6.5),
      add(top, front, 1),
      add(add(j.hip, front, 1.5), hang, 8),
      add(add(j.hip, front, 0.5), hang, len - 2),
      add(add(j.hip, back, 3.5 + 2 * k), hang, len),
      add(add(j.hip, back, 6.5 + 3 * k), hang, len - 3),
      add(j.hip, back, 5.5),
    ]));
  },
  /** 뒷다리 검은 바지·구두 (한 단계 어둡게) */
  backLeg(pen, j) {
    trousers(pen, j, 'B', LIMB, 'clothBack');
  },
  /** 앞다리 바지, 코트 몸판·옷깃·앞자락, 검은 조끼, 흰 넥타이, 허리 뒤의 청동 단검, 해머 */
  body(pen, j) {
    trousers(pen, j, 'F', LIMB, 'cloth');
    const { up, down, front } = torso(j);
    const top = add(j.neck, down, 1.2);
    const k = flutter(j);
    const hang = windy(norm([down[0] * 0.6 - front[0] * 0.15 * k, down[1] * 0.6 + 0.4 - front[1] * 0.15 * k]), front, j.wind);
    // 코트 몸판: 어깨가 넓은 역삼각형 (어깨 앞 4.6px·등 7px → 허리 앞 3.6px·등 4.8px, 2026-11-02 피드백 12-0 '어깨 폭 넓게'), 앞자락은 열려 무릎 아래까지
    pen.fill('body', (s) => {
      s.poly([
        add(top, front, 4.6), add(add(top, front, -5.5), up, 0.8), add(add(top, front, -7), down, 2.5),
        add(add(top, front, -6), down, 7), add(j.hip, front, -4.8), add(j.hip, front, 3.6), add(add(top, front, 4.2), down, 6),
      ]);
      s.poly([add(j.hip, front, 3.6), add(j.hip, front, -1), add(add(j.hip, front, -0.5), hang, 12 + 2 * k), add(add(j.hip, front, 3), hang, 10)]);
    });
    // 검은 조끼: 열린 코트 앞섶 사이로 가슴에서 배까지 보인다
    pen.fill('cloth', (s) => s.poly([add(top, front, 1.2), add(top, front, 3.6), add(add(j.hip, front, 3.6), up, 2), add(add(j.hip, front, 1.4), up, 2)]));
    // 옷깃: 목 아래에서 가슴으로 접힌 넓은 깃 (한 단계 어둡게)
    pen.fill('bodyBack', (s) => s.poly([add(top, front, 3.6), add(top, front, 4.6), add(add(top, down, 7), front, 4), add(add(top, down, 5), front, 3.2)]));
    // 흰 넥타이: 매듭에서 조끼 아래까지 가슴 앞선을 따라 (바람이 불면 어깨 위로 펄럭인다)
    const knot = add(add(top, down, 1.2), front, 2.6);
    const tieEnd = j.wind > 0 ? add(knot, windy(down, front, j.wind), 8.5) : add(add(top, down, 10), front, 3);
    pen.fill('trim', (s) => {
      s.disc(knot, 1);
      s.line(knot, tieEnd, 1);
    });
    // 청동 단검: 허리 뒤에 비스듬히 찬다 (칼집은 어둡게, 자루와 날밑은 청동)
    const hilt = add(add(j.hip, front, -3.6), up, 3);
    const guard = add(add(j.hip, front, -4.4), up, 1);
    pen.fill('clothBack', (s) => s.line(guard, add(add(j.hip, front, -7.5), down, 6), 2));
    pen.fill('accent', (s) => {
      s.line(hilt, guard, 2);
      s.line(add(guard, front, 1.4), add(guard, front, -1.8), 1);
    });
    hammer(pen, j);
  },
  /** 흰 머리: 숱 많게 위·뒤로 쓸어 넘긴 머리(이마 위에서 솟고, 앞끝이 이마 앞으로 조금 흘러내린다), 짧은 뒷머리 */
  head(pen, j) {
    const { c, u, f, at } = headFrame(j);
    pen.fill('hairBack', (s) => {
      // 목덜미 쪽 짧게 친 아랫단
      s.poly([at([-1.5, 0.5]), at([-5.8, 1.4]), at([-5.4, -2.6]), at([-2.6, -2.2])]);
    });
    pen.fill('hair', (s) => {
      const o = at([-0.6, 1.4]);
      s.area(c[0] - 9, c[1] - 9, c[0] + 9, c[1] + 9, (x, y) => {
        const dx = x - c[0];
        const dy = y - c[1];
        const up = dx * u[0] + dy * u[1];
        const fr = dx * f[0] + dy * f[1];
        return Math.hypot(x - o[0], y - o[1]) <= 6 && (up >= 1.4 || (fr <= -1.8 && up >= -1.6));
      });
      // 이마 위에서 솟아 뒤로 넘어가는 앞머리 (앞끝이 이마 앞으로 조금 흘러내린다. 얼굴 안쪽에는 아무것도 그리지 않는다: 눈처럼 보이지 않게)
      s.poly([at([4.4, 3.4]), at([3.4, 7.2]), at([-0.8, 7.8]), at([-3.6, 6.8]), at([0.6, 5.4])]);
      s.poly([at([3.6, 4.4]), at([5.6, 3.8]), at([6.0, 2.2]), at([4.6, 2.8])]);
    });
  },
};

/** 1P 와인포드 가주 (일러스트 왼쪽): 붉은 롱코트(몸·소매), 검은 조끼·바지·구두, 흰 머리, 흰 넥타이, 청동, 쇠 해머 */
const EDWARD_P1: Look = {
  outline: 'ink', shadow: 'crimsonDark', base: 'crimson', light: 'crimsonLight',
  hair: ['paleGrey', 'white', 'fxWhite'],
  cloth: ['blackSuitDark', 'blackSuit', 'blackSuitLight'],
  accent: ['bronze', 'bronzeLight'],
  trim: 'white',
  glow: 'veil',
  metal: ['bronzeDark', 'bronze', 'bronzeLight'],
  skin: ['skinDark', 'skin', 'skinLight'],
};
/** 2P 이능력범죄대응국장 (일러스트 오른쪽): 흰 롱코트, 검은 제복, 금빛 장식·끈, 흰 머리, 쇠 해머 */
const EDWARD_P2: Look = {
  outline: 'ink', shadow: 'gownShade', base: 'gown', light: 'white',
  hair: ['suitGrey', 'paleGrey', 'white'],
  cloth: ['blackSuitDark', 'blackSuit', 'blackSuitLight'],
  accent: ['goldDark', 'gold'],
  trim: 'gold',
  glow: 'veil',
  metal: ['bronzeDark', 'bronze', 'bronzeLight'],
  skin: ['skinDark', 'skin', 'skinLight'],
};
/** 푸른 잔상 (대시·돌진·재현) */
const EDWARD_GHOST: Look = { outline: 'veilDark', shadow: 'veilDark', base: 'veil', light: 'veil' };
/**
 * 차지를 모으는 동안: 몸 색은 그대로 두고 외곽선만 푸른 장막 색 (2026-11-02 피드백 12-2 '팔·등에 푸른 장막 윤곽'. 단계마다 짙어지는 바깥 윤곽은
 * 렌더 vfx/edward-fx veilAura가 더한다)
 */
const EDWARD_GLOW1: Look = { ...EDWARD_P1, outline: 'veilDark' };
const EDWARD_GLOW2: Look = { ...EDWARD_P2, outline: 'veilDark' };

/** 에드워드 겉모습: 장식과 색 묶음 (1P·2P·잔상·빛남) */
export const EDWARD_SKIN: Skin = {
  id: 'edward',
  label: '에드워드',
  decor: EDWARD_DECOR,
  looks: { p1: EDWARD_P1, p2: EDWARD_P2, ghost1: EDWARD_GHOST, ghost2: EDWARD_GHOST, glow1: EDWARD_GLOW1, glow2: EDWARD_GLOW2 },
};
