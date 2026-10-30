/** 내부 해상도. 모든 그림은 이 크기에 그리고 정수배로 키운다. */
export const SCREEN_W = 320;
export const SCREEN_H = 180;

/**
 * 캔버스를 화면에 들어가는 가장 큰 정수배로 키운다.
 * 휴대폰은 CSS 1px이 물리 픽셀 여러 개라서, 물리 픽셀 기준으로 정수배를 잡아야
 * 도트 크기가 고르게 나온다.
 */
export function setupScreen(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D를 쓸 수 없습니다.');

  const fit = () => {
    const vv = window.visualViewport;
    const cssW = vv ? vv.width : window.innerWidth;
    const cssH = vv ? vv.height : window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.floor(Math.min((cssW * dpr) / SCREEN_W, (cssH * dpr) / SCREEN_H)));
    canvas.style.width = `${(SCREEN_W * scale) / dpr}px`;
    canvas.style.height = `${(SCREEN_H * scale) / dpr}px`;
    // 크기를 바꾸면 일부 브라우저가 설정을 되돌리므로 매번 다시 끈다.
    ctx.imageSmoothingEnabled = false;
  };
  fit();
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  return ctx;
}
