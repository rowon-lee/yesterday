import type { Joints, Point } from '../pose';
import type { Decor, Look } from '../skeleton';
import type { Skin } from '../skins';

/*
 * 백은우 표식 (캐릭터 기획서): 가는 체형, 밝은 갈색 꽁지머리, 흰 의사 가운 자락, 하네스, 연검 스텔라리스.
 * 모두 관절에 붙는 도형이라 어떤 동작에서도 따라간다. 오른쪽을 보는 모습 기준 (왼쪽은 시트를 그릴 때 뒤집는다).
 * - 몸(팔다리)은 백합 연분홍, 가운은 흰색(그늘은 차가운 회청), 하네스·실은 금색, 칼날은 은빛.
 * - 가운: 무릎까지 오는 흰 가운. 뒷자락은 다리 뒤로 늘어지고, 몸을 숙이거나 뒷다리를 뒤로 뻗을수록 크게 뒤로 휘날린다
 *   (그림에는 속도가 없으니 몸의 기울기와 뒷다리가 뒤로 간 만큼 자락이 뒤로 들린다).
 * - 꽁지머리: 머리 뒤 위에서 묶어 아래·뒤로 늘어진다. 몸을 숙일수록 뒤로 날린다.
 * - 연검: 앞손에 쥐고, 칼날은 손목 방향으로 뻗다 끝이 리본처럼 아래로 휜다 (채찍처럼 늘어나는 끝은 공격 이펙트가 그린다).
 * 눈은 그리지 않는다 (CLAUDE.md, 설정의 금색 눈도 그리지 않음).
 */

const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k];
const norm = (v: Point): Point => {
  const d = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / d, v[1] / d];
};
const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1];

/** 몸통 방향(엉덩이 → 목)과 몸의 앞쪽 (오른쪽을 볼 때 가슴 쪽) */
function torso(j: Joints): { up: Point; down: Point; front: Point } {
  const up = norm([j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]]);
  return { up, down: [-up[0], -up[1]], front: [-up[1], up[0]] };
}

/** 가운 뒷자락이 뒤로 들리는 정도 (0 늘어짐 ~ 1 크게 휘날림): 몸이 앞으로 숙을수록, 뒷다리가 엉덩이 뒤로 멀리 갈수록 */
function flutter(j: Joints): number {
  const { up, front } = torso(j);
  const lean = Math.max(0, Math.min(1, (up[0] - 0.1) / 0.6));
  const back = dot([j.fB[0] - j.hip[0], j.fB[1] - j.hip[1]], [-front[0], -front[1]]);
  const stride = Math.max(0, Math.min(1, (back - 6) / 12));
  return Math.max(lean, stride * 0.8);
}

