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
let stopAt = params.has('stopAt') ? Number(params.get('stopAt')) : Infinity;

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas);
const keyboard = new Keyboard();
// 모든 동작의 시트를 시작할 때 미리 그려 둔다.
bakeAllMotions();
const scene = makeScene();

let tickCount = 0;
/** 확인 도구가 직접 틱을 넘길 때는 화면 루프가 틱을 돌리지 않는다 */
let paused = false;
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
  /** 확인 도구(tools/clip)용: 멈춤 해제 (frame()으로 직접 진행) */
  unstop() {
    stopAt = Infinity;
    paused = true;
  },
  /** 확인 도구(tools/clip)용: n틱 진행하고 그린 뒤 화면 픽셀을 색 번호로 돌려준다 */
  frame(n: number) {
    for (let i = 0; i < n; i++) tick();
    scene.render(ctx);
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors: number[] = [];
    const lookup = new Map<number, number>();
    const idx = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < idx.length; i++) {
      const c = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
      let k = lookup.get(c);
      if (k === undefined) {
        k = Math.min(255, colors.length);
        if (colors.length < 256) colors.push(c);
        lookup.set(c, k);
      }
      idx[i] = k;
    }
    let bin = '';
    for (let i = 0; i < idx.length; i++) bin += String.fromCharCode(idx[i]);
    return { w: canvas.width, h: canvas.height, colors, data: btoa(bin) };
  },
};

// 확인용: ?ff=1 이면 멈출 틱(stopAt)까지 기다리지 않고 바로 돌린다 (긴 대전 장면 캡처용).
if (params.has('ff') && Number.isFinite(stopAt)) while (tickCount < stopAt) tick();

startLoop(() => paused || tick(), () => scene.render(ctx));
