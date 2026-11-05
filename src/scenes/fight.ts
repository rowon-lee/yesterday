import type { TickInput } from '../core/input';
import { cellOf, MAX_CELL } from '../anim/motion';
import { MOTIONS } from '../anim/motions';
import { drawCutin, playCutscene } from '../render/cutin';
import type { CutinData } from '../data/moves/base';
import { drawDust, Effects, type Dust } from '../render/effects';
import { FightVfx, raidenIntroHidden, raidenIntroLift } from '../render/fightvfx';
import { rendersOf } from '../render/chars';
import { VfxLayer } from '../render/vfx';
import { Hud } from '../render/hud';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import { drawPlatforms } from '../render/platforms';
import { GROUND as GROUND_Y, MAP_H } from '../stage/citadel';
import {
  boxesOf, cineScenes, cpuInput, createCpu, createState, floorBelow, IN_ATTACK, IN_DASH, IN_DOWN, IN_JUMP, IN_LEFT, IN_RIGHT, isAirborne,
  IN_SKILL1, IN_SKILL2, IN_SUPER, IN_UP, isChar, movesOf, RULES, statsOf, step, type CharId, type CpuState, type Fighter, type Mode, type PlayerInput,
  type SimState,
} from '../sim';
import type { LookName } from '../anim/skeleton';
import { fighterPose } from '../render/pose';
import { isSkin, type SkinId } from '../anim/skins';
import { gl } from '../render/gl';
import { lights as lights2d } from '../render/light';
import type { App, Scene } from './scene';
import { hintBar, Menu, panel } from '../render/menu';
import { drawControls } from './title';
import { touch } from '../core/touch';
import { audio } from '../audio/engine';
import { SoundBridge } from '../audio/events';

/**
 * 1P 키보드 키 배치. 방향: 화살표 또는 WASD.
 * 왼손 WASD, 오른손 두 줄: 윗줄 U 스킬 1 · I 스킬 2 · O 필살기, 아랫줄 J 공격(길게 = 차지) · K 점프 · L 대시
 */
export const KEYMAP: Record<string, PlayerInput> = {
  ArrowUp: IN_UP, KeyW: IN_UP,
  ArrowDown: IN_DOWN, KeyS: IN_DOWN,
  ArrowLeft: IN_LEFT, KeyA: IN_LEFT,
  ArrowRight: IN_RIGHT, KeyD: IN_RIGHT,
  KeyJ: IN_ATTACK,
  KeyK: IN_JUMP,
  KeyL: IN_DASH,
  KeyU: IN_SKILL1,
  KeyI: IN_SKILL2,
  KeyO: IN_SUPER,
};

/** 키보드 스냅샷 → 입력 비트. 한 틱 안에 눌렀다 뗀 버튼도 눌린 것으로 친다. */
export function keyboardToInput(input: TickInput): PlayerInput {
  let bits = 0;
  for (const code of input.held) bits |= KEYMAP[code] ?? 0;
  for (const code of input.pressed) bits |= KEYMAP[code] ?? 0;
  return bits;
}

const motionByName = new Map(MOTIONS.map((m) => [m.name, m]));
/** 캐릭터가 화면 끝에 붙지 않게 두는 여백 (px) */
const CAMERA_MARGIN = 20;
/** 위로 솟은 사람의 발에서 이만큼 위까지 (머리와 여유), 아래 사람의 발에서 이만큼 아래까지 보이게 */
const CAMERA_HEAD = 90;
const CAMERA_FEET = 24;
/**
 * 띄우기·공중 콤보: 누가 CAMERA_LIFT_FROM(px)보다 높이 뜨면, 넘은 높이의 CAMERA_AIR_FOLLOW배 + CAMERA_LIFT만큼
 * 카메라가 따라 올라가 위층과 하늘이 보이게 한다 (캐릭터는 화면에서 조금만 올라가고 배경이 내려간다).
 */
const CAMERA_LIFT_FROM = 30;
const CAMERA_AIR_FOLLOW = 0.8;
const CAMERA_LIFT = 10;
/** 세로 따라가기 스프링: 당기는 힘과 감쇠 (부드럽게 가속·감속, 넘치지 않음. 목표의 2px 안까지 약 30틱) */
const CAMERA_SPRING = 0.05;
const CAMERA_DAMP = 0.35;

