/**
 * 공통 타격음 (사운드기획서 2-1). 숫자 표 + 표를 층으로 바꾸는 짧은 함수.
 * 길이는 '피크보다 40dB 낮아질 때까지' (npm run sound가 잰다). 고칠 때는 표의 숫자만 바꾼다.
 *
 * 콤보 변주: 1→4타(연타 단계)로 갈수록 저음이 깊어지고 꼬리가 길어진다. 1~3타는 '약하게 맞음', 4타는 '세게 맞음'.
 * 히트스톱과 맞물림: 소리는 맞는 틱에 바로 시작한다 (모든 층이 0초에서 1ms 안에 올라감).
 * 세게 맞음의 몸통(쿵)은 히트스톱이 끝날 때까지 이어지고(엔벨로프 hs), 꼬리는 히트스톱이 풀리는 순간 시작한다(afterStop).
 */
import type { Layer, Recipe } from './types';

/** 약하게 맞음 1~3타: 짧은 노이즈 '탁' + 낮은 클릭 (40~80ms) */
const LIGHT = [
  // 클릭 시작·끝 Hz, 클릭 내려감, 탁 대역 Hz, 탁 내려감, 꼬리 내려감, 꼬리 크기, 클릭 크기, 찌그러짐
  { click: [230, 125], clickD: 0.055, snap: 2700, snapD: 0.04, tailD: 0.06, tailG: 0.14, clickG: 0.62, drive: 1.4 },
  { click: [200, 102], clickD: 0.07, snap: 2350, snapD: 0.046, tailD: 0.08, tailG: 0.19, clickG: 0.7, drive: 1.7 },
  { click: [172, 82], clickD: 0.088, snap: 2050, snapD: 0.052, tailD: 0.105, tailG: 0.25, clickG: 0.8, drive: 2.1 },
] as const;

const light = (p: (typeof LIGHT)[number]): Recipe => ({
  bus: 'sfx',
  gain: 0.85,
  send: 0.06,
  layers: [
    // 맨 앞 '딱' (가죽에 닿는 순간)
    { kind: 'noise', color: 'white', filter: { type: 'highpass', f: 4500 }, env: { a: 0.0005, d: 0.012 }, gain: 0.32 },
    // 탁
    { kind: 'noise', color: 'white', filter: { type: 'bandpass', f: p.snap, to: p.snap * 0.7, t: p.snapD, q: 1.1 }, env: { a: 0.0008, d: p.snapD }, gain: 0.8 },
    // 낮은 클릭 (짧게 내려가는 사인 + 살짝 찌그러뜨려 주먹 맛)
    { kind: 'osc', wave: 'sine', f: p.click[0], to: p.click[1], t: p.clickD * 0.6, env: { a: 0.0008, d: p.clickD }, gain: p.clickG, drive: p.drive },
    // 짧은 꼬리 (몸이 흔들리는 둔한 울림)
    { kind: 'noise', color: 'pink', filter: { type: 'lowpass', f: 1100, to: 280, t: p.tailD }, env: { a: 0.002, d: p.tailD }, gain: p.tailG },
  ],
});

/**
 * 세게 맞음 (4타·강타): 낮은 '쿵' + 노이즈 폭발 + 짧은 꼬리 (150~250ms).
 * 쿵은 히트스톱 동안 이어지며 천천히 줄고, 히트스톱이 풀리면 내려간다. 꼬리는 맞은 쪽이 날아가기 시작할 때.
 * 히트스톱 동안 다른 소리를 9dB 낮춘다 (덕킹)
 */
const HEAVY = {
  thump: [125, 44] as const,
  /** 쿵이 히트스톱 끝에 남는 크기 (0.4 ≈ -8dB) */
  holdLevel: 0.4,
  thumpD: 0.075,
  burstD: 0.1,
  tailD: 0.1,
  duck: 9,
};

const heavy = (): Recipe => ({
  bus: 'focus',
  gain: 0.78,
  send: 0.12,
  duck: HEAVY.duck,
  layers: [
    { kind: 'noise', color: 'white', filter: { type: 'highpass', f: 3000 }, env: { a: 0.0005, d: 0.016 }, gain: 0.5 },
    // 노이즈 폭발 (밝게 터져 어둡게 닫힘)
    { kind: 'noise', color: 'white', filter: { type: 'lowpass', f: 5200, to: 800, t: HEAVY.burstD }, env: { a: 0.001, d: HEAVY.burstD }, gain: 0.85, drive: 2.6 },
    // 쿵 (히트스톱 동안 이어짐)
    { kind: 'osc', wave: 'sine', f: HEAVY.thump[0], to: HEAVY.thump[1], t: 0.09, env: { a: 0.001, hs: 1, hl: HEAVY.holdLevel, d: HEAVY.thumpD }, gain: 1, drive: 3 },
    // 바닥을 받치는 더 낮은 저음
    { kind: 'osc', wave: 'sine', f: 60, to: 40, t: 0.15, env: { a: 0.003, hs: 1, hl: 0.5, d: 0.09 }, gain: 0.5 },
    // 가운데 '퍽' (뼈에 닿는 단단함)
    { kind: 'osc', wave: 'triangle', f: 270, to: 110, t: 0.04, env: { a: 0.0008, d: 0.06 }, gain: 0.34 },
    // 꼬리: 히트스톱이 풀리는 순간 맞은 쪽이 밀려 나가는 낮은 웅 + 바람
    { kind: 'noise', color: 'brown', afterStop: true, filter: { type: 'lowpass', f: 420, to: 150, t: HEAVY.tailD }, env: { a: 0.004, d: HEAVY.tailD }, gain: 0.42 },
    { kind: 'noise', color: 'pink', afterStop: true, filter: { type: 'bandpass', f: 900, to: 420, t: 0.08, q: 0.9 }, env: { a: 0.006, d: 0.075 }, gain: 0.14 },
  ],
});

