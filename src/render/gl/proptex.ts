import type { Breakable } from '../../stage/citadel';
import { glyphRows } from '../font';
import { COLORS as C } from '../palette';
import { canvas, ditherRect, hash, line, rect } from '../dither';
import { FLUO, figure, glowRect, roomWall, sil, WARM } from './rooms';
import { neonText } from './tex';
import { neonMask, paintMask, paintWord, wordMask, wordWidth, type Mask, type Tube } from './signs';

/**
 * 부서지는 물건의 도트 텍스처 (렌더 전용): 단계마다(멀쩡·망가짐·파괴) 미리 그려 두고 바꿔 낀다.
 * 바탕(빛을 받는 색)과 발광(스스로 빛나는 부분)을 짝으로 그린다.
 */
export interface Pair {
  map: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}

const rnd = (i: number, k: number) => hash(i * 7919 + k * 104729);

function pair(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D, HTMLCanvasElement, CanvasRenderingContext2D] {
  const [map, g] = canvas(w, h);
  const [glow, e] = canvas(w, h);
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  return [map, g, glow, e];
}

export const NEON_HEX: Record<string, [string, string]> = {
  pink: [C.neonPink, C.neonPinkDark],
  cyan: [C.neonCyan, C.neonCyanDark],
  amber: [C.neonAmber, C.neonAmberDark],
  green: [C.neonGreen, C.neonGreenDark],
  red: [C.neonRed, C.neonRedDark],
};

// ---------------------------------------------------------------- 쇼윈도 유리
/**
 * 쇼윈도: 가게마다 안이 다르다 (빵집 선반·다이너·호텔 로비·세탁소 세탁기·식료품 상자·라디오 가게 TV).
 * stage 0 불 켜진 가게, 1 금 간 유리, 2 산산조각 (어두운 안, 틀에 남은 조각).
 */
