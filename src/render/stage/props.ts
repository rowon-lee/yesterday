import type { PropState } from '../../sim';
import { BREAKABLES, frontBuildings, shopWindow, type Breakable } from '../../stage/downtown';
import { DOWNTOWN as D } from '../../data/stages/downtown';
import { drawText } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_W } from '../screen';
import { dither, ditherRect, hash, line, rect } from './dither';

/**
 * 부서지는 물건 그리기 (렌더 전용). 상태(멀쩡·망가짐·파괴, 언제 부서졌는지)는 sim이 정하고,
 * 여기서는 그 상태와 지난 틱으로 모습과 연출(불길, 연기, 물기둥, 깜빡임)만 정한다.
 * 잔해·그을린 자국·유리 조각은 부서진 상태가 남아 있는 동안(라운드 끝까지) 계속 그린다.
 */
const G = D.ground;
export const LAMP_TOP = G - 48;

/** 물건마다 정해진 무늬 (잔해 모양이 늘 같게) */
const rnd = (i: number, k: number) => hash(i * 7919 + k * 104729);

/** 뒤에서 앞으로: 건물 유리 → 보도 소품 → 가로등 → 길가에 선 자동차 */
const DRAW_ORDER = ['glass', 'newsstand', 'hydrant', 'lamp', 'car'] as const;
const ORDERED = DRAW_ORDER.flatMap((kind) => BREAKABLES.map((b, i) => [b, i] as const).filter(([b]) => b.kind === kind));

export function drawProps(ctx: CanvasRenderingContext2D, camX: number, tick: number, props: readonly PropState[] | null): void {
  ORDERED.forEach(([b, i]) => {
    const x = Math.round(b.x - camX);
    if (x + b.w < -40 || x > SCREEN_W + 40) return;
    const p = props?.[i] ?? INTACT;
    const since = p.brokenAt >= 0 ? tick - p.brokenAt : 0;
    const sinceDamaged = p.damagedAt >= 0 ? tick - p.damagedAt : 0;
    switch (b.kind) {
      case 'car':
        car(ctx, x, b, p, i, tick, since, sinceDamaged);
        break;
      case 'lamp':
        lamp(ctx, x, b, p, i, tick, since, camX);
        break;
      case 'glass':
        glass(ctx, x, b, p, i, camX);
        break;
      case 'newsstand':
        newsstand(ctx, x, p, i);
        break;
      case 'hydrant':
        hydrant(ctx, x, p, i, tick, since, camX);
        break;
    }
  });
}

const INTACT: PropState = { hp: 1, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1 };

