import {
  BREAKABLES, cpuInput, createCity, createCpu, createState, damageCity, RULES, step, type CityState, type PropState, type SimState,
} from '../sim';
import { MAP_H } from '../stage/citadel';
import { drawText } from '../render/font';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import { drawPlatforms } from '../render/platforms';
import { gl } from '../render/gl';
import { lights as lights2d } from '../render/light';
import type { Scene } from './scene';

/**
 * 무대만 보는 개발용 화면 (?scene=stage). 카메라가 맵 끝에서 끝까지 천천히 오간다.
 * ?cam=숫자 로 카메라 가로 위치(왼쪽 끝 px)를, ?camy=숫자 로 세로 위치(위 끝 px, 0이 맵 맨 위)를 고정할 수 있다.
 * ← → ↑ ↓ 키로 직접 움직여도 된다. 세로 기본값은 바닥이 보이는 맨 아래.
 * ?props=1 (망가짐) / 2 (파괴) 로 부서지는 물건을 모두 그 단계로 보여 준다. 1~3 키로 바꿔도 된다.
 *   ?broke=틱 으로 부서진 틱을 정한다 (그 틱부터 쓰러지는 연출이 시작된다. 기본 0).
 *   ?big=틱 으로 큰 물건 4개(노면전차·급수탑·등대·시타델 간판)만 그 틱에 크게 무너뜨린다. ?big=d 면 큰 물건만 망가짐.
 *   ?tram=x 로 노면전차가 탈선한 자리를 정한다 (기본 560). ?dir=-1 이면 왼쪽으로 맞아 쓰러진다.
 * ?ruin=1 로 건물 정면을 미리 부숴 본다 (금·구멍·뚫림·무너짐을 sim 규칙 그대로 몇 군데에 낸다).
 * ?fg=0 으로 앞겹(카메라 앞을 스치는 기둥·전선·깃대)을 끈다. ?plat=1 로 발판을 보인다 (중층 노랑, 옥상 하늘색).
 * ?match=시드 로 CPU끼리 한 경기를 끝까지 돌린 뒤의 거리(건물·물건)를 보여 준다. 라운드가 넘어가도 파괴가 남는지 보는 용도.
 */
export function stageScene(): Scene {
  const params = new URLSearchParams(location.search);
  const max = RULES.STAGE_W - SCREEN_W;
  const fixed = params.has('cam');
  let cam = fixed ? Math.max(0, Math.min(max, Number(params.get('cam')))) : 0;
  const maxY = MAP_H - SCREEN_H;
  let camY = params.has('camy') ? Math.max(0, Math.min(maxY, Number(params.get('camy')))) : maxY;
  let dir = 1;
  let manual = fixed;
  let tick = 0;
  const broke = Number(params.get('broke') ?? 0) | 0;
  const tramX = Number(params.get('tram') ?? 560) | 0;
  const hitDir = params.has('dir') ? Math.sign(Number(params.get('dir'))) || 1 : 0;
  const propAt = (i: number, stage: number, at: number): PropState => ({
    hp: stage === 2 ? 0 : 1,
    stage: stage as 0 | 1 | 2,
    damagedAt: stage ? at : -1,
    brokenAt: stage === 2 ? at : -1,
    crashed: false,
    dir: hitDir || (i % 2 ? -1 : 1),
    at: tramX,
  });
  const propsAt = (stage: number): PropState[] => BREAKABLES.map((_, i) => propAt(i, stage, broke));
  let props = propsAt(Number(params.get('props') ?? 0));
  if (params.has('big')) {
    const b = params.get('big');
    props = BREAKABLES.map((k, i) => (k.big ? propAt(i, b === 'd' ? 1 : 2, Number(b) | 0) : propAt(i, 0, 0)));
  }
  let city = params.get('ruin') === '1' ? ruinedCity() : null;
  // 경기 뒤 거리: 잔해 더미가 다 쌓인 모습이 되게 시각을 경기 끝 뒤로 둔다
  let base = 0;
  if (params.has('match')) {
    const after = playMatch(Number(params.get('match')) | 0);
    city = after.city;
    props = after.props;
    base = after.tick + 600;
  }
  return {
    tick(input) {
      tick++;
      for (const [code, stage] of [['Digit1', 0], ['Digit2', 1], ['Digit3', 2]] as const) if (input.pressed.has(code)) props = propsAt(stage);
      const left = input.held.has('ArrowLeft') || input.held.has('KeyA');
      const right = input.held.has('ArrowRight') || input.held.has('KeyD');
      if (left || right) manual = true;
      const up = input.held.has('ArrowUp') || input.held.has('KeyW');
      const down = input.held.has('ArrowDown') || input.held.has('KeyS');
      camY = Math.max(0, Math.min(maxY, camY + (down ? 3 : 0) - (up ? 3 : 0)));
      if (manual) cam = Math.max(0, Math.min(max, cam + (right ? 3 : 0) - (left ? 3 : 0)));
      else {
        cam += dir;
        if (cam >= max || cam <= 0) dir = -dir;
      }
    },
    render(ctx) {
      // 2.5D: 무대는 three.js 화면에, 이 캔버스에는 카메라 글씨와 확인용 발판만
      const g = gl();
      lights2d.clear();
      g.world.foreground.visible = params.get('fg') !== '0';
      const placed = g.view.begin({ x: cam, y: camY }, base + tick);
      g.world.update(g.view, base + tick, props, city);
      g.view.commitLights();
      g.view.render();
      ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
      if (params.get('plat') === '1') drawPlatforms(ctx, { x: placed.ix, y: placed.iy }, { city: city ?? EMPTY, props, tick: base + tick });
      drawText(ctx, `CAM ${Math.round(cam)} ${Math.round(camY)}`, 4, 4, COLORS.white);
    },
  };
}

const EMPTY = createCity();

/** CPU끼리 한 경기를 끝까지 (전투 화면과 같은 시드 규칙) */
function playMatch(seed: number): SimState {
  const s = createState(seed);
  const cpus = [createCpu(seed * 2 + 1), createCpu(seed * 2 + 2)];
  while (s.phase !== 'matchEnd' && s.tick < 30000) step(s, [cpuInput(cpus[0], s, 0), cpuInput(cpus[1], s, 1)]);
  return s;
}

/** 미리보기용으로 부순 건물: 금(약한 타격), 구멍, 뚫림(벽꽝), 무너짐(1층을 크게 뚫음) */
function ruinedCity(): CityState {
  const fake = { city: createCity(), events: [], tick: 0, slow: 0 } as unknown as SimState;
  // 극장·다이너 거리: 단계별로 하나씩
  damageCity(fake, 880, 170, 14, 35, 'preview'); // 금 (호텔 위층)
  damageCity(fake, 880, 120, 12, 70, 'preview'); // 구멍
  damageCity(fake, 460, 150, 20, 100, 'preview'); // 뚫림 (벽꽝 크기, 빵집)
  damageCity(fake, 600, 230, 30, 100, 'preview'); // 극장 위층이 넓게 뚫려 실내가 보임
  // 무너짐: 다이너 1층을 넓게 뚫는다
  for (let x = 712; x <= 820; x += 12) {
    damageCity(fake, x, 16, 14, 100, 'preview');
    damageCity(fake, x, 46, 14, 100, 'preview');
  }
  return fake.city;
}
