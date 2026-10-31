import type { CityState, PropState } from '../../sim';
import { BREAKABLES, chunkIndex, GLASS_BOTTOM, GRIDS, GROUND, type Breakable, type NeonColor } from '../../stage/citadel';
import { CITADEL as D } from '../../data/stages/citadel';
import { drawText, glyphRows } from '../font';
import { lights } from '../light';
import { COLORS as C } from '../palette';
import { SCREEN_W } from '../screen';
import { canvas, dither, ditherRect, discFast, hash, line, rect, sprite, stamp } from './dither';
import type { Cam } from './index';

/**
 * 부서지는 물건 그리기 (렌더 전용, 월드 좌표로 그린다). 상태(멀쩡·망가짐·파괴, 언제 부서졌는지)는 sim이 정하고,
 * 여기서는 그 상태와 지난 틱으로 모습과 연출(불길, 연기, 물기둥, 깜빡임)만 정한다.
 * 빛을 내는 물건(가로등, 네온 간판, 불붙은 차)은 빛 레이어에 빛을 등록한다. 부서지면 빛도 꺼진다.
 * 잔해·그을린 자국·유리 조각은 부서진 상태가 남아 있는 동안(라운드 끝까지) 계속 그린다.
 */
const G = GROUND;
/** 가로등 머리 높이 (바닥에서) */
export const LAMP_TOP = G - 92;

/** 물건마다 정해진 무늬 (잔해 모양이 늘 같게) */
const rnd = (i: number, k: number) => hash(i * 7919 + k * 104729);

/** 뒤에서 앞으로: 건물에 붙은 유리·네온 → 보도 소품 → 가로등 → 길가에 선 자동차 */
const DRAW_ORDER = ['glass', 'neon', 'newsstand', 'hydrant', 'lamp', 'car'] as const;
const ORDERED = DRAW_ORDER.flatMap((kind) => BREAKABLES.map((b, i) => [b, i] as const).filter(([b]) => b.kind === kind));
const ON_WALL: ReadonlySet<string> = new Set(['glass', 'neon']);

const INTACT: PropState = { hp: 1, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1 };

/** 이 물건을 받치던 건물 덩어리가 무너져 사라졌는가 (그러면 같이 떨어져 그리지 않는다) */
function wallGone(b: Breakable, city: CityState | null): boolean {
  if (!city || b.b < 0) return false;
  return city.hp[chunkIndex(GRIDS[b.b], b.col, b.row)] < 0;
}

/** part: 'wall'은 건물에 붙은 쇼윈도·네온 (전차보다 뒤), 'street'는 보도 위 물건만, 없으면 전부 */
export function drawProps(
  ctx: CanvasRenderingContext2D, cam: Cam, tick: number, props: readonly PropState[] | null, city: CityState | null = null,
  part: 'wall' | 'street' | null = null,
): void {
  ORDERED.forEach(([b, i]) => {
    if (part && ON_WALL.has(b.kind) !== (part === 'wall')) return;
    if (b.x + b.w < cam.x - 80 || b.x > cam.x + SCREEN_W + 80) return;
    if (wallGone(b, city)) return;
    const p = props?.[i] ?? INTACT;
    const since = p.brokenAt >= 0 ? tick - p.brokenAt : 0;
    const sinceDamaged = p.damagedAt >= 0 ? tick - p.damagedAt : 0;
    const x = Math.round(b.x);
    switch (b.kind) {
      case 'car':
        car(ctx, x, b, p, i, tick, since, sinceDamaged);
        break;
      case 'lamp':
        lamp(ctx, x, b, p, i, tick, since);
        break;
      case 'glass':
        glass(ctx, x, b, p, i);
        break;
      case 'neon':
        neon(ctx, b, p, i, tick, since);
        break;
      case 'newsstand':
        newsstand(ctx, x, p, i);
        break;
      case 'hydrant':
        hydrant(ctx, x, p, i, tick, since);
        break;
    }
  });
}

// ---------------------------------------------------------------- 1960년대 세단 (84×28): 긴 차체, 꼬리 날개, 크롬, 두 가지 색
const PAINTS = [C.carMint, C.carCoral, C.paintTeal, C.posterRed];

