/** 1초 60틱 고정. 틱은 화면 주사율과 상관없이 같은 간격으로 돈다. */
export const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;
/** 탭이 멈췄다 돌아왔을 때 밀린 틱을 한꺼번에 몰아 돌리지 않도록 자른다. */
const MAX_FRAME_MS = 100;

/**
 * render는 이번 화면 프레임에 돈 틱 수(ticks)와 함께 불린다. 틱이 하나도 넘어가지 않은 프레임은 그림도 같으므로 그리지 않는다
 * (120Hz 휴대폰에서 같은 그림을 두 번씩 그리지 않게). ticks가 1보다 자주 크면 화면이 60프레임을 못 따라가는 것이다.
 */
export function startLoop(tick: () => void, render: (ticks: number, now: number) => void): void {
  let acc = 0;
  let last = performance.now();
  let drawn = false;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    acc += Math.min(MAX_FRAME_MS, now - last);
    last = now;
    let ticks = 0;
    while (acc >= TICK_MS) {
      acc -= TICK_MS;
      tick();
      ticks++;
    }
    if (ticks || !drawn) {
      render(ticks, now);
      drawn = true;
    }
  };
  requestAnimationFrame(frame);
}
