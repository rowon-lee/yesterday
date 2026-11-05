import type { TickInput } from '../core/input';
import type { CharId } from '../data/characters';
import { fightScene } from '../scenes/fight';
import { gl } from './gl';
import { loadScreenFx, saveScreenFx, type ScreenFxState } from './screenfx';
import { SCREEN_H, SCREEN_W } from './screen';

/**
 * 이펙트 미리 그려 보기 (불러오기 화면, 렌더 전용): 캐릭터마다 화면 밖에서 짧은 연습 대련을 돌린다.
 * 등장 → 1~4타 → 쓸기 → 띄우기 → 대시 공격 → 공중 1~3타 → 내려찍기 → 차지 → 스킬 1·2 → 필살기(연출까지)를 차례로 써서
 * 이펙트 코드(처음 부를 때 브라우저가 코드를 만드는 몫)·몸 윤곽·궤적 캐시·평면 층을 미리 데운다.
 * 3D 무대는 그리지 않고 (셰이더는 warm.ts가 따로 만든다), 이펙트·HUD 2D 그림은 새 이펙트가 생긴 틱에만 화면 밖 캔버스에 그린다.
 * 상대는 다음 캐릭터 (맞는 쪽 반응·등장도 함께 데운다). 소리는 내지 않는다.
 */
const SCRIPT: ReadonlyArray<readonly [keys: readonly string[], hold: number, wait: number]> = [
  [[], 0, 250],
  // 기술이 상대에 닿게 (맞았을 때의 이펙트까지) 걸어서 다가간다
  [['KeyD'], 30, 20],
  [['KeyJ'], 2, 12],
  [['KeyJ'], 2, 12],
  [['KeyJ'], 2, 14],
  [['KeyJ'], 2, 40],
  [['KeyD'], 30, 10],
  [['KeyS', 'KeyJ'], 3, 40],
  [['KeyW', 'KeyJ'], 3, 50],
  [['KeyL'], 2, 4],
  [['KeyJ'], 2, 50],
  [['KeyK'], 2, 12],
  [['KeyJ'], 2, 10],
  [['KeyJ'], 2, 10],
  [['KeyJ'], 2, 50],
  [['KeyK'], 2, 16],
  [['KeyS', 'KeyJ'], 3, 60],
  [['KeyD'], 20, 10],
  [['KeyJ'], 80, 50],
  [['KeyD'], 20, 10],
  [['KeyU'], 3, 90],
  [['KeyD'], 20, 10],
  [['KeyI'], 3, 90],
  [['KeyD'], 20, 10],
  [['KeyO'], 3, 470],
];
/** 새 이펙트가 없어도 이만큼 틱마다 한 번은 그린다 (평면 층·HUD·먼지) */
const DRAW_AT_LEAST = 60;
const EMPTY: ReadonlySet<string> = new Set();

/** 키 입력 차례를 틱 하나씩 풀어 둔다 */
function inputs(): TickInput[] {
  const out: TickInput[] = [];
  for (const [keys, hold, wait] of SCRIPT) {
    for (let t = 0; t < hold; t++) out.push({ held: new Set(keys), pressed: t === 0 ? new Set(keys) : EMPTY, released: EMPTY });
    out.push({ held: EMPTY, pressed: EMPTY, released: new Set(keys) });
    for (let t = 0; t < wait; t++) out.push({ held: EMPTY, pressed: EMPTY, released: EMPTY });
  }
  return out;
}

export interface Rehearsal {
  /** 모두 몇 틱인가 */
  ticks: number;
  /** deadline(performance.now)까지 돌린다. 다 돌았으면 true */
  run(deadline: number): boolean;
  /** 진행 (0~1) */
  part(): number;
  /** 하던 것을 버리고 처음부터 (그사이 실제 대련이 캐릭터 연출 상태를 지웠을 때) */
  reset(): void;
  readonly done: boolean;
}

/**
 * 캐릭터 c(1P)가 상대 opp와 화면 밖에서 대련을 돌린다. 여러 프레임에 걸쳐 조금씩 (타이틀 화면 뒤에서도) 돌 수 있게,
 * 화면 효과 상태(render/screenfx: 물들이기·배경 누르기·어긋남…)는 돌 때만 연습 대련 것으로 바꿔 끼우고 끝나면 되돌린다
 */
export function rehearsal(c: CharId, opp: CharId): Rehearsal {
  const list = inputs();
  let scene: ReturnType<typeof fightScene> | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  /** 연습 대련 쪽 화면 효과 상태 (돌지 않는 동안 맡아 둔다) */
  let fxState: ScreenFxState | null = null;
  let k = 0;
  let born = 0;
  let drawnAt = 0;
  let finished = false;
  return {
    ticks: list.length,
    get done() {
      return finished;
    },
    reset() {
      scene = null;
      fxState = null;
      k = 0;
      born = 0;
      drawnAt = 0;
      finished = false;
    },
    run(deadline) {
      if (finished) return true;
      const outer = saveScreenFx();
      if (fxState) loadScreenFx(fxState);
      try {
        if (!scene) {
          const params = new URLSearchParams({ scene: 'fight', mode: 'practice', dummy: 'stand', p1char: c, p2char: opp });
          scene = fightScene(undefined, { params, rehearsal: true });
          if (!ctx) {
            const cv = document.createElement('canvas');
            cv.width = SCREEN_W;
            cv.height = SCREEN_H;
            ctx = cv.getContext('2d')!;
          }
        }
        while (k < list.length) {
          scene.tick(list[k]!);
          k++;
          // 새 이펙트가 생긴 틱에만 그린다 (이펙트마다 그리기 코드를 한 번은 지나가게, 같은 그림을 되풀이해 그리지 않게)
          const b = scene.fxBorn();
          if (b > born || k - drawnAt >= DRAW_AT_LEAST) {
            scene.render(ctx!);
            born = b;
            drawnAt = k;
          }
          if (performance.now() > deadline) break;
        }
      } finally {
        fxState = saveScreenFx();
        loadScreenFx(outer);
        // 연습 대련이 바꿔 둔 3D 화면 상태를 되돌린다 (확대, 캐릭터 판: 다음 화면 그리기가 다시 정하지만 남지 않게)
        gl().view.setZoom(1);
        gl().actors.hide();
      }
      if (k >= list.length) {
        scene = null;
        fxState = null;
        finished = true;
      }
      return finished;
    },
    part: () => k / list.length,
  };
}
