import { IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT, IN_SKILL1, IN_SKILL2, IN_SUPER, IN_UP, type PlayerInput } from '../sim/input';
import { drawText, GLYPH_H, textWidth } from '../render/font';

/**
 * 휴대폰 터치 조작 (기획서 '조작과 전투 시스템': 휴대폰 터치로도 같은 조작).
 * 왼쪽 아래 8방향 패드, 오른쪽 아래 버튼 6개 (키보드와 같은 두 줄: 위 스킬 1·스킬 2·필살기, 아래 공격·점프·대시),
 * 위 가운데 일시정지(Ⅱ). 화면 위에 겹친 DOM이고, 터치가 되는 기기에서만 보인다.
 *
 * 공격 버튼 길게 누르기가 잘 되게:
 * - 누른 손가락을 붙잡아(포인터 캡처) 버튼 밖으로 조금 밀려나도 뗀 것으로 치지 않는다. 떼거나 시스템이 끊을 때만 뗀다.
 * - 길게 누를 때 뜨는 브라우저 메뉴·확대경·글자 선택·두 번 눌러 확대를 막는다.
 * - 아주 짧게 톡 친 것도 한 틱은 눌린 것으로 친다 (틱 사이에 눌렀다 뗀 것을 놓치지 않게).
 * - 모으기를 기다리는 동안은 버튼 테가 밝아지고, 모으는 중이면 주황으로 빛난다 (대련 장면이 setCharge로 알려 준다).
 * 패드는 손가락을 떼지 않고 미끄러뜨려 방향을 바꾼다. ↓는 방어라서, 옆으로 갈 때 실수로 ↓가 섞이지 않게
 * 위·아래·좌·우 칸을 넓게(60°), 대각선 칸을 좁게(30°) 나눈다.
 */
class TouchControls {
  private root: HTMLDivElement | null = null;
  private held = 0;
  private latched = 0;
  private pauseTap = false;
  private padBits = 0;
  private readonly owners = new Map<number, number>();
  private attackEl: HTMLElement | null = null;
  private charge = 0;
  private knob: HTMLDivElement | null = null;
  private wanted = false;

