import { BREAKABLES, createCity, type PropState } from '../sim';
import { MAP_H } from '../stage/citadel';
import { drawText, GLYPH_H, textWidth } from '../render/font';
import { hintBar, Menu, panel, type MenuItem } from '../render/menu';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import { gl } from '../render/gl';
import { lights as lights2d } from '../render/light';
import { touch } from '../core/touch';
import { isRoomCode } from '../net/config';
import { savedLogs } from '../net/log';
import { bootParam, net, ONLINE_ROSTER, type OnlineError } from '../net/session';
import type { App, Scene } from './scene';
import { drawFighter } from './title';

/** 캐릭터 이름 (도트 글꼴은 영문 대문자뿐) */
const NAMES: Record<string, string> = { raiden: 'RAIDEN', eunwoo: 'BAEK EUNWOO', edward: 'EDWARD', oscar: 'OSCAR' };

/** 끊김·실패 까닭 (도트 글꼴: 영문 대문자·숫자·. : - / +) */
const ERRORS: Record<OnlineError, string[]> = {
  server: ['CANNOT REACH THE MATCH SERVER', 'CHECK THE NETWORK AND TRY AGAIN'],
  noroom: ['NO ROOM WITH THAT CODE', 'CHECK THE CODE OR ASK FOR A NEW ONE'],
  full: ['THAT ROOM IS FULL'],
  version: ['GAME VERSIONS DIFFER', 'RELOAD THE PAGE ON BOTH SIDES'],
  connect: ['COULD NOT CONNECT TO THE RIVAL', 'THE NETWORK MAY BLOCK DIRECT LINKS'],
  left: ['THE RIVAL LEFT'],
  lost: ['CONNECTION LOST'],
};

/**
 * 온라인 대련 로비 (?scene=online, 타이틀 → ONLINE). 사용자 결정 2026-11-05: 방 코드 4자리, 숫자 패드, 초대 링크, 핑으로 입력 지연 고르기.
 *   CREATE ROOM: 코드를 크게 띄우고 상대를 기다린다. SHARE LINK로 초대 링크(?scene=online&room=1234)를 메신저로 보낼 수 있다
 *   JOIN ROOM: 숫자 패드(누르기 또는 숫자 키)로 4자리를 넣는다. 초대 링크로 열면 바로 들어간다
 *   이어지면 캐릭터 고르기: 서로의 고르기가 실시간으로 보이고(왼쪽 1P 방장, 오른쪽 2P), 둘 다 확정(READY)하면 방장이 시작한다.
 *   방장은 입력 지연을 AUTO(핑을 재서 2~4틱) 또는 2·3·4로 고정할 수 있다
 * 3D 장면이라 대련 장면으로 바뀌어도 페이지를 다시 불러오지 않는다 (연결이 그대로 남는다).
 */
