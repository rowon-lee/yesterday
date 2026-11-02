import { CITADEL as D } from '../../data/stages/citadel';
import { MAP_H, MAP_W } from '../../stage/citadel';
import { textWidth } from '../font';
import { COLORS as C } from '../palette';
import { SCREEN_H, SCREEN_W } from '../screen';
import { canvas, hash, line, rect } from '../dither';
import { neonText } from './tex';
import { registerLayerSign } from './signs';

/** 시타델 광장 구간 (월드 x) */
const PLAZA = D.sections.find((s) => s.id === 'plaza')!;

/**
 * 먼 겹(1구역 마천루·시타델 탑 윗부분·중간 건물)의 도트 그림 (렌더 전용, 오프스크린 Canvas 2D에 미리 그린다).
 * 겹마다 카메라 대비 움직이는 비율(speed)이 있고, 그 비율만큼 가로·세로로 작은 그림이 된다: 폭 = 화면 + (맵 - 화면) × speed.
 * 3D 화면은 이 그림을 그 겹 속도의 깊이에 판으로 세운다 (world.ts의 backdrop: 2D 시차와 똑같이 움직인다).
 * 그 깊이에서 보이는 크기 = 실제 크기 × speed 이므로 (한 층 약 90px, 창 18×45), 겹마다 층·창·물탱크를 그 배율로 그린다:
 * 중간 겹(0.6) 한 층 54px·창 약 10×22, 시타델 탑 겹(0.3) 한 층 27px, 먼 겹(0.12) 한 층 11px·창 2×4.
 * 겹 안의 바닥은 겹 아래 끝에서 groundFromBottom 위. 안개는 그림에 칠하지 않고 셰이더가 덮는다 (shaders.ts backdropMaterial).
 * 하늘과 바다는 셰이더로 그린다 (sky.ts).
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

/** 수평선 (하늘 겹 좌표 y) */
export const horizonY = (): number => layerGround(D.sky.speed) - D.sky.seaTop;

/** 멀리 바다 위 등대 불빛 자리 (하늘 겹 좌표) */
export function farLight(): { x: number; y: number } {
  return { x: D.sky.farLight.x, y: horizonY() - 3 };
}

const px = (g: CanvasRenderingContext2D, x: number, y: number, c: string) => rect(g, x, y, 1, 1, c);

// ---------------------------------------------------------------- 2. 1구역 마천루 실루엣 (먼 겹, 한 층 11px)
/** 먼 겹 한 층 (겹 px): 한 층 90px × 0.12 */
const FAR_FLOOR = 11;