// ---------------------------------------------------------------- 클래식 자동차
function car(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number, tick: number, since: number, sinceDamaged: number) {
  const body = i % 2 ? C.posterRedDark : C.paintTeal;
  const bodyLight = i % 2 ? C.posterRed : C.stone;
  const w = b.w;
  if (p.stage === 2) {
    // 그을린 자국: 길에 검게 번진 얼룩 (라운드 끝까지)
    ditherRect(g, x - 8, G + 1, w + 16, 5, C.fxSoot, 9, x);
    ditherRect(g, x - 2, G + 1, w + 4, 3, C.fxSoot, 14, x);
    // 타 버린 차체: 납작하게 주저앉고 바퀴 하나가 빠졌다
    rect(g, x + 2, G - 9, w - 4, 6, C.iron);
    rect(g, x + 9, G - 14, 20, 5, C.iron);
    line(g, x + 9, G - 14, x + 13, G - 17, C.iron);
    line(g, x + 29, G - 14, x + 26, G - 16, C.iron);
    rect(g, x + 4, G - 9, w - 8, 1, C.ironLight);
    ditherRect(g, x + 4, G - 8, w - 10, 4, C.rust, 6, x);
    wheel(g, x + 9, G - 3, true);
    rect(g, x + w - 12, G - 2, 8, 2, C.iron); // 빠진 바퀴 자리
    rect(g, x + w + 3, G - 3, 5, 3, C.iron); // 굴러간 바퀴
    // 불길이 점점 잦아들고, 다 탄 뒤에는 연기만 피어오른다
    const fire = Math.max(0, 1 - since / 420);
    if (fire > 0) flames(g, x + 8, G - 12, w - 16, Math.round(4 + 8 * fire), tick, i);
    smoke(g, x + w / 2, G - 14, tick, i, fire > 0 ? 4 : 2);
    return;
  }
  // 차체
  const dent = p.stage === 1;
  rect(g, x + 1, G - 12, w - 2, 8, body);
  rect(g, x + 1, G - 12, w - 2, 1, bodyLight);
  // 앞 보닛(오른쪽)과 라디에이터
  rect(g, x + w - 3, G - 11, 3, 6, C.stone);
  rect(g, x + w - 2, G - 10, 1, 4, C.iron);
  // 객실: 높은 지붕, 창
  const roof = dent ? G - 18 : G - 20;
  rect(g, x + 9, roof, 21, G - 12 - roof, body);
  rect(g, x + 8, roof, 23, 1, C.iron);
  rect(g, x + 11, roof + 2, 7, G - 14 - roof, C.windowDark);
  rect(g, x + 20, roof + 2, 8, G - 14 - roof, C.windowDark);
  if (dent) {
    // 깨진 창, 찌그러진 보닛
    line(g, x + 11, roof + 2, x + 17, G - 13, C.skyDark);
    line(g, x + 21, G - 13, x + 27, roof + 2, C.skyDark);
    for (let k = 0; k < 5; k++) rect(g, x + w - 16 + k * 3, G - 12 + (k % 2), 3, 1, C.iron);
  }
  // 흙받이와 발판
  rect(g, x + 3, G - 6, w - 6, 1, C.iron);
  arcFender(g, x + 9, body);
  arcFender(g, x + w - 10, body);
  wheel(g, x + 9, G - 3, false);
  wheel(g, x + w - 10, G - 3, false);
  // 범퍼와 전조등
  rect(g, x - 1, G - 6, 2, 2, C.stone);
  rect(g, x + w - 1, G - 6, 2, 2, C.stone);
  rect(g, x + w - 4, G - 13, 2, 2, dent ? C.iron : C.lampCore);
  if (dent) {
    // 망가지면 보닛에 불이 붙는다
    flames(g, x + w - 18, G - 13, 12, 5 + Math.min(4, sinceDamaged >> 5), tick, i);
    smoke(g, x + w - 12, G - 18, tick, i, 3);
  }
}

function arcFender(g: CanvasRenderingContext2D, cx: number, color: string) {
  rect(g, cx - 5, G - 8, 11, 2, color);
  rect(g, cx - 4, G - 9, 9, 1, color);
}

