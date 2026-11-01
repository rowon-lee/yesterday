import { RULES, statsOf, type SimState } from '../sim';
import { drawText, textWidth } from './font';
import { COLORS } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

const BAR_W = 180;
const BAR_H = 6;

/** 체력이 깎일 때 빨간 잔상이 천천히 따라온다 (렌더 전용) */
export class Hud {
  private lag = [1, 1];
  names: [string, string] = ['1P', 'CPU'];
  /** 화면 가운데 큰 글씨 (라운드 시작·KO 등) */
  banner = '';
  bannerT = 0;
  /** 터치 버튼이 화면 아래 양쪽을 덮을 때(휴대폰)는 기력 칸을 위(이름 밑)로 올린다 */
  meterTop = false;
  /** 콤보 표시: [수, 남은 틱] */
  combo: Array<[number, number]> = [
    [0, 0],
    [0, 0],
  ];

  tick(s: SimState): void {
    s.fighters.forEach((f, i) => {
      const r = f.hp / statsOf(f.char).hp;
      if (this.lag[i] < r) this.lag[i] = r;
      else if (s.fighters[i].hitstop === 0) this.lag[i] = Math.max(r, this.lag[i] - 0.006);
    });
    for (const c of this.combo) if (c[1] > 0) c[1]--;
    if (this.bannerT > 0) this.bannerT--;
    for (const e of s.events) {
      if (e.type === 'hit' && (e.combo ?? 0) >= 2) this.combo[e.who] = [e.combo!, 50];
      if (e.type === 'round') this.show(e.text!, 60);
      if (e.type === 'fight') this.show('FIGHT', 40);
      if (e.type === 'ko') this.show('KO', 100);
      if (e.type === 'timeup') this.show('TIME', 100);
      if (e.type === 'winner') this.show(`${this.names[e.who]} WIN`, 100000);
    }
    if (s.phase === 'matchEnd' && s.matchWinner < 0 && !this.bannerT) this.show('DRAW', 100000);
  }

  private show(text: string, ticks: number): void {
    this.banner = text;
    this.bannerT = ticks;
  }

