import { CITADEL as D } from '../../data/stages/citadel';
import { GROUND } from '../../stage/citadel';
import { drawText } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_W } from '../screen';
import { disc, discFast, dither, hash, line, rect, stamp } from './dither';
import { midGround, midSeaX } from './layers';
import { lights } from '../light';

/**
 * 움직이는 도시 (모두 렌더 전용, sim과 무관): 노면전차, 도망치는 행인, 증기, 분수.
 * 전차·증기·분수는 틱만 보고 그려서 같은 틱이면 늘 같은 그림이다. (옥상 전광판은 부서지는 네온이라 props.ts)
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
 * 1960년대 유선형 노면전차: 둥근 앞뒤, 크림색 위·녹색 아래 두 가지 색, 크롬 허리띠, 이어진 띠 창(불 켜진 실내와 승객),
 * 가운데 전조등과 행선 표지, 가공선에 닿은 트롤리 막대(가끔 불꽃). 판정 없음. 전조등과 실내가 빛을 낸다.
 */
export function drawTram(g: CanvasRenderingContext2D, tick: number): void {
  const at = tramAt(tick);
  if (!at) return;
  const T = D.tram;
  const L = T.length;
  const x = Math.round(at.x);
  const G = GROUND;
  const front = at.dir > 0 ? x + L : x;
  // 차체·창·승객·트롤리 막대는 방향마다 한 번 그려 두고 얹는다 (기준점: 차체 왼쪽 끝, 바닥)
  stamp(g, `tram:${at.dir}`, x, G, L + 8, T.wire + 4, 4, T.wire + 2, (sg) => tramBody(sg, at.dir, L, T.wire));
  lights.point(x + L / 2, G - 40, L * 0.55, C.windowLight, 0.35);
  const hx = at.dir > 0 ? front - 3 : front + 1;
  lights.point(hx + 1, G - 22, 30, C.lampCore, 0.8);
  lights.cone(hx + 1, G - 22, at.dir > 0 ? 0.08 : Math.PI - 0.08, 150, 0.22, C.lampGlow, 0.45);
  // 가공선 불꽃 (가끔): 순간 파랗게 번쩍인다
  const baseX = at.dir > 0 ? x + 34 : x + L - 34;
  const wireY = G - T.wire;
  const tipX = baseX - at.dir * 34;
  if (hash(Math.floor(tick / 3) * 7919) < 0.25) {
    for (let i = 0; i < 6; i++) {
      const r = hash(tick * 13 + i * 101);
      rect(g, tipX + Math.round((r - 0.5) * 10), wireY - 1 + Math.round(hash(tick * 7 + i) * 6) - 2, 1, 1, i % 2 ? C.fxYellow : C.fxWhite);
    }
    lights.point(tipX, wireY, 46, C.skyLight, 0.9);
  }
}