export function buildFar(): Layer {
  const F = D.far;
  const w = layerW(F.speed);
  const h = layerH(F.speed);
  const gl = layerGround(F.speed) - 30;
  const [c, g] = canvas(w, h);
  /**
   * 마천루 한 채: 몸통과 두세 번 들어가는 단, 첨탑·안테나(붉은 경고등)·물탱크, 층마다(11px) 창 (2×4, 5px 간격).
   * 건물마다 켜진 정도가 다르고 몇 층은 통째로 켜졌다. 이웃 건물끼리 몸통 색이 한 단계씩 다르다 (테두리 선 없이 덩어리로 갈린다).
   * back이면 더 멀리 선 건물 (낮고 옅고 창이 드물다). k0: 씨앗, scale: 높이 배수 (바닷가 쪽은 낮게)
   */
  const tower = (x: number, k: number, back: boolean, scale: number): number => {
    const bw = (back ? 18 : 22) + Math.floor(hash(k++) * (back ? 26 : 34));
    const bh = Math.max(14, Math.round((F.min + Math.floor(hash(k++) * (F.max - F.min))) * (back ? 0.72 : 1) * scale));
    const tones = back ? ['#2d292f', '#29262c', '#312c33'] : ['#25222a', '#2a2730', '#201e25'];
    const body = tones[Math.floor(hash(k++) * tones.length)];
    const top = gl - bh;
    rect(g, x, top, bw, h - top, body);
    let sx = x;
    let sw = bw;
    let sy = top;
    const steps = bh > 60 ? 1 + Math.floor(hash(k++) * 3) : 0;
    for (let i = 0; i < steps && sw > 12; i++) {
      sx += 3 + Math.floor(sw * 0.12);
      sw -= 6 + Math.floor(sw * 0.24);
      sy -= FAR_FLOOR + Math.floor(hash(k++) * 2) * FAR_FLOOR;
      rect(g, sx, sy, sw, top - sy + 2, body);
    }
    const mid = sx + Math.floor(sw / 2);
    const r = hash(k++);
    if (r < 0.45 && bh > 80) {
      rect(g, mid, sy - 30, 1, 30, body);
      rect(g, mid - 1, sy - 12, 3, 2, body);
      if (!back) px(g, mid, sy - 31, C.neonRed);
    } else if (r < 0.7) {
      // 옥상 물탱크 (실제 크기 × 0.12: 몸통 4px, 다리 2px)
      rect(g, sx + 3, sy - 6, 4, 4, body);
      for (const lx of [sx + 3, sx + 6]) rect(g, lx, sy - 2, 1, 2, body);
    }
    // 창: 층마다 (11px) 2×4, 5px 간격. 건물마다 켜진 정도, 통째로 켜진 층, 따뜻한 빛·차가운 형광등
    const lit = back ? 0.04 + hash(k++) * 0.06 : 0.05 + hash(k++) * hash(k++) * 0.3;
    const cool = hash(k++) < 0.3;
    const colW = back ? 1 : 2;
    for (let wy = top + 4, f = 0; wy < gl - 5; wy += FAR_FLOOR, f++) {
      const allLit = !back && hash(k * 7 + f) < 0.05;
      for (let wx = x + 2; wx + colW <= x + bw - 2; wx += 5) {
        const q = hash(wx * 13 + wy * 7 + k);
        if (!allLit && q >= lit) continue;
        const warm = !(cool ? q < lit * 0.7 : q < lit * 0.15);
        rect(g, wx, wy, colW, back ? 3 : 4, back ? C.skylineLit : warm ? (q < lit * 0.45 ? C.windowLight : C.skylineLit) : C.officeLit);
      }
    }
    // 가끔 세로 네온 띠 (호텔·극장 간판이 멀리서 보이는 것)
    if (!back && hash(k++) < 0.06) {
      const nx = hash(k++) < 0.5 ? x + 1 : x + bw - 2;
      const ny = gl - 30 - Math.floor(hash(k++) * 40);
      rect(g, nx, ny, 1, 8 + Math.floor(hash(k++) * 8), hash(k++) < 0.5 ? '#8a2066' : '#1f7896');
    }
    return bw;
  };
  // 바닷가 쪽 시작: 낮은 부두 창고와 먼 크레인 둘에서 시작해 마천루로 높아진다 (바다 앞에 깎아지른 벽처럼 서지 않게)
  const ramp = (x: number) => Math.min(1, Math.max(0.12, (x - F.from - 30) / 320));
  for (let x = F.from, k = 0; x < F.from + 60; k++) {
    const sw = 10 + Math.floor(hash(k * 7 + 1) * 14);
    const sh = 5 + Math.floor(hash(k * 3 + 2) * 8);
    rect(g, x, gl - sh, sw, h - gl + sh, '#25222a');
    x += sw + 1 + Math.floor(hash(k) * 4);
  }
  for (const [cx, ch] of [[F.from + 14, 34], [F.from + 44, 40]] as const) {
    rect(g, cx, gl - ch, 1, ch, '#25222a');
    rect(g, cx + 9, gl - ch + 4, 1, ch - 4, '#25222a');
    rect(g, cx - 10, gl - ch, 26, 1, '#25222a');
    line(g, cx + 1, gl - ch + 1, cx + 5, gl - ch - 6, '#25222a');
    px(g, cx + 5, gl - ch - 7, C.neonRed);
  }
  // 먼 줄 (낮고 옅게, 틈 없이 이어 세운다: 가까운 줄 사이 좁은 틈으로 지평선 빛이 세로 줄처럼 새지 않게) 다음 가까운 줄
  for (const back of [true, false]) {
    let x = F.from + (back ? 56 : 64);
    let k = F.seed + (back ? 900 : 0);
    while (x < w) {
      const bw = tower(x, k, back, ramp(x));
      k += 23;
      x += bw + (back ? 0 : 2 + Math.floor(hash(k++) * 8));
    }
  }
  // 공장 지대 (먼 겹): 톱니 지붕 공장 (한 단 11px)과 굴뚝 (매연은 매 틱 따로 그린다)
  const fx0 = F.chimneys[0].x - 30;
  const fx1 = F.chimneys[F.chimneys.length - 1].x + 40;
  for (let x2 = fx0, k = 0; x2 < fx1; x2 += 26 + (k % 2) * 4, k++) {
    const bh = 44 + Math.floor(hash(x2) * 3) * FAR_FLOOR;
    rect(g, x2, gl - bh, 26, h - gl + bh, '#25222a');
    for (let t = 0; t < 24; t += 8) for (let i = 0; i < 6; i++) rect(g, x2 + t + i, gl - bh - 6 + i, 1, 6 - i, '#25222a');
    for (let wx = x2 + 3; wx < x2 + 23; wx += 5) if (hash(wx * 3 + k) < 0.3) rect(g, wx, gl - bh + 6, 2, 3, '#844018');
  }
  for (const ch of farChimneys()) {
    rect(g, ch.x, ch.top, ch.w, gl - ch.top, '#25222a');
    rect(g, ch.x - 1, ch.top, ch.w + 2, 3, '#25222a');
    rect(g, ch.x + 1, ch.top + 12, ch.w - 2, 1, '#34303a');
    px(g, ch.x + Math.floor(ch.w / 2), ch.top - 2, C.neonRed);
  }
  return { canvas: c, speed: F.speed };
}