function wheel(g: CanvasRenderingContext2D, cx: number, cy: number, burnt: boolean) {
  for (let y = -3; y <= 3; y++) {
    const half = y === -3 || y === 3 ? 1 : y === -2 || y === 2 ? 2 : 3;
    rect(g, cx - half, cy + y, half * 2 + 1, 1, C.iron);
  }
  if (!burnt) {
    rect(g, cx - 1, cy - 1, 3, 3, C.stoneDark);
    rect(g, cx, cy, 1, 1, C.stone);
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
    const life = 90;
    const age = (tick + k * (life / puffs) + seed * 13) % life;
    const u = age / life;
    const px = x + Math.sin((age + seed * 9) * 0.07) * 3 + u * 6;
    const py = y - age * 0.35;
    const r = Math.round(2 + u * 5);
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

// ---------------------------------------------------------------- 가스 가로등
function lamp(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number, tick: number, since: number, camX: number) {
  const cx = x + b.w / 2;
  if (p.stage === 2) {
    // 쓰러진 기둥: 밑동에서 맞은 방향으로 보도 위에 눕는다
    const d = p.dir || 1;
    rect(g, cx - 2, G - 3, 5, 3, C.iron);
    rect(g, cx - 1, G - 5, 3, 2, C.iron);
    const len = 40;
    const ex = cx + d * len;
    line(g, cx, G - 4, ex, G - 2, C.iron);
    line(g, cx, G - 3, ex, G - 1, C.ironLight);
    // 깨진 등 머리와 흩어진 유리
    rect(g, Math.min(ex, ex + d * 6), G - 5, 6, 4, C.iron);
    for (let k = 0; k < 6; k++) {
      const gx = ex + d * (4 + Math.floor(rnd(i, k) * 12));
      rect(g, gx, G + 1 + Math.floor(rnd(i, k + 9) * 4), 1, 1, k % 2 ? C.skyLight : C.paintCream);
    }
    // 끊긴 가스관에서 잠깐 튀는 불꽃과 전기
    if (since < 150 && hash((tick >> 1) * 3 + i) < 0.35) {
      const sx = cx + d * 2;
      for (let k = 0; k < 4; k++) {
        const a = hash(tick * 5 + k + i) * Math.PI - Math.PI;
        const r = 2 + hash(tick * 7 + k) * 5;
        rect(g, Math.round(sx + Math.cos(a) * r), Math.round(G - 5 + Math.sin(a) * r), 1, 1, k % 2 ? C.fxYellow : C.skyLight);
      }
    }
    return;
  }
  // 망가지면 기둥 윗부분이 휘고 불빛이 자주 깜빡인다
  const bend = p.stage === 1 ? (p.dir || 1) * 4 : 0;
  rect(g, cx - 2, G - 3, 5, 3, C.iron);
  rect(g, cx - 1, G - 6, 3, 3, C.iron);
  const midY = LAMP_TOP + 24;
  rect(g, cx, midY, 1, G - 6 - midY, C.iron);
  rect(g, cx + 1, midY, 1, G - 6 - midY, C.ironLight);
  line(g, cx, midY, cx + bend, LAMP_TOP + 8, C.iron);
  line(g, cx + 1, midY, cx + 1 + bend, LAMP_TOP + 8, C.ironLight);
  const hx = cx + bend;
  rect(g, hx - 2, LAMP_TOP + 14, 5, 1, C.iron);
  rect(g, hx - 3, LAMP_TOP, 7, 1, C.iron);
  rect(g, hx - 2, LAMP_TOP - 1, 5, 1, C.iron);
  rect(g, hx, LAMP_TOP - 2, 1, 1, C.iron);
  rect(g, hx - 3, LAMP_TOP + 1, 1, 6, C.iron);
  rect(g, hx + 3, LAMP_TOP + 1, 1, 6, C.iron);
  rect(g, hx - 3, LAMP_TOP + 7, 7, 1, C.iron);
  const off = p.stage === 1 ? hash((tick >> 2) * 31 + i * 7) < 0.4 : hash((tick >> 3) * 31 + i * 7) < 0.08;
  rect(g, hx - 2, LAMP_TOP + 1, 5, 6, off ? C.lampWarm : C.lampGlow);
  if (!off) rect(g, hx - 1, LAMP_TOP + 2, 3, 3, C.lampCore);
  if (p.stage === 1) line(g, hx - 2, LAMP_TOP + 1, hx + 2, LAMP_TOP + 6, C.iron); // 금 간 유리
  if (!off) lampGlow(g, hx, camX, p.stage === 1 ? -2 : 0);
}

/** 가스등 불빛: 등 둘레의 은은한 빛과 보도에 떨어진 빛 웅덩이 */
function lampGlow(g: CanvasRenderingContext2D, x: number, camX: number, shrink: number) {
  const cam = Math.round(camX);
  const cy = LAMP_TOP + 4;
  g.fillStyle = C.lampWarm;
  for (const [r, level] of [[12 + shrink, 2], [8 + shrink, 4], [5, 7]] as const) {
    for (let y = -r; y <= r; y++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + y * y > r * r) continue;
        if (dither(x + dx + cam, cy + y, level)) g.fillRect(x + dx, cy + y, 1, 1);
      }
    }
  }
  for (let y = 0; y < 6; y++) {
    const half = 16 - y;
    for (let dx = -half; dx <= half; dx++) {
      const level = Math.round(5 * (1 - Math.abs(dx) / (half + 1)));
      if (dither(x + dx + cam, G + y, level)) g.fillRect(x + dx, G + y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- 쇼윈도 유리
function glass(g: CanvasRenderingContext2D, x: number, b: Breakable, p: PropState, i: number, camX: number) {
  const top = G - 20;
  const h = b.h;
  const w = b.w;
  const cam = Math.round(camX);
  if (p.stage === 2) {
    // 산산조각: 어두운 가게 안, 틀에 남은 삐죽한 조각, 보도에 흩어진 유리
    rect(g, x, top, w, h, C.windowDark);
    for (let k = 0; k < w; k += 3) {
      const tooth = 1 + Math.floor(rnd(i, k) * 4);
      rect(g, x + k, top, 2, tooth, C.stone);
      const tb = 1 + Math.floor(rnd(i, k + 50) * 3);
      rect(g, x + k + 1, top + h - tb, 2, tb, C.stone);
      if (rnd(i, k + 70) < 0.3) rect(g, x + k, top, 1, 1, C.skyLight); // 조각에 비친 빛
    }
    rect(g, x, top, 1, h, C.stone);
    rect(g, x + w - 1, top, 1, h, C.stone);
    for (let k = 0; k < w; k++) {
      if (rnd(i, k + 100) < 0.45) rect(g, x + k + Math.floor((rnd(i, k + 200) - 0.5) * 8), G + 1 + Math.floor(rnd(i, k + 300) * 4), 1, 1, rnd(i, k) < 0.3 ? C.skyLight : C.stone);
    }
    return;
  }
  // 불 켜진 가게 안이 비치는 유리 + 비스듬한 반사광
  rect(g, x, top, w, h, C.windowDark);
  ditherRect(g, x, top + 3, w, h - 3, C.windowLit, 5, cam);
  for (let k = 0; k < 2; k++) line(g, x + 5 + k * 14, top + h - 3, x + 10 + k * 14, top + 3, C.stone);
  if (p.stage === 1) {
    // 금: 맞은 자리에서 거미줄처럼 퍼진다
    const cx = x + Math.floor(w * (0.3 + rnd(i, 1) * 0.4));
    const cy = top + Math.floor(h * (0.3 + rnd(i, 2) * 0.4));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rnd(i, k + 3);
      const r = 5 + rnd(i, k + 10) * 10;
      line(g, cx, cy, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), C.white);
    }
    for (const r of [3, 6]) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        rect(g, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 1, 1, C.skyLight);
      }
    }
  }
}

