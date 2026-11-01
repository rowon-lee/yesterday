import type { TickInput } from '../core/input';

/** 화면 하나. 주소 뒤 ?scene=이름 으로 고른다 (npm run shot도 이걸 쓴다). */
export interface Scene {
  tick(input: TickInput): void;
  render(ctx: CanvasRenderingContext2D): void;
}

/** 장면이 쓰는 앱 기능 */
export interface App {
  /**
   * 다른 장면으로 바꾼다 (다음 틱부터). opts는 주소 뒤에 붙는 값 (예: { mode: 'practice' }).
   * 3D 화면 장면끼리(타이틀 ↔ 대련)는 다시 불러오지 않고 바꾸고, 나머지는 주소를 바꿔 다시 연다.
   */
  goto(name: string, opts?: Record<string, string>): void;
}
