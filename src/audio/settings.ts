/**
 * 소리 설정 (사운드기획서 0장 '음량'): 전체·음악·효과음 세 가지 (0~10단계)와 아이폰 무음 스위치를 따를지.
 * 브라우저(localStorage)에 저장한다. 무대 소리(비·네온, 나중)는 효과음 음량을 따른다.
 */
export const VOLUME_MAX = 10;

export type VolumeName = 'master' | 'music' | 'sfx';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  /** 아이폰 무음 스위치: follow = 무음이면 소리가 안 남 (기본), ignore = 무음이어도 남 */
  silent: 'follow' | 'ignore';
}

export const DEFAULT_SETTINGS: AudioSettings = { master: 8, music: 7, sfx: 8, silent: 'follow' };

const KEY = 'yesterday.audio';
let current: AudioSettings = load();
const listeners: Array<(s: AudioSettings) => void> = [];

function load(): AudioSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<AudioSettings>;
    const lvl = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(VOLUME_MAX, Math.round(x))) : d);
    return {
      master: lvl(v.master, DEFAULT_SETTINGS.master),
      music: lvl(v.music, DEFAULT_SETTINGS.music),
      sfx: lvl(v.sfx, DEFAULT_SETTINGS.sfx),
      silent: v.silent === 'ignore' ? 'ignore' : 'follow',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function audioSettings(): Readonly<AudioSettings> {
  return current;
}

export function setAudioSettings(patch: Partial<AudioSettings>): void {
  current = { ...current, ...patch };
  for (const k of ['master', 'music', 'sfx'] as const) current[k] = Math.max(0, Math.min(VOLUME_MAX, Math.round(current[k])));
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 저장이 막힌 브라우저 (사생활 보호 창 등): 이번 접속 동안만
  }
  for (const f of listeners) f(current);
}

/** 한 단계 올리거나 내린다. wrap이면 끝에서 처음으로 (메뉴에서 누르기) */
export function stepVolume(name: VolumeName, d: number, wrap = false): void {
  let v = current[name] + d;
  if (wrap) v = (v + VOLUME_MAX + 1) % (VOLUME_MAX + 1);
  setAudioSettings({ [name]: v });
}

export function onAudioSettings(f: (s: AudioSettings) => void): void {
  listeners.push(f);
}

/** 단계 → 크기 배율. 귀에 고르게 들리도록 제곱 (5단계 ≈ -12dB, 0은 무음) */
export function levelGain(level: number): number {
  const x = Math.max(0, Math.min(VOLUME_MAX, level)) / VOLUME_MAX;
  return x * x;
}

/** 이 브라우저가 무음 스위치 설정을 받는가 (아이폰·아이패드 사파리 16.4+의 navigator.audioSession) */
export function silentSwitchSupported(): boolean {
  return typeof navigator !== 'undefined' && 'audioSession' in navigator;
}
