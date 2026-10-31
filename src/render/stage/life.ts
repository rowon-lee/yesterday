import { DOWNTOWN as D } from '../../data/stages/downtown';
import { GROUND } from '../../stage/downtown';
import { drawText } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_W } from '../screen';
import { disc, dither, hash, line, rect } from './dither';
import { midGround } from './layers';

/**
 * 움직이는 도시 (모두 렌더 전용, sim과 무관): 노면전차, 도망치는 행인, 증기.
 * 전차와 증기는 틱만 보고 그려서 같은 틱이면 늘 같은 그림이다.
 */

// ---------------------------------------------------------------- 노면전차
/** 이 틱의 전차 위치 (차체 왼쪽 끝, 월드 x)와 방향. 지나가는 중이 아니면 null */
export function tramAt(tick: number): { x: number; dir: number } | null {
  const T = D.tram;
  if (tick < T.first) return null;
  const n = Math.floor((tick - T.first) / T.every);
  const t = tick - T.first - n * T.every;
  const dist = T.x1 - T.x0 + T.length;
  const travelled = t * T.speed;
  if (travelled > dist) return null;
  const dir = n % 2 ? -1 : 1;
  const x = dir > 0 ? T.x0 - T.length + travelled : T.x1 - travelled;
  return { x, dir };
}

/**
 * 1910년대식 노면전차: 짙은 녹색 아래 판, 크림색 창 띠(불 켜진 창과 승객 실루엣), 지붕의 채광 단,
 * 앞뒤 승강대와 배장기, 앞쪽 전조등, 가공선에 닿은 트롤리 막대(가끔 불꽃). 판정 없음.
 */
export function drawTram(g: CanvasRenderingContext2D, tick: number): void {
  const at = tramAt(tick);
  if (!at) return;
  const T = D.tram;
  const L = T.length;
  const x = Math.round(at.x);
  const G = GROUND;
  const front = at.dir > 0 ? x + L : x;
  // 바퀴와 대차
  for (const bx of [x + 22, x + L - 46]) {
    rect(g, bx - 2, G - 12, 28, 4, C.iron);
    for (const wx of [bx + 4, bx + 20]) {
      disc(g, wx, G - 5, 5, C.iron);
      disc(g, wx, G - 5, 2, C.ironLight);
    }
  }
  // 아래 판 (녹색), 창 띠 (크림), 지붕
  rect(g, x + 6, G - 32, L - 12, 20, C.paintTeal);
  rect(g, x + 6, G - 32, L - 12, 1, C.paintCream);
  rect(g, x + 6, G - 14, L - 12, 2, C.iron);
  rect(g, x + 6, G - 54, L - 12, 22, C.paintCream);
  rect(g, x + 2, G - 60, L - 4, 6, C.iron);
  rect(g, x + 20, G - 64, L - 40, 4, C.ironLight);
  for (let cx = x + 24; cx < x + L - 24; cx += 8) rect(g, cx, G - 63, 4, 2, C.windowLit);
  // 승강대 (앞뒤 끝은 조금 좁게)
  for (const ex of [x, x + L - 6]) {
    rect(g, ex, G - 56, 6, 42, C.paintTeal);
    rect(g, ex + 1, G - 52, 4, 16, C.windowDark);
  }
  // 창: 불 켜진 실내와 승객
  for (let wx = x + 12, i = 0; wx + 12 < x + L - 10; wx += 15, i++) {
    rect(g, wx, G - 51, 12, 15, C.windowLit);
    rect(g, wx, G - 51, 12, 3, C.windowLight);
    if (hash(i * 31 + 7) < 0.6) {
      const px = wx + 3 + Math.floor(hash(i * 17) * 5);
      disc(g, px, G - 44, 2, C.iron);
      rect(g, px - 2, G - 42, 5, 6, C.iron);
    }
    rect(g, wx + 12, G - 52, 3, 17, C.paintCream);
  }
  // 글씨와 번호판
  drawText(g, 'LINE 7', x + Math.floor(L / 2) - 18, G - 28, C.paintCream, 1);
  rect(g, front - (at.dir > 0 ? 18 : -2), G - 60, 16, 6, C.windowDark);
  drawText(g, '7', front - (at.dir > 0 ? 13 : -7), G - 59, C.lampGlow, 1);
  // 배장기와 전조등
  for (let i = 0; i < 6; i++) {
    const fx = at.dir > 0 ? front + i : front - i;
    rect(g, fx, G - 12 + i, 1, 2, C.iron);
  }
  const hx = at.dir > 0 ? front - 4 : front + 1;
  rect(g, hx, G - 26, 4, 4, C.lampCore);
  for (let i = 1; i <= 12; i++) {
    const lx = at.dir > 0 ? front + i : front - i;
    for (let y = G - 28 - Math.floor(i / 4); y < G - 20 + Math.floor(i / 4); y++) if (dither(lx, y, 6 - Math.floor(i / 3))) rect(g, lx, y, 1, 1, C.lampGlow);
  }
  // 트롤리 막대: 뒤쪽 지붕에서 가공선까지 비스듬히
  const baseX = at.dir > 0 ? x + 30 : x + L - 30;
  const wireY = G - T.wire;
  const tipX = baseX - at.dir * 34;
  line(g, baseX, G - 64, tipX, wireY + 2, C.iron);
  line(g, baseX + 1, G - 64, tipX + 1, wireY + 2, C.ironLight);
  rect(g, tipX - 1, wireY, 3, 3, C.ironLight);
  // 가공선 불꽃 (가끔)
  if (hash(Math.floor(tick / 3) * 7919) < 0.25) {
    for (let i = 0; i < 6; i++) {
      const r = hash(tick * 13 + i * 101);
      rect(g, tipX + Math.round((r - 0.5) * 10), wireY - 1 + Math.round(hash(tick * 7 + i) * 6) - 2, 1, 1, i % 2 ? C.fxYellow : C.fxWhite);
    }
  }
}

