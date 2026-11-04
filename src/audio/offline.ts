/**
 * 미리 뽑기: 소리 순서를 OfflineAudioContext로 실제 엔진과 같은 믹서·부품에 통과시켜 파형으로 만든다.
 * npm run sound(WAV)와 소리 시험 화면(파형 그림)이 쓴다. 흔들림은 시드 난수라 늘 같은 결과.
 *
 * 리미터(브라우저 압축기)는 켜진 직후 수십 ms 동안 소리를 줄여 시작한다. 게임에서는 오디오를 켠 뒤 한참 지나 소리가 나므로
 * 그 상태와 같게 하려고 LEAD초 무음으로 리미터를 데운 뒤 그 앞부분을 잘라 낸다 (잘린 파일의 0초 = 첫 소리를 부른 시각).
 */
import { Mixer } from './mixer';
import { JITTER, recipeFor, TICK_SEC } from './sfx';
import type { SoundItem } from './sfx/catalog';
import { recipeLength, seeded, type PlayOpts } from './synth';
import type { TimedCue } from './demo';

const LEAD = 0.3;

export interface OfflineResult {
  /** 샘플 (모노). 0번 샘플 = 첫 소리를 부른 시각 */
  data: Float32Array;
  rate: number;
  /** 소리마다 부른 시각 (초)과 히트스톱 길이 (초) */
  marks: Array<{ at: number; stop: number; label: string }>;
}

export interface RenderOpts {
  rate: number;
  jitter: boolean;
  /** 끝에 더 남기는 여유 (초) */
  tail?: number;
  seed?: number;
  /** 리버브를 빼고 (울림 없는 소리 길이를 잴 때) */
  dry?: boolean;
}

export async function renderCues(cues: TimedCue[], opts: RenderOpts): Promise<OfflineResult> {
  const t0 = Math.min(0, ...cues.map((c) => c.tick));
  const placed = cues.map((c) => ({ at: (c.tick - t0) * TICK_SEC, c: c.cue, mute: c.mute === true }));
  let end = 0;
  for (const p of placed) end = Math.max(end, p.at + recipeLength(recipeFor(p.c), p.c.stop * TICK_SEC) * (1 + JITTER.stretch));
  // 리버브 꼬리가 들어갈 자리
  const sec = end + (opts.tail ?? (opts.dry ? 0.1 : 0.6));
  const ctx = new OfflineAudioContext(1, Math.ceil((LEAD + sec) * opts.rate), opts.rate);
  const mixer = new Mixer(ctx);
  const r = seeded(opts.seed ?? 7);
  const marks: OfflineResult['marks'] = [];
  for (const p of placed) {
    const o: PlayOpts = {
      pitch: opts.jitter ? 1 + (r() * 2 - 1) * JITTER.pitch : 1,
      stretch: opts.jitter ? 1 + (r() * 2 - 1) * JITTER.stretch : 1,
      stop: p.c.stop * TICK_SEC,
      rng: r,
    };
    let recipe = recipeFor(p.c);
    if (p.mute) recipe = { ...recipe, gain: 0 };
    if (opts.dry) recipe = { ...recipe, send: 0 };
    mixer.play(recipe, LEAD + p.at, o);
    if (p.c.sound !== 'bed') marks.push({ at: p.at, stop: o.stop, label: `${p.c.sound} ${p.c.step}` });
  }
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0).slice(Math.round(LEAD * opts.rate));
  return { data, rate: opts.rate, marks };
}

export function renderItem(item: SoundItem, rate = 22050, dry = false): Promise<OfflineResult> {
  return renderCues(item.cues(), { rate, jitter: item.jitter === true, dry });
}
