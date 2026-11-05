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
  /** 무기 쇠붙이 (칼날·해머 머리): 어둠, 바탕, 밝음 */
  metalShadow: 15, metal: 16, metalLight: 17,
  /** 피부 (얼굴·손, 장식이 skin을 켠 캐릭터만): 어둠, 바탕, 밝음 */
  skinShadow: 18, skin: 19, skinLight: 20,
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
  /** 무기 쇠붙이 [어둠, 바탕, 밝음] (없으면 몸 색) */
  metal?: readonly [ColorName, ColorName, ColorName];
  /** 피부 [어둠, 바탕, 밝음] (없으면 몸 색. 장식의 skin이 켠 곳만 칠한다) */
  skin?: readonly [ColorName, ColorName, ColorName];
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
  /**
   * 강타에 맞은 순간 1~3틱: 주색 실루엣 + 밝은 테두리 (동작연출지침서 14-8 ⑧ '카운터 느낌').
   * 밝은 빛기둥 앞에서 읽히게 어두운 실루엣 (레퍼런스 3처럼): 검붉은 몸·아주 어두운 그늘·진한 주색 빛 받는 쪽·흰 테두리. 지금은 라이덴 강타만 쓴다
   */
  struck: { outline: 'raidenFxCore', shadow: 'ink', base: 'raidenFxDark', light: 'raidenFxScarlet' },
  /** 백은우 강타에 맞은 순간: 짙은 하늘 몸·잉크 그늘·옅은 하늘 빛 받는 쪽·흰 테두리 (밝은 은빛 리본 앞에서 읽히게) */
  struckEw: { outline: 'eunwooFxCore', shadow: 'eunwooFxInk', base: 'eunwooFxDeep', light: 'eunwooFxSky' },
  /** 에드워드 강타에 맞은 순간: 짙은 청동 몸·잉크 그늘·밝은 청동 빛 받는 쪽·흰 테두리 (밝은 청동 원호 앞에서 읽히게) */
  struckEd: { outline: 'edwardFxCore', shadow: 'edwardFxInk', base: 'edwardFxDeep', light: 'edwardFxBronze' },
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
/** 피부 (얼굴·앞손), 뒷손은 한 단계 어둡게 */
const SKIN_FRONT: Shade = { base: SLOT.skin, light: SLOT.skinLight, inner: 0 };
const SKIN_BACK: Shade = { base: SLOT.skinShadow, light: SLOT.skin, inner: 0 };
/** 뒤쪽 팔다리: 전체를 한 단계 어둡게 */
const BACK: Shade = { base: SLOT.shadow, light: SLOT.base, inner: INNER_LINE };

/**
 * 장식을 칠할 색 갈래: 머리카락·머리카락 아랫단·옷·뒤쪽 옷(한 단계 어둡게)·작은 장식·밝은 천·빛나는 곳·몸 색·뒤쪽 몸 색(한 단계 어둡게, 코트 뒷자락)
 * ·쇠붙이·어두운 쇠붙이(손잡이·칼집 그늘)·가는 칼날(몸 위를 지나면 둘레에 외곽선 색)
 */
export type DecorPart = 'hair' | 'hairBack' | 'cloth' | 'clothBack' | 'accent' | 'trim' | 'glow' | 'body' | 'bodyBack' | 'metal' | 'metalBack' | 'blade';
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
  bodyBack: BACK,
  metal: { base: SLOT.metal, light: SLOT.metalLight, inner: 0 },
  metalBack: { base: SLOT.metalShadow, light: SLOT.metal, inner: 0 },
  /** 가는 칼날 (쇠붙이 바탕 한 색): 몸·옷 위를 지나는 곳은 둘레 1px을 외곽선 색으로 그어 흰 옷 위에서도 갈라져 보인다 (백은우 연검) */
  blade: { base: SLOT.metal, light: SLOT.metal, inner: SLOT.outline },
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
 * behind: 뒷다리보다 먼저 (몸 뒤로 늘어지는 자락) / backLeg: 뒷다리 바로 뒤·뒷팔 앞 (뒷다리 바지) /
 * body: 앞다리 뒤·앞팔 앞 (앞다리 바지·옷·넥타이) / head: 머리 위 (머리카락) / top: 맨 위
 */