// ---------------------------------------------------------------- 신문 가판대
function newsstand(g: CanvasRenderingContext2D, x: number, p: PropState, i: number) {
  if (p.stage === 2) {
    // 무너진 판자 더미와 보도에 흩어진 신문지
    rect(g, x - 2, G - 5, 26, 5, C.awning);
    line(g, x - 3, G - 4, x + 10, G - 9, C.awningStripe);
    line(g, x + 8, G - 8, x + 24, G - 3, C.iron);
    rect(g, x + 4, G - 7, 6, 2, C.awningStripe);
    for (let k = 0; k < 9; k++) {
      const px = x - 14 + Math.floor(rnd(i, k) * 50);
      const py = G + Math.floor(rnd(i, k + 20) * 5);
      rect(g, px, py, 3, 2, k % 3 ? C.paintCream : C.stone);
      rect(g, px + 1, py, 1, 1, C.stoneDark);
    }
    return;
  }
  const dent = p.stage === 1;
  rect(g, x, G - 22, 22, 22, C.awning);
  if (dent) {
    // 찢어져 처진 차양, 찌그러진 옆판
    line(g, x - 1, G - 24, x + 23, G - 20, C.iron);
    line(g, x - 1, G - 23, x + 23, G - 19, C.iron);
    line(g, x + 21, G - 18, x + 18, G - 6, C.awningStripe);
  } else {
    rect(g, x - 1, G - 24, 24, 2, C.iron);
  }
  rect(g, x + 2, G - 19, 18, 9, C.windowDark);
  for (let k = 0; k < 4; k++) {
    if (dent && k === 2) continue;
    rect(g, x + 3 + k * 4, G - 18 + (dent && k === 1 ? 2 : 0), 3, 7, k % 2 ? C.paintCream : C.stone);
  }
  rect(g, x + 2, G - 8, 18, 1, C.iron);
  drawText(g, 'NEWS', x + 4, G - 7, C.paintCream);
  if (dent) for (let k = 0; k < 3; k++) rect(g, x + 24 + k * 4, G + 1 + (k % 2), 3, 2, C.paintCream);
}