/**
 * 대련 (연습: 1P 키보드 대 CPU). 주소 옵션:
 *   ?p1=cpu  1P도 CPU (구경·캡처용)
 *   ?p2=idle 상대가 가만히 서 있음 (연습용)
 *   ?boxes=1 판정 상자와 발판 표시 (B 키로도 켜고 끔)
 *   ?seed=n  CPU 시드
 *   ?x=n     확인용: 두 사람을 월드 x=n 양쪽(±60)에서 시작시킨다 (장면에서 시작 자리만 옮긴다, sim 규칙은 그대로)
 *   ?mode=vs|practice  대련(3판 2선승) 또는 연습 (타이틀 메뉴가 붙인다)
 *   ?cpu=easy|normal|hard  대련 CPU 강도 (방어 실력)
 *   ?dummy=stand|guard|cpu 연습 상대: 가만히 / 막기만 / CPU
 *   ?p2=tech 확인용: 상대가 가만히 서 있다가 공중에서 맞는 중 낙법이 가능해지면 바로 점프 (낙법 동작 캡처용)
 *   ?p1char=raiden&p2char=… 캐릭터 고르기 (능력치·전용 동작이 캐릭터 것으로, 겉모습도 따라간다. 기본은 기본 스틱맨)
 *   ?p1skin=raiden&p2skin=… 확인용: 캐릭터 겉모습(장식·색)만 바꿔 그린다 (동작·기술은 그 캐릭터 것 그대로)
 * Esc·P로 일시정지 (계속 / 처음부터 / 조작법 / 타이틀로). 경기가 끝나면 다시 하기 / 타이틀로.
 */
export interface FightOpts {
  /** 주소 옵션 (없으면 지금 주소) */
  params?: URLSearchParams;
  /**
   * 불러오기 화면의 '이펙트 미리 그려 보기' (render/rehearse.ts): 화면 밖에서 짧은 연습 대련을 돌려 이펙트 코드·캐시를 데운다.
   * 3D 무대 그리기·확대·소리·터치 패드·확인 도구 값은 건드리지 않는다 (sim과 이펙트·HUD 2D 그림만)
   */
  rehearsal?: boolean;
}

