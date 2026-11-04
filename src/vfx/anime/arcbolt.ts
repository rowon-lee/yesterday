// YESTERDAY 애니 이펙트 — 번개 반원 (발차기 궤적, 렌더 전용).
// 사용자 피드백 2026-11-04 '미들킥의 매끈한 초승달은 금지(9-2) → 번개 줄기로 그린 반원'.
// 발이 지난 반원을 따라 지그재그 번개 줄기 몇 가닥을 나란히 긋는다 (가운데 줄기가 가장 굵고 판정 안에서는 흰 심).
// 반원 바깥으로 짧은 전류 가지가 튄다. 14-2대로 0틱에 다 나타나고, 찢어지는 동안 반원의 시작 쪽(발이 먼저 지난 쪽)부터 끊기며 가늘어진다.
import { clamp01, rng, TIMING, type AFrame, type Grade, type Layer, type Ramp4 } from './common';
import { boltColor, jag, jagAlong, stroke, type P } from './bolt';

export interface ArcBoltSpec {
  /** 반원 가운데 (공격자 기준 좌표, 보는 쪽 반영)·반지름 (px)·시작각 → 끝각 (라디안, 화면 y가 아래로 +) */
  center: readonly [number, number];
  r: number;
  a0: number;
  a1: number;
  /** 줄기 수 (2~4), 줄기 사이 (px), 가운데 줄기 굵기 (px) */
  bolts?: number;
  gap?: number;
  width?: number;
  /** 바깥으로 튀는 전류 가지 수·길이 (px) */
  forks?: number;
  forkLen?: number;
  ramp: Ramp4;
  grade: Grade;
  timing?: { hold: number; tear: number };
  /** 판정 범위 (공격자 기준 좌표) */
  range?: (x: number, y: number) => boolean;
  /** 공격자 발밑 (월드 px, 정수)과 보는 쪽 (center·각은 오른쪽 보는 기준) */
  offset: readonly [number, number];
  facing?: number;
  /** 몇 틱마다 다시 꺾나 */
  crackle?: number;
  layer?: Layer;
  seed?: number;
}

export default function arcBolt(o: ArcBoltSpec) {
  const T0 = TIMING[o.grade];
  const T = { hold: o.timing?.hold ?? T0.hold, tear: o.timing?.tear ?? T0.tear };
  const [OX, OY] = o.offset;
  const fc = (o.facing ?? 1) >= 0 ? 1 : -1;
  const range = o.range ?? (() => false);
  const colorBolt = boltColor(o.ramp, (X, Y) => range(X - OX, Y - OY));
  const nb = Math.max(1, o.bolts ?? 3);
  const gap = o.gap ?? 5;
  const crackle = o.crackle ?? 2;
  // 앞 겹 (기본): 반원이 맞는 쪽 몸에 가려지지 않게 (14-5 '앞겹 이펙트는 맞는 쪽을 덮고') — 공격자 몸통은 반원 밖이라 덮지 않는다
  const layer = o.layer ?? 'front';
  /** 반지름 rr의 반원 위 점들 (2px 간격), 그리고 그 점의 바깥 방향 */
  const arc = (rr: number, from = 0, to = 1): P[] => {
    const span = o.a1 - o.a0;
    const n = Math.max(6, Math.ceil((Math.abs(span) * rr) / 2));
    const out: P[] = [];
    for (let k = 0; k <= n; k++) {
      const t = from + ((to - from) * k) / n;
      const a = o.a0 + span * t;
      out.push([fc * (o.center[0] + Math.cos(a) * rr) + OX, o.center[1] + Math.sin(a) * rr + OY]);
    }
    return out;
  };
  let t = 0;
  const progress = () => (t <= T.hold ? 0 : clamp01((t - T.hold) / (T.tear - T.hold)));
  return {
    /** 확인용: 반원 길이 (px), 줄기 수, 가지 수 */
    metrics() {
      return { arcLen: Math.abs(o.a1 - o.a0) * o.r, bolts: nb, forks: o.forks ?? 0 };
    },
    update(dt: number) {
      t += dt * 60;
    },
    done() {
      return t >= T.tear;
    },
    draw(f: AFrame, l?: Layer) {
      if ((l ?? 'back') !== layer || t >= T.tear) return;
      const p = progress();
      const r = rng((o.seed ?? 1) * 131 + Math.floor(t / crackle) * 7919);
      // 찢어지는 동안: 반원의 시작 쪽부터 끊긴다 (남은 구간 from → 1)
      const from = clamp01(p * 1.05);
      for (let b = 0; b < nb; b++) {
        const mid = (nb - 1) / 2;
        const rr = o.r + (b - mid) * gap;
        const centerBolt = Math.abs(b - mid) < 0.6;
        const w = Math.max(1, (centerBolt ? o.width ?? 3 : Math.max(1, (o.width ?? 3) - 1.5)) * (1 - 0.6 * p));
        // 줄기마다 끝 자리를 조금씩 다르게 (들쭉날쭉)
        const end = clamp01(1 - (centerBolt ? 0 : 0.06 + 0.08 * r()));
        if (end <= from) continue;
        // 반원 모양이 읽히게 꺾임은 작게 (가운데 줄기가 가장 덜 꺾인다)
        const pts = jagAlong(arc(rr, from, end), centerBolt ? 1.4 : 2, 7, r);
        stroke(f, pts, w, Math.max(1, w - 1), colorBolt);
      }
      // 바깥으로 튀는 전류 가지 (피크와 찢어지는 앞쪽 동안)
      if (p < 0.5) {
        const nf = o.forks ?? 0;
        for (let k = 0; k < nf; k++) {
          const u = 0.2 + (0.7 * (k + r())) / Math.max(1, nf);
          if (u < from) continue;
          const a = o.a0 + (o.a1 - o.a0) * u;
          const rr = o.r + gap * (nb / 2);
          const x = fc * (o.center[0] + Math.cos(a) * rr) + OX;
          const y = o.center[1] + Math.sin(a) * rr + OY;
          const L = (o.forkLen ?? 14) * (0.7 + r() * 0.6);
          // 바깥 방향에서 발이 지나는 쪽으로 조금 기운다
          const out = a + Math.sign(o.a1 - o.a0) * (0.25 + r() * 0.35);
          const tip: P = [x + fc * Math.cos(out) * L, y + Math.sin(out) * L];
          stroke(f, jag([x, y], tip, 2, 5, r), Math.max(1, 2 * (1 - p)), 1, colorBolt);
        }
      }
    },
  };
}
