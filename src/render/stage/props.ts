import type { PropState } from '../../sim';
import { BREAKABLES, GLASS_BOTTOM, GROUND, type Breakable } from '../../stage/downtown';
import { drawText } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_W } from '../screen';
import { dither, ditherRect, hash, line, rect } from './dither';
import type { Cam } from './index';

/**
 * 부서지는 물건 그리기 (렌더 전용, 월드 좌표로 그린다). 상태(멀쩡·망가짐·파괴, 언제 부서졌는지)는 sim이 정하고,
 * 여기서는 그 상태와 지난 틱으로 모습과 연출(불길, 연기, 물기둥, 깜빡임)만 정한다.
 * 잔해·그을린 자국·유리 조각은 부서진 상태가 남아 있는 동안(라운드 끝까지) 계속 그린다.
 */
const G = GROUND;
/** 가스등 머리 꼭대기 */
export const LAMP_TOP = G - 92;

/** 물건마다 정해진 무늬 (잔해 모양이 늘 같게) */
const rnd = (i: number, k: number) => hash(i * 7919 + k * 104729);

/** 뒤에서 앞으로: 건물 유리 → 보도 소품 → 가로등 → 길가에 선 자동차 */
const DRAW_ORDER = ['glass', 'newsstand', 'hydrant', 'lamp', 'car'] as const;
const ORDERED = DRAW_ORDER.flatMap((kind) => BREAKABLES.map((b, i) => [b, i] as const).filter(([b]) => b.kind === kind));

const INTACT: PropState = { hp: 1, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1 };

export function drawProps(ctx: CanvasRenderingContext2D, cam: Cam, tick: number, props: readonly PropState[] | null): void {
  ORDERED.forEach(([b, i]) => {
    if (b.x + b.w < cam.x - 60 || b.x > cam.x + SCREEN_W + 60) return;
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
      case 'newsstand':
        newsstand(ctx, x, p, i);
        break;
      case 'hydrant':
        hydrant(ctx, x, p, i, tick, since);
        break;
    }
  });
}

// ---------------------------------------------------------------- 클래식 자동차 (78×34)
function car(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number, tick: number, since: number, sinceDamaged: number) {
  const body = i % 2 ? C.posterRedDark : C.paintTeal;
  const bodyLight = i % 2 ? C.posterRed : C.stone;
  const w = b.w;
  if (p.stage === 2) {
    // 그을린 자국: 길에 검게 번진 얼룩 (라운드 끝까지)
    ditherRect(g, x - 14, G + 1, w + 28, 8, C.fxSoot, 9);
    ditherRect(g, x - 4, G + 1, w + 8, 5, C.fxSoot, 14);
    // 타 버린 차체: 납작하게 주저앉고 바퀴 하나가 빠졌다
    rect(g, x + 3, G - 16, w - 6, 11, C.iron);
    rect(g, x + 16, G - 24, 34, 8, C.iron);
    line(g, x + 16, G - 24, x + 22, G - 29, C.iron);
    line(g, x + 50, G - 24, x + 44, G - 28, C.iron);
    rect(g, x + 6, G - 16, w - 12, 1, C.ironLight);
    ditherRect(g, x + 6, G - 14, w - 16, 7, C.rust, 6);
    wheel(g, x + 15, G - 6, true);
    rect(g, x + w - 20, G - 3, 12, 3, C.iron);
    rect(g, x + w + 6, G - 5, 8, 5, C.iron); // 굴러간 바퀴
    const fire = Math.max(0, 1 - since / 420);
    if (fire > 0) flames(g, x + 12, G - 20, w - 26, Math.round(6 + 14 * fire), tick, i);
    smoke(g, x + w / 2, G - 24, tick, i, fire > 0 ? 5 : 3);
    return;
  }
  const dent = p.stage === 1;
  // 차체 아랫부분과 긴 보닛(오른쪽)
  rect(g, x + 2, G - 20, w - 4, 13, body);
  rect(g, x + 2, G - 20, w - 4, 2, bodyLight);
  rect(g, x + w - 4, G - 19, 4, 10, C.stone); // 라디에이터
  for (let k = 0; k < 4; k++) rect(g, x + w - 3, G - 18 + k * 2, 2, 1, C.iron);
  // 객실: 높은 지붕과 창 셋
  const roof = dent ? G - 30 : G - 34;
  rect(g, x + 14, roof, 36, G - 20 - roof, body);
  rect(g, x + 12, roof, 40, 2, C.iron);
  for (const [wx, ww] of [[17, 9], [28, 10], [40, 8]] as const) rect(g, x + wx, roof + 3, ww, G - 23 - roof, C.windowDark);
  if (dent) {
    line(g, x + 17, roof + 3, x + 26, G - 22, C.skyDark);
    line(g, x + 29, G - 22, x + 37, roof + 3, C.skyDark);
    for (let k = 0; k < 7; k++) rect(g, x + w - 28 + k * 4, G - 20 + (k % 2), 4, 2, C.iron);
  }
  // 흙받이와 발판, 바퀴
  rect(g, x + 6, G - 9, w - 12, 2, C.iron);
  fender(g, x + 15, body);
  fender(g, x + w - 17, body);
  wheel(g, x + 15, G - 6, false);
  wheel(g, x + w - 17, G - 6, false);
  // 범퍼, 전조등, 뒤쪽 예비 타이어
  rect(g, x - 2, G - 10, 3, 3, C.stone);
  rect(g, x + w - 1, G - 10, 3, 3, C.stone);
  rect(g, x + w - 7, G - 24, 4, 4, dent ? C.iron : C.lampCore);
  rect(g, x - 3, G - 22, 4, 10, C.iron);
  if (dent) {
    flames(g, x + w - 30, G - 21, 22, 8 + Math.min(6, sinceDamaged >> 5), tick, i);
    smoke(g, x + w - 18, G - 30, tick, i, 4);
  }
}

