/**
 * 시드 난수 (mulberry32). 상태를 숫자 하나로 들고 다니므로 sim 상태에 그대로 넣을 수 있다.
 * 같은 시드 → 같은 수열. 정수만 다룬다.
 */
export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, seed: next };
}
