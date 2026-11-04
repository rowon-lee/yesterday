import type { Box } from '../data/moves/types';
import { CHAR_IDS, frameAtTick, moveHitBox, moveHitLine, movesOf, timelineOf, type CharId, type Move } from '../sim';

/**
 * 판정 상자 보기 (뷰어·시트 확인용, 3-0a(2)): 동작 그림 위에 공격 데이터의 판정을 겹친다.
 * 피격 상자는 피격 상자 시간표(data/moves/hurt.ts), 공격 상자·판정 선은 그 동작을 쓰는 기술의 시간표(data/moves/time.ts)에서 온다.
 * 그림이 아니라 sim이 쓰는 값 그대로라, 그림과 판정이 어긋나면 그대로 보인다.
 */

/** 이 동작을 그리는 기술 (그 캐릭터 기술을 먼저, 없으면 다른 캐릭터에서). 없으면 null */
export function moveForMotion(name: string): { char: CharId; id: string; mv: Move } | null {
  const who = name.slice(0, name.indexOf('/'));
  const order = [...CHAR_IDS].sort((a, b) => (a === who ? -1 : b === who ? 1 : 0));
  for (const c of order) {
    for (const [id, mv] of Object.entries(movesOf(c))) if (mv.time.motion === name) return { char: c, id, mv };
  }
  return null;
}

export interface DataBoxes {
  /** 피격 상자 (시간표가 없는 동작이면 null) */
  hurt: Box | null;
  /** 공격 상자 (판정 구간이 아니면 null) */
  hit: Box | null;
  /** 판정 선 (백은우 연검) */
  line: ReadonlyArray<readonly [number, number]> | null;
  /** 이 동작을 쓰는 기술 */
  move: string | null;
  /** 판정 구간들 [시작, 끝) 틱 */
  spans: ReadonlyArray<readonly [number, number]>;
}

/** 동작 name의 t틱째 데이터 판정 (발밑 기준, 오른쪽 보는 기준 px). chargeLv: 차지 단계별 상자 (0이면 기본) */
export function dataBoxesAt(name: string, t: number, chargeLv = 0): DataBoxes {
  let hurt: Box | null = null;
  try {
    const tl = timelineOf(name);
    hurt = tl.hurt[frameAtTick(tl, t)] ?? null;
  } catch {
    hurt = null;
  }
  const m = moveForMotion(name);
  if (!m) return { hurt, hit: null, line: null, move: null, spans: [] };
  return {
    hurt,
    hit: moveHitBox(m.mv, t, chargeLv),
    line: moveHitLine(m.mv, t),
    move: `${m.char}.${m.id}`,
    spans: m.mv.time.hits.map((h) => h.t),
  };
}
