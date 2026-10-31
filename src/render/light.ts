import { MAP_H, MAP_W } from '../stage/citadel';
import { COLORS as C } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

/**
 * 빛 레이어 (렌더 전용, 기준: The Last Night). 도트 그림 위에 빛을 더해(가산 합성) 둘레를 물들인다.
 * 무대·물건·이펙트가 프레임마다 빛을 등록하고(월드 좌표), 캐릭터를 다 그린 뒤 한 번에 얹는다.
 * - 점 빛: 둥글게 번지는 빛 (가로등 머리, 네온, 창, 타격 불꽃)
 * - 원뿔 빛: 빛줄기 (가로등 아래로 쏟아지는 빛, 서치라이트, 등대)
 * 빛 레이어는 화면보다 작은 캔버스(반 해상도, 느리면 1/4)에 그리고 매끄럽게 키워 얹으므로 자연히 번진다.
 * 흐림과 팔레트 밖 색은 이 레이어에만 쓴다 (CLAUDE.md 색 규격).
 */
export interface PointLight {
  x: number;
  y: number;
  r: number;
  color: string;
  a: number;
  /** 붙박이 빛: 맵 전체 빛 그림에 한 번 구워 두고 매 프레임 따로 그리지 않는다 */
  baked: boolean;
}

export interface ConeLight {
  x: number;
  y: number;
  angle: number;
  length: number;
  /** 반쪽 벌어진 각 (라디안) */
  spread: number;
  color: string;
  a: number;
  baked: boolean;
}

export type Quality = 'high' | 'low';

class LightList {
  points: PointLight[] = [];
  cones: ConeLight[] = [];
  /** 이번 프레임 붙박이 빛들의 지문 (바뀌면 구워 둔 빛 그림을 다시 그린다: 창이 꺼지거나 새 판이 시작될 때) */
  bakedSig = 0;

  clear(): void {
    this.points.length = 0;
    this.cones.length = 0;
    this.bakedSig = 0;
  }

  /** baked: 붙박이 빛 (자리·색·세기가 늘 같은 빛) */
  point(x: number, y: number, r: number, color: string, a = 1, baked = false): void {
    if (a <= 0.01 || r <= 0) return;
    this.points.push({ x, y, r, color, a, baked });
    if (baked) this.bakedSig = (Math.imul(this.bakedSig, 31) + Math.round(x * 7 + y * 13 + r * 3 + a * 100)) | 0;
  }

  cone(x: number, y: number, angle: number, length: number, spread: number, color: string, a = 1, baked = false): void {
    if (a <= 0.01) return;
    this.cones.push({ x, y, angle, length, spread, color, a, baked });
    if (baked) this.bakedSig = (Math.imul(this.bakedSig, 31) + Math.round(x * 5 + y * 11 + length + angle * 100 + a * 100)) | 0;
  }
}

/** 이번 프레임의 빛 (월드 좌표). drawStage가 처음에 비우고, 무대·물건·이펙트가 채운다 */
export const lights = new LightList();

// ---------------------------------------------------------------- 품질 (느리면 빛 레이어 해상도를 낮춘다)
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const forced = params.get('quality') as Quality | null;
let level: Quality = forced === 'low' ? 'low' : 'high';
let frames = 0;
let spent = 0;
let ticksRun = 0;
let lastAt = -1;
let startAt = -1;

/** 지금 품질. ?quality=low|high로 고정할 수 있다 */
export const quality = (): Quality => level;

/** 확인용: 조명 부품을 끈다 (?nolight=1 빛 레이어, ?norain=1 비, ?norefl=1 반사, ?noair=1 안개, ?norim=1 테두리 빛) */
export const off = (part: 'light' | 'rain' | 'refl' | 'air' | 'rim'): boolean => params.get(`no${part}`) === '1';

/**
 * 화면 프레임마다 부른다 (ms: 그리는 데 걸린 시간, ticks: 이번 프레임에 돈 틱 수). 2초씩 모아서
 * 그리기가 평균 12ms를 넘거나(틱 계산과 브라우저 몫을 남겨야 한다), 프레임마다 틱이 평균 1.3개를 넘으면
 * (화면이 60프레임을 못 따라가 틱을 몰아 돌리는 중) 낮은 품질로 내린다. 시작 3초는 준비 중이라 보지 않는다. 고정했으면 그대로.
 */
export function measureFrame(ms: number, now: number, ticks = 1): void {
  if (forced) return;
  if (startAt < 0) startAt = lastAt = now;
  frames++;
  spent += ms;
  ticksRun += ticks;
  if (now - lastAt < 2000) return;
  const slow = spent / frames > 12 || ticksRun / frames > 1.3;
  if (now - startAt > 3000 && frames > 30 && slow && level === 'high') level = 'low';
  frames = 0;
  spent = 0;
  ticksRun = 0;
  lastAt = now;
}

