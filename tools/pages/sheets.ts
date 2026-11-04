// npm run sheets가 헤드리스 브라우저로 여는 페이지. 동작마다 띠를 그려 PNG 데이터로 넘긴다.
// ?gif 이면 승인용 GIF에 쓸 프레임(1배 RGBA)도 넘긴다: 실제 속도용(작은 프레임 번호)과 느린 판용(번호·표시 틱·판정 상자)
import type { Motion } from '../../src/anim/motion';
import { cellOf } from '../../src/anim/motion';
import { MOTIONS } from '../../src/anim/motions';
import { checkMotion, drawStrip, scaleCanvas } from '../../src/anim/sheet';
import { dataBoxesAt } from '../../src/render/hitview';
import { drawText, GLYPH_H, textWidth } from '../../src/render/font';
import { SELFTEST_MOTIONS } from './selftest';
import { isSkin, skinForMotion, type SkinId } from '../../src/anim/skins';
import type { LookName } from '../../src/anim/skeleton';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? 4);
const only = params.getAll('only');
const wantGif = params.has('gif');
/** 캐릭터 겉모습 (장식·색 묶음): ?skin=raiden이면 라이덴 표식으로 그린다 */
const skinParam = params.get('skin');
const skin: SkinId = isSkin(skinParam) ? skinParam : 'base';
/** 색 묶음: ?look=p2면 2P 색으로 */
const look = (params.get('look') ?? 'p1') as LookName;
let list: Motion[] = params.has('selftest') ? SELFTEST_MOTIONS : MOTIONS;
if (only.length) list = list.filter((m) => only.includes(m.name));

/**
 * 그림 프레임 i가 보이는 틱 동안의 공격 상자들 (공격 데이터 그대로, 3-0a(2)): 그 틱들에 판정 구간이 있으면 상자를 모은다.
 * 그림 박자와 판정 틱이 어긋나면 상자가 다른 프레임에 붙어 보인다 (그림을 다시 깎을 때 확인)
 */
function hitsInFrame(m: Motion, i: number): Array<{ x: number; y: number; w: number; h: number }> {
  const c0 = m.dur.slice(0, i).reduce((a, b) => a + b, 0);
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let t = c0; t < c0 + m.dur[i]!; t++) {
    const b = dataBoxesAt(m.name, t).hit;
    if (b && !out.some((o) => o.x === b.x && o.y === b.y && o.w === b.w && o.h === b.h)) out.push(b);
  }
  return out;
}

const LABEL_H = GLYPH_H + 3;

/** GIF 한 프레임 (1배): 위 글 줄 + 칸. slow면 번호·표시 틱·판정 표시 */
function gifFrame(m: Motion, i: number, slow: boolean): string {
  const { w: cw, h: ch, fx: footX, fy: footY } = cellOf(m);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = LABEL_H + ch;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#07040e';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#120a24';
  ctx.fillRect(0, LABEL_H, cw, ch);
  ctx.fillStyle = '#2a1f44';
  ctx.fillRect(0, LABEL_H + footY + 1, cw, 1);
  // 판정 (공격 데이터): 이 프레임이 보이는 틱 동안의 공격 상자
  const boxes = hitsInFrame(m, i);
  const active = boxes.length > 0;
  const n = m.dur.length;
  drawText(ctx, `${i + 1}/${n}`, 1, 1, active && slow ? '#ff6a4a' : '#ffd25e');
  if (slow) {
    const t = `${m.dur[i]}T`;
    drawText(ctx, t, cw - textWidth(t) - 1, 1, '#9aa0c8');
    if (active) drawText(ctx, 'HIT', Math.round((cw - textWidth('HIT')) / 2), 1, '#ff6a4a');
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, LABEL_H, cw, ch);
  ctx.clip();
  m.draw(ctx, i, 0, LABEL_H, { skin: skinForMotion(m.name, skin), look });
  // 느린 판: 공격 상자 (공격 데이터 data/moves/time.ts 그대로). 칸 밖으로 나가는 부분은 칸 끝에서 잘린다
  if (slow) {
    ctx.strokeStyle = '#ff6a4a';
    ctx.lineWidth = 1;
    for (const b of boxes) ctx.strokeRect(footX + b.x + 0.5, LABEL_H + footY + b.y + 0.5, b.w - 1, b.h - 1);
  }
  ctx.restore();
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let bin = '';
  for (let k = 0; k < data.length; k++) bin += String.fromCharCode(data[k]);
  return btoa(bin);
}

(window as unknown as { __sheets: unknown }).__sheets = list.map((m) => {
  const errors = checkMotion(m);
  const cell = cellOf(m);
  return {
    name: m.name,
    dur: m.dur,
    errors,
    png: errors.length ? null : scaleCanvas(drawStrip(m, { skin: skinForMotion(m.name, skin), look }), scale).toDataURL('image/png'),
    gif: errors.length || !wantGif ? null : {
      w: cell.w,
      h: LABEL_H + cell.h,
      real: m.dur.map((_, i) => gifFrame(m, i, false)),
      slow: m.dur.map((_, i) => gifFrame(m, i, true)),
    },
  };
});
