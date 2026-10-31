import type { CityState, PropState } from '../../sim';
import { CityLayer, drawRubble } from './city';
import { chunkIndex, frontBuildings, GRIDS, GROUND, MAP_H, SURFACES } from '../../stage/citadel';
import { CITY_GLOW, FAR_DARK, HAZE, lights, NIGHT } from '../light';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, discFast, rect } from './dither';
import {
  buildFar, buildFront, buildKeep, buildMid, buildSky, buildStreet, buildStructures, farChimneys, farLight, keepLights, keepRoofLights,
  layerH, lighthouseLamp, LIT_WINDOWS, manholes, midGround, star, toLayerX, type Layer,
} from './layers';
import { drawFountain, drawSteam, drawTram, Walkers } from './life';
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

function layers() {
  if (!built) {
    built = {
      sky: bakeDepth(buildSky()),
      far: bakeDepth(buildFar()),
      keep: bakeDepth(buildKeep()),
      mid: bakeDepth(buildMid()),
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
 * 조명: 이번 프레임의 빛 목록을 비우고 무대의 빛(가로등·네온·창·서치라이트…)을 채운다. 먼 겹은 한 번 더 어둡게 하고 안개로 덮고,
 * 마지막에 무대 전체에 밤 색을 곱한다. 빛은 캐릭터까지 그린 뒤 drawLights로 한 번에 더한다.
 */
export function drawStage(
  ctx: CanvasRenderingContext2D, cam: Cam, tick: number, props: readonly PropState[] | null = null, cityState: CityState | null = null,
  focusX: number | null = null,
): void {
  const L = layers();
  lights.clear();
  place(ctx, L.sky, cam);
  drawFarLight(ctx, cam, tick);
  place(ctx, L.far, cam);
  drawFarSmoke(ctx, cam, tick);
  place(ctx, L.keep, cam);
  // 시타델 상층부 서치라이트 (먼 하늘을 천천히 쓴다): 겹 좌표 → 월드 좌표
  const ks = D.keep.speed;
  keepLights().forEach((l, i) => {
    lights.cone(l.x + cam.x * (1 - ks), l.y + cam.y * (1 - ks), -Math.PI / 2 + 0.9 * Math.sin(tick * 0.009 + i * 2.4), 380, 0.1, C.beam, 0.4);
  });
  place(ctx, L.mid, cam);
  walkers.step(tick, cam.x, focusX);
  walkers.draw(ctx, cam, depthTone(C.night, D.mid.speed, midGround()));
  // 길가 건물 정면 (부서진 덩어리만 고쳐 그린 그림)과 부서지지 않는 장치 (부두·본관·공원)
  city!.update(cityState);
  const cx = Math.round(cam.x);
  const cy = Math.round(cam.y);
  ctx.drawImage(city!.canvas, -cx, -cy);
  ctx.drawImage(L.structures, -cx, -cy);
  // 본관 지붕 서치라이트와 등대 빛줄기, 붙박이 불빛
  keepRoofLights().forEach((l, i) => lights.cone(l.x, l.y, -Math.PI / 2 + 0.7 * Math.sin(tick * 0.013 + i * 1.7), 420, 0.11, C.beam, 0.5));
  const lh = lighthouseLamp();
  lights.cone(lh.x, lh.y, Math.PI + 0.35 + 0.55 * Math.sin(tick * 0.02), 360, 0.12, C.beam, 0.55);
  lights.point(lh.x, lh.y, 44, C.lampGlow, 0.9);
  fixedLights(tick, cityState);
  ctx.save();
  ctx.translate(-cx, -cy);
  drawFountain(ctx, tick);
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
  // 비 오는 밤: 무대 전체에 푸르스름한 밤 색을 곱한다 (캐릭터는 이 뒤에 그려 또렷하게 남는다)
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = NIGHT;
  ctx.fillRect(-20, -20, SCREEN_W + 40, SCREEN_H + 40);
  ctx.restore();
}

/**
 * 원근 (먼 겹은 흐릿하고 어둡게): 먼 겹에 한 번 더 어둠을 곱하고, 비구름 안개로 덮고, 수평선 쪽에 도시 불빛이 번진다.
 * 매 프레임 화면 전체에 덧칠하면 휴대폰에서 무거워서, 먼 겹 그림(하늘·마천루·상층부·가운데 건물)에 처음 한 번 구워 둔다.
 * 안개 농도는 카메라가 바닥에 있을 때의 화면 높이로 정한다 (카메라가 오르면 안개도 겹과 함께 움직인다).
 * 빛 레이어 몫(어둠·빛 받은 안개)이라 팔레트 밖 색이 생겨도 된다 (CLAUDE.md 색 규격).
 */
const REST_Y = MAP_H - SCREEN_H;
const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

/** 화면 높이 sy(카메라가 바닥에 있을 때)의 안개 농도와 도시 불빛 세기 */
function depthAt(sy: number): [number, number] {
  const gy = GROUND - REST_Y;
  const t = (sy - (gy - 260)) / 260;
  const fog = t <= 0 ? 0.15 : t >= 1 ? 0.5 : t < 0.6 ? 0.15 + 0.23 * (t / 0.6) : 0.38 + 0.12 * ((t - 0.6) / 0.4);
  const u = (sy - (gy - 200)) / 200;
  const glow = sy > gy + 20 || u <= 0 ? 0 : Math.min(1, u) * 0.35;
  return [fog, glow];
}

/** 겹 높이 ly의 줄에 쓰는 색 변환: 새 색 = 원래 색 × k + b (채널마다) */
function depthRow(speed: number, ly: number): { k: number[]; b: number[] } {
  const [fa, ga] = depthAt(ly - Math.round(REST_Y * speed));
  const M = hexRgb(FAR_DARK);
  const H = hexRgb(HAZE);
  const G = hexRgb(CITY_GLOW);
  return { k: M.map((m) => (m / 255) * (1 - fa)), b: H.map((h, i) => h * fa + G[i] * ga) };
}

function bakeDepth(l: Layer): Layer {
  const g = l.canvas.getContext('2d')!;
  const { width: w, height: h } = l.canvas;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const { k, b } = depthRow(l.speed, y);
    for (let x = 0, p = y * w * 4; x < w; x++, p += 4) {
      if (d[p + 3] === 0) continue;
      d[p] = Math.min(255, Math.round(d[p] * k[0] + b[0]));
      d[p + 1] = Math.min(255, Math.round(d[p + 1] * k[1] + b[1]));
      d[p + 2] = Math.min(255, Math.round(d[p + 2] * k[2] + b[2]));
    }
  }
  g.putImageData(img, 0, 0);
  return l;
}

const toneCache = new Map<string, string>();

/** 먼 겹 높이 ly에 매 프레임 덧그리는 것(행인·매연·등대 불빛)의 색: 구워 둔 겹과 같은 원근을 입힌다 */
function depthTone(hex: string, speed: number, ly: number): string {
  const key = `${hex}|${speed}|${Math.round(ly)}`;
  let t = toneCache.get(key);
  if (!t) {
    const { k, b } = depthRow(speed, ly);
    const c = hexRgb(hex).map((v, i) => Math.min(255, Math.round(v * k[i] + b[i])));
    t = `#${((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1)}`;
    toneCache.set(key, t);
  }
  return t;
}

/** 공장 굴뚝 매연 (먼 겹): 뭉게뭉게 솟아 바람에 흘러간다 (도트 디더링) */
function drawFarSmoke(ctx: CanvasRenderingContext2D, cam: Cam, tick: number): void {
  const [ox, oy] = off(cam, D.far.speed);
  farChimneys().forEach((ch, ci) => {
    const x0 = ch.x - ox;
    if (x0 < -90 || x0 > SCREEN_W + 20) return;
    const life = 260;
    for (let p = 0; p < 9; p++) {
      const age = (tick * 0.5 + p * (life / 9) + ci * 37) % life;
      const k = age / life;
      const x = x0 + ch.w / 2 + age * 0.35 + Math.sin((age + ci * 20) * 0.05) * 4;
      const y = ch.top - oy - 3 - age * 0.45;
      const color = depthTone(k < 0.5 ? C.smoke : C.smokeDark, D.far.speed, ch.top - 40);
      discFast(ctx, x, y, 6 + k * 20, color, Math.max(3, Math.round(10 * (1 - k))));
    }
  });
}

/** 붙박이 불빛: 정문 등, 광장 문기둥 등, 검문소 창과 경광등, 분수 물빛, 극장 로비, 불 켜진 창 (무너진 자리의 창은 꺼진다) */
function fixedLights(tick: number, cityState: CityState | null): void {
  const P = D.plaza;
  const Lg = P.landing;
  const gx = Math.round((Lg.x0 + Lg.x1 - P.gate.w) / 2);
  const ly = GROUND - Lg.h;
  for (const x of [gx - 18, gx + P.gate.w + 18]) lights.point(x, ly - 64, 44, C.lampWarm, 0.85, true);
  for (const px of P.gatePiers) lights.point(px + 16, GROUND - 130, 50, C.lampGlow, 0.85, true);
  const CP = P.checkpoint;
  lights.point(CP.x + CP.w / 2, GROUND - CP.h + 14, 34, C.windowLit, 0.6, true);
  if (tick % 40 < 20) lights.point(CP.x + CP.w / 2, GROUND - CP.h - 6, 30, C.neonRed, 0.9);
  lights.point(P.fountain.x, GROUND - 26, 70, C.sky, 0.22, true);
  // 본관 투광등: 기둥탑과 양쪽 날개 밑에서 위로 쏘는 차가운 빛, 정면 대형 간판 조명
  for (const t of P.towers) lights.cone(t.x + P.tower.w / 2, GROUND - 2, -Math.PI / 2, 300, 0.16, C.beam, 0.42, true);
  for (const x of [P.keep.x0 + 70, P.keep.x1 - 70]) lights.cone(x, GROUND - 2, -Math.PI / 2, 240, 0.22, C.skyLight, 0.22, true);
  lights.point((P.towers[0].x + P.towers[1].x + P.tower.w) / 2, GROUND - P.sign.h, 110, C.lampGlow, 0.35, true);
  const solid = (bi: number, x: number, y: number) => {
    if (!cityState) return true;
    const g = GRIDS[bi];
    const c = Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.x) / 16)));
    const r = Math.max(0, Math.min(g.rows - 1, Math.floor((GROUND - y) / 16)));
    return cityState.hp[chunkIndex(g, c, r)] >= 0;
  };
  frontBuildings().forEach((b, bi) => {
    if (b.kind === 'theater' && solid(bi, b.x + b.w / 2, GROUND - 30)) lights.point(b.x + b.w / 2, GROUND - 30, 70, C.windowLit, 0.55, true);
  });
  for (const w of LIT_WINDOWS) if (solid(w.bi, w.x, w.y)) lights.point(w.x, w.y, 22, C.windowLit, 0.45, true);
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
  disc(ctx, x, y, 4, depthTone(C.lampWarm, D.sky.speed, p.y), 6);
  rect(ctx, x - 1, y - 1, 2, 2, depthTone(C.lampCore, D.sky.speed, p.y));
  lights.point(x + cam.x, y + cam.y, 26, C.lampGlow, 0.8);
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

