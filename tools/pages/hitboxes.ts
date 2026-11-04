// npm run hitboxes가 헤드리스 브라우저로 여는 페이지 (3-0a(2)): 캐릭터마다 대표 프레임에 공격 데이터의 판정을 겹친 그림.
// 칸마다: 그 기술의 첫 판정 틱에 보이는 그림 프레임 + 피격 상자(초록) · 공격 상자(빨강) · 연검 판정 선(금색). 첫 칸은 대기(피격 상자만).
// 상자는 sim이 쓰는 값 그대로 (data/moves/time.ts, hurt.ts). 그림은 렌더 쪽 그림 박자로 고른 프레임.
import { cellOf } from '../../src/anim/motion';
import { MOTIONS } from '../../src/anim/motions';
import { skinForMotion } from '../../src/anim/skins';
import type { Box } from '../../src/data/moves/types';
import { drawText, GLYPH_H } from '../../src/render/font';
import { dataBoxesAt } from '../../src/render/hitview';
import { animFrameAt, moveAnim } from '../../src/render/pose';
import { motionOf, movesOf, type CharId } from '../../src/sim';

const SCALE = 3;
const CW = 128;
const CH = 96;
const FX = 64;
const FY = 93;
const LABEL = GLYPH_H + 4;
const COLS = 6;
const byName = new Map(MOTIONS.map((m) => [m.name, m]));
const ORDER = ['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick', 'charge', 'skill1', 'skill2', 'super'];
const KO: Record<string, string> = {
  atk1: '1', atk2: '2', atk3: '3', atk4: '4', launcher: 'UP', sweep: 'LOW', dashAttack: 'DASH', air1: 'A1', air2: 'A2', air3: 'A3',
  slam: 'SLAM', wallKick: 'WALL', charge: 'CHARGE', skill1: 'S1', skill2: 'S2', super: 'SUPER',
};

interface Cell { name: string; label: string; t: number; lv: number }

function sheet(c: CharId): string {
  const cells: Cell[] = [{ name: motionOf(c, 'idle'), label: 'IDLE', t: 0, lv: 0 }];
  const ms = movesOf(c);
  for (const id of ORDER) {
    const mv = ms[id as keyof typeof ms];
    if (!mv || !mv.time.hits.length) continue;
    const t = mv.activeStart;
    cells.push({ name: mv.time.motion, label: `${KO[id]} ${mv.time.hits[0]!.t[0]}-${mv.activeEnd}T`, t, lv: id === 'charge' ? 1 : 0 });
  }
  const rows = Math.ceil(cells.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * (CW + 1);
  canvas.height = rows * (CH + LABEL + 1);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#07040e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  cells.forEach((cell, k) => {
    const m = byName.get(cell.name)!;
    const mc = cellOf(m);
    const x0 = (k % COLS) * (CW + 1);
    const y0 = Math.floor(k / COLS) * (CH + LABEL + 1);
    ctx.fillStyle = '#120a24';
    ctx.fillRect(x0, y0 + LABEL, CW, CH);
    ctx.fillStyle = '#2a1f44';
    ctx.fillRect(x0, y0 + LABEL + FY + 1, CW, 1);
    drawText(ctx, cell.label, x0 + 2, y0 + 2, '#ffd25e');
    // 그림: 그 틱에 보이는 프레임 (그림 박자로), 칸 발밑을 128×96 발밑에 맞춘다
    const mvMatch = Object.values(movesOf(c)).find((mv) => mv.time.motion === cell.name);
    const frame = mvMatch ? animFrameAt(moveAnim(mvMatch), cell.t) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0 + LABEL, CW, CH);
    ctx.clip();
    m.draw(ctx, frame, x0 + FX - mc.fx, y0 + LABEL + FY - mc.fy, { skin: skinForMotion(m.name, c) });
    const d = dataBoxesAt(cell.name, cell.t, cell.lv);
    const stroke = (b: Box, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + FX + b.x + 0.5, y0 + LABEL + FY + b.y + 0.5, b.w - 1, b.h - 1);
    };
    if (d.hurt) stroke(d.hurt, '#5ef08a');
    if (d.hit) stroke(d.hit, '#ff4a4a');
    if (d.line) {
      ctx.strokeStyle = '#ffd25e';
      ctx.beginPath();
      d.line.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x0 + FX + x + 0.5, y0 + LABEL + FY + y + 0.5));
      ctx.stroke();
    }
    ctx.restore();
  });
  const out = document.createElement('canvas');
  out.width = canvas.width * SCALE;
  out.height = canvas.height * SCALE;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

const chars: CharId[] = ['raiden', 'eunwoo', 'edward', 'oscar', 'base'];
(window as unknown as { __hitboxes: unknown }).__hitboxes = chars.map((c) => ({ char: c, png: sheet(c) }));