export const EUNWOO_DECOR: Decor = {
  /**
   * 가운 뒷자락: 어깨 뒤에서 엉덩이를 지나 무릎 높이까지 늘어지는 흰 천. 다리보다 뒤에 그린다.
   * 자락 끝은 몸 아래 방향과 중력을 섞어 처지고, flutter만큼 뒤로 들려 휘날린다
   */
  behind(pen, j) {
    const { down, front } = torso(j);
    const back: Point = [-front[0], -front[1]];
    const k = flutter(j);
    // 처지는 방향: 몸 아래와 중력(아래)을 섞고, 휘날릴수록 뒤쪽으로 기운다
    const hang = norm([down[0] * 0.5 + back[0] * (0.25 + 0.9 * k), down[1] * 0.5 + 0.5 + back[1] * (0.25 + 0.9 * k)]);
    const top = add(j.neck, down, 2);
    const len = 15 + 3 * k;
    pen.fill('clothBack', (s) => s.poly([
      add(top, back, 2.5),
      add(top, front, 1),
      add(add(j.hip, front, 1.5), hang, 6),
      add(add(j.hip, front, -1), hang, len - 2),
      add(add(j.hip, back, 3 + 2 * k), hang, len + 1),
      add(add(j.hip, back, 5 + 3 * k), hang, len - 4),
      add(j.hip, back, 4.5),
    ]));
  },
  /** 가운 몸판·앞자락(앞 허벅지를 덮는다), 하네스(금색 어깨끈·허리띠) */
  body(pen, j) {
    const { up, down, front } = torso(j);
    const top = add(j.neck, down, 1.5);
    const k = flutter(j);
    const hang = norm([down[0] * 0.6 - front[0] * 0.2 * k, down[1] * 0.6 + 0.4 - front[1] * 0.2 * k]);
    pen.fill('cloth', (s) => {
      // 몸판: 어깨에서 엉덩이까지 몸통보다 조금 넓게
      s.poly([
        add(top, front, 2.6),
        add(top, front, -3.2),
        add(j.hip, front, -3.6),
        add(j.hip, front, 3),
      ]);
      // 앞자락: 엉덩이 앞에서 무릎 위까지 (열린 가운이라 앞쪽은 짧고 가볍다)
      s.poly([
        add(j.hip, front, 3),
        add(j.hip, front, -1.5),
        add(add(j.hip, front, -1), hang, 9 + 2 * k),
        add(add(j.hip, front, 2.5), hang, 7),
      ]);
    });
    // 깃: 목 아래 앞쪽 좁은 V (안쪽 그늘)
    pen.fill('clothBack', (s) => s.poly([add(top, front, 0.4), add(top, front, 2.4), add(add(top, down, 4), front, 1.6)]));
    // 하네스: 어깨에서 허리 앞으로 내려오는 금색 끈과 허리띠
    pen.fill('accent', (s) => {
      s.line(add(add(top, front, -1.5), up, 0.5), add(add(j.hip, front, 2), up, 3), 1);
      s.line(add(add(j.hip, front, -3), up, 3), add(add(j.hip, front, 3), up, 3), 1);
    });
  },
  /** 머리: 둥근 머리 볼륨 + 앞머리 + 뒤 위에서 묶어 늘어진 꽁지머리 (몸을 숙일수록 뒤로 날린다) */
  head(pen, j) {
    const c = j.head;
    const r = j.ha;
    const u: Point = [Math.sin(r), -Math.cos(r)];
    const f: Point = [-u[1], u[0]];
    const at = (p: readonly [number, number]): Point => [c[0] + f[0] * p[0] + u[0] * p[1], c[1] + f[1] * p[0] + u[1] * p[1]];
    // 꽁지머리: 머리 뒤 위에서 높이 묶어, 뒤로 살짝 솟았다가 목덜미 뒤로 늘어진다 (몸을 숙일수록 뒤로 날린다)
    const tie = at([-3.6, 3.8]);
    const back: Point = [-f[0], -f[1]];
    const k = flutter(j);
    // 처지는 방향: 중력(아래)과 머리 뒤쪽을 섞는다. 휘날릴수록 뒤쪽이 세진다
    const sag = (b: number, g: number): Point => norm([back[0] * b, back[1] * b + g]);
    const d1 = sag(1.2 + k, -0.2);
    const d2 = sag(0.7 + 1.0 * k, 1.0 - 0.4 * k);
    const d3 = sag(0.35 + 1.2 * k, 1.0 - 0.5 * k);
    const p1 = add(tie, d1, 3);
    const p2 = add(p1, d2, 6);
    const p3 = add(p2, d3, 6);
    pen.fill('hairBack', (s) => {
      // 아랫단 (한 단계 어둡게): 묶은 자리 → 끝으로 가늘어지는 굵은 붓질 (다각형은 꺾이면 겹쳐 줄무늬가 생겨 선으로 긋는다)
      s.line(tie, p1, 3);
      s.line(p1, p2, 3);
      s.line(p2, p3, 2);
    });
    pen.fill('hair', (s) => {
      // 머리 볼륨: 머리 위·뒤를 덮는다 (얼굴 쪽 앞 아래는 남긴다)
      const o = at([-0.6, 0.8]);
      s.area(c[0] - 8, c[1] - 8, c[0] + 8, c[1] + 8, (x, y) => {
        const dx = x - c[0];
        const dy = y - c[1];
        const upk = dx * u[0] + dy * u[1];
        const fr = dx * f[0] + dy * f[1];
        return Math.hypot(x - o[0], y - o[1]) <= 5.7 && (upk >= 0.9 || fr <= -1.0);
      });
      // 앞머리: 이마를 비스듬히 덮고, 볼 옆으로 한 가닥 내려온다
      s.poly([at([0.0, 5.8]), at([5.6, 2.8]), at([5.0, 0.8]), at([2.0, 2.4])]);
      s.poly([at([1.2, 2.2]), at([2.6, 1.6]), at([1.8, -4.2])]);
      // 꽁지머리 윗단: 아랫단보다 조금 위로 비켜 가늘게 (빛 받는 쪽)
      const lift: Point = [0, -0.7];
      s.line(add(tie, lift), add(p1, lift), 2);
      s.line(add(p1, lift), add(p2, lift), 2);
      s.line(add(p2, lift), p3, 1);
    });
    // 머리끈 (금색 한 점)
    pen.fill('accent', (s) => s.disc(tie, 0.6));
  },
  /** 연검 스텔라리스: 앞손에 쥔다. 칼날은 손목 방향으로 뻗다가 끝이 리본처럼 아래로 휜다 (은빛 1px + 금색 코등이) */
  top(pen, j) {
    const dir = norm([j.hF[0] - j.eF[0], j.hF[1] - j.eF[1]]);
    const n: Point = [-dir[1], dir[0]];
    const p0 = add(j.hF, dir, 1.5);
    const p1 = add(p0, dir, 4.5);
    const d2 = norm([dir[0], dir[1] + 0.45]);
    const p2 = add(p1, d2, 4);
    const d3 = norm([dir[0] * 0.7, dir[1] * 0.7 + 0.9]);
    const p3 = add(p2, d3, 3.5);
    pen.fill('trim', (s) => {
      s.line(p0, p1, 1);
      s.line(p1, p2, 1);
      s.line(p2, p3, 1);
    });
    pen.fill('accent', (s) => s.line(add(add(j.hF, dir, 1), n, -1.2), add(add(j.hF, dir, 1), n, 1.2), 1));
  },
};

