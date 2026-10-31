import { blankScene } from './blank';
import { fightScene } from './fight';
import { stageScene } from './stage';
import type { Scene } from './scene';
import { viewerScene } from './viewer';

export type { Scene } from './scene';

export const SCENES: Record<string, () => Scene> = {
  fight: fightScene,
  stage: stageScene,
  blank: blankScene,
  viewer: viewerScene,
};
export const DEFAULT_SCENE = 'fight';
/** three.js 2.5D 화면으로 무대를 그리는 장면 (나머지는 2D 캔버스에 바로 그린다) */
export const GL_SCENES: ReadonlySet<string> = new Set(['fight', 'stage']);
