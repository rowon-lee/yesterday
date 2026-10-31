import { CITADEL as D } from '../../data/stages/citadel';
import { MAP_H, MAP_W } from '../../stage/citadel';
import { drawText, textWidth } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, disc, dither, ditherRect, hash, haze, line, paint, rect } from '../dither';

/**
 * 먼 겹(하늘과 바다·1구역 마천루·시타델 탑 윗부분·중간 건물)의 도트 그림 (렌더 전용, 오프스크린 Canvas 2D에 미리 그린다).
 * 겹마다 카메라 대비 움직이는 비율(speed)이 있고, 그 비율만큼 가로·세로로 작은 그림이 된다: 폭 = 화면 + (맵 - 화면) × speed.
 * 3D 화면은 이 그림을 그 겹 속도의 깊이에 판으로 세운다 (world.ts의 backdrop: 2D 시차와 똑같이 움직인다).
 * 겹 안의 바닥은 겹 아래 끝에서 groundFromBottom 위. 먼 겹은 매연 색 디더링(haze)으로 덮는다.
 */
export interface Layer {
  canvas: HTMLCanvasElement;
  speed: number;
}

export const layerW = (speed: number): number => Math.ceil(SCREEN_W + (MAP_W - SCREEN_W) * speed);
export const layerH = (speed: number): number => Math.ceil(SCREEN_H + (MAP_H - SCREEN_H) * speed);
export const layerGround = (speed: number): number => layerH(speed) - D.groundFromBottom;
/** 월드 x가 화면 가운데에 올 때 화면 가운데에 보이는 겹 x */
export const toLayerX = (speed: number, worldX: number): number => worldX * speed + (SCREEN_W / 2) * (1 - speed);

// ---------------------------------------------------------------- 1. 하늘과 바다
/** 수평선 (하늘 겹 좌표 y) */
export const horizonY = (): number => layerGround(D.sky.speed) - D.sky.seaTop;

export function buildSky(): Layer {
  const s = D.sky.speed;
  const w = layerW(s);
  const h = layerH(s);
  const [c, g] = canvas(w, h);
  const hy = horizonY();
  // 하늘: 위는 어둡고 수평선으로 갈수록 매연이 뿌옇게. 바다: 수평선 아래 어두운 물, 물결 줄
  const bands = [C.smog0, C.smog0, C.smog1, C.smog2, C.smog3, C.smogHaze];
  paint(g, 0, 0, w, h, (x, y) => {
    if (y >= hy) {
      // 바다: 수평선 가까이는 매연 색, 앞으로 올수록 짙은 청록, 물결 줄
      const d = y - hy;
      const wave = (y + Math.floor(Math.sin(x * 0.07 + y * 0.9) * 2)) % (4 + Math.floor(d / 12)) === 0;
      if (wave && dither(x, y, Math.max(4, 10 - Math.floor(d / 10)))) return C.paintTeal;
      return dither(x, y, Math.max(2, 9 - Math.floor(d / 8))) ? C.smog3 : C.smog1;
    }
    const f = Math.max(0, Math.min(bands.length - 1.001, (y / hy) * (bands.length - 1)));
    const i = Math.floor(f);
    return dither(x, y, Math.round((f - i) * 16)) ? bands[i + 1] : bands[i];
  });
  rect(g, 0, hy, w, 1, C.smogHaze);
  // 매연에 가린 흐린 달과 바다에 비친 달빛 줄
  const m = D.sky.moon;
  disc(g, m.x, m.fromTop, m.r + 4, C.sunDim, 4);
  disc(g, m.x, m.fromTop, m.r, C.sunDim, 10);
  disc(g, m.x, m.fromTop, m.r - 6, C.sunDim, 16);
  // 달빛 줄: 달 아래 수면에 끊긴 가로 물결 조각이 세로로 늘어선다
  for (let y = hy + 2; y < h; y += 3) {
    const half = 3 + Math.floor((y - hy) / 16);
    const x0 = m.x - half + Math.round((hash(y * 13) - 0.5) * 4);
    const len = 2 + Math.floor(hash(y * 7) * half);
    if (hash(y * 31) < 0.75) rect(g, x0 + Math.floor(hash(y * 3) * half), y, len, 1, C.sunDim);
  }
  for (const [y, hh, lv] of [[40, 4, 6], [54, 3, 9], [66, 2, 11], [76, 5, 7], [110, 4, 5], [138, 3, 6]] as const) ditherRect(g, 0, y, w, hh, C.smog2, lv);
  return { canvas: c, speed: s };
}

/** 멀리 바다 위 등대 불빛 자리 (하늘 겹 좌표) */
export function farLight(): { x: number; y: number } {
  return { x: D.sky.farLight.x, y: horizonY() - 3 };
}