export function paintGlass(b: Breakable, i: number, shop: string, stage: number): Pair {
  const w = Math.round(b.w);
  const h = Math.round(b.h);
  const [map, g, glow, e] = pair(w, h);
  if (stage === 2) {
    rect(g, 0, 0, w, h, C.windowDark);
    rect(g, 4, h - 12, w - 8, 2, C.iron);
    rect(g, 6, h - 20, w - 12, 1, C.iron);
    for (let k = 0; k < w; k += 3) {
      const tooth = 1 + Math.floor(rnd(i, k) * 7);
      rect(g, k, 0, 2, tooth, C.stone);
      const tb = 1 + Math.floor(rnd(i, k + 50) * 5);
      rect(g, k + 1, h - tb, 2, tb, C.stone);
      if (rnd(i, k + 70) < 0.3) rect(g, k, 0, 1, 1, C.skyLight);
    }
    rect(g, 0, 0, 1, h, C.stone);
    rect(g, w - 1, 0, 1, h, C.stone);
    // 꺼진 가게 안에 남은 희미한 불빛 한 점
    rect(e, Math.floor(w * 0.6), 6, 3, 2, '#3a2a18');
    return { map, glow };
  }
  // 가게 안: 천장 등마다 벽에 떨어지는 빛 웅덩이 (rooms.ts), 가게마다 다른 살림과 사람 실루엣
  const ramp = shop === 'LAUNDRY' ? FLUO : WARM;
  // 천장 등 바로 밑은 하얗게 날아간 빛의 심 (불 켜진 가게 창은 광원)
  roomWall(g, e, 0, 0, w, h, [[w * 0.28, 1, w * 0.3, h * 0.9, 0.85], [w * 0.74, 1, w * 0.28, h * 0.9, 0.78], [w * 0.5, h, w * 0.6, h * 0.3, 0.25]], 0.26, ramp, 8);
  const foot = h - 3;
  if (shop === 'LAUNDRY') {
    // 세탁기 줄 (둥근 유리문), 의자에 앉아 기다리는 사람
    for (let x = 4; x + 12 < w; x += 15) {
      sil(g, e, x, h - 24, 12, 20, C.chromeDark);
      rect(g, x + 3, h - 19, 6, 6, C.glassEdge);
      glowRect(g, e, x + 4, h - 18, 4, 4, C.paintTeal, '#0c2a2a');
    }
    figure(g, e, w - 10, foot, 34, 'sit');
  } else if (shop === 'GROCER') {
    // 과일 상자 (여러 색), 선반, 앞치마 두른 주인
    sil(g, e, 2, Math.floor(h * 0.45), w - 4, 2, C.iron);
    for (let x = 4; x + 8 < w * 0.45; x += 10) for (let k = 0; k < 3; k++) rect(g, x + k * 3, Math.floor(h * 0.45) - 3, 2, 3, [C.posterRed, C.paintOchre, C.carMint][(x + k) % 3]);
    figure(g, e, Math.floor(w * 0.66), foot - 4, 40, 'bare');
    for (let x = 3; x + 8 < w; x += 10) {
      sil(g, e, x, h - 12, 9, 9, C.awning);
      for (let k = 0; k < 6; k++) rect(g, x + 1 + (k % 3) * 3, h - 14 + Math.floor(k / 3) * 2, 2, 2, [C.posterRed, C.paintOchre, C.carMint][(x + k) % 3]);
    }
  } else if (shop === 'RADIO') {
    // 진열한 TV (화면이 푸르게 빛난다)와 라디오, TV를 보는 사람
    for (let x = 3; x + 10 < w; x += 13) {
      sil(g, e, x, h - 22, 11, 9, C.awning);
      glowRect(g, e, x + 2, h - 20, 7, 5, C.skyDark, '#4c6a86');
      glowRect(g, e, x + 2, h - 20, 7, 1, '#7fe0f4', '#7fe0f4');
      sil(g, e, x + 1, h - 12, 9, 5, C.paintOchre);
    }
    figure(g, e, Math.floor(w * 0.4), foot, 40, 'hat');
  } else if (shop === 'DINER') {
    // 카운터와 둥근 의자, 앉은 손님 둘, 커피 주전자 든 종업원
    figure(g, e, Math.floor(w * 0.55), foot - 6, 40, 'bare');
    sil(g, e, 0, h - 16, w, 12, C.chromeDark);
    glowRect(g, e, 0, h - 17, w, 1, C.paintCream, '#844018');
    for (const x of [Math.floor(w * 0.22), Math.floor(w * 0.78)]) figure(g, e, x, foot, 36, 'sit');
  } else if (shop === 'HOTEL') {
    // 호텔 로비: 접수대 뒤 직원, 열쇠함, 화분
    for (let y = 6; y < 22; y += 5) for (let x = 6; x < Math.floor(w * 0.4); x += 5) sil(g, e, x, y, 3, 3, C.awning);
    figure(g, e, Math.floor(w * 0.5), foot - 8, 40, 'bare');
    sil(g, e, Math.floor(w * 0.25), h - 18, Math.floor(w * 0.55), 15, '#3e2a1f');
    glowRect(g, e, Math.floor(w * 0.25), h - 19, Math.floor(w * 0.55), 1, C.windowLight, '#844018');
    sil(g, e, w - 12, h - 20, 8, 16, C.iron);
  } else {
    // 빵집: 선반 둘에 빵 덩어리, 앞치마 두른 제빵사
    figure(g, e, Math.floor(w * 0.7), foot, 40, 'bare');
    for (const y of [Math.floor(h * 0.45), Math.floor(h * 0.75)]) {
      sil(g, e, 2, y, w - 4, 2, C.iron);
      for (let x = 4; x < w - 6; x += 7) {
        if (hash(b.x * 7 + x + y) < 0.35) continue;
        glowRect(g, e, x, y - 4, 5, 4, C.paintOchre, '#3a2410');
      }
    }
  }
  // 유리에 비친 거리 (가는 사선 몇 줄)와 진열창 아래 턱 그림자
  for (let k = 0; k < Math.floor(w / 26); k++) {
    for (let y = 0; y < h; y += 2) {
      const x = k * 26 + 10 + Math.floor(y * 0.4);
      if (x < w - 1) rect(g, x, h - 1 - y, 1, 1, C.glassEdge);
    }
  }
  sil(g, e, 0, h - 3, w, 3, C.smog2);
  if (stage === 1) {
    // 별 모양 금: 하얀 선과 둥근 금
    const cx = Math.floor(w * (0.3 + rnd(i, 1) * 0.4));
    const cy = Math.floor(h * (0.3 + rnd(i, 2) * 0.4));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rnd(i, k + 3);
      const r = 8 + rnd(i, k + 10) * 18;
      line(g, cx, cy, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), C.white);
      line(e, cx, cy, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), '#000');
    }
    for (const r of [5, 10]) {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        rect(g, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 1, 1, C.skyLight);
      }
    }
  }
  return { map, glow };
}

