/**
 * 이펙트 빛 목록과 화면 품질 (렌더 전용).
 * - 이펙트 빛: 타격 번쩍임·기력 오라·필살기·폭발·네온 불꽃처럼 전투 연출이 내는 빛을 프레임마다 모은다 (월드 좌표, y는 아래로 +).
 *   3D 무대(render/gl/world.ts)가 이 빛을 광원 후보로 옮겨 실제로 벽과 바닥을 비춘다.
 * - 품질: 느린 기기면 낮춘다 (광원 수·비·빛 번짐을 줄인다).
 */
export interface PointLight {
  x: number;
  y: number;
  r: number;
  color: string;
  a: number;
}

class LightList {
  points: PointLight[] = [];

  clear(): void {
    this.points.length = 0;
  }

  /** 둥글게 번지는 빛 하나 (월드 좌표, 반지름 r, 색 '#rrggbb', 세기 a) */
  point(x: number, y: number, r: number, color: string, a = 1): void {
    if (a <= 0.01 || r <= 0) return;
    this.points.push({ x, y, r, color, a });
  }
}

/** 이번 프레임의 이펙트 빛. 장면이 그리기 전에 비우고, 전투 이펙트가 채운다 */
export const lights = new LightList();

// ---------------------------------------------------------------- 품질
export type Quality = 'high' | 'low';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const forced = params.get('quality') as Quality | null;
let level: Quality = forced === 'low' ? 'low' : 'high';
let frames = 0;
let spent = 0;
let ticksRun = 0;
let lastAt = -1;
let startAt = -1;

/** 지금 품질. ?quality=low|high로 고정할 수 있다 */
export const quality = (): Quality => level;

/**
 * 화면 프레임마다 부른다 (ms: 그리는 데 걸린 시간, ticks: 이번 프레임에 돈 틱 수). 2초씩 모아서
 * 그리기가 평균 12ms를 넘거나(틱 계산과 브라우저 몫을 남겨야 한다), 프레임마다 틱이 평균 1.3개를 넘으면
 * (화면이 60프레임을 못 따라가 틱을 몰아 돌리는 중) 낮은 품질로 내린다. 시작 3초는 준비 중이라 보지 않는다. 고정했으면 그대로.
 */
export function measureFrame(ms: number, now: number, ticks = 1): void {
  if (forced) return;
  if (startAt < 0) startAt = lastAt = now;
  frames++;
  spent += ms;
  ticksRun += ticks;
  if (now - lastAt < 2000) return;
  const slow = spent / frames > 12 || ticksRun / frames > 1.3;
  if (now - startAt > 3000 && frames > 30 && slow && level === 'high') level = 'low';
  frames = 0;
  spent = 0;
  ticksRun = 0;
  lastAt = now;
}
