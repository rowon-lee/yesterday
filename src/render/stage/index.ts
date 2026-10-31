import type { CityState, PropState } from '../../sim';
import { CityLayer, drawRubble } from './city';
import { frontBuildings, GROUND } from '../../stage/downtown';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, dither, rect } from './dither';
import {
  buildBridge, buildFar, buildFront, buildMid, buildSky, buildSkyline, buildStreet, factoryVents, farChimneys, layerGround,
  layerH, manholes, midChimneys, searchlights, toLayerX, type Layer,
} from './layers';
import { drawSteam, drawTram, Walkers } from './life';
import { drawProps } from './props';
import { DOWNTOWN as D } from '../../data/stages/downtown';

/** 바닥 높이 (월드 y). 캐릭터 발밑(sim 높이 0)이 여기 닿는다 */
export const GROUND_Y = GROUND;

/** 카메라: 화면 왼쪽 위가 월드의 어디인지 (px) */
export interface Cam {
  x: number;
  y: number;
}

/**
 * 첫 구역 '도심'. 6겹이 카메라와 다른 속도로 움직인다 (먼 겹일수록 가로·세로 모두 느리게):
 * 하늘 → 먼 실루엣(거대 굴뚝·철교) → 먼 도시 → 중간 건물 → 싸우는 거리 → 앞겹(drawForeground, 캐릭터 앞).
 * 고정된 겹은 처음 한 번 그려 두고, 매연·서치라이트·전차·행인·증기·물건은 매 틱 덧그린다. 모두 렌더 전용.
 */
let built: {
  sky: Layer; far: Layer; skyline: Layer; mid: Layer; front: Layer; street: Layer; bridge: { canvas: HTMLCanvasElement; x: number };
} | null = null;
let city: CityLayer | null = null;
let smokers: ReturnType<typeof farChimneys> = [];
let lights: ReturnType<typeof searchlights> = [];
let vents: Array<{ x: number; y: number }> = [];
const walkers = new Walkers();

function layers() {
  if (!built) {
    built = {
      sky: buildSky(),
      far: buildFar(),
      skyline: buildSkyline(),
      mid: buildMid(),
      front: buildFront(),
      street: buildStreet(),
      bridge: buildBridge(),
    };
    city = new CityLayer(built.front.canvas);
    smokers = [...farChimneys(), ...midChimneys()];
    lights = searchlights();
    vents = [
      ...frontBuildings().filter((b) => b.kind === 'factory').flatMap((b) => factoryVents(b).map((x) => ({ x, y: GROUND - 100 }))),
      ...manholes(),
    ];
  }
  return built;
}

/** 무너지기 전 길가 건물 정면 그림 (월드 좌표). 무너질 때 떨어지는 조각을 여기서 잘라 간다 */
export function frontImage(): HTMLCanvasElement {
  return layers().front.canvas;
}

/** 겹 좌표 → 화면 좌표의 이동량 */
const off = (cam: Cam, speed: number): [number, number] => [Math.round(cam.x * speed), Math.round(cam.y * speed)];

const place = (ctx: CanvasRenderingContext2D, l: Layer, cam: Cam) => {
  const [ox, oy] = off(cam, l.speed);
  ctx.drawImage(l.canvas, -ox, -oy);
};

/**
 * 캐릭터 뒤에 그리는 무대 전부. props는 sim의 부서지는 물건 상태, cityState는 건물 덩어리 상태 (없으면 모두 멀쩡).
 * focusX는 싸움이 벌어지는 월드 x (멀리 행인이 그 반대쪽으로 도망간다). 없으면 행인이 그냥 걷는다.
 */
