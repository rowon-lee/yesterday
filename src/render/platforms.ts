import type { SimState } from '../sim';
import { surfaceSolid, surfacesOf, wallsOf, wallSolid } from '../sim/platforms';
import { GROUND } from '../stage/citadel';
import { COLORS as C } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

/**
 * 발판과 벽 보기 (확인용, 3D 화면 위 HUD 캔버스에 그린다): 중층 발판(차양·비상계단·계단참·컨테이너·뒤집힌 전차·잔해 더미)은 노랑,
 * 옥상(지붕·테라스·기둥탑·등대 둘레·급수탑)은 하늘색 줄, 벽 기동에 쓰는 벽은 분홍 세로줄 (맵 끝 벽은 빨강).
 * 지금 받쳐 주지 않는 자리(무너진 건물 칸, 무너진 큰 물건)는 그리지 않는다. cam: 화면 왼쪽 위의 월드 좌표 (정수 px)
 */
export function drawPlatforms(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, s: Pick<SimState, 'city' | 'props' | 'tick'>): void {
  const state = s as SimState;
  const cx = Math.round(cam.x);
  const cy = Math.round(cam.y);
  for (const sf of surfacesOf(state)) {
    const y = GROUND - sf.h - cy;
    if (y < -2 || y > SCREEN_H + 2) continue;
    ctx.fillStyle = sf.tier === 'mid' ? C.gold : C.sky;
    for (let x = sf.x0; x < sf.x1; x++) {
      const sx = x - cx;
      if (sx < 0 || sx >= SCREEN_W) continue;
      if (!surfaceSolid(state, sf, x * 256 + 128)) continue;
      ctx.fillRect(sx, y, 1, 2);
    }
  }
  for (const w of wallsOf(state)) {
    const sx = w.x - cx + (w.side < 0 ? -1 : 0);
    if (sx < -1 || sx > SCREEN_W) continue;
    ctx.fillStyle = w.end ? C.neonRed : C.neonPink;
    for (let h = w.h0; h < w.h1; h++) {
      const y = GROUND - h - cy;
      if (y < 0 || y >= SCREEN_H || !wallSolid(state, w, h)) continue;
      // 붙는 쪽으로 한 칸 (점선)
      if (h % 3 !== 2) ctx.fillRect(sx, y, 1, 1);
    }
  }
}
