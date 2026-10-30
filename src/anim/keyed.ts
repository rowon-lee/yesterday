import { POSE_KEYS, type Pose } from './pose';

/** 키프레임 하나. at = 프레임 번호(0부터). stop이면 그 키에서 속도 0 (멈칫). */
export interface Key {
  at: number;
  pose: Pose;
  stop?: boolean;
}

/**
 * 키프레임 → 프레임 n개. 3차 에르미트 보간.
 * 양 끝 키와 stop 키는 접선 0, 나머지는 앞뒤 키를 잇는 기울기(Catmull-Rom).
 * 반복 동작은 마지막 키를 at = n에 기본자세로 두면 이음매 없이 돈다.
 */
export function keyed(n: number, keys: readonly Key[]): Pose[] {
  const T = keys.map((k) => k.at);
  const V = keys.map((k) => k.pose);
  const M = keys.map((k, i) => {
    if (i === 0 || i === keys.length - 1 || k.stop) return null;
    const dt = T[i + 1] - T[i - 1];
    const o = {} as Pose;
    for (const q of POSE_KEYS) o[q] = (V[i + 1][q] - V[i - 1][q]) / dt;
    return o;
  });
  const out: Pose[] = [];
  for (let i = 0; i < n; i++) {
    let j = 0;
    while (j < keys.length - 2 && i > T[j + 1]) j++;
    const h = Math.max(1e-6, T[j + 1] - T[j]);
    const u = Math.max(0, Math.min(1, (i - T[j]) / h));
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    const o = {} as Pose;
    for (const q of POSE_KEYS) {
      o[q] = h00 * V[j][q] + h10 * h * (M[j]?.[q] ?? 0) + h01 * V[j + 1][q] + h11 * h * (M[j + 1]?.[q] ?? 0);
    }
    out.push(o);
  }
  return out;
}
