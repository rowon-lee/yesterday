import { Keyboard, type TickInput } from './core/input';
import { startLoop } from './core/loop';
import { setupScreen } from './render/screen';
import { bakeAllMotions } from './anim/motions';
import { DEFAULT_SCENE, GL_SCENES, SCENES } from './scenes';
import { measureFrame, quality } from './render/light';
import { drawText, textWidth } from './render/font';
import { SCREEN_H, SCREEN_W } from './render/screen';
import { gl, hasWebGL2, initGl } from './render/gl';

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') ?? DEFAULT_SCENE;
const makeScene = SCENES[sceneName];
if (!makeScene) throw new Error(`없는 장면: ${sceneName}`);
/** 확인용: 이 틱에서 멈춘다 (?stopAt=120). 캡처를 매번 같은 순간에 찍기 위함. */
let stopAt = params.has('stopAt') ? Number(params.get('stopAt')) : Infinity;

const canvas = document.getElementById('screen') as HTMLCanvasElement;
/**
 * 무대를 그리는 장면(대련·무대 보기)은 three.js 2.5D 화면에 그리고, #screen은 그 위에 HUD만 겹쳐 그리는 투명 캔버스가 된다.
 * 모션 뷰어처럼 무대가 없는 장면은 #screen에 바로 그린다.
 */
const GL_MODE = GL_SCENES.has(sceneName);
if (GL_MODE && !hasWebGL2()) {
  noWebGL(canvas);
  throw new Error('WebGL2를 쓸 수 없습니다');
}
const ctx = setupScreen(canvas, GL_MODE);
if (GL_MODE) initGl(canvas);

/** WebGL2가 없는 브라우저: 화면 자리에 안내 글 (게임 그림이 아니라 브라우저 글꼴로 쓴다) */
function noWebGL(c: HTMLCanvasElement): void {
  const box = document.createElement('div');
  box.textContent = '이 브라우저에서는 WebGL2를 쓸 수 없어 게임 화면을 그릴 수 없습니다. 최신 Chrome·Edge·Firefox·Safari로 열어 주세요.';
  box.style.cssText = 'color:#f4f0e6;font:16px/1.6 sans-serif;padding:24px;max-width:640px;text-align:center;word-break:keep-all';
  c.replaceWith(box);
}
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
  /** 성능 확인용: n번 (틱 + 그리기)를 하고 한 번에 걸린 평균 시간(ms)을 돌려준다 (픽셀은 읽지 않는다) */
  bench(n: number, sync = true) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      tick();
      scene.render(ctx);
      // 3D: 그래픽 칩 일이 끝날 때까지 기다려 그 시간도 잰다 (sync=false면 자바스크립트 몫만)
      if (GL_MODE && sync) gl().view.sync();
    }
    return (performance.now() - t0) / n;
  },
  /** 3D: 화면·무대 객체 (확인 도구용) */
  get gl() {
    return GL_MODE ? gl() : null;
  },
  /** 3D: 마지막 프레임의 그리기 호출 수와 삼각형 수 */
  glInfo() {
    return GL_MODE ? gl().view.info() : null;
  },
  /** 성능 확인용: 그리지 않고 n틱만 돌렸을 때 한 틱의 평균 시간(ms) */
  benchTicks(n: number) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) tick();
    return (performance.now() - t0) / n;
  },
  get quality() { return quality(); },
  /** 확인 도구(tools/clip)용: n틱 진행하고 그린 뒤 화면 픽셀을 색 번호로 돌려준다 */
  frame(n: number) {
    for (let i = 0; i < n; i++) tick();
    scene.render(ctx);
    let d: Uint8ClampedArray = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    if (GL_MODE) {
      // 3D 화면 위에 HUD를 겹친 그림
      const base = gl().view.read();
      for (let i = 0; i < SCREEN_W * SCREEN_H; i++) {
        if (d[i * 4 + 3] > 0) {
          base[i * 4] = d[i * 4];
          base[i * 4 + 1] = d[i * 4 + 1];
          base[i * 4 + 2] = d[i * 4 + 2];
        }
      }
      d = base;
    }
    let colors: number[] = [];
    const lookup = new Map<number, number>();
    const idx = new Uint8Array(canvas.width * canvas.height);
    let overflow = false;
    for (let i = 0; i < idx.length; i++) {
      const c = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
      let k = lookup.get(c);
      if (k === undefined) {
        if (colors.length >= 256) {
          overflow = true;
          break;
        }
        k = colors.length;
        colors.push(c);
        lookup.set(c, k);
      }
      idx[i] = k;
    }
    // 빛 레이어 때문에 256색을 넘으면 6×7×6 색 상자로 줄인다 (바둑판 디더링으로 띠가 덜 지게)
    if (overflow) {
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      colors = [];
      for (let r = 0; r < 6; r++) for (let gg = 0; gg < 7; gg++) for (let b = 0; b < 6; b++) {
        colors.push((Math.round((r * 255) / 5) << 16) | (Math.round((gg * 255) / 6) << 8) | Math.round((b * 255) / 5));
      }
      const w = canvas.width;
      for (let i = 0; i < idx.length; i++) {
        const t = (bayer[((Math.floor(i / w) & 3) << 2) | (i % w & 3)] + 0.5) / 16 - 0.5;
        const q = (v: number, n: number) => Math.max(0, Math.min(n, Math.round((v / 255) * n + t)));
        idx[i] = q(d[i * 4], 5) * 42 + q(d[i * 4 + 1], 6) * 6 + q(d[i * 4 + 2], 5);
      }
    }
    let bin = '';
    for (let i = 0; i < idx.length; i++) bin += String.fromCharCode(idx[i]);
    return { w: canvas.width, h: canvas.height, colors, data: btoa(bin) };
  },
};

// 확인용: ?ff=1 이면 멈출 틱(stopAt)까지 기다리지 않고 바로 돌린다 (긴 대전 장면 캡처용).
if (params.has('ff') && Number.isFinite(stopAt)) while (tickCount < stopAt) tick();

/** 확인용: ?fps=1 이면 화면 오른쪽 위에 초당 그린 화면 수, 한 번 그리는 데 걸린 시간, 조명 품질을 띄운다 (휴대폰에서 직접 확인) */
const showFps = params.get('fps') === '1';
let fpsFrames = 0;
let fpsSpent = 0;
let fpsAt = 0;
let fpsText = '';

function drawFps(ms: number, now: number): void {
  fpsFrames++;
  fpsSpent += ms;
  if (now - fpsAt >= 1000) {
    fpsText = `${Math.round((fpsFrames * 1000) / (now - fpsAt))}FPS ${(fpsSpent / fpsFrames).toFixed(1)}MS ${quality().toUpperCase()}`;
    fpsFrames = 0;
    fpsSpent = 0;
    fpsAt = now;
  }
  if (!fpsText) return;
  const w = textWidth(fpsText) + 4;
  ctx.fillStyle = '#000';
  ctx.fillRect(SCREEN_W - w, 0, w, 9);
  drawText(ctx, fpsText, SCREEN_W - w + 2, 2, '#ffffff');
}

/** 화면 그리기: 걸린 시간과 프레임마다 돈 틱 수를 재서 느리면 빛 레이어 품질을 낮춘다 (휴대폰 60프레임) */
function render(ticks: number, now: number): void {
  const t0 = performance.now();
  scene.render(ctx);
  const ms = performance.now() - t0;
  measureFrame(ms, t0, ticks);
  if (showFps) drawFps(ms, now);
}

startLoop(() => paused || tick(), render);
