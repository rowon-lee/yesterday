import type { TickInput } from '../core/input';
import type { Tap } from '../core/pointer';
import { drawText, GLYPH_H, textWidth } from './font';
import { COLORS } from './palette';

/**
 * 도트 글자 메뉴 (타이틀·일시정지·경기 결과). 키보드(↑↓ 또는 W·S로 옮기고 J·Enter로 고름, K·Esc로 뒤로)와
 * 화면 누르기(항목을 바로 누름) 둘 다 받는다. 글자는 도트 폰트 하나(영문 대문자)만 쓴다.
 */
export interface MenuItem {
  label: string;
  /** 오른쪽에 붙는 값 (품질: HIGH 같은) */
  value?: () => string;
  /** 흐리게, 고를 수 없음 (예: 온라인 준비 중) */
  disabled?: boolean;
  /** 흐린 항목 옆에 작게 */
  note?: string;
  act?: () => void;
}

const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const OK = ['KeyJ', 'Enter', 'Space'];
const BACK = ['KeyK', 'Escape', 'Backspace'];
const any = (set: ReadonlySet<string>, keys: string[]) => keys.some((k) => set.has(k));

export const LINE_H = 16;
const SCALE = 2;

export class Menu {
  sel = 0;
  /** 마지막으로 그린 항목 자리 (누르기 판정용) */
  private rects: Array<[number, number, number, number]> = [];

  constructor(public items: MenuItem[], public title = '') {
    this.sel = Math.max(0, items.findIndex((i) => !i.disabled));
  }

  private move(d: number): void {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.sel + d * k + n * 4) % n;
      if (!this.items[i].disabled) {
        this.sel = i;
        return;
      }
    }
  }

  /** 입력을 받는다. 고르면 그 항목의 act를 부르고, 뒤로 가기면 'back'을 돌려준다 */
  handle(input: TickInput, taps: readonly Tap[]): 'back' | null {
    if (any(input.pressed, UP)) this.move(-1);
    if (any(input.pressed, DOWN)) this.move(1);
    for (const t of taps) {
      const i = this.rects.findIndex(([x, y, w, h]) => t.x >= x && t.x < x + w && t.y >= y && t.y < y + h);
      if (i >= 0 && !this.items[i].disabled) {
        this.sel = i;
        this.items[i].act?.();
        return null;
      }
    }
    if (any(input.pressed, OK)) {
      const it = this.items[this.sel];
      if (it && !it.disabled) it.act?.();
      return null;
    }
    if (any(input.pressed, BACK)) return 'back';
    return null;
  }

  /** 가운데 정렬로 그린다 (cx: 가운데 x, y: 첫 줄 위). 판 높이를 돌려준다 */
  draw(ctx: CanvasRenderingContext2D, cx: number, y: number, tick: number): number {
    this.rects = [];
    let yy = y;
    if (this.title) {
      drawText(ctx, this.title, Math.round(cx - textWidth(this.title) / 2), yy, COLORS.goldDark);
      yy += GLYPH_H + 7;
    }
    this.items.forEach((it, i) => {
      const text = it.value ? `${it.label}  ${it.value()}` : it.label;
      const w = textWidth(text, SCALE);
      const x = Math.round(cx - w / 2);
      const on = i === this.sel && !it.disabled;
      const color = it.disabled ? COLORS.gridLight : on ? COLORS.goldLight : COLORS.white;
      if (on) {
        // 고른 항목: 양옆 화살표 (도트 세모, 숨 쉬듯 1px 오감)
        const bob = (tick >> 4) & 1;
        arrow(ctx, x - 9 - bob, yy + 1, 1, COLORS.gold);
        arrow(ctx, x + w + 4 + bob, yy + 1, -1, COLORS.gold);
      }
      drawText(ctx, text, x + 1, yy + 1, COLORS.ink, SCALE);
      drawText(ctx, text, x, yy, color, SCALE);
      if (it.disabled && it.note) drawText(ctx, it.note, x + w + 6, yy + 3, COLORS.gridLight);
      // 누르기 판정은 글자보다 넉넉히 (손가락)
      this.rects.push([x - 14, yy - 4, w + 28, LINE_H]);
      yy += LINE_H;
    });
    return yy - y;
  }
}

/** 도트 세모 (dir 1 = 오른쪽을 가리킴) */
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, color: string): void {
  ctx.fillStyle = color;
  for (let r = 0; r < 4; r++) {
    const len = 4 - r;
    ctx.fillRect(dir > 0 ? x : x + r, y + r, len, 1);
    if (r) ctx.fillRect(dir > 0 ? x : x + r, y + 6 - r, len, 1);
  }
}

/** 화면 아래 도움말 줄: 어두운 띠 위에 글자 */
export function hintBar(ctx: CanvasRenderingContext2D, text: string, y: number): void {
  const w = textWidth(text) + 12;
  const x = Math.round((480 - w) / 2);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x, y - 3, w, GLYPH_H + 6);
  drawText(ctx, text, x + 6, y, COLORS.gridLight);
}

/** 메뉴 뒤 판: 어두운 판 + 1px 금빛 테 (반투명 대신 꽉 찬 판) */
export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COLORS.goldDark;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x, y, w, h);
}
