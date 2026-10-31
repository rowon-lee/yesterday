/** 내부 해상도. 모든 그림은 이 크기에 그리고 정수배로 키운다. */
export const SCREEN_W = 480;
export const SCREEN_H = 270;

/**
 * 캔버스를 담는 칸(#stage)에 들어가는 가장 큰 정수배로 키운다.
 * 아래에 조작 버튼 줄 같은 것이 붙으면 #stage가 줄어들고, 그에 맞춰 다시 맞춘다.
 * 휴대폰은 CSS 1px이 물리 픽셀 여러 개라서, 물리 픽셀 기준으로 정수배를 잡아야
 * 도트 크기가 고르게 나온다.
 */
type FitListener = (scale: number, dpr: number) => void;
const fitListeners: FitListener[] = [];
let lastFit: [number, number] | null = null;

/** 배율이 정해지거나 바뀔 때마다 부른다 (3D 화면 캔버스를 같은 크기로 맞추는 데 쓴다) */
export function onFit(cb: FitListener): void {
  fitListeners.push(cb);
  if (lastFit) cb(lastFit[0], lastFit[1]);
}

/**
 * overlay: 3D 화면(three.js) 위에 HUD만 겹쳐 그리는 투명 캔버스로 쓴다.
 */
export function setupScreen(canvas: HTMLCanvasElement, overlay = false): CanvasRenderingContext2D {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d', { alpha: overlay });
  if (!ctx) throw new Error('Canvas 2D를 쓸 수 없습니다.');
  const stage = canvas.parentElement!;

  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth * dpr;
    const h = stage.clientHeight * dpr;
    const scale = Math.max(1, Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H)));
    canvas.style.width = `${(SCREEN_W * scale) / dpr}px`;
    canvas.style.height = `${(SCREEN_H * scale) / dpr}px`;
    // 크기를 바꾸면 일부 브라우저가 설정을 되돌리므로 매번 다시 끈다.
    ctx.imageSmoothingEnabled = false;
    lastFit = [scale, dpr];
    for (const l of fitListeners) l(scale, dpr);
  };
  fit();
  new ResizeObserver(fit).observe(stage);
  window.addEventListener('resize', fit);
  return ctx;
}