/** 1P: 연분홍 몸, 흰 가운(차가운 회청 그늘), 밝은 갈색 머리, 금색 하네스, 은빛 칼날 */
const P1: Look = {
  outline: 'ink', shadow: 'lilyDark', base: 'lily', light: 'lilyLight',
  hair: ['hairBrownDark', 'hairBrown', 'hairBrownLight'],
  cloth: ['gownShade', 'gown', 'white'],
  accent: ['thread', 'threadLight'],
  trim: 'paleGrey',
  glow: 'threadLight',
};
/** 2P (같은 캐릭터끼리): 짙은 분홍 몸, 회청 가운, 짙은 갈색 머리, 어두운 금색 */
const P2: Look = {
  outline: 'ink', shadow: 'lilyDeep', base: 'lilyDark', light: 'lily',
  hair: ['suitDark', 'hairBrownDark', 'hairBrown'],
  cloth: ['gownDark', 'gownShade', 'gown'],
  accent: ['goldDark', 'gold'],
  trim: 'paleGrey',
  glow: 'thread',
};
/** 금색 잔상 (금색 실을 따라 미끄러지는 대시·순간이동) */
const GHOST: Look = { outline: 'thread', shadow: 'thread', base: 'thread', light: 'thread' };
/** 차지로 모으는 동안 몸이 대표 색(흰빛·금색)으로 빛난다 */
const GLOW: Look = { outline: 'ink', shadow: 'thread', base: 'threadLight', light: 'white' };

/** 백은우 겉모습: 장식과 색 묶음 (1P·2P·잔상·빛남) */
export const EUNWOO_SKIN: Skin = {
  id: 'eunwoo',
  label: '백은우',
  decor: EUNWOO_DECOR,
  looks: { p1: P1, p2: P2, ghost1: GHOST, ghost2: GHOST, glow1: GLOW, glow2: GLOW },
};