  /** 터치가 되는 기기인가 (?touch=1이면 마우스로도 보이게 해서 확인) */
  readonly available =
    typeof window !== 'undefined' &&
    (new URLSearchParams(location.search).get('touch') === '1' || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

  /** 지금 화면에 터치 버튼이 떠 있나 */
  get shown(): boolean {
    return this.available && this.wanted;
  }

  /** 대련 장면은 켜고, 타이틀 같은 메뉴 화면은 끈다 */
  enable(on: boolean): void {
    this.wanted = on;
    if (!this.available) return;
    if (on && !this.root) this.build();
    if (this.root) this.root.style.display = on ? 'block' : 'none';
    if (!on) this.releaseAll();
  }

  /** 틱마다 한 번: 지금 눌린 버튼·방향 + 지난 틱 이후 톡 친 버튼 */
  poll(): PlayerInput {
    const v = this.held | this.padBits | this.latched;
    this.latched = 0;
    return this.wanted ? v : 0;
  }

  /** 일시정지 버튼을 눌렀나 (한 번 읽으면 지운다) */
  takePause(): boolean {
    const p = this.pauseTap;
    this.pauseTap = false;
    return p;
  }

  /** 공격 버튼 빛: 0 없음, 1 길게 누르는 중(모으기 기다림), 2 모으는 중 */
  setCharge(level: number): void {
    if (level === this.charge || !this.attackEl) return;
    this.charge = level;
    this.attackEl.dataset.charge = String(level);
  }

  private releaseAll(): void {
    this.held = 0;
    this.padBits = 0;
    this.owners.clear();
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
    this.root?.querySelectorAll('.on').forEach((e) => e.classList.remove('on'));
  }

  private build(): void {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.className = 'tc';
    // 길게 누를 때 브라우저 메뉴·확대경·글자 선택·두 번 눌러 확대를 막는다
    for (const ev of ['contextmenu', 'selectstart', 'dblclick']) root.addEventListener(ev, (e) => e.preventDefault());
    root.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // ---- 8방향 패드 ----
    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    const knob = document.createElement('div');
    knob.className = 'tc-knob';
    pad.appendChild(knob);
    this.knob = knob;
    let padId = -1;
    const aim = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const R = r.width / 2;
      const d = Math.hypot(dx, dy);
      const k = Math.min(1, d / R);
      knob.style.transform = `translate(calc(-50% + ${(dx / Math.max(d, 1)) * k * R * 0.55}px), calc(-50% + ${(dy / Math.max(d, 1)) * k * R * 0.55}px))`;
      this.padBits = d < R * 0.22 ? 0 : dirBits(Math.atan2(dy, dx));
      pad.dataset.dir = String(this.padBits);
    };
    pad.addEventListener('pointerdown', (e) => {
      if (padId >= 0) return;
      padId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      pad.classList.add('on');
      aim(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === padId) aim(e);
    });
    const padUp = (e: PointerEvent) => {
      if (e.pointerId !== padId) return;
      padId = -1;
      this.padBits = 0;
      pad.dataset.dir = '0';
      pad.classList.remove('on');
      knob.style.transform = 'translate(-50%, -50%)';
    };
    pad.addEventListener('pointerup', padUp);
    pad.addEventListener('pointercancel', padUp);
    pad.addEventListener('lostpointercapture', padUp);
    root.appendChild(pad);

    // ---- 버튼 6개 (키보드와 같은 두 줄) ----
    const grid = document.createElement('div');
    grid.className = 'tc-btns';
    const BUTTONS: Array<[string, number, string]> = [
      ['SKILL 1', IN_SKILL1, 's1'],
      ['SKILL 2', IN_SKILL2, 's2'],
      ['SUPER', IN_SUPER, 'sp'],
      ['ATTACK', IN_ATTACK, 'atk'],
      ['JUMP', IN_JUMP, 'jump'],
      ['DASH', IN_DASH, 'dash'],
    ];
    for (const [label, bit, cls] of BUTTONS) {
      const b = document.createElement('div');
      b.className = `tc-btn tc-${cls}`;
      b.appendChild(labelCanvas(label));
      const down = (e: PointerEvent) => {
        b.setPointerCapture(e.pointerId);
        this.owners.set(e.pointerId, bit);
        this.held |= bit;
        this.latched |= bit;
        b.classList.add('on');
      };
      const up = (e: PointerEvent) => {
        if (this.owners.get(e.pointerId) !== bit) return;
        this.owners.delete(e.pointerId);
        // 같은 버튼을 다른 손가락이 아직 누르고 있으면 그대로
        if (![...this.owners.values()].includes(bit)) {
          this.held &= ~bit;
          b.classList.remove('on');
        }
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      if (bit === IN_ATTACK) this.attackEl = b;
      grid.appendChild(b);
    }
    root.appendChild(grid);

    // ---- 일시정지 ----
    const pause = document.createElement('div');
    pause.className = 'tc-pause';
    pause.appendChild(labelCanvas('II'));
    pause.addEventListener('pointerdown', () => {
      this.pauseTap = true;
    });
    root.appendChild(pause);

    // ---- 세로 화면이면 돌려 달라고 ----
    const rotate = document.createElement('div');
    rotate.className = 'tc-rotate';
    rotate.textContent = '휴대폰을 가로로 돌려 주세요';
    root.appendChild(rotate);

    document.body.appendChild(root);
    this.root = root;
    // 휴대폰: 첫 터치에 전체 화면과 가로 고정을 청한다 (되는 브라우저에서만: 안드로이드 크롬 등)
    const full = () => {
      document.removeEventListener('pointerdown', full);
      const el = document.documentElement as HTMLElement & { requestFullscreen?: (o?: object) => Promise<void> };
      el.requestFullscreen?.({ navigationUI: 'hide' })
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => {});
    };
    document.addEventListener('pointerdown', full);
  }
}

/**
 * 손가락 방향(라디안, 화면 아래가 +y) → 방향 비트. 위·아래·좌·우는 60°, 대각선은 30° 칸
 * (옆으로 가다 실수로 ↓(방어)가 섞이지 않게)
 */