// ---------------------------------------------------------------- 빛 그림 조각 (색마다 한 번 만들어 둔다)
const glowCache = new Map<string, HTMLCanvasElement>();
const coneCache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** 가운데가 진하고 둘레로 갈수록 빨리 옅어지는 둥근 빛 (지름 64) */
function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  const [cv, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, rgba(color, 1));
  grad.addColorStop(0.15, rgba(color, 0.7));
  grad.addColorStop(0.4, rgba(color, 0.25));
  grad.addColorStop(0.7, rgba(color, 0.07));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, cv);
  c = cv;
  return c;
}

/** 오른쪽으로 뻗는 원뿔 빛 (길이 128, 반쪽 각 0.5 라디안 기준). 뿌리가 밝고 끝으로 갈수록 옅다 */
function coneSprite(color: string): HTMLCanvasElement {
  let c = coneCache.get(color);
  if (c) return c;
  const [cv, g] = makeCanvas(128, 128);
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, rgba(color, 0.9));
  grad.addColorStop(0.35, rgba(color, 0.45));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 64);
  g.lineTo(128, 64 - 128 * Math.tan(0.5));
  g.lineTo(128, 64 + 128 * Math.tan(0.5));
  g.closePath();
  g.fill();
  // 가운데 줄기를 조금 더 밝게
  g.globalCompositeOperation = 'lighter';
  const core = g.createLinearGradient(0, 0, 128, 0);
  core.addColorStop(0, rgba(color, 0.5));
  core.addColorStop(1, rgba(color, 0));
  g.fillStyle = core;
  g.beginPath();
  g.moveTo(0, 64);
  g.lineTo(128, 64 - 128 * Math.tan(0.18));
  g.lineTo(128, 64 + 128 * Math.tan(0.18));
  g.closePath();
  g.fill();
  coneCache.set(color, cv);
  c = cv;
  return c;
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------- 얹기
let layer: HTMLCanvasElement | null = null;
let lg: CanvasRenderingContext2D | null = null;
let layerScale = 0;
/** 붙박이 빛만 그려 둔 맵 전체 빛 그림 (맵의 1/2 해상도, 검은 바탕) */
let bakedMap: HTMLCanvasElement | null = null;
let bakedSigBuilt: number | null = null;
const BAKE = 2;

function drawPoint(g: CanvasRenderingContext2D, p: PointLight, x: number, y: number, scale: number): void {
  g.globalAlpha = Math.min(1, p.a);
  g.drawImage(glowSprite(p.color), (x - p.r) / scale, (y - p.r) / scale, (p.r * 2) / scale, (p.r * 2) / scale);
}

/** 원뿔 빛: 조각을 돌리고 늘려 얹는다 (조각의 반쪽 각은 0.5라디안이라 원하는 각에 맞게 세로로 줄인다). 끝나면 변환을 되돌린다 */
function drawCone(g: CanvasRenderingContext2D, c: ConeLight, x: number, y: number, scale: number): void {
  const sx = c.length / 128 / scale;
  const sy = sx * (Math.tan(c.spread) / Math.tan(0.5));
  const cs = Math.cos(c.angle);
  const sn = Math.sin(c.angle);
  g.globalAlpha = Math.min(1, c.a);
  g.setTransform(cs * sx, sn * sx, -sn * sy, cs * sy, x / scale, y / scale);
  g.drawImage(coneSprite(c.color), 0, -64);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

/** 붙박이 빛을 맵 전체 빛 그림에 다시 굽는다 */
function bake(mapW: number, mapH: number): void {
  if (!bakedMap) [bakedMap] = makeCanvas(Math.ceil(mapW / BAKE), Math.ceil(mapH / BAKE));
  const g = bakedMap.getContext('2d')!;
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, bakedMap.width, bakedMap.height);
  g.globalCompositeOperation = 'lighter';
  g.imageSmoothingEnabled = true;
  for (const p of lights.points) if (p.baked) drawPoint(g, p, p.x, p.y, BAKE);
  for (const c of lights.cones) if (c.baked) drawCone(g, c, c.x, c.y, BAKE);
  g.globalAlpha = 1;
  bakedSigBuilt = lights.bakedSig;
}

