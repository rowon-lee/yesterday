/**
 * 믹서 (사운드기획서 0장 '믹스'): 음악·효과음·무대 버스 → 전체 음량 → 리미터 → 스피커.
 * 효과음이 음악보다 위. 강타는 focus 길로 가서 낮아지지 않고, 나머지(효과음·무대·음악)는 히트스톱 동안 낮아진다 (덕킹).
 * 실시간 엔진(engine.ts)과 미리 뽑기(npm run sound, 시험 화면 파형)가 같은 믹서를 쓴다.
 *
 *   보통 효과음 → duck.sfx ┐
 *   무대 소리   → duck.stage ┼→ sfxVol ┐
 *   강타        → focus      ┤          ├→ mix → masterVol → 리미터 → 출력
 *   리버브 되돌림 ───────────┘          │
 *   음악        → duck.music → musicVol ┘
 */
import { playRecipe, seeded, type PlayOpts, type Voice } from './synth';
import type { BusName, Recipe } from './sfx/types';

/** 동시 발음 상한 (사운드기획서 0장 '성능') */
export const MAX_VOICES = 24;

/** 덕킹: 내려가는 시간, 다시 올라오는 시간 (초) */
const DUCK_ATTACK = 0.004;
const DUCK_RELEASE = 0.09;
/** 리버브 울림 크기 (임펄스 에너지의 제곱근). 레시피의 send와 곱해진다 */
const REVERB_LEVEL = 1;
/** 믹스 여유: 버스를 합친 뒤 리미터 앞에서 이만큼 낮춘다 */
const HEADROOM = 0.8;

export interface MixLevels {
  master: number;
  music: number;
  sfx: number;
}

export class Mixer {
  readonly ctx: BaseAudioContext;
  private readonly masterVol: GainNode;
  private readonly musicVol: GainNode;
  private readonly sfxVol: GainNode;
  private readonly duckGain: { sfx: GainNode; stage: GainNode; music: GainNode };
  private readonly focus: GainNode;
  private readonly reverbIn: GainNode;
  private voices: Array<Voice & { bus: BusName }> = [];
  /** 덕킹이 풀리는 시각 (겹치면 늦은 쪽까지) */
  private duckUntil = 0;

  constructor(ctx: BaseAudioContext, out: AudioNode = ctx.destination) {
    this.ctx = ctx;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    // 리미터: 여러 소리가 겹쳐도 찢어지지 않게 (빠르게 잡고 빠르게 놓음)
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    limiter.connect(out);
    this.masterVol = g();
    this.masterVol.connect(limiter);
    const mix = g(HEADROOM);
    mix.connect(this.masterVol);
    this.musicVol = g();
    this.musicVol.connect(mix);
    this.sfxVol = g();
    this.sfxVol.connect(mix);
    this.duckGain = { sfx: g(), stage: g(), music: g() };
    this.duckGain.sfx.connect(this.sfxVol);
    this.duckGain.stage.connect(this.sfxVol);
    this.duckGain.music.connect(this.musicVol);
    this.focus = g();
    this.focus.connect(this.sfxVol);
    // 리버브: 비 오는 밤 거리 (짧은 앞 지연 + 어두운 꼬리)
    this.reverbIn = g();
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 1.3, 0.012);
    this.reverbIn.connect(verb);
    verb.connect(this.sfxVol);
  }

  /** 음량 (배율). 바뀌는 순간 틱 소리가 나지 않게 짧게 옮겨 간다 */
  setLevels(l: MixLevels): void {
    const t = this.ctx.currentTime;
    for (const [node, v] of [[this.masterVol, l.master], [this.musicVol, l.music], [this.sfxVol, l.sfx]] as const) {
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(v, t, 0.02);
    }
  }

  /** 레시피를 t에 튼다. 동시 발음 상한을 넘으면 가장 오래된 보통 소리부터 끊는다 */
  play(recipe: Recipe, t: number, o: PlayOpts): Voice {
    this.voices = this.voices.filter((v) => v.end > t);
    while (this.voices.length >= MAX_VOICES) {
      // 강타(focus)는 끊지 않는다. 다 강타면 가장 오래된 것
      const i = Math.max(0, this.voices.findIndex((v) => v.bus !== 'focus'));
      this.voices[i]!.stop(t);
      this.voices.splice(i, 1);
    }
    const out = recipe.bus === 'focus' ? this.focus : recipe.bus === 'stage' ? this.duckGain.stage : this.duckGain.sfx;
    const v = playRecipe(this.ctx, recipe, t, o, out, this.reverbIn);
    this.voices.push({ ...v, bus: recipe.bus });
    if (recipe.duck && o.stop > 0) this.duck(t, o.stop, recipe.duck);
    return v;
  }

  /** 지금 울리는 소리 수 */
  active(t: number): number {
    return this.voices.filter((v) => v.end > t).length;
  }

  /**
   * 덕킹: t부터 hold초 동안 효과음·무대·음악을 db만큼 낮췄다가 다시 올린다 (강타의 히트스톱 동안).
   * 덕킹이 겹치면 늦게 풀리는 쪽까지 이어진다
   */
  duck(t: number, hold: number, db: number): void {
    const low = Math.pow(10, -Math.abs(db) / 20);
    const until = Math.max(this.duckUntil, t + hold);
    for (const n of Object.values(this.duckGain)) {
      const p = n.gain;
      p.cancelScheduledValues(t);
      // 이미 낮아져 있으면 그 자리에서 이어 간다
      p.setValueAtTime(t < this.duckUntil + DUCK_RELEASE ? Math.min(1, p.value) : 1, t);
      p.linearRampToValueAtTime(low, t + DUCK_ATTACK);
      p.setValueAtTime(low, until);
      p.linearRampToValueAtTime(1, until + DUCK_RELEASE);
    }
    this.duckUntil = until;
  }
}

/** 리버브 울림 (코드로 만든 임펄스): 길이 sec, 앞 지연 pre. 시간이 갈수록 어두워지는 노이즈 꼬리 */
function impulse(ctx: BaseAudioContext, sec: number, pre: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * sec);
  const ch = Math.min(2, ctx.destination.channelCount || 1);
  const buf = ctx.createBuffer(ch, n, rate);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    const r = seeded(101 + c * 7);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      if (t < pre) continue;
      const k = (t - pre) / (sec - pre);
      // 뒤로 갈수록 한 극 저역 통과를 세게 (빗속에서 먼 벽에 맞고 돌아오는 어두운 울림)
      const a = 0.55 + 0.4 * k;
      lp = lp * a + (r() * 2 - 1) * (1 - a);
      d[i] = lp * Math.exp(-5.2 * k);
    }
    // 에너지를 1로 맞춘다 (보내는 양 send가 그대로 울림 크기가 되게)
    let e = 0;
    for (let i = 0; i < n; i++) e += d[i]! * d[i]!;
    const k = e > 0 ? REVERB_LEVEL / Math.sqrt(e) : 0;
    for (let i = 0; i < n; i++) d[i]! *= k;
  }
  return buf;
}
