// YESTERDAY: 오스카 스킬 1 월하참뢰검 — 벨 자리에 잠깐 뜨는 표식과 진공 왜곡 (렌더 전용).
// 표식: 상대 몸 가운데에 은빛 고리(가운데 세로 틈)가 조여 들며 깜빡인다 (피할 틈을 보여 준다).
// 진공 왜곡: 고리 둘레에 짧게 끊긴 동심원이 안쪽으로 빨려 들며 흔들린다 (벨 자리의 공기가 비워지는 느낌).
// life틱이 지나면 사라진다 (그 순간 베인다: 베는 그림은 oscar-slash). 좌표는 2단위 = 1px, 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은].
import type { Frame, Layer } from './impact';
import { glow, put } from './oscar-px';

export interface Options {
  /** 벨 자리 가운데 (2단위) */
  x: number;
  y: number;
  /** 표식이 떠 있는 틱 */
  life: number;
  ramp?: readonly number[];
}

const PX = 2;

export default function oscarMark(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff806629];
  const cx = o.x / PX;
  const cy = o.y / PX;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= o.life;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      const u = Math.min(1, tick / o.life);
      if (layer === 'back') {
        for (let a = 0; a < 16; a++) {
          const r = (a / 16) * Math.PI * 2;
          glow(f, cx + Math.cos(r) * 10, cy + Math.sin(r) * 14, C[4]!, 0.25 + 0.25 * u);
        }
        return;
      }
      // 진공 왜곡: 끊긴 동심원 세 겹이 안쪽으로 빨려 든다 (흔들리며)
      for (let ring = 0; ring < 3; ring++) {
        const k = ((tick / o.life) * 1.5 + ring / 3) % 1;
        const rr = 26 * (1 - k) + 6;
        const wob = Math.sin(tick * 0.9 + ring) * 1.2;
        for (let a = 0; a < 40; a++) {
          if ((a + ring * 3) % 5 < 2) continue;
          const r = (a / 40) * Math.PI * 2;
          put(f, cx + Math.cos(r) * (rr + wob), cy + Math.sin(r) * (rr * 1.25 + wob), k < 0.5 ? C[4]! : C[3]!);
        }
      }
      // 표식 고리: 조여 들며 깜빡인다 (끝으로 갈수록 빨리)
      const blink = Math.floor(tick / Math.max(1, 4 - Math.floor(u * 3))) % 2 === 0;
      if (!blink) return;
      const R = 12 - 4 * u;
      for (let a = 0; a < 36; a++) {
        const r = (a / 36) * Math.PI * 2;
        put(f, cx + Math.cos(r) * R, cy + Math.sin(r) * R * 1.3, u > 0.7 ? C[1]! : C[2]!);
      }
      // 가운데 세로 틈 (벨 자리)
      for (let d = -R; d <= R; d++) put(f, cx, cy + d * 1.3, u > 0.7 ? C[0]! : C[1]!);
    },
  };
}
