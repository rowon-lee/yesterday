import { COLORS, type ColorName } from '../render/palette';
import type { Joints, Point } from './pose';
import { Indexed, Mask, outlineSilhouette, paint, stampDisc, stampLine, type Shade } from './raster';

/** 굵기 (외곽선 제외). 전체 모양 바깥 둘레에 1px 외곽선이 붙는다. */
export const LIMB_W = 4;
export const TORSO_W = 5;
const HEAD_R = 5;
const FIST_W = 5;
const TOE_LEN = 3;

/** 그림 색 번호 (Indexed에 찍히는 값) */
export const SLOT = { outline: 1, shadow: 2, base: 3, light: 4 } as const;

/** 캐릭터 색 한 벌: 어두운 단계, 바탕, 밝은 단계 */
export interface Look {
  outline: ColorName;
  shadow: ColorName;
  base: ColorName;
  light: ColorName;
}

/** 아직 캐릭터가 없어서 뼈대만 그릴 때 쓰는 색 (1P, 2P) */
export const LOOKS = {
  p1: { outline: 'ink', shadow: 'goldDark', base: 'gold', light: 'goldLight' },
  p2: { outline: 'ink', shadow: 'skyDark', base: 'sky', light: 'skyLight' },
  /** 잔상 (대시·돌진할 때 뒤에 남는 그림자) */
  ghost1: { outline: 'goldDark', shadow: 'goldDark', base: 'goldDark', light: 'goldDark' },
  ghost2: { outline: 'skyDark', shadow: 'skyDark', base: 'skyDark', light: 'skyDark' },
  /** 맞은 순간 하얗게 번쩍임 */
  flash: { outline: 'ink', shadow: 'white', base: 'white', light: 'white' },
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

/**
 * 뼈대 하나를 색 번호 그림에 그린다. (ox, oy)는 발밑 기준점 위치, 오른쪽을 보는 모습.
 * 그리는 순서: 뒷다리, 뒷팔, 몸통·머리, 앞다리, 앞팔. 검은 외곽선은 다 그린 뒤 전체 모양의 바깥 둘레에만 두른다.
 */
export function drawSkeleton(img: Indexed, j: Joints, ox: number, oy: number): void {
  const P = (q: Point): Point => [ox + q[0], oy + q[1]];
  const group = (draw: (m: Mask) => void, shade: Shade) => {
    const m = new Mask(img.w, img.h);
    draw(m);
    paint(img, m, shade);
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
  group((m) => {
    seg(m, j.sh, j.eF, LIMB_W);
    seg(m, j.eF, j.hF, LIMB_W);
    seg(m, j.hF, j.hF, FIST_W);
  }, FRONT);
  outlineSilhouette(img, SLOT.outline);
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
