import { Keyboard, type TickInput } from './core/input';
import { startLoop } from './core/loop';
import { setupScreen } from './render/screen';
import { bakeAllMotions } from './anim/motions';
import { DEFAULT_SCENE, SCENES } from './scenes';

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') ?? DEFAULT_SCENE;
const makeScene = SCENES[sceneName];
if (!makeScene) throw new Error(`없는 장면: ${sceneName}`);
/** 확인용: 이 틱에서 멈춘다 (?stopAt=120). 캡처를 매번 같은 순간에 찍기 위함. */
const stopAt = params.has('stopAt') ? Number(params.get('stopAt')) : Infinity;

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas);
const keyboard = new Keyboard();
// 모든 동작의 시트를 시작할 때 미리 그려 둔다.
bakeAllMotions();
const scene = makeScene();

let tickCount = 0;
let lastInput: TickInput | null = null;

function tick(): void {
  if (tickCount >= stopAt) return;
  lastInput = keyboard.poll();
  scene.tick(lastInput);
  tickCount++;
}

// 확인 도구(tools/screenshot)가 읽는 값
(window as unknown as { __debug: object }).__debug = {
  scene: sceneName,
  scenes: Object.keys(SCENES),
  get tick() { return tickCount; },
  get held() { return lastInput ? [...lastInput.held] : []; },
};

startLoop(tick, () => scene.render(ctx));
