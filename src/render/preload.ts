import type { BakedMotion } from '../anim/bake';
import { MOTIONS } from '../anim/motions';
import { isSkin, type SkinId } from '../anim/skins';
import { audio } from '../audio/engine';
import { BASE_MOTION_SLOTS, type CharId, type MotionSlot } from '../data/characters';
import { CHAR_IDS, isChar, motionOf, movesOf } from '../sim';
import { drawText, textWidth } from './font';
import { gl, glReady, glSteps } from './gl';
import { facadeAtlas } from './gl/buildings';
import { keepAtlas } from './gl/plaza';
import { warmGpu } from './gl/warm';
import { rehearsal, type Rehearsal } from './rehearse';
import { SpriteWorkers } from './sprite-workers';
import { COLORS } from './palette';
import { SCREEN_H, SCREEN_W } from './screen';

/**
 * 불러오기 (시작 화면의 막대): 대련 중에 아무것도 새로 만들지 않도록 미리 다 준비한다 (렌더 전용).
 *   1. 3D 화면과 무대(맵·텍스처)를 부품 하나씩
 *   2. 캐릭터 그림: 대련에 나올 수 있는 동작 × 캐릭터 겉모습을 모두 그린다 (프레임마다 조금씩, 막대가 멈추지 않게)
 *   3. 그림 모음 텍스처를 그래픽 칩에 올린다
 *   4. 셰이더·텍스처·정점 버퍼: 숨은 이펙트·부서진 모습까지 모든 물체를 화면 밖에서 한 번 그린다 (두 품질)
 *   5. 소리: 컨텍스트·믹서·노이즈 버퍼를 만들고 모든 효과음을 소리 없이 한 번씩 짜 둔다
 * 단계마다 weight(PC에서 잰 ms 어림)만큼 막대가 찬다.
 */
export interface LoadStep {
  /** 확인용 이름 (한국어) */
  label: string;
  /** 화면에 쓰는 이름 (게임 글꼴: 영어 대문자) */
  show: string;
  weight: number;
  /** deadline(performance.now)까지 일하고, 끝났으면 true. 한 번에 끝나는 단계는 void */
  run(deadline: number): boolean | void;
  /** 끝나지 않은 단계의 진행 (0~1) */
  part?(): number;
}

/** 대련에서 이 캐릭터가 그려질 수 있는 동작: 동작 칸 전부, 기술, 자기 필살기 연출, 공통 맞는 동작, 누구의 필살기든 맞는 쪽 연출 */
function motionsOf(c: CharId): Set<string> {
  const names = new Set<string>();
  for (const slot of Object.keys(BASE_MOTION_SLOTS) as MotionSlot[]) names.add(motionOf(c, slot));
  for (const mv of Object.values(movesOf(c))) {
    names.add(mv.time.motion);
    const cin = mv.data.cinematic;
    if (cin) for (const sc of [...cin.scenes, ...(cin.short ?? [])]) names.add(sc.a.motion);
  }
  for (const other of CHAR_IDS) {
    for (const mv of Object.values(movesOf(other))) {
      const cin = mv.data.cinematic;
      if (cin) for (const sc of [...cin.scenes, ...(cin.short ?? [])]) names.add(sc.d.motion);
    }
  }
  for (const m of MOTIONS) if (m.name.startsWith('common/')) names.add(m.name);
  return names;
}

const motionByName = new Map(MOTIONS.map((m) => [m.name, m]));

/** 타이틀에서 고를 수 있는 캐릭터 넷 (기본 스틱맨 빼고), 겉모습은 자기 것 */
export const ROSTER_FIGHTERS: ReadonlyArray<readonly [CharId, SkinId]> = CHAR_IDS.filter((c) => c !== 'base').map((c) => [c, isSkin(c) ? c : 'base'] as const);