export function drawStage(
  ctx: CanvasRenderingContext2D, cam: Cam, tick: number, props: readonly PropState[] | null = null, cityState: CityState | null = null,
  focusX: number | null = null,
): void {
  const L = layers();
  place(ctx, L.sky, cam);
  drawSmoke(ctx, cam, tick, D.far.speed);
  place(ctx, L.far, cam);
  place(ctx, L.skyline, cam);
  drawSearchlights(ctx, cam, tick);
  drawSmoke(ctx, cam, tick, D.mid.speed);
  place(ctx, L.mid, cam);
  walkers.step(tick, cam.x, focusX);
  walkers.draw(ctx, cam);
  // 길가 건물 정면: 부서진 덩어리만 고쳐 그린 그림
  city!.update(cityState);
  const cx = Math.round(cam.x);
  const cy = Math.round(cam.y);
  ctx.drawImage(city!.canvas, -cx, -cy);
  ctx.drawImage(L.bridge.canvas, L.bridge.x - cx, -cy);
  ctx.save();
  ctx.translate(-cx, -cy);
  drawRubble(ctx, cityState, tick);
  drawProps(ctx, cam, tick, props, cityState, 'wall');
  drawTram(ctx, tick);
  ctx.restore();
  place(ctx, L.street, cam);
  ctx.save();
  ctx.translate(-cx, -cy);
  drawSteam(ctx, vents, tick, cam.x, cam.x + SCREEN_W);
  drawProps(ctx, cam, tick, props, cityState, 'street');
  ctx.restore();
}

/** 굴뚝 매연: 뭉게뭉게 솟아 바람에 오른쪽으로 흘러간다 (speed가 같은 겹의 굴뚝만) */
function drawSmoke(ctx: CanvasRenderingContext2D, cam: Cam, tick: number, speed: number): void {
  const [ox, oy] = off(cam, speed);
  const big = speed < 0.2;
  smokers.forEach((ch, ci) => {
    if (ch.speed !== speed) return;
    const x0 = ch.x - ox;
    if (x0 < -90 || x0 > SCREEN_W + 20) return;
    const life = big ? 260 : 200;
    for (let p = 0; p < 9; p++) {
      const age = (tick * 0.5 + p * (life / 9) + ci * 37) % life;
      const k = age / life;
      const x = x0 + ch.w / 2 + age * (big ? 0.35 : 0.45) + Math.sin((age + ci * 20) * 0.05) * 4;
      const y = ch.top - oy - 3 - age * (big ? 0.45 : 0.6);
      const r = (big ? 6 : 4) + k * (big ? 20 : 14);
      const level = Math.max(3, Math.round((big ? 10 : 13) * (1 - k)));
      disc(ctx, x, y, r, k < 0.5 ? C.smoke : C.smokeDark, level, ox);
    }
  });
}

/** 감시탑 서치라이트가 하늘을 천천히 훑는다 (디더링, 멀수록 옅게) */
function drawSearchlights(ctx: CanvasRenderingContext2D, cam: Cam, tick: number): void {
  const [ox, oy] = off(cam, D.mid.speed);
  lights.forEach((l, i) => {
    const angle = -Math.PI / 2 + 1.0 * Math.sin(tick * 0.011 + i * 2.1);
    beam(ctx, l.x - ox, l.y - oy, angle);
  });
}