export function onlineScene(app: App): Scene {
  const params = new URLSearchParams(location.search);
  let tick = 0;
  let cam = 2600;
  const props: PropState[] = BREAKABLES.map((b) => ({ hp: b.hp, stage: 0, damagedAt: -1, brokenAt: -1, crashed: false, dir: 1, at: 0 }));
  const city = createCity();
  touch.enable(false);
  /** 대련으로 넘길 확인용 주소 옵션 (CPU가 대신 누름, 그리지 않기) */
  const pass: Record<string, string> = {};
  for (const k of ['netcpu']) {
    const v = bootParam(k);
    if (v) pass[k] = v;
  }

  type View = 'menu' | 'pad';
  let view: View = 'menu';
  let digits = '';
  let flash = '';
  let flashT = 0;

  const toTitle = () => {
    net.leave();
    app.goto('title');
  };
  /** 마지막 경기 기록을 클립보드로 (어긋남이 났을 때 붙여 보내면 npm run netreplay로 조사한다) */
  const copyLog = async () => {
    const logs = savedLogs();
    if (!logs.length) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(logs[0]));
      flash = 'LOG COPIED';
    } catch {
      flash = 'COPY FAILED';
    }
    flashT = 180;
  };
  const menu = new Menu([
    { label: 'CREATE ROOM', act: () => net.create() },
    { label: 'JOIN ROOM', act: () => { view = 'pad'; digits = ''; } },
    { label: 'COPY LAST LOG', act: () => void copyLog() },
    { label: 'BACK', act: toTitle },
  ], 'ONLINE');
  menu.items[2]!.disabled = savedLogs().length === 0;
  const cancel = new Menu([{ label: 'CANCEL', act: () => net.leave() }]);
  const waiting = new Menu([
    { label: 'SHARE LINK', act: () => void share() },
    { label: 'CANCEL', act: () => net.leave() },
  ]);
  const DELAYS = [0, 2, 3, 4];
  const lobby = new Menu([
    ...ONLINE_ROSTER.map((c, i): MenuItem => ({
      label: NAMES[c] ?? c.toUpperCase(),
      value: () => (net.mine.sel === i && net.mine.locked ? 'READY' : ''),
      act: () => net.setPick(i, !(net.mine.sel === i && net.mine.locked)),
    })),
    {
      label: 'DELAY',
      value: () => (net.delayChoice ? `${net.delayChoice}` : `AUTO ${net.autoDelay()}`),
      act: () => net.setDelay(DELAYS[(DELAYS.indexOf(net.delayChoice) + 1) % DELAYS.length]!),
    },
    { label: 'LEAVE', act: toTitle },
  ], 'CHOOSE FIGHTER');

  /** 초대 링크: 휴대폰은 공유 창, PC는 클립보드 */
  const share = async () => {
    const url = `${location.origin}${location.pathname}?scene=online&room=${net.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'YESTERDAY', text: `ROOM ${net.code}`, url });
        flash = 'SHARED';
      } else {
        await navigator.clipboard.writeText(url);
        flash = 'LINK COPIED';
      }
    } catch (e) {
      // 공유 창을 닫은 것이면 조용히. 그 밖(클립보드 막힘)이면 코드를 알려 주라고 (도트 글꼴은 대문자뿐이라 주소를 띄우면 틀린 주소가 된다)
      if ((e as { name?: string })?.name === 'AbortError') return;
      flash = 'COPY FAILED - SEND THE CODE';
    }
    flashT = 180;
  };

  // 숫자 패드: 1 2 3 / 4 5 6 / 7 8 9 / < 0 OK
  const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'];
  const CELL_W = 34;
  const CELL_H = 20;
  const padX = Math.round(SCREEN_W / 2 - (CELL_W * 3 + 8) / 2);
  const padY = 160;
  let padSel = -1;
  let padFlash = 0;
  const press = (k: string) => {
    if (k === '<') digits = digits.slice(0, -1);
    else if (k === 'OK') {
      if (isRoomCode(digits)) {
        net.join(digits);
        view = 'menu';
      }
    } else if (digits.length < 4) digits += k;
  };

  // 초대 링크로 열었으면 바로 들어간다 (주소에서 방 코드는 지운다: 새로 고쳐도 다시 들어가지 않게)
  const linkRoom = params.get('room');
  if (net.phase === 'idle' && isRoomCode(linkRoom)) {
    net.join(linkRoom);
    history.replaceState(null, '', '?scene=online');
  }
  // 대련에서 '캐릭터 바꾸기'로 돌아왔으면 고르던 캐릭터에 커서
  lobby.sel = Math.max(0, net.mine.sel);
  net.wantLobby = false;

  return {
    tick(input) {
      tick++;
      cam += 0.4;
      if (flashT > 0) flashT--;
      if (padFlash > 0) padFlash--;
      net.tick();
      const taps = input.taps ?? [];
      if (net.phase === 'match') {
        app.goto('fight', { mode: 'online', ...pass });
        return;
      }
      if (net.phase === 'error') {
        if (input.pressed.size || taps.length) net.leave();
        return;
      }
      if (net.phase === 'creating' || net.phase === 'joining') {
        cancel.handle(input, taps);
        return;
      }
      if (net.phase === 'waiting') {
        if (waiting.handle(input, taps) === 'back') net.leave();
        return;
      }
      if (net.phase === 'lobby') {
        const r = lobby.handle(input, taps);
        // 커서를 옮기면 그 캐릭터로 (확정은 풀린다): 상대 화면에 바로 보인다
        if (lobby.sel < ONLINE_ROSTER.length && lobby.sel !== net.mine.sel) net.setPick(lobby.sel, false);
        if (r === 'back' && net.mine.locked) net.setPick(net.mine.sel, false);
        return;
      }
      // 처음 메뉴 / 숫자 패드
      if (view === 'pad') {
        for (let n = 0; n <= 9; n++) if (input.pressed.has(`Digit${n}`) || input.pressed.has(`Numpad${n}`)) press(String(n));
        if (input.pressed.has('Backspace')) press('<');
        if (input.pressed.has('Enter') || input.pressed.has('NumpadEnter') || input.pressed.has('KeyJ')) press('OK');
        if (input.pressed.has('Escape') || input.pressed.has('KeyK')) view = 'menu';
        for (const t of taps) {
          const cx = Math.floor((t.x - padX) / (CELL_W + 4));
          const cy = Math.floor((t.y - padY) / (CELL_H + 4));
          if (cx >= 0 && cx < 3 && cy >= 0 && cy < 4 && t.x - padX - cx * (CELL_W + 4) < CELL_W && t.y - padY - cy * (CELL_H + 4) < CELL_H) {
            padSel = cy * 3 + cx;
            padFlash = 6;
            press(PAD[padSel]!);
          }
        }
        return;
      }
      if (menu.handle(input, taps) === 'back') toTitle();
    },

    render(ctx) {
      const g = gl();
      lights2d.clear();
      g.world.foreground.visible = true;
      g.actors.hide();
      g.view.begin({ x: cam, y: MAP_H - SCREEN_H }, tick);
      g.world.update(g.view, tick, props, city, null, tick, null);
      g.view.commitLights();
      g.view.render();
      ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
      const title = 'ONLINE VERSUS';
      drawText(ctx, title, Math.round((SCREEN_W - textWidth(title, 3)) / 2) + 1, 31, COLORS.ink, 3);
      drawText(ctx, title, Math.round((SCREEN_W - textWidth(title, 3)) / 2), 30, COLORS.white, 3);
      const center = (t: string, y: number, color: string = COLORS.white, scale = 1) => {
        drawText(ctx, t, Math.round((SCREEN_W - textWidth(t, scale)) / 2), y, color, scale);
      };
      const dots = '.'.repeat(1 + ((tick >> 4) % 3));

      if (net.phase === 'error') {
        const lines = ERRORS[net.error ?? 'lost'];
        panel(ctx, SCREEN_W / 2 - 130, 110, 260, 30 + lines.length * 14);
        lines.forEach((l, i) => center(l, 122 + i * 14, i === 0 ? COLORS.goldLight : COLORS.white));
        hintBar(ctx, 'PRESS ANY KEY OR TAP', SCREEN_H - 14);
        return;
      }
      if (net.phase === 'creating' || net.phase === 'joining') {
        panel(ctx, SCREEN_W / 2 - 100, 110, 200, 64);
        center(net.phase === 'joining' ? `JOINING ROOM ${net.code}${dots}` : `OPENING A ROOM${dots}`, 122, COLORS.white);
        cancel.draw(ctx, SCREEN_W / 2, 148, tick);
        return;
      }
      if (net.phase === 'waiting') {
        panel(ctx, SCREEN_W / 2 - 110, 92, 220, 132);
        center('ROOM CODE', 102, COLORS.goldDark);
        center(net.code, 116, COLORS.goldLight, 6);
        center(`WAITING FOR RIVAL${dots}`, 158, COLORS.white);
        waiting.draw(ctx, SCREEN_W / 2, 176, tick);
        if (flashT > 0) center(flash, 212, COLORS.gold);
        hintBar(ctx, 'SEND THE CODE OR THE LINK TO YOUR RIVAL', SCREEN_H - 14);
        return;
      }
      if (net.phase === 'lobby') {
        // 왼쪽 1P(방장), 오른쪽 2P. 내 쪽은 내 커서, 상대 쪽은 상대 고르기
        const side = net.role === 'host' ? 0 : 1;
        const mineC = ONLINE_ROSTER[net.mine.sel]!;
        const theirC = ONLINE_ROSTER[net.theirs.sel]!;
        drawFighter(ctx, mineC, side as 0 | 1, tick);
        drawFighter(ctx, theirC, (1 - side) as 0 | 1, tick);
        const lx = 30;
        const rx = SCREEN_W - 30;
        const tag = (who: 'YOU' | 'RIVAL', c: string, locked: boolean, right: boolean) => {
          const a = `${who}`;
          const b = `${NAMES[c] ?? c.toUpperCase()}${locked ? '  READY' : ''}`;
          const x = (t: string) => (right ? rx - textWidth(t) : lx);
          drawText(ctx, a, x(a), 60, who === 'YOU' ? COLORS.goldLight : COLORS.white);
          drawText(ctx, b, x(b), 70, locked ? COLORS.gold : COLORS.gridLight);
        };
        tag('YOU', mineC, net.mine.locked, side === 1);
        tag('RIVAL', theirC, net.theirs.locked, side === 0);
        const h = lobby.items.length * 16 + GLYPH_H + 7;
        panel(ctx, SCREEN_W / 2 - 86, 92, 172, h + 16);
        lobby.draw(ctx, SCREEN_W / 2, 100, tick);
        // 상대 커서: 상대가 고른 이름 오른쪽 끝에 빨간 점
        const ry = 100 + GLYPH_H + 7 + net.theirs.sel * 16 + 3;
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(SCREEN_W / 2 + 78, ry, 4, 4);
        const route = net.route === 'relay' ? 'RELAY - FAR SERVER' : net.route === 'direct' ? 'DIRECT' : '';
        center(`PING ${Math.round(net.rtt)}MS  ${route}`, 92 + h + 22, net.route === 'relay' ? COLORS.red : COLORS.white);
        if (net.role !== 'host') lobby.items[ONLINE_ROSTER.length]!.disabled = true;
        hintBar(ctx, net.mine.locked ? 'WAITING FOR RIVAL - K: CANCEL READY' : 'W S: CHOOSE   J OR TAP: READY', SCREEN_H - 14);
        return;
      }
      if (view === 'pad') {
        panel(ctx, SCREEN_W / 2 - 80, 92, 160, 160);
        center('ROOM CODE', 100, COLORS.goldDark);
        // 넣은 4자리 칸
        for (let i = 0; i < 4; i++) {
          const x = SCREEN_W / 2 - 52 + i * 27;
          ctx.fillStyle = COLORS.gridLight;
          ctx.fillRect(x, 140, 22, 2);
          const d = digits[i];
          if (d) drawText(ctx, d, x + 5, 114, COLORS.goldLight, 4);
          else if (i === digits.length && (tick >> 4) & 1) ctx.fillRect(x + 9, 118, 4, 18);
        }
        PAD.forEach((k, i) => {
          const x = padX + (i % 3) * (CELL_W + 4);
          const y = padY + Math.floor(i / 3) * (CELL_H + 4);
          const ok = k === 'OK' && isRoomCode(digits);
          ctx.fillStyle = i === padSel && padFlash > 0 ? COLORS.gold : ok ? COLORS.goldDark : COLORS.night;
          ctx.fillRect(x, y, CELL_W, CELL_H);
          drawText(ctx, k, x + Math.round((CELL_W - textWidth(k, 2)) / 2), y + 5, ok ? COLORS.goldLight : k === 'OK' ? COLORS.gridLight : COLORS.white, 2);
        });
        hintBar(ctx, 'NUMBER KEYS OR TAP   ENTER: JOIN   K: BACK', SCREEN_H - 14);
        return;
      }
      const h = menu.items.length * 16 + GLYPH_H + 7;
      panel(ctx, SCREEN_W / 2 - 86, 118, 172, h + 16);
      menu.draw(ctx, SCREEN_W / 2, 126, tick);
      if (flashT > 0) center(flash, 118 + h + 22, COLORS.gold);
      hintBar(ctx, touch.available ? 'TAP TO SELECT' : 'W S: MOVE   J: SELECT   K: BACK', SCREEN_H - 14);
    },
  };
}