/** 대련 주소에서 두 사람의 [캐릭터, 겉모습] (scenes/fight.ts가 읽는 것과 같은 규칙) */
export function fightersOf(params: URLSearchParams): Array<readonly [CharId, SkinId]> {
  return (['p1', 'p2'] as const).map((p) => {
    const v = params.get(`${p}char`);
    const c: CharId = isChar(v) ? v : 'base';
    const s = params.get(`${p}skin`);
    return [c, isSkin(s) ? s : isSkin(c) ? c : 'base'] as const;
  });
}

/** 그릴 것: (동작, 겉모습) 목록. fighters = [캐릭터, 겉모습] */
export function motionPlan(fighters: ReadonlyArray<readonly [CharId, SkinId]>): Array<[BakedMotion, SkinId]> {
  const out: Array<[BakedMotion, SkinId]> = [];
  const seen = new Set<string>();
  for (const [c, skin] of fighters) {
    for (const name of motionsOf(c)) {
      const m = motionByName.get(name);
      const key = `${name}|${skin}`;
      if (!m || seen.has(key)) continue;
      seen.add(key);
      out.push([m, skin]);
    }
  }
  return out;
}

/**
 * 캐릭터 그림 (PC에서 한 프레임 약 0.6ms 어림). start()가 그림 일꾼(웹 워커)들에게 나눠 맡기고,
 * 단계 steps[0]은 일꾼이 다 그릴 때까지 기다린다 (그동안 화면 스레드는 앞 단계인 무대를 만든다).
 * 일꾼을 쓸 수 없거나(?workers=0 포함) 실패하면 남은 그림을 화면 스레드에서 한 프레임에 12ms씩 그린다. steps[1]은 그림 모음 올리기
 */
export function spriteJob(plan: ReadonlyArray<readonly [BakedMotion, SkinId]>): { start(): void; workers(): SpriteWorkers | null; steps: LoadStep[] } {
  const total = plan.reduce((n, [m]) => n + m.dur.length, 0);
  let pool: SpriteWorkers | null = null;
  const start = () => {
    if (pool || new URLSearchParams(location.search).get('workers') === '0') return;
    pool = new SpriteWorkers(plan);
    lastSpriteWorkers = pool;
  };
  const bakedFrames = () => plan.reduce((n, [m, skin]) => n + (m.isBaked(skin) ? m.dur.length : 0), 0);
  let k = 0;
  return {
    start,
    workers: () => pool,
    steps: [
      {
        label: '캐릭터 그림',
        show: 'FIGHTERS',
        weight: 300,
        run(deadline) {
          start();
          // 일꾼이 그리는 중이면 기다린다 (막대만 그린다)
          if (pool && !pool.done) return false;
          // 일꾼이 없거나 실패: 남은 것을 화면 스레드에서
          while (k < plan.length) {
            const [m, skin] = plan[k]!;
            if (m.bakeSome(skin, deadline)) k++;
            if (performance.now() > deadline) break;
          }
          return k >= plan.length;
        },
        part: () => bakedFrames() / Math.max(1, total),
      },
      {
        label: '그림 모음 올리기',
        show: 'FIGHTERS',
        weight: 120,
        run() {
          const { actors, view } = gl();
          actors.sprites.placeAll(plan);
          actors.sprites.upload(view.renderer);
        },
      },
    ],
  };
}

/** 마지막으로 보낸 그림 일꾼 (확인용: 일꾼 수, 다 그린 데까지 걸린 시간) */
export let lastSpriteWorkers: SpriteWorkers | null = null;

/** 캐릭터 그림 단계만 (대련 주소로 연 뒤 타이틀에서 다른 캐릭터를 고른 경우) */
export function spriteSteps(plan: ReadonlyArray<readonly [BakedMotion, SkinId]>): LoadStep[] {
  return spriteJob(plan).steps;
}

/**
 * 이펙트 미리 그려 보기: 캐릭터마다 화면 밖 연습 대련 (상대는 다음 캐릭터).
 * 타이틀로 열면 불러오기 막대를 끝낸 뒤 타이틀 화면 뒤에서 한 프레임에 조금씩 이어 하고(step),
 * 다 끝나기 전에 대련을 시작하면 그 두 사람 몫만 짧은 막대로 마저 한다(stepsFor). 고른 캐릭터를 먼저 한다(prefer)
 */
