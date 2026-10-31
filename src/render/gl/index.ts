import { Actors } from './actors';
import { GlView } from './view';
import { World } from './world';

export { GL_MODE } from './mode';

/** 2.5D 화면과 무대 (?render=3d일 때만 만든다) */
let inst: { view: GlView; world: World; actors: Actors } | null = null;

export function initGl(overlay: HTMLCanvasElement): void {
  const view = new GlView(overlay);
  const world = new World();
  const actors = new Actors();
  view.scene.add(world.group, actors.group);
  inst = { view, world, actors };
}

export function gl(): { view: GlView; world: World; actors: Actors } {
  if (!inst) throw new Error('3D 화면이 아직 없습니다 (?render=3d)');
  return inst;
}