export function fightScene(app?: App, opts: FightOpts = {}): Scene & { fxBorn(): number } {
  const params = opts.params ?? new URLSearchParams(location.search);
  const rehearsal = opts.rehearsal === true;
  const p1Cpu = params.get('p1') === 'cpu';
  const practice = params.get('mode') === 'practice';
  const dummy = params.get('dummy') ?? (params.get('p2') === 'idle' ? 'stand' : params.get('p2') === 'tech' ? 'tech' : practice ? 'stand' : 'cpu');
  const cpuSkill = ({ easy: 25, normal: 55, hard: 85 } as Record<string, number>)[params.get('cpu') ?? 'normal'] ?? 55;
  let seed = Number(params.get('seed') ?? 1) | 0;
  let showBoxes = params.get('boxes') === '1';
  /** 두 사람의 캐릭터 (sim) */
  const charParam = (k: string): CharId => {
    const v = params.get(k);
    return isChar(v) ? v : 'base';
  };
  const chars: [CharId, CharId] = [charParam('p1char'), charParam('p2char')];
  /** 두 사람의 캐릭터 겉모습 (렌더 전용): 따로 정하지 않으면 캐릭터를 따라간다 */
  const skinParam = (k: string, c: CharId): SkinId => {
    const v = params.get(k);
    return isSkin(v) ? v : isSkin(c) ? c : 'base';
  };
  const skins: [SkinId, SkinId] = [skinParam('p1skin', chars[0]), skinParam('p2skin', chars[1])];

  let s: SimState;
  let cpus: [CpuState, CpuState];
  let fx: Effects;
  /** Sprite Fusion 이펙트 층과, 전투 이벤트를 이펙트로 바꾸는 쪽 */
  let vfx: VfxLayer;
  let fightVfx: FightVfx;
  let hud: Hud;
  /** sim 사건 → 소리 (렌더 전용: 상태를 읽기만 한다) */
  const sound = new SoundBridge();
  /** 필살 컷인 (video: 컷씬 영상 훅이 영상을 틀어 기본 띠를 그리지 않음) */
  let cutin: { who: number; text: string; t: number; video: boolean; length: number; style?: CutinData } | null = null;
  /** 카메라: 화면 왼쪽 위의 월드 좌표 (px, 렌더 전용). x가 -1이면 아직 안 정함 */
  let cam = { x: -1, y: 0 };
  let camVy = 0;
  // 렌더 전용: 잔상용 지난 모습, 흙먼지, 직전 상태
  let trails: Snapshot[][] = [[], []];
  let dust: Dust[] = [];
  let prev: Array<{ mode: Mode; air: boolean; step: number }> = [];

  const startX = params.has('x') ? Number(params.get('x')) : null;
  // 일시정지와 경기 끝 메뉴
  let paused = false;
  let showControls = false;
  const toTitle = () => app?.goto('title');
  const pauseMenu = new Menu([
    { label: 'RESUME', act: () => { paused = false; } },
    { label: 'RESTART', act: () => reset() },
    { label: 'CONTROLS', act: () => { showControls = true; } },
    { label: 'TITLE', act: toTitle },
  ], 'PAUSE');
  const endMenu = new Menu([
    { label: 'REMATCH', act: () => { seed++; reset(); } },
    { label: 'TITLE', act: toTitle },
  ]);
  const reset = () => {
    s = createState(seed, { practice, chars });
    if (startX !== null && Number.isFinite(startX)) {
      s.fighters[0].x = Math.round(startX - 60) * 256;
      s.fighters[1].x = Math.round(startX + 60) * 256;
    }
    cpus = [createCpu(seed * 2 + 1), createCpu(seed * 2 + 2, cpuSkill)];
    fx = new Effects();
    vfx = new VfxLayer();
    fightVfx = new FightVfx(vfx, fx);
    fightVfx.skins = skins;
    fightVfx.reset(s);
    sound.reset();
    hud = new Hud();
    hud.names = p1Cpu ? ['CPU 1', 'CPU 2'] : ['1P', practice ? 'DUMMY' : 'CPU'];
    paused = false;
    pauseMenu.sel = 0;
    endMenu.sel = 0;
    cutin = null;
    cam = { x: -1, y: 0 };
    trails = [[], []];
    dust = [];
    prev = s.fighters.map((f) => ({ mode: f.mode, air: f.y < 0, step: 0 }));
  };
  reset();
  // 휴대폰이면 터치 패드·버튼을 띄운다 (CPU끼리 구경할 때는 감춘다)
  if (!rehearsal) touch.enable(!p1Cpu);
  // 확인 도구가 읽는 값
  if (!rehearsal) installDebugHooks();
  function installDebugHooks(): void {
    (window as unknown as { __fight: () => SimState }).__fight = () => s;
    // 확인 도구(14-6 숫자 표)가 읽는 값: 애니 이펙트를 낸 기록
    (window as unknown as { __animeLog: () => unknown }).__animeLog = () => fightVfx.animeLog;
    // 확인 도구: 이번 프레임 애니 이펙트 칸 (뒤·앞 겹 합침, 화면 칸마다 0/1, base64). 처음 부르면 기록을 켠다
    (window as unknown as { __fxMarks: () => string }).__fxMarks = () => {
      if (!vfx.debugMarks) vfx.debugMarks = new Uint8Array(SCREEN_W * SCREEN_H);
      let bin = '';
      for (let i = 0; i < vfx.debugMarks.length; i += 0x8000) bin += String.fromCharCode(...vfx.debugMarks.subarray(i, i + 0x8000));
      return btoa(bin);
    };
  }

  /** 잔상을 남기고, 착지·박차고 뛰는 순간에 흙먼지를 일으킨다 (대시의 잔상·먼지는 Sprite Fusion Dash & Blink) */
  const watchMotion = () => {
    s.fighters.forEach((f, i) => {
      const p = fighterPose(f);
      // 낙법으로 도는 동안(무적 구간)은 흰 잔상 (공통 동작 사양서 '낙법', Dash & Blink의 잔상 응용)
      const spin = f.mode === 'tech' && f.t <= RULES.TECH_INVULN;
      trails[i].push({ motion: p.motion, frame: p.frame, x: f.x, y: f.y, facing: f.facing, fast: isFast(f), white: spin });
      if (trails[i].length > 8) trails[i].shift();
      const was = prev[i];
      const x = f.x / 256;
      const air = isAirborne(f);
      if (was.air && !air) dust.push({ x, y: f.y / 256, dir: 0, t: 0, life: 14 });
      // 뛰는 중에는 발이 땅을 박찰 때마다 (반 바퀴마다) 뒤로 먼지
      const half = (f.dir > 0 ? statsOf(f.char).runCycle : statsOf(f.char).runBackCycle) / 2;
      const stepNo = Math.floor(f.runDist / half);
      if (f.mode === 'run' && stepNo !== was.step) dust.push({ x, y: f.y / 256, dir: -f.facing * f.dir, t: 0, life: 10 });
      prev[i] = { mode: f.mode, air, step: stepNo };
    });
    for (const d of dust) d.t++;
    dust = dust.filter((d) => d.t < d.life);
  };

  /**
   * 카메라 (렌더 전용): 두 사람의 가운데를 부드럽게 따라가되 둘 다 화면 안에 있게 한다.
   * 위아래로도 따라간다: 둘 다 땅에 있으면 바닥이 보이게 내려오고, 높이 솟으면 위 사람의 머리가 보이게 올라간다.
   * 세로는 스프링으로 부드럽게 가속·감속하고, 띄우기·공중 콤보 중에는 위로 여유를 더 둬서 위층과 하늘이 열린다.
   * 스프링이 늦어도 머리와 발이 화면 밖으로 나가지는 않게 막는다.
   */
  const followCamera = () => {
    const sc = cineScene();
    const solo = sc?.cam === 'a' ? s.fighters[s.cine!.who] : null;
    const [a, b] = solo ? [solo, solo] : s.fighters;
    const first = cam.x < 0;
    const mid = (a.x + b.x) / 2 / 256;
    const tx = mid - SCREEN_W / 2;
    let x = first ? tx : cam.x + (tx - cam.x) * 0.18;
    const lo = Math.max(a.x, b.x) / 256 - SCREEN_W + CAMERA_MARGIN;
    const hi = Math.min(a.x, b.x) / 256 - CAMERA_MARGIN;
    x = Math.max(lo, Math.min(hi, x));
    x = Math.max(0, Math.min(RULES.STAGE_W - SCREEN_W, x));
    // 세로: 기본은 바닥이 화면 아래쪽에 오는 자리
    const bottom = MAP_H - SCREEN_H;
    const topHead = GROUND_Y + Math.min(a.y, b.y) / 256 - CAMERA_HEAD;
    const lowFeet = GROUND_Y + Math.max(a.y, b.y) / 256 + CAMERA_FEET;
    const highest = Math.max(-a.y, -b.y) / 256;
    let ty = highest > CAMERA_LIFT_FROM ? bottom - (highest - CAMERA_LIFT_FROM) * CAMERA_AIR_FOLLOW - CAMERA_LIFT : bottom;
    // 위 사람의 머리는 화면 안에, 아래 사람의 발도 화면 안에. 둘 다 담지 못하면 둘의 가운데를 비춘다
    ty = Math.max(lowFeet - SCREEN_H, Math.min(ty, topHead));
    if (lowFeet - topHead > SCREEN_H) ty = (topHead + lowFeet) / 2 - SCREEN_H / 2;
    ty = Math.max(0, Math.min(bottom, ty));
    let y = ty;
    if (first) camVy = 0;
    else {
      camVy = (camVy + (ty - cam.y) * CAMERA_SPRING) * (1 - CAMERA_DAMP);
      y = cam.y + camVy;
      // 머리가 화면 위로, 발이 화면 아래로 나가지 않게
      const headTop = topHead + CAMERA_HEAD - 10;
      const feetLimit = lowFeet - SCREEN_H;
      if (y > headTop && lowFeet - headTop <= SCREEN_H) {
        y = headTop;
        camVy = Math.min(camVy, 0);
      }
      if (y < feetLimit && lowFeet - headTop <= SCREEN_H) {
        y = feetLimit;
        camVy = Math.max(camVy, 0);
      }
      y = Math.max(0, Math.min(bottom, y));
    }
    cam = { x, y };
  };

  /**
   * 2.5D 화면: 무대·캐릭터·이펙트는 three.js 화면에, 이 캔버스(ctx)에는 HUD만 겹쳐 그린다.
   * 먼지·잔상·무너지는 조각·Sprite Fusion 이펙트는 지금까지의 2D 그림을 싸우는 면 바로 뒤·앞의 평면 층에 그린다.
   * 화면 흔들림은 카메라를 반대로 민다.
   */
  /**
   * 필살기 확대 (렌더 전용, 캐릭터 기획서 '필살기 연출'): 발동해서 맞을지 정해질 때까지는 발동자를 2배로,
   * 맞아서 연출이 도는 동안은 두 사람 가운데를 2배로 잡는다. 빗나가거나 막히면 풀린다
   */
  let cineStart = 0;
  /** 지금 연출 장면의 표시 (카메라·확대·멈춤, 렌더 전용) */
  const cineScene = () => (s.cine ? cineScenes(s)[s.cine.scene] : undefined);
  const applyZoom = (v: { x: number; y: number }) => {
    const g = gl();
    const at = (f: Fighter): [number, number] => [f.x / 256 - v.x, GROUND_Y + f.y / 256 - v.y - 26];
    if (s.cine) {
      // 장면마다: 확대 배수 (정수만: 소수 배율은 도트 크기가 칸마다 달라져 1.75배 대신 2배), 발동자에 머물기
      const sc = cineScene();
      const att = s.fighters[s.cine.who];
      const [ax, ay] = at(s.fighters[0]);
      const [bx, by] = at(s.fighters[1]);
      // 확대 배수: 장면 표시(zoom) → 기술 전체 값(cinematic.zoom, 영역 전개형은 1: 확대하지 않는다) → 기본 2배
      const z = sc?.zoom ?? movesOf(att.char)[s.cine.move].data.cinematic?.zoom ?? 2;
      if (sc?.cam === 'a') {
        const [cx, cy] = at(att);
        g.view.setZoom(z, cx + att.facing * 20, cy);
      } else g.view.setZoom(z, (ax + bx) / 2, (ay + by) / 2);
      return;
    }
    const caster = s.fighters.find((f) => f.mode === 'attack' && f.move && movesOf(f.char)[f.move].data.cinematic && !f.moveHit);
    if (caster) {
      const [x, y] = at(caster);
      g.view.setZoom(2, x + caster.facing * 20, y);
    } else g.view.setZoom(1);
  };

  /**
   * 시간 정지 컷인의 배경 (컷인 데이터 dark, 라이덴 파천): 화면을 거의 검게 덮고 두 사람만 그 위에 다시 그린다.
   * 3D 화면은 확대(정수배)돼 있으므로 같은 확대로 시트 칸을 옮겨 그린다 (빛·테두리 빛 없이 평평하게)
   */
  const darkFreeze = (ctx: CanvasRenderingContext2D, v: { x: number; y: number }) => {
    const z = gl().view.zoomRect();
    ctx.fillStyle = COLORS.night;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.imageSmoothingEnabled = false;
    s.fighters.forEach((f, i) => {
      const pose = fighterPose(f);
      const m = motionByName.get(pose.motion);
      if (!m) return;
      const cell = cellOf(m);
      const im = m.image(pose.frame, { look: i === 0 ? 'p1' : 'p2', flip: f.facing < 0, skin: skins[i] });
      const left = f.facing < 0 ? cell.w - 1 - cell.fx : cell.fx;
      const sx = Math.round(f.x / 256 - v.x) - left + im.x;
      const sy = Math.round(GROUND_Y + f.y / 256 - v.y) - cell.fy + im.y;
      if (im.w) ctx.drawImage(im.canvas, 0, 0, im.w, im.h, (sx - z.x) * z.z, (sy - z.y) * z.z, im.w * z.z, im.h * z.z);
    });
  };

  let rehearsalCtx: CanvasRenderingContext2D | null = null;
  const offscreen = () => {
    const c = document.createElement('canvas');
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    return c.getContext('2d')!;
  };
  const render3d = (ctx: CanvasRenderingContext2D) => {
    const g = gl();
    const [ox, oy] = fx.offset();
    const placed = g.view.begin({ x: cam.x - ox, y: cam.y - oy }, s.tick);
    lights2d.clear();
    fightVfx.emitLights(s);
    {
      const sc = cineScene();
      const still = (s.freeze > 0 && !!cutin?.style?.dark) || !!sc?.still;
      let red: [number, number, number] | null = null;
      if (sc?.still && s.cine) {
        const att = s.fighters[s.cine.who];
        const fist = fighterPose(att).joints.hB;
        red = [att.x / 256 + att.facing * fist[0] - placed.ix, GROUND_Y + att.y / 256 + fist[1] - placed.iy, 22];
      }
      if (!rehearsal) g.world.freezeRain(still, red);
    }
    if (!rehearsal) {
      g.world.update(g.view, s.tick, s.props, s.city, (s.fighters[0].x + s.fighters[1].x) / 2 / 256, s.clock, s.citadel, s.wreck);
      g.view.commitLights();
    }
    const v = { x: placed.ix, y: placed.iy };
    const toScreen = (x: number, y: number): [number, number] => [Math.round(x - v.x), Math.round(GROUND_Y + y - v.y)];
    // 미리 그려 보기(rehearsal): 화면의 평면 층·그래픽 칩은 건드리지 않고 화면 밖 캔버스에만 그린다
    const paint = (layer: typeof g.actors.back, draw: (c: CanvasRenderingContext2D) => boolean) => {
      if (!rehearsal) return layer.paint(g.view.renderer, v.x, v.y, draw);
      rehearsalCtx ??= offscreen();
      rehearsalCtx.clearRect(0, 0, SCREEN_W, SCREEN_H);
      draw(rehearsalCtx);
    };
    paint(g.actors.back, (c) => {
      let drew = dust.length > 0;
      drawDust(c, dust, toScreen);
      trails.forEach((tr, i) => {
        for (const back of [6, 3]) {
          const t = tr[tr.length - 1 - back];
          if (t && tr[tr.length - 1].fast && t.fast) {
            drawGhost(c, t, i === 0 ? 'ghost1' : 'ghost2', toScreen, back === 6, skins[i]);
            drew = true;
          } else if (t && tr[tr.length - 1].white && t.white) {
            drawGhost(c, t, 'ghostW', toScreen, back === 6, skins[i]);
            drew = true;
          }
        }
      });
      if (vfx.draw(c, v, 'back')) drew = true;
      if (fightVfx.debris.busy) {
        fightVfx.debris.drawDust(c, v, 'back');
        fightVfx.debris.draw(c, v);
        drew = true;
      }
      return drew;
    });
    paint(g.actors.front, (c) => {
      let drew = vfx.draw(c, v, 'front');
      if (fightVfx.debris.busy) {
        fightVfx.debris.drawDust(c, v, 'front');
        drew = true;
      }
      return drew;
    });
    // 맞고 있는 쪽을 뒤에, 공격하는 쪽을 앞에
    const order = [...s.fighters].sort((a, b) => Number(a.mode === 'attack') - Number(b.mode === 'attack'));
    g.actors.update(s.fighters.map((f, i) => {
      const pose = fighterPose(f);
      // 강타에 맞은 1~3틱: 주색 실루엣 + 밝은 테두리 (14-8 ⑧), 아니면 하얀 번쩍임
      const struck = fightVfx.struck(i);
      const white = !struck && fightVfx.white(i);
      const glow = chargeGlow(f);
      const jitter = f.hitstop > 0 && SHAKEN.has(f.mode) ? (s.tick % 2 ? 1 : -1) : 0;
      return {
        motion: motionByName.get(pose.motion)!,
        frame: pose.frame,
        look: struck ? fightVfx.struckLook(i) : white || glow === 2 ? 'flash' : glow === 1 ? (i === 0 ? 'glow1' : 'glow2') : i === 0 ? 'p1' : 'p2',
        skin: skins[i],
        flip: f.facing < 0,
        x: f.x / 256 + jitter,
        // 라이덴 등장: 번개 속에서 나타나 위에서 떨어진다 (렌더 전용 높이)
        h: -f.y / 256 + raidenIntroLift(f),
        floor: -floorBelow(s, f.x, f.y) / 256,
        rim: !white && !struck,
        // 대시 중 순간이동 구간은 깜빡인다. 순간이동 기술(라이덴 잔흔)은 사라지는 틱에 한 번 보이지 않는다
        visible: !((f.mode === 'dash' || f.mode === 'airdash') && f.invuln > 0 && s.tick % 2) && !blinkingNow(f) && !raidenIntroHidden(f) && !rendersOf(f.char).hidden?.(s, f, i) && !fightVfx.hides(i),
        order: order.indexOf(f),
      };
    }));
    if (!rehearsal) {
      applyZoom(v);
      g.view.render();
    }
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    if (showBoxes) {
      drawPlatforms(ctx, v, s);
      drawBoxes(ctx, s, v);
    }
    // 강한 타격: 화면 번쩍임 (디더링)
    if (fx.flash > 0) {
      ctx.fillStyle = COLORS.white;
      for (let y = 0; y < SCREEN_H; y += 2) for (let x = (y >> 1) & 1; x < SCREEN_W; x += 2) ctx.fillRect(x, y, 1, 1);
    }
    if (cutin && !cutin.video) {
      if (cutin.style?.dark) darkFreeze(ctx, v);
      drawCutin(ctx, cutin);
    }
    // 필살기 발동 정지·연출 중: 위아래 검은 띠, HUD는 감춘다
    // 캐릭터 연출이 3D 화면 위에 겹쳐 그리는 것 (월령수류의 흰 화면과 먹빛 선 등, 위아래 검은 띠 아래)
    const pl = gl().view.placed;
    s.fighters.forEach((f, i) => rendersOf(f.char).overlay?.(ctx, s, f, i, { x: pl.ix, y: pl.iy }));
    if (s.cine) letterbox(ctx, s.tick - cineStart);
    else if (!cutin) {
      hud.meterTop = touch.shown;
      hud.draw(ctx, s);
    }
    if (s.phase === 'matchEnd' && s.phaseT > 120 && !p1Cpu) {
      panel(ctx, SCREEN_W / 2 - 60, 150, 120, endMenu.items.length * 16 + 12);
      endMenu.draw(ctx, SCREEN_W / 2, 157, s.tick);
    }
    if (paused) {
      // 멈춘 화면 위에 어두운 판과 메뉴
      if (showControls) {
        drawControls(ctx);
        hintBar(ctx, touch.shown ? 'TAP TO CLOSE' : 'ANY KEY: CLOSE', SCREEN_H - 14);
      } else {
        panel(ctx, SCREEN_W / 2 - 64, 88, 128, pauseMenu.items.length * 16 + 26);
        pauseMenu.draw(ctx, SCREEN_W / 2, 95, s.tick);
        hintBar(ctx, touch.shown ? 'TAP TO SELECT   II: RESUME' : 'J: SELECT   P / ESC: RESUME', SCREEN_H - 14);
      }
    }
  };

  return {
    tick(input) {
      if (input.pressed.has('KeyB')) showBoxes = !showBoxes;
      const taps = input.taps ?? [];
      // 일시정지: Esc·P·터치 Ⅱ 버튼. 멈춘 동안은 메뉴만 받는다 (sim은 한 틱도 가지 않는다)
      const pauseKey = input.pressed.has('Escape') || input.pressed.has('KeyP') || touch.takePause();
      if (paused) {
        // 멈춘 동안 누른 터치 버튼은 버린다 (다시 시작할 때 튀어나오지 않게)
        touch.poll();
        if (showControls) {
          if (input.pressed.size || taps.length) showControls = false;
          return;
        }
        if (pauseKey) paused = false;
        else if (pauseMenu.handle(input, taps) === 'back') paused = false;
        return;
      }
      if (pauseKey && s.phase !== 'matchEnd' && !p1Cpu) {
        paused = true;
        pauseMenu.sel = 0;
        return;
      }
      // 경기가 끝나고 잠시 뒤: 다시 하기 / 타이틀로 (CPU끼리 구경이면 저절로 다시)
      if (s.phase === 'matchEnd' && s.phaseT > 120) {
        if (p1Cpu) {
          seed++;
          reset();
          return;
        }
        endMenu.handle(input, taps);
      }
      const pad = touch.poll();
      const p1 = p1Cpu ? cpuInput(cpus[0], s, 0) : keyboardToInput(input) | pad;
      const d2 = s.fighters[1];
      const canTech = d2.mode === 'airhit' && d2.comboHits >= RULES.TECH_HITS && d2.hitstop === 0;
      const p2 = dummy === 'stand' ? 0 : dummy === 'guard' ? (s.phase === 'fight' ? IN_DOWN : 0) : dummy === 'tech' ? (canTech ? IN_JUMP : 0) : cpuInput(cpus[1], s, 1);
      step(s, [p1, p2]);
      // 소리: 이번 틱 사건을 읽어 바로 낸다 (맞는 틱에 소리가 시작)
      for (const c of sound.read(s)) if (!rehearsal) audio.cue(c);
      fx.push(s.events);
      for (const e of s.events) if (e.type === 'cine' && e.text === 'start') cineStart = s.tick;
      fightVfx.tick(s);
      fx.tick();
      hud.tick(s);
      for (const e of s.events) {
        if (e.type !== 'cutin') continue;
        // 나중에 AI 컷씬 영상을 끼울 자리: 훅이 영상을 틀면 기본 컷인 띠는 그리지 않는다
        const data = e.move ? movesOf(s.fighters[e.who].char)[e.move as keyof ReturnType<typeof movesOf>]?.data.cutin : undefined;
        const style = typeof data === 'object' ? data : undefined;
        const length = style?.freeze ?? RULES.SUPER_FREEZE;
        const video = playCutscene({ who: e.who, move: e.move ?? '', text: e.text ?? '', ticks: length });
        cutin = { who: e.who, text: e.text ?? '', t: 0, video, length, style };
      }
      watchMotion();
      followCamera();
      // 터치 공격 버튼: 길게 눌러 모으는 중이면 빛낸다
      if (!rehearsal) touch.setCharge(s.fighters[0].mode === 'charge' ? 2 : s.fighters[0].chargeArm ? 1 : 0);
      if (cutin) {
        cutin.t++;
        if (s.freeze === 0) cutin = null;
      }
    },

    render(ctx) {
      if (cam.x < 0) followCamera();
      render3d(ctx);
    },
    fxBorn: () => vfx.born,
  };
}

