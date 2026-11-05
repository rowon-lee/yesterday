/**
 * 통로: 문자열 메시지를 보내고 받는 것 하나 (WebRTC 데이터 채널, 시험용 메모리 통로).
 * 온라인 한 연결에는 통로가 둘이다: ctl(빠짐없이·순서대로: 로비·해시·재대결) / inp(빠를 수 있으면 빠지거나 순서가 바뀌어도 됨: 입력 묶음).
 * 시험용 지연(lagged)은 내가 보내는 쪽에 왕복 지연의 절반을 붙인다: 두 사람이 모두 붙이면 왕복이 그 값이 된다.
 */

export interface Channel {
  send(data: string): void;
  onmessage: ((data: string) => void) | null;
}

/** 일부러 넣는 지연 (시험·확인용): 왕복 ms, 흔들림 ±ms, 손실 비율 (빠질 수 있는 통로에만) */
export interface Lag {
  rtt: number;
  jitter: number;
  loss: number;
}

export const NO_LAG: Lag = { rtt: 0, jitter: 0, loss: 0 };

/** 시각(ms)과 나중에 부르기 (브라우저는 performance.now·setTimeout, Node 시험은 가상 시계) */
export interface Clock {
  now(): number;
  later(fn: () => void, ms: number): void;
}

export const realClock: Clock = {
  now: () => performance.now(),
  later: (fn, ms) => {
    if (ms <= 0) queueMicrotask(fn);
    else setTimeout(fn, ms);
  },
};

/**
 * 내가 보내는 메시지에 지연을 붙인 통로. ordered면 앞 메시지보다 먼저 닿지 않게 (빠짐없는 통로 흉내),
 * 아니면 메시지마다 따로 늦어져 순서가 바뀔 수 있고 loss 비율로 빠진다
 */
export function lagged(ch: Channel, lag: Lag, ordered: boolean, clock: Clock, rand: () => number = Math.random): Channel {
  if (lag.rtt <= 0 && lag.jitter <= 0 && lag.loss <= 0) return ch;
  let lastAt = 0;
  const out: Channel = {
    onmessage: null,
    send(data) {
      if (!ordered && lag.loss > 0 && rand() < lag.loss) return;
      let at = clock.now() + Math.max(0, lag.rtt / 2 + (rand() * 2 - 1) * lag.jitter);
      if (ordered) at = Math.max(at, lastAt);
      lastAt = at;
      clock.later(() => ch.send(data), at - clock.now());
    },
  };
  // 받는 쪽은 그대로 이어 준다
  ch.onmessage = (d) => out.onmessage?.(d);
  return out;
}

/** 메모리 통로 한 쌍 (Node 시험·같은 화면 둘): 한쪽이 보낸 것이 다른 쪽 onmessage로 */
export function loopPair(clock: Clock): [Channel, Channel] {
  const a: Channel = { onmessage: null, send: (d) => clock.later(() => b.onmessage?.(d), 0) };
  const b: Channel = { onmessage: null, send: (d) => clock.later(() => a.onmessage?.(d), 0) };
  return [a, b];
}

/** 주소의 시험용 지연 (?lag=100&jitter=10&loss=0.02). 배포된 게임에서도 확인용으로 쓸 수 있다 */
export function lagFromUrl(params: URLSearchParams): Lag {
  const n = (k: string) => {
    const v = Number(params.get(k));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  return { rtt: n('lag'), jitter: n('jitter'), loss: Math.min(0.5, n('loss')) };
}