// ---------------------------------------------------------------- 증기
/** 증기: 구멍마다 뭉치 여섯 개가 차례로 솟아 퍼지며 옅어진다 (디더링) */
export function drawSteam(g: CanvasRenderingContext2D, vents: ReadonlyArray<{ x: number; y: number }>, tick: number, x0: number, x1: number): void {
  vents.forEach((v, vi) => {
    if (v.x < x0 - 40 || v.x > x1 + 40) return;
    const life = 90;
    for (let p = 0; p < 6; p++) {
      const age = (tick * 0.8 + p * (life / 6) + vi * 29) % life;
      const k = age / life;
      const x = v.x + Math.sin((age + vi * 13) * 0.08) * 3 + age * 0.15;
      const y = v.y - age * 0.7;
      const level = Math.max(2, Math.round(10 * (1 - k)));
      disc(g, x, y, 3 + k * 9, k < 0.4 ? C.stone : C.smoke, level);
    }
  });
}

// ---------------------------------------------------------------- 도망치는 행인 (가운데 겹)
interface Walker {
  x: number;
  dir: number;
  speed: number;
  phase: number;
  age: number;
}

/**
 * 멀리 반 크기 실루엣 행인. 가운데 겹의 바닥을 걷다가, 싸움이 있으면 싸움 반대쪽으로 뛰어 도망간다.
 * 앞쪽 건물에 가려 광장·철교 밑 빈터·골목처럼 트인 곳에서만 보인다.
 */
export class Walkers {
  private list: Walker[] = [];
  private last = -1;
  private seed = 1;

  /** focusX: 싸움이 벌어지는 월드 x (없으면 그냥 걸어 다닌다) */
  step(tick: number, camX: number, focusX: number | null): void {
    if (tick === this.last) return;
    // 처음이나 건너뛴 뒤에는 몇 초 치를 미리 돌려 거리에 사람이 있게 한다
    const steps = this.last < 0 || tick < this.last ? 300 : Math.min(600, tick - this.last);
    this.last = tick;
    const s = D.mid.speed;
    const view0 = camX * s - 80;
    const view1 = camX * s + SCREEN_W + 80;
    // 싸움 자리를 가운데 겹 좌표로: 화면에서 같은 자리에 보이는 x
    const focus = focusX === null ? null : focusX - camX + camX * s;
    for (let n = 0; n < steps; n++) {
      if (this.list.length < 18 && hash(this.seed * 7919) < (focus === null ? 0.05 : 0.12)) {
        const x = view0 + hash(this.seed * 131 + 1) * (view1 - view0);
        const dir = focus === null ? (hash(this.seed * 17) < 0.5 ? -1 : 1) : x < focus ? -1 : 1;
        this.list.push({ x, dir, speed: focus === null ? 0.25 + hash(this.seed * 3) * 0.2 : 0.9 + hash(this.seed * 5) * 0.8, phase: hash(this.seed * 11) * 8, age: 0 });
      }
      this.seed++;
      for (const w of this.list) {
        w.x += w.dir * w.speed;
        w.phase += w.speed * 0.35;
        w.age++;
      }
    }
    this.list = this.list.filter((w) => w.age < 900 && w.x > view0 - 120 && w.x < view1 + 120);
  }

  /** 가운데 겹 바로 앞에 그린다 (cam은 월드 카메라) */
  draw(g: CanvasRenderingContext2D, cam: { x: number; y: number }): void {
    const s = D.mid.speed;
    const ox = Math.round(cam.x * s);
    const oy = Math.round(cam.y * s);
    const gy = midGround() + 2 - oy;
    for (const w of this.list) walker(g, Math.round(w.x - ox), gy, w.dir, w.phase, w.speed > 0.6);
  }
}

/** 반 크기 행인 실루엣 (키 약 24px, 모자). 뛰면 팔다리를 크게 휘두른다 */
function walker(g: CanvasRenderingContext2D, x: number, foot: number, dir: number, phase: number, run: boolean): void {
  const col = C.night;
  const swing = Math.sin(phase) * (run ? 5 : 3);
  const lean = run ? dir * 2 : 0;
  const hip = foot - 11;
  const neck = foot - 20;
  line(g, x, hip, x - swing, foot, col);
  line(g, x, hip, x + swing, foot, col);
  line(g, x, hip, x + lean, neck, col);
  line(g, x + 1, hip, x + lean + 1, neck, col);
  line(g, x + lean, neck + 1, x + lean + swing, neck + 8, col);
  line(g, x + lean, neck + 1, x + lean - swing, neck + 8, col);
  disc(g, x + lean, neck - 2, 2, col);
  rect(g, x + lean - 2, neck - 5, 5, 1, col);
  rect(g, x + lean - 1, neck - 6, 3, 1, col);
}
