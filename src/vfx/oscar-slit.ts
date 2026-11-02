// YESTERDAY: 오스카 허공의 틈 (캐릭터 기획서 13-4 월하윤회궤·13-6 등장: 공간을 '벤다'. 타원 문이 아니다). 렌더 전용, 뒤 겹.
// 선(세로 베기 선이 한 번에, 흰 심 + 은빛 테두리) → 열림 (선이 좌우로 벌어져 날카로운 세로 틈: 폭 0 → w, 위아래 끝은 곧게 뾰족하다.
// 안은 달빛이 비치는 어둠, 가장자리 1px 달빛) → 그대로 → 닫힘 (다시 선으로) → 선이 가루로 흩어진다.
// 좌표는 월드 px: (x, y)는 틈 아래 끝, 높이 h. 시간표는 틱. 색: [흰, 달빛 밝은, 달빛, 달빛 어두운, 짙은 바다 밝은, 짙은 바다, 어둠].
import type { Frame, Layer } from './impact';
import { glow, put, rng } from './oscar-px';

export interface Options {
  x: number;
  y: number;
  h: number;
  /** 다 열린 폭 (px) */
  w: number;
  /** 시간표 (틱): 열리기 시작·다 열림·닫히기 시작·다 닫힘·가루가 다 흩어짐 */
  open: number;
  opened: number;
  close: number;
  closed: number;
  gone: number;
  ramp?: readonly number[];
  seed?: number;
}

export default function oscarSlit(o: Options) {
  const C = o.ramp ?? [0xffffffff, 0xfffff8f4, 0xffecd8cd, 0xffa68a7c, 0xff806629, 0xff4a3814, 0xff140a08];
  const rand = rng(o.seed ?? 5);
  const specks = Array.from({ length: Math.ceil(o.h / 6) }, () => ({ v: rand(), u: rand() - 0.5, tw: Math.floor(rand() * 8) }));
  const motes = Array.from({ length: Math.ceil(o.h / 4) }, () => ({ v: rand(), side: rand() < 0.5 ? -1 : 1, drift: 0.2 + rand() * 0.4 }));
  let t = 0;
  /** 이 틱의 폭 (px, 0이면 선) */
  const widthAt = (tick: number): number => {
    if (tick < o.open) return 0;
    if (tick < o.opened) {
      const k = (tick - o.open) / Math.max(1, o.opened - o.open);
      return o.w * (1 - (1 - k) * (1 - k));
    }
    if (tick < o.close) return o.w;
    if (tick < o.closed) {
      const k = (tick - o.close) / Math.max(1, o.closed - o.close);
      return o.w * (1 - k * k);
    }
    return 0;
  };
  return {
    update(dt: number) {
      t += dt;
    },
    done() {
      return t * 60 >= o.gone;
    },
    /** 지금 열린 정도 (0~1, 빛 세기용) */
    openness(): number {
      return widthAt(t * 60) / o.w;
    },
    draw(f: Frame, layer?: Layer) {
      const tick = t * 60;
      if (tick >= o.gone) return;
      const w = widthAt(tick);
      const top = o.y - o.h;
      if (layer !== 'back') return;
      // 닫힌 뒤: 선이 아래위에서 가운데로 끊어지며 가루로 흩어진다
      if (tick >= o.closed) {
        const k = (tick - o.closed) / Math.max(1, o.gone - o.closed);
        for (let v = 0; v < o.h; v++) {
          if (Math.abs(v - o.h / 2) > (o.h / 2) * (1 - k)) continue;
          put(f, o.x, top + v, k < 0.5 ? C[2]! : C[3]!);
        }
        for (const m of motes) {
          const since = (tick - o.closed) * 0.6;
          if (Math.abs(m.v * o.h - o.h / 2) < (o.h / 2) * (1 - k)) continue;
          if (since > 10) continue;
          put(f, o.x + m.side * m.drift * since, top + m.v * o.h + since * 0.3, since < 5 ? C[2]! : C[3]!);
        }
        return;
      }
      // 빛: 틈에서 달빛이 새어 나온다
      const lit = w / o.w;
      for (let v = 0; v < o.h; v += 3) glow(f, o.x, top + v, C[1]!, 0.15 + 0.35 * lit);
      if (w < 0.5) {
        // 선: 흰 심 + 은빛 테두리 (처음 한 틱은 양쪽)
        for (let v = 0; v < o.h; v++) {
          put(f, o.x, top + v, tick < 6 ? C[0]! : C[1]!);
          if (tick < 1) {
            put(f, o.x - 1, top + v, C[2]!);
            put(f, o.x + 1, top + v, C[2]!);
          }
        }
        return;
      }
      // 틈: 위아래 1/4은 곧게 뾰족해진다 (타원이 아니라 쐐기)
      const taper = o.h * 0.26;
      for (let v = 0; v < o.h; v++) {
        const edge = Math.min(v, o.h - 1 - v);
        const half = (w / 2) * Math.min(1, edge / taper);
        const hw = Math.round(half);
        const y = top + v;
        for (let u = -hw; u <= hw; u++) put(f, o.x + u, y, Math.abs(u) === hw ? C[1]! : C[6]!);
        if (hw === 0) put(f, o.x, y, C[1]!);
      }
      // 안의 달빛 반점 (천천히 반짝)
      for (const s of specks) {
        const v = s.v * o.h;
        const edge = Math.min(v, o.h - 1 - v);
        const half = (w / 2) * Math.min(1, edge / taper) - 1;
        if (half < 1) continue;
        if (((Math.floor(tick / 4) + s.tw) & 7) > 4) continue;
        put(f, o.x + s.u * half * 1.6, top + v, (s.tw & 1) ? C[4]! : C[5]!);
      }
    },
  };
}
