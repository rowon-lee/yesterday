import type { SkinId } from '../../anim/skins';
import type { CharId } from '../../data/characters';
import type { MoveId } from '../../data/moves/base';
import type { Fighter, SimEvent, SimState } from '../../sim';
import type { Debris } from '../debris';
import type { ColorName } from '../palette';
import type { Effects } from '../effects';
import type { VfxLayer } from '../vfx';
import { EDWARD_RENDER } from './edward';
import { EUNWOO_RENDER } from './eunwoo';
import { OSCAR_RENDER } from './oscar';

/**
 * 캐릭터 고유 연출을 그리는 데 쓰는 도구 (fightvfx가 넘긴다). 좌표: 이펙트 층(layer)은 2단위 = 1px (FX_PX),
 * glow·debris는 월드 px (y는 GROUND 기준 화면 좌표, feet()가 돌려주는 값 / FX_PX).
 */
export interface CharFx {
  layer: VfxLayer;
  fx: Effects;
  debris: Debris;
  /** 이펙트마다 새 시드 */
  seed(): number;
  /** 잠깐 비추는 실제 광원 (월드 px, 반지름 px, 색 '#rrggbb', 세기 0~1, 틱) */
  glow(x: number, y: number, r: number, color: string, a: number, ticks: number): void;
  /** 발밑 자리 (이펙트 층 2단위) */
  feet(f: Fighter): [number, number];
  /** 이 사람의 겉모습 */
  skinOf(f: Fighter): SkinId;
  /** 정해진 동작·프레임을 월드 자리(wx, wy: 발밑 px)에 놓은 실루엣 (순간이동 잔상용, vfx/dash-blink의 actor.silhouette) */
  silhouetteAt(motion: string, frame: number, facing: number, skin: SkinId, wx: number, wy: number): { x: number; y: number; w: number; h: number; data: Uint32Array };
  /** 지금 모습의 실루엣 (월드 px 자리와 칸 크기, 픽셀 0xAABBGGRR): 장막·잔상처럼 몸 윤곽을 따라가는 이펙트용 */
  silhouette(f: Fighter): { x: number; y: number; w: number; h: number; data: Uint32Array };
}

/** HUD에서 그 사람 칸의 자리: 체력바 왼쪽 x·폭(체력바는 y 8~13, 방어 띠 15~16, 이름 y 19), 왼쪽 사람인가, 이름 끝 x */
export interface HudSlot {
  x: number;
  w: number;
  left: boolean;
  /** 이름 글자 바깥쪽 끝 (왼쪽 사람은 이름 오른쪽 끝, 오른쪽 사람은 이름 왼쪽 끝) */
  nameEdge: number;
}

/** 캐릭터 고유 연출 (렌더 전용, sim 상태를 읽기만 한다) */
export interface CharRender {
  /** 대표 색 이펙트 계단 (흰 → 밝은 → 대표 → 어두운 …): 대시 잔상·차지 오라·기력 3칸 오라·타격 불꽃 색. 없으면 플레이어 색 */
  ramp?: readonly ColorName[];
  /** 대표 빛 색 ('#rrggbb'): 차지·기력·타격 때 무대를 비추는 빛 */
  light?: string;
  /** 맞힌 자리 불꽃을 스스로 그린다 (공통 Impact 불꽃·필살기 끝 폭발을 쓰지 않는다. 빛은 그대로) */
  ownSpark?: boolean;
  /** 등장 연출을 스스로 그린다 (기본 '위에서 내려선 자리 충격·먼지'를 쓰지 않는다) */
  ownIntro?: boolean;
  /** 차지를 모으는 동안의 몸 둘레 오라를 스스로 그린다 (기본 Power Up 오라를 쓰지 않는다. 단계 반짝임·빛은 그대로) */
  ownChargeAura?: boolean;
  /** 지상 대시를 스스로 그린다 (기본 Dash 잔상·먼지를 쓰지 않는다. 공중 대시는 그대로) */
  ownDash?: boolean;
  /** 등장 중 그림을 숨기는가 (렌더 전용) */
  introHidden?(f: Fighter): boolean;
  /** 등장 중 땅 위로 띄워 그리는 높이 (px, 렌더 전용). undefined면 0 */
  introLift?(f: Fighter): number | undefined;
  /** 공격이 새로 시작한 틱 (연타로 이어져도 타마다) */
  attackStart?(c: CharFx, s: SimState, f: Fighter, i: number, id: MoveId): void;
  /** 공격 판정이 시작하는 틱: 궤적 이펙트 (동작연출지침서 5장·7장). 없으면 기본 궤적 띠 */
  strike?(c: CharFx, s: SimState, f: Fighter, i: number, id: MoveId): void;
  /** 틱마다 (특성·스킬 지속 이펙트, 필살기 연출 장면) */
  tick?(c: CharFx, s: SimState, f: Fighter, i: number): void;
  /** 이번 틱 sim 사건 하나 (i = 이 캐릭터인 사람 번호. e.who가 누구인지는 스스로 본다) */
  event?(c: CharFx, s: SimState, e: SimEvent, i: number): void;
  /** 무대 빛 (lights.point 등) */
  lights?(s: SimState, f: Fighter, i: number): void;
  /** 이 틱에 몸을 감추는가 (등장 연출 등). scenes/fight.ts가 캐릭터 판을 그리지 않는다 */
  hidden?(s: SimState, f: Fighter, i: number): boolean;
  /**
   * 3D 화면 위 2D 화면(480×270)에 겹쳐 그린다 (필살기 연출의 화면 전체 흰색처럼 무대 앞 물건까지 덮어야 할 때).
   * cam: 화면 왼쪽 위의 월드 좌표 (px). 연출 중 위아래 검은 띠보다 아래, HUD보다 아래에 그린다
   */
  overlay?(ctx: CanvasRenderingContext2D, s: SimState, f: Fighter, i: number, cam: { x: number; y: number }): void;
  /** HUD: 특성 표시 (껍데기 게이지·낙인·검영 수…) */
  hud?(ctx: CanvasRenderingContext2D, s: SimState, f: Fighter, i: number, slot: HudSlot): void;
}

const NONE: CharRender = {};
let table: Partial<Record<CharId, CharRender>> | null = null;
/** 이 캐릭터의 고유 연출 (없으면 빈 것) */
export function rendersOf(c: CharId): CharRender {
  const t = (table ??= { eunwoo: EUNWOO_RENDER, edward: EDWARD_RENDER, oscar: OSCAR_RENDER });
  return t[c] ?? NONE;
}