/** 앞겹 물건 그림 (물건마다 한 번 그려 둔다). ax, ay: 물건 기준점(겹 x, 겹 바닥)이 그림의 어디인지 */
interface FgSprite {
  c: HTMLCanvasElement;
  ax: number;
  ay: number;
}
const fgSprites = new Map<number, FgSprite>();

function fgSprite(i: number): FgSprite {
  let sp = fgSprites.get(i);
  if (sp) return sp;
  const F = D.fg;
  const it = F.items[i];
  const s = F.speed;
  const dark = C.night;
  const edge = C.ironLight;
  let c: HTMLCanvasElement;
  let g: CanvasRenderingContext2D;
  switch (it.kind) {
    case 'post': {
      // 가로등 기둥 (기준점: 기둥 가운데, 겹 바닥)
      [c, g] = canvas(40, 342);
      sp = { c, ax: 32, ay: 340 };
      g.translate(sp.ax, sp.ay);
      const top = -330;
      rect(g, -4, top, 8, -top, dark);
      rect(g, 3, top, 1, -top, edge);
      rect(g, -6, -70, 12, 6, dark);
      rect(g, -2, top - 8, 4, 8, dark);
      rect(g, -26, top + 6, 26, 4, dark);
      rect(g, -30, top + 10, 10, 12, dark);
      rect(g, -28, top + 12, 6, 6, C.lampWarm);
      break;
    }
    case 'wire': {
      // 다음 기둥까지 늘어진 전선 두 가닥 (기준점: 왼쪽 기둥, 겹 바닥)
      const w = Math.round(toLayerX(s, (it as { to?: number }).to ?? it.x) - toLayerX(s, it.x));
      [c, g] = canvas(w + 3, 62);
      sp = { c, ax: 1, ay: 320 };
      g.translate(sp.ax, sp.ay);
      const top = -318;
      for (const [dy, sag] of [[0, 46], [10, 40]] as const) {
        for (let px = 0; px <= w; px++) rect(g, px, top + dy + Math.round(Math.sin((Math.PI * px) / w) * sag), 1, 1, dark);
      }
      break;
    }
    default: {
      // 높은 깃대와 크게 늘어진 붉은 깃발 (어둡게) (기준점: 깃대 가운데, 겹 바닥)
      [c, g] = canvas(72, 392);
      sp = { c, ax: 6, ay: 390 };
      g.translate(sp.ax, sp.ay);
      const top = -380;
      rect(g, -3, top, 6, -top, dark);
      rect(g, 2, top, 1, -top, edge);
      rect(g, -5, top - 8, 10, 8, dark);
      const fy = top + 20;
      for (let k = 0; k < 60; k++) {
        const wave = Math.round(Math.sin(k * 0.12) * 3);
        rect(g, 3 + k, fy + wave, 1, 90 - Math.floor(k / 4), C.posterRedDark);
      }
      star(g, 30, fy + 34, 3, dark);
      break;
    }
  }
  fgSprites.set(i, sp);
  return sp;
}