/** 공중에서 맞음 1~3타 (공중 연타 air1~3): 세게 맞음보다 가볍고 높게 (120ms) */
const AIR = [
  // 퍽 시작·끝 Hz, 몸통 내려감, 바람 꼬리 내려감
  { knock: [340, 175], bodyD: 0.2, tailD: 0.25 },
  { knock: [315, 160], bodyD: 0.215, tailD: 0.27 },
  { knock: [290, 145], bodyD: 0.23, tailD: 0.29 },
] as const;

const air = (p: (typeof AIR)[number]): Recipe => ({
  bus: 'sfx',
  gain: 0.72,
  send: 0.1,
  layers: [
    { kind: 'noise', color: 'white', filter: { type: 'highpass', f: 5000 }, env: { a: 0.0005, d: 0.012 }, gain: 0.38 },
    { kind: 'noise', color: 'white', filter: { type: 'bandpass', f: 3300, to: 2200, t: 0.05, q: 0.9 }, env: { a: 0.0008, d: 0.055 }, gain: 0.62 },
    { kind: 'osc', wave: 'triangle', f: p.knock[0], to: p.knock[1], t: 0.05, env: { a: 0.0008, d: 0.1 }, gain: 0.5, drive: 1.6 },
    { kind: 'osc', wave: 'sine', f: 160, to: 95, t: 0.06, env: { a: 0.001, d: p.bodyD }, gain: 0.42 },
    // 공중으로 튕겨 나가는 바람
    { kind: 'noise', color: 'pink', filter: { type: 'bandpass', f: 1900, to: 850, t: p.tailD, q: 1.1 }, env: { a: 0.003, d: p.tailD }, gain: 0.3 },
  ],
});

/** 가드: 짧은 금속성 울림 (80ms). 어긋난 배음 몇 개 + 팔에 닿는 둔한 '턱' */
const guard = (): Recipe => ({
  bus: 'sfx',
  gain: 0.55,
  send: 0.1,
  layers: [
    { kind: 'noise', color: 'white', filter: { type: 'highpass', f: 4000 }, env: { a: 0.0005, d: 0.01 }, gain: 0.45 },
    { kind: 'fm', f: 1240, ratio: 1.414, index: 2.2, indexTo: 0.3, env: { a: 0.0005, d: 0.12 }, gain: 0.32 },
    { kind: 'osc', wave: 'sine', f: 1735, env: { a: 0.0005, d: 0.1 }, gain: 0.2 },
    { kind: 'osc', wave: 'sine', f: 2710, env: { a: 0.0005, d: 0.075 }, gain: 0.15 },
    { kind: 'osc', wave: 'triangle', f: 430, to: 250, t: 0.03, env: { a: 0.0008, d: 0.045 }, gain: 0.36 },
  ],
});

/** 가드 크러시: 유리 깨지는 소리 + 저음 (300ms). 방어가 깨지는 큰 사건이라 히트스톱 동안 다른 소리를 6dB 낮춘다 */
const crush = (): Recipe => ({
  bus: 'focus',
  gain: 0.62,
  send: 0.18,
  duck: 6,
  layers: [
    { kind: 'noise', color: 'white', filter: { type: 'highpass', f: 6000 }, env: { a: 0.0005, d: 0.02 }, gain: 0.5 },
    { kind: 'noise', color: 'white', filter: { type: 'bandpass', f: 2600, q: 0.7 }, env: { a: 0.0008, d: 0.07 }, gain: 0.7, drive: 2 },
    // 유리 조각: 높은 핑 여럿이 흩어져 떨어짐
    { kind: 'scatter', count: 18, wave: 'sine', f: [2600, 7800], spread: [0.003, 0.2], a: 0.0005, d: [0.04, 0.16], gain: 0.28 },
    { kind: 'scatter', count: 9, wave: 'triangle', f: [1800, 4200], spread: [0.05, 0.26], a: 0.0005, d: [0.03, 0.09], gain: 0.18 },
    // 유리가 바스러지는 쉬익
    { kind: 'noise', color: 'white', filter: { type: 'bandpass', f: 6500, to: 3800, t: 0.3, q: 1.5 }, env: { a: 0.001, d: 0.32 }, gain: 0.3 },
    // 저음
    { kind: 'osc', wave: 'sine', f: 95, to: 38, t: 0.24, env: { a: 0.002, h: 0.05, hl: 0.7, d: 0.42 }, gain: 0.9, drive: 2 },
    { kind: 'osc', wave: 'sine', f: 52, to: 44, t: 0.3, env: { a: 0.006, d: 0.42 }, gain: 0.38 },
  ],
});

