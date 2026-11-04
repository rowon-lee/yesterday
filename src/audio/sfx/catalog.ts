/**
 * 소리 번호표 (사운드기획서 4장): PR·WAV 파일(previews/sound/NN-이름.wav)·소리 시험 화면이 같은 번호를 쓴다.
 * 사용자는 번호로 답한다 ("3 더 묵직하게"). 번호는 한 번 정하면 바꾸지 않고, 새 소리는 뒤에 붙인다.
 */
import { movesOf } from '../../sim';
import { comboCues, type TimedCue } from '../demo';
import type { Cue } from '.';

export interface SoundItem {
  no: number;
  /** 파일 이름 (번호 뒤) */
  file: string;
  /** 한국어 이름 */
  name: string;
  /** 무엇을 들어 보는지 */
  note: string;
  /** 길이 목표 (ms, 피크보다 40dB 낮아질 때까지). 확인 도구가 잰다 */
  target?: readonly [number, number];
  /** 소리 순서 (틱). 확인 화면에서 처음 부를 때 만든다 (연타는 실제 sim으로 잰다) */
  cues: () => TimedCue[];
  /** 무대 버스에 시험용 바닥 소리를 깐다 (덕킹을 귀로 확인) */
  bed?: boolean;
  /** 피치·길이 흔들림을 켜고 뽑는다 (꺼 두면 레시피 그대로) */
  jitter?: boolean;
}

/** 라이덴 기술의 히트스톱 (틱): 기술 데이터 그대로 읽는다 */
const hs = (move: 'atk1' | 'atk2' | 'atk3' | 'atk4' | 'air1') => movesOf('raiden')[move].data.hitstop;
const one = (cue: Cue): (() => TimedCue[]) => () => [{ tick: 0, cue }];

export const SOUNDS: readonly SoundItem[] = [
  { no: 1, file: 'hit-light-1', name: '약하게 맞음 1타', note: '라이덴 1타. 짧은 노이즈 탁 + 낮은 클릭', target: [40, 80], cues: () => one({ sound: 'hitLight', step: 1, stop: hs('atk1') })() },
  { no: 2, file: 'hit-light-2', name: '약하게 맞음 2타', note: '1타보다 저음이 깊고 꼬리가 조금 길다', target: [40, 80], cues: () => one({ sound: 'hitLight', step: 2, stop: hs('atk2') })() },
  { no: 3, file: 'hit-light-3', name: '약하게 맞음 3타', note: '2타보다 더 깊고 길다', target: [40, 80], cues: () => one({ sound: 'hitLight', step: 3, stop: hs('atk3') })() },
  { no: 4, file: 'hit-heavy-4', name: '세게 맞음 4타', note: '낮은 쿵 + 노이즈 폭발 + 꼬리. 쿵이 히트스톱 동안 이어지고, 히트스톱이 풀리는 순간 꼬리가 시작', target: [150, 250], cues: () => one({ sound: 'hitHeavy', step: 4, stop: hs('atk4') })() },
  { no: 5, file: 'hit-air', name: '공중에서 맞음', note: '세게 맞음보다 가볍고 높게 (공중 1타)', target: [100, 140], cues: () => one({ sound: 'hitAir', step: 1, stop: hs('air1') })() },
  { no: 6, file: 'guard', name: '가드', note: '짧은 금속성 울림', target: [60, 100], cues: one({ sound: 'guard', step: 1, stop: 4 }) },
  { no: 7, file: 'guard-crush', name: '가드 크러시', note: '유리 깨지는 소리 + 저음', target: [250, 350], cues: one({ sound: 'crush', step: 1, stop: 9 }) },
  { no: 8, file: 'down', name: '다운', note: '젖은 바닥에 떨어지는 철퍽 (내려찍기로 튈 때, KO로 떨어질 때도)', cues: one({ sound: 'down', step: 1, stop: 0 }) },
  { no: 9, file: 'getup', name: '기상', note: '바닥을 짚고 일어나는 가벼운 찰박', cues: one({ sound: 'getup', step: 1, stop: 0 }) },
  { no: 10, file: 'tech', name: '낙법', note: '짧은 바람', cues: one({ sound: 'tech', step: 1, stop: 0 }) },
  { no: 11, file: 'combo-1to4', name: '1→4타 이어 듣기', note: '라이덴 1~4타를 실제 sim으로 맞혀 잰 틱 간격 그대로', cues: () => comboCues('raiden') },
  {
    no: 12,
    file: 'duck-check',
    name: '강타 덕킹 확인',
    note: '시험용 바닥 소리(빗소리 아님) 위에서 1→4타. 4타의 히트스톱 동안 바닥 소리가 9dB 낮아졌다 돌아온다',
    bed: true,
    cues: () => [{ tick: -30, cue: { sound: 'bed', step: 1, stop: 0 } }, ...comboCues('raiden')],
  },
  {
    no: 13,
    file: 'jitter-check',
    name: '흔들림 확인',
    note: '3타를 20틱마다 5번. 매번 피치(±3.5%)·길이(±6%)가 조금씩 다르다',
    jitter: true,
    cues: () => [0, 20, 40, 60, 80].map((tick) => ({ tick, cue: { sound: 'hitLight', step: 3, stop: hs('atk3') } as Cue })),
  },
];
