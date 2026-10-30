import type { TickInput } from '../core/input';

/** 화면 하나. 주소 뒤 ?scene=이름 으로 고른다 (npm run shot도 이걸 쓴다). */
export interface Scene {
  tick(input: TickInput): void;
  render(ctx: CanvasRenderingContext2D): void;
}
