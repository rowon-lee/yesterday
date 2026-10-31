import type { PropState } from '../../sim';
import { GROUND } from '../../stage/downtown';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { disc, dither } from './dither';
import {
  buildFactories, buildFront, buildMid, buildSky, buildSkyline, buildStreet, factoryChimneys, searchlights, type Layer,
} from './layers';
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
 * 첫 구역 '도심 대로'. 여러 겹이 카메라와 다른 속도로 움직인다 (먼 겹일수록 가로·세로 모두 느리게).
 * 고정된 겹은 처음 한 번 그려 두고, 매연·서치라이트·물건(가스등 불빛 등)은 매 틱 덧그린다. 모두 렌더 전용.
 */
let built: { sky: Layer; factories: Layer; skyline: Layer; mid: Layer; front: Layer; street: Layer } | null = null;
let chimneys: ReturnType<typeof factoryChimneys> = [];
let lights: ReturnType<typeof searchlights> = [];

function layers() {
  if (!built) {
    built = {
      sky: buildSky(),
      factories: buildFactories(),
      skyline: buildSkyline(),
      mid: buildMid(),
      front: buildFront(),
      street: buildStreet(),
    };
    chimneys = factoryChimneys();
    lights = searchlights();
  }
  return built;
}

/** 겹 좌표 → 화면 좌표의 이동량 */
const off = (cam: Cam, speed: number): [number, number] => [Math.round(cam.x * speed), Math.round(cam.y * speed)];

const place = (ctx: CanvasRenderingContext2D, l: Layer, cam: Cam) => {
  const [ox, oy] = off(cam, l.speed);
  ctx.drawImage(l.canvas, -ox, -oy);
};

/** 캐릭터 뒤에 그리는 무대 전부. props는 sim의 부서지는 물건 상태 (없으면 모두 멀쩡) */
export function drawStage(ctx: CanvasRenderingContext2D, cam: Cam, tick: number, props: readonly PropState[] | null = null): void {
  const L = layers();
  place(ctx, L.sky, cam);
  place(ctx, L.factories, cam);
  drawSmoke(ctx, cam, tick);
  place(ctx, L.skyline, cam);
  drawSearchlights(ctx, cam, tick);
  place(ctx, L.mid, cam);
  place(ctx, L.front, cam);
  place(ctx, L.street, cam);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawProps(ctx, cam, tick, props);
  ctx.restore();
}

/** 공장 굴뚝 매연: 뭉게뭉게 솟아 바람에 오른쪽으로 흘러간다 */
function drawSmoke(ctx: CanvasRenderingContext2D, cam: Cam, tick: number): void {
  const [ox, oy] = off(cam, D.factories.speed);
  chimneys.forEach((ch, ci) => {
    const x0 = ch.x - ox;
    if (x0 < -60 || x0 > SCREEN_W + 20) return;
    const life = 200;
    for (let p = 0; p < 8; p++) {
      const age = (tick * 0.6 + p * (life / 8) + ci * 37) % life;
      const k = age / life;
      const x = x0 + ch.w / 2 + age * 0.4 + Math.sin((age + ci * 20) * 0.06) * 3;
      const y = ch.top - oy - 3 - age * 0.55;
      const r = 4 + k * 12;
      const level = Math.max(3, Math.round(14 * (1 - k)));
      disc(ctx, x, y, r, k < 0.5 ? C.smoke : C.smokeDark, level, ox);
    }
  });
}

/** 감시탑 서치라이트 두 개가 하늘을 천천히 훑는다 (디더링, 멀수록 옅게) */
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
