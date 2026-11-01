import { COLORS, type ColorName } from '../render/palette';
import type { Joints, Point } from './pose';
import { Indexed, Mask, outlineSilhouette, paint, stampDisc, stampLine, type Shade } from './raster';

/** 굵기 (외곽선 제외). 전체 모양 바깥 둘레에 1px 외곽선이 붙는다. */
export const LIMB_W = 4;
export const TORSO_W = 5;
const HEAD_R = 5;
const FIST_W = 5;
const TOE_LEN = 3;

/**
 * 그림 색 번호 (Indexed에 찍히는 값). 1~4는 몸, 5부터는 캐릭터 장식 (머리카락·옷·작은 장식·밝은 천·빛나는 곳).
 * 색은 색 묶음(Look)이 정한다. 장식 색이 없는 색 묶음(번쩍임·잔상 등)은 장식도 몸 색으로 칠한다.
 */
export const SLOT = {
  outline: 1, shadow: 2, base: 3, light: 4,
  hairShadow: 5, hair: 6, hairLight: 7,
  clothShadow: 8, cloth: 9, clothLight: 10,
  accent: 11, accentLight: 12,
  trim: 13,
  glow: 14,
} as const;

/** 캐릭터 색 한 벌: 어두운 단계, 바탕, 밝은 단계 (+ 장식 색: 없으면 몸 색으로) */
export interface Look {
  outline: ColorName;
  shadow: ColorName;
  base: ColorName;
  light: ColorName;
  /** 머리카락 [어둠, 바탕, 밝음] */
  hair?: readonly [ColorName, ColorName, ColorName];
  /** 옷 (재킷·가운 등) [어둠, 바탕, 밝음] */
  cloth?: readonly [ColorName, ColorName, ColorName];
  /** 작은 장식 (넥타이 등) [바탕, 밝음] */
  accent?: readonly [ColorName, ColorName];
  /** 밝은 천 (셔츠 깃 등) */
  trim?: ColorName;
  /** 빛나는 곳 */
  glow?: ColorName;
}

/** 아직 캐릭터가 없어서 뼈대만 그릴 때 쓰는 색 (1P, 2P) */
export const LOOKS = {
  p1: { outline: 'ink', shadow: 'goldDark', base: 'gold', light: 'goldLight' },
  p2: { outline: 'ink', shadow: 'skyDark', base: 'sky', light: 'skyLight' },
  /** 잔상 (대시·돌진할 때 뒤에 남는 그림자) */
  ghost1: { outline: 'goldDark', shadow: 'goldDark', base: 'goldDark', light: 'goldDark' },
  ghost2: { outline: 'skyDark', shadow: 'skyDark', base: 'skyDark', light: 'skyDark' },
  /** 낙법으로 도는 동안 회전 궤적을 따라 남는 흰 잔상 */
  ghostW: { outline: 'white', shadow: 'white', base: 'white', light: 'white' },
  /** 맞은 순간 하얗게 번쩍임 */
  flash: { outline: 'ink', shadow: 'white', base: 'white', light: 'white' },
  /** 차지를 모으는 동안 몸이 빛남: 한 단계씩 밝게 (렌더가 단계마다 맥박치듯 바꿔 끼운다) */
  glow1: { outline: 'ink', shadow: 'gold', base: 'goldLight', light: 'white' },
  glow2: { outline: 'ink', shadow: 'sky', base: 'skyLight', light: 'white' },
} as const satisfies Record<string, Look>;
export type LookName = keyof typeof LOOKS;

/**
 * 앞 부위가 뒤 부위를 가리는 경계선. 검은 외곽선은 바깥 둘레에만 두르고,
 * 안쪽 경계는 이 색으로 긋는다 (0이면 긋지 않음).
 */
const INNER_LINE: number = 0;

/** 앞쪽 부위와 몸통: 빛 받는 쪽 한 단계 밝게 */
const FRONT: Shade = { base: SLOT.base, light: SLOT.light, inner: INNER_LINE };
/** 뒤쪽 팔다리: 전체를 한 단계 어둡게 */
const BACK: Shade = { base: SLOT.shadow, light: SLOT.base, inner: INNER_LINE };