  draw(ctx: CanvasRenderingContext2D, s: SimState): void {
    s.fighters.forEach((f, i) => {
      const max = statsOf(f.char).hp;
      const left = i === 0;
      const x = left ? 8 : SCREEN_W - 8 - BAR_W;
      const fill = (ratio: number, color: string, y: number, h: number) => {
        const w = Math.round(BAR_W * Math.max(0, Math.min(1, ratio)));
        ctx.fillStyle = color;
        ctx.fillRect(left ? x + BAR_W - w : x, y, w, h);
      };
      // 체력
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(x - 1, 7, BAR_W + 2, BAR_H + 2);
      fill(1, COLORS.panel, 8, BAR_H);
      fill(this.lag[i], COLORS.red, 8, BAR_H);
      fill(f.hp / max, f.hp / max < 0.3 ? COLORS.goldDark : COLORS.gold, 8, BAR_H);
      fill(f.hp / max, COLORS.goldLight, 8, 1);
      // 방어 내구도 (얇은 띠): 깨지면 빨갛게, 30% 아래면 금빛으로 깜빡인다
      fill(1, COLORS.panel, 15, 2);
      const g = f.guard / RULES.GUARD_MAX;
      const blink = (s.tick >> 3) & 1;
      const guardColor = f.mode === 'crush' ? (blink ? COLORS.red : COLORS.panel) : g < 0.3 ? (blink ? COLORS.gold : COLORS.sky) : COLORS.sky;
      fill(f.mode === 'crush' ? 1 : g, guardColor, 15, 2);
      // 이름과 라운드 승수
      const name = this.names[i];
      drawText(ctx, name, left ? x : x + BAR_W - textWidth(name), 19, COLORS.white);
      for (let w = 0; w < RULES.WINS_NEEDED; w++) {
        const px = left ? x + BAR_W - 5 - w * 7 : x + w * 7;
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(px - 1, 18, 6, 6);
        ctx.fillStyle = w < f.wins ? COLORS.gold : COLORS.panel;
        ctx.fillRect(px, 19, 4, 4);
      }
      // 라이덴 금강 스택 (이름 옆 4칸). 금강불괴 동안은 4칸이 붉게·희게 깜빡이며 남은 시간만큼 남는다
      if (f.char === 'raiden') {
        const nx = left ? x + textWidth(name) + 4 : x + BAR_W - textWidth(name) - 4 - 4 * 6;
        const lit = f.kongoT > 0 ? Math.ceil((f.kongoT / RULES.KONGO_TICKS) * RULES.KONGO_MAX) : f.kongo;
        for (let k = 0; k < RULES.KONGO_MAX; k++) {
          const kx = nx + k * 6;
          ctx.fillStyle = COLORS.ink;
          ctx.fillRect(kx - 1, 18, 6, 6);
          const on = k < lit;
          ctx.fillStyle = !on ? COLORS.panel : f.kongoT > 0 ? ((s.tick >> 2) & 1 ? COLORS.white : COLORS.raidenLight) : COLORS.raiden;
          ctx.fillRect(kx, 19, 4, 4);
        }
      }
      // 기력 3칸 (아래, 휴대폰은 이름 밑)
      const my = this.meterTop ? 27 : SCREEN_H - 10;
      const full = Math.floor(f.meter / RULES.METER_BAR);
      const part = (f.meter % RULES.METER_BAR) / RULES.METER_BAR;
      for (let k = 0; k < 3; k++) {
        const bx = left ? 8 + k * 26 : SCREEN_W - 8 - 24 - k * 26;
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(bx - 1, my, 26, 6);
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(bx, my + 1, 24, 4);
        const r = k < full ? 1 : k === full ? part : 0;
        ctx.fillStyle = full >= 3 ? COLORS.goldLight : COLORS.green;
        const w = Math.round(24 * r);
        ctx.fillRect(left ? bx : bx + 24 - w, my + 1, w, 4);
      }
      // 기력이 꽉 차면 MAX (필살기를 쓸 수 있다)
      if (full >= 3 && (s.tick >> 4) & 1) {
        const mx = left ? 8 + 3 * 26 + 2 : SCREEN_W - 8 - 3 * 26 - 2 - textWidth('MAX');
        drawText(ctx, 'MAX', mx, my, COLORS.goldLight);
      }
      // 콤보 수
      const [n, t] = this.combo[i];
      if (t > 0) {
        const txt = `${n} HITS`;
        drawText(ctx, txt, left ? 8 : SCREEN_W - 8 - textWidth(txt, 2), this.meterTop ? 37 : 32, COLORS.gold, 2);
      }
    });
    // 남은 시간 (연습은 시간이 흐르지 않아 --). 10초 아래면 빨갛게 깜빡인다
    const left = Math.ceil(s.timer / 60);
    const sec = s.practice ? '--' : String(left).padStart(2, '0');
    const urgent = !s.practice && left <= 10 && s.phase === 'fight';
    drawText(ctx, sec, Math.floor((SCREEN_W - textWidth(sec, 2)) / 2), 6, urgent && (s.tick >> 4) & 1 ? COLORS.red : COLORS.white, 2);
    drawText(ctx, `R${s.round}`, Math.floor((SCREEN_W - textWidth(`R${s.round}`)) / 2), 19, COLORS.white);
    // 가운데 큰 글씨
    if (this.bannerT > 0 && this.banner) {
      const scale = this.banner.length > 6 ? 3 : 4;
      const w = textWidth(this.banner, scale);
      const bx = Math.floor((SCREEN_W - w) / 2);
      const by = Math.floor(SCREEN_H * 0.3);
      drawText(ctx, this.banner, bx + 1, by + 1, COLORS.ink, scale);
      drawText(ctx, this.banner, bx, by, COLORS.white, scale);
    }
  }
}

