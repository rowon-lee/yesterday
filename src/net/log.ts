/**
 * 온라인 경기 기록: 어긋남(DESYNC)이 나면 다시 재현해 첫 어긋난 틱을 찾으려고 남긴다.
 * 시드·캐릭터·양쪽 입력 전부와 해시 기록. 브라우저(localStorage)에 최근 3판, 확인 도구는 window.__debug.net으로 읽는다.
 * tools/netreplay.mjs <기록.json>이 sim을 그대로 다시 돌려 해시를 비교한다.
 */
import type { CharId } from '../sim';

export interface NetLog {
  v: 1;
  build: string;
  at: string;
  /** 나는 몇 번 자리 (0 = 1P 방장) */
  side: 0 | 1;
  seed: number;
  chars: [CharId, CharId];
  delay: number;
  match: number;
  /** 틱 1부터 [1P, 2P, 1P, 2P, …] */
  inputs: number[];
  /** [틱, 내 해시, 상대 해시(받았으면)] */
  hashes: Array<[number, string, string | null]>;
  desync: { k: number; mine: string; theirs: string } | null;
  /** 기다림·맞추기·반응 시간 등 (driver.stats) */
  stats: Record<string, number>;
  ua: string;
}

const KEY = 'yesterday.netlog';

export function saveLog(log: NetLog): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as NetLog[];
    list.unshift(log);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 3)));
  } catch {
    // 저장이 막혔거나 너무 큼: 확인 도구로는 window.__debug.net에서 읽을 수 있다
  }
}

export function savedLogs(): NetLog[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as NetLog[];
  } catch {
    return [];
  }
}