/** 먼 겹 공장 굴뚝 (먼 겹 좌표). 매연을 매 틱 그린다 */
export function farChimneys(): Array<{ x: number; w: number; top: number }> {
  const gl = layerGround(D.far.speed) - 30;
  return D.far.chimneys.map((ch) => ({ x: ch.x, w: ch.w, top: gl - ch.h }));
}

// ---------------------------------------------------------------- 3. 시타델 탑 윗부분 (광장 뒤로 솟은 마천루, 한 층 27px)
const keepCenter = (): number => Math.round(toLayerX(D.keep.speed, D.keep.worldX));
const keepGround = (): number => layerGround(D.keep.speed) - 24;
/** 시타델 탑 겹 한 층 (겹 px): 한 층 90px × 0.3 */
const KEEP_FLOOR = 27;

/**
 * 탑 몸통 단 (아래에서 위로, 겹 좌표): 폭, 아래 끝, 위 끝. 시타델은 80층 가까운 초고층이라(2026-11-01 사용자 결정)
 * 맨 위 단은 겹 그림 위 끝을 넘어 계속 올라간다: 어느 높이에서 보아도 꼭대기는 화면 위, 낮은 구름 속이다.
 */
function keepTiers(): Array<{ w: number; from: number; to: number }> {
  const K = D.keep;
  const gl = keepGround();
  return [
    { w: K.w + 100, from: gl + 40, to: gl - 110 },
    { w: K.w + 52, from: gl - 110, to: gl - 230 },
    { w: K.w + 4, from: gl - 230, to: -10 },
  ];
}

/** 탑을 감싼 낮은 구름 띠 (겹 좌표 y 범위): 이 위로 탑은 구름에 묻혀 흐려진다 */
const CLOUD_DECK = { top: 18, bottom: 78 };

export function buildKeep(): Layer {
  const K = D.keep;
  const w = layerW(K.speed);
  const h = layerH(K.speed);
  const [c, g] = canvas(w, h);
  const cx = keepCenter();
  const gl = keepGround();
  // 둘레의 낮은 사무동: 평평한 지붕, 세로 기둥 (11px 간격), 층(27px)마다 창 띠, 드문드문 켜진 창, 지붕 위 물탱크·안테나
  K.slabs.forEach((sl, i) => {
    const x0 = cx + sl.dx;
    const top = gl - sl.h;
    const body = i % 2 ? '#211e25' : '#25222a';
    rect(g, x0, top, sl.w, h - top, body);
    for (let y = gl - KEEP_FLOOR, f = 0; y > top + 4; y -= KEEP_FLOOR, f++) {
      rect(g, x0, y + KEEP_FLOOR - 4, sl.w, 2, '#2c282d');
      for (let x = x0 + 3, k = 0; x + 7 <= x0 + sl.w - 2; x += 11, k++) {
        const q = hash(x * 7 + y * 13 + i);
        rect(g, x, y + 5, 7, 13, q < 0.13 ? (q < 0.04 ? C.officeLit : C.windowLight) : '#1c1a20');
      }
    }
    rect(g, x0 - 2, top - 3, sl.w + 4, 3, '#2c282d');
    if (i % 2) {
      rect(g, x0 + 12, top - 22, 18, 16, body);
      rect(g, x0 + 10, top - 24, 22, 2, '#2c282d');
      for (const lx of [x0 + 13, x0 + 27]) rect(g, lx, top - 6, 2, 6, body);
    } else rect(g, x0 + sl.w - 14, top - 30, 1, 27, '#2c282d');
  });
  return { canvas: c, speed: K.speed };
}

