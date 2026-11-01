// npm run sheets가 헤드리스 브라우저로 여는 페이지. 동작마다 띠를 그려 PNG 데이터로 넘긴다.
// ?gif 이면 승인용 GIF에 쓸 프레임(1배 RGBA)도 넘긴다: 실제 속도용(작은 프레임 번호)과 느린 판용(번호·표시 틱·판정 상자)
import { hitBox } from '../../src/anim/boxes';
import type { Motion } from '../../src/anim/motion';
import { DEFAULT_CELL, FOOT_X, FOOT_Y } from '../../src/anim/motion';
import { MOTIONS } from '../../src/anim/motions';
import { checkMotion, drawStrip, scaleCanvas } from '../../src/anim/sheet';
import { BASE_MOVES, type MoveData } from '../../src/data/moves/base';
import { drawText, GLYPH_H, textWidth } from '../../src/render/font';
import { SELFTEST_MOTIONS } from './selftest';
import { isSkin, skinForMotion, type SkinId } from '../../src/anim/skins';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? 4);
const only = params.getAll('only');
const wantGif = params.has('gif');
/** 캐릭터 겉모습 (장식·색 묶음): ?skin=raiden이면 라이덴 표식으로 그린다 */
const skinParam = params.get('skin');
const skin: SkinId = isSkin(skinParam) ? skinParam : 'base';
let list: Motion[] = params.has('selftest') ? SELFTEST_MOTIONS : MOTIONS;
if (only.length) list = list.filter((m) => only.includes(m.name));

/** 이 동작 그림을 쓰는 기술 (판정 프레임·판정 구간을 느린 판에 표시) */
const moveOf = new Map<string, MoveData>();
for (const d of Object.values(BASE_MOVES) as MoveData[]) moveOf.set(d.motion, d);

const LABEL_H = GLYPH_H + 3;

/** GIF 한 프레임 (1배): 위 글 줄 + 칸. slow면 번호·표시 틱·판정 표시 */
function gifFrame(m: Motion, i: number, slow: boolean): string {
  const cell = m.cell ?? DEFAULT_CELL;
  const footY = Math.round((FOOT_Y / DEFAULT_CELL) * cell);
  const c = document.createElement('canvas');
  c.width = cell;
  c.height = LABEL_H + cell;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#07040e';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#120a24';
  ctx.fillRect(0, LABEL_H, cell, cell);
  ctx.fillStyle = '#2a1f44';
  ctx.fillRect(0, LABEL_H + footY + 1, cell, 1);
  const mv = moveOf.get(m.name);
  const active = mv?.active.includes(i) ?? false;
  const n = m.dur.length;
  drawText(ctx, `${i + 1}/${n}`, 1, 1, active && slow ? '#ff6a4a' : '#ffd25e');
  if (slow) {
    const t = `${m.dur[i]}T`;
    drawText(ctx, t, cell - textWidth(t) - 1, 1, '#9aa0c8');
    if (active) drawText(ctx, 'HIT', Math.round((cell - textWidth('HIT')) / 2), 1, '#ff6a4a');
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, LABEL_H, cell, cell);
  ctx.clip();
  m.draw(ctx, i, 0, LABEL_H, { skin: skinForMotion(m.name, skin) });
  // 느린 판: 판정 프레임이면 공격 상자 (팔꿈치→주먹 / 무릎→발 구간 끝쪽)
  if (slow && active && mv?.limb && m.joints) {
    const b = hitBox(m.joints[i], i, { frames: mv.active, limb: mv.limb });
    if (b) {
      ctx.strokeStyle = '#ff6a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(FOOT_X + b.x + 0.5, LABEL_H + FOOT_Y + b.y + 0.5, b.w - 1, b.h - 1);
    }
  }
  ctx.restore();
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let bin = '';
  for (let k = 0; k < data.length; k++) bin += String.fromCharCode(data[k]);
  return btoa(bin);
}

(window as unknown as { __sheets: unknown }).__sheets = list.map((m) => {
  const errors = checkMotion(m);
  const cell = m.cell ?? DEFAULT_CELL;
  return {
    name: m.name,
    dur: m.dur,
    errors,
    png: errors.length ? null : scaleCanvas(drawStrip(m, { skin: skinForMotion(m.name, skin) }), scale).toDataURL('image/png'),
    gif: errors.length || !wantGif ? null : {
      w: cell,
      h: LABEL_H + cell,
      real: m.dur.map((_, i) => gifFrame(m, i, false)),
      slow: m.dur.map((_, i) => gifFrame(m, i, true)),
    },
  };
});