/**
 * 카메라 앞을 스치는 어두운 실루엣 (가로등 기둥, 늘어진 전선, 깃대와 깃발). 거리보다 빠르게 지나간다.
 * holes: 캐릭터가 있는 화면 사각형. 그 안은 바둑판 디더링으로 반쯤 지워 캐릭터가 비쳐 보이게 한다.
 * 물건마다 그려 둔 그림을 얹고, 캐릭터와 겹치는 물건만 작업 캔버스에서 구멍을 낸 뒤 얹는다.
 */
export function drawForeground(ctx: CanvasRenderingContext2D, cam: Cam, holes: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = []): void {
  const F = D.fg;
  const s = F.speed;
  const ox = cam.x * s;
  const oy = cam.y * s;
  // 겹 바닥 (캐릭터보다 카메라에 가까우므로 거리 바닥보다 아래)
  const base = Math.round(layerH(s) - D.groundFromBottom + 40 - oy);
  F.items.forEach((it, i) => {
    const x = Math.round(toLayerX(s, it.x) - ox);
    const sp = fgSprite(i);
    const left = x - sp.ax;
    const top = base - sp.ay;
    const w = sp.c.width;
    const h = sp.c.height;
    if (left + w < 0 || left > SCREEN_W || top + h < 0 || top > SCREEN_H) return;
    const hit = holes.filter((hb) => hb.x < left + w && hb.x + hb.w > left && hb.y < top + h && hb.y + hb.h > top);
    if (!hit.length) {
      ctx.drawImage(sp.c, left, top);
      return;
    }
    if (!fgCanvas) {
      [fgCanvas, fgG] = canvas(SCREEN_W, SCREEN_H);
      const [p, pg] = canvas(2, 2);
      pg.fillStyle = '#000';
      pg.fillRect(0, 0, 1, 1);
      pg.fillRect(1, 1, 1, 1);
      hole = fgG!.createPattern(p, 'repeat');
    }
    // 화면에 보이는 부분만 작업 캔버스로 옮겨 구멍을 낸다
    const x0 = Math.max(0, left);
    const y0 = Math.max(0, top);
    const x1 = Math.min(SCREEN_W, left + w);
    const y1 = Math.min(SCREEN_H, top + h);
    const g = fgG!;
    g.clearRect(x0, y0, x1 - x0, y1 - y0);
    g.drawImage(sp.c, left, top);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = hole!;
    for (const hb of hit) g.fillRect(Math.round(hb.x), Math.round(hb.y), Math.round(hb.w), Math.round(hb.h));
    g.restore();
    ctx.drawImage(fgCanvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  });
}