/**
 * 시타델 탑 (80층 가까운 본관 마천루의 위쪽): 층층이 들어간 단, 단마다 세로 기둥과 층 줄(27px), 큰 유리 칸
 * (켜진 사무실은 위로 갈수록 드물고 흐리다, 가끔 한 층이 통째로 켜졌다), 단 모서리를 타고 오르는 차가운 빛줄, 단 처마의 항공 경고등.
 * 맨 위 단은 겹 그림 위 끝까지 이어지고, 낮은 구름 띠에 감겨 위로 갈수록 구름 빛에 묻힌다 (꼭대기는 보이지 않는다).
 * 둘레 사무동(buildKeep)과 같은 깊이에 따로 그린다: 시타델이 무너지면 이 겹만 내려앉는다
 */
export function buildKeepTower(): Layer {
  const K = D.keep;
  const w = layerW(K.speed);
  const h = layerH(K.speed);
  const [c, g] = canvas(w, h);
  const cx = keepCenter();
  const dark = '#25222a';
  const rib = '#2c282d';
  const cloud = '#2b3346';
  const cloudLit = '#3c465e';
  /** 구름에 묻히는 정도 (0~1): 구름 띠 아래는 0, 띠 안에서 짙어지고 그 위는 거의 다 묻힌다 */
  const buried = (y: number) => (y > CLOUD_DECK.bottom ? 0 : y > CLOUD_DECK.top ? ((CLOUD_DECK.bottom - y) / (CLOUD_DECK.bottom - CLOUD_DECK.top)) * 0.75 : 0.75 + ((CLOUD_DECK.top - y) / CLOUD_DECK.top) * 0.2);
  for (const [ti, t] of keepTiers().entries()) {
    const x0 = Math.round(cx - t.w / 2);
    const to = Math.max(0, t.to);
    rect(g, x0, to, t.w, t.from - to, dark);
    for (let y = t.from - KEEP_FLOOR, f = 0; y > to + 2; y -= KEEP_FLOOR, f++) {
      rect(g, x0, y + KEEP_FLOOR - 3, t.w, 2, '#211e25');
      const fade = buried(y);
      const allLit = hash(f * 59 + t.w) < 0.07 && fade < 0.3;
      const odds = (0.17 - fade * 0.13) * (y < 120 ? 0.7 : 1);
      for (let x = x0 + 5, k = 0; x + 8 <= x0 + t.w - 4; x += 12, k++) {
        const r = hash(x * 13 + y * 7 + ti);
        const wy = y + 4;
        const wh = Math.min(16, Math.max(0, t.from - wy - 4));
        if (wy < 0 || wh <= 0) continue;
        if (!allLit && r >= odds) {
          rect(g, x, wy, 8, wh, '#1c1a20');
          continue;
        }
        rect(g, x, wy, 8, wh, fade > 0.5 ? C.skylineLit : allLit || r < 0.05 ? C.officeLit : C.windowLight);
        // 켜진 칸 안의 사람·블라인드 (몇 칸만)
        if (fade < 0.3 && hash(x + y * 3) < 0.3) rect(g, x + 2 + Math.floor(hash(x * 5) * 4), wy + wh - 7, 2, 7, '#3a3226');
      }
    }
    // 세로 기둥 (12px 간격, 창 사이 벽면이 한 단계 밝다)
    for (let x = x0 + 2; x < x0 + t.w - 2; x += 12) rect(g, x, to + 2, 2, t.from - to - 2, rib);
    // 단 처마, 모서리를 타고 오르는 차가운 빛줄 (단 위 끝까지)
    if (t.to > 0) rect(g, x0 - 2, t.to, t.w + 4, 3, rib);
    for (const ex of [x0 + 1, x0 + t.w - 2]) for (let y = to; y < t.from; y++) if ((y + ex) % 3 !== 0) px(g, ex, y, '#7690aa');
  }
  // 구름 띠: 탑을 감싼 가로 구름 자락 (탑 폭보다 조금 넓게, 덩어리째). 그 위 탑은 구름 빛에 묻힌다
  const tw = K.w + 120;
  for (let y = 0; y < CLOUD_DECK.bottom + 6; y++) {
    const k = buried(y);
    for (let x = Math.round(cx - tw / 2) - 30; x < cx + tw / 2 + 30; x++) {
      const edge = Math.abs(x - cx) / (tw / 2 + 30);
      const n = hash(Math.floor(x / 6) * 17 + Math.floor(y / 3) * 131) * 0.35 + hash(Math.floor(x / 23) * 7 + Math.floor(y / 9) * 53) * 0.65;
      const dense = k * (1.15 - edge * 0.9) + (n - 0.5) * 0.5;
      if (dense < 0.35) continue;
      if (y < 12 && hash(x * 31 + y * 7) * 12 > y) continue;
      px(g, x, y, dense > 0.75 && y > CLOUD_DECK.top ? cloudLit : cloud);
    }
  }
  for (const b of keepBeacons()) rect(g, b.x - 1, b.y - 1, 3, 2, C.neonRedDark);
  return { canvas: c, speed: K.speed };
}