/**
 * 모은 빛을 빛 레이어에 그려 화면에 더한다 (가산 합성). cam은 화면 왼쪽 위의 월드 좌표.
 * 붙박이 빛은 구워 둔 맵 빛 그림에서 화면 자리만 잘라 깔고, 움직이는 빛만 매 프레임 그린다.
 * 화면 흔들림처럼 ctx에 걸린 이동은 그대로 따른다.
 */
export function drawLights(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }): void {
  if (off('light')) return;
  const scale = level === 'high' ? 2 : 4;
  const lw = Math.ceil(SCREEN_W / scale);
  const lh = Math.ceil(SCREEN_H / scale);
  if (!layer || layerScale !== scale) {
    // 128×129칸보다 작은 캔버스는 브라우저가 그래픽 칩 밖에 둬서, 구워 둔 빛 그림(그래픽 칩)을 읽어 올 때 멈칫한다: 넉넉히 만들고 위쪽만 쓴다
    [layer, lg] = makeCanvas(lw, Math.max(lh, Math.ceil(16900 / lw)));
    layerScale = scale;
  }
  if (bakedSigBuilt !== lights.bakedSig) bake(MAP_W, MAP_H);
  const g = lg!;
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.imageSmoothingEnabled = true;
  g.fillStyle = '#000';
  g.fillRect(0, 0, lw, Math.min(layer.height, lh + 2));
  g.drawImage(bakedMap!, cam.x / BAKE, cam.y / BAKE, SCREEN_W / BAKE, SCREEN_H / BAKE, 0, 0, SCREEN_W / scale, SCREEN_H / scale);
  g.globalCompositeOperation = 'lighter';
  const W = SCREEN_W + 80;
  const H = SCREEN_H + 80;
  for (const p of lights.points) {
    if (p.baked) continue;
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    if (x + p.r < -40 || x - p.r > W || y + p.r < -40 || y - p.r > H) continue;
    drawPoint(g, p, x, y, scale);
  }
  for (const c of lights.cones) {
    if (c.baked) continue;
    const x = c.x - cam.x;
    const y = c.y - cam.y;
    const ex = x + Math.cos(c.angle) * c.length;
    const ey = y + Math.sin(c.angle) * c.length;
    if (Math.max(x, ex) < -200 || Math.min(x, ex) > W + 200 || Math.max(y, ey) < -200 || Math.min(y, ey) > H + 200) continue;
    drawCone(g, c, x, y, scale);
  }
  g.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(layer, 0, 0, lw, lh, 0, 0, lw * scale, lh * scale);
  ctx.restore();
}

/**
 * (x, y) 둘레에서 가장 센 빛: 색, 그 빛 쪽 방향(단위 벡터), 세기(0~1). 캐릭터 테두리 빛과 빗방울 반짝임에 쓴다.
 */
export function strongestLight(x: number, y: number): { color: string; dx: number; dy: number; k: number } | null {
  let best: { color: string; dx: number; dy: number; k: number } | null = null;
  for (const p of lights.points) {
    const dx = p.x - x;
    const dy = p.y - y;
    const reach = p.r * 1.3;
    if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
    const d = Math.hypot(dx, dy);
    if (d >= p.r * 1.3) continue;
    const k = p.a * (1 - d / (p.r * 1.3));
    if (!best || k > best.k) best = { color: p.color, dx: d > 0 ? dx / d : 0, dy: d > 0 ? dy / d : -1, k };
  }
  for (const c of lights.cones) {
    const vx = x - c.x;
    const vy = y - c.y;
    if (vx > c.length || vx < -c.length || vy > c.length || vy < -c.length) continue;
    const along = vx * Math.cos(c.angle) + vy * Math.sin(c.angle);
    if (along <= 0 || along > c.length) continue;
    const across = Math.abs(-vx * Math.sin(c.angle) + vy * Math.cos(c.angle));
    const half = along * Math.tan(c.spread) + 2;
    if (across > half) continue;
    const k = c.a * (1 - along / c.length) * (1 - across / half) * 0.9;
    const d = Math.hypot(vx, vy) || 1;
    if (!best || k > best.k) best = { color: c.color, dx: -vx / d, dy: -vy / d, k };
  }
  return best;
}

/** 밤 공기 색 (무대 전체에 곱하는 어둠): 푸르스름한 비 오는 밤 */
export const NIGHT = '#7d8ab0';
/** 먼 겹에 한 번 더 곱하는 어둠 (먼 겹일수록 어둡게) */
export const FAR_DARK = '#76809e';
/** 먼 겹을 덮는 안개 색 (도시 불빛을 받은 비구름) */
export const HAZE = '#3a3f58';
/** 수평선 쪽 도시 불빛 번짐 (가산) */
export const CITY_GLOW = '#5a3f62';
export { C as LIGHT_COLORS };
