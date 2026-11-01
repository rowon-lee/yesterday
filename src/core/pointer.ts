import { SCREEN_H, SCREEN_W } from '../render/screen';

/**
 * 화면(#screen)을 누른 자리 모으기 (메뉴를 손가락·마우스로 고르는 데 쓴다).
 * 키보드처럼 다음 틱 시작에 한 번 확정해서 넘긴다. 좌표는 게임 화면(480×270) 기준.
 */
export interface Tap {
  x: number;
  y: number;
}

export class Pointer {
  private taps: Tap[] = [];

  constructor(target: HTMLElement) {
    target.addEventListener('pointerdown', (e) => {
      const r = target.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const x = ((e.clientX - r.left) / r.width) * SCREEN_W;
      const y = ((e.clientY - r.top) / r.height) * SCREEN_H;
      this.taps.push({ x, y });
    });
  }

  /** 틱 시작마다 한 번: 지난 틱 이후 누른 자리들 */
  poll(): Tap[] {
    const out = this.taps;
    this.taps = [];
    return out;
  }
}
