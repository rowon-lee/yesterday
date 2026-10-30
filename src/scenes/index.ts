import { blankScene } from './blank';
import type { Scene } from './scene';
import { viewerScene } from './viewer';

export type { Scene } from './scene';

export const SCENES: Record<string, () => Scene> = {
  blank: blankScene,
  viewer: viewerScene,
};
export const DEFAULT_SCENE = 'blank';