// ---------------------------------------------------------------- 2. 1구역 마천루 실루엣
export function buildFar(): Layer {
  const F = D.far;
  const w = layerW(F.speed);
  const h = layerH(F.speed);
  const gl = layerGround(F.speed) - 30;
  const [c, g] = canvas(w, h);
  let x = F.from;
  let k = F.seed;
  while (x < w) {
    const bw = 22 + Math.floor(hash(k++) * 34);
    const bh = F.min + Math.floor(hash(k++) * (F.max - F.min));
    const top = gl - bh;
    rect(g, x, top, bw, h - top, C.factory);
    // 아르데코 마천루: 위로 갈수록 두세 번 들어가는 지붕, 꼭대기 첨탑
    let sx = x;
    let sw = bw;
    let sy = top;
    const steps = 1 + Math.floor(hash(k++) * 3);
    for (let i = 0; i < steps && sw > 10; i++) {
      sx += 3 + Math.floor(sw * 0.12);
      sw -= 6 + Math.floor(sw * 0.24);
      sy -= 10 + Math.floor(hash(k++) * 14);
      rect(g, sx, sy, sw, top - sy + 2, C.factory);
    }
    const mid = sx + Math.floor(sw / 2);
    if (hash(k++) < 0.6) {
      rect(g, mid - 1, sy - 30, 2, 30, C.factory);
      rect(g, mid - 2, sy - 12, 4, 2, C.factory);
    }
    for (let wy = top + 4; wy < gl - 4; wy += 6) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (hash(k++) < 0.05) rect(g, wx, wy, 1, 3, C.skylineLit);
    x += bw + 2 + Math.floor(hash(k++) * 8);
  }
  // 공장 지대: 톱니 지붕 공장과 굴뚝 (매연은 매 틱 따로 그린다)
  const fx0 = F.chimneys[0].x - 30;
  const fx1 = F.chimneys[F.chimneys.length - 1].x + 40;
  for (let x2 = fx0; x2 < fx1; x2 += 26) {
    const bh = 50 + Math.floor(hash(x2) * 30);
    rect(g, x2, gl - bh, 24, h - gl + bh, C.factory);
    for (let t = 0; t < 20; t += 8) for (let k = 0; k < 6; k++) rect(g, x2 + t + k, gl - bh - 6 + k, 1, 6 - k, C.factory);
  }
  for (const ch of farChimneys()) {
    rect(g, ch.x, ch.top, ch.w, gl - ch.top, C.factory);
    rect(g, ch.x - 1, ch.top, ch.w + 2, 3, C.factory);
    rect(g, ch.x + 1, ch.top + 12, ch.w - 2, 1, C.smog2);
    rect(g, ch.x + Math.floor(ch.w / 2), ch.top - 2, 1, 2, C.posterRed);
  }
  haze(c, C.smog3, F.haze);
  return { canvas: c, speed: F.speed };
}

/** 먼 겹 공장 굴뚝 (먼 겹 좌표). 매연을 매 틱 그린다 */
export function farChimneys(): Array<{ x: number; w: number; top: number }> {
  const gl = layerGround(D.far.speed) - 30;
  return D.far.chimneys.map((ch) => ({ x: ch.x, w: ch.w, top: gl - ch.h }));
}

// ---------------------------------------------------------------- 3. 시타델 탑 윗부분 (광장 뒤로 솟은 마천루)
const keepCenter = (): number => Math.round(toLayerX(D.keep.speed, D.keep.worldX));
const keepGround = (): number => layerGround(D.keep.speed) - 24;

/** 탑 몸통 단: [폭, 위 끝(꼭대기에서 아래로)] 아래에서 위로. 층층이 들어간다 */
function keepTiers(): Array<{ w: number; from: number; to: number }> {
  const K = D.keep;
  const gl = keepGround();
  const top = gl - K.h;
  return [
    { w: K.w + 44, from: gl + 40, to: top + 150 },
    { w: K.w, from: top + 150, to: top + 54 },
    { w: K.w - 52, from: top + 54, to: top + 20 },
  ];
}

