// YESTERDAY: 오스카 고유 특성 검영 — 베인 자리마다 남는 은빛 칼 그림자 (달빛 잔상). 렌더 전용, 앞 겹.
// 검영의 자리·기울기·남은 틱은 sim 상태 (sim/chars/oscar.ts의 f.ext)에서 틱마다 읽는다 (shadows()).
// 모양: 기울기 방향으로 누운 18px 가는 칼 그림자 (1px 달빛 심 + 한쪽 1px 짙은 바다 그늘), 칼끝 쪽이 가늘다.
// 생긴 뒤 처음 10틱은 검격 이펙트가 그 자리를 덮고 있어 그리지 않고, 사라지기 60틱 전부터 깜빡이며 어두워진다.
// 이따금 빛이 칼날을 따라 한 번 훑고 지나간다. 좌표는 월드 px (shadows가 돌려주는 값).
import type { Frame, Layer } from './impact';
import { glow, put } from './oscar-px';

export interface FieldShadow {
  x: number;
  y: number;
  life: number;
  ang: number;
}

export interface Options {
  /** 지금 살아 있는 검영들 (월드 px). null이면 그리지 않는다 */
  shadows: () => readonly FieldShadow[] | null;
  /** 검영이 처음 생겼을 때의 남은 틱 (sim SHADOW_LIFE) */
  full: number;
  /** 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은, 짙은 바다] */
  ramp?: readonly number[];
  /** 매 틱 부른다 (살아 있는지 렌더가 안다) */
  onTick?: () => void;
}

const HALF = 9;

export default function oscarShadows(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff806629, 0xff4a3814];
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
      o.onTick?.();
    },
    done() {
      return false;
    },
    draw(f: Frame, layer?: Layer) {
      const list = o.shadows();
      if (!list) return;
      const tick = Math.floor(t * 60);
      list.forEach((s, i) => {
        const age = o.full - s.life;
        if (age < 10) return;
        const dying = s.life < 60;
        if (dying && (tick + i) % 4 === 0) return;
        const r = (s.ang * Math.PI) / 180;
        const dx = Math.cos(r);
        const dy = Math.sin(r);
        const nx = -dy;
        const ny = dx;
        if (layer === 'back') {
          // 둘레에 아주 옅은 차가운 빛
          for (let k = -HALF; k <= HALF; k += 2) glow(f, s.x + dx * k, s.y + dy * k, C[4]!, dying ? 0.12 : 0.22);
          return;
        }
        // 빛이 칼날을 따라 훑는 자리 (검영마다 다른 박자, 90틱에 한 번)
        const sweep = ((tick + i * 37) % 90) - 20;
        for (let k = -HALF; k <= HALF; k++) {
          // 칼끝(+쪽) 3px은 심만, 나머지는 그늘까지
          const x = s.x + dx * k;
          const y = s.y + dy * k;
          const lit = Math.abs(k - (sweep - HALF)) <= 1;
          put(f, x, y, lit ? C[1]! : dying ? C[3]! : C[2]!);
          if (k < HALF - 3) put(f, x + nx, y + ny, dying ? C[5]! : C[4]!);
        }
        // 칼등 끝의 작은 날밑 자국 (1px)
        put(f, s.x - dx * (HALF + 1) - nx, s.y - dy * (HALF + 1) - ny, C[3]!);
      });
    },
  };
}