function car(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number, tick: number, since: number, sinceDamaged: number) {
  const w = b.w;
  if (p.stage === 2) {
    sprite(g, `car:${i}:2`, x - 14, G - 22, w + 40, 32, (sg) => carWreck(sg, x, w));
    const fire = Math.max(0, 1 - since / 420);
    if (fire > 0) flames(g, x + 12, G - 16, w - 26, Math.round(6 + 14 * fire), tick, i);
    smoke(g, x + w / 2, G - 20, tick, i, fire > 0 ? 5 : 3);
    return;
  }
  sprite(g, `car:${i}:${p.stage}`, x - 3, G - 27, w + 6, 28, (sg) => carBody(sg, x, w, i, p.stage === 1));
  if (p.stage === 0) lights.point(x + 3, G - 13, 14, C.neonRed, 0.45);
  else {
    flames(g, x + w - 28, G - 16, 20, 8 + Math.min(6, sinceDamaged >> 5), tick, i);
    smoke(g, x + w - 18, G - 24, tick, i, 4);
  }
}

/** 타 버린 차체: 납작하게 주저앉고 바퀴 하나가 빠졌다, 길에 그을린 자국 */
function carWreck(g: CanvasRenderingContext2D, x: number, w: number) {
  ditherRect(g, x - 14, G + 1, w + 28, 8, C.fxSoot, 9);
  ditherRect(g, x - 4, G + 1, w + 8, 5, C.fxSoot, 14);
  rect(g, x + 2, G - 13, w - 4, 9, C.iron);
  rect(g, x + 24, G - 19, 30, 6, C.iron);
  line(g, x + 2, G - 13, x + 8, G - 17, C.iron);
  rect(g, x + 4, G - 13, w - 8, 1, C.ironLight);
  ditherRect(g, x + 6, G - 11, w - 14, 6, C.rust, 6);
  wheel(g, x + 16, G - 5, true);
  rect(g, x + w - 22, G - 3, 12, 3, C.iron);
  rect(g, x + w + 6, G - 5, 8, 5, C.iron); // 굴러간 바퀴
}

/** 1960년대 세단 몸체 (멀쩡하거나 찌그러진 모습) */
function carBody(g: CanvasRenderingContext2D, x: number, w: number, i: number, dent: boolean) {
  const paint = PAINTS[i % PAINTS.length];
  // 차체: 낮고 긴 몸통, 뒤쪽(왼쪽) 꼬리 날개, 앞쪽(오른쪽) 낮은 보닛
  rect(g, x + 2, G - 16, w - 4, 9, paint);
  rect(g, x + 2, G - 16, w - 4, 1, C.carCream);
  for (let k = 0; k < 10; k++) rect(g, x + 2 + k, G - 16 - Math.max(0, 4 - Math.floor(k / 2)), 1, Math.max(0, 4 - Math.floor(k / 2)), paint);
  rect(g, x + 2, G - 21, 3, 1, C.chrome);
  // 크롬 띠, 범퍼, 앞의 네 눈 전조등, 뒤 꼬리등
  rect(g, x + 6, G - 12, w - 12, 1, C.chrome);
  rect(g, x - 1, G - 9, 4, 3, C.chrome);
  rect(g, x + w - 3, G - 9, 4, 3, C.chrome);
  rect(g, x + w - 4, G - 14, 2, 2, dent ? C.iron : C.lampCore);
  rect(g, x + w - 4, G - 11, 2, 1, dent ? C.iron : C.lampCore);
  rect(g, x + 2, G - 15, 2, 3, C.neonRed);
  // 객실: 크림색 낮은 지붕, 둘러싼 앞유리, 옆 창
  const roof = dent ? G - 22 : G - 25;
  rect(g, x + 26, roof, 30, 2, C.carCream);
  line(g, x + 56, roof, x + 63, G - 16, C.carCream);
  line(g, x + 26, roof, x + 18, G - 16, C.carCream);
  for (let y = roof + 2; y < G - 16; y++) {
    const t = (y - roof) / (G - 16 - roof);
    const l = Math.round(x + 26 - 8 * t) + 1;
    const r = Math.round(x + 56 + 7 * t) - 1;
    rect(g, l, y, r - l, 1, C.windowDark);
  }
  rect(g, x + 40, roof + 2, 2, G - 16 - roof - 2, C.carCream);
  if (dent) {
    line(g, x + 44, roof + 2, x + 54, G - 17, C.skyDark);
    line(g, x + 50, roof + 2, x + 46, G - 17, C.skyDark);
    for (let k = 0; k < 7; k++) rect(g, x + w - 26 + k * 3, G - 16 + (k % 2), 3, 2, C.iron);
  }
  wheel(g, x + 16, G - 5, false);
  wheel(g, x + w - 18, G - 5, false);
}

function wheel(g: CanvasRenderingContext2D, cx: number, cy: number, burnt: boolean) {
  const r = 5;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    rect(g, cx - half, cy + y, half * 2 + 1, 1, C.iron);
  }
  if (!burnt) {
    for (let a = 0; a < 12; a++) rect(g, Math.round(cx + Math.cos((a / 12) * Math.PI * 2) * 3), Math.round(cy + Math.sin((a / 12) * Math.PI * 2) * 3), 1, 1, C.carCream);
    rect(g, cx - 1, cy - 1, 3, 3, C.chrome);
  }
}

