import { BREAKABLES, RULES, type PropState } from '../sim';
import { drawText } from '../render/font';
import { COLORS } from '../render/palette';
import { SCREEN_W } from '../render/screen';
import { drawStage } from '../render/stage';
import type { Scene } from './scene';

/**
 * 무대만 보는 개발용 화면 (?scene=stage). 카메라가 맵 끝에서 끝까지 천천히 오간다.
 * ?cam=숫자 로 카메라 위치(왼쪽 끝 px)를 고정할 수 있다. ← → 키로 직접 움직여도 된다.
 * ?props=1 (망가짐) / 2 (파괴) 로 부서지는 물건을 모두 그 단계로 보여 준다. 1~3 키로 바꿔도 된다.
 */
export function stageScene(): Scene {
  const params = new URLSearchParams(location.search);
  const max = RULES.STAGE_W - SCREEN_W;
  const fixed = params.has('cam');
  let cam = fixed ? Math.max(0, Math.min(max, Number(params.get('cam')))) : 0;
  let dir = 1;
  let manual = fixed;
  let tick = 0;
  const propsAt = (stage: number): PropState[] =>
    BREAKABLES.map((_, i) => ({
      hp: stage === 2 ? 0 : 1,
      stage: stage as 0 | 1 | 2,
      damagedAt: stage ? 0 : -1,
      brokenAt: stage === 2 ? 0 : -1,
      crashed: false,
      dir: i % 2 ? -1 : 1,
    }));
  let props = propsAt(Number(params.get('props') ?? 0));
  return {
    tick(input) {
      tick++;
      for (const [code, stage] of [['Digit1', 0], ['Digit2', 1], ['Digit3', 2]] as const) if (input.pressed.has(code)) props = propsAt(stage);
      const left = input.held.has('ArrowLeft') || input.held.has('KeyA');
      const right = input.held.has('ArrowRight') || input.held.has('KeyD');
      if (left || right) manual = true;
      if (manual) cam = Math.max(0, Math.min(max, cam + (right ? 3 : 0) - (left ? 3 : 0)));
      else {
        cam += dir;
        if (cam >= max || cam <= 0) dir = -dir;
      }
    },
    render(ctx) {
      drawStage(ctx, Math.round(cam), tick, props);
      drawText(ctx, `CAM ${Math.round(cam)}`, 4, 4, COLORS.white);
    },
  };
}