/** 보도에 흩어진 유리 조각 (바닥 무늬, 가로 w × 깊이 d) */
export function paintShards(w: number, d: number, i: number): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  for (let k = 0; k < w * 0.8; k++) {
    const x = Math.floor(rnd(i, k + 100) * w);
    const y = Math.floor(rnd(i, k + 300) * d);
    rect(g, x, y, 1, 1, rnd(i, k) < 0.3 ? C.skyLight : C.stone);
  }
  return c;
}

// ---------------------------------------------------------------- 신문 가판대
/** 가판대 앞면 (stage 0 멀쩡, 1 찌그러짐: 지붕이 기울고 잡지 하나가 빠짐) */
export function paintNewsstand(w: number, h: number, stage: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  rect(g, 0, 0, w, h, C.awning);
  rect(g, w - 3, 0, 3, h, C.awningStripe);
  rect(g, 3, 8, w - 6, 18, C.windowDark);
  for (let k = 0; k < 6; k++) {
    if (stage === 1 && k === 3) continue;
    rect(g, 4 + k * 5, 10 + (k % 2) + (stage === 1 && k === 1 ? 3 : 0), 4, 14, k % 2 ? C.paintCream : C.stone);
  }
  rect(g, 3, 28, w - 6, 2, C.iron);
  neonText(g, null, 'NEWS', 6, 32, 1, C.paintCream, C.paintCream);
  if (stage === 1) {
    line(g, w - 3, 8, w - 8, h - 10, C.iron);
    line(g, 0, 3, w, 10, C.iron);
  }
  ditherRect(g, 0, 0, w, h, C.smog1, 4);
  return c;
}

/** 무너진 가판대 (납작한 판자 더미) */
export function paintNewsWreck(w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w + 8, h);
  rect(g, 0, h - 8, w + 8, 8, C.awning);
  line(g, 0, h - 6, 21, h - 15, C.awningStripe);
  line(g, 19, h - 14, w + 6, h - 5, C.iron);
  rect(g, 10, h - 12, 10, 3, C.awningStripe);
  return c;
}

/** 길에 흩어진 신문지 (바닥 무늬) */
export function paintPapers(w: number, d: number, i: number): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  for (let k = 0; k < 16; k++) {
    const x = Math.floor(rnd(i, k) * (w - 5));
    const y = Math.floor(rnd(i, k + 20) * (d - 3));
    rect(g, x, y, 5, 3, k % 3 ? C.paintCream : C.stone);
    rect(g, x + 1, y + 1, 3, 1, C.stoneDark);
  }
  return c;
}

/** 그을린 자국 (불탄 차 밑 바닥 무늬) */
export function paintScorch(w: number, d: number): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  ditherRect(g, 0, 0, w, d, C.fxSoot, 9);
  ditherRect(g, 10, Math.floor(d * 0.2), w - 20, Math.floor(d * 0.6), C.fxSoot, 14);
  return c;
}

