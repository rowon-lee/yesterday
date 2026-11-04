/**
 * sim 사건 → 소리 (사운드기획서 0장 '렌더 쪽 전용'). sim이 한 틱을 진행한 뒤 그 틱의 사건과 상태를 **읽기만** 해서 낼 소리 목록을 만든다.
 * sim 상태를 바꾸지 않는다 (npm run sound가 상태를 얼려 두고 확인한다). Web Audio도 모른다: 목록을 엔진(engine.ts)이 튼다.
 *
 * 공통 타격음 (2-1):
 *   hit      맞음. 연타 단계(1~4타)를 고르고, 4타·강타는 세게 맞음, 맞기 전 틱에 상대가 떠 있었으면 공중에서 맞음, 나머지는 약하게 맞음
 *   block    가드 / crush 가드 크러시 / char·shield (방어막이 통째로 막음) 지금은 가드 소리 (2-3에서 유리 꽃잎으로)
 *   knockdown 다운 (철퍽). 내려찍기로 바닥에 한 번 튀는 순간과 KO로 날아간 몸이 바닥에 닿는 순간도 철퍽
 *   기상      다운 → 기상으로 바뀌는 틱 / tech·walltech 낙법 (짧은 바람)
 * 같은 틱에 같은 소리(같은 단계)는 하나로 합친다 (히트스톱이 긴 쪽).
 */
import { isAirborne, movesOf, type Fighter, type Mode, type SimState } from '../sim';
import type { Cue } from './sfx';

/** 연타 단계: 지상 연타 1~4타, 공중 연타 1~3타 */
const CHAIN: Readonly<Record<string, number>> = { atk1: 1, atk2: 2, atk3: 3, atk4: 4, air1: 1, air2: 2, air3: 3 };

/**
 * 콤보 단계 (1~4). 연타 기술은 그 단계 (사용자 결정 2026-11-04: 콤보 수가 아니라 연타 단계 기준).
 * 연타가 아닌 기술은 무게로: 강타이거나 히트스톱 11틱 이상이면 4, 9~10틱이면 3, 8틱이면 2, 그보다 짧으면 1
 */
export function chainStep(move: string | undefined, stop: number, heavy: boolean): number {
  const c = move ? CHAIN[move] : undefined;
  if (c) return c;
  if (heavy || stop >= 11) return 4;
  if (stop >= 9) return 3;
  if (stop >= 8) return 2;
  return 1;
}

interface Snap {
  air: boolean;
  mode: Mode;
  bounce: boolean;
}

/** 떠 있음 (공중에서 맞음·KO 착지 판단용): 바닥보다 위이거나 오르는 중, 또는 공중 피격 */
const aloft = (f: Readonly<Fighter>): boolean => isAirborne(f as Fighter) || f.mode === 'airhit';
const snap = (f: Readonly<Fighter>): Snap => ({ air: aloft(f), mode: f.mode, bounce: f.bounce });

export class SoundBridge {
  private prev: [Snap, Snap] | null = null;
  private lastTick = -1;

  /** 새 경기·라운드 다시 시작: 지난 상태를 잊는다 */
  reset(): void {
    this.prev = null;
    this.lastTick = -1;
  }

  /** sim.step 다음에 부른다. 이번 틱에 낼 소리들 (상태는 읽기만) */
  read(s: Readonly<SimState>): Cue[] {
    if (s.tick === this.lastTick) return [];
    // 틱이 건너뛰었거나 되돌아갔으면(다시 하기) 지난 상태는 믿지 않는다
    if (s.tick !== this.lastTick + 1) this.prev = null;
    this.lastTick = s.tick;
    const out = new Map<string, Cue>();
    const add = (c: Cue) => {
      const k = `${c.sound}:${c.step}`;
      const o = out.get(k);
      if (!o || c.stop > o.stop) out.set(k, c);
    };
    const prev = this.prev;
    const stopOf = (who: number, move: string | undefined) => {
      const att = s.fighters[who];
      if (!att) return 0;
      if (att.hitstop > 0) return att.hitstop;
      const mv = move ? (movesOf(att.char) as Record<string, { data: { hitstop: number } } | undefined>)[move] : undefined;
      return mv?.data.hitstop ?? 0;
    };
    for (const e of s.events) {
      switch (e.type) {
        case 'hit': {
          const def = s.fighters[1 - e.who];
          const stop = stopOf(e.who, e.move);
          const heavy = e.heavy === true;
          const step = chainStep(e.move, stop, heavy);
          const wasAir = prev ? prev[1 - e.who]!.air : !!def && aloft(def);
          if (heavy || step >= 4) add({ sound: 'hitHeavy', step: 4, stop });
          else if (wasAir) add({ sound: 'hitAir', step: Math.min(3, step), stop });
          else add({ sound: 'hitLight', step: Math.min(3, step), stop });
          break;
        }
        case 'block':
          add({ sound: 'guard', step: 1, stop: stopOf(e.who, e.move) });
          break;
        case 'crush':
          add({ sound: 'crush', step: 1, stop: stopOf(e.who, e.move) });
          break;
        case 'char':
          // 방어막이 통째로 막음: who = 막은 쪽, 히트스톱은 때린 쪽과 같다
          if (e.text === 'shield') add({ sound: 'guard', step: 1, stop: s.fighters[e.who]?.hitstop ?? 0 });
          break;
        case 'knockdown':
          add({ sound: 'down', step: 1, stop: 0 });
          break;
        case 'tech':
        case 'walltech':
          add({ sound: 'tech', step: 1, stop: 0 });
          break;
        default:
          break;
      }
    }
    // 사건이 따로 없는 것은 상태가 바뀐 틱으로 안다
    if (prev) {
      s.fighters.forEach((f, i) => {
        const p = prev[i]!;
        if (p.mode === 'knockdown' && f.mode === 'getup') add({ sound: 'getup', step: 1, stop: 0 });
        // 내려찍기: 바닥에 한 번 튀는 순간 (튈 차례가 지워짐)
        if (p.mode === 'airhit' && p.bounce && !f.bounce && f.mode === 'airhit') add({ sound: 'down', step: 1, stop: 0 });
        // KO로 날아간 몸이 바닥에 닿음
        if (f.mode === 'ko' && p.mode === 'ko' && p.air && !aloft(f)) add({ sound: 'down', step: 1, stop: 0 });
      });
    }
    this.prev = [snap(s.fighters[0]), snap(s.fighters[1])];
    return [...out.values()];
  }
}