// ---------------------------------------------------------------- 소화전
function hydrant(g: CanvasRenderingContext2D, x: number, p: PropState, i: number, tick: number, since: number, camX: number) {
  const cam = Math.round(camX);
  if (p.stage === 2) {
    // 부러진 밑동, 솟는 물기둥, 점점 넓어지는 물웅덩이
    rect(g, x, G - 4, 6, 4, C.posterRedDark);
    rect(g, x + 1, G - 4, 1, 3, C.posterRed);
    const puddle = Math.min(28, 6 + (since >> 3));
    ditherRect(g, x + 3 - puddle, G + 1, puddle * 2, 3, C.skyDark, 8, cam);
    ditherRect(g, x + 3 - (puddle >> 1), G + 2, puddle, 2, C.skyLight, 3, cam);
    // 물기둥: 처음엔 높이 솟고 차츰 낮아진다 (라운드 끝까지 멈추지 않음)
    const height = Math.round(18 + 22 * Math.max(0, 1 - since / 600));
    for (let y = 0; y < height; y++) {
      const spread = Math.round(1 + (y / height) * 2 + Math.sin((tick + y) * 0.6));
      for (let dx = -spread; dx <= spread + 1; dx++) {
        const k = y / height;
        const level = k > 0.8 ? 6 : 12;
        if (!dither(x + 3 + dx + cam, G - 4 - y + tick, level)) continue;
        g.fillStyle = Math.abs(dx) <= 0 && k < 0.7 ? C.skyLight : C.sky;
        g.fillRect(x + 3 + dx, G - 4 - y, 1, 1);
      }
    }
    // 위에서 떨어지는 물방울
    for (let k = 0; k < 10; k++) {
      const life = 30;
      const age = (tick + k * 3 + i * 5) % life;
      const side = k % 2 ? 1 : -1;
      const dx = side * (2 + age * (0.25 + rnd(i, k) * 0.3));
      const dy = -height - 2 + (age * age) / 18;
      rect(g, Math.round(x + 3 + dx), Math.round(G - 4 + dy), 1, 1, C.skyLight);
    }
    return;
  }
  rect(g, x, G - 9, 5, 9, C.posterRedDark);
  rect(g, x - 1, G - 7, 7, 2, C.posterRedDark);
  rect(g, x + 1, G - 11, 3, 2, C.posterRedDark);
  rect(g, x + 1, G - 9, 1, 8, C.posterRed);
  if (p.stage === 1) {
    // 금이 가서 물이 샌다
    line(g, x + 3, G - 9, x + 2, G - 4, C.iron);
    ditherRect(g, x - 4, G + 1, 14, 2, C.skyDark, 7, cam);
    const drip = (tick >> 2) % 6;
    rect(g, x + 5, G - 6 + drip, 1, 1, C.skyLight);
  }
}

/** 길가 건물의 쇼윈도 자리 (구운 그림에서 비워 둘 곳) */
export function shopWindows() {
  return frontBuildings().filter((b) => b.shop).map(shopWindow);
}
