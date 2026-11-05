import type { TickInput } from '../core/input';
import type { Tap } from '../core/pointer';
import { touch } from '../core/touch';
import { net, type MatchInfo } from '../net/session';
import { drawText, textWidth } from '../render/font';
import { hintBar, Menu, panel } from '../render/menu';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import type { SimState } from '../sim';

/** 장면이 할 일: 타이틀로 / 로비로 / 새 경기(재대결)로 상태를 새로 */
export type OnlineAction = 'title' | 'lobby' | 'reset' | null;

/**
 * 대련 장면의 온라인 부분 (?mode=online). 사용자 결정 2026-11-05: 일시정지는 없고 Esc·P·Ⅱ는 '나가기 확인'만 띄운다 (그동안에도 경기는 흐른다).
 * 경기가 끝나면 REMATCH(둘 다 고르면 새 시드로) / CHANGE FIGHTER(둘 다 로비로) / LEAVE.
 * 상대가 나가거나 연결이 끊기면 알리고, 아무 키나 누르거나 5초 뒤 타이틀로.
 * 화면 위 가운데(남은 시간 아래)에 핑·입력 지연, 상대 입력을 기다리면 WAITING, 상태 해시가 어긋나면 빨간 DESYNC와 틱 번호.
 */
export class OnlineFight {
  info: MatchInfo;
  private leaving = false;
  private go: OnlineAction = null;
  private picked: 'rematch' | null = null;
  private errorT = 0;
  private savedEnd = false;
  private savedDesync = false;
  private readonly leaveMenu = new Menu([
    { label: 'KEEP FIGHTING', act: () => { this.leaving = false; } },
    { label: 'LEAVE MATCH', act: () => { net.leave(); this.go = 'title'; } },
  ], 'LEAVE THE MATCH');
  private readonly endMenu = new Menu([
    { label: 'REMATCH', act: () => { if (!this.picked) { this.picked = 'rematch'; net.requestRematch(); } } },
    { label: 'CHANGE FIGHTER', act: () => { net.requestChange(); this.go = 'lobby'; } },
    { label: 'LEAVE', act: () => { net.leave(); this.go = 'title'; } },
  ]);

  constructor() {
    this.info = net.match!;
  }

  get side(): 0 | 1 {
    return this.info.side;
  }

  names(): [string, string] {
    return this.side === 0 ? ['YOU', 'RIVAL'] : ['RIVAL', 'YOU'];
  }

  /** 장면 틱 앞부분 (메뉴·끊김). menuOpen이면 내 입력은 0으로 (메뉴를 고르는 키가 공격으로 나가지 않게) */
  ui(input: TickInput, taps: readonly Tap[], s: SimState): { action: OnlineAction; menuOpen: boolean } {
    net.tick();
    if (net.phase === 'error' || net.phase === 'idle') {
      this.errorT++;
      if ((this.errorT > 30 && (input.pressed.size || taps.length)) || this.errorT > 300) {
        net.leave();
        return { action: 'title', menuOpen: true };
      }
      return { action: null, menuOpen: true };
    }
    if (net.wantLobby || net.phase === 'lobby') return { action: 'lobby', menuOpen: true };
    if (net.match && net.match.m !== this.info.m) {
      this.info = net.match;
      this.leaving = false;
      this.picked = null;
      this.savedEnd = false;
      this.savedDesync = false;
      this.endMenu.sel = 0;
      return { action: 'reset', menuOpen: false };
    }
    this.go = null;
    const pauseKey = input.pressed.has('Escape') || input.pressed.has('KeyP') || touch.takePause();
    const ended = s.phase === 'matchEnd' && s.phaseT > 120;
    if (this.leaving) {
      const r = this.leaveMenu.handle(input, taps);
      if (pauseKey || r === 'back') this.leaving = false;
      return { action: this.go, menuOpen: true };
    }
    if (pauseKey && !ended) {
      this.leaving = true;
      this.leaveMenu.sel = 0;
      return { action: null, menuOpen: true };
    }
    if (ended) {
      this.endMenu.handle(input, taps);
      return { action: this.go, menuOpen: true };
    }
    return { action: null, menuOpen: false };
  }

  /** 이번 장면 틱에 진행할 sim 틱들의 입력 (0~1개: 상대 입력을 기다리면 0개) */
  inputs(bits: number): Array<[number, number]> {
    const d = net.driver;
    if (!d || net.phase !== 'match') return [];
    return d.tick(bits);
  }

  /** sim을 한 틱 진행한 뒤: 해시 비교, 기록 저장 */
  afterStep(s: SimState): void {
    const d = net.driver;
    if (!d) return;
    d.afterStep(s);
    if (d.desync && !this.savedDesync) {
      this.savedDesync = true;
      net.saveLog();
    }
    if (s.phase === 'matchEnd' && !this.savedEnd) {
      this.savedEnd = true;
      net.saveLog();
    }
  }

  draw(ctx: CanvasRenderingContext2D, s: SimState): void {
    const center = (t: string, y: number, color: string, scale = 1) => {
      drawText(ctx, t, Math.round((SCREEN_W - textWidth(t, scale)) / 2), y, color, scale);
    };
    if (net.phase === 'error' || net.phase === 'idle') {
      const msg = net.error === 'left' ? 'THE RIVAL LEFT' : 'CONNECTION LOST';
      panel(ctx, SCREEN_W / 2 - 90, 110, 180, 40);
      center(msg, 118, COLORS.goldLight, 2);
      center('BACK TO TITLE', 136, COLORS.white);
      hintBar(ctx, 'PRESS ANY KEY OR TAP', SCREEN_H - 14);
      return;
    }
    const d = net.driver;
    const relay = net.route === 'relay' ? '  RELAY' : '';
    center(`PING ${Math.round(net.rtt)}MS  DELAY ${this.info.delay}${relay}`, 27, net.route === 'relay' ? COLORS.red : COLORS.gridLight);
    if (d && d.waiting > 6 && (s.tick >> 3) & 1) center('WAITING FOR RIVAL', 37, COLORS.white);
    else if (net.unstable) center('CONNECTION UNSTABLE', 37, COLORS.gold);
    if (d?.desync) {
      center(`DESYNC AT TICK ${d.desync.k}`, 47, COLORS.red);
      center('LOG SAVED', 57, COLORS.red);
    }
    if (this.leaving) {
      panel(ctx, SCREEN_W / 2 - 74, 96, 148, 58);
      this.leaveMenu.draw(ctx, SCREEN_W / 2, 104, s.tick);
      hintBar(ctx, 'THE MATCH KEEPS GOING   ESC: BACK', SCREEN_H - 14);
    } else if (s.phase === 'matchEnd' && s.phaseT > 120) {
      panel(ctx, SCREEN_W / 2 - 74, 148, 148, this.endMenu.items.length * 16 + 26);
      this.endMenu.draw(ctx, SCREEN_W / 2, 155, s.tick);
      const status = this.picked && net.rematch.theirs ? 'STARTING' : this.picked ? 'WAITING FOR RIVAL' : net.rematch.theirs ? 'RIVAL WANTS A REMATCH' : '';
      if (status) center(status, 155 + this.endMenu.items.length * 16 + 2, COLORS.gold);
    }
  }
}
