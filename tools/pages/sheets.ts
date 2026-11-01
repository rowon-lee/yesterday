// npm run sheets가 헤드리스 브라우저로 여는 페이지. 동작마다 띠를 그려 PNG 데이터로 넘긴다.
// ?gif 이면 승인용 GIF에 쓸 프레임(1배 RGBA)도 넘긴다: 실제 속도용(작은 프레임 번호)과 느린 판용(번호·표시 틱·판정 상자)
import { hitBox } from '../../src/anim/boxes';
import type { Motion } from '../../src/anim/motion';
import { cellOf } from '../../src/anim/motion';
import { MOTIONS } from '../../src/anim/motions';
import { checkMotion, drawStrip, scaleCanvas } from '../../src/anim/sheet';
import { BASE_MOVES, type MoveData, type MoveId } from '../../src/data/moves/base';
import { CHARACTERS } from '../../src/data/characters';
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

/** 이 동작 그림을 쓰는 기술 (판정 프레임·판정 구간을 느린 판에 표시) */
const moveOf = new Map<string, MoveData>();
for (const d of Object.values(BASE_MOVES) as MoveData[]) moveOf.set(d.motion, d);
// 캐릭터 기술: 기본 기술에 캐릭터가 바꾼 것을 덮어쓴 수치 (판정 프레임 표시)
for (const c of Object.values(CHARACTERS) as { moves?: Partial<Record<MoveId, Partial<MoveData>>> }[]) {
  for (const [id, own] of Object.entries(c.moves ?? {})) {
    const d = { ...BASE_MOVES[id as MoveId], ...own } as MoveData;
    moveOf.set(d.motion, d);
  }
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
  const mv = moveOf.get(m.name);
  const active = mv?.active.includes(i) ?? false;
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
  // 느린 판: 판정 프레임이면 공격 상자 (팔꿈치→주먹 / 무릎→발 구간 끝쪽 + 궤적 상자). 칸 밖으로 나가는 부분은 칸 끝에서 잘린다
  if (slow && active && mv?.limb && m.joints) {
    let b = hitBox(m.joints[i], i, { frames: mv.active, limb: mv.limb, reach: mv.reach });
    const t = mv.box;
    if (b && t) {
      const x0 = Math.min(b.x, t.x);
      const y0 = Math.min(b.y, t.y);
      b = { x: x0, y: y0, w: Math.max(b.x + b.w, t.x + t.w) - x0, h: Math.max(b.y + b.h, t.y + t.h) - y0 };
    }
    if (b) {
      ctx.strokeStyle = '#ff6a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(footX + b.x + 0.5, LABEL_H + footY + b.y + 0.5, b.w - 1, b.h - 1);
    }
  }
  // 궤적 상자만 판정인 기술 (boxOnly: 에드워드 해머 머리 등)
  if (slow && active && mv?.boxOnly && mv.box) {
    const t = mv.box;
    ctx.strokeStyle = '#ff6a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(footX + t.x + 0.5, LABEL_H + footY + t.y + 0.5, t.w - 1, t.h - 1);
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