/** 깜빡이는 불길: 아래는 붉고 위로 갈수록 노랗게. 둘레를 주황빛으로 물들인다 */
function flames(g: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, tick: number, seed: number) {
  lights.point(x + w / 2, base - h / 2, 40 + h * 3, C.fxOrange, 0.55 + 0.25 * hash((tick >> 2) * 7 + seed));
  for (let fx = 0; fx < w; fx++) {
    const n = hash((tick >> 2) * 131 + fx * 17 + seed * 7);
    const fh = Math.round(h * (0.4 + 0.6 * n) * Math.sin((Math.PI * (fx + 0.5)) / w));
    for (let y = 0; y < fh; y++) {
      const k = y / Math.max(1, fh);
      const c = k < 0.35 ? C.fxRed : k < 0.65 ? C.fxFlame : k < 0.85 ? C.fxOrange : C.fxYellow;
      if (k > 0.8 && !dither(x + fx, base - y + (tick >> 1), 9)) continue;
      g.fillStyle = c;
      g.fillRect(x + fx, base - y, 1, 1);
    }
  }
}

/** 피어오르는 연기 (디더링 덩어리) */
function smoke(g: CanvasRenderingContext2D, x: number, y: number, tick: number, seed: number, puffs: number) {
  for (let k = 0; k < puffs; k++) {
    const life = 110;
    const age = (tick + k * (life / puffs) + seed * 13) % life;
    const u = age / life;
    const px = x + Math.sin((age + seed * 9) * 0.07) * 4 + u * 10;
    const py = y - age * 0.5;
    const r = Math.round(3 + u * 8);
    const level = Math.max(2, Math.round(10 * (1 - u)));
    discFast(g, px, py, r, u < 0.5 ? C.smoke : C.smokeDark, level);
  }
}

// ---------------------------------------------------------------- 1960년대 가로등 (높이 92): 강철 기둥, 굽은 팔, 코브라 헤드, 나트륨 주황빛
function lamp(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number, tick: number, since: number) {
  const cx = x + Math.floor(b.w / 2);
  const side = i % 2 ? -1 : 1;
  if (p.stage === 2) {
    // 쓰러진 기둥: 밑동에서 맞은 방향으로 보도 위에 눕고, 잠깐 불꽃이 튄다
    const d = p.dir || 1;
    sprite(g, `lamp:${i}:2:${d}`, cx - 100, G - 8, 200, 16, (sg) => lampFallen(sg, cx, d, i));
    if (since < 150 && hash((tick >> 1) * 3 + i) < 0.35) {
      for (let k = 0; k < 6; k++) {
        const a = hash(tick * 5 + k + i) * Math.PI - Math.PI;
        const r = 3 + hash(tick * 7 + k) * 8;
        rect(g, Math.round(cx + d * 3 + Math.cos(a) * r), Math.round(G - 6 + Math.sin(a) * r), 1, 1, k % 2 ? C.fxYellow : C.skyLight);
      }
      lights.point(cx + d * 3, G - 6, 30, C.skyLight, 0.6);
    }
    return;
  }
  const bend = p.stage === 1 ? (p.dir || 1) * 6 : 0;
  const flicker = p.stage === 1 ? hash((tick >> 2) * 31 + i * 7) < 0.45 : hash((tick >> 3) * 31 + i * 7) < 0.03;
  sprite(g, `lamp:${i}:${p.stage}:${bend}:${flicker ? 1 : 0}`, cx - 32, G - 94, 64, 94, (sg) => lampBody(sg, cx, side, bend, flicker, p.stage === 1));
  if (!flicker) {
    // 빛: 머리 둘레, 아래로 쏟아지는 빛줄기, 보도의 빛 웅덩이
    const lensX = Math.min(cx + bend + side * 14, cx + bend + side * 23);
    const hy = G - 88;
    lights.point(lensX + 5, hy + 4, 56, C.sodium, 0.85);
    lights.cone(lensX + 5, hy + 5, Math.PI / 2, 112, 0.42, C.sodium, 0.32);
    lights.point(lensX + 5, G - 2, 46, C.sodium, 0.32);
  }
}

