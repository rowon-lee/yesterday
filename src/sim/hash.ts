import type { SimState } from './state';

/** 상태 해시 (FNV-1a 32비트). 결정론 확인용. */
export function hashState(state: SimState): string {
  const s = JSON.stringify(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