export function buildKeep(): Layer {
  const K = D.keep;
  const w = layerW(K.speed);
  const h = layerH(K.speed);
  const [c, g] = canvas(w, h);
  const cx = keepCenter();
  const gl = keepGround();
  const dark = C.factory;
  const rib = C.smog2;
  const lit = C.skylineLit;
  // 둘레의 낮은 사무동: 평평한 지붕, 촘촘한 세로 기둥, 드문드문 켜진 창, 지붕 위 물탱크·안테나
  K.slabs.forEach((sl, i) => {
    const x0 = cx + sl.dx;
    const top = gl - sl.h;
    rect(g, x0, top, sl.w, h - top, i % 2 ? C.smog1 : dark);
    for (let x = x0 + 3; x < x0 + sl.w - 2; x += 6) rect(g, x, top + 4, 1, h - top - 4, rib);
    for (let y = top + 6; y < gl - 4; y += 6) {
      rect(g, x0, y, sl.w, 1, i % 2 ? dark : C.smog1);
      for (let x = x0 + 4; x < x0 + sl.w - 4; x += 6) if (hash(x * 7 + y * 13 + i) < 0.14) rect(g, x, y + 2, 2, 2, hash(x + y) < 0.3 ? C.windowLight : lit);
    }
    rect(g, x0 - 2, top - 3, sl.w + 4, 3, rib);
    if (i % 2) {
      rect(g, x0 + 12, top - 16, 14, 13, dark);
      rect(g, x0 + 10, top - 18, 18, 2, rib);
    } else rect(g, x0 + sl.w - 14, top - 26, 1, 23, rib);
  });
  // 탑 몸통: 단마다 세로 기둥과 창 줄, 켜진 사무실 (아래 단일수록 넓다). 멀어도 보이게 켜진 창은 밝게, 모서리에 빛줄
  for (const t of keepTiers()) {
    const x0 = cx - t.w / 2;
    rect(g, x0, t.to, t.w, t.from - t.to, dark);
    for (let x = x0 + 4; x < x0 + t.w - 2; x += 8) rect(g, x, t.to + 2, 2, t.from - t.to - 2, rib);
    for (let y = t.to + 6, f = 0; y < t.from - 4; y += 7, f++) {
      const allLit = hash(f * 59 + t.w) < 0.1;
      for (let x = x0 + 6; x < x0 + t.w - 6; x += 8) {
        const r = hash(x * 13 + y * 7);
        if (allLit || r < 0.16) rect(g, x, y, 3, 3, allLit || r < 0.06 ? C.officeLit : C.windowLight);
      }
    }
    // 단 꼭대기 처마와 빛 받는 모서리
    rect(g, x0 - 2, t.to, t.w + 4, 3, rib);
    rect(g, x0, t.to + 3, 2, t.from - t.to - 3, C.smog3);
    ditherRect(g, x0, t.to + 3, 1, t.from - t.to - 3, C.beam, 6);
  }
  // 빛나는 유리 왕관: 가로 빛띠 세 줄, 가운데 별 휘장
  const top = gl - K.h;
  const cw = K.w - 92;
  rect(g, cx - cw / 2, top, cw, 22, dark);
  for (const y of [top + 4, top + 10, top + 16]) ditherRect(g, cx - cw / 2 + 2, y, cw - 4, 2, C.lampGlow, 12);
  rect(g, cx - cw / 2 - 2, top - 2, cw + 4, 2, rib);
  disc(g, cx, top + 38, 9, C.smog3);
  disc(g, cx, top + 38, 7, dark);
  star(g, cx, top + 38, 2, C.posterRed);
  // 안테나: 가는 철탑, 가로대, 경고등 자리
  rect(g, cx - 1, top - K.mast, 2, K.mast, dark);
  for (let y = top - K.mast + 8; y < top; y += 9) rect(g, cx - 3, y, 6, 1, dark);
  for (const b of keepBeacons()) rect(g, b.x - 1, b.y - 1, 3, 2, C.neonRedDark);
  for (const lx of keepLights()) rect(g, lx.x - 5, lx.y, 10, 5, C.ironLight);
  haze(c, C.smog3, K.haze);
  return { canvas: c, speed: K.speed };
}

/** 탑 왕관 모서리 서치라이트 (겹 좌표) */
export function keepLights(): Array<{ x: number; y: number }> {
  const cx = keepCenter();
  const t = keepTiers()[2];
  return [{ x: cx - t.w / 2 + 6, y: t.to - 5 }, { x: cx + t.w / 2 - 6, y: t.to - 5 }];
}

/** 탑 안테나와 단 모서리의 항공 경고등 (겹 좌표). 빛은 매 틱 깜빡인다 */
export function keepBeacons(): Array<{ x: number; y: number }> {
  const cx = keepCenter();
  const top = keepGround() - D.keep.h;
  const t = keepTiers()[1];
  return [
    { x: cx, y: top - D.keep.mast },
    { x: cx, y: top - Math.round(D.keep.mast / 2) },
    { x: cx - t.w / 2, y: t.to - 2 },
    { x: cx + t.w / 2, y: t.to - 2 },
  ];
}