/** 탑 서치라이트 (겹 좌표): 구름 띠 바로 아래 맨 위 단 모서리에서 구름 속을 쓴다 */
export function keepLights(): Array<{ x: number; y: number }> {
  const cx = keepCenter();
  const t = keepTiers()[2];
  return [{ x: cx - t.w / 2 + 6, y: CLOUD_DECK.bottom + 8 }, { x: cx + t.w / 2 - 6, y: CLOUD_DECK.bottom + 8 }];
}

/** 탑 단 처마 모서리와 모서리 빛줄 중간의 항공 경고등 (겹 좌표). 빛은 매 틱 깜빡인다 */
export function keepBeacons(): Array<{ x: number; y: number }> {
  const cx = keepCenter();
  const [t0, t1, t2] = keepTiers();
  return [
    { x: cx - t0.w / 2, y: t0.to - 2 },
    { x: cx + t0.w / 2, y: t0.to - 2 },
    { x: cx - t1.w / 2, y: t1.to - 2 },
    { x: cx + t1.w / 2, y: t1.to - 2 },
    { x: cx - t2.w / 2, y: CLOUD_DECK.bottom + 22 },
    { x: cx + t2.w / 2, y: CLOUD_DECK.bottom + 22 },
  ];
}

// ---------------------------------------------------------------- 4. 가운데 겹: 중간 건물 (한 층 54px), 공원 뒤 나무
/**
 * 가운데 겹의 바닥 (겹 좌표). 거리 바닥보다 조금 위에 보이게 해서(멀리 있는 땅은 위로 보인다),
 * 광장 난간 너머로 먼 길과 행인이 보이게 한다.
 */
export const midGround = (): number => layerGround(D.mid.speed) - 30;
/** 바다가 보이는 항만·부두 뒤는 이 x(겹 좌표) 사이를 비운다 */
export const midSeaX = (): number => Math.round(toLayerX(D.mid.speed, D.mid.seaUntil));
export const midSeaFromX = (): number => Math.round(toLayerX(D.mid.speed, D.mid.seaFrom));

/** 중간 겹 한 층 (겹 px): 한 층 90px × 0.6 */
const MID_FLOOR = 54;
/** 중간 겹 간판 이름 (같은 이름을 두 번 쓰지 않는다: 길가 간판과도 겹치지 않게) */
const MID_SIGNS = ['TONIC', 'CIGARS', 'COAL', 'BOWLING', 'MOTEL', 'TAILOR', 'GARAGE', 'TAVERN', 'LOANS', 'DRUGS', 'PRINTS', 'GRILL', 'SODA', 'TOYS', 'FURS', 'RECORDS', 'BOOKS', 'SAFES', 'HATS', 'GLOVES'];

/** 중간 겹 건물 색 (벽, 줄눈·그늘, 처마 돌, 꺼진 창) */
const MID_STYLES = [
  { wall: '#3a2d31', dark: '#2e2428', trim: '#45403d', glass: '#1c1a20' },
  { wall: '#402b29', dark: '#33221f', trim: '#4a4440', glass: '#1c1a20' },
  { wall: '#34343a', dark: '#2a2a30', trim: '#4a4a50', glass: '#18181e' },
  { wall: '#3c3630', dark: '#302a26', trim: '#4e4842', glass: '#1c1a1c' },
] as const;