/** 다운: 젖은 바닥에 떨어지는 철퍽 (둔한 쿵 + 물 튀김 + 물방울) */
const down = (): Recipe => ({
  bus: 'sfx',
  gain: 0.62,
  send: 0.15,
  layers: [
    { kind: 'osc', wave: 'sine', f: 100, to: 48, t: 0.08, env: { a: 0.002, d: 0.13 }, gain: 0.8, drive: 1.8 },
    { kind: 'osc', wave: 'triangle', f: 190, to: 90, t: 0.04, env: { a: 0.001, d: 0.05 }, gain: 0.3 },
    // 철퍽: 물이 튀며 어두워지는 노이즈
    { kind: 'noise', color: 'white', filter: { type: 'bandpass', f: 1700, to: 520, t: 0.18, q: 0.8 }, env: { a: 0.004, h: 0.02, d: 0.21 }, gain: 0.6 },
    { kind: 'noise', color: 'white', filter: { type: 'highpass', f: 3600, to: 2400, t: 0.08 }, env: { a: 0.002, d: 0.09 }, gain: 0.2 },
    // 흩어진 물방울 (짧게 올라가는 사인)
    { kind: 'scatter', count: 6, wave: 'sine', f: [700, 1500], rise: 1.7, spread: [0.05, 0.26], a: 0.001, d: [0.02, 0.045], gain: 0.16 },
  ],
});

/** 기상: 젖은 바닥을 짚고 일어나는 가벼운 찰박 + 발 딛는 소리 */
const getup = (): Recipe => ({
  bus: 'sfx',
  gain: 0.8,
  send: 0.12,
  layers: [
    // 손이 젖은 바닥을 짚는 '찹' (일어나기 시작하는 틱에 바로)
    { kind: 'noise', color: 'white', filter: { type: 'bandpass', f: 1800, to: 900, t: 0.04, q: 1 }, env: { a: 0.001, d: 0.05 }, gain: 0.5 },
    { kind: 'noise', color: 'pink', filter: { type: 'bandpass', f: 850, to: 1500, t: 0.12, q: 0.9 }, env: { a: 0.03, d: 0.1 }, gain: 0.5 },
    { kind: 'noise', color: 'white', at: 0.05, filter: { type: 'bandpass', f: 1400, to: 700, t: 0.09, q: 0.9 }, env: { a: 0.004, d: 0.09 }, gain: 0.24 },
    { kind: 'scatter', count: 3, wave: 'sine', f: [800, 1400], rise: 1.6, spread: [0.06, 0.18], a: 0.001, d: [0.02, 0.04], gain: 0.12 },
    { kind: 'osc', wave: 'sine', at: 0.11, f: 125, to: 70, t: 0.04, env: { a: 0.002, d: 0.06 }, gain: 0.5 },
  ],
});

/** 낙법: 짧은 바람 (몸을 돌려 빠져나감) */
const tech = (): Recipe => ({
  bus: 'sfx',
  gain: 1,
  send: 0.1,
  layers: [
    { kind: 'noise', color: 'pink', filter: { type: 'bandpass', f: 480, to: 2600, t: 0.1, q: 1.4 }, env: { a: 0.045, d: 0.1 }, gain: 2.2 },
    { kind: 'noise', color: 'white', filter: { type: 'bandpass', f: 2400, to: 5200, t: 0.08, q: 2 }, env: { a: 0.03, d: 0.07 }, gain: 0.5 },
  ],
});

/** 시험용 바닥 소리 (빗소리 아님): 덕킹을 귀로 확인하려고 무대 버스에 까는 고른 쉬익 */
const bed = (): Recipe => ({
  bus: 'stage',
  gain: 0.3,
  send: 0,
  layers: [
    { kind: 'noise', color: 'pink', filter: { type: 'lowpass', f: 2600 }, env: { a: 0.25, h: 3.2, d: 0.4 }, gain: 0.7 },
    { kind: 'osc', wave: 'sine', f: 110, env: { a: 0.25, h: 3.2, d: 0.4 }, gain: 0.25 },
  ] satisfies Layer[],
});

/** 소리 이름 → 레시피 (콤보 단계가 있는 소리는 단계마다) */
export const HIT_SFX = {
  hitLight: LIGHT.map(light),
  hitHeavy: [heavy()],
  hitAir: AIR.map(air),
  guard: [guard()],
  crush: [crush()],
  down: [down()],
  getup: [getup()],
  tech: [tech()],
  bed: [bed()],
} as const satisfies Record<string, readonly Recipe[]>;
