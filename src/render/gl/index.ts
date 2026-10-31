import { Actors } from './actors';
import { GlView } from './view';
import { World } from './world';

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
  const view = new GlView(overlay);
  const world = new World();
  const actors = new Actors();
  view.scene.add(world.group, actors.group);
  inst = { view, world, actors };
}

export function gl(): { view: GlView; world: World; actors: Actors } {
  if (!inst) throw new Error('3D 화면이 아직 없습니다');
  return inst;
}
