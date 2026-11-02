// YESTERDAY: 오스카 고유 특성 검영 (캐릭터 기획서 13-1): 공중에 남는 얇은 은빛 선 조각 — '베었던 자리'. 렌더 전용, 앞 겹.
// 검영의 자리·기울기·남은 틱은 sim 상태 (sim/chars/oscar.ts의 f.ext)에서 틱마다 읽는다 (shadows()).
// 모양: 베기 선과 같은 기울기의 20px 선 조각 (1px). 별 모양 반짝임은 없다. 은은하게 깜빡이고(칸마다 박자가 다른 느린 물결),
// 수명이 줄수록 옅어진다 (달빛 → 어두운 달빛 → 끝 60틱은 성기게). 생긴 뒤 10틱은 베기 선이 덮고 있어 그리지 않는다.
// 스킬 2·필살기가 고를 수 있는 검영은 한 번 밝게 맥동한다 (pulse: 0~1, 흰 심 + 양옆 달빛 + 빛).
// 좌표는 월드 px (shadows가 돌려주는 값). 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은, 짙은 바다].
import type { Frame, Layer } from './impact';
import { glow, put } from './oscar-px';

export interface FieldShadow {
  x: number;
  y: number;
  life: number;
  ang: number;
  slot: number;
}

export interface Options {
  /** 지금 살아 있는 검영들 (월드 px). null이면 그리지 않는다 */
  shadows: () => readonly FieldShadow[] | null;
  /** 검영이 처음 생겼을 때의 남은 틱 (sim SHADOW_LIFE) */
  full: number;
  /** 칸마다 맥동 세기 (0~1) */
  pulse?: (slot: number) => number;
  ramp?: readonly number[];
  /** 매 틱 부른다 (살아 있는지 렌더가 안다) */
  onTick?: () => void;
}

const HALF = 10;

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
      for (const s of list) {
        const age = o.full - s.life;
        if (age < 10) continue;
        const p = o.pulse?.(s.slot) ?? 0;
        const r = (s.ang * Math.PI) / 180;
        const dx = Math.cos(r);
        const dy = Math.sin(r);
        const nx = -dy;
        const ny = dx;
        if (layer === 'back') {
          // 아주 옅은 차가운 빛 (맥동하면 밝게)
          const k = (s.life < 60 ? 0.1 : 0.18) + 0.6 * p;
          for (let q = -HALF; q <= HALF; q += 2) glow(f, s.x + dx * q, s.y + dy * q, p > 0 ? C[1]! : C[4]!, k);
          continue;
        }
        const dying = s.life < 60;
        const faint = s.life < 140;
        for (let q = -HALF; q <= HALF; q++) {
          // 끝 2px은 가늘게 사라진다 (끝으로 갈수록 성기게)
          if (Math.abs(q) > HALF - 2 && (q + tick) % 2 === 0) continue;
          if (dying && (q + (tick >> 2) + s.slot) % 3 === 0) continue;
          const x = s.x + dx * q;
          const y = s.y + dy * q;
          // 은은한 깜빡임: 칸마다 박자가 다른 느린 물결이 지나간 자리만 밝게
          const wave = Math.sin(tick / 9 + q * 0.45 + s.slot * 1.7);
          let c = dying ? C[3]! : faint ? (wave > 0.75 ? C[2]! : C[3]!) : wave > 0.55 ? C[1]! : C[2]!;
          if (p > 0.5) c = C[0]!;
          else if (p > 0) c = C[1]!;
          put(f, x, y, c);
          if (p > 0.25 && Math.abs(q) < HALF - 2) {
            put(f, x + nx, y + ny, C[2]!);
            put(f, x - nx, y - ny, C[2]!);
          }
        }
      }
    },
  };
}