interface Snapshot {
  motion: string;
  frame: number;
  x: number;
  y: number;
  facing: 1 | -1;
  fast: boolean;
  /** 낙법으로 도는 중 (흰 잔상) */
  white: boolean;
}

/** 필살기 연출 중 위아래 검은 띠 (처음 6틱 동안 밀려 들어온다) */
function letterbox(ctx: CanvasRenderingContext2D, t: number): void {
  const h = Math.round(22 * Math.min(1, t / 6));
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, SCREEN_W, h);
  ctx.fillRect(0, SCREEN_H - h, SCREEN_W, h);
}

/**
 * 차지를 모으는 동안 몸이 빛남 (렌더 전용): 0 그대로, 1 한 단계 밝게, 2 하얗게.
 * 모으는 동안은 한 단계 밝은 채로 있고, 모으기를 시작할 때와 단계가 오를 때마다 3틱 하얗게 '캉!' 번쩍인다
 */
/** 캐릭터별 차지 단계가 오르는 틱 */
const chargeLevelAt = (f: Fighter): number[] => movesOf(f.char).charge.data.charge!.levels.map((l) => l.at);
function chargeGlow(f: Fighter): 0 | 1 | 2 {
  // 라이덴 금강불괴: 10틱마다 3틱 몸이 대표 색으로 번뜩인다 (단단해진 몸)
  if (f.kongoT > 0 && f.mode !== 'charge') return f.kongoT % 10 < 3 ? 1 : 0;
  if (f.mode !== 'charge') return 0;
  // 라이덴 투전승불은 몸을 칠하지 않는다: 전류 윤곽·붉게 물드는 머리·맥동은 이펙트가 그린다 (사용자 피드백 2026-11-02 9-1)
  if (f.char === 'raiden') return 0;
  const since = f.t - chargeLevelAt(f)[Math.max(0, f.chargeLv - 1)];
  return since >= 0 && since < 3 ? 2 : 1;
}

