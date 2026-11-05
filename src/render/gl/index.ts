import { Actors } from './actors';
import { GlView } from './view';
import { World, WORLD_PARTS, type WorldParts } from './world';

/** 이 브라우저가 WebGL2를 쓸 수 있는가 (3D 화면은 WebGL2로만 그린다) */
export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/** 2.5D 화면과 무대 (무대를 그리는 장면에서만 만든다) */
let inst: { view: GlView; world: World; actors: Actors } | null = null;

export function initGl(overlay: HTMLCanvasElement): void {
  for (const s of glSteps(overlay)) s.run();
}

/**
 * 3D 화면을 한 단계씩 만든다 (불러오기 막대가 단계마다 넘어간다): 화면 → 무대 부품 하나씩 → 무대 → 캐릭터 판.
 * weight는 막대에서 차지하는 몫 (PC에서 잰 시간 ms 어림)
 */
export function glSteps(overlay: HTMLCanvasElement): Array<{ label: string; weight: number; run(): void }> {
  let view: GlView | null = null;
  const parts: Partial<WorldParts> = {};
  // PC에서 잰 단계별 시간 (ms 어림)
  const WEIGHT: Record<string, number> = { 건물: 350, 소품: 140, '큰 소품': 30, '시타델 광장': 130, 가장자리: 190, '바깥 구간: 공장 지대': 300, '바깥 구간: 항만 부두': 260, '바깥 구간: 고가 철도': 260, '바깥 구간: 성벽 검문소': 260 };
  return [
    { label: '화면', weight: 200, run: () => void (view = new GlView(overlay)) },
    ...WORLD_PARTS.map(([label, make]) => ({ label: `무대: ${label}`, weight: WEIGHT[label] ?? 10, run: () => make(parts) })),
    {
      label: '무대: 먼 겹',
      weight: 60,
      run: () => {
        const world = new World(parts as WorldParts);
        const actors = new Actors();
        view!.scene.add(world.group, actors.group);
        inst = { view: view!, world, actors };
      },
    },
  ];
}

export function gl(): { view: GlView; world: World; actors: Actors } {
  if (!inst) throw new Error('3D 화면이 아직 없습니다');
  return inst;
}

/** 3D 화면을 다 만들었나 */
export const glReady = (): boolean => inst !== null;