export class Rehearsals {
  private readonly list: Array<{ c: CharId; r: Rehearsal }>;

  constructor(chars: readonly CharId[]) {
    this.list = chars.map((c, i) => ({ c, r: rehearsal(c, chars[(i + 1) % chars.length]!) }));
    current = this;
  }

  get done(): boolean {
    return this.list.every((x) => x.r.done);
  }

  /** 이 캐릭터들을 먼저, 적은 차례대로 (타이틀에서 고른 캐릭터) */
  prefer(...cs: CharId[]): void {
    for (const c of [...cs].reverse()) {
      const i = this.list.findIndex((x) => x.c === c);
      if (i > 0) this.list.unshift(...this.list.splice(i, 1));
    }
  }

  /** 타이틀 뒤에서: deadline까지 남은 것을 차례로 */
  step(deadline: number): void {
    for (const x of this.list) {
      if (x.r.done) continue;
      if (!x.r.run(deadline)) return;
    }
  }

  /** 대련 시작: 이 캐릭터들 중 남은 것을 막대 단계로. 나머지 하던 것은 처음부터 다시 (실제 대련이 캐릭터 연출 상태를 새로 시작하므로) */
  stepsFor(chars: readonly CharId[]): LoadStep[] {
    const want = this.list.filter((x) => chars.includes(x.c) && !x.r.done);
    for (const x of this.list) if (!chars.includes(x.c) && !x.r.done && x.r.part() > 0) x.r.reset();
    return want.map((x) => stepOf(x.c, x.r));
  }

  /** 불러오기 막대 단계로 전부 (대련 주소로 바로 열었을 때) */
  steps(): LoadStep[] {
    return this.list.filter((x) => !x.r.done).map((x) => stepOf(x.c, x.r));
  }

  /** 진행 (0~1, 확인용) */
  get progress(): number {
    const total = this.list.reduce((n, x) => n + x.r.ticks, 0);
    return this.list.reduce((n, x) => n + x.r.part() * x.r.ticks, 0) / Math.max(1, total);
  }
}

let current: Rehearsals | null = null;
/** 타이틀에서 캐릭터를 고르면 그 캐릭터부터 미리 그려 본다 (대련을 시작할 때 기다릴 몫이 줄게) */
export function preferRehearsal(...cs: CharId[]): void {
  current?.prefer(...cs);
}

/** PC에서 한 틱 약 0.3ms 어림 */
const stepOf = (c: CharId, r: Rehearsal): LoadStep => ({
  label: `이펙트 미리 그려 보기: ${c}`,
  show: 'EFFECTS',
  weight: r.ticks * 0.3 * (1 - r.part()),
  run: (d: number) => r.run(d),
  part: () => r.part(),
});

/**
 * 처음 열 때 전체 단계: 그림 일꾼 보내기 → 3D 화면·무대 → 캐릭터 그림(일꾼 기다리기) → 셰이더 → 소리 → (rehearse가 있으면) 이펙트 미리 그려 보기.
 * 타이틀로 열 때는 rehearse를 넘기지 않는다 (main.ts가 타이틀 뒤에서 이어 한다)
 */
