import type { CityState, PropState } from '../../sim';
import { CityLayer, drawRubble } from './city';
import { GROUND, SURFACES } from '../../stage/citadel';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, rect } from './dither';
import {
  buildFar, buildFront, buildKeep, buildMid, buildSky, buildStreet, buildStructures, farLight, keepLights, keepRoofLights, layerH,
  lighthouseLamp, manholes, star, toLayerX, type Layer,
} from './layers';
import { drawBillboard, drawFountain, drawSteam, drawTram, Walkers } from './life';
import { rgba, ScreenBuffer } from './pixels';
import { drawProps } from './props';
import { CITADEL as D } from '../../data/stages/citadel';
import { surfaceSolid } from '../../sim/platforms';

/** 바닥 높이 (월드 y). 캐릭터 발밑(sim 높이 0)이 여기 닿는다 */
export const GROUND_Y = GROUND;

/** 카메라: 화면 왼쪽 위가 월드의 어디인지 (px) */
export interface Cam {
  x: number;
  y: number;
}

/**
 * 대련 무대 '시타델 1구역'. 6겹이 카메라와 다른 속도로 움직인다 (먼 겹일수록 가로·세로 모두 느리게):
 * 하늘과 바다 → 1구역 마천루 → 시타델 상층부 → 중간 건물 → 싸우는 거리 → 앞겹(drawForeground, 캐릭터 앞).
 * 고정된 겹은 처음 한 번 그려 두고, 서치라이트·등대·분수·전광판·전차·행인·증기·물건은 매 틱 덧그린다. 모두 렌더 전용.
 */
let built: {
  sky: Layer; far: Layer; keep: Layer; mid: Layer; front: Layer; street: Layer; structures: HTMLCanvasElement;
} | null = null;
let city: CityLayer | null = null;
let vents: Array<{ x: number; y: number }> = [];
const walkers = new Walkers();
const beams = new ScreenBuffer();
const BEAM = rgba(C.beam);

