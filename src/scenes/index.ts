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