export function buildMid(): Layer {
  const M = D.mid;
  const w = layerW(M.speed);
  const h = layerH(M.speed);
  const gl = midGround();
  const [c, g] = canvas(w, h);
  const parkFrom = toLayerX(M.speed, M.parkFrom);
  const parkUntil = toLayerX(M.speed, M.parkUntil);
  const seaFrom = midSeaFromX();
  let x = 0;
  let k = M.seed;
  let index = 0;
  let signs = 0;
  let church = false;
  while (x < w) {
    // 항만·부두 뒤는 비워 바다가 보이게
    if (x + 40 > seaFrom && x < midSeaX()) {
      x = midSeaX();
      continue;
    }
    if (x > parkFrom && x < parkUntil) {
      // 공원 너머 교회 종탑 하나 (위층 하늘의 주인공: 불 켜진 시계)
      if (!church && x > parkFrom + 90) {
        church = true;
        x += steeple(g, x, gl);
        continue;
      }
      x += tree(g, x, gl, k);
      k += 5;
      continue;
    }
    // 바다 앞뒤 첫 건물은 낮다 (부두 창고): 바다 쪽 끝이 깎아지른 벽처럼 서지 않게
    const nearSea = Math.abs(x - seaFrom) < 140 || Math.abs(x - midSeaX()) < 60;
    const tall = !nearSea && hash(k++) < 0.16;
    const bw = (tall ? 64 : 56) + Math.floor(hash(k++) * (tall ? 40 : 64));
    const floors = nearSea ? 1 + Math.floor(hash(k++) * 2) : tall ? 5 + Math.floor(hash(k++) * 2) : Math.max(2, Math.round((M.min + Math.floor(hash(k++) * (M.max - M.min))) / MID_FLOOR));
    const S = MID_STYLES[Math.floor(hash(k++) * MID_STYLES.length)];
    const top = gl - floors * MID_FLOOR - 6;
    rect(g, x, top, bw, h - top, S.wall);
    // 맨 위 처마 띠 (빛 받는 돌), 층 띠
    rect(g, x - 1, top, bw + 2, 3, S.trim);
    for (let f = 1; f < floors; f++) rect(g, x, gl - f * MID_FLOOR - 2, bw, 2, S.dark);
    // 1층: 가게 띠 (쇼윈도 몇에 불)
    const shopY = gl - 30;
    for (let sx = x + 4; sx + 18 <= x + bw - 4; sx += 22 + Math.floor(hash(sx) * 6)) {
      const lit = hash(sx * 3 + k) < 0.4;
      rect(g, sx, shopY, 18, 22, lit ? C.windowLit : S.glass);
      if (lit) rect(g, sx, shopY, 18, 3, C.windowLight);
    }
    // 위층 창: 층마다 (54px) 창 (건물 모양마다 폭·간격이 다르다), 켜진 창 몇 (커튼·TV)
    const wide = hash(k++) < 0.35;
    const ww = wide ? 12 : 8;
    const pitch = wide ? 19 : 15;
    const wh = 22;
    for (let f = 1; f < floors; f++) {
      const wy = gl - (f + 1) * MID_FLOOR + 16;
      for (let wx = x + 5; wx + ww <= x + bw - 4; wx += pitch) {
        const q = hash(wx * 7 + wy * 13 + k);
        rect(g, wx - 1, wy + wh, ww + 2, 2, S.trim);
        if (q < 0.12) {
          rect(g, wx, wy, ww, wh, q < 0.03 ? '#405a76' : C.windowLit);
          rect(g, wx, wy, ww, 4, q < 0.03 ? '#7690aa' : C.windowLight);
          if (q > 0.06) rect(g, wx, wy + 4, 3, wh - 4, S.dark);
        } else rect(g, wx, wy, ww, wh, S.glass);
      }
    }
    // 비상계단 (몇 채): 층마다 발판(윗면이 빛 받는다)과 지그재그 계단
    if (!nearSea && floors >= 3 && hash(k++) < 0.4) {
      const ex = x + Math.floor(bw * 0.18);
      const ew = Math.min(30, Math.floor(bw * 0.4));
      for (let f = 1; f < floors; f++) {
        const fy = gl - f * MID_FLOOR - 4;
        rect(g, ex - 2, fy, ew + 4, 2, '#2c2a2e');
        px(g, ex - 2, fy, '#4a4648');
        rect(g, ex - 2, fy - 8, 1, 8, '#2c2a2e');
        rect(g, ex + ew + 1, fy - 8, 1, 8, '#2c2a2e');
        rect(g, ex - 2, fy - 8, ew + 4, 1, '#2c2a2e');
        line(g, f % 2 ? ex : ex + ew, fy, f % 2 ? ex + ew : ex, fy - MID_FLOOR + 2, '#2c2a2e');
      }
    }
    // 옥상: 물탱크 (실제 크기 × 0.6), 굴뚝, 안테나 (붉은 경고등)
    const roof = hash(k++);
    if (roof < 0.45) waterTower(g, x + 6 + Math.floor(hash(k++) * Math.max(1, bw - 30)), top, '#26232a');
    else if (roof < 0.7) {
      const cx = x + 8 + Math.floor(hash(k++) * (bw - 20));
      rect(g, cx, top - 14, 6, 14, S.dark);
      rect(g, cx - 1, top - 15, 8, 2, S.trim);
    } else if (tall) {
      const ax = x + Math.floor(bw / 2);
      rect(g, ax, top - 34, 1, 34, '#26232a');
      rect(g, ax - 4, top - 22, 9, 1, '#26232a');
      px(g, ax, top - 35, C.neonRed);
    }
    // 먼 가게 간판 (어둡게 켜진 관 글씨 하나, 이름은 한 번씩만). 시타델 광장 뒤에는 달지 않는다 (주인공 간판은 CITADEL 하나)
    if (index % 3 === 1 && signs < MID_SIGNS.length) {
      const text = MID_SIGNS[signs];
      const tw = textWidth(text, 1);
      const sx = x + Math.floor((bw - tw - 6) / 2);
      const sy = gl - 38;
      const signWorld = (sx - (SCREEN_W / 2) * (1 - M.speed)) / M.speed;
      if (tw + 6 <= bw - 4 && (signWorld < PLAZA.x0 - SCREEN_W / 2 || signWorld > PLAZA.x1)) {
        rect(g, sx, sy, tw + 6, 9, '#1a161c');
        rect(g, sx, sy, tw + 6, 1, S.trim);
        neonText(g, null, text, sx + 3, sy + 2, 1, index % 2 ? '#c27c44' : '#8a6c9a', '#1a161c');
        registerLayerSign(text, '중간 겹 간판', M.speed, sx + 3, sx + 3 + tw, sy + 2, sy + 7, tw, tw + 6);
        signs++;
      }
    }
    x += bw + 3 + Math.floor(hash(k++) * 6);
    index++;
  }
  // 먼 길: 보도와 차도 (행인이 이 위를 걷는다). 항만·부두 뒤(바다)는 비운다
  for (const [a, b] of [[0, midSeaFromX()], [midSeaX(), w]]) {
    rect(g, a, gl, b - a, h - gl, C.street);
    rect(g, a, gl, b - a, 3, C.sidewalk);
    rect(g, a, gl + 3, b - a, 1, C.curb);
    for (let y = gl + 9; y < h; y += 7) rect(g, a, y, b - a, 1, C.streetLine);
  }
  return { canvas: c, speed: M.speed };
}