export function dirBits(a: number): PlayerInput {
  const deg = ((a * 180) / Math.PI + 360) % 360;
  // 0° = 오른쪽, 90° = 아래
  const near = (c: number) => Math.min(Math.abs(deg - c), 360 - Math.abs(deg - c)) <= 30;
  if (near(0)) return IN_RIGHT;
  if (near(90)) return IN_DOWN;
  if (near(180)) return IN_LEFT;
  if (near(270)) return IN_UP;
  if (deg < 90) return IN_DOWN | IN_RIGHT;
  if (deg < 180) return IN_DOWN | IN_LEFT;
  if (deg < 270) return IN_UP | IN_LEFT;
  return IN_UP | IN_RIGHT;
}

/** 버튼 글자: 게임과 같은 도트 폰트로 작은 캔버스에 그려 붙인다 (CSS로 정수배 키움) */
function labelCanvas(text: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = textWidth(text) + 2;
  c.height = GLYPH_H + 2;
  const g = c.getContext('2d')!;
  drawText(g, text, 1, 1, '#f4f0e6');
  c.className = 'tc-label';
  c.style.width = `${c.width * 2}px`;
  c.style.height = `${c.height * 2}px`;
  return c;
}

const CSS = `
.tc{position:fixed;inset:0;z-index:5;pointer-events:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.tc>*{pointer-events:auto;touch-action:none}
.tc-label{image-rendering:pixelated;display:block;pointer-events:none}
.tc-pad{position:absolute;left:calc(env(safe-area-inset-left) + 3vw);bottom:calc(env(safe-area-inset-bottom) + 4vh);width:min(38vh,190px);height:min(38vh,190px);border-radius:50%;
  background:radial-gradient(circle,#1a103055 0,#1a1030aa 62%,#5a4c9088 64%,#1a103000 66%)}
.tc-pad.on{background:radial-gradient(circle,#2a1f4466 0,#2a1f44bb 62%,#ffd25e99 64%,#1a103000 66%)}
.tc-knob{position:absolute;left:50%;top:50%;width:38%;height:38%;border-radius:50%;background:#f4f0e633;border:2px solid #f4f0e655;transform:translate(-50%,-50%)}
.tc-btns{position:absolute;right:calc(env(safe-area-inset-right) + 2vw);bottom:calc(env(safe-area-inset-bottom) + 3vh);display:grid;
  grid-template-columns:repeat(3,min(19vh,92px));grid-template-rows:min(11vh,54px) min(19vh,96px);gap:min(2.2vh,11px);align-items:center;justify-items:center}
.tc-btn{width:100%;height:100%;border-radius:50%;background:#1a1030aa;border:2px solid #5a4c90cc;display:flex;align-items:center;justify-content:center}
.tc-s1,.tc-s2,.tc-sp{width:100%;height:100%;border-radius:14px}
.tc-sp{border-color:#b07a26cc}
.tc-atk{width:118%;height:118%;border-color:#ffd25ecc;background:#2a1f44bb}
.tc-btn.on{background:#5a4c90dd;border-color:#f4f0e6}
.tc-atk[data-charge="1"]{border-color:#fff3a8;box-shadow:0 0 0 3px #ffd25e66}
.tc-atk[data-charge="2"]{border-color:#ffe26b;background:#ff8a2acc;box-shadow:0 0 0 4px #ff8a2a99,0 0 18px 6px #ffe26b88}
.tc-pause{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 15vh);transform:translateX(-50%);width:44px;height:32px;border-radius:8px;background:#1a1030aa;border:2px solid #5a4c90cc;display:flex;align-items:center;justify-content:center}
.tc-rotate{display:none;position:absolute;inset:0;background:#07040e;color:#f4f0e6;font:700 18px/1.6 system-ui,sans-serif;align-items:center;justify-content:center;text-align:center;padding:24px}
@media (orientation:portrait){.tc-rotate{display:flex}}
`;

/** 한 앱에 하나 */
export const touch = new TouchControls();