function layers() {
  if (!built) {
    built = {
      sky: buildSky(),
      far: buildFar(),
      keep: buildKeep(),
      mid: buildMid(),
      front: buildFront(),
      street: buildStreet(),
      structures: buildStructures(),
    };
    city = new CityLayer(built.front.canvas);
    vents = manholes();
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
  drawFarLight(ctx, cam, tick);
  place(ctx, L.far, cam);
  place(ctx, L.keep, cam);
  // 시타델 상층부 서치라이트 (먼 하늘을 천천히 쓴다)
  beams.clear();
  const [kx, ky] = off(cam, D.keep.speed);
  keepLights().forEach((l, i) => beams.beam(l.x - kx, l.y - ky, -Math.PI / 2 + 0.9 * Math.sin(tick * 0.009 + i * 2.4), 380, BEAM, 0.8));
  beams.flush(ctx);
  place(ctx, L.mid, cam);
  walkers.step(tick, cam.x, focusX);
  walkers.draw(ctx, cam);
  // 길가 건물 정면 (부서진 덩어리만 고쳐 그린 그림)과 부서지지 않는 장치 (부두·본관·공원)
  city!.update(cityState);
  const cx = Math.round(cam.x);
  const cy = Math.round(cam.y);
  ctx.drawImage(city!.canvas, -cx, -cy);
  ctx.drawImage(L.structures, -cx, -cy);
  // 본관 지붕 서치라이트와 등대 빛줄기
  beams.clear();
  keepRoofLights().forEach((l, i) => beams.beam(l.x - cx, l.y - cy, -Math.PI / 2 + 0.7 * Math.sin(tick * 0.013 + i * 1.7), 420, BEAM));
  const lh = lighthouseLamp();
  beams.beam(lh.x - cx, lh.y - cy, Math.PI + 0.35 + 0.55 * Math.sin(tick * 0.02), 360, BEAM, 0.9);
  beams.flush(ctx);
  ctx.save();
  ctx.translate(-cx, -cy);
  drawFountain(ctx, tick);
  drawBillboard(ctx, tick, cityState);
  drawRubble(ctx, cityState, tick);
  drawProps(ctx, cam, tick, props, cityState, 'wall');
  // 노면전차: 선로 구간 밖은 잘라 낸다 (양 끝은 컨테이너 더미와 광장 문기둥에 가려진다)
  ctx.save();
  ctx.beginPath();
  ctx.rect(D.tram.x0, 0, D.tram.x1 - D.tram.x0, GROUND + 30);
  ctx.clip();
  drawTram(ctx, tick);
  ctx.restore();
  ctx.restore();
  place(ctx, L.street, cam);
  ctx.save();
  ctx.translate(-cx, -cy);
  drawSteam(ctx, vents, tick, cam.x, cam.x + SCREEN_W);
  drawProps(ctx, cam, tick, props, cityState, 'street');
  ctx.restore();
}

/** 멀리 바다 위 등대 불빛: 몇 초마다 두 번 깜빡인다 */
function drawFarLight(ctx: CanvasRenderingContext2D, cam: Cam, tick: number): void {
  const [ox, oy] = off(cam, D.sky.speed);
  const p = farLight();
  const t = tick % D.sky.farLight.every;
  if (t > 16 && (t < 24 || t > 30) && t < 38) return;
  const x = p.x - ox;
  const y = p.y - oy;
  if (x < -10 || x > SCREEN_W + 10) return;
  disc(ctx, x, y, 4, C.lampWarm, 6);
  rect(ctx, x - 1, y - 1, 2, 2, C.lampCore);
}

/**
 * 발판 보기 (확인용): 중층(차양·비상계단·계단참)은 노랑, 옥상(지붕·테라스·기둥탑·등대)은 하늘색 줄.
 * 무너져 받쳐 주지 않는 자리는 그리지 않는다.
 */
export function drawPlatforms(ctx: CanvasRenderingContext2D, cam: Cam, cityState: CityState | null): void {
  const state = { city: cityState } as unknown as Parameters<typeof surfaceSolid>[0];
  for (const sf of SURFACES) {
    const y = GROUND - sf.h - Math.round(cam.y);
    if (y < -2 || y > SCREEN_H + 2) continue;
    ctx.fillStyle = sf.tier === 'mid' ? C.gold : C.sky;
    for (let x = sf.x0; x < sf.x1; x++) {
      const sx = x - Math.round(cam.x);
      if (sx < 0 || sx >= SCREEN_W) continue;
      if (cityState && !surfaceSolid(state, sf, x * 256 + 128)) continue;
      ctx.fillRect(sx, y, 1, 2);
    }
  }
}

// ---------------------------------------------------------------- 6. 앞겹 (캐릭터 앞)
let fgCanvas: HTMLCanvasElement | null = null;
let fgG: CanvasRenderingContext2D | null = null;
let hole: CanvasPattern | null = null;

/**
 * 카메라 앞을 스치는 어두운 실루엣 (가로등 기둥, 늘어진 전선, 깃대와 깃발). 거리보다 빠르게 지나간다.
 * holes: 캐릭터가 있는 화면 사각형. 그 안은 바둑판 디더링으로 반쯤 지워 캐릭터가 비쳐 보이게 한다.
 */
export function drawForeground(ctx: CanvasRenderingContext2D, cam: Cam, holes: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = []): void {
  const F = D.fg;
  const s = F.speed;
  const ox = cam.x * s;
  const oy = cam.y * s;
  // 겹 바닥 (캐릭터보다 카메라에 가까우므로 거리 바닥보다 아래)
  const base = layerH(s) - D.groundFromBottom + 40 - oy;
  const sx = (wx: number) => Math.round(toLayerX(s, wx) - ox);
  const visible = F.items.some((it) => {
    const a = sx(it.x);
    const b = sx((it as { to?: number }).to ?? it.x);
    return b > -80 && a < SCREEN_W + 80;
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
      case 'flag': {
        // 높은 깃대와 크게 늘어진 붉은 깃발 (어둡게)
        if (x < -80 || x > SCREEN_W + 40) break;
        const top = base - 380;
        rect(g, x - 3, top, 6, base - top, dark);
        rect(g, x + 2, top, 1, base - top, edge);
        rect(g, x - 5, top - 8, 10, 8, dark);
        const fy = top + 20;
        for (let i = 0; i < 60; i++) {
          const wave = Math.round(Math.sin(i * 0.12) * 3);
          rect(g, x + 3 + i, fy + wave, 1, 90 - Math.floor(i / 4), C.posterRedDark);
        }
        star(g, x + 30, fy + 34, 3, dark);
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