/** 순간이동 기술이 사라지는 틱인가 (그 틱은 Dash & Blink 이펙트만 보인다) */
function blinkingNow(f: Fighter): boolean {
  if (f.mode !== 'attack' || !f.move) return false;
  const b = movesOf(f.char)[f.move].blink;
  return b !== undefined && f.t === b.tick;
}

/** 잔상을 남길 만큼 빠른가: 3px/틱 이상으로 움직일 때 (대시는 Sprite Fusion 잔상이 따로 있어 뺀다) */
function isFast(f: Fighter): boolean {
  return f.mode !== 'dash' && f.mode !== 'airdash' && Math.abs(f.vx) >= 3 * 256;
}

/** 잔상 캔버스 (가장 큰 칸) */
const ghostCanvas = document.createElement('canvas');
ghostCanvas.width = MAX_CELL.w;
ghostCanvas.height = MAX_CELL.h;
/** 바둑판 무늬 (반투명 대신 디더링) */
const checker = (() => {
  const c = document.createElement('canvas');
  c.width = MAX_CELL.w;
  c.height = MAX_CELL.h;
  const g = c.getContext('2d')!;
  for (let y = 0; y < MAX_CELL.h; y++) for (let x = y & 1; x < MAX_CELL.w; x += 2) g.fillRect(x, y, 1, 1);
  return c;
})();