/**
 * 공원 뒤 나무 한 그루 (중간 겹): 줄기와 둥근 덩어리 몇 개가 겹친 잎 (가장자리가 잎 뭉치로 들쭉날쭉),
 * 위쪽 잎은 한 단계 밝다 (하늘빛). 나무마다 키·폭이 다르다. 쓴 폭을 돌려준다
 */
function tree(g: CanvasRenderingContext2D, x: number, gl: number, k: number): number {
  const r = 14 + Math.floor(hash(k) * 14);
  const trunk = 22 + Math.floor(hash(k + 1) * 16);
  const cx = x + r;
  rect(g, cx - 2, gl - trunk, 4, trunk, '#232026');
  const cy = gl - trunk - r * 0.6;
  const blobs: Array<[number, number, number]> = [[cx, cy, r]];
  for (let i = 0; i < 4; i++) blobs.push([cx + (hash(k * 7 + i) - 0.5) * r * 1.2, cy + (hash(k * 11 + i) - 0.6) * r * 0.9, r * (0.45 + hash(k * 3 + i) * 0.35)]);
  for (let y = Math.floor(cy - r * 1.6); y < gl - trunk + 4; y++) {
    for (let xx = x - 4; xx < x + r * 2 + 6; xx++) {
      let inside = false;
      for (const [bx, by, br] of blobs) {
        const jag = (hash(xx * 13 + y * 7) - 0.5) * 2.2;
        if (Math.hypot(xx + 0.5 - bx, y + 0.5 - by) < br + jag) {
          inside = true;
          break;
        }
      }
      if (!inside) continue;
      const lit = y < cy - r * 0.35 + (hash(xx * 3 + y) - 0.5) * 3;
      px(g, xx, y, lit ? '#2c3430' : '#211f24');
    }
  }
  return r * 2 + 6 + Math.floor(hash(k + 2) * 10);
}

