/**
 * 실시간 소리 엔진 (렌더 쪽 전용, sim은 모른다). 믹서(mixer.ts) 하나를 브라우저 AudioContext 위에 둔다.
 *
 * - 휴대폰: 브라우저는 사람이 화면을 누르거나 키를 누르기 전에는 소리를 못 낸다 (자동 재생 제한).
 *   installAudioUnlock()이 첫 터치·클릭·키 입력 때 오디오를 켠다 (첫 화면이 타이틀이라 보통 타이틀에서 켜진다).
 *   탭이 가려지면 멈추고, 돌아오면 다시 켠다.
 * - 음량: settings.ts의 전체·음악·효과음을 믹서에 건다. 아이폰 무음 스위치를 따를지도 (navigator.audioSession).
 * - 재생할 때마다 피치·길이를 조금씩 흔든다 (기계 소리처럼 되풀이되지 않게). 시험 화면에서 끌 수 있다.
 * - 같은 소리가 한 틱(1/60초) 안에 여러 번 오면 하나로 합친다.
 */
import { Mixer } from './mixer';
import { audioSettings, levelGain, onAudioSettings, type AudioSettings } from './settings';
import { JITTER, recipeFor, TICK_SEC, type Cue } from './sfx';
import type { Recipe } from './sfx/types';
import type { PlayOpts, Voice } from './synth';

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private mixer: Mixer | null = null;
  /** 같은 소리 합치기: 소리 열쇠 → 마지막으로 튼 시각 */
  private last = new Map<string, number>();
  /** 피치·길이 흔들기 (시험 화면에서 끌 수 있다) */
  jitter = true;
  /** 사람이 한 번이라도 눌러 켰다 (탭이 다시 보일 때 다시 켜도 되는지) */
  private unlocked = false;

  constructor() {
    onAudioSettings((s) => this.apply(s));
  }

  /** 소리를 낼 수 있는 상태 */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** 지금 컨텍스트 (시험 화면이 시각을 읽는다). 아직 안 켰으면 null */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** 사람의 입력 안에서 부른다: 컨텍스트를 만들고 켠다 */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.applySession(audioSettings());
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.mixer = new Mixer(this.ctx);
      this.apply(audioSettings());
    }
    this.unlocked = true;
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => {});
      // 옛 아이폰 사파리: 입력 안에서 소리를 한 번 내야 풀린다 (1샘플 무음)
      const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = b;
      src.connect(this.ctx.destination);
      src.start();
    }
  }

  /** 탭이 가려짐·다시 보임 */
  visible(on: boolean): void {
    if (!this.ctx) return;
    if (!on) void this.ctx.suspend().catch(() => {});
    else if (this.unlocked) void this.ctx.resume().catch(() => {});
  }

  private apply(s: AudioSettings): void {
    this.applySession(s);
    this.mixer?.setLevels({ master: levelGain(s.master), music: levelGain(s.music), sfx: levelGain(s.sfx) });
  }

  /** 아이폰 무음 스위치: follow면 스위치를 따르고(무음이면 안 남), ignore면 재생 소리로 다룬다(무음이어도 남) */
  private applySession(s: AudioSettings): void {
    const nav = navigator as AudioSessionNav;
    if (!nav.audioSession) return;
    try {
      nav.audioSession.type = s.silent === 'ignore' ? 'playback' : 'auto';
    } catch {
      // 받지 않는 값이면 그대로
    }
  }

  private opts(stop: number): PlayOpts {
    const r = () => (Math.random() * 2 - 1);
    return {
      pitch: this.jitter ? 1 + r() * JITTER.pitch : 1,
      stretch: this.jitter ? 1 + r() * JITTER.stretch : 1,
      stop,
      rng: Math.random,
    };
  }

  /** 레시피를 바로 튼다 (key가 같은 소리는 한 틱 안에 한 번). 켜지지 않았으면 아무것도 안 함 */
  play(recipe: Recipe, stopTicks = 0, key?: string, delay = 0): Voice | null {
    if (!this.ctx || !this.mixer || this.ctx.state !== 'running') return null;
    const t = this.ctx.currentTime + delay;
    if (key) {
      const prev = this.last.get(key);
      if (prev !== undefined && Math.abs(t - prev) < TICK_SEC * 0.99) return null;
      this.last.set(key, t);
    }
    return this.mixer.play(recipe, t, this.opts(stopTicks * TICK_SEC));
  }

  /** sim 사건에서 나온 소리 하나 */
  cue(c: Cue, delay = 0): Voice | null {
    return this.play(recipeFor(c), c.stop, `${c.sound}:${c.step}`, delay);
  }

  /** 지금 울리는 소리 수 (시험 화면 표시용) */
  active(): number {
    return this.ctx && this.mixer ? this.mixer.active(this.ctx.currentTime) : 0;
  }
}

/** 게임 전체가 쓰는 엔진 하나 */
export const audio = new AudioEngine();

let installed = false;

/**
 * 첫 입력 때 오디오 켜기 (사운드기획서 0장 '휴대폰'). main.ts가 한 번 부른다.
 * 아이폰은 touchend·click 안에서만 풀리는 경우가 있어 여러 입력을 다 듣는다. 켜진 뒤에도 남겨 두어 (잠금 화면 뒤 등) 다시 켠다
 */
export function installAudioUnlock(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const go = () => {
    if (!audio.running) audio.unlock();
  };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(ev, go, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => audio.visible(document.visibilityState === 'visible'));
}
