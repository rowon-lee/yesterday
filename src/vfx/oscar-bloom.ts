// YESTERDAY: 오스카 차지 만검지화 — 검영 꽃 (캐릭터 기획서 13-5): 한 점에서 꽃잎처럼 퍼지는 은빛 선 5~6줄 (24~32px). 렌더 전용, 앞 겹.
// 피는 4틱 동안 선이 가운데에서 바깥으로 자란다. 모으는 동안(alive) 은은하게 빛이 선을 따라 돈다. 떼면 2틱 만에 사라진다
// (그 자리에서 선 다발이 펼쳐진다: oscar-cut). 좌표는 월드 px, petals는 [각도(도), 길이 px] (오른쪽 보는 기준, facing으로 뒤집는다).
// 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은].
import type { Frame, Layer } from './impact';
import { glow, put } from './oscar-px';

export interface Options {
  x: number;
  y: number;
  facing: number;
  petals: ReadonlyArray<readonly [number, number]>;
  /** 모으는 동안 true */
  alive: () => boolean;
  ramp?: readonly number[];
}

const GROW = 4;

export default function oscarBloom(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff806629];
  const P = o.petals.map(([deg, len]) => {
    const r = (deg * Math.PI) / 180;
    return { ux: Math.cos(r) * o.facing, uy: Math.sin(r), len };
  });
  let t = 0;
  let gone = -1;
  return {
    update(dt: number) {
      t += dt;
      if (gone < 0 && !o.alive()) gone = t * 60;
    },
    done() {
      return gone >= 0 && t * 60 - gone > 2;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      const grow = Math.min(1, tick / GROW);
      if (layer === 'back') {
        glow(f, o.x, o.y, C[1]!, 0.5 * grow);
        for (const p of P) for (let s = 4; s <= p.len * grow; s += 4) glow(f, o.x + p.ux * s, o.y + p.uy * s, C[4]!, 0.25);
        return;
      }
      if (gone >= 0 && (tick - gone) >= 1 && Math.floor(tick) % 2 === 0) return;
      P.forEach((p, i) => {
        const n = Math.round(p.len * grow);
        // 빛이 꽃잎을 따라 바깥으로 흐른다 (꽃잎마다 박자가 다르다)
        const run = (tick * 1.5 + i * 7) % (p.len + 10);
        for (let s = 1; s <= n; s++) {
          if (s > p.len - 3 && s % 2 === 0) continue;
          const c = tick < GROW + 1 ? C[0]! : Math.abs(s - run) < 2 ? C[1]! : s < p.len * 0.6 ? C[2]! : C[3]!;
          put(f, o.x + p.ux * s, o.y + p.uy * s, c);
        }
      });
      put(f, o.x, o.y, C[0]!);
    },
  };
}
