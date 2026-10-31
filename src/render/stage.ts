import { RULES } from '../sim';
import { COLORS } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

/** 바닥 높이 (화면 y). 캐릭터 발밑이 여기 닿는다. */
export const GROUND_Y = 160;

/**
 * 임시 무대: 매연 낀 하늘, 멀리·가까이 벽돌 건물 실루엣, 노면전차 선로가 있는 거리.
 * 여러 겹이 카메라와 다른 속도로 움직인다. 무대 작업 때 다시 그린다.
 */
interface Layer {
  canvas: HTMLCanvasElement;
  /** 카메라 이동 대비 움직이는 비율 */
  speed: number;
}

let layers: Layer[] | null = null;

/** 렌더 전용 고정 난수 (모양만 정하므로 sim과 무관) */
function hash(n: number): number {
  n = (n ^ 61) ^ (n >>> 16);
  n = Math.imul(n, 9);
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function build(): Layer[] {
  const stageW = RULES.STAGE_W;
  const span = (speed: number) => Math.ceil(SCREEN_W + (stageW - SCREEN_W) * speed);

  // 하늘: 띠 사이를 2×2 디더링으로 잇는다
  const [sky, sc] = mk(SCREEN_W, SCREEN_H);
  const bands = [COLORS.smog0, COLORS.smog1, COLORS.smog2, COLORS.smog3];
  const BAYER = [[0, 2], [3, 1]];
  for (let y = 0; y < SCREEN_H; y++) {
    const f = Math.min(bands.length - 1.001, (y / 130) * (bands.length - 1));
    const i = Math.floor(f);
    const fr = (f - i) * 4;
    for (let x = 0; x < SCREEN_W; x++) {
      sc.fillStyle = fr > BAYER[y & 1][x & 1] ? bands[i + 1] : bands[i];
      sc.fillRect(x, y, 1, 1);
    }
  }

  const buildings = (speed: number, base: number, minH: number, maxH: number, color: string, windows: number, seed: number) => {
    const w = span(speed);
    const [c, g] = mk(w, SCREEN_H);
    let x = -4;
    let k = seed;
    while (x < w) {
      const bw = 14 + Math.floor(hash(k++) * 26);
      const bh = minH + Math.floor(hash(k++) * (maxH - minH));
      const top = base - bh;
      g.fillStyle = color;
      g.fillRect(x, top, bw, bh + 40);
      // 지붕 장식: 급수탑·굴뚝
      const deco = hash(k++);
      if (deco < 0.25) g.fillRect(x + 3, top - 6, 2, 6);
      else if (deco < 0.4) g.fillRect(x + bw - 8, top - 5, 6, 5);
      for (let wy = top + 4; wy < base - 4; wy += 6) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
          if (hash(k++) < windows) {
            g.fillStyle = COLORS.windowDim;
            g.fillRect(wx, wy, 2, 2);
            g.fillStyle = color;
          }
        }
      }
      x += bw + Math.floor(hash(k++) * 4);
    }
    return { canvas: c, speed };
  };

  // 거리: 보도, 차도, 노면전차 선로 (카메라와 같은 속도)
  const [street, st] = mk(stageW, SCREEN_H);
  st.fillStyle = COLORS.street;
  st.fillRect(0, GROUND_Y + 1, stageW, SCREEN_H - GROUND_Y);
  st.fillStyle = COLORS.streetLine;
  st.fillRect(0, GROUND_Y + 1, stageW, 1);
  st.fillStyle = COLORS.rail;
  st.fillRect(0, GROUND_Y + 9, stageW, 1);
  st.fillRect(0, GROUND_Y + 14, stageW, 1);
  st.fillStyle = COLORS.streetLine;
  for (let x = 0; x < stageW; x += 12) st.fillRect(x, GROUND_Y + 10, 6, 4);
  // 가스등
  for (let x = 40; x < stageW; x += 160) {
    st.fillStyle = COLORS.brickNear;
    st.fillRect(x, GROUND_Y - 44, 2, 45);
    st.fillRect(x - 3, GROUND_Y - 46, 8, 3);
    st.fillStyle = COLORS.gold;
    st.fillRect(x - 1, GROUND_Y - 43, 4, 2);
  }

  return [
    { canvas: sky, speed: 0 },
    buildings(0.3, 128, 30, 70, COLORS.brickFar, 0.12, 11),
    buildings(0.6, 146, 24, 56, COLORS.brickMid, 0.18, 97),
    buildings(0.85, GROUND_Y + 1, 12, 36, COLORS.brickNear, 0.1, 401),
    { canvas: street, speed: 1 },
  ];
}

export function drawStage(ctx: CanvasRenderingContext2D, camX: number): void {
  layers ??= build();
  for (const l of layers) ctx.drawImage(l.canvas, -Math.round(camX * l.speed), 0);
}