// ---------------------------------------------------------------- 4. 가운데 겹: 중간 건물, 공원 뒤 나무
/**
 * 가운데 겹의 바닥 (겹 좌표). 거리 바닥보다 조금 위에 보이게 해서(멀리 있는 땅은 위로 보인다),
 * 광장 난간 너머로 먼 길과 행인이 보이게 한다.
 */
export const midGround = (): number => layerGround(D.mid.speed) - 30;
/** 바다가 보이는 부두 뒤는 이 x(겹 좌표)까지 비운다 */
export const midSeaX = (): number => Math.round(toLayerX(D.mid.speed, D.mid.seaUntil));

export function buildMid(): Layer {
  const M = D.mid;
  const w = layerW(M.speed);
  const h = layerH(M.speed);
  const gl = midGround();
  const [c, g] = canvas(w, h);
  const parkFrom = toLayerX(M.speed, M.parkFrom);
  let x = midSeaX();
  let k = M.seed;
  let index = 0;
  while (x < w) {
    if (x > parkFrom) {
      // 공원 뒤: 키 큰 나무 무리
      const r = 14 + Math.floor(hash(k++) * 14);
      rect(g, x + r - 2, gl - 30, 4, 30, C.iron);
      disc(g, x + r, gl - 30 - r, r, C.factory);
      disc(g, x + r - 6, gl - 26 - r, r - 4, C.iron, 8);
      x += r + 6 + Math.floor(hash(k++) * 10);
      continue;
    }
    const bw = 56 + Math.floor(hash(k++) * 64);
    const bh = M.min + Math.floor(hash(k++) * (M.max - M.min));
    const top = gl - bh;
    const red = hash(k++) < 0.4;
    const base = red ? C.brickRedDark : C.brickDark;
    rect(g, x, top, bw, h - top, base);
    const steps = hash(k++) < 0.5 ? 2 : 0;
    let sx = x;
    let sw = bw;
    let sy = top;
    for (let s = 0; s < steps; s++) {
      sx += 8;
      sw -= 16;
      sy -= 22;
      rect(g, sx, sy, sw, 22, base);
      rect(g, sx - 1, sy, sw + 2, 2, C.stoneDark);
    }
    rect(g, x - 1, top, bw + 2, 3, C.stoneDark);
    for (let wy = top + 8; wy < gl - 12; wy += 15) {
      for (let wx = x + 4; wx < x + bw - 6; wx += 9) rect(g, wx, wy, 5, 8, hash(k++) < 0.1 ? C.windowLit : C.windowDark);
    }
    if (!steps && hash(k++) < 0.6) waterTower(g, x + 6 + Math.floor(hash(k++) * (bw - 24)), top, C.iron, 1.3);
    if (index % 3 === 1) {
      const text = ['HOTEL', 'TONIC', 'RADIO', 'CIGARS', 'COAL'][Math.floor(index / 3) % 5];
      const tw = textWidth(text, 2);
      const px = x + Math.floor((bw - tw - 8) / 2);
      ditherRect(g, px, top + 24, tw + 8, 18, index % 2 ? C.paintTeal : C.paintOchre, 12);
      drawText(g, text, px + 4, top + 28, C.paintCream, 2);
    }
    x += bw + 3 + Math.floor(hash(k++) * 6);
    index++;
  }
  // 먼 길: 보도와 차도 (행인이 이 위를 걷는다)
  const sea = midSeaX();
  rect(g, sea, gl, w - sea, h - gl, C.street);
  rect(g, sea, gl, w - sea, 3, C.sidewalk);
  rect(g, sea, gl + 3, w - sea, 1, C.curb);
  ditherRect(g, sea, gl + 4, w - sea, h - gl - 4, C.streetLine, 3);
  haze(c, C.smog3, M.haze);
  return { canvas: c, speed: M.speed };
}

function waterTower(g: CanvasRenderingContext2D, x: number, top: number, color: string, scale = 1): void {
  const tw = Math.round(14 * scale);
  const th = Math.round(12 * scale);
  const legs = Math.round(10 * scale);
  line(g, x + 2, top, x + 2, top - legs, color);
  line(g, x + tw - 3, top, x + tw - 3, top - legs, color);
  line(g, x + 2, top - 2, x + tw - 3, top - legs + 2, color);
  line(g, x + tw - 3, top - 2, x + 2, top - legs + 2, color);
  rect(g, x, top - legs - th, tw, th, color);
  for (let i = 0; i < Math.ceil(tw / 2); i++) rect(g, x + i, top - legs - th - i, tw - i * 2, 1, color);
}

/** 별 문장 (가운데 cx, cy), 크기 배수 */
export function star(g: CanvasRenderingContext2D, cx: number, cy: number, s = 1, color: string = C.posterRedDark): void {
  const rows = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rect(g, cx + (x - 3) * s, cy + (y - 3) * s, s, s, color);
  });
}