function fender(g: CanvasRenderingContext2D, cx: number, color: string) {
  rect(g, cx - 9, G - 13, 19, 3, color);
  rect(g, cx - 7, G - 15, 15, 2, color);
}

function wheel(g: CanvasRenderingContext2D, cx: number, cy: number, burnt: boolean) {
  const r = 6;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    rect(g, cx - half, cy + y, half * 2 + 1, 1, C.iron);
  }
  if (!burnt) {
    rect(g, cx - 2, cy - 2, 5, 5, C.stoneDark);
    rect(g, cx, cy, 1, 1, C.stone);
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) rect(g, cx + dx, cy + dy, 1, 1, C.stoneDark);
  }
}

/** 깜빡이는 불길: 아래는 붉고 위로 갈수록 노랗게 */
function flames(g: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, tick: number, seed: number) {
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
    g.fillStyle = u < 0.5 ? C.smoke : C.smokeDark;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        if (dither(Math.round(px + dx), Math.round(py + dy), level)) g.fillRect(Math.round(px + dx), Math.round(py + dy), 1, 1);
      }
    }
  }
}

// ---------------------------------------------------------------- 가스 가로등 (높이 92)
function lamp(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number, tick: number, since: number) {
  const cx = x + Math.floor(b.w / 2);
  if (p.stage === 2) {
    // 쓰러진 기둥: 밑동에서 맞은 방향으로 보도 위에 눕는다
    const d = p.dir || 1;
    rect(g, cx - 4, G - 5, 9, 5, C.iron);
    rect(g, cx - 2, G - 9, 5, 4, C.iron);
    const ex = cx + d * 76;
    line(g, cx, G - 7, ex, G - 3, C.iron);
    line(g, cx, G - 6, ex, G - 2, C.iron);
    line(g, cx, G - 5, ex, G - 1, C.ironLight);
    rect(g, Math.min(ex, ex + d * 10), G - 9, 10, 7, C.iron);
    for (let k = 0; k < 10; k++) {
      const gx = ex + d * (6 + Math.floor(rnd(i, k) * 20));
      rect(g, gx, G + 1 + Math.floor(rnd(i, k + 9) * 7), 1, 1, k % 2 ? C.skyLight : C.paintCream);
    }
    if (since < 150 && hash((tick >> 1) * 3 + i) < 0.35) {
      for (let k = 0; k < 6; k++) {
        const a = hash(tick * 5 + k + i) * Math.PI - Math.PI;
        const r = 3 + hash(tick * 7 + k) * 8;
        rect(g, Math.round(cx + d * 3 + Math.cos(a) * r), Math.round(G - 8 + Math.sin(a) * r), 1, 1, k % 2 ? C.fxYellow : C.skyLight);
      }
    }
    return;
  }
  const bend = p.stage === 1 ? (p.dir || 1) * 8 : 0;
  // 장식 받침
  rect(g, cx - 4, G - 5, 9, 5, C.iron);
  rect(g, cx - 3, G - 10, 7, 5, C.iron);
  rect(g, cx - 2, G - 14, 5, 4, C.ironLight);
  const midY = LAMP_TOP + 44;
  rect(g, cx - 1, midY, 2, G - 14 - midY, C.iron);
  rect(g, cx + 1, midY, 1, G - 14 - midY, C.ironLight);
  line(g, cx - 1, midY, cx - 1 + bend, LAMP_TOP + 14, C.iron);
  line(g, cx, midY, cx + bend, LAMP_TOP + 14, C.iron);
  line(g, cx + 1, midY, cx + 1 + bend, LAMP_TOP + 14, C.ironLight);
  const hx = cx + bend;
  // 가로대와 사다리 받침
  rect(g, hx - 5, LAMP_TOP + 24, 11, 2, C.iron);
  // 등 머리: 지붕, 유리, 받침
  rect(g, hx - 6, LAMP_TOP + 1, 13, 2, C.iron);
  rect(g, hx - 4, LAMP_TOP - 1, 9, 2, C.iron);
  rect(g, hx - 1, LAMP_TOP - 3, 3, 2, C.iron);
  rect(g, hx - 6, LAMP_TOP + 3, 1, 10, C.iron);
  rect(g, hx + 6, LAMP_TOP + 3, 1, 10, C.iron);
  rect(g, hx - 6, LAMP_TOP + 13, 13, 2, C.iron);
  const off = p.stage === 1 ? hash((tick >> 2) * 31 + i * 7) < 0.4 : hash((tick >> 3) * 31 + i * 7) < 0.06;
  rect(g, hx - 5, LAMP_TOP + 3, 11, 10, off ? C.lampWarm : C.lampGlow);
  if (!off) rect(g, hx - 2, LAMP_TOP + 5, 5, 5, C.lampCore);
  rect(g, hx, LAMP_TOP + 3, 1, 10, C.iron);
  if (p.stage === 1) line(g, hx - 5, LAMP_TOP + 3, hx + 5, LAMP_TOP + 12, C.iron);
  if (!off) lampGlow(g, hx, p.stage === 1 ? -4 : 0);
}

