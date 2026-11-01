import { FOOT_X, FOOT_Y } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import { BREAKABLES, GRIDS, fighterPose, MOVES, movesOf, RULES, statsOf, tramRestX, type Fighter, type SimState } from '../sim';
import { CITADEL as D } from '../data/stages/citadel';
import { KNOCKDOWN_RELAND } from '../data/poses/common';
import type { SkinId } from '../anim/skins';
import { Debris } from './debris';
import dashBlink from '../vfx/dash-blink';
import explosion from '../vfx/explosion';
import glint from '../vfx/glint';
import impact from '../vfx/impact';
import lightning from '../vfx/lightning';
import powerUp from '../vfx/power-up';
import slash from '../vfx/slash';
import type { Effects } from './effects';
import type { ColorName } from './palette';
import { BREAK_RULES, GROUND as GROUND_Y } from '../stage/citadel';
import { facadeAtlas } from './gl/buildings';
import { keepAtlas } from './gl/plaza';
import { fxColor, fxHex, fxRamp, FX_PX, type VfxLayer } from './vfx';
import { lights } from './light';
import { COLORS } from './palette';

/**
 * 전투 이벤트 → Sprite Fusion 이펙트 (렌더 전용, 게임 기획서 '이펙트 배치' 표대로).
 * - 평타 타격: Impact (불꽃·파편)
 * - 발차기·쓸기처럼 휘두르는 공격: Slash (휘두른 궤적). 기본 스틱맨은 베는 무기가 없어 발차기 궤적으로 쓴다
 * - 대시·공중 대시: Dash & Blink (잔상, 박차는 먼지)
 * - 기력 3칸이 찬 동안: Power Up (몸 윤곽을 따라 도는 오라)
 * - 필살 적중·가드 크러시·KO: Explosion
 * - 큰 물건이 크게 무너질 때: Explosion·먼지·화면 흔들림 (부서지는 순간, 그리고 쓰러져 땅·지붕에 닿는 순간)
 * 맞은 쪽 하얀 번쩍임과 히트스톱 중 떨림도 여기서 정한다.
 */

/** 플레이어별 이펙트 색 (밝은 → 어두운): 1P 금빛, 2P 하늘빛 */
const SIDE_RAMP: Record<0 | 1, ColorName[]> = {
  0: ['fxWhite', 'goldLight', 'fxYellow', 'gold', 'fxOrange', 'goldDark', 'fxRed'],
  1: ['fxWhite', 'skyLight', 'sky', 'fxBlue', 'skyDark', 'fxDeepBlue', 'fxNavy'],
};
/** 라이덴 (캐릭터 기획서: 붉은 전격, 검붉은 잔상): 대시 잔상 등 플레이어 색 대신 쓴다 */
const RAIDEN_RAMP: ColorName[] = ['fxWhite', 'raidenLight', 'raiden', 'fxRed', 'raidenDark', 'raidenDeep'];
/** 이 사람의 이펙트 색: 캐릭터 대표 색이 있으면 그것, 없으면 플레이어 색 */
const rampOf = (f: Fighter, side: 0 | 1): ColorName[] => (f.char === 'raiden' ? RAIDEN_RAMP : SIDE_RAMP[side]);
/**
 * 라이덴 등장 번개: 등장 동작의 몇 틱째에, 제자리에서 바라보는 쪽으로 몇 px 떨어진 곳에 내리꽂힌다.
 * 라이덴은 제자리보다 14px 뒤에 섰다가 걸어 나오므로 그 양옆(-26, -2)에 먼저, 마지막 하나는 걸어 나온 뒤 등 뒤(-20)에
 */
const RAIDEN_INTRO_BOLTS = [{ t: 1, dx: -26 }, { t: 6, dx: -2 }, { t: 12, dx: -15 }, { t: 30, dx: -24 }];
/** 라이덴 등장 걸음: 발을 디디는 틱(등장 동작 4번째·7번째 프레임이 시작하는 틱)과 그 발 자리 */
const RAIDEN_INTRO_STEPS = [{ t: 19, dx: -2 }, { t: 34, dx: 8 }];
/** 타격 불꽃 (뜨거운 색) */
const WARM: ColorName[] = ['fxWhite', 'goldLight', 'fxYellow', 'fxOrange', 'fxFlame', 'fxRed'];
/** 차지를 모으는 동안 몸 둘레 오라와 빛 (기본 스틱맨은 흰 주황. 캐릭터를 얹으면 대표 색) */
const CHARGE_RAMP: ColorName[] = ['fxWhite', 'goldLight', 'fxYellow', 'fxOrange', 'fxFlame', 'goldDark', 'fxRed'];
/** 막혔을 때 (차가운 색) */
const COOL: ColorName[] = ['fxWhite', 'skyLight', 'sky', 'fxBlue', 'fxDeepBlue', 'fxNavy'];
/** 휘두른 궤적 */
const STEEL: ColorName[] = ['fxWhite', 'white', 'skyLight', 'sky', 'fxBlue', 'fxDeepBlue', 'fxNavy'];

/** 휘두르는 공격: 판정이 나오는 틱에 궤적을 그린다 */
const SWINGS: Partial<Record<string, { size: number; squash: number; tilt: number; dy: number; from?: number; to?: number }>> = {
  atk3: { size: 0.32, squash: 0.75, tilt: -0.2, dy: -26 },
  air3: { size: 0.32, squash: 0.7, tilt: 0.1, dy: -18 },
  sweep: { size: 0.36, squash: 0.3, tilt: 0, dy: -4, from: -2.9, to: 0.3 },
  slam: { size: 0.3, squash: 0.8, tilt: 1.2, dy: -20 },
};

