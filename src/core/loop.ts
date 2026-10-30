/** 1초 60틱 고정. 틱은 화면 주사율과 상관없이 같은 간격으로 돈다. */
export const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;
/** 탭이 멈췄다 돌아왔을 때 밀린 틱을 한꺼번에 몰아 돌리지 않도록 자른다. */
const MAX_FRAME_MS = 100;

export function startLoop(tick: () => void, render: () => void): void {
  let acc = 0;
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    acc += Math.min(MAX_FRAME_MS, now - last);
    last = now;
    while (acc >= TICK_MS) {
      acc -= TICK_MS;
      tick();
    }
    render();
  };
  requestAnimationFrame(frame);
}
