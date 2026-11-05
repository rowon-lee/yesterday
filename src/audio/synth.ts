/**
 * 합성 부품: 오실레이터, FM, 노이즈, 필터, 엔벨로프, 디스토션, 피치 스윕 (사운드기획서 1장).
 * 레시피(sfx/types.ts) 하나를 Web Audio 노드로 짜서 정해진 시각에 튼다.
 * 실시간(AudioContext)과 미리 뽑기(OfflineAudioContext, npm run sound·시험 화면 파형)가 같은 코드를 쓴다.
 * 렌더 쪽 전용: sim은 이 파일을 모른다.
 */
import type { Env, Filt, Layer, Recipe } from './sfx/types';

/** 재생 한 번의 흔들림과 히트스톱 */
export interface PlayOpts {
  /** 피치 배율 (1 그대로) */
  pitch: number;
  /** 길이 배율 (1 그대로) */
  stretch: number;
  /** 히트스톱 길이 (초). 엔벨로프 hs·층 afterStop이 쓴다 (0이면 없음) */
  stop: number;
  /** 흩뿌림 알갱이·노이즈 시작점을 고르는 난수 (0~1) */
  rng: () => number;
}

/** 소리 하나 (재생 중인 목소리) */
export interface Voice {
  /** 끝나는 시각 (컨텍스트 시간) */
  end: number;
  /** 빨리 줄여 끊는다 (동시 발음 상한을 넘을 때) */
  stop(at: number): void;
}

