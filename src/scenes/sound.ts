import { audio } from '../audio/engine';
import { MUSIC_LAYERS, MUSIC_READY } from '../audio/music';
import { renderItem } from '../audio/offline';
import { audioSettings, onAudioSettings, setAudioSettings, silentSwitchSupported, VOLUME_MAX, type VolumeName } from '../audio/settings';
import { TICK_SEC } from '../audio/sfx';
import { SOUNDS, type SoundItem } from '../audio/sfx/catalog';
import { drawWave, WAVE_COLORS, type WaveMark } from '../audio/wave';
import type { TimedCue } from '../audio/demo';
import { drawText, textWidth } from '../render/font';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import type { App, Scene } from './scene';

/**
 * 소리 시험 화면 (?scene=sound, 타이틀 → OPTIONS → SOUND → SOUND TEST). 사운드기획서 4장.
 * 아래 버튼을 누르면 그 번호의 소리를 실제 엔진(지금 음량 설정 그대로)으로 튼다. 번호는 PR·previews/sound/의 WAV와 같다.
 * 화면에는 마지막으로 튼 소리의 파형을 그린다: 노란 세로줄 = 소리를 부른 틱, 붉은 띠 = 히트스톱, 가는 세로줄 = 1틱.
 * 파형은 흔들림 없는 기준 소리 (실제로 들리는 소리는 흔들림이 켜져 있으면 매번 조금씩 다르다).
 * 음악 층 버튼은 곡을 만든 뒤 켜진다 (지금은 흐리게).
 */
