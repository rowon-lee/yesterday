import type { CityState, SimState } from '../sim';
import { surfaceSolid } from '../sim/platforms';
import { GROUND, SURFACES } from '../stage/citadel';
import { COLORS as C } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

/**
 * 발판 보기 (확인용, 3D 화면 위 HUD 캔버스에 그린다): 중층(차양·비상계단·계단참)은 노랑, 옥상(지붕·테라스·기둥탑·등대)은 하늘색 줄.
 * 무너져 받쳐 주지 않는 자리는 그리지 않는다. cam: 화면 왼쪽 위의 월드 좌표 (정수 px)
 */
export function drawPlatforms(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, city: CityState | null): void {
  const state = { city } as unknown as SimState;
  for (const sf of SURFACES) {
    const y = GROUND - sf.h - Math.round(cam.y);
    if (y < -2 || y > SCREEN_H + 2) continue;
    ctx.fillStyle = sf.tier === 'mid' ? C.gold : C.sky;
    for (let x = sf.x0; x < sf.x1; x++) {
      const sx = x - Math.round(cam.x);
      if (sx < 0 || sx >= SCREEN_W) continue;
      if (city && !surfaceSolid(state, sf, x * 256 + 128)) continue;
      ctx.fillRect(sx, y, 1, 2);
    }
  }
}
