import type * as THREE from 'three';
import { MAP_H, MAP_W } from '../../stage/citadel';
import { SCREEN_H, SCREEN_W } from '../screen';
import { fxMarked } from '../screenfx';
import { gl } from './index';
import { detailEnabled, setDetail } from './shaders';

/**
 * 셰이더·텍스처·정점 버퍼를 미리 그래픽 칩에 만든다 (불러오기 화면, 렌더 전용).
 * 장면의 모든 물체(숨어 있는 이펙트 판·부서진 모습·잔해·캐릭터 판까지)를 잠깐 보이게 하고 화면 밖 자르기를 끈 채
 * 후처리(빛 번짐·이펙트 빛 번짐·팔레트)까지 한 번 그린다. 품질 높음·낮음 둘 다 (도중에 품질이 내려가도 다시 만들지 않게: 세부 표현 켬·끔, 빛 번짐 켬·끔).
 * 무대의 시간 상태(빛이 켜지고 꺼지는 정도, 하늘을 그린 시각, 비·행인)는 건드리지 않는다: 무대 갱신(world.update)과 빛 싣기를 부르지 않는다.
 * 불러오기 화면이 위를 덮고 있어 이 그림은 보이지 않는다.
 */
export function warmGpu(): void {
  const { view, world, actors } = gl();
  const saved: Array<[THREE.Object3D, boolean, boolean]> = [];
  view.scene.traverse((o) => saved.push([o, o.visible, o.frustumCulled]));
  actors.warm();
  world.warmSky(view);
  const detail = detailEnabled();
  const bloom = view.bloom;
  for (const high of [true, false]) {
    setDetail(high);
    view.bloom = high;
    view.begin({ x: MAP_W / 2 - SCREEN_W / 2, y: MAP_H - SCREEN_H }, 0);
    for (const [o] of saved) {
      o.visible = true;
      o.frustumCulled = false;
    }
    // 이펙트 빛 번짐 길도 한 번 지나가게
    fxMarked.n = 1;
    view.render();
  }
  for (const [o, v, f] of saved) {
    o.visible = v;
    o.frustumCulled = f;
  }
  setDetail(detail);
  view.bloom = bloom;
  fxMarked.n = 0;
  view.sync();
}