/** 장식을 칠할 색 갈래: 머리카락·머리카락 아랫단·옷·뒤쪽 옷(한 단계 어둡게)·작은 장식·밝은 천·빛나는 곳·몸 색 */
export type DecorPart = 'hair' | 'hairBack' | 'cloth' | 'clothBack' | 'accent' | 'trim' | 'glow' | 'body';
const PART_SHADE: Record<DecorPart, Shade> = {
  hair: { base: SLOT.hair, light: SLOT.hairLight, inner: 0 },
  /** 머리카락 아랫단 (그늘진 안쪽 층, 한 단계 어둡게) */
  hairBack: { base: SLOT.hairShadow, light: SLOT.hair, inner: 0 },
  cloth: { base: SLOT.cloth, light: SLOT.clothLight, inner: 0 },
  clothBack: { base: SLOT.clothShadow, light: SLOT.cloth, inner: 0 },
  accent: { base: SLOT.accent, light: SLOT.accentLight, inner: 0 },
  trim: { base: SLOT.trim, light: SLOT.trim, inner: 0 },
  glow: { base: SLOT.glow, light: SLOT.glow, inner: 0 },
  body: FRONT,
};

/** 장식 도형을 마스크에 찍는 붓 (좌표는 발밑 기준점 상대, 오른쪽을 보는 모습) */
export interface Stamp {
  line(a: Point, b: Point, w: number): void;
  disc(c: Point, r: number): void;
  /** 볼록·오목 다각형 채우기 */
  poly(pts: readonly Point[]): void;
  /** 둘레 상자 안에서 test가 참인 칸 */
  area(x0: number, y0: number, x1: number, y1: number, test: (x: number, y: number) => boolean): void;
}
/** 장식 그리기: 한 덩어리씩 칠한다 (빛 받는 위·앞 가장자리는 밝게) */
export interface DecorPen {
  fill(part: DecorPart, draw: (s: Stamp) => void): void;
}
/**
 * 캐릭터 장식 (머리 모양, 옷자락, 넥타이…): 관절에 붙는 도형 함수. 몸을 그리는 순서 사이사이에 끼워 그린다.
 * behind: 뒷다리보다 먼저 (몸 뒤로 늘어지는 자락) / body: 앞다리 뒤·앞팔 앞 (옷·넥타이) / head: 머리 위 (머리카락) / top: 맨 위
 */
export interface Decor {
  behind?(pen: DecorPen, j: Joints): void;
  body?(pen: DecorPen, j: Joints): void;
  head?(pen: DecorPen, j: Joints): void;
  top?(pen: DecorPen, j: Joints): void;
}

/**
 * 뼈대 하나를 색 번호 그림에 그린다. (ox, oy)는 발밑 기준점 위치, 오른쪽을 보는 모습.
 * 그리는 순서: (장식 behind) 뒷다리, 뒷팔, 몸통·머리, 앞다리, (장식 body·head) 앞팔, (장식 top).
 * 검은 외곽선은 다 그린 뒤 전체 모양의 바깥 둘레에만 두른다.
 * clip: 장식이 이 칸(x0~x1) 밖으로 나가 옆 프레임에 번지지 않게 자른다.
 */