/**
 * 필살기 연출 장면의 타격 시각 (렌더 전용 데이터): 발동자 동작 이름 → 그 장면 안 틱마다 타격 종류.
 * 기본 스틱맨 임시 필살기: 난타(주먹이 뻗는 프레임마다) → 어퍼(올려친 순간) → 내려찍기(내리친 순간, 바닥에 꽂힌 순간)
 */
interface CineCue {
  t: number;
  kind: 'jab' | 'upper' | 'hammer' | 'slam';
}
const CINE_CUES: Record<string, CineCue[]> = {
  'base/super_rush': [3, 9, 15, 21, 27, 33].map((t) => ({ t, kind: 'jab' as const })),
  'base/super_rise': [{ t: 14, kind: 'upper' }],
  'base/super_slam': [{ t: 13, kind: 'hammer' }, { t: 26, kind: 'slam' }],
};

/** 맞은 쪽 하얀 번쩍임: 맞은 순간부터 이 틱 동안 하얗게 (센 타격은 한 번 더 깜빡) */
const FLASH_LIGHT = 3;
/** 낙법 가능 깜빡임 틱 */
const TECH_BLINK = 3;
/** 다운에서 다시 바닥에 닿는 틱 (6번 프레임이 시작하는 틱) */
const KD_RELAND_T = (() => {
  const m = MOTIONS.find((x) => x.name === 'common/knockdown')!;
  return m.dur.slice(0, KNOCKDOWN_RELAND).reduce((a, b) => a + b, 0);
})();
const FLASH_HEAVY = 4;

const motionByName = new Map(MOTIONS.map((m) => [m.name, m]));
/** 차지를 모으는 동안 허리에 당긴 주먹 자리 (발밑 기준, 오른쪽 보는 기준): 되풀이하는 첫 프레임의 앞주먹 */
const CHARGE_FIST = (() => {
  const c = MOVES.charge.data.charge!;
  return MOVES.charge.frames.joints[c.windup].hF;
})();
const silCanvas = document.createElement('canvas');
silCanvas.width = 64;
silCanvas.height = 64;
const silCache = new Map<string, Uint32Array>();

/** 지금 모습의 실루엣 (Power Up 오라·대시 잔상이 몸 윤곽을 따라가도록). 이펙트 픽셀 좌표 */
function silhouette(f: Fighter, skin: SkinId = 'base') {
  const p = fighterPose(f);
  const key = `${skin}/${p.motion}/${p.frame}/${f.facing}`;
  let data = silCache.get(key);
  if (!data) {
    const g = silCanvas.getContext('2d', { willReadFrequently: true })!;
    g.clearRect(0, 0, 64, 64);
    motionByName.get(p.motion)!.draw(g, p.frame, 0, 0, { look: 'p1', flip: f.facing < 0, skin });
    data = new Uint32Array(g.getImageData(0, 0, 64, 64).data.buffer.slice(0));
    silCache.set(key, data);
  }
  return { x: Math.round(f.x / 256) - FOOT_X, y: Math.round(GROUND_Y + f.y / 256) - FOOT_Y, w: 64, h: 64, data };
}

const feet = (f: Fighter): [number, number] => [(f.x / 256) * FX_PX, (GROUND_Y + f.y / 256) * FX_PX];

export class FightVfx {
  /** 맞은 뒤 지난 틱 (번쩍임용), 센 타격이었는지 */
  private since = [99, 99];
  private heavy = [false, false];
  /** 낙법이 가능해진 순간 한 번 하얗게 깜빡임 (공통 동작 사양서 '공중에서 맞음', 렌더 전용): 남은 틱, 지난 틱에 가능했나 */
  private blink = [0, 0];
  private techReady = [false, false];
  private prevMeter = [0, 0];
  private prevMode = ['idle', 'idle'];
  private prevMoveT = [-1, -1];
  private seed = 1;

  /** 두 사람의 캐릭터 겉모습 (실루엣을 따라가는 이펙트용, 대련 장면이 정한다) */
  skins: [SkinId, SkinId] = ['base', 'base'];
  private skinOf(f: Fighter): SkinId {
    return f === this.fighters?.[1] ? this.skins[1] : this.skins[0];
  }
  private fighters: readonly Fighter[] | null = null;

  /** 부서질 때 튀는 조각 */
  readonly debris = new Debris();
  private round = 0;
  /** 이펙트가 내는 빛 (월드 좌표): 타격 불꽃, 폭발, 필살, 네온 불꽃. 틱마다 줄어든다 */
  private glows: Array<{ x: number; y: number; r: number; color: string; a: number; life: number; t: number }> = [];

  private glow(x: number, y: number, r: number, color: string, a: number, life: number): void {
    this.glows.push({ x, y, r, color, a, life, t: 0 });
  }

