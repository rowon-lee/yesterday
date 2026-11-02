// YESTERDAY: 오스카 차지 만검지화 — 모으는 동안 앞 허공에 하나씩 만개하는 검영 (렌더 전용).
// 가운데 한 점에서 은빛 칼 그림자 세 줄이 별꽃처럼 펼쳐지고(6틱), 모으는 동안 천천히 숨 쉬듯 빛난다.
// alive()가 거짓이 되면 (떼서 베이거나, 맞아서 취소) 꽃잎이 흩어지며 사라진다. 좌표는 2단위 = 1px.
// 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은].
import type { Frame, Layer } from './impact';
import { glow, put } from './oscar-px';

export interface Options {
  x: number;
  y: number;
  alive: () => boolean;
  ramp?: readonly number[];
  /** 꽃잎 각도를 조금씩 다르게 */
  turn?: number;
}

const PX = 2;
const OPEN = 6;
const FADE = 8;
const R = 13;

export default function oscarBloom(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff806629];
  const cx = o.x / PX;
  const cy = o.y / PX;
  const turn = o.turn ?? 0;
  let t = 0;
  let gone = -1;
  return {
    update(dt: number) {
      t += dt;
      if (gone < 0 && !o.alive()) gone = t;
    },
    done() {
      return gone >= 0 && (t - gone) * 60 >= FADE;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      const open = Math.min(1, tick / OPEN);
      const fade = gone >= 0 ? (t - gone) * 60 / FADE : 0;
      const breath = 0.5 + 0.5 * Math.sin(tick * 0.18);
      if (layer === 'back') {
        for (let q = -6; q <= 6; q += 2) for (let p = -6; p <= 6; p += 2) glow(f, cx + p, cy + q, C[4]!, (0.3 + 0.2 * breath) * (1 - fade) * (1 - Math.hypot(p, q) / 9));
        return;
      }
      // 세 줄 별꽃 (60°씩), 흩어질 때는 바깥으로 밀려나며 끊긴다
      for (let k = 0; k < 3; k++) {
        const a = turn + (k * Math.PI) / 3 + Math.PI / 4;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const len = R * open;
        for (let d = -len; d <= len; d++) {
          if (fade > 0 && (Math.abs(Math.round(d)) + k) % 3 === 0) continue;
          const push = fade * 6 * Math.sign(d);
          const c = Math.abs(d) < 2 ? C[0]! : Math.abs(d) < len - 3 ? (breath > 0.6 ? C[1]! : C[2]!) : C[3]!;
          put(f, cx + dx * (d + push), cy + dy * (d + push), c);
        }
      }
    },
  };
}