export function drawSkeleton(img: Indexed, j: Joints, ox: number, oy: number, decor?: Decor, clip?: readonly [number, number]): void {
  const P = (q: Point): Point => [ox + q[0], oy + q[1]];
  const group = (draw: (m: Mask) => void, shade: Shade) => {
    const m = new Mask(img.w, img.h);
    draw(m);
    paint(img, m, shade);
  };
  const [cx0, cx1] = clip ?? [0, img.w];
  const pen: DecorPen = {
    fill(part, draw) {
      const m = new Mask(img.w, img.h);
      const set = (x: number, y: number) => {
        if (x >= cx0 && x < cx1) m.set(x, y);
      };
      const clipped = new Mask(img.w, img.h);
      draw({
        line: (a, b, w) => stampLine(clipped, ...P(a), ...P(b), w),
        disc: (c, r) => stampDisc(clipped, ...P(c), r),
        poly: (pts) => fillPoly(pts.map(P), set),
        area: (x0, y0, x1, y1, test) => {
          for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
            for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (test(x, y)) set(ox + x, oy + y);
          }
        },
      });
      for (let y = 0; y < img.h; y++) for (let x = cx0; x < cx1; x++) if (clipped.get(x, y)) m.set(x, y);
      paint(img, m, PART_SHADE[part]);
    },
  };
  const seg = (m: Mask, a: Point, b: Point, w: number) => stampLine(m, ...P(a), ...P(b), w);
  /** 정강이 방향에 수직으로 앞쪽에 발끝. 발목보다 아래로는 내리지 않는다 (바닥을 뚫지 않게). */
  const toe = (knee: Point, foot: Point): Point => {
    const dx = foot[0] - knee[0];
    const dy = foot[1] - knee[1];
    const d = Math.hypot(dx, dy) || 1;
    let tx = dy / d;
    let ty = -dx / d;
    if (ty > 0) {
      tx = 1;
      ty = 0;
    }
    return [Math.round(foot[0] + tx * TOE_LEN), Math.round(foot[1] + ty * TOE_LEN)];
  };
  const leg = (m: Mask, knee: Point, foot: Point) => {
    seg(m, j.hip, knee, LIMB_W);
    seg(m, knee, foot, LIMB_W);
    seg(m, foot, toe(knee, foot), LIMB_W);
  };

  decor?.behind?.(pen, j);
  group((m) => leg(m, j.kB, j.fB), BACK);
  group((m) => {
    seg(m, j.sh, j.eB, LIMB_W);
    seg(m, j.eB, j.hB, LIMB_W);
  }, BACK);
  group((m) => {
    seg(m, j.hip, j.neck, TORSO_W);
    seg(m, j.neck, j.head, LIMB_W);
    stampDisc(m, ...P(j.head), HEAD_R);
  }, FRONT);
  group((m) => leg(m, j.kF, j.fF), FRONT);
  decor?.body?.(pen, j);
  decor?.head?.(pen, j);
  group((m) => {
    seg(m, j.sh, j.eF, LIMB_W);
    seg(m, j.eF, j.hF, LIMB_W);
    seg(m, j.hF, j.hF, FIST_W);
  }, FRONT);
  decor?.top?.(pen, j);
  outlineSilhouette(img, SLOT.outline);
}

/** 다각형 채우기 (짝홀 규칙, 칸 가운데로 판단) */
function fillPoly(pts: readonly Point[], set: (x: number, y: number) => void): void {
  if (pts.length < 3) return;
  const ys = pts.map((p) => p[1]);
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) set(x, y);
    }
  }
}

/** 색 번호 그림 → 캔버스 픽셀 */
export function toImageData(img: Indexed, look: Look): ImageData {
  const rgb = (name: ColorName) => {
    const n = parseInt(COLORS[name].slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const table: number[][] = [];
  table[SLOT.outline] = rgb(look.outline);
  table[SLOT.shadow] = rgb(look.shadow);
  table[SLOT.base] = rgb(look.base);
  table[SLOT.light] = rgb(look.light);
  // 장식: 색이 없으면 몸 색 (번쩍임·잔상·빛남은 장식까지 한 색으로)
  const hair = look.hair ?? [look.shadow, look.base, look.light];
  const cloth = look.cloth ?? [look.shadow, look.base, look.light];
  const accent = look.accent ?? [look.base, look.light];
  table[SLOT.hairShadow] = rgb(hair[0]);
  table[SLOT.hair] = rgb(hair[1]);
  table[SLOT.hairLight] = rgb(hair[2]);
  table[SLOT.clothShadow] = rgb(cloth[0]);
  table[SLOT.cloth] = rgb(cloth[1]);
  table[SLOT.clothLight] = rgb(cloth[2]);
  table[SLOT.accent] = rgb(accent[0]);
  table[SLOT.accentLight] = rgb(accent[1]);
  table[SLOT.trim] = rgb(look.trim ?? look.light);
  table[SLOT.glow] = rgb(look.glow ?? look.light);
  const out = new ImageData(img.w, img.h);
  for (let i = 0; i < img.a.length; i++) {
    const c = img.a[i];
    if (!c) continue;
    const [r, g, b] = table[c];
    out.data[i * 4] = r;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = b;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}