/** 시드 난수 (xorshift32). 미리 뽑기를 늘 같게, 노이즈 버퍼를 같게 */
export function seeded(seed: number): () => number {
  let x = seed | 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

interface Shared {
  noise: Record<'white' | 'pink' | 'brown', AudioBuffer>;
  curves: Map<number, Float32Array<ArrayBuffer>>;
}
const shared = new WeakMap<BaseAudioContext, Shared>();

/** 노이즈 버퍼 길이 (초). 재생마다 시작점을 달리해 같은 결이 되풀이되지 않게 한다 */
const NOISE_SEC = 2;

function sharedOf(ctx: BaseAudioContext): Shared {
  let s = shared.get(ctx);
  if (s) return s;
  const n = Math.floor(ctx.sampleRate * NOISE_SEC);
  const mk = (fill: (d: Float32Array, r: () => number) => void, seed: number) => {
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    fill(b.getChannelData(0), seeded(seed));
    return b;
  };
  s = {
    noise: {
      white: mk((d, r) => {
        for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
      }, 11),
      // 분홍 (Paul Kellet 근사): 고음이 덜해 고른 쉬익
      pink: mk((d, r) => {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < d.length; i++) {
          const w = r() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      }, 23),
      // 갈색: 흰 노이즈를 쌓아 낮은 웅웅거림
      brown: mk((d, r) => {
        let v = 0;
        for (let i = 0; i < d.length; i++) {
          v = (v + 0.02 * (r() * 2 - 1)) / 1.02;
          d[i] = v * 3.5;
        }
      }, 37),
    },
    curves: new Map(),
  };
  shared.set(ctx, s);
  return s;
}

/** 노이즈 버퍼를 미리 만든다 (처음 소리를 낼 때 만들지 않게) */
export function primeSynth(ctx: BaseAudioContext): void {
  sharedOf(ctx);
}

/** 디스토션 곡선 (tanh): 세기 k */
function curveOf(ctx: BaseAudioContext, k: number): Float32Array<ArrayBuffer> {
  const s = sharedOf(ctx);
  let c = s.curves.get(k);
  if (!c) {
    c = new Float32Array(1024);
    const norm = Math.tanh(k);
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh(k * ((i / (c.length - 1)) * 2 - 1)) / norm;
    s.curves.set(k, c);
  }
  return c;
}

/** 엔벨로프를 크기 값에 건다. 끝나는 시각을 돌려준다 */
function envelope(p: AudioParam, t0: number, env: Env, peak: number, o: PlayOpts): number {
  const a = Math.max(0.0005, env.a * o.stretch);
  let h = (env.h ?? 0) * o.stretch;
  // 히트스톱에 묶인 몸통: 히트스톱 × hs가 될 때까지 머문다 (히트스톱이 없으면 h 그대로)
  if (env.hs !== undefined && o.stop > 0) h = Math.max(h, o.stop * env.hs - a);
  const d = Math.max(0.002, env.d * o.stretch);
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(peak, t0 + a);
  let level = peak;
  if (h > 0) {
    level = peak * (env.hl ?? 1);
    if (env.hl !== undefined && env.hl < 1) p.exponentialRampToValueAtTime(Math.max(1e-5, level), t0 + a + h);
    else p.setValueAtTime(peak, t0 + a + h);
  }
  const end = t0 + a + h + d;
  p.exponentialRampToValueAtTime(Math.max(1e-6, level * 0.001), end);
  p.linearRampToValueAtTime(0, end + 0.004);
  return end + 0.004;
}

/** 값 하나를 f에서 t초 동안 to로 쓸어 간다 (지수: 귀에 고르게 들리게) */
function sweep(p: AudioParam, t0: number, f: number, to: number | undefined, t: number): void {
  p.setValueAtTime(f, t0);
  if (to !== undefined && to !== f) p.exponentialRampToValueAtTime(Math.max(1, to), t0 + Math.max(0.001, t));
}

function filterNode(ctx: BaseAudioContext, t0: number, flt: Filt, o: PlayOpts, total: number): BiquadFilterNode {
  const n = ctx.createBiquadFilter();
  n.type = flt.type;
  n.Q.value = flt.q ?? 0.707;
  sweep(n.frequency, t0, flt.f * o.pitch, flt.to !== undefined ? flt.to * o.pitch : undefined, (flt.t ?? total) * o.stretch);
  return n;
}

/** 층의 소리 → (필터) → (디스토션) → 엔벨로프 → out. 마지막에 붙은 노드(엔벨로프)를 돌려준다 */
function chain(ctx: BaseAudioContext, src: AudioNode, layer: Layer, t0: number, o: PlayOpts, total: number, out: AudioNode): GainNode {
  let node = src;
  if (layer.filter) {
    const f = filterNode(ctx, t0, layer.filter, o, total);
    node.connect(f);
    node = f;
  }
  if (layer.drive && layer.drive > 0) {
    const w = ctx.createWaveShaper();
    w.curve = curveOf(ctx, layer.drive);
    w.oversample = '2x';
    node.connect(w);
    node = w;
  }
  const g = ctx.createGain();
  g.gain.value = 0;
  node.connect(g);
  g.connect(out);
  return g;
}

const envLen = (e: Env, o: PlayOpts) => {
  let h = (e.h ?? 0) * o.stretch;
  if (e.hs !== undefined && o.stop > 0) h = Math.max(h, o.stop * e.hs - e.a * o.stretch);
  return e.a * o.stretch + h + e.d * o.stretch;
};

/** 층 하나를 t0에 튼다. 끝나는 시각과 멈출 소스들을 돌려준다 */
function playLayer(ctx: BaseAudioContext, layer: Layer, t: number, o: PlayOpts, out: AudioNode): { end: number; srcs: AudioScheduledSourceNode[]; last: AudioScheduledSourceNode } {
  const t0 = t + (layer.at ?? 0) * o.stretch + (layer.afterStop ? o.stop : 0);
  switch (layer.kind) {
    case 'osc': {
      const total = envLen(layer.env, o);
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      sweep(osc.frequency, t0, layer.f * o.pitch, layer.to !== undefined ? layer.to * o.pitch : undefined, (layer.t ?? total) * o.stretch);
      const g = chain(ctx, osc, layer, t0, o, total, out);
      const end = envelope(g.gain, t0, layer.env, layer.gain, o);
      osc.start(t0);
      osc.stop(end + 0.01);
      return { end, srcs: [osc], last: osc };
    }
    case 'fm': {
      const total = envLen(layer.env, o);
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const depth = ctx.createGain();
      const f = layer.f * o.pitch;
      sweep(car.frequency, t0, f, layer.to !== undefined ? layer.to * o.pitch : undefined, (layer.t ?? total) * o.stretch);
      mod.frequency.setValueAtTime(f * layer.ratio, t0);
      // 변조 깊이 = 변조파 주파수 × index (Hz)
      const fmHz = f * layer.ratio;
      depth.gain.setValueAtTime(fmHz * layer.index, t0);
      if (layer.indexTo !== undefined) depth.gain.exponentialRampToValueAtTime(Math.max(1, fmHz * layer.indexTo), t0 + Math.max(0.002, total));
      mod.connect(depth);
      depth.connect(car.frequency);
      const g = chain(ctx, car, layer, t0, o, total, out);
      const end = envelope(g.gain, t0, layer.env, layer.gain, o);
      car.start(t0);
      mod.start(t0);
      car.stop(end + 0.01);
      mod.stop(end + 0.01);
      return { end, srcs: [car, mod], last: car };
    }
    case 'noise': {
      const total = envLen(layer.env, o);
      const src = ctx.createBufferSource();
      src.buffer = sharedOf(ctx).noise[layer.color];
      src.loop = true;
      // 시작점을 달리해 매번 다른 결
      const offset = o.rng() * (NOISE_SEC - 0.1);
      const g = chain(ctx, src, layer, t0, o, total, out);
      const end = envelope(g.gain, t0, layer.env, layer.gain, o);
      src.start(t0, offset);
      src.stop(end + 0.01);
      return { end, srcs: [src], last: src };
    }
    case 'scatter': {
      let end = t0;
      const srcs: AudioScheduledSourceNode[] = [];
      let last: AudioScheduledSourceNode | null = null;
      const [flo, fhi] = layer.f;
      for (let i = 0; i < layer.count; i++) {
        const at = t0 + (layer.spread[0] + o.rng() * (layer.spread[1] - layer.spread[0])) * o.stretch;
        const f = flo * Math.pow(fhi / flo, o.rng()) * o.pitch;
        const d = layer.d[0] + o.rng() * (layer.d[1] - layer.d[0]);
        const env: Env = { a: layer.a, d };
        const osc = ctx.createOscillator();
        osc.type = layer.wave;
        const total = envLen(env, o);
        sweep(osc.frequency, at, f, layer.rise !== undefined ? f * layer.rise : undefined, total);
        const g = chain(ctx, osc, layer, at, o, total, out);
        // 알갱이마다 크기를 조금씩 달리 (앞 알갱이일수록 크게)
        const e = envelope(g.gain, at, env, layer.gain * (0.45 + 0.55 * o.rng()) * (1 - (0.5 * i) / layer.count), o);
        osc.start(at);
        osc.stop(e + 0.01);
        srcs.push(osc);
        if (e >= end) last = osc;
        end = Math.max(end, e);
      }
      // 알갱이가 0개인 레시피는 없다 (count ≥ 1)
      return { end, srcs, last: last ?? srcs[0]! };
    }
  }
}

/**
 * 레시피를 t에 튼다: 층들 → 목소리 크기 → out, 그리고 → send (리버브).
 * 끝나는 시각과 끊기 함수를 돌려준다
 */
export function playRecipe(ctx: BaseAudioContext, recipe: Recipe, t: number, o: PlayOpts, out: AudioNode, send: AudioNode | null): Voice {
  const v = ctx.createGain();
  v.gain.value = recipe.gain;
  v.connect(out);
  let sendGain: GainNode | null = null;
  if (send && recipe.send > 0) {
    sendGain = ctx.createGain();
    sendGain.gain.value = recipe.send;
    v.connect(sendGain);
    sendGain.connect(send);
  }
  let end = t;
  const srcs: AudioScheduledSourceNode[] = [];
  let last: AudioScheduledSourceNode | null = null;
  for (const layer of recipe.layers) {
    const r = playLayer(ctx, layer, t, o, v);
    if (r.end >= end) last = r.last;
    end = Math.max(end, r.end);
    srcs.push(...r.srcs);
  }
  // 가장 늦게 끝나는 소스가 끝나면 연결을 풀어 노드가 쌓이지 않게
  if (last) {
    last.onended = () => {
      v.disconnect();
      sendGain?.disconnect();
    };
  }
  return {
    end,
    stop(at: number) {
      v.gain.cancelScheduledValues(at);
      v.gain.setValueAtTime(v.gain.value, at);
      v.gain.linearRampToValueAtTime(0, at + 0.006);
      for (const s of srcs) {
        try {
          s.stop(at + 0.01);
        } catch {
          // 이미 멈춤
        }
      }
    },
  };
}

/** 레시피가 끝나는 데 걸리는 시간 (초, 흔들림 없이) */
export function recipeLength(recipe: Recipe, stop: number): number {
  const o: PlayOpts = { pitch: 1, stretch: 1, stop, rng: () => 1 };
  let end = 0;
  for (const l of recipe.layers) {
    const t0 = (l.at ?? 0) + (l.afterStop ? stop : 0);
    if (l.kind === 'scatter') end = Math.max(end, t0 + l.spread[1] + l.a + l.d[1]);
    else end = Math.max(end, t0 + envLen(l.env, o));
  }
  return end;
}