function lampFallen(g: CanvasRenderingContext2D, cx: number, d: number, i: number) {
  rect(g, cx - 4, G - 4, 9, 4, C.iron);
  const ex = cx + d * 80;
  line(g, cx, G - 6, ex, G - 3, C.ironLight);
  line(g, cx, G - 5, ex, G - 2, C.iron);
  rect(g, Math.min(ex, ex + d * 12), G - 6, 12, 4, C.chromeDark);
  for (let k = 0; k < 8; k++) {
    const gx = ex + d * (4 + Math.floor(rnd(i, k) * 16));
    rect(g, gx, G + 1 + Math.floor(rnd(i, k + 9) * 6), 1, 1, k % 2 ? C.sodium : C.paintCream);
  }
}

/** 강철 기둥, 굽은 팔, 코브라 헤드 (렌즈가 켜졌는지) */
function lampBody(g: CanvasRenderingContext2D, cx: number, side: number, bend: number, off: boolean, cracked: boolean) {
  rect(g, cx - 4, G - 4, 9, 4, C.iron);
  rect(g, cx - 2, G - 50, 4, 46, C.iron);
  rect(g, cx + 1, G - 50, 1, 46, C.ironLight);
  line(g, cx - 1, G - 50, cx - 1 + bend, G - 84, C.iron);
  line(g, cx, G - 50, cx + bend, G - 84, C.iron);
  line(g, cx + 1, G - 50, cx + 1 + bend, G - 84, C.ironLight);
  const tx = cx + bend;
  const hx = tx + side * 18;
  const hy = G - 88;
  for (let k = 0; k <= 18; k++) rect(g, tx + side * k, G - 84 - Math.round(Math.sin((k / 18) * Math.PI * 0.5) * 4), 1, 2, C.iron);
  const headX = Math.min(hx - 6 * side, hx + 7 * side);
  rect(g, headX, hy - 1, 14, 4, C.chromeDark);
  rect(g, headX, hy - 1, 14, 1, C.chrome);
  const lensX = Math.min(hx - 4 * side, hx + 5 * side);
  rect(g, lensX, hy + 3, 10, 2, off ? C.iron : C.sodium);
  if (!off) rect(g, lensX + 3, hy + 3, 4, 1, C.lampCore);
  if (cracked) line(g, lensX, hy + 3, lensX + 9, hy + 4, C.iron);
}

// ---------------------------------------------------------------- 네온 간판·전광판 (부서지면 빛도 꺼진다)
const NEON: Record<NeonColor, [string, string]> = {
  pink: [C.neonPink, C.neonPinkDark],
  cyan: [C.neonCyan, C.neonCyanDark],
  amber: [C.neonAmber, C.neonAmberDark],
  green: [C.neonGreen, C.neonGreenDark],
  red: [C.neonRed, C.neonRedDark],
};

/** 글씨를 3×5 도트로 하나씩 찍는다. lit(글자 번호)가 false인 글자는 어두운 관으로 */
function tubeText(g: CanvasRenderingContext2D, text: string, x: number, y: number, s: number, bright: string, dark: string, lit: (k: number) => boolean, vertical = false, step = 0) {
  [...text].forEach((ch, k) => {
    const rows = glyphRows(ch);
    const ox = vertical ? x : x + k * 4 * s;
    const oy = vertical ? y + k * step : y;
    const col = lit(k) ? bright : dark;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rows[r] & (4 >> c)) rect(g, ox + c * s, oy + r * s, s, s, col);
  });
}

function neon(g: CanvasRenderingContext2D, b: Breakable, p: PropState, i: number, tick: number, since: number) {
  const [bright] = NEON[b.color ?? 'pink'];
  const x = Math.round(b.x);
  const top = G - b.bottom - b.h;
  const broken = p.stage === 2;
  // 망가지면 글자마다 제멋대로 깜빡인다 (켜진 글자 묶음과 전구 차례가 같으면 그려 둔 조각을 다시 쓴다)
  const text = b.text ?? '';
  let mask = 0;
  for (let k = 0; k < Math.min(text.length, 30); k++) {
    const on = !broken && (p.stage === 0 ? hash((tick >> 4) * 13 + i * 31 + k) > 0.004 : hash((tick >> 2) * 17 + i * 7 + k * 3) > 0.4);
    if (on) mask |= 1 << k;
  }
  const anyLit = !broken && (p.stage === 0 || hash((tick >> 2) * 17 + i * 7) > 0.35);
  const phase = (tick >> 3) % 3;
  if (b.style === 'billboard') billboard(g, b, x, top, tick, broken, anyLit, i);
  else {
    const pad = b.style === 'board' ? b.bottom : 2;
    sprite(g, `neon:${i}:${p.stage}:${mask}:${anyLit ? phase : 9}`, x - 2, top - 2, b.w + 4, b.h + pad + 4, (sg) => neonBody(sg, b, x, top, (k) => (mask & (1 << k)) !== 0, anyLit, phase));
    if (anyLit) neonLights(b, x, top);
  }
  if (broken) {
    // 꺼진 관: 깨진 조각과 늘어진 전선, 부서진 직후 불꽃
    for (let k = 0; k < 5; k++) rect(g, x + Math.floor(rnd(i, k) * b.w), top + Math.floor(rnd(i, k + 5) * b.h), 2, 1, C.iron);
    line(g, x + b.w - 4, top + b.h, x + b.w - 8 + Math.round(Math.sin(tick * 0.05) * 2), top + b.h + 14, C.iron);
    if (since < 120 && hash((tick >> 1) * 5 + i) < 0.4) {
      for (let k = 0; k < 7; k++) {
        const a = hash(tick * 3 + k + i) * Math.PI * 2;
        const r = 2 + hash(tick * 9 + k) * 9;
        rect(g, Math.round(x + b.w / 2 + Math.cos(a) * r), Math.round(top + b.h / 2 + Math.sin(a) * r), 1, 1, k % 2 ? C.fxYellow : bright);
      }
      lights.point(x + b.w / 2, top + b.h / 2, 34, bright, 0.7);
    }
  }
}

