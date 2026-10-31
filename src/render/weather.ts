import { GROUND, SURFACES } from '../stage/citadel';
import { HAZE, lights, off, quality, rgba } from './light';
import { COLORS as C } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';
import { hash } from './stage/dither';

/**
 * 비 오는 밤의 공기 (렌더 전용, 기준: The Last Night).
 * - 젖은 바닥 반사: 바닥선 위 장면을 뒤집어 아래로, 줄마다 물결로 흔들고 흐리게. 웅덩이는 더 또렷하게
 * - 비: 먼·중간·가까운 세 겹 빗줄기. 빛 속을 지나는 빗줄기는 그 빛 색으로 반짝인다. 바닥과 발판에 튀는 물방울
 * - 빛 받은 안개와 빛 입자: 바닥에 깔린 옅은 안개, 빛줄기 속을 떠도는 반짝이
 * 비와 빛 입자는 틱만 보고 자리를 정한다 (같은 틱이면 같은 그림).
 */
/** 빗줄기 세 겹: 개수, 떨어지는 속도(px/틱), 길이, 카메라 따라 움직이는 비율, 색 */
const RAIN_LAYERS = [
  { n: 110, v: 5, len: 4, cam: 0.3, color: C.rain, spark: false },
  { n: 70, v: 8, len: 7, cam: 0.8, color: C.rain, spark: true },
  { n: 26, v: 12, len: 12, cam: 1.4, color: C.rainLight, spark: true },
] as const;
/** 바람에 날려 비스듬히 (가로/세로) */
const SLANT = 0.22;

/** 웅덩이 (월드 x 왼쪽, 폭): 더 또렷하게 비친다 */
const PUDDLES: ReadonlyArray<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let x = 90, k = 1; x < 3150; k++) {
    const w = 26 + Math.floor(hash(k * 41) * 50);
    out.push([x, w]);
    x += w + 60 + Math.floor(hash(k * 97) * 140);
  }
  return out;
})();

/**
 * 젖은 바닥 반사: 바닥선(GROUND) 위쪽 장면을 아래로 뒤집어 비춘다. 화면 그림을 그대로 쓰므로 빛·네온·캐릭터가 함께 비친다.
 * ctx에 걸린 이동(화면 흔들림)은 무시하고 화면 픽셀 기준으로 한다.
 */
let band: HTMLCanvasElement | null = null;
let refl: HTMLCanvasElement | null = null;

/**
 * 젖은 바닥 반사: 바닥선(GROUND) 위쪽 장면을 아래로 뒤집어 비춘다. 화면 그림을 그대로 쓰므로 빛·네온·캐릭터가 함께 비친다.
 * 1) 바닥선 위 띠를 한 번 떠 두고 2) 작은 캔버스에 줄마다 물결로 흔들어 뒤집어 그린 뒤 3) 화면에 두 번만 얹는다
 *    (바닥 전체에 옅게, 웅덩이 자리에 한 번 더). 화면 캔버스에 줄마다 직접 그리면 휴대폰에서 느리다.
 * ctx에 걸린 이동(화면 흔들림)은 무시하고 화면 픽셀 기준으로 한다.
 */
export function drawReflection(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, tick: number): void {
  if (off('refl')) return;
  const gy = Math.round(GROUND - cam.y);
  if (gy >= SCREEN_H || gy <= 0) return;
  const H = Math.min(SCREEN_H - gy, 30);
  const step = quality() === 'high' ? 1 : 2;
  const top = Math.max(0, gy - 46);
  if (!band || !refl) {
    // 둘 다 128×129칸보다 넓게: 브라우저가 작은 캔버스는 그래픽 칩 밖(CPU)에 두는데, 그러면 화면 그림을 읽어 올 때마다
    // 그래픽 칩을 기다려 휴대폰에서 멈칫한다 (반사에는 위 30줄만 쓴다)
    band = document.createElement('canvas');
    band.width = SCREEN_W;
    band.height = 46;
    refl = document.createElement('canvas');
    refl.width = SCREEN_W;
    refl.height = 40;
  }
  const bg = band.getContext('2d')!;
  bg.clearRect(0, 0, SCREEN_W, 46);
  bg.drawImage(ctx.canvas, 0, top, SCREEN_W, gy - top, 0, 46 - (gy - top), SCREEN_W, gy - top);
  const rg = refl.getContext('2d')!;
  rg.clearRect(0, 0, SCREEN_W, 30);
  for (let r = 0; r < H; r += step) {
    const sy = 45 - Math.floor(r * 1.5);
    if (sy < 46 - (gy - top)) break;
    const dx = Math.round(Math.sin(r * 0.9 + tick * 0.16) * (0.4 + r * 0.09));
    rg.globalAlpha = 1 - r / (H + 4);
    rg.drawImage(band, 0, sy, SCREEN_W, 1, dx, r, SCREEN_W, step);
  }
  rg.globalAlpha = 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.24;
  ctx.drawImage(refl, 0, 0, SCREEN_W, H, 0, gy, SCREEN_W, H);
  // 웅덩이: 그 자리만 한 번 더 비춰 또렷하게
  const visible = PUDDLES.filter(([x, w]) => x + w > cam.x && x < cam.x + SCREEN_W);
  if (visible.length) {
    ctx.beginPath();
    for (const [px, pw] of visible) ctx.rect(Math.round(px - cam.x), gy, pw, H);
    ctx.clip();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(refl, 0, 0, SCREEN_W, H, 0, gy, SCREEN_W, H);
  }
  ctx.restore();
}

