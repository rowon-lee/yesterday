/**
 * 확인용 소리 순서 (npm run sound·소리 시험 화면): 실제 sim을 돌려 1→4타 연타가 맞는 틱을 잰다.
 * 그 틱 간격 그대로 소리를 이어 붙이면 대련에서 들리는 박자와 같다. 렌더 쪽 전용 (sim 상태는 여기서 만든 사본만 움직인다)
 */
import { createState, IN_ATTACK, RULES, step, type CharId } from '../sim';
import { SoundBridge } from './events';
import type { Cue } from './sfx';

export interface TimedCue {
  /** 첫 소리부터 몇 틱 뒤 */
  tick: number;
  cue: Cue;
  /** 소리는 0으로 (덕킹 같은 효과만 남김: 덕킹 확인용) */
  mute?: boolean;
}

/**
 * 연습 모드에서 char가 가만히 선 상대에게 공격을 연타해 1~4타를 맞힌다. 맞은 틱마다 소리 연결(events.ts)이 낸 소리를 모은다.
 * 공격 버튼은 3틱마다 한 번 눌렀다 뗀다 (길게 누르기 → 차지가 되지 않게)
 */
export function comboCues(char: CharId = 'raiden'): TimedCue[] {
  const s = createState(1, { practice: true, chars: [char, char] });
  const bridge = new SoundBridge();
  // 시작 연출이 끝날 때까지
  for (let i = 0; i < 2000 && s.phase !== 'fight'; i++) {
    step(s, [0, 0]);
    bridge.read(s);
  }
  // 둘을 붙여 세운다 (몸 중심 사이 30px)
  const [a, b] = s.fighters;
  b.x = a.x + RULES.px(30);
  const out: TimedCue[] = [];
  let first = -1;
  for (let i = 0; i < 240; i++) {
    step(s, [i % 3 === 0 ? IN_ATTACK : 0, 0]);
    for (const c of bridge.read(s)) {
      if (first < 0) first = s.tick;
      out.push({ tick: s.tick - first, cue: c });
    }
    if (out.length >= 4) break;
  }
  return out;
}
