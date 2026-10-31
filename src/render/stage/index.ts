import { DOWNTOWN as D } from '../../data/stages/downtown';
import { COLORS as C } from '../palette';
import { SCREEN_W } from '../screen';
import { disc, dither, hash, rect } from './dither';
import {
  buildFactories, buildFront, buildMid, buildSky, buildSkyline, buildStreet, LAMP_TOP, SEARCHLIGHT, type Layer,
} from './layers';

/** 바닥 높이 (화면 y). 캐릭터 발밑이 여기 닿는다. */
export const GROUND_Y = D.ground;

/**
 * 첫 구역 '도심 대로'. 여러 겹이 카메라와 다른 속도로 움직인다 (먼 겹일수록 느리게).
 * 고정된 겹은 처음 한 번 그려 두고, 매연·서치라이트·가스등 불빛은 매 틱 덧그린다. 모두 렌더 전용.
 */
let built: { sky: Layer; factories: Layer; skyline: Layer; mid: Layer; front: Layer; street: Layer } | null = null;

function layers() {
  built ??= {
    sky: buildSky(),
    factories: buildFactories(),
    skyline: buildSkyline(),
    mid: buildMid(),
    front: buildFront(),
    street: buildStreet(),
  };
  return built;
}

const place = (ctx: CanvasRenderingContext2D, l: Layer, camX: number) =>
  ctx.drawImage(l.canvas, -Math.round(camX * l.speed), 0);

/** 캐릭터 뒤에 그리는 무대 전부. camX는 카메라 왼쪽 끝 (px), tick은 움직임용 */
export function drawStage(ctx: CanvasRenderingContext2D, camX: number, tick: number): void {
  const L = layers();
  place(ctx, L.sky, camX);
  place(ctx, L.factories, camX);
  drawSmoke(ctx, camX, tick);
  place(ctx, L.skyline, camX);
  drawSearchlight(ctx, camX, tick);
  place(ctx, L.mid, camX);
  place(ctx, L.front, camX);
  place(ctx, L.street, camX);
  drawLamps(ctx, camX, tick);
}

/** 공장 굴뚝 매연: 뭉게뭉게 솟아 바람에 오른쪽으로 흘러간다 */
function drawSmoke(ctx: CanvasRenderingContext2D, camX: number, tick: number): void {
  const F = D.factories;
  const off = Math.round(camX * F.speed);
  F.chimneys.forEach((ch, ci) => {
    const life = 150;
    for (let p = 0; p < 7; p++) {
      const age = (tick * 0.6 + p * (life / 7) + ci * 37) % life;
      const k = age / life;
      const x = ch.x + ch.w / 2 + age * 0.35 + Math.sin((age + ci * 20) * 0.08) * 2 - off;
      const y = ch.top - 2 - age * 0.45;
      const r = 3 + k * 9;
      const level = Math.max(3, Math.round(14 * (1 - k)));
      disc(ctx, x, y, r, k < 0.5 ? C.smoke : C.smokeDark, level, off);
    }
  });
}

/** 감시탑 서치라이트: 하늘을 천천히 훑는 빛줄기 (디더링, 멀수록 옅게) */
function drawSearchlight(ctx: CanvasRenderingContext2D, camX: number, tick: number): void {
  const ox = SEARCHLIGHT.x - Math.round(camX * D.mid.speed);
  const oy = SEARCHLIGHT.y;
  // 위쪽을 기준으로 좌우 약 60°씩 오가며 하늘을 훑는다
  const angle = -Math.PI / 2 + 1.05 * Math.sin(tick * 0.012);
  const spread = 0.2;
  const length = 230;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  ctx.fillStyle = C.beam;
  // 빛줄기를 감싸는 상자만 훑는다
  const ex = ox + dx * length;
  const ey = oy + dy * length;
  const pad = length * Math.tan(spread) + 2;
  const x0 = Math.max(0, Math.floor(Math.min(ox, ex) - pad));
  const x1 = Math.min(SCREEN_W - 1, Math.ceil(Math.max(ox, ex) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(oy, ey) - pad));
  const y1 = Math.ceil(Math.max(oy, ey) + pad);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const vx = x - ox;
      const vy = y - oy;
      const along = vx * dx + vy * dy;
      if (along <= 2 || along > length) continue;
      const across = Math.abs(-vx * dy + vy * dx);
      const half = along * Math.tan(spread) + 1;
      if (across > half) continue;
      // 가운데가 진하고 끝으로 갈수록, 멀수록 옅다
      const core = 1 - across / half;
      const level = Math.round((4 + 3 * core) * (1 - 0.55 * (along / length)));
      if (level > 0 && dither(x, y, level)) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** 가스등 불빛: 등 둘레의 은은한 빛과 바닥에 떨어진 빛 웅덩이. 가끔 깜빡인다 */
function drawLamps(ctx: CanvasRenderingContext2D, camX: number, tick: number): void {
  const cam = Math.round(camX);
  D.street.lamps.forEach((lx, i) => {
    const x = lx - cam;
    if (x < -40 || x > SCREEN_W + 40) return;
    const flicker = hash((tick >> 3) * 31 + i * 7) < 0.08 ? -1 : 0;
    const cy = LAMP_TOP + 4;
    // 빛 무리: 바깥은 아주 옅게
    for (const [r, level] of [[12 + flicker, 2], [8 + flicker, 4], [5, 7]] as const) {
      ctx.fillStyle = C.lampWarm;
      for (let y = -r; y <= r; y++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + y * y > r * r) continue;
          const px = x + dx;
          const py = cy + y;
          if (dither(px + cam, py, level)) ctx.fillRect(px, py, 1, 1);
        }
      }
    }
    rect(ctx, x - 2, LAMP_TOP + 1, 5, 6, C.lampGlow);
    rect(ctx, x - 1, LAMP_TOP + 2, 3, 3, C.lampCore);
    // 보도에 떨어진 빛 웅덩이
    ctx.fillStyle = C.lampWarm;
    for (let y = 0; y < 6; y++) {
      const half = 16 - y;
      for (let dx = -half; dx <= half; dx++) {
        const level = Math.round(5 * (1 - Math.abs(dx) / (half + 1)));
        if (dither(x + dx + cam, D.ground + y, level)) ctx.fillRect(x + dx, D.ground + y, 1, 1);
      }
    }
  });
}
