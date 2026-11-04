// YESTERDAY 길티기어식 이펙트 — 화면 전환 (동작연출지침서 14-8 ⑧): 강타·필살기 순간 몇 틱 동안 배경(무대)을 어둡게 누르거나
// 한 색으로 칠하고 균열을 긋는다. 캐릭터와 이펙트 칸은 그대로 둔다. 실제로 화면을 바꾸는 것은 후처리(render/gl/post)가 render/screenfx의 press를 읽어서 한다.
import { press } from '../../render/screenfx';

export interface PressSpec {
  /** 지금 sim 틱 */
  tick: number;
  /** 틱 수 */
  ticks: number;
  /** 세기 (0~1) */
  k: number;
  /** dark: 물들일 색 · tint: 더할 색 · crack: 칠할 한 색 ('#rrggbb') */
  color: string;
  mode?: 'dark' | 'invert' | 'white' | 'tint' | 'crack';
  /** tint: 무대 밝기 배수 */
  scale?: number;
  /** crack: 균열 색·어두운 단·밝은 단 */
  crack?: string;
  dark?: string;
  hi?: string;
}

/** 배경 누르기를 건다 (이미 더 센 누르기가 걸려 있으면 그것을 둔다) */
export default function pressBackground(o: PressSpec): void {
  const busy = o.tick - press.at < press.life && press.k > o.k;
  if (busy) return;
  press.at = o.tick;
  press.life = o.ticks;
  press.k = o.k;
  press.color = o.color;
  press.mode = o.mode ?? 'dark';
  press.scale = o.scale ?? 1;
  if (o.crack) press.crack = o.crack;
  if (o.dark) press.dark = o.dark;
  if (o.hi) press.hi = o.hi;
}
