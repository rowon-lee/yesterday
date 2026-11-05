/**
 * 그림 일꾼 (웹 워커): 동작 그림(색 번호, 칸마다 잘라 둔 것)을 화면 스레드 밖에서 그린다.
 * 같은 그리기 코드(anim/bake.ts)를 그대로 쓰므로 그림은 화면 스레드에서 그린 것과 같다.
 * 받는 것: { jobs: [동작 이름, 겉모습][] }. 동작마다 { name, skin, frames }를 돌려주고 (픽셀 배열은 옮겨 준다), 다 하면 { done: true }.
 */
import type { CellFrame } from './bake';
import { MOTIONS } from './motions';
import type { SkinId } from './skins';

const byName = new Map(MOTIONS.map((m) => [m.name, m]));
const post = (self as unknown as { postMessage(m: unknown, transfer?: Transferable[]): void }).postMessage.bind(self);

self.onmessage = (e: MessageEvent<{ jobs: Array<[string, SkinId]> }>) => {
  for (const [name, skin] of e.data.jobs) {
    const m = byName.get(name);
    if (!m) continue;
    const frames: CellFrame[] = m.frames(skin).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, a: f.a }));
    post({ name, skin, frames }, frames.map((f) => f.a.buffer as ArrayBuffer));
  }
  post({ done: true });
};