/** 소화전 물웅덩이 (바닥 무늬, 젖은 정도가 높다) */
export function paintPuddle(w: number, d: number): HTMLCanvasElement {
  const [c, g] = canvas(w, d);
  for (let y = 0; y < d; y++) {
    const t = Math.abs(y - d / 2) / (d / 2);
    const half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - t * t)));
    rect(g, Math.floor(w / 2) - half, y, half * 2, 1, C.skyDark);
  }
  ditherRect(g, Math.floor(w * 0.25), Math.floor(d * 0.3), Math.floor(w * 0.5), Math.floor(d * 0.4), C.skyLight, 3);
  return c;
}

// ---------------------------------------------------------------- 네온 간판
/**
 * 네온 간판 한 장: 바탕과 발광 (전구 차례 phase 0~2마다 하나), 망가진 발광(글자 몇 개가 죽음), 깨진 바탕.
 * 모양: shop 가게 이름 판, blade 세로 간판(테두리 관과 차례로 도는 전구), board 다이너 전구 테두리 판.
 * text: 실제로 글자를 그린 자리 (텍스처 칸, 위가 0) — 글자 검사에 판 대신 이 자리를 적는다
 */
export interface SignTex {
  map: HTMLCanvasElement;
  broken: HTMLCanvasElement;
  glows: HTMLCanvasElement[];
  damaged: HTMLCanvasElement;
  text?: { x0: number; x1: number; y0: number; y1: number };
}

/** 주인공 간판 관의 심 (하얗게 날아간 빛: 흑백 200 이상)과 관 둘레 번짐 (그 색의 진한 빛) */
const NEON_HERO: Record<string, [string, string]> = {
  pink: ['#ffd6ee', '#b42d86'],
  cyan: ['#c8f6ff', '#2c9cbe'],
  amber: ['#ffe2a8', '#ad5a20'],
  green: ['#b0f0c8', '#338c66'],
  red: ['#ffd0c8', '#a82c2a'],
};

/** 지면 화면 경계 (CAM 0부터 460 간격, 폭 480): 간판 글씨가 이 경계를 걸치면 판 안에서 글자를 옮긴다 */
const CAM_EDGES: readonly number[] = (() => {
  const out: number[] = [];
  for (let k = 0; k < 14; k++) {
    const cam = Math.min(k * 460, 5920);
    out.push(cam, cam + 480);
  }
  return out;
})();

/** 판(월드 x0~x0+w) 안에서 폭 tw 글자를 둘 자리 (판 왼쪽에서): 가운데가 좋지만 화면 경계를 걸치면 비켜 둔다. 못 비키면 null */
function placeText(x0: number, w: number, tw: number, pad: number): number | null {
  const center = Math.floor((w - tw) / 2);
  // 원근 때문에 판 깊이에서 화면 끝이 몇 px 넓으므로 경계 둘레 4px도 피한다
  const crosses = (tx: number) => CAM_EDGES.some((e) => x0 + tx < e + 4 && x0 + tx + tw > e - 4);
  if (!crosses(center)) return center;
  for (let d = 1; d <= w; d++) {
    for (const tx of [center - d, center + d]) if (tx >= pad && tx + tw <= w - pad && !crosses(tx)) return tx;
  }
  return null;
}

/**
 * 네온 간판 그림. hero(구간의 주인공 간판)면 네온 네 겹의 앞 두 겹을 세게: 관은 하얗게 날아간 심, 관 둘레는 그 색의 진한 번짐.
 * 글자는 획 글꼴을 그 크기로 다시 긋는다 (3×5 글꼴을 키운 큰 네모 픽셀이 아니라 가는 유리관)
 */
