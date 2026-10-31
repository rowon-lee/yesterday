import { blankScene } from './blank';
import { fightScene } from './fight';
import type { Scene } from './scene';
import { viewerScene } from './viewer';

export type { Scene } from './scene';

export const SCENES: Record<string, () => Scene> = {
  fight: fightScene,
  blank: blankScene,
  viewer: viewerScene,
};
export const DEFAULT_SCENE = 'fight';
