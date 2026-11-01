import * as THREE from 'three';
import { CITADEL as D } from '../../data/stages/citadel';

/**
 * 구간마다 다른 밤 (렌더 전용): 카메라 가운데가 있는 구간의 분위기(하늘·안개·환경광·색 보정·빛 무리)를
 * 구간 경계 둘레 BLEND px에서 이웃 구간과 섞는다. 걸어서 다른 거리로 넘어가면 하늘과 공기가 천천히 바뀐다.
 */
const BLEND = 180;

type MoodData = (typeof D.moods)[keyof typeof D.moods];

/** 섞은 분위기 (색은 선형) */
export interface Mood {
  zenith: THREE.Color;
  mid: THREE.Color;
  glow: THREE.Color;
  glowK: number;
  cloud: THREE.Color;
  cloudLit: THREE.Color;
  cover: number;
  fog: THREE.Color;
  mist: number;
  haze: number;
  ambient: THREE.Color;
  ambientGround: THREE.Color;
  shadow: THREE.Color;
  high: THREE.Color;
  sat: number;
  contrast: number;
  halo: number;
  streak: number;
  lightning: number;
}

/** '#rrggbb' → 선형 색 (화면에서 거의 그 색으로 보인다: 후처리가 다시 sRGB로 바꾼다) */
const lin = (hex: string): THREE.Color => new THREE.Color(hex);
/** '#rrggbb'의 0~1 값을 그대로 선형 값으로 (환경광: 바탕색에 곱하는 값이라 예전 세기와 맞춘다) */
const raw = (hex: string): THREE.Color => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Color().setRGB((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

function toMood(m: MoodData): Mood {
  return {
    zenith: lin(m.sky.zenith),
    mid: lin(m.sky.mid),
    glow: lin(m.sky.glow),
    glowK: m.sky.glowK,
    cloud: lin(m.sky.cloud),
    cloudLit: lin(m.sky.cloudLit),
    cover: m.sky.cover,
    fog: lin(m.fog.color),
    mist: m.fog.mist,
    haze: m.fog.haze,
    ambient: raw(m.ambient.sky),
    ambientGround: raw(m.ambient.ground),
    shadow: new THREE.Color(m.grade.shadow),
    high: new THREE.Color(m.grade.high),
    sat: m.grade.sat,
    contrast: m.grade.contrast,
    halo: m.halo,
    streak: m.streak,
    lightning: m.lightning,
  };
}

/** 구간 순서대로 (x0, x1, 분위기). 분위기가 없는 구간은 이웃 것을 쓴다 */
const SECTIONS = D.sections.map((s) => {
  const m = (D.moods as Record<string, MoodData | undefined>)[s.id];
  return { x0: s.x0 as number, x1: s.x1 as number, mood: m ? toMood(m) : null };
});
for (let i = 0; i < SECTIONS.length; i++) {
  if (!SECTIONS[i].mood) SECTIONS[i].mood = (SECTIONS[i - 1] ?? SECTIONS[i + 1]).mood;
}

function mix(out: Mood, a: Mood, b: Mood, t: number): void {
  for (const k of Object.keys(out) as Array<keyof Mood>) {
    const av = a[k];
    const bv = b[k];
    if (av instanceof THREE.Color && bv instanceof THREE.Color) (out[k] as THREE.Color).copy(av).lerp(bv, t);
    else (out[k] as number) = (av as number) + ((bv as number) - (av as number)) * t;
  }
}

const out: Mood = toMood(Object.values(D.moods)[0]);

/** 월드 x(카메라 가운데)의 분위기. 반환값은 매번 같은 객체를 고쳐 쓴다 */
export function moodAt(x: number): Mood {
  let i = SECTIONS.findIndex((s) => x < s.x1);
  if (i < 0) i = SECTIONS.length - 1;
  const s = SECTIONS[i];
  const here = s.mood!;
  // 왼쪽 경계 둘레: 앞 구간과 섞는다. 오른쪽 경계 둘레: 다음 구간과 섞는다
  if (i > 0 && x - s.x0 < BLEND) {
    const t = 0.5 + (x - s.x0) / (2 * BLEND);
    mix(out, SECTIONS[i - 1].mood!, here, Math.max(0, Math.min(1, t)));
  } else if (i < SECTIONS.length - 1 && s.x1 - x < BLEND) {
    const t = 0.5 - (s.x1 - x) / (2 * BLEND);
    mix(out, here, SECTIONS[i + 1].mood!, Math.max(0, Math.min(1, t)));
  } else mix(out, here, here, 0);
  return out;
}
