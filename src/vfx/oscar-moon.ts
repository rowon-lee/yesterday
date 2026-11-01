// YESTERDAY: 오스카 필살기 월령수류 — 핏빛 달이 뜨고 바닥에 물결이 차오른다 (캐릭터 기획서 '필살기 연출'). 렌더 전용, 뒤 겹.
// 달: 두 사람 위 하늘에 검붉은 둥근 달이 떠오른다 (가장자리는 두 색 경계만 디더, 안쪽은 얼룩 두 개).
// 물결: 바닥에 얇은 동심 타원이 상대 발밑에서 퍼져 나가고, 차오른 물빛이 바닥을 덮는다 (짙은 바다 + 달빛 반짝임).
// life틱 동안 (연출 장면 1~3), 끝에 서서히 걷힌다. 좌표는 2단위 = 1px.
// 색: [핏빛 달, 어두운 핏빛, 달빛 밝은, 달빛, 짙은 바다 밝은, 짙은 바다].
import type { Frame, Layer } from './impact';
import { glow, put } from './oscar-px';

export interface Options {
  /** 달 가운데 (2단위) */
  moonX: number;
  moonY: number;
  /** 물결 가운데 (상대 발밑, 2단위)와 바닥 높이 */
  waterX: number;
  ground: number;
  life: number;
  ramp?: readonly number[];
}

const PX = 2;
const MOON_R = 17;
const RISE = 30;

export default function oscarMoon(o: Options) {
  const C = o.ramp ?? [0xff2e20b3, 0xff180f5c, 0xfffff8f4, 0xffecd8cd, 0xff806629, 0xff4a3814];
  const mx = o.moonX / PX;
  const my0 = o.moonY / PX;
  const wx = o.waterX / PX;
  const gy = o.ground / PX;
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= o.life;
    },
    draw(f: Frame, layer?: Layer) {
      if (layer !== 'back') return;
      const tick = t * 60;
      const out = Math.max(0, (tick - (o.life - 20)) / 20);
      if (out >= 1) return;
      // 달이 아래에서 떠오른다
      const rise = Math.min(1, tick / RISE);
      const my = my0 + (1 - rise * rise) * 20;
      for (let y = -MOON_R - 1; y <= MOON_R + 1; y++) {
        for (let x = -MOON_R - 1; x <= MOON_R + 1; x++) {
          const d = Math.hypot(x, y);
          if (d > MOON_R + 0.5) continue;
          // 가장자리 1px만 두 색 디더, 안쪽 얼룩 둘
          const edge = d > MOON_R - 1;
          if (edge && ((x + y) & 1) === 1) continue;
          if (out > 0 && ((x * 7 + y * 13) & 7) < out * 8) continue;
          const blot = Math.hypot(x + 5, y + 4) < 4 || Math.hypot(x - 6, y - 5) < 3;
          put(f, mx + x, my + y, blot || edge ? C[1]! : C[0]!);
        }
      }
      for (let a = 0; a < 24; a++) {
        const r = (a / 24) * Math.PI * 2;
        for (let k = 1; k <= 3; k++) glow(f, mx + Math.cos(r) * (MOON_R + k * 4), my + Math.sin(r) * (MOON_R + k * 4), C[0]!, 0.3 / k * rise * (1 - out));
      }
      // 차오른 물: 바닥 위 1~2px 짙은 바다 띠가 양옆으로 번진다
      const reach = Math.min(1, tick / 40) * 150;
      for (let x = -reach; x <= reach; x++) {
        const fade = 1 - Math.abs(x) / Math.max(1, reach);
        if (((Math.round(x) + Math.floor(tick / 6)) & 3) === 0 && fade < 0.3) continue;
        put(f, wx + x, gy, C[5]!);
        if (fade > 0.4) put(f, wx + x, gy - 1, C[4]!);
      }
      // 물결: 상대 발밑에서 퍼지는 얇은 타원 (20틱마다 하나), 위쪽 테두리에 달빛 반짝임
      for (let n = 0; n < 4; n++) {
        const age = tick - n * 20;
        if (age < 0) continue;
        const k = (age % 80) / 80;
        const rx = 8 + k * 120;
        const ry = 2 + k * 6;
        for (let a = 0; a < 90; a++) {
          const r = (a / 90) * Math.PI * 2;
          const sin = Math.sin(r);
          if ((a + n) % 3 === 0) continue;
          put(f, wx + Math.cos(r) * rx, gy + sin * ry, sin < 0 ? (k < 0.4 ? C[2]! : C[3]!) : C[4]!);
        }
      }
    },
  };
}
