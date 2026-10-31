import {
  BREAKABLES, cpuInput, createCity, createCpu, createState, damageCity, RULES, step, type CityState, type PropState, type SimState,
} from '../sim';
import { MAP_H } from '../stage/downtown';
import { drawText } from '../render/font';
import { COLORS } from '../render/palette';
import { SCREEN_H, SCREEN_W } from '../render/screen';
import { drawForeground, drawStage } from '../render/stage';
import type { Scene } from './scene';

/**
 * 무대만 보는 개발용 화면 (?scene=stage). 카메라가 맵 끝에서 끝까지 천천히 오간다.
 * ?cam=숫자 로 카메라 가로 위치(왼쪽 끝 px)를, ?camy=숫자 로 세로 위치(위 끝 px, 0이 맵 맨 위)를 고정할 수 있다.
 * ← → ↑ ↓ 키로 직접 움직여도 된다. 세로 기본값은 바닥이 보이는 맨 아래.
 * ?props=1 (망가짐) / 2 (파괴) 로 부서지는 물건을 모두 그 단계로 보여 준다. 1~3 키로 바꿔도 된다.
 * ?ruin=1 로 건물 정면을 미리 부숴 본다 (금·구멍·뚫림·무너짐을 sim 규칙 그대로 몇 군데에 낸다).
 * ?fg=0 으로 앞겹(카메라 앞을 스치는 기둥·전선)을 끈다.
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
  const propsAt = (stage: number): PropState[] =>
    BREAKABLES.map((_, i) => ({
      hp: stage === 2 ? 0 : 1,
      stage: stage as 0 | 1 | 2,
      damagedAt: stage ? 0 : -1,
      brokenAt: stage === 2 ? 0 : -1,
      crashed: false,
      dir: i % 2 ? -1 : 1,
    }));
  let props = propsAt(Number(params.get('props') ?? 0));
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
      const view = { x: Math.round(cam), y: Math.round(camY) };
      drawStage(ctx, view, base + tick, props, city);
      if (params.get('fg') !== '0') drawForeground(ctx, view);
      drawText(ctx, `CAM ${Math.round(cam)} ${Math.round(camY)}`, 4, 4, COLORS.white);
    },
  };
}

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
  // 맵 왼쪽: 단계별로 하나씩
  damageCity(fake, 60, 120, 14, 35, 'preview'); // 금
  damageCity(fake, 60, 60, 12, 70, 'preview'); // 구멍
  damageCity(fake, 190, 90, 20, 100, 'preview'); // 뚫림 (벽꽝 크기)
  damageCity(fake, 300, 120, 30, 100, 'preview'); // 위층이 넓게 뚫려 실내가 보임
  // 무너짐: 한 건물의 1층을 넓게 뚫는다
  for (let x = 380; x <= 470; x += 12) {
    damageCity(fake, x, 16, 14, 100, 'preview');
    damageCity(fake, x, 46, 14, 100, 'preview');
  }
  return fake.city;
}