/** 네온 간판이 내는 빛 (켜져 있을 때) */
function neonLights(b: Breakable, x: number, top: number) {
  const [bright] = NEON[b.color ?? 'pink'];
  switch (b.style) {
    case 'shop':
      lights.point(x + b.w / 2, top + b.h / 2, 26 + b.w * 0.6, bright, 0.75);
      break;
    case 'blade': {
      const [inner] = b.color === 'pink' ? NEON.amber : NEON.pink;
      for (let k = 0; k < 3; k++) lights.point(x + b.w / 2, top + (b.h * (k + 0.5)) / 3, 30 + b.w, k % 2 ? inner : bright, 0.6);
      break;
    }
    case 'marquee':
      lights.point(x + b.w * 0.25, top + 11, 60, bright, 0.8);
      lights.point(x + b.w * 0.75, top + 11, 60, bright, 0.8);
      lights.cone(x + b.w / 2, top + 22, Math.PI / 2, 80, 0.9, bright, 0.28);
      break;
    case 'board':
      lights.point(x + b.w / 2, top + b.h / 2, 46 + b.w * 0.5, bright, 0.8);
      lights.point(x + b.w / 2, top + b.h / 2, 30, C.neonPink, 0.6);
      break;
  }
}

/** 네온 간판 몸체 (켜진 글자, 전구 차례 phase) */
function neonBody(g: CanvasRenderingContext2D, b: Breakable, x: number, top: number, lit: (k: number) => boolean, anyLit: boolean, phase: number) {
  const [bright, dark] = NEON[b.color ?? 'pink'];
  const text = b.text ?? '';
  switch (b.style) {
    case 'shop': {
      rect(g, x, top, b.w, b.h, C.iron);
      rect(g, x + 1, top + 1, b.w - 2, b.h - 2, C.smog0);
      tubeText(g, text, x + 5, top + 2, 2, bright, dark, lit);
      break;
    }
    case 'blade': {
      rect(g, x, top, b.w, b.h, C.iron);
      rect(g, x + 2, top + 2, b.w - 4, b.h - 4, C.smog0);
      const edge = anyLit ? bright : dark;
      rect(g, x + 1, top + 1, b.w - 2, 1, edge);
      rect(g, x + 1, top + b.h - 2, b.w - 2, 1, edge);
      rect(g, x + 1, top + 1, 1, b.h - 2, edge);
      rect(g, x + b.w - 2, top + 1, 1, b.h - 2, edge);
      const s = b.w >= 20 ? 3 : 2;
      const step = Math.min(6 * s, Math.floor((b.h - 10) / Math.max(1, text.length)));
      const [inner, innerDark] = b.color === 'pink' ? NEON.amber : NEON.pink;
      tubeText(g, text, x + Math.floor((b.w - 3 * s) / 2), top + 6, s, inner, innerDark, lit, true, step);
      if (anyLit) for (let y = top + 3; y < top + b.h - 3; y += 5) if ((Math.floor(y / 5) + phase) % 3 === 0) rect(g, x + 1, y, 1, 1, C.lampCore);
      break;
    }
    case 'marquee': {
      // 극장 전구 차양: 위아래 줄 전구가 차례로 돌고, 판에 글씨
      const on = (k: number) => anyLit && (k + phase) % 3 !== 0;
      for (let bx = x + 2, k = 0; bx < x + b.w - 1; bx += 4, k++) {
        rect(g, bx, top + 1, 2, 2, on(k) ? C.lampCore : C.neonAmberDark);
        rect(g, bx, top + 19, 2, 2, on(k + 1) ? C.lampCore : C.neonAmberDark);
      }
      const tw = (text.length * 4 - 1) * 2;
      tubeText(g, text, x + Math.round((b.w - tw) / 2), top + 6, 2, C.neonRed, C.neonRedDark, lit);
      break;
    }
    case 'board': {
      // 다이너 간판: 전구 테두리 판에 큰 네온 글씨, 차양 위 받침 두 개
      rect(g, x + 6, top + b.h, 2, b.bottom - D.ledges.awning, C.iron);
      rect(g, x + b.w - 8, top + b.h, 2, b.bottom - D.ledges.awning, C.iron);
      rect(g, x, top, b.w, b.h, C.iron);
      rect(g, x + 2, top + 2, b.w - 4, b.h - 4, C.smog0);
      const edge = anyLit ? bright : dark;
      rect(g, x + 2, top + 2, b.w - 4, 1, edge);
      rect(g, x + 2, top + b.h - 3, b.w - 4, 1, edge);
      tubeText(g, text, x + 10, top + 8, 3, C.neonPink, C.neonPinkDark, lit);
      break;
    }
  }
}

