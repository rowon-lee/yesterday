import { FOOT_X, FOOT_Y } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import { BREAKABLES, GRIDS, fighterPose, MOVES, RULES, STATS, tramRestX, type Fighter, type SimState } from '../sim';
import { CITADEL as D } from '../data/stages/citadel';
import { Debris } from './debris';
import dashBlink from '../vfx/dash-blink';
import explosion from '../vfx/explosion';
import impact from '../vfx/impact';
import powerUp from '../vfx/power-up';
import slash from '../vfx/slash';
import type { Effects } from './effects';
import type { ColorName } from './palette';
import { BREAK_RULES, GROUND as GROUND_Y } from '../stage/citadel';
import { facadeAtlas } from './gl/buildings';
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
/** 타격 불꽃 (뜨거운 색) */
const WARM: ColorName[] = ['fxWhite', 'goldLight', 'fxYellow', 'fxOrange', 'fxFlame', 'fxRed'];
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

/** 맞은 쪽 하얀 번쩍임: 맞은 순간부터 이 틱 동안 하얗게 (센 타격은 한 번 더 깜빡) */
const FLASH_LIGHT = 3;
const FLASH_HEAVY = 4;

const motionByName = new Map(MOTIONS.map((m) => [m.name, m]));
const silCanvas = document.createElement('canvas');
silCanvas.width = 64;
silCanvas.height = 64;
const silCache = new Map<string, Uint32Array>();

/** 지금 모습의 실루엣 (Power Up 오라·대시 잔상이 몸 윤곽을 따라가도록). 이펙트 픽셀 좌표 */
function silhouette(f: Fighter) {
  const p = fighterPose(f);
  const key = `${p.motion}/${p.frame}/${f.facing}`;
  let data = silCache.get(key);
  if (!data) {
    const g = silCanvas.getContext('2d', { willReadFrequently: true })!;
    g.clearRect(0, 0, 64, 64);
    motionByName.get(p.motion)!.draw(g, p.frame, 0, 0, { look: 'p1', flip: f.facing < 0 });
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
  private prevMeter = [0, 0];
  private prevMode = ['idle', 'idle'];
  private prevMoveT = [-1, -1];
  private seed = 1;

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
      if (f.meter >= RULES.METER_MAX) lights.point(f.x / 256, GROUND_Y + f.y / 256 - 26, 54, i === 0 ? COLORS.gold : COLORS.sky, 0.45);
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
    this.prevMeter = s.fighters.map((f) => f.meter);
    this.prevMode = s.fighters.map((f) => f.mode);
  }

  /** sim 한 틱 뒤에 부른다 */
  tick(s: SimState): void {
    const shake = (k: number) => (t: number) => this.fx.shake(t * k);
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
        this.layer.add(impact({ kind: 'hit', x, y, angle, size, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.since[1 - e.who] = 0;
        this.heavy[1 - e.who] = !!e.heavy;
        if (e.move === 'super') {
          this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.5, surface: fxColor('street'), seed: this.seed++, shake: shake(0.3) }));
        }
      } else if (e.type === 'block') {
        this.layer.add(impact({ kind: 'hit', x, y, angle, size: 0.32, ramp: fxRamp(COOL), seed: this.seed++ }));
      } else if (e.type === 'crush') {
        this.layer.add(impact({ kind: 'hit', x, y, angle, size: 0.8, ramp: fxRamp(WARM), seed: this.seed++ }));
        this.layer.add(explosion({ x: feet(def)[0], ground: GROUND_Y * FX_PX, size: 0.3, surface: fxColor('street'), seed: this.seed++, fire: 0.1 }));
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
        const ticks = air ? STATS.airDashMoveTo : STATS.dashMoveTo - STATS.dashMoveFrom;
        const speed = air ? STATS.airDashSpeed : STATS.dashSpeed;
        const fighter = f;
        this.layer.add(dashBlink({
          kind: 'dash',
          actor: { feet: () => feet(fighter), silhouette: () => silhouette(fighter) },
          facing: f.facing * f.dir,
          distance: ((speed * ticks) / 256) * FX_PX,
          time: ticks / 60,
          delay: 0,
          colors: fxRamp(SIDE_RAMP[side]),
          groundColor: fxColor('street'),
          ground: air ? feet(f)[1] : GROUND_Y * FX_PX,
          seed: this.seed++,
          shake: shake(0.4),
        }));
      }
      // 휘두르는 공격의 궤적
      if (f.mode === 'attack' && f.move) {
        const swing = SWINGS[f.move];
        const mv = MOVES[f.move];
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
          actor: { feet: () => feet(fighter), silhouette: () => silhouette(fighter) },
          palette: fxHex(SIDE_RAMP[side]),
          size: 0.55,
          seed: this.seed++,
          sustain: () => fighter.meter >= RULES.METER_MAX,
          shake: shake(0.5),
        }));
      }
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

  /** 맞은 쪽을 하얗게 그릴 틱인가 */
  white(i: number): boolean {
    const t = this.since[i];
    return this.heavy[i] ? t < FLASH_HEAVY || t === 6 : t < FLASH_LIGHT;
  }
}