function drawGhost(
  ctx: CanvasRenderingContext2D,
  g: Snapshot,
  look: LookName,
  toScreen: (x: number, y: number) => [number, number],
  faint: boolean,
  skin: SkinId = 'base',
) {
  const m = motionByName.get(g.motion)!;
  const cell = cellOf(m);
  const gc = ghostCanvas.getContext('2d')!;
  gc.globalCompositeOperation = 'source-over';
  gc.clearRect(0, 0, MAX_CELL.w, MAX_CELL.h);
  m.draw(gc, g.frame, 0, 0, { look, flip: g.facing < 0, skin });
  gc.globalCompositeOperation = 'destination-in';
  gc.drawImage(checker, 0, 0);
  gc.globalCompositeOperation = 'source-over';
  // 더 오래된 잔상은 한 줄 걸러 지워 더 옅게
  if (faint) for (let y = 0; y < cell.h; y += 2) gc.clearRect(0, y, cell.w, 1);
  const [sx, sy] = toScreen(g.x / 256, g.y / 256);
  ctx.drawImage(ghostCanvas, 0, 0, cell.w, cell.h, sx - cell.fx, sy - cell.fy, cell.w, cell.h);
}

/** 맞아서 멈춘 동안(히트스톱) 맞은 쪽이 좌우로 1px씩 떨린다 */
const SHAKEN: ReadonlySet<string> = new Set(['hitstun', 'airhit', 'blockstun', 'crush', 'ko']);

function drawBoxes(ctx: CanvasRenderingContext2D, s: SimState, cam: { x: number; y: number }) {
  const rect = (b: { x0: number; y0: number; x1: number; y1: number }, color: string) => {
    const x = Math.round(b.x0 / 256 - cam.x);
    const y = Math.round(GROUND_Y + b.y0 / 256 - cam.y);
    const w = Math.max(1, Math.round((b.x1 - b.x0) / 256));
    const h = Math.max(1, Math.round((b.y1 - b.y0) / 256));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  };
  for (const f of s.fighters) {
    const b = boxesOf(f);
    if (b.hurt) rect(b.hurt, COLORS.green);
    if (b.hit) rect(b.hit, COLORS.red);
  }
}