export interface Decor {
  /**
   * 피부색으로 칠할 곳 (얼굴 = 목·머리, 손 = 두 주먹). 없으면 몸 색 그대로 (라이덴·기본 스틱맨).
   * 옷(몸 색)과 피부를 나눠 팔다리가 읽히게 한다 (사용자 피드백 2026-11-02 '피부는 손·얼굴만')
   */
  skin?: { face?: boolean; hands?: boolean };
  /**
   * 구멍 남기기 (px 수): 그림 안에 갇힌 빈 칸 덩어리가 이보다 크면 메우지 않고 안쪽 둘레에 외곽선만 두른다.
   * 없으면 모든 구멍을 옆 색으로 메운다. 휘는 리본(백은우 연검)이 몸·다리와 고리를 만들 때 속이 차 보이지 않게
   */
  keepHoles?: number;
  /** 캐릭터 체격: 팔다리·몸통 굵기, 머리 반지름 (없으면 4·5·5. 에드워드는 한 단계 굵게) */
  limbW?: number;
  torsoW?: number;
  headR?: number;
  behind?(pen: DecorPen, j: Joints): void;
  backLeg?(pen: DecorPen, j: Joints): void;
  body?(pen: DecorPen, j: Joints): void;
  head?(pen: DecorPen, j: Joints): void;
  top?(pen: DecorPen, j: Joints): void;
  /**
   * 스미어 프레임의 잔상 (동작 데이터 smear.ghosts): 앞 프레임 관절(prev)에서 지금 관절까지 무기 끝 같은 것을 n개 잔상으로 그린다.
   * 몸보다 먼저 (맨 뒤). 에드워드 해머 머리 잔상 3개 (2026-11-02 피드백 12-1)
   */
  ghost?(pen: DecorPen, j: Joints, prev: Joints, n: number): void;
}

/**
 * 뼈대 하나를 색 번호 그림에 그린다. (ox, oy)는 발밑 기준점 위치, 오른쪽을 보는 모습.
 * 그리는 순서: (장식 behind) 뒷다리, 뒷팔, 몸통·머리, 앞다리, (장식 body·head) 앞팔, (장식 top).
 * 검은 외곽선은 다 그린 뒤 전체 모양의 바깥 둘레에만 두른다.
 * clip: 장식이 이 칸(x0~x1) 밖으로 나가 옆 프레임에 번지지 않게 자른다.
 */
export function drawSkeleton(
  img: Indexed, j: Joints, ox: number, oy: number, decor?: Decor, clip?: readonly [number, number], ghost?: { prev: Joints; n: number },
): void {
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
  const toe = toeOf;
  const leg = (m: Mask, knee: Point, foot: Point) => {
    const w = decor?.limbW ?? LIMB_W;
    seg(m, j.hip, knee, w);
    seg(m, knee, foot, w);
    seg(m, foot, toe(knee, foot), w);
  };

  const LW = decor?.limbW ?? LIMB_W;
  const TW = decor?.torsoW ?? TORSO_W;
  const HR = decor?.headR ?? HEAD_R;
  if (ghost) decor?.ghost?.(pen, j, ghost.prev, ghost.n);
  decor?.behind?.(pen, j);
  group((m) => leg(m, j.kB, j.fB), BACK);
  decor?.backLeg?.(pen, j);
  group((m) => {
    seg(m, j.shB, j.eB, LW);
    seg(m, j.eB, j.hB, LW);
  }, BACK);
  if (decor?.skin?.hands) group((m) => seg(m, j.hB, j.hB, LW), SKIN_BACK);
  group((m) => {
    seg(m, j.hip, j.neck, TW);
    seg(m, j.neck, j.head, LW);
    stampDisc(m, ...P(j.head), HR);
    // 어깨 비틀기: 뒷어깨에서 앞어깨까지 어깨선 (비틀지 않으면 한 점이라 그대로)
    if (j.shF[0] !== j.shB[0] || j.shF[1] !== j.shB[1]) seg(m, j.shB, j.shF, LW);
  }, FRONT);
  if (decor?.skin?.face) {
    group((m) => {
      seg(m, j.neck, j.head, LW - 1);
      stampDisc(m, ...P(j.head), HR);
    }, SKIN_FRONT);
  }
  group((m) => leg(m, j.kF, j.fF), FRONT);
  decor?.body?.(pen, j);
  decor?.head?.(pen, j);
  group((m) => {
    seg(m, j.shF, j.eF, LW);
    seg(m, j.eF, j.hF, LW);
    seg(m, j.hF, j.hF, FIST_W + (LW - LIMB_W));
  }, FRONT);
  if (decor?.skin?.hands) group((m) => seg(m, j.hF, j.hF, FIST_W + (LW - LIMB_W)), SKIN_FRONT);
  decor?.top?.(pen, j);
  outlineSilhouette(img, SLOT.outline, decor?.keepHoles ?? 0);
}

/** 발끝: 정강이 방향에 수직으로 앞쪽. 발목보다 아래로는 내리지 않는다 (바닥을 뚫지 않게). 장식(바지·신발)도 같은 자리를 쓴다 */
export function toeOf(knee: Point, foot: Point): Point {
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

/** 색 번호 → [r, g, b] (이 색 묶음으로). 캔버스 없이도 쓴다 (확인 도구) */
export function lookTable(look: Look): number[][] {
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
  const skin = look.skin ?? [look.shadow, look.base, look.light];
  table[SLOT.skinShadow] = rgb(skin[0]);
  table[SLOT.skin] = rgb(skin[1]);
  table[SLOT.skinLight] = rgb(skin[2]);
  const metal = look.metal ?? [look.shadow, look.base, look.light];
  table[SLOT.metalShadow] = rgb(metal[0]);
  table[SLOT.metal] = rgb(metal[1]);
  table[SLOT.metalLight] = rgb(metal[2]);
  return table;
}

/** 색 번호 그림 → 캔버스 픽셀 */
export function toImageData(img: Indexed, look: Look): ImageData {
  const table = lookTable(look);
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
