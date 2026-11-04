// YESTERDAY 애니 이펙트 부품 6 — 배경 누르기 (동작연출지침서 14-1 ⑥).
// 강타 순간 1~3틱 동안 배경 명도를 확 낮추거나 이펙트 색으로 물들인다. 캐릭터와 이펙트는 그대로 둔다.
// 필살기 타격은 1틱 반전이나 흰 화면도 쓴다. 실제로 화면을 누르는 것은 후처리(render/gl/post)가 render/screenfx의 press를 읽어서 한다.
import { press } from '../../render/screenfx';

export interface PressSpec {
  /** 지금 sim 틱 */
  tick: number;
  /** 틱 수 (강 1~2, 필살기 1~3) */
  ticks: number;
  /** 세기 (0~1): 배경 밝기를 이만큼 낮추고 color 쪽으로 */
  k: number;
  /** 물들일 색 ('#rrggbb'): 캐릭터 이펙트의 진한 색 */
  color: string;
  mode?: 'dark' | 'invert' | 'white';
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
}