export function bootSteps(overlay: HTMLCanvasElement, plan: ReadonlyArray<readonly [BakedMotion, SkinId]>, rehearse: Rehearsals | null): LoadStep[] {
  const steps: LoadStep[] = [];
  const sprites = spriteJob(plan);
  // 그림 일꾼을 맨 먼저 보낸다: 화면 스레드가 무대를 만드는 동안 캐릭터 그림을 함께 그린다
  steps.push({ label: '그림 일꾼 보내기', show: 'STAGE', weight: 5, run: () => sprites.start() });
  if (!glReady()) {
    for (const s of glSteps(overlay)) steps.push({ label: s.label, show: 'STAGE', weight: s.weight, run: () => s.run() });
  }
  steps.push({
    label: '무너질 때 떨어지는 건물 조각 그림',
    show: 'STAGE',
    weight: 60,
    // 건물·시타델이 무너질 때 정면 그림에서 조각을 잘라 떨어뜨린다: 그 모음 그림을 미리 만들고 평면 층에 한 번 옮겨 둔다
    run: () => gl().actors.warmFlats([facadeAtlas(), keepAtlas()]),
  });
  steps.push(...sprites.steps);
  steps.push({ label: '셰이더·텍스처 미리 만들기', show: 'SHADERS', weight: 600, run: () => warmGpu() });
  steps.push({ label: '소리 미리 풀기', show: 'SOUND', weight: 60, run: () => audio.prepare() });
  if (rehearse) steps.push(...rehearse.steps());
  return steps;
}

/** 막대를 채우며 단계를 차례로 돈다. 화면 프레임마다 step()을 부르고 draw()로 그린다 */
export class Loader {
  private i = 0;
  private readonly total: number;
  private doneWeight = 0;
  /** 단계마다 걸린 시간 (ms, 확인용) */
  readonly times: Array<[string, number]> = [];
  private stepStart = -1;
  readonly startedAt = performance.now();
  finishedAt = -1;

  constructor(private readonly steps: LoadStep[]) {
    this.total = steps.reduce((n, s) => n + s.weight, 0) || 1;
  }

  get done(): boolean {
    return this.i >= this.steps.length;
  }

  /** 0~1 */
  get progress(): number {
    const s = this.steps[this.i];
    const part = s?.part ? s.part() * s.weight : 0;
    return Math.min(1, (this.doneWeight + part) / this.total);
  }

  get label(): string {
    return this.steps[this.i]?.label ?? '끝';
  }

  /**
   * budget ms 동안 단계를 진행한다. 한 번에 끝나는 무거운 단계는 프레임마다 하나만 (막대를 먼저 그리도록 다음 프레임으로 넘긴다)
   */
  step(budget: number): void {
    const deadline = performance.now() + budget;
    while (this.i < this.steps.length) {
      const s = this.steps[this.i]!;
      if (this.stepStart < 0) this.stepStart = performance.now();
      const r = s.run(deadline);
      if (r === false) break;
      this.times.push([s.label, Math.round(performance.now() - this.stepStart)]);
      this.stepStart = -1;
      this.doneWeight += s.weight;
      this.i++;
      if (!s.part || performance.now() > deadline) break;
    }
    if (this.done && this.finishedAt < 0) this.finishedAt = performance.now();
  }

  /** 불러오기 화면: 밤 바탕, 제목, 막대, 지금 하는 일 */
  draw(ctx: CanvasRenderingContext2D, frame: number): void {
    ctx.fillStyle = COLORS.night;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const title = 'YESTERDAY';
    drawText(ctx, title, Math.round((SCREEN_W - textWidth(title, 2)) / 2), 62, COLORS.white, 2);
    const W = 160;
    const x = Math.round((SCREEN_W - W) / 2);
    const y = 92;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x - 2, y - 2, W + 4, 8);
    ctx.fillStyle = COLORS.suitDark;
    ctx.fillRect(x - 1, y - 1, W + 2, 6);
    const fill = Math.round(W * this.progress);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x, y, fill, 4);
    ctx.fillStyle = COLORS.goldLight;
    ctx.fillRect(x, y, fill, 1);
    // 막대 끝에서 깜빡이는 한 칸 (멈춰 보이지 않게)
    if (fill < W && frame % 30 < 15) {
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(x + fill, y, 1, 4);
    }
    const s = this.steps[Math.min(this.i, this.steps.length - 1)];
    const text = `LOADING ${s?.show ?? ''}`.trim();
    drawText(ctx, text, Math.round((SCREEN_W - textWidth(text)) / 2), y + 10, COLORS.paleGrey);
  }
}