export function paintSign(b: Breakable, i: number, hero = false): SignTex {
  const col = b.color ?? 'pink';
  const [bright, dark] = hero ? NEON_HERO[col] : NEON_HEX[col];
  const w = Math.round(b.w);
  const h = Math.round(b.h);
  const text = b.text ?? '';
  const tube: Tube = { core: bright, halo: dark, glass: C.smog3, mount: NEON_HEX[col][1] };
  const off: Tube = { ...tube, glass: C.iron, mount: C.iron };
  // 글자 배치 (모양마다): 글자 하나씩 [칸 그림, x, y]
  type Glyph = { m: Mask; x: number; y: number };
  const glyphs: Glyph[] = [];
  let textBox = { x0: 0, x1: w, y0: 0, y1: h };
  if (b.style === 'blade') {
    // 세로 간판: 위에서 아래로 쌓은 키 큰 글자 (주인공은 2칸 관)
    const n = Math.max(1, text.length);
    const step = Math.floor((h - 8) / n);
    const W = w >= 20 ? 13 : 9;
    const H = Math.min(19, step - 3);
    const t = hero ? 2 : 1;
    [...text].forEach((ch, k) => {
      const m = wordMask(ch, W, H, t, 0);
      glyphs.push({ m, x: Math.floor((w - m.w) / 2), y: 4 + k * step + Math.floor((step - H) / 2) });
    });
    textBox = { x0: 2, x1: w - 2, y0: 4, y1: 4 + n * step };
  } else if (b.style === 'board') {
    const W = 9;
    const H = 13;
    const tw = wordWidth(text, W, 2, 3);
    let x = Math.floor((w - tw) / 2);
    const y = Math.floor((h - H) / 2);
    for (const ch of text) {
      const m = wordMask(ch, W, H, 2, 0);
      glyphs.push({ m, x, y });
      x += m.w + 3;
    }
    textBox = { x0: Math.floor((w - tw) / 2), x1: Math.floor((w - tw) / 2) + tw, y0: y, y1: y + H };
  } else {
    // 가게 이름 판: 5×9 관 글씨. 화면 경계를 걸치면 판 안에서 비켜 두고 남는 쪽에 작은 그림 관 (가게 표시)
    // 판이 화면 경계에 걸려 5칸 글자로 비킬 곳이 없으면 4칸 좁은 글자로
    let W = 5;
    let tx = placeText(b.x, w, wordWidth(text, 5, 1, 1), 3);
    if (tx === null) {
      W = 4;
      tx = placeText(b.x, w, wordWidth(text, 4, 1, 1), 2) ?? Math.floor((w - wordWidth(text, 4, 1, 1)) / 2);
    }
    const H = 9;
    const tw = wordWidth(text, W, 1, 1);
    const y = Math.floor((h - H) / 2);
    let x = tx;
    for (const ch of text) {
      const m = wordMask(ch, W, H, 1, 0);
      glyphs.push({ m, x, y });
      x += m.w + 1;
    }
    textBox = { x0: tx, x1: tx + tw, y0: y, y1: y + H };
    // 남는 자리 (글자를 비켜 둔 쪽): 가게 표시 관 (사과·별 모양 작은 고리)
    const room = tx > w - (tx + tw) ? [3, tx - 3] : [tx + tw + 3, w - 3];
    if (room[1] - room[0] >= 9) {
      const cx = Math.floor((room[0] + room[1]) / 2);
      const icon: Mask = { w: 9, h: 9, m: new Uint8Array(81) };
      for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 9; xx++) {
        const d = Math.hypot(xx - 4, yy - 4.5);
        if (d > 2.6 && d < 3.7) icon.m[yy * 9 + xx] = 1;
      }
      icon.m[0 * 9 + 4] = 1;
      icon.m[1 * 9 + 4] = 1;
      icon.m[0 * 9 + 5] = 1;
      glyphs.push({ m: icon, x: cx - 4, y: Math.floor((h - 9) / 2) });
    }
  }
  const draw = (phase: number, dead: (k: number) => boolean, broken: boolean): Pair => {
    const [map, g, glow, e] = pair(w, h);
    // 간판 바깥 테두리는 어두운 선이 아니라 네온 빛을 받은 쇠 모서리 (무테: 형태는 빛으로 세운다)
    if (b.style === 'blade') {
      rect(g, 0, 0, w, h, C.chrome);
      rect(g, 1, 1, w - 2, h - 2, '#1a1418');
      for (const [x, y, ww, hh] of [[1, 1, w - 2, 1], [1, h - 2, w - 2, 1], [1, 1, 1, h - 2], [w - 2, 1, 1, h - 2]] as const) {
        rect(g, x, y, ww, hh, dark);
        if (!broken) rect(e, x, y, ww, hh, bright);
      }
      // 테두리 위를 차례로 도는 전구
      if (!broken) for (let y = 3; y < h - 3; y += 5) if ((Math.floor(y / 5) + phase) % 3 === 0) {
        rect(g, 1, y, 1, 1, C.lampCore);
        rect(e, 1, y, 1, 1, C.lampCore);
        rect(g, w - 2, h - 1 - y, 1, 1, C.lampCore);
        rect(e, w - 2, h - 1 - y, 1, 1, C.lampCore);
      }
    } else if (b.style === 'board') {
      rect(g, 0, 0, w, h, C.chromeDark);
      rect(g, 0, 0, w, 1, C.chrome);
      rect(g, 2, 2, w - 4, h - 4, '#1c1216');
      for (let x = 2, k = 0; x < w - 2; x += 4, k++) {
        for (const y of [0, h - 2]) {
          const on = !broken && (k + phase + (y ? 1 : 0)) % 3 !== 0;
          rect(g, x, y, 2, 2, on ? C.lampWarm : C.awning);
          if (on) rect(e, x, y, 2, 2, C.lampWarm);
        }
      }
    } else {
      rect(g, 0, 0, w, h, C.chromeDark);
      rect(g, 1, 1, w - 2, h - 2, C.smog0);
      rect(g, 1, h - 2, w - 2, 1, C.iron);
    }
    glyphs.forEach((gl, k) => {
      // 다이너는 N 한 글자가 죽어 있다 ("DI ER")
      const deadTube = dead(k) || (b.style === 'board' && text === 'DINER' && k === 2);
      if (broken && rnd(i, k + 40) < 0.5) {
        // 깨진 관: 반쯤 떨어져 나가고 쇠 받침만
        neonMask(g, null, gl.m, gl.x, gl.y, off);
        return;
      }
      neonMask(g, deadTube || broken ? null : e, gl.m, gl.x, gl.y, tube);
    });
    if (broken) {
      // 깨진 유리 조각 자국
      for (let k = 0; k < 5; k++) rect(g, Math.floor(rnd(i, k) * w), Math.floor(rnd(i, k + 5) * h), 2, 1, C.iron);
    }
    return { map, glow };
  };
  const glows = [0, 1, 2].map((ph) => draw(ph, () => false, false).glow);
  const base = draw(0, () => false, false).map;
  const damaged = draw(1, (k) => rnd(i, k + 90) < 0.4, false).glow;
  const broken = draw(0, () => true, true).map;
  return { map: base, broken, glows, damaged, text: textBox };
}

