// npm run sound가 헤드리스 브라우저로 여는 페이지. 소리 번호표(src/audio/sfx/catalog.ts)를 실제 엔진과 같은 믹서로
// OfflineAudioContext에 뽑아 샘플(Float32)과 시작·히트스톱 표시를 넘긴다. 파형 모음 그림(PNG)도 그린다.
import { SOUNDS } from '../../src/audio/sfx/catalog';
import { renderCues, renderItem } from '../../src/audio/offline';
import { drawWave, WAVE_COLORS } from '../../src/audio/wave';
import { recipeFor } from '../../src/audio/sfx';

const params = new URLSearchParams(location.search);
const rate = Number(params.get('rate') ?? 22050);

const b64 = (f: Float32Array) => {
  const u8 = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
};

interface Out {
  no: number;
  file: string;
  name: string;
  note: string;
  target?: readonly [number, number];
  rate: number;
  marks: Array<{ at: number; stop: number; label: string }>;
  pcm: string;
  /** 리버브를 뺀 판 (소리 자체 길이를 잰다) */
  dry: string;
  /** 덕킹 확인용: 타격 소리를 0으로 하고 바닥 소리만 남긴 판 (덕킹은 그대로 걸린다) */
  bedOnly?: string;
}

async function main(): Promise<void> {
  const out: Out[] = [];
  const waves: Array<{ data: Float32Array; marks: Out['marks']; label: string }> = [];
  for (const it of SOUNDS) {
    const r = await renderItem(it, rate);
    const data = r.data;
    const dry = await renderItem(it, rate, true);
    const o: Out = { no: it.no, file: it.file, name: it.name, note: it.note, target: it.target, rate, marks: r.marks, pcm: b64(data), dry: b64(dry.data) };
    if (it.bed) {
      const cues = it.cues().map((c) => (c.cue.sound === 'bed' ? c : { ...c, mute: true }));
      const muted = await renderCues(cues, { rate, jitter: false });
      o.bedOnly = b64(muted.data);
    }
    out.push(o);
    waves.push({ data, marks: r.marks, label: `${String(it.no).padStart(2, '0')} ${it.file}` });
  }
  // 파형 모음: 한 줄에 하나. 소리 하나는 가로 0.5초, 여러 소리를 이은 것은 2.2초 (같은 축끼리 길이를 견줄 수 있게)
  const W = 900;
  const H = 70;
  const LABEL = 150;
  const cv = document.getElementById('sheet') as HTMLCanvasElement;
  cv.width = W + LABEL;
  cv.height = waves.length * (H + 6) + 6;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.font = '13px sans-serif';
  waves.forEach((w, i) => {
    const y = 6 + i * (H + 6);
    const long = w.marks.length > 1;
    drawWave(ctx, w.data, rate, w.marks, LABEL, y, W, H, long ? 2.2 : 0.5);
    ctx.fillStyle = WAVE_COLORS.text;
    ctx.fillText(w.label, 6, y + 18);
    ctx.fillStyle = WAVE_COLORS.dim;
    ctx.fillText(long ? '가로 2.2초' : '가로 0.5초', 6, y + 38);
    ctx.fillText('세로줄 = 1틱', 6, y + 56);
  });
  (window as unknown as { __sound: unknown }).__sound = { items: out, png: cv.toDataURL('image/png') };
}

// 시험: 레시피 표가 비어 있지 않은지 (빈 레시피면 소리가 안 남)
if (!recipeFor({ sound: 'hitLight', step: 1 }).layers.length) throw new Error('빈 레시피');
main().catch((e) => {
  (window as unknown as { __soundError: string }).__soundError = String(e?.stack ?? e);
});