/**
 * 교회 (중간 겹): 낮은 본당(박공지붕, 좁은 아치 창 몇에 불)과 높은 종탑 (종 칸 아치, 불 켜진 시계, 뾰족 지붕, 꼭대기 붉은 경고등).
 * 공원 너머 위층 하늘에 실루엣이 선다. 쓴 폭을 돌려준다
 */
function steeple(g: CanvasRenderingContext2D, x: number, gl: number): number {
  const stone = '#34303a';
  const dark = '#28242c';
  // 본당
  const nw = 70;
  const nh = 96;
  rect(g, x, gl - nh, nw, nh, stone);
  for (let i = 0; i < 18; i++) rect(g, x + i * 2, gl - nh - i, nw - i * 4, 1, dark);
  for (let wx = x + 8, k = 0; wx < x + nw - 8; wx += 14, k++) {
    const lit = k === 1 || k === 3;
    rect(g, wx, gl - 70, 6, 34, lit ? '#8a6a46' : '#1c1a20');
    rect(g, wx + 1, gl - 72, 4, 2, lit ? '#8a6a46' : '#1c1a20');
    if (lit) rect(g, wx, gl - 70, 6, 6, '#d8a85e');
  }
  // 종탑
  const tx = x + nw - 6;
  const tw = 28;
  const top = gl - 250;
  rect(g, tx, top, tw, 250, stone);
  for (let y = top + 30; y < gl; y += 30) rect(g, tx, y, tw, 2, dark);
  for (const bx of [tx + 4, tx + 16]) {
    rect(g, bx, top + 8, 8, 18, '#16141a');
    rect(g, bx + 1, top + 6, 6, 2, '#16141a');
  }
  // 시계 (불 켜진 판과 바늘)
  const cx = tx + tw / 2;
  const cy = top + 46;
  for (let y = -7; y <= 7; y++) {
    const half = Math.floor(Math.sqrt(49 - y * y) + 0.5);
    rect(g, Math.round(cx - half), cy + y, half * 2, 1, Math.abs(y) > 5 || half > 6 ? '#8a7a5a' : '#e8d8a8');
  }
  rect(g, Math.round(cx) - 1, cy - 5, 1, 6, '#2a2420');
  rect(g, Math.round(cx) - 1, cy, 4, 1, '#2a2420');
  // 뾰족 지붕 (줄마다 한 칸씩 좁아진다)과 꼭대기 십자 막대·경고등
  for (let i = 0; i < 14; i++) rect(g, tx - 2 + i, top - 1 - i * 3, tw + 4 - i * 2, 3, dark);
  rect(g, Math.round(cx) - 1, top - 52, 1, 10, dark);
  rect(g, Math.round(cx) - 3, top - 49, 5, 1, dark);
  px(g, Math.round(cx) - 1, top - 53, C.neonRed);
  return nw + tw + 8;
}

/** 옥상 물탱크 (중간 겹: 실제 크기 × 0.6): 나무통과 원뿔 지붕, 쇠다리와 가새 */
function waterTower(g: CanvasRenderingContext2D, x: number, top: number, color: string): void {
  const tw = 20;
  const th = 16;
  const legs = 12;
  for (const lx of [x + 3, x + tw - 4]) rect(g, lx, top - legs, 1, legs, color);
  line(g, x + 3, top - 1, x + tw - 4, top - legs + 2, color);
  line(g, x + tw - 4, top - 1, x + 3, top - legs + 2, color);
  rect(g, x, top - legs - th, tw, th, color);
  for (const by of [4, 10]) rect(g, x, top - legs - th + by, tw, 1, '#1c1a20');
  for (let i = 0; i < Math.ceil(tw / 2); i++) rect(g, x + i, top - legs - th - Math.floor(i / 2) - 1, tw - i * 2, 1, color);
}

/** 별 문장 (가운데 cx, cy), 크기 배수 */
export function star(g: CanvasRenderingContext2D, cx: number, cy: number, s = 1, color: string = C.posterRedDark): void {
  const rows = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rect(g, cx + (x - 3) * s, cy + (y - 3) * s, s, s, color);
  });
}