  /**
   * 이번 프레임의 빛 목록에 이펙트 빛을 더한다 (drawStage 뒤, drawLights 앞에 부른다).
   * 기력 3칸이 찬 동안은 몸 둘레에 오라 빛, 필살 컷인 동안은 쓴 사람에게서 큰 빛.
   */
  emitLights(s: SimState): void {
    for (const g of this.glows) {
      const k = 1 - g.t / g.life;
      lights.point(g.x, g.y, g.r * (0.7 + 0.3 * k), g.color, g.a * k * k);
    }
    s.fighters.forEach((f, i) => {
      if (f.meter >= RULES.METER_MAX) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 26, 54, f.char === 'raiden' ? COLORS.raiden : i === 0 ? COLORS.gold : COLORS.sky, 0.45);
      // 차지를 모으는 동안: 캐릭터가 광원이 되어 바닥과 벽을 비춘다 (단계마다 한 계단씩 넓고 밝게. 반짝임은 단계가 오를 때 한 번)
      if (f.mode === 'charge') {
        const lv = Math.max(1, f.chargeLv);
        lights.point(f.x / 256, GROUND_Y + f.y / 256 - 24, 34 + 16 * lv, lv >= 3 ? COLORS.fxYellow : COLORS.fxOrange, 0.3 + 0.15 * lv);
      }
    });
    if (s.freeze > 0) {
      const who = s.events.find((e) => e.type === 'cutin')?.who ?? this.lastCutin;
      const f = s.fighters[who];
      if (f) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 26, 150, who === 0 ? COLORS.goldLight : COLORS.skyLight, 0.8);
    }
  }

  private lastCutin = 0;
  /** 나중 틱에 낼 연출 (큰 물건이 쓰러져 땅에 닿는 순간 등). at은 sim 틱 */
  private later: Array<{ at: number; run: () => void }> = [];
  private now = 0;

  constructor(private layer: VfxLayer, private fx: Effects) {}

  /** 새 경기: 남은 이펙트를 지운다 */
  reset(s: SimState): void {
    this.layer.clear();
    this.debris.clear();
    this.later = [];
    this.round = s.round;
    this.since = [99, 99];
    this.blink = [0, 0];
    this.techReady = [false, false];
    this.prevMeter = s.fighters.map((f) => f.meter);
    this.prevMode = s.fighters.map((f) => f.mode);
  }

  /** sim 한 틱 뒤에 부른다 */
  tick(s: SimState): void {
    this.fighters = s.fighters;
    const shake = (k: number) => (t: number) => this.fx.shake(t * k);
    // 필살기 연출 장면의 타격 (렌더 전용): 발동자 동작마다 정해 둔 틱에 불꽃·빛·흔들림 (피해는 끝 타격에서 한 번)
    if (s.cine) {
      const c = s.cine;
      const motion = MOVES[c.move].data.cinematic!.scenes[c.scene].a.motion;
      for (const cue of CINE_CUES[motion] ?? []) if (cue.t === c.t) this.cineCue(s, cue.kind);
    }
    for (const g of this.glows) g.t++;
    this.glows = this.glows.filter((g) => g.t < g.life);
    this.now = s.tick;
    if (this.later.length) {
      const due = this.later.filter((l) => l.at <= s.tick);
      this.later = this.later.filter((l) => l.at > s.tick);
      for (const l of due) l.run();
    }
    for (const e of s.events) {
      const x = (e.x / 256) * FX_PX;
      const y = (GROUND_Y + e.y / 256) * FX_PX;
      const wx = e.x / 256;
      const wy = GROUND_Y + e.y / 256;
      if (e.type === 'hit') this.glow(wx, wy, e.heavy ? 90 : 56, e.move === 'super' ? COLORS.fxWhite : COLORS.fxOrange, e.heavy ? 1 : 0.8, e.heavy ? 18 : 10);
      else if (e.type === 'block') this.glow(wx, wy, 44, COLORS.fxBlue, 0.7, 10);
      else if (e.type === 'crush') this.glow(wx, wy, 90, COLORS.fxYellow, 1, 20);
      else if (e.type === 'ko') this.glow(wx, wy, 130, COLORS.fxOrange, 1, 40);
      else if (e.type === 'wallsplat') this.glow(wx, wy, 80, COLORS.fxOrange, 0.9, 16);
      else if (e.type === 'charge') this.charge(s, e.who, e.text ?? '', e.combo ?? 1);
      else if (e.type === 'cutin') {
        this.lastCutin = e.who;
        this.glow(wx, wy - 26, 200, e.who === 0 ? COLORS.goldLight : COLORS.skyLight, 1, 50);
      }
      const att = s.fighters[e.who];
      const def = s.fighters[1 - e.who];
      const angle = att && att.facing > 0 ? 0 : Math.PI;
      if (e.type === 'hit') {
        const stop = e.move ? MOVES[e.move].data.hitstop : 7;
        const size = e.heavy ? 0.7 : stop >= 9 ? 0.55 : 0.42;
        // 라이덴의 타격은 붉은 전격이 튄다 (캐릭터 기획서 '평타')
        this.layer.add(impact({ kind: 'hit', x, y, angle, size, ramp: fxRamp(att?.char === 'raiden' ? RAIDEN_RAMP : WARM), seed: this.seed++ }));
        this.since[1 - e.who] = 0;
        this.heavy[1 - e.who] = !!e.heavy;
        if (e.move === 'super') {
          this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.5, surface: fxColor('street'), seed: this.seed++, shake: shake(0.3) }));
        }
      } else if (e.type === 'kongo' && att) {
        // 라이덴 금강불괴 발동: 몸에서 붉은 빛이 한 번 크게 반짝이고 둘레를 비춘다
        const [fx, fy] = feet(att);
        this.layer.add(glint({ x: fx, y: fy - 26 * FX_PX, size: 1.2, ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark', 'raidenDeep']) }));
        this.glow(fx / FX_PX, fy / FX_PX - 26, 110, COLORS.raidenLight, 0.9, 24);
      } else if (e.type === 'block') {
        this.layer.add(impact({ kind: 'hit', x, y, angle, size: 0.32, ramp: fxRamp(COOL), seed: this.seed++ }));
      } else if (e.type === 'crush') {
        this.layer.add(impact({ kind: 'hit', x, y, angle, size: 0.8, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.3, surface: fxColor('street'), seed: this.seed++, fire: 0.1 }));
        // 가드 크러시 (공통 동작 사양서): 방어막이 깨지는 파편이 양쪽으로 튀고 화면이 짧게 흔들린다
        this.debris.burst('glass', wx, wy, 1, 6);
        this.debris.burst('glass', wx, wy, -1, 6);
        this.fx.shake(0.35);
        this.since[1 - e.who] = 0;
        this.heavy[1 - e.who] = true;
      } else if (e.type === 'prop') {
        if (BREAKABLES[e.who].big) this.bigProp(e.who, e.text === 'broken', wx, wy, s.props[e.who].dir, s.props[e.who].at);
        else this.prop(e.who, e.text === 'broken', !!e.heavy, s.props[e.who].dir);
      } else if (e.type === 'city') {
        // 깎인 벽에서 벽돌 조각이 튄다
        const n = Math.min(12, 3 + (e.combo ?? 1) * 2);
        this.debris.burst('brick', e.x / 256, GROUND_Y + e.y / 256, e.x > (att?.x ?? 0) ? 1 : -1, n);
      } else if (e.type === 'collapse') {
        // 건물이 무너짐: 위 덩어리가 잔해로 떨어지고 큰 먼지 구름, 화면 흔들림
        const g = GRIDS[e.who];
        const [c0, c1] = (e.text ?? '0,0').split(',').map(Number);
        this.debris.collapse(g.x + c0 * 16, Math.min(g.x + g.w, g.x + (c1 + 1) * 16), g.h, facadeAtlas());
        // 넓게 무너질수록 크게 흔들린다 (기둥 한 줄 0.45 ~ 여섯 줄 이상 0.85)
        this.fx.shake(Math.min(0.85, 0.35 + (e.combo ?? 16) / 16 * 0.08));
        if ((e.combo ?? 0) >= 48) this.fx.flashFor(1);
      } else if (e.type === 'wallsplat') {
        // 벽꽝: 정면에 박히는 큰 충격
        this.layer.add(impact({ kind: 'hit', x, y, angle: -Math.PI / 2, size: 0.9, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('brick', e.x / 256, GROUND_Y + e.y / 256, 1, 10);
        this.debris.burst('brick', e.x / 256, GROUND_Y + e.y / 256, -1, 10);
        this.debris.dustCloud(e.x / 256 - 16, e.x / 256 + 16, 0.6);
        this.fx.shake(0.5);
      } else if (e.type === 'ko') {
        this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.45, surface: fxColor('street'), seed: this.seed++, shake: shake(0.2) }));
      } else if (e.type === 'wallrun') {
        // 벽을 딛는 첫 발 (먼지와 부스러기), 꼭대기 모서리를 넘을 때 (작은 먼지)
        const f = s.fighters[e.who];
        const out = f ? f.wallSide : 1;
        if (e.text === 'start') {
          this.layer.add(impact({ kind: 'hit', x, y: y - 10 * FX_PX, angle: out > 0 ? 0 : Math.PI, size: 0.25, ramp: fxRamp(COOL), seed: this.seed++ }));
          this.debris.dustCloud(wx - 4, wx + 4, 0.4, wy);
        } else this.debris.dustCloud(wx - 6, wx + 6, 0.3, wy);
        this.debris.burst('brick', wx, wy - 6, out, 3);
      } else if (e.type === 'walljump') {
        // 두 발로 벽을 차는 자리: 벽에서 튀는 먼지와 부스러기
        const f = s.fighters[e.who];
        const out = f ? f.facing : 1;
        this.layer.add(impact({ kind: 'hit', x, y, angle: out > 0 ? 0 : Math.PI, size: 0.3, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('brick', wx, wy, out, 4);
        this.debris.dustCloud(wx - 3, wx + 3, 0.35, wy + 6);
      } else if (e.type === 'round' && s.round === 1) {
        // 등장: 두 사람이 위에서 내려선 자리에 충격과 먼지, 바닥 부스러기, 가벼운 흔들림
        for (const f of s.fighters) {
          const fx = f.x / 256;
          const [px, py] = feet(f);
          this.layer.add(impact({ kind: 'hit', x: px, y: py, angle: -Math.PI / 2, size: 0.3, ramp: fxRamp(COOL), seed: this.seed++ }));
          this.debris.dustCloud(fx - 14, fx + 14, 0.4);
          this.debris.burst('brick', fx, GROUND_Y - 2, 1, 3);
          this.debris.burst('brick', fx, GROUND_Y - 2, -1, 3);
        }
        this.fx.shake(0.25);
      } else if (e.type === 'citadel') {
        this.citadel(e.text ?? '', e.combo ?? 0, wx, wy, e.x > (att?.x ?? 0) ? 1 : -1);
      } else if (e.type === 'walltech') {
        // 벽 낙법: 정면을 박차는 자리에서 푸른 충격과 먼지, 빠져나온 몸이 잠깐 빛난다
        this.glow(wx, wy, 60, COLORS.fxBlue, 0.9, 14);
        this.layer.add(impact({ kind: 'hit', x, y, angle: -Math.PI / 2, size: 0.32, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.dustCloud(wx - 6, wx + 6, 0.35, wy + 10);
        this.debris.burst('brick', wx, wy, 1, 3);
        this.debris.burst('brick', wx, wy, -1, 3);
      } else if (e.type === 'wallkick') {
        // 벽을 박차고 나가는 자리: 벽 점프보다 조금 센 충격, 튀는 부스러기와 먼지
        const f = s.fighters[e.who];
        const out = f ? f.facing : 1;
        this.layer.add(impact({ kind: 'hit', x, y, angle: out > 0 ? 0 : Math.PI, size: 0.36, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('brick', wx, wy, out, 5);
        this.debris.dustCloud(wx - 3, wx + 3, 0.4, wy + 6);
      } else if (e.type === 'wallcling') {
        // 벽에 등이 부딪히는 작은 충격과 벽에서 떨어지는 부스러기
        const f = s.fighters[e.who];
        const out = f ? f.wallSide : 1;
        this.layer.add(impact({ kind: 'hit', x, y, angle: out > 0 ? 0 : Math.PI, size: 0.22, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('brick', wx, wy, out, 3);
      }
    }

    s.fighters.forEach((f, i) => {
      const side = i as 0 | 1;
      // 라이덴 등장 (캐릭터 기획서 '등장 연출'): 붉은 번개가 연달아 내리꽂히고, 그 사이에서 걸어 나와 발을 디딜 때마다 발밑에 불티
      if (f.mode === 'intro' && f.char === 'raiden') {
        const bolt = RAIDEN_INTRO_BOLTS.find((b) => b.t === f.t);
        if (bolt) {
          const [fx, fy] = feet(f);
          const x = fx + f.facing * bolt.dx * FX_PX;
          this.layer.add(lightning({ x, y: fy, length: 300 * FX_PX, ramp: fxRamp(RAIDEN_RAMP), seed: this.seed++ }));
          this.glow(x / FX_PX, fy / FX_PX - 40, 120, COLORS.raidenLight, 0.9, 10);
          this.debris.dustCloud(x / FX_PX - 4, x / FX_PX + 4, 0.2, fy / FX_PX - 2);
        }
        const step = RAIDEN_INTRO_STEPS.find((b) => b.t === f.t);
        if (step) {
          const [fx, fy] = feet(f);
          this.layer.add(glint({ x: fx + f.facing * step.dx * FX_PX, y: fy - 2 * FX_PX, size: 0.35, ramp: fxRamp(['fxWhite', 'raidenLight', 'raiden', 'raidenDark']) }));
        }
      }
      // 벽을 달려 오르는 동안: 발이 벽을 딛는 자리에서 먼지가 인다
      if (f.mode === 'wallrun' && f.t % 5 === 2) {
        const fy = GROUND_Y + f.y / 256;
        this.debris.dustCloud(f.wallX - 2, f.wallX + 2, 0.15, fy - 10);
      }
      // 벽에 붙어 미끄러지는 동안: 손·발이 긁는 자리에서 먼지가 인다
      if (f.mode === 'wallcling' && f.vy > 128 && s.tick % 5 === 0) {
        const fy = GROUND_Y + f.y / 256;
        this.debris.dustCloud(f.wallX - 2, f.wallX + 2, 0.15, fy - 8);
      }
      // 대시·공중 대시가 시작되는 틱: 잔상과 박차는 먼지
      if ((f.mode === 'dash' || f.mode === 'airdash') && this.prevMode[i] !== f.mode) {
        const air = f.mode === 'airdash';
        const st = statsOf(f.char);
        const ticks = air ? st.airDashMoveTo : st.dashMoveTo - st.dashMoveFrom;
        const speed = air ? st.airDashSpeed : st.dashSpeed;
        const fighter = f;
        this.layer.add(dashBlink({
          kind: 'dash',
          actor: { feet: () => feet(fighter), silhouette: () => silhouette(fighter, this.skinOf(fighter)) },
          facing: f.facing * f.dir,
          distance: ((speed * ticks) / 256) * FX_PX,
          time: ticks / 60,
          delay: 0,
          colors: fxRamp(rampOf(f, side)),
          groundColor: fxColor('street'),
          ground: air ? feet(f)[1] : GROUND_Y * FX_PX,
          seed: this.seed++,
          shake: shake(0.4),
        }));
      }
      // 휘두르는 공격의 궤적
      if (f.mode === 'attack' && f.move) {
        const swing = SWINGS[f.move];
        const mv = movesOf(f.char)[f.move];
        if (swing && f.t >= mv.activeStart && this.prevMoveT[i] < mv.activeStart) {
          const [fx, fy] = feet(f);
          this.layer.add(slash({
            x: fx + f.facing * 6 * FX_PX, y: fy + swing.dy * FX_PX, facing: f.facing, size: swing.size, squash: swing.squash,
            tilt: swing.tilt, from: swing.from, to: swing.to, ramp: fxRamp(STEEL), sparkRamp: fxRamp(WARM.slice(1, 5)),
            ground: GROUND_Y * FX_PX, seed: this.seed++,
          }));
        }
        this.prevMoveT[i] = f.t;
      } else this.prevMoveT[i] = -1;
      // 기력 3칸이 찬 순간: 오라가 켜지고, 찬 동안 유지된다
      if (f.meter >= RULES.METER_MAX && this.prevMeter[i] < RULES.METER_MAX) {
        const fighter = f;
        this.layer.add(powerUp({
          actor: { feet: () => feet(fighter), silhouette: () => silhouette(fighter, this.skinOf(fighter)) },
          palette: fxHex(rampOf(f, side)),
          size: 0.55,
          seed: this.seed++,
          sustain: () => fighter.meter >= RULES.METER_MAX,
          shake: shake(0.5),
        }));
      }
      // 다운: 한 번 튀었다가 다시 바닥에 닿는 순간 (6번 프레임) 몸을 따라 먼지가 인다
      if (f.mode === 'knockdown' && f.t === KD_RELAND_T) {
        // 누운 몸은 머리가 뒤쪽 약 20px, 발이 앞쪽 약 25px
        const a = f.x / 256 - 20 * f.facing;
        const b = f.x / 256 + 25 * f.facing;
        this.debris.dustCloud(Math.min(a, b), Math.max(a, b), 0.35, GROUND_Y + f.y / 256);
      }
      // 공중에서 맞는 중 낙법이 가능해진 순간 (콤보 TECH_HITS대 이상, 히트스톱이 끝난 틱) 몸이 한 번 하얗게 깜빡인다
      const ready = f.mode === 'airhit' && f.comboHits >= RULES.TECH_HITS && f.hitstop === 0;
      if (ready && !this.techReady[i]) this.blink[i] = TECH_BLINK;
      this.techReady[i] = ready;
      if (this.blink[i] > 0) this.blink[i]--;
      this.prevMeter[i] = f.meter;
      this.prevMode[i] = f.mode;
      if (this.since[i] < 99) this.since[i]++;
    });
    // 새 라운드: 날던 조각만 지운다 (부서진 자리와 잔해 더미는 sim 상태라 그대로 남는다)
    if (s.round !== this.round) {
      this.round = s.round;
      this.debris.clear();
    }
    // 건물이 무너지는 슬로모션 동안은 연출도 반 속도
    const dt = s.slow > 0 ? 0.5 : 1;
    this.debris.tick(dt);
    this.layer.tick(dt);
  }

  /** 부서지는 물건: 망가질 때 작은 충격, 부서질 때 물건마다 다른 연출 */
  private prop(i: number, broken: boolean, crash: boolean, dir: number): void {
    const b = BREAKABLES[i];
    const cx = b.x + b.w / 2;
    const cy = GROUND_Y - b.bottom - b.h / 2;
    const ramp = b.kind === 'glass' || b.kind === 'hydrant' ? COOL : WARM;
    const angle = dir > 0 ? 0 : Math.PI;
    if (crash) this.fx.shake(0.3);
    if (!broken) {
      this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.35, ramp: fxRamp(ramp), seed: this.seed++ }));
      if (b.kind === 'glass') this.debris.burst('glass', cx, cy, dir, 4);
      return;
    }
    switch (b.kind) {
      case 'neon':
        // 네온관이 깨지며 불꽃과 유리관 조각, 빛이 번쩍 했다가 꺼진다
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.5, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('glass', cx, cy, dir, 16);
        this.debris.burst('metal', cx, cy, dir, 5);
        this.glow(cx, cy, 80, COLORS.skyLight, 1, 14);
        break;
      case 'car':
        // 찌그러짐 → 불붙음 → 폭발
        this.glow(cx, GROUND_Y - 20, 170, COLORS.fxOrange, 1, 50);
        this.layer.add(explosion({ x: cx * FX_PX, ground: GROUND_Y * FX_PX, size: 0.45, surface: fxColor('street'), seed: this.seed++, shake: (t) => this.fx.shake(t * 0.4) }));
        this.debris.burst('metal', cx, GROUND_Y - 14, dir, 14);
        this.fx.flashFor(2);
        break;
      case 'lamp':
        // 쓰러지며 불꽃과 전기
        this.layer.add(impact({ kind: 'ricochet', x: cx * FX_PX, y: (GROUND_Y - 6) * FX_PX, angle, normal: -Math.PI / 2, surface: fxColor('iron'), ground: GROUND_Y * FX_PX, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('glass', cx + dir * 40, GROUND_Y - 4, dir, 8);
        break;
      case 'glass':
        // 금 → 산산조각
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.55, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('glass', cx, cy, dir, 26);
        break;
      case 'newsstand':
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: cy * FX_PX, angle, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('paper', cx, cy - 6, dir, 18);
        this.debris.burst('metal', cx, cy, dir, 6);
        break;
      case 'hydrant':
        // 부러지면 물기둥 (물기둥 자체는 물건 그림이 라운드 끝까지 그린다)
        this.layer.add(impact({ kind: 'hit', x: cx * FX_PX, y: (GROUND_Y - 6) * FX_PX, angle, size: 0.45, ramp: fxRamp(COOL), seed: this.seed++ }));
        this.debris.burst('water', cx, GROUND_Y - 8, dir, 20);
        this.debris.burst('metal', cx, GROUND_Y - 8, dir, 4);
        break;
    }
  }

  /**
   * 시타델 본관 (sim 'citadel' 이벤트, wx·wy: 그 자리). 깎일 때 벽돌 부스러기. 단계가 넘어갈 때 흔들림과 먼지,
   * 2단계부터 유리 조각, 3단계 불꽃 빛. 무너질 때 번쩍임·큰 흔들림, 본관 밑동을 따라 차례로 터지는 폭발,
   * 광장을 덮는 먼지 구름 여러 겹, 떨어지는 커튼월 조각, 이어지는 진동 (본관이 내려앉는 모습은 render/gl/keepfall.ts)
   */
  private citadel(text: string, stage: number, wx: number, wy: number, dir: number): void {
    const K = D.plaza.keep;
    if (text === 'damage') {
      this.debris.burst('brick', wx, wy, dir, 2);
      return;
    }
    if (text === 'stage') {
      this.fx.shake(0.2 + stage * 0.08);
      this.debris.dustCloud(wx - 90, wx + 90, 0.25 + stage * 0.08);
      if (stage >= 2) for (let k = 0; k < 4; k++) this.debris.burst('glass', wx - 60 + k * 40, GROUND_Y - 110, k % 2 ? 1 : -1, 5);
      if (stage === 3) this.glow(wx, GROUND_Y - 150, 160, COLORS.fxOrange, 0.9, 24);
      return;
    }
    if (text !== 'collapse') return;
    this.fx.flashFor(2);
    this.fx.shake(0.95);
    this.glow(wx, GROUND_Y - 120, 260, COLORS.fxOrange, 1, 40);
    [K.x0 + 60, K.x0 + 220, K.x0 + 380, K.x0 + 540, K.x1 - 60].forEach((x, i) =>
      this.after(i * 5, () => {
        this.layer.add(explosion({ x: x * FX_PX, ground: GROUND_Y * FX_PX, size: 0.7, surface: fxColor('street'), seed: this.seed++, fire: 0.3 }));
        this.fx.shake(0.6);
      }));
    for (const [at, size] of [[0, 0.8], [12, 1], [30, 1], [55, 0.8], [85, 0.6]] as const) this.after(at, () => this.debris.dustCloud(K.x0 - 60, K.x1 + 60, size));
    this.after(8, () => this.debris.collapse(K.x0, K.x1, 300, keepAtlas()));
    for (const at of [20, 45, 80, 120]) this.after(at, () => this.fx.shake(0.5));
  }

  /** 틱 뒤에 연출을 낸다 (sim 틱 기준) */
  private after(ticks: number, run: () => void): void {
    this.later.push({ at: this.now + ticks, run });
  }

  /**
   * 큰 물건 (wx, wy: 부서진 자리, 화면 월드 좌표). 망가질 때는 큰 충격만, 크게 무너질 때는 물건마다:
   * 노면전차는 탈선하는 순간 폭발·불꽃·유리, 굴러 뒤집혀 떨어지는 순간 긴 먼지. 급수탑은 지붕 위 폭발·물보라, 지붕에 닿아 터지는 순간 물과 먼지.
   * 등대는 꺾이는 자리 폭발·등실 유리, 밑동 먼지. 시타델 간판은 걸쇠의 번개 불꽃·네온 유리관, 바닥에 닿는 순간 폭발과 먼지.
   */
  private bigProp(i: number, broken: boolean, wx: number, wy: number, dir: number, at: number): void {
    const b = BREAKABLES[i];
    const angle = dir > 0 ? 0 : Math.PI;
    const G = GROUND_Y * FX_PX;
    if (!broken) {
      this.layer.add(impact({ kind: 'hit', x: wx * FX_PX, y: wy * FX_PX, angle, size: 0.6, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.debris.burst(b.kind === 'watertower' ? 'water' : b.kind === 'bigsign' ? 'glass' : 'metal', wx, wy, dir, 8);
      this.fx.shake(0.35);
      return;
    }
    const boom = (x: number, ground: number, size: number, fire: number, y?: number) =>
      this.layer.add(explosion({ x: x * FX_PX, y: y === undefined ? undefined : y * FX_PX, ground: ground * FX_PX, size, fire, surface: fxColor('street'), seed: this.seed++, shake: (t) => this.fx.shake(t * 0.5) }));
    this.fx.shake(0.8);
    this.fx.flashFor(2);
    switch (b.kind) {
      case 'tram': {
        const x0 = at;
        const rest = tramRestX(at);
        boom(x0 + b.w / 2, GROUND_Y, 0.55, 0.25);
        this.layer.add(impact({ kind: 'ricochet', x: (x0 + b.w / 2) * FX_PX, y: (GROUND_Y - 30) * FX_PX, angle, normal: -Math.PI / 2, surface: fxColor('iron'), ground: G, size: 0.8, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.debris.burst('glass', x0 + b.w / 2, GROUND_Y - 40, dir, 24);
        this.debris.burst('metal', x0 + b.w / 2, GROUND_Y - 20, dir, 12);
        this.glow(x0 + b.w / 2, GROUND_Y - 30, 180, COLORS.fxOrange, 1, 50);
        // 굴러 뒤집혀 떨어지는 순간: 차체 길이만큼 먼지와 흔들림
        this.after(30, () => {
          this.debris.dustCloud(rest - 10, rest + b.w + 10, 1.6);
          this.debris.burst('metal', rest + b.w / 2, GROUND_Y - 10, -dir, 8);
          this.fx.shake(0.6);
        });
        break;
      }
      case 'watertower': {
        const roof = GROUND_Y - b.bottom;
        boom(b.x + b.w / 2, roof, 0.4, 0);
        this.debris.burst('water', b.x + b.w / 2, roof - 30, dir, 30);
        this.debris.burst('brick', b.x + b.w / 2, roof - 20, dir, 10);
        // 지붕에 닿아 터지는 순간: 물이 사방으로, 지붕 위 먼지
        this.after(22, () => {
          this.debris.burst('water', b.x + b.w + 20, roof - 8, 1, 40);
          this.debris.burst('water', b.x + b.w + 20, roof - 8, -1, 20);
          this.debris.dustCloud(b.x + b.w, b.x + b.w + 60, 1, roof);
          this.fx.shake(0.5);
        });
        break;
      }
      case 'lighthouse': {
        const L = D.pier.lighthouse;
        const cx = L.x + L.w / 2;
        boom(cx, GROUND_Y, 0.6, 0.2, GROUND_Y - L.snap);
        this.debris.burst('glass', cx, GROUND_Y - L.h + 12, dir, 26);
        this.debris.burst('brick', cx, GROUND_Y - L.snap, dir, 18);
        this.debris.dustCloud(cx - 30, cx + 30, 1.2);
        this.glow(cx, GROUND_Y - L.snap, 160, COLORS.fxOrange, 1, 40);
        this.after(44, () => this.fx.shake(0.4));
        break;
      }
      case 'bigsign': {
        const S = D.plaza.sign;
        const top = GROUND_Y - S.bottom - S.h;
        // 걸쇠가 끊어지며 번개 불꽃, 네온 유리관 조각
        for (const mx of [S.x + 12, S.x + S.w - 12]) {
          this.layer.add(impact({ kind: 'ricochet', x: mx * FX_PX, y: top * FX_PX, angle, normal: Math.PI / 2, surface: fxColor('iron'), ground: G, size: 0.7, ramp: fxRamp(COOL), seed: this.seed++ }));
        }
        this.debris.burst('glass', S.x + S.w / 2, top + 20, dir, 30);
        this.debris.burst('metal', S.x + S.w / 2, top + 10, dir, 8);
        this.glow(S.x + S.w / 2, top, 220, COLORS.skyLight, 1, 24);
        // 바닥(분수)에 닿는 순간 (sim이 쓰러진 간판 발판을 놓는 틱) 폭발과 먼지
        this.after(BREAK_RULES.settle, () => {
          boom(S.x + S.w / 2, GROUND_Y, 0.7, 0.4);
          this.debris.dustCloud(S.x - 20, S.x + S.w + 20, 2);
          this.debris.burst('water', S.x + S.w / 2, GROUND_Y - 20, 1, 24);
          this.debris.burst('water', S.x + S.w / 2, GROUND_Y - 20, -1, 24);
          this.glow(S.x + S.w / 2, GROUND_Y - 20, 200, COLORS.fxOrange, 1, 60);
          this.fx.shake(0.85);
          this.fx.flashFor(2);
        });
        break;
      }
    }
  }

  /**
   * 차지: 모으기 시작과 단계가 오를 때마다 '캉!' 하고 한 번 반짝인다 — 허리에 당긴 주먹에서 십자 빛이 번쩍였다 줄고 고리가 퍼지며,
   * 짧고 센 빛이 바닥과 벽을 한 번 때린다 (몸이 하얗게 번쩍이는 것은 fight.ts). 몸 둘레 오라는 단계마다 한 겹씩 커진다 (모으는 동안 유지).
   * 3단계는 화면도 한 번 번쩍. 떼는 순간 앞으로 빛
   */
  private charge(s: SimState, who: number, what: string, lv: number): void {
    const f = s.fighters[who];
    const wx = f.x / 256;
    const wy = GROUND_Y + f.y / 256 - 24;
    if (what === 'start' || what === 'level') {
      this.layer.add(powerUp({
        actor: { feet: () => feet(f), silhouette: () => silhouette(f, this.skinOf(f)) },
        palette: fxHex(CHARGE_RAMP),
        size: 0.36 + 0.14 * lv,
        seed: this.seed++,
        sustain: () => f.mode === 'charge',
      }));
      // 허리에 당긴 주먹 자리 (모으는 동안 되풀이하는 첫 프레임의 주먹)
      const fist = CHARGE_FIST;
      const gx = wx + f.facing * fist[0];
      const gy = GROUND_Y + f.y / 256 + fist[1];
      this.layer.add(glint({ x: gx * FX_PX, y: gy * FX_PX, size: 0.5 + 0.3 * lv, ramp: fxRamp(['fxWhite', 'goldLight', 'fxYellow', 'fxOrange', 'fxFlame']) }));
      this.glow(gx, gy, 40 + 12 * lv, COLORS.fxYellow, 0.9, 4);
      this.fx.shake(0.06 + 0.05 * lv);
      if (lv >= 3) this.fx.flashFor(1);
    } else if (what === 'release') {
      this.glow(wx + f.facing * 14, wy, 60 + 14 * lv, COLORS.fxYellow, 0.8, 10);
    }
  }

  /** 연출 장면 속 한 대: 상대 몸에 불꽃, 빛, 흔들림 (끝에 줄 피해와는 따로, 보이기만) */
  private cineCue(s: SimState, kind: CineCue['kind']): void {
    const c = s.cine!;
    const def = s.fighters[1 - c.who];
    const att = s.fighters[c.who];
    const wx = def.x / 256;
    const wy = GROUND_Y + def.y / 256 - 26;
    const x = wx * FX_PX;
    const y = wy * FX_PX;
    const toward = att.facing > 0 ? Math.PI : 0;
    if (kind === 'jab') {
      this.layer.add(impact({ kind: 'hit', x, y, angle: toward + (this.seed % 3 - 1) * 0.3, size: 0.35, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.glow(wx, wy, 50, COLORS.fxOrange, 0.8, 6);
      this.fx.shake(0.12);
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = false;
    } else if (kind === 'upper') {
      this.layer.add(impact({ kind: 'hit', x, y: y + 8 * FX_PX, angle: -Math.PI / 2, size: 0.8, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.glow(wx, wy, 90, COLORS.fxWhite, 1, 10);
      this.fx.shake(0.35);
      this.fx.flashFor(1);
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = true;
    } else if (kind === 'hammer') {
      this.layer.add(impact({ kind: 'hit', x, y: y - 6 * FX_PX, angle: Math.PI / 2, size: 0.7, ramp: fxRamp(WARM), seed: this.seed++ }));
      this.glow(wx, wy, 80, COLORS.fxYellow, 1, 8);
      this.fx.shake(0.3);
      this.since[1 - c.who] = 0;
      this.heavy[1 - c.who] = true;
    } else {
      // 바닥에 꽂힘: 흙먼지 폭발과 큰 흔들림
      this.layer.add(explosion({ x, ground: (GROUND_Y + def.y / 256) * FX_PX, size: 0.55, surface: fxColor('street'), seed: this.seed++ }));
      this.debris.dustCloud(wx - 20, wx + 20, 0.7, GROUND_Y + def.y / 256);
      this.glow(wx, GROUND_Y + def.y / 256 - 6, 110, COLORS.fxOrange, 1, 14);
      this.fx.shake(0.55);
      this.fx.flashFor(2);
    }
  }

  /** 맞은 쪽을 하얗게 그릴 틱인가 */
  white(i: number): boolean {
    if (this.blink[i] > 0) return true;
    const t = this.since[i];
    return this.heavy[i] ? t < FLASH_HEAVY || t === 6 : t < FLASH_LIGHT;
  }
}