function beam(ctx: CanvasRenderingContext2D, ox: number, oy: number, angle: number): void {
  const spread = 0.16;
  const length = 420;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  ctx.fillStyle = C.beam;
  const ex = ox + dx * length;
  const ey = oy + dy * length;
  const pad = length * Math.tan(spread) + 2;
  const x0 = Math.max(0, Math.floor(Math.min(ox, ex) - pad));
  const x1 = Math.min(SCREEN_W - 1, Math.ceil(Math.max(ox, ex) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(oy, ey) - pad));
  const y1 = Math.min(SCREEN_H - 1, Math.ceil(Math.max(oy, ey) + pad));
  if (x0 > x1 || y0 > y1) return;
  const t = Math.tan(spread);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const vx = x - ox;
      const vy = y - oy;
      const along = vx * dx + vy * dy;
      if (along <= 2 || along > length) continue;
      const across = Math.abs(-vx * dy + vy * dx);
      const half = along * t + 1;
      if (across > half) continue;
      const core = 1 - across / half;
      const level = Math.round((4 + 3 * core) * (1 - 0.6 * (along / length)));
      if (level > 0 && dither(x, y, level)) ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- 6. 앞겹 (캐릭터 앞)
let fgCanvas: HTMLCanvasElement | null = null;
let fgG: CanvasRenderingContext2D | null = null;
let hole: CanvasPattern | null = null;

/**
 * 카메라 앞을 스치는 어두운 실루엣 (가로등 기둥, 늘어진 전선, 철교 기둥, 공장 배관). 거리보다 빠르게 지나간다.
 * holes: 캐릭터가 있는 화면 사각형. 그 안은 바둑판 디더링으로 반쯤 지워 캐릭터가 비쳐 보이게 한다.
 */
export function drawForeground(ctx: CanvasRenderingContext2D, cam: Cam, holes: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = []): void {
  const F = D.fg;
  const s = F.speed;
  const ox = cam.x * s;
  const oy = cam.y * s;
  // 겹 바닥(캐릭터보다 카메라에 가까우므로 거리 바닥보다 아래)
  const base = layerH(s) - D.groundFromBottom + 40 - oy;
  const sx = (wx: number) => Math.round(toLayerX(s, wx) - ox);
  const visible = F.items.some((it) => {
    const a = sx(it.x);
    const b = sx((it as { to?: number }).to ?? it.x);
    return b > -60 && a < SCREEN_W + 60;
  });
  if (!visible) return;
  if (!fgCanvas) {
    [fgCanvas, fgG] = canvas(SCREEN_W, SCREEN_H);
    const [p, pg] = canvas(2, 2);
    pg.fillStyle = '#000';
    pg.fillRect(0, 0, 1, 1);
    pg.fillRect(1, 1, 1, 1);
    hole = fgG!.createPattern(p, 'repeat');
  }
  const g = fgG!;
  g.clearRect(0, 0, SCREEN_W, SCREEN_H);
  const dark = C.night;
  const edge = C.ironLight;
  for (const it of F.items) {
    const x = sx(it.x);
    switch (it.kind) {
      case 'post': {
        if (x < -40 || x > SCREEN_W + 40) break;
        const top = base - 330;
        rect(g, x - 4, top, 8, base - top, dark);
        rect(g, x + 3, top, 1, base - top, edge);
        rect(g, x - 6, base - 70, 12, 6, dark);
        rect(g, x - 2, top - 8, 4, 8, dark);
        rect(g, x - 26, top + 6, 26, 4, dark);
        rect(g, x - 30, top + 10, 10, 12, dark);
        rect(g, x - 28, top + 12, 6, 6, C.lampWarm);
        break;
      }
      case 'wire': {
        const x2 = sx((it as { to?: number }).to ?? it.x);
        if (x2 < -10 || x > SCREEN_W + 10) break;
        const top = base - 318;
        for (const [dy, sag] of [[0, 46], [10, 40]] as const) {
          for (let px = Math.max(-1, x); px <= Math.min(SCREEN_W, x2); px++) {
            const t = (px - x) / (x2 - x);
            rect(g, px, top + dy + Math.round(Math.sin(Math.PI * t) * sag), 1, 1, dark);
          }
        }
        break;
      }
      case 'pillar': {
        if (x < -60 || x > SCREEN_W + 60) break;
        const w = 26;
        rect(g, x - w / 2, -10, w, base + 10, dark);
        rect(g, x + w / 2 - 2, -10, 2, base + 10, edge);
        for (let ry = (base % 10) - 10; ry < base; ry += 10) {
          rect(g, x - w / 2 + 3, ry, 1, 1, edge);
          rect(g, x + w / 2 - 5, ry, 1, 1, edge);
        }
        rect(g, x - w / 2 - 6, base - 14, w + 12, 14, dark);
        // 위로 뻗는 무릎 받침
        const ky = base - 380;
        if (ky > -60) {
          for (let i = 0; i < 40; i++) {
            rect(g, x - w / 2 - i, ky - i, 4, 2, dark);
            rect(g, x + w / 2 + i - 4, ky - i, 4, 2, dark);
          }
        }
        break;
      }
      case 'pipe': {
        const x2 = sx((it as { to?: number }).to ?? it.x);
        if (x2 < -20 || x > SCREEN_W + 20) break;
        const py = base - 300;
        rect(g, x, py, x2 - x, 12, dark);
        rect(g, x, py, x2 - x, 1, edge);
        for (let fx = x + 20; fx < x2; fx += 60) rect(g, fx, py - 2, 5, 16, dark);
        rect(g, x - 6, py, 12, base - py, dark);
        rect(g, x + 5, py, 1, base - py, edge);
        break;
      }
    }
  }
  if (holes.length) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = hole!;
    for (const h of holes) g.fillRect(Math.round(h.x), Math.round(h.y), Math.round(h.w), Math.round(h.h));
    g.restore();
  }
  ctx.drawImage(fgCanvas!, 0, 0);
}

void layerGround;
