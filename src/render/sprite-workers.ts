import type { BakedMotion, CellFrame } from '../anim/bake';
import type { SkinId } from '../anim/skins';

/**
 * 캐릭터 그림을 그림 일꾼(웹 워커) 여럿에 나눠 그린다 (불러오기 화면, 렌더 전용).
 * 화면 스레드는 그동안 무대를 만들고, 일꾼이 돌려준 프레임은 동작에 그대로 받아 둔다(adopt).
 * 일꾼을 만들 수 없거나 도중에 오류가 나면 failed가 되고, 남은 것은 불러오기 단계가 화면 스레드에서 그린다.
 */
export class SpriteWorkers {
  private readonly workers: Worker[] = [];
  /** 보낸 일꾼 수 */
  count = 0;
  private readonly byName: Map<string, BakedMotion>;
  private alive = 0;
  failed = false;
  /** 받은 프레임 수 */
  received = 0;
  /** 보낸 시각과 다 받은 시각 (확인용) */
  readonly startedAt = performance.now();
  finishedAt = -1;

  constructor(plan: ReadonlyArray<readonly [BakedMotion, SkinId]>, count = defaultCount()) {
    this.byName = new Map(plan.map(([m]) => [m.name, m]));
    const todo = plan.filter(([m, skin]) => !m.isBaked(skin));
    if (!todo.length || typeof Worker === 'undefined') {
      this.finishedAt = performance.now();
      if (todo.length) this.failed = true;
      return;
    }
    // 일감 나누기: 무거운 동작(프레임 수 × 칸 넓이)부터 가장 덜 받은 일꾼에게
    const n = Math.max(1, Math.min(count, todo.length));
    const load = new Array<number>(n).fill(0);
    const jobs: Array<Array<[string, SkinId]>> = Array.from({ length: n }, () => []);
    const cost = ([m]: readonly [BakedMotion, SkinId]) => m.dur.length * (m.cell ? m.cell.w * m.cell.h : 4096);
    for (const it of [...todo].sort((a, b) => cost(b) - cost(a))) {
      const k = load.indexOf(Math.min(...load));
      jobs[k]!.push([it[0].name, it[1]]);
      load[k]! += cost(it);
    }
    try {
      for (const list of jobs) {
        const w = new Worker(new URL('../anim/bake.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<{ done?: boolean; name?: string; skin?: SkinId; frames?: CellFrame[] }>) => {
          const d = e.data;
          if (d.done) {
            w.terminate();
            if (--this.alive === 0 && this.finishedAt < 0) this.finishedAt = performance.now();
            return;
          }
          const m = this.byName.get(d.name!);
          if (m && d.frames) {
            m.adopt(d.skin!, d.frames);
            this.received += d.frames.length;
          }
        };
        w.onerror = () => this.fail();
        w.onmessageerror = () => this.fail();
        w.postMessage({ jobs: list });
        this.workers.push(w);
        this.alive++;
        this.count++;
      }
    } catch {
      this.fail();
    }
  }

  /** 다 받았나 (실패했으면 true: 남은 것은 화면 스레드가 그린다) */
  get done(): boolean {
    return this.failed || this.alive === 0;
  }

  private fail(): void {
    if (this.failed) return;
    this.failed = true;
    for (const w of this.workers) w.terminate();
    this.alive = 0;
    if (this.finishedAt < 0) this.finishedAt = performance.now();
  }
}

/** 일꾼 수: 화면 스레드 몫 하나를 남기고 넷까지 */
function defaultCount(): number {
  const n = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, n - 1));
}