/** 극장 전구 차양 앞면 (폭 w, 높이 22): 위아래 줄 전구가 차례로 돌고, 크림색 판에 굵은 검은 글자 TONIGHT (7×9, 2칸 획) */
export function paintMarquee(w: number, text: string, i: number): SignTex {
  const h = 22;
  const tw = wordWidth(text, 7, 2, 2);
  const tx = Math.floor((w - tw) / 2);
  const draw = (phase: number, alive: (k: number) => boolean, broken: boolean): Pair => {
    const [map, g, glow, e] = pair(w, h);
    rect(g, 0, 0, w, h, C.iron);
    // 위·아래 모서리는 전구 빛을 받은 쇠 (어두운 1px 띠가 외곽선처럼 서지 않게)
    rect(g, 0, 0, w, 1, C.chrome);
    rect(g, 0, h - 1, w, 1, C.chrome);
    rect(g, 2, 5, w - 4, 12, C.paintCream);
    if (!broken) rect(e, 2, 5, w - 4, 12, '#2c271f');
    for (let x = 2, k = 0; x < w - 2; x += 4, k++) {
      for (const [y, j] of [[1, 0], [19, 1]] as const) {
        const on = !broken && alive(k * 2 + j) && (k + phase + j) % 3 !== 0;
        rect(g, x, y, 2, 2, on ? C.lampGlow : C.awning);
        if (on) rect(e, x, y, 2, 2, C.lampGlow);
      }
    }
    const m = paintWord(g, text, tx, 6, 7, 9, C.iron, 2, 2);
    paintMask(e, m, tx, 6, '#000000');
    if (broken) {
      for (let k = 0; k < 9; k++) rect(g, Math.floor(rnd(i, k) * w), 5 + Math.floor(rnd(i, k + 3) * 12), 3, 1, C.iron);
    }
    return { map, glow };
  };
  // 전구는 절반쯤 죽어 있다
  const alive = (k: number) => hash(i * 31 + k * 7) < 0.6;
  return {
    map: draw(0, alive, false).map,
    glows: [0, 1, 2].map((ph) => draw(ph, alive, false).glow),
    damaged: draw(1, (k) => alive(k) && hash(k * 13 + i) < 0.5, false).glow,
    broken: draw(0, () => false, true).map,
    text: { x0: tx, x1: tx + tw, y0: 6, y1: 15 },
  };
}