/**
 * 화면을 16px 칸으로 나눠 칸마다 가장 센 빛 (빗줄기 반짝임). 빛마다 닿는 칸만 훑는다.
 * 세기가 0.18보다 약한 칸은 null.
 */
const CELL = 16;
const GRID_COLS = Math.ceil(SCREEN_W / CELL);
const GRID_ROWS = Math.ceil(SCREEN_H / CELL);
const gridK = new Float32Array(GRID_COLS * GRID_ROWS);
const gridColor: Array<string | null> = new Array(GRID_COLS * GRID_ROWS).fill(null);

function lightGrid(cam: { x: number; y: number }): Array<string | null> {
  gridK.fill(0.18);
  gridColor.fill(null);
  const mark = (c: number, r: number, k: number, color: string) => {
    const i = r * GRID_COLS + c;
    if (k > gridK[i]) {
      gridK[i] = k;
      gridColor[i] = color;
    }
  };
  const cells = (x0: number, y0: number, x1: number, y1: number, fn: (c: number, r: number, cx: number, cy: number) => void) => {
    const c0 = Math.max(0, Math.floor((x0 - cam.x) / CELL));
    const c1 = Math.min(GRID_COLS - 1, Math.floor((x1 - cam.x) / CELL));
    const r0 = Math.max(0, Math.floor((y0 - cam.y) / CELL));
    const r1 = Math.min(GRID_ROWS - 1, Math.floor((y1 - cam.y) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(c, r, cam.x + c * CELL + CELL / 2, cam.y + r * CELL + CELL / 2);
  };
  for (const p of lights.points) {
    const reach = p.r * 1.3;
    cells(p.x - reach, p.y - reach, p.x + reach, p.y + reach, (c, r, cx, cy) => {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < reach) mark(c, r, p.a * (1 - d / reach), p.color);
    });
  }
  for (const L of lights.cones) {
    const ca = Math.cos(L.angle);
    const sa = Math.sin(L.angle);
    const ex = L.x + ca * L.length;
    const ey = L.y + sa * L.length;
    const pad = L.length * Math.tan(L.spread) + 2;
    const tan = Math.tan(L.spread);
    cells(Math.min(L.x, ex) - pad, Math.min(L.y, ey) - pad, Math.max(L.x, ex) + pad, Math.max(L.y, ey) + pad, (c, r, cx, cy) => {
      const vx = cx - L.x;
      const vy = cy - L.y;
      const along = vx * ca + vy * sa;
      if (along <= 0 || along > L.length) return;
      const across = Math.abs(-vx * sa + vy * ca);
      const half = along * tan + 2;
      if (across > half) return;
      mark(c, r, L.a * (1 - along / L.length) * (1 - across / half) * 0.9, L.color);
    });
  }
  return gridColor;
}

/**
 * 비: 세 겹의 빗줄기와 튀는 물방울. 빛 속을 지나는 빗줄기는 그 빛 색으로 반짝인다.
 * 빗줄기는 세로 토막으로 나눠 색마다 모아 칠한다 (화면 크기 픽셀 버퍼를 매 프레임 올리는 것보다 휴대폰에서 가볍다).
 * 낮은 품질에서는 빗줄기를 절반만 그린다.
 */
const runs = new Map<string, number[]>();

export function drawRain(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, tick: number): void {
  if (off('rain')) return;
  for (const a of runs.values()) a.length = 0;
  const add = (color: string, x: number, y: number, h: number) => {
    let a = runs.get(color);
    if (!a) runs.set(color, (a = []));
    a.push(x, y, h);
  };
  const grid = lightGrid(cam);
  const half = quality() === 'low';
  RAIN_LAYERS.forEach((L, li) => {
    const n = half ? Math.ceil(L.n / 2) : L.n;
    const span = SCREEN_H + L.len + 20;
    for (let i = 0; i < n; i++) {
      const seed = li * 1000 + i;
      const y0 = hash(seed * 31 + 7) * span;
      const y = ((y0 + tick * L.v) % span) - L.len - 10;
      const x0 = hash(seed * 17 + 3) * (SCREEN_W + 60);
      const x = ((((x0 - cam.x * L.cam + y * SLANT) % (SCREEN_W + 60)) + SCREEN_W + 60) % (SCREEN_W + 60)) - 30;
      let color: string = L.color;
      if (L.spark) {
        const gc = Math.floor(x / CELL);
        const gr = Math.floor(y / CELL);
        const l = gc >= 0 && gc < GRID_COLS && gr >= 0 && gr < GRID_ROWS ? grid[gr * GRID_COLS + gc] : null;
        if (l) color = l;
      }
      // 비스듬한 빗줄기를 같은 x끼리 세로 토막으로
      const top = Math.round(y);
      let k0 = 0;
      let px0 = Math.round(x);
      for (let k = 1; k <= L.len; k++) {
        const px = k < L.len ? Math.round(x + k * SLANT) : NaN;
        if (px !== px0) {
          add(color, px0, top + k0, k - k0);
          k0 = k;
          px0 = px;
        }
      }
    }
  });
  // 바닥과 발판에 튀는 물방울 (셋 중 하나는 화면에 보이는 발판 위)
  const gy = Math.round(GROUND - cam.y);
  const tops = SURFACES.map((sf) => ({ y: Math.round(GROUND - sf.h - cam.y), x0: Math.round(sf.x0 - cam.x), x1: Math.round(sf.x1 - cam.x) }))
    .filter((t) => t.y > 1 && t.y < SCREEN_H && t.x1 > 0 && t.x0 < SCREEN_W);
  const frame = Math.floor(tick / 3);
  for (let i = 0; i < (half ? 10 : 22); i++) {
    let sx = Math.floor(hash(frame * 131 + i * 17) * SCREEN_W);
    let sy = gy - 1;
    if (tops.length && i % 3 === 0) {
      const t = tops[(frame + i) % tops.length];
      sy = t.y - 1;
      sx = Math.round(t.x0 + hash(i * 7 + frame) * (t.x1 - t.x0));
    }
    if (sy < 1 || sy >= SCREEN_H) continue;
    add(C.rainLight, sx, sy, 1);
    add(C.rainLight, sx - 1, sy - 1, 1);
    add(C.rainLight, sx + 1, sy - 1, 1);
  }
  for (const [color, a] of runs) {
    if (!a.length) continue;
    ctx.fillStyle = color;
    for (let i = 0; i < a.length; i += 3) ctx.fillRect(a[i], a[i + 1], 1, a[i + 2]);
  }
}

/**
 * 빛 받은 안개와 빛 입자: 바닥에 깔린 옅은 안개 띠(도시 불빛을 받아 밝다)와,
 * 가로등·서치라이트 빛줄기 속을 천천히 떠도는 반짝이.
 */
export function drawAir(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, tick: number): void {
  if (off('air')) return;
  const gy = GROUND - cam.y;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const mist = ctx.createLinearGradient(0, gy - 46, 0, gy + 12);
  mist.addColorStop(0, rgba(HAZE, 0));
  mist.addColorStop(0.7, rgba(HAZE, 0.32));
  mist.addColorStop(1, rgba(HAZE, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, gy - 46, SCREEN_W, 58);
  // 빛줄기 속 빛 입자
  for (const c of lights.cones) {
    if (c.length < 60 || c.length > 200) continue;
    const ox = c.x - cam.x;
    const oy = c.y - cam.y;
    if (ox < -80 || ox > SCREEN_W + 80 || oy < -80 || oy > SCREEN_H + 80) continue;
    ctx.fillStyle = rgba(c.color, 0.85);
    for (let k = 0; k < 6; k++) {
      const s = Math.floor(c.x * 7 + c.y * 13) + k * 101;
      const along = ((hash(s) * c.length + tick * (0.15 + hash(s + 1) * 0.2)) % c.length) + 6;
      const across = (hash(s + 2) - 0.5) * along * Math.tan(c.spread) * 1.6 + Math.sin(tick * 0.03 + k) * 2;
      const x = ox + Math.cos(c.angle) * along - Math.sin(c.angle) * across;
      const y = oy + Math.sin(c.angle) * along + Math.cos(c.angle) * across;
      if ((tick + k * 7) % 40 < 30) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  ctx.restore();
}