export function soundScene(app: App): Scene {
  let tick = 0;
  let current: SoundItem | null = null;
  let wave: { data: Float32Array; rate: number; marks: WaveMark[] } | null = null;
  let lastPlayed = -1;

  const ui = document.createElement('div');
  ui.className = 'ui sound';
  const style = document.createElement('style');
  style.textContent = `
.ui.sound{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));max-height:52dvh;overflow-y:auto}
.ui.sound button{font-size:14px;min-height:38px;padding:0 8px;text-align:left}
.ui.sound .row{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-weight:700;font-size:14px}
.ui.sound label{display:flex;align-items:center;gap:6px}
.ui.sound input[type=range]{width:110px}
.ui.sound button:disabled{opacity:.4;cursor:default}
.ui.sound .note{grid-column:1/-1;font-size:12px;font-weight:400;color:#b8b0d8;line-height:1.5}`;
  document.head.appendChild(style);
  const vol = (name: VolumeName, label: string) =>
    `<label>${label} <input type="range" min="0" max="${VOLUME_MAX}" step="1" data-v="${name}"><span data-n="${name}"></span></label>`;
  ui.innerHTML = `
    ${SOUNDS.map((s) => `<button data-s="${s.no}">${String(s.no).padStart(2, '0')} ${s.name}</button>`).join('')}
    <div class="row">
      <button data-a="jitter"></button>
      ${vol('master', '전체')}${vol('music', '음악')}${vol('sfx', '효과음')}
      <label>무음 스위치 <select data-a="silent"><option value="follow">따름</option><option value="ignore">무시</option></select></label>
    </div>
    <div class="row">
      음악 층 ${MUSIC_LAYERS.map((l) => `<button data-m="${l}" ${MUSIC_READY ? '' : 'disabled'}>${({ base: '기본', battle: '전투', climax: '고조' } as const)[l]}</button>`).join('')}
      <button data-a="title">타이틀로</button>
    </div>
    <div class="note">
      소리가 안 나면 화면을 한 번 누르세요 (휴대폰은 누르기 전에는 소리가 안 납니다).
      아이폰은 무음 스위치를 켜 두면 소리가 안 납니다 (아이폰 사파리에서는 위 '무음 스위치'를 '무시'로 바꾸면 무음이어도 납니다${silentSwitchSupported() ? '' : ' — 이 브라우저에는 그 기능이 없습니다'}).
      음악 층은 대련곡을 만든 뒤 켜집니다.
    </div>`;
  document.body.appendChild(ui);
  const q = <T extends HTMLElement>(sel: string) => ui.querySelector(sel) as T;

  const syncUi = () => {
    const st = audioSettings();
    for (const n of ['master', 'music', 'sfx'] as const) {
      q<HTMLInputElement>(`[data-v="${n}"]`).value = String(st[n]);
      q<HTMLElement>(`[data-n="${n}"]`).textContent = String(st[n]);
    }
    q<HTMLSelectElement>('[data-a="silent"]').value = st.silent;
    const j = q<HTMLButtonElement>('[data-a="jitter"]');
    j.textContent = audio.jitter ? '흔들림 켜짐' : '흔들림 꺼짐';
    j.classList.toggle('on', audio.jitter);
  };
  onAudioSettings(syncUi);
  syncUi();

  const play = async (item: SoundItem) => {
    current = item;
    lastPlayed = tick;
    const cues: TimedCue[] = item.cues();
    if (await audio.ready()) {
      const t0 = Math.min(0, ...cues.map((c) => c.tick));
      const keep = audio.jitter;
      if (item.jitter) audio.jitter = true;
      for (const c of cues) audio.cue(c.cue, (c.tick - t0) * TICK_SEC);
      audio.jitter = keep;
    }
    // 파형 (기준 소리를 따로 뽑아 그린다)
    const r = await renderItem(item, 22050);
    if (current === item) wave = { data: r.data, rate: r.rate, marks: r.marks };
  };

  ui.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.s) {
      const item = SOUNDS.find((s) => s.no === Number(b.dataset.s));
      if (item) void play(item);
    } else if (b.dataset.a === 'jitter') {
      audio.jitter = !audio.jitter;
      syncUi();
    } else if (b.dataset.a === 'title') app.goto('title');
  });
  ui.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.v) setAudioSettings({ [t.dataset.v]: Number(t.value) });
  });
  q<HTMLSelectElement>('[data-a="silent"]').addEventListener('change', (e) => {
    setAudioSettings({ silent: (e.target as HTMLSelectElement).value === 'ignore' ? 'ignore' : 'follow' });
  });

  return {
    tick(input) {
      tick++;
      // 키보드: Space·J로 마지막 소리를 다시, 숫자 1~9로 그 번호
      if (current && (input.pressed.has('Space') || input.pressed.has('KeyJ'))) void play(current);
      for (let n = 1; n <= 9; n++) {
        if (input.pressed.has(`Digit${n}`)) {
          const item = SOUNDS.find((s) => s.no === n);
          if (item) void play(item);
        }
      }
    },
    render(ctx) {
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      drawText(ctx, 'SOUND TEST', 12, 10, COLORS.goldLight, 2);
      const state = audio.running ? `AUDIO ON   VOICES ${audio.active()}` : 'TAP A BUTTON TO TURN AUDIO ON';
      drawText(ctx, state, SCREEN_W - 12 - textWidth(state), 14, audio.running ? COLORS.gold : COLORS.white);
      const X = 12;
      const Y = 34;
      const W = SCREEN_W - 24;
      const H = 150;
      if (!current) {
        ctx.fillStyle = WAVE_COLORS.bg;
        ctx.fillRect(X, Y, W, H);
        drawText(ctx, 'PRESS A NUMBER BUTTON BELOW', Math.round(SCREEN_W / 2 - textWidth('PRESS A NUMBER BUTTON BELOW') / 2), Y + H / 2 - 3, COLORS.white);
      } else if (wave) {
        const multi = wave.marks.length > 1;
        const sec = multi ? 2.2 : 0.5;
        drawWave(ctx, wave.data, wave.rate, wave.marks, X, Y, W, H, sec);
        // 지금 재생 위치 (튼 뒤 지난 시간)
        const t = (tick - lastPlayed) / 60;
        if (t < sec) {
          ctx.fillStyle = COLORS.white;
          ctx.fillRect(X + Math.floor((t / sec) * W), Y, 1, H);
        }
        drawText(ctx, `0`, X, Y + H + 4, COLORS.gridLight);
        const end = `${Math.round(sec * 1000)}MS`;
        drawText(ctx, end, X + W - textWidth(end), Y + H + 4, COLORS.gridLight);
      }
      if (current) {
        const no = `NO.${String(current.no).padStart(2, '0')}  ${current.file.toUpperCase()}`;
        drawText(ctx, no, X, Y + H + 16, COLORS.goldLight, 2);
        const stops = wave?.marks.filter((m) => m.stop > 0).map((m) => Math.round(m.stop * 60)) ?? [];
        const info = [
          wave && wave.marks.length > 1 ? `TICKS ${wave.marks.map((m) => Math.round(m.at * 60)).join(' ')}` : '',
          stops.length ? `HITSTOP ${stops.join(' ')}T` : '',
        ].filter(Boolean).join('   ');
        drawText(ctx, info, X, Y + H + 34, COLORS.white);
      }
      drawText(ctx, 'YELLOW: CUE TICK   RED: HITSTOP   LINES: 1 TICK', X, SCREEN_H - 12, COLORS.gridLight);
    },
  };
}
