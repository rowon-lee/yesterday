import type { TickInput } from '../core/input';
import type { CharId } from '../data/characters';
import { fightScene } from '../scenes/fight';
import { gl } from './gl';
import { clearScreenFx } from './screenfx';
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
  [['KeyJ'], 2, 12],
  [['KeyJ'], 2, 12],
  [['KeyJ'], 2, 14],
  [['KeyJ'], 2, 40],
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
  [['KeyJ'], 80, 50],
  [['KeyU'], 3, 90],
  [['KeyI'], 3, 90],
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

/** 캐릭터 c(1P)가 상대 opp와 화면 밖에서 대련을 돌리는 불러오기 단계 하나. 다 돌았으면 true */
export function rehearsal(c: CharId, opp: CharId): { ticks: number; run(deadline: number): boolean; part(): number } {
  const list = inputs();
  let scene: ReturnType<typeof fightScene> | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let k = 0;
  let born = 0;
  let drawnAt = 0;
  return {
    ticks: list.length,
    run(deadline) {
      if (!scene) {
        const params = new URLSearchParams({ scene: 'fight', mode: 'practice', dummy: 'stand', p1char: c, p2char: opp });
        scene = fightScene(undefined, { params, rehearsal: true });
        const cv = document.createElement('canvas');
        cv.width = SCREEN_W;
        cv.height = SCREEN_H;
        ctx = cv.getContext('2d')!;
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
      if (k >= list.length) {
        // 연습 대련이 바꿔 둔 화면 상태를 되돌린다 (확대, 캐릭터 판, 화면 효과)
        gl().view.setZoom(1);
        gl().actors.hide();
        clearScreenFx();
        scene = null;
        return true;
      }
      return false;
    },
    part: () => k / list.length,
  };
}