let boardBits: boolean[][] | null = null;

/** 전광판 글씨를 전구 한 칸씩의 점 그림으로 (5줄 × 글자마다 4칸) */
function boardText(text: string): boolean[][] {
  if (boardBits) return boardBits;
  const rows: boolean[][] = [[], [], [], [], []];
  for (const ch of text) {
    const glyph = glyphRows(ch);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) rows[r].push((glyph[r] & (4 >> c)) !== 0);
      rows[r].push(false);
    }
  }
  boardBits = rows;
  return rows;
}

/** 옥상 전광판: 쇠다리 위 판에 전구 글씨가 흘러가고 테두리 전구가 차례로 깜빡인다 */
function billboard(g: CanvasRenderingContext2D, b: Breakable, x: number, y: number, tick: number, broken: boolean, on: boolean, i: number) {
  const roof = G - b.bottom + 12;
  const cols = Math.floor((b.w - 6) / 3);
  const ty = y + Math.floor((b.h - 15) / 2);
  const phase = Math.floor(tick / 6) % 3;
  // 다리·판·테두리 전구는 켜짐과 전구 차례마다 한 번 그려 둔다
  sprite(g, `board:${i}:${broken ? 2 : on ? 1 : 0}:${on ? phase : 9}`, x - 2, y - 2, b.w + 20, roof - y + 3, (sg) => {
    for (const lx of [x + 10, x + b.w - 14]) {
      rect(sg, lx, y + b.h, 4, roof - y - b.h, C.iron);
      line(sg, lx, roof, lx + 14, y + b.h, C.iron);
    }
    rect(sg, x - 2, y - 2, b.w + 4, b.h + 4, C.iron);
    rect(sg, x, y, b.w, b.h, C.smog0);
    for (let bx = x + 1; bx < x + b.w - 1; bx += 3) {
      const lit = on && (Math.floor(bx / 3) + phase) % 3 === 0;
      rect(sg, bx, y + 1, 2, 1, lit ? C.lampCore : on ? C.lampWarm : C.awning);
      rect(sg, bx, y + b.h - 2, 2, 1, on && !lit ? C.lampCore : on ? C.lampWarm : C.awning);
    }
  });
  // 흘러가는 글씨: 글 전체를 전구 띠 한 장으로 그려 두고 보이는 만큼 잘라 얹는다 (끝에서 처음으로 이어진다)
  const strip = boardStrip(b.text ?? '', broken ? 2 : on ? 1 : 0, i);
  const len = strip.width / 3;
  const shift = Math.floor(tick / 5) % len;
  const first = Math.min(cols, len - shift);
  g.drawImage(strip, shift * 3, 0, first * 3, 15, x + 3, ty, first * 3, 15);
  if (first < cols) g.drawImage(strip, 0, 0, (cols - first) * 3, 15, x + 3 + first * 3, ty, (cols - first) * 3, 15);
  if (on) {
    lights.point(x + b.w * 0.3, y + b.h / 2, 70, C.neonAmber, 0.7);
    lights.point(x + b.w * 0.7, y + b.h / 2, 70, C.neonAmber, 0.7);
  }
}

const stripCache = new Map<string, HTMLCanvasElement>();