/** 가스등 불빛: 등 둘레의 은은한 빛과 보도에 떨어진 빛 웅덩이 */
function lampGlow(g: CanvasRenderingContext2D, x: number, shrink: number) {
  const cy = LAMP_TOP + 8;
  g.fillStyle = C.lampWarm;
  for (const [r, level] of [[22 + shrink, 2], [14 + shrink, 4], [9, 7]] as const) {
    for (let y = -r; y <= r; y++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + y * y > r * r) continue;
        if (dither(x + dx, cy + y, level)) g.fillRect(x + dx, cy + y, 1, 1);
      }
    }
  }
  for (let y = 0; y < 9; y++) {
    const half = 28 - y * 2;
    for (let dx = -half; dx <= half; dx++) {
      const level = Math.round(5 * (1 - Math.abs(dx) / (half + 1)));
      if (dither(x + dx, G + y, level)) g.fillRect(x + dx, G + y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- 쇼윈도 유리 (높이 40)
function glass(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number) {
  const h = b.h;
  const w = b.w;
  const top = G - GLASS_BOTTOM - h;
  if (p.stage === 2) {
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
  if (p.stage === 1) {
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
  if (p.stage === 2) {
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
  const dent = p.stage === 1;
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
    rect(g, x, G - 6, 10, 6, C.posterRedDark);
    rect(g, x + 2, G - 6, 2, 5, C.posterRed);
    const puddle = Math.min(46, 10 + (since >> 3));
    ditherRect(g, x + 5 - puddle, G + 1, puddle * 2, 5, C.skyDark, 8);
    ditherRect(g, x + 5 - (puddle >> 1), G + 2, puddle, 3, C.skyLight, 3);
    // 물기둥: 처음엔 높이 솟고 차츰 낮아진다 (라운드 끝까지 멈추지 않음)
    const height = Math.round(34 + 46 * Math.max(0, 1 - since / 600));
    for (let y = 0; y < height; y++) {
      const spread = Math.round(2 + (y / height) * 3 + Math.sin((tick + y) * 0.6));
      for (let dx = -spread; dx <= spread + 1; dx++) {
        const k = y / height;
        const level = k > 0.8 ? 6 : 12;
        if (!dither(x + 5 + dx, G - 6 - y + tick, level)) continue;
        g.fillStyle = Math.abs(dx) <= 1 && k < 0.7 ? C.skyLight : C.sky;
        g.fillRect(x + 5 + dx, G - 6 - y, 1, 1);
      }
    }
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
  rect(g, x + 1, G - 14, 8, 14, C.posterRedDark);
  rect(g, x - 1, G - 11, 12, 3, C.posterRedDark);
  rect(g, x + 2, G - 17, 6, 3, C.posterRedDark);
  rect(g, x + 4, G - 18, 2, 1, C.posterRedDark);
  rect(g, x + 2, G - 14, 2, 13, C.posterRed);
  rect(g, x, G - 2, 10, 2, C.iron);
  if (p.stage === 1) {
    line(g, x + 6, G - 14, x + 4, G - 6, C.iron);
    ditherRect(g, x - 8, G + 1, 26, 3, C.skyDark, 7);
    const drip = (tick >> 2) % 8;
    rect(g, x + 9, G - 9 + drip, 1, 1, C.skyLight);
  }
}
