/**
 * 파형 그림 (확인용, 소리 시험 화면과 npm run sound의 파형 PNG가 같이 쓴다).
 * 틱 눈금(1/60초)을 세로줄로, 히트스톱 구간을 띠로 깔고 그 위에 파형(구간마다 최대·최소)을 그린다.
 */
import { TICK_SEC } from './sfx';

export interface WaveMark {
  at: number;
  stop: number;
  label: string;
}

export const WAVE_COLORS = {
  bg: '#0e0820',
  tick: '#1f1838',
  tick10: '#352a5c',
  stop: '#3b1830',
  start: '#ffd25e',
  wave: '#7fe7ff',
  text: '#f4f0e6',
  dim: '#8a80b0',
};

/** 파형을 (x, y, w, h)에 그린다. sec: 가로 전체 길이(초, 없으면 소리 길이) */
export function drawWave(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  rate: number,
  marks: readonly WaveMark[],
  x: number,
  y: number,
  w: number,
  h: number,
  sec = data.length / rate,
): void {
  ctx.fillStyle = WAVE_COLORS.bg;
  ctx.fillRect(x, y, w, h);
  const px = (t: number) => x + Math.floor((t / sec) * w);
  // 히트스톱 구간
  for (const m of marks) {
    if (m.stop <= 0) continue;
    ctx.fillStyle = WAVE_COLORS.stop;
    ctx.fillRect(px(m.at), y, Math.max(1, px(m.at + m.stop) - px(m.at)), h);
  }
  // 틱 눈금 (10틱마다 밝게). 너무 촘촘하면 10틱 눈금만
  const tickW = (TICK_SEC / sec) * w;
  for (let k = 0; k * TICK_SEC <= sec; k++) {
    if (tickW < 3 && k % 10) continue;
    ctx.fillStyle = k % 10 === 0 ? WAVE_COLORS.tick10 : WAVE_COLORS.tick;
    ctx.fillRect(px(k * TICK_SEC), y, 1, h);
  }
  // 파형: 가로 1칸마다 그 구간의 최대·최소
  const mid = y + h / 2;
  ctx.fillStyle = WAVE_COLORS.wave;
  // 가로 1칸 = sec / w초 (소리가 짧으면 오른쪽은 비어 있다)
  const n = data.length;
  for (let col = 0; col < w; col++) {
    const i0 = Math.floor((col / w) * sec * rate);
    if (i0 >= n) break;
    const i1 = Math.max(i0 + 1, Math.floor(((col + 1) / w) * sec * rate));
    let lo = 0;
    let hi = 0;
    for (let i = i0; i < i1 && i < n; i++) {
      const v = data[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const top = Math.round(mid - hi * (h / 2 - 1));
    const bot = Math.round(mid - lo * (h / 2 - 1));
    ctx.fillRect(x + col, top, 1, Math.max(1, bot - top));
  }
  // 소리 시작
  for (const m of marks) {
    ctx.fillStyle = WAVE_COLORS.start;
    ctx.fillRect(px(m.at), y, 1, h);
  }
}
