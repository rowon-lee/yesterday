import { blankScene } from './blank';
import { fightScene } from './fight';
import { stageScene } from './stage';
import type { App, Scene } from './scene';
import { titleScene } from './title';
import { viewerScene } from './viewer';
import { soundScene } from './sound';
import { onlineScene } from './online';

export type { App, Scene } from './scene';

export const SCENES: Record<string, (app: App) => Scene> = {
  title: titleScene,
  fight: fightScene,
  stage: stageScene,
  blank: blankScene,
  viewer: viewerScene,
  sound: soundScene,
  online: onlineScene,
};
export const DEFAULT_SCENE = 'title';
/** three.js 2.5D 화면으로 무대를 그리는 장면 (나머지는 2D 캔버스에 바로 그린다) */
export const GL_SCENES: ReadonlySet<string> = new Set(['title', 'fight', 'stage', 'online']);
