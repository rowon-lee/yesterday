/**
 * 화면 단위 연출 (렌더 전용): 캐릭터 연출이 3D 화면 전체에 거는 효과를 여기에 적고, 3D 화면(gl/post·gl/world·gl/rain)이 읽는다.
 * - 선 따라 어긋남 (shear): 베기 선 양옆의 화면(무대·캐릭터·이펙트 모두)이 선 방향으로 몇 px 미끄러졌다가 다시 붙는다.
 *   오스카 베기의 문법 (캐릭터 기획서 13-0). 마지막 팔레트 화면을 칸 단위로 옮겨 찍으므로 새 색이 생기지 않는다.
 * - 물들이기 (tint): 화면 색 보정·환경광을 한 색으로 끌어당긴다 (오스카 월령수류: 핏빛 달빛).
 * - 비 멈춤 (rainHold): 빗줄기가 공중에 멈춘다.
 * 좌표는 월드 px (이펙트와 같다: x는 맵, y는 화면 아래로 +, 땅 = GROUND). sim은 이것을 모른다.
 */

/** 한 번에 어긋날 수 있는 선 수 (셰이더 배열 크기) */
export const SHEAR_MAX = 64;

export interface ShearSpec {
  /** 선 두 끝 (월드 px) */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 시작 틱 (sim 틱) */
  at: number;
  /** 지속 틱 */
  life: number;
  /**
   * 지난 틱 → [선의 + 쪽(선 방향 기준 오른쪽, 화면에서 아래쪽)이 미끄러지는 px, − 쪽이 미끄러지는 px]. 선 방향(x0→x1)으로 +
   */
  shift: (age: number) => readonly [number, number];
  /** 선에서 이만큼(px) 떨어진 곳까지만 어긋나고 그 두 배에서 0이 된다 (0이면 화면 끝까지) */
  reach: number;
  /** true면 선이 끝없이 이어진 것으로 (화면 끝에서 끝까지 베인 선) */
  endless?: boolean;
}

const shears: ShearSpec[] = [];

/** 어긋남 하나를 건다 */
export function addShear(s: ShearSpec): void {
  shears.push(s);
  if (shears.length > SHEAR_MAX * 2) shears.splice(0, shears.length - SHEAR_MAX * 2);
}

/** 이 틱에 화면에 걸린 어긋남 (화면 px로: 카메라 왼쪽 위 ix·iy를 뺀다). 끝난 것은 지운다 */
export function shearFrame(tick: number, ix: number, iy: number): Array<{ ax: number; ay: number; dx: number; dy: number; len: number; reach: number; pos: number; neg: number }> {
  for (let i = shears.length - 1; i >= 0; i--) if (tick - shears[i]!.at >= shears[i]!.life || tick < shears[i]!.at - 600) shears.splice(i, 1);
  const out: Array<{ ax: number; ay: number; dx: number; dy: number; len: number; reach: number; pos: number; neg: number }> = [];
  for (const s of shears) {
    const age = tick - s.at;
    if (age < 0) continue;
    const [pos, neg] = s.shift(age);
    if (!pos && !neg) continue;
    const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0) || 1;
    out.push({ ax: s.x0 - ix, ay: s.y0 - iy, dx: (s.x1 - s.x0) / len, dy: (s.y1 - s.y0) / len, len: s.endless ? 0 : len, reach: s.reach, pos, neg });
    if (out.length >= SHEAR_MAX) break;
  }
  return out;
}

/** 새 경기·장면: 걸린 효과를 모두 지운다 */
export function clearScreenFx(): void {
  shears.length = 0;
  tint.k = 0;
  tint.halo = 1;
  rainHold.on = false;
  press.at = -1e9;
  press.life = 0;
}

/**
 * 배경 누르기 (동작연출지침서 14-1 ⑥): 강타 순간 1~3틱 동안 무대(배경) 명도를 확 낮추고 이펙트 색으로 물들인다.
 * 캐릭터와 이펙트 칸(후처리의 캐릭터·이펙트 표시 칸)은 그대로 둔다. 필살기 타격은 반전(invert)이나 흰 화면(white)도 쓴다.
 * tint: 무대 밝기를 scale배로 낮추고 color를 더한다 (무대 무늬·구간 색은 그대로).
 * crack: 무대를 한 색(color)으로 칠하고 밝기로 세 단 (검붉은·color·밝은), 월드에 붙은 균열 그물(crack 색)을 긋는다 (14-8 ⑧, 레퍼런스 1).
 * at: 시작 틱 (sim 틱), life: 틱 수, k: 세기 (0~1), color: 물들일 색 ('#rrggbb')
 */
export const press = {
  at: -1e9,
  life: 0,
  k: 0,
  color: '#000000',
  mode: 'dark' as 'dark' | 'invert' | 'white' | 'tint' | 'crack',
  scale: 1,
  /** crack: 균열 색, 어두운 단·밝은 단 색 */
  crack: '#0a0712',
  dark: '#46081e',
  hi: '#ff526e',
};

/** 이 틱의 배경 누르기 세기 (0이면 없음) */
export function pressAt(tick: number): number {
  const age = tick - press.at;
  return age >= 0 && age < press.life ? press.k : 0;
}

/**
 * 화면 물들이기: k(0~1)만큼 화면 색 보정의 어두운 쪽·밝은 쪽 색과 환경광을 이 색으로 끌어당긴다 ('#rrggbb').
 * halo: 안개 속 빛 무리 세기 배율 (무대를 덮는 연출 동안 0: 덮인 광원의 무리가 위에 뜨지 않게). 부르는 쪽이 틱마다 정한다
 */
export const tint = { k: 0, shadow: '#000000', high: '#ffffff', ambient: '#000000', sat: 1, halo: 1 };

/** 비 멈춤: on이면 빗줄기가 그 자리에 멈추고 물방울이 튀지 않는다 */
export const rainHold = { on: false };

/**
 * 이번 프레임에 애니 이펙트(vfx/gg)가 칠한 칸 수: render/vfx가 더하고, 3D 화면(gl/view)이 읽고 0으로 되돌린다.
 * 0이 아니면 이펙트 빛 번짐(이펙트 칸만 따로 그려 번지게 하는 단계)을 돌린다 (14-5 '빛 번짐: 이펙트에는 강하게')
 */
export const fxMarked = { n: 0 };
/** 이펙트 빛 번짐 배수 (키 실루엣 이펙트가 설계값으로 줄인다, 기본 1) */
export const fxGlowScale = { k: 1 };