/** 전광판 글씨 띠 (칸마다 3px, 켜진 전구·꺼진 전구·죽은 전구) */
function boardStrip(text: string, state: number, i: number): HTMLCanvasElement {
  const key = `${text}|${state}|${state === 2 ? i : 0}`;
  let c = stripCache.get(key);
  if (c) return c;
  const bits = boardText(text);
  const len = bits[0].length;
  const [cv, sg] = canvas(len * 3, 15);
  for (let col = 0; col < len; col++) {
    for (let r = 0; r < 5; r++) {
      const dead = state === 2 && rnd(i, col * 5 + r) < 0.3;
      rect(sg, col * 3, r * 3, 2, 2, state === 1 && bits[r][col] ? C.lampGlow : dead ? C.iron : C.awning);
    }
  }
  stripCache.set(key, cv);
  c = cv;
  return c;
}

// ---------------------------------------------------------------- 쇼윈도 유리 (높이 40)
function glass(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number) {
  const top = G - GLASS_BOTTOM - b.h;
  // 모습은 단계마다 늘 같다: 한 번 그려 두고 얹는다 (흩어진 유리 조각까지 넉넉히)
  sprite(g, `glass:${i}:${p.stage}`, x - 8, top, b.w + 16, G + 10 - top, (sg) => glassBody(sg, x, b, p.stage, i));
}

function glassBody(g: CanvasRenderingContext2D, x: number, b: Breakable, stage: number, i: number) {
  const h = b.h;
  const w = b.w;
  const top = G - GLASS_BOTTOM - h;
  if (stage === 2) {
    // 산산조각: 어두운 가게 안, 틀에 남은 삐죽한 조각, 보도에 흩어진 유리
    rect(g, x, top, w, h, C.windowDark);
    // 가게 안 진열대 실루엣
    rect(g, x + 4, top + h - 12, w - 8, 2, C.iron);
    rect(g, x + 6, top + h - 20, w - 12, 1, C.iron);
    for (let k = 0; k < w; k += 3) {
      const tooth = 1 + Math.floor(rnd(i, k) * 7);
      rect(g, x + k, top, 2, tooth, C.stone);
      const tb = 1 + Math.floor(rnd(i, k + 50) * 5);
      rect(g, x + k + 1, top + h - tb, 2, tb, C.stone);
      if (rnd(i, k + 70) < 0.3) rect(g, x + k, top, 1, 1, C.skyLight);
    }
    rect(g, x, top, 1, h, C.stone);
    rect(g, x + w - 1, top, 1, h, C.stone);
    for (let k = 0; k < w; k++) {
      if (rnd(i, k + 100) < 0.6) rect(g, x + k + Math.floor((rnd(i, k + 200) - 0.5) * 12), G + 1 + Math.floor(rnd(i, k + 300) * 7), 1, 1, rnd(i, k) < 0.3 ? C.skyLight : C.stone);
    }
    return;
  }
  // 불 켜진 가게 안이 비치는 유리: 진열대 실루엣과 비스듬한 반사광
  rect(g, x, top, w, h, C.windowDark);
  ditherRect(g, x, top + 6, w, h - 6, C.windowLit, 5);
  rect(g, x + 4, top + h - 12, w - 8, 2, C.iron);
  for (let k = 0; k < w - 10; k += 9) rect(g, x + 6 + k, top + h - 18, 5, 6, k % 2 ? C.paintOchre : C.paintTeal);
  for (let k = 0; k < Math.floor(w / 24); k++) line(g, x + 8 + k * 24, top + h - 4, x + 18 + k * 24, top + 4, C.stone);
  if (stage === 1) {
    const cx = x + Math.floor(w * (0.3 + rnd(i, 1) * 0.4));
    const cy = top + Math.floor(h * (0.3 + rnd(i, 2) * 0.4));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rnd(i, k + 3);
      const r = 8 + rnd(i, k + 10) * 18;
      line(g, cx, cy, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), C.white);
    }
    for (const r of [5, 10]) {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        rect(g, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 1, 1, C.skyLight);
      }
    }
  }
}

// ---------------------------------------------------------------- 신문 가판대 (36×46)
function newsstand(g: CanvasRenderingContext2D, x: number, p: PropState, i: number) {
  sprite(g, `news:${i}:${p.stage}`, x - 26, G - 47, 92, 59, (sg) => newsstandBody(sg, x, p.stage, i));
}