/**
 * 옥상 전광판 판 (테두리 전구가 차례로 깜빡임). 글씨는 따로 흘러가는 띠(boardStrip)가 판 앞에 얹힌다.
 */
export function paintBillboard(w: number, h: number): SignTex {
  const draw = (phase: number, on: boolean, broken: boolean): Pair => {
    const [map, g, glow, e] = pair(w + 4, h + 4);
    rect(g, 0, 0, w + 4, h + 4, C.iron);
    rect(g, 2, 2, w, h, C.smog0);
    for (let bx = 3, k = 0; bx < w + 1; bx += 3, k++) {
      const lit = on && (k + phase) % 3 === 0;
      const top = lit ? C.lampCore : on ? C.lampWarm : C.awning;
      const bottom = on && !lit ? C.lampCore : on ? C.lampWarm : C.awning;
      rect(g, bx, 3, 2, 1, broken && hash(k * 5) < 0.4 ? C.iron : top);
      rect(g, bx, h, 2, 1, broken && hash(k * 7 + 1) < 0.4 ? C.iron : bottom);
      if (on) {
        rect(e, bx, 3, 2, 1, top);
        rect(e, bx, h, 2, 1, bottom);
      }
    }
    return { map, glow };
  };
  return {
    map: draw(0, false, false).map,
    glows: [0, 1, 2].map((ph) => draw(ph, true, false).glow),
    damaged: draw(1, true, false).glow,
    broken: draw(0, false, true).map,
  };
}

/**
 * 전광판 글씨 띠 (칸마다 3px, 5줄): 켜진 전구는 알파 255, 꺼진 전구는 알파 160 (셰이더가 어둡게), 사이는 투명.
 * state 1 켜짐, 0 꺼짐, 2 깨짐 (전구 몇 개가 죽음)
 */
export function boardStrip(text: string, state: number, i: number): HTMLCanvasElement {
  const rows: boolean[][] = [[], [], [], [], []];
  for (const ch of text) {
    const glyph = glyphRows(ch);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) rows[r].push((glyph[r] & (4 >> c)) !== 0);
      rows[r].push(false);
    }
  }
  const len = rows[0].length;
  const [c, g] = canvas(len * 3, 15);
  const img = g.createImageData(len * 3, 15);
  const put = (x: number, y: number, hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    const p = (y * len * 3 + x) * 4;
    img.data[p] = n >> 16;
    img.data[p + 1] = (n >> 8) & 255;
    img.data[p + 2] = n & 255;
    img.data[p + 3] = a;
  };
  for (let col = 0; col < len; col++) {
    for (let r = 0; r < 5; r++) {
      const dead = state === 2 && rnd(i, col * 5 + r) < 0.3;
      const lit = state === 1 && rows[r][col];
      const hex = lit ? C.lampGlow : dead ? C.iron : C.awning;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(col * 3 + dx, r * 3 + dy, hex, lit ? 255 : 160);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