/** 전차 몸체 (기준점: 차체 왼쪽 끝 x=0, 바닥 y=0) */
function tramBody(g: CanvasRenderingContext2D, dir: number, L: number, wire: number): void {
  const x = 0;
  const G = 0;
  const front = dir > 0 ? x + L : x;
  // 둥근 앞뒤: 위아래로 갈수록 안쪽으로 들어가는 몸체
  const inset = (y: number) => {
    const t = Math.abs(y - (G - 32)) / 24;
    return Math.round(Math.max(0, t * t * 10));
  };
  for (let y = G - 56; y < G - 10; y++) {
    const k = inset(y);
    const col = y < G - 30 ? C.carCream : C.carMint;
    rect(g, x + k, y, L - k * 2, 1, col);
  }
  rect(g, x + 4, G - 31, L - 8, 2, C.chrome);
  rect(g, x + 10, G - 12, L - 20, 2, C.iron);
  // 지붕 환기 띠와 트롤리 받침
  rect(g, x + 30, G - 59, L - 60, 3, C.chromeDark);
  // 띠 창: 이어진 창, 불 켜진 실내와 승객
  for (let wx = x + 14, k = 0; wx + 10 < x + L - 14; wx += 13, k++) {
    rect(g, wx, G - 46, 11, 13, C.windowLit);
    rect(g, wx, G - 46, 11, 2, C.windowLight);
    if (hash(k * 31 + 7) < 0.6) {
      const px = wx + 3 + Math.floor(hash(k * 17) * 5);
      disc(g, px, G - 40, 2, C.iron);
      rect(g, px - 2, G - 38, 5, 5, C.iron);
    }
    rect(g, wx + 11, G - 47, 2, 15, C.carCream);
    rect(g, wx, G - 50, 11, 2, C.windowDark);
  }
  // 바퀴 대차
  for (const bx of [x + 22, x + L - 46]) {
    rect(g, bx - 2, G - 11, 28, 3, C.iron);
    for (const wx of [bx + 4, bx + 20]) {
      disc(g, wx, G - 5, 5, C.iron);
      disc(g, wx, G - 5, 2, C.chromeDark);
    }
  }
  // 앞쪽: 둥근 앞유리, 가운데 전조등, 행선 표지
  const fx = dir > 0 ? front - 12 : front + 2;
  rect(g, fx, G - 50, 10, 16, C.windowDark);
  rect(g, dir > 0 ? front - 9 : front + 3, G - 55, 6, 4, C.windowDark);
  drawText(g, '7', dir > 0 ? front - 8 : front + 4, G - 55, C.lampGlow, 1);
  const hx = dir > 0 ? front - 3 : front + 1;
  rect(g, hx, G - 24, 3, 4, C.lampCore);
  rect(g, dir > 0 ? x + 2 : x + L - 4, G - 22, 2, 3, C.neonRed);
  drawText(g, 'CITADEL LINE', x + Math.floor(L / 2) - 23, G - 27, C.carCream, 1);
  // 트롤리 막대: 뒤쪽 지붕에서 가공선까지 비스듬히
  const baseX = dir > 0 ? x + 34 : x + L - 34;
  const wireY = G - wire;
  const tipX = baseX - dir * 34;
  line(g, baseX, G - 59, tipX, wireY + 2, C.iron);
  line(g, baseX + 1, G - 59, tipX + 1, wireY + 2, C.ironLight);
  rect(g, tipX - 1, wireY, 3, 3, C.ironLight);
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
      discFast(g, x, y, 3 + k * 9, k < 0.4 ? C.stone : C.smoke, level);
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
      const x = view0 + hash(this.seed * 131 + 1) * (view1 - view0);
      // 부두 뒤(바다)에는 길이 없으니 나오지 않는다
      if (this.list.length < 18 && x > midSeaX() + 4 && hash(this.seed * 7919) < (focus === null ? 0.05 : 0.12)) {
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
    this.list = this.list.filter((w) => w.age < 900 && w.x > Math.max(view0 - 120, midSeaX()) && w.x < view1 + 120);
  }

  /** 가운데 겹 바로 앞에 그린다 (cam은 월드 카메라, color는 원근을 입힌 실루엣 색) */
  draw(g: CanvasRenderingContext2D, cam: { x: number; y: number }, color: string = C.night): void {
    const s = D.mid.speed;
    const ox = Math.round(cam.x * s);
    const oy = Math.round(cam.y * s);
    const gy = midGround() + 2 - oy;
    for (const w of this.list) walker(g, Math.round(w.x - ox), gy, w.dir, w.phase, w.speed > 0.6, color);
  }
}

/** 반 크기 행인 실루엣 (키 약 24px, 모자). 뛰면 팔다리를 크게 휘두른다. 자세(휘두름 정도)마다 한 번 그려 두고 얹는다 */
function walker(g: CanvasRenderingContext2D, x: number, foot: number, dir: number, phase: number, run: boolean, color: string): void {
  const swing = Math.round(Math.sin(phase) * (run ? 5 : 3));
  const lean = run ? dir * 2 : 0;
  stamp(g, `walker:${swing}:${lean}:${color}`, x, foot, 20, 30, 10, 27, (sg) => walkerPose(sg, swing, lean, color));
}

function walkerPose(g: CanvasRenderingContext2D, swing: number, lean: number, col: string): void {
  const x = 0;
  const foot = 0;
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

// ---------------------------------------------------------------- 분수
/**
 * 광장 분수 물줄기: 가운데 그릇에서 솟는 물기둥(높이가 천천히 오르내림)과 양옆으로 휘어 떨어지는 물줄기,
 * 수반에 떨어지는 물보라. 물방울은 틱마다 자리가 바뀐다.
 */
export function drawFountain(g: CanvasRenderingContext2D, tick: number): void {
  const F = D.plaza.fountain;
  const base = GROUND - 50;
  const height = 46 + Math.round(Math.sin(tick * 0.03) * 14);
  // 가운데 물기둥
  for (let i = 0; i < 26; i++) {
    const t = ((tick * 0.9 + i * 7) % 40) / 40;
    const y = base - Math.round(height * Math.sin(Math.PI * t));
    const x = F.x + Math.round((hash(i * 17 + Math.floor(tick / 3)) - 0.5) * 4 * t);
    rect(g, x - 1, y, 2, 2, i % 3 ? C.skyLight : C.white);
  }
  // 양옆으로 휘어 떨어지는 물줄기
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const t = ((tick * 1.1 + i * 5 + (dir > 0 ? 9 : 0)) % 36) / 36;
      const x = F.x + dir * Math.round(8 + t * 44);
      const y = base - Math.round(28 * Math.sin(Math.PI * Math.min(1, t * 0.9))) + Math.round(t * 36);
      if (y < GROUND - 16) rect(g, x, y, 1, 2, i % 2 ? C.skyLight : C.sky);
    }
  }
  // 물보라
  for (let i = 0; i < 12; i++) {
    const r = hash(i * 31 + Math.floor(tick / 4) * 7);
    const x = F.x - F.w / 2 + 6 + Math.round(r * (F.w - 12));
    if (dither(x, tick, 8)) rect(g, x, GROUND - 18 - Math.round(hash(i + tick) * 3), 1, 1, C.white);
  }
}
