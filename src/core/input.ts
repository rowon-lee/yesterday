/**
 * 키보드 입력 수집. 키 배치(어느 키가 어느 버튼인지)는 아직 정하지 않았으므로
 * KeyboardEvent.code 그대로 모은다.
 *
 * 이벤트는 틱 사이 아무 때나 들어오므로, 다음 틱 시작에 한 번 확정해서
 * 그 틱 동안은 바뀌지 않는 스냅샷(TickInput)을 넘긴다.
 * 한 틱 안에 눌렀다 뗀 키도 pressed에 남도록 눌림을 따로 걸어 둔다.
 */
export interface TickInput {
  /** 이번 틱에 눌려 있는 키 */
  readonly held: ReadonlySet<string>;
  /** 지난 틱 이후 새로 눌린 키 */
  readonly pressed: ReadonlySet<string>;
  /** 지난 틱 이후 떼어진 키 */
  readonly released: ReadonlySet<string>;
}

/** 브라우저 기본 동작(스크롤 등)을 막을 키 */
const BLOCKED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Slash', 'Quote',
]);

export class Keyboard {
  private down = new Set<string>();
  private pressedLatch = new Set<string>();
  private releasedLatch = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (e.repeat || this.down.has(e.code)) return;
      this.down.add(e.code);
      this.pressedLatch.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      if (!this.down.delete(e.code)) return;
      this.releasedLatch.add(e.code);
    });
    // 창을 벗어나면 keyup이 오지 않으므로 전부 뗀 것으로 친다.
    target.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  /** 틱 시작마다 한 번 부른다. */
  poll(): TickInput {
    const snap: TickInput = {
      held: new Set(this.down),
      pressed: this.pressedLatch,
      released: this.releasedLatch,
    };
    this.pressedLatch = new Set();
    this.releasedLatch = new Set();
    return snap;
  }

  private releaseAll(): void {
    for (const code of this.down) this.releasedLatch.add(code);
    this.down.clear();
  }
}