function newsstandBody(g: CanvasRenderingContext2D, x: number, stage: number, i: number) {
  if (stage === 2) {
    rect(g, x - 4, G - 8, 44, 8, C.awning);
    line(g, x - 5, G - 6, x + 16, G - 15, C.awningStripe);
    line(g, x + 14, G - 14, x + 40, G - 5, C.iron);
    rect(g, x + 6, G - 12, 10, 3, C.awningStripe);
    for (let k = 0; k < 14; k++) {
      const px = x - 24 + Math.floor(rnd(i, k) * 84);
      const py = G + Math.floor(rnd(i, k + 20) * 8);
      rect(g, px, py, 5, 3, k % 3 ? C.paintCream : C.stone);
      rect(g, px + 1, py + 1, 3, 1, C.stoneDark);
    }
    return;
  }
  const dent = stage === 1;
  rect(g, x, G - 42, 36, 42, C.awning);
  rect(g, x + 33, G - 42, 3, 42, C.awningStripe);
  if (dent) {
    line(g, x - 2, G - 46, x + 38, G - 38, C.iron);
    line(g, x - 2, G - 45, x + 38, G - 37, C.iron);
    line(g, x + 33, G - 34, x + 28, G - 10, C.iron);
  } else {
    rect(g, x - 2, G - 46, 40, 4, C.iron);
  }
  rect(g, x + 3, G - 36, 30, 16, C.windowDark);
  for (let k = 0; k < 6; k++) {
    if (dent && k === 3) continue;
    rect(g, x + 4 + k * 5, G - 34 + (dent && k === 1 ? 3 : 0), 4, 12, k % 2 ? C.paintCream : C.stone);
  }
  rect(g, x + 3, G - 17, 30, 2, C.iron);
  drawText(g, 'NEWS', x + 7, G - 13, C.paintCream, 1);
  if (dent) for (let k = 0; k < 4; k++) rect(g, x + 40 + k * 6, G + 1 + (k % 2) * 2, 5, 3, C.paintCream);
}

// ---------------------------------------------------------------- 소화전 (10×18)
function hydrant(g: CanvasRenderingContext2D, x: number, p: PropState, i: number, tick: number, since: number) {
  if (p.stage === 2) {
    const puddle = Math.min(46, 10 + (since >> 3));
    sprite(g, `hyd:${i}:2:${puddle}`, x - 42, G - 6, 94, 12, (sg) => {
      rect(sg, x, G - 6, 10, 6, C.posterRedDark);
      rect(sg, x + 2, G - 6, 2, 5, C.posterRed);
      ditherRect(sg, x + 5 - puddle, G + 1, puddle * 2, 5, C.skyDark, 8);
      ditherRect(sg, x + 5 - (puddle >> 1), G + 2, puddle, 3, C.skyLight, 3);
    });
    // 물기둥: 처음엔 높이 솟고 차츰 낮아진다 (라운드 끝까지 멈추지 않음). 12틱 주기 무늬를 높이(2px 단위)마다 한 번 그려 둔다
    const height = Math.round(34 + 46 * Math.max(0, 1 - since / 600)) & ~1;
    const ph = tick % 12;
    stamp(g, `spray:${height}:${ph}`, x + 5, G - 6, 16, height + 1, 8, height, (sg) => {
      for (let y = 0; y < height; y++) {
        const spread = Math.round(2 + (y / height) * 3 + Math.sin(((ph + y) * Math.PI) / 6));
        for (let dx = -spread; dx <= spread + 1; dx++) {
          const k = y / height;
          const level = k > 0.8 ? 6 : 12;
          if (!dither(dx, -y + ph, level)) continue;
          sg.fillStyle = Math.abs(dx) <= 1 && k < 0.7 ? C.skyLight : C.sky;
          sg.fillRect(dx, -y, 1, 1);
        }
      }
    });
    for (let k = 0; k < 14; k++) {
      const life = 34;
      const age = (tick + k * 3 + i * 5) % life;
      const side = k % 2 ? 1 : -1;
      const dx = side * (3 + age * (0.3 + rnd(i, k) * 0.4));
      const dy = -height - 3 + (age * age) / 16;
      rect(g, Math.round(x + 5 + dx), Math.round(G - 6 + dy), 1, 1, C.skyLight);
    }
    return;
  }
  sprite(g, `hyd:${i}:${p.stage}`, x - 8, G - 18, 26, 22, (sg) => {
    rect(sg, x + 1, G - 14, 8, 14, C.posterRedDark);
    rect(sg, x - 1, G - 11, 12, 3, C.posterRedDark);
    rect(sg, x + 2, G - 17, 6, 3, C.posterRedDark);
    rect(sg, x + 4, G - 18, 2, 1, C.posterRedDark);
    rect(sg, x + 2, G - 14, 2, 13, C.posterRed);
    rect(sg, x, G - 2, 10, 2, C.iron);
    if (p.stage === 1) {
      line(sg, x + 6, G - 14, x + 4, G - 6, C.iron);
      ditherRect(sg, x - 8, G + 1, 26, 3, C.skyDark, 7);
    }
  });
  if (p.stage === 1) {
    const drip = (tick >> 2) % 8;
    rect(g, x + 9, G - 9 + drip, 1, 1, C.skyLight);
  }
}
